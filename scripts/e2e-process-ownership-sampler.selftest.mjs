import assert from 'node:assert/strict';

import {
  initializeSpawnedProcessOwnership,
  sampleSpawnedProcessOwnership,
} from './e2e-process-ownership-sampler.mjs';

const ROOT_PID = 10;
const CHILD_PID = 20;
const ROOT_TOKEN = '20260802043333.860108-240';
const CHILD_TOKEN = '20260802043334.860108-240';
const SNAPSHOT_TIMEOUT_MS = 1234;
const SNAPSHOT_MAX_BUFFER = 4 * 1024 * 1024;
const ROOT = { pid: ROOT_PID, creationToken: ROOT_TOKEN };
const CHILD = { pid: CHILD_PID, creationToken: CHILD_TOKEN };
const ERR_INVALID_INPUT = 'spawned-ownership-invalid-input';
const ERR_SNAPSHOT_FAILED = 'spawned-ownership-snapshot-failed';
const ERR_ROOT_UNAVAILABLE = 'spawned-ownership-root-unavailable';

const wmicRow = (identity, parentPid) =>
  `DESKTOP-SELFTEST,${identity.creationToken},${parentPid},${identity.pid}`;

const wmicCsv = (...rows) =>
  [
    'Node,CreationDate,ParentProcessId,ProcessId',
    ...rows,
  ].join('\n');

const makeFakeExecFile = (csv) => {
  let calls = 0;

  const execFile = (command, args, options, callback) => {
    calls += 1;
    assert.equal(command, 'wmic.exe');
    assert.deepEqual(args, [
      'process',
      'get',
      'CreationDate,ParentProcessId,ProcessId',
      '/format:csv',
    ]);
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    assert.equal(options.encoding, 'utf8');
    assert.equal(options.timeout, SNAPSHOT_TIMEOUT_MS);
    assert.equal(options.maxBuffer, SNAPSHOT_MAX_BUFFER);
    assert.equal(options.killSignal, 'SIGKILL');
    callback(null, csv, '');
    return { kill() {} };
  };

  execFile.calls = () => calls;
  return execFile;
};

const makeSnapshotResponseExecFile = (respond) => {
  let calls = 0;

  const execFile = (command, args, options, callback) => {
    calls += 1;
    assert.equal(command, 'wmic.exe');
    assert.deepEqual(args, [
      'process',
      'get',
      'CreationDate,ParentProcessId,ProcessId',
      '/format:csv',
    ]);
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    assert.equal(options.encoding, 'utf8');
    assert.equal(options.timeout, SNAPSHOT_TIMEOUT_MS);
    assert.equal(options.maxBuffer, SNAPSHOT_MAX_BUFFER);
    assert.equal(options.killSignal, 'SIGKILL');
    respond(callback);
    return { kill() {} };
  };

  execFile.calls = () => calls;
  return execFile;
};

const makeSnapshotOptions = (execFileImpl) => ({
  platform: 'win32',
  timeoutMs: SNAPSHOT_TIMEOUT_MS,
  execFileImpl,
});

const makeInitializeInput = (execFileImpl) => ({
  rootPid: ROOT_PID,
  snapshotOptions: makeSnapshotOptions(execFileImpl),
});

const makeSampleInput = (
  execFileImpl,
  previousCaptured = [ROOT, CHILD],
  rootIdentity = ROOT,
) => ({
  rootIdentity,
  previousCaptured,
  snapshotOptions: makeSnapshotOptions(execFileImpl),
});

const assertResultKeys = (result) =>
  assert.deepEqual(Object.keys(result), [
    'complete',
    'errors',
    'rootIdentity',
    'rootPresent',
    'captured',
    'newlyCaptured',
    'reusedPids',
  ]);

const assertFailure = (result, error) => {
  assertResultKeys(result);
  assert.equal(result.complete, false);
  assert.equal(result.errors.length, 1);
  assert.deepEqual(result.errors, [error]);
  assert.equal(result.rootIdentity, null);
  assert.equal(result.rootPresent, false);
  assert.deepEqual(result.captured, []);
  assert.deepEqual(result.newlyCaptured, []);
  assert.deepEqual(result.reusedPids, []);
};

