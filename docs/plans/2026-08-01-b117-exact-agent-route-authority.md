# B117 — Exact Agent Route Authority (B115 W2A)

> **For Agent:** follow the Full lane in `AGENTS.md`. This is the first independently closable W2 slice. Preserve
> ADR-F5 workspace/CAS behavior, keep the real game and user configuration untouched, and do not fold W3 receipts,
> provider execution, or a generic capability dispatcher into this unit.

**Goal:** replace Forge's broad path-prefix and `deploy => true` agent-key authorization with one versioned,
reviewed, exact-route, deny-by-default policy consumed by runtime auth and the W1 drift oracle. Keep Studio as the
user-owner surface, keep Forge as the only product, and make existing `read`, `write`, and `deploy` keys adopt the
safer policy without rewriting stored credentials.

**Architecture:** evolve `config/forge-route-dispositions.json` from inventory-only v3 to an authority-bearing v4.
Every reviewed API route declares exact agent scopes, protected resource class, and workspace-middleware mode. A
pure matcher compiles those Express route templates, rejects ambiguity, and returns a versioned decision. The current
auth middleware enforces that decision before handlers and attaches it for W3 to consume later. The existing public
allowlist, Studio token, B42 key store, ADR-F5 resolver, CAS, guarded writes, ledger, handlers, capability registry,
and surface shells remain their existing owners.

Task: B117 exact agent route authority
Lane: FULL

## PLAN

- Bounded unit:
  - create one exact route-authority evaluator and make it the runtime source for agent-key grants;
  - promote the reviewed route manifest to `forge.route-dispositions.v4` with an authority record for all 290 direct
    routes and the one dynamic registrar;
  - drive the existing workspace middleware's required/optional/input-first selection from that reviewed record,
    without changing resolver/CAS/handler semantics;
  - remove automatic agent authority over credentials, standing configuration, Studio preferences, cross-workspace
    registry creation/restore, arbitrary commands, GitHub/Steam/human receipts, schema harvesting, global external-API
    registration, and legacy applying generation;
  - keep exact safe analysis, authoring, package, caller-key AI, guarded configured-root, recovery, and deploy routes
    available through the appropriate compatibility preset; these high-trust grants must be explicit rather than
    inherited from `deploy => true`;
  - correct Agent Bridge's key-scope explanation and prove the shipped/installed rendering.
- Assumptions and resolved decisions:
  - `[REPRODUCED]` current `scopeAllows()` grants every ordinary GET to every scope, `write` through broad prefixes,
    and every non-excluded POST to `deploy`.
  - `[REPRODUCED]` this makes provider-key writes, directory configuration, Studio preferences, direct configured-root
    writes/deletes, deployed-Lua instrumentation, applying generation and other global effects inherit deploy access.
  - `[REPRODUCED]` R8/R17 already guards immutable workspace lookup, key binding and CAS. The convergence plan's
    “some paths bypass addressed-workspace authority” statement is stale/overbroad; B117 must not rebuild it.
  - `read` means exact inspect/analysis only; `write` adds guarded workspace authoring, compilation and local package
    preparation but not deploy or spend; `deploy` adds explicitly reviewed deployment, guarded configured-root and
    recovery operations, plus caller-owned provider use, but never administrator, stored-credential,
    external-repository, publishing, human-receipt or command authority.
    This is the security-preserving interpretation of approved issues #19/#20 and the existing “write ... no spend”
    UI contract. The unsafe “deploy = everything” copy is not retained as product policy.
  - Existing keys are not deleted, invalidated, rewritten or grandfathered. Their stored preset remains intact and
    is evaluated against the current versioned policy. A newly denied call returns a stable refusal with policy
    version/hash so callers can diagnose the compatibility change.
  - Separate per-key capability/effect narrowing and actor-specific discovery/MCP intersection are W2B, not W2A.
    B117 must leave a single exact policy seam they can reuse.
  - `[REPRODUCED prior decision]` B64-SEC5 records that localhost Origin/Referer is forgeable by a client holding the
    full-power Studio bearer token. Replacing that deliberate Studio/provider boundary is Ken-gated. W2A closes the
    scoped agent-key path only; it must neither claim SEC5 fixed nor silently add a second UI authentication system.
