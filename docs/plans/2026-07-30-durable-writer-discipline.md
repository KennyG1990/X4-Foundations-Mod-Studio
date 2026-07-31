# Durable Writer Discipline Implementation Plan

> **For Agent:** REQUIRED SUB-SKILL: use `planning`; reconcile the live writer graph before editing.

**Goal:** Close Kimi R7 by making every production durable writer either use a proven atomic/transactional authority
or appear in a source-enforced, explicitly justified exception category.

**Architecture:** Extend the existing `workspaceState` sibling-temp atomic writer instead of creating a competing
server persistence stack. Add a VS Code-host equivalent for extension-owned workspace artifacts, because the packaged
extension cannot import the server bundle. Keep proven whole-tree replacement, verified release staging, SQLite/WAL
transactions, append-only history, and scratch artifact materialization as named categories. A deterministic source
audit pins the remaining raw filesystem mutation surface so a new direct writer cannot appear silently.

**Tech stack:** TypeScript, Node filesystem APIs, better-sqlite3, VS Code extension host, existing selftest/oracle and
route-integration harnesses.

Task: B110-R7 one durable-writer discipline
Lane: FULL
Status: VERIFIED

## PLAN

- Bounded unit: inventory and harden production durable writes in the Forge server/library and packaged extension;
  add a machine-enforced inventory; close R7 without redesigning workspace identity or polling.
- Assumptions:
  - Atomic single-file replacement, validated sibling-directory promotion, exact deploy rollback, SQLite transactions,
    append-only JSONL with torn-tail tolerance, and isolated scratch materialization are distinct valid implementations
    of one policy; forcing them through one byte helper would weaken the tree/database contracts.
  - Missing optional discovery metadata may remain fail-soft, but its individual files must not be tearable.
  - A configured spend cap is a safety boundary: corrupt/unreadable/unwritable meter state cannot be treated as a
    fresh day or silently ignored.
- Authoritative references: Kimi ledger R7; ADR-F1 persistence rules; capability map; existing
  `atomicWriteFile`, `writeWorkspaceFileGuarded`, `replaceValidatedDeployment`, `replaceReleaseDirectory`,
  `AgentHistoryStore`, SQLite/WAL helpers, and extension native release-export transaction.
- In scope:
  - Enumerate every raw production filesystem writer and SQLite mutation owner by category.
  - Extend the shared server atomic writer for restricted file modes and deterministic failure injection.
  - Migrate uncatalogued authoritative config, credential, key, token, spend-meter, snapshot, and extension-owned
    single-file writers.
  - Make related extension brief files all-or-nothing or restore their prior state on failure.
  - Fail closed before an outbound paid call when an enabled spend meter is corrupt or cannot persist the reservation.
  - Add a source audit that fails on any unregistered writer file/call-count delta and documents accepted exceptions.
- Out of scope: R8/R17 workspace/session authority; R13 scheduler; filesystem journaling across power loss; replacing
  SQLite; making best-effort history append block the owning action; arbitrary user-source undo beyond R14.
- Files/resources likely affected:
  - `src/lib/workspaceState.ts`, `src/lib/aiSpendMeter.ts`, `src/lib/agentKeys.ts`,
    `src/lib/instanceDiscovery.ts`, `src/lib/xsdParser.ts`, `src/server/aiKeyStore.ts`, `server.ts`.
  - `vscode-extension/src/durableWrite.ts` (new), `vscode-extension/src/modFolder.ts`,
    `vscode-extension/src/extension.ts`.
  - `config/durable-writers.json` and `scripts/durable-writer-audit.mjs` (new), package/precommit/oracle wiring,
    route/selftest fixtures, Kimi ledger, BACKLOG, ROADMAP/capability map/AAR/handoff at close.
- Risks and authorization boundaries:
  - Persistence regressions can lose settings, credentials, keys, snapshots, or undercount paid AI calls.
  - No test may use live profile data, real mods, the game directory, or the normal Antigravity state root.
  - No provider request is permitted during validation; spend checks use injected stores only.
  - Existing user-owned 0.0.35 screenshots and `Note for Kimi.md` stay untouched.
- Rollback/checkpoint: `HEAD == origin/main == 4821353e9e405ccd82bb84416af318ab80f2d51b`; all mutation tests use temp
  roots. Revert the bounded R7 commit if a production regression is found.
