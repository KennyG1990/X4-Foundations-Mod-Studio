# B119 AI Influence visual dogfood and release-gap census

Status: `PARTIAL / OVERALL B119 IN_PROGRESS`

Task: Exercise the completed source-first X4 UI editor against the real AI Influence Lua and the twelve supplied visual references, then repair only evidenced editor or layout gaps.

Lane: `FULL`

## PLAN

- **Bounded unit:** establish current-source Forge and X4 captures for the shipping AI Influence surfaces; reconcile each reference image against the same-source output; use Forge-owned source editing, validation, artifact, and deploy paths for any layout-only correction proved necessary; retain exact rollback evidence.
- **Assumptions and unresolved facts:** `1b` is the selected comm-link direction; `1a` and `1c` are alternatives, although `1c` also ships as the expanded long-negotiation view. Existing history says `1b`, `1c`, `1d`, `1e`, and hub tabs `1g`-`1j` have been seen in X4, but current captures must re-establish present behavior. `1f` has no implemented counter-offer menu and no authoritative deterministic price-versus-acceptance model; this must be confirmed before any shipping implementation.
- **Authoritative references:** the supplied handoff README and all twelve images under `C:\Users\Moshi\Desktop\# AI Influence mod UI design\design_handoff_ai_influence`; configured X4 9.00 `helper.lua`, `widget_fullscreen.lua`, and Zekton corpus; shipping `x4_ai_influence` Lua; Forge B119 acceptance records; ADR-F4/F5; the source-first pipeline and linter already verified by the original brief.
- **In scope:** exact current-source import/round-trip; named sample values for dynamic text without executing Lua; Source -> Layout -> Scene -> Paint -> Canvas inspection; all eleven linter families; keep-out overlays; current X4 rendering and interaction; Forge-guarded layout-only corrections when evidence requires them; same-source deployment and post-deploy X4 proof.
- **Out of scope:** replacing the existing renderer/deployer; executing arbitrary Lua in Forge; inventing runtime values; implementing strategic pricing or negotiation economics; presenting `1a` and `1c` as simultaneous compact directions; fake HAIL/reload/refresh controls; changing gameplay mechanics, AI prompts, saves, corpus files, credentials, or public release state. OpenVSX publication remains a later release-acceptance unit.
- **Affected surfaces:** `src/lib/x4Ui*`, `src/components/X4UiSourceEditor*`, `src/components/UIBuilder*`, only if a reproduced editor gap requires repair; Forge evidence and B119 records; the configured `x4 AiLive` workspace; and, only through Forge's guarded writer/deploy chain, layout-only files under `ui/addons/ai_influence_chat/`.
- **Risks and authorization boundaries:** X4 C++ may reject a frame that Forge accepts; dynamic runtime state may make screenshot reproduction non-deterministic; the installed test-only `pipeline_test` extension can hijack the X4 start menu; AI source and deployed bytes must not drift invisibly. User explicitly authorized Forge/game writes, game launch, Computer Use, commits, pushes, and later publishing, but publishing is deliberately excluded until release acceptance passes.
- **Rollback/checkpoint:** Forge `HEAD == origin/main == 1690898eda51c3caf6adb1252ac35b38368b8bc6`; AI source `HEAD == origin/master == 4c0a422b7e3d0f492b572b9da8d2d7ea19a2b453` and clean. Current key AI Lua/source/deployed hashes match. The installed `pipeline_test` directory was moved intact to `dev-docs/b119-ai-influence-dogfood/runtime-isolation/pipeline_test-installed-20260905T1135/`; its four file hashes were equal before and after, and rollback is the exact reverse move while X4 is stopped.
- **Acceptance criteria:**
  1. Every supplied image is classified as selected shipping direction, alternate direction, composite tab reference, implemented-and-current, visually divergent, data-blocked, or deliberately unsupported, with no silent omissions.
  2. Each shipping Lua source imports and re-exports with the same calls and values; every preview carries `Not verified in game` until an exact clean deploy and explicit X4 confirmation.
  3. Forge produces non-zero current canvases for the selected `1b` comm surface, `1c` expanded surface, `1d` pending gate, `1e` agreement sheet, and all six hub tabs using only owner-issued source targets and named samples where runtime text is dynamic.
  4. Any linter-blocking source is refused before export/deploy, including `addTable(24)`; no rule is weakened to admit current source.
  5. Any accepted correction is authored through Forge's existing guarded source/CAS path, survives round-trip, validates as a complete mod, deploys through `deploy-verify`, and is observed in X4 with zero scoped frame/view/Lua failures.
  6. `1f` is not shipped with fabricated probabilities. It may be classified or rendered as an explicitly fixture-bound, not-in-game design benchmark only; a functional shipping menu requires a separate deterministic pricing contract.
