# B115 — Forge Capability Convergence

Status: PARTIAL program — W0-W1 VERIFIED through B116; W2-W21 remain; no public release
Lane: FULL
Owner: active Codex session
Approved: 2026-07-31 by Ken
Sources: Google Drive “X4 Forge — Capability Convergence Feature Request Package”; GitHub initiative
`KennyG1990/X4_Forge#9`; child issues `#10` through `#21`; current Forge source and project records;
`WingedGuardian/x4-claude-toolkit` at commit `112df5835ddd10aa62a8b791758a3db1ae2798da`.

## PLAN

- **Bounded program:** close the capability gaps in issues #10–#21 by extending Forge's existing engines and
  product surfaces. Forge remains the only user-facing product. This is not a rewrite and does not replace
  `runProjectValidation`, the workspace registry, CAS, artifact pipeline, Release Center, runtime watcher, or
  existing UI shells.
- **Execution order:**
  1. W0–W6: durable program, capability contract, authority, transaction receipts, reproducible release artifacts,
     and optional bounded provider infrastructure.
  2. W7–W13: engine-proven merge laws, immutable version/install profiles, Effective Tree and provenance,
     governed rule packs, rule-linked fixes, runtime oracle, and living evidence graph.
  3. W14–W18: structural/behavioral forensics, Compatibility Lab, analogue-driven completeness, and read-only
     semantic mod diff.
  4. Review stop: do not cross into source-writing rebase or network-driven update actions without the decisions
     and proof gates recorded below.
  5. W19–W21: reviewed staged rebase, opt-in upstream intelligence, and final UI/CLI/MCP/Agent API/harness parity.
- **Current bounded implementation batch:** W0–W1 only — durable baseline plus a browser-safe, deterministic
  `forge.capability.v1` metadata registry and drift oracle. Existing route handlers remain the executors.
- **Assumptions:** initial `main` was `a68d69855631cb5fd1c62cc4b0a69e08b6a0fc87`; during W1 separately owned
  documentation-only commits advanced `main`/`origin/main` first to `082f501c9778b13256e4c7d3d07b7f8bde2ae3ec` and then
  to `13db48cd84fb8eefe7c205a39d41f99029d093e2`. During close, `origin/main` advanced once more to
  `f2bc7f1dadf8c2bf42e12c22c4cc59fc079c3734` through two non-overlapping Discord/GitHub sync workflows; local
  `main` was fast-forwarded without a merge commit. At that recorded baseline, R13 source was PARTIAL and uncommitted; API
  `2026-07-30.agent.v4` and current MCP tool names must remain compatible.
- **Authoritative references:** `AGENTS.md`; `UNIVERSAL_AI_TASK_WORKFLOW.md`; ADR-F1 through ADR-F5;
  `F:\StarForge\wiki\x4-forge\capability-map.md`; X4 XSDs and unpacked corpus; real X4 debug-log evidence for
  engine behavior. Toolkit output is labelled comparison evidence, never Forge authority.
- **In scope for W0–W1:** eleven already-cross-surface capabilities — project validation, schema-domain listing,
  workspace read/compile, readiness, extension conflicts, patch readiness, element explanation, generation preview,
  history listing, and history revert; complete disposition of direct Express route literals; additive schema
  discovery; CLI discovery; MCP capability IDs with old-server fallback.
- **Out of scope for W0–W1:** handler rewrites, permission enforcement, provider execution, transaction engine,
  rule packs, Effective Tree semantics, installed profiles, native MCP registration, automatic rebase, network
  metadata, public release, and game-directory writes.
- **Risks:** metadata could be mistaken for enforcement; a dynamic registry could expand MCP authority; raw
  `/agent/generate` mixes preview/apply authority; browser-safe code could accidentally import server-only modules;
  active R13 edits overlap `server.ts`, `App.tsx`, and `AgentBridge.tsx`.
- **Authorization boundaries:** repository source/docs/tests are authorized. No game/mod directory, installed IDE,
  standing credential/configuration, network provider, marketplace, GitHub issue, or public release mutation is
  authorized by this unit.
- **Rollback/checkpoint:** ignored checkpoint
  `test-results/checkpoints/2026-07-31-r13-before-b115/` contains a binary tracked patch, untracked archive and
  SHA-256 manifest. W0–W1 remains additive; remove new files and revert only task-owned hunks if validation fails.

## ACCEPTANCE CONTRACT — W0–W1

1. A pure `forge.capability.v1` registry has stable IDs, descriptor versions, JSON schemas, workspace/profile
   context, declared access, effects, confirmation policy, API bindings and surface projections.
2. The contract hash is deterministic and contains no timestamp or machine path.
3. The initial eleven capabilities reuse current handlers. Validation aliases are projections of one
   `project.validate` capability, not duplicate capabilities.
