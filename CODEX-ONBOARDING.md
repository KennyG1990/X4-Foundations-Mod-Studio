# X4 Forge — Onboarding Handoff for Codex

> **Audience:** an AI coding agent (Codex) with **zero prior knowledge of this project**. You know general
> game modding; you do **not** know X4: Foundations modding specifically — §2 fills that gap.
> **Goal:** take you from nothing to (a) understanding the whole project and (b) safely picking up the next
> unit of work.
> **Depth:** exhaustive reference. Read §1–5 to understand it, §6 for current state, §7 before you touch
> anything, §4 every time you validate.
>
> **Evidence tags** (per the request this file was generated from):
> **[VERIFIED]** = observed in the live repo/records on 2026-07-13 · **[INFERENCE]** = reasonable, cited,
> not re-proven today · **[ASSUMPTION]** = unverified, treat as a question · **[FLAG]** = could not confirm.
>
> **⚠ Written 2026-07-13 while the dev server was DOWN** (see §6). Live-endpoint numbers (oracle sweep,
> e2e) are tagged as of their last successful run, not re-confirmed today.
>
> **This file is Codex-flavored.** The project's canonical agent onboarding is `HANDOFF.md` (28 sections,
> Claude-Code-oriented). Where tooling is Claude-Code-specific (skills, MCP servers), this file flags it and
> points at the on-disk equivalent you *can* use.

---

## 1. What X4 Forge is and why it exists

**One-paragraph mental model.** X4 Forge is a local, browser-based **visual modding studio for the game
X4: Foundations**. It is a React single-page app talking to a Node/Express backend on your own machine.
You build a mod as a **node graph + structured data** (a "workspace"), and the Forge compiles that into the
real XML/Lua files X4 loads, validating against the game's own schemas at every step, then deploys them into
the game's extensions folder. Think "a visual IDE for a game that otherwise makes you hand-write XML." It is
also driveable headlessly through an **agent HTTP API**, so an AI (you) can author, validate, and deploy mods
without clicking the canvas. [VERIFIED — architecture §3, agent API §3.]

**The vision.** "The **UE5 editor for X4**" — i.e. do for X4 modding what Unreal's editor did for game dev:
collapse the barrier to entry so a newcomer ships a working mod fast, instead of drowning in undocumented
XML conventions. [VERIFIED — ADR-F2, ratified 2026-07-11, in BACKLOG "P3.5 Vision v2" header and
`docs/plans/2026-07-11-vision-v2-ue5-editor.md`.]

**North-star metric: TTFM — Time To First Mod.** The whole "Vision v2" track is organized around getting a
zero-knowledge user from first boot to "I saw my mod in my game" in ≤15 minutes. TTFM is instrumented as a
local funnel (`src/lib/ttfm.ts`): `first_boot → paths_configured → template_loaded → first_deploy →
game_confirmed`. The `game_confirmed` stage only fires on a *real* in-game confirmation (see the watcher
verdict, §3/§7). [VERIFIED — B20 close in ROADMAP; TTFM funnel referenced across GuidedRail/App.]

**Who it's for.** Newcomers who want to make an X4 mod without learning the raw toolchain (primary), and
power users / agents who want a faster authoring loop than hand-editing (secondary). The owner is **Ken**
(§8), who is not a professional software engineer and validates by triangulation across frontier models.

**Proof it works.** The Forge's 1.0 proving factor is that a real mod (`x4_ai_influence`) was built with it
end-to-end (§9), and a "Property Attack Alerts" mod went idea→shipped-zip in one sitting. [VERIFIED —
ROADMAP history.]

---

## 2. Domain primer — X4: Foundations modding (you don't need to know X4, just this)

You know game modding generally; here is the X4-specific vocabulary that everything below assumes.

**What a mod is.** An X4 mod is an **"extension"**: a folder under the game's `extensions/` directory
containing a `content.xml` manifest plus subfolders of XML (and optionally Lua) that the engine merges into
the game at load. There is no compiled binary — it's all data + scripts the engine interprets. [INFERENCE —
standard X4 extension structure; the Forge emits exactly this.]

**The four content types the Forge deals with:**

