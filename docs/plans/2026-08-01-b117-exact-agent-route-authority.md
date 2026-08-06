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
  - live source and HTTP behavior. Comparison-only guard ideas are evidence only, never runtime authority.
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
  - new external analysis processes, rule packs, Effective Tree, profiles, forensics, migration,
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

## POST-CHECKPOINT VALIDATION UNBLOCK — SPECIFIED 2026-08-01

- Bounded unit: run the unchanged authoritative full E2E gate once under an already-installed Node 22 runtime, with a
  process-local PATH override so Playwright, its worker and both ephemeral web servers use the same runtime. Do not
  install, upgrade, pin, copy or replace Node; do not change Playwright, retries, timeouts, ordering, product code or
  test assertions during the A/B.
- Baseline: `HEAD == origin/main == e70046830cbc2548e27920d4828cf2978c55ade0`; system Node is 24.15.0 and the last
  receipt is red at 93 pass / one flaky after worker exit `0xC0000409`. Already-installed alternatives are Cursor's
  Node 22.22.0 and Python Playwright's Node 22.17.0; both report libuv 1.51.0. Local Playwright 1.61.0 declares
  `engines.node >=18`; Forge's TypeScript types already target Node 22. No root `engines`, `.nvmrc` or CI Node pin was
  found. Unrelated dirty paths remain exactly the post-checkpoint list in `SESSION-HANDOFF.md`.
- Selected A/B: Cursor Node 22.22.0, because it is the newer installed Node 22 candidate. Invoke
  `scripts/run-e2e.mjs` directly with that executable and prepend its exact directory to PATH only for that child
  process. The wrapper uses `process.execPath` for Playwright, while the PATH override covers config-owned `node ...`
  web-server commands.
- Risks and authorization: the run uses the existing isolated 3100/3101 stack and per-run state/config roots. It
  writes only normal ignored test receipts/artifacts. It must not touch the live workspace/config, game/mod folders,
  installed IDE, dependencies, credentials, provider network/spend or public state. The Cursor-bundled runtime is an
  A/B oracle, not a new Forge dependency or durable project toolchain decision.
- Rollback: process-local environment ends with the command; no machine setting changes. If the run fails, retain the
  red receipt and stop source edits. Any durable Node pin or workflow change requires a separately reconciled plan.
- Acceptance: captured `process.execPath`/version is 22.22.0; structured verdict reports all 94 tests passed with zero
  failed/flaky/bad/quarantined; ports 3100/3101 are clear afterward; live `.studio-state` regular-tree fingerprint
  (sorted directories plus relative paths, sizes and per-file SHA-256) remains
  `8B678D6922FF4D28CEC7526A7C4895300E532680C19514C9AA0165FB530A5479`; live `config.json` SHA-256 remains
  `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697`.
- Negative/failure path: any retry, missing structured receipt, wrong runtime, state/hash drift or leaked port is red.
  A clean A/B proves W2A on Node 22 but does not by itself authorize a repository/machine Node pin; reconcile whether
  reproducibility needs that follow-up before calling the overall installed gate complete.

### POST-CHECKPOINT VALIDATION UNBLOCK — FAILED 2026-08-01

- Runtime proof: `C:\Users\Moshi\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe`
  reported Node `v22.22.0` and libuv `1.51.0`; the same directory was prepended to PATH for the Playwright worker and
  config-owned web-server commands. No runtime, dependency, retry, timeout, ordering, product-code or assertion change
  was made during the run.
- Authoritative gate: `node scripts/run-e2e.mjs` exited 1 after 501.4 seconds. The structured receipt at
  `test-results/e2e-verdict.json` reports 94 total, 92 passed, one failed, one flaky, two bad results, zero active
  quarantines and `green:false` (generated `2026-08-01T21:21:10.47Z`). This fails the acceptance contract, so the B117
  close remains `PARTIAL`; packaging, installed-product and rendered-host gates remain unrun.
- [REPRODUCED] Deterministic failure: both attempts of `project-browser.spec.ts` — “Load Mod Project visibly
  decomposes a complex multi-script project without collapsing or overlapping cues” — received schema-config
  manifest state `unavailable` where the test requires `ready`. Evidence:
  `test-results/project-browser-Load-Mod-P-b6b56-lapsing-or-overlapping-cues-chromium/error-context.md` and the
  corresponding `-retry1/error-context.md`.
