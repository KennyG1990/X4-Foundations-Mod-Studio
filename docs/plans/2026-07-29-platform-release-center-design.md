# Guided Nexus and Steam Release Center — Design

**Status:** VERIFIED · published as Open VSX 0.0.59

## Product contract

X4 Forge will expose two separate actions in the existing Playtest/ship surface:

- **Package for Nexus Mods** opens a guided archive workflow.
- **Prepare / Publish to Steam Workshop** opens a guided Egosoft-tool workflow.

Guided mode is the default. Each workflow exposes named stages, the evidence produced by each stage, and
the exact stage that failed. A Settings preference may enable **Express mode**, but Express mode only
collapses already-passed explanations. It never skips validation, output selection, Steam's confirmation,
or post-build verification.

The two platforms must not share a misleading generic success state. A Nexus ZIP is a local release
artifact. A Steam Workshop release is an external publication performed by Egosoft's official interactive
tool; its durable local evidence is the verified staging folder, a user-exported backup ZIP, the tool's
result, and the Workshop metadata written back to the staged `content.xml`.

## Reconciled facts

### Existing Forge capabilities to reuse

- `src/lib/artifactPipeline.ts` already produces a complete provenance-aware plan that preserves unknown
  and binary source files while excluding development metadata.
- `src/lib/artifactPackager.ts` already builds and reopens X4 CAT/DAT artifacts.
- `src/lib/modDistribution.ts` already contains a dependency-free ZIP writer and X4 version bump logic.
- `runProjectValidation` / `buildDeployProjectValidation` provide the shared full-project gate.
- The installed extension already owns a typed, origin-checked Studio-to-native-host bridge.
- Studio Settings already persists normalized preferences through extension-owned server state.
- The global readiness ladder already provides a persistent evidence surface; the Release Center should
  consume it rather than inventing another validator.

### Existing B9 behavior that is insufficient

The current `POST /api/agent/package/release` and Playtest button are a single opaque action. The route:

- falls back to the mutable active workspace;
- packages the generated in-memory text manifest rather than the complete disk-backed artifact plan;
- writes synchronously to a fixed `<modWorkspacePath>/releases/` path;
- does not ask where the user wants the finished file;
- does not reopen or independently extract the ZIP it just wrote;
- does not provide a stage ledger or platform-specific remediation;
- cannot guide or validate Steam Workshop publication.

Its green B9 oracle proves only the small ZIP container and generated-manifest case. It does not prove the
requested release experience.

### Authoritative platform facts

Egosoft's official documentation names **`WorkshopTool.exe`**, installed with the separate **X Tools**
Steam tool. It is not `PublishTool.exe` or `X4Customizer.exe` in the X4 game directory. For a first X4
publication the official shape is:

```text
WorkshopTool publishx4 -path "<verified staged mod folder>" -preview "<preview.jpg|png>"
```

The tool is interactive, requires Steam to be running/logged in, asks before cloud upload, may require the
Workshop legal agreement, and writes Workshop metadata—most importantly the `ws_<item-id>`—back into
`content.xml`. Updates use `WorkshopTool update`, require `-changenote`, may omit `-preview` to preserve the
current image, and require `-minor` only when the already-published version is deliberately unchanged. Steam
accepts game payload through catalogs. Forge therefore builds and verifies CAT/DAT itself and intentionally
omits `-buildcat`; WorkshopTool remains authoritative for the interactive Steam upload. Reference:
<https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Steam%20Workshop%20for%20X%20Rebirth%20and%20X4/?language=en>

Nexus accepts ordinary archives, but its scanners reject or quarantine malformed, password-protected, or
nested archives. ZIP is the compatibility default. The X4 install layout is one mod folder directly below
`extensions/`, with `content.xml` at that folder root. References:
<https://help.nexusmods.com/article/117-why-has-my-mod-been-quarantined> and
<https://help.nexusmods.com/article/28-file-submission-guidelines>.

## Architecture

### Shared release preflight

A pure release engine consumes an explicit workspace or explicit project path and returns a stage report.
It compiles generated outputs, loads disk-backed source bytes, runs full validation, parses `content.xml`,
  and creates an immutable artifact plan. The release engine never reads the active-workspace singleton as an
implicit source. Every response echoes the chosen mod id/source identity.

Required manifest checks are platform-aware:

- both: non-empty `name`, integer X4 `version`, and a safe/stable mod folder id;
- Nexus: `content.xml` at `<modId>/content.xml`, no nested archives, complete disk-backed payload;
- Steam: non-empty `name`, `description`, and author, valid version, folder-name rules
  (`a-z 0-9 . _ -` and space, lowercase, at most 32 characters), preview JPG/PNG for first publish (optional
  for update), and X Tools availability for the interactive upload handoff.

