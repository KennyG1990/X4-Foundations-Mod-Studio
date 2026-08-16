# Session handoff — B119 X4 UI editor linter-first real layout port

Date: 2026-08-15
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL` — linter, source/corpus, call model, Helper layout program, Scene, preview/paint/Canvas,
source-first React/editor Batch 7A, and the focused Batch 7B/7C source-mutation boundary are accepted. Batch 7D remains
`FINDINGS / ROUND 5 CORRECTION ACTIVE`; broad/installed/deploy/game gates are locked and nothing is verified in game.
Current critical-path delta: the rejected conditional-owner `550/550` candidate has been replaced by a tests-first
`558/558` layout candidate at `9B7A48361EF1BC00306BFD6B312CDCC9BB56CA756EB381ABA88C5A71CD051210` /
`9F8F3B2777842BE9141B4CC7E8F83A543A6C81514827F8F998F4B02DFEFA444C`. Fail-first was exactly `550/558`, with
eight intended reds, fixtures `8/8`, zero throws, and unchanged production. The repair resolves deferred table/row/cell
owners independently, binds emitted source identities, enforces reciprocal operation order, and reconciles final
Helper/kernel `reserveScrollBar`. Coordinator reran `558/558`, typecheck, exact lint, phase `15/15 + 49/49 + 11/11`,
and zero hostile acceptance. It also caught a stale worker typecheck receipt after the final test edit; a one-expression
tests-only correction restored typecheck while production stayed frozen. Exact workspace/installed hashes still match
for menu `4253D9BD...47DD7`, hub `657476EA...B8C4F`, and comm `88FAB05A...3511`. Fresh zero-write native Luna audit
`01a00796-c378-7d80-bcad-452cd290213b` returned `FINDINGS`, not `CLEAN`. With the canonical configured corpus,
`1920x1080`, UI scale 1, and consumer-aware samples, all three exact sessions remain `canRender=false`. Menu consumes
16 samples but self-refuses because a program cell operation source reference does not identify its owning cell. Hub
and comm consume 11 and five samples, emit `partial` programs with geometry `2/2/4` and `1/1/3`, then strict Scene
refuses both as `malformed-structure`; paint is never reached. Layout `558/558`, phases `15/15 + 49/49 + 11/11`,
typecheck, exact lint, hostile refusal controls, declared hashes, and zero-write parity all held. Scene remains
strict/frozen; exact three-menu `canRender=true` and a later audit `CLEAN` remain mandatory before broad gates.
The rejected renderer checkpoint is read back at GitHub #41 comment `5304669783`; the later precommit/candidate state
is read back at comment `5304942931`. The canonical Drive document now contains the promoted-manifest checkpoint at
revision `78` / Docs revision `AIroW35zilH6cbfsvLYHgF2GCdKz0jhA4iQRZD1Kzm5t0lLlcIk0rp7hZZ9KmqzlA9U2ZFUFuNF0m_x32IYmlSRuiFED5x4b60s_Oe2a7a5M`.
Two Notion comment writes returned success IDs
`3bd4618e-d15b-8169-900a-001d629c4546` and `3bd4618e-d15b-81d7-953a-001d9ecc6503`, but repeated page/discussion
readback still reports 25 comments and exposes neither ID. Treat the Notion projection as unverified and do not issue
another blind retry; GitHub, Drive, and repository Markdown are durable. The first Drive mutation also took roughly
30 minutes before returning, then read back correctly; both connector behaviors are AAR/tool-friction evidence.
Checkpoint containment was revalidated after those projections: the exact B119 manifest has 52 paths, including only
the reviewed route-disposition manifest addition, and the remaining 28 entries are excluded. The manifest's tracked
`git diff --check` exits zero. The existing Graphify graph predates the untracked B119 files and has no
`projectX4UiEditorSession` node; do not rebuild it before this checkpoint because that would add more dirty artifacts.
At `2026-08-16T00:04:11Z`, read-only process evidence found 18 `Antigravity IDE` processes and zero X4 processes; Ken
explicitly confirmed the machine is quiet and ordered a checkpoint commit followed by continued work. The mandatory
machine-state gate is satisfied for the exact 52-path B119 partial checkpoint. Stage only that manifest; preserve all
28 excluded entries.
Fresh focused linter evidence is current: `x4UiLint.selftest.ts` passes `112/112`; the corpus safety selftest passes
`12/12`; and the live read-only census against Forge authority `http://127.0.0.1:53797` resolves the configured root
`F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` at generation `1785035333079-2178b4c31f`. It reads `81/81`
official base/DLC Lua files with zero failures and zero applicable fatal findings, keeps all six trusted-official online
call findings visible as not applicable, reports six warnings, 70 unverified files, 26 truncated files, and 13,657
verification gaps, and exits zero. This supersedes older current-count summaries but is linter evidence only—not
renderer, C++ frame-acceptance, or game proof.
Follow-up zero-write native Luna `01a007cf-8266-7df3-a083-e1a9af631564` reproduced the menu refusal at the exact
source-owner invariant: `operation.cellId` resolves to a cell whose identity is absent or differs from the emitted
receiver/result/semantic reference. Exact operation fields remain unknown after a confirmed PowerShell inline-harness
failure. Hub/comm first Scene stages also remain unknown because `validateProgramStructure` discards the stage before
returning `false`; do not invent them. After checkpoint, repair sequentially and tests-first: menu producer ownership
first, then instrument and repair the exact hub/comm producer-to-Scene mismatch. Require all three exact sessions at
`canRender=true` plus a fresh zero-write `CLEAN` before broad gates.
The first authorized precommit run exited `1` at the capability audit before staging. Two one-file Luna corrections
removed only CommonJS `require.main` direct-run guards from `x4UiIntegration.selftest.ts` and `diagnosticsMap.ts`;
their direct tests pass `7/7` and `11/11`, import safety/typecheck/diff checks pass, and the audit now advances. It then
correctly reported the new public X4 UI integration selftest and four reachable sources missing from standing route
authority. Ken explicitly authorized reviewed candidate
`C2B4AE641B0C849F2348E8241BAEEEA5F64BA49213CCD6E34E2E4B6323F227C5`; native Luna promoted it, and the
standing manifest's final SHA-256 exactly matches the candidate. It adds only those four sources and
`GET /api/agent/x4-ui-integration-selftest` with the standard public-selftest shape; all capability/MCP/dynamic-route
signatures and every other semantic field remain unchanged; three existing route records were textually reordered only.
Candidate in-memory audit, `npm run test:capabilities`, typecheck, manifest diff hygiene, and the complete
machine-state-authorized `npm run precommit:check` pass. No files are staged at this handoff update. Exact-stage the 52
declared paths next and keep all 28 unrelated entries excluded.
Round-four hashes `E2B2D665...5D6392` / `74A48DA0...1B21DB` / unchanged UIBuilder `7132FBDC...32B0A` passed focused
families `41/41 + 10/10 + 2/2 + 29/29 + 8/8 + 27/27`, source edits `34/34`, preview `89/89`, linter `112/112`,
typecheck, and exact lint. Fresh zero-write auditor `01a002bd-1b13-7a11-8aaf-d8df3ae0e5bc` rejected them: the actual
stage/apply event callbacks still capture context/state E and can run after live authority/draft R, erasing R state or
editing E before tagging the result R. Existing tests do not execute that stateful E/R handler ordering. The first
Round-five continuation lane stopped with zero writes after an Agent Brain recall hung and its exposed runtime metadata
could not prove native `luna_executor` / `gpt-5.6-luna` / `max`; this was a routing/runtime failure, not a product or
filesystem-permission finding. Fresh exact native Luna `01a00365-95a3-7be3-9f9a-3f6d5acac624` then captured all 72
new stale-handler rows red before production repair and returned candidate hashes
`C7D1ABB7D638D403EE6150A2FFC511D654938650B33B16DBD98BB384E96294F2` /
`0D061E8D301E70E9233B07A2E85B27E33D42D196BC303464A76F5F3CB3FCEB7D`; UIBuilder stayed exact at
`7132FBDC...32B0A`. Coordinator reran every old/new source-editor family, typecheck, and exact lint green. Fresh
zero-write hostile auditor `01a00378-8f7b-7883-a2ec-a30b1cb72e4c` rejected the pair with two causal findings: a
reentrant `flushSync` parent submission can change live refs/draft before the old handler unconditionally installs its
pending object, and fulfillment/rejection can clear a newer staged draft when context/submission stay the same. All
three hashes remained exact and the auditor wrote nothing. Round-six native Luna
`01a0038b-4666-7171-b39c-32f761da501c` now owns the same two files tests-first; UIBuilder remains frozen.
Read-only runtime evidence confirms the active Antigravity sidecar and saved config use the expected workspace,
extensions, game, and `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` corpus paths. The actual browser corpus loader
accepted live manifest generation `1785035333079-2178b4c31f` and all exact Helper/widget/Zekton hashes. No config or
external source was written. Workspace and installed X4 hashes also match for all three acceptance menus plus
`content.xml` and `ui.xml`, so the first game comparison can be read-only once the current Forge build renders.
Critical correction to that readiness estimate: the production session census over those exact sources currently gives
`canRender=false` for all three display targets. `menu.display` self-refuses on local-invocation uniqueness; `hub.display`
and `comm.display` self-refuse on the direct-layer literal/source-location relation. The `542/542` synthetic layout suite
did not cover these valid shipping shapes. A disjoint tests-first layout-program correction reached coordinator-green
`548/548` at hashes `9ECFE8AA...29C2F2` / `EC3D2D94...85A09A`; all three exact live targets now produce a `partial`
layout program instead of refusing. Fresh zero-write layout audit `01a00353-6779-70e3-a4bf-743157508f31` returned
`FINDINGS` with zero writes: historical `548/548`, exact lint, hashes, and hostile identity/provenance checks remained
green, but the corrected real sampled menu path reproduced the conditional `setColSpan` owner-schema failure below.
Native Luna `01a00369-ec87-72a0-a790-5b76a0a3537e` now owns the resulting tests-first two-file layout repair. The exact
full-session rerun also exposed the next cross-owner blocker: Scene rejects all three
issued pairs at `validateProgramStructure` as `malformed-structure`, leaving `canRender=false`. Scene-only native Luna
`01a00352-510b-71a0-9841-fc54c1e6e92b` reproduced exact `model-order` and `row-reciprocal` failures, then returned a
two-file candidate at hashes `ADE6C8E6EC3125E023B05A0C793AD48716BC6002F6C4775CCE3628B4049CE5C3` /
`9C0214635824A21FC47D9F767AA0BC5DA43F3789784EFA2B18C22C60A2C80707`. Coordinator reran Scene `122/122`,
typecheck, and exact lint green. Zero-write Scene auditor `01a00381-f62a-7a11-92cb-20c5009174b8` found no causal Scene
defect: 72 probes passed (`7/7` positive, `56/56` refusal, `9/9` malformed), and real hub/comm geometry was accepted.
It withheld `CLEAN` only because layout changed mid-audit and its snapshot caught temporary layout-test type errors.
Those errors are now fixed; the parity rerun against stabilized layout hashes returned `CLEAN`: Scene `122/122`, full
typecheck, exact lint, all 72 hostile outcomes, and all four hashes passed. Scene is focused-accepted; browser and game
parity remain locked.
The conditional-owner `549/549` candidate at `EE6A58C1...C61AA3` / `A9295A27...C1016` is rejected. Fresh zero-write
auditor `01a003a1-f051-7c32-98b9-f98382a7211a` preserved hashes and passed typecheck/lint plus hostile `11/11`, but the
exact sampled menu still self-refuses. It proved the direct positive is noncausal: 12-column `ct` materializes while the
conditional `setColSpan` closes over earlier 4-column `tt`. Native Luna `01a003bc-cf99-7913-bff4-d1b9ced8e455` owns
the same two files tests-first and must bind exact issued source ownership before a new three-menu census/audit. Source-editor
Round-six production remains exact
`C7D1ABB7...96294F2`; selftest `6F09FB2F...376E83` now exits `1` with 82 causal reds: 64 reentrant-parent combinations,
16 draft-only settlement combinations, and two exact-pending idempotence cases, while the independent control is `4/4`.
The bounded repair is now focused-green at `5154A1BB...7D004` / `B5702729...04A81`: every old source-editor matrix plus
Round-six `64/64 + 16/16 + 2/2`, exact lint, source edits `34/34`, preview `89/89`, linter `112/112`, editor session,
and diff-check pass; UIBuilder remains exact. Fresh zero-write auditor
`01a0039d-838e-78d3-8ddf-fdb2ef061e68` returned `CLEAN` with zero writes and all three hashes exact. Its actual-callback
matrix passed reentrant `64/64`, draft-only `16/16`, settlement `2/2`, acknowledgements `24/24`, callback variants
`9/9`, the complete selftest, and exact lint. Source-editor Round six is focused-accepted. The current full repository
typecheck is green after the concurrent layout selftest's narrowing errors were cleared.
Coordinator then exercised the exact session-issued sample catalog/binding/authority path. Hub and comm produce
validator-valid `partial` programs with materialized geometry (2 tables / 2 rows / 4 cells and 1 / 1 / 3) before the
same Scene refusal. Menu instead exposes a second layout-program failure after all 16 samples reconcile: self-validation
rejects `program.operations[29]` because a conditional `setColSpan` branch carries a `cellId` relation its schema says is
not emitted. The first blanket numeric fixture incorrectly supplied `span=80` and was discarded; the same failure
survives the corrected consumer-aware `span=6` rerun. Audit `01a00353-6779-70e3-a4bf-743157508f31` independently
reproduced the exact `malformed-profile` refusal at source line 726 / model order 219. Unsampled partial programs are not
render-readiness evidence. The audit's repository typecheck was temporarily red only because the concurrent Scene
selftest writer had an in-progress type-predicate diagnostic at line 5281; the Scene owner must clear it before return.

