# B110 R6 — Diagnostic Guidance And Guarded Exact Suppression

Task: Kimi R6 self-explaining diagnostics
Lane: FULL
Status: VERIFIED

## PLAN

- **Bounded unit:** make each full-project diagnostic explain its deterministic cause, impact, and next action in
  the Diagnostics Center, and let a maintainer add one exact reviewed warning suppression to root
  `forge.rules.json` through a guarded confirmation flow.
- **Assumptions:** R1/R16's strict `forge.rules.json` v1 contract remains authoritative. “One click” means one
  visible action that opens a prefilled review confirmation; it does not mean an unreviewed background write.
- **Authoritative references:** `docs/PROJECT_RULES.md`, `docs/schemas/forge.rules.schema.v1.json`,
  `src/lib/projectRules.ts`, `src/server/projectValidation.ts`, the existing `/api/agent/explain` contract,
  `writeWorkspaceFileGuarded`, `F:\StarForge\wiki\x4-forge\decisions.md`, and the capability map.
- **In scope:** deterministic diagnostic guidance; an additive diagnostic mode on `/api/agent/explain`; exact
  suppression eligibility/provenance in the shared diagnostic response; read-only suppression preparation;
  reviewed confirmation; compare-and-swap write; automatic revalidation; package-diagnostics UI and tests.
- **Out of scope:** AI-authored explanations; auto-fixing source; suppressing errors, unavailable-validator warnings,
  Mod Doctor-only warnings, glob/code-only suppression, editing a live X4 extension, changing the rules schema, or
  Steam/Nexus packaging.
- **Risks and authorization boundaries:** a suppression can hide future signal if its scope or review metadata is
  wrong. Mutation is limited to root `forge.rules.json` inside an imported source folder under the configured
  isolated Mod Workspace. The live extensions/game roots are rejected. Validation uses temporary fixtures only.
- **Rollback/checkpoint:** baseline is `2af6a1336c4655570666eb78dad6cbe36716990b`; changes are additive and can be
  reverted by removing the new route/helper/UI. A failed compare-and-swap writes zero bytes.
- **Acceptance criteria:**
  1. Every package diagnostic exposes a deterministic Why view with code, cause, impact, and next action; unknown
     codes degrade honestly to generic guidance rather than inventing game behavior.
  2. Only an active full-project warning carrying an exact validator-owned suppression scope offers Suppress.
  3. The confirmation requires a valid rule ID, owner, meaningful reason, and bounded review date and previews the
     exact code/file/source scope.
  4. The server re-proves the warning against current validation, parses the existing rules file, validates the
     appended document, checks the reviewed byte hash, and atomically writes only the exact root rules file.
  5. Errors, incomplete scope, stale hashes, invalid/expired metadata, malformed existing rules, source outside the
     Mod Workspace, and warnings no longer present are rejected with zero-byte mutation.
  6. Success automatically reruns full-project validation and the warning disappears with suppression provenance
     retained by the shared validation engine.
- **Required validation:** diagnostic/rules pure selftests; focused API fixture covering create/update/stale/error/
  traversal-or-live-root rejection; typecheck; lint; route matrix; oracle sweep; full E2E; production build;
  precommit; graph update; installed Antigravity/VS Code rendered interaction with screenshot if this unit ships in
  the extension.
- **Negative path:** attempt to suppress an error and attempt a stale-hash update; both must return a non-success
  status and preserve the exact pre-attempt bytes.
- **Evidence locations:** command output in the task close; UI screenshots under `vscode-extension/evidence/` if
  released; public exact-SHA Quality run; durable close in this file, ROADMAP, Kimi ledger, capability map, AAR,
  and `SESSION-HANDOFF.md`.

## BASELINE

- **Revision/version:** `HEAD == origin/main == 2af6a1336c4655570666eb78dad6cbe36716990b`; extension `0.0.59`.
- **Existing changes:** preserve the two modified `vscode-extension/evidence/0.0.35-*.png` files and untracked
  `Note for Kimi.md` / `scripts/x4_muds_game.mjs`; none belong to R6.
- **Existing failures/runtime state:** no baseline product failure recorded. Three exploratory PowerShell/`rg`
  commands returned exit 1 because of quoting or a nonexistent optional filename; these are tooling failures and
  trigger a non-clean AAR. Machine was confirmed quiet. No E2E stack or real mod is active for this unit.
- **Re-baseline after operator pause:** concurrent, unrelated Discord work advanced clean `main == origin/main` to
  `99cf4e48a9ca84af844b681036ef26514c5557eb`. The R6 diff remained intact and separable. The two pre-existing
  0.0.35 evidence images and `Note for Kimi.md` remain user-owned and are excluded from the R6 close.

