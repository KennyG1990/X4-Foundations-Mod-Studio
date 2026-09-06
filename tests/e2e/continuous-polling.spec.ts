import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { workspaceContentHash, workspaceSnapshotHash } from '../../src/lib/workspaceIdentity';
import { sanitizeWorkspace } from '../../src/types';
import { readServerWorkspaceEnvelope, seedServerWorkspace } from './ephemeral';
import {
  buildLargeWorkspace,
  LARGE_WORKSPACE_LINK_COUNT,
  LARGE_WORKSPACE_NODE_COUNT,
  LARGE_WORKSPACE_SNAPSHOT_BYTES,
  serializedWorkspaceBytes,
} from './fixtures/largeWorkspace';

type PollSnapshot = {
  timerArmed: boolean;
  resources: Array<{ resourceKey: string; subscribers: number; running: boolean }>;
};

type PollWindow = Window & {
  __X4_FETCH_COUNTS__?: Record<string, number>;
  __X4_FETCH_METRICS__?: Array<{ path: string; status: number; declaredContentLength: number }>;
  __X4_RENDER_PROBE__?: {
    reset: () => void;
    snapshot: () => { maxHeartbeatGapMs: number; worstLongTaskMs: number; ticks: number };
  };
  __X4_CONTINUOUS_POLLING__?: { snapshot: () => PollSnapshot };
  __X4_E2E__?: {
    getWorkspace: () => {
      id?: string;
      name?: string;
      description?: string;
      nodes?: Array<{ type?: string; properties?: Record<string, unknown> }>;
      uiTheme?: { accentColor?: string };
    };
    setWorkspace: (workspace: unknown) => void;
    setWorkspaceDirtyForTest: (dirty: boolean) => void;
  };
};

async function bootWithFetchCounts(
  page: import('@playwright/test').Page,
  options: { dismissHealthCard?: boolean } = {},
): Promise<void> {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    const pollWindow = window as unknown as PollWindow;
    pollWindow.__X4_FETCH_COUNTS__ = {};
    pollWindow.__X4_FETCH_METRICS__ = [];
    let lastHeartbeat = performance.now();
    let maxHeartbeatGapMs = 0;
    let worstLongTaskMs = 0;
    let ticks = 0;
    window.setInterval(() => {
      const now = performance.now();
      maxHeartbeatGapMs = Math.max(maxHeartbeatGapMs, now - lastHeartbeat);
      lastHeartbeat = now;
      ticks += 1;
    }, 50);
    try {
      if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) worstLongTaskMs = Math.max(worstLongTaskMs, entry.duration);
        }).observe({ entryTypes: ['longtask'] });
      }
    } catch { /* Chromium without longtask support keeps the heartbeat measurement. */ }
    pollWindow.__X4_RENDER_PROBE__ = {
      reset: () => {
        lastHeartbeat = performance.now();
        maxHeartbeatGapMs = 0;
        worstLongTaskMs = 0;
        ticks = 0;
      },
      snapshot: () => ({ maxHeartbeatGapMs, worstLongTaskMs, ticks }),
    };
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = new URL(raw, location.origin).pathname;
      pollWindow.__X4_FETCH_COUNTS__![path] = (pollWindow.__X4_FETCH_COUNTS__![path] || 0) + 1;
      const response = await nativeFetch(input, init);
      pollWindow.__X4_FETCH_METRICS__!.push({
        path,
        status: response.status,
        declaredContentLength: Number(response.headers.get('content-length') || 0),
      });
      return response;
    }) as typeof window.fetch;
  });
  await page.goto('/');
  await page.waitForFunction(() => {
    const pollWindow = window as unknown as PollWindow;
    return !!pollWindow.__X4_E2E__?.getWorkspace().name && !!pollWindow.__X4_CONTINUOUS_POLLING__;
  });
  // Startup-conflict fixtures deliberately raise the modal before this helper returns.
  // Do not ask Playwright to click an unrelated card through that authoritative overlay.
  if (options.dismissHealthCard === false) return;
  const healthCard = page.getByTestId('health-card');
  await healthCard.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await healthCard.isVisible()) await page.getByTestId('health-card-dismiss').click();
}

async function openAgentBridge(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('studio-menu-button').click();
  await page.getByTestId('studio-menu').locator('[data-global-action="agent-api"]').click();
  await expect(page.getByText('AI Agent API Bridge')).toBeVisible();
}

async function seedScopedWorkspaceOnce(
  page: import('@playwright/test').Page,
  envelope: { workspaceId: string; workspace: unknown; version: number },
): Promise<void> {
  await page.addInitScript(({ workspaceId, workspace, version }) => {
    const marker = `__x4_e2e_scoped_seeded:${workspaceId}`;
    if (sessionStorage.getItem(marker) === '1') return;
    localStorage.setItem(`x4_mod_studio_workspace:${workspaceId}`, JSON.stringify(workspace));
    localStorage.setItem(`x4_mod_studio_version:${workspaceId}`, String(version));
    sessionStorage.setItem(marker, '1');
  }, envelope);
}

async function workspaceSubscribers(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const resource = (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().resources
      .find(item => item.resourceKey.startsWith('workspace:'));
    return resource?.subscribers || 0;
  });
}

async function renderedCanvasNodeCount(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('[data-testid^="canvas-node-"]').count();
}

async function rendererProbe(page: import('@playwright/test').Page): Promise<{ maxHeartbeatGapMs: number; worstLongTaskMs: number; ticks: number }> {
  return (await page.evaluate(() => (window as unknown as PollWindow).__X4_RENDER_PROBE__?.snapshot()))
    || { maxHeartbeatGapMs: 0, worstLongTaskMs: 0, ticks: 0 };
}

async function bootstrapResourceBytes(page: import('@playwright/test').Page): Promise<{
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  declaredContentLength: number;
}> {
  return page.evaluate(() => {
    const resource = performance.getEntriesByType('resource')
      .filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming)
      .find(entry => new URL(entry.name).pathname === '/api/agent/workspaces/bootstrap');
    const declared = (window as unknown as PollWindow).__X4_FETCH_METRICS__
      ?.find(item => item.path === '/api/agent/workspaces/bootstrap')?.declaredContentLength || 0;
    return {
      transferSize: resource?.transferSize || 0,
      encodedBodySize: resource?.encodedBodySize || 0,
      decodedBodySize: resource?.decodedBodySize || 0,
      declaredContentLength: declared,
    };
  });
}

async function pointerCloseMeasurement(page: import('@playwright/test').Page): Promise<{
  closeMs: number;
  probe: { maxHeartbeatGapMs: number; worstLongTaskMs: number; ticks: number };
}> {
  await expect.poll(() => workspaceSubscribers(page)).toBe(2);
  const close = page.getByRole('button', { name: 'Close Agent API Bridge' });
  const bounds = await close.boundingBox();
  expect(bounds).not.toBeNull();
  // Resolve coordinates before starting the product-interaction measurement. With a
  // dense canvas, Playwright's traced boundingBox() call serializes the large DOM and
  // can itself occupy the renderer for ~5s; that harness setup is not drawer-close work.
  await page.evaluate(() => (window as unknown as PollWindow).__X4_RENDER_PROBE__?.reset());
  const started = Date.now();
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await expect(page.getByText('AI Agent API Bridge')).toBeHidden({ timeout: 5_000 });
  const closeMs = Date.now() - started;
  await expect.poll(async () => (await rendererProbe(page)).ticks).toBeGreaterThan(0);
  const probe = await rendererProbe(page);
  expect(closeMs).toBeLessThan(5_000);
  expect(probe.maxHeartbeatGapMs).toBeLessThan(5_000);
  expect(probe.worstLongTaskMs).toBeLessThan(5_000);
  await expect.poll(() => workspaceSubscribers(page)).toBe(1);
  return { closeMs, probe };
}

async function attachMeasurement(testInfo: import('@playwright/test').TestInfo, name: string, value: unknown): Promise<void> {
  const evidenceDir = path.resolve(process.cwd(), 'test-results', 'b116');
  const evidencePath = path.join(evidenceDir, `${name}.json`);
  const body = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(evidencePath, body);
  await testInfo.attach(`${name}.json`, {
    path: evidencePath,
    contentType: 'application/json',
  });
}

