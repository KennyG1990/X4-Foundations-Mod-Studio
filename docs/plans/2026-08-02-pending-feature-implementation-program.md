# X4 Forge pending-feature implementation program

Status: IN_PROGRESS; W3A and W3B0 VERIFIED, implementation continues with W3B1
Lane: FULL
Inventory cutoff: 2026-08-02
Owner: active Sol coordinator; implementation code is delegated only to native `luna_executor` workers
Current documented status report: `docs/plans/2026-08-02-original-pending-issues-status-report.md`

Product boundary correction (owner, 2026-08-02): **X4 Forge is the Antigravity/VS Code IDE extension.** Its bundled
Studio panel (`dist/index.html`) and extension-managed sidecar (`dist/server.cjs`) are implementation parts of that
one product, not a standalone web application. Forge has no end-user CLI product. Repository scripts and the
sidecar API remain internal build, validation, and extension plumbing; they are not separate user experiences or
delivery targets. Forward work must ship through and be proven in the installed IDE extension.

Native capability correction (owner, 2026-08-03): **Forge will not bridge to, execute, configure, or display results
from an external analysis product.** Every accepted X4 mod-analysis capability must be implemented natively in Forge
or be superseded by a measured stronger native Forge capability. No external executable is a runtime dependency,
subprocess, result source, referee, or alternate product. The earlier W5 external-provider and W6 adapter/comparison
design is rejected and superseded by the native capability contract below.

## PLAN

- Bounded program: implement, validate, document, and synchronize every non-duplicate GitHub issue that was open in
  `KennyG1990/X4_Forge` at the inventory cutoff. Repository plans, evidence, `BACKLOG.md`, `ROADMAP.md`, the capability
  map, ADRs, and AAR ledgers remain implementation truth; GitHub is the public projection.
- Current canonical owner set: `#8`, `#9`-`#22`, and `#29`-`#36`.
- Duplicate mirrors: `#23` and `#26` mirror `#8`; `#24` and `#27` mirror `#9`; `#25` mirrors `#22`. They receive
  duplicate disposition and links to their canonical owners, never separate implementations.
- Closed `#37` is outside the pending set. New issues produced by research `#36` are not silently added to this
  cutoff program: each requires its own bounded approval and plan.
- Critical path: W3 receipt authority -> W4 reproducible artifact truth -> W5 native capability contract -> W7
  engine merge-law oracle -> W8-W13 shared truth -> W14-W18 native product capabilities -> recorded review stop ->
  W19-W20 controlled mutation/network intelligence -> W6 native no-gap acceptance and W21 final extension parity.
- Independent UX and Kimi units are interleaved only where they do not delay the critical path or overlap write
  scopes. Easy visible work may not displace W3 or the running-X4 gates.
- The owner rejected Kimi R18 / GitHub `#30` as a product direction: no packaged/headless CLI will be implemented.
  K30 is now a ledger-disposition unit only. This correction supersedes every older all-surface or CLI-parity phrase
  in this program.

### Assumptions and unresolved facts

- `main`, `origin/main`, and the remote `main` were all
  `ce5266a34ed7c560bd6d98e409251c90b1b9430e` at baseline.
- The current dirty paths listed below belong to the user or another task. No unit may reset, clean, overwrite, or
  stage them unless its own reconciliation proves an unavoidable overlap and preserves the prior bytes.
- Antigravity is running; X4 is not running; the machine is quiet. Source, isolated runtime, package, and rendered
  Antigravity gates are available. Running-engine proof is unavailable until X4 is launched.
- `#35` therefore cannot close tonight. It remains PARTIAL without blocking units whose acceptance contract does not
  require a running game.
- `#8` had an intentionally terse GitHub mirror. Its authoritative Discord source says: add a small toolbar toggle
  between full visual card nodes and a compact list/grid view for complex MD cue structures, targeted at 50+ cues.
- `#22` is not an implementation gap in current source. The explicit root selector and route negatives already exist;
  this is ledger drift and must be revalidated before closure rather than rebuilt.

### Authoritative references

