# Session handoff — B119 editbox descriptor-height source port

Date: 2026-08-30
Project: `F:\DEV_ENV\X4_Forge`
Status: bounded editbox source port `VERIFIED`, committed, pushed, and synchronized across durable owners; overall B119 `IN_PROGRESS / PARTIAL`

## Current repository state

- Source checkpoint `2443399ffdb46dbaca4eef784396cce4e68bcd02`
  (`feat(ui-editor): port editbox descriptor height semantics`) is pushed with exact local `HEAD`, `origin/main`,
  and direct remote `main` parity. Its index is empty.
- B119 implementation/test ownership is exactly these 15 paths:
  - `src/lib/luaStaticAnalysis.ts`
  - `src/lib/x4UiCallModel.ts` and `.selftest.ts`
  - `src/lib/x4UiLayoutKernel.ts` and `.selftest.ts`
  - `src/lib/x4UiLayoutProgram.ts` and `.selftest.ts`
  - `src/lib/x4UiLint.ts` and `.selftest.ts`
  - `src/lib/x4UiPreviewPipeline.selftest.ts`
  - `src/lib/x4UiScene.ts` and `.selftest.ts`
  - `src/lib/x4UiSourceEdits.ts` and `.selftest.ts`
  - `src/server/x4UiIntegration.selftest.ts`
- B119 record-close ownership is exactly `BACKLOG.md`, this handoff, and
  `docs/plans/2026-08-29-b119-editbox-descriptor-height-source-port.md`.
- Preserve every other dirty/untracked path. Continue explicit-path validation, staging, and commit only. In particular, do not absorb deleted Discord/data scripts, VS Code release work, W3B1 records, screenshots/media, issue templates, `REFACTOR-PLAN.md`, `pnpm-workspace.yaml`, or `target.name`.
- The exact native `gpt-5.6-luna` implementation worker is terminal and closed. No spawned worker remains open.

## Bounded capability now implemented

- The existing ordered call model recognizes source-located `table:setDefaultCellProperties("editbox", ...)`, `table:setDefaultComplexCellProperties("editbox", "hotkey", ...)`, and cell `setHotkey(...)` calls without executing arbitrary Lua.
- Layout replay follows shipped `helper.lua` ordering: simple defaults, complex defaults, then call-specific properties. A later default cannot mutate an existing cell; call-specific values override defaults.
- Direct `editbox:setHotkey(argument, properties)` now follows shipped assignment order: the first argument is applied, then a static `properties.hotkey` may override it. Valid but unported `x`/`y` properties retain exact source evidence and make the program/preview partial instead of disappearing.
- Effective editbox height applies shipped `Helper.editboxMinHeight = 23` only when the effective hotkey is non-empty and `displayIcon=true`; empty/hidden hotkeys retain base height.
- Source-proven button hotkey chains may include only colon-called `setText`, `setText2`, `setIcon`, and `setIcon2` between an exact earlier `createButton` and `setHotkey` in the same statement. Row binding, static cell index, and button identity are required.
- Generic `setIcon`/`setIcon2` receiver preservation now requires an already tracked button. Invalid editbox icon chains, ambiguous branches, wrong tables/cells, arbitrary indexed values, dot calls, unknown methods, and forged evidence fail closed.
- Scene producer transitions now require closed descriptor keys plus reciprocal own-key/static-source-property evidence. Omitted, dynamic, unavailable, arbitrary-extra, and coherently replayed forged facts are rejected; explicit `0`, `false`, and `""` remain present source values.
- The same authority reaches linter findings, Scene transition validation, source-edit closed schemas, project/package validation, and IDE Problems. Every preview remains `Not verified in game`.

## Exact validation authority at source checkpoint `2443399`

- Focused selftests all pass: CallModel `89/89`; LayoutKernel `34/34`; LayoutProgram `648/648`; Lint `140/140`; Scene `174/174`; SourceEdits `83/83`; integration `21/21`; aggregate `1,189/1,189`.
- Downstream independent checks also pass at the same revision: PreviewPipeline `105/105`, PaintPlan `175/175`, CanvasRenderer `129/129`, EditorSession, SourceBundle, and the complete X4 UI source-editor matrices.
- `npm run typecheck` passes.
- Exact 15-file ESLint passes with zero errors and eight pre-existing `luaStaticAnalysis.ts` `no-explicit-any` warnings.
- Exact 15-file `git diff --check` passes.
- Final configured official X4 9.00 census passes twice at the current source-law revision with the same ready manifest: `81/81/0`, `7,669,552` bytes, applicable fatal `0`, warnings `29`, unverified files `70`, truncated files `26`, verification gaps `13,681`, exit `0`. Six restricted-online-call errors remain visible and are non-applicable only for this trusted official-source census.
- The planned `26` warnings was a wrong forecast, not an acceptance target. Five displayed-hotkey omissions become clean; faithful button/editbox attribution restores three legitimate omitted-editbox warnings; net `31 -> 29` with all other census invariants unchanged.
- Coordinator review forced the original five causal corrections plus the later source-law closure: shipped `button:setIcon2` was initially omitted; generic cell `setIcon`/`setIcon2` preservation could falsely clean invalid editboxes; Scene accepted coherent facts for omitted properties; dynamic source properties could be materialized as static transitions; unavailable/arbitrary-extra facts could forge provenance; unsupported hotkey properties were dropped; `properties.hotkey` was rejected instead of overriding the argument; later exact overrides left stale lint uncertainty; producer replay could retain the wrong `displayIcon`; and Scene normalized underscore/hyphen/space property names differently from CallModel. All now have causal tests.
- Isolated oracles pass `134/134`. Exact Git-tracked serial E2E passes `103/103` with structured discovery/terminal
  parity, `ownershipComplete=true`, `treeGone=true`, and zero remaining PIDs. Complete precommit and the
  `1,848`-module production build pass. Graphify is refreshed to `10,029` nodes / `25,198` edges / `317`
  communities.
