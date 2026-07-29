# X4 Forge session handoff — 2026-07-29 · B107 responsive shell VERIFIED / Open VSX 0.0.57

## One-line state

Open VSX 0.0.57 is public and byte-identical to the exact package installed and tested in a second Antigravity
window. B107 is VERIFIED: all 10 workspace destinations, 11 side tools, and 12 global actions are inventoried
by one normalized layout model; bars reorder, hide/reveal, collapse/restore, and dock; XML Patch has compact
panes; server-backed preferences survive the sidecar's dynamic-port host reload.

## Closed bounded unit

- Plan and evidence: `docs/plans/2026-07-29-lossless-responsive-studio-shell.md`.
- Public artifact: `x4forge.x4-forge-studio@0.0.57`, 17,804,853 bytes, SHA-256
  `EDD4D4FCAA787387418736E67986A7A19CC28BC32BA1108B80D8291D9B9A1759`.
- Installed screenshot: `vscode-extension/evidence/0.0.57/responsive-shell-installed-restart.png`.
- Ken's original Antigravity window ID 524990 remained open; validation used separate window ID 36112972.

## Validation close

- layout self-check 11/11; oracles 111/111; focused shell 9/9; full e2e 43/43 with structured PASS.
- typecheck, lint (0 errors), production build, extension stage/build, package audit, staged probe 6/6, and
  final `npm run precommit:check` PASS.
- installed host showed the distinct Meta icon, rail-owned Studio Settings, reordered tool inventory, bottom
  workspace dock, and right tool dock; all persisted after a real Antigravity reload and port 58650 -> 65072.
- Open VSX exact-version download hash equals the local installed/tested VSIX hash.

## Dirty baseline / ownership

Preserve unrelated modified `vscode-extension/evidence/0.0.35-runtime-copy-live.png` and
`vscode-extension/evidence/0.0.35-runtime-copy-startup.png`, untracked `KNOWN-BUGS.md`,
`KNOWN-BUGS.md.pre-audit-backup`, and `.tmp-b102-validation/`. They are not part of 0.0.57 and must remain
excluded from the release commit.

## Recovery residue

- A partial locked extension swap was moved, not deleted, to
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-partial-0.0.57-79ec68afb2804db988d39a3db00977a9`.
- The active installed extension was then restored from the exact final VSIX and its server bundle hash matched.

## AAR close

The installed-host check correctly falsified localStorage-only persistence across dynamic localhost origins.
Server-backed extension state fixed it. The expanded e2e suite outgrew the old four-minute shell ceiling; the
stable rerun passed 43/43. Antigravity CLI teardown and Windows sidecar locks remain tool/installer hazards, not
product regressions. Full lessons are in the project/global AAR ledgers.

## Next task

The B107 release commit/push is the only remaining close operation. After confirming `origin/main == HEAD`, the
next agent should select the next open backlog item; B98 remains the highest-ranked active item.
