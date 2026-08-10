# Agent Runtime Debugger Access

Task: Promote the installed mod-aware runtime debugger to a canonical, machine-readable Agent API capability and MCP projection.
Lane: FULL
Owner issue: GitHub #14 (existing runtime-debugger owner; no duplicate issue)
Status: IN PROGRESS / PARTIAL

## PLAN

- Bounded unit: reuse the 0.0.68 runtime-debugger adapter and addressed-workspace authority behind one canonical authenticated Agent API operation, then expose a bounded MCP tool over that same operation.
- Assumptions: the current `RuntimeDebuggerAdapter` payload remains the source of truth; the canonical call may advance only its existing bounded derived session/cursor state and must never write the mod, game installation, source log, workspace, or invoke AI.
- Authoritative references: `AGENTS.md`; `F:\StarForge\wiki\x4-forge\decisions.md` ADR-F3 and ADR-F5; `F:\StarForge\wiki\x4-forge\capability-map.md` 2026-08-09 runtime-debugger delta; `docs/plans/2026-08-08-mod-aware-runtime-debugger.md`; the live capability contract and route-disposition authority.
- In scope:
  - a stable dotted capability identity for reading/analyzing runtime-debugger evidence;
  - one canonical addressed Agent API route that returns the existing debugger payload without requiring Studio or computer use;
  - the existing legacy brief route retained as a compatibility alias over the same handler;
  - one discoverable MCP tool returning bounded session, ownership, verdict, coverage, expected-step, incident, source/node navigation, and hidden/unresolved evidence;
  - exact capability, route-authority, MCP, authentication, workspace-binding, schema, redaction, and response-bound tests.
  - a `0.0.69` patch release with comprehensive changelog, Open VSX publication, exact public-archive readback, public artifact installation, Antigravity reload, and installed sidecar Agent API plus MCP proof.
- Out of scope: parser/attribution redesign, UI changes, AI explanation authority, raw whole-log access, arbitrary log paths, new CLI/product/provider, game/mod writes, deploy behavior, current-X4-session experience proof, and sidecar lifecycle cleanup.
- Likely affected resources: `server.ts`; `src/lib/forgeCapabilities.ts`; capability selftests/audits; `config/forge-route-dispositions.json`; `vscode-extension/mcp/x4forge-mcp.cjs`; MCP selftests; focused route/runtime tests; extension version/changelog/package metadata; release and handoff records after validation.
- Risks and authorization boundaries:
  - log evidence can contain user paths or unrelated-mod data, so existing redaction, ownership exclusion, response caps, and no-raw-log boundaries are mandatory;
  - live refresh persists only bounded derived debugger cursor/incident state, so capability effects must declare the existing audit-write and retention-delete behavior rather than falsely claiming a pure read;
  - immutable workspace identity is mandatory; no mod-name inference or active-workspace fallback;
  - Open VSX publication and public-artifact installation are authorized by the user's standing instruction for this debugger feature; no real mod/game/config write is authorized.
- Rollback/checkpoint: HEAD `c454d2c240965e4775b5929f8e54b5e5f5a02880`; remove the new capability/API/MCP projection and restore the reviewed route disposition. Existing unrelated dirty files are excluded from ownership and staging. Marketplace rollback requires a later immutable patch because published versions cannot be replaced.
- Acceptance criteria:
  1. Effective capability discovery exposes exactly one stable runtime-debugger capability with explicit `read`, `analyze`, `audit-write`, and `audit-retention-delete` effects.
  2. An authenticated key bound to workspace A can call the canonical route for A and receives the current `RuntimeDebuggerAdapter` schema, authority, session, verdict, coverage, expected steps, incidents, hidden-other-mod count, ambiguity count, and safe navigation evidence.
  3. Missing authentication, missing/wrong workspace authority, and exact-key capability/effect denial fail closed with the existing deterministic authority envelope.
  4. The compatibility route and canonical route execute one shared handler/adapter path and do not diverge.
  5. MCP discovery exposes one tool bound to the same capability identity; invoking it returns a bounded useful projection without Studio/browser automation.
  6. MCP does not return a whole debug log, unrelated-mod incidents, unredacted user-profile paths, credentials, or unsafe guessed navigation.
  7. No-log, historical-only, unresolved/ambiguous, and capped-evidence states remain explicit and cannot report a false clean/current verdict.
  8. No real mod, game installation, workspace content, or source debug log is modified.
  9. Open VSX serves the exact `0.0.69` artifact; Antigravity installs/reloads that public archive; the running sidecar proves canonical Agent API and MCP access from installed bytes without computer-use scraping.
