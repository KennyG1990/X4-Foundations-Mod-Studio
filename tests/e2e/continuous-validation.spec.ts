import { expect, test } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { seedServerWorkspace } from './ephemeral';
import { E2E_TOKEN } from '../../playwright.config';

const workspace = buildTemplateWorkspace('welcome');

test('native authoring uses the same project validator that feeds Antigravity diagnostics', async ({ page, request }) => {
  await seedServerWorkspace(workspace);
  await page.goto('/');
  await page.waitForFunction((name: string) => {
    const api = (window as Window & { __X4_E2E__?: { getWorkspace: () => { name?: string } } }).__X4_E2E__;
    return api?.getWorkspace().name === name;
  }, workspace.name);
  const healthCard = page.getByTestId('health-card');
  await healthCard.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
  if (await healthCard.isVisible()) await page.getByTestId('health-card-dismiss').click();
  await expect(page.getByTestId('native-project-files')).toBeVisible();
  await expect(page.locator('.cm-content')).toHaveCount(0);

  const validate = async (content: string) => {
    const response = await request.post('http://127.0.0.1:3101/api/agent/project/validate', {
      headers: { Authorization: `Bearer ${E2E_TOKEN}` },
      data: { project: { id: 'native-validation', name: 'native-validation', files: [{ path: 'md/continuous.xml', kind: 'md', content }] } },
    });
    expect(response.ok()).toBeTruthy();
    return response.json() as Promise<{ flat?: Array<{ severity: string; code: string; message: string }> }>;
  };

  const invalid = await validate('<mdscript name="Continuous"><cues><cue name="Root"><conditions><totally_illegal/></conditions></cue></cues></mdscript>');
  expect(invalid.flat?.some(finding => finding.severity === 'error' && /illegal|xsd/i.test(`${finding.code} ${finding.message}`))).toBeTruthy();

  const unknown = await validate('<mdscript name="Continuous"><cues><cue name="Root"><actions><set_value name="$x" exact="$ship.knownnmae"/></actions></cue></cues></mdscript>');
  expect(unknown.flat?.some(finding => finding.severity === 'warning' && /knownnmae|property/i.test(`${finding.code} ${finding.message}`))).toBeTruthy();
});
