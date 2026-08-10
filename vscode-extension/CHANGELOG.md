# What's New in X4 Forge Studio

The latest changes, newest first. (This page is generated automatically — see
`release-notes.json` to edit the wording.)

## 0.0.69 — 2026-08-09

- Agents can now retrieve the addressed mod-aware runtime debugger through the authenticated Agent API (GET /api/agent/runtime-debugger) or the runtime_debugger MCP operation without opening a browser or using computer control. The read is governed by the runtime.debug.read@1 capability and exact route and effect authority.
- Runtime evidence is bound to immutable workspace ownership and the exact authorized capability and effect, so a display-name match or differently addressed mod cannot redirect the response.
- The debugger returns bounded session and verdict state: coverage, expected steps, and incidents stay finite and explicit, with observed, missing, unavailable, excluded, ambiguous, and unknown evidence kept distinct.
- Each confirmed incident includes a deterministic cause, likely impact, and next bounded action, with navigation to the confirmed deepest Forge node or exact source file and line when that mapping exists.
- Evidence from unrelated mods is excluded from the addressed mod's results. Shared paths, collisions, incomplete ownership, and other ambiguous matches remain unresolved instead of being guessed.
- MCP responses enforce bounded result and context caps, redact the user-home prefix in returned paths, and do not expose the complete game log or accept arbitrary log-path reads.
- The runtime debugger is local and deterministic: it does not use AI to decide authority, interpret success, or replace the evidence rules.
- Historical sessions and unavailable or incomplete evidence remain labeled as such; the debugger does not turn missing observations into a clean verdict or claim that gameplay semantics are correct.

## 0.0.68 — 2026-08-09

- The runtime watcher is back to a compact at-a-glance hierarchy: confirmed active-mod issues lead, authored activity is clearly separate, and cause, impact, evidence, session, coverage, and timeline details stay available through progressive disclosure.
- Selecting a confirmed incident row now highlights the deepest mapped Forge Mission Director XML node; when no canvas node exists, Forge opens the exact active-workspace Lua or other source line in the native IDE. Ambiguous ownership never triggers a guess.
- Deterministic authored-emitter provenance traces real tagged activity to its exact source emitter, excludes uniquely identified emitters from other mods, and keeps collisions or no-match cases explicitly unresolved.
- A uniquely correlated installed copy now merges into the active workspace authority even when bounded inventory is incomplete; genuine collisions remain ambiguous.
- Confirmed active engine failures are retained and stay prioritized above later routine diagnostic noise, including failures observed during startup after a restart.
- Corrected debugger policies can safely reanalyze derived state without changing source logs, mod files, or game files.
- Tagged routine diagnostics remain informational, while governed genuine exact file-and-line runtime faults continue to appear as errors.
- Copyable UI paths now redact the user-home prefix for readable sharing while Forge preserves the exact machine path internally.
- Zero-evidence and coverage gaps stay visible and bounded: unavailable evidence is reported as unknown or not observed rather than a clean result or inferred success.
- Silent gameplay semantics remain explicitly unproven; runtime diagnostics show observed Forge evidence without claiming gameplay correctness or complete detection.

## 0.0.67 — 2026-08-09

- Runtime debugging now identifies the active mod from immutable workspace identity, content metadata, deployed-folder identity, owned files, and real X4 paths, so a display-name change cannot silently move evidence to the wrong project.
- The log watcher ingests incrementally into bounded persistent session state. Attributable incidents remain available after later log traffic exceeds 256 KiB and after the local sidecar restarts, without persisting the complete game log.
- Evidence from unrelated extensions is excluded from the active-mod incident list while its count and attribution state remain visible. Shared paths, ownership collisions, and alias-only matches are reported as ambiguous or unknown instead of being guessed.
- Direct extension paths, Mission Director script and cue contexts, AI-script contexts, and Lua paths or stack frames resolve to an exact file and line and, when source spans exist, the deepest modeled node. Unsupported node mappings fall back to the exact file and line.
- Each known incident now includes a deterministic cause, likely impact, next bounded action, and supporting evidence or provenance, so the debugger explains what it knows and what it cannot establish.
- Engine failures are separated from authored diagnostics, including error-channel text, and from FileIO or other log noise. Authored evidence remains informational or explicitly unknown rather than becoming an engine failure by wording alone.
- Zero matches, unreadable logs, and unavailable evidence no longer appear as a clean runtime result. The session reports no evidence, not seen, or unknown when that is what the available data supports.
- Log truncation, rotation, and X4 profile or path changes create named session segments without erasing retained incidents. Current deploy baselines are kept separate from historical evidence, so an old line cannot satisfy a new deploy verdict.
- Declared runtime cues and markers now report observed, missing, or evidence-unavailable against the current segment. Missing or unavailable expected steps never become an inferred success.
- Repeated equivalent incidents collapse into bounded records with occurrence counts and first and last evidence, while coverage accounting keeps recognized, excluded, ambiguous, and unknown candidates visible.
- The debugger operates locally and deterministically without requiring an AI service. It reports bounded runtime evidence rather than claiming complete detection, gameplay correctness, or certainty about silent semantic failures.

