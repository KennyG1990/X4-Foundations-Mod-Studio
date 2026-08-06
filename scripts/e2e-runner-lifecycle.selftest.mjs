import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { superviseSpawnedE2eProcess } from './e2e-runner-lifecycle.mjs';

const ROOT_PID = 7401;
const ROOT_TOKEN = '20260804000000.000000-SELFTEST';
const TERMINATION_FAILURE = 'termination-executor-pass-limit';

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

const WATCHDOG_MS = 1000;
const OWNERSHIP_FAILURE_KEYS = [
  'complete',
  'errors',
  'rootIdentity',
  'rootPresent',
  'captured',
  'newlyCaptured',
  'reusedPids',
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

function makeRootIdentity(pid = ROOT_PID, creationToken = ROOT_TOKEN) {
  return {
    pid,
    creationToken,
  };
}

function cloneIdentity(identity) {
  return {
    pid: identity.pid,
    creationToken: identity.creationToken,
  };
}

function makeOwnershipFailureEnvelope() {
  const envelope = {
    complete: false,
    errors: ['spawned-ownership-snapshot-failed'],
    rootIdentity: null,
    rootPresent: false,
    captured: [],
    newlyCaptured: [],
    reusedPids: [],
  };
  assertExactRecordKeys(envelope, OWNERSHIP_FAILURE_KEYS);
  return envelope;
}

function makeCompleteInitialOwnership(rootIdentity) {
  return {
    complete: true,
    errors: [],
    rootIdentity: cloneIdentity(rootIdentity),
    rootPresent: true,
    captured: [cloneIdentity(rootIdentity)],
    newlyCaptured: [cloneIdentity(rootIdentity)],
    reusedPids: [],
  };
}

function makeCompleteSampleOwnership(rootIdentity) {
  return {
    complete: true,
    errors: [],
    rootIdentity: cloneIdentity(rootIdentity),
    rootPresent: true,
    captured: [cloneIdentity(rootIdentity)],
    newlyCaptured: [],
    reusedPids: [],
  };
}

function makeCompleteTermination(rootIdentity) {
  return {
    complete: true,
    errors: [],
    treeGone: true,
    passes: 1,
    captured: [cloneIdentity(rootIdentity)],
    commanded: [cloneIdentity(rootIdentity)],
    reusedPids: [],
  };
}

function makeValidFailureTermination(rootIdentity) {
  return {
    complete: false,
    errors: [TERMINATION_FAILURE],
    treeGone: false,
    passes: 1,
    captured: [cloneIdentity(rootIdentity)],
    commanded: [cloneIdentity(rootIdentity)],
    reusedPids: [],
  };
}

function makeFakeEventEmitterChild(pid) {
  const child = new EventEmitter();
  Object.defineProperty(child, 'pid', {
    value: pid,
    writable: false,
    enumerable: true,
    configurable: false,
  });
  return child;
}

function makeFakeTimerScheduler() {
  let nextHandle = 1;
  let setTimeoutCallCount = 0;
  let clearTimeoutCallCount = 0;
  const records = [];

  const setTimeoutImpl = (callback, delay) => {
    setTimeoutCallCount += 1;
    assert.equal(typeof callback, 'function');
    assert.ok(Number.isFinite(delay));
    const handle = nextHandle;
    nextHandle += 1;
    assert.ok(Number.isSafeInteger(handle));
    records.push({
      handle,
      delay,
      callback,
      active: true,
      cleared: false,
      fired: false,
    });
    return handle;
  };

  const clearTimeoutImpl = (handle) => {
    clearTimeoutCallCount += 1;
    const record = records.find((candidate) => candidate.handle === handle);
    assert.notEqual(record, undefined, `unknown fake timer handle ${String(handle)}`);
    if (record.active) {
      record.active = false;
      record.cleared = true;
    }
  };

  const findLiveTimer = (handle) => {
    const record = records.find((candidate) => candidate.handle === handle);
    assert.notEqual(record, undefined, `unknown fake timer handle ${String(handle)}`);
    assert.equal(record.active, true, `fake timer ${String(handle)} is not live`);
    return record;
  };

  const fire = (handle) => {
    const record = findLiveTimer(handle);
    record.active = false;
    record.fired = true;
    record.callback();
  };

  const snapshot = () => records.map((record) => ({
    handle: record.handle,
    delay: record.delay,
    active: record.active,
    cleared: record.cleared,
    fired: record.fired,
  }));

  return {
    setTimeoutImpl,
    clearTimeoutImpl,
    setTimeoutCalls: () => setTimeoutCallCount,
    clearTimeoutCalls: () => clearTimeoutCallCount,
    fire,
    records: snapshot,
    activeTimers: () => snapshot().filter((record) => record.active),
    clearedTimers: () => snapshot().filter((record) => record.cleared),
    callbacksFired: () => snapshot().filter((record) => record.fired),
  };
}

async function waitForFakeTimerRecord(fixture, description, predicate, maxMicrotasks = 100) {
  assert.equal(typeof predicate, 'function');
  assert.ok(Number.isSafeInteger(maxMicrotasks));
  assert.ok(maxMicrotasks > 0);

  for (let attempt = 0; attempt < maxMicrotasks; attempt += 1) {
    const record = fixture.scheduler.records().find((candidate) => (
      candidate.active && predicate(candidate)
    ));
    if (record !== undefined) {
      return record;
    }
    await Promise.resolve();
  }

  assert.fail(`${description} fake timer was not armed within ${maxMicrotasks} microtask turns`);
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

function makeLifecycleInput({
  rootPid = ROOT_PID,
  childPid = rootPid,
  terminationFactory,
}) {
  assert.equal(typeof terminationFactory, 'function');

  const rootIdentity = makeRootIdentity(rootPid);
  const child = makeFakeEventEmitterChild(childPid);
  const scheduler = makeFakeTimerScheduler();
  const calls = {
    initialize: 0,
    sample: 0,
    probe: 0,
    terminate: 0,
    snapshotExecFile: 0,
    commandExecFile: 0,
    closeListenerCounts: [],
    terminationInput: null,
  };

  const input = {
    child,
    rootPid,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl() {
        calls.snapshotExecFile += 1;
        throw new Error('snapshot process access is forbidden in this selftest');
      },
    },
    commandOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl() {
        calls.commandExecFile += 1;
        throw new Error('termination process access is forbidden in this selftest');
      },
    },
    probeTerminalReport() {
      calls.probe += 1;
      return false;
    },
    overallDeadlineMs: 100,
    terminalGraceMs: 100,
    sampleIntervalMs: 100,
    maxTerminationPasses: 1,
    terminationPollIntervalMs: 0,
    initializeOwnershipImpl() {
      calls.initialize += 1;
      queueMicrotask(() => {
        calls.closeListenerCounts.push({
          close: child.listenerCount('close'),
          error: child.listenerCount('error'),
        });
        child.emit('close', 0, null);
      });
      return makeCompleteInitialOwnership(rootIdentity);
    },
    sampleOwnershipImpl() {
      calls.sample += 1;
      return makeCompleteSampleOwnership(rootIdentity);
    },
    terminateImpl(terminationInput) {
      calls.terminate += 1;
      calls.terminationInput = terminationInput;
      return terminationFactory(rootIdentity);
    },
    setTimeoutImpl: scheduler.setTimeoutImpl,
    clearTimeoutImpl: scheduler.clearTimeoutImpl,
  };

  return {
    input,
    rootIdentity,
    child,
    scheduler,
    calls,
    expectedTermination: terminationFactory(rootIdentity),
  };
}

