import { expect, test, type Page } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { workspaceContentHash } from '../../src/lib/workspaceIdentity';
import { sanitizeWorkspace } from '../../src/types';
import {
  GLOBAL_ACTION_IDS,
  DEFAULT_STUDIO_LAYOUT,
  SIDEBAR_NAV_ITEMS,
  STUDIO_LAYOUT_KEY,
  WORKSPACE_NAV_ITEMS,
} from '../../src/lib/studioLayout';
import { readServerLayout, seedServerLayout, seedServerWorkspace } from './ephemeral';

type E2EWindow = Window & {
  __X4_E2E__?: { getWorkspaceHash: () => string };
};

async function bootExpert(page: Page, layout?: unknown) {
  const seededWorkspace = buildTemplateWorkspace('welcome');
  const seededHash = workspaceContentHash(sanitizeWorkspace(seededWorkspace));
  await seedServerWorkspace(seededWorkspace);
  await seedServerLayout(layout === undefined ? DEFAULT_STUDIO_LAYOUT : layout);
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem('x4_forge_experience_mode', 'expert');
    if (sessionStorage.getItem('__x4_studio_shell_initialized') !== '1') {
      localStorage.removeItem(key);
      if (value !== undefined) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      sessionStorage.setItem('__x4_studio_shell_initialized', '1');
    }
  }, { key: STUDIO_LAYOUT_KEY, value: layout });
  await page.goto('/');
  await expect(page.getByTestId('studio-workspace')).toBeVisible();
  // Rendering the shell is not proof that its asynchronous boot read has adopted the
  // seeded server workspace. Wait for that authoritative content before measuring
  // navigation immutability, otherwise a legitimate late boot adoption looks like a
  // shell action changed project data and flakes under a busy full-suite run.
  await expect.poll(
    () => page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspaceHash()),
    { timeout: 15_000 },
  ).toBe(seededHash);
  const health = page.getByTestId('health-card');
  await health.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
  if (await health.isVisible()) await page.getByTestId('health-card-dismiss').click();
}

