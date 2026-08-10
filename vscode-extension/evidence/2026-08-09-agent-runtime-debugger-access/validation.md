# Agent runtime debugger access — validation record

Status: VERIFIED
Date: 2026-08-09
Candidate: X4 Forge Studio 0.0.69

## Implemented boundary

- Canonical Agent API: `GET /api/agent/runtime-debugger?expect=<optional bounded names>`.
- MCP operation: `runtime_debugger`.
- Capability authority: `runtime.debug.read@1`, authenticated and exact-workspace-bound.
- No Studio, browser, computer control, arbitrary log path, whole-log response, or AI interpretation is required.
- Existing deterministic mod ownership, session, verdict, explanation, and node/file mapping remain authoritative.

## Focused deterministic evidence

- Capability audit: PASS; 12 capabilities, 296 disposed routes, one dynamic registrar, 11 MCP aliases.
- Capability contract SHA-256:
  `bb467c4b70402b3dd31571dbe10d60ec05653dc6f6600f043037e993f292037c`.
- MCP capability selftest: PASS (`read=6`, `write=10`, `deploy=11`).
- Route integration: `487/487` PASS.
- Runtime-debugger adapter: `42/42` PASS.
- Capability registry: `27/27` PASS.
- Typecheck: PASS.
- Lint: PASS with zero errors and 592 pre-existing warnings.
- Runtime-index oracle sweep: `133/133` PASS.
- Focused capability-contract E2E after fixture correction: `5/5` PASS.
- Exact first affected canvas test file after the ephemeral outage: `3/3` PASS unchanged.
- Production build, extension build, and staging: PASS.
- Staged sidecar probe: `16/16` PASS.
- Graphify refresh: 6,311 nodes, 15,557 edges, 239 communities; no tracked graph churn.

## Isolated Playwright/Vite lifecycle repair (VERIFIED)

Observed old-harness failure: tests 1-81 passed, then the UI listener on 3100 was gone before test 82 and tests
82-102 cascaded `ERR_CONNECTION_REFUSED`; a prior run lost it after test 1. The installed
Playwright runner invokes `webServer.command` through `shell:true`, contradicting the old direct-Vite ownership
comment. A piped-stdin probe did not reproduce shutdown. The shell-ownership explanation is therefore a hypothesis,
not yet a full-suite diagnosis.

The bounded repair removes the Vite `webServer.command`, starts Vite with the repository `vite.config.ts` through a
Playwright global-setup JS-API handle, preserves the 127.0.0.1/3100/3101 split, strict port, token/proxy,
`DISABLE_HMR=true`, and `watch:null` semantics, and closes/restores state through the setup cleanup callback. The
existing API server remains the only Playwright `webServer` process.

- `npm run test:e2e-vite-server`: PASS; dynamic-port readiness/token injection/config semantics, close, occupied-port
  rejection, environment restoration, and post-failure cleanup.
- `npm run typecheck`: PASS after the final correction.
- `npm run lint`: PASS, 0 errors and 592 established warnings.
- `node scripts/run-e2e.mjs tests/e2e/capability-contract.spec.ts`: initial setup-only failure due to deriving the
  repository root from `FullConfig.rootDir`; corrected to `configFile` directory, then PASS `5/5`, zero flaky/bad,
  `treeGone=true`.
- `node scripts/run-e2e.mjs tests/e2e/runtime-debugger.spec.ts`: PASS `6/6`, zero flaky/bad, `treeGone=true`.
- 3100/3101 listener checks: clear before/after the focused runs and after the selftest; selftest dynamic ports also
  clear.
- Coordinator-owned repaired full E2E: PASS `102/102`, zero failed/flaky/bad, complete structured report,
  `childExit=0`, `treeGone=true`, and ports 3100/3101 clear.
- `npm run precommit:check`: PASS, including the lifecycle selftest, 54/54 E2E-verdict selftests, product-copy,
  durable-writer, capability/MCP, action-receipt, typecheck, mirror, tripwire, and large-file gates.

