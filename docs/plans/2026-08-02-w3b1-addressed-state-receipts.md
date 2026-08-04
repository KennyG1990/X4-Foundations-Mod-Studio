# B115 W3B1 — addressed-state action-receipt integration

Status: IN_PROGRESS / PARTIAL; shared runtime plus workspace replace/merge are route-green, while create/restore/bulk remain open
Lane: FULL
GitHub owners: `#20` primary, `#19` convergence projection
Dependencies: W3A and W3B0 VERIFIED at `91463ee13300acabd252d29b12ce7ec0916312c3`

Product boundary correction (owner, 2026-08-02): the only product is the installed Antigravity/VS Code IDE
extension. Its embedded Studio bundle and extension-managed sidecar are in scope; a standalone web app and end-user
CLI are not. W3B1's sidecar transaction work remains required because the extension launches that sidecar.

## PLAN

- Bounded unit: bind every W3B1 entry in the reviewed receipt-coverage authority—22 production routes and 19
  durable/host-store surfaces—to the existing `forge.action-receipt.v1` store without replacing workspace CAS,
  atomic writers, destructive recovery, Agent History, or store-specific rollback.
- This is not one middleware patch. The write and rollback owners overlap in `server.ts`, so W3B1 is serialized into
  four reviewable checkpoints:
  1. **W3B1a workspace/CAS:** `POST /api/agent/bulk-transform/apply`, `POST /api/agent/workspace`,
     `POST /api/agent/workspace/merge`, `POST /api/agent/workspaces`, and
     `POST /api/fs/restore-snapshot`.
  2. **W3B1b guarded filesystem/recovery:** `POST /api/agent/history/:id/revert`,
     `POST /api/agent/lua-staleness/instrument`, `POST /api/agent/project-rules/suppress`,
     `POST /api/fs/create`, `POST /api/fs/delete-dir`, `POST /api/fs/delete-snapshot`,
     `POST /api/fs/snapshot`, and `POST /api/fs/write`.
  3. **W3B1c credential/config/session:** `DELETE /api/github/credential`,
     `POST /api/agent/external-api/register`, `POST /api/agent/keys`,
     `POST /api/agent/keys/revoke`, `POST /api/ai/keys`, `POST /api/github/credential`,
     `POST /api/schema/config`, `POST /api/studio/layout`, and
     `POST /api/studio/release-preferences`.
  4. **W3B1d non-route stores:** reconcile and bind the 19 reviewed W3B1 surface rows. Server/store rows may be
     satisfied by the owning route transaction. The residual extension/browser stores must either move behind a
     server-observable atomic writer or receive a re-reviewed non-authoritative disposition. A client assertion that
     the server cannot observe is not accepted as a committed receipt.
- Authoritative references: `docs/plans/2026-08-02-w3-action-receipt-authority.md`,
  `docs/plans/2026-08-02-w3b0-action-receipt-coverage.md`,
  `config/action-receipt-coverage.json`, `src/lib/actionReceipt.ts`,
  `src/lib/actionReceiptStore.ts`, `src/lib/actionReceiptCoverage.ts`,
  `src/lib/actionReceiptHistory.ts`, `src/lib/destructiveRecovery.ts`,
  `src/lib/workspaceRegistry.ts`, `src/lib/workspaceState.ts`, ADR-F1/F4/F5, and the capability map.
- Existing infrastructure reused: one server-owned `ActionReceiptStore`; exact reviewed route/effect policy;
  `WorkspaceRegistry` content/snapshot identities; `DestructiveRecoveryStore`; guarded atomic file/config/key
  writers; and fail-soft Agent History projection.

### Assumptions and unresolved facts

- Agent History remains post-response and fail-soft. It may link a terminal receipt but can never authorize or
  fabricate one.
- The receipt store remains server-single-writer. Graphify and source search currently show no production import;
  W3B1 may not add a CLI, MCP, extension-host, browser, or subprocess writer.