const runCase1 = async () => {
  const fakeExecFile = makeFakeExecFile(wmicCsv(
    wmicRow(CHILD, ROOT_PID),
    wmicRow(ROOT, 0),
  ));
  const input = {
    rootPid: ROOT_PID,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: SNAPSHOT_TIMEOUT_MS,
      execFileImpl: fakeExecFile,
    },
  };

  const resultPromise = initializeSpawnedProcessOwnership(input);
  input.rootPid = 999;
  input.snapshotOptions.timeoutMs = 10;
  const result = await resultPromise;

  assert.equal(fakeExecFile.calls(), 1);
  assertResultKeys(result);
  assert.equal(result.complete, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rootIdentity, ROOT);
  assert.equal(result.rootPresent, true);
  assert.deepEqual(result.captured, [ROOT, CHILD]);
  assert.deepEqual(result.newlyCaptured, [ROOT, CHILD]);
  assert.deepEqual(result.reusedPids, []);
  assert.notStrictEqual(result.captured, result.newlyCaptured);
  assert.notStrictEqual(result.captured[0], result.newlyCaptured[0]);

  result.captured[0].creationToken = 'mutated-output';
  result.captured.push({ pid: 999, creationToken: 'mutated-output' });
  assert.deepEqual(result.newlyCaptured, [ROOT, CHILD]);
};

const runCase2 = async () => {
  const grandchild = { pid: 30, creationToken: '20260802043335.860108-240' };
  const fakeExecFile = makeFakeExecFile(wmicCsv(
    wmicRow(ROOT, 0),
    wmicRow(CHILD, ROOT_PID),
    wmicRow(grandchild, CHILD_PID),
  ));
  const result = await sampleSpawnedProcessOwnership({
    rootIdentity: ROOT,
    previousCaptured: [ROOT, CHILD],
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: SNAPSHOT_TIMEOUT_MS,
      execFileImpl: fakeExecFile,
    },
  });

  assert.equal(fakeExecFile.calls(), 1);
  assertResultKeys(result);
  assert.equal(result.complete, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rootIdentity, ROOT);
  assert.equal(result.rootPresent, true);
  assert.deepEqual(result.captured, [ROOT, CHILD, grandchild]);
  assert.deepEqual(result.newlyCaptured, [grandchild]);
  assert.deepEqual(result.reusedPids, []);
};

const runCase3 = async () => {
  const fakeExecFile = makeFakeExecFile(wmicCsv(
    wmicRow(CHILD, 1),
  ));
  const result = await sampleSpawnedProcessOwnership({
    rootIdentity: ROOT,
    previousCaptured: [ROOT, CHILD],
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: SNAPSHOT_TIMEOUT_MS,
      execFileImpl: fakeExecFile,
    },
  });

  assert.equal(fakeExecFile.calls(), 1);
  assertResultKeys(result);
  assert.equal(result.complete, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rootIdentity, ROOT);
  assert.equal(result.rootPresent, false);
  assert.deepEqual(result.captured, [ROOT, CHILD]);
  assert.deepEqual(result.newlyCaptured, []);
  assert.deepEqual(result.reusedPids, []);
};

const runCase4 = async () => {
  const reusedChild = { pid: CHILD_PID, creationToken: '20260802043336.860108-240' };
  const grandchild = { pid: 30, creationToken: '20260802043337.860108-240' };
  const fakeExecFile = makeFakeExecFile(wmicCsv(
    wmicRow(ROOT, 0),
    wmicRow(reusedChild, ROOT_PID),
    wmicRow(grandchild, CHILD_PID),
  ));
  const result = await sampleSpawnedProcessOwnership({
    rootIdentity: ROOT,
    previousCaptured: [ROOT, CHILD],
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: SNAPSHOT_TIMEOUT_MS,
      execFileImpl: fakeExecFile,
    },
  });

  assert.equal(fakeExecFile.calls(), 1);
  assertResultKeys(result);
  assert.equal(result.complete, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rootIdentity, ROOT);
  assert.equal(result.rootPresent, true);
  assert.deepEqual(result.captured, [ROOT, CHILD]);
  assert.deepEqual(result.newlyCaptured, []);
  assert.deepEqual(result.reusedPids, [CHILD_PID]);
  assert.equal(result.captured.some((identity) => identity.creationToken === reusedChild.creationToken), false);
  assert.equal(result.captured.some((identity) => identity.pid === grandchild.pid), false);
};

