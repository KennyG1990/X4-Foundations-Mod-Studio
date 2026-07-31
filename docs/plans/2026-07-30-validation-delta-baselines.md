# Kimi R2 — Validation Delta Baselines

Task: B110-R2 content-addressed last-green validation baseline and new/resolved warning delta
Lane: FULL
Status: PARTIAL — implementation and all local/product/installed-host gates passed; public-byte and exact-SHA CI close pending

## PLAN

- Bounded unit: persist one deterministic last-green validation snapshot per mod, compare current warnings against it, and surface that delta in project validation, continuous compile/Mod Doctor, and deploy preflight.
- Assumptions: `ExtensionProject.files` is the authoritative validation subject; the existing agent history and browser Git baseline are not validation baselines; baseline advancement must be deliberate.
- Authoritative references: ADR-F1 in `F:\StarForge\wiki\x4-forge\decisions.md`; `runProjectValidation`, `runFullWorkspaceValidation`, `buildDeployProjectValidation`; `dataPath()` plus `atomicWriteJson()`; Kimi ledger R2.
- In scope: deterministic project content hash; bounded atomic server-owned baseline store; explicit green `project/validate` promotion; successful-deploy promotion; comparison-only compile/package/dry-run behavior; API and Mod Doctor delta display; isolated selftests/integration/E2E.
- Out of scope: source-control diffs, error suppression, automatic baseline promotion from editor polling, real-mod deployment, historical trend charts, and cross-device baseline sync.
- Risks and authorization boundaries: corrupt state could create false confidence; automatic promotion could erase a regression signal; unbounded diagnostics could grow persistent data. No real mod/game/store/publish write is authorized in this unit. Store writes are confined to the configured Forge data directory and isolated temp roots in validation.
- Rollback/checkpoint: remove the additive baseline module/API fields/UI card and its `validation-baselines.json`; current checkpoint is `fcc1ef867fcbfe16f64844df76d5c941a729f80e`. Existing unrelated working-tree files remain untouched.
- Acceptance criteria:
  1. File order and slash/case normalization do not change content or warning identity.
  2. First comparison reports `no_baseline`, never a clean delta.
  3. A green explicit validation can record a bounded atomic snapshot; an erroring validation cannot.
  4. Added, resolved, and unchanged warnings are counted and returned with stable identities and concise samples.
  5. Background compile/package and deploy dry-run compare only; a successful deploy records only after byte and doctor gates pass.
  6. Corrupt/unsupported state is reported `unavailable` and is not silently overwritten.
  7. Deploy preflight and Mod Doctor show the same comparison semantics in plain language.
- Required validation and negative path: focused TypeScript selftest; route integration for no-baseline/record/new/resolved/rejected promotion/corruption/mod isolation; focused E2E visible card; typecheck; lint; full oracle sweep; full E2E; production build; precommit; graph refresh; packaged/installed real-host proof if the extension version changes. Negative paths are failed-promotion, corrupt store, and dry-run no-promotion.
- Evidence locations: command output in this record; UI screenshots under `vscode-extension/evidence/`; exact-SHA CI evidence in close documentation if published.

## BASELINE

- Revision/version: `HEAD == origin/main == fcc1ef867fcbfe16f64844df76d5c941a729f80e`; extension `0.0.60`.
- Existing changes/failures/runtime state: pre-existing modified `vscode-extension/evidence/0.0.35-runtime-copy-live.png` and `0.0.35-runtime-copy-startup.png`; untracked `Note for Kimi.md`; no task-owned services or ports live.

## RECONCILE

- Resources and readers/writers searched: Graphify, ADR-F1, capability map, `server.ts` validation/deploy chokepoints, `projectValidation.ts`, `workspaceIdentity.ts`, `dataDir.ts`, `workspaceState.ts`, `agentHistoryStore.ts`, `localWorkspaceCache.ts`, App compile polling, VS Code continuous validation.
- Existing capability reused: shared full-project validator, project flattening, content-addressed workspace conventions, server data root, atomic JSON writer, deploy checklist, Mod Doctor.
- Couplings checked: project files and diagnostic flattening; continuous compile and UI; API/IDE consumers; deploy preflight and success gates; persistent data corruption behavior.
- Capability-map delta: R2 adds a persistent validation-baseline/delta capability rather than reusing source-control history.
- Plan changes: fresh-eyes review found that compile/package initially compared the broader Mod Doctor warning set
  while explicit project validation and deploy used flattened full-project warnings. The implementation was corrected
  before decisive gates so every surface compares the same shared-validator warning currency. Deliberate promotion
  replaces any implicit last-run semantics because polling would otherwise erase the signal being measured.

## IMPLEMENT

- Actual bounded changes:
  - Added `src/lib/validationDelta.ts`: deterministic project/warning identities, bounded per-mod snapshots,
    additive/resolved/unchanged comparison, fail-closed parsing, atomic storage, and isolated selftest.
  - Wired `/api/agent/project/validate`, compile, package, and deploy-verify to one full-project warning currency.
    Explicit green validation and fully successful non-dry deploy may promote; polling/package/dry-run/error paths
    compare only. Corrupt state remains unavailable and cannot be overwritten.
  - Added the visible Diagnostics Center `Since last green` card and carried the delta through App/Sidebar/
    DiagnosticsCenter/PackageModDoctor state.
  - Expanded route integration and focused browser coverage for promotion, isolation, corruption, added/resolved,
    nonmutation, and visible no-baseline/count states. Released the feature in extension 0.0.61.