## 0.0.66 — 2026-08-08

- The marketplace page now explains the complete authoring loop: build Mission Director logic visually or edit native XML, then validate, package, deploy, and connect runtime evidence back to source.
- X4-aware completion, hover, references, and whole-project diagnostics are described in modder terms, including deterministic Why/provenance and the boundary between Forge's reference data and X4 runtime behaviour.
- Patch and release workflows are easier to find: preview safe diff patches and bulk transforms, inspect Extension Doctor conflicts, and prepare verified Nexus Mods ZIPs or Steam Workshop staging with rollback protection.
- The extension launcher and Features metadata now describe the existing Studio, backend, workspace, agent, proof, and conflict actions in plain language without changing their commands or runtime behaviour.
- Setup and privacy guidance now clearly covers trusted workspaces, Node.js, a local X4 installation, local-first operation, and optional provider-backed AI that is off by default.
- The stable extension is now version 0.0.66 with corrected UTF-8 metadata. Static validation still cannot prove gameplay intent, and Forge does not upload releases or provide X4.

## 0.0.65 — 2026-08-07

- Agent actions now use exact route and effect authority, so Forge checks that the requested operation, target, and result are covered before it changes a workspace.
- Workspace replace, merge, create, snapshot restore, and bulk-apply operations now leave durable, deterministic mutation receipts. Safe retries replay the original result instead of applying a change twice, while conflicts and failed writes keep rollback and recovery bounded.
- Bulk transforms now follow one canonical plan and recheck both the planned inputs and their paired workspace state at the write boundary, so newer or mismatched files cannot be transformed silently.
- X4 diff and schema validation now use merged routing across the complete 9.00 reference corpus, keeping shared definitions and domain-specific checks aligned for real project files.
- Validation rules now expose governed, deterministic provenance. Open Why to see the rule behind a result, the evidence it used, the likely impact, and the next bounded action.
- Lua registration analysis is Unicode-safe, so event names and other non-ASCII identifiers remain intact during cross-file checks instead of being misread or mangled.
- Script-property validation now follows nested datatype paths and inheritance, catching impossible deep references without guessing when selector types are unavailable.
- Multi-tab Studio sessions retain the correct sidecar and workspace binding across refreshes and reconnects, and busy-sidecar recovery no longer makes one tab take over another tab's project.
- Continuous polling now checks for newer local edits before adopting an update, preserving work made in Studio while polling is in progress.
- Broader stability and containment hardening keeps concurrent work, recovery, process cleanup, and malformed-input failures bounded, with rejected work prevented from crossing workspace or process boundaries.
- Stable Forge releases now generate clean release notes deterministically, keeping the version shown to users aligned with the capabilities in the package.

## 0.0.63 — 2026-07-31

- Each Studio tab now binds to an immutable workspace identity instead of whichever project another tab used most recently.
- Create and switch independent workspaces from the header. Duplicate project names stay safe because identity comes from a server-owned ID, not the display name.
- Agent keys, history, recovery, validation readiness, compilation, and packaging now stay inside the workspace they were issued for; missing or mismatched authority is refused without changing another project.
- Existing active and parked projects migrate once into the bounded workspace registry and retain the same IDs and content across restarts.

## 0.0.62 — 2026-07-30

