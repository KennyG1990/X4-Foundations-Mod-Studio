# B119 source-proven numeric frame geometry

Task: B119 source-proven numeric frame geometry
Lane: FULL
Status: VERIFIED (bounded unit); overall B119 remains PARTIAL
Date: 2026-08-28
Owner: GitHub #41

## PLAN

- Bounded unit: extend the existing X4 UI call-model and layout-program authorities so a closed, source-proven numeric expression can be projected from exact Lua source through the profile-pinned `Helper` constants and already-accepted direct `Helper.scaleX` / `Helper.scaleY` local results. The first required production expression is the real `pipeline_test` centering formula:
  - `local width = Helper.scaleX(530)`
  - `local height = Helper.scaleY(436)`
  - `local x = ((Helper.viewWidth or 1920) - width) / 2`
  - `local y = ((Helper.viewHeight or 1080) - height) / 2`
- Assumptions and unresolved facts:
  - `helper.lua` remains authoritative for `Helper.round`, `scaleX`, and `scaleY`; profile-captured `viewWidth` and `viewHeight` remain runtime facts rather than invented literals.
  - The call model may preserve a closed expression without claiming it is a runtime value. The layout program alone resolves it against an exact normalized profile.
  - Real X4 remains the frame-acceptance and visible-pixel authority. This unit can make Forge geometry exact for the supported expression grammar, but cannot prove C++ frame acceptance.
- Authoritative references:
  - `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00\ui\addons\ego_detailmonitorhelper\helper.lua`, especially shipped `Helper.round`, `scaleX`, and `scaleY`.
  - `src/lib/x4UiLayoutKernel.ts`, the current source-pinned port of those functions.
  - `src/lib/x4UiCallModel.ts`, owner of source AST/data-flow facts.
  - `src/lib/x4UiLayoutProgram.ts`, owner of profile-bound projection and evidence issuance.
  - `src/lib/x4UiScene.ts`, consumer that emits a finite frame rectangle only after all four frame coordinates are known.
  - Exact fixture `F:\DEV_ENV\projects\Mods\X4Mods\pipeline_test\ui\pipeline_test.lua`.
- In scope:
  - A closed immutable numeric-expression descriptor with exact source locations and a deliberately narrow grammar: numeric literal, accepted profile-pinned `Helper` numeric constant, accepted bound direct `scaleX` / `scaleY` result, grouping, unary numeric sign, Lua `or` where truthiness is decidable, and finite arithmetic needed by the fixture.
  - Profile-bound recursive resolution with exact provenance and fail-closed validation.
  - Causal call-model and layout-program tests; a Scene-level assertion only if required to prove the finite frame rectangle reaches the existing consumer.
- Out of scope:
  - A generic Lua evaluator; ambient globals; arbitrary function calls; dynamic tables; loops; conditional branch selection; runtime sampling; `scaleFont` as geometry; production changes to Paint, Canvas, SourceEditor, server routes, deployment, or the mod.
  - Game-directory/config writes, a new deployment, OpenVSX publication, full AI Influence reconstruction, or a 1:1 pixel claim.
- Likely owned implementation paths:
  - `src/lib/x4UiCallModel.ts`
  - `src/lib/x4UiCallModel.selftest.ts`
  - `src/lib/x4UiLayoutProgram.ts`
  - `src/lib/x4UiLayoutProgram.selftest.ts`
  - `src/lib/x4UiScene.selftest.ts` only if the existing Scene contract needs a direct acceptance assertion.
- Risks and authorization boundaries:
  - The primary risk is unsound promotion: a forged descriptor, reassigned alias, conditional definition, unknown identifier, divide-by-zero/non-finite result, or unsupported call must remain unavailable and must never become source-proven geometry.
  - Preserve all unrelated dirty files. No broad staging. No write to the real mod, game directories, X4 profile, standing config, GitHub, Notion, Drive, or OpenVSX during implementation.
  - X4 is currently running at its main menu. Focused source checks may run; heavy e2e/precommit and any deploy/config mutation wait until X4 is closed and the machine-state gate is rechecked.
