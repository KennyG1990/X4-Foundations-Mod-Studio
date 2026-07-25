# Studio backend rebind and dual-root Load Mod Project browser

**Task:** B79
**Lane:** FULL
**Status:** BLOCKED

## PLAN

- **Bounded unit:** repair the retained-Studio backend binding race and make Load Mod Project discover, preview, and import whole mod folders from either configured source root without source ambiguity.
- **Assumptions and unresolved facts:** the existing whole-folder importer and artifact ownership model remain authoritative; the installed visual failure is caused by stale iframe binding, while project discovery has an additional deterministic single-root design defect. Native UI proof must wait for an explicit machine-state check immediately before validation.
- **Authoritative references:** installed Antigravity status/panel port evidence; `vscode-extension/src/extension.ts`; `src/components/SyncModal.tsx`; `server.ts`; ADR-F4 read-only source/deploy ownership; X4 Forge capability map; existing route, round-trip, artifact, and extension selftests.
- **Existing infrastructure reused:** `PanelBackendBinding`, the shared sidecar ensure promise, `/api/fs/list`, `resolveModFolder`, `importModFolder`, `/api/agent/round-trip-check`, `/api/agent/mod-folder/import`, source-stamp/import classification, and the generic artifact pipeline.
- **In scope:** make every shared backend-ensure caller execute panel binding; add an explicit `workspace|filesystem` selector to project listing, preview, and import; retain legacy no-selector behavior for existing consumers; show both configured roots as clearly labeled sources; preserve full-folder import semantics for arbitrary files and packed mods; focused regression tests; packaged and installed-host validation.
- **Out of scope:** changing `/api/fs/read` or `/api/fs/write` ownership, bypassing validated Deploy, writing to the live game/mod, changing corpus/schema semantics, publishing a release without separate authorization, and B77 graphify repair.
- **Risks and authorization boundaries:** incorrect root selection could import the wrong same-named mod; a bad panel refresh could discard transient UI state or loop; route changes could regress Files/Library consumers. No game, mod, standing config, spending, credential, or deletion side effect is authorized. Scratch roots only until the installed-product eyeball gate.
- **Rollback/checkpoint:** baseline is clean `main` at `8175491`, equal to `origin/main`. Revert only the bounded B79 files; legacy no-selector route behavior remains covered.

## ACCEPTANCE CONTRACT

1. Two concurrent backend callers share one startup, but each successful caller reaches the authoritative bind step; a restored panel tracked by the joining caller reloads to the current backend.
2. An unchanged backend identity does not reload; changed port or token reloads exactly once; startup failure stays explicit.
3. `GET /api/fs/list?root=workspace` and `?root=filesystem` independently scan only their configured roots; the existing no-query response shape and default behavior remain compatible.
4. Invalid root selectors and traversal are rejected. A same-relative-name collision previews/imports the explicitly selected root, never whichever root happens to be searched first.
5. Load Mod Project visibly presents both configured roots, filters their mod folders, identifies the selected source, and passes that source through Preview and Load Project.
6. Loading a selected mod still uses the existing whole-folder importer, preserving supported models, passthrough files, binaries, packed CAT/DAT, arbitrary extensions, Unicode paths, and large files under the established import contract.
7. Focused extension and project-browser selftests, route integration, typecheck, lint, build, oracle sweep, full e2e, precommit check, extension build/stage/probe, and an applicable negative path pass.
8. Installed Antigravity proof after an extension restart shows the Studio badge/API origin on the same current sidecar port, Directory Settings fetches successfully, and Load Mod Project visibly lists both scratch/configured source roles and can preview/load a selected whole mod.

## REQUIRED EVIDENCE

- Commands and deterministic results in a B79 evidence record under `vscode-extension/evidence/`.
- Scratch-root route evidence for dual discovery, collision selection, invalid selector, traversal, and whole-folder preservation.
- Real rendered Antigravity screenshots/observations for current-port rebinding and dual-root project browsing.
- ROADMAP close, corrected SESSION-HANDOFF, capability-map delta, and project/global AAR entries if triggers fire.

## BASELINE

