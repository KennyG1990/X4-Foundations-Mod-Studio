import { types as nodeUtilTypes } from 'node:util';

import { captureProcessTableSnapshot } from './e2e-process-table-adapter.mjs';
import {
  captureInitialOwnedProcessClosure,
  captureOwnedProcessClosure,
} from './e2e-process-tree-contract.mjs';

const ERR_SPAWNED_OWNERSHIP_INVALID_INPUT = 'spawned-ownership-invalid-input';
const ERR_SPAWNED_OWNERSHIP_SNAPSHOT_FAILED = 'spawned-ownership-snapshot-failed';
const ERR_SPAWNED_OWNERSHIP_ROOT_UNAVAILABLE = 'spawned-ownership-root-unavailable';
const ERR_SPAWNED_OWNERSHIP_PLAN_FAILED = 'spawned-ownership-plan-failed';
const MAX_IDENTITIES = 100000;

const cloneIdentity = (identity) => (identity === null ? null : { ...identity });

const buildResult = ({
  complete = false,
  errors = [],
  rootIdentity = null,
  rootPresent = false,
  captured = [],
  newlyCaptured = [],
  reusedPids = [],
} = {}) => ({
  complete,
  errors: [...errors],
  rootIdentity: cloneIdentity(rootIdentity),
  rootPresent,
  captured: captured.map(cloneIdentity),
  newlyCaptured: newlyCaptured.map(cloneIdentity),
  reusedPids: [...reusedPids],
});

function isProxyObject(value) {
  try {
    return nodeUtilTypes.isProxy(value) === true;
  } catch {
    return true;
  }
}

function isPlainRecord(value) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyObject(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function isEnumerableDataDescriptor(descriptor) {
  try {
    return descriptor !== null
      && typeof descriptor === 'object'
      && descriptor.enumerable === true
      && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      && !Object.prototype.hasOwnProperty.call(descriptor, 'get')
      && !Object.prototype.hasOwnProperty.call(descriptor, 'set');
  } catch {
    return false;
  }
}

function hasExactOrderedDataKeys(value, keys) {
  try {
    if (!isPlainRecord(value) || !Array.isArray(keys)) return false;
    if (keys.some((key) => typeof key !== 'string')) return false;

    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return false;

    for (let index = 0; index < keys.length; index += 1) {
      if (typeof ownKeys[index] !== 'string' || ownKeys[index] !== keys[index]) return false;
      if (!isEnumerableDataDescriptor(Object.getOwnPropertyDescriptor(value, keys[index]))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function readExactIdentity(value) {
  try {
    if (value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || isProxyObject(value)
      || !hasExactOrderedDataKeys(value, ['pid', 'creationToken'])) return null;
    const pidDescriptor = Object.getOwnPropertyDescriptor(value, 'pid');
    const creationTokenDescriptor = Object.getOwnPropertyDescriptor(value, 'creationToken');
    if (!isEnumerableDataDescriptor(pidDescriptor) || !isEnumerableDataDescriptor(creationTokenDescriptor)) return null;
    const pid = pidDescriptor.value;
    const creationToken = creationTokenDescriptor.value;
    if (!Number.isSafeInteger(pid)
      || pid <= 0
      || typeof creationToken !== 'string'
      || creationToken.trim().length === 0
      || creationToken.trim() !== creationToken
      || creationToken.length > 128
      || /[\u0000-\u001F\u007F]/u.test(creationToken)) return null;
    return { pid, creationToken };
  } catch {
    return null;
  }
}

function readDenseIdentityArray(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || isProxyObject(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined
      || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
      || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'get')
      || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'set')
      || lengthDescriptor.writable !== true
      || lengthDescriptor.enumerable !== false
      || lengthDescriptor.configurable !== false) return null;
    const length = lengthDescriptor.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_IDENTITIES) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== length + 1) return null;
    for (let index = 0; index < length; index += 1) {
      if (ownKeys[index] !== String(index)) return null;
    }
    if (ownKeys[length] !== 'length') return null;

    const identities = [];
    const seenPids = new Set();
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      const identity = readExactIdentity(descriptor.value);
      if (identity === null || seenPids.has(identity.pid)) return null;
      seenPids.add(identity.pid);
      identities.push(identity);
    }
    return identities;
  } catch {
    return null;
  }
}

