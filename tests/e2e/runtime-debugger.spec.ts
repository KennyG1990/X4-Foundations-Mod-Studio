import { expect, test, type Page } from '@playwright/test';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import type { RuntimeDebuggerPayload } from '../../src/lib/runtimeDebuggerView';
import type { ModWorkspace } from '../../src/types';
import { seedServerWorkspace } from './ephemeral';

const RUNTIME_NODE_ID = 'cancel_conversation';

type E2EWindow = Window & {
  __X4_E2E__?: {
    getWorkspace: () => { name: string };
  };
  __nativeMessages?: Record<string, unknown>[];
};

type RuntimeIncident = RuntimeDebuggerPayload['incidents'][number];
type RuntimeDisposition = RuntimeIncident['attribution']['disposition'];

const runtimeWorkspace: ModWorkspace = (() => {
  const template = buildTemplateWorkspace('welcome');
  return {
    ...template,
    id: 'e2e_runtime_debugger',
    name: 'AiLive',
    contentId: 'x4_ai_influence',
    sourceFolder: 'F:/e2e/AiLive',
    mdScriptName: 'ai_influence_conversation',
    mdFileStem: 'ai_influence_conversation',
    nodes: template.nodes.map(node => node.id === 'msg' ? {
      ...node,
      id: RUNTIME_NODE_ID,
      label: 'cancel_conversation',
      xmlTag: 'cancel_conversation',
      properties: {},
    } : node),
    links: template.links.map(link => ({
      ...link,
      sourceNodeId: link.sourceNodeId === 'msg' ? RUNTIME_NODE_ID : link.sourceNodeId,
      targetNodeId: link.targetNodeId === 'msg' ? RUNTIME_NODE_ID : link.targetNodeId,
    })),
  };
})();

function makeIncident({
  key,
  disposition = 'confirmed_active',
  firstLine,
  lastLine = firstLine,
  count = 1,
  classification = 'runtime_observation',
  severity = 'info',
  isEngineFailure = false,
  attributionReason = 'Exact runtime evidence is attributed to the active workspace.',
  mapping = { kind: 'unmapped', reason: 'No safe source mapping was supplied for this fixture row.' },
  explanation = {
    cause: 'Deterministic fixture evidence was observed.',
    impact: 'The fixture row has no additional engine impact.',
    nextAction: 'Review the bounded runtime evidence if needed.',
    evidenceLabel: 'runtime evidence',
    summary: 'Bounded runtime evidence.',
  },
  evidence = [`fixture evidence for ${key}`],
  samples = [],
}: {
  key: string;
  disposition?: RuntimeDisposition;
  firstLine: number;
  lastLine?: number;
  count?: number;
  classification?: string;
  severity?: 'error' | 'warning' | 'info';
  isEngineFailure?: boolean;
  attributionReason?: string;
  mapping?: RuntimeIncident['mapping'];
  explanation?: RuntimeIncident['explanation'];
  evidence?: string[];
  samples?: RuntimeIncident['samples'];
}): RuntimeIncident {
  const isActive = disposition === 'confirmed_active';
  return {
    key,
    count,
    firstLine,
    lastLine,
    candidateIds: [`${key}-candidate`],
    omittedCandidateIds: 0,
    attribution: {
      disposition,
      confidence: isActive ? 0.99 : 0.25,
      reason: attributionReason,
      evidence: [],
      ...(isActive ? { matchedOwnerId: 'x4_ai_influence', matchedWorkspaceId: 'workspace-AiLive' } : {}),
    },
    mapping,
    explanation,
    evidence,
    samples,
    classification,
    severity,
    isEngineFailure,
  };
}

function makeCoverage(overrides: Partial<RuntimeDebuggerPayload['coverage']> = {}): RuntimeDebuggerPayload['coverage'] {
  return {
    candidates: 100,
    recognized: 99,
    explicitUnknown: 1,
    silentlyDropped: 0,
    recognizedOrExplicitUnknown: 100,
    recognizedOrExplicitUnknownRatio: 1,
    dispositionCounts: {
      confirmed_active: 95,
      ambiguous: 1,
      excluded_other_mod: 4,
      unknown: 0,
    },
    dispositionSum: 100,
    target: 0.99,
    met: true,
    ...overrides,
  };
}

