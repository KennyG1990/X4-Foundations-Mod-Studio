/**
 * diagnosticsMap.ts — B56s1 (2026-07-17): pure mapping from the Forge's flat diagnostic
 * list (`flat` on POST /api/agent/project/validate, the B55P1 currency) to per-file,
 * 0-based-line entries ready for a vscode.DiagnosticCollection.
 *
 * Deliberately vscode-free so the mapping is node-testable headlessly (the extension host
 * itself is IDE-gated); extension.ts converts MappedDiagnostic → vscode.Diagnostic 1:1.
 */

export interface FlatFinding {
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
  filePath?: string;
  sourceRef?: string;
  line?: number;
}

export interface MappedDiagnostic {
  /** forward-slash path relative to the mod root; findings without one anchor to content.xml */
  relPath: string;
  /** 0-based line for vscode.Range */
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
}

export interface MappedResult {
  byFile: Map<string, MappedDiagnostic[]>;
  /** findings that could not be anchored to any loaded file (reported as a count, never lost) */
  unanchored: number;
  total: number;
}

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();

/**
 * Map flat findings onto the mod's loaded files. `loadedFiles` comes from the validate
 * response's `source.loaded`; a finding whose filePath is absent or unknown anchors to
 * content.xml when loaded (structure-level findings), else counts as unanchored.
 */
export function mapFlatFindings(flat: FlatFinding[], loadedFiles: string[]): MappedResult {
  const loaded = new Map(loadedFiles.map(f => [norm(f), f.replace(/\\/g, "/")]));
  const contentXml = loaded.get("content.xml");
  const byFile = new Map<string, MappedDiagnostic[]>();
  let unanchored = 0;

  for (const f of flat || []) {
    if (!f || !f.message) continue;
    const anchor = (f.filePath && loaded.get(norm(f.filePath))) || contentXml;
    if (!anchor) { unanchored++; continue; }
    const entry: MappedDiagnostic = {
      relPath: anchor,
      line: Math.max(0, Math.floor(f.line ?? 1) - 1),
      severity: f.severity === "error" || f.severity === "warning" ? f.severity : "info",
      message: f.sourceRef ? `${f.message} (${f.sourceRef})` : f.message,
      ...(f.code ? { code: f.code } : {}),
    };
    const list = byFile.get(anchor) || [];
    list.push(entry);
    byFile.set(anchor, list);
  }
  return { byFile, unanchored, total: (flat || []).length };
}

/* ------------------------------------------------------------------ *
 * Selftest — run headlessly: npx tsx vscode-extension/src/diagnosticsMap.ts
 * ------------------------------------------------------------------ */

export function runDiagnosticsMapSelftest() {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, ...(detail ? { detail } : {}) });

  const loaded = ["content.xml", "md/story.xml", "libraries/factions.xml", "t/0001-l044.xml"];
  const flat: FlatFinding[] = [
    { severity: "warning", message: "unknown attr", code: "XSD_UNKNOWN_ATTRIBUTE", filePath: "libraries/factions.xml", sourceRef: "faction@bogus", line: 3 },
    { severity: "error", message: "unresolved cue", code: "project.unresolved_cue_ref", filePath: "md/story.xml", line: 12 },
    { severity: "error", message: "missing content.xml dependency", code: "project.missing_content_xml" }, // no filePath → content.xml
    { severity: "warning", message: "page id missing", code: "TFILE_PAGE_ID", filePath: "t\\0001-L044.xml", line: 1 }, // backslash + case
    { severity: "warning", message: "phantom file finding", filePath: "md/not_loaded.xml", line: 2 }, // unknown file → content.xml
    { severity: "info", message: "note without line", filePath: "md/story.xml" },
  ];

  const r = mapFlatFindings(flat, loaded);
  ok("total_counted", r.total === 6);
  ok("nothing_unanchored_with_content_xml", r.unanchored === 0);
  ok("factions_anchored_line_0based", r.byFile.get("libraries/factions.xml")?.[0].line === 2);
  ok("sourceRef_appended", /faction@bogus/.test(r.byFile.get("libraries/factions.xml")?.[0].message || ""));
  ok("md_has_two", r.byFile.get("md/story.xml")?.length === 2);
  ok("missing_line_clamps_to_0", r.byFile.get("md/story.xml")?.some(d => d.line === 0) === true);
  ok("caseless_backslash_path_matches", (r.byFile.get("t/0001-l044.xml")?.length ?? 0) === 1);
  ok("pathless_and_unknown_anchor_to_content_xml", r.byFile.get("content.xml")?.length === 2);

  const noContent = mapFlatFindings([{ severity: "error", message: "x" }], ["md/a.xml"]);
  ok("unanchored_counted_when_no_content_xml", noContent.unanchored === 1 && noContent.byFile.size === 0);
  const empty = mapFlatFindings([], []);
  ok("empty_inputs_safe", empty.total === 0 && empty.unanchored === 0);
  const luaFailureMessage = "Literal addTable(24) exceeds the measured X4 mod boundary. Failure mode: Engine refuses the ENTIRE frame: no partial draw/Lua error; UI auto-reloads. Next action: verify this boundary in-game.";
  const luaResult = mapFlatFindings([{
    severity: "error",
    message: luaFailureMessage,
    code: "x4-ui.add-table-column-limit",
    filePath: "ui/too_many_columns.lua",
    line: 3,
  }], ["content.xml", "ui/too_many_columns.lua"]);
  const luaDiagnostic = luaResult.byFile.get("ui/too_many_columns.lua")?.[0];
  ok(
    "lua_path_code_line_message_preserved",
    luaDiagnostic?.relPath === "ui/too_many_columns.lua"
      && luaDiagnostic.line === 2
      && luaDiagnostic.severity === "error"
      && luaDiagnostic.code === "x4-ui.add-table-column-limit"
      && luaDiagnostic.message === luaFailureMessage,
  );

  const passed = checks.filter(c => c.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}

// Headless runner: `npx tsx vscode-extension/src/diagnosticsMap.ts`
const invokedScript = process.argv[1]?.replace(/\\/g, "/");
if (invokedScript?.endsWith("vscode-extension/src/diagnosticsMap.ts")) {
  const r = runDiagnosticsMapSelftest();
  console.log(`diagnosticsMap selftest: ${r.passed}/${r.total} allPassed=${r.allPassed}`);
  for (const c of r.checks) if (!c.pass) console.log("FAIL", c.name, c.detail || "");
  process.exit(r.allPassed ? 0 : 1);
}
