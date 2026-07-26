# Forge user-friction pass — "the Forge knows the answer and makes me re-derive it"

Task: B93 user-friction pass (10 items from the resident mod agent, 2026-07-25)
Lane: FULL
Status: SPECIFIED

## THE PATTERN (the reporter's own framing, and it is correct)

> "It knows its own port — I scan for it. It knows how to walk a mod folder — I reimplemented it.
> It knows the canvas is stale and how to fix it — I do that by hand. It knows what deploy is about
> to delete — I diff afterward."

Almost every item is **withheld knowledge**, not a missing capability. That makes most of them small,
and it makes the sequencing obvious: expose what exists first, then harden the write/deploy path,
then deepen validation.

## RECONCILE (done before scheduling — two items are already mostly built)

- **`.studio-api-token` is written to `process.cwd()`** (`server.ts:187`). For the packaged sidecar
  cwd is `app/` inside the extension install directory, which is why an external agent cannot find
  it — and it carries no port. Item 1 is a relocation + adding the port, not new machinery.
- **`resolveModFolder(reqPath, requestedRoot)` ALREADY supports a root selector** (`server.ts:5049`)
  and `round-trip-check` already passes `{path, root}`. `project/validate` accepts `fromPath` but
  never forwards a root. **Item 3 is a ~3-line change**, not a reimplementation of the file model.
- **No status endpoint exists** — only `/api/agent/health-card`. Item 5 is genuinely new, but it is
  an aggregation of values the server already holds.
- **`round-trip-check` / `strictLossless` already works** — confirmed independently by the reporter
  and re-run here: `strictLossless: true`, 49 in / 45 out. Not in scope; do not touch.
- Item 10 overlaps existing **B82** (well-formedness inside `runProjectValidation`) and **B88**
  (validate-on-write). Those specs stand; this plan sequences them rather than duplicating them.

## THE TEN ITEMS (nothing dropped; each maps to a wave)

| # | Item | Wave |
|---|---|---|
| 1 | Port+token discovery file at a well-known path | 1 |
| 2 | Error quality: 405 on wrong verb, never 200 on a degenerate result, 400s that say what was wrong | 1 |
| 3 | `project/validate` accepts `{root, path}` like `mod-folder/import` | 1 |
| 5 | `GET /api/agent/status` — one "where am I?" call | 1 |
| 4 | Deploy `autoReimport`, or an error naming the exact unblocking call | 2 |
| 6 | Deploy dry-run: would add N, overwrite M, **delete K** — before it happens | 2 |
| 7 | Line endings preserved, or reported at write time | 2 |
| 9 | Ledger records file effects (added/overwritten/deleted + sizes) | 2 |
| 8 | Single-expression validation endpoint | 3 |
| 10 | "Legal but does nothing" — well-formedness first, unknown properties, phantom ids | 3 |

## WAVE 1 — expose what the Forge already knows

**1. Discovery file.** On listen, write `{port, token, pid, startedAt, cwd, mode}` to
`~/.x4forge/instances/<pid>.json` and mirror the newest to `~/.x4forge/latest.json`. Remove own file
on exit; prune files whose pid is dead on startup so a crashed instance cannot mislead. File mode
`0600`. **Credential note:** the session token already lives on disk (`.studio-api-token`); this
relocates it to a stable per-user path rather than creating a new class of secret. It must never be
written inside a mod, game, or workspace directory.

**2. Error quality.** (a) A JSON 405 with an `Allow` header for a known path hit with the wrong verb,
instead of the SPA HTML fallback — the reporter nearly filed a working endpoint as missing.
(b) `mod-folder/import` must not return 200 with a degenerate workspace: if the resolved folder has
no `content.xml` and no recognised mod content, reject with a specific 400. (c) 400 bodies name the
offending value and what was expected, not just the grammar.

**3. `project/validate` takes `{root, path}`.** Accept `path` as an alias for `fromPath` and forward
`root` into the existing `resolveModFolder`. The reporter classified 34 files by hand, got
`libraries/*.xml` wrong, and blamed the Forge's reference data for the resulting 16 warnings.

**5. `GET /api/agent/status`.** One call returning: port, workspace name + version + content hash,
configured roots, whether the canvas is stale versus its source folder, last deploy (mod, path,
time), schema/corpus readiness, and ledger counts. Public-readonly-GET allowlisted.

## WAVE 2 — make writes and deploys legible before they happen

**6. Deploy dry-run** (`dryRun: true` on `deploy-verify`): run the plan and report `added`,
`overwritten`, `deleted`, `preserved` with sizes, **writing nothing**. Deletion is the direction
that cannot be undone, so this is the highest-anxiety item on the list.