- Workspace conflicts now show both copy names, real save/edit times, content heads, changed-file counts, and bounded text diffs before you choose a winner.
- Using the server copy first creates a local Undo checkpoint. Overwriting the server first creates a bounded, expiring recovery that appears honestly in Agent History.
- Successful verified deploys now retain a hash-bound recovery for the exact previous deployment. Recovery refuses safely after later changes, on corrupt or expired data, or after it has already been used.
- Failed and dry-run deploys never advertise a later Undo. Post-write validation failures roll back to the exact pre-deploy tree, including first-deployment removal and locked-root handling.

## 0.0.61 — 2026-07-30

- Validation now shows what changed since the last accepted green result: new warnings, resolved warnings, and warnings that stayed the same.
- Background editor checks compare without moving the baseline. A green validation advances it only when explicitly requested, and a successful verified deploy records it after every deploy gate passes.
- First runs and damaged baseline data never masquerade as clean. Forge says when no baseline exists, refuses to overwrite corrupt state, and keeps failed validations and dry-run deploys from changing the last-green record.
- The same content-addressed comparison appears in the Studio Validation panel, project-validation API, package responses, and deploy checklist.

## 0.0.60 — 2026-07-30

- Open Why on any package diagnostic to see its deterministic cause, likely impact, and next action without sending project data to an AI service.
- Suppress only an active validator warning with an exact code, file, and source. Forge shows that scope before writing and requires an owner, meaningful reason, and bounded review date so exceptions stay accountable.
- A suppression is re-proved against the current full-project validation and compare-and-swap protected. Errors, stale files, unsafe project roots, expired metadata, and warnings that already disappeared are refused without changing forge.rules.json.
- Package diagnostics now keep the full finding list and its actions above the footer at supported window sizes instead of collapsing the list into a zero-height scroll region.

## 0.0.59 — 2026-07-30

- Package a mod for Nexus Mods through a dedicated guided flow that validates the complete disk-backed project, builds exactly one install-root ZIP, reopens every entry, and asks where to save the independently hash-verified result.
- Prepare Steam Workshop releases through a separate guided flow that validates Workshop metadata and preview requirements, builds verified CAT/DAT staging plus a rollback ZIP, and hands the exact command to Egosoft's WorkshopTool without pressing Enter or uploading for you.
- First publishes and updates now explain their different preview, change-note, version, and Workshop-id steps. Forge rejects payload drift after the official tool runs and only adopts the returned Workshop identity after a separate guarded confirmation.
- Guided mode is the default and keeps every stage and troubleshooting explanation visible. An optional Settings-only Express mode shortens passed explanations but never skips validation, output selection, Steam authentication, legal prompts, or final verification.

## 0.0.58 — 2026-07-29

- Deploys now require an explicit project target, run the complete project validator before writing, and replace files atomically. A rejected project writes nothing, and each write receipt belongs only to the request that produced it.
- Forge no longer publishes its Studio session credential in discovery files. GitHub credentials are kept by the local sidecar instead of browser storage, are removed when you disconnect, and cannot be used through a read or write agent key.
- Cross-file checks now understand real Lua event registrations and the indexed payload contract used by X4 AI Influence. Commented-out registrations, event collisions, missing writers, and missing readers are reported deterministically before packaging.
- Large or hostile XML and CAT inputs are bounded by explicit size, depth, entity, entry-count, and offset limits, while the installed game's largest catalog and the complete unpacked 9.00 schema corpus remain accepted.
- Workspace recovery now sheds capped secondary history before risking the last known good canvas. Inert automatic-sync controls were removed so the interface only offers actions that actually work, and the dependency/Windows quality gates now run with zero known npm vulnerabilities.

## 0.0.57 — 2026-07-29

- Forge now fits the window instead of extending the canvas into a large empty area. The header, workspace navigation, side tools, patch workbench, and editor surfaces adapt across desktop and narrow widths without hiding existing screens or actions.
- Workspace tabs and side tools can be reordered, hidden, restored, and docked where you want them. Collapse either navigation bar for more canvas space, move the workspace bar to the bottom or the tool rail to the right, and keep the layout after a reload.
- Studio Settings now contains the complete navigation inventory, compact or comfortable density, keyboard-friendly ordering controls, and one-click layout reset. Hiding the active screen always falls back to another visible screen, and corrupt or all-hidden preferences recover safely.
- XML Patching keeps its full three-pane desktop workbench and gains a focused compact layout on smaller windows. Patch Tree, Patch Blocks, Preview, Applied Preview, and Diff-to-Patch remain directly reachable without horizontal page overflow.

