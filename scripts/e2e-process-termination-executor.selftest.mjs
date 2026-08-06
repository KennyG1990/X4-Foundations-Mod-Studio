import assert from 'node:assert/strict';

import { terminateCapturedProcessTree } from './e2e-process-termination-executor.mjs';

const wmicHeader = 'Node,CreationDate,ParentProcessId,ProcessId';
const root = { pid: 10, creationToken: '20260802043333.860108-240' };
const child = { pid: 20, creationToken: '20260802043334.860108-240' };
const executorOutputKeys = [
  'complete',
  'errors',
  'treeGone',
  'passes',
  'captured',
  'commanded',
  'reusedPids',
];

function wmicCsv(...rows) {
  return [wmicHeader, ...rows].join('\n');
}

function wmicRow(identity, parentPid) {
  return `DESKTOP-SELFTEST,${identity.creationToken},${parentPid},${identity.pid}`;
}

function defaultCommandCallback(_command, _args, _options, callback) {
  callback(null, 'SUCCESS', '');
  return { kill() {} };
}

async function runScenario(snapshotTextQueue, {
  root: scenarioRoot = root,
  previousCaptured = [scenarioRoot],
  maxPasses = 100,
  pollIntervalMs = 0,
  snapshotPlatform = 'win32',
  commandPlatform = 'win32',
    commandCallback = defaultCommandCallback,
    snapshotCallbackError = null,
    inputOverride,
    inputTransform,
  } = {}) {
  assert.ok(Array.isArray(snapshotTextQueue), 'snapshot queue must be finite');

  const snapshotQueue = [...snapshotTextQueue];
  const snapshotCalls = [];
  const commandCalls = [];
  const commandedPids = [];
  let snapshotIndex = 0;

  const snapshotExecFileImpl = (command, args, options, callback) => {
    snapshotCalls.push({ command, args, options });
    if (snapshotCallbackError !== null && snapshotIndex === 0) {
      snapshotIndex += 1;
      callback(snapshotCallbackError);
      return { kill() {} };
    }
    assert.ok(snapshotIndex < snapshotQueue.length, 'snapshot text queue exhausted');
    const snapshotText = snapshotQueue[snapshotIndex];
    snapshotIndex += 1;
    callback(null, snapshotText, '');
    return { kill() {} };
  };

  const commandExecFileImpl = (command, args, options, callback) => {
    commandCalls.push({ command, args, options });
    commandedPids.push(Number(args[1]));
    return commandCallback(command, args, options, callback);
  };

  const defaultInput = {
      rootIdentity: scenarioRoot,
      previousCaptured,
      snapshotOptions: {
        platform: snapshotPlatform,
        timeoutMs: 100,
        execFileImpl: snapshotExecFileImpl,
      },
      commandOptions: {
        platform: commandPlatform,
        timeoutMs: 100,
        execFileImpl: commandExecFileImpl,
      },
      maxPasses,
      pollIntervalMs,
    };
  const input = inputOverride ?? (inputTransform === undefined ? defaultInput : inputTransform(defaultInput));
  const result = await terminateCapturedProcessTree(input);

  return {
    result,
    snapshotCalls,
    commandCalls,
    commandedPids,
    snapshotIndex,
  };
}

async function checkStableTargetThenGone() {
  const rootSnapshot = wmicCsv(wmicRow(root, 4));
  const unrelatedOnlySnapshot = wmicCsv(wmicRow(child, 999));
  const scenario = await runScenario([
    rootSnapshot,
    rootSnapshot,
    unrelatedOnlySnapshot,
  ], {
    root,
    previousCaptured: [root],
    maxPasses: 3,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
  });

  assert.deepEqual(Object.keys(scenario.result), executorOutputKeys);
  assert.deepEqual(scenario.result, {
    complete: true,
    errors: [],
    treeGone: true,
    passes: 2,
    captured: [root],
    commanded: [root],
    reusedPids: [],
  });
  assert.equal(scenario.snapshotCalls.length, 3);
  assert.deepEqual(scenario.commandedPids, [10]);
  assert.equal(scenario.snapshotIndex, 3);
  assert.deepEqual(scenario.commandCalls, [{
    command: 'taskkill.exe',
    args: ['/PID', '10', '/F'],
    options: {
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 100,
      maxBuffer: 65536,
      killSignal: 'SIGKILL',
    },
  }]);
  assert.notStrictEqual(scenario.result.captured, scenario.result.commanded);
  assert.notStrictEqual(scenario.result.captured, scenario.result.captured.slice());
  assert.notStrictEqual(scenario.result.captured[0], root);
  assert.notStrictEqual(scenario.result.commanded[0], root);
  assert.notStrictEqual(scenario.result.commanded[0], scenario.result.captured[0]);
}