- **Required validation:** focused owner selftests; whole-repository typecheck and exact-path lint; AI mod Lua/glyph/vocabulary/menu gates; Forge complete mod validation; guarded dry-run and real deploy when bytes change; installed package parity if Forge product code changes; native Forge visual inspection; native X4 capture and interaction; scoped debuglog census; full precommit before commit. Run serial E2E, production build/package/probe, installed oracles, and OpenVSX checks only when their touched surface makes them applicable.
- **Negative/failure paths:** dynamic values without supplied samples remain honestly unavailable rather than guessed; stale source/workspace/deploy identities refuse; a known `>12` table fixture refuses; `1f` refuses promotion to shipping without the deterministic price model; the isolated `pipeline_test` folder must not disappear and must be restored after AI capture unless continued isolation is documented.
- **Evidence locations:** `dev-docs/b119-ai-influence-dogfood/visual-release-20260905/`; this task record; B119 canonical plan close; `BACKLOG.md`; `SESSION-HANDOFF.md`; project capability/AAR ledgers when a delta or lesson exists; GitHub #41, Notion owner, and Google Current Status projection after a verified checkpoint.

## BASELINE

- **Forge revision:** `1690898eda51c3caf6adb1252ac35b38368b8bc6`, equal to `origin/main`. The pre-existing unrelated dirty tree is preserved outside this unit.
- **AI revision:** `4c0a422b7e3d0f492b572b9da8d2d7ea19a2b453`, equal to `origin/master`; worktree clean.
- **Configured runtime:** X4 9.00 build `611726`; configured unpacked corpus `F:\Downskies\x4unpackersuitev1\X4 unpacked 9.00`; selected Forge workspace `x4 AiLive` (`ws_bca860d02b9ea61f6028bfb4`).
- **Source/deploy drift:** content, registration, and the six principal UI Lua files are byte-equal. The only content-tree differences found were `.forgekeep`, source-only local metadata, and deployed-only `.mcp.json`; none is a player-facing Lua/XML drift.
- **Observed runtime baseline:** with `pipeline_test` installed, X4 entered `startmenu`, auto-opened Menu A, and closing it left no usable vanilla navigation. X4 was stopped and the exact fixture was isolated recoverably before relaunch. This is environment contamination, not an AI Influence render finding.

## RECONCILE

