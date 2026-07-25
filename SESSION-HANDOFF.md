# X4 Forge session handoff — 2026-07-25 · B83 + B84 closed; deployment works on a held Windows folder

## One-line state

Forge can now deploy the real `x4_ai_influence` mod into the live game extensions folder **while that folder is
held by an IDE/terminal**, and the author chooses loose files vs CAT/DAT — both VERIFIED live; nothing is
published, HEAD is the last thing that needs Ken's eye.

## What closed this session

- **B83 — locked deployed-mod root.** `replaceValidatedDeployment` now falls back to a verified, rollback-safe
  in-place synchronization when (and only when) the initial target→backup rename fails `EBUSY`/`EPERM`. Atomic
  fast path unchanged; non-lock errors still propagate untouched.
- **B84 — deploy format toggle.** `deployFormat: 'loose' | 'catalog'` persisted in `config.json`, overridable
  per `deploy-verify` request, default **`loose`**, with a wizard toggle and a plain-language account of what
  each deploy actually wrote.

## The decisive evidence (reproduce it this way, don't re-derive)

The mod root's **NTFS file ID is the discriminator**. The atomic path swaps in a *different* directory (new ID);
the fallback updates the *same* one. Hold the folder, deploy, compare:

```
fsutil file queryfileid "G:\SteamLibrary\steamapps\common\X4 Foundations\extensions\x4_ai_influence"
```

It read `0x…3400000000aad6` before and after a full content replacement → the root was never renamed.
Hold the folder with: `Start-Process powershell -ArgumentList '-NoProfile','-Command','Start-Sleep -Seconds 5400' -WorkingDirectory <mod root>`.

Live results: `deploy-verify` `ok:true` 10/10 stages · `md/ai_influence_diplomacy.xml` went
`mismatched tag: line 278` → **WELL-FORMED** · `core.dll` / `ssl.dll` / `aic_uix.lua` SHA-256 identical to the
workspace · no `.x4forge-backup-*` litter · deployed 48 files vs workspace 49.

## Gates (this session, host-native, quiet machine)

typecheck PASS · oracles **102/102** (artifact transaction 29/29) · routes PASS incl. 9 new B84 assertions ·
lint PASS at baseline (0 errors) · precommit PASS · build PASS · **e2e 26/26 PASS** (`[run-e2e] VERDICT`).

## Corrections banked — do not repeat these

- **An earlier e2e FAIL (23 failures) was an environment casualty, not a defect.** The ephemeral Vite on 3100
  had died and every later spec hit `ERR_CONNECTION_REFUSED`, downstream of an aborted one-second run. On a
  clean machine the same suite went 26/26. Re-run before attributing a cascade to code.
- **`.forgeartifact.json` does NOT control packaging** — only include/exclude/runtime-owned rules. Packaging was
  hardcoded.
- **B83 did not break loose deploys; it revealed that they were never safe.** Loose mode used an additive
  `copyRegularTree` that removed nothing, so deleted mod files lingered in the game folder forever.

## Live hazards

- The **installed sidecar (public 0.0.40) does not contain either fix.** Driving its port reproduces the old
  `EBUSY`. Validate against a host-native server from the repo instead.
- The repo's own `config.json` still holds the **legacy unsafe shape** (`modWorkspacePath` = the live
  extensions dir), which the guards 409 as `PROTECTED_ROOT_OVERLAP`. This session used an isolated
  `X4_CONFIG_DIR` under the scratchpad and left the repo config untouched. Do not "fix" it without asking.
- `.mcp.json` (the `claude-brain` registration) lives inside the deployed mod folder, is not mod content, and is
  therefore removed by every correct deploy. It was restored by hand this session. Add it to `.forgekeep` to
  keep it permanently.
- Do not run `graphify update .` — B77 remains open (graph refresh mutates historical PNG evidence).
- The two `vscode-extension/evidence/0.0.35-*.png` byte changes are still pre-existing, unattributed churn.
  Do not stage or revert them without identifying the owner.

## Eyeball queue (Ken, ~60 seconds)

1. **Deploy format toggle** — open the Compile/Deploy wizard. Between the target list and the staging-path card
   there is a **DEPLOY FORMAT** row with two cards: *Loose files* (selected) and *CAT / DAT archive*, each
   stating its consequence. Click *CAT / DAT archive* → it highlights cyan and persists; reopen the wizard and
   it is still selected. Click *Loose files* to set it back.
2. **Plain-language deploy result** — run a deploy from the wizard and read the `Written to staging + extensions`
   row: it should now spell out the format and what it means, on success as well as failure.

## Ken's four open decisions (B85 in BACKLOG.md)

1. Confirm the **`loose` default** (changed from 0.0.36–0.0.40 catalog-by-default).
2. Is `.claude/settings.local.json` shippable mod content, or correctly excluded? (It is the 48-vs-49 delta.)
3. `x4_ai_influence/.forgekeep` lists `config`, `README.md`, `docs` — all built by the mod, so those hints are
   now reported no-ops. Removing the three lines clears the warning.
4. Add `.mcp.json` to `.forgekeep` if it should survive deploys.

## First resume action

Ken's eyeball queue above, then his four decisions. **No publication** — installed public 0.0.40 lacks both
fixes and shipping needs fresh explicit release authorization. B82 (project validation misses malformed XML)
and B81 (`/api/fs/read` vs `/api/fs/write` root asymmetry) are the next specified units; both were re-confirmed
as real this session. The Agent Action Ledger remains unstarted by explicit instruction.

## Commit point

`fix(deploy): survive locked mod roots on Windows and let the author choose loose vs CAT/DAT`
