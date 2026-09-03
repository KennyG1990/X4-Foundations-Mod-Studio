# Session handoff — B119 current source imported; opaque dynamic-text sample next

Date: 2026-09-03
Project: `F:\DEV_ENV\X4_Forge`
Status: current AI workspace import `VERIFIED`; opaque call-shaped text-sample unit `SPECIFIED`; overall B119 `IN_PROGRESS / PARTIAL`

## Session-start brief

- Project: X4 Forge B119, the linter-first source-faithful X4 Lua UI editor. GitHub owner: #41.
- Biggest new milestone: the persisted `x4 AiLive` workspace now contains the current configured mod source, and a
  live-corpus causal projection proves why COMM currently hides both buttons.
- Eyeball queue: none blocks the next code unit. Later acceptance still needs an installed Forge preview, a fresh X4
  comparison, full original-brief review, AI Influence reference reconstruction, release acceptance, and OpenVSX.
- Commit question: workspace-authority implementation `104fa24` and records `aa34be1` are committed/pushed. The current
  plan/backlog/handoff checkpoint must be explicitly committed before implementation; preserve the unrelated dirty tree.

## Verified current-source import

- Exact AI workspace target: `ws_bca860d02b9ea61f6028bfb4` (`x4 AiLive`). Pre-write backup:
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-ai-current-import-backup-20260902-231826\ws_bca860d02b9ea61f6028bfb4.json`,
  `11,953,625` bytes / `79A7738581FA7C09A3704204F54A08B92375BA3A574BBC7AE8DCF432CB2BE520`.
- Import source: `F:\DEV_ENV\projects\Mods\X4Mods\x4_ai_influence`; `127` files, `2,930` nodes, `2,824` links,
  `15/17` graph-editable MD files, zero non-regenerable MD files, source stamp `3986863d2ea3e970:125`.
- Same-read baseline: version `1786230857366`, content `53a0600ee0b000a7`, snapshot `dbf65b6162ced511`.
  Dry-run `b119.ai-current-import.dryrun.20260903t0319z` was immutable. Commit
  `b119.ai-current-import.commit.20260903t0319z` reused that pair without `force` and produced version
  `1788405630271`, content `2bedad775ec33294`, snapshot `dc8771c3a0bce095`.
- Post-write state JSON: `12,774,311` bytes /
  `D2E3E6570D61C376F70808880AAF7220AC3EFC42405AA5BC1847D97D437F5E05`.
- Durable recovery receipt:
  `ar_c554bd122712fed927e34f59cf9b8839b54d082a08811ade869348184376cf2f`; receipt-file SHA
  `22E6863A0DF8696EC31E58E0F541A1685DED56EE6D2F83FB321BD71A4B140CB4`; committed, rollback available,
  `workspace-cas` passed.
- Current persisted Lua pins equal disk: MENU `4253D9BD...47DD7`, HUB `657476EA...B8C4F`, COMM
  `88FAB05A...63511`. Pipeline workspace remains `18A3C650...69FBC`; source mod remains Git-clean at
  `4c0a422b7e3d0f492b572b9da8d2d7ea19a2b453`; no source/build/deploy writer ran; X4 remains absent.

## Causal rendering evidence

- Strict configured Scene exits `0` at `176/176`, executing MENU/HUB/COMM `3/3`. MENU is
  `66 operations / 27 applied / 209 paint commands / 171 diagnostics`; HUB `18/11/70/39`; COMM
  `14/12/35/29`, with `0` widgets, texts, or glyphs. All remain `Not verified in game`.
- `[REPRODUCED]` COMM line `505-506` composes its title through `ascii(... tostring(...))`. The sample owner rejects
  every call-shaped expression, so no title string reaches canonical Zekton measurement; the zero-height cell leaves
  row/table geometry unavailable and Scene deliberately withholds both known buttons.
- A read-only projection loaded the live configured corpus and changed only that title expression in memory. Original
  source produced `0` widgets. The static in-memory equivalent produced `3` widgets, `5` texts, `52` glyphs, and no
  layout height gap: title `1298x22 @ 32,27`; buttons `279x25 @ 1332,27` and `279x25 @ 1613,27`. Disk SHA remained
  `88FAB05A79EF33CB28E098081EA6A5E29E8F3B7C4150C39BF38913C51C063511` before and after.
- Secondary COMM gaps include 100%-allocated columns plus default scrollbar reserve and unresolved `TOK` colors.
  They are not the first cause of the zero-widget output.

## Next bounded implementation

- Plan authority: `docs/plans/2026-09-02-b119-canonical-source-editor-game-pipeline.md`, section
  `BOUNDED UNIT — OPAQUE CALL-SHAPED TEXT SAMPLES`.
- Route every code/test edit to one exact native `gpt-5.6-luna` `luna_executor`, reasoning `max`, no forked parent
  context. Likely paths: `src/lib/x4UiLayoutProgram.ts`, its selftest, and `src/lib/x4UiScene.selftest.ts`; add the
  EditorSession selftest only if required. The generic Source Editor string control already exists and should not be
  changed without new evidence.
- Permit only opaque preview-supplied **strings** for ordinary dynamic call-shaped text. Never execute Lua. Keep
  `C.*`, `Helper.*`, numeric/boolean calls, tables/functions/references, stale IDs/ranges/sources, wrong types,
  conditional consumers, and receiver-identity attempts fail-closed.
- Acceptance: unprovided COMM remains incomplete; one issued line-505 string sample, when supplied, renders the title
  and both buttons with canonical Zekton geometry and preview-only provenance; source/export/linter/game-truth bytes
  stay unchanged. Run focused tests, strict current-source census, TypeScript, exact lint, Graphify, and precommit.
- After reconciliation and gates, update this handoff, backlog, canonical plan, GitHub #41, Notion, and Google Current
  Status; commit/push explicit owned paths and prove local/tracking/direct-remote parity. OpenVSX remains deferred.

## Preservation boundary

- Preserve every unrelated modified, deleted, and untracked repository path. Stage only explicit owned paths.
- Do not stage screenshots, VSIX files, `test-results/.last-run.json`, release metadata, package files, deleted
  scripts/data, showcase assets, unrelated plans, or any user work.
- No installed extension, persisted workspace, mod source, loose build, game target, or X4 process is part of the next
  code unit. Overall B119 remains `PARTIAL` until current-source native Forge/X4 evidence and release acceptance pass.
