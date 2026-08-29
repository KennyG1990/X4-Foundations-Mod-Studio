# Session handoff — B119 source-proven table/widget geometry

Date: 2026-08-28
Project: `F:\DEV_ENV\X4_Forge`
Status: bounded source-proven table/widget geometry `VERIFIED`; overall B119 `IN_PROGRESS / PARTIAL`

## Current repository state

- Source checkpoint `188d5c02363d3a25dd818b32401c7e0bd2cad34b` is committed and pushed with exact
  local/tracking/direct-remote parity. It owns only:
  - `docs/plans/2026-08-28-b119-source-proven-table-widget-geometry.md`
  - `src/lib/x4UiLayoutProgram.ts`
  - `src/lib/x4UiPreviewPipeline.ts`
  - `src/lib/x4UiPreviewPipeline.selftest.ts`
  - `src/lib/x4UiScene.ts`
  - `src/lib/x4UiScene.selftest.ts`
- The exact native `gpt-5.6-luna` implementation/test worker is terminal and closed. No spawned worker remains open.
- All pre-existing user-owned dirty paths remain outside the checkpoint. Tracked examples are `CODEX-ONBOARDING.md`,
  `KNOWN-BUGS.md`, `docs/plans/2026-08-02-w3b1-addressed-state-receipts.md`, `test-results/.last-run.json`, the deleted
  Discord/data scripts and records, and the existing VS Code extension release files. Existing issue templates,
  screenshots, media/showcase assets, W3B1 plans, `REFACTOR-PLAN.md`, `pnpm-workspace.yaml`, `target.name`, and other
  untracked files are also unrelated. Continue explicit-path staging only.

## Bounded capability now implemented

- The existing preview pipeline passes its already validated canonical corpus into the layout program; there is no
  second loader or renderer.
- Layout recognizes only exact shipped `Helper.headerRowCenteredProperties` and source-pins its regular Zekton font,
  font size, y offset, minimum row height, centered alignment, and canonical `container_subsection_header` background.
- Per-cell minimum text height is projected from finalized colspan width, scaled font size, exact regular/bold Zekton
  metrics, wrap layout, and Helper floors. The ordinary fact remains independently replayable and mutation-sensitive.
- Scene treats zero-height text `minTextHeight` as the final scaled Helper result and no longer applies `scaleY` twice
  at non-unit scale.
- The test corpus includes the exact synthetic `container_subsection_header -> azure_dark_alpha_26` mapping while
  retaining exactly `224` base colors and `804` mappings. Production color assets were not changed.
- This is bounded exact-source support, not arbitrary Lua evaluation, full Helper/widget parity, C++ frame acceptance,
  or a 1:1 renderer claim. Internal state remains `Not verified in game`.

## Exact fixture and validation authority

- Exact embedded/deployed Lua SHA-256:
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`.
- `1920x1080 / UI scale 1`: cell heights `18,18,25,16,25,44`; row heights `20,20,25,16,25,44`; table `160`.
- `2544x1353 / UI scale 1.25`: cell heights `22,22,31,20,31,55`; row heights `25,25,31,20,31,55`; table `202`.
- Scene census: one frame, one table, six rows, twelve cells, six widgets, eight texts, ninety-nine glyphs, fifty-six
  explicit gaps. The source-backed color mapping closes five former color-only gaps (`61 -> 56`).
- Focused coordinator reruns: Layout Program `641/641`; Preview Pipeline `103/103`; Scene `154/154`; exact
  MENU/HUB/COMM census `3/3`; whole-repository TypeScript exit `0`; exact six-file ESLint exit `0`; diff checks clean.
- Complete precommit passed before commit and again in the commit hook: verdict `55/55`, durable writers `14/14 + 8/8`,
  capability `12/297/1/11`, action receipts `82/56`, TypeScript, Vite/product-copy/MCP checks, and size guards.
- The accepted unchanged full E2E `104/104` with `treeGone=true` and the `1,848`-module production build remain retained
  broad evidence. Graphify's accepted refreshed state is `9,966` nodes / `24,959` edges / `310` communities.
- Rendered evidence under `dev-docs/b119-x4-ui-pipeline-smoke/pixel-comparison-20260828/` confirms the centered table,
  row order, spans, header hierarchy, status text, two buttons, and editbox region. It also confirms the remaining large
  Forge frame outline and missing X4 background/alpha composition.

## External and durable records

- GitHub #41 comment `5460008598` was written and read back; the issue remains open.
- Notion owner page `3b84618e-d15b-8190-821e-c0eb96f43d5a` was written and fetched back with Status `In Progress`
  and Evidence Grade `Partial`.
- Google Doc `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was revision-locked from
  `AIroW34vaIbo_BkljAW6-Et0lTWBHdAk1cEJujn4fuHgb38zN9PXQzfgeOjPtSMMt17rhizxVjqhN6vGLQ2u06QWlUuKyd8oXu2GRsmnSEzr`
  to `AIroW36lt84Fqx6FIveaiTHVv9nd8X-o6l9iFOYppQWhdkjZFUA81qeRoHdAReUfyo4bN7CTowAQzIt_QcnW94fJ05flKFDe3w19meoxANUN`.
  Trusted readback confirmed the exact document/title/tab, new heading, eight normal paragraphs, and final revision.
