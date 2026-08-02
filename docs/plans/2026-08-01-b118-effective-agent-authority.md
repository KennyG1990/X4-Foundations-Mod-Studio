# B118 — Actor-Effective Capability Authority

Status: VERIFIED
Lane: FULL
Owner: active Codex session
Parent: B115 / W2B
Approved program: 2026-07-31 by Ken

## PLAN

- **Bounded unit:** make the canonical Forge capability contract truthful for the caller that is using it. Add
  optional contract-only capability/effect restrictions to new agent keys, enforce those restrictions through
  B117's exact route decision, expose the resulting caller-effective capability subset through one protected
  workspace-addressed discovery endpoint, and make the existing MCP shim advertise/call only that subset.
- **Assumptions and resolved facts:**
  - `[REPRODUCED]` B117's `forge.route-dispositions.v4` exact method/template policy is the runtime preset grant
    source. This unit must consume its `disposition`, `owner`, scopes, workspace mode and policy hash; it must not
    create another router or scope table.
  - `[REPRODUCED]` the canonical eleven-capability contract is descriptive and public. It correctly describes all
    Forge capabilities, but it is not currently filtered for the authenticated key.
  - `[REPRODUCED]` MCP verifies and monotonically narrows the canonical live contract, but because discovery is not
    actor-effective a read key can still be shown write/deploy tools that the server will reject.
  - `[REPRODUCED]` B42 key records persist only a preset, workspace binding, expiry/revocation and audit metadata;
    no custom capability/effect restriction exists.
  - Existing keys remain preset-compatible. Custom narrowing is opt-in for newly created keys and does not rewrite,
    revoke, migrate, widen or grandfather any stored key.
  - A custom key stores sorted exact `capability.id@version` identities and an allowed-effect set. A descriptor is
    callable only when its exact identity is selected and every declared effect is allowed. Descriptor version/effect
    growth therefore fails closed until the user deliberately revokes and recreates the key.
  - A custom key is **contract-only**: protected routes whose exact B117 decision is not owned by a canonical
    capability are denied. Forge will not invent effects for legacy routes. Public localhost routes remain public
    and are reported as inherently available.
  - Excluding an effect removes every selected capability declaring it. It cannot suppress one side effect of an
    otherwise permitted call; the capability is denied as a whole.
- **Authoritative references:** `AGENTS.md`, `UNIVERSAL_AI_TASK_WORKFLOW.md`, ADR-F1 through ADR-F5, current
  capability map, Google Drive “X4 Forge — Capability Convergence Feature Request Package”, GitHub #19 and #20,
  `docs/plans/2026-07-31-capability-convergence.md`, B117's verified plan, the live route manifest, key store,
  capability registry and MCP shim.
- **In scope:**
  - optional exact capability-identity allowlist plus allowed-effect list on newly minted agent keys;
  - fail-closed key-store validation and atomic persistence with backward-compatible loading of old records;
  - exact middleware intersection: preset scope ∩ route authority ∩ custom capability/effect restriction;
  - one exact protected `GET /api/agent/capabilities/effective` route returning the deterministic caller-effective
    subset, immutable restrictions, policy/contract hashes and exclusion reasons;
  - unchanged public/global `/api/agent/schema` compatibility;
  - MCP validation of the effective contract as an exact descriptor subset of the canonical contract, plus local
    workspace-context intersection, monotonic narrowing, list-change notification and direct-call refusal;
  - Agent Keys Studio/native creation guidance and durable restriction display;
  - source, negative, isolated HTTP/MCP, browser, package and installed-host proof.
- **Out of scope:**
  - a generic capability executor/dispatcher or rebinding the built-in Architect to every capability;
  - CLI remote-auth configuration or the final W21 cross-surface parity benchmark;
  - W3 transaction receipts, approval/commit phases or changing Agent History's fail-soft contract;
  - changing the eleven modding capabilities, their handlers, API v4, workspace/CAS semantics, preset grants or
    public-read allowlist;
  - B64-SEC5, provider credential redesign, public publishing, game/mod/config writes or stored-key migration.
