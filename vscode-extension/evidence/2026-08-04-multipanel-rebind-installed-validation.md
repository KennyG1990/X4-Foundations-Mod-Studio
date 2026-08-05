# Installed Antigravity multi-panel rebind evidence

Status: `VERIFIED`

Date: 2026-08-04 America/New_York

## Candidate and rollback

- Candidate: `x4-forge-studio-0.0.63-multipanel-liveness-candidate.vsix`
- Candidate entries: 2,091
- Candidate archive bytes: 18,052,475
- Candidate unpacked bytes: 61,223,046
- Candidate SHA-256: `9295CFD8CF3CEE798C3DD261F9E312EC20F4AFC7FC12C709A05E50A8D2789D01`
- Preserved public rollback: `x4-forge-studio-0.0.63.vsix`
- Rollback SHA-256: `50032222BC22190D25D3314837E52E4370C4059F053D1D9BB6EA087DE4DA52E5`

## Installed parity

Installed root: `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.63`

- `out/extension.js`: `4A726518F71E7D2AEA5B56BCDF839862CD2A0098F8E4B83A75153EE5B79491FD`
- `out/sidecar-supervisor.js`: `436D6BC63DC72D79B8F4A811DE7C8EE8D3EA4532A6280D010504E451F714FAC9`
- `app/dist/server.cjs`: `F87E73A0526D8219E98C641BD3A3AE167EBAA11E8DEC766BB37C676B95D51F48`
- `app/dist/x4forge-mcp.cjs`: `E968D2ED752C26628C178C2EA711380F975FBA340DF1D5A8EE6EDA13E23068EF`

Each installed hash matched the staged candidate byte-for-byte.

## Installed extension-host proof

Output log:
`C:\Users\Moshi\AppData\Roaming\Antigravity IDE\logs\20260804T193639\window1\exthost\output_logging_20260804T193647\2-X4 Forge.log`

- Host: Antigravity IDE 1.107.0
- Sidecar port: `51199`
- Sidecar spawns: 1
- Sidecar ready events: 1
- Studio panel binds: 4
- `existing backend ... no longer answers`: 0
- Distinct ports across spawn/ready/bind records: `51199` only
- Loaded XSD action library: 402 events, 35 conditions, 807 actions
- Loaded canonical corpus: 32 factions, 1,902 wares, 170 sectors from 383 files

## Rendered proof

Every one of the four retained `X4 Forge Studio` tabs was activated in the installed Antigravity host. Each rendered:

- Mission Director schema: 1,507 elements (`md.xsd + common.xsd`)
- AI-script schema: 1,408 elements
- Script properties: 2,333 indexed
- Studio badge: `managed sidecar on port 51199`
- No `Failed to fetch`

The fresh Directory Settings surface visibly read:

- Mod workspace: `F:\DEV_ENV\projects\Mods\X4Mods`
- Filesystem folder: `G:\SteamLibrary\steamapps\common\X4 Foundations\extensions`
- X4 installation: `G:\SteamLibrary\steamapps\common\X4 Foundations`
- Unpacked corpus: `F:\Downskies\x4unpackersuitev1\X4 unpacked 9.00`
- `Corpus root found` with canonical ID checks available

No setting was changed. No game or mod directory was written. A direct installed read of `/api/agent/schema` returned HTTP 200, JSON, and 3,408,534 bytes.

## Final repository gate

The exact repair scope was reconstructed in an isolated worktree at baseline `c6e52f9` so unrelated in-progress W3 files could not affect the result. `npm run precommit:check` exited 0 in 591 seconds. It passed the 26/26 E2E-verdict selftests, product-copy guard, durable-writer audit and selftests, capability and MCP contracts, action-receipt coverage, typecheck, source-size guards, canon mirrors, and tripwires.

## Failure and recovery evidence

- The first candidate install while Antigravity was open failed safely with an `EPERM` directory lock and explicit restart instruction. No partial extension replacement occurred.
- Antigravity was closed gracefully; the old sidecar listener stopped; the same candidate installed successfully while the IDE was down.
- The first per-panel candidate had reproduced port churn because a 3.4 MiB schema download was used as a two-second liveness probe. The installed candidate documented here uses the bounded lightweight authenticated owned-sidecar probe and did not churn under the four-tab restore fixture.
