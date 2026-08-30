import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePosixPsProcessTable, parseWindowsWmicProcessCsv } from './e2e-process-table.mjs';

const DEFAULT_TIMEOUT_MS = 5000;
const MIN_TIMEOUT_MS = 10;
const MAX_TIMEOUT_MS = 15000;
const TIMER_GRACE_MS = 50;
const MAX_BUFFER = 4 * 1024 * 1024;
const SUPPORTED_POSIX_PLATFORMS = new Set([
  'aix',
  'android',
  'darwin',
  'freebsd',
  'linux',
  'openbsd',
  'sunos',
]);

const FAILURE_CODES = Object.freeze({
  OPTIONS_INVALID: 'snapshot-options-invalid',
  COMMAND_FAILED: 'snapshot-command-failed',
  COMMAND_TIMEOUT: 'snapshot-command-timeout',
  OUTPUT_OVERFLOW: 'snapshot-output-overflow',
  OUTPUT_INVALID: 'snapshot-output-invalid',
  PLATFORM_UNSUPPORTED: 'snapshot-platform-unsupported',
});

const WINDOWS_PROCESS_TABLE_COMMAND = 'powershell.exe';
const WINDOWS_PROCESS_TABLE_SCRIPT = [
  "$ErrorActionPreference = 'Stop';",
  "$ProgressPreference = 'SilentlyContinue';",
  "'Node,CreationDate,ParentProcessId,ProcessId';",
  'Get-CimInstance -ClassName Win32_Process -Property CreationDate,ParentProcessId,ProcessId | ForEach-Object {',
  "if ($null -eq $_.CreationDate -or $null -eq $_.ParentProcessId -or $null -eq $_.ProcessId) { throw 'incomplete Win32_Process row' };",
  "\"{0},{1},{2},{3}\" -f '.', [System.Management.ManagementDateTimeConverter]::ToDmtfDateTime($_.CreationDate), $_.ParentProcessId, $_.ProcessId",
  '}',
].join(' ');
const WINDOWS_PROCESS_TABLE_ARGS = Object.freeze([
  '-NoLogo',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  WINDOWS_PROCESS_TABLE_SCRIPT,
]);

function failure(code) {
  return { complete: false, errors: [code], rows: [] };
}

function readDataProperty(input, key) {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined || !('value' in descriptor)) {
    return { valid: false, value: undefined };
  }
  return { valid: true, value: descriptor.value };
}

function normalizeOptions(input, { includePlatform = false } = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }

  const keys = Reflect.ownKeys(input);
  for (const key of keys) {
    if (typeof key !== 'string'
      || (key !== 'execFileImpl'
        && key !== 'timeoutMs'
        && (!includePlatform || key !== 'platform'))) {
      return null;
    }
  }

  let execFileImpl = execFile;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let platform = process.platform;

  if (includePlatform && keys.includes('platform')) {
    const value = readDataProperty(input, 'platform');
    if (!value.valid || typeof value.value !== 'string') {
      return null;
    }
    platform = value.value;
  }

  if (keys.includes('execFileImpl')) {
    const value = readDataProperty(input, 'execFileImpl');
    if (!value.valid) {
      return null;
    }
    execFileImpl = value.value === undefined ? execFile : value.value;
  }

  if (keys.includes('timeoutMs')) {
    const value = readDataProperty(input, 'timeoutMs');
    if (!value.valid) {
      return null;
    }
    timeoutMs = value.value === undefined ? DEFAULT_TIMEOUT_MS : value.value;
  }

  if (typeof execFileImpl !== 'function' || !Number.isSafeInteger(timeoutMs)) {
    return null;
  }
  if (timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    return null;
  }

  return includePlatform
    ? { platform, execFileImpl, timeoutMs }
    : { execFileImpl, timeoutMs };
}

function mapCommandError(error) {
  let code;
  let killed;
  try {
    code = error?.code;
    killed = error?.killed;
  } catch {
    return FAILURE_CODES.COMMAND_FAILED;
  }

  if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
    return FAILURE_CODES.OUTPUT_OVERFLOW;
  }
  if (killed || code === 'ETIMEDOUT') {
    return FAILURE_CODES.COMMAND_TIMEOUT;
  }
  return FAILURE_CODES.COMMAND_FAILED;
}

