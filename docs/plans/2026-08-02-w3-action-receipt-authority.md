# B115 W3 — authoritative action receipts and transaction truth

Status: W3A and W3B0 VERIFIED; W3B1 IN_PROGRESS / PARTIAL with workspace replace/merge route-green
Lane: FULL
GitHub owners: `#20` primary, `#19` convergence projection
Dependency: W0-W2B VERIFIED through B118

Current W3B1 plan: `docs/plans/2026-08-02-w3b1-addressed-state-receipts.md`

Product boundary correction (owner, 2026-08-02): W3 ships only as part of the installed Antigravity/VS Code IDE
extension. The bundled Studio panel and extension-managed sidecar are components of that extension, not a standalone
web app. There is no end-user CLI product; older CLI/all-surface language below is superseded by the corrected W3C
contract in this plan.

## PLAN

- Bounded unit: build one durable, versioned Forge action-receipt authority over the existing Agent History,
  workspace CAS, destructive recovery, artifact/build/package/deploy result types, canonical capability/route
  authority, Agent API, MCP, and built-in harness seams.
- This plan has three reviewed implementation batches: W3A schema/store, W3B current mutation integration, and W3C
  surface projection. No batch may claim all of W3 before the later batches pass.
- Assumptions: history rows are useful but deliberately fail-soft; recovery records are authoritative for destructive
  rollback; workspace records and hashes are authoritative for addressed canvas state; artifact/deploy/package
  objects already own their domain-specific hashes/effects.
- Unresolved fact to settle in W3B reconciliation: enumerate every current route classified as mutating and map it to
  one of (a) required receipt, (b) session-only credential/configuration receipt with secret-redaction rules, or
  (c) explicitly non-action observational history. No unclassified write may be promoted to success.

### In scope

- A pure `forge.action-receipt.v1` record with canonical serialization and content hash.
- Immutable actor, client, capability `id@version` or reviewed legacy route identity, request/workspace/profile
  authority, declared effects, input/before/after hashes, rule/request authority, validation outcome, rollback or
  recovery reference, status, timestamps, and failure details.
- A durable atomic receipt store under `X4_DATA_DIR`, independent from rotating history retention.
- State transition validation: prepared -> committed, prepared -> failed/rolled-back/incomplete, and committed ->
  compensated; no rewrite of terminal facts and no duplicate/conflicting receipt ID.
- Adapters that project receipts into Agent History without making the rotating history store authoritative.
- W3B integration of all current supported mutation paths, reusing current guarded writers and recovery.
- Receipt projection through the installed extension's embedded Studio/history and native IDE controls, with
  extension-managed MCP when applicable. The sidecar API and harness are internal support/proof seams.

### Out of scope

- W4 deterministic release normalization/secret scan, except the receipt schema fields needed to consume later hashes.
- Provider execution, Effective Tree, rule packs, semantic rebase, upstream network intelligence, and public release.
- A generic model-driven dispatcher or replacement workflow engine.
- A standalone browser application, packaged/headless end-user CLI, or CLI parity work.
- Storing prompts, keys, tokens, provider secrets, raw environment variables, or arbitrary response bodies in
  receipts.

### Likely owned paths

- New: `src/lib/actionReceipt.ts`, `src/lib/actionReceiptStore.ts`, `src/lib/actionReceipt.selftest.ts`.
- Existing: `src/lib/agentHistory.ts`, `src/lib/agentHistoryStore.ts`, `src/lib/destructiveRecovery.ts`,
  `src/lib/forgeCapabilities.ts`, `src/lib/agentAuthority.ts`, `server.ts`.
- Tests/audits: `scripts/route-integration.mjs`, `scripts/capability-contract-audit.ts`, runtime selftest registry in
  `server.ts`, and focused receipt failure fixtures.
- W3C surfaces as needed: the bundled Studio/history UI, native extension controls, and
  `vscode-extension/mcp/x4forge-mcp.cjs`; built-in harness types remain test support. Exact extension UI/MCP write
  ownership is deferred until W3A/B establishes the stable envelope.

