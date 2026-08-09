import {
  buildRuntimeDebuggerViewModel,
  RUNTIME_DEBUGGER_VIEW_LIMITS,
  type RuntimeDebuggerPayload,
  type RuntimeDebuggerIncident,
} from './runtimeDebuggerView';

export interface RuntimeDebuggerViewSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface RuntimeDebuggerViewSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  checks: RuntimeDebuggerViewSelftestCheck[];
}

function incident(overrides: Partial<RuntimeDebuggerIncident> = {}): RuntimeDebuggerIncident {
  return {
    key: 'runtime-fault',
    count: 1,
    firstLine: 42,
    lastLine: 42,
    candidateIds: ['candidate-1'],
    omittedCandidateIds: 0,
    attribution: {
      disposition: 'confirmed_active',
      confidence: 1,
      reason: 'exact active ownership evidence',
      evidence: [],
    },
    mapping: {
      kind: 'node',
      file: 'md/active.xml',
      line: 42,
      nodeId: 'deep-node',
      nodeLabel: 'deepest action',
      reason: 'source span matched',
    },
    explanation: {
      cause: 'deterministic cause',
      impact: 'deterministic impact',
      nextAction: 'deterministic next action',
      evidenceLabel: 'direct runtime evidence',
      summary: 'deterministic summary',
    },
    evidence: ['md:active.xml:42'],
    samples: [{ firstLine: 42, lastLine: 42, text: 'runtime sample' }],
    ...overrides,
  };
}

function coverage(candidates: number, recognizedOrExplicitUnknown: number, met = recognizedOrExplicitUnknown >= candidates && candidates > 0) {
  return {
    candidates,
    recognized: recognizedOrExplicitUnknown,
    explicitUnknown: 0,
    silentlyDropped: 0,
    recognizedOrExplicitUnknown,
    recognizedOrExplicitUnknownRatio: candidates > 0 ? recognizedOrExplicitUnknown / candidates : 1,
    dispositionCounts: {
      confirmed_active: recognizedOrExplicitUnknown,
      ambiguous: 0,
      excluded_other_mod: 0,
      unknown: Math.max(0, candidates - recognizedOrExplicitUnknown),
    },
    dispositionSum: candidates,
    target: 0.99,
    met,
  };
}

function payload(overrides: Partial<RuntimeDebuggerPayload> = {}): RuntimeDebuggerPayload {
  return {
    authority: {
      workspaceId: 'ws_runtime_view',
      contentId: 'content.runtime',
      displayName: 'Display name only',
      sourceFolder: 'source-mod',
      deployedFolder: 'deployed-mod',
    },
    session: {
      state: 'current',
      sessionId: 'session-1',
      logPath: 'debuglog.txt',
      generation: 2,
      firstLine: 1,
      lastLine: 42,
      newlyReadBytes: 128,
      detail: 'Current session detail',
    },
    incidents: [incident()],
    coverage: coverage(1, 1),
    expectedSteps: [
      { id: 'seen', label: 'Observed step', truth: 'observed', observed: true, success: true, evidence: ['marker'] },
      { id: 'missing', label: 'Missing step', truth: 'missing', observed: false, success: false, evidence: [] },
      { id: 'unavailable', label: 'Unavailable step', truth: 'unavailable', observed: false, success: false, evidence: [] },
    ],
    hiddenOtherModCount: 0,
    ambiguousCount: 0,
    ...overrides,
  };
}

