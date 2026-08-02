# B115 W3B0 — action-receipt coverage oracle and pure request policy

Status: VERIFIED; implementation and declared validation complete, durable GitHub/commit synchronization in progress
Lane: FULL
GitHub owners: `#20` primary, `#19` convergence projection
Dependency: corrected W3A schema/store must be VERIFIED before this slice is accepted

## PLAN

- Bounded unit: add one machine-verifiable semantic inventory that joins every current non-GET API route,
  canonical capability effect, Agent History disposition, durable writer/host store/browser output/database owner,
  and explicit external side effect to an action-receipt policy. Add a pure request-policy resolver for later W3B
  integrations; do not mount receipt preparation or change route behavior in this slice.
- Authoritative references: `config/forge-route-dispositions.json`, `src/lib/agentAuthority.ts`,
  `src/lib/forgeCapabilities.ts`, `src/lib/agentHistory.ts`, `config/durable-writers.json`,
  `scripts/durable-writer-audit.mjs`, current Express registrations, and corrected W3A types.
- Assumptions: HTTP method is only a census signal, not semantic truth; POST analysis routes may be read-only, while
  browser/extension/database writers may mutate without an HTTP route. Canonical capability effects outrank a
  hand-written label.
- Unresolved fact: the current W3A store appears server-single-writer. W3B0 must prove whether any CLI, MCP,
  extension-host, or subprocess imports the store directly. A direct second writer changes W3A concurrency scope
  before route integration.

### In scope

- A versioned, canonical action-receipt coverage manifest with one reviewed disposition for every current non-GET
  route and every durable writer owner/surface.
- Policy classes that distinguish read/analyze-only POSTs, optional audit retention, durable local mutation,
  session/credential mutation, external/network/spend/publish/process effects, and conditional dev-only behavior.
- For receipt-requiring entries: exact effect set, applicable authority scope kind, integration batch, resource
  owner, route/capability identity, and a source anchor.
- A pure resolver which accepts reviewed route/capability authority plus request context and returns either a
  complete receipt requirement or a deterministic refusal. It does not write a receipt or invoke a handler.
- Candidate generation separated from reviewed manifest promotion.
- Drift tests that make a new route, effect, writer owner, host store, browser output, database writer, or external
  action fail closed until classified.

### Out of scope

- Preparing/finalizing receipts in Express middleware or route handlers.
- Changing existing response envelopes, Agent History behavior, filesystem writes, provider calls, credentials,
  commands, GitHub operations, MCP, CLI, Studio UI, or extension-host behavior.
- Treating every POST as a mutation or every raw filesystem call as a user action.
- W3B1-W3B3 route integration and W3C surface projection.

### Likely owned paths

- New `src/lib/actionReceiptCoverage.ts` and focused selftest.
- New `scripts/action-receipt-coverage-audit.ts`.
- New `config/action-receipt-coverage.json`.
- Minimal `package.json` and `scripts/precommit-check.mjs` script registration.
- A narrow production-bundle freshness assertion for `test:routes`, or an equivalent deterministic ordering gate,
  so its production-surface checks cannot pass against a stale `dist/server.cjs`.
- Reviewed route/capability manifest source/fingerprint deltas only when existing governance requires them.
- No receipt middleware, mutation-handler, response-envelope, UI, MCP, CLI, or extension behavior changes in W3B0.
  Acceptance-driven repairs to an existing dev-only process-exit contract and the route harness are recorded below.

### Risks and authorization boundaries

- False-negative risk: route-only enumeration misses browser, extension, database, retention, and external effects;
  the oracle must join all named inventories.
- False-positive risk: POST is frequently used for bounded analysis; semantic effect classification is explicit and
  checked against canonical capabilities.
- Drift risk: generated candidate data is not authority until reviewed and promoted. The normal audit reads only the
  reviewed manifest and fails on source drift.