- Scope changes and reasons: the shared warning-currency correction was required by the original cross-surface
  acceptance contract; no additional recommendation or real-mod behavior entered scope.

## VALIDATE

- Method -> result -> evidence:
  - validation-delta pure selftest -> PASS 6/6.
  - isolated route integration -> PASS 261/261.
  - focused `diagnostic-suppression.spec.ts` -> PASS 2/2.
  - TypeScript -> PASS after correcting four union-narrowing errors found by the first run.
  - ESLint -> PASS, 0 errors / 551 established warnings; no new warning in the changed validation/UI surfaces.
  - product-copy guard -> PASS.
  - runtime oracle integration -> PASS 122/122, including the new validation-delta oracle.
  - decisive full isolated E2E -> PASS 48/48 in 443.8 seconds, zero failed/flaky/bad/quarantined; verdict receipt
    `test-results/e2e-verdict.json` generated `2026-07-30T23:44:45.378Z`; ports 3100/3101 closed afterward.
  - production build, extension build, staged app probe -> PASS; probe 16/16.
  - packaged VSIX inspection -> PASS, 2,091 entries, 60,297,221 unpacked bytes, 17,881,788 archive bytes;
    SHA-256 `2AE39B02565B0C559C113A574F7FE76BD3B8987B7258B0B0CD2F599A326B838A`.
  - precommit -> PASS; graph refreshed to 3,091 nodes / 7,218 edges / 158 communities; diff check PASS.
  - Open VSX publish client -> accepted `x4forge.x4-forge-studio` 0.0.61; version-specific public indexing and
    byte replay remain pending at this record point.
- Negative/rollback result: failed validation did not promote; background compile/package and dry-run did not
  promote; per-mod stores stayed isolated; corrupt/unsupported state returned unavailable and refused overwrite;
  first comparison stayed `no_baseline`; exact added/resolved warning transitions passed.
- Visual/live result when applicable: correct Antigravity CLI registry lists 0.0.61; reload spawned a new managed
  sidecar on `:61473`. The real installed host visibly rendered `Since last green` plus the honest no-baseline copy
  in a read-only DeadAir workspace. Evidence:
  `vscode-extension/evidence/0.0.61-validation-delta-antigravity.png`. No deploy, promotion, source edit, or real-mod
  write occurred.

## REVIEW

- Requirement -> done | partial | missed | deferred | out of scope:
  1. Order/slash/case-stable identities -> done and selftested.
  2. Honest first comparison -> done and externally tested.
  3. Explicit green promotion/error rejection -> done and externally tested.
  4. Added/resolved/unchanged counts, identities, samples -> done and externally tested.
  5. Background/dry-run comparison and post-gate deploy promotion -> done and externally tested.
  6. Corrupt/unsupported fail-closed state -> done and externally tested.
  7. Shared deploy/Mod Doctor semantics and visible language -> done; installed no-baseline state and E2E counts
     are evidenced separately.
  8. Public-byte parity and exact-SHA clean-runner CI -> partial, pending store propagation and post-push run.
- Fresh-eyes findings: the first implementation compared unlike warning sets across compile and explicit
  validation. It was corrected to flatten the same full-project validator output everywhere, then all decisive
  gates were rerun. The installed-host check intentionally did not seed the real DeadAir baseline.

## CLOSE

- Status: PARTIAL
- Remaining risks/deferred work: Open VSX must expose and replay exact 0.0.61 bytes; the published source must be
  committed/pushed and exact-SHA public Quality must pass before R2 becomes VERIFIED. Baseline history/trend charts
  and cross-device sync remain out of scope.
- Suggested commit title: `feat(validation): persist and surface warning deltas`

## AAR

- Triggers: initial TypeScript union errors; fresh-eyes warning-currency correction; first full E2E outer timeout
  without a verdict and exact orphan cleanup; missing VSIX-inspector filename; wrong Antigravity executable returned
  false success; correct CLI installed successfully before unrelated V8 teardown exit 134; blind command-palette
  reload was unreliable; expected Open VSX propagation lag.
- Sustain: keep the promotion authority server-owned and explicit, compare one deterministic warning currency, and
  prove installed/public/CI states independently.
- Improve work/approach: allocate the measured full-suite budget on the first run; inspect all validator flattening
  seams before wiring a cross-surface delta; use the product's documented CLI rather than the GUI executable.
- Improve tools: `inspect-package` should default to the current manifest version or fail with a clearer usage hint;
  the Antigravity CLI can emit a post-success teardown failure, so registry/list and live-host checks remain required.
- Highest-risk evidenced weakness: an automatic background promotion or a corrupt-store overwrite would erase the
  exact regression signal R2 is meant to preserve. Explicit green/deploy-only promotion plus fail-closed atomic state
  and external negative tests close that path.
- Global/project lessons banked: pending final ledger writes with the public-byte and exact-SHA CI evidence.
