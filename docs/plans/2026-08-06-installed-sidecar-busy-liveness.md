# Installed sidecar busy-liveness safety

Status: `VERIFIED`

Task: Prevent a healthy extension-owned Forge sidecar from being killed and replaced while deterministic validation blocks its HTTP event loop.

Lane: FULL

Canonical owner: GitHub #19

## PLAN

- **Bounded unit:** harden the existing owned-sidecar liveness decision so process existence remains authoritative while the managed child is running; temporary HTTP unresponsiveness may be reported as busy but must not authorize destructive replacement.
- **Authoritative references:** the installed 0.0.63 runtime log, `vscode-extension/src/backendLiveness.ts`, `vscode-extension/src/extension.ts`, the prior installed multi-panel repair record, and GitHub #19.
- **In scope:** owned-sidecar liveness classification, the `ensureBackend` reuse decision, focused deterministic selftests, extension build/package/install parity, and installed Antigravity readback while validation is busy.
- **Out of scope:** agent-route permissions, schema parsing or paths, validator verdicts, game/mod writes, external-backend trust, standalone/CLI surfaces, marketplace publication, and W3 receipt semantics.
- **Risks and authorization boundaries:** retaining a genuinely hung process can delay recovery; killing a healthy busy process can interrupt validation or a mutation and leaves every bound panel on a dead port. The safer boundary is fail-stable: an owned child that still exists is retained, an exited child is rejected, and explicit stop/restart plus the existing exit watchdog remain recovery owners. No game/mod/config write is authorized.
- **Rollback/checkpoint:** source and remote are `26b296934f40383515c6005953c3a53afd57787f`; reinstall the current installed 0.0.63 package or restore the exact task-owned source diff. Preserve all unrelated dirty files.
- **Acceptance criteria:**
  1. A running owned child remains reusable after every bounded HTTP probe times out; no stop, new port, or panel rebind is authorized by that timeout alone.
  2. A responsive owned child remains reusable and records whether a retry was needed.
  3. An exited owned child is rejected without an HTTP probe and continues through the existing recovery path.
  4. Unknown/external attach still requires the full positive X4 Forge schema identity and rejects arbitrary HTTP services.
  5. Installed Antigravity can run a validation longer than the liveness probe budget while opening/rebinding Studio without `existing backend ... discarding handle`, a sidecar port change, or `Failed to fetch` after the operation completes.
- **Required validation:** focused backend-liveness selftest, extension typecheck/build, root typecheck/lint/build, Graphify refresh, precommit, package stage/probe/inspection, installed-byte parity, live installed log/readback, and a rendered Directory Settings check. Negative paths: all probes time out while child remains running; child exited; arbitrary external HTTP; unchanged backend identity.
- **Evidence locations:** this record, the focused command output, packaged-candidate inspection, installed X4 Forge output log, and a new installed-validation artifact under `vscode-extension/evidence/2026-08-06-busy-liveness/`.

## BASELINE

- **Revision:** `HEAD == origin/main == 26b296934f40383515c6005953c3a53afd57787f` before task mutation. The task-owned source files are clean; unrelated dirty and untracked files are preserved.
- **[REPRODUCED]:** installed Antigravity log `20260806T112324/.../1-X4 Forge.log` loaded `402` events, `35` conditions, and `807` actions from the configured unpacked 9.00 corpus. The schema path is valid and the schema library is loaded.
- **[REPRODUCED]:** at `15:24:05` a roughly ten-second continuous validation completed while owned liveness required a retry; at `15:24:10` two `1,500 ms` probes plus the `250 ms` gap classified the still-running child dead, logged `existing backend ... discarding handle`, stopped it, and moved Studio from port `52975` to `56703`.
- **Observed consequence:** requests during that forced replacement can surface as `Failed to fetch`, even though schema loading itself is healthy. No current installed 403 was found; the old 77 cross-file defect is separately fixed in `5541f79` and is not part of this patch.

## RECONCILE

