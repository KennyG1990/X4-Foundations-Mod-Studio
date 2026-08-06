import assert from 'node:assert/strict';

import { prepareStableCapturedProcessTerminationStep } from './e2e-process-termination-step.mjs';

const root = { pid: 10, creationToken: '20260802043333.860108-240' };
const previousCaptured = [root];
const wmicHeader = 'Node,CreationDate,ParentProcessId,ProcessId';
const outputKeys = [
  'complete',
  'errors',
  'rootPresent',
  'treeGone',
  'replanRequired',
  'captured',
  'newlyCaptured',
  'target',
  'reusedPids',
];

function wmicCsv(...rows) {
  return [wmicHeader, ...rows].join('\n');
}

async function checkFirstGone() {
  let callbackCalls = 0;
  const result = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        callback(null, wmicCsv('DESKTOP-SELFTEST,20260802043333.860108-240,4,99'));
        return { kill() {} };
      },
    },
  });

  assert.equal(callbackCalls, 1);
  assert.deepEqual(result, {
    complete: true,
    errors: [],
    rootPresent: false,
    treeGone: true,
    replanRequired: false,
    captured: [root],
    newlyCaptured: [],
    target: null,
    reusedPids: [],
  });
  return result;
}

async function checkStableRoot() {
  let callbackCalls = 0;
  const rootRow = 'DESKTOP-SELFTEST,20260802043333.860108-240,4,10';
  const result = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        callback(null, wmicCsv(rootRow));
        return { kill() {} };
      },
    },
  });

  assert.equal(callbackCalls, 2);
  assert.deepEqual(result, {
    complete: true,
    errors: [],
    rootPresent: true,
    treeGone: false,
    replanRequired: false,
    captured: [root],
    newlyCaptured: [],
    target: root,
    reusedPids: [],
  });
  assert.notStrictEqual(result.target, root);
  return result;
}

async function checkNewChildReplan() {
  let callbackCalls = 0;
  const rootRow = 'DESKTOP-SELFTEST,20260802043333.860108-240,4,10';
  const child = { pid: 11, creationToken: '20260802043334.860108-240' };
  const childRow = `DESKTOP-SELFTEST,${child.creationToken},10,${child.pid}`;
  const result = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        callback(null, callbackCalls === 1
          ? wmicCsv(rootRow)
          : wmicCsv(rootRow, childRow));
        return { kill() {} };
      },
    },
  });

  assert.equal(callbackCalls, 2);
  assert.deepEqual(result, {
    complete: true,
    errors: [],
    rootPresent: true,
    treeGone: false,
    replanRequired: true,
    captured: [root, child],
    newlyCaptured: [child],
    target: null,
    reusedPids: [],
  });
  return result;
}

async function checkSecondSnapshotGone() {
  let callbackCalls = 0;
  const rootRow = 'DESKTOP-SELFTEST,20260802043333.860108-240,4,10';
  const unrelatedRow = 'DESKTOP-SELFTEST,20260802043333.860108-240,4,99';
  const result = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        callback(null, callbackCalls === 1
          ? wmicCsv(rootRow)
          : wmicCsv(unrelatedRow));
        return { kill() {} };
      },
    },
  });

  assert.equal(callbackCalls, 2);
  assert.deepEqual(result, {
    complete: true,
    errors: [],
    rootPresent: false,
    treeGone: true,
    replanRequired: false,
    captured: [root],
    newlyCaptured: [],
    target: null,
    reusedPids: [],
  });
  return result;
}

async function checkInvalidInputNoCapture() {
  const invalidFailure = {
    complete: false,
    errors: ['termination-recheck-invalid-input'],
    rootPresent: false,
    treeGone: false,
    replanRequired: false,
    captured: [],
    newlyCaptured: [],
    target: null,
    reusedPids: [],
  };
  const malformedInputResult = await prepareStableCapturedProcessTerminationStep({});
  assert.deepEqual(malformedInputResult, invalidFailure);

  let callbackCalls = 0;
  const differentIdentity = { pid: 11, creationToken: '20260802043334.860108-240' };
  const mismatchedCapturedResult = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured: [differentIdentity],
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl() {
        callbackCalls += 1;
        return { kill() {} };
      },
    },
  });

  assert.deepEqual(mismatchedCapturedResult, invalidFailure);
  assert.equal(callbackCalls, 0);
  return [malformedInputResult, mismatchedCapturedResult];
}

async function checkFirstCaptureFailure() {
  let callbackCalls = 0;
  const result = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        callback(new Error('injected'));
        return { kill() {} };
      },
    },
  });

  assert.equal(callbackCalls, 1);
  assert.deepEqual(result, {
    complete: false,
    errors: ['termination-recheck-capture-failed'],
    rootPresent: false,
    treeGone: false,
    replanRequired: false,
    captured: [],
    newlyCaptured: [],
    target: null,
    reusedPids: [],
  });
  return result;
}

