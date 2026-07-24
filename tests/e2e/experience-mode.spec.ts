import { expect, test, type Page } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { seedServerWorkspace } from './ephemeral';

type E2EWindow = Window & {
  __X4_E2E__?: {
    getWorkspace: () => { name: string; nodes: Array<{ id: string; label: string }> };
    getWorkspaceHash: () => string;
  };
};

const workspace = buildTemplateWorkspace('welcome');

async function bootBeginner(page: Page, corruptPreference = false) {
  await seedServerWorkspace(workspace);
  await page.addInitScript((corrupt: boolean) => {
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.removeItem('x4_mod_studio_version');
    if (corrupt) localStorage.setItem('x4_forge_experience_mode', 'not-a-mode');
    else localStorage.removeItem('x4_forge_experience_mode');
  }, corruptPreference);
  await page.route('**/api/agent/compile', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ diagnostics: [], validation: { scope: 'full-project' } }) }));
  await page.route('**/api/agent/debug-watcher/brief**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: { lastDeploy: null }, verdict: { state: 'not_seen', detail: 'No current game evidence.', errorCount: 0 }, sinceDeploy: { hasDeploy: false, changedSinceDeploy: false, summary: 'No deploy.' } }) }));
  await page.goto('/');
  await expect(page.getByTestId('beginner-workspace')).toBeVisible();
  await page.waitForFunction((name: string) => (window as E2EWindow).__X4_E2E__?.getWorkspace().name === name, workspace.name);
  const healthCard = page.getByTestId('health-card');
  await healthCard.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
  if (await healthCard.isVisible()) await page.getByTestId('health-card-dismiss').click();
}

test('Beginner exposes five tasks, preserves workspace and selection, and Expert restores the full studio', async ({ page }) => {
  await bootBeginner(page);

  await expect(page.locator('[data-testid^="beginner-step-"]')).toHaveCount(5);
  await expect(page.locator('#view_selection_modes')).toHaveCount(0);
  await expect(page.locator('#side_panel')).toHaveCount(0);
  await expect(page.locator('#antigravity_ide_container')).toHaveCount(0);
  await expect(page.getByTitle('Load existing mods or push updates to GitHub')).toHaveCount(0);
  await expect(page.getByTitle('Open External AI Agent API Control panel and documentation')).toHaveCount(0);
  await expect(page.getByTestId('mode-beginner')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('readiness-stage-package').click();
  await expect(page.getByTestId('beginner-panel-validate')).toBeVisible();
  await page.getByTestId('readiness-stage-deployed').click();
  await expect(page.getByTestId('beginner-panel-deploy')).toBeVisible();
  await page.getByTestId('readiness-stage-seen').click();
  await expect(page.getByTestId('beginner-panel-confirm')).toBeVisible();

  const initialHash = await page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspaceHash());
  const firstNodeId = await page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspace().nodes[0].id);
  await page.getByTestId(`canvas-node-${firstNodeId}`).click();
  await page.getByTestId('beginner-step-customize').click();
  await expect(page.getByText('PROPERTIES INSPECTOR', { exact: true })).toBeVisible();
  await expect(page.getByText('AI Copilot Cue Editor', { exact: true })).toHaveCount(0);

  await page.getByTestId('mode-expert').click();
  await expect(page.locator('#view_selection_modes')).toBeVisible();
  await expect(page.locator('#side_panel')).toBeVisible();
  // B48P2: the code pane starts COLLAPSED by default (canvas real estate) — Expert still owns
  // the editor, it just opens via the pull-tab. Expand, then assert the editor container.
  await page.getByTitle('Show code editor').click();
  await expect(page.locator('#antigravity_ide_container')).toBeVisible();
  expect(await page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspaceHash())).toBe(initialHash);

  await page.getByTestId('mode-beginner').click();
  await expect(page.getByText('PROPERTIES INSPECTOR', { exact: true })).toBeVisible();
  await expect(page.locator('#antigravity_ide_container')).toHaveCount(0);
  expect(await page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspaceHash())).toBe(initialHash);
});

test('corrupt preference falls back safely and blocking evidence cannot become green', async ({ page }) => {
  await seedServerWorkspace(workspace);
  await page.addInitScript(() => {
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.setItem('x4_forge_experience_mode', 'broken');
  });
  await page.route('**/api/agent/compile', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ diagnostics: [{ severity: 'error', category: 'syntax', code: 'test.blocker', domain: 'md', filePath: 'md/test.xml', message: 'Blocking package error' }], validation: { scope: 'full-project' } }) }));
  await page.route('**/api/agent/debug-watcher/brief**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'watcher offline' }) }));
  await page.goto('/');
  await expect(page.getByTestId('beginner-workspace')).toBeVisible();
  await page.waitForFunction((name: string) => (window as E2EWindow).__X4_E2E__?.getWorkspace().name === name, workspace.name);

  await page.getByTestId('beginner-step-validate').click();
  await expect(page.getByTestId('beginner-evidence-package')).toHaveAttribute('data-status', 'fail');
  await page.getByTestId('beginner-step-deploy').click();
  await expect(page.getByTestId('beginner-deploy-blocker')).toBeVisible();
  await expect(page.getByTestId('beginner-open-deploy')).toBeDisabled();
  await page.getByTestId('beginner-step-confirm').click();
  await expect(page.getByTestId('beginner-evidence-seen')).toHaveAttribute('data-status', 'unavailable');
  await expect(page.getByTestId('beginner-confirm-experience')).toHaveCount(0);
});

test('Beginner deploy action opens the existing guarded wizard without deploying', async ({ page }) => {
  let deployCalls = 0;
  await page.route('**/api/schema/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ config: { modWorkspacePath: 'F:/scratch/x4-forge-e2e', x4GamePath: 'G:/X4' }, resolved: { mdExists: true }, loaded: true }) }));
  await page.route('**/api/agent/deploy-verify', route => { deployCalls += 1; return route.fulfill({ status: 500, body: '{}' }); });
  await bootBeginner(page);

  await page.getByTestId('beginner-step-deploy').click();
  await page.getByTestId('beginner-open-deploy').click();
  await expect(page.getByText('Compile & Deploy Wizard', { exact: true })).toBeVisible();
  expect(deployCalls).toBe(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(deployCalls).toBe(0);
});