const runCase5 = async () => {
  const zeroCallExecFile = makeFakeExecFile(wmicCsv(wmicRow(ROOT, 0)));

  const initializeAccessor = makeInitializeInput(zeroCallExecFile);
  Object.defineProperty(initializeAccessor, 'rootPid', {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error('hostile rootPid accessor');
    },
  });
  assertFailure(await initializeSpawnedProcessOwnership(initializeAccessor), ERR_INVALID_INPUT);

  const initializeSymbolKey = makeInitializeInput(zeroCallExecFile);
  Object.defineProperty(initializeSymbolKey, Symbol('hostile'), {
    enumerable: true,
    value: 'unexpected',
  });
  assertFailure(await initializeSpawnedProcessOwnership(initializeSymbolKey), ERR_INVALID_INPUT);

  const initializeUnknownKey = {
    ...makeInitializeInput(zeroCallExecFile),
    unexpected: true,
  };
  assertFailure(await initializeSpawnedProcessOwnership(initializeUnknownKey), ERR_INVALID_INPUT);

  const initializeProxy = new Proxy(makeInitializeInput(zeroCallExecFile), {});
  assertFailure(await initializeSpawnedProcessOwnership(initializeProxy), ERR_INVALID_INPUT);

  const revokedInitialize = Proxy.revocable(makeInitializeInput(zeroCallExecFile), {});
  revokedInitialize.revoke();
  assertFailure(await initializeSpawnedProcessOwnership(revokedInitialize.proxy), ERR_INVALID_INPUT);

  const invalidPlatform = makeInitializeInput(zeroCallExecFile);
  invalidPlatform.snapshotOptions.platform = 42;
  assertFailure(await initializeSpawnedProcessOwnership(invalidPlatform), ERR_INVALID_INPUT);

  const invalidExecFile = makeInitializeInput(zeroCallExecFile);
  invalidExecFile.snapshotOptions.execFileImpl = null;
  assertFailure(await initializeSpawnedProcessOwnership(invalidExecFile), ERR_INVALID_INPUT);

  const invalidTimeout = makeInitializeInput(zeroCallExecFile);
  invalidTimeout.snapshotOptions.timeoutMs = 9;
  assertFailure(await initializeSpawnedProcessOwnership(invalidTimeout), ERR_INVALID_INPUT);

  const sampleProxy = new Proxy(makeSampleInput(zeroCallExecFile), {});
  assertFailure(await sampleSpawnedProcessOwnership(sampleProxy), ERR_INVALID_INPUT);

  const sampleNestedProxy = makeSampleInput(zeroCallExecFile);
  sampleNestedProxy.snapshotOptions = new Proxy(sampleNestedProxy.snapshotOptions, {});
  assertFailure(await sampleSpawnedProcessOwnership(sampleNestedProxy), ERR_INVALID_INPUT);

  const sparsePrevious = [ROOT, CHILD];
  delete sparsePrevious[1];
  assertFailure(
    await sampleSpawnedProcessOwnership(makeSampleInput(zeroCallExecFile, sparsePrevious)),
    ERR_INVALID_INPUT,
  );

  const duplicatePrevious = [ROOT, { ...ROOT }];
  assertFailure(
    await sampleSpawnedProcessOwnership(makeSampleInput(zeroCallExecFile, duplicatePrevious)),
    ERR_INVALID_INPUT,
  );

  const mismatchedRoot = { pid: ROOT_PID, creationToken: 'mismatched-root-token' };
  assertFailure(
    await sampleSpawnedProcessOwnership(makeSampleInput(zeroCallExecFile, [ROOT, CHILD], mismatchedRoot)),
    ERR_INVALID_INPUT,
  );

  const absentRoot = { pid: 99, creationToken: '20260802049999.860108-240' };
  assertFailure(
    await sampleSpawnedProcessOwnership(makeSampleInput(zeroCallExecFile, [ROOT, CHILD], absentRoot)),
    ERR_INVALID_INPUT,
  );

  assert.equal(zeroCallExecFile.calls(), 0);
};

