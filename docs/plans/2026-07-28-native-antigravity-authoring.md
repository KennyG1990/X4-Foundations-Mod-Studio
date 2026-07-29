# B100 · Native Antigravity authoring handoff — VERIFIED 2026-07-28

Task: Make real mod files and selected graph-node snippets open and edit in Antigravity's native
editor while Forge remains the X4-aware visual authoring, validation, compile, and deploy system.

Lane: **FULL** — cross-layer editor ownership, filesystem authority, diagnostics, compiler behavior,
extension-host messaging, visible UI, packaging, and installed-host proof.

## PLAN

### Bounded unit

Deliver the migration in independently provable phases:

1. Correct patch-only compilation and package validation.
2. Add a secure Studio-to-extension request bridge that opens real workspace files in native tabs.
3. Present the complete editable project file inventory and preserve native X4 intelligence.
4. Promote the existing guarded disk-to-canvas adoption contract with stale-write protection.
5. Retire only the duplicate embedded code surfaces proven replaceable by native tabs.
6. Compact the META schema inventory.
7. Promote graph selection to editable native node documents with a lossless guarded apply path.
8. Package, install, restart, and visually validate in the real Antigravity host.

### User-visible architecture

- **Antigravity owns ordinary text editing.** XML, Lua, JSON, Markdown, text/config, and other safe
  text payloads open as real `file:` documents in IDE tabs. This allows compatible installed
  extensions to see the same documents.
- **Forge owns X4 semantics and lifecycle.** The node graph, specialized forms, XML patch workbench,
  corpus-backed completion/hover, continuous full-project validation, compile, artifact staging, and
  deploy remain Forge capabilities.
- **The graph remains the primary structured editor.** Selecting one node opens exactly that node's
  XML representation in an editable native tab; selecting several nodes opens a composite containing
  exactly those snippets. Saving updates the selected graph nodes, not an entire source file.
- **The isolated Mod Workspace is the authoring root.** The installed game's extensions directory is
  browse/deploy output, never the native editor write target.
- **Git remains the source-history authority.** Forge checkpoints/adoption protect transitions; they
  do not replace version control.

### Assumptions and unresolved facts

- Antigravity implements the VS Code extension APIs already used by Forge. This was previously proven
  for `openTextDocument`, `showTextDocument`, completion, hover, and diagnostics, but the new bridge
  and installed build still require fresh proof.
- Imported projects have `workspace.sourceFolder` pointing at their isolated source directory. A
  canvas-only project may require an explicit materialize-to-workspace step before native editing.
- The iframe currently has no extension message bridge. Cross-origin `window.postMessage` can relay a
  narrow command through the webview shell, but origin and path containment must be enforced.
- Existing two-way adoption is default-off and only watches selected XML directories. Reconciliation
  must decide whether to enable it by product flow, widen it, or replace prompts with an explicit
  refresh action; silent auto-adoption is out of scope.

### Authoritative references

- X4 schemas and corpus: `<X4_UNPACKED_CORPUS>`.
- ADR-F2: raw XML remains available; visual authoring is never mandatory.
- ADR-F4: source checkout and deploy artifact are separate ownership domains.
- Capability map: B56/B57 native diagnostics, IntelliSense, real workspace folders, and guarded
  import+CAS adoption already exist and must be extended rather than duplicated.
- Existing implementation: `vscode-extension/src/extension.ts`, `src/components/CodePreview.tsx`,
  `src/components/DirectoryExplorer.tsx`, `src/lib/modCompiler.ts`, and the artifact pipeline.

### In scope

- Workspace-contained native file opening from Forge UI controls.
- Native two-pane diff viewing for workspace source versus Forge-generated text; X4 patch synthesis,
  selector matching, and applied-preview semantics remain owned by the XML Patch workbench.
- Editable `x4forge-node:` native documents for one or several selected graph nodes, with native XML
  completion/hover/diagnostics and a guarded save-to-graph round trip.
- Real Antigravity tabs with normal editor language IDs and extension interoperability.
- Project file navigation for every source file; text/binary classification; binary files listed but
  never decoded or rewritten as text.
