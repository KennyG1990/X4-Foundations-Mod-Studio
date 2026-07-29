# B107 — Lossless responsive Studio shell

**Status:** VERIFIED  
**Lane:** FULL  
**Owner:** Codex  
**Date:** 2026-07-29

## PLAN

- **Bounded unit:** Replace the rigid top header and fixed left tool rail with a config-driven,
  responsive shell whose workspace tabs and tool tabs can be reordered, hidden, collapsed, and docked
  without making any Forge destination or action unreachable.
- **Assumptions:** Antigravity renders the shipped VS Code webview at ordinary desktop widths; X4 and the
  user's live canvas remain outside automated test mutation. The initial assumption that browser local
  storage alone could provide restart persistence was falsified by installed-host validation: the packaged
  sidecar restarts on a new localhost port, which creates a different browser origin. Layout preferences
  therefore require server-backed persistence, with local storage retained only as a fast/legacy fallback.
- **Authoritative references:** current `App.tsx` and `Sidebar.tsx` route/action ownership; every existing
  Playwright flow; ADR-F1 workspace safety; ADR-F2 veteran-floor rule; current Open VSX release process.
- **In scope:** one authoritative registry for ten workspace destinations and eleven side tools; compact
  responsive header; workspace navigation docked top or bottom; tool rail docked left or right; drag and
  keyboard reordering; per-item visibility; independent bar/panel collapse; persistent normalized layout
  preferences; settings sections for layout/navigation; responsive XML Patch workbench; reachability,
  overflow, persistence, corruption-recovery, and packaged-host tests.
- **Out of scope:** arbitrary floating windows, replacement of feature editors, changes to workspace/mod
  data, compiler/validator/deploy semantics, game-directory writes, and a third-party docking dependency.
- **Existing infrastructure reused:** `WorkspaceView`, Sidebar's existing content panels, existing
  `DirectorySettingsModal`, local-storage preference precedent, native HTML drag events, keyboard shortcut
  plumbing, the ephemeral Playwright stack, and the packaged Antigravity/Open VSX release chain.
- **Risks and authorization boundaries:** primary risk is stranding a screen or action behind a hidden bar;
  secondary risks are horizontal overflow, corrupt persisted preferences, drag-only inaccessible behavior,
  and changing the user's canvas. No game, deployed mod, unpacked corpus, or live workspace is written by
  automated validation. Public Open VSX publication is explicitly authorized by Ken for this task.
- **Rollback/checkpoint:** source changes are confined to the Forge repo and can be reverted as one release
  commit; layout preferences have a visible Reset Layout action and invalid/corrupt values normalize to
  safe defaults. The pre-existing dirty files listed in `SESSION-HANDOFF.md` remain untouched.

## Acceptance contract

1. All ten current `WorkspaceView` destinations remain reachable in default layout and from the
   customization surface when their visible tabs are hidden.
2. All eleven current Sidebar tool destinations remain reachable in default layout and from the
   customization surface when their visible tabs are hidden. Existing AI-tier visibility rules remain.
3. Undo, redo, shortcuts, workspace switcher, native project files, Sync Mod, AI configuration, Agent API,
   Report Bug, Settings, Reset, and Beginner/Expert mode remain reachable; destructive Reset moves behind
   an explicit confirmation in Settings or a compact overflow surface, never disappears.
4. Domain tabs and tool tabs support pointer drag ordering plus keyboard move controls. Domain bar supports
   top/bottom docking; tool rail supports left/right docking. Both bars and the side panel can collapse and
   expose a persistent restore affordance.
5. Preferences survive reload and extension-host restart. Missing, old, corrupt, duplicate, or all-hidden
   preference data normalizes without crashing and cannot permanently strand the user.
6. At 2560, 1920, 1600, 1366, 1024, and 800 CSS pixels, the app shell has no document-level horizontal
   overflow and header actions do not create blank off-canvas space. The XML Patch workbench adapts from
   three panes to compact selectable panes rather than keeping fixed 320 + flexible + 450 widths.
7. Existing feature behavior and full e2e remain green. No workspace content hash changes merely from
   changing layout preferences.
8. The packaged extension is installed into the existing Antigravity instance and visually exercised:
   reorder, hide/reveal, dock, collapse/restore, narrow layout, XML Patch compact panes, and reload
   persistence. The verified build is then publicly downloadable from Open VSX with hash parity.
9. The Meta tool uses a distinct metadata icon rather than the Settings gear. The one Studio Settings /
   navigation-customization button lives on the reorderable tool-rail side of the shell (and follows its
   left/right dock), while the workspace bar no longer spends horizontal space on a duplicate gear.

## Required validation and evidence

- Static: `npm run typecheck`, `npm run lint`.
- Focused: layout preference selftest covering inventory equality, normalization, all-hidden recovery,
  move behavior, and corrupt storage; Playwright shell spec covering every destination/action.