- [REPRODUCED] Retry-only failure: the first attempt of `continuous-polling.spec.ts` — “pre-marker divergent scoped
  cache is conservatively retained against a newer bootstrap” — exhausted its 35-second timeout while
  `sync-conflict-dialog` intercepted the helper's click on `health-card-dismiss`; retry passed in 1.6 seconds. Evidence:
  `test-results/continuous-polling-pre-mar-4ea54-d-against-a-newer-bootstrap-chromium/error-context.md` and `trace.zip`.
- [REPRODUCED] Runtime incompatibility: the server logged `ERR_DLOPEN_FAILED` because the checked-out
  `better_sqlite3.node` targets ABI 137 while Node 22 requires ABI 127. The server continued without its SQLite cache,
  so Cursor's bundled Node 22 is not a clean substitute for this checkout and the A/B cannot establish a supported
  Forge runtime. No rebuild or dependency mutation was authorized or attempted.
- Safety result: ports 3000/3001/3100/3101 were all clear after exit. The live `.studio-state` regular-tree fingerprint
  remained `8B678D6922FF4D28CEC7526A7C4895300E532680C19514C9AA0165FB530A5479`; live `config.json` remained
  `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697`. The isolated
  `%TEMP%\x4forge-e2e-state-72948` artifact was retained with the failure evidence; no live workspace path was changed.
- Review boundary: do not infer that the manifest failure is caused by the native SQLite mismatch or B117 until route,
  manifest and test-order readers/writers are reconciled. Do not change B117 source or tests under this closed A/B.
  Any toolchain pin, fixture-isolation repair or product change is a separately specified bounded unit.
- AAR trigger: the alternate-runtime hypothesis did not produce a clean gate and exposed an ABI mismatch plus two
  distinct failures. Sustain: process-local A/B and structured verdict prevented a false green; live-state hashes
  proved isolation. Improve work/approach: inspect native-addon ABI compatibility before choosing an alternate Node.
  Improve tools: the runner should report its Node ABI and native-addon compatibility before spending eight minutes on
  a full suite. Highest-risk evidenced weakness: the full gate is not currently reproducible across the two locally
  available Node majors, so a green retry cannot be treated as release evidence. No procedural skill was banked.

## E2E FIXTURE ISOLATION REPAIR — SPECIFIED 2026-08-01

Task: make the B116 polling fixture independent of the unrelated startup health overlay, then re-prove B117 on the
checkout's ABI-compatible default Node 24 runtime.

Lane: FULL

### PLAN

- Bounded unit: in `tests/e2e/continuous-polling.spec.ts` only, give `bootWithFetchCounts()` an explicit option to skip
  its unrelated health-card dismissal, and select that option for the two tests whose startup state intentionally
  opens `sync-conflict-dialog`. Keep the default dismissal for every ordinary polling test. No endpoint mock, forced
  click, timeout change, z-index change or product implementation change.
- Assumptions and unresolved facts: the Node-22 project-browser failure is attributed to the reproduced native-addon
  ABI mismatch because the config route returned success and `startCanonicalReferenceManifest()` reports
  `unavailable` when SQLite cannot open. The polling race is attributed to fixture setup because its trace shows the
  expected conflict dialog intercepting a later unrelated health-card click. A fresh-eyes read-only review remains
  pending before implementation.
- In scope: this plan and the single polling E2E helper. Out of scope: B117 authorization code, application overlay
  stacking, retry/flake policy, global timeouts, test ordering, Node installation/pinning, native-addon rebuild,
  package metadata and the project-browser assertion.
- Risks and authorization: skipping setup cleanup where later clicks occur could leave the health card in the way.
  Apply the option only to startup-conflict tests that perform no later obscured UI interaction; retain their conflict
  dialog and remote/local authority assertions as the negative behavior. Runs use only the isolated 3100/3101 stack.
  No live workspace/config, dependency, game/mod, IDE, credential, spend, provider or public write is authorized.
