# Session handoff — B119 second-profile X4 close

Date: 2026-08-28
Project: `F:\DEV_ENV\X4_Forge`
Status: exact deploy-bound implementation, complete host validation, and two-profile real-X4 pipeline proof green;
overall B119 `IN_PROGRESS / PARTIAL`

## Current state

- Current committed baseline before this close is `99e58055b5e66df27a36cb58af697b6bd5da87b4`, equal to `origin/main`.
  Source implementation is `ff1e26f509d81e3b4c87b63eebdc2bfe73afcbe8`. Preserve every unrelated dirty path;
  never broad-stage.
- The unchanged UI-only `pipeline_test` package is exactly four files / `6,338` bytes / regular-tree fingerprint
  `88574c00ce6d9aa5b1dd2686425fae0a8b492df75a04a25bd94d19e82f7d844f`.
- Real X4 9.00 has now accepted that exact package at two drawable profiles: prior `2544x1353`, and current
  `1920x1080` at default UI scale `1`. The second run loaded no save and wrote no save.
- Second-profile evidence is under
  `dev-docs/b119-x4-ui-pipeline-smoke/in-game-20260828/second-profile/`; `runtime-receipt.json` is the compact
  authority and `pixel-measurements.json` records the exact scan predicate and bounds.
- Runtime cleanup is complete: X4 count zero; isolated Forge PID `13840` stopped; ports
  `3000/3001/3100/3101/3300/8713` free; game target absent; extensions count restored `44 -> 43`;
  `config.xml` and `uidata.xml` exactly match their pre-run SHA-256 hashes.
- No native Luna worker was needed for the second-profile gate because no source/test defect was found and no code
  changed. All earlier workers for the implementation unit were already terminal and closed.

## Exact deploy-bound implementation already pushed

- Successful deploys persist and reconstruct the exact regular-tree `deployedFingerprint`; failed deploy evidence
  cannot replace the last exact success.
- The existing global experience-confirmation owner carries an optional X4 UI snapshot. External verification requires
  exact workspace/source identity, deploy timestamp/path/fingerprint, target identity, clean readiness, normalized
  drawable/UI-scale profile, and explicit human confirmation.
- Internal preview/session/paint/canvas receipts remain `gameVerified:false` and `Not verified in game`.
- Fresh-eyes corrections preserve snapshots only while workspace/deploy evidence matches, remove the parent/child
  lifecycle race, and prevent enabled-but-inert confirmation.

## Host validation already green

- Verification owner selftest PASS; runtime adapter `44/44`; SourceEditor matrices PASS; typecheck PASS; bounded lint
  zero errors; Graphify `9,931 / 24,845 / 327` at the implementation checkpoint.
- Route integration `491/491`; runtime-index oracles `134/134`; targeted browser `3/3`; controlled unchanged full e2e
  `104/104`, zero flaky, `treeGone=true`; complete precommit; production build `1,848` modules.
- The initial full e2e remains retained red evidence at `103 + 1 flaky`; it is not relabeled green.
- Writer authority `14/14 + 8/8`; capability audit `12 / 297 / 1 / 11`; action receipts `82 / 56`.

## Second-profile real-X4 proof

- A current-checkout isolated Forge server on `127.0.0.1:3300` used the saved X4 Forge configuration and the real
  unpacked corpus at `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`.
- Dry-run predicted exactly four additions and left the live target absent. Apply produced the exact source/deployed
  fingerprint, confirmed all `6,338` bytes, and passed eleven config/import/source-sync/wellformed/compile/preflight/
  deploy/bytes/doctor/drift/baseline stages.
- Deploy history row `mtd4sixo-1fb619df` bound recovery `deploy-mtd4sfjy-a21c3c86b1b4b4a0`.
- X4 visibly rendered the centered panel. Both buttons responded; the second visibly highlighted; the editbox accepted
  `b119`; deactivation retained it; standard close removed the panel.
- Scoped debuglog counts are zero for view/frame setup refusal, zero-height editbox, nil `onCloseElement`, reserved
  scrollbar, and Lua runtime error. The receipt separately retains one expected loose-file signature diagnostic and
  unrelated SW Interworlds / AI Chat error-marked output; do not call the entire log globally clean.
- Measured first-button fill is `529x23` at `1920x1080` and `665x29` at `2544x1353`; width and height scaling are
  within `0.65%` of the drawable-height ratio, with normalized top placement differing by `0.110` percentage points.
  This is real-X4 scaling evidence, not exact Forge-versus-X4 parity.
- Recovery returned HTTP `200`, restored fingerprint `absent`, and `priorExisted:false`; replay returned
  `409 / RECOVERY_ALREADY_USED`. Exact profile backups were then restored and hash-verified.

## Documentation and external projection

- Repository records updated locally: `BACKLOG.md`, this handoff,
  `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`, and
  `docs/plans/2026-08-28-b119-exact-deploy-confirmation-second-profile.md`.
- StarForge capability-map and project-AAR deltas are updated outside the repository.
- Fresh Google Docs trusted read completed at revision
  `AIroW3566q2IOoh7o5wf5r5fQa_ez2Nku1oUWWpL3pMqPwwwgp6ds8nhN3qSh_CnYlTxZucImzWAHjM2Y_qqTCkcLGqY2pfczqeCKJLMn3aO`
  with no protected controls. Evidence:
  `dev-docs/google-docs-trusted-read/b119-20260828-05-second-profile/`.
- GitHub #41, Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Google Doc
  `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` still show the prior host-close boundary. Update/readback is the next
  exact action after the repository runtime-proof commit is pushed.

## Next exact actions

1. Validate the exact documentation diff, run complete precommit, commit only the four repository records, and push
   with local/tracking/direct-remote parity.
2. Append the commit-backed second-profile milestone to GitHub #41, Notion, and Google Docs; read back each exact
   target. Then record those external IDs/revision in repository docs, commit/push the final projection close, and
   overwrite this handoff with that parity.
3. Continue B119 with dynamic `Helper.scaleX` / `Helper.scaleY` geometry projection and exact Forge-versus-X4
   comparison before claiming renderer parity. Then finish remaining linter/layout brief coverage and reconstruct the
   AI Influence UI from all visually inspected references.
4. Do not publish OpenVSX while B119 is partial. At release quality, reconcile the user-owned extension release edits,
   then build/package/probe/publish/read back before the release commit.

## Triggered AAR hazards

- The first second-profile config patch introduced a four-byte indentation drift. Exact expected-text and hash
  readback caught and corrected it before X4 launched. Profile changes need byte-exact prelaunch and postrestore gates.
- X4 had a live process before it exposed a targetable window; wait and enumerate the real window rather than treating
  the launch helper's early no-window result as a failed game launch.
- Generic `type_text` did not reach X4's direct-input editbox. Observed native key events did; use them for this class
  of widget and inspect after every action.
- The first compact Python image probe used invalid one-line compound-statement syntax. The corrected multiline probe
  produced reproducible pixel bounds; only the corrected result is accepted.
- Highest risk remains live target-tree drift after a persisted human confirmation. The pure classifier refuses known
  source/target/deploy/workspace/profile drift, and two real profiles now close the experience sub-gate, but live
  target-tree recomputation remains open.
