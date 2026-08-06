# X4 Rule Provenance Guidance

Status: VERIFIED (bounded rule-provenance guidance + E2E lifecycle-race repair checkpoint)
Overall W10 status: OPEN / PARTIAL
Task: Governed X4 rule-resolution guidance integration and validation-lifecycle repair
Lane: FULL
Date: 2026-08-06

## PLAN

- **Bounded unit:** integrate the existing governed X4 rule-pack authority into the existing diagnostic
  explanation producer, Why panel, server selftest registry, and diagnostic-suppression E2E path; repair the
  reproduced lifecycle race in the existing E2E termination path; and close the resulting package/install/rendered
  checkpoint. This record closes only that bounded unit.
- **Authority and assumptions:** reuse the existing rule-pack resolver and the existing diagnostic/API/UI contracts.
  The parent plans retain the official schema and guidance references; runtime claims in this record use local
  receipts and installed evidence. No new product, panel, CLI, provider, imported-result surface, or executable
  rule language is authorized.
- **In scope:** deterministic matched, unmatched, unavailable, and ambiguous provenance; API/UI parity; explicit
  evidence and applicability metadata; existing-server selftest registration; the narrow lifecycle-race repair;
  focused validation; isolated E2E; packaged and installed extension proof; and rendered Why-panel proof.
- **Out of scope:** broader rule families, rule updates or deprecation, target-version authority, W3 receipt work,
  overall native-capability-program completion, marketplace publication, version bump, real mod/game writes,
  commit/push, GitHub mutation, and unrelated dirty files.
- **Risks and authorization boundaries:** false applicability, conflicting guidance, API/UI drift, stale package
  bits, process-tree cleanup false reds, installed-host locking, and misleading cross-workspace screenshot
  comparisons. This documentation close performs no product, Git, GitHub, package-install, or game/mod mutation.
- **Rollback/checkpoint:** product and harness rollback remains the bounded source/test rollback owned by the
  implementation checkpoint; documentation rollback is limited to the seven owned documentation paths. The
  pre-repair red receipt is retained as the lifecycle failure checkpoint.

### Acceptance criteria

1. Matched governed guidance overrides generic guidance and exposes pack/rule IDs and versions, pack SHA, evidence
   grade/basis/digest, applicability, and game scope through the shared explanation.
2. Unmatched resolution retains generic fallback; missing or invalid target version remains unavailable and never
   becomes applicable; ambiguous resolution refuses selection and exposes deterministic candidates/refusal.
3. Uppercase `XSD_` matching and the existing `scriptproperty` fallback remain intact. API and Why-panel output
   agree, and the visible explanation states that the result is deterministic and uses no AI.
4. The existing server registry exposes `x4-rule-packs-selftest`; the rule-pack selftest is `32/32`, direct
   diagnostic explanation validation is `16/16`, and the runtime oracle is `132/132`.
5. The termination repair accepts a failed command only after a fresh exact-identity recheck proves `treeGone=true`.
   A remaining owned target or invalid recheck remains fail-closed and preserves the original command failure.
6. The isolated E2E green receipt proves `96/96`, zero failed/flaky cases, `complete=true`, `treeGone=true`,
   `trigger=child-close`, clean ports `3100/3101`, absent root PID, and unchanged live workspace. The red receipt
   remains preserved as reproduced lifecycle-failure evidence.
7. The packaged extension passes build/stage/probe/inspection, the package digest and size are recorded, installed
   extension bits match the staged package, and the installed Why-panel screenshots prove the governed provenance
   and restored validation state. DeadAir and `x4_ai_influence` screenshots remain identified separately.
8. This bounded checkpoint is `VERIFIED`; W10 remains `OPEN / PARTIAL`; the overall extension-native program remains
   `IN_PROGRESS / PARTIAL`; no commit, push, GitHub readback, version bump, or marketplace publication is claimed.

### Required validation and negative paths

- Focused lifecycle tests: executor `9/9`, command `6/6`, async step `10/10`, runner lifecycle `12/12`, and runner
  integration `13/13`.
- Product validation: direct diagnostic explanation `16/16`; rule pack `32/32`; typecheck pass; lint `0` errors /
  `593` warnings; runtime oracles `132/132`; build pass; and Graphify `5,548` nodes / `13,586` edges /
  `222` communities.
- Governance and precommit: candidate manifest SHA
  `d17909cb056dacf32a212660d662f50ba88bb4bc40128ace6100a938c4263fc4` reviewed and atomically promoted; final
  capability audit pass with `11` capabilities, `294` literal routes, `1` dynamic registrar, and `10` aliases;
  contract SHA `d8a820f537dbcbb50bcb8a91c8bd415c221a15940f184e38a817fa4566c1ac8f`; final precommit pass with
  verdict selftest `54/54`, product-copy `7` roots / `0` banned, writer selftest `14/14`, durableWrite `8/8`,
  capability alias pass (`read=5/write=9/deploy=10`), receipt coverage routeCount `82` / surfaceCount `50`, typecheck, size guards, and overall
  `[precommit] OK`.
