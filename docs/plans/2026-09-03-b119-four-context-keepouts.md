# B119 four-context screenshot-calibrated keep-outs

Task: Close original Forge UI Editor brief acceptance row 5 without inferred geometry
Lane: FULL
Date: 2026-09-03
Owner issue: GitHub #41
Status: VERIFIED

## PLAN

- Bounded unit: replace the two deliberately unavailable built-in reference entries for the Mission/MESSAGES ticker
  and shared top-level HUD/menu strip with immutable screenshot-calibrated polygons, establish only the four
  applicability relationships directly visible in retained X4 9.00 captures, and prove each named preset paints at
  least one independently toggleable overlay through the existing Session -> Paint -> Canvas path.
- Assumptions and unresolved facts:
  - The supplied brief's approximate conversation guides (`y=0.788`, `y=0.74`, `x=0.664`) remain authoritative and
    advisory. This unit does not convert any of them into a full region.
  - X4's C++/presentation layer remains the final screen-placement authority. Shipped Lua identifies the elements and
    their configuration, while the retained screenshots establish the final drawable-relative polygons.
  - The screenshot polygons are manually traced conservative keep-out envelopes, not claims that Forge reproduces
    X4's shader, opacity, or every animated pixel.
  - The capture filenames end in `2544x1352`, but the actual JPEG dimensions are `2546x1385`. The exact client drawable
    is `{ left: 1, top: 31, width: 2544, height: 1353 }`; all normalization uses that drawable, not the filename.
- Authoritative references:
  - Supplied `FORGE-UI-EDITOR-BRIEF.md`, especially keep-out rows 63-79 and acceptance row 5.
  - Configured unpacked X4 9.00 corpus at `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`.
  - `ui/core/lua/monitors.lua` message-ticker configuration and presentation ownership (notably lines 224-270 and
    680-686).
  - `ui/addons/ego_detailmonitor/menu_map.lua` top-level creation through `menu.createTopLevel` and
    `Helper.createTopLevelTab` (notably lines 6681-6682 and 20471-20555).
  - The four 2026-09-03 live X4 captures listed under Evidence locations.
- Existing infrastructure reused:
  - `src/lib/x4UiKeepOuts.ts` is the single geometry/provenance/preset authority.
  - `src/lib/x4UiEditorSession.ts` owns selected-preset and enabled-entry issuance.
  - `src/lib/x4UiPaintPlan.ts` and `src/lib/x4UiCanvasRenderer.ts` remain the only paint path.
  - `src/components/X4UiSourceEditor.tsx` already owns four preset buttons and per-member checkboxes.
  - The existing manual screenshot-polygon calibration model supplies the closed-data validation semantics; no
    parallel renderer, overlay store, capture service, or preset UI is introduced.
- In scope:
  - A production-evidence, screenshot-bound calibrated-polygon form for built-in evidence.
  - One MESSAGES polygon traced from the first-person capture.
  - One shared top-level strip polygon corroborated independently by map-open and fullscreen-menu captures.
  - Applicability updates supported by the captures: MESSAGES in cockpit conversation and first person; top-level strip
    in map open and fullscreen menu; existing conversation and INFORMATION guides remain cockpit-conversation only.
  - Tests for exact hashes, drawable bounds, normalized points, four drawable presets, independent toggles,
    immutability, provenance forgery rejection, unavailable behavior for genuinely unmeasured entries, and no change
    to the permanent `Not verified in game` contract.
  - Source Editor evidence copy that distinguishes measured guides from screenshot-calibrated polygons.
- Out of scope:
  - Inferring a complete INFORMATION parallelogram from the one supplied `x=0.664` edge measurement.
  - Treating absent elements as applicable in a context, or fabricating map/fullscreen ticker applicability.
  - Reconstructing shaders, transparency, animation, C++ acceptance, or all X4 HUD variants.
  - Original brief row 2 (three complete-menu pixel comparisons), AI Influence reconstruction, release/version bump,
    OpenVSX publication, or changes to the `pipeline_test` mod.
- Risks and authorization boundaries:
  - A wrong polygon would become misleading design guidance. Every built-in calibrated polygon therefore carries the
    source screenshot hash, profile, drawable bounds, and explicit advisory/not-verified state.
  - A permissive provenance change could admit caller-forged geometry. Closed-data validation and issuer identity
    remain mandatory; new causal negative tests must reject forged production-calibrated polygons.
  - The broad dirty worktree is user-owned. Only the bounded paths below may be staged later.
  - No game, mod, standing X4 profile, credential, release, or live workspace write is required for implementation.
    Installed-Forge validation may rebuild/install the already-authorized private candidate but must not publish.
