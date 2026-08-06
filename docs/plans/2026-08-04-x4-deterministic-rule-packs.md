# Deterministic X4 Rule and Evidence Packs

Status: VERIFIED (bounded data-only checkpoint)
Overall W10 status: OPEN / PARTIAL
Lane: FULL
Date: 2026-08-04
Owner: GitHub #10, W10 rule/evidence-pack feature owner
Parent/program cross-reference: GitHub #18, no-unexplained-gap program ledger only; it is not a second feature owner.

## PLAN

- **Bounded unit:** add a strict, versioned, data-only X4 rule/evidence-pack authority, a code-owned detector registry,
  one bundled core JSON pack, deterministic resolution, and a focused selftest. This batch exposes the authority for
  a dependent guidance batch; it does not integrate the pack into `diagnosticExplain`, the UI, or the server.
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
- **Existing infrastructure reused:** the shared flat diagnostic currency and exact diagnostic codes; the browser-safe
  canonical-shape and dependency-injected SHA-256 boundary in `src/lib/forgeCapabilities.ts`; project-local
  `forge.rules.json` remains separate suppression/contract policy.
- **In scope:** strict parser; canonical ordering and SHA-256 identity; evidence grades; game-version applicability;
  exact code-owned detector IDs; exact/prefix diagnostic-code parameters with bounded values; duplicate/unknown-key
  refusal; one bundled core pack; diagnostic-to-rule resolution; authority/provenance exports; focused tests; the
  package test script.
- **Out of scope:** a general-purpose rule DSL; arbitrary regex or code loaded from data; project suppressions;
  prompt execution; AI verdicts; XML merge claims; balance judgments; automatic fixes; network updates; integration
  into `diagnosticExplain`, existing Why? guidance, any UI or server route, focused E2E, package/install/rendered
  Antigravity proof, CLI product, marketplace release, or edits to the user's mod/game installation. The dependent
  guidance batch must treat Why? guidance changes as user-visible and run focused E2E plus package/install/rendered
  Antigravity validation.
- **Affected surfaces:** the owned library, bundled JSON pack, focused selftest, package script, and this plan only;
  no diagnostic guidance, UI, server, program ledger, or GitHub mutation is part of this batch.
- **Risks and authorization boundaries:** malformed or over-broad packs could misrepresent validator authority. The
  parser therefore fails closed, evidence is immutable by digest, applicability is explicit, and only detector IDs
  compiled into Forge may run. This unit performs no external write, network call, spend, deletion, or game mutation.
- **Rollback/checkpoint:** remove the new owner, bundled pack, focused selftest, and package script; no guidance
  integration exists in this batch. Baseline revision is `9d829f2b0bd9e1fb7a97e7bc63b80ee7f3034bd9`; preserve all
  unrelated dirty files.

### Acceptance criteria

1. The parser rejects malformed JSON, unknown keys, unknown detector IDs, duplicate pack/rule IDs, invalid semantic
   versions or ranges, unsupported evidence grades, empty or over-limit parameters, and non-data executable fields.
2. Canonical serialization and SHA-256 identity are stable across object-key order and reject any content drift.
3. Applicability has deterministic `applicable`, `not_applicable`, or `unavailable` outcomes; a missing target version
   can never be interpreted as pass or applicability.
4. Detector selection is code-owned. The bundled pack can bind only bounded exact diagnostic codes or code prefixes;
   it cannot supply regex, JavaScript, shell, prompt, XPath, or another executable expression.
5. The initial bundled rules bind routed `XSD_*` schema diagnostics and the existing
   `md_lua.missing_register` plus `lua_md.missing_listener` event-contract findings without duplicating those
   detectors.
6. A matched diagnostic resolves to one stable native rule ID, evidence grade, applicability scope, pack identity, and
   evidence digest through the authority; an unmatched or ambiguous diagnostic refuses honestly. Existing guidance
   consumption is deferred to the dependent batch.
7. Focused tests cover valid load, deterministic ordering/hash, every refusal class, version boundaries, missing-version
   unavailability, exact/prefix matching, no false match, duplicate-match ambiguity, and identity/provenance readback.
8. Typecheck and the applicable deterministic oracle pass. Task-owned repository wording names native implemented
   capabilities.

### Validation and evidence