- Existing Forge completion/hover/continuous diagnostics on native XML/Lua buffers, including unsaved
  content overlays.
- Explicit, guarded disk-to-canvas adoption with compare-and-swap conflict refusal.
- Explicit materialization for generated canvas files that do not yet exist in the source folder,
  without writing to the game directory or overwriting newer bytes.
- Domain-aware package readiness: a libraries/XML-patch-only mod has no MD entry-point requirement and
  emits no synthetic MD file/folder.
- Compact schema inventory: `Found N schema files` plus an expandable file/path list.
- Removal of the central embedded CodeMirror preview/editor and the AIScript/Wares/Jobs compiled XML
  `<pre>` duplicates only after their replacement path is proven.

### Out of scope

- Replacing the node graph, specialized configurators, or XML patch workbench.
- Writing directly to the installed game extensions directory from the editor.
- A standalone LSP process; the existing HTTP-backed extension providers remain the engine.
- Automatically installing or trusting third-party extensions.
- Treating arbitrary binary formats as editable text.
- Treating a node edit as permission to regenerate or replace an entire source file.
- Adding/removing/reparenting graph nodes by editing the snippet document in this unit; structural
  changes remain graph operations until a separately proven structural merge exists.
- Publishing to Open VSX without a separate explicit release authorization.

### Existing infrastructure reused

- `x4forge.openModFolder` adds a selected source mod as a real IDE workspace folder.
- Native `vscode.languages` completion/hover/definition/reference providers.
- Continuous `project/validate` projection with unsaved XML/Lua buffer overlays.
- `x4forge.twoWayEditing` guarded importer: source folder import, workspace-version CAS, explicit user
  confirmation, refusal telemetry, and no silent canvas mutation.
- `workspace.sourceFolder`, `originalFiles`, passthrough files, artifact plan, and deploy staging.
- XSD/reference corpus caches and `/api/reference/complete` + `/api/reference/hover`.
- The retired CodeMirror path's selected-node hierarchy serializer as reconciliation evidence only;
  its apply handler explicitly refused partial merges, so the new save path must prove what it did not.
- B90/B91's established safety contract: semantic node identity, dry-run diff, byte-fidelity outside
  the edited node span, and hard refusal for opaque/unmodelled nodes.

### Couplings that must remain consistent

- UI file inventory ↔ workspace source folder ↔ compiled artifact manifest.
- Native document bytes ↔ unsaved validation overlays ↔ disk bytes ↔ canvas import fingerprint.
- Visual/model-generated files ↔ source materialization ↔ compile ownership.
- Text/binary classification ↔ passthrough copying ↔ no-loss deployment.
- Patch-only domain detection ↔ readiness diagnostics ↔ compiler output ↔ artifact plan.
- Web app request ↔ webview relay ↔ extension command ↔ configured workspace containment.
- Schema-registry count ↔ displayed META inventory.

### Risks and authorization boundaries

- **Data loss:** the highest risk is a visual compile overwriting newer native editor bytes. Every
  source mutation must use the existing guarded/CAS/checkpoint path or refuse on mismatch.
- **Graph corruption:** a snippet edit must preserve node IDs, positions, ports, links, inclusion
  state, and every unselected node. Missing/reordered identity markers, tag/type changes, structural
  child changes, stale selection tokens, and opaque raw-XML nodes are refusal conditions.
- **Path traversal:** the web app is untrusted input to the extension command boundary. The extension
  resolves configured roots itself, rejects absolute/traversal paths, checks the final real path is
  contained, and opens regular files only.
- **Deployment:** no phase writes directly to the game directory. Deploy remains the sole game-dir
  writer and is not part of editor synchronization.
- **Dirty repository:** pre-existing cleanup and user evidence changes are preserved and excluded from
  this task's attribution/staging.
- **Host state:** the active Antigravity profile is also the locked cleanup residue; do not kill it or
  delete `.tmp_installed_validation` during implementation.
- **Network/spend/credentials:** no new external network or AI-spend surface. The bridge is local
  webview messaging; no keys or absolute paths are stored in page content.

