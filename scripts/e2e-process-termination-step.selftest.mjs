import assert from 'node:assert/strict';

import { reconcileCapturedTerminationPlans } from './e2e-process-termination-step.mjs';

const identity = (pid, creationToken) => ({ pid, creationToken });

const plan = ({ rootPresent = true, treeGone, captured, newlyCaptured = [], targets, reusedPids = [] }) => ({
  complete: true,
  errors: [],
  rootPresent,
  treeGone: treeGone ?? targets.length === 0,
  captured,
  newlyCaptured,
  targets,
  reusedPids
});

const runCheck = (_name, check) => check();

runCheck('exact stable target', () => {
  const target = identity(101, 'stable-101');
  const firstPlan = plan({ captured: [target], targets: [target], treeGone: false });
  const secondPlan = plan({ captured: [target], targets: [target], treeGone: false });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.deepStrictEqual(Object.keys(firstPlan), [
    'complete', 'errors', 'rootPresent', 'treeGone', 'captured', 'newlyCaptured', 'targets', 'reusedPids'
  ]);
  assert.deepStrictEqual(result, {
    complete: true,
    errors: [],
    rootPresent: true,
    treeGone: false,
    replanRequired: false,
    captured: [target],
    newlyCaptured: [],
    target,
    reusedPids: []
  });
  assert.notStrictEqual(result.target, target);
});

runCheck('second newly captured identity forces replan', () => {
  const target = identity(201, 'stable-201');
  const newcomer = identity(202, 'new-202');
  const firstPlan = plan({ captured: [target], targets: [target], treeGone: false });
  const secondPlan = plan({
    captured: [target, newcomer],
    newlyCaptured: [newcomer],
    targets: [target],
    treeGone: false
  });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.strictEqual(result.target, null);
  assert.strictEqual(result.replanRequired, true);
  assert.deepStrictEqual(result.newlyCaptured, [newcomer]);
});

runCheck('second tree gone clears target without replan', () => {
  const target = identity(301, 'stable-301');
  const firstPlan = plan({ captured: [target], targets: [target], treeGone: false });
  const secondPlan = plan({ captured: [target], targets: [], rootPresent: false, treeGone: true });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.strictEqual(result.target, null);
  assert.strictEqual(result.replanRequired, false);
  assert.strictEqual(result.treeGone, true);
});

runCheck('malformed empty input returns failure envelope', () => {
  const result = reconcileCapturedTerminationPlans({});

  assert.deepStrictEqual(result, {
    complete: false,
    errors: ['termination-recheck-invalid-input'],
    rootPresent: false,
    treeGone: false,
    replanRequired: false,
    captured: [],
    newlyCaptured: [],
    target: null,
    reusedPids: []
  });
  assert.deepStrictEqual(Object.keys(result), [
    'complete', 'errors', 'rootPresent', 'treeGone', 'replanRequired', 'captured', 'newlyCaptured', 'target', 'reusedPids'
  ]);
});

