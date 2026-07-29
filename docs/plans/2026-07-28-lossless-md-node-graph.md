# Lossless Mission Director node graph

> **For Agent:** Execute in bounded phases. Do not restore whole-cue fallback as the normal path and do
> not weaken byte-fidelity, validation, or source/artifact ownership to increase a node count.

Task: B102 scope correction
Lane: FULL
Status: VERIFIED 2026-07-29

## Goal

Forge must turn real X4 Mission Director documents into an understandable and editable visual program
without deleting, hiding, or inventing logic. A beginner should be able to follow cues, conditions,
actions, control flow, and sub-cues as nodes; an experienced author must retain exact source access and
lossless round trips.

## Product contract

1. Every well-formed MD element is represented in a lossless source tree with its tag, attributes,
   ordered children, text/comments, semantic path, source span, and owning file.
2. Every executable MD instruction is visible in the graph. Known/XSD-described instructions receive
   typed labels, properties, ports, documentation, completion, hover, and validation. Unsupported or
   extension-defined instructions become localized generic XML nodes at their real position; they never
   collapse their enclosing cue, library, or control-flow branch.
3. Structural wrapper elements such as `cues`, `conditions`, `actions`, and schema-described value
   children may render as lanes, groups, or expandable fields rather than giant cards, but they remain
   addressable in the lossless tree. The UI must never imply that hidden structure was discarded.
4. Imported source remains byte-authoritative. An unchanged import/export is byte-identical. A property
   edit changes only that element's source span. A structural node operation changes only the smallest
   owning container span. All unaffected bytes, comments, siblings, and files remain identical.
5. New graph-authored documents produce XSD-valid MD. Imported documents retain unknown-but-valid X4
   constructs. Deterministic validation runs continuously over the same working document used by the
   graph and native editor.
6. Graph and native source editing are two views of one document, not competing sources of truth.

## Reconciled architecture

### Layer 1: lossless MD document model

Add an MD document intermediate representation whose nodes cover every XML element and preserve ordered
non-element content. Stable identity is derived from owning file plus semantic path and guarded by source
hash/span data. The model is rebuilt after an accepted source mutation; graph layout identity is retained
by matching stable semantic identities.

The existing `xmlSourceSpans.ts`, `OriginalModeledFile`, `mdFileIdentity.ts`, and source fingerprints are
reused. No parallel persistence store is introduced.

### Layer 2: schema-driven semantic projection

Project the lossless tree into `MDNode` cards:

- cue/library -> cue node;
- event/condition -> condition lane node;
- action -> action-flow node;
- XSD sequence/choice/control containers -> container node or visual group with ordered child ports;
- schema-described leaf/value children -> structured fields when folding improves readability;
- unknown/unmodeled element -> generic node carrying its own exact subtree and source identity.

The projection records parent/child and sibling ordering explicitly. Unsupported descendants stay local;
they do not invalidate otherwise modeled ancestors.

### Layer 3: mutation and compilation

Property edits parse and validate the selected element, then splice its exact source span. Structural graph
operations modify the smallest owning container and re-index spans. Imported files compile from the
updated source document; freshly authored files may serialize from the same document model. The legacy
whole-file `generateMDXML()` path remains for existing Forge-created workspaces during migration, then is
retired from imported-document authority only after parity gates pass.

## Alternatives rejected

1. **Whole-cue raw fallback:** preserves bytes but removes most of the product. The real AI Influence copy
   exposes 279 nodes while its parser recognizes 2,018; 86 displayed nodes are opaque top-level wrappers.
2. **Expand the hand-written node catalogue only:** improves common coverage but any new/DLC/third-party
   tag can trigger the same loss. XSD-driven generic nodes must close the open world.
3. **Regenerate whole imported files from graph state:** simpler compiler, unacceptable collateral diffs
   and risk to comments, unknown syntax, ordering, and extension-defined constructs.

## Phases

### Phase 1 - Mixed lossless import

- Introduce the lossless MD document/tree types and parser.
- Project every executable element, recursively, with generic nodes for unknowns.
- Remove `mdRoundTripPreservesElements()` as a whole-file admission gate; replace it with per-node coverage
  accounting and an invariant that every source element is either modeled, folded, or locally opaque.
- Keep unchanged output byte-identical through `originalFiles`.
- Prove AI Influence and DeadAir no longer collapse whole cues.

### Phase 2 - Safe edit/compiler bridge

