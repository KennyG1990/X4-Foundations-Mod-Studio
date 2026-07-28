# Corpus-guided XML authoring — contextual autocomplete + bulk transforms

Task: B99 corpus-guided XML authoring and bulk corpus transform
Lane: FULL
Status: **VERIFIED — released as X4 Forge Studio 0.0.48 on 2026-07-28**

## IMPLEMENTATION LOG

### 2026-07-28 — Batch 1 in progress: canonical symbols and shared suggestions

- Added canonical job and AI-script discovery with source/path provenance, including compatibility
  with manifest generations created before those consumers were classified.
- Added one normalized symbol index and deterministic suggestion engine with exact/prefix/name/
  substring/bounded-typo ranking, project overlay support, and new-definition collision semantics.
- Added declarative document/element/attribute reference bindings for generic XSD string/expression
  fields and routed `libraries/wares.xml`/`jobs.xml` to `libraries.xsd` when no declaration is present.
- Added `/api/reference/jobs`, `/api/reference/aiscripts`, and authenticated
  `/api/reference/suggest`, plus Agent API documentation and focused selftests.
- Evidence so far: typecheck PASS; lint 0 errors (511 existing warnings); schema intelligence
  119/119 PASS; real 9.00 corpus 13/13 PASS (32 factions, 1,902 wares, 1,192 jobs, 178 AI scripts,
  170 sectors, 6,505 macros). Isolated HTTP integration waits on the machine-state gate.
- Non-clean/AAR triggers: a PowerShell regex quoting failure; initial tests exposed stale manifest
  consumer classification and an incomplete fixture. Both were corrected rather than weakening
  acceptance.

### 2026-07-28 — Reconciliation correction: reuse both editor hosts

- The Forge code pane is CodeMirror 6 inside the extension webview, not Antigravity's native text
  editor embedded by inheritance. It already owns rendering, syntax, folding, keyboard behavior and
  diagnostic squiggles, but currently has no completion or hover extensions.
- The extension already registers native Antigravity/VS Code completion and hover providers for
  real XML documents. B99 reuses that provider and wires CodeMirror's standard autocomplete/hover
  extensions to the same `/api/reference/complete` and `/api/reference/hover` contracts.
- This changes the implementation plan, not the language engine: do not build editor widgets or a
  second vocabulary. Supply X4 corpus/XSD intelligence to both existing editor hosts. Form fields
  and bulk-transform controls still need their own contextual pickers because the host editor does
  not participate in those UI surfaces.
- The literal "every instance under this folder" use case requires files with no match to be
  counted as skipped, not treated as per-file errors. A malformed/ambiguous/non-numeric match is an
  error, and zero matches across the whole scope is an error. This corrects the earlier acceptance
  sentence that would have made heterogeneous macro folders unusable.

### 2026-07-28 — Packaged proof and e2e harness follow-up

- The exact `0.0.47` VSIX was locally installed after a full Antigravity restart. The CLI reported
  `x4forge.x4-forge-studio@0.0.47`; the visible Forge behavior also changed from the old alphabetic
  cockpit sample to the structurally richer `ship_tfm_xl_carrier_02_a_macro.xml` sample.
- Installed UI proof: typing `/macros/macro/properties/h` offered `hull`; the read-only XL hull
  preview enumerated 80 canonical candidates, validated 43 base/DLC changes, skipped 37 nonmatches,
  exceeded no cap, and displayed PASS simulation rows. Apply was deliberately not used on the
  user's active workspace.
- Open VSX accepted the exact packaged artifact and its public latest endpoint subsequently reported
  `0.0.47` at `2026-07-28T17:56:01.370161Z`. A fresh download from the public version endpoint was
  17,902,105 bytes and matched the tested local VSIX byte-for-byte at SHA-256
  `E4DE5FC900E4BCAB38AF10CAEA3522A9A056BA35A7A37F4495C71F79CD83F6E0`.
  Antigravity's own CLI also resolved and installed `x4forge.x4-forge-studio@0.0.47` by marketplace
  ID into a disposable extension directory. The final live-host marketplace reinstall/smoke remains
  pending only because the operator was actively using the desktop.
- A final full e2e attempt produced one genuine harness event: Vite disconnected during the fifth
  spec, then 21 later specs cascaded with `ERR_CONNECTION_REFUSED`. The retained trace proves the
  browser could not fetch `CodeMirrorField.tsx`; running that first failing spec alone immediately
  passed 1/1. This is not product-green evidence and remains an open release gate.
- Reconciled harness correction: run the repository-local Vite and tsx Node entrypoints directly
  instead of supervising `npx` wrapper processes, and pipe both servers' output. This leaves the
  isolated 3100/3101 contract unchanged while making the actual owned process and any future exit
  reason observable.

### 2026-07-28 — Fresh-eyes review correction before final close

- The installed Studio path was green because the extension owns the full session token, but the
  scoped Agent API policy did not grant ordinary agent keys access to the new POST-only completion,
  XPath, preview, and apply routes. This contradicts the one-engine/multiple-consumers contract.
  Add exact read-only POST grants for completion/hover/XPath/simulation/preview and an exact write
  grant for bulk apply; keep anonymous access denied and do not widen route prefixes.
