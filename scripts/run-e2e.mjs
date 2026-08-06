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
import { types as nodeTypes } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  E2E_RETRY_COUNT,
  MAX_ACTIVE_QUARANTINES,
  MAX_QUARANTINE_DAYS,
  classifyE2eReport,
  validateQuarantineManifest,
} from './e2e-flake-policy.mjs';
import { inspectTerminalPlaywrightReport } from './e2e-terminal-contract.mjs';
import { superviseSpawnedE2eProcess } from './e2e-runner-lifecycle.mjs';

const ROOT = process.cwd();
const DEFAULT_MANIFEST_PATH = path.join(ROOT, 'scripts', 'e2e-quarantine.json');
const DEFAULT_RECEIPT_PATH = path.join(ROOT, 'test-results', 'e2e-verdict.json');
const LIFECYCLE_TRIGGERS = new Set([
  'child-close',
  'child-error',
  'terminal-report-grace-expired',
  'outer-deadline',
]);
const MAX_LIFECYCLE_ERRORS = 32;
const MAX_LIFECYCLE_PIDS = 100000;
const SAFE_LIFECYCLE_ERROR_PREFIXES = [
  'e2e-lifecycle-',
  'spawned-ownership-',
  'termination-',
  'lifecycle-result-',
];
const RECEIPT_SCHEMA_VERSION = 2;
const RECEIPT_TOP_LEVEL_KEYS = [
  'schemaVersion',
  'generatedAt',
  'policy',
  'source',
  'reportCode',
  'childExit',
  'verdict',
  'reportInspection',
  'lifecycle',
  'runnerInteractionFailed',
];
const RECEIPT_POLICY_KEYS = [
  'retryCount',
  'actualFlakeBudget',
  'maximumActiveQuarantines',
  'maximumQuarantineDays',
  'activeQuarantines',
  'errors',
];
const RECEIPT_QUARANTINE_KEYS = [
  'testId',
  'owner',
  'reason',
  'issue',
  'createdOn',
  'expiresOn',
];
const RECEIPT_VERDICT_KEYS = [
  'passed',
  'failed',
  'flaky',
  'badResults',
  'noTests',
  'totalTests',
  'issues',
  'quarantinedIssues',
  'green',
  'structuredReportMissing',
  'structuredReportIncomplete',
  'globalReportErrors',
  'reportErrorCount',
];
const RECEIPT_ISSUE_KEYS = ['testId', 'title', 'file', 'outcome', 'quarantine'];
const RECEIPT_REPORT_INSPECTION_KEYS = [
  'complete',
  'errors',
  'discoveredTests',
  'terminalTests',
  'derivedTotals',
  'reportErrorCount',
];
const RECEIPT_TOTAL_KEYS = ['expected', 'unexpected', 'flaky', 'skipped'];
const RECEIPT_LIFECYCLE_KEYS = [
  'complete',
  'errors',
  'trigger',
  'childExit',
  'ownershipComplete',
  'rootPid',
  'capturedPids',
  'reusedPids',
  'termination',
];
const RECEIPT_TERMINATION_KEYS = [
  'complete',
  'errors',
  'treeGone',
  'passes',
  'capturedPids',
  'commandedPids',
  'reusedPids',
  'remainingPids',
];
const MAX_RECEIPT_STRINGS = 1024;
const MAX_RECEIPT_ISSUES = 100000;
const MAX_RECEIPT_POLICY_ERRORS = 128;

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

function boundedReportInspection(inspection) {
  return {
    complete: inspection.complete,
    errors: [...inspection.errors],
    discoveredTests: inspection.discoveredTests,
    terminalTests: inspection.terminalTests,
    derivedTotals: { ...inspection.derivedTotals },
    reportErrorCount: inspection.reportErrorCount,
  };
}

function unavailableReportInspection() {
  return {
    complete: false,
    errors: ['structured JSON report unavailable or malformed'],
    discoveredTests: 0,
    terminalTests: 0,
    derivedTotals: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
    reportErrorCount: 0,
  };
}

function unavailableLifecycleProjection(errorCode = 'lifecycle-result-unavailable') {
  return {
    complete: false,
    errors: [errorCode],
    trigger: null,
    childExit: null,
    ownershipComplete: false,
    rootPid: null,
    capturedPids: [],
    reusedPids: [],
    termination: null,
  };
}

function isPlainRecord(value) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readOwnData(value, key) {
  try {
    if (!isPlainRecord(value)) return { valid: false, value: undefined };
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined
      || descriptor.enumerable !== true
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      || Object.prototype.hasOwnProperty.call(descriptor, 'get')
      || Object.prototype.hasOwnProperty.call(descriptor, 'set')) {
      return { valid: false, value: undefined };
    }
    return { valid: true, value: descriptor.value };
  } catch {
    return { valid: false, value: undefined };
  }
}

function isSafePid(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function readPidArray(value) {
  try {
    if (!Array.isArray(value) || value.length > MAX_LIFECYCLE_PIDS) return null;
    const pids = [];
    const seen = new Set();
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) return null;
      const pid = value[index];
      if (!isSafePid(pid) || seen.has(pid)) return null;
      seen.add(pid);
      pids.push(pid);
    }
    return pids;
  } catch {
    return null;
  }
}

function readIdentityPidArray(value) {
  try {
    if (!Array.isArray(value) || value.length > MAX_LIFECYCLE_PIDS) return null;
    const pids = [];
    const seen = new Set();
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) return null;
      const identity = value[index];
      const pid = readOwnData(identity, 'pid');
      const creationToken = readOwnData(identity, 'creationToken');
      if (!pid.valid || !creationToken.valid
        || !isSafePid(pid.value)
        || typeof creationToken.value !== 'string'
        || creationToken.value.length === 0
        || creationToken.value.length > 256
        || /[\u0000-\u001F\u007F-\u009F]/u.test(creationToken.value)
        || seen.has(pid.value)) {
        return null;
      }
      seen.add(pid.value);
      pids.push(pid.value);
    }
    return pids;
  } catch {
    return null;
  }
}

function readIdentityPid(value) {
  if (value === null) return { valid: true, pid: null };
  const pids = readIdentityPidArray([value]);
  return pids === null ? { valid: false, pid: null } : { valid: true, pid: pids[0] };
}

function readSafeErrorArray(value, fallback) {
  try {
    if (!Array.isArray(value) || value.length > MAX_LIFECYCLE_ERRORS) return null;
    const errors = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) return null;
      const error = value[index];
      if (typeof error !== 'string'
        || error.length === 0
        || error.length > 128
        || /[^a-z0-9-]/u.test(error)
        || !SAFE_LIFECYCLE_ERROR_PREFIXES.some(prefix => error.startsWith(prefix))) {
        return [fallback];
      }
      errors.push(error);
    }
    return errors;
  } catch {
    return null;
  }
}

