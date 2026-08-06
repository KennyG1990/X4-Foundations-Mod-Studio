# X4 Forge Extension-Native Capability Completion Program

Status: IN_PROGRESS / PARTIAL
Lane: FULL
Date: 2026-08-04

## PLAN

- **Bounded program:** complete the already-authorized native-capability program in the installed X4 Forge
  Antigravity/VS Code extension, beginning with native Sol-to-Luna routing proof, then W3 receipt execution
  authority, remaining native capability owners, installed-product proof, ledger reconciliation, and exact
  checkpoint commit/push parity.
- **Product boundary:** X4 Forge is the installed extension. Its Studio webview, managed loopback sidecar,
  authenticated Agent API, native IDE providers, and curated MCP bridge are internal extension components.
  A standalone/public web app, end-user Forge CLI, parallel analysis product, imported-result path, or
  comparison surface is out of scope. The previously proposed end-user CLI is **REJECTED**, not deferred.
  Repository build/test commands and Codex CLI diagnostics remain engineering tools only and are not Forge
  product capabilities.
- **Assumptions:** current repository and installed-product evidence supersede historical progress claims;
  unrelated dirty files remain user-owned; repository Markdown is implementation truth and GitHub is its
  public projection; no release publication is authorized by this program.
- **Authoritative references:** the user-supplied completion request; `AGENTS.md`; `BACKLOG.md`;
  `SESSION-HANDOFF.md`; `ROADMAP.md`; the W3/W3B0/W3B1 and pending-feature plans; StarForge
  `x4-forge/capability-map.md` and `x4-forge/decisions.md`; current source, tests, installed extension, and
  GitHub issues `#9`-`#21` and `#29`-`#37`.
- **In scope:** portable project Sol/Luna configuration and native-child proof; workspace-create, snapshot-
  restore, and bulk-transform receipt integration; independently bounded E2E terminal-verdict repair;
  W3B1b-d, W3B2, W3B3, W3C; remaining issue-owned native capabilities after reconcile; installed Antigravity
  behavior; repository/GitHub status parity; exact checkpoint commits and pushes after required gates.
- **Out of scope:** external/public analysis surfaces, user-facing CLI work, imported external analysis code/results,
  unrequested product comparison, real-game/mod writes without their separate write gate, provider spend,
  marketplace publication, and unrelated dirty files.
- **Risks and authorization boundaries:** receipt work touches concurrency, rollback, persistence, and secret-
  redaction contracts; E2E supervision can leak processes or touch live ports if containment is wrong; installed
  proof can disturb the operator's active Antigravity canvas; configuration is loaded at Codex app-server start.
  User authorization covers the exact project routing repair, validated global snapshot refresh if required,
  restart after preserving handoff state, implementation, validation, Git checkpoints, push, and remote parity.
  The mandatory machine-state ask still gates E2E, packaging, and installed UI work.
- **Rollback/checkpoint:** project routing rollback is deletion of `.codex/config.toml`; any global repair first
  receives a recoverable backup through the existing installer; each code subunit has exact-path Git rollback or
  its domain compensation/recovery owner; never reset, clean, or overwrite unrelated worktree state.

### Acceptance contract

1. The structural validator passes with the exact portable project config, fixed global V1 catalog selection,
   sole `luna_executor` role pinned to `gpt-5.6-luna` at `max`, and no fallback/concurrency cap.
2. A fresh native child is observed with `thread_source=subagent`, role `luna_executor`, model
   `gpt-5.6-luna`, effort `max`, V1 routing, and no parent-turn fork. Native routing is the only implementation
   lane; diagnostic CLI execution is not implementation evidence.
3. W3B1a closes all five receipt-required workspace mutations. Exact replay never mutates twice; changed facts
   conflict; paired content/snapshot CAS, recovery/compensation, receipt reopen/hash identity, history
   independence, redaction, and no-false-success negatives pass.
