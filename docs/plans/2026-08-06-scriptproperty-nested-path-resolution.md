# Scriptproperty Nested-Path Resolution — W10 Prerequisite

Status: VERIFIED
Overall W10 status: OPEN / PARTIAL
Lane: FULL
Date: 2026-08-06
Owner: W10 implementation coordinator; this record closes the supplied implementation checkpoint
Supersedes: `docs/plans/2026-08-06-x4-rule-lifecycle-scriptproperty.md` as the next executable prerequisite

This durable record closes a bounded implementation prerequisite. It authorizes no new source, test, package, install, mod, game, configuration,
Git, GitHub, ledger, or external-path write in this documentation task. W10 rule-pack provenance and lifecycle work
remain OPEN / PARTIAL and deferred as a separate unit after this prerequisite.

## PLAN

- **Bounded unit:** repair the existing scriptproperty parser/index/linter and its existing selftest so authored
  multi-token property paths are traversed deterministically, including datatype return transitions and inheritance.
  Reuse `src/lib/scriptProperties.ts`, `lintScriptPropertyChains`, `runScriptPropertiesSelftest`, and the existing
  project-validation callers. Do not add a second validator.
- **Authoritative references:** X4 9.00
  `F:\Downskies\x4unpackersuitev1\X4 unpacked 9.00\libraries\scriptproperties.xml`; the current
  `src/lib/scriptProperties.ts` index/linter; `src/server/projectValidation.ts` and its validation route/CLI;
  the existing scriptproperty selftest/oracle harness; and the superseded historical record linked above.
- **Existing infrastructure reused:** the XML parser, `ScriptPropertyModel`/`ScriptPropertyIndex`, datatype
  inheritance, dynamic-segment handling, suggestions, masking, variable-type hints, `scriptproperty.unknown`,
  `scriptproperty.requires_subselector`, project validation, and installed extension validation output.
- **Implementation intent:** retain complete normalized authored paths (not only globally flattened heads and one
  continuation), match literal and placeholder segments in order, carry each matched property's declared datatype to
  the next segment, and include inherited datatype paths with cycle-safe deterministic traversal. A placeholder
  continuation may be authored as a braced/dynamic selector or as an unbraced literal. When the selector domain is not
  deterministically available, the pure scriptproperties engine must keep the continuation opaque/unavailable and
  produce no finding without certifying the selector value. Project-symbol type hints are conservative candidate
  prioritization, not proof; all datatype-path candidates must remain available to traversal.
- **In scope:** the existing scriptproperty index/validator, one isolated fixture added to its existing selftest,
  regression coverage against the real 9.00 corpus, and the validation/install evidence required below.
- **Out of scope:** W10 rule-pack binding, diagnostic provenance, lifecycle/update/deprecation/supersession
  evaluator, other rule families, severity/verdict expansion, automatic fixes, CLI/product redesign, a second
  validator, external providers, network or spend, and any mod/game/install/configuration write.
- **Risks and authorization boundaries:** accepting a token globally instead of at its authored path can hide real
  typos; treating an unbraced placeholder literal as syntactically invalid creates false positives; inventing a
  datatype after a primitive or unavailable return creates false confidence; and a no-finding opaque continuation is
  not proof that its selector value is valid. Known datatype transitions must still warn on known impossible paths.
  An unavailable or malformed corpus must not be presented as a clean result. Real-mod validation is read-only
  and must record the exact result before any installed proof. This task performs no external mutation.
- **Rollback/checkpoint:** the supplied implementation checkpoint preserved the dirty baseline. If a later
  reconciliation fails, revert only the bounded source/test changes and owned record edits; no Git mutation is
  authorized in this worker.

### Acceptance criteria

1. The index represents authored property paths as ordered tokens, including multi-token names such as
   `free.all` and placeholder continuations such as `free.{$tag}`. A placeholder continuation may be authored as a
   braced/dynamic selector, such as `free.{event.param.transporttag}` or
   `controlentity.{controlpost.commander}`, or as an unbraced literal, such as the authored
   `isclass.ship_xl`, `isclass.ship_l`, `isclass.ship_m`, and `isclass.sector` forms. Syntax alone must not reject an
   unbraced literal. When a deterministic selector domain is unavailable, the engine produces no finding and does
   not certify the selector value as valid. A globally known token is never accepted at an invalid location solely
   because it exists elsewhere in the corpus. Bare unknown identifier roots remain skipped by the existing contract
   and are not part of this repair.