### Risks and authorization boundaries

- Data-loss risk: a mutation could occur and receipt finalization could fail. Required recovery must exist before the
  mutation; failure must roll back or report incomplete state with a durable recovery reference.
- Availability risk: making the existing fail-soft history store mandatory would let retention/rotation faults break
  unrelated work. The new receipt store is narrowly authoritative only for actions that claim a committed mutation;
  history projection remains fail-soft.
- Compatibility risk: existing API fields, `2026-07-30.agent.v4`, MCP names, key presets, and workspace identity must
  remain compatible. Receipt fields are additive until a separately versioned API decision.
- Secret risk: receipts capture hashes and redacted metadata only. Negative scans cover key/token/body leakage.
- Authority-scope risk: workspace/profile identifiers are not applicable to global configuration, session,
  credential, process, and network actions. The record uses an explicit discriminated authority scope and rejects
  callers that fabricate an unrelated workspace/profile identity merely to satisfy the schema. Legitimate project
  identities such as profile `default` remain valid.
- Concurrency risk: W3 routes share one server-owned receipt writer. W3B must prove there is no direct multi-process
  store writer; if reconciliation finds one, W3A gains serialized transition/CAS protection before integration.
- No game/mod/installed configuration write, provider spend, marketplace publish, or public release is authorized by
  W3.

### Rollback/checkpoint

- Baseline commit and dirty inventory are recorded in the master program.
- All receipt tests use temporary data/workspace/deployment roots.
- W3 additions are isolated; rollback removes only W3-owned files/hunks. Mutation integration must prove exact
  pre-state restoration before a failed batch can be marked REVERTED.

## ACCEPTANCE CONTRACT

### W3A — schema and durable store

1. `forge.action-receipt.v1` validates complete records and rejects unknown schema versions, malformed hashes,
   missing actor/capability/applicable authority, undeclared effects, invalid state transitions, timestamps that
   contradict transitions, and terminal-record mutation. Authority is a discriminated global/workspace/profile
   scope: each kind requires only its applicable identifiers and rejects extraneous cross-scope fields; it does not
   blacklist legitimate identifiers merely because their words resemble placeholders. A reviewed legacy-route
   identity includes both exact HTTP method and path; path-only authority is invalid.
2. Canonical serialization and receipt hash are deterministic across property order, time zone, host locale, and
   machine path. No ambient timestamp or absolute local path enters the hashable authority payload.
3. The store writes atomically under a relocatable data root, verifies bytes/hash on read, rejects traversal and
   symlink/junction escapes before creating any directory or file outside the lexical root, and never returns a
   corrupt receipt as valid. Schema/transition refusal retains `ACTION_RECEIPT_INVALID`; it is never mislabeled as a
   storage outage.
4. Receipt IDs and hashes are idempotent for the same prepared action. The immutable request scope includes a
   caller-owned operation/idempotency identity so two intentional external effects cannot collapse into one receipt.
   Receipt ID is derived from that namespaced operation identity, while `authorityHash` covers all immutable prepare
   facts. Reusing one operation identity with changed request/resources/effects/metadata/rollback authority resolves
   to the same receipt path and fails as a conflicting duplicate; an arbitrary well-shaped ID fails validation.
5. A committed receipt contains actor/client, capability or reviewed legacy route, authority hashes, declared
   effects, input/before hashes, validation result, and rollback/recovery truth applicable to that action. Its
   lifecycle result records an after-hash for every declared resource; after-hashes are not immutable prepare facts.
   An effect's resource copy must exactly equal its canonical authority resource, including `beforeHash`; identity
   equality alone cannot admit contradictory pre-state. A `no_change` result requires every resource's after-hash to
   equal its declared before-hash.
6. An explicit terminal `incomplete` state records observed partial after-state, failed validation/finalization,
   failure details, and durable recovery/rollback truth. A route may never translate it into ordinary success.
