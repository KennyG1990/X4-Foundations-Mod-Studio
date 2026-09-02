import { expect, test } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { seedServerWorkspace } from './ephemeral';

type Settlement = 'late' | 'abort';

type Deferred<T> = {
  readonly promise: Promise<T>;
  resolve(value: T): void;
};

type PendingStatusRequest = {
  readonly generation: number;
  readonly url: string;
  readonly settle: (mode: Settlement) => void;
  readonly completed: Promise<void>;
};

type StatusFetchObservation = {
  readonly generation: number;
  readonly signalId: number | null;
  readonly cache: RequestCache | null;
  readonly aborted: boolean;
  readonly abortEvents: number;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>(resolve => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

const sourceEditorWorkspace = {
  ...buildTemplateWorkspace('welcome'),
  id: 'x4-ui-source-editor-p7-e2e',
  name: 'X4 UI Source Editor P7 E2E',
  passthroughFiles: [
    {
      path: 'ui.xml',
      content: [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<addon name="x4-ui-source-editor-p7-e2e">',
        '  <environment type="menus">',
        '    <file name="ui/x4-ui-source-editor-p7-e2e.lua" />',
        '  </environment>',
        '</addon>',
        '',
      ].join('\n'),
    },
    {
      path: 'ui/x4-ui-source-editor-p7-e2e.lua',
      content: [
        'local menu = { name = "X4UiSourceEditorP7E2E", layer = 1 }',
        'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
        'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
        'local row = table:addRow(false, {})',
        'row[1]:createText("P7 E2E source")',
        'frame:display()',
        '',
      ].join('\n'),
    },
  ],
};

function unavailableBody(marker: string): Record<string, unknown> {
  return {
    available: false,
    state: 'offline',
    root: marker,
    manifest: { available: false, state: 'offline' },
    error: { code: 'status-unavailable', message: marker },
  };
}

const nonSuccessResponseDetail = 'The configured-corpus status endpoint returned a non-success response.';

test('SourceEditor reload and unmount ignore late or aborted corpus generations', async ({ page }) => {
  const pendingByGeneration = new Map<number, PendingStatusRequest[]>();
  const routeOutcomes: string[] = [];
  let activeGeneration = 1;
  let generation2StatusRequests = 0;

  const pendingFor = (generation: number): PendingStatusRequest[] => {
    const existing = pendingByGeneration.get(generation);
    if (existing !== undefined) return existing;
    const created: PendingStatusRequest[] = [];
    pendingByGeneration.set(generation, created);
    return created;
  };

  await page.route('**/api/reference/status', async route => {
    const generation = activeGeneration;
    const url = route.request().url();
    if (generation === 2) {
      generation2StatusRequests += 1;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify(unavailableBody('CURRENT_GENERATION_2_UNAVAILABLE')),
      });
      return;
    }

    const decision = deferred<Settlement>();
    const completion = deferred<void>();
    const pending: PendingStatusRequest = {
      generation,
      url,
      settle: decision.resolve,
      completed: completion.promise,
    };
    pendingFor(generation).push(pending);
    try {
      const mode = await decision.promise;
      if (mode === 'late') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(unavailableBody(`FIRST_GENERATION_${generation}_LATE`)),
        });
        routeOutcomes.push(`${generation}:late`);
      } else {
        await route.abort('failed');
        routeOutcomes.push(`${generation}:abort`);
      }
    } catch {
      // Navigation/reload may have already aborted the intercepted request. The
      // completion still settles so the test can prove the component stayed quiet.
      routeOutcomes.push(`${generation}:route-rejected`);
    } finally {
      completion.resolve();
    }
  });

  async function settleGeneration(generation: number, modes: readonly Settlement[]): Promise<void> {
    const pending = pendingFor(generation);
    pending.forEach((request, index) => request.settle(modes[index % modes.length]));
    await Promise.all(pending.map(request => request.completed));
  }

  await page.addInitScript(() => {
    localStorage.setItem('x4_forge_experience_mode', 'expert');
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.removeItem('x4_mod_studio_version');

    const originalFetch = window.fetch.bind(window);
    const signalIds = new WeakMap<AbortSignal, number>();
    let nextSignalId = 1;
    const harness = {
      generation: 1,
      statusRequests: [] as Array<{
        generation: number;
        signalId: number | null;
        cache: RequestCache | null;
        aborted: boolean;
        abortEvents: number;
      }>,
    };
    Object.defineProperty(window, '__x4UiSourceEditorP7FetchHarness', {
      configurable: true,
      value: harness,
    });
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString();
      if (new URL(requestUrl, window.location.href).pathname !== '/api/reference/status') {
        return originalFetch(input, init);
      }

      const requestSignal = input instanceof Request ? input.signal : undefined;
      const signal = init?.signal ?? requestSignal;
      let signalId: number | null = null;
      if (signal !== undefined) {
        signalId = signalIds.get(signal) ?? null;
        if (signalId === null) {
          signalId = nextSignalId;
          nextSignalId += 1;
          signalIds.set(signal, signalId);
        }
      }
      const observation = {
        generation: harness.generation,
        signalId,
        cache: init?.cache ?? null,
        aborted: signal?.aborted ?? false,
        abortEvents: 0,
      };
      if (signal !== undefined) {
        signal.addEventListener('abort', () => {
          observation.aborted = true;
          observation.abortEvents += 1;
        }, { once: true });
      }
      harness.statusRequests.push(observation);
      return originalFetch(input, init);
    }) as typeof window.fetch;
  });
  await page.route('**/api/agent/health-card**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ verdict: 'ready', summary: 'E2E fixture ready.', rows: [] }),
  }));
  await seedServerWorkspace(sourceEditorWorkspace);

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('studio-workspace')).toBeVisible();

  const uiDesigner = page.locator('[data-workspace-view="ui-designer"]');
  await expect(uiDesigner).toBeVisible();
  await uiDesigner.click();
  await expect(uiDesigner).toHaveAttribute('aria-current', 'page');

  const editor = page.getByTestId('x4-ui-source-editor');
  const corpusStatus = page.getByTestId('x4-ui-corpus-status');
  const corpusDetail = page.getByTestId('x4-ui-corpus-detail');
  const gameTruth = page.getByTestId('x4-ui-game-truth');
  const colorStatus = page.getByTestId('x4-ui-corpus-color-status');
  const colorDetail = page.getByTestId('x4-ui-corpus-color-detail');
  await expect(editor).toBeVisible();
  await expect(corpusStatus).toBeVisible();
  await expect(corpusDetail).toBeVisible();
  await expect(gameTruth).toHaveText(/^Not verified in game$/);
  await expect(colorStatus).toHaveCount(1);
  await expect(colorDetail).toHaveCount(1);
  await expect(colorStatus).toBeVisible();
  await expect(colorDetail).toBeVisible();
  await expect.poll(() => pendingFor(1).length).toBeGreaterThanOrEqual(2);
  expect(new Set(pendingFor(1).map(request => new URL(request.url).pathname))).toEqual(new Set(['/api/reference/status']));
  await expect(page.getByTestId('health-card')).toHaveCount(0);

  activeGeneration = 2;
  await page.evaluate(() => {
    const harness = (window as unknown as {
      __x4UiSourceEditorP7FetchHarness?: { generation: number };
    }).__x4UiSourceEditorP7FetchHarness;
    if (harness === undefined) throw new Error('SourceEditor fetch harness was not installed');
    harness.generation = 2;
  });
  await page.getByTestId('x4-ui-corpus-reload').click();
  await expect.poll(() => generation2StatusRequests).toBeGreaterThanOrEqual(2);
  await expect(corpusStatus).toHaveText(/^\s*unavailable\s*$/i);
  await expect(corpusDetail).toHaveText(nonSuccessResponseDetail);
  await expect(colorStatus).toHaveText(/^\s*unavailable\s*$/i);
  await expect(colorDetail).toHaveText(nonSuccessResponseDetail);
  const currentStatus = (await corpusStatus.textContent()) ?? '';
  const currentDetail = (await corpusDetail.textContent()) ?? '';
  const currentColorStatus = (await colorStatus.textContent()) ?? '';
  const currentColorDetail = (await colorDetail.textContent()) ?? '';
  await expect(gameTruth).toHaveText(/^Not verified in game$/);
  expect(currentStatus).not.toContain('FIRST_GENERATION');
  expect(currentDetail).not.toContain('FIRST_GENERATION');
  expect(currentColorStatus).not.toContain('FIRST_GENERATION');
  expect(currentColorDetail).not.toContain('FIRST_GENERATION');

  await settleGeneration(1, ['late', 'abort']);
  await expect(corpusStatus).toHaveText(currentStatus);
  await expect(corpusDetail).toHaveText(currentDetail);
  await expect(gameTruth).toHaveText(/^Not verified in game$/);
  await expect(colorStatus).toHaveText(currentColorStatus);
  await expect(colorDetail).toHaveText(currentColorDetail);
  expect(routeOutcomes.filter(outcome => outcome.startsWith('1:')).length).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);

  activeGeneration = 3;
  const generation3ObservationStart = await page.evaluate(() => {
    const harness = (window as unknown as {
      __x4UiSourceEditorP7FetchHarness?: { statusRequests: StatusFetchObservation[] };
    }).__x4UiSourceEditorP7FetchHarness;
    if (harness === undefined) throw new Error('SourceEditor fetch harness was not installed');
    return harness.statusRequests.length;
  });
  await page.evaluate(() => {
    const harness = (window as unknown as {
      __x4UiSourceEditorP7FetchHarness?: { generation: number };
    }).__x4UiSourceEditorP7FetchHarness;
    if (harness === undefined) throw new Error('SourceEditor fetch harness was not installed');
    harness.generation = 3;
  });
  await page.getByTestId('x4-ui-corpus-reload').click();
  await expect.poll(() => pendingFor(3).length).toBeGreaterThanOrEqual(2);
  const readGeneration3StatusCohort = async (): Promise<StatusFetchObservation[]> =>
    page.evaluate((observationStart: number) => {
      const harness = (window as unknown as {
        __x4UiSourceEditorP7FetchHarness?: { statusRequests: StatusFetchObservation[] };
      }).__x4UiSourceEditorP7FetchHarness;
      if (harness === undefined) throw new Error('SourceEditor fetch harness was not installed');
      return harness.statusRequests.slice(observationStart);
    }, generation3ObservationStart);

  // Static SourceEditor coverage owns the shared upstream lifecycle-signal
  // identity. At this mounted boundary customFetch owns one deadline-derived
  // signal per request, so this exact core/colour cohort must have two distinct
  // live identities that both receive the upstream cleanup abort.
  await expect.poll(async () => {
    const observations = await readGeneration3StatusCohort();
    return {
      requestCount: observations.length,
      generation3Count: observations.filter(request => request.generation === 3).length,
      signaledCount: observations.filter(request => request.signalId !== null).length,
    };
  }, { message: 'wait for the exact generation-three core/colour request cohort' }).toEqual({
    requestCount: 2,
    generation3Count: 2,
    signaledCount: 2,
  });

  const generation3StatusCohort = await readGeneration3StatusCohort();
  expect(generation3StatusCohort).toHaveLength(2);
  expect(generation3StatusCohort.every(request => request.generation === 3)).toBe(true);
  expect(generation3StatusCohort.map(request => request.cache)).toEqual(['no-store', 'no-store']);
  expect(generation3StatusCohort.every(request => !request.aborted && request.abortEvents === 0)).toBe(true);
  expect(pendingFor(3), 'the held route cohort must contain exactly core and colour').toHaveLength(2);
  const cohortSignalIds = new Set(generation3StatusCohort.map(request => request.signalId));
  expect(cohortSignalIds.has(null)).toBe(false);
  expect(cohortSignalIds.size, 'customFetch must derive one deadline signal per request').toBe(2);
  const selectedSignalIds = Object.freeze(
    Array.from(cohortSignalIds).filter((signalId): signalId is number => signalId !== null),
  );
  expect(selectedSignalIds).toHaveLength(2);

  await page.locator('[data-workspace-view="blueprint"]').click();
  await expect(page.locator('[data-workspace-view="blueprint"]')).toHaveAttribute('aria-current', 'page');
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => {
    const observations = await readGeneration3StatusCohort();
    const selectedSignals = new Set(selectedSignalIds);
    const selectedObservations = observations.filter(
      request => request.signalId !== null && selectedSignals.has(request.signalId),
    );
    return {
      requestCount: observations.length,
      generation3Count: observations.filter(request => request.generation === 3).length,
      selectedCount: selectedObservations.length,
      selectedSignalCount: new Set(selectedObservations.map(request => request.signalId)).size,
      abortedCount: selectedObservations.filter(request => request.aborted).length,
      abortEventCount: selectedObservations.filter(request => request.abortEvents > 0).length,
    };
  }, { message: 'wait for both selected deadline signals to abort before route settlement' }).toEqual({
    requestCount: 2,
    generation3Count: 2,
    selectedCount: 2,
    selectedSignalCount: 2,
    abortedCount: 2,
    abortEventCount: 2,
  });
  const abortedGeneration3StatusCohort = await readGeneration3StatusCohort();
  expect(abortedGeneration3StatusCohort).toHaveLength(2);
  expect(new Set(abortedGeneration3StatusCohort.map(request => request.signalId))).toEqual(new Set(selectedSignalIds));
  expect(abortedGeneration3StatusCohort.every(request => request.aborted && request.abortEvents > 0)).toBe(true);
  expect(pendingFor(3), 'route settlement must follow both derived-signal aborts').toHaveLength(2);
  await settleGeneration(3, ['abort', 'late']);
  await expect(editor).toHaveCount(0);
  expect(routeOutcomes.filter(outcome => outcome.startsWith('3:')).length).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});

