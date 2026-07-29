# X4 Forge repository cleanup plan

> **For Agent:** execute only after Ken confirms the write gate and machine state.

Task: remove obsolete and regenerable repository debris without deleting runtime state, development
infrastructure, evidence needed for future work, or unrelated user changes
Lane: FULL
Status: **PARTIAL — verified cleanup complete; one active-host profile remains OS-locked**

## PLAN

- **Bounded unit:** clean `F:\DEV_ENV\X4_Forge` itself. Do not touch the installed Antigravity
  extension, unpacked X4 corpus, game installation, deployed mods, Mod Workspace, or any external
  StarForge/Agent Brain directory.
- **Observed baseline:** `main` is at `7591c751e71b9e4695125cca5b9e045cdb525e48`. Pre-existing user
  changes are `ROADMAP.md`, two `vscode-extension/evidence/0.0.35-runtime-copy-*.png` files, and
  untracked `KNOWN-BUGS.md`; preserve all four exactly. The repository currently holds roughly
  893 MiB excluding filesystem allocation overhead.
- **Reconciled ownership:** Vite builds `dist/`; extension scripts regenerate `app/` and `out/`;
  VSIX packages are public/reproducible; Playwright owns its result/report folders; Vite uses
  `public-assets/`, not legacy `public/`; Graphify and the runtime reference manifest are active
  infrastructure, not trash.
- **Risks:** recursive deletion, accidental loss of ignored user state, breaking the local build,
  losing release evidence, or deleting an active worktree. Every target is therefore an explicit
  literal path. No wildcard or repository-wide clean command is allowed.
- **Rollback:** tracked removals remain recoverable from Git before/after commit. Build/stage/package
  outputs regenerate through documented npm commands. Released VSIX files remain downloadable from
  Open VSX. Ignored one-time artifacts are removed only after confirming they are duplicates,
  generated output, empty directories, or obsolete consumed handoffs.

## EXACT REMOVAL SET

### Regenerable outputs and validation residue

- `.tmp_installed_validation/` — isolated installed/public artifact validation profile and logs.
- `dist/` — root production build (`npm run build`).
- `vscode-extension/app/` — staged self-contained sidecar (`npm run stage-app`).
- `vscode-extension/out/` — compiled extension controller (`npm run build` in the extension).
- `vscode-extension/x4-forge-studio-0.0.40.vsix` through `0.0.48.vsix` — published/reproducible
  package files; the current 0.0.48 public hash is durably recorded.
- ignored `vscode-extension/evidence/*.log` files — obsolete e2e logs from 0.0.35-era runs; retain
  every tracked Markdown/JSON/PNG release evidence file.
- `.playwright-mcp/`, `test-results/`, and `tests/e2e/handoff-gap-analysis.spec.ts` — generated
  browser/test or consumed handoff artifacts, not current tests.

### Obsolete tool/session debris

- `.kilo/` — unused repository-local Kilo plugin install (48.82 MiB dependencies); its only plan is
  byte-identical to the already-consumed `dev-docs` copy and the reconciled result is in ROADMAP.
- `dev-docs/` — three ignored 2026-06-11/18 handoff files superseded by tracked ROADMAP/HANDOFF and
  `AGENT-USING-THE-FORGE.md`.
- empty `.codex/` and unregistered empty
  `.claude/worktrees/x4-forge-vscode-poc-806ef5/`.
- `SESSION_CHANGELOG_2026-06-16.md` — obsolete satellite session record superseded by ROADMAP and Git.
- `install_mod.ts` — unused legacy direct-game installer. It deletes and rewrites a live extension
  directory outside the current validated Compile/Deploy boundary, is absent from package scripts,
  and is superseded by Forge deployment.
- legacy tracked `public/` contents — seven validation/mod payload dumps plus an unused favicon.
  Vite deliberately uses `public-assets/`; these files have no code consumers and previously formed
  a documented packaging data-leak class.

Measured exact removal set before implementation: **401,074,051 bytes (382.49 MiB), 7,814 files**.

## EXPLICIT PRESERVATION SET

- `.git/`, all tracked source/tests/docs not named above, `BACKLOG.md`, ROADMAP, HANDOFF, and plans.
- `node_modules/` and `vscode-extension/node_modules/` so the checkout remains immediately buildable.
- `graphify-out/` and `.graphifyignore` for future development/navigation.
- `data/reference-manifest/` (147 MiB performance cache), harvested schemas, API registry, action
  history, and `data/ai-keys.json`.
- `.studio-state/`, `.studio-api-token`, `config.json`, `.env.local`, `.claude/settings.local.json`,
  `forge-skills/`, `.agents/`, and `.mcp.json`.
- `public-assets/`, tracked extension evidence, all current test specifications, and release docs.
- The four pre-existing user changes named in the baseline.

## PREVENT RECURRENCE

- Add a contained `scripts/clean-generated.mjs` with a dry-run mode and explicit allowlist. It may
  remove only regenerated build/stage/package/test outputs; it must never touch source, dependencies,
  configuration, tokens, runtime state, corpus caches, graphs, histories, or evidence records.
- Route `npm run clean` through that script instead of the current Unix-only `rm -rf` command.
- Ignore Playwright/MCP output directories and the unused legacy `public/` scratch root.
- Remove obsolete `install_mod.ts` references from README, Vite watcher exclusions, and HANDOFF.

## ACCEPTANCE CONTRACT