- **Likely files:** create `src/lib/agentCapabilityAuthority.ts`; modify `src/lib/agentKeys.ts`,
  `src/lib/forgeCapabilities.ts`, `server.ts`, `src/components/AgentBridge.tsx`, `vscode-extension/src/extension.ts`,
  `vscode-extension/mcp/x4forge-mcp.cjs`, `scripts/mcp-capability-selftest.ts`,
  `scripts/route-integration.mjs`, `tests/e2e/capability-contract.spec.ts`, and the reviewed route manifest only as
  required by its versioned MCP signature gate. A small shared, deterministic key-creation response contract may be
  added under `shared/` so Studio and the native extension cannot disagree about mint success. Refresh Graphify after
  source changes.
- **Risks and authorization boundaries:** auth middleware is high blast radius; public-schema compatibility,
  existing-key behavior and exact denials require isolated HTTP proof. Repository source/docs/tests, local package
  staging and installed Antigravity verification are authorized. No marketplace publish, remote issue mutation,
  provider spend, real user key, live game/mod directory or external StarForge document mutation is authorized.
- **Rollback/checkpoint:** source checkpoint
  `bb0f7e5b339350da2bcc2e64cf6d7a099817cdf8 == origin/main`; unrelated dirty paths remain owned by the user and are
  enumerated in `SESSION-HANDOFF.md`. Roll back only B118-owned files/hunks or reinstall the last verified B117 VSIX.
- **Acceptance criteria:**
  1. Old version-1/2 key records load with unchanged preset behavior. New records use one versioned, canonical,
     sorted restriction shape; malformed/duplicate/unknown identities/effects and capabilities outside the selected preset
     fail before persistence. Key creation uses an explicit `preset | exact` authority mode; absent mode remains valid
     only for legacy preset requests with no constraint fields. Unknown or constraint-like fields, implicit/mixed mode,
     and preset-plus-constraint requests fail before persistence. Failed create leaves the key store byte-identical.
  2. A custom key may use only selected canonical protected capabilities whose every declared effect is in its
     allowed-effect set and
     preset scope. Any protected noncanonical route is denied before handler execution. Exact stable errors identify
     capability identity, disallowed effect or unmapped legacy route plus the B117 policy version/hash.
  3. Preset-only existing/new keys retain the exact B117 positive and negative matrix. No custom restriction widens
     preset, workspace, Studio-only, caller-key provider or public authority.
  4. `/api/agent/schema` preserves `api_version: 2026-07-30.agent.v4`, the canonical full
     `capability_contract`, public access and existing fields. Authenticated `GET /api/agent/capabilities/effective`
     requires the caller's bound workspace and returns one hashed capability subset plus secret-free actor/policy/
     restriction evidence. Public, invalid, expired, revoked, unbound and wrong-workspace callers fail closed.
     Successful discovery does not increment key use or rewrite the key store.
  5. Effective selection is deterministic: Studio sees all eleven; an agent
     sees only capabilities whose exact primary route is canonically owned, preset-authorized, workspace-satisfiable,
     exact identity is selected and every effect is allowed. Every exclusion has a stable reason.
  6. MCP accepts the effective subset only when both contracts are structurally/hash valid and every effective
     descriptor is byte-equivalent to its canonical descriptor. Missing/malformed/expanded/substituted effective
     contracts fail closed. Old Forge servers retain the existing reviewed compatibility path.
  7. MCP tool list and direct call both intersect the effective subset and local workspace configuration; a missing
     or mismatched `X4FORGE_WORKSPACE_ID` cannot advertise workspace-required tools. A later broader response cannot
     re-expand a process after narrowing, including a later reviewed-legacy downgrade; legacy static fallback is valid
     only before the process has accepted any live effective authority. Live changes emit the negotiated list-change
     notification.
  8. Agent Keys UI defaults to current preset behavior and clearly explains the contract-only consequence before a
     user enables custom limits. It exposes eligible exact capability identities and allowed effects, sends exact values, and
     lists each key's durable restriction without exposing plaintext or hashes beyond the existing prefix. Studio and
     the native extension verify the returned authority mode and canonical restriction before copying or claiming a key;
     a mismatched minted record is immediately revoked, and a failed revocation is reported as an active-key hazard.
  9. No model, MCP narration, client-side catalog or UI state makes an authorization decision. Runtime success is
     decided by the server intersection over the exact B117 decision and canonical descriptor.
  10. Canonical capability IDs/versions, current handlers, API v4, MCP tool names, key token format, workspace/CAS,
      ledger, release and provider behavior remain regression-green.
