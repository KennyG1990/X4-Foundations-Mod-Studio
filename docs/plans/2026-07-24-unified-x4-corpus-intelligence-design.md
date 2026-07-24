# Unified X4 Corpus Intelligence Design

**Goal:** Make one configured unpacked-X4 root the discoverable, auditable source for Forge grammar, canonical values, examples, assets, completion, hover, validation, and patch analysis, while allowing the host IDE and compatible extensions to supplement generic editing features.

## Observed corpus

The configured `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` snapshot contains 1,028,384 files (33.2 GB): 9,884 XML, 88 XSD, 157 Lua, 849 JavaScript, and 1,422 TypeScript. Most remaining files are signatures, audio, textures, models, or compressed assets. The structured high-value slice includes 348 library XML files, 363 MD XML files, 182 AI-script XML files, 171 map XML files, 14 index XML files, 12 UI XML files, and 32 localization XML files across base plus present `ego_dlc_*` sources.

The 88 XSD files are 40 basenames and 52 unique contents. Base `libraries/` contains 37 canonical schemas; other files include MD/AI shims, UI schemas, and DLC variants. Therefore “load every XSD into one union” is incorrect. The manifest must preserve source, path role, content hash, include graph, and precedence.

## Approaches considered

1. **Extend the existing reference/schema engine — selected.** Add a manifest beneath `referenceCorpus`, make schema discovery consume it, and project one generation into API, validation, and extension providers. Lowest drift and preserves the one-referee rule.
2. **Create a separate corpus-scanner service — rejected.** Cleaner isolation initially, but duplicates roots, signatures, caching, provenance, and error handling already present in `referenceCorpus`, `schemaRegistry`, and the object index.
3. **Delegate to generic XML/IDE extensions — rejected as authority.** Useful for formatting, XML tokenization, XPath navigation, and native editor mechanics, but cannot model X4 DLC overlays, script-expression types, diff target semantics, or Forge severity policy.

## Architecture

### Corpus manifest

`referenceManifest.ts` owns a root-keyed, generation-based manifest. It performs one background inventory, persists indexed records in the existing shipped SQLite cache outside the vanilla root, and refreshes incrementally from directory/file signatures. Scans write a staging generation in bounded transactions and yield between batches; readers continue using the previous complete generation until the new generation commits. Each record carries relative path, extension, bytes, mtime, source (`base` or official DLC), domain, role, content authority, and consumer coverage. Large binary assets receive metadata only; XML/XSD/script files receive deeper classification on demand. If SQLite is unavailable, existing targeted reference/schema behavior remains operational but full-manifest status is explicitly degraded.

Roles are explicit:

- `grammar`: XSD and include/import relationships; deterministic rules.
- `canonical-data`: base plus official DLC values; deterministic ID/reference rules.
- `executable-example`: vanilla MD/AI/Lua/UI code; mined advisory evidence only.
- `localization`: display-name resolution and text-reference checks.
- `asset`: existence/dependency checking without content parsing.
- `unsupported`: found but not yet consumed; visible in coverage, never silently claimed.

### One configuration root

`x4ReferenceRoot` becomes the primary “X4 Unpacked Game Corpus” setting. Schema paths are derived from its manifest. `xsdSchemaPath` remains an advanced compatibility override for packed-install harvest and nonstandard layouts, but the UI no longer presents it as a second required source. Saving a root schedules discovery and immediately reports the last complete generation plus scan state.

Users without an unpacked root receive a nearby, non-automatic recommendation for [X4 Unpacker](https://www.nexusmods.com/x4foundations/mods/2142), credited to **z1ppeh**. Its GUI and CLI can extract X4 `.cat`/`.dat` archives while respecting base/DLC catalogue patch ordering. Forge only links and explains; it does not bundle, download, execute, endorse on Egosoft's behalf, or write through that third-party tool.

### Semantic engine

The existing `referenceLanguage.ts` remains the convergence layer. The manifest supplies its schema registry, canonical sets, scriptproperties model, document routing, and provenance. Later stages compile XSD particles into context-path state, parse script expressions into a typed AST, build project symbols, simulate diffs against effective vanilla documents, and mine examples as advisory evidence. Completion, hover, validation, and quick fixes consume these same models.

### IDE capability broker

The extension owns X4 semantics and diagnostics. It uses native VS Code/Antigravity APIs for completion, hover, diagnostics, symbols, code actions, workspace edits, snippets, watchers, and status. Optional compatible extensions may supplement generic XML formatting/schema navigation. The broker detects capabilities, exposes a compatibility status, and never changes Forge pass/fail based on another extension's presence. `xml.fileAssociations` remains opt-in and points at manifest-selected schemas; Forge diagnostics stay authoritative.

## Error and trust model

- Deterministic XSD/reference violations: errors.
- Unknown X4 expression members and references: warnings with suggestions.
- Corpus-observed but non-normative patterns: advisory information.
- Unconsumed domains: coverage gaps, not silent green.
- Manifest scan failure: serve the last complete generation with `stale` status; never replace it with a partial generation.
- Vanilla root: strictly read-only; all caches and evidence live in Forge state/evidence directories.

## Verification strategy

Use a synthetic corpus for deterministic overlay/add/remove/cache tests and the real 9.00 root for inventory/provenance/zero-false-positive evidence. Mutation tests corrupt one legal construct at a time and require the expected diagnostic. Installed Antigravity proof uses a scratch mod and the public Open VSX artifact. The final product reports proof levels separately: discovered, indexed, rule-covered, completion-covered, validated, patch-simulated, runtime-observed, and player-visible.

## Addendum: installed-game detection and development-root safety

The installed game, unpacked corpus, and mod-development workspace are three different path roles:

- `x4GamePath` is the installed runtime root. Forge may read it for discovery and may write only through an explicit deploy operation into its `extensions` child.
- `x4ReferenceRoot` is the unpacked canonical corpus. It is always read-only.
- `modWorkspacePath` is an isolated development root containing editable mod copies, snapshots, and release artifacts. `filesystemPath` defaults to this same root so the IDE explorer does not open on live game data.

Existing Steam/GOG detection in `gameDetectRoutes.ts` is reused. Directory Settings invokes it when the game path is empty or on an explicit Detect action, displays the detection source, and fills an unambiguous proposal without silently persisting it. A manually configured valid path is never overwritten. The safe default development root remains `%USERPROFILE%\\Documents\\X4ForgeMods`; Git may be used inside it, but Git history is complementary to the filesystem boundary and does not authorize direct live-game editing.

A pure path-role validator normalizes case, separators, trailing separators, and symlink-resolved existing ancestors. It rejects a development/editor root that equals or is contained by the installed game root, its `extensions` directory, or the unpacked corpus. It also rejects a game root that lacks the expected X4 executable/runtime markers. The same decision object powers UI status, `POST /api/schema/config`, and runtime write chokepoints, so an old unsafe config cannot bypass the save-time check. Explicit deploy remains a separate, named write path with its existing preflight gates.

Alternatives rejected: UI-only warnings leave API and stale-config writes unsafe; save-time-only validation leaves already-persisted unsafe paths active; treating Git as the safety mechanism cannot prevent a mistaken write to the live game tree.

### Community support surface

Directory Settings also includes a compact Community & Support card linking to the X4 Forge Discord at `https://discord.gg/9qvAvtXqWP`. Its copy invites users to ask Forge questions, discuss workflows, share their mods, and meet other mod authors. The link is user-initiated, opens externally with safe link attributes, never auto-joins or sends data, and does not imply Egosoft affiliation.
