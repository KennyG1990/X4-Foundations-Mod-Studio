# B108 — known-bugs hardening and public release

Task: Reconcile Kimi K3's `KNOWN-BUGS.md`, fix every confirmed defect named in the 2026-07-29 review,
remove stale/non-defect entries as they are resolved, validate the installed product in Antigravity, publish
the release to OpenVSX, then commit and push the exact published source.

Lane: FULL

## PLAN

- **Bounded unit:** FB-2, FB-12, FB-13, FB-14, FB-16, FB-17, FB-18, FB-19, FB-20, FB-21, and the
  reconciled valid subset of FB-22. One stable OpenVSX release after four testable implementation batches.
- **Assumptions:** the current clean `main`/`origin/main` equality is the rollback point; OpenVSX credentials
  remain available through the existing ignored `.env.local`; Ken will confirm a quiet machine before e2e
  and installed-host work; no real mod/game directory is needed for validation.
- **Authoritative references:** current code and callers; X4 Forge capability map and ADR-F1; BACKLOG B97;
  `UNIVERSAL_AI_TASK_WORKFLOW.md`; `vscode-extension/PUBLISHING.md`; the mod's observed
  `tools/wiregate.py`; live npm audit output; live X4 catalog sizes.
- **In scope:** explicit deploy identity; compatible full-validation gate; atomic guarded writes; discovery
  credential removal; GitHub credential lifecycle; removal of inert sync controls; cache preservation;
  AST/event and indexed-payload validation; bounded parser inputs; dependency remediation; CI quality gate;
  continuous `KNOWN-BUGS.md` cleanup; release/version/evidence documentation.
- **Out of scope:** unrelated backlog items; FB-15 implementation (not reproduced); FB-6 conflict-dialog UX;
  MCP registration policy; mod `tools/` deployment policy; addendum recommendations; live game mutation.
- **Risks and authorization boundaries:** deploy and file-write changes can overwrite user files if identity
  or atomicity regresses; GitHub tokens confer external write authority; dependency updates can change build
  behavior; publication is irreversible. User authorization explicitly includes repo edits, validation,
  packaging, OpenVSX publication, Git commit, and Git push. Validation uses isolated state/workspaces only.
- **Rollback/checkpoint:** clean `7c0bd24eb1effa2faaa66248d533cb2ffbbbbaa5` equals `origin/main` and is
  the source rollback point. Each route/e2e run owns a scratch workspace and ephemeral ports. A failed release
  version is never overwritten or republished; bump again only if OpenVSX accepted an unusable version.
- **Acceptance criteria:**
  1. Deploy without `path` or `workspace` is rejected before writes; every UI/doc caller names the target.
  2. Legacy deploy rejects a fixture that full project validation rejects, while retaining its compatible
     success/deprecation response for valid input.
  3. Guarded writes use atomic replacement, return the receipt for that request, preserve old bytes on an
     injected pre-rename failure, and leave no temp files; containment/CAS/strict validation/revert still pass.
  4. Discovery JSON and logs contain no session token; live/dead instance lifecycle still passes.
  5. No GitHub credential remains in browser storage or API responses; legacy migration, status, use, and
     disconnect/delete work; agent keys cannot invoke credential-backed GitHub routes; oversized requests
     fail before network activity.
  6. Both inert auto-sync controls and all dead state/props are absent; manual deploy/sync remains available.
  7. Quota failure sheds capped secondary history/baseline state before preserving the previous primary
     workspace cache as the last resort, and does not block server synchronization.
  8. Lua comments do not create registrations; direct calls, aliases/wrappers, concatenated prefixes, and
     the observed indexed payload contract are classified deterministically; collision/gap fixtures fail.
  9. Parser/catalog bounds reject oversized/deep/overflow fixtures while the real X4 catalogs and schemas pass.
  10. `npm audit --json` reports zero known vulnerabilities at the selected threshold and lockfiles agree.
  11. Windows quality CI exists and invokes install, audit, typecheck, lint with a 600-warning ceiling,
      oracles, focused route integration, and build through deterministic scripts suitable for a clean runner.
  12. Full local gates, isolated e2e structured verdict, production build, staged-product probes, stable VSIX
      packaging, and real Antigravity installed/reload visual checks pass.
  13. OpenVSX serves the new stable version; public download SHA-256 equals the locally installed/tested VSIX.
  14. The published source is committed with a detailed message, pushed, and `origin/main == HEAD`.