- Likely implementation/test paths:
  - `src/lib/x4UiKeepOuts.ts`
  - `src/lib/x4UiKeepOuts.selftest.ts`
  - `src/lib/x4UiEditorSession.selftest.ts`
  - `src/lib/x4UiPaintPlan.ts`
  - `src/lib/x4UiPaintPlan.selftest.ts`
  - `src/lib/x4UiCanvasRenderer.ts`
  - `src/lib/x4UiCanvasRenderer.selftest.ts`
  - `src/components/X4UiSourceEditor.tsx`
  - `src/components/X4UiSourceEditor.selftest.tsx`
- Explicitly forbidden implementation paths: server/API owners, layout kernel, call model, Lua emitter, linter,
  deploy/game-verification authority, extension release metadata, user screenshots, profile files, and unrelated dirty
  paths.
- Rollback/checkpoint: source authority is pushed `d9269015ea37250440554f7dc6fde75830f74e52`. Revert only the exact bounded
  implementation/test paths or the eventual bounded commit; never reset or clean the worktree.

### Screenshot evidence and exact calibration inputs

All points below are client-drawable pixels after subtracting the full-window origin `(1,31)`, then normalized by
`2544x1353`. The stored normalized coordinates must be direct division results with no hidden rounding policy.

1. Mission/MESSAGES ticker, first-person capture:
   - Screenshot SHA-256:
     `777D001A6CDF46F77AAEE76F9AC7F6E4FFF9E8CFF0F5E7C3082E93E88388DF20`.
   - Profile: `x4-9.00-617726-windowed-2544x1353-ui-scale-1.0-first-person`.
   - Conservative visible-overlay envelope, full-window pixels:
     `(254,1307) -> (850,1179) -> (850,1269) -> (281,1384)`.
   - Exact drawable-relative pixels:
     `(253,1276) -> (849,1148) -> (849,1238) -> (280,1353)`.
   - Exact normalized points:
     `(0.0994496855345912,0.943089430894309)`,
     `(0.33372641509433965,0.8484848484848485)`,
     `(0.33372641509433965,0.9150036954915004)`,
     `(0.11006289308176101,1)`.
   - The last point is clipped at the drawable bottom. The overlay is therefore a keep-out envelope for this capture,
     not a claim about off-screen presentation extent.
2. Shared top-level HUD/menu strip, map-open and fullscreen-menu captures:
   - Map screenshot SHA-256:
     `2BA6C8C065EF3563A0C2C06E814BCD226BA160BC0EE64981D07E01C01AD2ADC8`.
   - Fullscreen screenshot SHA-256:
     `BD1CAD7C69A5B11F87BEBF2BC8B5C65677654A3ECB89F9917C79BA577EC64F26`.
   - Profiles: `x4-9.00-617726-windowed-2544x1353-ui-scale-1.0-map-open` and
     `x4-9.00-617726-windowed-2544x1353-ui-scale-1.0-fullscreen-menu`.
   - Bright-pixel census independently found the same full-window visual extent: `x=1069..1475`, `y=42..139`.
   - Exact drawable-relative rectangle points:
     `(1068,11) -> (1474,11) -> (1474,108) -> (1068,108)`.
   - Exact normalized points:
     `(0.419811320754717,0.008130081300813009)`,
     `(0.5794025157232704,0.008130081300813009)`,
     `(0.5794025157232704,0.07982261640798226)`,
     `(0.419811320754717,0.07982261640798226)`.
   - One built-in geometry may carry the map capture as its primary screenshot identity; its note must name the
     fullscreen hash as independent corroboration rather than pretending the provenance type stores two primaries.

### Acceptance criteria

1. Each of `cockpit-conversation`, `map-open`, `fullscreen-menu`, and `first-person` produces at least one issued
   `projected` keep-out command with non-null geometry at `2544x1353`.
2. The existing preset buttons and each active preset's applicable member checkboxes independently add/remove their
   exact overlay without changing source, Scene geometry, paint ordering, or another preset's state.
3. MESSAGES and top-level strip built-ins project the exact normalized screenshot-derived points above and retain
   immutable screenshot hash/profile/drawable-bound evidence.
