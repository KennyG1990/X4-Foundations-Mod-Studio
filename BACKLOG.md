# X4 Forge — BACKLOG (open work ONLY)

> Workflow v2 records policy: this file stays SMALL — spec'd / in-progress items with states and owners.
> Sessions START here. Closing an item MOVES it into ROADMAP.md as a dated, verification-cited entry.
> States: `spec'd` · `in_progress` · `blocked` · `parked`. Owner is whoever picks it up (agent or Ken).

## P0 — Active

### B72 · Lua GetComponentData semantics lint — close the blind spot that let a 12k-error bug pass validation `spec'd`
Motivated 2026-07-21: x4_ai_influence's aic_uix.lua fed the `"sector"` property (returns the sector NAME
string — vanilla menu_map.lua:9302 pairs "sectorid"+"sector" as id+name) into ConvertStringToLuaID →
component 0 → ~255 engine errors per tick, 12,765 in one session. Forge validation was green: the XSD/
scriptproperties corpus covers MD expressions, not Lua C-API property semantics. House-pattern slice:
(1) harvest the vanilla ui/ lua corpus (vanilla-ui-harvest infra exists) into a GetComponentData property
table — name → return kind (string/id/component/table), grounded per-property on observed vanilla usage;
(2) lint mod lua for misuse patterns: id-conversion applied to name-returning properties, GetComponentData
on GetContained* enumeration results without an IsValidComponent guard, cdata fed back without conversion;
(3) selftest oracle: the aic_uix.lua pre-fix pattern must flag, the post-fix version must pass, vanilla
menu_map.lua must produce zero false positives. Surface in project/validate beside scriptProperties.

### B71 · Graph-lint FALSE POSITIVE: "ILLEGAL INSTANTIATE / NO EVENT CONDITION" on cues whose events sit inside <check_any> `spec'd`
Found 2026-07-21 during x4_ai_influence Phase-0 warning classification. Studio canvas diagnostics flag
`Speak_menu` (ai_influence_conversation.xml:68) and `Sync_on_load` (ai_influence_worldsync.xml:83) as
ILLEGAL INSTANTIATE + NO EVENT CONDITION, but both cues have valid event conditions (`event_game_started`/
`event_game_loaded`, `event_conversation_next_section`/`..returned..`) nested inside `<check_any>` — legal
MD the game loads fine, and the agent-API `project/validate` correctly does NOT flag them. The graph
model's event-condition detector only looks at direct children of `<conditions>`. Fix: recurse into
`check_any`/`check_all` wrappers when deciding whether an instantiate cue has an event condition.
Acceptance: import x4_ai_influence → those two diagnostics disappear; a truly conditionless
instantiate cue still flags.