- Required validation and negative path:
  - focused runtime-adapter selftests remain green;
  - capability-contract audit and MCP capability selftest pass with canonical route/MCP binding and denial fixtures;
  - route integration proves auth, workspace binding, exact-capability/effect denial, compatibility parity, and bounded/redacted response;
  - typecheck, lint, graph refresh, runtime oracle sweep, production build, extension build/package inspection, and `npm run precommit:check` pass;
  - publish-before-commit order is enforced: bump/changelog, build, package, inspect, publish, public hash readback, install/reload, then source commit/push;
  - the installed public extension sidecar responds through canonical Agent API and MCP without computer use; no rendered-UI gate is applicable because no user-visible surface changes.
- Evidence locations: `vscode-extension/evidence/2026-08-09-agent-runtime-debugger-access/`, this plan close, capability-map delta, `ROADMAP.md`, `SESSION-HANDOFF.md`, and GitHub #14.

### Reconciled harness-repair subunit (SPECIFIED 2026-08-09)

- Bounded unit: repair only the isolated Playwright E2E UI-server lifecycle so the Vite owner is a direct
  Playwright global-setup/global-teardown resource, while the existing isolated API `webServer` on 3101 remains
  unchanged. This subunit supports the debugger feature's full-suite gate; it does not change runtime-debugger
  product behavior.
- Observed facts: a fresh full run passed tests 1-81, then Vite on `127.0.0.1:3100` was gone before test 82 and
  tests 82-102 cascaded `ERR_CONNECTION_REFUSED`; the report completed with `treeGone=true` and ports clean. A
  prior clean run lost Vite after test 1, so timing is variable. The installed Playwright runner invokes each
  `webServer.command` through a shell and only observes early startup exit; the existing config's comment claiming
  direct Vite Node ownership is therefore false. A diagnostic stdin probe did not reproduce shutdown.
- Hypothesis: shell-mediated ownership of the Vite command permits the UI server to disappear while Playwright
  continues, causing the refusal cascade. This is an implementation hypothesis until the repaired focused runs
  demonstrate stable lifecycle ownership; resource exhaustion and stdin shutdown are not accepted explanations.
- In scope: `playwright.config.ts`; a Playwright-owned Vite JS-API lifecycle module and global setup/teardown;
  deterministic lifecycle selftest and, only if bounded and fast, its named package/precommit gate; this plan,
  the task validation evidence, and `SESSION-HANDOFF.md`. Preserve host 127.0.0.1, ports 3100/3101, strict
  port behavior, repository Vite config plugins/token injection/proxy, `DISABLE_HMR`, `watch:null`, API-only
  isolated state/config/discovery, workers=1, retries/zero-flake policy, and the 102-test inventory.
- Out of scope: `server.ts`, product/runtime-debugger source, API-server lifecycle redesign, full E2E, precommit,
  publishing, installation, Git, external records, live ports 3000/3001, real mod/game/debuglog/workspace data,
  auto-restart/watchdogs, retries, skips, quarantine, or any split-suite surrogate.
- Acceptance contract:
  1. `playwright.config.ts` has no Vite command/shell ownership; only the existing isolated API server remains in
     `webServer`.
  2. Vite starts from the Playwright runner/global-setup process through the Vite JS API and repository
     `vite.config.ts`, with E2E token/proxy/host/port/HMR/watch semantics preserved.
  3. Occupied 3100 and Vite listen/start failures reject closed; any partial server is closed and the environment
     is restored.
  4. Playwright teardown closes Vite deterministically and leaves 3100/3101 clear after focused runs.
  5. A deterministic selftest proves start/readiness/close, occupied-port rejection, and post-failure cleanup on
     disposable ports. No auto-restart may hide a server death.
  6. Typecheck, lint (0 errors; established warnings recorded), one early unrelated E2E file, and the focused
     runtime-debugger E2E pass through the official wrapper on first attempt with zero flaky/bad verdicts. Full
     E2E and precommit remain coordinator-owned.
  7. No unrelated dirty file changes and no runtime-debugger behavior changes.
- Required evidence: exact lifecycle selftest command/result; typecheck; lint; both official focused wrapper
  commands and verdicts; post-run listener checks for 3100/3101 and selftest ports; owned-path `git diff --check`.
