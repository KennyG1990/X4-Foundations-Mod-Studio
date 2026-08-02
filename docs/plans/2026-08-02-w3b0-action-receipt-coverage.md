# B115 W3B0 — action-receipt coverage oracle and pure request policy

Status: SPECIFIED; implementation not started
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
- No `server.ts` route/middleware changes in W3B0.

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
10. No production route, response, store, process, network, provider, or UI behavior changes in W3B0.

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

- Revision: `ce5266a34ed7c560bd6d98e409251c90b1b9430e`.
- Reviewed route manifest: 292 routes; 82 non-GET = 81 POST + 1 DELETE; one dynamic selftest registrar.
- Resource classes include 3 command-session, 9 external-repository, 15 global-session, 5 provider-network,
  30 configured-root, 16 workspace, 12 inline-or-addressed, and 33 stateless-analysis routes.
- Durable-writer audit is green at 34 raw filesystem sources, 11 host stores, 2 browser outputs, and SQLite with
  47 mutation statements / 7 transactions / 14 run calls.
- Agent History capture is fail-soft and runs on response `finish`; it is not transaction authority.
- No current source imports `ActionReceiptStore` outside the W3A store/selftest candidate. W3B0 must repeat this
  check after W3A correction and before claiming server-single-writer architecture.

## RECONCILE

- Reuse `forge-route-dispositions.v4` as the route census and authority identity, not as receipt semantics.
- Reuse canonical capability effects where they exist; require explicit reviewed legacy-route effects elsewhere.
- Reuse the durable-writer audit's discovered calls and reviewed owners; do not create a second raw-write scanner.
- Reuse `LEDGER_QUIET_ROUTES` only to detect observability contradictions.
- Capability-map delta: none at specification.
- Extend-versus-replace: extend the current audits with one join/policy layer. Replacing the mature route or writer
  scanners would duplicate working drift detection.

## IMPLEMENT

- Pending native `luna_executor` work order after corrected W3A is accepted.

## VALIDATE

- Pending.

## REVIEW

- Pending. The coordinator must manually review the complete generated classification; a green generator is not
  evidence that the semantic labels are correct.

## CLOSE

- Status: SPECIFIED.
- Suggested close title after verification: `feat(authority): enforce action receipt coverage inventory`.

## AAR

- Triggered by reconciliation: the route manifest has 292 registrations but only 82 non-GET routes, and both sets
  contain semantic exceptions; method-based receipt inference would be wrong in both directions.
- Sustain: join existing route, capability, writer, host-store, browser-output, database, and history evidence.
- Improve work/approach: require candidate review instead of allowing a generator to self-authorize new effects.
- Improve tools: the current audits prove route and write drift independently but do not prove transaction-receipt
  coverage across their join.
- Improve tools/evidence: `test:routes` probes the existing production bundle but does not build or prove it is fresh;
  W3A therefore saw a stale-dist 400/400 result before the next build reproduced a CommonJS startup crash.
- Highest-risk evidenced weakness: a new durable effect can currently pass one inventory while remaining absent from
  the other, leaving no single gate that proves it has receipt/rollback authority.
- Lessons banked: none until implementation evidence is VERIFIED.
