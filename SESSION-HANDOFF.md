# X4 Forge session handoff

Updated: 2026-08-08

## One-line state

Stable X4 Forge Studio `0.0.66` is publicly downloadable with exact local/public archive parity and the new
outcome-led Details story, clearer real Features metadata, and six-bullet changelog. It is installed and rendered in
Antigravity with exact critical-file parity and the installed sidecar on `:57339`. W3B1a remains `VERIFIED` at `5/5`;
W3B1/W3 and the extension-native program remain `IN_PROGRESS / PARTIAL`. The next documented implementation unit is
W3B1b guarded filesystem/recovery receipt authority, but it was not started in this release task.

## Project and product boundary

- Repository: `F:\DEV_ENV\X4_Forge` on `main`.
- Product: the Antigravity/VS Code Forge extension, Studio webview, and extension-managed loopback sidecar.
- No standalone app, end-user CLI, alternate runtime, game/mod write, deploy, or W3B1b implementation belongs to
  this checkpoint.
- Standing quiet-machine permission for Antigravity validation remains active; do not ask again unless revoked.

## Current marketplace checkpoint

- Plan: `docs/plans/2026-08-08-openvsx-marketplace-story-refresh.md`.
- Evidence: `vscode-extension/evidence/0.0.66-marketplace-release-validation.md`.
- GitHub owner: `#38`; external trust follow-up `#39`; release-tooling follow-up `#40`.
- Pre-checkpoint repository parity:
  `HEAD == origin/main == 7729a9dea5a49ad76019ca1ca92abdc7b6c0f294`.
- Commit subject: `release: sharpen the X4 Forge marketplace story and publish 0.0.66`.
- Capability-map delta: none.

## Exact release proof

- Candidate: `vscode-extension/x4-forge-studio-0.0.66.vsix`.
- Entries/unpacked/archive: `2,091` / `61,507,076` / `18,113,327` bytes.
- SHA-256: `6B3A5C032976046EE2A44BB5F67BC205A61368146E77E8621116EC4B70526763`.
- Stable package, lock root/top, release notes, generated changelog, manifest, installed extension, exact/latest public
  API, rendered public version selector, and public download all report `0.0.66`.
- OpenVSX accepted the exact archive once. Public download size/hash and public README hash exactly match local.
- Public manifest has the new description, zero mojibake, and unchanged `10` commands / `8` settings / `1` view
  container / `1` view / `2` activation events.
- Public URL: `https://open-vsx.org/extension/x4forge/x4-forge-studio`.

## Installed proof

- Antigravity reports `x4forge.x4-forge-studio@0.0.66` and was reloaded.
- Rendered Details shows the new opening/workflow/capability/trust content; Features/Commands shows clarified existing
  titles; Changelog shows the six exact `0.0.66` bullets.
- Installed README, changelog, controller, and server hashes match candidate entries.
- Managed sidecar port `57339`, PID `51808`, executes installed `0.0.66/app/dist/server.cjs`.
- Standing `config.json` remains 478 bytes at SHA-256
  `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697`.
- Antigravity's extension-list/header summary remains an old cached gallery string; installed/public manifests and
  rendered Details are current. Do not use that cache as package authority.

## Validation

- Typecheck and product-copy checks pass.
- Extension build, root production build, fresh staging, stable packaging, package inspection, secret checks, and
  staged-app probe `16/16` pass.
- Changelog generation reports 54 versions, newest `0.0.66`, six ordered bullets, exactly one LF.
- First full precommit passed `[precommit] OK`, exit `0`, in 535.9 seconds. The final synchronized run after these
  close records also passed `[precommit] OK`, exit `0`, in 496.2 seconds; the commit hook repeats the gate against
  exact staging.
- Ephemeral ports `3100/3101` are closed; standing config and pre-existing test-results hashes are unchanged.

## Preserved unrelated dirty state

Never stage, revert, delete, or rewrite:

- `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`.
- `docs/plans/2026-08-02-w3b1-addressed-state-receipts.md` and the untracked parked
  `docs/plans/2026-08-07-w3b1b-guarded-filesystem-recovery-receipts.md`.
- Pre-existing deleted Discord/data files and `test-results/.last-run.json`.
- Existing modified `vscode-extension/evidence/0.0.35-*` and six untracked
  `vscode-extension/evidence/2026-07-31-r8-r17/*` screenshots.
- `.github/ISSUE_TEMPLATE/*`, `Note for Kimi.md`, and every other pre-existing owner path.

Use `git add -- <exact checkpoint paths>` only. Do not use broad add, clean, reset, checkout, or stash.

## Triggered AAR hazards

- Publisher acknowledgment is not public-download proof. The first `0.0.66` public window remained `404`; no
  republish occurred, and exact/latest/API/archive/rendered evidence was required after propagation.
- VSCE auto-links bare historical `#NN` text to GitHub, which can turn internal backlog numbers into false links;
  follow-up `#40` owns a deterministic guard.
- OpenVSX shows an unverified-namespace warning that weakens public trust; follow-up `#39` owns the claim process.
- Antigravity can cache stale gallery summary text across local installation and refresh. Verify installed manifest
  bytes and rendered README/Features instead.
- Short PowerShell probes should collect loop output in arrays; two direct loop-to-pipe forms failed to parse.
- The package inspector requires the VSIX positional argument even though the npm alias does not supply one.
- Highest remaining implementation risk is unchanged: W3B1b-d mutation owners still lack complete native receipt
  authority.

## Exact continuation

1. Stop this long session after the release commit point; do not begin another implementation unit here.
2. When Forge work resumes, reconcile the already specified W3B1b guarded filesystem/recovery unit, preserving all
   unrelated dirty state. The owner may instead return to mod development first; this checkpoint imposes no blocker.

## Eyeball queue

Empty. Installed Antigravity and public OpenVSX Details/Features/Changelog surfaces were directly inspected.