function assertNoProcessCalls(fixture) {
  assert.equal(fixture.calls.snapshotExecFile, 0);
  assert.equal(fixture.calls.commandExecFile, 0);
}

function assertInvalidInputResult(result) {
  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: false,
    errors: ['e2e-lifecycle-invalid-input'],
    trigger: null,
    childExit: null,
    ownershipComplete: false,
    rootIdentity: null,
    captured: [],
    reusedPids: [],
    termination: null,
  });
}

function assertNoLifecycleSideEffects(fixture) {
  assert.equal(fixture.calls.initialize, 0);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.probe, 0);
  assert.equal(fixture.calls.terminate, 0);
  assertNoProcessCalls(fixture);
  assert.equal(fixture.scheduler.setTimeoutCalls(), 0);
  assert.equal(fixture.scheduler.clearTimeoutCalls(), 0);
  assert.deepEqual(fixture.scheduler.records(), []);
  assert.deepEqual(fixture.calls.closeListenerCounts, []);
  assert.equal(fixture.child.listenerCount('close'), 0);
  assert.equal(fixture.child.listenerCount('error'), 0);
}

function assertLifecycleCleanup(fixture, expectedTimerRecords = [{
  handle: 1,
  delay: 100,
  active: false,
  cleared: true,
  fired: false,
}]) {
  assert.equal(fixture.child.listenerCount('close'), 0);
  assert.equal(fixture.child.listenerCount('error'), 0);
  assert.deepEqual(fixture.scheduler.activeTimers(), []);
  assert.equal(fixture.scheduler.records().every((record) => (
    Number.isSafeInteger(record.handle) && Number.isFinite(record.delay)
  )), true);
  assert.deepEqual(fixture.scheduler.records(), expectedTimerRecords);
  assert.deepEqual(
    fixture.scheduler.callbacksFired(),
    expectedTimerRecords.filter((record) => record.fired),
  );
  assert.deepEqual(
    fixture.scheduler.clearedTimers(),
    expectedTimerRecords.filter((record) => record.cleared),
  );
}

function assertWatchdogClearedWithoutFiring(watchdogsBefore) {
  assert.equal(watchdogState.armed, watchdogsBefore.armed + 1);
  assert.equal(watchdogState.cleared, watchdogsBefore.cleared + 1);
  assert.equal(watchdogState.fired, watchdogsBefore.fired);
}

function overrideStrictInitialOwnership(fixture, afterInitialization) {
  assert.ok(afterInitialization === undefined || typeof afterInitialization === 'function');
  fixture.input.initializeOwnershipImpl = () => {
    fixture.calls.initialize += 1;
    if (afterInitialization !== undefined) {
      queueMicrotask(afterInitialization);
    }
    return makeCompleteInitialOwnership(fixture.rootIdentity);
  };
}