- Secret risk: the manifest stores identities, effect classes, and anchors only—never keys, request bodies, prompts,
  environment values, or provider responses.
- No network, spend, publish, game/mod, live workspace, credential, or Git side effect is authorized.

### Rollback/checkpoint

- Baseline revision and dirty inventory remain those in the W3 master record.
- The slice is additive. Rollback removes only its new policy/audit files and narrow script/manifest registrations.
- Tests use in-memory mutations of candidate objects and temporary files only.

## ACCEPTANCE CONTRACT

1. Runtime discovery reports the current baseline of 292 reviewed routes, including 82 non-GET routes (81 POST and
   1 DELETE), without hard-coding those counts as permanent truth.
2. Every discovered non-GET route has exactly one reviewed semantic class and receipt policy. Unknown, missing,
   duplicate, stale, or overlapping entries fail the normal audit.
3. Canonical capability bindings inherit their declared effects. A manifest cannot erase or narrow
   `workspace-write`, `filesystem-write`, `package`, `deploy`, `delete`, `network`, `spend`, `credential`, or
   `publish`; a read/analyze-only classification contradicting those effects fails.
4. Every source owner in the durable-writer manifest—currently 34 raw filesystem sources, 11 host-store sources,
   2 browser-output sources, and the SQLite authority—is mapped to receipt-required, receipt-exempt fixture/cache,
   or separately governed internal retention. Missing and stale owner mappings fail.
5. Agent History quiet/visible classification is joined as observability only. A quiet route cannot hide a durable
   effect, and a visible history row cannot substitute for a receipt-required policy.
6. Provider-network, external-repository, command-session, credential, spend, publish, and deletion surfaces always
   resolve to an explicit receipt/refusal policy with applicable global/profile/workspace scope; they cannot default
   to read-only.
7. The pure request resolver emits deterministic actor/client/capability-or-reviewed-route, authority-scope,
   operation identity, declared effects, resources, and required recovery/validation policy—or refuses with a stable
   code. It never fabricates workspace/profile identifiers for a global action.
8. Negative fixtures prove a new route, changed canonical effect, undeclared writer owner, route/effect mismatch,
   invalid authority scope, duplicate entry, and generated-but-unreviewed candidate all fail closed.
9. Candidate generation is deterministic and writes only an explicitly named candidate path. Normal tests never
   overwrite the reviewed manifest.
10. No receipt-facing production route, response, store, network, provider, or UI behavior changes in W3B0. After
    validation reproduced pre-existing false route evidence, this criterion was narrowed explicitly to permit only
    the required route-harness freshness/extraction repairs and an honest dev-only run-command process-exit fix; no
    route, authority, mutation, spend, network, or user-visible capability may be added.

## REQUIRED VALIDATION

- Focused policy/selftest with positive and negative fixtures for acceptance items 2-9.
- Normal coverage audit and a deterministic candidate-generation comparison.
- `npm run typecheck`; focused lint; `npm run test:writers`; `npm run test:capabilities`;
  `npm run test:mcp-capabilities`; `git diff --check`.
- Existing `npm run test:routes` must remain green because W3B0 changes no route behavior.
- The route gate must fail or build when `dist/server.cjs` predates its server/import sources. W3A reproduced that
  running routes before build can report a green production surface and a subsequent build can still create a
  startup-crashing bundle.
- Fresh-eyes diff review must reconcile every manifest class against the authoritative effect and writer sources.
- No e2e, package, installed-extension, rendered UI, or X4 gate applies until behavior/surface integration.

## EVIDENCE LOCATIONS

- Machine evidence: `test-results/2026-08-02-w3-action-receipts/w3b0/`.
- Task close: this file and the W3 master record.
- Durable close only after VERIFIED: `ROADMAP.md`, `SESSION-HANDOFF.md`, capability-map delta if applicable, AAR
  ledgers, and the `#20`/`#19` implementation blocks.

## BASELINE

