# Uniform API Failure Envelope Implementation Plan

> **For Agent:** execute as the first bounded B110 safety-contract unit. Do not bundle R9/R10/R19/R20.

**Goal:** make every JSON API failure self-identifying at the top level without changing successful responses or removing any route-specific detail.

**Architecture:** add one pure normalizer for failure detection, error extraction, stable fallback codes, and failed-stage extraction. Mount one response middleware before authentication so public, authenticated, router, and HTTP-200 operational failures all use the same contract. Existing route evidence remains authoritative; only a contradictory `success:true` on a recognized failure is corrected.

**Tech Stack:** TypeScript, Express 4, existing runtime selftest registry, isolated HTTP route integration.

Task: B110 / Kimi R3 uniform failure envelope
Lane: FULL
Status: **VERIFIED**

## PLAN

- **Bounded unit:** R3 only: generalize B109's failure truth across JSON API responses.
- **Assumptions:** a failure is observable through HTTP status >=400 or an existing failure signal (`ok:false`, `success:false`, `pass:false`, `allPassed:false`, failed/blocked status, or a failed stage/checklist item). Success payloads, arrays, streams, files, and HTML are not wrapped.
- **Authoritative references:** Kimi's `Note for Kimi.md` section 3.3; B109 `sendReleaseFailure`; `docs/plans/2026-07-29-kimi-recommendations-ledger.md`; StarForge ADR and capability-map ledgers.
- **In scope:** additive top-level `success:false`, `status:"FAILED"` when absent, stable `code`, one-line `error`, and deduplicated `failedStages`; pure selftests; live isolated route compatibility tests; API schema documentation.
- **Out of scope:** success-envelope redesign, HTTP-status migration for legacy operational failures, client fetch timeouts (R9), sidecar liveness (R10), CI packaging (R19), flake policy (R20), UI changes.
- **Files:** create `src/lib/apiFailureEnvelope.ts`; modify `server.ts`, `scripts/route-integration.mjs`, `BACKLOG.md`, Kimi ledger, capability map, ROADMAP/handoff/AAR ledgers at close.
- **Risks and authorization boundaries:** middleware blast radius spans all API JSON failures. The contract must be additive, preserve existing keys and B109 `BLOCKED`/`PARTIAL` semantics, never expose stack/secrets, and never convert success responses. No game/mod/publish/network side effect is authorized or required.
- **Rollback/checkpoint:** remove the middleware mount/import and pure module; route bodies remain unchanged. Existing unrelated dirty files are excluded from this unit.
- **Acceptance criteria:**
  1. Every recognized JSON failure contains a non-empty top-level `error`, stable `code`, array `failedStages`, and `success:false`.
  2. Existing non-empty `error`, `code`, `failedStages`, `status`, and all route-specific fields are preserved byte-for-JSON-value.
  3. A deploy checklist failure returned with HTTP 200 names its failed stage and error at top level.
  4. 401, 404, and 405 failures receive the contract; existing 404/405 codes remain unchanged.
  5. Successful object and array responses are unchanged.
- **Required validation:** pure selftest; typecheck; isolated route integration; oracle sweep; full isolated e2e; lint; build; precommit; graph refresh; final diff review.
- **Negative path:** malformed/missing error detail falls back deterministically without throwing; an ordinary success containing nested data with `ok:false` is not falsely rewritten unless the top-level response itself signals failure.
- **Evidence:** selftest route output, `scripts/route-integration.mjs` named checks, gate outputs recorded below and in ROADMAP at close.

## BASELINE

- **Revision/version:** `7231ebb`; B109 public 0.0.59.
- **Existing changes:** pre-existing modified `vscode-extension/evidence/0.0.35-runtime-copy-{live,startup}.png`; untracked `Note for Kimi.md` and `scripts/x4_muds_game.mjs`. Preserve all four.
- **Existing capability:** B109 release failures already provide `success/status/code/error/stages/failedStages`. API router has JSON 404/405. No central failure normalizer exists.
- **Census:** 151 declared API routes and approximately 277 explicit 4xx/5xx JSON returns, plus HTTP-200 operational failures.
- **Baseline gates:** `npm run typecheck` PASS; `npm run test:routes` PASS 227/227 on the isolated stack.

## RECONCILE

- **Resources searched:** Express middleware order; auth errors; API 404/405 guard; deploy/deploy-verify; B109 release handlers; route integration; client helper; ADR and capability map.
- **Existing capability reused:** B109's additive failure fields and stage vocabulary; existing selftest registry and isolated route harness.
- **Couplings checked:** auth before routes, ledger response capture, Vite/production fallback, raw success arrays, legacy HTTP-200 failures, Release Center `BLOCKED` status.
- **Capability-map delta:** pending implementation; record the central contract only after proof.
- **Plan change from ledger wording:** limit normalization to failure responses. Wrapping all success responses would break established clients and is not required by Kimi's reproduced failure.

## IMPLEMENTATION TASKS

### Task 1: Pure failure contract

**Files:** create `src/lib/apiFailureEnvelope.ts`.

1. Write a table-driven selftest covering HTTP errors, HTTP-200 checklist failures, preserved B109 fields, missing-detail fallback, deduplication, and untouched successes.
2. Implement failure detection and additive normalization.
3. Run the selftest directly and through the registered oracle.

### Task 2: One middleware, all JSON API failures

**Files:** modify `server.ts`.

1. Mount the JSON response interceptor before `authMiddleware`; middleware ordering must still preserve CORS/body behavior.
2. Normalize only `/api` JSON responses; do not touch files, text, streams, HTML, or success payloads.
3. Register the pure selftest in `SELFTESTS`.

### Task 3: Compatibility and negative proof

**Files:** modify `scripts/route-integration.mjs`.