test('B116 fixture keeps graph and snapshot pressure deterministic', async () => {
  const sparse = buildLargeWorkspace({ layout: 'sparse', snapshotBytes: LARGE_WORKSPACE_SNAPSHOT_BYTES });
  const dense = buildLargeWorkspace({ layout: 'dense' });
  expect(sparse.nodes).toHaveLength(LARGE_WORKSPACE_NODE_COUNT);
  expect(sparse.links).toHaveLength(LARGE_WORKSPACE_LINK_COUNT);
  expect(serializedWorkspaceBytes(sparse)).toBe(LARGE_WORKSPACE_SNAPSHOT_BYTES);
  expect(dense.nodes).toHaveLength(LARGE_WORKSPACE_NODE_COUNT);
  expect(dense.links).toHaveLength(LARGE_WORKSPACE_LINK_COUNT);
  expect(serializedWorkspaceBytes(dense)).toBeLessThan(LARGE_WORKSPACE_SNAPSHOT_BYTES);
});

test('bootstrap snapshot digest mismatch fails before rendering an untrusted workspace', async ({ page }) => {
  const workspace = buildTemplateWorkspace('welcome');
  await page.route('**/api/agent/workspaces/bootstrap', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      workspaceId: 'ws_ffffffffffffffffffffffff',
      workspace,
      version: 1,
      workspaceHash: workspaceContentHash(sanitizeWorkspace(workspace)),
      snapshotHash: 'deliberately-wrong',
      clientId: 'client_e2e_fixture_0001',
    }),
  }));
  await page.goto('/');
  await expect(page.locator('#root')).toContainText('hash-mismatched snapshot');
  expect(await page.evaluate(() => Boolean((window as unknown as PollWindow).__X4_E2E__))).toBe(false);
});

test('equal-version unmarked local divergence is retained and conflicts without overwriting server', async ({ page }) => {
  const serverWorkspace = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(serverWorkspace);
  const envelope = await readServerWorkspaceEnvelope();
  const localWorkspace = sanitizeWorkspace({
    ...envelope.workspace,
    uiTheme: { ...envelope.workspace.uiTheme, accentColor: '#abcdef' },
  });
  expect(workspaceContentHash(localWorkspace)).toBe(envelope.workspaceHash);
  expect(workspaceSnapshotHash(localWorkspace)).not.toBe(envelope.snapshotHash);
  await seedScopedWorkspaceOnce(page, { workspaceId: envelope.workspaceId, workspace: localWorkspace, version: envelope.version });
  await bootWithFetchCounts(page, { dismissHealthCard: false });
  expect(await page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().uiTheme?.accentColor
  )).toBe('#abcdef');
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0
  ), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('sync-conflict-dialog')).toBeVisible({ timeout: 10_000 });
  const preserved = await readServerWorkspaceEnvelope();
  expect(preserved.workspace.uiTheme?.accentColor).toBe(serverWorkspace.uiTheme?.accentColor);
  expect(preserved.workspace.description).toBe(serverWorkspace.description);
});

test('successful local autosave persists the matching scoped workspace before reload', async ({ page }) => {
  test.setTimeout(45_000);
  const initial = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(initial);
  const envelope = await readServerWorkspaceEnvelope();
  await seedScopedWorkspaceOnce(page, envelope);
  await bootWithFetchCounts(page);

  const editedDescription = 'B116 scoped cache and server must advance as one pair.';
  await page.evaluate(description => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description });
  }, editedDescription);
  await expect.poll(async () => (await readServerWorkspaceEnvelope()).workspace.description, {
    timeout: 20_000,
  }).toBe(editedDescription);
  const saved = await readServerWorkspaceEnvelope();
  const scoped = await page.evaluate(workspaceId => ({
    workspace: localStorage.getItem(`x4_mod_studio_workspace:${workspaceId}`),
    version: localStorage.getItem(`x4_mod_studio_version:${workspaceId}`),
  }), envelope.workspaceId);
  expect(JSON.parse(String(scoped.workspace)).description).toBe(editedDescription);
  expect(Number(scoped.version)).toBe(Number(saved.version));

  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name));
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().description)).toBe(editedDescription);
});

test('failed local autosave retries without another edit and persists the recovered scoped pair', async ({ page }) => {
  test.setTimeout(60_000);
  const initial = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(initial);
  const envelope = await readServerWorkspaceEnvelope();
  await seedScopedWorkspaceOnce(page, envelope);
  await bootWithFetchCounts(page);

  let failedPosts = 0;
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() === 'POST' && failedPosts < 4) {
      failedPosts += 1;
      await route.abort('failed');
      return;
    }
    await route.fallback();
  });
  const editedDescription = 'B116 retry must recover this edit without another keystroke.';
  await page.evaluate(description => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description });
  }, editedDescription);
  await expect.poll(() => failedPosts, { timeout: 10_000 }).toBe(4);
  await expect.poll(async () => (await readServerWorkspaceEnvelope()).workspace.description, {
    timeout: 35_000,
  }).toBe(editedDescription);

  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name));
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().description)).toBe(editedDescription);
});

test('failed local autosave preserves the scoped draft across reload before server recovery', async ({ page }) => {
  test.setTimeout(40_000);
  const initial = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(initial);
  const envelope = await readServerWorkspaceEnvelope();
  await seedScopedWorkspaceOnce(page, envelope);
  await bootWithFetchCounts(page);

  let failedPosts = 0;
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() === 'POST') {
      failedPosts += 1;
      await route.abort('failed');
      return;
    }
    await route.fallback();
  });
  const editedDescription = 'B116 unsaved scoped draft must survive a failed-network reload.';
  await page.evaluate(description => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description });
  }, editedDescription);
  await expect.poll(() => failedPosts, { timeout: 10_000 }).toBeGreaterThanOrEqual(4);
  await page.evaluate(() => {
    localStorage.setItem('x4_mod_studio_aiscripts', JSON.stringify([{ name: 'legacy-global-must-not-touch-scoped-draft' }]));
  });
  const beforeReload = await readServerWorkspaceEnvelope();
  expect(beforeReload.workspace.description).toBe(initial.description);
  const scopedBeforeReload = await page.evaluate(workspaceId => ({
    workspace: localStorage.getItem(`x4_mod_studio_workspace:${workspaceId}`),
    version: localStorage.getItem(`x4_mod_studio_version:${workspaceId}`),
  }), envelope.workspaceId);
  expect(JSON.parse(String(scopedBeforeReload.workspace)).description).toBe(editedDescription);
  expect(Number(scopedBeforeReload.version)).toBe(Number(envelope.version));

  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name));
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().description)).toBe(editedDescription);
  const afterReload = await readServerWorkspaceEnvelope();
  expect(afterReload.workspace.description).toBe(initial.description);
});

test('newer server bootstrap cannot silently replace a failed scoped draft', async ({ page }) => {
  test.setTimeout(50_000);
  const initial = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(initial);
  const envelope = await readServerWorkspaceEnvelope();
  await seedScopedWorkspaceOnce(page, envelope);
  await bootWithFetchCounts(page);

  let failedPosts = 0;
  const abortWorkspaceWrites = async (route: import('@playwright/test').Route) => {
    if (route.request().method() === 'POST') {
      failedPosts += 1;
      await route.abort('failed');
      return;
    }
    await route.fallback();
  };
  await page.route('**/api/agent/workspace', abortWorkspaceWrites);
  const editedDescription = 'B116 failed draft must survive a newer external bootstrap.';
  await page.evaluate(description => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description });
  }, editedDescription);
  await expect.poll(() => failedPosts, { timeout: 10_000 }).toBeGreaterThanOrEqual(4);
  await page.evaluate(() => {
    localStorage.setItem('x4_mod_studio_aiscripts', JSON.stringify([{ name: 'legacy-global-must-not-invalidate-marked-draft' }]));
  });

  const workspaceIdBeforeSwitch = await page.evaluate(() => window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || '');
  await page.getByTestId('workspace-switcher').selectOption('__new');
  await expect(page.getByText('This workspace has unsaved or unresolved changes. Save or resolve them before switching workspaces; nothing was changed.')).toBeVisible();
  expect(await page.evaluate(() => window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || '')).toBe(workspaceIdBeforeSwitch);

  const remote = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_Newer_Remote_Bootstrap',
    description: 'Remote state must remain authoritative until explicit reconciliation.',
  });
  await seedServerWorkspace(remote);
  await page.unroute('**/api/agent/workspace', abortWorkspaceWrites);
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name));
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().description)).toBe(editedDescription);
  await expect(page.getByTestId('sync-conflict-dialog')).toBeVisible({ timeout: 10_000 });
  const preservedRemote = await readServerWorkspaceEnvelope();
  expect(preservedRemote.workspace.name).toBe(remote.name);
  expect(preservedRemote.workspace.description).toBe(remote.description);
});