- **Existing capability reused:** shipping `aic_menu.lua` implements selected `1b` plus inline `1d`; `aic_comm.lua` implements expanded `1c`; `aic_sheet.lua` implements `1e`; `aic_hub.lua` implements one six-tab `1g`-`1j` hub; `aic_uix.lua` is the shared synchronous state owner. Forge already owns source parsing, scalar/structural CAS edits, named string samples, layout/scene/paint/canvas, linter, artifact compilation, and guarded deployment.
- **Historical X4 evidence:** commit receipts record `1c` and `1e` against a real 24,000 Cr proposal, subsequent live visual repairs, and all six hub tabs. These establish provenance, not current acceptance.
- **`1f` finding:** the current `COUNTER-OFFER` button only closes `aic_sheet` and enables the compact menu's amount-entry mode. Existing D&D approach odds are real but answer a different question; they cannot truthfully populate price acceptance/counter/break-off meters.
- **Couplings checked:** one conversation state and send path across `1b`/`1c`/`1d`/`1e`; one hub accessor surface across `1g`-`1j`; source-folder/workspace CAS; source versus loose staging versus installed target; static gate enrollment in the mod deploy script; preview versus game-verification authority.
- **Capability-map delta:** none at specification time. Record only demonstrated new or invalidated capability at close.
- **Plan changes from reconciliation:** changed from greenfield UI construction to audit/repair/dogfood of existing shipping surfaces; isolated `pipeline_test` before AI runtime capture; explicitly separated the data-blocked `1f` functional surface from visual benchmark work.
- **Current visual census checkpoint:** current-source X4 captures now exist for `1b`, expanded `1c`, inline `1d`, and all six hub tabs under `dev-docs/b119-ai-influence-dogfood/`. All rendered in X4 without a frame refusal. In `1d`, the source-authored `REVIEW` footer button was not visible or clickable at its expected cell, so `1e` is not yet re-established through the current interaction path.
- **`1d` source/reference reconciliation:** the authoritative `1d` mock contains exactly three action buttons (confirm, counter, refuse) followed by one informational footer; it does not contain a `REVIEW` button. Shipping `aic_menu.lua` instead adds a fourth `REVIEW` route inside the footer and uses it to open `1e`. The missing native button is therefore still valuable renderer/geometry evidence, but making that extra button visible is not itself the final player-facing fix. The later mod correction must preserve the specified three-choice surface and select the `1e`/`1f` transition from an authoritative proposal-type or interaction contract rather than retaining an accidental fourth action.
- **Native right-edge symptom:** the same accepted X4 frame also omitted the compact input row's source-authored rightmost `END` button while retaining the preceding `SEND` button. No scoped `DisplayView`, setup, colspan, or Lua failure accompanied either omission. This narrows the runtime symptom to right-edge widget geometry/composition or overlapping-menu behavior, not the known whole-frame rejection class.
- **First exact Forge loss point:** after all 22 source-bound scalar samples were supplied, Forge rendered only the bottom edit box plus `SEND` and `END`. The accepted Layout program recorded 66 operations but applied only 27; 39 remained conditional/unresolved. Twelve valid samples were not consumed because their owner/control-flow contexts were not applied. The existing exact-source regression fixture freezes this reduced result (`3` widgets, `5` text records, `7` glyphs), so the current test proves structural acceptance rather than visual completeness.
- **Existing infrastructure to extend:** `x4UiLayoutProgram` already issues source-hash-bound preview-path catalogs and validates mutually exclusive arm selections for expanded local-function invocations. The editor session and source editor do not expose or reconcile that authority, direct target calls do not consume it, and loop bodies remain intentionally unreplayed. The next unit extends this owner rather than creating a second scenario system.
- **Revised bounded implementation unit:** thread owner-issued preview-path catalogs and selections through Preview Pipeline -> Editor Session -> Source Editor; permit a selected source arm to materialize direct target calls as well as expanded local-helper calls; retain loop bodies as explicit unavailable evidence. Selection is preview-only, mutually exclusive per boundary, source/target/profile-bound, stale-clearing, and never changes source or game-verification state.
- **Revised unit acceptance:** a portable direct-branch fixture and the exact current `aic_menu.lua` pending-action header/footer path must render when their exact arms are selected; unselected sibling arms remain unapplied; conflicting, extra, stale, source-mismatched, malformed, and statically unreachable selections refuse or clear at their owning boundary; no loop is replayed; `Not verified in game` remains invariant. The native `REVIEW`/`END` discrepancy is investigated only after this preview unit exposes the authored source geometry. Preview fidelity to current source and final fidelity to the supplied design remain separate acceptance questions.
- **Installed-candidate interaction finding:** packaged extension `0.0.70` installed with staged-app parity and reopened as Forge `v1.0.501` at the installed sidecar. The new `Preview branch paths` surface is visibly present. Browser Playwright/AX `selectOption` calls reconciled `menu.display` back to `Select target...`, but a native Antigravity dropdown selection retained both exact `aic_menu.lua` and `menu.display` across render cycles. The browser reset is therefore automation-path-specific and is not accepted as a normal-user component failure.
- **Native session authority refusal:** the retained native target did issue a current session, but Source-safe property controls reported `READ-ONLY · PROVENANCE-DRIFT`: `layout evidence pair was not issued for the canonical complete source call model`. The exact issued context ends in `catalog:source:missing`; no owner-issued frame/display insertion authority is available. Evidence: `dev-docs/b119-ai-influence-dogfood/visual-release-20260905/native-forge-menu-display-session-controls.jpg`.
- **Independent native branch/Scene refusal:** after selecting the exact pending-action `then` arms at source lines `711`, `717`, and `721`, and supplying the source-bound geometry/text samples needed by those calls, the installed Forge retained the selections but classified the canvas `stale`. The exact reason is `Session is not renderable: layout program is malformed, incomplete in required structure, or internally mismatched`. This is now the branch-path acceptance blocker; it is independent of the source-edit authority refusal. Evidence: `dev-docs/b119-ai-influence-dogfood/visual-release-20260905/native-forge-menu-display-selected-path-stale-canvas.png`.
- **Causal Scene receipt:** the loader-issued configured-corpus reproduction reached the same public `malformed-structure` refusal with `66` operations / `35` applied and `1/4/9/88` frame/table/row/cell geometry. The first failed invariant was `cell-outer-height` on the selected `REVIEW` button at source line `755`: Helper kernel height `25` had not been finalized to the effective-scale height `35` because unresolved sibling text made the whole row height unavailable. Scene's rejection was correct; the producer finalization boundary was incomplete.
- **Pre-existing P7 gate reconciliation:** `x4UiEditorSession.selftest.ts` is identically red on clean detached `HEAD 1690898` and on the candidate: the fixture records `13` Scene color facts and `30` paint tints, while its oracle expects `31`. Commit `0194d62` changed text layout to the native `horizontalBearing + advance` pen metric; the seven-letter narrow-cell fixture now yields six visible glyphs, but this downstream cardinality oracle was not updated. This is a test-oracle repair only unless a bounded worker finds contradictory lower-layer or native evidence.
- **E2E envelope reconciliation:** the first current-candidate full serial E2E failed the B116 dense pointer-close control twice and later lost its structured report to Windows child exit `3221226505`. Re-running only that control under bundled Node `24.19.0` retained a red zero-flake verdict, but its attached product measurement was green: `1,424` rendered nodes, close `656 ms`, maximum heartbeat gap `212.8 ms`, and worst long task `157 ms`, all below the unchanged `5,000 ms` product limits. The failure was the enclosing case's inherited setup/attachment work crossing its explicit `45,000 ms` wall-clock override; the retry completed in `34.6 s`. An environment-equivalent detached clean-HEAD run passed first-attempt in `40.8 s`. The bounded correction may restore only this case to the suite's existing `60,000 ms` envelope. It must not change the `1,424`-node fixture, any `5,000 ms` interaction/heartbeat/long-task threshold, the one-worker topology, retry count, fail-on-flaky policy, or structured-verdict authority.
- **Revised validation-repair acceptance:** tests first must retain the current red receipt, then the exact dense control must pass first-attempt under bundled Node with a structured `1/1`, zero-flake verdict and `treeGone=true`; the complete serial suite must subsequently pass with zero failed/flaky/bad/quarantined-blocking results. This repair owns only `tests/e2e/continuous-polling.spec.ts`; production polling, Canvas, Agent Bridge, B119 renderer code, and mod/game files are forbidden unless new causal evidence contradicts the green product measurement.
- **Installed zero-pixel false-success reproduction:** a fresh standard Playwright session against the installed `0.0.70` sidecar selected exact current `aic_menu.lua -> menu.display`, retained all `22/22` supplied sample values, and retained exactly the owner-issued `then` arms at source lines `711`, `717`, and `721`. The UI reported `rendered/current`, enabled native PNG export, and showed no sample/path errors, but the mounted `2560x1440` Canvas contained exactly `0` non-transparent and `0` non-black pixels. This is a reproduced presentation false success: a current receipt does not currently prove that source-composition mode emitted a visible pixel.
- **Color-evidence hypothesis, not diagnosis:** a separate cold browser load reproduced both core and canonical-default color loaders as `unavailable` while direct host requests to the same installed reference endpoints immediately returned HTTP `200`. Missing or transient color authority is therefore a leading explanation for a source-composition plan with no active visible tint/glyph command, but causality is not yet proved. The next worker must reproduce the exact accepted-empty boundary in a deterministic component/renderer fixture before changing production.
- **Revised visible-Canvas acceptance:** source-composition output with no visible draw must never be labeled `rendered/current` or export-ready. A canonical-core plus unavailable-color fixture must fail closed with a typed, user-readable state; it must not silently substitute diagnostic-map paint as faithful source composition. The exact selected current MENU fixture must produce a mounted non-zero bitmap when the required canonical evidence is available, or explicitly identify the missing evidence when it is not. Existing stale-surface retention, source/target/profile identity, post-validation mutation refusal, renderer callback defenses, and `Not verified in game` remain mandatory.
- **Reconciled native PNG Save As wording unit:** the existing Source Editor export path proves that the current mounted Canvas serialized to a nonempty `image/png` blob and that an `<a download>` request was dispatched. That browser contract does not report whether the user completed the installed host's native Save As dialog, which destination was chosen, or whether any final file exists. This bounded repair changes only the post-dispatch truth label and its direct test oracle; it does not add a parallel native bridge, alter renderer/export eligibility, or claim filesystem receipt authority.
- **Save As wording acceptance:** after one observed browser download event, the status must say that PNG serialization succeeded and a save/download request was handed to the host, explicitly state that final Save As/file completion is not verified, tell the user to confirm the file, and retain `Not verified in game`. It must not use `exported`, `saved`, `completed`, or equivalent success wording. Existing missing/throwing/empty serialization refusals, current-canvas identity checks, one-download cardinality, and stale/export-disabled behavior remain unchanged. Required evidence is the focused Source Editor E2E plus the existing component selftest, typecheck, scoped ESLint, and diff hygiene. Owned code/test paths are `src/components/X4UiSourceEditor.tsx` and `tests/e2e/x4-ui-source-editor.spec.ts`; all renderer, extension-host, release-center, mod, game, workspace-state, and unrelated dirty paths are forbidden.
- **Release reconciliation:** Open VSX already serves stable `0.0.70` from 2026-08-21 (`26,130,460` bytes; SHA-256 `C8BCA5E1DBB0F5630A546370FD621F5968BFD1151CC0806828F352BDED6479BF`). The current private installed B119 candidate is different (`26,295,864` bytes; SHA-256 `CFBEF17479BB2C72A6AD12E1D88EC997675EDA6EE085077FD654CAD86700129F`), so `0.0.70` is burned and must not be republished or described as the B119 release. If release gates remain green, the next stable version is `0.0.71`. Publish-before-commit remains mandatory: add truthful modder-facing `0.0.71` notes, regenerate the changelog, build/stage/compile/package/inspect, prove installed payload/runtime/UI behavior, publish once, verify the public version and independently downloaded package hash, then commit/push only the explicit B119 and release paths. A missing token, red gate, version collision, package mismatch, or public readback mismatch is a release stop.

