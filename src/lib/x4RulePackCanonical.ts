import { parseX4RulePackValue } from './x4RulePackParser';
import { stableStringify } from './workspaceIdentity';
import type {
  X4RuleEvidenceGrade,
  X4RuleEvidenceV1,
  X4RulePackV1,
  X4RuleV1,
  X4VerifiedRulePackV1,
} from './x4RulePackTypes';

type Sha256 = (canonicalPayload: string) => string;

type X4RuleEvidenceInput = Pick<X4RuleEvidenceV1, 'grade' | 'basis'>;

export type X4RuleBuildInput = Omit<X4RulePackV1, 'packSha256' | 'rules'> & {
  readonly rules: readonly (Omit<X4RuleV1, 'evidence'> & {
    readonly evidence: X4RuleEvidenceInput;
  })[];
};

const ZERO_SHA256 = '0'.repeat(64);
const SHA256_RE = /^[0-9a-f]{64}$/i;

function hashCanonicalPayload(sha256: Sha256, canonicalPayload: string): string {
  if (typeof sha256 !== 'function') {
    throw new TypeError('SHA-256 provider must be a function.');
  }

  const digest = sha256(canonicalPayload);
  if (typeof digest !== 'string' || !SHA256_RE.test(digest)) {
    throw new TypeError('SHA-256 provider must return exactly 64 hexadecimal characters.');
  }
  return digest.toLowerCase();
}

function addEvidenceDigests(sha256: Sha256, input: X4RuleBuildInput): X4RulePackV1 {
  return {
    ...input,
    packSha256: ZERO_SHA256,
    rules: input.rules.map(rule => ({
      ...rule,
      evidence: buildX4RuleEvidence(sha256, rule.evidence.grade, rule.evidence.basis),
    })),
  };
}

function addNormalizedEvidenceDigests(sha256: Sha256, pack: X4RulePackV1): X4RulePackV1 {
  return {
    ...pack,
    rules: pack.rules.map(rule => ({
      ...rule,
      evidence: buildX4RuleEvidence(sha256, rule.evidence.grade, rule.evidence.basis),
    })),
  };
}

export function canonicalX4RuleEvidencePayload(evidence: X4RuleEvidenceInput): string {
  return stableStringify({
    grade: evidence.grade,
    basis: evidence.basis,
  });
}

export function canonicalX4RulePackPayload(pack: X4RulePackV1): string {
  return stableStringify({
    schemaVersion: pack.schemaVersion,
    packId: pack.packId,
    packVersion: pack.packVersion,
    rules: pack.rules,
  });
}

export function buildX4RuleEvidence(
  sha256: Sha256,
  grade: X4RuleEvidenceGrade,
  basis: string,
): X4RuleEvidenceV1 {
  return {
    grade,
    basis,
    digestSha256: hashCanonicalPayload(sha256, canonicalX4RuleEvidencePayload({ grade, basis })),
  };
}

export function buildX4RulePack(sha256: Sha256, input: X4RuleBuildInput): X4VerifiedRulePackV1 {
  const normalizedWithRawEvidenceDigests = parseX4RulePackValue(addEvidenceDigests(sha256, input));
  const normalizedWithEvidenceDigests = parseX4RulePackValue(
    addNormalizedEvidenceDigests(sha256, normalizedWithRawEvidenceDigests),
  );
  const packSha256 = hashCanonicalPayload(sha256, canonicalX4RulePackPayload(normalizedWithEvidenceDigests));

  return parseX4RulePackValue({
    ...normalizedWithEvidenceDigests,
    packSha256,
  });
}

export function verifyX4RulePack(value: unknown, sha256: Sha256): X4VerifiedRulePackV1 {
  const pack = parseX4RulePackValue(value);

  for (const rule of pack.rules) {
    const expectedDigest = hashCanonicalPayload(sha256, canonicalX4RuleEvidencePayload(rule.evidence));
    if (expectedDigest !== rule.evidence.digestSha256) {
      throw new TypeError(`X4 rule evidence digest mismatch for rule "${rule.id}".`);
    }
  }

  const expectedPackSha256 = hashCanonicalPayload(sha256, canonicalX4RulePackPayload(pack));
  if (expectedPackSha256 !== pack.packSha256) {
    throw new TypeError('X4 rule pack SHA-256 mismatch.');
  }

  return pack;
}
