import { captureProcessTableSnapshot } from './e2e-process-table-adapter.mjs';
import { prepareCapturedProcessTermination } from './e2e-process-termination-contract.mjs';

const MAX_PLAN_IDENTITIES = 100000;
const MAX_CREATION_TOKEN_LENGTH = 128;

function makeFailure() {
  return {
    complete: false,
    errors: ['termination-recheck-invalid-input'],
    rootPresent: false,
    treeGone: false,
    replanRequired: false,
    captured: [],
    newlyCaptured: [],
    target: null,
    reusedPids: []
  };
}

function makeStepFailure(code) {
  return {
    complete: false,
    errors: [code],
    rootPresent: false,
    treeGone: false,
    replanRequired: false,
    captured: [],
    newlyCaptured: [],
    target: null,
    reusedPids: []
  };
}

function hasExactOwnDataProperties(value, expectedKeys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== expectedKeys.length) return false;
  for (let index = 0; index < expectedKeys.length; index += 1) {
    if (ownKeys[index] !== expectedKeys[index]) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, expectedKeys[index]);
    if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
  }
  return true;
}

function readIdentity(record) {
  if (!hasExactOwnDataProperties(record, ['pid', 'creationToken'])) return null;
  const pid = Object.getOwnPropertyDescriptor(record, 'pid').value;
  const creationToken = Object.getOwnPropertyDescriptor(record, 'creationToken').value;
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  if (typeof creationToken !== 'string' || creationToken.length < 1 || creationToken.length > MAX_CREATION_TOKEN_LENGTH || creationToken.trim() !== creationToken || /[\u0000-\u001F\u007F]/u.test(creationToken)) return null;
  return { pid, creationToken };
}

function readIdentityArray(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (!lengthDescriptor || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'get') || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'set')) return null;
    const length = lengthDescriptor.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_PLAN_IDENTITIES) return null;
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
      if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || Object.prototype.hasOwnProperty.call(descriptor, 'get') || Object.prototype.hasOwnProperty.call(descriptor, 'set')) return null;
      const identity = readIdentity(descriptor.value);
      if (identity === null || seenPids.has(identity.pid)) return null;
      seenPids.add(identity.pid);
      identities.push(identity);
    }
    return identities;
  } catch {
    return null;
  }
}

function readPidArray(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (!lengthDescriptor || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'get') || Object.prototype.hasOwnProperty.call(lengthDescriptor, 'set')) return null;
    const length = lengthDescriptor.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_PLAN_IDENTITIES) return null;
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
      if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || Object.prototype.hasOwnProperty.call(descriptor, 'get') || Object.prototype.hasOwnProperty.call(descriptor, 'set')) return null;
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

function isOrdinaryEmptyDenseArray(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== 1 || ownKeys[0] !== 'length') return false;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    return lengthDescriptor !== undefined
      && lengthDescriptor.value === 0
      && lengthDescriptor.writable === true
      && lengthDescriptor.enumerable === false
      && lengthDescriptor.configurable === false;
  } catch {
    return false;
  }
}

function isValidProcessTableSnapshot(value) {
  try {
    const expectedKeys = ['complete', 'errors', 'rows'];
    if (!hasExactOwnDataProperties(value, expectedKeys)) return false;
    const completeDescriptor = Object.getOwnPropertyDescriptor(value, 'complete');
    const errorsDescriptor = Object.getOwnPropertyDescriptor(value, 'errors');
    const rowsDescriptor = Object.getOwnPropertyDescriptor(value, 'rows');
    if (!completeDescriptor || !errorsDescriptor || !rowsDescriptor) return false;
    if (completeDescriptor.value !== true) return false;
    if (!isOrdinaryEmptyDenseArray(errorsDescriptor.value)) return false;
    return Array.isArray(rowsDescriptor.value);
  } catch {
    return false;
  }
}

