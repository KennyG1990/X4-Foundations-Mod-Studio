import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_SNAPSHOT_ROWS = 100_000;
const MICROSECONDS_PER_SECOND = 1_000_000n;
const MICROSECONDS_PER_MINUTE = 60n * MICROSECONDS_PER_SECOND;
const MICROSECONDS_PER_DAY = 24n * 60n * MICROSECONDS_PER_MINUTE;
const DMTF_CREATION_TOKEN_PATTERN = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.(\d{6})([+-])(\d{3})$/u;
const POSIX_CREATION_TOKEN_PATTERN = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (0?[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d) (\d{4})$/u;
const POSIX_WEEKDAY_NUMBERS = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });
const POSIX_MONTH_NUMBERS = Object.freeze({
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
});
const ERROR_ORDER = Object.freeze([
  'invalid-input',
  'invalid-root',
  'invalid-snapshot',
  'snapshot-oversize',
  'invalid-row',
  'invalid-pid',
  'invalid-parent-pid',
  'invalid-creation-token',
  'duplicate-pid',
  'self-parent',
  'parent-cycle',
  'root-missing',
  'root-pid-reused',
  'invalid-previous-captured',
  'invalid-captured',
  'invalid-identity',
  'captured-oversize',
]);

function failure(errorCodes) {
  const codes = errorCodes instanceof Set ? errorCodes : new Set(errorCodes);
  return {
    complete: false,
    errors: ERROR_ORDER.filter((code) => codes.has(code)),
    rootPresent: false,
    captured: [],
  };
}

function success(captured) {
  return {
    complete: true,
    errors: [],
    rootPresent: true,
    captured,
  };
}