4. `/api/agent/schema` retains `api_version: 2026-07-30.agent.v4`, all existing fields and response behavior, and
   adds one `capability_contract` field.
5. A TypeScript-AST audit dynamically discovers the current route-bearing server boundary, inventories direct
   Express registrations and rejects every unresolved mounted-router/middleware form regardless of whether its
   target is an identifier, call, property access, or other expression. It proves every registrar invocation occurs
   after authorization, binds every imported registrar to the exact route-source module that owns it, rejects
   same-name substitutions, registrar aliases, escaped references, statically dead calls, and nested-wrapper
   invocation whose lexical position cannot prove execution order, and audits both dot and computed member access
   for Express `use` mounts and
   public-read allowlist mutation. It expands every dynamic selftest registration to a reviewed per-entry route while rejecting
   spread, computed-name, method-property, or otherwise unresolved registry entries. Every literal/dynamic route is
   classified canonical capability, legacy public, legacy scoped-agent API, UI host, selftest/dev-only, or
   session-only credential/configuration; public selftests are reported as public, not conflated with dev-only jobs.
   Express registrations resolve their receiver at the call site to one canonical lexical binding; shadowed or
   aliased receivers, statically dead registrations, indirect `.call`/`.apply`/`Reflect.apply` registration, and
   unresolved static/dynamic member forms fail closed. The authorization boundary is exactly one canonical top-level
   `const app = express()` mount of `app.use('/api', authMiddleware)`; nested, dead, duplicate, or aliased decoys do
   not establish the boundary.
   Public access resolves to one canonical top-level immutable allowlist binding and executable mutations of that
   binding; nested/shadowed/dead decoys and registry membership without the live reviewed `publicGets.add()` path do
   not establish public authority.
6. The audit rejects undisposed or unreviewed dynamic routes, source-boundary drift, missing bindings, duplicate
   registrations/capability IDs/API bindings, unknown or version-mismatched CLI/MCP projections, MCP handler-route
   or method drift parsed only from live `TOOLS` array members, false surface anchors, unversioned output envelopes,
   missing exact ledger classifications, missing production guards for conditional-dev routes, and access claims
   that disagree with every effective middleware/registrar invocation. Synthetic negatives exercise each guard,
   including wrong MCP verbs rather than tautological comparison. Rewriting the manifest is a two-step generate then
   separately reviewed promotion; promotion rechecks version immutability and the full candidate audit before one
   atomic replacement, so a failed promotion leaves the reviewed manifest unchanged. A same-invocation flag cannot
   bless new exposure. API route keys must have exactly one effective registration; a regenerated manifest cannot
   baseline duplicates. Reviewed mutually-exclusive non-API host fallbacks remain separately modeled. Capability and
   MCP drift gates run in clean GitHub CI as well as local precommit.
7. Existing MCP tool names remain stable and explicitly map to exact capability `id@version` descriptors. A valid
   live contract may narrow by capability identity or declared MCP alias but never expand the curated tools;
   malformed current contracts fail closed for both
   list and call. Structural validation covers the complete v1 descriptor contract, not only identity/effect fields.
   Static compatibility is limited to legacy or temporarily unavailable servers that have not yet established a
   valid live contract. Only an explicitly reviewed legacy API-version envelope may select legacy fallback; a
   successful current or unknown schema envelope with a missing/malformed contract is invalid, not unavailable.
   After a valid contract narrows the process, later timeout/downgrade discovery cannot widen
   that process. Retries may recover and further narrow in the same MCP process, continue bounded polling after a
   live result, and proactively announce live-to-live inventory changes.
   Dynamic inventory uses the negotiated 2024-11-05 `tools.listChanged` contract and emits list-change notifications;
   fields introduced only in later MCP protocol revisions are not emitted under the older negotiated version.
   Both browser and MCP validators reject a repeated stable capability ID at any version and API bindings shared by
   different capabilities, even when the supplied contract hash is otherwise correct.
   Before any current contract has been established, legacy and unavailable static fallback calls use only routes
   supported by both old and current Forge servers.
8. Every primary API binding returns the descriptor's declared minimum output envelope, proven by isolated HTTP
   integration where safely instantiable and by an explicit source/fixture check only where a prerequisite cannot be
   created in the isolated harness. The element explanation
   capability gets one constrained composition adapter over the existing hover/attribute engines. User-facing curl
   examples include the same client/workspace authority headers that the live middleware requires. POST analysis
   capabilities disclose their durable audit-ledger/retention side effects. A descriptor that declares caller input
   cannot claim an `inputLocation` of `none`; the structural validator and a negative fixture enforce that transport
   grammar invariant. The compile endpoint rejects undeclared top-level fields, and `fileOverrides` values are
   schema-declared and runtime-enforced strings.