### Rollback and recovery

- Source changes use guarded Forge writes, workspace-version/hash CAS, canvas undo, and Git remains
  authoritative. This task does not claim that every native-editor keystroke creates a Forge checkpoint.
- Each implementation phase is independently revertible by its scoped source diff.
- The packaged validation uses the existing disposable Antigravity profile/canvas, never live mod or
  game data.
- The previous CodeMirror component is removed only in the final retirement phase; until then it is
  available as a rollback path behind the existing collapsed pane.

### Acceptance criteria

1. In Forge, selecting an editable project file opens/focuses that exact workspace file in an
   Antigravity tab beside the Studio. Reopening focuses the existing document instead of cloning it.
2. Multiple XML/Lua/text files can remain open as normal IDE tabs; the Forge project navigator shows
   the whole mod, not hardcoded `MD.xml` / `UI_LAYOUT.xml` placeholders.
3. A real MD attribute completes faction/ware/sector references from the configured unpacked corpus;
   expression completion/hover and continuous diagnostics work in the native tab on unsaved content.
4. A compatible third-party editor extension can see the real document because its scheme is `file:`;
   Forge does not claim that every extension will support every X4 grammar.
5. A native disk edit can be explicitly adopted into the visual model; a concurrent canvas version
   change yields a named 409/conflict refusal and neither side is silently overwritten.
6. Canvas-only generated text is materialized only by an explicit action into the isolated workspace;
   an existing mismatched file is refused unless the user selects a reviewed conflict path.
7. A patch-only mod containing `content.xml` plus `libraries/wares.xml` validates and compiles without
   an MD cue error and without an emitted `md/` directory.
8. An actual MD domain with structurally invalid MD still receives specific validation findings; the
   patch-only exception does not weaken MD validation.
9. Arbitrary passthrough files remain present byte-for-byte in the artifact. Binary files appear in
   navigation with size/type metadata and are not opened as a text editor by Forge.
10. The AIScript and Wares/Jobs duplicate compiled-XML previews and the central CodeMirror pane are
    absent after native replacement proof; specialized visual authoring controls remain.
11. META shows one compact schema summary (`Found N schema files`) and an expandable list of resolved
    file names/paths instead of permanently occupying the panel.
12. Existing `/api/fs/*`, reference, validation, import, compile, deploy, watcher, artifact, and
    arbitrary-file preservation contracts do not regress.
13. A conflicting source/generated text file can open in Antigravity's native two-pane diff viewer;
    the action is read-only and does not replace Forge's X4-aware patch synthesis or applied preview.
14. Clicking one graph node opens/focuses an editable native XML document containing that node's code
    snippet without requiring the user to open its whole source file; Ctrl/Shift-selecting several
    nodes opens a composite containing exactly those selected snippets.
15. Saving a valid attribute/property edit updates only the selected graph node models and creates a
    Forge checkpoint. Node IDs, graph positions, ports, links, unselected nodes, and bytes outside the
    edited source span remain identical; the save returns a reviewable diff/result to the native host.
16. A stale selection, missing/reordered identity marker, element tag/type change, graph-structural
    change, malformed XML, deterministic schema error, or opaque `rawXml` node is refused and applies
    zero graph changes. Warnings remain visible and do not masquerade as deterministic errors.
17. Corpus-backed completion, hover, and native diagnostics operate in `x4forge-node:` documents, so
    `faction.player.` and schema/reference positions have the same intelligence as real `file:` tabs.

### Required validation and negative paths

- Static/type: root and extension typechecks, lint, production build.
- Focused selftests: patch-only readiness/output, file classification/inventory, bridge message
  validation, path containment, materialization CAS, schema summary.
- Integration: route/oracle sweep against isolated state, `project/validate`, compile/artifact hashes.
- Negative paths: traversal, absolute path, file outside configured workspace, directory/symlink,
  binary-open request, missing source folder, stale materialization, concurrent canvas CAS conflict,
  malformed MD, sidecar unavailable, stale node-selection token, removed/reordered node markers,
  tag/type changes, opaque raw XML, and attempted structural edits.
