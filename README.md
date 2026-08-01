# X4 Forge

X4 Forge is a local visual workbench for building, validating, packaging, and deploying mods for **X4: Foundations**.

It is designed for the part of X4 modding that usually turns into scattered XML files, hand-written Mission Director scripts, XPath guesses, extracted game data, forum archaeology, and trial-and-error in the `extensions/` folder. X4 Forge brings that workflow into one app: visual authoring, schema-aware editing, live diagnostics, package generation, cross-mod conflict checks, GitHub publishing, AI-assisted generation, and an agent API for automation.

The goal is simple: build a real X4 extension inside X4 Forge, compile it, validate it, deploy it, and run it in-game with no manual file surgery.

## For AI agents

If you are an AI agent, start with the document that matches your job:

| Your job | Read |
|---|---|
| **Build a mod** through the Forge | **[AGENT-USING-THE-FORGE.md](AGENT-USING-THE-FORGE.md)** — connect, patch, validate, deploy, prove in-game, plus the seven traps that cost real debugging time |
| Develop the Forge itself | [AGENTS.md](AGENTS.md) (workflow) and [CODEX-ONBOARDING.md](CODEX-ONBOARDING.md) (architecture) |
| Fix a known Forge defect | [ROADMAP.md](ROADMAP.md) § KNOWN BUGS — each entry carries a reproduction |

## What Problems It Solves

X4 modding is powerful, but the normal workflow has sharp edges:

- Mission Director XML is easy to break and hard to visualize.
- XPath diff patches can silently target nothing or the wrong node.
- Game references such as wares, macros, ships, factions, and sounds are hard to discover.
- UI/Lua integration needs exact file placement and engine conventions.
- Several mods can patch the same vanilla file without obvious conflict signals.
- Generated mods often look successful even when the package is incomplete or invalid.
- External AI agents need structured APIs, not screen scraping.

X4 Forge is built around those risks. It treats the local game install, XSD schemas, package manifest, and generated files as the source of truth, then keeps the UI, compiler, diagnostics, and API tied to that evidence.

## Who Should Use It

Use this if you want to:

- Build Mission Director mods visually instead of writing every cue by hand.
- Create and inspect package-ready X4 extension files.
- Validate generated XML against real schemas and local game data.
- Work with X4 UI/Lua, contracts, t-files, wares, jobs, AI scripts, and XML patches from one app.
- Audit your installed mods for conflicts and dependency problems.
- Use AI to draft mod structures while still keeping the output visible and editable.
- Let external tools or agents read, diagnose, patch, compile, or deploy the current workspace through a local API.

This is not a Blender replacement and it does not author 3D assets. It focuses on the X4 extension surface: Mission Director, AI scripts, XML patches, wares/jobs, translations, UI/Lua, contracts, packaging, validation, and deployment.

## Core Workflow

X4 Forge validates this chain:

```text
Author -> Compile -> Validate -> Package -> Deploy -> Run in X4 -> Round-trip
 graph      XML        checks      mod dir   extensions  in-game    import
```

In practice:

1. Configure your X4 paths in **SETTINGS**.
2. Build the mod in the visual editors.
3. Watch diagnostics while you author.
4. Inspect generated XML and package files.
5. Run Mod Doctor, Extension Doctor, and relevant selftests.
6. Sync/deploy the generated extension.
7. Test in X4.
8. Import or round-trip files back into X4 Forge when needed.

## Major Features

### Visual Mission Director Authoring

- Node-based MD canvas for cue structure and logic.
- Schema-driven MD element coverage for a broad MD vocabulary.
- Curated node templates for common events, conditions, and actions.
- Connectors for trigger parents, conditions, actions, and sub-cues.
- Generated `md/<modid>.xml` preview.
- Editable generated XML with parser-backed apply for full MD XML.
- Cue hierarchy previews and selected-node subtree previews.
- Dependency graph and cue-lineage analysis.

Use this when you want to design mission flow visually, then inspect the exact XML the game will receive.

### Validation And Diagnostics