- A receipt-required request needs a caller-owned operation identity. First-party callers will generate and send a
  bounded `x-forge-operation-id`; the server does not silently derive idempotency from time, body hash, or actor.
- The reviewed policy and inventory must be bundled into the installed server. Production code must not import the
  audit CLI or depend on repository-relative `config/` files that are absent from a staged VSIX.
- Browser/extension host stores are not automatically authoritative just because a client reports success. Their
  exact migrate-versus-reclassify disposition is a required W3B1d review outcome, not a reason to weaken W3B1a-c.

### In scope

- A narrow runtime transaction adapter over the existing coverage resolver and receipt store.
- Exact actor/client/operation/authority/resource/effect/request/before/after/validation/recovery facts.
- Prepare before mutation, terminalize before any ordinary success response, and attach an additive terminal receipt
  projection to the response and Agent History row.
- Existing rollback or compensation paths, strengthened only where receipt finalization can otherwise leave changed
  state behind.
- Injected preparation, mutation, finalization, rollback, corruption, stale-CAS, traversal, and secret negatives.

### Out of scope

- W3B2 artifact/deploy/package/release integration; W3B3 provider/network/process/GitHub action integration; W3C
  installed-extension UI/history/native-control/MCP projection; public release; game/mod writes; provider spend;
  standalone browser/CLI products; and a second workflow engine.
- Replacing Agent History, workspace CAS, destructive recovery, or domain-specific atomic stores.
- Persisting raw request/response bodies, tokens, keys, prompts, environment variables, or absolute machine paths.

### Likely owned paths

- New runtime/pure seams under `src/lib/` or `src/server/` for operation identity, bundled policy, canonical hashing,
  lifecycle execution, response projection, and injected failure tests.
- Existing integration owners: `server.ts`, `src/server/bulkTransformRoutes.ts`, `src/lib/workspaceRegistry.ts`,
  `src/lib/destructiveRecovery.ts`, `src/lib/agentHistory.ts`, and `src/lib/agentHistoryStore.ts`.
- Later W3B1b-c owners include the reviewed filesystem/key/config stores and route modules. W3B1d write scopes are
  not assigned until its boundary review is complete.
- Validation: focused selftests, `scripts/route-integration.mjs`, runtime oracle registration, coverage/writer/
  capability/MCP audits, E2E, build, and precommit.

### Risks and authorization boundaries

- **Data loss:** a mutation can succeed and receipt finalization can fail. Durable pre-state recovery must exist
  before the mutation; finalization failure must restore prior state or return a non-success `incomplete` result with
  durable recovery evidence.
- **False success:** `res.on('finish')` is too late for authority. Terminal receipt persistence must precede the
  ordinary 2xx response.
- **Secret leakage:** key/config routes hash only redacted, schema-approved facts. No credential bytes enter receipt
  resources, metadata, failures, history, logs, or response projections.
- **Compatibility:** response fields are additive. A missing/malformed caller operation ID fails before mutation with
  a stable code; all first-party callers and examples must be updated in the same checkpoint that enforces it.
- **Concurrency:** one request owns one receipt context. No process-global “last receipt” slot or cross-request
  response capture is allowed.
- **Packaging:** the installed sidecar contains `dist/server.cjs`, not repository policy files. Runtime authority must
  be bundled and staged-probeable.
- No real mod/game/config, network, spending, publishing, or credentials are used in validation. All mutations use
  isolated roots and fake values.

### Rollback/checkpoint

- Baseline is pushed commit `91463ee13300acabd252d29b12ce7ec0916312c3` plus the preserved unrelated dirty
  inventory below.
- Each sub-slice is committed separately only after its declared gates pass. Rollback removes only that sub-slice's
  adapters/tests and restores the prior handler calls; W3A/W3B0 records remain valid.
- Failure fixtures use isolated `X4_DATA_DIR`, `X4_STATE_DIR`, workspace, and configured roots. Route/E2E stacks own
  ephemeral ports 3100/3101 and must leave 3000/3001 and the live workspace unchanged.

