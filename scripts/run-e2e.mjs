/**
 * run-e2e.mjs — the e2e gate wrapper (BACKLOG B17, 2026-07-11; B64-T2 hardening 2026-07-19).
 *
 * Why this exists: on this Node build, Playwright could finish the suite, print its
 * summary ("N passed"), and THEN die in libuv teardown
 * (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, src\win\async.c:76,
 * exit 0xC0000409) — reproduced 2/2 on 2026-07-11 against the reused live dev server.
 * The child's exit code is therefore unusable as a gate: a fully green suite could
 * exit non-zero. (B31s2 note: since the suite moved to its OWN ephemeral stack the
 * crash has not reproduced — the verdict gate stays as armor either way.)
 *
 * B64-T2 (2026-07-19): the verdict now comes from Playwright's STRUCTURED JSON report
 * (written to disk on suite completion — BEFORE the libuv teardown crash), not from a
 * regex over stdout. This is immune to BOTH the teardown crash AND any change in
 * Playwright's summary wording (the old stdout-regex's fragility, audit finding
 * C-TEST-2). The stdout-regex parse is KEPT as a fallback for when the JSON report is
 * missing/unreadable. `list` output still streams through for human visibility.
 *
 *   exit 0  ⇔ at least one test passed AND zero failed/flaky/interrupted/did-not-run
 *   exit 1  ⇔ anything else (failures, no tests found, no report parseable)
 *
 * Usage:
 *   npm run test:e2e                 # full suite (the gate records should cite)
 *   node scripts/run-e2e.mjs <spec>  # any subset, same verdict semantics
 *   node scripts/run-e2e.mjs --selftest   # verify the verdict logic (no browser)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Pure verdict from a parsed Playwright JSON report. Green ⇔ ≥1 passed and nothing
 * failed/flaky/interrupted/timed-out/did-not-run. Walks the suite tree so an
 * interrupted or never-run spec (which `stats` alone can under-count) still flips red.
 */
export function verdictFromReport(report) {
  const s = (report && report.stats) || {};
  const passed = s.expected ?? 0;
  const failed = s.unexpected ?? 0;
  const flaky = s.flaky ?? 0;
  let badResults = 0, totalTests = 0;
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        totalTests++;
        const statuses = (t.results || []).map((r) => r.status);
        const last = statuses[statuses.length - 1];
        if (spec.ok === false) badResults++;
        else if (!last || !['passed', 'skipped'].includes(last)) badResults++;
      }
    }
    for (const child of suite.suites || []) walk(child);
  };
  for (const suite of (report && report.suites) || []) walk(suite);
  const noTests = totalTests === 0;
  const green = passed > 0 && failed === 0 && flaky === 0 && badResults === 0 && !noTests;
  return { passed, failed, flaky, badResults, noTests, green };
}

/** Fallback verdict from the list-reporter stdout (the pre-T2 behavior). */
export function verdictFromStdout(out) {
  const count = (re) => { const m = out.match(re); return m ? parseInt(m[1], 10) : 0; };
  const passed = count(/(\d+)\s+passed/);
  const failed = count(/(\d+)\s+failed/);
  const flaky = count(/(\d+)\s+flaky/);
  const interrupted = count(/(\d+)\s+interrupted/);
  const didNotRun = count(/(\d+)\s+did not run/);
  const noTests = /no tests found/i.test(out);
  const badResults = failed + flaky + interrupted + didNotRun;
  const green = passed > 0 && badResults === 0 && !noTests;
  return { passed, failed, flaky, badResults, noTests, green };
}