7. Redaction tests prove secrets and raw provider/key material cannot enter any serialized field, including resource
   roots/paths and authority identifiers. Credential-shaped values are rejected; ordinary identifiers such as
   `default`, `environment-config`, `environment-agent`, or `credentials.json` are not confused with secret bytes.
   Rollback lifecycle is semantically closed: a reversible prepared receipt starts `prepared`; only a reversible
   action whose every declared effect is reversible can become `rolled_back` or `compensated`, and those states
   require `performed` recovery. Compensation preserves the exact committed validation and after-state facts rather
   than rewriting history.
8. Agent History can link to/project a receipt; deleting/rotating/corrupting history cannot delete or change receipt
   authority, and a history append failure cannot fabricate receipt success.

### W3B — mutation integration

9. A machine-generated route/capability inventory classifies every current non-GET write path. The audit fails for a
   new or unclassified mutation and for a descriptor whose effects disagree with the route.
10. Each supported mutation prepares a receipt and required pre-state recovery before writing, finalizes only after
   deterministic postcondition/validation, and returns the receipt identity in its success envelope.
11. If preparation fails, no mutation occurs. If mutation fails, a failed receipt records the error and prior state
    remains/restores. If finalization fails after mutation, the path rolls back or returns a non-success incomplete
    result with durable recovery evidence; it never returns ordinary success.
12. Workspace writes use immutable workspace ID plus expected workspace/snapshot hashes. Filesystem/deploy writes use
    exact root, contained relative path, before/after fingerprint and existing recovery/rollback authority.
13. Key/config/session mutations use the applicable global/profile authority kind and record redacted identity/effects
    and exact outcome without secret bytes. Read-only
    analysis that merely writes optional history remains truthfully declared as audit retention, not a user-state
    transaction.
14. Existing optimistic concurrency, dry-run-first deploy, recovery replay refusal, and rollback semantics remain
    intact.

### W3C — one receipt throughout the IDE extension

15. The installed extension's embedded Studio/history, native IDE controls/editors, and optional extension-managed
    MCP reference the same receipt schema and identity. The extension-owned sidecar API and harness may transport or
    verify that truth but are not separate user products. No surface may alter status, effects, refusal, or rollback
    truth.
16. Unknown/malformed receipt data fails closed for a mutating extension action. An older or attached sidecar without
    W3 is reported as lacking authoritative receipts; the extension never invents them.
17. Representative equivalent extension actions yield equivalent receipt fields and refusal codes for wrong
    workspace, stale state, under-scoped key, invalid root, failed validation, receipt-store failure, and rollback
    failure.
18. No hidden mutation remains available only to an internal harness or bearer path, and no standalone web/CLI
    product is created to satisfy parity.

### Required validation

- Focused pure selftest for schema, canonical hash, discriminated authority scopes, complete and incomplete state
  transitions, per-resource before/after hashes, path containment with no write-before-refusal, corruption,
  idempotency identity, duplicate conflict, retention independence, and redaction across every serialized field.
- `npm run typecheck`; `npm run lint`.
- `npm run test:capabilities`; `npm run test:mcp-capabilities` as applicable per batch.
- `npm run test:routes` with injected prepare/finalize/store failures and exact no-false-success assertions.
- `node scripts/oracle-sweep.mjs` against the host runtime; W3 selftest must be runtime-indexed and green.
- `npm run test:e2e` after W3B/W3C, with ephemeral shutdown and live-workspace preservation proof.
- `npm run build`, staged app/probe, VSIX inspection, exact installed parity, and real Antigravity receipt/history
  rendering when W3C ships visible extension bytes.
- Negative path minimum: receipt root unavailable before mutation; finalization failure after a reversible mutation;
  stale workspace hash; traversal/root mismatch; malformed receipt; history-store failure; secret-bearing input.
- No running-X4 proof applies to W3.

### Evidence locations

