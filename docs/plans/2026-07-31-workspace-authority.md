# Kimi R8/R17 — Immutable Workspace Authority And True Multi-Workspace

Task: B110-R8/R17 request-addressed workspace identity and true multi-workspace
Lane: FULL
Status: VERIFIED

## PLAN

- Bounded unit: replace the shared active-workspace authority with a bounded persistent registry keyed by immutable
  server-owned `workspaceId`; bind Studio tabs and agent keys to explicit workspace authority; migrate stateful
  routes, history, workspace recovery, readiness/project-symbol consumers, the browser client, extension, and MCP
  callers while preserving content-addressed CAS.
- Assumptions and unresolved facts: the current persisted active and parked states may contain duplicate names;
  old agent keys have no workspace binding; legacy history rows have no identity; validation baselines are correctly
  keyed by mod ID/content and are not workspace authority. The installed 0.0.62 host remains untouched until the
  exact packaged visual gate.
- Authoritative references: ADR-F1/F4/F5 in `F:\StarForge\wiki\x4-forge\decisions.md`; Kimi ledger R8/R17;
  capability map; current `activeWorkspace`/`applyWorkspaceMutation`/workspace persistence; agent-key, history,
  recovery, readiness, bulk-transform, reference-symbol, browser, extension, and MCP implementations; Graphify.
- In scope:
  1. Atomic bounded workspace registry with immutable IDs, one-time active/parked migration, list/create/bootstrap,
     duplicate-name support, record/version/head/provenance summaries, corrupt-record refusal, and deterministic
     selftests.
  2. One request authority contract: explicit `workspaceId`; tab-scoped `clientId` for Studio state requests;
     workspace-bound agent keys; safe denial for unbound/mismatched keys; response identity echo.
  3. Per-record CAS mutation, conflict preview, force recovery, diagnostics, current status/readiness/proof,
     bulk-transform, project-symbol completion, compile/package/artifact/generate, snapshot restore, and any other
     route proven to consume or mutate the former singleton.
  4. Workspace-scoped ledger rows, history reads/raw/revert, and workspace recovery receipts. Deployment recovery
     remains target-bound and stateless deploy/path inputs remain valid.
  5. Browser tab identity/bootstrap/selection and explicit headers; extension-managed sidecar identity; MCP tool
     inputs/configuration and examples. Existing same-workspace conflict dialog and CAS UX remain intact.
- Out of scope: cloud/cross-device sync; collaborative CRDT merging; source-control replacement; inferring workspace
  identity from mod name/path; changing validation-baseline domain identity; publishing a release before all gates;
  touching a real mod, game directory, or the current installed-host workspace during implementation tests.
- Risks and authorization boundaries: migration or cross-workspace authorization errors could hide/overwrite work;
  registry growth could exhaust disk; old keys could accidentally gain authority; broad route changes can regress
  validation/deploy/release. Use isolated `X4_STATE_DIR`/`X4_DATA_DIR` fixtures, atomic writes, hard record/payload
  caps, deny-by-default state routing, exact cross-workspace negative tests, and existing deploy write gates. No new
  spending, external network, deletion, credential export, or real-game write is authorized.
- Rollback/checkpoint: `HEAD == origin/main == 6c01b90a93a94c2d353641bcb04cc3d746170b5f`. Registry migration preserves
  legacy `active.json`/parked files as read-only inputs; reverting task-owned source restores 0.0.62 behavior. Test
  fixtures use disposable roots and ports only.
- Acceptance criteria:
  1. First boot migrates one active plus every valid parked state exactly once, preserves workspace content hashes,
     assigns unique immutable IDs even for duplicate names, and restarts with the same IDs/heads.
  2. Two concurrent Studio clients with different `clientId`/`workspaceId` pairs can read/write/compile their own
     same-named workspaces without cross-read, cross-write, version, CAS, history, readiness, or recovery leakage.
  3. Missing workspace identity on a stateful route fails with a named 400; unknown ID is 404; client/key mismatch
     is 403; an unbound legacy key is denied state authority; no denial mutates either workspace.
  4. Same-workspace stale `expectedHead` still returns the ADR-F1 409 evidence; a correct head advances only the
     addressed record. Forced overwrite creates a recovery bound to that ID; stale, cross-workspace, replay, and
     legacy-row recovery are refused.
  5. Agent keys are minted against an existing workspace, persist only the ID plus token hash, echo binding in safe
     metadata, and cannot access another workspace even when a forged header/body/query ID is supplied.
  6. Browser tabs retain independent selected IDs in session storage, can create/select workspaces, show identity
     clearly, and preserve conflict/adopt/overwrite behavior. Extension and curated MCP use the same explicit
     contract; examples never advertise an unaddressed active singleton.
  7. Stateless inline validation and explicit path/workspace deploy/release remain functional; shared corpus/config/
     game-log/selftest routes do not acquire fake workspace coupling.
  8. Registry count/payload caps, corrupt index/record, migration replay, duplicate names, missing/mismatched
     identity, cross-workspace history/recovery, and concurrent CAS have deterministic negative evidence.
