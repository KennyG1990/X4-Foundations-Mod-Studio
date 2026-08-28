# Session handoff — B119 source-proven numeric geometry

Date: 2026-08-28
Project: `F:\DEV_ENV\X4_Forge`
Status: bounded source-proven numeric frame geometry `VERIFIED`; overall B119 `IN_PROGRESS / PARTIAL`

## Current repository state

- Source checkpoint `13af741735fb4309996292037c41223b853052eb` is committed and pushed with exact
  local/tracking/direct-remote parity. Preserve every unrelated dirty path and use explicit-path staging only for the
  record-only close.
- Bounded owned implementation/test paths are:
  - `src/lib/x4UiCallModel.ts`
  - `src/lib/x4UiCallModel.selftest.ts`
  - `src/lib/x4UiLayoutProgram.ts`
  - `src/lib/x4UiLayoutProgram.selftest.ts`
  - `src/lib/x4UiScene.selftest.ts`
- Owned records for this checkpoint are:
  - `docs/plans/2026-08-28-b119-source-proven-numeric-geometry.md`
  - `BACKLOG.md`
  - `SESSION-HANDOFF.md`
- Production `x4UiScene.ts`, Paint, Canvas, SourceEditor, server routes, deploy owners, the mod, game directory, X4
  profile, unpacked corpus, and Antigravity configuration were not changed.
- The native Luna implementation worker is terminal and closed. No spawned worker remains open.

## Bounded capability now implemented

- The call model emits a deeply frozen, exact-source numeric-expression descriptor for numeric literals, accepted
  Helper constants, bound direct `scaleX` / `scaleY` results, grouping, unary sign, binary `+ - * /`, and Lua `or`.
- The layout program independently reparses the model's exact Lua 5.2 source, validates every descriptor node/operator/
  operand/range against that AST, pins Helper receiver and direct-scale identities, rejects later reachable reassignment,
  and resolves only against the selected normalized profile.
- Source-proven expressions are excluded from preview-sample authority. Internal descriptor metadata is removed from
  issued operation/evidence metadata, so the existing Scene/public contract is unchanged.
- The all-copy same-context alias-decoy defect is closed: a valid nearby `/4` formula can no longer impersonate the
  selected `/2` binding. The selected alias value expression and location must equal the descriptor root.
- This is not a generic Lua evaluator. Unknown identifiers, conditional/reassigned aliases, unsupported calls/operators,
  modulo/power/`and`, divide-by-zero/non-finite values, malformed/forged/range/schema inputs, and `scaleFont` geometry
  remain unavailable or rejected.

## Current validation authority

- Focused suites: Call Model `72/72`; Layout Program `641/641`; Scene `153/153`; configured MENU/HUB/COMM census `3/3`.
- Static gates: whole-repository TypeScript exit `0`; exact owned-file ESLint exit `0`; owned diff hygiene exit `0`;
  full repository lint exit `0` with zero errors and `592` pre-existing warnings.
- Graphify refreshed deterministically to `9,955` nodes / `24,922` edges / `334` communities;
  `projectX4UiLayoutProgram()` resolves with `84` relationships.
- Runtime-indexed isolated oracle owner: `134/134` green. The preceding raw no-server sweep `0/133` is retained as an
  invocation/AAR failure and is not product evidence.
- First full E2E is retained red: test 24 retried, execution later died after test 81 with Windows `0xC0000409`, and no
  complete structured report existed. Receipt SHA-256 `E0D2AE77...B7653B5` is under
  `dev-docs/b119-source-proven-numeric-geometry/e2e-red-20260828-01/`.
- Controlled bundled Node `v24.19.0` full E2E: `104/104` in `7.9m`, zero failed/flaky/bad/quarantined-blocking,
  discovery `104 == terminal 104`, child-close, `treeGone=true`, zero remaining PIDs. Receipt SHA-256
  `F58275F0...C6DEFB4` is under `dev-docs/b119-source-proven-numeric-geometry/e2e-green-20260828-01/`.
- Complete precommit passed: verdict `55/55`, durable writers `14/14 + 8/8`, capability `12/297/1/11`, MCP contract,
  action receipts `82/56`, TypeScript, and size guards. Production build passed with `1,848` modules.

## Exact real `pipeline_test` read-only proof