- Exact protected-root comparison proves `.studio-state`, `data`, repository `config.json`, and the installed
  Antigravity Forge config unchanged. Ports `3000/3001/3100/3101/52061/8972` are clear and X4 is absent.

## Machine and containment state

- The configured corpus remains `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`, pinned by the plan's Helper/widget hashes.
- A controlled retry proved volume `F:` online and healthy. The installed Forge sidecar loaded manifest generation `1785035333079-2178b4c31f`; the earlier timeout was startup readiness timing, not a storage disconnect.
- The installed 0.0.70 sidecar was started directly only for the read-only census, reached `/api/agent/schema`, and was stopped after two identical current-revision passes. Port `52061` has no listener, no matching server process remains, and its discovery file cleaned itself up.
- The operator supplied `go — Antigravity open; X4 not running; machine quiet` on 2026-08-30. Broad gates then ran
  serially. Final containment observes Antigravity open, `X4.exe` absent, the configured corpus reachable, all scoped
  ports clear, and no owned validation process remaining.

## External and durable record state

- GitHub #41 remains open with 78 comments. Comment `5469712047` names source commit `2443399...`, corrected
  corpus warnings `29`, focused `1,189/1,189`, serial host gates, and the remaining B119 boundary; its exact body was
  read back.
- Notion owner page `3b84618e-d15b-8190-821e-c0eb96f43d5a` remains `Status=In Progress`,
  `Evidence Grade=Partial`; its properties and appended 2026-08-30 checkpoint were read back with commit
  `2443399...` and GitHub comment `5469712047`.
- Google Doc `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was revision-locked and appended at
  `HEADING_2`. New revision
  `AIroW34i2k73hJ1YmnKtELjTFYTbDYMJBeWky7pZhoZnk8ti3ebnd1g4dUZYbAskwjckN61_0wEJUNpe09v8CsFimJDC-PMiFIDcxdH_okmc`
  and all eight inserted paragraphs were read back.
- StarForge capability-map and project/global AAR deltas record the same bounded close and false-green lifecycle
  failure shield.

## Next exact parent-B119 unit

1. Reconcile the large Forge frame outline and missing X4 background/alpha composition against exact shipped
   `helper.lua` / `widget_fullscreen.lua` paint ownership and the retained Forge/X4 screenshots.
2. Document one bounded source-port acceptance contract; keep arbitrary C++ acceptance and global pixel parity out of
   scope.
3. Route implementation/test edits through exact native `gpt-5.6-luna`; preserve unrelated dirty paths.
4. Validate focused source authority, both retained profiles, mounted rendered-host output, canonical corpus, serial
   host gates, and exact containment before another commit.
5. Continue with measured keep-outs, AI Influence visual reconstruction, installed-extension proof, OpenVSX
   publication, and final game comparison only as separately evidenced units.

## Remaining parent-B119 product units

- Explain and port the large frame outline plus X4 background/alpha composition from shipped source.
- Finish measured keep-out overlays and mounted MENU/HUB/COMM visual interaction proof.
- Visually reconstruct supplied AI Influence screen `1b` and remaining screens from inspected references using real emitted X4 Lua.
- Compare exact Forge/X4 pixels at both retained profiles, then run installed-extension proof, OpenVSX publish workflow, and final current-game audit.
- Preview is for layout; game is truth. Do not claim C++ acceptance, global 1:1 parity, or release completion before those gates close.

## Triggered AAR failure shields

- Do not turn a forecast count into a target; canonical source semantics decide the census.
- Button and editbox fluent calls share method names. Preserve identity only when widget type is source-proven, with cross-widget negatives.
- Sidecar connection timeout during startup is not storage evidence. Check volume health and wait for readiness before diagnosing I/O.
- Use literal-safe Windows paths when JavaScript composes PowerShell; the first retry command was rejected before launch after backslashes were consumed as JavaScript escapes.
- Scene source authority requires both value equality and reciprocal fact-key/source-key presence; unavailable facts are not equivalent to omitted facts.
- A green browser assertion count is not a green E2E receipt when root ownership or teardown is unavailable. Current
  Windows lacks `wmic.exe`; use the tested PowerShell/CIM adapter and retain the strict fail-closed parser.
- Isolated server owners must start only required services and fail when either owned temporary root cannot be removed.
- Focused green tests do not close B119 or authorize release. Require canonical corpus, serial host gates, rendered-host proof, installed package, and game evidence at the scope claimed.
