/**
 * Deterministic directory-role safety for X4 Forge.
 *
 * The installed game and unpacked corpus are protected roots. Editable development
 * roots may never overlap either tree. Explicit deploy is the sole exception and
 * does not use this validator for its destination.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type DirectoryField = 'x4GamePath' | 'modWorkspacePath' | 'filesystemPath';

export interface DirectoryPathIssue {
  field: DirectoryField;
  code: 'GAME_NOT_FOUND' | 'GAME_MARKER_MISSING' | 'PROTECTED_ROOT_OVERLAP';
  message: string;
  path: string;
  protectedPath?: string;
}

export interface DirectoryRoleInput {
  x4GamePath?: string;
  x4ReferenceRoot?: string;
  modWorkspacePath?: string;
  filesystemPath?: string;
}

function existingAncestorRealpath(absolutePath: string): string {
  const tail: string[] = [];
  let cursor = absolutePath;
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) return absolutePath;
    tail.unshift(path.basename(cursor));
    cursor = parent;
  }
  try {
    const real = fs.realpathSync.native(cursor);
    return tail.length ? path.join(real, ...tail) : real;
  } catch {
    return absolutePath;
  }
}

/** Resolve separators, relative segments, trailing separators, and existing junctions. */
export function canonicalDirectoryPath(rawPath: string): string {
  const trimmed = String(rawPath || '').trim();
  if (!trimmed) return '';
  return path.normalize(existingAncestorRealpath(path.resolve(trimmed)));
}

function comparisonKey(rawPath: string): string {
  const canonical = canonicalDirectoryPath(rawPath);
  return process.platform === 'win32' ? canonical.toLocaleLowerCase('en-US') : canonical;
}

