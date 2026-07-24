import { expect, test } from '@playwright/test';

const unpackedRoot = 'F:\\Downskies\\x4unpackersuiteV1\\X4 unpacked 9.00';

test('Directory Settings presents one corpus root, measured coverage, and the credited unpacker', async ({ page }) => {
  let detectionRequests = 0;
  await page.route('**/api/agent/detect-game', route => {
    detectionRequests += 1;
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'should not run for a configured game' }) });
  });
  await page.route('**/api/schema/config', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      loaded: true,
      config: { x4ReferenceRoot: unpackedRoot, xsdSchemaPath: '', x4GamePath: 'D:\\Games\\X4 Foundations', modWorkspacePath: 'D:\\X4ForgeMods' },
      resolved: {
        x4GamePath: 'D:\\Games\\X4 Foundations',
        modWorkspacePath: 'D:\\X4ForgeMods',
        x4ReferenceRoot: unpackedRoot,
        x4ReferenceExists: true,
        mdExists: true,
        commonExists: true,
      },
      directorySafety: { safe: true, issues: [] },
    }),
  }));
  await page.route('**/api/reference/coverage', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      status: { state: 'ready' },
      coverage: {
        generation: '0123456789abcdef',
        totalFiles: 1_028_384,
        totalBytes: 33_206_154_495,
        byRole: [
          { key: 'grammar', count: 88 },
          { key: 'canonical-data', count: 9_884 },
          { key: 'executable-example', count: 2_428 },
          { key: 'asset', count: 1_016_000 },
        ],
        byConsumer: [{ key: 'unconsumed', count: 1_015_984 }],
      },
    }),
  }));

  await page.goto('/');
  await page.getByTitle('Manage all folders the studio uses (Mod Workspace, X4 game path, schema)').click();

  await expect(page.getByText('Directory Settings', { exact: true })).toBeVisible();
  await expect(page.getByText(/Could not load directory config from the server/)).toHaveCount(0);

  const corpus = page.getByTestId('x4-corpus-settings');
  await expect(corpus.getByText('X4 Unpacked Game Corpus', { exact: true })).toBeVisible();
  await expect(corpus.locator('input')).toHaveValue(unpackedRoot);
  await expect(corpus.getByText('1,028,384 discovered', { exact: true })).toBeVisible();
  await expect(corpus.getByText('88 grammar', { exact: true })).toBeVisible();
  await expect(corpus.getByText('9,884 canonical data', { exact: true })).toBeVisible();
  await expect(corpus.getByText('2,428 code examples', { exact: true })).toBeVisible();
  await expect(corpus.getByText(/Created by/)).toContainText('z1ppeh');

  const unpacker = corpus.getByRole('link', { name: /Find X4 Unpacker/ });
  await expect(unpacker).toHaveAttribute('href', 'https://www.nexusmods.com/x4foundations/mods/2142?tab=description');
  await expect(unpacker).toHaveAttribute('target', '_blank');
  await expect(unpacker).toHaveAttribute('rel', /noopener/);

  const advanced = page.getByRole('button', { name: /Advanced fallback: manual XSD schema folder/ });
  await expect(advanced).toHaveAttribute('aria-expanded', 'false');
  await advanced.click();
  await expect(advanced).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('manual-xsd-settings')).toBeVisible();
  await expect(page.getByTestId('manual-xsd-settings').locator('input')).toHaveValue('');

  const community = page.getByTestId('forge-discord-community');
  await expect(community.getByText('Join the X4 Forge Discord.')).toBeVisible();
  await expect(community).toContainText('share the mods you are building');
  const discord = community.getByRole('link', { name: /Open Discord/ });
  await expect(discord).toHaveAttribute('href', 'https://discord.gg/9qvAvtXqWP');
  await expect(discord).toHaveAttribute('target', '_blank');
  await expect(discord).toHaveAttribute('rel', /noopener/);
  expect(detectionRequests).toBe(0);
});

