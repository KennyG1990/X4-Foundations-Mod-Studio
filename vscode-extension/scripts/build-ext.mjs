/**
 * build-ext.mjs — compile the extension controller from a FRESH output directory.
 * Typechecks with tsc, then bundles the controller and the standalone sidecar supervisor.
 * vscode is external only for the controller; the supervisor imports no host API.
 */
import { execSync } from "node:child_process";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);

// Fresh output directory every build (acceptance requirement).
fs.rmSync(path.join(ROOT, "out"), { recursive: true, force: true });

execSync("npx tsc --noEmit", { stdio: "inherit" });

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"],
  sourcemap: true,
  outfile: "out/extension.js",
});

await build({
  entryPoints: ["src/sidecarSupervisor.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  sourcemap: true,
  outfile: "out/sidecar-supervisor.js",
});

console.log("[build-ext] OK — extension.js + sidecar-supervisor.js written from a fresh out/");
