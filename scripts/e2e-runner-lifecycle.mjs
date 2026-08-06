import { types as nodeUtilTypes } from 'node:util';

import {
  initializeSpawnedProcessOwnership,
  sampleSpawnedProcessOwnership,
} from './e2e-process-ownership-sampler.mjs';
import { terminateCapturedProcessTree } from './e2e-process-termination-executor.mjs';

const DEFAULT_OVERALL_DEADLINE_MS = 1_800_000;
const TERMINAL_GRACE_MS = 5_000;
const OWNERSHIP_SAMPLE_INTERVAL_MS = 1_000;
const TERMINATION_MAX_PASSES = 20;
const TERMINATION_POLL_INTERVAL_MS = 25;
const MAX_FACTS = 100000;
const MAX_LIFECYCLE_PROTOTYPE_DEPTH = 1024;

const E2E_LIFECYCLE_INVALID_INPUT = 'e2e-lifecycle-invalid-input';
const E2E_LIFECYCLE_TIMER_FAILED = 'e2e-lifecycle-timer-failed';
const E2E_LIFECYCLE_OWNERSHIP_INCOMPLETE = 'e2e-lifecycle-ownership-incomplete';
const E2E_LIFECYCLE_CHILD_ERROR = 'e2e-lifecycle-child-error';
const E2E_LIFECYCLE_TERMINATION_FAILED = 'e2e-lifecycle-termination-failed';

function isProxyObject(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }

  try {
    return nodeUtilTypes.isProxy(value);
  } catch {
    return true;
  }
}

function isPlainRecord(value) {
  try {
    if (value === null || typeof value !== 'object' || isProxyObject(value) || Array.isArray(value)) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function isEnumerableDataDescriptor(descriptor) {
  try {
    return descriptor !== undefined
      && descriptor !== null
      && descriptor.enumerable === true
      && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      && Object.prototype.hasOwnProperty.call(descriptor, 'writable')
      && !Object.prototype.hasOwnProperty.call(descriptor, 'get')
      && !Object.prototype.hasOwnProperty.call(descriptor, 'set');
  } catch {
    return false;
  }
}

function hasExactOrderedDataKeys(value, expectedKeys) {
  try {
    if (!Array.isArray(expectedKeys)) {
      return false;
    }

    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== expectedKeys.length) {
      return false;
    }

    for (let index = 0; index < expectedKeys.length; index += 1) {
      const expectedKey = expectedKeys[index];
      if (typeof expectedKey !== 'string' || ownKeys[index] !== expectedKey) {
        return false;
      }

      if (!isEnumerableDataDescriptor(Object.getOwnPropertyDescriptor(value, expectedKey))) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

function readDenseArrayValues(value) {
  try {
    if (isProxyObject(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }

    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined
      || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
      || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'writable')
      || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'get')
      || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'set')
      || lengthDescriptor.value < 0
      || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value > MAX_FACTS
      || lengthDescriptor.writable !== true
      || lengthDescriptor.enumerable !== false
      || lengthDescriptor.configurable !== false) {
      return null;
    }

    const length = lengthDescriptor.value;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== length + 1 || ownKeys[length] !== 'length') {
      return null;
    }

    const values = new Array(length);
    for (let index = 0; index < length; index += 1) {
      if (ownKeys[index] !== String(index)) {
        return null;
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, ownKeys[index]);
      if (!isEnumerableDataDescriptor(descriptor)) {
        return null;
      }

      values[index] = descriptor.value;
    }

    return values;
  } catch {
    return null;
  }
}

function readExactIdentity(value) {
  try {
    if (!isPlainRecord(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || !hasExactOrderedDataKeys(value, ['pid', 'creationToken'])) {
      return null;
    }

    const pidDescriptor = Object.getOwnPropertyDescriptor(value, 'pid');
    const creationTokenDescriptor = Object.getOwnPropertyDescriptor(value, 'creationToken');
    if (!isEnumerableDataDescriptor(pidDescriptor) || !isEnumerableDataDescriptor(creationTokenDescriptor)) {
      return null;
    }

    const pid = pidDescriptor.value;
    const rawCreationToken = creationTokenDescriptor.value;
    if (!Number.isSafeInteger(pid) || pid <= 0 || typeof rawCreationToken !== 'string') {
      return null;
    }

    if (/[\u0000-\u001F\u007F-\u009F]/u.test(rawCreationToken)) {
      return null;
    }

    if (rawCreationToken.length === 0
      || rawCreationToken.length > 128
      || rawCreationToken.trim() !== rawCreationToken) {
      return null;
    }

    return { pid, creationToken: rawCreationToken };
  } catch {
    return null;
  }
}

function readDenseIdentityArray(value) {
  const values = readDenseArrayValues(value);
  if (values === null) {
    return null;
  }

  try {
    const result = new Array(values.length);
    const seenPids = new Set();
    for (let index = 0; index < values.length; index += 1) {
      const identity = readExactIdentity(values[index]);
      if (identity === null || seenPids.has(identity.pid)) {
        return null;
      }

      seenPids.add(identity.pid);
      result[index] = identity;
    }

    return result;
  } catch {
    return null;
  }
}

function readDensePidArray(value) {
  const values = readDenseArrayValues(value);
  if (values === null) {
    return null;
  }

  try {
    const result = new Array(values.length);
    const seenPids = new Set();
    for (let index = 0; index < values.length; index += 1) {
      const pid = values[index];
      if (!Number.isSafeInteger(pid) || pid <= 0 || seenPids.has(pid)) {
        return null;
      }

      seenPids.add(pid);
      result[index] = pid;
    }

    return result;
  } catch {
    return null;
  }
}

function readStableErrors(value) {
  const values = readDenseArrayValues(value);
  if (values === null || values.length > 1) {
    return null;
  }

  try {
    if (values.length === 0) {
      return [];
    }

    const error = values[0];
    if (typeof error !== 'string'
      || error.length === 0
      || error.length > 128
      || error.trim() !== error
      || /[\u0000-\u001F\u007F-\u009F]/u.test(error)) {
      return null;
    }

    return [error];
  } catch {
    return null;
  }
}

function isOrdinaryEmptyArray(value) {
  const values = readDenseArrayValues(value);
  return values !== null && values.length === 0;
}

function cloneIdentity(value) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  return {
    pid: value.pid,
    creationToken: value.creationToken,
  };
}

