import { createHash } from 'node:crypto';

import rawX4CoreRulePack from './x4RulePack.core.json' with { type: 'json' };

import {
  buildX4RulePack,
  canonicalX4RulePackPayload,
  type X4RuleBuildInput,
  verifyX4RulePack,
} from './x4RulePackCanonical';
import { parseX4RulePackJson, parseX4RulePackSet, parseX4RulePackValue } from './x4RulePackParser';
import {
  compareX4GameVersions,
  getX4RuleApplicability,
  parseX4GameVersion,
  resolveX4DiagnosticRule,
} from './x4RulePackResolver';
import {
  X4_CORE_RULE_PACK,
  X4_CORE_RULE_PACK_EXPECTED_SHA256,
  resolveCoreX4DiagnosticRule,
} from './x4RulePacks';
import {
  X4_RULE_PACK_MAX_CODES,
  X4_RULE_PACK_MAX_RULES,
  X4_RULE_PACK_MAX_STRING,
} from './x4RulePackTypes';
import type {
  X4DiagnosticRuleInput,
  X4RuleGameVersionScopeV1,
  X4RulePackV1,
  X4VerifiedRulePackV1,
} from './x4RulePackTypes';

type X4RuleBuildRule = X4RuleBuildInput['rules'][number];
type RawRecord = Record<string, unknown>;

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clonedCorePack(): RawRecord {
  return jsonClone(rawX4CoreRulePack) as RawRecord;
}

function firstRawRule(pack: RawRecord): RawRecord {
  return (pack.rules as RawRecord[])[0];
}

function catchesThrow(action: () => unknown): boolean {
  try {
    action();
  } catch {
    return true;
  }
  return false;
}

function exactRule(
  id: string,
  code: string,
  applicability: X4RuleGameVersionScopeV1 = {},
): X4RuleBuildRule {
  return {
    id,
    version: '1.0.0',
    detector: { id: 'diagnostic.code_exact', codes: [code] },
    applicability,
    evidence: { grade: 'advisory', basis: 'deterministic fixture' },
    guidance: {
      title: 'Fixture guidance',
      why: 'Fixture reason',
      impact: 'Fixture impact',
      next: 'Fixture next step',
    },
  };
}

function prefixRule(id: string, prefix: string): X4RuleBuildRule {
  return {
    id,
    version: '1.0.0',
    detector: { id: 'diagnostic.code_prefix', prefix },
    applicability: {},
    evidence: { grade: 'advisory', basis: 'deterministic fixture' },
    guidance: {
      title: 'Fixture guidance',
      why: 'Fixture reason',
      impact: 'Fixture impact',
      next: 'Fixture next step',
    },
  };
}

function buildSyntheticPack(
  rules: readonly X4RuleBuildRule[],
  packId = 'test.rulepack',
): X4VerifiedRulePackV1 {
  return buildX4RulePack(sha256, {
    schemaVersion: 1,
    packId,
    packVersion: '1.0.0',
    rules,
  });
}

function isCompletelyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  if (seen.has(value)) return true;
  seen.add(value);

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !isCompletelyFrozen(descriptor.value, seen)) return false;
  }
  return true;
}