## ACCEPTANCE CONTRACT

### Shared W3B1 transaction contract

1. The installed runtime uses the exact reviewed W3B0 policy and a matching bundled inventory. Invalid, missing,
   stale, effect-narrowed, or scope-mismatched policy makes a receipt-required action fail before mutation; read-only
   server startup remains available for diagnosis.
2. A valid caller operation ID, redacted actor, exact client channel, canonical or reviewed legacy capability,
   applicable global/profile/workspace authority, exact declared effects, and complete resource pre-state are durable
   before the first write. Reusing an operation ID with changed material facts fails as a duplicate conflict.
3. Validation/refusal before mutation terminalizes the prepared receipt as failed. Preparation/store/recovery failure
   performs zero mutation and returns a stable non-2xx receipt failure envelope.
4. A successful mutation is re-read or deterministically re-hashed, then the receipt is committed before the 2xx
   response. The response adds one exact `{ id, hash, status }` receipt projection; Agent History later attaches the
   same validated terminal projection without becoming authority.
5. Handler failure leaves or restores prior state and records a failed receipt. Finalization failure after a write
   invokes the existing domain rollback/compensation path and never returns ordinary success. If rollback also fails,
   the response is non-success and the durable record is `incomplete` with observed partial after-state and recovery
   truth whenever the receipt store remains writable.
6. A no-op is a committed `no_change` with every after hash equal to its declared before hash. It does not fabricate
   an applied mutation.
7. Receipt/history response fields never contain raw secrets, request bodies, workspace payloads, absolute host
   paths, or provider material. Credential-shaped values are rejected or redacted by the existing W3A policy.
8. One server-owned store instance is the only production receipt writer. Request contexts are isolated under
   concurrency, and history corruption/rotation/failure cannot alter receipt truth or route success.

### W3B1a workspace/CAS checkpoint

9. The five W3B1a routes above use immutable workspace identity and complete 64-hex receipt hashes while preserving
   ADR-F1/F5 paired content/snapshot CAS. `restore-snapshot` gains the same expected-head/snapshot guard instead of
   retaining an unreceipted blind commit.
10. Changed workspace state has durable pre-state recovery before `WorkspaceRegistry.commit`. Receipt-finalization
    failure restores the exact prior workspace content/snapshot identity before returning non-success. Forced-write
    recovery remains available and is not replaced.
11. Workspace creation prepares global registry authority before creating a record and can compensate a failed
    receipt finalization by atomically removing only the just-created record. Existing records/default identity are
    unchanged.
12. Stale CAS, missing identity, cross-workspace key/client mismatch, dry run, no change, invalid payload, duplicate
    operation ID, prepare failure, commit failure, receipt-finalize failure, compensation failure, and history failure
    have exact no-false-success route tests.

### W3B1b-c-d completion checkpoints

13. Filesystem/snapshot/revert actions bind exact contained root-relative resources and byte/tree hashes to existing
    atomic/recovery paths. Traversal, junction, absent/present races, retention deletion, and rollback failure are
    explicit negatives.
14. Credential/config/session receipts use only global/profile authority and redacted identities. Existing atomic
    stores preserve prior bytes on failure; deletion records absence truth without serializing deleted secrets.
15. Every one of the 19 W3B1 surface rows has an exact implemented route transaction, server-observable migrated
    writer, or explicitly re-reviewed non-authoritative disposition. No client-only success assertion is promoted to
    receipt authority.
16. W3B1 closes only when all 22 routes and 19 surface rows pass a runtime coverage assertion. Partial checkpoints
    name their exact covered subset and leave W3 overall `IN_PROGRESS`.

### Required validation

- Focused pure/runtime selftests for policy load, operation identity, canonical request/state hashing, actor/client
  mapping, prepare/commit/fail/rollback/incomplete transitions, response projection, redaction, and concurrency.
