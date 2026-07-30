# Project Validation Rules Implementation Plan

**Goal:** close Kimi R1 and R16 with one versioned, mod-local `forge.rules.json` contract consumed by the
existing shared project validator, without creating a second validation engine or allowing rules to hide errors.

Task: B110 / Kimi R1 zero-warning culture + R16 user-extensible validation
Lane: FULL
Status: **VERIFIED**

## PLAN

- **Bounded unit:** add the version-1 rules schema, strict parser, expiring warning suppression, declared wire-key,
  known-chain, and expected-register contracts to `runProjectValidation`, its disk loader, flat diagnostics, API,
  CLI, and deterministic oracle coverage.
- **Assumptions and unresolved facts:** the untracked `Note for Kimi.md` is user-owned input, not a task-owned
  artifact. Its requested unit annotations require the separate corpus-grounded order-call/unit validator and are
  not silently represented as a schema field with no consumer. That follow-on remains part of final Kimi
  reconciliation. The R1/R16 ledger acceptance explicitly names suppressions, wire keys, known chains, and expected
  registers; those are this unit's complete executable contract.
- **Authoritative references:** Kimi reconciled ledger R1/R16; `Note for Kimi.md` sections 1.5 and 6.2; the existing
  `runProjectValidation`/`flattenProjectValidation` shared referee; `validateProjectCrossFile` AST and indexed-payload
  evidence; `lintScriptPropertyChains`; X4 Forge capability map and ADR ledger.
- **In scope:** exact root `forge.rules.json`; checked-in versioned JSON Schema; strict parsing and bounded arrays;
  warning-only exact suppression with stable provenance, owner/reason, and a review date no more than one year out;
  exact known-chain declarations; asserted indexed wire keys and scopes; asserted Lua registrations; disk loading;
  active/raw/suppressed warning truth; API/CLI visibility; invalid/expired/duplicate/stale-scope negatives.
- **Out of scope:** suppressing any error; glob/regex suppression; automatic source edits or R6's one-click UI;
  validation-delta persistence (R2); corpus-derived order parameter/unit checks; cue-path, runtime-log/liveness, or
  save-safety work; real mod/game writes; publication.
- **Affected resources:** `src/lib/projectRules.ts`; `docs/schemas/forge.rules.schema.v1.json`;
  `src/lib/projectCrossFileValidation.ts`; `src/server/projectValidation.ts`; `server.ts`; `scripts/x4validate.ts`;
  focused fixtures/tests; package/oracle registration; B110 ledger and durable close records.
- **Risks and authorization boundaries:** an overbroad match could hide a real warning; inconsistent consumers could
  show different counts; current-date logic could make tests flaky; a malformed rules file could be silently skipped.
  Rules are read-only project input. No real mod, game directory, credential, network, marketplace, or external state
  mutation is authorized. All mutation/validation uses repo code and isolated temporary fixtures.
- **Rollback/checkpoint:** `main == origin/main == 4aaf21a838906b6290dcc0b9f9db175eb306ec0e`; revert only R1/R16-owned
  paths. Preserve the two modified 0.0.35 evidence PNGs and untracked `Note for Kimi.md`/
  `scripts/x4_muds_game.mjs`.
- **Acceptance criteria:**
  1. Version 1 accepts only documented keys and bounded exact declarations; invalid JSON, duplicate files/IDs,
     unsupported versions, unknown properties, invalid paths/dates, and overbroad suppressions are blocking rules
     errors with `forge.rules.json` provenance.
  2. A valid suppression can remove only a matching warning from the active flat view. It cannot remove errors,
     cannot wildcard-match, expires at its review boundary, and records the exact rule plus suppressed diagnostic.
  3. A known-chain declaration removes only the exact scriptproperty warning for its exact chain/file scope and
     carries the same review metadata; unrelated chains remain visible.
  4. Declared wire keys assert an observed writer and the requested global/verb reader scope. Declared expected
     registrations assert AST-observed exact or satisfying dynamic-prefix registrations. Missing evidence is an
     error; passing evidence retains rule-to-source provenance.
  5. Project results expose rules presence/version/findings/matches/suppressed evidence plus raw, suppressed, and
     active warning totals. `ok` is false for rules errors. Existing projects without the file remain byte-semantics
     compatible apart from additive result fields.
  6. Disk `fromPath` and CLI load the exact root rules file; nested/lookalike JSON is ignored. API and CLI expose the
     same shared-engine truth.
- **Required validation:** focused pure rules selftest; cross-file regression; disk-loader and CLI/route integration
  positives/negatives; typecheck; lint; runtime-discovered oracles; route suite; full isolated E2E; production build;
  precommit; graph refresh/diff; fresh-eyes requirement/diff review.
- **Negative/failure paths:** error suppression attempt; expired review; non-matching exact scope; missing declared
  reader/writer/register; invalid JSON/version/unknown key/duplicate ID; nested rules lookalike; no-file compatibility;
  e2e stack teardown and unchanged live workspace.