test('SourceEditor exports only the current mounted PNG evidence', async ({ page, request }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const downloads: unknown[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('download', download => downloads.push(download));
  await page.addInitScript(() => {
    localStorage.setItem('x4_forge_experience_mode', 'expert');
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.removeItem('x4_mod_studio_version');
  });
  await page.route('**/api/agent/health-card**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ verdict: 'ready', summary: 'E2E export fixture ready.', rows: [] }),
  }));
  const referenceRoot = 'source-editor-p7-e2e-canonical-root';
  const referenceGeneration = 'source-editor-p7-e2e-generation';
  const referenceGeneratedAt = '2026-09-02T00:00:00.000Z';
  await page.route('**/api/reference/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      available: true,
      root: referenceRoot,
      generatedAt: referenceGeneratedAt,
      manifestGeneration: referenceGeneration,
      manifest: {
        available: true,
        state: 'ready',
        root: referenceRoot,
        current: { generation: referenceGeneration, root: referenceRoot, generatedAt: referenceGeneratedAt },
      },
    }),
  }));
  await page.route('**/api/reference/manifest**', async route => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.searchParams.get('q');
    const fileBytes = path === null ? undefined : await (async () => {
      const fileUrl = new URL('/api/reference/file', requestUrl.origin);
      fileUrl.searchParams.set('path', path);
      const fileResponse = await request.get(fileUrl.toString());
      if (!fileResponse.ok()) throw new Error(`SourceEditor export fixture file request failed: ${fileResponse.status()}`);
      const fileBody = await fileResponse.body();
      const contentLength = Number(fileResponse.headers()['content-length']);
      return Number.isSafeInteger(contentLength) && contentLength >= 0 ? contentLength : fileBody.byteLength;
    })();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: {
          available: true,
          state: 'ready',
          root: referenceRoot,
          current: {
            generation: referenceGeneration,
            root: referenceRoot,
            generatedAt: referenceGeneratedAt,
          },
        },
        generation: referenceGeneration,
        total: path === null ? 0 : 1,
        limit: 500,
        offset: 0,
        files: path === null || fileBytes === undefined ? [] : [{ path, bytes: fileBytes }],
      }),
    });
  });
  await seedServerWorkspace(sourceEditorWorkspace);
  await page.goto('/');
  await expect(page.getByTestId('studio-workspace')).toBeVisible();

  const uiDesigner = page.locator('[data-workspace-view="ui-designer"]');
  await uiDesigner.click();
  await expect(uiDesigner).toHaveAttribute('aria-current', 'page');
  const editor = page.getByTestId('x4-ui-source-editor');
  await expect(editor).toBeVisible();

  const exportButton = page.getByTestId('x4-ui-canvas-export');
  const exportStatus = page.getByTestId('x4-ui-canvas-export-status');
  const canvasHost = page.getByTestId('x4-ui-canvas-host');
  const canvas = canvasHost.locator('canvas');
  const sourceSelector = page.getByTestId('x4-ui-source-selector');
  const targetSelector = page.getByTestId('x4-ui-target-selector');
  const scaleMode = page.getByTestId('x4-ui-profile-scale-mode');
  const userScale = page.getByTestId('x4-ui-profile-user-scale');
  const effectiveScale = page.getByTestId('x4-ui-profile-scale');
  const gameTruth = page.getByTestId('x4-ui-game-truth');
  await expect(exportButton).toBeDisabled();
  await expect(canvas).toHaveCount(0);
  await expect(gameTruth).toHaveText(/^Not verified in game$/);
  await expect(scaleMode).toHaveValue('derived-from-x4-user-scale');
  await expect(userScale).toHaveValue('1.05');
  await expect(effectiveScale).toHaveValue('1.4');
  await expect(effectiveScale).toBeDisabled();
  await expect(page.getByTestId('x4-ui-profile-scale-derivation')).toContainText('drawable height');
  await expect(page.getByTestId('x4-ui-profile-scale-derivation')).toContainText('1080');
  await expect(page.getByTestId('x4-ui-profile-scale-derivation')).toContainText('Drawable width does not affect');
  await expect(page.getByTestId('x4-ui-corpus-status')).toHaveText(/^canonical$/i);

  const sourceOption = sourceSelector.locator('option').filter({ hasText: 'ui/x4-ui-source-editor-p7-e2e.lua' }).first();
  await expect(sourceOption).toHaveCount(1);
  const sourceValue = await sourceOption.getAttribute('value');
  if (sourceValue === null) throw new Error('SourceEditor export fixture source option has no value');
  await sourceSelector.selectOption(sourceValue);
  const targetOption = targetSelector.locator('option').nth(1);
  await expect(targetOption).toHaveCount(1);
  const targetLabel = (await targetOption.textContent())?.trim();
  if (targetLabel === undefined || targetLabel.length === 0) throw new Error('SourceEditor export fixture target option has no label');
  const targetValue = await targetOption.getAttribute('value');
  if (targetValue === null) throw new Error('SourceEditor export fixture target option has no value');
  await targetSelector.selectOption(targetValue);

  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('width', '2560');
  await expect(canvas).toHaveAttribute('height', '1440');
  await expect(exportButton).toBeEnabled();
  await expect(page.getByTestId('x4-ui-canvas-export-source')).toContainText('ui/x4-ui-source-editor-p7-e2e.lua');
  await expect(page.getByTestId('x4-ui-canvas-export-target')).toContainText(targetLabel);
  await expect(page.getByTestId('x4-ui-canvas-export-profile')).toContainText('2560 × 1440');
  await expect(page.getByTestId('x4-ui-canvas-export-profile')).toContainText('Effective Helper scale 1.4');
  await expect(page.getByTestId('x4-ui-canvas-export-native-width')).toHaveText('2560');
  await expect(page.getByTestId('x4-ui-canvas-export-native-height')).toHaveText('1440');
  await expect(page.getByTestId('x4-ui-canvas-export-boundary')).toHaveText(/^Preview evidence only · Not verified in game$/);

  await page.evaluate(() => {
    const host = document.querySelector('[data-testid="x4-ui-canvas-host"]');
    const current = host?.firstElementChild;
    if (!(current instanceof HTMLCanvasElement)) throw new Error('SourceEditor export fixture did not mount an HTMLCanvasElement');
    (window as unknown as { __x4UiExportCanvasBefore?: Element }).__x4UiExportCanvasBefore = current;
  });
  const firstDownloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const firstDownload = await firstDownloadPromise;
  await expect.poll(() => downloads.length).toBe(1);
  const firstFilename = firstDownload.suggestedFilename();
  expect(firstFilename).toMatch(/^x4-ui-[A-Za-z0-9._-]+-[A-Za-z0-9._-]+-2560x1440-effective-scale-1\.4\.png$/);
  await expect(exportStatus).toHaveText(/exported one image\/png/);
  await expect(exportStatus).toContainText('Not verified in game');
  const sameMountedCanvasAfterExport = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="x4-ui-canvas-host"]');
    const before = (window as unknown as { __x4UiExportCanvasBefore?: Element }).__x4UiExportCanvasBefore;
    return host?.firstElementChild === before;
  });
  expect(sameMountedCanvasAfterExport).toBe(true);
  await expect(gameTruth).toHaveText(/^Not verified in game$/);

  await sourceSelector.selectOption('');
  await expect(exportButton).toBeDisabled();
  await expect(targetSelector).toHaveValue('');
  await expect(canvas).toHaveCount(1);
  await expect(page.getByTestId('x4-ui-canvas-status')).toHaveText(/stale|refused/);
  await expect(gameTruth).toHaveText(/^Not verified in game$/);

  await sourceSelector.selectOption(sourceValue);
  await targetSelector.selectOption(targetValue);
  await expect(canvas).toHaveAttribute('width', '2560');
  await expect(canvas).toHaveAttribute('height', '1440');
  await expect(exportButton).toBeEnabled();

  await page.getByTestId('x4-ui-profile-width').fill('1800');
  await expect(canvas).toHaveAttribute('width', '1800');
  await expect(canvas).toHaveAttribute('height', '1440');
  await expect(exportButton).toBeEnabled();
  await page.getByTestId('x4-ui-profile-height').fill('900');
  await expect(canvas).toHaveAttribute('width', '1800');
  await expect(canvas).toHaveAttribute('height', '900');
  await expect(exportButton).toBeEnabled();
  await expect(page.getByTestId('x4-ui-canvas-export-profile')).toContainText('1800 × 900');
  await expect(page.getByTestId('x4-ui-canvas-export-profile')).toContainText('Effective Helper scale 0.875');
  await expect(page.getByTestId('x4-ui-canvas-export-native-width')).toHaveText('1800');
  await expect(page.getByTestId('x4-ui-canvas-export-native-height')).toHaveText('900');
  await expect(effectiveScale).toHaveValue('0.875');
  const secondDownloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const secondDownload = await secondDownloadPromise;
  await expect.poll(() => downloads.length).toBe(2);
  expect(secondDownload.suggestedFilename()).toMatch(/-1800x900-effective-scale-0\.875\.png$/);
  await expect(exportStatus).toHaveText(/exported one image\/png/);

  const downloadCountBeforeSerializationNegatives = downloads.length;
  const serializationNegative = async (mode: 'missing' | 'throw' | 'empty', expected: RegExp): Promise<void> => {
    await page.evaluate((selectedMode: 'missing' | 'throw' | 'empty') => {
      const host = document.querySelector('[data-testid="x4-ui-canvas-host"]');
      const current = host?.firstElementChild;
      if (!(current instanceof HTMLCanvasElement)) throw new Error('SourceEditor export fixture canvas disappeared');
      Object.defineProperty(current, 'toBlob', {
        configurable: true,
        value: selectedMode === 'missing'
          ? undefined
          : selectedMode === 'throw'
            ? () => { throw new Error('fixture serialization throw'); }
            : (callback: BlobCallback) => callback(new Blob([], { type: 'image/png' })),
      });
    }, mode);
    await exportButton.click();
    await expect(exportStatus).toHaveText(expected);
    await page.evaluate(() => {
      const host = document.querySelector('[data-testid="x4-ui-canvas-host"]');
      const current = host?.firstElementChild;
      if (current instanceof HTMLCanvasElement) delete (current as unknown as { toBlob?: unknown }).toBlob;
    });
    await expect.poll(() => downloads.length).toBe(downloadCountBeforeSerializationNegatives);
  };
  await serializationNegative('missing', /refused: native PNG serialization is unavailable/);
  await serializationNegative('throw', /refused: native PNG serialization threw before producing a blob/);
  await serializationNegative('empty', /refused: native PNG serialization returned an empty or non-PNG blob/);

  await expect(gameTruth).toHaveText(/^Not verified in game$/);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('SourceEditor scale mode causally tracks drawable height and custom retention', async ({ page, request }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem('x4_forge_experience_mode', 'expert');
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.removeItem('x4_mod_studio_version');
  });
  await page.route('**/api/agent/health-card**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ verdict: 'ready', summary: 'E2E scale fixture ready.', rows: [] }),
  }));
  const referenceRoot = 'source-editor-p7-e2e-canonical-root';
  const referenceGeneration = 'source-editor-p7-e2e-generation';
  const referenceGeneratedAt = '2026-09-02T00:00:00.000Z';
  await page.route('**/api/reference/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      available: true,
      root: referenceRoot,
      generatedAt: referenceGeneratedAt,
      manifestGeneration: referenceGeneration,
      manifest: {
        available: true,
        state: 'ready',
        root: referenceRoot,
        current: { generation: referenceGeneration, root: referenceRoot, generatedAt: referenceGeneratedAt },
      },
    }),
  }));
  await page.route('**/api/reference/manifest**', async route => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.searchParams.get('q');
    const fileBytes = path === null ? undefined : await (async () => {
      const fileUrl = new URL('/api/reference/file', requestUrl.origin);
      fileUrl.searchParams.set('path', path);
      const fileResponse = await request.get(fileUrl.toString());
      if (!fileResponse.ok()) throw new Error(`SourceEditor scale fixture file request failed: ${fileResponse.status()}`);
      const fileBody = await fileResponse.body();
      const contentLength = Number(fileResponse.headers()['content-length']);
      return Number.isSafeInteger(contentLength) && contentLength >= 0 ? contentLength : fileBody.byteLength;
    })();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: {
          available: true,
          state: 'ready',
          root: referenceRoot,
          current: {
            generation: referenceGeneration,
            root: referenceRoot,
            generatedAt: referenceGeneratedAt,
          },
        },
        generation: referenceGeneration,
        total: path === null ? 0 : 1,
        limit: 500,
        offset: 0,
        files: path === null || fileBytes === undefined ? [] : [{ path, bytes: fileBytes }],
      }),
    });
  });
  await seedServerWorkspace(sourceEditorWorkspace);
  await page.goto('/');
  await expect(page.getByTestId('studio-workspace')).toBeVisible();

  const uiDesigner = page.locator('[data-workspace-view="ui-designer"]');
  await uiDesigner.click();
  await expect(uiDesigner).toHaveAttribute('aria-current', 'page');
  const editor = page.getByTestId('x4-ui-source-editor');
  await expect(editor).toBeVisible();

  const canvasHost = page.getByTestId('x4-ui-canvas-host');
  const canvas = canvasHost.locator('canvas');
  const sourceSelector = page.getByTestId('x4-ui-source-selector');
  const targetSelector = page.getByTestId('x4-ui-target-selector');
  const scaleMode = page.getByTestId('x4-ui-profile-scale-mode');
  const userScale = page.getByTestId('x4-ui-profile-user-scale');
  const effectiveScale = page.getByTestId('x4-ui-profile-scale');
  const width = page.getByTestId('x4-ui-profile-width');
  const height = page.getByTestId('x4-ui-profile-height');
  const canvasStatus = page.getByTestId('x4-ui-canvas-status');
  const gameTruth = page.getByTestId('x4-ui-game-truth');

  await expect(scaleMode).toHaveValue('derived-from-x4-user-scale');
  await expect(effectiveScale).toBeDisabled();
  await width.fill('320');
  await height.fill('360');
  await userScale.fill('1.2');
  await expect(width).toHaveValue('320');
  await expect(height).toHaveValue('360');
  await expect(userScale).toHaveValue('1.2');
  await expect(effectiveScale).toHaveValue('0.4');
  await expect(canvas).toHaveCount(0);

  const sourceOption = sourceSelector.locator('option').filter({ hasText: 'ui/x4-ui-source-editor-p7-e2e.lua' }).first();
  await expect(sourceOption).toHaveCount(1);
  const sourceValue = await sourceOption.getAttribute('value');
  if (sourceValue === null) throw new Error('SourceEditor scale fixture source option has no value');
  await sourceSelector.selectOption(sourceValue);
  const targetOption = targetSelector.locator('option').nth(1);
  await expect(targetOption).toHaveCount(1);
  const targetValue = await targetOption.getAttribute('value');
  if (targetValue === null) throw new Error('SourceEditor scale fixture target option has no value');
  await targetSelector.selectOption(targetValue);

  const expectDerivedScale = async (drawableHeight: number, expected: string): Promise<void> => {
    await expect(effectiveScale).toHaveValue(expected);
    expect(Number(await effectiveScale.inputValue())).toBeCloseTo(
      Number(await userScale.inputValue()) * drawableHeight / 1080,
      6,
    );
    await expect(canvasStatus).toHaveText(/rendered\/current/);
    await expect(gameTruth).toHaveText(/^Not verified in game$/);
  };
  const expectCurrentCanvas = async (): Promise<void> => {
    await expect(canvasStatus).toHaveText(/rendered\/current/);
    await expect(gameTruth).toHaveText(/^Not verified in game$/);
  };

  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('width', '320');
  await expect(canvas).toHaveAttribute('height', '360');
  await expect(scaleMode).toHaveValue('derived-from-x4-user-scale');
  await expectDerivedScale(360, '0.4');

  await height.fill('540');
  await expect(canvas).toHaveAttribute('width', '320');
  await expect(canvas).toHaveAttribute('height', '540');
  await expectDerivedScale(540, '0.6');

  await width.fill('480');
  await expect(canvas).toHaveAttribute('width', '480');
  await expect(canvas).toHaveAttribute('height', '540');
  await expect(effectiveScale).toHaveValue('0.6');
  await expectCurrentCanvas();

  await scaleMode.selectOption('custom-effective-helper-scale');
  await expect(scaleMode).toHaveValue('custom-effective-helper-scale');
  await expect(effectiveScale).toBeEnabled();
  await expectCurrentCanvas();
  await effectiveScale.fill('0.75');
  await expect(effectiveScale).toHaveValue('0.75');
  await expectCurrentCanvas();

  await height.fill('360');
  await expect(canvas).toHaveAttribute('width', '480');
  await expect(canvas).toHaveAttribute('height', '360');
  await expect(effectiveScale).toHaveValue('0.75');
  await expect(userScale).toHaveValue('1.2');
  await expectCurrentCanvas();

  await width.fill('640');
  await expect(canvas).toHaveAttribute('width', '640');
  await expect(canvas).toHaveAttribute('height', '360');
  await expect(effectiveScale).toHaveValue('0.75');
  await expect(userScale).toHaveValue('1.2');
  await expectCurrentCanvas();

  await scaleMode.selectOption('derived-from-x4-user-scale');
  await expect(scaleMode).toHaveValue('derived-from-x4-user-scale');
  await expect(effectiveScale).toBeDisabled();
  await expect(canvas).toHaveAttribute('width', '640');
  await expect(canvas).toHaveAttribute('height', '360');
  await expectDerivedScale(360, '0.4');
  await expect(userScale).toHaveValue('1.2');
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