9. Existing `validate:mod` syntax and exit codes remain unchanged and its missing game-reference coverage is marked
   partial. A new read-only CLI command prints the canonical contract or one named `capability.id@version`.
10. Negative paths cover unknown capability/version, old-server fallback, missing workspace authority, revoked key,
   malformed/incomplete descriptor or request fixtures, monotonic MCP narrowing across timeout/downgrade, wrong MCP
    request verb, auth-mount bypass (including dead/nested/aliased auth mounts, wrong-module registrar substitution,
    dead registrar calls, computed `app['use']`, computed/wrapped route methods, receiver shadowing, and
    `.call`/`.apply`/`Reflect.apply` registration), malformed current schema fallback, dynamic
    public selftest addition through dot or computed `['add']`, exact-ledger removal, and a newly introduced undisposed
    route.
11. Required evidence: focused selftests, AST audit, typecheck, lint, route integration, runtime oracle sweep, full
    isolated E2E, build, staged/package inspection, and installed-host discovery where the shipped extension changes.
    Because W1 shares shipped files with unverified R13 bytes, package/install proof is not independently attributable;
    W1 remains PARTIAL until that combined release gate is explicitly authorized and passed. No in-game proof applies.
12. `surfaces.ui` covers both shipped Forge UI hosts: web Studio and the VS Code/Antigravity extension. Legacy/offline
    MCP base descriptions remain truthful without relying on live-contract projection notes.
13. The entrypoint-source audit rejects computed `import()`/`require()` expressions rather than silently excluding
   code that can register routes. Reviewed middleware cannot delegate the request triple through aliases, spreads,
   mutation APIs, nested-closure writes, or call-produced handlers. The selftest registry is one immutable `const`
   object whose binding cannot be mutated, aliased, or escaped after its reviewed literal declaration. Released v3
   manifest bytes receive complete structural validation before they can
    become the version-immutability baseline.
14. The MCP audit requires one reachable top-level immutable `TOOLS` declaration whose handlers are executable
    functions, rejects aliases, mutations, returns/yields/getter escapes, and ignores statically unreachable expected
    `forge()` calls, including escape through object/array containers. It rejects dynamic route templates and direct,
    bound, destructured, or `.call`/`.apply`/`Reflect.apply` alternate network transports from canonical handlers
    through dot or static computed member access. Surface evidence under statically dead
    control flow, unused exported functions, or unused callback objects does not count as a connected projection.
15. `workspace.generate.preview` rejects a non-string prompt and malformed declared fields before entering
    `callMultiProviderAI`; its negative integration proof runs with the spend meter failed closed so a regression
    cannot dispatch network work.
16. Entrypoint closure follows statically named local modules loaded through `createRequire()` aliases as well as
    direct `import()`/`require()` calls, including CJS acquisition of `createRequire` through reviewed `require`
    aliases and statically named CJS extraction, while rejecting unresolved computed extraction, shadowed or written
    Node loader bindings, foreign/computed factory bases, computed loader arguments, and loader/factory/namespace
    escapes, including `for...in`/`for...of` writes. Middleware request provenance is conservative across mutable
    declarations, binding patterns, ordinary/logical/loop assignments, later mutations, reassigned or shadowed
    formal parameters (including nested callback parameters), and reassigned reviewed middleware identifiers, so
  reassigning or spreading aliases cannot hide delegation of the request/response/next triple.
17. A released route manifest is structurally complete only when its canonical route-owner set and its versioned
   capability-signature set agree exactly. Projection evidence counts only when it is executable under complete
   literal JavaScript truthiness (including object/array/regex/function/class literals) and under immutable,
   non-overwritten value flow, and its importing module is itself reachable from `src/main.tsx` or
    `vscode-extension/src/extension.ts`; unused scripts/modules and `if (0)` branches do not prove product parity.
18. `/api/agent/compile` rejects a non-object body or non-object inline workspace with
    `CAPABILITY_INPUT_INVALID`. The shared legacy/preview generation executor rejects malformed bodies, prompts,
    workspaces, and apply flags before workspace resolution or the metered provider chokepoint; the legacy negative
    runs behind a deliberately failed-closed spend meter so it cannot accidentally dispatch network work.
