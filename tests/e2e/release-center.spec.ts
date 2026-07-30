import { expect, test, type Page } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { DEFAULT_RELEASE_PREFERENCES, RELEASE_PREFERENCES_KEY, type ReleasePreferences } from '../../src/lib/releasePreferences';
import { seedServerWorkspace } from './ephemeral';

const workspace = buildTemplateWorkspace('welcome');

async function openReleaseCenter(page: Page, preferences: ReleasePreferences = DEFAULT_RELEASE_PREFERENCES) {
  if (preferences.mode === 'express') {
    await page.route('**/api/studio/release-preferences', route => route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preferences }) })
      : route.continue());
  }
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem('x4_forge_experience_mode', 'expert');
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: RELEASE_PREFERENCES_KEY, value: preferences });
  await page.goto('/');
  const health = page.getByTestId('health-card');
  await health.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
  if (await health.isVisible()) await page.getByTestId('health-card-dismiss').click();
  await page.locator('[data-sidebar-tab="playtest"]').click();
  await expect(page.getByTestId('release-center')).toBeVisible();
}

test.beforeEach(async () => {
  await seedServerWorkspace(workspace);
});

test('Nexus and Steam are separate guided flows with explicit workspace and stage truth', async ({ page }) => {
  let nexusBody: Record<string, unknown> | null = null;
  let steamBody: Record<string, unknown> | null = null;
  await page.route('**/api/agent/release/nexus/prepare', async route => {
    nexusBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, status: 'VERIFIED', platform: 'nexus', modId: 'welcome_message', version: '101',
      zipPath: 'C:/fixture/releases/nexus/welcome_message_v101.zip', sha256: 'a'.repeat(64), sizeBytes: 4096,
      stages: [
        { id: 'source', label: 'Resolve complete source', status: 'pass', detail: 'Disk-backed source is fresh.' },
        { id: 'reopen', label: 'Reopen and verify ZIP', status: 'pass', detail: 'CRC, size, path, and hashes verified.' },
      ], failedStages: [],
    }) });
  });
  await page.route('**/api/agent/release/steam/prepare', async route => {
    steamBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, status: 'PARTIAL', platform: 'steam', readyForUpload: false, modId: 'welcome_message', version: '101',
      targetPath: 'C:/fixture/releases/steam/welcome_message', backupPath: 'C:/fixture/releases/steam/welcome_message_backup.zip', backupHash: 'b'.repeat(64), backupSizeBytes: 8192,
      command: {
        mode: 'publishx4', executable: 'C:\\X Tools\\WorkshopTool.exe',
        args: ['publishx4', '-path', 'C:\\fixture\\welcome_message', '-preview', 'C:\\fixture\\preview.png'],
        display: "& 'C:\\X Tools\\WorkshopTool.exe' 'publishx4' '-path' 'C:\\fixture\\welcome_message' '-preview' 'C:\\fixture\\preview.png'",
      },
      stages: [
        { id: 'folder', label: 'Validate Steam folder name', status: 'pass', detail: 'welcome_message is legal.' },
        { id: 'catalogs', label: 'Build and verify CAT/DAT', status: 'pass', detail: 'One catalog volume verified.' },
        { id: 'tool', label: 'Locate Egosoft WorkshopTool', status: 'fail', detail: 'Select WorkshopTool.exe from X Tools.' },
      ], failedStages: ['tool'],
    }) });
  });
  await page.route('**/api/agent/release/steam/verify', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({
    success: false, status: 'FAILED', platform: 'steam', code: 'STEAM_WORKSHOP_ID_MISSING', error: 'WorkshopTool did not write a ws_<numeric> id.',
    stages: [{ id: 'post-tool', label: 'Verify Workshop result', status: 'fail', detail: 'No Workshop id found.' }], failedStages: ['post-tool'],
  }) }));

  await openReleaseCenter(page);
  await expect(page.getByTestId('package-nexus-btn')).toBeVisible();
  await expect(page.getByTestId('package-steam-btn')).toBeVisible();

  await page.getByTestId('package-nexus-btn').click();
  await expect(page.getByTestId('nexus-release-guide')).toContainText('Nexus Mods guide');
  await expect(page.getByTestId('nexus-release-guide').locator('ol')).toContainText('reopens every entry');
  await page.getByTestId('prepare-nexus-btn').click();
  await expect(page.getByTestId('release-result')).toContainText('VERIFIED');
  await expect(page.getByTestId('release-result')).toContainText('Reopen and verify ZIP');
  await expect(page.getByTestId('export-release-artifact')).toContainText('Choose output file for Nexus ZIP');
  expect((nexusBody?.workspace as { name?: string })?.name).toBe(workspace.name);

  await page.getByRole('button', { name: 'Choose platform' }).click();
  await page.getByTestId('package-steam-btn').click();
  await page.getByTestId('steam-preview-path').fill('C:/fixture/preview.png');
  await page.getByTestId('steam-tool-path').fill('C:/X Tools/WorkshopTool.exe');
  await page.getByTestId('steam-change-note').fill('Initial guided release test');
  await page.getByTestId('prepare-steam-btn').click();
  await expect(page.getByTestId('release-result')).toContainText('PARTIAL');
  await expect(page.getByTestId('release-result')).toContainText('Validate Steam folder name');
  await expect(page.getByTestId('release-result')).toContainText('Select WorkshopTool.exe from X Tools.');
  await expect(page.getByTestId('steam-command')).toContainText('publishx4');
  await expect(page.getByTestId('open-steam-terminal')).toContainText('do not run');
  await expect(page.getByTestId('export-release-artifact')).toContainText('Steam rollback ZIP');
  await expect(page.getByTestId('steam-minor-update').locator('xpath=..')).toContainText('Do not select this merely because');
  expect((steamBody?.workspace as { name?: string })?.name).toBe(workspace.name);
  expect(steamBody?.previewPath).toBe('C:/fixture/preview.png');
  expect(steamBody?.toolPath).toBe('C:/X Tools/WorkshopTool.exe');
  expect(steamBody?.minorUpdate).toBe(false);
  await page.getByTestId('verify-steam-result').click();
  await expect(page.getByTestId('release-result')).toContainText('STEAM_WORKSHOP_ID_MISSING');
  await expect(page.getByTestId('release-result')).toContainText('No Workshop id found.');
});