- Required validation and negative path: new registry/authority/key/history/recovery selftests; isolated route matrix
  with two clients/two same-name workspaces/two keys; focused browser E2E for create/select/independent-tab/conflict;
  extension build and MCP selftest; root typecheck/lint; route suite; oracle sweep; full E2E; production build;
  staged-product and inspected VSIX; installed Antigravity visual/runtime proof; precommit; Graphify refresh; public
  release/parity only after all prior gates. Negative paths are criteria 3/4/8.
- Evidence locations: this record; isolated fixture receipts; `test-results/`; packaged-product reports;
  `vscode-extension/evidence/` for installed-host screenshots/receipts.

## BASELINE

- Revision/version: `HEAD == origin/main == 6c01b90a93a94c2d353641bcb04cc3d746170b5f`; extension 0.0.62 / Forge
  v1.0.389. Normal managed Antigravity sidecar listens on 127.0.0.1:50755; ports 3000/3001/3100/3101 are closed.
- Existing changes/failures/runtime state: preserve user-owned deleted Discord/game files, modified 0.0.35 evidence
  images, and untracked `Note for Kimi.md`; no task-owned runtime or computer-control session is active. A memory
  registry search returned no matching workspace-identity record. The first live-tree inspection used stale
  `src/server.ts` instead of root `server.ts` and failed before mutation.

## RECONCILE

- Resources and readers/writers searched: Agent Brain fallback (no relevant node); ADR/capability/Kimi records;
  Graphify 81-node workspace/auth/history/readiness traversal; root `server.ts`; workspace state, agent keys,
  history/store, destructive recovery, bulk-transform, reference routes; App/AgentBridge/BulkTransformPanel;
  extension and MCP callers; AST/direct-route inventory.
- Existing capability reused: atomic writer; content hash/CAS/conflict preview; bounded parked-state data;
  hashed/scoped/expiring keys; append-only content-addressed history; bounded one-use recovery; readiness builder;
  explicit deploy/release inputs; tab-capable session storage; extension-managed sidecar credentials.
- Observed gaps/absence boundary:
  - One process-global workspace/version/hash/origin owns all callers; no `WorkspaceRegistry` exists.
  - Active persistence is `active.json`; parked records are name-keyed and latest-wins, so names are treated as IDs.
  - At least 24 direct agent routes plus bulk-transform/reference providers and browser/extension/MCP callers consume
    or mutate the singleton. Compile/package/generate silently default to it.
  - Keys contain no workspace binding; auth actors have label/scope only. History rows and workspace recovery
    receipts contain no workspace ID, so raw/revert cannot enforce a workspace boundary.
  - Validation baselines are keyed by mod ID/content and are comparison data, not mutable workspace authority; they
    should remain unchanged. Explicit inline project validation and explicit deploy/release inputs are stateless.
  - Search boundary: repo code/tests/docs, Graphify graph, ADR/capability map, Kimi field report, Agent Brain query.
- Couplings checked: auth before ledger ordering; public GET allowlist; Studio token and key scopes; workspace
  autosave/poll/conflict/adopt; history capture/revert; recovery CAS; readiness/proof/status; deploy/release explicit
  targets; project symbols; extension adoption/native file open; MCP environment/tool schema; E2E ephemeral roots.
- Extend-versus-replace: replace only the singleton authority with a registry; extend the proven CAS, atomic writer,
  key store, ledger, recovery, readiness, and clients. ADR-F1's mod-ID keying is superseded by ADR-F5; its CAS rules
  remain unchanged.
- Capability-map delta: planned at close for immutable IDs, per-request/key authority, multi-tab isolation, migration,
  and scoped history/recovery.
