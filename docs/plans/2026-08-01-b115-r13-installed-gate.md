# B115 W1 + Kimi R13 Combined Installed-Antigravity Gate

Task: close the one shared packaged/installed proof boundary after commit `37f07192099f844647cb3cf8ba423656159feab8`
Lane: FULL
Status: FAILED

## PLAN

- Bounded unit: build the exact committed B115-W1/R13 product bytes, create a uniquely named local VSIX without a
  version bump, inspect and runtime-probe it, install it over the existing same-version Antigravity extension with
  `--force`, prove critical installed files match the inspected artifact, and inspect the real rendered host.
- Assumptions: Forge source/runtime paths are clean at commit `37f0719`; remaining dirty paths are unrelated docs,
  deletions and evidence and are excluded by the staged-product/package policy. Antigravity is running and Ken has
  explicitly authorized installation. Local 0.0.63 is the rollback package.
- Authoritative references: `AGENTS.md`; `docs/plans/2026-07-30-packaged-vsix-ci.md`; `docs/plans/2026-07-31-workspace-authority.md`;
  `vscode-extension/scripts/{build-ext,stage-app,probe-staged-app,inspect-vsix}.mjs`; `vscode-extension/.vscodeignore`;
  the exact source commit and the real Antigravity host.
- In scope: root production build; extension controller build; fresh product stage; inspector selftest; staged sidecar
  probe; local package/inspection; artifact and installed-file hashes; same-version forced install; real-host reload,
  rendered capability-contract/polling smoke; screenshots and a durable close record.
- Out of scope: version/changelog bump, Open VSX or Marketplace publication, game/mod directory writes, running-game
  LIVE experience, W2 capability work, and unrelated B111-B114 implementation.
- Existing infrastructure reused: the locked VSCE dependency, stage allowlist/secret assertions, packaged supervisor,
  16-check staged probe, 13-check ZIP inspector, Antigravity CLI, Agent Bridge capability panel and scheduler telemetry.
- Risks and authorization boundaries: the install replaces the current `x4forge.x4-forge-studio@0.0.63` directory
  and requires host reload; a locked or failed replacement can temporarily disable Forge. No publishing or credential
  mutation is authorized. The visual smoke is read-only and must not replace or edit the user's canvas/workspace.
- Rollback/checkpoint: reinstall `vscode-extension/x4-forge-studio-0.0.63.vsix` with `--force`; its baseline SHA-256
  is `50032222bc22190d25d3314837e52e4370c4059f053d1d9bb6ea087de4da52e5`. Preserve all unrelated worktree files.
- Evidence locations: this plan; `vscode-extension/x4-forge-studio-0.0.63-b115-r13.vsix`; machine-readable artifact/
  installed hash table; `vscode-extension/evidence/2026-08-01-b115-r13-installed/`; Antigravity screenshot(s).

## ACCEPTANCE CONTRACT

1. `HEAD == origin/main == 37f07192099f844647cb3cf8ba423656159feab8` and no product-source path differs from
   HEAD before build.
2. Root production build and extension build pass; `stage-app` starts from a fresh stage and admits no secret,
   sourcemap, runtime-state, evidence or undeclared product entries.
3. Inspector selftest passes 13/13; the staged packaged-sidecar probe passes every discovered check and cleans up its
   owned listener/process state.
4. The uniquely named local VSIX passes the final inspector. Record bytes, entry count, unpacked bytes and SHA-256.
   It must contain the committed capability contract/MCP implementation and scheduler-enabled UI/server bytes.
5. Antigravity CLI reports installation success. Critical installed controller, supervisor, MCP, server and web asset
   hashes equal their corresponding VSIX entries; version text alone is not proof.
6. In the real rendered Antigravity host, Forge opens after reload, Agent API Bridge shows a valid LIVE
   `forge.capability.v1` contract with eleven capabilities, readiness/health settles honestly, and workspace switching
   does not retain prior-authority success. LIVE can subscribe/unsubscribe without stale badges. Do not fabricate
   running-game firing/error proof when no game oracle exists.
7. Negative paths: inspector rejection matrix stays green; missing/mismatched installed bytes block completion;
   installation failure triggers the known-good local 0.0.63 rollback rather than a false-success close.
8. No public publish, real mod/game write, workspace content edit, credential change, or unrelated Git staging occurs.

## BASELINE

- Revision: `HEAD == origin/main == 37f07192099f844647cb3cf8ba423656159feab8`.
- Extension/product: manifest 0.0.63; existing rollback VSIX 17,907,329 bytes / SHA-256 `50032222...52e5`;
  normal Antigravity profile contains 0.0.63 plus inert 0.0.57 residue.
- Runtime: Antigravity is active. No computer-control session is held. Ports 3100/3101 are clear after the final
  isolated E2E run.
- Existing changes: preserve unstaged B111-B114 in `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`, deleted
  Discord/game/data files, modified legacy evidence PNGs, untracked issue templates/note and six prior screenshots.

## RECONCILE