const runCase6 = async () => {
  const secret = 'SELFTEST_SAMPLER_SECRET_MUST_NOT_LEAK';
  const callbackErrorExecFile = makeSnapshotResponseExecFile((callback) => {
    const error = new Error(`injected callback failure: ${secret}`);
    error.code = 'ESELFTEST';
    callback(error, '', secret);
  });
  const callbackErrorResult = await initializeSpawnedProcessOwnership(
    makeInitializeInput(callbackErrorExecFile),
  );
  assertFailure(callbackErrorResult, ERR_SNAPSHOT_FAILED);
  assert.equal(JSON.stringify(callbackErrorResult).includes(secret), false);
  assert.equal(callbackErrorExecFile.calls(), 1);

  const malformedCsvExecFile = makeSnapshotResponseExecFile((callback) => {
    callback(null, 'Node,ProcessId,ParentProcessId,CreationDate\n', '');
  });
  const malformedCsvResult = await initializeSpawnedProcessOwnership(
    makeInitializeInput(malformedCsvExecFile),
  );
  assertFailure(malformedCsvResult, ERR_SNAPSHOT_FAILED);
  assert.equal(malformedCsvExecFile.calls(), 1);

  const otherRoot = { pid: 99, creationToken: '20260802049998.860108-240' };
  const missingRootExecFile = makeSnapshotResponseExecFile((callback) => {
    callback(null, wmicCsv(wmicRow(otherRoot, 0)), '');
  });
  const missingRootResult = await initializeSpawnedProcessOwnership(
    makeInitializeInput(missingRootExecFile),
  );
  assertFailure(missingRootResult, ERR_ROOT_UNAVAILABLE);
  assert.equal(missingRootExecFile.calls(), 1);

  const sampleMalformedExecFile = makeSnapshotResponseExecFile((callback) => {
    callback(null, 'Node,CreationDate,ParentProcessId,ProcessId\nonly,two,fields', '');
  });
  const sampleMalformedResult = await sampleSpawnedProcessOwnership(
    makeSampleInput(sampleMalformedExecFile),
  );
  assertFailure(sampleMalformedResult, ERR_SNAPSHOT_FAILED);
  assert.equal(sampleMalformedExecFile.calls(), 1);
};

const runCase7 = async () => {
  let execCalls = 0;
  let helperKillCalls = 0;
  const fakeExecFile = (command, args, options, callback) => {
    execCalls += 1;
    assert.equal(command, 'wmic.exe');
    assert.deepEqual(args, [
      'process',
      'get',
      'CreationDate,ParentProcessId,ProcessId',
      '/format:csv',
    ]);
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    assert.equal(options.encoding, 'utf8');
    assert.equal(options.timeout, 10);
    assert.equal(options.maxBuffer, SNAPSHOT_MAX_BUFFER);
    assert.equal(options.killSignal, 'SIGKILL');
    assert.equal(typeof callback, 'function');
    return {
      kill() {
        helperKillCalls += 1;
      },
    };
  };

  const samplerPromise = initializeSpawnedProcessOwnership({
    rootPid: ROOT_PID,
    snapshotOptions: {
      platform: 'win32',
      timeoutMs: 10,
      execFileImpl: fakeExecFile,
    },
  });
  let watchdog;
  try {
    const result = await Promise.race([
      samplerPromise,
      new Promise((_, reject) => {
        watchdog = setTimeout(() => {
          reject(new Error('case 7 sampler watchdog exceeded'));
        }, 1000);
      }),
    ]);
    assertFailure(result, ERR_SNAPSHOT_FAILED);
  } finally {
    clearTimeout(watchdog);
  }

  assert.equal(execCalls, 1);
  assert.equal(helperKillCalls, 1);
};

