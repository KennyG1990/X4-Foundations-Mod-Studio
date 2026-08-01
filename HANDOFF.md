# X4 Forge — AI-to-AI Development Handoff

> **⚠ CURRENCY BANNER (refreshed 2026-07-13, light lane).** The deep-onboarding sections below (§3, §15,
> §19, §20, §23) were written 2026-07-11 and are a HISTORICAL SNAPSHOT — the architecture/environment/
> philosophy sections (§1–2, §4–14, §16–18, §21–22, §24–28) remain accurate. For "where are we RIGHT NOW"
> trust, in this order: **`SESSION-HANDOFF.md`** (authoritative current state) → **`BACKLOG.md`** →
> **`ROADMAP.md`** (append-only). Load-bearing reversals since 2026-07-11 you MUST know:
> - **Workflow is v3** (the *Universal AI Task Workflow* — CLASSIFY→PLAN→BASELINE→RECONCILE→DOCUMENT→
>   IMPLEMENT→VALIDATE→REVIEW→DOCUMENT→AAR; statuses VERIFIED/PARTIAL/FAILED/BLOCKED/REVERTED), NOT the
>   8-step v2 described in older text. Canonical core: `UNIVERSAL_AI_TASK_WORKFLOW.md`.
> - **e2e now runs on an EPHEMERAL stack** (own Vite:3100 + API:3101 + token + temp `X4_STATE_DIR`, see
>   `playwright.config.ts`). **`tests/e2e/workspace-guard.ts` + `.teardown.ts` are DELETED**, and the
>   `page.route('**/api/agent/workspace')` isolation harnesses are gone — anywhere below that says "don't
>   bypass workspace-guard" or references those files is STALE. The live dev workspace is untouched by
>   construction; no machine-state ask is needed to run e2e. `test:e2e` (12 specs) is THE gate.
> - **The B2 mutable-singleton sync bug (§19 "known bug") is FIXED** (B2s3: disk persistence + legacy-write
>   gate, since superseded by immutable workspace identities and tab-local selection). Workspace state survives
>   restarts; legacy "parked" routes are Studio-session-only list/lookup compatibility surfaces, not a
>   process-global switcher.
> - **The BACKLOG is Ken-gated-only** as of 2026-07-13: every remaining item is a commit, a decision
>   (B8/B23/XPath/P-C-D), a write-gated deploy (B24s2), an in-game check, or an optional eyeball. There is
>   no agent-buildable feature work queued.
> - **HEAD advances with Ken's commits** (he commits via Antigravity); the "uncommitted set" in §20 is long
>   stale — read `git log`/`git status` for the real state.
>
> **Purpose:** onboard an AI agent with ZERO prior conversation history to this project: understand it,
> reproduce the environment, verify current state, continue safely, and not repeat old mistakes.
> **Written:** 2026-07-11, against commit `37209c8` + a known uncommitted working set (§3, §20).
> **Evidence discipline:** every claim is tagged — **[VERIFIED]** (observed in repo/runtime on 2026-07-11),
> **[DECISION]** (recorded prior decision), **[INFERENCE]** (reasonable, evidence cited, not re-proven today),
> **[ASSUMPTION]** (unverified — treat as a question). Prior versions of this file (session-notes style)
> live in git history of `HANDOFF.md`.
>
> **Companion records (read order for a new session):** `BACKLOG.md` (open work) → `SESSION-HANDOFF.md`
> (working-state transfer from the outgoing agent) → this file (full onboarding) → `ROADMAP.md`
> (append-only verified history, 3,933 lines) → `AGENTS.md`/`CLAUDE.md` (operator protocol + mandatory
> workflow — **read these before touching anything; they are binding**).

---

## 1. Executive Summary

**What it is [VERIFIED — `README.md:1-35`]:** X4 Forge is a **local visual workbench for building,
validating, packaging, and deploying mods for the game X4: Foundations** (Egosoft). Node-based visual
editing of Mission Director (MD) XML, schema-aware validation against the game's real XSDs, live
diagnostics, cross-mod conflict analysis, one-click deploy into the game's `extensions/` folder,
Nexus-ready zip packaging, GitHub publishing, opt-in AI assistance, and a local HTTP "agent API" so
external AI agents can drive it headlessly.

**Who it's for:** X4 modders (including non-programmers), and AI agents automating mod authoring.
The proving user is Ken (project owner, **not a software engineer** — explanations to him must be
plain-language; he validates strategy by cross-model triangulation).

**Problem it solves:** X4 modding is scattered XML, hand-written MD scripts, XPath guesses, and
trial-and-error against a running game. The Forge makes the game install + XSDs + generated files the
source of truth and ties UI, compiler, diagnostics, and API to that evidence.

**Development phase [VERIFIED — `BACKLOG.md`, `SESSION-HANDOFF.md`]:** post-1.0-proof, active
optimization. The Forge already shipped real mods end-to-end (mods built here run in-game). The release
track (packaged installer, B8) is **deliberately parked — Ken's explicit call ("cold feet")**. Standing
direction: optimize features, trim redundancy, improve UI/UX, shorten the "I have a mod idea → I shipped
a mod" timeline.

**What currently works [VERIFIED — oracle sweep exit 0 + host tsc exit 0, both run 2026-07-11]:**
the full author→compile→validate→package→deploy→run-in-game→round-trip chain; ~40 deterministic
selftest oracles all green; typecheck clean including the uncommitted working set.