- Route tests for every acceptance negative and one independent reopen/hash verification of each committed receipt.
- `npm run typecheck`; `npm run lint`; `npm run test:action-receipt-coverage`; `npm run test:writers`;
  `npm run test:capabilities`; `npm run test:mcp-capabilities`; `node scripts/oracle-sweep.mjs` through its owning
  isolated runtime; `npm run test:routes`; `npm run build`; `npm run precommit:check`.
- `npm run test:e2e` after W3B1a because workspace API behavior changes; workers remain 1 and the live workspace
  preservation/ephemeral shutdown checks must pass.
- No installed/rendered Antigravity claim applies to an invisible W3B1 checkpoint. W3C still requires staged/VSIX/
  installed-byte parity and real rendered receipt/history proof inside the IDE extension. No standalone web/CLI
  proof applies, and no running-X4 gate applies.

### Evidence locations

- Machine evidence: `test-results/2026-08-02-w3-action-receipts/w3b1/` with per-sub-slice folders.
- Durable task record: this file plus `docs/plans/2026-08-02-w3-action-receipt-authority.md`.
- Verified close only: `ROADMAP.md`, `SESSION-HANDOFF.md`, capability-map delta, project/global AAR ledgers, and
  exact GitHub `#20`/`#19` implementation blocks.

## BASELINE

- Revision: `91463ee13300acabd252d29b12ce7ec0916312c3` on `main`.
- Preserved unrelated dirty state: user R13/B111-B114 `BACKLOG.md` hunks; `CODEX-ONBOARDING.md`;
  `KNOWN-BUGS.md`; deleted data/Discord files and scripts; `.claude/`; issue templates; `Note for Kimi.md`; old
  0.0.35 evidence PNG changes; and untracked R8/R17 screenshots. No baseline validation changed this inventory.
- Operator state: Antigravity open, X4 stopped, machine quiet, unattended computer use authorized. No UI/canvas
  action occurred. Ports 3000/3001/3100/3101 were free before the route baseline and free afterward.
- `npm run typecheck`: PASS, exit 0, 24.6 seconds.
- `npm run test:action-receipt-coverage`: PASS, 82 routes / 48 surfaces, reviewed manifest SHA-256
  `e7a1426590e64bca7c184f7adb0c77fbee5c00be02773624dfe92294dca279a7`, 119.1 seconds.
- `npm run test:routes`: fresh build plus 400/400 PASS, exit 0. The ephemeral stack stopped and the dirty inventory
  was unchanged.

## RECONCILE

- Prior Agent Brain history was a strong match: B86 already established relocatable history storage, redacted actor
  labels, content-addressed before-state blobs, and post-response fail-soft capture. Current source confirms those
  facts; W3 extends them rather than building a second ledger.
- Current source and exact-symbol Graphify show `ActionReceiptStore` is imported only by its selftest. No production
  route, CLI, MCP, extension host, subprocess, or browser owns a second writer.
- `ledgerMiddleware` snapshots limited before-state on the hot path but appends on `finish`; this is useful
  observability and structurally incapable of preventing false success. W3 transaction finalization must occur before
  `res.json` sends a successful response.
- `applyWorkspaceMutation` is the existing CAS chokepoint for replace, merge, and bulk apply, but recovery currently
  exists only for forced overwrite. `fs/restore-snapshot` bypasses it with a blind registry commit. Workspace create
  has internal index-write rollback but no post-create compensation API.
- The W3B1 reviewed authority contains 22 receipt-required routes and 19 receipt-required surfaces. The route set
  partitions exactly as 5 + 8 + 9 above. The surface set includes seven server/store owners already reachable from
  those routes plus extension and browser/session stores that require a separate observability decision.
- The installed extension stages only bundled app/server output. Importing the repository audit script or reading
  `config/action-receipt-coverage.json` by relative path would pass in the checkout and fail in the real product.
- Extend-versus-replace: extend. Workspace CAS, atomic writers, destructive recovery, Agent History, and the W3A
  store have distinct proven responsibilities and no three-citation replacement threshold.
