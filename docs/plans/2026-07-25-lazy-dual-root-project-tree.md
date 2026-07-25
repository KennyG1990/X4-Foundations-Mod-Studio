# IDE-style lazy dual-root project tree

> **For Agent:** REQUIRED SUB-SKILL: use `planning` or `brainstorming` if context is missing.

Task: B80 IDE-style lazy project tree for workspace and deployed roots
Lane: FULL
Status: VERIFIED

## PLAN

- **Bounded unit:** Replace the flat project-card lists inside Load Mod Project with an IDE-style
  disclosure tree for the configured Mod Workspace and Filesystem roots.
- **Assumptions:** “Dropdown” means the Antigravity/VS Code disclosure interaction shown by Ken: a
  right-facing chevron for collapsed nodes, a down-facing chevron for expanded nodes, and children
  rendered beneath the parent. Both configured roots remain simultaneously available; this is not an
  HTML select that hides one source.
- **Authoritative references:** Ken's four 2026-07-25 screenshots; the existing recursive tree in
  `src/components/DirectoryExplorer.tsx`; `SyncModal.tsx` root-qualified project-selection contract;
  `/api/fs/list`; ADR-F4 source/deploy ownership; capability-map B76/B79 entries.
- **In scope:** collapsible source roots; recursively expandable folders; lazy immediate-child reads;
  mod-folder detection from direct `content.xml`; selection and preview from either source; file/folder
  icons; filtering; loading, empty, unavailable, and traversal-rejection behavior; keyboard-visible
  buttons with `aria-expanded`; focused tests; packaged and installed-host proof.
- **Out of scope:** editing files from this dialog; changing the main Files panel; deploying; changing
  workspace/filesystem role semantics; catalog extraction; arbitrary OS-root browsing; a standalone LSP.
- **Affected surfaces:** `server.ts` rooted filesystem listing; `src/components/SyncModal.tsx`; route and
  Playwright project-browser tests; release/package documentation only if the installed proof passes.
- **Risks:** recursive eager scanning can freeze large-mod roots; an unsafe relative path could escape a
  configured root; same-name mods could lose source identity; selection could be coupled accidentally to
  expansion; filtering could hide descendants incorrectly; visual density/accessibility could regress.
- **Authorization boundaries:** repository code/test/docs writes only. Project browsing and preview are
  read-only. No game directory, real mod, standing config, deploy, publish, or external write is authorized
  by this unit. Publishing requires separate explicit authorization.
- **Rollback/checkpoint:** clean `0e83715` baseline; revert only the B80 delta. Existing legacy list mode
  remains the compatibility fallback.

## RECONCILED DESIGN

Three approaches were considered:

1. **Client-only collapse over the current recursive payload.** Smallest code delta, but still scans every
   file before first render and therefore only looks lazy. Rejected for large-mod behavior.
2. **Replace `/api/fs/list` globally with shallow reads.** Clean API shape, but breaks the existing Files
   panel and Library Configurator, which consume a complete recursive tree. Rejected for regression risk.
3. **Add an optional shallow rooted-list contract and use it only in Load Mod Project.** Recommended and
   selected. Legacy requests remain recursive; project-tree requests name a source root and relative
   directory, receive immediate children plus directory metadata, and fetch descendants only on expand.

Data flow:

1. Opening the modal requests the immediate children of both configured roots.
2. Each source root renders as a disclosure row with its configured absolute path and direct mod count.
3. Expanding a directory requests its immediate children once and caches them for the modal session.
4. A directory whose immediate files include `content.xml` is a selectable mod folder. Clicking its label
   selects and previews it; clicking its chevron only expands/collapses it.
5. Preview and Load continue sending `{ root, path }`, so workspace/filesystem collisions remain safe.
6. Filtering matches visible node names/paths and expands matching ancestry without discarding cached state.

The shallow response reuses the existing `FSItem` shape and adds optional directory metadata only:
`childrenLoaded`, `hasChildren`, `hasContent`, `hasPacked`, and direct entry counts. Paths remain relative to
the selected configured root. The server resolves and contains every requested subpath before reading it.

