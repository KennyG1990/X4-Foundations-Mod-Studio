/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * First-run setup routes (BACKLOG B18, Vision v2 Phase 1 — 2026-07-11).
 *
 * The IMPURE half of game detection: Windows registry reads, libraryfolders.vdf
 * reads, install-dir existence checks, and cat/dat schema harvesting. The parsing
 * and proposal logic is the pure `src/lib/gameDetect.ts` (oracle-backed).
 *
 * Routes (both behind the bearer-token middleware — they reveal/derive local paths):
 *   GET  /api/agent/detect-game            → scan Steam (registry + VDF) and GOG for
 *                                            an X4 install; return candidates + a
 *                                            full config proposal. READ-ONLY.
 *   POST /api/agent/setup/harvest-schemas  → extract md/common/aiscripts.xsd from the
 *                                            game's cat/dat archives into
 *                                            data/harvested-schemas/ (gitignored).
 *                                            Writes ONLY under data/ — the actual
 *                                            config apply stays the user-confirmed
 *                                            POST /api/schema/config, unchanged.
 */

import type { Express } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { parseLibraryFolders, proposeSetup, X4_STEAM_APPID, X4_STEAM_REL_DIR } from "../lib/gameDetect";
import { inspectGameInstall } from "../lib/pathRoles";
import { dataPath } from "../lib/dataDir";
import { findCatDatArchives, parseCat, readEntryText } from "../lib/x4CatDat";

interface GameDetectDeps {
  /** cat/dat extractor: (gamePath, 'libraries/md.xsd') → ExtractMatch | null */
  extractBaseGameFile: (gamePath: string, targetFile: string) => { name: string; text: string } | null;
}

/** Read one registry value; '' when the key/value is missing or reg.exe fails. */
function regValue(hivePath: string, valueName: string): string {
  try {
    const out = execFileSync("reg", ["query", hivePath, "/v", valueName], { encoding: "utf8", timeout: 5000 });
    const m = out.match(new RegExp(`${valueName}\\s+REG_\\w+\\s+(.+)`));
    return m ? m[1].trim() : "";
  } catch { return ""; }
}

/** List subkeys of a registry key; [] on any failure. */
function regSubkeys(hivePath: string): string[] {
  try {
    const out = execFileSync("reg", ["query", hivePath], { encoding: "utf8", timeout: 5000 });
    return out.split(/\r?\n/).map(l => l.trim()).filter(l => l.toUpperCase().startsWith("HKEY_"));
  } catch { return []; }
}

