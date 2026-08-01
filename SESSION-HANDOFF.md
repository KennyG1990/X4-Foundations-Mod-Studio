# X4 Forge — Session Handoff

Updated: 2026-08-01

## One-line state

B115 W0–W1/B116 remain `VERIFIED`; B117/W2A exact agent route authority is implemented but checkpointed
`PARTIAL` because the required full E2E receipt is red after three different retry-only failures. Do not call W2A
complete, move it to ROADMAP, package/install it, or begin W2B as a substitute for the missing gate.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge`; normal Antigravity may remain open, but this checkpoint used only isolated
  repository/runtime fixtures and did not take computer control.
- Machine state at validation start: Ken reported quiet. Every E2E run cleared ports 3100/3101; ports 3000/3001 were
  also clear. Live `.studio-state` and `config.json` hashes remained unchanged.
- Eyeball queue:
  - B114 running-game experience remains Ken-gated: launch X4 with debug logging; open Forge; click `LIVE`; fire one
    known cue and confirm a green badge; provoke/load one attributed cue error and confirm a red X; turn LIVE off and
    confirm updates stop.
  - B117 installed key-scope rendering is not ready for Ken yet. After a clean full E2E + package/install parity,
    open Antigravity → X4 Forge Studio → Agent Bridge → Agent API Keys; confirm read/write/deploy descriptions state
    exact reviewed powers, sensitive categories say Studio-only, and no copy says deploy has “everything.”
- Commit question: checkpoint only the enumerated B117 paths with title
  `security(agent): checkpoint exact reviewed route authority`; verify `origin/main == HEAD` after push. B117 remains
  open even after that checkpoint lands.

## Current evidence

- Base synchronized by fast-forward only: `e857f30606f72bd5b70059201ac3451c1eb9ca88`; eight incoming commits touched
  only README/Discord-sync paths and did not overlap W2A or the unrelated dirty worktree.
- Exact policy: `forge.route-dispositions.v4`, 290 direct routes + one dynamic registrar; runtime policy SHA-256
  `8b332e6fa9996bb5c3e2ed0fd5f269fd5ee2c8de62b1d400f8eb8ab76748026a`.
- Green: authority 8/8; routes 378/378; oracles 129/129; capability audit 11/290/1/10 with contract SHA-256
  `d8a820f537dbcbb50bcb8a91c8bd415c221a15940f184e38a817fa4566c1ac8f`; MCP; typecheck; lint exit 0 / zero errors;
  build; writer policy 14/14 + inventory + durable write 8/8; precommit; focused repaired E2E 3/3.
- Full E2E attempt 1: retry-only canvas bootstrap failure; test now waits for the existing E2E bootstrap authority and
  passes focused.
- Full E2E attempt 2: retry-only conflict-dialog timeout; trace proved the successful force receipt arrived just after
  ten seconds; test now waits for that exact receipt and passes focused.
- Full E2E attempt 3: `test-results/e2e-verdict.json` records 93 pass / 0 fail / 1 flaky / `green:false` after the
  `studio-shell.spec.ts` 2560 worker exited at 0 ms with `3221226505 == 0xC0000409`; unchanged retry passed and no
  failure trace exists. Fresh-eyes cause estimate: 88% known Node/libuv/Playwright Windows worker lifecycle, 10%
  cumulative harness interaction, at most 2% Forge viewport behavior.
- The zero-flake policy is working. Do not add an exemption, increase retries/timeouts, reorder the suite, weaken an
  assertion, or edit viewport product code without new reproduced evidence.
- Final staged security review corrected one overbroad claim: W2A proves a scoped agent key cannot spoof Origin/
  Referer to inherit stored provider credentials, but a caller already holding the full Studio bearer can still spoof
  the legacy `isAppUiRequest()` signal. That is the pre-existing, explicitly Ken-gated B64-SEC5 decision; W2A did not
  silently add a second UI-authentication mechanism or claim SEC5 fixed.
- No public release, installed IDE mutation, game/mod/config write, real provider dispatch/spend, stored-key migration,
  GitHub issue mutation or user-data deletion occurred.

## Ownership and staging boundary

- B117-owned: `config/durable-writers.json`, `config/forge-route-dispositions.json`,
  `scripts/capability-contract-audit.ts`, `scripts/route-integration.mjs`, `server.ts`,
  `src/components/AgentBridge.tsx`, `src/lib/agentAuthority.ts`, `src/lib/agentKeys.ts`,
  `src/lib/forgeCapabilities.selftest.ts`, `src/lib/forgeCapabilities.ts`, `src/server/gameDetectRoutes.ts`,
  `tests/e2e/canvas-interactions.spec.ts`, `tests/e2e/workspace-conflict.spec.ts`, `tsconfig.json`,
  `vscode-extension/mcp/x4forge-mcp.cjs`, `vscode-extension/src/extension.ts`, Graphify outputs, this handoff,
  the B117 child plan, the W2A delta in the parent plan, and only the B117 hunk in `BACKLOG.md`.
- Preserve and do not stage/reset/clean: unrelated `BACKLOG.md` hunks; `CODEX-ONBOARDING.md`; `KNOWN-BUGS.md`;
  deleted data/Discord/game documents and scripts; `.github/ISSUE_TEMPLATE/*`; `Note for Kimi.md`; old 0.0.35 PNGs;
  R8/R17 screenshots; generated `test-results/.last-run.json`.

## Next bounded work

1. First read-only command after checkpoint: inspect `node --version`, `npm ls @playwright/test`, the exact red
   `test-results/e2e-verdict.json`, and installed alternate Node runtimes. Specify a bounded supported-Node/toolchain
   A/B before changing project dependencies or machine state.
2. Obtain one clean full `npm run test:e2e` receipt under the unchanged zero-flake oracle; verify ephemeral teardown
   and live state/config hashes again.
3. Only then run staged app, VSIX inspection/probe, installed-byte parity and rendered Antigravity key-scope proof.
   Close B117 as `VERIFIED`, update ROADMAP/capability map/AAR records, and use final title
   `security(agent): enforce exact reviewed route authority`.
4. Keep B64-SEC5 separate and Ken-gated: decide whether the full Studio bearer is intentionally trusted for provider
   spend or approve a new UI-bound credential/confirmation design. Origin/Referer alone is not an authority proof.
5. Resume B115 W2B only after W2A closes. W7 Effective Tree authority remains locked behind its engine merge-law
   oracle. Kimi R18 remains `PARTIAL`; R21 remains `OPEN`; B114 remains the live-game experience gate.

## AAR

- Sustain: exact source/caller reconciliation, one mutation lane, external HTTP authority tests, byte-level denial
  invariants, secret-absence proof, and independent review caught real privilege and evidence-integrity defects.
- Improve work/approach: register evidence writers when introduced; size command wrappers from observed gate time;
  stop product/test edits once the failure class moves to an independently reproduced toolchain crash.
- Improve tools: candidate refusal should print exact mismatched authority deltas; the Windows Node/Playwright worker
  lifecycle needs a separate supported-version A/B rather than policy exceptions.
- Highest-risk evidenced weakness: shipped authorization bytes have not yet crossed clean full E2E/installed parity,
  and the adjacent full-Studio-token provider-origin boundary remains spoofable by design pending Ken's SEC5 decision.
  The checkpoint is useful and reviewable, but it is not a release-quality close.
- Project lesson: a retry-pass is evidence about likely cause, not permission to relabel a red required verdict green.
