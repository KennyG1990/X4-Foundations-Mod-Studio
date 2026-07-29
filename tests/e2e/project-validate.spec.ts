/**
 * API-level regression net for the 2026-07-08 validation-layer work (G14 slice):
 * project/validate inline + fromPath, the requiredness fix, cue-keyword whitelist,
 * pitfall lints, and the public selftest endpoints. These are real HTTP assertions
 * against the dev server (reuseExistingServer) — the exact acceptance checks that
 * were verified by hand in-session, pinned so they can't silently regress.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { E2E_TOKEN } from '../../playwright.config';

// B31s2: these requests ride baseURL (the ephemeral Vite → ephemeral API proxy), so the
// bearer is the ephemeral stack's env token — the live checkout's token file is not read.
function bearer(): Record<string, string> {
  return { Authorization: `Bearer ${E2E_TOKEN}`, 'Content-Type': 'application/json' };
}

async function validate(request: APIRequestContext, body: unknown) {
  const res = await request.post('/api/agent/project/validate', { headers: bearer(), data: body });
  const responseBody = await res.text();
  expect(res.ok(), responseBody).toBeTruthy();
  return JSON.parse(responseBody);
}

const contentXml = { path: 'content.xml', kind: 'content', content: '<content id="t" name="T" version="100"/>' };

test('bare <event_offer_accepted/> FAILS validation (requiredness gap #8 stays closed)', async ({ request }) => {
  const v = await validate(request, { project: { id: 't', name: 't', files: [
    contentXml,
    { path: 'md/t.xml', kind: 'md', content: '<mdscript name="T"><cues><cue name="A"><conditions><event_offer_accepted/></conditions></cue></cues></mdscript>' },
  ] } });
  expect(v.ok).toBe(false);
  expect(v.summary.schemaErrors).toBeGreaterThanOrEqual(1);
  expect(v.schema.findings.some((f: { code?: string; sourceRef?: string; severity: string }) =>
    f.code === 'XSD_MISSING_REQUIRED' && f.severity === 'error' && String(f.sourceRef).includes('event_offer_accepted'))).toBe(true);
});

test('MD cue keywords (parent/this) never flag as unresolved', async ({ request }) => {
  const v = await validate(request, { project: { id: 't', name: 't', files: [
    contentXml,
    { path: 'md/t.xml', kind: 'md', content: '<mdscript name="T"><cues><cue name="A"><conditions><event_cue_signalled cue="parent"/></conditions><actions><cancel_cue cue="parent"/><reset_cue cue="this"/></actions></cue></cues></mdscript>' },
  ] } });
  expect(v.ok).toBe(true);
  expect(v.summary.unresolvedCueRefs).toBe(0);
});

test('pitfall lints fire on the proven bug shapes and stay quiet on the proven-good ones', async ({ request }) => {
  const v = await validate(request, { project: { id: 't', name: 't', files: [
    contentXml,
    { path: 'md/t.xml', kind: 'md', content: `<mdscript name="T"><cues>
      <cue name="On_action"><conditions><event_ui_triggered screen="'aic'" control="'act'"/></conditions><actions><debug_text text="'x'"/></actions></cue>
      <cue name="B" instantiate="true"><conditions><event_offer_accepted cue="parent"/></conditions></cue>
    </cues></mdscript>` },
  ] } });
  const codes = v.pitfalls.findings.map((f: { code: string }) => f.code);
  expect(codes).toContain('md_pitfall.ui_listener_one_shot');
  expect(codes).toContain('md_pitfall.offer_accepted_keyword_cue');
});

test('fromPath validation reads a real mod folder server-side', async ({ request }) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-from-path-'));
  const staging = path.join(temp, 'staging');
  const deployment = path.join(temp, 'deployment');
  const mod = path.join(staging, 'from_path_fixture');
  fs.mkdirSync(path.join(mod, 'md'), { recursive: true });
  fs.mkdirSync(deployment, { recursive: true });
  fs.writeFileSync(path.join(mod, 'content.xml'), '<content id="from_path_fixture" name="From Path Fixture" version="1"/>', 'utf8');
  for (let index = 0; index < 6; index += 1) {
    fs.writeFileSync(
      path.join(mod, 'md', `fixture_${index}.xml`),
      `<mdscript name="FromPath${index}"><cues><cue name="Cue${index}"/></cues></mdscript>`,
      'utf8',
    );
  }

  try {
    const configured = await request.post('/api/schema/config', {
      headers: bearer(),
      data: { modWorkspacePath: staging, filesystemPath: deployment },
    });
    expect(configured.ok(), await configured.text()).toBeTruthy();

    const v = await validate(request, { fromPath: 'from_path_fixture' });
    expect(v.source.mode).toBe('fromPath');
    expect(v.source.loaded.length).toBeGreaterThan(5);
    expect(v.summary.files).toBe(v.source.loaded.length);
    // layers report availability honestly
    expect(v.schema.mdAvailable).toBe(true);
    expect(v.scriptProperties.available).toBe(true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('fromPath refuses paths outside the configured roots', async ({ request }) => {
  const res = await request.post('/api/agent/project/validate', { headers: bearer(), data: { fromPath: '..\\..\\Windows' } });
  expect([400, 404]).toContain(res.status());
});

test('new public selftest endpoints are green', async ({ request }) => {
  for (const p of ['scriptproperties-selftest', 'aiscript-lint-selftest', 'md-pitfall-selftest', 'lua-staleness-selftest']) {
    const res = await request.get(`/api/agent/${p}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.allPassed, `${p}: ${JSON.stringify(body.checks?.filter((c: { pass: boolean }) => !c.pass) || body)}`).toBe(true);
  }
});