Completion boundary after the current layout/census gates: a clean first three-menu render unlocks broad/runtime work
but does not close B119. Current inspection confirms the source-canonical editor still lacks direct-call insertion and
visual manipulation; pure keep-out calibration lacks mounted screenshot/polygon UI; button/edit-box/icon paint remains
explicitly unsupported; and UIBuilder has not yet consumed the existing exact readiness/deploy/experience confirmation
authority. Compile/export/package byte proof, installed Forge evidence, UI-scale parity, exact deploy identity, and all
three Forge-versus-X4 screenshot comparisons remain mandatory.
Batch 7D now has a corrected candidate under fresh audit. The first 41-assertion candidate was rejected before audit
because its parent callback could report accepted before the functional updater refused a newer live workspace. The
correction causally reproduced seven reds, then made submission pending until exact parent readback: replacement R alone
accepts, unchanged expected E remains pending, and newer N is preserved with typed `stale-parent-workspace` refusal.
Corrected hashes are `82DFB6DB...7A878`, `EC448373...F42F8A`, and `C2378669...62BFD5`; coordinator reran 41/41 prior 7D,
10/10 parent-CAS, 2/2 pending SSR, all eight focused dependencies, typecheck, exact lint, hygiene, and frozen hashes green.
Fresh zero-write audit `01a00250-c881-7820-a273-f9f03e00ca96` nevertheless returned `FINDINGS`: owner-accepted no-op
installed success before parent acknowledgement, so stale live N could be preserved while rendered E reported accepted.
Correction round two is active in the same three files. No-op E-to-E now requires an exact attempt-bound parent
acknowledgement because identity alone cannot prove the updater ran; changed E-to-R, stale N, delayed/cloned/forged ack,
and pure updater behavior remain in the same permanent matrix. The audit order's truncated layout hash was corrected to
the actual unchanged `6D16A261...FA7484` and is not a product finding.
The workspace-source issuance dependency remains focused-green at `8D4B00CE...C9B109` / `F3EA3525...37123A`.
Layout 7B-A.1 passed causal fail-first and coordinator review at `542/542`, hashes `6D16A261...FA7484` /
`8431C305...AE3BC`. Source-edit 7B-C.1 now has a causal fail-first: with production frozen at `6BE0A7F5...67CF2C`, all
five real layout-issued altered models reached the exact canonical workspace/source, issued 12 editable entries, and
mutated Lua. The bounded correction is candidate `C90FFC54...BD2D9` / `50FA05F0...86F65` at `34/34`; discovery and apply
both require that the exact program/evidence pair was issued for the canonical complete normalized call model. Coordinator
reran all 17 focused owners, typecheck, exact six-file lint, hygiene, caller census, and all 16 frozen hashes green. Fresh
zero-write hostile auditor `01a001ea-351c-77e3-915b-d98817ab9b60` returned `FINDINGS` only against an overbroad
coordinator-supplied profile-cross oracle. Follow-up proved both profiles were exact producer-issued projections of the
same complete model/source hash/target and exposed identical 12 literal ranges; the edit was byte-local and provenance-
safe. The four-argument source-edit boundary receives no current-profile authority, so profile freshness belongs to the
already-specified Batch 7D session/UI seam. Candidate hashes remain frozen under review while a fresh audit reruns the
corrected 7B contract. Corrected auditor `01a0020e-14cb-70e2-ac63-fada7020cd17` returned `CLEAN`; Batch 7B/7C is
accepted and Batch 7D is authorized.
Accepted Batch 7A and the Batch 7B/7C specifications are synchronized and read back at GitHub #41 comment
`5290634571`, Notion comment `3bc4618e-d15b-81bc-ab21-001dbed9fc9d`, and Drive revision
`AIroW37ORCYwemt1rD9CUx6i4hRFVi8xiwgXyDTuCQFbjRqS2GRL7LMDiZm6cLHWkcMQs49z4dgq8F3nYueoxh_fvIKi7IgNqdlKCKEKLUDZ`.
The current round-two rejection/correction is separately synchronized and read back at GitHub #41 comment
`5296548001`, Notion comment `3bc4618e-d15b-81dd-8296-001d2637385a`, and Drive revision
`AIroW34TLCQVbsXzcBWUvza_Jtwgih4nauJlb-3Zecc3ENWrRXXUQL96Mp51BqBE-NZbCGdn8t5EXZghOMO63JkRLljOnFGeu40QJouA98ge`.
The corrected-scope 7B/7C acceptance and Batch 7D activation are synchronized and read back at GitHub #41 comment
`5298323330`, Notion comment `3bc4618e-d15b-81a1-ab3c-001dc866896e`, and guarded Drive revision
`AIroW37NNOR--wcHWt3qDTrSBXf9NTn4fGwTKOE0PWyrVBodAccprsIZzy9Ac3eM-v74jvXQo57bdy4J-IKa2Nq1s0Z1a2icRtxvhRWXdVFI`.

## Current Batch 7 checkpoint — 2026-08-14

- Batch 7A is `FOCUSED VERIFIED / CLEAN`; overall B119 remains `PARTIAL / Not verified in game` because no rendered
  browser, package/deploy, C++ acceptance, or in-game experience gate has run.
- Fresh audit `019ffee7-8866-79c1-8cd7-fe68f7ddbd04` made zero writes, matched all 13 hashes, and passed the complete
  focused/type/lint/diff/boundary and hostile-probe matrix. Its three failed probe attempts were corrected harness
  assumptions, not product findings, and are documented as AAR triggers.
- Batch 7B round-two hashes `6B1624DA...B69663` / `D08E9462...E2D9E` are rejected. Audit
  `01a00130-274a-7141-bf81-21d77e71c81b` found coherent-clone authorization, partial-program acceptance, order-insensitive
  ledger matching, nested request-shape acceptance, and observable nested accessor/proxy traversal.
- The active correction first adds private exact issuance predicates to the existing layout-program and
  workspace-source producers, then makes source editing require both issued pairs, exact `projected` status, exact
  ledger order, and an issued-catalog/primitive apply seam. No production source-edit caller exists yet, so Batch 7D
  remains the first planned UI consumer of the corrected API.
- Both producer predicates and source-edit 7B-C.1 have causal fail-first receipts and complete coordinator-focused green.
  The first audit's sole profile-cross result is reconciled as a 7D session-freshness requirement, not a 7B source-
  provenance defect. Corrected-scope audit `01a0020e-14cb-70e2-ac63-fada7020cd17` is `CLEAN`; all 16 frozen hashes
  matched and Batch 7D is unblocked.
- Batch 7C corrected candidate: mandatory session-issued sample-catalog authority at public reconcile/update seams,
  complete profile/program/selection binding, hashes `3B76B896...E0F9F`, `01841353...E9755`,
  `C34E96B3...120C98`, `1E1769AB...14143B`; UIBuilder remains `E2E47C43...72FA69`.
- Coordinator rerun: 17/17 focused suites, typecheck, exact six-file ESLint, diff/whitespace/unsafe-cast scans, and all
  14 hashes passed. Auditor `01a000b5-dad3-7a22-ba50-12aaa5093c17` preserved those hashes and returned `FINDINGS`.
- Sample authority is green at `52/52`, including omitted authority, foreign-session/rebind, catalog clones, malformed
  shapes, and full source/target/program/profile/selection drift.
- Source editing is accepted at the focused pure boundary. The permanent matrices cover coherent clones, partial status,
  ledger order, nested request shapes, proxies/accessors, malformed primitives/models, CAS, and reparse provenance.
- Batch 7D is the active unit: mount exact current-session source-safe number/string/boolean controls with parent CAS and
  drift clearing in only `X4UiSourceEditor.tsx`, its selftest, and `UIBuilder.tsx`. Its corrected pending/readback
  candidate was rejected for no-op pre-ack success; the exact three-file acknowledgement correction is active and must
  return a fresh zero-write hostile `CLEAN` before broad gates.

## Session-start brief

- Eyeball queue: no B119 rendered checkpoint is ready. Do not ask Ken to inspect the Studio UI yet.
- Commit question: no overall B119 close or commit exists. Do not commit before the declared broad, visual, and game
  gates or an explicit bounded checkpoint decision.
- Machine state last observed after the outage: Antigravity running; X4 absent; ports 3000/3001/3100/3101 not listening.
- Before precommit/oracle/E2E/build/installed UI or X4 validation, ask exactly: “Are you in Antigravity, is X4 running,
  and is the machine quiet?”

## One-line state