## RECONCILE

- **Resources/readers/writers searched:** `DiagnosticsCenter` -> `PackageModDoctor` renders the active flat list;
  `App` obtains it from `/api/agent/compile`; `runFullWorkspaceValidation` merges Mod Doctor and flattened project
  findings; `flattenProjectValidation` is the only suppression boundary; `/api/fs/write` owns path containment,
  strict byte validation, atomic write, and optional CAS; `/api/agent/explain` currently explains a workspace graph.
- **Existing capability reused:** the verified R1/R16 parser/evaluator, full-project validation chokepoint,
  configured-root role guard, atomic writer, source stamp, and existing Explain endpoint.
- **Couplings checked:** validator flat finding -> server diagnostic -> React type -> Diagnostics Center; imported
  source folder -> configured Mod Workspace -> root rules file; write -> compile effect -> automatic revalidation;
  API explanation mode -> local deterministic helper.
- **Presence/absence:** exact warning suppressions and CAS writes exist. Diagnostic-specific guidance,
  validator-owned suppression eligibility, preparation/confirmation, and safe rules-file mutation do not exist in
  the searched `src`, `server.ts`, `tests`, and `scripts` boundaries.
- **Capability-map delta:** required on close for the new diagnostic-guidance and guarded rules-mutation contract.
- **Plan changes:** reconciliation rejected direct use of generic `/api/fs/write` from the component because it
  would duplicate policy and permit race-prone client-side JSON edits. It also rejected offering Suppress on every
  warning because only flattened project warnings pass through the R1 suppression engine.

## DESIGN

Three designs were compared. A UI-only helper plus generic filesystem read/write is smallest, but the browser would
own JSON merging, eligibility, and race handling. Opening `forge.rules.json` in the native editor is safest, but it
does not satisfy the guided one-action workflow. The selected design is a dedicated prepare/commit contract over the
existing rules engine and guarded writer. Prepare is read-only: it resolves the imported source under the configured
Mod Workspace, re-proves the exact active warning, reads and validates current rules, and returns an exact preview
plus the current hash. Commit accepts reviewed metadata and that hash, repeats every proof, validates the complete
candidate rules document, then atomically writes. This is deliberately not a generic rule editor.

The UI keeps explanation local and deterministic for immediate response, while `/api/agent/explain` gains the same
diagnostic mode so agents and other clients receive identical semantics. Each finding has a Why toggle. Only server-
marked suppressible warnings show Suppress; the dialog explains that suppression acknowledges a warning rather than
fixing it, exposes the exact scope, requires owner/reason/review date, and names the target file. Successful commit
requests a fresh compile rather than optimistically deleting the row. Failure remains visible in the dialog with the
server's stable code, so users can distinguish invalid metadata, unsafe source, stale file, and no-longer-current
diagnostic.

## IMPLEMENT

- Added `src/lib/diagnosticExplain.ts`: one deterministic cause/impact/next-action contract shared by the rendered
  UI and `/api/agent/explain`, with explicit generic fallback for unknown codes and an 8-check selftest.
- Full-project diagnostics now carry validator-owned exact warning suppression scope. Every package finding renders
  `Why?`; only active exact suppressible warnings render `Suppress warning`.
- Added read-only prepare and guarded commit routes. Both re-run the full referee, require an imported source inside
  the configured isolated Mod Workspace, reject symlink/traversal/live-root targets, validate the existing and
  candidate v1 rules document, compare the prepared and immediate pre-write SHA-256, and use the existing atomic
  guarded writer. Agent-key scope and ledger classification match the read/write boundary.
- Added the reviewed confirmation dialog with exact scope preview, owner/reason/review-date requirements, stable
  error reporting, and automatic full revalidation after a successful write. No client-side JSON merge or generic
  file writer was introduced.
- Corrected the existing Studio shell E2E oracle to wait for authoritative seeded-workspace adoption before
  measuring navigation immutability; this removes a real asynchronous boot race without weakening the assertion.
- Released extension 0.0.60 with updated changelog/release notes and installed-host evidence at
  `vscode-extension/evidence/0.0.60-diagnostic-guidance-antigravity.png`.

## VALIDATE

- `diagnostic-explain-selftest` -> 8/8 PASS.
- project rules -> 20/20 PASS; route integration -> 248/248 PASS; runtime oracle sweep -> 121/121 PASS.
- focused suppression E2E -> 2/2 PASS; focused Studio shell -> final 9/9 PASS with zero retries; decisive full E2E
  -> 48/48 PASS with zero failed, flaky, bad, or quarantined results; ephemeral ports 3100/3101 closed.
