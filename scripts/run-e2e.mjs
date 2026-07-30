/**
 * run-e2e.mjs — fail-closed Playwright gate.
 *
 * B64-T2 made the structured JSON report authoritative over the unreliable Windows
 * child exit. B110-R20 adds one diagnostic retry and a zero-flake policy: retry-pass
 * is classified as flaky and remains red, even when it has quarantine ownership.
 *
 *   exit 0  ⇔ at least one test passed AND zero failed/flaky/bad results
 *   exit 1  ⇔ anything else, invalid/expired policy, or missing receipt/report truth
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  E2E_RETRY_COUNT,
  MAX_ACTIVE_QUARANTINES,
  MAX_QUARANTINE_DAYS,
  classifyE2eReport,
  validateQuarantineManifest,
} from './e2e-flake-policy.mjs';

const ROOT = process.cwd();
const DEFAULT_MANIFEST_PATH = path.join(ROOT, 'scripts', 'e2e-quarantine.json');
const DEFAULT_RECEIPT_PATH = path.join(ROOT, 'test-results', 'e2e-verdict.json');

export function verdictFromReport(report, quarantineEntries = []) {
  return classifyE2eReport(report, quarantineEntries);
}

/** Fallback verdict from list-reporter stdout. Missing structured truth never becomes greener. */
export function verdictFromStdout(out) {
  const count = re => { const match = out.match(re); return match ? parseInt(match[1], 10) : 0; };
  const passed = count(/(\d+)\s+passed/);
  const failed = count(/(\d+)\s+failed/);
  const flaky = count(/(\d+)\s+flaky/);
  const interrupted = count(/(\d+)\s+interrupted/);
  const didNotRun = count(/(\d+)\s+did not run/);
  const noTests = /no tests found/i.test(out);
  const badResults = failed + flaky + interrupted + didNotRun;
  const green = passed > 0 && badResults === 0 && !noTests;
  return { passed, failed, flaky, badResults, noTests, totalTests: passed + badResults, issues: [], quarantinedIssues: 0, green };
}

export function verdictWithoutStructuredReport(out) {
  return { ...verdictFromStdout(out), green: false, structuredReportMissing: true };
}

export function validateRunnerArgs(args) {
  const errors = [];
  for (const arg of args) {
    if (/^--retries(?:=|$)/i.test(arg)) errors.push('caller retry override is forbidden; the gate owns exactly one retry');
    if (/^--(?:no-)?fail-on-flaky-tests(?:=|$)/i.test(arg)) errors.push('caller flaky-verdict override is forbidden');
    if (/^--reporter(?:=|$)/i.test(arg)) errors.push('caller reporter override is forbidden; the JSON report is gate authority');
  }
  return errors;
}

function readManifest(manifestPath) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, filePath);
}

function policyReceipt(policy, extra = {}) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: {
      retryCount: E2E_RETRY_COUNT,
      actualFlakeBudget: 0,
      maximumActiveQuarantines: MAX_ACTIVE_QUARANTINES,
      maximumQuarantineDays: MAX_QUARANTINE_DAYS,
      activeQuarantines: policy.entries,
      errors: policy.errors,
    },
    ...extra,
  };
}

