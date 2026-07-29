# B49 · Public marketplace readiness (VS Code Marketplace + Open VSX) — SPECIFIED 2026-07-15

Lane: FULL (publishing surface — outward-facing, Ken-gated at every push).

## Ground truth (verified 2026-07-15)
- **Antigravity does NOT use Microsoft's marketplace** — its `product.json` points at
  **Open VSX** (`open-vsx.org/vscode/gallery`). MS Marketplace terms restrict its use to
  genuine VS Code products, so forks live on Open VSX. → To reach both audiences we publish
  to **two registries**: MS Marketplace (VS Code) + Open VSX (Antigravity/VSCodium/etc.).
- Current VSIX is functional but NOT publishable as-is (blockers below).

## Blockers before ANY public push (each is bounded)
1. **Baked machine paths** — 13 drive-path literals (<STEAM_LIBRARY>, C:\Users\ken,
   <DEV_ENV>\…) ship inside server.cjs as server.ts DEFAULTS. Genericize to empty/registry-
   autodetect defaults (B18's detect flow already exists — first-run wizard covers fresh users).
2. **Native-module portability** — `liveBridge.ts` STATICALLY imports better-sqlite3, so the
   bundle hard-crashes where the shipped win-x64 .node can't load. Fix = same lazy-degrade
   pattern as db.ts (small), then either publish platform-specific VSIXs (`vsce publish
   --target win32-x64 …`) or ship without prebuilds and degrade.
3. **Node.js prerequisite** — the sidecar needs a system Node. Marketplace users won't all
   have it. Short-term: honest listing requirement + the existing actionable error. Later
   option: bundle a node runtime per-platform (heavier VSIX).
4. **Identity & license** — publisher id (`x4forge-local` is a placeholder; Ken creates the
   real publisher accounts — MS/Azure DevOps PAT for Marketplace, Eclipse account + token for
   Open VSX; ACCOUNT CREATION IS KEN'S, per credential policy), extension name/namespace
   collision check, real LICENSE (current file says private-testing-only), repository URL,
   README scrub (remove internal notes/paths), gallery banner/screenshots.
5. **Beta gate (recorded decision, Ken may override):** the B41 plan called human beta BEFORE
   marketplace. Both registries support pre-release/preview flags — a **pre-release listing**
   can BE the beta channel if Ken prefers public-beta over private cohort.

## Publish pipeline (once unblocked)
`stage-app` (clean) → `vsce package` → smoke-install both IDEs → `vsce publish` (MS) +
`ovsx publish` (Open VSX) — each push individually Ken-authorized. CI/cadence out of scope.

## Acceptance
A stranger's machine (no F:\, no G:\, no Ken paths): installs from the registry, first-run
wizard autodetects or asks, studio works, no crash without better-sqlite3-compatible ABI.
Negative: boot on a machine WITHOUT Node → the actionable error (not silence).