function makePayload({
  session = {},
  incidents = makeCurrentIncidents(),
  coverage = {},
  expectedSteps = [
    { id: 'save_identity', label: 'Save identity', truth: 'observed', observed: true, success: true, evidence: ['Save_identity'] },
    { id: 'chat_boot', label: 'Chat boot', truth: 'missing', observed: false, success: false, evidence: [] },
    { id: 'poll_tick', label: 'Poll tick', truth: 'unavailable', observed: false, success: false, evidence: [] },
  ],
  hiddenOtherModCount = 2,
  ambiguousCount = 1,
}: {
  session?: Partial<RuntimeDebuggerPayload['session']>;
  incidents?: RuntimeDebuggerPayload['incidents'];
  coverage?: Partial<RuntimeDebuggerPayload['coverage']>;
  expectedSteps?: RuntimeDebuggerPayload['expectedSteps'];
  hiddenOtherModCount?: number;
  ambiguousCount?: number;
} = {}): RuntimeDebuggerPayload {
  return {
    authority: {
      workspaceId: 'workspace-AiLive',
      contentId: 'x4_ai_influence',
      displayName: 'AiLive / x4_ailive',
      sourceFolder: 'F:/e2e/AiLive',
      deployedFolder: 'x4_ai_influence',
    },
    session: {
      state: 'current',
      sessionId: 'runtime-session-ai-live-001',
      logPath: 'F:/e2e/AiLive/debug.log',
      generation: 4,
      firstLine: 95,
      lastLine: 116,
      newlyReadBytes: 4096,
      observedAt: '2026-08-08T12:00:00.000Z',
      detail: 'Current runtime segment is authoritative for the active workspace.',
      ...session,
    },
    incidents,
    coverage: makeCoverage(coverage),
    expectedSteps,
    hiddenOtherModCount,
    ambiguousCount,
  };
}