- Real XSD validation against local schema data.
- Semantic validation for references and time formats.
- Package diagnostics before deployment.
- Click-to-navigate diagnostics where supported.
- Cue-lineage checks for missing/dangling structural relationships.
- Mod Doctor for active package health.
- Deterministic Lua rules (in Extension Doctor): djfhe transport hazards, broad `package.path`, and an **X4 UI validator** against the known-working menu configuration — flags a menu that builds a frame but is never opened via `OpenMenu(name)` (so it would never render in-game), and calls to non-existent X4 UI functions (`RegisterLayout`, `AddUITrigger`, `OpenUIFrame`, …).
- `md-audit` and selftest endpoints for quick verification.

The point is not just to generate files. The point is to know whether the generated files are credible before you load the game.

### Game Data And Object Indexing

- Reads local X4 data from loose files and packed `.cat/.dat` archives.
- Handles `.pck` alias resolution and compressed entry decoding.
- Indexes game objects such as ships, macros, wares, factions, and sounds.
- Feeds pickers and reference validation so you do not have to guess IDs.
- Supports base-file resolution for XML patch work.

This turns the installed game into an active reference database.

### XML Patching

- Build X4-standard `<diff>` patches.
- Target real base files from the game install or enabled extensions.
- Validate XPath selectors.
- Detect zero, one, or many XPath matches.
- Preview patch output and applied effects.
- Support add/replace/remove operations and add positions.
- Use diff-to-patch tools to synthesize safer patch operations from edits.

Use this for libraries such as `wares.xml`, `jobs.xml`, and other vanilla file modifications where full-file overrides would be risky.

### Wares, Jobs, T-Files, And AI Scripts

- Author ware and job data as workspace domains.
- Generate translation files under `t/`.
- Work with AI scripts under `aiscripts/`.
- Keep these domains in the package manifest alongside MD, UI, and patches.
- Preserve imported domains where editable graph coverage is not yet complete.

These editors are intended to keep the whole extension in one workspace instead of scattering state across unrelated tools.

### HUD, Lua UI, And Layout Tools

- HUD and Lua UI authoring surface.
- Widget library for common UI elements.
- Layout GUI designer.
- Lua script event manager.
- Syntax-validated Lua editor.
- Responsive grid descriptor bridge for layout compilation.
- Packaged `ui.xml` and Lua entry points where supported.
- Vetted Lua snippet library.
- Generates **real, openable** standalone-menu Lua: the verified `register (Helper.registerMenu) -> OpenMenu(name) -> onShowMenu -> Helper.createFrameHandle -> frame:display()` pattern (the only mechanism X4 actually uses to show a standalone window), with designer buttons wired to `AddUITriggeredEvent` for Lua→MD. No placeholder/invented API. Pattern grounded in the SirNukes Simple Menu API.

The UI/Lua surface is an authoring + packaging workflow whose generated menu code follows the engine's real open mechanism. Runtime widget construction (pixel-level render of the hardest ftable cases) still needs in-game verification.

### Contracts And External Integration

- Define HTTP/JSON contracts between X4-side Lua/MD and an external local process.
- Validate endpoint request and response shapes.
- Generate X4-side glue Lua.
- Generate matching MD scaffolds.
- Support `ui_event` style connections from Lua widgets into MD cues.

X4 Forge owns the X4 side of the integration and the contract. It does not build or host your external service.

### Extension Doctor And Override Analysis

- Scan installed extensions.
- Detect missing dependencies and duplicate IDs.
- Find cross-mod file and selector conflicts.
- Resolve base content from vanilla and extension data.
- Show load-order winners.
- Drill into override claims so you can see which mod rewrites what.

This is for the common problem where a mod is technically valid by itself but behaves differently because another extension wins the same file or node.

### Third-Party API Awareness

Many real extensions depend on community library mods (for example SirNukes' `sn_mod_support_apis` and kuertee's UI extensions) that expose their own Mission Director cues, Lua events, and Lua globals. The game schema knows nothing about these, so the most common silent break is using such an API without declaring its `content.xml` dependency — in-game it simply no-ops.

X4 Forge keeps a curated, loadable registry of these APIs and uses it to:

- Detect when a project uses a known API (heuristic literal-token scan of your MD/Lua).
- Warn when a used API has no `content.xml` dependency declared, including transitive dependencies (for example kuertee depends on `sn_mod_support_apis`).
- Flag Windows-only components (named pipes, hotkeys) and unknown members under a known namespace.

The registry is **data, not code**, so you can extend it without rebuilding:

- Drop a JSON definition in `data/api-registry/` (see `data/api-registry/README.md` and `schema.json`).
- Point `apiRegistryPath` in `config.json` at any folder of definitions.
- Register one at runtime via `POST /api/agent/external-api/register`.
- Or let Forge derive a draft from an installed mod: `GET /api/agent/external-api/derive?ext=<extension_folder>` reads the mod's loose and packed files and returns a starting definition to refine.

This layer is honestly **softer than schema validation** — it is curated, heuristic, and intentionally not exhaustive — so its findings are labelled accordingly (an unknown symbol is informational, never a hard error).

### Logs And Debugging

- Parse X4 debug log text into structured entries.
- Correlate deterministic X4 Forge markers back to cue names.
- Summarize per-cue activity and errors.
- Support backend live log-file tailing.
- Bind log evidence to visual diagnostics where available.

This is meant to reduce the gap between "the XML compiled" and "the mod actually fired in-game."

### Source Control And GitHub

- GitHub device-flow connection.
- Create a repository from the current mod.
- Push generated files.
- Load remote workspace data.
- Show real commit history.
- Generate AI-assisted commit summaries when a provider is configured.
- Use snapshots/version history inside the local workspace.

This helps turn a local mod experiment into something that can be versioned, reviewed, and shared.

### AI Guide

- In-app AI Guide for assistant chat and Builder Action Port generation.
- Supports configured providers such as Gemini, OpenRouter, OpenAI, and Anthropic.
- Generates proposed visual workspaces from natural-language prompts.
- Keeps the generated workspace visible as nodes and XML for inspection.

Builder and Architect generation use the constrained preview route: provider work can use the network and spend the configured AI budget, but the returned workspace remains a proposal until `Confirm & Apply`.

### Agent API

The local API lets external tools inspect and modify the workspace without scraping the UI.

Important routes include:

- `GET /api/agent/schema`
- `GET /api/agent/workspace`
- `POST /api/agent/workspace`
- `POST /api/agent/workspace/merge`
- `POST /api/agent/compile`
- `POST /api/agent/package`
- `POST /api/agent/deploy`
- `POST /api/agent/project/validate/check` (never advances the validation baseline)
- `POST /api/agent/generate/preview` (never applies the generated workspace)
- `POST /api/agent/generate` (legacy apply-capable route)
- Diagnostic and selftest routes under `/api/agent/*`

The in-app **AGENT API** panel documents the routes, shows live state, and exposes surgical workspace operations. It is focused on real agent operations, not demo-only test runs.

## 💡 Case Study: Building "x4 AiLive" (Player2 AI Integration)

To understand the power of X4 Forge, look at **x4 AiLive** (`x4_ai_influence`)—a complex extension that connects X4's live engine to a local **Player2 AI** server for real-time natural language diplomacy and fleet commands. 

Building a mod of this scale using traditional hand-written text editors would result in broken cues, XML syntax crashes, and silent UI failures. X4 Forge turned this ambitious concept into a stable, working reality:

* **Visual MD Cue Mapping:** The intricate dialogue trees, suggestions pre-fetchers, and state-synchronization loops in `ai_influence_conversation.xml` and `ai_influence_chat.xml` were wired visually on the Forge MD canvas. The compiler automatically generated clean XML, preventing syntax and trigger-casing errors.
* **Lua UI & Standalone Menu Compilation:** The custom comm-link panels (`aic_menu.lua` and `aic_uix.lua`) were compiled using Forge's layout compiler, ensuring they registered correctly with the engine's strict `Helper.registerMenu -> OpenMenu` workflow rather than silently failing to render.
* **API Dependency Verification:** The Extension Doctor audited the mod's `content.xml`, verifying load-order priority and flagging required dependencies like `x4_neural_link` (the core bridge) and `djfhe_http` (the HTTP transport library).
* **Deterministic Reference Audits:** When writing the economy and military action executors (`ai_influence_contract.xml`), X4 Forge checked all ware, faction, and macro IDs against the game's actual unpacked assets, catching misspelled references (like `energy_cells` instead of `energycells`) before launch.
* **Real-time Log Correlation:** When debugging the HTTP response loop, the developer tail-correlated X4's runtime debug logs back to the visual canvas cues, tracing exactly where transaction payloads were parsed or rejected.

