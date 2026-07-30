# X4 Forge session handoff — 2026-07-29 · ZERO-TO-MOD CODE-GROUNDED BOT INTELLIGENCE VERIFIED

## One-line state

Rebranded public product names to `x4 AiLive` across all public readmes, content manifests, and GitHub workflows. Implemented and verified the Smart Known Issue Builder & Auto-Fix Interceptor engine across both Discord bots (`Forge Concierge#3242` and `X4AILive#2651`) backed by `data/known_fixes.json`, automated frequency tracking, slash commands (`/status`, `/faq`, `/known-fixes`, `/add-fix`), and 15-minute automated bug ingestion (`scripts/ingest_repo_bugs.mjs`). Grounded bot intelligence in 3 exact code-backed zero-to-mod workflows (`FirstRunWizard`, Node Toolbox canvas, `MOD_PATTERNS`). Pushed clean commit `48ebb48` to `origin/main`.

## Active bounded unit

- Goal: reconcile Kimi R1-R21 durably, then complete B109 before executing the remaining recommendation batches.
- Active records: `BACKLOG.md`, `docs/plans/2026-07-29-platform-release-center.md`,
  `docs/plans/2026-07-29-platform-release-center-design.md`, and
  `docs/plans/2026-07-29-kimi-recommendations-ledger.md`.
- B109 Batch 1: complete binary-safe Nexus ZIP, verified Steam CAT/DAT staging and rollback ZIP, official
  WorkshopTool command preparation, explicit-workspace/fresh-source gates, stage codes, post-tool verification,
  scope/history rules, and route assertions.
- B109 Batch 2: separate Nexus/Steam guided UI, normalized persistent Guided/Express preference, report-backed
  export, correlated native file/save requests, rollback-safe receipt-verified native copy, exact WorkshopTool PE
  selection, and visible terminal insertion without Enter.
- Authored but unrun: report-backed export route assertions and `tests/e2e/release-center.spec.ts`.
- Out of scope until B109 closes: remaining Kimi execution batches B110 R1-R21.

## Validation state

- PASS: root `npm run typecheck` after latest Batch 2/test source.
- PASS: root `npm run lint` with zero errors and the repository's existing 548-warning baseline.
- PASS: focused new-file ESLint with zero warnings/errors.
- PASS: release preferences 5/5; mod distribution 31/31; platform release 14/14; agent keys 24/24;
  agent history 67/67; native bridge 36/36.
- PASS: extension source build; route script syntax; `git diff --check` (line-ending notices only).
- PASS: `graphify update .` -> 2,858 nodes / 6,696 edges / 149 communities.
- NOT RUN: isolated `npm run test:routes`, focused Playwright, full e2e, production/extension packaging,
  installed Antigravity, rendered UI, OpenVSX/public release.
- Official WorkshopTool is not installed locally. No Steam/Nexus publication was attempted or authorized.

## Baseline / ownership

- Task began clean at `HEAD == origin/main == 72ec4aa77d2d99a79b308101c7d34b58b5966de2`.
- Every current worktree change is B109/B110-owned; no unrelated user change was found at baseline.
- Do not commit or push until the required runtime/rendered/installed gates are complete and the close is VERIFIED.
- No real game directory, real mod, external account, Steam Workshop item, or Nexus page has been mutated.

## Eyeball queue

Nothing is ready for Ken's eyeball yet because the UI has not been run. After fresh machine-quiet confirmation:

1. Open the isolated Release Center Playwright result and confirm the focused spec is green.
2. Install the newly packaged VSIX in Antigravity, open Studio -> Playtest -> Release Center.
3. Click `Package for Nexus Mods`; inspect the complete guide, stages, and Save As prompt.
4. Click `Prepare for Steam Workshop`; inspect preview/tool pickers, command display, and terminal insertion.
5. Confirm the terminal contains the command but has not executed it; do not press Enter or upload.

## Hot files / next command

- First ask/receive: `Forge, Antigravity, and X4 are idle; machine quiet.`
- Then run `npm run test:routes` and inspect its structured assertions, teardown, ephemeral ports, and live-state
  non-mutation before any Playwright or installed-host work.
- Run the focused Release Center Playwright spec, then the full workflow gates in the documented plan.

## Hazards / dead theories

- User-supplied `PublishTool.exe`/`X4Customizer.exe` guidance is incorrect for current official publishing.
  The reconciled tool is `WorkshopTool.exe` from separate Egosoft X Tools.
- Forge builds/verifies CAT/DAT itself. The emitted command intentionally omits WorkshopTool `-buildcat`.
- Steam publication remains interactive and external; Forge never presses Enter, authenticates, accepts legal
  agreements, or claims upload success before the post-tool `ws_<id>`/payload check.
- Extension build recreates `vscode-extension/out`; serialize it before root typecheck or root TypeScript can
  observe a transient missing `out/extension.js`.
- Authored tests are not proof. Do not relabel B109 VERIFIED until HTTP, browser, packaged, installed, and rendered
  gates actually pass.

## Commit question

No commit point yet. B109 is PARTIAL: source/static work is green, but required machine-gated proof remains.
Suggested close title once genuinely VERIFIED: `feat(release): add guided verified Nexus and Steam packaging`.
