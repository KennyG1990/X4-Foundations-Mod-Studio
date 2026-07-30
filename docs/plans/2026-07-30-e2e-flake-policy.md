# B110-R20 — Fail-Closed E2E Flake Budget And Quarantine Policy

**Goal:** close Kimi R20 with one enforced zero-flake gate, bounded/expiring ownership metadata, and a real retry-
flaky fixture proving quarantine cannot turn a product failure green.

Task: B110 / Kimi R20 flake budget
Lane: FULL
Status: **VERIFIED**

## PLAN

- **Bounded unit:** R20 only: harden the existing `run-e2e.mjs` verdict boundary and exercise it on a deliberately
  flaky Playwright fixture; add the policy selftest to the existing Windows Quality job.
- **Assumptions:** a retry-pass is evidence of instability, not success. Quarantine is ownership/expiry metadata and
  never a skip, exclusion, or verdict override. The user-confirmed quiet machine remains valid unless activity is
  detected before the full suite.
- **Authoritative references:** Kimi R20 ledger row; B64-T2 structured-report verdict; `scripts/run-e2e.mjs`;
  `playwright.config.ts`; installed Playwright 1.61 reporter/config types and CLI; R10's one-off Vite-loss evidence;
  R19 Quality workflow; capability map and ADR ledger.
- **In scope:** one retry to detect retry-passing flakes; Playwright's `--fail-on-flaky-tests`; exact-id quarantine
  schema/policy; zero actual-flake budget; owner/reason/issue/created/expiry enforcement; machine-readable verdict
  receipt; pure and real deliberately-flaky policy tests; one CI policy step; documentation and durable close.
- **Out of scope:** making quarantined failures non-blocking; skipping/tag-excluding tests; rerun-to-green automation;
  diagnosing the unreproduced R10 Vite exit as a product defect; parallel workers; full browser E2E in public CI;
  product UI/runtime changes; R1-R19/R21; game/mod/release/publish actions.
- **Files/surfaces:** `scripts/run-e2e.mjs`; new pure policy module, empty quarantine manifest, selftest runner, and
  isolated Playwright fixture/config; `.github/workflows/quality.yml`; policy documentation; R20 plan and records.
- **Risks and authorization boundaries:** retries can mask a first failure if verdict parsing weakens; stale/wildcard
  quarantines can become permanent skips; CI time can grow. No product state, external publication, credentials,
  mod/game files, or user workspace will be mutated. E2E keeps the existing isolated ports 3100/3101 and temp state.
- **Rollback/checkpoint:** baseline `60d4565ccbc8be6e168acb355c287731609a0371`; revert only R20 paths. Preserve the
  two user-owned modified evidence images and two untracked files.
- **Acceptance criteria:**
  1. The wrapper owns exactly one retry and rejects caller attempts to override retry/flaky-failure policy.
  2. Actual budget is zero: failed, retry-passing flaky, interrupted, timed-out, did-not-run, or no-tests results are
     red. Quarantine metadata cannot alter `green:false`.
  3. The checked-in quarantine manifest is exact-test-id-only and capped at three active entries. Every entry has a
     non-empty owner, reason, issue/backlog reference, ISO creation date, and expiry no more than 14 days later.
     Invalid, duplicate, future-created, expired, overlong, or over-budget policy fails before Playwright starts.
  4. A machine-readable verdict receipt names counts, failing/flaky test ids, quarantine ownership/expiry matches,
     policy errors, report source, and final green/red truth.
  5. A real isolated Playwright test fails attempt zero and passes retry one. The policy selftest observes Playwright
     classify it flaky, matches it to valid quarantine metadata, and still requires the wrapper verdict to be red.
  6. Existing verdict cases remain green/red as intended; clean full E2E remains zero-flaky and leaves ports closed.
  7. Existing Windows Quality runs the bounded policy selftest and remains publication-free.
- **Required validation:** pure policy/wrapper selftests; actual deliberately-flaky fixture; caller override and
  expired/over-budget manifest negatives; full isolated E2E; ports 3100/3101 cleanup; typecheck/lint/oracles/routes/
  build/precommit; workflow parse/order/no-publish review; graph refresh; exact-SHA public Quality after push.
- **Negative paths:** matching quarantine plus flaky/failed report stays red; expired/duplicate/wildcard/over-budget
  entries reject; `--retries` and `--fail-on-flaky-tests` overrides reject; missing/unreadable JSON never passes.
- **Evidence:** `test-results/e2e-verdict.json`; `test-results/e2e-flake-policy-selftest.json`; this plan; public
  Quality run; ROADMAP/capability/AAR close.

