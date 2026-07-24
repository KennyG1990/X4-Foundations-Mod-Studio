# B41 VS Code extension PoC — validation evidence (2026-07-15)

Branch `claude/x4-forge-vscode-poc-806ef5` @ base 8050e03 + copied live delta (33 files,
MD5-verified 0 mismatches against the main checkout's dirty tree) + B41 changes.
Main checkout at F:\DEV_ENV\X4_Forge: **never written** this session.

## Product-side fixes required by this spike (both latent packaged-build defects)

1. **server.ts prod token injection** — `express.static(distPath)` served `dist/index.html`
   for `/` BEFORE the injecting catch-all → page never got `__STUDIO_API_TOKEN__` → every
   API call 401s in any packaged/production serve. [REPRODUCED: GET / on staged sidecar
   contained no token pre-fix; contains it post-fix.] Fix: `{ index: false }` (one line).
   Dev mode untouched (its branch injects via transformIndexHtml).
2. **src/lib/db.ts lazy driver load** — `createRequire(import.meta.url)` compiles to
   `createRequire(undefined)` in the esbuild CJS bundle → optional better-sqlite3 driver
   NEVER loaded from dist/server.cjs. [REPRODUCED: db-selftest on staged sidecar returned
   `available:false, reason:"The argument 'filename' must be a file URL object…Received
   undefined"`; returns `available:true` post-fix.] Fix: prefer `__filename` when defined.

## Gates (worktree, host-native)

| Gate | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` (baseline, copied tree pre-B41) | exit 0 | copied B34–B37 delta is type-clean |
| `npm run lint` | exit 0 | includes server.ts token fix |
| `npm run precommit:check` (typecheck+tripwires+mirror gate) | exit 0 | post-fix tree |
| `node scripts/oracle-sweep.mjs` vs staged **prod sidecar** :3277 | **78/80** | reds: `reference-selftest`, `selftest` (7/10) — [REPRODUCED-by-mechanism] both need the schema index + reference sets harvested from a CONFIGURED game install (`getSchemaIndex()`/`getReferenceSets()`, server.ts ~6263; sidecar boot log shows `XSD schema library unavailable: ENOENT …md.xsd`). Same code swept 80/80 on the configured live server (B37 close, SESSION-HANDOFF). Environment-dependent, not regression. db-selftest RED pre-fix → GREEN post-fix. |
| `npm run test:e2e` (ephemeral stack 3100/3101) | **PASS 19/19 (45.1s)** | evidence/e2e-full-run2.log. Runs 1–2 failed (13 then 19 red) from TWO worktree-environment causes, both fixed: (a) worktree lacked the gitignored runtime env — `config.json` + `md.xsd`/`common.xsd` copied read-only from main; (b) **localhost family race** [REPRODUCED]: `ECONNREFUSED ::1:3100` on every runner API call while Chromium fell back to IPv4 — vite binds whichever family `localhost` resolves to at boot, Playwright's request context pins ::1. Fix: 127.0.0.1 everywhere in playwright.config.ts + tests/e2e/ephemeral.ts. Red→green flip on the same code is the reproduction. |
| `npm run build` | exit 0 (×3 runs) | vite bundle + dist/server.cjs |
| `POST /api/agent/project/validate` on sidecar | **ok:true, 0 errors** | compiled 5-file set of active workspace; only info-level kind notes |
| `graphify update .` | exit 0 | graph.json/html + report refreshed |
| `npm run precommit:check` (final, post-all-edits) | exit 0 | |

## VSIX (final artifact)

- `vscode-extension/x4-forge-studio-0.0.1.vsix` — **2092 files, 16.77 MB**.
- Build chain: `npm run build` (repo) → `stage-app` (fresh app/, pruned runtime deps,
  72 vendor sourcemaps stripped, secrets assertions) → `build-ext` (fresh out/, tsc + esbuild)
  → `vsce package`. Staged app boot-proven AS PACKAGED: schema 200 · token injected on `/` ·
  db-selftest `available:true` (better-sqlite3 loads via BOTH the static and the fixed lazy path).
- Contents inspected: required artifacts present (out/extension.js, app/dist/server.cjs,
  app/dist/index.html, better_sqlite3.node); **zero** .map / .env / tokens / config.json /
  data/ / repo source / evidence files. Controller bundle: 0 machine-path literals,
  0 key-pattern matches.
- ⚠ Known, pre-existing: `app/dist/server.cjs` carries the product's baked-in DEFAULT
  paths (13 drive-path literals, e.g. `G:\SteamLibrary\...`, `C:\Users\ken\Documents\X4ForgeMods`) —
  server.ts defaults present in ANY Forge build, fine for Ken-machine testing, must be
  genericized before tester distribution (logged in BACKLOG residuals).

## Failure paths proven

- Port conflict: second sidecar forced onto occupied 3277 → EADDRINUSE, exit 1 (the
  extension's readiness loop reports "crashed during startup" + logs). In normal operation
  the port is OS-assigned free.
- Attach-probe truth table (probe-test.mjs): real Forge → true; JSON impostor → false;
  HTML impostor → false; dead port → false. Attach mode cannot false-green, and
  attach/sidecar mode is surfaced in the status bar + logs.
- Bad node path → checkNodeExecutable fails → actionable error naming x4forge.nodePath
  (code path; IDE-visible confirmation is part of the Ken-gated install test).

## IN-IDE INSTALL TESTS (driven live 2026-07-15, both IDEs)

Added `x4forge.autoOpen` (opt-in, trusted-workspace only) + `onStartupFinished` activation so
the studio opens without a keyboard command (my desktop-automation grants IDEs as click-only).

### Desktop VS Code 1.120.0 — **VERIFIED**
- Install: `code --install-extension x4-forge-studio-0.0.1.vsix` → "successfully installed";
  `code --list-extensions` shows `x4forge-local.x4-forge-studio`.
- Launch: opened a scratch workspace with `x4forge.autoOpen:true` → extension activated,
  spawned a managed sidecar (status bar: **"X4 Forge: sidecar :62647"**, dynamic loopback
  port), and rendered the **full studio in the webview** (header, readiness ladder, Beginner
  rail, node canvas, radar minimap, first-run wizard). First-run modal dismissed WITHOUT
  "Set up automatically" (would rewrite the real config — write-gate respected).
- Interactive (click-only): selected the Spawn Ship node → real PROPERTIES INSPECTOR populated
  ($MyHeavyEscort, ship macro, faction). Expert-mode full toolbar present (MD/AIScripts/Wares/
  HUD-Lua/XML-Patch/Galaxy/Contracts/Languages/SYNC MOD/AGENT API).
- Type-heavy construction (driven against the SAME sidecar :62647 via the browser pane, since
  the IDE is keyboard-restricted): switched to the Argon Bounty template (undo count 1),
  renamed the mod in Mod Meta → server confirmed `name:"Extension_PoC_Bounty",
  author:"ForgeExtensionTester", 4 nodes/3 links`. Full pipeline: **compile success (5 files) →
  project/validate ok:true (0 structural/schema/crossfile/aiscript errors) → package success**.
  Oracle sweep vs :62647 = **78/80** (same 2 reference reds = no md.xsd in the staged app).
- **Two-shells-one-core proof:** the VS Code webview LIVE-ADOPTED the mod built in the browser
  pane — canvas switched to the Bounty mission, selector showed "Extension_PoC_Bou…".

### Antigravity IDE (VS Code fork) — **VERIFIED**
- Install: `antigravity-ide.cmd --install-extension …` → "successfully installed" (one benign
  Antigravity-internal analytics warning); `--list-extensions` shows the extension.
- **Workspace Trust proven:** launching the scratch folder showed the trust gate; the extension
  stayed disabled (manifest `untrustedWorkspaces.supported:false`) until "Yes, I trust" —
  then activated, spawned its OWN managed sidecar (**"X4 Forge: sidecar :52030"**), and rendered
  the full studio (schema path = `.antigravity-ide\extensions\x4forge-local.x4-forge-studio-0.0.1\app`
  → running the Antigravity-installed copy, not VS Code's).
- Representative workflow vs :52030: workspace write (renamed "Antigravity_PoC_Mod",
  author "AntigravityTester") → **compile 5 files → validate ok:true (0 errors) → package
  success**; the Antigravity webview reflected it live (selector + rail "You are working on
  Antigravity_PoC_Mod").
- Restart/relaunch: the scratch window was a fresh `-n` launch (separate from a pre-existing
  Antigravity window) — clean cold start, trust gate, activate, render.

Both IDEs ran INDEPENDENT installs and INDEPENDENT sidecars concurrently (:62647 and :52030),
neither touching the standalone :3000 stack.

## B42 — Agent key manager (validated live in Antigravity, 2026-07-15)

Named, scoped, EXPIRING agent keys so external agents get a personal credential instead of
the god-mode session token. Engine `src/lib/agentKeys.ts` (sha256-at-rest, injected clock),
auth chokepoint extended (session token = unchanged fast path; `x4fk_` keys → verify +
deny-by-default scope), endpoints `GET/POST /api/agent/keys` + `/revoke` (session-token-only),
AgentBridge **AGENT KEYS** tab, extension command `x4forge.createAgentKey`.

- Oracle `agent-keys-selftest`: **18/18** (create/verify, hash-not-plaintext, wrong/foreign
  token → unknown, **1h key expired at +2h / alive at +59m**, never-ttl survives a year,
  revoke, audit touch, prune, full scope matrix, persistence round-trip w/ no plaintext in file).
- Gates on branch: tsc 0 · lint 0 · precommit 0 · **e2e 19/19** (auth path changed — session
  token unaffected) · build 0 · sweep **79/81** vs staged sidecar (agent-keys oracle now swept;
  same 2 env-reference reds).
- **Terminal security matrix** (staged prod sidecar :3279): create read+write keys →
  read key GET 200 / POST 403 · write key compile 200 / deploy **403** / key-mint **403** ·
  revoked **401** · garbage **401** · audit useCount/lastUsed updated · all correct.
- **LIVE IN ANTIGRAVITY (VSIX 0.0.2, sidecar :62577):** reloaded window → 0.0.2 activated
  (schema path = `x4-forge-studio-0.0.2` install). AGENT KEYS tab rendered; created
  "codex-antigravity" via the UI with the **lifetime dropdown (1h/24h/7d/30d/never — Ken's
  requirement)** set to 24h; one-time reveal shown; issued-keys table listed it. An exact
  read-scope key made via the same sidecar: **used from a plain terminal → GET 200, compile
  → 403 (scope enforced)**; audit row showed "last used … · 1×"; **revoked in the UI → the
  same token from the terminal → 401 "agent key revoked"** and the row greyed to REVOKED.

## Parity feature passes (extension, Antigravity sidecar :62577)

1. **Engine pass:** 19/19 major-surface engines answer 200 (schema, workspace, md-audit,
   diagnostics, aiscript-lint, scriptproperties, ui-layout, ui-widget, patch-audit,
   mod-dependency, external-api, simulate, templates, patterns, node-toolbox, readiness,
   debug-watcher, agent-keys, selftest-index); runtime oracle count 81.
2. **Surface pass (visual, in the IDE webview):** Expert mode → Node Toolbox + canvas +
   generated-MD code editor; domain switch → Wares/Libraries configurator (mod config, wares
   hierarchy, generated wares.xml, conflict diagnostics); AgentBridge all 4 tabs incl. AGENT KEYS.
3. **Workflow pass:** template → inspector edit → compile (5 files) → validate ok:true →
   package (from the earlier VS Code + Antigravity runs, same bundle).

## Extension icon

`vscode-extension/icon.png` (256×256, generated by `scripts/make-icon.ps1` — deterministic,
no external assets): node-graph X of four cyan nodes wired to an amber forge-spark hub on the
studio's dark plate in a teal rounded frame. Wired via manifest `icon` field; version → 0.0.2;
present in the VSIX (2093 files, the +1 vs 0.0.1).

## B43 — Gold-standard sidecar debugging (validated live in BOTH IDEs, 2026-07-15)

`x4forge.debug` (`off`/`inspect`/`inspect-brk`) launches the managed sidecar under Node
`--inspect` and auto-attaches the IDE's debugger via `vscode.debug.startDebugging`. Both IDEs
bundle `ms-vscode.js-debug` (verified in their `resources/app/extensions`), so the same attach
config works in each. Source-level TS breakpoints via `x4forge.forgeRoot` (repo build keeps
`dist/server.cjs.map`); committed `vscode-extension/.vscode/launch.json` adds an Extension-Host
config for debugging the controller. Version → 0.0.3.

- **Mechanism (headless):** staged sidecar launched with `--inspect=127.0.0.1:9345` → server
  still boots (schema 200), CDP `/json/version` = `node.js/v24.15.0`, `/json/list` shows a
  debuggable `node` target, stderr banner "Debugger listening on ws://127.0.0.1:9345/…".
- **Live in ANTIGRAVITY (0.0.3, debug=inspect, forgeRoot=repo):** reload → Run & Debug view
  opened, **debug toolbar active** (pause/step/restart/disconnect), **Call Stack: "Remote
  Process [0] + X4 Forge Sidecar — RUNNING"**, Debug Console streaming the attached process.
- **Live in VS CODE (same settings):** **debug toolbar active**, "X4 Forge" output shows
  "Debugger listening on ws://…", DEBUG CONSOLE tab, status bar in debug state. Attached and
  controllable — gold-standard parity with Antigravity.
- **Regression:** `x4forge.debug` defaults to `off` → no `--inspect` arg, no attach, spawn path
  byte-identical to before; B43 touched only `vscode-extension/` (no product source), so repo
  gates (tsc/e2e/sweep, green at B42 close) are unaffected; precommit re-run green.
- VSIX 0.0.3 (2094 files): inspected — **launch.json and *.map do NOT ship** (dev-only), no
  secrets. Both IDEs on 0.0.3.

## Integrity at B42 close

- Standalone :3000: not running at close (user's dev-terminal stack — unrelated; B42 ran only
  on extension sidecars). Never touched by this work.
- Main checkout: 0 dirty (Ken committed the B34–B37 delta as ff38642 earlier); B42 lives on
  the worktree branch only. No git mutation performed by this session.

## B49 — Marketplace-prep blockers (agent half DONE 2026-07-16; publish awaits Ken's accounts)

1. **Machine-path genericize:** runtime defaults were `G:\SteamLibrary\...` + `<game>\extensions\
   x4_ai_influence\md` (xsdParser.ts) — now `''` (unconfigured → health card flags → B18 wizard)
   and `<cwd>\data\harvested-schemas`. Fixtures/placeholders scrubbed of usernames+drives.
   **Shipped-bundle scan:** client 0 traces; VSIX server.cjs: Moshi 0 · Users\ken 0 · DEV_ENV 0.
   Remaining assessed-OK: generic VDF parser fixtures ("SteamLibrary" is what it parses) +
   `x4_ai_influence` as public provenance/health-card copy (a mod name, not a path).
2. **Portability crash killed:** liveBridge better-sqlite3 static import → lazy `createRequire`
   with `__filename` fallback (same pattern as db.ts); driver-absent → "no events", never a boot
   crash.
3. **Stranger-machine simulation** (bare staged app, no config, empty state): boots 200,
   `resolved gamePath: ''`, schemaDir = own harvest dir, health verdict honestly `blocked`
   (game_path fail → wizard is the designed path), 0 Steam refs in boot logs.
4. Gates: tsc 0 · build 0 · precommit 0 · **e2e 19/19** · sweep on the BARE install **78/81**
   (reference/selftest = known env reds; `expression-suggest 0/0` newly red on bare installs
   because the old machine default was silently loading Ken's real schema — HONEST regression
   of a false green; configured instances remain green, e.g. 79/81 on :3282/:3283).
5. VSIX **0.0.4** (2093 files) packaged + reinstalled in BOTH IDEs.
Still Ken's: MS publisher account, Open VSX namespace, license choice, beta-vs-prerelease call;
then finalize package.json publisher/repo/keywords and Ken-authorized `vsce publish` + `ovsx publish`.

## Close integrity checks

- Live :3000 at close: UP, workspace `Player_Elite_Escort`, hash `dac6d106bd45f2bd` —
  byte-identical to the hash recorded in SESSION-HANDOFF before this session (unaffected by
  the two IDE sidecars on :62647/:52030, which each ran their own X4_STATE_DIR).
- Main checkout: Ken committed his own pending B34–B37 delta mid-session (new commit
  `ff38642 feat(app): Introduce experience modes, readiness ladder, and node toolbox` on
  `main`; reflog HEAD@{0}). This session never wrote main; the commit is Ken's own action and
  matches the content this fork was built on. The B41 fork remains an independent worktree
  branch (`claude/x4-forge-vscode-poc-806ef5`), fully intact.

## Staged sidecar (the exact artifact the extension spawns) — boot + contract proofs, :3277

- Spawn: `node dist\server.cjs`, cwd=`vscode-extension/app`, env `NODE_ENV=production`,
  `PORT=3277`, `STUDIO_API_TOKEN=<session>`, `X4_STATE_DIR=<scratch>`. Booted clean;
  better-sqlite3 static import (liveBridge) survived = native binding loads under system node v24.15.0.
- `GET /api/agent/schema` (public): 200. `GET /api/agent/workspace` no auth: **401**;
  with Bearer: 200 (default workspace — `Player_Elite_Escort` is the compiled-in
  DEFAULT_WORKSPACE sample, server.ts ~1450, not leaked user state).
- `GET /` : 200 with `__STUDIO_API_TOKEN__` injected (post-fix); hashed asset JS served
  with correct MIME.
- `run_command` in prod: NOT registered — an authed GET returns the SPA catch-all HTML
  (text/html), no shell execution. (First probe misread the 200 as a leak; content-type
  check disproved it.)
- State isolation: `active.json` written ONLY in the scratch X4_STATE_DIR; app/ received a
  runtime `data/` dir (cwd-relative writes) → staging is re-run fresh before packaging and
  `.vscodeignore` excludes it; noted as a known runtime-hygiene caveat for installed use.

## Representative workflow (real rendered UI, Claude Browser on the sidecar origin)

1. **Open workspace** — full studio rendered in Beginner mode (B37 default for fresh
   state): workspace select, readiness ladder (Graph=Valid, Package=Valid, Deploy=Not
   deployed), 3-node canvas (Mission Cue / Event: Game Started / Spawn Ship). DOM-verified.
2. **Edit canvas item** — selected Spawn Ship; Beginner→Customize exposed the real
   PropertiesInspector; set Variable Name `$MyHeavyEscortPoC`. Server state confirmed:
   `workspaceHash` changed → `3334da56a1ab11ac`, node property = `$MyHeavyEscortPoC`.
3. **Deterministic validation** — Beginner→Validate: "Graph valid / Project valid — zero
   blocking errors or warnings" (DOM). Authoritative: compile → `POST /api/agent/project/validate`
   → `ok:true`, 0 structural/schema/crossfile errors.
4. **Compile/preview** — `POST /api/agent/compile`: success, modId `player_elite_escort`,
   5 files (content.xml, README.md, md/player_elite_escort.xml, ui.xml, ui/player_elite_escort.lua).
5. **Package artifact (scratch)** — `POST /api/agent/package` file set written to
   scratchpad `package-artifact/player_elite_escort/` + zip (3,294 bytes). No game-dir writes.
- Page console: **zero errors**.
- ⚠ Screenshot evidence: the browser-pane screenshot channel timed out 2/2 (same
  pre-existing capture-channel failure banked at B37's close — four prior timeouts across
  two sessions; DOM reads responsive throughout). Rendered-UI proof is DOM-based this
  session; the IDE-webview visual pass is part of the Ken-gated install test anyway.

## Live-stack observation (not caused by this work)

The standalone dev stack (:3000/:3001) FLAPPED during this session: up at session start
(authed workspace read OK), refused ~19:2x, up again minutes later, refused again.
This worktree session never wrote the main tree and binds only :3277/:3100/:3101.
Same symptom class as the 2026-07-13 mid-session outage in CODEX-ONBOARDING §6.
Flagged to Ken; workspace integrity re-checked at close (see close notes).
