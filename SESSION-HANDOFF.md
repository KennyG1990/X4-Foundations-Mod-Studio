# Session handoff — B119 installed source materialization; visual parity active

Date: 2026-09-01
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL / Not verified in game`

## Session-start brief

- Project: X4 Forge B119, the linter-first source-faithful X4 Lua UI editor. GitHub owner: #41.
- Current bounded milestone: the reviewed 0.0.70 package is installed and mounted; registered Lua materialization is repaired and verified on a fresh read-only real-mod import. Three-menu Forge/X4 parity is not verified.
- Eyeball queue: none requires the sleeping operator now. Later experience gates are (1) compare Forge and X4 at 2544x1353, (2) compare at 1920x1080, and (3) inspect AI Influence screen 1b with measured keep-outs. Each must retain exact deployed hashes and `Not verified in game` until the live X4 check.
- Commit question: current B119 implementation is still based on HEAD `bd38ec6ca52fedc0db9e98be8e27be5c07b00b47` and is uncommitted. Commit the explicit B119/tooling paths after the recorded precommit proof; preserve all unrelated dirt.

## Installed host and package authority

- Installed extension: `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.70`.
- Managed sidecar: `127.0.0.1:60956`, PID `38296`, one listener, installed `app/dist/server.cjs` SHA-256 `626C651742402EC4C04FD7FEA4A2FD3190ADDC389170581C5688250165E67314`.
- Installed package: `vscode-extension/x4-forge-studio-0.0.70-b119-source-materialization-green2-019fea10.vsix`, 26,281,393 bytes, SHA-256 `057E5193FF35112F4A1978C291C1BCE371504CC1A139EA41B672CB19FE696CDF`.
- Package receipt: `dev-docs/b119-x4-ui-pipeline-smoke/frame-composition-runtime-20260831/records/source-materialization-green2-package/receipt.json`.
- Antigravity visibly mounts the real HUD & Lua UI SourceEditor, configured X4 9.00 corpus, source target controls, linter, source authority, scale/profile controls, and permanent `Not verified in game` state.
- The mounted persisted workspace predates the importer repair and still reports `missing-registered-lua` / `omitted-lua-source`. Do not confuse that stale snapshot with the fresh import oracle and do not replace the user's canvas casually.
- Fresh read-only import of configured `F:\DEV_ENV\projects\Mods\X4Mods\x4_ai_influence` materializes `ui.xml` plus all seven registered Lua files, including 568,069-byte `aic_uix.lua`; authority is `source-owned`, `editable:true`, `shippable:true`, with no generated collision.

## Current validation

- Detached exact-overlay precommit: PASS. Routes: `496/496`. Production build: PASS, 1,848 modules. Staged product: `16/16`. Package inspector: `13/13`; independent archive inspection: 2,107 entries.
- Frame-composition focused matrix: `1,344/1,344`; all nineteen X4 UI entrypoints pass. Current strict configured Scene rerun: `176/176`, exit 0.
- Exact configured census remains truthful and partial:
  - MENU: Layout 66 operations / 27 applied; Scene 16 cells / 3 widgets / 5 texts / 7 glyphs.
  - HUB: Layout 18 / 11; Scene 4 cells / 0 widgets / 0 texts / 0 glyphs.
  - COMM: Layout 14 / 12; Scene 3 cells / 0 widgets / 0 texts / 0 glyphs.
- Prior real-X4 `pipeline_test` evidence remains valid at 2544x1353 and 1920x1080, both actual UI scale 1. Buttons, editbox, close, package/deploy/recovery, and scaling were proven. It does not prove current three-menu pixel parity.
- X4 is not running. The user authorized unattended Forge updates, Computer Use, reversible `pipeline_test` deploys, and X4 launch for this sequence. Prefer no game launch until Forge has a new visual candidate worth comparing.

## Explicit source checkpoint paths

Frame-composition owners:

- `src/lib/x4UiCallModel.ts`
- `src/lib/x4UiCallModel.selftest.ts`
- `src/lib/x4UiLayoutProgram.ts`
- `src/lib/x4UiLayoutProgram.selftest.ts`
- `src/lib/x4UiScene.ts`
- `src/lib/x4UiScene.selftest.ts`
- `src/lib/x4UiPaintPlan.ts`
- `src/lib/x4UiPaintPlan.selftest.ts`
- `src/lib/x4UiCanvasRenderer.ts`
- `src/lib/x4UiCanvasRenderer.selftest.ts`
- `src/lib/x4UiPreviewPipeline.selftest.ts`

Importer/package/tooling owners:

- `server.ts`
- `scripts/route-integration.mjs`
- `src/lib/modCompiler.ts`
- `scripts/durable-writer-audit.mjs`
- `config/durable-writers.json`

Record owners:

- `BACKLOG.md`
- `SESSION-HANDOFF.md`
- `docs/plans/2026-08-30-b119-frame-background-composition-source-port.md`

Preserve all other tracked and untracked paths, especially Discord/data removals, W3B1 records, release wrapper changes, showcase media, screenshots, issue templates, and scratch files. Use explicit `git add -- <paths>` only.

## Next exact implementation unit

1. Capture one compact machine receipt grouping every MENU/HUB/COMM unapplied operation and Scene/Paint gap by source, kind, reason, and visual impact.
2. Reconcile the largest HUB/COMM visible-content cause against exact pinned `helper.lua` and `widget_fullscreen.lua` lines plus existing pipeline owners. Do not infer behavior from the zero-count test.
3. Document one bounded source-port contract. Route all implementation and task-level test edits through native `luna_executor`, exact `gpt-5.6-luna`, max, `fork_context=false`.
4. Require causal fail-first, focused green, source-law review, typecheck/lint/diff, strict configured census, mounted SourceEditor inspection, and graph refresh before another source commit.
5. Once three credible Forge menu candidates exist, compare them to real X4 screenshots at both retained profiles. Then complete keep-outs, AI Influence 1b/remaining screens, installed-release acceptance, OpenVSX publish-before-commit, and the final current-game audit.

## AAR failure shields

- A green exact-count census can freeze an incomplete renderer. HUB/COMM's zero visible output is baseline evidence, not parity evidence.
- A fresh import response and the workspace currently mounted in the editor are different state objects. Never promote or replace one based on the other without an explicit state mutation and rollback.
- A preview that renders is not proof of X4 C++ frame acceptance. Keep game truth external.
- Generic file-size caps can silently omit registered Lua and destroy round-trip authority even when one selected file previews.
- Preserve source exactness: property names, setter order, width/height fallback pins, and inactive texture applicability come from shipped Lua, not normalized browser conventions.
- Avoid broad output collectors and hard-coded status counts. Filter existing reporters narrowly and compare exact path sets.

## External records

- GitHub #41, Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive Doc `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` remain open/partial. Last pre-install projection: GitHub comment `5490501378`; Drive revision `ANLCKQlnw-0h1u2Pv_Hony7A8gbnTUV9UxLzUKvdJ7RWeVbBgxaFeeIfYE4OISquE74UGWKb9XJ5QQ78828MdNiK3rWSpt99DwgMzixkAvC_`.
- UI-modding KB: `F:\StarForge\wiki\x4-modding-methods\07 UI (Lua widgets, menus, overlays)\ui-modding-gotchas-quick-reference.md`, now 18 concise cards. Card 18 records the registered-Lua materialization failure shield.
- Update GitHub/Notion/Drive only after the source commit IDs exist; all projections must retain `PARTIAL / Not verified in game` and the HUB/COMM zero-visible-output boundary.
