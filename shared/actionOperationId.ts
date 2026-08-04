/**
 * W3B1 — client-owned operation identity shared by the embedded Studio and the
 * native VS Code/Antigravity controller. The caller supplies a strong random
 * byte source; this contract never falls back to clocks or Math.random().
 */

export const ACTION_OPERATION_ID_HEADER = 'x-forge-operation-id';
export const ACTION_OPERATION_ID_PREFIX = 'forge_op_';
export const ACTION_OPERATION_ID_RANDOM_BYTES = 16;
export const ACTION_OPERATION_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;

export type StrongRandomBytes = (byteLength: number) => Uint8Array;

export function isValidActionOperationId(value: unknown): value is string {
  return typeof value === 'string' && ACTION_OPERATION_ID_PATTERN.test(value);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a bounded W3A-compatible ID from an explicitly supplied strong
 * randomness source. A missing, failing, or malformed source is an error.
 */
export function createActionOperationId(randomBytes: StrongRandomBytes): string {
  if (typeof randomBytes !== 'function') {
    throw new Error('Strong cryptographic randomness is required for Forge operation identity.');
  }
  const bytes = randomBytes(ACTION_OPERATION_ID_RANDOM_BYTES);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== ACTION_OPERATION_ID_RANDOM_BYTES) {
    throw new Error('Strong cryptographic randomness returned an invalid operation identity payload.');
  }
  const operationId = `${ACTION_OPERATION_ID_PREFIX}${bytesToHex(bytes)}`;
  if (!isValidActionOperationId(operationId)) {
    throw new Error('Generated Forge operation identity is outside the accepted format.');
  }
  return operationId;
}

export function isMutationMethod(method: string | undefined): boolean {
  return typeof method === 'string' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

/**
 * Explicit values belong to the initiating action, including malformed values;
 * preserving them lets the server reject them instead of silently substituting
 * a different identity. Reads never generate a value.
 */
export function resolveActionOperationId(
  method: string | undefined,
  explicitValue: string | undefined,
  randomBytes: StrongRandomBytes,
): string | undefined {
  if (!isMutationMethod(method) || explicitValue !== undefined) return explicitValue;
  return createActionOperationId(randomBytes);
}
