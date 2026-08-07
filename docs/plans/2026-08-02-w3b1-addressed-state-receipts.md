# B115 W3B1 — addressed-state action-receipt integration

Status: IN_PROGRESS / PARTIAL; the W3B1a workspace/CAS checkpoint is VERIFIED at 5/5 routes, while W3B1b-d, W3B2-B3, and W3C remain open
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

- `IN_PROGRESS / PARTIAL` — W3B1a shared foundations and the addressed workspace replace/merge/create routes are
  implemented and route-green (3/5); snapshot restore and bulk-transform apply remain open.
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
- Active implementation is split further inside W3B1a: workspace replace/merge/create, snapshot restore, then bulk
  transform and route/E2E assertions. This serial split follows the shared `server.ts` write boundary.
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
- Runner candidate result, 2026-08-04: `FAILED`. Independent execution of `node scripts/run-e2e.mjs --selftest`
  remained attached for 3,074.8 seconds despite a requested 60-second command timeout. Coordinator review also
  found three false-success/process-containment defects: recovered green did not require `termination.treeGone`,
  Windows descendant discovery occurred only after killing the root, and strict report-completeness checks applied
  only to recovery rather than ordinary close. A replacement native Luna restored `scripts/run-e2e.mjs` exactly to
  pushed `HEAD` and deleted only the two untracked supervisor/fixture files. The candidate is `REVERTED`; no official
  E2E rerun may proceed until a new independently bounded repair is specified and proven.
- Workspace-create implementation result, 2026-08-04: `BLOCKED` before product code. Four native Luna workers
  remained `running` without an implementation write; a fifth patch-author returned no output; the one previously
  responsive mechanical worker wrote only a 97-byte ownership comment and remained there for roughly ten minutes
  after a write-or-fail interrupt. A separate native Luna deleted that exact placeholder and scoped status is clean.
  No `server.ts` or adapter implementation survives, so no partial behavior is being misreported as progress.
- Native-routing diagnosis: the current validator reports `valid:false` because
  `F:\DEV_ENV\X4_Forge\.codex\config.toml` is missing. Global facts remain correct (`multi_agent=true`,
  `multi_agent_v2=false`, selected `sol-luna-v1.json`, Sol selector null, Luna V1, sole `luna_executor` role pinned
  to `gpt-5.6-luna` at max). A direct ephemeral read-only Luna diagnostic returned `READY` in 14.2 seconds, proving
  the model/service is healthy; it is diagnostic only and does not satisfy native implementation routing. Repairing
  the missing standing project config and restarting Codex require the operator protocol's explicit write approval.
- Continuation, 2026-08-04: the portable project config is restored, the structural validator is green, and fresh
  native-child metadata proves V1 `luna_executor` / `gpt-5.6-luna` / effort `max` with no parent-turn fork. The
  workspace-create adapter now exists and its focused oracle passes 16/16. It extends the real registry/service/store
  owners, commits one canonical global applied receipt, redacts raw material, replays exactly without a second create
  even after mutable origin changes, conflicts on changed same-identity facts, treats another Studio client as the
  distinct W3A identity defined by the receipt model, serializes global create attempts, compensates exact
  finalization failure, records compensation-fault incomplete truth, and fails closed on authoritative reopen loss.
  Coordinator review first reproduced
  `WORKSPACE_CREATE_RECEIPT_MISMATCH` on valid replay because original pre-state was compared to current registry
  state; the corrected adapter keeps first-execution pre-state strict while replay verifies stable resource identity
  and the stored aggregate hash against its own stored resources. `server.ts` route wiring and coherent HTTP harness
  assertions for refusal, commit/readback, replay, conflict, distinct-client identity, registry deltas, compensation,
  and redaction are now present; typecheck and the 16/16 adapter oracle pass. After the operator authorized quiet-
  machine Antigravity validation, the fresh production build and external HTTP harness passed 443/443. The task temp
  root was removed, ports 3000/3001/3100/3101 remained free, the exact dirty-worktree fingerprint was unchanged, and
  local `HEAD` stayed equal to `origin/main`. Workspace-create is runtime-green as route 3/5, while the W3B1a close
  still requires snapshot restore, bulk apply, and its official E2E gate.

### E2E terminal-verdict repair contract (SPECIFIED 2026-08-03)

- **Bounded unit:** repair only the existing `scripts/run-e2e.mjs` supervision boundary and its deterministic
  fixtures/selftests. Do not change Playwright specs, product code, the ephemeral server contract, retry/flaky
  policy, live ports, or the installed extension.
- **Existing authority reused:** the Playwright JSON report remains verdict authority; list output remains diagnostic;
  `writeJsonAtomic`, quarantine policy, and the existing verdict receipt remain the single close contract.
- **Observed failure:** the focused official slice printed 2/2 successful tests, but `runE2e()` waits exclusively for
  child `close`; inherited Windows handles can keep that event and the promise open after terminal report bytes are
  available. This is `[REPRODUCED]`, not an inferred test failure.
- **Safety/rollback:** supervision may terminate only the exact spawned Playwright process tree after a bounded
  grace/idle threshold. Reverting the runner/selftest files restores the prior behavior. No PID, port, temp root,
  user process, or live Forge state may be guessed or broadly killed.
- **Acceptance:** normal child close preserves the existing verdict; a deterministic complete-report teardown hang
  produces the same authoritative verdict, atomically writes a receipt describing the recovery/termination path,
  and leaves no owned child; deterministic missing, malformed, structurally incomplete, or nonterminal-report hangs
  terminate the exact tree, write a red receipt, and return 1. Duplicate events/timeouts settle exactly once; report
  and receipt temp files are contained/cleaned; no stdout-only path may become green.
- **Required tests:** preserve all 26 pure checks and add real supervision negatives for complete-report hang and
  incomplete-report hang, including exact child-tree cleanup and receipt readback. Then run the selftest, focused
  official E2E slice, full official E2E gate, port/temp containment checks, typecheck, and precommit.

### E2E terminal-verdict repair v2 (RE-SPECIFIED 2026-08-04 after rejected candidate)

- **Independent oracle:** the real-supervision selftest runs each production-supervisor probe in a separate parent-
  owned process. The parent has its own finite wall-clock deadline and direct exact-root tree cleanup, so a broken
  supervisor cannot make its own test wait indefinitely. A parent timeout is always red and its task-owned PIDs are
  checked independently before the selftest can return.
