# Uniform Timeout Policy Implementation Plan

**Goal:** close Kimi R9 with explicit, testable deadlines for browser API traffic, HTTP handling, and dev command processes.

Task: B110 / Kimi R9 timeout policy
Lane: FULL
Status: **VERIFIED**

## PLAN

- **Bounded unit:** R9 only. Add one shared deadline policy and negative timeout drills.
- **Assumptions:** ordinary localhost API work should finish within 30 seconds; known AI/compile/validate/package calls may use 150 seconds; the server response ceiling must outlast the provider's existing 120-second abort; developer jobs need a longer but finite ceiling because the full e2e suite currently takes about six minutes.
- **Authoritative references:** Kimi R9 ledger row; existing `src/main.tsx` global fetch chokepoint; `AI_TIMEOUT_MS`; dev-only `/api/run_command` routes; Node HTTP server and Express response timeout contracts; StarForge capability map and ADR ledger.
- **In scope:** browser same-origin `/api/*` fetch deadline composition; server header/body/response deadlines; bounded synchronous command and async job process-tree termination; stable timeout status/code/error fields; pure selftest and isolated HTTP drills.
- **Out of scope:** sidecar parent liveness (R10), CI/flake policy (R19/R20), AI provider retry redesign, non-API external fetches, real mod/game/publish operations, UI redesign.
- **Risks and authorization boundaries:** too-short deadlines can abort legitimate work; killing the wrong PID is unacceptable; timers/listeners can leak; a response timeout must not claim success. Command execution remains dev-only and existing auth rules remain unchanged. No external side effect is required.
- **Rollback/checkpoint:** revert the request-deadline module, middleware/listener configuration, and command-route changes. Baseline revision is `ade9447`; unrelated dirty files remain excluded.
- **Acceptance criteria:**
  1. Every browser same-origin API fetch has a finite total deadline while preserving caller cancellation and the existing safe GET restart retry.
  2. Known long operations receive the documented larger budget; non-API fetches are not changed.
  3. HTTP header, body, keep-alive, and response lifetimes are finite; an over-deadline response returns HTTP 504 with `REQUEST_DEADLINE_EXCEEDED` and the R3 failure envelope.
  4. Async jobs default to 15 minutes, accept only 100 ms to 30 minutes, report the effective limit, and finish as `timed_out` with a non-empty error when killed.
  5. The legacy synchronous command route has a 60-second process-tree deadline.
- **Required validation:** pure selftest; typecheck; isolated route integration including both timeout negatives; runtime oracle integration; lint; build; full isolated e2e; precommit; graph refresh; diff review; port cleanup check.
- **Negative paths:** pre-aborted caller signal is not mislabeled as a deadline; invalid job limits are rejected without spawning; delayed response becomes 504; sleeping job is killed before natural exit.
- **Evidence locations:** this plan's VALIDATE section, named route-integration checks, runtime selftest output, ROADMAP close, and AAR ledgers.

## BASELINE

- **Revision/version:** `ade94474ce25880a003f048762925b2046f80237`; `origin/main` identical.
- **Existing changes:** modified `vscode-extension/evidence/0.0.35-runtime-copy-live.png` and `...startup.png`; untracked `Note for Kimi.md` and `scripts/x4_muds_game.mjs`. All are user-owned and excluded.
- **Existing capability:** `src/main.tsx` already intercepts every browser fetch for same-origin API auth and bounded idempotent-GET boot retry. Provider calls use a 120-second server abort. The extension's probes use a local timeout helper. No general HTTP response deadline exists. Async command jobs have no termination timer; the legacy sync command is also unbounded.
- **Baseline gates:** `npm run typecheck` PASS; `npm run test:routes` PASS 237/237.

## RECONCILE

- **Resources searched:** Graphify request traversal; all `fetch(`, `AbortController`, server timeout, listener, and command-job references; caller inventory; capability map and ADR ledger.
- **Existing capability reused:** the single browser fetch interceptor, R3 failure envelope, provider deadline, isolated route harness, runtime selftest registry, Windows `taskkill /T /F` teardown convention.
- **Couplings checked:** auth/header injection; GET retry semantics; explicit component AbortControllers; provider duration; route ledger capture; dev-only command gating; e2e duration; production route absence.
- **Capability-map delta:** pending proof.
- **Plan changes:** no caller-by-caller fetch migration is needed because all browser calls already cross the global interceptor. Job default is 15 minutes rather than a short generic request deadline so the six-minute e2e gate remains valid.

## IMPLEMENTATION TASKS

1. Add a pure deadline-policy module with constants, route classification, abort-signal composition, job-limit validation, HTTP server configuration, and selftests.
2. Extend the existing browser fetch chokepoint so one total deadline covers auth, retries, and the underlying request.
3. Add API response timeout middleware and configure the returned Node HTTP server.
4. Bound both dev command routes; expose truthful job timeout state and kill process trees on expiry.
5. Add test-only isolated delayed-response and sleeping-job drills, then run the declared gates.
6. Reconcile the Kimi ledger and durable project records only after proof.

