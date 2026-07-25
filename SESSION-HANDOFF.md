# X4 Forge session handoff — 2026-07-25 B78 / 0.0.38 close

## One-line state

X4 Forge Studio 0.0.38 is implemented, installed in Antigravity, visually regression-proven, published stable on OpenVSX, and public/local hash-identical; the remaining close operation is commit/push plus `origin/main == HEAD` proof.

## What shipped

- Retained or restored `x4forge.studio` webviews are rebound to the authoritative backend session after extension-host or sidecar replacement.
- Backend identity includes URL, ownership, port, and token, so a reused port with a new credential refreshes once while unchanged sessions do not reload.
- Existing **Open Studio** now health-checks/rebinds before reveal.
- A `WebviewPanelSerializer` restores retained Studio panels; `onWebviewPanel:x4forge.studio` activates the extension for that path.

## Evidence

- Focused panel-binding selftest 5/5.
- Root typecheck/build and extension build/stage PASS.
- Staged sidecar probe 6/6.
- Root precommit PASS before release.
- Installed Antigravity displayed X4 Forge Studio v0.0.38.
- Retained Studio stayed fully rendered while the extension restart replaced managed sidecar port 56542 with 56203.
- OpenVSX stable 0.0.38 public/local VSIX: 17,810,331 bytes; SHA-256 `354622FC6A9F79F115129F2067EF2B5D13ACF77AB15C05E01603BFFFE19EA0C1`.
- Full evidence: `vscode-extension/evidence/0.0.38-stale-webview-validation.md`.

## Boundaries and hazards

- No real game directory, live mod, or standing Forge config was written.
- B77 remains open: do not run `graphify update .` until its historical-PNG mutation is fixed.
- OpenVSX public routes briefly lagged the successful publish response, then converged; do not republish merely because the first metadata read is 404.
- One byte-identical public VSIX copy remains in Windows Temp because the command-policy layer rejected its explicit removal. It is outside the repository and product install.

## Operator queue

- Commit and push the verified 0.0.38 release state.
- Assert the branch is attached and `origin/main == HEAD`; do not trust push exit status alone.

## Commit point

Release close title: `fix(extension): rebind retained Studio panels after sidecar restarts`.
