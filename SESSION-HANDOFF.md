# X4 Forge session handoff — 2026-07-24 close

## One-line state

B76 generic disk-backed artifact/CAT-DAT deployment is `VERIFIED` and moved to ROADMAP. The worktree is intentionally uncommitted; no real G-drive mod/game directory was mutated and nothing was published.

## Delivered boundary

- `src/lib/artifactPipeline.ts`: one provenance inventory (`generated`, disk-backed `source-copy`, excluded, runtime-owned), path/case/link guards, bounded hashing/copying, and exact loose verification. Unknown file types default to source-copy.
- `src/lib/x4CatDat.ts` + `src/lib/artifactPackager.ts`: deterministic streaming multi-volume CAT/DAT output, existing-catalog continuation, MD5/SHA-256 reopen verification, and partial-write rollback.
- `server.ts`: full disk plan feeds compile/validation/deploy; loose staging is isolated at `<Mod Workspace>/.forge-builds/loose/<modId>` and never replaces source; explicit game deploy uses scratch build + sibling stage/backup + declared runtime preservation + rollback; artifact reports are additive API output.
- `POST /api/agent/artifact/build`: authenticated scratch build under `<Mod Workspace>/.forge-builds/{loose|catalog}/<modId>` with no arbitrary output path.
- Generic fs create/write/delete targets only `modWorkspacePath`; configured live `filesystemPath` remains browse/import-only.
- `.forgeartifact.json`: project `exclude`, `runtimeOwned`, and `catalogLoose` rules. The file itself and development metadata (`.git`, `.forge-builds`, editor/agent state, node_modules) never ship.
- Validation merges disk-backed textual files omitted from browser memory. Text over the independent 4 MiB loader bound emits `validation.disk_file_skipped`, never a false-clean result.
- Canon: `docs/ARTIFACT_PIPELINE.md`, ADR-F4, capability-map delta, ROADMAP close, and project AAR updated.

## Final evidence

- PASS `npm run test:artifact-pipeline`: 41/41. Covers 300 KiB text, 7+ MiB arbitrary binary, unknown/Unicode/space/deep/empty/mixed-byte files, generated replacement, deterministic multi-volume catalogs, reopen/hash parity, tamper, missing source, traversal, collision, and rollback negatives. Windows denied creation of the symlink fixture; plan/consume code rejects lstat links and the route harness proves a junction escape is rejected.
- PASS `npm run test:routes`: 49/49. Real authenticated HTTP flow against isolated workspace/fake game; proves catalog deploy, large-file hash identity, source checkout byte identity after build/deploy, staging isolation, runtime preservation, stale/dev-output removal, write scope, traversal, and junction rejection.
- PASS `npm run test:oracles`: 102/102, runtime-discovered.
- PASS full `npm run test:e2e`: 24/24 via structured JSON verdict after the source-staging correction.
- PASS typecheck, lint (0 errors / pre-existing 437 warnings), precommit, production build, extension build/stage, staged sidecar probe 6/6 with 32 canonical factions, and graph update (2,310 nodes / 5,371 edges).
- PASS read-only installed-format check: `dynamic_universe` CAT MD5 matches paired DAT bytes.
- No real game deployment was run; this unit's game-write acceptance used only an isolated fake X4 root.

## Non-clean/AAR facts

- Reconciliation replaced the incomplete in-browser passthrough model with disk provenance.
- Identity tests forced corrections in both `contentXmlFor` and later original-file reapplication.
- One full e2e run was 23/24 because the isolated Vite host died (`ERR_CONNECTION_REFUSED`); the failed spec passed 1/1 alone and two full confirmation runs passed 24/24.
- Fresh-eyes review caught the highest-risk issue: atomic staging still targeted the source checkout. It was moved under `.forge-builds/loose`, and the HTTP regression now proves source `.git`, rule config, and large payload bytes remain unchanged.
- Direct `node scripts/oracle-sweep.mjs` without a server produced 0/101 fetch failures. The supported self-contained `npm run test:oracles` harness passed 102/102.
- Persisted repo `config.json` is pre-existing/stale and points `modWorkspacePath` at G:\...\extensions. It was not changed or used; current safety rejects that role overlap. The running public server was off when queried.

## Eyeball / operator queue

- No B76 visual surface changed; full browser e2e is the applicable UI regression gate and is green.
- Publication/version bump and any real X4 deploy are separate external side effects and were not authorized or performed.
- Two historical tracked evidence PNGs show unrelated byte churn discovered at final status review. Do not include them in a B76 commit without first restoring/triaging them; they are not feature evidence.

## Commit point

Suggested commit title: `feat: build lossless generic X4 artifacts and CAT/DAT deploys`

Commit question: B76 is verified but uncommitted. Commit/push only when the owner intentionally includes the reviewed source/docs and excludes unrelated evidence-image churn.
