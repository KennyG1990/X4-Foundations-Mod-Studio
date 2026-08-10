# X4 Forge session handoff

Updated: 2026-08-09

## One-line state

The Forge extension's canonical agent-readable runtime debugger is VERIFIED and shipped in public/installed `0.0.69`:
stable capability `runtime.debug.read@1`, authenticated `GET /api/agent/runtime-debugger`, and MCP `runtime_debugger`
all reuse the same deterministic owner. Public hash, installed Antigravity API/MCP/schema proof, full `102/102` E2E,
precommit, Google Drive, Notion, GitHub #14, feature commit, push, and remote parity all pass.

## Project and boundary

- Repository: `F:\DEV_ENV\X4_Forge`, branch `main`.
- Baseline: `HEAD == origin/main == c454d2c240965e4775b5929f8e54b5e5f5a02880` at task start.
- Verified feature checkpoint: `75dc088ed35f76e066d4f1d20b990d08b546db8a`, with local, tracking, and remote
  refs identical after push.
- Product: the Forge extension, embedded Studio, extension-managed sidecar, Agent API, and native MCP projection.
- No real mod, game installation, live workspace content, or source debug log was written.
- GitHub #14 owns this bounded runtime-debugger API/MCP slice; #35 still owns current-X4-session experience proof.

## Implemented and publicly verified 0.0.69 release

- Capability: `runtime.debug.read@1`, workspace required, authenticated, with declared `read`, `analyze`,
  `audit-write`, and `audit-retention-delete` effects.
- Canonical Agent API: `GET /api/agent/runtime-debugger?expect=<optional bounded names>`.
- MCP tool: `runtime_debugger`; available only from live effective-capability discovery, never legacy static fallback.
- API and MCP reject arbitrary log paths/mod IDs. `expect` is the only canonical input and is capped at 256 chars.
- MCP output caps incidents, expected steps, evidence, counts, lines, strings, and arrays; excludes whole-log/raw fields;
  redacts user-home paths; and exposes navigation only for confirmed active-mod node or file/line ownership.
- Existing Studio route `/api/agent/debug-watcher/brief` remains a compatibility envelope over the same adapter path.
- Version/changelog metadata is prepared at `0.0.69`; notes mention only the implemented Forge capability.

## Green validation so far

- `npm run test:capabilities`: 12 capabilities, 296 disposed routes, 1 dynamic registrar, 11 MCP aliases; contract
  SHA-256 `bb467c4b70402b3dd31571dbe10d60ec05653dc6f6600f043037e993f292037c`.
- `npm run test:mcp-capabilities`: PASS; read 6, write 10, deploy 11.
- `npm run test:routes`: `487/487` PASS, including auth/workspace/capability/effect denial, compatibility parity,
  canonical output schema, and no workspace/game-log write.
- Runtime-debugger adapter `42/42`; capability registry `27/27`; typecheck PASS.
- Lint PASS with 0 errors and 592 pre-existing warnings.
- Runtime-index oracle sweep `133/133` PASS.
- Focused repaired capability-contract E2E `5/5`; focused canvas reproduction `3/3`.
- Production build PASS; extension build PASS; staged-app probe `16/16` PASS.
- VSIX inspector PASS: 2,091 entries, 61,789,011 unpacked bytes, 18,173,930 archive bytes.
- Repaired authoritative full E2E: `102/102` PASS, zero failed/flaky/bad, complete structured report,
  `childExit=0`, `treeGone=true`, and ports 3100/3101 clean.
- `npm run precommit:check`: PASS, including E2E verdict/lifecycle, product-copy, durable-writer,
  capability/MCP, action-receipt, typecheck, mirror, tripwire, and large-file gates.
- Fresh local candidate: `vscode-extension/x4-forge-studio-0.0.69.vsix`, SHA-256
  `73482D3E8FC716B19DA82F8199A0F4DFFE063146514C7E11DF65B1182E06A91F`.
- Archive readback confirms package version `0.0.69`, MCP tool/route, server route, and capability bytes.
- Open VSX exact/latest metadata reports `0.0.69`; independently downloaded public bytes exactly match the local
  candidate at 18,173,930 bytes and SHA-256
  `73482D3E8FC716B19DA82F8199A0F4DFFE063146514C7E11DF65B1182E06A91F`.
- Antigravity was reloaded from the public archive. Only the installed `0.0.69` sidecar tree remains active; its
  schema registry reports 40 domains including Mission Director and AI scripts.
- Installed Agent API proof returned schema 1, rejected missing auth with `401` and the wrong workspace with `403`,
  and retained truthful `historical` / `stale` evidence state.
- Installed MCP discovery and invocation returned a bounded/redacted runtime-debugger projection with one safe
  confirmed navigation target and no guessed navigation. The temporary exact workspace key was revoked.
- Durable validation is recorded at
  `vscode-extension/evidence/2026-08-09-agent-runtime-debugger-access/validation.md`; the task plan records the exact
  implemented API/MCP boundary, every green gate, both red full-E2E runs, review state, and triggered AAR facts.
- Installed/public proof is recorded at
  `vscode-extension/evidence/2026-08-09-agent-runtime-debugger-access/installed-validation.md`.
- Google Drive Project README, Current Status, Current Roadmap, and GitHub Changelog Snapshot each read back the
  current `0.0.69` feature commit, public hash, canonical API/MCP boundary, and remaining #14/#35 limits.
- Notion Project Hub is current. Release page `3b84618e-d15b-81eb-b99c-ccfdc8d2a494` is uniquely `Published` /
  `Verified` across Open VSX, GitHub, and Internal channels.
- GitHub #14 remains OPEN/PARTIAL with exactly one implementation-ledger marker containing the verified `0.0.69`
  agent-access slice and the still-open broader oracle scope.

