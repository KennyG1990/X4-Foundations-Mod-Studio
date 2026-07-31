import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { E2E_TOKEN } from '../../playwright.config';
import { seedServerWorkspace } from './ephemeral';

const API = 'http://127.0.0.1:3101';
const auth = { Authorization: `Bearer ${E2E_TOKEN}`, 'Content-Type': 'application/json' };

test('reviewed exact suppression creates rules, rejects stale/error paths, and removes only the warning', async ({ request }) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-r6-suppression-'));
  const staging = path.join(temp, 'staging');
  const deployment = path.join(temp, 'deployment');
  const source = path.join(staging, 'r6_fixture');
  fs.mkdirSync(path.join(source, 'md'), { recursive: true });
  fs.mkdirSync(deployment, { recursive: true });
  fs.writeFileSync(path.join(source, 'content.xml'), '<content id="r6_fixture" name="R6 Fixture" version="100"/>', 'utf8');
  fs.writeFileSync(
    path.join(source, 'md', 'legacy.xml'),
    '<mdscript name="Legacy"><cues><cue name="Legacy"><actions><get_highest_resource_yield result="$y" sector="$s" ware="$w"/></actions></cue></cues></mdscript>',
    'utf8',
  );

  const originalResponse = await request.get(`${API}/api/schema/config`, { headers: auth });
  expect(originalResponse.ok(), await originalResponse.text()).toBeTruthy();
  const original = await originalResponse.json() as { config?: Record<string, unknown> };
  const restore = {
    modWorkspacePath: original.config?.modWorkspacePath || '',
    filesystemPath: original.config?.filesystemPath || '',
  };
  const workspace = {
    ...buildTemplateWorkspace('welcome'),
    id: 'r6_fixture',
    name: 'R6 Fixture',
    contentId: 'r6_fixture',
    sourceStamp: { dir: source, hash: 'fixture-baseline', at: new Date().toISOString() },
  };
  const rulesPath = path.join(source, 'forge.rules.json');

  try {
    const configured = await request.post(`${API}/api/schema/config`, { headers: auth, data: { modWorkspacePath: staging, filesystemPath: deployment } });
    expect(configured.ok(), await configured.text()).toBeTruthy();

    const compiledResponse = await request.post(`${API}/api/agent/compile`, { headers: auth, data: { workspace } });
    expect(compiledResponse.ok(), await compiledResponse.text()).toBeTruthy();
    const compiled = await compiledResponse.json() as {
      diagnostics: Array<{ severity: string; code: string; filePath: string; sourceRef?: { label?: string }; suppressionScope?: { code: string; file?: string; sourceRef?: string } }>;
    };
    const warning = compiled.diagnostics.find(item => item.code === 'migration.deprecated_element');
    expect(warning).toMatchObject({ severity: 'warning', filePath: 'md/legacy.xml' });
    expect(warning?.suppressionScope).toMatchObject({ code: 'migration.deprecated_element', file: 'md/legacy.xml' });

    const explainResponse = await request.post(`${API}/api/agent/explain`, {
      headers: auth,
      data: { diagnostic: { severity: 'warning', code: warning!.code, filePath: warning!.filePath, message: 'fixture' } },
    });
    expect(explainResponse.ok(), await explainResponse.text()).toBeTruthy();
    expect(await explainResponse.json()).toMatchObject({ success: true, mode: 'diagnostic', explanation: { deterministic: true, code: warning!.code } });

    const prepareResponse = await request.post(`${API}/api/agent/project-rules/prepare-suppression`, {
      headers: auth, data: { workspace, scope: warning!.suppressionScope },
    });
    expect(prepareResponse.ok(), await prepareResponse.text()).toBeTruthy();
    const prepared = await prepareResponse.json() as { expectedSha256: string | null; defaults: Record<string, string>; target: string };
    expect(prepared.expectedSha256).toBeNull();
    expect(prepared.target).toBe('r6_fixture/forge.rules.json');

    const externalBytes = `${JSON.stringify({ version: 1, suppressions: [], contracts: { knownChains: [], wireKeys: [], expectedRegisters: [] } }, null, 2)}\n`;
    fs.writeFileSync(rulesPath, externalBytes, 'utf8');
    const staleResponse = await request.post(`${API}/api/agent/project-rules/suppress`, {
      headers: auth,
      data: { workspace, scope: warning!.suppressionScope, expectedSha256: prepared.expectedSha256, review: { ...prepared.defaults, owner: 'Fixture Maintainer' } },
    });
    expect(staleResponse.status()).toBe(409);
    expect(await staleResponse.json()).toMatchObject({ code: 'RULES_FILE_CHANGED' });
    expect(fs.readFileSync(rulesPath, 'utf8')).toBe(externalBytes);

    const errorFinding = compiled.diagnostics.find(item => item.severity === 'error');
    expect(errorFinding).toBeTruthy();
    const beforeErrorAttempt = fs.readFileSync(rulesPath, 'utf8');
    const errorResponse = await request.post(`${API}/api/agent/project-rules/prepare-suppression`, {
      headers: auth,
      data: { workspace, scope: { code: errorFinding!.code, file: errorFinding!.filePath, ...(errorFinding!.sourceRef?.label ? { sourceRef: errorFinding!.sourceRef.label } : {}) } },
    });
    expect(errorResponse.status()).toBe(409);
    expect(await errorResponse.json()).toMatchObject({ code: 'DIAGNOSTIC_NOT_SUPPRESSIBLE' });
    expect(fs.readFileSync(rulesPath, 'utf8')).toBe(beforeErrorAttempt);

    const freshPrepareResponse = await request.post(`${API}/api/agent/project-rules/prepare-suppression`, {
      headers: auth, data: { workspace, scope: warning!.suppressionScope },
    });
    expect(freshPrepareResponse.ok(), await freshPrepareResponse.text()).toBeTruthy();
    const fresh = await freshPrepareResponse.json() as { expectedSha256: string; defaults: Record<string, string> };
    const commitResponse = await request.post(`${API}/api/agent/project-rules/suppress`, {
      headers: auth,
      data: { workspace, scope: warning!.suppressionScope, expectedSha256: fresh.expectedSha256, review: { ...fresh.defaults, owner: 'Fixture Maintainer' } },
    });
    expect(commitResponse.ok(), await commitResponse.text()).toBeTruthy();
    expect(await commitResponse.json()).toMatchObject({ success: true, status: 'VERIFIED', rule: { code: warning!.code, file: warning!.filePath } });
    expect(JSON.parse(fs.readFileSync(rulesPath, 'utf8')).suppressions).toHaveLength(1);

    const afterResponse = await request.post(`${API}/api/agent/compile`, { headers: auth, data: { workspace } });
    expect(afterResponse.ok(), await afterResponse.text()).toBeTruthy();
    const after = await afterResponse.json() as { diagnostics: Array<{ code: string }> };
    expect(after.diagnostics.some(item => item.code === 'migration.deprecated_element')).toBe(false);
  } finally {
    const restored = await request.post(`${API}/api/schema/config`, { headers: auth, data: restore });
    expect(restored.ok(), await restored.text()).toBeTruthy();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

async function waitForApp(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('readiness-ladder')).toBeVisible();
}

test('Diagnostics Center renders deterministic Why guidance and the reviewed suppression dialog', async ({ page }) => {
  const workspace = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(workspace as unknown as Record<string, unknown>);
  await page.route('**/api/agent/compile', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      diagnostics: [{
        severity: 'warning', category: 'references', domain: 'md', code: 'scriptproperty.unknown',
        filePath: 'md/example.xml', message: 'Unknown property segment cargo.',
        sourceRef: { kind: 'project', label: '$ship.cargo.unknown' },
        suppressionScope: { code: 'scriptproperty.unknown', file: 'md/example.xml', sourceRef: '$ship.cargo.unknown' },
      }],
      validation: { scope: 'full-project', ok: true },
      validationDelta: {
        status: 'compared', modId: 'x4_welcome_message', currentContentHash: 'b'.repeat(64),
        baseline: { status: 'available', contentHash: 'a'.repeat(64), recordedAt: '2026-07-30T12:00:00.000Z' },
        counts: { current: 3, baseline: 2, new: 2, resolved: 1, unchanged: 1 },
        newWarnings: [], resolvedWarnings: [],
      },
    }),
  }));
  await page.route('**/api/agent/project-rules/prepare-suppression', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true, target: 'example/forge.rules.json', expectedSha256: null, existingSuppressions: 0,
      scope: { code: 'scriptproperty.unknown', file: 'md/example.xml', sourceRef: '$ship.cargo.unknown' },
      defaults: { id: 'suppress-scriptproperty-unknown', owner: '', reason: 'Reviewed exact fixture warning.', reviewBy: '2026-10-28' },
    }),
  }));
  await waitForApp(page);

  await page.getByTestId('readiness-stage-package').click();
  await expect(page.getByTestId('diagnostics-scope-package')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('validation-delta-card')).toContainText('2 new · 1 resolved · 1 unchanged');
  await expect(page.getByTestId('validation-delta-card')).toContainText('Since last green');
  const why = page.getByTestId('diagnostic-why-scriptproperty.unknown');
  await expect(why).toBeVisible();
  await why.scrollIntoViewIfNeeded();
  const geometry = await why.evaluate(element => {
    const footer = [...document.querySelectorAll('div')].find(candidate => candidate.textContent?.trim() === 'Engine Context: Egosoft MD 4.5');
    const button = element.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const ancestors: Array<Record<string, unknown>> = [];
    let cursor: HTMLElement | null = element.parentElement;
    while (cursor && ancestors.length < 8) {
      const rect = cursor.getBoundingClientRect();
      const style = getComputedStyle(cursor);
      ancestors.push({ className: cursor.className, top: rect.top, bottom: rect.bottom, height: rect.height, clientHeight: cursor.clientHeight, scrollHeight: cursor.scrollHeight, overflowY: style.overflowY });
      cursor = cursor.parentElement;
    }
    return { button: { top: button.top, bottom: button.bottom }, footer: footerRect ? { top: footerRect.top, bottom: footerRect.bottom } : null, ancestors };
  });
  expect(geometry.footer, JSON.stringify(geometry)).not.toBeNull();
  expect(geometry.button.bottom, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.footer!.top);
  await why.click();
  await expect(page.getByTestId('diagnostic-why-panel')).toContainText('Unknown X4 script properties commonly evaluate to null');
  await expect(page.getByTestId('diagnostic-why-panel')).toContainText('deterministic, no AI');

  await page.getByTestId('diagnostic-suppress-scriptproperty.unknown').click();
  await expect(page.getByTestId('suppression-review-dialog')).toBeVisible();
  await expect(page.getByTestId('suppression-review-dialog')).toContainText('This acknowledges one warning; it does not fix source code.');
  await expect(page.getByTestId('suppression-owner')).toHaveValue('');
  await expect(page.getByTestId('suppression-confirm')).toBeVisible();
});