- Capability-map delta: none at specification.
- Plan change: W3B1 is split into four serialized checkpoints. This is required by the real 22-route/19-surface
  inventory and by overlapping `server.ts` ownership; a single patch would hide rollback and response-timing defects.
- [REPRODUCED] Two sandboxed Graphify launches failed with `Failed to canonicalize script path`; the approved exact
  host query succeeded. [REPRODUCED] the first `Get-NetTCPConnection` check returned exit 1 without usable evidence;
  an independent `netstat` listener check proved all four ports free. These are AAR triggers, not product failures.
- Plan change, 2026-08-03: full E2E exposed two validation-contract gaps. The shared ephemeral workspace seed helper
  did not supply the newly mandatory caller-owned operation ID, so 77/96 tests failed before their assertions with
  one identical `ACTION_RECEIPT_OPERATION_ID_INVALID` cause. After that bounded fixture repair, both focused
  workspace-isolation tests passed, but Playwright never emitted `close` or a verdict receipt after its listeners
  stopped. The runner close path is now required scope because a validation tool that cannot return structured truth
  cannot certify this feature. The repair must retain zero-flake/fail-closed policy, preserve the JSON/report oracle,
  prove a deterministic child-hang negative path, reap only its own process tree after terminal structured evidence,
  and leave a missing/incomplete report red. This plan delta was recorded after the fixture edit rather than before
  it; the task is therefore non-clean.
- Plan change, 2026-08-03 (evidence containment): Playwright's implicit output directory is the repository root
  `test-results`, so both E2E runs erased the untracked W3B0 evidence tree. That exposed a second defect: the
  action-receipt candidate-path selftest used the erased nested evidence directory as its positive parent and is not
  green in a clean clone. Move Playwright output into a dedicated `test-results/e2e` subtree and make the path
  selftest's positive case depend only on the tracked `test-results` root. Preserve the existing missing-parent and
  escape negatives. No production receipt authority changes in this repair.
- Plan change, 2026-08-03 (bounded prerequisite timing): the coverage audit passed standalone in 177.7 seconds, but
  its nested capability prerequisite has a 180-second timeout and timed out under precommit load as
  `exit=unknown`. Increase the finite timeout to a measured-safe bound and classify timeout separately; do not
  remove the timeout or weaken prerequisite authority.

## IMPLEMENT

- `IN_PROGRESS` — W3B1a shared foundations and the addressed workspace replace/merge routes are implemented;
  workspace create, snapshot restore, and bulk-transform apply remain open.
- Accepted shared foundations:
  - bundled immutable runtime policy loading with the reviewed W3B0 manifest and no checkout-time config read;
  - caller-owned operation IDs in the embedded Studio and native extension controller;
  - complete 64-hex workspace content/snapshot receipt hashes and registry aggregate resources;
  - deterministic recovery identity, exact workspace-create compensation, and receipt-store transition reconciliation;
  - one route-agnostic `WorkspaceReceiptService` with fail-closed policy loading, request-local results, exact replay,
    same-key serialization through rollback/finalization, and different-key independence.
- The coordinator review rejected an unsafe convenience default that created a fresh service queue per call. The
  corrected helper requires an explicit shared service, preventing a route adapter from silently bypassing
  serialization.
- First-party extension callers now supply `x-forge-operation-id`; the discontinued standalone web/CLI surfaces are
  explicitly outside this work. The sidecar and route harness remain internal parts of the installed IDE extension.
- Active implementation is split further inside W3B1a: workspace replace/merge, workspace create/snapshot restore,
  then bulk transform and route/E2E assertions. This serial split follows the shared `server.ts` write boundary.
