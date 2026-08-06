import { prepareStableCapturedProcessTerminationStep } from './e2e-process-termination-step.mjs';
import { invokeExactWindowsTaskkill } from './e2e-process-termination-command.mjs';
import { types as utilTypes } from 'node:util';

const REQUIRED_KEYS = ['rootIdentity', 'previousCaptured', 'snapshotOptions', 'commandOptions'];
const OPTIONAL_KEYS = ['maxPasses', 'pollIntervalMs'];
const ALLOWED_KEYS = new Set([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
const OPTION_KEYS = new Set(['platform', 'execFileImpl', 'timeoutMs']);
const RECHECK_KEYS = ['complete', 'errors', 'rootPresent', 'treeGone', 'replanRequired', 'captured', 'newlyCaptured', 'target', 'reusedPids'];
const MAX_DENSE_IDENTITY_ARRAY_LENGTH = 100000;

function cloneIdentity(identity) {
  return { pid: identity.pid, creationToken: identity.creationToken };
}

function buildResult(complete, errors, treeGone, passes, captured, commanded, reusedPids) {
  return {
    complete,
    errors: [...errors],
    treeGone,
    passes,
    captured: captured.map(cloneIdentity),
    commanded: commanded.map(cloneIdentity),
    reusedPids: [...reusedPids].sort((left, right) => left - right),
  };
}

function invalidResult() {
  return buildResult(false, ['termination-executor-invalid-input'], false, 0, [], [], new Set());
}

function recheckFailureResult(pass, captured, commanded, reusedPids) {
  return buildResult(false, ['termination-executor-recheck-failed'], false, pass, captured, commanded, reusedPids);
}

function commandFailureResult(errors, pass, captured, commanded, reusedPids) {
  return buildResult(false, errors, false, pass, captured, commanded, reusedPids);
}

function awaitPollInterval(pollIntervalMs) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (success) => {
      if (settled) return;
      settled = true;
      resolve(success);
    };

    try {
      setTimeout(() => {
        try {
          settle(true);
        } catch {
          try {
            settle(false);
          } catch {
          }
        }
      }, pollIntervalMs);
    } catch {
      try {
        settle(false);
      } catch {
      }
    }
  });
}

function identityKey(identity) {
  return `${identity.pid}\u0000${identity.creationToken}`;
}

function cloneIdentityArray(value) {
  const identities = readDenseIdentityArray(value);
  if (identities === null) {
    throw new Error('termination-executor-invalid-identities');
  }
  return identities.map(cloneIdentity);
}

function clonePidArray(value) {
  const pids = readDensePidArray(value);
  if (pids === null) {
    throw new Error('termination-executor-invalid-pids');
  }
  return [...pids];
}

function isPlainObject(value) {
  try {
    return value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !isProxyObject(value)
      && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  } catch {
    return false;
  }
}

function isEnumerableDataDescriptor(descriptor) {
  return descriptor !== undefined
    && descriptor.enumerable === true
    && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    && !Object.prototype.hasOwnProperty.call(descriptor, 'get')
    && !Object.prototype.hasOwnProperty.call(descriptor, 'set');
}

function isProxyObject(value) {
  try {
    return utilTypes.isProxy(value) === true;
  } catch {
    return true;
  }
}

function readExactIdentity(value) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || isProxyObject(value)) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== 2 || ownKeys[0] !== 'pid' || ownKeys[1] !== 'creationToken') return null;
    const pidDescriptor = Object.getOwnPropertyDescriptor(value, 'pid');
    const creationTokenDescriptor = Object.getOwnPropertyDescriptor(value, 'creationToken');
    if (!isEnumerableDataDescriptor(pidDescriptor) || !isEnumerableDataDescriptor(creationTokenDescriptor)) return null;
    const pid = pidDescriptor.value;
    const creationToken = creationTokenDescriptor.value;
    if (!Number.isSafeInteger(pid) || pid <= 0 || typeof creationToken !== 'string' || creationToken.trim().length === 0 || creationToken.trim() !== creationToken || creationToken.length > 128 || /[\u0000-\u001F\u007F]/u.test(creationToken)) return null;
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
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_DENSE_IDENTITY_ARRAY_LENGTH) return null;
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
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_DENSE_IDENTITY_ARRAY_LENGTH) return null;
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

