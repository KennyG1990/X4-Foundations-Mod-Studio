/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Game-install detection logic (BACKLOG B18, Vision v2 Phase 1 — 2026-07-11).
 *
 * PURE half of the first-run setup wizard: parses Steam's libraryfolders.vdf,
 * derives X4 install candidates, and proposes the full five-path Forge config from
 * a confirmed game directory. All filesystem/registry I/O lives in
 * `src/server/gameDetectRoutes.ts` — this module is string-in/string-out so the
 * oracle can prove the parsing against fixtures without touching a real machine.
 */

/** X4: Foundations Steam app id — appmanifest_392160.acf marks an install. */
export const X4_STEAM_APPID = '392160';

/** Path (relative to a Steam library root) of the X4 install directory. */
export const X4_STEAM_REL_DIR = 'steamapps/common/X4 Foundations';

/**
 * Parse Steam's libraryfolders.vdf and return every library root path.
 * The VDF shape (current format) nests numbered blocks each carrying a
 * `"path"  "D:\\SteamLibrary"` line; escaped backslashes are unescaped.
 * Malformed input returns [] — the caller treats that as "no extra libraries".
 */
export function parseLibraryFolders(vdfText: string): string[] {
  if (!vdfText || typeof vdfText !== 'string') return [];
  const out: string[] = [];
  const re = /"path"\s+"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(vdfText)) !== null) {
    const raw = m[1].replace(/\\\\/g, '\\');
    if (raw.trim()) out.push(raw.trim());
  }
  return [...new Set(out)];
}

export interface SetupProposal {
  x4GamePath: string;
  /** Safe editable filesystem root; explicit Deploy separately targets game extensions. */
  filesystemPath: string;
  /** Where the user's mod source projects live. */
  modWorkspacePath: string;
  /** Where harvested XSDs go (served by the harvest endpoint). */
  xsdSchemaPath: string;
}

/** Windows-style join for the pure layer (server normalizes with real `path`). */
const joinWin = (...parts: string[]) =>
  parts.filter(Boolean).join('\\').replace(/[\\/]+/g, '\\');

/**
 * Given a confirmed game dir + the user's home dir + the Forge's cwd, propose all
 * config paths. The proposal is a SUGGESTION rendered for the user to confirm —
 * nothing applies it automatically (first-run wizard doctrine: one confirm click,
 * manual override always visible).
 */
export function proposeSetup(input: { gameDir: string; homeDir: string; forgeCwd: string }): SetupProposal {
  const developmentRoot = joinWin(input.homeDir, 'Documents', 'X4ForgeMods');
  return {
    x4GamePath: input.gameDir,
    filesystemPath: developmentRoot,
    modWorkspacePath: developmentRoot,
    xsdSchemaPath: joinWin(input.forgeCwd, 'data', 'harvested-schemas'),
  };
}

/* ------------------------------------------------------------------ *
 * Oracle
 * ------------------------------------------------------------------ */

export function runGameDetectSelftest(): {
  allPassed: boolean; pass: boolean; passed: number; total: number;
  checks: { name: string; pass: boolean; detail?: string }[];
} {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, cond: boolean, detail?: string) =>
    checks.push({ name, pass: !!cond, detail });

  // Real-shaped current-format VDF (numbered blocks, escaped backslashes).
  const vdf = `"libraryfolders"
{
\t"0"
\t{
\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"
\t\t"label"\t\t""
\t}
\t"1"
\t{
\t\t"path"\t\t"G:\\\\SteamLibrary"
\t\t"apps"
\t\t{
\t\t\t"392160"\t\t"12345678"
\t\t}
\t}
}`;
  const libs = parseLibraryFolders(vdf);
  ok('vdf_two_libraries', libs.length === 2, JSON.stringify(libs));
  ok('vdf_backslashes_unescaped', libs[1] === 'G:\\SteamLibrary', libs[1]);
  ok('vdf_malformed_empty', parseLibraryFolders('not a vdf at all').length === 0);
  ok('vdf_null_safe', parseLibraryFolders(undefined as unknown as string).length === 0);
  ok('vdf_dedupes', parseLibraryFolders(vdf + vdf).length === 2);

  ok('appid_is_x4', X4_STEAM_APPID === '392160');

  // Synthetic fixture paths only — deliberately generic (these strings ship in the bundle).
  const p = proposeSetup({ gameDir: 'D:\\SteamLibrary\\steamapps\\common\\X4 Foundations', homeDir: 'C:\\Users\\example', forgeCwd: 'C:\\X4Forge' });
  ok('proposal_filesystem_isolated', p.filesystemPath === 'C:\\Users\\example\\Documents\\X4ForgeMods', p.filesystemPath);
  ok('proposal_workspace_under_documents', p.modWorkspacePath === 'C:\\Users\\example\\Documents\\X4ForgeMods', p.modWorkspacePath);
  ok('proposal_editable_roots_match', p.filesystemPath === p.modWorkspacePath, `${p.filesystemPath} != ${p.modWorkspacePath}`);
  ok('proposal_schemas_under_data', p.xsdSchemaPath === 'C:\\X4Forge\\data\\harvested-schemas', p.xsdSchemaPath);
  ok('proposal_keeps_game_dir_verbatim', p.x4GamePath === 'D:\\SteamLibrary\\steamapps\\common\\X4 Foundations');

  const passed = checks.filter(c => c.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}
