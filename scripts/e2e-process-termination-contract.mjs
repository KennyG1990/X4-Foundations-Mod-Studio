import { captureOwnedProcessClosure } from './e2e-process-tree-contract.mjs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function failure(errors) {
  return {
    complete: false,
    errors,
    rootPresent: false,
    treeGone: false,
    captured: [],
    newlyCaptured: [],
    targets: [],
    reusedPids: [],
  };
}

function copyIdentity(identity) {
  return { pid: identity.pid, creationToken: identity.creationToken };
}

function compareTargets(left, right) {
  if (left.depth > right.depth) {
    return -1;
  }
  if (left.depth < right.depth) {
    return 1;
  }
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

export function prepareCapturedProcessTermination(input = {}) {
  let ownership;
  try {
    ownership = captureOwnedProcessClosure(input);
  } catch {
    return failure(['termination-invalid-input']);
  }

  try {
    if (
      ownership === null ||
      typeof ownership !== 'object' ||
      ownership.complete !== true
    ) {
      const errors = Array.isArray(ownership?.errors)
        ? ownership.errors.slice()
        : ['termination-invalid-input'];
      return failure(errors);
    }

    const captured = ownership.captured.map(copyIdentity);
    const newlyCaptured = ownership.newlyCaptured.map(copyIdentity);
    const reusedPids = ownership.reusedPids.slice();
    const activeRows = ownership.activeOwned.map((row) => ({
      pid: row.pid,
      parentPid: row.parentPid,
      creationToken: row.creationToken,
    }));

    const activeByPid = new Map();
    for (const row of activeRows) {
      activeByPid.set(row.pid, row);
    }

    const childrenByParentPid = new Map();
    for (const row of activeRows) {
      const children = childrenByParentPid.get(row.parentPid);
      if (children === undefined) {
        childrenByParentPid.set(row.parentPid, [row]);
      } else {
        children.push(row);
      }
    }

    const roots = activeRows.filter((row) => !activeByPid.has(row.parentPid));
    const queue = roots.map((row) => ({ pid: row.pid, depth: 0 }));
    const depthByPid = new Map();
    let assignedCount = 0;

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const current = queue[queueIndex];
      if (depthByPid.has(current.pid)) {
        continue;
      }

      depthByPid.set(current.pid, current.depth);
      assignedCount += 1;

      const children = childrenByParentPid.get(current.pid);
      if (children === undefined) {
        continue;
      }

      for (const child of children) {
        if (!depthByPid.has(child.pid)) {
          queue.push({ pid: child.pid, depth: current.depth + 1 });
        }
      }
    }

    if (assignedCount !== activeRows.length) {
      return failure(['termination-order-inconsistent']);
    }

    const orderedTargets = activeRows
      .map((row) => ({
        pid: row.pid,
        creationToken: row.creationToken,
        depth: depthByPid.get(row.pid),
      }))
      .sort(compareTargets)
      .map(({ pid, creationToken }) => ({ pid, creationToken }));

    return {
      complete: true,
      errors: [],
      rootPresent: ownership.rootPresent,
      treeGone: activeRows.length === 0,
      captured,
      newlyCaptured,
      targets: orderedTargets,
      reusedPids,
    };
  } catch {
    return failure(['termination-invalid-input']);
  }
}

const TERMINATION_OUTPUT_KEYS = [
  'complete',
  'errors',
  'rootPresent',
  'treeGone',
  'captured',
  'newlyCaptured',
  'targets',
  'reusedPids',
];

function selftestInput(previousCaptured, snapshotRows, extra = {}) {
  return {
    rootIdentity: { pid: 10, creationToken: 'root' },
    previousCaptured,
    snapshotRows,
    ...extra,
  };
}

