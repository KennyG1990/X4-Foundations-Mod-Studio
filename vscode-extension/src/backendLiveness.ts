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
  reason: "responsive" | "child-not-running" | "running-but-busy";
}

interface OwnedBackendLivenessInput {
  childRunning: boolean;
  isChildRunning?: () => boolean;
  probe: (timeoutMs: number, attempt: number) => Promise<boolean>;
  wait?: (delayMs: number) => Promise<void>;
  policy?: Readonly<OwnedBackendLivenessPolicy>;
}

const defaultWait = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

/**
 * A running owned child gets bounded lightweight HTTP opportunities for observability, but its
 * process state remains authoritative. Probe timeouts classify a still-running child as busy and
 * reusable; only an already-exited child is rejected here.
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

  if (input.isChildRunning && !input.isChildRunning()) {
    return {
      live: false,
      attempts: policy.maxAttempts,
      recoveredAfterRetry: false,
      reason: "child-not-running",
    };
  }

  return {
    live: true,
    attempts: policy.maxAttempts,
    recoveredAfterRetry: false,
    reason: "running-but-busy",
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
