import { expect, test, type Page } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { seedServerWorkspace } from './ephemeral';

async function boot(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.waitForFunction((expected: string) => (window as any).__X4_E2E__?.getWorkspace().name === expected, name);
  const health = page.getByTestId('health-card');
  await health.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
  if (await health.isVisible()) await page.getByTestId('health-card-dismiss').click();
}

async function selectedWorkspaceId(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || '');
}

async function serverWorkspace(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const response = await fetch('/api/agent/workspace');
    if (!response.ok) throw new Error(`workspace read failed: ${response.status}`);
    return (await response.json()).workspace;
  });
}

test('two Studio tabs keep duplicate-name workspaces isolated and switch by immutable id', async ({ context, page }) => {
  test.setTimeout(120_000);
  const initial = buildTemplateWorkspace('welcome');
  initial.name = 'Duplicate Workspace';
  initial.description = 'default record';
  await seedServerWorkspace(initial);

  const other = await context.newPage();
  await boot(page, initial.name);
  await boot(other, initial.name);
  const defaultId = await selectedWorkspaceId(other);
  expect(defaultId).toMatch(/^ws_[a-f0-9]{24}$/);

  await page.getByTestId('workspace-switcher').selectOption('__new');
  await page.getByTestId('dialog-input').fill(initial.name);
  await page.getByTestId('dialog-ok').click();
  await expect(page.getByTestId('toast')).toContainText('Created independent workspace');
  const independentId = await selectedWorkspaceId(page);
  expect(independentId).toMatch(/^ws_[a-f0-9]{24}$/);
  expect(independentId).not.toBe(defaultId);

  await page.evaluate(() => {
    const current = (window as any).__X4_E2E__.getWorkspace();
    (window as any).__X4_E2E__.setWorkspace({ ...current, description: 'owned by first tab' });
  });
  await expect.poll(async () => (await serverWorkspace(page)).description, { timeout: 30_000 }).toBe('owned by first tab');
  await other.evaluate(() => {
    const current = (window as any).__X4_E2E__.getWorkspace();
    (window as any).__X4_E2E__.setWorkspace({ ...current, description: 'owned by second tab' });
  });

  await expect.poll(async () => (await serverWorkspace(other)).description, { timeout: 30_000 }).toBe('owned by second tab');
  await expect.poll(async () => (await serverWorkspace(page)).description, { timeout: 30_000 }).toBe('owned by first tab');
  await expect.poll(async () => page.evaluate(() => (window as any).__X4_E2E__.getWorkspace().description)).toBe('owned by first tab');
  await expect.poll(async () => other.evaluate(() => (window as any).__X4_E2E__.getWorkspace().description)).toBe('owned by second tab');

  await other.getByTestId('workspace-switcher').focus();
  await expect(other.getByTestId('workspace-switcher').locator(`option[value="workspace:${independentId}"]`)).toHaveCount(1);
  await other.getByTestId('workspace-switcher').selectOption(`workspace:${independentId}`);
  await other.getByTestId('dialog-ok').click();
  await expect.poll(() => selectedWorkspaceId(other)).toBe(independentId);
  await expect.poll(async () => other.evaluate(() => (window as any).__X4_E2E__.getWorkspace().description)).toBe('owned by first tab');
});
