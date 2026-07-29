# B73 · Canonical reference corpus API and validation integration — PARTIAL 2026-07-23

> **For Agent:** Follow the repository Universal AI Task Workflow. This is a Full-lane validation/API task.

**Goal:** Expose the configured unpacked X4 corpus through cached, read-only reference endpoints and use its canonical IDs in project validation.

**Architecture:** Add a canonical-root-only loader under `src/lib/` that reads base files plus every present `extensions/ego_dlc_*` overlay, resolves English localization, records provenance, and caches by a bounded source-file signature. A small `src/server/` route module exposes public read-only endpoints and supplies immutable ID sets to the existing `runProjectValidation`/`validateXmlAgainstSchema` path. The existing mixed-root Object Browser remains separate.

**Tech stack:** TypeScript, Express, Node `fs/path`, `@xmldom/xmldom`, existing schema/project-validation infrastructure, synthetic selftests, HTTP route integration.

## PLAN

- **Bounded unit:** configurable unpacked-reference root; factions, wares, sectors, scriptproperties, raw-file and optional search GETs; canonical reference warnings with suggestions.
- **Assumptions corrected by reconciliation:** `faction.id` does exist in the 9.00 `scriptproperties.xml` and must be exposed. `category` and `isreal` do not exist in `factions.xml`; they are derived authoring metadata, not claimed corpus fields.
- **Authoritative references:** `<X4_UNPACKED_CORPUS>`; base `libraries/*.xml`, `maps/**/*.xml`, English `t/0001-l044.xml`; every present `extensions/ego_dlc_*` counterpart; existing `src/lib/xsdValidate.ts`, `src/server/projectValidation.ts`, `src/lib/scriptProperties.ts`, `src/lib/galaxyMap.ts`; B46 plan and X4 Forge capability/ADR ledgers.
- **In scope:** read-only loose unpacked corpus; base-plus-DLC union with first-definition provenance; localization; cache invalidation on root/source add/change/remove; settings/API/UI configuration; public reference GETs; project-local definition union; warnings for unknown canonical references.
- **Out of scope:** modifying vanilla files; arbitrary third-party extension overlays; a general RFC-5261 diff engine; replacing the Object Browser; inferring runtime Lua types beyond explicit, corpus-grounded reference patterns; release/publish/commit/push.
- **Risks:** false-positive diagnostics, mod-owned IDs being mistaken for unknown, stale caches, path traversal, startup failure on a missing optional corpus, UI regression. No spending, credential, network, deletion, game-directory write, or production mutation surface is added.
- **Rollback/checkpoint:** pre-change `HEAD`/`origin/main` = `b20687887fe8facfc699c1d6bcfa03291b26d675`; existing user-owned `BACKLOG.md` edits are preserved. Revert only the files listed below; config field is additive and optional.
- **Likely files:** `src/lib/xsdParser.ts`, new `src/lib/referenceCorpus.ts`, new `src/server/referenceRoutes.ts`, `src/lib/xsdValidate.ts`, `src/server/projectValidation.ts`, `server.ts`, `src/components/DirectorySettingsModal.tsx`, route/selftest scripts, API docs/records.

## ACCEPTANCE CONTRACT

1. `GET /api/reference/factions` returns exactly the effective 32 IDs for the configured 9.00 corpus, includes `fallensplit`, `kaori`, `holyorderfanatic`, `loanshark`, and `trinity`, excludes `riptide`, and records base/DLC source.
2. Faction `category`/`isreal` are deterministic and documented as derived: `player`; `system` when tagged `hidden`; `hostile` when tagged `nodiplomacyselection` or `aggressive`; otherwise `political`; only `political` yields `isreal=true`.
3. `GET /api/reference/wares` returns ID, localized/fallback name, group, tags, and first-definition source from base plus all present official DLC files.
4. `GET /api/reference/sectors` returns sector macro IDs, localized/fallback display names, and source from base plus official DLC map files.
5. `GET /api/reference/scriptproperties?datatype=faction` returns the real faction datatype and direct properties with `name`, `result`, and `type`, including the corpus-proven `id` property.
6. `GET /api/reference/file?path=libraries/factions.xml` returns the real base file. Missing paths return 404; absolute/traversal/directory paths are rejected; no write route exists.
7. Root precedence is `X4_REFERENCE_ROOT` -> `config.x4ReferenceRoot` -> documented default `<X4_UNPACKED_CORPUS>`. Startup reports available/unavailable without crashing the Forge. Directory Settings can read/save the field.
8. The loader parses once per unchanged signature. A synthetic add/change/remove of an `ego_dlc_*` source invalidates the cache and changes the exposed set; `?refresh=1` permits explicit refresh.
9. `runProjectValidation` uses canonical faction/ware/macro sets, unions definitions owned by the project under validation, and emits warning diagnostics naming unknown IDs with a cheap suggestion when available. Known canonical and project-owned IDs remain clean.
10. Existing `/api/fs/*`, `/api/agent/project/validate`, compile/import/debug-watcher behavior remains green.