function readExactCommandErrors(value) {
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
    if (length !== 0 && length !== 1) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (length === 0) {
      return ownKeys.length === 1 && ownKeys[0] === 'length' ? [] : null;
    }
    if (ownKeys.length !== 2 || ownKeys[0] !== '0' || ownKeys[1] !== 'length') return null;
    const errorDescriptor = Object.getOwnPropertyDescriptor(value, '0');
    if (!isEnumerableDataDescriptor(errorDescriptor)) return null;
    const error = errorDescriptor.value;
    if (typeof error !== 'string'
      || error.length === 0
      || error.length > 128
      || error.trim() !== error
      || /[\u0000-\u001F\u007F-\u009F]/u.test(error)) return null;
    return [error];
  } catch {
    return null;
  }
}

function readExactCommandResult(value, requestedTarget) {
  try {
    const requested = readExactIdentity(requestedTarget);
    if (requested === null
      || value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || isProxyObject(value)) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== 4
      || ownKeys[0] !== 'complete'
      || ownKeys[1] !== 'errors'
      || ownKeys[2] !== 'attempted'
      || ownKeys[3] !== 'target') return null;
    const completeDescriptor = Object.getOwnPropertyDescriptor(value, 'complete');
    const errorsDescriptor = Object.getOwnPropertyDescriptor(value, 'errors');
    const attemptedDescriptor = Object.getOwnPropertyDescriptor(value, 'attempted');
    const targetDescriptor = Object.getOwnPropertyDescriptor(value, 'target');
    if (!isEnumerableDataDescriptor(completeDescriptor)
      || !isEnumerableDataDescriptor(errorsDescriptor)
      || !isEnumerableDataDescriptor(attemptedDescriptor)
      || !isEnumerableDataDescriptor(targetDescriptor)) return null;
    const complete = completeDescriptor.value;
    const errors = readExactCommandErrors(errorsDescriptor.value);
    const attempted = attemptedDescriptor.value;
    const target = readExactIdentity(targetDescriptor.value);
    if ((complete !== true && complete !== false)
      || errors === null
      || typeof attempted !== 'boolean'
      || target === null
      || target.pid !== requested.pid
      || target.creationToken !== requested.creationToken) return null;
    if (complete === true && (errors.length !== 0 || attempted !== true)) return null;
    if (complete === false && errors.length !== 1) return null;
    return { complete, errors, attempted, target };
  } catch {
    return null;
  }
}

function readRecheckEnvelope(value) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || isProxyObject(value)) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== RECHECK_KEYS.length) return null;
    const descriptors = [];
    for (let index = 0; index < RECHECK_KEYS.length; index += 1) {
      const key = RECHECK_KEYS[index];
      if (ownKeys[index] !== key) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      descriptors.push(descriptor);
    }

    const complete = descriptors[0].value;
    const errors = descriptors[1].value;
    const rootPresent = descriptors[2].value;
    const treeGone = descriptors[3].value;
    const replanRequired = descriptors[4].value;
    const captured = readDenseIdentityArray(descriptors[5].value);
    const newlyCaptured = readDenseIdentityArray(descriptors[6].value);
    const target = descriptors[7].value;
    const reusedPids = readDensePidArray(descriptors[8].value);
    const clonedTarget = target === null ? null : readExactIdentity(target);
    if (complete !== true
      || !isOrdinaryEmptyArray(errors)
      || typeof rootPresent !== 'boolean'
      || typeof treeGone !== 'boolean'
      || typeof replanRequired !== 'boolean'
      || captured === null
      || newlyCaptured === null
      || reusedPids === null
      || (target !== null && clonedTarget === null)) return null;
    if (captured.length === 0) return null;
    const capturedCreationTokens = new Map(captured.map((identity) => [identity.pid, identity.creationToken]));
    if (!newlyCaptured.every((identity) => capturedCreationTokens.get(identity.pid) === identity.creationToken)
      || (clonedTarget !== null && capturedCreationTokens.get(clonedTarget.pid) !== clonedTarget.creationToken)) return null;
    if (treeGone === true) {
      if (replanRequired !== false || target !== null) return null;
    } else if (!((replanRequired === true && target === null) || (replanRequired === false && target !== null))) {
      return null;
    }

    return {
      complete,
      errors,
      rootPresent,
      treeGone,
      replanRequired,
      captured,
      newlyCaptured,
      target: clonedTarget,
      reusedPids,
    };
  } catch {
    return null;
  }
}

