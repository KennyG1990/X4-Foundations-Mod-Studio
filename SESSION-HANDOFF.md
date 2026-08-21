# Session handoff — B119 source-canonical UI editing

Date: 2026-08-21
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL — Not verified in game`

## Session-start brief

- Project: X4 Forge B119, the linter-first faithful 2D X4 UI editor. Port shipped X4 Lua/corpus semantics; do not
  invent an approximate renderer or treat preview success as engine acceptance.
- Current bounded result: source-owned scalar and structural reparses now preserve the exact loader-issued canonical
  color authority privately. Scalar `partial` programs are actionable only when their nonempty operation stream is
  entirely applied; partial catalogs continue to expose no structural entries. Exact structural colors use the layout
  owner's closed schema and remap nested source-literal locations.
- Overall boundary: host validation is green, but exact AI Influence `1b` reconstruction, deploy-byte identity, C++
  frame acceptance, and player-visible X4 comparison remain open. Every surface must still say
  `Not verified in game`.
- Commit question: implementation commit `743ef85f1d451a8f32c42670e716bffea215cb7d` is pushed; local `HEAD`,
  `origin/main`, and remote `refs/heads/main` are identical and the index is empty. GitHub, Notion, and Drive were
  updated and read back. Commit/push this exact documentation synchronization before starting another unit.

## Operator and machine state

- Ken explicitly reported Antigravity running, X4 not running, and the machine quiet, then went to bed.
- Do not deploy, launch X4, write the real mod/live extension/unpacked corpus, mutate standing config, or perform the
  separately gated player-visible check while Ken is asleep.
- No native Luna worker remains open. The final tests-only worker returned `VERIFIED` and was closed.
- Ports `3100`, `3101`, and `8972` are free; X4 is absent; the final E2E lifecycle reports `treeGone=true`.

## Implemented checkpoint

- `src/lib/x4UiLayoutProgram.ts`
  - privately retains exact validated loader-issued canonical color evidence with an issued program/evidence pair;
  - exposes one owner-controlled color-only reprojection path that revalidates the pair and retained loader guard;
  - preserves legacy three-argument projection when no color authority was issued;
  - exports the narrow exact layout-color value guard used by the structural consumer.
- `src/lib/x4UiSourceEdits.ts`
  - routes scalar and structural reparses through the issued owner authority;
  - permits scalar `projected` or `partial` programs only when every operation is applied and the stream is nonempty;
  - withholds structural entries from partial catalogs;
  - restricts parser-owned optional `undefined` normalization to exact closed handler/context shapes;
  - validates exact structural colors and remaps declaration/channel/value/key locations through the splice.
- `src/lib/x4UiLayoutProgram.selftest.ts` and `src/lib/x4UiSourceEdits.selftest.ts`
  - prove public scalar and structural CAS, real loader-issued retained authority, safe refusal matrices, eleven nested
    location remaps, strict-vs-generic malformed controls, no retained-authority alias leakage, and independent object,
    array, typed-array, and `ArrayBuffer` census sensitivity.
- Real AI Influence in-memory public CAS selected `ui/addons/ai_influence_chat/aic_menu.lua` `23297:23300`, changed
  `addTable.x 330 -> 600`, and reissued ready derived authority SHA-256
  `9F9E868118B97F93FF9845017DC5582ED91F917925B03E9A286DD138D7A1BF1B`. The real mod source remained unchanged at
  `4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`.

## Validation evidence

- Focused: Layout `622/622`; Source Edits `74/74`.
- Adjacent: SourceEditor, EditorSession, Preview, Scene, Paint, and Canvas selftests all exited `0`.
- Static/build: TypeScript, exact four-file zero-warning ESLint, diff hygiene, and production build passed; Vite
  transformed `1,847` modules.
- Oracle integration: `134/134`; port `8972` released.
- Graphify: `9,705` nodes / `24,364` edges / `315` communities; no tracked graph-output delta.
- E2E first full attempt: correctly red after child exit `3221226505` / `0xC0000409` following test 22; no structured
  report. Cleanup was complete and live state unchanged. The next unstarted spec passed `1/1` alone.
- E2E controlled full retry: `103/103` in `7.6m`, zero failed/flaky/bad rows, complete discovery/terminal parity,
  child exit `0`, lifecycle/ownership complete, `treeGone=true`; receipt SHA-256
  `5CE76552ED1F51118C2A02B66C492915E3F0F4CAAAEA4552A6B3DEF305641391`.
- Precommit: verdict `55/55`, Vite lifecycle, product-copy, writer `14/14` plus extension `8/8`, capability
  `12 / 297 / 1 / 11`, MCP, action-receipt `82 routes / 56 surfaces`, typecheck, and size guards passed.
- Live containment remained exact:
  - `.studio-state` `EDA252532D725E27C56C9AFBC7B79C06F930F6D935751BD6033AF5BED3ECA7F8`;
  - `config.json` `3EC65D540E6763D13D6F8F27D9005F80C3C855B00D3DCFDD5E7330726AE37779`;
  - `.studio-api-token` `D20602CE9A8AFA430CF6E1730F3793F45F1BEFF535A7C7004DA7CE2B53027F3B`.

## Review and AAR

- Fresh zero-write review found no P0-P2 production defect. Its two P3 proof gaps were corrected tests-only: the
  custom-prototype control is explicitly generic closed-data coverage, while six malformed records isolate strict
  color validation; four alias classes each have independent positive sensitivity assertions.
- Triggered AAR: omitted replay authority, tests-first supported-color rejection, two review repair rounds, one TS2554
  correction, first full E2E native crash, corrected no-result PowerShell diagnostics, and one revision-guarded Drive
  insertion whose index displaced the preceding paragraph's final period. The exact punctuation was repaired and read
  back under the new revision. Full detail is appended to the plan.
- No capability-map delta. The external StarForge wiki AAR was intentionally not mutated while Ken slept.

## Git and projection receipts

- Implementation commit: `743ef85f1d451a8f32c42670e716bffea215cb7d`,
  `fix(ui): preserve canonical color authority across source edits`.
- Git parity: local `HEAD == origin/main == remote refs/heads/main`; index empty after push.
- GitHub #41: comment `5374884567` written and read back; issue state `open`, comment count `66`.
- Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`: properties and appended checkpoint read back with
  `Status=In Progress`, `Evidence Grade=Partial`, commit/comment receipts, and both review dates `2026-08-21`.