4. The E2E wrapper has an independent outer bound, captures the exact child tree before termination, requires a
   complete terminal JSON report plus complete receipt, proves every owned PID gone, and stays red for missing,
   malformed, incomplete, interrupted, timed-out, flaky, or bad results.
5. W3B1b-d, W3B2, W3B3, W3C and every still-applicable issue-owned native capability meet their repository
   acceptance contracts without adding a rejected parallel-analysis or CLI surface.
6. Required static, focused, integration, negative, runtime, E2E, production, package, staged-sidecar, installed
   Antigravity visual/interaction, writer/capability/MCP/receipt, and remote-parity gates pass. Any unavailable
   required layer yields PARTIAL/BLOCKED, never VERIFIED.
7. Repository plans, `BACKLOG.md`, `ROADMAP.md`, `SESSION-HANDOFF.md`, capability/AAR ledgers, and GitHub issue
   bodies/states agree. Historical CLI wording is corrected prospectively without rewriting historical evidence.
8. Every verified checkpoint is staged by explicit paths, committed, pushed, and proven
   `HEAD == origin/main == remote main`. No unrelated dirty path enters a commit.

### Required validation and negative paths

- Sol/Luna structural validator plus native child metadata/readback.
- Focused receipt/selftests and route fault injection for replay, changed facts, stale paired CAS, history failure,
  finalization failure, compensation/rollback failure, traversal/link escape, secret/path redaction, response
  deadline, and same-resource concurrency.
- E2E verdict pure tests plus real supervised close/hang/incomplete-report fixtures under an independent parent
  deadline; exact process/port/temp/live-state containment checks.
- `npm run typecheck`, zero-error lint, runtime oracle sweep, route integration, `npm run build`, extension build/
  stage/package/inspect/probe, `npm run precommit:check`, and Graphify refresh.
- Full isolated `npm run test:e2e` only after the operator confirms Antigravity/game/machine state; workers remain
  serial and ports 3000/3001 and the live workspace must remain byte/state unchanged.
- Real installed Antigravity inspection for every user-visible or interaction claim; screenshots/machine receipts
  live under `vscode-extension/evidence/`.

## BASELINE

- Revision: `c6e52f9be76cb9fbb9ac3bf9c5bd4c9d8f83a27d`; local `HEAD`, `origin/main`, and remote main match.
- Existing relevant implementation: W3A and W3B0 VERIFIED; W3B1 workspace replace/merge route-green; create,
  restore, bulk, W3B1b-d, W3B2/B3/C remain open. The prior E2E supervisor candidate is FAILED/REVERTED and must
  not be resurrected.
- Routing continuation: the portable project `.codex/config.toml` is restored with only the Sol model/effort and
  V1 feature flags. The structural validator passes against the fixed global catalog and sole Luna role, and a fresh
  native child readback proves `thread_source=subagent`, `luna_executor`, `gpt-5.6-luna`, effort `max`, V1 routing,
  and no parent-turn fork.
- Dirty baseline: pre-existing modified/deleted/untracked paths listed in `SESSION-HANDOFF.md` are preserved. No
  candidate config or product-code change existed when this plan was written.

## RECONCILE

- `WorkspaceRegistry`, `WorkspaceReceiptService`, W3A receipt/store/runtime, W3B0 policy bundle, Agent History,
  CAS/recovery owners, and bulk/snapshot route owners already exist. Extend them; do not build parallel stores,
  registries, transaction kernels, provider surfaces, or receipt schemas.
- Graphify places `WorkspaceReceiptService`, `WorkspaceRegistry`, `actionReceipt*`, workspace state/identity, and
  the service selftest in the same execution cluster. Workspace-create result identity belongs in validated
  terminal after-state, not caller intent.
- The installed extension and native Antigravity tabs are already the product/editor authority. Historical
  `UI, CLI, MCP, Agent API` parity wording conflicts with the now-explicit extension boundary; the delta is a
  rejected end-user CLI, while internal API/MCP remain extension-owned adapters.