- Rollback/checkpoint: `HEAD == origin/main == e70046830cbc2548e27920d4828cf2978c55ade0`; revert the helper-only diff.
  Existing unrelated dirty paths remain untouched. Pre-repair receipt is the red
  `test-results/e2e-verdict.json` generated `2026-08-01T21:21:10.47Z`.
- Acceptance: typecheck and lint remain green; both immediate-startup conflict tests pass five consecutive
  default-runtime iterations with no retry; the exact project-browser complex-load test passes under default Node 24
  with the native SQLite cache available; the authoritative full E2E receipt is 94/94 with zero
  failed/flaky/bad/quarantined; ports
  3100/3101 clear; live-state/config fingerprints remain the values recorded above. Any red result stops package and
  installed-product validation.
- Required evidence: focused Playwright output, full `test-results/e2e-verdict.json`, server logs showing no
  `ERR_DLOPEN_FAILED`, port inventory, live fingerprints and final diff review. Negative proof: suppressing only the
  health overlay must not suppress `sync-conflict-dialog`, overwrite the unmarked draft or change the newer remote
  workspace.
- Documentation: record reconcile, validation, review and AAR here. If the full gate becomes clean, continue the
  already-specified B117 package/install/rendered-host gates; otherwise specify the next evidenced blocker separately.

### RECONCILE

- Fresh-eyes review reproduced the setup race from the trace: both bootstrap and health calls returned 200, the
  expected workspace CAS returned 409, and the authoritative reread returned 200 before the z-index 9999 conflict
  dialog intercepted a click aimed at the z-index 90 health card. Confidence attribution: fixture async ordering 95%,
  product overlay coordination 3%, Node/SQLite timing amplification 1%, B117 authority 0.5%, cross-test leakage 0.5%.
- Resource/coupling check: the helper's health dismissal was introduced by the earlier B116 polling suite; the B117
  commit did not edit this helper or the failing project-browser test. The B117-protected config request completed and
  entered the handler, excluding an authorization denial. `startCanonicalReferenceManifest()` explicitly returns
  `unavailable` when its SQLite database cannot open, matching the Node-22 server log exactly.
- Plan change: replace the initial endpoint-mock proposal with the smaller per-call helper option recommended by review.
  This preserves real health and conflict behavior and changes only irrelevant fixture cleanup. No capability-map delta.

### IMPLEMENT / VALIDATE — PARTIAL 2026-08-01

- Implemented only the reconciled fixture boundary: optional `dismissHealthCard`, a guard after boot readiness, and
  `false` at the equal-version and pre-marker startup-conflict calls. A first mechanical patch selected the adjacent
  successful-autosave call instead of pre-marker; diff review caught and corrected it before validation. No product
  file changed.
- `npm run typecheck` -> PASS in 27.5 seconds. `npm run lint` -> PASS in 21.8 seconds with zero errors and the existing
  583 warnings.
- Default runtime proof: `C:\Program Files\nodejs\node.exe`, Node `v24.15.0`, ABI 137. Both startup-conflict tests
  repeated five times each -> 10/10 PASS in 136.1 seconds. Their assertions retained the local draft, newer remote
  state and visible conflict, so the negative authority path was not mocked away.
- Exact project-browser complex-load test -> 1/1 PASS in 24.2 seconds. Server logged canonical reference manifest
  `ready`, confirming that the Node-22 failure was an invalid ABI A/B rather than B117 route behavior.
- Authoritative full E2E -> FAILED after 898.1 seconds. Receipt `test-results/e2e-verdict.json`, generated
  `2026-08-01T21:48:43.33Z`, reports 14 passed, 80 failed, zero flaky and `green:false`. The backend on 3101 exited
  during the first attempt of “newer server bootstrap cannot silently replace a failed scoped draft”; its attempt and
  retry report `TypeError: fetch failed`, then every later test cascaded through Vite proxy `ECONNREFUSED 127.0.0.1:3101`.
  Treat this as one backend-lifecycle failure plus downstream fallout, not 80 independent regressions.
- Safety -> PASS: ports 3000/3001/3100/3101 clear; live `.studio-state` fingerprint remains
  `8B678D6922FF4D28CEC7526A7C4895300E532680C19514C9AA0165FB530A5479`; live `config.json` remains
  `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697`. Isolated state artifact
  `%TEMP%\x4forge-e2e-state-72984` is retained. No matching Windows Application Error event was found in the crash
  window; the buffered full-run output did not preserve the backend's first fatal line.