function readMonotonicRecheck(value, previousCaptured) {
  const recheck = readRecheckEnvelope(value);
  if (recheck === null) return null;

  try {
    const captured = cloneIdentityArray(recheck.captured);
    const reusedPids = clonePidArray(recheck.reusedPids);
    const capturedTokensByPid = new Map(captured.map((identity) => [identity.pid, identity.creationToken]));
    for (const identity of previousCaptured) {
      if (capturedTokensByPid.get(identity.pid) !== identity.creationToken) {
        return null;
      }
    }
    return { recheck, captured, reusedPids };
  } catch {
    return null;
  }
}

function normalizeOptionRecord(value) {
  try {
    if (!isPlainObject(value) || isProxyObject(value)) return null;

    const descriptors = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !OPTION_KEYS.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      descriptors.push([key, descriptor.value]);
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

function normalizeInput(input) {
  try {
    if (!isPlainObject(input)) return null;

    const descriptors = new Map();
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== 'string' || !ALLOWED_KEYS.has(key) || descriptors.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      descriptors.set(key, descriptor);
    }

    for (const key of REQUIRED_KEYS) {
      if (!descriptors.has(key)) return null;
    }

    const rootIdentity = descriptors.get('rootIdentity').value;
    const previousCaptured = descriptors.get('previousCaptured').value;
    const snapshotOptions = normalizeOptionRecord(descriptors.get('snapshotOptions').value);
    const commandOptions = normalizeOptionRecord(descriptors.get('commandOptions').value);
    if (snapshotOptions === null || commandOptions === null) return null;

    const maxPassesDescriptor = descriptors.get('maxPasses');
    const pollIntervalMsDescriptor = descriptors.get('pollIntervalMs');
    const maxPasses = maxPassesDescriptor === undefined || maxPassesDescriptor.value === undefined
      ? 100
      : maxPassesDescriptor.value;
    const pollIntervalMs = pollIntervalMsDescriptor === undefined || pollIntervalMsDescriptor.value === undefined
      ? 25
      : pollIntervalMsDescriptor.value;
    if (!Number.isSafeInteger(maxPasses) || maxPasses < 1 || maxPasses > 1000) return null;
    if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 0 || pollIntervalMs > 1000) return null;

    return {
      rootIdentity,
      previousCaptured,
      snapshotOptions,
      commandOptions,
      maxPasses,
      pollIntervalMs,
    };
  } catch {
    return null;
  }
}

