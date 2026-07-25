# Publishing an X4 Forge Studio update (the agreed flow)

The extension ships from **`main`** (the one line since the 2026-07-20 unification — the old
`claude/x4-forge-vscode-poc-806ef5` branch is retired) to the **Open VSX**
store (namespace `x4forge`). GitHub and the store are two SEPARATE destinations:
- **GitHub** = the source code (push commits to `main`).
- **Open VSX** = the installable app users get (a published `.vsix`). Pushing to GitHub does
  NOT update the store; you must publish.

---

# ⚙️ MACHINE RUNBOOK — exact verified sequence (last run: 0.0.31, 2026-07-20, green)

> For an agent (Codex/Claude/etc.) cutting a release unattended. Every command below was
> actually executed for 0.0.31; the expected-output lines are real. Run from a HOST shell
> (sandbox mirrors of this repo are stale and lie). `<REPO>` = `F:\DEV_ENV\X4_Forge`.

## What the pipeline actually builds (4 artifacts, in order)

```
1. <REPO>/dist/            ← npm run build          (vite client bundle + esbuild server.cjs)
2. vscode-extension/app/   ← npm run stage-app      (copies dist/ + pruned prod node_modules)
3. vscode-extension/out/   ← npm run build          (tsc --noEmit, then esbuild extension.js)
4. x4-forge-studio-<v>.vsix ← vsce package          (out/ + app/ + manifest/docs per .vscodeignore)
```
The extension spawns `node dist/server.cjs` with **cwd = `app/`** — that is why the whole
product is staged inside the extension rather than fetched at runtime. `stage-app` HARD-FAILS
if `<REPO>/dist/server.cjs` or `dist/index.html` is missing, so **step 1 is mandatory before
step 2** even if only extension code changed.

## Preconditions (verify, don't assume)
```bash
git -C <REPO> status --short          # must be empty
git -C <REPO> rev-parse HEAD origin/main   # two identical SHAs
```

## Gates — all four must pass before you bump anything
```bash
cd <REPO> && npm run typecheck                              # exit 0
cd <REPO> && npm run test:routes                            # [route-integration] 13/13 PASS
cd <REPO> && npm run test:e2e                               # [run-e2e] VERDICT: PASS — 19 passed
```
Oracle sweep needs a RUNNING server and **defaults to port 3001** — with the prod bundle on
:3000 you must override the base or every oracle reports `fetch failed` (a false red that
cost time on 0.0.31):
```bash
cd <REPO> && npm run build && node dist/server.cjs &        # prod bundle on :3000
cd <REPO> && X4_FORGE_BASE=http://localhost:3000 node scripts/oracle-sweep.mjs   # 96/96 green
```
Stop that server before packaging. THE e2e gate is `test:e2e` (verdict-parsed) — raw Playwright
exit codes lie via the libuv teardown crash `0xC0000409`; never judge by exit code alone.

## Release sequence (publish BEFORE commit — this ordering is the rule, not a preference)

**1. Bump the version** in `vscode-extension/package.json` (`0.0.30` → `0.0.31`). Must always
increase; Open VSX rejects re-publishing an existing version.

**2. Write the human release note** — the ONE manual step. Add a `"<version>": [ ... ]` block at
the TOP of `vscode-extension/release-notes.json`, in plain language aimed at modders (what they
can now DO), not commit-speak. Missing entry ⇒ the changelog falls back to a humanized commit
subject, which reads badly on the store.

**3. Build and package**, from `<REPO>/vscode-extension`:
```bash
cd <REPO> && npm run build                     # ✱ REQUIRED FIRST — produces dist/
cd <REPO>/vscode-extension
npm run changelog     # [gen-changelog] wrote CHANGELOG.md — 29 version(s), newest 0.0.31
npm run stage-app     # [stage-app] OK — app/ staged (… native binding present; no secrets)
npm run build         # [build-ext] OK — out/extension.js written from a fresh out/
npx --yes @vscode/vsce package --allow-missing-repository
                      # DONE Packaged: …/x4-forge-studio-0.0.31.vsix (2098 files, 16.99 MB)
```
**NEVER pass `--pre-release`** (standing rule, Ken 2026-07-16). The flag is baked at PACKAGE
time; 0.0.4/0.0.6 shipped pre-release and hit the "no release version" install wall.

`stage-app` self-asserts: `better-sqlite3` native binding present, and no `.env` /
`.studio-api-token` / `.studio-state` / `data/` / `debuglog.txt` staged. It exits non-zero on any
unexpected file in `dist/` — that guard exists because a recursive copy once admitted real mod
content into the package. If it fails, FIX the input; do not bypass it.

**4. Publish** (token lives in `<REPO>/.env.local` as `OVSX_PAT`, gitignored — read it
programmatically, never echo it, never paste it into chat):
```bash
cd <REPO>/vscode-extension
# PowerShell: $pat = ((Get-Content <REPO>\.env.local | Select-String '^OVSX_PAT=').Line -replace '^OVSX_PAT=','')
npx --yes ovsx publish x4-forge-studio-<version>.vsix -p "$pat"
#   🚀  Published x4forge.x4-forge-studio v0.0.31
```

**5. Verify on the store BEFORE committing.** Two endpoints, and they disagree for a while —
the `/versions` list lags several minutes behind a successful publish, so the "latest" endpoint
is the faster truth (observed on 0.0.31: latest said 0.0.31 while /versions still listed 0.0.30):
```bash
curl -s https://open-vsx.org/api/x4forge/x4-forge-studio | jq -r .version      # → 0.0.31
curl -s https://open-vsx.org/api/x4forge/x4-forge-studio/versions             # eventually lists it
```
A successful `ovsx publish` line plus the latest-endpoint match is sufficient evidence to commit.

