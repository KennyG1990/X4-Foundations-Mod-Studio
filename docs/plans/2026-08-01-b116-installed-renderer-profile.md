# B116 — Installed Renderer Trace And Conditional Workspace Polling

> **For Agent:** follow the Full lane in `AGENTS.md`; preserve the isolated E2E stack and collect installed-host
> evidence only after deterministic fixture/source gates are ready.

**Goal:** separate the reproduced Antigravity renderer stall from Forge polling, DOM and accessibility costs; remove
the independently proven 6.04 MB unchanged-poll transfer; then repeat the exact installed Bridge close/remount gate.

**Architecture:** keep `ContinuousPollingScheduler` as the single timer/fan-out owner. Reuse the existing
`GET /api/agent/workspaces` summary contract to compare the selected immutable workspace ID and a separate complete
snapshot digest, and fetch `GET /api/agent/workspace` only when that digest is unknown or changed. The existing
`workspaceHash` remains the registry/CAS identity and is not migrated. App and Agent Bridge continue to share one
addressed polling resource. A deterministic isolated Playwright fixture separates snapshot size, visible
DOM density and accessibility-tree traversal before the same interaction is profiled in installed Antigravity.

**Tech stack:** React 19, TypeScript, Express workspace registry/CAS, the shared polling scheduler, Playwright/CDP,
Antigravity's VS Code-derived renderer tracing and extension-host profiler, VSIX staging/inspection/install gates.

Task: B116 installed-renderer remediation
Lane: FULL

## PLAN

- Bounded unit: add one deterministic 1,424-node/1,420-link performance fixture; measure small/sparse/dense/AX
  controls in the ephemeral stack; implement summary-first conditional workspace polling without changing the
  generic scheduler or server route inventory; rebuild/install exact bytes and repeat the Bridge close/remount gate
  with renderer and extension-host evidence.
- Assumptions and unresolved facts:
  - `[REPRODUCED]` Bridge close in two Antigravity windows preceded 173-228 second `CodeWindow` stalls.
  - `[REPRODUCED]` current Bridge cleanup is one scheduler subscriber deletion; a 10,000-cycle benchmark measured
    0.0003 ms median, 0.0017 ms p99 and 0.0502 ms maximum.
  - `[REPRODUCED]` the active workspace response is 6.04 MB with 1,424 nodes/1,420 links and is parsed every three
    seconds while unchanged.
  - `[HYPOTHESIS]` Forge renderer/DOM/accessibility work is the primary trigger or amplifier; Antigravity
    extension-host IPC remains a material alternative. Only the control matrix and trace may change that judgment.