test('pre-marker divergent scoped cache is conservatively retained against a newer bootstrap', async ({ page }) => {
  test.setTimeout(35_000);
  const initial = sanitizeWorkspace(buildTemplateWorkspace('welcome'));
  await seedServerWorkspace(initial);
  const base = await readServerWorkspaceEnvelope();
  const unmarkedDraft = sanitizeWorkspace({
    ...initial,
    description: 'B116 pre-marker scoped draft requires explicit migration review.',
  });
  await seedScopedWorkspaceOnce(page, {
    workspaceId: base.workspaceId,
    workspace: unmarkedDraft,
    version: base.version,
  });
  const remote = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_Pre_Marker_Remote',
    description: 'Newer remote state must not erase the unmarked scoped body.',
  });
  await seedServerWorkspace(remote);
  await bootWithFetchCounts(page, { dismissHealthCard: false });

  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().description)).toBe(unmarkedDraft.description);
  await expect(page.getByTestId('sync-conflict-dialog')).toBeVisible({ timeout: 10_000 });
  const preservedRemote = await readServerWorkspaceEnvelope();
  expect(preservedRemote.workspace.name).toBe(remote.name);
  expect(preservedRemote.workspace.description).toBe(remote.description);
});

test('malformed 200 autosave receipt recovers through CAS readback instead of stranding the edit', async ({ page }) => {
  test.setTimeout(40_000);
  const initial = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);

  let workspacePosts = 0;
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    workspacePosts += 1;
    if (workspacePosts === 1) {
      const committed = await route.fetch();
      expect(committed.ok()).toBe(true);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }
    await route.fallback();
  });
  const editedDescription = 'B116 malformed success receipt must converge by readback.';
  await page.evaluate(description => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description });
  }, editedDescription);

  await expect.poll(() => workspacePosts, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await readServerWorkspaceEnvelope()).workspace.description, {
    timeout: 15_000,
  }).toBe(editedDescription);
  await expect(page.getByTestId('sync-conflict-dialog')).toHaveCount(0);
  const saved = await readServerWorkspaceEnvelope();
  await expect.poll(async () => Number(await page.evaluate(workspaceId =>
    localStorage.getItem(`x4_mod_studio_version:${workspaceId}`), saved.workspaceId)), {
    timeout: 10_000,
  }).toBe(Number(saved.version));
});

test('a successful omitted-field save cannot clear a newer debounced edit', async ({ page }) => {
  test.setTimeout(30_000);
  const workspace = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(workspace);
  await bootWithFetchCounts(page);
  let browserWrites = 0;
  let releaseFirst!: () => void;
  const firstHeld = new Promise<void>(resolve => { releaseFirst = resolve; });
  let markFirstSaved!: (envelope: Record<string, unknown>) => void;
  const firstSaved = new Promise<Record<string, unknown>>(resolve => { markFirstSaved = resolve; });
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    browserWrites += 1;
    if (browserWrites > 1) {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as { workspace: unknown };
    await seedServerWorkspace(body.workspace);
    const saved = await readServerWorkspaceEnvelope();
    markFirstSaved(saved);
    await firstHeld;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, applied: true, ...saved }),
    });
  });
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, uiTheme: { ...current.uiTheme, accentColor: '#aaaaaa' } });
  });
  await firstSaved;
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, uiTheme: { ...current.uiTheme, accentColor: '#bbbbbb' } });
  });
  releaseFirst();
  await expect.poll(async () => (await readServerWorkspaceEnvelope()).workspace?.uiTheme?.accentColor, {
    timeout: 12_000,
  }).toBe('#bbbbbb');
  expect(browserWrites).toBe(2);
});

test('small workspace pointer-close control keeps the renderer responsive', async ({ page }, testInfo) => {
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  await page.route('**/api/agent/compile', route => route.fulfill({ json: { diagnostics: [], validation: { scope: 'full-project' } } }));
  await bootWithFetchCounts(page);
  expect(await renderedCanvasNodeCount(page)).toBe(3);
  await openAgentBridge(page);
  const measurement = await pointerCloseMeasurement(page);
  await attachMeasurement(testInfo, 'b116-small-close', { renderedNodes: 3, ...measurement });
});

test('large sparse workspace closes and remounts Bridge without losing the renderer heartbeat', async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  const workspace = buildLargeWorkspace({ layout: 'sparse', snapshotBytes: LARGE_WORKSPACE_SNAPSHOT_BYTES });
  await seedServerWorkspace(workspace);
  await page.route('**/api/agent/compile', route => route.fulfill({ json: { diagnostics: [], validation: { scope: 'full-project' } } }));
  await bootWithFetchCounts(page);
  const renderedNodes = await renderedCanvasNodeCount(page);
  expect(renderedNodes).toBeGreaterThan(0);
  expect(renderedNodes).toBeLessThan(LARGE_WORKSPACE_NODE_COUNT);
  await openAgentBridge(page);
  const bytes = await bootstrapResourceBytes(page);
  expect(bytes.decodedBodySize).toBeGreaterThanOrEqual(LARGE_WORKSPACE_SNAPSHOT_BYTES);
  const measurement = await pointerCloseMeasurement(page);
  await attachMeasurement(testInfo, 'b116-large-sparse-close', { renderedNodes, bootstrapBytes: bytes, ...measurement });

  await openAgentBridge(page);
  await expect.poll(() => workspaceSubscribers(page)).toBe(2);
});

test('large dense workspace pointer-close control keeps all rendered nodes responsive', async ({ page }, testInfo) => {
  // The setup envelope is 60 seconds; pointerCloseMeasurement retains its 5-second product thresholds.
  test.setTimeout(60_000);
  await seedServerWorkspace(buildLargeWorkspace({ layout: 'dense' }));
  await page.route('**/api/agent/compile', route => route.fulfill({ json: { diagnostics: [], validation: { scope: 'full-project' } } }));
  await bootWithFetchCounts(page);
  const renderedNodes = await renderedCanvasNodeCount(page);
  expect(renderedNodes).toBe(LARGE_WORKSPACE_NODE_COUNT);
  await openAgentBridge(page);
  const measurement = await pointerCloseMeasurement(page);
  await attachMeasurement(testInfo, 'b116-large-dense-close', { renderedNodes, ...measurement });
});

test('large dense workspace accessibility traversal is isolated from Bridge close', async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  await seedServerWorkspace(buildLargeWorkspace({ layout: 'dense' }));
  await page.route('**/api/agent/compile', route => route.fulfill({ json: { diagnostics: [], validation: { scope: 'full-project' } } }));
  await bootWithFetchCounts(page);
  const renderedNodes = await renderedCanvasNodeCount(page);
  expect(renderedNodes).toBe(LARGE_WORKSPACE_NODE_COUNT);
  await openAgentBridge(page);
  const session = await page.context().newCDPSession(page);
  await page.evaluate(() => (window as unknown as PollWindow).__X4_RENDER_PROBE__?.reset());
  const started = Date.now();
  const tree = await session.send('Accessibility.getFullAXTree') as {
    nodes?: Array<{ name?: { value?: string } }>;
  };
  const elapsedMs = Date.now() - started;
  await expect.poll(async () => (await rendererProbe(page)).ticks).toBeGreaterThan(0);
  const probe = await rendererProbe(page);
  const actionNames = new Set((tree.nodes || [])
    .map(node => String(node.name?.value || ''))
    .filter(name => name.startsWith('B116 Action ')));
  expect(tree.nodes?.length || 0).toBeGreaterThan(0);
  expect(actionNames.size).toBe(1_420);
  expect(elapsedMs).toBeLessThan(5_000);
  expect(probe.maxHeartbeatGapMs).toBeLessThan(5_000);
  expect(probe.worstLongTaskMs).toBeLessThan(5_000);
  await expect(page.getByText('AI Agent API Bridge')).toBeVisible();
  await expect.poll(() => workspaceSubscribers(page)).toBe(2);
  await attachMeasurement(testInfo, 'b116-large-dense-ax', {
    renderedNodes,
    axNodes: tree.nodes?.length || 0,
    uniqueActionNames: actionNames.size,
    elapsedMs,
    probe,
  });
  await session.detach();
});

