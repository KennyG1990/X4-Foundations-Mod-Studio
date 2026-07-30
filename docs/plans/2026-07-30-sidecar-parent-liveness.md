# Sidecar Parent-Liveness Implementation Plan

**Goal:** close Kimi R10 so an extension-host crash cannot leave its managed Forge sidecar running, without trusting or killing a potentially reused parent PID.

Task: B110 / Kimi R10 sidecar liveness
Lane: FULL
Status: **VERIFIED**

## PLAN

- **Bounded unit:** R10 only: add an owned parent-pipe lifecycle contract and orphan reaper around the managed sidecar.
- **Assumptions:** the extension-owned child stdin pipe is closed by the OS if the extension host exits or crashes. A PID alone is not identity because Windows can reuse it. Attach-first backends are external and must never be supervised or killed.
- **Authoritative references:** Kimi R10 ledger row; extension ownership rules and `spawnSidecar`/`stopOwnedSidecar`; B108 PID-reuse discovery incident; B43 `inspect`/`inspect-brk` contract; instance discovery; StarForge ADR/capability ledgers.
- **In scope:** compiled extension-side supervisor; pipe-v1 environment contract with diagnostic parent PID and random nonce; server-side graceful parent-pipe exit; bounded force-reap of the supervisor-owned server; packaged/staged probes; discovery cleanup.
- **Out of scope:** attached backend lifecycle; visible UI; sidecar restart policy after an ordinary backend crash; CI packaging (R19); flake policy (R20); game/mod/release operations.
- **Files:** `vscode-extension/src/sidecarSupervisor.ts`, extension build/ignore scripts, `vscode-extension/src/extension.ts`, `src/lib/parentLiveness.ts`, `server.ts`, staged probe, `tests/e2e/product-copy.spec.ts`, durable records.
- **Risks and authorization boundaries:** killing an unrelated process is the primary hazard. The supervisor may terminate only the exact child it spawned. It never kills or polls the parent PID. No installed extension, real mod/game, marketplace, or external process is authorized. Generated stage/package fixtures are isolated and disposable.
- **Rollback/checkpoint:** restore direct server spawning, remove the supervisor bundle/watch, and retain the already-working clean deactivate/auto-restart behavior. Baseline revision `5f472e68`; unrelated dirty files excluded.
- **Acceptance criteria:**
  1. Managed sidecars launch through a compiled supervisor with an explicit `pipe-v1`, parent PID, and cryptographic nonce contract; attached backends do not.
  2. Closing the parent pipe makes the real staged server exit within three seconds while the claimed parent PID remains alive, proving PID reuse cannot preserve the orphan.
  3. The normal server removes its own discovery record before exit.
  4. A stubborn child that never reads the pipe is force-reaped by its supervisor; the exact spawned PID is observed dead.
  5. Missing/malformed parent contracts fail closed before spawning a server.
6. Clean stop and unexpected server exit semantics remain compatible with the extension's existing deliberate-stop and capped auto-restart logic.
  7. The required full-suite gate must persist the final Studio layout even when earlier writes are slow; intermediate layout states may be coalesced, but writes must remain ordered and the newest state must win.
- **Required validation:** pure parent-liveness selftest; root and extension typechecks/builds; staged app rebuild; enhanced staged runtime probe; local VSIX package and content inspection; route/oracle regressions; full isolated e2e; precommit; graph refresh; diff review; port/process/discovery cleanup.
- **Negative paths:** live/reused parent PID cannot override pipe loss; invalid nonce/PID/mode refuses; stubborn descendant is killed; attach mode remains hands-off by construction.
- **Evidence:** this plan, named staged-probe checks, package listing, ROADMAP/capability/AAR close.

## BASELINE

- **Revision/version:** `5f472e68cf62c4325f2341d41b113615e9393000`; `origin/main` identical.
- **Existing changes:** only user-owned evidence images plus untracked `Note for Kimi.md` and `scripts/x4_muds_game.mjs`.
- **Existing capability:** extension directly spawns `node dist/server.cjs`, watches an unexpected child exit and restarts up to three times, kills only owned children on clean deactivate, and never kills attached servers. The server unpublishes discovery on ordinary exit/signals. No parent-death contract exists, so a host crash can orphan the direct child.
- **Baseline gates:** extension build PASS; existing staged production sidecar probe PASS 6/6. R9 root gates were green immediately before this unit.