- **Required validation and negative path:** typecheck; lint; relevant selftests; route integration 10 times
  with at least 5/5 consecutive green for the historical flake; live npm audit; full oracle sweep; full e2e
  structured verdict; production/extension build; staged probe; package
  inspection; precommit; Antigravity install/reload screenshot; OpenVSX exact-version API and hash. Negative
  paths are acceptance items 1, 2, 3, 5, 7, 8, and 9.
- **Evidence locations:** `docs/plans/2026-07-29-known-bugs-hardening-release.md`,
  `vscode-extension/evidence/<version>/`, route/e2e JSON reports, `KNOWN-BUGS.md`, `ROADMAP.md`,
  `SESSION-HANDOFF.md`, and both AAR ledgers.
- **Currently unavailable:** e2e and installed Antigravity validation are held at the machine-state gate until
  Ken confirms the app/game/machine state. OpenVSX proof is necessarily after all local gates.

## BASELINE

- **Revision/version:** clean `main` equals `origin/main` at
  `7c0bd24eb1effa2faaa66248d533cb2ffbbbbaa5`; extension version `0.0.57`; public-source release history
  already includes the 0.0.57 close.
- **Existing changes/failures/runtime state:** no modified or untracked files before this task. Antigravity and
  the installed 0.0.57 sidecar are running (observed port 65072), so state-touching validation is frozen until
  operator confirmation. Live `npm audit --json` is red: six advisories (3 high, 1 moderate, 2 low), all with
  a fix advertised. `.github/workflows` has no code-quality workflow. No test result is claimed yet. During
  implementation, three externally authored commits advanced `main`/`origin/main` to `c512920`; their changes
  are confined to Discord bot scripts and `discord-sync.yml`, with no overlap against B108 worktree files. A
  later external commit `2e9f74f` updated README/ROADMAP public naming and, because agents shared the active
  worktree, also captured the already-written B108 ROADMAP close before the implementation commit. It was pushed
  during final review. Publication had already completed and no source file was captured, but durable docs reached
  origin before code; this non-atomic close is recorded as a concurrency hazard and cannot be rewritten safely.

## RECONCILE

- **Resources and readers/writers searched:** deploy routes and all UI/script/doc callers; guarded write and
  history-revert paths; workspace atomic persistence; discovery publisher/readers; extension sidecar token
  ownership; GitHub routes/UI/localStorage; App cache/adoption ordering; Playtest/SourceControl toggle props;
  cross-file validation and Lua AST infrastructure; `wiregate.py`; XSD/XML/CAT parsers; workflows, package
  scripts, lockfile, release runbook, capability map, ADR-F1, BACKLOG B97.
- **Existing capability reused:** `runProjectValidation`, `buildWorkspaceFileManifest`, request workspaces and
  source stamps, `atomicWriteJson` posture, agent-key scope enforcement, server-owned AI-key pattern,
  `luaparse`, project cross-file selftests, selftest registry, isolated route/e2e harness, extension staging and
  package probes.
- **Couplings checked:** deploy target ↔ caller payload; validator ↔ emitted/disk manifest; guarded write ↔
  receipt/ledger/revert/CAS; discovery ↔ sidecar session ownership/external agent keys; credential store ↔
  GitHub proxy/UI/auth scopes; cache ↔ dirty-state/server sync; Lua registration ↔ MD raises; payload writes ↔
  MD reads/verb scope; parser budgets ↔ live corpus sizes; dependencies ↔ root/extension packaging.
