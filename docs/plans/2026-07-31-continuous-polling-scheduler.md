# Kimi R13 — Shared Continuous Polling Scheduler

Task: B110-R13 one scheduler for continuous browser reads
Lane: FULL
Status: VERIFIED — B116 closed the final Auto-Apply, Pause/Resume, and installed-host interaction gates

## PLAN

- Bounded unit: replace the seven component-owned continuous `setInterval` loops with one process-wide,
  resource-keyed browser scheduler. Equivalent reads share one in-flight request and fan the result out to current
  subscribers. The scheduler owns cadence, request deadlines, bounded backoff, hidden/offline pause, cancellation,
  and stale-result refusal.
- Assumptions and unresolved facts: polling remains the appropriate transport for local Forge endpoints; no ADR or
  current server contract requires SSE. Browser visibility and network-online signals are advisory, so deterministic
  request failure/backoff remains authoritative. Installed-host inspection is required only after deterministic and
  isolated-browser behavior is green.
- Authoritative references: Kimi ledger R13; `BACKLOG.md`; `SESSION-HANDOFF.md`; ADR-F1/F5 workspace/CAS authority;
  capability map; live timer owners in App, AgentBridge, Canvas, CueViewer, GuidedRail, and PlaytestWorkspace;
  bounded corpus-scan and GitHub OAuth device-flow implementations; Graphify; current request-deadline policy.
- In scope:
  1. Framework-agnostic `ContinuousPollingScheduler` with one owned wake timer, explicit resource contracts,
     subscriber fan-out, immediate first run, per-resource no-overlap, request deadline, exponential backoff cap,
     visibility/offline pause/resume, abort-on-last-unsubscribe, and run-generation stale-result refusal.
  2. A small React hook that keeps subscriber callbacks current without restarting an unchanged resource contract.
  3. Migration of App readiness/workspace sync, AgentBridge workspace sync, Canvas live cue telemetry, CueViewer live
     log telemetry, GuidedRail watcher, and Playtest game-log/watcher/Forge-state reads. Exact workspace and watcher
     reads share keys; query/body changes create new authority-safe keys.
  4. Observable scheduler snapshots sufficient to prove resource count, subscribers, in-flight state, failures,
     next due time, and the one-timer invariant without exposing response data.
- Out of scope: server push/SSE/WebSocket transport; changing endpoint response shapes; changing polling intervals
  unless backoff/pause applies; merging bounded OAuth device flow or corpus scan into the scheduler; background
  service-worker execution; touching the real mod/game directories; broad timeout-policy changes outside polling.
- Risks and authorization boundaries: a stale workspace response could overwrite newer local authority; accidental
  deduplication of non-equivalent requests could deliver the wrong data; cancellation could surface false offline
  errors; aggressive retries could increase local load. Resource keys include workspace/mod/query identity, contracts
  must match, App records its local workspace revision at each shared run start, aborts are silent on pause/unmount,
  and backoff is capped. No new spending, external network, deletion, credentials, production mutation, or real-mod
  writes are authorized.
- Rollback/checkpoint: task began at `e137acd6d8d27f0772c7f86f131fe43549bab954`; external commits advanced
  `HEAD == origin/main` to `a68d69855631cb5fd1c62cc4b0a69e08b6a0fc87` without touching R13 paths. Revert only
  task-owned scheduler/hook/component/test/document changes from the current base to restore the seven prior
  intervals. User-owned dirty files remain untouched and unstaged. E2E uses the ephemeral 3100/3101 stack/state root.
- Acceptance criteria:
  1. All seven continuous component intervals are removed and registered through one scheduler; source inventory
     leaves only explicitly classified bounded workflow/debounce/TTL/simulation timers.
  2. Two subscribers with the same resource key and contract produce one immediate request, one in-flight operation,
     and fan-out to both; mismatched contracts under one key fail before any request.
  3. A resource never overlaps itself. A hung request times out, is aborted, reports one failure, and retries with
     bounded exponential backoff; a later success resets backoff.
  4. Hidden or offline state cancels active continuous reads, arms no wake timer, and resumes each active resource
     immediately when visible and online.
  5. Last unsubscribe aborts the request and removes the resource. Completion from an unsubscribed/replaced run is
     discarded and cannot invoke callbacks or mutate current UI.
  6. Workspace polling preserves ADR-F5 authority and ADR-F1 dirty/revision/CAS protections. Switching workspace,
     mod ID, cue list, or log path changes the resource key and cannot accept the old response.
  7. GitHub OAuth device polling still honors server interval/slow-down/deadline/deny/expiry/cancel. Corpus scanning
     still polls only while the operation reports an unfinished state and stops on close/completion.
  8. Current user-visible readiness, workspace sync, live canvas/cue, guided rail, and Playtest states continue to
     render in the real host; no polling error is falsely presented as success.