function assertExactTerminationOutput(result) {
  assert.deepEqual(Object.keys(result), TERMINATION_OUTPUT_KEYS);
  assert.deepEqual(Object.getOwnPropertyNames(result), TERMINATION_OUTPUT_KEYS);
  assert.deepEqual(Object.getOwnPropertySymbols(result), []);
}

function assertTerminationFailure(result, errors) {
  assertExactTerminationOutput(result);
  assert.deepEqual(result, {
    complete: false,
    errors,
    rootPresent: false,
    treeGone: false,
    captured: [],
    newlyCaptured: [],
    targets: [],
    reusedPids: [],
  });
}

function assertTerminationSuccess(result) {
  assertExactTerminationOutput(result);
  assert.equal(result.complete, true);
  assert.deepEqual(result.errors, []);
}

function runSelftest() {
  const tests = [
    ['root-child-grandchild-order', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [
          { pid: 30, parentPid: 20, creationToken: 'grandchild' },
          { pid: 20, parentPid: 10, creationToken: 'child' },
          { pid: 10, parentPid: 0, creationToken: 'root' },
        ],
      ));

      assertTerminationSuccess(result);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'child' },
        { pid: 30, creationToken: 'grandchild' },
      ]);
      assert.deepEqual(result.newlyCaptured, [
        { pid: 20, creationToken: 'child' },
        { pid: 30, creationToken: 'grandchild' },
      ]);
      assert.deepEqual(result.targets, [
        { pid: 30, creationToken: 'grandchild' },
        { pid: 20, creationToken: 'child' },
        { pid: 10, creationToken: 'root' },
      ]);
      assert.equal(result.rootPresent, true);
      assert.equal(result.treeGone, false);
    }],
    ['multiple-branches-depth-then-pid-and-reversed-snapshot-stability', () => {
      const rows = [
        { pid: 10, parentPid: 0, creationToken: 'root' },
        { pid: 30, parentPid: 10, creationToken: 'child-b' },
        { pid: 50, parentPid: 30, creationToken: 'grandchild-b2' },
        { pid: 20, parentPid: 10, creationToken: 'child-a' },
        { pid: 60, parentPid: 20, creationToken: 'grandchild-a' },
        { pid: 40, parentPid: 30, creationToken: 'grandchild-b1' },
      ];
      const forward = prepareCapturedProcessTermination(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        rows,
      ));
      const reversed = prepareCapturedProcessTermination(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [...rows].reverse(),
      ));

      assertTerminationSuccess(forward);
      assertTerminationSuccess(reversed);
      assert.deepEqual(forward, reversed);
      assert.deepEqual(forward.targets, [
        { pid: 40, creationToken: 'grandchild-b1' },
        { pid: 50, creationToken: 'grandchild-b2' },
        { pid: 60, creationToken: 'grandchild-a' },
        { pid: 20, creationToken: 'child-a' },
        { pid: 30, creationToken: 'child-b' },
        { pid: 10, creationToken: 'root' },
      ]);
    }],
    ['root-gone-with-exact-active-child-and-grandchild', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
          { pid: 30, creationToken: 'grandchild' },
        ],
        [
          { pid: 30, parentPid: 20, creationToken: 'grandchild' },
          { pid: 20, parentPid: 10, creationToken: 'child' },
        ],
      ));

      assertTerminationSuccess(result);
      assert.equal(result.rootPresent, false);
      assert.equal(result.treeGone, false);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'child' },
        { pid: 30, creationToken: 'grandchild' },
      ]);
      assert.deepEqual(result.newlyCaptured, []);
      assert.deepEqual(result.targets, [
        { pid: 30, creationToken: 'grandchild' },
        { pid: 20, creationToken: 'child' },
      ]);
    }],
    ['reparented-captured-child-seeds-new-descendant', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
        ],
        [
          { pid: 40, parentPid: 99, creationToken: 'unrelated' },
          { pid: 30, parentPid: 20, creationToken: 'new-descendant' },
          { pid: 20, parentPid: 99, creationToken: 'child' },
        ],
      ));

      assertTerminationSuccess(result);
      assert.equal(result.rootPresent, false);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'child' },
        { pid: 30, creationToken: 'new-descendant' },
      ]);
      assert.deepEqual(result.newlyCaptured, [
        { pid: 30, creationToken: 'new-descendant' },
      ]);
      assert.deepEqual(result.targets, [
        { pid: 30, creationToken: 'new-descendant' },
        { pid: 20, creationToken: 'child' },
      ]);
    }],
    ['multiple-new-generations-in-one-snapshot', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [
          { pid: 50, parentPid: 40, creationToken: 'generation-4' },
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 30, parentPid: 20, creationToken: 'generation-2' },
          { pid: 40, parentPid: 30, creationToken: 'generation-3' },
          { pid: 20, parentPid: 10, creationToken: 'generation-1' },
        ],
      ));

      assertTerminationSuccess(result);
      assert.deepEqual(result.newlyCaptured, [
        { pid: 20, creationToken: 'generation-1' },
        { pid: 30, creationToken: 'generation-2' },
        { pid: 40, creationToken: 'generation-3' },
        { pid: 50, creationToken: 'generation-4' },
      ]);
      assert.deepEqual(result.targets, [
        { pid: 50, creationToken: 'generation-4' },
        { pid: 40, creationToken: 'generation-3' },
        { pid: 30, creationToken: 'generation-2' },
        { pid: 20, creationToken: 'generation-1' },
        { pid: 10, creationToken: 'root' },
      ]);
    }],
    ['absent-captured-identities-remain-captured-but-are-not-targets', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [
          { pid: 30, creationToken: 'grandchild' },
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
        ],
        [{ pid: 10, parentPid: 0, creationToken: 'root' }],
      ));

      assertTerminationSuccess(result);
      assert.equal(result.treeGone, false);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'child' },
        { pid: 30, creationToken: 'grandchild' },
      ]);
      assert.deepEqual(result.newlyCaptured, []);
      assert.deepEqual(result.targets, [{ pid: 10, creationToken: 'root' }]);
    }],
    ['reused-occupant-excluded-and-descendants-not-followed', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [
          { pid: 20, creationToken: 'old-child' },
          { pid: 10, creationToken: 'root' },
        ],
        [
          { pid: 40, parentPid: 20, creationToken: 'descendant-of-reused' },
          { pid: 20, parentPid: 10, creationToken: 'new-child' },
          { pid: 50, parentPid: 10, creationToken: 'legitimate-child' },
          { pid: 10, parentPid: 0, creationToken: 'root' },
        ],
      ));

      assertTerminationSuccess(result);
      assert.deepEqual(result.reusedPids, [20]);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'old-child' },
        { pid: 50, creationToken: 'legitimate-child' },
      ]);
      assert.deepEqual(result.newlyCaptured, [
        { pid: 50, creationToken: 'legitimate-child' },
      ]);
      assert.deepEqual(result.targets, [
        { pid: 50, creationToken: 'legitimate-child' },
        { pid: 10, creationToken: 'root' },
      ]);
    }],
    ['all-absent-means-tree-gone', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [
          { pid: 10, creationToken: 'root' },
          { pid: 20, creationToken: 'child' },
        ],
        [],
      ));

      assertTerminationSuccess(result);
      assert.equal(result.rootPresent, false);
      assert.equal(result.treeGone, true);
      assert.deepEqual(result.targets, []);
      assert.deepEqual(result.reusedPids, []);
    }],
    ['only-reused-occupants-mean-tree-gone-with-reused-pids', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [
          { pid: 20, creationToken: 'old-child' },
          { pid: 10, creationToken: 'root' },
        ],
        [
          { pid: 20, parentPid: 10, creationToken: 'new-child' },
          { pid: 10, parentPid: 0, creationToken: 'new-root' },
        ],
      ));

      assertTerminationSuccess(result);
      assert.equal(result.rootPresent, false);
      assert.equal(result.treeGone, true);
      assert.deepEqual(result.captured, [
        { pid: 10, creationToken: 'root' },
        { pid: 20, creationToken: 'old-child' },
      ]);
      assert.deepEqual(result.targets, []);
      assert.deepEqual(result.reusedPids, [10, 20]);
    }],
    ['copied-outputs-do-not-alias-input-or-each-other', () => {
      const rootIdentity = { pid: 10, creationToken: 'root' };
      const childIdentity = { pid: 20, creationToken: 'child' };
      const previousCaptured = [rootIdentity, childIdentity];
      const snapshotRows = [
        { pid: 10, parentPid: 0, creationToken: 'root' },
        { pid: 20, parentPid: 10, creationToken: 'child' },
      ];
      const result = prepareCapturedProcessTermination({
        rootIdentity,
        previousCaptured,
        snapshotRows,
      });

      assertTerminationSuccess(result);
      const outputArrays = [
        result.errors,
        result.captured,
        result.newlyCaptured,
        result.targets,
        result.reusedPids,
      ];
      for (const outputArray of outputArrays) {
        assert.notStrictEqual(outputArray, previousCaptured);
        assert.notStrictEqual(outputArray, snapshotRows);
      }
      for (let leftIndex = 0; leftIndex < outputArrays.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < outputArrays.length; rightIndex += 1) {
          assert.notStrictEqual(outputArrays[leftIndex], outputArrays[rightIndex]);
        }
      }
      for (const outputObject of [
        ...result.captured,
        ...result.newlyCaptured,
        ...result.targets,
      ]) {
        assert.notStrictEqual(outputObject, rootIdentity);
        assert.notStrictEqual(outputObject, childIdentity);
        assert.notStrictEqual(outputObject, previousCaptured[0]);
        assert.notStrictEqual(outputObject, previousCaptured[1]);
        assert.notStrictEqual(outputObject, snapshotRows[0]);
        assert.notStrictEqual(outputObject, snapshotRows[1]);
      }
      const outputObjects = [
        ...result.captured,
        ...result.newlyCaptured,
        ...result.targets,
      ];
      for (let leftIndex = 0; leftIndex < outputObjects.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < outputObjects.length; rightIndex += 1) {
          assert.notStrictEqual(outputObjects[leftIndex], outputObjects[rightIndex]);
        }
      }
      result.captured[0].pid = 999;
      assert.equal(rootIdentity.pid, 10);
      assert.equal(result.targets[result.targets.length - 1].pid, 10);
    }],
    ['nonarray-previous-fails-closed', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        {},
        [{ pid: 10, parentPid: 0, creationToken: 'root' }],
      ));
      assertTerminationFailure(result, ['invalid-previous-captured']);
    }],
    ['empty-previous-fails-closed', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [],
        [{ pid: 10, parentPid: 0, creationToken: 'root' }],
      ));
      assertTerminationFailure(result, ['invalid-previous-captured']);
    }],
    ['malformed-row-fails-closed', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [{}],
      ));
      assertTerminationFailure(result, ['invalid-row']);
    }],
    ['duplicate-pid-fails-closed', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 10, parentPid: 0, creationToken: 'duplicate' },
        ],
      ));
      assertTerminationFailure(result, ['duplicate-pid']);
    }],
    ['cycle-fails-closed', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 20, parentPid: 30, creationToken: 'cycle-a' },
          { pid: 30, parentPid: 20, creationToken: 'cycle-b' },
        ],
      ));
      assertTerminationFailure(result, ['parent-cycle']);
    }],
    ['extra-top-level-key-fails-closed', () => {
      const result = prepareCapturedProcessTermination(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [{ pid: 10, parentPid: 0, creationToken: 'root' }],
        { extra: true },
      ));
      assertTerminationFailure(result, ['invalid-input']);
    }],
    ['revoked-input-never-throws', () => {
      const revoked = Proxy.revocable(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [{ pid: 10, parentPid: 0, creationToken: 'root' }],
      ), {});
      revoked.revoke();

      let result;
      assert.doesNotThrow(() => {
        result = prepareCapturedProcessTermination(revoked.proxy);
      });
      assertTerminationFailure(result, ['invalid-input']);
    }],
    ['getter-input-never-throws', () => {
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
      const input = selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [{ pid: 10, parentPid: 0, creationToken: 'root' }],
      );
      input.rootIdentity = throwingRoot;

      let result;
      assert.doesNotThrow(() => {
        result = prepareCapturedProcessTermination(input);
      });
      assertTerminationFailure(result, ['invalid-input']);
    }],
    ['proxy-input-never-throws', () => {
      const input = selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [{ pid: 10, parentPid: 0, creationToken: 'root' }],
      );
      const proxy = new Proxy(input, {
        get(target, property, receiver) {
          if (property === 'snapshotRows') {
            throw new Error('proxy getter failure');
          }
          return Reflect.get(target, property, receiver);
        },
      });

      let result;
      assert.doesNotThrow(() => {
        result = prepareCapturedProcessTermination(proxy);
      });
      assertTerminationFailure(result, ['invalid-input']);
    }],
    ['errors-and-ordering-are-deterministic', () => {
      const input = selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 10, parentPid: 0, creationToken: 'duplicate' },
        ],
      );
      const first = prepareCapturedProcessTermination(input);
      const second = prepareCapturedProcessTermination(input);
      assert.deepEqual(first, second);
      assertTerminationFailure(first, ['duplicate-pid']);

      const ordered = prepareCapturedProcessTermination(selftestInput(
        [{ pid: 10, creationToken: 'root' }],
        [
          { pid: 50, parentPid: 30, creationToken: 'deep-b' },
          { pid: 20, parentPid: 10, creationToken: 'child-a' },
          { pid: 10, parentPid: 0, creationToken: 'root' },
          { pid: 30, parentPid: 10, creationToken: 'child-b' },
          { pid: 40, parentPid: 30, creationToken: 'deep-a' },
        ],
      ));
      assert.deepEqual(ordered.targets, [
        { pid: 40, creationToken: 'deep-a' },
        { pid: 50, creationToken: 'deep-b' },
        { pid: 20, creationToken: 'child-a' },
        { pid: 30, creationToken: 'child-b' },
        { pid: 10, creationToken: 'root' },
      ]);
    }],
    ['iterative-50000-row-chain-completes-and-orders-deepest-first', () => {
      const rowCount = 50_000;
      const snapshotRows = [];
      for (let pid = 1; pid <= rowCount; pid += 1) {
        snapshotRows.push({
          pid,
          parentPid: pid === 1 ? 0 : pid - 1,
          creationToken: pid === 1 ? 'root' : `generation-${pid}`,
        });
      }

      const result = prepareCapturedProcessTermination({
        rootIdentity: { pid: 1, creationToken: 'root' },
        previousCaptured: [{ pid: 1, creationToken: 'root' }],
        snapshotRows,
      });

      assertTerminationSuccess(result);
      assert.equal(result.captured.length, rowCount);
      assert.equal(result.newlyCaptured.length, rowCount - 1);
      assert.equal(result.targets.length, rowCount);
      assert.deepEqual(result.targets[0], {
        pid: rowCount,
        creationToken: `generation-${rowCount}`,
      });
      assert.deepEqual(result.targets[rowCount - 1], {
        pid: 1,
        creationToken: 'root',
      });
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

  console.log(`[e2e-process-termination selftest] ${tests.length}/${tests.length} PASS`);
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly && process.argv.includes('--selftest')) {
  try {
    runSelftest();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'selftest failed');
    process.exitCode = 1;
  }
}