// --- Self-test: exercise the verdict logic on synthetic reports (no browser). ------
if (process.argv.includes('--selftest')) {
  const checks = [];
  const ok = (name, cond) => checks.push({ name, pass: !!cond });
  const spec = (status) => ({ ok: status === 'passed' || status === 'skipped', tests: [{ results: [{ status }] }] });
  const rep = (stats, specs) => ({ stats, suites: [{ specs }] });
  ok('all_passed_green', verdictFromReport(rep({ expected: 3, unexpected: 0, flaky: 0 }, [spec('passed'), spec('passed'), spec('passed')])).green === true);
  ok('one_failed_red', verdictFromReport(rep({ expected: 2, unexpected: 1, flaky: 0 }, [spec('passed'), spec('passed'), spec('failed')])).green === false);
  ok('flaky_red', verdictFromReport(rep({ expected: 2, unexpected: 0, flaky: 1 }, [spec('passed'), spec('passed')])).green === false);
  ok('interrupted_spec_red', verdictFromReport(rep({ expected: 2, unexpected: 0, flaky: 0 }, [spec('passed'), spec('interrupted')])).green === false);
  ok('timedout_spec_red', verdictFromReport(rep({ expected: 1, unexpected: 0, flaky: 0 }, [spec('passed'), spec('timedOut')])).green === false);
  ok('no_tests_red', verdictFromReport(rep({ expected: 0, unexpected: 0, flaky: 0 }, [])).green === false);
  ok('skipped_not_bad', verdictFromReport(rep({ expected: 1, unexpected: 0, flaky: 0 }, [spec('passed'), spec('skipped')])).green === true);
  ok('stdout_fallback_green', verdictFromStdout('  19 passed (49.7s)').green === true);
  ok('stdout_fallback_red', verdictFromStdout('  16 failed\n  3 passed').green === false);
  ok('stdout_fallback_no_tests', verdictFromStdout('no tests found').green === false);
  const passed = checks.filter((c) => c.pass).length;
  for (const c of checks) console.log(`${c.pass ? '  ok  ' : ' FAIL '}${c.name}`);
  console.log(`[run-e2e selftest] ${passed}/${checks.length}`);
  process.exit(passed === checks.length ? 0 : 1);
}

const args = process.argv.slice(2);
const jsonPath = path.join(os.tmpdir(), `x4-e2e-report-${process.pid}.json`);
// Invoke the checked-in CLI with this exact Node runtime.  Spawning `npx` through
// `shell:true` on Windows can crash before Playwright starts (0 tests, no JSON report),
// and Node now warns that the unescaped shell argument path is unsafe.  There is no
// package discovery to perform: @playwright/test is a declared dev dependency.
const playwrightCli = path.join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
if (!fs.existsSync(playwrightCli)) {
  console.error(`[run-e2e] Playwright CLI not found at ${playwrightCli}; run npm install first.`);
  process.exit(1);
}
const child = spawn(process.execPath, [playwrightCli, 'test', '--reporter=list,json', ...args], {
  shell: false,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath },
});

let out = '';
child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
child.stderr.on('data', (d) => { out += d; process.stderr.write(d); });

child.on('close', (code) => {
  // Primary: the structured JSON report (written before any teardown crash). Fallback:
  // the stdout regex, so a missing/unreadable report never silently passes a red run.
  let v, source;
  try {
    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    v = verdictFromReport(report);
    source = 'json-report';
  } catch (err) {
    v = verdictFromStdout(out);
    source = `stdout-fallback (${err.message})`;
  }
  try { fs.rmSync(jsonPath, { force: true }); } catch { /* best-effort cleanup */ }

  const crashed = code !== 0;
  const detail = `${v.passed} passed, ${v.failed} failed, ${v.flaky} flaky, ${v.badResults} bad-result` +
    (v.noTests ? ', NO TESTS FOUND' : '') +
    ` [via ${source}]` +
    (crashed ? ` (child exit ${code} IGNORED — verdict comes from the report; libuv teardown crash is a known non-signal)` : '');

  console.log(`\n[run-e2e] VERDICT: ${v.green ? 'PASS' : 'FAIL'} — ${detail}`);
  process.exit(v.green ? 0 : 1);
});

child.on('error', (err) => {
  console.error(`[run-e2e] failed to spawn playwright: ${err.message}`);
  process.exit(1);
});