- **Production bound:** `run-e2e.mjs` owns a finite overall deadline plus a short terminal-report grace period; neither
  depends on Playwright emitting `close`. It samples the exact spawned root/descendant tree while the child is alive
  and performs one final bounded tree capture before any termination. Platform process discovery itself is bounded;
  unavailable or incomplete ownership evidence cannot produce green.
- **Strict truth on every path:** normal close and recovered teardown use the same structural report validator. A
  report must be parseable, contain a non-empty discovered test set, contain terminal result evidence for every test,
  and agree with the classified terminal totals. Missing, malformed, truncated, structurally incomplete, or
  nonterminal data stays red even if list output says every test passed.
- **Termination and receipt:** after a terminal report hangs past grace, or any run reaches the outer deadline, stop
  only the exact spawned process tree. Green requires every pre-captured owned PID to be absent. The atomically written
  verdict receipt records report completeness, termination reason, captured/remaining PIDs, and `treeGone`; it is
  reopened and schema-checked before exit 0. Receipt-write/readback failure is red.
- **Deterministic real-child fixtures:** preserve the existing pure policy checks and exercise at least normal close,
  complete terminal report plus teardown hang, and incomplete/nonterminal report plus hang. Each hanging fixture owns
  a descendant, records its PIDs, and proves both production cleanup and the independent parent bound. Test-only
  runner flags remain repository engineering machinery, not a Forge product CLI or installed-extension surface.
- **Containment/rollback:** fixture reports, PID records, and receipts use one selftest temp root and are removed after
  readback; Playwright continues to own only `test-results/e2e`. Reverting the exact runner/test files restores the
  pushed baseline; no product route, Playwright spec, retry/flaky policy, port, or installed extension changes.
- **Continuation, 2026-08-04:** the replacement now has a green first layer. A pure terminal-report inspector requires
  nonempty terminal test evidence, independently derives pass/fail/flaky/skip totals, requires exact stats agreement,
  rejects inconsistent retry sequences, and forces Playwright global reporter errors red. Fresh-eyes review first
  reproduced a false-green for nonempty top-level `report.errors`; the corrected contract passes 17/17 adversarial
  probes. `run-e2e.mjs` applies that same inspector on its ordinary close path and records only bounded inspection
  facts; the preserved 26 checks plus nine strict checks pass 35/35. This is still `IN_PROGRESS / PARTIAL`: the runner
  still waits on `close` and has no independent deadline, process-tree capture/termination, receipt readback, or
  real-child parent oracle.
- **Continuation, 2026-08-04 (process identity foundation):** `scripts/e2e-process-table.mjs` now parses the exact
  Windows WMIC CSV and deterministic C-locale POSIX `ps` formats into bounded, stable PID/parent/creation-token rows.
  It rejects malformed/oversized/duplicate/incomplete snapshots and passes 37/37 direct checks. Coordinator
  production-format readback first reproduced `header-mismatch` because this PowerShell host emits `CRCRLF`; a
  targeted native Luna correction now parses the real WMIC snapshot successfully without logging raw rows.
  `scripts/e2e-process-tree-contract.mjs` now owns both initial and repeated pure ownership. It preserves monotonic
  captured identities, seeds later traversal from exact active reparented descendants after root loss, captures new
  generations, reports reused PIDs without following their occupants, and inspects exact remaining/disappearance
  state. Its 30/30 checks plus coordinator adversarial probes cover malformed/cyclic data, reuse, reparenting, and
  fail-closed output. `scripts/e2e-process-table-adapter.mjs` adds one shared finite WMIC/`ps` command owner with a
  separate outer timer, helper-only cleanup, bounded output, sanitized errors, deterministic POSIX locale, and fail-
  closed platform dispatch. It passes 30/30 ten consecutive times, injected Windows/POSIX adversarial probes, and a
  sanitized current-host WMIC readback; the complete static bundle also passes parser 37/37, runner 35/35, syntax,
  typecheck, diff checks, and refreshed Graphify discovery (4,755 nodes / 11,567 edges). This remains a partial
  foundation: runner sampling/deadline, immediate pre-kill identity recheck, exact target termination, receipt
  readback, and independent real-child probes are not implemented. POSIX `ps lstart` is second-granularity, so POSIX
  termination requires a stronger identity token or an explicit fail-closed disposition before it can be called exact.

### E2E identity-rechecked termination subunit (SPECIFIED 2026-08-04)

- **Bounded unit:** add one new process-termination contract beside the accepted parser/tree/adapter modules. First
  implement only a pure preparation step that combines repeated closure with deterministic descendant-first active
  targets. Then add injected Windows execution in a separate Luna slice. Do not touch `run-e2e.mjs` until both layers
  are independently green.
- **Existing authority reused:** every pre-kill snapshot comes from `captureProcessTableSnapshot`; every ownership
  update comes from `captureOwnedProcessClosure`; disappearance truth comes from exact PID+creation-token identity.
  No second parser, process graph, PID registry, or broad `taskkill /T` ownership guess may be introduced.
- **Preparation contract:** given exact root identity, prior monotonic captured identities, and one validated snapshot,
  return the updated captured set, newly captured descendants, exact reused PIDs, exact root presence, `treeGone`, and
  active exact targets ordered deepest-descendant first with deterministic PID/token ties. Invalid/cyclic/reused data
  is fail-closed and no target is emitted on an incomplete result.
- **Windows execution contract:** immediately before each target command, capture/update again. If a new descendant is
  found, re-plan before killing its ancestor. If the target is absent or its PID token changed, do not signal that PID.
  The executor may invoke only exact argument-array `taskkill` for an identity that passed the immediate recheck, with
  finite command timeout/output bounds and sanitized errors. Poll fresh snapshots until every captured identity is
  absent or a finite pass/deadline limit returns red.
- **POSIX boundary:** no target signal is authorized from second-granularity `ps lstart`. The executor returns a stable
  unsupported/identity-insufficient failure on POSIX until a stronger token is implemented.
- **Required negatives:** wrong-token occupant, root already gone with active descendant, reparented captured child,
  new child appearing on immediate recheck, reused occupant with descendants, command timeout/failure, disappearance
  timeout, malformed snapshots/options, duplicate callbacks, and never-throw hostile inputs. Pure/injected selftests
  launch and kill no real process; independent parent-owned real-child proof is a later required layer.
- **Rollback:** delete only the new termination module and its task-owned fixture if the contract fails. Existing
  parser/tree/adapter bytes remain the rollback baseline.