function makeCurrentIncidents(): RuntimeDebuggerPayload['incidents'] {
  const engineFailure = makeIncident({
    key: 'md/ai_influence_conversation.xml:98',
    firstLine: 98,
    classification: 'engine_failure',
    severity: 'error',
    isEngineFailure: true,
    mapping: {
      kind: 'node',
      file: 'md/ai_influence_conversation.xml',
      line: 98,
      nodeId: RUNTIME_NODE_ID,
      nodeLabel: 'cancel_conversation',
      reason: 'Exact file and line map to the deepest cancel_conversation node in the active workspace.',
    },
    explanation: {
      cause: 'X4 reported an engine fault at the conversation cue.',
      impact: 'The conversation cue stopped before its next action executed.',
      nextAction: 'Open the mapped node and repair the failing conversation step.',
      evidenceLabel: 'engine failure at md/ai_influence_conversation.xml:98',
      summary: 'Confirmed active engine failure.',
    },
    evidence: ['Runtime error: md/ai_influence_conversation.xml:98', 'exact deployed content id x4_ai_influence'],
    samples: [{ firstLine: 98, lastLine: 98, text: 'runtime fault in AI influence conversation' }],
  });

  const authoredDiagnostic = makeIncident({
    key: 'authored-diagnostic-runtime-evidence',
    firstLine: 120,
    classification: 'authored_diagnostic',
    severity: 'info',
    isEngineFailure: false,
    attributionReason: 'The authored marker belongs to the active mod but is informational evidence.',
    mapping: {
      kind: 'file_line',
      file: 'md/ai_influence_conversation.xml',
      line: 104,
      reason: 'The authored diagnostic has an exact file and line but no modeled node.',
    },
    explanation: {
      cause: 'The line is an authored diagnostic/runtime-evidence marker from the mod.',
      impact: 'It records runtime evidence without proving an engine failure.',
      nextAction: 'Use the later engine evidence to decide whether source repair is needed.',
      evidenceLabel: 'authored diagnostic marker',
      summary: 'Informational authored runtime evidence.',
    },
    evidence: ['[=ERROR=] authored diagnostic/runtime-evidence marker'],
  });

  const ambiguous = makeIncident({
    key: 'ambiguous-runtime-ownership-collision',
    disposition: 'ambiguous',
    firstLine: 210,
    classification: 'runtime_failure',
    severity: 'error',
    isEngineFailure: true,
    attributionReason: 'Display-name evidence collides across possible owners; node navigation is withheld.',
    mapping: {
      kind: 'file_line',
      file: 'md/ai_influence_conversation.xml',
      line: 210,
      reason: 'Ambiguous ownership prevents a safe node mapping.',
    },
    explanation: {
      cause: 'The line looks failure-like, but ownership is ambiguous.',
      impact: 'The affected source cannot be assigned safely to this workspace.',
      nextAction: 'Confirm the deployed owner before navigating or changing source.',
      evidenceLabel: 'ambiguous runtime evidence',
      summary: 'Unresolved ownership collision.',
    },
    evidence: ['display-name collision between AiLive and another extension'],
  });

  const boundedRows = Array.from({ length: 5 }, (_, index) => makeIncident({
    key: `bounded-runtime-observation-${index + 1}`,
    firstLine: 110 + index,
    classification: 'runtime_observation',
    severity: 'info',
    isEngineFailure: false,
  }));

  const unresolvedRows = Array.from({ length: 5 }, (_, index) => makeIncident({
    key: `unresolved-runtime-observation-${index + 1}`,
    disposition: 'unknown',
    firstLine: 200 + index,
    classification: 'runtime_failure',
    severity: 'warning',
    isEngineFailure: false,
    attributionReason: 'The runtime line has no reliable active-owner evidence.',
  }));

  const unrelated = makeIncident({
    key: 'unrelated-extension-engine-failure',
    disposition: 'excluded_other_mod',
    firstLine: 50,
    count: 4,
    classification: 'engine_failure',
    severity: 'error',
    isEngineFailure: true,
    attributionReason: 'Exact evidence belongs to an unrelated extension and is hidden from the active view.',
  });

  // The engine failure, authored evidence, five active observations, and the newest
  // ambiguous row fit inside the eight-row presentation bound. Older unresolved rows
  // remain present in the payload so the omitted-group count is independently visible.
  return [engineFailure, authoredDiagnostic, ambiguous, ...boundedRows, ...unresolvedRows, unrelated];
}

function makeFileLinePayload(): RuntimeDebuggerPayload {
  return makePayload({
    incidents: [makeIncident({
      key: 'lua/runtime_fault.lua:7',
      firstLine: 7,
      classification: 'authored_diagnostic',
      severity: 'info',
      isEngineFailure: false,
      mapping: {
        kind: 'file_line',
        file: 'lua/runtime_fault.lua',
        line: 7,
        reason: 'Exact active Lua file and one-based source line; no modeled node span exists.',
      },
      explanation: {
        cause: 'The Lua runtime reported an exact source failure.',
        impact: 'The Lua handler stopped at the reported line.',
        nextAction: 'Open the exact Lua source line and repair the handler.',
        evidenceLabel: 'exact Lua runtime failure',
        summary: 'Confirmed active Lua file-line failure.',
      },
      evidence: ['lua/runtime_fault.lua:7', 'exact active Lua ownership'],
      samples: [{ firstLine: 7, lastLine: 7, text: 'attempt to index a nil value' }],
    })],
    coverage: makeCoverage({
      candidates: 1,
      recognized: 1,
      explicitUnknown: 0,
      recognizedOrExplicitUnknown: 1,
      recognizedOrExplicitUnknownRatio: 1,
      dispositionCounts: { confirmed_active: 1, ambiguous: 0, excluded_other_mod: 0, unknown: 0 },
      dispositionSum: 1,
      met: true,
    }),
    expectedSteps: [],
    hiddenOtherModCount: 0,
    ambiguousCount: 0,
  });
}

