import assert from 'node:assert/strict';
import {
  ACTION_OPERATION_ID_PREFIX,
  ACTION_OPERATION_ID_RANDOM_BYTES,
  ACTION_OPERATION_ID_PATTERN,
  createActionOperationId,
  isMutationMethod,
  isValidActionOperationId,
  resolveActionOperationId,
  type StrongRandomBytes,
} from './actionOperationId';

const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
const check = (name: string, assertion: () => void) => {
  try {
    assertion();
    checks.push({ name, pass: true });
  } catch (error) {
    checks.push({ name, pass: false, detail: error instanceof Error ? error.message : String(error) });
  }
};

check('generated IDs have a stable W3A-compatible shape', () => {
  const operationId = createActionOperationId((byteLength) => new Uint8Array(byteLength).fill(0xab));
  assert.ok(operationId.startsWith(ACTION_OPERATION_ID_PREFIX));
  assert.ok(operationId.length >= 1 && operationId.length <= 128);
  assert.match(operationId, ACTION_OPERATION_ID_PATTERN);
  assert.equal(isValidActionOperationId(operationId), true);
  assert.equal(ACTION_OPERATION_ID_RANDOM_BYTES, 16);
});

check('deterministic strong-random sample produces unique IDs', () => {
  let sample = 0;
  const ids = Array.from({ length: 32 }, () => createActionOperationId((byteLength) => {
    const bytes = new Uint8Array(byteLength);
    bytes.fill(sample++);
    return bytes;
  }));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(isValidActionOperationId));
});

check('malformed explicit values are preserved for server rejection', () => {
  const malformed = 'not a valid operation id';
  let randomCalls = 0;
  const preserved = resolveActionOperationId('POST', malformed, () => {
    randomCalls += 1;
    return new Uint8Array(ACTION_OPERATION_ID_RANDOM_BYTES);
  });
  assert.equal(preserved, malformed);
  assert.equal(randomCalls, 0);
  assert.equal(isValidActionOperationId(malformed), false);
});

check('valid explicit values are preserved exactly', () => {
  const explicit = 'caller:operation-7';
  assert.equal(resolveActionOperationId('PATCH', explicit, (() => {
    throw new Error('randomness should not be requested');
  }) as StrongRandomBytes), explicit);
});

check('mutation methods are classified explicitly', () => {
  for (const method of ['POST', 'put', 'PATCH', 'delete']) assert.equal(isMutationMethod(method), true);
  for (const method of ['GET', 'head', 'OPTIONS', 'TRACE', undefined]) assert.equal(isMutationMethod(method), false);
});

check('GET and HEAD never generate an operation ID', () => {
  const unavailable = (() => { throw new Error('randomness should not be requested for reads'); }) as StrongRandomBytes;
  assert.equal(resolveActionOperationId('GET', undefined, unavailable), undefined);
  assert.equal(resolveActionOperationId('HEAD', undefined, unavailable), undefined);
  const explicit = 'caller:read-operation';
  assert.equal(resolveActionOperationId('GET', explicit, unavailable), explicit);
  assert.equal(resolveActionOperationId('HEAD', explicit, unavailable), explicit);
});

check('strong-randomness failure is explicit', () => {
  assert.throws(
    () => createActionOperationId((() => { throw new Error('provider unavailable'); }) as StrongRandomBytes),
    /provider unavailable/,
  );
  assert.throws(
    () => createActionOperationId(undefined as unknown as StrongRandomBytes),
    /Strong cryptographic randomness is required/,
  );
});

const passed = checks.filter(check => check.pass).length;
for (const result of checks) console.log(`${result.pass ? 'ok' : 'not ok'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
console.log(`action operation ID selftest: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exitCode = 1;