- Rollback/checkpoint: repository checkpoint `c8d06ae98942c5aaea12a4f1ab05b8820b8990c3`; revert only the explicit owned paths and this task record if the bounded change fails review.
- Acceptance criteria:
  - Exact real fixture at profile `1920x1080`, UI scale `1` projects `width=530`, `height=436`, `x=695`, and `y=322` with finite known frame facts and source/profile provenance.
  - At profile `2544x1353`, UI scale `1.25`, shipped rounding projects `width=663`, `height=545`, `x=940.5`, and `y=404`.
  - Existing direct scale geometry behavior remains unchanged; `scaleFont` cannot become frame geometry.
  - Rawget/lazy-refresh `Helper` identity continues to work without claiming runtime non-nil availability.
  - Unknown identifiers, reassignment between definition and use, ambiguous conditional ownership, unsupported calls/operators, divide-by-zero/non-finite outcomes, malformed/forged expression descriptors, source-range mismatch, and schema mutation all fail closed.
  - Issued program/evidence authority remains deterministic, frozen, JSON-round-trippable, and accepted by the existing pair validator.
- Required validation and negative path:
  - Fail-first exact-fixture probe.
  - `x4UiCallModel.selftest.ts` and `x4UiLayoutProgram.selftest.ts`; Scene selftest if touched.
  - TypeScript, exact owned-file ESLint, diff hygiene, fresh-eyes review, and deterministic `graphify update .` after source changes.
  - Full e2e, precommit, build, deploy, and in-game comparison remain later gates and cannot run while X4 is active.
- Evidence locations:
  - This task record contains the causal baseline and close.
  - Existing real-X4 two-profile truth remains under `dev-docs/b119-x4-ui-pipeline-smoke/in-game-20260828/`.

## BASELINE

- Revision/version: `HEAD == origin/main == c8d06ae98942c5aaea12a4f1ab05b8820b8990c3`; X4 9.00 build 611726.
- Existing changes/failures/runtime state:
  - The worktree contains unrelated user-owned documentation, deleted legacy scripts/data, extension-release work, images, and untracked files. None belongs to this unit.
  - Existing B119 host gates at the checkpoint are green: route `491/491`, oracles `134/134`, targeted browser `3/3`, controlled e2e `104/104`, precommit, and production build `1,848` modules. The retained first e2e `103 + 1 flaky` remains red evidence.
  - X4 was launched through the installed Steam target and reached its real modified main menu at `2544x1353`; no game/profile/mod mutation has occurred in this unit.
  - Exact-fixture fail-first result: model parsed; target `menu.createFrame`; direct width/height scale identities present; frame width is known `530` and height known `436`; frame x and y are `unavailable` with reason `frame x/y is not a complete static number`; overall projection is `partial`.

## RECONCILE

- Resources and readers/writers searched:
  - Graphify confirms `x4UiLayoutProgram.ts` imports `x4UiCallModel.ts`, and `x4UiScene.ts` consumes/re-exports the layout-program authority. `projectX4UiLayoutProgram()` is also consumed by preview, Scene, source edits, and their selftests.
  - The call model currently folds arithmetic only when both operands are already static. It preserves exact bound direct scale-result aliases but does not expose a closed numeric expression tree for later profile binding.
  - `resolveNumber()` currently accepts a static number, accepted direct scale result, one recognized profile-pinned `Helper` constant, or an exact preview sample. It cannot recursively resolve arithmetic over those authorities.
  - Existing pipeline selftest proves scaled width/height but substitutes `x=0, y=0`, so it did not cover the production centering expressions.
- Existing capability reused: call-model AST/source ranges, direct-scale identity and reassignment guards, normalized projection profiles, source-pinned Helper constants, exact kernel scaling/rounding, program/evidence validation, and Scene finite-frame checks.
- Couplings checked: source model -> target catalog -> layout projection -> issued evidence -> Scene frame rectangle; profile constants and direct-scale map must agree with expression leaves and exact source locations.
- Capability-map delta: accepted for the bounded claim only. Closed source-proven numeric geometry can now be profile-projected from exact Lua source; this does not claim generic Lua evaluation, C++ frame acceptance, or pixel parity.
- Plan changes: the defect remained expression provenance/projection, not missing `scaleX`/`scaleY` semantics. After X4 was closed cleanly and the machine-state boundary was re-established, the originally deferred full host gates were promoted into this checkpoint so the implementation could be committed from current evidence rather than a focused-only result.

## IMPLEMENT