- **Required validation and negative path:**
  - pure key/effective-authority selftests, typecheck, lint, capability audit and two-step reviewed MCP signature
    promotion where required;
  - isolated HTTP route suite proving preset compatibility, custom positive, capability/effect/unmapped denials,
    malformed creation, public discovery refusal, Studio/agent discovery and no-mutation/no-spend effects;
  - MCP selftest proving authenticated actor subset, canonical-subset integrity, workspace headers, list/call parity, monotonicity,
    live-to-reviewed-legacy non-expansion, old-server fallback and malformed fail-closed behavior;
  - key-create HTTP negatives for unknown/nested/typo/implicit/mixed authority requests plus deterministic shared-client
    response-mismatch tests proving neither official UI can claim contract-only success from a broader preset record;
  - runtime oracle sweep, focused browser test, full isolated E2E, production build and precommit;
  - staged app/VSIX inspection, packaged-byte probe, installed-file parity and real rendered Antigravity Agent Keys
    proof because shipped UI/MCP/server bytes change;
  - no in-game gate applies because this unit changes local authorization/discovery only.
- **Evidence locations:** command results in this record; browser/package evidence under
  `vscode-extension/evidence/2026-08-01-b118-effective-authority/`; structured E2E verdict in `test-results/`.
- **Ken decision:** none before implementation. The approved #19 contract requires bounded permissions with no hidden
  privilege; preset-compatible opt-in narrowing is the least disruptive implementation. Public release remains a
  separate explicit decision.

## BASELINE

- Revision: `bb0f7e5b339350da2bcc2e64cf6d7a099817cdf8`; local `HEAD`, `origin/main` and remote main matched at capture.
- Existing changes: unrelated `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`, removed Discord/data files,
  modified old 0.0.35 evidence, untracked issue templates/Kimi note/R8-R17 screenshots. Preserve all of them.
- Runtime/UI: installed Antigravity 1.107.0 with verified Forge extension 0.0.63 remains open; computer control is
  released. Ken reported the machine quiet. No B118 code, key-store, package or installed-product mutation exists.
- Existing green predecessor: B117 exact v4 authority, 378/378 HTTP, 129/129 oracles, 94/94 full E2E and installed
  parity/rendered proof. Those are regression requirements, not inferred B118 evidence.
- Baseline failures during planning: local `gh issue view` could not authenticate, so connected GitHub read-only
  issue data was used; invoking the capability audit with unsupported `--help` ran the audit and hit the 34-second
  command timeout. Neither changed repository state.

## RECONCILE

- **Resources/readers/writers searched:** Graphify relationships for `agentKeys.ts`, `agentAuthority.ts` and
  `forgeCapabilities.ts`; key persistence/create/verify/list; auth and workspace middleware; schema and key routes;
  capability descriptors/build/validation; Agent Bridge discovery/key UI; MCP TOOLS/discovery/list/call paths;
  MCP/capability/route/E2E tests; current GitHub #19/#20 and Drive FR-009/FR-010.
- **Existing capability reused:** B42 hash-only atomic key store; B117 exact route resolver; B115 canonical registry,
  descriptor/hash validators and ten-tool MCP monotonic narrowing; R8/R17 workspace binding/CAS; Studio fetch token
  injection and existing Agent Keys panel.
- **Absent/partial:** no stored custom restriction; no actor-effective contract or protected discovery endpoint;
  MCP sees only global catalog support; UI offers only the three presets; the built-in harness has one
  connected preview projection but no generic dispatcher.
- **Couplings checked:** stored record/version ↔ verify actor; key create/list UI ↔ API; canonical descriptor
  owner/effects ↔ exact route decision; public schema compatibility ↔ separate protected discovery; effective hash/subset ↔ MCP
  validation; key workspace binding ↔ capability context; MCP list ↔ direct call; MCP byte changes ↔ reviewed manifest
  signature; shipped UI/server/MCP ↔ packaged and installed extension.
- **Capability-map delta:** on verified close, record actor-effective discovery and opt-in contract-only key
  narrowing as a strengthening of B42/B115. Do not claim built-in harness parity or a new modding engine.
- **Plan changes:** narrowed W2B away from a dispatcher/rewrite. Existing MCP narrowing is extended with an
  authenticated subset; the public canonical catalog remains stable. Fresh reconciliation replaced ID-only/blocked-
  effect semantics with exact versioned identities plus allowed effects, and replaced optional auth on the public
  schema with one protected workspace-addressed discovery route. Custom keys deny unmapped protected routes instead
  of assigning guessed effects.