export function runX4RulePacksSelftest(): {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  checks: { name: string; pass: boolean; detail?: string }[];
} {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const check = (name: string, pass: boolean, detail?: unknown): void => {
    checks.push({
      name,
      pass: !!pass,
      ...(detail === undefined ? {} : { detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }),
    });
  };

  const parsedCore = parseX4RulePackValue(rawX4CoreRulePack);
  const verifiedCore = verifyX4RulePack(rawX4CoreRulePack, sha256);
  check(
    'core_pack_verifies_with_real_sha256_and_expected_identity',
    verifiedCore.packSha256 === X4_CORE_RULE_PACK_EXPECTED_SHA256
      && verifiedCore.packSha256 === X4_CORE_RULE_PACK.packSha256
      && canonicalX4RulePackPayload(verifiedCore) === canonicalX4RulePackPayload(X4_CORE_RULE_PACK)
      && JSON.stringify(parsedCore) === JSON.stringify(X4_CORE_RULE_PACK),
  );

  const expectedCoreIdentities = [
    {
      id: 'x4.bridge.md_event_register',
      version: '1.0.0',
      evidenceDigest: '9a67cbd610d77c8657c03edb51d6066c89c39a5394ee93ddd5cf88e2dd8f265c',
    },
    {
      id: 'x4.bridge.ui_event_listener',
      version: '1.0.0',
      evidenceDigest: '912dc7f1e6c373b977ac46a847f59f9d0b00ea0a33a4cd5055553fd305065ba1',
    },
    {
      id: 'x4.schema.routed_validation',
      version: '1.0.0',
      evidenceDigest: 'f5786993e68ba1df76e89fba409a300ccd6e948dc84b9e1542e86e789bc0d847',
    },
  ] as const;
  check(
    'core_has_exactly_three_stable_rule_and_evidence_identities',
    X4_CORE_RULE_PACK.rules.length === 3
      && JSON.stringify(X4_CORE_RULE_PACK.rules.map(rule => ({
        id: rule.id,
        version: rule.version,
        evidenceDigest: rule.evidence.digestSha256,
      }))) === JSON.stringify(expectedCoreIdentities),
  );

  const deterministicInput: X4RuleBuildInput = {
    schemaVersion: 1,
    packId: 'test.deterministic',
    packVersion: '1.0.0',
    rules: [exactRule('test.deterministic_rule', 'DETERMINISTIC_CODE')],
  };
  const deterministicA = buildX4RulePack(sha256, deterministicInput);
  const deterministicB = buildX4RulePack(sha256, deterministicInput);
  check(
    'build_is_deterministic',
    JSON.stringify(deterministicA) === JSON.stringify(deterministicB)
      && deterministicA.packSha256 === deterministicB.packSha256
      && canonicalX4RulePackPayload(deterministicA) === canonicalX4RulePackPayload(deterministicB),
  );

  const keyOrderA: X4RuleBuildInput = {
    schemaVersion: 1,
    packId: 'test.keys',
    packVersion: '1.0.0',
    rules: [{
      id: 'test.keys_rule',
      version: '1.0.0',
      detector: { id: 'diagnostic.code_exact', codes: ['KEY_CODE'] },
      applicability: { maxGameVersion: '9.10', minGameVersion: '9.00' },
      evidence: { grade: 'advisory', basis: 'key order fixture' },
      guidance: {
        title: 'Fixture title',
        why: 'Fixture why',
        impact: 'Fixture impact',
        next: 'Fixture next',
      },
    }],
  };
  const keyOrderB: X4RuleBuildInput = {
    rules: [{
      guidance: {
        next: 'Fixture next',
        impact: 'Fixture impact',
        why: 'Fixture why',
        title: 'Fixture title',
      },
      evidence: { basis: 'key order fixture', grade: 'advisory' },
      applicability: { minGameVersion: '9.00', maxGameVersion: '9.10' },
      detector: { codes: ['KEY_CODE'], id: 'diagnostic.code_exact' },
      version: '1.0.0',
      id: 'test.keys_rule',
    }],
    packVersion: '1.0.0',
    packId: 'test.keys',
    schemaVersion: 1,
  };
  const keyPackA = buildX4RulePack(sha256, keyOrderA);
  const keyPackB = buildX4RulePack(sha256, keyOrderB);
  check(
    'object_key_order_normalizes',
    JSON.stringify(keyPackA) === JSON.stringify(keyPackB)
      && keyPackA.packSha256 === keyPackB.packSha256,
  );

  const ruleOrderA = buildSyntheticPack([
    exactRule('test.z_rule', 'RULE_Z'),
    exactRule('test.a_rule', 'RULE_A'),
  ], 'test.rule-order');
  const ruleOrderB = buildSyntheticPack([
    exactRule('test.a_rule', 'RULE_A'),
    exactRule('test.z_rule', 'RULE_Z'),
  ], 'test.rule-order');
  check(
    'rule_order_normalizes',
    JSON.stringify(ruleOrderA) === JSON.stringify(ruleOrderB)
      && JSON.stringify(ruleOrderA.rules.map(rule => rule.id)) === JSON.stringify(['test.a_rule', 'test.z_rule']),
  );

  const codeOrderA = buildSyntheticPack([{
    ...exactRule('test.code_order', 'CODE_Z'),
    detector: { id: 'diagnostic.code_exact', codes: ['CODE_Z', 'CODE_A'] },
  }], 'test.code-order');
  const codeOrderB = buildSyntheticPack([{
    ...exactRule('test.code_order', 'CODE_Z'),
    detector: { id: 'diagnostic.code_exact', codes: ['CODE_A', 'CODE_Z'] },
  }], 'test.code-order');
  check(
    'exact_code_order_normalizes',
    JSON.stringify(codeOrderA) === JSON.stringify(codeOrderB)
      && codeOrderA.rules[0].detector.id === 'diagnostic.code_exact'
      && JSON.stringify(codeOrderA.rules[0].detector.codes) === JSON.stringify(['CODE_A', 'CODE_Z']),
  );

  const evidenceBase = buildSyntheticPack([exactRule('test.evidence_drift', 'EVIDENCE_DRIFT')], 'test.evidence');
  const evidenceDrift: X4RulePackV1 = {
    ...evidenceBase,
    rules: evidenceBase.rules.map(rule => ({
      ...rule,
      evidence: { ...rule.evidence, basis: 'changed fixture basis' },
    })),
  };
  check('evidence_drift_is_rejected', catchesThrow(() => verifyX4RulePack(evidenceDrift, sha256)));

  const guidanceDrift: X4RulePackV1 = {
    ...evidenceBase,
    rules: evidenceBase.rules.map(rule => ({
      ...rule,
      guidance: { ...rule.guidance, title: 'changed fixture title' },
    })),
  };
  check('guidance_drift_is_rejected', catchesThrow(() => verifyX4RulePack(guidanceDrift, sha256)));

  const detectorDrift: X4RulePackV1 = {
    ...evidenceBase,
    rules: evidenceBase.rules.map(rule => ({
      ...rule,
      detector: { id: 'diagnostic.code_exact', codes: ['CHANGED_DETECTOR'] },
    })),
  };
  check('detector_drift_is_rejected', catchesThrow(() => verifyX4RulePack(detectorDrift, sha256)));

  check('malformed_json_is_rejected', catchesThrow(() => parseX4RulePackJson('{"schemaVersion":1')));

  const boundedPack = buildSyntheticPack([
    exactRule('test.bounded', 'BOUNDED_CODE', { minGameVersion: '9.00', maxGameVersion: '9.10' }),
  ], 'test.bounded');
  const missingTarget = resolveX4DiagnosticRule(boundedPack, { code: 'BOUNDED_CODE' });
  check(
    'missing_target_version_is_unavailable',
    missingTarget.kind === 'matched' && missingTarget.applicability === 'unavailable',
  );

  check(
    'game_version_9_00_equals_9_and_9_10_exceeds_9_2',
    compareX4GameVersions('9.00', '9') === 0
      && compareX4GameVersions('9.10', '9.2') === 1,
  );

  const boundedScope: X4RuleGameVersionScopeV1 = { minGameVersion: '9.00', maxGameVersion: '9.10' };
  check(
    'applicability_is_inclusive_and_out_of_range',
    getX4RuleApplicability(boundedScope, '9.00') === 'applicable'
      && getX4RuleApplicability(boundedScope, '9.10') === 'applicable'
      && getX4RuleApplicability(boundedScope, '8.99') === 'not_applicable'
      && getX4RuleApplicability(boundedScope, '9.11') === 'not_applicable',
  );

  const xsdMatch = resolveCoreX4DiagnosticRule({ code: 'XSD_UNKNOWN_ELEMENT' });
  const registerMatch = resolveCoreX4DiagnosticRule({ code: 'md_lua.missing_register' });
  const listenerMatch = resolveCoreX4DiagnosticRule({ code: 'lua_md.missing_listener' });
  check(
    'xsd_prefix_and_two_exact_matches_resolve',
    xsdMatch.kind === 'matched'
      && xsdMatch.ruleId === 'x4.schema.routed_validation'
      && registerMatch.kind === 'matched'
      && registerMatch.ruleId === 'x4.bridge.md_event_register'
      && listenerMatch.kind === 'matched'
      && listenerMatch.ruleId === 'x4.bridge.ui_event_listener',
  );

  const unrelated = resolveCoreX4DiagnosticRule({ code: 'unrelated.diagnostic' });
  check(
    'unrelated_code_is_unmatched',
    unrelated.kind === 'unmatched'
      && JSON.stringify(unrelated.input) === JSON.stringify({ code: 'unrelated.diagnostic' }),
  );

  const overlapPack = buildSyntheticPack([
    prefixRule('test.overlap_prefix', 'OVERLAP.'),
    exactRule('test.overlap_exact', 'OVERLAP.CODE'),
  ], 'test.overlap');
  const overlapInput: X4DiagnosticRuleInput = { code: 'OVERLAP.CODE' };
  const overlap = resolveX4DiagnosticRule(overlapPack, overlapInput);
  check(
    'overlap_ambiguity_returns_both_candidates_in_pack_order',
    overlap.kind === 'ambiguous'
      && overlap.candidates.length === 2
      && JSON.stringify(overlap.candidates.map(candidate => candidate.ruleId))
        === JSON.stringify(overlapPack.rules.map(rule => rule.id))
      && overlap.candidates.every(candidate => candidate.packSha256 === overlapPack.packSha256),
  );

  const packBeforeResolve = JSON.stringify(overlapPack);
  const inputBeforeResolve = JSON.stringify(overlapInput);
  resolveX4DiagnosticRule(overlapPack, overlapInput);
  check(
    'resolve_does_not_mutate_pack_or_input',
    JSON.stringify(overlapPack) === packBeforeResolve && JSON.stringify(overlapInput) === inputBeforeResolve,
  );

  check('core_pack_is_completely_deep_frozen', isCompletelyFrozen(X4_CORE_RULE_PACK));

  const unknownRootKeyPack = clonedCorePack();
  unknownRootKeyPack.unknown = true;
  const unknownRuleKeyPack = clonedCorePack();
  firstRawRule(unknownRuleKeyPack).unknown = true;
  const unknownDetectorKeyPack = clonedCorePack();
  (firstRawRule(unknownDetectorKeyPack).detector as RawRecord).unknown = true;
  const unknownApplicabilityKeyPack = clonedCorePack();
  (firstRawRule(unknownApplicabilityKeyPack).applicability as RawRecord).unknown = true;
  const unknownEvidenceKeyPack = clonedCorePack();
  (firstRawRule(unknownEvidenceKeyPack).evidence as RawRecord).unknown = true;
  const unknownGuidanceKeyPack = clonedCorePack();
  (firstRawRule(unknownGuidanceKeyPack).guidance as RawRecord).unknown = true;
  check(
    'unknown_keys_rejected_at_root_and_nested_levels',
    catchesThrow(() => parseX4RulePackValue(unknownRootKeyPack))
      && catchesThrow(() => parseX4RulePackValue(unknownRuleKeyPack))
      && catchesThrow(() => parseX4RulePackValue(unknownDetectorKeyPack))
      && catchesThrow(() => parseX4RulePackValue(unknownApplicabilityKeyPack))
      && catchesThrow(() => parseX4RulePackValue(unknownEvidenceKeyPack))
      && catchesThrow(() => parseX4RulePackValue(unknownGuidanceKeyPack)),
  );

  const promptPack = clonedCorePack();
  promptPack.prompt = 'run this prompt';
  const scriptPack = clonedCorePack();
  firstRawRule(scriptPack).script = 'run this script';
  const regexPack = clonedCorePack();
  (firstRawRule(regexPack).detector as RawRecord).regex = '.*';
  const xpathPack = clonedCorePack();
  (firstRawRule(xpathPack).applicability as RawRecord).xpath = '//unsafe';
  const javascriptPack = clonedCorePack();
  (firstRawRule(javascriptPack).guidance as RawRecord).javascript = 'alert(1)';
  check(
    'executable_like_data_fields_are_rejected',
    catchesThrow(() => parseX4RulePackValue(promptPack))
      && catchesThrow(() => parseX4RulePackValue(scriptPack))
      && catchesThrow(() => parseX4RulePackValue(regexPack))
      && catchesThrow(() => parseX4RulePackValue(xpathPack))
      && catchesThrow(() => parseX4RulePackValue(javascriptPack)),
  );

  const unknownDetectorIdPack = clonedCorePack();
  (firstRawRule(unknownDetectorIdPack).detector as RawRecord).id = 'diagnostic.unknown';
  check('unknown_detector_id_is_rejected', catchesThrow(() => parseX4RulePackValue(unknownDetectorIdPack)));

  const duplicatePackIdA = clonedCorePack();
  const duplicatePackIdB = clonedCorePack();
  check(
    'duplicate_pack_ids_are_rejected_by_pack_set_parser',
    catchesThrow(() => parseX4RulePackSet([duplicatePackIdA, duplicatePackIdB])),
  );

  const duplicateRuleWithinPack = clonedCorePack();
  const duplicateRuleWithinPackSource = jsonClone(firstRawRule(duplicateRuleWithinPack));
  duplicateRuleWithinPack.rules = [duplicateRuleWithinPackSource, jsonClone(duplicateRuleWithinPackSource)];
  const duplicateRuleAcrossPackA = clonedCorePack();
  duplicateRuleAcrossPackA.packId = 'test.duplicate-rule-a';
  const duplicateRuleAcrossPackB = clonedCorePack();
  duplicateRuleAcrossPackB.packId = 'test.duplicate-rule-b';
  const sharedRule = jsonClone(firstRawRule(duplicateRuleAcrossPackA));
  duplicateRuleAcrossPackA.rules = [jsonClone(sharedRule)];
  duplicateRuleAcrossPackB.rules = [jsonClone(sharedRule)];
  check(
    'duplicate_rule_ids_are_rejected_within_and_across_packs',
    catchesThrow(() => parseX4RulePackValue(duplicateRuleWithinPack))
      && catchesThrow(() => parseX4RulePackSet([duplicateRuleAcrossPackA, duplicateRuleAcrossPackB])),
  );

  const duplicateExactCodesPack = clonedCorePack();
  (firstRawRule(duplicateExactCodesPack).detector as RawRecord).codes = ['DUPLICATE_CODE', 'DUPLICATE_CODE'];
  check(
    'duplicate_exact_diagnostic_codes_are_rejected',
    catchesThrow(() => parseX4RulePackValue(duplicateExactCodesPack)),
  );

  const invalidPackVersionPack = clonedCorePack();
  invalidPackVersionPack.packVersion = '1.0';
  const invalidRuleVersionPack = clonedCorePack();
  firstRawRule(invalidRuleVersionPack).version = '1.0';
  check(
    'invalid_pack_and_rule_semantic_versions_are_rejected',
    catchesThrow(() => parseX4RulePackValue(invalidPackVersionPack))
      && catchesThrow(() => parseX4RulePackValue(invalidRuleVersionPack)),
  );

  const invalidGameRangePack = clonedCorePack();
  firstRawRule(invalidGameRangePack).applicability = { minGameVersion: '9', maxGameVersion: '9.10' };
  const invertedGameRangePack = clonedCorePack();
  firstRawRule(invertedGameRangePack).applicability = { minGameVersion: '9.10', maxGameVersion: '9.00' };
  const zeroPaddedGameRangePack = clonedCorePack();
  firstRawRule(zeroPaddedGameRangePack).applicability = { minGameVersion: '9.00', maxGameVersion: '9.10' };
  let zeroPaddedGameRangeAccepted = false;
  try {
    const parsedZeroPaddedGameRange = parseX4RulePackValue(zeroPaddedGameRangePack);
    zeroPaddedGameRangeAccepted = parsedZeroPaddedGameRange.rules[0].applicability.minGameVersion === '9.00';
  } catch {
    zeroPaddedGameRangeAccepted = false;
  }
  check(
    'invalid_and_inverted_game_version_ranges_rejected_zero_padded_9_00_accepted',
    catchesThrow(() => parseX4RulePackValue(invalidGameRangePack))
      && catchesThrow(() => parseX4RulePackValue(invertedGameRangePack))
      && zeroPaddedGameRangeAccepted,
  );

  const unsupportedEvidenceGradePack = clonedCorePack();
  (firstRawRule(unsupportedEvidenceGradePack).evidence as RawRecord).grade = 'experimental';
  check(
    'unsupported_evidence_grade_is_rejected',
    catchesThrow(() => parseX4RulePackValue(unsupportedEvidenceGradePack)),
  );

  const emptyRulesPack = clonedCorePack();
  emptyRulesPack.rules = [];
  const overLimitRulesPack = clonedCorePack();
  overLimitRulesPack.rules = Array.from(
    { length: X4_RULE_PACK_MAX_RULES + 1 },
    () => jsonClone(firstRawRule(overLimitRulesPack)),
  );
  const emptyCodesPack = clonedCorePack();
  (firstRawRule(emptyCodesPack).detector as RawRecord).codes = [];
  const overLimitCodesPack = clonedCorePack();
  (firstRawRule(overLimitCodesPack).detector as RawRecord).codes = Array.from(
    { length: X4_RULE_PACK_MAX_CODES + 1 },
    (_, index) => `OVER_LIMIT_CODE_${index}`,
  );
  check(
    'empty_and_over_limit_rules_and_codes_are_rejected',
    catchesThrow(() => parseX4RulePackValue(emptyRulesPack))
      && catchesThrow(() => parseX4RulePackValue(overLimitRulesPack))
      && catchesThrow(() => parseX4RulePackValue(emptyCodesPack))
      && catchesThrow(() => parseX4RulePackValue(overLimitCodesPack)),
  );

  const emptyBoundedStringPack = clonedCorePack();
  emptyBoundedStringPack.packId = '   ';
  const overLimitBoundedStringPack = clonedCorePack();
  (firstRawRule(overLimitBoundedStringPack).guidance as RawRecord).title = 'x'.repeat(X4_RULE_PACK_MAX_STRING + 1);
  check(
    'empty_and_over_limit_bounded_strings_are_rejected',
    catchesThrow(() => parseX4RulePackValue(emptyBoundedStringPack))
      && catchesThrow(() => parseX4RulePackValue(overLimitBoundedStringPack)),
  );

  const sparseRulesPack = clonedCorePack();
  const sparseRules: unknown[] = [];
  sparseRules.length = 1;
  sparseRulesPack.rules = sparseRules;
  const sparseCodesPack = clonedCorePack();
  const sparseCodes: unknown[] = [];
  sparseCodes.length = 1;
  (firstRawRule(sparseCodesPack).detector as RawRecord).codes = sparseCodes;
  const accessorPack = clonedCorePack();
  const accessorRule = firstRawRule(accessorPack);
  let accessorGetterInvoked = false;
  Object.defineProperty(accessorRule, 'id', {
    configurable: true,
    enumerable: true,
    get: () => {
      accessorGetterInvoked = true;
      return 'test.accessor';
    },
  });
  const accessorRejected = catchesThrow(() => parseX4RulePackValue(accessorPack));
  check(
    'sparse_arrays_and_accessor_objects_are_rejected_without_getter_invocation',
    catchesThrow(() => parseX4RulePackValue(sparseRulesPack))
      && catchesThrow(() => parseX4RulePackValue(sparseCodesPack))
      && accessorRejected
      && !accessorGetterInvoked,
  );

  const invalidStoredPackHash = clonedCorePack();
  invalidStoredPackHash.packSha256 = '0'.repeat(64);
  const invalidStoredEvidenceHash = clonedCorePack();
  (firstRawRule(invalidStoredEvidenceHash).evidence as RawRecord).digestSha256 = '0'.repeat(64);
  const malformedShaProvider = (value: string): string => `${sha256(value).slice(0, 63)}g`;
  check(
    'invalid_stored_hashes_and_malformed_sha_outputs_are_rejected',
    catchesThrow(() => verifyX4RulePack(invalidStoredPackHash, sha256))
      && catchesThrow(() => verifyX4RulePack(invalidStoredEvidenceHash, sha256))
      && catchesThrow(() => buildX4RulePack(malformedShaProvider, deterministicInput)),
  );

  const invalidGameVersionInputs = [
    '',
    '9..00',
    '9007199254740992.00',
    ' 9.00',
    '9.00 ',
    '+9.00',
    '-9.00',
  ] as const;
  check(
    'invalid_unsafe_whitespace_and_sign_game_versions_are_unavailable',
    invalidGameVersionInputs.every(version => (
      parseX4GameVersion(version) === null
      && compareX4GameVersions(version, '9.00') === null
      && compareX4GameVersions('9.00', version) === null
      && getX4RuleApplicability(boundedScope, version) === 'unavailable'
    )),
  );

  const passed = checks.filter(candidate => candidate.pass).length;
  const allPassed = checks.length === 32 && passed === checks.length;
  return {
    allPassed,
    pass: allPassed,
    passed,
    total: checks.length,
    checks,
  };
}
