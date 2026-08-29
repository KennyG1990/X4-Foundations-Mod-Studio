# Session handoff — B119 source-calibrated editbox-height lint

Date: 2026-08-29
Project: `F:\DEV_ENV\X4_Forge`
Status: bounded linter calibration `VERIFIED`; overall B119 `IN_PROGRESS / PARTIAL`

## Current repository state

- Source checkpoint `60dbb0a93fd9e6b7faf466218f0101d748627434` is committed and pushed with exact local
  `HEAD`, `origin/main`, and direct remote `main` parity at source close. It owns only:
  - `docs/plans/2026-08-28-b119-editbox-height-lint-calibration.md`
  - `src/lib/x4UiLint.ts`
  - `src/lib/x4UiLint.selftest.ts`
  - `src/server/x4UiIntegration.selftest.ts`
- The exact native `gpt-5.6-luna` worker is terminal and closed. No spawned worker remains open.
- Current record-close edits are limited to `BACKLOG.md`, `SESSION-HANDOFF.md`, and the bounded plan. StarForge
  capability/project/workflow AAR deltas are outside this Git repository.
- Preserve all unrelated dirty paths. Tracked examples remain `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`,
  `docs/plans/2026-08-02-w3b1-addressed-state-receipts.md`, `test-results/.last-run.json`, deleted Discord/data scripts,
  and existing VS Code extension release files. Existing issue templates, screenshots, showcase media, W3B1 plans,
  `REFACTOR-PLAN.md`, `pnpm-workspace.yaml`, `target.name`, and other untracked files are not B119 record owners.
  Continue explicit-path staging only.

## Bounded capability now verified

- All eleven original brief-table linter families already exist with positive, safe-negative, dynamic/unresolved,
  real-failure, and shared-consumer coverage. No duplicate rule was added.
- `x4-ui.editbox-height-minimum` now distinguishes omitted call-specific height from explicit literal zero:
  - omission is one visible nonblocking warning with the retained X4 zero-height overlap/log failure;
  - literal zero remains a conservative blocking error;
  - positive static height is clean;
  - dynamic or unsupported height remains `Not statically verified`.
- Shipped X4 9.00 `helper.lua` is the source authority: positive row peers affect `row:getHeight()` only; table default
  cell properties and displayed-hotkey minimum handling are the descriptor-height paths. Production copy and tests
  explicitly preserve that distinction.
- Former omitted and current `height = 44` `pipeline_test` fixtures are permanent focused checks. Project validation,
  IDE Problems, and package readiness preserve exact path, line, stable rule, severity, and blocking parity.
- This is a linter-policy correction, not complete `setDefaultCellProperties`/`setHotkey` modeling, renderer parity,
  arbitrary Lua evaluation, C++ frame acceptance, or a release claim. Preview remains `Not verified in game`.

## Exact validation authority

- Reproduced baseline official corpus: `81/81/0`, `7,669,552` bytes, `25` applicable fatal findings, all omitted
  editbox height; warnings `6`, unverified files `70`, truncated files `26`, gaps `13,681`.
- Final unchanged official corpus: status `no-known-fatal-static-gaps`, `81/81/0`, applicable fatal `0`, warnings `31`,
  unverified files `70`, truncated files `26`, gaps `13,681`. Six restricted-online-call errors remain visible and are
  not applicable only to the trusted official base/DLC census.
- Focused linter `118/118`; project/IDE Problems integration `11/11`; direct package-readiness probe proves omitted
  warning with zero package errors and literal zero as the sole package error at the exact Lua path/line.
- TypeScript, exact three-file ESLint with zero warnings, diff hygiene, full lint with zero errors, and production build
  at `1,848` modules pass.
- Isolated runtime-index oracle owner is `134/134`; live ports remained unchanged. Complete precommit passed directly
  and again in the commit hook: verdict `55/55`, durable writers `14/14 + 8/8`, capability `12/297/1/11`, action
  receipts `82/56`, TypeScript, Vite/product-copy/MCP checks, and size guards.
- Graphify refreshed deterministically to `9,967` nodes / `24,963` edges / `308` communities.
- Native visual/game validation was not applicable to this severity-policy-only unit. Retained two-profile
  `pipeline_test` evidence still proves Forge-to-X4 UI paint and interaction, not exact standalone-preview parity.

