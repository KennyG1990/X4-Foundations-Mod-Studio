# Health card layout safe area

Task: repair the reproduced delayed Startup walkaround card collision with movable Forge chrome.
Date: 2026-08-06
Status: VERIFIED
Lane: FULL

This plan is limited to the Forge extension UI and its existing studio-shell layout E2E coverage. It does not
authorize changes outside the four owned paths, Git or GitHub operations, packaging, publishing, installation,
runtime state, or any user dirty/untracked file.

## PLAN

- **Bounded unit:** pass the existing `StudioLayoutPreferences` dock state from `App` into `HealthCardOverlay`,
  position the fixed card clear of right-docked tool controls and bottom-docked workspace navigation, and add one
  deterministic regression to the existing layout-customization E2E test.
- **E2E prerequisite:** the existing `bootExpert` helper waits only 1.5 seconds for the asynchronous health-card
  request. The regression must delay the real `/api/agent/health-card` response beyond that helper window, then
  require the first card appearance after the right/bottom dock change before measuring boxes and using the ordinary
  unforced tool-rail collapse click. This preserves the reproduced late-first-appearance race instead of hiding it
  with retries, force clicks, extra dismissal, or a broader helper timeout.
- **Assumptions:** the existing right tool rail remains 48px wide, the bottom workspace navigation remains its 36px
  content row, and `toolDock`/`workspaceDock` are the complete layout inputs needed by this overlay. The health-card
  endpoint continues to return the existing attention/blocked payload used by the ephemeral E2E stack.
- **Authoritative references:** `src/lib/studioLayout.ts` for the owned preference type/defaults; `src/App.tsx` for
  layout state ownership and shell mounting; `src/components/Sidebar.tsx` and
  `src/components/WorkspaceNavigationBar.tsx` for the existing chrome dimensions and test IDs;
  `tests/e2e/studio-shell.spec.ts` and `scripts/run-e2e.mjs` for the existing regression and verdict-parsed
  supervisor.
- **In scope:** the four owned paths only: this plan, `HealthCardOverlay.tsx`, `App.tsx`, and
  `studio-shell.spec.ts`.
- **Out of scope:** health-card fetch/state/copy/dismiss logic, `StudioLayoutPreferences` storage or normalization,
  sidebar/navigation components, unrelated tests, all other source/scripts/docs/configuration, package/install/release
  state, Git/GitHub state, and user dirty/untracked files.
- **Risks and authorization boundaries:** this is a local responsive UI change and isolated E2E fixture delay. No
  network beyond the existing ephemeral endpoint, spending, deletion, credential, game, mod, or production write is
  authorized. The only intentional test-side timing is the endpoint delay required to reproduce the late first
  appearance.
- **Rollback/checkpoint:** baseline is the supplied HEAD and current dirty-worktree inventory. If validation fails,
  revert only the changes made in the four owned paths using a narrowly scoped patch; do not use Git reset/checkout,
  clean, or broad restoration.
- **Acceptance criteria:**
  1. `HealthCardOverlay` receives only `toolDock` and `workspaceDock` from the existing App-owned preferences and
     dynamically clears right-docked tool controls and bottom-docked workspace controls.
  2. Left-tool/top-workspace placement remains `right-4 bottom-4` and wide-card sizing remains equivalent; narrow
     viewports retain readable, scrollable, dismissible card content.
  3. The existing layout-customization E2E test delays `/api/agent/health-card` beyond 1.5 seconds, observes the
     card after switching to right/bottom docks, proves card/tool-rail-collapse boxes do not overlap and card/bottom
     navigation boxes are clear, then performs the ordinary unforced collapse click.
  4. Existing card copy, one-shot fetch, visibility rule, scroll area, and dismiss behavior remain unchanged.
  5. The diff contains no unrelated churn and no forbidden-path changes.
- **Required validation and negative path:** targeted ESLint for the three code/test files when supported; `npm run
  typecheck`; and the narrow layout-customization spec through `scripts/run-e2e.mjs` with an outer timeout longer than
  30 minutes. The negative path is the delayed response itself: the helper's 1.5-second wait must not dismiss or
  suppress the card, the card must become visible once after dock changes, the measured boxes must be disjoint, and
  the ordinary click must collapse the rail. Record the supervisor's structured verdict, pass/fail/flaky counts,
  and post-run 3100/3101 listener state.
