# X4 Forge session handoff — 2026-07-25 · 0.0.43 published · deploy fixed, ledger shipped, friction pass 10/10

## One-line state

Three releases shipped today (0.0.41 → 0.0.43, all published and store-verified); deployment survives a
held Windows folder, the author chooses loose vs CAT/DAT, agents have an action history, and the
ten-item user-friction brief is fully implemented — with **B81 (`/api/fs/read` root) still open and
still the resident agent's #1**.

## What shipped today

| Release | Contents |
|---|---|
| **0.0.41** | B83 locked-root deploy fallback · B84 deploy-format toggle + loose stale-removal + `schemaDir` blanking fix · B86 Agent Action Ledger |
| **0.0.42** | Ledger fixes: errors NAME the error, coverage inverted to deny-list (6 → all mutating routes), node linkage |
| **0.0.43** | B93 user-friction pass, 10/10 items across three waves; **closes B82** |

## The 0.0.43 API surface an agent should know

- **Discovery — stop port-scanning.** `~/.x4forge/latest.json` (and `instances/<pid>.json`) carry
  `{port, token, pid, startedAt, cwd, mode}`, `0600`, pruned when the process dies. **Check `pid`
  liveness if you cache it.**
- **`GET /api/agent/status`** — port, workspace, roots, last deploy, readiness, ledger counts, and
  canvas-vs-source staleness *with the exact call that fixes it*.
- **`POST /api/agent/project/validate {root, path}`** — same shape as `mod-folder/import`; stop
  building file lists by hand.
- **`POST /api/agent/deploy-verify {dryRun: true}`** — added/overwritten/**deleted**/preserved with
  sizes, writes nothing. `{autoReimport: true}` clears a stale canvas in one step.
- **`POST /api/agent/check-expression {expression, variableTypes?}`** — one expression, no 34-file
  payload. Live-proven: `$station.manager` → `legal:false`.
- **`POST /api/fs/write`** returns a receipt: bytes, sha256, `byteExact`, CRLF/LF profile. You can
  drop your own byte-exact readback.
- **Wrong verb → 405 + `Allow`. Unknown API path → JSON 404.** No more SPA HTML on an API route.

## Gates (all green at close)

typecheck · lint 0 errors · oracles **104/104** · routes **141/141** · **e2e 26/26 PASS** · precommit ·
build. Store: `0.0.43` on both endpoints.

## Live hazards / do not repeat

- **A stale discovery record is worse than none.** The oracle harness once published into the real
  `~/.x4forge` and exited, advertising a dead port. Every test harness now sets
  `X4FORGE_DISCOVERY_DIR`; keep it that way for any new harness that boots a server.
- **Never generate nested escapes (`\r\n`, XML) through a Python heredoc into JS** — collapsed to real
  newlines twice today. Use `String.fromCharCode` / array `.join()`, or edit the file directly.
- Test fixtures must be owned by the assertion that needs them; borrowing another section's fixture
  produced an ordering-dependent failure.
- Do not run `graphify update .` (B77). The **post-commit hook already runs graphify automatically** —
  that is why the tracked evidence PNGs keep changing with nobody admitting to it. Those two PNGs stay
  unstaged.
- The installed sidecar always lags the repo; validating a repo fix against the installed extension
  reproduces the OLD bug. Install first, then reload the window.

## Eyeball queue (Ken, ~60 seconds)

1. **Agent API → History**: rows now NAME errors (`Validated 1 file — 4 errors: Extension has no
   content.xml… (+3 more)`), expand shows readable `ERR file:line — message [code]`, and node chips
   focus the canvas.
2. **Compile/Deploy wizard**: DEPLOY FORMAT toggle, Loose selected.

## Open, in priority order

1. **B81 — `/api/fs/read` resolves the deployment, not the workspace.** The resident agent's #1; it
   bypasses the API with Python on every edit, so its reads are invisible to the ledger. Needs
   `root=workspace|deployment` + **error when the requested root lacks the file**, not silent fallthrough.
2. **B88** validate-on-write (`strict:true`) · **B89** Lua gate (wire + extend; six modules already
   exist) · **B90** edit-path byte fidelity → **gates B91** per-node editing · **B92** transactional
   multi-edit.
3. **B85** four deploy-format decisions · **B87** QOL/redundancy pass (start with the self-declared
   deprecated `/api/agent/deploy`).

## Commit point

`release: 0.0.43 — the user-friction pass, 10/10 items`
