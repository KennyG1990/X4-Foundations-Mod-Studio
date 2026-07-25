# Generic Artifact And CAT/DAT Pipeline Design

**Status:** VERIFIED 2026-07-24

## Problem

Forge currently serializes imported passthrough content into `ModWorkspace`. Files above 256 KiB or
after a 6 MiB aggregate budget are recorded as `omitted` and excluded from
`buildWorkspaceFileManifest`. Deployment can consequently preserve a stale copy, omit the file from a
fresh installation, or delete it when another emitted path makes its top-level directory Forge-managed.
Packed mods are worse: Forge can read CAT/DAT archives but cannot rebuild them, and a small CAT can be
rewritten while its large paired DAT remains stale.

The browser-memory protection is valid; using it as a packaging limit is not.

## Authority Model

1. The selected project folder is the authoritative source tree.
2. `ModWorkspace` is an editable model/cache, never a complete byte store.
3. Compiler output claims only the paths it emits.
4. Every included source file not replaced by compiler output is opaque, source-owned payload and is
   streamed from disk regardless of type or size.
5. A scratch artifact is the only deployable input. The live game is never the build workspace.

Ownership is inferred from provenance, not mod-specific names:

- **generated** — a registered compiler/emitter claims the output path;
- **source-copy** — a regular source file is included and no emitter replaces it;
- **excluded** — a universal development-metadata rule or project rule excludes it;
- **runtime-owned** — an explicit project rule reserves the path for mutable deployed state;
- **conflict/error** — unsafe path, symlink/junction, missing bytes, duplicate normalized path, or an
  unresolved ownership collision.

Unknown extensions default to `source-copy`.

## Inventory And Rules

The artifact planner walks with `lstat`, rejects symbolic links and reparse-point escapes, normalizes
paths to forward slashes, detects case-fold collisions for Windows/X4 targets, and records size, mtime,
SHA-256, origin, disposition, and reason. Universal exclusions cover source-control and Forge/editor
state such as `.git/**`, `.hg/**`, `.svn/**`, `.claude/**`, `.kilo/**`, `.forge/**`,
`.forge-builds/**`, and `node_modules/**`. A project `.forgeartifact.json` may add `exclude`, `runtimeOwned`, and
`catalogLoose` glob rules. Rules cannot escape the project and all matches appear in the build report.

## Materialization

Generated text/binary buffers and source-copy streams are written to a new scratch directory. No file
is loaded wholly merely to copy it. After writing, the builder re-hashes the artifact and compares it to
the plan. Missing, extra, changed, or unclassified entries fail closed.

Loose development output lives under `<Mod Workspace>/.forge-builds/loose/<modId>` and never replaces
the source checkout. Packed output keeps `content.xml` and
explicit `catalogLoose` files at the extension root, then writes the remaining entries into deterministic
`ext_01.cat/.dat`, `ext_02.cat/.dat`, ... pairs. The DAT writer streams bytes; CAT lines contain normalized
path, size, Unix timestamp, and MD5. A configurable volume limit permits deterministic multi-catalog
tests and large-mod splitting.

Forge reopens every produced catalog with its existing reader, verifies pairing, entry ordering,
offsets, sizes, hashes, and aggregate bytes, and compares the packed inventory with the intended plan.
The packer is an interface so an Egosoft X Catalog Tool adapter can be added later without changing
inventory or artifact semantics.

## Deployment Boundary

This unit builds and validates scratch artifacts and then makes the existing deploy compiler consume the
same complete plan. It does not write a real game directory during development. A later live write must
use the existing explicit Deploy authorization, build outside the target, validate first, and preserve
only explicitly runtime-owned paths.

## Acceptance

- No deployment-size cutoff; a file larger than 256 KiB and a multi-megabyte binary are hash-identical.
- Arbitrary names/types, Unicode, spaces, deep paths, empty files, and mixed text bytes survive.
- `.git` and declared exclusions never enter loose or packed artifacts.
- Missing source, symlink/reparse escape, normalized collision, and tampered DAT fail.
- Multi-volume CAT/DAT output reopens through Forge and exactly matches the intended packed inventory.
- Existing compiler, validation, filesystem, deploy, package, and extension contracts remain green.