- Required validation and negative path: deterministic fake-clock selftest covering criteria 2-5; focused source
  inventory; root typecheck/lint; registered oracle and route suites; isolated browser request-count and panel/status
  checks; full E2E; production build; Graphify refresh; staged-product/VSIX/installed Antigravity gates only if the
  shipped browser bundle changes (it will). Negative paths are contract mismatch, timeout/backoff, hidden/offline,
  last-unsubscribe, stale completion, and unchanged bounded-workflow cancellation.
- Evidence locations: this record; selftest route and oracle sweep; focused Playwright report under `test-results/`;
  packaged-product reports; installed-host evidence under `vscode-extension/evidence/2026-07-31-r13/` if reached.

## BASELINE

- Revision/version: initial task base `e137acd6d8d27f0772c7f86f131fe43549bab954`; external no-overlap Discord/Railway
  commits advanced `HEAD == origin/main == a68d69855631cb5fd1c62cc4b0a69e08b6a0fc87`; extension 0.0.63 / Forge
  v1.0.391 is the last verified installed/public product.
- Existing changes/failures/runtime state: preserve user-owned deleted data/Discord/game files,
  modified 0.0.35 evidence images, untracked issue templates and `Note for Kimi.md`, plus six untracked intermediate
  R8/R17 screenshots. No task-owned validation stack or computer-control session is active. A fresh machine-state
  answer is required before browser validation.
- Mid-task external baseline change: commits `70cc6b5` and `a68d698` added `discord_bots/` and changed root Railway/
  Discord-sync files. Search proved zero R13-path overlap. The previously recorded root `railway.json` deletion is no
  longer dirty after those external commits; this lane neither restored nor reverted it.
- Mid-task user baseline: the rendered LIVE control remains stuck at "connecting" in the supplied screenshot; this
  is evidence that the control renders, not that telemetry works. B114 records the full running-game experience gate.
  Header duplication, weak diagnostic explanations/navigation, and Playtest syncer ambiguity were recorded as
  B111-B113 and are not silently folded into the R13 scheduler implementation.
- Timer inventory: seven continuous owners — App readiness (4 s), App workspace (3 s), AgentBridge workspace (4 s),
  Canvas cue telemetry (2.5 s), CueViewer log telemetry (10 s), GuidedRail watcher (5 s), and Playtest's three-read
  refresh (4 s). Two recursive timers are bounded workflows — DirectorySettings corpus scan (1.5 s while unfinished)
  and SourceControl OAuth device flow (server-directed cadence until terminal/deadline/cancel). Remaining timers are
  debounces, UI TTLs, simulations, request/service deadlines, or retry state machines rather than subscriptions.

## RECONCILE

- Resources and readers/writers searched: Graphify traversal; `setInterval`/recursive `setTimeout` inventory across
  `src`; App workspace/readiness effects; AgentBridge; Canvas; CueViewer; GuidedRail; PlaytestWorkspace;
  DirectorySettingsModal; SourceControl; request-deadline helper; server selftest registry; ADR and capability map;
  Kimi ledger/field report; Agent Brain query (no directly reusable scheduler decision).
- Existing capability reused: endpoint-specific deterministic verdicts; ADR-F5 explicit workspace header/context;
  App's dirty/revision/CAS guards; React effect cleanup; AbortSignal-aware request policy; registered selftest route
  pattern; ephemeral E2E stack. No general polling scheduler or subscription owner exists under `src`.
- Couplings checked: workspace ID and local-revision authority; exact GET query/body identity; watcher mod/expect
  query; cue-name changes; response-to-component state mapping; public selftest registration; browser visibility and
  network events; hook unmount; bounded workflow terminal states.
- Extend-versus-replace: introduce one scheduler and extend existing fetch/state adapters; do not replace endpoints or
  their deterministic verdict logic. The seven recurring loops are duplicated ownership, not seven domain engines.
- Capability-map delta: planned at close for one observable scheduler, shared request fan-out, cancellation/backoff,
  and explicit bounded-workflow exclusions.