**What is incomplete:** B13 QoL batch is implemented but **not fully verified** (e2e suite not rerun
after the last edits; visual items pending Ken's eyeball — §20); B2 sync slice 3 (per-mod server state)
is spec'd; long-tail items B10/B11/B12/B14 spec'd (§3, §25).

**The single most important thing to understand:** this project runs under a **mandatory, non-negotiable
workflow** — v3 as of 2026-07-12: the **Universal AI Task Workflow** (CLASSIFY → PLAN → BASELINE →
RECONCILE → DOCUMENT PLAN → IMPLEMENT → VALIDATE → REVIEW → DOCUMENT CLOSE → AAR; canonical text
`UNIVERSAL_AI_TASK_WORKFLOW.md`, inlined with the X4 Forge Project Adapter) — defined in
`AGENTS.md`/`CLAUDE.md`, with an **operator protocol** for managing Ken himself. Nothing is "done" on
inference — only on cited validation. **Agents never run mutating `git`; Ken commits.** An undocumented
task is a lost task.

## 2. Project Goals and Success Criteria

- **Primary objective [DECISION]:** the most powerful, user-friendly X4 mod editor — proven by building
  real mods end-to-end inside it. Status: **implemented and proven** (mods `x4_ai_influence` and
  `property_attack_alerts` built/deployed; the latter researched→built→packaged in one sitting as a
  deliberate timeline validation, ROADMAP 2026-07-10).
- **Secondary objectives:** agent API for headless automation (**implemented**, `/api/agent/*`);
  validation engine as a standalone product (**implemented**: `POST /api/agent/project/validate
  {fromPath}` + `npm run validate:mod` CLI); AI-assisted authoring (**implemented, opt-in, default
  off** — determinism doctrine §12); packaged installer for non-devs (**parked**, B8).
- **Non-goals [VERIFIED — `README.md:35`]:** not a Blender replacement; no 3D asset authoring. AI is
  never load-bearing for correctness (§12).
- **Technical requirements & status:** deterministic validation vs real game XSDs (**implemented**,
  ~40 oracles); byte-fidelity round-trip for imported mods (**implemented** — fidelity-first compiler,
  original bytes for untouched files); sync safety between canvas and server (**implemented** through
  CAS slice 2 — divergence badge, 409 write-conflict card; slice 3 spec'd); production build with dev
  surfaces removed (**implemented** — `run_command` 404s in prod, verified per ROADMAP 2026-07-08).
- **Definition of done (per task) [DECISION — `AGENTS.md`]:** ✅ only when ALL applicable validation
  methods pass and are cited by name (host tsc, oracle sweep, browser confirmation, e2e, in-game where
  player-facing). Partial = ◐ with the missing method named. EXPERIENCE-grade surfaces additionally
  require Ken's eyeball (ADR-G3).
- **Known constraints:** Windows host; game installed; agents may not commit; Ken lives on this machine
  (§23 rule 2); sandbox filesystem mirrors of this repo are stale/lying (§23 hazard list).

## 3. Current Project State

- **Branch [VERIFIED via read-only `git branch --show-current` through the job API, 2026-07-11]:** `main`
- **HEAD [VERIFIED]:** `37209c8cb6519fc199b08214f15d43d0992dbbf7` — "feat(ai): Implement server-side AI
  key storage and migration" (2026-07-11)
- **Recent commits [VERIFIED, `git log -3`]:**
  - `37209c8` (2026-07-11) server-side AI key storage + migration (audit #3)
  - `d92194e` (2026-07-11) sync conflict handling + version parsing (B2 slice 2 + audit #1)
  - `8243a93` (2026-07-10) Nexus-ready mod packaging and zip generation (B9)
- **Uncommitted changes [VERIFIED, `git status --porcelain`]:** modified `ROADMAP.md`, `src/App.tsx`,
  `src/components/Canvas.tsx`, `src/components/LibraryConfigurator.tsx`,
  `src/components/ModDependencyView.tsx`, `src/lib/apiHelper.ts`; **untracked**
  `src/components/ShortcutsOverlay.tsx`. This working set = audit #4 (fetchJson helper) + audit #5
  (B13 QoL batch). Suggested commit title: *"Audit #4+#5: fetchJson helper; B13 QoL — empty-state
  previews, delete toasts with undo, shortcuts overlay, badge clip fix"*. **Do not assume uncommitted
  code is fully correct — see §20 for exactly what is and isn't verified.**
- **Build status [VERIFIED 2026-07-11]:** host `npx tsc --noEmit` exit 0 (run via job API, includes the
  uncommitted set). Production build not rebuilt today; `dist/` exists from prior builds [INFERENCE].
- **Test status:** oracle sweep (`node scripts/oracle-sweep.mjs`) **exit 0, all endpoints PASS**
  [VERIFIED 2026-07-11 — sample counts: simulate 59/59, semantics 46/46, cue-lineage 35/35,
  scriptproperties 32/32, contract 32/32, explain 30/30, port-semantics 26/26, composite-blocks 23/23,
  critic 23/23, round-trip 17/17]. e2e: **FULL suite 11/11 rerun 2026-07-11 AFTER the B13 edits**
  [VERIFIED — `test:canvas` 4/4 + project-validate 6/6 + xml-patch-merge 1/1; workspace-guard restore
  confirmed]. Count clarification (corrected 2026-07-11): `test:canvas` = the 2 canvas specs = **4
  tests**; "11" is the FULL suite. Note the libuv teardown crash corrupting exit codes (§22).
- **Runtime status [VERIFIED 2026-07-11]:** dev pair live on Ken's machine — app answering on :3000,
  API on :3001 (all evidence in this file gathered through the running app).
- **Complete features:** see ROADMAP "Current State" sections; headline: visual MD canvas, XSD+semantic
  validation engine, aiscript validation, scriptproperty validation, quick-fixes, preflight+deploy chain,
  drift detection, live log telemetry→canvas, release packaging (zip), GitHub sync, wares/jobs editors,
  XML patching, t-files, galaxy map, wiki browser, self-healing dev supervisor, agent API + selftest
  registry, workspace sync CAS slices 1-2.
- **Partially complete:** B13 QoL (implemented, verification gap §20); B2 slice 3 spec'd; B11 aiscripts
  visual editing (import is byte-guarded passthrough by design); B10 long-tail action semantics (~40 of
  785 actions curated).
- **Removed/superseded:** `modFixes.ts` (absorbed into quick-fix engine, B4); regex-over-XML scanning
  (replaced by xmldom, B6); localStorage AI keys (migrated server-side, audit #3); the "UI-only mod
  building" mandate (REVERSED 2026-06-24 — agent API allowed).
- **Doc↔code mismatches found 2026-07-11:** `.env.example` claimed keys live in browser localStorage —
  **fixed this session** (now documents the server-side store). ROADMAP tail (~line 3900) still carries
  2026-06-29 "validation gaps to fix later" notes whose items #3/#4 (scriptproperty catalog ingest,
  aiscript XSD depth) have SINCE been implemented — treat those notes as historical, status of gaps
  #1/#2 (import root reporting, multi-file validate mode) is **[ASSUMPTION — re-verify before acting]**.

## 4. Repository and File Structure

Root: `<WORKSPACE_ROOT>` [VERIFIED listing 2026-07-11].

| Path | Purpose | Notes |
|---|---|---|
| `server.ts` | THE backend — Express API, ~7k+ lines monolith | Being modularized into `src/server/*` (stage 3 done). Edit carefully; hot spots in §27 |
| `src/App.tsx` | Root React component; workspace state, sync loop, undo/redo, header, view routing | Owns the 300ms debounced sync + 3s adoption poll (§5) |
| `src/components/` (40 files) | All React views/editors | `Canvas.tsx` (node editor), `Sidebar.tsx` + `PropertiesInspector.tsx`, `LibraryConfigurator.tsx` (wares/jobs), `PlaytestWorkspace.tsx` (deploy/package), `CodePreview.tsx`, `DiagnosticsHub/Center`, `SyncModal.tsx` (mod import), `ShortcutsOverlay.tsx` (new, untracked) |
| `src/lib/` (~70 files) | Pure deterministic engines — the project's crown jewels | Compiler (`modCompiler.ts`), validators (`xsdValidate.ts`, `projectCrossFileValidation.ts`, `aiscriptLint.ts`, `scriptProperties.ts`), sync identity (`workspaceIdentity.ts`, `compileFidelity.ts`), packaging (`modDistribution.ts`), simulation (`mdSimulate.ts`), semantics (`mdSemantics.ts`, `mdExplain.ts`, `mdCritic.ts`) |
| `src/server/` | Extracted server modules | `validationRoutes.ts`, `projectValidation.ts`, `selftestRegistry.ts`, `githubRoutes.ts`, `aiKeyStore.ts`, `liveBridge.ts`, `npcIdentityProbe.ts` |
| `src/types.ts` | Core model: `ModWorkspace`, `MDNode`, `MDLink`, `NODE_TEMPLATES`, `validateModWorkspace`, `generateMDXML` | God module — 67-edge hub in the code graph |
| `scripts/` | `oracle-sweep.mjs` (run ALL selftests), `precommit-check.mjs`, `x4validate.ts` (CLI validator), `x4_cat_extract.py` | |
| `tests/e2e/` | Playwright specs + `workspace-guard.ts`/`.teardown.ts` (snapshot/restore the live server workspace around runs) | `canvas-interactions.spec.ts`, `canvas-coverage.spec.ts` = `npm run test:canvas`; also `project-validate.spec.ts`, `xml-patch-merge.spec.ts` |
| `BACKLOG.md` / `ROADMAP.md` / `SESSION-HANDOFF.md` / this file | Records system (§23) | BACKLOG=open work only; ROADMAP=append-only verified history |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` | **Binding agent instructions** — workflow, operator protocol, hazards | Read before working |
| `restart-studio.bat`, `forge-watchdog.cmd`, `run-*-supervised.cmd` | Dev launchers (3-window self-healing supervisor) | |
| `START-X4FORGE.cmd` | Production launcher (built single server) | |
| `config.json` (gitignored; `config.example.json` template) | Per-machine paths: game dir, XSD dir, mod workspace, extensions dir | |
| `data/` (gitignored) | Server runtime state incl. `ai-keys.json` (SECRETS — never commit) | |
| `graphify-out/graph.json` | Code knowledge graph (3106 nodes/7272 edges) — `graphify query/affected/path/explain` CLI | Regenerate after code changes: `graphify update .` |
| `docs/plans/`, `forge-skills/` (gitignored) | Durable plans + local reusable Forge development skills | |
| `assets/`, `public-assets/`, `index.html`, `vite.config.ts`, `playwright.config.ts`, `tsconfig.json`, `eslint.config.js` | Frontend shell + tooling config | Vite deliberately uses `public-assets/`; legacy `public/` is ignored |

**Generated-output cleanup:** `npm run clean -- --dry-run` previews the contained allowlist;
`npm run clean` removes only reproducible build, staged-extension, VSIX, and test output. It preserves
dependencies, config/secrets, runtime data/history, corpus caches, `graphify-out`, source, docs, and
tracked release evidence. **Do not casually modify:** `server.ts` sync/CAS region,
`src/lib/modCompiler.ts` fidelity paths, or anything in §23.

## 5. Architecture

```
┌────────────────────────── Ken's Windows machine ──────────────────────────┐
│                                                                           │
│  Browser (localhost:3000)                                                 │
│  ┌──────────────────────────────┐   Vite dev server :3000 (UI only)       │
│  │ React 19 SPA (src/App.tsx)   │◄──HMR── serves src/, injects            │
│  │  Canvas · editors · panels   │         __STUDIO_API_TOKEN__            │
│  └───────┬──────────────────────┘                                         │
│          │ fetch /api/* (+ Authorization: Bearer <token>)                 │
│          ▼ (vite proxy → 127.0.0.1:3001; 503 while API restarts)          │
│  ┌──────────────────────────────┐                                         │
│  │ Express API (server.ts, tsx  │── reads/writes ─► mod workspace folder  │
│  │ watch :3001; prod: single    │── deploys ──────► game extensions dir   │
│  │ server :3000 from dist/)     │── reads ────────► X4 install + XSDs     │
│  │  /api/agent/* (agent API)    │── stores ───────► data/ (keys, caches)  │
│  │  /api/ai/* (key store)       │── sqlite ───────► better-sqlite3 (db.ts)│
│  │  /api/run_command (DEV ONLY) │── AI calls ─────► provider APIs (opt-in)│
│  └──────────────────────────────┘                                         │
│  forge-watchdog.cmd: respawns either window if it dies                    │
└───────────────────────────────────────────────────────────────────────────┘
```

- **State model:** ONE active server-side workspace (the singleton is the known limitation B2-slice-3
  addresses). Client keeps the canvas in React state + localStorage
  (`x4_mod_studio_workspace`); server holds the authoritative copy with `workspaceVersion`
  (Date.now()-seeded, restart-proof) + `workspaceContentHash` (FNV-1a, `src/lib/workspaceIdentity.ts`).
- **Sync (the hardest-won subsystem — ADR-F1):** client edits → 300ms debounce → POST with paired
  `expectedHead` + `expectedSnapshotHash` (the last server identities it saw) → server compares → mismatch = **409 conflict** →
  UI renders WRITE CONFLICT card (Adopt server / Keep mine; adoption poll is HELD during conflicts via
  `syncConflictRef`). Separately a 3s poll adopts newer server versions when the client has no local
  edits, and a persistent hash divergence shows the amber "CANVAS ≠ SERVER" badge. [VERIFIED live
  2026-07-10; code: `src/App.tsx` sync effect ~line 758, `server.ts` `applyWorkspaceMutation` ~2981.]
- **Compile/deploy flow (end-to-end):** canvas graph → `generateMDXML`/compilers → fidelity layer
  (untouched imported files re-emit ORIGINAL bytes; edited files pass a verified round-trip gate) →
  deploy copies into the game `extensions/<modid>/` → deploy-verify re-validates + checks
  source-sync (`sourceStamp` content fingerprint gates stale-source deploys) → optional zip release
  (`modDistribution.ts`, zero-dependency ZIP writer using node zlib).
- **Validation engine:** XSD structural (real game schemas, multi-slot cached index) + cross-file cue
  resolution + md↔lua binding + aiscript lint + scriptproperty chains + corpus-grounded pitfall lints
  + intent-check. Shared core `runProjectValidation` serves UI, agent API, `{fromPath}` mode, and CLI.
- **Auth:** every `/api` call needs the per-boot studio token (`.studio-api-token`, injected into the
  page; `PUBLIC_READONLY_GETS` allowlist exempts read-only selftest/status GETs — a new selftest not
  allowlisted returns 401 — recurring gotcha). API binds 127.0.0.1.
- **Observability:** debug-watcher tails the game debuglog and attributes errors→cues→canvas nodes
  (live badges); FORGE-WATCH log protocol for watched variables; selftest registry = health surface;
  `supervisor.log` + per-window consoles for the dev processes.
- **Error-handling strategy:** deterministic engines return structured findings (never throw for
  user errors); API errors are JSON `{error}`; client `fetchJson`/`handleApiResponse`
  (`src/lib/apiHelper.ts`) surfaces real server messages (mid-restart HTML → clean 503 message).

## 6. Technology Stack

[VERIFIED — `package.json` 2026-07-11]

- **Language:** TypeScript ~5.8.2 (strict; `npm run typecheck` is a hard gate). Node.js on Windows.
- **Frontend:** React 19.0.1, Vite 6.2.3 (strictPort 3000), Tailwind CSS 4.1.14 (`@tailwindcss/vite`),
  lucide-react icons, motion 12.
- **Backend:** Express 4.21.2 run via tsx 4.21 watch (dev) / esbuild-bundled `dist/server.cjs` (prod).
- **XML/parsing:** `@xmldom/xmldom` 0.9.10 (DOM scanning — chosen over regex, B6), `fast-xml-parser` 5.8,
  `xpath` 0.0.34, `luaparse` 0.3.1 (Lua syntax gating).
- **Persistence:** `better-sqlite3` 12.10 (`src/lib/db.ts`) + JSON files under `data/` + localStorage.
- **AI SDK:** `@google/genai` 2.4 (Gemini); other providers called via fetch [INFERENCE from
  `callMultiProviderAI` in `server.ts`].
- **Testing:** Playwright 1.61 (e2e, single worker — deliberate, see `playwright.config.ts` comments);
  in-house selftest oracles (~40 endpoints) swept by `scripts/oracle-sweep.mjs`.
- **Lint:** eslint 9 + typescript-eslint 8 + react-hooks plugin.
- **No CI service** — gates are local: `npm run precommit:check`, oracle sweep, e2e. [DECISION: local-first,
  no third-party trackers/CI.]
- **Version-sensitive:** React 19 + Vite 6 (plugin-react 5); Tailwind 4 (CSS-first config); zip writer
  deliberately has NO dependency (stdlib zlib — check-stdlib-before-npm is banked doctrine).

## 7. Development Environment Setup

All commands run from repo root `<WORKSPACE_ROOT>` unless stated.

1. **Prereqs:** Windows, Node.js ≥20 [ASSUMPTION — engines not pinned in package.json; @types/node is 22],
   git, X4: Foundations installed (Ken's install: `<X4_GAME_INSTALL_DIR>`),
   extracted X4 XSD schemas (from the game's cat/dat archives — `scripts/x4_cat_extract.py` and the
   unpacked corpus at `<X4_UNPACKED_CORPUS>` exist for this).
2. **Install:** `npm install`
3. **Configure paths:** copy `config.example.json` → `config.json` and set `x4GamePath`, `xsdSchemaPath`,
   `modWorkspacePath` (Ken's: `<MODS_ROOT>`), `filesystemPath` (game `extensions/`).
   Or use the in-app SETTINGS modal (writes the same file).
4. **Secrets (optional):** copy `.env.example` → `.env.local`; AI provider keys can instead be entered
   in-app (stored server-side in `data/ai-keys.json`, gitignored).
5. **Run (dev):** `restart-studio.bat` — spawns three windows: vite (:3000), API (`tsx watch server.ts`,
   :3001), and `forge-watchdog.cmd` (respawns dead windows; Ken kill-tested both paths 2026-07-09).
   Manual equivalent: `npm run dev:web` + `npm run dev:api`.
6. **Run (prod):** `npm run build` then `START-X4FORGE.cmd` (single server, static bundle,
   `run_command` disabled).
7. **Gates:** `npm run typecheck` · `npm run lint` · `node scripts/oracle-sweep.mjs` ·
   `npm run test:canvas` (e2e; **WARNING** — replaces the live server workspace during the run,
   guard restores it after; never run while Ken is editing) · `npm run precommit:check`.
8. **CLI validator:** `npm run validate:mod -- "<mod folder>"` (exit codes, CI-ready).
9. **Code graph:** `graphify update .` after code changes; query with `graphify query "..."`.

**Agent-specific environment truth (critical):** if you are an AI agent with a sandboxed Linux mirror of
this repo, **your mirror is STALE — reads, greps, and any `tsc` there LIE** (documented lived incidents:
phantom truncation errors, a deletion decided on false reference counts, a corrupted commit). Use host
file tools and the Forge's own job API for host commands:
`POST /api/run_command/job {cmd}` → poll `GET /api/run_command/job/<id>` (dev-only, output in `tail`).
Synchronous `GET /api/run_command?cmd=...` freezes page fetches for the child's lifetime — use the job
API for anything >5s.

## 8. Configuration and Secrets

- **`.env.local`** (gitignored; template `.env.example` [VERIFIED]): `GEMINI_API_KEY`,
  `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (all optional; used ONLY for requests
  originating from the app UI — Origin-gated), `GITHUB_CLIENT_ID` (device-flow OAuth, public
  identifier), `STUDIO_API_TOKEN` (optional stable token; otherwise a fresh one per boot),
  `X4_GAME_PATH`/`X4_XSD_PATH` overrides.
- **`config.json`** (gitignored): the five machine paths (§7.3). Missing config → app runs, game-data
  features degrade [INFERENCE].
- **`data/ai-keys.json`** (gitignored via `data/`): server-side AI key store — write-only API
  (`POST /api/ai/keys`), boolean status endpoint, never returned to the browser. **SENSITIVE.**
- **`.studio-api-token`** (gitignored): per-boot API auth token, injected into index.html by
  `vite.config.ts` (dev) / `server.ts` (prod).
- **Ports:** UI 3000 (strict), API 3001 (`API_PORT` env). Prod: one server (README/launcher; :3100 was
  used in a proof run). **Timeouts:** vite proxy returns soft 503 during the ~2-3s API restart window;
  e2e timeout 60s/test, expect 10s. **Feature flags:** `aiTier` (off/explain/assist/cobuild — default
  OFF), `DISABLE_HMR`, `NODE_ENV=production` gates `run_command` out.
- **Config in code but under-documented:** `PUBLIC_READONLY_GETS` allowlist in `server.ts` (which GETs
  skip token auth) — every new public selftest must be added there or it 401s.

## 9. Data Model and Persistence

- **Authoritative sources of truth, by domain [DECISION — determinism doctrine]:**
  - Mod content: the **generated files on disk** (workspace folder → deployed extension). The canvas
    graph is an editing MODEL, not the artifact.
  - Game legality: the **game's own XSDs + unpacked game data** (never AI output).
  - Workspace state: the **server's in-memory workspace** (+ its version/hash); client localStorage is
    a cache. Divergence is surfaced, never silently resolved (B1/B2).
- **`ModWorkspace`** (src/types.ts): nodes, links, wares, jobs, aiScripts, xmlPatches, tFiles,
  contracts, uiWidgets, passthroughFiles (base64 for binary/foreign files), originalFiles (byte
  fidelity), name/version/sourceFolder/metadata. Serialized as JSON to localStorage + server.
- **SQLite** (`src/lib/db.ts`, better-sqlite3): telemetry/bridge-side storage [INFERENCE — inspect
  before relying; the neural-link bridge DB on :8713 is a SEPARATE project].
- **Durable vs derived:** durable = mod files, config, keys, ROADMAP/records; derived = compiled XML
  previews, validation findings, graphify graph, `.snapshots/`, caches (`.studio-cache/`, schema index
  slots); transient = job outputs, `.tmp_*`, `temp_import/`.
- **Data-loss protections (born from incidents):** named snapshots (`.snapshots/`), undo checkpoints
  (App-level `pastStates`), e2e workspace-guard snapshot/restore, fidelity gate (edited files must
  round-trip byte-verified or the compile REFUSES), sourceStamp stale-source deploy gate, CAS 409s.
- **Retention/backup:** git (Ken-driven) + `.snapshots/` + game-side copies. No automated offsite
  backup [VERIFIED absence — nothing in repo].

## 10. APIs and Interfaces

All under `http://localhost:3000/api` (proxied to :3001 in dev). Auth: `Authorization: Bearer <token>`
header (token from `.studio-api-token` / injected `window.__STUDIO_API_TOKEN__`; **NOT an
`x-studio-token` header** — that wrong claim in an earlier draft cost a 401'd probe, corrected
2026-07-11) EXCEPT the `PUBLIC_READONLY_GETS` allowlist. Self-documenting: `GET /api/agent/schema`
(public) states the auth contract. Errors: JSON `{error: string}`.

**Agent API (headless automation — the stable surface):**
- `GET /api/agent/workspace` → addressed workspace + `version` + `workspaceHash` + `snapshotHash`.
- `POST /api/agent/workspace` `{workspace, expectedHead?, expectedSnapshotHash?}` → replace; **409** on either stale identity.
- `POST /api/agent/project/validate` `{files?|fromPath?}` → `{ok, errors, findings, report}` — THE
  legality check (XSD + cross-file + md↔lua + lints).
- `POST /api/agent/compile`, `/api/agent/deploy`, `/api/agent/package/release` `{bump}` → zip path.
- `GET /api/agent/mod-drift?mod=<id>` → workspace-vs-deployed verdict (identical/stale/FORKED).
- `GET /api/agent/debug-watcher/brief` → in-game error attribution (mind the known `[=ERROR=]` marker
  false-positive on `runtimeErrors`).
- `GET /api/agent/<name>-selftest` (~40 endpoints, see `selftestRegistry.ts`) → `{allPassed, passed,
  total, checks[]}`. Sweep: `node scripts/oracle-sweep.mjs` (exit non-zero on any red).
- `GET /api/agent/catdat-debug?file=<vpath>` → read base-game files (read-only, path-guarded, 200k cap).
- `GET /api/agent/mod-dependency-graph` → installed-extensions load order/cycles/missing deps.
- `POST /api/agent/lua-staleness/instrument {modId}` → REWRITES deployed mod Lua (reversible,
  luaparse-gated) — **write-gated: Ken's explicit go required.**
- **Dev-only:** `POST /api/run_command/job {cmd}` + `GET /api/run_command/job/:id` (§7); sync GET
  variant exists but freezes page fetches — avoid.
- **AI:** `POST /api/agent/generate` apply requires both workspace hashes, commits only after all provider/validation work, and returns both post-write hashes; AI routes take `x-ai-provider`/`x-ai-model`/`x-ai-reasoning` headers;
  external agents MUST send their own `x-custom-api-key` (server env/stored keys are app-UI-origin-only).
- `POST /api/ai/keys {provider, key}` (write-only) · `GET /api/ai/keys/status` → booleans.

**CLI:** `npm run validate:mod -- "<folder>"`. **UI extension points:** `window.__X4_E2E__` bridge
(dev-gated) for tests; `navigate-to-source` CustomEvent bus for click-to-navigate.

## 11. Core Workflows

- **Author→ship (the product's reason to exist):** SETTINGS paths → build in canvas/editors →
  live diagnostics (validate on the fly) → CodePreview XML inspect → Preflight & Deploy (one button:
  validate → compile → deploy → deploy-verify checklist incl. source-sync stage) → run X4, watch
  debug-watcher badges on the canvas → (optionally) Playtest tab → 📦 Package for Release
  (`none/patch/minor` bump; **any error diagnostic blocks packaging**) → Nexus-ready zip in
  `<modWorkspacePath>\releases\`. Failure modes: validation errors (blocking, with quick-fix buttons),
  stale-source deploy (gated), write conflict (card). Tests: oracle endpoints per engine +
  `project-validate.spec.ts` + `test:canvas`.
- **Import/round-trip:** SyncModal → Load Mod Project → files classified editable (byte-faithful
  round-trip proven) vs passthrough (lossless bytes) → edit → export re-emits originals for untouched
  files. Aiscripts stay passthrough BY DESIGN (namespacing makes faithful round-trip impossible —
  ROADMAP #52 decision).
- **Sync/conflict (§5):** normal path silent; conflict path is ALWAYS a human decision (card).
- **e2e run:** `npm run test:canvas` — guard snapshots live workspace → seeded fixtures (POST+GET
  isolation toggles, capture-original-FIRST ordering — see spec comments) → restore. Verify
  `GET /api/agent/workspace` returns the real mod after a run (known leak class #70).

## 12. AI-Specific Behaviour

- **Doctrine [DECISION, ROADMAP A4/A5]:** AI is an opt-in **drafting/explaining layer**; the
  deterministic engine is the referee. Default tier `off` — zero AI requests when off (M-DET-2).
  Three independent verdicts on any AI proposal: schema-valid (XSD) / graph-valid (lineage/critic) /
  intent-matched (`intentCheck.ts` — catches "compiler-valid but dropped the user's trigger").
  **No data may rely solely on AI output: legality ALWAYS comes from the deterministic validators.**
- **Providers [VERIFIED — `src/lib/apiHelper.ts`]:** gemini (default `gemini-3.5-flash`), claude
  (`claude-4-6-sonnet-latest`), openai (`gpt-5.5`), openrouter (`google/gemini-2.5-flash`); per-provider
  model + reasoning-level settings in localStorage; active provider gate `hasProviderKey()` (server
  boolean status, no key material client-side).
- **Key resolution [VERIFIED — server.ts `callMultiProviderAI`]:** `x-custom-api-key` header (external
  agents) → server-stored key (app-UI origins only) → `.env` fallback (app-UI only). Keys write-only.
- **Known failure modes:** valid-but-wrong output (mitigated by intent-check; documented limitation:
  same model extracts requirements, so self-consistent wrong tags can pass); quota errors mapped to a
  friendly message in `apiHelper.handleApiResponse`.
- **Eval:** `aiEvalSuite` harness scoped (ROADMAP A4.4/M-SEM-1) — metrics defined, harness NOT fully
  built [VERIFIED scoping only].

## 13. Design Decisions and Rationale (ADR digest)

Full ledger: `F:\StarForge\wiki\x4-forge\decisions.md` (outside this repo; not readable in every agent
session — the digest below is from session canon [DECISION] and ROADMAP citations).

1. **ADR-F1 — content-addressed sync (CAS)** over lock-based or last-writer-wins: hashes make staleness
   VISIBLE; humans resolve conflicts. Active. Reconsider only with real multi-writer requirements (B2-3).
2. **Fidelity-first compiler**: untouched imported files re-emit original bytes; edited files must pass
   a byte-verified round-trip or compile refuses. Born from the graph-compile data-loss incident. Active.
3. **Aiscripts = passthrough on import** (namespacing rename breaks faithful round-trip). Rejected
   alternative: editable-with-divergent-files (shipped a bug before being caught). Active until an
   explicit namespacing-reconciling flow exists (B11).
4. **Determinism doctrine / AI opt-in default-off** (Codex cross-review 2026-06-16): deterministic
   verdicts are the product; AI is drafting. Active.
5. **MD-only records, no third-party trackers; commits are Ken's alone** (2026-07-01): agents never run
   mutating git (a sandbox commit once corrupted a file via stale mounts). Active — hard rule.
6. **Zero-dep zip** (stdlib zlib + hand-rolled container) over fflate/adm-zip. Active; also a general
   lesson (check stdlib first).
7. **e2e single-worker + workspace-guard** — serial and honest over parallel and flaky (two live
   clobber incidents). Active until isolated test workspaces (B2-3 enables).
8. **UI-only mod-building mandate REVERSED** (2026-06-24): agent API allowed for mod authoring; UI gaps
   found while building are logged, not blocking.
9. **Dev/prod split**: dev = vite+tsx 3-window supervisor; prod = single esbuild bundle with dev
   surfaces (run_command) compiled out. Active.

## 14. Development History (why it looks like this)

Milestones [from ROADMAP, append-only]: visual canvas + compiler core → import/round-trip + fidelity
guards → validation engine buildout (XSD requiredness, aiscript path, scriptproperties, pitfall lints —
several planned lints were FALSIFIED against the vanilla corpus and recorded as such) → agent API +
selftest registry (~40 oracles) → beta-UX pass (autocomplete, quick-fix buttons, preflight+deploy,
wizards) → live telemetry (debuglog→cue→canvas badges, FORGE-WATCH) → performance/dedup audits (A1-A8,
R1-R4: schema-index cache, shared classifiers, selftest registry migration of ~60 handlers, xmlLite) →
**the sync-trust arc** (stale-canvas overwrite incident → "lossy compiler" MISDIAGNOSIS → headless
reproduction proved the compiler faithful → real cause: version reset on restart → monotonic versions,
content hashes, badge, CAS, conflict card, source-sync deploy gate) → release packaging (B9) + timeline
proof (Property Attack Alerts mod: idea→shipped zip in one sitting) → operator protocol + records v2
(BACKLOG/ROADMAP/SESSION-HANDOFF discipline) → current QoL/audit track.

**Failed approaches (do not repeat):** regex-over-XML scanning (false positives → xmldom, B6);
localStorage AI keys (leak surface → server store); editable aiscript import (divergent files);
parallel e2e workers (clobbered live work twice); trusting sandbox mirrors (multiple incidents);
`{false && ...}` JSX to "disable" UI (dead code that lies — banked anti-pattern A7).

## 15. Testing and Verification

- **Layers:** (1) **76** deterministic selftest oracles (in-engine fixtures, exposed as GET endpoints,
  swept by `node scripts/oracle-sweep.mjs` — exits non-zero on any red; discovery reads the RUNTIME
  selftest index (B27), not a source regex); (2) Playwright e2e — **`npm run test:e2e` is THE gate**
  (full suite, **12 specs**, runs on the B31s2 EPHEMERAL stack — own Vite/API/token/state-dir per run,
  live workspace untouched by construction; `test:canvas` is retired) via `scripts/run-e2e.mjs`, which
  parses the summary and exits on the VERDICT — the raw Playwright exit code was corrupted by a libuv
  teardown crash on the OLD shared-server model (§22) and must never be trusted directly (the crash has
  not recurred on the ephemeral stack, but the verdict-parse gate stays as armor); (3) host gates
  `npm run typecheck`,
  `npm run lint`, `npm run precommit:check`; (4) browser confirmation (see the x4-forge-confirm/validate
  skills: SEE the change, screenshot it); (5) in-game verification for player-facing mod features
  (EXECUTION gates on game-emitted events; EXPERIENCE gates on Ken's eyeball — ADR-G3).
- **No unit-test framework** (vitest is audit item #8, planned). Component logic is covered indirectly
  via oracles + e2e [VERIFIED — no vitest/jest in package.json].
- **Fixtures:** e2e seeds workspaces through the dev-gated `window.__X4_E2E__` bridge with POST+GET
  isolation; **ordering matters** — capture the server's true `original` BEFORE `startGetIsolation`,
  stop isolation before teardown verify (the B15 root cause; see spec comments).
- **Known flake class:** none currently red [VERIFIED sweep+tsc 2026-07-11]; historical flakes were
  real bugs (overlay eating clicks; adoption poll racing fixtures) — treat new flakes as signal.
- **Verification checklist for an incoming agent (run in order, ~3 min):**
  1. `git status` (read-only) — compare against §3.
  2. App up? `GET http://localhost:3000/api/agent/workspace` (else `restart-studio.bat`).
  3. `npm run typecheck` → expect exit 0 (observed 2026-07-11).
  4. `node scripts/oracle-sweep.mjs` → expect exit 0, all PASS (observed 2026-07-11).
  5. `npm run test:canvas` → expect 4/4; full suite (add project-validate + xml-patch-merge) → 11/11
     (last observed 2026-07-11, AFTER the B13 edits — green). **Ask Ken before running — it swaps the
     live workspace.** Judge by the "N passed" summary line, NOT the exit code (libuv teardown crash,
     §22); verify the guard restored the workspace afterwards (authenticated GET /api/agent/workspace).
  6. Report any mismatch with this file BEFORE changing code.

## 16. Build, Packaging, Deployment, and Release

- **App build:** `npm run build` = vite build (UI → `dist/`) + esbuild bundle (`server.ts` →
  `dist/server.cjs`, sourcemapped, packages external). Run: `npm run start:prod` / `START-X4FORGE.cmd`.
  Version: `package.json.version` → injected as `__APP_VERSION__` (single source, header displays it).
- **Mod packaging (product feature):** `POST /api/agent/package/release` / Playtest 📦 button —
  version bump (X4 convention: int format, 100=v1.00, patch +1, minor +10; semver x.y accepted and
  converted ×100 — `toContentVersion` in `modCompiler.ts` is format-aware since audit #1), README
  generation, gated on zero error diagnostics, zip via `modDistribution.ts` → `releases/`.
- **No CI/CD, no signing, no auto-update** [VERIFIED absence]. Releases + git pushes are manual (Ken;
  GitHub device-flow integration exists in-app for mod repos). **Rollback:** git (app), snapshots +
  re-deploy (mods). **Known deployment hazard:** deploying with a stale source folder is gated by
  sourceStamp — do not bypass it.

## 17. Security and Privacy

- **Trust boundary:** the API binds 127.0.0.1 and trusts localhost callers WITH the studio token;
  the `PUBLIC_READONLY_GETS` allowlist is deliberately read-only. External agents authenticate per
  request and must bring their own AI keys.
- **Secrets:** `.env*`, `data/` (AI key store), `.studio-api-token`, `config.json` — ALL gitignored
  [VERIFIED `.gitignore`]. The near-miss where `data/` wasn't ignored is fixed and banked ("where does
  this new file land in git" is a mandatory question). Keys never render client-side (boolean status
  only); UI shows a "configured on server" placeholder.
- **Dev-only unsafe surface:** `/api/run_command*` executes arbitrary shell as the user — **verified
  404 in the production bundle** (ROADMAP 2026-07-08); must stay that way. Lua instrumentation rewrites
  deployed files — write-gated on Ken.
- **File-system reach:** the server reads the game install and writes the extensions dir + workspace
  folder as configured — misconfigured paths are the main hazard (path settings live in gitignored
  config.json; agent-side writes to real mod/game dirs require Ken's one-paragraph write-gate, §23).
- **Not addressed [ASSUMPTION]:** no dependency-audit automation; no CSRF hardening beyond the token +
  origin gates (localhost-only posture); threat model assumes a single trusted user machine.

## 18. Performance and Reliability

- **Measured [VERIFIED historical]:** validate reparse cost was ~250ms/call before the multi-slot
  schema-index cache (A1, measured then fixed); e2e suite ~32s serial (2026-07-10); oracle sweep
  seconds-fast (2026-07-11); job-API dogfood showed the app answering in 7ms mid-job (B16).
- **Known bottlenecks:** `server.ts` monolith size (edit/typecheck ergonomics — modularization stage 4
  is audit item #11); every-keystroke localStorage serialization of the workspace + hash cost is the
  SUSPECTED next perf item (audit #6) — **measure before optimizing** [DECISION].
- **Perf-regression trap (banked):** a synchronous in-render `generateMDXML`/`validateModWorkspace`
  during canvas drags is invisible to network counters — assert on engine-call counts/longtasks.
- **Reliability:** watchdog respawns dead dev processes (kill-tested); vite-proxy 503 soft-fails during
  API restarts with client retry for idempotent GETs; CAS + guards protect the workspace; SQLite is
  local single-user. **Race classes to respect:** adoption poll vs human conflict decision (held via
  ref — don't "simplify" it away); e2e worker parallelism (kept at 1 on purpose).

## 19. Known Bugs and Technical Debt (ranked)

1. **B13 batch: e2e GREEN 2026-07-11 (full suite 11/11); Ken's eyeball still pending** on the 4
   EXPERIENCE surfaces (toasts ×2, skeletons, compact badge). Severity: low (machine gates all pass;
   ◐ until his screen). Also new: B17 e2e gate hygiene (test:canvas scope drift + libuv exit-code
   corruption — see §22 and BACKLOG).
2. **Workspace singleton (B2 slice 3 open)** — two different mods can't hold server state
   simultaneously; e2e needs the guard because of it. Files: `server.ts` workspace state, `App.tsx`.
   Proposed: key server state by mod id; acceptance = e2e workspace-guard removed. Severity: medium,
   highest-leverage architectural item.
3. **e2e fixture leak class (#70)** — a failed run can leave the server holding `E2E_Canvas`; guard
   restores on clean runs. Check `GET /api/agent/workspace` after every run. Severity: low-medium.
4. **ROADMAP-tail validation-gap notes (2026-06-29) partially stale** — items #3/#4 since implemented;
   #1 (import-root reporting) and #2 (multi-file validate ergonomics) unverified today. Action: re-test
   before trusting a whole-mod "0 errors" on hand-deployed work. Severity: low (documentation honesty).
5. **AI eval harness not built** (metrics defined only) — "hallucination reduced" remains unmeasured.
   Severity: low while AI stays opt-in-off.
6. **Debt inventory:** dashboard/economy panels etc. belong to the SEPARATE neural-link project —
   don't conflate. The verified 2026-07-28 repository cleanup removed the former root debris and
   legacy direct-game installer.

## 20. Active Work in Progress (the uncommitted set — exact state)

**Task: Audit #5 / B13 QoL batch** (tracker #60, in_progress). Intended outcome: empty-state XML
previews, undoable+announced deletes, discoverable shortcuts, badge clip fix.

| Change | File(s) | Status |
|---|---|---|
| `fetchJson` helper + conversion (audit #4) | `src/lib/apiHelper.ts`, `ModDependencyView.tsx` | Implemented; tsc green; ROADMAP close written (uncommitted) |
| Empty-state skeletons for wares/jobs XML previews | `LibraryConfigurator.tsx` (`compileWaresXML` ~559, `compileJobsXML` ~593) | Implemented; **not eyeballed** (needs an empty library — use a scratch workspace, never Ken's) |
| Delete toast + Ctrl+Z hint, canvas nodes | `Canvas.tsx` `deleteNode` ~553 (+ `toast` import) | Implemented; **not eyeballed** |
| Ware/job delete: checkpoint + toast (replaces `alert()`) | `LibraryConfigurator.tsx` `handleDeleteActiveItem` ~484; `saveCheckpoint` prop threaded from `App.tsx` | Implemented; **not eyeballed**. NOTE: library deletes were NOT undoable before (no checkpoint) — this adds it |
| Keyboard-shortcuts overlay ("?", header button, Esc) | `src/components/ShortcutsOverlay.tsx` (NEW, untracked), `App.tsx` (state, key handler ~743, header button, render) | Implemented; **VERIFIED live 2026-07-11** (open via button + "?", close via Esc, 8 rows, screenshot) |
| Sync badge/conflict-card clip fix (shrink-0, nowrap, compact <xl labels) | `App.tsx` ~1313-1348 | Implemented; tsc green; **not visually verified** (needs a narrow window + a diverged/conflict state — e2e or eyeball) |

**Reconcile finds recorded:** auto-select-on-create already existed (`LibraryConfigurator.tsx:448,469`);
the "NO ACTIVE ASSET SELECTED" panel is a designed empty state — the stale B13 note was partially wrong.

**Remaining to close task #60 (updated 2026-07-11 second session):** ~~e2e~~ ✅ full suite 11/11 rerun
after the batch, guard restore confirmed; ~~ROADMAP/BACKLOG/AAR~~ ✅ written (ROADMAP ◐ entry, B13
in_progress, B17 spec'd, ledgers appended). **Left:** (1) Ken's eyeball on the four rows above
(EXPERIENCE gate — flips the ◐); (2) commit point (Ken). `graphify update .` deliberately skipped —
no code changed this session, docs only.

**Also uncommitted:** ROADMAP.md audit-#4 close entry. **TODO/FIXME comments:** none introduced by this
set [VERIFIED — changes are comment-annotated with B13/audit tags instead].

## 21. Dependencies and External Systems

- **npm packages:** §6 — all local, no SaaS at runtime. If `better-sqlite3` fails to build, you need
  matching Node headers/VS build tools [ASSUMPTION — standard native-module caveat].
- **X4: Foundations install** (required for deploy/in-game verify; read for catdat/schemas). Unavailable →
  authoring/validation still work, deploy targets missing.
- **Extracted XSD schemas + unpacked game corpus** (`<X4_UNPACKED_CORPUS>`) —
  grounding data for validators/lints. Unavailable → schema features degrade.
- **AI providers** (optional, off by default): Gemini/Anthropic/OpenAI/OpenRouter — cost implications
  borne by whoever's key; external agents must bring their own.
- **GitHub** (optional): device-flow OAuth for mod repo sync.
- **Related but SEPARATE projects (do not edit from here):** `x4_ai_influence` mod +
  `x4_neural_link` Python bridge (own ROADMAP, dashboard on :8713); Agent Brain vault
  (`<DEV_ENV>\Agent Brain Vault`); StarForge wiki canon (`F:\StarForge\wiki\`).

## 22. Logging, Diagnostics, and Troubleshooting

Logs: dev-window consoles (vite / tsx API / watchdog), `supervisor.log` (respawn events), browser
console, game `debuglog` (via debug-watcher endpoints), `.tmp_*.log` (historical debris).

| Symptom | Likely cause | Fix |
|---|---|---|
| Every `/api` call 401s | Token not injected (API booted after page load) / new endpoint not in `PUBLIC_READONLY_GETS` | Reload page; add endpoint to allowlist |
| "SyntaxError: Unexpected token '<'" from a fetch | API mid-restart; vite proxy returned HTML | Use `fetchJson` (already surfaces a clean 503 message); retry |
| Page reloads on backend edits | vite watch ignores drifted | Check `vite.config.ts` `watch.ignored` + tsx `--ignore` lists (must include any new runtime-written file) |
| Phantom `TS1002`/truncation errors (agent) | Sandbox stale mirror | Host `npm run typecheck` via job API is truth |
| e2e red on committed code | Fixture/GET-isolation ordering or adoption poll | Read spec comments; verify server workspace restored after runs |
| Sweep endpoint 401 | Allowlist miss | `selftestRegistry.ts` + `PUBLIC_READONLY_GETS` |
| App up but canvas empty after import | (Historical) DOMParser polyfill — fixed | See git history of `xmlParser.ts` |
| Deploy "0 errors" but files look wrong in-game | Import root mismatch (ROADMAP gap #1, unverified) | Validate with `{fromPath}` pointed at the DEPLOYED dir; check drift endpoint |
| Playwright prints "N passed" then crashes: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` win/async.c:76, exit 0xC0000409 | Node-on-Windows libuv teardown bug (Node v24.15.0 + PW 1.61; reproduced 5/5 on 2026-07-11); tests themselves are FINE | Use `npm run test:e2e` / `test:canvas` — the B17 wrapper (scripts/run-e2e.mjs) exits on the parsed verdict. Never gate on a raw `playwright test` exit code. Node-bump probe = Ken-gated |

**Evidence-before-code rule:** reproduce → tag the explanation `[REPRODUCED]` or `[HYPOTHESIS]` —
never dress a hypothesis as a diagnosis (lived lesson: the "lossy compiler" misdiagnosis).

## 23. Operational and Safety Rules (BINDING — from AGENTS.md/CLAUDE.md, condensed)

1. **Follow the Universal AI Task Workflow (v3, 2026-07-12) on every task** — CLASSIFY the lane,
   declare the acceptance contract (incl. a negative-path check) BEFORE implementing, capture a
   BASELINE before mutating, RECONCILE before building (the thing may already exist — three lived
   examples). Full text + X4 adapter: `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` (identical mirrors).
2. **Never run mutating git.** Read-only inspection (status/diff/log/show/blame/branch listing) is
   allowed and expected. Ken commits; your close-entry title is the suggested commit message. End
   every VERIFIED close with "commit point: <title>".
3. **Machine-state ask** before validation-heavy/e2e/frontend-hot-reload work: "Are you in the app?
   Game running? Machine quiet?" Ken lives on this machine; his canvas is HIS.
4. **Write gates:** before ANY write to the real mod, game dirs, or standing config — one paragraph to
   Ken (what/risk/undo), wait for explicit go. Never validate against the real mod when a scratch
   article works.
5. **Never claim done without cited validation** (§15 menu). Optimistic mid-transcript claims are not
   outcomes. Close states are VERIFIED / PARTIAL / FAILED / BLOCKED / REVERTED (legacy ✅=VERIFIED,
   ◐=PARTIAL); honesty is enforced.
6. **Update records same-task**: ROADMAP close (Forge work → this repo's ROADMAP), BACKLOG state,
   SESSION-HANDOFF at commit points, AAR with worst-implementation pick; canon edits when a rule is
   verbally reversed (a decree without a doc edit is a landmine).
7. **Sandbox mirrors of this repo lie** — host tools + job API are truth (multiple incidents).
8. **e2e runs on its own EPHEMERAL stack (B31s2) — don't parallelize it, and NEVER re-point specs at the
   live dev server (:3000/:3001).** (The old `workspace-guard` + route-mock isolation is deleted; the
   ephemeral stack in `playwright.config.ts` is the isolation now.) **Don't silently resolve sync conflicts.**
9. **Secrets:** anything new that persists → decide its git fate FIRST (`data/` lesson).
10. **Operator protocol:** brief Ken at session start (project one-liner, eyeball queue, commit
    question); flag degradation ("2+ errors clustering — commit point now"); flag his context-thrash
    plainly; tag failure explanations [REPRODUCED]/[HYPOTHESIS].

## 24. Open Questions and Unresolved Decisions

1. ~~Does the B13 batch pass e2e?~~ **RESOLVED 2026-07-11: YES — full suite 11/11** (canvas 4/4 +
   project-validate 6/6 + xml-patch-merge 1/1), workspace-guard restore confirmed.
2. **Do the four unverified B13 surfaces FEEL right?** (EXPERIENCE gate — toast wording, skeleton
   comments, compact badge). Only Ken's screen resolves this.
3. **ROADMAP gap notes #1/#2 (import root; multi-file validate ergonomics)** — still real? ~60% the
   import-root reporting gap still exists [ASSUMPTION]. Resolve: 10-min probe with `{fromPath}` against
   the deployed mod.
4. **When does B8 (installer/release track) unpark?** Ken's call alone. Development continues safely
   without it.
5. **B2 slice 3 scope** — per-mod state keying design is sketched (ADR-F1 rider) but unbuilt; does B12
   multi-workspace ride on it or wait? Development safe either way; decide at pickup.
6. **Node engine floor** — unpinned. Low risk; pin in package.json `engines` when convenient.

## 25. Recommended Next Steps

**Immediate verification (safe, autonomous):** the §15 checklist. Task #60 status as of 2026-07-11
second session: e2e ✅ 11/11, records ✅ closed (ROADMAP ◐ entry / BACKLOG B13+B17 / AAR ledgers).
**Left: Ken's eyeball on the 4 surfaces (flips ◐→✅) + his commit.**

**Critical fixes:** none outstanding [VERIFIED — all gates green as of 2026-07-11].

**Short-term (in priority order, from the approved audit roadmap + BACKLOG):**
1. ~~Audit #6 — perf~~ ✅ CLOSED 2026-07-11 (measured: pure-canvas fine, import-sized indicted;
   localStorage write debounced + quota-guarded, poll hash memoized; latent over-quota sync-killer
   bug fixed — see ROADMAP).
2. B2 slice 3 — per-mod server state (removes the singleton + the e2e guard). Files: `server.ts`
   workspace state region, `App.tsx`, guard specs. Medium risk — design against ADR-F1, brief Ken.
3. ~~Audit #7 — guided "Ship a Mod" journey rail~~ ABSORBED into **B19** (Vision v2 track, ADR-F2
   2026-07-11 — see BACKLOG P3.5 + `docs/plans/2026-07-11-vision-v2-ue5-editor.md`).
4. Audit #8 — vitest unit layer for `src/lib` engines (they're pure; cheap wins).

**Medium-term:** B10 curated action semantics (frequency-ranked); audit #9 accessibility; audit #11
server.ts modularization stage 4; B11 aiscript visual editing (requires namespacing reconciliation
design); audit #12.

**Optional/parked:** B8 installer (Ken-gated); B14 leftovers; root-debris cleanup (Ken-gated).

## 26. First Task for the Incoming Agent

1. Read `BACKLOG.md` + `SESSION-HANDOFF.md` + this file. Give Ken the session-start brief (§23.10).
2. Run the §15 verification checklist (steps 1-4 are safe unattended; step 5 e2e needs the
   machine-state ask).
3. Compare observations against §3/§20. **Report any mismatch to Ken before modifying code.**
4. If all green and Ken confirms: finish task #60's close (it's 90% done — e2e + eyeball + records),
   deliver the commit point, THEN pick from §25.
5. Do not begin new implementation before the above.

## 27. Evidence Index

- **State:** `git log -3`, `git status --porcelain` (read-only, via job API, 2026-07-11) — §3.
- **Gates observed 2026-07-11:** `npx tsc --noEmit` exit 0; `node scripts/oracle-sweep.mjs` exit 0
  (all PASS); ShortcutsOverlay browser verification (screenshot in session log).
- **Key files/symbols:** `server.ts` — `applyWorkspaceMutation` (~2981, CAS), `PUBLIC_READONLY_GETS`,
  `callMultiProviderAI`, `/api/run_command/job` (~7285), `/api/agent/package/release`;
  `src/App.tsx` — sync effect (~758), keydown handler (~743), conflict card (~1313);
  `src/lib/workspaceIdentity.ts` (hash), `compileFidelity.ts` (sourceStamp), `modDistribution.ts`
  (zip/gate), `modCompiler.ts` (`toContentVersion`), `apiHelper.ts` (fetchJson, AI config);
  `src/server/selftestRegistry.ts` (oracle registry); `tests/e2e/workspace-guard.ts`.
- **Config:** `package.json` (scripts/deps), `vite.config.ts` (ports/proxy/token), `playwright.config.ts`
  (serial workers rationale), `.env.example`, `config.example.json`, `.gitignore` (secrets section).
- **Docs:** `README.md` (product), `AGENTS.md`/`CLAUDE.md` (binding rules), `BACKLOG.md` (open work),
  `ROADMAP.md` (history; recent closes under "Current State" sections), `SESSION-HANDOFF.md`.
- **Commits:** `37209c8` (AI key store), `d92194e` (CAS conflict), `8243a93` (packaging).
- **Graph:** `graphify-out/graph.json`; god nodes ModWorkspace(67)/MDNode(38)/generateMDXML(33).

## 28. Compact Machine-Readable Handoff

```yaml
project: X4 Forge (x4_forge)
repo_path: <WORKSPACE_ROOT>
branch: main
commit: 37209c8cb6519fc199b08214f15d43d0992dbbf7
status: active development; release track parked by owner; all gates green 2026-07-11
technologies: [TypeScript 5.8, React 19, Vite 6, Express 4, tsx, better-sqlite3, xmldom, Playwright 1.61, Tailwind 4]
entry_points: {ui: src/main.tsx -> src/App.tsx, api: server.ts, prod: dist/server.cjs}
build: npm run build
run: {dev: restart-studio.bat, prod: START-X4FORGE.cmd}
tests:
  typecheck: npm run typecheck            # exit 0 observed 2026-07-11
  oracles: node scripts/oracle-sweep.mjs  # exit 0, 35/35 observed 2026-07-11
  e2e: npm run test:e2e                   # THE gate (B17 wrapper): full 11-test suite, verdict-parsed exit code; 11/11 + exit 0 observed 2026-07-11
  e2e_subset: npm run test:canvas         # canvas specs only (4 tests), same wrapper
important_dirs: [src/lib, src/components, src/server, tests/e2e, scripts]
active_work:
  task: "Audit #5 / B13 QoL batch (tracker #60)"
  uncommitted: [ROADMAP.md, src/App.tsx, src/components/Canvas.tsx, src/components/LibraryConfigurator.tsx, src/components/ModDependencyView.tsx, src/lib/apiHelper.ts, src/components/ShortcutsOverlay.tsx(untracked)]
  remaining: [owner eyeball on 4 surfaces (e2e green + records closed 2026-07-11), commit point]
known_blockers: []
critical_invariants:
  - agents never run mutating git; owner commits
  - no done-claim without cited validation; sandbox repo mirrors lie — host tools are truth
  - e2e swaps the live workspace: machine-state ask first; never parallelize; guard must restore
  - writes to real mod/game/config require an explicit owner go
  - run_command must remain absent from production builds
  - deterministic validators, never AI, decide legality
next_recommended_task: finish task #60 close (e2e + eyeball + records + commit point), then audit #6 (measure-first perf)
open_questions: [B13 experience OK on owner screen?, ROADMAP gap notes 1-2 still real?, B8 unpark timing?, B2-slice-3 scope]
handoff_confidence: 0.9
```

---

**Contradiction check (performed before finalizing):** `.env.example` localStorage claim — found and
FIXED this session. ROADMAP-tail 2026-06-29 gap notes vs implemented validators — flagged as
historical (§3, §19.4). Old `HANDOFF.md` session-notes format — superseded by this document (history
in git). BACKLOG B13 entry still says `spec'd` for items now implemented-but-unverified — deliberately
left until the task's proper close (◐ honesty; do not pre-claim). playwright "workers 1" vs any
parallelization idea — the serial choice is deliberate (ADR digest #7). No version mismatches found
between package.json and lockfile-driven behavior [not deep-audited — lockfile 16k+ files].

**Overall project health: GREEN** — all observable gates pass; architecture debt is known, scoped,
and tracked; records system is current. **Handoff completeness: ~92%** (gaps: StarForge ADR ledger
unreadable from this session; ROADMAP digested not exhaustively re-verified; neural-link side
deliberately out of scope). **Confidence: 92%.** **Most serious remaining uncertainty (updated
2026-07-11 second session):** ~~e2e~~ resolved — full suite 11/11 post-B13; what remains is the
EXPERIENCE gate: 4 surfaces await Ken's eyeball before B13 flips ✅. **Exact first action for the
incoming agent:** read `BACKLOG.md` + `SESSION-HANDOFF.md`, give Ken the session-start brief, then run
§15's checklist steps 1-4 and report mismatches.