async function checkFirstPlanFailure() {
  let callbackCalls = 0;
  const cycleChild = { pid: 11, creationToken: '20260802043334.860108-240' };
  const result = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        callback(null, wmicCsv(
          `DESKTOP-SELFTEST,${root.creationToken},11,${root.pid}`,
          `DESKTOP-SELFTEST,${cycleChild.creationToken},10,${cycleChild.pid}`,
        ));
        return { kill() {} };
      },
    },
  });

  assert.equal(callbackCalls, 1);
  assert.deepEqual(result, {
    complete: false,
    errors: ['termination-recheck-plan-failed'],
    rootPresent: false,
    treeGone: false,
    replanRequired: false,
    captured: [],
    newlyCaptured: [],
    target: null,
    reusedPids: [],
  });
  return result;
}

async function checkSecondCaptureFailure() {
  let callbackCalls = 0;
  const rootRow = 'DESKTOP-SELFTEST,20260802043333.860108-240,4,10';
  const result = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        if (callbackCalls === 1) callback(null, wmicCsv(rootRow));
        else callback(new Error('injected-second'));
        return { kill() {} };
      },
    },
  });

  assert.equal(callbackCalls, 2);
  assert.deepEqual(result, {
    complete: false,
    errors: ['termination-recheck-second-capture-failed'],
    rootPresent: false,
    treeGone: false,
    replanRequired: false,
    captured: [],
    newlyCaptured: [],
    target: null,
    reusedPids: [],
  });
  return result;
}

async function checkSecondPlanFailure() {
  let callbackCalls = 0;
  const rootRow = 'DESKTOP-SELFTEST,20260802043333.860108-240,4,10';
  const cycleChild = { pid: 11, creationToken: '20260802043334.860108-240' };
  const result = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        callback(null, callbackCalls === 1
          ? wmicCsv(rootRow)
          : wmicCsv(
            `DESKTOP-SELFTEST,${root.creationToken},${cycleChild.pid},${root.pid}`,
            `DESKTOP-SELFTEST,${cycleChild.creationToken},${root.pid},${cycleChild.pid}`,
          ));
        return { kill() {} };
      },
    },
  });

  assert.equal(callbackCalls, 2);
  assert.deepEqual(result, {
    complete: false,
    errors: ['termination-recheck-second-plan-failed'],
    rootPresent: false,
    treeGone: false,
    replanRequired: false,
    captured: [],
    newlyCaptured: [],
    target: null,
    reusedPids: [],
  });
  return result;
}

async function checkFirstTargetDisappearance() {
  let callbackCalls = 0;
  const rootRow = 'DESKTOP-SELFTEST,20260802043333.860108-240,4,10';
  const child = { pid: 11, creationToken: '20260802043334.860108-240' };
  const childRow = `DESKTOP-SELFTEST,${child.creationToken},10,${child.pid}`;
  const result = await prepareStableCapturedProcessTerminationStep({
    rootIdentity: root,
    previousCaptured,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        callback(null, callbackCalls === 1
          ? wmicCsv(rootRow, childRow)
          : wmicCsv(rootRow));
        return { kill() {} };
      },
    },
  });

  assert.equal(callbackCalls, 2);
  assert.equal(result.complete, true);
  assert.equal(result.treeGone, false);
  assert.equal(result.replanRequired, true);
  assert.equal(result.target, null);
  assert.deepEqual(result.captured, [root, child]);
  assert.deepEqual(result.newlyCaptured, [child]);
  return result;
}

const firstGoneResult = await checkFirstGone();
const stableRootResult = await checkStableRoot();
const newChildReplanResult = await checkNewChildReplan();
const secondSnapshotGoneResult = await checkSecondSnapshotGone();
const [malformedInputResult, mismatchedCapturedResult] = await checkInvalidInputNoCapture();
const firstCaptureFailureResult = await checkFirstCaptureFailure();
const firstPlanFailureResult = await checkFirstPlanFailure();
const secondCaptureFailureResult = await checkSecondCaptureFailure();
const secondPlanFailureResult = await checkSecondPlanFailure();
const firstTargetDisappearanceResult = await checkFirstTargetDisappearance();
assert.deepEqual(
  [
    Object.keys(firstGoneResult),
    Object.keys(stableRootResult),
    Object.keys(newChildReplanResult),
    Object.keys(secondSnapshotGoneResult),
    Object.keys(malformedInputResult),
    Object.keys(mismatchedCapturedResult),
    Object.keys(firstCaptureFailureResult),
    Object.keys(firstPlanFailureResult),
    Object.keys(secondCaptureFailureResult),
    Object.keys(secondPlanFailureResult),
    Object.keys(firstTargetDisappearanceResult),
  ],
  [outputKeys, outputKeys, outputKeys, outputKeys, outputKeys, outputKeys, outputKeys, outputKeys, outputKeys, outputKeys, outputKeys],
);

console.log('e2e process termination async selftest: 10/10 PASS');
