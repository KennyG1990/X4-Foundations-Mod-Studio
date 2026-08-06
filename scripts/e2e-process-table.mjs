import { fileURLToPath } from 'node:url';

const HEADER = 'Node,CreationDate,ParentProcessId,ProcessId';
const MAX_INPUT_CHARS = 4 * 1024 * 1024;
const MAX_NONBLANK_ROWS = 100_000;
const MAX_LINE_CHARS = 16_384;
const CREATION_TOKEN_PATTERN = /^\d{14}\.\d{6}[+-]\d{3}$/;
const DECIMAL_INTEGER_PATTERN = /^\d+$/;
const POSIX_WEEKDAYS = new Set(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
const POSIX_MONTHS = new Set(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
const POSIX_DAY_PATTERN = /^(?:[1-9]|[12]\d|3[01])$/;
const POSIX_TIME_PART_PATTERN = /^\d{2}$/;
const POSIX_YEAR_PATTERN = /^\d{4}$/;

const ERROR_CODES = Object.freeze({
  INPUT_NOT_STRING: 'input-not-string',
  INPUT_TOO_LARGE: 'input-too-large',
  EMPTY_INPUT: 'empty-input',
  LINE_TOO_LONG: 'line-too-long',
  ROW_COUNT_EXCEEDED: 'row-count-exceeded',
  MISSING_HEADER: 'missing-header',
  HEADER_MISMATCH: 'header-mismatch',
  WRONG_COLUMN_COUNT: 'wrong-column-count',
  BLANK_NODE: 'blank-node',
  INVALID_CREATION_TOKEN: 'invalid-creation-token',
  INVALID_PID: 'invalid-pid',
  INVALID_PARENT_PID: 'invalid-parent-pid',
  INVALID_WEEKDAY: 'invalid-weekday',
  INVALID_MONTH: 'invalid-month',
  INVALID_DAY: 'invalid-day',
  INVALID_TIME: 'invalid-time',
  INVALID_HOUR: 'invalid-hour',
  INVALID_MINUTE: 'invalid-minute',
  INVALID_SECOND: 'invalid-second',
  INVALID_YEAR: 'invalid-year',
  MISSING_FIELDS: 'missing-fields',
  MALFORMED_ROW: 'malformed-row',
  DUPLICATE_PID: 'duplicate-pid',
  NO_USABLE_ROWS: 'no-usable-rows',
});

function createResult(errors, rows) {
  const uniqueErrors = [...new Set(errors)];
  return {
    complete: uniqueErrors.length === 0 && rows.length > 0,
    errors: uniqueErrors,
    rows: uniqueErrors.length === 0 ? rows : [],
  };
}

function parseSafeDecimalInteger(value, { allowZero }) {
  if (!DECIMAL_INTEGER_PATTERN.test(value)) {
    return null;
  }

  const number = Number(value);
  if (!Number.isSafeInteger(number) || (!allowZero && number === 0)) {
    return null;
  }

  return number;
}

function splitSnapshotLines(text) {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[0].startsWith('\uFEFF')) {
    lines[0] = lines[0].slice(1);
  }
  return lines.map((line) => line.replace(/\r+$/, ''));
}

/**
 * Parse the exact CSV snapshot emitted by:
 * wmic.exe process get CreationDate,ParentProcessId,ProcessId /format:csv
 *
 * @param {unknown} text
 * @returns {{ complete: boolean, errors: string[], rows: Array<{pid: number, parentPid: number, creationToken: string}> }}
 */
export function parseWindowsWmicProcessCsv(text) {
  if (typeof text !== 'string') {
    return createResult([ERROR_CODES.INPUT_NOT_STRING], []);
  }

  if (text.length > MAX_INPUT_CHARS) {
    return createResult([ERROR_CODES.INPUT_TOO_LARGE], []);
  }

  if (text.length === 0) {
    return createResult([ERROR_CODES.EMPTY_INPUT, ERROR_CODES.MISSING_HEADER], []);
  }

  const errors = [];
  let lines;
  try {
    lines = splitSnapshotLines(text);
  } catch {
    return createResult([ERROR_CODES.INPUT_TOO_LARGE], []);
  }

  let nonBlankCount = 0;
  for (const line of lines) {
    if (line.length > MAX_LINE_CHARS) {
      errors.push(ERROR_CODES.LINE_TOO_LONG);
    }
    if (line.length > 0) {
      nonBlankCount += 1;
      if (nonBlankCount > MAX_NONBLANK_ROWS) {
        errors.push(ERROR_CODES.ROW_COUNT_EXCEEDED);
        return createResult(errors, []);
      }
    }
  }

  if (errors.length > 0) {
    return createResult(errors, []);
  }

  const nonBlankLines = lines.filter((line) => line.length > 0);
  if (nonBlankLines.length === 0) {
    return createResult([ERROR_CODES.EMPTY_INPUT, ERROR_CODES.MISSING_HEADER], []);
  }

  if (nonBlankLines[0] !== HEADER) {
    return createResult([ERROR_CODES.HEADER_MISMATCH], []);
  }

  const rows = [];
  const seenPids = new Set();

  for (const line of nonBlankLines.slice(1)) {
    const fields = line.split(',');
    if (fields.length !== 4) {
      errors.push(ERROR_CODES.WRONG_COLUMN_COUNT);
      continue;
    }

    const [node, creationToken, parentPidText, pidText] = fields;
    if (node.length === 0) {
      errors.push(ERROR_CODES.BLANK_NODE);
    }

    if (!CREATION_TOKEN_PATTERN.test(creationToken)) {
      errors.push(ERROR_CODES.INVALID_CREATION_TOKEN);
    }

    const pid = parseSafeDecimalInteger(pidText, { allowZero: true });
    if (pid === null) {
      errors.push(ERROR_CODES.INVALID_PID);
    }

    const parentPid = parseSafeDecimalInteger(parentPidText, { allowZero: true });
    if (parentPid === null) {
      errors.push(ERROR_CODES.INVALID_PARENT_PID);
    }

    if (pid === null || parentPid === null || node.length === 0 || !CREATION_TOKEN_PATTERN.test(creationToken)) {
      continue;
    }

    if (seenPids.has(pid)) {
      errors.push(ERROR_CODES.DUPLICATE_PID);
      continue;
    }
    seenPids.add(pid);

    if (pid === 0) {
      continue;
    }

    rows.push({ pid, parentPid, creationToken });
  }

  if (rows.length === 0) {
    errors.push(ERROR_CODES.NO_USABLE_ROWS);
  }

  if (errors.length > 0) {
    return createResult(errors, []);
  }

  return createResult(
    [],
    rows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const pidOrder = left.row.pid - right.row.pid;
        if (pidOrder !== 0) {
          return pidOrder;
        }
        const creationOrder = left.row.creationToken.localeCompare(right.row.creationToken);
        return creationOrder !== 0 ? creationOrder : left.index - right.index;
      })
      .map(({ row }) => row),
  );
}

