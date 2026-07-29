# Complex mod project-load regression repair

> **For Agent:** REQUIRED SUB-SKILL: use `planning` before implementation and preserve the existing lossless import contract.

Task: B102
Lane: FULL
Status: IN PROGRESS

> **SCOPE CORRECTION 2026-07-28:** Installed-host review proved that making four opaque DeadAir cues
> visible does not satisfy Forge's Mission Director editor goal. The earlier exclusion of recursive
> raw-cue decomposition is revoked. This plan remains the evidence record for the overlap/preview repair;
> B102 now continues under `docs/plans/2026-07-28-lossless-md-node-graph.md` with a lossless source-tree
> plus semantic-graph architecture.

## PLAN

- **Bounded unit:** Make a real multi-file, partially opaque X4 extension visibly and honestly load into
  Forge after project selection. Repair imported-node layout, new-workspace camera framing, and preview
  coverage reporting without weakening byte-preserving import/export.
- **Assumptions:** The selected DeadAir folder is healthy input. The reported failure is the rendered
  result of workspace adoption, not missing source files. Recursive decomposition/editing of every
  nested element inside an opaque raw cue is not safe in this unit because the current compiler treats
  the top-level raw cue as the byte-owning artifact.
- **Authoritative references:** the real read-only
  `<MODS_ROOT>\deadairdynamicwars` folder; ADR-F4 source/artifact ownership;
  B79/B80 dual-root project browser; B100 native source/node authoring; `importModFolder`,
  `SyncModal`, `Canvas`, and the round-trip checker.
- **In scope:** distinct layout lanes for every imported MD file; automatic fit after the active project
  identity changes; clear selection state on project replacement; preview domains derived from the full
  import report; explicit graph/opaque coverage in the preview; prevent unrelated directory saves from
  forcing a full canonical-corpus rescan; focused importer and rendered-project regression tests.
- **Out of scope:** changing DeadAir, deploying to the game, publishing, recursive raw-cue decomposition,
  inventing editable semantics for unsupported MD elements, or weakening the stale-source/round-trip
  gates.
- **Risks:** a layout transform could alter graph identity or compilation; a camera effect could fire on
  normal node edits; optimistic preview language could still overstate editability. No game, mod, config,
  credential, spend, or network write is authorized.
- **Rollback/checkpoint:** preserve the dirty baseline at `7591c75`; revert only B102-scoped repository
  changes. The real DeadAir folder remains read-only throughout.
- **Evidence locations:** focused selftest/e2e output; final task record in this file; installed-host
  screenshot only after deterministic gates pass and Ken confirms machine state.

## ACCEPTANCE CONTRACT

1. Importing the real DeadAir folder returns 18 classified files, four top-level graph nodes, twelve
   translation source files (eleven parsed translation models under the current parser), and no
   dropped/passthrough mismatch.
2. The four imported top-level MD nodes have distinct coordinates and identify their owning script/file;
   none render directly on top of another.
3. Replacing a prior workspace causes the canvas to frame the imported nodes once. Ordinary edits within
   the same workspace do not continually reset the user's camera.
4. The selected-project preview shows Mission Director and Translations from the authoritative full scan
   even though the lazy root item does not preload descendants.
5. Preview copy states the number of graph nodes and opaque/raw nodes. It does not imply that nested raw
   XML is individually modeled.
6. A no-edit import/build round trip remains lossless for every DeadAir file. No source or game file is
   written.
7. Negative path: a lossy/unsupported MD file remains preserved as an opaque raw top-level node and is
   not silently regenerated as a partial typed graph.
8. Focused type/static tests, importer selftest, rendered project-load test, oracle sweep, full isolated
   e2e, typecheck, lint, build, and precommit pass. Installed Antigravity proof is required for final
   `VERIFIED`; otherwise close `PARTIAL`.

## BASELINE