- Authoritative references: `AGENTS.md`; ADR-F1/F5 in `F:\StarForge\wiki\x4-forge\decisions.md`; capability map
  `F:\StarForge\wiki\x4-forge\capability-map.md`; B115 attempt-1 evidence; Microsoft VS Code's official
  [performance investigation](https://github.com/microsoft/vscode/wiki/performance-issues) and
  [unresponsive renderer tracing](https://github.com/microsoft/vscode/wiki/Runtime-Debugging) workflows.
- In scope:
  - isolated performance/AX fixture and measurements;
  - summary-first shared workspace polling with exact authority and fail-closed response checks;
  - source, oracle, focused/full E2E, production, packaged, installed and real-rendered regression gates;
  - sanitized trace/profile findings and hashes, with raw profiles kept outside Git.
- Out of scope:
  - rewriting scheduler cancellation or React ownership without trace evidence;
  - adding `/api/agent/workspace/head`, SSE or WebSocket transport;
  - migrating or redefining persisted `workspaceHash` CAS identity, recovery or selection semantics; the existing
    mutation chokepoint may accept a second snapshot precondition because reconciliation proved it is required to
    prevent non-CAS-field clobbering;
  - changing the game, live mod, credentials, public store version or publishing;
  - fixing an Antigravity-owned workbench defect if Forge controls prove it is outside Forge.
- Likely files:
  - create `src/lib/workspacePolling.ts` and `tests/e2e/fixtures/largeWorkspace.ts`;
  - modify `src/lib/workspaceIdentity.ts`, `src/lib/workspaceRegistry.ts`, `src/lib/destructiveRecovery.ts`,
    `src/lib/agentHistory.ts` and `server.ts` to expose a complete, in-memory-cached snapshot digest without changing
    the persisted registry/CAS hash, and extend existing history/recovery guards to that complete identity;
  - modify `src/main.tsx`, `src/App.tsx`, `src/components/AgentBridge.tsx`,
    `src/lib/continuousPolling.selftest.ts`, `tests/e2e/continuous-polling.spec.ts`;
  - update this record, `BACKLOG.md`, `SESSION-HANDOFF.md`, Kimi/capability records only by proven delta, and
    `graphify-out/graph.json` after source changes.
- Risks and authorization boundaries:
  - a 6 MB/1,424-node fixture may expose timeouts or memory pressure; it runs only on ports 3100/3101 with the
    per-run temporary `X4_STATE_DIR`, never the live workspace;
  - raw traces, profiles, HAR/status output may contain paths, URLs or tokens, so they are never staged;
  - installed tracing requires a controlled Antigravity restart and can reproduce a multi-minute stall. Preserve
    the current repo files, inspect for unsaved editor buffers, use `Keep Waiting` for the non-profile control, and
    use the official traced `Reopen` recovery only for the trace capture;
  - no game/mod directory, standing credential/configuration, public release or external service may be written.
- Rollback/checkpoint:
  - source baseline is `fd8fb309e6f4e4f11ab611ed05419089a53800b8`, already equal to `origin/main`;
  - preserve all unrelated dirty files listed under BASELINE; revert only B116-owned paths if the implementation
    fails, and reinstall the already-inspected local 0.0.63 B115/R13 VSIX if the installed candidate regresses.
- Acceptance criteria:
  1. Fixture deterministically produces exactly 1,424 sanitized nodes and 1,420 links below the 16 MiB registry
     limit, with independent sparse/dense layout and approximately 6.04 MB snapshot controls.
  2. Small, large-sparse, large-dense and AX-only controls record payload bytes, close latency, renderer heartbeat/
     long tasks and polling subscriber counts without touching live ports/state.
  3. Opening Bridge yields two subscribers; pointer close yields one; remount restores two. The isolated close/remount
     path completes within five seconds and no stale result crosses a workspace-authority change.
  4. App and Agent Bridge retain one shared resource key/contract and the generic scheduler remains unchanged.
  5. An unchanged selected snapshot digest uses `GET /api/agent/workspaces` and transfers zero full-workspace
     responses after bootstrap/prime. One changed digest causes exactly one full `GET /api/agent/workspace`, then
     returns to summary-only ticks. A version-only/same-digest summary does not transfer the full body. Changes to
     every authoritative sanitized workspace field omitted by legacy `workspaceHash` (`id`, `uiTheme`, `templates`,
     `mdScriptName`, `sourceFolder`, `contentId`, `mdOriginal`, `contentOriginal`) must each force exactly one full
     fetch. `workspace.id` remains behavioral content because authoring surfaces use it in generated paths/scripts;
     accepted legacy records that omit it receive a deterministic local ID derived from immutable `workspaceId`.
  6. A missing selected summary, mismatched full-response workspace ID/hash, aborted request or failed full fetch is
     rejected; failure does not poison the cache and the next tick retries. A stale old-authority response is not
     applied. Local dirty, queued-write, CAS-head learning, conflict and divergence invariants remain green. A
     Studio write carrying both the CAS head and snapshot digest is rejected if another writer changed only a field
     outside the legacy CAS hash; two rapid local changes outside that hash cannot clear each other's dirty state.
     Snapshot-only writes remain visible in Agent History. Forced-workspace recovery records both identities, rejects
     later snapshot-only drift as `RECOVERY_STALE`, and legacy content-only receipts are not advertised as replayable.
  7. Installed candidate bytes match the inspected VSIX. In the real rendered Antigravity host, Bridge close/remount
     completes without a new `CodeWindow: detected unresponsive` event, contract/readiness stay truthful and the
     renderer profile shows no Forge-owned long blocking stack.
  8. If criterion 7 still fails, B116 closes `PARTIAL` or `FAILED` with the trace's sanitized top stacks; R13/B115 W1
     remain `PARTIAL`, and no public release occurs.
- Required validation and negative path:
  - exact fixture self-check plus polling oracle;
  - `npm run typecheck`, lint for owned paths, focused polling E2E, full `npm run test:e2e`, production build,
    `graphify update .`, `npm run precommit:check`;
  - stage-app, VSIX inspector, staged probe, package, installed-byte parity;
  - installed Antigravity pointer-close control without accessibility capture, AX-only control, traced close/remount,
    extension-host profile as a negative/correlation control, host log delta and screenshot.
- Evidence locations:
  - deterministic/source output under `test-results/b116/` (ignored);
  - raw profiles/traces under `test-results/b116/raw/` (ignored, never staged);
  - sanitized measurements in this plan and installed screenshots under
    `vscode-extension/evidence/2026-08-01-b116-installed/`.

## BASELINE

- Revision/version: `HEAD == origin/main == fd8fb309e6f4e4f11ab611ed05419089a53800b8`; installed local
  `x4forge.x4-forge-studio@0.0.63` is the exact B115/R13 artifact with recorded critical-file parity.
- Existing changes/failures/runtime state:
  - unrelated modified `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`; unrelated deleted data/docs/Discord
    scripts; unrelated modified old evidence and untracked issue templates, Kimi note and R8/R17 evidence are user
    state and must not be staged or reverted;
  - B115 installed attempt 1 failed only at the real Bridge close interaction; source/browser/package/install parity
    gates passed;
  - Antigravity was left responsive in Beginner mode with Bridge closed; its managed sidecar was on port 59743;
    X4 was observed running but was not controlled or written.

## RECONCILE

- Resources and readers/writers searched:
  - `ContinuousPollingScheduler`, `useContinuousPolling`, App and Agent Bridge workspace subscriptions;
  - workspace bootstrap/list/full GET routes, `WorkspaceRegistry.summary()`, immutable workspace ID/CAS owners;
  - Canvas frustum culling/minimap cap, E2E performance counters, fixture/seed infrastructure, installed workbench logs
    and VS Code profiling commands.
- Existing capability reused:
  - `/api/agent/workspaces` already returns `workspaceId`, `version` and both workspace identities; no head endpoint is needed;
  - the ephemeral E2E stack, `seedServerWorkspace()`, fetch counter, scheduler snapshot and Bridge 2->1 test already
    own the required isolation and contract seams;
  - Canvas already culls by visible bounds and caps minimap dots, so the fixture controls snapshot size separately
    from dense visible DOM rather than presuming all 1,424 nodes render.
- Couplings checked: ADR-F1/F5 authority and CAS; bootstrap hash; local dirty/revision/queued-write guards; Bridge
  pending/auto-sync states; global fetch authentication/address injection; server registry 16 MiB/50-record bounds;
  extension webview and Antigravity workbench process ownership.
- Capability-map delta: no new user-facing capability. This task strengthens performance/reproducibility and the
  installed evidence bar for the existing workspace-sync capability.
- Plan changes from attempt 1:
  - do not alter unsubscribe/cancellation;
  - do not add a duplicate head route;
  - isolate AX capture from the close action because the only quick prior close used accessibility invocation while
    the reproduced pointer close was followed by accessibility-tree capture;
  - keep raw profiles out of Git because they can expose local paths and session data.
- Review-driven plan correction (2026-08-01): `[REPRODUCED]` `workspaceContentHash()` omits persisted workspace
  fields, so using the CAS hash alone as a polling digest can silently miss real mutations. Expanding that hash
  would invalidate persisted registry records. Preserve `workspaceHash` unchanged and add a separate complete
  `snapshotHash`, cached by `WorkspaceRegistry` at load/create/commit and exposed through the existing summary,
  bootstrap and full-workspace envelopes. Polling compares `snapshotHash` and validates the returned pair;
  App continues using `workspaceHash` for content CAS/divergence. Add a mutation matrix for every formerly omitted field. This scope change is
  required for correctness and does not add a route or persistence migration.
- Final-review correction: the first digest implementation still used legacy `workspaceHash` as full-state equality
  in App startup, lost-success and dirty-clearing paths; a stale writer could also overwrite a concurrent UI-only
  change because the mutation chokepoint checked only that hash. Add snapshot equality to those client decisions and
  an optional `expectedSnapshotHash` precondition to the existing mutation chokepoint. Preserve `expectedHead` and
  durable registry hashes unchanged. `workspace.id` is behaviorally authoritative and therefore stays in the digest;
  the registry rehydrates accepted ID-less legacy records with a deterministic `workspace_<registry hex>` value
  before hashing/exposure. Version the canonical `workspace.read` descriptor/MCP mapping because `snapshotHash` is
  now a required, documented output.
- Final-review correction 2: history no-op suppression and forced-workspace recovery also relied only on the legacy
  hash. Snapshot-only writes now produce history rows, new recovery receipts bind both pre/post identities, revert
  rejects drift in either identity, and the history API projects older content-only workspace receipts as explicitly
  non-revertible while preserving the append-only ledger bytes.
- Final-review correction 3: two existing consumers were only structurally wired to the paired contract. Legacy
  applying `/api/agent/generate` forwarded only `expectedHead` and omitted post-write identities; MCP discovery listed
  `get_workspace@2` without executing its required response. Generation now rejects malformed/stale paired inputs
  before provider work, requires both identities for apply, completes every provider/validation await before its
  single mutation boundary, refuses to commit after response deadline/disconnect, rechecks both identities there,
  and returns the mutation receipt's authoritative hashes. The MCP oracle executes the tool and proves a missing
  `snapshotHash` fails closed. No new endpoint or capability was added.
- Final-review correction 4: Agent Bridge's Auto-Apply subscriber directly called the editor's dirty-marking
  `setWorkspace`, bypassing App's local-dirty, queued-write and conflict adoption guards after the shared App
  subscriber had correctly refused the same result. Centralize polled server-snapshot adoption in an App-owned,
  paired-hash-aware callback; Bridge may request that operation but cannot replace canvas authority itself. Add a
  red/green E2E proving Auto-Apply ON preserves both a dirty edit and an already queued/held edit, while a clean
  result is adopted once and never echoed through a redundant workspace POST.

## DOCUMENT PLAN

- Status at implementation start: `SPECIFIED`; final status is recorded under CLOSE.
- This file and the B116 backlog entry are the implementation authority. Update this record before expanding scope.

## IMPLEMENT

### Interim implementation record (source/isolated batch)

- Added `tests/e2e/fixtures/largeWorkspace.ts`: four exact chains produce 1,424 sanitized nodes and 1,420 links;
  sparse/dense coordinates vary DOM pressure independently from a single preserved-file padding field that makes the
  serialized snapshot exactly 6,040,734 bytes.
- Extended the existing polling E2E owner instead of creating a parallel harness. It now records summary/full fetch
  counts, declared and Resource Timing bytes, renderer heartbeat/long tasks, close latency, rendered node counts and
  full CDP accessibility-tree evidence. Small-close, large-sparse-close, large-dense-close and dense-AX are separate
  controls; measurement JSON is written under ignored `test-results/b116/` and attached to each Playwright result.
- Added `WorkspacePollingClient` in `src/lib/workspacePolling.ts`. App and Agent Bridge share the existing scheduler
  resource, but its run performs a small `/api/agent/workspaces` summary read and one validated full read only for an
  unknown/changed hash. Bootstrap primes the cache only after sanitized content/hash verification. Failed,
  malformed, stale-version, equal-version/different-head, mismatched-content, mismatched-authority and aborted reads
  cannot advance the cache.
- Preserved App's dirty/revision/queued-write/CAS/conflict/divergence gates. A head-only/local mismatch invalidates
  only the observed cached head so the next shared tick obtains one explanatory full snapshot. A same-content
  version-only change advances the local version without transferring the workspace.
- `[REPRODUCED]` the first complete 16-test focused suite made the dense pointer-close control red twice: 5,373.9 ms
  maximum heartbeat gap on attempt 1 and 5,382 ms close latency on the mandatory retry. Small, sparse and AX-only
  controls passed. This changed the diagnosis: large visible DOM plus root App rerender is a Forge-side trigger,
  while unsubscribe remains exonerated.
- Stabilized `saveCheckpoint` and MD-script selection callbacks, then wrapped Canvas in `React.memo`. The focused
  1,424-rendered-node close changed to 751 ms; recorded probe was 4,410.4 ms maximum heartbeat gap, 151 ms worst
  long task and 13 heartbeat ticks. The five-second contract was retained, not weakened.
- Added deterministic late-authority and bootstrap rejection E2E paths. No server route inventory, scheduler
  algorithm, workspace persistence format, live workspace or installed product has been changed in this interim
  batch; existing workspace response shapes gained additive paired-identity fields.
- Fresh-eyes review then reproduced that the legacy registry/CAS hash omits several persisted workspace fields. The
  polling contract now uses a separate complete `snapshotHash`; the persisted hash and registry schema remain
  untouched. `WorkspaceRegistry` computes the digest once at load/create/commit and serves it from memory. Summary,
  bootstrap and full GET envelopes expose both identities: `workspaceHash` remains CAS/divergence authority while
  polling compares and self-validates `snapshotHash`.
- Expanded deterministic coverage to 44/44 polling checks. Each legacy-hash omission (`id`, `uiTheme`, `templates`,
  `mdScriptName`, `sourceFolder`, `contentId`, `mdOriginal`, `contentOriginal`) keeps `workspaceHash` stable, changes
  `snapshotHash`, triggers exactly one validated full fetch, then returns to summary-only reads. Registry 21/21 and
  identity 12/12 checks cover canonical ID creation/commit/restart behavior, read-only legacy normalization, cache
  invalidation and full-shape hashing.
- Extended the existing history/recovery infrastructure instead of adding a second transaction log. Snapshot-only
  writes now survive the ledger's no-op filter; new forced-workspace receipts carry before/expected snapshot hashes;
  stale or old receipts fail closed. Recovery 10/10, history 73/73 and route integration prove the user-facing row,
  durable recovery link, later snapshot-only staleness rejection and truthful legacy-row projection.
- Reproduced the final-review Auto-Apply race with two unchanged E2E contracts: a held dirty/queued canvas was
  replaced by the external snapshot, and clean adoption emitted one redundant workspace POST. Added one App-owned
  `autoApplyPolledWorkspace(candidate, runId)` decision boundary. It validates the paired hashes and immutable
  authority, reads live dirty/queued/revision/conflict refs, deduplicates the exact shared scheduler run, advances
  canvas/revision/version/hash/cache state once through `setRawWorkspace`, and never marks an adopted server snapshot
  as a local edit. Agent Bridge now requests that decision and retains a pending banner when App refuses it.
- Reconciled every first-party mutation/example onto paired identities, including bulk-transform apply and the legacy
  generation route. The reference API harness now bootstraps immutable workspace authority before creating scoped
  keys; this is isolated test compatibility, not a production bypass.
- Corrected the reload fixture itself: its scoped-cache initializer is now one-shot across navigation, and the test
  proves the draft body plus unchanged base version before reload. Added compact draft/base metadata inside the same
  scoped workspace JSON value, avoiding a duplicate multi-megabyte key. A restored draft initializes dirty with its
  saved paired CAS base; clean server confirmation atomically replaces it with the ordinary metadata-free cache.
  Newer concurrent server state therefore produces an explicit 409/conflict after reload instead of version-first
  draft loss. Workspace restore/create is blocked while dirty, queued or conflicted, and successful immutable-ID
  changes clear canvas undo/redo so Undo cannot copy one workspace into another.
- Lifted external polling policy into App beside Auto-Apply/pending state. `External updates: Paused` now removes both
  shared-resource subscribers while local autosave remains active; Resume recreates one shared request and adoption.
  Enabled drawer reopen resets health to Checking until a fresh result. Manual Apply now rejects malformed versions
  before mutation/cache writes and surfaces every failure through the existing toast. Automatic adoption checkpoints
  the prior canvas so ordinary Undo remains available without reintroducing an echo POST.

### Task 1: deterministic pressure and accessibility fixture

**Files:** create `tests/e2e/fixtures/largeWorkspace.ts`; modify `tests/e2e/continuous-polling.spec.ts`.

1. Build four deterministic chains totaling 1,424 nodes/1,420 links. Expose sparse/dense positioning and bounded
   snapshot padding; assert sanitized counts and byte range before seeding.
2. Reuse `seedServerWorkspace()` and mock compile so the fixture stays on ephemeral ports/state.
3. Extend the existing init fetch wrapper with counts and response-byte/status metrics. Add an independent renderer
   heartbeat/long-task collector.
4. Run small, large-sparse, large-dense and `Accessibility.getFullAXTree`-only controls. Resolve the close button
   before timing, use a pointer click, and do not request AX/text state during the close timing window.

### Task 2: summary-first shared workspace polling

**Files:** create `src/lib/workspacePolling.ts`; modify `src/main.tsx`, `src/App.tsx`,
`src/components/AgentBridge.tsx`, `src/lib/continuousPolling.selftest.ts`, and polling E2E expectations.

1. Write fake-fetch oracle cases for primed unchanged, changed, version-only, failed/retried, malformed/mismatched and
   aborted results.
2. Implement one shared cache/helper that reads `/api/agent/workspaces`, selects the exact immutable workspace ID,
   and performs one full read only for unknown/changed content. Commit the cache only after a validated full read.
3. Prime the helper from the authoritative bootstrap envelope. Give App and Bridge the exact same resource key,
   contract and helper; do not change `ContinuousPollingScheduler`.
4. Preserve App's dirty/revision/queued-write/CAS/conflict/divergence gates and Bridge health/pending behavior for
   head-only and full results. An observed local/server hash mismatch invalidates the optimization and forces a
   bounded full read on the next tick.
   Agent Bridge must request automatic adoption through App's guarded owner; it must show a pending result when that
   owner refuses dirty, queued or conflict state and must never call the editor mutation setter for a polled payload.
5. Update the existing polling E2E to count summary cadence and exact full transfers; prove one mutation -> one full
   transfer -> summary-only, pause/resume, close/remount and authority-change negatives.

### Task 3: source and isolated runtime gates

1. Run the focused oracle, typecheck and owned-path lint.
2. Run focused polling E2E including the large/AX matrix; verify ports 3100/3101 and temporary state are gone.
3. Run full E2E, production build, Graphify refresh and precommit. Record exact verdict counts and artifacts.

### Task 4: exact package/install and installed-host comparison

1. Build/stage/inspect/probe/package a uniquely named local artifact; hash critical archive bytes.
2. Inspect the active IDE for unsaved buffers, then perform the controlled restart/install/reload and installed-byte
   parity check. Do not publish.
3. Capture an unprofiled pointer-close control without AX capture. Capture AX-only separately.
4. Run simultaneous renderer/webview tracing and extension-host profiling around one close/remount reproduction.
   For an unresponsive renderer, use `--trace --trace-category-filter="renderer,blink,v8,disabled-by-default-v8.cpu_profiler"`,
   the official `Reopen` recovery, then `Developer: Stop Tracing`.
5. Save raw captures only under ignored evidence, record hashes and sanitized top stacks/transfer measurements here,
   and release computer control immediately after the visual gate.

### Task 5: review, close and checkpoint

1. Fresh-eyes review the complete owned diff, authority/failure paths, evidence attribution and unrelated-file list.
2. Classify every acceptance criterion honestly; keep R13/B115 W1 partial if installed close/remount is not green.
3. Update this plan, `BACKLOG.md`, applicable Kimi/capability records, `SESSION-HANDOFF.md` and the AAR outcome.
4. Run precommit, stage only B116-owned hunks/files, commit `perf(workspace): avoid unchanged full-snapshot polling`,
   push `main`, and assert local/origin/remote-ref equality. Public publishing remains separately authorized.

## VALIDATE

- PASS exact fixture oracle: 1 test, exact 1,424/1,420/6,040,734 assertions; ephemeral ports 3100/3101 clear.
- Expected TDD red: pre-helper summary-only test failed because the old client made zero summary reads and continued
  full polling. Post-helper test passed and proved unchanged -> zero full responses, one changed head -> exactly one
  full response, then summary-only again.
- PASS polling engine/helper oracle: 44/44. The prior scheduler cohort remains green and twenty-three new/strengthened
  workspace cases cover bootstrap, unchanged, version-only, changed, failed/retry, malformed, content/head/authority
  mismatch, pre-abort, authority change during a held full transfer and every formerly omitted snapshot field.
- PASS workspace identity 12/12 and registry 21/21: complete-digest non-CAS changes, canonical ID handling, cache
  invalidation, read-only legacy normalization, repeated summary stability and restart parity are deterministic; the
  persisted CAS head remains unchanged.
- PASS destructive recovery 10/10 and Agent History 73/73. PASS final route integration 347/347, including snapshot-only
  stale-write rejection, visible history/recovery linkage, later snapshot drift returning `RECOVERY_STALE`, and all
  canonical `workspace.read@2` output checks. The added generation checks prove both post-write identities and a
  pre-provider `snapshot_conflict` with zero mutation.
- PASS MCP capability selftest: 10 tools, including positive `get_workspace@2` execution returning both identities
  and an explicit fail-closed check when `snapshotHash` is omitted. PASS capability audit: 11 capabilities, 290
  literal routes, one dynamic registrar and 10 MCP aliases; canonical contract hash remains
  `0722aaed2e8a172d84c73665940da9ef8f536e39c002abacc48b3820f8c5b9ed`. The reviewed MCP module-only manifest
  delta was promoted at candidate SHA-256 `44d63057e43523b0422d3d2749c8c27b850001e5ac84ff4bb28f8ef120efe69`.
- PASS `npm run typecheck`; owned-path lint has zero errors and no new B116 warnings (pre-existing App/Canvas warnings
  remain baseline noise).
- PASS initial control matrix 5/5. The stable measurement writer was added after fresh-eyes review; the final focused
  or full run must recreate all four JSON files before close.
- FAIL first complete focused polling suite: 15 passed / 1 failed; dense close breached the unchanged five-second
  contract on both attempts. This was a valid product finding, not flake, and forced the Canvas render-boundary fix.
- PASS post-fix dense close: 1/1 with 751 ms close latency. PASS held full-response authority-change E2E: 1/1.
  PASS bootstrap hash-mismatch E2E: 1/1 on the controlled retry. The first bootstrap-negative invocation suffered
  the known Windows Playwright child `0xC0000409` before any test/report existed; ports were clear before retry.
- PASS final focused polling suite: 20/20, 0 failed/flaky/quarantined. Exact final control evidence:
  - small: 3 rendered nodes, 61 ms close, 60.7 ms max heartbeat gap, 0 ms worst long task;
  - large sparse: 28 rendered nodes, 6,041,092 decoded/declared bootstrap bytes, 63 ms close, 80.4 ms max gap;
  - large dense: 1,424 rendered nodes, 868 ms close, 4,619.2 ms max gap, 170 ms worst long task;
  - AX-only: 59,583 AX nodes with all 1,420 action names, 1,917 ms traversal, 1,520.5 ms max gap and 1,464 ms
    worst long task. Stable JSON lives under ignored `test-results/b116/`; ports 3100/3101 were clear after teardown.
- PASS superseded intermediate full E2E after the transactional/history corrections: 74/74, 0 failed/flaky/quarantined;
  ports 3100/3101 cleared. The later intermediate full E2E after generation, MCP, Agent Bridge ownership and XSD-
  environment isolation corrections passed 78/78 in 845.3 seconds, with zero failed/flaky/quarantined/bad results.
  Verdict receipt:
  `test-results/e2e-verdict.json`, generated `2026-08-01T11:57:57.544Z`; ports 3100/3101 were clear afterward.
- PASS real X4 9.00 corpus/reference API integration: 82/82 in 430.3 seconds; the isolated server bootstrapped an
  immutable workspace, canonical schema/diff/bulk/reference checks passed, and port 8973 was clear after teardown.
- Expected TDD red then PASS: both Agent Bridge Auto-Apply cases failed before the ownership repair (dirty/queued
  canvas replaced; clean result echoed one POST) and passed unchanged afterward, 2/2. Typecheck and owned-source
  error-level lint pass; ports 3100/3101 cleared after both runs.
- NON-CLEAN focused suite: 21/22 passed; the dense pointer-close heartbeat exceeded the retained five-second limit
  once at 5,448.3 ms. The mandatory unchanged dense-only retry passed with 1,424 rendered nodes, 810 ms close,
  4,147.4 ms maximum heartbeat gap and 191 ms worst long task. This remains a timing outlier to report, not a basis
  for weakening the gate; final full E2E still decides the close.
- PASS final static/runtime gates: typecheck; owned-source error-level lint; local workspace-cache oracle 4/4; schema
  discovery selftest 14/14 with the real X4 reference-root environment restored afterward; Agent Key 34/34; capability
  and MCP selftests; runtime-discovered production oracles 129/129; production build; Graphify refresh at 3,792 nodes,
  8,990 edges and 176 communities; and final `npm run precommit:check`.
- PASS precommit's intentional negative inventory gate: the first run rejected stale durable-writer counts/fingerprint.
  Review tied the exact deltas to the test-only held-provider fixture and App's quota-safe cache helper; the manifest was
  updated, writer policy passed 14/14 plus native 8/8, and the complete precommit rerun passed in 143 seconds.
- PASS post-reopen correction batch: `npm run typecheck`; owned focused lint with zero errors (only pre-existing App,
  AgentBridge and workspace-isolation warnings); and 6/6 serialized Chromium contracts in 140.4 seconds. The batch
  covers one-shot failed-draft reload, v1 draft versus external v2 explicit conflict, zero-subscriber pause plus one
  resume adoption, Auto-Apply no-echo plus Undo, malformed/stale manual Apply with rendered errors, and cross-workspace
  Undo isolation. Ports 3100/3101 were clear afterward; the harness's per-run state directory remained as isolated
  test evidence and no live 3000/3001 workspace was addressed.
- PASS migration/restore correction batch: typecheck; focused lint with zero errors; and 3/3 serialized Chromium
  negatives in 67.8 seconds. A marked failed draft remained valid despite a stale global legacy fragment and newer
  remote bootstrap; an unmarked pre-metadata scoped body was conservatively retained and conflicted against remote;
  and restoring a parked target retained then safely synchronized that target's durable draft. Ports 3100/3101 were
  clear afterward.
- PASS final current-source full isolated E2E: 94/94, with zero failed/flaky/bad/quarantined-blocking results. This is
  the authoritative full-suite receipt after every correction through fresh-eyes pass 28; the earlier 74/74 and 78/78
  receipts remain useful intermediate history, not final-byte attribution.
- PASS superseded intermediate packaging/install gates. Artifact
  `vscode-extension/x4-forge-studio-0.0.63-b116-20260801-120545.vsix` is 17,952,414 bytes with 2,091 entries and
  SHA-256 `ED813B2D4527B396E997FD3BE25B39FAB16D6BA98445B418960BCE8BB6DA412E`. Root/extension builds, stage-app,
  inspector selftest 13/13, staged probe 16/16 and package inspection passed. The installed Antigravity extension
  `x4forge.x4-forge-studio@0.0.63` matches all seven critical VSIX files; normalized `package.json` differs only by
  host metadata. Later source corrections superseded these bytes; no public publish occurred.
- PASS superseded intermediate real rendered installed gate. Forge `v1.0.399` visibly opened, Bridge showed Connected
  and all 11 capabilities,
  and pointer close/remount completed in 286/275 ms unprofiled, 434/445 ms under the host-renderer profile and
  478/484 ms under the isolated Forge-webview profile. The latest Antigravity log root contains zero new
  `CodeWindow: detected unresponsive` matches. Host CPU sampling was 99.389% idle; isolated Forge sampling showed no
  multi-second Forge-owned stack and a 38.961 ms maximum sample gap.
- PASS superseded intermediate browser-wide installed trace over the close/remount sequence: 178,236 events / 66,938
  complete events,
  11 complete events at or above 50 ms, zero at or above five seconds, 327.399 ms overall maximum (workbench profiler
  startup) and 64.802 ms maximum Forge-attributed complete event. Only the sanitized evidence, screenshots, and
  recorded raw-artifact hashes remain under `vscode-extension/evidence/2026-08-01-b116-installed/`; the raw CPU
  profiles and 39,274,977-byte trace were not retained at close. This evidence remains diagnostic history but does
  not claim final-r2 attribution.
- PASS final exact-r2 package/install attribution. Artifact
  `vscode-extension/x4-forge-studio-0.0.63-b116-r2-20260801-125325.vsix` has SHA-256
  `C5B46B44FC60AB804B5B8E561C2C41DD1B3DFB466801A5FAC6098361737A8565`; all seven critical installed files matched
  the VSIX. No public publish occurred.
- PASS final installed extension-host profile and real rendered interaction gate. Profile summary
  `vscode-extension/evidence/2026-08-01-b116-installed-r2/installed-renderer-profile-summary.json` reports `PASS` for
  the exact r2 installation. Pointer Close completed in 173 ms; remount reached `Connected` with all 11 capabilities
  in 3,031 ms; and the relevant Antigravity log root gained no new `CodeWindow: detected unresponsive` entry. Raw
  profiles remain retained under ignored evidence rather than committed. Normal Antigravity was restored after the
  measurement.

## REVIEW

- Fresh-eyes pass 1 found five fixture-evidence blockers: missing small/dense-close controls, AX tree not tied to
  fixture labels, heartbeat false-green, header-only byte claim and discarded measurements. All five were repaired.
- Fresh-eyes pass 2 found bootstrap cache poisoning, stale full-versus-summary acceptance and missing race negatives.
  Bootstrap/content/head freshness validation plus selftest/E2E negatives were added.
- Fresh-eyes pass 3 found a P1 correctness blocker: the registry/CAS hash is not a complete snapshot digest. The
  plan was reconciled before correction. Separate cached-digest implementation and the eight-field mutation matrix
  are now green.
- Fresh-eyes pass 4 found `workspace.id` was incorrectly excluded even though authoring surfaces consume it, plus
  history/recovery paths still guarded only the legacy hash. Registry-bound legacy canonicalization, dual-hash
  history/recovery guards and exact negative tests closed both blockers.
- Fresh-eyes pass 5 found older durable history rows would still display an Undo action that the corrected server
  must refuse. A pure response projection now labels those legacy rows non-revertible without rewriting the ledger.
  The initial final-source review then found a P1: legacy generation committed before its last provider await and
  accepted blind/head-only apply. Mutation moved to the final synchronous boundary; paired preconditions are now
  mandatory for apply and timeout/disconnect state blocks both further provider calls and commit. Route negatives
  prove a held provider cannot overwrite a concurrent snapshot-only write and a timed-out request cannot mutate later.
- Fresh-eyes pass 6 found and source-traced a P1 Auto-Apply data-loss path: Agent Bridge was a peer polling subscriber
  that could replace a dirty/queued canvas after App refused the same payload. The failure was reproduced; App now
  owns a run/revision/pair-deduplicated adoption callback and the dirty/queued plus clean/no-echo E2E are green.
- Fresh-eyes pass 7 found parked-workspace routes relied on declarative scope alone. Both list and restore are now
  session-only at the scope layer and require a Studio actor in their handlers; read/deploy agent-key negatives and
  Studio positives are part of 347/347 route integration.
- Fresh-eyes pass 8 found quota eviction could persist the version before the full scoped workspace, leaving an
  unrecoverable mismatched pair. The cache now persists full workspace first and version second; write failures retain
  the old repairable pair. Manual pending Apply now performs a fresh paired-hash/authority read and adopts raw server
  state without echoing a POST.
- Fresh-eyes pass 9 reviewed final source, manifests, installed attribution and generated evidence. No P0/P1 blocker
  remained; raw captures are ignored, test-only held-provider behavior is gated by test mode and a fixed fixture
  prompt, and unrelated worktree changes remain outside the B116 ownership boundary.
- Fresh-eyes pass 10 reopened the close before commit: App's always-on subscriber called the guarded adoption callback
  independently of Agent Bridge's Auto-Apply toggle. With Auto-Apply OFF, a clean newer server snapshot could already
  replace the canvas before the Bridge displayed Apply/Discard. Add an exact OFF/pending/no-repeat-full-fetch E2E,
  reproduce it red, then keep App as authority validator while the Bridge remains the sole policy owner that may
  request automatic adoption. Re-run every affected source/browser/package/installed gate before restoring VERIFIED.
- Fresh-eyes pass 11 extended that correction boundary: a held pending snapshot must not advance the local writer's
  CAS pair, or the next local edit can silently overwrite the change under review. A failed fresh manual adoption must
  also re-arm any dirty save invalidated by its authority epoch. Add red/green E2E for both cases and require an
  explicit 409/conflict with the remote-only state preserved.
- Fresh-eyes pass 12 reconciled the still-red 80/81 full-E2E baseline with the shared-resource contract. The existing
  transfer test expected App to replace the canvas while the Agent Bridge toggle was OFF, while moving policy wholly
  into the conditionally mounted drawer would discard the only full body when the drawer was closed. Lift the
  Auto-Apply flag and pending full candidate into App, retain Agent Bridge as their visible controller, and let App's
  existing always-on subscriber either run its guarded adoption callback or retain the exact candidate. A later-opened
  drawer must expose that retained candidate without a second full transfer. A summary-only version advance with the
  same paired hashes must refresh the pending version and remain manually applicable because version is sequencing,
  not snapshot identity. Strengthen the manual no-echo test with a bounded post-release observation, and add isolated
  queued-write and pre-existing-conflict guards. Final acceptance now also requires a CPU profile of the actual
  extension-host process for the exact final installed VSIX; workbench-renderer and Forge-webview profiles alone are
  retained as useful but insufficient evidence.
- Fresh-eyes pass 13 found a bootstrap authority gap: when a same-version scoped local cache differed from the
  authenticated bootstrap snapshot, App retained the local canvas but initialized its writer preconditions from the
  server's current pair. A later edit could therefore authorize and silently overwrite the remote-only state. Extend
  the existing equal-version divergence E2E through the subsequent edit and require a 409/conflict with the remote
  snapshot preserved. When retaining a divergent local cache, initialize its expected pair from that retained local
  snapshot (a safe stale precondition that the server rejects); never learn a blank authority pair from a poll unless
  the poll's paired hashes name the exact canvas currently retained. Re-run all authority and full gates afterward.
- Fresh-eyes pass 14 found two retained-pending lifecycle gaps. An immutable workspace change observed directly by
  Agent Bridge must synchronously discard the prior workspace's banner instead of waiting for App's separate state
  update. A later validated full response that equals the retained canvas also proves any pending candidate for that
  same workspace is obsolete, even when its old pair differs; clear it unconditionally. Preserve the existing
  cross-authority Apply guard and add a pending-B/server-reverts-to-canvas-A E2E.
- Fresh-eyes pass 15 found the normal autosave path updated the addressed scoped version after server success without
  first updating the matching scoped workspace; reload could therefore prefer a stale same-version scoped body over
  the newer global compatibility cache. Reuse the quota-safe workspace-then-version helper for successful autosaves
  and lost-success convergence, retaining the global cache only for migration compatibility. Add a scoped-cache edit,
  successful server save and reload recovery E2E.
- Fresh-eyes pass 16 tightened Discard concurrency: the button must clear only the exact candidate it rendered, while
  an immutable authority change remains an explicit unconditional clear. A newer different-pair candidate arriving
  before the click must survive just as it does on the pair-guarded Apply path.
- Fresh-eyes pass 17 found successful server-copy adoption did not centrally pair-clear a matching retained pending
  candidate when invoked from the divergence/conflict UI rather than Agent Bridge. Clear only a retained candidate
  whose immutable ID and paired hashes match the fresh adopted response, preserving any concurrently newer pair.
  Strengthen the conflict E2E by clearing the dirty flag through the development-only test bridge after conflict is
  established and requiring the newer pending version; this makes conflict, not dirty state, the exercised guard.
- Fresh-eyes pass 18 found that writing the scoped cache only after server success still loses an unsaved edit across
  reload when all four POST attempts fail, and an older queued success can overwrite the scoped body for a newer edit.
  Every debounce must write the selected scoped workspace body first without advancing its base version (the global
  key remains migration-only). A server success then persists the *current* canvas before advancing the scoped base
  version, so overlapping newer edits survive. After the bounded four-attempt cycle fails, schedule one serialized
  exponential-backoff retry that is cancelled/reset by a new edit and authority-checked before rearming. Add a
  four-network-failure, automatic-recovery and reload E2E with no extra keystroke.
- Fresh-eyes pass 19 found the inverse pending race: if A is pending and a synchronous full B auto-applies after the
  toggle turns ON, pair-guarded clearing with B leaves obsolete A stranded. A successful full polling adoption proves
  every older pending candidate for that same workspace superseded; clear it synchronously. Keep pair-aware clearing
  for asynchronous manual Apply/Discard, where a newer candidate may genuinely arrive during the await/click race.
- Fresh-eyes pass 20 found that refreshing both addressed and legacy workspace keys on every edit doubles storage
  pressure; `persistWorkspaceCache` may evict local Git history/baseline while trying to fit the unnecessary duplicate.
  Ongoing edits now write only the immutable-ID-scoped key. The legacy global key remains read-only migration input.
  Split failure evidence into two contracts: automatic retry/recovery without another edit, and reload *before*
  recovery while all POSTs remain failed, with the scoped draft visible and the server copy unchanged.
- Fresh-eyes pass 21 found a 2xx false-success path: invalid JSON, `success:false`, a missing/non-finite version, or
  absent/mismatched returned hashes exited the autosave loop with dirty state stranded and no retry. Treat server save
  success as authoritative only when the response explicitly returns `success:true`, a finite version, and the exact
  target content/snapshot pair. Every other 2xx response enters the bounded retry; if the first request committed but
  its body was lost, the next CAS 409 plus fresh readback must converge safely. Add that exact malformed-200 E2E.
- Fresh-eyes pass 22 reproduced that the remaining reload failure was a false test control: Playwright reruns
  `page.addInitScript()` on `page.reload()`, so the unconditional fixture seeder replaced the correctly cached draft
  with the original workspace before App mounted. Make all three scoped-cache reload seeders one-shot, assert the
  draft body and unchanged base version immediately before reload, and retain the server-unchanged assertion. This
  is a harness correction, not an App authority change. The same pass found that manual server-copy adoption accepted
  missing/string/non-finite versions and reported failures only inside a conflict dialog that is usually closed for
  Agent Bridge Apply. Require a finite numeric version >= 1 before any mutation/cache write and surface every failed
  manual adoption through the existing error toast; assert both malformed-version rejection and rendered stale-pair
  feedback.
- Fresh-eyes pass 23 found a P1 false-control created when Auto-Apply policy moved into App: Agent Bridge still labelled
  its drawer-local health toggle `Pause server synchronization`, while App's always-on workspace subscriber continued
  polling and could replace the canvas. Lift the polling-enabled policy beside Auto-Apply/pending state in App and use
  it to enable both subscribers. Replace the old false-green one-subscriber assertion with zero workspace subscribers,
  zero summary requests and no adoption for more than one interval while paused; Resume must perform one shared read
  and adopt the external snapshot exactly once.
- Fresh-eyes pass 24 found that closing and reopening Agent Bridge could render a retained green `Connected` state
  before the remounted health subscriber had observed a fresh result. Reset enabled reopen status synchronously to
  `Checking`; the shared App subscriber may keep the transport warm, but stale component-local health is not proof.
  Add a rendered reopen assertion so a prior connected label can never survive the close/remount boundary.
- Fresh-eyes pass 25 found the App-owned automatic adoption path bypassed the existing undo checkpoint that manual
  server adoption already records. Preserve the raw setter/no-echo boundary, but checkpoint the exact prior canvas
  immediately before the one successful automatic replacement. Extend the clean Auto-Apply E2E so its no-echo proof
  remains green and ordinary Undo restores the pre-adoption canvas.
- Fresh-eyes pass 26 found a P1 reload sequence still capable of silent draft loss: failed local draft at server v1,
  external v2, then reload caused the version-first bootstrap branch to replace the draft. Store compact draft/base
  metadata atomically inside the existing scoped workspace value (not a duplicate multi-megabyte key), clear it only
  when that canvas is server-confirmed or explicitly replaced, and initialize restored drafts dirty with their saved
  paired CAS base. A v1 draft + external v2 reload must retain the local canvas, preserve the remote server copy and
  reach explicit conflict. The same review found workspace restore/create could overwrite such a draft while the UI
  falsely promised the current workspace remained saved. Block authority switching while dirty, queued or conflicted
  and render the reason; do not weaken local autosave or add a second workspace store.
- Fresh-eyes pass 27 found the existing global undo stack crossed immutable workspace authority: restore/create saved
  workspace A as a normal checkpoint, so Undo in newly selected B could write A's graph into B. Workspace selection
  already provides deliberate switch-back; clear both canvas undo stacks on successful immutable-ID change instead of
  manufacturing a cross-authority content undo. Prove switch then Undo cannot alter the newly selected workspace.
- Fresh-eyes pass 28 held the full suite for three migration/restore P1s. Legacy global domain fragments must never
  mutate an immutable-ID scoped body before its embedded draft digest is checked. A divergent unmarked scoped body
  from the immediately prior B116 implementation must receive a conservative migration shield: retain it dirty with
  stale local CAS identity for explicit reconciliation rather than letting a newer bootstrap discard it. Finally,
  restoring workspace B must reconcile B's own scoped body before writing B's server snapshot into that cache; a
  valid marked draft or divergent migration body is retained and the server response becomes pending/reconciliation
  evidence. Add all three exact negatives before restarting the complete polling suite.
- Final close review reconciled every requirement through fresh-eyes pass 28 against the 94/94 current-source receipt,
  exact r2 package/install parity and installed extension-host profile. No required blocker remains. The earlier
  78/78 suite, first B116 VSIX and first installed profiles remain explicitly superseded evidence rather than being
  erased or presented as final-byte proof.

## CLOSE

- Status: `VERIFIED` — all reconciled acceptance criteria through fresh-eyes pass 28 passed on current source; exact
  final r2 bytes were packaged, installed, rendered, and profiled in Antigravity.
- What changed: unchanged workspace polls now use the existing summary route and transfer no full snapshot after
  bootstrap; one changed complete digest causes one validated full read. A separate complete `snapshotHash` closes
  non-CAS-field races across App adoption, first-party applying writers, history/recovery, generation and MCP while
  preserving the persisted `workspaceHash`. Canvas rerender stabilization keeps the exact 1,424-node close within the
  retained gate.
- What was deliberately not changed: scheduler cancellation, route inventory, registry persistence format, live
  game/mod/workspace data, credentials, store version and public publishing.
- Capability-map delta: no new user-facing capability; existing workspace synchronization, transaction safety and
  installed-host evidence claims are strengthened. The external StarForge capability/AAR ledgers were not written
  because this task's authorization is repository-scoped; the complete AAR is retained here and in the handoff.
- Baseline/rollback: source baseline `fd8fb309e6f4e4f11ab611ed05419089a53800b8`; reinstall inspected B115/R13 VSIX
  `x4-forge-studio-0.0.63-b115-r13.vsix` (SHA-256
  `20C938156CA36039E600251E730F5DCEC5E02D064B54789566E5E3EA335DB00D`) if rollback is required.
- Remaining risks: one isolated dense heartbeat outlier reached 5,448.3 ms before an unchanged retry passed at
  4,147.4 ms; dense accessibility traversal still produced a 1,464 ms long task. Neither reproduced in installed
  Antigravity, whose explicit trace had no five-second event. Treat both as regression sentinels, not proof of zero
  future host risk. For backward compatibility, the general replace/merge chokepoint and bulk-transform route still
  accept a single legacy precondition; current Forge UI/examples and applying generation send both identities, but a
  head-only external legacy client can miss snapshot-only drift. Do not describe the optional compatibility path as
  universally paired; tightening it is a separate API-compatibility decision. Running-game LIVE experience remains
  the separate B114 gate. Public release remains unauthorized.
- Downstream close: B115 W0-W1 and Kimi R13 are `VERIFIED`; B115 W2-W21, Kimi R18/R21, B114, and public release
  remain separate.
- Suggested commit title: `perf(workspace): avoid unchanged full-snapshot polling`.

## AAR

- Triggered already: the assumed CLI name `antigravity.cmd` was wrong; the installed executable is
  `antigravity-ide.cmd`. The first read-only help command failed, the corrected command succeeded.
- Additional triggers: the first `tsx -e` oracle command used unsupported top-level await and was replaced by an
  async IIFE; an initial 3.6-second polling assertion was too timing-specific and became bounded `expect.poll`; the
  dense control exposed a real five-second render failure; one Playwright invocation crashed before report creation.
- Later triggers: a second inline oracle invocation repeated the known top-level-await wrapper mistake; a targeted
  lint command incorrectly included the Node route harness outside the configured lint boundary, then passed on the
  actual owned source boundary; review twice expanded the transactional acceptance contract to prevent data loss.
- Final-source triggers: the reference API integration harness initially lacked immutable workspace binding and was
  corrected; its first full-corpus rerun exceeded the five-minute command wrapper even though port 8973 cleaned up.
  Its longer rerun was manually stopped when the P1 review finding invalidated the source under test; the exact
  remaining harness process tree was inspected and stopped, and port 8973 was verified clear. A broad Windows `rg`
  glob syntax was also invalid and was replaced with explicit `--glob` filters.
- Latest review trigger: a peer Agent Bridge polling subscriber bypassed the authoritative App adoption guards; the
  existing dirty-state test used Auto-Apply OFF and therefore did not cover the destructive branch.
- Validation trigger: the first complete 22-test post-fix polling run had one dense heartbeat gap at 5,448.3 ms;
  its mandatory isolated retry passed at 4,147.4 ms with no code or threshold change.
- Final-gate triggers: the default oracle timeout was too short for the full XSD environment; schema discovery leaked
  `X4_REFERENCE_ROOT` into its selftest until temporarily isolated/restored; the first precommit correctly rejected
  stale durable-writer inventory; the first VSIX hash helper failed on PowerShell/backtick interpolation; the first
  CPU profile sampled only the host renderer and was corrected with a direct Forge-frame CDP session.
- UI/tool triggers: an attempted command-palette profile action focused an unrelated open editor and typed text into
  `github_sync.mjs`; it was immediately undone and disk verification proved zero saved occurrences. Hidden-tab and
  stale accessibility references were replaced with refreshed state plus the X4 Forge activity view. Antigravity's
  process-owned trace rejected a duplicate `Tracing.start`; a clean remote-debug-only relaunch produced the explicit
  56.758-second CDP trace instead.
- Reopen-close triggers: the first complete polling rerun was deliberately terminated when final review found three
  uncovered P1 draft-migration/restore paths. Terminating the yielded command did not stop its Playwright child tree;
  the exact ephemeral CLI/server/Vite PIDs were inspected, stopped, and ports 3100/3101 verified clear. The first
  exact-PID cleanup raced a child exit and returned `Cannot find a process`; the idempotent retry completed safely.
- Final-r2 triggers: the first profile-summary analysis applied `Math.max(...)` to the complete sample set and hit a
  call-stack error; the analysis path was corrected to avoid that unbounded call shape and the retained summary then
  passed. The first remount timing was invalid and was discarded rather than relabelled green; the interaction was
  repeated immediately and produced the valid 3,031 ms `Connected` plus 11-capability result.
- Final-close triggers: fresh-eyes review corrected two overbroad evidence-retention claims before commit. The first
  mixed-file index patch inherited PowerShell CRLF bytes and failed `git diff --cached --check`; the partial entries
  were cleared and reapplied through an explicit UTF-8/LF stream. A 120-second precommit wrapper expired without a
  verdict; process inspection found no orphan, and the unchanged gate reran to PASS in 143.9 seconds.
- Sustain: preserve exact process/byte attribution and demand a profile before rewriting cleanup.
- Improve work/approach: run AX-only and pointer-only controls separately; the prior attempt conflated them. Reject an
  invalid interaction timing immediately and repeat the unchanged action while the controlled state is still known.
- Improve tools: keep the deterministic large-workspace/payload/heartbeat fixture and capture target-specific CDP
  profiles; browser-level profiles can silently attribute work to the wrong renderer. Keep sensitive raw profiles
  and traces ignored, with only sanitized hashes/summaries in Git. Never spread an unbounded trace sample set into
  `Math.max`; use an iterative maximum or another bounded reducer.
- Highest-risk evidenced weakness: the dense browser fixture can approach the five-second heartbeat boundary even
  after the root rerender fix. The installed host is green, but the exact dense control must remain mandatory so
  future React/Canvas changes cannot reintroduce the multi-second failure invisibly.
- Project lesson banked here: complete snapshot equality must not reuse a deliberately narrower persisted CAS hash;
  paired identity belongs at every automatic adoption and first-party applying/history/recovery/agent boundary. Any
  legacy single-precondition compatibility path must remain explicit residual risk. Installed profiling must identify
  the exact webview target before causal claims.
