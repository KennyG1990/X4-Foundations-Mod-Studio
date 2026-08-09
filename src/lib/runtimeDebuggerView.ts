import type {
  RuntimeAttributionDisposition,
  RuntimeCoverage,
  RuntimeExpectedStepResult,
  RuntimeExpectedStepTruth,
  RuntimeIncident,
} from './runtimeDebugger';

export interface RuntimeDebuggerAuthority {
  workspaceId: string;
  contentId?: string;
  displayName: string;
  sourceFolder?: string;
  deployedFolder?: string;
}

export interface RuntimeDebuggerSession {
  state: 'current' | 'historical' | 'unavailable';
  sessionId?: string;
  logPath?: string;
  generation?: number;
  firstLine?: number;
  lastLine?: number;
  newlyReadBytes?: number;
  resetReason?: string;
  observedAt?: string;
  detail: string;
}

export type RuntimeDebuggerCoverage = RuntimeCoverage & {
  target: number;
  met: boolean;
};

/** Additive fields supplied by the UI adapter without changing canonical analysis shapes. */
export type RuntimeDebuggerIncident = RuntimeIncident & {
  classification?: string;
  severity?: 'error' | 'warning' | 'info';
  isEngineFailure?: boolean;
};

/** The additive response object supplied by the debug-watcher brief adapter. */
export interface RuntimeDebuggerPayload {
  authority: RuntimeDebuggerAuthority;
  session: RuntimeDebuggerSession;
  incidents: RuntimeDebuggerIncident[];
  coverage: RuntimeDebuggerCoverage;
  expectedSteps: RuntimeExpectedStepResult[];
  hiddenOtherModCount: number;
  ambiguousCount: number;
}

export const RUNTIME_DEBUGGER_VIEW_LIMITS = {
  maxIncidents: 8,
  maxExpectedSteps: 16,
  maxEvidence: 5,
  maxSamples: 3,
  maxEvidenceChars: 280,
  maxExplanationChars: 360,
  maxIdentityChars: 180,
  maxPathChars: 300,
  maxKeyChars: 180,
} as const;

export type RuntimeIncidentViewSeverity = 'error' | 'warning' | 'info';

export interface RuntimeIncidentViewMapping {
  kind: 'node' | 'file_line' | 'unmapped';
  file?: string;
  line?: number;
  nodeId?: string;
  nodeLabel?: string;
  locationLabel: string;
  mappingLabel: string;
  reason: string;
  exactFileLine?: string;
  isFileLineFallback: boolean;
}

export type RuntimeIncidentViewNavigationTarget =
  | {
      kind: 'md_node';
      nodeId: string;
      nodeLabel?: string;
      actionLabel: 'OPEN DEEPEST NODE';
    }
  | {
      kind: 'file_line';
      file: string;
      sourceLine: number;
      nativeLine: number;
      actionLabel: 'OPEN FILE IN NATIVE EDITOR';
    };

export interface RuntimeIncidentViewRow {
  key: string;
  count: number;
  firstLine?: number;
  lastLine?: number;
  lineLabel: string;
  firstTimestamp?: string;
  lastTimestamp?: string;
  disposition: RuntimeAttributionDisposition;
  dispositionLabel: string;
  unresolved: boolean;
  severity: RuntimeIncidentViewSeverity;
  severityLabel: string;
  classification?: string;
  isEngineFailure: boolean;
  attributionReason: string;
  evidence: string[];
  samples: Array<{
    firstLine?: number;
    lastLine?: number;
    lineLabel: string;
    timestamp?: string;
    text: string;
  }>;
  cause: string;
  impact: string;
  nextAction: string;
  evidenceLabel: string;
  summary: string;
  mapping: RuntimeIncidentViewMapping;
  navigationTarget?: RuntimeIncidentViewNavigationTarget;
}

export interface RuntimeExpectedStepViewRow {
  id: string;
  label: string;
  truth: RuntimeExpectedStepTruth;
  observed: boolean;
  success: boolean;
  truthLabel: 'OBSERVED' | 'MISSING' | 'UNAVAILABLE';
  evidence: string[];
}

