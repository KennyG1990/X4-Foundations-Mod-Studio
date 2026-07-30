#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { runE2e } from './run-e2e.mjs';

const root = process.cwd();
const evidenceDir = path.join(root, 'test-results');
const discoveryReceipt = path.join(evidenceDir, 'e2e-flake-policy-discovery.json');
const matchingReceipt = path.join(evidenceDir, 'e2e-flake-policy-matching.json');
const summaryPath = path.join(evidenceDir, 'e2e-flake-policy-selftest.json');
const fixtureArgs = ['--config=tests/fixtures/e2e-flake-policy/playwright.config.ts'];
const emptyManifest = { version: 1, entries: [] };

function addUtcDays(isoDay, days) {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

const discoveryExit = await runE2e({ args: fixtureArgs, manifest: emptyManifest, receiptPath: discoveryReceipt });
const discovery = readJson(discoveryReceipt);
const testId = discovery.verdict?.issues?.[0]?.testId || '';
const today = new Date().toISOString().slice(0, 10);
const matchingManifest = {
  version: 1,
  entries: [{
    testId,
    owner: '@quality',
    reason: 'Deliberate retry-flake policy fixture',
    issue: 'B110-R20',
    createdOn: today,
    expiresOn: addUtcDays(today, 7),
  }],
};
const matchingExit = await runE2e({ args: fixtureArgs, manifest: matchingManifest, receiptPath: matchingReceipt });
const matching = readJson(matchingReceipt);

const checks = [
  ['discovery_wrapper_returns_red', discoveryExit === 1],
  ['discovery_is_one_flaky_test', discovery.verdict?.flaky === 1 && discovery.verdict?.totalTests === 1],
  ['stable_test_id_discovered', /^[a-zA-Z0-9_-]{8,128}$/.test(testId)],
  ['matching_policy_is_valid', matching.policy?.errors?.length === 0],
  ['matching_wrapper_returns_red', matchingExit === 1],
  ['matching_is_one_flaky_test', matching.verdict?.flaky === 1 && matching.verdict?.totalTests === 1],
  ['matching_quarantine_is_reported', matching.verdict?.quarantinedIssues === 1 && matching.verdict?.issues?.[0]?.quarantine?.owner === '@quality'],
  ['quarantine_cannot_hide_failure', matching.verdict?.green === false],
];
const passed = checks.filter(([, pass]) => pass).length;
const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  passed,
  total: checks.length,
  checks: checks.map(([name, pass]) => ({ name, pass })),
  testId,
  discoveryExit,
  matchingExit,
  matchingVerdict: matching.verdict,
};
writeJsonAtomic(summaryPath, summary);
for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
console.log(`[e2e-flake-policy selftest] ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
console.log(`[e2e-flake-policy selftest] ${summaryPath}`);
process.exit(passed === checks.length ? 0 : 1);