- Rollback: restore only the harness files and this subunit's documentation edits to their pre-task contents; do
  not revert or rewrite the pre-existing dirty worktree. No live state mutation is permitted.
- Plan status: VERIFIED by the coordinator's repaired `102/102` full E2E run, clean lifecycle/port receipt, and
  green precommit gate. Release/public/installed, external-record, and Git gates remain part of the parent task.

## BASELINE

- Revision/version: `main` at `c454d2c240965e4775b5929f8e54b5e5f5a02880`; public/installed extension `0.0.68`.
- Existing capability: `buildAddressedDebugWatcherBrief()` already returns `runtimeDebugger: runtime.payload`; `GET /api/agent/debug-watcher/brief` is authenticated and workspace-addressed.
- Contract gap: the route is `legacy-agent-api`, no `FORGE_CAPABILITIES` descriptor owns it, and `vscode-extension/mcp/x4forge-mcp.cjs` has no debugger tool.
- Installed baseline readback: public `0.0.68` on `127.0.0.1:62626` returned runtime-debugger schema `1`, historical session state, and 60 bounded incidents for addressed workspace `ws_f61166c42849c757cf219c37` through the legacy route; `GET /api/agent/runtime-debugger` returned HTTP `404`. The Studio token was read from the deliberately injected local root HTML and was never printed or persisted.
- Existing changes/failures/runtime state: the dirty worktree listed in `SESSION-HANDOFF.md` predates this task and is outside ownership. The installed sidecar and 0.0.68 debugger were green at the previous close; current-X4-session proof remains separately open in #35.

## RECONCILE

- Resources and readers/writers searched: graphify code graph; `server.ts` route and handler; `RuntimeDebuggerAdapter`; bounded session store; capability registry/authority; route disposition manifest/audit; MCP dynamic-contract bridge; MCP selftest; ADR-F3/F5; capability map; BACKLOG B95/B96/B114/B115.
- Existing capability reused: parser, durable session cursor, ownership inventory, deterministic verdict, redaction, incident caps, source/node navigation, authenticated workspace resolution, effective-capability discovery, and MCP capability filtering.
- Couplings checked: route owner to capability id; capability effects to derived-state writes; API schema to MCP projection; workspace/key authority to debugger session key; UI compatibility route to canonical handler; source payload to redaction and caps.
- Capability-map delta: required on close because a legacy Agent API-only debugger becomes a canonical Agent API plus MCP capability.
- Plan changes: no parser or UI work is required. The task is narrowed to promotion/projection and proof. A new canonical route may be added while preserving the legacy route only if that is the cleanest way to keep exact capability ownership; both must share one implementation. The reproduced full-E2E Vite death required a separate bounded harness-repair subunit, specified above, with no product/runtime-debugger scope expansion.
- Harness reconciliation: `playwright.config.ts` contained two `webServer.command` entries, including a Vite command whose direct-process comment contradicted installed Playwright 1.61 behavior (`shell:true`). The API command and its isolated 3101 environment are retained; Vite ownership moves to a runner-process JS API handle with explicit teardown.

## IMPLEMENT

- Actual bounded changes:
  - registered stable capability `runtime.debug.read@1` with required workspace authority and the existing
    debugger adapter's truthful `read`, `analyze`, `audit-write`, and `audit-retention-delete` effects;
  - added canonical authenticated `GET /api/agent/runtime-debugger`, accepting only optional bounded `expect`,
    while retaining `/api/agent/debug-watcher/brief` as a compatibility envelope over the same handler;
  - added dynamically discovered MCP operation `runtime_debugger`, absent from static legacy fallback;
  - projected bounded session, verdict, coverage, expected-step, incident, explanation, ownership, and safe
    navigation evidence while excluding raw/whole-log fields, capping values and arrays, and redacting home paths;
  - added exact capability, route-disposition, MCP mapping/security, route-integration, and focused E2E coverage;
  - prepared extension release metadata and package version `0.0.69` with user-facing changelog entries;
  - removed the Vite `webServer.command`, configured Playwright global setup, and added a direct Vite JS-API
    lifecycle handle that loads the repository config, preserves the E2E proxy/token/HMR/watch settings, fails
    closed on listen conflicts, closes partial startup, and restores only the environment keys it changed;
  - added the disposable-port lifecycle selftest and wired its fast named command into precommit.