## Isolated E2E Vite lifecycle repair — VERIFIED (2026-08-09)

- `playwright.config.ts` no longer launches Vite through `webServer.command`; the existing isolated API server on
  3101 remains the only Playwright webServer process with API-only state/config/discovery and the fixed E2E token.
- `tests/e2e/global-setup.ts` starts Vite in the Playwright runner process through the Vite JS API and returns a
  deterministic cleanup callback. `tests/e2e/e2e-vite-server.ts` loads the repository `vite.config.ts`, preserves
  127.0.0.1, strict port, 3100/3101 proxy, token injection, `DISABLE_HMR=true`, and `watch:null`, rejects occupied
  ports, cleans partial startup, and restores its environment keys on close/failure.
- `npm run test:e2e-vite-server`: PASS on disposable ports, including readiness/close, occupied-port rejection,
  environment restoration, and post-failure port cleanup. The named selftest is green inside precommit.
- `npm run typecheck`: PASS. `npm run lint`: PASS, 0 errors and 592 established warnings.
- Official early focused wrapper: first invocation failed before test collection because global setup assumed
  `FullConfig.rootDir` was the repository root; after the `configFile`-based correction it passed `5/5`, zero
  flaky/bad, `treeGone=true`. Official runtime-debugger wrapper passed `6/6`, zero flaky/bad, `treeGone=true`.
- Listener checks found 3100/3101 clear before/after each focused run and after the selftest. The coordinator's
  repaired authoritative run passed `102/102` with complete reporting, `treeGone=true`, and clean ports; precommit
  also passed. The direct-owner lifecycle is therefore VERIFIED.

## Red full-E2E evidence — do not relabel

1. First full run: `99/102`, three stale capability-contract expectations. The registry count moved 11 -> 12 and
   the exact one-capability key fixture had not deselected `runtime.debug.read@1`. The one-file test repair is focused
   green `5/5`.
2. Second full run: `6/102`; after test 1, Vite on port 3100 disappeared and all remaining browser tests failed with
   `ERR_CONNECTION_REFUSED`. Structured report was complete and teardown was clean (`treeGone=true`, ports clean).
   The exact first affected three-test file then passed `3/3` unchanged, so this is a reproduced ephemeral server
   death but not a repeatable product failure.
3. Third old-harness full run: `81/102`; tests 1-81 passed, Vite disappeared before test 82, and tests 82-102
   inherited `ERR_CONNECTION_REFUSED`. Reporting/cleanup completed and Windows logged no relevant resource or crash
   event.
4. The repaired authoritative run passed `102/102`; all three prior failures remain red historical evidence.
5. The Google Docs trusted-read bridge initially rejected Windows paths, then exact readback caught connector-tool
   output truncation in a local evidence adapter. A POSIX virtual-root adapter plus apply-patch writes and SHA-256
   readback completed all four trusted reads. These were local evidence-path failures only; no Google document write
   occurred.

## Exact task-owned paths

- `server.ts`
- `src/lib/forgeCapabilities.ts`
- `src/lib/forgeCapabilities.selftest.ts`
- `scripts/capability-contract-audit.ts`
- `config/forge-route-dispositions.json`
- `scripts/route-integration.mjs`
- `vscode-extension/mcp/x4forge-mcp.cjs`
- `scripts/mcp-capability-selftest.ts`
- `tests/e2e/capability-contract.spec.ts`
- `vscode-extension/package.json`
- `vscode-extension/package-lock.json`
- `vscode-extension/release-notes.json`
- `vscode-extension/CHANGELOG.md`
- `docs/plans/2026-08-09-agent-runtime-debugger-access.md`
- `SESSION-HANDOFF.md`
- `vscode-extension/evidence/2026-08-09-agent-runtime-debugger-access/validation.md`
- `package.json`
- `playwright.config.ts`
- `scripts/precommit-check.mjs`
- `scripts/e2e-vite-server.selftest.ts`
- `tests/e2e/global-setup.ts`
- `tests/e2e/e2e-vite-server.ts`
- release evidence/ROADMAP/capability-map/AAR files after final release validation.

## Preserved unrelated dirty state

Never stage, revert, delete, or rewrite:

- `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`.
- `docs/plans/2026-08-02-w3b1-addressed-state-receipts.md` and
  `docs/plans/2026-08-07-w3b1b-guarded-filesystem-recovery-receipts.md`.
- Pre-existing deleted Discord/data files and `test-results/.last-run.json`.
- Existing modified `vscode-extension/evidence/0.0.35-*` and untracked
  `vscode-extension/evidence/2026-07-31-r8-r17/*` screenshots.
- `.github/ISSUE_TEMPLATE/*`, `Note for Kimi.md`, and every other pre-existing owner path.

Use `git add -- <exact checkpoint paths>` only. Never use broad add, clean, reset, checkout, or stash.

## Exact continuation

The bounded `0.0.69` agent-access release is complete. Do not resume deferred Forge governance by default. Return to
mod development. When Forge work is deliberately resumed, the mod-first next unit remains an isolated scratch deploy
and current-X4-session experience proof under #35; #14 separately retains static-to-engine precision, scorecards, and
governed validator-miss promotion. Do not use the real mod as the acceptance fixture.

## Eyeball queue

- None for this non-visual API/MCP slice. #35 retains the future current-X4-session experience gate.

## Commit point

Commit point: `docs(runtime): close 0.0.69 agent access release`. Status is `VERIFIED`: implementation, full E2E,
both final precommit executions, public publication/hash parity, installed Agent API/MCP/schema proof, feature commit
and remote parity, Google Drive, Notion, and GitHub #14 readbacks are green. This documentation-close commit changes
no published package bytes, mod files, game files, or installed extension bytes.