- Authoritative references:
  - `AGENTS.md`, `UNIVERSAL_AI_TASK_WORKFLOW.md`, ADR-F1 through ADR-F5;
  - `F:\StarForge\wiki\x4-forge\capability-map.md`;
  - Google Drive “X4 Forge — Capability Convergence Feature Request Package”;
  - GitHub initiative #9 and child requests #19 and #20;
  - `docs/plans/2026-07-31-capability-convergence.md` and the verified R8/R17 workspace-authority plan;
  - live source and HTTP behavior. Toolkit guard ideas are comparison evidence only, never runtime authority.
- In scope:
  - exact method/template matching and ambiguity rejection;
  - reviewed scope/resource/workspace classifications and safe candidate/promotion workflow;
  - runtime unknown-route and insufficient-scope refusal before handler execution;
  - request-attached actor/authority decision with no credential material;
  - exact canonical capability access parity;
  - deterministic pure, adversarial audit, real HTTP, MCP-regression, browser, package and installed-host tests.
- Out of scope:
  - per-key custom grants or AI-presence-tier security mapping;
  - an actor-specific authority endpoint and MCP tool filtering (W2B);
  - W3 transaction/approval receipts or changing Agent History's fail-soft contract;
  - new provider processes, toolkit installation/execution, rule packs, Effective Tree, profiles, forensics, migration,
    runtime oracle, scaffolding, semantic rebase, upstream intelligence, or knowledge graph;
  - changing explicit inline/path-addressed operations into registry operations contrary to ADR-F5;
  - game/mod-directory writes, real credentials/config mutation, GitHub issue mutation, marketplace publish, or release.
- Likely files:
  - create `src/lib/agentAuthority.ts` and its deterministic selftest;
  - modify `src/lib/agentKeys.ts`, `server.ts`, `config/forge-route-dispositions.json`,
    `config/durable-writers.json`,
    `scripts/capability-contract-audit.ts`, `scripts/route-integration.mjs`,
    `src/lib/forgeCapabilities.selftest.ts`, `src/components/AgentBridge.tsx`, `tsconfig.json` if static JSON typing
    requires it, and route/selftest registration only through the existing owners;
  - update this plan, the parent convergence plan by proven delta, `BACKLOG.md`, `SESSION-HANDOFF.md`, capability map,
    ROADMAP on close, AAR ledgers when triggered, and `graphify-out/graph.json` after source changes.
- Risks and authorization boundaries:
  - high-risk auth chokepoint: an omitted grant can break an external workflow; a broad/ambiguous match can preserve or
    create privilege. The exhaustive manifest, exact HTTP matrix and old/new compatibility list are required evidence.
  - JSON policy must be bundled into the installed sidecar; runtime must not depend on a repository-relative file that
    is absent from the VSIX.
  - manifest candidate tooling must not auto-authorize a new route, silently retain a removed route, or allow edited
    authority bytes to bypass exact-hash review/promotion.
  - no test may use live user credentials, standing configuration, the real mod, or the game directory. Use the
    isolated route harness, temporary roots and disposable keys only.
- Rollback/checkpoint:
  - baseline `HEAD == origin/main == 89f3d8dc9d7a1d3b5fc51f38780da031f3a435c6`;
  - preserve every unrelated dirty path listed under BASELINE;
  - no stored-key migration is performed, so rollback is source/config reversion plus reinstalling the last exact
    0.0.63 VSIX if installed proof regresses;
  - candidate promotion snapshots and hash-checks the tracked v3/v4 destination before replacement.