4. Production screenshot calibration is accepted only for the issued built-in entries. Caller-authored look-alikes,
   wrong hash/bounds/grade/source, built-in ID collisions through manual calibration, duplicate IDs, hostile accessors,
   stale projections, and geometry mutations refuse before Canvas paint.
5. Existing measured guides remain exactly `0.788`, `0.74`, and `0.664`; no INFORMATION rectangle is introduced.
6. Source Editor visibly identifies screenshot-calibrated evidence and retains `Advisory only` / `Not verified in
   game`; it never says a preview proves X4 acceptance.
7. Focused selftests, whole-repository typecheck, exact-path lint, build/package, installed-host visual interaction,
   complete precommit, and dirty-tree/staging hygiene pass.

### Required validation and negative path

- Baseline and post-change selftests:
  - `src/lib/x4UiKeepOuts.selftest.ts`
  - `src/lib/x4UiEditorSession.selftest.ts`
  - `src/lib/x4UiPaintPlan.selftest.ts`
  - `src/lib/x4UiCanvasRenderer.selftest.ts`
  - `src/components/X4UiSourceEditor.selftest.tsx`
- `npm run typecheck`.
- ESLint only the exact changed TypeScript/TSX paths.
- Build and private candidate package/install probe; no OpenVSX publication.
- Installed Antigravity Forge visual check: select each of the four presets, capture the Canvas with a visible polygon
  or guide, toggle at least one applicable member off/on, and confirm the Canvas changes while the source hash and
  `Not verified in game` label remain stable.
- `npm run precommit:check`, followed by exact-path staging, commit/push, and local/tracking/direct-remote parity.
- Negative path: forged/unissued production-calibrated evidence, malformed screenshot identity/bounds/points, disabled
  member, inactive preset, stale projection, and truly unavailable entry must paint no invented geometry.

### Evidence locations

- Live X4 captures:
  `dev-docs/b119-x4-ui-pipeline-smoke/keepouts-20260903/`.
- Installed Forge screenshots and receipt:
  `dev-docs/b119-x4-ui-pipeline-smoke/keepouts-20260903/forge-four-context/`.
- This task record plus the B119 main record, `BACKLOG.md`, `SESSION-HANDOFF.md`, capability-map delta if proven,
  project/global AAR ledgers, GitHub #41, Notion owner page, and Google Current Status document.

## BASELINE

- Revision/version: `HEAD == origin/main == d9269015ea37250440554f7dc6fde75830f74e52`; private installed Forge
  candidate remains `0.0.70`; no release is claimed.
- Existing changes/failures/runtime state:
  - Broad unrelated modified/deleted/untracked worktree paths pre-exist and are excluded from ownership.
  - X4 process count is zero. The 2026-09-03 keep-out capture session exited normally and did not modify a save; latest
    save remains `autosave_01.xml.gz`, 70,559,044 bytes, timestamp 2026-08-28 17:22:20.
  - X4 naturally updated profile/UI/cache/log files during the authorized capture. No standing profile restoration is
    part of this task.
  - Debug-log census after the `-nomods` capture: zero `DisplayView`, `Failed to set up the view`, `pipeline_test`,
    `Lua error`, or `stack traceback` matches; unrelated simulation `[=ERROR=]` noise remains.
  - Focused baseline: KeepOuts `17/17`; PaintPlan `180/180`; CanvasRenderer `140/140`; Source Editor complete matrix
    green.
  - Tooling failures already make this a triggered AAR: two earlier PowerShell `foreach |` parser errors, one escaped
    Windows-path loss in an inline Python command, and one corpus search that included a nonexistent helper path. The
    corrected paths/commands succeeded; none changed source or acceptance evidence.

## RECONCILE

- Resources/readers/writers searched: supplied brief; B119 handoff/backlog/main record; capability map and ADR ledger;
  current keep-out, Session, Paint, Canvas, and Source Editor owners/tests; configured X4 corpus; four live captures.
- Existing capability reused: all runtime selection, projection, paint, Canvas, manual calibration, and UI controls.
  Only evidence-bearing built-ins/applicability and their proof need extension.
- Couplings checked: provenance validation <-> issued-entry identity; built-in catalog <-> preset membership; session
  enablement <-> paint input; paint command <-> Canvas trace; Source Editor controls/copy <-> projected receipt.
- Capability-map delta: none at specification time. Add a delta only after installed-host proof establishes four
  drawable contexts.