## External and durable records

- GitHub #41 comment `5460382092` was written and read back; the issue remains open.
- Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a` was written and fetched back with Status `In Progress`, Evidence
  Grade `Partial`, exact source commit, tests, corpus result, and remaining game/release boundary.
- Google Doc `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was revision-locked from
  `AIroW36lt84Fqx6FIveaiTHVv9nd8X-o6l9iFOYppQWhdkjZFUA81qeRoHdAReUfyo4bN7CTowAQzIt_QcnW94fJ05flKFDe3w19meoxANUN`
  to `AIroW36P8KYF1ZNNxZJdRU5PSzdZFmgZXoaTQQcYCNFfSl3DB7YL9fHA41Mstl0lcmMPNEdjKbc9JrGW_Eu1nNZCMGbi1h9aOD_kQkUF3hzu`.
  Readback confirmed document/title/tab, `HEADING_2`, seven normal paragraphs, exact content, and final revision.
- `BACKLOG.md`, the bounded plan, this handoff, StarForge capability map, and both AAR ledgers carry the same boundary.

## Machine and containment state

- X4 is absent. Live Antigravity/Forge listeners remained at `127.0.0.1:3000` PID `21500` and
  `127.0.0.1:3300` PID `32036`; ephemeral `3001/3100/3101/8972` were clear after validation.
- The configured X4 corpus at `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` remained read only.
- Raw `node scripts/oracle-sweep.mjs` was retained red at `0/133` because no default `localhost:3001` server existed;
  `npm run test:oracles` is the isolated owner and passed `134/134`.
- The isolated oracle owner left temp-only
  `C:\Users\Moshi\AppData\Local\Temp\x4-oracle-discovery-17744`. Exact resolved cleanup was blocked by host
  destructive-operation policy; do not bypass the guard. Older temp roots predate this unit.

## Next exact product unit — finish the descriptor-height source path

1. Reconcile exact shipped `table:setDefaultCellProperties("editbox", ...)`, `editbox:setHotkey(...)`,
   `initTableCell`, and `editbox:getHeight()` readers/writers against the existing call model, layout program, linter,
   Scene, source editor, and official corpus. Use Graphify first and open known source paths directly.
2. Document one bounded tests-first plan. Port only the closed source semantics needed to resolve editbox descriptor
   height; do not invent row-peer inheritance or general Lua execution.
3. Require omission-with-positive-table-default and omission-with-displayed-hotkey positives, bare omission warning,
   literal-zero/hotkey policy, dynamic gaps, forged ownership/provenance negatives, project/package/Problems parity,
   and an unchanged official-corpus census.
4. After that source path is stable, return to the visible renderer gap: explain or remove the large Forge frame outline
   and missing X4 background/alpha composition from shipped source before expanding the AI Influence reconstruction.

## Eyeball queue and release boundary

- Compare exact Forge/X4 frame, button, text, and editbox edges at both retained profiles; current common structure is
  real, but frame outline and background/alpha composition still differ.
- Exercise MENU/HUB/COMM in the mounted editor and retain screenshots, then verify measured keep-out overlays.
- Reconstruct supplied AI Influence screen `1b` first, then remaining screens, only from visually inspected references
  and real X4 Lua output.
- Preview is for layout; game is truth. General C++ acceptance, exact pixels, installed-extension proof, and OpenVSX
  release remain open. Do not publish yet.

## Triggered AAR failure shields

- A focused green linter suite does not validate severity against shipped source; run the unchanged canonical corpus.
- Row aggregate height and widget descriptor height are different source owners. Reject wording that conflates them.
- Package-readiness probes need a valid standalone-menu lifecycle, including `OpenMenu`, before aggregate blocking state
  can isolate one rule.
- Run oracles through `npm run test:oracles`; raw `oracle-sweep.mjs` needs an already-running server.
- Never recursively search the 33 GB corpus for a known asset; open the reconciled authoritative path and exact range.
- Highest product risk remains a convincing preview being mistaken for game truth. Keep the disclaimer and deploy/game
  gate authoritative until exact frame/alpha, broader Helper/widget coverage, and current X4 evidence are closed.