function cloneIdentityArray(array) {
  return array.map(cloneIdentity);
}

function clonePidArray(array) {
  return array.map((pid) => pid);
}

function cloneOwnershipEnvelope(value) {
  return {
    complete: value.complete,
    errors: value.errors.map((error) => error),
    rootIdentity: cloneIdentity(value.rootIdentity),
    rootPresent: value.rootPresent,
    captured: cloneIdentityArray(value.captured),
    newlyCaptured: cloneIdentityArray(value.newlyCaptured),
    reusedPids: clonePidArray(value.reusedPids),
  };
}

function readOwnershipEnvelopeBase(value) {
  try {
    if (!isPlainRecord(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || !hasExactOrderedDataKeys(value, [
        'complete',
        'errors',
        'rootIdentity',
        'rootPresent',
        'captured',
        'newlyCaptured',
        'reusedPids',
      ])) {
      return null;
    }

    const completeDescriptor = Object.getOwnPropertyDescriptor(value, 'complete');
    const errorsDescriptor = Object.getOwnPropertyDescriptor(value, 'errors');
    const rootIdentityDescriptor = Object.getOwnPropertyDescriptor(value, 'rootIdentity');
    const rootPresentDescriptor = Object.getOwnPropertyDescriptor(value, 'rootPresent');
    const capturedDescriptor = Object.getOwnPropertyDescriptor(value, 'captured');
    const newlyCapturedDescriptor = Object.getOwnPropertyDescriptor(value, 'newlyCaptured');
    const reusedPidsDescriptor = Object.getOwnPropertyDescriptor(value, 'reusedPids');
    if (!isEnumerableDataDescriptor(completeDescriptor)
      || !isEnumerableDataDescriptor(errorsDescriptor)
      || !isEnumerableDataDescriptor(rootIdentityDescriptor)
      || !isEnumerableDataDescriptor(rootPresentDescriptor)
      || !isEnumerableDataDescriptor(capturedDescriptor)
      || !isEnumerableDataDescriptor(newlyCapturedDescriptor)
      || !isEnumerableDataDescriptor(reusedPidsDescriptor)) {
      return null;
    }

    const complete = completeDescriptor.value;
    const errors = readStableErrors(errorsDescriptor.value);
    const rawRootIdentity = rootIdentityDescriptor.value;
    const rootIdentity = rawRootIdentity === null ? null : readExactIdentity(rawRootIdentity);
    const rootPresent = rootPresentDescriptor.value;
    const captured = readDenseIdentityArray(capturedDescriptor.value);
    const newlyCaptured = readDenseIdentityArray(newlyCapturedDescriptor.value);
    const reusedPids = readDensePidArray(reusedPidsDescriptor.value);
    if (typeof complete !== 'boolean'
      || errors === null
      || (rawRootIdentity !== null && rootIdentity === null)
      || typeof rootPresent !== 'boolean'
      || captured === null
      || newlyCaptured === null
      || reusedPids === null) {
      return null;
    }

    if (complete === false) {
      if (errors.length !== 1
        || rootIdentity !== null
        || rootPresent !== false
        || captured.length !== 0
        || newlyCaptured.length !== 0
        || reusedPids.length !== 0) {
        return null;
      }
    } else if (errors.length !== 0
      || rootIdentity === null
      || captured.length === 0) {
      return null;
    }

    if (complete === true) {
      const capturedByPid = new Map();
      for (const identity of captured) {
        capturedByPid.set(identity.pid, identity.creationToken);
      }

      if (capturedByPid.get(rootIdentity.pid) !== rootIdentity.creationToken) {
        return null;
      }

      for (const identity of newlyCaptured) {
        if (capturedByPid.get(identity.pid) !== identity.creationToken) {
          return null;
        }
      }

      for (const pid of reusedPids) {
        if (!capturedByPid.has(pid)) {
          return null;
        }
      }
    }

    return cloneOwnershipEnvelope({
      complete,
      errors,
      rootIdentity,
      rootPresent,
      captured,
      newlyCaptured,
      reusedPids,
    });
  } catch {
    return null;
  }
}

function readInitialOwnershipEnvelope(value, expectedRootPid) {
  try {
    const envelope = readOwnershipEnvelopeBase(value);
    if (envelope === null
      || envelope.complete !== true
      || !Number.isSafeInteger(expectedRootPid)
      || expectedRootPid <= 0
      || envelope.rootIdentity === null
      || envelope.rootIdentity.pid !== expectedRootPid
      || envelope.rootPresent !== true
      || envelope.newlyCaptured.length !== envelope.captured.length) {
      return null;
    }

    const newlyCapturedByPid = new Map();
    for (const identity of envelope.newlyCaptured) {
      newlyCapturedByPid.set(identity.pid, identity.creationToken);
    }
    for (const identity of envelope.captured) {
      if (newlyCapturedByPid.get(identity.pid) !== identity.creationToken) {
        return null;
      }
    }

    return cloneOwnershipEnvelope(envelope);
  } catch {
    return null;
  }
}

function readSampleOwnershipEnvelope(value, expectedRoot, previousCaptured) {
  try {
    const envelope = readOwnershipEnvelopeBase(value);
    const expected = readExactIdentity(expectedRoot);
    const previous = readDenseIdentityArray(previousCaptured);
    if (envelope === null
      || envelope.complete !== true
      || expected === null
      || previous === null
      || previous.length === 0
      || envelope.rootIdentity === null
      || envelope.rootIdentity.pid !== expected.pid
      || envelope.rootIdentity.creationToken !== expected.creationToken) {
      return null;
    }

    const capturedByPid = new Map();
    for (const identity of envelope.captured) {
      capturedByPid.set(identity.pid, identity.creationToken);
    }

    for (const identity of previous) {
      if (capturedByPid.get(identity.pid) !== identity.creationToken) {
        return null;
      }
    }

    const previousPids = new Set(previous.map((identity) => identity.pid));
    for (const identity of envelope.newlyCaptured) {
      if (previousPids.has(identity.pid)) {
        return null;
      }
    }

    return cloneOwnershipEnvelope(envelope);
  } catch {
    return null;
  }
}

function readTerminationEnvelope(value, expectedRoot, previousCaptured) {
  try {
    if (!isPlainRecord(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || !hasExactOrderedDataKeys(value, [
        'complete',
        'errors',
        'treeGone',
        'passes',
        'captured',
        'commanded',
        'reusedPids',
      ])) {
      return null;
    }

    const completeDescriptor = Object.getOwnPropertyDescriptor(value, 'complete');
    const errorsDescriptor = Object.getOwnPropertyDescriptor(value, 'errors');
    const treeGoneDescriptor = Object.getOwnPropertyDescriptor(value, 'treeGone');
    const passesDescriptor = Object.getOwnPropertyDescriptor(value, 'passes');
    const capturedDescriptor = Object.getOwnPropertyDescriptor(value, 'captured');
    const commandedDescriptor = Object.getOwnPropertyDescriptor(value, 'commanded');
    const reusedPidsDescriptor = Object.getOwnPropertyDescriptor(value, 'reusedPids');
    if (!isEnumerableDataDescriptor(completeDescriptor)
      || !isEnumerableDataDescriptor(errorsDescriptor)
      || !isEnumerableDataDescriptor(treeGoneDescriptor)
      || !isEnumerableDataDescriptor(passesDescriptor)
      || !isEnumerableDataDescriptor(capturedDescriptor)
      || !isEnumerableDataDescriptor(commandedDescriptor)
      || !isEnumerableDataDescriptor(reusedPidsDescriptor)) {
      return null;
    }

    const complete = completeDescriptor.value;
    const errors = readStableErrors(errorsDescriptor.value);
    const treeGone = treeGoneDescriptor.value;
    const passes = passesDescriptor.value;
    const expected = readExactIdentity(expectedRoot);
    const previous = readDenseIdentityArray(previousCaptured);
    const captured = readDenseIdentityArray(capturedDescriptor.value);
    const commanded = readDenseIdentityArray(commandedDescriptor.value);
    const reusedPids = readDensePidArray(reusedPidsDescriptor.value);
    if (typeof complete !== 'boolean'
      || errors === null
      || typeof treeGone !== 'boolean'
      || !Number.isSafeInteger(passes)
      || passes < 0
      || passes > 1000
      || expected === null
      || previous === null
      || previous.length === 0
      || captured === null
      || captured.length === 0
      || commanded === null
      || reusedPids === null) {
      return null;
    }

    const capturedByPid = new Map();
    for (const identity of captured) {
      capturedByPid.set(identity.pid, identity.creationToken);
    }

    if (capturedByPid.get(expected.pid) !== expected.creationToken) {
      return null;
    }

    for (const identity of previous) {
      if (capturedByPid.get(identity.pid) !== identity.creationToken) {
        return null;
      }
    }

    for (const identity of commanded) {
      if (capturedByPid.get(identity.pid) !== identity.creationToken) {
        return null;
      }
    }

    for (const pid of reusedPids) {
      if (!capturedByPid.has(pid)) {
        return null;
      }
    }

    if (complete === true && (errors.length !== 0 || treeGone !== true)) {
      return null;
    }
    if (complete === false && (errors.length !== 1 || treeGone !== false)) {
      return null;
    }

    return {
      complete,
      errors: [...errors],
      treeGone,
      passes,
      captured: cloneIdentityArray(captured),
      commanded: cloneIdentityArray(commanded),
      reusedPids: clonePidArray(reusedPids),
    };
  } catch {
    return null;
  }
}

function normalizeProcessOptions(value) {
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

function boundedInteger(value, defaultValue, min, max) {
  if (value === undefined) return defaultValue;
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

function normalizeLifecycleBounds(descriptors) {
  try {
    const readOptionalDescriptorValue = (key) => {
      const descriptor = descriptors.get(key);
      if (descriptor === undefined) return undefined;
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      return descriptor.value;
    };

    const overallDeadlineMs = boundedInteger(
      readOptionalDescriptorValue('overallDeadlineMs'),
      DEFAULT_OVERALL_DEADLINE_MS,
      10,
      7200000,
    );
    const terminalGraceMs = boundedInteger(
      readOptionalDescriptorValue('terminalGraceMs'),
      TERMINAL_GRACE_MS,
      10,
      60000,
    );
    const sampleIntervalMs = boundedInteger(
      readOptionalDescriptorValue('sampleIntervalMs'),
      OWNERSHIP_SAMPLE_INTERVAL_MS,
      0,
      60000,
    );
    const maxTerminationPasses = boundedInteger(
      readOptionalDescriptorValue('maxTerminationPasses'),
      TERMINATION_MAX_PASSES,
      1,
      1000,
    );
    const terminationPollIntervalMs = boundedInteger(
      readOptionalDescriptorValue('terminationPollIntervalMs'),
      TERMINATION_POLL_INTERVAL_MS,
      0,
      1000,
    );

    if (overallDeadlineMs === null
      || terminalGraceMs === null
      || sampleIntervalMs === null
      || maxTerminationPasses === null
      || terminationPollIntervalMs === null) {
      return null;
    }

    return {
      overallDeadlineMs,
      terminalGraceMs,
      sampleIntervalMs,
      maxTerminationPasses,
      terminationPollIntervalMs,
    };
  } catch {
    return null;
  }
}

function captureChildEventMethods(child) {
  try {
    const seen = new Set();
    let current = child;
    let on = null;
    let removeListener = null;

    for (let depth = 0; current !== null; depth += 1) {
      if (depth >= MAX_LIFECYCLE_PROTOTYPE_DEPTH
        || (typeof current !== 'object' && typeof current !== 'function')
        || isProxyObject(current)
        || seen.has(current)) {
        return null;
      }

      seen.add(current);

      if (on === null) {
        const descriptor = Object.getOwnPropertyDescriptor(current, 'on');
        if (descriptor !== undefined) {
          if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')
            || !Object.prototype.hasOwnProperty.call(descriptor, 'writable')
            || Object.prototype.hasOwnProperty.call(descriptor, 'get')
            || Object.prototype.hasOwnProperty.call(descriptor, 'set')
            || typeof descriptor.value !== 'function') {
            return null;
          }

          on = descriptor.value;
        }
      }

      if (removeListener === null) {
        const descriptor = Object.getOwnPropertyDescriptor(current, 'removeListener');
        if (descriptor !== undefined) {
          if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')
            || !Object.prototype.hasOwnProperty.call(descriptor, 'writable')
            || Object.prototype.hasOwnProperty.call(descriptor, 'get')
            || Object.prototype.hasOwnProperty.call(descriptor, 'set')
            || typeof descriptor.value !== 'function') {
            return null;
          }

          removeListener = descriptor.value;
        }
      }

      current = Object.getPrototypeOf(current);
    }

    return on !== null && removeListener !== null ? { on, removeListener } : null;
  } catch {
    return null;
  }
}

function normalizeLifecycleInput(input) {
  try {
    if (!isPlainRecord(input)) {
      return null;
    }

    const requiredKeys = [
      'child',
      'rootPid',
      'snapshotOptions',
      'commandOptions',
      'probeTerminalReport',
    ];
    const optionalKeys = [
      'overallDeadlineMs',
      'terminalGraceMs',
      'sampleIntervalMs',
      'maxTerminationPasses',
      'terminationPollIntervalMs',
      'initializeOwnershipImpl',
      'sampleOwnershipImpl',
      'terminateImpl',
      'setTimeoutImpl',
      'clearTimeoutImpl',
    ];
    const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
    const descriptors = new Map();

    const ownKeys = Reflect.ownKeys(input);
    for (const key of ownKeys) {
      if (typeof key !== 'string' || !allowedKeys.has(key)) {
        return null;
      }

      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!isEnumerableDataDescriptor(descriptor)) {
        return null;
      }

      descriptors.set(key, descriptor);
    }

    for (const key of requiredKeys) {
      if (!descriptors.has(key)) {
        return null;
      }
    }

    const child = descriptors.get('child').value;
    const rootPid = descriptors.get('rootPid').value;
    const rawSnapshotOptions = descriptors.get('snapshotOptions').value;
    const rawCommandOptions = descriptors.get('commandOptions').value;
    const probeTerminalReport = descriptors.get('probeTerminalReport').value;
    if (child === undefined
      || rootPid === undefined
      || rawSnapshotOptions === undefined
      || rawCommandOptions === undefined
      || probeTerminalReport === undefined) {
      return null;
    }

    if (!Number.isSafeInteger(rootPid) || rootPid <= 0) {
      return null;
    }

    if (child === input
      || child === null
      || typeof child !== 'object'
      || Array.isArray(child)
      || isProxyObject(child)) {
      return null;
    }

    const childPidDescriptor = Object.getOwnPropertyDescriptor(child, 'pid');
    if (childPidDescriptor === undefined
      || !Object.prototype.hasOwnProperty.call(childPidDescriptor, 'value')
      || !Object.prototype.hasOwnProperty.call(childPidDescriptor, 'writable')
      || Object.prototype.hasOwnProperty.call(childPidDescriptor, 'get')
      || Object.prototype.hasOwnProperty.call(childPidDescriptor, 'set')
      || childPidDescriptor.value !== rootPid) {
      return null;
    }

    const childMethods = captureChildEventMethods(child);
    if (childMethods === null) {
      return null;
    }

    const snapshotOptions = normalizeProcessOptions(rawSnapshotOptions);
    const commandOptions = normalizeProcessOptions(rawCommandOptions);
    if (snapshotOptions === null || commandOptions === null || typeof probeTerminalReport !== 'function') {
      return null;
    }

    const bounds = normalizeLifecycleBounds(descriptors);
    if (bounds === null) {
      return null;
    }

    const readDependency = (key, readDefault) => {
      const descriptor = descriptors.get(key);
      const value = descriptor === undefined ? undefined : descriptor.value;
      if (value === undefined) {
        const defaultValue = readDefault();
        return typeof defaultValue === 'function' ? defaultValue : null;
      }

      return typeof value === 'function' ? value : null;
    };
    const initializeOwnershipImpl = readDependency(
      'initializeOwnershipImpl',
      () => initializeSpawnedProcessOwnership,
    );
    const sampleOwnershipImpl = readDependency(
      'sampleOwnershipImpl',
      () => sampleSpawnedProcessOwnership,
    );
    const terminateImpl = readDependency('terminateImpl', () => terminateCapturedProcessTree);
    const setTimeoutImpl = readDependency('setTimeoutImpl', () => globalThis.setTimeout);
    const clearTimeoutImpl = readDependency('clearTimeoutImpl', () => globalThis.clearTimeout);
    if (initializeOwnershipImpl === null
      || sampleOwnershipImpl === null
      || terminateImpl === null
      || setTimeoutImpl === null
      || clearTimeoutImpl === null) {
      return null;
    }

    return {
      child,
      rootPid,
      snapshotOptions,
      commandOptions,
      probeTerminalReport,
      overallDeadlineMs: bounds.overallDeadlineMs,
      terminalGraceMs: bounds.terminalGraceMs,
      sampleIntervalMs: bounds.sampleIntervalMs,
      maxTerminationPasses: bounds.maxTerminationPasses,
      terminationPollIntervalMs: bounds.terminationPollIntervalMs,
      initializeOwnershipImpl,
      sampleOwnershipImpl,
      terminateImpl,
      setTimeoutImpl,
      clearTimeoutImpl,
      on: childMethods.on,
      removeListener: childMethods.removeListener,
    };
  } catch {
    return null;
  }
}

function normalizeChildExit(code, signal) {
  try {
    if (code !== null && !Number.isSafeInteger(code)) {
      return null;
    }

    if (signal !== null
      && (typeof signal !== 'string'
        || signal.length === 0
        || signal.length > 128
        || signal.trim() !== signal
        || /[\u0000-\u001F\u007F-\u009F]/u.test(signal))) {
      return null;
    }

    if (code === null && signal === null) {
      return null;
    }

    return { code, signal };
  } catch {
    return null;
  }
}

function cloneChildExit(value) {
  try {
    if (!isPlainRecord(value) || !hasExactOrderedDataKeys(value, ['code', 'signal'])) {
      return null;
    }

    const codeDescriptor = Object.getOwnPropertyDescriptor(value, 'code');
    const signalDescriptor = Object.getOwnPropertyDescriptor(value, 'signal');
    if (!isEnumerableDataDescriptor(codeDescriptor) || !isEnumerableDataDescriptor(signalDescriptor)) {
      return null;
    }

    return normalizeChildExit(codeDescriptor.value, signalDescriptor.value);
  } catch {
    return null;
  }
}

function createLifecycleTriggerGate() {
  let settledRecord = null;
  let resolveFirstSettlement;
  const firstSettlementPromise = new Promise((resolve) => {
    resolveFirstSettlement = resolve;
  });

  const read = () => {
    if (settledRecord === null) {
      return null;
    }

    return {
      trigger: settledRecord.trigger,
      childExit: settledRecord.childExit === null
        ? null
        : {
          code: settledRecord.childExit.code,
          signal: settledRecord.childExit.signal,
        },
    };
  };

  const settle = (trigger, childExit) => {
    if (settledRecord !== null) {
      return false;
    }

    let normalizedChildExit;
    switch (trigger) {
      case 'child-close':
        normalizedChildExit = cloneChildExit(childExit);
        if (normalizedChildExit === null) {
          return false;
        }
        break;
      case 'child-error':
      case 'terminal-report-grace-expired':
      case 'outer-deadline':
        if (childExit !== null) {
          return false;
        }
        normalizedChildExit = null;
        break;
      default:
        return false;
    }

    settledRecord = {
      trigger,
      childExit: normalizedChildExit,
    };
    resolveFirstSettlement(read());
    return true;
  };

  return {
    promise: firstSettlementPromise,
    settle,
    read,
  };
}

function createLifecycleControl(normalized) {
  const gate = createLifecycleTriggerGate();
  const child = normalized.child;
  const on = normalized.on;
  const removeListener = normalized.removeListener;
  const setTimeoutImpl = normalized.setTimeoutImpl;
  const clearTimeoutImpl = normalized.clearTimeoutImpl;
  const overallDeadlineMs = normalized.overallDeadlineMs;
  const terminalGraceMs = normalized.terminalGraceMs;
  const sampleIntervalMs = normalized.sampleIntervalMs;

  let childInteractionFailed = false;
  let timerFailed = false;
  let stopped = false;
  let cleanedUp = false;
  let terminalGraceArmed = false;
  let pendingSampleDelay = null;

  const outerTimer = {
    active: false,
    handle: undefined,
  };
  const terminalGraceTimer = {
    active: false,
    handle: undefined,
  };

  let closeListenerAttempted = false;
  let errorListenerAttempted = false;

  const settleOuterDeadlineAfterTimerFailure = () => {
    timerFailed = true;
    gate.settle('outer-deadline', null);
  };

  const settleChildErrorAfterInteractionFailure = () => {
    childInteractionFailed = true;
    gate.settle('child-error', null);
  };

  const clearTimer = (timer) => {
    if (!timer.active) {
      return;
    }

    const handle = timer.handle;
    timer.active = false;
    timer.handle = undefined;
    try {
      Reflect.apply(clearTimeoutImpl, undefined, [handle]);
    } catch {
      settleOuterDeadlineAfterTimerFailure();
    }
  };

  const closeListener = (code, signal) => {
    if (stopped || cleanedUp) {
      return;
    }

    const childExit = normalizeChildExit(code, signal);
    if (childExit === null) {
      gate.settle('child-error', null);
      return;
    }

    gate.settle('child-close', {
      code: childExit.code,
      signal: childExit.signal,
    });
  };

  const errorListener = () => {
    if (stopped || cleanedUp) {
      return;
    }

    gate.settle('child-error', null);
  };

  closeListenerAttempted = true;
  try {
    Reflect.apply(on, child, ['close', closeListener]);
  } catch {
    settleChildErrorAfterInteractionFailure();
  }

  errorListenerAttempted = true;
  try {
    Reflect.apply(on, child, ['error', errorListener]);
  } catch {
    settleChildErrorAfterInteractionFailure();
  }

  const outerDeadlineCallback = () => {
    outerTimer.active = false;
    outerTimer.handle = undefined;
    if (stopped || cleanedUp) {
      return;
    }

    gate.settle('outer-deadline', null);
  };

  try {
    const handle = Reflect.apply(setTimeoutImpl, undefined, [outerDeadlineCallback, overallDeadlineMs]);
    outerTimer.handle = handle;
    outerTimer.active = true;
  } catch {
    settleOuterDeadlineAfterTimerFailure();
  }

  const settleSampleDelay = (delay, outcome, clearHandle) => {
    if (delay.settled) {
      return;
    }

    delay.settled = true;
    if (pendingSampleDelay === delay) {
      pendingSampleDelay = null;
    }

    if (clearHandle) {
      clearTimer(delay.timer);
    } else {
      delay.timer.active = false;
      delay.timer.handle = undefined;
    }

    delay.resolve(outcome);
  };

  const armTerminalGrace = () => {
    if (terminalGraceArmed || stopped || cleanedUp || gate.read() !== null) {
      return;
    }

    terminalGraceArmed = true;
    const terminalGraceCallback = () => {
      terminalGraceTimer.active = false;
      terminalGraceTimer.handle = undefined;
      if (stopped || cleanedUp) {
        return;
      }

      gate.settle('terminal-report-grace-expired', null);
    };

    try {
      const handle = Reflect.apply(setTimeoutImpl, undefined, [terminalGraceCallback, terminalGraceMs]);
      terminalGraceTimer.handle = handle;
      terminalGraceTimer.active = true;
    } catch {
      settleOuterDeadlineAfterTimerFailure();
    }
  };

  const waitForSampleDelay = () => {
    if (pendingSampleDelay !== null) {
      return pendingSampleDelay.promise;
    }

    if (stopped || cleanedUp || gate.read() !== null) {
      return Promise.resolve('triggered');
    }

    const delay = {
      promise: null,
      resolve: null,
      settled: false,
      timer: {
        active: false,
        handle: undefined,
      },
    };
    delay.promise = new Promise((resolve) => {
      delay.resolve = resolve;
    });
    pendingSampleDelay = delay;

    gate.promise.then(() => {
      if (pendingSampleDelay !== delay || delay.settled) {
        return;
      }

      settleSampleDelay(delay, 'triggered', true);
    });

    const sampleDelayCallback = () => {
      if (pendingSampleDelay !== delay || delay.settled || stopped || cleanedUp) {
        return;
      }

      settleSampleDelay(delay, 'elapsed', false);
    };

    try {
      const handle = Reflect.apply(setTimeoutImpl, undefined, [sampleDelayCallback, sampleIntervalMs]);
      if (!delay.settled && pendingSampleDelay === delay) {
        delay.timer.handle = handle;
        delay.timer.active = true;
      }
    } catch {
      settleOuterDeadlineAfterTimerFailure();
      settleSampleDelay(delay, 'triggered', false);
    }

    return delay.promise;
  };

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    const delay = pendingSampleDelay;
    if (delay !== null) {
      settleSampleDelay(delay, 'triggered', true);
    }
  };

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    const delay = pendingSampleDelay;
    stop();
    clearTimer(outerTimer);
    clearTimer(terminalGraceTimer);
    if (delay !== null) {
      clearTimer(delay.timer);
    }

    if (closeListenerAttempted) {
      try {
        Reflect.apply(removeListener, child, ['close', closeListener]);
      } catch {
        childInteractionFailed = true;
      }
    }

    if (errorListenerAttempted) {
      try {
        Reflect.apply(removeListener, child, ['error', errorListener]);
      } catch {
        childInteractionFailed = true;
      }
    }
  };

  const readFailures = () => Object.freeze({
    childInteractionFailed,
    timerFailed,
  });

  const triggerPromise = gate.promise;
  const readTrigger = gate.read;
  return Object.freeze({
    triggerPromise,
    readTrigger,
    promise: triggerPromise,
    read: readTrigger,
    armTerminalGrace,
    waitForSampleDelay,
    stop,
    cleanup,
    readFailures,
  });
}