- `POST /api/agent/workspace` and `POST /api/agent/workspace/merge` now execute through the one shared
  `WorkspaceReceiptService`. Each request binds the immutable workspace ID, paired complete content/snapshot
  resources, caller operation ID, Studio/agent identity, exact route/effect/request facts, and existing CAS result.
  Changed writes prepare `DestructiveRecoveryStore` state before `WorkspaceRegistry.commit`; receipt finalization
  precedes ordinary success, and finalization failure delegates to the existing guarded rollback path.
- Route responses expose only the terminal `{ id, hash, status }` projection. Exact retries return the already
  persisted terminal receipt without repeating mutation; reuse with changed material request facts returns
  `ACTION_RECEIPT_DUPLICATE_CONFLICT`. Failed CAS/body requests persist failed receipts, while dry-run and true
  no-change requests persist committed `no_change` receipts with exact before/after hash equality.
- The receipt store containment implementation was corrected for Windows hosts where `realpath` of a physical
  ancestor returns `EPERM`: ancestor failure is deferred without weakening junction/symlink refusal, and no missing
  path segment is created until its immediate parent is exactly verified. This removed the normal-`TEMP`
  `RECEIPT_ROOT_UNAVAILABLE` failure while preserving the escape guards.
- The replay comparator was corrected to distinguish immutable caller intent from first-execution lifecycle facts.
  Current-state before hashes, effect reversibility, and rollback availability may differ after a committed write;
  they no longer turn an identical retry into a duplicate conflict. Request hash, actor/client, capability,
  authority, effect identity/operation/resource identity, validation authority, and metadata remain exact.
- `tests/e2e/ephemeral.ts` now uses the shared operation-ID contract plus Node cryptographic randomness to generate
  one ID per logical workspace seed request. The assembled request (including that ID) is reused by transport
  retries; read helpers and unrelated endpoints remain unchanged.
- Evidence-containment repair is required before the next E2E run: Playwright may clear only its dedicated E2E
  artifact subtree, never the receipt/capability evidence roots beside it; the coverage path selftest must use a
  clean-clone-stable positive parent.
- Validation-tool repair is now the only implementation gate before the full E2E rerun: make `run-e2e.mjs` return
  an authoritative receipt when all test outcomes are terminal even if the Windows Playwright child hangs during
  teardown, while retaining an explicit red result for incomplete/missing outcome evidence.

## VALIDATE

- Coordinator-independent shared-service and route-slice validation, 2026-08-03:
  - `npx tsx src/server/workspaceReceiptService.selftest.ts` -> `25/25`, exit 0;
  - `npx tsx src/lib/actionReceiptRuntime.selftest.ts` -> `37/37`, exit 0;
  - `npx tsx src/lib/actionReceiptTransaction.selftest.ts` -> `23/23`, exit 0;
  - normal Windows `TEMP` `npx tsx src/lib/actionReceipt.selftest.ts` -> `119/119`, exit 0;
  - `npm run typecheck` -> exit 0; focused ESLint -> 0 errors; owned-file `git diff --check` -> PASS;
  - `npm run test:routes` -> `426/426`, exit 0, after a required fresh build.
- The service checks include unavailable/malformed policy, missing/malformed operation identity, malformed
  serialization key, exact replay after changed pre-state, changed-fact conflict, prepared/failed replay, same-key
  serialization, different-key overlap, prepare failure, finalization rollback, rollback failure/incomplete truth,
  and projection-only responses.
- Route proof independently reopens canonical persisted receipts for replace, merge, failed stale CAS, invalid body,
  dry run, and no change. It verifies exact projection/hash/identity, paired before/after resources, redaction,
  non-mutating replay, and changed-fact duplicate refusal. Missing/malformed operation IDs refuse before receipt or
  mutation. The final run left ports 3000/3001/3100/3101 closed and preserved the live workspace.
- One earlier route run reached `416/416 PASS` before Windows returned post-verdict `0xC0000409`; an immediate rerun
  returned `416/416`, exit 0. A later over-strong dry-run assertion expected current-state fields that the route
  deliberately omits in favor of `previewWorkspace`; the corrected real contract passed in the final `426/426` run.