- Acceptance criteria:
  1. All 290 direct routes and the one dynamic registrar have exactly one reviewed v4 disposition. Every API route
     record has non-empty owner/resource metadata, a valid workspace mode, and exactly one hierarchical scope set:
     `[]`, `[deploy]`, `[write, deploy]`, or `[read, write, deploy]`.
  2. Runtime compiles only anchored literal/`:param` templates. Duplicate/overlapping templates, wildcards, malformed
     methods/paths, encoded slash/backslash tricks, query strings and unsupported dynamic forms cannot widen a match.
  3. An agent-key request is allowed only when the exact matched record contains its preset. Unknown path, wrong
     method, newly added prefix child and malformed policy fail before handler execution. No blanket GET, prefix grant,
     or `deploy => true` fallback remains.
  4. Public GET behavior and Studio-owner access remain compatible for reviewed routes. Invalid/missing authentication
     stays 401 where required; revoked/expired keys stay 401; valid but denied keys return a stable 403 containing the
     preset plus policy version/hash but no token/hash/secret.
  5. No agent preset can manage agent/provider keys; modify directory/schema config or Studio preferences; invoke
     GitHub, Steam, human export receipt or run-command routes; create/restore across workspace bindings; harvest
     standing schemas; register global external APIs; or call legacy applying generation. Read/list/bootstrap returns
     only the key-bound workspace, while plural workspace creation remains Studio-only.
  6. Exact positive presets remain usable: read can invoke reviewed GET/body-analysis routes; write can use guarded
     workspace authoring, compile/validate/package/Nexus preparation without deploy or provider spend; deploy inherits
     those exact grants and can invoke reviewed deploy, guarded configured-root filesystem/instrumentation, CAS-bound
     history recovery and caller-key AI routes, while server provider keys remain unavailable to scoped agent-key
     requests even when they forge localhost Origin/Referer. The known full Studio-token Origin-spoof boundary remains
     B64-SEC5 and Ken-gated. `force:true` workspace replacement requires deploy or Studio; ordinary paired-CAS writes
     remain write.
  7. The manifest's workspace modes reproduce current middleware behavior. Required routes still reject missing,
     malformed, unknown, legacy-unbound and mismatched workspace IDs; W1 input-first compile/generation validation
     still precedes workspace lookup and provider spend; paired CAS and two-workspace isolation remain green.
  8. Canonical descriptor `access.agentScopes` equals executable policy for every binding. Manifest generation
     carries reviewed existing authority, defaults new routes to no agent grant, and promotion requires the exact
     reviewed candidate hash plus a current-source/full-audit rerun.
  9. HTTP negative tests prove denied requests leave workspace head/snapshot/version, disposable config and key-store
     files, protected roots, ledger count, spend meter and network-dispatch counter unchanged where applicable.
  10. Agent Bridge no longer says deploy keys have “everything” or “full API power.” It states the three exact presets,
      Studio-only categories, current policy version, and that existing keys follow the current policy.
  11. Typecheck, owned lint, capability audit, MCP regression, route integration, runtime oracles, full isolated E2E,
      production build, staged app, VSIX inspection/probe, installed-byte parity and real rendered Antigravity key UI
      pass. No X4/in-game gate applies to HTTP authorization.
- Required validation and negative path:
  - pure authority/selftest with exact and adversarial template fixtures;
  - candidate generation, reviewed hash promotion, bad-hash/no-change and unreviewed-route negatives;
  - `npm run test:capabilities`, `npm run test:mcp-capabilities`, `npm run test:routes`, `npm run test:oracles`,
    `npm run typecheck`, owned/full lint as applicable, focused and full `npm run test:e2e`, `npm run build`,
    `graphify update .`, `npm run precommit:check`;
  - stage app, package inspector, staged runtime probe, unique VSIX package, installed parity and real rendered UI;
  - after E2E, verify ports 3100/3101 and temporary state are gone and the live workspace is unchanged.
- Evidence locations:
  - ignored deterministic/runtime output under `test-results/b117/`;
  - installed screenshots under `vscode-extension/evidence/2026-08-01-b117-authority/`;
  - durable commands, hashes, counts and requirement review in this plan.

## BASELINE

