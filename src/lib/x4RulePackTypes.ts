/**
 * Public, browser-safe data contracts for governed deterministic X4 rule packs.
 *
 * This module intentionally contains only constants and type declarations. Pack
 * parsing, normalization, verification, and resolution remain separate concerns.
 */

export const X4_RULE_PACK_SCHEMA_VERSION = 1 as const;
export const X4_RULE_PACK_MAX_RULES = 256 as const;
export const X4_RULE_PACK_MAX_CODES = 64 as const;
export const X4_RULE_PACK_MAX_STRING = 1024 as const;

export type X4RuleEvidenceGrade = 'schema' | 'corpus' | 'engine' | 'runtime' | 'advisory';

export type X4RuleDetectorId = 'diagnostic.code_exact' | 'diagnostic.code_prefix';

export type X4RuleApplicabilityStatus = 'applicable' | 'not_applicable' | 'unavailable';

export interface X4RuleEvidenceV1 {
  readonly grade: X4RuleEvidenceGrade;
  readonly basis: string;
  readonly digestSha256: string;
}

export interface X4RuleGuidanceV1 {
  readonly title: string;
  readonly why: string;
  readonly impact: string;
  readonly next: string;
}

export interface X4RuleExactDetectorV1 {
  readonly id: 'diagnostic.code_exact';
  readonly codes: readonly string[];
}

export interface X4RulePrefixDetectorV1 {
  readonly id: 'diagnostic.code_prefix';
  readonly prefix: string;
}

export type X4RuleDetectorV1 = X4RuleExactDetectorV1 | X4RulePrefixDetectorV1;

export interface X4RuleGameVersionScopeV1 {
  readonly minGameVersion?: string;
  readonly maxGameVersion?: string;
}

export interface X4RuleV1 {
  readonly id: string;
  readonly version: string;
  readonly detector: X4RuleDetectorV1;
  readonly applicability: X4RuleGameVersionScopeV1;
  readonly evidence: X4RuleEvidenceV1;
  readonly guidance: X4RuleGuidanceV1;
}

export interface X4RulePackV1 {
  readonly schemaVersion: 1;
  readonly packId: string;
  readonly packVersion: string;
  readonly packSha256: string;
  readonly rules: readonly X4RuleV1[];
}

export type X4VerifiedRulePackV1 = Omit<X4RulePackV1, 'rules'> & {
  readonly rules: readonly X4RuleV1[];
};

export interface X4DiagnosticRuleInput {
  readonly code?: string;
  readonly targetGameVersion?: string;
}

export interface X4RuleIdentityV1 {
  readonly packId: string;
  readonly packVersion: string;
  readonly packSha256: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
}

export interface X4RuleResolutionMatchedV1 extends X4RuleIdentityV1 {
  readonly kind: 'matched';
  readonly evidence: X4RuleEvidenceV1;
  readonly guidance: X4RuleGuidanceV1;
  readonly applicability: X4RuleApplicabilityStatus;
  readonly scope: X4RuleGameVersionScopeV1;
}

export interface X4RuleResolutionUnmatchedV1 {
  readonly kind: 'unmatched';
  readonly input: X4DiagnosticRuleInput;
}

export interface X4RuleResolutionAmbiguousV1 {
  readonly kind: 'ambiguous';
  readonly input: X4DiagnosticRuleInput;
  readonly candidates: readonly X4RuleIdentityV1[];
}

export type X4RuleResolutionV1 =
  | X4RuleResolutionMatchedV1
  | X4RuleResolutionUnmatchedV1
  | X4RuleResolutionAmbiguousV1;