- Integration/negative: Playwright viewport matrix and corrupted preference recovery; full
  `npm run test:e2e` judged by `[run-e2e] VERDICT`; live 3000/3001 workspace unchanged and 3100/3101 clean.
- Product: `npm run build`, extension stage/build/package/probe, public VSIX content/hash verification.
- Native UI: existing Antigravity window only, installed public or exact local package, screenshots under
  `vscode-extension/evidence/0.0.57-*` (version provisional until release bump).

## BASELINE

- Revision: `d421f05236da7ec24f18493b37969df08714e135`; `origin/main` matched.
- Public/installed version: 0.0.56.
- Unrelated dirty baseline preserved: two 0.0.35 evidence PNGs, `.tmp-b102-validation/`, `KNOWN-BUGS.md`.
- Current shell: ten hardcoded workspace buttons and eleven hardcoded side-tool buttons; no shared inventory,
  reorder, visibility, docking, or layout persistence. Header labels appear only at 2150px. XML Patch keeps
  fixed 320px and 450px side panes. The app root uses viewport width and can expose off-canvas blank space.
- Baseline failure explanation: **[REPRODUCED in source]** rigid width composition exists. The exact blank
  region's contribution is estimated 90% shell/workbench widths and 10% per-view content until viewport
  probes measure it.

## RECONCILE

- Resources searched: `WorkspaceView`, workspace render switch, top-header actions, Sidebar tab union and
  renders, `DirectorySettingsModal`, local-storage preferences, XML Patch fixed panes, Playwright specs,
  capability map, and ADRs.
- Existing capability reused: all screens/actions already work; this task centralizes and lays them out. No
  alternative shell/docking system or DnD library exists.
- Couplings: active view to preferred sidebar tab, AI-tier tab visibility, beginner/expert shell, readiness
  ladder, sync-conflict layer, modal ownership, local-storage migration, and packaged webview dimensions.
- Capability-map delta: shell registries/customization are presently absent; recorded as B107 SPECIFIED.
- Plan change from initial discussion: unrestricted floating bars rejected. Bounded top/bottom and left/right
  docking preserves predictable geometry and makes overflow proofs tractable.
- Installed-host reconciliation changed the persistence implementation before publication. **[REPRODUCED]**
  docking the workspace bar bottom and tool panel right worked in the installed 0.0.57 candidate, but after
  an extension-host reload the sidecar moved to a new localhost port and the shell returned to top/left.
  The acceptance contract already required extension-host restart persistence, so publication is paused
  while the existing extension-owned server state root is extended with a normalized Studio layout record.
- Ken's pre-publication visual review found that Meta and Settings both used gears. The reconciled change
  is presentation/routing only: Meta receives a tag-shaped metadata icon; the existing tool-rail customize
  affordance becomes the single clearly labeled Studio Settings gear; the duplicate workspace-bar gear is
  removed. The same modal and every customization control remain unchanged.

## IMPLEMENT

- Added `src/lib/studioLayout.ts` as the single lossless inventory for all ten workspace destinations,
  eleven side tools, and twelve global actions. Versioned normalization repairs missing, duplicate,
  corrupt, and all-hidden persisted layouts; the last visible destination cannot be hidden.
- Added `WorkspaceNavigationBar`: pointer reordering (including before/after target placement), top/bottom
  docking, compact/comfortable labels, severity state, collapse, and an always-visible restore handle.
- Replaced Sidebar's duplicated hardcoded icon strip with the same kind of config-driven tool rail. It
  supports pointer ordering, left/right docking, per-tool hiding, rail collapse, full-panel collapse, and
  restore handles while reusing every existing content panel unchanged.
- Extended Studio Settings rather than creating another configuration surface. It provides keyboard
  up/down ordering, show/hide controls, docks, density, panel/bar toggles, and Reset Layout. Directory,
  corpus, community, and AI settings remain in the same modal.
- Kept the established direct Native Files, Project Browser/Sync, Agent API, and Settings controls at
  normal desktop widths after reconciliation found existing UI tests and workflows depend on them. The
  compact Studio Actions menu is the fallback at narrow widths and also exposes Report Bug, AI settings,
  and confirmed Reset.
- Changed XML Patch's fixed three-column layout into a responsive three-pane desktop view plus explicit
  Patch Tree / Patch Blocks / Preview & Diff tabs below 1500px. No patch authoring state or handlers were
  replaced.
- Added root width containment and compact shared control styles without changing workspace, compiler,
  validation, deployment, or project-data contracts.

## VALIDATE