function mapParserResult(parsed) {
  if (parsed.complete === true) {
    return { complete: true, errors: [], rows: parsed.rows };
  }

  const parserErrors = Array.isArray(parsed.errors) ? parsed.errors : [];
  const errors = parserErrors.map((code) => `snapshot-parse-${code}`);
  return {
    complete: false,
    errors: errors.length > 0 ? errors : ['snapshot-parse-invalid-result'],
    rows: [],
  };
}

function captureCommandProcessTableSnapshot(input, { command, args, parser, makeExtraOptions }) {
  let normalizedOptions;
  try {
    normalizedOptions = normalizeOptions(input);
  } catch {
    return failure(FAILURE_CODES.OPTIONS_INVALID);
  }

  if (normalizedOptions === null) {
    return failure(FAILURE_CODES.OPTIONS_INVALID);
  }

  const { execFileImpl, timeoutMs } = normalizedOptions;

  return new Promise((resolve) => {
    let settled = false;
    let timeoutTriggered = false;
    let helper;
    let killAttempted = false;
    let timer;

    const killHelper = () => {
      if (killAttempted || helper === undefined || helper === null) {
        return;
      }
      killAttempted = true;
      try {
        const kill = helper.kill;
        if (typeof kill === 'function') {
          kill.call(helper);
        }
      } catch {
        // A best-effort kill must not change the stable timeout result.
      }
    };

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        clearTimeout(timer);
      } catch {
        // The result remains settled even if timer cleanup is unavailable.
      }
      resolve(result);
    };

    const handleCallback = (error, stdout) => {
      if (settled || timeoutTriggered) {
        return;
      }

      try {
        if (error !== null && error !== undefined) {
          finish(failure(mapCommandError(error)));
          return;
        }

        if (typeof stdout !== 'string') {
          finish(failure(FAILURE_CODES.OUTPUT_INVALID));
          return;
        }

        finish(mapParserResult(parser(stdout)));
      } catch {
        finish(failure(FAILURE_CODES.COMMAND_FAILED));
      }
    };

    try {
      timer = setTimeout(() => {
        if (settled) {
          return;
        }
        timeoutTriggered = true;
        finish(failure(FAILURE_CODES.COMMAND_TIMEOUT));
        killHelper();
      }, timeoutMs + TIMER_GRACE_MS);

      const commandOptions = {
        shell: false,
        windowsHide: true,
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        killSignal: 'SIGKILL',
      };
      if (makeExtraOptions !== undefined) {
        Object.assign(commandOptions, makeExtraOptions());
      }

      helper = execFileImpl(
        command,
        args,
        commandOptions,
        handleCallback,
      );

      if (timeoutTriggered) {
        killHelper();
      }
    } catch {
      finish(failure(FAILURE_CODES.COMMAND_FAILED));
    }
  });
}

/**
 * Capture and parse a Windows process table using PowerShell/CIM and the
 * existing WMIC-compatible CSV contract.
 *
 * @param {unknown} options
 * @returns {Promise<{complete: boolean, errors: string[], rows: Array<object>}>}
 */
export async function captureWindowsProcessTableSnapshot(options = {}) {
  return captureCommandProcessTableSnapshot(options, {
    command: WINDOWS_PROCESS_TABLE_COMMAND,
    args: WINDOWS_PROCESS_TABLE_ARGS,
    parser: parseWindowsWmicProcessCsv,
  });
}

/**
 * Capture and parse the POSIX ps process table.
 *
 * @param {unknown} options
 * @returns {Promise<{complete: boolean, errors: string[], rows: Array<object>}>}
 */
export async function capturePosixProcessTableSnapshot(options = {}) {
  return captureCommandProcessTableSnapshot(options, {
    command: 'ps',
    args: ['-e', '-o', 'pid=,ppid=,lstart='],
    parser: parsePosixPsProcessTable,
    makeExtraOptions() {
      return { env: { ...process.env, LC_ALL: 'C', LANG: 'C' } };
    },
  });
}