- Revision: `7591c75`; working tree already contains substantial B83/B99/B100 and cleanup/release work.
- Installed candidate: X4 Forge Studio `0.0.51`, managed sidecar on port 62706.
- Real source: 18 files: `content.xml`, five `md/*.xml`, and twelve `t/*.xml` files.
- API reproduction: import succeeds but returns only four opaque top-level MD nodes, all at `(120,100)`;
  eleven translation models are populated and two files stay partial.
- Rendered reproduction: the existing Antigravity window shows DeadAir as current workspace but only one
  apparent `Cue (raw): Init`; the other three occupy the same pixels. Preview says “No project selected”
  under Detected Domains despite a selected project and a completed 18-file scan.

## RECONCILE

- **Existing capability reused:** B79/B80 root-qualified list/preview/import; `importModFolder` lossless
  classification and source stamps; `buildWorkspaceFileManifest`; Canvas `fitToNodes`; B100 native real-file
  inventory and opaque-node refusal.
- **Presence:** source selection, import, metadata adoption, translation parsing, source-file handoff, and
  byte preservation all work.
- **Partial/defective:** per-file parser coordinates are merged without layout isolation; raw fallback
  resets its position for every file; Canvas only auto-fits when an MD filter changes; lazy candidate
  metadata is used after a full preview has authoritative paths.
- **Absence:** no regression test loads a real multi-script workspace and asserts visible graph nodes.
  Existing project-browser e2e mocks the imported workspace and only asserts that the modal closes.
- **Couplings:** importer coordinates, graph rendering/frustum culling, project replacement state, preview
  classification, byte-fidelity fingerprints, and native source inventory.
- **Capability-map delta:** pending close; expected delta is honest, visible complex-mod adoption while
  retaining the existing negative for opaque nested XML.
- **Plan change from initial report:** the project did import. The repair targets overlapping/off-screen
  rendering and misleading preview, not folder discovery or source corruption.
- **Plan change from focused e2e:** all project-load assertions passed, but the ephemeral server dropped
  during cleanup because saving workspace/filesystem paths forcibly launched a fresh 1,028,384-file
  reference-manifest scan. The bounded repair now also prevents unrelated directory saves from forcing
  that scan; an effective corpus-root change remains the explicit force-refresh trigger.

## IMPLEMENTATION TASKS

### Task 1: Pin importer layout and coverage

- Add a deterministic per-file placement helper around imported MD node batches.
- Add graph-node and opaque-node coverage fields to the import report.
- Extend the round-trip selftest with multiple lossy MD files and coordinate uniqueness.

### Task 2: Reset project presentation safely

- Give `SyncModal` an explicit project-loaded callback to clear stale selections/filters.
- Auto-fit Canvas only when project identity changes, not when node content changes.
- Add a rendered regression that starts from a displaced prior canvas and verifies imported nodes become
  visible after Load Project.

### Task 3: Make preview authoritative and honest

- Derive detected domains from `importReport.classification` once preview completes.
- Display graph/opaque coverage and explain that opaque nested XML remains source-editable rather than
  individually graph-modeled.

### Task 3b: Preserve the reference cache on unrelated settings saves

- Compare the previous and next effective canonical-corpus roots during a settings update.
- Force a new manifest generation only when that root changes; retain normal manifest invalidation for
  corpus file changes and explicit refreshes.

### Task 4: Validate and review

- Run focused importer/project-browser tests first, then the declared full gates.
- Re-query the real DeadAir import read-only and verify distinct coordinates plus strict losslessness.
- Inspect the installed candidate in the existing Antigravity window only after machine-state confirmation.

## IMPLEMENT

- Added deterministic per-file import lanes while preserving each parsed file's relative node geometry.
- Added file-qualified raw-node labels and graph/opaque/MD coverage fields to the import report.
- Made selected-project domain reporting use the completed full classification rather than the lazy tree
  candidate and added explicit opaque-coverage copy.
- Cleared stale node/script selection on project replacement and fit the canvas once per project identity.
- Added a real multi-script, intentionally opaque project-browser regression with strict-lossless checks.
- Stopped unrelated directory-setting saves from forcing a new canonical manifest generation.
- Separated the artifact/deploy folder id from the canonical id declared in `content.xml`. A legitimate
  folder/id mismatch now preserves the original manifest bytes instead of silently rewriting identity
  and metadata during a no-edit build.