- Scope changes and reasons: no parser, attribution, UI, deploy, or AI-authority work was added. The canonical API
  accepts only `expect`; arbitrary `logPath`, `modId`, unknown fields, duplicate values, and overlong input fail
  closed. Navigation is emitted only for `confirmed_active` node or file/line ownership.

## VALIDATE

- Method -> result -> evidence:
  - capability audit -> PASS: 12 capabilities, 296 disposed literal routes, one reviewed dynamic registrar,
    11 MCP aliases; contract SHA-256
    `bb467c4b70402b3dd31571dbe10d60ec05653dc6f6600f043037e993f292037c`;
  - MCP capability selftest -> PASS (`read=6`, `write=10`, `deploy=11`); MCP syntax check -> PASS;
  - route integration -> `487/487` PASS, including canonical schema, compatibility parity, auth/workspace/effect
    denial, and no workspace/game-log write;
  - runtime adapter -> `42/42` PASS; capability registry -> `27/27` PASS; typecheck -> PASS;
  - lint -> PASS with zero errors and 592 pre-existing warnings;
  - runtime-index oracle sweep -> `133/133` PASS;
  - focused repaired capability-contract E2E -> `5/5` PASS; exact first affected canvas file -> `3/3` PASS;
  - Graphify refresh -> PASS at 6,311 nodes, 15,557 edges, 239 communities with no tracked graph churn;
  - production and extension builds -> PASS; staged-app probe -> `16/16` PASS;
  - rebuilt local VSIX inspection -> PASS: 2,091 entries, 61,789,011 unpacked bytes, 18,173,930 archive bytes;
    SHA-256 `73482D3E8FC716B19DA82F8199A0F4DFFE063146514C7E11DF65B1182E06A91F`.
  - full E2E run 1 -> FAILED `99/102`: three stale registry-count/subset expectations; one-file correction is
    focused green `5/5`.
  - full E2E run 2 -> FAILED `6/102`: Vite port 3100 disappeared after the first test and 96 tests inherited
    `ERR_CONNECTION_REFUSED`; report completed, `treeGone=true`, ports cleaned, and the first affected file then
    passed unchanged `3/3`. This is a reproduced ephemeral harness-server death, not accepted product proof.
  - full E2E run 3 before the lifecycle repair -> FAILED `81/102`: tests 1-81 passed, then Vite disappeared before
    test 82 and tests 82-102 inherited `ERR_CONNECTION_REFUSED`; report completed, `treeGone=true`, and ports were
    clean. No Windows resource-exhaustion or relevant application/system crash event accompanied the loss.
  - lifecycle selftest -> PASS: successful dynamic-port start/readiness/token injection/config semantics/close,
    occupied-port rejection, failed-start environment restoration, and post-failure port cleanup.
  - `npm run typecheck` after the final harness correction -> PASS.
  - `npm run lint` -> PASS with 0 errors and 592 established warnings.
  - official early focused wrapper after correcting the initial setup-root defect -> PASS `5/5`, zero flaky/bad,
    `treeGone=true`; the first wrapper attempt failed before test collection because global setup resolved
    `tests/e2e/vite.config.ts` instead of the repository root. This is recorded as a harness AAR trigger.
  - official runtime-debugger focused wrapper -> PASS `6/6`, zero flaky/bad, `treeGone=true`.
  - listener checks after selftest and both focused runs -> 3100/3101 clear each time; selftest dynamic ports
    were also proven clear by the selftest.
  - repaired authoritative full E2E -> PASS `102/102`, zero failed/flaky/bad, complete structured report,
    `childExit=0`, `treeGone=true`, and ports 3100/3101 clear.
  - `npm run precommit:check` -> PASS, including 54/54 verdict selftests, the Vite lifecycle selftest, product-copy,
    durable-writer, capability/MCP, action-receipt coverage, typecheck, mirror, tripwire, and large-file gates.
  - Open VSX publication/readback -> PASS: exact/latest metadata `0.0.69`; independently downloaded public archive
    matches local at 18,173,930 bytes and SHA-256
    `73482D3E8FC716B19DA82F8199A0F4DFFE063146514C7E11DF65B1182E06A91F`; public inspection is 2,091 entries and
    61,789,011 unpacked bytes.
  - installed Antigravity proof -> PASS: registry and extension page report `0.0.69`; reload completed; only the
    installed `0.0.69` supervisor/server tree remains; installed schema registry reports 40 domains including MD and
    AI scripts.
  - installed canonical API/MCP -> PASS: schema version 1, missing auth `401`, wrong workspace `403`, live dynamic
    MCP discovery, bounded/redacted `runtime_debugger` invocation, one confirmed navigation item, no unresolved
    navigation, and temporary exact key revoked. See `installed-validation.md`.