- Package chain already exists and is verified on clean CI; no new packager, installer or extension shell is needed.
- The current 0.0.63 local/public/installed bytes predate commit `37f0719`; version text cannot attribute the new
  capability/polling bytes. A uniquely named same-version artifact plus exact entry-to-installed hashes closes that
  gap without claiming a public release.
- B115 W1 and R13 share `vscode-extension/src/extension.ts`, the bundled server/UI and MCP module, so one combined
  artifact is the correct proof unit. Separate packages would be artificial and less attributable.
- Capability-map delta: no new capability; this unit strengthens proof from source/browser to packaged/installed.
- Initial reconciliation found no plan change. Installed-host execution then reproduced Antigravity `CodeWindow:
  detected unresponsive` events while exercising the Bridge close path against the user's 1,424-node DeadAir
  workspace. The source cleanup is O(1), and the host sample is currently inside Antigravity's workbench message
  handler rather than a Forge stack, so causality is unresolved. The acceptance contract is strengthened: repeat the
  subscribe/unsubscribe interaction in a temporary isolated Antigravity profile with the same installed bytes and a
  small disposable Forge workspace. The fully isolated profile reached Antigravity's Google-login onboarding; the
  operator correctly refused to automate authentication. A second normal-profile, no-folder window provided the
  smallest credential-safe A/B. It used its own renderer, extension host, sidecar port and client ID while retaining
  explicit authority over the same workspace. Closing the Bridge reproduced the same `CodeWindow: detected
  unresponsive` failure. The acceptance gate therefore fails and returns to a separate evidence-first remediation
  unit; the normal-profile failure is not dismissed as a one-window accident.

## IMPLEMENT

- Built the exact committed `37f0719` root application and extension controller, then generated a fresh allowlisted
  staged app. The stage contains five product bundle files and 169 runtime packages; one product sourcemap and 72
  vendor sourcemaps were excluded. Secret, runtime-state and evidence scans were clean and the native SQLite binding
  was present.
- Created the uniquely named local artifact
  `vscode-extension/x4-forge-studio-0.0.63-b115-r13.vsix`. The inspected archive contains 2,091 entries, is
  17,942,625 bytes compressed / 60,557,268 bytes unpacked, and has SHA-256
  `20C938156CA36039E600251E730F5DCEC5E02D064B54789566E5E3EA335DB00D`.
- Installed the inspected same-version VSIX in Antigravity with `--force`. The first live replacement reproduced a
  locked-extension `EPERM` rename and was not called success. A complete Antigravity exit released the lock; the
  retry reported `x4forge.x4-forge-studio@0.0.63` installed. No public publish occurred.
- Compared installed bytes to the inspected archive. Exact hashes match for `out/extension.js`,
  `out/sidecar-supervisor.js`, `mcp/x4forge-mcp.cjs`, `app/dist/server.cjs`, and the shipped UI asset
  `app/dist/assets/index-CkBIQuuG.js`. Antigravity's installer adds `__metadata` to `package.json`; removing only that
  documented installer-owned field yields identical normalized JSON SHA-256
  `7E47118C853E1756BC95738FBB10A30B29A4AB5ACAB64673B913F256FD62455D`.
- Used the installed extension read-only in two real Antigravity windows. Expert mode was selected temporarily to
  expose Agent API and restored to Beginner; no setting remains changed. No workspace content, game directory,
  credential, release or public state was changed.

## VALIDATE

- PASS root `npm run build`; PASS extension build; PASS fresh staging and allowlist/secret assertions.
- PASS VSIX inspector selftest 13/13 and final artifact inspection. The first default staged-sidecar probe stopped
  after its first two checks without leaving a listener; the direct and registered retries on port 8983 passed all
  16/16 checks, and both 8982/8983 were clear afterward. The failed first attempt remains AAR evidence.
- PASS local installation after the required full-host restart; PASS exact critical-file archive-to-install parity.
  Raw `package.json` mismatch was correctly rejected until the installer-owned `__metadata` field was isolated and
  normalized parity was proven.
- PASS rendered installed contract/readiness: Antigravity 1.0.398 on commit `37f0719` showed `Sync: Checking` then
  `Sync: Connected`, eleven server capabilities, `forge.capability.v1`, hash prefix `37357c1e6b11`, and `LIVE
  CONTRACT`. The optional runtime was honestly shown as not running; no running-game telemetry was claimed.
- PASS explicit authority/client isolation: the original installed window used workspace
  `ws_f61166c42849c757cf219c37` and client `client_022a71671f224b9ab2cfa28bdf62f62c`; a second no-folder window used
  the same explicit workspace authority through its separate sidecar on port 55737 and distinct client
  `client_3564514c79104a10b08462e134a80bb4`. Live State showed the current DeadAir snapshot rather than invented
  success. Evidence: `installed-capability-contract*.png` and `installed-live-state*.png` in the evidence directory.
