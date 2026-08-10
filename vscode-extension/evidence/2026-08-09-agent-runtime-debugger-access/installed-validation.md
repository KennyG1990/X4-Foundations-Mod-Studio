# X4 Forge Studio 0.0.69 — public and installed validation

Status: VERIFIED
Date: 2026-08-09

## Public artifact identity

- Open VSX accepted `x4forge.x4-forge-studio@0.0.69` once.
- Exact-version and latest metadata both resolved to `0.0.69` after normal index propagation.
- The public archive was downloaded independently from Open VSX.
- Local and public archives are both 18,173,930 bytes with SHA-256
  `73482D3E8FC716B19DA82F8199A0F4DFFE063146514C7E11DF65B1182E06A91F`.
- Independent public-archive inspection passed at 2,091 entries and 61,789,011 unpacked bytes.

## Installed extension and sidecar

- Antigravity installed the public archive and its registry reports
  `x4forge.x4-forge-studio@0.0.69`.
- The extension host was reloaded without replacing the open workspace.
- The running supervisor and server both originate from
  `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.69`.
- The superseded `0.0.68` supervisor/server tree remained alive after reload; its exact verified supervisor received
  `SIGTERM`, reaped only its owned child, and both old processes disappeared. The `0.0.69` tree remained alive.
- The installed sidecar advertised port `61054` during proof. Its public schema registry returned 40 domains from
  one root, including `md` and `aiscripts`.

## Installed Agent API and MCP

- Addressed workspace: `ws_f61166c42849c757cf219c37`.
- Canonical `GET /api/agent/runtime-debugger` returned schema version `1` from installed bytes.
- Missing authentication returned `401`; an exact key used with a different workspace returned `403`.
- The live selected evidence is honestly `historical` / `stale`; the API returned 60 retained incidents, zero hidden
  other-mod incidents, and zero aggregate ambiguity.
- A one-hour temporary key was minted with exact `runtime.debug.read@1` authority and effects `read`, `analyze`,
  `audit-write`, and `audit-retention-delete`.
- The installed `mcp/x4forge-mcp.cjs` completed `initialize`, `notifications/initialized`, `tools/list`, and
  `tools/call runtime_debugger` over newline-delimited JSON-RPC.
- The exact key exposed protected tool `runtime_debugger` plus only the two globally public schema readers
  `list_schema_domains` and `explain_element`, matching the reviewed authority policy.
- MCP returned eight capped incidents, two expected steps, one confirmed safe navigation target, and six unresolved
  items. It exposed no `logPath`, `sourceFolder`, raw log, lines, samples, arbitrary mod ID, or unredacted user-home
  path, and it emitted no navigation for ambiguous/unknown ownership.
- The temporary key was revoked in the proof harness's `finally` path. No token was printed or persisted.

## Boundaries and triggered evidence

- The installed evidence is historical, so it does not satisfy the separate successful-deploy/current-X4-session
  experience gate owned by GitHub #35.
- The Antigravity installer reported success and then crashed in its own post-install V8 path; registry, filesystem,
  reload, process provenance, API, MCP, and schema readbacks independently proved the install.
- No real mod, game installation, source debug log, or standing workspace content was written or deployed.