- Revision: `35c36cc97d0b26623dca79f3d37df63144ee6669`; `origin/main` and remote main matched at handoff.
- Reviewed route manifest: 292 routes; 82 non-GET = 81 POST + 1 DELETE; one dynamic selftest registrar.
- Resource classes include 3 command-session, 9 external-repository, 15 global-session, 5 provider-network,
  30 configured-root, 16 workspace, 12 inline-or-addressed, and 33 stateless-analysis routes.
- Durable-writer audit is green at 34 raw filesystem sources, 11 host stores, 2 browser outputs, and SQLite with
  47 mutation statements / 7 transactions / 14 run calls.
- Agent History capture is fail-soft and runs on response `finish`; it is not transaction authority.
- No current source imports `ActionReceiptStore` outside the W3A store/selftest candidate. W3B0 must repeat this
  check after W3A correction and before claiming server-single-writer architecture.
- Repeated at W3B0 start: Graphify reverse impact reaches `actionReceipt.selftest.ts` and `server.ts` only through the
  registered oracle; repository search finds the only executable `ActionReceiptStore` import in
  `actionReceipt.selftest.ts`. No CLI, MCP, extension host, subprocess, or production handler owns a second writer.

## RECONCILE

- Reuse `forge-route-dispositions.v4` as the route census and authority identity, not as receipt semantics.
- Reuse canonical capability effects where they exist; require explicit reviewed legacy-route effects elsewhere.
- Reuse the durable-writer audit's discovered calls and reviewed owners; do not create a second raw-write scanner.
- Reuse `LEDGER_QUIET_ROUTES` only to detect observability contradictions.
- Capability-map delta: none at specification.
- Extend-versus-replace: extend the current audits with one join/policy layer. Replacing the mature route or writer
  scanners would duplicate working drift detection.
- Plan change after validation: acceptance item 10 was narrowed when the mandatory route gate reproduced two
  independent false-evidence defects. The bounded repair may make the existing gate fresh and truthful, but may not
  introduce receipt consumption or new command authority.

## IMPLEMENT

- W3A is accepted. The initial combined W3B0 semantic work order and four cold-start replacements produced no owned
  files before checkpoint/interrupt. The implementation is therefore split at stable dependency seams and assigned
  through the already-proven native Luna worker: type/schema scaffold, strict validator, resolver, focused selftest,
  read-only inventory builder, candidate workflow, reviewed promotion, then precommit registration.
- A separate native `luna_executor` completed the route-production freshness gate in
  `scripts/route-integration.mjs`: `test:routes` now performs a required synchronous build before starting any route
  server and fails closed when that build cannot start or exits nonzero.
- `src/lib/actionReceiptCoverage.ts` now defines the strict versioned route/surface policy schema, live canonical
  effect reuse, exact inventory reconciliation, semantic/policy contradictions, deterministic errors, and the pure
  fail-closed request resolver. It emits a W3A `ActionReceiptPrepareInput` only for a validated receipt-required
  route with exact scope/effects; exempt/separately-governed routes emit no receipt input and refused/invalid routes
  emit stable refusal codes.
- `src/lib/actionReceiptCoverage.selftest.ts` covers validator and resolver branches in memory. Fresh-eyes corrections
  bound reviewed-legacy identity to the route key, removed a duplicated canonical-effect list, barred external and
  credential effects from fixture/cache exemptions, tightened audit/external-surface semantics, and proved the exact
  canonical and legacy resolver outputs through W3A construction and serialization.
- The completed native `luna_executor` inventory/classifier lane owns only the audit script. Deterministic candidate
  generation, its contained atomic writer, explicit hash-pinned promotion, normal reviewed audit, package scripts,
  and precommit registration are implemented. No production receipt handler or response behavior is in scope.