---

## Quick Start

### Requirements

- Windows is the primary target environment.
- Node.js and npm.
- A local X4: Foundations install.
- Optional: extracted X4 schemas if you want to point directly at schema files.
- Optional: AI provider key for AI Guide generation.
- Optional: GitHub OAuth app client ID for GitHub integration.

### Install

```powershell
npm install
```

### Run X4 Forge

On Windows, the easiest route is:

```text
restart-studio.bat
```

To run the **built app** (one server, no dev tooling/watchers — builds on first run):

```text
START-X4FORGE.cmd
```

Or run the servers directly:

```powershell
npm run dev:api
npm run dev:web
```

Default local addresses:

- UI: `http://localhost:3000`
- API: `http://127.0.0.1:3001`

The Vite UI proxies `/api` calls to the API server.

### Configure Paths

Open `http://localhost:3000`, then use **SETTINGS** to configure:

- X4 game path
- XSD schema path
- Mod workspace path

The app writes machine-local paths to `config.json`. That file is gitignored.

You can also start from:

```powershell
copy config.example.json config.json
```

Then edit `config.json` by hand if needed.

## How To Use The App

### 1. Start With A Workspace

Use a blank workspace, a preset, an imported workspace, or AI-assisted generation.

Set basic metadata such as:

- Mod name
- Version
- Author
- Description

The mod name becomes the basis for generated file names and package IDs, so keep it stable once you start packaging.

### 2. Build Mission Logic

Use **MD Scripts** and the node canvas to create:

- Cues
- Events
- Conditions
- Actions
- Sub-cues
- Signal/listen relationships

Use the generated XML preview to inspect what the graph compiles into.

### 3. Add Supporting Domains

Use the other tabs as needed:

- **AIScripts** for pilot behavior scripts.
- **Wares & Jobs** for economy and job data.
- **HUD & LUA UI** for UI widgets, Lua code, and layout work.
- **XML Patching** for safe vanilla file modifications.
- **Contracts** for X4-to-external-process integration.
- **Languages (t/)** for translation strings.
- **X4 Wiki** and object/reference tools for lookup.

### 4. Validate Continuously

Watch:

- Compiler status
- Mod Doctor diagnostics
- Schema validation
- Reference validation
- Cue-lineage signals
- Patch selector checks
- Extension Doctor findings

Treat a green UI as a useful signal, not a substitute for in-game testing. The final authority for runtime behavior is still X4.

### 5. Inspect Generated Files

Use the code preview and package views to inspect generated artifacts such as:

- `content.xml`
- `md/<modid>.xml`
- `aiscripts/*.xml`
- `libraries/*.xml`
- `t/0001-l044.xml`
- `ui.xml`
- `ui/*.lua`
- README/package metadata

### 6. Package Or Deploy

Use compile/package/deploy flows to create the extension file manifest and write it to the configured target. If deploying to the live X4 `extensions/` folder, confirm the generated mod folder is clean and contains the expected `content.xml`.

### 7. Test In Game

Launch X4, enable the extension if needed, and verify:

- The extension loads.
- The cue or UI behavior actually triggers.
- Logs show expected markers.
- No runtime errors appear in the debug log.

If runtime behavior fails, use X4 Forge diagnostics, generated XML, and log correlation to narrow the problem.

### 8. Round-Trip When Needed

Import existing workspace JSON, MD XML, or package files when you need to inspect or revise existing work. Round-trip support is strongest for MD and preserved package domains; editable graph breadth for every domain is still an active roadmap item.

## AI Provider Setup

AI is optional. X4 Forge works as a visual authoring and validation app without it.

You can configure keys in either place:

1. In the app through **AI ENGINE** / provider settings.
2. In `.env.local`.

To use `.env.local`:

```powershell
copy .env.example .env.local
```