const expectedFailure = {
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

runCheck('second target order change forces replan', () => {
  const firstTarget = identity(401, 'stable-401');
  const secondTarget = identity(402, 'stable-402');
  const firstPlan = plan({
    captured: [firstTarget, secondTarget],
    targets: [firstTarget, secondTarget],
    treeGone: false
  });
  const secondPlan = plan({
    captured: [firstTarget, secondTarget],
    targets: [secondTarget, firstTarget],
    treeGone: false
  });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.strictEqual(result.target, null);
  assert.strictEqual(result.replanRequired, true);
});

runCheck('root absent retains active captured descendant target', () => {
  const descendant = identity(501, 'active-descendant-501');
  const firstPlan = plan({
    rootPresent: false,
    captured: [descendant],
    targets: [descendant],
    treeGone: false
  });
  const secondPlan = plan({
    rootPresent: false,
    captured: [descendant],
    targets: [descendant],
    treeGone: false
  });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.deepStrictEqual(result.target, descendant);
  assert.notStrictEqual(result.target, descendant);
  assert.strictEqual(result.rootPresent, false);
  assert.strictEqual(result.replanRequired, false);
});

runCheck('second captured plan omits first captured identity', () => {
  const retained = identity(601, 'retained-601');
  const omitted = identity(602, 'omitted-602');
  const firstPlan = plan({
    captured: [retained, omitted],
    targets: [retained],
    treeGone: false
  });
  const secondPlan = plan({
    captured: [retained],
    targets: [retained],
    treeGone: false
  });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.deepStrictEqual(result, expectedFailure);
});

runCheck('same PID with changed creation token fails', () => {
  const firstIdentity = identity(701, 'creation-token-a');
  const secondIdentity = identity(701, 'creation-token-b');
  const firstPlan = plan({
    captured: [firstIdentity],
    targets: [firstIdentity],
    treeGone: false
  });
  const secondPlan = plan({
    captured: [secondIdentity],
    targets: [secondIdentity],
    treeGone: false
  });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.deepStrictEqual(result, expectedFailure);
});

runCheck('first tree gone returns failure for valid plans', () => {
  const goneIdentity = identity(801, 'gone-801');
  const target = identity(802, 'active-802');
  const firstPlan = plan({
    rootPresent: false,
    captured: [goneIdentity],
    targets: [],
    treeGone: true
  });
  const secondPlan = plan({
    captured: [goneIdentity, target],
    targets: [target],
    treeGone: false
  });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.deepStrictEqual(result, expectedFailure);
});

runCheck('overlapping newly captured identities and reused PIDs union deterministically', () => {
  const target = identity(901, 'stable-901');
  const firstNew = identity(902, 'new-902');
  const overlappingNew = identity(903, 'overlap-903');
  const secondNew = identity(904, 'new-904');
  const firstPlan = plan({
    captured: [target, firstNew, overlappingNew],
    newlyCaptured: [firstNew, overlappingNew],
    targets: [target],
    reusedPids: [911, 912, 913],
    treeGone: false
  });
  const secondPlan = plan({
    captured: [target, firstNew, overlappingNew, secondNew],
    newlyCaptured: [overlappingNew, secondNew, firstNew],
    targets: [target],
    reusedPids: [912, 914, 911, 915],
    treeGone: false
  });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.deepStrictEqual(result, {
    complete: true,
    errors: [],
    rootPresent: true,
    treeGone: false,
    replanRequired: true,
    captured: [target, firstNew, overlappingNew, secondNew],
    newlyCaptured: [firstNew, overlappingNew, secondNew],
    target: null,
    reusedPids: [911, 912, 913, 914, 915]
  });
});

runCheck('hostile accessors and revoked proxies fail closed', () => {
  let getterReads = 0;
  const hostileInput = {
    get firstPlan() {
      getterReads += 1;
      return {};
    },
    secondPlan: {}
  };
  const accessorResult = reconcileCapturedTerminationPlans(hostileInput);

  assert.deepStrictEqual(accessorResult, expectedFailure);
  assert.strictEqual(getterReads, 0);

  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  let revokedResult;
  assert.doesNotThrow(() => {
    revokedResult = reconcileCapturedTerminationPlans(proxy);
  });
  assert.deepStrictEqual(revokedResult, expectedFailure);
});

runCheck('stable result does not reuse plan or identity references', () => {
  const target = identity(1001, 'stable-1001');
  const newcomer = identity(1002, 'new-1002');
  const firstPlan = plan({
    captured: [target, newcomer],
    newlyCaptured: [newcomer],
    targets: [target],
    reusedPids: [1011, 1012],
    treeGone: false
  });
  const secondPlan = plan({
    captured: [target, newcomer],
    newlyCaptured: [],
    targets: [target],
    reusedPids: [1013, 1014],
    treeGone: false
  });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  assert.notStrictEqual(result, firstPlan);
  assert.notStrictEqual(result, secondPlan);
  for (const key of ['errors', 'captured', 'newlyCaptured', 'reusedPids']) {
    assert.notStrictEqual(result[key], firstPlan[key]);
    assert.notStrictEqual(result[key], secondPlan[key]);
  }
  for (const resultIdentity of [...result.captured, ...result.newlyCaptured]) {
    assert.notStrictEqual(resultIdentity, target);
    assert.notStrictEqual(resultIdentity, newcomer);
  }
  assert.notStrictEqual(result.target, target);
  assert.notStrictEqual(result.target, newcomer);
  assert.notStrictEqual(result.target, null);
});

runCheck('result mutation does not mutate caller plans', () => {
  const target = identity(1101, 'stable-1101');
  const firstNew = identity(1102, 'new-1102');
  const firstPlan = plan({
    captured: [target, firstNew],
    newlyCaptured: [firstNew],
    targets: [target],
    reusedPids: [1111, 1112],
    treeGone: false
  });
  const secondPlan = plan({
    captured: [target, firstNew],
    targets: [target],
    reusedPids: [1112, 1113],
    treeGone: false
  });
  const firstPlanSnapshot = structuredClone(firstPlan);
  const secondPlanSnapshot = structuredClone(secondPlan);
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });

  result.captured[0].pid = 1199;
  result.captured.push(identity(1198, 'mutated-captured'));
  result.newlyCaptured[0].creationToken = 'mutated-newly-captured';
  result.newlyCaptured.push(identity(1197, 'mutated-newly-captured-array'));
  result.target.creationToken = 'mutated-target';
  result.reusedPids[0] = 1196;
  result.reusedPids.push(1195);
  result.errors.push('mutated-errors');

  assert.deepStrictEqual(firstPlan, firstPlanSnapshot);
  assert.deepStrictEqual(secondPlan, secondPlanSnapshot);
});