- The inventory/classifier seam is now source-reviewed across the complete current census: 82 non-GET routes and
  48 non-route mutation surfaces. The candidate builder always derives from the current route/capability/history and
  durable-writer authorities; the initially proposed prior-manifest overlay was removed because it could preserve a
  stale scope or effect after `workspaceMode` or writer-category drift. Counts are observed evidence, not permanent
  assertions; the invariant compares candidate rows to the dynamic inventory.
- Fresh-eyes source review corrected false-green semantics before any candidate could be written: deploy verification,
  Steam verification, package/release stages, schema harvest, workspace restore, snapshot pruning, configuration and
  credential lifecycle, generated-workspace application, GitHub device credentials, user exports, internal recovery
  deletion, extension-sidecar process launch, browser outputs, persistent browser state, audit-only stores, artifact
  materializers, workspace/config authorities, and native verified export. The candidate workflow now emits a strict
  `forge.action-receipt-coverage-candidate.v1` / `UNREVIEWED` envelope only beneath the repository's real
  `test-results` tree. It rejects traversal, links, non-files, missing parents, wrong suffixes, and config paths;
  snapshots the target by identity, metadata, size, and SHA-256; rechecks containment and the snapshot immediately
  before atomic rename; and reopens exact bytes. Explicit review promotion, normal audit, and precommit registration
  are complete.
- Validation-driven route repair remained bounded to existing evidence truth. `scripts/route-integration.mjs` now
  synchronously builds the candidate before any route server starts and uses the host's absolute System32 `tar.exe`
  as its independent ZIP extractor on Windows. The dev-only run-command timeout path keeps `taskkill /T /F` primary,
  then uses a bounded numeric-PID-only PowerShell descendant closure when this sandbox denies taskkill; only helper
  exit 0 after exact captured-PID absence can set `processExited=true`. Existing route authorization and assertions
  are unchanged.

## VALIDATE

- Route freshness positive: `npm run test:routes` rebuilt the production bundle and returned 400/400 PASS.
- Route freshness negative: an explicitly invalid `npm_execpath` returned exit 1, reported the required-build
  failure, emitted no 400/400 PASS, and left no route/server process behind.
- Pure schema/validator/resolver: focused selftest 98/98 PASS, including real canonical and reviewed-legacy W3A
  prepared-receipt construction plus deterministic serialization; coordinator reproduction also returned 98/98.
- `npm run typecheck`, focused lint on both pure files, and focused `git diff --check` PASS.
- Existing capability audit remains PASS at 11 capabilities, 292 literal routes, 1 dynamic registrar, 10 MCP aliases,
  contract hash `d8a820f537dbcbb50bcb8a91c8bd415c221a15940f184e38a817fa4566c1ac8f`.
- Reviewed promotion/audit, writer/MCP gates, and precommit are complete.
- Read-only inventory discovery reports 292 total routes, 82 non-GET routes, and 48 durable/host/browser/database
  surfaces. The source-reviewed semantic invariant is 43/43 PASS; the fresh manifest validates, matches the dynamic
  census, preserves its inputs, and repeats byte-for-byte. Current pretty-JSON-plus-LF manifest SHA-256 is
  `e7a1426590e64bca7c184f7adb0c77fbee5c00be02773624dfe92294dca279a7`.
- Candidate path/envelope/semantic aggregate: 57/57 PASS. Config-directory and parent-traversal CLI attempts returned
  exit 1 with stable refusal codes before prerequisite work and created no config file. Coordinator writer
  reproduction proved identical repeat SHA, preservation of prior bytes after an injected pre-rename failure, and
  zero leaked temporary files. Typecheck, focused lint, and focused diff check remain green.
- The prerequisite-gated real candidate is
  `test-results/2026-08-02-w3-action-receipts/w3b0/action-receipt-coverage.candidate.json`: 96,920 bytes,
  envelope SHA-256 `455997b3ba43a9efcf380b4a4705b8bd1ed667a1208d1654b9b952448bf1c15c`, inventory SHA-256
  `fefdc995aa084596d88c2c8c1b9d9da63cd58f34b22a3e8e627cdb86e6dbff63`, 82 routes, and 48 surfaces. Independent
  reopen matched a fresh envelope byte-for-byte, its inner manifest validated against the current inventory, no temp
  file remained, and the reviewed config was still absent before promotion.