Then fill only the providers you use:

```env
GEMINI_API_KEY=""
OPENROUTER_API_KEY=""
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
```

Restart X4 Forge after changing `.env.local`.

## GitHub Setup

GitHub integration is optional.

To enable one-click GitHub connection:

1. Create a GitHub OAuth App.
2. Enable Device Flow.
3. Put the client ID in `.env.local`:

```env
GITHUB_CLIENT_ID=""
```

The client ID is public, but it is still machine-specific configuration, so it stays out of the repository.

## Local Security Model

X4 Forge is built for local development, but it still protects keys and privileged routes.

| Location | Purpose | Committed? |
|---|---|---|
| `.env.local` | Provider keys, GitHub client ID, optional stable studio token | No |
| Browser localStorage | Keys entered in the in-app provider modal | No |
| `.studio-api-token` | Local API bearer token | No |
| `config.json` | Machine-local game/schema/workspace paths | No |

Runtime behavior:

- The API binds locally.
- Privileged `/api/*` routes require a bearer token. The explicitly allowlisted read-only schema,
  reference, diagnostic, and selftest GETs are public on localhost and are inventoried by the route audit.
- The browser receives the token during local startup.
- Provider keys in `.env.local` are reserved for app-origin requests.
- External agents must provide their own AI key through `x-custom-api-key`.
- Keys are sent only to the selected provider endpoint.

If the server restarts and API calls start returning token errors, reload the browser page so it repeats the token handshake.

## Agent API Basics

The API is for real automation: external tools can read state, compile, package, deploy, and write workspace changes.

Use the bearer token from `.studio-api-token`:

```powershell
$token = Get-Content .studio-api-token -Raw
$clientId = "client_powershell_$(Get-Random)"
$registryHeaders = @{
  Authorization = "Bearer $($token.Trim())"
  "x-client-id" = $clientId
}
$registry = Invoke-RestMethod -Uri "http://localhost:3000/api/agent/workspaces" -Headers $registryHeaders
$workspaceId = $registry.defaultWorkspaceId
$headers = @{
  Authorization = "Bearer $($token.Trim())"
  "x-client-id" = $clientId
  "x-workspace-id" = $workspaceId
}
Invoke-RestMethod -Uri "http://localhost:3000/api/agent/workspace" -Headers $headers
```

For AI generation from an external script, include your own provider key:

```powershell
$token = Get-Content .studio-api-token -Raw
$clientId = "client_powershell_$(Get-Random)"
$registryHeaders = @{ Authorization = "Bearer $($token.Trim())"; "x-client-id" = $clientId }
$registry = Invoke-RestMethod -Uri "http://localhost:3000/api/agent/workspaces" -Headers $registryHeaders
$headers = @{
  Authorization = "Bearer $($token.Trim())"
  "x-client-id" = $clientId
  "x-workspace-id" = $registry.defaultWorkspaceId
  "Content-Type" = "application/json"
  "x-ai-provider" = "openrouter"
  "x-ai-model" = "deepseek/deepseek-chat"
  "x-custom-api-key" = "<your-provider-key>"
}
$body = @{ prompt = "Create a patrol mission with a reward cue."; apply = $false } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/agent/generate/preview" -Headers $headers -Body $body
```

The in-app **AGENT API** panel contains route examples and live state.

`GET /api/agent/schema` also returns the additive `forge.capability.v1` contract: stable capability IDs,
descriptor versions, minimum input/output schemas, effects, access, constrained API bindings, and honest
`connected` / `partial` / `disconnected` surface projections. The hash covers the canonical contract payload;
metadata describes current enforcement but does not grant authority. Inspect it without starting the UI:

```powershell
npm run capabilities -- --json
npm run capabilities -- project.validate --json
```