## 0.0.56 — 2026-07-29

- Diff-to-Patch now keeps the base file, edited candidate, source revision, and generated patch locked to the same target. Switching files cannot leave wares XML under a ship macro or let a late response overwrite the active candidate, and unsaved per-target drafts survive target switches.
- Bulk Transform can rebalance several numeric fields together as one atomic plan. Add, duplicate, or remove up to 16 XPath operations, inspect every old and new value per file, and apply only when the complete bundle matches and simulates cleanly; partial files produce zero changes.
- Data-only mods no longer need a fake Mission Director cue. XML patches, wares, jobs, assets, UI, AI scripts, translations, and Lua output count as real extension content; an imported empty MD shell is now a clear cleanup warning while a truly empty extension or real broken MD logic still blocks packaging.

## 0.0.55 — 2026-07-29

- The X4 Unpacker and Forge Discord controls in Directory Settings now open with one ordinary left click in Antigravity and VS Code. The extension host accepts only those two exact HTTPS destinations; Forge never opens either page automatically.
- Large real mods now become complete Mission Director graphs instead of a handful of opaque cue wrappers. Forge recursively exposes cues, events, conditions, actions, nested branches, loops, and sub-cues; one unsupported element can no longer hide its entire enclosing cue.
- Each imported Mission Director file has its own visible graph lane, collision removal keeps cards from stacking on the same coordinates, and a new graph-toolbar file picker switches between the full project and one MD script without dropping anything.
- Unsupported or extension-defined elements remain localized at their real position as clearly named raw XML nodes such as XML: <include_actions>. Their exact subtree is editable, while stale saves, root-type changes, reparenting, and edits outside the selected span are refused.
- The Load Mod Project preview now reports domains from the completed folder scan and distinguishes typed nodes, localized raw elements, and whole-cue collapses. DeadAir Dynamic Wars imports with 1,424 graph nodes, zero whole-cue collapses, zero canvas overlaps, and byte-identical no-edit output.
- Imported extensions whose folder name differs from the id declared in content.xml now retain their original manifest bytes and canonical identity through a no-edit build. Forge no longer rewrites legitimate third-party metadata simply to match the deployment folder name.
- Saving unrelated directory settings no longer launches a fresh million-file unpacked-corpus scan. The cached reference index refreshes when its configured corpus root or files actually change.

## 0.0.48 — 2026-07-28

- Autocomplete in native Antigravity XML editors now opens while you type chained script expressions such as faction.player., not only after manually requesting suggestions. Project-defined ids keep their exact authored capitalization in both completion and hover results.
- Duplicate ware and job ids now keep an EXISTS explanation and a visible Patch existing action after the authoritative corpus check finishes. The recovery action no longer disappears when the suggestion popup closes.
- The corpus-authoring workflow is now covered end to end in Forge's isolated extension test stack: ware, faction, AI-script and macro suggestions; XPath completion; per-file base/DLC bulk preview; atomic apply; and exact undo all run through one verified user path.

## 0.0.46 — 2026-07-26

- You can now deploy while X4 is running. Deploying used to fail with a file-in-use error whenever the game was open, because it re-copied every file including ones that had not changed — and the game holds an exclusive lock on the LuaSocket native library for the whole session. Unchanged files are now skipped (compared by size and content, never timestamps), so the one locked file no longer blocks anything. This turns a mod iteration from close-the-game, deploy, relaunch, reload-a-save into deploy and reload in-game.
- A file that genuinely changed and is locked still fails loudly, with the file named. That is deliberate: silently skipping a write you actually needed would leave you with a stale deployment and no error, which is worse than the failure it replaces.
- Leftover deploy folders are cleaned up automatically. A failed deploy could leave .x4forge-backup / .x4forge-next copies of your mod behind, each a complete copy containing content.xml — so X4 loaded them as duplicate extensions declaring the same id. Deploy now sweeps them before starting, and a failed rollback no longer leaves them behind (or tells you exactly which folder to delete if it cannot).
- The game-log watcher no longer reports errors that are not errors. It used to flag any log line containing the word "error", including a mod's own debug output — X4's [=ERROR=] channel is writable by debug_text, so a mod that labels its own diagnostics that way was permanently reported as failing. The verdict now requires an actual engine fault signature, still lists mod-authored lines separately, and names the exact line and reason behind its verdict.
- The older /api/agent/deploy endpoint now reports that it is deprecated in its own response, and points at deploy-verify. It keeps working — tools calling it will not break.