async function bootRuntimeDebugger(
  page: Page,
  payload: RuntimeDebuggerPayload,
  options: { nativeHost?: boolean } = {},
): Promise<() => number> {
  await seedServerWorkspace(runtimeWorkspace);
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('x4_mod_studio_workspace');
      localStorage.removeItem('x4_mod_studio_version');
      localStorage.setItem('x4_forge_experience_mode', 'expert');
    } catch {
      // The native-host wrapper uses an about:blank parent; the Forge iframe has storage.
    }
  });

  let legacyGameLogRequestCount = 0;

  await page.route('**/api/agent/debug-watcher/brief**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      runtimeDebugger: payload,
      brief: 'Runtime watcher summary is available behind progressive disclosure.',
      timeline: [{ kind: 'runtime', severity: 'error', label: 'runtime error', lineNumber: 98, evidence: 'fixture timeline evidence' }],
      expectedChain: [{ step: 'Save_identity', seen: true, evidence: 'fixture marker' }],
    }),
  }));
  await page.route('**/api/agent/compile', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ diagnostics: [], validation: { scope: 'full-project', ok: true } }),
  }));
  await page.route('**/api/agent/game-log/status**', route => {
    legacyGameLogRequestCount += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'no_log', modId: 'ailive', summary: 'The legacy log card is superseded by the runtime debugger fixture.' }),
    });
  });
  await page.route('**/api/agent/live/cue-telemetry**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ available: false, live: false, cues: [], watches: [], bridge: { bridgeUp: false, gameActive: false } }),
  }));
  await page.route('**/api/agent/live/forge-state**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ available: false, live: false }),
  }));
  await page.route('**/api/agent/health-card**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ verdict: 'ok', summary: 'E2E fixture', rows: [] }),
  }));

  if (options.nativeHost) {
    await page.setContent(`<!doctype html><html><body style="margin:0">
      <iframe id="forge" src="http://127.0.0.1:3100/" style="border:0;width:1600px;height:1000px"></iframe>
      <script>
        window.__nativeMessages = [];
        window.addEventListener('message', event => {
          if (event.data && event.data.source === 'x4forge-studio' && event.data.type === 'open-workspace-file') {
            window.__nativeMessages.push(event.data);
          }
        });
      </script>
    </body></html>`);
    const forge = page.frameLocator('#forge');
    await expect(forge.getByTestId('studio-workspace')).toBeVisible();
    await forge.locator('[data-sidebar-tab="playtest"]').click();
    await expect(forge.getByTestId('runtime-debugger-panel')).toBeVisible();
  } else {
    await page.goto('/');
    await expect(page.getByTestId('studio-workspace')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as E2EWindow).__X4_E2E__?.getWorkspace().name)).toBe('AiLive');
    await page.locator('[data-sidebar-tab="playtest"]').click();
    await expect(page.getByTestId('runtime-debugger-panel')).toBeVisible();
  }
  return () => legacyGameLogRequestCount;
}

async function expectNoFalseCleanClaim(page: Page, evidence: string): Promise<void> {
  const panel = page.getByTestId('runtime-debugger-panel');
  await expect(panel).toContainText(evidence);
  await expect(page.getByTestId('playtest-game-log-status')).toHaveCount(0);
  await expect(panel).not.toContainText('NO LOG ISSUES');
  await expect(panel).not.toContainText('LOADED CLEAN');
  await expect(panel).not.toContainText('SUCCESS');
}