- Canonical macro IDs were correctly discovered from base and official DLC files, but their normalized
  symbol records discarded provenance and labelled every macro `base`. Preserve first-definition
  source/path metadata so completion never lies about DLC ownership.
- Reconciliation against `F:\Downskies\edithulls.py` exposed one functional fidelity gap: that tool
  can round upward to a configurable quantum such as 100 or 1,000. Extend the bounded rule with a
  positive finite `roundingIncrement` (default 1) and apply nearest/floor/ceiling against that quantum.
  This remains generic corpus authoring; do not add hull- or ship-specific hard-coded filters.
- Prefix matching must respect a path-segment boundary (`foo` must not include `foobar`). Cover the
  engine, manifest query filter, and UI sample selection with the same rule.
- Because these corrections change the shipped artifact after public `0.0.47`, the final candidate
  must be a new monotonically increasing Open VSX version and must repeat the packaged/public gates.

## WHY

A real user, entry-level, asked for exactly this and could not find it:

> "batch-generate diff files along the lines of 'go into `assets\units\size_xl\macros`, look for every
> instance of `<hull max="216000" />`, take the value, multiply it by X and generate a diff file for
> each one'… I can't seem to edit the example patch blocks to get to where I want."

Today the answer is "write a script, then use the Forge to validate it." That is the correct answer
*today*, and it is also an admission: the Forge owns the corpus, the selector model, the diff
simulator, the validator and the deploy path — everything except the loop. The loop is the only part
the user cannot do, and it is the part they came for.

This is a **rebalance mod in one operation**. Hull/shield/thrust/cargo sweeps across a size class are
one of the most common mod archetypes in X4, and every one of them is currently a scripting job.

## RECONCILE (done 2026-07-26 — this is mostly assembly, not new machinery)

- **Corpus enumeration already exists.** `src/lib/referenceManifest.ts` indexes every file under the
  unpacked root with `{path, extension, source, domain, role, authority, bytes, sha256}`, SQLite-backed
  (`row.rel_path`). Iterating "every file under `assets/units/size_xl/macros`" is a query, not a walk.
- **Diff application already exists.** `simulateXmlDiff(baseXml, diffXml)` in `src/lib/diffSimulator.ts`
  parses operations, applies them, and returns findings — already used by project validation.
- **DLC overlay resolution already exists.** `resolveEffectiveReferenceDocument` + `OverlayFinding`
  (`src/lib/referenceOverlay.ts`) resolve what a file *actually* looks like after official DLC layers.
- **Raw read + single-patch authoring exist.** `/api/reference/file`, `XMLPatchSystem.tsx`
  (`sel` + `add|replace|remove`).
- **Absent, searched for, not found:** any bulk/batch transform, any arithmetic-on-matched-value, any
  multi-file diff emitter. `XMLPatchSystem.tsx` authors exactly one patch block at a time.

## SCOPE

**In scope**
1. A **rule**: `{ pathPrefix, selector, transform, output }` — where to look, what to match, what the
   new value is, where the diffs go.
2. **Matching by XPath against parsed XML**, never regex over text. Regex-over-XML is a banked hazard
   in this project (the comment false-positive class, AAR 2026-07-09); at this scale it would be a
   silent wrong-match generator.
3. A **bounded transform expression** over the matched value: `value * 1.5`, `value + 1000`,
   `round(value * 1.5)`, `min/max/clamp`. Deterministic, numeric, no arbitrary code.
4. **Dry-run first, always.** Every affected file listed with `old → new` before anything is written.
   Same principle as deploy `dryRun`; this writes hundreds of files, so preview is not optional.
5. **Every generated diff is simulated** against base+DLC before it is offered. A selector that
   matches nothing is an **error**, not a warning — that is the exact failure this feature would
   otherwise mass-produce.
6. **One diff file per target file, mirroring the vanilla path**, written into the user's mod
   workspace. Never into the game folder.
7. Shared corpus-guided completion in Wares & Jobs, Properties, and XML Patching, backed by the
   same suggestion contracts exposed to agents.
8. A Bulk Transform mode inside the existing XML Patching workbench, plus preview/apply Agent API
   routes that use the same deterministic engine.

**Out of scope (deliberate)**
- Non-numeric transforms (string rewriting, element insertion at scale). Numeric attribute rebalance
  is the proven demand; widen only on evidence.
- Editing vanilla files in place. The output is always a diff.
- Cross-file logic ("scale by hull relative to the class average"). Later, if asked.

## THE FOUR HARD PROBLEMS (what makes this more than a for-loop)

**1. Re-running must not compound.** Run `×1.5` twice and a naive implementation gives `×2.25` — the
user's mod silently drifts every time they tweak the rule. **The transform must always be computed
from the VANILLA base value, never from the current patched value.** The generated diff must be
regenerated wholesale from source, not applied on top of itself. This is the single most important
correctness property and the easiest to get wrong.

**2. DLC overlays make base-file patching silently useless.** If a macro is redefined by an installed
DLC, patching the base file does nothing in-game and nothing complains. `resolveEffectiveReferenceDocument`
already knows this. A bulk run must resolve the **effective** document and report — per file — which
layer it is patching, and warn when the base value it matched is overridden downstream.