export function runRuntimeDebuggerViewSelftest(): RuntimeDebuggerViewSelftestResult {
  const checks: RuntimeDebuggerViewSelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: unknown) => checks.push({
    name,
    pass: !!pass,
    ...(detail === undefined ? {} : { detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }),
  });

  try {
    const zero = buildRuntimeDebuggerViewModel(payload({ incidents: [], coverage: coverage(0, 0, true) }));
    check('zero_candidates_is_not_clean', zero.coverage.status === 'no_candidates' && zero.coverage.met === false && zero.noCandidateMessage?.includes('No runtime candidates were observed') === true, zero);

    const historical = buildRuntimeDebuggerViewModel(payload({
      session: { state: 'historical', detail: 'retained previous session' },
    }));
    const unavailable = buildRuntimeDebuggerViewModel(payload({
      session: { state: 'unavailable', detail: 'log session unavailable' },
    }));
    check('historical_state_does_not_claim_current_clean', historical.session.stateLabel === 'HISTORICAL SESSION' && historical.coverage.status === 'historical' && historical.coverage.statusLabel.includes('not current proof'), historical);
    check('unavailable_state_does_not_claim_current_clean', unavailable.session.stateLabel === 'SESSION UNAVAILABLE' && unavailable.coverage.status === 'unavailable' && unavailable.coverage.statusLabel.includes('no current clean proof'), unavailable);

    const excluded = buildRuntimeDebuggerViewModel(payload({
      incidents: [
        incident({ key: 'excluded', count: 3, attribution: { disposition: 'excluded_other_mod', confidence: 1, reason: 'other extension', evidence: [] } }),
        incident({ key: 'ambiguous', count: 2, attribution: { disposition: 'ambiguous', confidence: 0.2, reason: 'collision', evidence: [] } }),
        incident({ key: 'unknown', count: 4, attribution: { disposition: 'unknown', confidence: 0, reason: 'no exact evidence', evidence: [] } }),
      ],
      hiddenOtherModCount: 5,
      ambiguousCount: 1,
      coverage: coverage(9, 9),
    }));
    check('excluded_incidents_are_filtered_and_aggregated', excluded.incidents.every(row => row.disposition !== 'excluded_other_mod') && excluded.hiddenOtherModCount === 5, excluded);
    check('ambiguous_and_unknown_remain_visible_as_unresolved', excluded.incidents.some(row => row.disposition === 'ambiguous' && row.unresolved) && excluded.incidents.some(row => row.disposition === 'unknown' && row.unresolved) && excluded.unresolvedCount === 6, excluded);

    const thresholdPass = buildRuntimeDebuggerViewModel(payload({ coverage: coverage(100, 99, true) }));
    const thresholdFail = buildRuntimeDebuggerViewModel(payload({ coverage: coverage(100, 98, false) }));
    check('ninety_nine_percent_threshold_passes', thresholdPass.coverage.targetPercent === 99 && thresholdPass.coverage.met && thresholdPass.coverage.status === 'met', thresholdPass.coverage);
    check('below_ninety_nine_percent_threshold_fails', thresholdFail.coverage.targetPercent === 99 && !thresholdFail.coverage.met && thresholdFail.coverage.status === 'below_target', thresholdFail.coverage);

    const authored = buildRuntimeDebuggerViewModel(payload({
      incidents: [incident({
        key: 'authored-diagnostic',
        classification: 'authored_diagnostic',
        severity: 'error',
      })],
    }));
    check('confirmed_authored_evidence_is_not_labeled_engine_failure', authored.incidents[0]?.severity === 'info'
      && authored.incidents[0]?.severityLabel === 'ACTIVE RUNTIME EVIDENCE'
      && authored.incidents[0]?.isEngineFailure === false, authored.incidents[0]);

    const prioritized = buildRuntimeDebuggerViewModel(payload({
      incidents: [
        incident({ key: 'engine-old', firstLine: 10, lastLine: 10, severity: 'error', isEngineFailure: true }),
        incident({ key: 'evidence-old', firstLine: 20, lastLine: 20, severity: 'info', isEngineFailure: false, classification: 'file_io' }),
        ...Array.from({ length: 8 }, (_, index) => incident({
          key: `unresolved-${index + 1}`,
          firstLine: 100 + index,
          lastLine: 100 + index,
          attribution: { disposition: 'unknown', confidence: 0, reason: 'unsupported evidence', evidence: [] },
        })),
        incident({ key: 'engine-new', firstLine: 900, lastLine: 900, severity: 'error', isEngineFailure: true }),
        incident({ key: 'evidence-new', firstLine: 800, lastLine: 800, severity: 'info', isEngineFailure: false, classification: 'authored_diagnostic' }),
      ],
      coverage: coverage(12, 12),
    }));
    check('incident_bound_prioritizes_newest_engine_then_evidence_then_unresolved', prioritized.incidents.length === RUNTIME_DEBUGGER_VIEW_LIMITS.maxIncidents
      && prioritized.incidents.slice(0, 4).map(row => row.key).join(',') === 'engine-new,engine-old,evidence-new,evidence-old'
      && prioritized.incidents[4]?.key === 'unresolved-8'
      && prioritized.omittedIncidentCount === 4, prioritized.incidents);

    const longText = 'x'.repeat(10_000);
    const manyIncidents = Array.from({ length: RUNTIME_DEBUGGER_VIEW_LIMITS.maxIncidents + 10 }, (_, index) => incident({
      key: `${longText}-${index}`,
      evidence: Array.from({ length: RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidence + 5 }, () => longText),
      samples: Array.from({ length: RUNTIME_DEBUGGER_VIEW_LIMITS.maxSamples + 5 }, (_, sampleIndex) => ({ firstLine: sampleIndex + 1, lastLine: sampleIndex + 1, text: longText })),
      explanation: {
        cause: longText,
        impact: longText,
        nextAction: longText,
        evidenceLabel: longText,
        summary: longText,
      },
    }));
    const bounded = buildRuntimeDebuggerViewModel(payload({ incidents: manyIncidents, expectedSteps: Array.from({ length: 30 }, (_, index) => ({ id: `step-${index}`, label: longText, truth: 'missing' as const, observed: false, success: false, evidence: [longText] })) }));
    check('hostile_rows_and_text_are_bounded', bounded.incidents.length === RUNTIME_DEBUGGER_VIEW_LIMITS.maxIncidents
      && bounded.omittedIncidentCount === 10
      && bounded.incidents.every(row => row.key.length <= RUNTIME_DEBUGGER_VIEW_LIMITS.maxKeyChars
        && row.evidence.length <= RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidence
        && row.evidence.every(value => value.length <= RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars)
        && row.samples.length <= RUNTIME_DEBUGGER_VIEW_LIMITS.maxSamples
        && row.cause.length <= RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars), bounded);

    const fileLine = incident({
      key: 'file-line-fallback',
      mapping: { kind: 'file_line', file: 'md/imported.xml', line: 7, reason: 'no modeled node span' },
    });
    const mapped = buildRuntimeDebuggerViewModel(payload({ incidents: [incident(), fileLine] }));
    check('node_mapping_exposes_exact_node_and_file_line_mapping', mapped.incidents[0]?.mapping.nodeId === 'deep-node'
      && mapped.incidents[0]?.mapping.exactFileLine === 'md/active.xml:42'
      && mapped.incidents[1]?.mapping.isFileLineFallback === true
      && mapped.incidents[1]?.mapping.exactFileLine === 'md/imported.xml:7', mapped.incidents);
    check('confirmed_exact_mappings_expose_safe_navigation_targets', mapped.incidents[0]?.navigationTarget?.kind === 'md_node'
      && mapped.incidents[0]?.navigationTarget.nodeId === 'deep-node'
      && mapped.incidents[0]?.navigationTarget.actionLabel === 'OPEN DEEPEST NODE'
      && mapped.incidents[1]?.navigationTarget?.kind === 'file_line'
      && mapped.incidents[1]?.navigationTarget.file === 'md/imported.xml'
      && mapped.incidents[1]?.navigationTarget.sourceLine === 7
      && mapped.incidents[1]?.navigationTarget.nativeLine === 6
      && mapped.incidents[1]?.navigationTarget.actionLabel === 'OPEN FILE IN NATIVE EDITOR', mapped.incidents);

    const unresolvedMappings = buildRuntimeDebuggerViewModel(payload({
      incidents: [
        incident({
          key: 'ambiguous-file-line',
          attribution: { disposition: 'ambiguous', confidence: 0.2, reason: 'ownership collision', evidence: [] },
          mapping: { kind: 'file_line', file: 'md/active.xml', line: 42, reason: 'line exists but ownership is ambiguous' },
        }),
        incident({
          key: 'unknown-node',
          attribution: { disposition: 'unknown', confidence: 0, reason: 'no exact owner evidence', evidence: [] },
          mapping: { kind: 'node', nodeId: 'guessed-node', nodeLabel: 'do not guess', reason: 'node identity is not confirmed' },
        }),
      ],
      coverage: coverage(2, 0, false),
    }));
    check('ambiguous_and_unknown_mappings_have_no_navigation_target', unresolvedMappings.incidents.every(row => row.navigationTarget === undefined), unresolvedMappings.incidents);

    const expected = buildRuntimeDebuggerViewModel(payload());
    check('expected_steps_preserve_three_state_truth', expected.expectedSteps.map(step => step.truth).join(',') === 'observed,missing,unavailable'
      && expected.expectedSteps.map(step => step.truthLabel).join(',') === 'OBSERVED,MISSING,UNAVAILABLE', expected.expectedSteps);
  } catch (error) {
    check('selftest_unexpected_exception', false, error instanceof Error ? error.message : String(error));
  }

  const passed = checks.filter(item => item.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}

const invokedDirectly = (process.argv[1] || '').toLowerCase().endsWith('runtimedebuggerview.selftest.ts');
if (invokedDirectly) {
  const result = runRuntimeDebuggerViewSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