- Plan changes: the handoff said "one scheduler" but did not decide whether identical reads merely shared a clock or
  shared transport. Reconciliation strengthens the contract to resource-keyed request deduplication and fan-out;
  this is necessary to make App plus AgentBridge workspace reads materially non-duplicative. OAuth and corpus polling
  are explicitly excluded because their cadence and termination are workflow state, not continuous subscription.
  The first full E2E run then reproduced a boot-authority race: bootstrap had already returned the selected workspace,
  but `main.tsx` discarded that envelope and App rendered the blank fallback until its first scheduled GET completed.
  The release guide could therefore package the fallback workspace. The bounded repair is to reuse the existing
  bootstrap envelope as App's initial server candidate under the same version rule; polling remains the convergence
  mechanism after boot. This is required for criterion 6 and does not add a route or authority source.
  Final source review found two more criterion-8 violations before the next E2E run: readiness preserved a prior
  mod's `ready` verdict while the newly addressed mod was loading, and Canvas LIVE preserved prior green status,
  badges, and watches after an identity change or request failure. The bounded repair clears presentation authority
  synchronously when its resource identity changes and converts polling failure to explicit non-live error state;
  unchanged successful resources still avoid per-poll loading flicker.
- Final parallel review found the shared identity oracle and CueViewer delayed-response browser test proved the
  mechanism, but not Canvas's own workspace-authority wiring. Add one bounded Canvas negative that holds the old
  LIVE response, changes cue-list authority, proves the new response renders, then releases the old response and
  proves it cannot overwrite fresh badges or watches. This strengthens existing criteria 5 and 8; scope is unchanged.
- Review correction before execution: the first draft changed only `workspace.name`, which does not participate in
  Canvas's authority (`workspaceId + cueNames`) and therefore could not start a second request. The test now renames
  the named cue, changing the exact POST body/resource identity that production Canvas uses. This task is non-clean.
- Continued requirement review found four further acceptance blockers in migrated/bounded owners: AgentBridge keeps
  an A-workspace pending payload actionable after selecting B; Playtest retains an old green game-log verdict after
  polling fails; CueViewer retains old telemetry/fix evidence after status or tail failure; and SourceControl cancel
  or unmount does not invalidate an already-running OAuth device poll, which can reconnect or re-arm itself. Repair
  each at its existing state/adoption boundary and add focused negative coverage; no endpoint or feature is added.
- Cross-layer follow-up extends those same bounded repairs: Playtest must also clear the prior mod's debug brief;
  GuidedRail must invalidate its watcher verdict on mod/step authority changes; CueViewer must not send an old
  workspace's resolved log path under a new workspace header; OAuth `slow_down` must persist/accumulate; and client
  disconnect must abort the server's outbound token poll and prevent late credential persistence. The fake-clock
  oracle will also prove one timer across distinct resources plus capped backoff and base-cadence recovery.
- Final presentation audit found AgentBridge initializes unverified health as green `Connected` and retains that
  label while polling is paused. Replace the boolean with explicit checking/connected/offline state plus a derived
  paused state; resuming returns to checking until a fresh response. Add a focused pause/resume assertion.

## IMPLEMENT

- Actual bounded changes: shared scheduler/hook, seven migrated continuous owners, deterministic selftest, focused
  request-fan-out/LIVE/log-path E2E coverage, bootstrap-envelope reuse, mod-identity readiness invalidation, LIVE
  identity/failure invalidation, and a held-old-response Canvas cue-list-authority negative are implemented. Final
  review repairs bind AgentBridge pending payload/health to workspace and poll truth; bind CueViewer path, status,
  telemetry, and fixes to exact authority; clear Playtest/GuidedRail prior-mod verdicts; make OAuth cancel/unmount
  abort in-flight client and server work; persist/accumulate `slow_down`; and gate token persistence on client liveness.
  The polling oracle now covers distinct-resource one-timer ownership and capped recovery; a new device-flow oracle
  covers late-token refusal, secret omission, and accumulated slowdown. The focused browser spec now has ten cases.
- Scope changes and reasons: added explicit running-game LIVE telemetry regression proof (B114) because the user
  asked whether the pre-architecture-change capability still works. The distinct header/diagnostic/Playtest UX
  findings are separately bounded as B111-B113. Full E2E forced the bootstrap-envelope repair above; changing only
  the test to wait would have left the product capable of packaging the wrong fallback workspace during boot. Final
  review additionally requires readiness/LIVE presentation invalidation plus focused negative-path coverage before
  the authoritative full E2E rerun.