test('Directory Settings auto-detects an empty game path into an isolated development workspace', async ({ page }) => {
  const game = 'G:\\SteamLibrary\\steamapps\\common\\X4 Foundations';
  const workspace = 'C:\\Users\\example\\Documents\\X4ForgeMods';
  await page.route('**/api/schema/config', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      loaded: true,
      config: { x4GamePath: '', modWorkspacePath: '', filesystemPath: '', x4ReferenceRoot: unpackedRoot },
      resolved: { x4GamePath: '', x4ReferenceRoot: unpackedRoot, x4ReferenceExists: true, mdExists: true, commonExists: true },
      directorySafety: { safe: true, issues: [] },
    }),
  }));
  await page.route('**/api/agent/detect-game', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      found: true,
      source: 'steam',
      proposal: { x4GamePath: game, modWorkspacePath: workspace, filesystemPath: workspace, xsdSchemaPath: 'C:\\schemas' },
    }),
  }));
  await page.route('**/api/reference/coverage', route => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: { state: 'scanning' } }) }));

  await page.goto('/');
  await page.getByTitle('Manage all folders the studio uses (Mod Workspace, X4 game path, schema)').click();

  await expect(page.getByTestId('game-install-settings').locator('input')).toHaveValue(game);
  await expect(page.getByTestId('mod-workspace-settings').locator('input')).toHaveValue(workspace);
  await expect(page.getByTestId('filesystem-settings').locator('input')).toHaveValue(workspace);
  await expect(page.getByText(/Found X4 via Steam/)).toBeVisible();
  await expect(page.getByText(/live game is updated only through an explicit Deploy operation/)).toBeVisible();
});

test('Directory Settings exposes and repairs a legacy live-extensions workspace', async ({ page }) => {
  const game = 'G:\\SteamLibrary\\steamapps\\common\\X4 Foundations';
  const live = `${game}\\extensions`;
  const safe = 'C:\\Users\\example\\Documents\\X4ForgeMods';
  let savedBody: any = null;
  await page.route('**/api/schema/config', async route => {
    if (route.request().method() === 'POST') {
      savedBody = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, schemaComplete: true, resolved: { x4ReferenceExists: true, mdExists: true, commonExists: true }, directorySafety: { safe: true, issues: [] }, schema_counts: { events: 1, conditions: 1, actions: 1 } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        loaded: true,
        config: { x4GamePath: game, modWorkspacePath: live, filesystemPath: live, x4ReferenceRoot: unpackedRoot },
        resolved: { x4GamePath: game, modWorkspacePath: live, filesystemPath: live, x4ReferenceRoot: unpackedRoot, x4ReferenceExists: true, mdExists: true, commonExists: true },
        directorySafety: { safe: false, issues: [
          { field: 'modWorkspacePath', code: 'PROTECTED_ROOT_OVERLAP', message: 'Mod Workspace Folder must be an isolated development directory.' },
          { field: 'filesystemPath', code: 'PROTECTED_ROOT_OVERLAP', message: 'Filesystem Folder must be an isolated development directory.' },
        ] },
      }),
    });
  });
  await page.route('**/api/agent/detect-game', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ found: true, source: 'steam', proposal: { x4GamePath: game, modWorkspacePath: safe, filesystemPath: safe, xsdSchemaPath: 'C:\\schemas' } }),
  }));
  await page.route('**/api/reference/coverage', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: { state: 'ready' }, coverage: { generation: 'safe', totalFiles: 0, totalBytes: 0, byRole: [], byConsumer: [] } }) }));

  await page.goto('/');
  await page.getByTitle('Manage all folders the studio uses (Mod Workspace, X4 game path, schema)').click();
  await expect(page.getByText('Mod Workspace Folder must be an isolated development directory.')).toBeVisible();
  await page.getByRole('button', { name: 'Detect X4 installation' }).click();
  await expect(page.getByTestId('mod-workspace-settings').locator('input')).toHaveValue(safe);
  await expect(page.getByTestId('filesystem-settings').locator('input')).toHaveValue(safe);
  await page.getByRole('button', { name: 'Save Paths' }).click();
  await expect(page.getByText(/Saved\. Schema library reloaded/)).toBeVisible();
  expect(savedBody.modWorkspacePath).toBe(safe);
  expect(savedBody.filesystemPath).toBe(safe);
});