- **Fresh-eyes correction before close:** independent review reproduced two P1 blockers after the first green route
  receipt: sticky live MCP authority was evaluated after reviewed-legacy fallback, and contract-only mint intent was
  implicit while both clients trusted local UI state instead of the returned record. The bounded repair is the explicit
  authority-mode/shared response-verifier and live-before-legacy ordering above; no dispatcher, new grant table or
  migration is added.

## DOCUMENT PLAN

- This record and the B115 backlog delta were the implementation authority. The unit was `SPECIFIED` before any
  implementation file changed. The two correctness-required Batch 4 repairs and the final writer/capability-manifest
  review deltas were documented before their implementation or promotion.

## IMPLEMENT

- Batch 1 core implemented and review-corrected:
  - exported the canonical effect vocabulary and added exact reviewed-template resolution to B117's authority object;
  - added pure `agentCapabilityAuthority.ts` normalization, effective-selection and route-intersection decisions;
  - upgraded key persistence to v3 with optional immutable exact identities/allowed effects while loading v1/v2;
  - attached secret-free key ID/constraints to the runtime actor, enforced custom restrictions after exact preset
    authority, and suppressed usage-write amplification only on the one exact effective-discovery route;
  - added Studio key-option metadata, strict create-time validation and the protected effective-capability handler;
  - split persisted stale-constraint shape from current-catalog create eligibility so one retired identity cannot brick
    unrelated keys or block Studio revoke/recreate; `create`, `verify` and `list` now return detached nested arrays;
  - rejected allowed effects unused by selected identities so durable intent cannot carry misleading latent effects.
- Batch 2 route/MCP authority implemented:
  - added and audit-reserved exactly `GET /api/agent/capabilities/effective` as workspace-required for all three presets;
  - generated candidate SHA-256 `901e7e321a647d7049b485de595e7e11b5214971552042f23d4bae2bc688bf7b`, reviewed its
    one-route/new-source/MCP-signature delta, then promoted that exact hash through the full in-memory audit;
  - the endpoint emits an exact hashed actor/route-policy/constraint/exclusion envelope while retaining the unchanged
    public API-v4 global catalog;
  - MCP now requires configured key/workspace authority, verifies the global canonical contract and caller-effective
    envelope, accepts only byte-equivalent canonical descriptors, derives the 5/9/10 preset inventories, preserves
    reviewed-old-server fallback only after a 404 from the effective route, and refuses missing/malformed/auth-denied/
    expanded/substituted/wrong-workspace authority without a broad static fallback.
- Batch 3 user surfaces implemented:
  - the Studio Agent Keys panel defaults to presets and offers an explicit advanced contract-only toggle, eligible
    exact identities, allowed-effect guidance, immutable consequences, one-time reveal truth and durable restriction
    badges;
  - the native `X4 Forge: Create Agent Key` flow now offers preset versus exact-contract mode, server-sourced choices,
    effect review and a modal consequence confirmation before minting;
  - focused E2E creates a constrained key through the real rendered Studio, then proves its three-capability effective
    subset through a bearer-only request outside the Studio fetch wrapper.
- Batch 4 correctness repairs are complete:
  - accepted live MCP authority now precedes every legacy fallback; a same-process live-to-legacy downgrade retains
    the narrower accepted subset, authority hash and current canonical routes;
  - key creation now uses explicit `preset | exact` intent, a closed request shape and stable shape/semantic errors;
  - one dependency-free shared response contract drives Studio and native extension verification before token reveal,
    clipboard, logging or success copy; a mismatched 2xx mint is revoked immediately and a failed cleanup is reported
    as an active-key hazard;
  - exact requests require an explicit returned `authorityMode: exact`; only legacy preset receipts may omit the
    response mode. A constraint-shaped response cannot infer exact authority on behalf of the server;
  - the shared contract is inside the reviewed capability source boundary, the MCP module audit version is 11, and
    key-store fixture writes are pinned by the durable-writer inventory.

## VALIDATE

- **Pure/source contracts:** `runAgentKeysSelftest()` passed 73/73, including v1/v2 compatibility, v3 exact
  persistence, stale-identity coexistence, detached nested values, strict explicit-mode response verification and
  failed-persistence rollback. Route integration passed 400/400, including byte-identical-store rejection for
  implicit/mixed/nested/typo/unknown key requests and effective-authority positive/negative paths.