## VALIDATE

- Method -> result -> evidence:
  - Final `npm run typecheck` -> PASS. Final `npm run lint` -> PASS with 0 errors / 578 existing warnings.
  - `npm run test:routes` -> 328/328 PASS after the overlapping capability-contract routes were added.
  - `npm run test:oracles` -> authoritative isolated runtime index 129/129 PASS, including
    `continuous-polling-selftest` 21/21 and `github-device-flow-selftest` 4/4.
  - Current-source focused E2E -> polling 10/10 PASS. The combined capability/polling run was 13/13 PASS in
    2.1 minutes and covered fan-out, workspace/mod/cue/log authority changes, LIVE failure cleanup, pause/resume,
    readiness invalidation, Playtest/GuidedRail truth, and OAuth cancel/no-rearm behavior.
  - Focused failed release case after bootstrap repair -> 1/1 PASS with the selected workspace in the request.
  - First full E2E -> 53/54 with the release workspace race reproduced twice; retained trace identifies the wrong
    fallback payload. Product repair applied and focused/late-suite regressions passed.
  - Second full E2E -> observer expired after 12 minutes with no structured report/receipt. The exact task-owned
    3100/3101 processes were identified and stopped; both ports verified closed. This is unavailable evidence, not
    a pass or an assertion failure.
  - Intermediate full isolated `npm run test:e2e` -> authoritative `test-results/e2e-verdict.json` reports 64/64 PASS,
    zero failed/flaky/bad/quarantined-blocking in 7.5 minutes. The ephemeral 3100/3101 stack stopped and both ports
    were clear afterward; live 3000/3001 and the user workspace were not used.
  - `npm run build` -> PASS; Vite 1,818 modules and bundled server completed.
  - `graphify update .` -> PASS; 3,746 nodes / 8,843 edges / 176 communities. Final precommit, diff/staged inspection
    and exact commit/push evidence are recorded in the session handoff at this checkpoint.
  - B116 final current-source full E2E -> 94/94 PASS with zero failed/flaky/bad/quarantined-blocking results after
    every Auto-Apply, Pause/Resume, draft migration and restore correction through fresh-eyes pass 28.
- Negative/rollback result: contract collision, timeout/abort/backoff reset, hidden/offline pause/resume,
  unsubscribe abort, subscriber callback isolation, capped backoff/recovery, stale identity refusal, late-token
  non-persistence, secret omission and accumulated slowdown pass the registered deterministic oracles. Browser
  negatives prove held A-workspace/log/cue evidence cannot cross to B, prior success is cleared before fresh truth,
  OAuth cancel cannot re-arm, and resumed health returns through Checking before Connected.
- Visual/live result when applicable: mocked rendered LIVE badges and cleanup are green. Actual running-game LIVE
  experience remains B114 and is not claimed. Attempt 1 reproduced multi-minute Antigravity `CodeWindow` stalls and
  remains preserved in `docs/plans/2026-08-01-b115-r13-installed-gate.md`. B116 then removed unchanged 6.04 MB full-
  snapshot polling without changing scheduler cancellation, stabilized the dense Canvas rerender boundary, and
  installed exact inspected bytes. The superseded first B116 artifact completed pointer Bridge close/remount in
  286/275 ms
  unprofiled, 434/445 ms under the host profile and 478/484 ms under the isolated Forge-webview profile. The explicit
  56.758-second trace recorded zero complete events at or above five seconds, a 64.802 ms maximum Forge-attributed
  complete event, and no new `CodeWindow: detected unresponsive` log. Final attribution is to
  `x4-forge-studio-0.0.63-b116-r2-20260801-125325.vsix`, SHA-256
  `C5B46B44FC60AB804B5B8E561C2C41DD1B3DFB466801A5FAC6098361737A8565`, with installed parity 7/7. Its installed
  profile summary `vscode-extension/evidence/2026-08-01-b116-installed-r2/installed-renderer-profile-summary.json`
  reports `PASS`: Close took 173 ms, remount reached `Connected` plus all 11 capabilities in 3,031 ms, and no new
  unresponsive-host log appeared. Raw profiles remain ignored and retained; normal Antigravity was restored. No
  public publish occurred.

## REVIEW