function readDensePidArray(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || isProxyObject(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined
      || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
      || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'get')
      || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'set')
      || lengthDescriptor.writable !== true
      || lengthDescriptor.enumerable !== false
      || lengthDescriptor.configurable !== false) return null;
    const length = lengthDescriptor.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_IDENTITIES) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== length + 1) return null;
    for (let index = 0; index < length; index += 1) {
      if (ownKeys[index] !== String(index)) return null;
    }
    if (ownKeys[length] !== 'length') return null;

    const pids = [];
    const seenPids = new Set();
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      const pid = descriptor.value;
      if (!Number.isSafeInteger(pid) || pid <= 0 || seenPids.has(pid)) return null;
      seenPids.add(pid);
      pids.push(pid);
    }
    return pids;
  } catch {
    return null;
  }
}

function readExactSnapshotRow(value) {
  try {
    if (value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || isProxyObject(value)
      || !hasExactOrderedDataKeys(value, ['pid', 'parentPid', 'creationToken'])) return null;
    const pidDescriptor = Object.getOwnPropertyDescriptor(value, 'pid');
    const parentPidDescriptor = Object.getOwnPropertyDescriptor(value, 'parentPid');
    const creationTokenDescriptor = Object.getOwnPropertyDescriptor(value, 'creationToken');
    if (!isEnumerableDataDescriptor(pidDescriptor)
      || !isEnumerableDataDescriptor(parentPidDescriptor)
      || !isEnumerableDataDescriptor(creationTokenDescriptor)) return null;
    const pid = pidDescriptor.value;
    const parentPid = parentPidDescriptor.value;
    const creationToken = creationTokenDescriptor.value;
    if (!Number.isSafeInteger(pid)
      || pid <= 0
      || !Number.isSafeInteger(parentPid)
      || parentPid < 0
      || typeof creationToken !== 'string'
      || creationToken.trim().length === 0
      || creationToken.trim() !== creationToken
      || creationToken.length > 128
      || /[\u0000-\u001F\u007F]/u.test(creationToken)) return null;
    return { pid, parentPid, creationToken };
  } catch {
    return null;
  }
}

function readDenseSnapshotRows(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || isProxyObject(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined
      || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
      || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'get')
      || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'set')
      || lengthDescriptor.writable !== true
      || lengthDescriptor.enumerable !== false
      || lengthDescriptor.configurable !== false) return null;
    const length = lengthDescriptor.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_IDENTITIES) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== length + 1) return null;
    for (let index = 0; index < length; index += 1) {
      if (ownKeys[index] !== String(index)) return null;
    }
    if (ownKeys[length] !== 'length') return null;

    const rows = [];
    const seenPids = new Set();
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      const row = readExactSnapshotRow(descriptor.value);
      if (row === null || seenPids.has(row.pid)) return null;
      seenPids.add(row.pid);
      rows.push(row);
    }
    return rows;
  } catch {
    return null;
  }
}

function isOrdinaryEmptyArray(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || isProxyObject(value)) return false;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== 1 || ownKeys[0] !== 'length') return false;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    return lengthDescriptor !== undefined
      && Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
      && !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'get')
      && !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'set')
      && lengthDescriptor.value === 0
      && lengthDescriptor.writable === true
      && lengthDescriptor.enumerable === false
      && lengthDescriptor.configurable === false;
  } catch {
    return false;
  }
}

function normalizeSnapshotOptions(value) {
  try {
    if (!isPlainRecord(value)) return null;

    const descriptors = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !['platform', 'execFileImpl', 'timeoutMs'].includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      descriptors.push([key, descriptor.value]);
    }

    for (const [key, optionValue] of descriptors) {
      if (key === 'platform' && optionValue !== undefined && typeof optionValue !== 'string') return null;
      if (key === 'execFileImpl' && optionValue !== undefined && typeof optionValue !== 'function') return null;
      if (key === 'timeoutMs'
        && optionValue !== undefined
        && (!Number.isSafeInteger(optionValue) || optionValue < 10 || optionValue > 15000)) return null;
    }

    const clone = {};
    for (const [key, optionValue] of descriptors) {
      clone[key] = optionValue;
    }
    return clone;
  } catch {
    return null;
  }
}