## IMPLEMENT

- The branch-path unit now exists across the established Layout Program -> Preview Pipeline -> Editor Session -> Source Editor owners. It exposes owner-issued direct-target and expanded-local branch catalogs, applies only one selected arm per source boundary, keeps sibling arms conditional, never replays loops, and labels the controls `Preview only` / `Not verified in game`.
- The layout-evidence provenance mismatch is repaired through one Layout-owned canonical call-model view shared by Preview Pipeline and Source Edits. The repair preserves the raw call model for literal edit locks and retains issued-pair identity, source/target binding, stale/mutated/forged rejection, and `Not verified in game`.
- The installed-candidate interaction exposed a separate selected-branch Scene structural mismatch. A causal exact-menu or source-faithful nested fixture must reproduce the first failing invariant before production repair. The browser-only select reset is automation-path-specific and is not the production blocker. No AI Influence source or deployed game bytes have changed.
- The exact selected-branch mismatch is repaired at Layout finalization: deterministic button/icon/edit-box outer heights are now retained even when unresolved sibling text leaves the aggregate row height unavailable. Scene validation remains unchanged; loop rows remain conditional; the exact configured path now reaches non-refused Scene and Paint with `canRender=true` and `Not verified in game`.
- Required-gate follow-up is bounded to correcting the stale P7 paint/glyph cardinality oracle against the already-shipped native pen-advance behavior. Production color, text-layout, Scene, and Paint code are out of scope for that follow-up unless its fail-first analysis contradicts the clean-HEAD/corpus receipt.