This repair is VERIFIED. The parent release task remains PARTIAL until its public/installed gates and external-record
close pass.

## Candidate artifact

- Path: `vscode-extension/x4-forge-studio-0.0.69.vsix`.
- Archive bytes: 18,173,930.
- Unpacked bytes: 61,789,011.
- Entries: 2,091.
- SHA-256: `73482D3E8FC716B19DA82F8199A0F4DFFE063146514C7E11DF65B1182E06A91F`.
- Archive readback confirms manifest version, capability descriptor, canonical server route, and MCP operation.

## Full E2E evidence

1. Run 1: FAILED `99/102`. Three tests retained the prior 11-capability count or unintentionally included the new
   capability in an exact one-capability fixture. The bounded test-only correction passes focused `5/5`.
2. Run 2: FAILED `6/102`. The ephemeral Vite server on port 3100 disappeared after test one; the remaining tests
   inherited `ERR_CONNECTION_REFUSED`. Structured reporting completed, teardown reported `treeGone=true`, and ports
   3100/3101 were clean. The first affected test file subsequently passed unchanged `3/3`.
3. Run 3, before repair: FAILED `81/102`. Tests 1-81 passed; Vite disappeared before test 82 and tests 82-102
   inherited `ERR_CONNECTION_REFUSED`. Reporting and cleanup completed, ports were clean, and Windows logged no
   relevant resource-exhaustion or process-crash event.
4. Repaired authoritative run: PASS `102/102`, zero failed/flaky/bad, complete report, `childExit=0`,
   `treeGone=true`, and ports 3100/3101 clean.

The three old-harness failures remain red historical evidence and are not relabelled. The repaired run satisfies the
authoritative full-suite acceptance contract.

## Public and installed release proof

- Open VSX exact/latest metadata: `0.0.69`.
- Independent public archive: 18,173,930 bytes, SHA-256
  `73482D3E8FC716B19DA82F8199A0F4DFFE063146514C7E11DF65B1182E06A91F`, exactly matching local; public inspection
  passes at 2,091 entries and 61,789,011 unpacked bytes.
- Antigravity registry/page: installed `0.0.69`; extension host reloaded; only the installed `0.0.69` sidecar tree
  remains alive after exact cleanup of the superseded tree.
- Installed schema registry: 40 domains from one root, including `md` and `aiscripts`.
- Installed canonical API: schema 1; missing auth `401`; wrong workspace `403`; real selected evidence remains
  honestly `historical` / `stale`.
- Installed MCP: live capability discovery; `runtime_debugger` call returned eight capped incidents, two expected
  steps, one safe confirmed navigation target, six unresolved items, and no forbidden raw/path fields or guessed
  navigation. The temporary exact key was revoked.
- Detailed evidence: `installed-validation.md`.

## Source and external-ledger close

- Feature commit: `75dc088ed35f76e066d4f1d20b990d08b546db8a`.
- Source parity: `HEAD == origin/main == ls-remote origin/main` after the feature push.
- Google Drive: Project README, Current Status, Current Roadmap, and GitHub Changelog Snapshot read back current
  `0.0.69`, the exact commit/public hash, canonical Agent API/MCP boundary, and remaining #14/#35 limits.
- Notion: Project Hub readback is current; unique release page
  `3b84618e-d15b-81eb-b99c-ccfdc8d2a494` is `Published` / `Verified` with Open VSX, GitHub, and Internal channels.
- GitHub: issue #14 readback is OPEN with exactly one implementation-ledger marker containing the `0.0.69` slice,
  exact commit/evidence links, public hash, and remaining broader oracle scope.

This bounded release is VERIFIED. #14's broader precision loop, #35 current-session proof, and silent no-evidence
semantics remain explicitly open and are not relabelled.

No real mod, game installation, source debug log, or standing workspace content was written by this task.
