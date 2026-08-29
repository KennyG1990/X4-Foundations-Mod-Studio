# B119 — source-calibrated editbox-height lint

Date: 2026-08-28
Owner: GitHub #41
Lane: FULL
Status: VERIFIED (bounded linter calibration; overall B119 remains PARTIAL)

## PLAN

- Bounded unit: remove the reproduced canonical-corpus false-fatal classification for omitted `createEditBox` height
  without losing the real zero-height defect that shipped in `pipeline_test`.
- Authoritative references:
  - supplied `FORGE-UI-EDITOR-BRIEF.md`, especially its linter-first and `preview for layout, game for truth` rules;
  - X4 9.00 `ui/addons/ego_detailmonitorhelper/helper.lua` at the pinned widget defaults, `initTableCell`, cell/editbox
    `getHeight`, and descriptor creation paths;
  - exact configured official corpus at `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`;
  - exact deployed `pipeline_test.lua` and its retained in-game zero-height editbox evidence.
- Assumptions resolved from source:
  - base widget height defaults to `0`;
  - table editbox defaults, when present, are applied before call-specific properties;
  - explicit `height = 0` therefore overrides a positive table default and remains directly source-proven zero;
  - omitted height is not universally zero at descriptor time because a table default or a displayed hotkey can supply
    height, and shipped menus use omission repeatedly in positive-height rows;
  - the current call model does not prove all table-default, hotkey, and C++ row-context behavior, so omission alone
    cannot remain a fatal static claim.
- In scope:
  - `src/lib/x4UiLint.ts`;
  - `src/lib/x4UiLint.selftest.ts`;
  - `src/server/x4UiIntegration.selftest.ts` only if needed to prove real project/Problems severity and blocking parity;
  - this plan and subsequent B119 close records.
- Out of scope: call-model vocabulary expansion, renderer/layout changes, corpus-script policy changes, package/deploy
  architecture, mod/game writes, X4 launch, installed-extension release, OpenVSX publish, and unrelated dirty files.
- Risk: a broad downgrade could hide the actual standalone omitted-height defect. The accepted policy is narrow:
  literal zero remains an error; statically omitted height becomes a warning that names the retained real-game failure
  and explains why omission alone is not universal proof; dynamic/unsupported height remains an explicit verification
  gap; positive height remains clean.
- Rollback: revert only the bounded source commit. The official corpus, mod, game, and configuration remain read only.

## ACCEPTANCE CONTRACT

1. `createEditBox({ height = 0 })` remains `x4-ui.editbox-height-minimum / error`, with the clipped/overlap log symptom,
   and blocks shared project/package readiness.
2. `createEditBox()` produces the same stable rule as a nonblocking warning, not an error or clean result. Its finding
   names the known zero-height failure, the official omission counterexamples, and the unmodeled default/hotkey/row
   boundary; its next action requires an explicit positive height or real-game verification.
3. The exact former `pipeline_test` omitted-height row trips that warning; the current explicit `height = 44` fixture is
   clean for this rule.
4. Positive static height remains clean. Dynamic/unsupported height remains `Not statically verified` without a fatal
   guess.
5. All eleven original brief-table rules retain positive, safe negative, dynamic/unresolved, and real failure-mode
   coverage. No unrelated rule identity, severity, or wording changes.
6. Shared integration proves omitted-height warning is nonblocking and preserved through project flattening and IDE
   Problems, while literal zero is blocking and preserved with exact path/code/line/severity/message.
7. The bounded configured corpus census reads `81/81` files with zero read failures and zero unexplained/applicable
   fatal findings. Official omission warnings remain visible; the corpus script itself is unchanged.
8. Focused linter, integration, Lua analyzer/project/package owners, TypeScript, exact owned-file ESLint, diff hygiene,
   and complete precommit pass. At least one unchanged negative-path test fails first under the old policy and passes
   only after production correction.
9. Every result remains `Not verified in game`; no static or corpus pass claims X4 engine acceptance.

## BASELINE

- Revision: `98374932b961335e85132374a0781ed008d35c77`, pushed with exact remote parity.
- Time: `2026-08-28T23:56:36.4724332-04:00`.
- Relevant paths were clean before this plan.
- Baseline SHA-256:
  - `src/lib/x4UiLint.ts` — `51C538DD9A26F196755162BDB26CDCBF87BF6227EBEFF818035959907606F680`;
  - `src/lib/x4UiLint.selftest.ts` — `EE948B7688B01D8C31A06093DF56A7DB62DCD4DF9964661C9EAC735EBEC7BA27`;
  - `src/server/x4UiIntegration.selftest.ts` — `CD67D08DBBD65FC5A598995F16C6DF5E1C3332DC632084E60F8439B33B47BD90`;
  - `scripts/x4-ui-lint-corpus-check.ts` — `487A51F9BCB836C77CAC109C1F3BCCA774C5C15DA6152E22792B6F1542EBB028`.