- **Evidence locations:** this record; oracle/route/E2E command output; refreshed `graphify-out/graph.json`; B110
  ledger, ROADMAP, capability-map, AAR ledgers, and `SESSION-HANDOFF.md` at close.

## BASELINE

- **Revision/version:** `main == origin/main == 4aaf21a838906b6290dcc0b9f9db175eb306ec0e` on 2026-07-30;
  extension 0.0.59.
- **Existing user changes:** modified `vscode-extension/evidence/0.0.35-runtime-copy-live.png` and
  `vscode-extension/evidence/0.0.35-runtime-copy-startup.png`; untracked `Note for Kimi.md` and
  `scripts/x4_muds_game.mjs`. They are excluded from task ownership and staging.
- **Existing validation state:** the shared validator layers structure, cue, cross-file, XSD, AIScript,
  scriptproperties, references, content lints, and diff simulation. Its disk loader ignores JSON. No rule parser,
  suppression record, declared-contract layer, review policy, or active-vs-suppressed warning count exists.
- **Baseline command observations:** worktree revision equality confirmed; no R1/R16 implementation paths exist.
  Three exploratory `rg` commands returned exit 1 because paths/no-match were wrong; this task therefore requires a
  triggered AAR even if implementation is otherwise clean.

## RECONCILE

- **Resources/readers/writers searched:** Kimi note/ledger; capability map and ADRs; graph/code call sites for
  `runProjectValidation`, `flattenProjectValidation`, `loadProjectFromDisk`, `validateProjectCrossFile`,
  `lintScriptPropertyChains`; API, compile/deploy, CLI, agent-loop, and UI consumers; selftest registry.
- **Existing capability reused:** one shared referee and flat diagnostic currency; Lua AST registration discovery;
  exact indexed payload parsing; scriptproperty chain diagnostics; disk project loader; runtime oracle registry.
- **Presence/absence:** validation evidence already exists but is inferred only. No `forge.rules.json` reader,
  schema, expiry/review behavior, provenance, or mod-declared contract exists. `ProjectFileKind.other` can already
  carry the file, so no new project model or parallel validator is needed.
- **Couplings checked:** disk/inline inputs; native layered findings and flat diagnostics; summary/deploy warning
  counts; API remediation capsules; CLI output/exit; compile/release/deploy calls; oracle discovery.
- **Capability-map delta:** pending proof. No ADR contradiction found.
- **Plan changes:** reconciliation rejected code-only suppression as unsafe and made file/source scope mandatory;
  expired declarations fail closed; all errors are unsuppressible. Unit annotations are not added inertly and remain
  in the later Kimi domain-validation reconciliation.

## IMPLEMENTATION TASKS

1. Add and selftest the strict versioned rules parser, matcher, review policy, and schema artifact.
2. Expose cross-file wire evidence and evaluate declared wire/register contracts through the shared validator.
3. Apply exact known-chain and generic warning suppression at the shared flat-diagnostic boundary; expose active/raw
   counts and provenance; make rules errors part of `ok`.
4. Load root rules from disk, surface results in API/CLI, and add route/fixture negatives.
5. Run all declared gates, fresh-eyes review, document close/AAR/capability delta, then path-scoped commit and push.

## IMPLEMENT

- Added `src/lib/projectRules.ts`, a strict pure parser/evaluator for version 1. It bounds file/array/string sizes,
  rejects unknown fields and duplicate IDs, enforces exact relative paths and a 366-day review horizon, evaluates
  declared contracts against existing AST/payload evidence, and applies only exact warning matches. Rule parse or
  contract errors disable every suppression and make the shared project verdict red.
- Added the checked-in Draft 2020-12 schema and `docs/PROJECT_RULES.md` with the safety contract, example, CLI/API
  behavior, provenance, and active/raw/suppressed warning semantics.
- Extended the existing indexed-payload scanner to expose reader scope/destination and writer files. Its exact-key
  grammar now accepts identifier keys (`g_key`, digits after the first character) instead of the old letters-only
  subset. No second scanner or validator was created.
- Integrated rules into `runProjectValidation`, flat diagnostics, API schema, compile/release/deploy consumers, and
  CLI output. `ok` includes rule failures. Results include present/version/valid, findings, evidence matches,
  unmatched reviewed declarations, suppressed diagnostics, and warning totals.
- Added exact root rules loading. A rules file over 256 KiB remains represented as a blocking
  `rules.file_too_large` finding even when the generic disk loader would normally skip it; nested lookalikes remain
  ignored. Added a permanent CLI fixture and external from-path positives/negatives.
- No real mod/game/installed-host/marketplace/config data was written. The two user-owned PNG edits and two untracked
  files remain excluded from ownership.

## VALIDATE

- JSON Schema structure + fixture validation (`Draft202012Validator`) -> PASS, 0 errors.
- Project-rules pure oracle -> PASS 20/20, including warning-only behavior, exact scope, provenance, overdue/future-
  horizon/overbroad/unknown/duplicate/version/missing-evidence/nested/oversized negatives.
