import {
  type X4DiagnosticRuleInput,
  type X4RuleApplicabilityStatus,
  type X4RuleGameVersionScopeV1,
  type X4RuleIdentityV1,
  type X4RulePackV1,
  type X4RuleResolutionV1,
  type X4RuleV1,
} from './x4RulePackTypes';

type ParsedGameVersion = readonly number[];

const GAME_VERSION_PATTERN = /^[0-9]+(?:\.[0-9]+)*$/;

export function parseX4GameVersion(value: unknown): ParsedGameVersion | null {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value || !GAME_VERSION_PATTERN.test(value)) {
    return null;
  }

  const segments = value.split('.');
  const parsed: number[] = [];
  for (const segment of segments) {
    const numericSegment = Number(segment);
    if (!Number.isSafeInteger(numericSegment)) return null;
    parsed.push(numericSegment);
  }
  return parsed;
}

function compareParsedGameVersions(left: ParsedGameVersion, right: ParsedGameVersion): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftSegment = left[index] ?? 0;
    const rightSegment = right[index] ?? 0;
    if (leftSegment < rightSegment) return -1;
    if (leftSegment > rightSegment) return 1;
  }
  return 0;
}

export function compareX4GameVersions(left: unknown, right: unknown): number | null {
  const parsedLeft = parseX4GameVersion(left);
  const parsedRight = parseX4GameVersion(right);
  if (parsedLeft === null || parsedRight === null) return null;
  return compareParsedGameVersions(parsedLeft, parsedRight);
}

export function getX4RuleApplicability(
  scope: X4RuleGameVersionScopeV1,
  targetGameVersion?: string,
): X4RuleApplicabilityStatus {
  const target = typeof targetGameVersion === 'string' ? parseX4GameVersion(targetGameVersion) : null;
  if (target === null) return 'unavailable';

  const minimum = scope.minGameVersion === undefined ? null : parseX4GameVersion(scope.minGameVersion);
  const maximum = scope.maxGameVersion === undefined ? null : parseX4GameVersion(scope.maxGameVersion);
  if ((scope.minGameVersion !== undefined && minimum === null) || (scope.maxGameVersion !== undefined && maximum === null)) {
    return 'unavailable';
  }

  if (minimum !== null && compareParsedGameVersions(target, minimum) < 0) return 'not_applicable';
  if (maximum !== null && compareParsedGameVersions(target, maximum) > 0) return 'not_applicable';

  return 'applicable';
}

function identityFor(pack: X4RulePackV1, rule: X4RuleV1): X4RuleIdentityV1 {
  return {
    packId: pack.packId,
    packVersion: pack.packVersion,
    packSha256: pack.packSha256,
    ruleId: rule.id,
    ruleVersion: rule.version,
  };
}

function detectorMatches(rule: X4RuleV1, code: string): boolean {
  if (rule.detector.id === 'diagnostic.code_exact') return rule.detector.codes.includes(code);
  if (rule.detector.id === 'diagnostic.code_prefix') return code.startsWith(rule.detector.prefix);
  return false;
}

export function resolveX4DiagnosticRule(pack: X4RulePackV1, input: X4DiagnosticRuleInput): X4RuleResolutionV1 {
  if (typeof input.code !== 'string' || input.code.length === 0) return { kind: 'unmatched', input };

  const matches: X4RuleV1[] = [];
  for (const rule of pack.rules) {
    if (detectorMatches(rule, input.code)) matches.push(rule);
  }

  if (matches.length === 0) return { kind: 'unmatched', input };
  if (matches.length > 1) {
    return {
      kind: 'ambiguous',
      input,
      candidates: matches.map(rule => identityFor(pack, rule)),
    };
  }

  const rule = matches[0];
  return {
    kind: 'matched',
    ...identityFor(pack, rule),
    evidence: rule.evidence,
    guidance: rule.guidance,
    applicability: getX4RuleApplicability(rule.applicability, input.targetGameVersion),
    scope: rule.applicability,
  };
}