- **Capability-map delta:** planned only: deploy identity becomes explicit, GitHub secrets become server-owned,
  and project validation gains indexed payload semantics. Record the delta only after implementation proves it.
- **Plan changes:** FB-15 removed as disproved; FB-13 changed from retirement to compatible full gating because
  B97 proves a live caller; FB-22 narrowed because archive discovery is bounded and current parser libraries
  already contain default expansion limits; FB-7/8/9/10 removed as non-defects/policy items. The resumed oracle
  gate exposed an environment-dependent legacy reference selftest: production reference validation remains
  corpus-backed, but this synthetic oracle must use explicit fixture reference sets. Repairing that gate is added
  to B108 because no release may proceed over a red required oracle.
  The first full e2e run then exposed the same missing-input class at the harness boundary: mutable config is
  correctly isolated, but the read-only canonical root is not carried into the disposable server. The plan now
  resolves an existing root from explicit environment, repo-local directory config, or the configured
  `libraries` schema parent and exports only that read-only path to e2e; no live config/workspace is reused.

## IMPLEMENT

- **Actual bounded changes:** deploy routes now require an explicit request target and share full-project
  preflight; Playtest sends the current workspace; guarded filesystem writes use request-local receipts and
  atomic sibling-temp replacement. Discovery records no longer contain the Studio session token. GitHub
  credentials moved from browser storage/API bodies into an atomic server-owned store with status/delete
  routes, OAuth response redaction, agent-key denial, and request/response caps. The inert auto-sync controls
  and their prop/state plumbing were removed. Failed local-cache writes preserve the last-known-good value.
  Lua event registration now uses the existing AST parser for direct, aliased, wrapped, constant, and prefix
  forms; the observed indexed Lua/MD payload protocol now rejects collisions and one-sided contracts. XML and
  CAT inputs have explicit size/depth/entity/count/offset budgets. Dependencies were upgraded to a compatible
  zero-advisory set; the established lint contract was preserved explicitly under ESLint 10; a Node 24 GitHub
  quality workflow now runs audit, typecheck, lint, oracle/route integration, and production build.
- **Late installed-product correction:** discovery reads/writes now project legacy JSON onto the public metadata
  schema and rewrite unknown credential fields even when the recorded PID is alive/reused. This closes the
  installed 0.0.57 upgrade leak without exposing the owned Studio session credential to external agents.
- **Scope changes and reasons:** `npm audit fix` could not clear the ESLint-tree advisories without a major
  upgrade. Compatible current ESLint/TypeScript-ESLint/React-Hooks packages were selected manually; new
  repo-wide lint rules introduced by those majors were not silently made part of this bounded release.

## VALIDATE

- **Method -> result -> evidence:** `npm audit --audit-level=high` PASS, zero vulnerabilities; `npm run
  typecheck` PASS; `npm run lint` PASS with the established 0-error contract (550 existing warnings); `npm run
  build` PASS (Vite 1,809 modules + bundled server); focused selftests PASS: workspace persistence 14/14,
  GitHub credential store 7/7, local cache 4/4, cross-file validation 19/19, CAT/DAT 15/15, XML limits 4/4,
  agent-key scopes 22/22, instance discovery 13/13. Route stability drill PASS 10/10 consecutive runs, each
  175/175 assertions, with dynamic ports and isolated per-run state; all route servers and temp roots removed.
  First resumed `npm run test:oracles` run FAILED at 112/114: `/agent/reference-selftest` and its aggregate
  `/agent/selftest` were red because `reference_macro_caught` and `reference_faction_bad_caught` received empty
  canonical sets when `x4ReferenceRoot` was unconfigured. The isolated server, port 8972, and temp roots were
  removed. The oracle now uses explicit synthetic reference sets while the production validator remains
  canonical-corpus-backed; `npm run typecheck` then passed and the complete `npm run test:oracles` rerun passed
  114/114. The repaired gate defect was removed from `KNOWN-BUGS.md`.
  First full `npm run test:e2e` structured verdict FAILED: 40 passed / 3 failed. Continuous diagnostics lacked
  script properties, the complex-project manifest was `unavailable`, and fromPath validation reported
  `scriptProperties.available:false`. Ports 3100/3101 stopped, port 65072 remained the only watched listener,
  and every live `.studio-state` SHA-256 was unchanged. `playwright.config.ts` now resolves the read-only root
  before redirecting mutable config; the affected specs passed 10/10 and the complete structured rerun passed
  43/43 in 6.1 minutes. Ports 3100/3101 stopped and the live state hashes remained unchanged; the repaired
  defect was removed from `KNOWN-BUGS.md`. Real-data checks also pass: canonical corpus 14/14 (32 factions,
  1,902 wares, 1,192 jobs, 178 AI scripts, 170 sectors, 6,505 macros); installed `03_sig.cat` at 32,695,220
  bytes parsed 364,527 bounded entries; the cold real-reference API suite passed 81/81 with 37 schema domains
  and zero include gaps.