1. Every exact removal target is absent and the measured repository footprint drops by roughly
   382 MiB without deleting the preservation set.
2. `git status` shows only intended tracked cleanup changes plus the four untouched baseline changes.
3. `npm run clean -- --dry-run` names only the explicit generated targets and changes nothing.
4. Typecheck, lint (zero errors), precommit, production build, extension build/stage/package/probe,
   and full isolated e2e remain green after source cleanup.
5. The exact newly packaged VSIX passes forbidden-payload inspection. Generated outputs may then be
   cleaned a second time, proving the cleanup command is repeatable and the source tree stays usable.
6. No 3000/3001 live process, 3100/3101 test process, X4 path, deployed mod, corpus, config, token,
   state, history, reference cache, graph, dependency tree, or unrelated user file is mutated.

## NEGATIVE / FALSE-SUCCESS CHECKS

- A broad `git clean`, wildcard recursive deletion, or delete-by-ignore-status is prohibited.
- Removing `node_modules`, `data`, `graphify-out`, `.studio-state`, config, keys, history, tracked
  evidence, `KNOWN-BUGS.md`, or the pre-existing ROADMAP/screenshot changes is failure.
- A clean typecheck alone is not completion; the regenerated extension package and isolated full e2e
  must pass before the final generated artifacts are removed again.
- If any target resolves outside the repository root, cleanup stops before deletion.

## EVIDENCE LOCATIONS

- This plan records before/after bytes, exact targets, commands, validation, review, and AAR.
- Repo close is appended to `ROADMAP.md`; current working state overwrites `SESSION-HANDOFF.md`.
- No screenshots are required: this task changes repository contents/tooling, not rendered UI.

## CLOSE — 2026-07-28

### IMPLEMENT

- Replaced the shell-specific `rm -rf` package command with the contained, cross-platform
  `scripts/clean-generated.mjs`. It supports `--dry-run`, resolves every target inside the repository,
  continues across independent failures, reports exact file/byte counts, and exits non-zero if any
  target could not be removed.
- Removed the verified one-time debris and tracked legacy files listed above. No broad clean command,
  ignored-file sweep, game-directory write, mod write, corpus write, config mutation, or process
  termination was used.
- Added generated browser-report ignores, documented the safe clean command, and removed obsolete
  references to the retired direct-game installer and legacy `public/` root.
- Preserved dependencies, runtime/reference data, state, secrets/config, Graphify, skills, current
  tests/docs, tracked release evidence, and every pre-existing user change named in the baseline.

### VALIDATE

- `npm run clean -- --dry-run`: PASS; the first dry run named 29 allowlisted generated targets and
  made no changes. The post-build dry run named only the six regenerated targets.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with 0 errors / 518 pre-existing warnings.
- `npm run build`: PASS from the cleaned source tree.
- Extension `stage-app`, `build`, and `package`: PASS; VSIX contained 2,091 expected files and the
  staging guard confirmed the native binding and absence of secrets/runtime state.
- `npm run test:e2e`: PASS, 27/27; `[run-e2e] VERDICT: PASS`. Ports 3000, 3001, 3100, and 3101 were all
  non-listening after the run.
- `npm run precommit:check`: PASS, including 10/10 verdict selftests, product-copy guard, mirror
  identity, tripwire sweep, typecheck, and truncation guards.
- Final `npm run clean`: removed every regenerated build/stage/package/test target and deliberately
  returned exit 1 for the one locked target rather than reporting a false success.
- Preservation check: every explicit preservation target exists after cleanup. Final repository
  footprint is 601.55 MiB including `.git` (558.28 MiB excluding it).

### REVIEW

- **Done and evidenced:** repeatable safe cleanup; generated output, old packages/logs, stale tool and
  handoff debris, legacy scratch payloads, and retired direct installer removed; source tree remains
  buildable and the packaged/browser product remains green.
- **Partial:** `.tmp_installed_validation/` remains (2,229 files, 121,015,076 bytes / 115.41 MiB).
  Its own README identifies it as the disposable installed-extension validation workspace, and its
  timestamp matches the current Antigravity validation session. Windows denied deletion before
  traversal. No process was killed because that could close or corrupt the user's active IDE state.
- **Recovery:** tracked removals are recoverable from Git; all removed build/package output is
  regenerated by the documented commands; released VSIX artifacts remain on Open VSX. Ignored
  duplicate/session debris is intentionally not retained.
- **Capability-map delta:** none; this is repository hygiene and developer tooling, not a product
  capability change.

### AAR

- **Sustain:** exact allowlists, containment checks, dry-run counts, preserved-path assertions, and a
  build/package/e2e/final-clean cycle prevented an over-broad cleanup.
- **Improve work/approach:** several PowerShell `foreach (...) { ... } | Format-Table` commands used an
  invalid direct pipeline form. Materialize loop output in a variable before piping.
- **Improve tools:** Windows lock-owner discovery (`openfiles` and Restart Manager) was denied without
  elevated access. The cleaner now continues and reports all failures so one lock cannot hide cleanup
  results for independent targets.
- **Highest-risk evidenced weakness:** disposable installed-host profiles can remain locked while the
  host is open. The bounded follow-up is to rerun `npm run clean` after Antigravity closes; the script
  will remove that exact profile and nothing else.

Final status: **PARTIAL**. All safely removable scope is cleaned and fully validated; the active-host
profile is the sole remaining acceptance gap.

Suggested commit title: `chore(repo): remove legacy debris and add contained generated-output cleanup`