- Focused rule-pack selftest with exact pass count and negative paths.
- `npm run typecheck`.
- `git diff --check --` over the owned paths, exact owned-path diff review, and dirty-worktree preservation check.
- Repository search proving prohibited executable fields are absent from task-owned files; task-owned repository wording
  names native implemented capabilities.
- No existing Why? guidance validation is applicable to this data-only slice because no guidance consumer changes;
  when the dependent batch changes that user-visible surface, focused E2E plus package/install/rendered Antigravity
  proof is mandatory.
- Evidence is recorded in this plan and the repository/GitHub owner close; no runtime/UI claim is made in this slice.

## BASELINE

- Revision: `9d829f2b0bd9e1fb7a97e7bc63b80ee7f3034bd9` on `main`, equal to `origin/main` at baseline.
- The worktree contains unrelated user and prior-program changes listed by `git status --short`; none are owned here and
  all must remain unchanged.
- Existing deterministic diagnostics and guidance are operational. No global versioned X4 rule/evidence registry
  exists; `forge.rules.json` is project-local suppression/contract policy and is deliberately not reused as global
  game truth.

## RECONCILE

- Searched diagnostic producers, flat-diagnostic consumers, project-local rules, migration rules, schema routing,
  MD/Lua cross-file checks, the capability map, decisions, program plan, and public owner issue.
- Existing detector logic is reused; this unit adds governance and provenance rather than a duplicate validator.
- Current-source reconciliation: routed schema authorities emit uppercase `XSD_*` codes; MD/Lua authorities emit
  `md_lua.missing_register` and `lua_md.missing_listener`. The pack must bind those exact existing codes and add no
  duplicate detectors.
- Couplings checked: diagnostic codes to the future guidance consumer, target-version availability to applicability,
  pack bytes to digest, and bundled metadata to the code-owned detector registry.
- Browser-safe hash boundary checked: `x4RulePacks.ts` must not import `node:crypto`; injected SHA-256 and optional
  async Web Crypto verification are the only hash boundary, with `node:crypto` confined to the selftest.
- Applicability checked: no target game-version owner exists on the current diagnostic surface, so bounded rules must
  return `unavailable` when the target version is absent; unbounded rules may be `applicable`.
- Capability-map delta: the verified native authority, pack identity, existing-detector bindings, and explicit Lua
  registration-analysis availability are recorded in the capability map; the negative boundaries remain explicit.
- Plan change: broad knowledge ingestion was narrowed to one governed vertical slice. Engine-dependent merge rules are
  explicitly deferred to W7 evidence instead of being accepted from prose.
- Dependency delta (2026-08-05): W7 engine-evidence prerequisite is now `VERIFIED` from run
  `w7_20260805_a97e2186_03` (X4 9.00 build `611726`; 11/11 markers and 9/9 semantic cases, with the supplied
  focused, schema, route, oracle, precommit, E2E, and install checks green). W7 no longer blocks rule-authoring.
- Ownership correction (2026-08-05): GitHub #10 is the sole canonical W10 feature owner; GitHub #18 is retained only
  as the no-unexplained-gap program cross-reference. GitHub is not modified in this batch.
- Scope correction (2026-08-05): guidance/UI/server integration is a dependent batch, so this slice validates the
  authority and pack only; the later user-visible Why? guidance change carries focused E2E and package/install/rendered
  Antigravity gates.

## IMPLEMENT

- Status: VERIFIED for the bounded data-only authority/evidence-pack slice. The settled implementation was already
  independently reviewed and validated before this documentation close; this worker changed no implementation source.
- The native authority now provides strict parsing, canonical ordering, SHA-256 identity, applicability outcomes,
  evidence grades, code-owned detector resolution, and provenance readback for the bundled core pack.
- The bundled pack hash is
  `351cb0199c815df91861205bf0bce85b22ed98f1bb695dcaa9345f5001e2f9c0`.
- The pack binds the existing `XSD_` diagnostic-code prefix, `md_lua.missing_register`, and
  `lua_md.missing_listener`; it creates no duplicate detector.
- The blocking Lua registration-analysis repair preserves availability for Unicode-containing Lua source and keeps
  unavailable analysis from becoming a missing-registration claim. Its exact diagnosis and evidence are closed in
  `docs/plans/2026-08-06-lua-registration-unicode-parse.md`.

## VALIDATE

- Project-crossfile selftest: `25/25`, exit `0`.
- X4 rule-pack selftest: `32/32`, exit `0`.
- Owning isolated oracle: `npm run test:oracles` exit `0`; runtime-index discovery; `131/131` green against the
  isolated harness at `127.0.0.1:8972`, including project-crossfile `25/25` and diagnostic-explain `8/8`.
