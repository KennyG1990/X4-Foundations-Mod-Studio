/**
 * stage-app.mjs — stage the built Forge product into the extension as `app/`.
 *
 * Inputs: the REPO's `npm run build` output (../dist: vite bundle + server.cjs).
 * Output: vscode-extension/app/ = { dist/  (bundle, NO sourcemaps),
 *                                   package.json (pruned runtime deps),
 *                                   node_modules/ (npm install --omit=dev) }.
 *
 * The sidecar spawns `node dist/server.cjs` with cwd = app/, which is exactly how the
 * production server resolves its static bundle (express.static(cwd/dist)).
 *
 * Deliberate exclusions (secrets / dev-only / machine paths):
 *  - *.map            → sourcemaps embed the full server source + local paths.
 *  - .env, .studio-api-token, .studio-state, data/ → never staged; asserted absent.
 *
 * Pruned dependency list = what dist/server.cjs actually requires at runtime
 * (esbuild --packages=external keeps ALL bare imports external):
 *  vite (top-level import in server.ts; prod branch never calls it but the require runs),
 *  express, dotenv, better-sqlite3 (native), @xmldom/xmldom, fast-xml-parser, luaparse,
 *  xpath, @google/genai. React/tailwind/etc. are already inside the vite bundle.
 * The staged app is boot-proven before packaging; a missing dep fails loudly there.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = path.dirname(EXT_ROOT);
const APP = path.join(EXT_ROOT, "app");

const RUNTIME_DEPS = [
  "vite",
  "express",
  "dotenv",
  "better-sqlite3",
  "@xmldom/xmldom",
  "fast-xml-parser",
  "luaparse",
  "xpath",
  "@google/genai",
];

const repoDist = path.join(REPO_ROOT, "dist");
if (!fs.existsSync(path.join(repoDist, "server.cjs")) || !fs.existsSync(path.join(repoDist, "index.html"))) {
  console.error(`[stage-app] repo build output missing at ${repoDist} — run \`npm run build\` in the repo root first.`);
  process.exit(1);
}

// Fresh staging dir every run.
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(path.join(APP, "dist"), { recursive: true });

// Copy only declared production artifacts, excluding sourcemaps. A recursive copy of
// repoDist previously admitted Vite-copied validation fixtures and real mod content.
let copied = 0, skippedMaps = 0;
function copyDir(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      copyDir(src, dst);
    } else if (entry.name.endsWith(".map")) {
      skippedMaps++;
    } else {
      fs.copyFileSync(src, dst);
      copied++;
    }
  }
}
const allowedRootFiles = ["index.html", "favicon.svg", "server.cjs"];
const allowedRootEntries = new Set([...allowedRootFiles, "assets", "server.cjs.map"]);
const unexpectedEntries = fs.readdirSync(repoDist).filter((name) => !allowedRootEntries.has(name));
if (unexpectedEntries.length > 0) {
  console.error(`[stage-app] unexpected repo build artifact(s); refusing to package: ${unexpectedEntries.join(", ")}`);
  process.exit(1);
}
for (const name of allowedRootFiles) {
  const src = path.join(repoDist, name);
  if (!fs.existsSync(src)) {
    console.error(`[stage-app] required repo build artifact missing: ${name}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(APP, "dist", name));
  copied++;
}
const assetsDir = path.join(repoDist, "assets");
if (!fs.existsSync(assetsDir)) {
  console.error("[stage-app] required repo build artifact missing: assets/");
  process.exit(1);
}
fs.mkdirSync(path.join(APP, "dist", "assets"), { recursive: true });
copyDir(assetsDir, path.join(APP, "dist", "assets"));
if (fs.existsSync(path.join(repoDist, "server.cjs.map"))) skippedMaps++;

// Pruned runtime package.json with versions pinned from the repo's manifest.
const repoPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
const deps = {};
for (const name of RUNTIME_DEPS) {
  const version = repoPkg.dependencies?.[name] || repoPkg.devDependencies?.[name];
  if (!version) {
    console.error(`[stage-app] runtime dep "${name}" not found in repo package.json`);
    process.exit(1);
  }
  deps[name] = version;
}
fs.writeFileSync(
  path.join(APP, "package.json"),
  JSON.stringify(
    {
      name: "x4-forge-sidecar-app",
      private: true,
      version: String(repoPkg.version || "0.0.0"),
      description: "Staged X4 Forge product (vite bundle + server.cjs) for the VS Code extension sidecar.",
      dependencies: deps,
    },
    null,
    2,
  ),
);

console.log(`[stage-app] copied ${copied} bundle files (${skippedMaps} sourcemaps excluded); installing runtime deps…`);
execSync("npm install --omit=dev --no-audit --no-fund", { cwd: APP, stdio: "inherit" });

// Strip vendor sourcemaps (npm packages ship their own *.map dev artifacts —
// dead weight in the VSIX; .vscodeignore's !app/** include would re-admit them).
let vendorMaps = 0;
function stripMaps(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) stripMaps(p);
    else if (entry.name.endsWith(".map")) { fs.rmSync(p); vendorMaps++; }
  }
}
stripMaps(path.join(APP, "node_modules"));
console.log(`[stage-app] stripped ${vendorMaps} vendor sourcemaps from node_modules`);

// Assertions: native module present; no secrets / dev-only files staged.
const sqliteDir = path.join(APP, "node_modules", "better-sqlite3");
const nativeCandidates = [
  path.join(sqliteDir, "build", "Release", "better_sqlite3.node"),
  path.join(sqliteDir, "prebuilds"),
];
if (!nativeCandidates.some((p) => fs.existsSync(p))) {
  console.error("[stage-app] better-sqlite3 native binding not found in staged node_modules — sidecar would crash at boot.");
  process.exit(1);
}
for (const forbidden of [".env", ".studio-api-token", ".studio-state", "data", "debuglog.txt"]) {
  if (fs.existsSync(path.join(APP, forbidden)) || fs.existsSync(path.join(APP, "dist", forbidden))) {
    console.error(`[stage-app] forbidden file staged: ${forbidden}`);
    process.exit(1);
  }
}
console.log("[stage-app] OK — app/ staged (bundle + pruned runtime node_modules; native binding present; no secrets).");