- Negative/rollback result: auth, missing/wrong workspace, capability/effect denial, arbitrary-path/mod-id input,
  unknown/multiple/overlong query input, static-fallback omission, response caps, redaction, unrelated-mod exclusion,
  ambiguous-navigation refusal, and no-source-write checks pass. Rollback remains the source baseline; no real mod,
  game installation, standing workspace content, or source debug log was changed.
- Visual/live result when applicable: no rendered UI gate applies because no visible surface changed. Installed Agent
  API and MCP readback remains required after public publication. The repaired full E2E and precommit gates are green.

## REVIEW

- Requirement classification:
  - criteria 1-8 -> implemented and focused/deterministically evidenced;
  - criterion 9 -> done and evidenced by exact public hash parity, public-archive install/reload, installed process
    provenance, canonical API negatives/positive, installed MCP invocation, redaction/bounds/navigation checks, and
    key revocation;
  - current-X4-session experience and broader runtime-oracle precision loop -> deliberately deferred to #35/#14.
- Harness-repair classification: VERIFIED. Lifecycle criteria 1-6 pass through the lifecycle selftest, corrected
  focused runs, repaired authoritative `102/102` suite, green precommit, clean process-tree termination, and clean
  ports. No runtime-debugger product behavior or unrelated source path changed.
- Fresh-eyes findings: capability discovery, route authority, effect honesty, bounded projection, redaction,
  fail-closed input, compatibility reuse, and rebuilt archive bytes were re-read. No duplicate debugger, independent
  parser, guessed navigation, whole-log surface, or AI authority was introduced. The repaired lifecycle survived the
  full 102-test load. The release is not complete while the public and installed-product gates remain open.

## CLOSE

- Status: PARTIAL
- Remaining risks/deferred work: external record synchronization, commit, and push remain. #35 current-X4-session
  experience proof, the broader #14 precision loop, and sidecar lifecycle cleanup remain separate.
- Suggested commit title: `feat(runtime): expose debugger to agents through API and MCP`

## AAR

- Triggers: reconciliation corrected the initial framing—the data path already existed while canonical discovery and
  MCP projection did not. Additional triggers: the first broad implementation worker stalled and late-wrote; the
  capability audit caught four MCP authority-escape errors; the first full E2E found stale count/subset fixtures; the
  second and third old-harness full E2E runs lost their ephemeral Vite server; the first package inspection and the
  rebuilt package inspection omitted their required artifact argument; the first precommit wrapper invocation used
  an invalid short timeout; several PowerShell probes had quoting/exit-code errors; task-owned worker helper
  processes required exact cleanup; the machine ceased to be quiet when WoW started; and the first repaired focused
  wrapper exposed a wrong `FullConfig.rootDir` assumption before any test ran.
- Sustain: resource-level reconciliation prevented a duplicate debugger implementation.
- Improve work/approach: close native workers and verify exact helper cleanup, memory, and ephemeral ports before
  launching the full serialized browser gate; do not start it immediately after worker shutdown. For Playwright
  global hooks, derive repository resources from `configFile` or an explicit project root rather than assuming
  `FullConfig.rootDir` equals the repository root.
- Improve tools: native worker closure can leave MCP helper trees behind, and the Google Docs trusted-read bridge's
  default POSIX file I/O is unavailable in this Windows tool surface; both require explicit exact-path reconciliation.
  Graphify's broad natural-language query also matched generic snapshot symbols, so targeted route/resource
  inspection remained necessary. The official wrapper reports a complete structured verdict and cleanup receipt,
  but a setup exception can still occur before test collection and must remain red.
- Highest-risk evidenced weakness: Playwright's shell-launched Vite `webServer.command` could disappear without
  ending the runner, producing a large misleading cascade of connection refusals. The direct runner-owned Vite
  JS-API lifecycle removes that ownership gap and survived the authoritative full suite; keep its occupied-port,
  cleanup, and environment-restoration selftest in precommit.
- Global/project lessons banked: pending close.
