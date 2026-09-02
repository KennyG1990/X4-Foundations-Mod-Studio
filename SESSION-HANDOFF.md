# Session handoff — B119 scale/cache implementation ready for installed validation

Date: 2026-09-02
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL`; implementation and precommit are green, combined focused E2E receipt is incomplete

## Session-start brief

- Project: X4 Forge B119, the linter-first source-faithful X4 Lua UI editor. GitHub owner: #41.
- Current milestone: user scale and effective `Helper.uiScale` are distinct in the Source Editor; canonical Zekton RGBA
  expansion is retained in a private bounded renderer session; sampleless session projection no longer performs its
  identical second preview projection.
- Eyeball queue: install the reviewed candidate, exercise derived/custom transitions and native PNG export at
  `2544x1353 / X4 user scale 1`, then launch X4 and compare the unchanged `pipeline_test` at the same profile.
- Commit question: prior source/docs checkpoints `1799dc6145e39a35c7e6f816da793fc691b53df0` and
  `47ce998bea73fc2a0ecf3645663c00141b93b72b` are pushed with three-way parity. Commit/push the current bounded source
  checkpoint before replacing the installed extension.

## Current bounded implementation

- `src/components/X4UiSourceEditor.tsx` exposes explicit derived-user and custom-effective modes. Derived law is
  `effective Helper scale = X4 user scale * drawable height / 1080`; width does not affect it. Downstream
  `profile.uiScale` remains the effective multiplier.
- PNG metadata and deterministic filenames say `Effective Helper scale` / `effective-scale`. The permanent state is
  still `Preview evidence only · Not verified in game`.
- `src/lib/x4UiCanvasRenderer.ts` issues an opaque renderer session backed by private weak ownership. Per canonical
  corpus it retains at most eight detached role/tint RGBA byte expansions with deterministic LRU; callers receive no
  bytes, ImageData, surface, or mutable cache. Every render still allocates fresh atlas/composite surfaces and fresh
  ImageData and executes the existing put/draw path.
- `src/lib/x4UiEditorSession.ts` reuses `catalogPreview` only when reconciled samples are absent. Accepted sample values
  retain the existing sampled second projection. No cross-call memoization or public receipt changed.

## Reproduced performance evidence

- Before the cache, the independent scale scenario exceeded the unchanged 60-second timeout after repeated renders.
- Full-fixture diagnostics used exactly one key, `regular|255|255|255|1`: one miss followed by hits; no eight-entry LRU
  thrash. Renderer calls measured about `0.45-0.57 s`.
- Session projection measured about `1.4-1.6 s` and ran twice per state update. The sampleless reuse removes one
  identical preview-pipeline call per session projection.
- Post-change unchanged scale scenario is a complete structured PASS: `1/1`, `53.6 s`, all derived/custom/current/game
  boundary assertions green.

## Validation

- Parent focused gates: Editor Session `8/8`; Canvas `140/140`; Source Editor complete matrix including P7 `12/12`;
  whole-repository TypeScript; exact seven-file ESLint; scoped diff hygiene — all exit `0`.
- Complete precommit exits `0`: tripwires; canon mirrors; E2E verdict selftest `55/55`; Vite lifecycle; product copy;
  durable writers `15/15 + 8/8`; capability contract `12 capabilities / 297 disposed routes / 1 dynamic registrar /
  11 aliases`; MCP capabilities; action receipts `82` routes / `57` surfaces; TypeScript; final `OK`.
- Graphify refreshed and resolves `projectX4UiEditorSession()` with degree `27`, community `63`.
- Combined focused E2E is formally incomplete: scenarios 1 and 2 passed (`9.9 s`, `42.1 s`), then Windows terminated
  the child with known class `0xC0000409` before scenario 3 reported. Structured report was incomplete/red and
  `treeGone=true`. A later parent test-1 replay also died before any result. No blind retry, timeout increase, fixture,
  or assertion weakening was retained.
- Ports `3100/3101` and matching E2E processes are absent. X4 is absent. Antigravity and the installed managed Forge
  remain running.

## Baseline, package, and rollback

- Current pushed baseline before this source checkpoint:
  `HEAD == origin/main == direct remote == 47ce998bea73fc2a0ecf3645663c00141b93b72b`.
- Existing installed extension: `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.70`.
- Existing prior rollback backup:
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-install-backup-20260902-140638`.
- Prior reviewed VSIX:
  `vscode-extension/x4-forge-studio-0.0.70-b119-native-png-019fea10.vsix`, SHA-256
  `377B555B6CF8FFD9A24B3A2D1EAAA2C582C4E4A5EAEBCB7F6BA9E25A07835A21`.
- Before replacing the installed directory, create a fresh exact backup and retain its path/hash census. Rollback is
  stop managed host, restore that whole directory, restart Antigravity extension host, and verify installed hashes.

## Durable records

- Canonical plan: `docs/plans/2026-09-02-b119-canonical-source-editor-game-pipeline.md`.
- BACKLOG B119 remains `in_progress / PARTIAL`.
- Existing external readback: GitHub #41 comment `5514694526`; Notion owner
  `3b84618e-d15b-8190-821e-c0eb96f43d5a`; Drive doc `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, revision
  `ANLCKQnPV2tiWmIsxqdSqFY7Da7kUB6J0Vy4fh6H79AaVrF0TARj2mfS1QqH4NkY5724ZZDrMx2d5lqfuHVtVdYJUD6svM1BaIqew2yYe290`.
- X4 UI quick-reference card 25 records the user/effective-scale trap. Add the bounded renderer-byte-cache lesson only
  after installed-host validation succeeds.
- No capability-map delta yet: source behavior is stronger, but installed/game evidence has not been refreshed.

## Exact continuation

1. Stage only the ten bounded source/test/record paths, commit, push, and assert local/tracking/direct-remote parity.
2. Build production plus extension, stage/probe, package a distinct B119 scale/cache VSIX, inspect its entries and hash.
3. Before installation, state exact target/risk/rollback and create a fresh whole-extension backup. Replace only the
   existing `0.0.70` extension, restart its managed host, and verify installed bytes against the reviewed package.
4. In installed Antigravity, bind exact `ui/pipeline_test.lua -> menu.createFrame`; enter width `2544`, height `1353`,
   X4 user scale `1`; verify derived effective `1.252777777777...`, current canvas, repeated transitions, and native PNG.
5. Launch X4 at the same drawable/user-scale profile; verify buttons, editbox, close, owned log, and compare fresh bounds.
6. Update plan/BACKLOG/handoff/AAR, UI KB, capability-map delta if warranted, GitHub #41, Notion, and Drive. Commit/push
   exact record paths. Do not publish OpenVSX until separate release acceptance passes.

## Preservation boundary

- Preserve every unrelated modified, deleted, and untracked path in the broad working tree.
- Never stage `test-results/.last-run.json`, unrelated docs/plans, deleted scripts/data, screenshots/showcase assets,
  release metadata, `vscode-extension/package.json`, or existing user files.
- Overall B119 remains `PARTIAL`: arbitrary C++ frame acceptance, exact Zekton glyph parity, full Helper/widget/keep-out
  coverage, AI Influence reconstruction, one complete `3/3` browser receipt, and release/OpenVSX acceptance remain open.