- `npm run test:studio-layout` -> PASS, 11/11 inventory/normalization/move/last-visible checks.
- `npm run typecheck` -> PASS.
- focused changed-file ESLint with `--quiet` -> PASS.
- `npm run lint` -> PASS with 0 errors; 541 repository warnings remain pre-existing.
- `git diff --check` -> PASS (line-ending notices only).
- `npm run build` -> PASS (Vite 1,807 modules and bundled `dist/server.cjs`).
- `npm run test:oracles` -> PASS, 111/111 runtime-discovered oracles.
- focused responsive-shell Playwright suite -> PASS, 9/9.
- `npm run test:e2e` -> PASS by the structured verdict, 43/43; the ephemeral 3100/3101 stack stopped and
  the live 3000/3001 workspace was not used by the run.
- extension stage, controller build, production package audit, and staged sidecar probe -> PASS; probe 6/6.
- final VSIX -> 2,090 entries, 17,804,853 bytes, SHA-256
  `EDD4D4FCAA787387418736E67986A7A19CC28BC32BA1108B80D8291D9B9A1759`; forbidden secret,
  runtime-state, and sourcemap entries absent.
- installed-host proof used a new Antigravity window while leaving Ken's existing window open. The exact
  0.0.57 package showed the distinct Meta icon, the rail-owned Studio Settings control, `NODES -> META ->
  CUES -> WIDGETS`, bottom workspace navigation, and the right-docked tool panel. A real Antigravity window
  reload changed the sidecar port from 58650 to 65072 and preserved that layout and order. Evidence:
  `vscode-extension/evidence/0.0.57/responsive-shell-installed-restart.png`.
- Open VSX accepted stable 0.0.57. The exact public download became available after registry propagation;
  its 17,804,853-byte payload is byte-identical to the installed/tested local VSIX at the SHA-256 above.
- Negative paths -> PASS: malformed/duplicate/all-hidden preferences normalize safely; the last visible
  destination cannot be hidden; dynamic-port restart persistence uses the extension-owned state directory;
  no read-only reference or workspace/game content changed from layout operations.

## REVIEW

- 1-3 inventories/reachability/global actions: done and machine-evidenced by registry equality, 11 focused
  self-checks, 9 shell interactions, and 43 full e2e tests.
- 4 ordering/docking/collapse: done and visually evidenced in the installed host; keyboard alternatives and
  restore controls remain in Studio Settings.
- 5 persistence/recovery: done. Installed-host testing falsified origin-bound localStorage as sufficient;
  the final server-backed normalized record survived a real sidecar-port-changing host reload.
- 6 responsive geometry/XML Patch: done by viewport matrix and compact-pane Playwright coverage.
- 7 regression/workspace safety: done by full e2e, oracles, build, package audit, and isolated-stack cleanup.
- 8 installed/public product: done with a separate Antigravity validation window and public hash parity.
- 9 Meta/Settings distinction: done; Meta uses a tag icon, the single Studio Settings gear lives on the
  reorderable/dockable tool rail, and the duplicate workspace-bar gear is gone.
- Fresh-eyes result: no missing destination, action, or release blocker. Unrelated dirty files remain
  excluded. The quarantined partial extension swap remains recoverable under the user's temp directory.

## CLOSE

- **Status:** VERIFIED
- **Capability-map delta:** B107 is now a delivered capability rather than an absent shell registry.
- **Deliberately unchanged:** all feature editors, workspace/mod data, compiler, validator, deployment, game
  files, and the user's original Antigravity window/canvas.
- **Public release:** Open VSX 0.0.57; public/local SHA-256
  `EDD4D4FCAA787387418736E67986A7A19CC28BC32BA1108B80D8291D9B9A1759`.
- **Suggested release commit title:** `feat(studio): ship lossless responsive navigation and persistent layout customization`.

## AAR

- Triggered: PowerShell quoting/formatting probes failed; lint exposed and removed a duplicate disabled header;
  localStorage-only persistence failed across the installed sidecar's dynamic origin; one Playwright reload
  exhausted a browser buffer; the Antigravity CLI installer crashed after reporting results; a manual extension
  swap hit a live sidecar file lock; an initial four-minute shell timeout killed a healthy expanded e2e suite;
  and Open VSX took roughly one minute to expose the published version. Each was reconciled before close.
- Sustain: inventory-first reconciliation made loss of functionality machine-checkable; the isolated full e2e,
  exact installed-package hashes, host reload, and public artifact parity kept proof levels separate.
- Improve work/approach: budget wrapper timeouts above measured suite duration; stop only the exact extension
  sidecar before a transactional package swap; treat a published response and public availability as distinct.
- Improve tools: persist shell preferences in extension-owned state rather than origin-bound web storage; use
  stable single-purpose Windows commands and retain process-exit logs for long harnesses.
- Highest-risk evidenced weakness: an interrupted extension-directory replacement can leave a partial tree when
  Windows locks the live sidecar. The failed partial tree was quarantined and a fresh exact payload installed;
  future installer work should provide a first-class sidecar shutdown/swap transaction.
- Lessons banked: user-visible layout persistence must be proven across the host's actual restart/origin model;
  installed, rendered, restarted, published, and byte-identical remain separate release gates.