- Plan changes:
  - The initial thought of adding generic rectangles was rejected. Live screenshots support two calibrated polygons;
    the INFORMATION region remains a single measured edge guide.
  - The first fail-first Luna pass proved both intended polygons are absent, then stopped without retaining changes
    because `src/lib/x4UiCanvasRenderer.ts` hard-codes the two production IDs as unavailable/reference-unmeasured and
    was outside its write boundary. The implementation boundary now includes that existing Canvas validator so its
    closed production rules can accept only the exact issued calibrated identities; no parallel validator is added.
  - Fresh-eyes issuer correction proved Paint captures issued entry/projection authority, then deliberately materializes
    it into frozen null-prototype JSON before command projection. Requiring identity at `projectKeepOut` correctly
    rejects caller clones but also rejects Paint's internal copy. `src/lib/x4UiPaintPlan.ts` is therefore added so the
    existing captured authority can remain paired with its validated materialization and re-projection can use the
    original issued entry. A structural/serialized trust fallback remains forbidden.

## IMPLEMENT

- Actual bounded changes: the first complete eight-path Luna candidate reached focused green, but coordinator review
  rejected it before build/install. A reproduced JSON-clone probe showed a non-issued copy of the production MESSAGES
  entry projected a polygon, and Canvas inspection showed the three cockpit-only measured guides lacked explicit
  context pins. The corrected nine-path candidate now requires issued identity, preserves that authority across Paint's
  closed-data materialization seam, requires applicable preset membership in Paint, and pins every production ID's
  allowed Canvas contexts. The exact polygons/provenance and Source Editor controls/copy are implemented.
- Scope changes and reasons: `src/lib/x4UiCanvasRenderer.ts` was added to the bounded implementation paths after the
  fail-first test exposed the existing production-rule coupling. The failed worker reverted its temporary test and
  left no source/test change; baseline tests, typecheck, and exact-path lint remained green. `src/lib/x4UiPaintPlan.ts`
  was subsequently added after the clone-refusal repair causally broke Paint's internal re-projection of a validated
  null-prototype copy; identity must be preserved across that seam rather than weakened at KeepOuts.

## VALIDATE

- Focused coordinator rerun at `2026-09-03T10:15:25-04:00`:
  - KeepOuts -> PASS, causal `9/9`, historical `18/18`; exact non-issued JSON clones of both calibrated built-ins return
    `refused` while canonical entries remain issued.
  - PaintPlan -> PASS `186/186`, including causal authority matrix `19/19` and selected four-context controls.
  - CanvasRenderer -> PASS `155/155`, including all-five production context rejection before allocation/paint.
  - EditorSession -> PASS, correction `8/8` and P7 `7/7`.
  - SourceEditor -> PASS, all matrices including P7 `12/12`.
  - Whole-repository typecheck -> PASS, exit `0`; exact nine-path ESLint -> PASS with zero findings; exact diff check ->
    PASS.
- Frozen candidate production hashes: KeepOuts `D8078BB1...71FB6`; PaintPlan `9AC1CD68...BB1E3`; Canvas
  `FFA2DDD1...42B15`; SourceEditor `6772BB5A...00A67`. Complete hashes remain available in the task transcript and
  will be repeated in the package/install receipt.
- Production build/package/install evidence:
  - `npm run build` -> PASS (`1,848` modules); staged app build and VSIX inspector/corpus probes -> PASS.
  - Private same-version candidate
    `vscode-extension/x4-forge-studio-0.0.70-b119-four-context-keepouts-019fea10.vsix` -> `2,107` entries,
    `26,290,325` archive bytes, SHA-256
    `2C1515EFD3D22CFA648B735A802986C42CB9F03EE42C118A261D030DBE8EAC8B`.
  - Installed package parity -> PASS: zero missing or mismatched package files after excluding IDE-owned
    `.vsixmanifest` and `package.json.__metadata`; the extension registry points at exact `0.0.70`; global workspace
    state retained manifest SHA-256 `331D081972EA54D875AF9BBF10DAB80313794125A0E899716C40AB7460505175`.
  - Relaunched installed sidecar served the exact candidate JS/CSS assets and loaded the configured X4 9.00 corpus as
    canonical. After a later IDE restart it reactivated on dynamic port `54671` from the same installed extension.
