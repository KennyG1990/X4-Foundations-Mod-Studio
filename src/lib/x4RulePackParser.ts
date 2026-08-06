import {
  X4_RULE_PACK_MAX_CODES,
  X4_RULE_PACK_MAX_RULES,
  X4_RULE_PACK_MAX_STRING,
  X4_RULE_PACK_SCHEMA_VERSION,
  type X4RuleDetectorV1,
  type X4RuleEvidenceGrade,
  type X4RuleEvidenceV1,
  type X4RuleExactDetectorV1,
  type X4RuleGameVersionScopeV1,
  type X4RuleGuidanceV1,
  type X4RulePackV1,
  type X4RulePrefixDetectorV1,
  type X4RuleV1,
} from './x4RulePackTypes';

type PlainRecord = Record<string, unknown>;

const ROOT_KEYS = ['schemaVersion', 'packId', 'packVersion', 'packSha256', 'rules'] as const;
const RULE_KEYS = ['id', 'version', 'detector', 'applicability', 'evidence', 'guidance'] as const;
const EXACT_DETECTOR_KEYS = ['id', 'codes'] as const;
const PREFIX_DETECTOR_KEYS = ['id', 'prefix'] as const;
const APPLICABILITY_KEYS = ['minGameVersion', 'maxGameVersion'] as const;
const EVIDENCE_KEYS = ['grade', 'basis', 'digestSha256'] as const;
const GUIDANCE_KEYS = ['title', 'why', 'impact', 'next'] as const;

const SEMANTIC_VERSION_RE = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const GAME_VERSION_RE = /^[0-9]+\.[0-9]+(?:\.[0-9]+)?$/;
const STABLE_ID_RE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const DIAGNOSTIC_CODE_RE = /^[A-Za-z][A-Za-z0-9]*(?:[._:-][A-Za-z0-9]+)*$/;
const DIAGNOSTIC_PREFIX_RE = /^[A-Za-z][A-Za-z0-9]*(?:[._:-][A-Za-z0-9]+)*(?:[._:-])?$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

const SUPPORTED_EVIDENCE_GRADES = new Set<X4RuleEvidenceGrade>([
  'schema',
  'corpus',
  'engine',
  'runtime',
  'advisory',
]);

function fail(path: string, message: string): never {
  throw new TypeError(`${path}: ${message}`);
}

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function keyPath(path: string, key: string): string {
  return `${path}.${key}`;
}

function assertExactObject(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): PlainRecord {
  if (!isPlainRecord(value)) fail(path, 'must be a plain object.');

  const allowed = new Set(allowedKeys);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail(path, 'must contain only data properties.');
    if (typeof key !== 'string') fail(path, 'contains an unknown key.');
    if (!allowed.has(key)) fail(keyPath(path, key), 'is an unknown key.');
  }
  for (const key of requiredKeys) {
    if (!hasOwn(value, key)) fail(keyPath(path, key), 'is required.');
  }
  return value;
}

function isArrayIndexKey(key: string): boolean {
  if (!/^(0|[1-9][0-9]*)$/.test(key)) return false;
  return key.length < 10 || (key.length === 10 && key < '4294967295');
}

function assertDenseArray(value: unknown, path: string, maximum?: number): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array.');
  if (maximum !== undefined && (value.length < 1 || value.length > maximum)) {
    fail(path, `must contain between 1 and ${maximum} items.`);
  }

  let indexCount = 0;
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail(path, 'must contain only data items.');
    if (typeof key !== 'string' || !isArrayIndexKey(key) || compareNumericComponent(key, value.length.toString()) >= 0) {
      fail(typeof key === 'string' ? keyPath(path, key) : path, 'is an unknown array property.');
    }
    indexCount += 1;
  }
  if (indexCount !== value.length) fail(path, 'must not contain holes.');
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'must be a string.');
  const normalized = value.trim();
  if (normalized.length === 0) fail(path, 'must be a non-empty string.');
  if (normalized.length > X4_RULE_PACK_MAX_STRING) {
    fail(path, `must be at most ${X4_RULE_PACK_MAX_STRING} characters.`);
  }
  return normalized;
}

function requireStableId(value: unknown, path: string): string {
  const normalized = requireString(value, path);
  if (!STABLE_ID_RE.test(normalized)) fail(path, 'must be a stable lowercase identifier.');
  return normalized;
}

function requireSemanticVersion(value: unknown, path: string): string {
  const normalized = requireString(value, path);
  if (!SEMANTIC_VERSION_RE.test(normalized)) fail(path, 'must match x.y.z.');
  return normalized;
}

function requireGameVersion(value: unknown, path: string): string {
  const normalized = requireString(value, path);
  if (!GAME_VERSION_RE.test(normalized)) fail(path, 'must match x.y or x.y.z.');
  return normalized;
}