- Promotion implementation selftest: 23/23 PASS. Fresh-eyes review covered exact envelope fields and canonical bytes,
  fixed config containment, stable candidate/reviewed snapshots, explicit candidate and prior-reviewed hash pins,
  before-rename race detection, exact reopen verification, current-inventory equality, and exact CLI argument order.
  A coordinator-injected pre-rename failure returned
  `ACTION_RECEIPT_COVERAGE_PROMOTION_WRITE_FAILED`, left config absent, and leaked no temporary file.
- The prerequisite-gated initial promotion with expected current state `ABSENT` returned `REVIEWED` and wrote only
  `config/action-receipt-coverage.json`: 90,735 bytes, manifest SHA-256
  `e7a1426590e64bca7c184f7adb0c77fbee5c00be02773624dfe92294dca279a7`, inventory SHA-256
  `fefdc995aa084596d88c2c8c1b9d9da63cd58f34b22a3e8e627cdb86e6dbff63`, 82 routes, and 48 surfaces. Independent
  comparison proved exact equality to the candidate's inner manifest. A stale `ABSENT` retry and a wrong candidate
  hash both refused before write, preserved exact reviewed bytes, and leaked no temp.
- The independent normal `--audit` path reran prerequisites and both selftest suites, reopened the fixed reviewed
  manifest, matched current generated inventory byte-for-byte, and returned PASS with the same hash and counts.
- Final static/authority batch: package selftests 57/57 + 23/23, typecheck PASS, full ESLint 0 errors / 587 existing
  warnings, durable writers 14/14 plus extension writer 8/8, capability authority 11 capabilities / 292 literal
  routes / one dynamic registrar / 10 MCP aliases, MCP authority read 5 / write 9 / deploy 10, and focused diff check
  PASS.
- [REPRODUCED] The required final production-route gate built successfully but returned 396/400 on three consecutive
  runs. One failure was real server truth drift: the 200 ms async command timeout reported `timed_out` while
  `processExited` remained false through a three-second poll, although an independent post-run process query found no
  sleeper. Three dependent Nexus checks failed because Windows PowerShell could not autoload `Expand-Archive`
  (`CommandNotFoundException` / `CouldNotAutoloadMatchingModule`); Forge's own ZIP reopen verification stayed green.
  Ports 3000/3001/3100/3101 had zero listeners after failure. At that point close validation remained red pending
  both disjoint repairs and the complete 400/400 rerun.
- The independent bsdtar repair removed all three Nexus failures on the next full rerun, but the first server
  termination repair still returned 399/400: `taskkill /T /F` was now awaited honestly, yet its real exit was 1 /
  `ERROR: Access denied`, so `processExited` correctly remained false. A minimal probe also proved that killing only
  the retained `cmd.exe` handle leaves its PowerShell descendant alive. The server repair was rejected and reopened;
  the corrected plan keeps taskkill primary and adds a bounded exact-descendant `pwsh` termination/absence-verification
  fallback for this host class. The assertion and three-second poll are unchanged.
- The corrected exact-descendant fallback passed the unchanged complete route gate: `npm run test:routes` rebuilt
  `dist/server.cjs` and returned 400/400 PASS. Post-run process and port inspection found no route server, sleeper,
  or listener on 3000/3001/3100/3101.
- Isolated production runtime proof with repository-contained `TEMP`/`TMP` returned 130/130 runtime-indexed oracles,
  stopped its exact server, left its probe port closed, and removed its isolated state root. The earlier 129/130 run
  is retained as evidence that an inaccessible user-profile temp root correctly fails the receipt-store oracle.