- Reuse `checkOwnedBackendLiveness`, `SharedBackendEnsure`, process exit handling, panel rebinding, and the external schema-identity probe. Do not add another watchdog or health service.
- The current assumption that repeated HTTP timeout proves a running owned child is dead is falsified by the installed log. Process exit is the existing unambiguous owned-child death signal.
- Capability-map delta: no capability-map delta; this corrects failure behavior in the existing installed-extension sidecar lifecycle.
- Plan changes: this bounded user-visible reliability repair ran with a disjoint write set from the paused W3 snapshot-source work. Precommit exposed a measured prerequisite-audit timeout with no execution headroom, so the task also raised only that nested timeout from five to ten minutes without changing its buffer or failure taxonomy. The first full-E2E observer was then found to be shorter than the measured 23.2-minute suite; the unchanged suite was rerun under a longer outer observer budget.

## IMPLEMENT

- `checkOwnedBackendLiveness` now distinguishes `responsive`, `child-not-running`, and `running-but-busy`. Bounded HTTP probes remain observability, while the managed child process state is authoritative for reuse.
- The extension supplies a fresh child-state callback at the final decision boundary. A still-running child is retained after both probes time out; a child that exited before or during probing is rejected through the existing recovery path.
- `ensureBackend` records whether the owned sidecar recovered on retry or remained busy, and retains the same handle in both cases. External attach continues through the unchanged full schema-identity probe.
- Focused selftests now cover first-response success, retry recovery, all-timeout busy retention, exit during probes, initially exited child with zero probes, valid external Forge identity, and arbitrary HTTP rejection.
- `scripts/action-receipt-coverage-audit.ts` gives the measured 295.8-second nested capability prerequisite a 600-second outer budget. Its 4 MiB buffer and timeout/start/nonzero result taxonomy are unchanged.

## VALIDATE

- **Focused/static:** backend-liveness selftest `7/7`; extension build exit `0`; root typecheck/build exit `0`; focused ESLint exit `0`; scoped diff check exit `0`.
- **Graph:** `graphify update .` completed at `5,634` nodes / `13,781` edges / `208` communities. The graph included the separate untracked W3 snapshot-source candidate; that candidate is not part of this checkpoint.
- **Package:** stage-app exit `0`; staged package probe `16/16`; inspector PASS `2,091` entries / `61,322,674` unpacked bytes. Candidate `vscode-extension/x4-forge-studio-0.0.63-busy-liveness-20260806.vsix` is `18,076,535` bytes with SHA256 `841A63185547E2FBB946815EF87AF663A7367B6DC3FB091F66307B6409F9F1A3`.
- **Installed parity:** forced local installation and Antigravity reload succeeded at `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.63`; installed `extension.js`, `sidecar-supervisor.js`, and `server.cjs` lengths and hashes match the staged candidate.
- **Installed runtime:** Antigravity `1.107.0` rendered Forge `v1.0.426`. The managed sidecar remained on port `63755`: at `17:04:39.102Z` it was retained as busy after two bounded probes, validation completed at `17:04:49.828Z` with `23` findings across `18` files, and at `17:04:55.145Z` it answered retry two and was retained. Fresh-log counts for `discarding handle`, `no longer answers`, `Failed to fetch`, `auto-restart`, and unexpected sidecar exit were all zero.
- **Installed rendered evidence:** `vscode-extension/evidence/2026-08-06-busy-liveness/installed-antigravity-busy-retained-recovered.png` visibly shows same-port retention/recovery; `installed-antigravity-schema-corpus-loaded.png` visibly shows the unpacked 9.00 corpus found, `1,020,384` discovered items, read-only discovery/canonical-ID availability, and no fetch error. The live log separately records `402` events, `35` conditions, `807` actions, `32` factions, `1,902` wares, and `170` sectors loaded.
- **Precommit:** the first run failed only because the nested action-receipt capability prerequisite exhausted its old 300-second wrapper after the same audit measured 295.8 seconds standalone. After the bounded timeout repair, focused action-receipt coverage passed with `82` routes / `50` surfaces, and final `npm run precommit:check` exited `0` with `[precommit] OK`.
- **Full E2E:** the first attempt was externally killed at 20 minutes while trace artifacts were still advancing and therefore supplied no current verdict; its exact ephemeral listeners were stopped and verified gone. The unchanged rerun completed in `1,396.3s`: `96/96` passed, failed `0`, flaky `0`, bad results `0`. Fresh receipt `test-results/e2e-verdict.json`, generated `2026-08-06T18:34:23Z`, records complete structured report/lifecycle, `trigger=child-close`, `treeGone=true`, empty `remainingPids`, and no runner interaction failure. Independent readback found no listeners on `3100/3101`. Both `X4_STATE_DIR` and `X4_CONFIG_DIR` were bound to `C:\Users\Moshi\AppData\Local\Temp\x4forge-e2e-state-44580`, outside the live Forge state.
- **Negative paths:** a still-running child after all bounded timeouts is retained; a child that exits during probing is rejected; an already-exited child is rejected before probing; arbitrary external HTTP remains rejected. All are deterministic focused-test assertions.