- Revision/version: `HEAD == origin/main == 89f3d8dc9d7a1d3b5fc51f38780da031f3a435c6` after the verified B116/W1 push.
- Existing changes/failures/runtime state:
  - unrelated modified `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`;
  - unrelated deleted data/Discord documentation and scripts;
  - unrelated modified old 0.0.35 screenshots and untracked issue templates, Kimi note and R8/R17 evidence;
  - these paths are user/other-task state and must not be reset, rewritten wholesale, or staged with B117;
  - normal Antigravity is open and responsive; computer control is released; Ken reported the machine quiet;
  - no B117 test has run and no implementation file has changed at this baseline.
  - before the checkpoint commit, `origin/main` advanced by eight non-overlapping README/Discord-sync commits to
    `e857f30606f72bd5b70059201ac3451c1eb9ca88`; local `main` was updated with `git pull --ff-only`, with no merge,
    rebase, reset, cleanup or overlap with B117/unrelated dirty paths.

## RECONCILE

- Resources and readers/writers searched:
  - W1 capability registry, exact route-source inventory, reviewed v3 manifest, candidate/promotion guards and MCP shim;
  - B42 key store and `scopeAllows()` callers/selftests/UI copy;
  - auth/public/workspace/ledger middleware ordering and every local `resolveWorkspaceAuthority()` call;
  - workspace registry/CAS, history revert, snapshot restore, generation pre/post-provider checks, compile/package/
    artifact inline-or-addressed paths, cross-workspace Studio guards, provider key/spend boundary and configured-root
    filesystem/deploy routes;
  - ADR-F1/F5, capability map, GitHub #9/#19/#20 and the Drive feature package.
- Existing capability reused:
  - W1 already provides exhaustive route discovery, exact reviewed candidate promotion, canonical capability access
    metadata and adversarial audit infrastructure;
  - B42 already provides secure key persistence, expiry, revocation and workspace binding;
  - R8/R17 already provides immutable workspace identity, exact key binding, CAS and input-first exceptions;
  - the current auth middleware is the single runtime chokepoint. No second router, key store, workspace store or
    capability executor is required.
- Couplings checked:
  - manifest entries ↔ runtime route matcher ↔ auth response;
  - canonical capability access ↔ primary binding policy;
  - public allowlist ↔ public dispositions;
  - workspace mode ↔ middleware order and handler-local conditional resolution;
  - key UI copy ↔ executable preset;
  - bundled server bytes ↔ statically included policy;
  - W3 future receipt authority ↔ request-attached decision without prematurely changing receipt schema.
- Capability-map delta: none at specification. On verified close, record a security/authority strengthening of B42 and
  B115 W2A; do not claim a new user-facing modding capability.
- Plan changes caused by reconciliation:
  - corrected the stale workspace-bypass hypothesis: no direct registry mutation bypass was reproduced;
  - split W2 into W2A closed-world authority (this task) and W2B effective-authority discovery/per-key narrowing/MCP
    projection so this checkpoint remains independently testable and committable;
  - retain the canonical deploy-scoped history revert because it already has exact workspace/CAS/recovery guards and
    is required for agent rollback parity; W3 will strengthen its receipt rather than recreate the operation;
  - retain ADR-F5's explicit stateless inline/path-addressed validation, package and deploy policy; do not silently
    force those inputs into the workspace registry;
  - retain caller-key AI only under the exact deploy preset. W2A enforces caller-owned provider credentials for
    scoped agent-key actors, but B64-SEC5 means Origin/Referer is not an unforgeable UI boundary for a caller already
    holding the full Studio token. That separately Ken-gated decision remains open.

## DOCUMENT PLAN

- Status at implementation start: `SPECIFIED`.
- This file and its bounded B117 backlog entry are the implementation authority. Update this record before any
  correctness-required scope change.

## IMPLEMENT

- Added `src/lib/agentAuthority.ts`: a pure closed-world compiler/matcher for literal and one-safe-segment `:param`
  templates. It rejects unsupported methods, overlaps, query/hash/backslash/NUL/trailing-slash paths, every percent-
  encoded request path, case variants, prefix children and non-hierarchical scope sets. Its canonical policy hash is
  independent of JSON object-key order.
