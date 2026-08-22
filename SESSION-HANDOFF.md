# Session handoff — B119 isolated deploy/rollback verified

Date: 2026-08-22
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL — isolated actual deploy and rollback verified; real target write and in-game proof gated`

## Current state

- B119 is the linter-first faithful X4 2D UI editor. Port shipped X4 9.00 Lua/corpus semantics; preview is layout evidence, never proof that the C++ engine accepts a frame.
- Executable repair commit: `6f569e37ffc35da198796ca2adcafa3e1d6493b3`; local `HEAD`, `origin/main`, and direct remote readback match exactly.
- Isolated-deploy record commit: `07ed939c48b50308dd1eb4c012a5278ac9f197ac`; local `HEAD`, `origin/main`, and direct remote readback match exactly.
- GitHub #41 comment `5380523328` and the Notion owner page are updated and read back. Drive remains explicitly partial because the required trusted-read bridge rejects the Windows workspace path; no bypass was attempted.
- This external-sync addendum is uncommitted. Commit only the B119 plan, backlog, and handoff with explicit staging.
- Last operator state: Antigravity running, X4 not running, machine quiet.
- Current containment readback: X4 count `0`; listeners on `3000`, `3001`, `3100`, `3101`, `3300`, and `8972` all `0`; isolated server and Graphify processes stopped.
- No real installed mod, standing staging tree, unpacked corpus, or standing config was written.

## Milestone crossed

An actual deploy was executed only against a byte-identical isolated copy of the installed AI Influence extension, then reverted through the real recovery/history route. The first run exposed a causal audit defect: successful history recorded `deleted=0` and `preserved=0` although the planner and disk proved `39` deletions and `6` preserved roots. The repair now makes the successful response and history use the exact pre-write planner effect.

Post-repair isolated proof:

- preview: `added=0 / overwritten=43 / deleted=39 / preserved=6`, no target write;
- actual response: the same exact effect and `9,285,790` applied bytes;
- history row: the same exact effect, linked recovery, and matching observed target hash;
- applied target: `87` files / `16` directories / `10,815,054` bytes / `cc8978ea1d3b3e6970b4c1bb278080e9dbfebf82f4af2d94cb3180df977edfd8`;
- rollback: restored the exact prior tree fingerprint `a9046192c83c8b5c0a1304af96d64a43a203f5ee8ef5e34987583752884eb295`;
- replay: rejected with HTTP `409 RECOVERY_ALREADY_USED`.

The earlier `10,829,099 / ab8894...` prediction was wrong. The generated `README.md` is `205` bytes and replaces the installed `14,250`-byte README, an exact `14,045`-byte delta. The applied tree has two changed files, 85 unchanged files, and 39 deleted files.

## Repair

- `server.ts`: computes one request-local deployment effect through the existing planner before staging or target writes, returns it for dry-run and successful actual deploy, and allows the existing history middleware to persist the same facts. Failed deployment and recovery behavior remain unchanged.
- `scripts/route-integration.mjs`: seeds a destructive fixture with 39 removable files and six preserved roots; proves preview, response, history, disk mutation, exact rollback, and one-use replay behavior.
- `config/durable-writers.json`: updates only the exact `server.ts` fingerprint to `87e20e6cee084a62871edde45052b576659fb81a853a63340089d3c3a3dca474`.
- Native implementation worker `01a0294e-322c-7f91-87bc-31f3629dd1ae` used exact `gpt-5.6-luna` at max effort and is closed terminal-completed.

## Validation

- Route integration: `491/491 PASS`.
- TypeScript: PASS.
- Focused ESLint: exit `0`, zero errors, `241` pre-existing warnings.
- Durable writers: `14/14`; live audit PASS at `42` filesystem / `11` host-store / `2` browser-output sources; extension `8/8`.
- Complete `npm run precommit:check`: PASS on final repair state. The first commit-hook run reached an MCP child-process exit `3221226505`; the isolated MCP rerun passed, and the complete retry passed before commit.
- Production build: PASS; Vite `1,847` modules plus esbuild server bundle.
- Graphify update: PASS; `9,820` nodes / `24,553` edges / `312` communities.
- Post-repair receipt: `dev-docs/b119-ai-influence-dogfood/final-export-validation/isolated-deploy-rehearsal-r1/evidence/post-repair-deploy-rollback-receipt.json`.
- Exact real-write gate: `dev-docs/b119-ai-influence-dogfood/final-export-validation/deploy-and-rollback-gate.md`.

## Candidate and real-target baseline

- Approved source: `F:\DEV_ENV\X4_Forge\dev-docs\b119-ai-influence-dogfood\final-export-validation\x4_ai_influence`.
- Source: `42` files / `11` directories / `9,285,585` bytes / `f2a1f2fdf9e3a2a4d1eda6d406950609e27edda2ef85ee0b8dab8c90227cfbf5`.
- Real installed target: `G:\SteamLibrary\steamapps\common\X4 Foundations\extensions\x4_ai_influence`.
- Installed baseline: `126` files / `18` directories / `11,262,072` bytes / `a9046192c83c8b5c0a1304af96d64a43a203f5ee8ef5e34987583752884eb295`.
- Standing staging baseline: `155` files / `19` directories / `537,684,179` bytes / `1808f251bf466545ee8b57e352289081453b8b71989dc915a47e160427e2d758`.
- All three real-tree fingerprints remained unchanged after both isolated rehearsals.

## Git boundary

Owned executable paths:

- `server.ts`
- `scripts/route-integration.mjs`
- `config/durable-writers.json`

Owned record paths:

- `BACKLOG.md`
- `SESSION-HANDOFF.md`
- `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`

Preserve all unrelated dirty paths, including onboarding/bug docs, deleted legacy data and bot files, W3B1 records, test results, VS Code extension/evidence files, issue templates, screenshots/media, and miscellaneous untracked files. Never use broad staging.

## Next exact actions

1. Commit and push this three-file external-sync addendum; prove local/origin/remote parity.
2. Present the exact real-write paragraph and wait for literal `go`.
3. Only after `go`: deploy to real staging and installed target, verify response/recovery/history/fingerprints, then launch X4 and capture engine acceptance or frame refusal plus the player-visible comparison.

The eyeball queue remains one item: deployed AI Influence `1b` in X4. Until the real screenshot and interaction pass, B119 remains `PARTIAL / Not verified in game`.