test('mod-aware runtime debugger renders authoritative evidence, bounded incidents, and safe node navigation', async ({ page }) => {
  const getLegacyGameLogRequestCount = await bootRuntimeDebugger(page, makePayload());

  await expect.poll(getLegacyGameLogRequestCount, { timeout: 5_000 }).toBeGreaterThan(0);
  let stabilizedLegacyGameLogRequestCount = getLegacyGameLogRequestCount();
  await expect.poll(async () => {
    await page.waitForTimeout(500);
    const currentCount = getLegacyGameLogRequestCount();
    const stable = currentCount === stabilizedLegacyGameLogRequestCount;
    stabilizedLegacyGameLogRequestCount = currentCount;
    return stable;
  }, { timeout: 5_000, intervals: [100] }).toBe(true);

  // The initial request count is intentionally observed rather than assumed because
  // React StrictMode may mount the polling effect more than once in development.
  await page.waitForTimeout(8_500);
  expect(getLegacyGameLogRequestCount()).toBe(stabilizedLegacyGameLogRequestCount);

  const panel = page.getByTestId('runtime-debugger-panel');
  await expect(page.getByTestId('playtest-game-log-status')).toHaveCount(0);
  await expect(panel).toContainText('Runtime Debugger · AiLive / x4_ailive');
  await expect(page.getByTestId('runtime-debugger-status')).toContainText('1 confirmed mod error; 1 unresolved log issue');
  await expect(panel).toContainText('1 confirmed issue');
  await expect(panel).toContainText('1 unresolved');
  await expect(panel).toContainText('6 activity');
  await expect(panel).toContainText('4 unrelated hidden');

  const coverage = page.getByTestId('runtime-debugger-coverage');
  await expect(coverage).not.toHaveAttribute('open');
  await expect(page.getByTestId('runtime-debugger-session-detail')).not.toHaveAttribute('open');
  await expect(page.getByTestId('runtime-debugger-expected-steps')).not.toHaveAttribute('open');
  await expect(page.getByTestId('runtime-debugger-advanced')).not.toHaveAttribute('open');
  await expect(coverage).toContainText('99% recognition target met');
  await coverage.locator('summary').click();
  await expect(coverage).toContainText('99 recognized + 1 explicit unknown = 100 / 100 candidates');

  const sessionDetails = page.getByTestId('runtime-debugger-session-detail');
  await sessionDetails.locator('summary').click();
  await expect(sessionDetails).toContainText('content: x4_ai_influence');
  await expect(sessionDetails).toContainText('deployed: x4_ai_influence');

  const engineFailure = page.locator('article[data-testid^="runtime-incident-"]').filter({ hasText: 'md/ai_influence_conversation.xml:98' }).first();
  await expect(engineFailure).toBeVisible();
  await expect(engineFailure).toContainText('ERROR · CONFIRMED ACTIVE');
  await expect(engineFailure).toContainText('CONFIRMED ACTIVE');
  await expect(engineFailure).toContainText('line 98');
  await expect(engineFailure).toContainText('runtime fault in AI influence conversation');
  await expect(engineFailure).toContainText('OPEN DEEPEST NODE');
  const engineDetails = engineFailure.locator('details').first();
  await expect(engineDetails).not.toHaveAttribute('open');
  await expect(engineDetails.getByText('The conversation cue stopped before its next action executed.')).toBeHidden();
  await engineDetails.locator('summary').click();
  await expect(engineDetails).toHaveAttribute('open');
  await expect(engineDetails).toContainText('X4 reported an engine fault at the conversation cue.');
  await expect(engineDetails).toContainText('The conversation cue stopped before its next action executed.');
  await expect(engineDetails).toContainText('Open the mapped node and repair the failing conversation step.');

  const activity = page.getByTestId('runtime-debugger-activity');
  await expect(activity).toBeVisible();
  await expect(activity).not.toHaveAttribute('open');
  const authoredDiagnostic = activity.locator('article').filter({ hasText: 'authored diagnostic/runtime-evidence marker' }).first();
  await expect(authoredDiagnostic).toBeHidden();
  await activity.locator(':scope > summary').click();
  await expect(authoredDiagnostic).toBeVisible();
  await expect(authoredDiagnostic).toContainText('ACTIVITY · CONFIRMED ACTIVE');
  await expect(authoredDiagnostic).not.toHaveClass(/border-red-500/);

  const ambiguous = page.locator('article[data-testid^="runtime-incident-"]').filter({ hasText: 'AMBIGUOUS · UNRESOLVED' }).first();
  await expect(ambiguous).toBeVisible();
  await expect(ambiguous).toContainText('unresolved: Display-name evidence collides across possible owners; node navigation is withheld.');
  await expect(ambiguous.getByRole('button', { name: /OPEN DEEPEST NODE/ })).toHaveCount(0);

  const incidentRows = page.locator('article[data-testid^="runtime-incident-"]');
  await expect(incidentRows).toHaveCount(8);
  await expect(page.getByTestId('runtime-debugger-incidents')).toContainText('+5 bounded');

  const expectedSteps = page.getByTestId('runtime-debugger-expected-steps');
  await expect(expectedSteps).toContainText('1 observed · 1 missing · 1 unavailable');
  await expect(expectedSteps.getByText('marker', { exact: true })).toBeHidden();
  await expectedSteps.locator(':scope > summary').click();
  await expect(expectedSteps).toContainText('OBSERVED Save identity');
  await expect(expectedSteps).toContainText('MISSING Chat boot');
  await expect(expectedSteps).toContainText('UNAVAILABLE Poll tick');
  const expectedEvidence = expectedSteps.locator('details').first();
  await expect(expectedEvidence).not.toHaveAttribute('open');
  await expectedEvidence.locator('summary').click();
  await expect(expectedEvidence).toContainText('Save_identity');

  const advanced = page.getByTestId('runtime-debugger-advanced');
  await expect(advanced).not.toHaveAttribute('open');
  await expect(advanced.getByText('fixture timeline evidence')).toBeHidden();
  await advanced.locator('summary').click();
  await expect(advanced).toContainText('fixture timeline evidence');

  await engineFailure.getByText('runtime fault in AI influence conversation', { exact: true }).click();
  const targetNode = page.getByTestId(`canvas-node-${RUNTIME_NODE_ID}`);
  await expect(targetNode).toBeVisible();
  await expect(targetNode).toHaveAttribute('data-node-label', 'cancel_conversation');
  await expect(targetNode).toHaveClass(/ring-2/);
  await expect(targetNode.getByText('cancel_conversation', { exact: true })).toBeVisible();
  await expect(page.getByText('PROPERTIES INSPECTOR', { exact: true })).toBeVisible();
});