## REVIEW

- **Running owned child survives HTTP starvation:** done and evidenced in focused selftest plus installed same-port log/readback.
- **Responsive and retry-responsive child remains reusable:** done and evidenced in focused selftest and installed recovery log.
- **Exited child follows recovery:** done and evidenced for initially exited and exits-during-probe cases.
- **External trust boundary unchanged:** done; valid Forge identity passes and arbitrary HTTP fails.
- **Installed experience recovers without fetch failure:** done; packaged bytes were installed, the rendered Studio and settings views were inspected, the same port remained bound, and the fresh log contains none of the destructive/fetch-error markers.
- **Fresh-eyes finding:** retaining a still-running but permanently hung child deliberately favors fail-stable state over destructive replacement. Explicit Stop Backend/restart and existing child-exit handling remain recovery owners; this bounded patch adds no competing watchdog.
- **Scope review:** no schema path, validator verdict, agent route, game/mod data, external attach, marketplace, W3 receipt, or standalone/CLI behavior changed. No capability-map delta.

## CLOSE

- Status: `VERIFIED` for this bounded installed-extension sidecar lifecycle repair.
- The user-visible `Failed to fetch` reproduction was lifecycle churn, not missing XSD files: schema and corpus loading remained healthy throughout.
- W3 remains `PARTIAL` at `3/5`; W10 remains `OPEN / PARTIAL`; the overall extension-native capability program remains `IN_PROGRESS / PARTIAL`. No version bump, marketplace publication, mod/game write, deploy, or overall-program completion is claimed.
- Commit point: `fix(extension): retain busy managed sidecar`.

## AAR

- **Triggers:** reproduced installed-runtime contradiction; initial build/typecheck concurrency caused a transient missing-output `TS6053` and passed when rerun sequentially; two accidental repo-root `-` artifacts from a no-write esbuild command were removed and independently verified absent; first same-version CLI installation waited on a busy sidecar and succeeded after explicit UI stop/retry; the old 300-second prerequisite wrapper timed out; the first 20-minute full-E2E observer killed an advancing run and leaked only its ephemeral stack; one read-only PowerShell PID inspection had a parser error before correction.
- **Sustain:** preserve process ownership, bounded HTTP evidence, package bytes, installed parity, rendered UI, fresh logs, and terminal E2E containment as separate proof layers. Keep unrelated dirty files and the disjoint W3 candidate outside this checkpoint.
- **Improve work/approach:** validation commands that share generated output must run sequentially; measured long-running gates need observer budgets above their observed runtime; stale receipts must be rejected by timestamp before any green claim.
- **Improve tools:** no-write build probes must be checked for unintended artifacts; same-version installed-host replacement should stop the owned sidecar before invoking the installer; outer observers should either outlive E2E or own cleanup when they terminate it.
- **Highest-risk evidenced weakness:** synchronous deterministic validation can starve the sidecar HTTP loop long enough to look dead. A destructive decision must use owned-process truth, not repeated HTTP timeout alone.
