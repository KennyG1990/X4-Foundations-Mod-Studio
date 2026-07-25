# Locked-root deployment fallback implementation plan

> **For Agent:** REQUIRED SUB-SKILL: use `planning` or `brainstorming` if context is missing.

Task: B83 locked deployed-mod root fallback
Lane: FULL
Status: SPECIFIED

## PLAN

- **Goal:** Let Forge deploy a verified artifact when Windows refuses to rename the deployed mod root,
  without weakening rollback, preservation, containment, or byte-verification guarantees.
- **Architecture:** Keep `replaceValidatedDeployment`'s sibling-stage atomic root swap as the primary path.
  On only `EBUSY`/`EPERM` from the initial target→backup rename, create the sibling backup by verified copy,
  reconcile the existing target tree to the sibling stage, verify expected bytes, and restore from backup
  on failure. The target directory itself is never deleted or renamed in fallback mode.
- **Existing infrastructure reused:** `copyRegularTree`, `verifyExpectedFiles`, `preservedDeploymentPaths`,
  `replaceValidatedDeployment`, artifact plans, catalog materialization, and `runCompileArtifactSelftest`.
- **ADR reconciliation:** ADR-F4 requires sibling stage/backup rollback and reopened/hash-verified activation.
  The fallback retains those artifacts and verification; only root-level rename atomicity is unavailable when
  Windows has already made that operation impossible. It fails closed if file-level mutation is also locked.

## ACCEPTANCE CONTRACT

- Normal deployments retain the current rename-based atomic fast path.
- Only `EBUSY` and `EPERM` on the initial existing-root rename enter fallback; other errors propagate.
- Fallback produces exactly the staged inventory plus preserved runtime-owned/`.forgekeep` content.
- Fallback verifies size and SHA-256 after writing.
- Any injected apply/verify failure restores the pre-deploy tree byte-for-byte.
- Stage and backup siblings are removed after success or successful rollback.
- No real game, mod workspace, standing config, or deployed extension is used during implementation tests.
- Existing source checkout and unrelated PNG changes remain untouched.

## RISKS AND RECOVERY

- **Non-atomic window:** fallback necessarily updates files inside the existing directory. Mitigation: it is
  lock-error-only, uses a complete sibling stage and backup, verifies afterward, and restores on failure.
- **File-level lock:** copying/deleting a locked file may fail. Forge reports failure and attempts rollback;
  it never reports deployment success without full verification.
- **Large mods:** a full fallback backup adds disk I/O but avoids memory buffering and preserves arbitrary
  file sizes/types. The normal path is unchanged.
- **Rollback:** revert only the B83 code/test/doc delta; the existing atomic swap remains the baseline.

## IMPLEMENTATION TASKS

### Task 1: Testable deployment transaction seams

**Files:** `server.ts`

1. Add narrow internal operation hooks/options used only by the selftest to inject root-rename and apply failures.
2. Add helpers to enumerate regular-tree paths, remove target entries absent from a desired tree, synchronize
   files/directories without replacing the root, and compare whole-tree fingerprints for rollback proof.
3. Reject symbolic links/reparse points consistently with `copyRegularTree`.

### Task 2: Red fallback and rollback fixtures

**Files:** `server.ts` (`runCompileArtifactSelftest`)

1. Add an injected `EBUSY` fixture and require successful catalog deployment, preserved runtime state, stale-file
   removal, expected hashes, no root rename, and no orphan transaction directories.
2. Add injected mid-apply/verification failure and require exact original-tree restoration.
3. Add injected non-lock rename error and require no fallback or mutation.
4. Run the focused compile-artifact selftest and prove the new rows fail before implementation.

### Task 3: Implement lock-only in-place fallback

**Files:** `server.ts`

1. Attempt the existing rename fast path unchanged.
2. On `EBUSY`/`EPERM`, copy target→backup, synchronize stage→target, verify, then remove stage/backup.
3. On failure, synchronize backup→target and verify rollback fingerprint before rethrowing.
4. Preserve the original error and append explicit rollback failure evidence if restoration fails.

### Task 4: Validation and review

