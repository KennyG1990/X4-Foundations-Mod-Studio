# B119 source-first X4 UI editor design

Date: 2026-08-10
Status: `SPECIFIED`
Owner: GitHub issue #41
Governing brief: `FORGE-UI-EDITOR-BRIEF.md`

## Outcome and decision

The real X4 Lua source is the editor's canonical artifact. The browser derives an ordered, provenance-carrying layout
projection from `ui.xml` plus its registered Lua files, evaluates that projection with the ported X4 layout kernel, and
renders the resulting pixels. Imported source is not converted into the legacy `uiWidgets` model and then regenerated.
Safe edits target exact source ranges through the existing compare-and-swap source bundle; unsupported or dynamic
values remain visible but locked. Design-time settings may be persisted separately, but they never become a deployment
DSL and never replace the Lua that ships.

This selects the source-first projection approach:

1. **Legacy `uiWidgets` as authority — rejected.** It is an absolute-pixel palette whose compiler linearizes widgets
   into a generated two-column table. Translating imported Lua into it would lose table identity, call order, comments,
   dynamic expressions, and byte fidelity. A matching preview could still deploy different code.
2. **Normalized AST/IR followed by whole-file regeneration — rejected.** It can model more syntax, but makes formatting,
   comments, aliases, helper functions, and hand-authored ordering collateral damage. It also creates a second emitter
   whose drift would violate the brief's round-trip requirement.
3. **Source-canonical projection plus bounded source edits — selected.** `ui.xml` registration order and raw Lua remain
   authoritative. The call model and layout projection are disposable derived views. No-edit output is byte-identical;
   an edit changes only its proven source range or a proven insertion point and must reparse before acceptance.

The legacy canvas remains available only as a compatibility/scaffold surface until its generated source is deliberately
materialized. It must not be labelled as the X4 renderer.

## Reconciled evidence and factual corrections

The configured unpacked corpus is already owned by the existing `x4ReferenceRoot` setting, generation-swapped manifest,
and contained `/api/reference/file` route. B119 must use `/api/reference/status`, `/api/reference/manifest`, and
`/api/reference/file`; it must not add a scanner, second setting, direct browser filesystem access, database reader, or
hardcoded machine path. The authoritative geometry snapshots are X4 9.00 `helper.lua` SHA-256
`D24A08B8DA9F2C972794B60ACB48AE36F38CB026C991249DAB9F1164272D4DF2` and `widget_fullscreen.lua` SHA-256
`420AFBA33D925A7B55F2A82AB12773DF04826EF588317010D209B249DE7BAED1`.

The brief says to load a shipped TTF. That file does not exist in the inspected X4 9.00 corpus. The shipped regular and
bold faces are bitmap-font pairs:

- `assets/fx/gui/fonts/textures/zekton_32.abc` plus `zekton_32.dds`
- `assets/fx/gui/fonts/textures/zekton bold_32.abc` plus `zekton bold_32.dds`

Read-only inspection shows a 1024x2048 uncompressed A8 DDS atlas. The `.abc` header carries atlas dimensions and a
Unicode-to-glyph map; fixed-size glyph records carry normalized UV bounds, a signed horizontal bearing, bitmap width,
and advance. Those field meanings and font-size scaling are reverse-engineered evidence, not yet game-proven. The
decoder therefore carries exact asset hashes and an explicit `provisional-until-game-parity` state. A third-party Zekton
webfont is forbidden: it could be a different revision, has separate redistribution terms, and would hide metric drift.

`GetWidgetSystemSizes()` and `C.GetUIScale(false)` are runtime C++ inputs. The corpus proves their names and consumption,
not a universal value. View size, border size, row-group offset, scrollbar width, and UI scale are therefore an explicit
preview profile. A missing or unverified profile produces a visible incomplete-preview state rather than guessed truth.

## Architecture and data flow

The flow has five deterministic stages and one game-authority stage:

1. **Source acquisition.** Build `X4UiSourceBundle` from imported `passthroughFiles` (`ui.xml` and registered `ui/*.lua`),
   the exact custom Lua buffer when applicable, or generated Lua only when the package owner actually emits it.
2. **Ordered semantic projection.** Extend the existing `X4UiCallModel` only for the v1 vocabulary: frame creation;
   tables; pixel/percent width setters; rows; text, button, edit-box, and icon creation; button text; colspan; relevant
   property tables; Helper constants; and `scaleX`, `scaleY`, `scaleFont`. Preserve aliases, call order, receiver identity,
   branch reachability, and source ranges. Dynamic values become typed placeholders/gaps.
3. **Layout program.** Project static ordered calls into immutable frames/tables/rows/cells/widgets. The projection does
   not perform geometry. It records each source origin, sample-value dependency, and refusal reason. A width call after
   the first row remains in source evidence but is refused by the kernel exactly as X4 does.