- Green baseline: focused linter `116/116`; project/Problems integration `7/7`; complete repository precommit green.
- Reproduced red baseline: `npm run test:x4-ui-corpus`, exit `1`, selected/read/failed `81/81/0`, applicable fatal
  errors `25`, all `x4-ui.editbox-height-minimum` omissions across shipped X4 9.00 files; warnings `6`, unverified files
  `70`, truncated files `26`, verification gaps `13,681`.

## RECONCILE

- Existing capability reused: one call model, one linter, generic analyzer projection, project flattening, package
  readiness, Problems mapping, UIBuilder/source-editor presentation, and the bounded official-corpus owner.
- Source facts checked:
  - `defaultWidgetProperties.widget.height = 0`;
  - editbox has no own default height;
  - `initTableCell` applies table defaults and then custom properties;
  - cell `getHeight` scales the resulting property;
  - editbox `getHeight` can enforce `Helper.editboxMinHeight = 23` for a displayed hotkey;
  - official omissions appear beside positive-height buttons/text or displayed-hotkey chains;
  - the retained pipeline failure was a standalone omitted-height editbox row and was repaired with explicit `44`.
- Presence proved: every original brief-table rule exists and current focused tests are `116/116`; source editor renders
  all normalized findings with severity, code, location, message, failure mode, evidence boundary, and next action.
- Gap proved: the post-smoke extra editbox rule is overbroad only for omission and makes the canonical census red.
- Capability-map delta: none until final green evidence. This unit calibrates an existing rule; it adds no new product.
- Plan change: no new linter rule is needed. Correct the false fatal first; renderer expansion remains paused.

## DOCUMENT PLAN

- This file is the bounded implementation and evidence owner. It is `SPECIFIED`; no implementation source has changed.
- Suggested source commit title after validation: `fix(ui-lint): calibrate omitted editbox height`.

## VALIDATION METHODS

- Focused fail-first/final: direct `x4UiLint.selftest.ts` under bundled Node `24.19.0`.
- Shared path: `npm run test:x4-ui-integration` plus direct analyzer/project/package/Problems owner selftests as applicable.
- Canonical negative oracle: unchanged `npm run test:x4-ui-corpus` against the configured 81-file selection.
- Static: `npm run typecheck`, exact owned-file ESLint with zero warnings, and exact-path `git diff --check`.
- Broad gate: `npm run precommit:check` under bundled Node `24.19.0` after the focused matrix is green.
- Visual/game methods are not applicable to this source-policy correction; the retained pipeline game evidence and
  canonical source counterexamples define the bounded calibration. The final status cannot exceed bounded static
  verification and does not clear overall B119.

## IMPLEMENT

- Changed `x4-ui.editbox-height-minimum` without changing its stable rule identity:
  - omitted call-specific height is a nonblocking warning;
  - explicit literal zero remains a blocking error under the selected conservative policy;
  - positive static height remains clean;
  - dynamic or unsupported height remains an explicit verification gap.
- Kept the known X4 log and clipped/overlapped failure mode visible in both findings.
- Source-faithful wording distinguishes the actual descriptor-height paths:
  - table default cell properties and displayed-hotkey minimum handling can supply positive editbox height;
  - positive row peers affect `row:getHeight()` only and do not supply the editbox descriptor height.
- Added focused former/current `pipeline_test` fixtures and shared project-validation/IDE-Problems severity parity tests.
- Changed only the three declared implementation/test owners. The call model, corpus owner, package/readiness logic,
  mod, game, configured corpus, and unrelated dirty files were not changed.

## VALIDATE

Validation completed at `2026-08-29T00:27:30.1399058-04:00` from revision
`98374932b961335e85132374a0781ed008d35c77` plus the bounded diff, using bundled Node `24.19.0` where applicable.

- Fail-first: the new omitted-height expectation failed against the old production policy because the finding was
  `error` and project-blocking. This proved the test could not pass before the production correction.
- Focused linter selftest: `118/118`, exit `0`.
- Shared project/Problems integration selftest: `11/11`, exit `0`.
- Direct package-readiness parity probe with a package-valid UI-only fixture: exit `0`; omitted height produced one
  `x4-ui.editbox-height-minimum / warning` and zero package errors, while literal zero produced the same rule as the
  sole package-blocking error at `ui/editbox_package_probe_custom.lua:5`.
- The first package probe correctly preserved finding severity but exited `1` because its minimal fixture omitted
  `OpenMenu` and independently triggered `lua.menu_never_opened`. Adding the required open call isolated the intended
  package-readiness contract; no production policy was weakened.