export async function runE2e({
  args = [],
  manifest,
  manifestPath = DEFAULT_MANIFEST_PATH,
  receiptPath = DEFAULT_RECEIPT_PATH,
} = {}) {
  const argErrors = validateRunnerArgs(args);
  let manifestValue = manifest;
  const loadErrors = [];
  if (manifestValue === undefined) {
    try { manifestValue = readManifest(manifestPath); }
    catch (error) { loadErrors.push(`cannot read quarantine manifest: ${error instanceof Error ? error.message : String(error)}`); }
  }
  const policy = validateQuarantineManifest(manifestValue || {});
  policy.errors.unshift(...loadErrors, ...argErrors);
  policy.valid = policy.errors.length === 0;
  if (!policy.valid) {
    for (const error of policy.errors) console.error(`[run-e2e] POLICY FAIL: ${error}`);
    try {
      writeJsonAtomic(receiptPath, policyReceipt(policy, { source: 'preflight', childExit: null, verdict: { green: false } }));
    } catch (error) {
      console.error(`[run-e2e] RECEIPT FAIL: ${error instanceof Error ? error.message : String(error)}`);
    }
    return 1;
  }

  const playwrightCli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
  if (!fs.existsSync(playwrightCli)) {
    console.error(`[run-e2e] Playwright CLI not found at ${playwrightCli}; run npm install first.`);
    return 1;
  }
  const jsonPath = path.join(os.tmpdir(), `x4-e2e-report-${process.pid}-${Date.now()}.json`);
  const child = spawn(process.execPath, [
    playwrightCli,
    'test',
    `--retries=${E2E_RETRY_COUNT}`,
    '--fail-on-flaky-tests',
    '--reporter=list,json',
    ...args,
  ], {
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath },
  });

  let output = '';
  child.stdout.on('data', data => { output += data; process.stdout.write(data); });
  child.stderr.on('data', data => { output += data; process.stderr.write(data); });

  return await new Promise(resolve => {
    let settled = false;
    const finish = code => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    child.on('close', childExit => {
      let verdict;
      let source;
      try {
        const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        verdict = verdictFromReport(report, policy.entries);
        source = 'json-report';
      } catch (error) {
        verdict = verdictWithoutStructuredReport(output);
        source = `stdout-fallback (${error instanceof Error ? error.message : String(error)})`;
      }
      try { fs.rmSync(jsonPath, { force: true }); } catch { /* best-effort temp cleanup */ }

      const receipt = policyReceipt(policy, { source, childExit, verdict });
      let receiptError = null;
      try { writeJsonAtomic(receiptPath, receipt); }
      catch (error) { receiptError = error instanceof Error ? error.message : String(error); }
      if (receiptError) console.error(`[run-e2e] RECEIPT FAIL: ${receiptError}`);

      const detail = `${verdict.passed} passed, ${verdict.failed} failed, ${verdict.flaky} flaky, ` +
        `${verdict.badResults} bad-result, ${verdict.quarantinedIssues || 0} quarantined-but-blocking` +
        (verdict.noTests ? ', NO TESTS FOUND' : '') + ` [via ${source}]` +
        (childExit !== 0 ? ` (child exit ${childExit} recorded; structured verdict remains authoritative)` : '');
      console.log(`\n[run-e2e] VERDICT: ${verdict.green && !receiptError ? 'PASS' : 'FAIL'} — ${detail}`);
      console.log(`[run-e2e] receipt: ${receiptPath}`);
      finish(verdict.green && !receiptError ? 0 : 1);
    });
    child.on('error', error => {
      console.error(`[run-e2e] failed to spawn Playwright: ${error.message}`);
      finish(1);
    });
  });
}

