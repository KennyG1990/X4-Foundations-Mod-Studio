# B46 · Full-corpus schema/reference validation (modding-relevant subset) — SPECIFIED 2026-07-15

Lane: **FULL** (core validation-engine change — highest blast radius in the app). Ken chose the
**modding-relevant subset** scope (not exhaustive 39-type).

## Bounded goal
Validate every mod file type a modder actually creates/patches against its REAL game schema, and
make "unknown X" reference checks comprehensive — using the unpacked game at
`<X4_UNPACKED_CORPUS>` (39 XSDs in `libraries/`, 9,884 corpus XMLs).

## Reconcile (verified 2026-07-15)
- Today loads ONLY `md.xsd`+`common.xsd` (MD) + harvested `aiscripts.xsd`; schemaFiles is
  HARDCODED `['md.xsd','common.xsd']` (server.ts config + `loadCurrentSchemaLibrary`).
- `loadSchemaLibrary` (src/lib/xsdParser.ts) is MD-shaped (events/conditions/actions/controlFlow).
- `validateXmlAgainstSchema` (src/lib/xsdValidate.ts) already validates an XML against a
  SchemaIndex with a `domain` + `references` — the generic seam to reuse per file type.
- Reference sets (`getReferenceSets`, server.ts ~1353) cover only macros/wares/factions, derived
  from `getObjectIndex` (SQLite-cached corpus walk, ~17k rows today).
- B45 already lets the schema folder point at the unpacked `libraries/` and loads a richer md.xsd
  (402 events/807 actions) — the loader is the next constraint.

## Subset file types (Ken's scope)
MD (`md/*.xml` → md.xsd) · AIScripts (`aiscripts/*.xml` → aiscripts.xsd) · wares
(`libraries/wares.xml` → libraries.xsd) · jobs (`libraries/jobs.xml`) · factions
(`libraries/factions.xml` → factions.xsd) · gamestarts (`libraries/gamestarts.xml` →
gamestarts.xsd) · god/sectors (`libraries/god.xml`, `maps/**` → objectspawn*/region_definitions)
· t-files (`t/*.xml` — page/entry structure) · ui (`ui/**` → addon/coreaddon.xsd) ·
macros/components (referenced, not usually authored → reference sets).

## Delta 2026-07-16 (reconcile w/ Ken's XSD-inventory question)
Add **`diff.xsd`** to phase 2 routing as a FIRST-CLASS domain: nearly every file the Forge emits
is a `<diff>` patch document — validating our own emitted patches against the game's own diff
schema guards the most-used output path (self-check, not just user-file check). Also note
**`scriptproperties.xsd`** as a phase-3 hardening item (validate the scriptproperties.xml we
already index for the property lint). Niche tiering of the remaining ~20 confirmed unchanged.

## Phases (each ≈ one focused session; checkpoint between)
1. **Multi-schema loader.** New schema registry that discovers + loads ALL `*.xsd` in the schema
   folder, keyed by root element/domain (not the 2-file hardcode). Keep the existing MD
   SchemaLibrary shape for back-compat; add a per-domain index map. Oracle: load the unpacked
   `libraries/`, assert N domains parsed, md still 402/807. `GET /api/agent/schema-registry`.
   **Phase-1 reconciled design (2026-07-16, in-progress):** engine `src/lib/schemaRegistry.ts`
   (pure) — `discoverSchemaRegistry(schemaDir, gamePath?)` enumerates `*.xsd` via a bounded walk
   MIRRORING B51's `discoverXsd` (depth≤6, asset-dir skips, base-over-DLC preference per
   basename); per-domain `includes` resolved transitively from `schemaLocation` attrs (real graph
   is shallow: ~20×→common, diplomacy→aiscripts→common); `getDomainIndex` = existing
   `buildSchemaIndex([main, ...includes])` (the proven aiscripts composition — NO new parser).
   Parse is LAZY per domain (common.xsd 1.7MB; eager ×30 too slow) and the shared 8-slot
   indexCache is left alone (bump deferred to phase 2 routing). Oracle = SYNTHETIC fixtures
   (include chain, junk file, missing include, DLC-copy preference) — env-dependent unpacked-dir
   proof is a VALIDATION step, not the oracle (B49 lesson: no env-red noise). Endpoint
   `GET /api/agent/schema-registry` (+PUBLIC_READONLY_GETS) lists domains; `?domain=x` parses one
   and reports elementCount. Existing md path (`loadCurrentSchemaLibrary`) and `getAiSchemaIndex`
   UNTOUCHED this phase.