- E2E negative/containment paths: retain the red receipt
  `test-results/e2e-verdict-96-pass-treegone-red-20260806.json` (`96/96` product passes but
  `complete=false`, `treeGone=false`, `termination-command-failed`); retain the green receipt
  `test-results/e2e-verdict-96-pass-treegone-green-20260806.json`; verify ports, root PID, process ownership, and
  live-workspace containment independently.
- Package/install/render paths: build pass; stage pass; probe `16/16`; package
  `vscode-extension/x4-forge-studio-0.0.63-w10-rule-provenance-20260806.vsix`; SHA-256
  `0c30ee8681b7a7365d1841fc0f1fcf659650dbb4e972bc785d51a57886eca3a9`; `18,073,169` bytes; inspector pass with
  `2,091` entries and `61,307,258` unpacked bytes; installed version `x4forge.x4-forge-studio@0.0.63`, Forge
  build `v1.0.422`, and rendered evidence under
  `vscode-extension/evidence/2026-08-06-w10-rule-provenance-installed/`.
- Documentation-worker checks: `git diff --check` for each owned in-repo path; read-only status and exact diff
  path review; repository search for newly added forbidden external-tool/source names and false overall-completion
  claims. External wiki edits are reported separately because they are outside this Git worktree.
- The package/install evidence does not make a `47`-to-`2` same-mod claim. The old `01-before-old-installed-47-errors.png`
  and current `04`/`05` images are the `x4_ai_influence` workspace; `03-installed-xsd-rule-provenance.png` is the
  separate DeadAir Dynamic Wars workspace. No error-count comparison across those workspaces is valid.

## BASELINE

- **Revision:** baseline commit `5541f7933b7fe54a6a519d95af01eb1b2b645054`.
- **Working state:** the current implementation checkpoint is uncommitted. Commit, push, remote-parity, and
  GitHub readback remain pending after this documentation close. The worktree contains unrelated modified,
  deleted, and untracked paths; this worker preserves them.
- **Pre-repair lifecycle evidence:** the preserved red receipt records product `96/96` but
  `complete=false`, `treeGone=false`, and `termination-command-failed`; the reproduced explanation is a process
  exiting after stable identity recheck and before `taskkill`, with no fresh post-command identity check.
- **Pre-provenance product state:** generic deterministic guidance and the existing rule-pack authority were
  present; the governed provenance fields, ambiguity refusal, server registration, and installed rendered proof
  were not yet recorded as this dependent checkpoint.
- **Installed baseline:** `01-before-old-installed-47-errors.png` is an older installed image of the
  `x4_ai_influence` workspace. It is retained as context only; no claim is made that every earlier error shared one
  cause.

## RECONCILE

- **Resources and readers/writers searched:** the governed rule-pack resolver; diagnostic explanation producer;
  Why panel; server selftest registry; diagnostic-suppression E2E; lifecycle command/executor/runner owners;
  governance manifest and capability audit; extension package/stage/probe/inspect outputs; installed extension
  files; and rendered evidence.
- **Existing capability reused:** the existing rule-pack authority, existing diagnostic currency, existing generic
  fallback, existing server registry, existing E2E ownership and termination contracts, and existing package/install
  path. No parallel resolver, panel, route, package, or lifecycle supervisor was introduced.
- **Couplings checked:** rule resolution to explanation serialization; explanation serialization to Why-panel
  rendering; selftest registration to oracle/precommit counts; command failure to exact identity recheck and final
  `treeGone`; staged package bytes to installed extension files; and screenshot workspace identity to its evidence
  label.
- **Capability-map delta:** one delta is required for the materially new installed deterministic-provenance API/UI
  capability, with explicit ambiguity refusal, unavailable-target, unmatched-fallback, and workspace-boundary
  negatives. No capability-map noise or duplicate capability is added.
- **Plan changes:** the reproduced lifecycle false red added only the bounded exact-identity post-command recheck
  repair. Validation expanded to include the green/red receipts, package/install/render proof, and independent
  containment. The acceptance contract was not relaxed.

## IMPLEMENT

- **Status:** the bounded product and harness checkpoint is implemented and reviewed. This documentation worker
  changes only the owned documentation paths; it does not edit implementation, test, package, evidence, config, or
  Git files.
