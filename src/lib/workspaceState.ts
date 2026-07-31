// B2 slice 3 (ADR-F1): active-workspace disk persistence + parked per-mod states.
//
// The server's active workspace was in-memory-only — a restart with a blank client
// attached clobbered real state (counted incident, 2026-07-11). This engine gives the
// server: (a) an atomic on-disk copy of the active state that survives restarts with
// zero clients attached, and (b) a "parked" store so switching to a different mod
// PARKS the previous state instead of destroying it (the per-mod protection ADR-F1
// point 1 names; B12 multi-workspace tabs ride on this map later).
//
// Everything takes the state dir as a parameter so the oracle exercises a temp dir,
// never the live one.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

export interface PersistedWorkspaceState {
  workspace: any;
  version: number;
  savedAt: string;
  origin: string;
}

export interface ParkedSummary {
  name: string;
  slug: string;
  savedAt: string;
  version: number;
  nodeCount: number;
  /** B12 residual fix: domain-aware human label, e.g. "3 nodes" / "1 patch" /
   *  "1 text file" — so beyond-canvas workspaces don't all read "0 nodes". */
  contentSummary: string;
}

/** Human, domain-aware one-liner of what a workspace holds (canvas + beyond-canvas). */
export function summarizeWorkspaceContent(ws: any): string {
  const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const parts: string[] = [];
  const nodes = Array.isArray(ws?.nodes) ? ws.nodes.length : 0;
  const patches = Array.isArray(ws?.xmlPatches) ? ws.xmlPatches.length : 0;
  const tFiles = Array.isArray(ws?.tFiles) ? ws.tFiles.length : 0;
  const widgets = Array.isArray(ws?.uiWidgets) ? ws.uiWidgets.length : 0;
  const wares = Array.isArray(ws?.wares) ? ws.wares.length : 0;
  const jobs = Array.isArray(ws?.jobs) ? ws.jobs.length : 0;
  if (nodes) parts.push(plural(nodes, 'node'));
  if (patches) parts.push(plural(patches, 'patch', 'patches'));
  if (tFiles) parts.push(plural(tFiles, 'text file'));
  if (widgets) parts.push(plural(widgets, 'widget'));
  if (wares) parts.push(plural(wares, 'ware'));
  if (jobs) parts.push(plural(jobs, 'job'));
  return parts.length ? parts.join(', ') : 'empty';
}

const ACTIVE_FILE = "active.json";
const PARKED_PREFIX = "parked-";
export const PARKED_LIMIT_DEFAULT = 20;

/** Filesystem-safe, collision-stable slug for a workspace name. */
export function slugifyWorkspaceName(name: string): string {
  const base = String(name || "unnamed")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "unnamed";
  // Case-insensitive filesystems (Windows) would merge Foo/foo — disambiguate with a
  // tiny stable checksum of the exact name so distinct names never share a file.
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum = (sum * 31 + name.charCodeAt(i)) >>> 0;
  return `${base}_${sum.toString(16)}`;
}

export interface AtomicWriteOptions {
  /** Test-only seam: production callers never provide this. */
  beforeRename?: (tmp: string, target: string) => void;
  /** Create the complete sibling temp with this mode before promotion (for credential files). */
  mode?: number;
}

/**
 * Write bytes via a sibling temp file + rename, cleaning the temp on every failure path.
 * The destination is untouched until the complete temp file has been closed successfully.
 */
export function atomicWriteFile(file: string, data: string | Buffer, options: AtomicWriteOptions = {}): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    if (typeof data === 'string') fs.writeFileSync(tmp, data, { encoding: 'utf8', flag: 'wx', ...(options.mode === undefined ? {} : { mode: options.mode }) });
    else fs.writeFileSync(tmp, data, { flag: 'wx', ...(options.mode === undefined ? {} : { mode: options.mode }) });
    // writeFile's mode is creation-only. Enforce the completed temp before it can replace
    // an existing destination whose previous permissions may have been broader.
    if (options.mode !== undefined) fs.chmodSync(tmp, options.mode);
    options.beforeRename?.(tmp, file);
    fs.renameSync(tmp, file);
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best-effort orphan cleanup */ }
  }
}

/** Write JSON via the shared atomic byte writer. */
export function atomicWriteJson(file: string, data: unknown, options: AtomicWriteOptions = {}): void {
  atomicWriteFile(file, JSON.stringify(data), options);
}