## REQUIRED VALIDATION AND EVIDENCE

- **Baseline:** `npm run typecheck` exit 0 before edits; dirty tree limited to pre-existing `BACKLOG.md` B71/B72 additions.
- **Pure/selftest:** new reference-corpus selftest covers base+DLC provenance, exact fixture union, localization, cache reuse/invalidation, and path traversal; XSD/project-validation focused fixtures cover bad faction+ware, suggestions, known/project-owned clean cases.
- **Real corpus:** direct/API checks against the configured unpacked 9.00 root prove faction count/content/provenance, ware/sector/scriptproperty samples, and raw-file byte identity.
- **Negative path:** traversal and missing file; missing reference root degrades explicitly; invented faction/ware warnings; `riptide` absent.
- **Static/integration:** `npm run typecheck`, `npm run lint`, `node scripts/oracle-sweep.mjs`, `npm run test:routes`, `npm run precommit:check`.
- **E2E/build:** `npm run test:e2e` only after the machine-state gate; verify workspace guard restoration. `npm run build` because server/UI/package surface changes.
- **Visual:** Directory Settings field requires rendered-host inspection; absent that evidence, UI portion closes PARTIAL even if code/static tests pass.
- **Evidence locations:** command output in task transcript; durable close in `ROADMAP.md`/`BACKLOG.md`; capability-map delta; `SESSION-HANDOFF.md`; project/global AAR because reconciliation and a tool-input failure triggered AAR.

## IMPLEMENTATION TASKS

### Task 1: Configuration contract

- Extend `XsdConfig`/`ResolvedXsdConfig` with `x4ReferenceRoot` and availability.
- Add environment/default precedence and synthetic config selftest coverage.
- Wire Directory Settings GET/POST and UI field without coupling it to schema validity.

### Task 2: Canonical loader and cache

- Build file discovery/signature, localization, faction/ware/sector/scriptproperty parsers, internal macro sets, safe-file resolver, and cache.
- Use base-first, sorted `ego_dlc_*` sources and first-definition provenance; parse embedded add/replace payload records as a correct ID union.
- Add synthetic oracle, including DLC add/remove invalidation.

### Task 3: Read-only routes

- Register `/api/reference/factions`, `/wares`, `/sectors`, `/scriptproperties`, `/file`, `/search`, and `/selftest`.
- Add exact public-read allowlist entries and describe endpoints in the agent schema.

### Task 4: Validation integration

- Feed canonical sets through the existing reference option.
- Union current project definitions before validation.
- Keep findings advisory warnings and add did-you-mean text; add focused negative/clean tests.

### Task 5: Validate and review

- Run all applicable contract methods, inspect the complete diff, rebuild graphify, and record proof/limits.
- Do not claim visual or e2e verification unless those gates actually run.

## CLOSE — 2026-07-23

- **Status:** `PARTIAL`. API/validator/cache/security/static/integration/oracle/build layers are VERIFIED. Full e2e and rendered Directory Settings inspection were not run because the required machine-state answer was not provided.
- **Implemented:** configurable root precedence; startup availability report; base + every present `ego_dlc_*` discovery; localization; source-signature cache and refresh; faction/ware/sector/macro/scriptproperty indexes; DLC property augmentation; contained raw-file reads; public status/factions/wares/sectors/scriptproperties/file/search/selftest routes; canonical project-validation references plus project-owned definitions; Lua literal warnings and suggestions; Directory Settings field; stable isolated HTTP/oracle/real-corpus harnesses.
- **Review corrections:** stripped UTF-8 BOM before XML parsing after the real base macro index was silently skipped; macro set rose from 2,739 to 6,505 and `md-audit` returned to zero. Fresh-eyes review added direct DLC scriptproperty augmentation merging.
- **Evidence:** routes 16/16; real corpus 10/10; real HTTP/API + project validation 19/19; runtime oracle board 98/98 (reference corpus 10/10, literal lint 5/5, aggregate 10/10); typecheck/precommit/build exit 0; lint 0 errors/430 warning-only findings; graphify rebuilt 1,953 nodes/4,548 edges.
- **Negative paths:** raw traversal 403; missing raw file 404; invented faction/ware warnings name the IDs; project-owned faction/ware IDs clean; `riptide` absent; synthetic DLC add/remove invalidates cache.
- **Not changed:** vanilla corpus, game/mod directories, standing config, `/api/fs/*` behavior, import/deploy/release/Git state.
- **Residual proof:** run full e2e only after machine-state confirmation and inspect the Directory Settings field in the rendered host. Until then the user-visible configuration surface remains unverified.
- **Suggested commit title:** `feat: expose canonical X4 reference corpus through the Forge API`.