- **Product behavior:** diagnostic explanations now resolve the existing governed rule pack and expose discriminated
  matched, unmatched, and ambiguous provenance. Matched output includes pack/rule IDs and versions, pack SHA,
  evidence grade/basis/digest, applicability, and game scope. Ambiguity refuses selection and shows candidates;
  missing/invalid target version stays unavailable; uppercase `XSD_` resolves; generic fallback remains; and the
  Why panel renders the same data with `deterministic, no AI`.
- **Server/governance:** `x4-rule-packs-selftest` is registered through the existing registry. The reviewed
  governance candidate was atomically promoted, and the final capability/contract audit is recorded above.
- **Lifecycle repair:** a failed command is accepted only after a fresh exact-identity recheck proves `treeGone=true`.
  Otherwise the original command failure remains red. The red receipt is retained and the green receipt is the
  resulting full isolated lifecycle proof.
- **Extension checkpoint:** the staged package, digest, size, inspector result, installed version/build, installed
  file hash parity, and rendered screenshots are recorded in VALIDATE. No version bump or marketplace publish
  occurred.

## VALIDATE

Product and implementation validation below is reconciled from the supplied settled receipts; this documentation
worker did not rerun the product, package, install, or E2E suites. The worker-level read-only checks are run after
the documentation edits and are recorded separately.

- **Focused behavior:** direct diagnostic explanation `16/16`; rule pack `32/32`; lifecycle executor `9/9`, command
  `6/6`, async step `10/10`, runner lifecycle `12/12`, and runner integration `13/13`.
- **Static/build:** typecheck pass; lint `0` errors / `593` warnings; runtime oracles `132/132`; build pass;
  Graphify `5,548` nodes / `13,586` edges / `222` communities.
- **Governance/precommit:** candidate SHA
  `d17909cb056dacf32a212660d662f50ba88bb4bc40128ace6100a938c4263fc4` reviewed and atomically promoted; final
  capability audit pass (`11` capabilities, `294` literal routes, `1` dynamic registrar, `10` aliases); contract
  SHA `d8a820f537dbcbb50bcb8a91c8bd415c221a15940f184e38a817fa4566c1ac8f`; final precommit pass with verdict
  selftest `54/54`, product-copy `7` roots / `0` banned, writer `14/14`, durableWrite `8/8`, capability alias pass
  (`read=5/write=9/deploy=10`), receipt coverage
  routeCount `82` / surfaceCount `50`, typecheck, size guards, and `[precommit] OK`.
- **E2E green receipt:** `test-results/e2e-verdict-96-pass-treegone-green-20260806.json` records `96/96`, failed
  `0`, flaky `0`, complete report, `complete=true`, `treeGone=true`, `trigger=child-close`, clean ports `3100/3101`,
  absent root PID, and unchanged live workspace.
- **E2E red receipt:** `test-results/e2e-verdict-96-pass-treegone-red-20260806.json` remains the reproduced
  lifecycle failure: product `96/96`, but `complete=false`, `treeGone=false`, and
  `termination-command-failed`. It is not relabeled green.
- **Package/install:** build/stage pass; probe `16/16`; package size/digest and inspector pass as specified; the
  installed extension reports `x4forge.x4-forge-studio@0.0.63` and Forge build `v1.0.422`; installed
  `extension.js`, `server.cjs`, and `index.html` hashes match the staged package (`4A7265...91FD`,
  `156667...29FAD`, and `37EB6D...B50`). No version bump or marketplace publish occurred.
- **Rendered proof:** `03-installed-xsd-rule-provenance.png` shows governed XSD Why provenance on DeadAir Dynamic
  Wars. `04-installed-x4-ai-influence-validation.png` and
  `05-installed-x4-ai-influence-beginner-restored.png` show the actual `x4_ai_influence` workspace with selected
  workspace retained, Beginner mode restored, overlay closed, `Valid · 15 warnings`, and zero blocking errors.
  The old `01-before-old-installed-47-errors.png` is the same `x4_ai_influence` workspace baseline only; no
  cross-workspace comparison or single-cause error claim is made.
- **Negative paths:** ambiguity refuses selection; missing/invalid target versions remain unavailable; unmatched
  codes retain generic fallback; uppercase `XSD_` matching and `scriptproperty` fallback remain intact; a remaining
  target or invalid identity recheck preserves command failure; and the isolated stack leaves the live workspace
  unchanged.
- **Worker checks:** passed. `git diff --check` passed on all owned in-repo documentation paths; read-only
  exact-path status/diff review passed; and the new-prose and false-overall-completion scans passed. The external
  wiki paths are outside the Forge Git worktree and are reported separately.
- **Unavailable gates:** commit, push, remote-parity, and GitHub readback were not run by this worker and remain
  pending. They are not silently treated as passed or as evidence that W10 or the overall program is complete.

## REVIEW

- **Requirements 1-5:** done and evidenced by the direct explanation/rule-pack tests, deterministic API/UI behavior,
  server registration, focused lifecycle tests, and fail-closed race repair.
