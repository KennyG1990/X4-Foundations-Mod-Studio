# Remove Neural Link Product Mentions Implementation Plan

> **For Agent:** REQUIRED SUB-SKILL: use `planning`; use the existing X4 Forge graph before broad source search.

**Goal:** Remove Neural Link branding, identifiers, and mod-specific promotion from every shipped X4 Forge app and IDE-extension surface without regressing the generic read-only bridge contract.

**Architecture:** Keep the optional bridge probe and its API response structurally compatible because the Canvas and startup health route already consume it. Make its normalized copy implementation-neutral, make the startup row generic, and prevent branded strings from entering the staged extension or VSIX. Historical plans, ADRs, ROADMAP entries, evidence, and code provenance remain unchanged because rewriting audit history would be inaccurate.

**Tech stack:** React/TypeScript, Express, Playwright, VS Code extension staging/packaging.

## Task Record

Task: Remove Neural Link product mentions
Lane: FULL

### PLAN

- Bounded unit: remove `Neural Link`, `neural-link`, and `x4_neural_link` from shipped source, rendered app copy, staged extension assets, and packaged release output.
- Assumptions: the request removes product exposure, not the generic optional bridge data shape; historical engineering records are not app surfaces.
- Authoritative references: Ken's 2026-07-24 request; ADR-F3, which makes the separate bridge lessons-only and never a Forge dependency; current rendered consumers and extension staging pipeline.
- In scope: Startup Walkaround, live Canvas telemetry, bridge normalization fixtures/copy, shipped source comments/config guidance, extension release copy, regression checks, rendered/package proof.
- Out of scope: deleting the separate bridge project; rewriting ROADMAP/ADR/plan history; removing generic file-bridge contracts; changing live game/mod/config state.
- Risks and authorization boundaries: API consumers may rely on the existing bridge object fields, so field/route compatibility is preserved. No external publish, game-directory write, config write, or Git mutation occurs until the full release gate passes.
- Rollback/checkpoint: revert only the files listed below; current dirty worktree and HEAD `9af72cc` are the baseline checkpoint.
- Acceptance criteria:
  1. Startup Walkaround contains no Neural Link name, identifier, or mod-specific example.
  2. Live Canvas telemetry contains no Neural Link name or identifier whether the optional probe is up or down.
  3. Source files staged into the extension and the final VSIX contain zero case-insensitive matches for `Neural Link`, `neural-link`, or `x4_neural_link`.
  4. The generic bridge state API retains its existing fields and neutral up/down behavior.
  5. Existing health-card, bridge-state, debug-watcher, validation, settings, and completion contracts do not regress.
- Required validation and negative path: health-card and bridge-state selftests; a banned-string scan over shipped roots; typecheck/lint/oracle; focused Playwright showing the walkaround and Canvas; production build/stage/package scan; full e2e and installed Antigravity visual proof before release close. Negative path forces a down probe and proves no branded fallback text.
- Evidence locations: command output in this task; `vscode-extension/evidence/`; ROADMAP/BACKLOG/SESSION-HANDOFF and AAR ledgers at close.

### BASELINE

- Revision/version: `9af72cc`; `origin/main` `667782d`; pending extension version `0.0.35` in the dirty release candidate.
- Existing changes/failures/runtime state: 14 tracked files modified plus two Playwright artifact directories from the path-role correction; the last full e2e run had an overlay click-interception failure and an order-dependent Diff-to-Patch failure. These predate this unit and are not attributed to it.
- Reproduced product exposure: `src/lib/healthCard.ts` renders “Neural-link bridge (optional)” and an `x4_ai_influence` example; `src/lib/bridgeLiveState.ts` emits a Neural Link-specific down summary; `src/components/Canvas.tsx` appends that summary to LIVE telemetry.

### RECONCILE

