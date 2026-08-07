# X4 Forge session handoff

Updated: 2026-08-07

## One-line state

The installed X4 Forge extension's W3B1a workspace/CAS receipt checkpoint is implemented and validated at `5/5`;
bulk-transform apply is the fifth verified route. W3B1/W3 and the extension-native program remain
`IN_PROGRESS / PARTIAL`. Stable `0.0.65` is publicly available on OpenVSX with exact local/public byte-hash parity,
installed in Antigravity, reloaded, rendered, and live-sidecar verified. Final synchronized precommit is green; exact
staging, commit/push parity, and GitHub `#9`/`#19`/`#20` marker synchronization remain the current close steps.

## Project and product boundary

- Repository: `F:\DEV_ENV\X4_Forge`.
- Product: the Antigravity/VS Code Forge extension, including its Studio webview and extension-managed loopback
  sidecar.
- No standalone app, end-user CLI, alternate runtime, imported-result path, game/mod write, or deploy belongs to this
  checkpoint.
- The owner granted standing quiet-machine permission for Antigravity validation; do not ask again in this program
  continuation unless the owner explicitly revokes that state.

## Current checkpoint

- Branch baseline: `main`; pre-checkpoint `HEAD == origin/main == c334127888368993cf350e13839376a0d44507d4`.
- Combined release commit: `release: publish X4 Forge Studio 0.0.65`.
- The route requires caller-owned `x-forge-operation-id`, binds canonical plan/source/paired-state hashes, serializes
  same-workspace mutations, rechecks plan and paired CAS at the mutation boundary, prepares recovery before one
  registry commit, terminalizes/reopens before success, replays exactly without remutation, conflicts changed facts,
  preserves deadline/finalization/rollback truth, and leaves Agent History fail-soft.
- Preview remains read-only. No new visible control or public product surface was added.

## OpenVSX 0.0.65 verified release

- Recovery plan: `docs/plans/2026-08-07-openvsx-0.0.65-recovery-release.md`; release artifact status `VERIFIED`.
- The native changelog generator now emits exactly one terminal LF and passes `12/12`. Package, lock top/root, and
  release metadata agree at `0.0.65`; curated/generated notes contain the same `11` ordered user-facing bullets.
- Exact stable archive: `vscode-extension/x4-forge-studio-0.0.65.vsix`, `18,098,264` bytes, SHA-256
  `ACBF40475A0AB55AA269E5728FE2B0927C22C9B9CC1F38F12AAD473A1F392D21`.
- Root build, fresh staging, extension build, archive inspection (`2,091` entries / `61,446,861` unpacked bytes),
  staged-sidecar probe `16/16`, and full precommit `[precommit] OK` in `492.9s` pass.
- OpenVSX command returned `Published x4forge.x4-forge-studio v0.0.65`, exit `0`, exactly once. Public latest/exact
  metadata report `0.0.65`; the public download is byte/hash identical to the local candidate.
- Installed Antigravity reports `x4forge.x4-forge-studio@0.0.65`; the real host was reloaded and the rendered/live
  proof below passed. Evidence: `vscode-extension/evidence/0.0.65-release-validation.md`.
- Historical `0.0.64` remains `BLOCKED` and immutable. It was accepted once, never activated during its bounded
  monitor, contains the old `0A0A` changelog EOF, and was not republished. Preserve its plan/evidence/archive.

## Owned implementation and governance paths

- `config/action-receipt-coverage.json`
- `config/durable-writers.json`
- `config/forge-route-dispositions.json`
- `scripts/reference-api-integration.mjs`
- `server.ts`
- `src/lib/actionReceiptPolicyBundle.selftest.ts`
- `src/lib/actionReceiptPolicyBundle.ts`
- `src/server/bulkTransformApplyReceiptAdapter.selftest.ts`
- `src/server/bulkTransformApplyReceiptAdapter.ts`
- `src/server/bulkTransformApplyReceiptFacts.selftest.ts`
- `src/server/bulkTransformApplyReceiptFacts.ts`
- `src/server/bulkTransformRoutes.ts`
- `tests/e2e/corpus-authoring.spec.ts`

## Durable close/evidence paths