async function checkNewChildReplansBeforeAncestor() {
  const rootSnapshot = wmicCsv(wmicRow(root, 4));
  const rootAndChildSnapshot = wmicCsv(wmicRow(root, 4), wmicRow(child, 10));
  const unrelated = { pid: 99, creationToken: '20260802043335.860108-240' };
  const unrelatedOnlySnapshot = wmicCsv(wmicRow(unrelated, 999));
  const scenario = await runScenario([
    rootSnapshot,
    rootAndChildSnapshot,
    rootAndChildSnapshot,
    rootAndChildSnapshot,
    rootSnapshot,
    rootSnapshot,
    unrelatedOnlySnapshot,
  ], {
    root,
    previousCaptured: [root],
    maxPasses: 4,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
  });

  assert.deepEqual(Object.keys(scenario.result), executorOutputKeys);
  assert.deepEqual(scenario.result, {
    complete: true,
    errors: [],
    treeGone: true,
    passes: 4,
    captured: [root, child],
    commanded: [child, root],
    reusedPids: [],
  });
  assert.equal(scenario.snapshotCalls.length, 7);
  assert.equal(scenario.snapshotIndex, 7);
  assert.deepEqual(scenario.commandedPids, [20, 10]);
  assert.deepEqual(scenario.commandCalls, [{
    command: 'taskkill.exe',
    args: ['/PID', '20', '/F'],
    options: {
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 100,
      maxBuffer: 65536,
      killSignal: 'SIGKILL',
    },
  }, {
    command: 'taskkill.exe',
    args: ['/PID', '10', '/F'],
    options: {
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 100,
      maxBuffer: 65536,
      killSignal: 'SIGKILL',
    },
  }]);
  assert.notStrictEqual(scenario.result.captured[0], root);
  assert.notStrictEqual(scenario.result.captured[1], child);
  assert.notStrictEqual(scenario.result.commanded[0], child);
  assert.notStrictEqual(scenario.result.commanded[1], root);
}

async function checkReusedOccupantDoesNotFollowDescendant() {
  const reusedOccupant = { pid: 10, creationToken: '20260802043336.860108-240' };
  const reusedDescendant = { pid: 30, creationToken: '20260802043337.860108-240' };
  const reusedOccupantSnapshot = wmicCsv(
    wmicRow(reusedOccupant, 4),
    wmicRow(reusedDescendant, 10),
  );
  const scenario = await runScenario([reusedOccupantSnapshot], {
    root,
    previousCaptured: [root],
    maxPasses: 1,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
  });

  assert.deepEqual(Object.keys(scenario.result), executorOutputKeys);
  assert.deepEqual(scenario.result, {
    complete: true,
    errors: [],
    treeGone: true,
    passes: 1,
    captured: [root],
    commanded: [],
    reusedPids: [10],
  });
  assert.equal(scenario.snapshotCalls.length, 1);
  assert.equal(scenario.snapshotIndex, 1);
  assert.deepEqual(scenario.commandedPids, []);
  assert.deepEqual(scenario.commandCalls, []);
}

