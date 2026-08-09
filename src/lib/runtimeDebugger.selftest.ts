import {
  analyzeRuntimeDebugger,
  attributeRuntimeCandidate,
  buildRuntimeCoverage,
  buildRuntimeOwnershipIndex,
  deduplicateRuntimeIncidents,
  evaluateExpectedRuntimeSteps,
  mapRuntimeCandidateToSource,
  mapRuntimeFileLineToNode,
  parseRuntimeCandidates,
  RUNTIME_DEBUGGER_LIMITS,
  type RuntimeCandidateIncident,
  type RuntimeExtensionInput,
  type RuntimeExpectedStep,
} from './runtimeDebugger';
import type { MDNode } from '../types';

export interface RuntimeDebuggerSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface RuntimeDebuggerSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  checks: RuntimeDebuggerSelftestCheck[];
}

function nodeFixture(id: string, label: string, path: string, start: number, end: number, semanticPath: string, type: 'cue' | 'action' = 'action'): MDNode {
  return {
    id,
    type,
    label,
    xmlTag: type === 'cue' ? 'cue' : 'cancel_conversation',
    x: 0,
    y: 0,
    properties: type === 'cue' ? { name: 'Conversation', mdScript: 'ai_influence_conversation' } : {},
    propertiesSchema: [],
    inputs: [],
    outputs: [],
    source: { path, semanticPath, start, end, modeled: true },
  };
}

function authoredEmitterFixture(message: string, tags: string): string {
  const lines = Array.from({ length: 2142 }, () => '-- deterministic emitter fixture filler');
  lines[89] = `local function emitUi(message) log("${tags} " .. message) end`;
  lines[2141] = `log("${message}" .. tostring(intelLedgerCount))`;
  return lines.join('\n');
}