- Task close: this file.
- Machine evidence: `test-results/2026-08-02-w3-action-receipts/`.
- Packaged/installed/rendered evidence: `vscode-extension/evidence/2026-08-02-w3-action-receipts/`.
- Durable close: `ROADMAP.md`, `SESSION-HANDOFF.md`, capability-map delta, project/global AAR ledgers, GitHub `#20`
  and `#19` implementation blocks.

## BASELINE

- Revision: `ce5266a34ed7c560bd6d98e409251c90b1b9430e`.
- `AgentHistoryStore.append()` returns `false` and records its own fault; route middleware runs on `finish` after the
  response and ignores the append result. Therefore history is observed after success and cannot be the W3 authority.
- `DestructiveRecoveryStore` already provides atomic bounded pre-state records and one-time CAS restore for workspace
  and deployment actions.
- Workspace registry owns immutable workspace ID, revision and content/snapshot hashes.
- Artifact/build/package/deploy/release results already carry domain hashes/effects but do not share one action
  receipt identity.
- W0-W2B provide the exact capability/effect/route/key authority that W3 must reference.
- No dedicated receipt oracle existed at baseline because the receipt schema/store did not exist. The inherited B118
  close was green, and the master-program dirty inventory was captured before mutation. W3A validation below is
  measured from the final candidate; it does not relabel unrelated pre-existing worktree changes.

## RECONCILE

- Reused resources: Agent History JSONL/CAS blobs for human audit projection; workspace registry/CAS for addressed
  state; destructive recovery for rollback; artifact pipeline and packager results for hashes/effects; capability and
  route authority for actor/effect declarations; current API/MCP/harness surfaces.
- Presence proved: fragmented receipts/recovery/hash result objects exist and several destructive paths already fail
  closed when recovery finalization fails.
- Absence proved within `src/lib`, `server.ts`, extension MCP, and current task records: there is no one durable
  action-receipt schema/store whose successful persistence is a precondition for reporting committed mutation.
- The released route-disposition manifest currently contains 82 `POST`/`DELETE` registrations. That is not the W3B
  receipt count: many are body-bearing reads/analysis, while durable mutation also occurs through browser/extension
  stores and artifact stages. W3B's coverage oracle must join route disposition, `LEDGER_QUIET_ROUTES`, canonical
  capability effects, `config/durable-writers.json`, host-store inventory, and explicit external/network actions. It
  must classify semantic effects instead of equating HTTP verb with mutation.
- Existing history policy already defaults an unknown non-GET API route to a visible generic row. W3B may reuse that
  census as a drift input, but an `action` history label is not enough authority to commit a mutation receipt.
- Extend-versus-replace: extend. The existing components have distinct valid responsibilities; replacing them would
  duplicate working history, CAS, recovery, and artifact logic.
- Capability-map delta: none at specification. Add receipt authority only after the applicable batch is VERIFIED.
- Plan change from reconciliation: W3 is split into W3A/W3B/W3C so a pure schema/store cannot be mistaken for
  transactional integration or surface parity.
- Review change after the first W3A candidate: disposable probes reproduced five gaps—global actions required fake
  workspace/profile IDs, partial post-write state had no valid terminal record, per-resource after hashes were
  immutable/dead prepare fields, a credential-shaped resource path serialized, and a nonexistent descendant below a
  junction was created outside the lexical root before refusal. Acceptance items 1 and 3-7 were strengthened before
  correction. Evidence: `test-results/2026-08-02-w3-action-receipts/w3a-review-reproductions.json`.
- Review change after the corrected 65-check candidate: the new negative probe reproduced six semantic gaps—an
  ordinary actor ID containing `environment` was rejected; declared-effect and authority resource before-hashes
  could disagree; prepared receipts could claim performed rollback; `no_change` could carry a changed resource hash;
  and irreversible actions could claim rolled-back or compensated status. Acceptance items 5 and 7 were tightened
  before the second correction cycle. Evidence is appended to the same review artifact.