19. Connected UI projections use the anchor's exact API route skeleton and method—not a prefix, nearby call, comment,
    or later spread/duplicate method property—and the anchor file must belong to the projection's declared web or
    VS Code/Antigravity host. Web and native import closures are independent and follow only top-level static value
    imports/re-exports from their real entrypoints. Literal URLs accept only an `/api/` path or a statically valid
    absolute-origin prefix; reviewed request helpers use their real option argument. Wrapped false conditions,
    anonymous callbacks, shorthand/computed method options, arbitrary identifier arguments, JSX values, unrelated
    property names, lexically shadowed or subsequently reassigned import aliases, dead/type-only imports, and files outside the
    two product hosts cannot make a projection reachable. Star re-exports respect explicit local shadowing and fail
    closed on ambiguous multi-star ownership. Unused top-level JSX callback objects and statements after a
    statically guaranteed return/throw cannot provide reachability evidence. Non-route and harness anchors require exact reviewed
   declaration/component identities. JSX components and render roots resolve lexically to the exact reviewed import
   origin at each use, without shadowing or reassignment. CLI projections prove that the named package script invokes
   the declared entrypoint and reviewed arguments; an unrelated script plus a token-bearing file is not evidence.

## BASELINE

- Revision: `a68d69855631cb5fd1c62cc4b0a69e08b6a0fc87`, `main == origin/main` at capture.
- Concurrent baseline change: `082f501c9778b13256e4c7d3d07b7f8bde2ae3ec` changed only the three mirrored
  agent-instruction files. A second instruction-only commit, `13db48cd84fb8eefe7c205a39d41f99029d093e2`, is now
  part of the base. Close-time remote commit `f2bc7f1dadf8c2bf42e12c22c4cc59fc079c3734` changes only
  `.github/workflows/discord-to-github.yml` and `.github/workflows/issue-sync.yml`; the path comparison found no W1/R13
  overlap and local `main` was fast-forwarded to that exact base before staging.
- Existing changes: 23 tracked changes and 16 untracked files. R13 ownership and unrelated user deletions/evidence
  are enumerated in `SESSION-HANDOFF.md` and the checkpoint manifest. They must not be reverted or staged as B115.
- Existing partial work: R13 continuous polling shares the checkpoint. Its source/runtime/focused/full E2E gates are
  green; packaged/installed proof remains the exact PARTIAL boundary.
- Baseline discovery drift: 190 direct literal Express routes across the original six audited files versus 58
  documented endpoint paths in `/api/agent/schema`; the original boundary omitted NPC-probe and dynamic selftest
  registrars.
- Current safety gaps scheduled after W1: deploy scope is not deny-by-default; some paths bypass addressed-workspace
  authority; receipts are fragmented/fail-soft; Nexus ZIP timestamps are nondeterministic; release secret scanning
  is absent.
- Current engine blocker scheduled for W7: `diffSimulator.ts` applies multi-match selectors to every match while the
  requested/toolkit contract says the engine skips ambiguous operations. Engine truth must be reproduced before
  Effective Tree becomes authoritative.

## RECONCILE

- Existing capability reused: `runProjectValidation`, `/api/agent/schema`, MCP shim, repository validator CLI,
  Agent Bridge, workspace registry/CAS, Agent History, artifact/release pipeline, runtime watcher and reference
  corpus. No duplicate validator, workspace store, packager or user-facing toolkit shell will be created.
- Couplings checked: API routes ↔ schema; key scopes ↔ declared access; mutating routes ↔ history/receipts; MCP/CLI/UI
  aliases ↔ canonical capability IDs; profile/rule/provider/input hashes ↔ later evidence claims.
- Toolkit disposition: optional isolated provider and comparison oracle first; independent native Forge authority;
  selective MIT reuse only after provenance/licence review; Bash hooks/prose knowledge/arbitrary plugins rejected.