runCheck('caller mutation does not mutate stable result', () => {
  const target = identity(1201, 'stable-1201');
  const firstNew = identity(1202, 'new-1202');
  const firstPlan = plan({
    captured: [target, firstNew],
    newlyCaptured: [firstNew],
    targets: [target],
    reusedPids: [1211, 1212],
    treeGone: false
  });
  const secondPlan = plan({
    captured: [target, firstNew],
    newlyCaptured: [],
    targets: [target],
    reusedPids: [1212, 1213],
    treeGone: false
  });
  const result = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });
  const resultSnapshot = structuredClone(result);

  firstPlan.captured[0].pid = 1299;
  firstPlan.captured.push(identity(1203, 'mutated-first-captured-array'));
  secondPlan.captured[0].creationToken = 'mutated-second-captured';
  secondPlan.captured.push(identity(1204, 'mutated-second-captured-array'));
  firstPlan.newlyCaptured[0].creationToken = 'mutated-first-newly-captured';
  firstPlan.newlyCaptured.push(identity(1205, 'mutated-first-newly-captured-array'));
  secondPlan.newlyCaptured.push(identity(1206, 'mutated-second-newly-captured-array'));
  firstPlan.targets[0].pid = 1298;
  firstPlan.targets.push(identity(1207, 'mutated-first-targets-array'));
  secondPlan.targets[0].creationToken = 'mutated-second-target';
  secondPlan.targets.push(identity(1208, 'mutated-second-targets-array'));
  firstPlan.reusedPids[0] = 1297;
  firstPlan.reusedPids.push(1296);
  secondPlan.reusedPids[0] = 1295;
  secondPlan.reusedPids.push(1294);
  firstPlan.errors.push('mutated-first-errors');
  secondPlan.errors.push('mutated-second-errors');

  assert.deepStrictEqual(result, resultSnapshot);
});