function fixture(): { active: RuntimeExtensionInput; other: RuntimeExtensionInput; log: string; direct: RuntimeCandidateIncident } {
  const mdPath = 'md/ai_influence_conversation.xml';
  const sharedPath = 'md/shared.xml';
  const sharedText = 'active line\nother line\nthird line';
  const mdLines = Array.from({ length: 97 }, () => '<!-- deterministic filler -->');
  mdLines.push('<cancel_conversation><actor name="speaker" template="chat" /></cancel_conversation>');
  const mdText = mdLines.join('\n');
  const cancelStart = mdText.indexOf('<cancel_conversation>');
  const cancelEnd = cancelStart + '<cancel_conversation><actor name="speaker" template="chat" /></cancel_conversation>'.length;
  const authoredEmitterPath = 'ui/addons/ai_influence_chat/aic_uix.lua';
  const authoredEmitterText = authoredEmitterFixture('intel ledger hydrated n=', '[AICHAT][UIX]');

  const active: RuntimeExtensionInput = {
    workspaceId: 'ws-ai-live',
    displayName: 'AiLive',
    contentId: 'x4_ai_influence',
    deployedFolder: 'x4_ai_influence',
    sourceFolder: 'AiLive',
    aliases: ['AICHAT'],
    manifest: {
      [mdPath]: mdText,
      [sharedPath]: sharedText,
      'ui/ai_influence_chat.lua': 'require("ai_influence_chat")\nfunction onChat() end',
      [authoredEmitterPath]: authoredEmitterText,
    },
    mdScripts: [
      { name: 'ai_influence_conversation', path: mdPath, cues: ['cancel_conversation'], libraries: ['conversation_library'] },
      { name: 'SharedScript', path: 'md/shared.xml', cues: ['Shared'] },
    ],
    luaFiles: [{ path: 'ui/ai_influence_chat.lua', modules: ['ai_influence_chat'] }],
    nodes: [
      nodeFixture('conversation-cue', 'Conversation cue', mdPath, 0, mdText.length, 'mdscript[0]/cues[0]/cue[0]', 'cue'),
      nodeFixture('cancel-conversation', 'cancel_conversation', mdPath, cancelStart, cancelEnd, 'mdscript[0]/cues[0]/cue[0]/actions[0]/cancel_conversation[0]'),
      nodeFixture('active-shared', 'active shared node', sharedPath, 0, 'active line'.length, 'mdscript[1]/cues[0]/actions[0]'),
    ],
  };
  const other: RuntimeExtensionInput = {
    workspaceId: 'ws-other',
    displayName: 'Other Mod',
    contentId: 'other_mod',
    deployedFolder: 'other_mod',
    manifest: {
      [sharedPath]: sharedText,
      'ui/other.lua': 'function other() end',
      'ui/other_chat/other_uix.lua': authoredEmitterFixture('other telemetry hydrated n=', '[OTHER][UIX]'),
    },
    mdScripts: [{ name: 'SharedScript', path: 'md/shared.xml', cues: ['Shared'] }],
    luaFiles: [{ path: 'ui/other.lua', modules: ['other'] }],
    nodes: [
      nodeFixture('other-shared', 'other shared node', sharedPath, sharedText.indexOf('other line'), sharedText.indexOf('other line') + 'other line'.length, 'mdscript[0]/cues[0]/actions[0]'),
    ],
  };
  const directText = [
    "[=ERROR=] 10.0 extensions\\x4_ai_influence\\md\\ai_influence_conversation.xml(98): Neither of the attributes 'actor' and 'template' is present!",
    '  actor template lookup failed for the current conversation',
  ].join('\n');
  const direct = parseRuntimeCandidates(directText)[0];
  const log = [
    directText,
    "[=ERROR=] 10.5 extensions\\x4_ai_influence\\md\\ai_influence_conversation.xml(98): Neither of the attributes 'actor' and 'template' is present!",
    '[=ERROR=] 11.0 ui\\ai_influence_chat.lua:42: attempt to index a nil value',
    'stack traceback:',
    "\tui\\ai_influence_chat.lua:42: in function 'onChat'",
    "\t[C]: in function 'xpcall'",
    '[=ERROR=] 12.0 Error in MD script \'ai_influence_conversation\' cue \'cancel_conversation\' line 98: missing actor/template',
    '  caused by the current conversation template',
    '[FileIO ] 13.0 Failed to verify signature for file \'extensions\\other_mod\\ui\\other.lua\'',
    '[=ERROR=] 14.0 [AICHAT][UIX] routine status error channel heartbeat',
    '[=ERROR=] 15.0 Error in MD script \'SharedScript\' line 4: invalid parameter',
    '[=ERROR=] 16.0 AiLive failure reported by an unsupported subsystem',
    '[=ERROR=] 17.0 Fatal failure in unsupported subsystem',
  ].join('\n');
  return { active, other, log, direct };
}