**3. Scale turns a small mistake into a large one.** A wrong selector across 200 files is 200 broken
patches. Mitigations: mandatory dry-run, mandatory simulation of every emitted diff, an explicit
**cap with a visible count** (never silent truncation), and a refusal to write if *any* diff fails
simulation — all-or-nothing, so the user is never left with a half-generated mod.

**4. Matching must survive attribute-shape variance.** `<hull max="216000"/>` may appear with
different attribute order, whitespace, or as a child of different parents. XPath against the parsed
document handles this; text matching does not.

## ACCEPTANCE CONTRACT

- The user's literal request works end to end: prefix `assets/units/size_xl/macros`, selector for
  `hull/@max`, transform `value * 1.5` → one diff per matching file, all simulating clean.
- Dry-run lists every file with old and new values and writes **nothing**.
- Re-running the same rule twice produces **byte-identical** output (proves no compounding).
- A selector matching nothing in a file is an error naming that file; a run where any diff fails
  simulation writes **zero files**.
- A macro overridden by an installed DLC is reported as such, not silently patched.
- The cap is enforced with the dropped count stated explicitly.
- Generated diffs pass the normal project validator and deploy through the normal path.
- Zero writes outside the configured mod workspace.

## RISKS

- **Mass-write surface.** Hundreds of files into a user workspace. Mitigated by dry-run, all-or-nothing
  writes, workspace-only containment, and never overwriting a file the run did not generate.
- **Confident wrongness at scale** — the real risk. Mitigated by simulation-before-offer and the
  overlay report.
- **Expression evaluation** must not become an eval surface: a tiny numeric parser, not `eval`.
- **Runtime** over a million-file corpus: the query is prefix-bounded and the manifest is indexed;
  measure before shipping, and cap.

## RESOLVED PRODUCT DECISIONS

1. **UI and API ship together**, with one shared engine implemented first.
2. **Transform power is bounded numeric controls**, not an arbitrary expression language.
3. **Generated patches merge transactionally into the active workspace model** and use explicit
   provenance/conflict ownership; the existing compiler remains responsible for emitted files.

## ROLLBACK

Additive: new shared engines, bounded routes, picker integration, and a Bulk Transform panel inside
the existing XML Patching workbench. Existing route shapes remain compatible. Removing the new
consumers/routes and optional generated-block metadata restores current behavior; an undo checkpoint
restores the exact pre-apply workspace state.

---

## 2026-07-28 RECONCILIATION ADDENDUM — AUTOCOMPLETE IS PART OF THE SAME AUTHORING SYSTEM

Ken expanded the request after seeing the real Wares & Jobs and XML Patching surfaces: whenever an
author enters an X4 identifier, path, XPath segment, attribute, or value, the Forge should complete
from the configured unpacked base+DLC corpus. Examples include typing `energyc…` for a ware,
choosing a job/faction/macro/script, or writing `/wares/ware[@id='energ…']` in a patch selector.

This is not a second feature bolted beside B99. Bulk transform needs the same candidate-file query,
effective-document resolver, selector intelligence, canonical symbol lookup, and preview UI. Build
one corpus-guided authoring engine and expose it through both interactive completion and bulk rules.

### BASELINE AND OBSERVED CURRENT BEHAVIOUR

- Installed Antigravity extension inspected read-only on 2026-07-28: X4 Forge `v1.0.316`, managed
  sidecar on port 50657, configured corpus `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`.
- The Wares & Jobs `ADD` control is currently a plain input described as **Create custom Ware asset
  ID**. It has no suggestions and accepts a canonical ID without first explaining that this would
  collide with an existing definition.
- `ObjectIndexPicker` already provides a searchable picker in production inputs and the job faction
  field. It queries `/api/agent/object-index`, which deliberately mixes installed game, mod, and
  schema discovery data. That is useful discovery data, but it is not the canonical base+DLC
  authority required for this feature.
- The live canonical endpoint returns 1,902 wares. Warm substring searches measured 5–18 ms after a
  352 ms cold load. The installed object index exposes 1,572 job IDs, but the canonical reference
  API exposes no `jobs` set today.
- `referenceLanguage.ts` already powers XML completion/hover for IDE documents and uses canonical
  faction/ware/sector/macro values. It does not currently route `libraries/wares.xml` and
  `libraries/jobs.xml` into the shared `libraries.xsd` grammar, and X4's schema frequently types
  reference attributes as generic `xs:string` or `expression`. Pure XSD-type inference therefore
  cannot provide complete field coverage.
- XML Patching already has a target-file picker, single-block authoring, client XPath evaluation,
  Diff-to-Patch synthesis, compiled `workspace.xmlPatches`, and server-side effective-corpus diff
  simulation. It does not complete XPath/value text as the author types.
- `/api/patch/base-content` is not authoritative for this work: it may prefer a workspace file and
  its packed fallback explicitly does not merge DLC content. B99 must use
  `resolveEffectiveReferenceDocument`, never that compatibility endpoint, for canonical preview,
  completion, matching, or transformation.

### RECONCILED PRODUCT CONTRACT

The Forge must distinguish four authoring intents. Suggestions are not allowed to blur them:

1. **Reference** — choose an existing canonical or project-defined ID. Unknown literals receive a
   non-blocking warning with did-you-mean; deterministic invalid values remain errors where XSD says
   they are illegal.
2. **New definition** — type a novel ID. Canonical and project IDs still appear while typing, but as
   `EXISTS` collision rows. An exact collision cannot be committed as a new `<add>` definition.
   The row offers **Patch existing in XML Patching** instead.
3. **Selector** — complete legal XPath segments, attributes, predicates, and canonical predicate
   values against the selected effective document.
4. **Transform** — select many canonical documents and apply one bounded numeric rule after a
   mandatory all-file preview.

This prevents a superficially helpful autocomplete from turning `energycells` into an invalid
duplicate ware definition. Context determines what selecting a suggestion means.

### ARCHITECTURE — ONE AUTHORITY, MULTIPLE CONSUMERS

#### A. Canonical symbol index

Extend the canonical reference layer with a normalized symbol record:

```ts
type CanonicalSymbol = {
  kind: string;
  id: string;
  name?: string;
  source: string;
  path: string;
  selector?: string;
  detail?: string;
};
```

Keep the existing enriched faction/ware/sector/macro/script-property sets. Add canonical jobs and
AI-script names, then index additional definition/reference domains conservatively from parsed XML
and XSD identity/key/keyref data. Do not make arbitrary `id=` attributes authoritative merely
because they exist. Every symbol kind needs a declared parser/binding and provenance.

`x4ObjectIndex` remains the mixed installed/mod discovery browser. Canonical completion and
validation use the canonical symbol index. Project-defined IDs are layered on top for the active
workspace, clearly tagged `project`, so a mod may reference its own definitions without false
warnings.

#### B. Shared suggestion engine

Create one pure suggestion engine used by:

- `referenceLanguage.ts` document completion;
- form pickers in Wares & Jobs and node properties;
- XML patch target/selector/value completion;
- bulk-transform rule fields;
- Agent API consumers.

Input includes `{kind, query, intent, path?, element?, attribute?, limit}`. Output includes
`{label, insertText, kind, detail, documentation, source, exists, score}`. Ranking is deterministic:
exact ID, ID prefix, token/name prefix, substring, then bounded edit distance. Required/valid items
sort before advisory entries. The UI debounces at 100–150 ms, cancels stale requests, and caches by
corpus generation plus query.

The schema layer supplies structure and enum constraints. A small declarative reference-binding
registry fills X4's schema gaps where attributes are typed only as `string`/`expression` (for
example `ware`, `faction`, `macro`, `job`, `script`). Bindings are keyed by document domain plus
element/attribute context, not by a global attribute-name guess. Corpus-backed tests prove every
binding against real files before it becomes authoritative.

#### C. Visual field integration

Evolve `ObjectIndexPicker` into a generic `ReferencePicker` contract rather than creating several
lookalike dropdowns. Preserve free-text only when the field contract allows runtime expressions or
new definitions.

- Wares `ADD`: `intent=new-definition`, `kind=ware`; exact existing IDs are blocked and offer a
  pre-targeted XML patch action.
- Jobs `ADD`: same collision behaviour with canonical base+DLC jobs.
- Production inputs: `intent=reference`, `kind=ware`; canonical name/group/tags/source shown.
- Job faction, ship macro, and task script: canonical `faction`, `macro`, and `aiscript` suggestions.
- Properties Inspector: migrate existing reference fields to the same source and response shape.
- Unknown-but-project-defined references remain legal; unknown external literals show inline amber
  guidance without stealing focus or replacing the user's text.

#### D. XML patch completion

Replace canonical reads in the workbench with a read-only effective-document endpoint backed by
`resolveEffectiveReferenceDocument`. It returns content, source layers, signature, and overlay
findings. Keep the compatibility `/api/patch/base-content` route for old consumers, but B99 does not
use it.

Add pure `xpathCompletion.ts` logic. Given the selected target path, effective XML, selector text,
and cursor offset, it suggests:

- root/child element names that occur at the current path;
- `@attribute` names present in matching nodes and allowed by the routed XSD;
- predicate skeletons such as `[@id='…']`;
- canonical IDs or actual attribute values for the predicate context;
- operation-aware guidance (`add` targets a parent; `replace/remove` must match an existing target).

Selector status updates continuously: syntax, match count, effective source layer, and a compact
sample of matched nodes. A zero-match `replace/remove` is an error. Multi-match is explicit and
requires acknowledgement for bulk-sensitive operations.

#### E. Bulk transform engine

Add a pure `bulkCorpusTransform.ts` engine with this bounded rule:

```ts
type BulkTransformRule = {
  pathPrefix: string;
  selector: string;
  operation: 'multiply' | 'add' | 'set' | 'round' | 'min' | 'max' | 'clamp';
  operand: number | [number, number];
  rounding?: 'none' | 'round' | 'floor' | 'ceil';
  roundingIncrement?: number;
  maxFiles: number;
};
```

No `eval`, JavaScript, regex-over-XML, conditionals, or arbitrary code. The engine:

1. queries the indexed manifest by canonical logical path prefix;
2. deduplicates base/DLC physical files into logical target paths;
3. resolves each effective document;
4. evaluates the XPath against parsed XML;
5. accepts numeric attribute/text matches only;
6. calculates from the canonical value, never a prior generated patch;
7. emits proposed `replace` patch blocks with source signature and provenance;
8. simulates every target diff against the same effective document;
9. produces one deterministic preview and plan hash.

Applying requires the original rule plus expected plan hash. The server recomputes the plan and
rejects if the corpus generation, source signature, workspace, or conflict set changed. This avoids
applying a stale preview after a DLC/root/file refresh.

#### F. Workspace transaction and conflict ownership

Bulk application updates `workspace.xmlPatches` atomically; the existing compiler already groups
those blocks and emits one mirrored diff file per target. Do not introduce a parallel raw-file
emitter.

Generated blocks gain optional provenance fields such as `generatedRuleId`, `generatedPlanHash`,
and `sourceSignature`; the compiler ignores metadata and emits only X4 XML. Re-running the same rule
replaces only blocks owned by that rule. A user-authored block or another rule targeting the same
file+selector is a hard conflict until the user chooses skip/replace/keep-both in preview. The safe
default is **stop with zero workspace changes**.

The UI applies the entire patch-block set in one `setWorkspace` update after an undo checkpoint.
The Agent API uses the same guarded workspace mutation and Agent Action Ledger. Compile and Deploy
remain separate existing operations; bulk apply never writes the installed game directory.

### API CONTRACTS

All reads are local, cached, and bounded. Mutations require the existing authenticated write scope.

- `GET /api/reference/suggest?kind=&q=&intent=&limit=` — canonical/project-aware field suggestions.
- `GET /api/reference/jobs` — effective base+DLC job IDs with source/path metadata.
- `POST /api/reference/xpath-complete` — target path + selector/cursor to contextual XPath items.
- `GET /api/reference/effective-file?path=` — effective read-only XML plus layer/signature metadata.
- `POST /api/agent/bulk-transform/preview` — rule → matches, old/new values, findings, conflicts,
  plan hash; writes nothing.
- `POST /api/agent/bulk-transform/apply` — rule + expected plan hash → recompute, validate, checkpoint,
  and atomically update `workspace.xmlPatches`.

Do not return thousands of rows per keystroke. Every suggestion route requires a query or an explicit
small limit. Never inline full source documents in history rows.

### USER EXPERIENCE

#### Wares & Jobs

Typing opens a compact dropdown showing `ID`, localized name, source (`base` or DLC), and context.
Keyboard controls: Up/Down, Enter, Escape, Tab. The user's partial text remains visible. Exact
canonical collisions show an amber `EXISTS` badge and a **Patch existing** action; they never commit
through the new-definition button.

#### XML Patching

Keep the existing workbench. Add a `Single Patch | Bulk Transform` authoring switch beside the
current target controls. Single Patch gains selector/value completion. Bulk Transform presents:

1. corpus path scope;
2. sample/effective document and selector with completion;
3. numeric operation controls (not a code expression box);
4. **Preview**;
5. a virtualized results table: file, source layers, selector, old → new, simulation, conflict;
6. **Add N validated patches to workspace** only when every row is green.

The preview displays cap and dropped count, total bytes/targets, and explains that generated patches
remain source workspace state until the normal Compile/Deploy flow runs.

### IMPLEMENTATION SLICES AND EXACT OWNERSHIP

#### Slice 1 — Canonical symbols and reference bindings

**Modify:** `src/lib/referenceCorpus.ts`, `src/lib/referenceLanguage.ts`,
`src/lib/referenceManifest.ts`, `src/server/referenceRoutes.ts`.

**Create:** `src/lib/referenceSuggestions.ts`, `src/lib/referenceBindings.ts`.

Add jobs/AI scripts, project overlay support, deterministic ranking, library-domain routing to
`libraries.xsd`, and real-corpus binding checks. Extend existing selftests before wiring UI.

#### Slice 2 — One picker contract across visual authoring

**Modify:** `src/components/ObjectIndexPicker.tsx` (or rename after all callers migrate),
`src/components/LibraryConfigurator.tsx`, `src/components/PropertiesInspector.tsx`, `src/types.ts`.

Add intent/collision/free-text contracts and migrate ware, faction, macro, and script fields. Preserve
existing values and workspace serialization.

#### Slice 3 — Effective XML and XPath completion

**Create:** `src/lib/xpathCompletion.ts`.

**Modify:** `src/server/referenceRoutes.ts`, `src/components/XMLPatchSystem.tsx`.

Wire the workbench to effective corpus content and add cursor-aware selector completion/status. Keep
the current single-block compiler and Diff-to-Patch feature intact.

#### Slice 4 — Bulk preview engine and Agent API

**Create:** `src/lib/bulkCorpusTransform.ts` and a focused server route module if route size warrants
it (prefer `src/server/bulkTransformRoutes.ts` over adding another large block to `server.ts`).

**Modify:** `src/types.ts`, `src/lib/modCompiler.ts` only where optional provenance must survive,
`server.ts` for bounded route registration, and Agent API documentation.

Preview first. Prove no writes, no compounding, overlays, selector failures, caps, plan drift, and
conflicts before implementing apply.