- **Continuation result:** the pure preparation layer is now green. `prepareCapturedProcessTermination` reuses the
  repeated ownership owner, emits exact monotonic facts and deepest-descendant-first active targets, and remains
  iterative for a 50,000-row chain. Its 21/21 selftest passes ten consecutive times plus coordinator branch/reuse/
  large-chain probes. Two later workers, including a reduced recheck-only assignment, stayed running without creating
  `scripts/e2e-process-termination-step.mjs` and were closed with no residue. A fresh continuation decomposed that
  stalled unit further: `reconcileCapturedTerminationPlans` now validates and deep-clones two exact prepared plans,
  requires monotonic captured PID+creation-token identity, unions bounded evidence deterministically, reports final
  tree-gone truth, and authorizes a copied target only when the second plan discovers no new identity and retains the
  same first target. Its separate pure selftest passes 18/18, including hostile accessors/proxies/prototypes,
  malformed plans, target reorder/reuse refusal, bidirectional mutation isolation, and 50,000 identities. The async
  wrapper now calls the bounded adapter and accepted planner once or twice as required, seeds the second plan from
  first-plan captured identity, and delegates final policy to that pure reconciler. Its 10/10 injected no-process
  selftest covers first-gone, stable target, new-child and target-loss replanning, second-gone, invalid input, and
  both capture/plan failure layers with exact call counts. The exact Windows command adapter now passes 6/6 and owns
  only argument-array `taskkill.exe /PID <pid> /F` execution, never `/T`, with finite command/outer timeout, bounded
  output, sanitized errors, and explicit identity-insufficient POSIX refusal. The finite executor passes 8/8: every
  target receives the stable two-snapshot recheck immediately before command, a new child forces replanning, exact
  identities are commanded at most once, and command success remains red until a later fresh snapshot proves every
  captured identity gone. Coordinator adversarial probes also pass for multi-pass capture, nonzero polling, malformed
  command receipts, wrong-token occupants, persistent targets, and pass-limit truth. Fresh-eyes review found that
  consistent proxies were not explicitly rejected despite the strict contract; a targeted Luna correction now uses
  `node:util` proxy detection with durable top-level/target/nested-option regressions. Runner sampling/deadline,
  receipt readback, and independent parent-owned real-child proof remain unimplemented.

### E2E spawned-ownership sampling subunit (SPECIFIED 2026-08-04)

- **Bounded unit:** add one thin asynchronous composition owner plus one injected no-process selftest. It establishes
  the exact creation-token identity for the PID returned by `spawn`, captures its initial owned closure, and advances
  that closure monotonically on later samples. This slice does not edit `run-e2e.mjs`, start/kill a real process,
  write a verdict receipt, or implement timers.
- **Existing authority reused:** process I/O comes only from `captureProcessTableSnapshot`; initial ownership comes
  only from `captureInitialOwnedProcessClosure`; repeated ownership comes only from `captureOwnedProcessClosure`.
  No parser, PID registry, process graph, termination path, or alternate ownership rule may be added.
- **Contract:** strict plain-data input is cloned before any await. Initial capture accepts only a positive safe
  spawned PID and bounded snapshot options, requires a complete exact snapshot containing that PID, derives the root
  creation token from that row, and returns the accepted closure. Repeated sampling requires that exact root in the
  previous monotonic captured set and returns only validated/cloned root-present, captured, newly-captured, and reused-
  PID facts. Stable sanitized errors distinguish invalid input, snapshot failure, root unavailable, and closure-plan
  failure; raw process rows, command output, paths, and injected error text never escape.
- **Required negatives:** malformed/accessor/proxy/symbol/unknown input, malformed snapshot envelope, missing/reused
  root, malformed previous capture, duplicate rows, adapter timeout/failure, reparented captured child after root
  exit, PID-reused occupant refusal, mutation isolation, and exact one-snapshot call counts. All tests inject the
  adapter command callback and launch no process.
- **Rollback:** delete only the new sampling module and its selftest. Accepted parser, adapter, ownership, termination,
  and runner files remain unchanged.
- **Continuation result:** `initializeSpawnedProcessOwnership` now derives the spawned PID's exact token from one
  accepted bounded snapshot and delegates the initial closure to its sole pure owner.
  `sampleSpawnedProcessOwnership` clones the exact root/prior capture before await, takes one accepted snapshot, and
  delegates monotonic ownership to the repeated-closure owner. Both return one exact sanitized envelope; malformed
  options/hostile proxies reject before process I/O, transient command/parser failures stay red, reused occupants are
  never adopted, and no raw row/output escapes. The injected no-process selftest passes 8/8 five consecutive times:
  initial/late descendants, root-gone reparenting, reuse with a descendant, hostile zero-call input, stable snapshot
  errors, no-callback timeout/helper cleanup under a cleared one-second watchdog, and bidirectional mutation
  isolation. The complete static bundle, typecheck, exact project lint (0 errors / 592 warnings), and diff checks pass.
  Graphify is refreshed to 4,892 nodes / 11,943 edges / 202 communities. This remains a foundation only;
  `run-e2e.mjs` does not yet schedule it or own an outer deadline.

### E2E runner lifecycle coordination subunit (SPECIFIED 2026-08-04)

- **Bounded unit:** add one injected lifecycle coordinator and its no-real-process selftest, then wire that accepted
  owner into `run-e2e.mjs` in a separate slice. The lifecycle owner may schedule ownership samples, observe child
  close/error, probe only whether the strict report is terminal, choose one teardown trigger, and call the accepted
  exact disappearance executor. Report classification, receipt construction/readback, Playwright policy, and process
  launch remain with their existing owners.
- **Production bounds:** overall deadline 30 minutes, terminal-report grace 5 seconds, and one-second sampling delay
  after each completed bounded sample. The outer deadline is a separately armed timer and never depends on child
  `close`, report polling, or snapshot callback. Timer setup failure is red. Teardown uses the executor at most 20
  passes, 25 ms inter-pass poll, and the existing 5-second snapshot/command bounds.
- **Single-settlement policy:** exact triggers are `child-close`, `child-error`, `terminal-report-grace-expired`, or
  `outer-deadline`. Duplicate/late child events, report probes, grace, and deadline callbacks are ignored after the
  first trigger. Sampling stops and any in-flight bounded sample settles before termination begins; child listeners and
  lifecycle timers are always removed/cleared.
