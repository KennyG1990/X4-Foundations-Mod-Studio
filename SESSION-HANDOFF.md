# X4 Forge — Session Handoff

Updated: 2026-08-01

## One-line state

B115 W0–W2A are `VERIFIED` through B117. Exact reviewed route authority crossed source, adversarial HTTP/MCP,
94/94 full E2E, packaged-byte, installed Antigravity and rendered-copy gates. W2B effective-authority discovery,
per-key narrowing and MCP projection is next; B64-SEC5 and B114 remain separate Ken-gated boundaries.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge`. Antigravity 1.107.0 is open and responsive on the installed 0.0.63 extension;
  computer control is released. Ken reported the machine quiet before validation.
- Eyeball queue:
  - B114 running-game experience remains Ken-gated: launch X4 with debug logging; open Forge; click `LIVE`; fire one
    known cue and confirm a green badge; provoke/load one attributed cue error and confirm a red X; turn LIVE off and
    confirm updates stop.
  - B117 has no remaining eyeball gate. Installed evidence already shows Forge v1.0.409 and the exact Agent Keys scope
    copy. The separate Antigravity agent pane displayed `MCP Error`; do not cite that pane as external-MCP proof.
- Commit point: stage only the B117 close paths below, run the final precommit gate, commit
  `security(agent): enforce exact reviewed route authority`, push, and assert `origin/main == HEAD == ls-remote`.

## Current evidence

- Source checkpoint: `e70046830cbc2548e27920d4828cf2978c55ade0`; exact policy
  `forge.route-dispositions.v4`, 290 direct routes plus one dynamic registrar, SHA-256
  `8b332e6fa9996bb5c3e2ed0fd5f269fd5ee2c8de62b1d400f8eb8ab76748026a`.
- Source/runtime: authority 8/8; routes 378/378; oracles 129/129; capability audit 11/290/1/10 with contract SHA-256
  `d8a820f537dbcbb50bcb8a91c8bd415c221a15940f184e38a817fa4566c1ac8f`; MCP; typecheck; lint exit 0 / zero errors;
  build; writer policy 14/14 plus inventory and durable writes; precommit.
- Final full E2E: 94/94, zero failed/flaky/bad/quarantined, `childExit:0`, `green:true`; receipt generated
  `2026-08-01T22:21:10.45Z`. Instrumented log SHA-256
  `C5239B8CE97122EC2C1E86965BAF6C642032809BC9177AF0B98674CDABC68EF6`. Ports 3000/3001/3100/3101 cleared;
  live workspace/config fingerprints stayed unchanged.
- Package: staged probe 16/16, inspector 13/13, 2,091 entries. Candidate
  `vscode-extension/x4-forge-studio-0.0.63-b117-20260801-1824.vsix` is 17,964,903 bytes, SHA-256
  `5456DF296C784C295A47318B373EDE19C97A2A33D13AA00A6D78E5F67DD87CFA`.
- Installed: Antigravity extension inventory reports 0.0.63; all 2,089 packaged extension files match with zero
  missing/mismatched/unexpected, normalized `package.json` matches, and the archive/installed manifest hash is
  `BD1222499FD5752DAF5A64DA124250981CB896D993476E7896391D68EFAD279C`. Forge v1.0.409 visibly rendered the managed
  sidecar and exact read/write/deploy plus Studio-only copy. Evidence:
  `vscode-extension/evidence/2026-08-01-b117-authority/`.
- Failed attempts remain recorded: invalid Node 22/native-ABI A/B; one unreproduced full-run backend exit; live-file
  installer lock; post-success installer V8 teardown; first parity-helper API error; and one post-review precommit MCP
  child exit `0xC0000409`. The exact MCP gate then passed 5/5 and the complete precommit rerun passed in 151.5 seconds.
  Independent final oracles are green; none of the failed attempts was relabelled.
- No public release, game/mod/config write, provider spend, stored-key migration, GitHub issue mutation or user-data
  deletion occurred.

## Ownership and staging boundary

- Final B117 close owns: `tests/e2e/continuous-polling.spec.ts`,
  `docs/plans/2026-08-01-b117-exact-agent-route-authority.md`,
  `docs/plans/2026-07-31-capability-convergence.md`, only the B115/B117 hunk in `BACKLOG.md`, `ROADMAP.md`, this
  handoff, Graphify outputs if changed, and `vscode-extension/evidence/2026-08-01-b117-authority/`.
- Preserve and do not stage/reset/clean: unrelated `BACKLOG.md` R13/B111–B114 hunks; `CODEX-ONBOARDING.md`;
  `KNOWN-BUGS.md`; deleted data/Discord/game documents and scripts; `.github/ISSUE_TEMPLATE/*`; `Note for Kimi.md`;
  old 0.0.35 PNGs; R8/R17 screenshots; generated `test-results/.last-run.json`.
- The capability-map delta is specified in the B117 repository close. The external StarForge capability/AAR mirrors
  were not written under this repository-only authorization boundary.

## Next bounded work

1. Confirm the B117 close commit is on `origin/main`, then classify W2B as a new Full-lane unit. Read this handoff,
   `BACKLOG.md`, the convergence plan, B117's exact-policy seam, GitHub #19/#20 and the current capability map before
   proposing changes.
2. Reconcile actor-effective capability discovery, per-key narrowing and MCP projection against the existing B42 key
   store, `forge.route-dispositions.v4`, canonical capability registry, Agent API discovery and ten-tool MCP shim.
   Specify one bounded unit before implementation; do not build a second permission engine or generic dispatcher.
3. Keep B64-SEC5 separate and Ken-gated: decide whether the full Studio bearer intentionally trusts the legacy
   Origin/Referer signal for stored-provider spend or approve a UI-bound credential/confirmation design.
4. Deliberately pull B114's live-game experience gate when Ken and X4 are available; easy source work must not starve
   it. Kimi R18 remains `PARTIAL`; R21 remains `OPEN`; the post-Kimi research program stays queued behind R1–R21.

## AAR

- Sustain: one exact policy seam, structured zero-flake receipts, isolated-state hashes, targeted reduction, package
  inspection, byte-level installed parity and rendered-host proof.
- Improve work/approach: check native ABI compatibility before alternate-runtime A/B; review narrow call-site diffs;
  close the host before extension replacement; separate installer narration from process-exit evidence.
- Improve tools: retain backend PID/exit/signal and native ABI in E2E evidence; Antigravity should not crash after a
  successful extension install.
- Highest-risk evidenced weakness: B64-SEC5 remains a spoofable full-Studio-bearer compatibility boundary. Scoped
  keys cannot reach it, but W2A does not solve or hide it.
- Project lesson: an abnormal installer exit requires independent installed-byte and real rendered-host proof.
