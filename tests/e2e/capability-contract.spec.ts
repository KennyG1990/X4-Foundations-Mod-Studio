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