- Capability-map delta is required only for newly verified execution/surface facts and the prospective CLI-boundary
  correction; no duplicate capability is to be added.

## IMPLEMENTATION ORDER

1. Restore and validate the exact project Sol/Luna config; prove a fresh native Luna child before product code.
2. Implement workspace-create receipts, then snapshot restore, then bulk apply through existing owners.
3. Repair E2E supervision under an independent timeout/tree-disappearance oracle; close W3B1a gates.
4. Complete W3B1b-d, W3B2, W3B3, and W3C in dependency order.
5. Reconcile and implement only still-missing native issue capabilities; reject CLI and parallel-analysis scope.
6. Run installed Antigravity proof, synchronize durable/GitHub ledgers, and close checkpoint Git parity.

## IMPLEMENT

- W7's native engine merge-law/schema-routing unit is now `VERIFIED`. Reconciled code routes diff-rooted MD/AI
  through merged diff+domain schemas and skips those roots in dedicated validators, preventing wrong-schema duplicate
  findings while preserving the merged validation path.
- W7 exact evidence: X4 9.00 build `611726` / Steam `23660954`; run
  `test-results/x4-merge-law-oracle/w7_20260805_a97e2186_03`; 11/11 markers; 9/9 semantic cases; focused 898
  assertions; schema 143/143; particles 544/544; diff overlay 60/60 over 176 official diff files; routes 443/443;
  oracle 131/131; `npm run precommit:check` OK; full E2E 96/96; and package probe 16/16. Installed Antigravity
  proof is recorded under `vscode-extension/evidence/2026-08-06-w7-schema-routing-installed`: schema
  events/conditions/actions 402/35/807, corpus factions/wares/sectors 32/1902/170, rendered MD/AI counts 1507/1408,
  2333 script properties, validator rendered with 2 blocking errors and 5 warnings from genuine mod debt, and no
  `Failed to fetch`.
- W7 closes only this native engine merge-law/schema-routing unit. Its immediate checkpoint Git/GitHub parity is
  closed at pushed commit `1c912cf28bfe62509ba4ece06553949e514555b6`, with `#11`/`#18` readback complete. W3
  remains 3/5; lifecycle 96/96 is verified, while snapshot restore, bulk apply, and route-specific receipt,
  finalization, compensation, fault-injection, and real-child acceptance remain open. All later program units and
  gates remain open.

- W10's bounded data-only rule/evidence-pack authority and its blocking Lua Unicode registration-analysis repair are
  now `VERIFIED` as a checkpoint; W10 overall remains `OPEN / PARTIAL`. The rule-pack hash is
  `351cb0199c815df91861205bf0bce85b22ed98f1bb695dcaa9345f5001e2f9c0`, and it binds existing `XSD_`,
  `md_lua.missing_register`, and `lua_md.missing_listener` diagnostics without creating a duplicate detector.
  Project-crossfile selftest is `25/25`; the rule-pack selftest is `32/32`; the real read-only 26-file mod result is
  Verdict `VALID`, cross-file errors `0`, missing Lua registers `0`, missing MD listeners `0`, project-rules errors
  `0`, and four unrelated scriptproperty warnings. The pre-repair result was `77` false
  `md_lua.missing_register` errors from pseudo-latin1 rejection on U+2014 in unrelated prose plus swallowed parse
  unavailability.
- W10 supporting evidence is `npm run test:oracles` exit `0` with runtime-index discovery and `131/131` green on the
  isolated `127.0.0.1:8972` harness, including diagnostic-explain `8/8`; typecheck and build exit `0`; lint is
  `0` errors / `593` warnings overall with the owned parser subset at `0` errors / `7` warnings; and Graphify is
  `5,541` nodes / `13,555` edges / `215` communities. A raw oracle sweep invoked without its required server
  returned `0/130` fetch failures and is recorded only as a harness-invocation AAR, not product evidence.
