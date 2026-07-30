# Kimi K3 Recommendations — Reconciled Execution Ledger

**Goal:** keep the original R1-R21 set durably separated into implemented, partial, and remaining work, and
make each future implementation a bounded workflow task rather than an untracked cleanup sweep.

**Baseline:** clean `main == origin/main == 72ec4aa77d2d99a79b308101c7d34b58b5966de2` on 2026-07-29.

## Status vocabulary

- `VERIFIED`: the recommendation's substance exists and has current cited proof.
- `PARTIAL`: useful infrastructure exists, but the recommendation's acceptance is not fully met.
- `OPEN`: no adequate product capability exists.
- `REJECTED`: reconciliation proves the literal recommendation is inferior to an existing equivalent.

## Reconciled matrix

| ID | Current status | Observed current state | Remaining bounded unit |
| --- | --- | --- | --- |
| R1 Zero-warning culture | OPEN | No mod-local suppression manifest or review-date policy exists. | Define versioned `forge.rules.json` schema, expiry/review behavior, and zero-cry-wolf tests. |
| R2 Validation delta | OPEN | No persisted last-green validation baseline or new/resolved-warning delta exists. Agent history records runs but is not a comparison baseline. | Content-addressed last-green summaries per mod and deploy checklist delta. |
| R3 One-line machine verdict | VERIFIED (B110-R3) | `src/lib/apiFailureEnvelope.ts` and one pre-auth Express middleware now give every recognized JSON failure top-level `success:false`, stable `code`, non-empty `error`, and `failedStages`, including legacy HTTP-200 operational failures. Existing B109 `BLOCKED`/`PARTIAL` semantics and success object/array shapes are preserved; `/api/agent/schema` v3 documents the contract. | Preserve the 12/12 oracle and isolated route compatibility coverage. Evidence: `docs/plans/2026-07-30-uniform-api-failure-envelope.md`. |
| R4 Parse Lua registrations | VERIFIED (B108) | Cross-file registration discovery uses the existing Lua AST engine and has comment/alias negatives. | Preserve regression coverage only. |
| R5 Wire contract | VERIFIED (B108) | Indexed Lua payload writes and MD reads, verb/global collisions, and missing readers/writers are enforced in project validation. | Preserve real-mod contract fixtures. |
| R6 Self-explaining diagnostics | PARTIAL | Rule ids and `/api/agent/explain` exist; inline why-links and one-click mod-local suppression do not. | Build after R1 schema; route links through DiagnosticsCenter and guarded source write. |
| R7 One transaction discipline | PARTIAL | Deploy replacement and guarded workspace writes are transactional/atomic. B109 removed the release ZIP's direct write and uses atomic file or verified sibling-directory replacement; a wider writer inventory is still required. | Inventory every remaining durable writer and close exceptions by category. |
| R8 Request-addressed workspace identity | PARTIAL | B108 made deploy identity explicit; B109 requires an explicit workspace for both platform release prepare routes. Many other mutating routes still accept/fall back to the active singleton and clients/tokens are not workspace-scoped. | Route/caller matrix and response echo for remaining mutations; full client scoping belongs with R17. |
| R9 Timeout policy | VERIFIED (B110-R9) | The existing browser fetch chokepoint now gives every same-origin API request a finite composed deadline, with a larger budget for known long work. Node header/body/keep-alive and Express response lifetimes are bounded. Both dev command routes terminate; async jobs validate/cap `timeoutMs`, retain running-job receipts, tree-kill on Windows, and expose `timed_out` machine truth. | Preserve the 14/14 policy oracle, 504 drill, and real sleeping-job termination checks. Evidence: `docs/plans/2026-07-30-timeout-policy.md`. |
| R10 Sidecar liveness | PARTIAL | The extension restarts a child that dies while the host lives and removes discovery on clean shutdown. A host crash can still orphan the sidecar; no parent-death watchdog exists. | Parent PID contract and orphan-reap proof without killing an unrelated reused PID. |
| R11 Conflict dialog v2 | OPEN | Current card still says `ADOPT SERVER` / `KEEP MINE`; decision data is limited to tooltips and no diff preview. | Timestamps, changed-file counts, explicit outcomes, text diff, destructive-choice tests. |
| R12 Honest settings | VERIFIED (B108/B109) | Inert auto-sync settings were removed; the normalized Studio inventory repairs invalid settings and every current layout control has a live consumer. B109's Settings-only Express preference has normalization/selftests, changes the Release Center presentation, states every retained gate, and is visibly installed. | Preserve regression and installed-host coverage. |
| R13 One poller/SSE | OPEN | Independent polling remains in App readiness/workspace, AgentBridge, Canvas, CueViewer, GuidedRail, Playtest, and device-flow logic. | Classify continuous subscriptions versus bounded workflows; build one scheduler for continuous reads, leave OAuth workflow polling isolated. |
| R14 Undo destructive ops | PARTIAL | B86 can revert guarded file writes through the ledger. Import, adopt-server-state, and deploy are deliberately non-revertible; deploy has rollback only during the transaction. | Define recoverable snapshots and CAS semantics per destructive action; do not pretend rollback equals later undo. |
| R15 Ambient readiness | VERIFIED BY EQUIVALENT (B36) | A persistent five-stage readiness ladder is always below the header, shows status/evidence, and routes clicks to owning surfaces. It is richer than a single chip. | No new chip; preserve the ladder and add release evidence through B109. |
| R16 User-extensible validation | OPEN | No `forge.rules.json`, declared wire-key, known-chain, or expected-register contract exists. | Same schema foundation as R1, then deterministic merge/provenance and invalid-rule failures. |
| R17 True multi-workspace | PARTIAL | Named parked workspaces round-trip, but active authority is a shared singleton and is not client/token scoped. | Architecture/ADR task: workspace binding per session/key plus safe shared read surfaces. |
| R18 Headless CLI | PARTIAL | `npm run validate:mod -- <path>` exists and runs the shared validator. There is no installed `forge` binary or CLI deploy-verify workflow. | Package a supported CLI entrypoint; add API discovery/auth and dry-run/deploy verification with explicit side effects. |
| R19 CI | PARTIAL | Windows Quality now runs clean installs, audit, typecheck, lint, oracles, production build, and isolated route integration. It does not package/probe a VSIX. | Add extension build/stage/package and packaged-sidecar probe without publishing. |
| R20 Flake budget | PARTIAL | Route stability was proven 10/10 during B108 and CI gates one run. No documented quarantine threshold, owner, or expiry policy exists. | Write/enforce policy and produce a deliberately flaky fixture proving quarantine cannot hide product failures. |
| R21 MCP fate | OPEN | The safe read/validate/compile MCP shim is bundled and exposed through a copy-config command, while repo `.mcp.json` registers only `claude-brain`. It remains optional but not automatically registered. | Product decision: explicit opt-in registration workflow or remove bundling; do not add filesystem writes without a separate scope/security design. |

## Implementation order

1. **B109 Release Center — VERIFIED / Open VSX 0.0.59:** closed the release-specific R7/R8/R12 work and supplied a
   concrete consumer for R3-style staged errors. Preserve its gates; do not rebuild it during B110.
2. **Safety contract batch:** R3 and R9 are VERIFIED; continue with R10, R19, R20. These improve every subsequent implementation and CI gate.
3. **Validation truth batch:** R1 + R16 schema, then R6 UI, then R2 delta reporting.
4. **Loss-prevention UX:** R11 and R14.
5. **Architecture batch:** R8 remainder + R17, then R13 after workspace/session ownership is stable.
6. **Tooling decisions:** R18 and R21.

R3, R4, R5, R9, R12, and R15 need no duplicate implementation. Their regression evidence remains part of the relevant
full gates. Every row moved to `VERIFIED` must cite its task plan, acceptance results, and ROADMAP close.
