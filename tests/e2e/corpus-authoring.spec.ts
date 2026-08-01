import { expect, test } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { readServerWorkspace, readServerWorkspaceEnvelope, seedServerWorkspace } from './ephemeral';

const targetFiles = [
  'assets/units/size_xl/macros/ship_test_a.xml',
  'assets/units/size_xl/macros/ship_test_b.xml',
  'assets/units/size_xl/macros/helper_without_hull.xml',
];

test.setTimeout(180_000);
test.use({ viewport: { width: 1920, height: 1080 } });

test('corpus authoring blocks collisions, completes XPath, previews, applies, and undoes atomically', async ({ page }) => {
  const workspace = { ...buildTemplateWorkspace('welcome'), wares: [], jobs: [], xmlPatches: [] };
  await seedServerWorkspace(workspace);
  await page.addInitScript(() => {
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.removeItem('x4_mod_studio_version');
  });

  await page.route('**/api/reference/suggest**', async route => {
    const url = new URL(route.request().url());
    const query = (url.searchParams.get('q') || '').toLowerCase();
    const kind = url.searchParams.get('kind') || 'ware';
    // Keep the normal picker lookup slower than a human click so the test proves the
    // commit-time authority check, rather than merely observing the debounced badge.
    if (query === 'energycells') await new Promise(resolve => setTimeout(resolve, 300));
    const catalog: Record<string, Array<{ id: string; name: string; path: string; selector?: string }>> = {
      ware: [{ id: 'energycells', name: 'Energy Cells', path: 'libraries/wares.xml', selector: "/wares/ware[@id='energycells']" }],
      faction: [{ id: 'argon', name: 'Argon Federation', path: 'libraries/factions.xml', selector: "/factions/faction[@id='argon']" }],
      aiscript: [{ id: 'order.patrol', name: 'Order Patrol', path: 'aiscripts/order.patrol.xml' }],
      macro: [{ id: 'ship_arg_l_destroyer_01_a_macro', name: 'Argon Destroyer', path: 'index/macros.xml' }],
    };
    const items = (catalog[kind] || [])
      .filter(item => query.length > 0 && item.id.toLowerCase().includes(query))
      .map(item => ({
        label: item.id, insertText: item.id, kind, name: item.name,
        detail: `${item.name} · base`, documentation: `${item.id} already exists in base`,
        source: 'base', path: item.path, selector: item.selector, exists: true, score: 0,
      }));
    await route.fulfill({ json: { generation: 'e2e', kind, query, intent: url.searchParams.get('intent'), items } });
  });

  await page.route('**/api/reference/manifest**', async route => {
    await route.fulfill({
      json: {
        status: { available: true, state: 'ready' }, generation: 'e2e-corpus', total: targetFiles.length,
        limit: 100, offset: 0,
        files: targetFiles.map((file, index) => ({ path: file, source: index ? 'ego_dlc_test' : 'base', extension: '.xml', bytes: 10_000 - index })),
      },
    });
  });

  await page.route('**/api/reference/xpath-complete', async route => {
    const body = route.request().postDataJSON() as { selector: string; cursor: number };
    const partial = body.selector.slice(0, body.cursor).match(/[A-Za-z_][\w.:-]*$/)?.[0] || '';
    await route.fulfill({
      json: {
        path: targetFiles[0], signature: 'e2e-source', sources: [{ source: 'base', mode: 'base' }], findings: [],
        items: partial.toLowerCase().startsWith('h')
          ? [{ label: 'hull', kind: 'Element', detail: 'Child of /macros/macro/properties', insertText: 'hull', replaceStart: body.cursor - partial.length, replaceEnd: body.cursor }]
          : [],
      },
    });
  });

  const planFor = async (rule: Record<string, unknown>) => {
    const envelope = await readServerWorkspaceEnvelope();
    const operations = Array.isArray(rule.operations) && rule.operations.length
      ? rule.operations as Array<{ id: string; selector: string }>
      : [{ id: 'operation-1', selector: String(rule.selector) }];
    const changesFor = (fileIndex: number) => operations.map((operation, operationIndex) => ({
      operationId: operation.id,
      selector: operation.selector,
      oldValue: operationIndex ? String(10 + fileIndex) : (fileIndex ? '210000' : '216000'),
      newValue: operationIndex ? String(15 + fileIndex) : (fileIndex ? '315000' : '324000'),
    }));
    const rows = targetFiles.slice(0, 2).flatMap((targetFile, fileIndex) => changesFor(fileIndex).map((change, operationIndex) => ({
      targetFile, selector: change.selector, oldValue: change.oldValue, newValue: change.newValue,
      sourceSignature: `e2e-source-${fileIndex}`,
      sources: [{ source: fileIndex ? 'ego_dlc_test' : 'base', mode: fileIndex ? 'diff' : 'base' }],
      simulationOk: true, findings: [],
      patch: {
        id: `bulk_e2e_${fileIndex}_${operationIndex}`, sel: change.selector, action: 'replace',
        content: change.newValue, note: 'Bulk bundle transform from canonical value',
        targetFile, includeInBuild: true, generatedRuleId: 'bulk-e2e', generatedPlanHash: 'plan-e2e', sourceSignature: `e2e-source-${fileIndex}`,
      },
    })));
    return {
      ok: true, rule, ruleId: 'bulk-e2e', planHash: 'plan-e2e', corpusGeneration: 'e2e-corpus',
      candidateCount: 3, matchedFiles: 2, skippedFiles: 1, droppedCount: 0,
      rows,
      files: [
        ...targetFiles.slice(0, 2).map((targetFile, fileIndex) => {
          const changes = changesFor(fileIndex);
          return {
            targetFile, status: 'matched', matchCount: changes.length,
            oldValue: changes[0].oldValue, newValue: changes[0].newValue, changes,
            sourceSignature: `e2e-source-${fileIndex}`,
            sources: [{ source: fileIndex ? 'ego_dlc_test' : 'base', mode: fileIndex ? 'diff' : 'base' }],
            simulationOk: true, findings: [],
          };
        }),
        {
          targetFile: targetFiles[2], status: 'skipped', matchCount: 0,
          sourceSignature: 'e2e-source-2', sources: [{ source: 'base', mode: 'base' }], findings: [],
        },
      ],
      conflicts: [], findings: [], workspaceHash: envelope.workspaceHash,
    };
  };

  await page.route('**/api/agent/bulk-transform/preview', async route => {
    const body = route.request().postDataJSON() as { rule: Record<string, unknown> };
    await route.fulfill({ status: 200, json: await planFor(body.rule) });
  });

  await page.route('**/api/agent/bulk-transform/apply', async route => {
    const body = route.request().postDataJSON() as { rule: Record<string, unknown>; expectedPlanHash: string; expectedHead: string };
    const before = await readServerWorkspaceEnvelope();
    expect(body.expectedPlanHash).toBe('plan-e2e');
    expect(body.expectedHead).toBe(before.workspaceHash);
    const plan = await planFor(body.rule);
    const patched = { ...before.workspace, xmlPatches: plan.rows.map(row => row.patch) };
    await seedServerWorkspace(patched);
    const after = await readServerWorkspaceEnvelope();
    await route.fulfill({ status: 200, json: { success: true, applied: true, added: plan.rows.length, plan, ...after } });
  });

  await page.goto('/');
  await page.waitForFunction((name: string) => {
    const api = (window as Window & { __X4_E2E__?: { getWorkspace: () => { name?: string } } }).__X4_E2E__;
    return api?.getWorkspace().name === name;
  }, workspace.name);

  const healthCard = page.getByTestId('health-card');
  await healthCard.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
  if (await healthCard.isVisible()) await page.getByTestId('health-card-dismiss').click();

  await page.locator('button[title="Wares & Jobs"]').click();
  await page.getByRole('button', { name: 'ADD', exact: true }).click();
  const newWare = page.getByPlaceholder('ware_antimatter_capsules');
  await newWare.fill('energycells');
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Checking…', exact: true })).toBeVisible();
  await expect(page.getByText('"energycells" already exists in the X4 corpus. Patch the existing definition instead.', { exact: true })).toBeVisible();
  await expect(page.getByText('EXISTS', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add', exact: true }).last()).toBeDisabled();
  await page.getByRole('button', { name: 'Patch existing energycells', exact: true }).click();
  await expect(page.getByText("Patch existing: /wares/ware[@id='energycells']", { exact: true })).toBeVisible();
  expect((await readServerWorkspace()).wares).toHaveLength(0);

  // A true reference field has the opposite behavior: partial canonical text completes
  // to the existing ID and stores it. Exercise this separately from the new-definition
  // collision rail so both semantics stay proven.
  await page.locator('button[title="Wares & Jobs"]').click();
  await page.getByRole('button', { name: 'ADD', exact: true }).click();
  await page.getByPlaceholder('ware_antimatter_capsules').fill('forge_test_ware');
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await expect.poll(async () => (await readServerWorkspace()).wares?.length || 0, { timeout: 30_000 }).toBe(1);
  await page.getByRole('button', { name: 'Add input', exact: true }).click();
  const wareReference = page.getByPlaceholder('Search ware…');
  await wareReference.fill('energyc');
  await page.locator('button').filter({ hasText: 'energycells' }).filter({ hasText: 'base' }).click();
  await expect(wareReference).toHaveValue('energycells');
  await expect.poll(async () => (await readServerWorkspace()).wares?.[0]?.primaryWares?.[0]?.ware || '', { timeout: 30_000 }).toBe('energycells');

  await page.getByRole('button', { name: 'jobs.xml', exact: true }).click();
  await page.getByRole('button', { name: 'ADD', exact: true }).click();
  await page.getByPlaceholder('job_trader_hauler').fill('forge_test_job');
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await expect.poll(async () => (await readServerWorkspace()).jobs?.length || 0, { timeout: 30_000 }).toBe(1);
  const factionReference = page.getByPlaceholder('Search factions… (stores the short code)');
  await factionReference.fill('arg');
  await page.locator('button').filter({ hasText: 'argon' }).filter({ hasText: 'base' }).click();
  await expect(factionReference).toHaveValue('argon');
  const scriptReference = page.getByPlaceholder('Search canonical/project AI scripts…');
  await scriptReference.fill('order.pat');
  await page.locator('button').filter({ hasText: 'order.patrol' }).filter({ hasText: 'base' }).click();
  await expect(scriptReference).toHaveValue('order.patrol');
  const macroReference = page.getByPlaceholder('Search canonical ship macros…');
  await macroReference.fill('ship_arg_l_des');
  await page.locator('button').filter({ hasText: 'ship_arg_l_destroyer_01_a_macro' }).filter({ hasText: 'base' }).click();
  await expect(macroReference).toHaveValue('ship_arg_l_destroyer_01_a_macro');
  await expect.poll(async () => {
    const job = (await readServerWorkspace()).jobs?.[0];
    return `${job?.faction}|${job?.taskScript}|${job?.shipMacro}`;
  }, { timeout: 30_000 }).toBe('argon|order.patrol|ship_arg_l_destroyer_01_a_macro');

  await page.locator('button[title="XML Patching"]').click();
  await page.getByRole('button', { name: 'Bulk transform', exact: true }).click();
  await expect(page.getByText(`sample: ${targetFiles[0]}`, { exact: true })).toBeVisible();
  const selector = page.getByTestId('bulk-selector');
  await selector.fill('/macros/macro/properties/h');
  await page.getByRole('button', { name: /hull.*Element/i }).click();
  await expect(selector).toHaveValue('/macros/macro/properties/hull');
  await selector.fill('/macros/macro/properties/hull/@max');
  await page.getByTestId('bulk-rounding').selectOption('ceil');
  await page.getByTestId('bulk-rounding-increment').fill('1000');
  await page.getByTestId('bulk-add-operation').click();
  await page.getByTestId('bulk-selector-1').fill('/macros/macro/properties/recharge/@rate');
  await page.getByTestId('bulk-operation-1').selectOption('add');
  await page.getByLabel('Field 2 operand').fill('5');

  const beforePreview = await readServerWorkspaceEnvelope();
  await page.getByRole('button', { name: 'Preview against corpus', exact: true }).click();
  await expect(page.getByText('2 VALIDATED', { exact: true })).toBeVisible();
  await expect(page.getByText('2 fields').first()).toBeVisible();
  await page.getByText(targetFiles[0], { exact: true }).click();
  await expect(page.getByText('combined atomic preview', { exact: false })).toBeVisible();
  await expect(page.getByText('216000')).toBeVisible();
  await expect(page.getByText('324000')).toBeVisible();
  await expect(page.getByText('0 matches', { exact: true })).toBeVisible();
  await expect(page.getByText('SKIP', { exact: true })).toBeVisible();
  const afterPreview = await readServerWorkspaceEnvelope();
  expect(afterPreview.workspaceHash).toBe(beforePreview.workspaceHash);
  expect(afterPreview.version).toBe(beforePreview.version);

  // The startup walkaround fetch is intentionally independent of this workflow and may
  // resolve after the initial 1.5 s dismissal probe on slower full-suite runs. Exercise
  // its real dismiss control again instead of forcing a click through the visible card.
  if (await healthCard.isVisible()) await page.getByTestId('health-card-dismiss').click();
  await page.getByRole('button', { name: 'Add 4 validated field patches to workspace', exact: true }).click();
  await expect.poll(async () => (await readServerWorkspace()).xmlPatches?.length || 0).toBe(4);
  await expect(page.locator('button[title="Undo last action (Ctrl+Z)"]')).toBeEnabled();
  await page.locator('button[title="Undo last action (Ctrl+Z)"]').click();
  await expect.poll(async () => (await readServerWorkspace()).xmlPatches?.length || 0, { timeout: 20_000 }).toBe(0);
});