- W10 closes the native data-only authority/availability slice recorded above; that earlier slice intentionally did
  not include guidance/server/UI integration or installed-product proof. The dated dependent-batch delta below now
  records those capabilities and the lifecycle repair. Broader rule families, update lifecycle, and W11 remain open.

- 2026-08-06 W10 dependent guidance/lifecycle delta: the existing diagnostic explanation and Why panel now expose
  governed matched, unmatched, unavailable, and ambiguous provenance with pack/rule IDs and versions, pack SHA,
  evidence grade/basis/digest, applicability, game scope, deterministic fallback, candidate refusal, and
  `deterministic, no AI` parity. Uppercase `XSD_` matching and the existing `scriptproperty` fallback remain intact.
  The existing server registry exposes `x4-rule-packs-selftest`; direct diagnostic explanation is `16/16`, rule pack
  is `32/32`, and focused lifecycle tests are executor `9/9`, command `6/6`, async `10/10`, runner lifecycle `12/12`,
  and runner integration `13/13`.
- The bounded lifecycle repair accepts a failed command only after a fresh exact-identity recheck proves
  `treeGone=true`. The preserved red receipt remains the reproduced lifecycle failure; the isolated green receipt
  proves product `96/96`, `complete=true`, `treeGone=true`, `trigger=child-close`, clean ports `3100/3101`, absent
  root PID, and unchanged live workspace.
- Package/stage/probe/inspection passed for the `0.0.63` extension package. Installed bits match staged hashes, and
  the rendered evidence separately proves governed XSD provenance and the `x4_ai_influence` validation/restored
  state. The retained `47`-error image is not used for a same-mod before/after claim. Supporting typecheck/build,
  lint `0` errors / `593` warnings, runtime oracle `132/132`, Graphify `5,548` nodes / `13,586` edges /
  `222` communities, and final precommit `[precommit] OK` are recorded in the bounded plan.
- This dependent unit is `VERIFIED` only as a bounded W10 checkpoint. W10 remains `OPEN / PARTIAL`; the overall
  extension-native program remains `IN_PROGRESS / PARTIAL`. The exact `17`-path implementation checkpoint is
  commit `590308e46867817467262bc83b6ba34295fec271`, subject
  `feat(validation): surface governed rule provenance in Forge`; its enforced hook passed, push
  `main -> origin/main` succeeded, and read-only parity proves `HEAD == origin/main == remote/main` at that hash.
  Independent readback found `#9`, `#10`, and `#18` open with one implementation-ledger block, the full hash, and
  `Status: IN_PROGRESS / PARTIAL` each. `#10` remains the canonical W10 owner; `#9` is the parent and `#18` the
  no-gap projection. Only the documentation mirror commit remains pending.

- Native Sol/Luna routing is restored and independently proven; diagnostic CLI execution was not used as product-
  code implementation evidence.
- The workspace-create adapter now extends the real `WorkspaceRegistry`, `WorkspaceReceiptService`, W3A store, global
  registry resource, and exact `compensateCreate` owner. Its focused oracle passes 16/16 for complete registry facts,
  canonical committed/applied authority, redaction, exact replay, replay after mutable-origin change, changed-fact
  conflict, distinct W3A client identity, operation-ID/deadline/full-registry refusal, global serialization,
  finalization compensation, compensation-fault incomplete truth, and authoritative-reopen failure. Root typecheck
  passes.
- Coordinator review reproduced and corrected one replay defect before route integration: the first candidate compared
  the stored original pre-state hash to the newer current registry hash. First execution remains strict, while replay
  now compares stable resource identity and verifies the stored aggregate before-hash against its own stored resources.
- `server.ts` now routes Studio workspace creation through that adapter, and the route harness contains one coherent
  set of missing/malformed-operation, committed receipt readback, replay, changed-fact conflict, distinct-client,
  registry-delta, compensation, and redaction assertions. Typecheck and the 16/16 adapter selftest pass. After the
  operator authorized quiet-machine Antigravity validation, a fresh production build plus the external HTTP harness
  passed 443/443. Its task temp root was removed, ports 3000/3001/3100/3101 remained free, the exact worktree
  fingerprint was unchanged, and `HEAD == origin/main`. Workspace-create is therefore runtime-green as the third of
  five W3B1a workspace routes; snapshot restore, bulk apply, and the W3B1a E2E close remain open.