- **Capability/MCP authority:** the exact reviewed manifest SHA-256 is
  `509227ae34bd2b28e466f91185fccb671dff937cfecbe78b0c3605c6f7fff65d`; the full audit passes with 11 capabilities,
  291 literal routes, one dynamic registrar and 10 MCP aliases. Contract SHA-256 remains
  `d8a820f537dbcbb50bcb8a91c8bd415c221a15940f184e38a817fa4566c1ac8f`. MCP selftest passes with read=5, write=9,
  deploy=10 and exact custom narrowing, authenticated workspace discovery, canonical-subset checks, direct-call/list
  parity, old-server fallback before live authority, and no later outage or reviewed-legacy re-expansion.
- **Static/build:** root typecheck passed; lint exited 0 with 587 pre-existing warnings and zero errors; root production
  build and extension build passed. Graphify refreshed to 3,874 nodes, 9,186 edges and 174 communities.
- **Focused browser/negative:** `tests/e2e/capability-contract.spec.ts` passed 5/5. The real Studio exact-key flow
  returned the expected effective subset. A deliberately broadened preset response was not revealed, was revoked
  automatically and produced visible error copy instead of false success.
- **Runtime/full regression:** the supported isolated oracle runner passed 129/129. Full isolated E2E generated a green
  structured receipt at `2026-08-02T01:03:43.371Z`: 96/96 passed, zero failed/flaky/bad/quarantined, child exit 0.
  Ports 3000/3001/3100/3101 were clear afterward; live-state fingerprint
  `F9A2FB4165E70997D074EAE99F120998DFDB3BA10A21A87FBB7E703F8F3A0C0D` and config fingerprint
  `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697` were unchanged.
- **Post-review affected-scope rerun:** the explicit-exact-response correction passed the complete key/client contract
  73/73, typecheck, both builds, staged probe, VSIX inspection and a final precommit in 130.6 seconds. A redundant full
  E2E rerun was incorrectly given a ten-minute outer wrapper even though this suite has exceeded that duration; the
  controller was killed before any structured verdict and left only its isolated 3100/3101 servers. Those exact
  task-owned PIDs were reaped and all protected ports were clear. Independent review classified another full run as
  unnecessary because the final delta is one pure fail-closed response predicate with its direct negative oracle; the
  existing 96/96 receipt remains the full-regression authority for unchanged routes and UI behavior.
- **Package:** staged-app assembly passed with five bundle files, 169 runtime packages and the native binding; package
  probe passed 16/16. The replacement VSIX inspector passed for 2,091 entries / 60,765,876 unpacked bytes. Candidate
  `x4-forge-studio-0.0.63-b118-r2-20260801-215504.vsix` is 17,976,544 bytes, SHA-256
  `7979E2C5F7D31F2E8C5363E95281120D4DA936014D57717B7206AAF531079663`.
- **Installed/native UI:** Antigravity 1.107.0 installed R2 into an isolated CLI profile under ignored `test-results`
  while an unrelated user task kept the default IDE busy. CLI inventory recognized `x4forge.x4-forge-studio@0.0.63`.
  All 2,089 packaged extension files matched with zero missing/mismatched/unexpected; normalized package metadata
  matched and the canonical comparison-manifest SHA-256 is
  `6A7DAFF02FB1B81DAD5096CC61064EC9B50F86647ADFC61BE98F196F5A864495`. The earlier real rendered Forge v1.0.410
  Agent Keys proof remains applicable because the R2 delta changes only the fail-closed mint-response predicate, not
  the displayed controls or copy: exact versioned capabilities, allowed effects and native preset-versus-exact
  consequences were visible, and the flow was cancelled before mint. Evidence and hashes:
  `vscode-extension/evidence/2026-08-01-b118-effective-authority/`.
- **Final gate:** the first precommit run failed on the newly added key-store fixture-write count; the reviewed writer
  inventory then passed 14/14 and reports 32 filesystem, 11 host-store and two browser-output sources. The second run
  exposed a stale capability source/MCP signature; exact candidate review and promotion corrected it. The complete
  third `npm run precommit:check` passed in 152.4 seconds, including product copy, writer, capability, MCP and
  typecheck gates. After the final staged-review correction, the complete gate passed again in 130.6 seconds.
  `git diff --check` reports only existing line-ending notices.
