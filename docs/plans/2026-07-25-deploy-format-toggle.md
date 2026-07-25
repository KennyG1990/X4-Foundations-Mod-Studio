# Deploy format toggle — loose files vs CAT/DAT

Task: B84 deploy format toggle with plain-language result
Lane: FULL
Status: SPECIFIED

## WHY THIS EXISTS (reproduced, not theorised)

**[REPRODUCED 2026-07-25]** With B83's locked-root fallback in place, the first live `deploy-verify`
against the real `x4_ai_influence` mod completed `ok:true` across all 10 stages — and **replaced the
deployed mod's 49 loose files with 11 files**: `content.xml`, `README.md`, `.forgekeep`, `config/`,
`docs/`, and a packed `ext_01.cat` (2,964 B) + `ext_01.dat` (9,712,130 B).

`md/ai_influence_diplomacy.xml`, `lua3p/luasocket/core.dll` (483,417 B), `lua3p/luasec/ssl.dll`
(7,489,482 B), and `ui/addons/ai_influence_chat/aic_uix.lua` (295,643 B) ceased to exist as files on
disk. Native DLLs inside a `.cat` archive cannot be `LoadLibrary`'d by the game, so this silently kills
the mod's networking. The deployed tree was restored byte-identically from an independent pre-deploy
backup; the machine is at its pre-session state.

Cause: **`'catalog'` is hardcoded** at both deploy sites — `server.ts` `deploy-verify` and the legacy
`/deploy`. `.forgeartifact.json` governs include/exclude/runtime-owned rules only, never packaging.
B76 shipped CAT/DAT deployment as the sole path; because `deploy-verify` could not reach its write
stage on Windows (the B83 lock), catalog mode had never actually run against a real held mod folder.
B83 did not cause this — it unmasked it.

**Ken's directive (2026-07-25):** "the forge needs a toggle option to deploy as cat/dat or loose files
explaining the result plainly to the user."

## PLAN

- **Goal:** the author chooses the deployment format, the choice persists, and every deploy result says
  in plain language what was actually written and what that means.
- **Default:** `loose`. This restores the long-standing pre-B76 behavior, is what X4 mod folders look
  like in the wild, keeps every file readable/editable/diffable on disk, and is the only mode in which
  native binaries load. CAT/DAT becomes an explicit, explained opt-in. **This is a shipped-behavior
  change from 0.0.36–0.0.40 and is called out for Ken's sign-off, not slipped in.**
- **Existing infrastructure reused:** `compileWorkspaceToFolder`'s existing `artifactMode: 'loose' |
  'catalog'` parameter (already implemented, already covered by `materializeArtifact` /
  `materializeCatalogArtifact`), the `config.json` read/write path (`readXsdConfig` / `writeXsdConfig`,
  same shape as the directory fields), the `/api/schema/config` GET+POST contract, the deploy-verify
  checklist, and `lastArtifactReport`. No new packaging engine, no new persistence layer.

## SCOPE

**In scope**
1. `deployFormat: 'loose' | 'catalog'` persisted in `config.json` via the existing `/api/schema/config`
   GET + POST, defaulting to `loose` when absent or unrecognized.
2. `deploy-verify` accepts an optional per-request `deployFormat` override. Resolution order:
   request body → persisted config → `loose`.
3. An unrecognized `deployFormat` **in the request** is rejected with **zero writes**. An unrecognized
   value **in persisted config** fails soft to `loose` (consistent with the SEC3 config-parse hardening —
   a corrupt config file must never brick deployment).
4. Plain-language result: the `deploy` checklist row states the format and what it produced; the
   response carries a structured `deployFormat` block with a human summary.
5. A plain-language **hazard notice** when catalog mode is selected and the plan contains native
   binaries (`.dll`/`.so`/`.dylib`): they will be inside the archive and will not load. Explained,
   surfaced, not silently blocked — the author is told and decides.
6. UI toggle in the deploy wizard (`CompileConfirmationModal`), reading and writing the persisted
   setting, with the same explanation next to it.

**Out of scope (deliberate)**
- The legacy deprecated `/deploy` route keeps its current behavior; it is already superseded by
  `deploy-verify` and converging it is its own unit.
- Per-file/hybrid packaging rules (e.g. "pack XML, keep binaries loose") — a real idea, but a new
  policy surface that needs its own reconcile. Logged, not built here.
- Changing what catalog mode packs. Only its selectability and explanation change.

## ACCEPTANCE CONTRACT

- Default with no config and no override → `loose`; deployed tree is loose files, no `ext_*.cat/dat`.
- Persisted `catalog` with no override → catalog; explicit override beats persisted value both ways.
- Invalid `deployFormat` → rejected, no deployment written, existing deployed tree unchanged.
- The `deploy` checklist row and response name the format actually used, in user language.
- Catalog + native binaries → the hazard notice appears; loose → it does not.
- The persisted setting survives a server restart (it is in `config.json`).
- Existing catalog behavior is unchanged when catalog is chosen.
- Route/oracle/e2e/type/lint/precommit gates pass using scratch roots only.

## LIVE ACCEPTANCE (Ken's binary test, real mod, mod folder held)

1. `mod-folder/import` then `deploy-verify` → `ok:true`, all stages pass, folder still held.
2. `G:\...\extensions\x4_ai_influence\md\ai_influence_diplomacy.xml` parses as valid XML.
3. `lua3p/luasocket/core.dll`, `lua3p/luasec/ssl.dll` SHA-256 identical to workspace;
   `ui/addons/ai_influence_chat/aic_uix.lua` byte-identical.
4. Deployed file count == workspace count (49); no `.x4forge-backup-*` litter in `extensions/`.

## RISKS AND RECOVERY

- **Default change is user-visible.** Anyone who came to rely on 0.0.36–0.0.40 catalog-by-default gets
  loose unless they set catalog. Mitigation: it is a persisted, discoverable, explained toggle, and the
  result text states the format every time. Flagged for Ken's sign-off.
- **Config growth.** One additive optional field; absent/garbage values degrade to `loose`.
- **Rollback:** revert the B84 delta; `compileWorkspaceToFolder`'s modes are untouched.
- **Real-mod safety:** an independent pre-deploy backup of the deployed tree is taken before any live
  run and byte-verified after restore.

## EVIDENCE LOCATIONS

- Oracle: deploy-format selftest rows in the artifact/compile selftest output.
- Route integration: format-resolution and rejection assertions in `scripts/route-integration.mjs`.
- Live: deployed tree listing, XML parse result, SHA-256 comparison, file count, litter check.