- **Ownership and disappearance:** initialize exact ownership from the spawned child PID before accepting any green
  path, advance monotonically while the child is alive, and retain a permanent evidence-incomplete flag after any
  failed initialization/sample. Teardown still attempts the exact captured tree when evidence is incomplete, but
  lifecycle completion requires complete ownership evidence plus an exact executor result with `treeGone:true`.
  Normal child close uses the same executor/disappearance proof as recovered teardown; process exit alone is not proof.
- **Report boundary:** the lifecycle receives only an injected bounded `probeTerminalReport` boolean. A strict complete
  report starts the grace timer; missing/malformed/incomplete data does not. The runner re-reads and classifies the
  report after lifecycle teardown, so no lifecycle narration or stdout can become verdict authority.
- **Required injected negatives:** invalid/hostile inputs, spawn error, initial/sample failure, terminal report plus
  no close, incomplete report until outer deadline, timer setup failure, termination failure/tree remaining, duplicate
  events, late callbacks, and mutation isolation. A cleared independent one-second watchdog bounds every short fixture;
  no injected unit test launches or kills a real process.
- **Rollback:** delete only the new lifecycle module/selftest before integration, or revert the later exact runner
  import/call. Accepted terminal, sampler, termination, policy, and receipt owners remain the rollback baseline.
- **Continuation result:** `scripts/e2e-runner-lifecycle.mjs` now composes the accepted ownership sampler and exact
  disappearance executor under one independently armed outer timer, one terminal-report grace timer, cancellable
  sampling, single settlement, listener cleanup, and permanent ownership-evidence failure truth. Its injected
  no-process oracle passes 12/12 five consecutive times, including outer deadline, child error, initialization/sample
  failure, timer failure, duplicate/late callbacks, hostile input, and mutation isolation. `run-e2e.mjs` now invokes
  that owner immediately after spawn, re-inspects the strict report after teardown, preserves bounded lifecycle facts
  in its receipt, and remains red for outer deadline, child error, interaction failure, incomplete report, malformed
  lifecycle, or unproven disappearance. The runner's pure checks pass 46/46. A separate injected fake-child integration
  oracle passes 7/7 five consecutive times for normal close, report-grace recovery, outer-deadline cleanup, incomplete
  report, malformed lifecycle, observed child error, and diagnostic interaction failure; it launches no process,
  clears every watchdog/listener, removes the temporary report, and deletes only its validated task-owned temp root.
  The complete static bundle, typecheck, lint baseline (0 errors / 592 warnings), and scoped diff checks pass. Receipt
  schema-v2 reopen/content verification and the independently bounded real-child parent oracle remain open, so at
  that point this subunit was still `IN_PROGRESS / PARTIAL` and no E2E checkpoint was yet verified.
- **Continuation, 2026-08-05:** the independent E2E harness/tooling lifecycle subunit is now `VERIFIED` by the full
  isolated `96/96` lifecycle receipt: zero failed, flaky, bad, or quarantined-blocking outcomes; `child-close`; and
  `treeGone=true`. Ports `3100/3101` were closed and the ephemeral state directory was removed. This verifies the
  harness/tooling lifecycle evidence only; it does not prove the missing W3B1a route semantics. Snapshot restore,
  bulk apply, route-specific finalization/compensation/fault-injection proof, and real-child receipt/restore/bulk
  acceptance remain open.

### Workspace-create receipt subunit (SPECIFIED 2026-08-03)

- **Bounded unit:** bind only `POST /api/agent/workspaces` to the existing receipt service, global registry receipt
  resource, and `WorkspaceRegistry.compensateCreate`; extend its existing route proof. Do not add another registry,
  receipt writer, workspace selector, user surface, or transaction kernel.
- **Pre-state/serialization:** prepare one global registry authority from a complete sorted structural registry
  snapshot and serialize on that global registry resource. The caller operation ID and sanitized requested workspace
  facts are immutable intent; the randomly allocated resulting workspace ID is an after-state fact, not caller input.
- **Success/replay:** create exactly one record, re-read the complete registry and created record, commit the receipt
  before returning 201, and include only the terminal projection additively. Bind the random result ID only in the
  existing bounded committed `after.code` as `workspace_created_<workspaceId>`; it is after-state, not caller intent.
  An exact operation replay reopens and verifies the authoritative receipt, extracts that validated ID, and returns
  the same record without creating another even if the record's mutable `origin` later changes. Within the same
  W3A actor/client operation identity, changed workspace/material facts conflict. A different client is a distinct
  canonical operation identity by design; forcing a cross-client conflict would require the forbidden operation map
  or would falsify receipt client identity. Do not add an operation map, registry field, receipt schema, or parallel
  store.
- **Compensation:** receipt-finalization failure calls only `compensateCreate` with the exact just-created paired
  hashes. Successful compensation removes that record from index/disk/memory while preserving the default and every
  unrelated record. A refused/partial compensation is non-success with durable incomplete/partial-after truth.
- **Failure paths:** missing/malformed operation identity, non-Studio actor, missing/malformed client identity,
  invalid/oversized/full-registry payload, create-write failure, duplicate conflict, finalization failure,
  compensation failure, response deadline, and history failure may never create false success or leak raw workspace
  payloads/paths into receipts.
- **Required proof:** exact receipt reopen/hash/identity/global-resource/after-state checks; one-record delta; exact
  replay and changed-fact conflict; unrelated/default preservation; finalization compensation and compensation-fault
  negatives; history projection/failure independence; route suite, focused selftests, typecheck, lint, build,
  receipt/capability/writer audits, and precommit. Full E2E waits for all five W3B1a routes.
- **Plan delta, 2026-08-04:** two broad and one server-only native Luna assignments produced no write. Split the
  implementation into a small `src/server/workspaceCreateReceiptAdapter.ts` module followed by minimal `server.ts`
  wiring. This is code organization only: the adapter must receive the existing registry, receipt service/store,
  runtime identity, default workspace, deadline predicate, and projection callback by injection; it may instantiate
  no store, queue, registry, policy loader, or transaction kernel. The acceptance contract is unchanged.

### Snapshot-restore receipt subunit (VERIFIED bounded checkpoint 2026-08-06; specified 2026-08-03)

- **Bounded unit:** bind only `POST /api/fs/restore-snapshot` through the existing addressed-workspace receipt
  transaction and recovery owners. Preserve the configured-root snapshot reader and `SnapshotManager`; do not fold
  snapshot creation/deletion into this subunit.