**4. Stale-source remedy:** `autoReimport: true` re-imports from the stamped source and proceeds;
without it, the failure message names the exact call that unblocks it. The guard itself is correct
and stays — it prevented a real data-loss incident.

**7. Line endings:** preserve incoming bytes exactly; if any normalisation happens, report it in the
write response so byte-exact readback stays a valid check instead of something callers must weaken.

**9. Ledger file effects:** deploy/compile rows carry added/overwritten/deleted counts and sizes,
reusing the B86 blob store for the detail list.

## WAVE 3 — the validator that says "legal, and it will do nothing"

**8. Single-expression check** — `POST /api/agent/check-expression {expression, context}` answering
one question without a 34-file payload.

**10. Semantic gates** — well-formedness ALWAYS first (B82), unknown script properties and phantom
ids as errors on the authoring path (B88 + existing reference sets). This is the item the reporter
calls the 10× multiplier, and the Forge already holds the data: 258 scriptproperty datatypes, 32
factions, 1,902 wares.

## WAVE 4 — B81 + B88 (added 2026-07-25, after 0.0.43)

### B81 — `/api/fs/read` root selector

**RECONCILE:** `fs/read` resolves `filesystemPath || modWorkspacePath` (deployment first) with no
selector. Two UI callers pass no root: `DirectoryExplorer.tsx:135` and `LibraryConfigurator.tsx:251`.
The project's existing selector vocabulary is `workspace|filesystem` (`parseProjectSourceRoot`), while
the reporting agent's mental model is `deployment` — accept **both**, since `filesystem` IS the
deployment role.

**Plan (the migration order B81's own spec demands — never silently change one side):**
1. Accept `?root=workspace|filesystem|deployment`.
2. **Cover the two UI callers first** by making them pass `root=filesystem` explicitly, preserving
   their behavior exactly.
3. **Only then** flip the unqualified default to `workspace`, which is what an agent doing
   read-modify-write means every time.
4. **No silent fallthrough.** If the requested root lacks the file, 404 naming the root — and, when
   the *other* root has it, say so and name the parameter that would reach it. Silent fallthrough is
   precisely what made this bug invisible.
5. Report `root` and the absolute path in the response so a caller can always see which copy it got.

**Acceptance:** same relative path present in both roots returns the workspace copy by default and the
filesystem copy on request; a workspace-only file 404s under `root=filesystem` with a message naming
the other root; invalid selector 400s; traversal still 403s; both UI callers keep reading the
deployment; a read-modify-write through `fs/read` → `fs/write` now operates on one root.

### B88 — validate on write

**RECONCILE:** `checkXmlWellformed` and `lintScriptPropertyChains` are both pure and already used
elsewhere. The full `runProjectValidation` needs a whole project and a loaded schema/corpus, so
running it per write would be heavy and would often be *unavailable* — an honest subset beats a
sometimes-absent superset.

**Plan:** in the guarded write path, before writing, run on the INCOMING bytes:
- every `.xml` file → XML well-formedness (milliseconds; the reporter added exactly this to their own
  harness after the `</do_else>` incident);
- MD/AIScript files → scriptproperty chain lint when the index is loaded.
Return `validation: { ran, ok, findings[] }` naming which checks ran, so nobody mistakes it for the
full stack. `strict: true` rejects with 422 and **writes zero bytes**.

**Acceptance:** a malformed XML write returns findings and still writes by default; the same write with
`strict:true` returns 422 and the file is unchanged on disk; `$station.manager` produces a
scriptproperty finding; a clean write is unchanged in shape apart from the added block; a binary/Lua
write is unaffected; `validation.ran` names the checks honestly when the index is absent.

## ACCEPTANCE (per wave, gates each time)

Every wave: typecheck · lint at baseline · oracles · routes · e2e 26/26 · precommit · build, plus
route-integration assertions for each new contract and a negative path for each. No wave is claimed
without its gates. Live validation in the installed IDE for anything user-visible.

## RISKS

- The discovery file is a credential path — wrong location or permissions would be a security
  regression. Mitigation: per-user home dir, `0600`, never inside mod/game/workspace roots, pruned
  on stale pid.
- 405/400 changes touch the request path for every route; the SPA fallback must still serve the app
  for real page loads. Mitigation: only known API paths get 405; everything else is unchanged.
- Deploy dry-run must share the real planner or it will drift from reality and lie. Reuse the
  artifact plan; do not compute a second estimate.

## ROLLBACK

Each wave is an independent commit; reverting one leaves the others working.
