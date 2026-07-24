import { expect, test, type Page } from '@playwright/test';
import { seedServerWorkspace } from './ephemeral';

/**
 * B31s2: this spec runs against the EPHEMERAL e2e stack (playwright.config.ts) — the
 * fixture is seeded straight into the ephemeral server and the app adopts it on boot.
 * The old page.route isolation harness + restore teardown (the half-isolation behind
 * incident classes B15/#70) is gone by construction: there is no shared state to guard.
 */

type E2EWorkspace = {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  nodes: Array<{
    id: string;
    type: 'cue' | 'event' | 'condition' | 'action' | 'variable' | 'comment';
    label: string;
    xmlTag: string;
    x: number;
    y: number;
    properties: Record<string, unknown>;
    propertiesSchema: unknown[];
    inputs: Array<{ id: string; name: string; type: string }>;
    outputs: Array<{ id: string; name: string; type: string }>;
    includeInBuild?: boolean;
  }>;
  links: Array<{
    id: string;
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
  }>;
  uiWidgets: unknown[];
  uiTheme: {
    backgroundColor: string;
    borderColor: string;
    accentColor: string;
    opacity: number;
    showIcons: boolean;
  };
  compileSettings: {
    md: boolean;
    ui: boolean;
    ai: boolean;
    library: boolean;
    translations: boolean;
    patches: boolean;
  };
};

type E2EWindow = Window & {
  __X4_E2E__?: {
    getWorkspace: () => E2EWorkspace;
    setWorkspace: (workspace: E2EWorkspace) => void;
    getMdCode: () => string;
    resetPerfCounters: () => E2EPerfCounters;
    getPerfCounters: () => E2EPerfCounters;
  };
};

type E2EPerfCounters = {
  generateMDXML: number;
  validateModWorkspace: number;
  bySource: Record<string, number>;
};

const controlledWorkspace: E2EWorkspace = {
  id: 'e2e_canvas',
  name: 'E2E_Canvas',
  version: '1.0.0',
  author: 'Playwright',
  description: 'Canvas interaction harness fixture',
  nodes: [
    {
      id: 'cue_e2e',
      type: 'cue',
      label: 'E2E Cue',
      xmlTag: 'cue',
      x: 140,
      y: 120,
      properties: { name: 'E2E_Cue', namespace: 'this', state: 'active' },
      propertiesSchema: [],
      inputs: [],
      outputs: [
        { id: 'out_cond', name: 'conditions', type: 'flow' },
        { id: 'out_act', name: 'actions', type: 'flow' },
      ],
      includeInBuild: true,
    },
    {
      id: 'event_e2e',
      type: 'event',
      label: 'E2E Event',
      xmlTag: 'event_game_started',
      x: 470,
      y: 110,
      properties: {},
      propertiesSchema: [],
      inputs: [{ id: 'in_cond', name: 'condition', type: 'flow' }],
      outputs: [],
      includeInBuild: true,
    },
    {
      id: 'action_e2e',
      type: 'action',
      label: 'E2E Action',
      xmlTag: 'show_help',
      x: 470,
      y: 340,
      properties: { custom: "'hello'", duration: '5s' },
      propertiesSchema: [],
      inputs: [{ id: 'in_act', name: 'action', type: 'flow' }],
      outputs: [],
      includeInBuild: true,
    },
  ],
  links: [],
  uiWidgets: [],
  uiTheme: {
    backgroundColor: '#111827',
    borderColor: '#06b6d4',
    accentColor: '#0891b2',
    opacity: 0.9,
    showIcons: true,
  },
  compileSettings: { md: true, ui: false, ai: false, library: false, translations: false, patches: false },
};

/** Seed the ephemeral server, boot the app fresh, and wait for natural adoption. */
async function seedWorkspace(page: Page): Promise<void> {
  await seedServerWorkspace(controlledWorkspace);
  await page.addInitScript(() => {
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.removeItem('x4_mod_studio_version');
  });
  await page.goto('/');
  await expect(page.getByTestId('grid-canvas')).toBeVisible();
  await page.waitForFunction(() => !!(window as E2EWindow).__X4_E2E__);
  // The boot poll adopts the seeded server copy (version beats the cleared local state).
  await expect(page.getByTestId('canvas-node-cue_e2e')).toBeVisible();
  await expect(page.getByTestId('canvas-node-action_e2e')).toBeVisible();
}