function hasExactKeys(value, expectedKeys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const keys = Reflect.ownKeys(value);
  if (keys.length !== expectedKeys.length) {
    return false;
  }

  return expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isValidPid(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isValidParentPid(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidCreationToken(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    !/[\u0000-\u001F\u007F]/u.test(value)
  );
}

function daysFromCivil(year, month, day) {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(
    (adjustedYear >= 0 ? adjustedYear : adjustedYear - 399) / 400,
  );
  const yearOfEra = adjustedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365
    + Math.floor(yearOfEra / 4)
    - Math.floor(yearOfEra / 100)
    + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function isValidCivilDate(year, month, day) {
  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function parseDmtfCreationTime(creationToken) {
  const match = DMTF_CREATION_TOKEN_PATTERN.exec(creationToken);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const microsecond = Number(match[7]);
  const offsetMinutes = Number(match[9]);
  if (
    !isValidCivilDate(year, month, day)
    || hour > 23
    || minute > 59
    || second > 59
    || offsetMinutes > 999
  ) {
    return null;
  }

  const localMicroseconds = BigInt(daysFromCivil(year, month, day)) * MICROSECONDS_PER_DAY
    + BigInt(hour * 60 * 60 + minute * 60 + second) * MICROSECONDS_PER_SECOND
    + BigInt(microsecond);
  const signedOffsetMinutes = match[8] === '+' ? offsetMinutes : -offsetMinutes;
  return localMicroseconds - BigInt(signedOffsetMinutes) * MICROSECONDS_PER_MINUTE;
}

function parsePosixCreationTime(creationToken) {
  const match = POSIX_CREATION_TOKEN_PATTERN.exec(creationToken);
  if (match === null) {
    return null;
  }

  const weekday = POSIX_WEEKDAY_NUMBERS[match[1]];
  const month = POSIX_MONTH_NUMBERS[match[2]];
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const year = Number(match[7]);
  if (!isValidCivilDate(year, month, day)) {
    return null;
  }

  const days = daysFromCivil(year, month, day);
  const calculatedWeekday = ((days + 4) % 7 + 7) % 7;
  if (calculatedWeekday !== weekday) {
    return null;
  }

  return BigInt(days) * MICROSECONDS_PER_DAY
    + BigInt(hour * 60 * 60 + minute * 60 + second) * MICROSECONDS_PER_SECOND;
}

function parseCreationTime(creationToken) {
  if (typeof creationToken !== 'string') {
    return null;
  }

  return parseDmtfCreationTime(creationToken) ?? parsePosixCreationTime(creationToken);
}

function canTraverseChild(parentRow, childRow) {
  const parentTime = parseCreationTime(parentRow.creationToken);
  const childTime = parseCreationTime(childRow.creationToken);
  return parentTime === null || childTime === null || childTime >= parentTime;
}

function hasParentCycle(rowsByPid) {
  const state = new Map();

  for (const startPid of rowsByPid.keys()) {
    if (state.get(startPid) === 2) {
      continue;
    }

    const path = [];
    const pathPids = new Set();
    let currentPid = startPid;

    while (rowsByPid.has(currentPid) && state.get(currentPid) !== 2) {
      if (pathPids.has(currentPid)) {
        return true;
      }

      pathPids.add(currentPid);
      path.push(currentPid);
      state.set(currentPid, 1);

      const parentPid = rowsByPid.get(currentPid).parentPid;
      if (parentPid === 0 || !rowsByPid.has(parentPid)) {
        break;
      }

      currentPid = parentPid;
    }

    for (const pathPid of path) {
      state.set(pathPid, 2);
    }
  }

  return false;
}

function repeatedFailure(errorCodes) {
  const codes = errorCodes instanceof Set ? errorCodes : new Set(errorCodes);
  return {
    complete: false,
    errors: ERROR_ORDER.filter((code) => codes.has(code)),
    rootPresent: false,
    captured: [],
    newlyCaptured: [],
    activeOwned: [],
    reusedPids: [],
  };
}

function disappearanceFailure(errorCodes) {
  const codes = errorCodes instanceof Set ? errorCodes : new Set(errorCodes);
  return {
    complete: false,
    errors: ERROR_ORDER.filter((code) => codes.has(code)),
    treeGone: false,
    remaining: [],
    reusedPids: [],
  };
}

function compareIdentities(left, right) {
  if (left.pid < right.pid) {
    return -1;
  }
  if (left.pid > right.pid) {
    return 1;
  }
  if (left.creationToken < right.creationToken) {
    return -1;
  }
  if (left.creationToken > right.creationToken) {
    return 1;
  }
  return 0;
}

function compareSnapshotRows(left, right) {
  if (left.pid < right.pid) {
    return -1;
  }
  if (left.pid > right.pid) {
    return 1;
  }
  if (left.creationToken < right.creationToken) {
    return -1;
  }
  if (left.creationToken > right.creationToken) {
    return 1;
  }
  if (left.parentPid < right.parentPid) {
    return -1;
  }
  if (left.parentPid > right.parentPid) {
    return 1;
  }
  return 0;
}

function copyIdentity(identity) {
  return { pid: identity.pid, creationToken: identity.creationToken };
}

function copySnapshotRow(row) {
  return {
    pid: row.pid,
    parentPid: row.parentPid,
    creationToken: row.creationToken,
  };
}

function validateSnapshotRows(snapshotRows) {
  const errors = new Set();

  if (!Array.isArray(snapshotRows)) {
    return { errors: new Set(['invalid-snapshot']), rowsByPid: new Map() };
  }

  const rowCount = snapshotRows.length;
  if (!Number.isSafeInteger(rowCount) || rowCount < 0) {
    return { errors: new Set(['invalid-snapshot']), rowsByPid: new Map() };
  }
  if (rowCount > MAX_SNAPSHOT_ROWS) {
    return { errors: new Set(['snapshot-oversize']), rowsByPid: new Map() };
  }

  const rowsByPid = new Map();
  for (let index = 0; index < rowCount; index += 1) {
    const snapshotRow = snapshotRows[index];
    if (!hasExactKeys(snapshotRow, ['pid', 'parentPid', 'creationToken'])) {
      errors.add('invalid-row');
      continue;
    }

    const pid = snapshotRow.pid;
    const parentPid = snapshotRow.parentPid;
    const creationToken = snapshotRow.creationToken;

    if (!isValidPid(pid)) {
      errors.add('invalid-pid');
    }
    if (!isValidParentPid(parentPid)) {
      errors.add('invalid-parent-pid');
    }
    if (!isValidCreationToken(creationToken)) {
      errors.add('invalid-creation-token');
    }

    if (
      !isValidPid(pid) ||
      !isValidParentPid(parentPid) ||
      !isValidCreationToken(creationToken)
    ) {
      continue;
    }

    if (rowsByPid.has(pid)) {
      errors.add('duplicate-pid');
      continue;
    }

    rowsByPid.set(pid, { pid, parentPid, creationToken });
  }

  if (errors.size > 0) {
    return { errors, rowsByPid };
  }

  for (const row of rowsByPid.values()) {
    if (row.pid === row.parentPid) {
      errors.add('self-parent');
    }
  }
  if (errors.size > 0) {
    return { errors, rowsByPid };
  }

  if (hasParentCycle(rowsByPid)) {
    errors.add('parent-cycle');
  }

  return { errors, rowsByPid };
}

function validateIdentityArray(value, invalidArrayCode) {
  const errors = new Set();

  if (!Array.isArray(value)) {
    errors.add(invalidArrayCode);
    return { errors, identitiesByPid: new Map() };
  }

  const identityCount = value.length;
  if (!Number.isSafeInteger(identityCount) || identityCount <= 0) {
    errors.add(invalidArrayCode);
    return { errors, identitiesByPid: new Map() };
  }
  if (identityCount > MAX_SNAPSHOT_ROWS) {
    errors.add('captured-oversize');
    return { errors, identitiesByPid: new Map() };
  }

  const identitiesByPid = new Map();
  for (let index = 0; index < identityCount; index += 1) {
    const identity = value[index];
    if (!hasExactKeys(identity, ['pid', 'creationToken'])) {
      errors.add('invalid-identity');
      continue;
    }

    const pid = identity.pid;
    const creationToken = identity.creationToken;
    if (!isValidPid(pid)) {
      errors.add('invalid-pid');
    }
    if (!isValidCreationToken(creationToken)) {
      errors.add('invalid-creation-token');
    }

    if (!isValidPid(pid) || !isValidCreationToken(creationToken)) {
      continue;
    }

    if (identitiesByPid.has(pid)) {
      errors.add('duplicate-pid');
      continue;
    }

    identitiesByPid.set(pid, { pid, creationToken });
  }

  return { errors, identitiesByPid };
}

function assertRootIdentity(rootIdentity, errors) {
  if (!hasExactKeys(rootIdentity, ['pid', 'creationToken'])) {
    errors.add('invalid-root');
    return null;
  }

  const pid = rootIdentity.pid;
  const creationToken = rootIdentity.creationToken;
  if (!isValidPid(pid)) {
    errors.add('invalid-pid');
  }
  if (!isValidCreationToken(creationToken)) {
    errors.add('invalid-creation-token');
  }
  if (errors.size > 0) {
    return null;
  }

  return { pid, creationToken };
}

/**
 * Capture the exact initial-snapshot process ownership closure rooted at one
 * PID plus creation token. This function performs no process I/O.
 */
export function captureInitialOwnedProcessClosure(rootIdentity, snapshotRows) {
  try {
    const errors = new Set();

    if (!hasExactKeys(rootIdentity, ['pid', 'creationToken'])) {
      return failure(['invalid-root']);
    }

    const rootPid = rootIdentity.pid;
    const rootCreationToken = rootIdentity.creationToken;

    if (!isValidPid(rootPid)) {
      errors.add('invalid-pid');
    }
    if (!isValidCreationToken(rootCreationToken)) {
      errors.add('invalid-creation-token');
    }
    if (errors.size > 0) {
      return failure(errors);
    }

    if (!Array.isArray(snapshotRows)) {
      return failure(['invalid-snapshot']);
    }
    if (snapshotRows.length > MAX_SNAPSHOT_ROWS) {
      return failure(['snapshot-oversize']);
    }

    const rowsByPid = new Map();

    for (let index = 0; index < snapshotRows.length; index += 1) {
      const snapshotRow = snapshotRows[index];
      if (!hasExactKeys(snapshotRow, ['pid', 'parentPid', 'creationToken'])) {
        errors.add('invalid-row');
        continue;
      }

      const pid = snapshotRow.pid;
      const parentPid = snapshotRow.parentPid;
      const creationToken = snapshotRow.creationToken;

      if (!isValidPid(pid)) {
        errors.add('invalid-pid');
      }
      if (!isValidParentPid(parentPid)) {
        errors.add('invalid-parent-pid');
      }
      if (!isValidCreationToken(creationToken)) {
        errors.add('invalid-creation-token');
      }

      if (
        !isValidPid(pid) ||
        !isValidParentPid(parentPid) ||
        !isValidCreationToken(creationToken)
      ) {
        continue;
      }

      if (rowsByPid.has(pid)) {
        errors.add('duplicate-pid');
        continue;
      }

      rowsByPid.set(pid, { pid, parentPid, creationToken });
    }

    if (errors.size > 0) {
      return failure(errors);
    }

    for (const row of rowsByPid.values()) {
      if (row.pid === row.parentPid) {
        errors.add('self-parent');
      }
    }
    if (errors.size > 0) {
      return failure(errors);
    }

    if (hasParentCycle(rowsByPid)) {
      return failure(['parent-cycle']);
    }

    const rootRow = rowsByPid.get(rootPid);
    if (rootRow === undefined) {
      return failure(['root-missing']);
    }
    if (rootRow.creationToken !== rootCreationToken) {
      return failure(['root-pid-reused']);
    }

    const childrenByParentPid = new Map();
    for (const row of rowsByPid.values()) {
      const children = childrenByParentPid.get(row.parentPid);
      if (children === undefined) {
        childrenByParentPid.set(row.parentPid, [row]);
      } else {
        children.push(row);
      }
    }

    const pendingPids = [rootPid];
    const capturedPids = new Set();
    const captured = [];

    while (pendingPids.length > 0) {
      const currentPid = pendingPids.pop();
      if (capturedPids.has(currentPid)) {
        continue;
      }

      const currentRow = rowsByPid.get(currentPid);
      if (currentRow === undefined) {
        continue;
      }

      capturedPids.add(currentPid);
      captured.push({ pid: currentRow.pid, creationToken: currentRow.creationToken });

      const children = childrenByParentPid.get(currentPid);
      if (children !== undefined) {
        for (const child of children) {
          if (canTraverseChild(currentRow, child)) {
            pendingPids.push(child.pid);
          }
        }
      }
    }

    captured.sort((left, right) => {
      if (left.pid < right.pid) {
        return -1;
      }
      if (left.pid > right.pid) {
        return 1;
      }
      if (left.creationToken < right.creationToken) {
        return -1;
      }
      if (left.creationToken > right.creationToken) {
        return 1;
      }
      return 0;
    });

    return success(captured);
  } catch {
    return failure(['invalid-input']);
  }
}

/**
 * Extend a previously captured process closure from one exact current
 * snapshot. This function performs no process I/O.
 */
export function captureOwnedProcessClosure(input = {}) {
  try {
    if (!hasExactKeys(input, ['rootIdentity', 'previousCaptured', 'snapshotRows'])) {
      return repeatedFailure(['invalid-input']);
    }

    const errors = new Set();
    const rootIdentity = assertRootIdentity(input.rootIdentity, errors);
    if (errors.size > 0 || rootIdentity === null) {
      return repeatedFailure(errors);
    }

    const previous = validateIdentityArray(input.previousCaptured, 'invalid-previous-captured');
    if (previous.errors.size > 0) {
      return repeatedFailure(previous.errors);
    }

    const snapshot = validateSnapshotRows(input.snapshotRows);
    if (snapshot.errors.size > 0) {
      return repeatedFailure(snapshot.errors);
    }

    const previousRoot = previous.identitiesByPid.get(rootIdentity.pid);
    if (previousRoot === undefined) {
      return repeatedFailure(['root-missing']);
    }
    if (previousRoot.creationToken !== rootIdentity.creationToken) {
      return repeatedFailure(['root-pid-reused']);
    }

    const reusedPids = [];
    const reusedPidSet = new Set();
    for (const [pid, previousIdentity] of previous.identitiesByPid) {
      const currentRow = snapshot.rowsByPid.get(pid);
      if (currentRow !== undefined && currentRow.creationToken !== previousIdentity.creationToken) {
        reusedPidSet.add(pid);
        reusedPids.push(pid);
      }
    }
    reusedPids.sort((left, right) => left - right);

    const capturedByPid = new Map();
    for (const identity of previous.identitiesByPid.values()) {
      capturedByPid.set(identity.pid, copyIdentity(identity));
    }

    const newlyCapturedByPid = new Map();
    const childrenByParentPid = new Map();
    for (const row of snapshot.rowsByPid.values()) {
      if (reusedPidSet.has(row.pid)) {
        continue;
      }

      const children = childrenByParentPid.get(row.parentPid);
      if (children === undefined) {
        childrenByParentPid.set(row.parentPid, [row]);
      } else {
        children.push(row);
      }
    }

    const pendingPids = [];
    for (const previousIdentity of previous.identitiesByPid.values()) {
      const currentRow = snapshot.rowsByPid.get(previousIdentity.pid);
      if (
        currentRow !== undefined &&
        currentRow.creationToken === previousIdentity.creationToken
      ) {
        pendingPids.push(previousIdentity.pid);
      }
    }

    const visitedPids = new Set();
    while (pendingPids.length > 0) {
      const currentPid = pendingPids.pop();
      if (visitedPids.has(currentPid) || reusedPidSet.has(currentPid)) {
        continue;
      }
      visitedPids.add(currentPid);

      const currentRow = snapshot.rowsByPid.get(currentPid);
      if (currentRow === undefined) {
        continue;
      }

      const previousIdentity = previous.identitiesByPid.get(currentPid);
      if (
        previousIdentity !== undefined &&
        previousIdentity.creationToken !== currentRow.creationToken
      ) {
        continue;
      }

      if (!capturedByPid.has(currentPid)) {
        const identity = { pid: currentRow.pid, creationToken: currentRow.creationToken };
        capturedByPid.set(currentPid, identity);
        newlyCapturedByPid.set(currentPid, copyIdentity(identity));
      }

      const children = childrenByParentPid.get(currentPid);
      if (children !== undefined) {
        for (const child of children) {
          if (canTraverseChild(currentRow, child)) {
            pendingPids.push(child.pid);
          }
        }
      }
    }

    const captured = [...capturedByPid.values()].sort(compareIdentities);
    const newlyCaptured = [...newlyCapturedByPid.values()].sort(compareIdentities);
    const activeOwned = [];
    for (const row of snapshot.rowsByPid.values()) {
      const capturedIdentity = capturedByPid.get(row.pid);
      if (
        capturedIdentity !== undefined &&
        capturedIdentity.creationToken === row.creationToken
      ) {
        activeOwned.push(copySnapshotRow(row));
      }
    }
    activeOwned.sort(compareSnapshotRows);

    const rootRow = snapshot.rowsByPid.get(rootIdentity.pid);
    return {
      complete: true,
      errors: [],
      rootPresent: rootRow !== undefined && rootRow.creationToken === rootIdentity.creationToken,
      captured,
      newlyCaptured,
      activeOwned,
      reusedPids,
    };
  } catch {
    return repeatedFailure(['invalid-input']);
  }
}

/**
 * Inspect which previously captured identities remain exactly present in a
 * current snapshot. This function performs no process I/O.
 */
export function inspectCapturedProcessDisappearance(input = {}) {
  try {
    if (!hasExactKeys(input, ['captured', 'snapshotRows'])) {
      return disappearanceFailure(['invalid-input']);
    }

    const captured = validateIdentityArray(input.captured, 'invalid-captured');
    if (captured.errors.size > 0) {
      return disappearanceFailure(captured.errors);
    }

    const snapshot = validateSnapshotRows(input.snapshotRows);
    if (snapshot.errors.size > 0) {
      return disappearanceFailure(snapshot.errors);
    }

    const remaining = [];
    const reusedPids = [];
    for (const identity of captured.identitiesByPid.values()) {
      const currentRow = snapshot.rowsByPid.get(identity.pid);
      if (currentRow === undefined) {
        continue;
      }
      if (currentRow.creationToken !== identity.creationToken) {
        reusedPids.push(identity.pid);
        continue;
      }
      remaining.push(copyIdentity(identity));
    }

    remaining.sort(compareIdentities);
    reusedPids.sort((left, right) => left - right);
    return {
      complete: true,
      errors: [],
      treeGone: remaining.length === 0,
      remaining,
      reusedPids,
    };
  } catch {
    return disappearanceFailure(['invalid-input']);
  }
}

function assertFailure(result, expectedCode) {
  assert.deepEqual(Object.keys(result), ['complete', 'errors', 'rootPresent', 'captured']);
  assert.equal(result.complete, false);
  assert.equal(result.rootPresent, false);
  assert.deepEqual(result.captured, []);
  assert.ok(result.errors.includes(expectedCode), `missing error code: ${expectedCode}`);
  assert.ok(result.errors.every((code) => ERROR_ORDER.includes(code)));
}

function assertRepeatedFailure(result, expectedCode) {
  assert.deepEqual(Object.keys(result), [
    'complete',
    'errors',
    'rootPresent',
    'captured',
    'newlyCaptured',
    'activeOwned',
    'reusedPids',
  ]);
  assert.equal(result.complete, false);
  assert.equal(result.rootPresent, false);
  assert.deepEqual(result.captured, []);
  assert.deepEqual(result.newlyCaptured, []);
  assert.deepEqual(result.activeOwned, []);
  assert.deepEqual(result.reusedPids, []);
  assert.ok(result.errors.includes(expectedCode), `missing error code: ${expectedCode}`);
  assert.ok(result.errors.every((code) => ERROR_ORDER.includes(code)));
}

function assertDisappearanceFailure(result, expectedCode) {
  assert.deepEqual(Object.keys(result), [
    'complete',
    'errors',
    'treeGone',
    'remaining',
    'reusedPids',
  ]);
  assert.equal(result.complete, false);
  assert.equal(result.treeGone, false);
  assert.deepEqual(result.remaining, []);
  assert.deepEqual(result.reusedPids, []);
  assert.ok(result.errors.includes(expectedCode), `missing error code: ${expectedCode}`);
  assert.ok(result.errors.every((code) => ERROR_ORDER.includes(code)));
}

function runSelftest() {
  const tests = [
    ['root+child+grandchild', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: 'root' },
        [
          { pid: 30, parentPid: 20, creationToken: 'grandchild' },
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 20, parentPid: 10, creationToken: 'child' },
        ],
      );
      assert.deepEqual(result, {
        complete: true,
        errors: [],
        rootPresent: true,
        captured: [
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
          { pid: 30, creationToken: 'grandchild' },
        ],
      });
    }],
    ['unrelated-exclusion', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: 'root' },
        [
          { pid: 50, parentPid: 40, creationToken: 'unrelated-grandchild' },
          { pid: 40, parentPid: 0, creationToken: 'unrelated' },
          { pid: 20, parentPid: 10, creationToken: 'child' },
          { pid: 10, parentPid: 0, creationToken: 'root' },
        ],
      );
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'child' },
      ]);
    }],
    ['row-order-stability', () => {
      const rows = [
        { pid: 70, parentPid: 20, creationToken: 'grandchild' },
        { pid: 20, parentPid: 10, creationToken: 'child' },
        { pid: 10, parentPid: 0, creationToken: 'root' },
        { pid: 90, parentPid: 0, creationToken: 'unrelated' },
      ];
      const first = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: 'root' },
        rows,
      );
      const second = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: 'root' },
        rows.slice().reverse(),
      );
      assert.deepEqual(first, second);
    }],
    ['chronology-rejects-pre-root-child-and-descendant', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: '20260809024500.000000+000' },
        [
          { pid: 30, parentPid: 20, creationToken: '20260101000100.000000+000' },
          { pid: 20, parentPid: 10, creationToken: '20260101000000.000000+000' },
          { pid: 10, parentPid: 0, creationToken: '20260809024500.000000+000' },
        ],
      );
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: '20260809024500.000000+000' },
      ]);
    }],
    ['chronology-accepts-legitimate-newer-child', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: '20260809024500.000000+000' },
        [
          { pid: 20, parentPid: 10, creationToken: '20260809024501.000000+000' },
          { pid: 10, parentPid: 0, creationToken: '20260809024500.000000+000' },
        ],
      );
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: '20260809024500.000000+000' },
        { pid: 20, creationToken: '20260809024501.000000+000' },
      ]);
    }],
    ['chronology-dmtf-offset-comparison', () => {
      const equalUtc = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: '20260809024500.000000+000' },
        [
          { pid: 20, parentPid: 10, creationToken: '20260809014500.000000-060' },
          { pid: 10, parentPid: 0, creationToken: '20260809024500.000000+000' },
        ],
      );
      assert.deepEqual(equalUtc.captured, [
        { pid: 10, creationToken: '20260809024500.000000+000' },
        { pid: 20, creationToken: '20260809014500.000000-060' },
      ]);

      const olderUtc = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: '20260809024500.000000-240' },
        [
          { pid: 20, parentPid: 10, creationToken: '20260809050000.000000+000' },
          { pid: 10, parentPid: 0, creationToken: '20260809024500.000000-240' },
        ],
      );
      assert.deepEqual(olderUtc.captured, [
        { pid: 10, creationToken: '20260809024500.000000-240' },
      ]);
    }],
    ['chronology-posix-lstart-comparison', () => {
      const newer = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: 'Mon Aug 3 05:06:07 2026' },
        [
          { pid: 20, parentPid: 10, creationToken: 'Tue Aug 4 05:06:07 2026' },
          { pid: 10, parentPid: 0, creationToken: 'Mon Aug 3 05:06:07 2026' },
        ],
      );
      assert.deepEqual(newer.captured, [
        { pid: 10, creationToken: 'Mon Aug 3 05:06:07 2026' },
        { pid: 20, creationToken: 'Tue Aug 4 05:06:07 2026' },
      ]);

      const older = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: 'Tue Aug 4 05:06:07 2026' },
        [
          { pid: 20, parentPid: 10, creationToken: 'Thu Jan 1 00:00:00 2026' },
          { pid: 10, parentPid: 0, creationToken: 'Tue Aug 4 05:06:07 2026' },
        ],
      );
      assert.deepEqual(older.captured, [
        { pid: 10, creationToken: 'Tue Aug 4 05:06:07 2026' },
      ]);
    }],
    ['chronology-repeated-rejects-pre-parent-child-and-descendant', () => {
      const result = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'Tue Aug 4 05:06:07 2026' },
        previousCaptured: [{ pid: 10, creationToken: 'Tue Aug 4 05:06:07 2026' }],
        snapshotRows: [
          { pid: 30, parentPid: 20, creationToken: 'Thu Jan 1 00:01:00 2026' },
          { pid: 20, parentPid: 10, creationToken: 'Thu Jan 1 00:00:00 2026' },
          { pid: 10, parentPid: 0, creationToken: 'Tue Aug 4 05:06:07 2026' },
        ],
      });
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'Tue Aug 4 05:06:07 2026' },
      ]);
      assert.deepEqual(result.newlyCaptured, []);
      assert.deepEqual(result.activeOwned, [
        { pid: 10, parentPid: 0, creationToken: 'Tue Aug 4 05:06:07 2026' },
      ]);
    }],
    ['chronology-unparseable-token-preserves-capture', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: '20260809024500.000000+000' },
        [
          { pid: 30, parentPid: 20, creationToken: 'fixture-grandchild' },
          { pid: 20, parentPid: 10, creationToken: '20261301000000.000000+000' },
          { pid: 10, parentPid: 0, creationToken: '20260809024500.000000+000' },
        ],
      );
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: '20260809024500.000000+000' },
        { pid: 20, creationToken: '20261301000000.000000+000' },
        { pid: 30, creationToken: 'fixture-grandchild' },
      ]);
    }],
    ['same-pid-wrong-root-token', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: 'new-token' },
        [{ pid: 10, parentPid: 0, creationToken: 'old-token' }],
      );
      assertFailure(result, 'root-pid-reused');
    }],
    ['root-missing', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: 'root' },
        [{ pid: 20, parentPid: 0, creationToken: 'other' }],
      );
      assertFailure(result, 'root-missing');
    }],
    ['duplicate-pid', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 10, creationToken: 'root' },
        [
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 20, parentPid: 10, creationToken: 'one' },
          { pid: 20, parentPid: 10, creationToken: 'two' },
        ],
      );
      assertFailure(result, 'duplicate-pid');
    }],
    ['invalid-root', () => {
      const result = captureInitialOwnedProcessClosure(null, []);
      assertFailure(result, 'invalid-root');
    }],
    ['invalid-pid', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 1, creationToken: 'root' },
        [{ pid: 0, parentPid: 0, creationToken: 'bad-pid' }],
      );
      assertFailure(result, 'invalid-pid');
    }],
    ['invalid-parent', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 1, creationToken: 'root' },
        [{ pid: 1, parentPid: -1, creationToken: 'root' }],
      );
      assertFailure(result, 'invalid-parent-pid');
    }],
    ['invalid-token', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 1, creationToken: 'root' },
        [{ pid: 1, parentPid: 0, creationToken: ' bad ' }],
      );
      assertFailure(result, 'invalid-creation-token');
    }],
    ['self-parent', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 1, creationToken: 'root' },
        [
          { pid: 1, parentPid: 0, creationToken: 'root' },
          { pid: 2, parentPid: 2, creationToken: 'self' },
        ],
      );
      assertFailure(result, 'self-parent');
    }],
    ['two-node-parent-cycle', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 1, creationToken: 'root' },
        [
          { pid: 1, parentPid: 0, creationToken: 'root' },
          { pid: 2, parentPid: 3, creationToken: 'two' },
          { pid: 3, parentPid: 2, creationToken: 'three' },
        ],
      );
      assertFailure(result, 'parent-cycle');
    }],
    ['non-array', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 1, creationToken: 'root' },
        { 0: { pid: 1, parentPid: 0, creationToken: 'root' } },
      );
      assertFailure(result, 'invalid-snapshot');
    }],
    ['oversize', () => {
      const result = captureInitialOwnedProcessClosure(
        { pid: 1, creationToken: 'root' },
        new Array(MAX_SNAPSHOT_ROWS + 1),
      );
      assertFailure(result, 'snapshot-oversize');
    }],
    ['never-throws', () => {
      const revoked = Proxy.revocable([], {});
      revoked.revoke();
      let result;
      let threw = false;
      try {
        result = captureInitialOwnedProcessClosure(
          { pid: 1, creationToken: 'root' },
          revoked.proxy,
        );
      } catch {
        threw = true;
      }
      assert.equal(threw, false);
      assertFailure(result, 'invalid-input');

      const throwingRoot = {};
      Object.defineProperties(throwingRoot, {
        pid: {
          configurable: true,
          enumerable: true,
          get() {
            throw new Error('getter failure');
          },
        },
        creationToken: {
          configurable: true,
          enumerable: true,
          value: 'root',
        },
      });
      threw = false;
      try {
        result = captureInitialOwnedProcessClosure(throwingRoot, []);
      } catch {
        threw = true;
      }
      assert.equal(threw, false);
      assertFailure(result, 'invalid-input');
    }],
    ['repeated-later-descendant', () => {
      const result = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [
          { pid: 20, creationToken: 'child' },
          { pid: 10, creationToken: 'root' },
        ],
        snapshotRows: [
          { pid: 30, parentPid: 20, creationToken: 'grandchild' },
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 20, parentPid: 10, creationToken: 'child' },
        ],
      });
      assert.deepEqual(Object.keys(result), [
        'complete',
        'errors',
        'rootPresent',
        'captured',
        'newlyCaptured',
        'activeOwned',
        'reusedPids',
      ]);
      assert.deepEqual(result, {
        complete: true,
        errors: [],
        rootPresent: true,
        captured: [
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
          { pid: 30, creationToken: 'grandchild' },
        ],
        newlyCaptured: [{ pid: 30, creationToken: 'grandchild' }],
        activeOwned: [
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 20, parentPid: 10, creationToken: 'child' },
          { pid: 30, parentPid: 20, creationToken: 'grandchild' },
        ],
        reusedPids: [],
      });
    }],
    ['same-snapshot-multi-generation', () => {
      const result = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [{ pid: 10, creationToken: 'root' }],
        snapshotRows: [
          { pid: 40, parentPid: 30, creationToken: 'great-grandchild' },
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 30, parentPid: 20, creationToken: 'grandchild' },
          { pid: 20, parentPid: 10, creationToken: 'child' },
        ],
      });
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'child' },
        { pid: 30, creationToken: 'grandchild' },
        { pid: 40, creationToken: 'great-grandchild' },
      ]);
      assert.deepEqual(result.newlyCaptured, [
        { pid: 20, creationToken: 'child' },
        { pid: 30, creationToken: 'grandchild' },
        { pid: 40, creationToken: 'great-grandchild' },
      ]);
      assert.equal(result.rootPresent, true);
      assert.deepEqual(result.activeOwned, [
        { pid: 10, parentPid: 0, creationToken: 'root' },
        { pid: 20, parentPid: 10, creationToken: 'child' },
        { pid: 30, parentPid: 20, creationToken: 'grandchild' },
        { pid: 40, parentPid: 30, creationToken: 'great-grandchild' },
      ]);
    }],
    ['root-gone-child-active', () => {
      const result = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
        ],
        snapshotRows: [{ pid: 20, parentPid: 10, creationToken: 'child' }],
      });
      assert.equal(result.rootPresent, false);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'child' },
      ]);
      assert.deepEqual(result.newlyCaptured, []);
      assert.deepEqual(result.activeOwned, [
        { pid: 20, parentPid: 10, creationToken: 'child' },
      ]);
    }],
    ['reparented-captured-child-seeds-descendant', () => {
      const result = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
        ],
        snapshotRows: [
          { pid: 40, parentPid: 99, creationToken: 'unrelated' },
          { pid: 30, parentPid: 20, creationToken: 'new-descendant' },
          { pid: 20, parentPid: 99, creationToken: 'child' },
        ],
      });
      assert.equal(result.rootPresent, false);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'child' },
        { pid: 30, creationToken: 'new-descendant' },
      ]);
      assert.deepEqual(result.newlyCaptured, [{ pid: 30, creationToken: 'new-descendant' }]);
      assert.deepEqual(result.activeOwned, [
        { pid: 20, parentPid: 99, creationToken: 'child' },
        { pid: 30, parentPid: 20, creationToken: 'new-descendant' },
      ]);
    }],
    ['monotonic-absent-identities', () => {
      const result = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [
          { pid: 30, creationToken: 'old-grandchild' },
          { pid: 20, creationToken: 'child' },
          { pid: 10, creationToken: 'root' },
        ],
        snapshotRows: [{ pid: 10, parentPid: 0, creationToken: 'root' }],
      });
      assert.equal(result.rootPresent, true);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'child' },
        { pid: 30, creationToken: 'old-grandchild' },
      ]);
      assert.deepEqual(result.newlyCaptured, []);
      assert.deepEqual(result.activeOwned, [
        { pid: 10, parentPid: 0, creationToken: 'root' },
      ]);
    }],
    ['exact-root-presence-and-root-reuse', () => {
      const present = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [{ pid: 10, creationToken: 'root' }],
        snapshotRows: [{ pid: 10, parentPid: 0, creationToken: 'root' }],
      });
      assert.equal(present.rootPresent, true);
      assert.deepEqual(present.reusedPids, []);

      const reused = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [{ pid: 10, creationToken: 'root' }],
        snapshotRows: [{ pid: 10, parentPid: 0, creationToken: 'new-root' }],
      });
      assert.equal(reused.rootPresent, false);
      assert.deepEqual(reused.captured, [{ pid: 10, creationToken: 'root' }]);
      assert.deepEqual(reused.activeOwned, []);
      assert.deepEqual(reused.reusedPids, [10]);
    }],
    ['pid-reuse-exclusion-and-reused-descendant-not-followed', () => {
      const result = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [
          { pid: 20, creationToken: 'old-child' },
          { pid: 10, creationToken: 'root' },
        ],
        snapshotRows: [
          { pid: 50, parentPid: 10, creationToken: 'new-legitimate-child' },
          { pid: 40, parentPid: 20, creationToken: 'descendant-of-reused' },
          { pid: 20, parentPid: 10, creationToken: 'new-child' },
          { pid: 10, parentPid: 0, creationToken: 'root' },
        ],
      });
      assert.equal(result.rootPresent, true);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'old-child' },
        { pid: 50, creationToken: 'new-legitimate-child' },
      ]);
      assert.deepEqual(result.newlyCaptured, [
        { pid: 50, creationToken: 'new-legitimate-child' },
      ]);
      assert.deepEqual(result.activeOwned, [
        { pid: 10, parentPid: 0, creationToken: 'root' },
        { pid: 50, parentPid: 10, creationToken: 'new-legitimate-child' },
      ]);
      assert.deepEqual(result.reusedPids, [20]);
    }],
    ['previous-captured-missing-or-conflicting-root', () => {
      const missing = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [{ pid: 20, creationToken: 'child' }],
        snapshotRows: [],
      });
      assertRepeatedFailure(missing, 'root-missing');

      const conflicting = captureOwnedProcessClosure({
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [{ pid: 10, creationToken: 'old-root' }],
        snapshotRows: [],
      });
      assertRepeatedFailure(conflicting, 'root-pid-reused');
    }],
    ['repeated-malformed-and-bounded-inputs', () => {
      const validRoot = { pid: 10, creationToken: 'root' };
      const validPrevious = [validRoot];
      const validSnapshot = [{ pid: 10, parentPid: 0, creationToken: 'root' }];
      const captureCases = [
        ['invalid-root-input', undefined, undefined, undefined, 'invalid-root'],
        ['non-array-previous', validRoot, {}, validSnapshot, 'invalid-previous-captured'],
        ['empty-previous', validRoot, [], validSnapshot, 'invalid-previous-captured'],
        ['oversized-previous', validRoot, new Array(MAX_SNAPSHOT_ROWS + 1), validSnapshot, 'captured-oversize'],
        ['malformed-identity', validRoot, [{}], validSnapshot, 'invalid-identity'],
        ['duplicate-identity', validRoot, [validRoot, validRoot], validSnapshot, 'duplicate-pid'],
        ['non-array-snapshot', validRoot, validPrevious, {}, 'invalid-snapshot'],
        ['malformed-row', validRoot, validPrevious, [{}], 'invalid-row'],
        [
          'duplicate-row',
          validRoot,
          validPrevious,
          [
            { pid: 10, parentPid: 0, creationToken: 'root' },
            { pid: 10, parentPid: 0, creationToken: 'duplicate' },
          ],
          'duplicate-pid',
        ],
        ['oversized-snapshot', validRoot, validPrevious, new Array(MAX_SNAPSHOT_ROWS + 1), 'snapshot-oversize'],
        [
          'self-parent',
          validRoot,
          validPrevious,
          [{ pid: 11, parentPid: 11, creationToken: 'self' }],
          'self-parent',
        ],
        [
          'parent-cycle',
          validRoot,
          validPrevious,
          [
            { pid: 11, parentPid: 12, creationToken: 'one' },
            { pid: 12, parentPid: 11, creationToken: 'two' },
          ],
          'parent-cycle',
        ],
        [
          'extra-top-level-key',
          validRoot,
          validPrevious,
          validSnapshot,
          'invalid-input',
          { extra: true },
        ],
      ];

      for (const [name, rootIdentity, previousCaptured, snapshotRows, code, extra] of captureCases) {
        const input = {
          rootIdentity,
          previousCaptured,
          snapshotRows,
          ...(extra === undefined ? {} : extra),
        };
        const result = captureOwnedProcessClosure(input);
        try {
          assertRepeatedFailure(result, code);
        } catch (error) {
          error.message = `${name}: ${error.message}`;
          throw error;
        }
      }

      assertRepeatedFailure(captureOwnedProcessClosure(), 'invalid-input');
    }],
    ['disappearance-remaining', () => {
      const result = inspectCapturedProcessDisappearance({
        captured: [
          { pid: 30, creationToken: 'grandchild' },
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
        ],
        snapshotRows: [
          { pid: 30, parentPid: 20, creationToken: 'grandchild' },
          { pid: 90, parentPid: 0, creationToken: 'unrelated' },
          { pid: 20, parentPid: 10, creationToken: 'child' },
        ],
      });
      assert.deepEqual(Object.keys(result), [
        'complete',
        'errors',
        'treeGone',
        'remaining',
        'reusedPids',
      ]);
      assert.deepEqual(result, {
        complete: true,
        errors: [],
        treeGone: false,
        remaining: [
          { pid: 20, creationToken: 'child' },
          { pid: 30, creationToken: 'grandchild' },
        ],
        reusedPids: [],
      });
    }],
    ['disappearance-empty-snapshot', () => {
      const result = inspectCapturedProcessDisappearance({
        captured: [{ pid: 10, creationToken: 'root' }],
        snapshotRows: [],
      });
      assert.deepEqual(result, {
        complete: true,
        errors: [],
        treeGone: true,
        remaining: [],
        reusedPids: [],
      });
    }],
    ['disappearance-only-reused-occupants', () => {
      const result = inspectCapturedProcessDisappearance({
        captured: [
          { pid: 20, creationToken: 'child' },
          { pid: 10, creationToken: 'root' },
        ],
        snapshotRows: [
          { pid: 10, parentPid: 0, creationToken: 'new-root' },
          { pid: 20, parentPid: 10, creationToken: 'new-child' },
        ],
      });
      assert.equal(result.complete, true);
      assert.equal(result.treeGone, true);
      assert.deepEqual(result.remaining, []);
      assert.deepEqual(result.reusedPids, [10, 20]);
    }],
    ['disappearance-mixed-remaining-and-reuse', () => {
      const result = inspectCapturedProcessDisappearance({
        captured: [
          { pid: 30, creationToken: 'grandchild' },
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
        ],
        snapshotRows: [
          { pid: 10, parentPid: 0, creationToken: 'new-root' },
          { pid: 30, parentPid: 20, creationToken: 'grandchild' },
        ],
      });
      assert.equal(result.treeGone, false);
      assert.deepEqual(result.remaining, [{ pid: 30, creationToken: 'grandchild' }]);
      assert.deepEqual(result.reusedPids, [10]);
    }],
    ['disappearance-malformed-and-bounded-inputs', () => {
      const validCaptured = [{ pid: 10, creationToken: 'root' }];
      const validSnapshot = [{ pid: 10, parentPid: 0, creationToken: 'root' }];
      const cases = [
        ['invalid-captured-input', undefined, undefined, 'invalid-captured'],
        ['non-array-captured', {}, validSnapshot, 'invalid-captured'],
        ['empty-captured', [], validSnapshot, 'invalid-captured'],
        ['oversized-captured', new Array(MAX_SNAPSHOT_ROWS + 1), validSnapshot, 'captured-oversize'],
        ['malformed-identity', [{}], validSnapshot, 'invalid-identity'],
        ['duplicate-identity', [validCaptured[0], validCaptured[0]], validSnapshot, 'duplicate-pid'],
        ['non-array-snapshot', validCaptured, {}, 'invalid-snapshot'],
        ['malformed-row', validCaptured, [{}], 'invalid-row'],
        [
          'duplicate-row',
          validCaptured,
          [
            { pid: 10, parentPid: 0, creationToken: 'root' },
            { pid: 10, parentPid: 0, creationToken: 'duplicate' },
          ],
          'duplicate-pid',
        ],
        ['oversized-snapshot', validCaptured, new Array(MAX_SNAPSHOT_ROWS + 1), 'snapshot-oversize'],
        ['extra-top-level-key', validCaptured, validSnapshot, 'invalid-input', { extra: true }],
      ];

      for (const [name, captured, snapshotRows, code, extra] of cases) {
        const input = {
          captured,
          snapshotRows,
          ...(extra === undefined ? {} : extra),
        };
        const result = inspectCapturedProcessDisappearance(input);
        try {
          assertDisappearanceFailure(result, code);
        } catch (error) {
          error.message = `${name}: ${error.message}`;
          throw error;
        }
      }

      assertDisappearanceFailure(inspectCapturedProcessDisappearance(), 'invalid-input');
    }],
    ['new-apis-never-throw', () => {
      const validCaptureInput = {
        rootIdentity: { pid: 10, creationToken: 'root' },
        previousCaptured: [{ pid: 10, creationToken: 'root' }],
        snapshotRows: [{ pid: 10, parentPid: 0, creationToken: 'root' }],
      };
      const revokedSnapshot = Proxy.revocable([], {});
      revokedSnapshot.revoke();
      let threw = false;
      let result;
      try {
        result = captureOwnedProcessClosure({
          ...validCaptureInput,
          snapshotRows: revokedSnapshot.proxy,
        });
      } catch {
        threw = true;
      }
      assert.equal(threw, false);
      assertRepeatedFailure(result, 'invalid-input');

      const revokedCaptured = Proxy.revocable([], {});
      revokedCaptured.revoke();
      threw = false;
      try {
        result = inspectCapturedProcessDisappearance({
          captured: revokedCaptured.proxy,
          snapshotRows: [],
        });
      } catch {
        threw = true;
      }
      assert.equal(threw, false);
      assertDisappearanceFailure(result, 'invalid-input');

      const throwingRoot = {};
      Object.defineProperties(throwingRoot, {
        pid: {
          configurable: true,
          enumerable: true,
          get() {
            throw new Error('getter failure');
          },
        },
        creationToken: {
          configurable: true,
          enumerable: true,
          value: 'root',
        },
      });
      threw = false;
      try {
        result = captureOwnedProcessClosure({
          ...validCaptureInput,
          rootIdentity: throwingRoot,
        });
      } catch {
        threw = true;
      }
      assert.equal(threw, false);
      assertRepeatedFailure(result, 'invalid-input');

      const throwingIdentity = {};
      Object.defineProperties(throwingIdentity, {
        pid: {
          configurable: true,
          enumerable: true,
          get() {
            throw new Error('getter failure');
          },
        },
        creationToken: {
          configurable: true,
          enumerable: true,
          value: 'root',
        },
      });
      threw = false;
      try {
        result = inspectCapturedProcessDisappearance({
          captured: [throwingIdentity],
          snapshotRows: [],
        });
      } catch {
        threw = true;
      }
      assert.equal(threw, false);
      assertDisappearanceFailure(result, 'invalid-input');

      const revokedInput = Proxy.revocable(validCaptureInput, {});
      revokedInput.revoke();
      threw = false;
      try {
        result = captureOwnedProcessClosure(revokedInput.proxy);
      } catch {
        threw = true;
      }
      assert.equal(threw, false);
      assertRepeatedFailure(result, 'invalid-input');
    }],
  ];

  for (const [name, test] of tests) {
    try {
      test();
    } catch (error) {
      error.message = `${name}: ${error.message}`;
      throw error;
    }
  }

  console.log(`${tests.length} process-tree contract selftests passed`);
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly && process.argv.includes('--selftest')) {
  runSelftest();
}
