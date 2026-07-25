import { PanelBackendBinding, type PanelBackendDescriptor } from "./panelBinding";

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

ok("first_bind_renders", binding.bind(a, render) && renders.length === 1);
ok("same_identity_does_not_reload", !binding.bind(a, render) && renders.length === 1);
ok("replacement_port_reloads_once", binding.bind(b, render) && renders.length === 2);
ok("same_port_new_token_reloads", binding.bind(samePortNewSession, render) && renders.length === 3);
binding.reset();
ok("restored_panel_reset_rebinds", binding.bind(samePortNewSession, render) && renders.length === 4);

const passed = checks.filter((check) => check.pass).length;
for (const check of checks) console.log(`${check.pass ? "ok" : "not ok"} ${check.name}`);
console.log(`panel binding selftest: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exitCode = 1;