function normalizeSampleInput(input) {
  try {
    if (!hasExactOrderedDataKeys(input, ['rootIdentity', 'previousCaptured', 'snapshotOptions'])) return null;

    const rootIdentityDescriptor = Object.getOwnPropertyDescriptor(input, 'rootIdentity');
    const previousCapturedDescriptor = Object.getOwnPropertyDescriptor(input, 'previousCaptured');
    const snapshotOptionsDescriptor = Object.getOwnPropertyDescriptor(input, 'snapshotOptions');
    if (!isEnumerableDataDescriptor(rootIdentityDescriptor)
      || !isEnumerableDataDescriptor(previousCapturedDescriptor)
      || !isEnumerableDataDescriptor(snapshotOptionsDescriptor)) return null;

    const rootIdentity = readExactIdentity(rootIdentityDescriptor.value);
    const previousCaptured = readDenseIdentityArray(previousCapturedDescriptor.value);
    const snapshotOptions = normalizeSnapshotOptions(snapshotOptionsDescriptor.value);
    if (rootIdentity === null || previousCaptured === null || previousCaptured.length === 0 || snapshotOptions === null) return null;

    let containsRootIdentity = false;
    for (const identity of previousCaptured) {
      if (identity.pid === rootIdentity.pid && identity.creationToken === rootIdentity.creationToken) {
        containsRootIdentity = true;
        break;
      }
    }
    if (!containsRootIdentity) return null;

    return {
      rootIdentity: { ...rootIdentity },
      previousCaptured: previousCaptured.map((identity) => ({ ...identity })),
      snapshotOptions: { ...snapshotOptions },
    };
  } catch {
    return null;
  }
}

function normalizeInitializeInput(input) {
  try {
    if (!hasExactOrderedDataKeys(input, ['rootPid', 'snapshotOptions'])) return null;

    const rootPidDescriptor = Object.getOwnPropertyDescriptor(input, 'rootPid');
    const snapshotOptionsDescriptor = Object.getOwnPropertyDescriptor(input, 'snapshotOptions');
    if (!isEnumerableDataDescriptor(rootPidDescriptor)
      || !isEnumerableDataDescriptor(snapshotOptionsDescriptor)) return null;

    const rootPid = rootPidDescriptor.value;
    if (!Number.isSafeInteger(rootPid) || rootPid <= 0) return null;

    const snapshotOptions = normalizeSnapshotOptions(snapshotOptionsDescriptor.value);
    if (snapshotOptions === null) return null;

    return { rootPid, snapshotOptions };
  } catch {
    return null;
  }
}