### B70 · Game-dir agent litter — ATTRIBUTED 2026-07-20: the SEPARATE Forge Agent Harness extension, NOT this app
Ken found `PLAN.md` / `SCRATCHPAD.md` / `todos.json` / `evidence_ledger.json` (session
`forge-1783998383822-6g6h7kbw`, 2026-07-13) plus a full `.forge/` state tree (activity 07-09→07-16)
INSIDE `G:\...\X4 Foundations\extensions\`. **Attribution (evidence-based):** grep of THIS codebase =
zero writers of those artifact names; grep of `kennyg.forge-agent-1.0.0` (the standalone Forge Agent
Harness IDE extension, installed in Antigravity + VS Code) hits `out/harness/loop.js` /
`backgroundRunner.js` / `extension.js` — the harness writes its governance artifacts into whatever
IDE workspace folder is open, and on 07-13 that was the live game extensions dir. Harmless to X4
(it only scans content.xml subdirs). **The workspace-root guard/redirect fix belongs in the
kennyg.forge-agent PROJECT, not this repo** — carry it there (refuse or redirect artifacts when the
workspace root is a game dir). **X4 Forge's own bounded slice (this repo, optional):** walkaround/
health-card warning when known harness-litter filenames are detected in a configured game extensions
dir ("agent artifacts in your game folder — clean up"). Existing litter cleanup = Ken-gated
(game-dir write gate), pending his move-vs-delete word.

### B69 · Inspector raw-XML box → real code editor — `spec'd` (low-pri, from the B68 dogfood thread)
The PropertiesInspector "RAW CUE XML" field is a plain `<textarea rows={6}>` (`PropertiesInspector.tsx:270`) — no
syntax highlighting, no X4 schema IntelliSense, no line numbers — while the main editor is CodeMirror with all of
that. Raw XML (the case that needs a real editor most) gets the weakest surface. **Fix:** swap that textarea for the
existing `CodeMirrorField` component (reuse, no new infra) for the rawXml case. Headless-buildable (tsc+vite+e2e),
EYEBALL-gated (Ken's screen) to close. Bigger alt (deferred): edit raw nodes in the main editor via two-way sync
(B57s5 territory — riskier). No functional impact; pure editing-UX quality.

### B65 · Cold-start onboarding — B65-1 + 1b ✅ VERIFIED LIVE 2026-07-19 → ROADMAP; follow-ons B65-2..5 deferred
**B65-1 (self-rescuing schema row + teach panel) + B65-1b (full 40-XSD tree-preserving harvest) SHIPPED + VERIFIED LIVE**
(amber→Extract→green, 402 events / 40 domains, e2e 19/19). Visual validation CAUGHT + fixed a shim regression (packed
md/md.xsd shim's `../../../` include overshoots the harvest tree → 382 events; fixed by skipping shim duplicates so
md→real libraries/md.xsd → 402). Files: gameDetectRoutes.ts, DirectorySettingsModal.tsx. B66 own-unpacker REJECTED.
**DEFERRED follow-ons:** B65-2 wizard failure-branch parity (canHarvestSchemas=false + error phase get the teach panel,
not a dead-end; FirstRunWizard.tsx) · B65-3 re-entry gap (App.tsx:442 auto-open + persistent "finish setup" banner) ·
B65-4 raw-error→settings deep-link (server.ts:212 / health card) · B65-5 shared `<SchemaRecovery>` component (DRY once
wizard + modal share the panel). Plan: `docs/plans/2026-07-19-onboarding-schema-coldstart.md`.
Real Discord user hit `md.xsd / common.xsd not found at this path` and couldn't recover. **Planned TWICE**
(two independent agents, same grounded brief) + reconciled against the live install. Full plan:
`docs/plans/2026-07-19-onboarding-schema-coldstart.md`. **Convergence:** both passes independently agreed on
root cause + first unit + validation. **Reality-check catch:** both recommended Egosoft's first-party
`XRCatTool.exe` in the game root — FALSIFIED (the real 9.00 install has only .cat/.dat + X4.exe; NO first-party
unpacker). Corrected → community unpacker (Ken used the X4 Unpacker Suite, `F:\Downskies\x4unpackersuiteV1`).
- **Root cause:** every schema-setup failure branch (canHarvestSchemas=false, harvest 422, not-found, dismissed
  wizard, raw error) funnels into ONE inert surface — the DirectorySettingsModal schema row (:244), which only
  DIAGNOSES, never TREATS. Harvest capability exists but only the wizard calls it; the reliable unpack-and-point
  method (discoverXsd, works) is surfaced nowhere but a tooltip.
- **B65-1 (FIRST unit):** make the DirectorySettingsModal schema row SELF-RESCUING — add an in-place "Extract
  schemas from my game install" button (reuses POST /api/agent/setup/harvest-schemas) + an inline unpack teach
  panel (on 422 / no game path) + honest states. ONE file (DirectorySettingsModal.tsx), no backend change, additive.
- **Deferred follow-ons:** B65-2 wizard failure-branch parity · B65-3 re-entry gap (App.tsx:442 + persistent "finish
  setup" banner) · B65-4 raw-error→settings deep-link (server.ts:212) · B65-5 shared `<SchemaRecovery>` component.
  OUT/gated: first-party one-click unpack (child-process spawn — hazard sweep + Ken gate); shipping any XSD (illegal).
- **KEN DECISIONS before build:** (1) approve the direction; (2) NAME the community unpacker to recommend (+ the
  tool-agnostic "any extractor, point at root" floor stays regardless). **Validation:** typecheck/lint + harvest
  contract + VISUAL/live DOM (3 states) + negative path (no false-green) — EXPERIENCE-gated, visual validation required.

### B67 · Live-dogfood Forge findings (from the B-INGAME session, 2026-07-20) — `spec'd`
Surfaced while validating the real deployed mod live through the Forge (dogfooding). All are FORGE bugs/quality, not mod:
- **B67-1 · bridge-health "false-negative" — RETRACTED / FALSIFIED (reconcile 2026-07-20).** Read the code: the check is
  CORRECT. `:8713/health` returns `{ok:true, player2:{ok:true}, metrics:{...}}`; `normalizeBridgeLiveState` sets
  `bridgeUp = health.ok===true` → true → healthCard renders "pass/Bridge UP". The "Not running" I saw was the walkaround
  snapshot from EARLIER (bridge genuinely down then) — I compared a stale screenshot to a later live curl (a timestamp
  conflation, the "AI has no sense of time" trap). NO bug. Possible-but-UNREPRODUCED sub-item: whether the walkaround
  re-polls the 10s liveBridge cache on a down→up transition (mild display staleness) — do NOT chase without a fresh repro.
- **B67-2 · validator over-warns on imported RAW cues — DOWNGRADED to UNREPRODUCED / code-contradicted (read-only reconcile 2026-07-20).**
  Original claim: after LOAD MOD PROJECT of x4_ai_influence, Editor Diagnostics flagged its cues ("no event/condition or
  action nodes wired", "no namespace") — "likely false positives". Reconcile (no live repro yet) says the code contradicts
  this for the cues I named:
  - The two exact message strings live ONLY in `src/types.ts` (canvas graph validator): `:1520` wiring-info fires only when
    a cue resolves to 0 conditions AND 0 actions AND 0 sub-cues; `:1544` namespace-info fires only when `properties.namespace`
    is empty. [REPRODUCED: code]
  - `src/lib/xmlParser.ts:163` defaults `namespace` to `"this"` for EVERY imported cue/library when the attr is absent → the
    namespace lint **cannot fire on any imported cue**. [REPRODUCED: code]
  - Ground truth in `aic_contracts.xml`: `OnAccepted` is a `<library>` with a full `<actions>` block (importer wires it via
    `out_act`, so actionNodes>0 → wiring lint can't fire); `Registry` has `<event_game_loaded/>` + an action + `namespace="this"`
    → trips neither lint. [REPRODUCED: source]
  - Conclusion: the recalled symptom is very likely a stale/misattributed UI observation (same class as B67-1 — a remembered
    screenshot the code disproves). NOT treated as a confirmed bug; NO fix made (would be a fix built on an unreproduced,
    code-contradicted symptom — the exact anti-rationalization trap).
  - Only-if-reproduced next step (fresh/authorized session, needs the running Forge + MACHINE-STATE ASK — the import path may
    touch Ken's canvas): LOAD MOD PROJECT of x4_ai_influence, read the ACTUAL diagnostics on `OnAccepted`/`Registry`, and only
    if a warning genuinely appears, decide library-node exemption. Do NOT chase without that live repro.
- **B67-3 · "Failed to fetch" in LOAD MOD PROJECT + Agent Brief:** intermittent fetch failures during import on the
  INSTALLED (pre-P1) extension — the object-index build synchronously blocks the old sidecar (exactly what B64-P1's
  stale-while-revalidate in 0.0.30 fixes). Partly "update the install to 0.0.30", but verify the import dialog's own
  fetch has a graceful degrade/retry rather than a bare "Failed to fetch".
- **Also pending validation (now doable at the machine):** B64-U2 (deploy-fail color — isolate a scratch deploy, drive a
  failing deploy, confirm rose) · B56/B57 IDE-native eyeball batches (install 0.0.30, drive Problems panel / IntelliSense
  / cue nav / MCP / adopt in the IDE).

### B64 · Audit-driven hardening batch — `spec'd` (SPECIFIED 2026-07-18) · security-first, one unit at a time
Source: a four-sweep read-only audit (security · data/perf · UI/a11y · tests/config/arch), every finding
file:line-cited + confidence-labelled. Full acceptance contracts: `docs/plans/2026-07-18-audit-hardening.md`.
Ordering law (Ken 2026-07-18): SECURITY FIRST, then agent's choice. Each unit ships a Ken-approval brief
(change/files/risks/validation) BEFORE code. Reconcile already done — see the plan's reconciliation summary.
- **SECURITY (build order):** SEC1 ✅ VERIFIED (run_command scope fix; oracle 20/20 + live 403 drill) · SEC2 ✅
  VERIFIED (.env.example security/spend/dir vars) · SEC3 ✅ VERIFIED (config.json parse hardening; oracle 12/12) —
  all 2026-07-18, headless, e2e 19/19, → ROADMAP. SEC4 ✅ VERIFIED (dollar-aware spend attribution, EXTENDS B25,
  additive+default-off, oracle 13/13; **Ken-review the pricing table before treating as shipped spend policy**).
  **SEC5 (Origin/Referer spend-spoof) — VERIFIED as a real gap by code inspection, DEFERRED to Ken** (closing it
  changes the deliberate app-UI-origin isolation → needs explicit sign-off + a mechanism choice). SEC6 session-token
  rotation + SEC7 plaintext AI keys = **deferred** (low urgency / accepted-risk). **Security block DONE; now PERF.**
- **PERF (agent's choice):** P1 ✅ (stale-while-revalidate object index) · P2 ✅ (memoize getReferenceSets by index
  generation; consumers proven non-mutating) · P4 ✅ (cold-boot loose-XML digest stamps catch nested user-root edits)
  — all VERIFIED 2026-07-19, headless, e2e 19/19, → ROADMAP. **DEFERRED (reconciled):** **P1b** truly non-blocking
  build (worker/chunked-async; large ripple) · **P2b** thread one DOM per file across the ~8 lints (signature ripple)
  · **P3 DEFERRED w/ rationale** — the audit symptom is rapid DISTINCT edits, which only a delay-debounce fixes, and
  that risks lost-write/disk-memory-divergence in the ADR-F1/SPEC-#66-scarred persistence path; the safe dirty-check
  slice doesn't address the symptom. Revisit in fresh context with crash-consistency tests if the write-amplification
  ever bites. **PERF BLOCK DONE (P1/P2/P4 shipped; P1b/P2b/P3 deferred).**
- **CHEAP UX (eyeball-validated 2026-07-19 via computer-use — Ken unblocked Forge visual validation):**
  - **U1** ◐ DORMANT — error toasts persist + role=alert (code-correct), but the app raises NO error-kind toasts
    (all `toast()` are info); no live trigger. **OPEN DECISION (Ken):** route `window.alert`→error-kind? (judgment call).
  - **U2** ◐ CODE-VERIFIED, live component (GuidedRail) — amber→rose deploy-fail. NOT live-driven (deploy = write-gate
    to the real mod-staging dir). **OPEN DECISION (Ken):** isolate modWorkspacePath→scratch and drive a failing deploy, or accept code-verified.
  - **U3** ✗ NO-OP / FALSIFIED — the markers are in the OLD renderer; `CODEMIRROR_EDITOR=true` (CodePreview.tsx:29)
    makes CodeMirror default → dead code (live: 0 markers). CodeMirror shows no per-line severity markers; live severity
    indicators already have text labels. Audit C-A11Y-4 FALSIFIED for the live app; U3 = harmless dead-path polish. → ROADMAP.
  - **U4** Beginner Customize dead-end (verify-first, not started; re-ground against live path first).
- **A11Y:** **A1 ✅ VERIFIED LIVE** (accessible confirm/prompt dialog — role=dialog/aria-modal/Escape/focus-trap/restore
  proven in the live DOM via computer-use; RECONCILE: no shared shell → re-scoped to the DialogHost dialog) 2026-07-19 →
  ROADMAP. **A1b (deferred):** shared `<Modal>` primitive + migrate the ~10 bespoke feature modals (each eyeball-gated).
  A2 Canvas keyboard nav (heavy, eyeball) · A3 sub-11px typography (deferred, design-led).
  **⚠️ DURABLE LESSON (2026-07-19):** the audit's UI/a11y findings were STATIC and can cite DISABLED render paths (U3
  proved it) — **re-ground A1b/A2/U4 against the LIVE render path (CodeMirror + real components) BEFORE building**, else
  we ship no-ops. **NEXT buildable: re-ground the a11y items, or ARCH1** (server.ts extraction, its own session).
- **TEST/ARCH:** T2 ✅ (e2e verdict from JSON report + precommit guard) · T1 ✅ slice (route-integration harness
  `npm run test:routes`, 13/13 — auth/scope/run_command-negatives/path-containment; SEC1 now a PERMANENT guard) —
  both VERIFIED 2026-07-19, headless, → ROADMAP. **NEW: T1b** (deploy dry-run + validate-with-fixture-schema +
  extension smoke — needs a bundled fixture; deferred). **ARCH1 — RECONCILE-DEFERRED (decision 2026-07-19, rule 3.5):** extraction pattern proven
  (`registerXxxRoutes(app, deps)` per src/server/*.ts); ready candidate = the AI keys/usage trio (server.ts:1935/1945/8184
  → `src/server/aiRoutes.ts`, deps: setStoredAiKey/aiKeyStatus + a spendMeter snapshot closure). NOT cut now: value is
  marginal per single extraction (8347→~8250 lines) + the cleanest candidate is security-relevant (key storage + origin
  gating) — the god-file reduction deserves a DEDICATED focused pass (several extractions, one fresh session), not one
  drive-by 14-units-deep. Do it as its own session with full tsc+sweep+e2e per extraction. **PRODUCT:** X1 finish-or-remove
  Google OAuth (Ken decision).
- **NOT re-opened (already tracked):** 3 RED oracles (env-only), e2e stdout-parse (B17), 13 machine literals (B41).
- **VISUAL VALIDATION UNBLOCKED (Ken, 2026-07-19):** the Forge UI can now be driven headlessly via computer-use — start
  Vite + an isolated sidecar (see the eyeball-session method: Vite 8800 + sidecar 8801, isolated X4_STATE/DATA dirs, known
  token), open the Browser pane, validate via DOM (`read_page` + `javascript_tool`; screenshots wedge — B28). This is how
  A1 was VERIFIED and U3 was falsified. The OLD "eyeball blocked by textinputhost" note is SUPERSEDED for the Forge web UI.
  (IN-GAME validation of x4_ai_influence is still desktop-blocked — that's X4 itself, not the Forge UI.)
- **B64-FINDING (2026-07-19, from Ken's Google-AI screenshot):** Google's AI Overview describes X4 Forge but OVERCLAIMS
  ("edit sector maps"/"design station blueprints") — reconcile confirmed those are GOOGLE'S hallucination, NOT our copy
  (extension README has zero such claims; manifest description is accurate/modest). Two small OPEN items: (a) verify +
  fix a possible mojibaked em-dash (`â€"` vs `—`) in the package.json `description` [HYPOTHESIS — read the raw bytes first];
  (b) optional: richer store README with an explicit "what it does / what's on the roadmap" so the AI summarizes fact not
  guess (ties to B59d anti-hallucination). Neither started; both small; Ken's call.

### B60 · Automated + readable extension CHANGELOG — ✅ VERIFIED 2026-07-17 → ROADMAP
Open VSX "Changes" tab is LIVE and human-readable (confirmed served for 0.0.17). Automated:
`scripts/gen-changelog.mjs` derives the version list/dates/order from git; the USER-FACING text
per version comes from curated `release-notes.json` (plain language for modders) with a
humanized-commit-subject fallback; selftest 8/8; ships via `.vscodeignore`; `npm run changelog`
in the publish flow. Publish-before-commit adopted (structurally fixes version-lag: committed
version == published version). One human step per release = add a plain-English block to
release-notes.json.

### B41 · VS Code / Antigravity extension PoC — ✅ VERIFIED (both IDEs) 2026-07-15 → ROADMAP
Install-tested LIVE in desktop VS Code AND Antigravity (Ken authorized both installs): VSIX
installs, autoOpen launches the studio, the real UI renders in the webview over a managed
per-IDE sidecar (dynamic ports :62647 / :52030), representative edit→validate→compile→package
completes in each, Workspace Trust gate proven in Antigravity. VSIX 2092 files/16.77MB, inspected
clean. Standalone :3000 untouched. Evidence: `vscode-extension/evidence/VALIDATION.md`.
**Open (Ken, not blocking the tech result):** private-beta cohorts + go/no-go
(`vscode-extension/BETA-TEST-SCRIPT.md`); commit-of-this-branch decision.
**Residuals (bounded):** genericize server.ts baked default paths before ANY tester
distribution (13 machine literals ship in every build); optional X4_DATA_DIR seam so the
sidecar stops writing data/ into its install dir; port to main the 3 product/infra fixes
(prod token injection, db createRequire, e2e 127.0.0.1 pinning) — main already committed the
B34–B37 delta this session as ff38642.

### B42 · Agent key manager (scoped, expiring keys) + parity passes + ext icon — ✅ VERIFIED 2026-07-15 → ROADMAP
Named scoped expiring agent keys (read/write/deploy · 1h/24h/7d/30d/never · sha256-at-rest ·
one-time reveal · revoke · audit), AgentBridge AGENT KEYS tab, extension "Create Agent Key"
command, key-mgmt session-token-only. Oracle 18/18; e2e 19/19; sweep 79/81; full security
matrix + full key lifecycle proven LIVE in Antigravity (create→reveal→terminal use→scope
403→revoke→terminal 401). Parity: 19/19 surface engines 200 + visual panel passes. Icon
shipped; VSIX 0.0.2. Evidence: `vscode-extension/evidence/VALIDATION.md`.
**Open (Ken):** commit-of-branch decision; port the auth change + fixes to main. **Residual
(bounded):** attach-mode has no session credential, so the "Create Agent Key" command only
works against an owned sidecar (documented in the command's message).

### B43 · Gold-standard sidecar debugging (VS Code + Antigravity) — ✅ VERIFIED 2026-07-15 → ROADMAP
`x4forge.debug` (off/inspect/inspect-brk) spawns the sidecar under `--inspect` + auto-attaches the
IDE Node debugger. Proven LIVE in BOTH IDEs (debug toolbar active; Antigravity Call Stack "X4 Forge
Sidecar RUNNING"; VS Code "Debugger listening on ws://" + debug status). Source-level TS via
`x4forge.forgeRoot`; committed `.vscode/launch.json` for the controller. Default off = zero behavior
change (touched only vscode-extension/). VSIX 0.0.3, both IDEs. Evidence: `vscode-extension/evidence/VALIDATION.md`.

### B44 · Git-derived live version in the header — ✅ VERIFIED 2026-07-15 → ROADMAP
Header `v{__APP_VERSION__}` is now `major.minor.<git-commit-count>` (baked at build time), so it
moves with every commit and updates when users update the extension; tooltip `__APP_BUILD__` =
short SHA + commit date + dirty flag. Graceful fallback to package.json version if git absent.
`vite.config.ts` + `src/vite-env.d.ts` + one App.tsx attribute. Live-proven header "v1.0.213".

### B45 · Directory-save no longer gated on schema — ✅ VERIFIED 2026-07-15 → ROADMAP
`POST /api/schema/config` was 400-gated on schemaDir containing md.xsd+common.xsd, which
blocked saving the workspace/filesystem/game paths whenever the schema was absent/incomplete.
Now paths save independently; schema is validated + REPORTED (amber "saved, schema pending"),
never a hard gate. Server + DirectorySettingsModal. Live-proven: workspace-only save persists;
valid schema still loads (unpacked libraries → 402 events/807 actions). tsc/e2e 19/19.

### B46 · Full-corpus schema/reference validation — Phases 1–2 ✅ VERIFIED 2026-07-16; Phase 3 reference-set slice ◐ PARTIAL 2026-07-23
**Phase 1 (multi-schema loader) SHIPPED:** `src/lib/schemaRegistry.ts` — discovers EVERY *.xsd
under the configured schema folder + game folder (bounded walk mirroring B51, base-over-DLC),
resolves transitive include chains, builds lazy per-domain indexes via the existing
`buildSchemaIndex`; `GET /api/agent/schema-registry` (+`?domain=` +`?refresh=1`), TTL registry
cache (cold walk 25.6s first-touch → 14ms cached). Oracle `schema-registry-selftest` 11/11
(synthetic: include chain, junk degrade, missing include, DLC preference). LIVE vs the real
unpacked 9.00: **40 domains** (incl. addon/coreaddon/cutscenes found in subdirs), 48 DLC dupes
shadowed, 0 unresolved includes; md 1507 / factions 1354 / gamestarts 1417 / parameters 1556 /
diff 4 elements. tsc/lint/precommit 0 · e2e 19/19 · sweep 82/85 (3 reds A/B-proven env-only).
MD path + getAiSchemaIndex untouched (validation behavior unchanged this phase BY DESIGN).
**Phase 2 ✅ VERIFIED 2026-07-16 → ROADMAP:** file→schema routing shipped corpus-proven
(factions/gamestarts/addon/diff proven on 124 vanilla files → 0 findings; coreaddon
warning-capped, no corpus instances). The P2 hand-off note RESOLVED: the 2 md-audit findings
were include-blind loader false positives (md/md.xsd is a zero-declaration include shim);
`expandIncludeChain` fix flipped `md_generator_zero_findings` green (sweep 83/86, e2e 19/19).
CORPUS-FALSIFIED and corrected in-flight: wares/jobs must NOT route to libraries.xsd (26,835
vanilla findings) → diff-wrapper-only; invented `<language id>` t-check removed (26/74 vanilla
omit it). **P2 residual (`spec'd`, small):** palette `loadSchemaLibrary` (xsdParser) is still
include-blind — 382 events instead of 402 on unpacked-ROOT configs (pointing at `libraries/`
works). Same `expandIncludeChain` treatment; verify palette count 402 after.
**Phase 3 reference-set slice ◐ PARTIAL 2026-07-23:** B73 shipped a configurable, cached,
read-only base+official-DLC corpus for factions, wares, sectors/macros, and scriptproperties;
public APIs expose it and project validation consumes canonical sets plus project-owned definitions.
This closes the high-value ID-reference slice. The original broader 9,884-file SQLite index and
example-retrieval/prompt-delivery scope remain `spec'd`. B73 close: ROADMAP +
`docs/plans/2026-07-23-reference-corpus-api.md`. Original plan:
`docs/plans/2026-07-15-full-corpus-validation.md`.

### B55 · Validation-driven agent loop — Phase 1 ◐ PARTIAL 2026-07-16 → ROADMAP; Phases 2–3 `spec'd`
**Phase 1 SHIPPED (composite-validator repair loop):** `src/lib/agentLoop.ts` (oracle 12/12) +
generate phase-4 rewiring — the full validator stack (incl. B46P2 routing) now DRIVES retries/
halts/completion; clean first pass = 0 repair calls (live-proven with Ken's openrouter key,
2 real generates, spend metered); honest `repair` reporting; quick-fix hints in repair prompts.
Also fixed live: invalid openrouter default model id; async selftests now awaited by the
registry. Gates: tsc 0 · sweep 84/87 (same env reds) · e2e 19/19. **◐ residual:** repair-path
live-fire not yet observed (both live generations validated clean); self-reports via the
`repair` field when it happens. **Phase 2 (`spec'd`):** deterministic vanilla-example retrieval
into prompts (budgeted, corpus-bytes-only; share B46P3's index). **Phase 3 (`spec'd`,
Ken-gated):** architect/editor split + evidence-gated done + causal A/B harness.
Plan: `docs/plans/2026-07-16-validation-driven-agent-loop.md`.

### B56 · IDE-native Forge — Phase A (unit-0+s1–s5) ◐ BUILT 2026-07-17 → ROADMAP; eyeball batch OPEN
Overnight build complete and machine-validated (oracles diagnosticsMap 10/10 · modFolder 15/15
· langContext 10/10 · langService 12/12 · live drills incl. full stdio MCP session with scope/
auth negatives · sweep 85/88 · e2e 19/19 ×3 · both tsc 0 · VSIX integrity w/ mcp/ shipped).
**◐ OPEN = Ken's IDE eyeball batch** (click-by-click scripts in SESSION-HANDOFF): Problems
panel render · open-mod-folder flow · IntelliSense feel · MCP config paste into a real agent ·
(opt-in) association behavior with Red Hat XML. **Residuals (`spec'd`):** precise-children
index mode for completions (current child lists are suppression-built, over-inclusive) ·
two-way folder editing (gated on drift telemetry) · lemminx corpus-proof (IDE-gated; assoc
writer stays default-off) · EmmyLua stubs · **s6** native diff/SCM/matchers (demand-driven).
Build deltas + full record: plan header + ROADMAP. Plan:
`docs/plans/2026-07-17-ide-native-forge.md`.

### B57 · IDE-native Forge, Phase B — s1–s5 ◐ BUILT 2026-07-17 → ROADMAP; eyeball batch OPEN
All five slices machine-validated same-day (agentBrief 12/12 · langNav 10/10 · 8-tool stdio
MCP session w/ author_check draft loop + capsule parity + readiness contract · import→CAS
adopt + 409 negative · sweep 86/89 · e2e 19/19 · both tsc 0) and EYES-validated in the
browser (deep links land on Diagnostics/Playtest; adopted workspace live on canvas,
byte-faithful; honest PACKAGE: WARN header). PLAN CHANGE recorded: CodeActions rescoped out
(quick-fixes are canvas-level). **◐ OPEN = Ken's IDE batch** (scripts in SESSION-HANDOFF):
AGENTS.md flow, proof-in-editor, nav/squiggle feel, adopt prompt. Two-way stays DEFAULT-OFF
until its own telemetry says otherwise. **Residuals (`spec'd`):** s6 bucket (EmmyLua stubs ·
lemminx corpus proof · formatter-drift guard · precise-children mode). Renames stay excluded.
Plan: `docs/plans/2026-07-17-ide-native-forge-phase-b.md`.

### B58 · Community patch — ◐ BUILT 2026-07-17 → ROADMAP (f deferred); reconcile collapsed two
RECONCILED-EXISTS: e (debuglog onboarding — healthCard.ts already ships the exact launch-string
warning) · b's ENGINE (Doctor + overrideMap element-level contested/winner + dep graph #66 —
Ken's memory confirmed). Patch scope: **b-projection** (MCP check_conflicts + IDE Problems
mapping over the EXISTING engine) → **d** (one custom_gamestart recipe over existing machinery)
→ **a** ✅ (arc + war templates, oracle 33/33, picker EYES-seen) → **c** ✅ (save-impact facts
in PROOF, drilled) · **d** ✅ (Custom Game Start template — reconciled INTO the beyond-canvas
family, routed-validated 0 findings) · **b** ✅ (projection drilled via fixture + stdio) ·
**f `spec'd`, DEFERRED** (MD element reference into the reference surface — next session) ·
patrol template deferred (aiscript-side). Plan: `docs/plans/2026-07-17-community-patch.md`.

### B58-research · Community gap map — RESEARCHED 2026-07-17
Web sweep of Egosoft/Steam/Nexus/Reddit-adjacent sources: newcomer wall + story-SDK wish (our
exact lane) · debug-iteration pain (mostly out-shipped by us; onboarding gap) · cross-mod diff
conflicts (best practice exists, verification doesn't — strong unbuilt fit) · save-game anxiety
(lintable patterns only; the modified flag is engine-side) · content wishes ≈ template SKUs ·
X4CodeComplete/CodeDebug ecosystem overlap (stay friendly, stay differentiated). DECISION MENU
(a–f, effort/impact rated, recommended default order e→d→b→a→c→f):
`docs/research/2026-07-17-community-gap-map.md`. Nothing scheduled until Ken picks.

### B62 · Community round-3 features — b/c ✅ SHIPPED; a/d/e falsified-or-covered; f/g need Ken decisions (RECONCILE-EXHAUSTED)
Research + menu: `docs/research/2026-07-17-community-gap-map-round3.md`. The workflow's reconcile-first
discipline culled the menu down to what could ship cry-wolf-safe:
- **b ✅ SHIPPED** (t-file reference integrity, oracle 13/13, corpus-clean 12930 refs, 0.0.25) → ROADMAP.
- **c ✅ SHIPPED** (migration/deprecation linter, oracle 11/11, corpus-clean 399/399, 0.0.23) → ROADMAP.
- **a REJECTED** (content.xml language-completeness "won't launch" = corpus myth; real mods ship 0–2 langs).
- **d REJECTED** (auto-deps already built — externalApiRegistry + generateContentXML).
- **e REJECTED** (corpus-falsified: 345 vanilla macros are defined-but-NOT-indexed — characters/decorations/
  zones/test — so "not in index/macros.xml" is not an error signal; a simple orphan lint cry-wolfs on 345.
  A cry-wolf-safe version would restrict to ship/station macro CLASSES + verify that subset — SPECULATIVE,
  own reconcile, DEFERRED).
- **f DEFERRED (Ken decision)** — version*100 encoding ALREADY DONE (extensionProject.ts:159 + modCompiler.ts:74);
  folder + zip distributable exist (B9). New part = Steam Workshop cat/dat build + upload → needs Egosoft's
  external WorkshopTool.exe (or a binary-format reimpl) AND is a PUBLISH side-effect surface. Spec + Ken go.
- **g DEFERRED** — visual diff-patch sel builder; UI-heavy + blocked by the textinputhost computer-use issue.
- **B62b phase 2 deferred:** per-language coverage matrix + free-page-ID allocator + reserved-registry collision.
**Net:** the clean buildable-now backend-lint work of round 3 is EXHAUSTED (b, c shipped; a/d/e don't survive
reconcile); f/g are non-lint surfaces needing Ken's decision. Future rounds → new research sweep.

### B61 · Content validation for un-schema'd domains (jobs et al.) — inc 1+2 + phase 3 ✅ VERIFIED 2026-07-17 → ROADMAP
jobs linter (inc1 engine + inc2 wired, 0.0.22) + **phase 3 wares linter ✅ (wired, oracle 14/14,
corpus-clean 1397/1397, 0.0.24)** all done. Remaining un-schema'd domains (god.xml, ships.xml, loadouts)
are lower-demand — same pattern if ever pulled, but not scheduled.
**increment 2 ✅ (2026-07-17, published 0.0.22):** jobs linter WIRED into the live validator —
`jobsLint` layer in projectValidation.ts (advisory WARNING, never flips `ok`), `getJobsVocabulary()`
in server.ts (base + `ego_dlc_*` merged, cached, reference-set factions), threaded into all 4
runProjectValidation call sites; findings flow to the validate response + capsules + IDE Problems panel.
tsc/lint 0 · oracle 18/18 · LIVE endpoint proof (jobs.* warnings from the corpus-configured server) ·
sweep 88/91 · e2e 19/19. **phase 3 (SPECIFIED):** wares.xml content lint — same corpus-grounded pattern
(price/economy vocabulary); jobs is the proven template. Minor deferred: per-file flat `filePath` (mods
have one jobs.xml so canonical label is fine); promoting jobs into CORPUS_PROVEN_DOMAINS is unnecessary
(the linter is its own advisory layer, already WARNING). Historical spec below.
### B61 · (superseded — increment 1) content validation reconcile
Ken directed this off the B59d honest limit ("we need a schema for that — follow the workflow") and
authorized the build ("auto mode"). **increment 1 ✅ (2026-07-17):** `src/lib/jobsContentLint.ts` pure
vocabulary-injected linter + oracle `jobs-content-lint-selftest` 14/14; CRY-WOLF BAR MET (all 604 real
vanilla jobs lint clean, 0 false positives); negative path exact; sweep 88/91 (new oracle green, 3
pre-existing env reds). Corpus-grounded (learns 11 classes/13 orders/5 sizes from vanilla), NOT a fake
XSD; advisory, faction checks skip without a reference set. **UNWIRED on purpose** (off the validate
path — no user-facing change, no publish, avoids e2e/collision with the parallel codex + Antigravity-Gemini
sessions). **increment 2 (SPECIFIED, next):** wire the linter into the live validator — route jobs.xml
(the null route, schemaRouting.ts:70) to the linter, thread reference-set factions, surface findings as
WARNING capsules (one currency: validate/MCP/IDE), add `/api/agent/jobs-lint` GET + MCP tool if warranted;
promote jobs to CORPUS_PROVEN_DOMAINS only after re-running the 604-clean proof server-side; then e2e (clean
machine window) + publish (user-facing → changelog entry). Phase 3 = wares.xml (same pattern). Ground:
`F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00\libraries\jobs.xml`.

### B59 · Community patch ROUND 2 — a/b/c/d ✅ ALL BUILT 2026-07-17 → ROADMAP (Ken's goal a→b→c→d COMPLETE)
**a ✅ Patch-day readiness · b ✅ galaxy reconcile+jobs starter · c ✅ UI-Extensions guide · d ✅ anti-hallucination copy** — old-vs-new selector drift (patchReadiness.ts oracle 10/10 +
endpoint + MCP check_patch_readiness; live two-corpus proof vs real unpacked 9.00; 0.0.18
published). **b ✅** galaxy tab = read-only viewer (sector authoring DEFERRED #64 P2); shipped custom_patrol_job
jobs starter (oracle 36/36, picker EYES-seen, 0.0.19). **c ✅** reconcile found no raw-Lua carrier →
codegen starter DEFERRED; shipped grounded kuertee UI-Extensions compat wiki topic
(`luaui_kuertee_compat`, HUD & LUA, EYES-seen, e2e 19/19, 0.0.20 published). **d ✅** Ken-approved
anti-hallucination copy grounded in the real repair loop → shipped to README + store blurb + new
Reference wiki tab (`reference_ai_anti_hallucination`, EYES-seen, e2e 19/19, 0.0.21 published); Ken's
directive off it spun out **B61** (above). Research + menu:
`docs/research/2026-07-17-community-gap-map-round2.md`. Original research kept below.
Demand-side + author-workflow sweep: Nexus demand = conversions/overhauls/AI-tweaks (asset
side OUT of scope; the XML layer of overhauls IS ours — GALAXY tab must be reconciled first)
· the patch-day mod-breakage cycle is structural and untooled (→ two-corpus selector-drift
"patch-day readiness" — carriers exist: registry multi-root + overrideMap selector eval +
cat/dat) · the UI ecosystem runs through kuertee's UI Extensions framework (→
dependency-declaring compatible starter; ground from his repo) · "AI-made mods = one large
LLM hallucination" is the community verdict — our validator-driven loop is the counter-story
(positioning copy = Ken-voiced). MENU a–d, default order a→b(reconcile)→c→d:
`docs/research/2026-07-17-community-gap-map-round2.md`. Nothing scheduled until Ken picks.

### B47 · Walkaround: neural-link bridge de-escalated to optional — ✅ VERIFIED 2026-07-15 → ROADMAP
Ken: the bridge is x4_ai_influence-specific (ADR-F3 "optional, never a dependency"), but the
startup walkaround warned amber "bridge DOWN" for EVERY mod. Now labeled "(optional)", a down
bridge reports neutral (unknown/grey) with copy naming its actual scope, never a warn, and no
longer counts toward "N items worth a look". healthCard.ts + oracle check pinning the negative.
Live-proven: counter 2→1, row grey with the optional copy. Oracle 9/9, tsc 0, precommit 0.

### B48 · Retire the hand-rolled code editor (Monaco swap + real-estate) — `spec'd` (SPECIFIED 2026-07-15)
Reconcile shrank the "heart surgery": the whole editor = ONE component (CodePreview.tsx, 1,255
lines, one mount in App.tsx, ~20-prop contract; shared state touches only App+itself). Phase 1
= swap the text/diff CORE for Monaco inside the existing shell (chrome/apply/CAS wiring intact,
BOTH shells benefit); Phase 2 = collapse-by-default for canvas real estate + extension-native
"Open in IDE editor" bridge. Plan: `docs/plans/2026-07-15-editor-replacement.md`. Fresh session.

### B49 · Marketplace — ✅ PUBLISHED to Open VSX (2026-07-16) → ROADMAP; MS Marketplace still gated
**LIVE:** `x4forge.x4-forge-studio v0.0.4`, MIT, pre-release, at
https://open-vsx.org/extension/x4forge/x4-forge-studio — auto-updates in Antigravity/Cursor/
Windsurf/VSCodium. Namespace `x4forge` claimed; token in `.env.local` (OVSX_PAT); README/LICENSE/
manifest finalized; bundle PII-clean. **UPDATE LOOP:** commit → bump version → `npm run package`
(vsce --pre-release) → `ovsx publish <vsix> -p $OVSX_PAT` (Ken-authorized each time). **STILL
OPEN (not blocking):** MS Marketplace — blocked on Azure DevOps org requiring a subscription
(their gate); revisit when Ken wants stock-VS-Code reach. Flip pre-release→stable via a normal
(non-`--pre-release`) package+publish when ready.

### B49-old · Marketplace readiness prep (superseded by the publish above)
VERIFIED: Antigravity pulls from **Open VSX** → dual-registry publish. **DONE 2026-07-16:**
① machine-path genericize — runtime defaults now empty/harvest-dir (xsdParser), fixtures+
placeholders scrubbed of usernames/drives; client bundle 0 traces; server.cjs remaining =
generic VDF fixtures + public mod-name provenance (assessed OK). Stranger-machine sim: bare
staged app boots 200, gamePath '', health verdict honestly `blocked`→wizard. ② liveBridge
better-sqlite3 static import → lazy degrade (portability crash killed). Sweep on BARE install
78/81 — expression-suggest 0/0 red is HONEST now (old G:\ default silently loaded Ken's real
schema; configured instances stay green). **Ken's part:** MS publisher account + Open VSX
namespace + license choice + beta-vs-prerelease call. Then: package.json publisher/repo/
keywords finalize → `vsce publish` + `ovsx publish` (each Ken-authorized). Plan:
`docs/plans/2026-07-15-marketplace-readiness.md`.

### B50 · Activity-bar launcher icon (click-to-run) — ✅ VERIFIED 2026-07-16 (Ken eyeball confirmed) → ROADMAP
Icon renders in the Activity Bar rail + launcher opens with working buttons — confirmed live on
Ken's screen 2026-07-16 (the only residual). Full implementation record in ROADMAP.

### B48 Phase 2 · Canvas real-estate (collapse-default) + lazy editor — ✅ VERIFIED 2026-07-16 (e2e 19/19)
Code pane starts COLLAPSED by default (canvas +164px wider live-measured), last choice persists
(localStorage `x4_forge_code_collapsed`); the CodeMirror chunk is a lazy `React.lazy`/Suspense
import (own 358KB/gz118 asset) NOT fetched until the pane is first opened — canvas-only sessions
never download it (verified: chunkLoaded=false while collapsed). Editor + persistent top bar +
all chrome intact; expand/collapse/persist drilled live. FOUND+FIXED live: the collapsed drawer
stayed full-width because the top-bar's intrinsic width defeated the aside's inline width via
flex min-content — `min-w-0` + `overflow-x-hidden` fixed it (300px collapsed confirmed). e2e:
experience-mode spec updated (Expert now opens the editor via the pull-tab, since collapsed-default).

### B53 · X4_DATA_DIR seam — runtime data survives extension updates — ◐ IMPLEMENTED 2026-07-16
`data/` (agent keys, AI keys, AI spend meter, api-registry, harvested schemas) was cwd-relative =
wiped on every extension update (like config.json was pre-B51). New `src/lib/dataDir.ts`
(`resolveDataDir`/`dataPath`, honors `X4_DATA_DIR`, NOT coupled to X4_STATE_DIR); 8 call sites
migrated (server.ts ×3, xsdParser ×2, aiKeyStore, gameDetectRoutes, validationRoutes); extension
passes `X4_DATA_DIR=<globalStorage>/data`. Oracle `data-dir-selftest` 4/4. Live-proven: a booted
sidecar wrote agent-keys.json into X4_DATA_DIR, not cwd.

### B48 · Real editor engine (CodeMirror 6) replaces hand-rolled CodePreview — Phase 1 ◐ IMPLEMENTED 2026-07-16
Swapped the transparent-textarea/pre editor + custom line-diff for CodeMirror 6 (`CodeMirrorField.tsx`),
behind flag `CODEMIRROR_EDITOR` (old renderer kept as fallback). Editable editor + read-only split
(MergeView) / unified (unifiedMergeView) diff; XML highlighting + line numbers native; chrome
(tabs, 7 toolbar btns, status bar, minimap, editable-badge, apply/save pills) PRESERVED. Decision:
CodeMirror not Monaco (CSP/worker-clean for the webview; both shells benefit). **VERIFIED live:**
editor mounts, edits flow to draft (DRAFT-MODIFIED flips), diff MergeView renders, syntax
highlight + gutter + status bar confirmed via DOM + screenshot; tsc 0. Bundle +360KB (lazy-load =
Phase 2 polish). **Open:** e2e (running), extension repackage, Phase 2 (collapse-default real
estate + optional native-IDE-tab bridge). Plan: `docs/plans/2026-07-15-editor-replacement.md`.

### B51 · Schema discovery (recursive, subdir-aware, multi-XSD) + config persistence — ◐ IMPLEMENTED 2026-07-16
Fixes reported bugs: (1) schema scanner only looked top-level for md.xsd/common.xsd, so pointing
it at an unpacked game (`…\X4 unpacked 9.00`) found nothing; now `discoverXsd` finds XSDs in
subdirs (md/, libraries/, aiscripts/), prefers base game over DLC copies, recurses as fallback.
(2) aiscripts.xsd now discovered + wired into `getAiSchemaIndex` (ai_schema loads from the game).
(3) directory settings didn't persist across extension updates — config.json now honors
`X4_CONFIG_DIR` (extension → globalStorage), NOT the throwaway state dir. Oracle
`schema-discovery-selftest` 9/9. **LIVE-PROVEN** against the real unpacked game: md_schema "1339
elements", ai_schema pass, config persists. Caught+fixed a self-inflicted e2e regression
(configPath fell back to X4_STATE_DIR which e2e sets). Plan/decision: this entry + capability-map.

### B52 · In-app bug reporter → GitHub Issues — ✅ VERIFIED 2026-07-16 (e2e 19/19) → ROADMAP; ships in next release after Ken commits
Ken's decision: reports land in KennyG1990/X4_Forge **Issues** tab; entry point must be obvious.
Built secret-free: header **REPORT BUG** button (amber, both modes — verified visible in Beginner
default) → modal (title/steps/attach-details with the exact context SHOWN to the user) → opens a
**prefilled github.com/…/issues/new?labels=bug** page the user submits themselves; COPY REPORT
clipboard fallback; secret redaction (x4fk_/64-hex/Bearer → [redacted]); URL-length truncation
with full-body clipboard rescue. Engine `src/lib/bugReport.ts` + oracle `bug-report-selftest`
**10/10** (served live). Manifest gains repository+bugs URLs (store "Report Issue" link). LIVE
drill: empty-title blocked ✓, filled report produced the exact prefilled URL (title/body/label/env
verified) ✓, context visible ✓, screenshot taken. Plan: `docs/plans/2026-07-16-bug-reporter.md`.

### B54 · Sidecar auto-restart watchdog — ✅ VERIFIED 2026-07-16 (live kill-drill in Antigravity) → ROADMAP
DRILL PASSED (Ken-authorized, agent-driven): 0.0.11 installed + window reloaded (header v1.0.222)
→ sidecar :55430 killed by port-PID at 19:55:43 → watchdog respawned on :53143 within seconds,
status bar updated, the OPEN studio panel re-pointed itself (badge "managed sidecar on port
53143"), canvas + workspace intact; old port confirmed dead, new port HTTP 200. Published
stable 0.0.11.
Root cause of the 20:56 sidecar death: **the agent's own broad `Stop-Process` sweep** (filter
matched `node dist\server.cjs` — the "extension" marker lives in the CWD, not the command line;
exit 4294967295 = externally terminated). [REPRODUCED by timeline + filter analysis.] Procedural
fix banked (port-PID kills only — in handoff hazards). Product fix: the extension now
AUTO-RESTARTS an unexpectedly-dead sidecar (capped 3 per 5min with linear backoff; deliberate
stops exempt via the existing stoppingDeliberately flag; boot crash-loops degrade to the old
error) and RELOADS the open studio panel against the new port+token (without this the iframe
still points at the dead backend). extension.ts only; VSIX 0.0.11 packaged, watchdog verified
in the compiled extension.js. **Open gate (one drill):** install 0.0.11, open studio, kill the
sidecar PID from a terminal → panel comes back on its own + "restarted automatically" toast +
log line "auto-restarting (attempt 1/3)".

## P1 — Safety / architecture

### B1 · Workspace sync-trust slice — ✅ CLOSED 2026-07-09 → ROADMAP (badge verified live; residual: badge clipping polish → B13)
### B1-old spec (kept for context) — `done`
The mutable-singleton + integer-version sync has caused two incident classes (e2e clobber; the 2026-07-09
stale-canvas overwrite). Full redesign is B2; this slice makes staleness VISIBLE and self-healing.
**Scope:** server computes a content hash of the active workspace and returns it from `GET /api/agent/workspace`
(and bumps it on every write); client compares its canvas hash each poll; on mismatch-with-no-local-edits it
adopts (version gate stays as tiebreak), on mismatch-with-local-edits it shows a visible badge
("Canvas differs from server — Adopt server / Keep mine") instead of deciding silently.
**Acceptance:** oracle for the hash (stable across key order, sensitive to node/property change); simulated
divergence shows the badge; adopt button converges; tsc/sweep green.

### B2 · Sync protocol replacement (ADR-F1) — ✅ ALL SLICES CLOSED (s1–2 07-09/07-10, s3 2026-07-12) → ROADMAP
Slice 3 closed 07-12: persistence + chokepoint + legacy gate + park-on-switch; acceptance proven live
(zero-client restart survival ×2; blank-client incident reproduction → dead). Residuals folded into B26
(guard self-check + RESET-button audit + guard-removal decision). B12 tabs ride the parked-state map.

### B3 · Console health probe — ✅ CLOSED 2026-07-09 → ROADMAP (Ken's live drill: closed the Web window →
respawned ~60s; closed the API window → respawned; both verified from the agent side, app + API answering)

### B25 · AI spend meter + daily cap — ✅ CLOSED 2026-07-11 → ROADMAP (oracle 7/7, sweep 70/70;
GET /api/ai/usage live; cap-trip proven by oracle, not by spending)

## P2 — Committed audit work (deferred by budget)

### B4 · R3: quick-fix graph mutations — ✅ CLOSED 2026-07-09 → ROADMAP (oracle 20/20, headless compile-legal
proof; ◐ residual: in-UI eyeball of the new cards at Ken's next session)
### B4-old spec (kept for context) — `done`
Extend `QuickFixDescriptor` ops with graph mutations (`add_node` / `add_link`); make modFixes'
"cue has no trigger" ADVICE a MECHANICAL one-click fix (adds + wires an event node); fold the 💡 advice
block into the 🔧 apply block; retire `modFixes.ts` + its selftest once absorbed.
**Acceptance:** quick-fixes oracle covers add_node/add_link paths; a triggerless cue on a scratch workspace
gets a working one-click fix (validated by compile + crossfile); modFixes selftest removed from the sweep
with its checks migrated.

### B5 · Sidebar Properties Inspector extraction — ✅ CLOSED 2026-07-10 → ROADMAP (flipped by B15's fix; suite 11/11)

### B15 · canvas-interactions RED — ✅ CLOSED 2026-07-10 → ROADMAP (root cause: B1 adoption poll vs the
spec's POST-only isolation; GET isolation ported with capture-first toggles; suite 11/11, spec 3× green)

### B6 · xmldom scan — ✅ CLOSED 2026-07-09 → ROADMAP (DOM-first with regex degrade; 8 new oracle checks; real mod compiles clean)

### B7 · Small fixes pair — ✅ CLOSED 2026-07-09 → ROADMAP (drift verdict + wizard checklist, both verified live)
(a) `computeModDrift` excludes tool-owned metadata (`.studio-mod-id`, `.forgekeep`) from the VERDICT
(still listed, never "drifted" alone). (b) Compile wizard renders the deploy-verify checklist card in the
wizard's result step (verdict currently hides in the Playtest tab).
**Acceptance:** drift on the real mod reports `identical`; wizard confirm shows per-stage rows incl.
source-sync; a stale-canvas 409 renders the failure row, not a toast.

## P3 — Release track (parked: Ken's call on timing)

### B8 · G5: packaged installable build — `parked`
Single artifact a non-dev installs (Electron or single-binary + static bundle); includes G6 residuals
(README, support docs, release assets). Production mode already exists (API_ONLY + static serving +
run_command gated out).

### B9 · One-click distributable — ✅ CLOSED 2026-07-10 → ROADMAP (zero-dep zip engine, 21/21 oracle,
independent-extractor verified, gate blocks red builds, Playtest button live)

## P3.5 — Vision v2: barrier-to-entry track (ADR-F2, ratified 2026-07-11)

> Direction: "the UE5 editor for X4" — TTFM (Time To First Mod) is the north-star metric.
> Full plan + sequencing rationale: `docs/plans/2026-07-11-vision-v2-ue5-editor.md`. Items below
> are Phase 1/2 (buildable now); Phase 3 rides B2s3/B8; Phase 4 starts with the B24 spike.

### B18 · First-run setup wizard + game autodetect — ✅ VERIFIED 2026-07-16 (visuals SEEN + fresh-boot acceptance on scratch) → ROADMAP
Both open gates closed 2026-07-16 on an ISOLATED scratch instance (X4_STATE/CONFIG/DATA_DIR →
scratchpad; game dir read-only): wizard visuals eyeballed via Claude-in-Chrome screenshots (modal,
detect card, proposal rows, buttons all render); full zero-typing auto-setup run end-to-end in
~15s (<2min bar) — detect→harvest 3 XSDs from real cat/dat→apply→reload → walkaround flipped
"2 blocking" → "nothing blocking", md 1507 elems + ai 1488 + 2333 scriptprops loaded from the
wizard's own writes. BONUS: the eyeball CAUGHT a real B53 coupling bug (proposal.xsdSchemaPath
was cwd-based while harvest writes to dataPath → extension auto-setup would point config at an
empty, update-wiped dir) — fixed in gameDetectRoutes.ts, live re-proven. **Residual (minor):**
GOG detect branch still unverified (no GOG install available); ships in 0.0.10.

### B27 · Selftest index endpoint — ✅ CLOSED 2026-07-11 → ROADMAP (sweep 71/71 via runtime index;
acceptance diff caught 2 census errors incl. a nested-path oracle NO prior method ever swept)

### B19 · Template → in-game guided rail — s1 ◐ (07-11) · s2a+s2b ✅ CLOSED 2026-07-12 → ROADMAP
s2a: server `verdict` field (oracle 9/9) — rail + Playtest render it, TTFM gated on true loaded_clean.
s2b: beyond-canvas templates (price patch / t-file / HUD button, oracle 23/23) + the two coupling
fixes (onboarding empty-in-every-domain; rail mounts on any-domain content). **Open (game-gated):**
rail-to-game EXPERIENCE + template stamps → in-game batch. **Acceptance (final):** a non-author tester
ships welcome-message to a running game on on-screen guidance alone.

### B33 · RESET → template picker — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
(dead starter cue removed from BLANK_WORKSPACE; RESET→picker proven live; sweep 75/75, e2e 12/12)

### B37 · Beginner and Expert workspace shell — ✅ VERIFIED 2026-07-16 (Ken eyeball closed the last gate) → ROADMAP
Both shells confirmed rendering correctly live on Ken's screen 2026-07-16 — the only open gate
(the in-app screenshot transport had timed out on four captures; every machine-checkable layer was
already green: tsc/sweep 80/80/e2e 19/19/build/precommit/DOM+interaction drills). Full acceptance
contract: `docs/plans/2026-07-14-beginner-expert-workspace.md`.

### B38 · Playtest Deploy and Prove — `SPECIFIED` (implementation waits behind the B34-B37 commit point)
Consolidate the existing deploy-verify, watcher verdict, cue liveness, FORGE-WATCH/FORGE-STATE, source
navigation, and artifact surfaces into one deterministic proof session. Fix the reproduced blank-path Playtest
deploy bug (it currently omits the visible workspace), and let file-load evidence prove data-only mods are seen.
Exact current-workspace/game-target confirmation is mandatory; validation uses a purpose-built scratch workspace,
not an unsafe automatic clone. Full acceptance record: `docs/plans/2026-07-15-deploy-and-prove.md`.

### B20 · TTFM instrumentation — ✅ CLOSED 2026-07-11 → ROADMAP (oracle 9/9, sweep 68/68, e2e 12/12;
report panel deferred until the first real funnel completes)

### B21 · MD action-frequency census — ✅ CLOSED 2026-07-11 → ROADMAP (oracle 12/12; live corpus:
106,437 instances, top-52 actions = 90% of usage, curated already 41.4% of instances)

### B22 · Pattern browser — s1 ◐ (07-11) · s2 ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Mid-canvas stamping live (oracle 16/16 incl. a caught cue-name-collision defect; stamp→undo drill
green). Card unification deferred → B13 batch 2.

### B28 · Browser-pane wedge — ◐ CLOSED-RECLASSIFIED 2026-07-12 (workflow v3, PARTIAL) → ROADMAP
Ours (Vite watch gaps killing evals) fixed via B29/B26; the tool's (screenshot/stale-frame/click-desync
in the pane's capture path) banked with workarounds — no buildable Forge unit remains. Escalate
upstream if it persists across sessions.

### B29 · Header horizontal overflow — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Fits at 1280 AND 1920 (DOM-rect drills, 0 clipped controls); conflict card promoted to a fixed
sync-status layer (unclippable by construction); live-409 negative path proven at 1280; e2e 12/12,
sweep 73/73. Bonus: found+fixed the B2s3 Vite watch-ignore gap (persistence writes were
full-reloading every client) and closed the Keep-mine residual end-to-end. Note: label-restore
threshold min-[2150px] is a measured constant — re-measure if the header gains features.

### B23 · Installer unpark decision package — `blocked` (Phase 3; KEN GATE, after Phase 1 lands)
When TTFM-in-app measured ≤15 min: present B8 unpark w/ funnel evidence; Electron-vs-single-binary
ADR at unpark. Until then B8 stays parked.

### B24 · Live game-state inspector — SPIKE ✅ CLOSED 2026-07-11 → **ADR-F3** (StarForge decisions.md);
slices spec'd below
**B24s1 · FORGE-STATE parser + Inspector panel** — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) →
ROADMAP (oracle 12/12; endpoint + panel DOM-proven against a synthetic fixture; in-game emission →
in-game batch). **B24s2 · probe-extension generator** — ◐ IMPLEMENTED 2026-07-13 → ROADMAP: generator
(`forgeProbe.ts`) + oracle 9/9 + read-only `/api/agent/probe/preview` all VERIFIED (probe compiles to 0
errors, read-only invariant enforced, round-trips the parser; also fixed a latent B24s1 `\"`-vs-`&quot;`
emit bug). **◐ residual = the deploy + in-game confirmation** (write gate + game session, Ken). Periodic
heartbeat needs a `checkinterval` emit the compiler lacks (further follow-up). Constraints (binding):
optional, read-only, zero impact absent; bridge = lessons only.

## P4 — Depth / UX long tail

### B10 · curated action semantics — slice 1 ✅ CLOSED 2026-07-11 → ROADMAP (**91.5%** of observed
usage curated; oracle 50/50). Remaining = OPTIONAL-DEPTH / DEMAND-DRIVEN NOTES (NOT queued agent work):
- **tags beyond the top 52** — demand-driven; the top 52 already cover 90% of real usage.
- **xsdParser `structural`-category rider** (B21 worst-pick) — `classifyFromGroup` labels structural
  child-elements (param/text/owner/position/rotation/safepos/match/replace) `'action'`, so they enter
  `schemaLibrary.actions` and the census's `actionTags` filter (server.ts ~7552). Fix = add a `structural`
  category; census/palette/explain exclude it. **Reconciled 2026-07-13 — why it's NOT force-built:** (1) its
  ACCEPTANCE (live census/palette stop showing these) needs the LIVE game schema + corpus loaded = Ken's
  configured install, so not cleanly agent-verifiable here; (2) it's a schema-layer change feeding
  palette/templates/validation — real blast radius, deserves fresh context, not a marathon tail;
  (3) the user-visible symptom is ALREADY handled (B10s1 curated these kind 'other' in mdSemantics). SPEC'd
  for a future session with the schema loaded. Blast-radius readers to check first: `schemaLibraryToTemplates`
  (schemaTypes.ts:81), the action/control_flow split (xsdParser.ts:291), census `actionTags` (server.ts:7552).

### B11 · aiscripts visually editable — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED — ALREADY EXISTED; stale entry)
Reconcile + live drill proved the full chain has existed since #65 + the AIScriptEditor: guarded
byte-faithful import → editable AIBehaviorScript model → the editor's visual pipeline edits it (UI field
edit → model updated, drill-proven). The "no visual surface beyond code view" claim was stale. No code
written — the workflow's redundant-infrastructure rule in action.

### B12 · Multi-workspace switcher — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
(parked-state optgroup in the header select; non-destructive round-trip proven via the real user flow;
tab-strip chrome deliberately out of scope — switch-without-loss was the substance)
· RESIDUAL CLOSED 2026-07-13: domain-aware `contentSummary` replaces "0 nodes" for beyond-canvas parked
states (oracle 11/11, live-verified). Standing-hazard sweep also run same day (clean + 1 dead-wipe
foot-gun removed) → ROADMAP.

### B13 · QoL batch — batch 1 ✅ (07-12) · batch 2 ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Batch 2: override-map→Diff→Patch pre-target (event+mailbox, mount-race caught+fixed) · HUD-button
3-step wiki guide · StarterCard unification (B22s2 deferral closed). All drills live; suite green.

### B17 · e2e gate hygiene — ✅ CLOSED 2026-07-11 → ROADMAP (green/red/no-tests all verified; Node-bump
probe ◐ Ken-gated machine change)

### B26 · workspace-guard restore self-check — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Restore-verify marker + wrapper red-on-FAIL (negative path drilled); api-selftest 6/6 covers all gate
branches; RESET audited clean (CAS + parks); runtime-writes audit found+fixed a 2nd vite gap (data/**).
Guard KEPT until B31. Residual note: verify line can race the libuv crash → B31 moves it in-process.

### B31 · Ephemeral e2e server state — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Suite 12/12 ×2 on its own per-run stack; guard + all workspace route-mocks DELETED; live workspace
untouched with no restore ever running; acceptance literal (0 interceptions). e2e no longer needs the
machine-state ask. Bonus: the libuv crash didn't reproduce off the shared server (3 runs).

### B16 · run_command async-job mode — ✅ CLOSED 2026-07-09 → ROADMAP (dogfood-verified: app answered in 7ms mid-job)

### B14 · Staleness-era leftovers — ✅ FULLY DISPOSITIONED 2026-07-12 (all remaining lines Ken/game-gated)
KEN-GATED: XPath match counts (lib = dependency DECISION, local-npm-only posture) · golden round-trip
corpus (needs Ken's mod paths) · P-C/P-D mod profiles (stale spec — keep-or-drop call). GAME-GATED:
T1.3 runtime ftable loader. T4.3 "canvas arrow" → CLOSED (already resolved by substitution in the 37th
pass: the PropertiesInspector's contextual Lua↔MD binding panel; live-drilled 07-12 → ROADMAP).

### B32 · Recurring-mistake tripwires — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
TRIPWIRES table in precommit-check.mjs (runs before typecheck, named messages); negative drill BLOCKED
exit 1, green tree exit 0. Add future mechanical-mistake patterns to the table.

### B30 · Mirror-drift gate — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
(precommit byte-compares the 3 in-repo mirrors; deliberate-divergence drill BLOCKED exit 1; green now.
The GLOBAL F:\DEV_ENV\CLAUDE.md copy remains Ken's named canon-lag item — outside this repo's gate.)

### B63 · Community round-4 features (ecosystem/overhaul gaps) — A1 ✅ SHIPPED; A2/A3/C1 open, B1 PILLAR (Ken decision)
Research (pre-culled, 2 agents triangulated): `docs/research/2026-07-18-community-gap-map-round4.md`.
- **A1 ✅ SHIPPED** (factions.xml relations lint: value bounds [-1,1] + unknown-target-faction, oracle 11/11,
  corpus-clean 232 relations, 0.0.27) → ROADMAP.
- **A2 OPEN** — god.xml station-placement lint (matchextension="false" gotcha + macro resolution; COMPLETELY
  uncovered; needs the object index for macro refs). Strong next lint, reconcile-first.
- **B1 (Ken decision) — BULK PARAMETRIC TRANSFORMS pillar**: select-by-rule → multiply/set property → emit
  <diff> (X4_Customizer's domain; the 3rd pillar author/validate/TRANSFORM). Highest impact, multi-unit
  (rule engine + selection UI + emit); composes with synthesizePatch + the validators. NEEDS A SPEC + Ken go.
- **A3** loadout slot-fit (needs slot-count from ship macros; heavier). **C1** computed balance stats (DPS/
  margin/slot tables; analysis value-add). CULLED-OUT (already covered): derive-diff-from-two-files
  (synthesizePatch exists), IntelliSense, sector editor (#64), cat/dat pack (B62f-adjacent).

### B63 round-4 continued — A2 (god.xml) REJECTED by reconcile; B1 pillar + object-index-maps prereq open
**A2 REJECTED (corpus-falsified):** god.xml matchextension="false" is omitted by 495/496 vanilla locations (mod convention, not a rule) → cry-wolf; macro-resolution can't work either — only 18/151 god.xml macros are in index/macros.xml, the other 133 are sector/zone/cluster macros in maps/ which the object index (x4ObjectIndex scans index/*.xml only) doesn't include → would flag 133/151 vanilla macros. **PREREQ for a safe god.xml lint: extend x4ObjectIndex to also index maps/ sector/zone/cluster macros** (a bounded infra unit; also improves reference pickers + liveFixes macro-existence broadly). Then god.xml macro-resolution becomes clean (0-bar). **B1 (bulk-transform pillar) remains the strategic next-big-thing (Ken decision).** Round-4 net so far: A1 factions ✅; A2 falsified; a/d/e (round-3) falsified/covered — the EASY lint wins are genuinely mined.