test('unchanged workspace ticks transfer summaries but no full workspace after bootstrap', async ({ page }) => {
  const workspace = buildLargeWorkspace({ layout: 'sparse', snapshotBytes: LARGE_WORKSPACE_SNAPSHOT_BYTES });
  await seedServerWorkspace(workspace);
  await page.route('**/api/agent/compile', route => route.fulfill({ json: { diagnostics: [], validation: { scope: 'full-project' } } }));
  await bootWithFetchCounts(page);
  await openAgentBridge(page);
  await page.getByTestId('agent-bridge-auto-sync').click();
  await expect(page.getByTestId('agent-bridge-auto-sync')).toContainText('ON');
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    pollWindow.__X4_FETCH_COUNTS__ = {};
    pollWindow.__X4_FETCH_METRICS__ = [];
  });
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspaces'] || 0
  ), { timeout: 8_000 }).toBeGreaterThanOrEqual(1);
  const counts = await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__ || {});
  expect(counts['/api/agent/workspaces'] || 0).toBeGreaterThanOrEqual(1);
  expect(counts['/api/agent/workspace'] || 0).toBe(0);

  const changed = { ...workspace, name: 'B116_sparse_1424_changed' };
  await seedServerWorkspace(changed);
  await expect.poll(() => page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name), {
    timeout: 8_000,
  }).toBe(changed.name);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0)).toBe(1);
  await page.waitForTimeout(3_600);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0)).toBe(1);

  // `uiTheme` is intentionally outside the persisted CAS hash. The separate complete
  // snapshot digest must still detect and transfer this real workspace mutation once.
  const themeChanged = { ...changed, uiTheme: { ...changed.uiTheme, accentColor: '#abcdef' } };
  expect(workspaceContentHash(sanitizeWorkspace(themeChanged))).toBe(workspaceContentHash(sanitizeWorkspace(changed)));
  expect(workspaceSnapshotHash(sanitizeWorkspace(themeChanged))).not.toBe(workspaceSnapshotHash(sanitizeWorkspace(changed)));
  await seedServerWorkspace(themeChanged);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().uiTheme?.accentColor
  ), { timeout: 8_000 }).toBe('#abcdef');
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0)).toBe(2);
  await page.waitForTimeout(3_600);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0)).toBe(2);

  // The workspace-local id still controls generated UI/Lua paths. It is therefore part
  // of the complete snapshot digest even though the registry workspaceId owns addressing.
  const idChanged = { ...themeChanged, id: 'b116_authoritative_workspace_id' };
  expect(workspaceContentHash(sanitizeWorkspace(idChanged))).toBe(workspaceContentHash(sanitizeWorkspace(themeChanged)));
  expect(workspaceSnapshotHash(sanitizeWorkspace(idChanged))).not.toBe(workspaceSnapshotHash(sanitizeWorkspace(themeChanged)));
  await seedServerWorkspace(idChanged);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().id
  ), { timeout: 8_000 }).toBe(idChanged.id);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0)).toBe(3);
  await page.waitForTimeout(3_600);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0)).toBe(3);
});

test('App and AgentBridge fan out one addressed workspace polling resource', async ({ page }) => {
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({ ...buildTemplateWorkspace('reward_on_kill'), name: 'B116_Resume_Adoption' });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);

  await openAgentBridge(page);

  await expect.poll(async () => page.evaluate(() => {
    const workspace = (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().resources.find(resource => resource.resourceKey.startsWith('workspace:'));
    return workspace?.subscribers || 0;
  })).toBe(2);

  const before = await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspaces'] || 0);
  await page.waitForTimeout(4500);
  const after = await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspaces'] || 0);
  expect(after - before).toBeGreaterThanOrEqual(1);
  expect(after - before).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().timerArmed)).toBe(true);

  await page.getByTestId('agent-bridge-auto-sync').click();
  await expect(page.getByTestId('agent-bridge-auto-sync')).toContainText('ON');
  await page.getByTitle('Pause external workspace updates (local edits still save)').click();
  await expect(page.getByTestId('agent-bridge-sync-status')).toContainText('External updates: Paused');
  await expect.poll(async () => page.evaluate(() => {
    const resource = (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().resources.find(item => item.resourceKey.startsWith('workspace:'));
    return resource?.subscribers || 0;
  })).toBe(0);
  const pausedSummaryCount = await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspaces'] || 0);
  const pausedFullCount = await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0);
  await seedServerWorkspace(external);
  await page.waitForTimeout(4_500);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name)).toBe(initial.name);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspaces'] || 0)).toBe(pausedSummaryCount);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0)).toBe(pausedFullCount);
  let releaseResume!: () => void;
  const resumeHeld = new Promise<void>(resolve => { releaseResume = resolve; });
  let resumeSeen!: () => void;
  const sawResume = new Promise<void>(resolve => { resumeSeen = resolve; });
  await page.route('**/api/agent/workspaces', async route => {
    resumeSeen();
    await resumeHeld;
    await route.fallback();
  });
  await page.getByTitle('Resume external workspace updates').click();
  await sawResume;
  await expect(page.getByTestId('agent-bridge-sync-status')).toContainText('External updates: Checking');
  releaseResume();
  await expect(page.getByTestId('agent-bridge-sync-status')).toContainText('External updates: Connected');
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  ), { timeout: 8_000 }).toBe(external.name);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0)).toBe(pausedFullCount + 1);

  await page.getByRole('button', { name: 'Close Agent API Bridge' }).click();
  await expect(page.getByText('AI Agent API Bridge')).toBeHidden();
  await expect.poll(async () => page.evaluate(() => {
    const workspace = (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().resources.find(resource => resource.resourceKey.startsWith('workspace:'));
    return workspace?.subscribers || 0;
  })).toBe(1);
  await openAgentBridge(page);
  await expect(page.getByTestId('agent-bridge-sync-status')).toContainText('External updates: Checking');
  await expect(page.getByTestId('agent-bridge-sync-status')).toContainText('External updates: Connected');
});

test('AgentBridge cannot apply a pending payload after workspace authority changes', async ({ page }) => {
  const workspace = buildTemplateWorkspace('welcome');
  const pending = buildTemplateWorkspace('reward_on_kill');
  await seedServerWorkspace(workspace);
  await bootWithFetchCounts(page);
  const initialWorkspaceId = await page.evaluate(() => window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || '');
  expect(initialWorkspaceId).toMatch(/^ws_[a-f0-9]{24}$/i);
  let injectPending = false;

  await page.route('**/api/agent/workspaces', async route => {
    if (!injectPending) {
      await route.fallback();
      return;
    }
    const addressedId = route.request().headers()['x-workspace-id'] || initialWorkspaceId;
    const selected = addressedId === initialWorkspaceId ? pending : { ...workspace, name: 'R13 Workspace B' };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workspaces: [{
          workspaceId: addressedId,
          name: selected.name,
          version: addressedId === initialWorkspaceId ? Number.MAX_SAFE_INTEGER : 1,
          workspaceHash: workspaceContentHash(sanitizeWorkspace(selected)),
          snapshotHash: workspaceSnapshotHash(sanitizeWorkspace(selected)),
          createdAt: '2026-07-31T00:00:00.000Z',
          savedAt: '2026-07-31T00:00:00.000Z',
          origin: 'e2e',
          contentSummary: `${selected.nodes.length} nodes`,
        }],
        defaultWorkspaceId: addressedId,
      }),
    });
  });

  await page.route('**/api/agent/workspace', async route => {
    if (!injectPending) {
      await route.fallback();
      return;
    }
    const addressedId = route.request().headers()['x-workspace-id'] || '';
    const selected = addressedId === initialWorkspaceId ? pending : { ...workspace, name: 'R13 Workspace B' };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workspaceId: addressedId,
        workspace: selected,
        version: addressedId === initialWorkspaceId ? Number.MAX_SAFE_INTEGER : 1,
        workspaceHash: workspaceContentHash(sanitizeWorkspace(selected)),
        snapshotHash: workspaceSnapshotHash(sanitizeWorkspace(selected)),
      }),
    });
  });

  await page.getByTestId('studio-menu-button').click();
  await page.getByTestId('studio-menu').locator('[data-global-action="agent-api"]').click();
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description: 'Keep this local edit authoritative.' });
  });
  injectPending = true;
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 8_000 });

  const nextWorkspaceId = 'ws_bbbbbbbbbbbbbbbbbbbbbbbb';
  await page.evaluate(nextId => {
    window.__X4_WORKSPACE_CONTEXT__!.selectWorkspace(nextId);
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, name: 'R13 Workspace B' });
  }, nextWorkspaceId);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0);
  await expect(page.getByText('AI Agent API Bridge')).toBeVisible();
});