- Graphify refresh initially failed because the installed shim's user-profile runtime was sandbox-inaccessible. The
  approved host invocation then completed deterministically at 4,249 nodes / 10,210 edges / 178 communities.
- First complete `npm run precommit:check` after implementation returned exit 0 in 217.6 seconds: tripwires 0,
  mirror parity, verdict 26/26, product-copy, writer 14/14 plus extension 8/8, 11-capability / 292-route / 10-MCP
  authority, receipt-coverage PASS at 82 routes / 48 surfaces and hash
  `e7a1426590e64bca7c184f7adb0c77fbee5c00be02773624dfe92294dca279a7`, typecheck, and size gates all passed.
- Final synchronized `npm run precommit:check` after repository and StarForge durable close updates returned exit 0
  in 192.8 seconds with the same exact receipt-coverage hash/counts and every repository gate green.
- Visual/installed/X4 applicability: none for W3B0. It creates no visible extension control and mounts no production
  receipt consumer. Installed/rendered Antigravity proof remains mandatory for W3C; X4 remains stopped and is not a
  gate for this pure policy checkpoint.

## REVIEW

- Pure-engine review complete after corrections: canonical effects now come from the runtime registry rather than a
  duplicated list; legacy identity cannot drift from its route; audit/cache/external classes cannot hide incompatible
  effects; scope/effect refusal is exact; and resolver output passes the real W3A constructor/serializer.
- Complete classification review: all 82 routes and 48 surfaces were printed and reconciled by resource against the
  live handlers and durable-writer owners. Current policy totals are 46 receipt-required routes, 20 receipt-exempt
  routes, 15 separately governed audit routes, and one refused dev command route; surfaces are 27 receipt-required,
  15 receipt-exempt, and six separately governed. No conditional route remains silently allowed. The written
  candidate was reopened, hash-pinned, and matched to the already source-reviewed fresh manifest; promotion review is
  complete. The UNREVIEWED envelope remained non-authoritative until the explicit `ABSENT`/candidate-hash promotion;
  the promoted inner manifest is now the sole reviewed authority. Package/precommit registration and all declared
  repository gates are complete.
- Acceptance review 1-10: all done and evidenced. The only contract change is the explicit item-10 narrowing above;
  the repaired route/process evidence path adds no receipt consumer, route, or user-facing capability.

## CLOSE

- Status: `VERIFIED`.
- Changed: strict reviewed coverage manifest and drift oracle, pure receipt-policy resolver, deterministic candidate
  and promotion workflow, precommit enforcement, fresh production-route evidence, and truthful dev command-tree exit
  reporting on the reproduced Windows denial path.
- Deliberately unchanged: every production mutation handler and every API/UI/MCP/CLI/extension receipt projection.
- Capability-map delta: reviewed receipt-policy coverage and fail-closed drift authority only; explicitly not
  production mutation integration or visible parity.
- Rollback: remove the W3B0 policy/audit/config registrations and revert only the bounded route/process evidence
  repairs. Existing W3A records and all user data remain untouched.
- Remaining risks: W3B1-W3B3 still must bind the 46 required routes and 27 required non-route surfaces to real
  prepare/finalize/fail receipts; W3C still owns installed Antigravity projection and rendered proof.
- Suggested close title: `feat(authority): enforce action receipt coverage inventory`.

## AAR

- Triggered by reconciliation: the route manifest has 292 registrations but only 82 non-GET routes, and both sets
  contain semantic exceptions; method-based receipt inference would be wrong in both directions.
- Sustain: join existing route, capability, writer, host-store, browser-output, database, and history evidence.
- Improve work/approach: require candidate review instead of allowing a generator to self-authorize new effects.
- Improve tools: the current audits prove route and write drift independently but do not prove transaction-receipt
  coverage across their join.
- Improve tools/evidence: `test:routes` probes the existing production bundle but does not build or prove it is fresh;
  W3A therefore saw a stale-dist 400/400 result before the next build reproduced a CommonJS startup crash.
