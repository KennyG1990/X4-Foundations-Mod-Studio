# Packaged VSIX CI Implementation Plan

**Goal:** close Kimi R19 by making the existing Windows Quality workflow build, stage, runtime-probe, package,
inspect, and retain the actual VSIX without publishing it.

Task: B110 / Kimi R19 packaged-product CI
Lane: FULL
Status: **SPECIFIED**

## PLAN

- **Bounded unit:** R19 only: extend the one existing Windows Quality job through the packaged extension boundary.
- **Assumptions:** GitHub `windows-latest` provides Node 24 and PowerShell but has no X4 install or private reference
  corpus. CI artifact upload is retention, not marketplace publication.
- **Authoritative references:** Kimi R19 ledger row; `.github/workflows/quality.yml`; extension `build-ext`,
  `stage-app`, `probe-staged-app`, `.vscodeignore`, and package manifest/lockfile; publishing guide; B108 clean-
  runner corrections; B110-R10 packaged supervisor contract; StarForge capability/ADR records.
- **In scope:** pinned VSCE tool; hermetic staged-probe fallback corpus; final VSIX central-directory inspection with
  pure rejection tests; Quality steps for extension build/stage/probe/package/inspect; upload of the inspected file as
  a GitHub Actions artifact.
- **Out of scope:** Open VSX/Marketplace publish; extension version bump/changelog; installed IDE or UI testing; full
  browser E2E in CI; Linux/macOS packaging; game/mod/Nexus/Steam operations; R20 flake policy.
- **Files/surfaces:** `.github/workflows/quality.yml`, extension package manifest/lock, staged probe, new package
  inspector, R19 plan and durable records.
- **Risks and authorization boundaries:** CI dependency/network time and false package confidence. The workflow has
  `contents: read`, receives no marketplace token, and may only upload the validated local VSIX to the run. No publish,
  release, external message, installed product, or production mutation is authorized.
- **Rollback/checkpoint:** baseline `f28daf294e64739b6eab14ce1213ae5fb7fc19c0`; revert only R19 paths. Preserve
  the two modified evidence images and two untracked user files.
- **Acceptance criteria:**
  1. One existing Quality job, on a clean Windows runner, installs locked root/extension dependencies and uses an
     exact VSCE version.
  2. It performs root build -> extension build -> fresh stage -> real staged sidecar 16-check probe -> VSIX package
     -> final archive inspection in dependency order.
  3. The staged probe creates/uses a deterministic temporary reference fixture when no configured corpus exists;
     local real-corpus runs retain the canonical 32-faction assertion.
  4. Final inspection requires non-empty controller, supervisor, staged server/UI/manifests, and native SQLite
     binding; rejects duplicate/unsafe names, missing/empty required payloads, secrets/runtime state, sourcemaps,
     machine paths, and excessive archive/unpacked size.
  5. Pure inspector negatives prove missing supervisor/server, empty required payload, forbidden secret/map/machine
     path, traversal/duplicate entry, and size violations fail.
  6. Only the successfully inspected `.vsix` is uploaded as a bounded-retention workflow artifact. No command or
     permission can publish it.
- **Required validation:** inspector selftest; extension build/stage/probe/package/inspect locally; workflow syntax
  parse/action review; root typecheck/lint/oracles/routes/build/precommit; graph refresh/diff review; exact-SHA public
  Quality run proving the clean chain and downloadable artifact metadata after commit/push.
- **Negative paths:** inspector synthetic rejection matrix; fixture selection with absent corpus; missing staged
  supervisor/server refusal remains in the real probe; workflow contains no `publish`, `ovsx`, marketplace token, or
  write permission.
- **Evidence:** this plan; local inspector/probe output and VSIX hash; public Quality run/artifact; ROADMAP/capability/
  AAR close.

## BASELINE

- **Revision/version:** `main == origin/main == f28daf294e64739b6eab14ce1213ae5fb7fc19c0`; extension 0.0.59.
- **Existing changes:** user-owned modified runtime-copy evidence PNGs; untracked `Note for Kimi.md` and
  `scripts/x4_muds_game.mjs`. No R19 implementation changes.
- **Existing CI:** one Windows Quality job (20-minute cap) runs locked installs, root audit/type/lint/oracles/build/
  routes. It never builds/stages/probes/packages the extension and uploads no artifact.
- **Existing package path:** local R10 chain passes build/stage/probe 16/16 and creates a clean 2,091-entry VSIX, but
  `package` fetches unpinned latest VSCE and no checked-in script inspects final archive bytes.
- **Public baseline:** R10 exact-SHA Quality run `30568397225` and Discord Release Sync `30568397204` started after
  push; result pending at R19 plan time.

## RECONCILE