- `AGENTS.md` and `UNIVERSAL_AI_TASK_WORKFLOW.md`.
- `F:\StarForge\wiki\x4-forge\decisions.md`, especially ADR-F1 through ADR-F5.
- `F:\StarForge\wiki\x4-forge\capability-map.md`.
- `docs/plans/2026-07-31-capability-convergence.md` and its W0-W2B close evidence.
- `docs/plans/2026-07-29-kimi-recommendations-ledger.md`.
- GitHub issues `#8`, `#9`-`#22`, and `#29`-`#36`; Discord thread `1531784030889054350` for `#8`.
- X4 XSDs, unpacked vanilla/DLC corpus, and controlled engine evidence for domain truth.

### In scope

- Planning records and one bounded implementation/validation/close cycle per executable unit.
- Source, tests, isolated fixtures, build/package/install evidence, and rendered Antigravity interaction.
- GitHub owner issue updates in the same task as repository status changes.
- Commit and push only after the applicable precommit, evidence, review, and documentation close gates pass.
- The installed extension, its embedded Studio panel, native IDE controls/editors, optional extension-managed MCP
  lifecycle, and the extension-owned sidecar behavior required to support those surfaces.
- Native Forge implementations for every accepted X4 capability in the matrix below, using the existing
  validator, corpus, workspace, history, artifact, diagnostics, registry, and extension surfaces rather than a
  external bridge or parallel engine.

### Out of scope and authorization boundaries

- No public marketplace release unless a later user-facing unit explicitly reaches the publish gate and the project
  release policy authorizes that exact release.
- No real mod/game-directory write when an isolated fixture proves the contract. Running-X4 proof uses a scratch or
  reversible probe only.
- No new spend or upstream-network execution until its planned unit has a verified meter, limit, credential boundary,
  timeout, and failure behavior. Existing AI-provider paths remain governed by their current chokepoint; this does not
  authorize an external analysis-provider framework.
- No source-writing semantic rebase or network-driven update action before the Phase 2 review stop and recorded user
  decisions.
- No wholesale parallel-engine copy, replacement Forge shell, second workspace/history/permission engine, or generic
  dispatcher that bypasses the canonical capability contract.
- No external analysis-provider contract, external executable/subprocess, external installation/configuration UI,
  imported findings, side-by-side verdicts, disagreement reports, or optional-referee mode.
- No standalone browser product, packaged/headless end-user CLI, or parity work whose only purpose is to expose a
  second product surface outside the IDE extension.

### Native X4 mod-analysis capability contract

The capability inventory below is reconciled against existing Forge owners before implementation. `#18` owns the
no-unexplained-gap acceptance ledger; implementation remains in the existing canonical child owners so this contract
does not create duplicate engines or surfaces.

| Native capability | Required native Forge implementation | Canonical owner/unit |
|---|---|---|
| Exact selector, guard, extension-path, reference, and completeness validation | Strengthen `runProjectValidation` over an engine-proven Effective Tree; fail explicitly when relevant sources are incomplete | `#11` W7-W9, `#10` W10-W11, `#15` W16 |
| Effective values and per-attribute provenance | Native content-addressed Effective Tree, exact install/profile inventory, provenance queries, and installed-extension views | `#11` W8-W9, W18 |
| Collision and candidate analysis | Native structural and advisory behavioral Forensics Center over loose and packed active-profile content | `#12` W14, W18 |
| Cross-file caller, listener, and cue tracing | Native cross-file MD/AI script reference index and provenance-backed queries | `#12` W14, W18 |
| Effective-game balance statistics | Native advisory statistics grounded in the selected profile's effective values; never an uncited balance verdict | `#12` W14, W18 |
| Near-duplicate content detection | Native evidence-labelled similarity analysis with explainable factors and no automatic removal claim | `#12` W14, W18 |
| Semantic mod-version comparison and local-edit recovery | Native semantic source/upstream/local/effective diff, followed only after review by staged receipted rebase | `#16` W17/W19 |
| Installed-mod triage | Native immutable local mod registry first; separately authorized opt-in Nexus/Steam/GitHub freshness intelligence later | `#17` W8/W20 |
| 7.x-to-9.x migration checks | Native Compatibility Lab with cited version rules and reviewed migration manifests | `#13` W15 |
| Debug-log triage and known-good baseline | Native Runtime Oracle with exact log-session fingerprints, attribution, and static-to-engine evidence | `#14` W12 and `#35` |
| Vanilla-analogue completeness and scaffolding | Native completeness service and cross-file scaffold previews using the legal local corpus | `#15` W16 |
| Write guards, backups, and baseline safety | Native receipts, rollback/recovery, deterministic artifacts, and existing Forge permission boundaries | `#20` W3-W4 |

