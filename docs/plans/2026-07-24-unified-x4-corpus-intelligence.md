# Unified X4 Corpus Intelligence Implementation Plan
> **For Agent:** REQUIRED SUB-SKILL: Use `executing-plans`; return to `planning` if reconciliation changes this contract.

**Goal:** Make a single unpacked-X4 root automatically discover every file, classify what each can safely prove, and drive auditable X4-aware completion and validation through the Forge API and installed IDE extension.

**Architecture:** Extend the existing `referenceCorpus`/`schemaRegistry`/`referenceLanguage` path with a persistent generation-based manifest. Use the host IDE and optional XML extensions for generic editor capabilities while retaining Forge as the sole X4 semantic referee.

**Tech stack:** TypeScript, Node filesystem APIs, Express, existing XML/XSD models, VS Code extension APIs, React settings UI, current oracle/integration/e2e harnesses.

Task: B75 unified corpus intelligence
Lane: FULL
Status: VERIFIED 2026-07-24 — published and installed as OpenVSX 0.0.36

## PLAN

- **Bounded program:** Stage A delivers root discovery, manifest, coverage API/UI, derived schema/reference configuration, and IDE capability reporting. Stage B adds context-path XSD particle completion/validation. Stage C adds typed expression AST/project symbols and effective diff simulation. All stages share one manifest and evidence model.
- **Assumptions:** official `ego_dlc_*` directories participate in canonical effective data; arbitrary third-party extensions are examples/conflict inputs, never canonical truth; vanilla files are read-only; corpus counts vary by installed DLC/version and are reported, not hardcoded.
- **Authoritative references:** unpacked corpus, its XSDs and canonical XML; `F:\StarForge\wiki\x4-forge\decisions.md`; capability map; existing B73/B74 implementations and green harnesses.
- **In scope:** all filesystem entries in the manifest; deep semantic consumption for XSD/XML/MD/AI/scriptproperties/diff/high-value Lua APIs; asset existence metadata; coverage reporting; extension cooperation through standard APIs.
- **Out of scope:** parsing binary model/audio formats semantically; treating observed vanilla usage as a hard prohibition; allowing generic extensions or AI narration to determine Forge validity; writes to the corpus.
- **Risks:** million-file scan latency; stale generations; DLC precedence mistakes; false positives from schema-context flattening; conflicting IDE diagnostics; large state cache; regression of legacy schema harvest.
- **Rollback:** retain `xsdSchemaPath`, current reference APIs, and previous manifest generation; disable new manifest consumers without changing vanilla or mod data.

## ACCEPTANCE CONTRACT