- Capability-map delta: none yet. The map changes only when a capability is implemented and evidenced.
- Plan changes caused by reconciliation: capability/permission/receipt foundations precede provider execution; W7
  engine proof blocks Effective Tree; W1 is metadata and drift governance only, not a generic execution framework.
  Fresh review additionally required enforced `/validate/check` and `/generate/preview` adapters, explicit partial/
  disconnected projections, minimum output envelopes, complete route-source discovery, and malformed-current-contract
  fail-closed behavior. Post-repair security review then reproduced two narrower failures: incomplete but correctly
  hashed v1 descriptors passed structural validation, and a later timeout/legacy response could widen an MCP process
  after valid live narrowing. Complete descriptor validation and monotonic per-process narrowing are now required;
  prior contract/MCP evidence is invalidated until both are repaired and rerun. Audit/contract review also found
  middleware-order, route-source/dynamic-selftest, MCP verb, exact-ledger and CI false-green paths; a missing combined
  element-explanation executor; incomplete authority headers in API examples; out-of-version MCP annotations; and
  unreported audit-ledger writes on POST analysis capabilities. These are W1 correctness requirements, not deferred
  cleanup, because each invalidates a published contract or its enforcement evidence. The second contract review
  then found `schema.domains.list` declaring `domain`/`refresh` while its primary binding claimed no input. W1 now
  requires binding/schema transport parity and a negative regression. Because the reviewed v3 manifest is new and
  untracked in this batch, its superseded candidate must be regenerated, re-inspected, and separately promoted;
  version immutability remains mandatory once that manifest exists in `HEAD`. The second security review found
  alias-level narrowing was ignored, polling stopped after a live discovery, and a transient outage after legacy
  discovery selected current-only routes. These three reproduced MCP gaps are also W1 blockers and require focused
  process-level regressions. The final audit/contract pass then reproduced unresolved expression mounts, per-registrar
  auth-order false greens, incomplete dynamic selftest expansion, non-atomic promotion/version bypass, dead-object MCP
  substitution, path-name-only dev-guard classification, weak non-route anchors, incomplete native-extension UI
  projections, legacy copy overclaims, and runtime evidence for only a subset of primary envelopes. All current audit,
  hash, and close evidence is invalidated until these are repaired and independently rerun. Exact grammar review also
  found `/compile` accepted undeclared top-level fields while its descriptor rejected them and modeled override values
  more loosely than the handler; schema and executor parity plus both negative cases are now required. The first
  exhaustive 11-route output run then reproduced one descriptor mismatch: `/schema-registry` returns `roots` as a
  string array, not an object. That run is failed evidence; the descriptor and manifest hash must be corrected and
  all eleven envelopes rerun. A final independent review after those repairs found five further audit/security
  false greens: run-command registration was default-open when `NODE_ENV` was unset; released-version comparison
  read the mutable worktree manifest instead of `HEAD`; arbitrary inline `app.use` functions were blanket-trusted;
  MCP `TOOLS` parsing ignored spreads/mutability; and the route-source boundary was directory-based rather than
  entrypoint-reachable. It also found projection anchors could accept an unreachable request function. These are
  W1 blockers, not generic cleanup: each can make the capability inventory, access claim, or drift gate disagree
  with executable behavior. The plan now requires explicit run-command opt-in, an authoritative released-manifest
  comparator, fail-closed middleware/tool syntax, reachable-source discovery, and bounded projection reachability
  probes before the manifest and final evidence are accepted.
  A subsequent fresh-eyes pass reproduced six remaining bypass classes even after those repairs: computed local imports
  were silently omitted; middleware request delegation could hide behind an alias/spread; malformed but v3-labelled
  released manifests emptied version guards; MCP aliases and dead expected calls could disguise runtime expansion or
  alternate transport; projection evidence could live only in dead/unused code; and a non-string generation prompt
  could reach the metered provider boundary. These are accepted W1 defects. The acceptance contract above supersedes
  the prior green static evidence, while the 64/64 E2E receipt remains a pre-repair runtime baseline.
  The MCP class is now bounded by a reviewed whole-module source signature plus an explicit audit-version bump rule;
  this intentionally replaces the impossible claim that a small AST oracle can interpret every JavaScript alias and
  control-flow form. Current-source reconciliation also disproved a later review's claims that mixed auth ordering,
  unknown compile fields, non-string overrides, or eleven-envelope coverage remained absent: the live audit/test code
  already contains those guards. The still-open executor mismatch is narrower—`workspace` itself can be non-object.
  A current-byte follow-up then reproduced projection-specific false greens: unanchored/prefix URL matching, stale
  anchor tokens, ambiguous method objects, one unioned web/native module closure, type-only/dead imports, and
  name-only function references. These are part of W1 because they can turn disconnected infrastructure into a false
  cross-surface capability claim. Acceptance item 19 replaces that permissive proof model with host-specific,
  exact-route, conservative execution evidence. The frozen-byte review after the first projection repair reproduced
  seven narrower bypasses: embedded `/api/` substrings, helper-specific option-slot drift, anonymous callback bodies
  treated as top-level, name-only callback consumers, type-only named re-exports, wrapped literal-dead conditions,
  and unrelated method/custom-prop anchors. It also proved that global workspace authority ran before the compile and
  generation handlers whenever a caller supplied an identity header, invalidating the intended input-first ordering.
  W1 now requires an explicit input-first exception at that middleware boundary plus isolated unknown-workspace
  negatives; the prior 323/323 HTTP result is retained only as a pre-repair runtime baseline. A later frozen-byte
  review found seven remaining proof-bypass classes: reassignment of a reviewed middleware name; reassignment or
  shadowing of its formal request triple before a name-only `next()` check; CJS `createRequire` acquisition through an
  alias of `require`; unresolved computed CJS extraction; shadowed/written `require` or `__filename`; overwriteable
  `let`/`var` runtime-import aliases; and star re-export shadowing/ambiguity. Acceptance items 16 and 19 now require
  those forms to fail closed. Repair verification against the next frozen bytes reduced this to three one-step
  variants: `for...in`/`for...of` writes were not classified for `__filename`, reviewed middleware names, or formal
  parameters, and nested function/arrow parameter bindings were skipped before shadow analysis. Those exact forms
  are now part of acceptance item 16; the 64/64 E2E run remains valid product-runtime evidence because this final
  repair touches only the audit oracle and its selftests. The final exact-byte pass then invalidated that close:
  authorization could be established by a never-called nested mount; computed/wrapped and indirect Express
  registrations could evade inventory; file-global receiver names accepted lexical substitution; registrar names
  were not tied to their owning import module; statically dead routes/calls counted as live; and a successful current
  MCP schema response missing `capability_contract` fell back to the full legacy inventory. These reproduced
  false-green paths are now explicit acceptance requirements in items 5, 7, and 10. All post-repair audit hashes and
  final-gate claims are superseded until this bounded hardening batch passes another frozen-byte review.

