# X4 Forge — Session Handoff

Updated: 2026-07-31

## One-line state

B110-R7 and R11/R14 are fully VERIFIED and durably closed; the next bounded unit is R8/R17 explicit immutable
workspace authority under Ken-approved ADR-F5, followed by R13, R18, R21, then the two authorized Downskies research
documents and final Kimi audit.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state: normal signed-in Antigravity is installed/reloaded at X4 Forge Studio 0.0.62 / Forge v1.0.389 with
  managed sidecar on port 50755. No task-owned runtime or computer-control session is active. Computer control was
  released after the exact installed visual gate and must not be reacquired until a later exact visual need.
- Eyeball queue: none for R7 or R11/R14. Future visible R8/R17 behavior must ship with a click-by-click script and
  real-host proof; do not reserve the computer before that exact gate.
- Commit question: R7 plus the R11/R14 installed-proof close is verified and ready for the pre-written commit
  `refactor(persistence): enforce durable writer discipline`; commit/push only task-owned paths and assert
  `origin/main == HEAD`.

## Verified close just completed

- R7 evidence: writer audit 14/14; 31 filesystem, 11 host-store, 2 browser-output, 47 SQLite mutation, 7 transaction,
  14 run, 14 exec, 2 pragma inventory; extension writer 8/8; routes 278/278; oracles 125/125; E2E 50/50 with zero
  failed/flaky/bad/quarantined; staged product 16/16; disposable VSIX inspection 2,091 entries; extension/root builds,
  typecheck, lint 0 errors / 555 baseline warnings, precommit; Graphify 3,106 nodes / 7,272 edges / 146 communities.
- R11/R14 installed proof: public-parity 0.0.62 rendered a real disposable-writer HTTP 409 in normal Antigravity;
  overwrite recovery appeared in Agent History; restore returned exact head `84ecfbdf2bf847a5`; replay failed 409
  `RECOVERY_ALREADY_USED`. Evidence is under `vscode-extension/evidence/0.0.62-installed-antigravity-*`.
- Restoration: disposable port 3000 stopped; temporary `.vscode/settings.json` removed; normal managed sidecar 50755
  and prior DeadAir workspace restored; ports 3100/3101 closed after E2E.

## Next bounded unit — R8/R17

- Ken approved ADR-F5: immutable server-owned workspace identity may supersede ADR-F1's mod-ID-only addressing while
  preserving content-addressed CAS.
- Before implementation: reconcile `F:\StarForge\wiki\x4-forge\decisions.md`, capability map, workspace registry,
  all 23 singleton/stateful routes and callers, client/tab identity, agent-key binding, history/recovery/readiness/
  deploy/project-symbol scope, and legacy-key compatibility. Write ADR-F5 and a Full-lane task record first.
- Intended boundary: explicit `workspaceId` envelope separate from mod ID; registry keyed by workspace ID; no
  singleton fallback for stateful mutation; safe stateless/shared reads may retain compatibility; legacy unbound keys
  must not gain state authority; keys/clients bind to workspace; content CAS remains authoritative.
- After R8/R17: R13 one continuous-read scheduler; R18 supported installed `forge` CLI; R21 secure opt-in MCP
  registration; then reconcile and implement only justified improvements from the two Downskies research documents.

## Live hazards and ownership

- Preserve unrelated user changes and never stage them:
  - modified `vscode-extension/evidence/0.0.35-runtime-copy-live.png`
  - modified `vscode-extension/evidence/0.0.35-runtime-copy-startup.png`
  - untracked `Note for Kimi.md`
  - unrelated deleted Discord/game files currently visible in `git status` (`data/known_fixes.json`,
    `data/trivia_questions.json`, `docs/DISCORD_BOTS_AND_GAMES.md`, `railway.json`, and Discord/game scripts).
- Do not overwrite the public-parity `vscode-extension/x4-forge-studio-0.0.62.vsix`.
- Policy-blocked inert validation residue: `C:\Users\Moshi\AppData\Local\Temp\x4forge-r7-validation.vsix` and one
  disposable visual-fixture directory under `%TEMP%`; neither is installed or referenced by the product.
- Long-running gates need a retained yielded process handle. Extension build and root typecheck must stay sequential.

## Next command

After committing/pushing this verified close: inspect ADR-F1/current decisions and run Graphify queries for
`WorkspaceRegistry`, `applyWorkspaceMutation`, agent keys, and stateful route ownership before writing ADR-F5.

## Suggested close commit title

`refactor(persistence): enforce durable writer discipline`
