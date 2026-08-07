# Installed Antigravity validation — W3B1a bulk-transform receipts

- Captured: `2026-08-07T02:14:50.0040119-04:00`
- Status: `VERIFIED` for the bounded installed-extension checkpoint.
- Extension: `x4forge.x4-forge-studio@0.0.63`.
- Rendered Forge build: `v1.0.428`.
- Managed sidecar: `http://127.0.0.1:50853`.
- Runtime process: `node.exe` executing
  `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.63\app\dist\server.cjs`.

## Package and installed-byte parity

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `vscode-extension/x4-forge-studio-0.0.63-w3b1a-bulk-receipts-20260807.vsix` | 18,097,543 | `B5EC4B9428FDF23D16711DA35D80F5068B0FA8E35E1FF2E11B7D22F3AF31DEF3` |
| installed `app/dist/server.cjs` | 3,067,914 | `28D789465936D5869DD3707E21821CF0697FB2FE5851DC5034E5C3F9DD685BD7` |
| installed `out/extension.js` | 141,039 | `6821A0DF527D69831DD8A7F821A74B50165361C0CA68CAE90758DAD53F026A6E` |
| installed `out/sidecar-supervisor.js` | 4,512 | `436D6BC63DC72D79B8F4A811DE7C8EE8D3EA4532A6280D010504E451F714FAC9` |

The three installed hashes exactly match the inspected staged package files.

## Running-sidecar proof

- `GET /api/agent/workspace-receipt-service-selftest` returned HTTP 200 with
  `pass=true`, `allPassed=true`, and `25/25` checks.
- `GET /api/agent/schema` returned HTTP 200 with a 3,409,071-character compact JSON readback.
- The running schema advertises `POST /api/agent/bulk-transform/apply` with required header:
  `x-forge-operation-id: required caller-owned bounded operation identity; the server never fabricates it`.
- No bulk apply request was sent to the user's workspace. Installed proof was read-only.

## Rendered-host and containment proof

- [installed-antigravity-forge-v1.0.428.jpg](installed-antigravity-forge-v1.0.428.jpg) shows the restored real Studio
  canvas, Forge `v1.0.428`, the active workspace, managed-sidecar status, and loaded Mission Director, AI-script,
  and script-property sources. Screenshot SHA-256:
  `8F6CDC0528FC05E5CE418ED2EBB8053987AF0DF4FED59D4D5AAEC2E38B452DF5`.
- `F:\DEV_ENV\X4_Forge\config.json` remained byte-identical before and after validation at SHA-256
  `ABEC6AE6AD169392878E06E19346C5E85C1DFB5D9BDFACDD80BA77DAF227C697`.
- The game and mod directories were not written or exercised.

## Rollback

Reinstall `vscode-extension/x4-forge-studio-0.0.63-busy-liveness-20260806.vsix`
(SHA-256 `841A63185547E2FBB946815EF87AF663A7367B6DC3FB091F66307B6409F9F1A3`) with `--force`, then reload
Antigravity.