/**
 * Parse the POSIX process table emitted by:
 * LC_ALL=C ps -e -o pid=,ppid=,lstart=
 *
 * @param {unknown} text
 * @returns {{ complete: boolean, errors: string[], rows: Array<{pid: number, parentPid: number, creationToken: string}> }}
 */
export function parsePosixPsProcessTable(text) {
  if (typeof text !== 'string') {
    return createResult([ERROR_CODES.INPUT_NOT_STRING], []);
  }

  if (text.length > MAX_INPUT_CHARS) {
    return createResult([ERROR_CODES.INPUT_TOO_LARGE], []);
  }

  if (text.length === 0) {
    return createResult([ERROR_CODES.EMPTY_INPUT, ERROR_CODES.NO_USABLE_ROWS], []);
  }

  const errors = [];
  let lines;
  try {
    lines = splitSnapshotLines(text);
  } catch {
    return createResult([ERROR_CODES.INPUT_TOO_LARGE], []);
  }

  let nonBlankCount = 0;
  const nonBlankLines = [];
  for (const line of lines) {
    if (line.length > MAX_LINE_CHARS) {
      errors.push(ERROR_CODES.LINE_TOO_LONG);
    }

    if (line.trim().length > 0) {
      nonBlankCount += 1;
      if (nonBlankCount > MAX_NONBLANK_ROWS) {
        errors.push(ERROR_CODES.ROW_COUNT_EXCEEDED);
        return createResult(errors, []);
      }
      nonBlankLines.push(line);
    }
  }

  if (errors.length > 0) {
    return createResult(errors, []);
  }

  if (nonBlankLines.length === 0) {
    return createResult([ERROR_CODES.NO_USABLE_ROWS], []);
  }

  const rows = [];
  const seenPids = new Set();

  for (const line of nonBlankLines) {
    const fields = line.trim().split(/[ \t]+/);
    if (fields.length < 7) {
      errors.push(ERROR_CODES.MISSING_FIELDS);
      continue;
    }
    if (fields.length > 7) {
      errors.push(ERROR_CODES.MALFORMED_ROW);
      continue;
    }

    const [pidText, parentPidText, weekday, month, dayText, timeText, year] = fields;
    const pid = parseSafeDecimalInteger(pidText, { allowZero: true });
    if (pid === null) {
      errors.push(ERROR_CODES.INVALID_PID);
    } else if (seenPids.has(pid)) {
      errors.push(ERROR_CODES.DUPLICATE_PID);
    } else {
      seenPids.add(pid);
    }

    const parentPid = parseSafeDecimalInteger(parentPidText, { allowZero: true });
    if (parentPid === null) {
      errors.push(ERROR_CODES.INVALID_PARENT_PID);
    }

    let creationValid = true;
    if (!POSIX_WEEKDAYS.has(weekday)) {
      errors.push(ERROR_CODES.INVALID_WEEKDAY);
      creationValid = false;
    }
    if (!POSIX_MONTHS.has(month)) {
      errors.push(ERROR_CODES.INVALID_MONTH);
      creationValid = false;
    }
    if (!POSIX_DAY_PATTERN.test(dayText)) {
      errors.push(ERROR_CODES.INVALID_DAY);
      creationValid = false;
    }

    const timeParts = timeText.split(':');
    if (timeParts.length !== 3) {
      errors.push(ERROR_CODES.INVALID_TIME);
      creationValid = false;
    } else {
      const [hour, minute, second] = timeParts;
      if (!POSIX_TIME_PART_PATTERN.test(hour) || Number(hour) > 23) {
        errors.push(ERROR_CODES.INVALID_HOUR);
        creationValid = false;
      }
      if (!POSIX_TIME_PART_PATTERN.test(minute) || Number(minute) > 59) {
        errors.push(ERROR_CODES.INVALID_MINUTE);
        creationValid = false;
      }
      if (!POSIX_TIME_PART_PATTERN.test(second) || Number(second) > 59) {
        errors.push(ERROR_CODES.INVALID_SECOND);
        creationValid = false;
      }
    }

    if (!POSIX_YEAR_PATTERN.test(year)) {
      errors.push(ERROR_CODES.INVALID_YEAR);
      creationValid = false;
    }

    if (pid === null || parentPid === null || !creationValid) {
      continue;
    }

    if (pid === 0) {
      continue;
    }

    rows.push({
      pid,
      parentPid,
      creationToken: [weekday, month, dayText, timeText, year].join(' '),
    });
  }

  if (rows.length === 0) {
    errors.push(ERROR_CODES.NO_USABLE_ROWS);
  }

  if (errors.length > 0) {
    return createResult(errors, []);
  }

  return createResult(
    [],
    rows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        if (left.row.pid !== right.row.pid) {
          return left.row.pid < right.row.pid ? -1 : 1;
        }
        if (left.row.creationToken !== right.row.creationToken) {
          return left.row.creationToken < right.row.creationToken ? -1 : 1;
        }
        return left.index - right.index;
      })
      .map(({ row }) => row),
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`selftest failed: ${message}`);
  }
}