- **Source and intent:** require the already-added paired `expectedHead`/`expectedSnapshotHash`, a contained regular
  snapshot file, valid snapshot envelope, and sanitized target workspace. Bind the exact snapshot-byte/source hash
  and target content/snapshot hashes as bounded request facts; never persist an absolute path or raw snapshot/body.
- **Mutation/rollback:** prepare paired current workspace resources and durable pre-state recovery before the single
  `WorkspaceRegistry.commit`. Re-read paired CAS immediately before mutation. Receipt finalization precedes 2xx;
  finalization/postcondition failure restores the exact prior content/snapshot identity or records non-success
  incomplete truth when rollback fails.
- **Replay/failures:** exact replay performs no second commit/version change. Reuse after snapshot bytes, requested
  identity, client, or addressed workspace facts change conflicts. Traversal/junction/symlink, missing snapshot,
  malformed JSON/envelope, stale either-CAS half, invalid operation ID, recovery/finalization/rollback fault, response
  deadline, and history failure are explicit no-false-success paths.
- **Required proof:** canonical receipt reopen/hash/identity/source/paired before-after/recovery checks; exact replay;
  changed-file and both stale-CAS conflicts; traversal/host-path redaction; injected finalization rollback and rollback
  failure; history independence; focused route tests, full route suite, typecheck, lint, build, receipt/capability/
  writer audits, and precommit. Full E2E waits for bulk apply to complete the five-route W3B1a checkpoint.
- **Verified implementation delta, 2026-08-06:** the configured-root reader now accepts only a contained regular
  `snapshot_<safe-body>.json`, binds exact bytes and logical identity, rejects junction/symlink/path escapes, enforces
  exact `fstat`/read length, closes once, and detects pre-open/open/final identity drift. The route now requires one
  caller-owned operation ID plus paired expected workspace/snapshot hashes, rereads source and paired CAS at the
  mutation boundary, prepares durable recovery before the single registry commit, verifies the terminal persisted
  receipt before 2xx, replays without another version advance, and records rollback refusal/failure as non-success.
- **Verified evidence, 2026-08-06:** source reader `53/53`; adapter `27/27`; final fresh production route suite
  `467/467`; typecheck/build exit `0`; focused lint `0` errors / `240` existing `server.ts` warnings; durable writer
  audit `14/14` plus extension writer `8/8`; capability authority `11` capabilities / `294` disposed literal routes /
  one dynamic registrar / `10` MCP aliases; receipt coverage candidate/promotion `57/57`, policy bundle `18/18`, and
  reviewed audit `82` routes / `51` surfaces at SHA-256
  `2387d9db5bad96fa5040afed7d93f7eda90b6dfadf61ef8d64bd6f95ade6c637`; final precommit `[precommit] OK` in
  `484.9s`. Graphify refreshed to `5,720` nodes / `14,041` edges / `209` communities.
- **Containment:** the final route run returned exit `0` with zero new `x4-route-int-*` directories, zero new route
  processes, and zero listeners on `3000/3001/3100/3101`. The nine visible route temp roots all predate this
  checkpoint. No installed/rendered gate applies because this receipt-authority slice adds no user-visible surface;
  full isolated E2E remains deliberately deferred until bulk apply completes all five W3B1a routes.

### Bulk-transform-apply receipt subunit (VERIFIED bounded checkpoint 2026-08-07; specified 2026-08-03)

- **Bounded unit:** keep `POST /api/agent/bulk-transform/preview` read-only and unchanged; bind only the apply route
  through the addressed-workspace receipt transaction. Reuse `buildPlan`, `mergeBulkTransformPatches`, paired CAS,
  and the existing workspace commit/recovery owner.
- **Intent/source:** require expected plan/content/snapshot hashes. Recompute the canonical plan before prepare and
  bind its complete plan hash, corpus generation/selection facts through bounded hashes, and resulting target paired
  hashes. Raw rules, XML bodies, corpus paths, and host paths do not enter receipts.
- **Mutation/rollback:** serialize with other mutations of the same workspace; recheck plan and both CAS halves at
  the mutation boundary; prepare recovery before the one workspace commit; terminalize before success; restore exact
  prior paired state on finalization/postcondition failure.
- **Replay/failures:** exact replay never reapplies rows or increments the workspace version. Changed plan/corpus,
  rule/client/workspace facts conflict. Missing/malformed operation ID, stale plan, unclean/empty/overbroad plan,
  invalid rule, stale either-CAS half, concurrent workspace change, recovery/finalization/rollback fault, response
  deadline, and history failure are explicit non-success/no-false-success paths.
- **Required proof:** receipt reopen and bounded plan/source/paired before-after verification; exact replay; changed
  plan and concurrent same-workspace serialization; both stale-CAS halves; finalization rollback and rollback-fault
  truth; existing preview/apply E2E contract; focused route/selftests, complete routes, typecheck, lint, build, receipt/
  capability/writer audits, precommit, then the official full W3B1a E2E gate and containment checks.
- **Implemented boundary:** `bulkTransformApplyReceiptFacts.ts` binds canonical plan, selected corpus, rule, client,
  workspace, and paired before/after hashes without serializing XML, rules, paths, or host data. The receipt adapter
  owns same-workspace serialization, recovery-before-commit, exact replay/conflict, terminal-before-success,
  response-deadline refusal, rollback truth, and fail-soft history projection. The route requires the caller-owned
  `x-forge-operation-id` and reuses the existing registry, receipt service/store, and destructive-recovery store.
- **Product boundary:** preview remains read-only. No new visible control, alternate runtime, standalone app, or
  end-user CLI was introduced; this strengthens the extension-managed sidecar's deterministic mutation authority.

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
- E2E supervisor candidate selftest -> `FAILED`: the exact command above exceeded its independent 60-second bound
  and returned control only after 3,074.8 seconds. The tool cell was terminated; no `x4-e2e-supervision-selftest-*`
  temp directory or PID record remained, ports 3000/3001/3100/3101 were closed, and a command-line-filtered process
  check returned no runner/supervision/fixture match. Two Node processes created at the candidate start timestamp
  were inspected and matched none of those commands, so no unowned process was killed. A subsequent read-only CIM
  inventory itself exceeded one minute and was stopped; CIM is not an acceptable bounded cleanup oracle here.
