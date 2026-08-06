import assert from 'node:assert/strict';

import { invokeExactWindowsTaskkill } from './e2e-process-termination-command.mjs';

const target = { pid: 4242, creationToken: 'token-4242' };
const calls = [];
const result = await invokeExactWindowsTaskkill({
  target,
  platform: 'win32',
  timeoutMs: 100,
  execFileImpl(command, args, options, callback) {
    calls.push({ command, args, options });
    callback(null, 'SUCCESS', '');
    return {
      kill() {
        throw new Error('must not kill');
      },
    };
  },
});

assert.deepStrictEqual(calls, [{
  command: 'taskkill.exe',
  args: ['/PID', '4242', '/F'],
  options: {
    shell: false,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 100,
    maxBuffer: 65536,
    killSignal: 'SIGKILL',
  },
}]);
assert.deepStrictEqual(Reflect.ownKeys(result), ['complete', 'errors', 'attempted', 'target']);
assert.deepStrictEqual(result, {
  complete: true,
  errors: [],
  attempted: true,
  target: { pid: 4242, creationToken: 'token-4242' },
});
assert.notStrictEqual(result.target, target);

const refusalPlatforms = ['aix', 'android', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos'];
let refusalExecCalls = 0;
const refusalExecFileImpl = () => {
  refusalExecCalls += 1;
  throw new Error('must not execute');
};

for (const platform of refusalPlatforms) {
  const refusalResult = await invokeExactWindowsTaskkill({
    target,
    platform,
    timeoutMs: 100,
    execFileImpl: refusalExecFileImpl,
  });
  assert.deepStrictEqual(refusalResult, {
    complete: false,
    errors: ['termination-command-identity-insufficient'],
    attempted: false,
    target,
  });
  assert.notStrictEqual(refusalResult.target, target);
}

const unsupportedResult = await invokeExactWindowsTaskkill({
  target,
  platform: 'plan9',
  timeoutMs: 100,
  execFileImpl: refusalExecFileImpl,
});
assert.deepStrictEqual(unsupportedResult, {
  complete: false,
  errors: ['termination-command-platform-unsupported'],
  attempted: false,
  target,
});
assert.notStrictEqual(unsupportedResult.target, target);
assert.equal(refusalExecCalls, 0);

{
  const invalidExpected = {
    complete: false,
    errors: ['termination-command-invalid-input'],
    attempted: false,
    target: null,
  };
  let malformedExecCalls = 0;
  const malformedExecFileImpl = () => {
    malformedExecCalls += 1;
    throw new Error('must not execute');
  };
  const malformedBase = {
    target,
    platform: 'win32',
    timeoutMs: 100,
    execFileImpl: malformedExecFileImpl,
  };
  const assertInvalidInput = async (input, label) => {
    const invalidResult = await invokeExactWindowsTaskkill(input);
    assert.deepStrictEqual(invalidResult, invalidExpected, label);
  };

  await assertInvalidInput({ ...malformedBase, unknown: true }, 'unknown top key');

  const symbolTopKeyInput = { ...malformedBase, [Symbol('unknown')]: true };
  await assertInvalidInput(symbolTopKeyInput, 'symbol top key');

  const topTargetAccessorInput = {
    platform: 'win32',
    timeoutMs: 100,
    execFileImpl: malformedExecFileImpl,
  };
  Object.defineProperty(topTargetAccessorInput, 'target', {
    enumerable: true,
    configurable: true,
    get() {
      throw new Error('must not read target');
    },
  });
  await assertInvalidInput(topTargetAccessorInput, 'top target accessor');

  const nonEnumerableTopTargetInput = {
    platform: 'win32',
    timeoutMs: 100,
    execFileImpl: malformedExecFileImpl,
  };
  Object.defineProperty(nonEnumerableTopTargetInput, 'target', {
    value: target,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  await assertInvalidInput(nonEnumerableTopTargetInput, 'non-enumerable top target data property');

  await assertInvalidInput({
    ...malformedBase,
    target: { pid: 0, creationToken: target.creationToken },
  }, 'bad pid 0');
  await assertInvalidInput({
    ...malformedBase,
    target: { pid: target.pid, creationToken: ` ${target.creationToken}` },
  }, 'leading-space token');
  await assertInvalidInput({
    ...malformedBase,
    target: { pid: target.pid, creationToken: `${target.creationToken} ` },
  }, 'trailing-space token');
  await assertInvalidInput({
    ...malformedBase,
    target: { pid: target.pid, creationToken: `${target.creationToken}\u0000` },
  }, 'control-char token');
  await assertInvalidInput({
    ...malformedBase,
    target: { pid: target.pid, creationToken: 'x'.repeat(129) },
  }, '129-char token');
  await assertInvalidInput({ ...malformedBase, timeoutMs: 9 }, 'timeout 9');
  await assertInvalidInput({ ...malformedBase, timeoutMs: 15001 }, 'timeout 15001');
  await assertInvalidInput({ ...malformedBase, execFileImpl: null }, 'nonfunction execFileImpl');
  await assertInvalidInput({ ...malformedBase, platform: 42 }, 'nonstring platform');

  await assertInvalidInput(new Proxy({ ...malformedBase }, {}), 'well-behaved top-level proxy');
  await assertInvalidInput({
    ...malformedBase,
    target: new Proxy(target, {}),
  }, 'well-behaved target proxy');
  assert.equal(malformedExecCalls, 0);

  const { proxy: revokedInput, revoke } = Proxy.revocable({ ...malformedBase }, {});
  revoke();
  let revokedResult;
  await assert.doesNotReject(async () => {
    revokedResult = await invokeExactWindowsTaskkill(revokedInput);
  });
  assert.deepStrictEqual(revokedResult, invalidExpected, 'revoked top-level proxy');
  assert.equal(malformedExecCalls, 0);
}

{
  const commandErrorCases = [
    {
      label: 'synchronous throw',
      expectedError: 'termination-command-failed',
      execFileImpl() {
        throw new Error('injected synchronous command failure');
      },
    },
    {
      label: 'generic callback error',
      expectedError: 'termination-command-failed',
      execFileImpl(_command, _args, _options, callback) {
        callback(new Error('injected callback command failure'));
        return { kill() {} };
      },
    },
    {
      label: 'ETIMEDOUT callback error',
      expectedError: 'termination-command-timeout',
      execFileImpl(_command, _args, _options, callback) {
        callback({ code: 'ETIMEDOUT', message: 'injected timeout detail' });
        return { kill() {} };
      },
    },
    {
      label: 'killed callback error',
      expectedError: 'termination-command-timeout',
      execFileImpl(_command, _args, _options, callback) {
        callback({ code: 'EOTHER', killed: true, message: 'injected killed detail' });
        return { kill() {} };
      },
    },
    {
      label: 'output overflow callback error',
      expectedError: 'termination-command-output-overflow',
      execFileImpl(_command, _args, _options, callback) {
        callback({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', message: 'injected overflow detail' });
        return { kill() {} };
      },
    },
    {
      label: 'code getter throw',
      expectedError: 'termination-command-failed',
      execFileImpl(_command, _args, _options, callback) {
        const error = {};
        Object.defineProperty(error, 'code', {
          get() {
            throw new Error('injected code getter failure');
          },
        });
        callback(error);
        return { kill() {} };
      },
    },
  ];

  for (const { label, expectedError, execFileImpl } of commandErrorCases) {
    const commandErrorResult = await invokeExactWindowsTaskkill({
      target,
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl,
    });
    assert.deepStrictEqual(
      Reflect.ownKeys(commandErrorResult),
      ['complete', 'errors', 'attempted', 'target'],
      label,
    );
    assert.deepStrictEqual(commandErrorResult, {
      complete: false,
      errors: [expectedError],
      attempted: true,
      target: { pid: 4242, creationToken: 'token-4242' },
    }, label);
    assert.notStrictEqual(commandErrorResult.target, target, label);
  }
}

{
  const outputBoundaryCases = [
    {
      label: 'Buffer stdout with string stderr',
      stdout: Buffer.from('SUCCESS'),
      stderr: '',
      expected: { complete: false, errors: ['termination-command-output-invalid'] },
    },
    {
      label: 'string stdout with Buffer stderr',
      stdout: 'SUCCESS',
      stderr: Buffer.from(''),
      expected: { complete: false, errors: ['termination-command-output-invalid'] },
    },
    {
      label: '65537 ASCII chars stdout',
      stdout: 'a'.repeat(65537),
      stderr: '',
      expected: { complete: false, errors: ['termination-command-output-overflow'] },
    },
    {
      label: '65537 ASCII chars stderr',
      stdout: '',
      stderr: 'a'.repeat(65537),
      expected: { complete: false, errors: ['termination-command-output-overflow'] },
    },
    {
      label: 'exactly 65536 ASCII chars stdout and stderr',
      stdout: 'a'.repeat(65536),
      stderr: 'b'.repeat(65536),
      expected: { complete: true, errors: [] },
    },
  ];

  const assertAttemptedResult = (actual, expected, label) => {
    assert.deepStrictEqual(
      Reflect.ownKeys(actual),
      ['complete', 'errors', 'attempted', 'target'],
      label,
    );
    assert.deepStrictEqual(actual, {
      ...expected,
      attempted: true,
      target: { pid: 4242, creationToken: 'token-4242' },
    }, label);
    assert.notStrictEqual(actual.target, target, label);
  };

  for (const { label, stdout, stderr, expected } of outputBoundaryCases) {
    const outputBoundaryResult = await invokeExactWindowsTaskkill({
      target,
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, stdout, stderr);
        return { kill() {} };
      },
    });
    assertAttemptedResult(outputBoundaryResult, expected, label);
  }

  const duplicateCallbackCases = [
    {
      label: 'success then generic error',
      expected: { complete: true, errors: [] },
      execFileImpl(_command, _args, _options, callback) {
        callback(null, 'SUCCESS', '');
        callback(new Error('injected duplicate callback failure'));
        return { kill() {} };
      },
    },
    {
      label: 'generic error then success',
      expected: { complete: false, errors: ['termination-command-failed'] },
      execFileImpl(_command, _args, _options, callback) {
        callback(new Error('injected callback command failure'));
        callback(null, 'SUCCESS', '');
        return { kill() {} };
      },
    },
  ];

  for (const { label, expected, execFileImpl } of duplicateCallbackCases) {
    const duplicateCallbackResult = await invokeExactWindowsTaskkill({
      target,
      platform: 'win32',
      timeoutMs: 100,
      execFileImpl,
    });
    assertAttemptedResult(duplicateCallbackResult, expected, label);
  }
}

{
  const timeoutInput = (execFileImpl) => ({
    target,
    platform: 'win32',
    timeoutMs: 10,
    execFileImpl,
  });
  const timeoutExpected = {
    complete: false,
    errors: ['termination-command-timeout'],
    attempted: true,
    target: { pid: 4242, creationToken: 'token-4242' },
  };
  const invokeWithWatchdog = async (input) => {
    let watchdog;
    try {
      const watchdogRejection = new Promise((_, reject) => {
        watchdog = setTimeout(() => reject(new Error('selftest watchdog expired')), 1000);
      });
      return await Promise.race([
        invokeExactWindowsTaskkill(input),
        watchdogRejection,
      ]);
    } finally {
      clearTimeout(watchdog);
    }
  };
  const assertTimeoutResult = (actual, label) => {
    assert.deepStrictEqual(
      Reflect.ownKeys(actual),
      ['complete', 'errors', 'attempted', 'target'],
      label,
    );
    assert.deepStrictEqual(actual, timeoutExpected, label);
    assert.notStrictEqual(actual.target, target, label);
  };
  const assertStableTimeout = async (input, label) => {
    let actual;
    await assert.doesNotReject(async () => {
      actual = await invokeWithWatchdog(input);
    }, label);
    assertTimeoutResult(actual, label);
    return actual;
  };

  let killCount = 0;
  await assertStableTimeout(timeoutInput(() => ({
    kill() {
      killCount += 1;
    },
  })), 'helper kill once');
  assert.equal(killCount, 1, 'helper kill once');

  await assertStableTimeout(timeoutInput(() => ({
    get kill() {
      throw new Error('injected kill getter failure');
    },
  })), 'helper kill getter throws');

  await assertStableTimeout(timeoutInput(() => undefined), 'undefined helper');

  let lateCallbackCount = 0;
  let resolveLateCallback;
  const lateCallbackObserved = new Promise((resolve) => {
    resolveLateCallback = resolve;
  });
  let lateKillCount = 0;
  const lateResult = await assertStableTimeout(timeoutInput((_command, _args, _options, callback) => {
    setTimeout(() => {
      lateCallbackCount += 1;
      callback(null, 'SUCCESS', '');
      resolveLateCallback();
    }, 80);
    return {
      kill() {
        lateKillCount += 1;
      },
    };
  }), 'late callback');
  assert.equal(lateKillCount, 1, 'late callback helper kill once');
  await lateCallbackObserved;
  assert.equal(lateCallbackCount, 1, 'late callback once');
  assertTimeoutResult(lateResult, 'late callback remains first timeout');
}

console.log('e2e process termination command selftest: 6/6 PASS');
