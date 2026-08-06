import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { runE2e, validateE2eVerdictReceipt } from './run-e2e.mjs';

const CASE_PREFIX = 'x4-e2e-runner-integration-';
const WATCHDOG_MS = 1000;
const RUNNER_ARGS = ['--project=chromium'];
const MANIFEST = { version: 1, entries: [] };
const PRODUCTION_INPUT_KEYS = [
  'child',
  'rootPid',
  'snapshotOptions',
  'commandOptions',
  'probeTerminalReport',
];
const LIFECYCLE_RESULT_KEYS = [
  'complete',
  'errors',
  'trigger',
  'childExit',
  'ownershipComplete',
  'rootIdentity',
  'captured',
  'reusedPids',
  'termination',
];
const TERMINATION_RESULT_KEYS = [
  'complete',
  'errors',
  'treeGone',
  'passes',
  'captured',
  'commanded',
  'reusedPids',
];
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

const watchdogState = {
  armed: 0,
  cleared: 0,
  fired: 0,
};

function assertExactRecordKeys(value, keys) {
  assert.deepEqual(Object.keys(value), keys);
  assert.deepEqual(Object.getOwnPropertyNames(value), keys);
  assert.deepEqual(Object.getOwnPropertySymbols(value), []);
}

function makeIdentity(pid, creationToken) {
  return { pid, creationToken };
}

function cloneIdentity(identity) {
  return makeIdentity(identity.pid, identity.creationToken);
}

function makeStrictGreenReport() {
  const report = {
    stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    errors: [],
    suites: [{
      title: 'runner integration',
      file: 'e2e-runner-integration.spec.mjs',
      specs: [{
        title: 'strict green terminal report',
        id: 'runner-integration-green-01',
        file: 'e2e-runner-integration.spec.mjs',
        tests: [{
          projectName: 'chromium',
          status: 'expected',
          results: [{ status: 'passed' }],
        }],
      }],
    }],
  };
  assertExactRecordKeys(report, ['stats', 'errors', 'suites']);
  assertExactRecordKeys(report.stats, ['expected', 'unexpected', 'flaky', 'skipped']);
  return report;
}

function makeStructurallyIncompleteReport() {
  const report = {
    stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    errors: [],
    suites: [{
      title: 'runner integration',
      file: 'e2e-runner-integration.spec.mjs',
      specs: [{
        title: 'incomplete terminal report',
        id: 'runner-integration-incomplete-01',
        file: 'e2e-runner-integration.spec.mjs',
        tests: [{
          projectName: 'chromium',
          status: 'expected',
          results: [],
        }],
      }],
    }],
  };
  assertExactRecordKeys(report, ['stats', 'errors', 'suites']);
  assertExactRecordKeys(report.stats, ['expected', 'unexpected', 'flaky', 'skipped']);
  return report;
}

function makeCompleteLifecycle({ rootPid, trigger, childExit, capturedPids, tokenPrefix }) {
  const captured = capturedPids.map((pid, index) => (
    makeIdentity(pid, `${tokenPrefix}-captured-${index}`)
  ));
  const rootIdentity = cloneIdentity(captured[0]);
  const termination = {
    complete: true,
    errors: [],
    treeGone: true,
    passes: 1,
    captured: captured.map(cloneIdentity),
    commanded: captured.map(cloneIdentity),
    reusedPids: [],
  };
  const lifecycle = {
    complete: true,
    errors: [],
    trigger,
    childExit,
    ownershipComplete: true,
    rootIdentity,
    captured: captured.map(cloneIdentity),
    reusedPids: [],
    termination,
  };
  assert.equal(rootIdentity.pid, rootPid);
  assertExactRecordKeys(lifecycle, LIFECYCLE_RESULT_KEYS);
  assertExactRecordKeys(termination, TERMINATION_RESULT_KEYS);
  for (const identity of [rootIdentity, ...captured, ...termination.captured, ...termination.commanded]) {
    assert.equal(typeof identity.creationToken, 'string');
    assert.ok(identity.creationToken.length > 0);
  }
  return lifecycle;
}

