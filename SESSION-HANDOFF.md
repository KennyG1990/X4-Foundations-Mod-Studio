# Session handoff — B119 source-linked X4 UI authoring

Date: 2026-08-22
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL — host and final export verified; not verified in game`

## Session-start brief

- Project: X4 Forge B119, the linter-first faithful 2D X4 UI editor. Port shipped X4 Lua/corpus semantics; do not
  invent an approximate renderer or treat preview success as engine acceptance.
- Current bounded result: source-canonical frame-block authoring, source-linked preview geometry diagnostics,
  wrapped-text placement evidence, and table-background draw applicability are host-verified. The isolated AI Influence
  `1b` source is mounted and visually inspected. Its final `BF22...` bytes are also exported through Forge into a fresh
  complete 42-file candidate and pass full-mod validation. Exact design parity and game truth remain open.
- Overall boundary: every preview surface continues to say `Not verified in game`. The real mod remains byte-identical;
  deployment, C++ frame acceptance, X4 launch, and player-visible comparison are not part of the host/export checkpoint.
- Commit question: implementation `959eb680125395148bd5ec969d01ce9685d94cc6` and documentation close
  `c5afd886f3c105134bf2a2fea7ff1be82c84e491` are pushed with local/origin/remote parity. Commit and push only the
  current three-file final-export synchronization before crossing the real-mod/game unit.

## Operator and machine state

- The operator last reported Antigravity running, X4 not running, and the machine quiet.
- No native Luna worker remains open. The isolated server/browser and every validation-owned child tree are stopped.
- Ports `3000`, `3001`, `3100`, `3101`, `3300`, and `8972` are free; X4 is absent. Shared Node process count returned
  to the observed baseline `64`; do not kill those unrelated/shared processes.
- Do not deploy, launch X4, write the real mod/live extension/unpacked corpus, or mutate standing configuration without
  presenting the project write gate and receiving explicit `go` while the operator is present.

## Implemented host checkpoint

- `src/lib/x4UiSourceEdits.ts` and selftest:
  - issue one exact frame/display `insert-block` action for proven selected-frame ownership in assigned-row,
    multi-table source;
  - accept only `2..64`, at-most-`32768`-character top-level direct calls from the bounded X4 UI construction allow-list;
  - reject handlers, functions, control flow, hidden/nested executable calls, foreign owners, malformed locals,
    stale CAS, and ledger/provenance drift before mutation;
  - prove byte locality, complete source reparse, exact call/operation/owner/kernel-ledger delta, parent immutability,
    and reissued source/catalog authority.
- `src/components/X4UiSourceEditor.tsx` and selftest:
  - expose frame-block stage/apply/parent acknowledgement through the existing owner;
  - mount a separate read-only Scene geometry panel that renders only source-linked `height`/`width` gaps in stable
    source order with exact range, reason, status, and `nodeId`;
  - retain static-linter semantics and the permanent `Layout evidence only · Not verified in game` boundary.
- `src/lib/x4UiScene.ts`, `src/lib/x4UiPaintPlan.ts`, and adjacency selftests:
  - compare un-clipped wrapped-text line placement with the explicit widget rectangle;
  - retain canonical table background-color descriptor authority separately from exact optional `backgroundID`;
  - emit a native table fill only for a known nonempty ID. Empty-ID P7 remains `13` Scene facts / `31` Paint tints;
    the existing `backgroundID="solid"` path stays active.
- Isolated Forge dogfood source SHA-256 is
  `BF22DF42391F191C9F43D8F4EF6FEFDEFB8C60586D8646CC9F5436F426240E44`. Transcript budget is `303 px`, orange
  widget height is `187 px`, all three issued Zekton lines fit, and the old line-535 overflow is absent. No real mod,
  game, corpus, or config file changed.

## Final Forge export and complete candidate

- Read-only reconciliation found the old static variant/full candidate at `C0FC458D...2BC4B` while the mounted source
  was final `BF22DF42...40E44`; this was a stale-export gap.
- Forge's existing `POST /api/agent/package` owner emitted exact `BF22DF42...40E44`, `99,841` bytes, from mounted
  workspace `ws_d3d5e1ca8d919c57d6f40cad` at content/snapshot hashes `39efe7d3c3be0a4c` / `b1122cc7f89f13f1`.
- Fresh complete candidate:
  `dev-docs/b119-ai-influence-dogfood/final-export-validation/candidate-mod`. It has `42` files and differs from the
  prior validated complete candidate at exactly one path: `ui/addons/ai_influence_chat/aic_menu.lua`.
- `npm run validate:mod` passed `VALID`, exit `0`, `0` errors, `0` warnings, and `24` informational static gaps.
  Receipts: `final-export-validation/forge-export-receipt.json` and `validator.result.json`; validator stdout SHA-256
  `935528374040C944F5F973A3C6E07B08EAC347EAF89ED46D5FB4AAF62AC4272F`.
- Real source remains `4253D9BD...47DD7`. The isolated server is stopped, port `3300` is free, X4 is absent, and Node
  returned to baseline `64`.

## Mounted and visual evidence

- Exact selected target: `ui/addons/ai_influence_chat/aic_menu.lua -> menu.display`, profile `2560x1440`, scale `1`,
  `gameVerified=false`.
- Geometry panel census: `17` total, `16 height`, `1 width`, `0 incomplete`, all `17` with exact `nodeId` owners.
  Line 531 reports source range `531:18-531:20` and exact `81.6875 px` bottom overflow. Line 312 reports the exact
  negative omitted-width reason. Line 535 is absent.
- Visually inspected evidence:
  - `dev-docs/b119-ai-influence-dogfood/browser-evidence/2026-08-22-preview-canvas-intrinsic.png`, `2560x1440`,
    SHA-256 `391C2A764047358028AFF1F417E85BC7B7BA78B437EE334ADA43E3958DFAA404`;
  - `2026-08-22-preview-geometry-header.png`;
  - `2026-08-22-preview-geometry-line-312.png`;
  - `2026-08-22-preview-geometry-line-531.png`.
- Honest visual remainder: the `14%` speaker gutter is absent from the supplied `1b` reference; choice/input text is
  too small; rail horizontal borders remain; inactive edit-box placeholder/runtime state is unavailable; and the NPC
  striped region/bottom wheel label may be design annotations rather than native paint. Do not call this 1:1.

## Validation evidence

- Focused: SourceEditor P7 `12/12`; Preview `102/102`; EditorSession P7 `7/7`; Scene `143/143`; Paint `169/169`;
  Canvas `123/123`; TypeScript; exact-file zero-warning ESLint; diff hygiene.
- Oracle: first attempt correctly red with the isolated API stopped (`0/133` fetch failures); corrected environment
  passed runtime index `134/134`.
- Default system Node `24.15.0` / libuv `1.51.0` E2E is retained red evidence: API loss after 37 passes, wrapper
  `38 passed / 66 failed`, receipt SHA-256
  `B93206250E80562F2BA9A9E453E804E83A253C5AFEA254603F668DDFBA042956`; cleanup and live-state parity passed.
- Controlled process-local Node `24.19.0` / libuv `1.52.1`, exactly 23 tracked specs: `103/103`, zero
  failed/flaky/bad/quarantined rows, child exit `0`, complete lifecycle/ownership, `treeGone=true`, receipt SHA-256
  `E14FB1E3F797FAEA8BBE2CB3A8EEDD84386656AF12C5A561F376FC6174F14B67`.
- Full precommit: verdict `55/55`; Vite lifecycle; product copy; durable writers `14/14` plus extension `8/8`;
  capability contract `12 / 297 / 1 / 11`; MCP; action receipts `82 routes / 56 surfaces`; typecheck and size guards.
- Production build: `1,847` modules, client asset `index-DGP3XNnk.js`; server bundle passed.
- Graphify: `9,816 nodes / 24,550 edges / 303 communities`; no tracked graph delta.
- Live containment remained exact for `.studio-state`, `data`, `config.json`, and `.studio-api-token`; all validation
  ports are free and X4 is absent.

## Review and AAR

- Fresh-eyes review found no P0-P2 production defect in the bounded delta. The block surface remains structured,
  owner-issued UI construction rather than arbitrary Lua, and every accepted edit crosses CAS, reparse, and ledger
  proof before output.
- Review rejected the first Scene-only table-color repair because it would have painted an empty-ID table contrary to
  shipped X4. The final Scene/Paint split preserves descriptor authority and native applicability separately.
- Triggered AAR: assigned-row real-source shape escaped the first fixture; short ledger history missed the later real
  delete; the first text diagnostic ignored translated placement; review corrected negative-excess wording and two
  geometry fixture shapes; a stale build masked browser behavior; Playwright action timeouts required persisted
  readback; the first oracle run omitted its API; system Node produced a cascade; and an unrelated untracked E2E spec
  contaminated default discovery. External close also exposed a POSIX/PTY-only Google Docs trusted-read bridge on
  Windows and one PowerShell silent-command truthiness mistake; both are recorded in the authoritative plan. Final
  reconciliation also found mounted/source-candidate drift; every future deploy gate must prove mounted source hash,
  Forge package source hash, and isolated candidate hash are identical. The first export GET's missing-client refusal
  and one parse-only teardown attempt changed no state and remain AAR triggers.
- Highest-risk observed weakness: default Node `24.15.0` can turn one API-process loss into dozens of misleading
  feature failures. Keep the red receipt and use the controlled `24.19.0` tracked-only gate until the host defect is
  removed. No capability-map delta.

## Dirty-worktree preservation

Preserve and never stage or clean these unrelated paths: `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`, deleted
`data/known_fixes.json`, `data/trivia_questions.json`, `docs/DISCORD_BOTS_AND_GAMES.md`, W3B1 plans, deleted legacy bot
scripts, `test-results/.last-run.json`, all VS Code extension/evidence changes, issue templates, `Note for Kimi.md`,
`REFACTOR-PLAN.md`, root/reference screenshots, `media/`, `mermaid-diagram.png`, `target.name`, the untracked
marketing-showcase spec/evidence, and untracked `({`. The controlled tracked E2E set is exactly 23 specs / 103 tests.

## Git and external projection state

- Implementation commit: `959eb680125395148bd5ec969d01ce9685d94cc6`; documentation close:
  `c5afd886f3c105134bf2a2fea7ff1be82c84e491`. Before this final-export documentation delta,
  `HEAD == origin/main ==` remote `refs/heads/main`; the index was empty and unrelated dirty files remained preserved.
- GitHub owner issue #41 remains open with `67` comments; exact new comment `5379470924` contains the commit and
  partial/game-truth boundary.
- Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a` readback: `Status=In Progress`, `Evidence Grade=Partial`, exact
  commit/comment/Drive receipts, both current dates `2026-08-22`.
- Drive document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` readback: exact tab `t.0`, one H2 checkpoint,
  one commit occurrence, revision
  `AIroW35kObhxwpQWkygyGlWs1Ww19hL3hH7Ryjrvjmr76NYq3dRLDlFGZKMeShtGD6TN5607S-swQ_OD77EWMUXkRDIYwZxQd2FsYiw7F4CF`.
- Repository Markdown remains authoritative. External records do not authorize deployment or change
  `PARTIAL / Not verified in game`. This three-file final-export synchronization is the pending commit.

## Active next bounded unit and eyeball queue

1. Commit and push only this three-file final-export documentation synchronization; prove local/origin/remote parity and preserve
   every unrelated dirty path.
2. Present the real-write paragraph: exact real-mod target, frozen rollback snapshot and
   hashes, possible whole-frame refusal/UI reload/conversation closure, and restoration procedure. Wait for explicit
   `go`.
3. Deploy only the approved `BF22...` candidate, launch X4, capture engine acceptance/failure and the player-visible frame, then
   compare it with Forge and the supplied `1b` reference. Until those pass, retain
   `PARTIAL / Not verified in game`.

## Durable records

- Authoritative plan: `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`.
- Source-first design: `docs/plans/2026-08-10-b119-x4-ui-editor-source-first-design.md`.
- Owner issue: GitHub #41 remains open.
- Final isolated export/validation: `dev-docs/b119-ai-influence-dogfood/final-export-validation/`.
- Overall B119 status: `PARTIAL / Not verified in game`.
