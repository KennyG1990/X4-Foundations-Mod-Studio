# X4 Forge — Known Bugs Ledger

**Owner:** Ken · **Kept by:** the agent building `x4_ai_influence` against the Forge
**Started:** 2026-07-28 · **Rule:** an entry only goes in here once it has been *observed*, with the
evidence quoted. No speculation, no "might be".

Numbered `KB-*` design/feature requests live in `ROADMAP.md`. **This file is for defects** — things that
behave incorrectly, silently, or misleadingly while building a real mod.

Severity: 🔴 corrupts work or hides failure · 🟡 costs time · ⚪ cosmetic / docs

> **AUDIT SWEEP 2026-07-29.** Entries FB-13 onward come from a systematic chief-engineer audit of the
> whole repo (server, frontend, extension, dependencies, tests, build) conducted 2026-07-29. Each
> quotes the file:line evidence it was read from; tool output (lint / npm audit / test runs) is
> quoted verbatim where used. Scope note: the standalone webapp is retired — the **VS Code extension
> is the product**, and `server.ts` ships as its managed sidecar (`NODE_ENV=production`,
> `FORGE_ALLOW_RUN_COMMAND=""`, token via env — see FB-16 for what still leaks). Existing entries
> FB-1/3/6/8/10/12 carry dated `STATUS 2026-07-29` amendments from the same sweep. Improvement
> recommendations (non-defects, owner-requested) live in the **ADDENDUM** at the bottom and can be
> promoted to ROADMAP `KB-*`.

---

## 🔴 FB-1 · `/api/fs/read` and `/api/fs/write` resolve to DIFFERENT ROOTS

**Observed:** Forge 0.0.40, 2026-07-25, and still current 2026-07-28.

`/api/fs/write` correctly routes to the **workspace** (`F:\DEV_ENV\projects\Mods\X4Mods`).
`/api/fs/read` resolves to the **deployment** (`G:\...\extensions`) and 404s on workspace-only files.

**Why it is the worst one here.** A read-modify-write patch chain reads from G: and writes to F:. The
moment the two roots diverge, every subsequent read returns *stale* content, so **patch 2 silently clobbers
patch 1** and the tool reports success both times. Nothing warns.

**Workaround in use:** read from workspace disk directly, write **through** the API (so the Forge stays the
write authority), verify the readback from workspace disk. Encoded in `tools/forge.py`'s header.

**Fix:** make both verbs resolve the same root, or make `read` accept an explicit `root` parameter and
**error** rather than silently falling back.

### ✅ STATUS 2026-07-29 — audit-verified FIXED (B81)

Read now defaults to the workspace (`server.ts:3737` `const chosen = selection.root || 'workspace'`),
write stays hardcoded to `modWorkspacePath` (`server.ts:3943-3944`), and both map through the same
`configuredProjectRoot` helper (`server.ts:3648-3650`). When the file exists only in the *other* root,
read now says so and names the parameter to use (`server.ts:3751-3768`) instead of silently falling
back, and every response echoes `root` + `absolutePath` so a caller can tell which copy it was served.
The read-G:/write-F: clobber chain is closed. The workaround in `tools/forge.py` can be retired
whenever convenient — it is no longer load-bearing.

---

## 🔴 FB-2 · Validation cannot see the MD↔Lua wire contract, so a total outage validates clean

**Observed:** 2026-07-27. `x4_ai_influence` sends order sets Lua→MD as a flat indexed table (`v1`,`t1`,`c1`…).
A new feature claimed key `g<n>`, which another feature already used for the station idcode. **Every order
the player gave was rejected for three builds.**

Forge validation for the same tree: **27 files, 0 structural, 0 schema, 0 `mdLuaMissingRegisters`,
0 `luaMdMissingListeners`.**

**Why nothing caught it.** Both halves are individually valid — Lua may write any string key, MD may read
any string key. `mdLuaMissingRegisters`/`luaMdMissingListeners` assert which *cues talk*; nothing asserts
what they *say*.

**Implemented mod-side as `tools/wiregate.py`** (~60 lines) and offered upstream: collect every
`payload["<k>" .. n]` write and every `param3.{'$<k>' + $si}` read, classify each read as **global** (no
`$sv ==` verb branch among its XML ancestors) or **verb-scoped**, and fail when a key is both. Also fail on
write-with-no-read and read-with-no-write.

### ⚠️ CORRECTION 2026-07-28 — it sees MORE than this entry claimed, and that is its own hazard

The blanket claim above is **wrong in one important respect**. Forge validation *does* track Lua event
listeners, and it does so by **matching the literal source text `RegisterEvent("`**.

Proven by accident: a purely cosmetic refactor renamed those 43 call sites to a local wrapper `reg(...)`.
Every mod-side gate passed. The Forge then refused the deploy with

```
[fail] Full validation (schema/cues/lints)   0 schema, 0 cue, 77 cross-file, 0 aiscript error(s)
```

— every `raise_lua_event` had become an unanswered signal, because the listeners were no longer *spelled*
the way the scanner looks for. It was the only thing in the entire pipeline that caught it.

**Two consequences worth recording:**

1. **Credit where due** — cross-file validation is real and load-bearing. The gap in this entry is narrower
   than "cannot see the wire contract": it sees *which events are listened for*, and does not see *what the
   payload keys mean*. Only the second half needs `wiregate.py`.
2. **The detection is textual, so it is brittle in both directions.** A false negative is one rename away,
   and a **false positive is one comment away**: writing the token `RegisterEvent("` inside a comment
   explaining the mechanism made the scanner parse the comment as a registration and swallow everything to
   the next quote, producing a phantom cross-file error. The comment about the pattern broke the pattern.

**Suggested fix:** resolve listeners from a parse rather than a substring scan, or at minimum ignore matches
inside Lua comments (`--` to end of line, and `--[[ ]]` blocks). Failing that, document that the literal
spelling is load-bearing so mod authors know not to wrap or alias it.

---

## 🟡 FB-3 · Deploy is not gated on validation

**Observed:** 2026-07-28. A tree with `schemaErrors: 1` (an `XSD_CHILD_ORDER` violation — `<delay>` placed
before `<conditions>`) deployed with `RESULT: FIDELITY OK`. Fidelity checks that the *bytes arrived*; it
says nothing about whether the engine will accept them.

**Consequence:** the game loads a file the engine rejects, and the failure surfaces as unexplained
in-game misbehaviour rather than a build error.

**Workaround:** the mod's own `deploy.py` now refuses on `structuralErrors`, `schemaErrors`,
`aiscriptErrors` or `unresolvedCueRefs` from the last validation run.