- Negative/rollback result: the rejected structural-clone candidate was never built or installed. Clone projection and
  wrong-context measured guides were captured red before correction; both are green only through issuer/applicability
  enforcement. Pushed source rollback remains `d9269015ea37250440554f7dc6fde75830f74e52`.
- Visual/live result: installed-product inspection proves all four context articles, exact calibrated hashes, measured
  guides, context-evidenced/not-established labels, and the permanent `Advisory only` / `Not verified in game` boundary
  are present. Exact `ui/pipeline_test.lua` SHA-256
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E` and exact `menu.createFrame` target bind;
  source-safe property controls appear and Scene reaches `partial` with three source-linked geometry diagnostics.
  The Canvas nevertheless remains stuck on the preceding no-selection refusal, so four-preset paint/toggle acceptance
  is not yet proven. This is a reproduced installed React transition defect, not permission to weaken Session/Paint/
  Canvas authority; a bounded fail-first Source Editor lifecycle repair is in progress.

### Mounted Canvas lifecycle correction and replacement candidate

- `[REPRODUCED]` The mounted Source Editor committed exact source and target state before its passive Canvas effect
  ran. The actual React `createRoot`/`StrictMode` regression was red against the exact pre-fix hook: P7 matrix `12/13`,
  with `targetCommitCanvasStatus="refused"`. Changing only the Canvas commit hook from `useEffect` to the already
  imported `useLayoutEffect` made the same matrix `13/13`; the target commit is now `rendered/current` before the
  parent layout phase. Stale-canvas retention and export refusal on selection drift remain intact.
- Parent rerun after the worker close:
  - SourceEditor mounted/canonical matrix -> PASS `13/13`.
  - KeepOuts -> PASS causal `9/9`, historical `18/18`.
  - PaintPlan -> PASS `186/186`, causal authority `19/19`.
  - CanvasRenderer -> PASS `155/155`.
  - EditorSession -> PASS correction `8/8`, P7 `7/7`.
  - Whole-repository typecheck -> PASS exit `0`; exact nine-path ESLint -> PASS; exact diff check -> PASS.
- Final source hashes before packaging: KeepOuts
  `D8078BB12D50AB5639554C37AF1C4620FFC9523ADF68E9DC3D45BD0E82C71FB6`; PaintPlan
  `9AC1CD68BC13F1034E3D1092E733D8B2E7F304A2AA12FA1D43D60C232E0BB1E3`; CanvasRenderer
  `FFA2DDD18CED2E4283CFC0A8BB3DCDAD2106ACC2BB3F5ECC927572DF9EB42B15`; SourceEditor
  `C251A27CCB4B805345E9DDB8CCC31E9AA0257C54E4FE059B57337A34CF7F4ACF`; SourceEditor selftest
  `EDAC27555204F9092EAA2C388182F34FA3FE8AD3331E24632C5DC15DA2FB6D09`.
- Replacement production build -> PASS (`1,848` modules). Asset receipts: JS
  `dist/assets/index-DZ6-s-mM.js`, `2,717,124` bytes,
  `4C622290C295594FDF2ACEA6FB38BE15332FB3FEDF599CB8A2A8AEAC804BC2F8`; CSS
  `2E442EBF0DC7CC7381FAAC208B1F58D6716B0E18D48E941A48136CF487781F08`; server
  `868D04E91367ABE05CE68DC215E665F5AC66E98D8267D0926CC2BB0C02EB8844`.
- Staged-app extension build/probe -> PASS `16/16`; configured-corpus linter -> PASS `81/81` files read, zero failed,
  zero applicable fatal errors. Final private same-version package
  `vscode-extension/x4-forge-studio-0.0.70-b119-four-context-canvas-layout-019fea10.vsix` passed the strict inspector at
  `2,107` entries / `71,590,886` unpacked bytes / `26,290,331` archive bytes; SHA-256
  `C38261FFCE069C5B290C422A76DCAA68DE8CA770E39BD0E401E78EB9088DDDA1`.
- Installed-host validation is intentionally pending. X4 is absent, but the unrelated `CrimsonDesert` process sampled
  at approximately `95.6%` aggregate GPU-engine use, invalidating the machine-quiet premise. The package is built but
  not installed while that live surface is active.

### 2026-09-05 installed replacement regression

- Baseline/installation: with X4 absent, Antigravity running, and the machine quiet, the exact replacement package
  `x4-forge-studio-0.0.70-b119-four-context-canvas-layout-019fea10.vsix` was installed after a complete extension and
  registry backup. Archive/install comparison passed with `2,104` expected payload files, zero missing, zero
  mismatched, and zero unexpected files after excluding the two IDE-owned manifest files. The relaunched sidecar served
  the expected JS `4C622290...BC2F8`, CSS `2E442EBF...81F08`, and server `868D04E9...8844` bytes and loaded the configured
  X4 9.00 corpus as canonical.
- `[REPRODUCED]` Two fresh installed-sidecar clients selected exact source `ui/pipeline_test.lua` at SHA-256
  `C1D9CD85...718E` and exact target `menu.createFrame`. Target-bound source controls and the partial Scene with three
  source-linked geometry diagnostics became current, and a `2560 x 1440` canvas element exists under the preview host,
  but the public Canvas state and PNG-export authority remain `refused` / unavailable with the preceding
  no-selection message. Browser error/warning logs are empty. This is the same split-state installed failure the
  replacement was required to remove.
- Acceptance revision: the mounted synthetic-DOM `13/13` result is retained as useful source-level evidence but no
  longer closes the lifecycle defect. The next fail-first repair must reproduce the installed controlled-select plus
  parent-snapshot lifecycle and prove one coherent `rendered/current` Canvas/export commit. Exact Session/Paint/Canvas
  authority, stale-result retention, permanent `Not verified in game`, and all four context-applicability gates remain
  non-negotiable.

### 2026-09-05 parent-snapshot ordering repair candidate

- `[REPRODUCED]` A mounted React parent using the same state-setter callback contract as `App.tsx` received the first
  exact `ui/pipeline_test.lua` / `menu.createFrame` verification snapshot while the public Canvas still reported
  `refused`, no accepted surface was mounted, and PNG export remained disabled. The same mounted row later settled to
  `rendered/current`, proving an effect-ordering race rather than malformed source/target selection.
- The bounded repair preserves the callback contract but withholds a non-null parent verification snapshot until the
  Canvas state is current and non-stale, the accepted renderer surface is the element mounted in the Canvas host, and
  the PNG-export identity is the same exact source/target/profile snapshot. Selection drift still clears the parent
  snapshot, retains the preceding bitmap only as `stale`, and refuses export; restoring the exact target mounts a new
  current bitmap.
- Fresh coordinator validation: SourceEditor complete matrix PASS with P8 `13/13`; KeepOuts causal `9/9` and historical
  `18/18`; PaintPlan `186/186`; CanvasRenderer `155/155`; EditorSession correction `8/8` and P7 `7/7`; whole-repository
  typecheck PASS; exact nine-path ESLint PASS; exact diff check PASS. Build, private package/install replacement, and
  installed four-preset visual interaction remain required before this unit can close `VERIFIED`.

### 2026-09-05 installed four-context acceptance close

- Final private package
  `vscode-extension/x4-forge-studio-0.0.70-b119-four-context-snapshot-order-20260905.vsix` passed strict inspection
  at `2,107` entries / `71,591,062` unpacked bytes / `26,290,386` archive bytes; SHA-256
  `737A755251BCD1B71D05C53F9040B7B631423D0BDE41F7AAD649C8B5FE40EA9E`. Installed all-file parity found `2,105`
  package files, zero missing, zero mismatched, zero unexpected, and only the allowed IDE-owned `.vsixmanifest`.
- The relaunched installed sidecar served the exact packaged JavaScript, CSS, and server assets, loaded the configured
  X4 9.00 corpus as canonical, and bound exact source `ui/pipeline_test.lua` SHA-256
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E` to exact target `menu.createFrame` at a
  `2560x1440` native Canvas. Canvas reported `rendered/current`, PNG export was enabled, and the permanent game truth
  remained `Not verified in game`.