- `x4UiCallModel.ts` now emits a deeply frozen numeric-expression descriptor only for the closed grammar declared above. Leaves retain exact literal, profile-pinned `Helper` receiver, or directly bound `scaleX`/`scaleY` identities; grouping, unary sign, binary `+ - * /`, and Lua `or` retain exact source ranges and operand order. Ordinary data flow and runtime availability remain unchanged.
- `x4UiLayoutProgram.ts` independently reparses the exact model source with Lua 5.2/ranges enabled, validates every descriptor node against the exact source AST, verifies receiver/direct-scale/binding identity, rejects later reachable reassignment, and recursively resolves accepted leaves against the selected profile. Source-proven expressions are excluded from preview-sample authority, and the internal descriptor is stripped from issued operation/evidence metadata so the existing public Scene contract does not widen.
- The call-model, layout-program, and Scene selftests now cover both real profiles, exact source ranges, frozen/JSON evidence, configured MENU/HUB/COMM sessions, sample-authority refusal, rawget/lazy Helper identity, `scaleFont` exclusion, unknown/reassigned/conditional/unsupported/divide-by-zero/non-finite cases, modulo exclusion, parser-accepted comments/whitespace, malformed/range/schema attacks, structural operator/operand forgeries, and an all-copy valid-decoy alias substitution.
- Production `x4UiScene.ts`, Paint, Canvas, SourceEditor, server routes, deploy owners, the mod, game directory, X4 profile, and unpacked corpus were not changed.

## VALIDATE

- Fail-first exact fixture -> REPRODUCED: width `530` and height `436` were known, while x/y were unavailable as incomplete static numbers.
- Causal negative receipts retained:
  - Preview-sample authority attempt -> `635/636`; conflicting `-999` samples could be consumed while source still produced `695/322`.
  - Structural descriptor forgeries -> `636/638`; a root `/ -> +` mutation falsely produced `1883`, and swapped Lua-`or` operands falsely produced `628.5`.
  - Profile-dependent negative modulo -> `639/640`; JavaScript remainder semantics falsely produced `-3`, so modulo remains outside the grammar.
  - Alias-decoy first attempt -> non-causal `641/641` because the profile source identity did not match. Corrected fail-first -> `640/641`: all six valid descriptor copies were replaced by the same-context `/4` decoy and old production falsely accepted `x=347.5`. Final binding validation requires the selected alias value expression and location to equal the descriptor root.
- Final focused host evidence:
  - Call model -> `72/72`.
  - Layout program -> `641/641` with no failed rows.
  - Scene -> `153/153`; configured public-session census `3/3` for MENU/HUB/COMM.
  - `npm run typecheck` -> exit `0`.
  - Exact five-file ESLint -> exit `0`; exact owned-path `git diff --check` -> exit `0`.
- Independent real-file read-only probe of `F:\DEV_ENV\projects\Mods\X4Mods\pipeline_test\ui\pipeline_test.lua`:
  - Before/after `5,488` bytes and SHA-256 `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`; byte-identical, parsed, target `menu.createFrame` at lines `77-106` / offsets `2709-4565`.
  - `1920x1080`, UI scale `1`: x `695`, y `322`, width `530`, height `436`.
  - `2544x1353`, UI scale `1.25`: x `940.5`, y `404`, width `663`, height `545`.
  - x/y cite the exact line-83/84 formulas; width/height cite the exact line-81/82 direct Helper calls. Both program/evidence pairs validate; both projections remain `partial` because of nineteen unrelated unsupported facts. No fixture byte was written.
- Graphify deterministic refresh -> exit `0`; current ignored graph is `9,955` nodes / `24,922` edges / `334` communities, and `projectX4UiLayoutProgram()` resolves with `84` relationships.
- Repository-wide host evidence:
  - A raw `node scripts/oracle-sweep.mjs` call without a server correctly failed `0/133`; the owning isolated `npm run test:oracles` harness then passed runtime-indexed `134/134` and removed its port/process tree.
  - First full E2E attempt was retained red: test 24 passed only on retry, execution later terminated after test 81 with Windows `0xC0000409`, and the structured report was unavailable. Its fail-closed receipt is `dev-docs/b119-source-proven-numeric-geometry/e2e-red-20260828-01/e2e-verdict.json`, SHA-256 `E0D2AE77EEAAFE2C853418497020A2B5B72CE93B6443C8470F8D4AB03B7653B5`.
  - Controlled bundled-Node `v24.19.0` full E2E -> `104/104` in `7.9m`, zero failed/flaky/bad/quarantined-blocking results, complete discovery/terminal parity, child-close, `treeGone=true`, zero remaining PIDs. Receipt SHA-256 `F58275F0E2F370422B6ABDA5073DB6B12F3A7F054D38194D2B745AEF7C6DEFB4` is frozen under `dev-docs/b119-source-proven-numeric-geometry/e2e-green-20260828-01/`.
  - Complete precommit -> PASS: tripwires/canon mirrors, verdict `55/55`, Vite lifecycle, product copy, durable writers `14/14 + 8/8`, capability `12/297/1/11`, MCP narrowing/recovery, action receipts `82/56`, whole-repository TypeScript, and size guards.
  - Production build -> `1,848` modules and bundled server; existing chunk-size warning only. Full repository lint -> exit `0`, zero errors, `592` pre-existing warnings.
