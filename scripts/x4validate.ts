/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * x4validate — standalone CLI for the X4 Forge validation engine.
 * "Engine as the product" stage 1 (2026-07-08 design review): the deterministic
 * checker usable WITHOUT opening the Forge UI — from a terminal, a CI job, or
 * another tool. Same engine stack as POST /api/agent/project/validate.
 *
 * Usage (run from the X4 Forge repo root so config.json resolves):
 *   npm run validate:mod -- "<MODS_ROOT>\x4_ai_influence"
 *   npm run validate:mod -- "<mod folder>" --json
 *
 * Exit codes: 0 = valid (no errors), 1 = validation errors, 2 = usage/load failure.
 *
 * Honesty notes printed with the report:
 * - Game-object reference checks (macros/wares/factions) need the Forge's object
 *   index and are NOT run by the CLI — use the Forge for those.
 * - Schema/scriptproperties layers read the game data via config.json; if a layer
 *   is unavailable it is reported as such, never silently skipped.
 */

import path from "path";
import { flattenProjectValidation, loadProjectFromDisk, runProjectValidation } from "../src/server/projectValidation";

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith("--")));
const positional = args.filter(a => !a.startsWith("--"));

if (!positional.length || flags.has("--help")) {
  console.log([
    "x4validate — deterministic X4 mod validation (X4 Forge engine, no UI).",
    "",
    "Usage:  npm run validate:mod -- \"<mod folder>\" [--json]",
    "",
    "Runs: structure, cue references (cross-file), MD<->Lua event wiring,",
    "XSD validation (md.xsd + aiscripts.xsd incl. cat/dat harvest),",
    "aiscript order-param lint, scriptproperty chain lint, and exact root",
    "forge.rules.json v1 contracts/reviewed warning suppressions.",
    "",
    "Exit codes: 0 valid | 1 validation errors | 2 usage/load failure",
  ].join("\n"));
  process.exit(2);
}

const target = path.resolve(positional[0]);
const load = loadProjectFromDisk(target);
if (!load.project.files.length) {
  console.error(`No loadable mod files found under: ${target}`);
  console.error("Expected an extension folder containing content.xml / md/*.xml / aiscripts/*.xml / *.lua");
  process.exit(2);
}

const result = runProjectValidation(load.project);

if (flags.has("--json")) {
  console.log(JSON.stringify({ target, loaded: load.loaded, skipped: load.skipped, ...result, flat: flattenProjectValidation(result) }, null, 2));
  process.exit(result.ok ? 0 : 1);
}

const s = result.summary;
console.log(`\nX4 Forge validate — ${load.project.id}`);
console.log(`Folder: ${target}`);
console.log(`Files:  ${s.files} loaded${load.skipped.length ? ` (${load.skipped.length} skipped)` : ""}`);
console.log("");
console.log(`Verdict: ${result.ok ? "VALID (no errors)" : "ERRORS FOUND"}`);
console.log(`  structural errors:        ${s.structuralErrors}`);
console.log(`  unresolved cue refs:      ${s.unresolvedCueRefs}`);
console.log(`  cross-file errors:        ${s.crossFileErrors} (missing Lua registers: ${s.mdLuaMissingRegisters}, missing MD listeners: ${s.luaMdMissingListeners})`);
console.log(`  schema errors/warnings:   ${s.schemaErrors}/${s.schemaWarnings} (md schema: ${result.schema.mdAvailable ? "loaded" : "UNAVAILABLE"}, aiscripts schema: ${result.schema.aiscriptAvailable ? "loaded" : "UNAVAILABLE"})`);
console.log(`  aiscript lint errors:     ${s.aiscriptErrors}`);
console.log(`  scriptproperty warnings:  ${s.scriptPropertyWarnings} (index: ${result.scriptProperties.available ? "loaded" : "UNAVAILABLE"})`);
console.log(`  active/raw warnings:      ${s.activeWarnings}/${s.rawWarnings} (${s.suppressedWarnings} suppressed by reviewed project rules)`);
console.log(`  project-rules errors:     ${s.rulesErrors} (forge.rules.json: ${result.rules.present ? (result.rules.valid ? `v${result.rules.version} valid` : "INVALID") : "not present"})`);
console.log("  note: game-object reference checks (macros/wares/factions) run only inside the Forge.");

const lines = flattenProjectValidation(result).map(f =>
  `[${f.severity}] ${f.code || "validation"}: ${f.message}${f.filePath ? ` (${f.filePath}${f.line ? `:${f.line}` : ""})` : ""}`,
);

if (lines.length) {
  console.log(`\nFindings (${lines.length}):`);
  for (const l of lines) console.log("  " + l);
} else {
  console.log("\nNo findings.");
}

process.exit(result.ok ? 0 : 1);
