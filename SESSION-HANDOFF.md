# X4 Forge session handoff — 2026-07-29 · OpenVSX 0.0.55 verified

## One-line state

B102 lossless complex-mod graph projection and B103 single-click Directory Settings links are VERIFIED in the
installed Antigravity host and published as `x4forge.x4-forge-studio` 0.0.55. The release commit/push is the only
remaining close operation for this handoff.

## Closed acceptance evidence

- DeadAir Dynamic Wars: four MD files, 1,424 graph nodes, 1,420 links, 192 localized raw elements, zero whole-cue
  collapses, zero canonical mismatches, zero overlapping source spans, byte-identical no-edit round trip.
- AI Influence: 2,925 graph nodes and zero opaque top-level cues.
- Installed Antigravity: project preview, MD file selector, typed cue graph, typed selected-node native tab, and
  localized raw selected-node native tab were all inspected in the existing Forge window.
- Installed Antigravity: ordinary unmodified left clicks opened the X4 Unpacker Nexus page and Forge Discord;
  the exact host allowlist rejects any other URL.
- Focused contracts: node selection 15/15, imported layout 6/6, native external-link bridge 23/23.
- Full isolated e2e: 32/32 PASS, `[run-e2e] VERDICT: PASS`; ephemeral ports 3100/3101 stopped and live port 55060
  remained available.
- Runtime oracle: 109/111 within the sweep timeout; both aggregate timeouts passed directly with longer budgets
  (`api-selftest` six tests, `selftest` 10/10). `npm run precommit:check` PASS.
- Package: `vscode-extension/x4-forge-studio-0.0.55.vsix`, 17,789,755 bytes, 2,090 files, staged probe 6/6.
- Public release: `Published x4forge.x4-forge-studio v0.0.55`; version-specific cache-busted OpenVSX API returned
  version 0.0.55 with publication timestamp 2026-07-29 04:54:53.

## Evidence files

- `vscode-extension/evidence/0.0.55/deadair-project-preview.png`
- `vscode-extension/evidence/0.0.55/deadair-md-file-selector.png`
- `vscode-extension/evidence/0.0.55/deadair-typed-node-graph.png`
- `vscode-extension/evidence/0.0.55/deadair-node-native-editor.png`
- `vscode-extension/evidence/0.0.55/deadair-localized-raw-native-editor.png`
- `vscode-extension/evidence/0.0.55/directory-settings-links.jpg`
- `vscode-extension/evidence/0.0.55/single-click-x4-unpacker.jpg`
- `vscode-extension/evidence/0.0.55/single-click-discord.jpg`

## Honest residuals

- DeadAir's imported source currently reports six deterministic XSD findings. Inspection confirmed these are
  source/schema findings (for example an attribute not declared by the loaded XSD), not dropped nodes or a failed
  round trip. No in-game success claim is made for third-party source.
- Native `x4forge-node:` payloads remain memory-backed across extension-host restart; B101 remains the bounded
  descriptor-rehydration follow-up.
- The oracle sweep's two aggregate endpoints exceed its short per-request timeout; their direct long-timeout
  probes are green. This is harness observability debt, not a product failure.

## Commit question / dirty-scope warning

Commit the authorized 0.0.55 release unit with the pre-written comprehensive message, then push `main` and prove
`origin/main == HEAD`. Preserve unrelated `KNOWN-BUGS.md` and the two modified 0.0.35 evidence screenshots; do
not stage `.tmp-b102-validation/`. This handoff itself ships in that release commit.

## AAR outcome

Non-clean triggers and lessons are recorded in `F:\StarForge\wiki\x4-forge\aar-log.md` and
`F:\StarForge\wiki\workflow\aar-log.md`. The highest-risk evidenced weakness is that unsupported MD vocabulary
is lossless but visually weaker as localized raw nodes; promote common raw tags by corpus frequency without ever
removing the lossless escape hatch.