## IMPLEMENT

- Added browser-safe `forge.capability.v1` descriptors for eleven existing capabilities, deterministic SHA-256
  payload hashing, stable lookup/fixed-body adapters, minimum versioned input/output envelopes, and structural/hash
  verification. Surface projections now record `connected`, `partial`, or `disconnected` with auditable anchors and
  notes rather than claiming false parity.
- `/api/agent/schema` retains API v4 and adds `capability_contract`. New constrained routes force
  `recordBaseline:false` and `apply:false`; raw validation/generation routes remain for explicit compatibility.
  App, Agent Bridge, VS extension, and MCP validation/generation callers use the constrained routes.
- Added read-only `npm run capabilities -- [capability.id@version] [--json]`, exact unknown-version refusal, and
  a reviewed `forge.route-dispositions.v3` manifest for 290 effective routes plus one dynamic registrar across the
  complete 13-file server boundary. All 93 registry-generated public selftests are expanded to named handler-owned
  routes; public, authenticated, and conditional-dev selftests have distinct exposure dispositions.
- MCP remains a fixed ten-tool shim. Live discovery verifies the canonical hash, exact descriptor version, narrows
  the tool set monotonically, blocks malformed/incomplete/v2 mismatches for list and direct call, latches invalid
  current discovery until valid recovery, and never widens after timeout/downgrade. Legacy validation and element
  explanation use bounded old-route adapters. The 2024-11-05 server advertises/emits tool-list changes and omits
  later-version annotations. Projection limitations are appended to live tool descriptions.
- Agent Bridge renders server-backed LIVE metadata only after structural and SHA-256 verification; legacy, invalid,
  and unavailable states show the local catalog while saying server capabilities are unknown.
- Added a constrained combined element-explanation endpoint, complete descriptor validation, exact schema/compile
  input grammars, truthful history-revert wording, audit-write/retention effects, and working client/workspace/provider
  headers in README and Agent Bridge examples.
- The route audit now proves middleware registration order, recursively inventories server sources and route aliases,
  rejects unresolved mounts/dynamic allowlist writes, checks exact ledger kinds, semantic AST/JSX anchors and actual
  `forge(method,path)` MCP calls, and locks descriptor/MCP call signatures to versions. Baselines require separate
  candidate generation and exact-hash promotion. Both gates run in precommit and GitHub Quality CI.
- Final-review hardening makes `/api/run_command*` default-closed in every environment and opts in only through the
  supervised trusted-dev launcher or an explicit flag. The route oracle follows all 156 local executable sources
  reachable from `server.ts`, verifies named middleware declarations/bodies, rejects unreachable projection anchors,
  and parses only one static non-mutated MCP `const TOOLS` array. Candidate generation/promotion pins and reads the
  authoritative Git blob selected by `FORGE_CAPABILITY_BASE_REF` (CI uses full history plus the PR/push base), snapshots
  the destination, reruns the full audit, and rejects baseline/destination races before atomic replacement.

## VALIDATE

- Machine-state gate: Ken reported the machine quiet before repository mutation and isolated browser validation.
- PASS final `npm run typecheck`; PASS final `npm run precommit:check`, including 26/26 verdict-policy selftests,
  product-copy guard, 14/14 writer-audit selftests, live writer inventory, 8/8 native durable-writer tests, capability
  and MCP audits, typecheck, canon-mirror parity, size guards and tripwires.
- PASS final `npm run test:capabilities -- --json` on audit source SHA-256
  `d0c0c8af3c5465e0ff5adbd2a4f9e58399ea4d197f22cba749bdab8ebc6d160e`: eleven capabilities, 290 disposed routes,
  one reviewed dynamic registrar, ten MCP aliases, contract SHA-256
  `37357c1e6b11c6303923406e1be3261cba970725131dddc00ca961d097c41c1f`. Adversarial controls cover route-source
  closure, mutable/shadowed middleware and Node loaders, exact UI reachability, type-only/star exports, and loop/
  nested-callback variants identified by review.
