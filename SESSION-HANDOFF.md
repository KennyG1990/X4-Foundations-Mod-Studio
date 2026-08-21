# Session handoff — B119 X4 UI editor source-first renderer and linter

Date: 2026-08-21
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL — Not verified in game`

## Session-start brief

- Project: X4 Forge B119, the linter-first faithful 2D X4 UI editor. Port shipped `helper.lua` and
  `widget_fullscreen.lua`; preserve real Lua calls, configured unpacked-corpus authority, measured keep-outs, and the
  distinction between preview evidence and X4 truth.
- Current boundary: the source-literal Canvas consumer repair is host-verified, committed, and pushed. The isolated AI
  Influence source now paints mounted browser pixels, but the sampled composition is not visually faithful to the
  supplied references and X4 has not accepted or rendered it.
- Commit question: `HEAD == origin/main == 4c480418e0bb4095d0bd5935a3767b29cdd0e0f8` was proved after push with an
  empty index. This handoff, `BACKLOG.md`, and the B119 plan are the pending documentation-close checkpoint; stage only
  those exact paths and preserve every unrelated dirty path.
- GitHub owner: issue #41 remains open. The final Canvas checkpoint was read back exactly at comment `5367932527`.

## Machine and process state

- Ken's latest gate: Antigravity running, X4 not running, machine quiet; Ken is asleep.
- No native Luna worker remains open. All implementation and audit workers returned terminal and were closed.
- The isolated Forge server and browser page were stopped/closed. Ports `3100`, `3101`, and `3300` were free after
  validation; X4 was absent. Recheck current state before any new runtime work.
- Do not deploy, launch X4, write the real mod/live extension/unpacked corpus, or mutate standing config while Ken is
  asleep. Those remain a separate explicit write gate.

## Latest accepted checkpoint

- Canvas source-literal repair:
  - production `src/lib/x4UiCanvasRenderer.ts` SHA-256
    `5318E9B40D28ACB73452591F0896D5CC8972E24B5F3D4DD24125ECDF85A56E3D`;
  - selftest `src/lib/x4UiCanvasRenderer.selftest.ts` SHA-256
    `334472456F1D4E418706DD518E30D023150F09533F74D374F26DAC231A6C3DC9`;
  - focused Canvas `117/117` under worker and coordinator;
  - implementation commit `4c480418e0bb4095d0bd5935a3767b29cdd0e0f8`, pushed with remote parity.
- Exact semantic change: use-site and declaration evidence now agree by exact file/optional sourcePath identity rather
  than impossible range containment, and alias-use expression text no longer has to equal its literal declaration
  expression. Same-source identity, declaration-to-channel/key containment, exact closed records,
  cross-file/sourcePath refusal, duplicates/reassignment, numeric/alpha domains, and pre-allocation refusal remain.
- Causal receipts:
  - first red `115/116`: valid use-site was incorrectly required to contain its separate declaration;
  - second red `116/117`: valid `TOK.plate` use expression was incorrectly required to equal table-literal declaration
    text;
  - second fail-first receipt
    `dev-docs/b119-ai-influence-dogfood/evidence/source-literal-canvas-second-fail-first.json`, SHA-256
    `E84629ABB3C567DA32E6DC36B6DF6BA766D2F0F74AF01F28D246F5667C276FAA`;
  - final receipt `source-literal-canvas-second-final.json`, SHA-256
    `F35E9D28DE1C4C9E4128192DE5D497AEE83C7E46230B764C823C7A194EB69F79`.
- Isolated dogfood root: `F:\DEV_ENV\X4_Forge\dev-docs\b119-ai-influence-dogfood` is gitignored. The real source,
  live extension, corpus, X4 state, and observed ports were byte/state-identical before and after.
- Exact sampled safe source: `aic_menu.lua` SHA-256
  `37FAE9C83E1FEF6319378B9B8F60711D4E44ADE54FD6B5B26A44E4FC672E7A4F`, target `menu.display`.
- Driver acceptance:
  - literal variant: `12/12` samples consumed, `39` UI primitive commands, `0` not applied;
  - keep-out-safe variant: `9/9` consumed, `38` commands, `0` not applied.
- Mounted production at `2560x1440`, scale `1`, canonical core/color, nine samples, keep-outs off:
  - `rendered/current`;
  - `3,686,400` non-transparent/non-black pixels;
  - zero new console errors;
  - permanent `Not verified in game`.
- Mounted evidence:
  - census `browser-evidence/b119-final-mounted-census.json`, SHA-256
    `FFEA43F0A609F42234BBB98D3EA9FB8A55DA5AEDA046909EAA17CFCD30235073`;
  - clean screenshot `browser-evidence/b119-final-rendered-current-clean.png`, SHA-256
    `190B3758EA69E96114DB699E92A4E7F7D402B300B0CEFA94F2C461BE26159BAA`;
  - keep-out census `browser-evidence/b119-final-keepout-census.json`, SHA-256
    `062B6A8C2374335F3A83F4655A67DD3C363E06E13E4BFBD34040C13688D465BF`.
- Keep-outs remain advisory at measured `y=0.788`, `y=0.740`, and `x=0.664`.

## Broad validation

- Typecheck, exact-file ESLint, diff hygiene, and production build passed.
- Full serial E2E passed `104/104`; receipt `test-results/e2e-verdict.json` SHA-256
  `553B20B3E323F675568B4E0171233F2F86A0DAA11E61E16168326834A7882D44`; zero failed/flaky/bad, complete
  discovery/terminal parity, `child-close`, `treeGone=true`, and no owned PID remained.
- Complete precommit passed under process-local Node `24.19.0` / libuv `1.52.1`: verdict `55/55`, Vite lifecycle,
  product-copy, writer `14/14` plus extension `8/8`, capability/MCP, action-receipt `82/56`, typecheck, and size limits.
- Graph refreshed to `9666` nodes / `24230` edges / `319` communities; no graphify process remained.
- Live-state containment remained exact: `.studio-state` 9 files / 4 dirs / 12,382,674 bytes; `data` 3,686 files /
  42 dirs / 607,386,585 bytes; `config.json` 463 bytes at SHA-256
  `3EC65D540E6763D13D6F8F27D9005F80C3C855B00D3DCFDD5E7330726AE37779` with unchanged timestamp.
- Fresh zero-write Luna audit was `CLEAN`; no production, Scene, Paint, real-mod, live-game, or corpus bytes changed.
- No capability-map delta.

## Honest visual state

The mounted Canvas now consumes the accepted production Paint plan and emits real pixels. That closes the reproduced
Canvas refusal only. The nine-sample fixture currently looks mainly like a gray full-frame plate with a red lower strip;
it does not yet visually match `C:\Users\Moshi\Desktop\# AI Influence mod UI design`. Exact text, hierarchy, imagery,
and composition remain open. A pixel-producing preview is not proof of C++ frame acceptance or game appearance.

