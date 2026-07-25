import { expect, test } from '@playwright/test';
import { readServerWorkspace } from './ephemeral';

const workspacePath = 'D:\\X4ForgeMods';
const filesystemPath = 'G:\\Games\\X4 Foundations\\extensions';
const gamePath = 'G:\\Games\\X4 Foundations';

function modRoot(name: string) {
  return [{
    name,
    kind: 'directory',
    path: name,
    hasChildren: true,
    hasContent: true,
    hasPacked: false,
    childCount: 3,
  }];
}

function modChildren(name: string, marker: string) {
  return [
    { name: 'assets', kind: 'directory', path: `${name}/assets`, hasChildren: true, hasContent: false, hasPacked: false, childCount: 1 },
    { name: 'content.xml', kind: 'file', path: `${name}/content.xml` },
    { name: `${marker}.arbitrary`, kind: 'file', path: `${name}/${marker}.arbitrary` },
  ];
}

test('Load Mod Project browses and imports the explicitly selected source root', async ({ page }) => {
  const activeWorkspace = await readServerWorkspace();
  const previewBodies: any[] = [];
  const importBodies: any[] = [];
  const listRequests: string[] = [];
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
  await page.route('**/api/fs/list?**', route => {
    const requestUrl = new URL(route.request().url());
    const root = requestUrl.searchParams.get('root');
    const relativePath = requestUrl.searchParams.get('path') || '';
    const depth = requestUrl.searchParams.get('depth');
    listRequests.push(`${root}:${relativePath}:${depth}`);
    let body: any[] = [];
    if (depth === '1' && relativePath === '' && (root === 'workspace' || root === 'filesystem')) {
      body = modRoot('same_mod');
    } else if (depth === '1' && relativePath === 'same_mod' && (root === 'workspace' || root === 'filesystem')) {
      body = modChildren('same_mod', root);
    } else if (depth === '1' && relativePath === 'same_mod/assets' && (root === 'workspace' || root === 'filesystem')) {
      body = [{ name: `${root}.png`, kind: 'file', path: `same_mod/assets/${root}.png` }];
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
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
  await expect(workspaceSource.getByRole('button', { name: 'Collapse Mod Workspace' })).toHaveAttribute('aria-expanded', 'true');
  await expect(filesystemSource.getByRole('button', { name: 'Collapse Filesystem' })).toHaveAttribute('aria-expanded', 'true');
  await expect(workspaceSource.getByRole('button', { name: 'Select same_mod from Mod Workspace' })).toBeVisible();
  await expect(filesystemSource.getByRole('button', { name: 'Select same_mod from Filesystem' })).toBeVisible();
  expect(listRequests).toEqual(expect.arrayContaining(['workspace::1', 'filesystem::1']));

  await workspaceSource.getByRole('button', { name: 'Collapse Mod Workspace' }).click();
  await expect(workspaceSource.getByRole('button', { name: 'Select same_mod from Mod Workspace' })).toHaveCount(0);
  await workspaceSource.getByRole('button', { name: 'Expand Mod Workspace' }).click();
  await expect(workspaceSource.getByRole('button', { name: 'Select same_mod from Mod Workspace' })).toBeVisible();

  const filesystemMod = filesystemSource.getByTestId('project-tree-node-filesystem-same_mod');
  await filesystemMod.getByRole('button', { name: 'Expand same_mod' }).click();
  await expect(filesystemMod.getByText('content.xml', { exact: true })).toBeVisible();
  await expect(filesystemMod.getByRole('button', { name: 'Expand assets' })).toBeVisible();
  await filesystemMod.getByRole('button', { name: 'Expand assets' }).click();
  await expect(filesystemMod.getByText('filesystem.png', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Filter mod folders...').fill('filesystem.png');
  await expect(filesystemMod.getByText('filesystem.png', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Filter mod folders...').fill('');
  expect(listRequests.filter(request => request === 'filesystem:same_mod:1')).toHaveLength(1);
  await filesystemMod.getByRole('button', { name: 'Collapse same_mod' }).click();
  await filesystemMod.getByRole('button', { name: 'Expand same_mod' }).click();
  expect(listRequests.filter(request => request === 'filesystem:same_mod:1')).toHaveLength(1);

  await filesystemSource.getByRole('button', { name: 'Select same_mod from Filesystem' }).click();
  await expect.poll(() => previewBodies.length).toBe(1);
  expect(previewBodies[0]).toEqual({ root: 'filesystem', path: 'same_mod' });
  await expect(page.getByText('filesystem: same_mod', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Load Project', exact: true }).click();
  await expect.poll(() => importBodies.length).toBe(1);
  expect(importBodies[0]).toEqual({ root: 'filesystem', path: 'same_mod' });
  await expect(page.getByText('Load Mod Project', { exact: true })).toHaveCount(0);
});

test('Load Mod Project keeps a healthy source browsable when the other root fails', async ({ page }) => {
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
  await page.route('**/api/fs/list?**', route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get('root') === 'workspace') {
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace scan unavailable' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(modRoot('filesystem_mod')) });
  });

  await page.goto('/');
  const startupWalkaround = page.getByTestId('health-card');
  await expect(startupWalkaround).toBeVisible();
  await page.getByTestId('health-card-dismiss').click();
  await page.getByTitle('Load existing mods or push updates to GitHub').click();

  const workspaceSource = page.getByTestId('project-source-workspace');
  const filesystemSource = page.getByTestId('project-source-filesystem');
  await expect(workspaceSource).toContainText('Workspace scan unavailable');
  await expect(filesystemSource.getByRole('button', { name: 'Select filesystem_mod from Filesystem' })).toBeVisible();
});
