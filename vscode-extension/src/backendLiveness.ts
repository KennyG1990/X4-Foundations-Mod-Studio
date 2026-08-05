export interface OwnedBackendLivenessPolicy {
  maxAttempts: number;
  attemptTimeoutMs: number;
  retryDelayMs: number;
}

export const DEFAULT_OWNED_BACKEND_LIVENESS_POLICY: Readonly<OwnedBackendLivenessPolicy> = Object.freeze({
  maxAttempts: 2,
  attemptTimeoutMs: 1500,
  retryDelayMs: 250,
});

export interface OwnedBackendLivenessResult {
  live: boolean;
  attempts: number;
  recoveredAfterRetry: boolean;
  reason: "responsive" | "child-not-running" | "unresponsive";
}

interface OwnedBackendLivenessInput {
  childRunning: boolean;
  probe: (timeoutMs: number, attempt: number) => Promise<boolean>;
  wait?: (delayMs: number) => Promise<void>;
  policy?: Readonly<OwnedBackendLivenessPolicy>;
}

const defaultWait = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

/**
 * A running owned child gets more than one lightweight HTTP opportunity before the extension
 * may discard it. Process existence alone is not sufficient: repeated unresponsiveness is a
 * bounded negative result so the existing restart path can recover a genuinely hung backend.
 */
export async function checkOwnedBackendLiveness(
  input: OwnedBackendLivenessInput,
): Promise<OwnedBackendLivenessResult> {
  if (!input.childRunning) {
    return { live: false, attempts: 0, recoveredAfterRetry: false, reason: "child-not-running" };
  }

  const policy = input.policy ?? DEFAULT_OWNED_BACKEND_LIVENESS_POLICY;
  const wait = input.wait ?? defaultWait;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    let responsive = false;
    try {
      responsive = await input.probe(policy.attemptTimeoutMs, attempt);
    } catch {
      responsive = false;
    }
    if (responsive) {
      return {
        live: true,
        attempts: attempt,
        recoveredAfterRetry: attempt > 1,
        reason: "responsive",
      };
    }
    if (attempt < policy.maxAttempts) await wait(policy.retryDelayMs);
  }

  return {
    live: false,
    attempts: policy.maxAttempts,
    recoveredAfterRetry: false,
    reason: "unresponsive",
  };
}

/** Preserve the positive X4 Forge identity check used for external attach discovery. */
export function hasForgeSchemaIdentity(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as { api_version?: unknown; description?: unknown };
  return (
    typeof data.api_version === "string" &&
    typeof data.description === "string" &&
    data.description.includes("X4 Forge")
  );
}