1. Assert unauthenticated 401 gets the fallback code and empty `failedStages`.
2. Assert existing 404/405 codes and details remain while the envelope is complete.
3. Exercise a real HTTP-200 `deploy-verify` failure and prove `failedStages` plus `error` are top-level.
4. Assert representative success object and array response shapes remain unchanged.

### Task 4: Full gates and durable close

**Files:** update this record, Kimi ledger, capability map, `BACKLOG.md`, `ROADMAP.md`, `SESSION-HANDOFF.md`, and applicable AAR ledgers.

1. Run all declared gates and verify ephemeral ports stop.
2. Review the complete diff against R3 and unrelated-file preservation.
3. Mark R3 VERIFIED only if every applicable gate passes; otherwise close honestly as PARTIAL/FAILED.
4. Refresh Graphify after code changes.

## IMPLEMENT

- Added `src/lib/apiFailureEnvelope.ts`: pure top-level failure detection, stable HTTP/stage fallback codes,
  error inference, failed-stage extraction/deduplication, success-shape preservation, and 12 table-driven checks.
- Mounted one `/api` JSON response normalizer before authentication, so auth, route, router, and HTTP-200
  operational failures share the contract. Streams, HTML, text, and successful JSON are unchanged.
- Bumped `/api/agent/schema` to `2026-07-30.agent.v3` and documented the failure contract.
- Extended isolated route integration with auth, 404, 405, success-object, success-array, B109 preservation,
  and a real malformed deploy-verify refusal that writes nothing.
- Scope stayed R3-only; R9/R10/R19/R20 were not modified.

## VALIDATE

- Focused pure selftest -> PASS 12/12 (the initial pre-review run was 11/11; fresh-eyes added the
  contradictory-success regression).
- `npm run typecheck` -> PASS.
- `npm run test:routes` -> PASS 237/237 on the isolated stack. Named negative proves an HTTP-200 malformed
  deploy refusal returns `success:false`, `code:WELLFORMED_FAILED`, top-level error, and
  `failedStages:["wellformed"]`, while writing no fixture target.
- `npm run test:oracles` -> PASS 116/116 via runtime index, including failure envelope 12/12.
- `npm run test:e2e` -> PASS 46/46 in 372 seconds with `[run-e2e] VERDICT: PASS`; 0 failed, 0 flaky.
  Ports 3100/3101 were confirmed closed afterward.
- `npm run lint` -> PASS, 0 errors / 548 established warnings.
- `npm run build` -> PASS; established large-chunk warning only.
- `npm run precommit:check` -> PASS, including verdict selftest 10/10, product-copy 7 roots, mirrors, and typecheck.
- `graphify update .` -> PASS, 2,918 nodes / 6,849 edges / 142 communities.
- `git diff --check` -> PASS.
- Negative/failure-path coverage -> missing detail deterministic fallback; nested false success not reclassified;
  B109 explicit PARTIAL success preserved; contradictory HTTP failure cannot retain `success:true`; 404/405 codes
  preserved; HTTP-200 deploy failure writes nothing.
- Initial raw `node scripts/oracle-sweep.mjs` -> FAILED 0/115 because its default `localhost:3001` target was not
  running (`server unreachable — fallback`). Correct command `npm run test:oracles` booted an isolated owned server
  and passed 116/116. This is retained as an AAR trigger, not hidden.

## REVIEW

- **Uniform failure truth:** done and evidenced across auth, router, B109 compatibility, and HTTP-200 deploy refusal.
- **Stable codes:** existing route codes win; deterministic HTTP/stage fallbacks cover missing codes.
- **Top-level error and failed stages:** done; inference uses route detail without discarding nested evidence.
- **Success compatibility:** representative object and array shapes remain unwrapped; explicit B109 PARTIAL success
  remains partial rather than being falsely reclassified.
- **No side effects:** malformed deploy negative wrote no fixture target; no real mod, game directory, external
  service, marketplace, or installed extension was touched.
- **Fresh-eyes finding:** the first implementation filled `success:false` only when absent. That could preserve a
  contradictory `success:true` on an HTTP error. Corrected before close and pinned with a 12th selftest.
- **Unrelated changes:** both pre-existing 0.0.35 images plus `Note for Kimi.md` and `scripts/x4_muds_game.mjs`
  remain untouched and excluded from task ownership.

## CLOSE

- Status: **VERIFIED**.
- Capability-map delta: central JSON failure contract added and documented; no UI/corpus/mod capability delta.
- Remaining B110 safety work: R9, R10, R19, R20. R3 needs regression preservation only.
- Suggested commit title: `feat(api): standardize machine-readable failure responses`

## AAR

- Triggers: reconciliation narrowed R3 to failures rather than a breaking success-wrapper redesign; three exploratory
  `rg` batches returned non-zero from no-match/PowerShell regex quoting; fresh-eyes review forced one correction;
  the first oracle command targeted an absent server and failed 0/115 before the isolated harness passed 116/116.
- Sustain: reconcile against the exact Kimi note and B109 exemplar; central pure policy plus external route proof
  covered the whole API without editing hundreds of handlers.
- Improve work/approach: test contradictory truth in the first table; use the project-owned isolated oracle command
  rather than the raw sweep when no server is running; isolate expected no-match searches.
- Improve tools: make the raw oracle sweep's unreachable-server message recommend `npm run test:oracles`; prefer
  literal/smaller ripgrep searches in PowerShell over compound look-around expressions.
- Highest-risk evidenced weakness: global middleware can silently distort successful payloads. The bounded guard is
  explicit-positive precedence plus object/array/B109 compatibility tests and the full 46-test UI suite.
- Global/project lessons banked in the workflow and X4 Forge AAR ledgers.