test('Express mode collapses successful explanations but keeps failures and required actions visible', async ({ page }) => {
  await page.route('**/api/agent/release/nexus/prepare', route => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({
    success: false, status: 'FAILED', platform: 'nexus', code: 'RELEASE_MANIFEST_INVALID', error: 'content.xml requires an author.',
    stages: [
      { id: 'source', label: 'Resolve complete source', status: 'pass', detail: 'Source resolved.' },
      { id: 'manifest', label: 'Validate content.xml release metadata', status: 'fail', detail: 'Missing author.' },
    ], failedStages: ['manifest'],
  }) }));
  await openReleaseCenter(page, { version: 1, mode: 'express', expressRiskAcknowledged: true });
  await page.getByTestId('package-nexus-btn').click();
  await expect(page.getByTestId('nexus-release-guide').locator('ol')).toHaveCount(0);
  await expect(page.getByTestId('release-result')).toContainText('RELEASE_MANIFEST_INVALID');
  await expect(page.getByTestId('release-result')).toContainText('Missing author.');
  await expect(page.getByTestId('release-result').locator('details').filter({ hasText: 'Resolve complete source' })).not.toHaveAttribute('open', '');
  await expect(page.getByTestId('release-result').locator('details').filter({ hasText: 'Validate content.xml release metadata' })).toHaveAttribute('open', '');
});

