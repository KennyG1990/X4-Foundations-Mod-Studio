# Kimi R11/R14 — Explainable Conflicts And Recoverable Destructive Actions

Task: B110-R11/R14 conflict dialog v2 and later undo for destructive workspace/deploy choices
Lane: FULL
Status: PARTIAL — automated and packaged-product gates green; installed 0.0.62 visual check pending

## PLAN

- Bounded unit: replace the terse workspace-conflict card with a bounded file/diff decision surface, make every
  conflict outcome explicit, and add later undo with compare-and-swap protection for destructive workspace
  overwrite and successful deploy. Preserve the existing local Undo checkpoint for import and add it to server
  adoption.
- Assumptions and unresolved facts: imported workspaces may be large, deploy roots may contain native files locked by
  X4, and a recovery can become stale after any later writer. Recovery is therefore bounded, persistent, and
  fail-closed; a transaction rollback is not labeled undo. No real-mod/game recovery drill is authorized.
- Authoritative references: ADR-F1 in `F:\StarForge\wiki\x4-forge\decisions.md`; Kimi ledger R11/R14; existing
  `applyWorkspaceMutation`, `commitActiveWorkspace`, `workspaceContentHash`, `buildWorkspaceFileManifest`,
  `replaceValidatedDeployment`, Agent Action Ledger, local `saveCheckpoint`, atomic state writer, deploy effect
  preview, and capability map.
- In scope:
  1. Real active-workspace `savedAt`/`origin` metadata instead of read-time timestamps.
  2. Deterministic bounded local-vs-server file inventory with added/removed/modified counts and text diff samples.
  3. Conflict UI that names both sides, detection/update times, exact consequences, Cancel/inspect behavior, busy/error
     states, and explicit successful outcomes.
  4. Local Undo checkpoint before adopting server state; preserve the already-existing import checkpoint.
  5. Bounded atomic workspace recovery before a forced overwrite, with restore permitted only when the current head
     still equals the recorded post-overwrite head.
  6. Bounded pre-deploy tree recovery outside the game directory, finalized only after verified deployment, with
     restore permitted only when the deployed tree still equals the recorded post-deploy fingerprint.
  7. Agent History recovery metadata/action wired through the existing Revert surface rather than a parallel log.
- Out of scope: undoing arbitrary external edits; source-control history; cross-device recovery; silent automatic
  conflict resolution; keeping unbounded full deploy copies; changing R8/R17 workspace ownership; touching a real
  extension/game directory during validation.
- Risks and authorization boundaries: recovery stores can consume disk; restoring a deployment writes/deletes inside
  the configured extensions root; stale recovery could overwrite later work; native locks can prevent restoration.
  Caps, age/count pruning, path confinement, regular-file-only snapshots, exact pre/post fingerprints, one-time CAS,
  and fail-closed preparation are required. Validation uses isolated temp roots only. Actual deploy/restore remains an
  explicit user/API action and is not invoked against live data in this task.
- Rollback/checkpoint: code checkpoint `2e209daed399653df55f56f64030c2d442fb1097`; remove the additive conflict/
  recovery module, API fields/routes, UI panel, and recovery metadata directory. Existing transaction rollback and
  local Undo stacks remain intact.
- Acceptance criteria:
  1. A 409 conflict reports real server `savedAt`/`origin`, both heads, deterministic file counts, and bounded text
     diff samples; unchanged/file-order/slash-case equivalents produce no false change.
  2. The rendered decision surface states: use server discards local canvas but creates local Undo; overwrite server
     saves a server recovery; cancel writes nothing. It shows success/failure instead of disappearing ambiguously.
  3. Adopt-server and project import can be reversed through local Undo without changing the selected server bytes.
  4. Forced overwrite cannot begin unless a bounded atomic recovery is durable. Restore succeeds only at the exact
     recorded after-head, returns the prior workspace as a new head, and refuses stale/corrupt/expired/replayed state.
  5. Successful deploy exposes a recovery id only after artifact verification. Restore verifies the current target
     fingerprint, restores the exact prior tree (or safely removes a first deploy), and refuses stale/path-escape/
     corrupt/over-cap/unavailable/locked recovery without false success.
  6. Failed/dry-run deploy creates no ready recovery. Failed restore preserves the current target or reports any
     rollback failure explicitly; no transaction sibling remains in the isolated extensions root.
  7. Agent History marks only rows carrying a valid recovery as revertible and displays the exact non-revertible
     reason otherwise.