- Extend selected-node editing to generic localized nodes with schema/well-formedness validation.
- Apply edits through source spans and reparse the file after every accepted mutation.
- Add structural insert/delete/reparent operations against the smallest container with dry-run diffs and
  stale-source rejection.
- Compile imported MD from the updated source model and assert unaffected-span identity.

### Phase 3 - Beginner-grade graph experience

- Render cue hierarchy, condition lanes, action chains, and control-flow branches with collapsible groups.
- Give generic nodes their real tag name, XSD documentation where available, and a clear coverage badge.
- Use the existing reference/XSD language service for property editors, completion, hover, and continuous
  diagnostics.
- Add graph navigation from diagnostics and source selections.

### Phase 4 - Release proof

- Deterministic fixtures for comments, duplicate siblings, nested containers, libraries/params/delay,
  schema-generic elements, unknown extension tags, and mixed modeled/raw descendants.
- Real read-only AI Influence and DeadAir import census, strict round trip, edit-one-node outside-span hash
  proof, full-project validation, oracle sweep, full isolated e2e, build, package, and staged sidecar probe.
- Install the candidate into the existing Antigravity host and visually prove representative complex cues,
  multi-selection source projection, edit/undo, completion, diagnostics, and project reload.
- In-game execution is required only when a test mutation is intentionally deployed; source/editor work
  does not claim runtime proof from compile results.

## Baseline

- Revision: `003a43d`; dirty worktree contains prior authorized B83/B99/B100/B102/release/cleanup work and
  unrelated evidence. Preserve it.
- Exact AI Influence copy: 87 files; strict no-edit round trip passes; compile/full validation passes with
  zero errors.
- Its MD parser recognizes 2,018 nodes, but project import exposes 279: 193 semantic nodes plus 86 opaque
  top-level wrappers. This is source-safe and editor-incomplete.
- Existing source-span selected-node editing is safe for modeled leaf nodes and deliberately rejects opaque
  nodes. That refusal is reused as a safety gate until Phase 2 makes localized generic edits sound.

## Risks and rollback

- **Highest risk:** two authorities for one MD file. Mitigation: original/updated source document remains
  authoritative; graph is a projection, and every mutation reparses before commit.
- Graph explosions can become unreadable. Mitigation: distinguish complete source-tree coverage from
  visual card granularity; use grouping/folding without dropping addressability.
- Stable identity can drift after insert/delete. Mitigation: semantic path plus local structural signature;
  stale selections refuse, while unchanged sibling identities/layout are reconciled.
- Performance can degrade on thousand-node files. Mitigation: parse/index once, incremental source-span
  mutation, collapsed groups, viewport rendering, and measured keystroke/selection budgets.
- Rollback is scoped to the new MD model/projection and integration switches. Existing original-file and
  whole-cue preservation remains available behind the current path until each phase's parity tests pass.

## Acceptance evidence

- Machine-readable element coverage report per MD file: total, typed, schema-generic, folded, localized
  raw, and uncovered. `uncovered` must be zero.
- AI Influence must expose the full executable graph rather than 86 whole-cue wrappers; no top-level cue
  may be opaque solely because one descendant is unsupported.
- DeadAir must expose every executable instruction found in its loose MD sources with distinct, navigable
  nodes.
- No-edit strict round trip: zero dropped, mismatched, or modeled-byte-changed files.
- Edit-one-node proof: only the selected span (or smallest owning container for structural edits) changes.
- Illegal structure/attribute/enum -> error; unknown property/function/reference -> warning with suggestion.
- Packaged, installed Antigravity visual proof is mandatory before `VERIFIED`.

## IMPLEMENT

- Replaced whole-cue admission with recursive per-element projection. Known MD instructions become typed
  nodes; unsupported descendants become localized `custom_xml` nodes with exact source identity instead of
  collapsing their cue or library.
- Added source spans, owning-file identity, canonical element accounting, and deterministic imported-graph
  layout. Each MD file has an independent lane and a toolbar filter; collision removal prevents stacked cards.
- Extended the native selected-node bridge to typed containers and localized raw subtrees. Saves splice the
  smallest safe source span and refuse stale content, marker loss, root-tag changes, reparenting, overlapping
  selections, and edits outside the selected subtree.
- Preserved imported source and manifest bytes as authority. No-edit builds retain comments, ordering,
  whitespace, third-party metadata, unknown files, and partial/passthrough artifacts byte-for-byte.