Acceptance for `#18` requires every row to be `VERIFIED` in native Forge code and reachable through the installed IDE
extension where it has a user surface. A capability is not delivered by metadata, a wrapper, an imported report, an
external process, or a side-by-side comparison. External analysis code is absent from the shipped dependency graph
and runtime process tree.

### Program risks and recovery

- Highest blast radius: receipt enforcement can turn an observational history failure into an operation failure.
  W3 separates optional history projection from authoritative action receipt persistence and requires pre-state
  recovery before any irreversible mutation.
- Engine-model risk: current multi-match selector behavior may disagree with X4. W7 is a hard authority gate; W9 may
  not claim Effective Tree truth before it passes.
- Installed-host risk: source/build success does not prove a responsive or correctly rendered extension. Any shipped
  surface change must pass staged package inspection, exact installed-file parity, and real Antigravity interaction.
- Dirty-tree risk: per-unit patches, path ownership, `git diff -- <owned paths>`, ignored fixture roots, and exact
  before hashes are the rollback boundary. Revert only task-owned hunks if a unit fails.
- Destructive/runtime risk: use temporary data roots, temporary workspaces, ephemeral ports 3100/3101, and scratch
  extensions. Verify the ephemeral stack stops and live 3000/3001 state remains unchanged after E2E.

## BASELINE

- Revision: `ce5266a34ed7c560bd6d98e409251c90b1b9430e`; `main == origin/main == remote main`.
- Existing modified paths: `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`, and two existing extension evidence
  PNGs.
- Existing deleted paths: two `data/*.json` files, `docs/DISCORD_BOTS_AND_GAMES.md`, and five Discord/support scripts.
- Existing untracked paths: two issue templates, `Note for Kimi.md`, and the R8/R17 Antigravity screenshots.
- Runtime state: Antigravity window `Untitled (Workspace) - Antigravity IDE - X4 Forge Studio` is open; X4 is off.
- Checkpoint: Git revision plus exact dirty-path inventory above. Each unit adds an isolated fixture/evidence directory
  before mutation.

## RECONCILE

### Pending issue disposition