export function isSameOrDescendant(candidatePath: string, rootPath: string): boolean {
  const candidate = comparisonKey(candidatePath);
  const root = comparisonKey(rootPath);
  if (!candidate || !root) return false;
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`);
}

export function pathsOverlap(leftPath: string, rightPath: string): boolean {
  return isSameOrDescendant(leftPath, rightPath) || isSameOrDescendant(rightPath, leftPath);
}

export function inspectGameInstall(gamePath: string): { valid: boolean; canonicalPath: string; issue?: DirectoryPathIssue } {
  const canonicalPath = canonicalDirectoryPath(gamePath);
  if (!canonicalPath) return { valid: false, canonicalPath };
  let stat: fs.Stats;
  try { stat = fs.statSync(canonicalPath); }
  catch {
    return {
      valid: false,
      canonicalPath,
      issue: { field: 'x4GamePath', code: 'GAME_NOT_FOUND', path: canonicalPath, message: `X4 game installation not found at "${canonicalPath}".` },
    };
  }
  if (!stat.isDirectory()) {
    return {
      valid: false,
      canonicalPath,
      issue: { field: 'x4GamePath', code: 'GAME_NOT_FOUND', path: canonicalPath, message: `X4 game installation must be a directory: "${canonicalPath}".` },
    };
  }
  if (!fs.existsSync(path.join(canonicalPath, 'X4.exe'))) {
    return {
      valid: false,
      canonicalPath,
      issue: {
        field: 'x4GamePath',
        code: 'GAME_MARKER_MISSING',
        path: canonicalPath,
        message: `"${canonicalPath}" is not an X4 installation root (X4.exe was not found).`,
      },
    };
  }
  return { valid: true, canonicalPath };
}

/**
 * Validate every editable root against protected runtime/corpus trees.
 * Empty optional paths are allowed; a non-empty game path must be a real X4 root.
 */
export function validateDirectoryRoles(input: DirectoryRoleInput): DirectoryPathIssue[] {
  const issues: DirectoryPathIssue[] = [];
  const gamePath = String(input.x4GamePath || '').trim();
  const referenceRoot = String(input.x4ReferenceRoot || '').trim();
  if (gamePath) {
    const game = inspectGameInstall(gamePath);
    if (!game.valid && game.issue) issues.push(game.issue);
  }

  const protectedRoots = [
    ...(gamePath ? [
      { label: 'installed X4 game', path: gamePath },
      { label: 'live X4 extensions folder', path: path.join(gamePath, 'extensions') },
    ] : []),
    ...(referenceRoot ? [{ label: 'read-only unpacked X4 corpus', path: referenceRoot }] : []),
  ];

  const editable: Array<{ field: 'modWorkspacePath' | 'filesystemPath'; label: string; value: string }> = [
    { field: 'modWorkspacePath', label: 'Mod Workspace Folder', value: String(input.modWorkspacePath || '').trim() },
    { field: 'filesystemPath', label: 'Filesystem Folder', value: String(input.filesystemPath || '').trim() },
  ];
  for (const root of editable) {
    if (!root.value) continue;
    for (const protectedRoot of protectedRoots) {
      if (!pathsOverlap(root.value, protectedRoot.path)) continue;
      const canonical = canonicalDirectoryPath(root.value);
      const protectedCanonical = canonicalDirectoryPath(protectedRoot.path);
      issues.push({
        field: root.field,
        code: 'PROTECTED_ROOT_OVERLAP',
        path: canonical,
        protectedPath: protectedCanonical,
        message: `${root.label} must be an isolated development directory. "${canonical}" overlaps the ${protectedRoot.label} at "${protectedCanonical}". Choose a separate folder such as Documents\\X4ForgeMods; use Deploy when you intentionally want to update the live game.`,
      });
      break;
    }
  }
  return issues;
}

export function runPathRolesSelftest() {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, ...(detail ? { detail } : {}) });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-path-roles-'));
  const game = path.join(tmp, 'X4 Foundations');
  const live = path.join(game, 'extensions');
  const corpus = path.join(tmp, 'X4 unpacked');
  const safe = path.join(tmp, 'X4ForgeMods');
  try {
    fs.mkdirSync(live, { recursive: true });
    fs.mkdirSync(corpus, { recursive: true });
    fs.mkdirSync(safe, { recursive: true });
    fs.writeFileSync(path.join(game, 'X4.exe'), '', 'utf8');
    ok('real_game_marker_accepted', inspectGameInstall(game).valid);
    ok('non_game_directory_rejected', inspectGameInstall(corpus).issue?.code === 'GAME_MARKER_MISSING');
    ok('missing_game_rejected', inspectGameInstall(path.join(tmp, 'missing')).issue?.code === 'GAME_NOT_FOUND');
    ok('safe_workspace_accepted', validateDirectoryRoles({ x4GamePath: game, x4ReferenceRoot: corpus, modWorkspacePath: safe, filesystemPath: safe }).length === 0);
    ok('live_extensions_workspace_rejected', validateDirectoryRoles({ x4GamePath: game, modWorkspacePath: live }).some(i => i.field === 'modWorkspacePath'));
    ok('game_child_workspace_rejected', validateDirectoryRoles({ x4GamePath: game, modWorkspacePath: path.join(game, 'dev') }).some(i => i.field === 'modWorkspacePath'));
    ok('game_parent_workspace_rejected', validateDirectoryRoles({ x4GamePath: game, modWorkspacePath: tmp }).some(i => i.field === 'modWorkspacePath'));
    ok('corpus_workspace_rejected', validateDirectoryRoles({ x4ReferenceRoot: corpus, modWorkspacePath: corpus }).some(i => i.field === 'modWorkspacePath'));
    ok('corpus_parent_filesystem_rejected', validateDirectoryRoles({ x4ReferenceRoot: corpus, filesystemPath: tmp }).some(i => i.field === 'filesystemPath'));
    ok('case_and_dot_segments_normalized', pathsOverlap(path.join(live, '..', 'extensions'), live));
    const linkedGame = path.join(tmp, 'linked-game');
    fs.symlinkSync(game, linkedGame, 'junction');
    ok('junction_to_game_rejected', validateDirectoryRoles({ x4GamePath: game, modWorkspacePath: linkedGame }).some(i => i.field === 'modWorkspacePath'));
    ok('empty_optional_paths_accepted', validateDirectoryRoles({}).length === 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}

if (path.basename(process.argv[1] || '') === 'pathRoles.ts') {
  const result = runPathRolesSelftest();
  console.log(`path roles selftest: ${result.passed}/${result.total} allPassed=${result.allPassed}`);
  for (const check of result.checks) if (!check.pass) console.log('FAIL', check.name, check.detail || '');
  process.exit(result.allPassed ? 0 : 1);
}