- Required validation and negative path: pure conflict/recovery policy selftests; workspace-state/Agent-History
  regression; isolated route integration for conflict metadata, force recovery/restore/stale/replay/corruption;
  disposable deployment tree round-trip including first-deploy removal and stale/current-tree refusal; focused E2E
  for visible diff/consequence/cancel/adopt/overwrite/Undo; typecheck; lint; oracle sweep; full E2E; production build;
  precommit; graph refresh; package/install proof if user-visible release changes. Negative paths include corrupt
  recovery store, over-cap snapshot, current-head mismatch, target fingerprint mismatch, path escape, locked restore,
  failed deploy, dry run, and a second restore attempt.
- Evidence locations: this record, isolated test output/receipts, `test-results/`, and installed-host evidence under
  `vscode-extension/evidence/` if released.

## BASELINE

- Revision/version: `HEAD == origin/main == 2e209daed399653df55f56f64030c2d442fb1097`; extension 0.0.61.
- Existing changes/failures/runtime state: user-owned modified
  `vscode-extension/evidence/0.0.35-runtime-copy-live.png` and `...startup.png`; user-owned untracked
  `Note for Kimi.md`; Antigravity remains open with the R2 installed host/managed sidecar. No task-owned test stack
  or port is live.

## RECONCILE

- Resources and readers/writers searched: Graphify graph/query; Agent Brain prior B2 conflict record; ADR-F1 and
  capability map; App autosave/poll/adopt/force/import/Undo; workspace POST/GET/chokepoint/persistence/parked states;
  Mod-folder import; deploy preview/transaction/verification; Agent History middleware/store/revert route and UI;
  route/E2E coverage.
- Existing capability reused: expected-head CAS; human-held conflict state; local 40-entry Undo stack; import
  checkpoint; atomic JSON writer; workspace hash; complete file manifest; bounded diff/blob helpers; deploy preview;
  rollback-safe replacement; Agent History revert surface.
- Observed gaps/absence boundary:
  - GET workspace `lastUpdated` is generated on every read, not the last commit time; origin is not returned.
  - 409 returns heads/version only; no per-file or text comparison. Current UI has two tooltip-dependent buttons and
    no Cancel, progress, error, or persistent outcome.
  - Adopt-server skips `saveCheckpoint`; import already calls it.
  - Same-name forced overwrite is not parked and has no bounded history/recovery handle.
  - Deploy backup is intentionally deleted after successful verification; only in-transaction rollback exists.
  - No conflict-specific E2E exists. Search boundary: repo source/scripts/tests/docs plus ADR/capability records.
- Couplings checked: background poll must remain frozen while conflict is pending; autosave queue and lost-response
  equality path; workspace serialization/manifest fidelity; persistent-state watcher ignores; ledger rotation/blobs;
  deploy root/path confinement; locked-root fallback; package/effect/checklist response; AgentBridge Revert UI.
- Extend-versus-replace: extend. The CAS, atomic state, deploy transaction, and history ledger are proven and do not
  have three recurring worst-risk citations in this role. The card presentation and missing recovery chain are gaps,
  not evidence that those authorities should be replaced.
- Capability-map delta: pending close; expected delta is real conflict evidence plus bounded CAS recovery for
  workspace/deploy destructive choices.
- Plan changes from the ledger wording: import is not currently non-undoable in the Studio—it already checkpoints the
  canvas. The task preserves/proves that behavior and corrects the ledger/history language. Deploy undo remains a
  separate post-success recovery; existing rollback is retained and never relabeled.