- **MD (Mission Director) scripts** — the main behavior layer. XML files under `md/` describing **cues**:
  a cue has **conditions** (often an *event*, e.g. `event_game_started`, `event_object_destroyed`) and
  **actions** (e.g. `create_ship`, `reward_player`, `show_help`, `debug_text`). Cues can nest (sub-cues) and
  fire once or repeatedly. MD is the "game logic" of a mod. **This is the Forge's primary surface** — the
  node canvas *is* an MD editor. Key rules the engine enforces (and the Forge validates): an event-based cue
  must NOT carry `checkinterval`/`onfail`; a check-only cue MUST have `checkinterval`; `instantiate="true"`
  needs an event condition or a checkinterval. [VERIFIED — `src/lib/mdCritic.ts` laws 5/6; §3 validator.]

- **Lua** — UI and lower-level logic (HUD widgets, menus). The Forge has a HUD/Lua UI designer that compiles
  widgets to Lua. Lua also does async HTTP via the `djfhe` library (relevant to the neural-link bridge, §9).
  [VERIFIED — `src/lib/luaLogicBlocks.ts`, `luaStaticAnalysis.ts`.]

- **Wares / jobs / macros / patches** — the game's economy and object data, defined in `libraries/*.xml`.
  Mods change these via **XML diff patches** (`<add>/<replace>/<remove sel="XPath">`) against vanilla files
  (e.g. make Energy Cells cheaper by patching `/wares/ware[@id='energycells']/price/@average`). [VERIFIED —
  B19s2b "Price Tweak" template.]

- **t-files (translations)** — text lives in `t/*.xml` page/entry tables (e.g. `{10099,100}`), so mods and
  the game reference strings by id, not literal. [VERIFIED — B19s2b "Custom Text" template.]