- Resources and readers/writers searched: `graphify-out/graph.json`; `buildHealthCard`; `normalizeBridgeLiveState`; `getBridgeLiveState`; `/api/agent/health-card`; `/api/agent/live/bridge-state`; Canvas live polling; `vscode-extension/scripts/stage-app.mjs`; source/extension string search.
- Existing capability reused: current optional bridge normalization, health row assembly, app staging, selftest registry, and Playwright harness.
- Couplings checked: normalized summary -> health route and Canvas; staged root app -> extension bundle; ADR-F3 -> bridge must remain optional and separate.
- Capability-map delta: none expected; this removes branding from an existing optional diagnostic rather than adding or deleting a capability.
- Plan changes: preserve the bridge API object/route, but neutralize all shipped identity-bearing strings instead of deleting the diagnostic contract.

## Implementation Tasks

### Task 1: Lock the product-copy regression contract

**Files:** modify `src/lib/healthCard.ts`, `src/lib/bridgeLiveState.ts`; modify or add focused e2e/oracle assertions.

1. Change selftests so an up and down optional bridge must remain structurally honest while all produced labels/details/summaries exclude banned terms and mod IDs.
2. Add a deterministic source/bundle scan for the three banned forms.
3. Run the focused selftests and confirm the old copy fails the new assertions before implementation.

### Task 2: Remove identity-bearing shipped copy

**Files:** modify `src/lib/healthCard.ts`, `src/lib/bridgeLiveState.ts`, `src/server/liveBridge.ts`, `server.ts`, `.env.example`, and any additional shipped source found by the bounded scan.

1. Rename the health row to an implementation-neutral optional integration label and remove the mod advertisement.
2. Neutralize bridge-state summaries and fixtures without changing response fields.
3. Remove Neural Link-specific comments/examples from shipped source and config guidance.
4. Keep historical durable records unchanged.

### Task 3: Render and package proof

**Files:** extend focused Playwright coverage; update `vscode-extension/release-notes.json` and generated changelog if the release gate reaches packaging.

1. Render Startup Walkaround with the optional probe unavailable and assert neutral copy plus absence of banned strings.
2. Exercise LIVE telemetry and assert the same absence contract.
3. Run typecheck, lint, focused selftests, oracle sweep, full e2e, production build, extension staging, packaged-content scan, and installed Antigravity inspection.
4. Only after every applicable gate passes, document close/AAR/handoff, publish `0.0.35`, commit, and push under the project release policy.

### IMPLEMENT / VALIDATE / REVIEW / CLOSE / AAR

To be completed with exact results and evidence after implementation. Any unavailable rendered or installed proof leaves the task `PARTIAL`, not `VERIFIED`.

## Validation-driven scope amendment — B75 release blockers

The first complete e2e run after the product-copy change passed 21/23. The new product-copy test passed. Two pre-existing failures reproduced exactly from the prior release-candidate run and prevent any honest `0.0.35` close:

1. Startup Walkaround uses `z-[9998]` and intercepts Directory Settings' visible, enabled “Save Paths” button until Playwright times out. This is a real user-interaction defect on the same component changed by this unit, not a test-only inconvenience.
2. The Diff→Patch workflow fails to render its synthesized confirmation when run late in the serial suite. Its isolated behavior and state boundary must be established before any change.

Acceptance expands only far enough to remove these two deterministic release blockers. The settings fix must preserve card dismissal and visibility while allowing modal interaction. The patch fix must preserve the real synthesis/adoption contract; weakening or skipping either test is forbidden. Both require focused reproduction, full-suite proof, and an AAR entry.

The first fresh stage then exposed a third release-boundary defect: Vite copied tracked validation fixtures from `public/` into `dist/`, and `stage-app` recursively admitted them into the extension. One fixture contained the removed product identity and real mod source. This is a packaging data-leak class, so correctness requires a clean public-assets root plus an explicit staged-build allowlist. Acceptance now also requires that arbitrary extra files in `public/` and `dist/` cannot enter the VSIX.
