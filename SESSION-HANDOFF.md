# Session handoff — B119 X4 UI editor source-first renderer and linter

Date: 2026-08-21
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL — Not verified in game`

## Session-start brief

- Project: X4 Forge B119, the linter-first faithful 2D X4 UI editor. Port shipped `helper.lua`,
  `widget_fullscreen.lua`, font/material/shader sources, and real Lua calls; do not invent an approximate renderer.
- Current boundary: the shipped Zekton SDF texel transfer is host-verified, visually removes the opaque tinted glyph
  rectangles, and is committed/pushed. Exact AI Influence `1b` hierarchy/composition, browser-vs-GPU sampling parity,
  package/deploy identity, C++ frame acceptance, and player-visible X4 proof remain open.
- Commit question: implementation commit `479e21cb07451ae8d0f43e874d20fc10059ce9c9` and durable close commit
  `8289c9093128b722c0060ac233a14368b99931df` are pushed with local, `origin/main`, and remote parity and an empty
  index before this issue-readback synchronization. Recheck exact parity/index before starting the next bounded unit.
- GitHub owner: issue #41 remains open. Exact checkpoint comment `5370579401` was written and read back with the same
  commits, evidence, limitations, and next boundary.

## Machine and process state

- Ken's latest gate: Antigravity running, X4 not running, machine quiet; Ken is asleep.
- Do not deploy, launch X4, write the real mod/live extension/unpacked corpus, or mutate standing config while Ken is
  asleep. Those remain a separate explicit write gate.
- No native Luna worker remains open. The implementation worker returned terminal and was closed.
- Ports `3100`, `3101`, and `3300` were free; X4 was absent; no B119 Forge/browser/E2E/precommit/Graphify process
  remained after validation.
- A 33-process external MCP helper wave rooted in the Codex app server survived the E2E lifecycle despite zero
  harness-owned PIDs. Exact command/ancestry checks were performed and only that leaf tree was stopped; the app server
  remained alive.
- A later 16-Node/16-CMD helper wave was proven to belong to the running Antigravity/Claude MCP extension host, not
  B119 or Codex. It was deliberately left untouched. Do not use total Node/CMD count alone as Forge residue evidence.

## Zekton SDF checkpoint

- Reproduced cause: the shipped regular A8 atlas uses `255` for empty fields and values falling toward `91` for glyph
  shape. Forge copied raw A8 directly to Canvas alpha, making each atlas cell an opaque tinted rectangle.
- Shipped authority:
  - `libraries/material_library.xml` SHA-256
    `4F211F83343FF5C19A4D8427AB25D195E2A124208B730976F9A411335271C047` binds regular/bold Zekton to
    `xu_ui_unlit_sdf` and `ALPHA8_ANARK`;
  - `shadergl/ogl/xu_ui_unlit_sdf.xml` SHA-256
    `5E74955A40459D137C19CFCDAE35974FC0F2494E53E58C2CF4761597537E5768` selects the fragment with
    `diffuse_func=false`;
  - `shadergl/glsl/ui_unlit_sdf.frag.glsl` SHA-256
    `753923F5EDD97AEEF00177FD59B8A43CAA1EC6E2B64F5ADDED59E3E530498968` applies
    `smoothstep(0.4, 0.6, 1.0 - texture(...).r)` before caller color/alpha.
- Causal fail-first:
  - FontMetrics `10/11` because the public transfer/provenance was absent;
  - Canvas `120/121` because a shipped-shaped empty corner staged `255` instead of `0`.
- Bounded implementation: FontMetrics owns the immutable source identity and pure validated transfer; Canvas applies
  it to detached regular/bold A8 bytes before tint alpha. No new renderer, route, dependency, source fixture, or
  game-truth claim was added.
- Final SHA-256:
  - FontMetrics `B43859BA6F8480C1459C15220863C9C0AC4843A99B527203AB8656EE313A0E30`;
  - FontMetrics selftest `2C7D38DAACF6217C038F060E5187E1BB22FB997920E9E2B4B4F3A85360078D7A`;
  - Canvas `9298FCC50AA24949CBF5A7976FA12ED1794961088F04F7043DBE478A45316AB3`;
  - Canvas selftest `5EB81EFC1A87D08DF846D849AF1B43A420972F2020D99FD1A7470989CABEC96F`.
- Implementation commit: `479e21cb07451ae8d0f43e874d20fc10059ce9c9`,
  `fix(ui): port shipped Zekton SDF alpha transfer`.

## Validation evidence

- Focused/adjacent:
  - FontMetrics `11/11`;
  - Canvas `121/121`;
  - SourceEditor canonical color `12/12`;
  - EditorSession `7/7`;
  - Paint `165/165`;
  - Preview `102/102`;
  - Scene `139/139`;
  - typecheck, exact four-file zero-warning ESLint, diff hygiene, and frozen non-owned hashes passed.
- Production build passed under bundled Node `24.19.0`; Vite transformed 1,847 modules with only the existing chunk
  warning.
- Serial isolated E2E passed `104/104` in `8.6m` with zero failed/flaky/bad/quarantined-blocking rows,
  `child-close`, `ownershipComplete=true`, `treeGone=true`, and no remaining harness PIDs. Receipt:
  `test-results/e2e-verdict.json` SHA-256
  `E58DA839C768A965BDEB0F119AE1CC8159172EC21786BCF8AF5E0B6EEFCFFBB4`.
- Complete precommit passed directly and again in the commit hook: verdict `55/55`, lifecycle, product-copy, writer
  `14/14` plus extension `8/8`, capability `12 / 297 / 1 / 11`, MCP, action-receipt `882 / 56`, typecheck, and size
  guards.
- Graphify refreshed to `9,697` nodes / `24,296` edges / `309` communities; the commit hook found no later topology
  delta.

## Mounted visual evidence

- Exact source: `ui/addons/ai_influence_chat/aic_menu.lua` SHA-256
  `1D7A3D67D94894FB3A90BBE4E6BD7A3C5FA32A2EAB1DD2BC5E43F714EC7E35E2`, target `menu.display`.
- Profile: canonical/canonical, `2560x1440`, scale `1`, source-composition, overlays off, `rendered/current`,
  permanent `Not verified in game`, zero console errors.
- Clean pixel hash `5D2435F8A259E3D8A0E1DFDE2B4D9F0FE65A259DF7E460F742FD8EC5DCAD1B05`:
  `3,094,646` transparent and `591,754` nontransparent/nonblack; exact opaque unavailable-gray/red both `0`.
- Clean screenshot `dev-docs/b119-ai-influence-dogfood/evidence/reference-flat-source-composition-sdf-clean.png`
  SHA-256 `8217B3A560191043A67C2DF4B006839140F3CAE4D735B2F462CC147315FC930E`.
- Cockpit screenshot `reference-flat-source-composition-sdf-cockpit.png` SHA-256
  `A49F876523A2AD5A86AC292EFEBC658D561D7BB58BD400A2F07E5C802F5F3B50`; measured `x=0.664`,
  `y=0.740`, and `y=0.788` samples are cyan. Restoring overlays off reproduced the clean hash.
- Census `reference-flat-source-composition-sdf-census.json` SHA-256
  `37D2889C1A235C792A6F1813D8D26A047CC48CD3CCE53F8E80D537AE45120CC0`.
- Visual verdict: opaque tinted atlas rectangles are gone and readable tinted glyph silhouettes remain. Overall
  source geometry is still fragmented and does not reproduce supplied `1b` hierarchy, spacing, transcript plate,
  choice row, input dock, or protected native-wheel composition.

## Honest boundary

The scalar texel transfer is copied from shipped X4 source. The browser currently applies smoothstep before Canvas
resampling, while the GPU samples the raw field before fragment smoothstep. Therefore this checkpoint is faithful at
the source-texel transfer but not proof of identical edge sampling. A clearer preview is still not C++ frame acceptance
or player-visible proof.

## Eyeball queue

1. **Forge `1b` reconstruction check — not ready for approval yet.**
   1. Open the supplied `1b` image beside the clean SDF screenshot.
   2. Confirm glyph rectangles are gone.
   3. Confirm the current source geometry remains fragmented; do not approve deploy from this image.
   4. First reconstruct the missing source samples/text/layout through the existing Forge pipeline.
2. **X4 frame and experience proof — Ken-gated.**
   1. Reconfirm Antigravity state, X4 stopped, and machine quiet.
   2. Present the write gate below and wait for explicit `go`.
   3. Snapshot exact real-mod/live-extension hashes, deploy only the approved Forge output, and read back byte identity.
   4. Launch X4, open the target conversation UI, capture the player-visible frame, and compare it with Forge and `1b`.
   5. Record engine acceptance/failure; retain `Not verified in game` unless that real frame is observed.

## Next bounded unit

Reconstruct AI Influence `1b` inside the ignored isolated dogfood workspace using the already-inspected photos/spec and
exact real Lua/corpus authority. Extend the existing source/sample -> Layout -> Scene -> Paint -> Canvas chain. Do not
introduce a parallel renderer. Acceptance is mounted Forge output that materially matches `1b` at `2560x1440` while
retaining linter diagnostics, measured keep-outs, and permanent game-truth status.

Before any real-mod/game write, present this exact gate in one paragraph: the operation will deploy the approved Forge
candidate into the real mod/live extension so X4 can test it; a bad frame may disappear, close the conversation, or
trigger UI reload; rollback is restoration/redeployment of the pre-write hash snapshot. Wait for explicit `go`.

## Resume and dirty-worktree preservation

1. Read `BACKLOG.md`, this handoff, and the tail of
   `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`.
2. Verify the final issue-readback documentation synchronization completed and local `HEAD`, `origin/main`, and remote
   `refs/heads/main` agree. If these three documentation files are dirty or staged, inspect process/Git state before
   finishing only those exact paths.
3. Before retrying any interrupted Git or validation command, inspect exact Git state and process ancestry. An
   unchanged HEAD or populated index does not prove an earlier hook is dead.
4. Use bundled Node `24.19.0`. Keep E2E serial/isolated on `3100/3101` and never touch live `3000/3001`.

Preserve all unrelated changes. Known exclusions include `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`, deleted
`data/known_fixes.json`, `data/trivia_questions.json`, `docs/DISCORD_BOTS_AND_GAMES.md`, the W3B1 plans, deleted
legacy bot scripts, `test-results/.last-run.json`, VS Code extension files/evidence, issue templates, `Note for Kimi.md`,
`REFACTOR-PLAN.md`, `mermaid-diagram.png`, `target.name`, marketing-showcase spec/evidence, and untracked `({`.
Never stage or clean them as part of B119.

## Durable records

- Authoritative plan: `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`.
- Source-first design: `docs/plans/2026-08-10-b119-x4-ui-editor-source-first-design.md`.
- Open owner issue: GitHub #41; checkpoint comment `5370579401` is written and read back.
- Overall B119 status: `PARTIAL / Not verified in game`.
