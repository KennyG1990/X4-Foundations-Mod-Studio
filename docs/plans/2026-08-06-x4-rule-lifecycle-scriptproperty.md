# W10 Governed Scriptproperty Coverage and Rule-Pack Lifecycle Governance

Status: SUPERSEDED BEFORE IMPLEMENTATION (reconciled 2026-08-06; no source change occurred)
Overall W10 status: OPEN / PARTIAL
Task: Historical governed scriptproperty diagnostic coverage plus deterministic rule-pack lifecycle governance proposal
Lane: FULL
Date: 2026-08-06
Owner: GitHub #10, W10 rule/evidence-pack feature owner
Program references: GitHub #9 parent program; GitHub #18 no-unexplained-gap projection

This record specifies the next bounded checkpoint. It does not implement code, change a pack, deliver an update,
write to a mod or game, mutate Git or GitHub, or claim full W10 or overall-program completion.

## SUPERSESSION NOTICE

This unimplemented plan is retained as historical evidence and is superseded before implementation by
`docs/plans/2026-08-06-scriptproperty-nested-path-resolution.md`. No implementation source or test change occurred;
the interrupted worker's candidate patch was reverted.

- **[REPRODUCED]** Against the current Forge index, `$pship2.cargo.free.all?`, `$nsh.cargo.free.all`, and
  `$pship2.cargo.free.solid` each produce one `scriptproperty.unknown` finding at `all` or `solid`; the invalid
  `$pship2.cargo.free.notreal` produces one finding at `notreal`.
- **[CORPUS CONTRADICTION]** The authoritative X4 9.00
  `F:\Downskies\x4unpackersuitev1\X4 unpacked 9.00\libraries\scriptproperties.xml` defines
  `containercargolist` from `cargolist`, `cargo` returning `containercargolist`, and the nested `free.all`,
  `free.solid`, `free.container`, `free.liquid`, `free.universal`, and `free.{$tag}` paths. The four real-mod
  warnings are therefore disproven false positives, not governed findings.
- The former requirement to bind exactly four real-mod warnings to provenance is withdrawn. Those warnings must
  disappear before W10 can bind scriptproperty provenance or lifecycle semantics. W10 rule-pack/lifecycle work
  remains **OPEN / DEFERRED** until the prerequisite plan is implemented and verified.

## PLAN

- Bounded unit: add one governed scriptproperty rule-family binding to the existing diagnostic currency and one
  pure deterministic candidate-update evaluator for rule-pack lifecycle changes. The evaluator governs identity,
  hash chaining, pack/rule version changes, active-rule removal, deprecation, and supersession. Existing validators
  remain the only verdict authorities.
- Purpose: make the existing scriptproperty findings explainable through stable governed provenance and make any
  future pack transition reject ambiguity, drift, and incomplete history before it can become visible.
- Assumptions and unresolved facts: the existing parser, canonicalizer, resolver, diagnostic explanation, Why panel,
  selftest registry, package/install flow, capability owner, and ledger owner remain the authorities. Exact field names
  for candidate signatures, lifecycle records, and canonical rule-content boundaries may be settled during
  implementation, but the fail-closed behaviors and evidence requirements in this contract may not be weakened.
- Authoritative references: the existing W10 authority in
  docs/plans/2026-08-04-x4-deterministic-rule-packs.md; the installed provenance checkpoint in
  docs/plans/2026-08-06-x4-rule-provenance-guidance.md; the configured scriptproperty index at
  libraries/scriptproperties.xml; the code-owned validator in src/lib/scriptProperties.ts and its existing
  project-validation callers; the existing X4 schemas and unpacked corpus; the current diagnostic and UI contracts;
  and the project capability/ledger owners.
- Existing infrastructure reused: the flat diagnostic currency; scriptproperty.* producers; the existing
  rule-pack parser, canonicalizer, hash/identity boundary, and resolver; diagnosticExplain; the Why panel;
  the server selftest registry; the existing selftest and oracle discovery; the existing stage/package/probe/inspect
  flow; and the installed extension host. No duplicate detector, second rule store, parallel resolver, or new
  delivery channel is permitted.
