import { runX4RulePacksSelftest } from '../src/lib/x4RulePacks.selftest';

const result = runX4RulePacksSelftest();

console.log(`[x4-rule-packs] ${result.passed}/${result.total} passed`);
for (const check of result.checks) {
  if (!check.pass) {
    const detail = check.detail === undefined ? '' : `: ${check.detail}`;
    console.error(`[x4-rule-packs] failed ${check.name}${detail}`);
  }
}

if (result.pass !== true || result.total !== 32) {
  process.exitCode = 1;
}