function readSnapshotEnvelope(value) {
  try {
    if (value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || isProxyObject(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || !hasExactOrderedDataKeys(value, ['complete', 'errors', 'rows'])) return null;

    const completeDescriptor = Object.getOwnPropertyDescriptor(value, 'complete');
    const errorsDescriptor = Object.getOwnPropertyDescriptor(value, 'errors');
    const rowsDescriptor = Object.getOwnPropertyDescriptor(value, 'rows');
    if (!isEnumerableDataDescriptor(completeDescriptor)
      || !isEnumerableDataDescriptor(errorsDescriptor)
      || !isEnumerableDataDescriptor(rowsDescriptor)
      || completeDescriptor.value !== true
      || !isOrdinaryEmptyArray(errorsDescriptor.value)) return null;

    const rows = readDenseSnapshotRows(rowsDescriptor.value);
    if (rows === null) return null;

    return rows.map((row) => ({ ...row }));
  } catch {
    return null;
  }
}

function readInitialClosureEnvelope(value, expectedRoot) {
  try {
    if (value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || isProxyObject(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || !hasExactOrderedDataKeys(value, ['complete', 'errors', 'rootPresent', 'captured'])) return null;

    const completeDescriptor = Object.getOwnPropertyDescriptor(value, 'complete');
    const errorsDescriptor = Object.getOwnPropertyDescriptor(value, 'errors');
    const rootPresentDescriptor = Object.getOwnPropertyDescriptor(value, 'rootPresent');
    const capturedDescriptor = Object.getOwnPropertyDescriptor(value, 'captured');
    if (!isEnumerableDataDescriptor(completeDescriptor)
      || !isEnumerableDataDescriptor(errorsDescriptor)
      || !isEnumerableDataDescriptor(rootPresentDescriptor)
      || !isEnumerableDataDescriptor(capturedDescriptor)
      || completeDescriptor.value !== true
      || !isOrdinaryEmptyArray(errorsDescriptor.value)
      || rootPresentDescriptor.value !== true) return null;

    const root = readExactIdentity(expectedRoot);
    const captured = readDenseIdentityArray(capturedDescriptor.value);
    if (root === null || captured === null || captured.length === 0) return null;

    let containsExpectedRoot = false;
    for (const identity of captured) {
      if (identity.pid === root.pid && identity.creationToken === root.creationToken) {
        containsExpectedRoot = true;
        break;
      }
    }
    if (!containsExpectedRoot) return null;

    return {
      rootPresent: true,
      captured: captured.map((identity) => ({ ...identity })),
    };
  } catch {
    return null;
  }
}

function readRepeatedClosureEnvelope(value, expectedRoot, previousCaptured) {
  try {
    if (value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || isProxyObject(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || !hasExactOrderedDataKeys(value, [
        'complete',
        'errors',
        'rootPresent',
        'captured',
        'newlyCaptured',
        'activeOwned',
        'reusedPids',
      ])) return null;

    const completeDescriptor = Object.getOwnPropertyDescriptor(value, 'complete');
    const errorsDescriptor = Object.getOwnPropertyDescriptor(value, 'errors');
    const rootPresentDescriptor = Object.getOwnPropertyDescriptor(value, 'rootPresent');
    const capturedDescriptor = Object.getOwnPropertyDescriptor(value, 'captured');
    const newlyCapturedDescriptor = Object.getOwnPropertyDescriptor(value, 'newlyCaptured');
    const activeOwnedDescriptor = Object.getOwnPropertyDescriptor(value, 'activeOwned');
    const reusedPidsDescriptor = Object.getOwnPropertyDescriptor(value, 'reusedPids');
    if (!isEnumerableDataDescriptor(completeDescriptor)
      || !isEnumerableDataDescriptor(errorsDescriptor)
      || !isEnumerableDataDescriptor(rootPresentDescriptor)
      || !isEnumerableDataDescriptor(capturedDescriptor)
      || !isEnumerableDataDescriptor(newlyCapturedDescriptor)
      || !isEnumerableDataDescriptor(activeOwnedDescriptor)
      || !isEnumerableDataDescriptor(reusedPidsDescriptor)) return null;

    const complete = completeDescriptor.value;
    const errors = errorsDescriptor.value;
    const rootPresent = rootPresentDescriptor.value;
    const expected = readExactIdentity(expectedRoot);
    const previous = readDenseIdentityArray(previousCaptured);
    const captured = readDenseIdentityArray(capturedDescriptor.value);
    const newlyCaptured = readDenseIdentityArray(newlyCapturedDescriptor.value);
    const activeOwned = readDenseSnapshotRows(activeOwnedDescriptor.value);
    const reusedPids = readDensePidArray(reusedPidsDescriptor.value);
    if (complete !== true
      || !isOrdinaryEmptyArray(errors)
      || typeof rootPresent !== 'boolean'
      || expected === null
      || previous === null
      || previous.length === 0
      || captured === null
      || newlyCaptured === null
      || activeOwned === null
      || reusedPids === null) return null;

    const previousTokensByPid = new Map();
    for (const identity of previous) {
      previousTokensByPid.set(identity.pid, identity.creationToken);
    }

    const capturedTokensByPid = new Map();
    for (const identity of captured) {
      capturedTokensByPid.set(identity.pid, identity.creationToken);
    }
    for (const identity of previous) {
      if (capturedTokensByPid.get(identity.pid) !== identity.creationToken) return null;
    }
    if (capturedTokensByPid.get(expected.pid) !== expected.creationToken) return null;

    for (const identity of newlyCaptured) {
      if (previousTokensByPid.has(identity.pid)
        || capturedTokensByPid.get(identity.pid) !== identity.creationToken) return null;
    }

    const activeOwnedTokensByPid = new Map();
    for (const row of activeOwned) {
      if (capturedTokensByPid.get(row.pid) !== row.creationToken) return null;
      activeOwnedTokensByPid.set(row.pid, row.creationToken);
    }
    for (const pid of reusedPids) {
      if (!capturedTokensByPid.has(pid)
        || activeOwnedTokensByPid.get(pid) === capturedTokensByPid.get(pid)) return null;
    }

    const rootIsPresent = activeOwnedTokensByPid.get(expected.pid) === expected.creationToken;
    if (rootPresent !== rootIsPresent) return null;

    return {
      rootPresent,
      captured: captured.map((identity) => ({ ...identity })),
      newlyCaptured: newlyCaptured.map((identity) => ({ ...identity })),
      reusedPids: [...reusedPids],
    };
  } catch {
    return null;
  }
}

// Durable tests remain for this ownership workflow.
export async function initializeSpawnedProcessOwnership(input = {}) {
  const normalized = normalizeInitializeInput(input);
  if (normalized === null) {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_INVALID_INPUT] });
  }

  let snapshotEnvelope;
  try {
    snapshotEnvelope = await captureProcessTableSnapshot(normalized.snapshotOptions);
  } catch {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_SNAPSHOT_FAILED] });
  }

  const snapshotRows = readSnapshotEnvelope(snapshotEnvelope);
  if (snapshotRows === null) {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_SNAPSHOT_FAILED] });
  }

  const rootRow = snapshotRows.find((row) => row.pid === normalized.rootPid);
  if (rootRow === undefined) {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_ROOT_UNAVAILABLE] });
  }

  const rootIdentity = {
    pid: rootRow.pid,
    creationToken: rootRow.creationToken,
  };

  let initialClosureEnvelope;
  try {
    initialClosureEnvelope = captureInitialOwnedProcessClosure(rootIdentity, snapshotRows);
  } catch {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_PLAN_FAILED] });
  }

  const initialClosure = readInitialClosureEnvelope(initialClosureEnvelope, rootIdentity);
  if (initialClosure === null) {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_PLAN_FAILED] });
  }

  return buildResult({
    complete: true,
    errors: [],
    rootIdentity,
    rootPresent: true,
    captured: initialClosure.captured,
    newlyCaptured: initialClosure.captured.map((identity) => ({ ...identity })),
    reusedPids: [],
  });
}