- **Requirement 6:** done and evidenced by the paired red/green isolated E2E receipts, exact process/port/live-state
  checks, and the independent lifecycle test totals.
- **Requirement 7:** done and evidenced by package/stage/probe/inspection, installed hash parity, and the correctly
  separated DeadAir and `x4_ai_influence` rendered screenshots.
- **Requirement 8:** done for this bounded checkpoint. W10 remains `OPEN / PARTIAL`; the overall extension-native
  program remains `IN_PROGRESS / PARTIAL`; commit/push/GitHub parity and other program gates remain pending.
- **Fresh-eyes review:** no remaining finding was reported. The review specifically retained the red lifecycle receipt,
  rejected false completion from product-only `96/96`, checked package-to-installed hashes, and checked that no
  `47`-to-`2` same-mod claim was introduced.

## CLOSE

- **Status:** `VERIFIED` for this bounded rule-provenance guidance and E2E lifecycle-race repair checkpoint only.
- **What changed:** this record closes the verified diagnostic/API/UI provenance behavior, server selftest
  registration, exact-identity lifecycle repair, full isolated E2E receipt pair, package/install parity, and rendered
  proof described above.
- **What was deliberately not changed by this worker:** implementation source, tests, package contents, evidence
  files, configuration, Git state, GitHub state, marketplace state, and unrelated dirty paths. The worker edited only
  the owned documentation paths listed in the work order.
- **Reconciliation/capability delta:** the existing rule-pack, diagnostic, server, lifecycle, package, and installed
  surfaces were reused; one installed deterministic-provenance API/UI capability delta with negative boundaries is
  recorded in the external capability map.
- **Baseline/rollback:** baseline is commit `5541f7933b7fe54a6a519d95af01eb1b2b645054`, the preserved red receipt,
  and the pre-existing dirty-worktree inventory. Product/harness rollback remains bounded source/test rollback;
  documentation rollback is limited to the owned documentation paths.
- **Remaining program state:** W10 remains `OPEN / PARTIAL`; the overall extension-native program remains
  `IN_PROGRESS / PARTIAL`. Commit/push, remote-parity, and GitHub issue readback remain pending. No version bump,
  marketplace publish, or overall completion is claimed.
- **Suggested commit title:** `feat(validation): surface governed rule provenance in Forge`.

## AAR

- **Outcome:** triggered full-lane AAR. The bounded unit is `VERIFIED`; the following triggers and lessons remain
  recorded rather than hidden: initial full E2E timeout/orphan cleanup; transient sidecar-loss E2E red `13/83`;
  product `96/96` with a lifecycle false-red race; the bounded lifecycle repair; correction of the mistaken
  assumption that per-run OS temp cleanup was a task gate; two EPERM install attempts requiring a full IDE close;
  one corrected PowerShell parser/hash-output issue; first precommit manifest omission; unavailable reviewctl; and
  one corrected coordinator message-serialization failure.
- **Sustain:** keep product verdict, process ownership/termination, package bytes, installed bits, and rendered UI as
  independent proof layers. Reuse the governed rule authority, preserve deterministic API/UI parity, retain generic
  fallback and explicit unavailability, and preserve the reproduced red receipt beside the green receipt.
- **Improve work/approach:** treat a product-green E2E result as insufficient until the terminal report, exact owned
  process tree, `treeGone`, ports, and live-workspace state agree. Treat every screenshot as workspace-labeled evidence;
  never compare the DeadAir image with the `x4_ai_influence` images or infer one cause for the old `47` errors.
- **Improve tools:** perform a fresh exact-identity recheck after command failure; verify staged/package/installed
  hashes independently; close the host before retrying a locked install; use corrected PowerShell hash/parser output;
  rerun the full precommit after manifest repair; and record reviewctl unavailability instead of implying review-tool
  success. Keep coordinator close messages serialization-safe after the one corrected message failure.
- **Commit-hook tool friction:** the first commit wrapper used a `120`-second timeout and expired while the pre-commit
  hook was still running the capability audit. No commit was created; `HEAD` remained
  `5541f7933b7fe54a6a519d95af01eb1b2b645054`; the exact `17`-path index stayed intact with no unrelated path staged;
  and the orphaned hook later exited. The separate final `npm run precommit:check` was already green; rerun the commit
  with sufficient time and do not bypass the hook.
- **Highest-risk evidenced weakness:** lifecycle cleanup and installed-host locking can produce false conclusions
  unless product verdict, process ownership, and installed bits are verified independently. The bounded repair reduces
  the lifecycle race but does not close the broader W10 or program gates.
- **Project AAR:** this bounded entry is appended to `F:\StarForge\wiki\x4-forge\aar-log.md`; no global AAR or
  unrelated project record is changed.