## IMPLEMENT

- Added `src/lib/requestDeadline.ts`: one source of truth for browser/server/command budgets, same-origin route
  classification, caller-signal composition, job limit validation, HTTP listener configuration, and 14 checks.
- Extended the existing `window.fetch` interceptor so all browser API calls inherit a total deadline across the
  existing safe GET retry loop; non-API traffic is unchanged and explicit Request/init abort signals still win.
- Added a server response deadline middleware plus finite Node header, request-body, and keep-alive limits. A
  test-only delayed route is registered only when the isolated harness opts in.
- Bounded the legacy synchronous command at 60 seconds. Async jobs default to 15 minutes, accept only 100 ms to
  30 minutes, reject capacity rather than forgetting running jobs, terminate on expiry, and report timeout/process
  exit evidence. Windows uses `taskkill /T /F`; Unix kills only the owned shell because `exec()` has no detached
  process-group option and group killing could terminate Forge itself.
- Extended the R3 normalizer's recognized statuses with `TIMED_OUT` and bumped `/api/agent/schema` to v4 with the
  deadline contract.
- Scope stayed R9-only; no sidecar, CI, flake, mod, game, installed extension, or publishing state changed.

## VALIDATE

- Pure request-deadline selftest -> PASS 14/14; R3 regression selftest -> PASS 12/12.
- `npm run typecheck` -> PASS after correcting the first implementation's unsupported `exec({detached})` option and
  explicit union narrowing.
- `npm run test:routes` -> PASS 243/243. Named negatives: delayed handler returned the R3-enveloped 504 at about
  110 ms before its 300 ms completion; `timeoutMs:99` was rejected before spawn; a five-second PowerShell job with
  a 200 ms budget became `timed_out`, returned `COMMAND_DEADLINE_EXCEEDED`, and its process exited after tree kill.
- `npm run test:oracles` -> PASS 117/117 through the runtime index.
- `npm run test:e2e` -> PASS 46/46 in 399.5 seconds, 0 failed / 0 flaky, authoritative verdict PASS.
- E2E ports 3100/3101 -> confirmed closed after teardown.
- `npm run lint` -> PASS, 0 errors / 548 established warnings; `npm run build` -> PASS with established chunk warning.
- `npm run precommit:check` -> PASS; `graphify update .` -> PASS at 2,934 nodes / 6,883 edges / 142 communities;
  `git diff --check` -> PASS.
- No real mod/game data, installed sidecar/extension, marketplace, Nexus, Steam, or live workspace was touched.

## REVIEW

- **Browser deadlines:** done at the already-universal fetch chokepoint; no caller migration or duplicate wrapper.
- **Caller cancellation:** done for both `init.signal` and Request-owned signals; deadline errors are separately named.
- **Server deadlines:** done for headers, body, keep-alive, and response; timeout returns stable 504 truth before headers.
- **Command jobs:** done with finite default/cap, validation, truthful terminal state, receipt retention, and Windows
  process-tree exit proof. Non-Windows descendants are a documented platform limitation rather than an unsafe group kill.
- **Fresh-eyes finding:** importing the unused max constant added one lint warning; schema documentation now consumes
  the exported constants directly, restoring the 548-warning baseline and preventing documentation drift.
- **Unrelated ownership:** the two existing evidence-image modifications and two untracked Kimi/MUDS files remain
  untouched and excluded.

## CLOSE

- Status: **VERIFIED**.
- Capability-map delta: uniform request lifetime and dev command-job termination contracts are now proven and public
  through agent schema v4. No mod/corpus/UI capability delta.
- Remaining safety batch: R10, R19, R20.
- Suggested commit title: `feat(runtime): enforce request and command deadlines`

## AAR

- **Triggers:** one compound PowerShell search failed from quoting; first typecheck rejected unsupported `exec`
  `detached` options and two union accesses; review removed a new unused-import warning. All were corrected without
  weakening acceptance.
- **Sustain:** finding the existing global browser fetch seam avoided a 30-file caller rewrite. A real sleeping process
  and a real delayed HTTP handler proved termination rather than inferring it from timers.
- **Improve work/approach:** consult the exact Node `exec` type surface before planning process-group behavior; keep
  PowerShell searches small/literal; derive public schema numbers from policy constants on the first pass.
- **Improve tools:** expose cross-platform process-tree termination as a tested shared helper if non-Windows Forge
  becomes supported; the current Unix safety fallback cannot prove descendant reaping.
- **Highest-risk evidenced weakness:** Windows command jobs could previously outlive their receipt forever. The bounded
  timer, capacity refusal, tree kill, terminal code/error/status, process-exit field, and route negative now close it.
- **Lessons banked:** extend universal chokepoints; make timeouts machine-readable; never kill an unowned Unix process
  group merely to simulate Windows tree semantics.
