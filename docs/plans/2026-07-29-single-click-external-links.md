# B103 — Single-click external links in the installed Forge

Status: VERIFIED 2026-07-29
Lane: FULL

## PLAN

- **Bounded unit:** make the credited X4 Unpacker and Forge Discord controls in Directory Settings open
  their exact external HTTPS destinations with one ordinary left click in the installed Antigravity/VS Code
  extension.
- **Assumptions:** the standalone browser may continue using normal anchors; the installed extension is the
  authoritative acceptance surface.
- **Authoritative references:** the existing `x4forge-studio` iframe-to-extension message bridge, the native
  host's platform URL launcher, and the two existing destination URLs.
- **In scope:** one narrow external-URL request type, exact URL allowlisting, button wiring, deterministic
  parser tests, packaged extension proof, and real installed-host click proof.
- **Out of scope:** a general-purpose arbitrary URL launcher, embedded browsing, downloads, Discord joining,
  Nexus authentication, or changes to unrelated native-editor messages.
- **Risks and authorization boundaries:** an unconstrained message could let framed content ask the host to
  open arbitrary schemes or URLs. The host must accept only the two exact HTTPS URLs. Opening each page during
  validation is user-authorized by this task; Forge must never open either automatically.
- **Rollback:** remove the request union/parser/handler and restore the two anchors. No persistent user or mod
  data is touched.
- **Acceptance:** ordinary left click sends exactly one bounded host request and opens the correct page; Ctrl is
  unnecessary; malformed, unlisted, non-HTTPS, and unrelated messages are refused; existing native file/diff/
  node messages remain green; controls stay understandable and keyboard accessible.
- **Required validation:** root typecheck/build; native bridge selftest including negative paths; focused
  Directory Settings browser test; packaged/staged probe; install into the existing Antigravity host; visually
  click both controls once and observe the correct external destinations.
- **Evidence:** command output in the task record and installed-host screenshots under
  `vscode-extension/evidence/`.

## BASELINE

- Candidate version: `0.0.53`; `x4-forge-studio-0.0.53.vsix` existed before this fix and must be rebuilt.
- Both controls are `<a target="_blank">` elements inside the backend iframe. The webview shell forwards only
  native file/diff/node messages, so Antigravity applies editor-link behavior and requires Ctrl-click.
- Existing dirty worktree contains authorized B83/B99/B100/B102/release work. Preserve it; this unit only
  touches the link controls, shared native bridge, host handler, tests, release text, and task records.

## RECONCILE

- **Existing capability reused:** `window.parent.postMessage` -> origin-checked webview shell ->
  `onDidReceiveMessage` -> `handleStudioMessage` already carries bounded Studio requests to the extension host.
- **Couplings checked:** browser request type, webview allowlist, host parser, host action, e2e role assertions,
  extension bridge selftest, package/release text.
- **Alternatives rejected:** `window.open` remains governed by the nested webview; relaxing sandbox/navigation
  policy broadens risk; keeping anchors preserves the reported Ctrl-click defect.
- **Capability-map delta:** Directory Settings now has an exact-allowlisted native external-link capability.
- **Plan change:** installed-host validation proved that `vscode.env.openExternal` still inserts Antigravity's
  trusted-domain confirmation, so the host action changed to the platform URL launcher (`rundll32` on Windows,
  `open` on macOS, `xdg-open` on Linux). The exact two-URL allowlist remains the security boundary.

## IMPLEMENT

- Added `openExternalUrlInNativeHost()` and exact constants for the X4 Unpacker and Forge Discord URLs.
- Routed ordinary anchor clicks through the existing origin-checked iframe message bridge.
- Added one `open-external-url` request to the extension bridge; both the webview shell and host parser accept
  only the two exact HTTPS strings.
- Added deterministic parser/launcher tests and a browser-host simulation that asserts one unmodified click
  sends exactly one request for each control.

## VALIDATE

- Native bridge selftest: 23/23 passed, including malformed, unlisted, and wrong-scheme rejection plus platform
  launcher selection.
- Focused Directory Settings e2e: both controls sent the exact host message on one ordinary click.
- Full isolated e2e: 32/32 passed, `[run-e2e] VERDICT: PASS`.
- Root typecheck/build, extension stage/build, VSIX package, staged probe 6/6, and precommit passed.
- Installed Antigravity 0.0.55: a normal left click opened the X4 Cat Suite Nexus page; a normal left click
  opened the `X4: Forge Studio` Discord invitation. No Ctrl key and no Antigravity confirmation prompt were
  involved. Evidence: `vscode-extension/evidence/0.0.55/single-click-x4-unpacker.jpg` and
  `single-click-discord.jpg`.
- Negative path: arbitrary URLs, non-HTTPS URLs, malformed messages, and unrelated message types are refused;
  neither page opens automatically.

## REVIEW

- Single-click behavior in the installed host: **done and visibly evidenced**.
- Exact destination and allowlist: **done and deterministically tested**.
- Existing file/diff/node bridge behavior: **done; bridge suite and full e2e green**.
- Keyboard semantics remain native anchor semantics: **done**.

## CLOSE

- **Status: VERIFIED.** Shipped publicly in OpenVSX `0.0.55`; the version-specific API returned the public
  artifact before commit.
- **Rollback:** remove the bounded request type/handler and restore ordinary anchors; no user data is involved.

## AAR

- **Sustain:** the real installed-host click was the deciding oracle; browser simulation alone would have missed
  the confirmation prompt.
- **Improve work/approach:** `vscode.env.openExternal` was assumed to satisfy one-click behavior but did not in
  Antigravity; the installed proof corrected the design.
- **Improve tools:** `explorer.exe` silently failed as a URL launcher in this host; `rundll32` was then directly
  proven. Same-version forced install also hit the live extension-folder lock, so the final candidate advanced to
  0.0.55.
- **Highest-risk weakness:** arbitrary native URL launch. The shipped exact-string allowlist limits the bridge to
  the two user-visible destinations.