## VALIDATE

- Current-source native X4 visual baseline captured for `1b`, `1c`, `1d`, and all six hub tabs. Forge scalar-sample replay reproduced the reduced three-widget canvas.
- Continuation safety baseline: X4 is loaded in the current save; the last `1,200` debug-log lines contain no `DisplayView(): Failed to set up` or equivalent view-setup failure. Workspace mod HEAD is `4c0a422`; workspace and installed-game `aic_menu.lua` both remain SHA-256 `4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`. Evidence screenshot: `dev-docs/b119-ai-influence-dogfood/visual-release-20260905/x4-runtime-idle-before-branch-repair.png`.
- Branch-path focused results before installed interaction: Layout Program `707/708` with one standing skip; Preview Pipeline `118/118`; Source Editor `13/13`; scoped ESLint and production build passed. Editor Session remained red only at the independently reproduced clean-HEAD P7 oracle (`30` paint tints observed versus `31` expected); that baseline was not normalized or weakened.
- Production build, extension stage/build, `16/16` staged-app probe, VSIX package/inspection, installed-byte parity, and installed sidecar restart passed. The first VSIX installation attempt correctly failed while the old sidecar held the extension directory; stopping the exact backend and retrying installed successfully.
- Source-authority repair focused validation is green: Layout Program `707/708` with one standing skip; Preview Pipeline `118/118`; Source Edits `95/95`; exact six-file ESLint; TypeScript; and owned-path diff hygiene. Installed proof of the repaired authority remains pending a rebuilt package.
- Live installed branch-path acceptance is red after successful native exact-target and path selection: `menu.display` and all three requested pending-action arms remain selected, but Scene refuses the issued program as malformed/internally mismatched and Canvas remains stale. A portable direct-branch fixture is green, demonstrating that the missing regression is the real nested pending structure rather than the basic path-control contract.
- Post-repair configured-source validation is green: Layout Program `707/708` with one standing skip; strict Scene `178/178` plus configured census `3/3`; Preview Pipeline `118/118`; B119 Editor Session causal matrix `8/8`; scoped ESLint; TypeScript; and owned-path diff hygiene. The exact receipt preserves `66/35` operation counts, `1/4/9/88` geometry, selected path/sample authority, conditional loop calls, non-refused Scene/Paint, `canRender=true`, and `Not verified in game`.
- Required Editor Session suite remains red only at the independently reproduced clean-HEAD P7 oracle (`30` paint tints observed versus `31` expected). The stale oracle is now a documented validation repair, not evidence against the selected-branch production fix.