- The same full-diff review then reproduced three adjacent authority gaps: reviewed legacy route identity omitted
  HTTP method, compensation could rewrite committed validation/after facts, and mixed reversible/irreversible actions
  could overclaim complete rollback/compensation. Acceptance items 1 and 7 were tightened in the same correction
  cycle. The review also found locale-sensitive `localeCompare()` ordering in the canonical authority arrays;
  acceptance item 2 now requires ordinal host-locale-independent ordering.
- Idempotency review reproduced that ID equalled the full authority hash: reusing one operation ID with changed
  request facts silently created a second receipt, while an arbitrary `ar_<hash>` ID validated after recomputing the
  record hash. Acceptance item 4 now separates operation identity from full authority and makes duplicate conflict a
  reachable invariant rather than a forced test artifact.
- Final requirement review after the 103-check candidate found acceptance item 8 absent from the diff: the durable
  receipt substrate had no exact Agent History link/projection and no test proving that history rotation, deletion,
  corruption, or append failure leaves receipt authority unchanged. W3A was reopened before close. The reconciled
  W3A boundary is an optional, exact receipt projection on `LedgerRow` plus a pure validated projection adapter and
  independence negatives; W3B still owns populating that projection from real mutation handlers/middleware.

## IMPLEMENT

- W3A is delegated. Its reconciled write scope includes the schema/store, focused tests, required governance-manifest
  deltas, selftest registration, and the minimal Agent History row/projection adapter required by acceptance item 8.
  No production mutation handler may be wired in this batch.
- W3B is split into serialized write scopes after W3A review:
  1. **W3B0 coverage oracle and request context:** mechanically join route dispositions, capability effects, history
     census, durable writers/host stores, and external side effects; establish prepared receipt context before a
     handler may mutate. No route behavior changes in this slice.
  2. **W3B1 addressed state:** workspace create/commit/merge/restore/revert, guarded filesystem writes/deletes,
     snapshots, project-rule suppression, settings, and key/credential lifecycle. Reuse each store's current atomic
     or rollback contract and prove failed finalization preserves/restores prior state.
  3. **W3B2 artifacts and deployments:** artifact build/package/release, deploy/deploy-verify, release preparation,
     export/adopt, and schema harvest. Bind existing hashes/effects/recovery and prove stage/promote/rollback truth.
  4. **W3B3 external and process effects:** provider spend/network calls, run-command jobs, and GitHub operations get
     explicit action/refusal receipts without raw secret/request capture. No new authority or network surface is
     introduced.
- W3C projections require separate reviewed work orders because `server.ts`, extension-managed MCP, embedded UI,
  native IDE controls, extension packaging, and the built-in harness are shared hot paths. Each projection
  summarizes the W3 receipt; none owns a second status model.
- W3A actual bounded changes:
  - `actionReceipt.ts` defines the strict v1 record, discriminated authority, canonical hashes/IDs, lifecycle and
    semantic validation, secret rejection/redaction, and deterministic serialization.
  - `actionReceiptStore.ts` provides contained, relocatable, atomic prepare/read/transition persistence with stable
    failure codes and duplicate-operation conflict refusal.
  - `actionReceiptHistory.ts` projects only a validated terminal receipt's ID, exact content hash, and exact status
    into optional backward-compatible Agent History fields. Prepared/tampered receipts fail, and caller-supplied fake
    link fields are overwritten. Production mutation handlers are intentionally untouched.
  - The 116-check selftest is runtime-registered; route and durable-writer governance manifests include the exact new
    route/source/writer boundaries.
- W3B0 actual bounded changes:
  - One strict reviewed manifest joins all 82 current non-GET routes and 48 durable/host/browser/database surfaces to
    canonical effects, authority scopes, Agent History disposition, policy class, owner, source anchor, and W3B batch.
  - A pure fail-closed resolver produces exact W3A prepare input or a stable refusal without invoking a handler.
  - Deterministic candidate generation is separate from explicit hash-pinned promotion; normal precommit audits only
    the reviewed manifest and rejects route, effect, writer, owner, scope, or semantic drift.
  - Validation-required route/process repairs guarantee a fresh production bundle, independent Windows ZIP proof,
    and honest bounded descendant termination on the reproduced taskkill-denied path. They add no route or authority.