2. **File→schema routing.** A path→domain map + a validator that runs `validateXmlAgainstSchema`
   with the right domain index per generated/imported file; wire into `runSchemaValidation` +
   `project/validate`. Oracle: a deliberately-malformed wares/jobs/factions file FAILS; a
   vanilla-shaped one passes. Negative path is the acceptance.
3. **Full-corpus reference sets.** Extend `getObjectIndex` to index every subset entity type from
   the unpacked ROOT (components, wares, factions, jobs, sectors, gamestarts ids, t-file page/entry
   ids); extend `getReferenceSets` accordingly. Cache in the existing SQLite store; watch build
   time (9,884 files). Oracle: reference set counts per kind; an unknown ware/faction/job flagged.

## Phase 2 — reconciled design (2026-07-16, SPECIFIED)

**First-job resolution — the P1 hand-off note is CLOSED [REPRODUCED]:** the 2 md-audit findings
(`event_cue_signalled`, `event_cue_completed`) are FALSE POSITIVES from include-blind schema
loading, not generator bugs. Mechanism, fully evidenced on an unpacked-root scratch instance
(:3777, X4_XSD_PATH = unpacked root):
- `md/md.xsd` and `aiscripts/aiscripts.xsd` in the unpacked tree are include SHIMS (0 element
  declarations; each holds one `xs:include` to `../libraries/<name>.xsd`).
- `buildSchemaIndex` does NOT follow `xs:include`, and `discoverXsd`'s conventional homes prefer
  the shims — so legacy `getSchemaIndex`/`getAiSchemaIndex` index shim+common only (probe:
  1339 elements, ALL of libraries/md.xsd missing: cue, actions, do_if, all 20 `event_*`).
- The arithmetic proves it: common.xsd declares 382 events, libraries/md.xsd the other 20 —
  382+20 = the 402 events B45 saw pointing straight at `libraries/`.
- Only 2 findings surface because `ALWAYS_KNOWN` shields the structural names and most template
  events live in common.xsd; exactly two synthetic-MD elements are MD-only AND unshielded.
- Same hole for aiscripts: `libraries/aiscripts.xsd` has 101 declarations the shim drops.

**Unit A (precondition — flips `md_generator_zero_findings` green):** export a transitive
`expandIncludeChain(xsdPath)` from `schemaRegistry.ts` (schemaLocation resolved relative to each
file, visited-set, missing targets skipped); `getSchemaIndex` and `getAiSchemaIndex` expand their
root XSDs through it before `buildSchemaIndex`. Non-shim configs are unaffected (a chain of a
declaration-bearing md.xsd is itself + its includes; dedupe by path).

**Unit B (routing):** new pure lib `src/lib/schemaRouting.ts` (house pattern):
- `sniffRootElement(xml)` — first non-PI/comment/DOCTYPE tag name.
- `routeProjectFile(path, xml)` → subset map ONLY: `libraries/factions.xml`→factions ·
  `libraries/gamestarts.xml`→gamestarts · `libraries/wares.xml|jobs.xml`→libraries ·
  `ui/**/*.xml` with root `addon`→addon / `coreaddon`→coreaddon · `t/*.xml`→t-file structural
  lint (NO game XSD exists for t; grounded 2026-07-16) · a routed file with root `<diff>` gets a
  MERGED index (diff chain + domain chain) so wrapper AND payload vocabulary are both legal.
  Everything else (incl. the ~29 niche domains) returns unrouted — deliberately.
