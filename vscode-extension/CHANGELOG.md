# What's New in X4 Forge Studio

The latest changes, newest first. (This page is generated automatically — see
`release-notes.json` to edit the wording.)

## 0.0.33 — 2026-07-24

- Point Forge at one unpacked X4 root and it now discovers, classifies, and caches the full corpus — base game, official DLCs, schemas, scripts, reference data, examples, and assets — while the settings screen shows live coverage instead of asking you to wire separate schema folders.
- Autocomplete and validation now follow X4's ordered XSD grammar and typed script-expression chains, including project-inferred variables, inherited properties, legal next children, canonical ids, hover documentation, and did-you-mean warnings.
- Mod XML patches are now applied read-only to the effective base-plus-DLC document before validation, so dead or overly broad selectors and illegal post-patch structures are caught. The corpus setting also links to X4 Unpacker by z1ppeh as an optional community tool for creating an unpacked corpus.

## 0.0.32 — 2026-07-24

- XML authoring now has schema-aware completion: child elements, attributes, enum values, and canonical faction, ware, sector, and macro ids come directly from X4's unpacked XSDs and reference data.
- MD and AI-script expressions now complete and document real datatype properties and functions — including chained results such as faction.player.relationto — with hover signatures and return types.
- Validation now reports deterministic XSD violations as errors and unknown script properties, functions, or reference ids as suggestion-bearing warnings while you edit.

## 0.0.31 — 2026-07-20

- Fixed a bug where imported raw XML (cues loaded from an existing mod and kept verbatim) gained more and more leading whitespace on every save — indentation is now stable no matter how many times you save, and previously affected files self-heal on their next save.
- Housekeeping: the project's development history was unified onto the main branch — no user-facing change beyond this cleaner foundation for updates.

## 0.0.30 — 2026-07-19

- First-run setup is fixed: if you hit "md.xsd / common.xsd not found", Directory Settings now has a one-click "Extract schemas from my game install" button — it pulls every one of X4's schema files straight out of your own game, no unpacking needed. It grabs the full set (not just the core two), so factions, game starts, patches and more all get validated.
- When schemas aren't set up, the settings screen now explains how validation works and exactly how to get the files — including the fallback of unpacking the game with any community cat/dat tool and pointing the Forge at the unpacked folder — instead of dead-ending on an error.

## 0.0.29 — 2026-07-18

- New check for station/economy mods: if your god.xml places a station in a sector or zone whose macro doesn't exist (a typo, or a sector you forgot to add), the Forge flags it — instead of the station silently never spawning in-game. Grounded in the game's real macros (now including sectors/zones), so valid placements stay quiet.

## 0.0.28 — 2026-07-18

- The Forge now recognizes the game's sector, zone, and cluster macros. Referencing one of those (for example a station location in god.xml, or a sector in a mission) no longer gets a false 'that macro doesn't exist' warning, and they now show up in the pick-a-macro lists.

## 0.0.27 — 2026-07-18

- New check for faction mods: if a faction relation value is outside the game's legal −1…+1 range, or points at a faction id that doesn't exist, the Forge flags it — catching the two mistakes overhaul and diplomacy mods hit most. Grounded in the game's own factions, so valid relations stay quiet.

## 0.0.26 — 2026-07-18

- Localization got a second helper: if your mod ships text in more than one language, the Forge now points out any lines you translated in one language but missed in another — so non-English players don't silently fall back to English. It only speaks up for multi-language mods (never nags a single-language mod), and gives one summary per language, not a wall of warnings.

## 0.0.25 — 2026-07-18

- New localization check: if your mod references one of its own text lines by {page,id} but that line isn't defined in your language files, the Forge flags it — catching the typos that show up as blank or wrong text in-game. It only checks references to text your mod owns (never vanilla text you reuse), and it ignores developer comment notes, so it stays quiet on valid mods.

## 0.0.24 — 2026-07-17

- The 'jobs' safety check now has a twin for 'wares' (the economy/commodity definitions): the Forge flags a made-up transport type, a typo'd tag or group, and a nonsensical price (min above max) — grounded in the game's own wares so it stays quiet on valid content. Advisory, never blocking.

## 0.0.23 — 2026-07-17

- New check: the Forge now flags mod code that uses commands or properties a game update removed or renamed (e.g. things that changed in 9.0), so you find out at edit-time instead of when the mod silently breaks in-game. It's advisory and grounded in Egosoft's own Breaking Changes list, and it ignores commented-out code so it won't nag about old lines you already disabled.

## 0.0.22 — 2026-07-17