- Acceptance criteria:
  1. The inventory covers every production raw filesystem writer, browser file/download output, and SQLite mutation
     owner, naming authority, category, failure behavior, and whether it is authoritative, append-only, staged,
     transactional-tree, database, extension-workspace, browser-export, ephemeral, cleanup, or fixture-only.
  2. A deterministic audit rejects an unregistered writer source, an unexpected raw call-count delta, an unknown
     category, a missing owner/rationale/failure contract, and stale inventory entries.
  3. Authoritative single-file writes use sibling-temp replacement with unique names, cleanup on failure, optional
     restricted mode, and preservation of prior bytes on injected failure.
  4. AI provider keys, agent keys, Studio token, X4 directory config, spend usage, discovery records, snapshots, and
     extension-authored JSON/Markdown files use the declared contract. Related AGENTS.md/X4_NOTES.md writes are
     rollback-safe as a pair.
  5. With either daily spend cap enabled, corrupt/unreadable meter state or a failed durable reservation blocks the
     paid call with explicit machine truth. A valid future-dated ledger also fails closed rather than resetting after
     a host-clock rollback. Missing first-run state remains valid; both caps disabled preserve legacy availability.
  6. Agent-key mutations either persist or restore their previous in-memory state; no key is returned as durable when
     its record was not committed.
  7. Proven tree, release, SQLite, append-log, and scratch writers remain on their stronger existing authorities and
     are documented rather than wrapped in a weaker helper.
  8. No live workspace/game/profile mutation occurs; all automated gates pass; extension staging/package probes pass
     if the packaged extension source changes.
  9. `cacheExtensions` proves that an injected `extensions_built_at` failure rolls back both extension rows and their
     visibility metadata. The writer audit rejects a new browser File System Access or download-anchor output unless
     it is declared. Uncalled legacy browser filesystem compilation helpers are removed rather than legitimized.
- Required validation and negative paths:
  - Writer-audit selftests plus a real repository audit.
  - Atomic writer pre-rename failure, restricted-mode, concurrent-temp, and no-litter fixtures.
  - Spend missing/corrupt/read-failure/write-failure/caps-disabled fixtures; route proof that failure occurs before
    provider network dispatch; future-dated ledger rejection under an enabled cap.
  - Agent-key create/revoke/touch/prune persistence-failure rollback fixtures.
  - Extension single-file and paired-file second-commit failure rollback fixtures.
  - SQLite extension-cache metadata failure rollback fixture; browser-output inventory selftests and live audit;
    repository proof that `compileAndSaveAll` and its File System Access helpers no longer exist while the shared
    server artifact pipeline remains authoritative.
  - Typecheck, lint, focused selftests, route integration, full oracle sweep, build, precommit, Graphify refresh; full
    serial E2E only if a rendered behavior or shared server contract changes enough to make it applicable.
- Evidence locations: this record, `config/durable-writers.json`, command output, `test-results/`, and durable close
  entries in the Kimi ledger/capability map/AAR/ROADMAP.

## BASELINE

- Revision/version: `4821353e9e405ccd82bb84416af318ab80f2d51b`, equal to `origin/main`; public extension 0.0.62.
- Existing changes/failures/runtime state: only user-owned modified 0.0.35 evidence images and untracked
  `Note for Kimi.md`. No task-owned runtime is live. R11/R14 normal-profile visual proof remains separately PARTIAL.
- Reconciled existing authorities:
  - Atomic file/JSON: `workspaceState.atomicWriteFile/atomicWriteJson`.
  - Guarded workspace source: `writeWorkspaceFileGuarded` with confinement/CAS receipt.
  - Whole trees: `replaceValidatedDeployment`, deployment recovery, and `replaceReleaseDirectory`.
  - Exported release ZIP: extension `exportVerifiedReleaseArtifact` with backup/rollback/hash proof.
  - Database: SQLite WAL plus explicit transactions/generation-ready switch.
  - Append log: `AgentHistoryStore` content-addressed blobs and torn-tail-tolerant rotated JSONL.
  - Latest-value browser persistence: serialized Studio-layout writer.
- Observed gaps:
  - XSD config, AI key store, spend meter file, instance discovery, Studio token, extension recommendations/settings,
    agent brief/proof files, and several snapshot markers still use direct writes.
  - The spend meter currently treats corrupt state as a fresh day and swallows save failures even when caps are on;
    this can bypass the only persistent paid-call backstop.
  - Agent-key persistence swallows failures and can return/revoke/touch a state that exists only until restart.
  - No source-level gate prevents a new direct durable writer.

## RECONCILE

- Resources/readers/writers searched: Graphify writer traversal (68-node result rooted at atomic/layout/snapshot
  writers); repository-wide filesystem and SQLite mutation scans; Kimi ledger; ADR/capability records; Agent Brain
  query (no matching durable-writer node); server/extension persistence helpers and their selftests.
- Extend-versus-replace: extend. Existing authorities have stronger domain-specific guarantees and no evidence of
  three recurring failures in their roles. The uncatalogued call sites and fail-open spend/key stores are the gaps.
- Couplings checked: provider dispatch order; key create/revoke/touch/prune semantics; config/global-storage roots;
  extension packaging boundaries; workspace/deploy/release receipts; SQLite generation visibility; history rotation.