function requireHash(value: unknown, path: string): string {
  const normalized = requireString(value, path);
  if (!SHA256_RE.test(normalized)) fail(path, 'must be a lowercase 64-character hexadecimal hash.');
  return normalized;
}

function requireDiagnosticCode(value: unknown, path: string): string {
  const normalized = requireString(value, path);
  if (!DIAGNOSTIC_CODE_RE.test(normalized)) fail(path, 'must be a diagnostic-like code.');
  return normalized;
}

function requireDiagnosticPrefix(value: unknown, path: string): string {
  const normalized = requireString(value, path);
  if (!DIAGNOSTIC_PREFIX_RE.test(normalized)) fail(path, 'must be a diagnostic-like prefix.');
  return normalized;
}

function requireSupportedGrade(value: unknown, path: string): X4RuleEvidenceGrade {
  const normalized = requireString(value, path);
  if (!SUPPORTED_EVIDENCE_GRADES.has(normalized as X4RuleEvidenceGrade)) {
    fail(path, 'is not a supported evidence grade.');
  }
  return normalized as X4RuleEvidenceGrade;
}

function compareLexical(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeNumericComponent(value: string): string {
  const normalized = value.replace(/^0+/, '');
  return normalized.length === 0 ? '0' : normalized;
}

function compareNumericComponent(left: string, right: string): number {
  const normalizedLeft = normalizeNumericComponent(left);
  const normalizedRight = normalizeNumericComponent(right);
  if (normalizedLeft.length !== normalizedRight.length) return normalizedLeft.length < normalizedRight.length ? -1 : 1;
  return compareLexical(normalizedLeft, normalizedRight);
}

function versionComponents(version: string): readonly string[] {
  return version.split('.');
}

function compareSemanticVersions(left: string, right: string): number {
  const leftComponents = versionComponents(left);
  const rightComponents = versionComponents(right);
  for (let index = 0; index < 3; index += 1) {
    const comparison = compareNumericComponent(leftComponents[index], rightComponents[index]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function compareGameVersions(left: string, right: string): number {
  const leftComponents = versionComponents(left);
  const rightComponents = versionComponents(right);
  for (let index = 0; index < 3; index += 1) {
    const comparison = compareNumericComponent(leftComponents[index] ?? '0', rightComponents[index] ?? '0');
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function parseDetector(value: unknown, path: string): X4RuleDetectorV1 {
  const detector = assertExactObject(value, path, ['id', 'codes', 'prefix'], ['id']);
  const id = requireString(detector.id, keyPath(path, 'id'));

  if (id === 'diagnostic.code_exact') {
    const exact = assertExactObject(detector, path, EXACT_DETECTOR_KEYS);
    const codes = assertDenseArray(exact.codes, keyPath(path, 'codes'), X4_RULE_PACK_MAX_CODES);
    const normalizedCodes: string[] = [];
    const seenCodes = new Set<string>();
    for (let index = 0; index < codes.length; index += 1) {
      const code = requireDiagnosticCode(codes[index], `${path}.codes[${index}]`);
      if (seenCodes.has(code)) fail(`${path}.codes[${index}]`, 'duplicates another exact code.');
      seenCodes.add(code);
      normalizedCodes.push(code);
    }
    normalizedCodes.sort(compareLexical);
    const normalized: X4RuleExactDetectorV1 = { id: 'diagnostic.code_exact', codes: normalizedCodes };
    return normalized;
  }

  if (id === 'diagnostic.code_prefix') {
    const prefix = assertExactObject(detector, path, PREFIX_DETECTOR_KEYS);
    const normalized: X4RulePrefixDetectorV1 = {
      id: 'diagnostic.code_prefix',
      prefix: requireDiagnosticPrefix(prefix.prefix, keyPath(path, 'prefix')),
    };
    return normalized;
  }

  fail(keyPath(path, 'id'), 'is not a supported detector id.');
}

function parseApplicability(value: unknown, path: string): X4RuleGameVersionScopeV1 {
  const applicability = assertExactObject(value, path, APPLICABILITY_KEYS, []);
  const normalized: { minGameVersion?: string; maxGameVersion?: string } = {};
  const minGameVersion = hasOwn(applicability, 'minGameVersion')
    ? requireGameVersion(applicability.minGameVersion, keyPath(path, 'minGameVersion'))
    : undefined;
  const maxGameVersion = hasOwn(applicability, 'maxGameVersion')
    ? requireGameVersion(applicability.maxGameVersion, keyPath(path, 'maxGameVersion'))
    : undefined;

  if (minGameVersion !== undefined) normalized.minGameVersion = minGameVersion;
  if (maxGameVersion !== undefined) normalized.maxGameVersion = maxGameVersion;
  if (minGameVersion !== undefined && maxGameVersion !== undefined && compareGameVersions(minGameVersion, maxGameVersion) > 0) {
    fail(keyPath(path, 'minGameVersion'), 'must not be greater than maxGameVersion.');
  }
  return normalized;
}

function parseEvidence(value: unknown, path: string): X4RuleEvidenceV1 {
  const evidence = assertExactObject(value, path, EVIDENCE_KEYS);
  return {
    grade: requireSupportedGrade(evidence.grade, keyPath(path, 'grade')),
    basis: requireString(evidence.basis, keyPath(path, 'basis')),
    digestSha256: requireHash(evidence.digestSha256, keyPath(path, 'digestSha256')),
  };
}

function parseGuidance(value: unknown, path: string): X4RuleGuidanceV1 {
  const guidance = assertExactObject(value, path, GUIDANCE_KEYS);
  return {
    title: requireString(guidance.title, keyPath(path, 'title')),
    why: requireString(guidance.why, keyPath(path, 'why')),
    impact: requireString(guidance.impact, keyPath(path, 'impact')),
    next: requireString(guidance.next, keyPath(path, 'next')),
  };
}

function parseRule(value: unknown, path: string): X4RuleV1 {
  const rule = assertExactObject(value, path, RULE_KEYS);
  return {
    id: requireStableId(rule.id, keyPath(path, 'id')),
    version: requireSemanticVersion(rule.version, keyPath(path, 'version')),
    detector: parseDetector(rule.detector, keyPath(path, 'detector')),
    applicability: parseApplicability(rule.applicability, keyPath(path, 'applicability')),
    evidence: parseEvidence(rule.evidence, keyPath(path, 'evidence')),
    guidance: parseGuidance(rule.guidance, keyPath(path, 'guidance')),
  };
}

function parsePack(value: unknown, path: string): X4RulePackV1 {
  const pack = assertExactObject(value, path, ROOT_KEYS);
  if (pack.schemaVersion !== X4_RULE_PACK_SCHEMA_VERSION) {
    fail(keyPath(path, 'schemaVersion'), `must equal ${X4_RULE_PACK_SCHEMA_VERSION}.`);
  }

  const rules = assertDenseArray(pack.rules, keyPath(path, 'rules'), X4_RULE_PACK_MAX_RULES);
  const normalizedRules: X4RuleV1[] = [];
  const ruleIds = new Set<string>();
  for (let index = 0; index < rules.length; index += 1) {
    const rule = parseRule(rules[index], `${path}.rules[${index}]`);
    if (ruleIds.has(rule.id)) fail(`${path}.rules[${index}].id`, 'duplicates another rule id.');
    ruleIds.add(rule.id);
    normalizedRules.push(rule);
  }
  normalizedRules.sort((left, right) => {
    const idComparison = compareLexical(left.id, right.id);
    return idComparison === 0 ? compareSemanticVersions(left.version, right.version) : idComparison;
  });

  return {
    schemaVersion: X4_RULE_PACK_SCHEMA_VERSION,
    packId: requireStableId(pack.packId, keyPath(path, 'packId')),
    packVersion: requireSemanticVersion(pack.packVersion, keyPath(path, 'packVersion')),
    packSha256: requireHash(pack.packSha256, keyPath(path, 'packSha256')),
    rules: normalizedRules,
  };
}

export function parseX4RulePackValue(value: unknown): X4RulePackV1 {
  return parsePack(value, '$');
}

export function parseX4RulePackJson(json: string): X4RulePackV1 {
  if (typeof json !== 'string') fail('$', 'must be a JSON string.');
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    fail('$', 'contains invalid JSON.');
  }
  return parseX4RulePackValue(value);
}

export function parseX4RulePackSet(values: readonly unknown[]): readonly X4RulePackV1[] {
  const packs = assertDenseArray(values, '$');
  const normalizedPacks: X4RulePackV1[] = [];
  const packIds = new Set<string>();
  const ruleIds = new Set<string>();

  for (let index = 0; index < packs.length; index += 1) {
    const path = `$[${index}]`;
    const pack = parsePack(packs[index], path);
    if (packIds.has(pack.packId)) fail(`${path}.packId`, 'duplicates another pack id.');
    packIds.add(pack.packId);

    for (let ruleIndex = 0; ruleIndex < pack.rules.length; ruleIndex += 1) {
      const rule = pack.rules[ruleIndex];
      if (ruleIds.has(rule.id)) fail(`${path}.rules[${ruleIndex}].id`, 'duplicates a rule id in another pack.');
      ruleIds.add(rule.id);
    }
    normalizedPacks.push(pack);
  }

  return normalizedPacks;
}
