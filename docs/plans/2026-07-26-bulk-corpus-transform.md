# Bulk corpus transform — generate N diffs from one rule

Task: B99 bulk corpus transform
Lane: FULL
Status: **SPECIFIED — do not build until Ken says go**

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
7. A UI surface in the XML Patching tab, and an agent API endpoint.

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

## OPEN QUESTIONS FOR KEN

1. **UI or API first?** The asking user is not a programmer and wants buttons; an agent wants the
   endpoint. The engine is shared either way — this is only about which surface ships first.
2. **How much expression power?** `value * k` covers the asked case. Full arithmetic invites
   "why not conditionals", which invites a language. I would ship the smallest set that covers
   rebalance and refuse to grow it without evidence.
3. **Where do generated diffs land** — a fresh mod, or merged into an existing one? Merging raises
   "what if a diff for that file already exists", which needs a conflict rule.

## ROLLBACK

Additive: a new engine module, one endpoint, one UI panel. Removing them restores current behavior.
No existing route changes shape.