test('actionable node incident rows support keyboard activation', async ({ page }) => {
  await bootRuntimeDebugger(page, makePayload());
  const engineFailure = page.locator('article[data-testid^="runtime-incident-"]').filter({ hasText: 'runtime fault in AI influence conversation' }).first();
  await engineFailure.focus();
  await engineFailure.press('Enter');
  const targetNode = page.getByTestId(`canvas-node-${RUNTIME_NODE_ID}`);
  await expect(targetNode).toBeVisible();
  await expect(targetNode).toHaveClass(/ring-2/);
});

test('file-line incident opens exact zero-based line through the native host contract', async ({ page }) => {
  await bootRuntimeDebugger(page, makeFileLinePayload(), { nativeHost: true });
  const forge = page.frameLocator('#forge');
  const activity = forge.getByTestId('runtime-debugger-activity');
  await activity.locator(':scope > summary').click();
  const fileLine = activity.locator('article[data-navigation-kind="file_line"]');
  await expect(fileLine).toBeVisible();
  await expect(fileLine).toContainText('attempt to index a nil value');
  await fileLine.getByText('attempt to index a nil value', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as E2EWindow).__nativeMessages?.at(-1))).toMatchObject({
    source: 'x4forge-studio',
    type: 'open-workspace-file',
    path: 'lua/runtime_fault.lua',
    line: 6,
  });
});

