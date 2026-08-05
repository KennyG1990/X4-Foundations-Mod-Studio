# Installed Studio multi-panel sidecar rebind

Status: `VERIFIED`

Task: Restore the installed Antigravity Forge's schema/validator connectivity and prevent retained duplicate Studio tabs from remaining bound to a dead sidecar.

Lane: FULL

## PLAN

- Bounded unit: make every tracked `x4forge.studio` panel bind to the current backend identity after extension-host restore/restart, while keeping one extension-managed backend and deterministic active-panel behavior.
- Assumptions: the installed 0.0.63 backend, schema loader, corpus, and validator remain authoritative; no game/mod path or schema configuration change is required.
- In scope: extension panel tracking/binding, owned-backend liveness, focused pure selftests, package/install proof, and a fresh API-dependent Directory Settings read in Antigravity.
- Out of scope: schema parsing/routing changes, mod or game-directory writes, public marketplace publication, and the paused W3 receipt work.
- Risks and authorization boundaries: a bad rebind can reload or misroute a retained webview; an over-eager liveness check can kill a healthy sidecar. The repair must not close panels, mutate a mod/game directory, change standing Forge paths, or weaken external-backend identity checks. Local candidate installation is reversible by reinstalling public 0.0.63.
- Rollback/checkpoint: HEAD `c6e52f9`; reinstall public 0.0.63, SHA-256 `50032222BC22190D25D3314837E52E4370C4059F053D1D9BB6EA087DE4DA52E5`, to restore the prior installed host.
- Acceptance criteria:
  1. Two or more tracked panels each reload exactly once when backend port or token changes.
  2. An unchanged backend identity reloads none of them.
  3. Disposing one panel removes only that panel and does not prevent the others from rebinding.
  4. A shared backend ensure still starts once and performs readiness binding for every joining caller.
  5. A running owned backend receives bounded lightweight authenticated liveness retries before it can be discarded; a genuinely dead backend is still rejected.
  6. External attach retains the full positive X4 Forge schema-identity check.
  7. The installed Antigravity status bar and every retained Studio badge report the same live port.
  8. Installed Directory Settings makes a fresh successful request and visibly reports corpus/schema readiness with no `Failed to fetch`.
- Required validation: focused liveness and panel-binding selftests; extension typecheck/build/stage/probe/package inspection; relevant root typecheck/lint/build/Graphify/precommit gates; installed Antigravity port/readback proof. Negative paths: unchanged identity, disposed-panel non-rebind, transient liveness failure, dead child, arbitrary external HTTP, and no backend churn while activating every retained panel.
- Evidence: this record, `vscode-extension/evidence/2026-08-04-multipanel-rebind-installed-validation.md`, the installed X4 Forge output log, and the inspected candidate VSIX.

## BASELINE

- Revision: `c6e52f9`; the unrelated dirty worktree was fingerprinted and preserved.
- Source files were initially clean. SHA-256: `extension.ts` `64B39F1F7026799A96B6F785C1FF639C75714CAD977C3F7BAC6261AEE2AC6223`; `panelBinding.ts` `4A65527ACA62EAD893E799299A2DE78309C6424C8D55E8D52D6E7F61FB7C14B2`; `panelBinding.selftest.ts` `5DF19860BA1A718C6E136F5D60E60774BDB84BB5861BB411EAA88D815E453EB5`.
- Existing focused test passed 9/9 but covered only one `PanelBackendBinding` instance.
- [REPRODUCED] The installed backend loaded 402 events, 35 conditions, 807 actions, 1,507 MD elements, 1,408 AI elements, and 2,333 properties from the configured unpacked 9.00 corpus. The schemas were present.
- [REPRODUCED] A retained panel badge reported a dead sidecar port while the extension status bar reported a different healthy port; fresh UI requests returned `Failed to fetch`.
- [REPRODUCED] Antigravity held four retained `X4 Forge Studio` tabs. `extension.ts` owned one global panel and one global binding identity, so restored siblings could remain stale.

## RECONCILE

