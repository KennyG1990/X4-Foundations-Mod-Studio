/**
 * modFolder.ts — B56s2 (2026-07-17): vscode-free helpers behind "Open Mod Folder in
 * Workspace" — node-testable headlessly (the extension host is IDE-gated).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { atomicWriteFile } from "./durableWrite";

/** Ecosystem suggestions written into the mod folder (never forced installs — s5 gate). */
export const RECOMMENDED_EXTENSIONS = ["redhat.vscode-xml", "sumneko.lua"];

/** Merge-write .vscode/extensions.json — preserves existing keys and recommendations. */
export function writeRecommendations(modPath: string, recs: string[] = RECOMMENDED_EXTENSIONS): string {
  const dir = path.join(modPath, ".vscode");
  const file = path.join(dir, "extensions.json");
  let existing: { recommendations?: string[]; [k: string]: unknown } = {};
  try { existing = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* absent or invalid → fresh */ }
  const merged = Array.from(new Set([...(Array.isArray(existing.recommendations) ? existing.recommendations : []), ...recs]));
  atomicWriteFile(file, `${JSON.stringify({ ...existing, recommendations: merged }, null, 2)}\n`);
  return file;
}

/** Non-hidden subdirectories of the mod workspace root (candidate mod folders). */
export function listModFolders(root: string): string[] {
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * B56s5 — xml.fileAssociations generator (DEFAULT-OFF; x4forge.writeXmlAssociations).
 * Associations are written ONLY for files whose ROOT ELEMENT is a corpus-proven plain
 * domain (B46P2 evidence: factions, gamestarts, addon) — never for <diff> patch
 * documents (raw XSD validation would cry wolf on them), never for wares/jobs (the
 * game ships no schema governing their content), never pattern-broad.
 * ------------------------------------------------------------------ */

/** root element → domain, for the plain-doc domains third-party XSD validation may see. */
const PLAIN_ASSOCIATION_ROOTS: Record<string, string> = {
  factions: "factions",
  gamestarts: "gamestarts",
  addon: "addon",
};

function sniffRoot(xml: string): string | null {
  const head = xml.slice(0, 16384).replace(/<!--[\s\S]*?-->/g, "");
  const m = /<(?!\?|!)([A-Za-z_][\w.:-]*)/.exec(head);
  return m ? m[1].toLowerCase() : null;
}

export interface XmlAssociation { pattern: string; systemId: string; }

/**
 * Scan the mod's candidate XML files and build per-file associations to the given
 * domain XSD paths (from the schema registry). Pure decision logic + bounded fs reads.
 */
export function buildXmlAssociations(modPath: string, domainXsdPaths: Record<string, string>): XmlAssociation[] {
  const out: XmlAssociation[] = [];
  const candidates: string[] = [];
  const walk = (rel: string, depth: number) => {
    if (depth > 3) return; // vanilla layout is ui/addons/<name>/ui.xml — depth 3 suffices
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(path.join(modPath, ...rel.split("/")), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const childRel = `${rel}/${e.name}`;
      if (e.isFile() && e.name.toLowerCase().endsWith(".xml")) candidates.push(childRel);
      else if (e.isDirectory()) walk(childRel, depth + 1);
    }
  };
  walk("libraries", 1);
  walk("ui", 1);
  for (const rel of candidates) {
    try {
      const xml = fs.readFileSync(path.join(modPath, ...rel.split("/")), "utf8");
      const root = sniffRoot(xml);
      const domain = root ? PLAIN_ASSOCIATION_ROOTS[root] : undefined;
      const xsd = domain ? domainXsdPaths[domain] : undefined;
      if (xsd) out.push({ pattern: rel, systemId: xsd.replace(/\\/g, "/") });
    } catch { /* unreadable file */ }
  }
  return out.sort((a, b) => a.pattern.localeCompare(b.pattern));
}

/** Merge-write .vscode/settings.json with xml.fileAssociations (preserves other keys). */
export function writeXmlAssociations(modPath: string, associations: XmlAssociation[]): string | null {
  if (!associations.length) return null;
  const dir = path.join(modPath, ".vscode");
  const file = path.join(dir, "settings.json");
  let existing: Record<string, unknown> = {};
  try { existing = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* absent or invalid → fresh */ }
  const prior = Array.isArray(existing["xml.fileAssociations"]) ? existing["xml.fileAssociations"] as XmlAssociation[] : [];
  const merged = [...prior.filter(p => !associations.some(a => a.pattern === p.pattern)), ...associations]
    .sort((a, b) => a.pattern.localeCompare(b.pattern));
  atomicWriteFile(file, `${JSON.stringify({ ...existing, "xml.fileAssociations": merged }, null, 2)}\n`);
  return file;
}

/* ------------------------------------------------------------------ *
 * Selftest — run headlessly: npx tsx vscode-extension/src/modFolder.ts
 * ------------------------------------------------------------------ */

export function runModFolderSelftest() {
  const os = require("node:os") as typeof import("node:os");
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, ...(detail ? { detail } : {}) });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "x4forge-modfolder-"));
  try {
    fs.mkdirSync(path.join(tmp, "mod_a"));
    fs.mkdirSync(path.join(tmp, "mod_b"));
    fs.mkdirSync(path.join(tmp, ".hidden"));
    fs.writeFileSync(path.join(tmp, "loose.xml"), "<x/>", "utf8");
    ok("lists_only_visible_dirs", JSON.stringify(listModFolders(tmp)) === JSON.stringify(["mod_a", "mod_b"]));
    ok("missing_root_returns_empty", listModFolders(path.join(tmp, "nope")).length === 0);

    const modPath = path.join(tmp, "mod_a");
    const file = writeRecommendations(modPath, ["a.ext", "b.ext"]);
    const first = JSON.parse(fs.readFileSync(file, "utf8"));
    ok("fresh_write_has_recs", JSON.stringify(first.recommendations) === JSON.stringify(["a.ext", "b.ext"]));

    fs.writeFileSync(file, JSON.stringify({ recommendations: ["user.ext"], unwantedRecommendations: ["x"] }), "utf8");
    writeRecommendations(modPath, ["a.ext"]);
    const merged = JSON.parse(fs.readFileSync(file, "utf8"));
    ok("merge_preserves_user_recs", merged.recommendations.includes("user.ext") && merged.recommendations.includes("a.ext"));
    ok("merge_preserves_other_keys", JSON.stringify(merged.unwantedRecommendations) === JSON.stringify(["x"]));

    fs.writeFileSync(file, "not json {{{", "utf8");
    writeRecommendations(modPath, ["a.ext"]);
    const healed = JSON.parse(fs.readFileSync(file, "utf8"));
    ok("corrupt_file_heals_fresh", JSON.stringify(healed.recommendations) === JSON.stringify(["a.ext"]));

    // --- B56s5: association generator ---
    const libDir = path.join(modPath, "libraries");
    fs.mkdirSync(libDir, { recursive: true });
    fs.writeFileSync(path.join(libDir, "factions.xml"), '<?xml version="1.0"?>\n<!-- c --><factions><faction id="x"/></factions>', "utf8");
    fs.writeFileSync(path.join(libDir, "gamestarts.xml"), "<diff><add sel=\"/gamestarts\"/></diff>", "utf8"); // diff-rooted → NO association
    fs.writeFileSync(path.join(libDir, "wares.xml"), "<wares/>", "utf8"); // no schema domain → never
    const uiDir = path.join(modPath, "ui", "addons", "my_addon");
    fs.mkdirSync(uiDir, { recursive: true });
    fs.writeFileSync(path.join(uiDir, "ui.xml"), "<addon/>", "utf8");
    const xsds = { factions: "F:/game/libraries/factions.xsd", gamestarts: "F:/game/libraries/gamestarts.xsd", addon: "F:/game/ui/core/addon.xsd" };
    const assoc = buildXmlAssociations(modPath, xsds);
    ok("plain_factions_associated", assoc.some(a => a.pattern === "libraries/factions.xml" && /factions\.xsd$/.test(a.systemId)));
    ok("diff_rooted_never_associated", !assoc.some(a => a.pattern === "libraries/gamestarts.xml"));
    ok("wares_never_associated", !assoc.some(a => a.pattern === "libraries/wares.xml"));
    ok("ui_addon_associated", assoc.some(a => a.pattern === "ui/addons/my_addon/ui.xml"), JSON.stringify(assoc));

    const settingsFile = writeXmlAssociations(modPath, assoc);
    ok("settings_written", !!settingsFile && fs.existsSync(settingsFile!));
    fs.writeFileSync(settingsFile!, JSON.stringify({ "editor.tabSize": 2, "xml.fileAssociations": [{ pattern: "libraries/factions.xml", systemId: "old.xsd" }, { pattern: "user/custom.xml", systemId: "user.xsd" }] }), "utf8");
    writeXmlAssociations(modPath, assoc);
    const settings = JSON.parse(fs.readFileSync(settingsFile!, "utf8"));
    ok("settings_merge_preserves_other_keys", settings["editor.tabSize"] === 2);
    const assocs = settings["xml.fileAssociations"] as Array<{ pattern: string; systemId: string }>;
    ok("ours_overwrite_same_pattern", assocs.find(a => a.pattern === "libraries/factions.xml")?.systemId.endsWith("factions.xsd") === true);
    ok("user_custom_association_preserved", assocs.some(a => a.pattern === "user/custom.xml"));
    ok("empty_associations_write_nothing", writeXmlAssociations(path.join(tmp, "mod_b"), []) === null);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
  const passed = checks.filter(c => c.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}

// Headless runner: `npx tsx vscode-extension/src/modFolder.ts`
if (typeof require !== "undefined" && require.main === module) {
  const r = runModFolderSelftest();
  console.log(`modFolder selftest: ${r.passed}/${r.total} allPassed=${r.allPassed}`);
  for (const c of r.checks) if (!c.pass) console.log("FAIL", c.name, c.detail || "");
  process.exit(r.allPassed ? 0 : 1);
}