function readTerminationPlan(value) {
  try {
    const expectedKeys = ['complete', 'errors', 'rootPresent', 'treeGone', 'captured', 'newlyCaptured', 'targets', 'reusedPids'];
    if (!hasExactOwnDataProperties(value, expectedKeys)) return null;

    const completeDescriptor = Object.getOwnPropertyDescriptor(value, 'complete');
    const errorsDescriptor = Object.getOwnPropertyDescriptor(value, 'errors');
    const rootPresentDescriptor = Object.getOwnPropertyDescriptor(value, 'rootPresent');
    const treeGoneDescriptor = Object.getOwnPropertyDescriptor(value, 'treeGone');
    const capturedDescriptor = Object.getOwnPropertyDescriptor(value, 'captured');
    const newlyCapturedDescriptor = Object.getOwnPropertyDescriptor(value, 'newlyCaptured');
    const targetsDescriptor = Object.getOwnPropertyDescriptor(value, 'targets');
    const reusedPidsDescriptor = Object.getOwnPropertyDescriptor(value, 'reusedPids');
    if (!completeDescriptor || !errorsDescriptor || !rootPresentDescriptor || !treeGoneDescriptor || !capturedDescriptor || !newlyCapturedDescriptor || !targetsDescriptor || !reusedPidsDescriptor) return null;

    const complete = completeDescriptor.value;
    const errors = errorsDescriptor.value;
    const rootPresent = rootPresentDescriptor.value;
    const treeGone = treeGoneDescriptor.value;
    const captured = readIdentityArray(capturedDescriptor.value);
    const newlyCaptured = readIdentityArray(newlyCapturedDescriptor.value);
    const targets = readIdentityArray(targetsDescriptor.value);
    const reusedPids = readPidArray(reusedPidsDescriptor.value);
    if (complete !== true || typeof rootPresent !== 'boolean' || typeof treeGone !== 'boolean' || captured === null || newlyCaptured === null || targets === null || reusedPids === null) return null;

    if (!Array.isArray(errors) || Object.getPrototypeOf(errors) !== Array.prototype) return null;
    const errorKeys = Reflect.ownKeys(errors);
    if (errorKeys.length !== 1 || errorKeys[0] !== 'length') return null;
    const errorLengthDescriptor = Object.getOwnPropertyDescriptor(errors, 'length');
    if (!errorLengthDescriptor || !Object.prototype.hasOwnProperty.call(errorLengthDescriptor, 'value') || Object.prototype.hasOwnProperty.call(errorLengthDescriptor, 'get') || Object.prototype.hasOwnProperty.call(errorLengthDescriptor, 'set') || errorLengthDescriptor.value !== 0) return null;

    if (captured.length === 0 || treeGone !== (targets.length === 0)) return null;
    const capturedTokensByPid = new Map();
    for (let capturedIndex = 0; capturedIndex < captured.length; capturedIndex += 1) {
      const capturedIdentity = captured[capturedIndex];
      capturedTokensByPid.set(capturedIdentity.pid, capturedIdentity.creationToken);
    }
    for (const identities of [newlyCaptured, targets]) {
      for (let identityIndex = 0; identityIndex < identities.length; identityIndex += 1) {
        const identity = identities[identityIndex];
        if (!capturedTokensByPid.has(identity.pid) || capturedTokensByPid.get(identity.pid) !== identity.creationToken) return null;
      }
    }

    return {
      complete,
      errors: [],
      rootPresent,
      treeGone,
      captured,
      newlyCaptured,
      targets,
      reusedPids
    };
  } catch {
    return null;
  }
}