- File: `F:\DEV_ENV\projects\Mods\X4Mods\pipeline_test\ui\pipeline_test.lua`.
- Before/after: `5,488` bytes and SHA-256
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`; byte-identical.
- Parsed target: `menu.createFrame`, lines `77-106`, offsets `2709-4565`.
- `1920x1080`, UI scale `1`: x `695`, y `322`, width `530`, height `436`.
- `2544x1353`, UI scale `1.25`: x `940.5`, y `404`, width `663`, height `545`.
- x/y retain the exact line-83/84 source formulas; width/height retain the line-81/82 direct Helper call sources. Both
  program/evidence pairs validate. Both programs remain `partial` because of nineteen unrelated unsupported facts.
- Prior deployed-X4 evidence for this unchanged four-file / `6,338`-byte package remains under
  `dev-docs/b119-x4-ui-pipeline-smoke/in-game-20260828/`. It proves real X4 acceptance/interactions at both profiles,
  but no new pixel-edge comparison was captured in this checkpoint.

## Machine and containment state

- X4 was closed normally with Alt+F4 and is absent.
- Ports `3000/3001/3100/3101/8972` are free; no owned oracle/E2E/precommit/build/Graphify process remains.
- Persisted Antigravity Forge config remains byte-identical at SHA-256
  `355B4B636AD6C0BB3B58DEA793DE409C2375B8A81230433C0F0FDD48FBEE3B5A`.
- The configured unpacked X4 9.00 corpus remains
  `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` and was read only.

## Commit and bookkeeping boundary

- Implementation commit `13af741735fb4309996292037c41223b853052eb` (`feat(ui-editor): project source-proven
  numeric geometry`) is pushed with exact local/tracking/direct-remote parity and an empty index.
- GitHub #41 comment `5458587855` was written and read back verbatim; the issue remains open.
- Notion owner page `3b84618e-d15b-8190-821e-c0eb96f43d5a` contains and read back the source-proven geometry section,
  exact source commit, both profiles, focused/broad gates, preserved red E2E, and full-B119 PARTIAL boundary.
- Google Doc `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, exact tab `t.0`, was revision-locked from
  `AIroW35ORAD2b16wtqsH8JNjJ03uib5jxFvleX03tDcvhkOVlZmEgQmddPsyOveZSskE7fp54ySMVePGX8lvtV7cve4MvkxLj-v86YevGGag`
  to `AIroW34vaIbo_BkljAW6-Et0lTWBHdAk1cEJujn4fuHgb38zN9PXQzfgeOjPtSMMt17rhizxVjqhN6vGLQ2u06QWlUuKyd8oXu2GRsmnSEzr`.
  Readback proves the exact document/title/tab, `HEADING_2` marker, all inserted paragraphs, and matching revision.
- `F:\StarForge\wiki\x4-forge\capability-map.md` now explicitly supersedes only the earlier dynamic-geometry
  unavailability claim; `F:\StarForge\wiki\x4-forge\aar-log.md` records the bounded task and triggered hazards.
- Record-only precommit passed under bundled Node `24.19.0`: tripwires/canon, verdict `55/55`, Vite lifecycle,
  product copy, durable writers `14/14 + 8/8`, capability `12/297/1/11`, MCP, action receipts `82/56`, TypeScript,
  and size guards are green. The record-only commit owns only this handoff, the B119 plan, and `BACKLOG.md`, with title
  `docs(ui-editor): record source-proven geometry checkpoint`; its resulting hash is reported by Git/remote readback
  because a commit cannot cite its own hash.

## Next product boundary

1. Measure exact Forge frame/button/text/editbox pixel edges against the already captured X4 screenshots at both profiles;
   do not infer parity merely because the source formula now resolves.
2. Continue complete `helper.lua` / `widget_fullscreen.lua` port coverage, remaining linter rules and keep-out behavior,
   then reconstruct the AI Influence UI from all visually inspected references.
3. Keep `Not verified in game` permanent for internal preview receipts. Do not publish OpenVSX until B119 reaches release
   quality and the unrelated extension release edits are reconciled with their owner.

## Triggered AAR hazards

- A structurally valid descriptor copied from a nearby same-context expression escaped until the alias root's ordinary
  expression/location was pinned. Keep the all-copy decoy regression.
- Raw `oracle-sweep.mjs` requires a running server; use `npm run test:oracles` for isolated standalone evidence.
- Default Node `24.15.0` produced an incomplete `0xC0000409` E2E run. Bundled Node `24.19.0` is the accepted controlled
  runtime on this host; the failed receipt remains evidence rather than being overwritten conceptually.
- Large selftest/artifact JSON must be reduced in-process. One raw Layout run emitted roughly 51 MB, and one recursive
  artifact listing exceeded the tool boundary.
- The Google Docs trusted-read bridge requires an existing Windows workspace root and an absent immutable output
  directory. This isolate lacks `atob` and `TextDecoder`; byte-verified JSON source loading preserved the checked-in
  bridge unchanged, then the revision-locked write/readback passed.
- Highest risk remains a convincing preview being mistaken for game truth. This checkpoint proves exact bounded frame
  facts, not C++ acceptance or 1:1 pixels.