- Candidate rollback -> `REVERTED`: coordinator readback proved `git diff --exit-code HEAD -- scripts/run-e2e.mjs`
  clean, `git diff --check -- scripts/run-e2e.mjs` clean, and both `scripts/run-e2e-supervision.mjs` and
  `tests/fixtures/e2e-runner/supervision-child.mjs` absent. No runner process or test was started by the rollback.
- Native routing validator -> `FAILED`: `F:\DEV_ENV\X4_Forge\.codex\config.toml: missing TOML file`; all inspected
  global catalog/feature/role facts were otherwise correct. The bundled launcher diagnostic also failed before Luna
  because `CODEX_CLI_PATH` contained concatenated executable paths, then because current `codex debug models` no
  longer accepts the launcher's obsolete `--json` flag. The manually updated ephemeral diagnostic reached exact
  Luna and returned `READY`; it made no file change and is not implementation evidence.
- Checkpoint status through 2026-08-06, superseded by the 2026-08-07 bulk delta below: this was a `PARTIAL` 4/5
  W3B1a checkpoint, not W3B1 or W3 completion. Replace, merge, create, and snapshot restore were runtime-green;
  bulk-transform apply remained open. Bulk-specific finalization/compensation/
  fault-injection proof and real-child bulk acceptance remain required. The independent
  E2E harness/tooling lifecycle subunit is verified by the full isolated `96/96` receipt, but that result does not
  prove the missing route semantics. Package and later W3C installed-extension proof remain required; W7 is a
  separate workstream and is not conflated with this status.
- Current checkpoint, 2026-08-05: `npm run precommit:check` -> PASS. This gate and the `96/96` lifecycle receipt
  validate the documented harness/tooling repair; neither supplies the missing W3B1a route semantics.
- Bulk-transform checkpoint, 2026-08-07: facts selftest `12/12`; receipt adapter `22/22`; real X4 9.00 reference API
  `85/85`; complete production routes `467/467`; focused rendered corpus-authoring E2E `1/1`; final official full
  E2E `96/96` with `treeGone=true`, zero remaining PIDs, and closed ephemeral ports. The focused Studio fetch carried
  a valid caller-owned operation ID and the route/reopen proof covers committed receipt, exact replay, changed-fact
  conflict, paired stale CAS, recovery/finalization/rollback outcomes, and unchanged preview/no-change behavior.
- Governance and deterministic gates: receipt policy `18/18`; workspace receipt service `25/25`; receipt coverage
  `82` routes / `52` surfaces at reviewed manifest SHA-256
  `2c9678bf58ba39b4dfc81a9e2ee8874ee360a816a6d7e391779eb990a94a73f7`; writers `38` filesystem / `11` host / `2`
  browser plus `14/14` selftest and extension `8/8`; capability contract `11` capabilities / `294` routes / one
  registrar / `10` MCP aliases; runtime-discovered oracles `132/132`; typecheck, build, authoritative lint (zero
  errors, 591 existing warnings), owned diff check, and graph rebuild all passed. Graphify now records `5,888` nodes,
  `14,501` edges, and `210` communities; `executeBulkTransformApplyReceipt` resolves at degree `24`.
- Final pre-documentation precommit returned `[precommit] OK` in `499.7s`, including E2E verdict selftest `54/54`,
  product-copy, writer, capability/MCP, receipt, type, mirror, size, and tripwire gates. The later release-close
  synchronized precommit also returned `[precommit] OK`, exit `0`, in `465.4s`; the commit hook repeats the gate
  against exact staging.
- Packaged/installed extension proof: inspected VSIX 18,097,543 bytes, SHA-256
  `B5EC4B9428FDF23D16711DA35D80F5068B0FA8E35E1FF2E11B7D22F3AF31DEF3`; the installed server bundle changed from
  the old baseline to exact staged/installed SHA-256
  `28D789465936D5869DD3707E21821CF0697FB2FE5851DC5034E5C3F9DD685BD7`. After Antigravity reload, Forge
  `v1.0.428` rendered the preserved workspace with all three schema sources loaded and launched port `50853` from
  the installed extension directory. Live read-only API proof returned receipt service `25/25` and advertised the
  required bulk-apply operation header. The live config hash remained
  `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697`. Evidence:
  `vscode-extension/evidence/2026-08-07-w3b1a-bulk-receipts/installed-validation.md`.
- Separately authorized stable-release proof: OpenVSX public `0.0.65` downloads at `18,098,264` bytes and exact
  SHA-256 `ACBF40475A0AB55AA269E5728FE2B0927C22C9B9CC1F38F12AAD473A1F392D21`. Installed Antigravity
  `x4forge.x4-forge-studio@0.0.65` matches the staged critical hashes; after reload, Forge `v1.0.428` again rendered
  schema counts `1507/1408/2333`, managed sidecar `:52634`, receipt selftest `25/25`, and the required operation
  header with unchanged config. Evidence: `vscode-extension/evidence/0.0.65-release-validation.md`.
- Current status, 2026-08-07: W3B1a is `VERIFIED` at 5/5 workspace/CAS routes. W3B1 remains `PARTIAL`; W3B1b-d,
  W3B2-B3, and W3C remain open. No game or mod directory was mutated during installed proof.

## REVIEW

- Shared service requirements 1-8: foundation support and two production consumers are implemented and green;
  satisfaction remains partial until every reviewed W3B1 route/surface consumes it.
- Coordinator correction: the initial exported convenience helper could instantiate an isolated queue per call.
  It was corrected and retested before acceptance.
- W3B1a requirements 9-12: replace/merge satisfy paired CAS, pre-state recovery, terminal-before-success, exact
  replay/conflict, redaction, stale/body failure, dry-run, and no-change truth. Create adds global serialization,
  exact result identity, compensation, incomplete compensation-fault truth, authoritative reopen, replay/conflict,
  and distinct-client proof. Snapshot restore now adds contained exact-byte source authority, mutation-boundary
  source/CAS rechecks, recovery-backed compensation, replay/conflict, stale-half, deadline, redaction, finalization,
  rollback-success, rollback-refusal, and rollback-failure proof. Bulk apply now adds canonical plan/source hashing,
  same-workspace serialization, paired mutation-boundary CAS, recovery-before-one-commit, exact replay/conflict,
  finalization rollback/refusal/failure truth, response-deadline refusal, and fail-soft projection. Real-server
  reference and installed-Studio E2E proof satisfy the W3B1a receipt/restore/bulk acceptance boundary, and the final
  isolated `96/96` receipt proves the complete official E2E lifecycle. W3B1 and W3 remain `IN_PROGRESS` until
  W3B1b-d and acceptance item 16 are met.