async function workspace(page: Page): Promise<E2EWorkspace> {
  return page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getWorkspace());
}

async function resetPerfCounters(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as E2EWindow).__X4_E2E__!.resetPerfCounters();
  });
}

async function perfCounters(page: Page): Promise<E2EPerfCounters> {
  return page.evaluate(() => (window as E2EWindow).__X4_E2E__!.getPerfCounters());
}

test('real canvas interactions create oriented links, move groups, add from palette, and avoid per-frame canvas diagnostics', async ({ page }) => {
  let compileRequests = 0;
  // Compile stays mocked: the assertion below is about DEBOUNCE behavior (how often the
  // app compiles), not about the compiler — and mocking keeps the spec fast.
  await page.route('**/api/agent/compile', async (route) => {
    compileRequests += 1;
    await route.fulfill({ json: { diagnostics: [], validation: { scope: 'full-project' } } });
  });

  await seedWorkspace(page);

  await page.waitForTimeout(650);
  compileRequests = 0;

  const cue = page.getByTestId('canvas-node-cue_e2e');
  const event = page.getByTestId('canvas-node-event_e2e');

  await page.getByTestId('canvas-port-cue_e2e-out_act').click();
  await page.getByTestId('canvas-port-action_e2e-in_act').click();
  const afterLink = await workspace(page);
  expect(afterLink.links).toContainEqual(expect.objectContaining({
    sourceNodeId: 'cue_e2e',
    sourcePortId: 'out_act',
    targetNodeId: 'action_e2e',
    targetPortId: 'in_act',
  }));
  await page.waitForTimeout(700);
  compileRequests = 0;

  const beforeDrag = await workspace(page);
  const cueBefore = beforeDrag.nodes.find((node) => node.id === 'cue_e2e')!;
  const eventBefore = beforeDrag.nodes.find((node) => node.id === 'event_e2e')!;
  await resetPerfCounters(page);

  await cue.click({ modifiers: ['Shift'] });
  await event.click({ modifiers: ['Shift'] });
  await cue.dragTo(cue, {
    sourcePosition: { x: 30, y: 20 },
    targetPosition: { x: 110, y: 90 },
    steps: 18,
  });

  const afterGroupDrag = await workspace(page);
  const cueAfter = afterGroupDrag.nodes.find((node) => node.id === 'cue_e2e')!;
  const eventAfter = afterGroupDrag.nodes.find((node) => node.id === 'event_e2e')!;
  expect(cueAfter.x).toBeGreaterThan(cueBefore.x);
  expect(cueAfter.y).toBeGreaterThan(cueBefore.y);
  expect(eventAfter.x - eventBefore.x).toBe(cueAfter.x - cueBefore.x);
  expect(eventAfter.y - eventBefore.y).toBe(cueAfter.y - cueBefore.y);

  const dragPerfCounters = await perfCounters(page);
  expect(dragPerfCounters.bySource['Canvas.lawDiagnostics'] || 0).toBe(0);
  expect(dragPerfCounters.generateMDXML).toBe(0);
  expect(dragPerfCounters.validateModWorkspace).toBe(0);

  await page.waitForTimeout(700);
  const settledPerfCounters = await perfCounters(page);
  expect(settledPerfCounters.bySource['Canvas.lawDiagnostics']).toBe(2);
  expect(settledPerfCounters.generateMDXML).toBe(1);
  expect(settledPerfCounters.validateModWorkspace).toBe(1);
  expect(compileRequests).toBeLessThanOrEqual(2);

  // Right-click a spot that is free canvas at the default 1280px viewport: x=720 was
  // UNDER the docked code-editor <aside> (which fills the panel since the G8 width fix),
  // so the click was intercepted and retried until the 60s timeout (found 2026-07-09).
  // (300, 520) sits below the seeded fixture nodes and left of the code panel.
  await page.getByTestId('grid-canvas').click({
    button: 'right',
    position: { x: 300, y: 520 },
  });
  await expect(page.getByTestId('canvas-quick-spawn')).toBeVisible();
  await page.getByPlaceholder('Search egosoft logic parameters...').fill('reward_player');
  await page.getByTestId('canvas-palette-reward_player').click();
  const afterPaletteAdd = await workspace(page);
  expect(afterPaletteAdd.nodes.some((node) => node.xmlTag === 'reward_player')).toBe(true);
});