## REVIEW

- The original specification-time review placeholder is superseded by the dated implementation, validation, and
  release-boundary review appended below.

## CLOSE

- Specification-time status was `SPECIFIED`; the current close is `PARTIAL / OVERALL B119 IN_PROGRESS` in the dated
  checkpoint below.
- Suggested commit title when verified: `feat(ui-editor): dogfood AI Influence visual surfaces`.

## AAR

- Trigger already fired: the installed pipeline fixture contaminated the X4 start-menu baseline.
- Trigger: the portable direct-branch acceptance fixture passed while the exact nested pending branch failed at the real Scene boundary. The next repair must add a causal nested Scene/Paint/Canvas regression, not rely on Layout-only materialization counts.
- Trigger: the exact native pen-advance correction changed clipping cardinality without updating a downstream owner-binding oracle. Cross-layer visual/cardinality tests must be re-run whenever glyph advance semantics change, even when the text-layout unit tests themselves are green.
- Sustain: capture source, installed, runtime, and visual identity separately before editing.
- Improve work/approach: do not infer current surface status from old inventory documents when later source history supersedes them.
- Improve tools: test-only UI extensions need an explicit non-autostart/default-off mode so one proof fixture cannot obstruct another mod's validation.
- Highest-risk evidenced weakness: current AI UI can have historical game receipts while Forge still sees only static fragments unless dynamic samples and target authority are supplied exactly. The bounded experiment is to census each current surface before widening parser behavior.
- Lessons banked at close only after current evidence is complete.