test('file-line incident stays honest in a standalone browser', async ({ page }) => {
  await bootRuntimeDebugger(page, makeFileLinePayload());
  const activity = page.getByTestId('runtime-debugger-activity');
  await activity.locator(':scope > summary').click();
  const fileLine = activity.locator('article[data-navigation-kind="file_line"]');
  await fileLine.getByText('attempt to index a nil value', { exact: true }).click();
  await expect(page.getByTestId('runtime-debugger-native-editor-status')).toContainText('Native editor unavailable in the standalone browser');
});

test('zero-candidate current runtime evidence never renders a clean or success claim', async ({ page }) => {
  await bootRuntimeDebugger(page, makePayload({
    incidents: [],
    coverage: {
      candidates: 0,
      recognized: 0,
      explicitUnknown: 0,
      silentlyDropped: 0,
      recognizedOrExplicitUnknown: 0,
      recognizedOrExplicitUnknownRatio: 0,
      dispositionCounts: { confirmed_active: 0, ambiguous: 0, excluded_other_mod: 0, unknown: 0 },
      dispositionSum: 0,
      met: false,
    },
    expectedSteps: [{ id: 'save_identity', label: 'Save identity', truth: 'unavailable', observed: false, success: false, evidence: [] }],
    hiddenOtherModCount: 0,
    ambiguousCount: 0,
    session: { detail: 'No current runtime candidates were observed.' },
  }));

  await expectNoFalseCleanClaim(page, 'No runtime candidates were observed in the current session. This is not a clean proof.');
  await expect(page.getByTestId('runtime-debugger-coverage')).toContainText('No candidates observed · clean proof not established');
});

test('historical and unavailable runtime evidence never render a clean or success claim', async ({ page }) => {
  await bootRuntimeDebugger(page, makePayload({
    incidents: [],
    coverage: makeCoverage({ candidates: 20, recognized: 20, explicitUnknown: 0, recognizedOrExplicitUnknown: 20, recognizedOrExplicitUnknownRatio: 1, dispositionCounts: { confirmed_active: 20, ambiguous: 0, excluded_other_mod: 0, unknown: 0 }, dispositionSum: 20, met: true }),
    expectedSteps: [],
    hiddenOtherModCount: 0,
    ambiguousCount: 0,
    session: { state: 'historical', detail: 'Historical runtime evidence is retained for inspection only.' },
  }));
  await expectNoFalseCleanClaim(page, 'Historical runtime evidence is shown; it cannot prove the current session is clean.');
  await expect(page.getByTestId('runtime-debugger-coverage')).toContainText('100% historical coverage · not current proof');

  await page.reload();
  await page.locator('[data-sidebar-tab="playtest"]').click();
  await expect(page.getByTestId('runtime-debugger-panel')).toBeVisible();
  await expectNoFalseCleanClaim(page, 'Historical runtime evidence is shown; it cannot prove the current session is clean.');

  // The same deterministic endpoint can report a read-unavailable session without ever
  // falling back to the legacy green log card.
  await page.unroute('**/api/agent/debug-watcher/brief**');
  await page.route('**/api/agent/debug-watcher/brief**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ runtimeDebugger: makePayload({
      incidents: [],
      coverage: makeCoverage({ candidates: 0, recognized: 0, explicitUnknown: 0, recognizedOrExplicitUnknown: 0, recognizedOrExplicitUnknownRatio: 0, dispositionCounts: { confirmed_active: 0, ambiguous: 0, excluded_other_mod: 0, unknown: 0 }, dispositionSum: 0, met: false }),
      expectedSteps: [],
      hiddenOtherModCount: 0,
      ambiguousCount: 0,
      session: { state: 'unavailable', detail: 'The runtime session read is unavailable.' },
    }) }),
  }));
  await page.reload();
  await page.locator('[data-sidebar-tab="playtest"]').click();
  await expect(page.getByTestId('runtime-debugger-panel')).toBeVisible();
  await expectNoFalseCleanClaim(page, 'The runtime session is unavailable; no current clean proof is available.');
  await expect(page.getByTestId('runtime-debugger-coverage')).toContainText('Coverage unavailable · no current clean proof');
});