## ACCEPTANCE CONTRACT

- Both **Mod Workspace** and **Filesystem** render as independently collapsible disclosure rows.
- Each directory renders a `>`/down chevron and expands its immediate directory/file children underneath.
- Initial browser load does not recursively enumerate descendants; expansion performs one bounded rooted
  request and re-expansion uses the cached children.
- A directory with direct `content.xml` is selectable and Preview/Load preserve the selected root.
- Same-named mods in both roots remain distinct.
- Files are visible and typed by icon but do not mutate or open from the project-selection dialog.
- Root errors are isolated: one unavailable source does not hide the other.
- Traversal and invalid root/path requests are rejected specifically.
- Existing no-parameter `/api/fs/list` callers still receive the legacy recursive response.
- Filtering can find a loaded descendant and does not corrupt expansion or selection state.
- All visible disclosure controls have `aria-expanded`, stable accessible labels, and keyboard button behavior.

## REQUIRED VALIDATION AND EVIDENCE

1. Focused component/e2e: collapsed roots, expand root, expand nested folder, select without toggling,
   same-name root qualification, cached re-expand, filter, partial-root error.
2. Route integration: shallow root result, nested result, no recursive grandchildren, invalid selector,
   traversal, missing directory, legacy recursive compatibility.
3. Static/type/lint and focused behavioral tests.
4. Full route/oracle/e2e/precommit/build gates; e2e workers remain 1 and workspace restoration is checked.
5. Package/stage/probe the extension.
6. Install into Antigravity and inspect the real rendered tree: collapse/expand both roots, expand one mod
   folder, select and preview from each source, and verify no `Failed to fetch`.
7. Negative path: attempt a rooted `../` shallow list and require rejection without filesystem mutation.
8. Evidence: test logs plus a B80 close record and installed-host screenshots/observations.

## IMPLEMENTATION TASKS

### Task 1: Root-contained shallow listing

- Modify `server.ts` to add an opt-in shallow mode to `/api/fs/list` without changing legacy behavior.
- Add route fixtures before implementation and prove they fail, then pass.

### Task 2: Reusable project-tree state and rendering

- Modify `src/components/SyncModal.tsx` to hold per-root nodes, expansion/loading/error caches, and recursive
  disclosure rendering modeled on the established `DirectoryExplorer` interaction.
- Keep selection separate from expansion and preserve `{root,path}` preview/import bodies.

### Task 3: UI and negative-path proof

- Extend `tests/e2e/project-browser.spec.ts` for root/folder disclosure, lazy requests, cached expansion,
  selection, and root isolation.
- Run focused route and Playwright tests before the broad gates.

### Task 4: Full gates, review, installed proof, and close

- Run typecheck, lint, route tests, oracle sweep, full e2e, build, precommit, extension stage/build/probe/package.
- Re-read the request, plan, and full diff; update ROADMAP/BACKLOG/capability map/AAR/SESSION-HANDOFF.
- Install the validated VSIX into Antigravity and perform eyes-on-screen validation.
- Publish only if Ken explicitly authorizes it; then commit/push according to the release policy.

## BASELINE

- Revision: `0e83715` (`main`, equal to `origin/main`).
- Extension manifest version: `0.0.39`.
- Worktree: clean before B80 documentation.
- Existing behavior: two simultaneous root sections and collision-safe Preview/Load are present, but each
  section is an always-expanded flat card list backed by eager recursive scans.
- Existing user evidence: Ken confirmed the dual-root result and supplied Antigravity's native disclosure
  tree as the target interaction.

## AAR

- Triggered: two read-only reconciliation commands failed because regex quoting was composed incorrectly in
  PowerShell. No files changed. The remainder of reconnaissance uses literal searches and narrow commands.

## IMPLEMENT

- Added opt-in, root-qualified `depth=1` listing to `GET /api/fs/list`; legacy no-depth recursive callers are
  unchanged.
- Added immediate-child metadata, textual and realpath containment, hidden/development exclusion, traversal,
  junction, missing-path, file-path, and unsupported-depth rejection.