- The rejected E2E candidate remains absent. A strengthened v2 supervision contract is now documented in the W3B1
  plan with an independent parent oracle, bounded pre-termination tree capture, strict report completeness on every
  close path, receipt readback, and mandatory `treeGone` proof.
- The first replacement E2E slice is now implemented without reviving the rejected supervisor: one pure terminal
  JSON inspector independently derives every test outcome, requires exact stats agreement, rejects incomplete retry
  sequences, and forces global reporter errors red. Coordinator review reproduced and corrected a false-green where
  top-level Playwright errors were ignored. The corrected contract passes 17/17 adversarial probes and is integrated
  into the runner's normal-close receipt path; all original 26 pure checks plus nine strict checks pass 35/35.
  The process safety foundation now parses bounded Windows WMIC and POSIX `ps` snapshots with PID, parent PID, and
  creation-token identities (37/37), then captures both initial and repeated monotonic ownership. Repeated snapshots
  preserve absent identities, seed from exact active reparented descendants, discover later generations, refuse to
  follow reused PID occupants, and inspect exact disappearance; that pure contract passes 30/30 plus coordinator
  adversarial probes. One shared command adapter bounds WMIC/`ps` execution, sanitizes every failure, kills only its
  own timed-out snapshot helper, uses fail-closed platform dispatch, and passes 30/30 ten consecutive times plus
  sanitized current-host WMIC readback. A separate pure termination planner now orders exact active identities
  deepest-descendant first without recursion; it passes 21/21 ten consecutive times, including a 50,000-row chain.
  The pure two-plan recheck now passes 18/18: exact prepared
  plans are validated and cloned, captured identity must be monotonic, hostile/malformed shapes fail closed, and a
  target is authorized only when the immediate second plan discovers no new child and retains the same first exact
  PID+creation token. Its async wrapper passes 10/10 with bounded injected snapshots and exact one/two-capture call
  counts for first-gone, stable, new-child/target-loss replan, second-gone, invalid, and capture/plan failure paths.
  The exact Windows command owner now passes 6/6: it invokes only `taskkill.exe` with
  `['/PID', String(pid), '/F']`, never `/T`, bounds helper and outer time/output, sanitizes every result, and refuses
  POSIX with `termination-command-identity-insufficient`. The finite executor passes 8/8 and requires an immediate
  stable two-snapshot recheck before each exact command, replans for a late child, commands each PID+creation-token at
  most once, and accepts success only after a later fresh snapshot proves `treeGone`. Coordinator fresh-eyes review
  found that consistent proxies were caught but not expressly rejected; a targeted Luna correction now uses
  `node:util`'s supported proxy detector and permanently covers top-level, target, and nested-option proxies. Graphify
  was refreshed to 4,850 nodes / 11,782 edges / 196 communities. POSIX `ps lstart` is second-granularity, so the
  accepted command owner explicitly fails closed there until a stronger identity token exists.
  A thin spawned-ownership composition owner now establishes the spawned PID's exact root token from the accepted
  snapshot adapter, captures the accepted initial closure, and advances only through the accepted repeated closure.
  Its injected no-process selftest passes 8/8 five consecutive times for initial/late descendants, root loss with a
  reparented child, PID reuse, hostile zero-call input, sanitized snapshot failures, no-callback timeout/helper cleanup,
  and bidirectional mutation isolation. Fresh-eyes review corrected malformed option values to reject as sampler
  invalid input before any await. The lifecycle coordinator now consumes that owner plus the exact disappearance
  executor under independent outer and report-grace timers. Its no-process oracle passes 12/12 five consecutive times;
  the runner's strict completion gate passes 46/46; and a fake-child integration oracle passes 7/7 five consecutive
  times without launching a process. Normal close and report-grace recovery can become green only with complete report,
  complete ownership, and exact `treeGone`; outer deadline, child error, interaction failure, incomplete report,
  malformed lifecycle, and termination failure remain red while bounded valid cleanup facts are preserved. The full
  static bundle and typecheck pass, with lint at the established 0-error / 592-warning baseline. Atomic schema-v2
  receipt reopen/content verification and the independent real-child parent oracle remain open. Graphify refresh
  follows the completed receipt slice.