function runPureSelftest() {
  const checks = [];
  const ok = (name, condition) => checks.push({ name, pass: !!condition });
  const spec = (status, id = 'stable_test_1234') => ({
    id,
    title: id,
    ok: status === 'expected' || status === 'skipped' || status === 'flaky',
    file: 'fixture.spec.ts',
    tests: [{ status, results: [{ status: status === 'expected' ? 'passed' : status === 'flaky' ? 'passed' : status }] }],
  });
  const report = (stats, specs) => ({ stats, suites: [{ file: 'fixture.spec.ts', specs }] });
  const validEntry = {
    testId: 'stable_test_1234', owner: '@quality', reason: 'Deliberate policy fixture', issue: 'B110-R20',
    createdOn: '2026-07-30', expiresOn: '2026-08-06',
  };
  const valid = { version: 1, entries: [validEntry] };

  ok('all_passed_green', verdictFromReport(report({ expected: 2, unexpected: 0, flaky: 0 }, [spec('expected'), spec('expected', 'stable_test_5678')])).green);
  ok('one_failed_red', !verdictFromReport(report({ expected: 1, unexpected: 1, flaky: 0 }, [spec('expected'), spec('unexpected', 'stable_test_5678')])).green);
  ok('flaky_red', !verdictFromReport(report({ expected: 1, unexpected: 0, flaky: 1 }, [spec('expected'), spec('flaky', 'stable_test_5678')])).green);
  ok('interrupted_red', !verdictFromReport(report({ expected: 1, unexpected: 0, flaky: 0 }, [spec('expected'), spec('interrupted', 'stable_test_5678')])).green);
  ok('timedout_red', !verdictFromReport(report({ expected: 1, unexpected: 0, flaky: 0 }, [spec('expected'), spec('timedOut', 'stable_test_5678')])).green);
  ok('no_tests_red', !verdictFromReport(report({ expected: 0, unexpected: 0, flaky: 0 }, [])).green);
  ok('skipped_not_bad', verdictFromReport(report({ expected: 1, unexpected: 0, flaky: 0 }, [spec('expected'), spec('skipped', 'stable_test_5678')])).green);
  ok('stdout_green', verdictFromStdout('  19 passed (49.7s)').green);
  ok('missing_json_forces_stdout_green_red', !verdictWithoutStructuredReport('  19 passed (49.7s)').green);
  ok('stdout_failed_red', !verdictFromStdout('  16 failed\n  3 passed').green);
  ok('stdout_no_tests_red', !verdictFromStdout('no tests found').green);
  ok('valid_quarantine', validateQuarantineManifest(valid, '2026-07-30').valid);
  ok('expired_rejected', !validateQuarantineManifest({ version: 1, entries: [{ ...validEntry, createdOn: '2026-07-01', expiresOn: '2026-07-10' }] }, '2026-07-30').valid);
  ok('wildcard_rejected', !validateQuarantineManifest({ version: 1, entries: [{ ...validEntry, testId: 'tests/**' }] }, '2026-07-30').valid);
  ok('duplicate_rejected', !validateQuarantineManifest({ version: 1, entries: [validEntry, validEntry] }, '2026-07-30').valid);
  ok('over_budget_rejected', !validateQuarantineManifest({ version: 1, entries: [0, 1, 2, 3].map(index => ({ ...validEntry, testId: `stable_test_${index}234` })) }, '2026-07-30').valid);
  ok('future_created_rejected', !validateQuarantineManifest({ version: 1, entries: [{ ...validEntry, createdOn: '2026-08-01' }] }, '2026-07-30').valid);
  ok('overlong_rejected', !validateQuarantineManifest({ version: 1, entries: [{ ...validEntry, expiresOn: '2026-08-20' }] }, '2026-07-30').valid);
  ok('missing_owner_rejected', !validateQuarantineManifest({ version: 1, entries: [{ ...validEntry, owner: '' }] }, '2026-07-30').valid);
  ok('missing_reason_rejected', !validateQuarantineManifest({ version: 1, entries: [{ ...validEntry, reason: '' }] }, '2026-07-30').valid);
  ok('missing_issue_rejected', !validateQuarantineManifest({ version: 1, entries: [{ ...validEntry, issue: '' }] }, '2026-07-30').valid);
  const quarantinedFlaky = verdictFromReport(report({ expected: 0, unexpected: 0, flaky: 1 }, [spec('flaky')]), [validEntry]);
  ok('quarantined_flaky_stays_red', !quarantinedFlaky.green && quarantinedFlaky.quarantinedIssues === 1);
  const quarantinedFailure = verdictFromReport(report({ expected: 0, unexpected: 1, flaky: 0 }, [spec('unexpected')]), [validEntry]);
  ok('quarantined_failure_stays_red', !quarantinedFailure.green && quarantinedFailure.quarantinedIssues === 1);
  ok('retry_override_rejected', validateRunnerArgs(['--retries=9']).length === 1);
  ok('flaky_override_rejected', validateRunnerArgs(['--fail-on-flaky-tests']).length === 1);
  ok('reporter_override_rejected', validateRunnerArgs(['--reporter=line']).length === 1);

  const passed = checks.filter(check => check.pass).length;
  for (const check of checks) console.log(`${check.pass ? '  ok  ' : ' FAIL '}${check.name}`);
  console.log(`[run-e2e selftest] ${passed}/${checks.length}`);
  return passed === checks.length;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--selftest')) process.exit(runPureSelftest() ? 0 : 1);
  process.exit(await runE2e({ args: process.argv.slice(2) }));
}