- `npm run typecheck`: exit `0`.
- `npm run build`: exit `0` (Vite and bundled server).
- `npm run lint`: exit `0`, `0` errors / `593` warnings overall; the owned parser subset is `0` errors / `7`
  warnings in `projectCrossFileValidation.ts`.
- `graphify update .`: exit `0`; `5,541` nodes / `13,555` edges / `215` communities.
- Owned documentation diff check: `git diff --check` exit `0`; one LF/CRLF advisory only.
- Real read-only validation of `F:\DEV_ENV\projects\Mods\X4Mods\x4_ai_influence`: Verdict `VALID`, cross-file
  errors `0`, missing Lua registers `0`, missing MD listeners `0`, project-rules errors `0`, four unrelated
  scriptproperty warnings, exit `0`. No mod/game/install write or deploy occurred.
- The same 26-file mod's pre-repair baseline was `77` `md_lua.missing_register` errors. Reproduction showed
  luaparse rejecting U+2014 in unrelated prose and the old catch converting parse failure to `[]`; this was false
  absence, not a valid clean result.
- Negative path: unavailable or malformed Lua analysis remains explicit and cannot produce a manufactured
  `md_lua.missing_register` finding.
- After the focused/build gates, a raw `node scripts/oracle-sweep.mjs` invocation without a server on
  `localhost:3001` exited `1` with `0/130` fetch-failed rows. This is recorded as a harness-invocation failure,
  not product evidence; the owning isolated oracle above is the corrected result.
- No UI/server/guidance integration or installed-product proof exists for this checkpoint. The dependent
  user-visible batch must run focused E2E plus packaged/installed/rendered Antigravity proof.

## REVIEW

- Requirements 1-7: done and evidenced by the focused selftests, deterministic oracle, exact pack hash, refusal and
  ambiguity coverage, version applicability, exact/prefix bindings, and provenance readback.
- Requirement 8: done for typecheck, lint, build, oracle, hash, documentation, and read-only real-mod evidence.
  Guidance/UI/server integration, packaged/installed/rendered proof, broader rule families, update lifecycle, and W11
  remain outside this bounded slice.
- Fresh-eyes review confirmed that the pack binds existing diagnostic authorities without a duplicate detector, that
  pack identity is digest-pinned, and that unavailable analysis cannot become a clean or missing claim.
- Program context remains W3 `PARTIAL` at `3/5` and W7 `VERIFIED`; neither status is changed by this checkpoint.

## CLOSE

- Status: `VERIFIED` for the bounded data-only rule/evidence-pack authority and blocking Lua Unicode
  registration-analysis repair.
- W10 overall remains `OPEN / PARTIAL`. Broader rule families, update lifecycle, Why? guidance/server/UI integration,
  focused E2E, packaged/installed/rendered Antigravity proof, and W11 remain open.
- The next exact unit is rule provenance in the existing Why? guidance/server/selftest/E2E path. It must carry focused
  E2E plus packaged, installed, and rendered-host proof; no installed claim is made for this checkpoint.
- No GitHub, commit, push, remote-parity, UI, package, install, or release completion is claimed here. Unrelated dirty
  files remain outside this documentation scope.

## AAR

- Triggered: the settled repair corrected a reproduced fail-open parse path, and the raw oracle sweep was initially
  invoked without its required server. The raw `0/130` result is not relabeled green; the owning isolated harness
  produced the separate `131/131` result recorded above.
- Sustain: bind data only to existing deterministic diagnostic authorities; preserve exact pack identity and explicit
  applicability/provenance rather than rebuilding detectors or treating prose as executable policy.
- Improve work/approach: the Unicode failure is pseudo-latin1 rejection on U+2014 in unrelated prose plus swallowed
  parse unavailability, not a `StringLiteral.value`-only defect.
- Improve tools: raw `node scripts/oracle-sweep.mjs` requires an already-running server on `localhost:3001`; use
  `npm run test:oracles` and its isolated runtime-index harness for standalone oracle validation.
- Highest-risk evidenced weakness: validator unavailability must never become either a clean result or an empty
  registration set that manufactures `md_lua.missing_register`.
- Project lesson: native rule packs may parameterize code-owned detectors, but data must not become an executable
  validator language and unavailable analysis must remain explicit.