- 2026-08-06 W10 nested script-property path-resolution and integrated health-card safe-area delta: the existing
  native validator now traverses authored ordered nested paths with datatype transitions and inheritance, retains all
  datatype candidates beyond conservative project-symbol hints, and keeps empty/unavailable selector remainders
  opaque. Script-property selftest is `61/61`; schema intelligence `168/168`; typecheck `0`; focused lint `0`; route
  integration `449/449`; runtime oracles `132/132`; and the read-only `26`-file target validation is `VALID` with
  structural/unresolved/cross-file `0`, schema `0/0` with both schemas loaded, AI-script `0`, and script-property
  warnings/findings `0/0` in the bounded result.
- The focused health-card safe-area E2E is `1/1` after a delayed `2.5s` health response exceeded the `1.5s` helper;
  the card became visible, accepted a normal unforced click, stayed clear of the right tool rail and bottom
  navigation, and closed with `treeGone` and ports clean. Full E2E is `96/96`, failed `0`, flaky `0`, complete,
  `complete=true`, `trigger=child-close`, `treeGone=true`, empty `remainingPids`, and closed ports `3100/3101`; receipt
  `test-results/e2e-verdict.json` was generated `2026-08-06 13:31:43Z`.
- Root and extension builds, stage-app, secrets-clean, and staged package probe `16/16` are green. The package is
  `F:\DEV_ENV\X4_Forge\vscode-extension\x4-forge-studio-0.0.63-scriptproperty-path-resolution-20260806.vsix`,
  `18,076,422` bytes, SHA256
  `15CAA66FEDA0D1C1D087FA3E7635300A106E8EADD8020A9A3A9029E22412705E`, with inspector PASS at `2091` entries /
  `61,322,134` unpacked bytes. Graphify is refreshed at `5572` nodes / `13642` edges / `217` communities.
- Installed rendered observation reports Forge `v1.0.424`, Mission Director `1507` elements loaded, AI-script `1408`,
  script properties `2333`, and safe-area placement clear of current chrome. Installed script-property selftest is
  `61/61`; critical file parity is `7/7`; normalized manifest parity passes after excluding injected `__metadata`;
  and installed-sidecar `fromPath` validation reports `ok=true`, `26` loaded files, structural/unresolved/cross-file
  `0`, missing registrations/listeners `0/0`, schema `0/0`, AI-script `0`, script-property warnings/findings `0/0`,
  rules errors `0`, with both schemas and script-property data available. The target import preview contains `116`
  selected files and `2925` graph nodes; the manifest workspace renders as `x4 AiLive` with readiness `VALID` and
  `0` errors / `11` warnings.
- This is a bounded verified prerequisite only. The two active `.ware.name` warnings (five duplicate raw reference
  findings) are the already-recorded ROADMAP `KB-3` `reference.unknown_ware` false positive, not a new regression and
  not fixed here; the overall validation is not called warning-free. W10 remains `OPEN / PARTIAL`, W3 remains
  `PARTIAL` at `3/5`, and the overall extension-native program remains `IN_PROGRESS / PARTIAL`. No broad lifecycle or
  provenance claim, version bump, marketplace publication, mod/game write, or deploy is made. Git/GitHub close remains
  pending coordinator reconciliation.

## CLOSE