## BASELINE

- **Revision/version:** `main == origin/main == 60d4565ccbc8be6e168acb355c287731609a0371`; Playwright 1.61.0.
- **Existing changes:** user-owned modified `vscode-extension/evidence/0.0.35-runtime-copy-{live,startup}.png` and
  untracked `Note for Kimi.md` / `scripts/x4_muds_game.mjs`; none are R20-owned.
- **Existing gate:** structured JSON verdict plus stdout fallback is precommit-protected 10/10 and already treats a
  reported `stats.flaky > 0` as red. Playwright currently uses its default zero retries, so the gate cannot classify a
  first-fail/second-pass instability as flaky in one run. No quarantine manifest, owner, threshold, or expiry exists.
- **Existing CI:** Quality runs root and packaged-VSIX gates but no E2E policy selftest. Public R19 exact-SHA Quality
  passed. Full local R10 E2E last passed 46/46 with zero flaky; one prior run lost Vite late without a crash event.
- **Runtime baseline:** ports 3100/3101 are not listening; E2E remains single-worker and isolated under OS temp.

## RECONCILE

- **Resources/readers/writers searched:** Graphify orientation; wrapper and precommit caller; Playwright config/CLI/
  JSON reporter implementation; package scripts; Quality workflow; all test skip/retry/quarantine patterns; Kimi
  ledger, R10 evidence, capability map, and ADRs.
- **Existing capability reused:** structured JSON report authority, stdout fail-closed fallback, single isolated
  ephemeral stack, Playwright retry/outcome semantics, precommit verdict selftest, and existing Windows Quality.
- **Presence/absence:** the zero-flake verdict already exists in pure form. Retry-based detection, policy metadata,
  expiry/threshold enforcement, durable receipt, real flaky fixture, and CI policy execution are absent. No current
  test uses `skip`, `fixme`, `fail`, explicit retries, or quarantine behavior.
- **Couplings checked:** wrapper CLI owns report path/exit; Playwright JSON supplies stable `spec.id`, status, results,
  and `stats.flaky`; precommit consumes `--selftest`; npm scripts consume the wrapper; Quality can run a bounded
  policy test without starting the full app stack.
- **Capability-map delta:** pending verified implementation.
- **Plan changes from literal recommendation:** do not implement a non-blocking quarantine lane. That would permit a
  labeled product failure to go green, contradicting the project's gate. Quarantine is capped, expiring evidence
  metadata only; the actual flake/failure budget remains zero.

## IMPLEMENTATION TASKS

1. Add pure manifest validation and report classification with immutable policy limits.
2. Integrate retry detection, fail-on-flaky defense, override rejection, and atomic verdict receipts into the wrapper.
3. Add the empty live manifest, policy documentation, and an isolated actual retry-flaky fixture/selftest.
4. Add the bounded policy selftest to Quality; run all declared local gates and fresh-eyes review.
5. Reconcile durable records, commit/push only R20 paths, and require exact-SHA public Quality before VERIFIED.

## IMPLEMENT

- Added immutable zero-flake policy limits and exact-id manifest validation in `e2e-flake-policy.mjs`: one retry,
  zero actual flakes, maximum three active quarantines, maximum 14-day lifetime, required owner/reason/issue/dates,
  and rejection of malformed, duplicate, wildcard, future, expired, overlong, or over-budget entries.
- Refactored the existing wrapper without replacing its structured-report authority. It validates policy before
  spawn, owns `--retries=1`, passes Playwright's `--fail-on-flaky-tests`, rejects retry/flaky/reporter overrides,
  classifies stable Playwright test ids, keeps quarantined issues blocking, and atomically writes
  `test-results/e2e-verdict.json`. Stdout remains diagnostic but cannot go green without the JSON report.
- Added the empty live manifest and `docs/testing/E2E_FLAKE_POLICY.md`. Quarantine is explicitly metadata only; it
  cannot skip, exclude, or change the verdict.
- Added an isolated no-browser Playwright fixture plus selftest. It runs the real wrapper once to discover the stable
  id, then again with valid in-memory ownership/expiry metadata; both inner gates must be red while the outer policy
  test requires Playwright's actual `flaky` classification and the matched quarantine evidence.
- Added `npm run test:e2e-policy` to the existing Windows Quality job after oracles and before production build.

## VALIDATE

- Pure verdict/policy/override/missing-JSON matrix -> **26/26 PASS**.
- Real deliberate retry-flake fixture -> Playwright attempt zero failed and retry one passed; JSON classified
  **1 flaky**. Wrapper returned FAIL both unquarantined and with matching valid metadata; outer policy selftest
  **8/8 PASS** and wrote `test-results/e2e-flake-policy-selftest.json`. Fixture artifacts are isolated under OS
  temp; rerun proved the tracked `test-results/.last-run.json` hash remained unchanged.