function makeMalformedLifecycle({ rootPid, tokenPrefix }) {
  const identity = makeIdentity(rootPid, `${tokenPrefix}-malformed-token`);
  const termination = {
    complete: true,
    errors: [],
    treeGone: true,
    passes: 1,
    captured: [cloneIdentity(identity)],
    commanded: [cloneIdentity(identity)],
    reusedPids: [],
  };
  const lifecycle = {
    complete: 'raw-malformed-complete',
    errors: ['raw-malformed-secret'],
    trigger: 'raw-malformed-trigger',
    childExit: { code: 0, signal: null },
    ownershipComplete: true,
    rootIdentity: identity,
    captured: [cloneIdentity(identity)],
    reusedPids: [],
    termination,
  };
  assertExactRecordKeys(lifecycle, LIFECYCLE_RESULT_KEYS);
  assertExactRecordKeys(termination, TERMINATION_RESULT_KEYS);
  return lifecycle;
}

function makeFailedTerminationLifecycle({ rootPid, capturedPids, tokenPrefix }) {
  const captured = capturedPids.map((pid, index) => (
    makeIdentity(pid, `${tokenPrefix}-failed-captured-${index}`)
  ));
  const identity = cloneIdentity(captured[0]);
  const termination = {
    complete: false,
    errors: ['termination-executor-pass-limit'],
    treeGone: false,
    passes: 100,
    captured: captured.map(cloneIdentity),
    commanded: captured.map(cloneIdentity),
    reusedPids: [],
  };
  const lifecycle = {
    complete: false,
    errors: ['e2e-lifecycle-termination-failed'],
    trigger: 'child-close',
    childExit: { code: 0, signal: null },
    ownershipComplete: true,
    rootIdentity: identity,
    captured: captured.map(cloneIdentity),
    reusedPids: [],
    termination,
  };
  assertExactRecordKeys(lifecycle, LIFECYCLE_RESULT_KEYS);
  assertExactRecordKeys(termination, TERMINATION_RESULT_KEYS);
  return lifecycle;
}

function makeUnavailableLifecycleProjection() {
  const projection = {
    complete: false,
    errors: ['lifecycle-result-invalid'],
    trigger: null,
    childExit: null,
    ownershipComplete: false,
    rootPid: null,
    capturedPids: [],
    reusedPids: [],
    termination: null,
  };
  assertExactRecordKeys(projection, RECEIPT_LIFECYCLE_KEYS);
  return projection;
}