- **Negative/rollback result:** injected atomic-write failure preserved destination bytes and left no temp;
  quota failure preserved cache and secondary eviction recovered a constrained write; local history is capped
  at 25; oversized credential/push and agent-key GitHub authority are rejected;
  Lua comment phantom, payload collision/gaps, oversized/deep XML, CAT size/count/offset overflow all reject.
  Route-level negatives PASS, including no deploy target, invalid legacy preflight with zero writes,
  unauthenticated GitHub access, oversized GitHub request, scoped-key denial, concurrent receipt isolation,
  containment/CAS, and stale-source refusal. Full e2e passed 43/43, including workspace-guard restoration;
  ports 3100/3101 stopped and live workspace hashes were unchanged.
- **Visual/live result when applicable:** VERIFIED in real Antigravity. The extension details page rendered
  installed version 0.0.58; the rebuilt Studio rendered as v1.0.348 with managed sidecar port 58753. Its public
  schema endpoint answered and the real discovery profile was token-free. Screenshot paths are recorded below.

## REVIEW

- **Requirement -> done | partial | missed | deferred | out of scope:** acceptance checks 1-14 are done and
  evidenced across source, negative, isolated runtime, real corpus, installed host, package, and public artifact.
  FB-15 and FB-7/8/9/10 remain out of scope as reconciled non-defects/policy. No required behavior is partial,
  missed, or deferred.
- **Fresh-eyes findings:** the first ESLint 10 run enabled 106 new errors through new core and React compiler
  rules. Review confirmed these were repo-wide pre-existing migration work, not regressions; the config now
  preserves the prior Hooks 5/core enforcement while still using advisory-free compatible packages. Re-reading
  Kimi's exact FB-17/19/20 acceptance found three first-pass omissions and corrected them: unauthenticated
  GitHub load now fails before network, secondary history is capped/evicted before primary-cache fallback, and
  CI now matches the Windows runner plus 600-warning ceiling. Route receipt concurrency proof was also added.

## CLOSE

- **Status:** PARTIAL — source, negative, isolated-runtime, real-corpus, packaged, installed-host, and public-artifact
  gates passed. Public Quality exposed two local-state blind spots in sequence: the missing extension dependency
  install, then three selftests coupled to host X4/schema configuration. Both are corrected locally, including an
  empty-profile 114/114 oracle proof, but the hermetic correction must pass publicly before shipment returns to
  VERIFIED.
- **Remaining risks/deferred work:** none within B108. Existing unrelated backlog items B94-B98 and live game/mod
  experience work remain out of scope. The Antigravity CLI has a host-owned post-install crash, but independent
  CLI listing, installed metadata, rendered UI, live sidecar, and public hash proof establish the Forge result.
- **Suggested commit title:** `fix(release): harden deploys, credentials, validation, and CI; publish X4 Forge Studio 0.0.58`

## AAR