- Installed interaction selected all four preset buttons and exercised every applicable checkbox independently:
  cockpit-conversation `4/4`, map-open `1/1`, fullscreen-menu `1/1`, first-person `1/1`. Every disable changed the
  native Canvas hash and every re-enable restored the exact all-on hash while source, target, and game-truth identity
  stayed unchanged. Full-canvas visual inspection confirmed the three measured guides, MESSAGES polygon, and shared
  top-HUD strip; no INFORMATION rectangle was introduced.
- Receipt and twenty retained PNGs:
  `dev-docs/b119-x4-ui-pipeline-smoke/keepouts-20260903/forge-four-context/receipt.md`. Native full-canvas exports are
  the accepted oracle where the clipped viewport hides lower geometry.
- Complete close gates: `npm run precommit:check` PASS; `npm run test:e2e` PASS `106/106`, zero failed/flaky/bad or
  quarantined-blocking results, complete report, child exit `0`, and `treeGone=true`; ports `3100/3101` closed while
  the installed sidecar remained HTTP `200`; installed runtime oracle sweep PASS `134/134`; Graphify refreshed to
  `10,257` nodes / `25,719` edges / `318` communities. X4 remained stopped and no live mod/game byte changed.

## REVIEW

- Requirements 1-7 are done and evidenced. Fresh-eyes review rejected the first complete candidate, forced issued-entry
  and context-authority corrections, reproduced the mounted parent-snapshot race, and found no remaining blocking issue
  in the final nine-file diff. Graph reverse traversal reaches only the expected Source Editor/UIBuilder, Session,
  Preview/Scene, Paint, Canvas, and selftest consumers. `reviewctl`/BlastRadius are unavailable on this host; the exact
  graph review, focused causal matrices, `134/134` installed oracles, and `106/106` full e2e provide the automated and
  integration review evidence.