B119 has accepted linter, source/corpus, call-model, Helper layout-kernel, font/text, and keep-out owners. The rejected
`117/117` Scene 8B audit reopened the producer/scene contract. Producer 8A.1 added complete authority-v2 snapshots and
exact Helper negative width, but a targeted audit rejected its incomplete schema boundary. Producer 8A.2 now has a
locally green `172/172` closed-schema correction at exact candidate hashes, with the original 50 escapes installed as
permanent regressions. The first scene integration baseline is red at `104/119`: 13 valid producer cases are falsely
refused because real call-semantics members such as `fontsize` and edit-box data are absent from the closed schema, while
the two unfinished scene scaling/negative-width cases remain red too. Independent re-audit returned `FINDINGS`: other
real producer identities/nil literals also falsely refuse, while malformed kernel/metadata/enum/transition shapes still
validate. Producer 8A.3 installed its permanent matrix and reproduced 16 intended failures at `179/195`, exit `1`,
before production repair. Its candidate reached `205/205`; focused dependencies/type/lint passed and scene integration
reached `117/119` with no producer-schema false refusal. Independent audit still rejected it: 17 coordinated malformed
value, kernel-state, refusal-continuity, and property-source shapes remained pair-valid out of 157 successful malformed
probes. Producer 8A.4 is assigned. Scene 8B.1 remains frozen until the corrected producer returns `CLEAN`.
Producer 8A.4 reached `225/225`, but its independent audit rejected the hashes: all prior 17 defects remained closed,
while 38 of 154 successfully executed malformed cases returned pair-valid across successful-profile, kernel-state,
value-signature, and nested identity/source correlations. Producer 8A.5 is assigned with fail-first regressions for all
38 and mandatory emitted-positive guards. Its fail-first is exact at `228/266`: all prior 225 checks plus three new
positives are green, exactly 38 assertions are red, zero throws, and production remains unchanged. Repair is active;
the first repair reached `267/267`, but coordinator review found unbound profile authority, the wrong direct-literal
fixture/boundary, and static-only expanded source identity. Those hashes are unaccepted and correction is active; scene
work remains frozen. The review fail-first is exact at `269/281` with 12 intended reds and all other 269 checks green.
The review-corrected candidate is `281/281`, focused dependencies/type/lint/diff pass, and the frozen scene remains
`117/119`. Its active independent four-hash audit reproduced `11/15` pair-valid local-identity authority escapes,
including order, cardinality, containment, unconsumed-text, and extra-invocation mutations; the original 38 and the 13
coordinator-review mutations now refuse with zero throws. Four coordinated kernel/table snapshot drifts also remain
pair-valid while the profile stays unchanged (`uiScale`, `scrollbarWidth`, and both kernel/table `frameWidth`). The
candidate hashes are rejected. Final audit census is `193` successful malformed probes, `178` refused, `15` pair-valid,
and zero throws. Producer 8A.6
must install all 19 named attack regressions before production repair, reproduce exactly the 15 current escapes, then
add a detached exact program-side local-identity ledger and profile-to-kernel/table fact reconciliation. A fresh
independent four-hash `CLEAN` audit remains mandatory before Scene 8B.1 resumes.
That 8A.6 repair reached `313/313` but is now independently rejected. The final fresh census is `55 / 5 / 50 / 0`, plus
five separately confirmed sibling reassignments for combined independent `60 / 5 / 55 / 0`; positives are `8/8`.
Producer-only 8A.7 is specified tests-first for exact per-kind owner shape, ordered row/cell topology and source identity,
shared profile ingress/pair validation, and lexical non-overlapping parameter ranges. Its first selftest-only checkpoint
changed `AD74133867DC07D82AFF94C982AB2E8AC524CE7DE363EFD18769792F010A51E5` to
`33C672EA494FC4633B4B9B1A187509FED873FEE33A46DA85232F08A9D0F12EF7` and executed `315/407`, exit `1`, with
historical `313/313`, two controls green, 92 red checks, 94 unique 8A.7 names, and zero throws. It is rejected: the
`creator receiver drift` proof had `fixtureReady=false` because before and after were the same `row[1]` identity. Einstein
owns the tests-only correction; production and Scene remain frozen until the same census returns with all 92 fixtures
ready and forbidden hashes unchanged.
The correction is now coordinator-accepted at selftest
`F53D5F58F88914DBDEC48344EE35BAE44173E04751D5FE600083421C951724A5`: exact `315/407`, historical `313/313`,
92 genuine fail-first reds, two controls green, 94 unique names, zero unready fixtures, and zero throws. The corrected
proof is distinct `row[1]` -> `row[3]`, with explicit before/after inequality and after/target equality. Typecheck,
targeted lint, and hygiene checks pass; production remains `766F24C11EF572DF603EFB31F3091A327B4B95AFA7505EED1A365D1A5837032E`
and Scene remains `73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246` /
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`. Next: Einstein Phase 2 production-only
repair, then full focused matrix and fresh independent four-hash audit. Scene remains frozen.
Accepted Phase 1 is synchronized and read back at GitHub #41 comment `5268427188`, Notion comment
`3ba4618e-d15b-8116-bf66-001d5f5117fc`, and Drive revision
`AIroW34XFHNcEwyJVzil1Wxd8Vf7W5-_fCzQ19bDoPXWigBexEBkjx_PYbTDONLShXlpAhhOfcfJHXleJuPLFBDUihbT-4bJgxAZUxQKaxEt`.
Phase 2 candidate is focused-green but unaccepted at production
`685E714F16F1B1962562860DCAD5512404B659700339B3F20B36DFF247E822BE`; selftest remains `F53D5F58...`, Scene hashes
remain exact, producer is `407/407`, dependencies/type/lint pass, and frozen Scene is exact `117/119` with its two named
geometry failures. Chandrasekhar owns the final read-only four-hash audit. Explicit residual probes: applied row/cell
parent/index removal and drift, plus static confirmation that duplicated `normalizeProfile`/`schemaProfile` pin logic
does or does not violate the shared-predicate contract. No external candidate sync and no Scene resume before `CLEAN`.
The audit returned `FINDINGS` with hashes unchanged and no writes: intended states `12/12`; copied-state census
`137 / 100 / 37 / 0`. Residuals are 31 non-applied/mixed-owner cases, six materialized row/cell ancestry or bounds cases,
and four extra-key profile-pin inputs that mint self-invalid success wrappers. The `685E...` candidate is rejected.
Next: tests-only exact `407/448`, with 41 new reds, all 407 historical checks green, zero no-op fixtures/exceptions,
production unchanged, and Scene frozen. The first review wording hit a false-positive content filter; neutral local
data-consistency wording completed without reducing scope.
Rejection and tests-only dispatch are synchronized/read back at GitHub #41 comment `5269030352`, Notion comment
`3ba4618e-d15b-815c-b8e7-001d757fa725`, and Drive revision
`AIroW35jdTuJjaxLzjqOdDXvhXSMYuvVV7mMBo6klwiklgOcvTdLi67Kw5sGJEERX7RMEE4Go9wHyLu-cbHfE9B1H0zpXV7anMtjHXjET0_u`.
Phase 3A first selftest hash `A2125E0963FDEFFFD74BA3496CC9E1F230DC5BAA4D9E02A59E0D47B1E12FFEAA` reached
aggregate `407/448` but is rejected. Its four profile cases make `fixtureReady` require a non-refused invalid pair while
the assertion also requires refusal, so the tests cannot pass after the intended fix. Einstein owns the tests-only
truth-table correction. Production `685E...` and both Scene hashes remain frozen; do not repair production yet.
The corrected Phase 3A oracle is coordinator-accepted at selftest
`6287289F02F80DA9E21A6020AFC8ACDA0ED0F1ADE189F3575E6FFE5CC47A99A1`: exact `407/448`, all prior 407 green,
41 causal reds in family counts `20 / 4 / 3 / 4 / 6 / 4`, 41 unique names, zero unready fixtures, and zero throws. All
37 pair cases remain accepted by the rejected candidate; all four profile cases prove current partial/self-invalid
output and a future-passable refused/no-pair branch. Next: Phase 3B production-only repair, then full focused matrix and
fresh independent four-hash audit. Tests and Scene remain frozen.
Accepted Phase 3A is synchronized/read back at GitHub #41 comment `5269285042`, Notion comment
`3ba4618e-d15b-8101-9c76-001d367906f3`, and Drive revision
`AIroW34F5AdCFhxM0kWLqxHZ5m5o9DfaGk04SHMMpW50RdhTF0oC34oQPwkTjwVk6OuE5_FIXgfL9VWOZB0ZnKWHRCFvLPQDwIAyWpMYinBR`.

Phase 3B production-only candidate is focused-green at
`DDE9CCA8A8B945710D61103F93E4134EEFA79A246F1830679859A11ED0ACFAD4`. Frozen producer selftest and Scene hashes remain
`6287289F02F80DA9E21A6020AFC8ACDA0ED0F1ADE189F3575E6FFE5CC47A99A1`,
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`, and
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`. Worker and coordinator independently reproduce
producer `448/448`, all dependency baselines, typecheck/lint, and frozen Scene `117/119` with only the two known 8B.1
geometry failures. That focused-green result was not acceptance; the completed Phase 3C audit rejected the candidate on
the late cross-field relationships below. No Scene resume before an independently clean producer repair; overall remains
`PARTIAL / Not verified in game`.
Phase 3C final status is `FINDINGS`; production `DDE9CCA8...` is rejected. Exact audit: intended `12/12` accepted, prior
inconsistent census `137/137` declined, and late matrix `64` total with `2` intended-valid accepted, `47` inconsistent
declined, `15` inconsistent still accepted, zero exceptions. Residual families are local-invocation occurrence binding
`1`, row `groupIndex` binding `3`, table `numColumns`/kernel-column parity `2`, and conditional/unreachable owner shape
`9`. All four hashes stayed unchanged; reviewer writes were none. The first reviewer turn's false-positive content-filter
failure is an AAR trigger. Next exact unit is Phase 3D test-only installation of the `15` causal regressions, expecting
`448/463`; freeze production and both Scene files. Do not resume Scene or promote the candidate before accepted fail-first
tests and a subsequent independently clean production repair.
Phase 3C rejection/Phase 3D projection is synchronized and read back at GitHub #41 comment `5270062709`, Notion comment
`3ba4618e-d15b-81d1-90e4-001d4f445131`, and Drive revision
`AIroW36LL_hXQuwKnmg3sXth4_PhKT_GJBka7qzzvL-i1o0cQSI5za4ZHs-Cy9Y5fQzA2WSiYt_3KCKmsdfxZA5k0EhrubQpSbmXUFt5-dP1`.
Phase 3D test oracle is independently `CLEAN` and accepted at selftest
`C00658FDD98E8ADE5B69A0984B257AA863F524600968A13E5035E5B6A955232A`: exact `448/463`, all historical `448`
green, 15 unique causal reds in `1 / 3 / 2 / 9`, zero unready fixtures/exceptions, typecheck/lint/hygiene clean. Production
stays `DDE9CCA8...`; Scene hashes remain frozen. The worker's initial 15-red run was rejected before acceptance because
two fixture proofs were weak; the accepted hash uses exact invocation triples and a dedicated emitted blocked-owner
fixture. Next exact unit is Phase 3E production-only to reach `463/463`, followed by a fresh independent matrix. Do not
edit tests or resume Scene.
Phase 3E candidate production hash is `D6A5EB24750DA3CE4E6D351E925D19FC1A98936B59EBE5715FE4B24DE212EDC8` from native
Luna worker `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission `019ff714-2d63-7340-9377-79fef2d325be`; sole write was
`src/lib/x4UiLayoutProgram.ts`. Coordinator independently reproduced exact `463/463` (`448/448` historical plus
`15/15` Phase 3D), zero unready fixtures/exceptions, all focused dependency baselines, typecheck/lint, exact frozen hashes,
and unchanged Scene `117/119`. Do not accept or resume Scene yet. Phase 3F was run under reviewer
`019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission `019ff725-b713-73a1-b5b8-aa8c09f6c858`; its final findings are
below. The initial over-broad local predicate and coordinator evidence-script corrections are recorded as AAR triggers in
the durable plan.
Phase 3F is now final `FINDINGS`, so do not accept `D6A5EB...` or resume Scene. The prior gates are sound (`12/12`
intended positives, `137/137` prior attacks declined, late `2` valid accepted plus `62` inconsistent declined), but fresh
audit reproduced `40/96` blocked-owner mutations accepted across `setColSpan`, `createButton`, `setText`, `setText2`, and
`createEditBox`, and `9/10` direct local-invocation substitutions accepted outside `createText`. All four hashes stayed
exact and reviewer wrote nothing. Next exact unit is Phase 3G test-only: freeze production/Scene, add all `49` causal
regressions to `src/lib/x4UiLayoutProgram.selftest.ts`, and independently accept exact `463/512` with only new families
`40 / 9` red before Phase 3H production work.
Phase 3G worker `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission `019ff73e-a8ba-7943-8aca-bf29ee1eb28e`, produced
selftest-only candidate `16CD456BDCB133EF5CFF9E834FF5F21D472F163BC087D71A9B855FA768724DD5`. Coordinator reproduced exact
`463/512`: historical `463/463` green, all `49` new states red, unique `40 / 9` coverage, zero unready fixtures/exceptions,
dependencies and frozen hashes exact. Independent reviewer `019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission
`019ff74a-f23b-70c3-8581-51ab8b76054f`, returned `CLEAN` with byte-level reconstruction of prior `C006...`, complete
causal coverage, no historical change, and no writes. Phase 3G hash `16CD456...` is accepted and immutable. Phase 3H is
now production-only to reach `512/512`; preserve selftest/Scene hashes and require a fresh independent all-kind matrix
before acceptance. Do not resume Scene yet.
Accepted Phase 3G is synchronized/read back at GitHub #41 comment `5271329467`, Notion comment
`3ba4618e-d15b-81e2-b13b-001d8163a9fd`, and Drive revision
`AIroW35YQmaJ04Y0YO1NnJk6IzJyA3qKkqhAW7zJWFPnetHku09OFRJITjUcILAUAHsDv5VjZqYDEjcw846y4AHZTUIIYG-tpYBFwpo2l83p`.
Phase 3H is active under native Luna worker `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff753-f2c7-7c72-b70f-46f01a32255e`, with only `src/lib/x4UiLayoutProgram.ts` writable. Freeze selftest/Scene and
require exact `512/512`, focused gates, and a new independent all-kind copied-state audit before acceptance.
Phase 3H candidate production hash is `B98D1BA4FE864892932656ED856453BC4E20642AA08C4DC4C2D7A211893FAB4C`. Coordinator reproduced exact
`512/512`, all focused gates, immutable selftest/Scene hashes, and Scene `117/119`. Owner validation now derives exact
emitted node/ancestry evidence; local occurrence uses per-operation sample and expansion context with evidence-role
exclusions. Independent Phase 3I is active under `019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission
`019ff76b-e18d-73a2-8ec6-4b7313eace7c`, to rerun all prior matrices and attack those exemptions. Do not accept candidate
or resume Scene until `CLEAN`.
Phase 3I was interrupted once by an automated classifier while describing local structural probes; no writes occurred.
The same reviewer resumed under submission `019ff77c-d3f2-7961-9c2a-3ae2be3505cd` and returned `FINDINGS`. Prior evidence
still reproduces exactly (`512/512`, intended `12/12`, historical `137/137`, late `2 + 62`, owner `96/96`, direct local
`10/10`), but fresh pair-valid probes accepted five coherent sibling-owner substitutions, three non-descendant expansion
substitutions, and one same-operation sampled-source substitution. Passing Phase 3G checks also drop the detail used by
their summary, producing 49 unready/unknown entries on green. All hashes stayed exact and reviewer writes were none.
Reject `B98D1BA4...FAB4C`; do not resume Scene. Next exact unit is Phase 3J test-only under
`src/lib/x4UiLayoutProgram.selftest.ts`: retain passing detail and add eleven checks for exact `514/523`, with nine causal
reds (`5 / 4`) and two green controls. Freeze production and Scene, then require an independent oracle audit before any
Phase 3K production edit.
Phase 3I rejection/Phase 3J contract is synchronized/read back at GitHub #41 comment `5272077132`, Notion comment
`3ba4618e-d15b-8146-a341-001d31063ca1`, and Drive revision
`AIroW36RAplrt75Vyj9vXey-Hi89PlXVotAYcg8Xpu7v-XwC0B8_GNZ_PBleOtDBmm2oeJ4kSYAWNXIKoWthv58d4HKdxhQ3z-Wq_RebH2bM`.
Phase 3J is active under producer `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff78a-09b1-7012-bba8-2e3b664e822f`; only `src/lib/x4UiLayoutProgram.selftest.ts` is writable. Exact target is
`514/523`, nine causal reds in `5 / 4`, two green controls, truthful Phase 3G passing detail, and immutable production/Scene.
Do not accept worker completion or start Phase 3K before coordinator reproduction and independent oracle audit.
First Phase 3J candidate selftest `DEAEB64D...C6A884` reproduced top-level `514/523` and focused gates but was rejected
before independent audit: the sampled check ran `getB -> getA`, Phase 3J historicalGreen printed `463`, and familyCounts
printed total cases `6 / 5` instead of red families `5 / 4`. Targeted test-only correction is active under submission
`019ff7a3-8c8a-7881-ba45-371e1c556434`. Production/Scene remain frozen. A temporary worker typecheck failure and two
coordinator check-field parser mistakes are AAR triggers, not evidence.
Corrected Phase 3J selftest candidate is `51BE901FE7CF8F8985879245AC10799ED305CEE6B297764224439368175D03F2`.
Coordinator reproduced exact `514/523`, historical `512/512`, nine reds, two controls, truthful Phase 3G `40 / 9`,
Phase 3J failed `5 / 4` plus all-case `6 / 5`, exact sampled `getA -> getB`, focused gates, and frozen production/Scene.
Independent read-only audit is active under reviewer `019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission
`019ff7a9-3cac-79f3-ae50-7e214787a2f1`. Do not accept Phase 3J or start Phase 3K until `CLEAN`.
Phase 3J audit returned `FINDINGS`, no writes, hashes exact, and exact in-memory reconstruction of prior accepted
`16CD456...`. Reject selftest `51BE901F...D03F2`: addTable control uses tableB as receiver instead of frameB, and
`sampleWidth` is consumed by another addTable rather than the mutated createText. Next remains Phase 3J test-only:
correct those two causal relationships without changing the eleven names, `514/523`, nine reds/two controls, failed
`5 / 4`, all-case `6 / 5`, historical `512/512`, production, or Scene. Require a second independent audit before Phase 3K.
Phase 3J rejection/correction contract is synchronized/read back at GitHub #41 comment `5272537693`, Notion comment
`3ba4618e-d15b-8107-be3e-001df5bd1c62`, and Drive revision
`AIroW36vk_BGi_rN9DhU-OaarSq5q_F8L7Nbfy1z1HQR3FJTaLW9QAdow9Ncfg61BJbZaBSiIPzRdGpZsvw5ValoAUVotsIUoa_GpZ2_5j5N`.
Phase 3J two-fixture correction is active under producer `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff7b4-9206-7c12-bcdb-d1881da20ed4`; only the selftest is writable. Require exact frameB/tableB addTable identities,
sample-to-createText consumer proof, unchanged `514/523`/summaries/names, prior reconstruction, frozen production/Scene,
and a second independent audit before acceptance.
Corrected Phase 3J selftest candidate is `66A61597AC4342FC84A165DEFA20583A7FBE612040AAF7CCE6DDAF74AA66BD96`.
Coordinator reproduced exact counts and proof fields: addTable frameB receiver/tableB result with uniqueness decline;
sampleWidth exact consumed createText fontsize consumer; sampled/unsampled baselines valid; getA-to-getB remains accepted.
Second read-only audit is active under reviewer submission `019ff7c6-7527-7130-aea5-3d2cd3768a9d`. A first message attempt
failed locally from unescaped backticks and delivered nothing. Do not accept Phase 3J or start Phase 3K before `CLEAN`.
Second audit returned `CLEAN`, exact hashes, no writes. Accept and freeze Phase 3J selftest `66A61597...66BD96`: exact
`514/523`, exact prior-hash reconstruction, all eleven causal fixtures, focused gates exact. Phase 3K is production-only:
modify only `src/lib/x4UiLayoutProgram.ts` to add detached source-call receiver/result/semantics/local-result occurrence
bindings, reach `523/523`, preserve frozen tests/Scene and Scene `117/119`, then require a fresh Phase 3L all-kind audit.
Do not resume Scene before Phase 3K independently passes.
Accepted Phase 3J/Phase 3K contract is synchronized/read back at GitHub #41 comment `5272904725`, Notion comment
`3ba4618e-d15b-8174-8241-001dc87622d4`, and Drive revision
`AIroW34Zemne4Qpfb5mAO8GvYNUx_NIRRqe2k_YOmFYByP-anMYCL3We9OQlQB05IPbCr6b-tADYb8jHWzB30nMbO2fh5INoRV_v2VgUTQxZ`.
Phase 3K is active under producer `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff7d8-2392-76c0-806d-88050f2306a3`; only `src/lib/x4UiLayoutProgram.ts` is writable. Require exact `523/523`, immutable
selftest/Scene, and fresh Phase 3L all-kind `CLEAN` audit before accepting production or resuming Scene.
Producer candidate is `D14F4D8929FD237074AA63E379B9AA7DA3A93D96D1CF9637D5E02CBE21668DFB`. Coordinator independently reproduced
`523/523`, Phase 3G `49/49`, Phase 3J `11/11`, all focused dependencies/typecheck/lint, and exact frozen Scene `117/119`;
selftest/Scene hashes remain unchanged. Schema v3 adds ordered detached source-call metadata bindings before legacy
authorization. Do not accept yet: Phase 3L read-only matrix/binding audit is active under submission
`019ff7e4-8ced-7a21-861a-d3f30a00efa9`. Do not resume Scene without `CLEAN`.
Phase 3L returned `CLEAN`, exact hashes, no writes: `12/12` positives, `137/137` historical declines, late `2 + 62`,
owner `96/96`, local occurrence `10/10`, and `101/101` fresh binding declines with zero exceptions. Accept/freeze
production `D14F4D8929FD237074AA63E379B9AA7DA3A93D96D1CF9637D5E02CBE21668DFB`. Next: resume Scene worker
`019fef89-02a6-7561-81be-e90a987cbd27` on only the exact `117/119` scaled-height and Helper-negative omitted-width
failures; freeze producer/selftest and require fresh Scene acceptance before Batch 6A close.
Scene resumed under submission `019ff803-fef3-7a01-99d0-6b3af879b16c`; only `x4UiScene.ts` and its selftest are writable.
Accepted Phase 3K/active Scene checkpoint is read back at GitHub `5273323633`, Notion
`3ba4618e-d15b-8124-8d8d-001d8b7f1f74`, and Drive revision
`AIroW36YVnFWA00-5H6iCYWHVUShS2sQSqwUaeUbfxqWeeJ_Eaz607CFBmuBsMJZangEKNpQvX7m7YEEAO5pIuyZaJiKDxxAK81zKKLr2id2`.
Scene reached candidate `119/119`: source `B4A05BC87BDE5D497199A4D7649A59D3F3B489C291DCCCC5F63167479EAB7842`,
selftest `26C12C36B51EFE2A7D2D0CA7308390A4CCEBA2857636E4FC717389F5D1A8F0D0`. Coordinator and reviewer reproduced
all focused gates and exact four-kind scaled-height/negative-width behavior. Do not accept it: fresh audit returned one P3
oracle finding. Existing 8B.1 assertions do not permanently pin finalized-height provenance or each exact `-10`,
`source-pinned-default`, Helper `5372-5388` Scene evidence link. Production has no reproduced geometry defect; exact
in-memory reversal proves its delta from `73D97D2E...C246` is only ignored diagnostic serialization removal plus brace
formatting. Next: selftest-only correction, exact `119/119`, unchanged production/producer hashes, then another fresh
read-only `CLEAN` audit. B119 remains `PARTIAL / Not verified in game`.
Scene 8B.2 selftest-only correction is active under submission `019ff827-c0b9-7850-86b7-916119e0ce7e`. Freeze Scene
production and both producer files; require exact `119/119`, all focused gates, non-no-op provenance controls, then a
fresh no-write acceptance audit before Batch 6A can close.
Scene 8B.2 is now accepted. Exact hashes: Scene production
`B4A05BC87BDE5D497199A4D7649A59D3F3B489C291DCCCC5F63167479EAB7842`; Scene selftest
`934B6E68557E357F7F62BC4097184EFDAC1FEABA3E63CCDF62BB9CB94B9CA63A`; producer
`D14F4D8929FD237074AA63E379B9AA7DA3A93D96D1CF9637D5E02CBE21668DFB`; producer selftest
`66A61597AC4342FC84A165DEFA20583A7FBE612040AAF7CCE6DDAF74AA66BD96`. Coordinator reproduced Scene
`119/119`, producer `523/523`, typecheck, and owned ESLint. Fresh reviewer submission
`019ff832-2fb5-7c43-ba84-0d12dd2df1cd` returned `CLEAN`, zero writes, and all seven acceptance rows green, including
four exact finalized-height links, four exact Helper `-10` links, and twelve non-no-op refusal controls. Batch 6A is
focused-accepted. Next: Batch 6B only, adding pure `x4UiPreviewPipeline.ts/.selftest.ts` under the documented contract.
Do not begin React/Canvas/browser/game integration. Overall B119 remains `PARTIAL / Not verified in game`.
Accepted Batch 6A is synchronized and read back at GitHub #41 comment `5273815148`, Notion comment
`3ba4618e-d15b-81d7-8e7d-001d66b9e6ec`, and Drive revision
`AIroW34aKGsxvrEt4y5KsHUG4ZVUULaB6QZMlbkiTKeNr7bch85Vi9QItPQ4hQS2go2C2m-jQfThShrba37lFOsI48aznWnC4etNy87kB2ui`.
Batch 6B is active under producer-context Luna submission `019ff83b-94b8-71a0-ad8e-e0758f989f48`. Writable scope is
only the two absent-at-dispatch files `src/lib/x4UiPreviewPipeline.ts` and `src/lib/x4UiPreviewPipeline.selftest.ts`.
Freeze every accepted owner and require fail-first, complete focused matrix, exact hashes, coordinator reproduction, and
fresh read-only acceptance. React/Canvas/browser/game work remains forbidden in this unit.
Notion task properties were refreshed and read back as In Progress/Partial with Batch 6A accepted and Batch 6B active.
Batch 6B fail-first is exact `ERR_MODULE_NOT_FOUND`, exit `1`, before production existed. Both owned files now exist; the
worker is correcting only local first-draft typing and expanding the actual acceptance matrix.
First candidate exact hashes are pipeline `A9182F898C3AE32BD502BAA4F6B87CC948BD1176C7A11899277EC3F31A9CF020` and
selftest `9402B866DF9ABE2F352D22EFB3F06E700F83FE9E8EA8953A50F391D06231FE2F`; all frozen Batch 6A hashes remained
exact. Worker and coordinator reproduced pipeline `35/35`, Scene `119/119`, producer `523/523`, all remaining focused
owners, typecheck, and owned ESLint. Fresh no-write audit `019ff863-39af-7fd3-a62d-bbaf97c2d13c` returned `FINDINGS`:
`unverified-default` minTextHeight was relabelled `captured`; malformed input fabricated `{}` as required widget evidence;
and canonical Scene success, independent partial Scene, successful preview-path, exact blocking-error durability, and
direct-versus-normalized call-model equivalence lacked permanent proof. The call-model normalization itself was
independently byte-equivalent in static and dynamic-partial probes and is not a reproduced production defect.
Correction submission `019ff871-ab55-7c70-94cf-06abfc8971ef` is active under the same Luna worker and the same two-file
boundary. Next safe action is wait for its fail-first/final matrix, reproduce exact hashes and all focused gates, then send
the fixed pair to a fresh no-write reviewer. Do not accept Batch 6B or begin React/Canvas/browser/game work without
`CLEAN`. Overall B119 remains `PARTIAL / Not verified in game`.
Correction fail-first was exact pipeline `40/50`, exit `1`, with production still at `A9182F...`; corrected result is
pipeline `50/50`, exit `0`, at production `7E1ABF68D33E3DF2C3304A0FD22766CB292D9E6A49386B670223BEF5F191D97D`
and selftest `C578C93B5C36E136C8CCEC23CA699DCAE19232B33A47D33BE910D74B13065016`. Worker and coordinator reproduced Scene
`119/119`, producer `523/523`, call `46/46`, kernel `29/29`, corpus `28/28`, font `10/10`, text `8/8`, source/workspace
`PASS`, keep-outs `16/16`, linter `112/112`, typecheck, owned ESLint, and hygiene with every frozen hash exact. Fresh
read-only re-audit `019ff890-ff54-70d2-b4e5-f7d7e44e3c7e` is active. It must explicitly judge the canonical projected-
program/partial-Scene case and whether detached-model equivalence is a causal no-rebuild oracle. Next action: wait for
that review; only `CLEAN` permits Batch 6B acceptance and external checkpoint synchronization.
Re-audit returned `FINDINGS`, no writes, all hashes unchanged. Canonical behavior is valid: projected producer, zero
producer gaps, conservative partial Scene with nonempty `1/1/1/4` geometry and three widgets; make identity/pin/geometry
facts causal assertions. The raw-equivalence assumption was wrong: workspace models retain optional `undefined` members
outside the producer JSON domain, so raw direct projection is an expected refusal. Reconciled acceptance now requires an
exact no-rebuild normalization proof: only undefined object members may disappear; all defined JSON bytes, source
identity, call ordering/ranges/metadata, and caller input remain exact; direct normalized output equals pipeline; raw
refusal remains explicit; no scanner/parser/model builder is invoked. Next action is one same-two-file correction, focused
rerun, coordinator reproduction, then another fresh no-write audit. Overall B119 remains `PARTIAL / Not verified in game`.
Final selftest-only correction is candidate-green at
`DDFAD0F2929B617353B22494A8C2540D4A495A34036F52E2EAC7C0B423A9F538`, with production frozen at
`7E1ABF68D33E3DF2C3304A0FD22766CB292D9E6A49386B670223BEF5F191D97D`. Coordinator reproduced pipeline `57/57`,
all focused owners, typecheck, owned ESLint, no-builder/import scan, and hygiene. Canonical acceptance has three causal
mutation controls; normalization has four and explicitly preserves raw refusal. Final no-write audit
`019ff8ae-8ecf-78a0-aa1f-17c6d3025c5e` is active. Next action: wait; on `CLEAN`, document focused acceptance and sync
GitHub #41, Notion, and Drive with readback. Otherwise correct only the exact reported gap. Do not start Batch 6C yet.
The final audit returned `CLEAN`, zero writes. It found both re-audit findings and all original Batch 6B acceptance rows
causally closed, with all six earlier findings still closed. Exact accepted hashes are pipeline
`7E1ABF68D33E3DF2C3304A0FD22766CB292D9E6A49386B670223BEF5F191D97D` and selftest
`DDFAD0F2929B617353B22494A8C2540D4A495A34036F52E2EAC7C0B423A9F538`; frozen Scene/producer hashes remain exact.
Coordinator reproduced pipeline `57/57`, Scene `119/119`, producer `523/523`, call `46/46`, kernel `29/29`, corpus
`28/28`, font `10/10`, text `8/8`, source/workspace `PASS`, keep-outs `16/16`, linter `112/112`, typecheck, owned
ESLint, no-builder/import scan, and hygiene. Batch 6B is focused-accepted. Next safe implementation unit is pure Batch 6C
`x4UiPaintPlan.ts/.selftest.ts`; React/Canvas/editor/deploy/game integration remains forbidden until its own contract and
gates. Overall B119 remains `PARTIAL / Not verified in game`.
Accepted Batch 6B is synchronized and read back at GitHub #41 comment `5274809846`, Notion comment
`3bb4618e-d15b-8137-b63f-001d412db698`, and Drive revision
`AIroW34Gt_rL0bVF3JcVCp9NV4gy4dJU-zQfsh850pwXMLwGDTFM-5ihI_pyNVSzBqwgC7riCNENd2fnRU6vAbFTF2b0VwQtB-Jboy9V0zP4`.
Batch 6C is active. Both owned files are absent at baseline; only `src/lib/x4UiPaintPlan.ts` and its selftest may be
created. Freeze pipeline, Scene, font, text, corpus, and keep-out owners at the exact hashes recorded in the plan. Require
pre-production fail-first, complete goldens/negative/boundary matrix, all focused gates, coordinator reproduction, exact
hash readback, and a fresh no-write `CLEAN` audit. Actual Canvas/React/browser/editor/deploy/game work remains out of scope.
Native Luna submission `019ff8c2-3a98-7af3-b6d3-ce97b5f22e18` owns Batch 6C. First wait for its absent-production
`ERR_MODULE_NOT_FOUND` fail-first and complete two-file result; then reproduce every declared gate and frozen hash before
dispatching a separate no-write reviewer.
The fail-first is complete: exact `npx.cmd tsx src/lib/x4UiPaintPlan.selftest.ts` exited `1` with
`ERR_MODULE_NOT_FOUND` while production remained absent and only the owned selftest existed. The worker is now grounding
the builder against accepted Scene/font/corpus/keep-out shapes before writing production.
Production and the substantive oracle now exist, but no candidate is green or accepted. Coordinator review corrected the
intentional projected-program/partial-Scene path and identified active fixes for accepted negative coordinates, exact
0.788 wheel versus 0.74 option-stack identity, source-derived bold/layout identity, clipping of every drawable command,
partial cell/widget coverage, and multi-frame deterministic ordering. Wait for the corrected two-file result; do not
accept from the current draft.
The corrected candidate is now focused-green and coordinator-reproduced: paint plan `31/31`, Scene `119/119`, font
`10/10`, text `8/8`, corpus `28/28`, keep-outs `16/16`, preview `57/57`, source/workspace `PASS`, typecheck, owned
ESLint, diff/boundary scans, and all frozen hashes. Exact owned hashes are production
`887294D0EF42D7A05504FABE62A82F78859485AD38015400FCB70E323E2F4FC9` and selftest
`BA634F665DDF7ABCE6C9E4FD83B69412E559FD8220013C374EFF9E945022D94D`. It remains unaccepted pending a fresh
independent no-write audit of the full contract and adversarial runtime boundary.
That audit, submission `019ff8f0-825a-7e91-adc5-3517603c1832`, returned `FINDINGS`, zero writes. It executed `78/78`
probes: `71` inconsistent inputs, `20` correctly refused, `51` incorrectly accepted, `7/7` intended-valid controls, and
zero checker throws. Both rejected candidate hashes and all frozen dependency hashes stayed exact. Reproduced failures
are non-reciprocal ancestry changing clips/frame assignment, incomplete text/layout/glyph continuity, mutable Scene
source and malformed/stale selection acceptance, invented or out-of-viewport keep-outs, mutable ordering evidence,
`4/13` gap diagnostics with widened/missing exact source, accepted nested false truth/paint fields, and a source-impossible
zero drawable. The existing `31/31` and focused gates remained green, so they are not acceptance evidence for this
boundary. Next safe action: resume Einstein on only the same two files, install every reproduced family red-first, repair
production, preserve the valid controls and frozen dependencies, reproduce the complete matrix/hashes, then dispatch a
new no-write audit. Do not begin editor integration. The review's Windows command-length/syntax setup failures supplied
no product evidence and must remain in the AAR. Overall B119 is still `PARTIAL / Not verified in game`.
Tests-first receipt: before production edits, the expanded paint selftest ran `34/85`, with exactly `51` intended failing
predicates, zero unready fixtures, and zero validator throws. Einstein is now repairing shared validation chokepoints only
in `src/lib/x4UiPaintPlan.ts`; preserve every red predicate and the two-file scope, then reproduce all focused gates and
send the resulting exact hashes to a new no-write audit.
First production pass is not a candidate: `14/85`. It refuses the 51 named malformed inputs but also legitimate
baseline/clip/keep-out positives because a Scene JSON/schema gate is too broad. Einstein is narrowing that gate to the
paint plan's exact consumed contract; do not count blanket refusal as closure.
The narrowed validator now runs `85/85`, all 51 malformed mutations refused, zero fixture/throw errors. Do not yet accept:
the interim report names only three valid controls while the contract requires the audit's `7/7`. Einstein has been told
to map all seven to permanent predicates and add/rerun any missing controls before final gates and hashes.
The discrepancy is closed. Stable candidate hashes are production
`D7C901D3A52F0489766E590A43417EC5039F2D1414C41DB57E9CAFF524A0BE3B` and selftest
`E2B1F6022C338DD94542CB1911A6B5FEB4D514F40B93429AA74DE169052F9556`. Paint is `85/85`: all `51/51`
reproduced malformed inputs refuse, three refusal controls and all seven named valid controls pass, zero unready fixtures,
zero exceptions. Coordinator reproduced Scene `119/119`, preview `57/57`, call `46/46`, kernel `29/29`, font `10/10`,
text `8/8`, corpus `28/28`, keep-outs `16/16`, source/workspace `PASS`, typecheck, owned ESLint, exact frozen hashes,
and clean scans. The combined coordinator lint/hash wrapper had a pre-execution PowerShell parse failure; corrected
smaller commands pass. Next safe action is a fresh no-write audit of these exact hashes, with coherent valid-SHA/source,
empty/source-only selection, gap-order, preview-record, and nested truth probes. Do not accept or start integration first.
Fresh no-write audit submission `019ff939-a3b2-75c2-82e8-74d2d1747d04` is active and its exact ten-file hash stop-gate
passed. Next action is wait for the full verdict; on findings, document and repair only the reproduced mechanism.
That audit returned `FINDINGS`, zero writes. It independently kept the original `51/51` refusals and `7/7` positives
green, then ran 41 extensions and found ten accepted mechanisms: forged valid SHA/coherent path attribution; layout
`x`, `y`, `lineBoxY`, `breakReason`, and line `sourceCodePointRange`; preview entry aliases; equal-offset gap reorder;
and no genuine distinct-frame-layer fixture. Gap own-source mismatches were correctly refused `11/11`. Exact hashes are
unchanged and rejected. Next unit is the documented sequential six-file correction: Scene line evidence first, private
preview source authority second, paint consumption/comparisons and real layer fixture last. Capture each phase red-first,
run all focused gates, reproduce hashes, then require another no-write audit. Do not start UI integration. Overall B119
remains `PARTIAL / Not verified in game`.
Native Luna correction submission `019ff950-deb9-75a2-9f83-b45640d828f4` is active. It must complete exact hash
stop-gate, then Scene S, preview authority P, and paint C tests-first in sequence across only the six documented files.
Phase S fail-first is captured at Scene `119/120`, exit `1`: exact line `sourceCodePointRange` preservation is the sole
red and its negative schema mutations pass. Einstein is applying only the direct Scene copy/schema repair now.
Phase S is green at Scene `120/120`. Einstein has entered Phase P tests-only; wait for the private issuance-authority red
before permitting preview production changes.
Phase P fail-first is valid at preview `63/66`, exit `1`: intact issuance, clip-only allowance, and partial-Scene allowance
are the three reds; all authority negatives pass. Einstein is now implementing the private issuance record/predicate.
Phase P is green at preview `66/66`. Phase C tests-only checkpoint is paint `87/94`, with exactly seven reds: clone and
stale authority, line code-point range, glyph `x/y/lineBoxY`, and coherent source rewrite. Missing authority and gap order
already refuse. Paint production remains unchanged pending the distinct-layer fixture red/green.
The distinct-layer fixture is now real and causal. Paint is `88/95`, exit `1`; prior `51/51` negatives, three refusal
controls, and `7/7` valid controls pass. Exactly seven authority/layout/source reds remain; Einstein is now permitted to
edit the paint production chokepoint.
Phase C is now focused-green at paint `95/95`; all seven new reds, prior `51/51`, three refusal controls, and `7/7`
valid controls pass. The fallback is removed and issued preview authority is mandatory. Coordinator reproduction passed
Scene `120/120`, preview `66/66`, paint `95/95`, producer `523/523`, call model `46/46`, kernel `29/29`, corpus `28/28`,
font `10/10`, text `8/8`, keep-outs `16/16`, linter `112/112`, source/workspace `PASS`, typecheck, six-file zero-warning
ESLint, exact frozen hashes, and boundary/diff/hygiene scans. Exact candidate hashes are Scene
`B11E4C64576B9D5DC4B53FED8C25D8783295863936896F9404C8926AFD888334`, Scene selftest
`C4CE51D6D2E8936820A9CBCC6094152670A7E2C1A2AFF55BB109700B26570F8E`, preview
`ABCB9AEF1C155B9CE572A9A57B3D2E9336125F81F5B9841F2C18FD9AEFAF1927`, preview selftest
`A829DE930284E45A968670056FFA7D9EE8F0EC514475A28C8FF8C11D2EA78412`, paint
`315E6E423CA6F04D8CA7FCAFB0AC96AD120B8A0A5DB8145B7C93EC66F717DB2E`, and paint selftest
`494D5F9041D8F89019254DCF3D0A1894BF2E55E661FCA08FFB045CFB71F45B06`. This is still unaccepted; next action is a fresh
independent no-write audit. Only `CLEAN` permits focused acceptance or editor integration. Overall B119 remains
`PARTIAL / Not verified in game`.
That audit submission `019ff975-8297-7e01-9609-c024be9e94b0` returned `FINDINGS`, with all 14 hashes and Git status exact
before/after and zero writes. Every focused suite stayed green. Fifteen independent probes reproduced six accepted,
paint-changing mutations: cell geometry, drawable/profile width, frame layer/order, reciprocal table/frame ownership,
coordinated glyph/layout `x`, and coordinated glyph/layout code point. A seventh table `zOrder=-10` mutation was accepted
without changing this fixture's output; it still violates the non-allowlisted authority contract and must refuse. Cloned
authority, source rewrite, preview alias,
gap reorder, and altered-profile cross-result controls correctly refuse. The missing boundary is complete issued-Scene
coverage, not result identity.
Next action: tests-first correction in only `src/lib/x4UiPreviewPipeline.ts`, its selftest, and
`src/lib/x4UiPaintPlan.selftest.ts`. Store/compare one normalized complete issued Scene, allowlisting only root projected-
to-partial status and exact node `clipRect` variations; bind every other geometry/topology/order/text/glyph/preview/gap/
truth field. Keep Scene and paint production plus all other accepted owners frozen. Capture new reds while prior controls
remain green, repair preview production only, rerun all focused gates/hashes/scans, then require another no-write `CLEAN`.
Do not start React/editor integration. Overall B119 remains `PARTIAL / Not verified in game`.
The third rejection/correction contract is synchronized/read back at GitHub #41 comment `5276263923`, Notion comment
`3bb4618e-d15b-81b7-a7e9-001db08a7aa0`, and Drive revision
`AIroW35QBDlqjglRZDowCYgKgl8BedpYyAKE_V8QaEkUa9ESYVKNVXKWHTPDKuujZsRCZWFmJu217bu_KaYVpl8rZVezLB-NYBCSx0bl6o2A`.
Phase T tests-only is complete and coordinator-reproduced on the authoritative host. Preview is exactly `66/74`, exit
`1`; paint is exactly `95/103`, exit `1`; all prior 161 checks are green, and exactly eight complete-issued-Scene
authority attacks are causal reds with zero unready fixtures/exceptions. Exact protected hashes are preview production
`ABCB9AEF1C155B9CE572A9A57B3D2E9336125F81F5B9841F2C18FD9AEFAF1927`, preview selftest
`FC64FB8782D59408A6E96BD56759686D1B93EB699221030199F8D25EA45037E7`, paint production
`315E6E423CA6F04D8CA7FCAFB0AC96AD120B8A0A5DB8145B7C93EC66F717DB2E`, paint selftest
`2D11721BECC0603DB5CDF12FDCB5AC937EE6CBF7E75B2D2A74F2E21DBA5593B9`, Scene production
`B11E4C64576B9D5DC4B53FED8C25D8783295863936896F9404C8926AFD888334`, and Scene selftest
`C4CE51D6D2E8936820A9CBCC6094152670A7E2C1A2AFF55BB109700B26570F8E`. Next action: resume Einstein for a
production-only repair in `src/lib/x4UiPreviewPipeline.ts`; every test file and every other production owner is frozen.
Require preview `74/74`, paint `103/103`, focused host gates/hashes, coordinator reproduction, and another fresh no-write
`CLEAN` audit. Do not start editor integration; B119 remains `PARTIAL / Not verified in game`.
The first strict-JSON production pass is rejected at preview `53/74`, paint fixture `1/3`, exact source hash
`44ECBA7FF5FB54FF227425448EFF636A839066805C7ECC668825C845F987134C`. It found that the accepted Scene includes
explicit optional `undefined`, first at `frames[0].provenanceLinks[0].operationId`; a blanket undefined refusal therefore
cannot issue real Scene authority. Its sentinel follow-up is also rejected at preview `72/74`, paint `97/103`, exact
source hash `3A8EF3E3DE8069598A9532C3FF43E9079F735564B4618038773CE43573B63F54`. All eight attacks refuse, but existing
JSON-clone/clip/conservative-partial positives prove optional object-valued undefined normalizes as absent. Final
production correction omits only those own object properties; undefined array slots and symbols/functions/bigints,
accessors, cycles, sparse/decorated arrays, non-finite numbers, and non-plain objects still refuse. No sentinel/log/output
change remains. After exact runtime green, freeze production and mechanically repair the frozen Phase T tests' eleven
readonly TypeScript errors and one unused-local lint warning without changing predicates/counts. All five frozen hashes
remain exact until that explicitly sequenced test-only phase.
The final production-only normalization candidate is now focused-runtime green and coordinator-reproduced: preview
`74/74`, paint `103/103`, Phase T `8/8`, zero unready fixtures/exceptions, and all valid controls green. Preview
production is frozen at SHA-256 `317DB32A492CDBB3727A9CC5B7FE5A6222A1814A62F1C83D402B957B01C7C12E`; the
protected preview-test, paint, paint-test, Scene, and Scene-test hashes remain exact. No sentinel, debug output, token,
or output-shape change remains. Native Luna submission `019ff9f1-a0cb-7fd0-b69b-51fb8f14de38` now owns only the two
Phase T selftests to clear the eleven readonly TypeScript diagnostics and one unused-local warning mechanically. Next:
reproduce exact `74/74` and `103/103`, typecheck, six-file zero-warning ESLint, hashes, boundary/hygiene scans, then
dispatch a fresh independent no-write audit. Only `CLEAN` authorizes editor integration. Overall B119 remains
`PARTIAL / Not verified in game`.
The test-only static cleanup is complete and coordinator-reproduced on the authoritative host: preview `74/74`, paint
`103/103`, Phase T `8/8`, malformed `51/51`, authority controls `3/3`, valid controls `7/7`, typecheck exit `0`, and
six-file zero-warning ESLint exit `0`. Exact hashes are preview production
`317DB32A492CDBB3727A9CC5B7FE5A6222A1814A62F1C83D402B957B01C7C12E`, preview selftest
`24E3C66979913A33F93421FBD1F7EAA5169B977083D08A36912681F73A717F87`, paint production
`315E6E423CA6F04D8CA7FCAFB0AC96AD120B8A0A5DB8145B7C93EC66F717DB2E`, paint selftest
`BCD2AB87D8F0BAD7CBBE32D9B86B4EC7A1129C3E330E12FBDC99611BA0CA8643`, Scene production
`B11E4C64576B9D5DC4B53FED8C25D8783295863936896F9404C8926AFD888334`, and Scene selftest
`C4CE51D6D2E8936820A9CBCC6094152670A7E2C1A2AFF55BB109700B26570F8E`. Fresh no-write Luna audit
`019ffa06-d1e9-70a0-8f60-1166714c20df` is active. Only `CLEAN` permits Batch 6C focused acceptance and the specified
Canvas-adapter Batch 6D; no React/editor integration is authorized yet.
That audit returned `FINDINGS`, zero writes, with exact six-hash and git-status parity. It independently reproduced
preview `74/74`, paint `103/103`, Phase T `8/8`, malformed `51/51`, authority `3/3`, valid `7/7`, typecheck, and six-file
zero-warning ESLint, then found a P2 prototype-boundary escape: issuance snapshots only own properties, but paint reads
inherited optional `rect`, `zOrder`, `outerRect`, `naturalRect`, and `clipRect`. The candidate is rejected. Next: add a
real issued-fixture fail-first with reversible prototype pollution, repair only the existing preview/paint seam so
inherited data is never consumed, rerun all focused/type/lint/hash gates on the authoritative host, and require another
independent no-write `CLEAN`. Batch 6D and React/editor integration remain locked; overall B119 remains
`PARTIAL / Not verified in game`.
The tests-first prototype correction is now candidate-green and coordinator-reproduced. Fail-first paint was exactly
`104/109`, exit `1`, with five fixture-ready/non-throwing inherited-field reds and the custom non-plain-prototype control
green. Final preview is `74/74`; paint is `109/109`, including malformed `51/51`, authority `3/3`, valid `7/7`, Phase T
`8/8`, and prototype boundary `6/6`; typecheck and exact six-file zero-warning ESLint exit `0`. Paint hashes are
production `300DD9AD9434E220E9D3FF995FA70DE94FDE2EEA79468E5DE9879F4DA946ED15` and selftest
`900ED6D64CF474E08FD69BFFE71063A319030BE87E8A795B39D5C5AC913D91F6`; preview and Scene pairs remain frozen at
their prior exact hashes. Fresh no-write Luna audit `019ffbbd-e29f-72b3-a7cb-515c9be51693` is active and must enumerate
all inherited optional Scene fields, not merely the five reported ones. Only `CLEAN` unlocks Canvas Batch 6D; overall
B119 remains `PARTIAL / Not verified in game`.
That audit returned `FINDINGS`, zero writes, with exact status/hash parity and every focused gate green. It rejected the
five-field patch because paint verifies the own-property authority snapshot and then consumes the original
prototype-bearing Scene. Remaining P1/P2 families include hierarchy/ownership/layer, table/view/widget optionals,
font/layout, source/provenance/gaps/identity, and inherited input `keepOuts`/`selection`. Next action is tests-first across
the four preview/paint files: add representative causal attacks for every family, extend private issuance with a
verifier/materializer returning a deeply frozen recursively own-property/null-prototype Scene only for exact issued
authority, and make paint consume only that Scene plus own-only inheritance-free optional wrapper data. Preserve all
existing status/clip/undefined equivalences and malformed refusals. Require complete host gates, exact hashes, and a new
independent no-write `CLEAN`. Batch 6D and editor integration remain locked; B119 remains
`PARTIAL / Not verified in game`.
The closed-domain candidate is tests-first complete and coordinator-reproduced on the authoritative host. Fail-first
preview was `74/89` (`0/15` closed domain); paint was `117/127` with `10` causal closed-domain reds, seven changed
prototype effects, inherited wrapper commands, invoked getters, zero unready fixtures/exceptions, and every old counter
green. Final preview is `89/89` (`15/15`); paint is `127/127` (`18/18`), preserving old `103/103`, malformed `51/51`,
authority `3/3`, valid `7/7`, Phase T `8/8`, and prototype boundary `6/6`. Typecheck and exact six-file ESLint exit `0`.
Preview hashes are production `F1D7062E04AA1E7EE8F7DFBBB1A7C444F88C8D508AADE5949F233097C08B0759`, selftest
`31B8EC410F59952651C0E473C60A96D239EC3DF9340D68BD71691C3E5375AF99`; paint hashes are production
`0FBF2928436D689D42A37286A9CA5BD23953B0CE63B779FA11EF02037A90CBDF`, selftest
`43F266F2326F8DB63ADEA32ABEA4E6D360CA72854B11BA249A88F14D182CE303`; Scene hashes remain frozen. Next: dispatch a
fresh no-write full-boundary audit over the exact six hashes. Only `CLEAN` accepts Batch 6C and unlocks Canvas Batch 6D;
overall B119 remains `PARTIAL / Not verified in game`.
Fresh audit `019ffbf7-d938-7022-b26d-7516ca1ae66f` returned `CLEAN`, zero writes, exact six-hash/status parity, and
independently reran preview `89/89`, paint `127/127`, typecheck, exact lint, complete authority/materialization/consumer
trace, corpus gate, and all `15 + 18` causal oracle checks. No alias, prototype, accessor, wrapper, corpus, truth, or
test-oracle finding remains. Batch 6C is focused `VERIFIED`; Canvas Batch 6D is now unlocked under the existing plan.
Browser pixels, editor integration, deploy, and X4 remain open, so B119 remains `PARTIAL / Not verified in game`.
Accepted Batch 6C is synchronized and read back at GitHub #41 comment `5285331097`, Notion comment
`3bb4618e-d15b-81e2-93c3-001d06d2ba02`, and Drive revision
`AIroW35VX58JivbT3O7MSGFQxOELaadevCdJZ_aYdz0iaDmcrrqJt8NjqGzZGHmnPrPoCMYBVPHJPYXepVHexfgHsTrTxzKdDHylpyZMzhKD`.
The initial Drive append failed internally without mutation; a fresh revision/tail read and one end-of-segment retry
succeeded. Canvas worker `019ffc96-0a59-7403-9445-842eb66945c2` now owns only
`src/lib/x4UiCanvasRenderer.ts` and `.selftest.ts`; all accepted dependencies and React/editor owners remain frozen.
Coordinator review rejected its initial `31/31` handoff. The correction fail-first is `35/43`, exit `1`, with exactly
eight causal reds: three order attacks; callback mutation of glyph `x=5 -> 6`, alpha `255 -> 0`, and drawable
`100 -> 101`; and two caller-target setter/draw traces on commit failure. Reconciliation now requires complete global
order numbers plus per-layer monotonicity, but records that coherent structural reissue cannot prove unavailable
producer origin. The atomic repair removes caller-target mutation: return a renderer-owned surface only on success,
detach operations/A8 bytes before callbacks, and revalidate/fingerprint result plus canonical corpus before success.
The correction reached renderer `44/44` and all focused/type/lint/hash gates, but fresh zero-write audit
`019ffcda-c87a-70c1-8fa2-22d0c2c693ce` returned `FINDINGS` with no writes or hash drift. It found no direct P0/P1
production defect; acceptance is rejected because the oracle omits dimension setter/getter, `putImageData`, and
successful-paint callback mutations, does not prove zero factory/draw work on pre-allocation refusals, checks several
ordering/overlay claims through input or receipt state rather than emitted traces, and incompletely enumerates nested
receipt freezing. Production is frozen at
`5C16F57B2D1DD59E12A9E0ECD607AEC5C754126B053E0D829655D5C61113C703`; next action is a tests-only correction in
`src/lib/x4UiCanvasRenderer.selftest.ts`, followed by coordinator reproduction and a new independent zero-write
`CLEAN`. Do not start React/editor integration. Overall B119 remains `PARTIAL / Not verified in game`.
The rejection is synchronized/read back at GitHub #41 comment `5286605053`, Notion comment
`3bb4618e-d15b-8195-b49b-001d0acdfa34`, and Drive revision
`AIroW37Nv-kjq4KuJv-naRl8B443x3GLEIQxSTRvOqLObCgcDSH4zgWKU5aaQjBLDw4fOIbd4iXQnFJjjKEZcCj4Oo4DIVGBjzDRnwyhUTnq`.
The tests-only correction changed only the Canvas selftest to `98F5AF68...BD10`; production stayed exact. Worker and
coordinator reproduced Canvas `65/65` (`44 / 7 / 6 / 3 / 2 / 3` by family), every focused dependency, typecheck, exact
owned ESLint, frozen hashes, and hygiene. Fresh zero-write audit `019ffd0e-2b2b-7250-a161-8c445b68ea37` is active.
Wait for its `CLEAN` or exact findings; do not begin editor integration before acceptance.
That audit returned `FINDINGS`, zero writes, with exact fourteen-hash/status parity and every focused/static gate green.
It reproduced a real cross-layer order escape: swapping a background and glyph order keeps the set contiguous and each
layer monotonic, yet the renderer paints tuple/array order and accepts it. It also found the trace oracle too
implementation-shaped and atlas evidence limited to one alpha byte. Its retained pre-existing factory-surface probe is
classified as an allocator-contract clarity gap, not a caller-target mutation path: factory returns transfer to
renderer ownership and no target is accepted by the production API. The repair must make that contract explicit and
prove a `target` option refuses before allocation, while later React adoption remains swap-on-rendered-success only.
Next: one native Luna owns only the Canvas production/selftest pair, installs the causal flattened-order red plus literal
trace and complete RGBA goldens, makes the narrow validator/JSDoc correction, runs all focused gates, and submits exact
hashes. A fresh independent no-write `CLEAN` is still mandatory before editor integration.
That candidate reported fail-first `68/69` and final `69/69` at renderer hashes `4B126345...16D4` /
`FBC2AE38...0EE`, but coordinator review rejected it before audit. `acceptedPlan()` rewrote the raw
`projectX4UiPaintPlan()` command orders into flattened layer indices, hiding that the stricter renderer refuses its real
upstream owner. Production paint assigns one interleaved construction counter and only afterward groups commands into
the four paint layers. The corrected contract necessarily owns paint production/test plus Canvas production/test:
renumber final issued commands after grouping, retain diagnostics/keep-out exact identity and all old behavior, consume
the raw paint result without any test normalization, then rerun every focused gate and a fresh independent four-file
audit. The initial rejection sync is read back at GitHub `5288798450`, Notion
`3bb4618e-d15b-81cd-baf3-001dc72c7b26`, and Drive revision
`AIroW36kfUW0iJlIbnjJhFdQxeMrfNqfYJcyeOzIMuXTPHPRUPD0lYL7tnXRz8tVrgPP9tYBhDMtMKF80PrK8Nc88UnjEBKI94dKgf9roCQQ`.
Do not begin editor integration from `69/69`.
The corrected four-file contract is separately read back at GitHub `5288853384`, Notion
`3bc4618e-d15b-81cb-9a11-001de2b56048`, and Drive revision
`AIroW37W_qKgcYSMJxasJf45EQh3r8mqDYzSW8LUH_Qg6ueMbjkC9nY5bY_VZrY6ZqLxZJroktf4BmIJAg8QQU6YB6N16CfJSIyv46zvEigD`.
The Phase 3F rejection and Phase 3G contract are synchronized/read back at GitHub #41 comment `5271062148`, Notion
comment `3ba4618e-d15b-8112-babc-001d285cab77`, and Drive revision
`AIroW34QwWm_rC-S2McCvoclRWZVoTGTr9nGlvXR4Qf_dP0jw06b5AQa1b-XQjtY_XoOz-YfBBhVu3FfUW6XHboRimW3x4mYctsEMq-F_ujh`.
Accepted Phase 3D is synchronized/read back at GitHub #41 comment `5270316387`, Notion comment
`3ba4618e-d15b-81ee-8cf1-001dcdff9a38`, and Drive revision
`AIroW35if-Cx5nsXoSQKHGAk7VDKAHLtFXhDPfEDUa2XxouivSpcjbVX22n0EwjskWclE29rTeQln1DBqDztQCWbPdr3bvLFIqwGDVQbi332`.

## Authoritative request and product law

- Original brief: `C:\Users\Moshi\AppData\Local\Temp\claude\G--SteamLibrary-steamapps-common-X4-Foundations-extensions-x4-ai-influence\b9a29c50-1478-4e0e-9729-d310c18cb51d\scratchpad\FORGE-UI-EDITOR-BRIEF.md`
- Durable plan: `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`
- GitHub owner: issue #41. External projections must not be advanced until a checkpoint is independently accepted.
- “Port it, don’t invent it.”
- “Preview for layout, game for truth.”
- Every state remains `Not verified in game`; static preview/lint never proves C++ frame acceptance or X4 rendering.
- The linter is first-class and may be more valuable than the renderer. Do not weaken linter/package/deploy blocking while
  working on preview.

## Configured corpus authority

Reuse the existing configured unpacked-corpus route and extension discovery. Do not add another scanner, config key,
database, registry, or provider.

- Helper: `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00\ui\addons\ego_detailmonitorhelper\helper.lua`
- Widget: `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00\ui\widget\lua\widget_fullscreen.lua`
- Zekton assets are loaded through the accepted canonical corpus owner.

## Accepted and frozen focused owners

- Linter: 112/112. Column policy is 12 clean, 13–23 warning, 24+ blocking error; do not claim a universal 12-column
  engine limit.
- Source bundle: PASS.
- Keep-outs: 16/16. Measured guides are wheel `y=0.788` and video-left `x=0.664`; ticker/top HUD remain unavailable.
- Layout kernel: 29/29.
- Font metrics: 10/10.
- Text layout: 8/8.
- Call model: 46/46.
- Corpus assets: 28/28, independently CLEAN and frozen.
  - `x4UiCorpusAssets.ts`: `F08195B48B858F4721A50CA946FA73672F87FD87C923CE5DFBD9D18F32BEC4D2`
  - selftest: `33D12EF151CDB0163E9AB7CB61E20861C9041733763AF0F994CEB45EE0277F53`
- Layout program plus separate evidence authority: 109/109, independently CLEAN and frozen; this supersedes the earlier
  accepted `84/84` producer.
  - `x4UiLayoutProgram.ts`: `2CBD9E11DFCC89A0C8D8A973A4801780F534556AC154E791678C39E3C4856F34`
  - selftest: `AFF8919803EA70AAF90F3F863EB6DD031AA20774BB0DB05F230112B382CA7D3E`
  - Independent audit: 28/28 malformed-node attacks returned `valid:false` with zero throws; 71/71 core and 52/52
    selected-expansion attacks rejected; intact positive families passed.

Do not edit the frozen producer or corpus owners unless a fresh independent review reproduces a defect in those owners.

## 8A producer-authority audit history

The first manifest candidate is not accepted despite producer `92/92`:

- `x4UiLayoutProgram.ts`: `0BC43268F9B4D838E9B3410139F28B20B6E0EF668F5CE24A36D9D9CD44A42B90`
- selftest: `0C9FA7739078C4078F251E17F156960E4C02270D20E5BF18C109703FE71676A0`
- Fail-first was `84/89`; all original 84 stayed green and five missing-manifest checks were red.
- Independent audit rejected embedded mirrored authority: coordinated operation/gap rewrites validate, selected expansion
  reciprocity is incomplete, nested schemas/numbers/IDs/reachability are open, and permanent rejected-family coverage is
  incomplete.

This `92/92` candidate was superseded; it is retained here as rejected evidence.

Second rejected 8A candidate:

- Producer: `101/101`; hash `FFA53D588ADB1B4C9D98DD871D84493F3DB2B8EBE6CA8B24331EA61B11F0D5FD`.
- Selftest hash: `D88F10679999206A3BCE2CDC5D13EDF8481ABF5A6E0DCA9BB6751926648982A7`.
- Independent audit found unpaired expansion ledgers, unauthenticated reciprocal node operation IDs, non-exact
  reachability mapping, false producer-origin semantics for recursively frozen clones, and unresolved substitutes in the
  permanent rejected-family oracle.
- Deep-freeze now means immutability only. Structural pair validation never authenticates producer origin; trusted origin
  is the direct internal success-result call path and is not serialized as a caller-forgeable grade.

Third 8A candidate was substantively correct but not accepted:

- Producer `105/105`; hashes `213A5752A9D1214A63189E814544674EA46ED0643A0820E647646E1DC9AF31C2` and
  `C7F77FA85FCE34CEE4DF5FB7E0341D8E5422AEC24AE545EC1A79B6D44D734CF1`.
- Independent review passed 71 core and 52 selected-expansion attacks plus all intact positive families.
- One P3 remains: null/non-array/null-entry frame/table/row/cell collections make the public pair validator throw instead
  of returning `valid:false`. Add fail-first malformed-node collection coverage and close this path before final 8A audit.

Final 8A correction is accepted:

- Fail-first `105/109`; final producer `109/109`.
- Accepted hashes are listed in the frozen-owner section above.
- Final independent audit returned `CLEAN`; malformed public inputs fail closed without throws and all prior authority,
  expansion, node-ledger, reachability, rejected-family, operation/gap, and structural-only trust checks remained green.
- Deep-freeze means immutability only. Structural pair validation does not authenticate origin; trusted provenance is the
  direct internal success-result call path. Coherent replacement of both unsigned inputs remains out of scope.

## Scene candidate — locally green, contract-rejected

Owned paths:

- `src/lib/x4UiScene.ts`
- `src/lib/x4UiScene.selftest.ts`

Eighth-audit rejected baseline:

- Scene selftest: 108/108.
- Scene hash: `17705C27D35231DBB637FD191E0E7A817F7E977F2A260B08AF06B819590433CF`.
- Selftest hash: `974C9468621C9956FFD04F2B703DA89EA6C8855BBE0CAC129008C01E8B113F72`.
- Dependency/type/owned-ESLint/import/debug/whitespace checks were green.
- This is not acceptance. The eighth independent reviewer found six source-backed defects.

Current 8B candidate, also not accepted:

- Scene selftest: 115/115.
- Scene hash: `69412F26E211FE2E573309AD621F57DE588EAAEFC15107F5E8C5C0AC7934EA29`.
- Selftest hash: `9FCA718D279B07E2D62B6C6C4435B99C58913D61D67359EC43A0F7ACAE37BC2D`.
- Accepted producer hashes remain unchanged at the values in the frozen-owner section.
- The permanent exact raw audit matrix was recovered from the original eighth-review JSONL payload, not recreated from
  the candidate suite: 122 cases generated, 121 retained, 110 unresolved, 11 rejected, with exact per-kind allocation.
  The dynamic `addRow` interactive branch is generated but correctly omitted because the producer emits an applied
  descriptor-partial operation for that source.
- The implementation worker's declared matrix and the coordinator rerun are green for scene 115/115, producer 109/109,
  call model 46/46, kernel 29/29, font 10/10, text 8/8, corpus 28/28, keep-outs 16/16, linter 112/112, source bundle PASS,
  repository typecheck, and owned-file ESLint. The coordinator initially invoked three stale remembered aliases
  (`x4UiCorpus.selftest.ts`, `x4UiKeepOutZones.selftest.ts`, and `x4UiLinter.selftest.ts`); each failed only because the
  file did not exist, then the actual entrypoints passed. This is an AAR trigger, not a product failure.
- Public input now requires a successful `X4UiLayoutProgramResult`; bare programs refuse, pair validation runs before
  geometry, and temporary tracing markers are absent.
- This candidate still violates the recorded 8B contract at plan lines 2029-2031: `operationGapEvidence`,
  `producerDerivedGapReason`, `producerGapCategoryFromReason`, `expectedGapStatus`, `exactGapEvidence`, and
  `gapReasonIsProducerRecorded` reconstruct unresolved-row gap language instead of consuming only the producer-issued
  ordered authority. A green exact current corpus does not make this future producer boundary source-authoritative.
- The ninth independent audit reproduced a P1 acceptance escape with deeply frozen, pair-valid producer results:
  changing the cell text fact emitted visible `FORGED` text, removing the creator operation fact still produced a scene,
  and changing both operation/cell text also emitted `FORGED`. Creator reconciliation currently replays kernel geometry
  from operation facts but does not bind every scene-consumed cell fact to the exact creator operation/semantics/result.
- The same pair-valid probe changed a cell `outerX` from 1 to 11 and scene widget x followed, changed `outerWidth` from
  30 to 5 and scene widget width followed, and changed the cell source offset and scene provenance followed. These are
  additional P1 source-authority escapes: current kernel reconciliation covers y/height/type/scaling but not every
  scene-consumed x/width/provenance fact.
- Representative pair-valid frame x/y/width/height/layer and table x/y/maxVisibleHeight mutations were also accepted and
  changed geometry, layer, clipping, visible height, or scrollbar-band output. Existing reserve/finalWidth, row, and span
  reconciliation correctly refused their sampled mutations and must remain strict.
- A P2 production compatibility branch accepted a real no-op `setColSpan` result after its source metadata was reduced to
  empty arguments/semantics and only a span fact. The pair remained valid. Remove that fallback and require the exact
  producer metadata/semantics/facts plus replay; handcrafted fixture accommodation may not exist in production.
- The permanent negative oracle is materially vacuous after the wrapper-only public boundary: 77 calls across 31 test
  blocks pass a supplied bare program through `sceneFor`, so they refuse before the named structural/reconciliation
  mechanism. Direct bare-program `buildX4UiScene(... as never)` negatives have the same problem. Keep one explicit bare
  boundary test; migrate every deeper negative to a deeply frozen real producer result and require either pair-valid
  evidence before the scene attack or the exact intended pair-invalid reason.
- The ninth audit verdict is `FINDINGS`; all four candidate/producer hashes stayed byte-identical. Its independently run
  original matrix produced 122/122 successful wrappers and valid pairs, 121 retained branches with exact 110/11 status
  census, zero unexpected scene refusals, 122/122 bare-program refusals, 41/41 malformed/authority mutations refused,
  and zero throws. The positive corpus is valid but does not cover the pair-valid descriptor defects above.
- The two-file ninth-findings correction is now assigned to the existing scene Luna worker. It must rebuild the negative
  oracle, remove heuristic language and the setColSpan fallback, and reconcile every consumed fact before re-audit.

### `117/117` correction audit — FINDINGS

- Rejected hashes: scene `6F7623123EEA79E8D41DF94EE0093F3ABDFAC8EE9FF159DAA124EA6F2FD4E2EF`; selftest
  `5CED7BE87648CA08165052DF09A45449034793E6DC19CB66CC3C22B78AC01453`. Accepted producer hashes stayed unchanged.
- The independent exact matrix remained green at `122 generated / 121 retained / 110 unresolved / 11 rejected`; all
  focused dependency/type/lint/import/debug/whitespace/hash gates passed. The reviewer wrote no files.
- **P1:** unchanged authority plus a pair-valid result can still carry altered operation descriptor facts/metadata/kernel
  payload and altered node facts. Coherent frame/table/creator changes, secondary-text font/size/alignment/x/y,
  source-offset provenance, and unavailable-to-known text/edit-box affect changes reached or bypassed scene logic.
- **P1:** intact `uiScale=2` text/edit-box/button/icon creators falsely refuse because raw operation height `10` is
  directly compared with finalized cell height `20` instead of replaying scaling/finalization.
- **P1:** for span `40`, scaled x `50`, omitted width, shipped Helper returns `-10`, producer clamps `0`, and scene
  recomputes `-10`; text alone accepts through an exception while the other three creator kinds refuse.
- **P3:** 79 `sceneFor(fixture, program)` negative calls across 32 blocks stop at pair mismatch before their named scene
  predicate. Only six direct pair-valid mutations plus 24 creator-loop mutations across two blocks reach scene internals;
  exactly one bare-program boundary control is legitimate.
- Malformed fail-closed probes passed after correcting the review harness's wrong provenance import: 54/54 pair cases and
  7/7 wrappers refused with zero throws. The initial failed harness invocation is AAR evidence, not acceptance evidence.

### Eighth-review findings to correct

1. Per-field producer category evidence is re-derived heuristically; 50 of 121 retained source-valid differential cases
   falsely refused.
2. Untouched selected local expansion falsely refuses because source-invocation IDs are compared with instance IDs.
3. Conditional/unreachable addRow evidence is treated as a materialized row and refuses the complete program.
4. Creator replay accepts stripped or contradictory descriptor/semantic facts.
5. Linked gaps are not an exact ordered multiset; deletion and reversal pass.
6. Removing a real source no-op transition and all reciprocal IDs still passes because final-state continuity cannot prove
   complete operation membership.

The plan records the full eighth correction at `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md` under
“Eighth independent-review correction (2026-08-11)”. The actual relevant-call count remains 17.

## Exact next bounded unit

The latest producer audit changed the plan again. Scene 8B.1 is paused; producer 8A.4 is rejected and the bounded
producer-only 8A.5 exact emitted-invariant correction is the active unit.

Required implementation shape:

1. **Rejected 8A.1 producer candidate:** hashes
   `0C1BF98C36C9F9C8E4FF0EE8AB37D5450FA086AE4F5DCFE4BB605874E72E4FFB` and
   `2D2DC516F608DC65D486C275D62EC7A9C8CAC695F34ED8E1A4636A44A7E7C55C`; permanent `121/121` is green, but an
   independent audit reproduced two P1 schema gaps. Do not treat these hashes as accepted.
2. **Rejected producer 8A.2 closed-schema candidate:** hashes
   `85B57D010BE2408455CC17866DF486B852AEE63B4B860DB94BB94D0CE64FA1B9` and
   `BFFAE765C98591AA01724FE879CC09B2276D1311930E8726831D96F8288BAC60`; fail-first `121/171`, final `172/172`,
   focused dependencies, typecheck, and owned lint are green. Cross-owner `x4UiScene` integration is red at `104/119`
   with 15 failures: 13 repeated valid operations refuse on unknown `metadata.semantics` members, including `fontsize`
   and edit-box data, and two are the unfinished scene behaviors. Independent re-audit returned `FINDINGS`: the original
   15 root and 37 coordinated operation/node escapes are closed, but complete producer `fontsize/editBox` semantics,
   local parameter/result identities, nil literals, and legitimate `groupIndex` can falsely refuse; malformed nested
   kernel, metadata, provenance, union, transition, and height shapes can still validate. These hashes are rejected.
3. **Rejected producer 8A.3 exact-schema candidate:** hashes
   `956E00392EF26854B1B6AC52759E9C6C4AA8A312A4F181F1C66FCF3C8F17683F` and
   `78F768A48F420B3C000C2FCA4FF82DE1094A6DF1A2A62986448D0EA12ECF5BE3`; fail-first `179/195`, final `205/205`,
   focused dependencies/type/lint green, and scene integration `117/119`. Independent audit executed 157 malformed
   cases: 140 refused, 17 validated, zero throws. The escapes are value discriminant/member combinations, impossible
   kernel states, rejected-state continuity, and property/source correlations. These hashes are rejected.
4. **Rejected producer 8A.4 emitted-invariant candidate:** Einstein owned only `x4UiLayoutProgram.ts` and its selftest. Fail-first is
   captured at `208/225`, exit `1`, with exactly the seven value, four kernel, one continuity, and five property/source
   reds while positive censuses remain green. The candidate is now `225/225` at hashes
   `513557DFA4DEE70162A43E6EEDF57DAB07A1A815D1090D5814D312DE284B476E` and
   `33CD3D5784E2457356F769C573B631B833B79A936EBDC506BC46E69392F1EEED`; coordinator focused gates pass, but independent
   re-audit returned `FINDINGS`. All prior 17 fixes are closed; 38 new malformed states remain pair-valid: profile
   `14/14`, kernel `4/4`, value signatures `8/8`, and nested parameter/result/property/literal identities `12/12`.
   These hashes are rejected.
5. **Producer 8A.5 exact emitted-invariant correction:** reuse Einstein for only the producer and its selftest. Install
   fail-first permanent assertions for all 38 reproduced cases before production repair, retain all 225 earlier tests,
   and add positive guards for valid profile boundaries, all actual call-model signatures, kernel neighbors, direct and
   expanded source identities, JSON-equivalent topology, and selected expansion. Repair only exact normalized-profile,
   emitted-kernel, value-signature, and nested identity/source invariants. Fail-first is captured at `228/266`, exit `1`,
   exactly 38 red, zero throws, production unchanged. The first repair reached `267/267` at hashes
   `47B840DEF4087C055E688D8361FF21AD2E7A69CDD3126E6BDD4E2B8621674676` and
   `D71E3BFA6EBAAC13CE8494020F9AC68EF0E0E7B3A25C339D639DE003A32CC1E2`, but coordinator review found three contract
   misses and an unresolved coordinated-identity challenge. A fail-first review correction is active. Require a fresh
   `CLEAN` audit before scene work. Its additional fail-first is captured at `269/281`, exit `1`, with exactly 12 reds:
   three direct arguments, five valid-profile drifts, two recomputed parameter identities, one local-result identity,
   and one non-static expanded-source identity. Production remained at the first-repair hash before correction. The
   corrected candidate is `281/281` at hashes `0E0DB9645655AD02087B785B9282B22434B02CF4544479DD923ACA4AEFD91989` and
   `FECD2E138BE4C8CD001AAF891C54B36F50017C8E94853721D2D19C81602AAF4A`; coordinator focused gates pass. It is not
   accepted: the final audit returned `FINDINGS` across `193 / 178 / 15 / 0`, with 11 exact-local-identity escapes and
   four profile-to-kernel/table correlation escapes.
6. **Producer 8A.6 exact identity/profile-correlation correction:** Einstein owns only `x4UiLayoutProgram.ts` and its
   selftest. Phase 1 is complete and coordinator-accepted at exactly `285/300`, exit `1`: all prior 281 plus four
   already-refusing local controls green, exactly the 11 local-identity and four profile-correlation escapes red, zero
   throws, producer/Scene production hashes unchanged, and producer selftest hash
   `78A33FB00032BE65D0EABA58F978A11422AA15281603C530C89CE8A1ABECE8C8`. The first Phase 2 candidate is `302/302` at
   hashes `046E6E1FD4AE291286A4A8CF77DF04EA2E82085A8E76F62865511711E59F23EC` and
   `AB52344E4FD30AEDBBA6070E5E401F321B4AC7F3148741B73199C04874D99F21`, but coordinator review rejected it: five
   coordinated nonexistent/missing/one-way frame-table owner mutations remain pair-valid. Their exact tests-only
   checkpoint is accepted at `302/307`, exit `1`, with selftest hash
   `B578959049861FA8FA571C6900D6B276FA640FE28D1BFEA2AB794D00030375B2`. Complete owner-path consistency review, then
   add the five newly reproduced same-width reassignment, contradictory operation-owner, table-parent, second-owner,
   and order regressions for exact `302/312`. This oracle is coordinator-accepted at selftest hash
   `DF840B851CB0DDEC61479325FACD4DA60FD0A2A5965524BAC78851530A7DDE44`. Phase 2B must now require reciprocal ordered
   real frame/table ownership and exact addTable receiver/result identity for every owner-derived width/kernel state
   before another independent four-hash `CLEAN` audit. The candidate reached focused-green `313/313`, hashes
   `766F24C11EF572DF603EFB31F3091A327B4B95AFA7505EED1A365D1A5837032E` and
   `AD74133867DC07D82AFF94C982AB2E8AC524CE7DE363EFD18769792F010A51E5`, but is rejected. A coordinator probe assigned
   the ownerless unresolved `addTable` operation to its unresolved frame through matching program/authority operation
   and frame ledgers; the deeply frozen pair still validated while the table remained ownerless. Independent audit is
   active on that reproduction and the full matrix. A follow-up exact all-kind matrix also produced 42 valid coherent
   extra-owner injections and 20 valid coherent required-owner removals. The repair must enforce exact per-call owner
   shape plus parent-chain reciprocity, not special-case one operation. A two-branch sibling fixture also leaves five
   coherent source-wrong reassignments pair-valid (`createFrameHandle`, `display`, `setColWidth`, `addRow`, and
   `createText`), so exact receiver/result identity binding is required too; producer-only correction is next and Scene
   remains frozen.
   The completed independent audit also found 11/11 row/cell topology escapes, 8/9 identity/receiver escapes, three
   type-valid profile inputs that emit self-invalid success, pair-valid empty provenance, and two parameter-range
   order/overlap escapes. 8A.7 must install every documented fail-first family, then enforce exact per-kind owner shape,
   ordered row/cell projections and parent/identity reciprocity, one shared exact profile predicate, and lexical
   non-overlapping parameter ranges. The full contract is in the durable plan; do not narrow it to the ownerless case.
7. **8B.1 scene/oracle repair after producer re-audit:** reuse Meitner for only `x4UiScene.ts` and its selftest. Its partial
   current edits are preserved at hashes `73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246` and
   `2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`, not accepted. The baseline was `114/117`, an
   intermediate correction reached `117/117`, and the preserved new-fixture state runs `117/119` against producer
   8A.3; all producer schema false refusals are gone and only the two new scene behavior groups remain red.
   Resume only against repaired producer hashes; reclassify pair-boundary tests, then create coherent pair-valid
   producer-result probes for actual scene predicates.
   Compare every consumed field to authority, replay scaled creator height correctly, handle negative Helper width
   uniformly as explicit partial/unavailable geometry, remove the text-only exception, and migrate every intended
   scene-internal negative onto a real deeply frozen pair-valid producer result.
8. **Acceptance:** rerun the exact matrix and full focused dependency/type/lint/boundary/hash scans after integration, then
   send all four exact hashes to a fresh read-only reviewer. Only `CLEAN` may unblock Batch 6B/6C.

Native workers to reuse:

- Scene implementation: `019fef89-02a6-7561-81be-e90a987cbd27` (Meitner), completed `PARTIAL` at the required dependency
  boundary; preserve its two exact hashes above and resume only after producer re-audit.
- Independent reviewer: `019ff083-b11a-7aa1-bb7d-5d8da8146355` (Chandrasekhar), completed/open after `FINDINGS`; it
  independently confirmed the five identical-sibling reassignments. Reuse only for the fresh post-repair audit.
- Producer worker: `019ff1e6-df0c-71e0-831a-4a482169bfb4` (Einstein), completed/open after the now-rejected Phase 2B
  `313/313` candidate. Resume with the exact documented 8A.7 tests-first correction across all four audit findings.

Every coding turn must use exact native `luna_executor`, `gpt-5.6-luna`, reasoning effort max, and no forked parent turn.
Sol coordinates, documents, validates, and reviews; Sol does not patch implementation/test code.

## Downstream work remains SPECIFIED, not started

- Batch 6B: `x4UiPreviewPipeline.ts/.selftest.ts`.
- Batch 6C: `x4UiPaintPlan.ts/.selftest.ts`.
- React/Canvas editor integration, source-preserving round-trip edits, keep-out UI, deploy hash, installed extension,
  screenshots, and in-game confirmation all remain pending.
- Graphify is stale for untracked B119 code and must not be rebuilt casually because its generated evidence surface can
  create unrelated churn.

## Documentation and external records

- The durable plan, backlog, and this handoff are current through the producer 8A.4 independent `FINDINGS`, 8A.5
  fail-first `228/266`, unaccepted first repair `267/267`, review fail-first `269/281`, frozen `117/119` scene integration
  baseline, final 8A.5 rejection, 8A.6 correction sequence, rejected `313/313` candidate, completed `60 / 5 / 55 / 0`
  independent audit, and specified producer-only 8A.7 correction. No rejected hash is acceptance. Scene 8B.1 is frozen
  pending producer `CLEAN` and fresh re-audit.
- `BACKLOG.md` correctly leaves B119 in progress; do not move it to ROADMAP.
- This handoff is the degradation checkpoint and supersedes earlier scene-green notes.
- The independently accepted 8A checkpoint is synchronized and read back in GitHub #41 comment `5261639005`, Notion
  page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive doc
  `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`. Every projection remains `IN PROGRESS / PARTIAL` and
  `Not verified in game`; repository Markdown remains authoritative.
- The ninth-audit rejection and active correction are also synchronized and read back in GitHub #41 comment
  `5262730559`, the same Notion page, and the same Drive doc. Readback contains the rejected scene hashes, exact
  `122/121/110/11` producer matrix, five rejection reasons, and the explicit statement that downstream renderer/UI and
  broad/installed/game gates have not run.
- The later `117/117` correction-audit findings are synchronized and read back in GitHub #41 comment `5263387897`, the
  same Notion page, and the same Drive doc. Readback includes the three P1 findings, 79-call/32-block P3 oracle census,
  rejected hashes, sequential 8A.1/8B.1 plan, and unchanged `PARTIAL / Not verified in game` state.
- The producer 8A.1 targeted-audit rejection and frozen scene checkpoint are synchronized and read back in GitHub #41
  comment `5263982520`, the same Notion page, and the same Drive doc. Readback includes both producer P1 schema gaps,
  P3 missing regression class, rejected producer hashes, frozen unvalidated scene hashes, producer-only next unit, and
  unchanged `PARTIAL / Not verified in game` state.
- The producer 8A.2 independent rejection is synchronized and read back in GitHub #41 comment `5264568985`, the same
  Notion page, and the same Drive doc. Readback includes the closed 15-root/37-snapshot attacks, remaining P1/P2/P3
  schema mechanisms, red `104/119` integration split, active 8A.3 repair, frozen scene, blocked downstream work, and
  unchanged `PARTIAL / Not verified in game` state.
- The producer 8A.3 independent rejection and active 8A.4 correction are synchronized and read back in GitHub #41
  comment `5265137007`, the same Notion page, and the same Drive doc at revision
  `AIroW36jAqomCwkRR8AjQnuO_mc4NBeTShGbtwx_YB_n9EMAqd8-7aA3QUXno8HX-9XSpOZhElrzQnmOl5Wc6Y1BsOybrcM_7hqYMl6hklKC`.
  Readback includes the `157 / 140 / 17 / 0` malformed-case census, all four emitted-invariant mechanisms, the AAR
  fixture failures excluded from evidence, frozen `117/119` scene, and unchanged `PARTIAL / Not verified in game` state.
- The 8A.4 `225/225` candidate and active independent re-audit are synchronized and read back in GitHub #41 comment
  `5265354262`, the same Notion page, and the same Drive doc at revision
  `AIroW34MFB6-BR0HStFDOnKaTZsulgA2oI1WsjMvsKKF-AhdoUwKRFw79GcK1jBlYJA2sdSRVsogCYa08cfueSOIGTFGZiZ0Lp3ZSEKXvJNO`.
  Readback includes fail-first `208/225`, exact candidate hashes, coordinator focused gates, frozen `117/119` scene,
  audit-pending status, and unchanged `PARTIAL / Not verified in game` state.
- The later 8A.4 independent rejection and dispatched 8A.5 correction are synchronized and read back in GitHub #41
  comment `5265682197`, the same Notion page, and the same Drive doc at revision
  `AIroW371icPTt2nccVBlnKv5tWVb7X0jmovljHoDwfjqL1mg2FnmvQ0opMC8WOtZaUSFLAq2NX_5AsNkRE1l3HqpZ8t8-8uZMf-xV6hIeLZk`.
  Readback contains the prior-17 closure, `154 / 116 / 38 / 0` malformed-case census, four new invariant classes,
  rejected hashes, active 8A.5 scope, frozen `117/119` scene, and unchanged `PARTIAL / Not verified in game` state.
- The 8A.5 fail-first checkpoint is synchronized and read back in GitHub #41 comment `5265772862`, the same Notion
  page, and the same Drive doc at revision
  `AIroW34anVOv3jVHuaMhlOIHXHzPYYkAxeHXMxp50-LBWiAUiwhUD8aOKOmmiK4N5LkNPzrxz8-whJO_yX0ComseBHkP4JGYRDHj6x4q9SuR`.
  Readback contains `228/266`, exactly 38 intended reds, zero throws, unchanged production, frozen scene, active repair,
  and unchanged `PARTIAL / Not verified in game` state.
- The review-corrected 8A.5 `281/281` candidate is synchronized and read back in GitHub #41 comment `5266092599`, the
  same Notion page, and the same Drive doc at revision
  `AIroW36_H2B0IvdhF0sUcfGgzDQjNVxm2q-qTqcCKMnfsET0bHP7ZE_UznonTioXIv9ImQzF3AHrUcEzH66B-xAHzHdS95TEcf9lpivXE-fH`.
  Readback contains review fail-first `269/281`, final `281/281`, exact four hashes, coordinator focused gates, frozen
  scene, audit-pending state, and unchanged `PARTIAL / Not verified in game` boundary.
- The live 8A.5 independent rejection checkpoint is synchronized and read back in GitHub #41 comment `5266352659`,
  the same Notion page, and the same Drive doc at revision
  `AIroW36HfFSd_y9m_s59MOitV0pRoD95Q1kJZi0uWdsm4Bh2qsY_iaNgeHYLdxqnVkY15F4zSKfIPMS7SvpiZS3qOQOZ6iOO3gPVMpv7esxz`.
  Readback contains the one-sided local function/invocation/parameter reorder escapes, unconsumed-invocation removal,
  rejected `281/281` hashes, final-census-pending state, frozen scene, and unchanged `PARTIAL / Not verified in game`
  boundary.
- The completed 8A.5 final rejection and active 8A.6 contract are synchronized and read back in GitHub #41 comment
  `5266490479`, the same Notion page, and the same Drive doc at revision
  `AIroW341C6UJlhubGyCalWJKuKi-H1SvZKf0x3SfGiVbJm1fxzj-jUv1Z0dUJbz_O5AKisATqP--zwp8odiSYXJP4ZoqJYxzmVSDlFF_o89U`.
  Readback contains the `193 / 178 / 15 / 0` census, both P1 mechanisms, exact rejected hashes, frozen scene, active
  producer-only scope, and unchanged `PARTIAL / Not verified in game` boundary.
- The accepted 8A.6 Phase 1 fail-first is synchronized and read back in GitHub #41 comment `5266860529`, the same
  Notion page, and the same Drive doc at revision
  `AIroW35-FFlBX0PqWkyIiBKwLLk377aHjXTCVCr4p-J5__Y6SLokc5NlPnGltIW7mNjM2BjSNEFDv9xduor0HQvUKytChTJlZJnEA30UlzHG`.
  Readback contains exact `285/300`, the selftest hash, unchanged producer/Scene hashes, Phase 2 scope, and unchanged
  `PARTIAL / Not verified in game` boundary.
- The rejected first 8A.6 Phase 2 candidate and owner-topology correction contract are synchronized and read back in
  GitHub #41 comment `5267040263`, the same Notion page, and the same Drive doc at revision
  `AIroW36KzI6bso7F6mJ_PJ_Nb3mgX9TZuC3iENlj4SYGFCc3aEBZcbbRwVNcaaCTIkRwH3K5Qm8p0pmplUgxlGRzkiLXbKgKO4jrzH5_pg5Z`.
  Readback contains the five reproduced owner escapes, exact rejected hashes, `302/307` fail-first contract, frozen
  Scene, and unchanged `PARTIAL / Not verified in game` boundary.
- The accepted final `302/312` owner fail-first is synchronized and read back in GitHub #41 comment `5267308030`, the
  same Notion page, and the same Drive doc at revision
  `AIroW36o2nLmGjVsAO3D7MFTnj2XNSf7pZ_fXJD8OvOmyr-hu7u5liAhzileGSYZQLNUbJAelDbhK6YCTEj4YYUtHT6kwzJgELPpSTVyGHL5`.
  Readback contains exact totals, hash, Phase 2B scope, frozen Scene, and unchanged game-truth boundary. The first Drive
  append hit a stale revision guard; fresh-revision retry and readback succeeded without overwriting concurrent content.
- The rejected Phase 2B `313/313` candidate and general owner-shape finding are synchronized and read back in GitHub #41
  comment `5267795155`, the same Notion page, and the same Drive doc at revision
  `AIroW34qrzuZ10l7F3_287sctfd8d4yKkLymKs4QxDvW_VfaP9e7lj3MJqDLdzCc-zHHIEGUfIYXav8ulerISXXIERZdYnQYxEAusoIBGsd_`.
  Readback contains the 42 coherent injections / 20 coherent removals census, exact producer and frozen-Scene hashes,
  active independent audit, and unchanged `PARTIAL / Not verified in game` boundary.
- The completed final audit and dispatched tests-only 8A.7 Phase 1 are synchronized and read back in GitHub #41 comment
  `5267970111`, the same Notion page, and the same Drive doc at revision
  `AIroW36kKuND40K1JA-1sdqq5Q7v-aExBFJEpkkTvuZ0m3zh0rqF84xg9ucs2hgGlfiHQ7329ixfqw5rLp1GLVVBA4aC1ZBQF7tV7YFO-fSx`.
  Readback contains combined independent `60 / 5 / 55 / 0`, positive `8/8`, all four findings, tests-only boundary,
  exact rejected/frozen hashes, and unchanged `PARTIAL / Not verified in game` state.

## Safety and validation boundaries

- Do not write to the real mod, game installation, unpacked corpus, or standing configuration without the operator write
  paragraph and explicit go.
- Do not run precommit/oracle/E2E/build/installed UI/X4 until the machine-state question is answered.
- Focused selftests, typecheck, targeted ESLint, hashes, scans, and read-only source inspection are allowed now.
- No Git mutation is authorized in this task. Preserve all unrelated dirty paths.
- A green local suite is not acceptance; independent producer-shaped mutation probes are mandatory.

## AAR triggers already fired

- Power outage and unavailable local API/ports.
- Repeated independent-review corrections after green suites.
- Reconciliation expanded the correction from two scene files to a sequential producer-manifest plus scene-consumer
  change; scene continuity alone cannot prove a real no-op source operation was not deleted.
- The first 8A manifest was locally 92/92 but independently rejected: its embedded ledgers are mutually editable, selected
  expansion reciprocity and recursive schema closure are incomplete, and JSON serialization was treated as stronger
  evidence than lossless round trip.
- The second 8A candidate was locally 101/101 but independently rejected: expansion ledgers and node operation IDs were
  not paired, reachability was not exact, a frozen clone could forge the producer-origin grade, and the rejected-family
  oracle admitted unresolved substitutes.
- The third 8A candidate passed every substantive raw authority attack but still threw on malformed null node collections
  or entries; the final correction closed this with fail-first `105/109`, final `109/109`, and a CLEAN independent audit.
- The eighth audit rejected a 108/108 candidate: 50/121 source-valid field branches falsely refused, selected expansion
  falsely refused, blocked addRow falsely materialized, creator facts weakly reconciled, gap omission/order accepted, and
  a real no-op operation could be removed.
- The first full validation after scene green exposed six TypeScript errors and four lint findings before repair.
- Incorrect 18-call documentation count; actual union is 17.
- Producer 8A.4 passed `225/225` but the emitted-invariant audit still found 38 pair-valid impossible states. Exact
  negative complements and cross-field correlations are mandatory; enum/member shape coverage alone is not an oracle.
- The 8A.4 review had two discarded setup markers, one absent-selector fixture, and one failed combined boundary scan.
  None counted as product evidence; direct rerun and literal split scans completed successfully.
- The first Google Docs revision read mixed legacy `body` fields with tab content and returned HTTP 400. A tabs-only
  field mask succeeded; use `tabs(tabProperties,documentTab(body(content(endIndex))))` when the connector requests tab
  content. This was bookkeeping tool friction, not product evidence.
- The owner-audit Drive sync's mandatory trusted-read bridge first hit a missing `atob`, then rejected Windows-style
  absolute paths; neither attempt reached a document write. Byte-checked PowerShell JSON loading plus the unchanged bridge
  running under Git Bash `/c/...` paths succeeded, followed by guarded append and exact target/tab/revision readback.
- Coordinator review rejected the first green 8A.5 repair before independent audit because its tests and authority did
  not cover the exact direct-argument/profile/expanded-source contract. Green local counts remain candidate evidence.
- The first follow-up worker message failed locally because unescaped Markdown backticks terminated the JavaScript
  template literal; no message was delivered. The plain-text resend succeeded. Do not embed raw backticks in tool-call
  template literals.
- Invalid isolated raw fixture setup versus partial top-level aggregation.
- Several PowerShell/JavaScript quoting and overbroad scan failures.
- ESLint caught a final unused local.
- A count-correct 122/121 test census was initially duplicated/fake and was rejected; the exact original eighth-audit
  matrix was then recovered from local session evidence and installed permanently.
- Exact producer branches exposed four real scene false refusals after the legacy suite was green; iterative correction
  reached 115/115. One transient broad patch dropped the suite to 50/115 and was rejected immediately.
- Coordinator validation used three stale selftest aliases and produced `ERR_MODULE_NOT_FOUND`; `rg --files` found the
  real entrypoints and all three passed on rerun.
- Coordinator source review caught a remaining reason/category reconstruction path despite 115/115, directly proving
  again that a current-corpus green test is not the same as satisfying the source-authority contract.
- The ninth audit then proved the creator-negative oracle was stopping at the wrapper/freeze gate. Deeply frozen,
  pair-valid mutations escaped and changed visible scene text. Thirty-one negative test blocks contain bare-program
  calls that must be reclassified or migrated before their named mechanisms are evidence.
- Pair-valid cell outer-x, outer-width, and source-location mutations also changed visible geometry/provenance, so the
  correction must reconcile every consumed descriptor/provenance family, not only creator text.
- Pair-valid frame/table mutations changed accepted geometry/layer/visible bands, and a source-incomplete no-op
  setColSpan compatibility form was accepted. Production accommodation for handcrafted tests became a correctness hole.
- The ninth reviewer hit one platform content-filter false positive while describing ordinary structural mutation tests;
  the same read-only worker resumed with neutral data-integrity wording and completed without repository changes.
- During final helper refactoring, typecheck briefly failed on an over-narrowed test-wrapper result (`TS2339` at the
  selftest helper), then passed after the helper retained an explicit successful-result shape. This is an AAR trigger,
  not accepted evidence from the failed run.
- The `117/117` audit reproduced four defects despite every declared focused gate passing: authority omits consumed facts,
  intact scaled creators falsely refuse, omitted-width overflow diverges from shipped Helper, and 79 negatives stop at an
  earlier gate. Its first malformed-input harness also used the wrong provenance export before the corrected 54/54 and
  7/7 runs passed.
- Producer 8A.2 closed all original 15 root and 37 coordinated snapshot attacks but was still rejected: exact producer
  semantics/local identities/nil values falsely refuse, while nested kernel, provenance, union, transition, and height
  shapes can still pair-validate. Two oversized review stdin setups failed during parsing before seven split matrices
  completed. A coordinator documentation patch also missed one evolved handoff context and was reapplied in bounded
  file-specific patches; neither failure changed implementation files.
- Highest-risk weakness: handcrafted or incomplete producer fixtures can make a convincing exact-layout boundary green
  while accepting impossible state and refusing real source branches.

Do not bank a verified scene skill yet. Heuristic reconstruction is removed and the exact corpus is green, but the
bounded scene unit remains `PARTIAL` until a fresh independent audit is CLEAN.