- **Triggers:** reconciliation changed scope; reconnaissance had a malformed rg expression, a deliberately
  broad catalog scan timeout, and an unexported package subpath. Implementation also hit patch-context and
  shell-quoting failures, two typecheck corrections, parser-test corrections for luaparse string decoding and
  self-closing depth, a partially mutating/non-green `npm audit fix`, an initially red ESLint 10 gate, and a
  concurrent three-commit pushed `main` advance plus a later documentation commit that unintentionally captured
  B108's uncommitted ROADMAP close from the shared worktree, each requiring an overlap audit. Exact-acceptance re-read forced a
  second implementation pass for FB-17/19/20. The first resumed oracle run was 112/114 and exposed a legacy
  selftest whose result changed with external corpus configuration; a follow-up search command also exited 1
  after naming a nonexistent optional path. The first e2e run was structurally red at 40/43 because the
  isolated-config improvement had also discarded the read-only canonical root; teardown and live-state
  preservation remained green. A later combined real-data command was incorrectly bounded to 300 seconds even
  though the reference harness declares a 360-second cold-manifest allowance; it timed out and left a verified
  orphan test server on 8973. The orphan was terminated, the port was checked closed, and the same gate passed
  81/81 under a correct 15-minute outer bound.
- **Sustain:** tracing resources and callers disproved FB-15 and the recursive-scan portion of FB-22 before code
  was written; the live lockfile/audit prevented pinning Kimi's stale dependency versions.
- **Improve work/approach:** keep shell searches literal when expressions contain route parentheses; measure the
  documented archive boundary; invoke exported selftests rather than merely executing module files; inspect
  major-version lint rule deltas before accepting automated dependency remediation; re-read `HEAD`/upstream at
  every release checkpoint because other authorized sessions can advance `main` during an uncommitted release;
  read a harness's internal deadline before assigning an outer process timeout.
- **Improve tools:** package versions should be read from the lockfile when exports hide package.json; focused
  selftests need a first-class script so direct execution cannot produce an empty false-positive run. Concurrent
  agents need isolated worktrees or path-scoped staging; a shared active worktree lets one agent commit another's
  durable record even when source ownership is otherwise disjoint.
- **Highest-risk evidenced weakness:** session and GitHub credentials currently cross browser/discovery
  boundaries unnecessarily. This task removes those crossings and tests non-disclosure/deletion.
- **Global/project lessons banked:** pending verified close; no unverified procedure will be banked.

### Installed-product checkpoint — 0.0.58 candidate

- Schema-particle sweep passed 544/544 with zero particle failures. The root production build, extension
  stage/build, stable VSIX packaging, and staged-product probe pass. Candidate artifact:
  `vscode-extension/x4-forge-studio-0.0.58.vsix`, 17,811,982 bytes, SHA-256
  `2D17048647CA400ED0F97878E8E0ABDCEAB18356B6A12A9759A518B7C0F8873B`; package inspection found 2,090
  entries and zero forbidden entries.
- Antigravity's CLI installed 0.0.58 and the real rendered Extensions UI showed `X4 Forge Studio v0.0.58`
  after `Restart Extensions`; the Studio canvas survived the restart. This proves install/render only, not
  backend runtime.
- [REPRODUCED] `~/.x4forge/instances/2612.json` from 0.0.57 still contained a bearer `token`. Its recorded
  PID had been reused, so liveness-only pruning retained the secret. The candidate now sanitizes every parsed
  record to the public schema and rewrites legacy instance/latest files even when the PID is live; the updated
  focused oracle passes 16/16 and typecheck passes. Publication is stopped until a rebuilt install proves the
  real record is scrubbed and the managed sidecar answers.
- The apparent dead 8982 installed sidecar was a false diagnosis: timestamps and IDE logs show that record
  came from the staged-package probe, while the reloaded extension had only activated and had not received an
  Open Studio command. The installed runtime gate therefore remains pending rather than failed.
- Additional AAR triggers: the first Antigravity CLI invocation used a nonexistent PATH alias before the
  installed `antigravity-ide.cmd` path was located; installed-state interpretation initially conflated a probe
  discovery record with an IDE sidecar. Correlating `startedAt` with the extension-host output corrected it.