- PASS two-step manifest gate: candidate and tracked manifest were byte-identical at 51,443 bytes and SHA-256
  `2272083e7804692f2529e03fee1a1e3ba49506611c7a7226ea80ea5f311a5264`; exact-hash promotion reran the full audit.
  A deliberate all-zero hash exited 1 and left the destination hash unchanged. The complete normalized MCP module is
  locked at audit version 5 / SHA-256 `79cc65f74387ae4fdda93fba0f0e4d0c0fdb2cde697d8b9c80a050352d2ca53c`.
- PASS `npm run test:mcp-capabilities`: ten live tools, legacy/outage compatibility, malformed/v2 fail-closed,
  monotonic capability/alias narrowing with live list-change notifications, and same-process recovery after about
  two seconds. PASS `npm run capabilities -- --json`: eleven stable descriptors and the matching contract hash.
- PASS `npm run test:routes`: 328/328. All eleven minimum output envelopes passed. Compile and legacy/preview
  generation reject non-object bodies, malformed workspaces/overrides, non-string prompts, non-boolean apply and
  undeclared fields before unknown-workspace authority and before a deliberately failed-closed spend meter; no
  provider dispatch can satisfy those assertions. Existing Nexus, Steam, filesystem, auth, deadline, production-
  bundle and run-command-default-closed regressions remained green.
- FAIL setup attempt `node scripts/oracle-sweep.mjs`: 0/128 because no server was listening on its default 3001.
  PASS authoritative replacement `npm run test:oracles`: the canonical isolated wrapper booted temporary state/API,
  discovered the running index, passed 129/129, and tore it down. The failed direct run is retained as AAR evidence,
  not presented as a product failure or erased by the later pass.
- PASS `npm run lint`: zero errors, 578 existing warnings. PASS `npm run build`: Vite production UI and bundled
  `dist/server.cjs`. PASS focused browser E2E 3/3. Eyes-on inspection of
  `test-results/capability-contract-live.png` shows eleven server capabilities, `forge.capability.v1`, the hash prefix
  and `LIVE CONTRACT`; `test-results/capability-contract-invalid.png` visibly shows the local eleven-capability
  catalog, unknown server support and `INVALID CONTRACT`.
- PASS intermediate full isolated `npm run test:e2e`: authoritative receipt `test-results/e2e-verdict.json` reports 64 passed,
  zero failed/flaky/bad/quarantined-blocking in 7.5 minutes. Final post-E2E changes were confined to the audit script
  and documentation, so no shipped runtime byte changed afterward. Ports 3000, 3001, 3100, 3101 and 8972 were clear.
- PASS Graphify refresh: 3,746 nodes / 8,843 edges / 176 communities. PASS final `git diff --check` apart from
  informational existing line-ending warnings.
- FAILED combined package/install gate: exact B115-W1/R13 bytes were packaged into a 17,942,625-byte VSIX with
  SHA-256 `20C938156CA36039E600251E730F5DCEC5E02D064B54789566E5E3EA335DB00D`, passed the 13-check inspector and 16-check
  staged probe, installed with critical-file parity, and visibly rendered the eleven-capability LIVE contract in
  Antigravity. The required Bridge Close interaction then reproduced multi-minute renderer unresponsiveness in two
  windows. No in-game proof applies to this metadata/governance unit. Full gate evidence:
  `docs/plans/2026-08-01-b115-r13-installed-gate.md`.
- PASS B116 remediation on final current source: full isolated E2E passed 94/94. Exact artifact
  `vscode-extension/x4-forge-studio-0.0.63-b116-r2-20260801-125325.vsix`, SHA-256
  `C5B46B44FC60AB804B5B8E561C2C41DD1B3DFB466801A5FAC6098361737A8565`, matched all seven critical installed files.
  Installed profile summary `vscode-extension/evidence/2026-08-01-b116-installed-r2/installed-renderer-profile-summary.json`
  reports `PASS`: Close took 173 ms, remount reached `Connected` plus all 11 capabilities in 3,031 ms, and no new
  unresponsive-host log appeared. Raw profiles remain ignored and retained; normal Antigravity was restored. The
  failed attempt above remains reproduced history rather than being erased. No public publish occurred.

## REVIEW

- Acceptance 1–19: done and evidenced for W0-W1. Acceptance 11 now includes source, HTTP, native browser, build,
  exact-r2 package/install parity, visible contract/readiness, installed extension-host profile and a green rendered
  Close/remount boundary. The original failed attempt remains recorded; it is superseded by the B116 remediation, not
  relabelled green.