export async function sampleSpawnedProcessOwnership(input = {}) {
  const normalized = normalizeSampleInput(input);
  if (normalized === null) {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_INVALID_INPUT] });
  }

  let snapshotEnvelope;
  try {
    snapshotEnvelope = await captureProcessTableSnapshot({ ...normalized.snapshotOptions });
  } catch {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_SNAPSHOT_FAILED] });
  }

  const snapshotRows = readSnapshotEnvelope(snapshotEnvelope);
  if (snapshotRows === null) {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_SNAPSHOT_FAILED] });
  }

  let repeatedClosureEnvelope;
  try {
    repeatedClosureEnvelope = captureOwnedProcessClosure({
      rootIdentity: { ...normalized.rootIdentity },
      previousCaptured: normalized.previousCaptured.map((identity) => ({ ...identity })),
      snapshotRows: snapshotRows.map((row) => ({ ...row })),
    });
  } catch {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_PLAN_FAILED] });
  }

  const repeatedClosure = readRepeatedClosureEnvelope(
    repeatedClosureEnvelope,
    normalized.rootIdentity,
    normalized.previousCaptured,
  );
  if (repeatedClosure === null) {
    return buildResult({ errors: [ERR_SPAWNED_OWNERSHIP_PLAN_FAILED] });
  }

  return buildResult({
    complete: true,
    errors: [],
    rootIdentity: { ...normalized.rootIdentity },
    rootPresent: repeatedClosure.rootPresent,
    captured: repeatedClosure.captured,
    newlyCaptured: repeatedClosure.newlyCaptured,
    reusedPids: repeatedClosure.reusedPids,
  });
}