export function runRuntimeDebuggerSelftest(): RuntimeDebuggerSelftestResult {
  const checks: RuntimeDebuggerSelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }) });
  try {
    const { active, other, log, direct } = fixture();
    const ownership = buildRuntimeOwnershipIndex({ active, otherExtensions: [other] });
    const directAttribution = attributeRuntimeCandidate(ownership, direct);
    const directMapping = mapRuntimeCandidateToSource(ownership, { ...direct, attribution: directAttribution });

    check('active_fixture_uses_content_and_deployed_id_x4_ai_influence', ownership.owners[0].contentIds.includes('x4_ai_influence') && ownership.owners[0].deployedFolders.includes('x4_ai_influence'));
    check('direct_extension_path_is_parsed', direct.source.extensionFolder === 'x4_ai_influence' && direct.source.file === 'md/ai_influence_conversation.xml' && direct.source.line === 98);
    check('real_x4_parenthesized_line_with_colon_is_pinned', direct.message.includes("Neither of the attributes 'actor' and 'template' is present!") && direct.source.extensionFolder === 'x4_ai_influence' && direct.kind === 'direct_extension_fault');
    check('direct_path_missing_actor_template_is_governed_engine_failure', direct.isEngineFailure && direct.kind === 'direct_extension_fault' && direct.engineSignature === 'missing actor/template attributes');
    check('direct_path_confirms_active_without_x4_ailive', directAttribution.disposition === 'confirmed_active' && directAttribution.matchedWorkspaceId === 'ws-ai-live', directAttribution.reason);
    check('direct_path_maps_to_deepest_cancel_conversation_node', directMapping.kind === 'node' && directMapping.nodeId === 'cancel-conversation' && directMapping.nodeLabel === 'cancel_conversation', directMapping);

    const otherCandidate = parseRuntimeCandidates("[FileIO ] 20.0 Failed to verify signature for file 'extensions\\other_mod\\ui\\other.lua'")[0];
    const otherAttribution = attributeRuntimeCandidate(ownership, otherCandidate);
    check('exact_other_extension_path_is_excluded', otherAttribution.disposition === 'excluded_other_mod' && otherAttribution.matchedWorkspaceId === 'ws-other', otherAttribution.reason);

    const collisionCandidate = parseRuntimeCandidates("[=ERROR=] 21.0 Error in MD script 'SharedScript' line 4: invalid parameter")[0];
    const collisionAttribution = attributeRuntimeCandidate(ownership, collisionCandidate);
    check('colliding_md_script_is_ambiguous', collisionAttribution.disposition === 'ambiguous', collisionAttribution.reason);

    const activeShared = parseRuntimeCandidates('[=ERROR=] 28.0 extensions\\x4_ai_influence\\md\\shared.xml(1): invalid parameter')[0];
    const activeSharedAttribution = attributeRuntimeCandidate(ownership, activeShared);
    const activeSharedMapping = mapRuntimeCandidateToSource(ownership, { ...activeShared, attribution: activeSharedAttribution });
    check('active_same_relative_path_maps_inside_active_owner', activeSharedAttribution.disposition === 'confirmed_active' && activeSharedMapping.kind === 'node' && activeSharedMapping.nodeId === 'active-shared', activeSharedMapping);

    const otherShared = parseRuntimeCandidates('[=ERROR=] 29.0 extensions\\other_mod\\md\\shared.xml(2): invalid parameter')[0];
    const otherSharedAttribution = attributeRuntimeCandidate(ownership, otherShared);
    const otherSharedMapping = mapRuntimeCandidateToSource(ownership, { ...otherShared, attribution: otherSharedAttribution });
    check('excluded_same_relative_path_maps_inside_other_owner', otherSharedAttribution.disposition === 'excluded_other_mod' && otherSharedMapping.kind === 'node' && otherSharedMapping.nodeId === 'other-shared', otherSharedMapping);

    const ambiguousShared = parseRuntimeCandidates('[=ERROR=] 29.5 md/shared.xml:2: invalid parameter')[0];
    const ambiguousSharedAttribution = attributeRuntimeCandidate(ownership, ambiguousShared);
    const ambiguousSharedMapping = mapRuntimeCandidateToSource(ownership, { ...ambiguousShared, attribution: ambiguousSharedAttribution });
    check('ambiguous_same_relative_path_stays_file_line', ambiguousSharedAttribution.disposition === 'ambiguous' && ambiguousSharedMapping.kind === 'file_line' && !ambiguousSharedMapping.nodeId, ambiguousSharedMapping);

    const displayCandidate = parseRuntimeCandidates('[=ERROR=] 22.0 AiLive failure reported')[0];
    const displayAttribution = attributeRuntimeCandidate(ownership, displayCandidate);
    check('display_name_only_never_confirms_active', displayAttribution.disposition !== 'confirmed_active' && displayAttribution.reason.includes('Display-name'));
    const aliasCandidate = parseRuntimeCandidates('[=ERROR=] 23.0 [AICHAT] failure marker')[0];
    const aliasAttribution = attributeRuntimeCandidate(ownership, aliasCandidate);
    check('explicit_alias_only_is_weak', aliasAttribution.disposition !== 'confirmed_active' && aliasAttribution.reason.includes('alias'));

    const authored = parseRuntimeCandidates('[=ERROR=] 24.0 [AICHAT][UIX] routine status error channel heartbeat')[0];
    check('authored_marker_is_recognized', authored.kind === 'authored_diagnostic' && authored.recognized);
    check('authored_marker_is_not_engine_failure', !authored.isEngineFailure && !authored.engineSignature);
    const authoredTelemetry = analyzeRuntimeDebugger({
      logText: '[=ERROR=] 24.2 [AICHAT][UIX] intel ledger hydrated n=6',
      ownership,
    }).candidates[0];
    const authoredEmitter = authoredTelemetry?.attribution.authoredEmitter;
    check(
      'authored_telemetry_unique_active_emitter_is_confirmed',
      authoredTelemetry?.attribution.disposition === 'confirmed_active'
        && authoredTelemetry.attribution.matchedWorkspaceId === 'ws-ai-live'
        && authoredTelemetry.attribution.authoredEmitterCandidates?.length === 1
        && authoredEmitter?.file === 'ui/addons/ai_influence_chat/aic_uix.lua'
        && authoredEmitter.line === 2142,
      authoredTelemetry,
    );
    check(
      'authored_telemetry_maps_exact_emitter_and_retains_support',
      authoredTelemetry?.mapping.kind === 'file_line'
        && authoredTelemetry.mapping.file === 'ui/addons/ai_influence_chat/aic_uix.lua'
        && authoredTelemetry.mapping.line === 2142
        && authoredEmitter?.source.includes('log("intel ledger hydrated n="')
        && authoredEmitter.supportingEvidence.some(item => item.line === 90 && item.source.includes('[AICHAT][UIX]'))
        && authoredTelemetry.attribution.evidence.some(item => item.label === 'authored emitter source' && item.value.includes('intel ledger hydrated n=')),
      authoredTelemetry,
    );
    check(
      'authored_telemetry_explanation_is_activity_only_and_conditional',
      authoredTelemetry?.explanation.cause.includes('mod emitted')
        && authoredTelemetry.explanation.impact.includes('no engine fault')
        && authoredTelemetry.explanation.nextAction.includes('If this activity is unexpected')
        && authoredTelemetry.explanation.nextAction.includes('ui/addons/ai_influence_chat/aic_uix.lua:2142')
        && !authoredTelemetry.explanation.nextAction.includes('correct the bounded fault'),
      authoredTelemetry?.explanation,
    );
    const otherTelemetry = analyzeRuntimeDebugger({
      logText: '[=ERROR=] 24.3 [OTHER][UIX] other telemetry hydrated n=6',
      ownership,
    }).candidates[0];
    check(
      'authored_telemetry_unique_known_other_emitter_is_excluded',
      otherTelemetry?.attribution.disposition === 'excluded_other_mod'
        && otherTelemetry.attribution.matchedWorkspaceId === 'ws-other'
        && otherTelemetry.attribution.authoredEmitter?.file === 'ui/other_chat/other_uix.lua'
        && otherTelemetry.mapping.file === 'ui/other_chat/other_uix.lua'
        && otherTelemetry.mapping.line === 2142,
      otherTelemetry,
    );
    const ambiguousOther: RuntimeExtensionInput = {
      ...other,
      workspaceId: 'ws-ambiguous',
      contentId: 'ambiguous_mod',
      deployedFolder: 'ambiguous_mod',
      manifest: {
        ...(other.manifest || {}),
        'ui/ambiguous_chat/aic_uix.lua': authoredEmitterFixture('intel ledger hydrated n=', '[AICHAT][UIX]'),
      },
    };
    const ambiguousTelemetry = analyzeRuntimeDebugger({
      logText: '[=ERROR=] 24.7 [AICHAT][UIX] intel ledger hydrated n=6',
      ownership: buildRuntimeOwnershipIndex({ active, otherExtensions: [ambiguousOther] }),
    }).candidates[0];
    check(
      'authored_telemetry_multiple_emitters_stays_ambiguous_with_bounded_locations',
      ambiguousTelemetry?.attribution.disposition === 'ambiguous'
        && !ambiguousTelemetry.attribution.authoredEmitter
        && ambiguousTelemetry.attribution.authoredEmitterCandidates?.length === 2
        && ambiguousTelemetry.mapping.kind === 'unmapped'
        && ambiguousTelemetry.mapping.candidateLocations?.length === 2
        && ambiguousTelemetry.explanation.nextAction.includes('ui/addons/ai_influence_chat/aic_uix.lua:2142')
        && ambiguousTelemetry.explanation.nextAction.includes('ui/ambiguous_chat/aic_uix.lua:2142'),
      ambiguousTelemetry,
    );
    const unresolvedTelemetry = analyzeRuntimeDebugger({
      logText: '[=ERROR=] 24.8 [UNMATCHED][UIX] intel ledger absent n=6',
      ownership,
    }).candidates[0];
    check(
      'authored_telemetry_without_emitter_stays_unresolved',
      unresolvedTelemetry?.attribution.disposition === 'unknown'
        && !unresolvedTelemetry.attribution.authoredEmitter
        && !unresolvedTelemetry.attribution.authoredEmitterCandidates?.length
        && unresolvedTelemetry.mapping.kind === 'unmapped'
        && unresolvedTelemetry.explanation.nextAction.includes('If this activity is unexpected')
        && unresolvedTelemetry.explanation.nextAction.includes('no exact emitter was found'),
      unresolvedTelemetry,
    );
    const authoredRoutinePath = parseRuntimeCandidates('[=ERROR=] 24.4 [AICHTTP] routine status extensions/x4_ai_influence/ui/ai_influence_chat.lua:42')[0];
    check('tagged_routine_source_line_is_informational', authoredRoutinePath.kind === 'authored_diagnostic' && authoredRoutinePath.isEngineFailure === false && !authoredRoutinePath.engineSignature && authoredRoutinePath.source.file === 'ui/ai_influence_chat.lua' && authoredRoutinePath.source.line === 42, authoredRoutinePath);
    const authoredOwnedPath = parseRuntimeCandidates('[=ERROR=] 24.5 [AICHTTP] AIC-HTTP libs loaded from extensions/x4_ai_influence/lua3p/')[0];
    check('tagged_owned_path_diagnostic_is_informational', authoredOwnedPath.kind === 'authored_diagnostic' && authoredOwnedPath.isEngineFailure === false && authoredOwnedPath.source.extensionFolder === 'x4_ai_influence', authoredOwnedPath);
    const taggedDirect = parseRuntimeCandidates("[=ERROR=] 24.6 [AICHTTP] extensions/x4_ai_influence/md/ai_influence_conversation.xml(98): Neither of the attributes 'actor' and 'template' is present!")[0];
    check('tagged_direct_path_line_remains_governed_engine_failure', taggedDirect.kind === 'direct_extension_fault' && taggedDirect.isEngineFailure && taggedDirect.engineSignature === 'missing actor/template attributes' && taggedDirect.source.line === 98, taggedDirect);
    check('tagged_owned_path_diagnostic_does_not_downgrade_direct_fault', direct.kind === 'direct_extension_fault' && direct.isEngineFailure === true, direct);
    const genuineLua = parseRuntimeCandidates([
      '[=ERROR=] 25.0 ui\\ai_influence_chat.lua:42: attempt to index a nil value',
      'stack traceback:',
      "\tui\\ai_influence_chat.lua:42: in function 'onChat'",
      "\t[C]: in function 'xpcall'",
    ].join('\n'))[0];
    check('multiline_lua_group_contains_stack_frames', genuineLua.endLine === 4 && genuineLua.source.stackFrames.some(frame => frame.file === 'ui/ai_influence_chat.lua' && frame.line === 42));
    check('genuine_lua_fault_is_engine_failure', genuineLua.kind === 'lua_fault' && genuineLua.isEngineFailure);

    const genuineMd = parseRuntimeCandidates([
      "[=ERROR=] 26.0 Error in MD script 'ai_influence_conversation' cue 'cancel_conversation' line 98: missing actor/template",
      '  caused by the current conversation template',
    ].join('\n'))[0];
    check('multiline_md_group_contains_continuation', genuineMd.endLine === 2 && genuineMd.source.mdScript === 'ai_influence_conversation' && genuineMd.source.cue === 'cancel_conversation');
    check('genuine_md_fault_is_engine_failure', genuineMd.kind === 'md_fault' && genuineMd.isEngineFailure);

    const unsupported = parseRuntimeCandidates('[=ERROR=] 27.0 Fatal failure in unsupported subsystem')[0];
    check('unsupported_candidate_failure_is_explicit_unknown', unsupported.kind === 'unknown' && unsupported.explicitUnknown && unsupported.recognized === false);

    const firstBatch = parseRuntimeCandidates('[=ERROR=] 30.0 Fatal failure in first absolute batch', { baseLine: 100 });
    const secondBatch = parseRuntimeCandidates('[=ERROR=] 31.0 Fatal failure in second absolute batch', { startLine: 200 });
    check('incremental_batches_preserve_absolute_line_offsets', firstBatch[0]?.startLine === 100 && firstBatch[0]?.endLine === 100 && secondBatch[0]?.startLine === 200 && secondBatch[0]?.endLine === 200);

    const analysis = analyzeRuntimeDebugger({
      logText: log,
      ownership,
      expectedSteps: [
        { id: 'boot', label: 'boot marker', marker: '[AICHAT][UIX]' },
        { id: 'never-seen', label: 'never seen marker', marker: '[NEVER-SEEN]' },
      ],
      currentSegment: { available: true, segmentId: 'segment-1', lines: ['[AICHAT][UIX] routine status error channel heartbeat'] },
    });
    const deduped = analysis.incidents.find(incident => incident.count === 2);
    check('equivalent_direct_incidents_collapse_with_count', Boolean(deduped && deduped.firstLine < deduped.lastLine && deduped.samples.length <= 4), analysis.incidents);
    check('dedup_retains_first_last_evidence_and_samples', Boolean(deduped && deduped.firstTimestamp === '10.0' && deduped.lastTimestamp === '10.5' && deduped.evidence.length > 0 && deduped.samples.length > 0));
    check('coverage_is_at_least_99_percent', analysis.coverage.recognizedOrExplicitUnknownRatio >= 0.99, analysis.coverage);
    check('coverage_disposition_sum_equals_candidates', analysis.coverage.dispositionSum === analysis.coverage.candidates && analysis.coverage.dispositionCounts.confirmed_active + analysis.coverage.dispositionCounts.ambiguous + analysis.coverage.dispositionCounts.excluded_other_mod + analysis.coverage.dispositionCounts.unknown === analysis.coverage.candidates, analysis.coverage);
    const excludedOther = analysis.candidates.filter(candidate => candidate.attribution.disposition === 'excluded_other_mod');
    check('known_other_incident_is_not_confirmed_active', excludedOther.length > 0 && excludedOther.every(candidate => candidate.attribution.disposition !== 'confirmed_active'));

    const duplicateCandidates = Array.from({ length: 2000 }, (_, index) => ({
      ...direct,
      id: `duplicate-${index}`,
      startLine: 300 + index,
      endLine: 300 + index,
      lineNumber: 300 + index,
      lineNumbers: [300 + index],
    }));
    const duplicateIncident = deduplicateRuntimeIncidents(duplicateCandidates)[0];
    check('thousands_of_duplicates_retain_bounded_ids_and_exact_count', Boolean(duplicateIncident && duplicateIncident.count === 2000 && duplicateIncident.candidateIds.length === RUNTIME_DEBUGGER_LIMITS.maxCandidateIds && duplicateIncident.omittedCandidateIds === 2000 - RUNTIME_DEBUGGER_LIMITS.maxCandidateIds && duplicateIncident.samples.length <= RUNTIME_DEBUGGER_LIMITS.maxSamples && duplicateIncident.evidence.length <= RUNTIME_DEBUGGER_LIMITS.maxEvidence), duplicateIncident);

    const hostile = parseRuntimeCandidates(`${"[=ERROR=] 32.0 extensions\\x4_ai_influence\\md\\ai_influence_conversation.xml(98): Neither of the attributes 'actor' and 'template' is present!"}${'Z'.repeat(200000)}`)[0];
    check('hostile_giant_line_preserves_classification_and_source_tokens', hostile.kind === 'direct_extension_fault' && hostile.source.extensionFolder === 'x4_ai_influence' && hostile.source.file === 'md/ai_influence_conversation.xml' && hostile.source.line === 98);
    check('hostile_giant_line_returns_bounded_payloads', hostile.raw.length <= RUNTIME_DEBUGGER_LIMITS.maxGroupChars && hostile.message.length <= RUNTIME_DEBUGGER_LIMITS.maxMessageChars && hostile.lines.every(line => line.length <= RUNTIME_DEBUGGER_LIMITS.maxLineChars) && hostile.evidence.every(item => item.value.length <= RUNTIME_DEBUGGER_LIMITS.maxEvidenceChars) && hostile.source.stackFrames.every(frame => frame.raw.length <= RUNTIME_DEBUGGER_LIMITS.maxLineChars));

    const inconsistentCoverage = buildRuntimeCoverage([{ ...direct, recognized: true, explicitUnknown: true }]);
    check('coverage_uses_recognized_or_unknown_union', inconsistentCoverage.candidates === 1 && inconsistentCoverage.recognized === 1 && inconsistentCoverage.explicitUnknown === 1 && inconsistentCoverage.recognizedOrExplicitUnknown === 1 && inconsistentCoverage.recognizedOrExplicitUnknownRatio === 1 && inconsistentCoverage.silentlyDropped === 0, inconsistentCoverage);

    const expected: RuntimeExpectedStep[] = [
      { id: 'observed', marker: '[AICHAT][UIX]' },
      { id: 'missing', marker: '[MISSING]' },
    ];
    const expectedResults = evaluateExpectedRuntimeSteps(expected, { available: true, lines: ['[AICHAT][UIX] ready'], candidates: [] });
    const unavailable = evaluateExpectedRuntimeSteps(expected, { available: false, lines: [] });
    check('expected_observed_is_true', expectedResults[0].truth === 'observed' && expectedResults[0].success);
    check('expected_missing_is_not_success', expectedResults[1].truth === 'missing' && !expectedResults[1].success);
    check('expected_unavailable_is_distinct', unavailable.every(step => step.truth === 'unavailable' && !step.success));
    check('analysis_expected_steps_are_current_segment_scoped', analysis.expectedSteps[0].truth === 'observed' && analysis.expectedSteps[1].truth === 'missing');

    const fallback = mapRuntimeFileLineToNode(ownership, { file: 'md/does_not_exist.xml', line: 3 });
    check('unsupported_source_span_falls_back_to_exact_file_line', fallback.kind === 'file_line' && fallback.file === 'md/does_not_exist.xml' && fallback.line === 3 && !fallback.nodeId);
    const blankCoverage = buildRuntimeCoverage([]);
    check('empty_candidate_set_has_honest_full_coverage', blankCoverage.candidates === 0 && blankCoverage.recognizedOrExplicitUnknownRatio === 1 && blankCoverage.dispositionSum === 0);
    check('dedup_samples_are_bounded', deduplicateRuntimeIncidents(analysis.candidates, 99).every(incident => incident.samples.length <= 4));
  } catch (error) {
    check('selftest_unexpected_exception', false, error instanceof Error ? error.message : String(error));
  }
  const passed = checks.filter(item => item.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}

const invokedDirectly = (process.argv[1] || '').toLowerCase().endsWith('runtimedebugger.selftest.ts');
if (invokedDirectly) {
  const result = runRuntimeDebuggerSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