2. Traversal is deterministic and path-aware. It follows known datatype return transitions at each matched segment,
   resolves inherited properties without cycles, handles nullable suffixes and authored dynamic/list selectors using
   the existing rules, and does not flatten unrelated heads into a valid chain. An empty or unavailable declared
   result type creates an opaque/unavailable continuation state: deeper segments are not statically judged. Once an
   actual dynamic/list/variable selector makes the result type unavailable, later literal segments remain unchecked
   unless an authored path and known result type deterministically retain them. Known impossible paths still warn.
3. Project-symbol variable types are conservative hints, not proof. Traversal may prioritize hinted datatype paths but
   must retain all datatype-path candidates, so valid paths such as `$Foes.count` are not narrowed away. An untyped
   root such as `event.object` may retain valid owner/knownname continuations even though the corpus declares no type
   for it. The implementation must not claim a type from a primitive or unavailable return, and a no-finding opaque
   continuation must not be reported as selector-domain validation. Incomplete or malformed corpus/index input
   remains unavailable or explicit, never an inferred clean result.
4. The isolated fixture proves all of the following exact outcomes:
   - `$pship2.cargo.free.all?`, `$nsh.cargo.free.all`, `$pship2.cargo.free.solid`, and
     `$pship2.cargo.free.{event.param.transporttag}`: zero findings;
   - `$fc.isclass.ship_xl`, `$fc.isclass.ship_s`, `$fc.isclass.sector`, `$sb.isclass.ship_s`,
     `$destination.{1}.isclass.sector`, `$Foes.count`, and `event.object.owner.knownname`: zero findings. The placeholder/list
     cases are conservative no-finding results where the selector domain or root type is unavailable, not claims that
     every selector value is valid;
   - untyped `$pship2.cargo.free`: zero findings because at least one complete authoritative `modulecargolist.free`
     candidate survives alongside pending `containercargolist` `free.*` candidates; this is conservative ambiguity
     handling, not proof that the runtime root is a `modulecargolist`;
   - focused `$holder.containercargo.free` with a known `containercargolist` transition: exactly one
     `scriptproperty.requires_subselector` finding at `free`, with all six explicit selector suggestions `all`,
     `solid`, `container`, `liquid`, `universal`, and `condensate`;
   - `$pship2.cargo.free.notreal` and `$station.controlentity.name`: zero findings as explicit domain-unavailable
     conservative cases, without certifying either selector value;
   - `$pship2.cargo.notreal`: exactly one `scriptproperty.unknown` finding at `notreal`;
   - `$pship2.cargo.hullpercentage`: exactly one `scriptproperty.unknown` finding at `hullpercentage`, despite
     that token existing globally;
   - `$obj.param2`: exactly one `scriptproperty.unknown` finding because `param2` is keyword-only;
   - bare `$station.controlentity`: exactly one `scriptproperty.requires_subselector` finding;
   - `$station.controlentity.default` and `$station.controlentity.{controlpost.commander}`: zero findings.
5. The real 9.00 corpus regression proves `containercargolist` inherits from `cargolist`, the `cargo` transition
   returns the cargo-list datatype, and `free.all`, `free.solid`, `free.container`, `free.liquid`, `free.universal`,
   `free.condensate`, and the corpus placeholder `free.{$tag}` are available at the correct nested path. The
   authored fixture `$pship2.cargo.free.{event.param.transporttag}` must pass, and authored X4 usage proves that
   `isclass.{$class}` accepts unbraced literal selectors including `ship_xl`, `ship_l`, `ship_m`, and `sector`.
   Syntax alone cannot prove an unbraced placeholder selector invalid. No global-head shortcut is used.
6. Existing behavior remains green: typed event/faction checks, masking, nullable suffixes, dynamic/list selectors,
   suggestions, inherited properties, valid `list.count` paths, and unavailable-index honesty remain unchanged.
   The untyped `$pship2.cargo.free` ambiguity case is zero findings because at least one complete authoritative
   `modulecargolist.free` candidate survives alongside pending `containercargolist` `free.*` candidates; this is
   conservative ambiguity handling, not proof that the runtime root is a `modulecargolist`. The focused
   `$holder.containercargo.free` fixture retains `scriptproperty.requires_subselector` at `free` with all six explicit
   free-selector suggestions. Bare `controlentity` retains `scriptproperty.requires_subselector`. The
   domain-unavailable continuations
   `free.notreal` and `controlentity.name` remain no-finding conservative cases, while known deterministic warning
   cases retain their current code, severity, message, line, chain, and suggestions.
