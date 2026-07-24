import { expect, test, type Page } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { seedServerWorkspace } from './ephemeral';

type WatcherResponse = Record<string, unknown>;
type E2EWindow = Window & {
  __X4_E2E__?: {
    getWorkspace: () => Record<string, unknown>;
    setWorkspace: (workspace: Record<string, unknown>) => void;
    getWorkspaceHash: () => string;
  };
};

const workspace = buildTemplateWorkspace('welcome') as unknown as Record<string, unknown>;

async function waitForApp(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('readiness-ladder')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as E2EWindow).__X4_E2E__));
  await page.waitForFunction(
    expectedName => (window as E2EWindow).__X4_E2E__?.getWorkspace().name === expectedName,
    workspace.name,
  );
}

test.beforeEach(async ({ page }) => {
  await seedServerWorkspace(workspace);
  await page.addInitScript(() => {
    localStorage.removeItem('x4_forge_experience_confirmations');
    localStorage.removeItem('x4_mod_studio_workspace');
  });
});

test('readiness ladder routes to evidence, confirms experience, and invalidates after an edit', async ({ page }) => {
  let watcher: WatcherResponse = {
    ok: true,
    status: { lastDeploy: null },
    verdict: { state: 'not_seen', detail: 'No current game evidence.', errorCount: 0 },
    sinceDeploy: { hasDeploy: false, changedSinceDeploy: false, summary: 'No deploy.' },
  };
  await page.route('**/api/agent/debug-watcher/brief**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(watcher) }));
  await page.route('**/api/agent/compile', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ diagnostics: [], validation: { scope: 'full-project' } }) }));
  await waitForApp(page);

  await expect(page.getByTestId('readiness-stage-graph')).toHaveAttribute('data-status', 'pass');
  await expect(page.getByTestId('readiness-stage-package')).toHaveAttribute('data-status', 'pass');
  await expect(page.getByTestId('readiness-stage-deployed')).toHaveAttribute('data-status', 'pending');

  const workspaceHash = await page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspaceHash());
  const deployedAt = '2026-07-14T18:00:00.000Z';
  watcher = {
    ok: true,
    status: { lastDeploy: { workspaceName: workspace.name, workspaceHash, deployedAt, deployedPath: 'G:/X4/extensions/x4_welcome_message' } },
    verdict: { state: 'loaded_clean', detail: 'The mod is loaded and running with zero attributed errors.', errorCount: 0 },
    sinceDeploy: { hasDeploy: true, changedSinceDeploy: true, summary: 'Fresh since deploy.', deployedAt, logUpdatedAt: '2026-07-14T18:01:00.000Z' },
  };
  // The App's existing watcher poll picks up the new evidence without a page reload;
  // this matches a real deploy and avoids a second fixture-normalization boot.
  await expect(page.getByTestId('readiness-stage-deployed')).toHaveAttribute('data-status', 'pass');
  await expect(page.getByTestId('readiness-stage-seen')).toHaveAttribute('data-status', 'pass');
  await expect(page.getByTestId('readiness-stage-experience')).toHaveAttribute('data-status', 'pending');

  await page.getByTestId('readiness-stage-package').click();
  await expect(page.getByTestId('diagnostics-scope-package')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('readiness-evidence')).toContainText('Project valid');

  await page.getByTestId('readiness-stage-seen').click();
  await expect(page.getByText('Playtest Workspace', { exact: true })).toBeVisible();

  await page.getByTestId('readiness-stage-experience').click();
  await page.getByTestId('readiness-confirm-experience').click();
  await expect(page.getByTestId('readiness-stage-experience')).toHaveAttribute('data-status', 'pass');

  await page.evaluate(() => {
    const bridge = (window as E2EWindow).__X4_E2E__!;
    bridge.setWorkspace({ ...bridge.getWorkspace(), description: 'Edited after deployment' });
  });
  await expect(page.getByTestId('readiness-stage-deployed')).toHaveAttribute('data-status', 'stale');
  await expect(page.getByTestId('readiness-stage-seen')).toHaveAttribute('data-status', 'stale');
  await expect(page.getByTestId('readiness-stage-experience')).toHaveAttribute('data-status', 'stale');
});

test('compiler and watcher outages never render false-green readiness', async ({ page }) => {
  await page.route('**/api/agent/debug-watcher/brief**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'watcher offline' }) }));
  await page.route('**/api/agent/compile', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'compiler offline' }) }));
  await waitForApp(page);

  await expect(page.getByTestId('readiness-stage-package')).toHaveAttribute('data-status', 'unavailable');
  await expect(page.getByTestId('readiness-stage-deployed')).toHaveAttribute('data-status', 'unavailable');
  await expect(page.getByTestId('readiness-stage-seen')).toHaveAttribute('data-status', 'unavailable');
  await expect(page.locator('[data-testid^="readiness-stage-"][data-status="pass"]')).toHaveCount(1);
});