- Current status: IN_PROGRESS / PARTIAL. W7's native engine merge-law/schema-routing unit is `VERIFIED`, and W10's
  bounded data-only rule/evidence-pack plus Lua Unicode availability checkpoint is also `VERIFIED`, with the exact
  evidence recorded above. The later bounded W10 rule-provenance guidance and lifecycle-race repair checkpoint is
  likewise `VERIFIED` as recorded in the dated delta above. W10 overall remains `OPEN / PARTIAL`. W7's exact engine, oracle, route, package, E2E, and
  installed Antigravity evidence is recorded above. Its immediate
  checkpoint Git/GitHub parity is closed at pushed commit `1c912cf28bfe62509ba4ece06553949e514555b6`, with `#11`/
  `#18` readback complete. Native routing is proven; W3B1a remains 3/5 and lifecycle 96/96 is verified, while
  snapshot restore, bulk apply, and route-specific receipt, finalization, compensation, fault-injection, and
  real-child acceptance remain open. Later W3 units, W3C installed proof, and other program gates remain open.
- Checkpoint: pushed commit `1c912cf28bfe62509ba4ece06553949e514555b6` with subject
  `feat(x4): prove merge laws and harden mutation receipts`.
- W10 provenance checkpoint: pushed commit `590308e46867817467262bc83b6ba34295fec271` with subject
  `feat(validation): surface governed rule provenance in Forge`; enforced hook, `main -> origin/main`, exact
  `HEAD == origin/main == remote/main` parity, and open issue `#9`/`#10`/`#18` readback passed. The index is empty,
  unrelated dirty paths remain preserved, and the documentation mirror commit is still pending under suggested title
  `docs: record W10 provenance checkpoint parity`.

## AAR

- Triggers present: the missing project config invalidated earlier native-routing assumptions; multiple workers
  produced no meaningful code while that baseline was red; and the first create-adapter replay oracle reproduced a
  lifecycle-versus-intent comparison defect before route integration. Fresh-eyes E2E review also reproduced a
  global-reporter-error false green, and later process-contract workers again stayed running without writes.
- Sustain: preserve exact native role/model/effort and fail rather than substituting an executor.
- Improve work/approach: proving routing first and decomposing the create adapter into small owner-specific slices
  restored productive native Luna execution; keep finalization/compensation separate from route wiring.
- Improve tools: CLI diagnostics may diagnose routing but must never be counted as Forge capability or Luna
  implementation evidence.
- Improve tools: never dump the global Codex config to inspect routing keys. One read-only command emitted an existing
  configured credential into private tool output; it was not used or written to the repository. Future checks select
  only the exact non-secret fields, and the credential owner must rotate the exposed value.
- Highest-risk evidenced weakness: three W3B1a mutation routes and later W3 owners still lack authoritative
  execution receipts; post-response history cannot substitute for terminal transaction truth.
- Triggered: one broad disappearance-executor test worker was closed before completion and then landed a valid late
  file. The coordinator froze overlapping work and reviewed the settled bytes before assigning a successor. One
  initial fixture also mislabeled a reused child PID/token as unrelated, exhausted its injected snapshot queue, and
  was corrected to a truly unrelated PID. Keep late-writer and fixture-identity checks explicit.
- Triggered: fresh-eyes review found the command and executor caught proxy traps but did not reject a consistent
  proxy as their strict contracts claimed. The targeted correction uses `node:util` proxy detection and durable
  regressions; command 6/6, executor 8/8, async recheck 10/10, runner 35/35, and typecheck are green afterward.
- Triggered: coordinator review caught a lifecycle fail-open that omitted composition failure from final completion,
  then caught runner defects that collapsed valid outer-deadline cleanup evidence, leaked an anonymous error listener,
  and erased valid lifecycle facts after a diagnostic interaction failure. Targeted Luna corrections and the durable
  12/12, 46/46, and 7/7 oracles now cover those paths.
