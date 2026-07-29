import { expect, test } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { readServerWorkspace, seedServerWorkspace } from './ephemeral';

const baseXml = `<?xml version="1.0" encoding="utf-8"?>
<wares>
  <ware id="energycells" volume="1" />
</wares>`;

const editedXml = `<?xml version="1.0" encoding="utf-8"?>
<wares>
  <ware id="energycells" volume="2" />
</wares>`;

test('diff-to-patch three-pane merge synthesizes and adopts a patch block', async ({ page }) => {
  const workspace = { ...buildTemplateWorkspace('welcome'), xmlPatches: [] };
  await seedServerWorkspace(workspace);
  await page.addInitScript(() => {
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.removeItem('x4_mod_studio_version');
  });

  let synthPayload: { vanillaXml?: string; editedXml?: string; targetFile?: string } | null = null;

  await page.route('**/api/reference/effective-file**', async (route) => {
    await route.fulfill({
      json: {
        available: true,
        relativePath: 'libraries/wares.xml',
        signature: 'e2e-effective-wares',
        sources: [{ source: 'base', path: 'libraries/wares.xml', mode: 'base' }],
        findings: [],
        content: baseXml,
      },
    });
  });

  await page.route('**/api/agent/xpath-synth', async (route) => {
    synthPayload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        success: true,
        targetFile: 'libraries/wares.xml',
        ops: [
          {
            type: 'replace',
            sel: "/wares/ware[@id='energycells']/@volume",
            content: '2',
          },
        ],
        diffXml: `<?xml version="1.0" encoding="utf-8"?>\n<diff>\n  <replace sel="/wares/ware[@id='energycells']/@volume">2</replace>\n</diff>`,
        warnings: [],
      },
    });
  });

  await page.goto('/');
  await page.waitForFunction((name: string) => {
    const api = (window as Window & { __X4_E2E__?: { getWorkspace: () => { name?: string } } }).__X4_E2E__;
    return api?.getWorkspace().name === name;
  }, workspace.name);
  await page.getByRole('button', { name: 'XML Patching' }).click();
  await page.getByRole('button', { name: 'Diff→Patch', exact: true }).click();

  const workbench = page.locator('main');
  await expect(workbench.getByText('Three-pane merge:', { exact: false })).toBeVisible();
  await expect(workbench.getByText('Base XML')).toBeVisible();
  await expect(workbench.getByText('Edited XML')).toBeVisible();
  await expect(workbench.locator('span').filter({ hasText: 'Patch XML' })).toBeVisible();

  // Target the Edited XML pane directly (the three panes are already asserted by their labels
  // above). The prior `page.locator('textarea')` global count coupled this test to unrelated
  // editors elsewhere on the page — native authoring removed the old embedded editor, which
  // legitimately changed that count. A stable testid keeps the test on the actual pane.
  const editedPane = page.getByTestId('diff-patch-edited-xml');
  await expect(editedPane).toBeVisible();
  await editedPane.fill(editedXml);
  await page.getByRole('button', { name: 'Synthesize Patch' }).click();

  await expect(workbench.getByText('1 op(s)')).toBeVisible();
  await expect(workbench.getByText("/wares/ware[@id='energycells']/@volume")).toBeVisible();
  expect(synthPayload).toMatchObject({
    targetFile: 'libraries/wares.xml',
    vanillaXml: baseXml,
    editedXml,
  });

  const saveResponsePromise = page.waitForResponse(response =>
    response.url().endsWith('/api/agent/workspace')
      && response.request().method() === 'POST'
      && response.status() === 200,
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Add to Workspace' }).click();
  await expect(workbench.locator('span').filter({ hasText: 'Diff→Patch synthesized' })).toBeVisible();
  await expect(workbench.getByText("/wares/ware[@id='energycells']/@volume")).toBeVisible();
  const saveResponse = await saveResponsePromise;
  const saveBody = await saveResponse.json();
  const hasPatch = (candidate: { xmlPatches?: Array<{ note?: string; sel?: string }> }) =>
    candidate.xmlPatches?.some(patch => patch.note === 'Diff→Patch synthesized'
      && patch.sel === "/wares/ware[@id='energycells']/@volume") === true;
  expect(hasPatch(saveBody.workspace)).toBe(true);
  const saved = await readServerWorkspace();
  expect(hasPatch(saved)).toBe(true);
});