7. Negative/refusal behavior is explicit: `$pship2.cargo.notreal` remains exactly one `scriptproperty.unknown` at
   `notreal`; `$pship2.cargo.hullpercentage` remains exactly one `scriptproperty.unknown` at `hullpercentage` even
   though that token is known elsewhere; and `$obj.param2` remains exactly one `scriptproperty.unknown` because it is
   keyword-only. Bare `$station.controlentity` remains `scriptproperty.requires_subselector`. The route-integration
   negative uses `$pship2.cargo.notreal`, not `free.notreal`. Known datatype transitions warn on known impossible
   paths; empty/unavailable result types and dynamic/list/variable selectors leave deeper segments unchecked. No
   datatype is overclaimed, malformed/incomplete corpus input is unavailable or explicit, and no no-finding opaque
   chain is presented as selector validity.
8. Read-only validation of `F:\DEV_ENV\projects\Mods\X4Mods\x4_ai_influence` must be `VALID`, with both MD and
   AIScript schemas loaded, `0` structural/unresolved/cross-file/schema/AIScript errors or warnings as applicable,
   and `0` raw and active scriptproperty warnings. The supplied failed candidate result of `79` raw and `49` active
   scriptproperty warnings is baseline evidence and is not acceptable completion. The exact command, findings, and
   read-only output must be recorded in this plan; no mod or game file is written.
9. The correction does not bind scriptproperty provenance, change rule-pack/lifecycle behavior, alter severity or
   verdict policy, or close W10. Those remain a later OPEN unit.
10. The implementation close crosses every applicable gate: typecheck; zero-error lint; scriptproperty selftest;
    project validation/oracle; the route negative using `cargo.notreal`; full isolated E2E containment; build;
    stage/package/inspect/probe; installed current-mod proof; precommit; Graphify; ledger readback; and exact Git
    parity. Any unavailable or failed required gate is PARTIAL or BLOCKED, never VERIFIED.

### Acceptance / refusal matrix

| Case | Required result |
| --- | --- |
| `$pship2.cargo.free.all?`, `$nsh.cargo.free.all`, `$pship2.cargo.free.solid` | No findings; nullable `?` does not change the known valid path. |
| `$pship2.cargo.free.{event.param.transporttag}` | No findings; authored dynamic/braced selector is retained as a valid path. |
| `$pship2.cargo.free` | Zero findings; at least one complete authoritative `modulecargolist.free` candidate survives alongside pending `containercargolist` `free.*` candidates. This is conservative ambiguity handling, not proof that the runtime root is a `modulecargolist`. |
| `$holder.containercargo.free` | Exactly one `scriptproperty.requires_subselector` at `free` from the known `containercargolist` transition, with all six explicit suggestions `all`, `solid`, `container`, `liquid`, `universal`, and `condensate`. |
| `$pship2.cargo.free.notreal` | Zero findings; selector domain is unavailable, so the continuation is opaque and the engine does not certify `notreal`. No free-selector suggestion requirement applies. |
| `$pship2.cargo.notreal` | Exactly one `scriptproperty.unknown` at `notreal`; route integration uses this deterministic negative. |
| `$pship2.cargo.hullpercentage` | Exactly one `scriptproperty.unknown` at `hullpercentage`, although that token is known elsewhere; location matters. |
| `$obj.param2` | Exactly one `scriptproperty.unknown` at `param2` because `param2` is keyword-only. |
| `$station.controlentity` | Exactly one `scriptproperty.requires_subselector`; the parent has no authored continuation. |
| `$station.controlentity.name` | Zero findings; selector domain is unavailable, so the continuation is opaque and the engine does not certify `name`. |
| `$station.controlentity.default`, `$station.controlentity.{controlpost.commander}` | No findings; the known literal and authored dynamic/braced selector are retained. |
| `$fc.isclass.ship_xl`, `$fc.isclass.ship_s`, `$fc.isclass.sector`, `$sb.isclass.ship_s` | No findings; authored X4 usage permits unbraced literal placeholder selectors, without syntax-only rejection or selector-domain certification. |
| `$destination.{1}.isclass.sector`, `$Foes.count`, `event.object.owner.knownname` | No findings; dynamic/list or untyped-root continuation remains conservative and must not be narrowed away by a project-symbol hint. |
| Known datatype followed by a known impossible segment | Deterministic warning at that segment; path-aware traversal is retained. |
| Empty/unavailable declared result, or dynamic/list/variable selector with unavailable result type | Deeper literal segments are unchecked and produce no finding; no datatype or selector validity is claimed. |
| Malformed or incomplete corpus/index | Unavailable or explicit degradation; never a false clean result. |
| Actual dynamic/list selector, mask, suggestion, nullable, event/faction, inheritance, and list-count fixtures | Existing selftest outcomes remain green and unchanged; placeholder syntax is not rejected solely because a selector is unbraced. |

