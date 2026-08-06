import {
  DEFAULT_OWNED_BACKEND_LIVENESS_POLICY,
  checkOwnedBackendLiveness,
  hasForgeSchemaIdentity,
} from "./backendLiveness";

const checks: Array<{ name: string; pass: boolean }> = [];
const ok = (name: string, pass: boolean) => checks.push({ name, pass });
const noWait = async (): Promise<void> => undefined;

async function main(): Promise<void> {
  let healthyCalls = 0;
  const healthy = await checkOwnedBackendLiveness({
    childRunning: true,
    probe: async (timeoutMs, attempt) => {
      healthyCalls += 1;
      return timeoutMs === DEFAULT_OWNED_BACKEND_LIVENESS_POLICY.attemptTimeoutMs && attempt === 1;
    },
    wait: noWait,
  });
  ok("healthy_owned_backend_reuses_first_lightweight_response", healthy.live && healthy.attempts === 1 && healthyCalls === 1 && !healthy.recoveredAfterRetry);

  const transientSequence = [false, true];
  const retryWaits: number[] = [];
  const transient = await checkOwnedBackendLiveness({
    childRunning: true,
    probe: async () => transientSequence.shift() ?? false,
    wait: async (delayMs) => { retryWaits.push(delayMs); },
  });
  ok("transient_owned_failure_retries_without_churn", transient.live && transient.attempts === 2 && transient.recoveredAfterRetry && retryWaits.join(",") === String(DEFAULT_OWNED_BACKEND_LIVENESS_POLICY.retryDelayMs));

  let busyCalls = 0;
  const busy = await checkOwnedBackendLiveness({
    childRunning: true,
    probe: async () => { busyCalls += 1; return false; },
    wait: noWait,
  });
  ok(
    "running_owned_child_is_retained_when_every_bounded_probe_times_out",
    busy.live && busy.reason === "running-but-busy" && busy.attempts === DEFAULT_OWNED_BACKEND_LIVENESS_POLICY.maxAttempts && busyCalls === DEFAULT_OWNED_BACKEND_LIVENESS_POLICY.maxAttempts,
  );

  let childRunningDuringProbe = true;
  let exitedDuringProbeCalls = 0;
  const exitedDuringProbes = await checkOwnedBackendLiveness({
    childRunning: childRunningDuringProbe,
    isChildRunning: () => childRunningDuringProbe,
    probe: async () => {
      exitedDuringProbeCalls += 1;
      childRunningDuringProbe = false;
      return false;
    },
    wait: noWait,
  });
  ok(
    "owned_child_exiting_during_failed_probes_is_rejected",
    !exitedDuringProbes.live && exitedDuringProbes.reason === "child-not-running" && exitedDuringProbes.attempts === DEFAULT_OWNED_BACKEND_LIVENESS_POLICY.maxAttempts && exitedDuringProbeCalls === DEFAULT_OWNED_BACKEND_LIVENESS_POLICY.maxAttempts,
  );

  let exitedCalls = 0;
  const exited = await checkOwnedBackendLiveness({
    childRunning: false,
    probe: async () => { exitedCalls += 1; return true; },
    wait: noWait,
  });
  ok("exited_owned_child_is_rejected_without_http", !exited.live && exited.reason === "child-not-running" && exited.attempts === 0 && exitedCalls === 0);

  ok("external_forge_identity_is_accepted", hasForgeSchemaIdentity({ api_version: "2026-07-30.agent.v4", description: "X4 Forge external agent contract." }));
  ok("arbitrary_external_http_is_rejected", !hasForgeSchemaIdentity({ api_version: "v1", description: "Another local service" }) && !hasForgeSchemaIdentity({ description: "X4 Forge" }));

  const passed = checks.filter((check) => check.pass).length;
  for (const check of checks) console.log(`${check.pass ? "ok" : "not ok"} ${check.name}`);
  console.log(`backend liveness selftest: ${passed}/${checks.length}`);
  if (passed !== checks.length) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