async function monitorLifecycleOwnership(normalized, control) {
  let ownershipComplete = true;
  let rootIdentity = null;
  let captured = [];
  let reusedPids = [];
  const reusedPidSet = new Set();

  const cloneFacts = () => ({
    ownershipComplete,
    rootIdentity: cloneIdentity(rootIdentity),
    captured: cloneIdentityArray(captured),
    reusedPids: clonePidArray(reusedPids),
  });

  const unionReusedPids = (validated) => {
    const validatedReusedPids = clonePidArray(validated.reusedPids);
    for (const pid of validatedReusedPids) {
      if (!reusedPidSet.has(pid)) {
        reusedPidSet.add(pid);
        reusedPids.push(pid);
      }
    }
  };

  while (true) {
    if (rootIdentity === null) {
      try {
        const raw = await Reflect.apply(normalized.initializeOwnershipImpl, undefined, [{
          rootPid: normalized.rootPid,
          snapshotOptions: { ...normalized.snapshotOptions },
        }]);
        const validated = readInitialOwnershipEnvelope(raw, normalized.rootPid);
        if (validated === null) {
          ownershipComplete = false;
        } else {
          rootIdentity = cloneIdentity(validated.rootIdentity);
          captured = cloneIdentityArray(validated.captured);
          unionReusedPids(validated);
        }
      } catch {
        ownershipComplete = false;
      }
    } else {
      try {
        const sampleRootIdentity = cloneIdentity(rootIdentity);
        const samplePreviousCaptured = cloneIdentityArray(captured);
        const raw = await Reflect.apply(normalized.sampleOwnershipImpl, undefined, [{
          rootIdentity: sampleRootIdentity,
          previousCaptured: samplePreviousCaptured,
          snapshotOptions: { ...normalized.snapshotOptions },
        }]);
        const validated = readSampleOwnershipEnvelope(raw, rootIdentity, captured);
        if (validated === null) {
          ownershipComplete = false;
        } else {
          rootIdentity = cloneIdentity(validated.rootIdentity);
          captured = cloneIdentityArray(validated.captured);
          unionReusedPids(validated);
        }
      } catch {
        ownershipComplete = false;
      }
    }

    let probeResult = false;
    try {
      probeResult = Reflect.apply(normalized.probeTerminalReport, undefined, []);
    } catch {
      probeResult = false;
    }

    if (probeResult === true) {
      try {
        Reflect.apply(control.armTerminalGrace, undefined, []);
      } catch {
        ownershipComplete = false;
        return cloneFacts();
      }
    }

    try {
      if (control.readTrigger() !== null) {
        return cloneFacts();
      }

      const delayOutcome = await control.waitForSampleDelay();
      if (delayOutcome === 'triggered') {
        return cloneFacts();
      }

      if (control.readTrigger() !== null) {
        return cloneFacts();
      }

      if (delayOutcome !== 'elapsed') {
        ownershipComplete = false;
        return cloneFacts();
      }
    } catch {
      ownershipComplete = false;
      return cloneFacts();
    }
  }
}