- TypeScript: `npm run typecheck`, exit `0`.
- Exact owned-path ESLint with `--max-warnings 0`: exit `0`.
- Exact-path `git diff --check`: exit `0`.
- Official X4 9.00 corpus, unchanged script and configured root:
  - status `no-known-fatal-static-gaps`;
  - selected/read/failed `81/81/0`;
  - bytes `7,669,552`;
  - applicable fatal errors `0`, down from the reproduced baseline `25`;
  - warnings `31`, leaving the omitted-height cases visible rather than suppressing them;
  - six restricted-online-call findings remained visible and explicitly not applicable only to trusted official
    base/DLC source census;
  - unverified files `70`, truncated files `26`, verification gaps `13,681`.
- Full repository lint: exit `0`, `0` errors and `592` warnings. The unrelated warning debt was not modified.
- Production build: exit `0`; Vite transformed `1,848` modules and esbuild produced `dist/server.cjs`. The existing
  large-chunk warning remained nonfatal.
- First raw `node scripts/oracle-sweep.mjs`: exit `1`, `0/133`, because its default `localhost:3001` server was not
  running. No oracle executed; this was an invocation/environment failure, not product evidence.
- Correct isolated owner `npm run test:oracles`: runtime-index discovery, `134/134` green, exit `0`, against an
  ephemeral server at `127.0.0.1:8972`.
- Isolation readback: ports `8972`, `3001`, `3100`, and `3101` were clear after the run; live ports `3000` PID
  `21500` and `3300` PID `32036` were unchanged. The harness left
  `C:\Users\Moshi\AppData\Local\Temp\x4-oracle-discovery-17744`; an exact validated cleanup attempt was blocked by
  the host destructive-operation policy, so the temp-only directory was left in place rather than bypassing policy.
- Complete `npm run precommit:check`: exit `0`, including 55/55 E2E verdict selftest, Vite lifecycle, product-copy,
  durable writers, capability contract, MCP capability, action-receipt coverage, typecheck, and large-file guards.
- Native visual and in-game validation were not applicable to this severity-policy-only correction. Every finding
  still says `Not verified in game`; this result does not claim general X4 frame acceptance.

## REVIEW

1. Literal zero remains a blocking error: **done and evidenced** by focused and shared integration tests.
2. Omission is a visible nonblocking warning with the real failure and source boundary: **done and evidenced**.
3. Former omitted/current `height = 44` pipeline fixtures: **done and evidenced**.
4. Positive static and dynamic/unsupported branches: **done and evidenced**.
5. Original brief-table coverage retained: **done and evidenced** by the complete `118/118` focused matrix.
6. Project flattening and IDE Problems parity: **done and evidenced** by `11/11` integration checks.
7. Official corpus has no applicable fatal findings: **done and evidenced** by `81/81/0`, fatal `0`.
8. Declared focused, static, build, oracle, and precommit gates: **done and evidenced**.
9. No preview/game overclaim: **done**; the permanent boundary remains explicit.

Fresh-eyes review rejected the worker's first wording that row peers could supply effective editbox height. Shipped
`helper.lua` proves row peers influence row height only; the worker corrected production copy and tests before the
coordinator accepted the diff. No unrelated metadata or generated-file churn was added to the owned diff.

## CLOSE

- Status: **VERIFIED** for this bounded editbox-height lint calibration.
- Overall B119 status: **PARTIAL**. This close does not clear renderer pixel parity, complete helper/widget coverage,
  general engine acceptance, installed-extension release, or broader in-game experience proof.
- Capability-map delta: the existing X4 UI linter claim is strengthened from a reproduced official-corpus false-fatal
  state to source-calibrated severity with the unchanged 81-file canonical census green. No new product surface was
  introduced.
- Rollback remains one exact source commit after commit creation; the mod, game, corpus, and live workspace were not
  mutated.
- Suggested commit title: `fix(ui-lint): calibrate omitted editbox height`.

## AAR

- Triggers: fail-first test; reproduced canonical-corpus false fatal; fresh-eyes source correction; first package
  probe had an unrelated missing-`OpenMenu` error; incorrect raw oracle invocation; blocked temp cleanup.
- Sustain: the unchanged official corpus was the decisive negative oracle. It caught a policy defect that the focused
  green suite could not reveal and proved the repair without weakening visibility.
- Improve work/approach: source claims must separate row-height aggregation from per-widget descriptor height. The
  first worker wording passed tests but was rejected by direct `helper.lua` review. Package-readiness probes must use
  a valid standalone-menu lifecycle before their aggregate blocking state can isolate one lint rule.
- Improve tools: invoke repository oracles through `npm run test:oracles`, not the raw sweep without a server. The
  isolated harness should clean its `x4-oracle-discovery-*` directory in `finally`; this task did not expand scope to
  repair that unrelated harness defect.
- Highest-risk evidenced weakness: the call model still cannot resolve table default cell properties or editbox
  hotkey minimum handling. The bounded mitigation is conservative findings plus an explicit evidence boundary;
  future model expansion must be source-ported and corpus-tested before either warning can be narrowed further.
- Lessons to bank: project AAR records the descriptor-height distinction and corpus-first severity calibration;
  workflow AAR records the isolated-oracle invocation and temp-cleanup failure shield.