- **FAIL required Bridge unsubscribe/close interaction.** The original renderer entered two 221-228 second
  unresponsive periods. The second no-folder renderer initially completed one accessibility-driven close/remount,
  but a direct rendered Close interaction at 02:08:56 reproduced the same Windows "The window is not responding"
  dialog and Antigravity `CodeWindow` samples. Failure screenshots are
  `installed-bridge-close-unresponsive-small-window.png` and
  `installed-bridge-close-unresponsive-dialog.png`; host log is
  `C:/Users/Moshi/AppData/Roaming/Antigravity IDE/logs/20260801T014026/main.log`.
- Source/log audit does not support blaming scheduler cleanup: close leaves `AgentBridge` mounted but disables its
  subscription; cleanup removes one subscriber in O(1) and App remains the shared workspace subscriber. An isolated
  10,000-cycle unsubscribe benchmark measured 0.0003 ms median, 0.0017 ms p99, 0.0502 ms max. In the first episodes,
  88/91 samples stopped in Antigravity workbench's local-extension-host `MessagePort.onmessage`; Forge's extension
  host and sidecar remained separate and no Bridge-close host message exists.
- Adjacent pressure is real but not yet causal: the active workspace response is 6.04 MB / 1,424 nodes / 1,420 links
  and App fetches/parses the full body every three seconds. Local parse median was approximately 16.5 ms. A later
  bounded optimization may use a head/hash probe and fetch the full snapshot only after change, but it is not
  retroactively declared the four-minute stall's cause.
- PASS final `npm run precommit:check` in 148.5 seconds: tripwires, canon mirrors, verdict policy 26/26, product-copy
  guard, writer audit 14/14 plus durable-write 8/8, capability/MCP audits and typecheck.

## REVIEW

- Acceptance 1-5 -> done and evidenced.
- Acceptance 6 -> partial for installed contract, readiness, workspace/client authority and Live State; **failed**
  for the required subscribe/unsubscribe interaction because real rendered Close can stall Antigravity.
- Acceptance 7 -> done for the inspector rejection matrix, mismatched-byte refusal, locked-install failure and
  recovery path. Rollback was prepared but not invoked because the exact artifact installed successfully after a
  clean host exit.
- Acceptance 8 -> done: no publish, real mod/game write, workspace content edit, credential change or unrelated
  staging occurred.
- Fresh-eyes finding: source cleanup and deterministic tests cover the narrow scheduler contract but do not reproduce
  the installed workbench failure. The next unit must start with an installed-host CPU profile plus an isolated
  1,424-node close fixture before changing scheduler cancellation. Conditional/head-only workspace transfer is a
  separate evidence-backed performance improvement, not an assumed root-cause fix.

## CLOSE

- Status: `FAILED`. Exact packaging, inspection, installation, installed-byte parity and read-only rendered capability
  proof passed. The required installed Antigravity Bridge unsubscribe/close path reproduced a multi-minute renderer
  stall in two windows, so B115 W1 and Kimi R13 remain `PARTIAL` and no public release is permitted.
- Remaining risk: the owning call path is unresolved. Current estimate from observed stacks and source boundaries is
  60% Antigravity/workbench extension-host RPC processing, 20% root-App rerender interacting with the large
  workspace/DOM, 15% full-snapshot polling/allocation pressure as an amplifier, and 5% Bridge cancellation cleanup.
- Rollback remains the inspected local 0.0.63 package. No product byte was changed by this failed gate.
- Suggested commit title: `test(extension): record failed installed capability gate`

## AAR

- Triggers: the default staged probe stopped before its full matrix; live same-version install first failed on a locked
  extension directory; raw installed `package.json` differed through installer metadata; isolated-profile proof
  reached authentication onboarding; the normal-profile A/B reproduced a required UI failure; several Close actions
  produced Windows unresponsive dialogs. This is a non-clean Full-lane close.
- Sustain: preserve exact artifact/install hashes; use a second real renderer and distinct client/sidecar for A/B;
  keep unresponsive windows alive rather than choosing destructive reopen/close; distinguish host samples, extension
  host and sidecar PIDs before assigning cause.
- Improve work/approach: capture the installed-host CPU profile on the first reproduction and instrument the exact
  close/rerender boundary. An accessibility invocation that appears to close a panel is not a substitute for the
  direct rendered click when the defect is interaction-specific.
- Improve tools: Antigravity's unresponsive sample gives a minified workbench frame but no owning extension/RPC
  payload. Add Forge-side timing/payload instrumentation and a deterministic large-workspace fixture for the next
  unit; do not weaken the scheduler oracle.
- Highest-risk evidenced weakness: a 6.04 MB workspace is transferred and parsed every three seconds even when
  unchanged, creating approximately 2 MB/s of allocation pressure. Prove a head/hash conditional-fetch contract in
  isolation, then decide whether it belongs in the remediation after CPU-profile evidence.
- Project lesson banked here: a package/install gate that exposes a real host failure closes `FAILED`, even when every
  artifact and source test is green. No external AAR ledger was mutated under this repository-only checkpoint.