- Fresh-eyes correction: the first exact-replay implementation compared state-derived reversibility/rollback facts
  and returned 409 after a successful mutation. The service oracle and route harness now prove immutable-intent
  replay while retaining changed request/effect/metadata conflict.
- Capability-map delta: no new end-user capability claim. This checkpoint strengthens native mutation authority
  inside the installed extension-managed sidecar; visible receipt/history capability is still W3C.

## CLOSE

- Status: `IN_PROGRESS / PARTIAL` for W3B1 overall; the bounded W3B1a workspace/CAS checkpoint is `VERIFIED` at 5/5
  routes—replace, merge, create, snapshot restore, and bulk-transform apply. There is no W3B1 or W3 close.
- Completed in current worktree evidence: bulk-transform apply's deterministic fact binding and receipt transaction,
  focused fault/replay/CAS/recovery proof, real-server route/reference proof, official `96/96` E2E with child-close and
  `treeGone=true`, governance promotion, final green product gates, inspected package, exact installed-byte parity,
  and live Antigravity sidecar/schema/selftest readback.
- Deliberately not changed: W3B1b-d guarded filesystem/recovery/config/credential owners, artifact/provider/external
  W3B2-B3 work, visible W3C receipt/history controls, game/mod state, and any standalone web/CLI surface. W7 remains
  separate from this status.
- Remaining immediate unit: reconcile and implement W3B1b guarded filesystem/recovery mutations against the same
  receipt transaction and exact contained-resource authority. W3B1c-d follow; W3B1 closes only at acceptance item 16.
- Current combined release/checkpoint title: `release: publish X4 Forge Studio 0.0.65`.
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
- Triggered: the first concrete supervisor candidate failed its own real-child selftest by remaining attached for
  3,074.8 seconds against a requested 60-second shell bound. Fresh-eyes review independently found that it could
  report green without proving the exact process tree gone, discovered descendants too late for reliable cleanup,
  and enforced strict report completeness only on its recovery path. The candidate was exactly reverted and cannot
  gate E2E.
- Improve tools: do not test a process supervisor with a timeout implemented solely by that same supervisor. The
  next candidate needs an independent bounded parent oracle, pre-termination exact descendant capture, and green
  acceptance conditioned on both a complete terminal report and verified disappearance of every owned PID.
- Triggered: the replacement strict-report layer initially accepted nonempty top-level Playwright reporter errors as
  green because the existing classifier only counted per-test outcomes. Coordinator adversarial proof forced a native
  Luna correction; global errors are now complete-but-red and missing error truth is incomplete.
- Triggered: after the strict-report layer went green, multiple progressively smaller process-table/closure Luna
  assignments remained running without writing. They were closed with no candidate residue; the session entered
  degradation territory and handed the next micro-slice to a fresh session rather than using a fallback writer.
- Triggered: in the fresh continuation, one parser worker and one broader tree-contract worker again remained running
  without writes and were closed before late changes. Smaller serial assignments produced the accepted files. The
  first synthetic-green parser still failed current real WMIC input on `CRCRLF`; targeted correction and a permanent
  regression check made the real format green. The initial-closure worker also required a long bounded reasoning
  window before writing, so the repeated-snapshot unit moved to another fresh continuation.
- Triggered: the first two bounded OS-adapter Luna workers stayed running without creating their sole target and were
  closed with no residue. A third, production-only mechanical order wrote the accepted Windows wrapper; serialized
  follow-ups added 18 Windows checks, one shared POSIX path, 24 cross-platform checks, and the final dispatcher at
  30/30. No fallback writer was used.
- Triggered: fresh-eyes review found the Windows timeout selftest used a 160 ms wall-clock ceiling, which could fail
  under event-loop starvation despite correct bounded behavior. A targeted Luna correction replaced it with a
  cleared one-second watchdog, and ten consecutive 30/30 runs pass. The first coordinator adversarial command also
  failed before Node execution because of invalid JavaScript wrapping around a PowerShell here-string; the corrected
  read-only probe passed.
- Highest-risk evidenced weakness: POSIX `ps lstart` has only second-level start-time precision. Read-only snapshots
  are bounded and useful, but same-second PID reuse cannot authorize POSIX target termination; strengthen that token
  or fail closed on POSIX before adding the kill layer.
- Triggered: one broad termination-planner worker produced no file, while a mechanical production-only planner worker
  plus a separate test worker completed 21/21. The next two progressively smaller two-snapshot recheck workers again
  produced no file and were closed without residue. This continuation is in degradation territory; preserve the
  handoff and retry the recheck in a fresh continuation rather than widening scope or substituting a writer.
- Triggered: in the fresh continuation, one still-reduced plan-reconciliation worker again produced no file. A
  fail-closed skeleton and serial identity, array, plan, conservative-reconcile, stable-target, and test-only Luna
  slices produced the accepted 18/18 pure contract. Coordinator review caught and corrected one quadratic plan
  consistency scan and one missing plain-object prototype guard before acceptance. Several larger test batches made
  no write and were closed without residue; one- to four-check append slices were reliable.
- Triggered: the first combined async-capture workers again made no write, while serial failure-helper, first-capture,
  first-plan, tree-gone, second-capture, and second-plan slices produced the accepted 10/10 wrapper. One closed
  two-case test worker landed a late fourth helper before shutdown while the successor was editing the same tail;
  independent execution exposed the settled 3/3 state, and a final tail-only Luna correction made the intended 4/4
  seed deterministic before failure-path checks extended it to 10/10. Never assume `close_agent` makes already-
  running edits instantaneous; verify file timestamp/content after shutdown before assigning overlapping scope.
- Improve tools: one read-only routing inspection printed an unredacted global config and exposed an existing local
  credential in private tool output. It was not used, sent, or committed. Future routing checks must select exact
  non-secret keys only; the credential owner must rotate the exposed value.
- Triggered: the first combined disappearance-executor test fixture reused the captured child PID/token in the row
  labeled unrelated, so a second recheck correctly consumed more injected snapshots and exposed the bad fixture.
  A targeted correction used a truly unrelated PID. One closed broad test worker also landed a valid late file; the
  coordinator froze the overlapping path and reviewed timestamps/content before continuation.
- Triggered: fresh-eyes production review found that proxy traps failed closed but well-behaved proxies could pass
  command/executor input normalization. A narrow correction now uses the supported `node:util` proxy detector and
  durable command/executor proxy cases. The accepted post-correction bundle is command 6/6, executor 8/8, async
  recheck 10/10, runner 35/35, and typecheck green.