function readChildExit(value) {
  if (value === null) return { valid: true, value: null };
  const code = readOwnData(value, 'code');
  const signal = readOwnData(value, 'signal');
  if (!code.valid || !signal.valid
    || (code.value !== null && !Number.isSafeInteger(code.value))
    || (signal.value !== null
      && (typeof signal.value !== 'string'
        || signal.value.length === 0
        || signal.value.length > 128
        || signal.value.trim() !== signal.value
        || /[\u0000-\u001F\u007F-\u009F]/u.test(signal.value)))) {
    return { valid: false, value: null };
  }
  if (code.value === null && signal.value === null) return { valid: false, value: null };
  return { valid: true, value: { code: code.value, signal: signal.value } };
}

function boundedLifecycleProjection(value) {
  try {
    if (!isPlainRecord(value)) return unavailableLifecycleProjection('lifecycle-result-invalid');

    const complete = readOwnData(value, 'complete');
    const errors = readOwnData(value, 'errors');
    const trigger = readOwnData(value, 'trigger');
    const childExit = readOwnData(value, 'childExit');
    const ownershipComplete = readOwnData(value, 'ownershipComplete');
    const rootIdentity = readOwnData(value, 'rootIdentity');
    const captured = readOwnData(value, 'captured');
    const reusedPids = readOwnData(value, 'reusedPids');
    const termination = readOwnData(value, 'termination');
    if ([complete, errors, trigger, childExit, ownershipComplete, rootIdentity, captured, reusedPids, termination]
      .some(field => field.valid === false)) {
      return unavailableLifecycleProjection('lifecycle-result-invalid');
    }

    const lifecycleErrors = readSafeErrorArray(errors.value, 'lifecycle-error');
    const root = readIdentityPid(rootIdentity.value);
    const capturedPids = readIdentityPidArray(captured.value);
    const reused = readPidArray(reusedPids.value);
    const exit = readChildExit(childExit.value);
    if (typeof complete.value !== 'boolean'
      || lifecycleErrors === null
      || (trigger.value !== null && !LIFECYCLE_TRIGGERS.has(trigger.value))
      || typeof ownershipComplete.value !== 'boolean'
      || !root.valid
      || capturedPids === null
      || reused === null
      || !exit.valid
      || (trigger.value === 'child-close' && exit.value === null)
      || (trigger.value !== 'child-close' && exit.value !== null)
      || (root.pid !== null && !capturedPids.includes(root.pid))
      || reused.some(pid => !capturedPids.includes(pid))) {
      return unavailableLifecycleProjection('lifecycle-result-invalid');
    }

    let terminationProjection = null;
    if (termination.value !== null) {
      const terminationRecord = termination.value;
      const terminationComplete = readOwnData(terminationRecord, 'complete');
      const terminationErrors = readOwnData(terminationRecord, 'errors');
      const treeGone = readOwnData(terminationRecord, 'treeGone');
      const passes = readOwnData(terminationRecord, 'passes');
      const terminationCaptured = readOwnData(terminationRecord, 'captured');
      const commanded = readOwnData(terminationRecord, 'commanded');
      const terminationReused = readOwnData(terminationRecord, 'reusedPids');
      if ([terminationComplete, terminationErrors, treeGone, passes, terminationCaptured, commanded, terminationReused]
        .some(field => field.valid === false)) {
        return unavailableLifecycleProjection('lifecycle-result-invalid');
      }
      const safeTerminationErrors = readSafeErrorArray(terminationErrors.value, 'termination-error');
      const capturedTerminationPids = readIdentityPidArray(terminationCaptured.value);
      const commandedPids = readIdentityPidArray(commanded.value);
      const reusedTerminationPids = readPidArray(terminationReused.value);
      if (typeof terminationComplete.value !== 'boolean'
        || safeTerminationErrors === null
        || typeof treeGone.value !== 'boolean'
        || !Number.isSafeInteger(passes.value)
        || passes.value < 0
        || passes.value > 1000
        || capturedTerminationPids === null
        || commandedPids === null
        || reusedTerminationPids === null
        || commandedPids.some(pid => !capturedTerminationPids.includes(pid))
        || reusedTerminationPids.some(pid => !capturedTerminationPids.includes(pid))
        || (terminationComplete.value && (safeTerminationErrors.length !== 0 || treeGone.value !== true))
        || (!terminationComplete.value && (safeTerminationErrors.length === 0 || treeGone.value !== false))) {
        return unavailableLifecycleProjection('lifecycle-result-invalid');
      }
      terminationProjection = {
        complete: terminationComplete.value,
        errors: safeTerminationErrors,
        treeGone: treeGone.value,
        passes: passes.value,
        capturedPids: capturedTerminationPids,
        commandedPids,
        reusedPids: reusedTerminationPids,
        remainingPids: treeGone.value === true ? [] : null,
      };
    }

    if (complete.value && (lifecycleErrors.length !== 0
      || trigger.value === null
      || trigger.value === 'child-error'
      || ownershipComplete.value !== true
      || root.pid === null
      || terminationProjection === null
      || terminationProjection.complete !== true
      || terminationProjection.treeGone !== true
      || terminationProjection.errors.length !== 0)) {
      return unavailableLifecycleProjection('lifecycle-result-invalid');
    }
    if (!complete.value && lifecycleErrors.length === 0) {
      return unavailableLifecycleProjection('lifecycle-result-invalid');
    }

    return {
      complete: complete.value,
      errors: lifecycleErrors,
      trigger: trigger.value,
      childExit: exit.value,
      ownershipComplete: ownershipComplete.value,
      rootPid: root.pid,
      capturedPids,
      reusedPids: reused,
      termination: terminationProjection,
    };
  } catch {
    return unavailableLifecycleProjection('lifecycle-result-invalid');
  }
}

export function runnerCompletionDecision({
  reportInspection,
  verdict,
  lifecycle,
  childErrorObserved = false,
  receiptVerified = false,
  interactionFailed = false,
} = {}) {
  try {
    const termination = lifecycle?.termination;
    return reportInspection?.complete === true
      && verdict?.green === true
      && lifecycle?.complete === true
      && Array.isArray(lifecycle.errors)
      && lifecycle.errors.length === 0
      && (lifecycle.trigger === 'child-close' || lifecycle.trigger === 'terminal-report-grace-expired')
      && lifecycle.ownershipComplete === true
      && termination !== null
      && termination !== undefined
      && termination.complete === true
      && Array.isArray(termination.errors)
      && termination.errors.length === 0
      && termination.treeGone === true
      && Array.isArray(termination.remainingPids)
      && termination.remainingPids.length === 0
      && childErrorObserved !== true
      && receiptVerified === true
      && interactionFailed !== true;
  } catch {
    return false;
  }
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
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, filePath);
  } finally {
    try { fs.rmSync(temp, { force: true }); } catch { /* bounded cleanup of this exact temp only */ }
  }
}