- Replaced flat mod cards with independent collapsible source roots and recursively rendered, lazy-loaded,
  session-cached directory branches. Expansion, selection, preview, and import retain separate controls.
- Kept files read-only in this dialog; added file-type icons, CAT/DAT badges, filter ancestry, per-node loading
  and errors, accessible labels, and `aria-expanded`.
- Added route fixtures and Playwright coverage for lazy depth, cache reuse, source collisions, filtering,
  partial-root failure, and negative paths.

## VALIDATE

- Test-first baseline: route integration was 60/66 with the six new shallow-list assertions red.
- Route integration: 69/69 PASS.
- Runtime-discovered oracles: 102/102 PASS.
- Focused project-browser Playwright: 2/2 PASS.
- Full Playwright: 26/26 PASS; `[run-e2e] VERDICT: PASS` from the JSON report.
- Typecheck: PASS. Lint: 0 errors / 438 pre-existing warnings. Precommit: PASS.
- Production app/server build: PASS. Extension stage/build/package: PASS; 2,091 files / 16.99 MB.
- Staged production sidecar: 6/6 PASS, including auth rejection and canonical 32-faction completion.
- Antigravity installation: registry reported `x4forge.x4-forge-studio@0.0.40`; managed sidecar rendered.
- Installed visual: both source disclosure roots rendered; Filesystem collapsed; Mod Workspace expanded; a
  real nested `content.xml`, `ext_01.cat`, and `ext_01.dat` rendered; `workspace: x4_ai_influence` retained
  preview counts; no `Failed to fetch`. Ken independently confirmed the user experience and supplied
  `codex-clipboard-f9826a4a-c28e-4790-9aa4-19cb7752cd9d.png`.
- Negative path: traversal, hidden path, junction escape, missing path, file path, and unsupported depth all
  rejected; one failed source remained isolated; no game/mod/config write occurred.

## REVIEW

- Both disclosure roots: done and visually evidenced.
- Nested lazy children and cached re-expand: done and e2e/API evidenced.
- Root-qualified selection/preview/import and same-name collision: done and e2e/route evidenced.
- Filtering and partial-root error isolation: done; explicit assertions added during fresh-eyes review.
- Legacy recursive consumers: done and route-regression evidenced.
- Security/negative paths: done and route-regression evidenced.
- Fresh-eyes corrections: unreadable directories keep a retryable disclosure; selected-file count comes from
  the complete preview report rather than partial lazy state; loaded directory names feed domain detection.
- Deliberately not changed: project loading/deploy semantics, generic Files panel, standing paths, real mods,
  and publication authority.

## CLOSE

- Status: VERIFIED.
- Capability-map delta: added B79/B80 project-browser and retained-session proof.
- Local installed candidate: 0.0.40. Public publication and Git commit are not authorized and remain pending.
- Remaining observation: Ken reported some lag. No causal attribution is supported; installed display showed
  152–180 rAF-cadence FPS and one 51 ms long-task marker amid a heavily loaded Antigravity workspace.
- Suggested commit title after authorized publication:
  `feat(projects): browse workspace and deployed mods with lazy disclosure trees`.

## AAR OUTCOME

- **Sustain:** test-first API fixtures, isolated e2e ports/state, source-qualified request bodies, packaged
  sidecar probing, and installed real-host inspection each caught a different contract layer.
- **Improve work/approach:** filtering and partial-root failure were in the acceptance contract but were not
  explicit in the first e2e version; fresh-eyes review added them before close. Acceptance items should map to
  named assertions before the first broad run.
- **Improve tools:** PowerShell regex composition, stale `reviewctl` routing, Antigravity CLI teardown, and
  Computer Use bounds/background-input interruptions produced noise without indicating product failure.
  Stable Node-owned harnesses and fresh accessibility observations remained the reliable path.
- **Highest-risk evidenced weakness:** project-root listing intentionally reads one level into every direct
  directory to find `content.xml` and count children. This is bounded, but roots with thousands of direct
  folders or slow network mounts may still pause. Bounded follow-up: instrument root-list duration and direct
  entry count before deciding whether a worker/threaded scan is justified.