Warnings remain visible and counted. Errors block before any output write.

### Nexus workflow

1. Review identity, manifest, dependency, install/uninstall text, and recommended page media.
2. Select version behavior without mutating source.
3. Build a complete `<modId>/`-rooted ZIP in Forge-owned staging.
4. Reopen the ZIP, validate its central directory, CRCs, entry bounds, duplicate/traversal names, and exact
   planned hashes; acceptance also uses an independent Windows extractor.
5. Ask the installed IDE host for a user-selected `.zip` destination. Copy atomically and hash-verify the
   selected output. Standalone mode offers the verified Forge-owned path and an explicit typed export path.
6. Show a final checklist and a manual Nexus upload guide. Forge does not log into or publish to Nexus.

The output is the user-selected ZIP plus a sibling JSON verification report containing platform, source
identity, version, file count, byte count, SHA-256, validation summary, warnings, and stage results.

### Steam workflow

1. Detect or let the user locate `WorkshopTool.exe`; show the X Tools installation remediation if absent.
2. Choose first publish versus update deterministically from the `content.xml` `ws_<numeric>` id and require an
   update changenote. If the author deliberately kept the already-published version unchanged, a separate
   acknowledgment adds `-minor`; the local “Keep current version” build choice does not imply that fact. Preserve
   the imported extension folder as a separate identity: Egosoft changes the manifest id after publication, not the
   folder that Workshop installs and updates.
3. Select and validate a preview image for first publish. On update, leave it blank to preserve the existing
   Workshop preview or select a replacement. Egosoft recommends widescreen 640x360 or larger; Forge reports image
   dimensions/format/size and enforces the product's configured 1 MB upload guard requested for this workflow.
4. Build and reopen a complete **catalog** staging folder, named after that preserved extension folder, under Forge-owned release state using Forge's already
   proven CAT/DAT packager. The stage contains `content.xml`, verified `ext_*.cat/.dat` volumes, allowed loose
   support files, plus exactly one selected preview when applicable. Offer a user-selected backup ZIP so the exact
   pre-publish input is recoverable.
5. Render the exact quoted command. The installed host opens a visible terminal with the command inserted
   but **not executed**. The user reviews it and presses Enter. The command omits `-buildcat` because Forge has
   already built and verified the exact catalogs being uploaded; Egosoft's tool remains responsible for Steam
   authentication, legal confirmation, item creation/update, and cloud transfer.
6. After the tool exits, the user clicks **Validate Steam result**. Forge reopens `content.xml`, detects the
   Workshop id/sync metadata, checks the retained CAT/DAT pairs with the existing catalog verifier, and writes
   a post-publish JSON report.
7. For a first publish, show a source-diff preview and offer an explicit guarded adoption of the Workshop
   metadata into the source `content.xml`; never mutate the source merely because the upload ran.
8. Guide the user to the Workshop page to accept the legal agreement, set visibility, and review dependencies.

No server route directly launches a process or uploads. The sidecar never receives Steam credentials. The
native host opens a visible terminal, and the final keypress remains the user's external-side-effect gate.

## UI and error behavior

`ReleaseCenter` replaces the old B9 block in `PlaytestWorkspace`. Two individual buttons open two dedicated
steppers. Every stage is `pending | running | pass | warning | fail | skipped`, has one-line evidence, and
may expose details/remediation. Later stages are skipped after failure; no generic green banner can override
a failed stage.

Settings adds **Packaging experience: Guided / Express** with this warning:

> Express collapses explanations and advances automatically after successful local checks. It does not skip
> validation, destination selection, backup creation, Steam's interactive confirmation, or final verification.

The wizard must remain usable in standalone mode. Native save/file pickers and terminal handoff are enhanced
installed-host capabilities with honest fallbacks, not required for source correctness tests.

## Alternatives considered

- **Patch the old one-button route:** smallest diff, but retains incomplete-source and hidden-stage defects.
- **Add a new top-level workspace destination:** discoverable but adds permanent navigation weight for an
  occasional release task.
- **Build an extension-only native wizard:** gives dialogs and terminals easily but duplicates the Studio UI
  and makes standalone behavior second-class.
- **Selected:** a reusable Release Center in Playtest plus narrow native-host capabilities.

## Stop boundary

B109 stops when both guided workflows pass pure, route, negative, independent-extractor, isolated E2E, built
product, packaged VSIX, and installed-host visual/interaction gates. A real Steam cloud upload is not performed
without an explicit per-upload user confirmation. Nexus page creation, media capture, and upload remain guided
manual steps. Kimi R1-R21 outside the release-related R3/R7/R8/R12/R19 surfaces remain B110 slices.