- Triggered: the first spawned-ownership worker, a production-only retry, and one initialize worker made no write and
  were closed without residue. Serial scaffold, strict reader, initialize, sample, and one- to three-case selftest
  slices produced the accepted 8/8 owner without a non-native fallback. The broad eight-case test worker and combined
  final two-case worker also made no write; smaller append slices completed the durable suite.
- Triggered: fresh-eyes review found `normalizeSnapshotOptions` constrained keys but not value types, which mapped
  malformed caller input to snapshot failure instead of zero-I/O invalid input. The targeted correction now validates
  platform/function/10..15000 ms values before await and the durable hostile group covers them.
- Triggered: one JavaScript work-order string failed before worker spawn because an embedded delimiter was not escaped.
  A corrected array-joined message spawned successfully. Coordinator lint also initially targeted the whole checkout
  and encountered unrelated staged-install bundles; the authoritative package lint scope passed 0 errors / 592 warnings.
- Triggered: repeated native Luna create workers could perform small mechanical rollback/deletion tasks but did not
  produce nontrivial implementation code. The project validator then reproduced a missing `.codex/config.toml`, and
  the post-update diagnostic launcher reproduced two stale CLI assumptions. Stop assigning product code until the
  standing project config is explicitly authorized, restored, validated, and Codex restarted if required.
- Improve work/approach: a placeholder comment is not implementation progress. The coordinator removed it through a
  separate exact Luna rollback and preserved a clean behavior baseline rather than accumulating speculative files.
- Sustain: exact reviewed inventory, current handler/store inspection, ADR reconciliation, fresh baseline, and
  package-boundary review before implementation.
- Improve work/approach: partition by rollback owner and response timing before assigning code; do not use route
  count as a proxy for transaction independence. Small service-first and route-slice work orders produced reviewable
  progress after the oversized server order stalled.
- Improve tools: Graphify's profile shim requires the narrow host approval; use exact symbols because natural-language
  queries over common words such as “workspace” return low-value graph matches.
- Highest-risk evidenced weakness: one W3B1a route and every W3B1b-d owner can still mutate without this
  authoritative receipt transaction. Replace/merge/create/snapshot restore are repaired, but post-response history
  cannot cover the remaining gap.
- Lessons banked: pending verified implementation; do not bank a speculative procedural skill from this plan alone.
- Continuation, 2026-08-05: the independent E2E harness/tooling lifecycle subunit reached `VERIFIED` through the
  isolated `96/96` lifecycle receipt and cleanup proof. Preserve the boundary: this does not promote the missing
  snapshot-restore/bulk route semantics, their fault-injection evidence, or real-child receipt/restore/bulk acceptance
  to green; W7 remains separate.
- Triggered, 2026-08-06 snapshot restore: the first broad writer audit correctly refused the new fixture writer and
  stale fingerprint. After exact registration, capability authority then refused the newly reachable source boundary;
  its hashed candidate/promotion added only the two source files. Receipt coverage subsequently refused the new
  fixture surface and six shifted source references; its separate candidate/promotion added one receipt-exempt row,
  and a final selftest correction updated three stale positive `50` expectations to the reviewed `51`. Each refusal
  remained red until its own authority was reviewed and promoted.
- Triggered, 2026-08-06 tooling: an early two-minute coverage wrapper left two command trees from overlapping audit
  attempts; only the exact task-owned process trees were stopped and verified absent before the clean serialized
  rerun. One worker-spawn template literal and one read-only PowerShell projection failed to parse before execution;
  corrected array-joined/structured commands succeeded without file mutation. Do not run duplicate long authority
  scans, and do not infer cleanup from an outer wrapper timeout.
- Sustain, 2026-08-06: exact-byte contained source capture, mutation-boundary reread, paired CAS, one commit owner,
  recovery-before-mutation, persisted-receipt reopen, redacted failure envelopes, exact candidate/hash promotion,
  and independent final route containment made the checkpoint reviewable.
- Improve tools, 2026-08-06: the coverage wrapper hides prerequisite stderr and reports only the prerequisite label.
  Run the named prerequisite directly after failure, then use the authority's candidate workflow; never hand-edit a
  reviewed manifest. Graphify output is ignored by Git, so verify timestamp/loadability and graph counts explicitly.
- Triggered, 2026-08-07 bulk apply: the initial API-schema edit omitted the caller-owned operation header even though
  the route required it. Reconciliation corrected the advertised contract before acceptance, and route/live installed
  readback now prove the header is present.
- Triggered, 2026-08-07 governance: writer authority first refused the fixture writer; capability authority then
  refused two new source-boundary modules; receipt coverage refused the additional fixture-cache surface and shifted
  source references. Each candidate was independently reviewed and promoted by exact hash before its gate turned
  green; no manifest was hand-edited around a refusal.
- Triggered, 2026-08-07 validation: an ad hoc lint command incorrectly included Node `.mjs` files without the
  repository's Node globals and produced 26 false `no-undef` errors. The authoritative `npm run lint` scope passed
  with zero errors. One 15-minute outer E2E observer killed a healthy suite that requires about 19 minutes; exact
  owned PIDs were verified and stopped, ports cleared, and the final full run passed `96/96`. A separate run hit the
  known post-verdict Windows `0xC0000409`; the exact focused retry and final full suite both passed.
- Triggered, 2026-08-07 tooling: several larger Luna route-test assignments remained byte-silent and were closed with
  no accepted residue; smaller deterministic fact/adapter units completed natively. A temporary cleanup attempt and
  one installed-hash PowerShell projection had syntax/handle failures without deleting user data; corrected bounded
  commands succeeded. Antigravity's first reload-key attempt opened Quick Open rather than the command palette; the
  native View menu path executed the intended reload, preserving the canvas and starting the new managed sidecar.
- Sustain, 2026-08-07: separate canonical-fact and transaction adapters, exact governance candidates, real 9.00
  corpus proof, final full E2E, installed byte parity, runtime command-line provenance, public schema readback, and a
  non-mutating installed selftest made the fifth W3B1a route independently reviewable.
- Highest-risk evidenced weakness, 2026-08-07: W3B1b-d mutation owners still execute without complete native receipt
  authority. W3B1a is closed, but post-response history cannot cover those remaining guarded filesystem, recovery,
  configuration, and credential mutations.