test('AgentBridge Auto-Apply cannot replace a dirty queued canvas with a polled server snapshot', async ({ page }) => {
  test.setTimeout(30_000);
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_External_Auto_Apply',
    description: 'External server state must remain pending.',
  });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);
  await page.getByTestId('agent-bridge-auto-sync').click();
  await expect(page.getByTestId('agent-bridge-auto-sync')).toContainText('ON');

  let releaseLocalWrite!: () => void;
  const localWriteHeld = new Promise<void>(resolve => { releaseLocalWrite = resolve; });
  let markLocalWriteSeen!: () => void;
  const localWriteSeen = new Promise<void>(resolve => { markLocalWriteSeen = resolve; });
  let heldOneLocalWrite = false;
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() !== 'POST' || heldOneLocalWrite) {
      await route.fallback();
      return;
    }
    heldOneLocalWrite = true;
    markLocalWriteSeen();
    await localWriteHeld;
    await route.fallback();
  });

  const localDescription = 'Keep this dirty queued edit authoritative.';
  await page.evaluate(description => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description });
  }, localDescription);
  await localWriteSeen;
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    pollWindow.__X4_FETCH_COUNTS__!['/api/agent/workspace'] = 0;
  });
  await seedServerWorkspace(external);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0
  ), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(150);
  const observedBeforeRelease = await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    return {
      name: pollWindow.__X4_E2E__!.getWorkspace().name,
      description: pollWindow.__X4_E2E__!.getWorkspace().description,
      pendingVisible: Boolean(document.querySelector('[data-testid="agent-bridge-pending-workspace"]')),
    };
  });
  releaseLocalWrite();

  expect(observedBeforeRelease.description).toBe(localDescription);
  expect(observedBeforeRelease.name).toBe(initial.name);
  expect(observedBeforeRelease.pendingVisible).toBe(true);
});

test('AgentBridge Auto-Apply OFF keeps a clean newer snapshot pending with one full transfer', async ({ page }) => {
  test.setTimeout(30_000);
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_Clean_Manual_Review',
    description: 'A clean canvas still requires explicit Apply while Auto-Apply is OFF.',
  });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);

  let fullWorkspaceGets = 0;
  page.on('request', request => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/agent/workspace') {
      fullWorkspaceGets += 1;
    }
  });
  await seedServerWorkspace(external);
  await expect.poll(() => fullWorkspaceGets, { timeout: 10_000 }).toBe(1);
  await page.waitForTimeout(3_600);

  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name)).toBe(initial.name);
  expect(fullWorkspaceGets).toBe(1);
  await openAgentBridge(page);
  await expect(page.getByTestId('agent-bridge-auto-sync')).toContainText('OFF');
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible();
  await page.waitForTimeout(3_600);
  expect(fullWorkspaceGets).toBe(1);
  await page.getByTestId('agent-bridge-auto-sync').click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  ), { timeout: 10_000 }).toBe(external.name);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0);
  expect(fullWorkspaceGets).toBe(1);
});

test('App server-copy adoption clears the matching AgentBridge pending candidate centrally', async ({ page }) => {
  test.setTimeout(35_000);
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({ ...buildTemplateWorkspace('reward_on_kill'), name: 'B116_Central_Server_Adoption' });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);
  await seedServerWorkspace(external);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('sync-diverged-badge')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('sync-diverged-badge').click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  ), { timeout: 10_000 }).toBe(external.name);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0);
});

test('AgentBridge pending snapshot follows a version-only commit without another full transfer and still applies', async ({ page }) => {
  test.setTimeout(35_000);
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_Version_Only_Pending',
  });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);

  let fullWorkspaceGets = 0;
  let browserWorkspacePosts = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname !== '/api/agent/workspace') return;
    if (request.method() === 'GET') fullWorkspaceGets += 1;
    if (request.method() === 'POST') browserWorkspacePosts += 1;
  });
  await seedServerWorkspace(external);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });
  expect(fullWorkspaceGets).toBe(1);
  const first = await readServerWorkspaceEnvelope();
  const versionOnly = { ...first, version: Number(first.version) + 1 };
  await page.route('**/api/agent/workspaces', async route => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    body.workspaces = Array.isArray(body.workspaces)
      ? body.workspaces.map((row: { workspaceId?: string }) => row.workspaceId === versionOnly.workspaceId
        ? { ...row, version: versionOnly.version }
        : row)
      : body.workspaces;
    await route.fulfill({ response, body: JSON.stringify(body) });
  });
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versionOnly) });
      return;
    }
    await route.fallback();
  });

  await expect(page.getByTestId('agent-bridge-pending-workspace')).toContainText(`v${versionOnly.version}`, { timeout: 10_000 });
  expect(fullWorkspaceGets).toBe(1);

  await page.getByRole('button', { name: 'Apply Changes' }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  ), { timeout: 5_000 }).toBe(external.name);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0);
  expect(fullWorkspaceGets).toBe(2);
  expect(browserWorkspacePosts).toBe(0);
});

test('AgentBridge clears an obsolete pending snapshot when server authority returns to the retained canvas', async ({ page }) => {
  test.setTimeout(30_000);
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({ ...buildTemplateWorkspace('reward_on_kill'), name: 'B116_Obsolete_Pending' });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);

  await seedServerWorkspace(external);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });
  await seedServerWorkspace(initial);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0, { timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name)).toBe(initial.name);
});

test('AgentBridge full Auto-Apply supersedes an older pending pair for the same workspace', async ({ page }) => {
  test.setTimeout(40_000);
  const initial = buildTemplateWorkspace('welcome');
  const pendingA = sanitizeWorkspace({ ...buildTemplateWorkspace('reward_on_kill'), name: 'B116_Pending_A' });
  const appliedB = sanitizeWorkspace({ ...pendingA, name: 'B116_Applied_B' });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);
  await seedServerWorkspace(pendingA);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });

  let releaseSummary!: () => void;
  const summaryHeld = new Promise<void>(resolve => { releaseSummary = resolve; });
  let markSummaryStarted!: () => void;
  const summaryStarted = new Promise<void>(resolve => { markSummaryStarted = resolve; });
  let held = false;
  await page.route('**/api/agent/workspaces', async route => {
    if (route.request().method() !== 'GET' || held) {
      await route.fallback();
      return;
    }
    held = true;
    markSummaryStarted();
    await summaryHeld;
    await route.fallback();
  });
  await summaryStarted;
  await page.getByTestId('agent-bridge-auto-sync').click();
  await seedServerWorkspace(appliedB);
  releaseSummary();

  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  ), { timeout: 10_000 }).toBe(appliedB.name);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0);
});

test('AgentBridge pending snapshot keeps prior CAS authority so a local edit cannot overwrite it', async ({ page }) => {
  test.setTimeout(30_000);
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_Remote_Pending_Authority',
    description: 'This remote-only state must survive a stale local edit.',
  });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);
  await expect(page.getByTestId('agent-bridge-auto-sync')).toContainText('OFF');
  await seedServerWorkspace(external);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });

  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description: 'A stale local edit must conflict.' });
  });
  await expect(page.getByTestId('sync-conflict-dialog')).toBeVisible({ timeout: 10_000 });
  const server = await readServerWorkspaceEnvelope();
  expect(server.workspace.name).toBe(external.name);
  expect(server.workspace.description).toBe(external.description);
});

test('AgentBridge Auto-Apply adopts a clean snapshot once without echoing a workspace POST', async ({ page }) => {
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_Clean_Auto_Apply',
  });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);
  await page.getByTestId('agent-bridge-auto-sync').click();
  await expect(page.getByTestId('agent-bridge-auto-sync')).toContainText('ON');

  let browserWorkspacePosts = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/agent/workspace') {
      browserWorkspacePosts += 1;
    }
  });
  await seedServerWorkspace(external);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  ), { timeout: 10_000 }).toBe(external.name);
  await page.waitForTimeout(750);

  expect(browserWorkspacePosts).toBe(0);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  )).toBe(initial.name);
});