1. Focused artifact selftest, route integration, oracle sweep, typecheck, lint, precommit, production build.
2. Full e2e only after confirming X4 is closed and the machine is quiet; verify workspace guard restoration.
3. Fresh-eyes review against ADR-F4, arbitrary-file ownership, negative paths, and orphan cleanup.
4. Update capability map, ROADMAP, SESSION-HANDOFF, project/general AAR, and mark B83 VERIFIED only with evidence.
5. If shipped product bytes changed, follow the authorized release method only after explicit publication authority.

## EVIDENCE LOCATIONS

- Focused selftest output: compile artifact selftest response/oracle log.
- Regression output: route/oracle/e2e/build/precommit logs summarized in this plan and ROADMAP.
- Source evidence: `server.ts` B83 transaction helpers and injected failure fixtures.

## VALIDATION CHECKPOINT — 2026-07-25

- **Status:** `PARTIAL` — implementation and every non-invasive gate are green; full e2e is paused by the
  machine-state gate because Antigravity currently has an active `extensions (Workspace) - Antigravity IDE -
  X4 Forge Studio` window. B83 remains in `BACKLOG.md` and is not eligible for a verified close yet.
- `npm run typecheck` -> PASS.
- `npm run test:oracles` -> PASS, 102/102; artifact transaction selftest 29/29.
- `npm run test:routes` -> PASS, 71/71; public artifact selftest proves both lock codes, exact rollback,
  incomplete-backup rejection, non-lock rejection, and cleanup.
- `npm run lint` -> PASS at established baseline, 0 errors / 438 warnings.
- `npm run precommit:check` -> PASS; tripwires 0 hits, canon mirrors identical, e2e-verdict selftest 10/10,
  product-copy guard PASS, typecheck PASS.
- `npm run build` -> PASS; Vite production client and bundled `dist/server.cjs` produced.
- Extension `stage-app` -> PASS; native binding present and secret/runtime-state exclusion checks passed.
- Extension controller build -> PASS.
- Local VSIX package -> PASS, 2,091 files / 16.99 MB. This is an unpublished 0.0.40 validation artifact;
  no release version was bumped and no publication or installation occurred.
- Fresh-eyes manual review -> PASS: atomic fast path unchanged; fallback limited to initial `EBUSY`/`EPERM`;
  corrupt backup never becomes a restore source; verified backup restores exact pre-deploy fingerprint after
  target mutation; file-level failures remain fail-closed.
- Supplementary `reviewctl` TypeScript/MJS scan -> 0 findings. Its documented C: path was stale; the installed
  F: copy was used after discovery. This scan is supplementary, not a substitute for behavioral tests.
- `git diff --check` -> PASS with only existing LF/CRLF conversion notices.

## REVIEW CHECKPOINT

- **Done and evidenced:** normal-path preservation, EBUSY and EPERM fallback, exact stale removal, runtime
  preservation, hash/tree verification, incomplete-backup rejection, exact rollback, non-lock rejection,
  transaction cleanup, type/static/integration/oracle/build/package layers.
- **Pending:** full e2e plus post-run workspace-guard restoration after the active Forge surface is released.
- **Out of scope:** identifying the external process that owns the Windows directory handle. The lock holder
  remains `[HYPOTHESIS]`; the root-rename failure and Forge's previous lack of fallback are `[REPRODUCED]`.
- **Capability-map delta:** deferred until `VERIFIED`; do not advertise the fallback before the final gate.

## AAR CHECKPOINT

- **Triggers:** the live deploy failure required a fallback design; the first intentionally red fixture passed
  only after implementation; fresh-eyes review found and closed the partial-backup rollback hazard; the devgov
  skill's documented path was stale and the first broad discovery command timed out.
- **Sustain:** deterministic injected filesystem errors proved the transaction independently of an unstable
  process lock; whole-tree fingerprints made rollback correctness measurable.
- **Improve work/approach:** machine state should be checked before starting the full e2e batch, not after all
  other gates, so the final proof window can be scheduled earlier.
- **Improve tools:** update the stale devgov C: path separately; do not change external tool documentation as
  scope creep inside B83.
- **Highest-risk evidenced weakness:** the fallback is intentionally non-atomic while updating an existing
  root. Its bounded mitigations are verified sibling backup, exact synchronization, reopened hash/tree
  verification, and exact rollback; full e2e remains required before close.