function readReceiptText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function boundedString(value, fallback = '') {
  return typeof value === 'string'
    && value.length <= MAX_RECEIPT_STRINGS
    && !/[\u0000-\u001F\u007F-\u009F]/u.test(value)
    ? value
    : fallback;
}

function boundedQuarantineEntry(value) {
  const entry = isPlainRecord(value) ? value : {};
  const field = key => {
    const result = readOwnData(entry, key);
    return result.valid ? result.value : undefined;
  };
  return {
    testId: boundedString(field('testId')),
    owner: boundedString(field('owner')),
    reason: boundedString(field('reason')),
    issue: boundedString(field('issue')),
    createdOn: boundedString(field('createdOn')),
    expiresOn: boundedString(field('expiresOn')),
  };
}

function boundedVerdict(value) {
  const verdict = isPlainRecord(value) ? value : {};
  const field = key => {
    const result = readOwnData(verdict, key);
    return result.valid ? result.value : undefined;
  };
  const rawIssues = field('issues');
  const issues = Array.isArray(rawIssues) ? rawIssues.slice(0, MAX_RECEIPT_ISSUES).map(issueValue => {
    const issue = isPlainRecord(issueValue) ? issueValue : {};
    const issueField = key => {
      const result = readOwnData(issue, key);
      return result.valid ? result.value : undefined;
    };
    const quarantine = issueField('quarantine');
    return {
      testId: boundedString(issueField('testId')),
      title: boundedString(issueField('title')),
      file: boundedString(issueField('file')),
      outcome: boundedString(issueField('outcome')),
      quarantine: quarantine === null || quarantine === undefined
        ? null
        : boundedQuarantineEntry(quarantine),
    };
  }) : [];
  const count = key => {
    const candidate = field(key);
    return Number.isSafeInteger(candidate) && !Object.is(candidate, -0) && candidate >= 0 ? candidate : 0;
  };
  return {
    passed: count('passed'),
    failed: count('failed'),
    flaky: count('flaky'),
    badResults: count('badResults'),
    noTests: field('noTests') === true,
    totalTests: count('totalTests'),
    issues,
    quarantinedIssues: count('quarantinedIssues'),
    green: field('green') === true,
    structuredReportMissing: field('structuredReportMissing') === true,
    structuredReportIncomplete: field('structuredReportIncomplete') === true,
    globalReportErrors: field('globalReportErrors') === true,
    reportErrorCount: count('reportErrorCount'),
  };
}

function boundedPolicy(policy) {
  const rawEntries = Array.isArray(policy?.entries) ? policy.entries : [];
  const rawErrors = Array.isArray(policy?.errors) ? policy.errors : [];
  return {
    retryCount: E2E_RETRY_COUNT,
    actualFlakeBudget: 0,
    maximumActiveQuarantines: MAX_ACTIVE_QUARANTINES,
    maximumQuarantineDays: MAX_QUARANTINE_DAYS,
    activeQuarantines: rawEntries.slice(0, MAX_ACTIVE_QUARANTINES).map(boundedQuarantineEntry),
    errors: rawErrors.slice(0, MAX_RECEIPT_POLICY_ERRORS).map(error => boundedString(error, 'policy-error')),
  };
}

function boundedLifecycleForReceipt(value) {
  const lifecycle = isPlainRecord(value) ? value : unavailableLifecycleProjection('e2e-lifecycle-result-unavailable');
  const field = key => {
    const result = readOwnData(lifecycle, key);
    return result.valid ? result.value : undefined;
  };
  const terminationValue = field('termination');
  const termination = isPlainRecord(terminationValue)
    ? {
      complete: fieldFrom(terminationValue, 'complete') === true,
      errors: boundedErrorArray(fieldFrom(terminationValue, 'errors'), 'termination-error'),
      treeGone: fieldFrom(terminationValue, 'treeGone') === true,
      passes: boundedSafeNonnegativeInteger(fieldFrom(terminationValue, 'passes')),
      capturedPids: boundedPidArray(fieldFrom(terminationValue, 'capturedPids')),
      commandedPids: boundedPidArray(fieldFrom(terminationValue, 'commandedPids')),
      reusedPids: boundedPidArray(fieldFrom(terminationValue, 'reusedPids')),
      remainingPids: fieldFrom(terminationValue, 'treeGone') === true ? [] : null,
    }
    : null;
  return {
    complete: field('complete') === true,
    errors: boundedErrorArray(field('errors'), 'e2e-lifecycle-result-unavailable'),
    trigger: LIFECYCLE_TRIGGERS.has(field('trigger')) ? field('trigger') : null,
    childExit: boundedChildExit(field('childExit')),
    ownershipComplete: field('ownershipComplete') === true,
    rootPid: boundedPid(field('rootPid')),
    capturedPids: boundedPidArray(field('capturedPids')),
    reusedPids: boundedPidArray(field('reusedPids')),
    termination,
  };
}

function fieldFrom(value, key) {
  const result = readOwnData(value, key);
  return result.valid ? result.value : undefined;
}

function boundedSafeNonnegativeInteger(value) {
  return Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 ? value : 0;
}

function boundedPid(value) {
  return isSafePid(value) ? value : null;
}

function boundedPidArray(value) {
  const pids = readPidArray(value);
  return pids === null ? [] : pids;
}

function boundedErrorArray(value, fallback) {
  const errors = readSafeErrorArray(value, fallback);
  return errors === null ? [fallback] : errors;
}

function boundedChildExit(value) {
  const exit = readChildExit(value);
  return exit.valid ? exit.value : null;
}

function boundedReportInspectionForReceipt(value) {
  const inspection = isPlainRecord(value) ? value : unavailableReportInspection();
  const field = key => fieldFrom(inspection, key);
  const totals = isPlainRecord(field('derivedTotals')) ? field('derivedTotals') : {};
  return {
    complete: field('complete') === true,
    errors: Array.isArray(field('errors'))
      ? field('errors').slice(0, MAX_RECEIPT_STRINGS).map(error => boundedString(error, 'report-inspection-error'))
      : ['structured JSON report unavailable or malformed'],
    discoveredTests: boundedSafeNonnegativeInteger(field('discoveredTests')),
    terminalTests: boundedSafeNonnegativeInteger(field('terminalTests')),
    derivedTotals: {
      expected: boundedSafeNonnegativeInteger(fieldFrom(totals, 'expected')),
      unexpected: boundedSafeNonnegativeInteger(fieldFrom(totals, 'unexpected')),
      flaky: boundedSafeNonnegativeInteger(fieldFrom(totals, 'flaky')),
      skipped: boundedSafeNonnegativeInteger(fieldFrom(totals, 'skipped')),
    },
    reportErrorCount: boundedSafeNonnegativeInteger(field('reportErrorCount')),
  };
}