## BASELINE

- **Revision:** supplied and confirmed read-only: `HEAD/origin =
  e47dab5c600ed9954c938124d5a116a81daa3983`.
- **Worktree:** the supplied implementation checkpoint was settled before this record close. All unrelated modified,
  deleted, and untracked paths are preserved and outside this task's write scope.
- **Authoritative read-only inputs:** the corpus is
  `F:\Downskies\x4unpackersuitev1\X4 unpacked 9.00\libraries\scriptproperties.xml`. The real-mod validation
  command is `npm run validate:mod -- F:\DEV_ENV\projects\Mods\X4Mods\x4_ai_influence`; it is read-only for this
  plan and must not write mod or game files.
- **Failed candidate evidence:** the supplied command result was `VALID` for `26` files, with structural `0`,
  unresolved cues `0`, cross-file `0`, schema errors/warnings `0/0`, both MD and AIScript schemas loaded, and
  AIScript errors `0`. It nevertheless reported `79` raw scriptproperty warnings and `49` active scriptproperty
  warnings. That candidate is failed baseline evidence, not acceptable completion; the settled implementation result
  recorded below supersedes it.
- **False-warning categories and direct probe:** list variables such as `$Foes.count` were narrowed by conservative
  project-symbol hints; `event.object` has no declared type but valid `owner`/`knownname` continuations; and
  dynamic/list selectors such as `$destination.{1}.isclass.sector` plus placeholder literals such as
  `$fc.isclass.ship_xl` and `$sb.isclass.ship_s` were falsely warned. The direct no-type-hint probe observed
  `$Foes.count` clean; `$fc.isclass.ship_xl` wrongly requiring `isclass`; `$destination.{1}.isclass.sector` wrongly
  requiring `isclass`; `event.object.owner.knownname` wrongly unknown at `owner`; `cargo.free.all` clean; and
  `cargo.free.notreal` currently requiring `free`.
- **Corpus and authored-usage facts:** the authoritative file contains `cargolist`/`containercargolist`, literal
  cargo paths `free.all`, `free.container`, `free.solid`, `free.liquid`, `free.universal`, and `free.condensate`,
  plus the placeholder `free.{$tag}`. Authored usage includes dynamic cargo selection as
  `free.{event.param.transporttag}`, `controlentity.default`, and braced controlentity selection. It also proves
  that `isclass.{$class}` accepts unbraced literal selectors such as `ship_xl`, `ship_l`, `ship_m`, and `sector`.
  Therefore syntax alone cannot prove an unbraced placeholder selector invalid. `event.object` has no declared type.
  The current index still needs complete path-aware traversal and conservative candidate retention.

## RECONCILE

- **Resources and readers/writers searched:** `scriptproperties.xml`; the existing parser/index/linter and selftest;
  `projectValidation`; validation route/CLI/oracle callers; expression/reference consumers that rely on the same
  index; the current W10 plans; and the current handoff/baseline.
- **Existing capability reused:** one code-owned validator, one corpus-backed index, one diagnostic currency, and the
  existing selftest/project-validation/package/install surfaces. No duplicate detector, path resolver, or policy store
  is permitted.
- **Couplings checked:** corpus paths -> index records -> chain traversal -> findings -> project validation and CLI;
  index behavior -> suggestions/dynamic/masking/typed checks; packaged server -> installed current-mod output; and
  corrected validation output -> the later W10 provenance prerequisite.
- **Authoritative correction:** the real corpus and authored X4 usage disprove the blanket braced-only placeholder
  rule. A placeholder continuation may be braced/dynamic or unbraced literal; `isclass.{$class}` is used with
  unbraced selectors such as `ship_xl`, `ship_l`, `ship_m`, and `sector`. Syntax alone cannot reject the latter.
  Where no deterministic selector domain is available, the pure engine must produce no finding while making no
  selector-validity claim. This makes `$pship2.cargo.free.notreal` and `$station.controlentity.name` explicit
  domain-unavailable conservative cases; future governed reference-domain validation is outside this prerequisite.