- typecheck, zero-error established-warning lint contract, production build, staged packaged-app probe 16/16,
  precommit (including 26/26 verdict-policy selftest), `git diff --check`, and graph refresh all passed.
- VSIX inspector -> PASS: 2,091 entries, 60,279,406 unpacked bytes, 17,877,485 archive bytes; required app,
  controller, supervisor, server, UI, manifest, and native SQLite payloads present; forbidden secrets/maps/runtime
  state/machine paths absent.
- Installed Antigravity -> extension 0.0.60, managed sidecar `:58528`, real Diagnostics Center interaction visibly
  showed full-project warnings/errors, `Why?`, warning-only `Suppress warning`, and expanded deterministic
  cause/impact/next-action guidance. The real DeadAir workspace was read-only; suppression was not opened there.
- Negative paths -> suppressing an error, stale rules hash, unsafe/outside source, malformed rules, invalid review,
  and no-longer-current warning all refused with byte-identical pre/post rules state in isolated fixtures.
- Open VSX -> `x4forge.x4-forge-studio` 0.0.60 published. Cache-busted public API exposed 0.0.60; downloaded public
  VSIX is byte-identical to local: 17,877,485 bytes, SHA-256
  `e356a54b691c2423173f501754916b07859b60512f9b37240cae57035e25f19b`.

## REVIEW

- Requirement 1 -> done/evidenced: every package diagnostic has deterministic guidance; unknown codes are labeled
  as generic shared-fallback guidance rather than invented game semantics.
- Requirement 2 -> done/evidenced: errors and Mod Doctor-only warnings have no suppression action; only exact
  project-referee warning scopes do.
- Requirement 3 -> done/evidenced: exact preview and all reviewed metadata are required and schema-validated.
- Requirements 4-6 -> done/evidenced: current-warning reproof, existing/candidate parse, dual CAS, atomic write,
  automatic revalidation, disappearance from active warnings, and retained suppression provenance.
- Fresh-eyes review found no duplicate validator or writer, no loosened oracle, and no unrelated generated churn.
  The installed real workspace remained read-only. `KNOWN-BUGS.md` needs no delta because Kimi recommendations are
  deliberately owned by the reconciled ledger rather than represented as known defects.

## CLOSE

- Status: VERIFIED
- Remaining risks/deferred work: reviewed suppression intentionally acknowledges rather than repairs a warning;
  review expiry remains the maintainer's obligation. R2 validation delta is the next bounded Kimi unit. No real mod,
  game directory, Steam/Nexus account, or cloud upload was changed.
- Suggested commit title: `feat(diagnostics): explain and safely suppress warnings`

## AAR

- **Triggered:** exploratory shell quoting failures; one full-E2E wrapper timeout with orphan cleanup; a later
  server-death cascade; a genuine seeded-workspace adoption race that first produced one flaky result; one known
  Windows `0xC0000409` worker teardown; an explanation wording oracle miss; successful Antigravity installation
  followed by a V8 CLI teardown fault; Computer Use interruption while Ken was interacting; concurrent unrelated
  commits requiring re-baseline; Open VSX cache lag after a successful publish; and one close-gate invocation of the
  client-only `oracle-sweep.mjs` against a closed port, which produced 120 explicit `fetch failed` rows before the
  server-owning `npm run test:oracles` passed 121/121.
- **Sustain:** validator-owned eligibility, prepare/commit reproof, exact CAS, isolated mutation fixtures, structured
  zero-flake verdicts, installed-host eyes-on proof, and public/local package hash parity.
- **Improve work/approach:** re-baseline immediately after any shared-repo pause and wait on authoritative async
  adoption before taking UI-state hashes. A successful publish-client line is not store proof; query the version API
  and replay the public bytes.
- **Improve tools:** the Antigravity CLI can install successfully and then fail during V8 teardown, so post-install
  version inspection is authoritative. Open VSX's default API response can remain stale briefly; cache-busted,
  version-specific reads avoid a false missing-release conclusion. Use `npm run test:oracles`, not the client-only
  sweep script, when no API server is already running.
- **Highest-risk evidenced weakness:** async boot adoption could let a rendered shell test measure the pre-adoption
  workspace and misclassify navigation as mutation. The bounded fix now waits for the exact seeded workspace hash;
  focused and full zero-retry suites pass.
- **Lessons banked:** project and global AAR ledgers updated with the race and release-verification procedures.