- **Unavailable/not applicable:** no in-game gate applies; this unit changes localhost authorization/discovery only.
  No public marketplace release was authorized or attempted.

## REVIEW

- Requirement review: all ten acceptance requirements are done and evidenced. Existing preset keys remain compatible;
  exact keys narrow but never widen; public schema/API-v4 stays stable; effective discovery is protected and
  workspace-addressed; MCP list/call behavior is monotonic; Studio/native clients verify receipts before success;
  canonical IDs/handlers/workspace/CAS/provider/release behavior remains regression-green.
- Independent fresh-eyes review found no remaining source, authority or installed-UI blocker after the two P1 repairs.
  A later staged-diff review then reproduced one final contract blocker: the shared verifier inferred exact authority
  when a response omitted `authorityMode`. Exact mode is new in B118, so no released compatibility contract justifies
  that inference. The verifier and selftest now require explicit exact confirmation; affected source/package/isolated
  installed-parity gates reran green. The same reviewer found no remaining helper-contract issue and accepted the
  existing 96/96 full receipt plus the post-fix 73/73 direct oracle for this pure fail-closed delta.
- Deliberately deferred/out of scope: W3 transaction receipts, W21 generic harness parity, CLI remote-auth UX,
  B64-SEC5, provider execution, game/mod writes and public release.

## CLOSE

- Status: `VERIFIED`.
- Changed: opt-in immutable exact key constraints, caller-effective discovery, exact route intersection, monotonic MCP
  projection, strict creation envelopes, shared Studio/native response verification, truthful user guidance and
  package/installed proof. Existing preset records were not migrated or rewritten.
- Capability-map delta: B42/B115 are strengthened with actor-effective discovery and contract-only per-key narrowing;
  Forge still has one canonical capability registry and one exact route authority. No dispatcher or parallel product
  was added. The external StarForge mirror remains outside the repository-only authorization boundary.
- Rollback: revert only B118-owned files/hunks and reinstall the last verified B117 VSIX. Baseline is
  `bb0f7e5b339350da2bcc2e64cf6d7a099817cdf8`; unrelated working-tree changes remain untouched.
- Remaining risks/deferred work: the generic transaction/receipt contract is W3. B64-SEC5 remains a separately
  Ken-gated full-Studio-bearer boundary. No public release, game/mod/config write, provider spend or real user key
  creation occurred.
- Suggested commit title: `security(agent): expose and enforce effective capability authority`.

## AAR

- Triggers: reconciliation changed the design; local GitHub CLI auth was unavailable; an unsupported audit `--help`
  invocation timed out; the first typecheck, direct oracle invocation, initial focused browser attempts, first
  extension build and two precommit runs failed; independent reviews found three contract blockers; installation required an
  explicit close/reopen; exact native UI invocation needed a second, slower observation; the final redundant full-E2E
  wrapper was undersized and required exact orphan cleanup; the first final staging command used an invalid
  `Measure-Object` expression; one exploratory PowerShell hash helper collided with the built-in `h` alias.
- Sustain: intersect one exact route decision with one canonical descriptor and immutable key restriction; verify
  machine receipts before user-visible success; use isolated state hashes, package-byte parity and real rendered-host
  proof; serialize manifest promotion through exact reviewed SHA-256.
- Improve work/approach: run the durable-writer and capability-signature audits immediately after introducing a shared
  contract or selftest writes, not only at final precommit; allow enough time for native `ensureBackend()` before
  concluding a command did not open; use the repository's observed full-suite duration instead of an arbitrary outer
  timeout, and force a commit boundary before a bounded unit can accumulate multiple downstream batches.
- Improve tools: add a fast non-mutating help/preview mode to the capability audit and persist clearer native command
  startup/failure telemetry. The direct oracle command should explain that the supported isolated runner owns startup.
- Highest-risk evidenced weakness: the first implementation could widen a narrowed MCP process after legacy downgrade
  and both official clients trusted local intent over the minted record. The repaired ordering, shared verifier,
  compensating revoke and same-process/response-mutation negatives now close that mechanism.
- Project lesson banked here only: an authorization UI is not truthful until the server receipt is verified before
  token exposure, and a live authority cache must be monotonic across every fallback branch. External AAR mirrors were
  not written under this task's authorization.