- Plan changes: the initial handoff proposed broadly binding every route. Reconciliation narrows this to an explicit
  route-policy matrix: stateful routes require identity; stateless inline/path operations and shared machine/corpus
  routes retain their existing contract. This avoids inventing coupling where no workspace state is read.

## IMPLEMENT

- Actual bounded changes:
  - Added `WorkspaceRegistry`: bounded atomic index plus per-ID records, immutable random IDs, content heads,
    record revisions/provenance, exact active/parked migration, duplicate-name support, corruption refusal, and
    deterministic migration/restart/cap/failure selftests. Legacy state remains as read-only migration input.
  - Replaced the process-global active workspace/version/hash with request resolution and per-record CAS. Stateful
    routes require an explicit workspace; shared machine/corpus routes and genuinely inline/path-addressed work stay
    stateless. Readiness and deploy-status state are keyed by workspace ID.
  - Bound agent keys, history rows, history raw/revert, destructive workspace recovery, and ledger attribution to
    immutable workspace IDs. Missing, malformed, unknown, legacy-unbound, client-mismatched, key-mismatched,
    cross-workspace, stale, and replayed authority paths fail closed.
  - Added list/create/bootstrap APIs and isolated two-client route coverage. Browser tabs generate their own client
    IDs, retain a tab-local selected workspace, namespace cache keys by workspace ID, expose create/switch controls,
    and cancel stale in-flight sync responses through an authority epoch.
  - Propagated the selected workspace through extension-native requests and the curated MCP shim. The installed
    extension persists only the selected immutable ID and rebinds it against the authenticated sidecar on restart.
  - Registered every new registry/browser/extension write in R7's precommit-enforced durable-writer inventory:
    32 filesystem sources, 11 host stores, 2 browser outputs, 47 SQLite mutations, and 7 transactions.
  - Released stable X4 Forge Studio 0.0.63 with generated modder-facing notes and the exact built app/controller/MCP
    payload. Existing 0.0.62 conflict/recovery behavior was preserved rather than republished under colliding bytes.
- Scope changes and reasons: precommit proved the new persistence callsites were not yet registered in the R7
  inventory; updating their exact counts, owners, rationales, failure contracts, and source fingerprint became
  required for the declared gate. No unrelated capability was added.

## VALIDATE

- Method -> result -> evidence:
  - Root typecheck -> PASS; lint -> PASS with 0 errors and the unchanged 581-warning baseline.
  - Route integration -> PASS 289/289, including two clients, two same-name workspaces, per-workspace keys,
    history/recovery/readiness isolation, missing/unknown/mismatch denials, and stateless compatibility.
  - Oracle integration -> PASS 126/126; canvas subset -> PASS 4/4; focused two-tab isolation -> PASS.
  - Full isolated E2E -> PASS 51/51, zero failures, zero flakes, zero quarantined outcomes; final receipt:
    `test-results/e2e-verdict.json`. Ephemeral 3100/3101 listeners were absent after teardown.
  - Production build -> PASS; extension build -> PASS; panel binding -> PASS 9/9; native bridge -> PASS; MCP
    `tools/list` -> PASS 10 tools with no active-singleton copy; Graphify refresh -> PASS (3,152 nodes, 7,413
    edges, 154 communities).
  - Staged product -> PASS; live packaged-sidecar probe -> PASS 16/16; stable 0.0.63 inspector -> PASS 2,091
    entries, 60,408,936 unpacked bytes, 17,907,329 archive bytes.
  - Installed Antigravity -> PASS: normal profile reports `x4forge.x4-forge-studio@0.0.63`; local and installed
    controller, supervisor, MCP, and server hashes match; packaged server PID 65556 remained listening on 64554;
    log records five migrated records and authority `ws_f61166c42849c757cf219c37`. Real Antigravity rendered Forge
    v1.0.391 and the workspace selector. Evidence:
    `vscode-extension/evidence/2026-07-31-r8-r17/0.0.63-installed-antigravity-workspace-authority.png`.
  - Public release -> PASS: Open VSX accepted stable 0.0.63; the version-specific public VSIX is 17,907,329 bytes
    with SHA-256 `50032222bc22190d25d3314837e52e4370c4059f053d1d9bb6ea087de4da52e5`, exactly matching local bytes.
  - Final precommit -> PASS, including product-copy guard, durable-writer inventory, 26/26 E2E policy selftest,
    canon mirrors, tripwires, and typecheck.