1. Saving a valid unpacked root discovers all files recursively and returns a stable manifest generation without writing under that root.
2. On the current 9.00 snapshot, the inventory reports 1,028,384 total files, 9,884 XML, 88 XSD, 157 Lua, 849 JavaScript, and 1,422 TypeScript; tests use fixtures and do not hardcode these machine-specific totals.
3. Every manifest record has path, source, domain, role, authority, size/mtime, and consumer coverage; unsupported files remain visible.
4. Schema selection distinguishes 37 base-library schemas, five base shims/UI schemas, and 46 DLC copies/variants; it does not blindly flatten all 88.
5. One `x4ReferenceRoot` drives canonical references, schema discovery, script properties, routing, completion, hover, validation, and patch target lookup. Legacy harvested/override schemas still work when no unpacked root exists.
6. `GET /api/reference/manifest` exposes bounded/filterable metadata; `GET /api/reference/coverage` explains discovered/indexed/consumed/gap counts; status exposes scanning/ready/stale/error state and generation.
7. Directory Settings presents “X4 Unpacked Game Corpus” as primary, shows scan/coverage results, and moves the XSD folder into an advanced fallback explanation. Beside that input it recommends [X4 Unpacker](https://www.nexusmods.com/x4foundations/mods/2142) for users who do not yet have an unpacked root, explains that its GUI/CLI extract base and DLC catalogues with patch ordering, and visibly credits author **z1ppeh**. The recommendation is informational and never downloads or runs software.
8. The extension reports native and optional companion capabilities. Generic XML extensions may format/navigate or consume opt-in associations, but Forge remains the sole X4 diagnostic authority.
9. Context completion respects parent path, sequence/choice/all state, cardinality, and prior siblings; deterministic violations cite the governing particle.
10. Script completion/validation uses a typed expression AST and project symbol table for variables, keywords, properties/functions, arguments, and return-chain flow.
11. Diff validation resolves the target effective vanilla document, detects zero/multi-match selectors, applies add/replace/remove in memory, and validates the result without writing vanilla data.
12. Known-good representative vanilla files stay free of deterministic Forge errors; controlled mutations produce the expected severity, citation, location, and suggestion.
13. Existing `/api/fs/*`, project validation, import/mod-folder, debug-watcher, Part 1 APIs, legacy schema harvest, and extension lifecycle do not regress.
14. The public Open VSX version is installed in Antigravity and rendered completion, hover, coverage, diagnostics, and negative paths are visually verified on a scratch mod before final `VERIFIED` status.

## BASELINE

- Revision: `667782db2a29385c14fd3e9ea0868c04a10c3d37`.
- Worktree: existing uncommitted B73/B74/release/docs changes; preserve all.
- Existing capability: B73 canonical references and B74 schema intelligence converge in `referenceLanguage.ts`; 78/78 focused, 40/40 API, 100/100 oracles, p95 2.9 ms, build/precommit green before this program.
- Existing gap: reference corpus enumerates only selected high-value files; no all-file manifest/coverage; UI presents corpus and XSD as separate primary inputs; schema index unions same-name contextual declarations; expression parsing is chain-aware but not a complete AST; patch diagnostics do not simulate the full effective overlay.
- Machine state: X4 and Antigravity were active during the previous gate. No workspace-swapping e2e or game-directory write is permitted until a fresh machine-state gate.

## RECONCILE

- **Resources searched:** `referenceCorpus`, `schemaRegistry`, `xsdParser`, `referenceLanguage`, project/validation/reference routes, Directory Settings, extension providers, XML associations, object index, override/patch diagnostics, capability map, ADRs, Agent Brain.
- **Existing infrastructure reused:** root config, official-DLC filtering, signature caches, schema include resolution, canonical sets, expression types, provider transport, diagnostics collection, XML association opt-in, background object-index precedent.
- **Couplings:** server config ↔ UI; manifest ↔ registry/corpus; registry ↔ completion/validation; extension token/sidecar ↔ POST endpoints; optional XML extensions ↔ associations; patch targets ↔ effective corpus.
- **Capability-map delta:** required at close.
- **Plan decision:** extend one engine; no parallel scanner service; no external extension becomes semantic authority.

## IMPLEMENTATION TASKS

### Task 1: Persistent classified manifest

**Files:** create `src/lib/referenceManifest.ts`; create `scripts/reference-manifest-check.ts`; modify `src/lib/db.ts`, `package.json`.

1. Write synthetic fixture tests for all-file discovery, roles, official-DLC provenance, add/remove/change invalidation, stale-last-good behavior, traversal safety, and bounded scan cost.
2. Implement generation records and fast classification without reading binary bodies; write bounded SQLite transactions and yield between scan batches so requests remain responsive.
3. Persist the indexed cache beneath Forge data/state, never beneath the corpus; serve only complete generations and retain the previous generation during refresh. If SQLite is unavailable, preserve legacy targeted consumers and report manifest coverage as degraded.
4. Validate synthetic fixtures and the real root inventory.

### Task 2: Make existing consumers manifest-driven

**Files:** modify `src/lib/referenceCorpus.ts`, `src/lib/schemaRegistry.ts`, `src/lib/xsdParser.ts`, `src/lib/referenceLanguage.ts`, `src/server/projectValidation.ts`, `src/server/validationRoutes.ts`.

1. Replace separate file walks with manifest queries.
2. Encode schema role/precedence and expose variants without blindly unioning them.
3. Preserve legacy harvested-schema fallback.
4. Re-run B73/B74 focused and real-corpus gates.

### Task 3: Manifest and coverage API

**Files:** modify `src/server/referenceRoutes.ts`, `server.ts`; create/extend API integration checks.

1. Add bounded filter/pagination for `/manifest` and aggregate `/coverage`.
2. Extend `/status` with scan state, generation, stale/error information, and consumer counts.
3. Prove auth/public-read policy, traversal rejection, unavailable root, refresh, and no unbounded response.

### Task 4: One-root settings experience

**Files:** modify `src/components/DirectorySettingsModal.tsx`; extend component/e2e coverage.

1. Rename the primary field and derive schema health from corpus coverage.
2. Move manual XSD path into an Advanced fallback block.
3. Render scan progress, categorized counts, consumed coverage, and gaps without claiming unsupported assets are validated.
4. Verify keyboard/accessibility states and real rendered behavior.
5. Render the credited X4 Unpacker recommendation near the corpus/schema controls, with an external link that opens through the host browser and does not imply Egosoft affiliation.

### Task 5: IDE capability broker

**Files:** create `vscode-extension/src/capabilities.ts`; modify `vscode-extension/src/extension.ts`, `vscode-extension/package.json`, `vscode-extension/src/modFolder.ts` and selftests.

1. Detect native provider availability and optional XML companion extension presence.
2. Report capabilities in X4 Forge output/status without a hard dependency.
3. Keep XML associations opt-in and manifest-selected; prevent duplicate X4 semantic diagnostics.
4. Prove operation with and without a companion XML extension.

### Task 6: Context-path XSD particle engine

**Files:** modify `src/lib/xsdValidate.ts`, `src/lib/referenceLanguage.ts`; extend focused mutation checks.

1. Compile sequence/choice/all/group/cardinality particles per context path.
2. Drive completion from the cursor's particle state and remaining legal transitions.
3. Emit deterministic order/cardinality diagnostics with XSD citations.
4. Run representative vanilla zero-error and mutation suites before enabling strictness.

### Task 7: Typed expressions and project symbols

**Files:** create `src/lib/expressionAst.ts`, `src/lib/projectSymbols.ts`; modify expression/reference language and project validation modules.

1. Parse expressions into AST nodes with spans.
2. Resolve keyword/dynamic ID/property/function/argument/return types and local/project variables.
3. Use the same results for completion, hover, warning diagnostics, and quick fixes.
4. Prove chained faction/object examples and negative property/function/reference mutations.

### Task 8: Effective diff simulator

**Files:** create `src/lib/referenceOverlay.ts`, `src/lib/diffSimulator.ts`; modify patch diagnostics/project validation.

1. Build effective target documents from base plus ordered official DLC diffs.
2. Evaluate mod selectors and report zero/multi matches.
3. Apply add/replace/remove in memory and schema-validate the result.
4. Prove corpus remains read-only and fixture rollback is exact.

### Task 9: Coverage/mutation certification and installed release

**Files:** extend oracle/integration/e2e/evidence scripts; update ROADMAP, BACKLOG, SESSION-HANDOFF, capability map, AAR ledgers, release notes/version.

1. Run type, lint, focused, API, oracle, real-corpus, negative, build, packaging, and graph gates.
2. Run the machine-state gate before full e2e.
3. Publish the stable Open VSX artifact, update Antigravity, and visually validate the scratch workflow.
4. Review every acceptance item and close only with evidence; otherwise retain the goal as active/PARTIAL.

## VALIDATION METHODS

- Static: `npm run typecheck`, extension typecheck, lint, precommit.
- Focused: manifest, schema intelligence, reference corpus/API, routes, oracle sweep.
- Real corpus: exact inventory generation, schema variant/provenance, representative vanilla zero-error corpus sweep, latency/memory.
- Negative: missing root, unreadable file, mutation during scan, DLC add/remove, traversal, malformed XML/XSD, invalid particle transition, bad expression, zero/multi diff selector.
- Runtime/UI: isolated backend + scratch mod; Directory Settings rendered coverage; installed Antigravity completion/hover/Problems; optional XML companion present/absent.
- Evidence: command summaries, JSON manifest/coverage snapshots, screenshots under `vscode-extension/evidence/`, durable project/workflow records.

## AAR STATUS

- Triggered at specification: prior PowerShell inventory attempts failed; the stable metadata inventory then exposed million-file scan cost and XSD duplicate/variant structure. Use a file-backed manifest harness for all further corpus scans.

## IMPLEMENTATION CHECKPOINTS

### Batch 1 — Task 1 manifest foundation

- Added SQLite generation/file tables and bounded indexed queries in `src/lib/db.ts`.
- Added `src/lib/referenceManifest.ts`: read-only async inventory, source/domain/role/authority/consumer classification, XSD-only hashing, generation swap, stale-last-good semantics, status/query/coverage APIs, and synthetic selftest.
- Added `scripts/reference-manifest-check.ts` and `npm run test:reference-manifest`.
- Verification: manifest selftest 7/7 PASS; `npm run typecheck` PASS.
- No vanilla/game/mod/config writes. Real million-file manifest scan intentionally deferred until the API/status path can expose progress and avoid an opaque long-running command.

### Batch 2 — Tasks 2–3 manifest consumers and HTTP surface

- Existing reference-corpus and schema-registry consumers now use complete manifest generations with bounded legacy fallback.
- Added bounded public read-only `/api/reference/manifest` and `/api/reference/coverage`; extended status/config responses with scan/generation state.
- Verification: manifest HTTP integration 16/16 PASS, including public access, response cap, source provenance, base-schema selection, stale-last-good reads, and DLC add/remove refresh; reference corpus 10/10 PASS; schema intelligence 78/78 PASS.

### Batch 3 — authoritative-root performance and storage correction

- Real 9.00 inventory reproduced exactly at 1,028,384 files / 33,206,154,495 bytes.
- The first compact-layout gate failed at 610 MB because two complete generations were retained and pathname/category indexes duplicated million-row data. The v4 layout now retains only the new complete generation, keys the file table by `(generation, path)` without a rowid, and normalizes classification tuples.
- Verification: v3→v4 migration + full scan PASS in 43.5 s; cache measured 154,140,672 bytes; exactly one ready generation with 1,028,384 records; typecheck PASS; manifest 7/7 PASS; HTTP integration 16/16 PASS.
- AAR triggers: initial real-scan parent timeout left its child completing independently; page-level SQLite evidence was used before redesign. Do not run real manifest harnesses concurrently against the application cache.

### Batch 4 — ordered XSD particles and performance replan

- Preserved sequence/choice/all/group/cardinality models now remain separate across same-name contextual element declarations. Completion consumes prior sibling state; strict validation emits cited `XSD_CHILD_ORDER` and `XSD_CHILD_CARDINALITY` errors.
- Focused schema intelligence: 83/83 PASS. Real reference/API integration: 43/43 PASS, including `<cue>` completion before/after `conditions` and `actions`, real `faction.id`, 32 canonical faction references, and a cited illegal-order mutation.
- Cry-wolf corpus: all 544 base/official-DLC MD and AI-script XML files produced zero particle findings.
- Performance failure/replan: the original full sweep timed out above 240 s. Instrumentation attributed a 1.59 MB file as 14.6 ms tag scan, 23.1 ms attribute work, and 6,732.7 ms particle replay. Incremental XML/NFA cursors reduced the full sweep to 73.7 s; bounded transition memoization reached 66.6 s, still above the declared 60 s gate.
- Extend-versus-replace decision: stop tuning the epsilon-NFA interpreter. Replace its runtime traversal with lazy DFA subset construction, preserving the particle tree and accepted language while materializing each reached state/token transition once across the corpus. Rerun 83 focused checks, 43 API checks, and the identical 544-file/zero-finding/<60 s gate.

### Batch 5 — settings, coverage, IDE cooperation, and typed expressions

- Directory Settings now treats “X4 Unpacked Game Corpus” as the primary read-only root, renders manifest coverage/consumer gaps, derives schema discovery from that root, and keeps the manual XSD directory under an Advanced fallback.
- The corpus row recommends [X4 Unpacker](https://www.nexusmods.com/x4foundations/mods/2142), describes GUI/CLI base+DLC extraction, credits author z1ppeh, labels it unofficial, and never downloads or executes it.
- The extension capability broker reports native completion/hover/diagnostics plus detected generic XML companions while keeping Forge as the only X4 semantic authority; selftest 6/6 PASS.
- Span-preserving expression AST and schema-driven project symbols now infer variables such as `<find_ship name="$target"/>` as `ship`; completion, hover, and warning diagnostics share the same return-type chain.
- Verification: schema intelligence 93/93 before the diff layer; reference API 45/45; warm completion p95 3.4 ms.

### Batch 6 — effective DLC overlay and mod diff simulation

- Added a dependency-ordered official-DLC resolver using each `ego_dlc_*` `content.xml`; arbitrary community extensions remain excluded from canonical state.
- Added a read-only X4 diff interpreter supporting add/replace/remove, attributes, before/after/prepend, conditions/silent operations, multiple selector matches, comment/attribute targets, multi-node replacement, and the corpus-proven compact `or.=` token form.
- Added authenticated `POST /api/reference/simulate-diff` and integrated the same engine into project validation. Post-apply validation subtracts baseline vanilla findings so a mod receives only diagnostics it introduced.
- Effective XML caching is signature-invalidated and bounded to 64 entries / 64 MiB; oversized documents are returned but not retained.
- The first full official sweep timed out above 240 s. Profiling reproduced `libraries/sound_library.xml` at 101,091 ms; an exact fast path for simple absolute/id/attribute selectors reduced it to 1,352 ms without changing fallback XPath semantics.
- Verification: 176 official DLC diff files / 60 unique targets / 0 interpreter errors / 0 source mutations / 9.8–10.7 s; 65 selector-health warnings and 19 conditional skips remain visible. Focused schema intelligence 107/107 and real API 53/53 PASS.

### Batch 7 — review and release candidate

- Fresh-eyes review found and fixed unbounded effective-document memory retention and inherited-vanilla post-apply warnings.
- Root typecheck PASS; lint 0 errors (437 baseline warnings); reference corpus 10/10; manifest 7/7; manifest API 16/16; runtime oracle index 100/100; ordered-particle corpus 544/544 with zero findings in 29.2 s; production build PASS.
- Version 0.0.33 release notes are generated. The correctly ordered root-build → extension-build → fresh-stage → isolated-probe → VSIX pipeline produced `vscode-extension/x4-forge-studio-0.0.33.vsix`; staged product probe 6/6 PASS.
- Remaining required gates: full e2e after machine-state confirmation; publish 0.0.33 to Open VSX; update Antigravity; visually prove settings/coverage/recommendation, completion, hover, and Problems diagnostics; then final review/docs/AAR/commit/push.

### Batch 8 — rendered-settings contract reconciliation

- Reconciliation found no existing Playwright coverage for the Directory Settings corpus surface. Added stable test identifiers for the corpus and manual-XSD rows plus `tests/e2e/reference-settings.spec.ts`.
- The new non-mutating contract covers authenticated config load without the old error banner, the one-root value, categorized million-file coverage, X4 Unpacker link security, z1ppeh credit, and the collapsed/expanded Advanced XSD fallback.
- Static proof: root typecheck PASS; Playwright discovery lists exactly 1 test in the focused spec. Runtime execution remains deliberately pending because X4 PID 57972 and Antigravity are active and the operator machine-state gate has not cleared.
- Because the stable test hooks touch the shipped React source, the previously green 0.0.33 VSIX is now a superseded release-candidate artifact. The final build/stage/probe/package sequence must be rerun after e2e and before publication.
- Reconciliation correction: the current e2e harness is isolated on ports 3100/3101 with a per-run state directory; it does not swap the live 3000/3001 workspace. The stricter machine-state ask remains in force for this validation-heavy run.
- AAR trigger: an attempted task-log read used a nonexistent `-implementation.md` suffix; the canonical implementation record is this file.

### Batch 9 — installed-game detection and path-role safety (RECONCILED CORRECTION IN PROGRESS)

**Reconciled baseline:** `GET /api/agent/detect-game` already finds the current Steam install and returns a proposal. The first-run wizard consumes it, but Directory Settings does not. The proposal currently sets `modWorkspacePath` to `C:\\Users\\<user>\\Documents\\X4ForgeMods` while setting the general `filesystemPath` to the live game `extensions` directory. The current persisted config was read-only reproduced with `modWorkspacePath` equal to `G:\\SteamLibrary\\steamapps\\common\\X4 Foundations\\extensions`; the server accepts this and has no central runtime development-root guard. X4 was not running; Antigravity and a source-dev server on PID 40040 were active. No config/game/mod write was performed.

**Bounded unit:** reuse installed-game detection in Directory Settings, propose the isolated development workspace and deployed extensions filesystem as distinct roles, and enforce that only the workspace is an editable development root while generic filesystem writes remain blocked against protected live/corpus trees.

**In scope:** Steam/GOG detection reuse; explicit Detect control; non-destructive auto-fill when game path is empty; distinct workspace/deployed-filesystem path validation; blocking unsafe mod workspace roots and generic live-filesystem mutations; correct proposal copy; API/UI/runtime negative paths; first-run copy correction; installed scratch-workspace proof; a professional external X4 Forge Discord community/support card.

**Out of scope:** scanning whole drives; automatic unpacking; moving or deleting the user's existing live mod; silently changing standing config; changing explicit deploy's destination; requiring Git; adding Epic detection without an authoritative installed-app source.

**Risks and rollback:** false containment decisions, junction/symlink bypass, saved-config incompatibility, and deploy regression. The change is additive and can be rolled back by removing the path-role validator/UI detector while preserving all stored files. Tests use temp roots only. The real game, corpus, and mod remain read-only during implementation and validation.

**Acceptance:**

15. With an empty game field, Directory Settings detects an unambiguous Steam/GOG install and visibly identifies its source; an existing manual path is not overwritten.
16. The automatic proposal sets `modWorkspacePath` to the isolated `Documents\\X4ForgeMods` root and `filesystemPath` to the detected game's `extensions` folder.
17. Config save accepts the deployed extensions folder as `filesystemPath`, rejects `modWorkspacePath` equal to or nested under the game/corpus tree, and accepts a safe workspace sibling/temp root.
18. Runtime staging/snapshot/release chokepoints reject an already-persisted unsafe workspace. Generic filesystem write/create/delete operations reject protected live-game/corpus roots even though those roots are valid for read/browse/import. Explicit validated Deploy remains the only live-extension write path.
19. Installed Antigravity proof runs from a scratch development workspace, uses the packaged managed sidecar rather than the source-dev server, and leaves the real game/corpus/mod unchanged.
20. Directory Settings presents an external Community & Support link to `https://discord.gg/9qvAvtXqWP` inviting Forge questions, mod sharing, workflow discussion, and contact with other mod authors; it does not open automatically or imply Egosoft affiliation.

**Validation:** pure path-role/protected-write/game-detect selftests; route integration for unsafe workspace, accepted deployed filesystem, rejected direct live mutation, and safe workspace writes; focused UI e2e for auto-fill, no-overwrite, correct role copy, safe save, and the Discord link contract; typecheck/lint/oracles/full e2e/build/package/precommit; installed visual proof and a negative Problems/config path. Evidence remains under `vscode-extension/evidence/` and the durable close records.

**Reconciliation correction (2026-07-24):** review of `computeModDrift()` and the import/list/read call sites reproduced that `filesystemPath` is the deployed extensions root, not a second development root. The earlier Batch 9 assumption was wrong and would break the workspace/deployed contract. This forced reimplementation before installed proof; no standing config or game/mod file was written under the incorrect contract.

**Implementation checkpoint:**

- Added `src/lib/pathRoles.ts`: case/separator normalization, existing-ancestor realpath/junction resolution, installed-game marker validation, protected-root overlap decisions, and a shared 12/12 oracle.
- Reused the Steam/GOG detector in Directory Settings. Empty game paths auto-fill without overwriting manual values; the explicit Detect action repairs legacy unsafe paths. Automatic proposals now set both editable roots to `Documents\\X4ForgeMods`.
- `POST /api/schema/config` rejects unsafe roles before persistence. Existing unsafe configs are also blocked at filesystem writes/creates/deletes, snapshot operations, staging deploys, deploy-verify, and releases. Strict child containment now rejects snapshot traversal and junction escapes.
- Directory Settings explains the development-vs-live boundary and adds the requested external X4 Forge Discord Community & Support card (`https://discord.gg/9qvAvtXqWP`). First-run copy now distinguishes dev workspace/file explorer from explicit deploy target.
- Review caught the junction/snapshot containment gap and forced the correction above. Focused proof: path roles 12/12; game detection 11/11; routes 28/28; rendered settings 3/3; typecheck PASS; lint 0 errors / exact 437-warning baseline; oracles 101/101; reference corpus 10/10; schema intelligence 107/107; reference API 53/53; manifest 7/7; manifest API 16/16; XSD corpus 544/544 zero findings in 24.6 s; diff corpus 176 files / 60 targets / zero interpreter errors or source mutations in 10.0 s; full e2e 22/22; build, staged probe 6/6, package, graph update, and precommit PASS.
- Validation-infrastructure AAR: Playwright claimed a split ephemeral stack but omitted `API_ONLY=true`, so its API process started a second Vite/HMR server and collided with the active dev server on port 24678 after the first focused test. `playwright.config.ts` now enforces API-only mode; focused 3/3 and full 22/22 then passed, with 3100/3101 released.
- Version 0.0.34 was packaged and `ovsx publish` returned success. Open VSX version indexing was still pending at the immediate verification poll; installed-marketplace and Antigravity rendered proof remain required before close.

### Batch 10 — 0.0.35 product-copy cleanup and release blockers (IN PROGRESS)

- Removed project-specific runtime identity and mod promotion from shipped Startup Walkaround/live telemetry copy while preserving the optional generic bridge response fields and routes. Added health-card/bridge-state oracle assertions, a shipped-source/packaged-content guard, and rendered Playwright coverage.
- Focused proof: health-card 10/10; bridge-state 8/8; shipped source 0 banned mentions; root + extension typechecks PASS; lint 0 errors / 437 baseline warnings; rendered product-copy 1/1; runtime oracles 101/101.
- Full e2e: 21/23. The new product-copy contract passed. Two pre-existing release blockers reproduced: Startup Walkaround `z-[9998]` intercepts Directory Settings' Save Paths button; late-suite Diff→Patch does not render the expected synthesized confirmation. These must be root-caused and corrected before build/package/installed proof. Tests may not be skipped or weakened.
- Release staging guard caught tracked validation fixtures from `public/` being copied by Vite into `dist/` and then recursively packaged by `stage-app`; one contained the removed identity and real mod source. Correct by isolating legitimate public assets and allowlisting staged build outputs, then rerun the entire artifact chain and payload scan.

### Batch 11 — continuous authoritative validation during authoring (SPECIFIED 2026-07-24)

#### PLAN

- **Bounded unit:** remove the manual IDE validation command and make the existing live authoring paths continuously run the full `runProjectValidation` stack over the current generated/file project.
- **Assumptions:** the cached corpus/schema indexes keep warm validation within interactive latency; deterministic errors remain blocking/red while semantic unknowns remain advisory/amber; no validator may silently rewrite user text.
- **Authoritative references:** Ken's corrected interaction contract; `runProjectValidation`; the configured unpacked X4 corpus and XSD graph; ADR-F2's lowest-barrier editor requirement; the one-referee diagnostic design already used by `/api/agent/project/validate`.
- **In scope:** `/api/agent/compile` full-stack parity; deduplicated diagnostics; debounced/cancellable App requests; CodeMirror red/amber inline diagnostics and hover text; selected-node/raw-XML feedback; automatic IDE validation on mod open, XML/Lua change, and save; removal of `x4forge.validateModFolder` and its setting/copy.
- **Out of scope:** automatic mutation/correction of authored text; weakening warnings/errors; standalone LSP; deployment/runtime/experience proof; validation of unrelated workspace folders without an X4 `content.xml` root.
- **Reconciled infrastructure reused:** `buildWorkspaceFileManifest`, `runModDoctor`, `runPatchDiagnostics`, `runProjectValidation`, `flattenProjectValidation`, App's debounced `/api/agent/compile` polling, Canvas/Diagnostics/Readiness shared diagnostic props, CodeMirror 6, and the extension Problems collection.
- **Rejected alternatives:** a new live-only endpoint would create another validation truth; client-side XSD/reference validation would duplicate server authority; retaining the manual command would preserve a misleading workflow.
- **Risks:** full diff/schema work on rapid edits, stale responses painting old errors, duplicate findings from Doctor/project layers, inaccurate file/line projection, and extension scans reading too broad a tree. Mitigations are debounce + abort/sequence guards, cached indexes, stable diagnostic dedupe keys, exact mod-root discovery, a 2,000-file bound matching the server, and no filesystem writes.
- **Authorization/rollback:** source/test/docs changes only; no vanilla, installed mod, standing config, publish, or deploy writes during implementation. Roll back by restoring the old compile composition, CodeMirror props, and extension contribution/listener block.

#### ACCEPTANCE CONTRACT

21. The extension launcher and command palette contain no **Validate Mod Folder** action and no `x4forge.modFolder` validation setting.
22. Opening an X4 mod, opening an XML/Lua file, changing an unsaved XML/Lua buffer, and saving it automatically refresh the full mod's Problems diagnostics without a manual first run.
23. Unsaved-buffer validation includes all supported files under the detected mod root (bounded at 2,000), not the previous depth-3/80-file subset.
24. Canvas/workspace edits debounce into `/api/agent/compile`, which runs `runProjectValidation` with canonical reference sets plus Doctor/patch checks and returns one deduplicated diagnostic list.
25. A bad XSD child/attribute/enum is an error; an unknown faction/ware/script property is a warning with its existing suggestion. Both appear in Diagnostics/Readiness; applicable generated-code lines receive CodeMirror error/warning underlines and hover messages.
26. Node/raw-XML authoring remains uninterrupted: no modal, no forced correction, no focus theft, and no validation-triggered write. Deterministic one-click fixes remain explicit and checkpointed.
27. A slower obsolete response cannot replace results for newer text/workspace state. Backend/corpus unavailability is shown honestly as unavailable/local fallback, never green full validation.
28. The built-in AI loop, external `project/validate`, deploy preflight, and automatic authoring checks continue to consume the same project-validation engine; `/api/agent/compile` is no longer the narrower exception.

### Post-release non-destructive repository cleanup addendum (Ken, 2026-07-24)

This phase begins only after the continuous-validation release is fully validated, installed in Antigravity, published to OpenVSX, and marketplace-probed.

- Inventory candidates through package/build scripts, imports, Git status, generated-output conventions, and reference searches before deletion.
- Move disposable or uncertain artifacts into a dated recovery/quarantine location with a path manifest; permanently erase nothing.
- Reproducible caches/build output may be cleared only after its regeneration command has passed and its original path is recorded.
- Do **not** classify maintained regression tests, oracle scripts, or required fixtures as junk: they are part of Forge's failure-prevention system.
- Record every moved/cleared path, its recovery location or regeneration command, and whether Git also retains it.
- Re-run typecheck, production build, oracle sweep, focused route tests, extension build/package probe, and the product-copy guard after cleanup.
- Preserve ambiguous candidates for human review rather than guessing destructively.

#### REQUIRED VALIDATION

- Static: root and extension typechecks; lint; package-manifest/contribution assertion that the removed command is absent.
- Focused: compile-route fixture proves full-stack-only findings reach the live response and duplicates collapse; debounce/stale-response helper oracle; CodeMirror diagnostic conversion/range negative cases.
- Integration: real configured corpus with controlled invalid child, faction, ware, and property; clean fixture returns zero blocking errors; schema/corpus-unavailable response is not falsely labelled full/clean.
- Negative: traversal/unrelated folders remain excluded; >2,000 IDE files are bounded; a superseded request cannot paint stale diagnostics; warnings do not block typing or mutate content.
- UI: scratch canvas raw-XML edit visibly produces/removes a red inline diagnostic after debounce; IDE scratch XML produces/removes a Problems/squiggle diagnostic without the removed button; warnings render amber and remain non-modal.
- Regression: oracle sweep, full e2e, production build, staged extension probe/package, installed Antigravity proof when the machine-state gate is clear.
- **Evidence:** focused command output and JSON under the task record; screenshots under `vscode-extension/evidence/`; close delta in capability map/ROADMAP/AAR/handoff.

#### BASELINE / RECONCILE

- Baseline revision: `9af72cc99dc4abff07224d85c70c2c0dd407551f`; the worktree already contains the active B75/product-copy changes listed in `SESSION-HANDOFF.md` and `git status`; they are preserved.
- Current App authoring runs `validateModWorkspace` immediately and the narrower `/api/agent/compile` after 400 ms. Canvas separately runs node-schema and workspace-law checks. CodePreview receives those diagnostics but CodeMirror itself has no lint extension.
- Current IDE behavior runs full inline project validation only after an XML change, scans at most 80 files/depth 3, requires an already-owned sidecar, and retains a manual command plus save-after-manual state (`lastValidated`). It does not validate Lua changes or automatically validate on initial open.
- Capability-map delta required: full corpus validation becomes an always-on authoring capability rather than a manual/API-only capability.
- Plan changed after Ken explicitly rejected the manual button and required typo-style continuous diagnostics. This Batch supersedes any prior acceptance language retaining that command.

## IMPLEMENT / VALIDATE / REVIEW / CLOSE

- **Implemented:** one-root manifest/reference/schema/diff engine; official-DLC overlay; path-contained raw reference file API; XSD particle model with transitive include/import resolution; typed script-expression completion/hover; shared reference/XSD/expression validation; continuous unsaved-buffer validation in app and IDE; path-role protection; Directory Settings corpus/unpacker/Discord guidance; generic runtime-integration copy; public extension version 0.0.36.
- **Validation:** typecheck PASS; lint 0 errors; routes 37/37; oracles 101/101; reference corpus 10/10; schema intelligence 107/107; reference API 53/53; manifest 7/7; manifest API 16/16; XSD particle corpus 544/544; official DLC diffs 176 files/60 targets/0 errors/0 source mutations; full e2e 24/24; production build; extension build; staged probe 6/6; product-copy guard; precommit PASS.
- **Negative paths:** traversal outside the reference root rejected; unsafe workspace/live-root writes rejected; invalid XSD child rendered as an error; unknown script property rendered as a warning with suggestion; stale authoring responses suppressed; valid correction removed the scratch file's Forge diagnostics; warnings remained non-modal.
- **Installed/public proof:** OpenVSX published 0.0.36. Public and local VSIX SHA-256 are exactly `538A26B1D1F1ECCAEE123EE9661B973D651377102B61D7E23A712C69EA37106E`. Antigravity loaded the public install from `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.36-universal`, sidecar port 62148, and visibly proved XML-child and faction-property completion, `faction.id` hover, red/amber diagnostics, did-you-mean, and clear-on-correction. Evidence: `vscode-extension/evidence/0.0.36-installed-public-validation.md` plus the task transcript.
- **Review:** every original Part 1, Part 2, path-role, product-copy, continuous-validation, installed-proof, and publish requirement is done and evidenced. Standalone LSP remains deliberately out of scope; HTTP providers are the shipped integration. Generic third-party XML extensions remain supplemental, never X4 semantic authorities.
- **Status:** `VERIFIED`.
- **Rollback:** install public 0.0.35; restore quarantined artifacts from the cleanup manifest; source rollback by reverting this bounded release commit. Vanilla, game, and real-mod data were not mutated by validation.

## AAR

- **Triggers:** reconciliation corrected path roles and `faction.id`; review forced fixes; full e2e initially had one stale label assertion; precommit caught forbidden manual-validation copy in release notes; OpenVSX indexing and Antigravity preserved-webview state required explicit cache/host checks; command-wrapper mistakes triggered strategic pivot; final Git status caught and reversed one over-broad cleanup move of a tracked Playwright snapshot.
- **Sustain:** one shared validator and one corpus engine prevented UI/API/agent truth drift; real installed public-package proof caught stale-host state that build/API checks could not; product-copy and corpus-zero-error gates prevented release regressions.
- **Improve work/approach:** close the preserved IDE webview before installed proof and verify the new managed sidecar port; keep single-purpose host commands instead of quoting-heavy orchestration wrappers.
- **Improve tools:** marketplace result rows can retain stale version metadata after the detail/install state updates; compare installed path/version plus public artifact hash. The computer-use accessibility tree is the reliable diagnostic oracle; full-tree dumps must be filtered.
- **Highest-risk evidenced weakness:** validation coverage is intentionally bounded by what X4's XSD/corpus can prove; domains such as Lua C-API semantics remain separate backlog work. The UI now reports corpus/manifest coverage rather than implying zero-risk omniscience.