## 0.0.45 — 2026-07-25

- Fixed: wrong-method and unknown-endpoint responses were still returning the app's web page in the installed extension. The fix shipped in 0.0.43 worked in development but not in the packaged build, because the app's page-serving catch-all matched every path and made the check let requests through. Calling an endpoint with the wrong method now correctly returns 405 with the methods it accepts, and an endpoint that does not exist returns a clear 404 — in the installed extension, not just in development. The test suite now checks the packaged build too, so this class of mistake cannot pass again.
- Deploy no longer deletes files it does not recognise. Any dot-file in your deployed mod folder that the Forge did not put there — a tool's config, an editor file — now survives a deploy instead of needing to be listed for protection. Forgetting to list something used to mean silent loss; now it means a stale file you can see and delete yourself. Development metadata the Forge does recognise, such as .git and .vscode, is still cleaned out of the game folder.
- Source-control and editor files are no longer copied into your game folder. .gitignore, .gitattributes, .vscode, .idea and similar are now excluded from deployment, which they never should have been part of.

## 0.0.44 — 2026-07-25

- Reading and writing a file now use the same folder. GET /api/fs/read used to return the DEPLOYED copy while writes went to your workspace, so an edit built on a read could silently overwrite newer work once the two folders differed. Reads now default to the workspace and take an explicit root=workspace or root=deployment. The two places in the app that browse the deployed folder ask for it by name, so nothing changed for them.
- A read that misses no longer quietly hands you the other copy. If the file is not in the folder you asked for, you get a clear "not found" that tells you which folder does have it and how to ask for it — because silently substituting the other copy is exactly what made the old bug invisible.
- Writes are checked before they land. POST /api/fs/write now validates the content you send — XML well-formedness on every .xml file, plus script-property checks on Mission Director and AI script files — and returns the findings with the write. Add strict: true to refuse the write instead, in which case nothing is written at all.
- That check catches the two failure kinds that used to reach the game silently: a mismatched tag, which makes X4 discard the whole file without a log line, and an unknown property name, which evaluates to null so the guard using it simply never fires.

## 0.0.43 — 2026-07-25

- The Forge now tells you where it is. Every instance writes its port and token to ~/.x4forge/latest.json (and one file per instance), so tools no longer have to scan dozens of ports to find it. Records are removed when the Forge stops, and a record left by a crashed instance is cleaned up rather than pointing you at a dead port.
- Errors explain themselves. Calling an endpoint with the wrong method now returns a proper 405 listing the methods it does accept, instead of silently handing back the app's web page; an endpoint that genuinely does not exist returns a clear 404. Importing a folder that is not a mod is refused with a message that names a mod you can actually import, rather than succeeding with a nonsense project.
- Validate a mod folder the same way you import one: POST /api/agent/project/validate now accepts {root, path}, so you no longer have to assemble and classify the file list yourself.
- One call to answer "where am I?" — GET /api/agent/status returns the port, the open workspace, the configured folders, the last deploy, schema and reference readiness, and whether the canvas has drifted from its source folder, including the exact call that fixes it.
- See what a deploy will do before it does it. Send {dryRun: true} to deploy-verify for the exact list of files it would add, overwrite, delete and preserve, with sizes, writing nothing.
- A stale canvas is no longer a dead end. Deploy still refuses when the folder changed after import, but the message now names the exact call that unblocks it, and {autoReimport: true} re-imports and continues in one step.
- Every file write reports what actually landed: byte count, SHA-256, whether the bytes on disk match what was sent, and the line-ending profile. Line endings are preserved.
- Malformed XML is now caught by normal validation, first and as an error. A mismatched tag previously passed with zero structural errors while X4 silently discarded the whole file — the failure that can kill an entire subsystem with nothing in any log.
- Check a single expression without validating a whole project: POST /api/agent/check-expression tells you whether a property chain exists, suggests near-matches, and explains that an unknown property evaluates to null with no error, so a guard using it never fires.
- The action history records what each deploy did to your files — added, overwritten, deleted and preserved, with the full list on the entry.

