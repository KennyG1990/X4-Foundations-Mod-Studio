import { expect, test } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { seedServerWorkspace } from './ephemeral';

async function bootAndOpenAgentBridge(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as {
    __X4_E2E__?: { getWorkspace: () => { name?: string } };
  }).__X4_E2E__?.getWorkspace().name);
  const healthCard = page.getByTestId('health-card');
  await healthCard.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await healthCard.isVisible()) await page.getByTestId('health-card-dismiss').click();
  await page.getByTestId('studio-menu-button').click();
  await page.getByTestId('studio-menu').locator('[data-global-action="agent-api"]').click();
  await expect(page.getByTestId('agent-bridge')).toBeVisible();
}

test('Agent API Bridge renders the live canonical capability contract', async ({ page }) => {
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  await bootAndOpenAgentBridge(page);

  const banner = page.getByTestId('agent-capability-contract');
  await expect(banner).toHaveAttribute('data-contract-source', 'live');
  await expect(banner).toHaveAttribute('data-contract-version', 'forge.capability.v1');
  await expect(banner).toHaveAttribute('data-capability-count', '11');

  const contract = await page.evaluate(async () => {
    const response = await fetch('/api/agent/schema');
    const schema = await response.json();
    return schema.capability_contract;
  });
  expect(contract.contractHash).toMatch(/^[a-f0-9]{64}$/);
  expect(new Set(contract.capabilities.map((capability: { id: string }) => capability.id)).size).toBe(11);
  await expect(banner).toContainText(contract.contractHash.slice(0, 12));
  await expect(banner).toContainText('LIVE CONTRACT');
  await page.screenshot({ path: 'test-results/capability-contract-live.png', fullPage: true });
});

test('Agent API Bridge labels old-server discovery as a local catalog with unknown server support', async ({ page }) => {
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  await page.route('**/api/agent/schema', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ api_version: 'legacy.agent.v0' }),
  }));
  await bootAndOpenAgentBridge(page);

  const banner = page.getByTestId('agent-capability-contract');
  await expect(banner).toHaveAttribute('data-contract-source', 'legacy');
  await expect(banner).toHaveAttribute('data-catalog-scope', 'local');
  await expect(banner).toHaveAttribute('data-contract-version', 'forge.capability.v1');
  await expect(banner).toHaveAttribute('data-capability-count', '11');
  await expect(banner).toContainText('Server capabilities unknown');
  await expect(banner).toContainText('LEGACY SERVER');
});

test('Agent API Bridge rejects a malformed current contract without claiming live support', async ({ page }) => {
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  await page.route('**/api/agent/schema', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      api_version: '2026-07-30.agent.v4',
      capability_contract: {
        schemaVersion: 'forge.capability.v1',
        contractHash: '0'.repeat(64),
        capabilities: [{ id: 'project.validate', version: 1, effects: [], apiBindings: [], surfaces: {} }],
      },
    }),
  }));
  await bootAndOpenAgentBridge(page);

  const banner = page.getByTestId('agent-capability-contract');
  await expect(banner).toHaveAttribute('data-contract-source', 'invalid');
  await expect(banner).toHaveAttribute('data-catalog-scope', 'local');
  await expect(banner).toContainText('Server capabilities unknown');
  await expect(banner).toContainText('INVALID CONTRACT');
  await page.screenshot({ path: 'test-results/capability-contract-invalid.png', fullPage: true });
});

