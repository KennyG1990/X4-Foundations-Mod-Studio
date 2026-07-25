# X4 Forge session handoff — 2026-07-25 release close

## One-line state

X4 Forge Studio 0.0.37 is publicly published, indexed as latest on OpenVSX, and byte-identical to the locally inspected stable VSIX. This handoff is part of the publish-before-commit release close; the final operation is commit/push plus `origin/main == HEAD` proof.

## Public release proof

- Extension: `x4forge.x4-forge-studio` 0.0.37, stable.
- OpenVSX exact-version timestamp: `2026-07-25T04:34:46.910747Z`; versions list returns 0.0.37 first.
- Public file: `https://open-vsx.org/api/x4forge/x4-forge-studio/0.0.37/file/x4forge.x4-forge-studio-0.0.37.vsix`.
- Local/public bytes: 17,809,845.
- Local/public SHA-256: `02168E41468979B46FF023BE9C15A9AA6C16DF546B084C5F44717EC9A2B933E0`.
- Full evidence: `vscode-extension/evidence/0.0.37-release-validation.md`.

## Shipped boundary

- B76's generic disk-backed artifact/CAT-DAT pipeline: arbitrary included files survive regardless of filename, extension, or size; unknown types default to byte-preserving source-copy.
- Build output is isolated under `.forge-builds`; explicit validated Deploy alone owns the installed-extension write boundary.
- Deterministic multi-volume CAT/DAT output is reopened and hash-verified, with activation rollback and explicit runtime-owned preservation.
- Browser import limits are not build limits. Oversized textual files that cannot receive semantic validation emit an explicit warning instead of a false-clean result.

## Release gates

- PASS `npm run precommit:check`, root production build, extension stage/build, staged sidecar probe 6/6, and stable VSIX packaging.
- PASS package inspection: 2,091 files; zero secret, config, runtime-state, source-map, evidence, test, or source-tree entries.
- PASS public artifact availability and exact SHA-256 parity.
- No real game, mod, or standing config directory was written during this release.

## Open hazard

- B77 remains `spec'd`: `graphify update .` can mutate tracked historical PNG evidence despite `*.png` ignore rules. The two affected 0.0.35 files are restored exactly in this release state; do not run graphify until B77 is fixed or the restoration is deliberately repeated.

## Operator queue

- Install/update X4 Forge Studio from OpenVSX in Antigravity, then reload the extension host if it does not refresh automatically.
- Commit question: this release close must be committed and pushed after publication; verify `origin/main == HEAD` rather than trusting push exit status.

## Commit point

Release close title: `chore(release): publish X4 Forge Studio 0.0.37`