- **Resources/readers/writers searched:** graph traversal from staged probe; Quality workflows; package/stage/build/
  ignore scripts; package manifest/lock; publishing guide; VSIX references; ADR/capability ledgers; R19 ledger row.
- **Existing capability reused:** existing Quality job, root production build, extension compiler, fresh app stage,
  R10 real process probe, VSCE package command, `.vscodeignore`, and Actions artifact retention.
- **Presence/absence:** all local product-chain commands exist and pass; final VSIX inspection, locked VSCE, CI chain,
  and upload step are absent. No current workflow calls marketplace publishing.
- **Couplings checked:** route integration consumes the root production bundle; stage consumes root `dist`; probe
  consumes stage plus compiled supervisor; VSIX consumes stage/out/ignore rules; inspection/upload consume exact VSIX.
- **Capability-map delta:** pending proof.
- **Plan changes:** R19 must make the probe hermetic because its default corpus path is machine-local. Pin VSCE 3.9.2
  (current registry version, Node >=20) rather than letting CI drift on `npx latest`. Add a self-contained archive
  inspector rather than relying on runner-specific shell ZIP output.

## IMPLEMENTATION TASKS

1. Add a pure-tested VSIX central-directory inspector and package script; pin VSCE in extension dependency state.
2. Add deterministic reference-fixture fallback to the existing staged probe while retaining real-corpus truth.
3. Extend the one Quality job in strict artifact-dependency order and upload only the inspected VSIX.
4. Run local package gates and regressions; fresh-eyes review workflow permissions/order/negative coverage.
5. Document close, commit/push only R19 paths, then require exact-SHA public clean-runner and artifact evidence.

### Replan after first public runner

- Exact-SHA Quality run `30569511806` / job `90962356914` passed steps 1-17, including the real staged probe,
  inspector selftest, and VSIX package, then failed step 18 `Inspect final VSIX bytes`; artifact upload correctly
  skipped. GitHub's public annotations expose only exit 1 while the unsigned job-log endpoint returns 403, so the
  offending entry is not observable from the run.
- The exact-root policy currently applies `os.homedir()` to third-party `node_modules` bytes. CI dependency binaries
  and generated wrappers may legitimately contain the runner's well-known home path; this repeats the locally
  reproduced vendor-content false-positive class, not evidence of first-party source/config leakage.
- **Acceptance correction:** repository/workspace/reference roots remain forbidden in every entry. The runner home
  remains forbidden in first-party package entries but is excluded from vendored `extension/app/node_modules/**`.
  Add selftests for both sides and emit GitHub error annotations containing exact inspector failures so any remaining
  clean-runner-only rejection is diagnosable without privileged log download. This narrows an overbroad oracle; it
  does not weaken required-payload, secret/state, traversal, CRC, size, or first-party path-leak checks.

## IMPLEMENT

- Pinned `@vscode/vsce` 3.9.2 in the extension manifest/lockfile and changed `package` to the locked local binary.
- Added `inspect-vsix.mjs`: a dependency-free final-archive parser that validates EOCD/central/local records,
  bounds, paths, compression, decompressed size, CRC-32, required non-empty payloads/native binding, forbidden
  secrets/state/maps, and exact current build-machine roots across decompressed content. Its synthetic rejection
  matrix is part of the package script.
- Made the R10 staged probe clean-runner-safe. A configured/available real corpus retains the 32-faction completion
  assertion; an absent corpus gets an isolated one-faction/ware/property fixture and proves the staged reference API.
  Config/state/data/discovery all stay under the per-run temp root.
- Extended the existing Windows Quality job after root routes: extension build, fresh stage, 16-check process probe,
  inspector 12-check policy proof, package, final-byte inspection, and 14-day artifact upload. Root and extension
  dependency audits run separately. Permissions remain `contents: read`; no publisher/token step exists.

## VALIDATE

- Extension locked install -> 288 packages; root and extension high-severity audits -> zero vulnerabilities.
- Inspector selftest -> **12/12 PASS**: valid minimum plus missing supervisor/server, empty required entry, secret,
  sourcemap, exact machine root, traversal, duplicate, per-entry size, and archive-size negatives.
- First hermetic probe -> **15/16 FAIL** because language completion correctly needs schemas absent from the minimal
  corpus. Reconciled to prove the lower-level reference API in fixture mode while preserving canonical language
  completion where real XSD/corpus exists. Corrected hermetic probe -> **16/16 PASS**.
- Local canonical staged probe -> **16/16 PASS**, including exactly 32 factions, `fallensplit`, and no `riptide`.
- First final-byte scan -> FAIL on 16 third-party files because a generic `/Users/*` pattern flagged legitimate
  documentation/type/native examples. Replaced with exact current build roots and added a cry-wolf negative. Corrected
  inspector -> PASS.