test('verified first publish requires previewed and confirmed source metadata adoption', async ({ page }) => {
  const adoptionBodies: Array<Record<string, unknown>> = [];
  await page.route('**/api/agent/release/steam/prepare', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    success: true, status: 'READY_FOR_INTERACTIVE_UPLOAD', platform: 'steam', readyForUpload: true, modId: 'welcome_message', version: '101',
    targetPath: 'C:/fixture/releases/steam/welcome_message', backupPath: 'C:/fixture/releases/steam/welcome_message_backup.zip', backupHash: 'b'.repeat(64), backupSizeBytes: 8192,
    command: {
      mode: 'publishx4', executable: 'C:\\X Tools\\WorkshopTool.exe',
      args: ['publishx4', '-path', 'C:\\fixture\\welcome_message', '-preview', 'C:\\fixture\\preview.png'],
      display: "& 'C:\\X Tools\\WorkshopTool.exe' 'publishx4' '-path' 'C:\\fixture\\welcome_message' '-preview' 'C:\\fixture\\preview.png'",
    },
    stages: [{ id: 'command', label: 'Prepare interactive Workshop command', status: 'pass', detail: 'Command ready.' }], failedStages: [],
  }) }));
  await page.route('**/api/agent/release/steam/verify', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    success: true, status: 'VERIFIED_AFTER_WORKSHOP_TOOL', platform: 'steam', modId: 'welcome_message', workshopId: 'ws_123456789',
    targetPath: 'C:/fixture/releases/steam/welcome_message', sourceManifestAdoptionRequired: true, sourceManifestAdoptionAvailable: true,
    stages: [{ id: 'post-tool', label: 'Verify Workshop result', status: 'pass', detail: 'Workshop id and payload verified.' }], failedStages: [],
  }) }));
  await page.route('**/api/agent/release/steam/adopt', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    adoptionBodies.push(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.apply === true ? {
      success: true, status: 'VERIFIED_AND_ADOPTED', platform: 'steam', modId: 'welcome_message', sourceManifestPath: 'C:/mods/welcome_message/content.xml',
      workshopId: 'ws_123456789', version: '101', beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64), sourceWritePerformed: true, sourceReimportRequired: true,
      stages: [{ id: 'adoption', label: 'Adopt Workshop metadata into source', status: 'pass', detail: 'Source updated.' }], failedStages: [],
    } : {
      success: true, status: 'READY_TO_ADOPT', platform: 'steam', modId: 'welcome_message', sourceManifestPath: 'C:/mods/welcome_message/content.xml',
      workshopId: 'ws_123456789', version: '101', beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64),
      beforeContent: '<content id="welcome_message" version="100"/>', afterContent: '<content id="ws_123456789" version="101"/>', sourceWritePerformed: false,
      stages: [{ id: 'adoption-preview', label: 'Preview source Workshop metadata adoption', status: 'pass', detail: 'No source write performed.' }], failedStages: [],
    }) });
  });

  await openReleaseCenter(page);
  await page.getByTestId('package-steam-btn').click();
  await page.getByTestId('prepare-steam-btn').click();
  await page.getByTestId('verify-steam-result').click();
  await expect(page.getByTestId('preview-steam-adoption')).toBeVisible();
  await page.getByTestId('preview-steam-adoption').click();
  await expect(page.getByTestId('steam-adoption-result')).toContainText('READY_TO_ADOPT');
  await expect(page.getByTestId('steam-adoption-result')).toContainText('welcome_message');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('confirm-steam-adoption').click();
  await expect(page.getByTestId('steam-adoption-result')).toContainText('VERIFIED_AND_ADOPTED');
  await expect(page.getByTestId('steam-adoption-result')).toContainText('Re-import the source mod');
  expect(adoptionBodies).toHaveLength(2);
  expect(adoptionBodies[0]?.apply).toBe(false);
  expect(adoptionBodies[1]).toMatchObject({ apply: true, expectedSourceSha256: 'a'.repeat(64), expectedWorkshopId: 'ws_123456789' });
});