| Owner | Current truth | Planned unit and dependency | Primary source/write surfaces | Required close proof |
|---|---|---|---|---|
| `#8` | OPEN; source Discord requirement recovered | U8 after W3, independent | `src/components/Canvas.tsx`, `src/types.ts`, layout preference helpers, canvas E2E | 50+ cue fixture, full/compact toggle preservation, selection/wires/actions, wide+narrow Antigravity |
| `#9` | PARTIAL parent | W3-W21 parent, closes last | convergence plan and child ledgers | every child disposition, every native capability-matrix row, and final installed-extension task proof |
| `#10` | PARTIAL/disconnected rules | W10-W11 after W7/W9 evidence truth | `projectRules.ts`, `diagnosticExplain.ts`, quick-fix/guarded-write engines, new data-only rule-pack modules | schema/fixtures, deterministic explanations, three transactional fixes, ambiguity refusals, all applicable extension surfaces |
| `#11` | PARTIAL/non-authoritative | W8-W9 after W7 | CAT/DAT readers, diff simulator, new profile/effective-tree/provenance modules | loose+packed profile fixtures, skipped-source incompleteness, who-set chain, engine op parity |
| `#12` | PARTIAL subsets | W14 after W9/W13 | Extension Doctor, dependency/override/reference indexes, new forensics service and panel | canonical-node conflicts, benign unions, packed mods, advisory behavioral overlap |
| `#13` | PARTIAL | W8 + W15 after W9-W13 | schema/corpus/patch-readiness engines, profile store, Compatibility Lab | cited version-only breaks, reviewed migration manifest, no uncited warnings |
| `#14` | PARTIAL | W12 after W3/W8/W9; coupled to `#35` | log watcher/telemetry, live bridge/routes, runtime evidence store and UI | deploy log fingerprint, stale/authored-error negatives, static-vs-engine scorecard, running X4 |
| `#15` | PARTIAL | W16 after W9-W13 | reference corpus, cross-file validators, templates/compiler, completeness service/panel | ware/ship/order scaffolds, removed-required negatives, per-element provenance |
| `#16` | PARTIAL | W17 read-only; W19 staged write after review | XML/diff/XPath engines, artifact source separation, semantic diff/rebase modules | source/upstream/local/effective views, conflicts preserved, reviewed target equality |
| `#17` | PARTIAL | W8 local registry; W20 opt-in upstream after review | extension locations/manifests/CAT readers, profile registry, credentialed metadata adapters | mixed loose/packed/Workshop profile, no heuristic auto-match/removal, freshness and local-fork states |
| `#18` | SPECIFIED native no-gap contract; no native no-gap close yet | W5 contract now; implementation through W7-W20; W6/W21 close gate | existing Forge engines and the canonical `#10`-`#17`/`#20` owners; no provider or adapter modules | every inventory row native, no shipped external dependency/process/result, installed-extension reachability, representative native task suite |
| `#19` | PARTIAL | W3 foundation + W21 extension convergence | capability registry, embedded Studio/native IDE/MCP projections, extension-owned sidecar and harness proof | identical native operations/refusals/evidence inside the installed extension and representative native workflow proof |
| `#20` | PARTIAL | W3 then W4; first implementation | history/CAS/recovery/artifact/deploy/package stores, routes and surfaces | authoritative receipts, injected-failure rollback/no-false-success, permission matrix, secret/reference exclusions |
| `#21` | PARTIAL/disconnected | W10 + W13 after W8/W9 | schema/corpus/evidence sources, new evidence graph/store/query/UI | versioned facts, grades, contradiction/supersession, rule links, promotion refusals, all applicable extension surfaces |
| `#22` | Implemented but issue open | U22 proof-and-close after W3 starts | `server.ts`, `scripts/route-integration.mjs`, capability/route audits | same explicit root for read/write, default/alias/traversal negatives, current-source gates |
| `#29` | PARTIAL parent, 19 verified + R18 rejected | K31; closes after R21 is verified | Kimi ledger and GitHub parent | recorded R18 rejection, exact R21 evidence, and parent checklist |
| `#30` | Owner-rejected product direction; CLOSED `not planned` 2026-08-02 | K30D complete, no implementation | Kimi ledger, repository plan, and GitHub issue only | exact owner decision recorded; no CLI code |
| `#31` | OPEN/unlocked | K31 after W3 receipts | `vscode-extension/src/extension.ts`, new native MCP registration helper, `context.secrets`, shim/package | restart/workspace change/revoke, secret scan, unsupported-host fallback, installed VS Code+Antigravity |
| `#32` | SPECIFIED/reproduced | U32 after W3 | `src/App.tsx`, normalized action/navigation helpers, UI/E2E | one accessible owner per action at every breakpoint; rendered Antigravity wide+narrow |
| `#33` | SPECIFIED/reproduced | U33 after W3; feeds W10 UX | `diagnosticExplain.ts`, diagnostic provenance, `DiagnosticGuidance.tsx`, package/canvas/extension navigation | `<diff>` guidance, node/file/import navigation, stale/ambiguous refusal, installed rendering |
| `#34` | SPECIFIED/copy reproduced | U34 after W3 receipts | `PlaytestWorkspace.tsx`, workspace save, deploy-verify routes, destructive recovery | exact target copy, one deploy authority, stale/root/locked/validation negatives, isolated+rendered proof |
| `#35` | SPECIFIED; source partial | U35/W12 after X4 available | Canvas LIVE toggle, polling, log telemetry, bridge/runtime routes | live cue green, attributable error red, stale/authored negatives, clean stop, real rendered host |
| `#36` | QUEUED behind `#29` | R36 after K31 and parent close | two named research docs, current capability map/repo/community sources | opportunity matrix, explicit rejects, nonduplicate approved issue proposals; no implementation in this unit |