function assertTerminationInput(fixture) {
  assertExactRecordKeys(fixture.calls.terminationInput, [
    'rootIdentity',
    'previousCaptured',
    'snapshotOptions',
    'commandOptions',
    'maxPasses',
    'pollIntervalMs',
  ]);
  assert.deepEqual(fixture.calls.terminationInput, {
    rootIdentity: fixture.rootIdentity,
    previousCaptured: [fixture.rootIdentity],
    snapshotOptions: fixture.input.snapshotOptions,
    commandOptions: fixture.input.commandOptions,
    maxPasses: 1,
    pollIntervalMs: 0,
  });
  assert.notStrictEqual(fixture.calls.terminationInput.rootIdentity, fixture.rootIdentity);
  assert.notStrictEqual(fixture.calls.terminationInput.previousCaptured[0], fixture.rootIdentity);
}

async function runInvalidInputCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    rootPid: 0,
    childPid: ROOT_PID,
    terminationFactory: makeCompleteTermination,
  });
  const result = await withWatchdog('invalid input', () => (
    superviseSpawnedE2eProcess(fixture.input)
  ));

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: false,
    errors: ['e2e-lifecycle-invalid-input'],
    trigger: null,
    childExit: null,
    ownershipComplete: false,
    rootIdentity: null,
    captured: [],
    reusedPids: [],
    termination: null,
  });
  assert.equal(fixture.calls.initialize, 0);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.probe, 0);
  assert.equal(fixture.calls.terminate, 0);
  assertNoProcessCalls(fixture);
  assert.equal(fixture.scheduler.records().length, 0);
  assert.equal(fixture.child.listenerCount('close'), 0);
  assert.equal(fixture.child.listenerCount('error'), 0);
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

async function runNormalChildCloseCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeCompleteTermination,
  });
  const result = await withWatchdog('normal child close/tree gone', () => (
    superviseSpawnedE2eProcess(fixture.input)
  ));

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: true,
    errors: [],
    trigger: 'child-close',
    childExit: { code: 0, signal: null },
    ownershipComplete: true,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  assert.deepEqual(fixture.calls.closeListenerCounts, [{ close: 1, error: 1 }]);
  assert.equal(fixture.calls.initialize, 1);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.probe, 1);
  assert.equal(fixture.calls.terminate, 1);
  assertNoProcessCalls(fixture);
  assertTerminationInput(fixture);
  assertLifecycleCleanup(fixture);
  assert.notStrictEqual(result.rootIdentity, result.captured[0]);
  assert.notStrictEqual(result.captured[0], result.termination.captured[0]);
  result.rootIdentity.creationToken = 'mutated-result-root';
  result.captured[0].creationToken = 'mutated-result-captured';
  result.termination.captured[0].creationToken = 'mutated-result-termination';
  assert.deepEqual(fixture.rootIdentity, makeRootIdentity());
  assert.deepEqual(fixture.expectedTermination, makeCompleteTermination(fixture.rootIdentity));
  assert.equal(watchdogState.armed, watchdogsBefore.armed + 1);
  assert.equal(watchdogState.cleared, watchdogsBefore.cleared + 1);
  assert.equal(watchdogState.fired, watchdogsBefore.fired);
}

async function runTerminationFailureCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeValidFailureTermination,
  });
  const result = await withWatchdog('valid termination failure/tree remains', () => (
    superviseSpawnedE2eProcess(fixture.input)
  ));

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: false,
    errors: ['e2e-lifecycle-termination-failed'],
    trigger: 'child-close',
    childExit: { code: 0, signal: null },
    ownershipComplete: true,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  assert.deepEqual(result.errors, ['e2e-lifecycle-termination-failed']);
  assert.deepEqual(result.termination, {
    complete: false,
    errors: [TERMINATION_FAILURE],
    treeGone: false,
    passes: 1,
    captured: [fixture.rootIdentity],
    commanded: [fixture.rootIdentity],
    reusedPids: [],
  });
  assert.deepEqual(fixture.calls.closeListenerCounts, [{ close: 1, error: 1 }]);
  assert.equal(fixture.calls.initialize, 1);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.probe, 1);
  assert.equal(fixture.calls.terminate, 1);
  assertNoProcessCalls(fixture);
  assertTerminationInput(fixture);
  assertLifecycleCleanup(fixture);
  assert.notStrictEqual(result.termination, fixture.expectedTermination);
  assert.equal(watchdogState.armed, watchdogsBefore.armed + 1);
  assert.equal(watchdogState.cleared, watchdogsBefore.cleared + 1);
  assert.equal(watchdogState.fired, watchdogsBefore.fired);
}