- `docs/plans/2026-08-02-w3b1-addressed-state-receipts.md`
- `docs/plans/2026-08-02-pending-feature-implementation-program.md`
- `docs/plans/2026-08-04-extension-native-capability-program.md`
- `ROADMAP.md`
- `SESSION-HANDOFF.md`
- `vscode-extension/evidence/2026-08-07-w3b1a-bulk-receipts/installed-validation.md`
- `vscode-extension/evidence/2026-08-07-w3b1a-bulk-receipts/installed-antigravity-forge-v1.0.428.jpg`
- `docs/plans/2026-08-07-openvsx-0.0.64-release.md`
- `docs/plans/2026-08-07-openvsx-0.0.65-recovery-release.md`
- `vscode-extension/evidence/0.0.64-release-validation.md`
- `vscode-extension/evidence/0.0.65-release-validation.md`
- `vscode-extension/evidence/0.0.65-installed-antigravity-forge-v1.0.428.png`
- `vscode-extension/scripts/gen-changelog.mjs`
- `vscode-extension/package.json`, `package-lock.json`, `release-notes.json`, and generated `CHANGELOG.md`
- External capability-map and project-AAR deltas for W3B1a are already recorded in
  `F:\StarForge\wiki\x4-forge\`; no global AAR delta was warranted.

## Validation already green

- Facts `12/12`; receipt adapter `22/22`; receipt policy `18/18`; workspace receipt service `25/25`.
- Real X4 9.00 reference API `85/85`; production routes `467/467`; runtime-discovered oracles `132/132`.
- Focused rendered corpus-authoring E2E `1/1`; final official full E2E `96/96`, failed/flaky/bad `0/0/0`,
  `trigger=child-close`, `treeGone=true`, empty `remainingPids`, and closed ephemeral ports.
- Receipt coverage `82` routes / `52` surfaces at SHA-256
  `2c9678bf58ba39b4dfc81a9e2ee8874ee360a816a6d7e391779eb990a94a73f7`.
- Writers `38` filesystem / `11` host / `2` browser, selftest `14/14`, extension `8/8`.
- Capability contract `11` capabilities / `294` routes / one registrar / `10` MCP aliases.
- Typecheck, build, authoritative lint (zero errors / 591 existing warnings), owned diff check, and Graphify all pass.
  Graphify is `5,888` nodes / `14,501` edges / `210` communities.
- Release-specific `npm run precommit:check` returned `[precommit] OK` in `492.9s`, including E2E verdict `54/54` and
  receipt coverage `82/52`. The final synchronized run after durable close records also returned `[precommit] OK`,
  exit `0`, in `465.4s`; the commit hook repeats that gate against exact staging.

## Installed-extension proof

- Public/stable VSIX: `vscode-extension/x4-forge-studio-0.0.65.vsix`, 18,098,264 bytes, SHA-256
  `ACBF40475A0AB55AA269E5728FE2B0927C22C9B9CC1F38F12AAD473A1F392D21`.
- Installed extension: `x4forge.x4-forge-studio@0.0.65`.
- Installed server SHA-256 matches staged at
  `28D789465936D5869DD3707E21821CF0697FB2FE5851DC5034E5C3F9DD685BD7`; extension and supervisor hashes also match.
- Antigravity was reloaded. Forge `v1.0.428` rendered the preserved workspace with Mission Director `1507`,
  AI-script `1408`, and script properties `2333` loaded.
- Managed sidecar port `52634` is owned by `node.exe` executing the installed `0.0.65` extension's
  `app/dist/server.cjs`.
- Live read-only schema advertises the required bulk operation header; live receipt selftest is `25/25`.
- Live `config.json` stayed byte-identical at SHA-256
  `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697`.
- Rollback VSIX remains `vscode-extension/x4-forge-studio-0.0.63-busy-liveness-20260806.vsix`, SHA-256
  `841A63185547E2FBB946815EF87AF663A7367B6DC3FB091F66307B6409F9F1A3`.
- Rendered screenshot:
  `vscode-extension/evidence/0.0.65-installed-antigravity-forge-v1.0.428.png`, SHA-256
  `FE26D7B81141970F3E80C82C1CEE2133797B04B6CD41B318D6BC75BA96AF0715`.

## Preserved unrelated dirty state

Never stage, revert, delete, or rewrite these owner paths:

- `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`.
- Deleted Discord/data files already present in the worktree.
- `test-results/.last-run.json`.
- Existing `vscode-extension/evidence/0.0.35-*` files and six older `2026-07-31-r8-r17` screenshots.
- `.github/ISSUE_TEMPLATE/*`, `Note for Kimi.md`, and any other pre-existing untracked owner file.

Use `git add -- <exact checkpoint paths>` only. Do not use broad add, clean, reset, checkout, or stash.

## Triggered AAR hazards

- Governance correctly refused the new writer/source/surface rows until exact candidate review and hash-pinned
  promotion; never hand-edit around those authorities.
- An ad hoc lint scope produced false Node-global errors; `npm run lint` is authoritative.
- A 15-minute outer E2E observer killed a healthy approximately 19-minute run, and another run hit the known
  post-verdict Windows `0xC0000409`; exact cleanup plus the final `96/96` full run is the accepted evidence.
- Several broad Luna route-test workers remained byte-silent. Their residue was rejected; only settled native Luna
  facts/adapter/governance bytes are accepted.
- Antigravity shortcut focus opened Quick Open during the first reload attempt. The native View-menu command path
  performed the actual reload without losing the canvas.
- OpenVSX accepted `0.0.64` but withheld it beyond the normal poll and default timeout horizons while activating other
  releases. Publisher acknowledgment is not public-download evidence; never retry the occupied version.
- The deterministic changelog generator's old EOF contract produced `0A0A`; stable `0.0.65` fixes and directly tests
  exactly-one-LF output. Never occupy a version before terminal-byte and full diff checks pass.
- PowerShell's normal `ConvertFrom-Json` rejects `package-lock.json`'s empty root package key. Use `-AsHashtable` and
  index `['packages']['']`; this known trap recurred once during pre-publish readback.
- A broad supplemental secret regex matched harmless dependency test-data paths. Keep the package inspector
  authoritative and scope supplemental scans to package-root contract paths.
- Highest remaining risk: W3B1b-d mutation owners still lack complete native receipt authority.

## Exact continuation

1. Stage only the checkpoint and release paths, inspect staged name/status and staged diff, commit with the release
   subject, push `main`, and prove local/origin/remote full-hash parity.
2. Update only the existing marker blocks in GitHub issues `#9`, `#19`, and `#20`; leave all three open and prove one
   start/end marker per issue by readback.
3. Reconcile and document the next Full-lane feature: W3B1b guarded filesystem/recovery receipt authority.

## Eyeball queue

Empty for this invisible authority checkpoint. The installed rendered host and schema-source loading were observed
directly; no owner interaction or game-side experience gate remains for W3B1a.