function policyReceipt(policy, extra = {}) {
  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    policy: boundedPolicy(policy),
    source: extra.source ?? 'preflight',
    reportCode: extra.reportCode ?? 'policy-invalid',
    childExit: Number.isSafeInteger(extra.childExit) && !Object.is(extra.childExit, -0)
      ? extra.childExit
      : null,
    verdict: boundedVerdict(extra.verdict),
    reportInspection: boundedReportInspectionForReceipt(extra.reportInspection),
    lifecycle: boundedLifecycleForReceipt(extra.lifecycle),
    runnerInteractionFailed: extra.runnerInteractionFailed === true,
  };
}

function isStrictJsonRecord(value) {
  try {
    return value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !nodeTypes.isProxy(value)
      && Object.getPrototypeOf(value) === Object.prototype;
  } catch {
    return false;
  }
}

function hasExactDataKeys(value, keys) {
  try {
    if (!isStrictJsonRecord(value)) return false;
    const names = Object.getOwnPropertyNames(value);
    const symbols = Object.getOwnPropertySymbols(value);
    if (symbols.length !== 0
      || names.length !== keys.length
      || names.some((name, index) => name !== keys[index])) return false;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined
        || descriptor.enumerable !== true
        || descriptor.configurable !== true
        || descriptor.writable !== true
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        || Object.prototype.hasOwnProperty.call(descriptor, 'get')
        || Object.prototype.hasOwnProperty.call(descriptor, 'set')) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function readStrictArray(value, maxLength) {
  try {
    if (!Array.isArray(value)
      || nodeTypes.isProxy(value)
      || Object.getPrototypeOf(value) !== Array.prototype
      || !Number.isSafeInteger(value.length)
      || Object.is(value.length, -0)
      || value.length > maxLength) return null;
    const names = Object.getOwnPropertyNames(value);
    const expectedNames = Array.from({ length: value.length }, (_, index) => String(index));
    expectedNames.push('length');
    if (names.length !== expectedNames.length
      || names.some((name, index) => name !== expectedNames[index])
      || Object.getOwnPropertySymbols(value).length !== 0) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined
      || lengthDescriptor.value !== value.length
      || lengthDescriptor.writable !== true
      || lengthDescriptor.enumerable !== false
      || lengthDescriptor.configurable !== false) return null;
    const result = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined
        || descriptor.enumerable !== true
        || descriptor.configurable !== true
        || descriptor.writable !== true
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        || Object.prototype.hasOwnProperty.call(descriptor, 'get')
        || Object.prototype.hasOwnProperty.call(descriptor, 'set')) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function isSafeNonnegativeInteger(value) {
  return Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0;
}

function isReceiptString(value, maxLength = MAX_RECEIPT_STRINGS) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && !/[\u0000-\u001F\u007F-\u009F]/u.test(value);
}

function isReceiptOptionalString(value, maxLength = MAX_RECEIPT_STRINGS) {
  return value === '' || isReceiptString(value, maxLength);
}

function isIsoDayString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const millis = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 10) === value;
}

function readRecordValue(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.value;
}