- In scope:
  - a governed scriptproperty family binding to the exact existing codes
    scriptproperty.unknown and scriptproperty.requires_subselector;
  - corpus-backed evidence for that family, including the configured scriptproperty index and focused positive and
    negative fixtures;
  - a pure candidate-update evaluator and its immutable lifecycle evidence;
  - deterministic acceptance of unchanged and additive rules plus explicit deprecation and supersession;
  - fail-closed refusal for malformed, unverifiable, drifting, ambiguous, cyclic, or partial transitions;
  - provenance and lifecycle metadata in the existing diagnostic explanation and Why panel;
  - focused tests and the full validation matrix below.
- Affected surfaces (future implementation only; none are edited by this task): existing scriptproperty validation;
  existing rule-pack types/parser/canonicalizer/resolver/core-pack authority; diagnosticExplain; the existing Why
  panel component; the server selftest registry; package and installed-extension proof; capability-map and
  GitHub-ledger readback; and this plan.
- Limits that must remain explicit: dynamic pack delivery, automatic fixes, new or broader rule families, scorecards,
  and overall W10 remain OPEN. This checkpoint does not claim full W10, automatic repair, a pack-manager UI, live
  external updates, or overall-program completion.
- Product boundary: the installed X4 Forge extension and its native local validation/provenance surfaces only. No
  public or end-user CLI, standalone application, external analysis provider, prompt execution, script execution,
  executable data, regular expressions, XPath, JavaScript in rule data, network updater, marketplace publication,
  mod/game write, or extension-install/config mutation is in scope.
- Risks and authorization boundaries: identity or canonicalization mistakes could accept corrupted policy; lifecycle
  mistakes could silently erase an active rule; data bindings could falsely imply a verdict change; stale package
  bytes could hide the UI change; and a partial promotion could expose mixed pack state. The evaluator must be pure,
  deterministic, and side-effect free. Any future promotion wrapper must preserve the previous verified pack until
  the new pack is fully verified and atomically visible. No spend, network, deletion, credential, permission, mod,
  game, or installation write is authorized by this task.
- Rollback/checkpoint: exact-path revert of this checkpoint only:
  F:\DEV_ENV\X4_Forge\docs\plans\2026-08-06-x4-rule-lifecycle-scriptproperty.md.
  The prior core pack bytes, current validators, and unrelated worktree paths are not rollback targets.

### Former acceptance criteria (rejected by reconciliation; not an active contract)

1. Scriptproperty governance binds one descriptive governed family to the exact existing diagnostic codes
   scriptproperty.unknown and scriptproperty.requires_subselector. The binding records deterministic identity and
   corpus evidence but does not add a detector, reimplement the validator, or move verdict authority into data.
2. The code-owned validator continues to use the configured libraries/scriptproperties.xml index. The rule data
   contains no executable policy or executable fields. Existing severity, verdict, exact diagnostic message, and
   exact suggestion behavior are unchanged.
3. **REJECTED.** The former requirement for a VALID read-only `x4_ai_influence` result with exactly four active
   `scriptproperty.unknown` warnings, followed by provenance matching, was based on the disproven nested-path
   behavior above. It is not an acceptance target. The replacement prerequisite requires VALID, schema loaded, zero
   errors, and zero scriptproperty warnings for the valid nested cargo paths, with exact warnings only for invalid
   continuations.
4. The candidate-update evaluator is pure and deterministic. For a previous verified pack and a candidate it
   computes or verifies canonical identity, checks the predecessor hash chain, checks lifecycle history, and returns
   a stable accept or refusal result without mutating a pack, store, workspace, mod, game, or network state.
5. Candidate identity is mandatory and verifiable. Malformed, unsigned, or otherwise unverified identity/provenance
   is refused. The candidate's declared identity must match the deterministic hash of its canonical content, and its
   declared predecessor must match the exact hash of the accepted previous pack.
6. Pack version must increase strictly. The evaluator refuses a same-version candidate, a downgraded pack version,
   a wrong predecessor hash, and any candidate whose canonical bytes or identity do not match the verified content.
7. Per-rule history is monotonic and content-addressed:
   - an unchanged rule may retain its version;
   - a changed rule must strictly increase its rule version;
   - a rule version downgrade is refused;
   - changed rule content without a rule-version increase is refused; and
   - same-version content drift is refused, including drift hidden by object-key order or non-canonical encoding.
