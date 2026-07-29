# B65 · Cold-start onboarding — kill the "md.xsd / common.xsd not found" dead-end (SPECIFIED)

> Triggered by a real Discord user who hit `md.xsd / common.xsd not found at this path` and couldn't
> recover. Ken's read: the app doesn't make "nothing → productive" obvious. Planned TWICE (two
> independent agents, same grounded brief) + reconciled against the live filesystem. This is the
> SPECIFIED plan; no code until Ken approves the direction + the named-tool decision.

## Triangulation result (why this plan is trustworthy)
Two independent planning passes **converged** on the root cause, the bounded first unit, the validation,
and the deferrals — strong signal the structure is right (not a single-plan fallacy). They ALSO shared
ONE factual error: both recommended Egosoft's first-party `XRCatTool.exe` in the game root. **Reality
check FALSIFIED it** — the real X4 9.00 Steam install (`<STEAM_LIBRARY>\...\X4 Foundations`) has only
`.cat`/`.dat` + `X4.exe`, no first-party unpacker. Lesson: convergence ≠ correctness; the filesystem
decides. The tool position below is corrected to the verified reality (community unpacker).

## Root cause (grounded, verified in code)
The happy path works: `FirstRunWizard` → detect install → "Set up automatically" → harvest md/common/
aiscripts.xsd from the user's own cat/dat (`POST /api/agent/setup/harvest-schemas`, gameDetectRoutes.ts:119)
→ save config. But EVERY failure branch funnels into ONE inert surface — the XSD Schema Folder row in
`DirectorySettingsModal.tsx:239-247`, which only DIAGNOSES ("md.xsd / common.xsd not found at this path",
:244) and never TREATS. Failure modes, all confirmed:
- **FM1** `canHarvestSchemas===false` → wizard DISABLES auto-setup (FirstRunWizard.tsx:150-151) → dumps to the inert modal.
- **FM2** harvest 422 ("Could not extract md.xsd + common.xsd", gameDetectRoutes.ts:143) → wizard error phase → inert modal.
- **FM3** install not auto-detected → "Set up manually" → inert modal.
- **FM4** wizard is dismissible (✕/Later) and only re-opens when `!config.x4GamePath && !resolved.mdExists` (App.tsx:442) — so a user with a game path saved but schemas unresolved NEVER gets it again.
- **FM5** the reliable UNIVERSAL fallback — unpack the whole game, point the schema folder at the unpacked ROOT (`discoverXsd`, xsdParser.ts:269, is subdir-aware and finds md/common.xsd wherever they sit) — is surfaced NOWHERE except a hover tooltip (DirectorySettingsModal.tsx:230).
- **FM6** manual settings has NO recovery: no "harvest from my install" button (the endpoint exists + the game-path field is on the SAME modal), no unpack guide. Harvest is only ever called by the wizard (FirstRunWizard.tsx:73).

**The opportunity = the convergence:** because all dead-ends reach the same screen, making THAT screen
self-service fixes FM1/FM2/FM3/FM6 at once, reusing existing endpoints — no new backend, route, schema,
or spend/network surface. Save is already decoupled from schema validity (server.ts:2942, B45), so
"save game path → harvest from it" needs no new endpoint.