export interface RuntimeDebuggerViewModel {
  authority: {
    workspaceId: string;
    contentId?: string;
    displayName: string;
    sourceFolder?: string;
    deployedFolder?: string;
  };
  session: {
    state: RuntimeDebuggerSession['state'];
    stateLabel: 'CURRENT SESSION' | 'HISTORICAL SESSION' | 'SESSION UNAVAILABLE';
    sessionId?: string;
    logPath?: string;
    generation?: number;
    firstLine?: number;
    lastLine?: number;
    newlyReadBytes?: number;
    resetReason?: string;
    observedAt?: string;
    detail: string;
  };
  coverage: {
    target: number;
    targetPercent: number;
    targetLabel: string;
    candidates: number;
    recognized: number;
    explicitUnknown: number;
    recognizedOrExplicitUnknown: number;
    silentlyDropped: number;
    ratio: number | null;
    ratioPercent: number | null;
    met: boolean;
    status: 'met' | 'below_target' | 'no_candidates' | 'historical' | 'unavailable';
    statusLabel: string;
    arithmeticLabel: string;
  };
  incidents: RuntimeIncidentViewRow[];
  omittedIncidentCount: number;
  expectedSteps: RuntimeExpectedStepViewRow[];
  omittedExpectedStepCount: number;
  hiddenOtherModCount: number;
  ambiguousCount: number;
  unknownCount: number;
  unresolvedCount: number;
  noCandidateMessage?: string;
}