async function terminateLifecycleOwnership(normalized, ownershipFacts) {
  let rootIdentity = null;
  let captured = [];
  let reusedPids = [];

  const failureProjection = () => ({
    termination: null,
    captured: cloneIdentityArray(captured),
    reusedPids: clonePidArray(reusedPids),
  });

  const ownershipRecord = isPlainRecord(ownershipFacts) ? ownershipFacts : null;
  const rootDescriptor = ownershipRecord === null
    ? null
    : Object.getOwnPropertyDescriptor(ownershipRecord, 'rootIdentity');
  const capturedDescriptor = ownershipRecord === null
    ? null
    : Object.getOwnPropertyDescriptor(ownershipRecord, 'captured');
  const reusedPidsDescriptor = ownershipRecord === null
    ? null
    : Object.getOwnPropertyDescriptor(ownershipRecord, 'reusedPids');

  const rawRootIdentity = isEnumerableDataDescriptor(rootDescriptor)
    ? rootDescriptor.value
    : null;
  const validatedRootIdentity = rawRootIdentity === null
    ? null
    : readExactIdentity(rawRootIdentity);
  const validatedCaptured = isEnumerableDataDescriptor(capturedDescriptor)
    ? readDenseIdentityArray(capturedDescriptor.value)
    : null;
  const validatedReusedPids = isEnumerableDataDescriptor(reusedPidsDescriptor)
    ? readDensePidArray(reusedPidsDescriptor.value)
    : null;

  rootIdentity = validatedRootIdentity === null ? null : cloneIdentity(validatedRootIdentity);
  captured = validatedCaptured === null ? [] : cloneIdentityArray(validatedCaptured);

  const capturedPids = new Set(captured.map((identity) => identity.pid));
  reusedPids = validatedReusedPids === null
    ? []
    : validatedReusedPids.filter((pid) => capturedPids.has(pid));
  reusedPids = clonePidArray(reusedPids);

  const rootContained = rootIdentity !== null
    && captured.some((identity) => (
      identity.pid === rootIdentity.pid
      && identity.creationToken === rootIdentity.creationToken
    ));
  if (rootIdentity === null || captured.length === 0 || !rootContained) {
    return failureProjection();
  }

  let terminateImpl;
  let snapshotOptions;
  let commandOptions;
  let maxPasses;
  let pollIntervalMs;
  try {
    if (!isPlainRecord(normalized)) {
      return failureProjection();
    }

    terminateImpl = normalized.terminateImpl;
    snapshotOptions = normalizeProcessOptions(normalized.snapshotOptions);
    commandOptions = normalizeProcessOptions(normalized.commandOptions);
    maxPasses = normalized.maxTerminationPasses;
    pollIntervalMs = normalized.terminationPollIntervalMs;
  } catch {
    return failureProjection();
  }

  if (typeof terminateImpl !== 'function'
    || snapshotOptions === null
    || commandOptions === null
    || !Number.isSafeInteger(maxPasses)
    || maxPasses < 1
    || maxPasses > 1000
    || !Number.isSafeInteger(pollIntervalMs)
    || pollIntervalMs < 0
    || pollIntervalMs > 1000) {
    return failureProjection();
  }

  const validationRootIdentity = cloneIdentity(rootIdentity);
  const validationPreviousCaptured = cloneIdentityArray(captured);
  const terminationInput = {
    rootIdentity: cloneIdentity(rootIdentity),
    previousCaptured: cloneIdentityArray(captured),
    snapshotOptions,
    commandOptions,
    maxPasses,
    pollIntervalMs,
  };

  let raw;
  try {
    raw = await Reflect.apply(terminateImpl, undefined, [terminationInput]);
  } catch {
    return failureProjection();
  }

  try {
    const validatedTermination = readTerminationEnvelope(
      raw,
      validationRootIdentity,
      validationPreviousCaptured,
    );
    if (validatedTermination === null) {
      return failureProjection();
    }

    const projectedReusedPids = clonePidArray(reusedPids);
    const projectedReusedPidSet = new Set(projectedReusedPids);
    for (const pid of validatedTermination.reusedPids) {
      if (!projectedReusedPidSet.has(pid)) {
        projectedReusedPidSet.add(pid);
        projectedReusedPids.push(pid);
      }
    }

    return {
      termination: cloneTermination(validatedTermination),
      captured: cloneIdentityArray(validatedTermination.captured),
      reusedPids: clonePidArray(projectedReusedPids),
    };
  } catch {
    return failureProjection();
  }
}