async function checkRootGoneReparentedChildRemainsOwned() {
  const unrelated = { pid: 99, creationToken: '20260802043338.860108-240' };
  const previousCaptured = [root, child];
  const childOnlySnapshot = wmicCsv(wmicRow(child, 4));
  const unrelatedOnlySnapshot = wmicCsv(wmicRow(unrelated, 999));
  const scenario = await runScenario([
    childOnlySnapshot,
    childOnlySnapshot,
    unrelatedOnlySnapshot,
  ], {
    root,
    previousCaptured,
    maxPasses: 2,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
  });

  assert.deepEqual(Object.keys(scenario.result), executorOutputKeys);
  assert.deepEqual(scenario.result, {
    complete: true,
    errors: [],
    treeGone: true,
    passes: 2,
    captured: [root, child],
    commanded: [child],
    reusedPids: [],
  });
  assert.equal(scenario.snapshotCalls.length, 3);
  assert.equal(scenario.snapshotIndex, 3);
  assert.deepEqual(scenario.commandedPids, [20]);
  assert.deepEqual(scenario.commandCalls, [{
    command: 'taskkill.exe',
    args: ['/PID', '20', '/F'],
    options: {
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 100,
      maxBuffer: 65536,
      killSignal: 'SIGKILL',
    },
  }]);
  assert.notStrictEqual(scenario.result.captured, previousCaptured);
  assert.notStrictEqual(scenario.result.commanded, previousCaptured);
  assert.notStrictEqual(scenario.result.captured[0], root);
  assert.notStrictEqual(scenario.result.captured[1], child);
  assert.notStrictEqual(scenario.result.commanded[0], child);
  assert.notStrictEqual(scenario.result.commanded[0], scenario.result.captured[1]);
}

async function checkPersistentTargetHitsPassLimitWithoutDuplicateCommand() {
  const rootSnapshot = wmicCsv(wmicRow(root, 4));
  const scenario = await runScenario([
    rootSnapshot,
    rootSnapshot,
    rootSnapshot,
    rootSnapshot,
    rootSnapshot,
    rootSnapshot,
  ], {
    root,
    previousCaptured: [root],
    maxPasses: 3,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
  });

  assert.deepEqual(Object.keys(scenario.result), executorOutputKeys);
  assert.deepEqual(scenario.result, {
    complete: false,
    errors: ['termination-executor-pass-limit'],
    treeGone: false,
    passes: 3,
    captured: [root],
    commanded: [root],
    reusedPids: [],
  });
  assert.equal(scenario.snapshotCalls.length, 6);
  assert.equal(scenario.snapshotIndex, 6);
  assert.deepEqual(scenario.commandedPids, [10]);
  assert.equal(scenario.commandCalls.length, 1);
}

async function checkCommandFailureTimeoutAndPosixPropagation() {
  const rootSnapshot = wmicCsv(wmicRow(root, 4));

  const genericFailureScenario = await runScenario([rootSnapshot, rootSnapshot], {
    root,
    previousCaptured: [root],
    maxPasses: 1,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
    commandCallback(_command, _args, _options, callback) {
      callback(new Error('injected callback command failure'));
      return { kill() {} };
    },
  });
  assert.deepEqual(Object.keys(genericFailureScenario.result), executorOutputKeys);
  assert.deepEqual(genericFailureScenario.result, {
    complete: false,
    errors: ['termination-command-failed'],
    treeGone: false,
    passes: 1,
    captured: [root],
    commanded: [],
    reusedPids: [],
  });
  assert.equal(genericFailureScenario.snapshotCalls.length, 2);
  assert.equal(genericFailureScenario.snapshotIndex, 2);
  assert.equal(genericFailureScenario.commandCalls.length, 1);
  assert.deepEqual(genericFailureScenario.commandedPids, [10]);
  assert.doesNotMatch(JSON.stringify(genericFailureScenario.result), /injected callback command failure/);

  const timeoutScenario = await runScenario([rootSnapshot, rootSnapshot], {
    root,
    previousCaptured: [root],
    maxPasses: 1,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
    commandCallback(_command, _args, _options, callback) {
      callback({ code: 'ETIMEDOUT', message: 'injected timeout detail' });
      return { kill() {} };
    },
  });
  assert.deepEqual(Object.keys(timeoutScenario.result), executorOutputKeys);
  assert.deepEqual(timeoutScenario.result, {
    complete: false,
    errors: ['termination-command-timeout'],
    treeGone: false,
    passes: 1,
    captured: [root],
    commanded: [],
    reusedPids: [],
  });
  assert.equal(timeoutScenario.snapshotCalls.length, 2);
  assert.equal(timeoutScenario.snapshotIndex, 2);
  assert.equal(timeoutScenario.commandCalls.length, 1);
  assert.deepEqual(timeoutScenario.commandedPids, [10]);
  assert.doesNotMatch(JSON.stringify(timeoutScenario.result), /injected timeout detail/);

  const posixScenario = await runScenario([rootSnapshot, rootSnapshot], {
    root,
    previousCaptured: [root],
    maxPasses: 1,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'linux',
    commandCallback() {
      throw new Error('injected POSIX command must not run');
    },
  });
  assert.deepEqual(Object.keys(posixScenario.result), executorOutputKeys);
  assert.deepEqual(posixScenario.result, {
    complete: false,
    errors: ['termination-command-identity-insufficient'],
    treeGone: false,
    passes: 1,
    captured: [root],
    commanded: [],
    reusedPids: [],
  });
  assert.equal(posixScenario.snapshotCalls.length, 2);
  assert.equal(posixScenario.snapshotIndex, 2);
  assert.deepEqual(posixScenario.commandCalls, []);
  assert.deepEqual(posixScenario.commandedPids, []);
  assert.doesNotMatch(JSON.stringify(posixScenario.result), /injected POSIX command must not run/);
}