**6. Commit LAST**, so the committed version always equals the published version. Stage exactly:
`vscode-extension/package.json`, `vscode-extension/CHANGELOG.md`,
`vscode-extension/release-notes.json`, plus whatever code shipped and the `ROADMAP.md` /
`SESSION-HANDOFF.md` records. The repo's git pre-commit hook auto-runs `npm run precommit:check`
(tripwires + canon-mirror identity + e2e verdict selftest 10/10 + typecheck) — expect ~30s and a
green block. Then `git push origin main` and assert `HEAD == origin/main`.

## Failure modes seen in practice
| Symptom | Cause / fix |
|---|---|
| `[stage-app] repo build output missing` | Skipped `npm run build` in the REPO ROOT. Run it. |
| Oracle sweep `0/N green — fetch failed` | Sweep hit :3001; no server there. Set `X4_FORGE_BASE`. |
| `vsce` not found / wrong cwd | Package must run from `vscode-extension/`, via `npx --yes @vscode/vsce`. |
| Publish rejected, version exists | Version didn't increase. Bump again; a burned version is gone forever. |
| Store `/versions` missing the new version | Index lag. Check the latest endpoint; don't republish. |
| Users can't install / "no release version" | Something shipped `--pre-release`. Cut a new stable version. |
| Playwright "N passed" then exit 0xC0000409 | Known libuv teardown crash. Judge by `[run-e2e] VERDICT:`. |

## One-time facts
- Namespace: `x4forge` · extension id: `x4forge.x4-forge-studio`
- Store page: https://open-vsx.org/extension/x4forge/x4-forge-studio
- Publish token: `OVSX_PAT` in `F:\DEV_ENV\X4_Forge\.env.local` (gitignored, never in chat)
- Both IDEs use Open VSX by default (Antigravity, Cursor, VSCodium, Windsurf); stock VS Code
  does not (that would need the MS Marketplace, currently blocked on Azure billing).

## Steps to cut a new version
1. Have the code changes ready on `main` (committed, or riding in the release commit — see step 6).
2. Bump `version` in `vscode-extension/package.json` (e.g. 0.0.6 -> 0.0.7).
3. From `vscode-extension/`:
   ```
   npm run changelog                                  # regenerate CHANGELOG.md from git (B60)
   npm run stage-app                                  # copy built product into app/
   npm run build                                      # compile the controller (out/)
   npx @vscode/vsce package --allow-missing-repository
   ```
   (Run `npm run build` in the REPO ROOT first if the product bundle changed.)
   **STANDING RULE (Ken, 2026-07-16): ALL releases are STABLE — never pass `--pre-release`.**
   (0.0.4/0.0.6 were pre-release and hit the "no release version" install wall; 0.0.7+ are stable.)
4. Publish (token read from .env.local, never printed):
   ```
   npx ovsx publish x4-forge-studio-<version>.vsix -p <OVSX_PAT>
   ```
   `--pre-release` on publish is ignored for a prepackaged vsix — the pre-release flag is baked
   at PACKAGE time in step 3, so keep it there. To cut a STABLE (non-beta) release, drop
   `--pre-release` from step 3.
5. Verify: `https://open-vsx.org/api/x4forge/x4-forge-studio/versions` lists the new version.
   Indexing of the "latest" pointer can lag a few minutes; the version query confirms it's live.
6. **Commit LAST (publish-before-commit — Ken's order, 2026-07-17).** The version bump + generated
   CHANGELOG ride in the SAME commit as the work, AFTER the store publish, so the committed
   version always equals the published version. **Commit method is flexible** (Ken, 2026-07-17):
   either Antigravity's Source Control UI (the **KLIO** ✦ button generates the message → **Commit**
   → **Sync**), or the agent commits directly with `git` using a comprehensive message and pushes —
   whichever is simpler. Publish-before-commit is the firm part; the mechanism is not.

## How users get the update
Installed-from-store extensions with Auto Update on pick it up automatically within a bit, or on
IDE reload. A SIDE-LOADED install (installed from a local .vsix) may not auto-update from the
store — reinstall from the store (Extensions view → search "X4 Forge" → the `x4forge` one →
Install) to move onto the store channel, then future updates are automatic.

## ⚠ Pre-release vs stable — the gotcha that bit us (2026-07-16)
Every version so far (0.0.4, 0.0.6) was published `--pre-release`, so the store has **NO stable
release**. Consequences we hit live:
- A plain `--install-extension x4forge.x4-forge-studio` (and the store's default "Install"
  button) FAILS with "Can't install release version ... it has no release version." Users must
  pass `--install-extension <id> --pre-release`, or click "Switch to Pre-Release Version" in the
  UI — friction most users won't figure out.
- A SIDE-LOADED install (Source: VSIX in the Extensions panel) does NOT auto-update from the
  store at all — it's pinned. Reinstall from the store to move onto the auto-updating channel.

RECOMMENDATION for adoption: publish STABLE (drop `--pre-release` at package time in step 3) so
"Install" just works for everyone. Keep the "beta" signal in the version number (0.0.x) and the
README, not in the pre-release channel. Switching is free: bump the version and package WITHOUT
`--pre-release`, then publish. Once a stable exists, normal installs and auto-update work
seamlessly; you can still cut pre-release builds alongside for testers.

## Notes
- Version must always increase (store rejects a re-publish of an existing version).
