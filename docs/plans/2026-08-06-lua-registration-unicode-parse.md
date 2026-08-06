# Lua Registration Unicode Parse Availability

Status: VERIFIED (bounded repair)
Overall W10 status: OPEN / PARTIAL
Lane: FULL
Date: 2026-08-06
Canonical owner: GitHub #10
Task-owned file: `F:\DEV_ENV\X4_Forge\docs\plans\2026-08-06-lua-registration-unicode-parse.md` only for this
documentation close. The settled implementation scope was `src/lib/projectCrossFileValidation.ts`; this close does
not edit it.
Forbidden for this task: all other files, Git/GitHub mutations, mod/game/install mutation, and unrelated naming.

## PLAN

- **Bounded unit:** preserve Lua registration truth when source contains non-Latin-1 prose while retaining current event-wiring semantics and the existing selftest owner.
- **Authoritative context:** the current cross-file validator, its selftest, W10's `md_lua.missing_register` binding, the capability map/decisions, and this plan.
- **In scope:** same-length source substitution, range-preserving AST analysis, taint refusal, availability findings, false-claim suppression, and focused selftest coverage.
- **Non-goals:** no mod edits, `forge.rules` workaround, suppression workaround, deploy, UI, CLI product, network, spend, or delete behavior.
- **Risks/rollback:** a bad offset map could accept wrong event names or hide real gaps; rollback restores the source file and this plan.
- **Acceptance:** every method in VALIDATE passes; only the stated read-only mod check may inspect the real mod.

## BASELINE

- **Revision:** HEAD `9d829f2b0bd9e1fb7a97e7bc63b80ee7f3034bd9`; preserve unrelated dirty files.
- **Observed:** read-only mod validation loaded 26 files and reported 77 cross-file errors: 77 `md_lua.missing_register`, 0 `lua_md.missing_listener`; schemas available; project-rules errors 0.
- **Reproduced:** exact current luaparse options `{ comments: false, locations: true, ranges: true, scope: true, luaVersion: '5.2', encodingMode: 'pseudo-latin1' }` reject `aic_uix.lua 3563:112` on U+2014 in unrelated prose.
- `parseLuaRegisteredEvents` swallows that parse failure and returns `[]`, turning parse unavailability into false
  absence. The cause is pseudo-latin1 rejection plus swallowed unavailability, not a `StringLiteral.value`-only defect.
- A separate `encodingMode none` observation produced null `StringLiteral.value`; same-length non-Latin1 substitution
  plus pseudo-latin1 recovered all 43 literal registration values. That observation did not replace the reproduced
  cause above.
- This is a W10 blocking prerequisite because W10 binds `md_lua.missing_register`.

## RECONCILE

- Existing `parseLuaRegisteredEvents`, `validateProjectCrossFile`, and `runProjectCrossFileSelftest` are the sole relevant owners; reuse them.
- Existing direct/alias/wrapper registration, dynamic-prefix, comment-safety, and MD/Lua contract checks remain coupled and must retain their current semantics.
- The current producer returns no availability state, so downstream missing-register counting cannot distinguish “none found” from “not analyzed”; add that distinction in the producer result/finding path only.
- Capability-map delta: positive native availability/registration-truth facts and their negative boundaries are
  recorded; W10 remains the canonical consumer.

## IMPLEMENT

- Status: VERIFIED for the bounded Lua registration-analysis repair. The settled implementation was already
  independently reviewed and validated before this documentation close; this worker changed no implementation source.
- The repair parses a same-length substituted copy with the exact pseudo-latin1 options, preserves source
  offsets/locations, tracks substituted code units, and refuses tainted event literals while accepting untainted
  direct, alias, and wrapper registrations.
- Per-file parse availability is explicit through `validation.lua_ast_unavailable`; unavailable analysis suppresses
  manufactured `md_lua.missing_register` findings rather than becoming an empty registration set.
- The existing selftest covers Unicode prose, direct/alias/wrapper registrations, tainted event-literal refusal, and
  malformed-Lua availability/no-false-missing-register cases.

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
- Real read-only validation of the same 26-file mod: Verdict `VALID`, cross-file errors `0`, missing Lua registers
  `0`, missing MD listeners `0`, project-rules errors `0`, four unrelated scriptproperty warnings, exit `0`.
  No mod/game/install writes or deploy occurred.
- Pre-repair baseline on that mod was `77` `md_lua.missing_register` errors. The reproduced cause was luaparse
  rejecting U+2014 in unrelated prose, followed by the old catch converting parse failure to `[]`; it was not a
  `StringLiteral.value`-only cause.
- Negative path: malformed Lua produces `validation.lua_ast_unavailable` and zero false
  `md_lua.missing_register` claims.
- After the focused/build gates, a raw `node scripts/oracle-sweep.mjs` invocation without a server on
  `localhost:3001` exited `1` with `0/130` fetch-failed rows. This is a harness-invocation failure, not product
  evidence; the owning isolated oracle above is the corrected result.
- Evidence remains read-only for the real mod; no mod/game/install write or deploy occurred.

## REVIEW

- Baseline, offset/taint rules, availability diagnostic, false-claim suppression, focused tests, non-goals, and the
  read-only boundary all match the settled implementation and evidence.
- Fresh-eyes check: tainted `StringLiteral` values and AST ranges are never trusted, and malformed input cannot
  produce either a false absence or silent success.
- This repair closes the W10 blocking prerequisite only. W10 remains `OPEN / PARTIAL`; guidance/server/UI integration,
  broader rule families, update lifecycle, focused E2E, packaged/installed/rendered Antigravity proof, and W11 remain
  open.

## CLOSE

- Status: `VERIFIED` for the bounded Lua Unicode registration-analysis repair.
- W10 overall remains `OPEN / PARTIAL`. The next exact unit is rule provenance in the existing Why? guidance/server/
  selftest/E2E path, with focused E2E plus packaged, installed, and rendered-host proof. No installed claim is made
  for this checkpoint.
- Capability-map and project-AAR deltas record the positive availability fact and the negative rule that unavailable
  analysis must never become a clean or missing claim.
- No GitHub, commit, push, remote-parity, UI, package, install, or release completion is claimed here.

## AAR

- Triggered: reproduction corrected the earlier value-only theory. The actual failure is pseudo-latin1 rejection on
  U+2014 in unrelated prose plus a swallowed parse failure that manufactured missing-registration absence.
- Triggered: raw `node scripts/oracle-sweep.mjs` was invoked without its required server and returned `0/130`; it is
  recorded as a harness failure only. `npm run test:oracles` is the owning isolated validation and returned `131/131`.
- Sustain: preserve explicit parser availability and taint refusal so validator unavailability cannot become a clean
  result or an empty registration set.
- Improve work/approach: diagnose the complete parse/error path and original source range before interpreting
  `StringLiteral` values.
- Improve tools: raw oracle-sweep requires an already-running server on `localhost:3001`; use the isolated owner for
  standalone validation.
- Highest-risk evidenced weakness: a swallowed AST failure can manufacture `md_lua.missing_register` findings and
  conceal the real availability state.
- Project lesson: no validator unavailability may be represented as either clean or missing evidence.