- **Type-hint correction:** project-symbol variable types are conservative hints only. Traversal may prioritize them,
  but it must retain all datatype-path candidates so list paths such as `$Foes.count` survive. `event.object` has no
  declared type, yet valid `owner`/`knownname` continuations must remain candidates. Dynamic/list/variable selectors
  that make a result type unavailable create opaque continuations; later literal segments are unchecked unless an
  authored path and known result type deterministically retain them. This correction is an AAR trigger.
- **Acceptance correction:** verified implementation readback found that untyped `$pship2.cargo.free` retains both a
  complete authoritative `modulecargolist.free` candidate and pending `containercargolist` `free.*` candidates, so
  the conservative engine returns zero findings. That result is ambiguity handling, not proof that the runtime root is
  a `modulecargolist`. The exact `requires_subselector`-at-`free` result with all six explicit selector suggestions
  belongs to the focused `$holder.containercargo.free` fixture, whose `containercargolist` transition is known. This
  small acceptance-contract correction is a triggered AAR/reconciliation change; full verification is not claimed.
- **Deterministic negatives:** path-known failures remain exact: `$pship2.cargo.notreal` is one
  `scriptproperty.unknown` at `notreal`, `$pship2.cargo.hullpercentage` is one at `hullpercentage`, `$obj.param2`
  is unknown because `param2` is keyword-only, and bare `$station.controlentity` remains
  `scriptproperty.requires_subselector`. The route integration negative is `cargo.notreal`, not `free.notreal`.
- **Plan/lifecycle boundary:** the old lifecycle plan is therefore SUPERSEDED for this prerequisite, and its
  provenance/lifecycle acceptance cannot bind until this repair is green.
- **Capability-map delta:** the verified close records only the bounded path-aware validator, datatype/inheritance,
  conservative-candidate, opaque-unavailable, deterministic-negative, and installed-proof delta.
- **Plan changes:** the active unit remains the existing nested-path validator prerequisite, but its contract now
  accepts both braced/dynamic and unbraced placeholder continuations, treats unavailable selector domains as
  conservative zero-finding opaque states, retains all datatype-path candidates beyond project-symbol hints, and
  preserves deterministic path negatives. Untyped `$pship2.cargo.free` is a zero-finding ambiguity case; the six
  free-selector suggestions apply to the focused `$holder.containercargo.free` `requires_subselector` finding, not to
  `free.notreal`. W10 lifecycle/provenance remains OPEN / PARTIAL.

## DOCUMENT PLAN

State: VERIFIED

- **Scope:** close only the completed path-aware existing-index repair and its focused regression evidence.
- **Required nested-path fixtures:** valid literal, braced/dynamic, unbraced-placeholder, and dynamic/list paths;
  untyped `$pship2.cargo.free` with zero findings because a complete authoritative `modulecargolist.free` candidate
  survives alongside pending `containercargolist` `free.*` candidates, as conservative ambiguity handling rather than
  proof of a `modulecargolist` runtime root; focused `$holder.containercargo.free` with a known `containercargolist`
  transition and exactly one `scriptproperty.requires_subselector` at `free` with all six explicit free-selector
  suggestions;
  domain-unavailable `$pship2.cargo.free.notreal` and `$station.controlentity.name` with zero findings and no
  validity claim; deterministic unknowns at `$pship2.cargo.notreal`, `$pship2.cargo.hullpercentage`, and
  `$obj.param2`; the conservative `$Foes.count`, `event.object.owner.knownname`, and
  `$destination.{1}.isclass.sector` paths; and the corrected controlentity literal/braced-selector cases.
- **Non-goals:** all out-of-scope items in PLAN, especially rule-pack/lifecycle/provenance work and external writes.
- **Implementation surfaces used:** the existing scriptproperty source/index/selftest seam and its established
  project-validation fixture/harness only; no parallel validator or new product surface.
- **Evidence locations:** this plan; the read-only corpus path above; the exact real-mod command/result above;
  focused selftest output; real-corpus regression output; project/oracle receipts; isolated E2E containment receipt;
  package/stage/inspect/probe results; and the installed rendered observation plus machine-readable sidecar readback
  in the current task transcript. No screenshot file path is asserted or created by this documentation task.
- **Rollback:** revert only the bounded source/test changes or owned record edits and preserve the pre-existing dirty
  inventory.