test('Agent Keys guides an exact contract-only key and proves its effective subset', async ({ page }) => {
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  await bootAndOpenAgentBridge(page);
  await page.getByTestId('agent-keys-tab').click();

  const customToggle = page.getByTestId('agent-key-custom-toggle');
  await expect(customToggle).toBeEnabled();
  await expect(customToggle.locator('xpath=..')).toContainText('protected Agent API routes without a canonical contract stop working');
  await customToggle.check();
  const panel = page.getByTestId('agent-key-custom-authority');
  await expect(panel).toBeVisible();
  await expect(customToggle.locator('xpath=..')).toContainText('Change it later by revoking and recreating the key');

  for (const identity of [
    'extensions.conflicts.analyze@1',
    'history.list@1',
    'readiness.read@1',
    'workspace.compile@1',
    'workspace.read@2',
  ]) {
    await page.getByTestId(`agent-key-capability-${identity}`).uncheck();
  }
  await expect(page.getByTestId('agent-key-capability-project.validate@1')).toBeChecked();
  for (const effect of ['read', 'analyze', 'audit-write', 'audit-retention-delete']) {
    await expect(page.getByTestId(`agent-key-effect-${effect}`)).toBeChecked();
  }

  const label = `e2e-contract-${Date.now()}`;
  await page.getByTestId('agent-key-label').fill(label);
  await page.getByTestId('agent-key-create').click();
  const reveal = page.getByTestId('agent-key-reveal');
  await expect(reveal).toBeVisible();
  await expect(page.getByTestId('agent-key-created-contract-only')).toContainText('noncanonical protected routes are denied');
  const token = (await reveal.locator('code').first().textContent())?.trim() || '';
  expect(token).toMatch(/^x4fk_[a-f0-9]{64}$/);

  const row = await page.evaluate(async (label) => {
    const keysResponse = await fetch('/api/agent/keys');
    const keys = await keysResponse.json();
    return keys.keys.find((candidate: { label?: string }) => candidate.label === label);
  }, label);
  const effectiveResponse = await page.request.get('/api/agent/capabilities/effective', {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-workspace-id': row.workspaceId,
    },
  });
  const effectiveBody = await effectiveResponse.json();
  expect(effectiveResponse.status()).toBe(200);
  expect(effectiveBody.capability_contract.capabilities.map((capability: { id: string }) => capability.id)).toEqual([
    'project.validate', 'schema.domains.list', 'schema.element.explain',
  ]);
  expect(effectiveBody.constraint).toEqual({
    capabilityIdentities: ['project.validate@1'],
    allowedEffects: ['read', 'analyze', 'audit-write', 'audit-retention-delete'],
  });
  expect(row.capabilityConstraint).toEqual(effectiveBody.constraint);
  await expect(page.getByTestId(`agent-key-contract-${label}`)).toContainText('contract-only · 1 cap · 4 effects');
  const healthCard = page.getByTestId('health-card');
  if (await healthCard.isVisible()) await page.getByTestId('health-card-dismiss').click();
  await page.screenshot({ path: 'test-results/b118-agent-key-custom-authority.png', fullPage: true });
});

test('Agent Keys revokes a mismatched mint instead of exposing a broader key', async ({ page }) => {
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  let mintedToken = '';
  let mintedId = '';
  await page.route('**/api/agent/keys', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const original = await route.fetch();
    const body = await original.json();
    mintedToken = String(body.token || '');
    mintedId = String(body.record?.id || '');
    await route.fulfill({
      response: original,
      json: {
        ...body,
        record: {
          ...body.record,
          authorityMode: 'preset',
          capabilityConstraint: undefined,
        },
      },
    });
  });
  await bootAndOpenAgentBridge(page);
  await page.getByTestId('agent-keys-tab').click();
  await page.getByTestId('agent-key-custom-toggle').check();
  const label = `e2e-mismatched-contract-${Date.now()}`;
  await page.getByTestId('agent-key-label').fill(label);
  await page.getByTestId('agent-key-create').click();

  await expect(page.getByTestId('agent-key-error')).toContainText('did not confirm the requested exact key authority');
  await expect(page.getByTestId('agent-key-error')).toContainText('revoked automatically');
  await expect(page.getByTestId('agent-key-reveal')).toHaveCount(0);
  expect(mintedToken).toMatch(/^x4fk_[a-f0-9]{64}$/);
  expect(mintedId).toMatch(/^key_/);
  await expect(page.locator('body')).not.toContainText(mintedToken);

  const row = await page.evaluate(async (keyId) => {
    const response = await fetch('/api/agent/keys');
    const body = await response.json();
    return body.keys.find((candidate: { id?: string }) => candidate.id === keyId);
  }, mintedId);
  expect(row.revokedAt).toEqual(expect.any(Number));
  expect(row.capabilityConstraint).toBeTruthy();
});