test('lossless registries keep every destination and utility recoverable', async ({ page }) => {
  await bootExpert(page);
  const initialHash = await page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspaceHash());

  await expect(page.locator('[data-workspace-view]')).toHaveCount(WORKSPACE_NAV_ITEMS.length);
  for (const item of WORKSPACE_NAV_ITEMS) {
    await page.locator(`[data-workspace-view="${item.id}"]`).click();
    await expect(page.locator(`[data-workspace-view="${item.id}"]`)).toHaveAttribute('aria-current', 'page');
  }

  const visibleTools = SIDEBAR_NAV_ITEMS.filter(item => item.id !== 'ai');
  await expect(page.locator('[data-sidebar-tab]')).toHaveCount(visibleTools.length);
  for (const item of visibleTools) {
    await page.locator(`[data-sidebar-tab="${item.id}"]`).click();
    await expect(page.locator(`[data-sidebar-tab="${item.id}"]`)).toHaveAttribute('aria-current', 'page');
  }

  await page.getByTestId('studio-menu-button').click();
  for (const action of GLOBAL_ACTION_IDS.filter(id => !['undo', 'redo', 'shortcuts', 'workspace-switcher', 'experience-mode', 'ai-settings'].includes(id))) {
    await expect(page.getByTestId('studio-menu').locator(`[data-global-action="${action}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-global-action="undo"]')).toBeVisible();
  await expect(page.locator('[data-global-action="redo"]')).toBeVisible();
  await expect(page.locator('[data-global-action="shortcuts"]')).toBeVisible();
  await expect(page.locator('[data-global-action="workspace-switcher"]')).toBeVisible();
  await expect(page.getByTestId('experience-mode-switch')).toBeVisible();
  expect(await page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspaceHash())).toBe(initialHash);
});

test('layout customization docks, hides, reorders, collapses, restores, and persists', async ({ page, browser }) => {
  await page.route('**/api/agent/health-card', async route => {
    // Keep the first response beyond bootExpert's 1.5s dismissal window so the
    // late-appearance safe-area regression remains deterministic.
    await new Promise(resolve => setTimeout(resolve, 2_500));
    await route.continue();
  });
  await bootExpert(page);
  const initialHash = await page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspaceHash());

  const aiScriptsTab = page.locator('[data-workspace-view="aiscripts"]');
  const aiScriptsBox = await aiScriptsTab.boundingBox();
  expect(aiScriptsBox).not.toBeNull();
  await page.locator('[data-workspace-view="blueprint"]').dragTo(aiScriptsTab, {
    targetPosition: { x: aiScriptsBox!.width - 2, y: aiScriptsBox!.height / 2 },
  });
  await expect(page.locator('[data-workspace-view]').first()).toHaveAttribute('data-workspace-view', 'aiscripts');

  const cuesTool = page.locator('[data-sidebar-tab="cues"]');
  const cuesBox = await cuesTool.boundingBox();
  expect(cuesBox).not.toBeNull();
  await page.locator('[data-sidebar-tab="script"]').dragTo(cuesTool, {
    targetPosition: { x: cuesBox!.width / 2, y: cuesBox!.height - 2 },
  });
  await expect(page.locator('[data-sidebar-tab]').first()).toHaveAttribute('data-sidebar-tab', 'cues');
  await page.getByTestId('workspace-nav-collapse').click();
  await expect(page.getByTestId('workspace-bar-collapsed')).toBeVisible();
  await page.getByTestId('workspace-bar-collapsed').getByRole('button').click();
  await expect(page.getByTestId('workspace-navigation')).toBeVisible();

  await page.getByTestId('studio-settings-tool').click();
  const layoutSettings = page.getByTestId('studio-layout-settings');
  await expect(layoutSettings).toBeVisible();
  await layoutSettings.getByTestId('workspace-dock-select').selectOption('bottom');
  await layoutSettings.getByTestId('tool-dock-select').selectOption('right');
  await layoutSettings.getByRole('button', { name: 'Move MD Scripts down' }).click();
  await layoutSettings.getByRole('button', { name: 'Move MD Scripts down' }).click();
  await layoutSettings.getByRole('button', { name: 'Hide AI Scripts' }).click();
  await layoutSettings.getByRole('button', { name: 'Hide Files' }).click();
  await layoutSettings.getByRole('button', { name: 'Hide panel', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();

  await expect(page.getByTestId('workspace-navigation')).toHaveAttribute('data-dock', 'bottom');
  await expect(page.locator('[data-workspace-view="aiscripts"]')).toHaveCount(0);
  await expect(page.getByTestId('side-panel-restore')).toBeVisible();
  await page.getByTestId('side-panel-restore').click();
  await expect(page.locator('#side_panel')).toHaveAttribute('data-tool-dock', 'right');
  await expect(page.locator('[data-sidebar-tab="filesystem"]')).toHaveCount(0);

  const healthCard = page.getByTestId('health-card');
  await expect(healthCard).toBeVisible();
  const healthCardBox = await healthCard.boundingBox();
  const toolRailCollapseBox = await page.getByTestId('tool-rail-collapse').boundingBox();
  const workspaceNavigationBox = await page.getByTestId('workspace-navigation').boundingBox();
  expect(healthCardBox).not.toBeNull();
  expect(toolRailCollapseBox).not.toBeNull();
  expect(workspaceNavigationBox).not.toBeNull();
  const boxesOverlap = (first: NonNullable<typeof healthCardBox>, second: NonNullable<typeof toolRailCollapseBox>) =>
    first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
  expect(boxesOverlap(healthCardBox!, toolRailCollapseBox!)).toBe(false);
  expect(healthCardBox!.y + healthCardBox!.height).toBeLessThanOrEqual(workspaceNavigationBox!.y);
  await page.getByTestId('tool-rail-collapse').click();
  await expect(page.getByTestId('tool-rail-restore')).toBeVisible();
  await page.getByTestId('tool-rail-restore').click();

  const firstWorkspace = await page.locator('[data-workspace-view]').first().getAttribute('data-workspace-view');
  expect(firstWorkspace).toBe('libraries');
  await expect.poll(async () => {
    const saved = await readServerLayout();
    return `${saved?.workspaceDock}:${saved?.toolDock}:${saved?.hiddenWorkspaceViews?.includes('aiscripts')}`;
  }).toBe('bottom:right:true');
  // Extension sidecar restarts change localhost port/origin. A fresh browser context has
  // no layout localStorage, so only the durable server preference can restore the shell.
  const restartedContext = await browser.newContext();
  await restartedContext.addInitScript(() => localStorage.setItem('x4_forge_experience_mode', 'expert'));
  const restartedPage = await restartedContext.newPage();
  await restartedPage.goto(new URL('/', page.url()).toString());
  await expect(restartedPage.getByTestId('workspace-navigation')).toHaveAttribute('data-dock', 'bottom');
  await expect(restartedPage.locator('#side_panel')).toHaveAttribute('data-tool-dock', 'right');
  await expect(restartedPage.locator('[data-workspace-view="aiscripts"]')).toHaveCount(0);
  await restartedPage.getByTitle('Manage all folders the studio uses (Mod Workspace, X4 game path, schema)').click();
  const restoredSettings = restartedPage.getByTestId('studio-layout-settings');
  await restoredSettings.getByRole('button', { name: 'Show AI Scripts' }).click();
  await restoredSettings.getByRole('button', { name: 'Show Files' }).click();
  await restartedPage.getByRole('button', { name: 'Close settings' }).click();
  await restartedPage.locator('[data-workspace-view="aiscripts"]').click();
  await expect(restartedPage.locator('[data-workspace-view="aiscripts"]')).toHaveAttribute('aria-current', 'page');
  await restartedPage.locator('[data-sidebar-tab="filesystem"]').click();
  await expect(restartedPage.locator('[data-sidebar-tab="filesystem"]')).toHaveAttribute('aria-current', 'page');
  expect(await restartedPage.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspaceHash())).toBe(initialHash);
  await restartedContext.close();
});

test('corrupt and all-hidden preferences recover to a usable complete shell', async ({ page }) => {
  await bootExpert(page, '{not-json');
  await expect(page.locator('[data-workspace-view]')).toHaveCount(WORKSPACE_NAV_ITEMS.length);
  await expect(page.locator('[data-sidebar-tab]')).toHaveCount(SIDEBAR_NAV_ITEMS.length - 1);

  await page.evaluate(({ key, workspaces, tools }) => localStorage.setItem(key, JSON.stringify({
    workspaceOrder: ['wiki', 'wiki', 'unknown'],
    hiddenWorkspaceViews: workspaces,
    toolOrder: ['reference', 'reference', 'unknown'],
    hiddenTools: tools,
  })), { key: STUDIO_LAYOUT_KEY, workspaces: WORKSPACE_NAV_ITEMS.map(item => item.id), tools: SIDEBAR_NAV_ITEMS.map(item => item.id) });
  await page.reload();
  await expect(page.locator('[data-workspace-view]')).toHaveCount(WORKSPACE_NAV_ITEMS.length);
  await expect(page.locator('[data-sidebar-tab]')).toHaveCount(SIDEBAR_NAV_ITEMS.length - 1);
});

for (const width of [2560, 1920, 1600, 1366, 1024, 800]) {
  test(`shell stays inside the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await bootExpert(page);
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.client);

    await page.locator('[data-workspace-view="xmlpatch"]').click();
    if (width < 1500) {
      await expect(page.getByTestId('xmlpatch-compact-tabs')).toBeVisible();
      for (const pane of ['tree', 'blocks', 'preview']) {
        await page.locator(`[data-compact-pane="${pane}"]`).click();
        await expect(page.locator(`[data-xmlpatch-pane="${pane}"]`)).toBeVisible();
      }
    }
    const after = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(after).toBe(true);
  });
}