- Review status: the helper repair is focused-green but cannot close while the required full gate is red. B117 remains
  `PARTIAL`; package/install/rendered-host gates remain blocked. The full-suite failure changes the next plan again.

### AAR

- Triggers: reconciliation changed the mock proposal; the first patch targeted one adjacent repeated call and required
  correction; the authoritative gate failed with a new backend-lifecycle class.
- Sustain: exact diff review caught the call-site error; repeated focused negatives proved the repair; receipt parsing
  collapsed 80 apparent failures to one server-loss event; post-run hashes proved live-state isolation.
- Improve work/approach: use more contextual patch hunks around repeated calls and capture the first server-process exit
  cause before a long cascade consumes the output budget.
- Improve tools: the E2E runner needs durable backend stdout/stderr plus exit code in its receipt. The current final-only
  buffer can obscure the one causal line behind thousands of downstream proxy errors.
- Highest-risk evidenced weakness: loss of the backend is not fail-fast; Playwright spent roughly twelve further minutes
  retrying tests that could not connect, producing noisy evidence and slow feedback. A bounded fail-fast/exit-evidence
  improvement is warranted after the crash mechanism is reproduced. No procedural skill is banked yet.

## BACKEND EXIT DIAGNOSIS — SPECIFIED 2026-08-01

- Bounded unit: no source edits. Run the exact first-failing “newer server bootstrap” test repeatedly on the default
  runtime with untruncated server output. If it remains green, run only the ordered prefix through that test to test
  cumulative state/resource pressure. Capture the first operation and process-exit evidence; do not rerun the remaining
  suite or alter timeouts/retries/code during diagnosis.
- Baseline/rollback: checkpoint `e700468`; only the plan and fixture helper are task-owned working changes. Ports are
  clear and live hashes match. Runs use disposable 3100/3101 state; rollback is process exit. Preserve evidence.
- Acceptance: either reproduce the backend exit with an exact fatal/exit signature and smallest ordering boundary, or
  complete ten isolated iterations plus three ordered-prefix iterations without loss and classify the full-run exit as
  unreproduced. Every run must clear ports and preserve live hashes.
- Negative/safety: a browser assertion failure with a healthy 3101 is not equivalent to a backend exit. Do not weaken
  the workspace-conflict behavior or convert a crash to a retry. No dependency, machine, live config/workspace,
  game/mod, IDE, credential, network/spend or public mutation is authorized.

### BACKEND EXIT DIAGNOSIS — VERIFIED 2026-08-01

- Exact first-failing test repeated ten times on Node 24/ABI 137 -> 10/10 PASS in 251.1 seconds; each iteration completed
  the failed-write, forced-remote-seed, reload, conflict and final authoritative-read path with 3101 alive.
- Exact seven-test ordered prefix through that test repeated three times on one ephemeral server -> 21/21 PASS in
  273.7 seconds. No backend exit, fetch failure or proxy refusal reproduced.
- Retained isolated history ledger narrows the original exit window: remote force seed completed at
  `2026-08-01T21:35:58.516Z`; after reload, 3101 successfully served project/files and bootstrap at
  `21:36:01.459Z` / `21:36:01.476Z`, plus another project/files request at `21:36:06.069Z`. With the old trace rotated,
  the final `readServerWorkspaceEnvelope()` GET is the first failed await at approximately 90% confidence; the
  immediately preceding conflict wait is the alternative.
- Classification: backend exit is [REPRODUCED] in the full run but unreproduced under 31 targeted executions. Test
  logic as sole cause 5%; cumulative native/runtime process failure 65%; external/OS process loss 20%; unknown
  full-suite interaction 10%. The fixture helper repair did not contribute: it is not selected by the test that saw
  the exit, and the exact ordered prefix remains green.
- Status: diagnosis objective `VERIFIED`; no source mutation beyond the already specified helper repair. Because B117
  still requires one clean authoritative receipt, run one final unchanged full gate on default Node 24 with
  `DEBUG=pw:webserver` and stdout/stderr tee'd to a timestamped `%TEMP%\x4forge-b117-full-e2e-*.log`. A clean 94/94
  receipt resumes packaging; another exit stops and preserves the lifecycle log for a new bounded runner/runtime unit.