- Caller `--retries=9` and `--reporter=line` negatives -> exit 1 during preflight before Playwright spawn.
- Final full isolated E2E -> **46/46 PASS**, 0 failed, 0 flaky, 0 bad results, 0 quarantines, JSON authority; receipt
  reports retryCount=1/flakeBudget=0/policyErrors=0/green=true. Ports 3100/3101 closed afterward.
- Typecheck -> PASS. Lint -> 0 errors / 548 established warnings. Oracles -> **119/119**. Production build -> PASS.
  Isolated routes -> **243/243**. Precommit -> PASS with the 26/26 policy matrix.
- One combined command exited Windows `0xC0000409` immediately after launching oracles, after typecheck/lint passed.
  The isolated authoritative oracle command then passed 119/119; subsequent build/routes/graph/precommit commands
  each passed. This is recorded as command/process-teardown friction, not erased by the successful isolated runs.
- `graphify update .` -> 3,002 nodes / 6,990 edges / 163 communities.
- Quality YAML parse/order -> PASS; policy selftest is after oracles and before build/routes/package/inspect/upload.
  Workflow permissions remain `contents: read`; run commands contain zero marketplace/publish/token command.
- Baseline documentation SHA public Quality `30570581116` and Discord sync `30570582148` -> SUCCESS.
- R20 exact-SHA public Quality `30572006397` / job `90970783625` at
  `681051fce7d8d1aa7f920fbff6f8b2115026273f` -> **SUCCESS**. The real fail-closed policy step passed, followed by
  build, routes, extension build/stage, packaged sidecar probe, inspector selftest, VSIX package/final inspection,
  and artifact retention. Artifact `8771216666` is retained through 2026-08-13.

## REVIEW

- Requirements 1-5 -> locally done/evidenced. Exact one-retry ownership and official fail-on-flaky defense agree;
  quarantined flaky/failed reports remain red and name their owner/expiry in the receipt.
- Requirement 6 -> full suite remains 46/46 with zero flakes and owned-port cleanup.
- Requirement 7 -> workflow is parsed/ordered locally and the exact-SHA public clean runner passed it.
- Fresh-eyes correction -> initial refactor preserved the old stdout fallback's ability to go green. That contradicted
  the specified missing-JSON negative. `verdictWithoutStructuredReport` now forces red while retaining parsed counts
  for diagnosis; pure matrix and policy selftest were rerun after the correction.
- Fresh-eyes correction 2 -> the deliberate red fixture initially changed tracked Playwright `.last-run.json` state.
  Its config now owns an OS-temp output directory; the baseline file was restored and a before/after SHA-256 check
  proves the policy selftest leaves it byte-identical.
- Deliberately not changed -> no test was skipped/tagged/excluded; no non-blocking lane, retry-to-green automation,
  public full browser E2E, product behavior, installed host, game/mod, or release surface was added.
- Known-bugs delta -> none; R20 is recommendation/test-governance work, not an active product defect.

## CLOSE

- Status: **VERIFIED** — local and public clean-runner policy tests prove a retry-passing/matched-quarantine test
  remains red while clean product tests remain green.
- Capability-map delta: recorded in `F:\StarForge\wiki\x4-forge\capability-map.md`.
- Suggested close commit title: `docs(test): verify zero-flake policy`.

## AAR

- **Triggers:** the combined regression command exited `0xC0000409` at oracle launch; fresh-eyes review found and
  corrected a missing-JSON false-green path and tracked Playwright-state churn from the red fixture. Required commands
  and policy tests were rerun in isolation.
- **Sustain:** extend the existing structured-report verdict instead of creating a second gate. Use an actual retry-
  flaky Playwright test, not only synthetic JSON.
- **Improve work/approach:** state whether quarantine affects execution or only ownership before designing schema;
  keep the actual allowed flake count separate from the number of tracked investigations.
- **Improve tools:** long compound Windows command chains can lose which child triggered `0xC0000409`; run each
  authoritative gate separately when a teardown-class exit appears and retain the exact isolated verdict.
- **Highest-risk evidenced weakness:** a clean-looking stdout summary could previously substitute for missing JSON.
  R20 now makes the structured report mandatory for green and keeps stdout diagnostic-only.
- **Lessons banked:** quarantine must never be a success override; structured truth is mandatory for green; red
  fixtures need isolated output state.