- **Evidence locations:** exact commands, exit codes, counts, structured E2E verdict/receipt path if produced, and
  listener readback will be recorded in this plan's VALIDATE/CLOSE sections only after they actually run. No
  test-results or other evidence file is to be modified by this task.

## BASELINE

- **Revision:** `e47dab5c600ed9954c938124d5a116a81daa3983`.
- **Working state:** the worktree is intentionally dirty with unrelated modified, deleted, and untracked paths;
  the four owned paths are clean at baseline. Those unrelated paths remain preserved and out of scope.
- **Reproduced behavior:** a full E2E run supplied for this task reported 95 passed plus 1 flaky under the zero-flake
  policy. The first `tests/e2e/studio-shell.spec.ts` attempt timed out at the unforced collapse click because the
  fixed `bottom-4 right-4 z-90` card appeared after the helper's 1.5-second dismissal window. A retry passed. The
  card fetches once, so the race is delayed first appearance rather than repeated state.
- **Current source:** `HealthCardOverlay` owns the one-shot fetch and fixed `bottom-4 right-4` card; `App` mounts it
  independently while already owning and persisting `StudioLayoutPreferences`. The existing layout test changes the
  workspace dock to bottom and tool dock to right before the affected collapse click.

## RECONCILE

- **Resources and readers/writers searched:** `StudioLayoutPreferences`, defaults and normalization; App's layout
  state/ref/persistence and both docked `WorkspaceNavigationBar` mounts; Sidebar's right/left `ToolRail` and its
  collapse control; `HealthCardOverlay`; the existing layout-customization test/helper; package lint/typecheck
  scripts; and the E2E supervisor's argument/verdict path.
- **Existing capability reused:** App's single normalized layout preference state, the existing fixed overlay,
  existing sidebar/navigation geometry and test IDs, and the existing supervisor. No duplicate layout state,
  overlay, safe-area manager, or test harness is introduced.
- **Couplings checked:** App preference updates -> overlay props; tool/workspace dock changes -> fixed-card insets;
  endpoint response timing -> one-shot card visibility; card and chrome geometry -> ordinary Playwright click;
  supervisor structured verdict -> pass/flaky classification and port cleanup.
- **Capability-map delta:** no capability-map delta; this repairs placement of an existing UI surface.
- **Plan changes:** none after reconciliation. The bounded E2E prerequisite is retained as an acceptance requirement,
  and the safe-area offsets are derived from the existing fixed rail/bar dimensions with a responsive card width.

## IMPLEMENT

- **Status:** implemented; validation is in progress.
- **Actual bounded changes:** `HealthCardOverlay` now accepts only the existing `toolDock` and `workspaceDock`
  preference fields. It preserves `right-4 bottom-4` for left/top defaults, shifts to 64px right/bottom safe-area
  insets for the corresponding docked chrome, and constrains width responsively when the right inset is active.
  `App` passes those fields from its existing layout state. The layout-customization test delays the real health-card
  response for 2.5 seconds, requires visible card geometry after the right/bottom transition, checks disjoint card
  and collapse-control boxes plus clearance above bottom navigation, and performs the existing unforced click.
- **Scope changes and reasons:** none authorized.

## VALIDATE

- **Targeted ESLint:** `npx eslint src/components/HealthCardOverlay.tsx src/App.tsx tests/e2e/studio-shell.spec.ts`
  -> exit `0`; `0` errors and `5` warnings. All five warnings are the existing `App.tsx` unused-variable or
  exhaustive-deps warnings; the changed lines introduced no lint error.
- **Typecheck:** `npm run typecheck` -> exit `0`; `tsc --noEmit` passed.
- **Narrow E2E:** the project supervisor was invoked only for
  `tests/e2e/studio-shell.spec.ts` with the exact title filter
  `layout customization docks, hides, reorders, collapses, restores, and persists` through
  `node --input-type=module -e "import { runE2e } from './scripts/run-e2e.mjs'; const args = ['tests/e2e/studio-shell.spec.ts', '-g', 'layout customization docks, hides, reorders, collapses, restores, and persists', '--output', process.env.X4_HEALTH_E2E_OUTPUT]; process.exit(await runE2e({ args, receiptPath: process.env.X4_HEALTH_E2E_RECEIP }));"`
  -> exit `0`; structured verdict `1/1` passed, `0` failed, `0` flaky, `0` bad-result, `green=true`, structured
  report complete, and the focused receipt is `test-results/e2e-verdict.json`.
