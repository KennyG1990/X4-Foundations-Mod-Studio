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
  filterRows, revertibility, ledgerRouteKind, LedgerRow,
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
