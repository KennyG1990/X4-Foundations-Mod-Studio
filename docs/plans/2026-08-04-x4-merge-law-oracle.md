# X4 Engine Merge-Law Evidence Harness

Status: VERIFIED
Lane: FULL
Date: 2026-08-04
Owner: GitHub #11, W7

## PLAN

- **Bounded unit:** add a deterministic, read-only evidence harness that stages controlled X4 test extensions,
  fingerprints every input, parses the resulting engine log markers, and produces a machine-readable verdict for
  selector cardinality, `add` / `replace` / `remove`, attribute edits, `if`, `silent`, `pos`, and dependency-ordered
  nested patch behavior.
- **Why this unit is first:** Forge already has a pure XML diff simulator and an official-DLC reference overlay, but
  their merge semantics are implementation assumptions. The Effective Tree, provenance, conflict-winner, migration,
  and rebase work may not claim engine authority until those assumptions are compared with current X4 behavior.
- **Assumptions and unresolved facts:** current X4 may require an operator-visible game start or extension-enable
  interaction before evidence appears; whether a no-match non-silent operation emits a stable log signature remains
  unproven; no simulator behavior will be changed from an unexecuted fixture.
- **Authoritative references:** the current W7 X4 9.00 runtime receipt is the authority for actual engine behavior;
  X4's installed schemas, configured game installation, and current unpacked corpus provide executable/reference
  evidence; the official Egosoft [General XML guide](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/#HGeneralXML)
  and [XML Patch Guide](https://forum.egosoft.com/viewtopic.php?t=354310) provide specification/grounding for XML
  terminology and patch guidance only; `src/lib/diffSimulator.ts`; `src/lib/referenceOverlay.ts`; the W7 acceptance
  contract in `docs/plans/2026-08-02-pending-feature-implementation-program.md`; StarForge decisions and capability
  map.
- **In scope:** versioned evidence types; deterministic fixture content; explicit-root staging; SHA-256 manifest;
  engine-log marker parser; stale, partial, mismatched, or ambiguous evidence refusal; cleanup limited to
  harness-owned fixture directories; focused selftests and a documented execution procedure.
- **Out of scope:** changing the diff simulator; claiming Effective Tree authority; scanning or modifying a real mod;
  automatic Steam/game launch; user-facing panels; source-writing rebase; network access; marketplace release.
- **Affected surfaces:** new standalone harness modules/scripts and fixture assets, one package script, this plan,
  evidence under `test-results/x4-merge-law-oracle/`, existing `src/lib/schemaRouting.ts` and
  `src/server/projectValidation.ts` owners, `scripts/project-validation-diff-routing.selftest.ts`, and
  packaged/installed schema, corpus, and validator proof.
- **Risks and authorization boundaries:** staging can write to an X4 extensions directory only when the caller gives
  that exact root. The harness must refuse traversal, links, existing non-owned directories, broad roots, and cleanup
  without its own ownership marker. It must never alter saves, profiles, existing extensions, or the configured mod
  workspace. Game execution evidence is read-only after staging.
- **Rollback/checkpoint:** remove only the unique fixture directories carrying the exact harness ownership marker;
  code rollback is deletion of the new bounded files plus the exact package-script entry. Preserve every unrelated
  dirty path.

### Acceptance criteria

1. A versioned fixture manifest records fixture version, every staged relative path and SHA-256, dependency order,
   expected marker set, target game/build identity fields, and the exact evidence-log fingerprint.
2. Staging is deterministic and refuses traversal, symlink/reparse-point escape, broad/unsafe roots, existing
   non-owned targets, hash drift, or partial writes. Re-staging identical owned bytes is idempotent.
3. Cleanup deletes only exact manifest-owned fixture directories after verifying the ownership marker and hashes;
   changed or foreign content causes refusal.
4. The parser accepts only a complete, single-run marker sequence for the current fixture hash and reports each
   merge-law case independently. Missing, duplicate, stale, malformed, wrong-hash, or mixed-run evidence is red.
5. Focused tests cover every positive case plus path escape, foreign-target, changed-file cleanup, stale log,
   partial log, duplicate marker, wrong fixture hash, and unexpected marker negatives.
6. A real X4 run records game/build identity, fixture hash, log hash, timestamps, and per-case observations. Until
   this method passes, the unit remains PARTIAL and no downstream engine-authority claim is unlocked.
7. Repository and GitHub text names only the native Forge feature and its behavior.

### Required validation

- Focused harness selftest with deterministic temporary roots.
- `npm run typecheck` and the new package-script selftest.
- `node scripts/oracle-sweep.mjs`, route integration, build, and `npm run precommit:check` when the final diff is
  ready for a checkpoint.
- Real X4 execution and log readback for final W7 verification.
- Negative proof that staging and cleanup leave existing extension directories, saves, profiles, configured
  workspace, live ports, and unrelated worktree files unchanged.

### Evidence locations

- Focused and runtime JSON: `test-results/x4-merge-law-oracle/`.
- Durable task close: this file, `ROADMAP.md` after VERIFIED, `SESSION-HANDOFF.md`, capability-map delta, and GitHub
  #11 / parent ledgers.

## BASELINE

- Revision: `a97e21865143b754b60358865954d558dfb8d72d`; local `main` and `origin/main` matched at task start.
- Existing implementation: `simulateXmlDiff` applies all nodes in a selected snapshot and emits warnings for zero or
  multiple matches; `resolveEffectiveReferenceDocument` composes base plus official DLC diff files and treats a
  non-diff overlay as a full replacement. Neither behavior has current-game oracle evidence.
- Existing dirty paths are recorded in `SESSION-HANDOFF.md` and remain outside this unit.
- Baseline runtime evidence: none for this fixture; therefore the starting status is SPECIFIED, not VERIFIED.

## RECONCILE

- Reuse `simulateXmlDiff` only as the implementation-under-test; do not create a second production merge engine.
- Reuse existing hash, containment, atomic-write, and result-envelope conventions where their contracts fit.
- Keep the harness standalone so unproven engine assumptions cannot enter server validation or the installed product.
- The full capability inventory was checked against current Forge owners. This unit adds only the missing engine
  evidence boundary; no capability-map claim changes until a real X4 verdict exists.
- The user-reported schema-loading failure and route evidence expanded scope to this bounded existing-owner
  correction, with focused route/schema tests plus packaged/installed extension acceptance; no new UI or second merge
  engine was added.

## IMPLEMENT

- Implemented the bounded, read-only native X4 evidence harness in the existing Forge
  validation boundary:
  - `src/lib/x4MergeLawOracle.ts` defines the versioned manifest, marker, case, hash, and
    evidence-result contracts and enforces run/hash/completeness rules.
  - `src/lib/x4MergeLawOracleFixture.ts` builds the deterministic base/middle/top fixture,
    dependency order, expected marker set, and probe values.
  - `src/server/x4MergeLawOracleFs.ts` owns explicit-root transactional staging, exact
    readback, containment/reparse/foreign-target/hash refusal, ownership-marker checks, and
    bounded cleanup.
  - `src/server/x4MergeLawOracleEvidence.ts` owns bounded debuglog parsing and the
    single-run, complete-marker, per-case verdict receipt.
  - `scripts/x4-merge-law-oracle*.selftest.ts` and `package.json` add the focused harness,
    fixture, filesystem, and evidence selftests under `test:x4-merge-law-oracle`.
- Reconciled validation routes diff-rooted MD/AI through the merged diff-plus-domain schemas
  and skips those inputs in dedicated validators; no second production merge engine was added.
- The real run staged only the three harness-owned fixture extensions under the explicit X4
  extensions root. No real user mod, save, profile, or configured workspace content was
  intentionally modified.

## VALIDATE

- **Native X4 receipt:** `test-results/x4-merge-law-oracle/w7_20260805_a97e2186_03/` records
  X4 9.00 build `611726` / Steam `23660954`, run
  `w7_20260805_a97e2186_03`, fixture SHA-256
  `d513a73c0f574c25b9c53a2ca3e031b882347809678211343418158b5d6a7662`, manifest SHA-256
  `08c01605297d2c812365e3fe01d7649b800fe78f0e72c17b378f53f2987fe2c0`, and debuglog
  SHA-256 `c3700eaed32764a000212778834c85bfebbe0f52bde99711a118a907a5548572`.
- The runtime receipt is green: `11/11` markers and `9/9` semantic cases passed. The
  ambiguous-selector and control diagnostics each occurred exactly once; the silent probe
  produced zero diagnostics. The receipt's silent-case detail retains its bounded-probe
  wording, while the runtime review accepts the observed absence as green.
- Focused repository evidence is green: `898` harness assertions; schema `143/143`; ordered
  particle `544/544`; merged official diff overlay `60/60` targets across `176` official
  diff files; routes `443/443`; oracle `131/131`; precommit OK; full E2E `96/96`; and
  packaged sidecar probe `16/16`.
- Installed proof is present for VSIX
  `vscode-extension/x4-forge-studio-0.0.63-w7-merge-law-schema-routing-20260806.vsix`,
  SHA-256 `db72aeaa3dedc6192992c11ff52d04f3edc8ad9a6e0e53b441930f8d2f6491f3`. The
  installed Antigravity schema/corpus/validator screenshots are in
  `vscode-extension/evidence/2026-08-06-w7-schema-routing-installed/`
  (`antigravity-installed-corpus-loaded.jpg` and
  `antigravity-installed-validator-results.jpg`); the installed readback contains no
  `Failed to fetch`.
- Negative and preservation evidence passed: cleanup receipt reports `fixtureEntryCountAfter: 0`
  and graceful X4 exit; extension inventory hash before and after is
  `e6f144b384ea73836e36b8b90ae1bdd38ddcb6a384ba2570b627bc8a3ecbc210`; autosave and live
  content hashes are unchanged; the only live-profile difference is the recorded volatile
  `steam_autocloud.vdf` timestamp touch. The isolated profile was quarantined recoverably.
- Genuine user-mod findings remain visible in the captured log and are not counted as W7
  harness defects: existing `extensions\sn_mod_support_apis\...` and
  `extensions\x4_ai_influence\...` files emitted signature-verification diagnostics
  (error 14), and `extensions\x4_ai_influence\md\ai_influence_conversation.xml(98)`
  emitted the schema diagnostic that neither `actor` nor `template` is present. The log also
  contains that mod's `[=ERROR=]` UI/status lines. W7's harness error count is `0`; no causal
  claim is made that these user-mod findings were introduced by the fixture.

## REVIEW

- Acceptance review is complete:
  - Versioned manifest fields, dependency order, expected markers, target identity, and all
    staged-file hashes are recorded and bound to the fixture and log hashes.
  - Deterministic staging/readback and the refusal matrix passed in the focused filesystem
    selftests; cleanup required the exact ownership marker and left zero fixture entries.
  - The parser accepted one complete run only and rejected the covered stale, partial,
    duplicate, wrong-hash, malformed, and unexpected-marker negatives.
  - The real X4 run independently confirmed selector cardinality, `add`, `replace`, `remove`,
    attribute edits, `if`, `silent`, `pos`, and dependency-ordered nested patch behavior.
  - Installed schema/corpus/validator proof is recorded separately from source and package
    checks. The user-mod diagnostics and the one volatile Steam metadata touch are disclosed
    rather than folded into a false-clean runtime claim.
- Review found no missed W7 acceptance item and no required correction. Downstream engine-
  authority work may consume this W7 result; this close does not claim W8/W9 or later units are
  complete.

## CLOSE

- Status: VERIFIED.
- Closed from run `w7_20260805_a97e2186_03` after the native X4, focused, negative-path,
  repository, E2E, packaged, and installed gates above passed.
- Capability-map, AAR, ROADMAP, and SESSION-HANDOFF ledgers are now updated. GitHub markers, staging, commit, push, and remote parity remain coordinator-pending.
  outside this worker's sole owned path and were not performed. Unrelated dirty files and all
  Git state remain untouched.
- Rollback is limited to restoring this plan's prior close text; the fixture roots were already
  removed and the isolated profile remains in its recoverable quarantine receipt.
- Suggested commit title for the coordinator: `test(x4): prove native XML merge behavior against engine`

## AAR

- Trigger: this was a full-lane close requiring current engine, package/install, negative-path,
  and preservation evidence; the captured runtime also exposed genuine user-mod diagnostics
  and one volatile Steam metadata touch that had to remain distinct from the W7 verdict.
- Sustain: hash-bound fixtures, run-scoped markers, deterministic refusal tests, and separate
  runtime/preservation receipts prevent a noisy debuglog from becoming an unbounded authority
  claim.
- Improve work/approach: keep engine semantic verdicts, host diagnostics, and user-mod
  findings in separate classifications; retain the downstream authority gate until the native
  receipt is complete.
- Improve tools: make the silent-case receipt state explicit so its accepted zero-diagnostic
  result does not retain ambiguous pending-probe wording.
- Highest-risk evidenced weakness: the live X4 debuglog is noisy and uses `[=ERROR=]` for both
  genuine user-mod diagnostics and informational UI/status output; naive whole-log error
  counting could falsely fail or falsely certify W7.