- Exact local CI-order chain (root build -> extension build -> fresh stage -> hermetic probe -> inspector selftest ->
  locked VSCE package -> final inspect) -> PASS. Artifact: 2,091 entries, 60,213,456 unpacked bytes,
  17,860,949 archive bytes, SHA-256 `85AD769A6E64A5EE76542B9BB0AF851C3126868CBBAB6CB6C2C903402546B8C1`.
- Root gates -> typecheck PASS; lint **0 errors / 548 warnings** under the 600 contract; oracles **119/119**; production
  build PASS; routes **243/243**.
- Workflow local parse -> Ruby YAML PASS. Review scan -> only `contents: read`; no `publish`, `ovsx`, marketplace
  credential, or token command (the human-readable step name says "without publishing").
- Process cleanup -> ports 8972/8982/8983 free after their owned runs.
- `graphify update .` -> PASS at 2,970 nodes / 6,942 edges / 155 communities. `npm run precommit:check` ->
  PASS (tripwires 0, canon mirrors, verdict 10/10, product-copy guard, typecheck). Final diff/port checks -> PASS.
- Required clean Windows public Quality run and downloadable artifact -> pending implementation push.
- First public Quality run `30569511806` / job `90962356914` -> **FAILED** only at final VSIX inspection after
  steps 1-17 passed; artifact upload correctly skipped. Public annotation/API evidence exposes exit 1 but not the
  rejected entry; unauthenticated log download -> 403.
- Corrected scoped machine-path oracle -> selftest **13/13 PASS**. It rejects the exact workspace root in all
  entries and home paths in first-party entries, allows only a vendor dependency's runner-home provenance, and
  preserves all other archive rejection policy. Existing 2,091-entry VSIX inspection -> PASS.
- GitHub diagnostic negative -> missing VSIX exits 1 and emits `::error title=VSIX inspection failed::...` with the
  exact cause for public annotations. Post-correction `graphify update .` -> 2,972 nodes / 6,947 edges / 156
  communities; `npm run precommit:check` -> PASS.

## REVIEW

- Requirements 1-5 -> locally done/evidenced. Package tool is exact/locked; both probe modes and all inspector
  negatives pass.
- Requirement 6 -> workflow order makes inspection a prerequisite for artifact upload, with `if-no-files-found:error`
  and 14-day retention. There is no publish permission or command.
- Fresh-eyes findings -> route integration remains after root build; stage remains after both root/extension builds;
  probe consumes the compiled supervisor; package consumes fresh stage/out; inspector consumes the exact named VSIX;
  upload consumes only that inspected path. Central/local ZIP bounds and CRC protect against an entry-list-only pass.
- Deliberately not done -> browser/installed/store gates are not applicable to a headless CI workflow; no version,
  changelog, publish, game, mod, Nexus, or Steam state changed.
- Known-bugs delta -> none; R19 is a recommendation/capability gap, not an active observed defect.

## CLOSE

- Status: **PARTIAL** — implementation and all local acceptance methods pass; required exact-SHA clean Windows
  Quality execution plus retained artifact evidence cannot exist until this implementation is committed/pushed.
- Capability-map delta: pending public clean-runner proof; do not claim CI coverage from local replay alone.
- Remaining risk/blocker: GitHub Actions may expose runner-only dependency, path, timeout, native-module, or YAML/action
  behavior. The public run is the R19 authority.
- Suggested implementation commit title: `ci(extension): build probe and inspect packaged VSIX`.

## AAR

- **Triggers so far:** one PowerShell wildcard path failed; the first fixture-mode probe was 15/16 because completion
  needs XSDs; the first package scan overgeneralized `/Users/*` and falsely rejected 16 vendor files. No acceptance
  weakening: the fixture proves the reference API while real-corpus mode retains completion; machine-path scanning
  now targets exact build roots and includes a negative against generic-user-path cry wolf.
- The first public runner then failed only on the final content scan. GitHub hid the precise unsigned log, exposing
  an observability gap; the correction scopes runner-home provenance out of vendor dependencies while retaining
  repository/workspace roots everywhere and adds exact public error annotations.
- **Sustain:** reuse the actual local product chain in CI and inspect the final compressed bytes, not source intent.
- **Improve work/approach:** distinguish corpus access from schema-backed language completion when designing minimal
  clean-runner fixtures. Derive sensitive machine roots from the running environment rather than broad examples.
- **Improve tools:** package inspection needed a checked-in cross-platform oracle; runner shell archive listings were
  not strong enough for decompression/CRC/content policy.
- **Highest-risk evidenced weakness:** Quality could be green while the distributable extension failed to compile,
  stage, boot, package, or exclude secrets. The new chain closes that locally; public proof remains required.
- **Lessons banked:** pending final public result; do not promote a locally green workflow to verified CI.