- E2E: full isolated `npm run test:e2e`; judge `[run-e2e] VERDICT`, verify 3100/3101 shutdown and live
  3000/3001 workspace untouched.
- Packaged host: build/stage/package VSIX, install in the designated disposable Antigravity profile,
  restart/reload extension host, and verify the displayed Forge version actually changed.
- Visual installed proof: native tabs beside Studio, file navigation, completion/hover/squiggles,
  patch-only clean state, conflict refusal, binary handling, and compact META disclosure.
- Domain live-game validation: not applicable; this work changes authoring/editor behavior and package
  structure, not in-game runtime behavior. X4 remains closed.

### Evidence locations

- Machine outputs: `test-results/` or task-scoped logs generated by existing gates.
- Installed-host screenshots: `vscode-extension/evidence/b100-*.png`.
- Durable close: `ROADMAP.md`, `SESSION-HANDOFF.md`, capability-map delta, and project/global AAR ledgers
  if the task triggers an AAR.

## BASELINE

- Revision: `7591c751e71b9e4695125cca5b9e045cdb525e48`.
- Public/manifest extension version: `0.0.48`.
- Runtime: X4 absent; ports 3000/3001/3100/3101 not listening; Antigravity available for the user-
  authorized disposable canvas/profile.
- Pre-existing dirty state: repository-cleanup changes plus unrelated `ROADMAP.md`, `KNOWN-BUGS.md`,
  and two 0.0.35 evidence images. Preserve them; do not attribute or overwrite them.
- Current editor: lazy embedded CodeMirror in `CodePreview`; hardcoded MD/UI tabs; AIScript and
  Wares/Jobs compiled XML `<pre>` previews.
- Current native capability: real mod folder opening, X4 completion/hover/nav, unsaved continuous
  diagnostics, and default-off guarded disk-to-canvas adoption already exist.
- Current reproduced product defect: `validatePackageReadiness` emits an error whenever no graph or
  passthrough MD cue exists, and `compileAndSaveAll` unconditionally creates `md/<mod>.xml`, even for a
  libraries-only patch mod.
- Rollback target: baseline revision plus the pre-existing dirty diff; phase-local changes remain
  separable by file/hunk.

## RECONCILE

- Resources searched: extension panel wrapper, native providers, open-mod-folder flow, two-way watcher,
  workspace `sourceFolder`, compiler/readiness, artifact manifest/passthrough pipeline, CodePreview,
  DirectoryExplorer, AIScript/Library previews, META schema status, capability map, ADRs, B56/B57 plan.
- Existing capability reused: B56/B57 already implement most of the native language/diagnostic and
  synchronization substrate. This task promotes and connects it; it does not create an LSP or second
  validation engine.
- Presence: native `file:` providers, Problems projection, unsaved overlays, workspace folder opening,
  import+CAS adoption, arbitrary passthrough preservation, schema registry.
- Absence: no iframe-to-extension command bridge; no native-tab open action from Forge; no complete
  source/artifact file navigator; two-way adoption is hidden/default-off/narrow; compiler is not
  domain-aware for patch-only projects; META does not show the full schema inventory compactly.
- Capability-map delta planned: B100 makes native editing the primary text path and removes the
  default-off/read-mostly limitation only through explicit guarded transitions. External capability-map
  write occurs at documented close, not before verified behavior.
- Plan change from initial request: retire duplicated editors only after extending the already-existing
  B56/B57 infrastructure. A wholesale editor rewrite would be redundant and less safe.

## PHASE GATES

### Phase 1 — patch-only correctness

- Add a domain predicate shared by readiness and compile.
- Emit generated MD only when the model actually has MD content or a valid integration contract needs
  MD glue. Preserve source-owned passthrough MD files through the artifact path.
- Gate: focused tests prove patch-only no-MD output and malformed/real-MD validation remains active.

### Phase 2 — secure native-open bridge