- `npm run build` -> exit 0; `npm run lint` -> exit 0 with 591 warnings and zero errors; `npm run
  test:mcp-capabilities` -> exit 0; `npm run test:oracles` -> runtime-discovered `131/131`, exit 0, including
  workspace receipt service `25/25` and artifact pipeline PASS.
- The capability disposition generator exceeded its default 120-second worker timeout without writing. A native
  Luna rerun with an explicit long timeout generated and atomically promoted reviewed candidate SHA-256
  `2ee734fa58fb1366ae91f08e71e66b72cdc20b64dd39417a4ca36cda6a23bda7`; `npm run test:capabilities` then passed.
  The delta is nine receipt-owned source-closure entries plus one matching public self-test route, with no production
  authority or external-provider change.
- Full E2E baseline: 19 passed and 77 failed, each failure retried once. All 154 failure artifacts contain the same
  missing-operation-ID seed error; no second failure cause was found. The process then hit the known Windows libuv
  teardown assertions and the 20-minute outer timeout. After the fixture repair, the focused official slice ran
  both workspace-isolation tests successfully (`2/2`) but again timed out after the passes because the Playwright
  child never closed or wrote the verdict receipt. Both runs left ports 3000/3001/3100/3101 closed; their two exact
  task-owned temp state directories were removed, and older temp directories were preserved. This is not yet an
  official green E2E gate.
- Evidence-containment fixes are green: the candidate-path selftest now uses a clean-clone-stable direct child of
  `test-results` (`57/57`, path `9/9`), and Playwright resolves its destructive output cleanup to exactly
  `F:\DEV_ENV\X4_Forge\test-results\e2e`. The bounded nested prerequisite timeout is now five minutes and reports a
  dedicated timeout code; full receipt coverage passed in 182.5 seconds.
- Final checkpoint `npm run precommit:check` -> PASS, exit 0, 395.8 seconds. It passed tripwires, mirror parity,
  E2E verdict selftest `26/26`, product copy, durable writers `14/14` plus extension `8/8`, capability contract
  (11 capabilities / 293 disposed routes / one dynamic registrar / 10 MCP aliases), MCP capability policy, receipt
  coverage (82 routes / 48 surfaces), typecheck, and large-file integrity.
- All task-owned `x4-route-int-*` fixtures from these runs were removed by exact verified path. Older unowned temp
  fixtures were not touched. No listener/process leak remains.
- This is a `PARTIAL` two-route W3B1a checkpoint, not W3B1 completion. Workspace create, snapshot restore,
  bulk-transform apply, their compensation/failure route oracles, official full W3B1a E2E, package, and later W3C
  installed Antigravity proof remain required.

## REVIEW

- Shared service requirements 1-8: foundation support and two production consumers are implemented and green;
  satisfaction remains partial until every reviewed W3B1 route/surface consumes it.
- Coordinator correction: the initial exported convenience helper could instantiate an isolated queue per call.
  It was corrected and retested before acceptance.
- W3B1a requirements 9-12: replace/merge satisfy paired CAS, pre-state recovery, terminal-before-success, exact
  replay/conflict, redaction, stale/body failure, dry-run, and no-change truth. Create compensation, restore CAS,
  bulk apply, route-level same-scope concurrency/history-fault injections, and W3B1a E2E remain open. W3B1 and W3
  remain `IN_PROGRESS` until acceptance item 16 is met.
- Fresh-eyes correction: the first exact-replay implementation compared state-derived reversibility/rollback facts
  and returned 409 after a successful mutation. The service oracle and route harness now prove immutable-intent
  replay while retaining changed request/effect/metadata conflict.
- Capability-map delta: no new end-user capability claim. This checkpoint strengthens native mutation authority
  inside the installed extension-managed sidecar; visible receipt/history capability is still W3C.

## CLOSE

- Status: `IN_PROGRESS / PARTIAL` (shared runtime and 2/5 W3B1a routes green; no W3B1 close).
- Completed in this checkpoint: addressed workspace replace/merge receipt transactions and their focused/full route
  evidence.
