#!/usr/bin/env node
/**
 * x4forge-mcp.cjs — B56s4 (2026-07-17): a dependency-free MCP (Model Context Protocol)
 * stdio server that exposes a CURATED subset of the X4 Forge agent API as tools for
 * IDE-resident coding agents (Antigravity agent, Claude Code, Codex, …).
 *
 * Security posture (workflow rule 3.6, reviewed at ship time):
 *  - This process LISTENS on nothing — stdio only; it is a CLIENT of the Forge sidecar.
 *  - Auth = a scoped, revocable agent key (mint via "X4 Forge: Create Agent Key");
 *    scope enforcement is SERVER-side (read = GETs only; write adds validate/compile;
 *    deploy tools are deliberately NOT exposed here at all).
 *  - No AI-spend path exists through these tools (generate is not exposed; the Forge
 *    additionally requires external agents to bring their own AI keys).
 *  - Config: X4FORGE_URL + X4FORGE_KEY + the key-bound X4FORGE_WORKSPACE_ID.
 *
 * Wire format: newline-delimited JSON-RPC 2.0 (MCP stdio transport).
 */

"use strict";

const readline = require("node:readline");

const BASE = (process.env.X4FORGE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const KEY = (process.env.X4FORGE_KEY || "").trim();
const WORKSPACE_ID = (process.env.X4FORGE_WORKSPACE_ID || "").trim();

const SERVER_INFO = { name: "x4forge", version: "0.1.0" };
const PROTOCOL_VERSION = "2024-11-05";

/** Curated tool surface — additions require the B56s4 security review, not just code. */
const TOOLS = [
  {
    name: "validate_mod",
    description:
      "Run the Forge's FULL validation stack (structure, cross-file cues, game schemas incl. routed domains, lints) over a mod folder under the configured Mod Workspace root. Returns ok, per-layer summary, and the flat findings list (file/line/severity/code).",
    inputSchema: {
      type: "object",
      properties: { fromPath: { type: "string", description: "Mod folder name under the Mod Workspace root, e.g. x4_ai_influence" } },
      required: ["fromPath"],
    },
    handler: async (args) => {
      const d = await forge("POST", "/api/agent/project/validate", { fromPath: String(args.fromPath || "") });
      return { ok: d.ok, summary: d.summary, findings: (d.flat || []).slice(0, 100), files: d.source?.loaded, root: d.source?.root };
    },
  },
  {
    name: "list_schema_domains",
    description: "List every game XSD domain the Forge discovered (factions, gamestarts, diff, md, …) with include chains — the vocabulary map for X4 file types.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const d = await forge("GET", "/api/agent/schema-registry");
      return { roots: d.roots, domains: (d.domains || []).map((x) => ({ domain: x.domain, includes: (x.includes || []).length, missingIncludes: x.missingIncludes })) };
    },
  },
  {
    name: "get_workspace",
    description: "Read the explicitly bound Forge workspace (nodes, links, name/version). Authority comes from X4FORGE_WORKSPACE_ID plus the key binding.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const d = await forge("GET", "/api/agent/workspace");
      const ws = d.workspace || d;
      return { name: ws.name, version: d.version, nodes: (ws.nodes || []).length, links: (ws.links || []).length, nodeSummary: (ws.nodes || []).slice(0, 50).map((n) => ({ id: n.id, tag: n.xmlTag, label: n.label })) };
    },
  },
  {
    name: "compile_workspace",
    description: "Compile the explicitly bound workspace to its mod package and return the generated file list plus validator diagnostics.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const d = await forge("POST", "/api/agent/compile", {});
      return { modId: d.modId, files: Object.keys(d.files || {}), diagnostics: (d.diagnostics || []).slice(0, 100) };
    },
  },
  {
    name: "author_check",
    description:
      "Validate DRAFT file contents BEFORE writing anything to disk — the full Forge validator stack over an inline payload. Use this on every draft; only write files that come back clean (or whose findings you are about to fix).",
    inputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "Draft files as {path, content} — paths relative to the mod root, e.g. md/my_script.xml",
          items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
        },
      },
      required: ["files"],
    },
    handler: async (args) => {
      const files = (args.files || []).map((f) => ({ path: String(f.path || ""), content: String(f.content || "") }));
      const d = await forge("POST", "/api/agent/project/validate", {
        project: { id: "author_check", name: "author_check", files },
      });
      return { ok: d.ok, summary: d.summary, findings: (d.flat || []).slice(0, 100), capsules: (d.capsules || []).slice(0, 50) };
    },
  },
  {
    name: "stage_and_validate",
    description:
      "Validate a mod folder on disk and return REMEDIATION CAPSULES — the same structured repair packet the Forge's own repair loop uses (stable signature, file/line, message, hints). Fix every capsule, then call again until none remain.",
    inputSchema: {
      type: "object",
      properties: { fromPath: { type: "string", description: "Mod folder name under the Mod Workspace root" } },
      required: ["fromPath"],
    },
    handler: async (args) => {
      const d = await forge("POST", "/api/agent/project/validate", { fromPath: String(args.fromPath || "") });
      return { ok: d.ok, summary: d.summary, capsules: (d.capsules || []).slice(0, 100), files: d.source?.loaded, root: d.source?.root };
    },
  },
  {
    name: "readiness",
    description:
      "The Forge readiness ladder as machine truth — graph/package/deployed/seen/experience stages with evidence. THIS is the only legitimate 'done' claim: a change is complete when the machine stages pass. The experience stage flips only on the user's own screen; never claim it.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => forge("GET", "/api/agent/readiness"),
  },
  {
    name: "check_conflicts",
    description:
      "Scan the INSTALLED extensions folder for cross-mod problems: two mods patching the same base file/element (with the load-order WINNER), missing required dependencies, and load-order issues. Uses the Forge's Extension Doctor + element-level override analysis.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const d = await forge("GET", "/api/agent/extension-doctor");
      return {
        extensionsScanned: d.extensionsScanned,
        enabledCount: d.enabledCount,
        counts: d.counts,
        loadOrder: d.loadOrder,
        findings: (d.findings || []).slice(0, 50).map((f) => ({
          severity: f.severity, code: f.code, file: f.filePath, message: f.message,
        })),
      };
    },
  },
  {
    name: "check_patch_readiness",
    description:
      "Patch-day readiness: check whether a mod's <diff> patch SELECTORS still match after a game update. Give the path to the OLD game version's data and (optionally) the new one; returns which patches will SILENTLY MISS because the vanilla files changed.",
    inputSchema: {
      type: "object",
      properties: {
        fromPath: { type: "string", description: "Mod folder name under the Mod Workspace root" },
        oldRoot: { type: "string", description: "Path to the PREVIOUS game version's data (unpacked or install) to compare against" },
        newRoot: { type: "string", description: "Path to the new game version's data (default: the configured game path)" },
      },
      required: ["fromPath", "oldRoot"],
    },
    handler: async (args) => {
      const q = new URLSearchParams({ fromPath: String(args.fromPath || ""), oldRoot: String(args.oldRoot || "") });
      if (args.newRoot) q.set("newRoot", String(args.newRoot));
      const d = await forge("GET", `/api/agent/patch-readiness?${q}`);
      return {
        diffFiles: d.diffFiles,
        summary: d.summary,
        broken: (d.findings || []).filter((f) => f.verdict === "broken" || f.verdict === "target_file_removed").slice(0, 50),
      };
    },
  },
  {
    name: "explain_element",
    description: "Explain an X4 MD/AIScript XML element: schema-declared attributes (required/enums) plus the Forge's curated deterministic semantics (what it does, risk class).",
    inputSchema: {
      type: "object",
      properties: {
        tag: { type: "string", description: "Element name, e.g. create_ship" },
        file: { type: "string", description: "Context file path (routes to the right schema), e.g. md/story.xml", default: "md/x.xml" },
      },
      required: ["tag"],
    },
    handler: async (args) => {
      const q = new URLSearchParams({ file: String(args.file || "md/x.xml"), tag: String(args.tag || "") });
      const hover = await forge("GET", `/api/agent/lang/hover?${q}`);
      const attrs = await forge("GET", `/api/agent/lang/attrs?${q}`);
      return { ...hover, attrs: attrs.attrs };
    },
  },
];