- Final containment -> X4 absent; ports `3000/3001/3100/3101/8972` free; no owned oracle/E2E/precommit/build/Graphify process remains; persisted Antigravity config remains SHA-256 `355B4B636AD6C0BB3B58DEA793DE409C2375B8A81230433C0F0FDD48FBEE3B5A`.

## REVIEW

- Production centering formula -> done and evidenced by the exact real-file source ranges and both profile facts.
- Closed grammar and exact Helper/direct-scale leaves -> done; unsupported/runtime-dependent forms remain unavailable.
- Source identity, binding, reassignment, structural AST, schema, freeze, JSON, and sample-authority negatives -> done and mutation-sensitive.
- Scene consumption -> done for a finite frame rectangle without changing the Scene production contract; the permanent `Not verified in game` boundary remains.
- Real X4 two-profile scaling -> historical deployed-X4 evidence remains valid for the unchanged package. This checkpoint now supplies the missing exact Forge frame facts for the same two configured profiles, but no fresh pixel-edge capture was made and C++ frame acceptance is not inferred from preview.
- Fresh-eyes review found no P0-P2 defect in the bounded implementation after the decoy-root correction. Deliberately conservative limits include no alias-chain expansion, no generic Lua evaluator, no modulo/power/`and`, and no right-branch authority when a finite profile-pinned Lua number wins `or`.
- Renderer parity / full brief / OpenVSX release -> deliberately deferred, not claimed.

## CLOSE

- Status: `VERIFIED` for the bounded source-proven numeric frame-geometry unit. Overall B119 remains `IN_PROGRESS / PARTIAL` and GitHub #41 remains open.
- Capability-map delta: closed source-proven frame expressions over the accepted grammar now project from exact Lua through profile-pinned Helper/direct-scale authorities. This supersedes the prior claim that this fixture's dynamic x/y/width/height geometry is unavailable; it does not supersede the permanent game-truth boundary.
- Remaining risks/deferred work: exact Forge-versus-X4 pixel-edge comparison, complete `helper.lua` / `widget_fullscreen.lua` parity, remaining brief/linter/layout coverage, full AI Influence reconstruction from all inspected references, installed release proof, and OpenVSX publish-before-commit.
- Suggested commit title: `feat(ui-editor): project source-proven numeric geometry`.

## AAR

- Triggered: reconciliation corrected the defect from missing direct-scale support to missing closed arithmetic provenance; four causal test families failed before repair; the first alias-decoy attempt was non-causal; one intermediate test-only TypeScript narrowing failed; raw oracle invocation omitted its owner; the first full E2E was incomplete/red; and one broad artifact listing exceeded the output boundary.
- Sustain: use exact deployed Lua and exact source ranges as the fail-first fixture; require mutation-sensitive forgery tests; keep profile facts distinct from runtime/game acceptance; use the official isolated oracle owner and bundled Node for accepted Windows E2E evidence.
- Improve work/approach: earlier pipeline coverage replaced production x/y with zeroes, allowing this gap to survive two real-game proofs. Future smoke fixtures must preserve the exact production formula instead of simplifying the hard part away.
- Improve tools: raw oracle sweep should remain documented as server-dependent; large JSON/selftest/artifact output must be reduced in-process before it reaches the terminal; default Node `24.15.0` remains unreliable for the long Playwright gate on this host.
- Highest-risk evidenced weakness: a structurally valid descriptor copied from a nearby same-context expression can look authoritative unless the selected alias's ordinary value expression/location is pinned to the descriptor root. The all-copy decoy test now holds that boundary.
- Global/project lessons banked: project capability-map and project AAR deltas are required at durable close. No global memory update is authorized.