**XML + XSD.** X4 ships **XSD schemas** describing legal MD/AISCRIPT/etc. structure. The Forge parses these
(`src/lib/xsdParser.ts`) into a **schema library** (events / conditions / actions / control-flow elements +
their attributes) and validates generated XML against them. Grounding truth = the game's own XSDs + the
**unpacked vanilla corpus** (thousands of real `.xml` files extracted from the game's `.cat/.dat` archives),
NOT invention. When authoring anything mod-side, ground it in real shipping examples. [VERIFIED — §3 validate
pipeline; CLAUDE.md "Authoritative references".]

**The debug log.** X4 writes a `debuglog.txt` when launched with debug flags. Mods can only *emit* to it via
`debug_text` (the engine stamps mod log lines with an `[=ERROR=]` prefix even for non-errors — a known
gotcha). The Forge **tails this log** to show live cue firing, attribute errors, and two custom protocols:
- **FORGE-WATCH** `name=value` lines → live scalar values on the canvas.
- **FORGE-STATE** `<topic> {json}` lines → structured game-state snapshots in an Inspector panel.
Both are read-only-by-construction (log emission only; no way to mutate game state through them). [VERIFIED —
`src/lib/forgeWatch.ts`, `forgeState.ts`; ADR-F3.]

**`.cat/.dat` archives.** X4 packs its data into paired `.cat` (index) + `.dat` (blob) archives. The Forge
has a reader (`src/lib/catDat*`) so it can harvest schemas and scan the corpus without you unpacking anything.
[VERIFIED — first-run wizard harvests 3 XSDs straight from the archives, B18.]

---

## 3. Architecture

### The split
- **Frontend:** React + TypeScript + Vite + Tailwind, in `src/`. Entry `src/main.tsx` → `src/App.tsx` (the
  giant root component holding the header, workspace state, and all the panels). The node canvas is
  `src/components/Canvas.tsx`; side panels are `src/components/*` (Sidebar, PlaytestWorkspace,
  LibraryConfigurator, GuidedRail, etc.). [VERIFIED — file tree.]
- **Backend:** a single **`server.ts`** (~7,600 lines) Node/Express app that owns the filesystem, the schema
  library, the compile/validate/deploy logic, the AI provider calls, and the agent API. Sub-route modules
  live in `src/server/*`. [VERIFIED.]
- **Shared model + core logic:** `src/lib/*` (pure, mostly deterministic modules — compilers, parsers,
  validators, the census, etc.) and `src/types.ts` (the `ModWorkspace`/`MDNode` model + `generateMDXML`,
  `sanitizeWorkspace`, `validateModWorkspace`). Much of the heavy logic is in `src/lib` precisely so it can be
  unit-tested by oracles (below). [VERIFIED.]

### The workspace data model
The unit of work is a **`ModWorkspace`** (`src/types.ts`): `{ name, description, nodes[], links[], uiWidgets[],
tFiles[], xmlPatches[], wares[], jobs[], aiScripts[], compileSettings, ... }`. **`nodes`** are MD graph nodes
(`MDNode`: id, type ∈ cue/event/condition/action, xmlTag, properties, x/y, ports); **`links`** wire node
ports. `sanitizeWorkspace()` normalizes any partial workspace into a full one (hydrating ports, defaults).
`generateMDXML()` compiles the graph to MD XML; `generateContentXML()` emits the extension manifest.
[VERIFIED — types.ts, modCompiler.ts.]

**Server-side workspace state.** The server holds ONE **active workspace** in memory AND persisted to disk
(`.studio-state/active.json`, atomic write) so it survives restarts. Switching to a differently-named
workspace **parks** the previous one (`.studio-state/parked-*.json`) instead of destroying it. Writes go
through a **content-addressed compare-and-swap (CAS)**: `GET /api/agent/workspace` returns a `workspaceHash`;
a write must send `expectedHead` (that hash) or `force:true`, else it's rejected `409 legacy_write_rejected`.
This is the fix for a whole class of data-loss incidents (§7). [VERIFIED — B2 all slices, `src/lib/workspaceState.ts`,
server.ts workspace routes.]

### The agent API (how you drive it headlessly)
Every `/api/*` route requires `Authorization: Bearer <token>` **except** a small allowlist of public
read-only GETs (`PUBLIC_READONLY_GETS` in server.ts) — a new public GET must be added there or it 401s. The
token is written to `.studio-api-token` at boot; the Vite dev server injects it into the page so the UI is
authed automatically. Key endpoints:
- `GET /api/agent/workspace` → active workspace + version + `workspaceHash`.
- `POST /api/agent/workspace` `{workspace, expectedHead?, force?}` → replace (CAS).
- `POST /api/agent/project/validate` → **authoritative validation** (XSD + cross-file cue resolution +
  md↔lua binding); loop to `ok:true`.
- `POST /api/agent/deploy-verify` → the 9-stage compile+deploy preflight.
- `GET /api/agent/selftest-index` and `GET /api/agent/<name>-selftest` → the oracles (below).
- `GET /api/agent/schema` → self-documenting endpoint list (public).
- `GET /api/agent/live/forge-state`, `.../debug-watcher/brief`, `POST /api/agent/probe/preview`, etc.
[VERIFIED — server.ts routes; the `x4-forge-api` skill documents the full loop for Claude, but the endpoints
are harness-agnostic.]

### The "house pattern" (how deterministic features are built here)
Nearly every capability follows the same shape, and you should too when adding one:
1. A **pure engine module** in `src/lib/<feature>.ts` (files/data in → result out; no wall-clock, no
   randomness — `Date.now()`/`Math.random()` are avoided so runs are reproducible).
2. A **`run<Feature>Selftest()` oracle** in the same file: an in-code fixture that exercises the engine and
   returns `{ pass, checks: [{name, pass, detail}] }` (some variants also return `passed`/`total`).
3. **Registration** in the `SELFTESTS` map in server.ts → auto-exposed as `GET /api/agent/<name>-selftest`
   and swept.
4. Optionally a **UI readout** consuming it.
This is why the project can claim "76 green oracles" as real coverage — each is a runnable contract.
[VERIFIED — the pattern is visible across `src/lib/*Selftest`; the `x4-forge-house` skill encodes it.]

### The compile → validate → deploy pipeline
`ModWorkspace` → `generateMDXML`/`generateContentXML` (compile) → `validateModWorkspace` / `POST
/api/agent/project/validate` (XSD + cross-file) → `deploy-verify` (9-stage: compile, validate, fidelity,
write, byte-confirm, source-sync stamp, …) → files land in the game's `extensions/x4_...` folder. The deploy
folder **forbids deletes on some mounts** (overwrite/truncate to empty instead), and preserves foreign
co-located content via a `.forgekeep` list (so it never nukes the Python bridge, §9). [VERIFIED — server.ts
`compileWorkspaceToFolder`, `cleanForgeManagedEntries`, deploy-verify.]

---

## 4. How to run and verify it

### Environment
- **OS:** Windows (paths are Windows; the primary shell is PowerShell, with a Git-Bash POSIX shell also
  available). [VERIFIED — repo is on `<WORKSPACE_ROOT>`.]
- **Node + tsx:** the backend runs under `tsx` (TypeScript execute) in watch mode; the frontend under Vite.
- **Start the app:** `START-X4FORGE.cmd` (production-ish launcher) or the `dev` scripts. The app serves at
  **http://localhost:3000** (Vite), which **proxies `/api/*`** to the Node backend. All agent API calls this
  session went to `localhost:3000/api/*`. [VERIFIED — session usage; [FLAG] exact standalone API port in dev
  is 3001 per `dev:api` but you normally hit :3000.]

### Gate commands (exact, from `package.json` [VERIFIED 2026-07-13])
| Command | What it is |
|---|---|
| `npm run typecheck` | `tsc --noEmit` — the fast first gate; run after every change. |
| `npm run lint` | `eslint src server.ts`. |
| `node scripts/oracle-sweep.mjs` | Runs **all** registered oracles; exits non-zero on any red. **76/76 green** at last sweep (2026-07-13). Discovery reads the *runtime* selftest index (B27), not a source regex. `--list` shows coverage. |
| `npm run test:e2e` | **THE e2e gate.** Playwright, **12 tests across 6 spec files**, on the ephemeral stack (below). Wrapped by `scripts/run-e2e.mjs`. |
| `npm run test:canvas` | A 2-spec subset of the above (canvas only). |
| `npm run validate:mod` | `tsx scripts/x4validate.ts` — CLI mod validation. |
| `npm run precommit:check` | typecheck + recurring-mistake **tripwires** (B32) + **mirror-drift** gate (B30) + large-file guards. |
| `npm run build` | `vite build` + esbuild the server to `dist/server.cjs` (production bundle). |

**Critical e2e gotcha — the exit code lies.** On this Node build, Playwright prints its summary ("N passed")
and *then* dies in a libuv teardown assertion (`!(handle->flags & UV_HANDLE_CLOSING)`, exit `0xC0000409`).
So the raw exit code is unusable. **`scripts/run-e2e.mjs` parses the summary line and exits on the VERDICT**
— trust `[run-e2e] VERDICT: PASS/FAIL`, never the child exit code. [VERIFIED — reproduced repeatedly; B17.]

### The ephemeral e2e stack (why e2e is safe to run)
e2e used to swap the live dev server's workspace, which twice clobbered real work. As of **B31s2**, e2e spins
up its **own** stack: **Vite on 3100, API on 3101, its own bearer token, and a per-run temp `X4_STATE_DIR`**
(`playwright.config.ts`). Your live `:3000/:3001` stack and its workspace are untouched **by construction** —
there is no workspace-guard/restore anymore and **no machine-state ask needed** to run e2e. Do NOT re-point
specs at `:3000`. [VERIFIED — `playwright.config.ts` B31s2 header, `E2E_WEB_PORT=3100`/`E2E_API_PORT=3101`.]

### Validation layers (which apply depends on the task)
1. Static/type (`typecheck`) · 2. Oracles (`oracle-sweep`) · 3. Integration/cross-layer
(`project/validate` → `ok:true`, e2e) · 4. Negative-path (each oracle carries failure checks) · 5. Live
runtime (the debug-watcher brief; the `:8713` bridge dashboard when bridge work is touched) · 6. **Real
rendered UI** (drive the browser, screenshot it — a green backend does NOT prove the UI) · 7. Packaged build
· 8. **In-game** (see the machine-gate/experience-gate split, §5). [VERIFIED — CLAUDE.md adapter "Validation
layers".]

---

## 5. How work is done here

### The workflow (v3): the Universal AI Task Workflow — MANDATORY
Every task follows, in order:
`CLASSIFY → PLAN → BASELINE → RECONCILE → DOCUMENT PLAN → IMPLEMENT → VALIDATE → REVIEW → DOCUMENT CLOSE → AAR`
- **Classify a lane:** *Full* (code, schema, endpoints, anything with blast radius — run every stage) or
  *Light* (a local doc/text edit, no behavior change — compressed, but still reconcile + close honestly).
- **Reconcile before building:** search for whether the capability already exists (by resource — table, route,
  function, file — not by feature name). If it exists, **extend it, don't rebuild**. Redundant infrastructure
  over working code is a defect. (This caught B11 — "make aiscripts editable" turned out to already exist;
  the close wrote zero code.)
- **Close states:** `VERIFIED` / `PARTIAL (◐)` / `FAILED` / `BLOCKED` / `REVERTED` / `SPECIFIED`. You may NOT
  mark `VERIFIED` over partial work. "I couldn't validate it" → `PARTIAL` or `BLOCKED`, never `VERIFIED`.
- **AAR every task:** clean (one line) or triggered (sustain / improve-work / improve-tools / highest-risk
  weakness). Bank durable lessons to the ledgers.
The canonical text is `UNIVERSAL_AI_TASK_WORKFLOW.md` (repo root) and inlined in `CLAUDE.md`/`AGENTS.md`/
`GEMINI.md` (identical mirrors). **Read it; it is binding.** [VERIFIED.]

### The machine-gate vs experience-gate split (ADR-G3)
- **EXECUTION gates** flip on machine-read evidence the system emitted about its own state (oracle results,
  API responses, debuglog lines, DB rows, deterministic runtime events). **You** can pass these.
- **EXPERIENCE gates** — anything a human is meant to *read, see, or feel* — flip **only on Ken's screen**.
  Backend-green never proves the visible experience. Every Ken-gated item must ship with a **click-by-click
  script** (a lesson learned the hard way — see §7). [VERIFIED — CLAUDE.md; SESSION-HANDOFF eyeball-queue
  history.]

### The operator protocol (you also manage the operator)
Ken explicitly asked to be kept honest and unblocked. Enforced like workflow steps: brief him at session
start (which project, the eyeball queue, the commit question); ask machine-state before validation-heavy
work; call **degradation** when errors cluster (2+ mistakes in a stretch → commit point + fresh session);
end every verified close with a pre-written commit title; update the doc in the SAME task when he reverses a
rule verbally (canon lag = landmine); give a one-paragraph write-gate summary before touching the real
mod/game dirs/standing config; tag every failure explanation `[REPRODUCED]` or `[HYPOTHESIS]`. [VERIFIED —
"OPERATOR PROTOCOL" block in CLAUDE.md.]

### The records system (MD-only — Ken's policy, no third-party trackers)
| File | Role |
|---|---|
| `BACKLOG.md` | **Open work only.** Sessions start here. Closing an item MOVES it to ROADMAP. |
| `ROADMAP.md` | **Append-only verified history.** Every close lands here dated, with cited validation. Big (~3,900+ lines). |
| `SESSION-HANDOFF.md` | Working-state transfer, **overwritten at every commit point.** The incoming agent reads this + BACKLOG first. (⚠ it has accreted stale per-pause lines — trust the "AUTHORITATIVE CURRENT STATE" block at its top; see §7.) |
| `HANDOFF.md` | Full 28-section onboarding for no-history agents (Claude-oriented; this file is the Codex cut). |
| `F:\StarForge\wiki\x4-forge\capability-map.md` | What exists — read before any reconcile; update by delta. |
| `F:\StarForge\wiki\x4-forge\decisions.md` | ADR ledger — a design contradicting an ADR needs Ken's sign-off. |
| AAR ledgers | `F:\StarForge\wiki\workflow\aar-log.md` (general) + `...\x4-forge\aar-log.md` (project). |

### Git ownership
**All mutating git is Ken's** (he commits via a tool called Antigravity), per-operation authorization only.
You may do read-only inspection (`status`/`diff`/`log`/`show`/`blame`/branch listing) freely and are expected
to (the session-start commit question needs it). **Close titles double as suggested commit messages.** Do not
commit/push/reset/rebase/branch unless Ken authorizes that exact operation. Lived reason: a sandbox commit
once corrupted a file via stale mount reads. [VERIFIED — Git Policy in CLAUDE.md.]

---

## 6. WHERE WE ARE RIGHT NOW

*(Grounded against `git log`, `git status`, BACKLOG.md, SESSION-HANDOFF.md on 2026-07-13. [VERIFIED] unless
tagged.)*

- **HEAD:** `8050e03 feat(core): Implement probe generator, refine workspace state, update docs`.
- **Working tree:** 3 uncommitted files — `BACKLOG.md`, `ROADMAP.md`, `SESSION-HANDOFF.md` (a records-only
  reconcile close; no code pending). Everything else is committed.
- **⚠ MACHINE-STATE EVENT:** the dev server (`:3000/:3001`) went **unreachable mid-session** (connection
  refused → timeout; the watchdog did not respawn it within ~20s). Live validation is frozen. **First thing
  next session:** determine if Ken closed the app or it crashed, `restart-studio.bat` if needed, then confirm
  `GET /api/agent/workspace` holds `Player_Elite_Escort`. [VERIFIED — 4× poll failed 2026-07-13.]
- **Last green gates (before the server died):** typecheck 0 · oracle sweep **76/76** · e2e **12/12** ·
  the live workspace byte-identical to its snapshot. [VERIFIED — this session's runs; not re-confirmable now.]

**What's built:** the Vision-v2 arc is essentially complete — first-run wizard + game autodetect (B18),
TTFM instrumentation (B20), the guided rail template→deploy→see-it flow with a server-computed watcher
verdict (B19), beyond-canvas starter templates (B19s2b), the action-frequency census + curated semantics
(B21/B10), the pattern browser + mid-canvas stamping (B22), the workspace persistence/CAS/park redesign (B2),
the ephemeral e2e stack (B31), the FORGE-STATE Inspector (B24s1) and its read-only probe generator (B24s2
code), plus header responsiveness (B29), guard self-checks (B26), recurring-mistake tripwires (B32), and
mirror-drift gates (B30). Full detail: ROADMAP.md.

**The backlog is genuinely Ken-gated-only.** Every `spec'd`/`in_progress` unit is closed. What remains:
- **Commits:** just the 3 reconcile docs above (Ken commits).
- **In-game / experience batch (needs Ken at the game):** the welcome-template walk (first real TTFM
  datapoint); B19 rail-to-game confirmation; **B24s2 probe deploy + in-game FORGE-STATE confirmation**
  (write-gated); B18 fresh-boot <2min acceptance; B20 report panel (needs a real funnel first).
- **Decisions (only Ken can make):** B8/B23 installer unpark (Electron vs single-binary); B14 XPath-library
  dependency (violates local-npm-only posture?) + mod-profiles keep/drop; B17 Node-version bump.
- **Optional eyeballs:** B18 wizard visuals; the icon-only narrow-header feel.
- **Optional-depth NOTES (NOT queued work, deliberately not force-built):** B10 tags-beyond-top-52
  (demand-driven); **B10 xsdParser `structural`-category rider** (SPECIFIED — real, but its acceptance needs
  the live game schema + corpus, i.e. Ken's configured install, and it's a schema-layer change with
  palette/template/validation blast radius; symptom already handled downstream, so it's deferred to a fresh
  session with the schema loaded); B24s2 periodic-heartbeat (needs a `checkinterval` cue-attribute emit the
  compiler lacks). [VERIFIED — BACKLOG.md B10/B24 entries; SESSION-HANDOFF authoritative-state block.]

**Net:** there is **no agent-buildable-and-verifiable feature work queued right now.** The next unit for a
fresh agent is either (a) restart+verify the server, then help Ken through the in-game batch, or (b) if Ken
opens the schema, the B10 structural rider is the one specified code task. [INFERENCE from the above.]

---

## 7. Hard-won hazards & failed approaches (read before touching anything)

- **Sandbox/mirror copies of this repo LIE.** Reads, greps, and `tsc` against a stale mount have caused
  multiple incidents (one corrupted a file). **Use host tools only.** If you're in a sandbox, run host
  commands via the dev-only `POST /api/run_command/job` → poll `GET /api/run_command/job/<id>` (output key
  `tail`). [VERIFIED — CLAUDE.md host-truth rule.]
- **The libuv e2e crash** (§4): Playwright exits non-zero even when green. Judge by the parsed VERDICT, never
  the exit code. [VERIFIED.]
- **The browser-pane wedge.** When driving the in-app browser for visual validation, the screenshot pipeline
  can wedge (stale frames; clicks report correct coords but don't land; long JS evals get killed mid-flight).
  Much of it was OUR bug (Vite full-reloading on runtime file writes — fixed by adding `.studio-state/`,
  `data/`, `debuglog.txt` to the watch-ignore), but a residual screenshot-capture failure is the tool's.
  **When the pane misbehaves, trust ONLY DOM reads — never pixels or click echoes — and keep pane JS
  short-lived (<~2s, no multi-second awaits).** Recover with a navigate-reload. [VERIFIED — B28.]
- **The sync-clobber incident class (now fixed, don't reintroduce).** The server's workspace was once an
  in-memory mutable singleton with an integer version; a restart reset the counter and a blank client
  silently overwrote real work — this destroyed a session's output more than once. The fix (B2s3) is disk
  persistence + content-addressed CAS + a legacy-write gate + park-on-switch. **Never** add a workspace write
  path that bypasses `commitActiveWorkspace()` / the CAS, and never make a blind (no-`expectedHead`, no-
  `force`) write. [VERIFIED — B2 ROADMAP closes.]
- **Don't validate against the real mod.** Using `x4_ai_influence` as a UI/deploy test article once
  regenerated and corrupted 8 files. **Deploy tests use a scratch mod, full stop.** "Timestamps advanced +
  copies agree" is NOT correctness — only comparison against the pre-action source is. [VERIFIED — the SPEC-
  #66 incident AAR.]
- **The round-trip-oracle bug class.** An oracle that round-trips a **hand-written** "expected output" instead
  of its generator's **actual** output can be green while the generator is broken. This exact trap hid a
  FORGE-STATE emit bug (it used `\"` which renders literally and breaks JSON) for a full slice. **A round-trip
  oracle must feed the REAL generator output through a real/faithful transform.** Corollary: compile generated
  artifacts through the project's *authoritative* validator, not a bespoke check — that's what surfaced the
  bug. [VERIFIED — B24s2 AAR, 2026-07-13.]
- **`[=ERROR=]` false positive:** X4 stamps that prefix on ALL mod debug output, not just errors — don't read
  it as failure. [VERIFIED — forgeWatch/forgeState oracles.]
- **The `parent` keyword false-positive** and similar: several validation lints were FALSIFIED against the
  real corpus and removed — ground lints in vanilla examples, not intuition. [VERIFIED — ROADMAP.]
- **Records drift:** `SESSION-HANDOFF.md` has been *appended* to at every pause without pruning, so stale
  "remaining buildable" lines accumulated and once misled an automated goal-check. **Trust the "AUTHORITATIVE
  CURRENT STATE" block at the top; overwrite (don't append) the state section each close.** [VERIFIED —
  2026-07-13 reconcile.]
- **Failed approaches banked (do not repeat):** regex-over-XML scanning (false positives → use xmldom, B6);
  localStorage AI keys (leak → server-side key store); editable byte-unfaithful aiscript import; parallel e2e
  workers (clobbered live work); `{false && ...}` JSX to "disable" UI (dead code that lies). [VERIFIED —
  HANDOFF §14.]

---

## 8. Ken (the owner)

- **Role:** product owner, sole operator, sole committer. Not a professional software engineer — he
  validates *strategy* by **triangulation** (multiple frontier models converging on an idea = the idea is
  sound), and validates *experience* on his own screen. The shipped Forge is the proof this works. [VERIFIED
  — OPERATOR PROTOCOL.]
- **What only Ken can do:** commit/push (all mutating git); make the parked decisions (installer track,
  dependency posture); anything touching the **real mod, game dirs, or standing config** (write-gated — you
  give a one-paragraph what/risk/undo summary and wait for explicit go); and flip every **EXPERIENCE gate**
  (anything he must see/feel), which ships with a click-by-click script.
- **How he wants to be managed:** bluntly. He asked to be reminded of his failures (operational, under
  fatigue and multi-project load — he runs 3–4 projects in parallel and thrashes). Call degradation when you
  see it; flag overload; never dress a `[HYPOTHESIS]` as a `[REPRODUCED]` diagnosis. [VERIFIED — CLAUDE.md.]

---

## 9. The proving ground — the `x4_ai_influence` mod, the bridge, in-game verification

- **`x4_ai_influence`** is the real X4 mod built *with* the Forge to prove it works (its "1.0 proving
  factor"). **It is NOT in this repo** — it's authored via the Forge agent API and deployed into the game's
  extensions folder (`G:\...\extensions\x4_ai_influence`, a mount that forbids deletes → overwrite/truncate).
  Its high-water-mark source was once recovered from a Forge workspace `.snapshots/*.json`. A reference copy
  `ai_influence_test` is kept installed. [VERIFIED — not present under repo root on 2026-07-13; CLAUDE.md
  "Building the X4 mod" section.]
- **The Python bridge (`x4_neural_link`)** is a separate project (game↔HTTP loop, a SQLite DB, a `:8713`
  dashboard) — **also not in this repo.** It is a *lessons source only*, never a Forge dependency (importing
  it would violate the Forge's local-npm-only posture). It is preserved across deploys via `.forgekeep`.
  [VERIFIED — CLAUDE.md; not under repo root.]
- **In-game verification** = the real acceptance for player-facing mod features: launch X4 with debug
  logging, drive it, read `debuglog.txt` (and the FORGE-STATE Inspector), query the bridge DB. EXECUTION
  gates flip on machine-read events; EXPERIENCE gates flip on Ken's screen. This is why "code done + oracle
  green" for anything player-facing closes as **◐ PARTIAL** with the in-game half owed to Ken (e.g. B24s2).
  [VERIFIED — ADR-G3, B24s2 close.]
- **Note on scope:** the Forge codebase (this repo) and the mod/bridge (elsewhere) are different layers. The
  **graphify graph (§10) covers the Forge codebase, not mod content** — for mod authoring, use the agent API
  + ground against the vanilla corpus and the DeadAir reference mods.

---

## 10. The lookup layer — how to find anything later

- **graphify code graph** — `graphify-out/graph.json` (+ `graph.html`, `GRAPH_REPORT.md`): a precomputed
  AST-extracted knowledge graph of THIS codebase (~1,160 nodes / 2,649 edges at last build; god nodes:
  `ModWorkspace`, `MDNode`, `runProjectValidation()`, `generateMDXML()`, `resolveXsdConfig()`). Answers
  blast-radius / shortest-path / "what connects to X" cheaper than grep. Rebuild after code changes with
  `graphify update .` (deterministic, no LLM, seconds). **[FLAG for Codex:** the `graphify` CLI is installed
  for this environment but may not be in yours; the `graph.json` file itself is in the repo and readable
  directly. The graph is **code-only** — it excludes ROADMAP/docs/schemas/data.] [VERIFIED — CLAUDE.md
  "Code knowledge graph".]
- **Agent Brain** — a semantic knowledge graph of Ken's past work across tools, at
  `<DEV_ENV>\Agent Brain Vault` (front door `AGENT_BRAIN.md`; verbatim notes in `notes/`; graph in
  `graphify-out/graph.json`). Query it BEFORE non-trivial work or when Ken references "something we did
  before." **[FLAG for Codex:** it's normally queried via a Claude-Code MCP server or a Python CLI
  (`_brain-tools/query_brain.py`) — you may not have the MCP, but the vault + the Python CLI are on disk.]
  Coverage is partial (Cowork-heavy) and never includes the current live session. [VERIFIED — CLAUDE.md
  "Agent Brain".]
- **StarForge wiki** — `F:\StarForge\wiki\` is Ken's curated canon (plain markdown you read/grep directly).
  Start at `wiki\_master-index.md`; project canon under `wiki\x4-forge\` (capability-map, decisions,
  aar-log); cross-project workflow under `wiki\workflow\`. Brain = the raw dragnet; StarForge = the curated
  canon; distill durable brain findings into canon. [VERIFIED — CLAUDE.md "Memory".]
- **The Claude-Code skills** (`x4-forge-api`, `x4-forge-house`, `x4-forge-validate`, `x4-forge-editor`,
  `x4-reference-mods`, etc.) encode the endpoints, the house pattern, the validation discipline, and the
  DeadAir reference-mod recipes. **[FLAG for Codex:** these are Claude-Code skill packages you likely can't
  invoke — but the KNOWLEDGE they hold is what this document (and HANDOFF.md, CLAUDE.md) summarizes.]
- **Self-documenting API:** `GET /api/agent/schema` lists every endpoint with its contract — the live source
  of truth for the agent API. [VERIFIED.]

---

### Your first move as the incoming agent
1. Read `BACKLOG.md` + the top of `SESSION-HANDOFF.md` (the AUTHORITATIVE CURRENT STATE block).
2. `git log`/`git status` for the real committed state.
3. Check the server is up (`GET /api/agent/workspace`) — as of 2026-07-13 it was DOWN; restart + verify first.
4. Confirm the machine is Ken's to touch before any state-changing or in-game work (operator protocol).
5. Pick the next unit — but note (§6) the queued backlog is Ken-gated-only, so the honest next unit is
   helping Ken through the in-game/decision queue, or the one SPECIFIED code task (B10 structural rider) only
   once the live schema is loaded.
6. Whatever you build: follow the v3 workflow, ground in the real corpus/records (not memory), validate on
   the real gates, close honestly, and record it.
