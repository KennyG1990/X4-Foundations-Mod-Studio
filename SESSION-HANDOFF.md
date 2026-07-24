# SESSION-HANDOFF — X4 Forge B75 release candidate (2026-07-24)

## One-line state

B75 unified corpus intelligence is implemented and headless/corpus validated; 0.0.33 is packaged but NOT published, installed, committed, or pushed. Final status remains PARTIAL until e2e plus installed Antigravity visual proof.

## Project / authoritative plan

- Repo: `F:\DEV_ENV\X4_Forge`.
- Goal: one unpacked X4 root drives full discovery, canonical data, XSD grammar, typed expression completion/hover, validation, and effective diff simulation.
- Plan/design: `docs/plans/2026-07-24-unified-x4-corpus-intelligence.md` and `docs/plans/2026-07-24-unified-x4-corpus-intelligence-design.md`.
- Backlog: B75 `in_progress`. Do not move it to ROADMAP or claim VERIFIED yet.
- Current corpus: `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`.

## Implemented

- Persistent classified manifest: 1,028,384 files / 33,206,154,495 bytes; 154,140,672-byte v4 cache; 43.5 s full scan; generation refresh and DLC add/remove invalidation.
- Public read-only manifest/coverage/status plus Part 1 factions/wares/sectors/scriptproperties/file/search; authenticated completion, hover, and diff simulation.
- Ordered XSD particle engine with lazy DFA runtime; 544/544 authoritative MD/AI files, zero particle findings, 29.2 s.
- Typed expression AST + schema-driven project variable inference shared by completion, hover, and warning validation.
- Dependency-ordered base + all official `ego_dlc_*` overlays and read-only mod diff simulation with post-apply validation/baseline subtraction.
- Directory Settings primary corpus row, live coverage, Advanced XSD fallback, and credited Nexus X4 Unpacker recommendation (author z1ppeh; unofficial; no download/run).
- Extension capability broker for optional generic XML companions; Forge remains sole X4 semantic authority.

## Current green evidence

- `npm run typecheck`: PASS.
- `npm run lint`: 0 errors / 437 existing warnings.
- `npm run test:schema-intelligence`: 107/107 PASS.
- `npm run test:reference-api`: 53/53 PASS; real corpus; warm completion p95 2.9 ms.
- `npm run test:reference-corpus`: 10/10 PASS.
- manifest selftest 7/7; manifest API 16/16.
- oracle integration runtime index: 100/100 PASS.
- ordered XSD corpus: 544/544, zero findings, 29.2 s.
- official diff corpus: 176 files / 60 targets / 0 interpreter errors / 0 source mutations / 10.7 s. The 65 zero-match warnings are preserved selector-health evidence from official patches.
- root production build PASS; extension capability 6/6; staged product boot/auth/config/completion probe 6/6.
- A correctly ordered release artifact was produced at `vscode-extension\x4-forge-studio-0.0.33.vsix` (17.03 MB), but the subsequent testability-only `data-testid` addition means the final root-build → extension-build → stage → probe → package sequence must be rerun before publication.
- Focused rendered-settings contract added at `tests/e2e/reference-settings.spec.ts`; root typecheck PASS and Playwright discovery 1/1. It has not been executed yet.

## Important failures / AAR triggers

- Initial official-diff sweep timed out above 240 s. `sound_library.xml` reproduced at 101,091 ms; simple absolute-selector fast path reduced it to 1,352 ms.
- Official corpus proved multi-node `<replace>` and compact `or.=` semantics not represented accurately by the generic XPath/XSD assumptions; regression tests added.
- Fresh-eyes review caught byte-unbounded effective XML cache and inherited vanilla post-apply warnings; both fixed.
- Direct `oracle-sweep` failed because no server listened on :3001; isolated `test:oracles` is the valid 100/100 evidence.
- `reviewctl` skill path is stale/missing; no automated reviewctl evidence exists.
- First 0.0.33 package attempt staged an older root dist because the command ran from the extension directory. It is superseded by a fresh root build followed by rebuild/restage/probe/repackage.
- A task-log read used a nonexistent `-implementation.md` filename; the canonical implementation record is `docs/plans/2026-07-24-unified-x4-corpus-intelligence.md`.

## Machine gate / eyeball queue

Machine-state gate remains closed: passive check on 2026-07-24 found X4 PID 57972 and 16 Antigravity processes. Do not run full e2e or take over Antigravity until Ken confirms the machine is quiet. Current Playwright is isolated on ports 3100/3101 with a per-run state directory rather than the live workspace, but the validation-heavy operator gate still applies.

When safe:

1. Run `npm run test:e2e` once (workers=1); verify it used the ephemeral 3100/3101 stack and left the live 3000/3001 workspace untouched.
2. Rebuild root + extension, restage, rerun the 6/6 staged probe, and repackage 0.0.33 so the artifact exactly matches source; then run `npm run precommit:check`.
3. Publish-before-commit: publish the refreshed `vscode-extension\x4-forge-studio-0.0.33.vsix` with `ovsx`, verify Open VSX shows 0.0.33, then install/update that public version in Antigravity.
4. In Antigravity open X4 Forge → Directory Settings. Confirm no config-fetch error; corpus root is found; coverage shows the million-file inventory and consumer categories; X4 Unpacker link/description/z1ppeh credit sits beside the corpus row; manual XSD is Advanced fallback.
5. On a scratch MD file, request child completion under `<cue>` and see legal ordered children; type `faction.player.` and `$target.` after `<find_ship name="$target"/>`; hover `faction.player.id`/inherited `name`; confirm docs/types.
6. Validate controlled illegal child/enum/property/faction/ware/diff selector fixtures; confirm XSD errors vs suggestion-bearing warnings in Problems. Capture screenshots under `vscode-extension/evidence/`.
7. Check debug watcher `erroringCount=0`, then review acceptance 1–14, update capability map/ROADMAP/AAR/BACKLOG/handoff, commit and push only after publication.

## Commit / publish state

- No publication, installation, commit, or push has occurred for 0.0.33.
- Publish-before-commit is mandatory for this user-facing release.
- Suggested final commit title: `feat: unify X4 corpus intelligence and contextual validation`.