## 0.0.42 — 2026-07-25

- History entries now tell you what actually went wrong. A validation that found an error used to say only "1 error" — it now names the file, the line and the reason, the same way a blocked deploy names its failing stage. Expanding an entry lists every finding in readable form instead of raw JSON.
- History now covers everything an agent can do, not a handful of routes. Workspace replacements, AI generation, snapshots and restores, settings changes, key creation and revocation, packaging, and shell jobs all appear. Any future endpoint is recorded by default, so an action can no longer go missing silently. Read-only analysis calls stay out of the way, and a canvas auto-save that changed nothing no longer creates an entry.
- History entries link to the nodes they touched. Affected cues appear as clickable chips on an expanded entry — click one and the canvas jumps straight to that node.

## 0.0.41 — 2026-07-25

- Deploying now works even when your mod folder is open in an editor, a terminal, or a file watcher. Windows refuses to rename a folder anything is holding, which previously stopped the whole deployment; the Forge now detects that specific lock and updates the folder in place instead, with a verified backup and an exact rollback if anything goes wrong. You no longer have to close things to deploy.
- You choose how your mod lands in the game folder. A new Deploy Format toggle in the deploy wizard offers loose files (every file readable and editable on disk, and the format native binaries need to load) or a packed CAT/DAT archive. Loose is the default. Every deploy now says in plain language what it actually wrote, and warns you if a packed deploy would bury a .dll where the game cannot load it.
- Deploying loose files now removes files you deleted from your mod. Previously a loose deploy only ever added and overwrote, so a file you removed from your project stayed in the game folder and kept being loaded. Runtime-owned paths and anything listed in .forgekeep are still preserved.
- New History tab on the Agent API screen: a plain-language record of what an AI agent actually did to your project — edits with line counts, validations with error totals, deploys with the exact stage that blocked. Expand any entry for the diff, and use Revert to here to restore a file's previous contents through the same validation as a normal edit.

## 0.0.40 — 2026-07-25

- Load Mod Project now presents both the development workspace and installed-mod filesystem as collapsible directory trees. Expand only the folders you need, inspect nested files in place, and select the exact mod folder to preview or load.
- Large mod libraries no longer require a full recursive scan when the project browser opens. Folder contents load on demand, remain cached while the dialog is open, and keep workspace and deployed copies distinct even when they share a name.

## 0.0.39 — 2026-07-25

- Load Mod Project now browses the Mod Workspace and installed Filesystem as separate, clearly labelled sources. Preview and Load Project use the exact folder you clicked even when both locations contain a mod with the same name.
- Restored Studio tabs now rebind to the current Forge sidecar after an extension restart, so settings, reference data, and project browsing no longer keep calling a stale backend port.

## 0.0.38 — 2026-07-25

- Fixed a blank Studio tab after an extension or backend restart. The Forge now reconnects an open or restored Studio panel to the current sidecar automatically instead of leaving it attached to a dead port.

## 0.0.37 — 2026-07-25

- Forge now packages every included mod file from the development folder, including large binaries and unfamiliar file types. The editor's browser-memory limits no longer cause files to disappear from a build.
- Validated Deploy can build X4-compatible CAT/DAT archives, reopen them, and verify every packaged file before replacing the installed copy. Failed activation restores the previous deployment instead of leaving a partial mod.
- Build output is isolated under the Mod Workspace's .forge-builds folder, so compiling or deploying never replaces the source checkout, Git history, documentation, or other development-only files.

## 0.0.36 — 2026-07-24

- Validation now runs continuously across the whole mod while you type in Forge's code editor, node properties, and raw XML fields. Deterministic XSD errors appear in red, while unknown X4 ids and script properties appear as non-blocking warnings with suggestions.
- The Antigravity extension now uses the same full-project validator for open XML and Lua files and reports findings in the editor and Problems panel automatically, with no manual validation step.
- Unsaved editor buffers are validated read-only against the unpacked X4 schemas, reference corpus, and script-property grammar, with stale results suppressed so an older response cannot overwrite newer typing.

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