- W3B1 partial implementation:
  - one bundled, shared `WorkspaceReceiptService` now owns production replace/merge receipt execution in the
    installed extension-managed sidecar;
  - paired complete workspace/snapshot authority, pre-state recovery, terminal-before-success, exact replay,
    changed-fact duplicate refusal, failed CAS/body receipts, and committed dry-run/no-change truth are integrated;
  - workspace create, snapshot restore, bulk-transform apply, all W3B1b-d owners, and W3C visible projection remain
    open. This is not a W3B1 close.

## VALIDATE

- Focused receipt oracle, 2026-08-02: `npx tsx src/lib/actionReceipt.selftest.ts` -> `116/116`, exit 0. This includes
  global/profile/workspace authority, deterministic identity/hash, exact resource facts, every lifecycle and
  recovery negative, operation conflict, traversal/junction no-write, corruption, secret handling, exact history
  projection, fake-link overwrite, history append failure, rotation, corruption, deletion, and legacy-row parity.
- Existing history oracle: `runAgentHistorySelftest()` -> `73/73`, exit 0.
- Static: `npm run typecheck` -> exit 0; full ESLint -> 0 errors / 587 existing warnings; focused W3A ESLint -> 0
  errors; tracked/untracked changed-line whitespace checks -> clean.
- Durable writers: `npm run test:writers` -> selftest `14/14`, live inventory 34 filesystem sources / 11 host stores /
  2 browser outputs / 47 SQLite mutations / 7 transactions / 14 run / 14 exec / 2 pragma, plus extension writer
  `8/8`.
- Capability authority: `npm run test:capabilities` -> 11 capabilities / 292 literal routes / one dynamic registrar /
  10 MCP aliases, contract SHA-256 `d8a820f537dbcbb50bcb8a91c8bd415c221a15940f184e38a817fa4566c1ac8f`.
- MCP authority: `npm run test:mcp-capabilities` -> read 5 / write 9 / deploy 10, including fail-closed negatives and
  same-process recovery.
- Production: `npm run build` -> exit 0. The final CommonJS bundle has no W3A `import.meta` warning. An isolated
  production process on port 62198 returned W3A `116/116`; the runtime index and `oracle-sweep` returned `130/130`.
  Exact PID 42400 was stopped and the port had zero listeners. The policy-blocked cleanup wrapper left inert fixture
  root `C:\Users\Moshi\AppData\Local\Temp\x4-w3a-final-65196-1785656182391` (about 149 KB class, no live data).
- Cross-layer routes: after the final build, `npm run test:routes` -> `400/400`, including production startup and
  run-command absence without explicit opt-in. The harness stopped its ephemeral process trees.
- Graphify: deterministic refresh -> 4,025 nodes / 9,658 edges / 171 communities; the W3A selftest and adapter are in
  the server-reachable graph.
- GitHub projection after push: issues `#20` and `#19` remain open/`PARTIAL`; connector readback found exactly one
  implementation-ledger start/end marker on each, exact W3A commit `bec8247a84a2267d9429f5bef67fc7c8ab5c6411`, and
  the exact W3A plan link.
- Visual/installed/X4 applicability: none for W3A. It introduces no user-visible control and no production mutation
  path consumes receipts yet. Real Antigravity receipt/history rendering is mandatory in W3C; running X4 is not a W3
  gate. Full E2E remains mandatory after W3B/W3C behavior integration, not for this pure substrate checkpoint.
- Final `npm run precommit:check` after durable close synchronization -> exit 0 in 123.2 seconds: tripwires 0,
  mirror parity, verdict 26/26, product-copy, writer 14/14 plus extension 8/8, capability/MCP, typecheck, and size
  gates all passed.
- W3B0 policy and inventory: pure engine 98/98; candidate/promotion 57/57 + 23/23; reviewed manifest 82 routes /
  48 surfaces, hash `e7a1426590e64bca7c184f7adb0c77fbee5c00be02773624dfe92294dca279a7`; writers,
  capability, MCP, typecheck, lint, and diff gates PASS.