8. An active rule may not disappear silently. Silent active-rule removal is always refused. Removal is refused unless
   the candidate contains explicit valid
   deprecation or supersession history bound to the removed rule identity and predecessor version. A deprecation
   record has deterministic lifecycle metadata and remains part of the candidate identity. A supersession record
   names a replacement that exists in the accepted candidate graph.
9. Supersession is fail-closed: missing, self, or cyclic supersession replacement, duplicate
   replacement identity, ambiguous replacement, or any unresolved lifecycle reference is refused. The evaluator must
   check the complete reachable history rather than accepting only the immediate edge.
10. Duplicate pack identities, duplicate rule identities, duplicate lifecycle identities, conflicting records, and
    any diagnostic-to-rule ambiguity are refused. The resolver must not select an arbitrary candidate. Ambiguous
    diagnostics retain an explicit refusal/candidate result.
11. A rejected, interrupted, or otherwise partial update leaves the previous pack byte-for-byte and hash-for-hash
    unchanged and leaves no partially visible candidate, half-written lifecycle history, mixed pack/rule set, or
    success receipt. A future promotion wrapper may expose only the complete verified candidate through the existing
    atomic writer; the evaluator itself remains pure.
12. Valid update cases are accepted and canonicalized deterministically:
    - unchanged rules with a strictly higher pack version;
    - an additive rule with a unique identity and valid evidence;
    - explicit deprecation of an active rule;
    - explicit supersession by an existing, distinct, acyclic replacement; and
    - equivalent inputs with different object-key order producing identical canonical output and identity.
    The accepted candidate does not alter the immutable previous pack.
13. **DEFERRED.** The existing diagnostic explanation and Why panel must not bind provenance to the disproven
    warnings. Governed scriptproperty provenance and lifecycle metadata remain open until the replacement
    prerequisite is green; the later lifecycle plan must use the corrected zero-warning baseline.
14. **DEFERRED.** Focused lifecycle/provenance tests and the full validation matrix remain future gates only after
    the replacement nested-path selftest, real 9.00 corpus regression, and zero-warning real-mod result pass.
15. This checkpoint remains a bounded W10 slice. Dynamic pack delivery, automatic fixes, other/new rule families,
    scorecards, full W10, issue closure, and overall-program completion remain open and are not inferred from green
    focused or installed results.

### Deterministic refusal matrix

The implementation selftest must name each refusal with a stable machine-readable reason and prove that the previous
pack and all externally visible state remain unchanged:

| Candidate or resolution condition | Required result |
| --- | --- |
| Malformed candidate, unknown shape, or executable data | Refuse before parsing into policy |
| Missing, unsigned, malformed, or unverified identity/provenance | Refuse before promotion |
| Candidate identity/hash does not match canonical content | Refuse |
| Wrong predecessor hash or missing hash-chain link | Refuse |
| Same or downgraded pack version | Refuse |
| Same-version pack content drift | Refuse |
| Rule version downgrade | Refuse |
| Changed rule content without a rule-version increase | Refuse |
| Silent active-rule removal | Refuse |
| Deprecation/supersession record missing, malformed, or bound to the wrong rule version | Refuse |
| Missing, self, cyclic, duplicate, or ambiguous supersession replacement | Refuse |
| Duplicate pack, rule, lifecycle, or diagnostic identity | Refuse |
| Ambiguous diagnostic-to-rule resolution | Refuse selection and expose candidates |
| Interrupted or partial update state | Refuse and preserve the immutable previous pack |

## BASELINE

- Revision: HEAD and origin/main are both e47dab5c600ed9954c938124d5a116a81daa3983, as supplied and confirmed
  read-only at session start. No Git mutation is authorized for this task.
- Dirty worktree: the complete pre-existing inventory is the session-start
  git status --short --untracked-files=all output and the preservation section of SESSION-HANDOFF.md. It includes
  unrelated modified, deleted, and untracked files. This task records that inventory by reference, claims no
  ownership of any item, and must leave every item byte-for-byte unchanged.