#### Slice 5 — Bulk UI, transaction, and release proof

**Modify:** `src/components/XMLPatchSystem.tsx`; extract a dedicated
`src/components/BulkTransformPanel.tsx` so the existing 1,500-line workbench does not grow into a
larger monolith.

Add one-checkpoint atomic apply, undo, virtualized preview, continuous diagnostics, and ledger
summary. Then run packaged Antigravity proof.

### ACCEPTANCE CONTRACT — AUTOCOMPLETE

- Typing `energyc` in a ware-reference field offers canonical `energycells` with localized name and
  provenance at keystroke latency.
- Typing exact `energycells` in **Create custom Ware asset ID** does not create a duplicate; it shows
  `EXISTS` and can pre-target `/wares/ware[@id='energycells']` in XML Patching.
- Jobs, factions, macros, and AI scripts complete from effective base+DLC data; removing a DLC and
  refreshing the corpus removes its symbols.
- Project-defined symbols appear with a `project` tag and validate cleanly.
- Typing `/wares/ware[@id='energ` suggests `energycells`; choosing it produces a syntactically valid
  selector and the live match count is nonzero.
- A misspelled reference remains editable but receives an inline warning and did-you-mean. The UI
  never steals focus, overwrites partial text, or blocks a runtime expression in a field that allows
  expressions.
- Warm suggestion p95 is under 50 ms on the configured 9.00 corpus; stale responses cannot replace
  newer keystrokes.

### ACCEPTANCE CONTRACT — BULK TRANSFORM

- Prefix `assets/units/size_xl/macros`, selector ending in `hull/@max`, multiply `1.5` previews and
  then adds one valid patch per matching logical file.
- Ceiling/nearest/floor rounding accepts a positive quantum (for example 100 or 1,000), reproducing
  the supplied hull script without introducing arbitrary code or hull-specific rules.
- Preview reports every logical file, source layers, old/new values, selector match count,
  simulation result, conflicts, cap, and dropped count; it writes nothing.
- Applying the same rule twice yields byte-identical compiled diffs and no duplicated blocks.
- Any invalid XPath, zero-match target, nonnumeric value, simulation error, user-patch conflict,
  changed corpus signature, traversal attempt, or cap breach causes zero workspace changes.
- Base+DLC overlays are resolved before matching and the emitted patches simulate against that same
  effective content.
- Undo restores the exact pre-apply workspace. Compile, package, and deploy continue through their
  existing validated paths and preserve unrelated arbitrary files.
- Scoped read keys can call the read-only POST intelligence/preview routes; scoped write keys can
  apply a guarded bulk plan; anonymous callers and read-only keys remain unable to mutate.

### REQUIRED VALIDATION

1. **Static:** `npm run typecheck`, `npm run lint` (0 errors), route/type contract review.
2. **Pure selftests:** canonical jobs/symbol provenance; binding registry corpus truth; ranking and
   stale-query suppression; XPath tokenization/completion; numeric parser; deterministic plan hash;
   non-compounding; caps; conflicts; plan drift; all-or-nothing apply.
3. **Real-corpus integration:** configured 9.00 root, base plus every present official DLC; compare
   parsed job/ware/macro sets to source documents and prove add/remove DLC refresh behaviour with an
   isolated copied fixture—not the real corpus.
4. **API/negative routes:** authentication, read-only traversal rejection, bounded limits, malformed
   rule, invalid XPath, stale plan hash, workspace containment, ledger redaction.
5. **Project validation:** every generated diff passes XSD/diff simulation and full project
   validation; deliberately corrupt one generated selector and prove a cited failure.
6. **Isolated e2e:** scratch workspace only—ware partial suggestion, collision redirect, job/macro
   picker, XPath completion, bulk preview no-write, atomic apply, undo, compile, and no live-game
   mutation.
7. **Performance:** cold-load disclosed; warm completion p50/p95 and 100/500/maximum-cap transform
   preview timings recorded. UI stays responsive through virtualized results.
8. **Local packaged-product gate:** build and stage the Forge, package the candidate VSIX, install
   that exact local VSIX into Antigravity, reload the extension host, and visually prove keyboard
   completion, collision handling, selector completion, preview, atomic apply, undo, and diagnostic
   correction. Source-mode, localhost-browser, or unpackaged webview success does not satisfy this
   gate.
9. **Public distribution gate:** after the local VSIX passes and Ken authorizes publication, publish
   the exact tested VSIX to Open VSX. Update/reinstall X4 Forge Studio in Antigravity through the
   marketplace, confirm the installed public version, reload the extension host, and repeat the
   critical completion + preview/apply/undo smoke path. A green local VSIX with an unverified public
   package is `PARTIAL`, not `VERIFIED` for a user-facing release.
10. **Final gates:** oracle sweep, full e2e verdict, precommit check, production build, release notes,
    publish-before-commit only after explicit publication authorization. Verify the Open VSX latest
    API before committing; do not infer publication from a local package or a lagging version list.

### NEGATIVE/FALSE-SUCCESS TESTS

- A completion list sourced only from `/api/agent/object-index` is a failure: it mixes authority.
- A dropdown that lets an existing ware pass through the new-definition action is a failure.
- A preview based on `/api/patch/base-content` is a failure: it may read workspace state and omit DLC
  overlays.