## FIRST BOUNDED UNIT — B65-1 · "Make the schema row self-rescuing"
One file: `src/components/DirectorySettingsModal.tsx` (the exact surface the Discord user hit). Additive.
1. **"Extract schemas from my game install" button** on the schema row — enabled when the Game Installation
   field (`gamePath`, already in-scope) is non-empty. Click → `POST /api/agent/setup/harvest-schemas
   {x4GamePath: gamePath}` (the SAME call the wizard's happy path makes) → on `ok`: `setSchemaPath(dir)` +
   reuse existing `saveServerPaths()` → the amber flips green via the existing `resolved.mdExists/commonExists`.
   In-app, zero-external-tool recovery reachable from where users are actually stuck.
2. **Inline "how do I get these files?" teach panel** — auto-expands when amber OR a harvest just failed (422).
   Copy: the app can't legally ship X4's schemas (Egosoft copyright); easiest = set the game path + click
   Extract; if that fails, unpack the game once with **[community unpacker — Ken to name]** and paste the
   **unpacked ROOT** here (the Forge finds md.xsd/common.xsd anywhere inside it). Ends with the tool-agnostic
   floor: "any X4 cat/dat extractor works — the folder just needs to contain md.xsd + common.xsd somewhere."
3. **Honest states:** keep the amber diagnosis but attach the two affordances so it's never a terminus; update
   the placeholder/tooltip (:230,236) to say a game install OR an unpacked root are both valid.
- **New local state** (mirror the wizard's `applyAutomatic`, FirstRunWizard.tsx:67-100): a `harvest()` async,
  a `harvesting` flag, a `guideOpen` boolean. Reuse `gamePath`/`schemaPath`/`saveServerPaths`/`status`/`resolved`.

## KEN DECISIONS (2026-07-19, at the machine)
- **B66 (build our own unpacker) — REJECTED.** No in-app unpacker, no exec surface. Scope = make users aware of
  how the validator works, what it requires, and where to find the community tools.
- **Direction APPROVED**; permissions for live/visual validation granted (Ken at the machine).
- **B65-1b IS IN SCOPE** (agent scoping call, stated not silent): the packed game ships **43 XSDs** (verified via
  cat-manifest enumeration on the real install); the harvest extracts only 3, so harvest-only users get a silently
  DEGRADED B46 validation surface (no factions/gamestarts/diff/addon/scriptproperties routing). 1b extends the
  EXISTING harvest to extract ALL shipped .xsd entries **tree-preserving** (flat basenames collide: md/md.xsd vs
  libraries/md.xsd, md/diff.xsd vs libraries/diff.xsd, aiscripts/aiscripts.xsd vs libraries/aiscripts.xsd — and
  md/md.xsd is the include SHIM that needs its relative include chain intact). Registry + discoverXsd are already
  subdir-aware → zero downstream changes. This is not an unpacker; it is the approved harvest doing its whole job.
- **Tool guidance = SOURCES, not one binary** (per "where they can find those tools"): the teach panel points to the
  community's tool hubs (Egosoft forum modding-tools board, Nexus) tool-agnostically — "any X4 cat/dat extractor
  works; point the schema field at the unpacked root." No specific binary endorsed (the XRCatTool lesson).

## TOOL POSITION (superseded by the KEN DECISIONS above; kept for the record)
- **Primary in-app path = the built-in harvest** (no external tool at all): the "Extract from my game install"
  button. Recommend this FIRST; it works for most installs.
- **Fallback = a COMMUNITY unpacker** (there is NO first-party tool in the install — verified). Recommend a
  named, trusted community tool + the tool-agnostic floor. **Ken names the tool** (he used the X4 Unpacker
  Suite — `<X4_UNPACKED_DIR>\x4unpackersuiteV1`; he knows what's currently maintained + safe to recommend publicly
  on the store). Do NOT ship an unverified/first-party tool name (both agents' XRCatTool assumption was false).
- **Legal:** the app ships nothing copyrighted either way — harvest reads the user's own cat/dat; unpacking is
  the user extracting their own owned files with a tool they run. Naming a tool doesn't change our legal posture.

## FOLLOW-ONS (deferred — own backlog items, NOT the first unit)
- **B65-2** Wizard failure-branch parity: FM1 (`canHarvestSchemas===false`) + the error phase render the SAME
  teach panel (game path pre-filled) instead of dead-ending to "Manual setup". `FirstRunWizard.tsx`.
- **B65-3** Close the re-entry gap: widen App.tsx:442 auto-open, + a persistent dismissible "Schema validation is
  off — finish setup" banner in the shell so a dismissed wizard is never a silent dead-end.
- **B65-4** Raw-error deep link: the `createEmptySchemaLibrary` message (server.ts:212) / health card render an
  actionable "Open Directory Settings" link, not a bare string.
- **B65-5** Extract a shared `<SchemaRecovery>` component once the modal + wizard both use the panel (DRY).
- **OUT / gated:** first-party one-click unpack via child-process spawn (new exec/side-effect surface → needs the
  write-gate paragraph + a hazard sweep + Ken's go); bundling any XSD (illegal, never); changing discoverXsd /
  harvest internals / the `canHarvestSchemas` 1000-byte threshold (gameDetectRoutes.ts:111 — note as a possible
  false-"unreadable" risk, do NOT fix here).

## Acceptance criteria (B65-1)
- AC1: valid game path + amber → one click Extract → row flips green ("md.xsd & common.xsd found"), no path typing.
- AC2: harvest fails (422/no path) → real error shown + teach panel auto-expands; NO bare dead-end string, no uncaught error.
- AC3: pasting an unpacked-game ROOT + Save resolves green (proves the discoverXsd universal path is now guided).
- AC4: guide names a concrete tool AND states "any extractor works / folder just needs md.xsd + common.xsd."
- AC5: veteran floor intact — manual path entry works with zero autodetect; no false-green (schema absent stays amber).

## Validation (EXPERIENCE-gated → visual required; now unblocked via computer-use)
- **V1 static:** host `npm run typecheck` + `npm run lint`.
- **V2 backend contract:** the harvest endpoint returns `ok/dir` on a good path and `422` on unextractable (reused as-is).
- **V3 VISUAL/live (required):** isolated Vite + sidecar (non-live workspace), open DirectorySettings in the browser
  pane, validate via DOM (screenshots wedge — B28): (a) game-path-set → click Extract → row text becomes green +
  success banner; (b) 422 → teach panel present with tool name + "any extractor" sentence; (c) unpacked-root paste →
  green.
- **V4 NEGATIVE (required):** empty/garbage game path → Extract disabled OR error banner + guide expanded (never blank/
  false-green); schema field at a folder without md.xsd → amber persists; decoupled save still persists other paths.
- **V5 evidence:** DOM-read transcripts per branch + typecheck/lint exit codes in the close.
- **PARTIAL trigger:** if the live stack can't be driven, close PARTIAL with V3/V4 named + a click-by-click eyeball
  script — never VERIFIED on backend-green alone (experience gate).

## Risks / rollback
- False "unreadable" (1000-byte threshold) — note, don't fix. Unverified tool name — Ken names it + the floor mitigates.
  Machine-state: harvest reads live cat/dat → MACHINE-STATE ASK before the live check (no workspace swap, lower risk).
- **Rollback:** single-file additive UI (B65-1) → `git revert` of one file; no schema/endpoint/config migration, no new
  mutable surface (config writes go only through the pre-existing user-confirmed POST /api/schema/config + the harvest
  endpoint, which writes only under `data/`).

## Reconciliation / AAR seed
- Plan changed by reality: both independent plans shared a false first-party-tool assumption; the live-install check
  corrected it → tool position is community-unpacker + floor, Ken names the tool. Bank on close: "convergence of two
  plans is not correctness — the filesystem/code is the oracle; verify named external dependencies against reality."
- No capability-map delta from planning; add one on B65-1 close (the schema row becomes self-rescuing).