- Existing infrastructure reused: `PanelBackendBinding`, `SharedBackendEnsure`, the managed sidecar, panel serializer, authenticated backend headers, external schema-identity probe, and packaged/installed validation pipeline.
- Couplings checked: serializer restore order, shared ensure callbacks, active panel reveal, panel disposal, backend port/token identity, process exit state, liveness timeout behavior, and the Studio message bridge.
- [REPRODUCED] The first per-panel candidate exposed a second defect in the installed host. Activating retained panels rotated healthy sidecars through ports `64910`, `49421`, and `64426`. `ensureBackendOnce()` was using a two-second download of the 3,408,534-byte `/api/agent/schema` response as the owned-sidecar liveness check. Under multi-panel startup load it timed out, killed the still-running child, and caused temporary blank panels.
- Plan change: add a small authenticated owned-sidecar liveness contract with one retry while retaining the full schema-identity response for unknown external attach. This non-clean change was required for the original installed acceptance criteria.
- Capability-map delta: no capability-map delta; this hardens the existing installed-extension sidecar/webview capability rather than adding a product surface.

## IMPLEMENT

- Native Luna replaced the global one-panel identity with keyed tracked-panel state. Each panel owns its renderer and bound backend identity; active-key selection and disposal preserve a deterministic canonical panel without deleting siblings.
- Every tracked panel is rebound when a backend port or session token changes. Rebinding the same identity is a no-op.
- `extension.ts` now tracks all Studio panels, reacts to view-state changes, and binds every tracked iframe after the shared backend becomes ready.
- Native Luna added `backendLiveness.ts`. A running owned sidecar is checked with authenticated `HEAD /api/ai/keys/status`, two 1,500 ms attempts, and a 250 ms retry delay. A single transient failure does not churn the process; repeated failure or an exited child still enters the existing recovery path.
- Unknown/external attach still downloads `/api/agent/schema` and requires the existing positive X4 Forge API identity.
- Root `package.json` exposes the focused liveness selftest.

## VALIDATE

- `npm run test:extension-backend-liveness` -> PASS, 6/6. Covered healthy reuse, transient retry without churn, genuinely unresponsive rejection, exited-child rejection without HTTP, valid external identity, and arbitrary-service refusal.
- `npm run test:extension-panel-binding` -> PASS, 14/14. Covered multi-panel first bind, unchanged identity, port/token replacement, single-panel disposal, joined startup, failure non-binding, and retry.
- `npm --prefix vscode-extension run build` -> PASS from a fresh `out/`.
- `npm run typecheck` -> PASS.
- `npm run lint` -> PASS with 0 errors / 592 existing warnings.
- `npm run build` -> PASS; production client and bundled server were rebuilt.
- `graphify update .` -> PASS; 5,068 nodes, 12,459 edges, 185 communities. HTML visualization was intentionally skipped by Graphify's 5,000-node limit; graph JSON/report were refreshed.
- `npm --prefix vscode-extension run stage-app` -> PASS: five bundled files, 169 packages, native binding present, no secrets.
- `npm --prefix vscode-extension run probe-app` -> PASS, 16/16, including configured `md.xsd`, `common.xsd`, `aiscripts.xsd`, manual schema path, and canonical corpus completion.
- Candidate inspection -> PASS: 2,091 entries, 61,223,046 unpacked bytes, 18,052,475 archive bytes, SHA-256 `9295CFD8CF3CEE798C3DD261F9E312EC20F4AFC7FC12C709A05E50A8D2789D01`.
- First install attempt -> FAILED SAFELY. Antigravity held the installed extension directory open; the installer exhausted bounded retries and required a full IDE restart. No partial replacement occurred.
- Antigravity was closed gracefully, the sidecar listener stopped, and the candidate installed successfully while the IDE was down.
- Installed-byte parity -> PASS for `extension.js`, `sidecar-supervisor.js`, `server.cjs`, and `x4forge-mcp.cjs`; exact hashes are in the evidence artifact.
- Installed log: `C:\Users\Moshi\AppData\Roaming\Antigravity IDE\logs\20260804T193639\window1\exthost\output_logging_20260804T193647\2-X4 Forge.log`.
- Installed multi-panel negative proof -> PASS. The fresh extension host recorded exactly one sidecar spawn, one ready event, four Studio panel binds, zero `existing backend ... no longer answers` events, and only port `51199`.
- Installed UI proof -> PASS. Each of the four retained Forge tabs visibly rendered 1,507 MD elements, 1,408 AI elements, 2,333 properties, and `managed sidecar on port 51199`; none showed `Failed to fetch`.
- Fresh Directory Settings proof -> PASS. The installed UI visibly read the mod workspace, filesystem folder, X4 installation, unpacked 9.00 corpus, and `Corpus root found`; no path was changed and no fetch error appeared.
- Direct installed schema read -> PASS: `GET http://127.0.0.1:51199/api/agent/schema` returned HTTP 200, JSON, 3,408,534 bytes.
- Negative/rollback result: unchanged identity and disposed-panel behavior pass focused tests; transient owned liveness does not churn; dead/unknown services fail closed; public 0.0.63 rollback artifact remains intact.
- Exact-scope isolated precommit -> PASS: `npm run precommit:check` exited 0 in 591 seconds against the repair files plus the reviewed writer-manifest delta. It passed 26/26 verdict selftests, product-copy, durable writers (14/14 audit selftests; 34 filesystem, 11 host-store, 2 browser-output, 47 SQLite mutation, 7 transaction, 14 run, 14 exec, and 2 pragma owners; extension writer 8/8), 11-capability/293-route/10-MCP contracts, 82-route/48-surface receipt coverage, typecheck, size, mirror, and tripwire gates.