- Existing W10 authority: the core pack has exactly three rules: the XSD_ prefix binding,
  md_lua.missing_register, and lua_md.missing_listener. The existing pack parser, canonicalizer, resolver, and
  diagnostic provenance are already the authorities described by the two cited W10 plans.
- Existing scriptproperty authority: src/lib/scriptProperties.ts emits
  scriptproperty.unknown and scriptproperty.requires_subselector from the configured library index. No new
  scriptproperty detector or second rule store exists in this baseline.
- Supplied real-mod evidence: the read-only validation of
  F:\DEV_ENV\projects\Mods\X4Mods\x4_ai_influence is VALID with schema loaded, zero errors, and exactly four active
  warnings, all scriptproperty.unknown. This is a supplied baseline fact, not a fresh product run performed by this
  documentation-only task; reconciliation disproves those warnings as nested-path false positives, so they are not
  valid acceptance targets for this historical plan.
- Issue state: GitHub #10 remains OPEN/PARTIAL. This record does not claim dynamic pack delivery, automatic fixes,
  full W10, or overall-program completion.
- Installed/UI state: the prior provenance plan establishes the existing matched/unmatched/unavailable/ambiguous
  rule provenance and deterministic Why-panel path. Scriptproperty lifecycle coverage and update governance are
  not yet closed by this checkpoint.
- Graph state: the precomputed graph did not expose the newer rule-pack symbols during the read-only query; direct
  source reconciliation identified the current owners. The implementation must refresh Graphify and record the new
  counts rather than treating the stale graph as proof.

## RECONCILE

- Resources and readers/writers searched: the scriptproperty index and validator; project-validation callers; the
  current flat diagnostic currency; x4RulePackTypes; x4RulePackParser; x4RulePackCanonical; x4RulePackResolver;
  x4RulePacks and its core JSON; x4RulePacks selftests; diagnosticExplain; DiagnosticGuidance; the server
  selftestRegistry; package scripts; stage-app, probe-staged-app, and inspect-vsix; the two W10 plans; the current
  handoff; and the capability/ledger ownership boundary.
- Existing capability reused: scriptproperty diagnostics remain code-owned; rule data only describes and binds
  exact codes and evidence; the existing pack parser/canonicalizer/resolver remains the single policy authority;
  existing diagnostic explanation and Why rendering remain the only user-facing provenance path; existing
  selftests, oracle discovery, package flow, installed extension, capability owner, and issue ledger remain in use.
- Couplings checked:
  - libraries/scriptproperties.xml index -> lintScriptPropertyChains -> flat diagnostics -> diagnosticExplain ->
    Why panel -> installed rendered evidence;
  - canonical pack bytes -> pack identity/hash -> candidate predecessor chain -> lifecycle records -> resolver;
  - rule identity/version/content -> deprecation/supersession graph -> active-rule set;
  - selftest registry -> oracle/precommit inventory -> packaged server -> installed extension;
  - staged package bytes -> installed extension files -> rendered current-mod warning;
  - capability delta -> GitHub #10 owner -> #9 parent and #18 no-gap readback.
- Presence: the existing validator, exact codes, three-rule core pack, parser/canonicalizer/resolver, provenance
  explanation, Why panel, selftest registry, package flow, and installed host are present.
- Absence/open boundary: governed scriptproperty family coverage, deterministic candidate-update evaluation,
  lifecycle refusal matrix, immutable previous-pack update proof, and installed current-mod scriptproperty
  lifecycle evidence are not closed by the baseline.
- No duplicate architecture: the candidate evaluator must call or reuse the existing identity/canonicalization
  boundary and the existing resolver; it must not add a detector, second rule store, parallel provenance resolver,
  public API, or live update channel.
- Capability-map delta: the implementation close must record one bounded delta for governed scriptproperty coverage
  and deterministic lifecycle governance, including the refusal boundaries. This documentation task does not edit
  the capability map or any external ledger.
- Plan reconciliation: the authoritative corpus and reproduction invalidate the four-warning assumption. The
  lifecycle/provenance unit is superseded and deferred; the replacement prerequisite repairs the existing
  scriptproperty index/validator before any binding is attempted. No validator rewrite, automatic fix, or mod write
  is authorized by this historical record.