### Final installed/public evidence

- Rebuilt/package artifact: 2,090 entries, 17,812,396 bytes, zero forbidden entries, SHA-256
  `4E703F203B32DBB7A9EDFB7C1A27705175371B638EEC17B68744F4D9A69F1009`.
- Installed Antigravity rendered X4 Forge Studio 0.0.58 and the rebuilt Studio (`v1.0.348`), with managed sidecar
  port 58753 visible. PID 16676 owned that listener; its public schema API answered. Both `latest.json` and the
  sole instance record contain only `port,pid,startedAt,cwd,mode`, with no token. Screenshots:
  `vscode-extension/evidence/0.0.58/antigravity-installed-version-0.0.58.jpg` and
  `vscode-extension/evidence/0.0.58/antigravity-installed-sidecar-0.0.58.jpg`.
- Final post-repair gates: instance discovery 16/16, typecheck PASS, lint PASS at 0 errors/550 established
  warnings, audit 0 vulnerabilities, full oracle sweep 114/114, graph refreshed to 2,747 nodes/6,429 edges/147
  communities, and `npm run precommit:check` PASS.
- OpenVSX exact-version metadata became public after normal propagation delay. Public download:
  `https://open-vsx.org/api/x4forge/x4-forge-studio/0.0.58/file/x4forge.x4-forge-studio-0.0.58.vsix`.
  The downloaded artifact is 17,812,396 bytes and has the same SHA-256 as the local installed/tested VSIX.
- Final review classification: all 14 acceptance criteria are done and evidenced; reconciled exclusions remain
  out of scope except the reopened public CI portion of criterion 14, which is PARTIAL pending the corrective run.

### Public CI correction

- [REPRODUCED] GitHub Quality run `30498947479` failed at Typecheck with
  `vscode-extension/src/extension.ts:19 Cannot find module 'vscode' or its corresponding type declarations`;
  later steps were correctly skipped. Root `npm ci` cannot install the separate extension dev dependency graph.
- The workflow now runs `npm ci --prefix vscode-extension` after root install. Local execution of that exact
  install plus root typecheck passed and was pushed as `f9ecdd9`.
- [REPRODUCED] Corrective run `30499244809` passed both installs, audit, Typecheck, and Lint, then failed oracle
  integration. An empty `X4_CONFIG_DIR` reproduced the exact mechanism locally: expression-suggest, reference,
  and aggregate selftests were red because the former two read host schema/corpus state and patch-audit could not
  resolve the user's game `libraries/wares.xml` on a clean runner.
- Expression-suggest now builds its owned parser fixture; reference-selftest owns the three semantic attribute
  specs it exercises; patch-audit injects a synthetic `<wares/>` resolver while production callers retain the real
  loose/packed resolver. With an empty config profile, Typecheck and the runtime-discovered sweep pass 114/114.
- [REPRODUCED] The subsequent exact local Quality replay failed the route assertion for bounded action history:
  rewriting identical 312 KB content grew the history directory by 336,041 bytes. Content-addressed source blobs
  deduplicated correctly, but `unifiedDiff` serialized every unchanged line as context and stored that source-sized
  text under a new diff hash. The pure helper now emits only its bounded headers for identical inputs; an owned
  oracle covers this mechanism, and route integration passes 175/175 with measured rewrite growth of 569 bytes.
- [REPRODUCED] Public run `30499899687` passed dependency installs, audit, Typecheck, Lint, and the hermetic
  114/114 oracle sweep, then failed route integration. That suite deliberately refuses to skip its production
  server probe when `dist/server.cjs` is missing; `dist/` is Git-ignored, and Quality sequenced build after routes.
  A developer's existing bundle masked the dependency. Quality now builds the production bundle before the route
  suite that consumes it.

**Close:** B108 is PARTIAL during the hermetic CI correction cycle. OpenVSX remains public and its artifact identity
is verified; shipment closes only when the clean Windows Quality run is green and `origin/main == HEAD` is reproved.