- Drive doc `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`: checkpoint read back at revision
  `AIroW34cZtAuZnOt_0zmtdCpU402iNV-uYE_5mVy2ObYxJcnN3Ihh6gTjvxSWNuYyC4o0G_gdF7u4LMqqVVlQAG31CDUH4vX63QSdPq0CS6E`.
  The first insertion displaced one period because the terminal paragraph index was exclusive; a second
  revision-guarded batch restored it and removed the stray one-character paragraph. Final readback is clean.
- Repository Markdown remains authoritative; external projections do not change the `PARTIAL / Not verified in game`
  status or authorize deployment.

## Dirty-worktree preservation

Preserve and never stage or clean these unrelated paths: `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`, deleted
`data/known_fixes.json`, `data/trivia_questions.json`, `docs/DISCORD_BOTS_AND_GAMES.md`, W3B1 plans, deleted legacy bot
scripts, `test-results/.last-run.json`, all VS Code extension/evidence changes, issue templates, `Note for Kimi.md`,
`REFACTOR-PLAN.md`, `mermaid-diagram.png`, `target.name`, the untracked marketing-showcase spec/evidence, and untracked
`({`. The tracked E2E set is exactly 23 specs / 103 tests and does not include the marketing showcase.

## Eyeball and game queue

1. Reconstruct the supplied AI Influence `1b` hierarchy/composition in the isolated Forge dogfood workspace using the
   already-inspected photos/spec and exact source/corpus authority. Do not introduce a parallel renderer.
2. When Ken is awake, present the real-write gate: deploy only the approved candidate after hash snapshots; a bad frame
   may disappear, close the conversation, or trigger UI reload; rollback is restoration/redeployment of the snapshot.
3. Launch X4 only after explicit `go`, capture the player-visible frame, compare it with Forge and `1b`, and record
   engine acceptance/failure. Until that succeeds, retain `PARTIAL / Not verified in game`.

## Durable records

- Authoritative plan: `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`.
- Source-first design: `docs/plans/2026-08-10-b119-x4-ui-editor-source-first-design.md`.
- Owner issue: GitHub #41 remains open; current checkpoint comment `5374884567` is read back.
- Overall B119 status: `PARTIAL / Not verified in game`.