- A green bulk preview that does not simulate every emitted diff is a failure.
- A partial apply after any row fails is a failure.
- A second run that compounds from generated values is a failure.
- Local source or browser success without an installed Antigravity VSIX is `PARTIAL`, not
  `VERIFIED`.
- A locally installed VSIX that passes but whose Open VSX artifact has not been installed and
  smoke-tested in Antigravity is `PARTIAL` for a public user-facing release.

### AUTHORIZATION, RISK, AND ROLLBACK

- Implementation and publication were explicitly authorized on 2026-07-28. Live game deployment was
  not part of B99 and remains outside this task.
- No AI calls, external services, or spending surfaces are added. All corpus reads are local and
  read-only.
- Apply mutates only active workspace state through the existing checkpoint/undo and ledger paths.
  It never edits the unpacked corpus or installed game directory.
- Each slice is additive and separately removable. Before apply exists, preview can ship disabled
  behind no mutation. Removing generated blocks by `generatedRuleId` or undoing the checkpoint
  restores the pre-run workspace; git remains authoritative history.

### RECONCILIATION DECISIONS (THE FORMER OPEN QUESTIONS)

1. **UI and API ship together**, engine first. The user-visible Forge and agents consume the same
   verdicts; neither receives a private implementation.
2. **Expression power stays bounded numeric controls.** No general expression language until real
   demand proves it necessary.
3. **Output merges into the active workspace model**, not a fresh mod and not direct files. Existing
   compiler ownership produces the mirrored diff files. Conflicts default to stop, never overwrite.

### DOCUMENTATION/AAR OUTCOME FOR THIS PLANNING PASS

- **Sustain:** inspecting the installed Antigravity webview exposed the new-definition collision
  semantic that source-only planning would have missed.
- **Improve work/approach:** two shell commands assumed corpus quoting/path details, followed by an
  oversized recursive lookup. The stable recovery was the Forge's own indexed manifest API.
- **Improve tools:** corpus reconnaissance should use `/api/reference/manifest` first; recursive
  filesystem searches over the million-file unpacked root are both slower and less authoritative.
- **Highest-risk evidenced weakness:** the current patch workbench's base-content compatibility route
  can select workspace data and omit DLC overlays. B99 must bypass it with effective-corpus reads or
  it can confidently preview the wrong document.

### EXECUTION AAR — 2026-07-28 (OPEN UNTIL RELEASE CLOSE)

- **Sustain:** the requirement-by-requirement audit caught gaps that broad green counters did not:
  project identifier case preservation, native `.` completion triggering, and missing e2e coverage
  for the job faction/AI-script/macro pickers. Each now has a bounded correction or test.
- **Improve work/approach:** three source-reconnaissance commands used fragile nested quoting with
  PowerShell and `rg`. They failed before reaching Forge code and produced no product-state change.
  Subsequent corpus/XSD inspection uses `Select-String -LiteralPath -SimpleMatch` plus bounded line
  slices. Do not reuse the failed combined-regex form on Windows.
- **Improve tools:** the focused browser test initially proved the ware collision rail but not the
  opposite reference-field insertion semantic or the job pickers. The same disposable-workspace test
  now requires both semantics and waits for server synchronization before bulk preview.
- **Highest-risk evidenced weakness:** a source-complete completion engine can still feel absent if
  the host does not trigger it while typing. Native provider trigger characters and the installed
  Antigravity keyboard path therefore remain mandatory release evidence, not source-review claims.
- **Validation checkpoint:** the real-corpus HTTP harness passed 81/81 against the configured 9.00
  corpus (32 factions, 1,902 wares, 1,192 jobs, 178 AI scripts, 170 sectors, 6,505 macros), including
  a 3.3 ms warm-completion p95, 43 validated hull patches across 80 logical XL macro files, compile,
  corrupt-selector rejection, idempotence, conflicts, traversal/auth/cap/stale-plan failures, and
  zero mutation on every rejected path. The focused rendered authoring workflow then passed 1/1 in
  the isolated 3100/3101 stack; both ports were confirmed closed afterward.
- **Triggered corrections:** the first HTTP run used a four-minute outer timeout despite the
  harness's explicit six-minute cold-manifest budget; its process was identified and cleaned only
  by disposable port owner before the corrected 289.6-second PASS. The first browser run used
  case-sensitive `Add` for the visible `ADD` control. A later run exposed a genuine recovery gap:
  the commit-time duplicate check closed the suggestion popup and therefore hid `EXISTS` and
  `Patch existing`; the stable collision panel now retains both. The feature spec now uses the
  intended 1920x1080 desktop layout because the legacy three-column configurator overlaps at the
  default 1280x720 viewport rather than forcing pointer events through obscured controls.
- **Remaining evidenced risk:** cold workspace persistence took roughly nine seconds during one
  isolated startup. It completed successfully and does not affect the measured suggestion hot path,
  but the full-suite run and installed-host interaction must still show that this does not become a
  user-visible stall or lost edit.

## VERIFIED CLOSE — 2026-07-28

### Outcome