- New check for 'jobs' files (the fleet & economy definitions big overhaul mods use): the Forge now flags likely mistakes — an invented order, a bad location type, or a wrong ship size — even though the game itself ships no rules file for jobs to check against. It's advisory (a heads-up, never a blocker) and learned from the real game's own jobs, so it stays quiet on valid content.

## 0.0.21 — 2026-07-17

- New: a plain-English answer to "is this just another AI mod generator?" — now on the store page, in the README, and as a Reference guide inside the studio. Short version: AI output goes through the same real-schema validation a hand-built mod faces, and if it can't make a mod validate, it tells you instead of handing you a broken one.

## 0.0.20 — 2026-07-17

- New in-app guide: how to make a UI mod compatible with the widely-used kuertee UI Extensions framework — the ecosystem-standard way, instead of patching the game's UI files directly. Find it under X4 Wiki → HUD & LUA.

## 0.0.19 — 2026-07-17

- New starter: Faction Patrol Fleet — add a patrolling faction fleet that spawns and roams the galaxy, the way big overhaul mods add fleets. Grounded on the game's own job definitions.

## 0.0.18 — 2026-07-17

- Patch-day readiness check — when X4 updates, see which of your mod's patches will silently stop working because the game files changed, before you ship a broken update.

## 0.0.17 — 2026-07-17

- You can now see what's new in each update right here — in plain language.

## 0.0.16 — 2026-07-17

- New ready-made mod starters: a 3-stage Story Arc, a War-Reactive Bounty that only pays while two factions are at war, and a Custom Game Start you can select from the New Game screen.
- Mod conflict checker — spot when two of your installed mods change the same game file, and see which one wins.
- The proof report now lists a mod's save-game impact (which cues and files it touches) so you know what to expect before you install.

## 0.0.15 — 2026-07-17

- Opened mod folders now describe themselves to AI coding assistants, so an assistant follows the Forge's rules instead of guessing.
- Jump straight to where a cue is defined, and see everywhere it's used.
- Errors now show up as you type, not only when you save.
- Generate a one-page proof report for any mod, and turn on optional two-way editing between the editor and the canvas.

## 0.0.14 — 2026-07-17

- Deep IDE integration: mod problems appear in the native Problems panel, you can open a mod as a real workspace folder, and X4 autocomplete and hover docs work while you edit MD and AI scripts.
- Coding assistants can now use the Forge as a tool through a bundled connector.

## 0.0.13 — 2026-07-16

- The built-in AI now checks its own work against the game's real rules and fixes mistakes before handing you a mod — no more invented commands that only fail in-game.

## 0.0.12 — 2026-07-16

- Every kind of mod file (factions, game starts, patches, and more) is now checked against the game's own rules, not just mission scripts.

## 0.0.11 — 2026-07-16

- The backend now restarts itself automatically if it ever stops, and the open studio reconnects on its own.

## 0.0.10 — 2026-07-16

- Broader schema support and editor improvements; first-run setup fix.

## 0.0.9 — 2026-07-16

- Editor and schema-loading improvements.

## 0.0.8 — 2026-07-16

- Enforce stable releases and update version

## 0.0.7 — 2026-07-16

- Implement in-app bug reporter, update publishing docs
- Add PUBLISHING.md
- Handoff + records capstone for the /// batch (extension branch sync)

## 0.0.6 — 2026-07-16

