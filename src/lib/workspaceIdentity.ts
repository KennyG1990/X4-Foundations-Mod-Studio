/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Workspace identity hash (BACKLOG B1, 2026-07-09 — sync-trust slice).
 *
 * The client/server workspace sync trusts a bare integer version; when the adoption gate
 * mis-fires (the restart-reset class fixed the same day), the canvas silently diverges
 * from the server with NOTHING visible to the user. This module gives both sides one
 * deterministic content hash so divergence can be DETECTED and SHOWN (a badge, not a
 * guess), and the user chooses: adopt the server copy or keep editing (their next edit
 * syncs up normally). Pure logic, shared by browser and server — no I/O, no crypto dep.
 */

import type { ModWorkspace } from '../types';

/** Deterministic JSON: objects serialize with sorted keys; undefined drops (like JSON). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(v => stableStringify(v === undefined ? null : v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** FNV-1a 32-bit ×2 over a string (same recipe as compileFidelity — proven adequate for
 * "did this content change", not a security boundary). */
function fnvHash(text: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c; h2 = Math.imul(h2, 0x01000193) >>> 0; h2 = (h2 + 0x9e3779b9) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/**
 * Content hash of the CANONICAL workspace substance. Includes everything that deploys
 * (nodes/links/domains/passthrough/stamp/meta); both sides must hash the same sanitized
 * shape — hash AFTER sanitizeWorkspace on both ends.
 */
export function workspaceContentHash(ws: ModWorkspace | null | undefined): string {
  if (!ws || typeof ws !== 'object') return 'empty';
  const w = ws as unknown as Record<string, unknown>;
  const substance = {
    name: w.name, version: w.version, author: w.author, description: w.description,
    nodes: w.nodes, links: w.links,
    uiWidgets: w.uiWidgets, aiScripts: w.aiScripts, wares: w.wares, jobs: w.jobs,
    tFiles: w.tFiles, xmlPatches: w.xmlPatches, customLua: w.customLua,
    compileSettings: w.compileSettings, dependencies: w.dependencies,
    passthroughFiles: w.passthroughFiles, originalFiles: w.originalFiles,
    sourceStamp: w.sourceStamp, integrationContract: w.integrationContract,
    mdFileStem: w.mdFileStem,
  };
  return fnvHash(stableStringify(substance));
}

/**
 * Complete digest of one already-sanitized authoritative workspace snapshot.
 *
 * This is deliberately separate from `workspaceContentHash`: that legacy hash is persisted
 * as the registry/CAS head and intentionally covers deployable substance. Polling needs to
 * observe every persisted/UI field without migrating or invalidating those durable heads.
 * `workspace.id` remains part of this digest because authoring surfaces use it for generated
 * paths and script identities. The registry canonicalizes accepted legacy records that omit
 * it before hashing/exposure, so the same stored record remains deterministic across processes.
 * Callers must sanitize first so server and browser compare the same canonical shape.
 */
export function workspaceSnapshotHash(ws: ModWorkspace | null | undefined): string {
  if (!ws || typeof ws !== 'object') return 'empty';
  return fnvHash(stableStringify(ws as unknown as Record<string, unknown>));
}

/* ------------------------------------------------------------------ *
 * Oracle
 * ------------------------------------------------------------------ */

export function runWorkspaceIdentitySelftest(): {
  allPassed: boolean; pass: boolean; passed: number; total: number;
  checks: { name: string; pass: boolean; detail?: string }[];
} {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, cond: boolean, detail?: unknown) =>
    checks.push({ name, pass: !!cond, detail: detail === undefined ? undefined : (typeof detail === 'string' ? detail : JSON.stringify(detail)) });

  const base = {
    name: 'M', nodes: [{ id: 'n1', type: 'cue', properties: { name: 'Start', b: 1, a: 2 } }],
    links: [{ sourceNodeId: 'n1', targetNodeId: 'n2' }],
  } as unknown as ModWorkspace;

  // key order must not matter
  const reordered = {
    links: [{ targetNodeId: 'n2', sourceNodeId: 'n1' }],
    nodes: [{ properties: { a: 2, b: 1, name: 'Start' }, type: 'cue', id: 'n1' }],
    name: 'M',
  } as unknown as ModWorkspace;
  ok('key_order_independent', workspaceContentHash(base) === workspaceContentHash(reordered));

  // undefined field === absent field (JSON round-trip through the API drops undefined)
  const withUndef = { ...base, customLua: undefined } as unknown as ModWorkspace;
  ok('undefined_equals_absent', workspaceContentHash(base) === workspaceContentHash(withUndef));

  // any substance change is detected
  const edited = JSON.parse(JSON.stringify(base)); edited.nodes[0].properties.name = 'Start2';
  ok('node_property_change_detected', workspaceContentHash(base) !== workspaceContentHash(edited));
  const linkEdit = JSON.parse(JSON.stringify(base)); linkEdit.links.push({ sourceNodeId: 'n2', targetNodeId: 'n3' });
  ok('link_add_detected', workspaceContentHash(base) !== workspaceContentHash(linkEdit));
  const renamed = JSON.parse(JSON.stringify(base)); renamed.name = 'M2';
  ok('workspace_rename_detected', workspaceContentHash(base) !== workspaceContentHash(renamed));
  ok('snapshot_hash_detects_non_cas_field', workspaceSnapshotHash(base) !== workspaceSnapshotHash({
    ...base,
    uiTheme: { backgroundColor: '#000', borderColor: '#111', accentColor: '#222', opacity: 1, showIcons: true },
  } as ModWorkspace));
  ok('snapshot_hash_detects_authoritative_internal_id', workspaceSnapshotHash(base) !== workspaceSnapshotHash({
    ...base,
    id: 'different-legacy-local-id',
  } as ModWorkspace));

  // JSON round-trip stability (client → POST → server → GET → client)
  ok('json_roundtrip_stable', workspaceContentHash(JSON.parse(JSON.stringify(base))) === workspaceContentHash(base));

  // degradation
  ok('null_and_undefined_hash_empty', workspaceContentHash(null) === 'empty' && workspaceContentHash(undefined) === 'empty');
  ok('snapshot_null_and_undefined_hash_empty', workspaceSnapshotHash(null) === 'empty' && workspaceSnapshotHash(undefined) === 'empty');

  // stableStringify basics
  ok('stable_stringify_sorts_keys', stableStringify({ b: 1, a: 2 }) === '{"a":2,"b":1}');
  ok('stable_stringify_arrays_ordered', stableStringify([1, 2]) !== stableStringify([2, 1]));

  const passed = checks.filter(c => c.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}