async function forge(method, apiPath, body) {
  const headers = { "Content-Type": "application/json" };
  if (KEY) headers.Authorization = `Bearer ${KEY}`;
  if (WORKSPACE_ID) headers["x-workspace-id"] = WORKSPACE_ID;
  const res = await fetch(`${BASE}${apiPath}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = (data && data.error) || `HTTP ${res.status}`;
    throw new Error(`Forge API ${apiPath}: ${msg}${res.status === 401 ? " (is X4FORGE_KEY set to a valid agent key?)" : ""}${res.status === 403 ? " (check key scope and its workspace binding)" : ""}${data?.code === 'WORKSPACE_ID_REQUIRED' ? " (set X4FORGE_WORKSPACE_ID to the key-bound workspace)" : ""}`);
  }
  return data;
}

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}
function replyError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
  const text = line.trim();
  if (!text) return;
  let msg;
  try { msg = JSON.parse(text); } catch { return replyError(null, -32700, "Parse error"); }
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      return reply(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
    }
    if (method === "notifications/initialized" || (method || "").startsWith("notifications/")) return; // notifications: no response
    if (method === "ping") return reply(id, {});
    if (method === "tools/list") {
      return reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    }
    if (method === "tools/call") {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return replyError(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const result = await tool.handler(params?.arguments || {});
        return reply(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (err) {
        return reply(id, { content: [{ type: "text", text: `ERROR: ${err && err.message ? err.message : String(err)}` }], isError: true });
      }
    }
    return replyError(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    return replyError(id, -32603, `Internal error: ${err && err.message ? err.message : String(err)}`);
  }
});
rl.on("close", () => process.exit(0));
