# X4 Forge

**Build serious X4: Foundations mods without turning your project into a maze of disconnected XML files, hand-written XPath guesses, deployment scripts, and repeated in-game failures.**

X4 Forge is a visual modding studio and IDE extension built specifically for **X4: Foundations**. It brings the parts of X4 mod development that normally live across text editors, schema folders, unpacked game files, command-line scripts, debug logs, and the `extensions/` directory into one connected workspace.

You can design Mission Director logic visually, edit real XML with X4-aware completion, inspect existing mods as navigable graphs, build safe diff patches against the actual game corpus, validate an entire project before it reaches the game, package releases, deploy with rollback protection, and trace runtime evidence back to the source that produced it.

The goal is not to hide X4 modding behind a toy interface. The goal is to give modders a professional authoring environment where the generated files remain visible, editable, explainable, and under their control.

> **Author → Validate → Package → Deploy → Prove in X4 → Iterate without losing work**

## Get X4 Forge Studio

X4 Forge Studio is available as a VS Code-compatible extension through Open VSX:

**[Install X4 Forge Studio](https://open-vsx.org/extension/x4forge/x4-forge-studio)**

The extension runs the Forge backend locally and opens the full Studio inside the editor. Your projects, game files, validation data, credentials, and generated artifacts remain on your machine.

Windows is the primary supported environment because X4 itself, its installation layout, and the current deployment workflow are Windows-focused.

---

## What X4 Forge Can Do

### Build Mission Director logic visually

Mission Director scripts can become difficult to reason about once cues, conditions, actions, loops, signals, and sub-cues spread across a large file. X4 Forge turns that structure into a navigable graph without taking the XML away from you.

- Create and connect cues, events, conditions, actions, branches, loops, and sub-cues.
- Navigate cue hierarchy, lineage, dependencies, and signal relationships.
- Switch between a full-project graph and individual MD files.
- Inspect and edit the generated XML at any time.
- Import large existing mods into complete graph lanes instead of collapsing whole cues into opaque placeholders.
- Preserve unsupported or extension-defined elements as localized raw XML nodes at their real position in the graph.
- Apply guarded selected-node edits while refusing stale, reparented, or out-of-scope mutations.

The graph is not a separate simplified representation. It is tied to the source and designed to round-trip without quietly rewriting unrelated content.

### Edit XML with knowledge of the actual game

A normal XML editor understands XML. X4 Forge is designed to understand **X4 XML**.

- Load X4 schemas from the configured game or unpacked corpus.
- Complete legal child elements, attributes, enums, and typed script-expression chains.
- Suggest canonical factions, wares, sectors, macros, jobs, and AI scripts.
- Show hover documentation, types, provenance, and near-match suggestions.
- Preserve the exact capitalization of project-defined identifiers.
- Validate effective base-game and DLC documents instead of pretending every file exists in isolation.
- Surface findings in the Studio, native editor diagnostics, and the IDE Problems panel.

The local X4 installation becomes a live reference source rather than a folder you manually grep whenever you forget an identifier.

### Create safe XML diff patches

X4's diff system is powerful, but a selector that matches nothing—or matches too much—can fail silently or damage far more than intended. The XML Patching workbench makes those operations inspectable before they become mod files.

- Target real files from the base game, official DLC, and configured extensions.
- Build add, replace, and remove operations using parsed XML rather than regex over source text.
- Validate XPath selectors and report zero, single, or ambiguous matches.
- Preview the effective document before and after the patch.
- Convert edited candidates into X4-standard diff operations.
- Keep base files, edited candidates, revisions, and generated patches locked to the same target.
- Run multi-operation numeric bulk transforms across bounded corpus paths.
- Simulate every emitted patch before applying anything.
- Reject stale plans, path traversal, invalid selectors, nonnumeric matches, conflicts, and partial bundles.
- Apply accepted changes atomically with checkpoints and Undo.

This makes large rebalance work possible without turning one bad selector into hundreds of broken files.

### Work across the rest of the X4 extension surface

X4 Forge is not limited to Mission Director.

It supports project domains including:

- AI scripts under `aiscripts/`
- Wares and jobs
- Translation files under `t/`
- XML patches and library changes
- HUD and Lua UI work
- Layout and widget authoring
- Contracts between X4-side Lua/MD and local services
- Package metadata and `content.xml`
- Data-only extensions that do not need a fake MD cue

The project manifest keeps these domains together so a real extension can be compiled and packaged as one coherent project rather than maintained through unrelated tools.

### Build real X4 UI and Lua integration

X4 UI work is unforgiving: a script can parse correctly, create a frame, and still never appear because the registration or opening sequence is wrong.

X4 Forge includes:

- Lua editing and syntax checks
- A HUD and UI authoring surface
- A widget library and layout tools
- Lua event management and MD↔Lua binding checks
- Packaging for `ui.xml` and Lua entry points
- Validation for known X4 UI lifecycle mistakes
- Generation based on the real standalone-menu sequence: register the menu, call `OpenMenu`, build the frame in `onShowMenu`, and display it

The Forge does not claim that static checks replace running X4. It shortens the distance between "this code looks valid" and "this menu actually opens in-game."

### Validate the whole project, not just the file you are looking at

Many expensive X4 defects are legal XML. A cue references something that does not exist. A Lua event has no listener. A patch selects zero nodes. A file is valid by itself but incompatible with the package around it.

X4 Forge combines multiple deterministic checks:

- XML well-formedness
- XSD validation
- X4 reference and identifier validation
- Script-property and expression checks
- Cue-lineage and cross-file checks
- MD↔Lua event and payload analysis
- Package completeness checks
- Patch simulation and selector analysis
- Installed-extension dependency and override analysis
- Bounded parsing for large or hostile XML and catalog inputs

Diagnostics can explain **why** a finding exists, what it is likely to break, and what action is available. Validation also tracks changes from the last accepted green result so you can distinguish new warnings from existing debt.

When an exception is genuinely intentional, Forge supports narrowly scoped, accountable suppressions tied to the exact code, file, and source—with an owner, reason, and review date. It does not turn suppression into a global "ignore this class of problem" switch.

### Inspect installed mods and find conflicts

A mod can be correct on its own and still behave incorrectly because another extension wins the same file, selector, or dependency relationship.

Extension Doctor can:

- Scan installed extensions
- Detect duplicate extension IDs and missing dependencies
- Resolve base content through vanilla, DLC, and extension layers
- Identify file and selector conflicts
- Show load-order winners
- Inspect override claims and competing patches
- Track curated third-party API definitions that the vanilla schema cannot describe

Third-party API awareness is intentionally softer than schema validation. Curated or heuristic findings are labelled accordingly rather than presented as certainty.

### Package and publish releases with evidence

Forge treats release packaging as a controlled build, not a folder zip.

- Build complete disk-backed projects.
- Reopen and verify generated artifacts.
- Produce install-root ZIPs for Nexus Mods.
- Prepare Steam Workshop staging with CAT/DAT output, metadata checks, preview requirements, rollback archives, and the exact WorkshopTool handoff.
- Keep first-publish and update workflows distinct.
- Verify returned Workshop identity before adopting it into the project.
- Preserve independent hashes for produced artifacts.

Forge does not upload, accept legal prompts, or press Enter on your behalf. It prepares the release, proves what it built, and keeps the irreversible steps visible to you.

### Deploy without gambling with the current installation

Deployment is where a development tool can do the most damage, so Forge is deliberately conservative.

- Preview the exact add, overwrite, delete, and preserve plan before writing.
- Validate the complete project first.
- Deploy loose files or supported CAT/DAT output.
- Apply changes atomically when possible.
- Maintain verified backups and exact rollback paths.
- Skip byte-identical locked files so normal iterations can continue while X4 is running.
- Fail loudly when a changed locked file cannot be replaced.
- Clean abandoned transaction folders that could otherwise appear as duplicate extensions.
- Retain a hash-bound recovery for the previous verified deployment.
- Refuse recovery when later changes make it unsafe.

A failed or dry-run deploy does not advertise an Undo that does not exist.

### Debug what happened after the files reached X4

Compilation is not proof that a cue fired or a script behaved correctly. X4 Forge includes runtime-oriented tools to reduce that gap.

- Tail and parse X4 debug logs.
- Separate engine-shaped failures from mod-authored diagnostic text.
- Correlate known markers and source references.
- Summarize active issues and cue activity.
- Generate proof artifacts for a project.
- Keep deployment and validation evidence attached to the workspace that produced it.

The game remains the final authority for runtime behaviour. Forge is built to make that authority easier to observe and connect back to source.

### Keep multiple projects separate and recoverable

X4 Forge supports independent workspaces with server-owned identities. Two projects with the same display name are still distinct, and one Studio tab cannot silently inherit whichever project another tab used most recently.

- Create, park, restore, and switch workspaces.
- Keep validation baselines, agent keys, action history, compilation, packaging, and recovery scoped to the correct workspace.
- Show both sides of a write conflict with timestamps, content heads, changed-file counts, and bounded diffs.
- Create an Undo checkpoint before adopting another copy.
- Create bounded recovery before overwriting server state.
- Refuse missing or mismatched workspace authority instead of guessing.

This is particularly important when human editing, IDE buffers, the Forge canvas, and external agents can all touch the same project.

### Use AI without surrendering authority

The in-app AI Guide can use configured providers to propose project structures and builder actions from natural language.

- Generated work remains visible as nodes and XML.
- Preview routes do not apply the workspace.
- Builder and Architect results remain proposals until **Confirm & Apply**.
- Deterministic validation still judges the output.
- Provider use can consume network access and the configured AI budget, but it does not replace the project's source-of-truth checks.

AI can help draft. It does not get to quietly redefine what a valid X4 mod is.

### Let coding agents use the Forge as a tool

X4 Forge exposes a local, scoped Agent API for tools that need more than screen scraping.

Agents can inspect schemas, references, capabilities, workspaces, validation results, files, compilation state, package plans, deployment plans, history, and selected guarded mutation surfaces.

The API includes:

- Scoped, expiring agent keys
- Explicit read, write, and deploy authority
- Machine-readable status and capability discovery
- Validation and preview routes that do not mutate state
- Compare-and-swap guards for stale writes
- Action history with readable summaries and file effects
- Revert and recovery paths where the operation can be made safe
- Exact route and capability contracts for CLI, CI, and MCP-oriented integrations

For an agent building a mod through the Forge, start with **[AGENT-USING-THE-FORGE.md](AGENT-USING-THE-FORGE.md)**.

---

## Why Use It Instead of a Normal Editor?

A normal editor is excellent at editing text. X4 Forge is built around the entire modding chain.

With a conventional workflow, you often have to answer these questions yourself:

- Is this identifier real in my installed game version?
- Does this XPath match the effective DLC-overlaid document?
- Did this file survive packaging?
- Did deployment remove something I did not own?
- Did the current Studio tab act on the project I thought it did?
- Is this warning new, or was it already present in the last known-good build?
- Did the game reject the file, or did the cue simply never fire?
- Can I undo this agent-written change without overwriting newer work?

X4 Forge is valuable because it makes those questions part of the tool instead of leaving them as personal rituals that every modder has to rediscover.

It does not promise that X4 modding becomes effortless. It makes the work **visible, testable, repeatable, and substantially harder to destroy by accident**.

---

## What X4 Forge Does Not Do

X4 Forge is not a 3D modelling suite and does not replace Blender or asset-creation tools.

It does not guarantee that schema-valid code behaves correctly in-game. X4 runtime testing is still required.

It does not automatically trust generated code, AI output, community API guesses, or a green HTTP response. Mutations are judged against project state, schemas, reference data, validation rules, and read-back evidence where available.

It does not require unrelated gameplay mods or transport extensions. X4 Forge is its own development tool; the mods you create or inspect are separate projects.

---

## Core Workflow

```text
Author
  ↓
Inspect the generated source
  ↓
Validate the complete project
  ↓
Build and verify the package
  ↓
Preview deployment effects
  ↓
Deploy with recovery protection
  ↓
Run and prove the behaviour in X4
  ↓
Bring the evidence back into the next edit
```

A typical session looks like this:

1. Configure the X4 installation, schema/corpus, workspace, and deployment paths.
2. Create a project or load an existing extension.
3. Work visually, in the Forge code surfaces, or directly in the native IDE editor.
4. Use completion, reference lookup, diagnostics, and project validation while editing.
5. Inspect generated and preserved files before packaging.
6. Run package diagnostics and Extension Doctor where relevant.
7. Preview deployment and resolve any stale workspace or conflict state.
8. Deploy, test in X4, and inspect runtime evidence.
9. Commit the project when the evidence matches the intended behaviour.

---

## Quick Start for Users

1. Install **[X4 Forge Studio from Open VSX](https://open-vsx.org/extension/x4forge/x4-forge-studio)** in VS Code, Antigravity, or another compatible editor.
2. Open a trusted local workspace.
3. Run **X4 Forge: Open Studio** from the Command Palette or use the X4 Forge activity-bar view.
4. Open **Settings** and point the Forge at your X4 installation, mod workspace, and reference/schema data.
5. Create a project or load an existing mod folder.
6. Validate before the first deploy.

The extension can also:

- Open a mod folder in the IDE workspace
- Create scoped agent keys
- Copy MCP configuration for coding agents
- Refresh project agent briefs
- Generate a proof artifact
- Check installed-mod conflicts
- Show or stop the managed backend sidecar

Workspace Trust is required because Forge compiles projects, writes local files, and can deploy into the game installation.

---

## Running the Repository Locally

### Requirements

- Windows
- Node.js and npm
- A local X4: Foundations installation for real corpus and deployment testing

Optional integrations include an AI provider key for AI Guide features and GitHub authentication for repository operations.

### Install dependencies

```powershell
npm install
```

### Start the development environment

```powershell
restart-studio.bat
```

Or run the services directly:

```powershell
npm run dev:api
npm run dev:web
```

### Build the production application

```powershell
npm run build
npm run start
```

### Useful validation commands

```powershell
npm run typecheck
npm run lint
npm run test:routes
npm run test:oracles
npm run test:e2e
npm run test:reference-corpus
npm run test:schema-intelligence
npm run test:artifact-pipeline
```

Additional focused checks live under `scripts/`, `tests/`, and `vscode-extension/scripts/`.

Machine-local paths belong in `config.json`, which is ignored by Git. Start from `config.example.json` when configuring a repository checkout manually.

---

## For Contributors and Agents

Use the document that matches the job:

| Job | Start here |
|---|---|
| Build an X4 mod through the Forge | **[AGENT-USING-THE-FORGE.md](AGENT-USING-THE-FORGE.md)** |
| Develop X4 Forge itself | **[AGENTS.md](AGENTS.md)** and **[CODEX-ONBOARDING.md](CODEX-ONBOARDING.md)** |
| Review current implementation history | **[ROADMAP.md](ROADMAP.md)** |
| Find genuinely open work | **[BACKLOG.md](BACKLOG.md)**, reconciled against current code and release records |
| Inspect user-facing changes | **[vscode-extension/CHANGELOG.md](vscode-extension/CHANGELOG.md)** |

Repository documents contain a long implementation history. When an old backlog entry conflicts with shipped code or release evidence, verify the current implementation before rebuilding anything.

---

## Technology

- React 19
- TypeScript
- Vite
- Express
- CodeMirror 6
- SQLite through `better-sqlite3`
- X4 XSD and corpus-backed analysis
- Playwright end-to-end testing
- VS Code-compatible extension host and webviews

Everything runs locally. No hosted Forge service is required.

---

## Project Status

X4 Forge Studio is publicly distributed and actively developed. It has moved well beyond an early visual-editor prototype into a broad X4 authoring, validation, packaging, deployment, recovery, and automation environment.

The project still treats real installed-host tests and in-game evidence as necessary gates. Features can be implemented and pass isolated tests while remaining unpublished when the packaged IDE experience does not meet the same standard.

That distinction is deliberate: **working in the repository is not automatically the same as proven in the product.**

---

## License

MIT