4. **Geometry and text evaluation.** Evaluate table/row/cell geometry with `x4UiLayoutKernel`. Resolve text using supplied
   sample values, then measure/wrap/truncate through a validated bitmap-font metrics owner. Any missing metric, dynamic
   geometry value, unsupported font/control sequence, or branch ambiguity marks the affected node incomplete.
5. **Browser presentation.** Draw engine pixels on Canvas 2D in logical X4 coordinates; CSS only scales the completed
   bitmap to fit the panel. A separate interaction overlay handles selection handles, diagnostic markers, and keep-out
   polygons, so browser flex/grid never decides X4 geometry.
6. **Deploy and game confirmation.** Package readiness, exact artifact identity, scratch deploy hash, debug evidence,
   and screenshot comparison remain authoritative. The preview never clears its own game-verification state.

Every stage returns provenance, completeness, diagnostics, and an immutable result. No downstream stage upgrades an
unknown input into a number.

## Components and ownership

The implementation remains split so pure source truth is testable without React:

- `x4UiLayoutKernel.ts`: exact Helper/widget geometry; no parser, files, fonts, or DOM.
- `x4UiFontMetrics.ts`: pure parsers for the proven `.abc` and A8 DDS structures, glyph lookup, raw advances,
  hash/provenance, and typed refusal. It consumes caller-supplied bytes only. Font-size conversion, line layout,
  wrapping, and truncation remain downstream and provisional until game-parity evidence validates the inferred fields.
- `x4UiLayoutProgram.ts`: ordered call-model-to-frame/table/row/cell projection. It consumes existing models and the
  kernel; it does not read workspace/configuration or emit source.
- `x4UiRenderer.ts`: pure scene builder plus Canvas drawing commands. The scene is serializable so numeric geometry can
  be tested independently from a browser.
- `x4UiKeepOuts.ts`: normalized, evidence-graded overlay presets and screenshot-calibration data. Presets never change
  engine geometry or source.
- a small corpus-asset client reusing the existing reference endpoints. It fetches fixed corpus-relative paths, checks
  response sizes/headers, computes SHA-256 in the browser, and reports unavailable/stale/malformed states.
- UIBuilder integration: source/registration picker, viewport and UI-scale profile, sample-value panel, overlay toggles,
  diagnostic selection, source-safe property controls, and the permanent `Not verified in game` banner.

If design-time state is persisted, it is a bounded `uiEditorState` containing only active source registration, preview
profile, sample values, overlay toggles/calibration, and the last confirmed deploy identity. It must not contain a
parallel layout tree. Compiler/package output continues to come from the source files or the existing generated source
owner. Imported Lua edits update the exact `passthroughFiles` content through a successful source-bundle CAS result.

Current call-model measurements on the three production menus prove why the projection must be explicit: they parse,
but have many data-flow/text/width gaps, and `createButton`/`createIcon` are not yet first-class relevant calls. A node
may therefore be partially renderable while adjacent dynamic nodes are locked; the UI reports that boundary per node.

## Editing and emission contract

No-edit import/export must preserve every `ui.xml` and Lua byte already preserved by `X4UiSourceBundle`. Editing a
static number/string/boolean uses the value's exact source range and expected text as a CAS precondition. The
replacement must be valid for the field, keep the path contained and uniquely registered, and leave the complete Lua
document parseable. On any stale range, ambiguous registration, locked file, dynamic expression, unsupported source
shape, or syntax failure, the original source bundle object is returned unchanged and the control explains the refusal.

Structural insertion is allowed only at a source location proven by the call model, such as immediately before the
selected table's first row or before the frame's display call. The inserted text is formatted as direct X4 calls—never
as a deployed descriptor—and follows local indentation/newline style. A source insertion is still a CAS splice with an
empty exact range and must reparse. Deletion similarly targets one proven complete statement range. Whole-file
pretty-printing is forbidden.

New layouts start from a minimal, tested X4 menu scaffold containing direct `Helper.createFrameHandle`, `addTable`,
`setColWidth*`, `addRow`, widget creation, and `display` calls. Once materialized, that source is canonical. The legacy
pixel widgets can populate a one-time scaffold only if the user explicitly requests migration; the resulting calls and
all migration warnings are shown before source replacement. Silent conversion is forbidden.

Dynamic text values render as named placeholders tied to the original expression/source location. Sample values affect
only preview measurement. They never replace the Lua expression during export unless the user performs an explicit
source edit. Static re-export acceptance is byte identity; edited re-export acceptance is exact call/value equivalence
plus byte locality, not cosmetic formatting similarity.

## Keep-out overlays

Keep-outs are design-time evidence overlays, not source and not engine collision logic. Each polygon/region carries an
ID, context, coordinate space, provenance, evidence grade, notes, and optional screenshot hash. The initial measured
facts are:

- conversation wheel Back row at approximately `y = 0.788 * drawableHeight`; an unobscured multi-option stack begins
  around `y = 0.74 * drawableHeight`;
- INFORMATION/NPC-video panel leftmost edge at approximately `x = 0.664 * drawableWidth`, extending to bottom-right
  as a parallelogram.

Mission/MESSAGES ticker and top HUD bar are required presets, but their exact extents were not measured in the brief.
They must be sourced from shipped UI layout code or a calibrated screenshot before receiving a measured grade. Until
then they render with a visibly different `reference/unmeasured` treatment and must not claim a safe boundary.

Context presets—cockpit conversation, map open, fullscreen menu, and first person—compose these regions without
modifying the preview scene. Users can toggle individual regions. Screenshot calibration stores the screenshot's
drawable bounds and user-drawn polygon in normalized coordinates, with the screenshot hash and profile; it does not
attempt automatic computer vision in v1. The canvas shows both the polygon and its provenance/evidence label.

Negative behavior is explicit: a keep-out may warn about overlap, but it never blocks package/deploy unless a separate
policy is later specified. Missing calibration yields `unmeasured`, not a made-up rectangle. Changing viewport or UI
scale recomputes normalized overlays and source-derived geometry independently. The acceptance screenshot records must
prove the measured wheel and information-panel boundaries at 2560x1440, while the source/calibrated ticker and top-bar
presets identify their own evidence.

## Error handling and truth states

The editor uses orthogonal states instead of one misleading green badge:

- **Static rules:** blocked, warnings, no known rule violated, or analysis incomplete.
- **Source projection:** complete, partial, dynamic, locked, missing, or ambiguous.
- **Metrics:** exact asset loaded, provisional field mapping, unavailable/stale/malformed, or unsupported font.
- **Preview profile:** supplied/captured with provenance or unverified default.
- **Game:** always `Not verified in game` until an exact package artifact is deployed and explicitly confirmed against
  the same artifact hash. Editing source or profile after confirmation invalidates that confirmation.

A scene may render known geometry while showing striped/outlined unknown nodes. It may not assign fallback geometry to
an unknown numeric expression. Missing Zekton assets disable text-wrap/truncation claims; boxes may still show table
geometry, labelled `text metrics unavailable`. An unsupported glyph/control code records a source-linked gap. A malformed
font asset or mismatched atlas dimension is a refusal, not a browser-font fallback.

Package and deploy remain controlled by the existing compiler/readiness/validation owners. `addTable(24+)` remains a
blocking measured rule; 13-23 remains warning plus in-game requirement. C++ frame acceptance cannot be inferred from a
complete scene. The deploy-confirm record stores artifact ID, relative Lua registration(s), hash(es), deployed target,
timestamp, and confirmation evidence. A confirmation clears only the exact matching snapshot; any source byte change,
artifact-ID change, registration-order change, metric/profile change relevant to comparison, or new blocking finding
returns the product to `Not verified in game`.

## Implementation sequence and validation

1. Accept the pure layout kernel against source-derived goldens.
2. Implement and validate the shipped bitmap-font decoder/metrics owner. Synthetic corruption tests plus corpus
   invariants must pass. Do not call metrics exact until a running-game measurement or screenshot parity validates
   field interpretation and scaling.
3. Expand the call model for the full v1 vocabulary and implement the pure ordered layout-program projection. Test
   static, chained, aliased, multi-table, conditional, dynamic, and post-row-width cases using direct X4 calls.
4. Build the serializable scene and Canvas renderer with explicit incomplete-node presentation. Add viewport/UI-scale
   controls and exact corpus asset loading.
5. Add evidence-graded keep-outs and manual screenshot calibration.
6. Wire imported passthrough source selection, sample values, CAS property edits, and direct-call insertions into
   UIBuilder. Preserve the legacy designer as clearly separate until migration is accepted.
7. Prove no-edit byte identity and edited byte locality through compile/export/package. Run shared validation and IDE
   Problems parity.
8. Run broad static/oracle/E2E/build/installed-host gates after the machine-state gate is cleared.
9. Deploy only a scratch artifact after the explicit write gate. Record exact hashes, then compare at least three real
   menus against in-game screenshots for columns, row heights, wrap, and truncation. Retain `PARTIAL` until those pass.

Required negative paths include malformed/truncated `.abc` and DDS, wrong atlas dimensions, missing corpus, stale
manifest, dynamic width/text/branch, unsupported font/control sequence, width setter after first row, unsafe source path,
duplicate registration, stale CAS, syntax-breaking edit, keep-out without measurements, export hash mismatch, and a
preview that remains visibly unverified despite every focused test passing.

Rollback is file-local: remove the new pure projection/metrics/renderer owners and UI wiring; imported source remains in
its original passthrough bytes, package identity remains on the existing resolver, and the legacy editor continues to
operate. No corpus, game, deployed mod, or installed configuration is ever mutated by preview work.
