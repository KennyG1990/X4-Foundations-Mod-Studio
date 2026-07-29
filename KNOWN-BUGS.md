# X4 Forge — Known Bugs (active defects only)

**Rule:** this file contains only current, observed defects. Fixed items move to `ROADMAP.md`; rejected,
stale, non-defect, and recommendation material is removed rather than retained as an apparent bug.

## Active defects

None currently recorded.

Kimi K3's 2026-07-29 findings were reconciled under B108. The confirmed defects have been repaired in the
0.0.58 release and passed their declared gates. The late-discovered legacy discovery-token migration defect
was also repaired: the rebuilt packaged server scrubbed the real legacy profile, then installed Antigravity
published only public address metadata and served the live sidecar API. OpenVSX 0.0.58 is public and its
downloaded VSIX hash matches the installed/tested artifact.

The full finding-by-finding disposition, acceptance contract, implementation record, and current evidence are
in `docs/plans/2026-07-29-known-bugs-hardening-release.md`.