test('AgentBridge Auto-Apply keeps the persisted workspace/version pair repairable when scoped cache quota fails', async ({ page }) => {
  test.setTimeout(30_000);
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_Quota_Safe_Auto_Apply',
  });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);
  await page.getByTestId('agent-bridge-auto-sync').click();
  const before = await page.evaluate(() => {
    const workspaceId = window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || 'unbound';
    return {
      workspace: localStorage.getItem(`x4_mod_studio_workspace:${workspaceId}`),
      version: localStorage.getItem(`x4_mod_studio_version:${workspaceId}`),
    };
  });
  await page.evaluate(() => {
    const workspaceId = window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || 'unbound';
    const blockedKey = `x4_mod_studio_workspace:${workspaceId}`;
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === blockedKey) throw new DOMException('B116 deterministic quota failure', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    };
    (window as unknown as Window & { __X4_RESTORE_STORAGE_SET_ITEM__?: () => void }).__X4_RESTORE_STORAGE_SET_ITEM__ = () => {
      Storage.prototype.setItem = nativeSetItem;
    };
  });

  await seedServerWorkspace(external);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  ), { timeout: 10_000 }).toBe(external.name);
  // Let the next summary-only tick run. It must not persist the new version over the
  // deliberately failed full workspace cache and make the stale pair look current.
  await page.waitForTimeout(3_600);
  const after = await page.evaluate(() => {
    const workspaceId = window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || 'unbound';
    return {
      workspace: localStorage.getItem(`x4_mod_studio_workspace:${workspaceId}`),
      version: localStorage.getItem(`x4_mod_studio_version:${workspaceId}`),
    };
  });
  await page.evaluate(() => {
    (window as unknown as Window & { __X4_RESTORE_STORAGE_SET_ITEM__?: () => void }).__X4_RESTORE_STORAGE_SET_ITEM__?.();
  });

  expect(after).toEqual(before);
  await expect(page.getByText('AI Agent API Bridge')).toBeVisible();
});

test('AgentBridge manual pending Apply uses a fresh paired App-owned read and emits no workspace POST', async ({ page }) => {
  test.setTimeout(45_000);
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_Manual_Pending',
    description: 'Reviewed pending server state.',
  });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);
  let releaseLocalWrite!: () => void;
  const localWriteHeld = new Promise<void>(resolve => { releaseLocalWrite = resolve; });
  let markLocalWriteSeen!: () => void;
  const localWriteSeen = new Promise<void>(resolve => { markLocalWriteSeen = resolve; });
  let heldOneLocalWrite = false;
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() !== 'POST' || heldOneLocalWrite) {
      await route.fallback();
      return;
    }
    heldOneLocalWrite = true;
    markLocalWriteSeen();
    await localWriteHeld;
    await route.fallback();
  });
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description: 'Unsaved local choice.' });
  });
  await localWriteSeen;
  await seedServerWorkspace(external);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });

  const actual = await readServerWorkspaceEnvelope();
  const changedAgain = sanitizeWorkspace({ ...external, name: 'B116_Changed_Again_Before_Click' });
  const changedAgainEnvelope = {
    workspaceId: actual.workspaceId,
    workspace: changedAgain,
    version: Number(actual.version) + 1,
    workspaceHash: workspaceContentHash(changedAgain),
    snapshotHash: workspaceSnapshotHash(changedAgain),
  };
  const malformedVersionEnvelope = { ...actual, version: 'not-a-number' };
  let manualReadMode: 'malformed' | 'changed' | 'pass' = 'malformed';
  const manualReadRoute = async (route: import('@playwright/test').Route) => {
    if (route.request().method() === 'GET' && manualReadMode !== 'pass') {
      const body = manualReadMode === 'malformed' ? malformedVersionEnvelope : changedAgainEnvelope;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      return;
    }
    await route.fallback();
  };
  await page.route('**/api/agent/workspace', manualReadRoute);
  let browserWorkspacePosts = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/agent/workspace') browserWorkspacePosts += 1;
  });

  await page.getByRole('button', { name: 'Apply Changes' }).click();
  await expect(page.getByText('Server copy was not applied: Server workspace response did not include a valid numeric version.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().description)).toBe('Unsaved local choice.');
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible();

  manualReadMode = 'changed';
  await page.getByRole('button', { name: 'Apply Changes' }).click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().description)).toBe('Unsaved local choice.');
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible();
  await expect(page.getByText('Server copy was not applied: The pending server workspace changed again. Review the refreshed pending change before applying it.')).toBeVisible();

  manualReadMode = 'pass';
  await page.unroute('**/api/agent/workspace', manualReadRoute);
  await page.getByRole('button', { name: 'Apply Changes' }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  ), { timeout: 5_000 }).toBe(external.name);
  await page.waitForTimeout(750);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0);
  releaseLocalWrite();
  await page.waitForTimeout(1_250);
  expect(browserWorkspacePosts).toBe(0);
});

test('AgentBridge Auto-Apply cannot replace a manually adopted canvas while an invalidated write remains queued', async ({ page }) => {
  test.setTimeout(45_000);
  const initial = buildTemplateWorkspace('welcome');
  const reviewed = sanitizeWorkspace({ ...buildTemplateWorkspace('reward_on_kill'), name: 'B116_Reviewed_While_Queued' });
  const newer = sanitizeWorkspace({ ...reviewed, name: 'B116_Newer_While_Queued' });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);

  let releaseHeldPost!: () => void;
  const heldPost = new Promise<void>(resolve => { releaseHeldPost = resolve; });
  let markPostSeen!: () => void;
  const postSeen = new Promise<void>(resolve => { markPostSeen = resolve; });
  let held = false;
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() !== 'POST' || held) {
      await route.fallback();
      return;
    }
    held = true;
    markPostSeen();
    await heldPost;
    await route.fallback();
  });
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description: 'This write remains queued during manual adoption.' });
  });
  await postSeen;
  await seedServerWorkspace(reviewed);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Apply Changes' }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name
  ), { timeout: 5_000 }).toBe(reviewed.name);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0);

  await page.getByTestId('agent-bridge-auto-sync').click();
  await seedServerWorkspace(newer);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__?.getWorkspace().name)).toBe(reviewed.name);
  releaseHeldPost();
});

test('AgentBridge Auto-Apply keeps a newer candidate pending while a prior sync conflict is unresolved', async ({ page }) => {
  test.setTimeout(45_000);
  const initial = buildTemplateWorkspace('welcome');
  const remote = sanitizeWorkspace({ ...buildTemplateWorkspace('reward_on_kill'), name: 'B116_Conflict_Remote' });
  const newer = sanitizeWorkspace({ ...remote, name: 'B116_Conflict_Newer' });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);
  await page.getByTestId('agent-bridge-auto-sync').click();

  let releaseHeldPost!: () => void;
  const heldPost = new Promise<void>(resolve => { releaseHeldPost = resolve; });
  let markPostSeen!: () => void;
  const postSeen = new Promise<void>(resolve => { markPostSeen = resolve; });
  let held = false;
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() !== 'POST' || held) {
      await route.fallback();
      return;
    }
    held = true;
    markPostSeen();
    await heldPost;
    await route.fallback();
  });
  const localDescription = 'Keep this unresolved local side visible.';
  await page.evaluate(description => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description });
  }, localDescription);
  await postSeen;
  await seedServerWorkspace(remote);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });
  releaseHeldPost();
  await expect(page.getByTestId('sync-conflict-dialog')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__!.setWorkspaceDirtyForTest(false));
  await page.waitForTimeout(100);

  await seedServerWorkspace(newer);
  const newerEnvelope = await readServerWorkspaceEnvelope();
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toContainText(`v${newerEnvelope.version}`, { timeout: 10_000 });
  const visible = await page.evaluate(() => {
    const current = (window as unknown as PollWindow).__X4_E2E__!.getWorkspace();
    return { name: current.name, description: current.description };
  });
  expect(visible.name).toBe(initial.name);
  expect(visible.description).toBe(localDescription);
  await expect(page.getByTestId('sync-conflict-dialog')).toBeVisible();
  const server = await readServerWorkspaceEnvelope();
  expect(server.workspace.name).toBe(newer.name);
});