- Corrected project preview/domain reporting and prevented unrelated Directory Settings saves from restarting
  a million-file corpus scan.

## VALIDATE

- **Real DeadAir census:** 18 files; 1,424 graph nodes; 1,420 links; four MD files; 192 localized raw
  elements; zero whole-cue collapses; zero uncovered/canonical mismatches; zero overlap pairs.
- **Real DeadAir round trip:** `lossless:true`, `strictLossless:true`; all 16 regenerated files byte-identical;
  two partial files preserved; zero dropped files.
- **Real AI Influence census:** 2,925 nodes; zero top-level opaque cues; zero canonical mismatches.
- **Focused deterministic boards:** node selection 15/15; imported layout 6/6; aggregate 10/10; native bridge
  23/23.
- **Full installed candidate:** root build, extension stage/build, VSIX package, and staged sidecar probe 6/6
  passed for `x4-forge-studio-0.0.55.vsix` (17,789,755 bytes).
- **Full isolated browser suite:** 32/32 passed in 274.7 seconds with
  `[run-e2e] VERDICT: PASS`; temporary ports 3100/3101 closed and the live 55060 canvas remained loaded.
- **Oracle layer:** 109/111 completed within the sweep's short timeout. The two aggregate endpoints were then
  run directly and passed: `api-selftest allPassed:true` in 20,999 ms; `selftest 10/10` in 26,746 ms. Every
  constituent oracle was green.
- **Precommit:** tripwires clean, canon mirrors identical, product-copy guard passed, and TypeScript passed.
- **Installed Antigravity UI:** preview visibly showed `1,424 graph nodes · 192 localized raw elements · 0
  whole cues collapsed`; the file picker listed all four MD files; `DynamicWarTimer` navigated to its connected
  graph and opened `Cue-DynamicWarTimer.node.xml`; `<include_actions>` remained at its actual graph position and
  opened `XML-include_actions-.node.xml` with subtree-only save constraints. Evidence:
  `vscode-extension/evidence/0.0.55/deadair-*.png`.
- **Negative paths:** stale/root-changing/reparenting/outside-span edits refused; invalid project paths refused;
  structural validation remained live. The six visible DeadAir project errors are deterministic findings in the
  imported source (for example XSD-unknown `recursive` on `find_ship_by_true_owner`), not dropped-node or compile
  failures.

## REVIEW

- Every executable DeadAir element is visible as a typed or localized raw graph node: **done and evidenced**.
- Unknown descendants no longer collapse whole cues: **done, zero collapses**.
- Unchanged imported output is byte-identical: **done**.
- Typed and localized node edits use the same native editor/validator bridge: **done**.
- Multi-file navigation and non-overlapping layout are visible in the installed product: **done**.
- In-game execution: **out of scope** because no test mutation was deployed; this task proves source/editor and
  package fidelity, not player experience.
- Fresh-eyes review found no second source of truth: imported bytes remain authoritative and the graph remains a
  projection whose accepted edits reparse the source.

## CLOSE

- **Status: VERIFIED.** Public release `0.0.55` was accepted by OpenVSX and the version-specific API returned
  `version: 0.0.55` with its downloadable VSIX before commit.
- **Capability-map delta:** complex Mission Director imports are now lossless per-element graphs with native
  selected-node editing, not whole-cue passthrough.
- **Rollback:** revert the recursive projection/source-span bridge while retaining original-file preservation;
  no real mod or game directory was mutated during validation.
- **Remaining risk:** very large graphs are correct and navigable but may still need performance/presentation
  refinement. Third-party source can also surface real schema findings; those must not be confused with import
  loss.

## AAR

- **Sustain:** real third-party fixtures, exact coverage accounting, byte-identity checks, installed-host proof,
  and a single serialized e2e run prevented a narrow mock from defining success.
- **Improve work/approach:** the first plan treated whole-cue fallback as acceptable; user review correctly
  rejected that product concession and forced the per-element contract.
- **Improve tools:** the oracle sweep's short timeout reports slow aggregate endpoints as red even when their
  constituent tests pass. Keep the direct long-timeout aggregate probe until the harness gains per-route budgets.
- **Highest-risk weakness:** imported bytes and graph mutations could diverge. The bounded mitigation shipped:
  exact source spans, stale tokens, smallest-span splices, reparsing, and refusal of structural escape.
