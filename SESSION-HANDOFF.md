# X4 Forge — Session Handoff

Updated: 2026-08-01 02:15 America/New_York — B115 W1 / Kimi R13 installed gate attempt 1

## One-line state

Exact B115-W1/R13 bytes are packaged, inspected, installed and visibly render the capability contract, but the
required Agent Bridge Close interaction reproduced a 173–228 second Antigravity renderer stall in two windows. The
gate closes `FAILED`; B115 W1 and R13 remain `PARTIAL`. Commit/push this evidence-only checkpoint, then run a bounded
installed-host profile + 1,424-node fixture task before changing cancellation or resuming B115 W2.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` — Forge application and Antigravity extension, not the live X4 mod.
- Revision entering the gate: `HEAD == origin/main == 37f07192099f844647cb3cf8ba423656159feab8`.
- Installed product: local same-version `x4forge.x4-forge-studio@0.0.63`, built from `37f0719`. Artifact:
  `vscode-extension/x4-forge-studio-0.0.63-b115-r13.vsix`, SHA-256
  `20C938156CA36039E600251E730F5DCEC5E02D064B54789566E5E3EA335DB00D`.
- Antigravity state restored: only Ken's original window remains, Agent Bridge is closed, Beginner mode is selected,
  renderer is responsive, and its managed sidecar remains on port 59743. The temporary no-folder window and port
  55737 are gone. The disposable isolated profile under Local Temp was exactly resolved, found unused, and deleted;
  it contained no user data and is not recoverable.
- X4 was observed running during final cleanup but was never controlled or written. Expert mode was used temporarily
  for the Agent API proof and restored to Beginner; no setting remains changed. No game/mod/workspace content,
  credential, public release or external service was mutated. No computer-control session is retained.
- Commit target: `test(extension): record failed installed capability gate`. Run precommit first, stage only the exact
  task records/screenshots, push `main`, then assert `origin/main == HEAD == ls-remote`. Final
  `npm run precommit:check` passed in 148.5 seconds.
- Eyeball queue: none for Ken from this failed gate. The next proof is agent-owned profiling/fixture work; do not ask
  Ken to repeat a multi-minute freeze until instrumentation is ready.

## What passed

- Root production build, extension build and fresh allowlisted staging.
- VSIX inspector selftest 13/13; final artifact inspection: 2,091 entries, 17,942,625 archive bytes, 60,557,268
  unpacked bytes.
- Staged sidecar probe 16/16 on the successful retry; ports 8982/8983 were clear afterward.
- Antigravity install after a full-host exit released the first attempt's locked-directory `EPERM`.
- Exact archive-to-installed hashes for controller, supervisor, MCP, server and UI asset. Installed `package.json`
  differs only by Antigravity's `__metadata`; normalized JSON hash is
  `7E47118C853E1756BC95738FBB10A30B29A4AB5ACAB64673B913F256FD62455D`.
- Real rendered `Sync: Checking` to `Connected`, eleven capabilities, `forge.capability.v1`, contract hash prefix
  `37357c1e6b11`, LIVE CONTRACT, honest optional-runtime state and current Live State.
- Explicit authority/client isolation: both real windows addressed workspace `ws_f61166c42849c757cf219c37`, while
  client IDs differed (`client_022a...` versus `client_3564...`) and sidecar ports differed (59743 versus 55737).

## What failed

- Original window: two observed `CodeWindow` stalls lasted 221.467 and 227.522 seconds.
- Second no-folder window: rendered Bridge Close at 02:08:56 reproduced the same dialog and recovered at 02:11:49,
  about 173 seconds later. Evidence:
  `vscode-extension/evidence/2026-08-01-b115-r13-installed/installed-bridge-close-unresponsive-small-window.png`.
- Host log: `C:\Users\Moshi\AppData\Roaming\Antigravity IDE\logs\20260801T014026\main.log`.
- Source/log audit: closing Bridge disables its scheduler subscription but leaves the component mounted; cleanup is
  one subscriber deletion, while App remains subscribed. A 10,000-cycle exact-path benchmark measured 0.0003 ms
  median / 0.0017 ms p99 / 0.0502 ms max. In the first two stalls, 88/91 host samples stopped in Antigravity's
  local-extension-host `MessagePort.onmessage`, not a Forge frame. No Forge Bridge-close host message exists.
- Adjacent measured pressure: active workspace response is 6.04 MB / 1,424 nodes / 1,420 links and is fetched/parses
  every three seconds even when unchanged. Parse median is about 16.5 ms. It is a real performance defect/amplifier,
  not yet the proven multi-minute cause.

## Exact checkpoint file ownership

Stage only:

- the B115 hunk and R13 hunk in `BACKLOG.md` (exclude B111-B114);
- `SESSION-HANDOFF.md`;
- `docs/plans/2026-07-29-kimi-recommendations-ledger.md`;
- `docs/plans/2026-07-31-capability-convergence.md`;
- `docs/plans/2026-07-31-continuous-polling-scheduler.md`;
- `docs/plans/2026-08-01-b115-r13-installed-gate.md`;
- all six PNGs in `vscode-extension/evidence/2026-08-01-b115-r13-installed/`.

Preserve and do not stage unrelated user state:

- B111-B114 hunks in `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`.
- Deleted `data/known_fixes.json`, `data/trivia_questions.json`, `docs/DISCORD_BOTS_AND_GAMES.md` and deleted root
  Discord/game scripts.
- Modified `vscode-extension/evidence/0.0.35-runtime-copy-*.png`.
- Untracked `Note for Kimi.md`, `.github/ISSUE_TEMPLATE/*.md`, and the six prior R8/R17 evidence PNGs.

## Next bounded unit

1. Commit/push this failed gate without product-source changes or public publishing.
2. Create B116 as a Full-lane evidence-first remediation: capture an installed-host CPU profile on the same Close;
   add a deterministic 1,424-node close/rerender fixture; instrument close, subscriber count, workspace payload and
   rerender timings without weakening current tests.
3. Decide the mutation from that evidence. Do not rewrite scheduler cancellation on current evidence. Independently
   specify conditional/head-only workspace polling so unchanged polls transfer no 6.04 MB snapshot and one changed
   head causes exactly one full fetch.
4. Rebuild/package/install exact bytes and repeat the real rendered Close/remount gate. Only then may R13 and B115 W1
   become `VERIFIED`; W2 remains held until that result.

## AAR outcome

- Non-clean Full-lane close: staged probe, install, package metadata interpretation, isolated-profile onboarding,
  UI interaction and cleanup each required correction or retry.
- Sustain: exact-byte attribution, two-renderer A/B, Keep Waiting instead of destructive recovery, and separate PID/
  process ownership before causal claims.
- Improve work/approach: capture CPU profile at first reproduction and exercise the exact rendered click; an
  accessibility-only state change is not sufficient when the defect is interaction-specific.
- Improve tools: add Forge timing/payload instrumentation and a deterministic large-workspace fixture. Antigravity's
  minified unresponsive sample does not identify the owning extension/RPC payload.
- Highest-risk evidenced weakness: unchanged 6.04 MB full-workspace polling creates continuous renderer allocation
  pressure. Prove conditional transfer separately; do not claim it explains the four-minute stall without profile
  evidence.
- External StarForge capability/AAR ledgers were not mutated in this repository-only checkpoint.
