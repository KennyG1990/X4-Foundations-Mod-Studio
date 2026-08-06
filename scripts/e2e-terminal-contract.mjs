import { classifyE2eReport } from './e2e-flake-policy.mjs';

const TEST_STATUSES = new Set(['skipped', 'expected', 'unexpected', 'flaky']);
const RESULT_STATUSES = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
const TERMINAL_FAILURES = new Set(['failed', 'timedOut', 'interrupted']);
const TOTAL_KEYS = ['expected', 'unexpected', 'flaky', 'skipped'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value) {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function inspectTerminalPlaywrightReport(report, quarantineEntries = []) {
  const errors = [];
  const derivedTotals = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  let discoveredTests = 0;
  let terminalTests = 0;
  let reportErrorCount = 0;
  let stats;
  let suites;

  const addError = message => errors.push(message);

  try {
    if (!isObject(report)) {
      addError('report must be a non-array object');
    } else {
      stats = report.stats;
      if (!isObject(stats)) {
        addError('report.stats must be an object');
      } else {
        for (const key of TOTAL_KEYS) {
          if (!isCount(stats[key])) addError(`report.stats.${key} must be a finite nonnegative integer`);
        }
      }

      if (!Array.isArray(report.errors)) {
        addError('report.errors must be an array');
      } else {
        reportErrorCount = report.errors.length;
      }

      suites = report.suites;
      if (!Array.isArray(suites) || suites.length === 0) {
        addError('report.suites must be a nonempty array');
      }
    }

    const walkSuite = (suite, path) => {
      if (!isObject(suite)) {
        addError(`${path} must be an object`);
        return;
      }

      const specs = suite.specs;
      if (specs !== undefined && !Array.isArray(specs)) {
        addError(`${path}.specs must be an array`);
      } else if (Array.isArray(specs)) {
        specs.forEach((spec, specIndex) => {
          const specPath = `${path}.specs[${specIndex}]`;
          if (!isObject(spec)) {
            addError(`${specPath} must be an object`);
            return;
          }
          if (typeof spec.id !== 'string' || spec.id.trim() === '') {
            addError(`${specPath}.id must be a nonempty string`);
          }
          if (!Array.isArray(spec.tests) || spec.tests.length === 0) {
            addError(`${specPath}.tests must be a nonempty array`);
            return;
          }

          spec.tests.forEach((test, testIndex) => {
            const testPath = `${specPath}.tests[${testIndex}]`;
            discoveredTests++;
            if (!isObject(test)) {
              addError(`${testPath} must be an object`);
              return;
            }

            const testStatus = test.status;
            if (!TEST_STATUSES.has(testStatus)) {
              addError(`${testPath}.status must be skipped, expected, unexpected, or flaky`);
            } else {
              derivedTotals[testStatus]++;
            }

            const results = test.results;
            if (!Array.isArray(results) || results.length === 0) {
              addError(`${testPath}.results must be a nonempty array`);
              return;
            }

            const resultStatuses = [];
            let allResultsKnown = true;
            results.forEach((result, resultIndex) => {
              const resultPath = `${testPath}.results[${resultIndex}]`;
              if (!isObject(result)) {
                addError(`${resultPath} must be an object`);
                allResultsKnown = false;
                resultStatuses.push(undefined);
                return;
              }
              const resultStatus = result.status;
              resultStatuses.push(resultStatus);
              if (!RESULT_STATUSES.has(resultStatus)) {
                addError(`${resultPath}.status must be passed, failed, timedOut, skipped, or interrupted`);
                allResultsKnown = false;
              }
            });

            const finalStatus = resultStatuses[resultStatuses.length - 1];
            if (allResultsKnown) terminalTests++;
            if (!TEST_STATUSES.has(testStatus)) return;

            if (testStatus === 'expected' && !resultStatuses.every(status => status === 'passed')) {
              addError(`${testPath}.status expected requires every result.status passed`);
            } else if (testStatus === 'unexpected' && !resultStatuses.every(status => TERMINAL_FAILURES.has(status))) {
              addError(`${testPath}.status unexpected requires every result.status to be failed, timedOut, or interrupted`);
            } else if (testStatus === 'flaky') {
              const allEarlierFailed = resultStatuses
                .slice(0, -1)
                .every(status => TERMINAL_FAILURES.has(status));
              if (results.length < 2 || finalStatus !== 'passed' || !allEarlierFailed) {
                addError(`${testPath}.status flaky requires at least two results, every pre-final result failed, timedOut, or interrupted, and a final passed result`);
              }
            } else if (testStatus === 'skipped' && !resultStatuses.every(status => status === 'skipped')) {
              addError(`${testPath}.status skipped requires every result.status skipped`);
            }
          });
        });
      }

      const childSuites = suite.suites;
      if (childSuites !== undefined && !Array.isArray(childSuites)) {
        addError(`${path}.suites must be an array`);
      } else if (Array.isArray(childSuites)) {
        childSuites.forEach((childSuite, suiteIndex) => walkSuite(childSuite, `${path}.suites[${suiteIndex}]`));
      }
    };

    if (Array.isArray(suites)) {
      suites.forEach((suite, suiteIndex) => walkSuite(suite, `report.suites[${suiteIndex}]`));
    }
  } catch {
    addError('report inspection threw an exception');
  }

  if (isObject(stats)) {
    for (const key of TOTAL_KEYS) {
      if (stats[key] !== derivedTotals[key]) {
        addError(`report.stats.${key} must equal derived test.status total`);
      }
    }
  }

  let classifierVerdict = { green: false };
  let classifierSucceeded = false;
  try {
    const quarantine = Array.isArray(quarantineEntries) ? quarantineEntries : [];
    const classified = classifyE2eReport(report, quarantine);
    if (!isObject(classified)) {
      addError('classifyE2eReport must return an object');
    } else {
      classifierVerdict = classified;
      classifierSucceeded = true;
    }
  } catch {
    addError('classifyE2eReport threw an exception');
  }

  if (classifierSucceeded) {
    if (classifierVerdict.totalTests !== discoveredTests) {
      addError('verdict.totalTests must equal discoveredTests');
    }
    if (classifierVerdict.passed !== derivedTotals.expected) {
      addError('verdict.passed must equal derivedTotals.expected');
    }
    if (classifierVerdict.failed !== derivedTotals.unexpected) {
      addError('verdict.failed must equal derivedTotals.unexpected');
    }
    if (classifierVerdict.flaky !== derivedTotals.flaky) {
      addError('verdict.flaky must equal derivedTotals.flaky');
    }
  }

  if (discoveredTests <= 0) addError('discoveredTests must be greater than zero');
  if (terminalTests !== discoveredTests) addError('terminalTests must equal discoveredTests');

  const complete = errors.length === 0;
  const hasGlobalReportErrors = reportErrorCount > 0;
  let verdict = classifierVerdict;
  if (!complete || hasGlobalReportErrors) {
    verdict = { ...classifierVerdict, green: false };
    if (!complete) verdict.structuredReportIncomplete = true;
    if (hasGlobalReportErrors) {
      verdict.globalReportErrors = true;
      verdict.reportErrorCount = reportErrorCount;
    }
  }
  return { complete, errors, discoveredTests, terminalTests, derivedTotals, reportErrorCount, verdict };
}