async function checkMalformedInputPreCaptureAndCaptureFailures() {
  const rootSnapshot = wmicCsv(wmicRow(root, 4));

  const invalidMaxPassesScenario = await runScenario([], {
    root,
    previousCaptured: [root],
    maxPasses: 0,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
  });
  assert.deepEqual(Object.keys(invalidMaxPassesScenario.result), executorOutputKeys);
  assert.deepEqual(invalidMaxPassesScenario.result, {
    complete: false,
    errors: ['termination-executor-invalid-input'],
    treeGone: false,
    passes: 0,
    captured: [],
    commanded: [],
    reusedPids: [],
  });
  assert.equal(invalidMaxPassesScenario.snapshotCalls.length, 0);
  assert.equal(invalidMaxPassesScenario.commandCalls.length, 0);
  assert.deepEqual(invalidMaxPassesScenario.commandedPids, []);
  assert.equal(invalidMaxPassesScenario.snapshotIndex, 0);

  const assertInvalidWithoutCalls = async (inputTransform, label) => {
    const scenario = await runScenario([], {
      root,
      previousCaptured: [root],
      maxPasses: 1,
      pollIntervalMs: 0,
      snapshotPlatform: 'win32',
      commandPlatform: 'win32',
      inputTransform,
    });
    assert.deepEqual(Object.keys(scenario.result), executorOutputKeys, label);
    assert.deepEqual(scenario.result, {
      complete: false,
      errors: ['termination-executor-invalid-input'],
      treeGone: false,
      passes: 0,
      captured: [],
      commanded: [],
      reusedPids: [],
    }, label);
    assert.equal(scenario.snapshotCalls.length, 0, `${label}: snapshot calls`);
    assert.equal(scenario.commandCalls.length, 0, `${label}: command calls`);
    assert.deepEqual(scenario.commandedPids, [], `${label}: commanded pids`);
    assert.equal(scenario.snapshotIndex, 0, `${label}: snapshot index`);
  };

  await assertInvalidWithoutCalls((input) => new Proxy(input, {}), 'well-behaved top-level proxy');
  await assertInvalidWithoutCalls((input) => ({
    ...input,
    snapshotOptions: new Proxy(input.snapshotOptions, {}),
  }), 'well-behaved snapshotOptions proxy');
  await assertInvalidWithoutCalls((input) => ({
    ...input,
    commandOptions: new Proxy(input.commandOptions, {}),
  }), 'well-behaved commandOptions proxy');

  const malformedPreviousScenario = await runScenario([], {
    root,
    previousCaptured: [],
    maxPasses: 1,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
  });
  assert.deepEqual(Object.keys(malformedPreviousScenario.result), executorOutputKeys);
  assert.deepEqual(malformedPreviousScenario.result, {
    complete: false,
    errors: ['termination-executor-recheck-failed'],
    treeGone: false,
    passes: 1,
    captured: [],
    commanded: [],
    reusedPids: [],
  });
  assert.equal(malformedPreviousScenario.snapshotCalls.length, 0);
  assert.equal(malformedPreviousScenario.commandCalls.length, 0);
  assert.deepEqual(malformedPreviousScenario.commandedPids, []);
  assert.equal(malformedPreviousScenario.snapshotIndex, 0);

  const snapshotFailureScenario = await runScenario([rootSnapshot], {
    root,
    previousCaptured: [root],
    maxPasses: 1,
    pollIntervalMs: 0,
    snapshotPlatform: 'win32',
    commandPlatform: 'win32',
    snapshotCallbackError: new Error('injected snapshot callback failure'),
  });
  assert.deepEqual(Object.keys(snapshotFailureScenario.result), executorOutputKeys);
  assert.deepEqual(snapshotFailureScenario.result, {
    complete: false,
    errors: ['termination-executor-recheck-failed'],
    treeGone: false,
    passes: 1,
    captured: [root],
    commanded: [],
    reusedPids: [],
  });
  assert.equal(snapshotFailureScenario.snapshotCalls.length, 1);
  assert.equal(snapshotFailureScenario.commandCalls.length, 0);
  assert.deepEqual(snapshotFailureScenario.commandedPids, []);
  assert.equal(snapshotFailureScenario.snapshotIndex, 1);
  assert.doesNotMatch(JSON.stringify(snapshotFailureScenario.result), /injected snapshot callback failure/);

  const revokedTopLevel = Proxy.revocable({
    rootIdentity: root,
    previousCaptured: [root],
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 100,
    },
    commandOptions: {
      platform: 'win32',
      timeoutMs: 100,
    },
    maxPasses: 1,
    pollIntervalMs: 0,
  }, {});
  revokedTopLevel.revoke();

  let revokedProxyScenario;
  await assert.doesNotReject(async () => {
    revokedProxyScenario = await runScenario([], {
      inputOverride: revokedTopLevel.proxy,
    });
  });
  assert.deepEqual(Object.keys(revokedProxyScenario.result), executorOutputKeys);
  assert.deepEqual(revokedProxyScenario.result, {
    complete: false,
    errors: ['termination-executor-invalid-input'],
    treeGone: false,
    passes: 0,
    captured: [],
    commanded: [],
    reusedPids: [],
  });
  assert.equal(revokedProxyScenario.snapshotCalls.length, 0);
  assert.equal(revokedProxyScenario.commandCalls.length, 0);
  assert.deepEqual(revokedProxyScenario.commandedPids, []);
  assert.equal(revokedProxyScenario.snapshotIndex, 0);
}