## IMPLEMENT

- Actual bounded changes:
  - Added deterministic emitted-file conflict comparison (`workspaceConflict.ts`) with Windows path identity,
    changed-file counts, bounded samples, text-size/diff caps, and a pure selftest.
  - Replaced the two-button card with `WorkspaceConflictDialog`: real server/local provenance, both heads, explicit
    consequences, file/text evidence, Cancel/review, progress, failure, and outcome copy. Server adoption now creates
    a local Undo checkpoint; the existing import checkpoint was preserved.
  - Persisted real active-workspace save time/origin. A 409 now returns both real heads plus compiled file evidence.
  - Added a bounded atomic destructive-recovery store: 12 entries, seven-day expiry, 32 MiB workspace and 512 MiB
    prior-deployment caps, regular-tree-only payloads, exact pre/post hashes, pruning, and one-use receipts.
  - Forced workspace overwrites fail before mutation unless their recovery is durable. Agent History exposes the
    recovery only on the matching successful action and restores only at the exact after-head.
  - Verified deploy now captures the exact prior tree before touching the extensions target, returns recovery only
    after all post-write gates pass, rolls failed deploys back exactly, and supports later CAS restore or first-deploy
    removal through the existing History action.
  - Fresh-eyes review moved recovery-receipt finalization inside the rollback-capable transaction boundary. A failed
    consume write now restores the post-action workspace/deployment and reports a combined error if rollback fails.
  - Bumped the installed-product release to stable 0.0.62 with generated plain-language changelog, staged app,
    packaged supervisor, and inspected VSIX.
- Scope changes and reasons: the ledger's import claim was corrected during reconciliation (import already had local
  Undo). Review added receipt-finalization rollback because it was required by acceptance criterion 6. No real mod,
  game directory, or current Antigravity workspace was used for mutation tests.

## VALIDATE

- Method -> result -> evidence:
  - `npm run typecheck` -> PASS.
  - `npm run lint` -> PASS with 0 errors / 555 pre-existing warnings.
  - `npm run test:routes` -> PASS 275/275; real scratch 409 metadata/diff, forced workspace recovery/history
    restore/replay, deploy recovery, failed post-write rollback, first-deploy undo, and production probe.
  - `npm run test:oracles` -> PASS 124/124; workspace-conflict 8/8, destructive-recovery 10/10, artifact pipeline
    52/52 including receipt-finalization rollback fixtures.
  - `npm run build` -> PASS; expected existing large-chunk warning only.
  - `npm run test:e2e` -> PASS 50/50, zero failures/flakes/bad results; receipt
    `test-results/e2e-verdict.json`.
  - `graphify update .` -> PASS; 3,145 nodes / 7,358 edges / 160 communities.
  - 0.0.62 release build -> PASS: staged app, extension build, stable VSIX package (2,091 files; 17,893,929
    bytes), staged-product probe 16/16, VSIX inspection 2,091 entries / 60,352,725 unpacked bytes.
  - Open VSX publish -> VERIFIED public 0.0.62: local/store artifacts both 17,893,929 bytes with SHA-256
    `A1A4776FC7521A5174D50D4DADCF9FDCA59BBC74E3673CEBCCAF3E554E5BF1ED`.
  - Disposable installed Antigravity runtime -> PASS/PARTIAL visual: the exact VSIX installed as
    `x4forge.x4-forge-studio@0.0.62` under isolated user-data/extension roots; Antigravity IDE 1.107.0 loaded
    Forge `v1.0.389` and started its managed sidecar on isolated port 62690. The fresh-profile login overlay
    covered the editor, so this is installed-runtime evidence, not eyes-on rendered-surface evidence. Receipt:
    `vscode-extension/evidence/0.0.62-installed-antigravity-runtime.txt`.