- Negative/rollback result: VERIFIED. Missing identity returns named 400; unknown ID 404; client/key mismatch and
  legacy-unbound keys 403; registry corruption/caps refuse; duplicate names keep distinct IDs; stale same-workspace
  CAS stays 409; cross-workspace and replayed recovery refuse without mutation. The installed profile migrated in
  place while preserving legacy inputs; no real mod, game directory, credential, spending, or publication action
  beyond the authorized stable extension release was exercised.
- Visual/live result when applicable: VERIFIED. The final captured host is Antigravity itself, not a browser or
  simulator, and its status bar identifies the managed packaged sidecar. Computer control was released immediately
  after the capture.

## REVIEW

- Requirement -> done | partial | missed | deferred | out of scope:
  1. Migration, immutable IDs, duplicate names, restart stability -> done and evidenced.
  2. Independent same-name clients across mutation/compile/history/readiness/recovery -> done and evidenced.
  3. Missing/unknown/client/key/legacy denials with no mutation -> done and evidenced.
  4. Per-record CAS plus bound force recovery/refusals -> done and evidenced.
  5. Workspace-bound hashed keys and forged-ID refusal -> done and evidenced.
  6. Tab-local browser identity, create/switch UI, conflict semantics, extension/MCP parity -> done and evidenced.
  7. Stateless inline/path operations and shared resources remain uncoupled -> done and evidenced.
  8. Caps/corruption/migration/duplicate/concurrency negative matrix -> done and evidenced.
  Cloud sync, CRDT collaboration, source-control replacement, and mod-name identity remain out of scope as planned.
- Fresh-eyes findings for significant changes:
  - Full E2E caught three narrower implementation faults before release: the reference bridge expected an obsolete
    request sequence; opaque webviews lacked `crypto.randomUUID`; and a stale conflict response could reopen the
    dialog after adopt/force. The bridge expectation, ID fallback, and authority-epoch cancellation were corrected,
    then the complete suite passed.
  - Review caught that an installed test build still used the already-public 0.0.62 version. The release was moved
    to 0.0.63 and rebuilt, inspected, installed, rendered, published, and byte-parity verified.
  - The final diff preserves validation-baseline identity, explicit deployment targets, recovery binding, and the
    existing public/shared route contracts; no active-singleton fallback remains in shipped callers.

## CLOSE

- Status: VERIFIED
- Remaining risks/deferred work: multi-device/cloud collaboration remains deliberately absent. Antigravity restored
  its webview through three short managed-sidecar replacements before stabilizing; each old server received the
  authenticated parent-loss shutdown and the final instance remained healthy, so this is retained as host lifecycle
  evidence rather than an open R8/R17 defect. R13 now owns continuous polling consolidation.
- Suggested commit title: `feat(workspaces): isolate clients with immutable authority`

## AAR

- Triggers: stale source-path inspection; no-result memory query; reconciliation narrowed route binding; route/E2E
  helpers initially omitted identity; root and extension builds briefly contended for generated output; direct oracle
  sweep lacked its server harness; full E2E found and forced three corrections; first stable probe was transiently
  red before a clean 16/16 rerun; first Antigravity install hit a live extension-file lock; a PowerShell block-to-pipe
  parser error required a bounded retry; precommit caught the missing durable-writer delta; review corrected an
  already-public 0.0.62 version collision; public propagation took 212 seconds; policy refused cleanup of six
  intermediate screenshots. This is a triggered Full-lane AAR.
- Sustain: preserve ADR-F1 CAS and proven stores; classify stateful/stateless/shared routes before changing callers;
  use two same-name workspaces as the isolation oracle; require exact installed/public bytes rather than version text.
- Improve work/approach: version a user-facing test package before installed proof, serialize generators that share
  `out/`, use the project-owned oracle harness from the first run, and update writer inventory in the same
  implementation pass as every persistence change.
- Improve tools: keep route-policy and two-tab E2E coverage; add a release helper that refuses an already-published
  version and performs build -> stage -> probe -> inspect -> installed-hash -> public-parity as one receipted flow.
- Highest-risk evidenced weakness: an in-flight response from a prior workspace authority could arrive after a user
  adopted or forced a newer choice and reopen stale conflict UI. The implemented authority epoch now invalidates
  those responses, with full E2E proving the corrected behavior.
- Global/project lessons banked: capability delta and both AAR ledgers updated at close.