**Fix:** the Forge's own deploy should refuse by default, with an explicit `--force`.

### ⚠️ STATUS 2026-07-29 — PARTIALLY FIXED

`deploy-verify` now hard-gates: nonzero schema/cue/cross-file/aiscript errors fail the `preflight`
stage and return `ok:false` before any bytes move (`server.ts:9557-9560`), so "FIDELITY OK" can no
longer print over a schema-invalid tree **via that route**. The hole survives in the legacy route —
see **FB-13**.

---

## 🟡 FB-4 · `scriptproperty.unknown` false positives train you to ignore warnings

**Observed:** persistent, 2 findings every run.

```
{"code":"scriptproperty.unknown","chain":"$nsh.cargo.free.all?","segment":"all",
 "suggestions":["age","hull","null"]}
```

`cargo.free.all` **works in-game** and has for months. The validator does not model this chain, so it
reports a valid expression as unknown and suggests unrelated segments.

**Why it matters beyond the noise:** a permanent false positive is worse than no check — it teaches you to
skim the warnings block, which is where the *real* findings appear.

**Fix:** model the chain, or let a mod declare known-good chains so the list can legitimately reach zero.

---

## 🟡 FB-5 · `reference.unknown_ware` fires on dynamic ware lookups

**Observed:** 3 findings every run.

```
{"code":"reference.unknown_ware","kind":"ware","id":"name","suggestions":["ice","ore","water"]}
```

The literal `id` is `name` — i.e. the validator is reading a **variable** ware reference
(`ware.{$something}`) as though `name` were a ware id. Same class as FB-4.

---

## ⚪ FB-6 · The write-conflict dialog does not say which side is newer

**Observed:** 2026-07-27. Ken: *"I'm a little scared, the forge is giving me this warning and idk what to do
about it."*

The dialog reports a conflict without stating which copy is newer, what changed, or which button keeps
which version. It is the one moment in the tool where a wrong click loses work, and it gives the user the
least information.

**Fix:** show both timestamps, the changed-file count, and label the buttons with the *outcome*
("keep canvas / keep disk") rather than a generic confirm.

### ⚠️ STATUS 2026-07-29 — STILL PRESENT, and it has a quieter sibling

The dialog still shows only `⚠ WRITE CONFLICT  [ADOPT SERVER] [KEEP MINE]` with the decision-critical
context buried in hover tooltips (`src/App.tsx:1855` region). Worse, the audit found a second path
that bypasses the dialog entirely — see **FB-15**.

---

## ⚪ FB-7 · Port + token discovery is published but undocumented

**Not a defect in the Forge** — recorded here because it cost real time.

The sidecar does the right thing and logs it:

```
port: 50657 (dynamically selected)
[discovery] port + token published to C:\Users\Moshi\.x4forge\latest.json
```

But `AGENT-USING-THE-FORGE.md` does not mention `~/.x4forge/latest.json`, so an agent client written from
the docs port-scans instead. After a power cut invalidated a cached port, that cost **~20 minutes** of
scanning for a service that had published its address.

**Fix:** document `~/.x4forge/latest.json` as *the* discovery mechanism, and note that the durable `x4fk_`
key — not the session token in that file — is the credential to present.

---

## ⚪ FB-8 · The bundled MCP server is not registered

`vscode-extension/mcp/x4forge-mcp.cjs` exists (B56s4, 11 curated tools, scoped agent key, deploy
deliberately excluded) and `.mcp.json` lists only `claude-brain`. The server is wired to nothing, so no
agent finds it.

Also missing from its tool surface, measured against what a real mod build actually needs: **file read and
write**. Every patch still goes through raw HTTP because the MCP cannot touch files. Adding them requires a
write-scoped key, which the server already enforces server-side.

### 📋 AUDIT NOTE 2026-07-29

The MCP server's surface was audited for this ledger: 10 tools, all read/validate/compile — deploy,
`fs/write`, `run_command`, and AI generation are deliberately absent; stdio-only (it listens on
nothing); authenticates with a scoped `x4fk_` agent key enforced server-side
(`vscode-extension/mcp/x4forge-mcp.cjs`). **It is safe to register as-is** — the defect remains
purely that nothing points at it. Decide: add it to `.mcp.json`, or remove it. A bundled server
wired to nothing is documentation debt in either direction.

---

## 🔴 FB-9 · Mirroring `tools/` into the deployment makes validation silently self-deceiving

**Second-order consequence of FB-1**, but it deserves its own entry because the symptom is the opposite of
FB-1's: nothing errors, nothing 404s, and the tooling reports *success*.

The mod's 11 deploy gates each resolve their target directory relative to their own file. `tools/` is
mirrored into the deployed mod on G:, so **two copies of every gate exist**. The workflow is:

```
write through the Forge (lands on the F: workspace)  ->  run gates  ->  deploy  ->  commit
```