### Duplicate mirrors

- `#23` and `#26` -> `#8`.
- `#24` and `#27` -> `#9`.
- `#25` -> `#22`.
- They are closed as duplicates only after the canonical owner contains the recovered source detail and current
  implementation/evidence link. No duplicate is closed as “completed” merely because its owner exists.

### Couplings and no-duplicate boundaries

- W3 extends Agent History, workspace CAS, destructive recovery, artifact/build/package/deploy results, Agent API,
  MCP, and the built-in harness. It does not create a second general action log or transaction engine.
- W8 profiles are shared authority for Effective Tree, compatibility, runtime evidence, registry, forensics, semantic
  diff, and evidence records.
- W7 engine behavior controls W9 merge semantics; W9 provenance controls W10 merge-dependent rules and W14-W17
  product verdicts.
- W10's rule/evidence schema and W13's graph share IDs and promotion governance; they are not two knowledge stores.
- K31 and W21 project canonical capabilities and receipts inside the extension; they cannot carry private alternate
  behavior. K30 is a no-code rejection/disposition, not an alternate client.
- U33 becomes the first user-facing consumer of rule-specific explanation/navigation but may not pretend W10's full
  data-pack platform already exists.
- U34 consumes W3 receipts and existing deploy/recovery authority; it does not add another deployment path.
- Capability-map delta at specification: no capability claim changes yet. Current gaps and implemented-but-open #22
  are recorded; update the map only on a verified implementation close.

## DOCUMENTED EXECUTION ORDER

### Wave 1 — transaction truth and immediate ledger drift

1. **W3A receipt core:** immutable `forge.action-receipt.v1` schema, deterministic content address, durable store,
   state machine, validators, history projection adapter, and failure injection.
2. **W3B authoritative mutation integration:** bind current guarded workspace/file/deploy/revert/key/config/artifact
   mutations to prepare/finalize/fail receipts and existing recovery. No success response without the required final
   receipt; post-mutation finalization failure must roll back or return explicit incomplete/recovery truth.
3. **W3C extension surface:** the installed Studio panel/history, native IDE controls, and extension-managed MCP
   consume the same receipt schema and refusal semantics. The sidecar API and harness are internal proof seams, not
   separate products. No CLI projection is built.
4. **U22:** rerun root-alignment and traversal/alias tests on current bytes, correct durable records and close `#22`;
   no source rewrite unless proof finds regression.

**W3A checkpoint (2026-08-02): VERIFIED.** The strict schema/store and terminal Agent History projection substrate
pass 116/116 focused checks, 73/73 legacy-history checks, 130/130 runtime oracles, 400/400 routes against the freshly
built production bundle, writer/capability/MCP audits, typecheck/lint/build, and Graphify. No production mutation or
surface claims receipt authority yet. Exact close: `docs/plans/2026-08-02-w3-action-receipt-authority.md`; W3B0 is
specified at `docs/plans/2026-08-02-w3b0-action-receipt-coverage.md`.

**W3B0 checkpoint (2026-08-02): VERIFIED.** One reviewed fail-closed coverage authority now joins all 82 current
non-GET routes and 48 durable/host/browser/database surfaces to exact effects, scopes, owners, source anchors, policy,
and W3B batch. Pure resolution, deterministic candidate/hash-pinned promotion, precommit drift enforcement, fresh
production-route proof (400/400), isolated runtime proof (130/130), and all declared static/governance gates are
green. It deliberately mounts no production receipt consumer or visible extension surface. W3B1 addressed-state
integration is next; exact close: `docs/plans/2026-08-02-w3b0-action-receipt-coverage.md`.

**W3B1 partial checkpoint (2026-08-03): IN_PROGRESS / PARTIAL.** The shared runtime plus addressed workspace
replace/merge now prepare and terminalize authoritative receipts before response, preserve paired CAS/recovery,
replay exact intent without repeating mutation, reject changed facts, and record failed/no-change truth. Focused
service/transaction/store checks are 25/25, 23/23, and 119/119; the fresh production route gate is 426/426. This is
2/5 W3B1a routes only: workspace create, snapshot restore, bulk-transform apply, W3B1a E2E, W3B1b-d, and W3C remain
open. Exact record: `docs/plans/2026-08-02-w3b1-addressed-state-receipts.md`.

