import { expect, test } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { seedServerWorkspace } from './ephemeral';

test('startup and LIVE diagnostics expose only generic optional-runtime copy', async ({ page }) => {
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  await page.addInitScript(() => {
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.removeItem('x4_mod_studio_version');
    localStorage.setItem('x4_forge_experience_mode', 'expert');
  });
  await page.route('**/api/agent/health-card', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      verdict: 'attention',
      summary: '1 item worth a look — nothing blocking.',
      rows: [
        { id: 'bridge', label: 'Optional runtime integration', status: 'unknown', detail: 'Not running — core Forge authoring and validation are unaffected. (Optional runtime is unavailable.)' },
        { id: 'debuglog', label: 'X4 debug log', status: 'warn', detail: 'No debuglog found.' },
      ],
    }),
  }));
  await page.route('**/api/agent/live/cue-telemetry', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      available: false,
      live: false,
      cues: [],
      watches: [],
      bridge: { bridgeUp: false, gameActive: false, summary: 'Optional runtime is unavailable (no /health response).' },
    }),
  }));

  await page.goto('/');

  const card = page.getByTestId('health-card');
  await expect(card).toBeVisible();
  await expect(card.getByText('Optional runtime integration', { exact: true })).toBeVisible();
  await expect(card).toContainText('core Forge authoring and validation are unaffected');
  await expect(card).not.toContainText(/neural[ _-]?link|x4_neural_link|x4_ai_influence/i);
  await page.screenshot({ path: 'vscode-extension/evidence/0.0.35-runtime-copy-startup.png', fullPage: true });
  await page.getByTestId('health-card-dismiss').click();

  const live = page.getByTestId('canvas-live-toggle');
  await live.click();
  await expect(live).toHaveAttribute('title', /Optional runtime is unavailable/);
  const title = await live.getAttribute('title');
  expect(title).not.toMatch(/neural[ _-]?link|x4_neural_link|x4_ai_influence/i);
  await live.hover();
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: 'vscode-extension/evidence/0.0.35-runtime-copy-live.png', fullPage: true });
});
