# Antigravity retained Studio webview rebind

**Task:** B78
**Lane:** FULL
**Status:** VERIFIED

## PLAN

- **Bounded unit:** make the X4 Forge Studio webview follow the currently healthy managed/attached backend across dead-backend replacement, manual reopen, and extension-host webview restoration.
- **Observed baseline:** public extension 0.0.37 is installed. Antigravity rendered a blank retained Studio panel labelled port 56784 while the status bar/logs reported a healthy managed sidecar on port 56542. Closing the Studio tab and invoking Open Studio rendered normally on 56542.
- **Root cause:** `autoRestartSidecar` is the only path that rewrites an existing panel. A concurrent `ensureBackend` caller can replace the backend first, bypassing that refresh; `openStudio` returns early for any existing panel; no `WebviewPanelSerializer` reclaims a retained panel after extension-host restoration.
- **Authority:** the reproduced installed UI/log state; `vscode-extension/src/extension.ts`; extension lifecycle contracts in the VS Code API; capability-map B41/B75 extension ownership; no conflicting ADR found.
- **In scope:** one backend-identity binding helper; central bind on every successful `ensureBackend`; health-check/rebind before revealing an existing panel; serializer for `x4forge.studio`; focused regression selftest; extension manifest activation for restored panels; rendered Antigravity proof.
- **Out of scope:** Forge app/server behavior, validation semantics, game/mod/config writes, B77 graphify repair, and unrelated stale declarative UI contributions.
- **Plan change (2026-07-25):** Ken explicitly authorized “drive the publish, install, commit.” Local Antigravity install, stable OpenVSX 0.0.38 publication, and the publish-before-commit close are now in scope.
- **Risks:** a refresh can discard unsaved in-webview transient state, but only when the backend identity changed and the old iframe is already disconnected from its authority. Accidental refresh loops are prevented by identity deduplication. No new network, credential, spending, delete, or game-write surface is introduced.
- **Rollback:** revert the bounded extension/helper/manifest changes; the current manual close/reopen workaround remains available.

## ACCEPTANCE CONTRACT

1. A panel bound to backend A is rendered once; repeated checks of A do not reload it.
2. Replacement by backend B, including the same URL with a different session token, reloads the panel exactly once.
3. `Open Studio` checks/rebinds an existing panel instead of only revealing it.
4. A restored `x4forge.studio` panel is registered, reclaimed, and rebound to a healthy backend.
5. Focused lifecycle selftest, extension/root typechecks, extension build, staged sidecar probe, and package inspection pass.
6. Negative path: unchanged backend identity produces no reload; backend failure remains an explicit error and never false-renders healthy.
7. Real Antigravity proof shows the panel badge and status bar on the same active port after a controlled backend restart/restore scenario.
8. OpenVSX serves the same 0.0.38 bytes validated locally; the exact published state is committed and pushed with `origin/main == HEAD`.

## EVIDENCE LOCATIONS

- Runtime transcript and rendered Computer Use observations.
- `vscode-extension/evidence/0.0.38-stale-webview-validation.md` if the fix reaches package-ready status.
- ROADMAP, SESSION-HANDOFF, capability-map delta, and project AAR at close.

## CLOSE

- **Final status:** VERIFIED.
- **Implementation:** the Studio panel now has an explicit backend-session identity, central rebinding after every successful backend ensure, health-check/rebind on an existing-panel open, and a `WebviewPanelSerializer` restore path activated by `onWebviewPanel:x4forge.studio`.
- **Negative path:** repeated binds to an unchanged backend identity do not reload; a new token on a reused port does reload; backend failures still surface explicitly.
- **Installed proof:** Antigravity visibly reported X4 Forge Studio v0.0.38. With the Studio tab retained across an extension restart, the managed sidecar changed from port 56542 to 56203 and the canvas remained rendered on the replacement backend.
- **Public proof:** OpenVSX accepted and indexed stable 0.0.38. The public and local VSIX files are both 17,810,331 bytes with SHA-256 `354622FC6A9F79F115129F2067EF2B5D13ACF77AB15C05E01603BFFFE19EA0C1`.
- **Deliberately unchanged:** server/app validation semantics, game/mod/config paths, and B77 graph tooling.
- **Capability-map delta:** retained/restored Studio panels now follow the authoritative backend session across extension and sidecar restarts.
- **Suggested commit title:** `fix(extension): rebind retained Studio panels after sidecar restarts`.