## DOCUMENT PLAN

State: SUPERSEDED BEFORE IMPLEMENTATION

- Scope: no implementation is authorized from this record. The former lifecycle/provenance scope is retained only
  as historical evidence and is replaced by `docs/plans/2026-08-06-scriptproperty-nested-path-resolution.md`.
- Non-goals: dynamic delivery, automatic fixes, new families, scorecards, a pack-manager UI, live external updates,
  CLI or standalone product surfaces, external analysis, executable rule data, mod/game writes, issue closure, and
  overall W10/program completion.
- Required implementation ownership: existing validators emit verdicts; existing parser/canonicalizer/resolver owns
  rule interpretation; the evaluator owns deterministic candidate acceptance/refusal; the existing Why panel owns
  rendered metadata; the existing selftest/package/capability/ledger owners own their respective evidence.
- Planned evidence locations:
  - this plan, updated at implementation close with exact commands, counts, hashes, receipts, and status;
  - focused selftest output and isolated runtime receipts under
    test-results/w10-rule-lifecycle-scriptproperty/;
  - package/stage/probe/inspection output under the existing test-results/package and extension evidence owners;
  - installed Antigravity rendered screenshots under
    vscode-extension/evidence/2026-08-06-w10-rule-lifecycle-scriptproperty-installed/;
  - final precommit and Graphify output in the implementation close record;
  - read-only Git parity and GitHub #10/#9/#18 readback in the close record.
- Rollback: exact-path revert of this historical plan only for its documentation state. The replacement plan owns
  the nested-path repair rollback and all later lifecycle/provenance evidence.

## IMPLEMENT

- Status: REVERTED BEFORE IMPLEMENTATION. No implementation source, test, pack, package, evidence, configuration,
  Git, GitHub, mod, or game path was changed by this task. The interrupted worker's source candidate was reverted.
- The former lifecycle/provenance implementation is not a pending work order. It may resume only after the replacement
  nested-path plan is implemented and verified, with the corrected zero-warning baseline.
- The replacement plan must not convert descriptive rule data into a validator, alter diagnostic severity/verdict,
  introduce a duplicate detector/store, or broaden the product boundary.

## VALIDATE

### Documentation-only validation performed for this task

- Baseline readback: HEAD, origin/main, dirty status, cited plans, current handoff, and current owner searches were
  read without mutation.
- Owned-file whitespace check: run git diff --check against the new owned file without staging or altering any
  other path. Record the command and result below after the file is written.
- Complete-file readback: read the complete new plan and compare it to the acceptance contract below.
- Scope check: read-only status and exact-path diff review must show only the new owned plan as this task's change;
  unrelated dirty/deleted/untracked paths must remain present and unowned.

### Future implementation validation matrix

| Layer | Required method and proof | Required negative or containment proof |
| --- | --- | --- |
| Focused diagnostics | The replacement scriptproperty selftest plus later lifecycle tests; exact path-aware pass counts, both codes, corpus evidence, zero valid-path warnings, exact invalid-path findings, exact messages/suggestions, and no severity/verdict drift | The four reproduced warnings cannot be accepted as provenance; unavailable validator evidence cannot become clean |
| Focused lifecycle | Candidate evaluator tests for identity/hash chain, strict versions, unchanged/additive/deprecation/supersession, canonical output, immutable previous pack, and every refusal matrix row | Malformed, unsigned/unverified, wrong predecessor, drift, downgrade, removal, missing/self/cyclic/ambiguous identity, and partial-state cases all refuse |
| Static | npm run typecheck; npm run lint with zero errors; repository search for executable data and duplicate ownership | No new data-executed expression, duplicate store, duplicate validator, or forbidden surface |
| Oracle | Owning isolated oracle and the runtime-index oracle sweep, with the actual discovered N and receipts recorded | A failed/unavailable oracle is PARTIAL or BLOCKED, never green by inference |
| Isolated E2E | npm run test:e2e with the current verdict parser, one worker, ephemeral ports 3100/3101, per-run state, and full containment readback | Product-green but incomplete terminal report, leaked process/ports/state, or live 3000/3001/workspace change is red |
| Build | npm run build | Build failure blocks the checkpoint |
| Package | Existing vscode-extension build, stage-app, package, inspect-package, and probe-app flow; record package hash/size and inspection results | Stale or incomplete staged content, traversal/secret/runtime-state findings, or probe failure refuses close |
| Installed UI | The replacement plan must first prove the installed current-mod validation output has zero scriptproperty warnings; only then may a later lifecycle plan render governed metadata in Antigravity | Do not substitute a mock, DOM-only claim, old screenshot, different workspace, or a cross-workspace error-count comparison |
| Precommit | npm run precommit:check after all implementation paths and governance/capability records are reconciled | Any required hook/oracle/manifest gate red means not complete |
| Graph | graphify update . after implementation and record the resulting node/edge/community counts | Stale graph or failed refresh cannot support the close |
| Git close | Read-only diff review, exact path staging, commit, push, and assert HEAD, origin/main, and remote main parity; no unrelated baseline path staged | No broad add, reset, clean, or unrelated restoration; parity failure is not VERIFIED |
| Issue close | Read-only GitHub #10, #9, and #18 readback at close; confirm #10 remains open/partial, #9 remains parent, #18 remains projection, and exact ledger blocks are present | Do not close an issue or claim dynamic delivery, full W10, or overall completion |