## Eyeball queue

1. **Forge reference-parity check — pending reconstruction, not merely approval.**
   1. Open the supplied design folder and the clean mounted screenshot side by side.
   2. Confirm the current screenshot is only the coarse gray/red geometry, not the intended design.
   3. Do not approve deployment from this image; first reconstruct the missing source samples/text/composition through
      the Forge source-first path and rerun mounted comparison.
2. **X4 frame and experience proof — Ken-gated.**
   1. Reconfirm Antigravity state, X4 stopped, and machine quiet.
   2. Present the write gate below and wait for Ken's explicit `go`.
   3. Snapshot the exact real-mod and live-extension hashes, deploy only the approved Forge output, and read back byte
      identity.
   4. Launch X4, open the target conversation UI, capture the player-visible frame, and compare it to both the Forge
      preview and supplied references.
   5. Record C++ frame acceptance/failure and preserve `Not verified in game` unless the real frame is observed.

## Next bounded unit

Reconstruct the AI Influence `1b` design inside the ignored isolated workspace using the supplied photos/spec and exact
real Lua/corpus authority. Inspect every reference image visually; extend the existing source/sample/Scene/Paint/Canvas
chain, not a parallel renderer. Acceptance for this next unit is mounted Forge output that materially matches the
reference composition at `2560x1440`, with linter/keep-outs visible and all host gates retained. It still cannot claim
X4 acceptance.

Before any real-mod/game write, present this exact gate in one paragraph: the operation will deploy the approved Forge
candidate into the real mod/live extension so X4 can test it; a bad frame may disappear, close the conversation, or
trigger UI reload; rollback is restoration/redeployment of the pre-write hash snapshot. Wait for explicit `go`.

## Resume commands and runtime hazard

1. Read `BACKLOG.md`, this handoff, and the tail of
   `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`.
2. Run `git status --short`, `git rev-parse HEAD`, `git rev-parse origin/main`, and inspect matching long-running process
   ancestry before retrying any interrupted command.
3. Use only the bundled process-local Node `24.19.0` for E2E/precommit. Global Node `24.15.0` reproduced Windows
   `0xC0000409` no-report deaths.
4. Keep E2E serial and isolated on `3100/3101`; never touch the live `3000/3001` workspace.

An interrupted commit in this close remained alive after its tool output was lost. Retrying from Git state alone briefly
created two precommit trees. Exact PID/ancestry inspection identified them; only the newer duplicate was stopped and the
original safe-Node process completed the promoted commit. Ctrl-C ended the retry wrapper but left child processes, so
their ancestry was revalidated before exact termination. This is an AAR/tooling hazard: unchanged HEAD plus a populated
index does not prove an interrupted commit is dead.

## Dirty-worktree preservation

Preserve all unrelated changes. Known exclusions include `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`, deleted
`data/known_fixes.json`, deleted `data/trivia_questions.json`, deleted `docs/DISCORD_BOTS_AND_GAMES.md`, the W3B1 plan,
deleted legacy Discord/bot scripts, `test-results/.last-run.json`, VS Code extension evidence images, issue templates,
`Note for Kimi.md`, `REFACTOR-PLAN.md`, `mermaid-diagram.png`, `target.name`, marketing-showcase spec/evidence, and the
untracked `({` path. Never stage or clean them as part of B119.

## Durable records

- Authoritative plan: `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`.
- Source-first design: `docs/plans/2026-08-10-b119-x4-ui-editor-source-first-design.md`.
- Open owner issue: GitHub #41; latest readback comment `5367932527`.
- Suggested documentation commit: `docs(ui): record B119 Canvas dogfood promotion`.
- Overall status remains `PARTIAL / Not verified in game`; source/sample reconstruction, deploy-byte identity, C++
  frame acceptance, and player-visible X4 comparison remain open.