async function runTerminalReportGraceCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeCompleteTermination,
  });
  fixture.input.overallDeadlineMs = 300;
  fixture.input.terminalGraceMs = 200;
  fixture.input.sampleIntervalMs = 100;
  overrideStrictInitialOwnership(fixture);
  fixture.input.probeTerminalReport = () => {
    fixture.calls.probe += 1;
    return true;
  };

  const result = await withWatchdog('terminal report grace expiry', async () => {
    const lifecyclePromise = superviseSpawnedE2eProcess(fixture.input);
    const outerDeadlineTimer = await waitForFakeTimerRecord(
      fixture,
      'terminal report outer deadline',
      (record) => record.delay === fixture.input.overallDeadlineMs,
    );
    const graceTimer = await waitForFakeTimerRecord(
      fixture,
      'terminal report grace',
      (record) => (
        record.delay === fixture.input.terminalGraceMs
        && record.handle !== outerDeadlineTimer.handle
      ),
    );
    assert.equal(outerDeadlineTimer.active, true);
    assert.equal(graceTimer.active, true);
    fixture.scheduler.fire(graceTimer.handle);
    return lifecyclePromise;
  });

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: true,
    errors: [],
    trigger: 'terminal-report-grace-expired',
    childExit: null,
    ownershipComplete: true,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  assert.equal(fixture.calls.initialize, 1);
  assert.equal(fixture.calls.probe, 1);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.terminate, 1);
  assertNoProcessCalls(fixture);
  assertTerminationInput(fixture);
  assertLifecycleCleanup(fixture, [
    {
      handle: 1,
      delay: 300,
      active: false,
      cleared: true,
      fired: false,
    },
    {
      handle: 2,
      delay: 200,
      active: false,
      cleared: false,
      fired: true,
    },
    {
      handle: 3,
      delay: 100,
      active: false,
      cleared: true,
      fired: false,
    },
  ]);
  assert.equal(fixture.calls.closeListenerCounts.length, 0);
  assert.equal(fixture.calls.terminationInput.rootIdentity.pid, ROOT_PID);
  assert.deepEqual(fixture.expectedTermination, makeCompleteTermination(fixture.rootIdentity));
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

async function runOuterDeadlineCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeCompleteTermination,
  });
  fixture.input.overallDeadlineMs = 200;
  fixture.input.sampleIntervalMs = 100;
  overrideStrictInitialOwnership(fixture);
  fixture.input.probeTerminalReport = () => {
    fixture.calls.probe += 1;
    return false;
  };

  const result = await withWatchdog('outer deadline lifecycle cleanup', async () => {
    const lifecyclePromise = superviseSpawnedE2eProcess(fixture.input);
    const outerDeadlineTimer = await waitForFakeTimerRecord(
      fixture,
      'outer deadline',
      (record) => record.delay === fixture.input.overallDeadlineMs,
    );
    const sampleDelayTimer = await waitForFakeTimerRecord(
      fixture,
      'sample delay',
      (record) => (
        record.delay === fixture.input.sampleIntervalMs
        && record.handle !== outerDeadlineTimer.handle
      ),
    );
    assert.equal(outerDeadlineTimer.active, true);
    assert.equal(sampleDelayTimer.active, true);
    fixture.scheduler.fire(outerDeadlineTimer.handle);
    return lifecyclePromise;
  });

  // This is lifecycle cleanup completion only; the later runner verdict must make outer-deadline red.
  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: true,
    errors: [],
    trigger: 'outer-deadline',
    childExit: null,
    ownershipComplete: true,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  assert.equal(fixture.calls.initialize, 1);
  assert.equal(fixture.calls.probe, 1);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.terminate, 1);
  assertNoProcessCalls(fixture);
  assertTerminationInput(fixture);
  assertLifecycleCleanup(fixture, [
    {
      handle: 1,
      delay: 200,
      active: false,
      cleared: false,
      fired: true,
    },
    {
      handle: 2,
      delay: 100,
      active: false,
      cleared: true,
      fired: false,
    },
  ]);
  assert.equal(fixture.calls.closeListenerCounts.length, 0);
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

async function runChildErrorCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeCompleteTermination,
  });
  overrideStrictInitialOwnership(fixture, () => {
    fixture.calls.closeListenerCounts.push({
      close: fixture.child.listenerCount('close'),
      error: fixture.child.listenerCount('error'),
    });
    fixture.child.emit('error', new Error('do-not-leak-secret'));
  });

  const result = await withWatchdog('child error', () => (
    superviseSpawnedE2eProcess(fixture.input)
  ));

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: false,
    errors: ['e2e-lifecycle-child-error'],
    trigger: 'child-error',
    childExit: null,
    ownershipComplete: true,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  const serializedResult = JSON.stringify(result);
  assert.equal(serializedResult.includes('do-not-leak-secret'), false);
  assert.equal(serializedResult.includes('Error: do-not-leak-secret'), false);
  assert.deepEqual(fixture.calls.closeListenerCounts, [{ close: 1, error: 1 }]);
  assert.equal(fixture.calls.initialize, 1);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.terminate, 1);
  assertNoProcessCalls(fixture);
  assertTerminationInput(fixture);
  assertLifecycleCleanup(fixture);
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

async function runInitializationOwnershipFailureRecoveryCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeCompleteTermination,
  });
  fixture.input.overallDeadlineMs = 300;
  fixture.input.sampleIntervalMs = 100;
  fixture.input.initializeOwnershipImpl = () => {
    fixture.calls.initialize += 1;
    if (fixture.calls.initialize === 1) {
      return makeOwnershipFailureEnvelope();
    }

    queueMicrotask(() => {
      fixture.calls.closeListenerCounts.push({
        close: fixture.child.listenerCount('close'),
        error: fixture.child.listenerCount('error'),
      });
      fixture.child.emit('close', 0, null);
    });
    return makeCompleteInitialOwnership(fixture.rootIdentity);
  };

  const result = await withWatchdog('initialization ownership failure then recovery', async () => {
    const lifecyclePromise = superviseSpawnedE2eProcess(fixture.input);
    const outerDeadlineTimer = await waitForFakeTimerRecord(
      fixture,
      'initialization failure outer deadline',
      (record) => record.delay === fixture.input.overallDeadlineMs,
    );
    const firstSampleDelayTimer = await waitForFakeTimerRecord(
      fixture,
      'initialization failure retry sample delay',
      (record) => (
        record.delay === fixture.input.sampleIntervalMs
        && record.handle !== outerDeadlineTimer.handle
      ),
    );
    fixture.scheduler.fire(firstSampleDelayTimer.handle);
    return lifecyclePromise;
  });

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: false,
    errors: ['e2e-lifecycle-ownership-incomplete'],
    trigger: 'child-close',
    childExit: { code: 0, signal: null },
    ownershipComplete: false,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  assert.deepEqual(fixture.calls.closeListenerCounts, [{ close: 1, error: 1 }]);
  assert.equal(fixture.calls.initialize, 2);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.probe, 2);
  assert.equal(fixture.calls.terminate, 1);
  assertNoProcessCalls(fixture);
  assertTerminationInput(fixture);
  assertLifecycleCleanup(fixture, [
    {
      handle: 1,
      delay: 300,
      active: false,
      cleared: true,
      fired: false,
    },
    {
      handle: 2,
      delay: 100,
      active: false,
      cleared: false,
      fired: true,
    },
  ]);
  assert.deepEqual(fixture.expectedTermination, makeCompleteTermination(fixture.rootIdentity));
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

async function runSampleOwnershipFailureAfterInitializationCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeCompleteTermination,
  });
  fixture.input.overallDeadlineMs = 300;
  fixture.input.sampleIntervalMs = 100;
  fixture.input.initializeOwnershipImpl = () => {
    fixture.calls.initialize += 1;
    return makeCompleteInitialOwnership(fixture.rootIdentity);
  };
  fixture.input.sampleOwnershipImpl = () => {
    fixture.calls.sample += 1;
    queueMicrotask(() => {
      fixture.calls.closeListenerCounts.push({
        close: fixture.child.listenerCount('close'),
        error: fixture.child.listenerCount('error'),
      });
      fixture.child.emit('close', 0, null);
    });
    return makeOwnershipFailureEnvelope();
  };

  const result = await withWatchdog('sample ownership failure after initialization', async () => {
    const lifecyclePromise = superviseSpawnedE2eProcess(fixture.input);
    const outerDeadlineTimer = await waitForFakeTimerRecord(
      fixture,
      'sample failure outer deadline',
      (record) => record.delay === fixture.input.overallDeadlineMs,
    );
    const sampleDelayTimer = await waitForFakeTimerRecord(
      fixture,
      'sample failure sample delay',
      (record) => (
        record.delay === fixture.input.sampleIntervalMs
        && record.handle !== outerDeadlineTimer.handle
      ),
    );
    fixture.scheduler.fire(sampleDelayTimer.handle);
    return lifecyclePromise;
  });

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: false,
    errors: ['e2e-lifecycle-ownership-incomplete'],
    trigger: 'child-close',
    childExit: { code: 0, signal: null },
    ownershipComplete: false,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  assert.deepEqual(fixture.calls.closeListenerCounts, [{ close: 1, error: 1 }]);
  assert.equal(fixture.calls.initialize, 1);
  assert.equal(fixture.calls.sample, 1);
  assert.equal(fixture.calls.probe, 2);
  assert.equal(fixture.calls.terminate, 1);
  assertNoProcessCalls(fixture);
  assertTerminationInput(fixture);
  assertLifecycleCleanup(fixture, [
    {
      handle: 1,
      delay: 300,
      active: false,
      cleared: true,
      fired: false,
    },
    {
      handle: 2,
      delay: 100,
      active: false,
      cleared: false,
      fired: true,
    },
  ]);
  assert.deepEqual(fixture.expectedTermination, makeCompleteTermination(fixture.rootIdentity));
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

async function runOuterTimerSetupFailureCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeCompleteTermination,
  });
  let timerSetupCalls = 0;
  fixture.input.setTimeoutImpl = () => {
    timerSetupCalls += 1;
    throw new Error('timer-secret');
  };

  const result = await withWatchdog('outer timer setup failure', () => (
    superviseSpawnedE2eProcess(fixture.input)
  ));

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: false,
    errors: ['e2e-lifecycle-timer-failed'],
    trigger: 'outer-deadline',
    childExit: null,
    ownershipComplete: true,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  assert.equal(timerSetupCalls, 1);
  assert.deepEqual(fixture.calls.closeListenerCounts, [{ close: 1, error: 1 }]);
  assert.equal(fixture.calls.initialize, 1);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.probe, 1);
  assert.equal(fixture.calls.terminate, 1);
  assertNoProcessCalls(fixture);
  assertTerminationInput(fixture);
  const serializedResult = JSON.stringify(result);
  assert.equal(serializedResult.includes('timer-secret'), false);
  assert.equal(serializedResult.includes('Error: timer-secret'), false);
  assert.deepEqual(fixture.scheduler.records(), []);
  assert.deepEqual(fixture.scheduler.activeTimers(), []);
  assert.deepEqual(fixture.scheduler.clearedTimers(), []);
  assert.deepEqual(fixture.scheduler.callbacksFired(), []);
  assert.equal(fixture.child.listenerCount('close'), 0);
  assert.equal(fixture.child.listenerCount('error'), 0);
  assert.equal(result.termination.treeGone, true);
  assert.deepEqual(fixture.expectedTermination, makeCompleteTermination(fixture.rootIdentity));
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

async function runDuplicateAndLateChildCallbacksCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeCompleteTermination,
  });
  let capturedCloseListener;
  let capturedErrorListener;
  fixture.input.initializeOwnershipImpl = () => {
    fixture.calls.initialize += 1;
    const closeListeners = fixture.child.listeners('close');
    const errorListeners = fixture.child.listeners('error');
    assert.equal(closeListeners.length, 1);
    assert.equal(errorListeners.length, 1);
    capturedCloseListener = closeListeners[0];
    capturedErrorListener = errorListeners[0];
    queueMicrotask(() => {
      fixture.calls.closeListenerCounts.push({
        close: fixture.child.listenerCount('close'),
        error: fixture.child.listenerCount('error'),
      });
      fixture.child.emit('close', 0, null);
      fixture.child.emit('error', new Error('duplicate-secret'));
    });
    return makeCompleteInitialOwnership(fixture.rootIdentity);
  };

  const result = await withWatchdog('duplicate and late child callbacks', () => (
    superviseSpawnedE2eProcess(fixture.input)
  ));

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: true,
    errors: [],
    trigger: 'child-close',
    childExit: { code: 0, signal: null },
    ownershipComplete: true,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  assert.equal(typeof capturedCloseListener, 'function');
  assert.equal(typeof capturedErrorListener, 'function');
  assert.deepEqual(fixture.calls.closeListenerCounts, [{ close: 1, error: 1 }]);
  assert.equal(fixture.calls.initialize, 1);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.probe, 1);
  assert.equal(fixture.calls.terminate, 1);
  assertNoProcessCalls(fixture);
  assertTerminationInput(fixture);
  const resultBeforeLateCallbacks = JSON.parse(JSON.stringify(result));
  const timerRecordsBeforeLateCallbacks = fixture.scheduler.records();
  assert.equal(fixture.child.listenerCount('close'), 0);
  assert.equal(fixture.child.listenerCount('error'), 0);
  assert.deepEqual(fixture.scheduler.activeTimers(), []);
  assert.doesNotThrow(() => {
    capturedCloseListener(0, null);
    capturedErrorListener(new Error('duplicate-secret'));
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(result, resultBeforeLateCallbacks);
  assert.equal(JSON.stringify(result).includes('duplicate-secret'), false);
  assert.equal(fixture.calls.terminate, 1);
  assert.deepEqual(fixture.scheduler.records(), timerRecordsBeforeLateCallbacks);
  assertLifecycleCleanup(fixture);
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

async function runHostileInputRejectionCase() {
  const watchdogsBefore = { ...watchdogState };
  await withWatchdog('hostile input rejection', async () => {
    const variants = [
      () => {
        const fixture = makeLifecycleInput({
          terminationFactory: makeCompleteTermination,
        });
        return {
          fixture,
          input: new Proxy(fixture.input, {}),
          assertVariant: () => {},
        };
      },
      () => {
        const fixture = makeLifecycleInput({
          terminationFactory: makeCompleteTermination,
        });
        let rootPidGetterCalls = 0;
        Object.defineProperty(fixture.input, 'rootPid', {
          configurable: true,
          enumerable: true,
          get() {
            rootPidGetterCalls += 1;
            return ROOT_PID;
          },
        });
        return {
          fixture,
          input: fixture.input,
          assertVariant: () => assert.equal(rootPidGetterCalls, 0),
        };
      },
      () => {
        const fixture = makeLifecycleInput({
          terminationFactory: makeCompleteTermination,
        });
        fixture.input[Symbol('unknown-lifecycle-key')] = true;
        return {
          fixture,
          input: fixture.input,
          assertVariant: () => {},
        };
      },
      () => {
        const fixture = makeLifecycleInput({
          terminationFactory: makeCompleteTermination,
        });
        fixture.input.snapshotOptions = new Proxy(fixture.input.snapshotOptions, {});
        return {
          fixture,
          input: fixture.input,
          assertVariant: () => {},
        };
      },
      () => {
        const fixture = makeLifecycleInput({
          terminationFactory: makeCompleteTermination,
        });
        fixture.input.child = new Proxy(fixture.child, {});
        return {
          fixture,
          input: fixture.input,
          assertVariant: () => {},
        };
      },
      () => {
        const fixture = makeLifecycleInput({
          terminationFactory: makeCompleteTermination,
        });
        fixture.input.unknownLifecycleKey = true;
        return {
          fixture,
          input: fixture.input,
          assertVariant: () => {},
        };
      },
    ];

    for (const makeVariant of variants) {
      const variant = makeVariant();
      const result = await superviseSpawnedE2eProcess(variant.input);
      assertInvalidInputResult(result);
      assertNoLifecycleSideEffects(variant.fixture);
      variant.assertVariant();
    }
  });
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

async function runBidirectionalMutationIsolationCase() {
  const watchdogsBefore = { ...watchdogState };
  const fixture = makeLifecycleInput({
    terminationFactory: makeCompleteTermination,
  });
  fixture.input.overallDeadlineMs = 321;
  fixture.input.terminalGraceMs = 322;
  fixture.input.sampleIntervalMs = 323;
  fixture.input.maxTerminationPasses = 1;
  fixture.input.terminationPollIntervalMs = 0;

  const originalRootPid = fixture.input.rootPid;
  const originalRootIdentity = makeRootIdentity(originalRootPid);
  const originalSnapshotOptions = { ...fixture.input.snapshotOptions };
  const originalCommandOptions = { ...fixture.input.commandOptions };
  const originalBounds = {
    overallDeadlineMs: fixture.input.overallDeadlineMs,
    terminalGraceMs: fixture.input.terminalGraceMs,
    sampleIntervalMs: fixture.input.sampleIntervalMs,
    maxTerminationPasses: fixture.input.maxTerminationPasses,
    terminationPollIntervalMs: fixture.input.terminationPollIntervalMs,
  };
  let initializationRequest = null;
  let initializationPristine = null;
  let terminationPristine = null;
  let terminationReturn = null;
  let callerProbeCalls = 0;
  let callerSnapshotExecCalls = 0;
  let callerCommandExecCalls = 0;

  const cloneTerminationInput = (terminationInput) => ({
    rootIdentity: cloneIdentity(terminationInput.rootIdentity),
    previousCaptured: terminationInput.previousCaptured.map(cloneIdentity),
    snapshotOptions: { ...terminationInput.snapshotOptions },
    commandOptions: { ...terminationInput.commandOptions },
    maxPasses: terminationInput.maxPasses,
    pollIntervalMs: terminationInput.pollIntervalMs,
  });

  fixture.input.initializeOwnershipImpl = (request) => {
    fixture.calls.initialize += 1;
    initializationRequest = request;
    initializationPristine = {
      rootPid: request.rootPid,
      snapshotOptions: { ...request.snapshotOptions },
    };
    request.rootPid = originalRootPid + 11;
    request.snapshotOptions.platform = 'linux';
    request.snapshotOptions.timeoutMs = 101;
    request.snapshotOptions.execFileImpl = () => {};
    queueMicrotask(() => {
      fixture.calls.closeListenerCounts.push({
        close: fixture.child.listenerCount('close'),
        error: fixture.child.listenerCount('error'),
      });
      fixture.child.emit('close', 0, null);
    });
    return makeCompleteInitialOwnership(fixture.rootIdentity);
  };

  fixture.input.terminateImpl = (terminationInput) => {
    fixture.calls.terminate += 1;
    fixture.calls.terminationInput = terminationInput;
    terminationPristine = cloneTerminationInput(terminationInput);
    terminationInput.rootIdentity.pid = originalRootPid + 22;
    terminationInput.rootIdentity.creationToken = '20260804000000.000022-SELFTEST';
    terminationInput.previousCaptured[0].pid = originalRootPid + 23;
    terminationInput.previousCaptured[0].creationToken = '20260804000000.000023-SELFTEST';
    terminationInput.previousCaptured.push(makeRootIdentity(originalRootPid + 24));
    terminationInput.snapshotOptions.platform = 'linux';
    terminationInput.snapshotOptions.timeoutMs = 102;
    terminationInput.snapshotOptions.execFileImpl = () => {};
    terminationInput.commandOptions.platform = 'darwin';
    terminationInput.commandOptions.timeoutMs = 103;
    terminationInput.commandOptions.execFileImpl = () => {};
    terminationInput.maxPasses = 99;
    terminationInput.pollIntervalMs = 99;
    terminationReturn = makeCompleteTermination(fixture.rootIdentity);
    assertExactRecordKeys(terminationReturn, [
      'complete',
      'errors',
      'treeGone',
      'passes',
      'captured',
      'commanded',
      'reusedPids',
    ]);
    return terminationReturn;
  };

  const result = await withWatchdog('bidirectional mutation isolation', async () => {
    const lifecyclePromise = superviseSpawnedE2eProcess(fixture.input);
    fixture.input.rootPid = originalRootPid + 31;
    fixture.input.overallDeadlineMs = 901;
    fixture.input.terminalGraceMs = 902;
    fixture.input.sampleIntervalMs = 903;
    fixture.input.maxTerminationPasses = 9;
    fixture.input.terminationPollIntervalMs = 9;
    fixture.input.probeTerminalReport = () => {
      callerProbeCalls += 1;
      return true;
    };
    fixture.input.snapshotOptions.platform = 'linux';
    fixture.input.snapshotOptions.timeoutMs = 104;
    fixture.input.snapshotOptions.execFileImpl = () => {
      callerSnapshotExecCalls += 1;
    };
    fixture.input.commandOptions.platform = 'darwin';
    fixture.input.commandOptions.timeoutMs = 105;
    fixture.input.commandOptions.execFileImpl = () => {
      callerCommandExecCalls += 1;
    };
    return lifecyclePromise;
  });

  assertExactRecordKeys(result, LIFECYCLE_RESULT_KEYS);
  assert.deepEqual(result, {
    complete: true,
    errors: [],
    trigger: 'child-close',
    childExit: { code: 0, signal: null },
    ownershipComplete: true,
    rootIdentity: fixture.rootIdentity,
    captured: [fixture.rootIdentity],
    reusedPids: [],
    termination: fixture.expectedTermination,
  });
  assert.equal(initializationRequest === null, false);
  assert.equal(initializationPristine === null, false);
  assert.equal(terminationPristine === null, false);
  assert.equal(terminationReturn === null, false);
  assert.notStrictEqual(initializationRequest, fixture.input);
  assert.notStrictEqual(initializationRequest.snapshotOptions, fixture.input.snapshotOptions);
  assert.notStrictEqual(initializationRequest.snapshotOptions, originalSnapshotOptions);
  assert.equal(initializationRequest.rootPid, originalRootPid + 11);
  assert.equal(initializationRequest.snapshotOptions.platform, 'linux');
  assert.deepEqual(initializationPristine, {
    rootPid: originalRootPid,
    snapshotOptions: originalSnapshotOptions,
  });
  assert.deepEqual(terminationPristine, {
    rootIdentity: originalRootIdentity,
    previousCaptured: [originalRootIdentity],
    snapshotOptions: originalSnapshotOptions,
    commandOptions: originalCommandOptions,
    maxPasses: originalBounds.maxTerminationPasses,
    pollIntervalMs: originalBounds.terminationPollIntervalMs,
  });
  assert.notStrictEqual(terminationPristine.rootIdentity, fixture.rootIdentity);
  assert.notStrictEqual(terminationPristine.previousCaptured[0], fixture.rootIdentity);
  assert.notStrictEqual(terminationReturn, fixture.expectedTermination);
  assert.deepEqual(terminationReturn, makeCompleteTermination(fixture.rootIdentity));
  assert.equal(fixture.calls.initialize, 1);
  assert.equal(fixture.calls.sample, 0);
  assert.equal(fixture.calls.probe, 1);
  assert.equal(fixture.calls.terminate, 1);
  assert.equal(callerProbeCalls, 0);
  assert.equal(callerSnapshotExecCalls, 0);
  assert.equal(callerCommandExecCalls, 0);
  assertNoProcessCalls(fixture);
  assert.deepEqual(fixture.calls.closeListenerCounts, [{ close: 1, error: 1 }]);
  assert.equal(fixture.scheduler.setTimeoutCalls(), 1);
  assert.equal(fixture.scheduler.clearTimeoutCalls(), 1);
  assert.equal(fixture.scheduler.records()[0].delay, originalBounds.overallDeadlineMs);
  assertLifecycleCleanup(fixture, [{
    handle: 1,
    delay: originalBounds.overallDeadlineMs,
    active: false,
    cleared: true,
    fired: false,
  }]);
  assert.deepEqual(fixture.rootIdentity, originalRootIdentity);
  assert.deepEqual(fixture.expectedTermination, makeCompleteTermination(fixture.rootIdentity));
  assert.equal(result.rootIdentity === fixture.rootIdentity, false);
  assert.equal(result.captured[0] === fixture.rootIdentity, false);
  assert.equal(result.termination === terminationReturn, false);

  const fixtureRootBeforeResultMutation = cloneIdentity(fixture.rootIdentity);
  const expectedTerminationBeforeResultMutation = makeCompleteTermination(fixture.rootIdentity);
  const initializationPristineBeforeResultMutation = {
    rootPid: initializationPristine.rootPid,
    snapshotOptions: { ...initializationPristine.snapshotOptions },
  };
  const terminationPristineBeforeResultMutation = cloneTerminationInput(terminationPristine);
  result.rootIdentity.pid = originalRootPid + 41;
  result.captured[0].pid = originalRootPid + 42;
  result.captured.push(makeRootIdentity(originalRootPid + 43));
  result.termination.errors.length = 0;
  result.termination.treeGone = false;
  result.termination.captured[0].pid = originalRootPid + 44;
  result.termination.commanded[0].pid = originalRootPid + 45;
  assert.deepEqual(fixture.rootIdentity, fixtureRootBeforeResultMutation);
  assert.deepEqual(fixture.expectedTermination, expectedTerminationBeforeResultMutation);
  assert.deepEqual(initializationPristine, initializationPristineBeforeResultMutation);
  assert.deepEqual(terminationPristine, terminationPristineBeforeResultMutation);
  assertWatchdogClearedWithoutFiring(watchdogsBefore);
}

const cases = [
  ['invalid input', runInvalidInputCase],
  ['normal child close/tree gone', runNormalChildCloseCase],
  ['valid termination failure/tree remains', runTerminationFailureCase],
  ['terminal report grace expiry', runTerminalReportGraceCase],
  ['outer deadline lifecycle cleanup', runOuterDeadlineCase],
  ['child error', runChildErrorCase],
  ['initialization ownership failure then recovery', runInitializationOwnershipFailureRecoveryCase],
  ['sample ownership failure after initialization', runSampleOwnershipFailureAfterInitializationCase],
  ['outer timer setup failure', runOuterTimerSetupFailureCase],
  ['duplicate and late child callbacks', runDuplicateAndLateChildCallbacksCase],
  ['hostile input rejection', runHostileInputRejectionCase],
  ['bidirectional mutation isolation', runBidirectionalMutationIsolationCase],
];

let passed = 0;
for (const [name, runCase] of cases) {
  try {
    await runCase();
    passed += 1;
    console.log(`[e2e-runner-lifecycle selftest] ${name}: PASS`);
  } catch (error) {
    console.error(`[e2e-runner-lifecycle selftest] ${name}: FAIL`);
    console.error(error);
  }
}

console.log(`[e2e-runner-lifecycle selftest] ${passed}/${cases.length}`);
if (passed !== cases.length) {
  process.exitCode = 1;
}