/** A persisted state is adoptable only if it looks like a real workspace. */
function isValidState(parsed: any): parsed is PersistedWorkspaceState {
  return Boolean(
    parsed &&
    typeof parsed === "object" &&
    parsed.workspace &&
    typeof parsed.workspace === "object" &&
    Array.isArray(parsed.workspace.nodes) &&
    typeof parsed.workspace.name === "string"
  );
}

export function writeActiveState(stateDir: string, state: PersistedWorkspaceState): void {
  atomicWriteJson(path.join(stateDir, ACTIVE_FILE), state);
}

/** null on missing, unparsable, or shape-invalid — the caller boots the default. */
export function readActiveState(stateDir: string): PersistedWorkspaceState | null {
  try {
    const raw = fs.readFileSync(path.join(stateDir, ACTIVE_FILE), "utf8");
    const parsed = JSON.parse(raw);
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Park a state under its workspace name (latest write wins per name), pruning oldest beyond limit. */
export function parkState(stateDir: string, state: PersistedWorkspaceState, limit: number = PARKED_LIMIT_DEFAULT): string {
  const slug = slugifyWorkspaceName(state.workspace?.name);
  const file = path.join(stateDir, `${PARKED_PREFIX}${slug}.json`);
  atomicWriteJson(file, state);
  try {
    const parked = fs.readdirSync(stateDir)
      .filter(n => n.startsWith(PARKED_PREFIX) && n.endsWith(".json"))
      .map(n => ({ n, mtime: fs.statSync(path.join(stateDir, n)).mtimeMs }))
      .sort((a, b) => a.mtime - b.mtime);
    for (let i = 0; i < parked.length - limit; i++) {
      fs.unlinkSync(path.join(stateDir, parked[i].n));
    }
  } catch { /* pruning is best-effort; the park itself already succeeded */ }
  return file;
}

export function listParked(stateDir: string): ParkedSummary[] {
  try {
    return fs.readdirSync(stateDir)
      .filter(n => n.startsWith(PARKED_PREFIX) && n.endsWith(".json"))
      .map(n => {
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(stateDir, n), "utf8"));
          if (!isValidState(parsed)) return null;
          return {
            name: String(parsed.workspace.name),
            slug: n.slice(PARKED_PREFIX.length, -".json".length),
            savedAt: String(parsed.savedAt || ""),
            version: Number(parsed.version || 0),
            nodeCount: parsed.workspace.nodes.length,
            contentSummary: summarizeWorkspaceContent(parsed.workspace),
          };
        } catch {
          return null;
        }
      })
      .filter((x): x is ParkedSummary => x !== null)
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  } catch {
    return [];
  }
}