- Promoted `config/forge-route-dispositions.json` to `forge.route-dispositions.v4`: 290 direct routes and one reviewed
  dynamic registrar now carry explicit scopes, resource class and workspace mode. Runtime policy hash after the final
  reviewed candidate is `8b332e6fa9996bb5c3e2ed0fd5f269fd5ee2c8de62b1d400f8eb8ab76748026a`.
- Replaced B42's broad scope matcher with the exact policy in `src/lib/agentKeys.ts`; `server.ts` now attaches the
  secret-free decision, rejects unknown/malformed/exact-scope denials before handlers, and drives the existing
  workspace middleware from reviewed `required` / `optional` / `input-first` modes.
- Made credential/config/Studio-preference/global registration/cross-workspace administration/schema-harvest/
  legacy-applying-generation routes Studio-only through both policy and handler defense. Forced workspace replacement
  or merge requires deploy or Studio.
- Preserved provider use only for deploy keys with a caller-supplied key. Agent-key actor/credential eligibility is
  resolved before spend reservation, so a scoped key with forged localhost Origin/Referer headers cannot consume
  stored Studio keys or mutate the meter. A test-only post-meter/pre-network marker proves the positive caller-key
  dispatch boundary without spend. The legacy full Studio bearer + spoofable-origin gap remains B64-SEC5; comments
  and close records name it instead of falsely claiming it was solved.
- Agent-key `lastUsedAt`/`useCount` now records only completed responses below 400, not mere credential verification.
  Handler/workspace denials therefore cannot be presented in Agent Bridge as successful uses.
- Fresh-eyes review found `patch.readiness.analyze` accepted arbitrary `oldRoot`/`newRoot` host paths while carrying
  read/write authority. It is now the versioned v2 capability, classified `host-file-read`, deploy-only, with MCP
  mapping/audit version updated instead of retaining the unsafe v1 contract.
- Aligned Express case-sensitive and strict routing with the exact matcher; the route-inventory audit recognizes only
  those two literal `true` settings, not generic Express-object escapes.
- Extended the capability audit, all-binding parity selftest, MCP contract, Agent Bridge/extension scope copy and HTTP
  matrix. Existing keys remain stored unchanged and follow the current policy.
- Registered the non-production route-test provider-dispatch marker in the existing durable-writer inventory. Its
  fixed-name JSONL evidence is confined to the harness-provided temporary directory, contains no key bytes, and a
  failed append propagates instead of allowing a false-success oracle.
- Evidence-harness corrections found during the first two full-suite runs wait for the existing E2E bootstrap before
  querying the canvas and await the exact successful `force:true` receipt before requiring the conflict dialog to
  close. Focused reruns prove those repaired assertions without relaxing their product requirements.

## VALIDATE

- `npm run typecheck` -> PASS after final authority/schema changes.
- Pure `runAgentRouteAuthoritySelftest()` -> 8/8 PASS, including exact literals, safe params, encoded/case/slash/
  prefix negatives, overlap rejection, non-hierarchical scopes and stable hash ordering.
- Candidate `a7ee2afd0426b9b907b8fb10c02347ae8bbdfc611213c15e6a874274be1c7a0e` was reviewed: its only delta from the
  manually reviewed authority was `patch.readiness.analyze@1 -> @2`, MCP audit `8 -> 9`, and their exact signatures/
  identity. Exact-hash promotion -> PASS after a full in-memory audit.
- `npm run test:routes` final -> 378/378 PASS. New positives/negatives prove preset reachability, Studio-only denials,
  host-file boundaries, provider caller-key + meter + isolated dispatch, forged Origin no-key refusal, unknown/case/
  encoded/slash refusal, forced-write no mutation, key-store byte stability on handler 403, deploy patch-readiness,
  and absence of the literal caller provider key from marker bytes and captured server output.
- `npm run test:capabilities` -> PASS: 11 capabilities, 290 exact direct routes, one dynamic registrar, ten MCP aliases;
  contract SHA-256 `d8a820f537dbcbb50bcb8a91c8bd415c221a15940f184e38a817fa4566c1ac8f`.