## 2026-09-06 CONTINUATION — linter-first release and AI Influence close boundary

### RECONCILE / IMPLEMENT

- The linter-first source editor and the `0.0.71` release candidate were already implemented before this documentation
  close. This continuation records the final evidence without changing source, tests, package files, game files, or
  workspace contents.
- Direct `x4UiLint` selftest is `140/140`, including the clean, warning, blocking `addTable(24)`, whole-frame, and
  conversation-close symptom families. The linter remains source-backed and fail-closed; `13-23` is warning-level,
  `24+` is blocking, and clean output does not imply engine acceptance.
- No capability-map delta: the evidence strengthens the existing linter-first/source-preview capability and does not
  demonstrate universal Helper/widget parity or a new game capability.

### VALIDATE

- Final VSIX is `F:\DEV_ENV\X4_Forge\vscode-extension\x4-forge-studio-0.0.71.vsix`, exactly `26,296,414` bytes,
  SHA-256 `3143296C72B5A8B6A526148CA98048FA340FA534BB41A1D890F930DA69FB054B`. Package inspection passed with `2,107`
  archive entries and `2,105` extension payload files.
- The final install backup is retained at
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-0.0.71-final-install-backup-20260906T024434135Z` (`2,106`
  files / `71,618,336` bytes). Installed package parity passed for all `2,105` packaged files; only the expected IDE
  `.vsixmanifest` extra remained, normalized `package.json` matched, and app JS/CSS/server identities matched. The
  installed sidecar restarted at port `56347`, PID `64300`, from the installed `0.0.71` app.
- Installed runtime oracles passed `134/134` with `X4_FORGE_TIMEOUT_MS=90000`; serial E2E passed `106/106` with zero
  failed/flaky/bad/quarantined results and `treeGone=true`. The ephemeral ports `3100/3101` were closed and the live
  workspace was unchanged. Production build passed `1,848` modules, stage/build and probe passed `16/16`, precommit
  passed, and Graphify refreshed to `10,396` nodes / `26,075` edges / `336` communities (HTML intentionally skipped
  above the size guard).
- The installed final sidecar visibly rendered the Forge workbench and setup modal, so it was not blank or stale. A
  prior installed Pipeline Test Menu A proof has a current `2560x1440` canvas/export, but visible text-row/wrap
  overlap means it is not universal pixel-fidelity evidence.
- The exact installed `x4 AiLive` source path `aic_menu.lua -> menu.display` correctly refused source-composition
  visual diagnostics with: `source-composition has no renderer-issued visible source geometry fill/border or canonical
  tinted glyph; visual diagnostics require an authoritative source operation`. Export was disabled. The source SHA-256
  remained `4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`; preview truth remains `Not verified
  in game`.
- Public OpenVSX publication and independent artifact parity are now a bounded `VERIFIED` unit. At
  `2026-09-06T06:59:36Z`, the `0.0.71` version endpoint returned HTTP `200` and `/versions` contained `0.0.71`.
  Independent download from
  `https://open-vsx.org/api/x4forge/x4-forge-studio/0.0.71/file/x4forge.x4-forge-studio-0.0.71.vsix` was exactly
  `26,296,414` bytes with SHA-256
  `3143296C72B5A8B6A526148CA98048FA340FA534BB41A1D890F930DA69FB054B`, matching the local final VSIX exactly. At
  `2026-09-06T07:08:17Z`, the registry `/latest` pointer also returned `0.0.71` with that same download URL. The
  earlier `0.0.70` pointer was transient indexing lag that resolved; public pointer convergence is now verified.

