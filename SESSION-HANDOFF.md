# X4 Forge — Session Handoff

Updated: 2026-07-31

## One-line state

B110-R8/R17 immutable workspace authority is VERIFIED, installed, and public as exact-parity Open VSX 0.0.63;
documentation is closed and the commit/push remains. The next bounded unit is R13 continuous polling consolidation,
then R18, R21, the two Downskies research documents, and the final Kimi audit.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state: normal signed-in Antigravity has X4 Forge Studio 0.0.63 / Forge v1.0.391 installed. The packaged
  managed sidecar stabilized on 127.0.0.1:64554 and bound workspace `ws_f61166c42849c757cf219c37`. No computer-control
  session is active; the host was released immediately after the installed screenshot.
- Eyeball queue: none for R8/R17. R13 may need a real-host status/polling proof only after its deterministic timing
  contracts are green; do not reserve the computer before that exact gate.
- Commit question: prior `origin/main == HEAD == 6c01b90a93a94c2d353641bcb04cc3d746170b5f`. R8/R17 is fully verified and
  public but not yet committed/pushed. Run path-scoped staging, commit, push, and assert remote parity now.

## Verified close just completed

- Product: bounded atomic `WorkspaceRegistry`, immutable IDs, one-time active/parked migration, duplicate-name
  safety, per-record CAS, explicit stateful route policy, tab client IDs, workspace-bound agent keys, and scoped
  history/recovery/readiness/compile/package/extension/MCP authority.
- Machine gates: routes 289/289; oracles 126/126; canvas 4/4; focused same-name two-tab isolation; full E2E 51/51
  with zero failed/flaky/bad/quarantined; typecheck; lint 0 errors / 581 baseline warnings; root/extension builds;
  panel binding 9/9; native bridge checks; MCP 10-tool inventory; Graphify 3,152 nodes / 7,413 edges / 154 communities;
  writer inventory 32 filesystem / 11 host stores / 2 browser outputs / 47 SQLite mutations / 7 transactions;
  staged sidecar 16/16; stable inspector 2,091 entries; final precommit green.
- Installed/public: Antigravity reports `x4forge.x4-forge-studio@0.0.63`; four installed source/bundle hashes match.
  The real host rendered the selector on the packaged sidecar and migrated five records. Open VSX public/local VSIX
  bytes match at 17,907,329 and SHA-256
  `50032222bc22190d25d3314837e52e4370c4059f053d1d9bb6ea087de4da52e5`.
- Evidence: `docs/plans/2026-07-31-workspace-authority.md` and
  `vscode-extension/evidence/2026-07-31-r8-r17/0.0.63-installed-antigravity-workspace-authority.png`.

## Next bounded unit — R13

- Reconcile every continuous timer/subscription owner in App readiness/workspace sync, AgentBridge, Canvas,
  CueViewer, GuidedRail, Playtest, extension/native consumers, and bounded OAuth/device/operation-status workflows.
- Specify one scheduler only for continuous reads. Keep bounded workflows isolated, make ownership explicit, dedupe
  identical reads, compose timeout/backoff, stop on unmount/hidden/offline as designed, and discard stale authority
  epochs. Do not turn OAuth/device polling into a global subscription.
- Acceptance must include fake-clock policy checks plus isolated runtime counts for no duplicate intervals, pause/
  resume, backoff, timeout, unmount cleanup, stale-response refusal, and unchanged bounded workflow behavior.
- After R13: R18 supported installed `forge` CLI; R21 secure opt-in MCP registration/removal decision; then reconcile
  the two authorized Downskies research documents only after all R1-R21 rows are VERIFIED.

## Live hazards and ownership

- Preserve and never stage unrelated user changes: deleted Discord/game files and `railway.json`; modified
  `vscode-extension/evidence/0.0.35-runtime-copy-*.png`; untracked `Note for Kimi.md`; untracked
  `.github/ISSUE_TEMPLATE/bug_report.md` and `feature_request.md`.
- Keep the prior exact public-parity `vscode-extension/x4-forge-studio-0.0.62.vsix` unchanged. The new stable
  `x4-forge-studio-0.0.63.vsix` is the R8/R17 release artifact and normally remains untracked.
- The first 0.0.63 staged probe exited after two checks; a clean isolated rerun passed 16/16 with no retained child.
  Antigravity restored its webview through three parent-owned sidecars; each old instance shut down cleanly and the
  final instance stayed listening. Do not mislabel these retained AAR events as unresolved product failures.
- Cleanup policy refused removal of six task-created intermediate PNG captures in
  `vscode-extension/evidence/2026-07-31-r8-r17/`; only the final named 0.0.63 authority screenshot is staged. The
  other untracked images are inert evidence residue and must not be mistaken for user work or staged later.
- Long gates need retained yielded handles. Root/extension generators sharing `out/` must remain sequential.

## Next command

After the R8/R17 commit/push, start R13 with Graphify plus a resource/caller timer inventory, reconcile the Kimi row
and capability map, then write `docs/plans/2026-07-31-continuous-polling-scheduler.md` as SPECIFIED before code.

## Suggested close commit title

`feat(workspaces): isolate clients with immutable authority`