- `npm run test:mcp-capabilities` -> PASS: ten live tools plus fail-closed compatibility/narrowing/recovery checks.
- `npm run test:oracles` -> 129/129 PASS. `npm run lint` -> exit 0, zero errors, 583 existing warnings.
- `npm run test:writers` -> PASS: policy 14/14, live inventory 32 filesystem / 11 host-store / 2 browser-output
  sources, and extension durable-write 8/8. The first precommit run correctly rejected the unregistered new marker;
  the inventory and failure contract were then reconciled without an exemption.
- `npm run build` -> PASS: Vite production UI and bundled `dist/server.cjs`.
- Final `graphify update .` -> PASS: 3,836 nodes / 9,086 edges / 185 communities.
- `npm run precommit:check` -> PASS after the writer reconciliation: verdict policy 26/26, product-copy guard,
  writer gates, capability/MCP audits and typecheck. A 120-second outer wrapper expired during the unchanged MCP gate;
  a rerun with a sufficient wrapper completed in 155.7 seconds; post-review runs passed in 147 and, after the SEC5
  boundary wording correction, 143 seconds.
- Full isolated `npm run test:e2e` remains REQUIRED and RED on three consecutive runs under the no-flake policy:
  1. 93 passed / one retry-only failure in `canvas-interactions.spec.ts`; focused rerun passed after waiting for the
     existing `window.__X4_E2E__` readiness authority before the grid assertion.
  2. 93 passed / one retry-only failure in `workspace-conflict.spec.ts`; trace showed the guarded force write and
     success toast completed just after the old ten-second assertion. The test now awaits the exact successful HTTP
     receipt (30-second operation bound) before checking dialog close; focused rerun passed.
  3. 93 passed / zero failed / one retry-only `studio-shell.spec.ts` 2560-viewport failure. The first worker exited at
     0 ms with Windows `3221226505 == 0xC0000409`, produced no failure trace, and the unchanged case passed on retry.
     `test-results/e2e-verdict.json` correctly records `green:false`.
- Focused repaired E2E set -> 3/3 PASS. Every full/focused run cleared ephemeral ports 3100/3101. Live `.studio-state`
  fingerprint remained `9EE3935CEA33A91B63BC301F54EF1A47C398AC22084242185047F40B8A571A96`; live `config.json`
  SHA-256 remained `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697`; ports 3000/3001 were also clear.
- Fresh-eyes assessment of the third failure: 88% the repository-recorded Node 24.15.0 / Playwright 1.61.0 / libuv
  1.51.0 Windows worker-lifecycle crash, 10% cumulative harness interaction, at most 2% Forge viewport behavior.
  The structured verdict and zero-flake policy behaved correctly; no exemption, retry increase, timeout increase,
  reordering, assertion weakening or unsupported product fix is justified.
- Pending required gates: a clean full isolated E2E receipt, then staged app, VSIX inspection/probe, installed-byte
  parity and real rendered Antigravity key UI. Those downstream gates were deliberately not run over a red E2E
  receipt. No X4/in-game gate applies to HTTP authorization.

## REVIEW

- Acceptance 1–10: implemented and evidenced by the exact v4 manifest, pure matcher, candidate/promotion audit,
  capability/MCP parity, 378/378 external HTTP matrix, durable-writer audit, source review and updated UI copy.
- Acceptance 11: `PARTIAL`. Static, focused, integration, negative, runtime-oracle, lint, build, Graphify and precommit
  layers passed. Full isolated E2E remains red under the mandatory no-flake policy; package/install/rendered-host
  layers therefore remain pending.
- Fresh-eyes findings were resolved before checkpoint: unsuccessful handler calls no longer touch key usage;
  patch-readiness host roots are deploy-only; caller-key provider work crosses credential selection + meter + isolated
  dispatch without secret leakage; Express routing matches exact-policy case/slash semantics; only hierarchical scope
  sets are accepted; the test-only writer has a reviewed failure contract.