- Add a nonce-protected webview shell relay and `onDidReceiveMessage` handler.
- Web app sends only a narrow command plus project-relative path/source identity.
- Extension re-resolves configured Mod Workspace, verifies containment/type, opens with
  `openTextDocument` + `showTextDocument(ViewColumn.Beside)`.
- The same boundary may open a read-only generated-text virtual document beside its resolved source
  through Antigravity's native diff command; the generated bytes are ephemeral and never written.
- Gate: command tests plus installed-host click proof and traversal/binary refusal.

### Phase 3 — project file inventory and native intelligence

- Build one file registry combining source files, generated manifest entries, and passthrough metadata.
- Expose text/binary, source/generated, existence, size/hash, and editability without embedding bytes.
- Wire project navigation/dropdown to native open. Extend native validation inventory where text formats
  are supported while preserving XML/Lua full-project semantics.
- Gate: hostile arbitrary-file fixture, unsaved completion/hover/diagnostics latency and accuracy.

### Phase 4 — synchronization and materialization

- Make explicit adoption discoverable from Forge/native workflow and retain CAS refusal.
- Materialize generated text into the isolated source only through validated, checkpointed writes with
  expected-hash/version preconditions.
- Gate: visual→file→native edit→adopt→visual round-trip; concurrent change refuses; exact bytes survive.

### Phase 5 — retire duplicate editor surfaces

- Remove hardcoded CodePreview MD/UI tabs and embedded CodeMirror only after phases 2–4 pass.
- Remove AIScript and Wares/Jobs compiled XML `<pre>` duplicates; replace with `Open in Antigravity`
  controls tied to actual files.
- Keep domain-specific forms, trees, previews needed for visual authoring, and XML patch workbench.
- Gate: caller/render census, no orphan state, no reduced canvas functionality, native replacement seen.

### Phase 6 — compact schema inventory

- Show `Found N schema files` and key aggregate counts.
- Expand on demand to show file names and resolved paths from the live registry.
- Gate: collapsed and expanded installed-host screenshots; missing-schema state remains clear.

### Phase 7 — editable native node selection

- Lift the canvas's general `selectedNodeIds` state to the application boundary so selection has one
  owner and can drive both the graph and native node document.
- Add a pure node-selection document engine: stable semantic markers, exact node snippets, parser,
  dry-run diff, stale-token check, and a property-only graph merge preserving all structural fields.
- Add an editable `x4forge-node:` file-system provider. Clean selections reuse preview tabs; dirty
  selections remain open, and selection changes never steal graph focus.
- Relay native save requests back into the Studio, validate the candidate with the existing referee,
  checkpoint, apply, and return an explicit success/warning/refusal result to Antigravity.
- Extend existing completion, hover, and diagnostic providers to the virtual node scheme; add no LSP
  and no second vocabulary/validator.
- Clear and immediately reschedule virtual-document diagnostics when Antigravity reloads provider
  bytes during its native Revert action; a refused structural edit must not leave stale Problems after
  the valid provider state is restored.
- Gate: B90 fixtures plus real-file byte-fidelity, single/multi selection, save-to-graph, stale and
  opaque refusals, native completion/hover/diagnostics, and installed-host visual proof.

### Phase 8 — complete validation/review/release-ready close

- Run every declared gate, inspect the full diff and requirements, update graphify, records, handoff,
  capability map, and AAR.
- Package/install/visual-proof locally. Publication remains a separate authorization gate.

## IMPLEMENT

Phases 1-7 are implemented in the working tree. The graph remains the structured-authoring owner;
native full-file tabs and editable `x4forge-node:` selection documents reuse the extension's existing
completion, hover, diagnostics, and guarded validation paths. Exact source spans plus whole-file graph
fingerprints prevent a selected-node save from reserializing or silently discarding adjacent source.

## VALIDATE

- Pure node-selection/source-span/file-identity selftests: 19/19 PASS.
- Native bridge boundary selftest: 15/15 PASS.
- Focused isolated native-authoring e2e: 3/3 PASS, including rendered Ctrl-selection through
  the iframe-to-native-host message boundary; ports 3000/3001/3100/3101 were all clear afterward.