runCheck('nested hostile plan and array accessors fail closed', () => {
  let errorsReads = 0;
  const errorsTarget = identity(1301, 'hostile-errors-1301');
  const hostileErrorsPlan = plan({
    captured: [errorsTarget],
    targets: [errorsTarget],
    treeGone: false
  });
  Object.defineProperty(hostileErrorsPlan, 'errors', {
    enumerable: true,
    get() {
      errorsReads += 1;
      return [];
    }
  });

  assert.deepStrictEqual(Object.keys(hostileErrorsPlan), [
    'complete', 'errors', 'rootPresent', 'treeGone', 'captured', 'newlyCaptured', 'targets', 'reusedPids'
  ]);
  let errorsResult;
  assert.doesNotThrow(() => {
    errorsResult = reconcileCapturedTerminationPlans({
      firstPlan: hostileErrorsPlan,
      secondPlan: plan({ captured: [errorsTarget], targets: [errorsTarget], treeGone: false })
    });
  });
  assert.deepStrictEqual(errorsResult, expectedFailure);
  assert.strictEqual(errorsReads, 0);

  let capturedReads = 0;
  const capturedTarget = identity(1302, 'hostile-captured-1302');
  const hostileCaptured = [capturedTarget];
  Object.defineProperty(hostileCaptured, '0', {
    enumerable: true,
    get() {
      capturedReads += 1;
      return capturedTarget;
    }
  });
  const hostileCapturedPlan = plan({
    captured: hostileCaptured,
    targets: [capturedTarget],
    treeGone: false
  });

  assert.strictEqual(hostileCaptured.length, 1);
  assert.deepStrictEqual(Object.keys(hostileCaptured), ['0']);
  let capturedResult;
  assert.doesNotThrow(() => {
    capturedResult = reconcileCapturedTerminationPlans({
      firstPlan: hostileCapturedPlan,
      secondPlan: plan({ captured: [capturedTarget], targets: [capturedTarget], treeGone: false })
    });
  });
  assert.deepStrictEqual(capturedResult, expectedFailure);
  assert.strictEqual(capturedReads, 0);

  const revokedTarget = identity(1303, 'revoked-first-plan-1303');
  const { proxy: revokedFirstPlan, revoke } = Proxy.revocable(
    plan({ captured: [revokedTarget], targets: [revokedTarget], treeGone: false }),
    {}
  );
  revoke();
  const exactInput = {
    firstPlan: revokedFirstPlan,
    secondPlan: plan({ captured: [revokedTarget], targets: [revokedTarget], treeGone: false })
  };

  assert.deepStrictEqual(Object.keys(exactInput), ['firstPlan', 'secondPlan']);
  let revokedResult;
  assert.doesNotThrow(() => {
    revokedResult = reconcileCapturedTerminationPlans(exactInput);
  });
  assert.deepStrictEqual(revokedResult, expectedFailure);
});

runCheck('malformed complete plan refuses internally', () => {
  const validPlans = () => {
    const firstTarget = identity(1501, 'stable-1501');
    const secondTarget = identity(1501, 'stable-1501');
    return {
      firstPlan: plan({ captured: [firstTarget], targets: [firstTarget], treeGone: false }),
      secondPlan: plan({ captured: [secondTarget], targets: [secondTarget], treeGone: false })
    };
  };
  const assertMalformed = (mutate) => {
    const { firstPlan, secondPlan } = validPlans();
    mutate({ firstPlan, secondPlan });
    assert.deepStrictEqual(
      reconcileCapturedTerminationPlans({ firstPlan, secondPlan }),
      expectedFailure
    );
  };

  assertMalformed(({ firstPlan }) => {
    firstPlan.captured.push(identity(1501, 'duplicate-1501'));
  });

  assertMalformed(({ firstPlan }) => {
    firstPlan.captured[0].creationToken = '';
  });
  assertMalformed(({ firstPlan }) => {
    firstPlan.captured[0].creationToken = ' leading-whitespace';
  });
  assertMalformed(({ firstPlan }) => {
    firstPlan.captured[0].creationToken = 'trailing-whitespace ';
  });
  assertMalformed(({ firstPlan }) => {
    firstPlan.captured[0].creationToken = 'x'.repeat(129);
  });
  assertMalformed(({ firstPlan }) => {
    firstPlan.captured[0].creationToken = `control${String.fromCharCode(1)}token`;
  });

  assertMalformed(({ firstPlan }) => {
    firstPlan.targets = [identity(1502, 'missing-1502')];
  });
  assertMalformed(({ firstPlan }) => {
    firstPlan.targets = [identity(1501, 'wrong-token-1501')];
  });

  assertMalformed(({ firstPlan }) => {
    firstPlan.errors = ['internal-error'];
  });
  assertMalformed(({ firstPlan }) => {
    firstPlan.extra = true;
  });
  assertMalformed(({ firstPlan }) => {
    delete firstPlan.captured[0];
  });
  assertMalformed(({ firstPlan }) => {
    firstPlan.captured.extra = true;
  });
});