## IMPLEMENT

- The existing script-property index and traversal now retain authored ordered paths, follow datatype return
  transitions and inheritance, preserve all datatype candidates beyond project-symbol hints, and keep unavailable
  selector continuations opaque. The existing selftest, validation, route, package, and installed surfaces were
  extended; no parallel validator or policy surface was introduced.
- The integrated health-card safe-area prerequisite was already verified in its dedicated plan. This close records its
  integrated installed and E2E evidence without modifying that plan.

## VALIDATE

### Completed close checks

- Script-property selftest: `61/61`.
- Semantic readback: zero findings for `$pship2.cargo.free`, `.free.all?`, `.free.all`, `$nsh.cargo.free.all`,
  `.free.solid`, `.free.{event.param.transporttag}`, `.free.notreal` (unavailable selector domain),
  `$station.controlentity.name` (unavailable selector domain), `.default`, `.{controlpost.commander}`,
  `$fc.isclass.ship_xl`, `$fc.isclass.ship_s`, `$fc.isclass.sector`, `$sb.isclass.ship_s`,
  `$destination.{1}.isclass.sector`, `$Foes.count`, and `event.object.owner.knownname`.
- Exact deterministic findings: `$pship2.cargo.notreal` is one `scriptproperty.unknown` at `notreal`;
  `$pship2.cargo.hullpercentage` is one `scriptproperty.unknown` at `hullpercentage`; `$obj.param2` is one
  `scriptproperty.unknown`; bare `$station.controlentity` is one `scriptproperty.requires_subselector`; and
  focused `$holder.containercargo.free` is one `scriptproperty.requires_subselector` with all six suggestions
  `all`, `solid`, `container`, `liquid`, `universal`, and `condensate`.
- Semantic boundary readback: untyped roots retain all datatype candidates and hints only prioritize; empty or
  unavailable return types and unavailable dynamic/list selector remainders remain opaque. A no-finding opaque
  continuation is not selector-validity certification. Known datatype transitions still warn on known impossible
  paths, malformed or incomplete index input remains unavailable or explicit, and no datatype is inferred from a
  primitive or unavailable return.
- Schema intelligence: `168/168`. Typecheck: `0`. Focused lint: `0`. Route integration: `449/449`.
- Read-only real-mod validation: `26` files, Verdict `VALID`; structural `0`, unresolved `0`, cross-file `0`, schema
  `0/0` with both MD and AI-script schemas loaded, AI-script `0`, scriptproperty `0`, active/raw `0/0`, and
  project-rules `0`, with no findings in the bounded result.
- Full lint: exit `0`, `0` errors / `593` warnings. Runtime oracles: `132/132`.
- Full E2E: `96/96`, failed `0`, flaky `0`, complete structured report, `complete=true`, `trigger=child-close`,
  `treeGone=true`, `remainingPids` empty, and ports `3100/3101` closed. Receipt
  `test-results/e2e-verdict.json` was generated `2026-08-06 13:31:43Z`.
- Focused health-card safe-area E2E: `1/1`; a delayed health response of `2.5s` exceeded the `1.5s` helper bound,
  yet the card became visible, stayed clear of the right tool rail and bottom navigation, and accepted a normal
  unforced click. The terminal report proved `treeGone` and closed ports. The full E2E also carries this regression.
- Root production build and extension build: green. Stage-app: green. Secrets-clean: green. Staged package probe:
  `16/16`, including schema, configuration, and corpus checks.
- Package: `F:\DEV_ENV\X4_Forge\vscode-extension\x4-forge-studio-0.0.63-scriptproperty-path-resolution-20260806.vsix`;
  `18,076,422` bytes; SHA256
  `15CAA66FEDA0D1C1D087FA3E7635300A106E8EADD8020A9A3A9029E22412705E`; inspector PASS with `2091` entries and
  `61,322,134` unpacked bytes.
- Installed proof: `x4forge.x4-forge-studio@0.0.63` is installed at
  `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.63`; critical file parity is `7/7`,
  and the installed package manifest equals the package manifest after excluding injected `__metadata`. The
  installed rendered observation reports Forge `v1.0.424` from the current package, Mission Director `1507` elements
  loaded (`md.xsd` + `common.xsd`), AI-script `1408` elements, script properties `2333`, and safe-area placement
  visibly clear of current chrome. The installed script-property selftest is `61/61`.