- Negative/rollback result: corrupt/expired/replayed workspace receipt, stale workspace head, stale deploy target,
  corrupt deploy payload, first-deploy removal, failed post-write deploy rollback, locked-root rollback, recovery
  receipt-write rollback, traversal/path-role rejection, dry-run nonpromotion, and no-ready-recovery failure paths pass
  in the isolated selftests/route matrix.
- Visual/live result when applicable: PARTIAL. The normal signed-in Antigravity profile still has the preceding
  0.0.61 (`v1.0.387`), so that observation was correctly rejected as evidence for this change. A disposable
  Antigravity install proved the exact 0.0.62 VSIX and managed sidecar (`v1.0.389`), then fully stopped; its mandatory
  fresh-profile login overlay prevented eyes-on Forge rendering. Normal-profile install/reload and eyes-on 0.0.62
  conflict/History proof remain pending behind the standing-config write gate.

## REVIEW

- Requirement -> done | partial | missed | deferred | out of scope:
  1. Real conflict provenance/diff -> done, machine- and rendered-E2E-evidenced.
  2. Explicit decision surface/outcomes -> done, rendered E2E; installed eyes-on pending.
  3. Adopt/import local Undo -> done; adopt rendered E2E, import existing regression retained.
  4. Workspace durable CAS recovery -> done, isolated route restore/stale/replay/corrupt evidence.
  5. Deploy later recovery -> done, isolated existing/first-deploy/stale/corrupt/locked evidence.
  6. Failed/dry deploy and failed-restore truth -> done, including review-added receipt failure rollback.
  7. Honest Agent History revertibility -> done, selftest/route/E2E evidenced.
  8. Real installed UI -> partial pending 0.0.62 installation and screenshot.
- Fresh-eyes findings: one blocking transaction-boundary defect was found and corrected before close: marking a
  receipt used after the target changed could report failure after mutation. Receipt finalization now executes while
  rollback bytes are retained, with explicit negative fixtures. `reviewctl` was unavailable; manual diff review,
  Graphify blast-radius orientation, compiler/lint, integration, runtime probe, and full E2E supplied the review.

## CLOSE

- Status: PARTIAL
- Remaining risks/deferred work: install public 0.0.62 into Antigravity after explicit approval, capture the real
  conflict/History surface, run precommit, update durable
  ledgers/capability map/handoff, then commit/push. Recovery is intentionally bounded and refuses after later writes;
  it is not source control or arbitrary external-edit undo.
- Suggested commit title: `feat(recovery): explain conflicts and undo destructive actions`

## AAR

- Triggers: Agent Brain broad search timed out after returning the relevant B2 evidence; malformed/broad PowerShell
  searches were narrowed; reconciliation corrected the stale import claim; two E2E launches used an invalid
  one-second wrapper timeout and caused EPIPE; the initial browser fixture repeatedly manufactured conflicts and was
  corrected; one repeat run lost its disposable Vite host; full E2E initially reported a real fixture flake; review
  forced the receipt transaction correction; the first public parity script failed to stop after an indexing 404.
- Sustain: declare the destructive boundary before implementation; reuse CAS/Undo/history/transaction authorities;
  keep real game data out of recovery tests; use the structured zero-flake verdict; inspect a successful-operation
  failure snapshot instead of weakening its timeout; publish only an inspected package.
- Improve work/approach: use correct long-running command timeouts on first launch; model a single external conflict
  in UI fixtures and release mocked server reads after the decision state is established; run receipt finalization
  inside the rollback-capable interval from the first implementation, not after mutation.
- Improve tools: harden `run-e2e.mjs` against parent-pipe EPIPE and make disposable Vite death immediately explicit;
  public parity scripts must set `$ErrorActionPreference='Stop'` before emitting any evidence object.
- Highest-risk evidenced weakness: recovery receipt finalization originally happened after state mutation, allowing
  false-failure reporting on a rare durable-store write error. Fixed with rollback-capable finalization and negative
  deployment fixtures; workspace rollback is explicit and reports a combined failure if restoration also fails.
- Global/project lessons banked: pending durable AAR ledger update at VERIFIED close.