### Wave 2 — reproducibility, native capability contract, and unlocked Kimi/UX units

5. **W4:** normalize artifact/build/package/deploy/release results into receipt inputs; deterministic archives and
   manifests; secret scan and default deployment ignores; baseline fingerprints.
6. **W5:** freeze the native X4 capability contract above, reconcile every requirement to one existing Forge
   owner, and add/harden canonical Forge capability descriptors only when their real backing engines exist. No hollow
   metadata, provider contract, external process, or adapter is accepted.
7. **W6:** machine-verifiable native no-gap acceptance suite. Each row must exercise Forge's own implementation and
   deterministic expected behavior over legal local fixtures/engine evidence. It closes after W7-W20, not through
   external execution or result comparison.
8. **K30D / `#30` — COMPLETE:** the owner's rejection of a packaged/headless CLI is recorded in the Kimi parent and
   child; `#30` is closed as not planned. This unit wrote no product code.
9. **K31 / `#31`:** native opt-in MCP registration lifecycle using secret storage and exact key revocation.
10. **U8, U32, U33, U34:** compact graph view, header ownership, diagnostic explanation/navigation, and deploy UX.
    Disjoint UI paths may use parallel Luna workers; overlapping `App.tsx` or extension ownership is serialized.

### Wave 3 — engine authority and shared truth

11. **W7:** controlled X4 merge-law oracle for selectors, ambiguity, add/replace/remove, attributes, `if`, `silent`,
    `pos`, and nested extension paths. Record game/build/mod hashes. This is a hard gate.
12. **W8:** immutable local X4 version/install/mod profile model with exact source inventory, freshness and hashes.
13. **W9:** content-addressed Effective Tree and node/attribute/removal provenance over loose+packed sources; explicit
    incomplete truth when any relevant input is skipped.
14. **W10:** versioned data-only rule/evidence schema, pack validation, applicability, fixture lifecycle,
    contradiction/supersession, signature/hash pinning and governance.
15. **W11:** shared rule interpreter and rule-authorized preview/apply/revalidate fix path using W3 receipts.
16. **W12:** deploy-to-runtime oracle, log session/rotation fingerprint, attribution and static-vs-engine scorecard.
17. **W13:** governed evidence graph and representative queries through the embedded Studio/native IDE experience;
    extension-managed MCP, sidecar API, and harness are supporting integration/proof seams.
18. **U35 / `#35`:** run the six-step real-X4 experience script when X4 is available. Until then the source/runtime
    unit may progress but final status remains PARTIAL.

### Wave 4 — user-facing intelligence

19. **W14 / `#12`:** unified structural and labelled behavioral Forensics Center.
20. **W15 / `#13`:** Compatibility Lab and migration manifests.
21. **W16 / `#15`:** analogue-driven entity completeness and cross-file scaffolding.
22. **W17 / `#16`:** read-only semantic source/upstream/local/effective comparison.
23. **W18:** expose and test W14-W17 through current product surfaces without adding a replacement shell.

### Mandatory product-decision review stop

- Re-read all Phase 2 evidence and the native capability matrix. Any useful matrix row still lacking native Forge
  behavior returns to its canonical implementation owner; there is no provider or comparison fallback.
- Obtain and record explicit authorization for source-writing rebase behavior and each opt-in upstream network
  adapter. If not authorized, close the read-only portions honestly and leave W19/W20 BLOCKED/PARTIAL.

### Wave 5 — controlled mutation, network intelligence, final convergence

24. **W19 / `#16`:** staged, review-required semantic rebase with preserved conflicts/authorship and W3 rollback.
25. **W20 / `#17`:** opt-in Nexus/Steam/GitHub metadata, user credentials, freshness, confidence-labelled identity
    candidates and no heuristic removal recommendation.