- Installed import preview: actual `x4_ai_influence`, `116` selected files, Mission Director + AI Scripts +
  Libraries/Patches + Lua/UI + Translations, `2925` graph nodes; imported manifest workspace renders as `x4 AiLive`
  with readiness `VALID` and `0` errors / `11` warnings.
- Installed-sidecar readback fromPath validation of `x4_ai_influence`: `ok=true`, `26` loaded files, structural `0`,
  unresolved `0`, cross-file `0`, missing Lua registrations/listeners `0/0`, schema errors/warnings `0/0`, AI-script
  errors `0`, script-property warnings/findings `0/0`, and rules errors `0`. `scriptProperties` and both schemas are
  available.
- The two active `.ware.name` warnings, representing five duplicate raw reference findings, are the already-recorded
  ROADMAP `KB-3` `reference.unknown_ware` false positive. They are outside this checkpoint, are not a new regression,
  and are not fixed here; overall validation is therefore not called warning-free.
- Negative/refusal readback and rendered installed observation are recorded in the task transcript; no screenshot
  file path is invented. No version bump, marketplace publication, mod/game write, or deploy occurred.
- Graphify update from the repository root completed at `5572` nodes / `13642` edges / `217` communities.
- The original task baseline was `HEAD/origin = e47dab5c600ed9954c938124d5a116a81daa3983`. The final pushed
  implementation checkpoint is `2a404fc406881fa03c14bd9f4234ea51da6f56c2`, subject
  `fix(validation): resolve nested script-property paths`; this documentation close performs no Git mutation.

### Required validation matrix — completed

| Layer | Required evidence | Refusal / failure rule |
| --- | --- | --- |
| Focused behavior | Selftest `61/61`; exact semantic matrix and deterministic negatives above | Any wrong finding count would fail this close. |
| Static/integration | Schema `168/168`; typecheck `0`; focused lint `0`; routes `449/449`; full lint `0` errors / `593` warnings | Red required gate would be PARTIAL/FAILED. |
| Project/oracle | Read-only `26`-file `VALID`; runtime oracles `132/132`; installed-sidecar readback above | No stale, mocked, or inferred result accepted. |
| Negative/refusal | Unavailable selector domains, primitive/unavailable returns, invalid locations, keyword-only property, and malformed-index refusal semantics | No global-token acceptance, datatype overclaim, selector-validity claim, or false clean result. |
| E2E/containment | Focused health-card `1/1`; full E2E `96/96`; terminal report, tree, ports, and live-workspace containment | Leaked process/ports/state or workspace change would be red. |
| Build/package | Root and extension builds, stage-app, secrets-clean, package probe `16/16`, package hash/size, inspector PASS | Stale/incomplete package or probe failure would block close. |
| Installed product | Rendered installed observation plus sidecar `fromPath` readback, schemas available, script-property selftest `61/61` | Source-only, old, different-workspace, or DOM-only proof would be insufficient. |
| Governance/records | Graphify `5572/13642/217`; implementation commit/push parity and GitHub ledger readback below | No broader W10 or program closure is claimed. |

The completed close records the exact commands/results, warning/error counts, corpus identity, package hash, receipt
path, installed rendered observation, machine-readable sidecar readback, and unavailable-validation boundary above.
The real-mod result remains read-only.

## REVIEW

- Criteria 1-3: done and evidenced by ordered path matching, datatype transitions/inheritance, candidate retention,
  conservative hints, and opaque unavailable-selector semantics.
- Criterion 4: done and evidenced by selftest `61/61`, the complete zero-finding set, exact warnings, and the focused
  six-suggestion `requires_subselector` result.
- Criteria 5-7: done and evidenced by real-corpus regression, installed-sidecar readback, deterministic negatives,
  and refusal behavior for unavailable or malformed states.
- Criterion 8: done and evidenced by the read-only `26`-file `VALID` result with both schemas and zero bounded
  script-property warnings/findings; the two active `.ware.name` warnings are the already-recorded `KB-3` false
  positive and remain outside this checkpoint.
- Criterion 9: done; no script-property provenance, rule-pack binding, lifecycle/update claim, severity change, or
  verdict-policy change was added, and W10 remains `OPEN / PARTIAL`.
- Criterion 10: done and evidenced by the complete static, focused, route, oracle, E2E, build, package, installed,
  Graphify, implementation commit/push parity, and GitHub ledger readback checks below.