- Deliberately not changed: workspace create, snapshot restore, bulk transform, W3B1b-d, artifact/provider/external
  W3B2-B3 work, visible extension controls, game/mod state, and any standalone web/CLI surface.
- Remaining immediate unit: serialize workspace create plus snapshot restore through the existing registry and
  recovery owners, then integrate bulk-transform apply and run W3B1a E2E.
- Suggested eventual W3B1 close title: `feat(authority): bind addressed state to action receipts`.

## AAR

- Triggered: the live reviewed inventory was materially broader than the handoff shorthand; two read-only
  diagnostics failed before successful alternatives; a first oversized route worker made no edits and was stopped;
  and coordinator review found and corrected the fresh-service concurrency footgun.
- Triggered: normal Windows `TEMP` reproduced `EPERM` while resolving a physical receipt-store ancestor; the first
  test-only repo temp masked it. The containment repair now proves both the physical-ancestor round trip and link
  refusal under the same injected failure.
- Triggered: exact replay returned 409 because lifecycle/current-state facts were compared as immutable request
  intent. Focused and route regressions forced the correction before checkpointing.
- Triggered: one full route run passed every assertion but ended with intermittent post-verdict `0xC0000409`; the
  clean rerun was required. A later 425/426 result exposed an incorrect test assumption about dry-run response shape.
- Triggered: route fixtures copy a large dependency tree and are not always removed while SQLite handles linger;
  exact task-owned cleanup was required. Several max-effort Luna workers also stalled after tests or broad reads and
  were interrupted/retired without letting Sol write implementation code.
- Triggered: the first raw oracle sweep was run without its owning isolated server and correctly returned 0/130;
  the authoritative `npm run test:oracles` harness then returned runtime-discovered 131/131. Use the owning isolated
  wrapper, not the client sweep by itself.
- Triggered: E2E reconciliation found the shared seed helper had not adopted the new caller-ID contract. The plan
  delta was documented after that one-file correction, violating document-before-implement ordering; future route
  authority changes must inventory every fixture caller before starting full E2E.
- Triggered: successful focused E2E assertions still cannot produce an official verdict because the Windows
  Playwright child hangs after its listeners stop. Validation-tool repair is required for evidence integrity and
  must be negative-tested so a hung or incomplete run cannot become green.
- Triggered: E2E erased the W3B0 evidence directory because Playwright owned all of `test-results`; the subsequent
  precommit correctly failed two path checks that relied on that untracked directory. Isolate Playwright output and
  make selftests independent of historical local artifacts.
- Triggered: the nested capability prerequisite had roughly two seconds of headroom in a standalone run and timed
  out under precommit load. Keep a finite deadline but size it for the observed worst path and report timeout truth
  instead of the ambiguous `exit=unknown` envelope.
- Triggered: three progressively smaller native Luna runner-repair workers and one resumed successful worker stayed
  `running` without writing despite valid V1 routing configuration. The static Sol-Luna validator passed with zero
  errors; no non-native implementation fallback was used. The runner close-path repair remains open.
- Sustain: exact reviewed inventory, current handler/store inspection, ADR reconciliation, fresh baseline, and
  package-boundary review before implementation.
- Improve work/approach: partition by rollback owner and response timing before assigning code; do not use route
  count as a proxy for transaction independence. Small service-first and route-slice work orders produced reviewable
  progress after the oversized server order stalled.
- Improve tools: Graphify's profile shim requires the narrow host approval; use exact symbols because natural-language
  queries over common words such as “workspace” return low-value graph matches.
- Highest-risk evidenced weakness: three W3B1a routes and every W3B1b-d owner can still mutate without this
  authoritative receipt transaction. Replace/merge are repaired, but post-response history cannot cover the
  remaining gap.
- Lessons banked: pending verified implementation; do not bank a speculative procedural skill from this plan alone.