- **Negative/containment result:** the delayed health-card response was held for `2.5s`, beyond `bootExpert`'s
  `1.5s` dismissal window. The card became visibly present after right/bottom docking; the card and tool-rail
  collapse bounding boxes were disjoint; the card cleared the bottom workspace navigation; and the ordinary
  unforced collapse click passed. The supervisor reported lifecycle `complete=true`, trigger `child-close`,
  `treeGone=true`; post-run listeners were `3100=0` and `3101=0`.

## REVIEW

- **Requirements review:** all five acceptance criteria are done and evidenced. The overlay receives only the two
  dock fields from App; default left/top placement remains `right-4 bottom-4`; right/bottom safe areas are dynamic
  and responsive; the regression proves delayed first appearance, both geometry boundaries, and ordinary collapse;
  fetch, copy, scrolling, visibility, and dismiss code remain unchanged; and the implementation diff is limited to
  the three tracked source/test files plus this owned plan.
- **Fresh-eyes review:** re-read the changed JSX, prop wiring, regression ordering, and four-path diff. No force
  click, retry, extra dismissal, timeout broadening, duplicate layout state, or unrelated source churn was found.
  `git diff --check` passed for the tracked owned changes. The pre-existing dirty worktree remains preserved.

## CLOSE

- **Status:** VERIFIED for this bounded Forge extension UI repair only.
- **What changed:** `HealthCardOverlay` now clears the existing right-docked tool rail and bottom-docked workspace
  navigation using the App-owned `StudioLayoutPreferences` dock fields, while preserving default placement and card
  behavior. The existing layout-customization E2E now deterministically exercises the delayed first appearance and
  validates the safe areas before the normal collapse click.
- **What was deliberately not changed:** no layout storage/normalization, sidebar/navigation component, health-card
  endpoint, copy, fetch lifecycle, dismissal behavior, unrelated source/test/documentation path, Git/GitHub state,
  package/install/release state, or user dirty/untracked change. The required supervisor receipt is retained as
  read-only E2E evidence at `test-results/e2e-verdict.json`.
- **Capability-map delta:** no capability-map delta; this is placement repair for an existing surface.
- **Baseline/rollback:** baseline remains HEAD `e47dab5c600ed9954c938124d5a116a81daa3983` and the preserved dirty
  worktree. Rollback is limited to the four owned paths; no Git operation was performed.
- **Remaining risks/deferred work:** five pre-existing ESLint warnings remain in `App.tsx`; no task-specific error or
  validation concern remains. Commit/stage/push/package/install/publish remain intentionally not done.
- **Suggested commit title:** not applicable; this task forbids commit/stage/push.

## AAR

- **Outcome:** triggered full-lane AAR. The implementation is VERIFIED; one initial E2E launch wrapper was rejected
  before execution by the shell safety policy, then the native supervisor run passed. The first receipt-redirection
  wrapper also fell back to the supervisor's default receipt path because its task-specific environment name was
  mistyped; the final structured verdict and receipt readback were still green.
- **Sustain:** retain existing preference ownership and make asynchronous first appearance observable through a
  deterministic delayed response plus ordinary interaction and geometry assertions.
- **Improve work/approach:** keep validation wrappers minimal and verify task-specific environment/argument names
  before launch; do not treat a passing product test as sufficient without the structured supervisor verdict and
  listener/termination readback.
- **Improve tools:** the supervisor's default receipt path and Playwright artifact path should be explicitly checked
  against forbidden-path constraints before invocation; a future bounded harness improvement can provide a validated
  external receipt/output override without changing product code.
- **Highest-risk evidenced weakness:** the asynchronous first response can arrive after boot helpers finish and
  intercept fixed-position controls; the regression now fails if either docked safe area or the ordinary collapse
  interaction regresses.
- **Global/project lessons banked:** none; no memory or project ledger write is authorized in this bounded task.