export function readParked(stateDir: string, name: string): PersistedWorkspaceState | null {
  try {
    const file = path.join(stateDir, `${PARKED_PREFIX}${slugifyWorkspaceName(name)}.json`);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Oracle (house pattern): deterministic, runs against a throwaway temp dir.
// ---------------------------------------------------------------------------

export function runWorkspaceStateSelftest(): { pass: boolean; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-wsstate-"));
  const mkState = (name: string, nodes: any[] = [{ id: "n1" }], version = 100): PersistedWorkspaceState => ({
    workspace: { id: "workspace_default", name, nodes, links: [] },
    version,
    savedAt: new Date(version).toISOString(),
    origin: "selftest",
  });
  try {
    // 0. atomic failure preserves the previous destination and leaves no temp file.
    const atomicTarget = path.join(dir, 'atomic.txt');
    fs.writeFileSync(atomicTarget, 'last-known-good', 'utf8');
    let injectedFailure = false;
    try {
      atomicWriteFile(atomicTarget, 'replacement', {
        beforeRename: () => { throw new Error('injected pre-rename failure'); },
      });
    } catch { injectedFailure = true; }
    checks.push({ name: 'atomic_failure_is_reported', pass: injectedFailure });
    checks.push({ name: 'atomic_failure_preserves_previous_bytes', pass: fs.readFileSync(atomicTarget, 'utf8') === 'last-known-good' });
    checks.push({ name: 'atomic_failure_leaves_no_temp_file', pass: !fs.readdirSync(dir).some(name => name.startsWith('.atomic.txt.') && name.endsWith('.tmp')) });

    // 0b. Restricted files are promoted with the requested mode and never reuse a fixed
    // temp name (two consecutive writes leave no shared temp artifact).
    const restrictedTarget = path.join(dir, 'restricted.json');
    atomicWriteJson(restrictedTarget, { version: 1 }, { mode: 0o600 });
    atomicWriteJson(restrictedTarget, { version: 2 }, { mode: 0o600 });
    checks.push({ name: 'atomic_restricted_mode', pass: process.platform === 'win32' || (fs.statSync(restrictedTarget).mode & 0o777) === 0o600 });
    checks.push({ name: 'atomic_unique_temp_no_litter', pass: !fs.readdirSync(dir).some(name => name.startsWith('.restricted.json.') && name.endsWith('.tmp')) });

    // 1. active round-trip
    const s1 = mkState("Alpha_Mod", [{ id: "n1" }, { id: "n2" }], 111);
    writeActiveState(dir, s1);
    const r1 = readActiveState(dir);
    checks.push({ name: "active_roundtrip", pass: JSON.stringify(r1) === JSON.stringify(s1) });

    // 2. atomic write leaves no tmp litter
    const litter = fs.readdirSync(dir).filter(n => n.startsWith(".tmp-"));
    checks.push({ name: "atomic_no_tmp_litter", pass: litter.length === 0, detail: litter.join(",") });

    // 3. corrupt active file → null, no throw
    fs.writeFileSync(path.join(dir, "active.json"), "{ not json", "utf8");
    checks.push({ name: "corrupt_active_returns_null", pass: readActiveState(dir) === null });

    // 4. shape-invalid (nodes missing) → null
    fs.writeFileSync(path.join(dir, "active.json"), JSON.stringify({ workspace: { name: "x" }, version: 1 }), "utf8");
    checks.push({ name: "invalid_shape_returns_null", pass: readActiveState(dir) === null });

    // 5. park + list reflects name/nodeCount + a domain-aware content summary
    parkState(dir, mkState("Beta_Mod", [{ id: "a" }, { id: "b" }, { id: "c" }], 200));
    const l1 = listParked(dir);
    checks.push({
      name: "park_and_list",
      pass: l1.length === 1 && l1[0].name === "Beta_Mod" && l1[0].nodeCount === 3 && l1[0].contentSummary === "3 nodes",
      detail: JSON.stringify(l1),
    });

    // 5b. B12 residual: a beyond-canvas (node-less) workspace summarizes by its REAL
    // content, not "0 nodes". summarizeWorkspaceContent is the single source of that label.
    checks.push({
      name: "content_summary_beyond_canvas",
      pass: summarizeWorkspaceContent({ nodes: [], xmlPatches: [{ id: 'p' }], tFiles: [], uiWidgets: [] }) === "1 patch"
        && summarizeWorkspaceContent({ nodes: [], xmlPatches: [], tFiles: [{ id: 't' }], uiWidgets: [{ id: 'w' }, { id: 'w2' }] }) === "1 text file, 2 widgets"
        && summarizeWorkspaceContent({ nodes: [], xmlPatches: [], tFiles: [], uiWidgets: [] }) === "empty",
      detail: summarizeWorkspaceContent({ nodes: [], xmlPatches: [{ id: 'p' }] }),
    });

    // 6. re-park same name → single entry, latest wins
    parkState(dir, mkState("Beta_Mod", [{ id: "a" }], 300));
    const l2 = listParked(dir);
    checks.push({
      name: "repark_same_name_latest_wins",
      pass: l2.length === 1 && l2[0].version === 300 && l2[0].nodeCount === 1,
      detail: JSON.stringify(l2),
    });

    // 7. readParked round-trip + missing → null
    const rp = readParked(dir, "Beta_Mod");
    checks.push({ name: "read_parked", pass: rp !== null && rp.version === 300 });
    checks.push({ name: "read_parked_missing_null", pass: readParked(dir, "Nope_Never") === null });

    // 8. prune keeps the newest `limit` entries
    for (let i = 0; i < 5; i++) parkState(dir, mkState(`Prune_${i}`, [{ id: "n" }], 400 + i), 3);
    const l3 = listParked(dir);
    const survivorNames = l3.map(p => p.name).sort();
    checks.push({
      name: "prune_keeps_newest",
      pass: l3.length === 3,
      detail: survivorNames.join(","),
    });

    // 9. slug: distinct names that collide case-insensitively get distinct files
    const slugA = slugifyWorkspaceName("MyMod");
    const slugB = slugifyWorkspaceName("mymod");
    checks.push({ name: "slug_case_distinct", pass: slugA !== slugB, detail: `${slugA} vs ${slugB}` });
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp cleanup best-effort */ }
  }
  return { pass: checks.every(c => c.pass), checks };
}