function makeFakeChild(pid, interactionFailure) {
  const child = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  Object.defineProperties(child, {
    pid: {
      value: pid,
      writable: false,
      enumerable: true,
      configurable: false,
    },
    stdout: {
      value: stdout,
      writable: false,
      enumerable: true,
      configurable: false,
    },
    stderr: {
      value: stderr,
      writable: false,
      enumerable: true,
      configurable: false,
    },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(child, 'pid'), true);
  assert.equal(Number.isSafeInteger(child.pid) && child.pid > 0, true);
  assert.equal(child.stdout instanceof PassThrough, true);
  assert.equal(child.stderr instanceof PassThrough, true);
  if (interactionFailure) {
    const originalOn = child.stderr.on.bind(child.stderr);
    child.stderr.on = (eventName, listener) => {
      if (eventName === 'data') throw new Error('stderr-secret');
      return originalOn(eventName, listener);
    };
  }
  return child;
}

async function withWatchdog(name, operation) {
  let watchdogHandle;
  watchdogState.armed += 1;
  try {
    const watchdog = new Promise((_, reject) => {
      watchdogHandle = globalThis.setTimeout(() => {
        watchdogState.fired += 1;
        reject(new Error(`${name} watchdog expired`));
      }, WATCHDOG_MS);
    });
    return await Promise.race([
      Promise.resolve().then(operation),
      watchdog,
    ]);
  } finally {
    if (watchdogHandle !== undefined) {
      globalThis.clearTimeout(watchdogHandle);
      watchdogState.cleared += 1;
    }
  }
}

function makeCaseHarness(spec, caseNumber, receiptPath) {
  const rootPid = 7400 + caseNumber * 10;
  const capturedPids = [rootPid, rootPid + 1];
  const tokenPrefix = `runner-integration-case-${caseNumber}`;
  const report = spec.reportFactory();
  const lifecycle = spec.lifecycleFactory({ rootPid, capturedPids, tokenPrefix });
  const state = {
    spawnCalls: 0,
    superviseCalls: 0,
    probeCalls: 0,
    child: null,
    errorListenerBaseline: null,
    reportPath: null,
    spawnCommand: null,
    spawnArgs: null,
    spawnOptions: null,
    productionProcessCalls: 0,
    lifecycle,
    rootPid,
    capturedPids,
    tokenValues: [
      ...lifecycle.captured.map(identity => identity.creationToken),
      ...lifecycle.termination?.captured.map(identity => identity.creationToken) || [],
      ...lifecycle.termination?.commanded.map(identity => identity.creationToken) || [],
      lifecycle.rootIdentity?.creationToken,
    ].filter(value => typeof value === 'string'),
  };

  const expectedCli = path.join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
  const spawnImpl = (command, args, options) => {
    state.spawnCalls += 1;
    assert.equal(state.spawnCalls, 1);
    assert.equal(command, process.execPath);
    assert.deepEqual(args, [
      expectedCli,
      'test',
      '--retries=1',
      '--fail-on-flaky-tests',
      '--reporter=list,json',
      ...RUNNER_ARGS,
    ]);
    assert.deepEqual(options.shell, false);
    assert.deepEqual(options.stdio, ['inherit', 'pipe', 'pipe']);
    assert.deepEqual(options.env, {
      ...process.env,
      PLAYWRIGHT_JSON_OUTPUT_NAME: options.env.PLAYWRIGHT_JSON_OUTPUT_NAME,
    });
    assert.equal(typeof options.env.PLAYWRIGHT_JSON_OUTPUT_NAME, 'string');
    assert.equal(path.dirname(options.env.PLAYWRIGHT_JSON_OUTPUT_NAME), os.tmpdir());
    assert.equal(path.extname(options.env.PLAYWRIGHT_JSON_OUTPUT_NAME), '.json');
    assert.equal(fs.existsSync(options.env.PLAYWRIGHT_JSON_OUTPUT_NAME), false);
    state.spawnCommand = command;
    state.spawnArgs = [...args];
    state.spawnOptions = options;
    state.reportPath = options.env.PLAYWRIGHT_JSON_OUTPUT_NAME;
    state.child = makeFakeChild(rootPid, spec.interactionFailure === true);
    state.errorListenerBaseline = state.child.listenerCount('error');
    return state.child;
  };

  const superviseImpl = async (input) => {
    state.superviseCalls += 1;
    assert.equal(state.superviseCalls, 1);
    assertExactRecordKeys(input, PRODUCTION_INPUT_KEYS);
    assert.strictEqual(input.child, state.child);
    assert.equal(input.rootPid, rootPid);
    assert.deepEqual(input.snapshotOptions, {});
    assert.deepEqual(input.commandOptions, {});
    assert.equal(typeof input.probeTerminalReport, 'function');
    assert.equal(state.productionProcessCalls, 0);
    assert.equal(fs.existsSync(state.reportPath), false);
    assert.equal(input.probeTerminalReport(), false);
    state.probeCalls += 1;

    if (spec.stdout !== undefined) {
      state.child.stdout.write(spec.stdout);
    }
    if (spec.emitChildError === true) {
      assert.equal(state.child.listenerCount('error'), state.errorListenerBaseline + 1);
      state.child.emit('error', new Error('child-secret'));
      assert.equal(state.child.listenerCount('error'), state.errorListenerBaseline + 1);
    }

    fs.writeFileSync(state.reportPath, `${JSON.stringify(report)}\n`, 'utf8');
    assert.equal(fs.existsSync(state.reportPath), true);
    assert.equal(input.probeTerminalReport(), spec.probeAfterWrite);
    state.probeCalls += 1;
    return lifecycle;
  };

  return {
    state,
    spawnImpl,
    superviseImpl,
    receiptPath,
    report,
    lifecycle,
  };
}

function assertNoLifecycleTokenOrSecretLeak(receiptText, tokenValues, extraSecrets = []) {
  assert.equal(receiptText.includes('creationToken'), false);
  for (const token of tokenValues) assert.equal(receiptText.includes(token), false);
  for (const secret of extraSecrets) assert.equal(receiptText.includes(secret), false);
}

function assertReceiptLifecycleShape(receipt) {
  assert.equal(receipt.schemaVersion, 2);
  assert.equal(validateE2eVerdictReceipt(receipt), true);
  assertExactRecordKeys(receipt.lifecycle, RECEIPT_LIFECYCLE_KEYS);
  if (receipt.lifecycle.termination !== null) {
    assertExactRecordKeys(receipt.lifecycle.termination, RECEIPT_TERMINATION_KEYS);
  }
}

function cleanupCaseDirectory(caseRoot) {
  const target = path.resolve(caseRoot);
  const tempRoot = path.resolve(os.tmpdir());
  assert.equal(path.dirname(target), tempRoot);
  assert.equal(path.basename(target).startsWith(CASE_PREFIX), true);
  assert.equal(fs.lstatSync(target).isDirectory(), true);
  fs.rmSync(target, { recursive: true, force: false });
  assert.equal(fs.existsSync(target), false);
}

function corruptReceiptWriter(mode) {
  return (receiptPath, receipt) => {
    if (mode === 'malformed-json') {
      fs.writeFileSync(receiptPath, '{"schemaVersion":2,', 'utf8');
      return;
    }
    const corrupted = JSON.parse(JSON.stringify(receipt));
    if (mode === 'extra-key') corrupted.unexpected = true;
    if (mode === 'content-mismatch') corrupted.generatedAt = '2026-08-04T00:00:00.000Z';
    fs.writeFileSync(receiptPath, `${JSON.stringify(corrupted, null, 2)}\n`, 'utf8');
  };
}

async function runCase(spec, caseNumber) {
  let caseRoot;
  try {
    caseRoot = fs.mkdtempSync(path.join(os.tmpdir(), CASE_PREFIX));
    assert.equal(path.dirname(path.resolve(caseRoot)), path.resolve(os.tmpdir()));
    assert.equal(path.basename(caseRoot).startsWith(CASE_PREFIX), true);
    const receiptPath = path.join(caseRoot, 'receipt.json');
    const harness = makeCaseHarness(spec, caseNumber, receiptPath);
    const runOptions = typeof spec.runOptions === 'function' ? spec.runOptions(harness) : {};

    const exitCode = await withWatchdog(spec.name, () => runE2e({
      args: RUNNER_ARGS,
      manifest: MANIFEST,
      receiptPath,
      spawnImpl: harness.spawnImpl,
      superviseImpl: harness.superviseImpl,
      ...runOptions,
    }));

    assert.equal(harness.state.spawnCalls, 1);
    assert.equal(harness.state.superviseCalls, 1);
    assert.equal(harness.state.probeCalls, 2);
    assert.equal(harness.state.productionProcessCalls, 0);
    assert.equal(harness.state.child.listenerCount('error'), harness.state.errorListenerBaseline);
    assert.equal(fs.existsSync(harness.state.reportPath), false);
    if (spec.expectReceiptMissing === true) {
      assert.equal(fs.existsSync(receiptPath), false);
      assert.deepEqual(fs.readdirSync(caseRoot), []);
      assert.equal(exitCode, 1);
      spec.assertResult({ exitCode, receipt: null, receiptText: '', harness });
      return;
    }
    assert.deepEqual(fs.readdirSync(caseRoot), ['receipt.json']);
    assert.equal(fs.existsSync(receiptPath), true);
    const receiptText = fs.readFileSync(receiptPath, 'utf8');
    assert.ok(receiptText.length > 0);
    let receipt = null;
    try { receipt = JSON.parse(receiptText); } catch { /* parse-failure fixtures assert red below */ }
    if (spec.expectReceiptVerificationFailure === true) {
      assert.equal(exitCode, 1);
      assertNoLifecycleTokenOrSecretLeak(
        receiptText,
        harness.state.tokenValues,
        ['child-secret', 'stderr-secret', 'raw-malformed-secret', 'raw-malformed-trigger', 'raw-malformed-complete'],
      );
      if (spec.expectValidReceipt === true) assert.equal(validateE2eVerdictReceipt(receipt), true);
      if (spec.expectValidReceipt === false) assert.equal(validateE2eVerdictReceipt(receipt), false);
      spec.assertResult({ exitCode, receipt, receiptText, harness });
      return;
    }
    assertReceiptLifecycleShape(receipt);
    assertNoLifecycleTokenOrSecretLeak(
      receiptText,
      harness.state.tokenValues,
      ['child-secret', 'stderr-secret', 'raw-malformed-secret', 'raw-malformed-trigger', 'raw-malformed-complete'],
    );
    assert.equal(receipt.receiptPath, undefined);
    assert.equal(receipt.runnerInteractionFailed, spec.expectedInteractionFailure);
    assert.equal(receipt.source, 'json-report');
    assert.equal(receipt.reportCode, 'structured-report-inspected');
    spec.assertResult({ exitCode, receipt, receiptText, harness });
  } finally {
    if (caseRoot !== undefined) cleanupCaseDirectory(caseRoot);
  }
}

const CASES = [
  {
    name: 'normal child-close strict green',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'child-close',
      childExit: { code: 0, signal: null },
      capturedPids,
      tokenPrefix,
    }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    assertResult({ exitCode, receipt, harness }) {
      assert.equal(exitCode, 0);
      assert.equal(receipt.verdict.green, true);
      assert.equal(receipt.reportInspection.complete, true);
      assert.equal(receipt.runnerInteractionFailed, false);
      assert.equal(receipt.lifecycle.complete, true);
      assert.equal(receipt.lifecycle.trigger, 'child-close');
      assert.equal(receipt.lifecycle.childExit.code, 0);
      assert.equal(receipt.lifecycle.termination.complete, true);
      assert.equal(receipt.lifecycle.termination.treeGone, true);
      assert.deepEqual(receipt.lifecycle.termination.remainingPids, []);
      assert.deepEqual(receipt.lifecycle.capturedPids, harness.state.capturedPids);
      assert.equal(receipt.childExit, 0);
      assert.equal(harness.state.child.listenerCount('error'), harness.state.errorListenerBaseline);
    },
  },
  {
    name: 'terminal-report-grace strict green',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'terminal-report-grace-expired',
      childExit: null,
      capturedPids,
      tokenPrefix,
    }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    assertResult({ exitCode, receipt, harness }) {
      assert.equal(exitCode, 0);
      assert.equal(receipt.verdict.green, true);
      assert.equal(receipt.lifecycle.trigger, 'terminal-report-grace-expired');
      assert.equal(receipt.lifecycle.childExit, null);
      assert.equal(receipt.childExit, null);
      assert.equal(receipt.lifecycle.termination.complete, true);
      assert.equal(receipt.lifecycle.termination.treeGone, true);
      assert.deepEqual(receipt.lifecycle.termination.remainingPids, []);
      assert.deepEqual(receipt.lifecycle.capturedPids, harness.state.capturedPids);
    },
  },
  {
    name: 'outer-deadline cleanup',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'outer-deadline',
      childExit: null,
      capturedPids,
      tokenPrefix,
    }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    assertResult({ exitCode, receipt, harness }) {
      assert.equal(exitCode, 1);
      assert.equal(receipt.verdict.green, true);
      assert.equal(receipt.lifecycle.complete, true);
      assert.equal(receipt.lifecycle.trigger, 'outer-deadline');
      assert.equal(receipt.lifecycle.childExit, null);
      assert.equal(receipt.lifecycle.termination.complete, true);
      assert.equal(receipt.lifecycle.termination.treeGone, true);
      assert.deepEqual(receipt.lifecycle.termination.remainingPids, []);
      assert.deepEqual(receipt.lifecycle.capturedPids, harness.state.capturedPids);
      assert.deepEqual(receipt.lifecycle.termination.capturedPids, harness.state.capturedPids);
    },
  },
  {
    name: 'structurally incomplete report',
    reportFactory: makeStructurallyIncompleteReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'child-close',
      childExit: { code: 0, signal: null },
      capturedPids,
      tokenPrefix,
    }),
    stdout: '1 passed\n',
    probeAfterWrite: false,
    expectedInteractionFailure: false,
    assertResult({ exitCode, receipt }) {
      assert.equal(exitCode, 1);
      assert.equal(receipt.source, 'json-report');
      assert.equal(receipt.reportInspection.complete, false);
      assert.equal(receipt.verdict.green, false);
      assert.equal(receipt.lifecycle.trigger, 'child-close');
      assert.equal(receipt.lifecycle.termination.treeGone, true);
      assert.deepEqual(receipt.lifecycle.termination.remainingPids, []);
    },
  },
  {
    name: 'malformed lifecycle result',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, tokenPrefix }) => makeMalformedLifecycle({ rootPid, tokenPrefix }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    assertResult({ exitCode, receipt }) {
      assert.equal(exitCode, 1);
      assert.equal(receipt.verdict.green, true);
      assert.deepEqual(receipt.lifecycle, makeUnavailableLifecycleProjection());
    },
  },
  {
    name: 'unproven termination keeps remaining pids unknown',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeFailedTerminationLifecycle({
      rootPid,
      capturedPids,
      tokenPrefix,
    }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    assertResult({ exitCode, receipt }) {
      assert.equal(exitCode, 1);
      assert.equal(receipt.verdict.green, true);
      assert.equal(receipt.lifecycle.complete, false);
      assert.equal(receipt.lifecycle.termination.complete, false);
      assert.equal(receipt.lifecycle.termination.treeGone, false);
      assert.equal(receipt.lifecycle.termination.remainingPids, null);
    },
  },
  {
    name: 'observed child error',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'child-close',
      childExit: { code: 0, signal: null },
      capturedPids,
      tokenPrefix,
    }),
    emitChildError: true,
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    assertResult({ exitCode, receipt, harness }) {
      assert.equal(exitCode, 1);
      assert.equal(receipt.verdict.green, true);
      assert.equal(receipt.runnerInteractionFailed, false);
      assert.equal(receipt.lifecycle.trigger, 'child-close');
      assert.equal(receipt.lifecycle.termination.treeGone, true);
      assert.deepEqual(receipt.lifecycle.termination.remainingPids, []);
      assert.deepEqual(receipt.lifecycle.capturedPids, harness.state.capturedPids);
      assert.equal(harness.state.child.listenerCount('error'), harness.state.errorListenerBaseline);
    },
  },
  {
    name: 'diagnostic interaction failure preserves lifecycle evidence',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'child-close',
      childExit: { code: 0, signal: null },
      capturedPids,
      tokenPrefix,
    }),
    interactionFailure: true,
    probeAfterWrite: true,
    expectedInteractionFailure: true,
    assertResult({ exitCode, receipt, harness }) {
      assert.equal(exitCode, 1);
      assert.equal(receipt.verdict.green, true);
      assert.equal(receipt.runnerInteractionFailed, true);
      assert.equal(receipt.lifecycle.complete, true);
      assert.equal(receipt.lifecycle.trigger, 'child-close');
      assert.equal(receipt.lifecycle.termination.complete, true);
      assert.equal(receipt.lifecycle.termination.treeGone, true);
      assert.deepEqual(receipt.lifecycle.capturedPids, harness.state.capturedPids);
      assert.equal(harness.state.child.listenerCount('error'), harness.state.errorListenerBaseline);
    },
  },
  {
    name: 'receipt read failure stays red',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'child-close',
      childExit: { code: 0, signal: null },
      capturedPids,
      tokenPrefix,
    }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    expectReceiptVerificationFailure: true,
    expectValidReceipt: true,
    runOptions: () => ({
      readReceiptImpl: () => { throw new Error('injected-readback-secret'); },
    }),
    assertResult({ exitCode, receipt }) {
      assert.equal(exitCode, 1);
      assert.equal(receipt.schemaVersion, 2);
      assert.deepEqual(receipt.lifecycle.termination.remainingPids, []);
    },
  },
  {
    name: 'receipt parse failure stays red',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'child-close',
      childExit: { code: 0, signal: null },
      capturedPids,
      tokenPrefix,
    }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    expectReceiptVerificationFailure: true,
    expectValidReceipt: false,
    runOptions: () => ({ writeJsonAtomicImpl: corruptReceiptWriter('malformed-json') }),
    assertResult({ exitCode }) {
      assert.equal(exitCode, 1);
    },
  },
  {
    name: 'receipt schema corruption stays red',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'child-close',
      childExit: { code: 0, signal: null },
      capturedPids,
      tokenPrefix,
    }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    expectReceiptVerificationFailure: true,
    expectValidReceipt: false,
    runOptions: () => ({ writeJsonAtomicImpl: corruptReceiptWriter('extra-key') }),
    assertResult({ exitCode }) {
      assert.equal(exitCode, 1);
    },
  },
  {
    name: 'receipt content corruption stays red',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'child-close',
      childExit: { code: 0, signal: null },
      capturedPids,
      tokenPrefix,
    }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    expectReceiptVerificationFailure: true,
    expectValidReceipt: true,
    runOptions: () => ({ writeJsonAtomicImpl: corruptReceiptWriter('content-mismatch') }),
    assertResult({ exitCode, receipt }) {
      assert.equal(exitCode, 1);
      assert.equal(receipt.schemaVersion, 2);
    },
  },
  {
    name: 'receipt write failure stays red',
    reportFactory: makeStrictGreenReport,
    lifecycleFactory: ({ rootPid, capturedPids, tokenPrefix }) => makeCompleteLifecycle({
      rootPid,
      trigger: 'child-close',
      childExit: { code: 0, signal: null },
      capturedPids,
      tokenPrefix,
    }),
    probeAfterWrite: true,
    expectedInteractionFailure: false,
    expectReceiptMissing: true,
    runOptions: () => ({ writeJsonAtomicImpl: () => { throw new Error('injected-writeback-secret'); } }),
    assertResult({ exitCode, receipt }) {
      assert.equal(exitCode, 1);
      assert.equal(receipt, null);
    },
  },
];

async function runSelftest() {
  for (let index = 0; index < CASES.length; index += 1) {
    await runCase(CASES[index], index + 1);
  }
  assert.equal(watchdogState.armed, CASES.length);
  assert.equal(watchdogState.cleared, CASES.length);
  assert.equal(watchdogState.fired, 0);
  console.log(`e2e-runner-integration selftest: ${CASES.length}/${CASES.length}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await runSelftest();
  } catch (error) {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  }
}