function validateReceiptQuarantineEntry(value, requireValidPolicyValues) {
  if (!hasExactDataKeys(value, RECEIPT_QUARANTINE_KEYS)) return false;
  const testId = readRecordValue(value, 'testId');
  const owner = readRecordValue(value, 'owner');
  const reason = readRecordValue(value, 'reason');
  const issue = readRecordValue(value, 'issue');
  const createdOn = readRecordValue(value, 'createdOn');
  const expiresOn = readRecordValue(value, 'expiresOn');
  if (![testId, owner, reason, issue, createdOn, expiresOn].every(item => (
    typeof item === 'string'
    && item.length <= MAX_RECEIPT_STRINGS
    && !/[\u0000-\u001F\u007F-\u009F]/u.test(item)
  ))) return false;
  if (!requireValidPolicyValues) return true;
  if (!/^[a-zA-Z0-9_-]{8,128}$/u.test(testId)
    || owner.length < 1 || owner.length > 80
    || reason.length < 12 || reason.length > 240
    || !/^(?:B\d+(?:[-/#][a-zA-Z0-9._-]+)?|https:\/\/[^\s]+)$/u.test(issue)
    || !isIsoDayString(createdOn)
    || !isIsoDayString(expiresOn)) return false;
  const lifetime = Math.round((Date.parse(`${expiresOn}T00:00:00.000Z`)
    - Date.parse(`${createdOn}T00:00:00.000Z`)) / 86_400_000);
  return lifetime >= 1 && lifetime <= MAX_QUARANTINE_DAYS;
}

function validateReceiptPolicy(value) {
  if (!hasExactDataKeys(value, RECEIPT_POLICY_KEYS)) return false;
  const retryCount = readRecordValue(value, 'retryCount');
  const actualFlakeBudget = readRecordValue(value, 'actualFlakeBudget');
  const maximumActiveQuarantines = readRecordValue(value, 'maximumActiveQuarantines');
  const maximumQuarantineDays = readRecordValue(value, 'maximumQuarantineDays');
  const entries = readStrictArray(readRecordValue(value, 'activeQuarantines'), MAX_ACTIVE_QUARANTINES);
  const errors = readStrictArray(readRecordValue(value, 'errors'), MAX_RECEIPT_POLICY_ERRORS);
  if (retryCount !== E2E_RETRY_COUNT
    || actualFlakeBudget !== 0
    || maximumActiveQuarantines !== MAX_ACTIVE_QUARANTINES
    || maximumQuarantineDays !== MAX_QUARANTINE_DAYS
    || entries === null
    || errors === null
    || !errors.every(error => isReceiptOptionalString(error))) return false;
  const policyIsValid = errors.length === 0;
  return entries.every(entry => validateReceiptQuarantineEntry(entry, policyIsValid));
}

function validateReceiptIssue(value) {
  if (!hasExactDataKeys(value, RECEIPT_ISSUE_KEYS)) return false;
  const testId = readRecordValue(value, 'testId');
  const title = readRecordValue(value, 'title');
  const file = readRecordValue(value, 'file');
  const outcome = readRecordValue(value, 'outcome');
  const quarantine = readRecordValue(value, 'quarantine');
  if (![testId, title, file, outcome].every(item => isReceiptOptionalString(item))) return false;
  return quarantine === null || validateReceiptQuarantineEntry(quarantine, true);
}

function validateReceiptVerdict(value) {
  if (!hasExactDataKeys(value, RECEIPT_VERDICT_KEYS)) return false;
  const passed = readRecordValue(value, 'passed');
  const failed = readRecordValue(value, 'failed');
  const flaky = readRecordValue(value, 'flaky');
  const badResults = readRecordValue(value, 'badResults');
  const noTests = readRecordValue(value, 'noTests');
  const totalTests = readRecordValue(value, 'totalTests');
  const issues = readStrictArray(readRecordValue(value, 'issues'), MAX_RECEIPT_ISSUES);
  const quarantinedIssues = readRecordValue(value, 'quarantinedIssues');
  const green = readRecordValue(value, 'green');
  const structuredReportMissing = readRecordValue(value, 'structuredReportMissing');
  const structuredReportIncomplete = readRecordValue(value, 'structuredReportIncomplete');
  const globalReportErrors = readRecordValue(value, 'globalReportErrors');
  const reportErrorCount = readRecordValue(value, 'reportErrorCount');
  if (![passed, failed, flaky, badResults, totalTests, quarantinedIssues, reportErrorCount]
    .every(isSafeNonnegativeInteger)
    || typeof noTests !== 'boolean'
    || typeof green !== 'boolean'
    || typeof structuredReportMissing !== 'boolean'
    || typeof structuredReportIncomplete !== 'boolean'
    || typeof globalReportErrors !== 'boolean'
    || issues === null
    || !issues.every(validateReceiptIssue)) return false;
  const calculatedGreen = passed > 0 && failed === 0 && flaky === 0 && badResults === 0 && !noTests;
  if (badResults !== issues.length
    || quarantinedIssues !== issues.filter(issue => readRecordValue(issue, 'quarantine') !== null).length
    || noTests !== (totalTests === 0)
    || (green !== calculatedGreen && !structuredReportMissing && !structuredReportIncomplete && !globalReportErrors)
    || (structuredReportMissing || structuredReportIncomplete || globalReportErrors) && green !== false
    || (globalReportErrors && reportErrorCount < 1)
    || (!globalReportErrors && reportErrorCount !== 0)) return false;
  return true;
}

function validateReceiptReportInspection(value) {
  if (!hasExactDataKeys(value, RECEIPT_REPORT_INSPECTION_KEYS)) return false;
  const complete = readRecordValue(value, 'complete');
  const errors = readStrictArray(readRecordValue(value, 'errors'), MAX_RECEIPT_STRINGS);
  const discoveredTests = readRecordValue(value, 'discoveredTests');
  const terminalTests = readRecordValue(value, 'terminalTests');
  const derivedTotals = readRecordValue(value, 'derivedTotals');
  const reportErrorCount = readRecordValue(value, 'reportErrorCount');
  if (typeof complete !== 'boolean'
    || errors === null
    || !errors.every(error => isReceiptOptionalString(error))
    || !isSafeNonnegativeInteger(discoveredTests)
    || !isSafeNonnegativeInteger(terminalTests)
    || !hasExactDataKeys(derivedTotals, RECEIPT_TOTAL_KEYS)
    || !isSafeNonnegativeInteger(reportErrorCount)) return false;
  const totals = RECEIPT_TOTAL_KEYS.map(key => readRecordValue(derivedTotals, key));
  if (!totals.every(isSafeNonnegativeInteger)
    || totals.reduce((sum, value) => sum + value, 0) !== discoveredTests
    || terminalTests > discoveredTests
    || (complete && (errors.length !== 0 || terminalTests !== discoveredTests))
    || (!complete && errors.length === 0)) return false;
  return true;
}

function validateReceiptChildExit(value) {
  if (value === null) return true;
  if (!hasExactDataKeys(value, ['code', 'signal'])) return false;
  const code = readRecordValue(value, 'code');
  const signal = readRecordValue(value, 'signal');
  return (code === null || isSafeNonnegativeInteger(code) || (Number.isSafeInteger(code) && !Object.is(code, -0)))
    && (signal === null || isReceiptString(signal, 128));
}

function validateReceiptTopLevelChildExit(value) {
  return value === null || (Number.isSafeInteger(value) && !Object.is(value, -0));
}

function validateReceiptPidArray(value) {
  const pids = readStrictArray(value, MAX_LIFECYCLE_PIDS);
  if (pids === null) return null;
  const seen = new Set();
  for (const pid of pids) {
    if (!isSafePid(pid) || seen.has(pid)) return null;
    seen.add(pid);
  }
  return pids;
}

function validateReceiptLifecycleTermination(value) {
  if (!hasExactDataKeys(value, RECEIPT_TERMINATION_KEYS)) return false;
  const complete = readRecordValue(value, 'complete');
  const errors = readStrictArray(readRecordValue(value, 'errors'), MAX_LIFECYCLE_ERRORS);
  const treeGone = readRecordValue(value, 'treeGone');
  const passes = readRecordValue(value, 'passes');
  const capturedPids = validateReceiptPidArray(readRecordValue(value, 'capturedPids'));
  const commandedPids = validateReceiptPidArray(readRecordValue(value, 'commandedPids'));
  const reusedPids = validateReceiptPidArray(readRecordValue(value, 'reusedPids'));
  const remainingPids = readRecordValue(value, 'remainingPids');
  const remaining = remainingPids === null ? null : validateReceiptPidArray(remainingPids);
  if (typeof complete !== 'boolean'
    || errors === null
    || !errors.every(error => typeof error === 'string'
      && error.length > 0
      && error.length <= 128
      && /^[a-z0-9-]+$/u.test(error)
      && SAFE_LIFECYCLE_ERROR_PREFIXES.some(prefix => error.startsWith(prefix)))
    || typeof treeGone !== 'boolean'
    || !isSafeNonnegativeInteger(passes)
    || passes > 1000
    || capturedPids === null
    || commandedPids === null
    || reusedPids === null
    || (remainingPids !== null && remaining === null)
    || commandedPids.some(pid => !capturedPids.includes(pid))
    || reusedPids.some(pid => !capturedPids.includes(pid))
    || (treeGone === true && (complete !== true || errors.length !== 0 || remainingPids === null || remaining.length !== 0))
    || (treeGone === false && (complete !== false || errors.length === 0 || remainingPids !== null))) return false;
  return true;
}

function validateReceiptLifecycle(value) {
  if (!hasExactDataKeys(value, RECEIPT_LIFECYCLE_KEYS)) return false;
  const complete = readRecordValue(value, 'complete');
  const errors = readStrictArray(readRecordValue(value, 'errors'), MAX_LIFECYCLE_ERRORS);
  const trigger = readRecordValue(value, 'trigger');
  const childExit = readRecordValue(value, 'childExit');
  const ownershipComplete = readRecordValue(value, 'ownershipComplete');
  const rootPid = readRecordValue(value, 'rootPid');
  const capturedPids = validateReceiptPidArray(readRecordValue(value, 'capturedPids'));
  const reusedPids = validateReceiptPidArray(readRecordValue(value, 'reusedPids'));
  const termination = readRecordValue(value, 'termination');
  if (typeof complete !== 'boolean'
    || errors === null
    || !errors.every(error => typeof error === 'string'
      && error.length > 0
      && error.length <= 128
      && /^[a-z0-9-]+$/u.test(error)
      && SAFE_LIFECYCLE_ERROR_PREFIXES.some(prefix => error.startsWith(prefix)))
    || (trigger !== null && !LIFECYCLE_TRIGGERS.has(trigger))
    || !validateReceiptChildExit(childExit)
    || typeof ownershipComplete !== 'boolean'
    || (rootPid !== null && !isSafePid(rootPid))
    || capturedPids === null
    || reusedPids === null
    || (rootPid !== null && !capturedPids.includes(rootPid))
    || reusedPids.some(pid => !capturedPids.includes(pid))
    || (termination !== null && !validateReceiptLifecycleTermination(termination))) return false;
  if (trigger === 'child-close' && childExit === null) return false;
  if (trigger !== 'child-close' && childExit !== null) return false;
  if (complete) {
    return errors.length === 0
      && trigger !== null
      && trigger !== 'child-error'
      && ownershipComplete === true
      && rootPid !== null
      && termination !== null
      && readRecordValue(termination, 'complete') === true
      && readRecordValue(termination, 'treeGone') === true
      && readStrictArray(readRecordValue(termination, 'errors'), MAX_LIFECYCLE_ERRORS)?.length === 0;
  }
  return errors.length !== 0;
}

function isValidReceiptGeneratedAt(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && Number.isFinite(Date.parse(value));
}

/** Strict schema-v2 validation for the persisted internal verdict receipt. */
export function validateE2eVerdictReceipt(value) {
  try {
    if (!hasExactDataKeys(value, RECEIPT_TOP_LEVEL_KEYS)) return false;
    const schemaVersion = readRecordValue(value, 'schemaVersion');
    const generatedAt = readRecordValue(value, 'generatedAt');
    const policy = readRecordValue(value, 'policy');
    const source = readRecordValue(value, 'source');
    const reportCode = readRecordValue(value, 'reportCode');
    const childExit = readRecordValue(value, 'childExit');
    const verdict = readRecordValue(value, 'verdict');
    const reportInspection = readRecordValue(value, 'reportInspection');
    const lifecycle = readRecordValue(value, 'lifecycle');
    const runnerInteractionFailed = readRecordValue(value, 'runnerInteractionFailed');
    const checks = {
      schema: schemaVersion === RECEIPT_SCHEMA_VERSION,
      generated: isValidReceiptGeneratedAt(generatedAt),
      policy: validateReceiptPolicy(policy),
      source: ['preflight', 'json-report', 'stdout-fallback'].includes(source),
      reportCode: ['policy-invalid', 'structured-report-inspected', 'structured-report-unavailable'].includes(reportCode),
      childExit: validateReceiptTopLevelChildExit(childExit),
      verdict: validateReceiptVerdict(verdict),
      reportInspection: validateReceiptReportInspection(reportInspection),
      lifecycle: validateReceiptLifecycle(lifecycle),
      interaction: typeof runnerInteractionFailed === 'boolean',
    };
    if (Object.values(checks).some(check => !check)) {
      return false;
    }
    if (source === 'preflight') {
      return reportCode === 'policy-invalid'
        && childExit === null
        && readRecordValue(verdict, 'green') === false
        && readRecordValue(lifecycle, 'complete') === false;
    }
    if (source === 'json-report') {
      return reportCode === 'structured-report-inspected'
        && readRecordValue(verdict, 'structuredReportMissing') === false;
    }
    return reportCode === 'structured-report-unavailable'
      && readRecordValue(verdict, 'structuredReportMissing') === true
      && readRecordValue(reportInspection, 'complete') === false;
  } catch {
    return false;
  }
}

async function verifyReceiptReadback(receiptPath, expectedReceipt, readImpl) {
  try {
    if (!validateE2eVerdictReceipt(expectedReceipt)) return false;
    const raw = await readImpl(receiptPath);
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : null;
    if (text === null) return false;
    const expectedText = `${JSON.stringify(expectedReceipt, null, 2)}\n`;
    if (text !== expectedText) return false;
    const reopened = JSON.parse(text);
    return validateE2eVerdictReceipt(reopened)
      && JSON.stringify(reopened) === JSON.stringify(expectedReceipt);
  } catch {
    return false;
  }
}

export async function runE2e({
  args = [],
  manifest,
  manifestPath = DEFAULT_MANIFEST_PATH,
  receiptPath = DEFAULT_RECEIPT_PATH,
  spawnImpl = spawn,
  superviseImpl = superviseSpawnedE2eProcess,
  writeJsonAtomicImpl = writeJsonAtomic,
  readReceiptImpl = readReceiptText,
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
      writeJsonAtomicImpl(receiptPath, policyReceipt(policy, {
        source: 'preflight',
        reportCode: 'policy-invalid',
        childExit: null,
        verdict: verdictWithoutStructuredReport('no tests found'),
        reportInspection: unavailableReportInspection(),
        lifecycle: unavailableLifecycleProjection('e2e-lifecycle-policy-invalid'),
        runnerInteractionFailed: false,
      }));
    } catch {
      console.error('[run-e2e] RECEIPT FAIL: atomic write failed.');
    }
    return 1;
  }

  const playwrightCli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
  if (!fs.existsSync(playwrightCli)) {
    console.error(`[run-e2e] Playwright CLI not found at ${playwrightCli}; run npm install first.`);
    return 1;
  }
  if (typeof spawnImpl !== 'function'
    || typeof superviseImpl !== 'function'
    || typeof writeJsonAtomicImpl !== 'function'
    || typeof readReceiptImpl !== 'function') {
    console.error('[run-e2e] RUNNER FAIL: injected runner dependency is invalid.');
    return 1;
  }

  const jsonPath = path.join(os.tmpdir(), `x4-e2e-report-${process.pid}-${Date.now()}.json`);
  let output = '';
  let child = null;
  let childErrorObserved = false;
  let runnerErrorObserverAttached = false;
  let interactionFailed = false;
  function observeChildError() {
    childErrorObserved = true;
    console.error('[run-e2e] Playwright child error observed.');
  }

  try {
    child = spawnImpl(process.execPath, [
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
  } catch {
    interactionFailed = true;
    console.error('[run-e2e] Playwright spawn interaction failed.');
  }

  if (child !== null && child !== undefined) {
    try {
      child.stdout.on('data', data => { output += data; process.stdout.write(data); });
    } catch {
      interactionFailed = true;
    }
    try {
      child.stderr.on('data', data => { output += data; process.stderr.write(data); });
    } catch {
      interactionFailed = true;
    }
    try {
      child.on('error', observeChildError);
      runnerErrorObserverAttached = true;
    } catch {
      interactionFailed = true;
    }
  } else {
    interactionFailed = true;
  }

  let lifecycleResult = null;
  if (child !== null && child !== undefined) {
    try {
      lifecycleResult = await superviseImpl({
        child,
        rootPid: child.pid,
        snapshotOptions: {},
        commandOptions: {},
        probeTerminalReport: () => {
          try {
            const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            return inspectTerminalPlaywrightReport(report, policy.entries).complete === true;
          } catch {
            return false;
          }
        },
      });
    } catch {
      interactionFailed = true;
      console.error('[run-e2e] Playwright lifecycle interaction failed.');
    }
  }
  if (runnerErrorObserverAttached) {
    try {
      child.removeListener('error', observeChildError);
      runnerErrorObserverAttached = false;
    } catch {
      interactionFailed = true;
      console.error('[run-e2e] Playwright child error observer cleanup failed.');
    }
  }

  let verdict;
  let source;
  let reportCode;
  let reportInspection;
  try {
    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const inspection = inspectTerminalPlaywrightReport(report, policy.entries);
    verdict = inspection.verdict;
    reportInspection = boundedReportInspection(inspection);
    source = 'json-report';
    reportCode = 'structured-report-inspected';
  } catch {
    verdict = verdictWithoutStructuredReport(output);
    reportInspection = unavailableReportInspection();
    source = 'stdout-fallback';
    reportCode = 'structured-report-unavailable';
  }
  try { fs.rmSync(jsonPath, { force: true }); } catch { /* best-effort temp cleanup */ }

  const lifecycle = boundedLifecycleProjection(lifecycleResult);
  const childExit = lifecycle.childExit !== null && Number.isSafeInteger(lifecycle.childExit.code)
    ? lifecycle.childExit.code
    : null;
  const receipt = policyReceipt(policy, {
    source,
    reportCode,
    childExit,
    verdict,
    reportInspection,
    lifecycle,
    runnerInteractionFailed: interactionFailed,
  });
  let receiptVerified = false;
  try {
    await writeJsonAtomicImpl(receiptPath, receipt);
    receiptVerified = await verifyReceiptReadback(receiptPath, receipt, readReceiptImpl);
  } catch {
    console.error('[run-e2e] RECEIPT FAIL: write or readback verification failed.');
  }
  if (!receiptVerified) {
    console.error('[run-e2e] RECEIPT FAIL: final receipt was not verified.');
  }

  const detail = `${verdict.passed} passed, ${verdict.failed} failed, ${verdict.flaky} flaky, ` +
    `${verdict.badResults} bad-result, ${verdict.quarantinedIssues || 0} quarantined-but-blocking` +
    (verdict.noTests ? ', NO TESTS FOUND' : '') + ` [via ${source}]` +
    (childExit !== null && childExit !== 0
      ? ` (child exit ${childExit} recorded; structured verdict remains authoritative)`
      : '') +
    ` [lifecycle trigger ${lifecycle.trigger ?? 'unavailable'}, treeGone=${lifecycle.termination?.treeGone === true}]`;
  const success = runnerCompletionDecision({
    reportInspection,
    verdict,
    lifecycle,
    childErrorObserved,
    receiptVerified,
    interactionFailed,
  });
  console.log(`\n[run-e2e] VERDICT: ${success ? 'PASS' : 'FAIL'} — ${detail}`);
  if (success) console.log(`[run-e2e] receipt: ${receiptPath}`);
  return success ? 0 : 1;
}

function runPureSelftest() {
  const checks = [];
  const ok = (name, condition) => checks.push({ name, pass: !!condition });
  const spec = (status, id = 'stable_test_1234', resultStatuses) => {
    const statuses = resultStatuses ?? [status === 'expected' ? 'passed' : status === 'flaky' ? 'passed' : status];
    return {
      id,
      title: id,
      ok: status === 'expected' || status === 'skipped' || status === 'flaky',
      file: 'fixture.spec.ts',
      tests: [{ status, results: statuses.map(resultStatus => ({ status: resultStatus })) }],
    };
  };
  const report = (stats, specs, errors = []) => ({
    errors,
    stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0, ...stats },
    suites: [{ file: 'fixture.spec.ts', specs }],
  });
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

  const strictClean = inspectTerminalPlaywrightReport(report(
    { expected: 2 },
    [spec('expected'), spec('expected', 'stable_test_5678')],
  ));
  ok('strict_clean_two_pass_complete_green', strictClean.complete && strictClean.verdict.green);

  const strictStatsMismatch = inspectTerminalPlaywrightReport(report(
    { expected: 0 },
    [spec('expected')],
  ));
  ok('strict_stats_mismatch_incomplete_red', !strictStatsMismatch.complete && !strictStatsMismatch.verdict.green);

  const strictMissingResults = inspectTerminalPlaywrightReport(report(
    { expected: 1 },
    [spec('expected', 'stable_test_1234', [])],
  ));
  ok('strict_missing_results_incomplete_red', !strictMissingResults.complete && !strictMissingResults.verdict.green);

  const strictGlobalError = inspectTerminalPlaywrightReport(report(
    { expected: 1 },
    [spec('expected')],
    [{ message: 'global setup failed' }],
  ));
  ok('strict_global_error_complete_red', strictGlobalError.complete && !strictGlobalError.verdict.green &&
    strictGlobalError.reportErrorCount === 1 && strictGlobalError.verdict.globalReportErrors === true);

  const strictFailed = inspectTerminalPlaywrightReport(report(
    { unexpected: 1 },
    [spec('unexpected', 'stable_test_1234', ['failed'])],
  ));
  ok('strict_failed_complete_red', strictFailed.complete && !strictFailed.verdict.green);

  const strictTimedOut = inspectTerminalPlaywrightReport(report(
    { unexpected: 1 },
    [spec('unexpected', 'stable_test_1234', ['timedOut'])],
  ));
  ok('strict_timedout_complete_red', strictTimedOut.complete && !strictTimedOut.verdict.green);

  const strictFlaky = inspectTerminalPlaywrightReport(report(
    { flaky: 1 },
    [spec('flaky', 'stable_test_1234', ['failed', 'passed'])],
  ));
  ok('strict_flaky_complete_red', strictFlaky.complete && !strictFlaky.verdict.green);

  const strictSkipped = inspectTerminalPlaywrightReport(report(
    { skipped: 1 },
    [spec('skipped', 'stable_test_1234', ['skipped'])],
  ));
  ok('strict_skipped_complete_red', strictSkipped.complete && !strictSkipped.verdict.green);

  const strictMissingErrorsReport = report({ expected: 1 }, [spec('expected')]);
  delete strictMissingErrorsReport.errors;
  const strictMissingErrors = inspectTerminalPlaywrightReport(strictMissingErrorsReport);
  ok('strict_missing_report_errors_incomplete_red', !strictMissingErrors.complete && !strictMissingErrors.verdict.green);

  const outerCleanupRoot = { pid: 7401, creationToken: '20260804000000.000000-SELFTEST' };
  const outerCleanupChild = { pid: 7402, creationToken: '20260804000000.000001-SELFTEST' };
  const outerCleanupProjection = boundedLifecycleProjection({
    complete: true,
    errors: [],
    trigger: 'outer-deadline',
    childExit: null,
    ownershipComplete: true,
    rootIdentity: outerCleanupRoot,
    captured: [outerCleanupRoot, outerCleanupChild],
    reusedPids: [],
    termination: {
      complete: true,
      errors: [],
      treeGone: true,
      passes: 1,
      captured: [outerCleanupRoot, outerCleanupChild],
      commanded: [outerCleanupRoot, outerCleanupChild],
      reusedPids: [],
      remainingPids: [],
    },
  });
  ok('outer_cleanup_projection_preserved_red',
    outerCleanupProjection.trigger === 'outer-deadline'
      && outerCleanupProjection.termination?.treeGone === true
      && JSON.stringify(outerCleanupProjection.termination?.remainingPids) === '[]'
      && outerCleanupProjection.capturedPids.join(',') === '7401,7402'
    && !JSON.stringify(outerCleanupProjection).includes('creationToken')
    && !runnerCompletionDecision({
      reportInspection: strictClean,
      verdict: strictClean.verdict,
      lifecycle: outerCleanupProjection,
       receiptVerified: true,
    }));

  const completeLifecycle = {
    complete: true,
    errors: [],
    trigger: 'child-close',
    childExit: { code: 0, signal: null },
    ownershipComplete: true,
    rootPid: 7401,
    capturedPids: [7401],
    reusedPids: [],
    termination: {
      complete: true,
      errors: [],
      treeGone: true,
      passes: 1,
      capturedPids: [7401],
      commandedPids: [7401],
      reusedPids: [],
      remainingPids: [],
    },
  };
  const completionArgs = {
    reportInspection: strictClean,
    verdict: strictClean.verdict,
    lifecycle: completeLifecycle,
    receiptVerified: true,
  };
  ok('normal_close_green', runnerCompletionDecision(completionArgs));
  ok('terminal_grace_green', runnerCompletionDecision({
    ...completionArgs,
    lifecycle: { ...completeLifecycle, trigger: 'terminal-report-grace-expired', childExit: null },
  }));
  ok('outer_deadline_red', !runnerCompletionDecision({
    ...completionArgs,
    lifecycle: { ...completeLifecycle, trigger: 'outer-deadline', childExit: null },
  }));
  ok('child_error_red', !runnerCompletionDecision({
    ...completionArgs,
    lifecycle: { ...completeLifecycle, complete: false, errors: ['e2e-lifecycle-child-error'], childExit: null },
  }));
  ok('lifecycle_complete_false_red', !runnerCompletionDecision({
    ...completionArgs,
    lifecycle: { ...completeLifecycle, complete: false, errors: ['e2e-lifecycle-termination-failed'] },
  }));
  ok('tree_gone_false_red', !runnerCompletionDecision({
    ...completionArgs,
    lifecycle: {
      ...completeLifecycle,
      complete: false,
      errors: ['e2e-lifecycle-termination-failed'],
      termination: {
        ...completeLifecycle.termination,
        complete: false,
        errors: ['termination-executor-pass-limit'],
        treeGone: false,
      },
    },
  }));
  ok('report_inspection_incomplete_red', !runnerCompletionDecision({
    ...completionArgs,
    reportInspection: { ...strictClean, complete: false },
  }));
  ok('spawn_error_observed_red', !runnerCompletionDecision({
    ...completionArgs,
    childErrorObserved: true,
  }));
  ok('receipt_verification_error_red', !runnerCompletionDecision({
    ...completionArgs,
    receiptVerified: false,
  }));
  ok('malformed_lifecycle_red', !runnerCompletionDecision({
    ...completionArgs,
    lifecycle: {},
  }));

  const validReceipt = policyReceipt({ entries: [], errors: [] }, {
    source: 'json-report',
    reportCode: 'structured-report-inspected',
    childExit: 0,
    verdict: strictClean.verdict,
    reportInspection: boundedReportInspection(strictClean),
    lifecycle: completeLifecycle,
    runnerInteractionFailed: false,
  });
  ok('receipt_schema_v2_valid', validateE2eVerdictReceipt(validReceipt));
  const preflightReceipt = policyReceipt({ entries: [{ testId: '', owner: '', reason: '', issue: '', createdOn: '', expiresOn: '' }], errors: ['invalid policy'] }, {
    source: 'preflight',
    reportCode: 'policy-invalid',
    childExit: null,
    verdict: verdictWithoutStructuredReport('no tests found'),
    reportInspection: unavailableReportInspection(),
    lifecycle: unavailableLifecycleProjection('e2e-lifecycle-policy-invalid'),
    runnerInteractionFailed: false,
  });
  ok('preflight_receipt_schema_v2_valid', validateE2eVerdictReceipt(preflightReceipt));
  const receiptWithExtraKey = JSON.parse(JSON.stringify(validReceipt));
  receiptWithExtraKey.extra = true;
  ok('receipt_extra_key_red', !validateE2eVerdictReceipt(receiptWithExtraKey));
  const receiptWithWrongType = JSON.parse(JSON.stringify(validReceipt));
  receiptWithWrongType.lifecycle.termination.passes = Infinity;
  ok('receipt_infinity_red', !validateE2eVerdictReceipt(receiptWithWrongType));
  const receiptWithSparseArray = JSON.parse(JSON.stringify(validReceipt));
  delete receiptWithSparseArray.lifecycle.capturedPids[0];
  ok('receipt_sparse_array_red', !validateE2eVerdictReceipt(receiptWithSparseArray));
  const receiptWithAccessor = JSON.parse(JSON.stringify(validReceipt));
  Object.defineProperty(receiptWithAccessor, 'generatedAt', {
    configurable: true,
    enumerable: true,
    get() { return validReceipt.generatedAt; },
  });
  ok('receipt_accessor_red', !validateE2eVerdictReceipt(receiptWithAccessor));
  const receiptWithProxy = new Proxy(validReceipt, {});
  ok('receipt_proxy_red', !validateE2eVerdictReceipt(receiptWithProxy));
  const receiptWithWrongContent = JSON.parse(JSON.stringify(validReceipt));
  receiptWithWrongContent.generatedAt = '2026-08-04T00:00:00.000Z';
  ok('receipt_content_mismatch_red', validateE2eVerdictReceipt(receiptWithWrongContent)
    && JSON.stringify(receiptWithWrongContent) !== JSON.stringify(validReceipt));

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