test('failed manual pending Apply re-arms a dirty CAS save under the new authority epoch', async ({ page }) => {
  test.setTimeout(45_000);
  const initial = buildTemplateWorkspace('welcome');
  const external = sanitizeWorkspace({
    ...buildTemplateWorkspace('reward_on_kill'),
    name: 'B116_Remote_Before_Failed_Apply',
    description: 'Remote authority must survive and force conflict.',
  });
  await seedServerWorkspace(initial);
  await bootWithFetchCounts(page);
  await openAgentBridge(page);

  let releaseFirstPost!: () => void;
  const firstPostHeld = new Promise<void>(resolve => { releaseFirstPost = resolve; });
  let markFirstPostSeen!: () => void;
  const firstPostSeen = new Promise<void>(resolve => { markFirstPostSeen = resolve; });
  let workspacePosts = 0;
  await page.route('**/api/agent/workspace', async route => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    workspacePosts += 1;
    if (workspacePosts === 1) {
      markFirstPostSeen();
      await firstPostHeld;
    }
    await route.fallback();
  });
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, description: 'Dirty local edit must be re-armed.' });
  });
  await firstPostSeen;
  await seedServerWorkspace(external);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible({ timeout: 10_000 });

  const actual = await readServerWorkspaceEnvelope();
  const changedAgain = sanitizeWorkspace({ ...external, name: 'B116_Changed_During_Manual_Apply' });
  const changedAgainEnvelope = {
    workspaceId: actual.workspaceId,
    workspace: changedAgain,
    version: Number(actual.version) + 1,
    workspaceHash: workspaceContentHash(changedAgain),
    snapshotHash: workspaceSnapshotHash(changedAgain),
  };
  let serveChangedPair = true;
  const manualReadRoute = async (route: import('@playwright/test').Route) => {
    if (route.request().method() === 'GET' && serveChangedPair) {
      serveChangedPair = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(changedAgainEnvelope) });
      return;
    }
    await route.fallback();
  };
  await page.route('**/api/agent/workspace', manualReadRoute);
  await page.getByRole('button', { name: 'Apply Changes' }).click();
  await page.waitForTimeout(250);
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toBeVisible();
  await page.unroute('**/api/agent/workspace', manualReadRoute);

  releaseFirstPost();
  await expect(page.getByTestId('sync-conflict-dialog')).toBeVisible({ timeout: 10_000 });
  expect(workspacePosts).toBeGreaterThanOrEqual(2);
  const server = await readServerWorkspaceEnvelope();
  expect(server.workspace.name).toBe(external.name);
  expect(server.workspace.description).toBe(external.description);
});

test('in-flight full workspace response cannot cross a workspace authority change', async ({ page }) => {
  const workspace = buildTemplateWorkspace('welcome');
  const pending = buildTemplateWorkspace('reward_on_kill');
  await seedServerWorkspace(workspace);
  await bootWithFetchCounts(page);
  const initialWorkspaceId = await page.evaluate(() => window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || '');
  const pendingHash = workspaceContentHash(sanitizeWorkspace(pending));
  const pendingSnapshotHash = workspaceSnapshotHash(sanitizeWorkspace(pending));
  let injectPending = false;
  let releaseFull!: () => void;
  const fullHeld = new Promise<void>(resolve => { releaseFull = resolve; });
  let markFullStarted!: () => void;
  const fullStarted = new Promise<void>(resolve => { markFullStarted = resolve; });

  await page.route('**/api/agent/workspaces', async route => {
    if (!injectPending) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workspaces: [{
          workspaceId: initialWorkspaceId,
          name: pending.name,
          version: Number.MAX_SAFE_INTEGER,
          workspaceHash: pendingHash,
          snapshotHash: pendingSnapshotHash,
          createdAt: '2026-07-31T00:00:00.000Z',
          savedAt: '2026-07-31T00:00:00.000Z',
          origin: 'e2e',
          contentSummary: `${pending.nodes.length} nodes`,
        }],
        defaultWorkspaceId: initialWorkspaceId,
      }),
    });
  });
  await page.route('**/api/agent/workspace', async route => {
    if (!injectPending) {
      await route.fallback();
      return;
    }
    markFullStarted();
    await fullHeld;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workspaceId: initialWorkspaceId,
        workspace: pending,
        version: Number.MAX_SAFE_INTEGER,
        workspaceHash: pendingHash,
        snapshotHash: pendingSnapshotHash,
      }),
    }).catch(() => undefined); // an authority cleanup may abort the intercepted request first
  });

  await openAgentBridge(page);
  injectPending = true;
  await fullStarted;
  const nextWorkspaceId = 'ws_eeeeeeeeeeeeeeeeeeeeeeee';
  await page.evaluate(({ nextId }) => {
    window.__X4_WORKSPACE_CONTEXT__!.selectWorkspace(nextId);
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, name: 'B116 Authority B' });
  }, { nextId: nextWorkspaceId });
  injectPending = false;
  releaseFull();

  await page.waitForTimeout(750);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_E2E__!.getWorkspace().name)).toBe('B116 Authority B');
  await expect(page.getByTestId('agent-bridge-pending-workspace')).toHaveCount(0);
  await expect(page.getByText('AI Agent API Bridge')).toBeVisible();
});

test('LIVE telemetry subscription renders deterministic firing and error badges and stops', async ({ page }) => {
  const workspace = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(workspace);
  let call = 0;
  await page.route('**/api/agent/live/cue-telemetry', async route => {
    const body = route.request().postDataJSON() as { cueNames?: string[] };
    const name = body.cueNames?.[0] || 'Root';
    call += 1;
    if (call >= 3) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'telemetry offline' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        live: true,
        logUpdatedAt: new Date().toISOString(),
        cues: [{ name, hits: 4, errors: call === 1 ? 0 : 2, warnings: 0, lastLineNo: 88 }],
        watches: [{ name: '$probe', value: 'ready' }],
        bridge: { bridgeUp: true, gameActive: true, summary: 'Bridge and game active.' },
      }),
    });
  });
  await bootWithFetchCounts(page);

  const toggle = page.getByTestId('canvas-live-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('title', /debug log is ACTIVE/);
  await expect(page.getByText('▶ 4', { exact: true })).toBeVisible();
  await expect(page.getByTestId('canvas-live-watches')).toContainText('$probe');
  await expect.poll(async () => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().resources.filter(resource => resource.resourceKey.startsWith('live-cue-telemetry:')).length || 0
  )).toBe(1);

  await expect(page.getByText('✗ 2', { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(toggle).toHaveAttribute('title', /telemetry unavailable: telemetry offline/, { timeout: 7000 });
  await expect(page.getByText('✗ 2', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('canvas-live-watches')).toHaveCount(0);
  await toggle.click();
  await expect.poll(async () => page.evaluate(() =>
    (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().resources.filter(resource => resource.resourceKey.startsWith('live-cue-telemetry:')).length || 0
  )).toBe(0);
  await expect(page.getByTestId('canvas-live-watches')).toHaveCount(0);
});

test('delayed Canvas LIVE response cannot cross a cue-list authority change', async ({ page }) => {
  test.setTimeout(45_000);
  const workspace = buildTemplateWorkspace('welcome');
  await seedServerWorkspace(workspace);
  let call = 0;
  let releaseOld!: () => void;
  const oldHeld = new Promise<void>(resolve => { releaseOld = resolve; });
  let oldRequestSeen!: () => void;
  const sawOldRequest = new Promise<void>(resolve => { oldRequestSeen = resolve; });

  await page.route('**/api/agent/live/cue-telemetry', async route => {
    const body = route.request().postDataJSON() as { cueNames?: string[] };
    const name = body.cueNames?.[0] || 'Root';
    call += 1;
    if (call === 1) {
      oldRequestSeen();
      await oldHeld;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: true,
          live: true,
          logUpdatedAt: new Date().toISOString(),
          cues: [{ name, hits: 1, errors: 99, warnings: 0, lastLineNo: 11 }],
          watches: [{ name: '$authority', value: 'STALE_OLD_MUST_NOT_RENDER' }],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        live: true,
        logUpdatedAt: new Date().toISOString(),
        cues: [{ name, hits: 7, errors: 0, warnings: 0, lastLineNo: 22 }],
        watches: [{ name: '$authority', value: 'FRESH_NEW_AUTHORITY' }],
      }),
    });
  });

  await bootWithFetchCounts(page);
  await page.getByTestId('canvas-live-toggle').click();
  await sawOldRequest;
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({
      ...current,
      nodes: (current.nodes || []).map(node => node.type === 'cue'
        ? { ...node, properties: { ...node.properties, name: 'R13FreshCue' } }
        : node),
    });
  });
  await expect(page.getByTestId('canvas-live-watches')).toContainText('FRESH_NEW_AUTHORITY', { timeout: 15_000 });
  await expect(page.getByText('▶ 7', { exact: true })).toBeVisible();

  releaseOld();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('canvas-live-watches')).not.toContainText('STALE_OLD_MUST_NOT_RENDER');
  await expect(page.getByTestId('canvas-live-watches')).toContainText('FRESH_NEW_AUTHORITY');
  await expect(page.getByText('✗ 99', { exact: true })).toHaveCount(0);
  await expect(page.getByText('▶ 7', { exact: true })).toBeVisible();
});