- Full isolated e2e: 30/30 PASS with `[run-e2e] VERDICT: PASS — 30 passed, 0 failed, 0 flaky,
  0 bad-result`; all four guarded ports were clear afterward.
- Root typecheck, extension build, root production build, and final precommit: PASS.
- Lint: PASS with 0 errors and 522 pre-existing/style warnings.
- Oracle sweep: 110/110 PASS when the isolated process received the declared unpacked X4 root. The
  initial 109/110 run is retained as an AAR trigger because the first disposable process omitted it.
- Production extension chain: root build, `stage-app`, native binding/secret assertions, extension
  build, staged sidecar probe 6/6, and local VSIX packaging PASS. Local candidate 0.0.51 is installed;
  installed and staged `out/extension.js` are byte-identical at SHA-256
  `4A016AA81079AFA44E873BD0D40ADB27C80BE4CB5D77FE3EB568F31472905BF1`. The final local VSIX contains
  2,090 files, is 17,778,031 bytes, and hashes to
  `40D04E36599C5AD00CA6D6E0A9F3950510B0E4DDC1DEB6325E2A4D1CAB7F52C7`.
- Real installed Antigravity proof:
  - one graph node opened its exact `Spawn-Ship.node.xml` snippet;
  - a safe name edit saved through Forge and changed the graph, then was restored through the same path;
  - changing `<create_ship>` to `<do_if>` was refused with the named graph-structure reason and zero
    graph mutation;
  - native Revert restored provider bytes and cleared the discarded diagnostics without an extra keystroke;
  - Ctrl+Space after `faction.` displayed canonical corpus factions in the native virtual document;
  - individual Mission Cue, Event, and Spawn Ship selections opened distinct native tabs.
- Installed evidence: `vscode-extension/evidence/b100-native-node-single.jpg`,
  `b100-native-node-save-graph.jpg`, `b100-native-node-refusal.jpg`,
  `b100-native-node-revert-clears.jpg`, and `b100-native-node-completion.jpg`.
- X4 live-game validation: not applicable; X4 remained closed. Open VSX publication was not authorized
  and was not attempted.

## REVIEW

1. **Done:** real project files open/focus in native tabs with containment/type checks.
2. **Done:** the project inventory and native IDE own normal multi-file tab navigation; hardcoded MD/UI
   placeholders are removed.
3. **Done:** native unsaved completion/hover/diagnostics reuse the corpus/schema referee; installed
   faction completion is visible.
4. **Done:** real source documents use the `file:` scheme, so compatible IDE extensions can participate.
5. **Done:** adoption remains explicit and compare-and-swap guarded; concurrent state refuses.
6. **Done:** generated-only text materializes only through validated expected-hash writes.
7. **Done:** patch-only mods emit no fake MD and receive no cue/package error.
8. **Done:** actual malformed/invalid MD remains an error; the exception is domain-scoped.
9. **Done:** arbitrary passthrough and binary inventory/deployment contracts remain byte-preserving.
10. **Done:** duplicate embedded source editors are retired while visual builders remain.
11. **Done:** META reports one compact schema count with expandable paths.
12. **Done:** existing APIs and artifact/deploy/validation contracts pass the 30-test full board.
13. **Done:** source/generated and vanilla/candidate comparisons use Antigravity's native diff viewer.
14. **Done:** installed single selections opened exact snippets; rendered Ctrl-selection delivered exactly
    the two selected snippets and excluded the third fixture node.
15. **Done:** safe node saves preserve graph identity/layout/links and exact bytes outside the source span;
    installed save-back changed only the selected graph card.
16. **Done:** stale/source-byte/marker/order/tag/structure/opaque negative paths refuse without mutation;
    the installed structural refusal and Revert path are visible evidence.
17. **Done:** `x4forge-node:` documents receive the same completion, hover, and diagnostics providers as
    real X4 XML files.

Fresh-eyes corrections completed before close: duplicate-sibling ordinals, cue child-span preservation,
whole-file ownership fingerprints, source-byte stale tokens, serialized concurrent saves, and native
Revert diagnostic refresh. No acceptance criterion was weakened or deferred.