const SELFTEST_WINDOWS_HEADER = 'Node,CreationDate,ParentProcessId,ProcessId';
const SELFTEST_SECRET = 'SELFTEST_SECRET_SENTINEL_MUST_NOT_LEAK';
const SELFTEST_ENV_SENTINEL_KEY = 'X4_FORGE_PROCESS_TABLE_ADAPTER_SELFTEST_SENTINEL';
const SELFTEST_ENV_SENTINEL_VALUE = 'x4-forge-process-table-adapter-selftest-sentinel';
const SELFTEST_WATCHDOG_MS = 1000;

function selftestSnapshotText({ crcrlf = false } = {}) {
  const separator = crcrlf ? '\r\r\n' : '\n';
  return [
    SELFTEST_WINDOWS_HEADER,
    'DESKTOP-SELFTEST,20260802043333.860108-240,4,42',
    'DESKTOP-SELFTEST,20260802043334.860108-240,42,84',
  ].join(separator);
}

function selftestPosixSnapshotText({ crcrlf = false } = {}) {
  const separator = crcrlf ? '\r\r\n' : '\n';
  return [
    ' \t20\t4\tTue Aug  4 05:06:07 2026 \t',
    '\t3\t1\tSun Jan  1 00:00:00 2026\t',
  ].join(separator);
}

function assertSnapshotResult(result, expected) {
  assert.deepEqual(Object.keys(result), ['complete', 'errors', 'rows']);
  assert.deepEqual(result, expected);
}

function expectedFailure(code) {
  return { complete: false, errors: [code], rows: [] };
}

function expectedWindowsCommandCall(timeoutMs) {
  return {
    command: 'powershell.exe',
    args: [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      [
        "$ErrorActionPreference = 'Stop';",
        "$ProgressPreference = 'SilentlyContinue';",
        "'Node,CreationDate,ParentProcessId,ProcessId';",
        'Get-CimInstance -ClassName Win32_Process -Property CreationDate,ParentProcessId,ProcessId | ForEach-Object {',
        "if ($null -eq $_.CreationDate -or $null -eq $_.ParentProcessId -or $null -eq $_.ProcessId) { throw 'incomplete Win32_Process row' };",
        "\"{0},{1},{2},{3}\" -f '.', [System.Management.ManagementDateTimeConverter]::ToDmtfDateTime($_.CreationDate), $_.ParentProcessId, $_.ProcessId",
        '}',
      ].join(' '),
    ],
    options: {
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      killSignal: 'SIGKILL',
    },
    callbackType: 'function',
  };
}

async function settleWithSelftestWatchdog(promise, label) {
  let watchdog;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        watchdog = setTimeout(() => {
          reject(new Error(`${label} did not settle within ${SELFTEST_WATCHDOG_MS} ms`));
        }, SELFTEST_WATCHDOG_MS);
      }),
    ]);
  } finally {
    clearTimeout(watchdog);
  }
}

/**
 * Capture and parse the process table for the current or requested platform.
 *
 * @param {unknown} options
 * @returns {Promise<{complete: boolean, errors: string[], rows: Array<object>}>}
 */
export async function captureProcessTableSnapshot(options = {}) {
  let normalizedOptions;
  try {
    normalizedOptions = normalizeOptions(options, { includePlatform: true });
  } catch {
    return failure(FAILURE_CODES.OPTIONS_INVALID);
  }

  if (normalizedOptions === null) {
    return failure(FAILURE_CODES.OPTIONS_INVALID);
  }

  const { platform, execFileImpl, timeoutMs } = normalizedOptions;
  const delegatedOptions = { execFileImpl, timeoutMs };
  if (platform === 'win32') {
    return captureWindowsProcessTableSnapshot(delegatedOptions);
  }
  if (SUPPORTED_POSIX_PLATFORMS.has(platform)) {
    return capturePosixProcessTableSnapshot(delegatedOptions);
  }
  return failure(FAILURE_CODES.PLATFORM_UNSUPPORTED);
}