## CLOSE

- Status: `VERIFIED`. Original brief row 5 is closed by exact installed-host causal paint evidence; overall B119 remains
  `IN_PROGRESS / PARTIAL` because row 2 still lacks three complete real-menu Forge/X4 pixel comparisons.
- Deliberately unchanged: X4/game files, real mod files, public extension version, OpenVSX, C++ frame acceptance truth,
  and the permanent `Not verified in game` preview boundary.
- Remaining risks/deferred work: original brief row 2, final AI Influence dogfood reconstruction, false-success native
  Save As wording, release acceptance, and OpenVSX remain separate.
- Commit point: `feat(ui-editor): calibrate four keep-out contexts`.

## AAR

- Triggered: live capture automation and inspection required multiple attempts; the first fail-first implementation
  pass exposed an omitted validator owner and ended without retained changes; fresh-eyes review then forced
  reimplementation after reproducing a non-issued-clone acceptance and finding incomplete production context pins.
- Sustain: use screenshot hash + exact drawable bounds + normalized points; preserve unavailable instead of inventing.
- Improve work/approach: validate shell/path syntax before combining loops, pipes, and inline interpreters.
- Improve tools: X4 ignores high-level accessibility key injection despite reported success; native scan-code
  `SendInput` plus rendered-effect confirmation is the proven automation path for this host.
- The installed-host check found a second integration gap that module/SSR matrices missed: React updated exact target
  metadata, source-safe controls, and Scene diagnostics while the mounted Canvas state retained the earlier refusal.
  The corrective test must drive the actual mounted source -> target lifecycle and assert current bitmap/export state,
  not infer Canvas success from child module output.
- The lifecycle defect was causally isolated to passive-effect ordering, not Session/Paint/Canvas authority. Preserve
  the layout-phase mounted regression; do not weaken the exact source/target or issued-evidence gates to hide a stale
  host commit.
- During this check Windows temporarily stopped resolving the repository's `F:` DOS drive even though the exact volume
  remained healthy and readable by stable volume GUID. No repository write occurred while the mapping was absent; the
  same `\Device\HarddiskVolume100` mapping recovered before work resumed.
- Additional triggers: the same-version install wrapper treated a null `$LASTEXITCODE` as failure despite complete byte
  parity; `New-Item -LiteralPath` was incorrectly used as though it supported the needed path form; the raw oracle
  sweep first targeted its dead default port before the supported `X4_FORGE_BASE` rerun passed; and deep-scrolled CUA
  button activation returned without changing product state while ordinary installed-sidecar Playwright proved the
  exact controls. No failed attempt changed product source or weakened an oracle.
- Highest-risk evidenced weakness: a preset label can exist while every member paints zero geometry, a current Scene
  can coexist with a stale Canvas refusal, and a clipped viewport can hide a real native-canvas mutation. The final
  guard is the four-preset non-null geometry matrix, mounted parent/Canvas/export identity regression, independent
  installed toggles, and native full-canvas export/hash inspection.
- Global/project lessons banked: wait for canonical corpus readiness before driving source/target selectors; treat CUA
  activation as untrusted until rendered state changes; and use the native full Canvas rather than a clipped viewport
  as the keep-out mutation oracle.