export async function terminateCapturedProcessTree(input = {}) {
  const normalized = normalizeInput(input);
  if (normalized === null) return invalidResult();

  let currentCaptured;
  try {
    currentCaptured = cloneIdentityArray(normalized.previousCaptured);
  } catch {
    currentCaptured = [];
  }

  const commanded = [];
  const commandedKeys = new Set();
  const reusedPids = new Set();

  for (let pass = 1; pass <= normalized.maxPasses; pass += 1) {
    let recheckResult;
    try {
      recheckResult = await prepareStableCapturedProcessTerminationStep({
        rootIdentity: normalized.rootIdentity,
        previousCaptured: currentCaptured,
        snapshotOptions: normalized.snapshotOptions,
      });
    } catch {
      return recheckFailureResult(pass, currentCaptured, commanded, reusedPids);
    }

    const validatedRecheck = readMonotonicRecheck(recheckResult, currentCaptured);
    if (validatedRecheck === null) {
      return recheckFailureResult(pass, currentCaptured, commanded, reusedPids);
    }
    const { recheck, captured: nextCaptured, reusedPids: nextReusedPids } = validatedRecheck;

    currentCaptured = nextCaptured;
    for (const pid of nextReusedPids) {
      reusedPids.add(pid);
    }

    if (recheck.treeGone === true) {
      return buildResult(true, [], true, pass, currentCaptured, commanded, reusedPids);
    }

    if (recheck.replanRequired === true) {
      if (pass < normalized.maxPasses && !(await awaitPollInterval(normalized.pollIntervalMs))) {
        return commandFailureResult(['termination-executor-poll-failed'], pass, currentCaptured, commanded, reusedPids);
      }
      continue;
    }

    const clonedTarget = readExactIdentity(recheck.target);
    if (clonedTarget === null) {
      return recheckFailureResult(pass, currentCaptured, commanded, reusedPids);
    }

    const targetKey = identityKey(clonedTarget);
    if (commandedKeys.has(targetKey)) {
      if (pass < normalized.maxPasses && !(await awaitPollInterval(normalized.pollIntervalMs))) {
        return commandFailureResult(['termination-executor-poll-failed'], pass, currentCaptured, commanded, reusedPids);
      }
      continue;
    }

    let commandResult;
    try {
      commandResult = await invokeExactWindowsTaskkill({
        target: clonedTarget,
        ...normalized.commandOptions,
      });
    } catch {
      return commandFailureResult(['termination-executor-command-failed'], pass, currentCaptured, commanded, reusedPids);
    }

    const command = readExactCommandResult(commandResult, clonedTarget);
    if (command === null) {
      return commandFailureResult(['termination-executor-command-failed'], pass, currentCaptured, commanded, reusedPids);
    }
    if (command.complete === false) {
      if (command.attempted !== true) {
        return commandFailureResult(command.errors, pass, currentCaptured, commanded, reusedPids);
      }

      let recoveryRecheckResult;
      try {
        recoveryRecheckResult = await prepareStableCapturedProcessTerminationStep({
          rootIdentity: normalized.rootIdentity,
          previousCaptured: currentCaptured,
          snapshotOptions: normalized.snapshotOptions,
        });
      } catch {
        return commandFailureResult(command.errors, pass, currentCaptured, commanded, reusedPids);
      }

      const recovery = readMonotonicRecheck(recoveryRecheckResult, currentCaptured);
      if (recovery === null) {
        return commandFailureResult(command.errors, pass, currentCaptured, commanded, reusedPids);
      }

      currentCaptured = recovery.captured;
      for (const pid of recovery.reusedPids) {
        reusedPids.add(pid);
      }
      if (recovery.recheck.treeGone === true && recovery.recheck.replanRequired === false) {
        return buildResult(true, [], true, pass, currentCaptured, commanded, reusedPids);
      }
      return commandFailureResult(command.errors, pass, currentCaptured, commanded, reusedPids);
    }

    const commandedTarget = readExactIdentity(command.target);
    if (commandedTarget === null) {
      return commandFailureResult(['termination-executor-command-failed'], pass, currentCaptured, commanded, reusedPids);
    }
    commanded.push(commandedTarget);
    commandedKeys.add(identityKey(commandedTarget));
    if (pass < normalized.maxPasses && !(await awaitPollInterval(normalized.pollIntervalMs))) {
      return commandFailureResult(['termination-executor-poll-failed'], pass, currentCaptured, commanded, reusedPids);
    }
  }

  return buildResult(false, ['termination-executor-pass-limit'], false, normalized.maxPasses, currentCaptured, commanded, reusedPids);
}