- **Revision/version:** repository and `origin/main` both `8175491`; public/installed extension version 0.0.38.
- **Existing changes:** clean worktree before this plan record.
- **Reproduced failure:** Antigravity extension status reported managed sidecar port 56203 while the retained embedded Studio still identified port 56542. Direct HTTP to 56203 returned a healthy reference status and canonical corpus counts, proving the screenshot's fetch failure came from stale iframe origin rather than corpus loading.
- **Project-browser defect:** `/api/fs/list` chooses `filesystemPath || modWorkspacePath`; `resolveModFolder` searches workspace first. Therefore both configured roots cannot be browsed and a clicked filesystem candidate can resolve to a same-named workspace folder.

## RECONCILE

- **Resources/readers/writers searched:** panel lifecycle/serializer/ensure callers; SyncModal project discovery/selection/preview/import; filesystem list/read consumers; mod-folder resolver/importer/round-trip checker; route integration fixtures; ADR-F4 and capability map.
- **Presence:** complete whole-folder import, classification, byte-preservation, artifact packaging, explicit Deploy, panel identity dedupe, and extension serializer already exist.
- **Absence/partial:** no explicit project-root selector; no dual-root UI model; no collision test; shared ensure only binds on the creator path, not joiners.
- **Couplings:** extension startup and webview restoration; backend/UI request bodies; legacy Files/Library `/api/fs/list` consumers; read-only source/deploy ownership; import preview and actual import.
- **Capability-map delta:** pending close; expected delta is explicit dual-source project discovery plus proven authoritative retained-panel rebinding.
- **Plan change:** prior 0.0.38 validation claim is reopened because it did not force a fresh iframe/API interaction and therefore did not prove rebinding.

## IMPLEMENT

- Added `SharedBackendEnsure`, used it from the extension lifecycle, and proved joined callers run their own readiness/bind callback while sharing one startup.
- Added explicit `workspace|filesystem` root selection to project listing, preview, and import while preserving the legacy unselected list/resolution behavior.
- Changed Load Mod Project from one filesystem-first list into two labeled source sections. Candidate identity, Preview, manual root selection, and Load Project now retain the selected source.
- Extended isolated route fixtures with same-name cross-root collisions, unique candidates, arbitrary passthrough files, invalid selectors, and traversal.
- Added a real Playwright UI contract for dual-root rendering, source-specific preview, and source-specific whole-project loading.

## VALIDATE

- `npm run test:extension-panel-binding` -> PASS 9/9, including unchanged identity, joined restored-panel bind, explicit failure, and retry.
- `npm run typecheck` -> PASS.
- `npm run lint` -> PASS with 0 errors and the repository's existing warning baseline.
- `npx playwright test tests/e2e/project-browser.spec.ts --list` -> PASS; one Chromium test discovered.
- First focused selftest attempt -> FAILED because CommonJS does not support top-level await; harness was corrected to an async `main`, then passed 9/9. This is an AAR trigger.
- Pending because X4 remains running and sampled host CPU is 16-27%: route integration, oracle sweep, production build, full e2e, precommit, extension build/stage/probe, and real installed Antigravity interaction.
- Required negative checks already encoded but not yet executed: invalid root selector, traversal, same-name collision in both directions, startup failure, and unchanged backend identity.

## REVIEW

- Pending requirement-by-requirement fresh-eyes review.

## CLOSE

- **Status:** BLOCKED — implementation exists, but required runtime/package/installed UI evidence is unavailable while X4 is running and the host is busy. Do not call this verified.
- **Resume:** after X4 closes, run focused/route/oracle/build/e2e/precommit/package gates, then install the package and prove the embedded Studio and status bar agree on the current backend port while Directory Settings and Load Mod Project make fresh API calls.
- **Suggested commit title:** `fix(projects): bind restored Studio sessions and browse both mod roots`.

## AAR

- **Trigger already fired:** prior installed validation accepted retained pixels as fresh-backend proof. Close must bank a stronger host proof requiring a fresh API-dependent action and port/origin agreement.
- **Tool trigger:** the first selftest run used unsupported top-level await under the CommonJS tsx output; the durable workaround is an explicit async `main`.