- Triggered: a delayed pre-compaction worker notification caused one duplicate identical assignment; the duplicate made
  no edit and was closed. Several broad or late-write workers and one read-only fresh-eyes reviewer stalled; scopes were
  decomposed, overlapping writes were frozen, and only settled reviewed bytes were accepted. One local read-only search
  also used a Windows-incompatible `rg` glob before the corrected `-g` form succeeded.
- Triggered: two progressively smaller spawned-ownership workers and one initialize worker stayed running without a
  write and were closed with no residue. Fail-closed scaffold, validators, initialization, repeated sampling, and the
  8/8 selftest were produced through serial native Luna micro-slices. One work-order script failed before spawning due
  to an unescaped delimiter; the corrected spawn wrote normally. No fallback writer was used.
- Triggered: coordinator lint first targeted the whole dirty checkout and correctly hit unrelated staged-install
  bundles. The exact project contract is `npm run lint` over `src` and `server.ts`; that gate passed with 0 errors and
  592 warnings. Both task-owned temp reports were removed after readback.
- Triggered: the first Windows parser passed synthetic checks but failed the real WMIC probe because this PowerShell
  host carries `CRCRLF` separators. The exact native Luna correction strips bounded trailing carriage-return runs;
  37/37 checks and current real-WMIC readback are now green. A broad tree-contract worker and one earlier parser
  worker remained running without writes and were closed before any late edit; smaller one-function assignments
  produced the accepted parser and initial-closure files.
- Triggered: two progressively smaller adapter workers stayed running without creating their sole target and were
  closed with no residue. A third mechanical production-only order wrote the accepted bounded Windows owner; serial
  Luna slices then added its tests, shared POSIX execution, durable POSIX checks, and one generic dispatcher. This
  preserved the native-only rule and produced 30/30 stable adapter checks instead of substituting a writer.
- Triggered: coordinator fresh-eyes review found a test-only 160 ms wall-clock assertion that could fail under event-
  loop starvation even when the adapter timer was correct. A targeted Luna correction replaced it with a cleared
  one-second watchdog; ten consecutive full selftests pass. One coordinator probe command also failed before Node
  ran because its PowerShell here-string was wrapped in invalid JavaScript; the corrected read-only invocation passed.
- Highest-risk evidenced weakness: POSIX `ps lstart` exposes only second-granularity start time. The adapter is safe
  for read-only capture, but future target termination must use stronger POSIX identity or remain fail-closed there.
- Triggered: a broad termination-planner worker and two progressively smaller stable-target/recheck workers remained
  running without creating their sole targets. The planner succeeded only after decomposition into production logic
  and a separate test worker. A fresh continuation decomposed the recheck into fail-closed production and test-only
  slices; the pure contract is now 18/18. Coordinator review corrected an O(n-squared) consistency scan and a missing
  plain-object guard. Serial async slices then completed the bounded wrapper at 10/10. A closed broader test worker
  landed a late helper while a successor edited the same tail; independent rerun exposed the settled 3/3 state, and
  one final tail-only worker restored deterministic 4/4 before failure checks extended the suite.
- Triggered W10 tooling fact: a raw `node scripts/oracle-sweep.mjs` invocation without a server on `localhost:3001`
  exited `1` with `0/130` fetch-failed rows. This is a harness-invocation failure, not a product finding, and was not
  relabeled green.
- Corrected W10 validation: the owning `npm run test:oracles` isolated harness used runtime-index discovery at
  `127.0.0.1:8972` and returned `131/131` green, including project-crossfile `25/25` and diagnostic-explain `8/8`.
  Build exited `0`; lint exited `0` with `0` errors / `593` warnings overall and the owned parser subset at `0`
  errors / `7` warnings; Graphify exited `0` at `5,541` nodes / `13,555` edges / `215` communities.
- Highest-risk W10 weakness: validator unavailability must never become either a clean result or an empty registration
  set that manufactures `md_lua.missing_register`; the reproduced cause was pseudo-latin1 rejection on U+2014 plus
  swallowed parse unavailability, not a `StringLiteral.value`-only defect.
