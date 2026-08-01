import { expect, test } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { workspaceContentHash } from '../../src/lib/workspaceIdentity';
import { sanitizeWorkspace } from '../../src/types';
import { seedServerWorkspace } from './ephemeral';

type PollSnapshot = {
  timerArmed: boolean;
  resources: Array<{ resourceKey: string; subscribers: number; running: boolean }>;
};

type PollWindow = Window & {
  __X4_FETCH_COUNTS__?: Record<string, number>;
  __X4_CONTINUOUS_POLLING__?: { snapshot: () => PollSnapshot };
  __X4_E2E__?: {
    getWorkspace: () => {
      name?: string;
      nodes?: Array<{ type?: string; properties?: Record<string, unknown> }>;
    };
    setWorkspace: (workspace: unknown) => void;
  };
};

async function bootWithFetchCounts(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    const pollWindow = window as unknown as PollWindow;
    pollWindow.__X4_FETCH_COUNTS__ = {};
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = new URL(raw, location.origin).pathname;
      pollWindow.__X4_FETCH_COUNTS__![path] = (pollWindow.__X4_FETCH_COUNTS__![path] || 0) + 1;
      return nativeFetch(input, init);
    }) as typeof window.fetch;
  });
  await page.goto('/');
  await page.waitForFunction(() => {
    const pollWindow = window as unknown as PollWindow;
    return !!pollWindow.__X4_E2E__?.getWorkspace().name && !!pollWindow.__X4_CONTINUOUS_POLLING__;
  });
  const healthCard = page.getByTestId('health-card');
  await healthCard.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await healthCard.isVisible()) await page.getByTestId('health-card-dismiss').click();
}

test('App and AgentBridge fan out one addressed workspace polling resource', async ({ page }) => {
  await seedServerWorkspace(buildTemplateWorkspace('welcome'));
  await bootWithFetchCounts(page);

  await page.getByTestId('studio-menu-button').click();
  await page.getByTestId('studio-menu').locator('[data-global-action="agent-api"]').click();
  await expect(page.getByText('AI Agent API Bridge')).toBeVisible();

  await expect.poll(async () => page.evaluate(() => {
    const workspace = (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().resources.find(resource => resource.resourceKey.startsWith('workspace:'));
    return workspace?.subscribers || 0;
  })).toBe(2);

  const before = await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0);
  await page.waitForTimeout(4500);
  const after = await page.evaluate(() => (window as unknown as PollWindow).__X4_FETCH_COUNTS__?.['/api/agent/workspace'] || 0);
  expect(after - before).toBeGreaterThanOrEqual(1);
  expect(after - before).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().timerArmed)).toBe(true);

  await page.getByTitle('Pause server synchronization').click();
  await expect(page.getByTestId('agent-bridge-sync-status')).toContainText('Sync: Paused');
  await expect.poll(async () => page.evaluate(() => {
    const resource = (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().resources.find(item => item.resourceKey.startsWith('workspace:'));
    return resource?.subscribers || 0;
  })).toBe(1);
  let releaseResume!: () => void;
  const resumeHeld = new Promise<void>(resolve => { releaseResume = resolve; });
  let resumeSeen!: () => void;
  const sawResume = new Promise<void>(resolve => { resumeSeen = resolve; });
  await page.route('**/api/agent/workspace', async route => {
    resumeSeen();
    await resumeHeld;
    await route.fallback();
  });
  await page.getByTitle('Resume server synchronization').click();
  await sawResume;
  await expect(page.getByTestId('agent-bridge-sync-status')).toContainText('Sync: Checking');
  releaseResume();
  await expect(page.getByTestId('agent-bridge-sync-status')).toContainText('Sync: Connected');

  await page.getByRole('button', { name: 'Close Agent API Bridge' }).click();
  await expect(page.getByText('AI Agent API Bridge')).toBeHidden();
  await expect.poll(async () => page.evaluate(() => {
    const workspace = (window as unknown as PollWindow).__X4_CONTINUOUS_POLLING__?.snapshot().resources.find(resource => resource.resourceKey.startsWith('workspace:'));
    return workspace?.subscribers || 0;
  })).toBe(1);
});

test('AgentBridge cannot apply a pending payload after workspace authority changes', async ({ page }) => {
  const workspace = buildTemplateWorkspace('welcome');
  const pending = buildTemplateWorkspace('reward_on_kill');
  await seedServerWorkspace(workspace);
  await bootWithFetchCounts(page);
  const initialWorkspaceId = await page.evaluate(() => window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || '');
  expect(initialWorkspaceId).toMatch(/^ws_[a-f0-9]{24}$/i);
  let injectPending = false;

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
