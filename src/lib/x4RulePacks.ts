import rawX4CoreRulePack from './x4RulePack.core.json' with { type: 'json' };

import { parseX4RulePackValue } from './x4RulePackParser';
import { resolveX4DiagnosticRule } from './x4RulePackResolver';
import type {
  X4DiagnosticRuleInput,
  X4VerifiedRulePackV1,
} from './x4RulePackTypes';

export const X4_CORE_RULE_PACK_EXPECTED_SHA256 =
  '351cb0199c815df91861205bf0bce85b22ed98f1bb695dcaa9345f5001e2f9c0' as const;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const parsedCoreRulePack = parseX4RulePackValue(rawX4CoreRulePack);
if (parsedCoreRulePack.packSha256 !== X4_CORE_RULE_PACK_EXPECTED_SHA256) {
  throw new Error(
    `X4 core rule pack identity mismatch: expected ${X4_CORE_RULE_PACK_EXPECTED_SHA256}, received ${parsedCoreRulePack.packSha256}.`,
  );
}

export const X4_CORE_RULE_PACK: X4VerifiedRulePackV1 = deepFreeze(parsedCoreRulePack);

export function resolveCoreX4DiagnosticRule(input: X4DiagnosticRuleInput) {
  return resolveX4DiagnosticRule(X4_CORE_RULE_PACK, input);
}
