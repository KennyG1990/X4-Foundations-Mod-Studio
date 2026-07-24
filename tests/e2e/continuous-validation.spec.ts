import { expect, test, type Page } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { seedServerWorkspace } from './ephemeral';

const workspace = buildTemplateWorkspace('welcome');

async function replaceEditorText(page: Page, text: string) {
  const editor = page.locator('.cm-content').first();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
}

test('Forge code editor continuously renders red errors and amber warnings without a validate action', async ({ page }) => {
  await seedServerWorkspace(workspace);
  await page.route('**/api/agent/compile', async route => {
    const body = route.request().postDataJSON() as { fileOverrides?: Record<string, string> };
    const entry = Object.entries(body.fileOverrides || {})[0];
    const content = entry?.[1] || '';
    const filePath = entry?.[0] || 'md/continuous.xml';
    const diagnostics = content.includes('totally_illegal')
      ? [{ severity: 'error', category: 'syntax', code: 'XSD_ILLEGAL_CHILD', domain: 'md', filePath, line: 5, message: '<totally_illegal> is not legal under <conditions> per md.xsd + common.xsd.' }]
      : content.includes('knownnmae')
        ? [{ severity: 'warning', category: 'references', code: 'scriptproperty.unknown', domain: 'md', filePath, line: 5, message: 'Unknown property "knownnmae". Did you mean knownname?' }]
        : [];
    await route.fulfill({ json: { diagnostics, validation: { scope: 'full-project' } } });
  });

  await page.goto('/');
  const healthCard = page.getByTestId('health-card');
  await healthCard.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
  if (await healthCard.isVisible()) await page.getByTestId('health-card-dismiss').click();
  await page.getByTitle('Show code editor').click();
  await expect(page.locator('.cm-content').first()).toBeVisible();

  await replaceEditorText(page, [
    '<mdscript name="Continuous">',
    '  <cues>',
    '    <cue name="Root">',
    '      <conditions>',
    '        <totally_illegal/>',
    '      </conditions>',
    '    </cue>',
    '  </cues>',
    '</mdscript>',
  ].join('\n'));
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(1, { timeout: 5_000 });
  await expect(page.getByTestId('package-status-badge')).toContainText('VALIDATION: ERRORS');
  await page.locator('.cm-lintRange-error').hover();
  await expect(page.locator('.cm-tooltip-lint')).toContainText('totally_illegal');

  await replaceEditorText(page, [
    '<mdscript name="Continuous">',
    '  <cues>',
    '    <cue name="Root">',
    '      <actions>',
    '        <set_value name="$x" exact="$ship.knownnmae"/>',
    '      </actions>',
    '    </cue>',
    '  </cues>',
    '</mdscript>',
  ].join('\n'));
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('.cm-lintRange-warning')).toHaveCount(1);
  await expect(page.getByTestId('package-status-badge')).toContainText('VALIDATION: WARN');
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
});