- Final staged security review reproduced the source path for B64-SEC5: `isAppUiRequest()` still trusts caller-set
  Origin/Referer after full Studio-token authentication. This is not an agent-key authority bypass and predates W2A,
  but it disproved the broader “all external callers” wording. The contract was narrowed to the actually proven
  scoped-key boundary; the existing Ken-gated security decision remains open.
- The final E2E review found no evidence supporting a viewport/product change. The unchanged case passed on retry and
  the exact crash is already reproduced in repository history. Treating it as green would violate the acceptance
  contract; changing product/test behavior to hide it would be an unrelated scope expansion.
- Boundary held: the existing key store, auth middleware, workspace resolver/CAS, capability registry, MCP shim and
  UI surfaces were extended. No parallel permission engine, router, workspace store, provider framework or product
  shell was created.
- Capability-map delta remains unwritten outside this repository-only unit until VERIFIED close. ROADMAP remains
  unchanged because this checkpoint is not a verified close.

## CLOSE

- Status: `PARTIAL` checkpoint. Exact route authority is implemented and its source/focused/integration gates are
  green; required full E2E, package/install parity and rendered-host proof remain open.
- What did not change: stored key bytes/presets, workspace/CAS semantics, the legacy full-Studio-token SEC5 boundary,
  Agent History durability contract, W2B per-key narrowing/discovery, W3 receipts, real game/mod/config directories,
  public marketplace state and release version.
- Remaining risk: the shipped authority change has not crossed a clean full-suite and installed-product boundary.
  Keep B117 `in_progress`; next run performs a bounded supported-Node/toolchain A/B diagnostic or obtains a clean
  unchanged full receipt, then runs the package/install/rendered key-scope gate. No flake exemption is permitted.
- Known adjacent security boundary: B64-SEC5 remains open/Ken-gated. A local client already holding the full Studio
  bearer can spoof the Origin/Referer compatibility signal used for stored provider-key fallback. W2A prevents that
  path for scoped agent keys; it does not make the full Studio bearer distinguishable from the Studio UI.
- Checkpoint commit title: `security(agent): checkpoint exact reviewed route authority`.
- Intended VERIFIED close title after the remaining gates pass: `security(agent): enforce exact reviewed route authority`.

## AAR

- Triggered: reconciliation corrected the parent plan's stale workspace-bypass premise and bounded W2 into two
  closable slices; fresh-eyes review found two P1 defects and three hardening/proof gaps; candidate generation first
  rejected Express settings, then correctly rejected an unversioned capability/MCP contract change; the first route
  run exposed an unsettled prior success-audit write in the byte-level denial fixture; precommit then rejected an
  unregistered test-only writer; its first rerun was cut off by an undersized outer timeout; three full E2E runs each
  produced one different retry-only failure and correctly remained red; final staged review corrected an overbroad
  provider-isolation claim against the already-recorded B64-SEC5 decision. This is a non-clean Full-lane checkpoint.
- Sustain: source-level writer/caller reconciliation prevented a duplicate workspace-authority implementation.
- Improve work/approach: use route-name context for authority edits; the first broad patch matched `extension-doctor`
  instead of `patch-readiness` and was corrected before validation. Register every new evidence writer in the same
  implementation batch. Size command wrappers from observed project-gate duration rather than a generic two minutes.
  Stop changing product/test code once failures move to an independently reproduced toolchain class.
- Improve tools: candidate refusal output did not name the offending deltas, requiring a second full audit; record a
  bounded follow-up to include mismatch details. The E2E structured verdict correctly catches both assertion flakes
  and in-report worker crashes; a separate supported-Node A/B probe is needed to diagnose the Windows lifecycle class.
  Graphify remains orientation evidence, not route-policy proof.
- Highest-risk evidenced weakness: the old deploy fallback automatically inherited future/admin routes, while one
  supposedly stateless capability could read arbitrary caller-selected host roots. B117 removes the fallback and
  classifies that boundary explicitly, but the changed shipped boundary remains unverified until clean full E2E and
  installed parity complete.
- Global/project lessons banked: this plan records the project-specific checkpoint. External StarForge ledgers were
  not mutated under the repository-only authorization boundary; no unverified procedural skill is banked.