26. **W21 / `#19`:** complete native capability projection and representative task proof across the installed
    extension's embedded Studio panel, native IDE controls/editors, and optional extension-managed MCP. The
    extension-owned sidecar API and harness prove consistency internally; no external analysis provider or
    runtime, comparison result, standalone web app, or CLI product is included.
27. Close child issues and `#9` only after point-by-point evidence review.

### Wave 6 — queued research close

28. Close `#29` after the K30 rejection disposition and K31 implementation are recorded; update the Kimi
    ledger/ROADMAP.
29. Run `#36` research reconciliation against current sources and the live community landscape. Publish accepts and
    rejects, create only approved nonduplicate issues, and do not implement them under this cutoff program.

## VALIDATION CONTRACT

Every executable unit declares its applicable subset before code changes and records exact command, exit/result,
timestamp, revision/fixture, and evidence path.

1. Static/schema/type: focused selftest plus `npm run typecheck` and `npm run lint`.
2. Unit/focused behavior: named pure-engine tests and negative fixtures.
3. Integration: `npm run test:routes`, `npm run test:capabilities`, `npm run test:mcp-capabilities`, and
   `POST /api/agent/project/validate` where the changed surface participates.
4. Negative/rollback: at least one refusal and one injected failure; no false-success receipt; prior bytes/state
   preserved or exactly restorable.
5. Runtime: `node scripts/oracle-sweep.mjs`, debug-watcher state, extension-managed MCP/sidecar lifecycle, applicable
   existing AI-provider behavior, or real engine
   events as applicable.
6. Native UI: exact behavior rendered and interacted with in real Antigravity. DOM/source inspection is supporting,
   not final visual proof.
7. Package/install: `npm run build`, extension build/stage/probe/VSIX inspection, exact installed-file parity, and
   restart/remount behavior for shipped extension changes.
8. Full gate: verdict-parsed `npm run test:e2e` with ephemeral 3100/3101 stack; verify shutdown and live workspace
   unchanged.
9. Domain live gate: W7, W12, U35 and any player-visible runtime claim require current-session X4 evidence. No
   running game means PARTIAL.

Evidence roots:

- Task records: `docs/plans/2026-08-02-*.md` or the actual close date.
- Machine results: `test-results/<task-id>/`.
- Packaged/installed/rendered proof: `vscode-extension/evidence/<task-id>/`.
- Durable closes: `ROADMAP.md`, capability-map delta if any, `SESSION-HANDOFF.md`, project/global AAR ledgers, and
  the canonical GitHub owner issue.

## REVIEW

- At every unit close, classify every issue acceptance row done, partial, missed, deferred, or out of scope.
- Significant units get a fresh complete diff review, negative-path review, rollback review, generated-file/churn
  check, and independent Luna correction pass when findings exist.
- Parent checkboxes do not close from internal plumbing. User-visible claims require rendered proof; engine claims
  require engine evidence; installed claims require installed bytes.

## DOCUMENT CLOSE

- This program remains `SPECIFIED/PARTIAL` until all cutoff owner issues are closed or honestly recorded as blocked by
  an explicit external decision/environment after all meaningful work is complete.
- Each bounded close updates repository truth, the exact owner issue, duplicate mirrors if applicable,
  `SESSION-HANDOFF.md`, and the appropriate roadmap/AAR/capability-map delta before commit/push.
- Suggested program commit title is not issued until the program actually closes. Each unit supplies its own title.

## AAR

- Triggered: the resumed request exposed an interpretation failure—closing the GitHub feature-ledger projection was
  treated as the delivery instead of the prerequisite to implementation.
- Sustain: source issue bodies, repository records, capability map, ADRs, Agent Brain, graph relationships, and the
  original Discord post were reconciled before choosing code work.
- Improve work/approach: always restate whether the requested deliverable is planning, ledger projection,
  implementation, or all three; a successful prerequisite close cannot substitute for the requested product work.
- Improve tools: terse bot-mirrored GitHub issues need their source forum/thread read before acceptance criteria are
  invented.
- Highest-risk evidenced weakness: issue state can lag source truth (`#22`) or omit source detail (`#8`), so GitHub
  alone is not a reliable implementation oracle.
- Lessons banked: project AAR update occurs with the first bounded implementation close.