- md/ and aiscripts/ keep their EXISTING handlers untouched (beyond Unit A's loader fix).
- **Cry-wolf gate:** findings for domains not in the corpus-proven set are severity-capped to
  WARNING (`CORPUS_PROVEN_DOMAINS` const, populated only from this session's recorded corpus
  evidence). `lintTFileStructure` is warnings-only.
- Oracle `runSchemaRoutingSelftest()` (synthetic fixtures) registered in SELFTESTS.

**Wiring:** shared routing helper consumed by BOTH `runProjectValidation` (projectValidation.ts;
registry via `discoverSchemaRegistry(resolved.schemaDir, resolved.x4GamePath)`, TTL-cached) and
`runSchemaValidation` (server.ts, emitted-files record — this is the diff.xsd self-check on our
own output). `LOADABLE_RE` gains `ui/**/*.xml`. `INDEX_CACHE_MAX` 8→24 (bump deferred from
phase 1 exactly for this). Response surfaces which files routed to which domain (honest
reporting; schema-less instances degrade to unrouted, never wrong-schema noise).

**Corpus-run corrections (2026-07-16, first sweep run1 → run2):** two plan assumptions were
FALSIFIED by the vanilla corpus and corrected before shipping: ① "wares/jobs via libraries.xsd"
is WRONG — vanilla wares/jobs produce 26,835 findings against libraries.xsd (its declarations
govern a different usage; the game ships NO schema for wares/jobs content). Corrected: plain
wares/jobs are unrouted; diff-rooted wares/jobs patches get wrapper-only diff.xsd validation.
② the drafted `<language id>` t-file check was an invented rule — 26/74 vanilla t-files omit
the id legitimately. Removed; the page/t id checks survived (0 findings on 74 files). Second
sweep: 124 routed vanilla files → 0 findings. Proven set = factions/gamestarts/addon/diff;
coreaddon has zero corpus instances and stays warning-capped.

**Acceptance:** ① md-audit on the unpacked-root scratch = 0 findings (the A/B flip of the env
red) ② routing oracle green + auto-discovered by sweep ③ corpus proof: vanilla
factions/gamestarts/wares/jobs/all-t/ui-addon files AND DLC `<diff>`-rooted library patches →
zero findings per routed domain, exact counts recorded; a failing domain stays warning-capped
with the reason recorded ④ negative path: malformed factions attr / malformed diff / malformed
t-file flagged via project/validate on the scratch instance; vanilla-shaped passes ⑤ tsc/lint/
precommit 0 · sweep (scratch: only the known env reds remain) · e2e 19/19 ⑥ md/aiscripts
emission behavior unchanged except the removed false positives.
**Rollback:** single-commit revert (Ken owns commits); changes isolated to named functions.
**Out of scope:** reference sets (phase 3), god/maps routing, scriptproperties.xsd hardening,
niche-domain routing, any new md-path checks.

## Acceptance contract (per phase)
Each phase: pure engine + oracle (house pattern) + endpoint; tsc/lint/precommit/e2e green; the
NEGATIVE path (malformed file rejected / unknown ref flagged) is the real proof; ground every new
lint against the real corpus (do NOT invent rules — the project has falsified intuition-lints
before). Performance: corpus indexing must stay cached (SQLite) and not block validation.

## Risks
Touching the schema/validation core can introduce cry-wolf false positives (the #1 historical
failure mode here — see xsdValidate enum-merge, `parent`-keyword falsifications). Mitigate: every
new schema/domain validated against the vanilla corpus for zero false errors before shipping; keep
new checks WARNING-severity until corpus-proven; MD path unchanged. Rollback = revert per phase.

## Not doing (out of subset scope)
The ~29 rarely-modded schema types (voicesequences, material_library, region_lodvalues, effects,
colors, sound_library, audiologs, …). Loader still parses them (cheap); routing/refs skip them
until demanded.