## RECONCILE

- **Resources searched:** Graphify sidecar traversal; extension spawn/readiness/restart/stop/deactivate; debug modes; build and package allowlist; staged probe; server shutdown/discovery; ADR and capability records.
- **Existing capability reused:** owned-vs-attached boundary, child stdout/stderr capture, readiness probe, deliberate-stop flag, restart budget, server discovery unpublish, stage/package scripts.
- **Couplings checked:** `inspect-brk` can pause the server before its own watchdog code, so an unpaused supervisor is required; package allowlist must include its output; normal server should still exit gracefully for discovery cleanup; force-reap is the fallback only.
- **Capability-map delta:** pending proof.
- **Plan change from literal recommendation:** parent PID is diagnostic, not authority. Pipe closure plus an owned child handle is stronger and directly defeats PID reuse.
- **Required gate-driven scope change:** the first full E2E run reproduced a test writing into user-owned standing evidence files, so screenshots moved to per-run artifacts. The second full run reproduced the Studio layout writer serializing stale intermediate states behind two approximately five-second requests; R10 cannot close over a red required gate, so this unit also replaces that unbounded chain with a tested latest-state coalescing writer. This is a correctness dependency of the declared validation contract, not a new Kimi recommendation close.

## IMPLEMENTATION TASKS

1. Add/test the parent contract and server-side pipe watcher; install it only for valid managed-sidecar environments.
2. Add a standalone supervisor bundle that spawns exactly one server, forwards output, observes parent stdin, permits graceful exit, then force-kills only its owned child after a bounded grace period.
3. Route extension-owned launches through the supervisor while preserving debug args and attach-first behavior.
4. Enhance the staged probe with real parent-alive/pipe-closed, discovery cleanup, invalid-contract, and stubborn-child checks.
5. Build, stage, probe, package/inspect, run regressions, review, and document close.
6. Required validation-safety correction discovered by the full gate: move product-copy screenshots from two
   standing user-owned evidence PNGs into Playwright's per-run artifact directory before rerunning E2E.
7. Required persistence correction discovered by the rerun: coalesce queued Studio layout writes so at most the in-flight state plus the newest pending state are sent, while retaining serialized server writes and failure recovery.

## IMPLEMENT

- Added a standalone compiled supervisor between the extension host and its managed server. The extension owns the
  supervisor through stdin; the supervisor owns exactly one server process and authenticates graceful shutdown with
  a random IPC nonce. The claimed parent PID is logged only and is never polled or killed.
- Added server-side contract parsing/watch/release and discovery cleanup before authenticated parent-loss exit.
- Preserved attach-first ownership and the existing capped restart policy; only extension-spawned processes receive
  the parent contract.
- Extended the staged-product probe through real server boot, live-parent pipe loss, discovery removal, invalid
  contract refusal, and forced reaping of a pipe-ignorant child.
- Moved product-copy screenshots from standing user evidence files to isolated Playwright artifacts after the first
  full gate reproduced unsafe writes into those files.
- Replaced the Studio layout's unbounded serial save chain with a tested latest-value queue after the full-suite trace
  showed stale intermediate writes delaying the authoritative state. Writes remain serialized; at most the in-flight
  value and newest pending value are retained.

## VALIDATE

- `npm run typecheck` -> PASS.
- `npm run lint` -> PASS, zero errors (established warnings only).
- Parent-liveness selftest -> **11/11**; latest-value writer -> **3/3**.
- `npm run test:routes` / `node scripts/route-integration.mjs` -> **243/243 PASS**.
- `npm run test:oracles` -> runtime index **119/119 green**, including both new selftests.
- Focused rendered Studio shell -> **9/9 PASS**, including durable restore on a fresh origin.
- Full isolated E2E -> final instrumented run **46/46 PASS**, zero failed/flaky/bad results; Playwright terminated
  both ephemeral servers after the verdict. Ports 3100/3101 were clean before and after.
- Root production build, staged app, compiled extension -> PASS. Real staged supervisor drill -> **16/16 PASS**:
  graceful pipe loss, live claimed PID negative, discovery removal, invalid contract exit 64, and stubborn-child
  force reap all observed.