function clipText(value: unknown, limit: number, fallback = ''): string {
  const text = typeof value === 'string' ? value : value == null ? fallback : String(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1))}…`;
}

function optionalText(value: unknown, limit: number): string | undefined {
  const text = clipText(value, limit).trim();
  return text || undefined;
}

function boundedCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(1_000_000_000, Math.max(0, Math.floor(value)));
}

function boundedLine(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const line = Math.floor(value);
  return line > 0 ? line : undefined;
}

function boundedNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(1_000_000_000, Math.max(0, Math.floor(value)));
}

function boundedRatio(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeTarget(value: unknown): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : 0.99;
  return boundedRatio(raw > 1 ? raw / 100 : raw);
}

function isDisposition(value: unknown): value is RuntimeAttributionDisposition {
  return value === 'confirmed_active'
    || value === 'ambiguous'
    || value === 'excluded_other_mod'
    || value === 'unknown';
}

function boundedStrings(values: unknown, limit: number, charLimit: number, fallback?: string): string[] {
  const source = Array.isArray(values) ? values : [];
  const output: string[] = [];
  for (const value of source) {
    const text = optionalText(value, charLimit);
    if (!text || output.includes(text)) continue;
    output.push(text);
    if (output.length >= limit) break;
  }
  if (output.length === 0 && fallback) output.push(fallback);
  return output;
}

function sumIncidentCounts(incidents: RuntimeIncident[], disposition: RuntimeAttributionDisposition): number {
  return incidents.reduce((total, incident) => {
    const incidentDisposition = isDisposition(incident?.attribution?.disposition)
      ? incident.attribution.disposition
      : 'unknown';
    return total + (incidentDisposition === disposition ? Math.max(1, boundedCount(incident.count)) : 0);
  }, 0);
}

function isExplicitEngineFailure(incident: RuntimeDebuggerIncident): boolean {
  if (incident.isEngineFailure === false) return false;
  const classification = optionalText(incident.classification, RUNTIME_DEBUGGER_VIEW_LIMITS.maxKeyChars)?.toLowerCase();
  const nonFailureClassification = classification === 'authored_diagnostic'
    || classification === 'file_io'
    || classification === 'file_load'
    || classification === 'load';
  if (nonFailureClassification) return false;
  const failureClassification = classification === 'engine_failure'
    || classification === 'runtime_failure'
    || classification === 'engine_fault'
    || classification === 'runtime_fault'
    || classification === 'direct_extension_fault'
    || classification === 'md_fault'
    || classification === 'ai_fault'
    || classification === 'lua_fault'
    || classification === 'engine';
  return incident.isEngineFailure === true || incident.severity === 'error' || failureClassification;
}

function incidentPriority(incident: RuntimeDebuggerIncident): number {
  if (incident?.attribution?.disposition === 'confirmed_active') return isExplicitEngineFailure(incident) ? 0 : 1;
  return 2;
}

function newestIncidentLine(incident: RuntimeDebuggerIncident): number {
  return boundedLine(incident?.lastLine) ?? boundedLine(incident?.firstLine) ?? -1;
}

function prioritizeIncidents(incidents: RuntimeDebuggerIncident[]): RuntimeDebuggerIncident[] {
  return incidents
    .map((incident, index) => ({ incident, index }))
    .sort((left, right) => {
      const priorityDifference = incidentPriority(left.incident) - incidentPriority(right.incident);
      if (priorityDifference !== 0) return priorityDifference;
      const newestDifference = newestIncidentLine(right.incident) - newestIncidentLine(left.incident);
      if (newestDifference !== 0) return newestDifference;
      return left.index - right.index;
    })
    .map(item => item.incident);
}

function lineLabel(firstLine?: number, lastLine?: number): string {
  if (firstLine && lastLine && firstLine !== lastLine) return `lines ${firstLine}–${lastLine}`;
  if (firstLine) return `line ${firstLine}`;
  if (lastLine) return `line ${lastLine}`;
  return 'line unavailable';
}

function mapIncidentMapping(incident: RuntimeIncident): RuntimeIncidentViewMapping {
  const source = incident?.mapping || ({ kind: 'unmapped', reason: 'source mapping was not supplied' } as RuntimeIncident['mapping']);
  const kind: RuntimeIncidentViewMapping['kind'] = source.kind === 'node' || source.kind === 'file_line' ? source.kind : 'unmapped';
  const file = optionalText(source.file, RUNTIME_DEBUGGER_VIEW_LIMITS.maxPathChars);
  const line = boundedLine(source.line);
  const nodeId = optionalText(source.nodeId, RUNTIME_DEBUGGER_VIEW_LIMITS.maxKeyChars);
  const nodeLabel = optionalText(source.nodeLabel, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars);
  const exactFileLine = file && line ? `${file}:${line}` : undefined;
  const locationLabel = exactFileLine
    || file
    || (nodeId ? `node ${nodeId}` : 'source mapping unavailable');
  const mappingLabel = kind === 'node'
    ? 'DEEPEST NODE'
    : kind === 'file_line'
      ? 'FILE:LINE FALLBACK'
      : 'UNMAPPED SOURCE';
  return {
    kind,
    ...(file ? { file } : {}),
    ...(line ? { line } : {}),
    ...(nodeId ? { nodeId } : {}),
    ...(nodeLabel ? { nodeLabel } : {}),
    locationLabel,
    mappingLabel,
    reason: clipText(source.reason, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars, 'source mapping was not supplied'),
    ...(exactFileLine ? { exactFileLine } : {}),
    isFileLineFallback: kind === 'file_line',
  };
}

function mapIncidentNavigationTarget(
  disposition: RuntimeAttributionDisposition,
  mapping: RuntimeIncidentViewMapping,
): RuntimeIncidentViewNavigationTarget | undefined {
  if (disposition !== 'confirmed_active') return undefined;
  if (mapping.kind === 'node' && mapping.nodeId) {
    return {
      kind: 'md_node',
      nodeId: mapping.nodeId,
      ...(mapping.nodeLabel ? { nodeLabel: mapping.nodeLabel } : {}),
      actionLabel: 'OPEN DEEPEST NODE',
    };
  }
  if (mapping.kind === 'file_line' && !mapping.nodeId && mapping.file && mapping.line) {
    return {
      kind: 'file_line',
      file: mapping.file,
      sourceLine: mapping.line,
      nativeLine: Math.max(0, mapping.line - 1),
      actionLabel: 'OPEN FILE IN NATIVE EDITOR',
    };
  }
  return undefined;
}

function mapIncidentRow(incident: RuntimeDebuggerIncident, index: number): RuntimeIncidentViewRow {
  const rawDisposition = incident?.attribution?.disposition;
  const disposition: RuntimeAttributionDisposition = isDisposition(rawDisposition) ? rawDisposition : 'unknown';
  const firstLine = boundedLine(incident?.firstLine);
  const lastLine = boundedLine(incident?.lastLine);
  const explanation = incident?.explanation;
  const fallbackEvidenceLabel = disposition === 'unknown' ? 'unknown runtime evidence' : 'runtime evidence';
  const evidenceLabel = clipText(explanation?.evidenceLabel, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars, fallbackEvidenceLabel);
  const evidence = boundedStrings(incident?.evidence, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidence, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars, evidenceLabel);
  const samples = (Array.isArray(incident?.samples) ? incident.samples : [])
    .slice(0, RUNTIME_DEBUGGER_VIEW_LIMITS.maxSamples)
    .map(sample => {
      const sampleFirstLine = boundedLine(sample?.firstLine);
      const sampleLastLine = boundedLine(sample?.lastLine);
      return {
        ...(sampleFirstLine ? { firstLine: sampleFirstLine } : {}),
        ...(sampleLastLine ? { lastLine: sampleLastLine } : {}),
        lineLabel: lineLabel(sampleFirstLine, sampleLastLine),
        ...(optionalText(sample?.timestamp, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars) ? { timestamp: optionalText(sample.timestamp, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars) } : {}),
        text: clipText(sample?.text, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars, 'sample text unavailable'),
      };
    });
  const unresolved = disposition === 'ambiguous' || disposition === 'unknown';
  const isEngineFailure = disposition === 'confirmed_active' && isExplicitEngineFailure(incident);
  const severity: RuntimeIncidentViewSeverity = unresolved ? 'warning' : isEngineFailure ? 'error' : 'info';
  const dispositionLabel = disposition === 'confirmed_active'
    ? 'CONFIRMED ACTIVE'
    : disposition === 'ambiguous'
      ? 'AMBIGUOUS · UNRESOLVED'
      : 'UNKNOWN · UNRESOLVED';
  const mapping = mapIncidentMapping(incident);
  const navigationTarget = mapIncidentNavigationTarget(disposition, mapping);
  return {
    key: clipText(incident?.key, RUNTIME_DEBUGGER_VIEW_LIMITS.maxKeyChars, `incident-${index + 1}`),
    count: Math.max(1, boundedCount(incident?.count)),
    ...(firstLine ? { firstLine } : {}),
    ...(lastLine ? { lastLine } : {}),
    lineLabel: lineLabel(firstLine, lastLine),
    ...(optionalText(incident?.firstTimestamp, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars) ? { firstTimestamp: optionalText(incident.firstTimestamp, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars) } : {}),
    ...(optionalText(incident?.lastTimestamp, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars) ? { lastTimestamp: optionalText(incident.lastTimestamp, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars) } : {}),
    disposition,
    dispositionLabel,
    unresolved,
    severity,
    severityLabel: severity === 'error'
      ? 'ACTIVE RUNTIME FAILURE'
      : severity === 'info'
        ? 'ACTIVE RUNTIME EVIDENCE'
        : 'UNRESOLVED EVIDENCE',
    ...(optionalText(incident?.classification, RUNTIME_DEBUGGER_VIEW_LIMITS.maxKeyChars) ? { classification: optionalText(incident.classification, RUNTIME_DEBUGGER_VIEW_LIMITS.maxKeyChars) } : {}),
    isEngineFailure,
    attributionReason: clipText(incident?.attribution?.reason, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars, 'attribution reason unavailable'),
    evidence,
    samples,
    cause: clipText(explanation?.cause, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars, 'deterministic cause unavailable'),
    impact: clipText(explanation?.impact, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars, 'impact unavailable'),
    nextAction: clipText(explanation?.nextAction, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars, 'next action unavailable'),
    evidenceLabel,
    summary: clipText(explanation?.summary, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars, 'deterministic explanation unavailable'),
    mapping,
    ...(navigationTarget ? { navigationTarget } : {}),
  };
}

function mapExpectedStep(step: RuntimeExpectedStepResult, index: number): RuntimeExpectedStepViewRow {
  const truth: RuntimeExpectedStepTruth = step?.truth === 'observed' || step?.truth === 'missing' || step?.truth === 'unavailable'
    ? step.truth
    : 'unavailable';
  const truthLabel = truth === 'observed' ? 'OBSERVED' : truth === 'missing' ? 'MISSING' : 'UNAVAILABLE';
  return {
    id: clipText(step?.id, RUNTIME_DEBUGGER_VIEW_LIMITS.maxKeyChars, `step-${index + 1}`),
    label: clipText(step?.label, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars, `Expected step ${index + 1}`),
    truth,
    observed: truth === 'observed',
    success: truth === 'observed',
    truthLabel,
    evidence: boundedStrings(step?.evidence, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidence, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars),
  };
}

function normalizeSessionState(value: unknown): RuntimeDebuggerSession['state'] {
  return value === 'current' || value === 'historical' || value === 'unavailable' ? value : 'unavailable';
}

/**
 * Convert the additive runtime payload into a bounded, presentation-only model.
 * Excluded incidents never enter `incidents`; their occurrence count is retained
 * only in `hiddenOtherModCount` so unrelated extensions cannot be displayed.
 */
export function buildRuntimeDebuggerViewModel(payload: RuntimeDebuggerPayload): RuntimeDebuggerViewModel {
  const rawIncidents = Array.isArray(payload?.incidents) ? payload.incidents : [];
  const visibleIncidents = prioritizeIncidents(rawIncidents.filter(incident => incident?.attribution?.disposition !== 'excluded_other_mod'));
  const excludedOccurrences = sumIncidentCounts(rawIncidents, 'excluded_other_mod');
  const hiddenOtherModCount = Math.max(boundedCount(payload?.hiddenOtherModCount), excludedOccurrences);
  const ambiguousOccurrences = sumIncidentCounts(visibleIncidents, 'ambiguous');
  const unknownOccurrences = sumIncidentCounts(visibleIncidents, 'unknown');
  const ambiguousCount = Math.max(boundedCount(payload?.ambiguousCount), ambiguousOccurrences);
  const incidents = visibleIncidents
    .slice(0, RUNTIME_DEBUGGER_VIEW_LIMITS.maxIncidents)
    .map(mapIncidentRow);

  const rawCoverage = payload?.coverage;
  const candidates = boundedCount(rawCoverage?.candidates);
  const recognized = Math.min(candidates, boundedCount(rawCoverage?.recognized));
  const explicitUnknown = Math.min(candidates, boundedCount(rawCoverage?.explicitUnknown));
  const silentlyDropped = boundedCount(rawCoverage?.silentlyDropped);
  const suppliedUnion = boundedCount(rawCoverage?.recognizedOrExplicitUnknown);
  const recognizedOrExplicitUnknown = Math.min(candidates, suppliedUnion || recognized + explicitUnknown);
  const ratio = candidates > 0 ? recognizedOrExplicitUnknown / candidates : null;
  const target = normalizeTarget(rawCoverage?.target);
  const targetPercent = Math.round(target * 100);
  const arithmeticMet = candidates > 0 && ratio !== null && ratio >= target && silentlyDropped === 0;
  // The adapter's met flag is authoritative, but a zero-candidate or silently
  // dropped result is never allowed to become a clean-looking presentation.
  const met = arithmeticMet && rawCoverage?.met === true;
  const state = normalizeSessionState(payload?.session?.state);
  const status: RuntimeDebuggerViewModel['coverage']['status'] = state === 'unavailable'
    ? 'unavailable'
    : state === 'historical'
      ? 'historical'
      : candidates === 0
        ? 'no_candidates'
        : met
          ? 'met'
          : 'below_target';
  const ratioLabel = ratio === null ? 'no candidates' : `${Math.round(ratio * 100)}%`;
  const statusLabel = status === 'met'
    ? `${targetPercent}% recognition target met`
    : status === 'below_target'
      ? `${ratioLabel} recognized-or-explicit-unknown · below ${targetPercent}% target`
      : status === 'no_candidates'
        ? 'No candidates observed · clean proof not established'
        : status === 'historical'
          ? `${ratioLabel} historical coverage · not current proof`
          : 'Coverage unavailable · no current clean proof';

  const expectedSteps = (Array.isArray(payload?.expectedSteps) ? payload.expectedSteps : [])
    .slice(0, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExpectedSteps)
    .map(mapExpectedStep);
  const sessionStateLabel = state === 'current'
    ? 'CURRENT SESSION'
    : state === 'historical'
      ? 'HISTORICAL SESSION'
      : 'SESSION UNAVAILABLE';
  const noCandidateMessage = state === 'current' && candidates === 0
    ? 'No runtime candidates were observed in the current session. This is not a clean proof.'
    : state === 'historical'
      ? 'Historical runtime evidence is shown; it cannot prove the current session is clean.'
      : state === 'unavailable'
        ? 'The runtime session is unavailable; no current clean proof is available.'
        : undefined;

  return {
    authority: {
      workspaceId: clipText(payload?.authority?.workspaceId, RUNTIME_DEBUGGER_VIEW_LIMITS.maxIdentityChars, 'workspace authority unavailable'),
      displayName: clipText(payload?.authority?.displayName, RUNTIME_DEBUGGER_VIEW_LIMITS.maxIdentityChars, 'runtime workspace'),
      ...(optionalText(payload?.authority?.contentId, RUNTIME_DEBUGGER_VIEW_LIMITS.maxIdentityChars) ? { contentId: optionalText(payload.authority.contentId, RUNTIME_DEBUGGER_VIEW_LIMITS.maxIdentityChars) } : {}),
      ...(optionalText(payload?.authority?.sourceFolder, RUNTIME_DEBUGGER_VIEW_LIMITS.maxPathChars) ? { sourceFolder: optionalText(payload.authority.sourceFolder, RUNTIME_DEBUGGER_VIEW_LIMITS.maxPathChars) } : {}),
      ...(optionalText(payload?.authority?.deployedFolder, RUNTIME_DEBUGGER_VIEW_LIMITS.maxPathChars) ? { deployedFolder: optionalText(payload.authority.deployedFolder, RUNTIME_DEBUGGER_VIEW_LIMITS.maxPathChars) } : {}),
    },
    session: {
      state,
      stateLabel: sessionStateLabel,
      ...(optionalText(payload?.session?.sessionId, RUNTIME_DEBUGGER_VIEW_LIMITS.maxIdentityChars) ? { sessionId: optionalText(payload.session.sessionId, RUNTIME_DEBUGGER_VIEW_LIMITS.maxIdentityChars) } : {}),
      ...(optionalText(payload?.session?.logPath, RUNTIME_DEBUGGER_VIEW_LIMITS.maxPathChars) ? { logPath: optionalText(payload.session.logPath, RUNTIME_DEBUGGER_VIEW_LIMITS.maxPathChars) } : {}),
      ...(boundedNumber(payload?.session?.generation) !== undefined ? { generation: boundedNumber(payload.session.generation) } : {}),
      ...(boundedLine(payload?.session?.firstLine) !== undefined ? { firstLine: boundedLine(payload.session.firstLine) } : {}),
      ...(boundedLine(payload?.session?.lastLine) !== undefined ? { lastLine: boundedLine(payload.session.lastLine) } : {}),
      ...(boundedNumber(payload?.session?.newlyReadBytes) !== undefined ? { newlyReadBytes: boundedNumber(payload.session.newlyReadBytes) } : {}),
      ...(optionalText(payload?.session?.resetReason, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars) ? { resetReason: optionalText(payload.session.resetReason, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars) } : {}),
      ...(optionalText(payload?.session?.observedAt, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars) ? { observedAt: optionalText(payload.session.observedAt, RUNTIME_DEBUGGER_VIEW_LIMITS.maxEvidenceChars) } : {}),
      detail: clipText(payload?.session?.detail, RUNTIME_DEBUGGER_VIEW_LIMITS.maxExplanationChars, 'session detail unavailable'),
    },
    coverage: {
      target,
      targetPercent,
      targetLabel: `${targetPercent}% recognition target`,
      candidates,
      recognized,
      explicitUnknown,
      recognizedOrExplicitUnknown,
      silentlyDropped,
      ratio,
      ratioPercent: ratio === null ? null : Math.round(ratio * 100),
      met,
      status,
      statusLabel,
      arithmeticLabel: `${recognized} recognized + ${explicitUnknown} explicit unknown = ${recognizedOrExplicitUnknown} / ${candidates} candidates`,
    },
    incidents,
    omittedIncidentCount: Math.max(0, visibleIncidents.length - incidents.length),
    expectedSteps,
    omittedExpectedStepCount: Math.max(0, (Array.isArray(payload?.expectedSteps) ? payload.expectedSteps.length : 0) - expectedSteps.length),
    hiddenOtherModCount,
    ambiguousCount,
    unknownCount: unknownOccurrences,
    unresolvedCount: ambiguousCount + unknownOccurrences,
    ...(noCandidateMessage ? { noCandidateMessage } : {}),
  };
}

export const createRuntimeDebuggerViewModel = buildRuntimeDebuggerViewModel;