## VALIDATE

- `npm run typecheck` -> pass.
- `runImportedGraphLayoutSelftest()` -> 4/4 pass.
- Focused real multi-script Playwright workflow -> pass, 1/1 in 27.5s; both nodes visible at distinct
  coordinates, authoritative preview visible, strict lossless round trip true.
- Ephemeral ports 3100/3101 -> stopped after the run.
- Real DeadAir read-only import -> 18 files, 4 distinct graph positions, 5 MD sources, 12 translation
  source files / 11 parsed translation models, and 4 opaque top-level nodes.
- Real DeadAir read-only round trip -> strict lossless; 18 inputs, 0 dropped files, 0 modeled-byte
  changes, 0 passthrough mismatches. The extra output is Forge's generated README only.
- Round-trip selftest -> 17/17 pass, including a legal content-id/folder mismatch.
- Artifact pipeline selftest -> 43/43 pass.
- Oracle sweep against the isolated API stack -> 111/111 pass.
- `npm run test:e2e` -> authoritative structured verdict PASS, 31/31 in 4.3 minutes.
- Ephemeral ports 3100/3101 -> clean after focused and full runs.
- `npm run typecheck` -> pass.
- `npm run lint` -> pass with 0 errors and 524 pre-existing/project-wide warnings.
- `npm run build` -> pass.
- `graphify update .` -> 2,637 nodes / 6,146 edges.
- `npm run precommit:check` -> pass.
- Local 0.0.52 release chain -> changelog generated; app staged with native dependency present and no
  secrets; extension controller built; VSIX packaged (2,090 entries, 16.96 MB).
- Staged 0.0.52 production sidecar probe -> 6/6 pass: boot, injected UI token, protected config,
  authenticated config, and canonical-corpus completion.
- VSIX manifest audit -> `x4forge.x4-forge-studio` 0.0.52, expected entrypoint, no staged environment,
  token, runtime-state, source-map, Git, Playwright, or test-result files. SHA-256:
  `893B4349797288D4DC8444DC0B67F9417ED36BDB740A95A0B98988E4FC50893A`.
- Current Antigravity installation (read-only CLI query) -> 0.0.51. Candidate installation/restart is
  intentionally waiting for the required machine-state confirmation.
- Installed-host proof -> pending.

## REVIEW

- **Visible accessibility:** source and focused rendered e2e prove distinct per-file graph lanes and
  one-shot project framing; installed Antigravity remains pending.
- **Accurate preview:** focused rendered e2e proves the completed classification drives Mission Director,
  Translations, graph-node, and opaque-node reporting.
- **Data loss:** real-folder strict round trip proves no DeadAir input file changes or disappears. The
  discovered folder/content-id mismatch is now a permanent selftest fixture.
- **Negative path:** two deliberately unsupported MD fixtures remain opaque lossless nodes and display
  separately; no partial typed regeneration is accepted.
- **Regression/package:** deterministic, oracle, full e2e, build, package, VSIX audit, and staged-runtime
  gates are green. The prior full e2e red run is not hidden: Vite disappeared mid-suite once, the exact
  failing prefix then passed, and the authoritative full rerun passed 31/31 with clean ephemeral ports.
- **Fresh-eyes correction:** strengthened the layout selftest so its non-mutation assertion checks the
  original input objects instead of merely checking the transformed output.
- **Remaining requirement:** install 0.0.52 into the already-open Antigravity host, restart the Forge
  extension/app, load the real DeadAir project, and inspect the actual rendered preview and graph.

## CLOSE

- Status: SPECIFIED.

## AAR

- Triggered already: two read-only PowerShell composition commands failed; the stable-path correction is
  to use focused commands and Node/API harnesses. The initial “project did not load” hypothesis was
  corrected by API and rendered evidence: it loaded into four coincident nodes.