async function checkStableTargetThenGoneWithPolling() {
  const rootSnapshot = wmicCsv(wmicRow(root, 4));
  const unrelated = { pid: 99, creationToken: '20260802043335.860108-240' };
  const unrelatedOnlySnapshot = wmicCsv(wmicRow(unrelated, 999));
  let watchdog;
  let scenario;
  try {
    const watchdogRejection = new Promise((_, reject) => {
      watchdog = setTimeout(() => reject(new Error('selftest watchdog expired')), 1000);
    });
    scenario = await Promise.race([
      runScenario([
        rootSnapshot,
        rootSnapshot,
        unrelatedOnlySnapshot,
      ], {
        root,
        previousCaptured: [root],
        maxPasses: 3,
        pollIntervalMs: 1,
        snapshotPlatform: 'win32',
        commandPlatform: 'win32',
      }),
      watchdogRejection,
    ]);
  } finally {
    clearTimeout(watchdog);
  }

  assert.deepEqual(Object.keys(scenario.result), executorOutputKeys);
  assert.deepEqual(scenario.result, {
    complete: true,
    errors: [],
    treeGone: true,
    passes: 2,
    captured: [root],
    commanded: [root],
    reusedPids: [],
  });
  assert.equal(scenario.snapshotCalls.length, 3);
  assert.deepEqual(scenario.commandedPids, [10]);
  assert.deepEqual(scenario.result.commanded, [root]);
  assert.deepEqual(scenario.result.reusedPids, []);
}

await checkStableTargetThenGone();
await checkNewChildReplansBeforeAncestor();
await checkReusedOccupantDoesNotFollowDescendant();
await checkRootGoneReparentedChildRemainsOwned();
await checkPersistentTargetHitsPassLimitWithoutDuplicateCommand();
await checkCommandFailureTimeoutAndPosixPropagation();
await checkMalformedInputPreCaptureAndCaptureFailures();
await checkStableTargetThenGoneWithPolling();

console.log('e2e process termination executor selftest: 8/8 PASS');