export function reconcileCapturedTerminationPlans(input = {}) {
  try {
    if (!hasExactOwnDataProperties(input, ['firstPlan', 'secondPlan'])) return makeFailure();

    const firstPlanDescriptor = Object.getOwnPropertyDescriptor(input, 'firstPlan');
    const secondPlanDescriptor = Object.getOwnPropertyDescriptor(input, 'secondPlan');
    if (!firstPlanDescriptor || !secondPlanDescriptor || !Object.prototype.hasOwnProperty.call(firstPlanDescriptor, 'value') || !Object.prototype.hasOwnProperty.call(secondPlanDescriptor, 'value')) return makeFailure();

    const firstPlanValue = firstPlanDescriptor.value;
    const secondPlanValue = secondPlanDescriptor.value;
    if (firstPlanValue === null || secondPlanValue === null) return makeFailure();

    const firstPlan = readTerminationPlan(firstPlanValue);
    const secondPlan = readTerminationPlan(secondPlanValue);
    if (firstPlan === null || secondPlan === null || firstPlan.treeGone !== false || firstPlan.targets.length === 0) return makeFailure();

    const secondCapturedTokensByPid = new Map();
    for (let index = 0; index < secondPlan.captured.length; index += 1) {
      const identity = secondPlan.captured[index];
      secondCapturedTokensByPid.set(identity.pid, identity.creationToken);
    }
    for (let index = 0; index < firstPlan.captured.length; index += 1) {
      const identity = firstPlan.captured[index];
      if (!secondCapturedTokensByPid.has(identity.pid) || secondCapturedTokensByPid.get(identity.pid) !== identity.creationToken) return makeFailure();
    }

    const newlyCaptured = [];
    const seenNewlyCaptured = new Map();
    for (const identities of [firstPlan.newlyCaptured, secondPlan.newlyCaptured]) {
      for (let index = 0; index < identities.length; index += 1) {
        const identity = identities[index];
        let seenTokens = seenNewlyCaptured.get(identity.pid);
        if (seenTokens === undefined) {
          seenTokens = new Set();
          seenNewlyCaptured.set(identity.pid, seenTokens);
        }
        if (seenTokens.has(identity.creationToken)) continue;
        seenTokens.add(identity.creationToken);
        newlyCaptured.push({ pid: identity.pid, creationToken: identity.creationToken });
      }
    }

    const reusedPids = [];
    const seenReusedPids = new Set();
    for (const pids of [firstPlan.reusedPids, secondPlan.reusedPids]) {
      for (let index = 0; index < pids.length; index += 1) {
        const pid = pids[index];
        if (seenReusedPids.has(pid)) continue;
        seenReusedPids.add(pid);
        reusedPids.push(pid);
      }
    }

    const stableTarget = secondPlan.treeGone === false
      && secondPlan.newlyCaptured.length === 0
      && firstPlan.targets[0].pid === secondPlan.targets[0].pid
      && firstPlan.targets[0].creationToken === secondPlan.targets[0].creationToken
      ? { pid: secondPlan.targets[0].pid, creationToken: secondPlan.targets[0].creationToken }
      : null;

    return {
      complete: true,
      errors: [],
      rootPresent: secondPlan.rootPresent,
      treeGone: secondPlan.treeGone,
      replanRequired: secondPlan.treeGone === false && stableTarget === null,
      captured: secondPlan.captured,
      newlyCaptured,
      target: stableTarget,
      reusedPids
    };
  } catch {
    return makeFailure();
  }
}