- Local packaged product -> `vscode-extension/x4-forge-studio-0.0.59-r10-final.vsix`, 2,091 entries,
  17,860,935 bytes, SHA-256 `A72BFB0E3EB9D32DBCF7EEBD02CF2FADB1180648CC6365919A869AE614EF0472`.
  Required controller/supervisor/server entries present; zero env/token/config, sourcemap, user-profile, or machine-
  path entries found.
- Negative/cleanup -> the claimed parent remained alive in both graceful and force-reap drills; invalid contract
  spawned no server; attached mode has no contract/spawn path; no real app/mod/game/install/publish surface touched.
- `graphify update .` -> PASS at 2,956 nodes / 6,918 edges / 156 communities. `npm run precommit:check` ->
  PASS (tripwires 0, canon mirrors identical, verdict 10/10, product-copy guard, typecheck). Final diff/port checks
  -> PASS at commit point.

## REVIEW

- Requirement 1 -> done and evidenced by compiled package plus extension spawn contract.
- Requirements 2-5 -> done and machine-evidenced by the 16/16 staged drill.
- Requirement 6 -> done: current-handle identity and restart ownership remain intact; attached handles are unchanged.
- Gate-driven layout requirement -> done: trace proved the old queue mechanism, pure selftest pins coalescing/error
  recovery, and focused/full rendered persistence passed.
- Fresh-eyes findings -> server args remain in Node-option-before-entrypoint order; PID is never an authority; force
  kill targets only the supervisor's direct child tree; no supervisor source/map is omitted from the VSIX. The
  asynchronous deliberate-stop paths clear `backend` before exit handling, preventing an unintended restart.
- Deliberately not done -> no installed-host crash drill, store publish, version bump, attached-process mutation, or
  Unix descendant claim. Package/staged process truth is the applicable R10 product boundary.
- Known-bugs delta -> none. R10 was a reconciled recommendation, not an active observed defect; `KNOWN-BUGS.md`
  correctly remains empty and the recommendation status moves only in the Kimi ledger/ROADMAP.

## CLOSE

- Status: **VERIFIED**.
- Capability-map delta: managed extension sidecars now have a packaged parent-pipe supervisor, authenticated graceful
  server exit, bounded exact-child force reap, and discovery cleanup proof. Studio layout persistence now coalesces
  stale intermediate states without concurrent durable writes.
- Remaining risk: one full E2E attempt lost its Vite process after test 38 with no Windows crash/resource event; the
  exact instrumented rerun stayed alive and passed 46/46. This is recorded as non-clean harness evidence for the
  already-planned R20 flake-policy unit, not misdiagnosed as R10 product behavior.
- Rollback remains the baseline `5f472e68` plus path-scoped reversal of this task's files.
- Suggested commit title: `feat(extension): reap managed sidecars when the host dies`.

## AAR

- **Triggers:** a broad Windows wildcard search failed; parallel root/extension builds raced over generated output;
  an initial inherited-stdio supervisor design never booted the server and was replaced after two staged failures;
  E2E exposed standing evidence-file writes and then a stale layout-save chain; one full run lost Vite late without a
  crash event before an instrumented 46/46 pass; a raw oracle sweep was incorrectly run without its server before the
  owned integration wrapper passed 119/119. All corrections are preserved; no acceptance was weakened.
- **Sustain:** the owned-vs-attached boundary and exact child handle made orphan cleanup strong without trusting PID
  identity. The staged probe exercised real process/discovery behavior instead of narrating source intent.
- **Improve work/approach:** compile root and extension outputs sequentially; design Windows process supervision around
  explicit pipes/IPC from the start; keep tests out of standing user evidence; inspect failed trace timing before
  increasing timeouts.
- **Improve tools:** raw `oracle-sweep` should point operators to `npm run test:oracles` when no target is reachable.
  R20 must define ownership/expiry and capture lifecycle evidence for intermittent web-server loss.
- **Highest-risk evidenced weakness:** a crashed extension host could previously leave a privileged local sidecar and
  stale discovery record running indefinitely. The pipe-authoritative supervisor, nonce-authenticated exit, exact-
  child force fallback, and 16/16 packaged drill close that Windows path.
- **Lessons banked:** parent PID is context, not identity; the ownership pipe is authority. Persist only the newest UI
  state behind a slow durable write. Validation artifacts belong in per-run output, never user-maintained evidence.
