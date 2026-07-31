/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B110-R11 — deterministic, bounded workspace-conflict evidence.
 *
 * The server owns compilation of both workspaces. This module only compares the emitted file
 * maps, so the UI never invents a domain diff from canvas node counts. Paths are canonicalized
 * for Windows; samples are bounded before they cross the API boundary.
 */

import { lineDelta, unifiedDiff } from './agentHistory';

export const WORKSPACE_CONFLICT_MAX_FILES = 4_000;
export const WORKSPACE_CONFLICT_MAX_SAMPLES = 8;
export const WORKSPACE_CONFLICT_MAX_TEXT_BYTES = 256 * 1024;
export const WORKSPACE_CONFLICT_MAX_DIFF_CHARS = 8_000;

export interface WorkspaceConflictFile {
  path: string;
  kind: 'added' | 'removed' | 'modified';
  serverBytes: number;
  localBytes: number;
  lines?: { added: number; removed: number };
  diff?: string;
  diffUnavailable?: string;
}

export interface WorkspaceConflictPreview {
  counts: { added: number; removed: number; modified: number; unchanged: number; changed: number };
  files: WorkspaceConflictFile[];
  changedPaths: string[];
  truncated: boolean;
}

function canonicalPath(input: string): string {
  return String(input || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function normalizedFiles(files: Record<string, string>): Map<string, { path: string; content: string }> {
  const out = new Map<string, { path: string; content: string }>();
  for (const [rawPath, rawContent] of Object.entries(files || {}).slice(0, WORKSPACE_CONFLICT_MAX_FILES + 1)) {
    const key = canonicalPath(rawPath);
    if (!key || out.has(key)) continue;
    out.set(key, { path: String(rawPath).replace(/\\/g, '/').replace(/^\/+/, ''), content: String(rawContent) });
  }
  return out;
}

export function buildWorkspaceConflictPreview(
  localFilesInput: Record<string, string>,
  serverFilesInput: Record<string, string>,
): WorkspaceConflictPreview {
  const local = normalizedFiles(localFilesInput);
  const server = normalizedFiles(serverFilesInput);
  const keys = [...new Set([...local.keys(), ...server.keys()])].sort();
  const changed: WorkspaceConflictFile[] = [];
  let unchanged = 0;

  for (const key of keys.slice(0, WORKSPACE_CONFLICT_MAX_FILES)) {
    const localFile = local.get(key);
    const serverFile = server.get(key);
    if (localFile && serverFile && localFile.content === serverFile.content) {
      unchanged += 1;
      continue;
    }
    const path = localFile?.path || serverFile?.path || key;
    const serverText = serverFile?.content || '';
    const localText = localFile?.content || '';
    const kind: WorkspaceConflictFile['kind'] = !serverFile ? 'added' : !localFile ? 'removed' : 'modified';
    const serverBytes = byteLength(serverText);
    const localBytes = byteLength(localText);
    const row: WorkspaceConflictFile = { path, kind, serverBytes, localBytes };
    if (serverBytes <= WORKSPACE_CONFLICT_MAX_TEXT_BYTES && localBytes <= WORKSPACE_CONFLICT_MAX_TEXT_BYTES) {
      row.lines = lineDelta(serverText, localText);
      const diff = unifiedDiff(serverText, localText, path);
      row.diff = diff.length > WORKSPACE_CONFLICT_MAX_DIFF_CHARS
        ? `${diff.slice(0, WORKSPACE_CONFLICT_MAX_DIFF_CHARS)}\n… diff truncated …`
        : diff;
    } else {
      row.diffUnavailable = `Text diff omitted because one side exceeds ${WORKSPACE_CONFLICT_MAX_TEXT_BYTES} bytes.`;
    }
    changed.push(row);
  }

  const added = changed.filter(row => row.kind === 'added').length;
  const removed = changed.filter(row => row.kind === 'removed').length;
  const modified = changed.filter(row => row.kind === 'modified').length;
  const truncated = keys.length > WORKSPACE_CONFLICT_MAX_FILES || changed.length > WORKSPACE_CONFLICT_MAX_SAMPLES;
  return {
    counts: { added, removed, modified, unchanged, changed: changed.length },
    files: changed.slice(0, WORKSPACE_CONFLICT_MAX_SAMPLES),
    changedPaths: changed.map(row => row.path).slice(0, 100),
    truncated,
  };
}

export function runWorkspaceConflictSelftest(): {
  allPassed: boolean;
  passed: number;
  total: number;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
} {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({
    name,
    pass,
    ...(detail === undefined ? {} : { detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }),
  });

  const preview = buildWorkspaceConflictPreview(
    { 'MD\\a.xml': '<a>local</a>\n', 'new.txt': 'new\n', 'same.txt': 'same\n' },
    { 'md/a.xml': '<a>server</a>\n', 'gone.txt': 'gone\n', 'SAME.TXT': 'same\n' },
  );
  ok('slash_and_case_identity', preview.counts.unchanged === 1, preview.counts);
  ok('added_removed_modified_counts', preview.counts.added === 1 && preview.counts.removed === 1 && preview.counts.modified === 1, preview.counts);
  ok('direction_is_server_to_local', preview.files.find(row => /a\.xml$/i.test(row.path))?.diff?.includes('+<a>local</a>') === true);
  ok('changed_paths_are_deterministic', JSON.stringify(preview.changedPaths) === JSON.stringify([...preview.changedPaths].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))));
  const equal = buildWorkspaceConflictPreview({ 'a.txt': 'x' }, { 'A.TXT': 'x' });
  ok('equivalent_maps_have_no_change', equal.counts.changed === 0 && equal.files.length === 0);
  const large = 'x'.repeat(WORKSPACE_CONFLICT_MAX_TEXT_BYTES + 1);
  const largePreview = buildWorkspaceConflictPreview({ 'large.txt': large }, { 'large.txt': 'small' });
  ok('oversized_diff_fails_bounded', !!largePreview.files[0]?.diffUnavailable && !largePreview.files[0]?.diff);
  const manyLocal: Record<string, string> = {};
  for (let i = 0; i < WORKSPACE_CONFLICT_MAX_SAMPLES + 3; i += 1) manyLocal[`f${i}.txt`] = String(i);
  const many = buildWorkspaceConflictPreview(manyLocal, {});
  ok('sample_count_is_bounded', many.files.length === WORKSPACE_CONFLICT_MAX_SAMPLES && many.truncated);
  ok('changed_path_count_remains_bounded', many.changedPaths.length <= 100);

  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}