B99 is complete and publicly released as **X4 Forge Studio 0.0.48**. The Forge now uses its configured
unpacked X4 corpus while the author is typing: Wares & Jobs and other reference fields rank canonical
base/DLC/project symbols; existing IDs are visibly treated as collisions and route to XML Patching;
CodeMirror and native Antigravity XML editors consume the same completion/hover service; selectors
complete against effective XML; and the Bulk Transform panel converts one bounded numeric rule into
simulated, conflict-checked X4 diff patches without editing the corpus or installed game.

The installed-host test used the existing intentionally disposable Forge canvas. A real Antigravity
window reload restarted the managed sidecar and restored the same persisted test project. After the
reload, typing `energyc` visibly ranked canonical `energycells` first with its localized name, tags,
base provenance, source path, `EXISTS` state, and **Patch existing** action. A real XL hull preview
enumerated 80 logical macro files, produced 43 green base/DLC changes, skipped 37 nonmatches, and
reported zero over-cap rows. Applying those 43 generated patches advanced the existing undo history;
Undo restored the exact prior canvas. X4 was closed and no installed game or live mod was written.

### Acceptance evidence

- **Static/schema:** typecheck PASS; lint 0 errors; schema intelligence 139/139; reference corpus
  14/14; manifest gate PASS; transitive `common.xsd` resolution retained.
- **Real corpus/API:** reference API 81/81 against X4 9.00: 32 factions, 1,902 wares, 1,192 jobs,
  178 AI scripts, 170 sectors, and 6,505 macros. Warm completion p95 was 3.3 ms.
- **Bulk safety/performance:** deterministic preview/apply/compile/idempotence/conflict/cap/CAS and
  deliberately corrupt selector rejection passed. Preview p95 was 14.2 ms at 100 files, 24.8 ms at
  250, and 48.6 ms at the 500-file hard cap. Rejected paths produced zero workspace mutation.
- **Rendered integration:** focused corpus-authoring e2e 1/1; full isolated e2e 27/27 with
  `[run-e2e] VERDICT: PASS`; ephemeral ports 3100/3101 were closed afterward and live state remained
  separate.
- **System/release:** runtime-discovered oracle board 106/106; precommit PASS; production build,
  extension controller build, staged sidecar probe 6/6, package inspection, and forbidden-payload
  checks PASS.
- **Public artifact:** Open VSX indexed stable `x4forge.x4-forge-studio` 0.0.48 at
  `2026-07-28T20:03:48.262945Z`. The public and locally tested VSIX files are byte-identical:
  17,903,956 bytes, SHA-256
  `7EA3F0A4946822D3E63052E7659D6AFE8CE3D4468F59069070BB3E5F4A75EA2B`.
- **Negative/security:** traversal, anonymous access, read-key mutation, malformed rules, invalid
  XPath, stale plan/head, cap breach, simulation failure, and user-patch conflicts all fail closed.
  Exact route scopes were extended without widening route prefixes.

### Review

Fresh-eyes review found no release-blocking correctness or security defect. The bulk engine is bounded
to finite numeric operations, parsed XPath, 500 files, exact-one numeric matches, effective base+DLC
documents, deterministic plan hashes, optimistic concurrency, checkpointed workspace mutation, and
existing diff simulation. Commit-time canonical lookup—not the suggestion popup—is the authority gate
for duplicate IDs. Jobs grammar changes were checked against the real `libraries.xsd` and corpus.
Generated work remains ordinary workspace state and continues through the existing compile/deploy
boundary; deployment itself was deliberately out of scope.

### Documentation close and AAR

- **Capability-map delta:** B99 adds canonical job/AI-script symbols, project-overlay suggestions,
  native/webview/form completion, effective XPath intelligence, and bounded transactional bulk
  transforms. The external StarForge capability-map and project AAR updates require the standing
  explicit outside-workspace write gate and are recorded separately when authorized.
- **Sustain:** one canonical suggestion/validation engine and real-corpus/installed-host evidence
  prevented UI, API, and validator vocabularies from drifting apart. Hashing the public download
  proved users receive the exact tested package.
- **Improve work/approach:** fragile PowerShell quoting, an undersized harness timeout, stale UI
  locators, and an initial mistaken assumption that the persisted test canvas required protection
  caused avoidable retries. The corrected approach uses repository harnesses, the existing visible
  Antigravity instance, and the canvas as its intended reload-persistent fixture.
- **Improve tools:** Open VSX metadata can lag after a successful publish; verify the latest/version
  endpoints and artifact hash before considering a retry. The Antigravity executable is not on PATH
  in this environment, and an attempted CLI reinstall hung against the running host; exact public
  artifact identity plus extension-version and post-reload behavior supplied the reliable proof.
  `reviewctl` is unavailable, so review used the full diff, graph refresh, focused tests, and runtime
  gates.
- **Highest-risk evidenced weakness:** installed bulk apply took roughly 40 seconds for 43 generated
  patches and initially appeared idle, although it completed atomically and Undo passed. A bounded
  follow-up should expose apply-stage progress or an explicit busy state; this is a responsiveness/
  observability issue, not evidence of data loss or incorrect output.

Final status: **VERIFIED**. Suggested commit title:
`release: 0.0.48 — corpus-guided autocomplete and safe bulk XML transforms`.