## REVIEW

- Requirement 1 -> done and evidenced by multi-panel bind/replacement tests.
- Requirement 2 -> done and evidenced by unchanged-identity tests and stable installed port.
- Requirement 3 -> done and evidenced by untrack/disposal tests.
- Requirement 4 -> done and evidenced by joined-startup/readiness tests.
- Requirement 5 -> done and evidenced by 6/6 liveness tests plus four installed panel activations without churn.
- Requirement 6 -> done and evidenced by positive/negative external identity tests.
- Requirement 7 -> done and evidenced in all four retained installed tabs and the extension status bar on `51199`.
- Requirement 8 -> done and evidenced by the fresh installed Directory Settings render and direct 200 schema response.
- Fresh-eyes finding: the initial per-panel implementation was insufficient because it retained a heavyweight schema download as liveness. The targeted liveness correction preserved recovery while removing that startup-load failure mechanism.
- Deliberately unchanged: schema parsing, schema paths, mod/game data, public extension version, marketplace state, W3 receipts, and user canvas contents.

## CLOSE

- Status: `VERIFIED`.
- Remaining risk: the UI message response helper still targets the current canonical active panel by design; this task did not add a panel-addressed response protocol because no incorrect response routing was reproduced.
- Suggested commit title: `fix(extension): keep restored Forge tabs on one sidecar`.

## AAR

- Triggers: the previous single-panel repair omitted restored siblings; the first candidate exposed heavyweight liveness churn; the first install attempt hit an IDE file lock; one coordinator build/typecheck pair was mistakenly started concurrently and typecheck briefly observed a deleted `out/`; Computer Use detected one concurrent window resize and required a fresh state capture; the first main-checkout precommit was correctly red on unrelated in-progress W3 writer files, so the exact repair scope was reconstructed and passed in an isolated worktree instead of weakening the gate.
- Sustain: retained the user's duplicate tabs as the real regression fixture, separated owned liveness from external identity, preserved the public rollback VSIX, installed only while Antigravity was down, and required all four real tabs plus logs to agree.
- Improve work/approach: installed multi-panel startup should be part of the first acceptance contract for serializer/backend changes, and build steps sharing generated output must run sequentially.
- Improve tools: the extension installer should detect a live IDE lock before copy retries and state the restart requirement immediately; installed validation should persist screenshot receipts automatically.
- Highest-risk evidenced weakness: an expensive semantic endpoint was serving as process liveness. Under concurrent restored-panel load that converted healthy slowness into destructive backend churn. The bounded lightweight authenticated check removes that mechanism while preserving true-hang recovery.
- Lessons banked: project records only; no new external runtime, provider, CLI, or product boundary was introduced.