function cloneTermination(value) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  return {
    complete: value.complete,
    errors: value.errors.map((error) => error),
    treeGone: value.treeGone,
    passes: value.passes,
    captured: cloneIdentityArray(value.captured),
    commanded: cloneIdentityArray(value.commanded),
    reusedPids: clonePidArray(value.reusedPids),
  };
}

function buildLifecycleResult({
  complete,
  errors,
  trigger,
  childExit,
  ownershipComplete,
  rootIdentity,
  captured,
  reusedPids,
  termination,
}) {
  return {
    complete,
    errors: errors.map((error) => error),
    trigger,
    childExit: cloneChildExit(childExit),
    ownershipComplete,
    rootIdentity: cloneIdentity(rootIdentity),
    captured: cloneIdentityArray(captured),
    reusedPids: clonePidArray(reusedPids),
    termination: cloneTermination(termination),
  };
}

export async function superviseSpawnedE2eProcess(input = {}) {
  const normalized = normalizeLifecycleInput(input);
  if (normalized === null) {
    return buildLifecycleResult({
      complete: false,
      errors: [E2E_LIFECYCLE_INVALID_INPUT],
      trigger: null,
      childExit: null,
      ownershipComplete: false,
      rootIdentity: null,
      captured: [],
      reusedPids: [],
      termination: null,
    });
  }

  let compositionFailed = false;
  let control = null;
  let ownershipFacts = {
    ownershipComplete: false,
    rootIdentity: null,
    captured: [],
    reusedPids: [],
  };

  try {
    control = createLifecycleControl(normalized);
  } catch {
    compositionFailed = true;
  }

  if (control === null) {
    compositionFailed = true;
  } else {
    try {
      const rawOwnershipFacts = await monitorLifecycleOwnership(normalized, control);
      if (!isPlainRecord(rawOwnershipFacts)
        || !hasExactOrderedDataKeys(rawOwnershipFacts, [
          'ownershipComplete',
          'rootIdentity',
          'captured',
          'reusedPids',
        ])) {
        compositionFailed = true;
      } else {
        const ownershipCompleteDescriptor = Object.getOwnPropertyDescriptor(
          rawOwnershipFacts,
          'ownershipComplete',
        );
        const rootIdentityDescriptor = Object.getOwnPropertyDescriptor(rawOwnershipFacts, 'rootIdentity');
        const capturedDescriptor = Object.getOwnPropertyDescriptor(rawOwnershipFacts, 'captured');
        const reusedPidsDescriptor = Object.getOwnPropertyDescriptor(rawOwnershipFacts, 'reusedPids');
        const rawRootIdentity = rootIdentityDescriptor.value;
        const validatedRootIdentity = rawRootIdentity === null
          ? null
          : readExactIdentity(rawRootIdentity);
        const validatedCaptured = readDenseIdentityArray(capturedDescriptor.value);
        const validatedReusedPids = readDensePidArray(reusedPidsDescriptor.value);

        if (!isEnumerableDataDescriptor(ownershipCompleteDescriptor)
          || !isEnumerableDataDescriptor(rootIdentityDescriptor)
          || !isEnumerableDataDescriptor(capturedDescriptor)
          || !isEnumerableDataDescriptor(reusedPidsDescriptor)
          || typeof ownershipCompleteDescriptor.value !== 'boolean'
          || (rawRootIdentity !== null && validatedRootIdentity === null)
          || validatedCaptured === null
          || validatedReusedPids === null) {
          compositionFailed = true;
        } else {
          ownershipFacts = {
            ownershipComplete: ownershipCompleteDescriptor.value,
            rootIdentity: validatedRootIdentity === null ? null : cloneIdentity(validatedRootIdentity),
            captured: cloneIdentityArray(validatedCaptured),
            reusedPids: clonePidArray(validatedReusedPids),
          };
        }
      }
    } catch {
      compositionFailed = true;
    }
  }

  if (control !== null) {
    try {
      control.stop();
    } catch {
      compositionFailed = true;
    }

    try {
      control.cleanup();
    } catch {
      compositionFailed = true;
    }
  }

  let triggerRecord = null;
  let timerFailed = false;
  let childInteractionFailed = false;

  if (control !== null) {
    try {
      const rawTriggerRecord = control.readTrigger();
      if (rawTriggerRecord !== null
        && (!isPlainRecord(rawTriggerRecord)
          || !hasExactOrderedDataKeys(rawTriggerRecord, ['trigger', 'childExit']))) {
        compositionFailed = true;
      } else if (rawTriggerRecord !== null) {
        const triggerDescriptor = Object.getOwnPropertyDescriptor(rawTriggerRecord, 'trigger');
        const childExitDescriptor = Object.getOwnPropertyDescriptor(rawTriggerRecord, 'childExit');
        const triggerValue = triggerDescriptor.value;
        const childExitValue = childExitDescriptor.value;
        const allowedTrigger = triggerValue === 'child-close'
          || triggerValue === 'child-error'
          || triggerValue === 'terminal-report-grace-expired'
          || triggerValue === 'outer-deadline';
        const clonedChildExit = cloneChildExit(childExitValue);
        if (!isEnumerableDataDescriptor(triggerDescriptor)
          || !isEnumerableDataDescriptor(childExitDescriptor)
          || !allowedTrigger
          || (triggerValue === 'child-close' && clonedChildExit === null)
          || (triggerValue !== 'child-close' && childExitValue !== null)) {
          compositionFailed = true;
        } else {
          triggerRecord = {
            trigger: triggerValue,
            childExit: clonedChildExit,
          };
        }
      }
    } catch {
      compositionFailed = true;
    }

    try {
      const rawFailures = control.readFailures();
      if (!isPlainRecord(rawFailures)
        || !hasExactOrderedDataKeys(rawFailures, ['childInteractionFailed', 'timerFailed'])) {
        compositionFailed = true;
      } else {
        const childInteractionFailedDescriptor = Object.getOwnPropertyDescriptor(
          rawFailures,
          'childInteractionFailed',
        );
        const timerFailedDescriptor = Object.getOwnPropertyDescriptor(rawFailures, 'timerFailed');
        if (!isEnumerableDataDescriptor(childInteractionFailedDescriptor)
          || !isEnumerableDataDescriptor(timerFailedDescriptor)
          || typeof childInteractionFailedDescriptor.value !== 'boolean'
          || typeof timerFailedDescriptor.value !== 'boolean') {
          compositionFailed = true;
        } else {
          childInteractionFailed = childInteractionFailedDescriptor.value;
          timerFailed = timerFailedDescriptor.value;
        }
      }
    } catch {
      compositionFailed = true;
    }
  } else {
    compositionFailed = true;
  }

  let teardown = {
    termination: null,
    captured: [],
    reusedPids: [],
  };
  try {
    const rawTeardown = await terminateLifecycleOwnership(normalized, ownershipFacts);
    if (!isPlainRecord(rawTeardown)
      || !hasExactOrderedDataKeys(rawTeardown, ['termination', 'captured', 'reusedPids'])) {
      compositionFailed = true;
    } else {
      const terminationDescriptor = Object.getOwnPropertyDescriptor(rawTeardown, 'termination');
      const capturedDescriptor = Object.getOwnPropertyDescriptor(rawTeardown, 'captured');
      const reusedPidsDescriptor = Object.getOwnPropertyDescriptor(rawTeardown, 'reusedPids');
      const validatedCaptured = readDenseIdentityArray(capturedDescriptor.value);
      const validatedReusedPids = readDensePidArray(reusedPidsDescriptor.value);
      if (!isEnumerableDataDescriptor(terminationDescriptor)
        || !isEnumerableDataDescriptor(capturedDescriptor)
        || !isEnumerableDataDescriptor(reusedPidsDescriptor)
        || (terminationDescriptor.value !== null && !isPlainRecord(terminationDescriptor.value))
        || validatedCaptured === null
        || validatedReusedPids === null) {
        compositionFailed = true;
      } else {
        teardown = {
          termination: terminationDescriptor.value === null
            ? null
            : cloneTermination(terminationDescriptor.value),
          captured: cloneIdentityArray(validatedCaptured),
          reusedPids: clonePidArray(validatedReusedPids),
        };
      }
    }
  } catch {
    compositionFailed = true;
  }

  const trigger = triggerRecord === null ? null : triggerRecord.trigger;
  const childExit = triggerRecord === null ? null : cloneChildExit(triggerRecord.childExit);
  const ownershipComplete = ownershipFacts.ownershipComplete === true;
  const terminationComplete = teardown.termination !== null
    && teardown.termination.complete === true
    && teardown.termination.treeGone === true;
  const complete = triggerRecord !== null
    && compositionFailed === false
    && trigger !== 'child-error'
    && timerFailed === false
    && childInteractionFailed === false
    && ownershipComplete
    && terminationComplete;

  let error;
  if (timerFailed) {
    error = E2E_LIFECYCLE_TIMER_FAILED;
  } else if (compositionFailed
    || triggerRecord === null
    || trigger === 'child-error'
    || childInteractionFailed) {
    error = E2E_LIFECYCLE_CHILD_ERROR;
  } else if (ownershipComplete === false) {
    error = E2E_LIFECYCLE_OWNERSHIP_INCOMPLETE;
  } else if (!terminationComplete) {
    error = E2E_LIFECYCLE_TERMINATION_FAILED;
  }

  return buildLifecycleResult({
    complete,
    errors: complete ? [] : [error],
    trigger,
    childExit,
    ownershipComplete,
    rootIdentity: ownershipFacts.rootIdentity,
    captured: teardown.captured,
    reusedPids: teardown.reusedPids,
    termination: teardown.termination,
  });
}