const runCase8 = async () => {
  let initializeCallbackRan = false;
  const initializeExecFile = makeSnapshotResponseExecFile((callback) => {
    setImmediate(() => {
      initializeCallbackRan = true;
      callback(null, wmicCsv(
        wmicRow(CHILD, ROOT_PID),
        wmicRow(ROOT, 0),
      ), '');
    });
  });
  const initializeInput = makeInitializeInput(initializeExecFile);
  const initializeResultPromise = initializeSpawnedProcessOwnership(initializeInput);
  assert.equal(initializeCallbackRan, false);

  const initializeMutatedExecFile = () => {
    throw new Error('mutated initialize exec file must not be called');
  };
  initializeInput.rootPid = 999;
  initializeInput.snapshotOptions.platform = 'posix';
  initializeInput.snapshotOptions.timeoutMs = 14999;
  initializeInput.snapshotOptions.execFileImpl = initializeMutatedExecFile;
  const initializePostCallInput = {
    rootPid: initializeInput.rootPid,
    snapshotOptions: { ...initializeInput.snapshotOptions },
  };
  const initializeResult = await initializeResultPromise;

  assert.equal(initializeExecFile.calls(), 1);
  assertResultKeys(initializeResult);
  assert.equal(initializeResult.complete, true);
  assert.deepEqual(initializeResult.errors, []);
  assert.deepEqual(initializeResult.rootIdentity, ROOT);
  assert.equal(initializeResult.rootPresent, true);
  assert.deepEqual(initializeResult.captured, [ROOT, CHILD]);
  assert.deepEqual(initializeResult.newlyCaptured, [ROOT, CHILD]);
  assert.deepEqual(initializeResult.reusedPids, []);
  assert.notStrictEqual(initializeResult.rootIdentity, initializeResult.captured[0]);
  assert.notStrictEqual(initializeResult.rootIdentity, initializeResult.newlyCaptured[0]);
  assert.notStrictEqual(initializeResult.captured, initializeResult.newlyCaptured);
  assert.notStrictEqual(initializeResult.captured[0], initializeResult.newlyCaptured[0]);

  initializeResult.rootIdentity.creationToken = 'mutated-initialize-result-root';
  initializeResult.captured[0].creationToken = 'mutated-initialize-result-captured';
  initializeResult.captured.push({ pid: 31, creationToken: 'mutated-initialize-result-captured-array' });
  initializeResult.newlyCaptured[0].creationToken = 'mutated-initialize-result-newly';
  initializeResult.newlyCaptured.push({ pid: 32, creationToken: 'mutated-initialize-result-newly-array' });
  initializeResult.reusedPids.push(33);
  assert.deepEqual(initializeInput, initializePostCallInput);

  const sampleRootIdentity = { ...ROOT };
  const samplePreviousRoot = { ...ROOT };
  const samplePreviousChild = { ...CHILD };
  const samplePreviousCaptured = [samplePreviousRoot, samplePreviousChild];
  assert.notStrictEqual(sampleRootIdentity, samplePreviousRoot);
  assert.notStrictEqual(samplePreviousRoot, samplePreviousChild);

  const sampleNewChild = { pid: 30, creationToken: '20260802043335.860108-240' };
  const sampleReusedChild = { pid: CHILD_PID, creationToken: '20260802043336.860108-240' };
  let sampleCallbackRan = false;
  const sampleExecFile = makeSnapshotResponseExecFile((callback) => {
    setImmediate(() => {
      sampleCallbackRan = true;
      callback(null, wmicCsv(
        wmicRow(ROOT, 0),
        wmicRow(sampleReusedChild, ROOT_PID),
        wmicRow(sampleNewChild, ROOT_PID),
      ), '');
    });
  });
  const sampleInput = makeSampleInput(sampleExecFile, samplePreviousCaptured, sampleRootIdentity);
  const sampleResultPromise = sampleSpawnedProcessOwnership(sampleInput);
  assert.equal(sampleCallbackRan, false);

  const sampleMutatedExecFile = () => {
    throw new Error('mutated sample exec file must not be called');
  };
  sampleInput.rootIdentity.creationToken = 'mutated-sample-input-root';
  sampleInput.previousCaptured[0].creationToken = 'mutated-sample-input-previous-root';
  sampleInput.previousCaptured[1].pid = 222;
  sampleInput.previousCaptured.push({ pid: 40, creationToken: 'mutated-sample-input-array' });
  sampleInput.snapshotOptions.platform = 'posix';
  sampleInput.snapshotOptions.timeoutMs = 14999;
  sampleInput.snapshotOptions.execFileImpl = sampleMutatedExecFile;
  const samplePostCallInput = {
    rootIdentity: { ...sampleInput.rootIdentity },
    previousCaptured: sampleInput.previousCaptured.map((identity) => ({ ...identity })),
    snapshotOptions: { ...sampleInput.snapshotOptions },
  };
  const sampleResult = await sampleResultPromise;

  assert.equal(sampleExecFile.calls(), 1);
  assertResultKeys(sampleResult);
  assert.equal(sampleResult.complete, true);
  assert.deepEqual(sampleResult.errors, []);
  assert.deepEqual(sampleResult.rootIdentity, ROOT);
  assert.equal(sampleResult.rootPresent, true);
  assert.deepEqual(sampleResult.captured, [ROOT, CHILD, sampleNewChild]);
  assert.deepEqual(sampleResult.newlyCaptured, [sampleNewChild]);
  assert.deepEqual(sampleResult.reusedPids, [CHILD_PID]);
  assert.notStrictEqual(sampleResult.rootIdentity, sampleResult.captured[0]);
  assert.notStrictEqual(sampleResult.rootIdentity, sampleResult.captured[2]);
  assert.notStrictEqual(sampleResult.rootIdentity, sampleResult.newlyCaptured[0]);
  assert.notStrictEqual(sampleResult.captured, sampleResult.newlyCaptured);
  assert.notStrictEqual(sampleResult.captured[0], sampleResult.newlyCaptured[0]);
  assert.notStrictEqual(sampleResult.captured[2], sampleResult.newlyCaptured[0]);
  assert.notStrictEqual(sampleResult.rootIdentity, sampleInput.rootIdentity);
  assert.notStrictEqual(sampleResult.captured, sampleInput.previousCaptured);
  assert.notStrictEqual(sampleResult.captured[0], sampleInput.previousCaptured[0]);

  sampleResult.rootIdentity.creationToken = 'mutated-sample-result-root';
  sampleResult.captured[0].creationToken = 'mutated-sample-result-captured';
  sampleResult.captured.push({ pid: 41, creationToken: 'mutated-sample-result-captured-array' });
  sampleResult.newlyCaptured[0].creationToken = 'mutated-sample-result-newly';
  sampleResult.newlyCaptured.push({ pid: 42, creationToken: 'mutated-sample-result-newly-array' });
  sampleResult.reusedPids[0] = 220;
  sampleResult.reusedPids.push(221);
  assert.equal(sampleResult.rootIdentity.creationToken, 'mutated-sample-result-root');
  assert.equal(sampleResult.captured[0].creationToken, 'mutated-sample-result-captured');
  assert.deepEqual(sampleResult.captured[2], sampleNewChild);
  assert.equal(sampleResult.newlyCaptured[0].creationToken, 'mutated-sample-result-newly');
  assert.deepEqual(sampleResult.reusedPids, [220, 221]);
  assert.deepEqual(sampleInput, samplePostCallInput);
};

const main = async () => {
  try {
    await runCase1();
    await runCase2();
    await runCase3();
    await runCase4();
    await runCase5();
    await runCase6();
    await runCase7();
    await runCase8();
    console.log('e2e process ownership sampler selftest: 8/8 PASS');
  } catch {
    process.exitCode = 1;
  }
};

await main();
