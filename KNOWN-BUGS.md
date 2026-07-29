# X4 Forge — Known Bugs (active defects only)

**Rule:** this file contains only current, observed defects. Fixed items move to `ROADMAP.md`; rejected,
stale, non-defect, and recommendation material is removed rather than retained as an apparent bug.

## Active defects

### Clean Quality runner exposed hidden host dependencies

The first public Quality run for 0.0.58 failed in Typecheck because the workflow installed only the root
lockfile while the root `tsconfig` also includes `vscode-extension/src`. A clean runner therefore lacked the
extension's `@types/vscode`; local validation was masked by an existing `vscode-extension/node_modules`. After
that correction made Typecheck and Lint pass, the second public run exposed three deterministic selftests that
read the developer's X4/schema configuration. The selftests now own synthetic expression, schema-reference, and
patch-base fixtures. An empty-profile reproduction passes 114/114. This remains active until the new public run
passes. The exact local Quality replay also caught an identical-content history rewrite storing a source-sized
unchanged diff; the diff helper now returns a bounded header and the 175/175 route gate proves 569-byte growth
instead of 336,041 bytes. The third public run passed through all 114 oracles, then proved the workflow ran routes
before producing their required Git-ignored `dist/server.cjs`; Quality now builds before the production-surface
route probe.

Kimi K3's 2026-07-29 findings were reconciled under B108. The confirmed defects have been repaired in the
0.0.58 release and passed their local/installed/public-artifact gates. The late-discovered legacy discovery-token migration defect
was also repaired: the rebuilt packaged server scrubbed the real legacy profile, then installed Antigravity
published only public address metadata and served the live sidecar API. OpenVSX 0.0.58 is public and its
downloaded VSIX hash matches the installed/tested artifact. Shipment is `PARTIAL` while the hermetic clean-runner
Quality correction is pending.

The full finding-by-finding disposition, acceptance contract, implementation record, and current evidence are
in `docs/plans/2026-07-29-known-bugs-hardening-release.md`.