- `BACKLOG.md`, the bounded plan, this handoff, and the StarForge capability/AAR ledgers are the record-close owners.

## Machine and containment state

- X4 is absent. Live Antigravity/Forge listeners are unchanged at `127.0.0.1:3000` PID `21500` and
  `127.0.0.1:3300` PID `32036`; ephemeral `3001/3100/3101/8972` are free.
- The configured unpacked X4 9.00 corpus remains read only at
  `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`.
- The final color-test worker accidentally launched a broad recursive `rg` over the 1,028,384-file / 33 GB corpus.
  Only exact scan PID `59608` and wrapper PID `45700` were terminated; no corpus, game, app, or source file changed.

## Next exact product unit — linter first

1. Re-open the supplied brief and reconcile every defect row against `src/lib/x4UiLint.ts`,
   `src/lib/x4UiLint.selftest.ts`, all analyzer/validator/UI consumers, and current diagnostics. Produce a positive,
   negative, dynamic/unresolved, integration, and user-copy coverage matrix before changing code.
2. If a rule is missing, issue one bounded native Luna work order for the highest-severity missing rule and its exact
   owner tests. If all rules already exist, strengthen the weakest integration/UX evidence instead of inventing a new
   duplicate rule.
3. Preserve the reconciled official column boundary: literal `24+` blocks; `13-23` warns because official X4 9.00 has
   13-column tables. Dynamic shapes must say `not statically verified`; clean output is only `No known rule violated`.
4. Do not widen renderer scope until the linter coverage matrix is closed. No OpenVSX publish until release quality.

## Eyeball queue and release boundary

- Compare exact Forge/X4 frame, button, text, and editbox edges at both retained profiles; explain or remove the large
  frame outline and background/alpha mismatch from shipped source.
- Exercise MENU/HUB/COMM in the real mounted editor and retain screenshots, then verify keep-out overlays.
- Reconstruct the supplied AI Influence `1b` screen first and the remaining references only after the linter-first
  boundary and exact source behavior are stable.
- Preview is for layout; game is truth. Pixel similarity never promotes engine acceptance. Installed extension and
  OpenVSX release remain unproved/unpublished.

## Triggered AAR failure shields

- Never recursively search the configured 33 GB corpus for a known authoritative asset. Target reconciled files such as
  `libraries/colors.xml`, `ui/addons/helper.lua`, or `ui/addons/widget_fullscreen.lua` directly.
- PowerShell braced `foreach` statements cannot be piped directly; collect into an array before piping.
- One raw oracle command targeted a dead server; use the owning isolated oracle script. Retain failed evidence.
- A first canonical fixture simplified away source formulas, and a same-context alias decoy escaped until the exact
  source root was pinned. Exact source identity and mutation tests remain mandatory.
- Highest risk is a convincing preview being mistaken for game truth. Keep the disclaimer and deploy/game gate
  authoritative while exact frame/alpha and broader Helper/widget coverage remain open.