- Requirement -> done | partial | missed | deferred | out of scope:
  - Criteria 1-7 -> done and evidenced by 25/25 scheduler/device oracles, polling E2E 10/10, the intermediate full E2E
    64/64 and B116's final current-source full E2E 94/94.
  - Criterion 8 current rendered states -> done. Browser/full-suite evidence, installed contract/readiness and the
    exact rendered pointer unsubscribe/close/remount gate are green after B116. Running-game telemetry is separately
    tracked by B114 and is not claimed by the scheduler unit.
  - OAuth/device and corpus bounded workflows -> out of scheduler scope by reconciled contract; source inventory
    confirms they retain their terminal/deadline/cancel ownership.
- Fresh-eyes findings: review found and forced repairs for render-time callback authority crossing, delayed CueViewer
  log-path crossing, AgentBridge response workspace mismatch, and discarded bootstrap workspace authority. Follow-up
  review then found prior-mod readiness and prior-success LIVE presentation could remain visible under new/failed
  authority. Continued review found stale pending AgentBridge adoption, false initial/paused health, stale
  Playtest/CueViewer/GuidedRail success presentation, old-path reuse, non-persistent OAuth slowdown, and client/server
  cancellation gaps. All identified source defects are repaired and the final source/runtime/browser gates are green.

## CLOSE

- Status: `VERIFIED`. One shared scheduler owns all continuous browser reads, and B116 proved truthful polling
  authority plus the exact packaged/installed Antigravity close/remount boundary.
- Remaining risks/deferred work: one isolated dense heartbeat outlier reached 5,448.3 ms before its mandatory unchanged
  retry passed at 4,147.4 ms; retain that exact regression control. Do not publish without separate release
  authorization. B111-B114 and R18/R21 remain separate units; running-game LIVE experience remains B114.
- Suggested close title: `perf(workspace): avoid unchanged full-snapshot polling`.

## AAR

- Triggers: reconciliation changed shared-clock scope to resource fan-out; direct selftest invocation initially used
  unsupported top-level await; the first combined command masked typecheck behind a later green command; fresh-eyes
  review forced three authority repairs; a patch context missed once; the first full E2E found the bootstrap race;
  direct oracle sweep ran without a server; one route attempt exited red; two full-suite observers expired and
  required exact ephemeral cleanup; the first Canvas held-response test changed display metadata rather than a field
  in the production authority key and was corrected before execution; repeated Windows-incompatible `rg` globs
  exited red; final review rejected a permissive AgentBridge resume assertion before execution; two external
  Discord/Railway commits advanced the base mid-task and required a no-overlap reconciliation. The eventual full
  isolated run passed; the failed/expired attempts remain retained evidence rather than being rewritten as green.
- Final-close triggers inherited from B116: profile-summary analysis first used unbounded `Math.max(...)` and hit a
  call-stack error before the corrected analysis passed. The first remount timing was invalid, so it was discarded and
  the unchanged interaction repeated immediately; the valid result reached `Connected` plus all 11 capabilities in
  3,031 ms. Neither failed measurement was rewritten as green.
- Sustain: resource/caller inventory separated continuous subscriptions from bounded workflows; one host-owned
  mutation lane plus parallel read-only reviews found authority defects early; focused failure reproduction made the
  bootstrap cause measurable before repair.
- Improve work/approach: never combine validation commands where the final process can mask an earlier exit. Run
  runtime oracles only through `npm run test:oracles`. Size the retained full-E2E observer from the slow-machine
  history or split diagnostically before one final authoritative run; silence is neither hang nor success. In an
  identity-bound negative, mutate the exact fields used by the production resource key/contract and assert that a
  replacement request actually starts before releasing the stale one.
- Improve tools: the full wrapper buffers all output and produces its receipt only after child close, so an observer
  timeout loses both progress and structured truth while leaving webServer children. Add a wrapper-owned overall
  deadline/progress heartbeat and guaranteed child-tree teardown as a separate bounded tool item.
- Highest-risk evidenced weakness at final close: the dense browser fixture can still approach the five-second
  heartbeat boundary, so its exact regression gate must remain. B116 removed the proven unchanged 6.04 MB allocation
  pressure and the installed renderer no longer reproduced the stall, but that correlation is not a claim that one
  Forge stack alone caused every prior four-minute Antigravity stall.
- Project lesson banked here: authority-changing polling must clear old presentation before awaiting the new request;
  cancellation must cross the browser/server boundary and gate credential persistence at the final commit point.
  External AAR ledgers were not mutated under this repository-only task boundary.