- Fresh-eyes reviews repeatedly found real false-green paths in descriptor validation, MCP narrowing, route-source
  closure, middleware/loader provenance, projection reachability, input ordering, mutable import aliases and star
  re-exports. Each finding changed the documented contract before repair and received a negative probe. Final
  repair verification on exact audit SHA-256 `d0c0c8af...d160e` found no remaining blocker and confirmed symmetric
  controls for `for...in`/`for...of`, function, arrow and destructured-arrow variants. The final independent passes
  also rejected method-receiver recursion through `this`, ignored uppercase/lowercase helpers, timer/callback decoys,
  wrapped transports and origin mutation while preserving canonical handlers and rendered React evidence.
- Independent boundary review found no blocker in input-before-authority/spend ordering, all eleven output envelopes,
  two-step manifest immutability, whole-module MCP version locking, or exact ten-tool capability mapping.
- Requirement boundary held: existing handlers, validator, workspace registry, MCP shim and UI shells were extended;
  no duplicate router, validator, product shell, permission engine, provider framework, Effective Tree or rebase was
  introduced. W2–W21 remain deliberately unimplemented under this bounded unit.
- Capability-map delta identified but not written outside the authorized repository: add the canonical eleven-
  capability contract, exact 290-route/one-registrar governance, two-step manifest and MCP monotonic narrowing. No
  external capability-map write occurs in this repository-only unit. W0-W1 may now move to the repository ROADMAP;
  the overall W2-W21 program remains `PARTIAL`.

## CLOSE

- Status: `PARTIAL` overall / `VERIFIED` for W0-W1. B116 closed the combined installed-host boundary; W2-W21 remain
  deliberately unimplemented.
- What did not change: W2–W21, permission enforcement, provider execution, transaction engine, Effective Tree,
  installed user profiles or settings, source-writing rebase, network update automation, public release and game/mod directories.
- Baseline/rollback: the checkpoint is based on synchronized `HEAD == origin/main ==
  f2bc7f1dadf8c2bf42e12c22c4cc59fc079c3734`; ignored checkpoint
  `test-results/checkpoints/2026-07-31-r13-before-b115/` preserves the pre-B115 mixed R13 state.
- Remaining program: W2-W21 resume in dependency order, with W7 engine merge-law proof remaining the downstream
  authority gate. B116's deterministic 1,424-node fixture and exact installed profile remain mandatory regression
  evidence; public release remains separately authorized.
- Suggested W0-W1 close title: `perf(workspace): avoid unchanged full-snapshot polling`.

## AAR

- Triggers: reconciliation repeatedly changed the plan; early full E2E was 61/64 before three test/overlay repairs;
  several audit/typecheck attempts failed during AST hardening; one doc patch missed its context; the direct oracle
  command ran without a server; and three rounds of independent review found success-evidence bypasses after prior
  green audits. The last review found method-receiver recursion and an uppercase-call render false positive; the first
  repair attempt broke four legitimate JSX positives until fixtures were changed to real `createRoot(...).render(...)`
  flows. This is a non-clean Full-lane close.
- Remediation-close triggers: B116's first profile-summary analysis used unbounded `Math.max(...)` and hit a call-stack
  error before corrected analysis produced the retained `PASS` summary. The first remount timing was invalid, so it
  was discarded and the unchanged interaction repeated immediately; the valid 3,031 ms `Connected` plus 11-capability
  result is the evidence used here. Neither invalid attempt was relabelled green.
- Sustain: preserve one mutation lane; freeze exact source hashes for read-only reviewers; require negative probes for
  every false-green class; keep runtime verdicts, screenshots and post-teardown port checks; preserve the dirty R13
  baseline before priority switching.
- Improve work/approach: start oracle work with `npm run test:oracles`, not the server-dependent raw sweep; design AST
  ownership analysis around immutable bindings and all JavaScript write forms (`=`, logical/destructuring, update and
  loop targets) from the start; do not freeze evidence until adversarial variants include function/arrow/destructured
  and for-in/of symmetry.
- Improve tools: the new route/capability audit closes the hand-maintained-route failure class, but its large inline
  selftest block is hard to review. A later bounded refactor should extract pure AST fixtures without weakening this
  final oracle. The direct sweep's default-server dependency is adequately handled by the existing isolated wrapper.
- Highest-risk evidenced weakness: the original installed workbench stall is reproduced history, and B116's exact r2
  no longer reproduced it after removing the unchanged 6.04 MB full-snapshot transfer. That correlation does not prove
  a single root cause; retain the exact dense fixture and installed profile as regression gates.
- Project lesson banked here: green self-audits are not fresh review; exact-byte adversarial review remains mandatory
  for proof-generating code. External StarForge capability/AAR ledgers were not mutated under this task's explicit
  repository-only authorization boundary.