runCheck('large linear stable input remains iterative and deterministic', () => {
  const captured = Array.from(
    { length: 50_000 },
    (_, index) => identity(index + 2001, `linear-${index}`)
  );
  const lastIdentity = captured[captured.length - 1];
  const firstPlan = plan({
    captured,
    newlyCaptured: [],
    targets: [lastIdentity],
    treeGone: false
  });
  const secondPlan = plan({
    captured,
    newlyCaptured: [],
    targets: [lastIdentity],
    treeGone: false
  });

  let firstResult;
  let secondResult;
  assert.doesNotThrow(() => {
    firstResult = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });
  });
  assert.doesNotThrow(() => {
    secondResult = reconcileCapturedTerminationPlans({ firstPlan, secondPlan });
  });

  for (const result of [firstResult, secondResult]) {
    assert.strictEqual(result.complete, true);
    assert.strictEqual(result.replanRequired, false);
    assert.strictEqual(result.treeGone, false);
    assert.strictEqual(result.captured.length, 50_000);
    assert.strictEqual(result.newlyCaptured.length, 0);
    assert.deepStrictEqual(result.target, lastIdentity);
  }
  assert.deepStrictEqual(firstResult, secondResult);

  assert.notStrictEqual(firstResult, secondResult);
  assert.notStrictEqual(firstResult, firstPlan);
  assert.notStrictEqual(firstResult, secondPlan);
  assert.notStrictEqual(secondResult, firstPlan);
  assert.notStrictEqual(secondResult, secondPlan);
  assert.notStrictEqual(firstResult.captured, secondResult.captured);
  assert.notStrictEqual(firstResult.captured, captured);
  assert.notStrictEqual(secondResult.captured, captured);
  assert.notStrictEqual(firstResult.target, secondResult.target);
  assert.notStrictEqual(firstResult.target, lastIdentity);
  assert.notStrictEqual(secondResult.target, lastIdentity);
});

runCheck('non-plain object records fail closed', () => {
  const validTarget = identity(3001, 'plain-prototype-3001');
  const validFirstPlan = plan({ captured: [validTarget], targets: [validTarget], treeGone: false });
  const validSecondPlan = plan({ captured: [validTarget], targets: [validTarget], treeGone: false });
  const assertExpectedFailure = (input) => {
    let result;
    assert.doesNotThrow(() => {
      result = reconcileCapturedTerminationPlans(input);
    });
    assert.deepStrictEqual(result, expectedFailure);
  };

  const nullPrototypeInput = Object.assign(Object.create(null), {
    firstPlan: validFirstPlan,
    secondPlan: validSecondPlan
  });
  assertExpectedFailure(nullPrototypeInput);

  const nullPrototypePlan = Object.assign(Object.create(null), validFirstPlan);
  assertExpectedFailure({ firstPlan: nullPrototypePlan, secondPlan: validSecondPlan });

  const nullPrototypeIdentity = Object.assign(Object.create(null), identity(3002, 'null-identity-3002'));
  const nullPrototypeIdentityPlan = plan({
    captured: [nullPrototypeIdentity],
    targets: [nullPrototypeIdentity],
    treeGone: false
  });
  const validIdentityPlan = plan({
    captured: [identity(3002, 'null-identity-3002')],
    targets: [identity(3002, 'null-identity-3002')],
    treeGone: false
  });
  assertExpectedFailure({ firstPlan: nullPrototypeIdentityPlan, secondPlan: validIdentityPlan });

  const customPrototype = { inheritedMarker: true };
  const customPrototypeInput = Object.assign(Object.create(customPrototype), {
    firstPlan: validFirstPlan,
    secondPlan: validSecondPlan
  });
  assertExpectedFailure(customPrototypeInput);
});

console.log('e2e process termination step selftest: 18/18 PASS');