- W3B0 runtime: the unchanged complete route gate returned 400/400 after its mandatory fresh build; the isolated
  runtime index returned 130/130, stopped the exact server, closed the port, and removed its isolated state. Graphify
  refreshed to 4,249 nodes / 10,210 edges / 178 communities. The implementation precommit gate passed in 217.6s.
- W3B0 visual/installed/X4 applicability: none. It mounts no production receipt consumer and adds no visible control;
  W3C still requires real installed/rendered Antigravity proof.
- W3B1 replace/merge partial evidence, 2026-08-03: service 25/25, transaction 23/23, receipt/store 119/119 under
  normal Windows `TEMP`, typecheck, focused lint 0 errors, and final route integration 426/426 with exit 0. Every
  committed/failed receipt assertion independently reopens canonical persisted bytes. Ports 3000/3001/3100/3101
  were closed afterward and exact task-owned route fixtures were removed.

## REVIEW

- Items 1-2 — done/evidenced: complete v1 records, discriminated scopes, exact legacy method/path identity, ordinal
  canonicalization, operation ID/full-authority separation, and arbitrary-ID rejection are in the 116-check oracle.
- Items 3-4 — done/evidenced: root-segment junction refusal occurs before descendant creation; atomic bytes/hash
  verification, stable invalid/store codes, exact replay, natural duplicate conflict, and corruption negatives pass.
- Items 5-7 — done/evidenced: each declared resource has exact before/after truth; no-change, partial/incomplete,
  irreversible/mixed recovery, compensation-preservation, terminal rewrite, and all serialized secret paths fail or
  redact as required.
- Item 8 — done/evidenced after reopening: a validated terminal receipt projects only ID/hash/status; legacy rows
  round-trip; caller fake fields are replaced; prepared/tampered receipts refuse; history append failure, rotation,
  corruption, deletion, and reopen leave canonical receipt bytes/hash/status unchanged.
- W3B/W3C items 9-18 — deliberately not claimed. No production mutation handler, response envelope, embedded UI,
  native IDE control, extension-managed MCP, harness, package, installed extension, or live game path changed in
  W3A.
- W3B0 acceptance 1-10 — done/evidenced. Every current route/surface has one reviewed disposition; all fail-closed
  semantic, drift, candidate, promotion, scope, and W3A-construction negatives pass. The explicit item-10 plan change
  permits only the reproduced evidence-path repairs and adds no receipt integration.
- W3B1 addressed-state acceptance — partial: replace/merge are implemented and route-green; create compensation,
  restore paired CAS, bulk apply, remaining failure injections, W3B1a E2E, and every W3B1b-d owner are not claimed.
- Fresh-eyes findings corrected before acceptance: five first-candidate gaps, six lifecycle/semantic gaps, legacy
  method and mixed-recovery gaps, locale-sensitive ordering, broken operation-idempotency semantics, invalid-error
  remapping, CommonJS bundle startup, and the initially missing history adapter. The final full source/diff review
  found no remaining acceptance-blocking W3A defect. Automated `reviewctl` was unavailable on this host.

## CLOSE

- Status: W3A and W3B0 `VERIFIED`; W3 overall `IN_PROGRESS` at W3B1.
- Changed: strict durable receipt schema/store, exact terminal history projection substrate, reviewed coverage, and
  authoritative production receipt transactions for workspace replace/merge.
- Deliberately unchanged: every other W3B1-B3 mutation path and every visible embedded-UI/native-control/MCP
  consumer. Two route integrations do not make W3 or W3B1 complete; W3C extension parity remains required.
- Capability-map delta: verified receipt substrate only, explicitly not mutation coverage or visible parity.
- Remaining risks: no extension-managed MCP, extension host, subprocess, or production handler imports a second
  receipt-store writer, but W3B1-W3B3 still must bind 46 required routes and 27 required surfaces to
  prepare/finalize/fail truth.
  Directory fsync, hostile local replacement, bounded retention, and W3C installed projection remain follow-ups.