Unknown capability IDs or descriptor versions are refused. MCP keeps its curated tool inventory, narrows it
monotonically to compatible live `id@version` descriptors, fails closed on a malformed current contract, and uses
the static inventory only before a valid current contract has established authority. Its tool surface advertises
and emits list-change notifications under the
[2024-11-05 MCP tools contract](https://modelcontextprotocol.io/specification/2024-11-05/server/tools); it does
not emit annotations introduced in later protocol revisions.
POST analysis descriptors disclose that Agent History writes audit rows/blobs and may rotate its oldest retained
segment even when the primary project/workspace operation is non-mutating.

Route/capability exposure changes use a two-step reviewed manifest flow. Generation cannot update the tracked
manifest, and promotion requires the exact reviewed candidate hash:

```powershell
npm run test:capabilities -- --generate-candidate
# Review test-results/forge-route-dispositions.candidate.json against config/forge-route-dispositions.json.
npm run test:capabilities -- --promote-candidate <reviewed-sha256>
```

The manifest also locks a normalized signature of the complete curated MCP module, not only the ten parsed tool
entries. Any MCP source change therefore requires an explicit MCP audit-version bump before promotion, while each
tool must still map to the exact declared capability `id@version` and HTTP method/path set.

## Standalone CLI Validation

The full deterministic validation stack (structure, cross-file cues, MD↔Lua event wiring,
md.xsd + aiscripts.xsd, order-param lint, scriptproperty chains) runs without the UI:

```powershell
npm run validate:mod -- "F:\path\to\your\mod_folder"
npm run validate:mod -- "F:\path\to\your\mod_folder" --json
```

Exit code 0 = valid, 1 = validation errors, 2 = usage/load failure — CI-friendly. The same
verdict is available over the constrained API without inlining every file:
`POST /api/agent/project/validate/check { "fromPath": "<mod folder name>" }` (resolved inside the configured mod workspace /
extensions roots). Game-object reference checks (macros/wares/factions) need the Forge's
object index and run only in the app, so the standalone CLI projection is explicitly marked partial in the
capability contract.

## Common Development Commands

```powershell
npm install
npm run dev
npm run dev:api
npm run dev:web
npm run build
npm run start
npm run lint
npm run clean -- --dry-run
npm run clean
```

Notes:

- `npm run dev` starts the API watcher.
- `npm run dev:web` starts the Vite UI.
- `restart-studio.bat` is the normal Windows launcher for the split local setup and explicitly enables the
  authenticated host-tool command routes. Bare `npm run dev`, `npm run dev:api`, and `npm start` leave those
  arbitrary-command routes absent unless `FORGE_ALLOW_RUN_COMMAND=true` is deliberately supplied.
- `npm run build` builds the frontend and bundled server output.
- `npm run lint` runs ESLint over the shipped server and web source; `npm run typecheck` runs `tsc --noEmit`.
- `npm run clean -- --dry-run` previews reproducible build/package/test output only; `npm run clean`
  removes that output without touching dependencies, configuration, runtime state, corpus caches,
  graphs, source, or tracked evidence.

## Project Files

- `src/` - React app, components, types, and client-side logic.
- `server.ts` - local API server, package/build endpoints, diagnostics, selftests.
- `BACKLOG.md` - open specified and in-progress work only.
- `ROADMAP.md` - append-only verified delivery history.
- `SESSION-HANDOFF.md` - the current working-state transfer at commit points and session close.
- `HANDOFF.md` - full onboarding for contributors and coding agents.
- `config.example.json` - path configuration template.
- `.env.example` - environment variable template.
- `restart-studio.bat` - Windows launcher for the local X4 Forge setup.

## Current Known Caveats

- Final in-game behavior still needs X4 verification. X4 Forge can prove a lot about structure, schema, and packaging, but it cannot honestly certify runtime behavior without the game.
- Some domains round-trip as preserved package data before they become fully editable graph models.
- Runtime Lua UI construction is powerful but still needs careful in-game verification for advanced ftable/widget patterns.
- The app is a local development tool, not a hosted multi-user service.

## Why Use It

Use X4 Forge because it compresses the hard parts of X4 text-mod development into one visible loop:

- You can author visually.
- You can inspect the generated files.
- You can validate against schemas and local game data.
- You can detect package and cross-mod problems earlier.
- You can use AI without hiding the result.
- You can automate through a structured local API.
- You can deploy with a clearer idea of what will land in `extensions/`.

The selling point is not that it writes XML for you. The selling point is that it makes the modding chain visible, testable, and repeatable.