### REVIEW / CLOSE

- **Done and evidenced:** linter-first implementation and focused selftest; final package inspection; installed
  payload/runtime parity; installed rendered-host smoke; runtime oracles; serial E2E; production/build/probe gates;
  exact public `0.0.71` version/download/hash readback; and the fail-closed no-visible-source-geometry rule.
- **Partial:** the AI Influence benchmark remains open. The current `1b`, `1c`, `1d`, and hub surfaces are rendered or
  classified but materially divergent from the supplied references; `1e` is not re-established through a valid current
  path; `1f` remains data-blocked. Exact few-pixel cross-menu game parity, exact scale correlation beyond bounded
  fixtures, and full reference reconstruction/current in-game validation are not proven. No universal Helper/widget
  parity claim is made.
- **Final status:** `PARTIAL / OVERALL B119 IN_PROGRESS`. **Bounded `0.0.71` publish/artifact-parity unit:** `VERIFIED`,
  including the resolved `/latest` pointer readback. X4 is not running for this documentation close; permanent `Not
  verified in game` semantics remain unchanged.
- **Evidence record:** `dev-docs/b119-ai-influence-dogfood/visual-release-20260905/CENSUS.md`, this plan, the final VSIX,
  the retained install backup, and the independent public download described above. External wiki updates are the UI
  quick-reference cards and the X4 Forge AAR entry; `F:\StarForge\wiki\workflow\aar-log.md` and the capability map
  were intentionally not changed because no cross-project lesson or demonstrated capability delta exists.

### AAR

- **Triggers:** the default `20s` oracle timeout produced a false red before the supported `90s` pass; one E2E run
  aborted at test 1 and another Windows child exited at `88/106` before the final `106/106`; the first workspace
  automation missed the required Switch workspace confirmation; a combined parity command was rejected before
  execution by command policy; the first reinstall path relaunched the IDE and same-version replacement later hit
  `EPERM` after `1,104` rename retries; stale-directory move/reinstall recovered safely; and Graphify skipped HTML above
  its size guard.
- **Sustain:** keep package, installed, runtime, public download, and visual evidence as separate authorities; retain
  exact hashes and the permanent game-truth warning; require positive renderer-issued geometry before source-composition
  preview success.
- **Improve work/approach:** do not treat `rendered/current`, enabled export, or clean linter output as visible
  source-composition proof when the mounted Canvas has no pixels. Keep the AI benchmark open until exact cross-menu and
  full reference checks are complete.
- **Improve tools:** use the supported oracle timeout and serial E2E receipt, verify workspace-switch confirmation,
  isolate same-version install locks with a recoverable stale-directory move, and record transient `/latest` indexing
  lag separately from artifact parity. The final whitespace/readback probes needed quoting-safe PowerShell corrections
  before their clean passes.
- **Highest-risk evidenced weakness:** Forge source-composition can report a current receipt while emitting zero
  non-transparent and zero non-black pixels. The positive-geometry/refusal requirement is a Forge preview rule only,
  not a proven X4 engine behavior.