function findSteamX4(): { gameDir: string; source: string } | null {
  const steamRoots = [
    regValue("HKCU\\Software\\Valve\\Steam", "SteamPath"),
    regValue("HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"),
    "C:\\Program Files (x86)\\Steam",
  ].map(p => p.replace(/\//g, "\\")).filter(Boolean);

  for (const root of [...new Set(steamRoots)]) {
    const vdfPath = path.join(root, "steamapps", "libraryfolders.vdf");
    let libraries = [root];
    try { libraries = [...new Set([root, ...parseLibraryFolders(fs.readFileSync(vdfPath, "utf8"))])]; } catch { /* no vdf → root only */ }
    for (const lib of libraries) {
      try {
        if (!fs.existsSync(path.join(lib, "steamapps", `appmanifest_${X4_STEAM_APPID}.acf`))) continue;
        const gameDir = path.join(lib, ...X4_STEAM_REL_DIR.split("/"));
        if (inspectGameInstall(gameDir).valid) return { gameDir, source: "steam" };
      } catch { /* unreadable library → skip */ }
    }
  }
  return null;
}

function findGogX4(): { gameDir: string; source: string } | null {
  for (const key of regSubkeys("HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games")) {
    try {
      const name = regValue(key.replace(/^HKEY_LOCAL_MACHINE/i, "HKLM"), "gameName");
      if (!/x4/i.test(name)) continue;
      const dir = regValue(key.replace(/^HKEY_LOCAL_MACHINE/i, "HKLM"), "path");
      if (dir && inspectGameInstall(dir).valid) return { gameDir: dir, source: "gog" };
    } catch { /* skip unreadable entries */ }
  }
  return null;
}

/**
 * B65-1b (2026-07-19): the packed game ships ~43 XSDs, not 3 — and the B46 schema registry
 * routes factions/gamestarts/diff/addon/etc. to their OWN schemas. Harvesting only the core
 * trio silently degraded every harvest-only (packed-install) user to a 3-domain validator.
 * Now the harvest extracts EVERY .xsd entry in the archives, TREE-PRESERVING (flat basenames
 * collide — md/md.xsd vs libraries/md.xsd — and md/md.xsd is the zero-declaration include
 * shim whose relative include chain must stay intact). Registry + discoverXsd are already
 * subdir-aware, so downstream needs no change. Later archive wins per path (the same
 * override order extractBaseGameFile honors).
 */
function enumeratePackedXsds(gamePath: string): Array<{ rel: string; datPath: string; entry: { name: string; size: number; offset: number } }> {
  const byRel = new Map<string, { rel: string; datPath: string; entry: { name: string; size: number; offset: number } }>();
  for (const archive of findCatDatArchives([gamePath])) {
    let entries;
    try { entries = parseCat(archive.catPath); } catch { continue; }
    for (const entry of entries) {
      const rel = entry.name.toLowerCase();
      if (!rel.endsWith('.xsd')) continue;
      byRel.set(rel, { rel: entry.name, datPath: archive.datPath, entry }); // later archive wins
    }
  }
  // B65-1b: the packed game ships include-SHIM duplicates (e.g. md/md.xsd, aiscripts/aiscripts.xsd,
  // md/diff.xsd) that just `<xs:include>` their real sibling under libraries/ — but the packed shim's
  // path is `../../../libraries/md.xsd` (relative to the game's deep vpath), which OVERSHOOTS a flat
  // 2-level harvest tree and silently drops ~20 MD elements (382 vs 402). The `libraries/` copy is the
  // self-contained real schema. So when a basename exists BOTH under libraries/ and as a shallower
  // shim, keep only the libraries/ one — discoverXsd then resolves to the complete file. (Unique subdir
  // schemas like cutscenes/, ui/core/ have no libraries/ twin and are kept.)
  const libBasenames = new Set<string>();
  for (const { rel } of byRel.values()) {
    const r = rel.replace(/\\/g, '/').toLowerCase();
    if (r.startsWith('libraries/')) libBasenames.add(path.basename(r));
  }
  return [...byRel.values()].filter(({ rel }) => {
    const r = rel.replace(/\\/g, '/').toLowerCase();
    if (r.startsWith('libraries/')) return true;
    return !libBasenames.has(path.basename(r)); // drop the shim duplicate; keep unique subdir schemas
  });
}

/** The two files POST /api/schema/config validates for — missing either is a hard fail. */
const CORE_BASENAMES = ["md.xsd", "common.xsd"];

export function registerGameDetectRoutes(app: Express, deps: GameDetectDeps): void {

  app.get("/api/agent/detect-game", (_req, res) => {
    try {
      const hit = findSteamX4() || findGogX4();
      if (!hit) {
        return res.json({
          found: false,
          proposal: null,
          hint: "No X4: Foundations install found via Steam or GOG. Use manual setup to point at the game folder.",
        });
      }
      const proposal = proposeSetup({ gameDir: hit.gameDir, homeDir: os.homedir(), forgeCwd: process.cwd() });
      // B53 coupling: the harvest endpoint WRITES to dataPath("harvested-schemas") (may be
      // X4_DATA_DIR-relocated, e.g. extension globalStorage) — the proposal must point where
      // the files actually land, not at cwd, or auto-setup saves a config aimed at an empty
      // (and update-wiped) directory.
      proposal.xsdSchemaPath = dataPath("harvested-schemas");
      // Prove schemas are actually harvestable from THIS install before promising it.
      let canHarvestSchemas = false;
      try {
        const probe = deps.extractBaseGameFile(hit.gameDir, "libraries/md.xsd");
        canHarvestSchemas = !!(probe && probe.text && probe.text.length > 1000);
      } catch { canHarvestSchemas = false; }
      return res.json({ found: true, source: hit.source, gameDir: hit.gameDir, canHarvestSchemas, proposal });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "detect-game failed" });
    }
  });

  app.post("/api/agent/setup/harvest-schemas", (req, res) => {
    try {
      const gamePath = String(req.body?.x4GamePath || "").trim();
      if (!gamePath || !fs.existsSync(gamePath)) {
        return res.status(400).json({ error: "x4GamePath missing or does not exist." });
      }
      const outDir = dataPath("harvested-schemas"); // B53
      fs.mkdirSync(outDir, { recursive: true });
      const files: { name: string; bytes: number }[] = [];
      const missing: string[] = [];

      // B65-1b: harvest EVERY packed .xsd, tree-preserving. Fall back to the core-trio
      // extractBaseGameFile path if enumeration yields nothing (e.g. an unpacked/loose install
      // with no .cat archives — those users already have the loose .xsd tree the registry reads).
      const packed = enumeratePackedXsds(gamePath);
      if (packed.length > 0) {
        for (const { rel, datPath, entry } of packed) {
          try {
            const text = readEntryText(datPath, entry);
            if (!text) { missing.push(rel); continue; }
            const dest = path.join(outDir, ...rel.split("/")); // preserve the game's dir tree
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, text, "utf8");
            files.push({ name: rel, bytes: Buffer.byteLength(text, "utf8") });
          } catch { missing.push(rel); }
        }
      } else {
        // No packed archives — try the core trio via the loose-or-packed extractor.
        for (const rel of ["libraries/md.xsd", "libraries/common.xsd", "libraries/aiscripts.xsd"]) {
          const hit = deps.extractBaseGameFile(gamePath, rel);
          if (hit && hit.text) {
            const dest = path.join(outDir, ...rel.split("/"));
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, hit.text, "utf8");
            files.push({ name: rel, bytes: Buffer.byteLength(hit.text, "utf8") });
          } else { missing.push(rel); }
        }
      }

      // md.xsd + common.xsd are what POST /api/schema/config validates for. Missing either
      // core file is a hard fail so the wizard never applies a half-usable schema dir. (Checked
      // by BASENAME — they may live at libraries/md.xsd or a bare md.xsd depending on layout.)
      const haveCore = (base: string) => files.some(f => path.basename(f.name).toLowerCase() === base);
      const coreOk = CORE_BASENAMES.every(haveCore);
      if (!coreOk) {
        return res.status(422).json({ error: "Could not extract md.xsd + common.xsd from the game archives.", files, missing });
      }
      return res.json({ ok: true, dir: outDir, files, missing });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "harvest-schemas failed" });
    }
  });
}