Running `python tools/ordergate.py` from the G: directory — the natural thing to do, since G: is where the
game reads the mod from and where a shell naturally sits — runs the **deployed gate against the deployed
sources**, i.e. *the previous build*. The gate passes. It is answering a question nobody asked ("was the
last build clean?"), while the build actually being validated is never examined.

Two builds (#395, #396) were gated this way tonight before it was noticed. Both turned out genuinely clean
when re-run against the workspace, so nothing shipped broken — but that was luck, not process.

**How it was caught:** an edit to a gate's own summary line did not appear in that gate's output. The exit
code was `0` before and after. Nothing else would have surfaced it.

**Why it matters more than a normal false pass:** a gate that fails loudly is a working gate. A gate that
passes without reading the code under test is indistinguishable from a gate that passed for good reasons,
and it defeats the entire purpose of gating deploys.

**Mitigation (mod side, done):** `tools/rungates.py` runs all 11 gates, prints the root it validated on
every run, and **refuses with exit 2** when invoked from a path containing `steamapps/common`.

**Fix (Forge side):** either exclude `tools/` from the deployment mirror, or have deploy write a marker file
into the deployed tree that developer tooling can detect and refuse to operate on. The general principle:
anything mirrored into a build output should be able to tell that it is the copy, not the original.

---

## 🟡 FB-10 · `deploy-verify` reports `ok:false` in a field callers routinely ignore

**Observed:** 2026-07-28.

`POST /api/agent/deploy-verify` behaves correctly — when validation fails it refuses to write, marks the
remaining stages `[skipped] Not reached`, and returns `ok:false`. The problem is purely one of API shape:
the *reason* lives in `checklist[].status == "fail"`, while `ok` is a single boolean easily read past.

A client that prints the checklist for humans and then computes its own verdict from file comparisons will
happily announce success over a deploy that never happened — which is exactly what
`x4_ai_influence/tools/deploy.py` did until it was fixed:

```
ok        : False
[fail] Full validation (schema/cues/lints)  ...  77 cross-file
[skipped] Written to staging + extensions   Not reached - fix the failure above first.
...
RESULT: FIDELITY OK          <-- the client's own line
```

**Not a defect in the Forge** — the data was all there and accurate. Recorded because the failure mode is
predictable enough to design against: a response whose headline is a boolean and whose *reason* is buried in
an array invites callers to act on the array and forget the boolean.

**Suggested fix:** include a top-level `error` / `failedStages` summary string alongside `ok`, so a client
that logs one line logs the right one. (`error` already exists in the response but is empty on a
validation-stage failure.)

### ⚠️ STATUS 2026-07-29 — PARTIALLY FIXED

`ok:false` is reliably top-level via `failWith` (`server.ts:9351-9358`). But a *validation-stage*
failure still carries **no top-level `error` string** — the reason ships only inside `checklist[]`
and `preflight.findings` (`server.ts:9560`); `error` appears only on the exception path
(`server.ts:9691`). A client that logs `res.error ?? "ok"` still logs "ok" over a refused deploy.
The suggested fix stands.

---

## ⚪ FB-11 · The canvas "out of sync" warning fires twice on every API-driven deploy

**Observed:** repeatedly, 2026-07-28.

Any workflow that writes through `/api/fs/write` and then deploys produces:

```
[warn] Canvas in sync with source folder   Was stale; re-imported x4_ai_influence from disk on request
                                           (autoReimport) and continued
[warn] Canvas in sync with source folder   The mod folder on disk changed AFTER this canvas imported it
```

The first warning says it *fixed* the staleness; the second immediately re-reports it under the same label.
Both are warnings, the deploy proceeds, and the bytes land correctly — so this is cosmetic. But two
identically-labelled warnings where one says "resolved" and the other says "still true" is exactly the kind
of noise that trains an operator to skim the checklist, which is how FB-10 stayed invisible.

**Suggested fix:** suppress the second warning when `autoReimport` already resolved it, or label them
distinctly (`canvas.reimported` vs `canvas.stale`).

---

## 🔴 FB-12 · `deploy-verify` deploys the ACTIVE WORKSPACE, not the mod you asked for — silently

**Observed:** 2026-07-28, and it very nearly shipped a green light over the wrong mod.

`POST /api/agent/deploy-verify` takes `{workspace: null, autoReimport: true}`. There is **no mod identity in
the request**, so it operates on whatever workspace the Forge currently considers active. After a Forge
restart (the port moved 50657 → 63995) the active workspace came back as a *different mod*, and the deploy
ran to completion against it:

```
[pass] Mod source read              active workspace "Player_Elite_Escort"
[pass] XML well-formed              3 emitted XML file(s) parse cleanly
[pass] Written to staging + extensions   ...\extensions\player_elite_escort (+ staging)
[pass] Deployed bytes confirmed     content.xml 447b, id "player_elite_escort"
[pass] Workspace/deployed sync      verified loose artifact: 5 source/generated files
```

**Every stage passed.** `ok:true`. The caller asked to deploy `x4_ai_influence`, and the Forge deployed
`player_elite_escort` — correctly, thoroughly, and for the wrong mod. The only reason this was caught is
that the client compares the *deployed* Lua against the *workspace* Lua and folds the result into its
verdict (the FB-10 fix); that check fired `*** MISMATCH — THE DEPLOYED LUA IS NOT THE ONE YOU BUILT ***`.

Without that byte comparison, the run reads as a clean successful deploy of the wrong mod.

**Why it is severe:** the checklist is the operator's whole picture, and every line of it is true — about
a mod nobody asked about. There is no line anywhere in the response that says *"you asked for X, I did Y"*,
because the request never carried X in the first place.

**Mitigation (client side):** assert `res["modId"] == "x4_ai_influence"` before trusting any stage, and keep
the workspace-vs-deployed byte comparison in the pass/fail verdict.

**Suggested fix (Forge side):** accept an explicit `modId` on `deploy-verify` and **fail loudly** when it
does not match the active workspace, rather than silently substituting. An agent client cannot see the
Forge's UI state, so "active workspace" is invisible context it has no way to check.

### ⛔ AMENDMENT — the agent API cannot recover from this at all

Re-tested properly. The import is NOT broken; the earlier `nodes: null` reading was a wrong assertion
against a response shape that has no `nodes` key. `POST /api/agent/mod-folder/import` with
`{root:'workspace', path:'x4_ai_influence'}` returns:

```json
{ "success": true,
  "workspace": { "name": "AI Influence",
                 "sourceFolder": "F:\\DEV_ENV\\projects\\Mods\\X4Mods\\x4_ai_influence" } }
```

**And the very next `deploy-verify` still reports `modId: player_elite_escort` and
`active workspace "Player_Elite_Escort"`.**

So importing a mod folder does **not** change what `deploy-verify` operates on. The two endpoints disagree
about which workspace is active, and nothing in the agent API bridges them — the active workspace is UI
state. **A headless client therefore cannot deploy at all while the Forge is pointed elsewhere, and cannot
fix it.** The only recovery is a human switching the active workspace in the Forge UI.

This escalates FB-12 from "silently deploys the wrong mod" to "**silently deploys the wrong mod, and the API
offers no way back**".

**Client mitigation (implemented, x4_ai_influence #410):** compare `res["modId"]` against the intended mod
immediately and refuse with a message that names both mods and the manual fix, instead of running every gate
and failing later on a byte mismatch that does not explain itself:

```
*** DEPLOY REFUSED: the Forge is pointed at a DIFFERENT MOD.
      asked for : x4_ai_influence
      Forge used: player_elite_escort
    Every stage below would pass - for that mod, not this one (Forge bug FB-12).
    The agent API cannot re-point it (import succeeds and changes nothing), so switch the
    active workspace to "AI Influence" in the Forge UI, then re-run.
```

Note the response still carried `ok: true` at that point — the Forge considered the run a success.

**Suggested fix (Forge side), in priority order:**
1. accept `modId` on `deploy-verify` and **fail** on mismatch rather than substituting;
2. make `mod-folder/import` set the active workspace (or expose `POST /api/agent/workspace/activate`);
3. failing both, echo the active workspace in every agent-API response so a client can detect the drift
   without inferring it from deployed bytes.

**Related:** FB-1 / FB-7 — the wider pattern of workspace identity being implicit rather than addressed.

### ⚠️ OPERATIONAL CAUSE — the Forge is a SHARED tool with ONE active workspace

This was not a random restart. **Codex was working on the Forge itself**, using `Player_Elite_Escort` as its
test workspace for an end-to-end validation run. The Forge has exactly one active workspace, shared by every
client, and switching it is a global side effect.

So FB-12 is not only "the API deploys the wrong mod" — it is **"two agents cannot use the Forge at once"**.
Anyone who switches the workspace to deploy silently reparents whatever the other client is doing.

**Operating rule for any agent using this Forge (learned the hard way, 2026-07-28):**
1. **Read `modId` before assuming the Forge is yours.** `deploy-verify` returns it; compare it to the mod
   you intend and refuse on mismatch (x4_ai_influence `tools/deploy.py` now does this — #410).
2. **If it names another mod, STOP and ask.** Do not switch. Another agent or a human may be mid-run, and
   the switch is invisible to them.
3. **If you must switch, switch back.** The workspace picker offers "Switch to the parked workspace X? The
   current canvas is parked first — switch back the same way", so the round trip is safe and lossless.
4. A parked workspace keeps its state (`AI Influence (279 nodes, 1 text file)` was parked and restored
   intact), so parking is not destructive — but an in-flight validation run against the *other* workspace
   very much is.

**Suggested fix (Forge side):** either scope the active workspace per API client/token, or expose it in
every response so a client can detect that it is about to act on someone else's canvas. Point 3 above is a
workaround, not a solution — it depends on the acting agent noticing, and the whole problem is that nothing
tells it.
### ⚠️ AUDIT VERIFICATION 2026-07-29 — PARTIALLY FIXED; the three gaps are exactly where you left them

1. `deploy-verify` now *accepts* identity-ish inputs — `body.path` (fresh import) and
   `body.workspace` (UI payload) (`server.ts:9387-9406`; the UI sends `{workspace}` from
   `src/App.tsx:1244-1248`) — but with neither, the fallback is still the global `activeWorkspace`,
   and there is still **no `modId` assertion** anywhere in the request.
2. `mod-folder/import` still does not activate: it returns `{success:true, workspace, report}` and
   never calls `commitActiveWorkspace` (`server.ts:5548-5575`).
3. There is still no `POST /api/agent/workspace/activate`; `activeWorkspace` remains one global
   (`server.ts:2186`) mutated unconditionally by `commitActiveWorkspace` (`server.ts:2223-2251`).

**Scope note that raises the stakes:** the extension is now the product, and it is designed for
exactly the multi-client shape that burned you — the webview UI, the MCP server (FB-8), and any
`x4fk_` agent client all share that one global. The "two agents cannot use the Forge at once"
operating rule is now the *designed* use case, so the Forge-side fixes above stop being optional.

---

## 🔴 FB-13 · The deprecated `/api/agent/deploy` route still deploys with zero validation gating

**Observed (audit 2026-07-29):** `server.ts:9206-9327`. The route's response carries
`deprecated: true, use: "/api/agent/deploy-verify"` yet remains fully functional: it gates only on
source-sync staleness and emitted-XML well-formedness. It never runs `runProjectValidation`.
This is FB-3's original hole, still open through the back door.

**Why it matters:** any client (stale tooling, a hand-written curl, an old agent) that calls the old
route ships a schema-invalid tree straight into the game extensions folder — the exact failure FB-3
documented — with the response *itself* admitting a better route exists. The UI uses deploy-verify
(`src/App.tsx:1244`), so the route serves only callers that should not exist.

**Fix:** return `410 Gone` with a pointer to `/api/agent/deploy-verify` (preferred — deploy-verify is
a strict superset), or run the same preflight inline. **Verify:** a route test asserting an invalid
tree is refused through the legacy path. **Effort:** small.

**Recommended fix (implementation):** replace the route body at `server.ts:9206` with a hard stop:

```ts
app.post("/api/agent/deploy", (_req, res) => {
  return res.status(410).json({
    ok: false, gone: true, use: "/api/agent/deploy-verify",
    error: "/api/agent/deploy was removed: it deployed without running validation. " +
           "POST /api/agent/deploy-verify is a strict superset (compile + full preflight + atomic deploy + byte verification).",
  });
});
```

Steps: (1) delete the ~120-line legacy handler; (2) add the 410 stub above; (3) add a
route-integration assertion `legacy_deploy_returns_410` (any payload, valid tree or not);
(4) grep `AGENT-USING-THE-FORGE.md`, `docs/`, and `scripts/` for `/agent/deploy` references and
point them at deploy-verify; (5) run `test:routes` + `test:oracles`. If a straggler client truly
needs the old shape later, re-add it explicitly with a `?force` that still runs the same
preflight — do not pre-build that door.

---

## 🔴 FB-14 · `/api/fs/write` is non-atomic, keeps no backup, and races a global write-receipt

**Observed (audit 2026-07-29):** `writeWorkspaceFileGuarded` writes with a bare
`fs.writeFileSync(safePath, content, 'utf8')` (`server.ts:3957-3959`) — no temp-file-then-rename, no
pre-overwrite snapshot. A crash or ENOSPC mid-write leaves a **truncated workspace source file**, and
the workspace is upstream of every compile and deploy. The correct discipline already exists in the
same file: `replaceValidatedDeployment` (`server.ts:8747-8819`) stages → backs up → promotes →
verifies → rolls back, with an EBUSY locked-root fallback.

Separately, the write-receipt is one global (`let lastWriteReceipt`, `server.ts:3966`): the handler
nulls it (:3970), the guarded write sets it (:3961), the response returns it (:4010). Two concurrent
`/api/fs/write` calls interleave so that **request A can report request B's bytes/hash as its own
receipt** — a false "written" confirmation, the same family of lie as FB-1.

**Fix:** write `.<name>.x4forge-tmp-<nonce>` then `renameSync`; return the receipt from
`writeWorkspaceFileGuarded` as a local instead of a global; optionally snapshot-before-overwrite using
the existing `/api/fs/snapshot` machinery. **Verify:** concurrent-write test for receipt isolation;
kill-during-write test proving old-or-new bytes, never partial. **Effort:** small.

**Recommended fix (implementation):** in `writeWorkspaceFileGuarded` (`server.ts:3938-3963`), adopt
the deploy engine's pattern:

```ts
const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const tmp = `${safePath}.x4forge-tmp-${nonce}`;
fs.writeFileSync(tmp, content, 'utf8');
fs.renameSync(tmp, safePath);            // same-dir rename: atomic on NTFS & POSIX
const receipt = describeWrittenBytes(String(content ?? ''), safePath);
return { safePath, receipt };            // caller returns receipt — delete the global
```

Steps: (1) make the function return the receipt instead of assigning `lastWriteReceipt`;
(2) delete the `let lastWriteReceipt` global (:3966) and the null/set/return dance at :3970/:4010;
(3) sweep `*.x4forge-tmp-*` orphans in the workspace root on boot (same pattern as the deploy
orphan sweep at :8765-8772); (4) keep the CAS `expectedSha256` precondition and
`validateIncomingBytes` exactly where they are — they run before the write and are unaffected;
(5) tests: `fs_write_concurrent_receipts_isolated` (two parallel writes, each response carries its
own sha256) and `fs_write_tmp_orphan_swept` (plant a tmp file, boot, assert gone). Windows note:
`renameSync` over an existing destination maps to `MoveFileEx(MOVEFILE_REPLACE_EXISTING)` — atomic
per-volume; the tmp file must live in the same directory as the target (it does).

---

## 🔴 FB-15 · The canvas silently adopts server state on version advance — no dialog, no dirty check

**Observed (audit 2026-07-29):** the workspace poll at `src/App.tsx:1314-1319`:

```ts
if (data.version > storedVer && !syncConflictRef.current) {
  setWorkspace(data.workspace);
  localWorkspaceDirtyRef.current = false;
  ...
}
```

A poll-observed version advance (a second tab, an MCP/agent client, an API save) replaces the local
canvas wholesale and **clears the dirty flag**, discarding unsaved local edits with no prompt. The
conflict dialog (FB-6) only triggers on a 409 from the user's own save attempt; this path never
routes through it. With the extension hosting UI + MCP + agent-key clients against one server, a
foreign version advance is a designed use case, not an edge case.

**Fix:** treat poll-observed version advance while `localWorkspaceDirtyRef.current` as a conflict and
route it through the existing dialog (after FB-6's fix makes that dialog informative).
**Verify:** two tabs, edit both, save in one — the other gets the dialog, not silent replacement.
**Effort:** medium.

**Recommended fix (implementation):** at `src/App.tsx:1314`, branch on the dirty flag before
adopting:

```ts
if (data.version > storedVer && !syncConflictRef.current) {
  if (localWorkspaceDirtyRef.current) {
    // A foreign client advanced the server while we hold unsaved edits: conflict, not adoption.
    syncConflictRef.current = {
      kind: 'poll-version-advance',
      serverVersion: data.version,
      serverWorkspace: data.workspace,
      detectedAt: Date.now(),
    };
    return; // the existing conflict UI (FB-6/R11) renders from syncConflictRef
  }
  setWorkspace(data.workspace);        // clean adoption path, unchanged
  ...
}
```

Steps: (1) add the branch above; (2) confirm the conflict dialog renders for
`kind: 'poll-version-advance'` (it keys off `syncConflictRef` being set — extend the ref's union
type to admit the new kind); (3) land the FB-6/R11 dialog improvements in the same PR so the
newly-routed conflicts are actually decidable; (4) test: two browser tabs (or tab + MCP client),
edit in both, save in one — the other must show the dialog and retain its dirty canvas.

---

## 🟡 FB-16 · The session token is still published to `~/.x4forge/latest.json` — sidecar included — and survives abnormal kills

**Observed (audit 2026-07-29):** `publishInstance` writes the full-power studio token to
`~/.x4forge/instances/<pid>.json` and `~/.x4forge/latest.json`
(`src/lib/instanceDiscovery.ts:128-141`, called from the server boot sequence,
`server.ts:10593-10636`). `writeRestricted` sets `0600`, but `chmod` is a no-op on Windows
(`instanceDiscovery.ts:66-71`) — the primary platform. Credit where due: the *extension* does its
part correctly — per-session 64-hex token, passed via env, never argv, never `.studio-api-token`
(`vscode-extension/src/extension.ts:357,391`). But the sidecar then publishes that same token to disk
anyway. `unpublishInstance` runs on SIGINT/SIGTERM/exit; a Task Manager kill or VS Code crash leaves
a **live token** behind.

**Impact framing:** exploitation needs code execution as the same user, so this is not a remote
hole — but the token is the only credential between a local process and deploy / key-management /
fs-write on the game folder. The discovery file's job (FB-7) is to publish the *address*; the
*credential* never needed to be in it.

**Fix:** remove `token` from `InstanceRecord` — publish `{port, pid, startedAt, mode}` only. Agent
clients already authenticate with durable scoped `x4fk_` keys (that is the documented flow).
**Verify:** `latest.json` contains no token field; the FB-7 discovery flow still works on port
only. **Effort:** small.

**Recommended fix (implementation):** in `src/lib/instanceDiscovery.ts`: (1) delete `token` from
`InstanceRecord` and from the `publishInstance` call site in `server.ts` (boot, :10593-10636) —
publish `{port, pid, startedAt, cwd, mode}` only; (2) keep `writeRestricted` as-is (0600 is still
worthwhile on POSIX); (3) add a boot-time sweep: delete `instances/<pid>.json` for any pid no
longer alive, so a crash cannot leave even a dead instance's address behind; (4) update the
discovery docs (FB-7's fix target, `AGENT-USING-THE-FORGE.md`) to state plainly: the file carries
the *port*; the credential is a scoped `x4fk_` key. Consumer check before merging: the extension
sets the token itself via env and never reads it back from the file; agent clients use `x4fk_`
keys — grep for `latest.json` readers to confirm no first-party consumer drinks the token field.
Tests: assert the published JSON has no `token` key; assert the dead-pid sweep removes a planted
stale instance file.

---

## 🟡 FB-17 · GitHub PAT lives in localStorage; "disconnect" does not remove it; the extension's port churn silently loses it anyway

**Observed (audit 2026-07-29):** `SourceControl.tsx:153,486,530,883` reads/writes `x4_github_pat` in
localStorage as plaintext — including the OAuth device-flow access token (:486).
`handleDisconnectGitHub` (`SourceControl.tsx:540-544`) sets `x4_github_connected` to `'false'` and
announces "Disconnected from remote peer." **without** removing `x4_github_pat`. The user believes
they disconnected; the credential persists. In the extension the bug inverts: webview localStorage is
origin-keyed to `http://127.0.0.1:<port>` and the sidecar port changes per session (FB-7 watched it
move 50657 → 63995), so the PAT silently *vanishes* between sessions — training the user to keep it
in a text file beside the mod.

**Fix:** store the PAT in VS Code `context.secrets` (extension side) or server-side in the existing
`aiKeyStore` pattern (write-only; the client sees configured-yes/no); make disconnect actually delete;
purge `x4_github_pat` from localStorage on boot the same way the AI-key migration already does
(`src/lib/apiHelper.ts:59-112` is the working template). **Effort:** small.

**Recommended fix (implementation):** follow the proven AI-key pattern end to end.
Server: (1) add `github` to the stored-key providers in `src/server/aiKeyStore.ts` (or a sibling
`gitCredentialStore` if you prefer separation); (2) `POST /api/github/credential` stores
(write-only), `GET /api/github/credential/status` returns `{configured: boolean}`, `DELETE
/api/github/credential` revokes; (3) in `src/server/githubRoutes.ts`, when a request arrives with
no `pat` in the body, fall back to the stored credential — mirroring the `x-custom-api-key` vs
stored-key split the AI routes already use.
Client (`SourceControl.tsx`): (4) replace every localStorage PAT read/write (:153,486,530,883)
with calls to the status/store endpoints; (5) `handleDisconnectGitHub` (:540) calls `DELETE` and
removes both `x4_github_pat` and `x4_github_connected` from localStorage; (6) boot migration: if
`x4_github_pat` exists in localStorage, POST it to the store once, then `removeItem` — same shape
as the AI-key migration in `src/lib/apiHelper.ts:59-112`. Tests: credential round-trip via the
API; disconnect leaves no PAT anywhere (localStorage or server store); `/api/github/load` with no
body PAT succeeds when configured and 401s when not.

---

## 🟡 FB-18 · The `autoSaveEnabled` toggle does nothing

**Observed (audit 2026-07-29):** `src/App.tsx:289` declares the state and `:1937` passes it to the
Sidebar; nothing in the workspace sync effect consults it — the 300 ms debounced sync runs
unconditionally. A setting that claims to control saving and doesn't is worse than no setting: a user
who switches it off believes their canvas stays local until they save, and it doesn't.

**Fix:** gate the sync loop on the flag (with a visible "unsaved changes" state), or remove the
toggle. While in there, audit every other settings toggle for effect — a settings page should never
contain placebo. **Verify:** toggle off → edit → server version does not advance. **Effort:** small.

**Recommended fix (implementation):** wire the flag into the sync effect in `src/App.tsx`:

```ts
useEffect(() => {
  if (!autoSaveEnabled) return;          // manual mode: only explicit Save flushes
  // ...existing 300 ms debounce sync, unchanged...
}, [workspace, workspaceSyncEpoch, autoSaveEnabled]);
```

Plus: (1) a header badge `● Unsaved changes` whenever `localWorkspaceDirtyRef.current &&
!autoSaveEnabled`; (2) an explicit **Save** button (and Ctrl+S) that calls the same flush the
debounce uses; (3) flip the default to `true` so behaviour is unchanged for existing users — only
users who opt out enter manual mode. If you would rather not support manual mode at all, delete
the toggle and the prop instead — either way the settings page stops lying. Test: toggle off →
edit → wait 2 s → server version unchanged → click Save → version advances.

---

## 🟡 FB-19 · localStorage quota failure deletes the entire workspace cache

**Observed (audit 2026-07-29):** `src/App.tsx:1141` — when `setItem('x4_mod_studio_workspace', …)`
throws, the handler `removeItem`s the whole key. Next reload with the server unreachable = no local
bootstrap at all. Compounding: `SourceControl.tsx` stores full workspace serializations
(`x4_git_baseline`, :173) plus an unbounded `x4_git_local_history` (:207,236) in the same 5–10 MB
origin quota — for a 2,000-node workspace the baseline alone can approach that.

**Fix:** on quota failure, evict in order (oldest history entries, then baseline) before touching the
primary cache; cap the history length; longer-term move baselines to the server or IndexedDB.
**Effort:** small.

**Recommended fix (implementation):** replace the blanket `removeItem` at `src/App.tsx:1141` with
ordered eviction that never touches the primary cache until the end:

```ts
function persistWorkspaceCache(json: string): void {
  const trySet = () => localStorage.setItem('x4_mod_studio_workspace', json);
  try { trySet(); return; } catch { /* quota */ }
  // 1) shed git history oldest-first
  try {
    const h = JSON.parse(localStorage.getItem('x4_git_local_history') || '[]');
    while (h.length) {
      h.shift();
      localStorage.setItem('x4_git_local_history', JSON.stringify(h));
      try { trySet(); return; } catch { /* keep shedding */ }
    }
  } catch { /* malformed history: fall through */ }
  // 2) shed the git baseline
  try { localStorage.removeItem('x4_git_baseline'); trySet(); return; } catch { /* fall through */ }
  // 3) last resort: keep the OLD cache and say so — never delete the only local copy silently
  setSyncStatusMsg('Local cache is full; work is safe on the server but no new local snapshot was kept.');
}
```

And cap `x4_git_local_history` at 25 entries at write time in `SourceControl.tsx` (:207,236).

---

## 🟡 FB-20 · Nothing enforces the quality gates: no CI runs typecheck/lint/tests, and a route test flaked during the audit

**Observed (audit 2026-07-29, direct tool output):**

- `.github/workflows/` contains only `discord-sync.yml`, `discord-to-github.yml`, `issue-sync.yml` —
  no workflow runs `typecheck`, `lint`, or any test suite.
- `node scripts/route-integration.mjs` reported **161/162 FAIL** on one run and **162/162 PASS** on
  the next, same code — a nondeterministic assertion somewhere in the suite.
- Clean bill, same day: `npm run typecheck` exit 0; `npm run lint` **0 errors**, 541 warnings; oracle
  sweep **111/111 green**. (The two `no-constant-binary-expression` errors from the dead
  `{false && …}` block at old `App.tsx:1564` were fixed during the audit window.)

**Why it matters:** the 273-check integration/oracle suite is this project's best asset; un-gated and
flaking, it decays silently, and the first person who sees CI go red for a flaky reason learns to
re-run until green — FB-4's alarm fatigue in CI form.

**Fix:** one workflow running `typecheck && lint && test:routes && test:oracles` on PR; hunt the
flake *before* gating on it; ratchet the 541 warnings downward. **Effort:** small.

**Recommended fix (implementation):** add `.github/workflows/quality.yml`:

```yaml
name: quality
on: [pull_request, push]
jobs:
  gates:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint -- --max-warnings 600   # ratchet down from 541 over time
      - run: npm run test:routes
      - run: npm run test:oracles
      - run: npm audit --audit-level=high
```

Flake hunt first: run `node scripts/route-integration.mjs` 10× locally and log which assertion
moves; prime suspects are time-dependent assertions, port allocation (use `findFreePort` per
test, never a fixed port), and the shared temp-root pattern (`x4-route-int-*` — if two runs share
a root or a cleanup races an assertion, that is the flake). Do not gate CI on the suite until it
passes 5/5 consecutive runs; red-for-no-reason CI teaches re-run-until-green (FB-4 in CI form).

---

## 🟡 FB-21 · `npm audit`: 6 known vulnerabilities (3 high) in the dependency tree — all auto-fixable

**Observed (audit 2026-07-29, direct tool output):** `npm audit` reports `brace-expansion` ≤5.0.7
(high, DoS — GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg), `js-yaml` 4.0–4.2 (high, quadratic CPU —
GHSA-52cp-r559-cp3m), `postcss` ≤8.5.17 (high, sourcemap path traversal — GHSA-r28c-9q8g-f849),
`esbuild` 0.27.3–0.28.0 under tsx (moderate, dev-server arbitrary file read **on Windows** —
GHSA-g7r4-m6w7-qqqr), `protobufjs` (moderate ×2), `body-parser` <1.20.6 (low; not triggerable here —
the server sets a valid `"32mb"` limit). All six resolve via `npm audit fix`.

**Fix:** `npm audit fix`, rebuild the vsix, re-run typecheck + route-integration + oracle sweep; add
`npm audit` to CI so zero stays zero. **Effort:** small.

**Recommended fix (implementation):** (1) `npm audit fix`; (2) for anything the fixer cannot move
(transitive pins under `tsx` / `@typescript-eslint`), add explicit `overrides` in `package.json`:

```json
"overrides": {
  "brace-expansion": ">=5.0.8",
  "js-yaml": ">=4.2.1",
  "postcss": ">=8.5.18"
}
```

(confirm the exact patched versions with `npm view <pkg> versions` first); (3) re-run
`npm run typecheck && node scripts/route-integration.mjs && node scripts/oracle-integration.mjs`;
(4) rebuild the extension bundle (`npm run build`, then in `vscode-extension/`:
`npm run stage-app && npm run package`) so the vsix ships the patched tree; (5) add
`npm audit --audit-level=high` to the CI workflow from FB-20 so this cannot regress.

---

## 🟡 FB-22 · XML/parser hardening gaps: entity expansion enabled, no size caps, recursive cue walk

**Observed (audit 2026-07-29):** `new XMLParser({...})` in `src/lib/xsdParser.ts:16` and
`src/lib/xsdValidate.ts:84,90` runs with default entity processing (`processEntities` defaults to
true) and no size limits — a crafted XSD or workspace XML can entity-expand (billion-laughs class)
the server. `parseCat` (`src/lib/x4CatDat.ts`, ~:42) reads entire `.cat` manifests synchronously with
no byte cap and `findCatDatArchives` (~:334) recurses unbounded. `walkCueLike`
(`src/lib/xmlParser.ts`, ~:129) is recursive — a deeply nested import can overflow the stack — and
`parseXMLToWorkspace` (~:98) has no input-size guard. `@xmldom/xmldom` is lenient with malformed XML
and lacks browser-DOMParser entity protections.

**Impact framing:** inputs are local (the user's own game files and mods), so this is a
robustness/DoS-to-self class rather than a remote hole — but agent and MCP clients now feed XML to
the server too, which widens who can hand it something hostile.

**Fix:** `processEntities: false` (XSD/MD XML needs no entity expansion), byte caps before parse,
iterative walk with a depth limit. **Verify:** adversarial fixtures incl. one billion-laughs sample
asserting fast, clean rejection. **Effort:** small.

**Recommended fix (implementation):** (1) in `src/lib/xsdParser.ts:16` and
`src/lib/xsdValidate.ts:84,90` add `processEntities: false` to every `XMLParser` options object —
X4 XSD/MD XML uses no custom entities, so this costs nothing and kills the billion-laughs class;
(2) before any `@xmldom/xmldom` parse (`src/lib/xmlParser.ts`), reject payloads containing
`<!DOCTYPE` or `<!ENTITY` with a clear error — no legitimate X4 file contains them; (3) byte caps:
`parseCat` stats the manifest and refuses > 64 MB; `parseXMLToWorkspace` refuses input strings >
32 MB (mirrors the express body limit); (4) convert `walkCueLike` to an explicit stack with a
depth guard (~2,000) so hostile nesting fails with a diagnostic instead of a stack overflow;
(5) tests: one entity-expansion fixture (assert rejection in < 1 s), one deep-nesting fixture,
one oversize manifest. All fixtures are synthetic strings — no game data needed.

---

## ⚪ FB-23 · Housekeeping cluster (audit 2026-07-29)

Small, independent, each with evidence:

- **Token comparison is not constant-time** — `server.ts:397` (`token === STUDIO_API_TOKEN`). Use
  `crypto.timingSafeEqual`. Loopback makes this hard to exploit; it is a one-line fix.
- **A public unauthenticated endpoint returns a stack trace** — `server.ts:7950`
  (`/api/agent/md-audit` is in `PUBLIC_READONLY_GETS`, `server.ts:311-379`) includes
  `stack: …slice(0, 400)`. Drop the field outside dev.
- **Polling storm** — seven concurrent client intervals (App sync 3 s, readiness 4 s, Canvas
  telemetry 2.5 s, AgentBridge 4 s, CueViewer 10 s, GuidedRail 5 s, PlaytestWorkspace 4 s) plus a
  300 ms workspace sync and 400 ms compile per keystroke. Consolidate into one scheduler or move to
  SSE.
- **~60+ empty `catch {}`** — several on important paths (`src/App.tsx:1280`, `:464`;
  `src/lib/apiHelper.ts:71`). Convert the significant ones to counted/logged failures; a TypeError
  from an API shape change currently gets the same silence as a transient network blip.
- **No timeouts anywhere** — Express, the fetch wrapper (`src/lib/apiHelper.ts:160-202`), and the
  dev `run_command` exec all lack deadlines.
- **Orphaned sidecar on abnormal VS Code exit** — `deactivate()` kills the child
  (`vscode-extension/src/extension.ts:1723-1725`), but Task Manager/OOM skips it; the stale-handle
  probe (`:506-513`) only helps the *next* launch.
- **Stale build artifacts** — 8 `.vsix` files (~475 MB) sit in `vscode-extension/`;
  `scripts/build-ext.mjs` cleans `out/` but not old packages.
- **`localResourceRoots` unset** on the studio webview (`extension.ts:754`) — default-deny applies
  anyway; set `[]` explicitly as defense-in-depth.

**Recommended fixes (implementation):**
- `server.ts:397`: `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(STUDIO_API_TOKEN))`
  behind a length check (unequal lengths → 401 without calling it).
- `server.ts:7950`: spread the stack conditionally —
  `...(process.env.NODE_ENV !== 'production' ? { stack: String(error?.stack || '').slice(0, 400) } : {})`.
- Polling: introduce one `usePoller(subscribers)` hook (single `setInterval` at the GCD cadence,
  per-subscriber multiples) or an `/api/events` SSE channel that pushes workspace-version
  invalidations; migrate the seven sites one at a time, App sync first.
- Silent catches: add `reportSilentError(tag, err)` that increments a counter surfaced at
  `/api/agent/status`; convert the ~10 hottest sites first (`App.tsx:1280,464`,
  `apiHelper.ts:71`, `Canvas.tsx:182`).
- Timeouts: `AbortSignal.timeout(15000)` default in the fetch wrapper; `server.setTimeout(30000)`
  at boot; `exec(cmd, { timeout: 600_000, killSignal: 'SIGTERM' })` for the dev run_command jobs.
- Orphaned sidecar: on activation, read `~/.x4forge/instances/*.json`; for each recorded pid that
  is alive but fails the agent-schema probe, taskkill it before spawning (the probe + kill pattern
  at `extension.ts:506-513` already does the second half).
- `.vsix` cleanup: `build-ext.mjs` moves everything but the current version into
  `vscode-extension/releases/` (or deletes on a `--clean` flag).
- `extension.ts:754`: add `localResourceRoots: []` to the webview options object.

---

# ADDENDUM — 2026-07-29 audit recommendations (non-defects)

*Requested by the owner as part of the audit sweep. These are improvements, not observed defects —
promote to ROADMAP `KB-*` numbers as you adopt them. The FB-13+ entries above are prerequisites for
several.*

## Validation & error surfacing

**R1 · Zero-warning culture.** Let a mod declare known-good chains and dynamic-reference patterns
(`cargo.free.all`, `ware.{$var}`) in a suppression manifest with a review date. Validation can then
legitimately reach zero — and any *new* warning is signal again. Resolves the FB-4/FB-5 alarm
fatigue at the root instead of patching chain after chain.

**R2 · Report the delta, not just the list.** Persist each validation summary; deploy-verify adds a
first-class checklist line: `+2 new warnings since last green run`. Absolute lists train skimming
(FB-11's point about identical labels); deltas don't.

**R3 · One-line machine verdict everywhere.** Every agent-API failure response carries top-level
`error` and `failedStages` strings (generalizes the FB-10 fix), so a client that logs one line logs
the right one.

**R4 · Parse, don't grep, the cross-file checks.** Replace the literal `RegisterEvent("` text scan
(FB-2's correction — one rename from a false negative, one comment from a false positive) with the
`luaparse` AST already in the dependency tree, honoring `--`/`--[[ ]]` comments and local aliases.

**R5 · Upstream the wire contract.** Port `tools/wiregate.py`'s idea into Forge validation: collect
Lua payload writes and MD `$key` reads, classify global vs verb-scoped, fail on collisions and on
write-with-no-read. Closes the FB-2 gap where three builds of rejected orders validated clean.

**R6 · Diagnostics that explain themselves.** Every diagnostic carries its rule id and a "why" link
(the `/api/agent/explain` endpoint already exists — surface it inline in DiagnosticsCenter), plus a
one-click "suppress this rule for this mod" that writes the R1 manifest.

## Reliability

**R7 · One transaction discipline.** Apply the deploy engine's staging/rollback pattern
(`replaceValidatedDeployment`, `server.ts:8747-8819`) to workspace writes (FB-14) and anywhere else
bytes land. The correct code already exists — the win is refusing to write any other way.

**R8 · Request-addressed workspace identity.** `modId` on every mutating agent route,
`workspace/activate`, and the active workspace echoed in every agent response (FB-12's own fix
list). This is the architectural root of the worst bug in this file.

**R9 · Timeouts as policy.** Fetch-wrapper deadline (~15 s AbortController), Express
`server.timeout`, kill-timeout on exec jobs. Today nothing anywhere has a deadline.

**R10 · Sidecar liveness.** A parent-death watchdog (or PID-liveness probe on activation that reaps
orphans) so a crashed VS Code doesn't leave a live token-holder running.

## UX

**R11 · Conflict dialog v2** (FB-6): both timestamps, changed-file counts, outcome-labeled buttons
("Keep canvas / Keep disk"), and a diff preview for text files. The one moment a wrong click loses
work should be the best-informed moment in the app.

**R12 · Honest settings.** Wire `autoSaveEnabled` or delete it (FB-18); then audit every toggle for
effect. No placebo in the settings page.

**R13 · One poller.** Consolidate the seven intervals into a single scheduler with per-subscriber
cadence — or push invalidations over SSE; the server already knows the versions.

**R14 · Undo across destructive ops.** Extend undo/redo to cover import / adopt-server-state /
deploy, so every work-destroying action is reversible.

**R15 · Ambient readiness.** A persistent header chip with the last validation run's aggregate
(schema/cue/cross-file/aiscript counts), click → DiagnosticsCenter. The readiness ladder exists;
make the summary impossible to not see.

## Flexibility

**R16 · User-extensible validation.** The R1 suppression manifest plus a mod-local
`forge.rules.json` (declared wire keys, known chains, expected registers) — validation stops being
Forge-knows-best and becomes mod-declares-truth.

**R17 · True multi-workspace.** Parked workspaces already round-trip losslessly (FB-12 operating
note 4). Promote parking to multiple named open workspaces, scoped per client/token — the real fix
for "two agents cannot use the Forge at once."

**R18 · Headless CLI.** `forge validate <path>` / `forge deploy-verify <path>` wrapping the agent
API, so mod CI (like x4_ai_influence's gates) doesn't need a running UI.

## Process

**R19 · CI** (FB-20): typecheck/lint/route-tests/oracles on PR, plus `npm audit` and a vsix
packaging dry-run.

**R20 · Flake budget.** Quarantine-and-fix policy for the flaky route test before gating on it.

**R21 · Decide the MCP server's fate** (FB-8): register it in `.mcp.json` (its read-only surface
audited clean) or remove it. Bundled-but-unwired is the worst state.

---

*End of audit sweep 2026-07-29. Audit conducted read-only against the working tree at 0.0.56/0.0.57;
all findings carry file:line evidence verified against the code as of that date. `src/App.tsx` was
being actively edited during the sweep — line numbers there were re-verified post-edit.*