The implementation close must record exact exit codes, discovered counts, hashes, receipt paths, screenshot paths,
and any unavailable validation. The required installed rendered proof is a real host proof; source inspection,
backend output, or a mocked panel is insufficient.

## REVIEW

Placeholder for the implementation close:

- Re-read this request, the two cited W10 plans, the reconciled diff, and every refusal/valid-case result.
- Classify each acceptance criterion as done/evidenced, partial, missed, deferred, or out of scope.
- Fresh-eyes review must challenge canonical content boundaries, hash-chain handling, lifecycle graph traversal,
  partial-state rollback, duplicate ownership, exact warning text/suggestion preservation, and installed rendered
  evidence.
- Confirm the four reproduced scriptproperty warnings are not treated as valid findings; the replacement plan must
  eliminate the valid nested-path false positives before any provenance binding is reviewed.
- Confirm dynamic delivery, fixes, other families, scorecards, full W10, and overall-program completion remain open.

## CLOSE

Placeholder for the implementation close:

- Status: SUPERSEDED BEFORE IMPLEMENTATION. No future VERIFIED result may be claimed from this record. The replacement
  plan owns the prerequisite implementation and validation; lifecycle/provenance remains OPEN / DEFERRED.
- What changed: this record now records the corpus contradiction, reproduced false positives, reverted/no-code-change
  disposition, and the replacement prerequisite.
- What deliberately did not change: unrelated dirty paths, implementation source, tests, current validator behavior,
  core rule authority, product boundary, dynamic delivery, automatic fixes, other families, scorecards, issue state,
  mod/game state, and overall-program state.
- Baseline and rollback: baseline is e47dab5c600ed9954c938124d5a116a81daa3983 plus the referenced dirty inventory;
  documentation rollback is exact-path revert of this plan only.
- Capability/ledger close: record the bounded capability delta and read back GitHub #10/#9/#18 without closing them.
- Suggested future commit title: docs: supersede disproven scriptproperty lifecycle plan.

## AAR

Documentation-task AAR:

- Trigger: initial read-only probes used a stale plan filename, a nonexistent `test` directory, and a mistyped corpus
  path; each was corrected. No product or worktree mutation resulted.
- Sustain: preserve the supplied write boundary, baseline dirty inventory, existing validator ownership, and honest
  OPEN/PARTIAL W10 limits.
- Improve work/approach: when the graph vocabulary is stale, use direct current-source reconciliation and require a
  deterministic Graphify refresh at implementation close.
- Improve tools: verify every referenced path before parallel probing and treat nonzero diagnostic probes as tooling
  evidence to correct, not as product verdicts.
- Highest-risk evidenced weakness: stale architecture evidence can hide new owners; direct source inventory plus the
  future Graphify gate is required before implementation close.

Future implementation AAR placeholder:

- Outcome and triggers:
- Points to sustain:
- Points to improve - work/approach:
- Points to improve - tools:
- Highest-risk evidenced weakness:
- Global/project lessons banked:
