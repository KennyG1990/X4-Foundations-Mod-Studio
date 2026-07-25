import { expect, test } from '@playwright/test';
import { readServerWorkspace } from './ephemeral';

const workspacePath = 'D:\\X4ForgeMods';
const filesystemPath = 'G:\\Games\\X4 Foundations\\extensions';
const gamePath = 'G:\\Games\\X4 Foundations';

function modTree(name: string, marker: string) {
  return [{
    name,
    kind: 'directory',
    path: name,
    children: [
      { name: 'content.xml', kind: 'file', path: `${name}/content.xml` },
      { name: `${marker}.arbitrary`, kind: 'file', path: `${name}/${marker}.arbitrary` },
    ],
  }];
}

test('Load Mod Project browses and imports the explicitly selected source root', async ({ page }) => {
  const activeWorkspace = await readServerWorkspace();
  const previewBodies: any[] = [];
  const importBodies: any[] = [];
  await page.addInitScript(() => localStorage.setItem('x4_forge_experience_mode', 'expert'));

  await page.route('**/api/schema/config', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        loaded: true,
        config: { x4GamePath: gamePath, modWorkspacePath: workspacePath, filesystemPath },
        resolved: { x4GamePath: gamePath, modWorkspacePath: workspacePath, filesystemPath, mdExists: true, commonExists: true },
        directorySafety: { safe: true, issues: [] },
      }),
    });
  });
  await page.route('**/api/fs/list?root=workspace', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(modTree('same_mod', 'workspace')),
  }));
  await page.route('**/api/fs/list?root=filesystem', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(modTree('same_mod', 'filesystem')),
  }));
  await page.route('**/api/agent/round-trip-check', async route => {
    previewBodies.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ strictLossless: true, importReport: { counts: { passthrough: 1 } } }),
    });
  });
  await page.route('**/api/agent/mod-folder/import', async route => {
    importBodies.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, workspace: activeWorkspace, report: { summary: 'passthrough:1' } }),
    });
  });

  await page.goto('/');
  const startupWalkaround = page.getByTestId('health-card');
  await expect(startupWalkaround).toBeVisible();
  await page.getByTestId('health-card-dismiss').click();
  await expect(startupWalkaround).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dismiss setup' })).toHaveCount(0);
  await page.getByTitle('Load existing mods or push updates to GitHub').click();
  await expect(page.getByText('Load Mod Project', { exact: true })).toBeVisible();

  const workspaceSource = page.getByTestId('project-source-workspace');
  const filesystemSource = page.getByTestId('project-source-filesystem');
  await expect(workspaceSource).toContainText('Mod Workspace');
  await expect(workspaceSource).toContainText(workspacePath);
  await expect(filesystemSource).toContainText('Filesystem');
  await expect(filesystemSource).toContainText(filesystemPath);
  await expect(workspaceSource.getByRole('button', { name: /same_mod/ })).toBeVisible();
  await expect(filesystemSource.getByRole('button', { name: /same_mod/ })).toBeVisible();

  await filesystemSource.getByRole('button', { name: /same_mod/ }).click();
  await expect.poll(() => previewBodies.length).toBe(1);
  expect(previewBodies[0]).toEqual({ root: 'filesystem', path: 'same_mod' });
  await expect(page.getByText('filesystem: same_mod', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Load Project', exact: true }).click();
  await expect.poll(() => importBodies.length).toBe(1);
  expect(importBodies[0]).toEqual({ root: 'filesystem', path: 'same_mod' });
  await expect(page.getByText('Load Mod Project', { exact: true })).toHaveCount(0);
});