- Suggested W3B0 checkpoint title: `feat(authority): enforce action receipt coverage inventory`.
- Checkpoint committed/pushed: `bec8247a84a2267d9429f5bef67fc7c8ab5c6411`; local HEAD, `origin/main`, and remote
  main were equal immediately after push.
- W3B0 checkpoint `d247400bf399ef52efed081a058757eaec42c025` committed/pushed with exact local/origin/remote
  parity. GitHub `#20` and `#19` remain open/`PARTIAL`; readback found one exact ledger marker pair, plan link, and
  short/full commit link on each.
- W3B1 replace/merge checkpoint passed the complete precommit gate in 395.8 seconds and remains pending exact
  staging, commit/push, remote parity, and GitHub readback at this record update. Its official full E2E verdict
  remains unavailable because the repaired 2/2 focused slice completed but the Playwright child never emitted its
  close event or verdict receipt; the checkpoint therefore remains `PARTIAL`.

## AAR

- Triggered by reconciliation: current “receipt” terminology covers at least three different truths—optional Agent
  History rows, destructive recovery records, and artifact/deploy/package result objects.
- Triggered by review: the first candidate passed its own 40 checks while omitting five acceptance-critical negative
  paths; the plan and focused oracle were corrected before integration.
- Triggered again by review: the corrected candidate passed 65 checks but still admitted six contradictory states;
  green focused counts are necessary evidence, not sufficient review authority.
- Triggered by final requirement review: the 103-check candidate and all repository/runtime gates were green, but
  acceptance item 8 had no implementation or test. W3A was reopened rather than documented as verified.
- Triggered by production validation: the first build exposed a CJS startup crash from a server-imported selftest's
  `import.meta.url` direct-run guard. The route suite had just reported a false-green production surface because it
  probed stale `dist`; the guard was repaired and build -> startup -> routes were rerun in that order.
- Triggered by governance: the final history projection changed both reviewed source fingerprints. Writer and
  capability audits failed until only the exact fingerprint/source boundary deltas were promoted.
- Triggered by coordinator error: I initially instructed the route source entry at the wrong locale-sensitive
  position, causing one unnecessary 82-second audit failure; the corrected `localeCompare` order passed.
- Triggered during W3B1: normal Windows ancestor `realpath` returned `EPERM`; exact replay initially conflated
  lifecycle facts with immutable intent; an over-strong dry-run oracle expected fields the honest preview contract
  does not return; one all-green route run ended with post-verdict `0xC0000409`; large temp fixtures and several
  stalled Luna workers required exact cleanup/interruption. Each case was reproduced, corrected or isolated, and
  rerun before this partial checkpoint was documented.
- Triggered by tools: combined parallel wrappers discarded sibling results on one red command; a Windows ripgrep
  glob failed; a cleanup-bearing isolated wrapper was policy-blocked before execution; repeated subagent validation
  wrappers needed explicit interruption. Independent commands and retained exact process IDs restored reliable
  evidence.
- Sustain: preserve each substrate and define one narrow authority schema over them.
- Improve work/approach: do not promote fail-soft observability into transaction authority without an explicit
  pre-state/finalization failure model.
- Improve tools: route/capability drift audit must inventory receipt coverage mechanically; manual route lists will
  become stale.
- Improve tools: make `test:routes` build or deterministically reject stale production bytes; never cite its
  production assertions unless build freshness is established first.
- Improve tools/security: a broad process-command-line diagnostic exposed credential-bearing arguments in transient
  tool output. Do not persist raw process command lines as evidence; future process checks must select known PIDs or
  redact credential arguments before output.
- Highest-risk evidenced weakness: current middleware can return a successful mutation before the history append is
  attempted, so history cannot prove that every successful write produced durable audit evidence.
- Lessons banked: update project/global AAR only after verified implementation evidence exists.