- Fresh-eyes review challenged global-head shortcuts, both placeholder forms, unavailable selector domains, project
  hints, candidate retention, inheritance, datatype transitions, primitive/unavailable returns, malformed-index
  honesty, the exact deterministic findings, focused suggestions, health-card safe-area placement, installed parity,
  and containment. No broader lifecycle claim or screenshot path was invented.

## CLOSE

- **Status:** `VERIFIED` for the bounded nested script-property path-resolution prerequisite and the integrated
  health-card safe-area prerequisite. Overall W10 remains `OPEN / PARTIAL`; the overall extension-native program
  remains `IN_PROGRESS / PARTIAL`; W3 remains `PARTIAL` at `3/5`.
- **What changed:** the existing path-aware validator now records and traverses authored nested paths deterministically,
  carries datatype transitions and inheritance, preserves all candidate paths beyond hints, and treats unavailable
  selector remainders as opaque. The integrated health-card safe-area behavior is green in focused and full E2E and
  visibly clear of the current chrome in the installed rendered observation.
- **What does not change:** unrelated dirty paths, rule-pack provenance, W10 lifecycle/update behavior, severity or
  verdict policy, product boundary, mod/game state, open GitHub issue state, and the dedicated health-card plan.
- **Capability/ledger:** record only the bounded path-aware traversal, datatype/inheritance, conservative candidate,
  opaque-unavailable, deterministic-negative, and installed-proof delta. No broad lifecycle claim is made.
- **Baseline/rollback:** the original task baseline was `HEAD/origin =
  e47dab5c600ed9954c938124d5a116a81daa3983`; the final pushed implementation checkpoint is
  `2a404fc406881fa03c14bd9f4234ea51da6f56c2`. Recovery is limited to the bounded implementation checkpoint and
  owned record edits. This documentation worker made no Git, GitHub, package, install, mod, game, or deploy mutation.
- **Implementation checkpoint and projection readback:** commit
  `2a404fc406881fa03c14bd9f4234ea51da6f56c2` has subject
  `fix(validation): resolve nested script-property paths`. Required precommit exited `0` in `388.8s` with final
  `[precommit] OK`; the commit hook reran the gate and also ended `[precommit] OK`. Push `main -> origin/main`
  succeeded, and read-only parity proves `HEAD == origin/main == remote refs/heads/main` at the full hash. GitHub
  issues `#9`, `#10`, and `#18` remain `OPEN / PARTIAL`; each has exactly one marker block, with respectively `4`,
  `3`, and `3` full-hash references and forbidden-name counts of `0`. No issue closure or overall program closure is
  claimed. The prior provenance documentation mirror is already closed at
  `e47dab5c600ed9954c938124d5a116a81daa3983`; it is not pending.

## AAR

- **Outcome:** triggered, with all product gates green for this bounded checkpoint. The project-specific trigger detail
  is recorded in the project AAR; reusable workflow/tool lessons are recorded in the global AAR.
- **Points to sustain:** keep authored path order, datatype transitions, inheritance, conservative candidate retention,
  opaque unavailable states, deterministic negatives, and installed rendered proof as separate evidence layers.
- **Points to improve - work/approach:** retain the exact acceptance corrections: unbraced placeholder literals are
  authored forms, project-symbol types are hints, and the untyped `$pship2.cargo.free` result is conservative
  ambiguity handling rather than runtime-root proof.
- **Points to improve - tools:** keep search, shell, oracle, E2E, package, and installed-host probes independently
  bounded and read back their machine results before classifying a product gate.
- **Highest-risk evidenced weakness:** a no-finding opaque continuation can be mistaken for selector validity. Keep
  unavailable selector domains explicit and never turn the current `KB-3` `.ware.name` false positive into a new
  regression or a scope-expanded repair.
- **Triggered categories:** search quoting/Windows glob expansion; spawn-message syntax; the rejected first semantic
  candidate with `49` active / `79` raw findings; corpus/placeholder/type-hint acceptance corrections; unsupported
  direct oracle invocation `0/131` before the supported harness `132/132`; first E2E timeout/orphan cleanup and later
  `95+1` health collision before `96/96`; shell probe mistakes including one combined PowerShell readback brace parse
  error corrected before any file read; health-worker wrapper rejection and receipt-override typo; locked same-version
  install `EPERM` before successful close/reinstall; manifest comparison normalization for
  injected `__metadata`; stale sidecar/UI restart and target-loss/bounds-change retries; and reconciliation of the
  `.ware.name` observation to existing `KB-3`. These were tooling, harness, acceptance, or evidence events, not
  product gate failures.