- CodeMirror editor swap, Activity Bar launcher, subdir-aware schema discovery + config persistence (///)

## 0.0.4 — 2026-07-16

- Prepare for marketplace, generalize paths, plan editor swap

## 0.0.3 — 2026-07-15

- Enhance debugging, build info, and save resilience

## 0.0.2 — 2026-07-15

- Launch VS Code Extension PoC, Agent Key Manager, and new workspace modes
- Implement probe generator, refine workspace state, update docs
- Implement ephemeral E2E, watcher verdict, and pattern stamping
- Implement workspace persistence, adopt workflow v3, add tripwires
- Introduce AI spend meter, action census, and mod patterns
- Implement Vision v2 Phase 1, enhance onboarding, and improve E2E
- Implement server-side AI key storage and migration
- Implement conflict handling and version parsing
- Implement Nexus-ready mod packaging and zip generation
- Fix canvas interactions test, introduce session handoff
- Implement content-addressed workspace sync and UI safety guards
- Introduce deploy-verify, health card, and robust XML parsing
- Ship validation engine as product, add live telemetry
- Enhance script property and AIScript linting
- Document cue-ref resolver keyword issue
- Document validation gaps and update verification files
- Document tooling validation gaps and new verification file
- Document validation gaps and add tooling files
- Document tooling validation gaps and improvements
- Add X4 CAT file extraction utility
- Prevent NPC save parsing string overflow with large files
- Implement NPC identity probing and correlation
- Document scriptproperty validation gap
- Permit agent API for mod development
- Implement fidelity checks and original file preservation
- Implement live log cue navigation to canvas
- Add AI Influence case study to showcase modding capabilities
- Expose debug watcher API endpoint and documentation
- Implement cue liveness detection in game log watcher
- Rename project to X4 Forge; normalize display names; add canon banner; fix WIP type errors
- Implement comprehensive X4 mod validation framework with cross-file analysis, linting, and byte-faithful deployment syncing.
- Implement initial project structure and add X4 Mod Studio components including WikiBrowser, AIScriptEditor, and diagnostics tools
- Implement LibraryConfigurator component with ID collision and numeric field validation for X4 wares and jobs.
- Implement file-bridge transport layer for MD-side polling and action security validation
- Implement modular component architecture and environment validation workflow
- Define core workspace types and scaffold AI/mod compilation utilities
- Add ModDependencyView and ProjectInspector components to visualize mod ecosystem health and workspace structure.
- Implement deterministic MD semantics registry and add 5 core action definitions
- Update documentation with new CONTRIBUTING guidelines, record P4 host-gate progress, and confirm wares/jobs editing verification.
- Implement external API registry for community mod dependency validation and detection
- Implement ProjectInspector component and add support for external API registry validation
- Ignore generated lint artifacts in .gitignore
- Replace any with unknown/never in server.ts to enforce type safetyRemove unused 'runReferenceDiagnostics' variable
- Replace any-types with domain interfaces and explicit typing in modCompiler and xpathSynth modules
- Improve safety and error handling in UI componentsAdd useCallback for state updaters Refine TypeScript interfaces and types Enhance error handling using messageFromUnknown Add global AgentRuntime declarations
- Introduce UIBuilder component and add Lua runtime log analysis tools
- Add galaxy map view with extension support and e2e perf counters
- Implement core domain models and orchestration architecture for X4 modding studio
- Remove unused file configurations and associated references
- Expose project inspector and validation API
- Add oracle-sweep.mjs script to verify deterministic selftest endpoints
- Add galaxy mapself-test endpoint
- Expose mod dependency graph selftest
- Resolve patch preview truncation and add line count tracking
- Add deterministic spawn offset picker UI and testsAdds deterministic spawn offset picker UI and library. Updates roadmap to mark #63 DONE. Adds Playwright tests.
- Add cue binding UI and security‑aware fetch in main
- Add wares/jobs parser for editable mod round-tripping
- Update roadmap: park #36/#37, mark #38 done, adjust #39/#40 status
- Add interaction utilities and self-test endpoint
- Resolve station and ship macro display names
- Complete live validation of architect loop, confirming intent-gating and model-capability dependencies
- Implement Architect mode with blueprint panel and agent loop
- Add AI assistant cancellation, staged loading states, and key-missing status UI in AIHelper and Sidebar.
- Rename AI assistant branding to FORGE AI ASSISTANT and update roadmap with new tier definitions
- Implement core App structure and AIHelper component for X4 Foundations Mod Studio
- Enforce apply-safe gate with intent requirement validation and unknown tag warnings
- Enforce apply-safe gate with intent requirement validation and unknown tag warnings
- Add tiered AI assistance with gated surfaces and review endpointAdd AI tier state persisted in localStorage and gate all AI UI components behind it; introduce proposal review diff and verdict panel before apply; expose /api/agent/proposal-review-selftest endpoint for synthetic self‑test; update ROADMAP.md with tier definitions and verification status; adjust components to receive aiEnabled prop and conditionally render AI features; new src/lib/proposalReview.ts implements review logic. This provides opt‑in AI surfaces while keeping deterministic behavior and reversible applies.
- Update roadmap with intent-satisfaction verification metrics and action-first UX strategy
- Define AI integration doctrine and phased implementation roadmap with opt-in tiers
- Prune unused Lucide icons and simplify component imports
- Add performance monitoring and mod doctor diagnostics UI components
- Implement X4 object indexing service with localization support and initialize project UI shell
- Add DiagnosticsCenter, resolve localization refs
- Update ROADMAP.md with current implementation notes and session task snapshots
- Fix preset dropdown desync by making select controlled and updating options to reflect active workspace
- Relocate project roadmap to root and formalize git-coordination protocol to resolve metadata contention
- Prevent path traversal with strict containment check
- Replace manual auto‑align with computeAutoLayout
- Implement canvas workspace editor with drag-and-drop nodes, wire routing, and auto-layout support
- Add starter template UI and mod-templates self-test endpoint
- Add compile-selftest endpoint and XML validation layer
- Add curated starter palette for spawn context menu
- Add deterministic graph simulationand branch-body ports
- Add deterministic graph simulation and branch-body ports
- Adjust collapsible panel width and persistent top bar UI
- Add collapsible code panel and diagnostics UI
- Compact toolbar controls to icon-only buttons
- Implement collapsible code panel and visual node diagnostics
- Add deterministic explain, critic, and node-diagnostics endpoints
- AddMD Semantics API for node-style descriptions and curated registry
- User Safety: safe
- Add auto-save synchronization and diagnostics state management Updated App component to lift auto-save state and share it across CodePreview, DiagnosticsHub, and Sidebar. Implemented local state fallback for components when global state is unavailable. Enhanced SyncModal to disable auto-save during file operations. Moved diagnostic states to App level for cross-component consistency.
- Add passthrough file handling and command endpoint
- Add SyncModal component and expose workspace pathsThe SyncModal component offers a UI to synchronize selected workspace and filesystem directories. Updated App now passes modWorkspacePath and filesystemPath props to the new component. Server resolveModFolder logic enhanced to search multiple configured roots for greater flexibility.
- Remove SyncModal component
- Add static Lua analysis library and self‑test endpoint
- Detect restricted lua calls in extension files
- Add contracts workspace view and refactor selftest responses
- Add livefixes API endpoint and refactor cue viewer
- Define core workspace types and node templates for X4 Foundations modding studio
- Drop game-bridge API routes and UI verification
- Add game-bridge API endpoint and UI verification panel Adds server routes for game-bridge status and UI to verify bridge health Enables C2 testing of mods in live game
- Rename project from X4 Mod Studio to X4 Forge throughout README.md
- Rename project to X4 Forge and expose app version
- Add CueLineageTree component and overhaul README documentation
- Integrate AIScriptEditor into the application and add boilerplate setup for App.tsx
- Remove legacy agent scratchpad files and update environment configuration
- Remove simulator state and related imports from AgentBridge
- Implement override analysis engine to detect mod conflicts via xpath and load order simulation
- Update roadmap with deep-research pain-point analysis and refine UI packaging conventions in handoff documentation.
- Refresh Current State for end of Tier 4 build phase
- Ui_event endpoint kind — Lua UI widget → MD cue bridge; Tier 4 complete
- Diff-to-patch — xpathSynth engine + twin-pane UI
- Synthesize X4 XML diff patches
- Cat/dat compression + round-trip oracle — VFS spike complete
- Implement X4 .cat/.dat archive reader with compression support and add diagnostic selftest endpoint
- Integrate full GitHub OAuth device flow, real commit logging, and AI-powered diff summaries into the SourceControl sidebar.
- Override-map drill-down UI in the Extension Doctor — T4.4 complete
- Override-map engine — per-element override claims + load-order winner
- Tier 4 scope (4 levers + increments + build order) and Fable handoff
- Implement X4 UI builder with drag-and-drop designer, LUA script manager, and responsive grid validation.
- Remove unused file and associated references
- Initialize workspace types, compiler logic, and project structure for mod studio
- Implement mod compiler utility for X4 Foundations XML generation and add application entry point.
- Implement visual WYSIWYG UI layout canvas for mod widget placement and Lua descriptor generation
- Implement DiagnosticsHub for integrated MD scanning and playtest workspace management
- Add contract-aware Lua snippet pre-filling and response-shape validation in glue code
- Implement contract handling and Lua snippet integration with new UI component and API endpoints
- Enhance workspace schema validation and template handling - Added strict type definitions for compileSettings with explicit boolean flags for md, ui, ai, library, translations, and patches - Implemented includeInBuild flag for XML patches and template nodes with explicit false default for templates - Introduced passthroughFiles processing with standardized path normalization and reason categorization - Updated template structure to enforce non-compilable status through schema validation - Enhanced security by validating file content types and implementing domain-based filtering
- Define core X4 modding schemas and implement scaffolding for workspace editor components
- Implement visual node-based editor with drag-and-drop canvas, context-aware spawning, and mock simulation system
- Implement searchable object index pickers for node properties and centralize schema directory configuration in settings
- Implement SQLite-based object index caching and add server-side AI request timeouts
- Untrack per-machine config and temp files; document key security model
- Decouple dev servers and implement performance optimizations for large-scale mod rendering and dependency analysis.
- Resolve AI providerpath failures and enhance client-side validation robustness
- Implement reference and runtime-format validation for game objects and time literals
- Implement X4 game log diagnostics with deterministic state modeling and automated source reference mapping
- Implement mod compiler, validator, and core workspace type definitions for X4 modding architecture
- Implement modular workspace import system and new UI components for X4 mod management
- Initialize X4 Foundations Mod Studio project structure with core types and UI components
- Add object browser and compilation modal
- Implement mod folder inspection API for round-trip safety and classification
- Add /api/agent/mod-folder/inspect endpoint to classify files and report round-trip mod safety
- Implement /api/agent/workspace/patch endpoint for granular updates and add AgentBridge UI component for surgical workspace manipulation
- Implement CodePreview component with multi-tab editor, live XML analysis, and file system synchronization
- Implement CodePreview component with multi-file tab management, real-time sync, and diff viewing capabilities
- Implement CodePreview component for workspace visualization, diagnostics, and file management
- Add dry-run workspace validation endpoint and implement optimistic concurrency control for workspace updates
- Implement agent diagnostics endpoint and add AgentBridge UI for surgical workspace modifications
- Integrate AI-driven workspace diagnostics
- Implement initial core UI and project structure for X4 Foundations Mod Studio
- Implement CodePreview component with AI analysis, live diagnostics, and file system synchronization
- Add CodePreview component for workspace visualization, AI analysis, and file management
- Implement CodePreview component for workspace analysis, file editing, and live diagnostic reporting
- Implement CodePreview component for workspace visualization and file management
- Integrate AI helper and expand Sidebar functionality for node-based mission cue analysis
- Implement Sidebar component for mod workspace management and AI integration
- Implement comprehensive Sidebar component with AI integration and schema management features
- Initialize App component with workspace state management, resizable sidebars, and AI integration for X4 Foundations modding
- Initialize core App shell and workspace state management for X4 Mod Studio
- Update roadmap with sidebar visual refactoring and resizing
- Implement Sidebar component for mod workspace management and AI assistance integration
- Implement Sidebar component for mod workspace management and AI-assisted cue editing
- Implement SourceControl component with GitHub integration and local workspace diffing functionality
- Complete Diff-Safe Patch Builder roadmap item with real-time XPath validation, diff previews, and position-aware patch editing
- Add XMLPatchSystem component for managing mod patching and server endpoint for fetching base game content
- Implement core domain models and workspace types for X4 Foundations modding studio
- Add SourceControl component with workspace diffing and local git history management
- Implement modding documentation wiki, code previewer, and playtest workspace components with supporting type and index utilities
- Add feature parity assessment table to roadmap
- Add template library and build control
- Update roadmap to v2, shifting focus from MVP validation to mandatory tool features and X4 IDE requirements.
- Add AgentBridge component for real-time external workspace synchronization and simulation
- Add agent schema contract and workspace compilation utilities to server API
- Add ErrorBoundary component to handle and recover from render-time crashes
- Replace remote auth token fetch with local file or environment variable retrieval
- Implement per-session workspace token authentication and add source control component scaffolding
- Add SourceControl component with git commit history visualization and update documentation
- Implement SourceControl component with git commit history visualization and diff inspection
- Add sidebar components with node management, source control, sync functionality, and error handling
- Implement filesystem API with CRUD operations and directory exploration for mod management
- Implement local filesystem integration with directory explorer and file management components
- Add AgentBridge for external AI orchestration, secure API with session tokens, and enable local-only CORS origin restrictions
- Add DirectoryExplorer, DirectorySettingsModal, and App components to support X4 mod file system navigation and management
- Implement CodePreview component for workspace XML generation, file editing, and project synchronization
- Add mod compiler and code preview component with expanded workspace validation and X4 path configuration
- Implement X4 mod compilation engine and add code preview component
- Add roadmap for X4 Foundations Mod Studio prototype validation
- Add cue navigation and visibility manager
- Integrate source control navigation and checkpoints
- Add source control sidebar tab
- Migrate mod compilation UI to sidebar
- Implement real-time MD script validation
- Add global search and wiki view
- Add Wiki browser and implement canvas culling
- Expand workspace model and UI capabilities
- Implement hybrid flowchart model, md/ path corrections, and multi-folder compiler expansion
- Add Agent API demo client
- Add XSD-driven schema library settings
- Update README.md
- Add TFile translation editor support
- Consolidate API response handling
- Remove AI Studio app instructions from README
- Expand UI builder and script editing capabilities
- Inject workspace context into AI prompts
- Enhance AI integration and support
- Initialize X4 Foundations Mod Studio project
- Initial commit