## CLOSE

- Status: `VERIFIED`.
- B100 moved from `BACKLOG.md` to `ROADMAP.md`; capability-map and AAR deltas are recorded.
- Deliberately not changed: graph structure remains canvas-owned; arbitrary XML restructuring in a node
  tab is refused; standalone LSP remains deferred; deploy/runtime behavior is outside this unit.
- Remaining risk: virtual node documents are intentionally in-memory. An extension-host restart may
  restore their URI before the provider entry is recreated; reselecting the graph node recreates it.
  B101 records the bounded persistence/rehydration follow-up. Safe saves also take roughly ten seconds
  because they run the full deterministic validator; this is correct but merits later progress feedback.
- Local 0.0.51 is release-ready but unpublished. Publish-before-commit applies, so no commit or push was
  performed without Open VSX authorization.
- Suggested eventual commit title: `feat(editor): unify native X4 file and graph-node authoring with lossless guarded synchronization`.

## AAR

- Trigger already fired: reconciliation found substantial existing B56/B57 infrastructure and changed
  the implementation from replacement to promotion/connection.
- Trigger: the initial native-file handoff interpretation was corrected by the user. Whole-file tabs
  do not replace node editing; the graph is the primary structured editor and selected-node snippets
  require their own editable native document contract.
- Sustain: resource/caller reconciliation prevented a redundant LSP/editor implementation.
- Improve work/approach: the original UI impression obscured that native providers and CAS adoption had
  already shipped; future editor work must start at the extension contribution points.
- Improve tools: graphify's broad CodePreview query was too expansive; targeted source/caller searches
  were required to expose the actual ownership boundary.
- Trigger: focused e2e exposed that xmldom did not provide a reliable `previousElementSibling` ordinal;
  duplicate sibling elements initially mapped to the first node. The semantic-path index now counts
  earlier element children explicitly, and the regression fixture proves the second duplicate only.
- Trigger: fresh-eyes review found that replacing a cue's full source span would delete its descendant
  condition/action bytes. Cue application is now limited to the opening tag and intrinsic delay.
- Trigger: the first isolated-oracle launcher was rejected by command policy, and the replacement
  foreground cell left its child process listening after the wrapper was terminated. The exact 3101
  PID was identified from the socket and stopped; live 3000/3001 were not touched.
- Trigger: a PowerShell `foreach` result was again piped without first assigning the loop output,
  reproducing the parser hazard already named in `SESSION-HANDOFF.md`. Subsequent process inspection
  assigns rows before formatting; no broad process commands are permitted for the remainder.
- Trigger: installed-host refusal proof exposed that Antigravity's native Revert reloads provider
  bytes without emitting the text-change event used by continuous diagnostics. The graph remained
  correct, but the editor title retained two stale problems until another keystroke. The provider read
  path now clears stale diagnostics and schedules a fresh validation of the restored document.
- Trigger: the Antigravity installer reported success and then its analytics process crashed with a
  non-zero exit. Installed/staged hash identity and real host behavior, not the wrapper exit alone, were
  used as the installation oracle.
- Trigger: two computer-control actions were blocked because the user typed in the same Antigravity
  window. The input guard prevented collision; every subsequent action re-observed the window first.
- Sustain: exact source spans, whole-file fingerprints, the existing full-project referee, isolated
  ports, and installed-host inspection prevented a cosmetic editor handoff from becoming a second
  source of truth.
- Improve work/approach: acceptance-to-proof mapping should be explicit before broad validation; the
  rendered multi-select host boundary was added only during final review.
- Improve tools: native virtual-file Revert and extension-host restoration need explicit provider
  lifecycle tests; ordinary text-change tests do not cover either event.
- Highest-risk evidenced weakness: virtual node tabs are memory-backed and do not yet rehydrate their
  provider entry across an extension-host restart. B101 scopes persisted descriptor/reselection recovery
  without storing editable payload as a second authority.
- Lessons banked in the X4 Forge and global workflow AAR ledgers.
