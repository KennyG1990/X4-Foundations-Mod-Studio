# X4 Forge session handoff — 2026-07-25 B79 blocked validation checkpoint

## One-line state

B79 implementation is complete and focused/static checks are green, but the task is honestly BLOCKED before heavy/package/installed validation because X4 is still running and the host is loaded; public 0.0.38 remains known-unproven for retained-panel rebinding.

## Reproduced failures

- Installed Antigravity status reported managed sidecar port 56203 while the retained embedded Studio still identified port 56542. Direct HTTP to 56203 was healthy, so retained pixels were not proof of current-backend binding.
- Load Mod Project used `/api/fs/list` without a root selector, which scanned `filesystemPath || modWorkspacePath`; preview/import then searched workspace first. The workspace was invisible when both roots existed, and same-named mod folders were source-ambiguous.

## Implemented work

- `SharedBackendEnsure` coalesces one backend startup while every caller executes the readiness/bind callback.
- Project list accepts `?root=workspace|filesystem`; preview/import accept the same optional body field; legacy no-selector behavior remains.
- Load Mod Project displays separate **Mod Workspace** and **Filesystem** sources, preserves root identity through Preview and Load Project, and still uses the established whole-folder importer.
- Route fixtures cover independent discovery, same-name collisions in both directions, legacy behavior, arbitrary passthrough, invalid selectors, and traversal.
- Playwright UI coverage asserts both labeled roots and the selected filesystem request bodies.

## Evidence already green

- `npm run test:extension-panel-binding` -> 9/9.
- `npm run typecheck` -> PASS.
- `npm run lint` -> 0 errors (existing warning baseline remains).
- `npx playwright test tests/e2e/project-browser.spec.ts --list` -> one test discovered.
- `git diff --check` -> PASS before the last documentation update.

## Current blocker

- X4 process 26268 remains running with approximately 4.1 GB resident memory.
- Three-sample total CPU observations remained roughly 16-27% across repeated checks.
- Do not run heavy route/e2e/package gates or restart/manipulate Antigravity until X4 is closed and the machine is quiet.

## First resume commands

1. Confirm X4 is absent and host load is low.
2. `npm run test:extension-panel-binding`
3. `npm run test:routes`
4. `node scripts/oracle-sweep.mjs`
5. `npm run build`
6. `npm run test:e2e` (workers=1; verify the e2e workspace guard restored state)
7. `npm run precommit:check`
8. Build/stage/probe the VS Code extension using the existing release scripts.
9. Install into Antigravity only after package gates; force a fresh API-dependent action and verify embedded Studio/status current-port agreement, Directory Settings, and both Load Mod Project source roles.

## Boundaries and hazards

- No real game directory, live mod, or standing Forge config was written.
- Do not publish without fresh explicit authorization.
- Do not commit/push until the task is VERIFIED and release authorization/scope are clear.
- B77 remains open: do not run `graphify update .` because it can mutate historical PNG evidence.
- The earlier 0.0.38 handoff/plan claimed installed proof too strongly. B79 explicitly supersedes that claim.

## Eyeball queue

1. Restart Extensions after installing the validated package; compare the status-bar port to the embedded Studio badge/origin, then open Directory Settings and require a fresh successful fetch.
2. Open Load Mod Project; see **Mod Workspace** and **Filesystem** separately; select a real/scratch mod in each; verify Preview counts and Load Project from the chosen source.

## Commit point

No verified commit point yet. Proposed close title: `fix(projects): bind restored Studio sessions and browse both mod roots`.