async function runSelftest() {
  let checks = 0;
  const check = async (name, test) => {
    try {
      await test();
      checks += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${name}: ${detail}`);
    }
  };

  await check('exact Windows command and options', async () => {
    const calls = [];
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: 1234,
      execFileImpl(command, args, options, callback) {
        calls.push({ command, args, options, callbackType: typeof callback });
        callback(null, selftestSnapshotText());
        return { kill() {} };
      },
    });

    assertSnapshotResult(result, {
      complete: true,
      errors: [],
      rows: [
        { pid: 42, parentPid: 4, creationToken: '20260802043333.860108-240' },
        { pid: 84, parentPid: 42, creationToken: '20260802043334.860108-240' },
      ],
    });
    assert.deepEqual(calls, [expectedWindowsCommandCall(1234)]);
  });

  await check('exact POSIX command and common bounded options', async () => {
    let call;
    const result = await capturePosixProcessTableSnapshot({
      timeoutMs: 1234,
      execFileImpl(command, args, options, callback) {
        call = { command, args, options, callbackType: typeof callback };
        callback(null, selftestPosixSnapshotText());
        return { kill() {} };
      },
    });

    assertSnapshotResult(result, {
      complete: true,
      errors: [],
      rows: [
        { pid: 3, parentPid: 1, creationToken: 'Sun Jan 1 00:00:00 2026' },
        { pid: 20, parentPid: 4, creationToken: 'Tue Aug 4 05:06:07 2026' },
      ],
    });
    assert.equal(call.command, 'ps');
    assert.deepEqual(call.args, ['-e', '-o', 'pid=,ppid=,lstart=']);
    assert.deepEqual({
      shell: call.options.shell,
      windowsHide: call.options.windowsHide,
      encoding: call.options.encoding,
      timeout: call.options.timeout,
      maxBuffer: call.options.maxBuffer,
      killSignal: call.options.killSignal,
    }, {
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 1234,
      maxBuffer: 4 * 1024 * 1024,
      killSignal: 'SIGKILL',
    });
    assert.equal(call.options.env.LC_ALL, 'C');
    assert.equal(call.options.env.LANG, 'C');
    assert.equal(call.callbackType, 'function');
  });

  await check('POSIX environment sentinel is copied and restored', async () => {
    const previousValue = process.env[SELFTEST_ENV_SENTINEL_KEY];
    let childOptions;
    let result;
    try {
      process.env[SELFTEST_ENV_SENTINEL_KEY] = SELFTEST_ENV_SENTINEL_VALUE;
      result = await capturePosixProcessTableSnapshot({
        timeoutMs: 10,
        execFileImpl(_command, _args, options, callback) {
          childOptions = options;
          callback(null, selftestPosixSnapshotText());
          return { kill() {} };
        },
      });
      assert.equal(childOptions.env[SELFTEST_ENV_SENTINEL_KEY], SELFTEST_ENV_SENTINEL_VALUE);
      assert.equal(childOptions.env.LC_ALL, 'C');
      assert.equal(childOptions.env.LANG, 'C');
      assert(!JSON.stringify(result).includes(SELFTEST_ENV_SENTINEL_KEY));
      assert(!JSON.stringify(result).includes(SELFTEST_ENV_SENTINEL_VALUE));
    } finally {
      if (previousValue === undefined) {
        delete process.env[SELFTEST_ENV_SENTINEL_KEY];
      } else {
        process.env[SELFTEST_ENV_SENTINEL_KEY] = previousValue;
      }
    }
    assert.equal(process.env[SELFTEST_ENV_SENTINEL_KEY], previousValue);
  });

  await check('valid POSIX whitespace/tab/CRCRLF result shape and rows', async () => {
    const result = await capturePosixProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, selftestPosixSnapshotText({ crcrlf: true }));
        return { kill() {} };
      },
    });

    assertSnapshotResult(result, {
      complete: true,
      errors: [],
      rows: [
        { pid: 3, parentPid: 1, creationToken: 'Sun Jan 1 00:00:00 2026' },
        { pid: 20, parentPid: 4, creationToken: 'Tue Aug 4 05:06:07 2026' },
      ],
    });
  });

  await check('malformed POSIX output uses stable snapshot-parse codes', async () => {
    const missingFieldsResult = await capturePosixProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, '123 1 Tue Aug 4 05:06:07 2026 extra');
        return { kill() {} };
      },
    });
    assertSnapshotResult(missingFieldsResult, {
      complete: false,
      errors: ['snapshot-parse-malformed-row', 'snapshot-parse-no-usable-rows'],
      rows: [],
    });

    const weekdayResult = await capturePosixProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, '123 1 Fud Aug 4 05:06:07 2026');
        return { kill() {} };
      },
    });
    assertSnapshotResult(weekdayResult, {
      complete: false,
      errors: ['snapshot-parse-invalid-weekday', 'snapshot-parse-no-usable-rows'],
      rows: [],
    });
  });

  await check('never-callback POSIX timeout is bounded and kills returned helper once', async () => {
    let killCalls = 0;
    const result = await settleWithSelftestWatchdog(
      capturePosixProcessTableSnapshot({
        timeoutMs: MIN_TIMEOUT_MS,
        execFileImpl() {
          return {
            kill() {
              killCalls += 1;
            },
          };
        },
      }),
      'POSIX never-callback snapshot',
    );
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.COMMAND_TIMEOUT));
    assert.equal(killCalls, 1);
  });

  await check('valid WMIC CRCRLF result shape and rows', async () => {
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, selftestSnapshotText({ crcrlf: true }), 'ignored stderr');
        return { kill() {} };
      },
    });

    assertSnapshotResult(result, {
      complete: true,
      errors: [],
      rows: [
        { pid: 42, parentPid: 4, creationToken: '20260802043333.860108-240' },
        { pid: 84, parentPid: 42, creationToken: '20260802043334.860108-240' },
      ],
    });
  });

  await check('malformed scalar/null/array/extra-key options', async () => {
    const invalidOptions = [null, 42, 'options', [], { extraKey: true }];
    for (const options of invalidOptions) {
      const result = await captureWindowsProcessTableSnapshot(options);
      assertSnapshotResult(result, expectedFailure(FAILURE_CODES.OPTIONS_INVALID));
    }
  });

  await check('accessor and revoked-proxy options never throw', async () => {
    for (const accessorKey of ['timeoutMs', 'execFileImpl']) {
      const accessorOptions = {};
      Object.defineProperty(accessorOptions, accessorKey, {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error(SELFTEST_SECRET);
        },
      });
      const accessorResult = await captureWindowsProcessTableSnapshot(accessorOptions);
      assertSnapshotResult(accessorResult, expectedFailure(FAILURE_CODES.OPTIONS_INVALID));
    }

    const revoked = Proxy.revocable({ execFileImpl() {} }, {});
    revoked.revoke();
    const revokedResult = await captureWindowsProcessTableSnapshot(revoked.proxy);
    assertSnapshotResult(revokedResult, expectedFailure(FAILURE_CODES.OPTIONS_INVALID));
  });

  await check('invalid timeout values', async () => {
    const invalidTimeouts = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      9,
      15001,
      10.5,
      '10',
      null,
      Number.MAX_SAFE_INTEGER + 1,
    ];
    for (const timeoutMs of invalidTimeouts) {
      const result = await captureWindowsProcessTableSnapshot({
        timeoutMs,
        execFileImpl() {
          throw new Error('invalid timeout must not execute');
        },
      });
      assertSnapshotResult(result, expectedFailure(FAILURE_CODES.OPTIONS_INVALID));
    }
  });

  await check('nonfunction executor', async () => {
    for (const execFileImpl of [null, {}, 'not a function', 0]) {
      const result = await captureWindowsProcessTableSnapshot({ execFileImpl, timeoutMs: 10 });
      assertSnapshotResult(result, expectedFailure(FAILURE_CODES.OPTIONS_INVALID));
    }
  });

  await check('synchronous executor throw', async () => {
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl() {
        throw new Error(SELFTEST_SECRET);
      },
    });
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.COMMAND_FAILED));
  });

  await check('generic callback error', async () => {
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(new Error(SELFTEST_SECRET), 'ignored stdout', SELFTEST_SECRET);
        return { kill() {} };
      },
    });
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.COMMAND_FAILED));
  });

  await check('killed callback error timeout classification', async () => {
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback({ code: 'EOTHER', killed: true, message: SELFTEST_SECRET });
        return { kill() {} };
      },
    });
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.COMMAND_TIMEOUT));
  });

  await check('ETIMEDOUT callback error timeout classification', async () => {
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback({ code: 'ETIMEDOUT', killed: false, message: SELFTEST_SECRET });
        return { kill() {} };
      },
    });
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.COMMAND_TIMEOUT));
  });

  await check('max-buffer overflow classification', async () => {
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', killed: true });
        return { kill() {} };
      },
    });
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.OUTPUT_OVERFLOW));
  });

  await check('non-string stdout classification', async () => {
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, Buffer.from(selftestSnapshotText()), SELFTEST_SECRET);
        return { kill() {} };
      },
    });
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.OUTPUT_INVALID));
  });

  await check('malformed parser output uses stable snapshot-parse codes', async () => {
    const headerResult = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, 'wrong,header,shape,here');
        return { kill() {} };
      },
    });
    assertSnapshotResult(headerResult, {
      complete: false,
      errors: ['snapshot-parse-header-mismatch'],
      rows: [],
    });

    const rowResult = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, [
          SELFTEST_WINDOWS_HEADER,
          'NODE,not-a-creation-token,4,42',
          'NODE,20260802043333.860108-240,4,84',
        ].join('\n'));
        return { kill() {} };
      },
    });
    assertSnapshotResult(rowResult, {
      complete: false,
      errors: ['snapshot-parse-invalid-creation-token'],
      rows: [],
    });
  });

  await check('callback invoked twice settles once', async () => {
    let callbackCalls = 0;
    let killCalls = 0;
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callbackCalls += 1;
        callback(null, selftestSnapshotText());
        callbackCalls += 1;
        callback({ code: 'ETIMEDOUT' }, '', SELFTEST_SECRET);
        return {
          kill() {
            killCalls += 1;
          },
        };
      },
    });
    assert.equal(callbackCalls, 2);
    assert.equal(killCalls, 0);
    assert.equal(result.complete, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.rows.length, 2);
  });

  await check('never-callback timeout is bounded and kills returned helper once', async () => {
    let killCalls = 0;
    const result = await settleWithSelftestWatchdog(
      captureWindowsProcessTableSnapshot({
        timeoutMs: MIN_TIMEOUT_MS,
        execFileImpl() {
          return {
            kill() {
              killCalls += 1;
            },
          };
        },
      }),
      'Windows never-callback snapshot',
    );
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.COMMAND_TIMEOUT));
    assert.equal(killCalls, 1);
  });

  await check('helper kill getter throw remains stable', async () => {
    let getterCalls = 0;
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: MIN_TIMEOUT_MS,
      execFileImpl() {
        const helper = {};
        Object.defineProperty(helper, 'kill', {
          get() {
            getterCalls += 1;
            throw new Error(SELFTEST_SECRET);
          },
        });
        return helper;
      },
    });
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.COMMAND_TIMEOUT));
    assert.equal(getterCalls, 1);
  });

  await check('helper kill throw remains stable', async () => {
    let killCalls = 0;
    const result = await captureWindowsProcessTableSnapshot({
      timeoutMs: MIN_TIMEOUT_MS,
      execFileImpl() {
        return {
          kill() {
            killCalls += 1;
            throw new Error(SELFTEST_SECRET);
          },
        };
      },
    });
    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.COMMAND_TIMEOUT));
    assert.equal(killCalls, 1);
  });

  await check('secret sentinels never enter result errors', async () => {
    const errorResult = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(new Error(SELFTEST_SECRET), '', SELFTEST_SECRET);
        return { kill() {} };
      },
    });
    const stdoutResult = await captureWindowsProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, `${SELFTEST_WINDOWS_HEADER}\n${SELFTEST_SECRET},not-a-token,4,not-a-pid`, SELFTEST_SECRET);
        return { kill() {} };
      },
    });
    const serializedErrors = JSON.stringify([
      ...errorResult.errors,
      ...stdoutResult.errors,
    ]);
    assert(!serializedErrors.includes(SELFTEST_SECRET));
    assert(!JSON.stringify(errorResult).includes(SELFTEST_SECRET));
    assert(!JSON.stringify(stdoutResult).includes(SELFTEST_SECRET));
  });

  await check('POSIX secret sentinels never enter result errors', async () => {
    const errorResult = await capturePosixProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(new Error(`${SELFTEST_SECRET}: error`), '', `${SELFTEST_SECRET}: stderr`);
        return { kill() {} };
      },
    });
    const stdoutResult = await capturePosixProcessTableSnapshot({
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, `${SELFTEST_SECRET}: stdout`, `${SELFTEST_SECRET}: stderr`);
        return { kill() {} };
      },
    });
    const serializedResults = JSON.stringify([errorResult, stdoutResult]);
    assert(!serializedResults.includes(SELFTEST_SECRET));
    assert(!JSON.stringify([
      ...errorResult.errors,
      ...stdoutResult.errors,
    ]).includes(SELFTEST_SECRET));
  });

  await check('generic Windows dispatcher uses exact command and options', async () => {
    const calls = [];
    const result = await captureProcessTableSnapshot({
      platform: 'win32',
      timeoutMs: 1234,
      execFileImpl(command, args, options, callback) {
        calls.push({ command, args, options, callbackType: typeof callback });
        callback(null, selftestSnapshotText());
        return { kill() {} };
      },
    });

    assertSnapshotResult(result, {
      complete: true,
      errors: [],
      rows: [
        { pid: 42, parentPid: 4, creationToken: '20260802043333.860108-240' },
        { pid: 84, parentPid: 42, creationToken: '20260802043334.860108-240' },
      ],
    });
    assert.deepEqual(calls, [expectedWindowsCommandCall(1234)]);
  });

  await check('generic POSIX dispatcher supports every accepted platform', async () => {
    for (const platform of SUPPORTED_POSIX_PLATFORMS) {
      let call;
      const result = await captureProcessTableSnapshot({
        platform,
        timeoutMs: 1234,
        execFileImpl(command, args, options, callback) {
          call = { command, args, options, callbackType: typeof callback };
          callback(null, selftestPosixSnapshotText());
          return { kill() {} };
        },
      });

      assertSnapshotResult(result, {
        complete: true,
        errors: [],
        rows: [
          { pid: 3, parentPid: 1, creationToken: 'Sun Jan 1 00:00:00 2026' },
          { pid: 20, parentPid: 4, creationToken: 'Tue Aug 4 05:06:07 2026' },
        ],
      });
      assert.deepEqual(call, {
        command: 'ps',
        args: ['-e', '-o', 'pid=,ppid=,lstart='],
        options: {
          shell: false,
          windowsHide: true,
          encoding: 'utf8',
          timeout: 1234,
          maxBuffer: 4 * 1024 * 1024,
          killSignal: 'SIGKILL',
          env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
        },
        callbackType: 'function',
      });
    }
  });

  await check('unsupported generic platform refuses without execution', async () => {
    let executorCalls = 0;
    const result = await captureProcessTableSnapshot({
      platform: 'plan9',
      timeoutMs: 10,
      execFileImpl() {
        executorCalls += 1;
        throw new Error('unsupported platform must not execute');
      },
    });

    assertSnapshotResult(result, expectedFailure(FAILURE_CODES.PLATFORM_UNSUPPORTED));
    assert.equal(executorCalls, 0);
  });

  await check('generic default platform dispatch uses this host', async () => {
    const expected = process.platform === 'win32'
      ? {
        command: 'powershell.exe',
        args: expectedWindowsCommandCall(1234).args,
        output: selftestSnapshotText(),
        rows: [
          { pid: 42, parentPid: 4, creationToken: '20260802043333.860108-240' },
          { pid: 84, parentPid: 42, creationToken: '20260802043334.860108-240' },
        ],
      }
      : SUPPORTED_POSIX_PLATFORMS.has(process.platform)
        ? {
          command: 'ps',
          args: ['-e', '-o', 'pid=,ppid=,lstart='],
          output: selftestPosixSnapshotText(),
          rows: [
            { pid: 3, parentPid: 1, creationToken: 'Sun Jan 1 00:00:00 2026' },
            { pid: 20, parentPid: 4, creationToken: 'Tue Aug 4 05:06:07 2026' },
          ],
        }
        : null;
    let executorCalls = 0;
    let call;
    const result = await captureProcessTableSnapshot({
      timeoutMs: 1234,
      execFileImpl(command, args, options, callback) {
        executorCalls += 1;
        call = { command, args, options, callbackType: typeof callback };
        callback(null, expected.output);
        return { kill() {} };
      },
    });

    if (expected === null) {
      assertSnapshotResult(result, expectedFailure(FAILURE_CODES.PLATFORM_UNSUPPORTED));
      assert.equal(executorCalls, 0);
      return;
    }

    assertSnapshotResult(result, {
      complete: true,
      errors: [],
      rows: expected.rows,
    });
    assert.equal(executorCalls, 1);
    assert.deepEqual(call.command, expected.command);
    assert.deepEqual(call.args, expected.args);
    assert.equal(call.options.timeout, 1234);
    if (expected.command === 'ps') {
      assert.equal(call.options.env.LC_ALL, 'C');
      assert.equal(call.options.env.LANG, 'C');
    }
  });

  if (process.platform === 'win32') {
    await check('current Windows PowerShell/CIM capture includes own PID', async () => {
      const result = await captureProcessTableSnapshot({
        platform: 'win32',
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      assert.equal(result.complete, true);
      assert.deepEqual(result.errors, []);
      assert(result.rows.length > 0);
      for (let index = 1; index < result.rows.length; index += 1) {
        assert(result.rows[index - 1].pid < result.rows[index].pid, 'Windows rows should be sorted by PID');
      }

      const ownRow = result.rows.find((row) => row.pid === process.pid);
      assert(ownRow !== undefined, 'current Node PID should be present');
      assert.match(ownRow.creationToken, /^\d{14}\.\d{6}[+-]\d{3}$/);
    });
  }

  await check('generic malformed options fail closed without execution', async () => {
    let executorCalls = 0;
    let accessorCalls = 0;
    const execFileImpl = () => {
      executorCalls += 1;
      throw new Error('invalid options must not execute');
    };
    const accessorOptions = { execFileImpl };
    Object.defineProperty(accessorOptions, 'platform', {
      configurable: true,
      enumerable: true,
      get() {
        accessorCalls += 1;
        throw new Error(SELFTEST_SECRET);
      },
    });
    const revoked = Proxy.revocable({ platform: 'win32', execFileImpl }, {});
    revoked.revoke();
    const inheritedOptions = Object.create({ platform: 'win32' });
    const invalidOptions = [
      null,
      [],
      { platform: 'win32', execFileImpl, extraKey: true },
      { platform: 42, execFileImpl },
      accessorOptions,
      revoked.proxy,
      inheritedOptions,
    ];

    for (const options of invalidOptions) {
      const result = await captureProcessTableSnapshot(options);
      assertSnapshotResult(result, expectedFailure(FAILURE_CODES.OPTIONS_INVALID));
    }
    assert.equal(accessorCalls, 0);
    assert.equal(executorCalls, 0);
  });

  await check('generic results expose no dispatch metadata', async () => {
    const result = await captureProcessTableSnapshot({
      platform: 'linux',
      timeoutMs: 10,
      execFileImpl(_command, _args, _options, callback) {
        callback(null, selftestPosixSnapshotText());
        return { kill() {} };
      },
    });

    assertSnapshotResult(result, {
      complete: true,
      errors: [],
      rows: [
        { pid: 3, parentPid: 1, creationToken: 'Sun Jan 1 00:00:00 2026' },
        { pid: 20, parentPid: 4, creationToken: 'Tue Aug 4 05:06:07 2026' },
      ],
    });
    assert.deepEqual(Object.getOwnPropertyNames(result), ['complete', 'errors', 'rows']);
    assert.deepEqual(Object.getOwnPropertySymbols(result), []);
    const serialized = JSON.stringify(result);
    for (const leakedFact of ['platform', 'ps', 'env', 'LC_ALL', 'LANG']) {
      assert(!serialized.includes(leakedFact));
    }
  });

  console.log(`selftest: PASS (${checks} checks)`);
}

const invokedDirectly = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly && process.argv[2] === '--selftest') {
  runSelftest().catch((error) => {
    console.error(error instanceof Error ? error.message : 'selftest failed');
    process.exitCode = 1;
  });
}