- Capability-map delta: recorded at close — source-enforced writer inventory, fail-closed spending reservations,
  atomic/rollback-safe authoritative files, and coupled SQLite visibility metadata.
- Plan changes:
  - Fresh-eyes review found that any valid non-today spend record rolled over, including a future date after host-clock
    rollback. The acceptance contract now requires prior-day-only rollover and fail-closed future-date handling.
  - `cacheExtensions` already couples `extensions_built_at` to its row transaction, but the negative oracle covered
    object metadata and game-root identity only. The same rollback proof is now required for extension metadata.
  - The initial audit counts filesystem APIs, host stores, and SQLite, but not browser file outputs. Release Center's
    verified File System Access export and honest anchor-download fallback, plus Agent Bridge's non-authoritative
    manifest download, must be declared and count-pinned.
  - `src/lib/modCompiler.ts` still contains an uncalled browser filesystem compilation stack (`compileAndSaveAll`,
    `writeTextFile`, directory/snapshot helpers). Repository-wide caller reconciliation found zero consumers; removal
    is safer than immortalizing a second authority beside the server artifact pipeline.

## IMPLEMENT

- Extended `workspaceState.atomicWriteFile/atomicWriteJson` with unique sibling temps, pre-promotion failure injection,
  restricted-mode enforcement before promotion, and no-litter/prior-byte negative fixtures.
- Migrated Studio token, AI usage, XSD config, instance discovery, schema harvest/cache, snapshot/mod-id, filesystem
  create, and Lua instrumentation writes to the server atomic authority.
- Made capped AI usage fail closed on corrupt, invalid-shape, unreadable, and unwritable state. The server now treats
  only `ENOENT` as first run, reports meter availability in `/api/ai/usage`, and reserves call count plus estimated USD
  in one atomic write before provider selection or network dispatch.
- Reworked agent-key and AI-provider-key stores so corrupt state refuses overwrite and authoritative mutation either
  persists or leaves prior memory/disk state. Credential files use restricted atomic JSON.
- Added the packaged-extension `durableWrite` authority. Recommendations/settings/proof files use atomic replacement;
  AGENTS.md + X4_NOTES.md use one staged set with rollback. Failed rollback preserves the known-good backup rather
  than deleting it.
- Added `config/durable-writers.json` plus `scripts/durable-writer-audit.mjs`. The precommit-enforced inventory covers
  synchronous and asynchronous filesystem primitives, browser/session/Antigravity host stores, SQLite mutation and
  transaction counts, and rejects undeclared/stale/count-drifted owners or incomplete failure contracts. SQLite
  schema migration, game-root rebinding, and replacement metadata now commit with their coupled mutations.
- Scope changes and reasons: source reconciliation found the initial inventory omitted async and host persistence, so
  those accepted categories were added. Fresh-eyes review also found the server adapter masked meter read errors and
  the extension rollback cleanup could delete a recovery backup; both were correctness requirements inside R7.

## VALIDATE

- Pre-correction evidence only: `npm run test:writers` -> PASS after the first source review: audit selftests 11/11;
  live inventory 31 filesystem source
  files / 11 host-store source files / 46 SQLite mutation statements / 7 transactions / 14 statement runs / 12 exec
  calls / 2 pragmas; extension rollback oracle 8/8. Counts plus a mutation-callsite fingerprint are enforced.
- SQLite cache oracle -> PASS 10/10, including failed object-index metadata and failed game-root identity updates
  rolling back their preceding row deletions/replacements.
- Focused selftests -> PASS: workspace state 16/16; spend meter 23/23; agent keys 31/31; AI key store 8/8; instance
  discovery 16/16; schema discovery 14/14; mod-folder 15/15.
- `npm run typecheck` -> PASS after the current implementation and review corrections.
- Extension build -> PASS from a fresh `vscode-extension/out`.
- `npm run lint` -> PASS with 0 errors / 555 pre-existing warnings. The first run reported 557 because two new
  explicit-`any` catches had been introduced; both were removed before the clean rerun.
