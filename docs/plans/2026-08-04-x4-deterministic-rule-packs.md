# Deterministic X4 Rule and Evidence Packs

Status: SPECIFIED
Lane: FULL
Date: 2026-08-04
Owner: GitHub #18, W10 foundation

## PLAN

- **Bounded unit:** add a strict, versioned, data-only X4 rule-pack format and a code-owned detector registry, then
  bind an initial pack to deterministic diagnostics Forge already emits for routed XSD validation and MD/Lua event
  wiring. Surface the matched rule identity, applicability, evidence grade, and evidence digest in Forge's existing
  deterministic diagnostic guidance.
- **Purpose:** convert X4 domain knowledge into governed validator policy. A rule pack may describe and parameterize
  an accepted detector, but it may not execute prompts, scripts, expressions, arbitrary regular expressions, or
  decide a verdict from prose. Existing validators remain the authority that emits pass/fail findings.
- **Assumptions and unresolved facts:** the current configured target version may be unavailable to some pure
  consumers. Rules with a bounded game-version range must report `unavailable` when that version is absent rather
  than silently applying. Engine-merge claims remain out of this pack until the W7 runtime oracle proves them.
- **Authoritative references:** routed X4 XSD validation and the current unpacked X4 corpus remain executable/reference
  authorities; current deterministic owners in `src/server/projectValidation.ts`, `src/lib/projectCrossFileValidation.ts`,
  and `src/lib/diagnosticExplain.ts`; the official Egosoft [General XML guide](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/#HGeneralXML)
  and [XML Patch Guide](https://forum.egosoft.com/viewtopic.php?t=354310) may support cited guidance and evidence
  metadata only, and may not become executable policy or override XSD, corpus, or runtime evidence; W10 in
  `docs/plans/2026-08-02-pending-feature-implementation-program.md`; StarForge decisions and capability map.
- **Existing infrastructure reused:** the shared flat diagnostic currency, exact diagnostic codes, deterministic
  guidance component/API, project-local `forge.rules.json` suppressions, and current validator selftest board.
- **In scope:** strict parser; canonical ordering and SHA-256 identity; evidence grades; game-version applicability;
  exact code-owned detector IDs; exact/prefix diagnostic-code parameters with bounded values; duplicate/unknown-key
  refusal; one bundled core pack; diagnostic-to-rule resolution; deterministic guidance provenance; focused tests.
- **Out of scope:** a general-purpose rule DSL; arbitrary regex or code loaded from data; project suppressions;
  prompt execution; AI verdicts; XML merge claims; balance judgments; automatic fixes; network updates; server route,
  UI panel, CLI product, marketplace release, or edits to the user's mod/game installation.
- **Affected surfaces:** one new library owner, one bundled JSON rule pack, deterministic guidance integration, focused
  selftests, this plan, and the program/ledger wording required to record the bounded result.
- **Risks and authorization boundaries:** malformed or over-broad packs could misrepresent validator authority. The
  parser therefore fails closed, evidence is immutable by digest, applicability is explicit, and only detector IDs
  compiled into Forge may run. This unit performs no external write, network call, spend, deletion, or game mutation.
- **Rollback/checkpoint:** remove the new owner and bundled pack, then restore the small guidance integration. Baseline
  revision is `a97e21865143b754b60358865954d558dfb8d72d`; preserve all unrelated dirty files.

### Acceptance criteria

1. The parser rejects malformed JSON, unknown keys, unknown detector IDs, duplicate pack/rule IDs, invalid semantic
   versions or ranges, unsupported evidence grades, empty or over-limit parameters, and non-data executable fields.
2. Canonical serialization and SHA-256 identity are stable across object-key order and reject any content drift.
3. Applicability has deterministic `applicable`, `not_applicable`, or `unavailable` outcomes; a missing target version
   can never be interpreted as pass or applicability.
4. Detector selection is code-owned. The bundled pack can bind only bounded exact diagnostic codes or code prefixes;
   it cannot supply regex, JavaScript, shell, prompt, XPath, or another executable expression.
5. The initial bundled rules bind routed schema diagnostics and the existing MD-raised/Lua-registered plus
   Lua-emitted/MD-listened event-contract findings without duplicating those detectors.
6. A matched diagnostic receives one stable native rule ID, evidence grade, applicability scope, pack identity, and
   evidence digest in deterministic guidance. An unmatched diagnostic continues to degrade honestly.
7. Focused tests cover valid load, deterministic ordering/hash, every refusal class, version boundaries, missing-version
   unavailability, exact/prefix matching, no false match, duplicate-match ambiguity, and guidance readback.
8. Typecheck and the applicable deterministic oracle pass. No source-package attribution or parallel provider/CLI
   concept appears in implementation, documentation, issue, or user-facing wording.

### Validation and evidence

- Focused rule-pack selftest with exact pass count and negative paths.
- Existing diagnostic-guidance selftest with provenance readback.
- `npm run typecheck`.
- `npm run lint` against the established baseline.
- Repository search proving prohibited executable fields and source-package attribution are absent from task-owned
  files.
- Evidence is recorded in this plan and the repository/GitHub owner close; no runtime/UI claim is made in this slice.

## BASELINE

- Revision: `a97e21865143b754b60358865954d558dfb8d72d` on `main`.
- The worktree contains unrelated user and prior-program changes listed by `git status --short`; none are owned here.
- Existing deterministic diagnostics and guidance are operational. No global versioned X4 rule/evidence registry
  exists; `forge.rules.json` is project-local suppression/contract policy and is deliberately not reused as global
  game truth.

## RECONCILE

- Searched diagnostic producers, flat-diagnostic consumers, project-local rules, migration rules, schema routing,
  MD/Lua cross-file checks, the capability map, decisions, program plan, and public owner issue.
- Existing detector logic is reused; this unit adds governance and provenance rather than a duplicate validator.
- Couplings checked: diagnostic codes to guidance, target-version availability to applicability, pack bytes to digest,
  and bundled metadata to the code-owned detector registry.
- Capability-map delta: pending implementation and validation; do not claim a new capability from this specification.
- Plan change: broad knowledge ingestion was narrowed to one governed vertical slice. Engine-dependent merge rules are
  explicitly deferred to W7 evidence instead of being accepted from prose.
- Dependency delta (2026-08-05): W7 engine-evidence prerequisite is now `VERIFIED` from run
  `w7_20260805_a97e2186_03` (X4 9.00 build `611726`; 11/11 markers and 9/9 semantic cases, with the supplied
  focused, schema, route, oracle, precommit, E2E, and install checks green). W7 no longer blocks rule-authoring;
  this plan remains `SPECIFIED` and rule-pack implementation has not started.

## IMPLEMENT

- Not started.

## VALIDATE

- Not run.

## REVIEW

- Pending requirement-by-requirement and fresh-eyes diff review.

## CLOSE

- Status: SPECIFIED.
- Remaining work: native implementation, focused/repository validation, ledger synchronization, explicit-path commit,
  push, and remote-parity proof.
- Suggested commit title: `feat(validation): add governed X4 rule evidence packs`.

## AAR

- Triggered: reconciliation rejected treating ungraded prose as validator truth and found that several desired checks
  already have deterministic owners.
- Sustain: bind knowledge to existing diagnostic authority instead of rebuilding detectors.
- Improve work/approach: grade every claim by schema, corpus, engine, runtime, or advisory evidence before admission.
- Improve tools: add a first-class evidence/applicability readback so unavailable evidence cannot look green.
- Highest-risk evidenced weakness: without a governed registry, an explanation can sound authoritative while its
  version scope and evidence basis remain implicit.
- Project lesson to bank at close: data may parameterize a code-owned detector but may never become an executable
  validator language.
