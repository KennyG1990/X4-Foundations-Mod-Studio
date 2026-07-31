import { expect, test, type Page } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { E2E_TOKEN } from '../../playwright.config';
import { readServerWorkspace, seedServerWorkspace } from './ephemeral';

type ConflictE2EWindow = Window & {
  __X4_E2E__?: {
    getWorkspace: () => { name: string };
    setWorkspace: (workspace: any) => void;
  };
};

async function boot(page: Page, name: string) {
  const initial = buildTemplateWorkspace('welcome');
  initial.name = name;
  await seedServerWorkspace(initial);
  await page.goto('/');
  await page.waitForFunction((expected: string) => (window as ConflictE2EWindow).__X4_E2E__?.getWorkspace().name === expected, name);
  const health = page.getByTestId('health-card');
  await health.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
  if (await health.isVisible()) await page.getByTestId('health-card-dismiss').click();
  return initial;
}

/**
 * Drive the UI with a deterministic 409 envelope. The real HTTP/CAS implementation is covered
 * by route-integration; this rendered-host test owns only the browser reaction. Once the dialog
 * is visible, seed the same external copy into the ephemeral server before either real choice.
 */
async function triggerConflict(page: Page, localCopy: unknown, serverCopy: unknown) {
  let conflictServed = false;
  let mockServerReads = true;
  const handler = async (route: import('@playwright/test').Route) => {
    const request = route.request();
    const isWorkspaceRoute = new URL(request.url()).pathname === '/api/agent/workspace';
    if (!isWorkspaceRoute) return route.continue();
    if (request.method() === 'GET' && mockServerReads) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workspace: serverCopy,
          version: 42,
          workspaceHash: 'e2e-server-head',
          lastUpdated: '2026-07-30T12:00:00.000Z',
          origin: 'e2e:external-writer',
        }),
      });
    }
    const body = request.postDataJSON() as { force?: boolean } | null;
    if (request.method() === 'POST' && !body?.force && !conflictServed) {
      conflictServed = true;
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'head_conflict',
          currentHead: 'e2e-server-head',
          expectedHead: 'e2e-old-head',
          currentVersion: 42,
          conflict: {
            detectedAt: '2026-07-30T12:01:00.000Z',
            server: { head: 'e2e-server-head', version: 42, savedAt: '2026-07-30T12:00:00.000Z', origin: 'e2e:external-writer', name: (serverCopy as any).name },
            local: { head: 'e2e-local-head', name: (localCopy as any).name },
            preview: {
              counts: { added: 0, removed: 0, modified: 2, unchanged: 1, changed: 2 },
              files: [{ path: 'content.xml', kind: 'modified', serverBytes: 100, localBytes: 104, lines: { added: 2, removed: 2 }, diff: '--- a/content.xml\n+++ b/content.xml\n-server copy\n+local copy' }],
              changedPaths: ['content.xml', 'README.md'],
              truncated: false,
            },
          },
        }),
      });
    }
    await route.continue();
  };
  await page.route('**/api/agent/workspace', handler);
  await page.evaluate(workspace => (window as ConflictE2EWindow).__X4_E2E__!.setWorkspace(workspace), localCopy);
  await expect(page.getByTestId('sync-conflict-dialog')).toBeVisible({ timeout: 10_000 });
  await seedServerWorkspace(serverCopy);
  mockServerReads = false;
  return async () => page.unroute('**/api/agent/workspace', handler);
}

test('workspace conflict dialog explains both copies and server adoption has local Undo', async ({ page }) => {
  const initial = await boot(page, 'Conflict Initial');
  const serverCopy = { ...initial, name: 'Conflict Server Copy', description: 'saved by another writer' };
  const localCopy = { ...initial, name: 'Conflict Local Copy', description: 'unsent local canvas' };
  const releaseConflictRoute = await triggerConflict(page, localCopy, serverCopy);

  const dialog = page.getByTestId('sync-conflict-dialog');
  await expect(page.getByTestId('conflict-server-meta')).toContainText('Conflict Server Copy');
  await expect(page.getByTestId('conflict-local-meta')).toContainText('Conflict Local Copy');
  await expect(page.getByTestId('conflict-file-counts')).toContainText('replace');
  await expect(page.getByText('Nothing was overwritten.')).toBeVisible();
  await expect(page.getByText('A local Undo checkpoint is created first.')).toBeVisible();
  await expect(page.getByText('A bounded server recovery is saved first.')).toBeVisible();

  await page.getByTestId('conflict-cancel-btn').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('sync-conflict-review')).toBeVisible();
  await page.getByTestId('sync-conflict-review').click();
  await page.getByTestId('conflict-adopt-btn').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as ConflictE2EWindow).__X4_E2E__!.getWorkspace().name)).toBe(serverCopy.name);
  await releaseConflictRoute();

  const undo = page.locator('[data-global-action="undo"]');
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect.poll(() => page.evaluate(() => (window as ConflictE2EWindow).__X4_E2E__!.getWorkspace().name)).toBe(localCopy.name);
});

test('explicit local overwrite wins and records a durable recovery', async ({ page, request }) => {
  const initial = await boot(page, 'Conflict Keep Initial');
  const newerServer = { ...initial, name: 'Conflict Newer Server', description: 'second writer' };
  const keptLocal = { ...initial, name: 'Conflict Kept Local', description: 'explicit winner' };
  const releaseConflictRoute = await triggerConflict(page, keptLocal, newerServer);

  await page.getByTestId('conflict-keep-btn').click();
  await expect(page.getByTestId('sync-conflict-dialog')).toHaveCount(0);
  await releaseConflictRoute();
  await expect.poll(async () => (await readServerWorkspace()).name).toBe(keptLocal.name);

  const history = await request.get('http://127.0.0.1:3101/api/agent/history?kind=workspace', {
    headers: { Authorization: `Bearer ${E2E_TOKEN}` },
  });
  expect(history.ok()).toBeTruthy();
  const rows = (await history.json()).rows as Array<{ title?: string; recoveryKind?: string; revertible?: boolean }>;
  expect(rows.some(row => row.title?.includes(keptLocal.name) && row.recoveryKind === 'workspace' && row.revertible === true)).toBeTruthy();
});
