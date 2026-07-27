# Using X4 Forge to ship a mod — a field manual for AI agents

**Audience:** an agent whose job is to **build an X4: Foundations mod** through the Forge.
**Not** for agents developing the Forge itself — that is `AGENTS.md` (workflow) and `CODEX-ONBOARDING.md`
(architecture). This document is about *consuming* the Forge, and everything in it was paid for in
debugging time.

> **The one-line summary.** The Forge holds two things your assumptions do not: **the unpacked vanilla
> corpus** and **the authority to write the deployment**. Use it for both. Almost every hour lost building a
> mod goes to an API shape you guessed at, or a file you edited by hand.

---

## 1. Connect

The Forge exposes a local HTTP API. Two moving parts, both of which bite:

**Port drifts.** The sidecar takes a new port per launch. Do not hardcode it. Discover by probing a cached
port, then common defaults, then `netstat` for listeners, validating each candidate against a cheap
authenticated GET (`/api/reference/status`) rather than assuming the first open port is the Forge.

**The token is a credential.** `.studio-api-token` goes stale on relaunch; the durable credential is the
`x4fk_…` bearer key. **Never hardcode it in the mod repo.** A mod repo's `tools/` directory is mirrored into
the deployed mod folder, which is a *distributable* directory — a hardcoded key ships to anyone who installs
the mod. Resolve it from an env var, falling back to a file **outside** the repo:

```python
KEY = os.environ.get('X4_FORGE_KEY') or open(os.path.expanduser('~/.x4forge_key')).read().strip()
```

*(This happened. A bearer token reached the deployed mod folder and was caught by chance while reading a
deploy delta. See KB-7 in `ROADMAP.md`.)*

---

## 2. The write loop — and the asymmetry that will clobber your edits

**`/api/fs/write` routes to the WORKSPACE. `/api/fs/read` resolves to the DEPLOYMENT.** Once those two roots
diverge — which they do the moment you write anything — a read-modify-write chain reads *stale* content, and
your second patch silently reverts your first.

**Therefore, the only safe loop:**

| Step | Where |
|---|---|
| **Read** current content | the **workspace on disk** |
| **Modify** in memory | — |
| **Write** | **through the Forge API** (the Forge stays the write authority) |
| **Verify readback** | the **workspace on disk**, byte-exact |

**Never hand-edit the deployment folder.** The Forge alone deploys. Hand-edited files are silently
overwritten on the next deploy, and — worse — they make the deployment stop being evidence of what the source
says.

---

## 3. The seven traps

### 3.1 Line endings silently break multi-line anchors
Patching is `read → string-replace → write`. If the target file is **CRLF** and your search literal is
**LF**, a multi-line anchor **cannot match** — and single-line anchors keep working, so it stays invisible
until a large patch. Normalise before matching:

```python
E = '\r\n' if '\r\n' in s[:2000] else '\n'
def nl(t): return t.replace('\n', E)
old = nl('''...multi-line anchor...''')
assert s.count(old) == 1, 'anchor'      # ALWAYS assert the count
```

**Assert `count == 1` on every anchor.** A count of 0 is a silent no-op; a count of 2 patches the wrong site.
Label every assertion — an unlabelled `AssertionError` on line 177 tells you nothing.

### 3.2 A rejected import can return HTTP 200
Some payload shapes return **200 with garbage** instead of 4xx. **A success code is not proof the write
happened.** Always read back and compare. This is why byte-exact readback is non-negotiable rather than
belt-and-braces.

### 3.3 Node IDs are unstable across imports
Do not persist or key anything on them.

### 3.4 Validation has false positives *and* false negatives
The `scriptProperties` database is hand-curated, so it does both:
- **False positive:** `cargo.free.all` flagged unknown — it has 9 vanilla usages.
- **False positive:** `$offer.ware.name` read as the enum `ware.<id>`, so it looks up a ware called "name".
- **False negative:** `isdocked`, `isparked`, `dockedat` and three others passed clean and produced **99 live
  runtime errors**. In X4 a failed property lookup **aborts the entire expression**.

**Consequence for you: a clean validate is not proof.** Treat unknown-property warnings as *questions*, and
answer them against the corpus (§5), not by trusting either verdict.

### 3.5 Schema-clean is not runtime-correct
The schema declares no required children for `<create_order>`, but the **order id** resolves to
`aiscripts/order.*.xml` whose `<params>` block marks params `required="true"`. Issuing an order without them
is valid XML and a broken order. Same family: `<create_ship>` without a `<pilot>` child spawns a **crewless
hull** that cannot be commanded.