- Final post-correction evidence:
  - `npm run test:writers` -> PASS: policy 14/14; live inventory 31 raw filesystem sources, 11 host-store
    sources, 2 browser-output sources, 47 SQLite mutation statements, 7 transactions, 14 runs, 14 execs, and
    2 pragmas; extension durable-write oracle 8/8.
  - `npm run test:routes` -> PASS 278/278, including meter corruption/readout and refusal before provider dispatch.
  - `npm run test:oracles` -> PASS 125/125 through the isolated runtime-discovered harness; spend meter 24/24,
    database rollback 11/11, and all workspace/recovery regressions green.
  - Extension build, root typecheck, and root production build -> PASS. Lint -> PASS with 0 errors and the exact
    555-warning baseline after removing the one warning introduced by the new DB fixture.
  - Staged packaged app probe -> PASS 16/16. A disposable locally packaged VSIX passed final-byte inspection with
    2,091 entries, 60,375,858 unpacked bytes, and 17,899,313 archive bytes; the public-parity 0.0.62 artifact was
    not overwritten. Environment policy refused deletion of the exact inert `%TEMP%` validation package.
  - Full serial `npm run test:e2e` -> PASS 50/50 in 537.7 seconds with zero failed/flaky/bad/quarantined results;
    structured receipt `test-results/e2e-verdict.json`. Ports 3100/3101 closed afterward and the standing installed
    sidecar/discovery remained unchanged on 50755.
  - `npm run precommit:check` -> PASS; `graphify update .` -> PASS at 3,106 nodes / 7,272 edges / 146 communities;
    mirrored agent instructions remain byte-identical and stale dead-compiler references were removed.

## REVIEW

- Requirement review complete:
  1. Complete production writer/database/browser-output inventory -> done and source-enforced.
  2. Undeclared/count/category/owner/rationale/failure/stale rejection -> done, 14/14.
  3. Unique sibling-temp atomic replacement/prior-byte/no-litter/mode proof -> done.
  4. Named token/config/key/spend/discovery/snapshot/extension files and paired rollback -> done.
  5. Enabled capped spend corrupt/read/write/future refusal before network; disabled legacy availability -> done.
  6. Agent-key persist-or-memory-rollback -> done.
  7. Stronger tree/release/SQLite/append/scratch authorities retained and declared -> done.
  8. Isolated gates and packaged extension evidence -> done; no live mod/game/provider/profile mutation.
  9. SQLite extension metadata rollback, browser-output pinning, and dead compiler removal -> done.
- Fresh-eyes corrections made before close:
  - Server `AI_USAGE_FILE` adapter masked non-ENOENT failures as first run -> now propagated and route-tested.
  - Call count and USD cost used two writes with the second swallowed -> now one pre-dispatch reservation.
  - Malformed prior-day usage could reset the cap -> full shape/counter validation now precedes rollover.
  - Extension rollback cleanup could delete the backup after a double rollback failure -> backups delete only after
    complete commit, with a deterministic double-failure preservation fixture.
  - Initial audit missed `fs/promises` and host stores -> both are now count-pinned and categorized.
  - SQLite cache replacements committed their built-at metadata after the row transaction, and game-root rebinding
    cleared four tables before committing the new root identity -> coupled writes now share transactions and have
    injected metadata-failure rollback proofs.

## CLOSE

- Status: VERIFIED
- What was deliberately not changed: proven whole-tree deployment/release transactions, append-only history,
  SQLite itself, R8/R17 workspace identity, R13 polling, live profile/game/mod data, and the public 0.0.62 package.
- Capability-map delta: source-enforced durable-writer inventory; fail-closed capped spending through the route
  adapter; atomic/rollback-safe authoritative server and extension files; coupled SQLite visibility metadata.
- Remaining risk: filesystem atomic rename cannot guarantee storage hardware flush across power loss. The inert
  validation VSIX remains at `C:\Users\Moshi\AppData\Local\Temp\x4forge-r7-validation.vsix` because exact-file
  deletion was policy-blocked; it is not installed or referenced by the product.
- Suggested commit title: `refactor(persistence): enforce durable writer discipline`

## AAR

- Triggered. Planning found the spend meter fail-open on corrupt/write failure, a higher-risk condition than a generic
  direct-write inventory gap.
- Tool/approach failures to retain at close:
  - One parallel extension-build/root-typecheck run deleted `vscode-extension/out` during typecheck and produced a
    transient TS6053. Build and typecheck must be sequential when generated extension outputs are part of root inputs.
  - The combined baseline probe aborted because one nested command failed; failure-tolerant split reads recovered.
  - A focused mod-folder invocation checked nonexistent `result.pass` although the oracle returns `allPassed`; the
    corrected command proved 15/15.
  - The first manifest patch response was truncated, so file existence/JSON parse was re-proven before use.
- Sustain: resource-level reconciliation kept stronger tree/database authorities and exposed the real spend-meter
  and rollback defects before close.
- Improve tools: keep the writer audit in precommit and keep generated-output builds serialized with root validation.
- Highest-risk evidenced weakness: a safety meter can be fail-closed internally but fail-open through an adapter that
  collapses all read errors into missing state. The bounded fix is exact error classification plus a real route test.
- Additional close triggers: the yielded oracle handle was lost during compaction and required a retained rerun;
  a too-short shell wrapper let one oracle child finish without evidence; ESLint's removed compact formatter required
  a JSON fallback; review found and removed one new explicit-`any` warning; policy rejected both dynamic and exact
  deletion of the disposable VSIX. Project/global lessons are finalized in the two AAR ledgers.