function assertIncomplete(result, expectedError) {
  assert(result.complete === false, `${expectedError}: complete`);
  assert(result.rows.length === 0, `${expectedError}: rows empty`);
  assert(result.errors.includes(expectedError), `${expectedError}: error code`);
}

function validRow({ node = 'DESKTOP-9PP67LG', creationToken = '20260802043333.860108-240', parentPid = 4, pid = 428 } = {}) {
  return `${node},${creationToken},${parentPid},${pid}`;
}

function validPosixRow({ pid = 428, parentPid = 4, weekday = 'Tue', month = 'Aug', day = '4', time = '05:06:07', year = '2026' } = {}) {
  return `${pid} ${parentPid} ${weekday} ${month} ${day} ${time} ${year}`;
}

function runSelftest() {
  let checks = 0;
  const check = (name, test) => {
    test();
    checks += 1;
    console.log(`ok - ${name}`);
  };

  check('valid BOM+CRLF+blanks+PID0+parent0', () => {
    const input = [
      '\uFEFF',
      HEADER,
      validRow({ parentPid: 0, pid: 0 }),
      validRow({ parentPid: 0, pid: 42, creationToken: '20260802043333.860108-240' }),
      '',
    ].join('\r\n');
    const result = parseWindowsWmicProcessCsv(input);
    assert(result.complete, 'valid snapshot should be complete');
    assert(result.errors.length === 0, 'valid snapshot should have no errors');
    assert(JSON.stringify(result.rows) === JSON.stringify([{ pid: 42, parentPid: 0, creationToken: '20260802043333.860108-240' }]), 'PID 0 should be ignored');
  });

  check('leading blank records and CRCRLF separators', () => {
    const input = [
      '\uFEFF\r\r',
      '\r\r',
      HEADER,
      validRow({ parentPid: 0, pid: 42 }),
      '',
    ].join('\r\r\n');
    const result = parseWindowsWmicProcessCsv(input);
    assert(result.complete, 'CRCRLF snapshot should be complete');
    assert(result.errors.length === 0, 'CRCRLF snapshot should have no errors');
    assert(JSON.stringify(result.rows) === JSON.stringify([{ pid: 42, parentPid: 0, creationToken: '20260802043333.860108-240' }]), 'CRCRLF row should parse exactly');
  });

  check('stable sort', () => {
    const input = [
      HEADER,
      validRow({ pid: 20, creationToken: '20260802043333.860108-240' }),
      validRow({ pid: 3, creationToken: '20260802043333.860108-241' }),
      validRow({ pid: 10, creationToken: '20260802043333.860108-239' }),
    ].join('\n');
    const result = parseWindowsWmicProcessCsv(input);
    assert(result.complete, 'sortable snapshot should be complete');
    assert(result.rows.map((row) => row.pid).join(',') === '3,10,20', 'rows should sort by PID');
    assert(result.rows.map((row) => row.creationToken).join(',') === '20260802043333.860108-241,20260802043333.860108-239,20260802043333.860108-240', 'sort should retain row values');
  });

  check('LF', () => {
    const result = parseWindowsWmicProcessCsv(`${HEADER}\n${validRow()}`);
    assert(result.complete, 'LF snapshot should be complete');
  });

  check('malformed/nonexact header', () => {
    const result = parseWindowsWmicProcessCsv(`Node,ProcessId,ParentProcessId,CreationDate\n${validRow()}`);
    assertIncomplete(result, ERROR_CODES.HEADER_MISMATCH);
  });

  check('wrong columns', () => {
    const result = parseWindowsWmicProcessCsv(`${HEADER}\nonly,two,fields`);
    assertIncomplete(result, ERROR_CODES.WRONG_COLUMN_COUNT);
  });

  check('blank Node', () => {
    const result = parseWindowsWmicProcessCsv(`${HEADER}\n,20260802043333.860108-240,4,428`);
    assertIncomplete(result, ERROR_CODES.BLANK_NODE);
  });

  check('invalid creation token', () => {
    const result = parseWindowsWmicProcessCsv(`${HEADER}\n${validRow({ creationToken: '20260802043333.860108' })}`);
    assertIncomplete(result, ERROR_CODES.INVALID_CREATION_TOKEN);
  });

  check('invalid/unsafe/negative IDs', () => {
    const invalidInputs = [
      ['-1', '4', ERROR_CODES.INVALID_PID],
      ['9007199254740992', '4', ERROR_CODES.INVALID_PID],
      ['428', '-1', ERROR_CODES.INVALID_PARENT_PID],
      ['1.5', '4', ERROR_CODES.INVALID_PID],
    ];
    for (const [pid, parentPid, errorCode] of invalidInputs) {
      const result = parseWindowsWmicProcessCsv(`${HEADER}\n${validRow({ pid, parentPid })}`);
      assertIncomplete(result, errorCode);
    }
  });

  check('duplicate exact', () => {
    const row = validRow({ pid: 428 });
    const result = parseWindowsWmicProcessCsv(`${HEADER}\n${row}\n${row}`);
    assertIncomplete(result, ERROR_CODES.DUPLICATE_PID);
  });

  check('duplicate conflicting', () => {
    const result = parseWindowsWmicProcessCsv([
      HEADER,
      validRow({ pid: 428, parentPid: 4 }),
      validRow({ pid: 428, parentPid: 8, creationToken: '20260802043333.860108-241' }),
    ].join('\n'));
    assertIncomplete(result, ERROR_CODES.DUPLICATE_PID);
  });

  check('no usable rows', () => {
    const result = parseWindowsWmicProcessCsv(`${HEADER}\n${validRow({ pid: 0, parentPid: 0 })}`);
    assertIncomplete(result, ERROR_CODES.NO_USABLE_ROWS);
  });

  check('empty/non-string', () => {
    assertIncomplete(parseWindowsWmicProcessCsv(''), ERROR_CODES.EMPTY_INPUT);
    assertIncomplete(parseWindowsWmicProcessCsv(null), ERROR_CODES.INPUT_NOT_STRING);
    assertIncomplete(parseWindowsWmicProcessCsv({}), ERROR_CODES.INPUT_NOT_STRING);
  });

  check('oversized input', () => {
    const result = parseWindowsWmicProcessCsv('x'.repeat(MAX_INPUT_CHARS + 1));
    assertIncomplete(result, ERROR_CODES.INPUT_TOO_LARGE);
  });

  check('overlong line', () => {
    const result = parseWindowsWmicProcessCsv(`${HEADER}\n${'x'.repeat(MAX_LINE_CHARS + 1)}`);
    assertIncomplete(result, ERROR_CODES.LINE_TOO_LONG);
  });

  check('row-count bound', () => {
    const rows = Array.from({ length: MAX_NONBLANK_ROWS }, (_, index) => validRow({ pid: index + 1, parentPid: 1, node: 'N' }));
    const result = parseWindowsWmicProcessCsv([HEADER, ...rows].join('\n'));
    assertIncomplete(result, ERROR_CODES.ROW_COUNT_EXCEEDED);
  });

  check('never-throws', () => {
    const inputs = [
      undefined,
      null,
      1,
      Symbol('not text'),
      `${HEADER}\n${'x'.repeat(MAX_LINE_CHARS + 1)}`,
      `${HEADER}\n${'a,'.repeat(100_000)}`,
    ];
    for (const input of inputs) {
      let result;
      try {
        result = parseWindowsWmicProcessCsv(input);
      } catch (error) {
        throw new Error(`parser threw for selftest input: ${String(error)}`);
      }
      assert(result && typeof result.complete === 'boolean', 'result should have complete');
      assert(Array.isArray(result.errors) && Array.isArray(result.rows), 'result should have arrays');
    }
  });

  check('POSIX valid whitespace/tabs/CRLF/CRCRLF/BOM/PID0/parent0', () => {
    const input = [
      '\uFEFF\r\n',
      ' \t \r\r\n',
      ' 0\t0\tSun Jan 1 00:00:00 2026\t\r\r\n',
      ' \t123\t1\tTue Aug  4 05:06:07 2026 \t\r\n',
    ].join('');
    const result = parsePosixPsProcessTable(input);
    assert(result.complete, 'valid POSIX table should be complete');
    assert(result.errors.length === 0, 'valid POSIX table should have no errors');
    assert(Object.keys(result).join(',') === 'complete,errors,rows', 'result should have exactly the contract keys');
    assert(JSON.stringify(result.rows) === JSON.stringify([{ pid: 123, parentPid: 1, creationToken: 'Tue Aug 4 05:06:07 2026' }]), 'POSIX row should normalize and ignore PID 0');
  });

  check('POSIX LF and CRLF separators', () => {
    const result = parsePosixPsProcessTable(`${validPosixRow({ pid: 2 })}\n\r\n${validPosixRow({ pid: 1 })}`);
    assert(result.complete, 'LF and CRLF POSIX table should be complete');
    assert(result.rows.map((row) => row.pid).join(',') === '1,2', 'mixed separators should parse and sort');
  });

  check('POSIX stable sort by PID then creationToken', () => {
    const result = parsePosixPsProcessTable([
      validPosixRow({ pid: 20, weekday: 'Tue', month: 'Aug', day: '4', time: '05:06:07' }),
      validPosixRow({ pid: 3, weekday: 'Sun', month: 'Jan', day: '1', time: '00:00:00' }),
      validPosixRow({ pid: 10, weekday: 'Wed', month: 'Dec', day: '31', time: '23:59:59' }),
    ].join('\n'));
    assert(result.complete, 'sortable POSIX table should be complete');
    assert(result.rows.map((row) => row.pid).join(',') === '3,10,20', 'POSIX rows should sort by PID');
    assert(result.rows.map((row) => row.creationToken).join(',') === 'Sun Jan 1 00:00:00 2026,Wed Dec 31 23:59:59 2026,Tue Aug 4 05:06:07 2026', 'sort should retain normalized creation tokens');
  });

  check('POSIX invalid weekday', () => {
    assertIncomplete(parsePosixPsProcessTable(validPosixRow({ weekday: 'Fry' })), ERROR_CODES.INVALID_WEEKDAY);
  });

  check('POSIX invalid month', () => {
    assertIncomplete(parsePosixPsProcessTable(validPosixRow({ month: 'Abc' })), ERROR_CODES.INVALID_MONTH);
  });

  check('POSIX invalid day', () => {
    assertIncomplete(parsePosixPsProcessTable(validPosixRow({ day: '32' })), ERROR_CODES.INVALID_DAY);
  });

  check('POSIX invalid hour', () => {
    assertIncomplete(parsePosixPsProcessTable(validPosixRow({ time: '24:06:07' })), ERROR_CODES.INVALID_HOUR);
  });

  check('POSIX invalid minute', () => {
    assertIncomplete(parsePosixPsProcessTable(validPosixRow({ time: '05:60:07' })), ERROR_CODES.INVALID_MINUTE);
  });

  check('POSIX invalid second', () => {
    assertIncomplete(parsePosixPsProcessTable(validPosixRow({ time: '05:06:60' })), ERROR_CODES.INVALID_SECOND);
  });

  check('POSIX invalid year', () => {
    assertIncomplete(parsePosixPsProcessTable(validPosixRow({ year: '202' })), ERROR_CODES.INVALID_YEAR);
  });

  check('POSIX malformed/missing fields', () => {
    assertIncomplete(parsePosixPsProcessTable('428 4 Tue Aug 4 05:06:07'), ERROR_CODES.MISSING_FIELDS);
    assertIncomplete(parsePosixPsProcessTable('428 4 Tue Aug 4 05:06:07 2026 extra'), ERROR_CODES.MALFORMED_ROW);
  });

  check('POSIX invalid/unsafe/negative IDs', () => {
    const invalidInputs = [
      ['-1', '4', ERROR_CODES.INVALID_PID],
      ['9007199254740992', '4', ERROR_CODES.INVALID_PID],
      ['428', '-1', ERROR_CODES.INVALID_PARENT_PID],
      ['1.5', '4', ERROR_CODES.INVALID_PID],
    ];
    for (const [pid, parentPid, errorCode] of invalidInputs) {
      assertIncomplete(parsePosixPsProcessTable(validPosixRow({ pid, parentPid })), errorCode);
    }
  });

  check('POSIX duplicate exact', () => {
    const row = validPosixRow({ pid: 428 });
    assertIncomplete(parsePosixPsProcessTable(`${row}\n${row}`), ERROR_CODES.DUPLICATE_PID);
  });

  check('POSIX duplicate conflicting PID', () => {
    assertIncomplete(parsePosixPsProcessTable([
      validPosixRow({ pid: 428, parentPid: 4 }),
      validPosixRow({ pid: 428, parentPid: 8, time: '05:06:08' }),
    ].join('\n')), ERROR_CODES.DUPLICATE_PID);
  });

  check('POSIX no usable rows', () => {
    assertIncomplete(parsePosixPsProcessTable(` \t\n${validPosixRow({ pid: 0, parentPid: 0 })}\n`), ERROR_CODES.NO_USABLE_ROWS);
  });

  check('POSIX empty/non-string', () => {
    assertIncomplete(parsePosixPsProcessTable(''), ERROR_CODES.EMPTY_INPUT);
    assertIncomplete(parsePosixPsProcessTable(null), ERROR_CODES.INPUT_NOT_STRING);
    assertIncomplete(parsePosixPsProcessTable({}), ERROR_CODES.INPUT_NOT_STRING);
  });

  check('POSIX input-size bound', () => {
    assertIncomplete(parsePosixPsProcessTable('x'.repeat(MAX_INPUT_CHARS + 1)), ERROR_CODES.INPUT_TOO_LARGE);
  });

  check('POSIX line-length bound', () => {
    assertIncomplete(parsePosixPsProcessTable('x'.repeat(MAX_LINE_CHARS + 1)), ERROR_CODES.LINE_TOO_LONG);
  });

  check('POSIX nonblank-row bound', () => {
    const rows = Array.from({ length: MAX_NONBLANK_ROWS + 1 }, (_, index) => validPosixRow({ pid: index + 1 }));
    assertIncomplete(parsePosixPsProcessTable(rows.join('\n')), ERROR_CODES.ROW_COUNT_EXCEEDED);
  });

  check('POSIX never-throws', () => {
    const inputs = [
      undefined,
      null,
      1,
      Symbol('not text'),
      '',
      `${validPosixRow()}\n${'x'.repeat(MAX_LINE_CHARS + 1)}`,
      `${validPosixRow()}\n${'a '.repeat(100_000)}`,
    ];
    for (const input of inputs) {
      let result;
      try {
        result = parsePosixPsProcessTable(input);
      } catch (error) {
        throw new Error(`POSIX parser threw for selftest input: ${String(error)}`);
      }
      assert(result && typeof result.complete === 'boolean', 'POSIX result should have complete');
      assert(Array.isArray(result.errors) && Array.isArray(result.rows), 'POSIX result should have arrays');
    }
  });

  console.log(`selftest: PASS (${checks} checks)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2] === '--selftest') {
  try {
    runSelftest();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'selftest failed');
    process.exitCode = 1;
  }
}