export async function prepareStableCapturedProcessTerminationStep(input = {}) {
  try {
    if (!hasExactOwnDataProperties(input, ['rootIdentity', 'previousCaptured', 'snapshotOptions'])) return makeFailure();

    const rootIdentityDescriptor = Object.getOwnPropertyDescriptor(input, 'rootIdentity');
    const previousCapturedDescriptor = Object.getOwnPropertyDescriptor(input, 'previousCaptured');
    const snapshotOptionsDescriptor = Object.getOwnPropertyDescriptor(input, 'snapshotOptions');
    if (!rootIdentityDescriptor || !previousCapturedDescriptor || !snapshotOptionsDescriptor) return makeFailure();
    if (!Object.prototype.hasOwnProperty.call(rootIdentityDescriptor, 'value') || !Object.prototype.hasOwnProperty.call(previousCapturedDescriptor, 'value') || !Object.prototype.hasOwnProperty.call(snapshotOptionsDescriptor, 'value')) return makeFailure();

    const rootIdentity = readIdentity(rootIdentityDescriptor.value);
    const previousCaptured = readIdentityArray(previousCapturedDescriptor.value);
    const snapshotOptions = snapshotOptionsDescriptor.value;
    if (rootIdentity === null || previousCaptured === null || previousCaptured.length === 0) return makeFailure();
    if (snapshotOptions === null || typeof snapshotOptions !== 'object' || Array.isArray(snapshotOptions)) return makeFailure();
    const snapshotOptionsPrototype = Object.getPrototypeOf(snapshotOptions);
    if (snapshotOptionsPrototype !== Object.prototype && snapshotOptionsPrototype !== null) return makeFailure();

    let containsRootIdentity = false;
    for (let index = 0; index < previousCaptured.length; index += 1) {
      const identity = previousCaptured[index];
      if (identity.pid === rootIdentity.pid && identity.creationToken === rootIdentity.creationToken) {
        containsRootIdentity = true;
        break;
      }
    }
    if (!containsRootIdentity) return makeFailure();

    let snapshot;
    try {
      snapshot = await captureProcessTableSnapshot(snapshotOptions);
    } catch {
      return makeStepFailure('termination-recheck-capture-failed');
    }
    if (!isValidProcessTableSnapshot(snapshot)) return makeStepFailure('termination-recheck-capture-failed');

    let firstPlan;
    try {
      const snapshotRowsDescriptor = Object.getOwnPropertyDescriptor(snapshot, 'rows');
      if (!snapshotRowsDescriptor || !Object.prototype.hasOwnProperty.call(snapshotRowsDescriptor, 'value')) {
        return makeStepFailure('termination-recheck-plan-failed');
      }
      firstPlan = prepareCapturedProcessTermination({
        rootIdentity,
        previousCaptured,
        snapshotRows: snapshotRowsDescriptor.value
      });
    } catch {
      return makeStepFailure('termination-recheck-plan-failed');
    }

    const validatedFirstPlan = readTerminationPlan(firstPlan);
    if (validatedFirstPlan === null) return makeStepFailure('termination-recheck-plan-failed');
    if (validatedFirstPlan.treeGone === true) {
      return {
        complete: true,
        errors: [],
        rootPresent: validatedFirstPlan.rootPresent,
        treeGone: validatedFirstPlan.treeGone,
        replanRequired: false,
        captured: validatedFirstPlan.captured,
        newlyCaptured: validatedFirstPlan.newlyCaptured,
        target: null,
        reusedPids: validatedFirstPlan.reusedPids
      };
    }

    let secondSnapshot;
    try {
      secondSnapshot = await captureProcessTableSnapshot(snapshotOptions);
    } catch {
      return makeStepFailure('termination-recheck-second-capture-failed');
    }
    if (!isValidProcessTableSnapshot(secondSnapshot)) return makeStepFailure('termination-recheck-second-capture-failed');

    let validatedSecondPlan;
    try {
      const snapshotRowsDescriptor = Object.getOwnPropertyDescriptor(secondSnapshot, 'rows');
      if (!snapshotRowsDescriptor || !Object.prototype.hasOwnProperty.call(snapshotRowsDescriptor, 'value')) {
        return makeStepFailure('termination-recheck-second-plan-failed');
      }
      const secondPlan = prepareCapturedProcessTermination({
        rootIdentity,
        previousCaptured: validatedFirstPlan.captured,
        snapshotRows: snapshotRowsDescriptor.value
      });
      validatedSecondPlan = readTerminationPlan(secondPlan);
    } catch {
      return makeStepFailure('termination-recheck-second-plan-failed');
    }
    if (validatedSecondPlan === null) return makeStepFailure('termination-recheck-second-plan-failed');

    let reconciled;
    try {
      reconciled = reconcileCapturedTerminationPlans({
        firstPlan: validatedFirstPlan,
        secondPlan: validatedSecondPlan
      });
    } catch {
      return makeStepFailure('termination-recheck-reconcile-failed');
    }
    if (reconciled?.complete !== true) return makeStepFailure('termination-recheck-reconcile-failed');
    return reconciled;
  } catch {
    return makeFailure();
  }
}