## FINAL GATE RESUME — VERIFIED 2026-08-01

### BASELINE / RECONCILE

- The final run retained the checkpointed B117 product bytes at
  `e70046830cbc2548e27920d4828cf2978c55ade0`. The only executable working-tree delta was the already specified
  polling-fixture repair in `tests/e2e/continuous-polling.spec.ts`; it changes no production or packaged byte.
- The failed Node 22 A/B is not a supported-runtime result: its native SQLite binding ABI did not match. Default
  Node 24.15.0 / ABI 137 is the checkout-compatible runtime and produced a ready canonical-reference manifest.
- The one full-run backend loss remains a reproduced but unreproduced lifecycle event. Ten exact-test iterations and
  three ordered-prefix iterations stayed green; the final full run therefore preserved server output instead of
  changing product code, retry policy, suite order or timeouts.
- No new capability or product surface was created. This close strengthens B42/B115 authority through the existing
  key store, auth chokepoint, route inventory, workspace resolver/CAS, capability registry, MCP shim and Agent Bridge.

### VALIDATE

- Final instrumented `npm run test:e2e` on Node 24.15.0 -> **94/94 PASS**, zero failed, flaky, bad-result or
  quarantined tests in 19.2 minutes. `test-results/e2e-verdict.json` was generated at
  `2026-08-01T22:21:10.45Z` with `childExit:0` and `green:true`. The retained `DEBUG=pw:webserver` log is
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b117-full-e2e-20260801-180159.log`, SHA-256
  `C5239B8CE97122EC2C1E86965BAF6C642032809BC9177AF0B98674CDABC68EF6`; both ephemeral servers terminated
  normally.
- Safety after the full gate -> PASS: ports 3000/3001/3100/3101 were clear; live `.studio-state` regular-tree
  fingerprint remained `8B678D6922FF4D28CEC7526A7C4895300E532680C19514C9AA0165FB530A5479`; live `config.json`
  remained `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697`.
- Final `graphify update .` -> PASS: 3,836 nodes, 9,087 edges and 179 communities. No tracked Graphify artifact changed.
- Final post-review `npm run precommit:check` -> PASS in 151.5 seconds, including 26/26 verdict-policy tests,
  product-copy guard, 14/14 writer policy plus inventories, capability audit 11/290/1/10, live ten-tool MCP recovery
  and typecheck. The immediately preceding attempt failed when the MCP child exited `3221226505 == 0xC0000409`
  with no stderr; the exact MCP gate then passed 5/5 before the complete clean rerun. The failed attempt remains AAR
  evidence, not a waived gate.
- Final product/package gates -> PASS: root production build; extension build; staged app with five bundle files,
  169 runtime packages and the native binding; staged runtime probe 16/16; VSIX inspector 13/13; package inspection
  2,091 entries and 60,712,736 unpacked bytes.
- Candidate `vscode-extension/x4-forge-studio-0.0.63-b117-20260801-1824.vsix` is 17,964,903 bytes, SHA-256
  `5456DF296C784C295A47318B373EDE19C97A2A33D13AA00A6D78E5F67DD87CFA`. No marketplace publish occurred or
  was authorized.
- Installed Antigravity 1.107.0 reports `x4forge.x4-forge-studio@0.0.63`. Independent package-to-install parity
  checked 2,089 packaged extension files with zero missing, mismatched or unexpected files; normalized
  `package.json` matched, and archive `extension.vsixmanifest` exactly matched installed `.vsixmanifest` at SHA-256
  `BD1222499FD5752DAF5A64DA124250981CB896D993476E7896391D68EFAD279C`.
- The first installation attempt failed closed with `EPERM` while the prior extension was locked by the running IDE.
  After the one Antigravity window closed normally, retry printed installation success but the CLI wrapper then exited
  134 in its known V8 teardown path. That wrapper exit is not called green; independent extension inventory, creation
  time, 2,089-file parity and manifest parity prove the installed artifact.
- Real rendered-host proof -> PASS: Antigravity visibly rendered Forge `v1.0.409` in Expert mode with its managed
  sidecar on `:55694`, then the installed Agent Keys panel rendered the executable contract:
  `read = inspect only`, `write = edit/compile/validate/package (no deploys, no spend)`, and deploy limited to exact
  reviewed deploy/recovery, guarded filesystem and caller-key AI routes. Credentials, settings, GitHub, Steam
  handoff, human receipts and command execution visibly remain Studio-only. Evidence and the machine receipt are in
  `vscode-extension/evidence/2026-08-01-b117-authority/`.

### REVIEW

- Acceptance 1–10 remain done and evidenced by the v4 manifest, exact matcher, promotion audit, 378/378 external HTTP
  matrix, 129/129 runtime oracles, capability/MCP parity, secret-absence and no-mutation negatives, and installed UI
  copy. Acceptance 11 is now done: type/lint/build/writer/precommit source gates, full E2E, staged app, inspector,
  packaged bytes, installed parity and real rendered Antigravity all passed.
- The polling helper repair is a test-fixture isolation correction only. Both deliberately modal startup-conflict
  tests passed five consecutive iterations each while preserving the visible conflict and local/remote authority
  assertions; the ordinary helper path remains unchanged.
- The separate Antigravity agent pane displayed an unattributed `MCP Error` badge. It is not used as evidence for or
  against the installed Forge scope-copy gate, and this close does not claim installed external-agent connectivity.
- B64-SEC5 remains open and Ken-gated: a caller already holding the full Studio bearer can forge the legacy
  Origin/Referer compatibility signal. W2A proves scoped-key authority only and does not redesign that boundary.
- Capability-map delta: B42/B115 now has one exact deny-by-default v4 route authority and finite hierarchical presets.
  The delta is recorded in this repository close and ROADMAP. The external StarForge capability/AAR mirrors remain
  outside the repository-only authorization boundary and are not falsely presented as updated.

### CLOSE

- Status: `VERIFIED`. B117 / B115 W2A is complete. The historical `PARTIAL` checkpoint above remains accurate for
  its revision and is superseded by this final evidence, not rewritten.
- Deliberately unchanged: stored keys and presets, workspace/CAS semantics, W2B actor-specific narrowing/discovery,
  W3 receipts, B64-SEC5, game/mod/config directories, provider spend, public marketplace state and release version.
- Rollback remains source/config reversion to the checkpoint plus reinstalling the prior exact 0.0.63 VSIX. No data
  migration or external publish needs reversal.
- Suggested commit title: `security(agent): enforce exact reviewed route authority`.

### FINAL AAR

- Triggered: the Node 22 A/B failed on native ABI mismatch; a first fixture patch targeted the adjacent call before
  diff review corrected it; one full run lost its backend; the first install hit a live-file lock; the successful
  installer then suffered a V8 teardown crash; and an initial parity helper used unsupported `Byte.AsSpan` before the
  corrected independent oracle passed. A post-review precommit attempt also lost its MCP child to the same
  `0xC0000409` lifecycle class; five exact repeats and the final full precommit rerun passed. None of those attempts is
  relabelled green. The first commit invocation then used a 120-second wrapper around the repository's observed
  150-second hook, timed out without creating a commit or leaving an index lock, and was retried with an adequate
  bound rather than bypassing hooks.
- Sustain: zero-flake structured receipts, isolated live-state hashes, exact-test/prefix reduction, durable server
  logging, byte-level installed parity and eyes-on rendered inspection prevented inference from replacing proof.
- Improve work/approach: check native-addon ABI before runtime A/B; review narrow call-site diffs before validation;
  close the installed host before replacing an extension; treat installer narration and wrapper exit as separate
  evidence.
- Improve tools: the E2E runner should retain actual backend PID/exit/signal and native ABI compatibility; the
  Antigravity CLI should not crash after successful installation. Those are bounded follow-ups, not reasons to widen
  this security unit.
- Highest-risk evidenced weakness: B64-SEC5 still lets a full Studio-bearer caller spoof the compatibility origin used
  for stored provider credentials. It predates W2A, is not reachable through scoped agent keys, and remains an explicit
  product decision rather than a hidden completion claim.
- Project lesson banked here: installation success requires independent installed-byte and rendered-host proof when
  the installer process itself exits abnormally.