test('delayed CueViewer response cannot cross a resolved-log-path authority change', async ({ page }) => {
  test.setTimeout(45_000);
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  let statusCalls = 0;
  let releaseOld!: () => void;
  const oldHeld = new Promise<void>(resolve => { releaseOld = resolve; });
  let oldRequestSeen!: () => void;
  const sawOldRequest = new Promise<void>(resolve => { oldRequestSeen = resolve; });

  await page.route('**/api/agent/game-log/status', route => {
    statusCalls += 1;
    const selectedLogPath = statusCalls === 1 ? 'C:\\logs\\A.log' : 'C:\\logs\\B.log';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ selectedLogPath }) });
  });
  await page.route('**/api/agent/log-file-tail', async route => {
    const body = route.request().postDataJSON() as { path?: string };
    if (body.path?.endsWith('A.log')) {
      oldRequestSeen();
      await oldHeld;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'STALE_A_MUST_NOT_RENDER' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, telemetry: { cues: [], entries: [] } }),
    });
  });
  await bootWithFetchCounts(page);
  await page.locator('[data-sidebar-tab="cues"]').click();
  await page.getByTestId('cue-live-toggle').click();
  await sawOldRequest;
  await expect(page.getByTestId('cue-live-status')).toContainText('B.log', { timeout: 15_000 });
  releaseOld();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('cue-live-status')).not.toContainText('STALE_A_MUST_NOT_RENDER');
  await expect(page.getByTestId('cue-live-status')).toContainText('B.log');
});

test('CueViewer clears old cue evidence when the active tail feed fails', async ({ page }) => {
  test.setTimeout(35_000);
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  let tailCalls = 0;
  await page.route('**/api/agent/game-log/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ selectedLogPath: 'C:\\logs\\active.log' }),
  }));
  await page.route('**/api/agent/log-file-tail', async route => {
    const body = route.request().postDataJSON() as { cueNames?: string[] };
    tailCalls += 1;
    if (tailCalls > 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'tail offline' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        telemetry: {
          cues: [{ name: body.cueNames?.[0], hits: 4, errors: 2, warnings: 0, lastLineNo: 17 }],
          entries: [],
        },
      }),
    });
  });
  await bootWithFetchCounts(page);
  await page.locator('[data-sidebar-tab="cues"]').click();
  await page.getByTestId('cue-live-toggle').click();
  await expect(page.getByText(/live ×4 \(2 err\)/)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId('cue-live-status')).toContainText('feed unavailable: tail offline', { timeout: 15_000 });
  await expect(page.getByText(/live ×4 \(2 err\)/)).toHaveCount(0);
});

test('Playtest replaces a prior clean verdict with explicit polling failure truth', async ({ page }) => {
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  await page.route('**/api/agent/debug-watcher/brief**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      status: { lastDeploy: null },
      verdict: { state: 'not_seen', detail: 'No current game evidence in the isolated legacy fallback fixture.', errorCount: 0 },
      sinceDeploy: { hasDeploy: false, changedSinceDeploy: false, summary: 'No deploy evidence in the isolated fixture.' },
      timeline: [],
      expectedChain: [],
      evidence: [],
      artifact: '',
    }),
  }));
  let calls = 0;
  await page.route('**/api/agent/game-log/status?*', async route => {
    calls += 1;
    if (calls > 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'game log offline' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'clean', summary: 'CLEAN_OLD_MUST_CLEAR', selectedLogPath: 'C:\\logs\\debug.log' }),
    });
  });
  await bootWithFetchCounts(page);
  await page.locator('[data-sidebar-tab="playtest"]').click();
  const card = page.getByTestId('playtest-game-log-status');
  await expect(card).toContainText('CLEAN_OLD_MUST_CLEAR');
  await expect(card).toContainText('Active-Mod Log Status: UNAVAILABLE', { timeout: 8_000 });
  await expect(card).toContainText('game log offline');
  await expect(card).not.toContainText('CLEAN_OLD_MUST_CLEAR');
});

test('GuidedRail clears the prior mod verdict while the new watcher is pending', async ({ page }) => {
  test.setTimeout(35_000);
  await seedServerWorkspace(buildTemplateWorkspace('blank'));
  let releaseSecond!: () => void;
  const secondHeld = new Promise<void>(resolve => { releaseSecond = resolve; });
  let secondSeen!: () => void;
  const sawSecond = new Promise<void>(resolve => { secondSeen = resolve; });
  await page.route('**/api/agent/debug-watcher/brief**', async route => {
    const modId = new URL(route.request().url()).searchParams.get('modId');
    if (modId === 'r13_rail_second') {
      secondSeen();
      await secondHeld;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ verdict: { state: 'not_seen', detail: 'Not seen.' } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ verdict: { state: 'loaded_clean', detail: 'Loaded clean.' } }) });
  });
  await bootWithFetchCounts(page);
  await page.getByTestId('template-welcome').click();
  await page.getByTestId('rail-step-3').evaluate(element => (element as HTMLButtonElement).click());
  await expect(page.getByTestId('rail-game')).toContainText(/in the game.*clean/i, { timeout: 8_000 });
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, name: 'R13 Rail Second' });
  });
  await sawSecond;
  await expect(page.getByTestId('rail-game')).toContainText('Checking this mod in the game');
  await expect(page.getByTestId('rail-game')).not.toContainText('Mod loaded and clean');
  releaseSecond();
});

test('cancelling an in-flight GitHub device poll cannot reconnect or re-arm', async ({ page }) => {
  test.setTimeout(35_000);
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  await page.addInitScript(() => {
    localStorage.removeItem('x4_github_connected');
    localStorage.removeItem('x4_github_owner');
  });
  await page.route('**/api/github/credential', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: false }),
  }));
  await page.route('**/api/github/device/start', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ device_code: 'held-device', user_code: 'R13-CANCEL', verification_uri: 'about:blank', interval: 5, expires_in: 120 }),
  }));
  let releasePoll!: () => void;
  const pollHeld = new Promise<void>(resolve => { releasePoll = resolve; });
  let pollSeen!: () => void;
  const sawPoll = new Promise<void>(resolve => { pollSeen = resolve; });
  let pollCalls = 0;
  await page.route('**/api/github/device/poll', async route => {
    pollCalls += 1;
    pollSeen();
    await pollHeld;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, login: 'must-not-connect' }) }).catch(() => undefined);
  });
  await bootWithFetchCounts(page);
  await page.locator('[data-sidebar-tab="git"]').click();
  await page.getByRole('button', { name: 'Remotes', exact: true }).click();
  await page.getByRole('button', { name: 'Connect with GitHub', exact: true }).click();
  await sawPoll;
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  releasePoll();
  await expect(page.getByText('Cancelled GitHub sign-in.')).toBeVisible();
  await page.waitForTimeout(5_500);
  expect(pollCalls).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('x4_github_connected'))).not.toBe('true');
  await expect(page.getByText('must-not-connect')).toHaveCount(0);
});

test('readiness clears old-mod evidence before the new mod request completes', async ({ page }) => {
  const workspace = buildTemplateWorkspace('welcome');
  const initialHash = workspaceContentHash(sanitizeWorkspace(workspace));
  await seedServerWorkspace(workspace);
  let releaseSecond!: () => void;
  const secondHeld = new Promise<void>(resolve => { releaseSecond = resolve; });
  let secondSeen!: () => void;
  const sawSecond = new Promise<void>(resolve => { secondSeen = resolve; });

  await page.route('**/api/agent/debug-watcher/brief**', async route => {
    const modId = new URL(route.request().url()).searchParams.get('modId');
    if (modId === 'r13_second') {
      secondSeen();
      await secondHeld;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        status: { lastDeploy: null },
        sinceDeploy: { hasDeploy: false, changedSinceDeploy: false, summary: 'No deploy.' },
        verdict: { state: 'not_seen', detail: 'Not seen.', errorCount: 0 },
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: { lastDeploy: { workspaceName: workspace.name, workspaceHash: initialHash, deployedAt: '2026-07-31T08:00:00.000Z', deployedPath: 'C:/fixture/extensions/welcome_message' } },
      sinceDeploy: { hasDeploy: true, changedSinceDeploy: true, summary: 'Fresh.' },
      verdict: { state: 'loaded_clean', detail: 'Loaded clean.', errorCount: 0 },
    }) });
  });

  await bootWithFetchCounts(page);
  await expect(page.getByTestId('readiness-stage-deployed')).toHaveAttribute('data-status', 'pass');
  await expect(page.getByTestId('readiness-stage-seen')).toHaveAttribute('data-status', 'pass');
  await page.evaluate(() => {
    const pollWindow = window as unknown as PollWindow;
    const current = pollWindow.__X4_E2E__!.getWorkspace();
    pollWindow.__X4_E2E__!.setWorkspace({ ...current, name: 'R13 Second' });
  });
  await sawSecond;
  await expect(page.getByTestId('readiness-stage-deployed')).toHaveAttribute('data-status', 'pending');
  await expect(page.getByTestId('readiness-stage-seen')).toHaveAttribute('data-status', 'pending');
  releaseSecond();
});
