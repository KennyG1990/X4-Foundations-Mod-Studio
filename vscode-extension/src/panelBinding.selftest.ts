import { PanelBackendBinding, SharedBackendEnsure, type PanelBackendDescriptor } from "./panelBinding";

const checks: Array<{ name: string; pass: boolean }> = [];
const ok = (name: string, pass: boolean) => checks.push({ name, pass });
const binding = new PanelBackendBinding();
const renders: string[] = [];
const render = (backend: PanelBackendDescriptor) => renders.push(`${backend.baseUrl}|${backend.token ?? ""}`);

const a: PanelBackendDescriptor = {
  baseUrl: "http://127.0.0.1:56784",
  owned: true,
  port: 56784,
  token: "token-a",
};
const b: PanelBackendDescriptor = {
  baseUrl: "http://127.0.0.1:56542",
  owned: true,
  port: 56542,
  token: "token-b",
};
const samePortNewSession: PanelBackendDescriptor = { ...b, token: "token-c" };

async function main(): Promise<void> {
  binding.track("single", render);
  ok("first_bind_renders", binding.bind(a) && renders.length === 1);
  ok("same_identity_does_not_reload", !binding.bind(a) && renders.length === 1);
  ok("replacement_port_reloads_once", binding.bind(b) && renders.length === 2);
  ok("same_port_new_token_reloads", binding.bind(samePortNewSession) && renders.length === 3);
  binding.reset();
  ok("restored_panel_reset_rebinds", binding.bind(samePortNewSession) && renders.length === 4);

  const multiBinding = new PanelBackendBinding();
  const multiRenders: Record<string, string[]> = { first: [], second: [] };
  multiBinding.track("first", (backend) => multiRenders.first.push(backend.baseUrl + "|" + (backend.token ?? "")));
  multiBinding.track("second", (backend) => multiRenders.second.push(backend.baseUrl + "|" + (backend.token ?? "")));
  ok("multi_panel_first_bind_renders_each_once", multiBinding.bind(a) && multiRenders.first.length === 1 && multiRenders.second.length === 1);
  ok("multi_panel_unchanged_identity_does_not_reload", !multiBinding.bind(a) && multiRenders.first.length === 1 && multiRenders.second.length === 1);
  ok("multi_panel_port_change_reloads_each_once", multiBinding.bind(b) && multiRenders.first.length === 2 && multiRenders.second.length === 2);
  ok("multi_panel_token_change_reloads_each_once", multiBinding.bind(samePortNewSession) && multiRenders.first.length === 3 && multiRenders.second.length === 3);
  multiBinding.setActive("second");
  multiBinding.untrack("second");
  ok("untracked_panel_does_not_render_remaining_does", multiBinding.bind(a) && multiRenders.first.length === 4 && multiRenders.second.length === 3 && multiBinding.getActiveKey() === "first");

  const shared = new SharedBackendEnsure<PanelBackendDescriptor>();
  let resolveStartup!: (value: PanelBackendDescriptor) => void;
  const startup = new Promise<PanelBackendDescriptor>((resolve) => { resolveStartup = resolve; });
  let starts = 0;
  const readyCallers: string[] = [];
  const start = () => { starts += 1; return startup; };
  const owner = shared.run(start, () => readyCallers.push("owner"));
  const restoredPanelJoiner = shared.run(start, () => readyCallers.push("restored-panel"));
  resolveStartup(b);
  await Promise.all([owner, restoredPanelJoiner]);
  ok("joined_callers_share_one_startup", starts === 1);
  ok("joined_restored_panel_runs_ready_binding", readyCallers.join(",") === "owner,restored-panel");

  let rejectedStarts = 0;
  let rejectedReady = 0;
  await shared.run(
    async () => { rejectedStarts += 1; throw new Error("expected startup failure"); },
    () => { rejectedReady += 1; },
  ).catch(() => undefined);
  await shared.run(
    async () => { rejectedStarts += 1; return a; },
    () => { rejectedReady += 1; },
  );
  ok("failed_startup_does_not_false_bind", rejectedReady === 1);
  ok("failed_startup_can_retry", rejectedStarts === 2);

  const passed = checks.filter((check) => check.pass).length;
  for (const check of checks) console.log(`${check.pass ? "ok" : "not ok"} ${check.name}`);
  console.log(`panel binding selftest: ${passed}/${checks.length}`);
  if (passed !== checks.length) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