- Improve work/approach: five cold-start semantic/audit workers spent their checkpoint window without creating an
  owned file. Reusing the previously successful native Luna child and splitting work into mechanical dependency seams
  restored reliable progress without violating the Sol/Luna write boundary.
- Improve work/approach: the proven reused worker later produced no file delta for six minutes on the combined
  candidate-envelope/containment/atomic-write order and still produced none after a two-minute narrowed interrupt.
  It was closed before overlapping work and the unit was split again at the pure envelope/path seam for a fresh native
  Luna. Candidate writing remains a later seam rather than being improvised by the coordinator.
- Improve work/approach: the eventual writer implementation needed an interrupted worker checkpoint and an
  independent coordinator reproduction because the first direct verification output was truncated. The compact
  rerun proved preservation and cleanup without relying on the worker's narration; future evidence commands should
  emit bounded summaries from the outset.
- Improve tools: the first package/precommit delegation call failed locally because an unescaped command example
  terminated the JavaScript template literal. No worker message or repository mutation occurred; the work order was
  resent as a line array. Tool-orchestration prompts should avoid nested template delimiters.
- Improve work/approach: the final route gate changed the plan by reproducing two pre-existing acceptance failures.
  Repair server-owned process-exit truth and the independent Windows extraction oracle in disjoint lanes; do not
  weaken assertions or label a successful build as route success.
- Improve tools: despite an earlier W3A lesson, the first route-cleanup diagnostic again put a potentially red grep
  beside its sibling in one combined wrapper; the red exit discarded both results. The cleanup query was rerun alone
  with an explicit structured result. Never aggregate a diagnostic that may legitimately return exit 1 unless each
  child captures and reports its own exit status.
- Improve tools: an escalated `npm run test:routes` approval path yielded no output for roughly 81 minutes and was
  terminated; exact process/port checks then found no validation process or listener. Computer Use was initialized as
  a possible host path, but its mandatory safety policy forbids terminal automation, so no Antigravity terminal input
  occurred. Host-runtime validation must use an allowed execution surface rather than UI-driving a terminal.
- Improve work/approach: the first command-tree repair was static/build green but runtime red at 399/400. Capturing
  taskkill's real stderr and comparing it with direct-shell behavior identified the sandbox permission boundary; the
  second repair must prove full descendant closure and post-kill absence rather than equating shell exit with tree
  exit.
- Improve work/approach: fresh-eyes review found green-test omissions in canonical effect drift, reviewed-legacy
  identity, fixture/cache external effects, and real W3A constructor compatibility; each was corrected before the
  inventory manifest could depend on the engine.
- Improve tools/evidence: direct one-file ESLint on the Node `.mjs` route script uses the repository's browser/global
  lint context and reports baseline `no-undef` noise; syntax, deterministic negative behavior, the real route gate,
  and the repository precommit command are the applicable evidence for that script.
- Improve work/approach: the runtime oracle was first invoked without its owning server (0/129), then with an
  inaccessible user-profile temp root (129/130). The final isolated server-owned harness with repository-contained
  `TEMP`/`TMP` returned 130/130 and cleaned up. Runtime oracles must be run through their owning harness with an
  explicitly writable state root.
- Improve tools: Graphify's global shim resolves into a profile runtime hidden from the sandbox. The approved exact
  `graphify update` host command succeeded; keep that narrow approval instead of treating the derived graph as
  silently current.
- Improve work/approach: a fail-fast combined wrapper discarded independently completed sibling results three times,
  including a final static batch where one trailing-whitespace check was red. Run red-prone diagnostics serially or
  catch and report each child result before aggregation.
- Highest-risk evidenced weakness: W3B0 now proves that every known effect has a reviewed receipt policy, but it does
  not prove those required effects actually emit receipts. W3B1-W3B3 are the bounded integration fix.
- Lessons banked: project and general AAR ledgers updated at the verified close.
