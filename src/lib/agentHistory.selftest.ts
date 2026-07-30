/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B86 — oracle for the Agent Action Ledger.
 *
 * The bar this oracle holds, in priority order:
 *   1. Payloads are NEVER inlined. A 295 KB write must produce a tiny row, and rewriting the
 *      same content must not grow the store. This is the rule that decides whether the panel is
 *      usable at all, so it is asserted against real byte counts, not by inspection.
 *   2. Titles are readable. No JSON, no stack traces, no script bodies in a summary line.
 *   3. A blocked deploy names its failing stage and reason.
 *   4. No key material reaches disk.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  describeAction, lineDelta, unifiedDiff, looksBinary, redactSecrets, encodeRow, decodeRows,
  filterRows, revertibility, ledgerRouteKind, compactDiagnostics, LedgerRow,
} from './agentHistory';
import { AgentHistoryStore } from './agentHistoryStore';

export function runAgentHistorySelftest(): { pass: boolean; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass: !!pass, detail });

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'x4-history-selftest-'));
  try {
    // --- route allowlist: mutations in, read-only traffic out ---------------------------
    ok('write route is recorded as an edit', ledgerRouteKind('POST', '/api/fs/write') === 'edit');
    ok('deploy route is recorded as a deploy', ledgerRouteKind('POST', '/api/agent/deploy-verify') === 'deploy');
    ok('platform release routes are recorded as package actions',
      ledgerRouteKind('POST', '/api/agent/release/nexus/prepare') === 'package' &&
      ledgerRouteKind('POST', '/api/agent/release/steam/prepare') === 'package' &&
      ledgerRouteKind('POST', '/api/agent/release/steam/verify') === 'package' &&
      ledgerRouteKind('POST', '/api/agent/release/steam/adopt') === 'package' &&
      ledgerRouteKind('POST', '/api/agent/release/export/receipt') === 'package');
    ok('GET traffic is never recorded', ledgerRouteKind('GET', '/api/fs/write') === null);
    ok('reference reads are never recorded', ledgerRouteKind('POST', '/api/reference/factions') === null);

    // --- the summary register (Ken's five examples) --------------------------------------
    const edit = describeAction({
      kind: 'edit', status: 200, body: { ok: true }, request: {},
      files: ['md/aic_politics.xml'], lines: { added: 42, removed: 8 },
    });
    ok('edit summary matches the requested register', edit.title === 'Edited `md/aic_politics.xml` — +42 / −8 lines', edit.title);

    const validate = describeAction({
      kind: 'validate', status: 200, request: {}, files: [],
      body: { fileCount: 27, summary: { schemaErrors: 0, schemaWarnings: 6 } },
    });
    ok('validate summary counts errors and warnings', validate.title === 'Validated 27 files — 0 errors, 6 warnings', validate.title);
    ok('warnings-only validate is a warn, not an error', validate.outcome.status === 'warn', validate.outcome.status);

    const blocked = describeAction({
      kind: 'deploy', status: 200, request: {}, files: [],
      body: {
        ok: false,
        checklist: [
          { id: 'wellformed', label: 'XML well-formed', status: 'fail', detail: '`ai_influence_diplomacy.xml` malformed: mismatched tag line 278.' },
        ],
      },
    });
    ok('blocked deploy names the failing stage in the title', blocked.title.includes("stage 'XML well-formed'"), blocked.title);
    ok('blocked deploy names the reason in the title', blocked.title.includes('ai_influence_diplomacy.xml'), blocked.title);
    ok('blocked deploy records the stage id', blocked.outcome.stage === 'wellformed' && blocked.outcome.status === 'error');

    const errorTitle = describeAction({
      kind: 'compile', status: 500, request: {}, files: [],
      body: { error: 'Boom happened.\n    at Object.<anonymous> (/app/server.ts:1:1)\n    at Module._compile' },
    });
    ok('a stack trace never reaches the title', !errorTitle.title.includes('at Object.<anonymous>'), errorTitle.title);
    ok('failure title stays one readable clause', errorTitle.title.length < 120 && !errorTitle.title.includes('\n'), errorTitle.title);

    // A summary must never become a wall of text even when handed one.
    const wall = describeAction({
      kind: 'edit', status: 400, request: {}, files: ['md/x.xml'],
      body: { error: 'x'.repeat(5000) },
    });
    ok('an enormous error is truncated, not pasted', wall.title.length <= 200, `len=${wall.title.length}`);

    // --- B86.1: coverage. The first version recorded 6 of ~47 mutating routes and the gap was
    // invisible. Mutating routes must default to VISIBLE; only proven read-only stays quiet.
    ok('workspace replacement is recorded', ledgerRouteKind('POST', '/api/agent/workspace') === 'workspace');
    ok('AI generation is recorded', ledgerRouteKind('POST', '/api/agent/generate') === 'generate');
    ok('snapshot restore is recorded', ledgerRouteKind('POST', '/api/fs/restore-snapshot') === 'snapshot');
    ok('settings changes are recorded', ledgerRouteKind('POST', '/api/schema/config') === 'config');
    ok('key lifecycle is recorded', ledgerRouteKind('POST', '/api/agent/keys/revoke') === 'keys');
    ok('shell jobs are recorded', ledgerRouteKind('POST', '/api/run_command/job') === 'command');
    ok('an UNKNOWN mutating route still records', ledgerRouteKind('POST', '/api/agent/some-future-route') === 'action');
    ok('read-only analysis stays quiet', ledgerRouteKind('POST', '/api/agent/explain') === null);
    ok('the ledger never records itself', ledgerRouteKind('POST', '/api/agent/history/x/raw') === null);
    ok('but revert IS recorded', ledgerRouteKind('POST', '/api/agent/history/abc123/revert') === 'revert');

    // --- B86.1: a validation error must NAME the error, not just count it -------------------
    const namedError = describeAction({
      kind: 'validate', status: 200, request: {}, files: [],
      body: {
        fileCount: 2,
        summary: { schemaErrors: 1 },
        flat: [
          { severity: 'error', code: 'project.unresolved_cue_ref', filePath: 'md/ai_influence_diplomacy.xml', line: 278, message: 'Cue reference "Foo" resolves to nothing in this project.' },
        ],
      },
    });
    ok('validate error names the file', namedError.title.includes('ai_influence_diplomacy.xml'), namedError.title);
    ok('validate error names the line', namedError.title.includes('278'), namedError.title);
    ok('validate error names the reason', /resolves to nothing/.test(namedError.title), namedError.title);
    ok('validate error is not a bare count', !/^Validated 2 files — 1 error, 0 warnings$/.test(namedError.title), namedError.title);

    const multi = describeAction({
      kind: 'validate', status: 200, request: {}, files: [],
      body: {
        fileCount: 5, summary: { schemaErrors: 3 },
        flat: [{ severity: 'error', filePath: 'a.xml', message: 'First problem.' }],
      },
    });
    ok('extra errors are counted after the named one', multi.title.includes('(+2 more)'), multi.title);

    const cleanRun = describeAction({
      kind: 'validate', status: 200, request: {}, files: [], body: { fileCount: 27, summary: { schemaWarnings: 0 }, flat: [] },
    });
    ok('a clean validation keeps the original register', cleanRun.title === 'Validated 27 files — 0 errors, 0 warnings', cleanRun.title);

    ok('diagnostics are compacted for storage', (() => {
      const d = compactDiagnostics({ flat: [{ severity: 'error', filePath: 'a.xml', line: 3, message: 'boom', code: 'x' }] });
      return d.length === 1 && d[0].filePath === 'a.xml' && d[0].line === 3;
    })());
    ok('diagnostics redact key material', (() => {
      const d = compactDiagnostics({ flat: [{ severity: 'error', message: 'token x4fk_deadbeefdeadbeef leaked' }] });
      return !d[0].message.includes('x4fk_deadbeefdeadbeef');
    })());

    // --- B86.1: the new kinds produce real sentences, not route names ------------------------
    const wsRow = describeAction({
      kind: 'workspace', status: 200, files: [], routePath: '/api/agent/workspace',
      request: { workspace: { name: 'AI Influence', nodes: new Array(225) } },
      nodes: [{ id: 'n1', label: 'Registry' }],
    });
    ok('workspace summary names the canvas and node counts', /Replaced the working canvas "AI Influence" \(225 nodes\)/.test(wsRow.title), wsRow.title);
    ok('workspace summary reports changed nodes', wsRow.title.includes('1 node changed'), wsRow.title);

    const genRow = describeAction({
      kind: 'generate', status: 200, files: [], routePath: '/api/agent/generate',
      request: { prompt: 'Create a custom mission with an Elite Fighter wing escort' }, body: {},
    });
    ok('generation summary quotes the prompt', genRow.title.includes('Elite Fighter wing escort'), genRow.title);

    const cmdRow = describeAction({
      kind: 'command', status: 200, files: [], routePath: '/api/run_command/job',
      request: { cmd: 'npm run typecheck' }, body: {},
    });
    ok('shell summary names the command', cmdRow.title === 'Ran shell command: npm run typecheck', cmdRow.title);

    const keyRow = describeAction({
      kind: 'keys', status: 200, files: [], routePath: '/api/agent/keys/revoke',
      request: { label: 'codex', token: 'x4fk_shouldneverappear' }, body: {},
    });
    ok('key summary names the label, never the key', keyRow.title.includes('codex') && !keyRow.title.includes('x4fk_'), keyRow.title);

    const unknownRow = describeAction({
      kind: 'action', status: 200, files: [], routePath: '/api/agent/some-future-route', request: {}, body: {},
    });
    ok('an unclassified action still reads as something', unknownRow.title === 'Ran agent/some-future-route', unknownRow.title);

    // --- diff maths ----------------------------------------------------------------------
    const delta = lineDelta('a\nb\nc', 'a\nc\nd');
    ok('line delta counts adds and removes', delta.added === 1 && delta.removed === 1, JSON.stringify(delta));
    ok('identical content is a zero delta', JSON.stringify(lineDelta('same', 'same')) === '{"added":0,"removed":0}');
    ok('unified diff marks both sides', (() => {
      const d = unifiedDiff('a\nb', 'a\nc', 'f.xml');
      return d.includes('-b') && d.includes('+c') && d.includes('--- a/f.xml');
    })());
    ok('binary content is detected', looksBinary(Buffer.from([0x4d, 0x5a, 0x00, 0x01])));
    ok('text content is not called binary', !looksBinary(Buffer.from('<xml>hello</xml>', 'utf8')));

    // --- redaction ------------------------------------------------------------------------
    const leak = redactSecrets('used x4fk_741de45f46e28d16 and Bearer abc.def-123');
    ok('agent keys are redacted', !leak.includes('x4fk_741de45f46e28d16') && leak.includes('[redacted-key]'), leak);
    ok('bearer tokens are redacted', !leak.includes('abc.def-123'), leak);

    // --- persistence: the no-inlining proof ------------------------------------------------
    const store = new AgentHistoryStore({ root: path.join(scratch, 'history') });
    const bigPayload = 'local M = {}\n'.repeat(24_000); // ~295 KB, the real aic_uix.lua scale
    ok('fixture really is ~295 KB', bigPayload.length > 250_000, `${bigPayload.length} bytes`);

    const blobA = store.putBlob(bigPayload);
    const rowSize = (() => {
      const row: LedgerRow = {
        id: 'row-1', ts: new Date(0).toISOString(), agent: { kind: 'agent', label: 'claude' },
        kind: 'edit', title: 'Edited `ui/addons/ai_influence_chat/aic_uix.lua` — +24000 / −0 lines',
        files: ['ui/addons/ai_influence_chat/aic_uix.lua'], outcome: { status: 'ok' },
        durationMs: 12, lines: { added: 24_000, removed: 0 }, afterBlob: blobA, revertible: true,
      };
      store.append(row);
      return encodeRow(row).length;
    })();
    ok('a 295 KB write produces a small row', rowSize < 1024, `${rowSize} bytes`);
    ok('the row carries a reference, not the payload', rowSize < bigPayload.length / 100);

    const afterFirst = store.diskBytes();
    // Writing the SAME content again must not grow the blob store — hash dedup.
    const blobB = store.putBlob(bigPayload);
    ok('identical payloads deduplicate by hash', blobA === blobB, `${blobA} vs ${blobB}`);
    const afterSecond = store.diskBytes();
    ok('re-writing identical content does not grow the store', afterSecond === afterFirst, `${afterFirst} -> ${afterSecond}`);
    const unchangedDiff = unifiedDiff(bigPayload, bigPayload, 'big_probe.lua');
    ok('identical large content produces only a bounded diff header', Buffer.byteLength(unchangedDiff, 'utf8') < 128,
      `${Buffer.byteLength(unchangedDiff, 'utf8')} bytes`);

    // --- durability + no secrets on disk ----------------------------------------------------
    const reopened = new AgentHistoryStore({ root: path.join(scratch, 'history') });
    ok('entries survive a restart (fresh store instance)', reopened.readAll().length === 1);
    ok('stored blob round-trips', String(reopened.readBlob(blobA!)) === bigPayload);

    reopened.append({
      id: 'row-2', ts: new Date(1).toISOString(), agent: { kind: 'agent', label: 'claude' },
      kind: 'edit', title: 'Edited with x4fk_741de45f46e28d16e8ec8129099e0442 in the text',
      files: ['md/b.xml'], outcome: { status: 'ok' }, durationMs: 3, revertible: false,
    });
    const onDisk = fs.readFileSync(path.join(scratch, 'history', 'ledger.jsonl'), 'utf8');
    ok('no key material is ever written to disk', !onDisk.includes('x4fk_741de45f46e28d16e8ec8129099e0442'));
    ok('the redaction marker is present instead', onDisk.includes('[redacted-key]'));

    // --- torn lines never poison the history -------------------------------------------------
    fs.appendFileSync(path.join(scratch, 'history', 'ledger.jsonl'), '{"id":"torn","tit\n', 'utf8');
    ok('a torn final line is skipped, earlier rows survive', new AgentHistoryStore({ root: path.join(scratch, 'history') }).readAll().length === 2);

    // --- rotation ----------------------------------------------------------------------------
    const rotating = new AgentHistoryStore({ root: path.join(scratch, 'rot'), maxBytes: 2048, maxSegments: 2 });
    for (let i = 0; i < 200; i++) {
      rotating.append({
        id: `r-${i}`, ts: new Date(i).toISOString(), agent: { kind: 'studio', label: 'studio' },
        kind: 'edit', title: `Edited \`md/file-${i}.xml\` — +1 / −0 lines`, files: [`md/file-${i}.xml`],
        outcome: { status: 'ok' }, durationMs: 1, revertible: false,
      });
    }
    const segments = fs.readdirSync(path.join(scratch, 'rot')).filter(n => n.startsWith('ledger'));
    ok('rotation caps the retained segments', segments.length <= 3, segments.join(','));
    ok('rotation keeps recent history readable', rotating.readAll().some(r => r.id === 'r-199'));

    // --- filters -------------------------------------------------------------------------------
    const rows = rotating.readAll();
    ok('newest row is returned first', filterRows(rows, { limit: 1 })[0]?.id === 'r-199');
    ok('kind filter excludes other kinds', filterRows(rows, { kind: 'deploy' }).length === 0);
    ok('file filter matches on path fragment', filterRows(rows, { file: 'file-198' }).length === 1);

    // --- revertibility rules --------------------------------------------------------------------
    ok('a successful edit with a before-blob is revertible', revertibility('edit', { status: 'ok' }, true).revertible === true);
    ok('an edit with no previous content is not revertible', revertibility('edit', { status: 'ok' }, false).revertible === false);
    ok('a failed edit is not revertible', revertibility('edit', { status: 'error' }, true).revertible === false);
    const deployRule = revertibility('deploy', { status: 'ok' }, true);
    ok('deploys are explicitly non-revertible', deployRule.revertible === false);
    // The reason must not promise a backup that the deploy transaction already deleted.
    ok('deploy reason does not promise a surviving backup',
      /redeploy from a previous workspace state/i.test(deployRule.reason || '') && !/use the (existing )?backup/i.test(deployRule.reason || ''),
      deployRule.reason);

    // --- encode/decode round trip -----------------------------------------------------------------
    const sample: LedgerRow = {
      id: 'x', ts: new Date(0).toISOString(), agent: { kind: 'agent', label: 'codex' }, kind: 'validate',
      title: 'Validated 3 files — 0 errors, 0 warnings', files: ['a.xml'], outcome: { status: 'ok' },
      durationMs: 5, revertible: false,
    };
    ok('rows round-trip through JSONL', decodeRows(encodeRow(sample))[0]?.id === 'x');
  } finally {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch cleanup is best-effort */ }
  }

  return { pass: checks.every(c => c.pass), checks };
}