- Cross-file oracle -> PASS 21/21, including global/verb evidence and identifier-style indexed keys.
- CLI disk fixture -> PASS / exit 0; loaded `content.xml` and exact root `forge.rules.json`; rules v1 valid; 0 active,
  raw, suppressed warnings or errors.
- External isolated routes -> PASS 248/248. From-path rules loaded; two contract matches retained evidence; one exact
  warning was suppressed; unsupported v2 and 256-KiB-plus disk rules returned `ok:false` with exact rule codes.
- Runtime-discovered oracle sweep -> PASS 120/120, including rules 20/20 and cross-file 21/21.
- Typecheck -> PASS. Lint -> PASS, 0 errors / 548 established warnings. Production build -> PASS with the established
  large-chunk warning. Precommit -> PASS. Product-copy guard -> PASS.
- Graph refresh -> PASS, 3,037 nodes / 7,068 edges / 157 communities. Reverse traversal confirms the shared rules
  path reaches full validation, CLI, full-workspace compile/release, deploy preflight, readiness, and API consumers.
- Full isolated E2E after fresh-eyes correction -> PASS 46/46 in 197.2 seconds, 0 failed/flaky/bad/quarantined.
  Receipt: `test-results/e2e-verdict.json`. Ports 3100/3101 closed afterward. `.studio-state` files retain timestamps
  from July 23/28, before both runs, so the standing live workspace was not touched.
- Negative/rollback -> invalid/expired/unmet/oversized rules fail without suppression; errors remain visible; no-file
  projects remain compatible. All fixtures were repo-owned or temporary and route/E2E stacks self-cleaned.
- Exact-SHA Windows Quality -> PASS: run `30574645399`, job `90979730922`, exact head
  `5262348e19d89afb1eade5ba4e9504dc3e9f6b9a`; all 23 steps completed successfully, including locked installs,
  audits, type/lint/oracles/build/routes, extension build/stage/probe, VSIX package/final-byte inspection, and
  inspected-only retention. Artifact `8772238373` is 17,515,672 bytes and retained through 2026-08-13. Discord
  Release Sync `30574645262` also passed.

## REVIEW

- **Versioned exact schema:** done and machine-validated.
- **Warnings only / exact scope / review policy / provenance:** done; errors cannot be suppressed and any rules error
  disables suppression.
- **Known chains:** done for exact `scriptproperty.*` diagnostic chain plus optional exact file.
- **Wire keys:** done; both reader scope and writer evidence are asserted by default, with explicit one-sided options.
- **Expected registers:** done against exact AST registrations or a satisfying AST-proven dynamic prefix, optionally
  narrowed to a file.
- **Shared engine/API/CLI/disk consumers:** done; active warning totals drive deploy/release/full diagnostics.
- **Unit annotations:** deliberately deferred to the corpus-grounded Kimi order-param/unit slice; no inert setting was
  added. Cue-path, runtime liveness, and save safety remain later Kimi reconciliation work.
- **Fresh-eyes finding and correction:** the first disk implementation let files above the generic 4-MiB loader cap
  disappear before rule parsing. The loader now creates a bounded sentinel representation and the external 248th
  route assertion proves oversized rules cannot degrade to absent. Full validation was rerun after correction.
- **Unrelated changes:** preserved and excluded. Diff check passes; no generated/product-copy churn is task-owned.

## CLOSE

- **Status:** VERIFIED. Every declared local method and the exact-SHA public Windows packaged-product gate passed.
- **Capability-map delta:** one shared, fail-closed mod-local validation-rules contract is now VERIFIED; this extends
  the existing referee and does not create a parallel validator.
- **Remaining risk:** JSON Schema captures structure but review-horizon semantics are enforced by the runtime parser;
  both are tested. The schema's stable raw-GitHub URL becomes externally resolvable only after push.
- **Suggested implementation commit title:** `feat(validation): add fail-closed project rules`

## AAR

- **Triggers:** three exploratory searches failed from wrong paths/no-match exits; first typecheck caught one stale
  payload variable; the first E2E launch was terminated by an erroneous one-second shell timeout; fresh-eyes review
  found the oversized-disk fail-open path and forced correction plus complete revalidation.
- **Sustain:** reuse the shared referee and expose existing AST/payload evidence; make every exception exact,
  expiring, and auditable; preserve raw findings separately from active truth.
- **Improve work/approach:** trace loader limits before declaring parser-size guarantees; give long harness commands
  their real timeout on the first attempt; add boundary-size negatives during initial acceptance design.
- **Improve tools:** raw shell timeout termination gave no product evidence but cleanly reaped the attempted E2E stack.
  Continue the explicit port/process audit before relaunch. A future schema consistency oracle could compare runtime
  parser key sets against the checked-in JSON Schema automatically.
- **Highest-risk evidenced weakness:** a metadata file can disappear before its owning parser if a generic loader
  rejects it first. Preserve the resource's existence through the loader and let its domain parser produce the
  blocking verdict; pin that with an external disk-path test.
- **Lessons to bank at VERIFIED close:** exact reviewed exceptions must never change error truth; structured evidence
  and active/raw counts keep zero-warning culture honest; loader/parser limits are one coupled contract.