**Read the target order's own `<params>` block before issuing it.**

### 3.6 Hand-maintained version markers drift
A build marker added so a stale session announces itself **drifted within the hour** and told the player
something false. Gate it in the deploy script: *refuse to deploy if the code changed and the marker did not.*
A discipline you have to remember is not a discipline.

### 3.7 The deploy sweeps your working directory
`__pycache__/`, `.env`, result JSON and dev tooling land in the distributable mod folder. Keep the tree clean
and gitignore the by-products.

---

## 4. The pipeline

```
1. RECONCILE   read the roadmap, the existing code, and the methods library. Do not re-derive.
2. DOCUMENT    write the spec + acceptance criteria BEFORE implementing.
3. IMPLEMENT   patch through the Forge API, byte-exact readback, count-asserted anchors.
4. VALIDATE    POST /api/agent/project/validate  → loop to ok:true
               + syntax gate, unit tests, wiring gate (see §6)
5. DEPLOY      POST /api/agent/deploy-verify {autoReimport: true}
6. PROVE       IN-GAME. Not optional. See §7.
7. RECORD      write what you learned into the methods library.
```

**On `autoReimport: true`:** if you write to the workspace on disk, the Forge's canvas graph is stale *by
construction* on every patch. Without this flag the deploy 409s at the source-sync stage every single time.

---

## 5. Ground every API shape in the corpus — the highest-value habit

The unpacked vanilla game (`md/`, `aiscripts/`, `libraries/*.xsd`) is the **definition of what works**. Before
using any element, attribute, order id or property:

```bash
rg -o '<create_order [^>]{0,80}' <corpus>/md | sort | uniq -c | sort -rn
```

**Report the usage count.** A shape used 40 times is canon; a shape used once may be special-cased. A shape
used zero times does not exist, whatever the schema implies.

Read the **surrounding context**, not just the matching line — child elements are where the bugs hide. The
crewless-ship bug came from research that reported only attributes.

**Anything you cannot find, say so.** "NOT FOUND, here is what I searched" is far cheaper than a confident
wrong answer that passes every gate and fails at runtime.

---

## 6. Tools every mod repo should carry

Version these *with the mod*, not in a scratch directory — a committed script that imports a module living in
`/tmp` is a script that cannot run.

| Tool | Catches |
|---|---|
| `forge.py` | port/auth discovery, read/write helpers with byte-exact readback |
| `deploy.py` | deploy-verify + fidelity proof + the build-marker gate |
| `luagate.py` | Lua syntax against **the game's actual runtime** (lupa ships LuaJIT 2.0, so you can gate offline) |
| `wiregate.py` | features whose event/param wiring goes nowhere |
| `logsweep.py` | new runtime errors in the game log since the last deploy |
| `*_test.py` | unit tests for pure logic — the only gate that ever catches a real bug pre-runtime |

---

## 7. The discipline that matters most

Measured over one long build session:

> **Bugs caught by static validation: ~0. Bugs caught by playing the game and reading `debuglog.txt`: all of
> them.**

Static gates prove *legality*. They cannot prove *behaviour*. So:

- **A clean deploy is not a working feature.** Report it as "shipped, unproven" until observed in-game.
- **Read the log after every test.** It is the only channel that has ever told the truth unprompted.
- **Exercise the failure path, not just the happy one.** A "verification" that only ran the success case is
  how six phantom properties shipped.
- **Never let a correct refusal look like a bug.** If the engine refuses, *say so on screen*. A silent correct
  refusal and a silent failure are indistinguishable to the person playing, and they will report your working
  feature as broken — correctly, because they had no way to tell.
- **Build a testbed command.** Ships, crew, cargo, fleet hierarchy and market data are preconditions for
  almost every test. Hitting those walls repeatedly costs more than automating them once.

---

## 8. Quick reference

| Endpoint | Use |
|---|---|
| `GET /api/agent/schema` | self-documenting endpoint list (public) |
| `GET /api/agent/workspace` | active workspace + `workspaceHash` |
| `POST /api/agent/project/validate` | **authoritative** validation — loop to `ok:true` |
| `POST /api/agent/deploy-verify` | 9-stage compile + deploy preflight |
| `GET /api/agent/selftest-index` | the oracle list |
| `GET /api/reference/status` | cheap authenticated probe — use for port discovery |

**Related:** `AGENTS.md` (workflow), `CODEX-ONBOARDING.md` (architecture), `ROADMAP.md` §KNOWN BUGS
(current Forge defects with reproductions).
