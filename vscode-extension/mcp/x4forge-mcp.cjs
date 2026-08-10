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
const crypto = require("node:crypto");

const BASE = (process.env.X4FORGE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const KEY = (process.env.X4FORGE_KEY || "").trim();
const WORKSPACE_ID = (process.env.X4FORGE_WORKSPACE_ID || "").trim();

const SERVER_INFO = { name: "x4forge", version: "0.1.0" };
const PROTOCOL_VERSION = "2024-11-05";
const CAPABILITY_DISCOVERY_TIMEOUT_MS = 2000;
const CAPABILITY_RETRY_MS = Math.max(100, Number(process.env.X4FORGE_CAPABILITY_RETRY_MS) || 5000);
const EFFECTIVE_AUTHORITY_API_VERSION = "2026-08-01.agent-effective.v1";
const EFFECTIVE_AUTHORITY_SCHEMA_VERSION = "forge.agent-capability-authority.v1";
const ROUTE_AUTHORITY_VERSION = "forge.route-dispositions.v4";
const RUNTIME_EXPECT_MAX_LENGTH = 256;
const RUNTIME_MAX_INCIDENTS = 8;
const RUNTIME_MAX_EXPECTED_STEPS = 16;
const RUNTIME_MAX_EVIDENCE_ITEMS = 5;
const RUNTIME_MAX_STRING_ARRAY_ITEMS = 16;
const RUNTIME_MAX_COUNT = 1_000_000;
const RUNTIME_MAX_LINE = 1_000_000_000;

/** Curated tool surface — additions require the B56s4 security review, not just code. */
const TOOLS = [
  {
    name: "validate_mod",
    capabilityId: "project.validate",
    capabilityVersion: 1,
    description:
      "Run the Forge's full validation stack over a mod folder under the configured Mod Workspace root. Returns status, per-layer summary, source files, and at most the first 100 flat findings; use the Agent API for an untruncated result.",
    inputSchema: {
      type: "object",
      properties: { fromPath: { type: "string", description: "Mod folder name under the Mod Workspace root, e.g. x4_ai_influence" } },
      required: ["fromPath"],
      additionalProperties: false,
    },
    handler: async (args, context) => {
      const d = await forgeValidation(context, { fromPath: String(args.fromPath || "") });
      return { ok: d.ok, summary: d.summary, findings: (d.flat || []).slice(0, 100), files: d.source?.loaded, root: d.source?.root };
    },
  },
  {
    name: "list_schema_domains",
    capabilityId: "schema.domains.list",
    capabilityVersion: 1,
    description: "List every game XSD domain the Forge discovered (factions, gamestarts, diff, md, …) with include-chain counts — a compact vocabulary map for X4 file types.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const d = requireResponse(await forge("GET", "/api/agent/schema-registry"), "schema registry", {
        roots: "array", domainCount: "number", domains: "array",
      });
      return { roots: d.roots, domains: (d.domains || []).map((x) => ({ domain: x.domain, includes: (x.includes || []).length, missingIncludes: x.missingIncludes })) };
    },
  },
  {
    name: "get_workspace",
    capabilityId: "workspace.read",
    capabilityVersion: 2,
    description: "Read a bounded summary of the explicitly bound Forge workspace, including its content CAS hash, complete snapshot hash, name/version, counts, and up to 50 node summaries. Authority comes from X4FORGE_WORKSPACE_ID plus the key binding.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async (_input, context) => {
      const legacyProjection = usesStaticCompatibilityRoutes(context);
      const d = requireResponse(await forge("GET", "/api/agent/workspace"), "workspace", {
        workspaceId: "string", workspace: "object", version: "number", workspaceHash: "string",
        ...(legacyProjection ? {} : { snapshotHash: "string" }), lastUpdated: "string", origin: "string",
      });
      const ws = d.workspace || d;
      return {
        name: ws.name, version: d.version, workspaceHash: d.workspaceHash,
        ...(legacyProjection ? { snapshotHashAvailable: false, compatibility: "workspace.read@1" } : { snapshotHash: d.snapshotHash }),
        nodes: (ws.nodes || []).length, links: (ws.links || []).length,
        nodeSummary: (ws.nodes || []).slice(0, 50).map((n) => ({ id: n.id, tag: n.xmlTag, label: n.label })),
      };
    },
  },
  {
    name: "compile_workspace",
    capabilityId: "workspace.compile",
    capabilityVersion: 1,
    description: "Compile the explicitly bound workspace to an in-memory file manifest and return file names plus a bounded validator summary. This does not write or package the mod.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const d = requireResponse(await forge("POST", "/api/agent/compile", {}), "workspace compile", {
        success: "boolean", modId: "string", file_count: "number", files: "object", diagnostics: "array", validation: "object",
      });
      return { modId: d.modId, files: Object.keys(d.files || {}), diagnostics: (d.diagnostics || []).slice(0, 100) };
    },
  },
  {
    name: "author_check",
    capabilityId: "project.validate",
    capabilityVersion: 1,
    description:
      "Validate draft file contents before writing anything to disk. Returns status, summary, at most 100 findings, and at most 50 repair capsules; use the Agent API for an untruncated result.",
    inputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "Draft files as {path, content} — paths relative to the mod root, e.g. md/my_script.xml",
          items: {
            type: "object",
            properties: { path: { type: "string" }, content: { type: "string" } },
            required: ["path", "content"],
            additionalProperties: false,
          },
        },
      },
      required: ["files"],
      additionalProperties: false,
    },
    handler: async (args, context) => {
      const files = (args.files || []).map((f) => ({ path: String(f.path || ""), content: String(f.content || "") }));
      const d = await forgeValidation(context, {
        project: { id: "author_check", name: "author_check", files },
      });
      return { ok: d.ok, summary: d.summary, findings: (d.flat || []).slice(0, 100), capsules: (d.capsules || []).slice(0, 50) };
    },
  },
  {
    name: "stage_and_validate",
    capabilityId: "project.validate",
    capabilityVersion: 1,
    description:
      "Validate a mod folder on disk and return status, summary, source files, and at most 100 remediation capsules. A clean bounded response is authoritative only when the returned summary/status is clean; use the Agent API for an untruncated result.",
    inputSchema: {
      type: "object",
      properties: { fromPath: { type: "string", description: "Mod folder name under the Mod Workspace root" } },
      required: ["fromPath"],
      additionalProperties: false,
    },
    handler: async (args, context) => {
      const d = await forgeValidation(context, { fromPath: String(args.fromPath || "") });
      return { ok: d.ok, summary: d.summary, capsules: (d.capsules || []).slice(0, 100), files: d.source?.loaded, root: d.source?.root };
    },
  },
  {
    name: "readiness",
    capabilityId: "readiness.read",
    capabilityVersion: 1,
    description:
      "The Forge readiness ladder as machine truth — graph/package/deployed/seen/experience stages with evidence. THIS is the only legitimate 'done' claim: a change is complete when the machine stages pass. The experience stage flips only on the user's own screen; never claim it.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => requireResponse(await forge("GET", "/api/agent/readiness"), "readiness", {
      workspaceId: "string", workspace: "string", modId: "string", stages: "array", note: "string",
    }),
  },
  {
    name: "runtime_debugger",
    capabilityId: "runtime.debug.read",
    capabilityVersion: 1,
    description:
      "Read the addressed workspace's bounded deterministic runtime-debugger payload. Returns schema, authority, session, verdict, coverage, expected steps, ambiguity, hidden unrelated-extension evidence, and bounded source-navigation evidence; it never returns the whole log or accepts a log path.",
    inputSchema: {
      type: "object",
      properties: {
        expect: {
          type: "string",
          maxLength: RUNTIME_EXPECT_MAX_LENGTH,
          description: "Optional bounded comma-separated expected cue or marker names.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const query = new URLSearchParams();
      const expect = typeof args?.expect === "string" ? args.expect.trim() : "";
      if (expect.length > RUNTIME_EXPECT_MAX_LENGTH) {
        throw new Error(`runtime debugger expect must be at most ${RUNTIME_EXPECT_MAX_LENGTH} characters`);
      }
      if (expect) query.set("expect", expect);
      const d = requireRuntimeDebuggerResponse(
        await forge("GET", `/api/agent/runtime-debugger?${query}`),
        "runtime debugger",
      );
      return projectRuntimeDebugger(d);
    },
  },
  {
    name: "check_conflicts",
    capabilityId: "extensions.conflicts.analyze",
    capabilityVersion: 1,
    description:
      "Scan installed extensions for dependency, override, and load-order evidence. Returns aggregate counts, load order, and at most the first 50 findings; use the Agent API for the complete finding set.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const d = requireResponse(await forge("GET", "/api/agent/extension-doctor"), "extension doctor", {
        success: "boolean", extensionsScanned: "number", enabledCount: "number", findings: "array",
      });
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
    capabilityId: "patch.readiness.analyze",
    capabilityVersion: 2,
    description:
      "Check a mod's <diff> selectors against old and current game data. Returns summary data plus at most 50 findings filtered to broken or removed targets; use the Agent API for all verdicts.",
    inputSchema: {
      type: "object",
      properties: {
        fromPath: { type: "string", description: "Mod folder name under the Mod Workspace root" },
        oldRoot: { type: "string", description: "Path to the PREVIOUS game version's data (unpacked or install) to compare against" },
        newRoot: { type: "string", description: "Path to the new game version's data (default: the configured game path)" },
      },
      required: ["fromPath", "oldRoot"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const q = new URLSearchParams({ fromPath: String(args.fromPath || ""), oldRoot: String(args.oldRoot || "") });
      if (args.newRoot) q.set("newRoot", String(args.newRoot));
      const d = requireResponse(await forge("GET", `/api/agent/patch-readiness?${q}`), "patch readiness", {
        oldRoot: "string", newRoot: "string", diffFiles: "number", summary: "object", findings: "array",
      });
      return {
        diffFiles: d.diffFiles,
        summary: d.summary,
        broken: (d.findings || []).filter((f) => f.verdict === "broken" || f.verdict === "target_file_removed").slice(0, 50),
      };
    },
  },
  {
    name: "explain_element",
    capabilityId: "schema.element.explain",
    capabilityVersion: 1,
    description: "Explain an X4 MD/AIScript XML element: schema-declared attributes (required/enums) plus the Forge's curated deterministic semantics (what it does, risk class).",
    inputSchema: {
      type: "object",
      properties: {
        tag: { type: "string", description: "Element name, e.g. create_ship" },
        file: { type: "string", description: "Context file path (routes to the right schema), e.g. md/story.xml", default: "md/x.xml" },
      },
      required: ["tag"],
      additionalProperties: false,
    },
    handler: async (args, context) => {
      const q = new URLSearchParams({ file: String(args.file || "md/x.xml"), tag: String(args.tag || "") });
      if (!usesStaticCompatibilityRoutes(context)) {
        return requireResponse(await forge("GET", `/api/agent/lang/element-explain?${q}`), "element explanation", {
          domain: "string", tag: "string", known: "boolean", requiredAttrs: "array", attrCount: "number", attrs: "array",
        });
      }
      const hover = requireResponse(await forge("GET", `/api/agent/lang/hover?${q}`), "element hover", {
        domain: "string", tag: "string", known: "boolean", requiredAttrs: "array", attrCount: "number",
      });
      const attrs = requireResponse(await forge("GET", `/api/agent/lang/attrs?${q}`), "element attributes", { attrs: "array" });
      return { ...hover, attrs: attrs.attrs };
    },
  },
];
const STATIC_TOOL_NAMES = new Set(TOOLS.map((tool) => tool.name));
STATIC_TOOL_NAMES.delete("runtime_debugger");

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function schemaValueError(schema, value, location = "arguments") {
  if (Array.isArray(schema?.anyOf) && !schema.anyOf.some((candidate) => !schemaValueError(candidate, value, location))) {
    return `${location} does not match any allowed schema`;
  }
  if (Array.isArray(schema?.enum) && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    return `${location} is not an allowed value`;
  }
  const types = schema?.type === undefined ? [] : (Array.isArray(schema.type) ? schema.type : [schema.type]);
  if (types.length) {
    const matches = types.some((type) => type === "null" ? value === null
      : type === "array" ? Array.isArray(value)
      : type === "object" ? !!value && typeof value === "object" && !Array.isArray(value)
      : type === "integer" ? Number.isInteger(value)
      : type === "number" ? typeof value === "number" && Number.isFinite(value)
      : typeof value === type);
    if (!matches) return `${location} must be ${types.join(" or ")}`;
  }
  if (typeof value === "string" && typeof schema?.maxLength === "number" &&
    schema.maxLength >= 0 && schema.maxLength % 1 === 0 && value.length > schema.maxLength) {
    return `${location} must be at most ${schema.maxLength} characters`;
  }
  if (schema?.type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) return `${location}.${key} is required`;
    for (const [key, child] of Object.entries(value)) {
      const properties = schema.properties;
      const childSchema = properties && Object.hasOwn(properties, key) ? properties[key] : undefined;
      if (childSchema !== undefined) {
        const error = schemaValueError(childSchema, child, `${location}.${key}`);
        if (error) return error;
      } else if (schema.additionalProperties === false) return `${location}.${key} is not allowed`;
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        const error = schemaValueError(schema.additionalProperties, child, `${location}.${key}`);
        if (error) return error;
      }
    }
  }
  if (schema?.type === "array" && Array.isArray(value) && schema.items) {
    for (let index = 0; index < value.length; index += 1) {
      const error = schemaValueError(schema.items, value[index], `${location}[${index}]`);
      if (error) return error;
    }
  }
  return null;
}

function requireResponse(value, label, fields = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    const error = new Error(`${label} returned no valid JSON object`);
    error.invalidResponse = true;
    throw error;
  }
  for (const [field, type] of Object.entries(fields)) {
    const candidate = value[field];
    const valid = type === "array" ? Array.isArray(candidate)
      : type === "object" ? !!candidate && typeof candidate === "object" && !Array.isArray(candidate)
      : typeof candidate === type;
    if (!valid) {
      const error = new Error(`${label} response is missing ${field}:${type}`);
      error.invalidResponse = true;
      throw error;
    }
  }
  return value;
}

function requireRuntimeDebuggerResponse(value, label) {
  const payload = requireResponse(value, label, {
    schemaVersion: "number", authority: "object", identity: "object", session: "object",
    incidents: "array", coverage: "object", expectedSteps: "array",
    hiddenOtherModCount: "number", ambiguousCount: "number", hiddenOtherModSummary: "string", verdict: "object",
  });
  const invalid = (field, type) => {
    const error = new Error(`${label} response is missing ${field}:${type}`);
    error.invalidResponse = true;
    throw error;
  };
  if (typeof payload.authority.workspaceId !== "string") invalid("authority.workspaceId", "string");
  if (typeof payload.identity.workspaceId !== "string") invalid("identity.workspaceId", "string");
  if (typeof payload.session.state !== "string") invalid("session.state", "string");
  if (typeof payload.verdict.state !== "string") invalid("verdict.state", "string");
  if (typeof payload.coverage.target !== "number" || !Number.isFinite(payload.coverage.target)) {
    invalid("coverage.target", "number");
  }
  if (typeof payload.coverage.met !== "boolean") invalid("coverage.met", "boolean");
  for (const field of [
    "candidates", "recognized", "explicitUnknown", "silentlyDropped",
    "recognizedOrExplicitUnknown", "dispositionSum",
  ]) {
    if (typeof payload.coverage[field] !== "number" || !Number.isFinite(payload.coverage[field])) {
      invalid(`coverage.${field}`, "number");
    }
  }
  if (typeof payload.coverage.recognizedOrExplicitUnknownRatio !== "number" ||
    !Number.isFinite(payload.coverage.recognizedOrExplicitUnknownRatio)) {
    invalid("coverage.recognizedOrExplicitUnknownRatio", "number");
  }
  if (!isRecord(payload.coverage.dispositionCounts)) invalid("coverage.dispositionCounts", "object");
  for (const field of ["confirmed_active", "ambiguous", "excluded_other_mod", "unknown"]) {
    if (typeof payload.coverage.dispositionCounts[field] !== "number" ||
      !Number.isFinite(payload.coverage.dispositionCounts[field])) {
      invalid(`coverage.dispositionCounts.${field}`, "number");
    }
  }
  return payload;
}

function runtimeText(value, limit = 360) {
  let text = typeof value === "string" ? value : value == null ? "" : String(value);
  const roots = [process.env.USERPROFILE, process.env.HOME]
    .filter((root) => typeof root === "string" && root.trim())
    .map((root) => root.trim())
    .filter((root, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === root.toLowerCase()) === index);
  for (const root of roots) {
    const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`${escaped}(?=$|[\\\\/])`, "gi"), "%USERPROFILE%");
  }
  text = text.replace(/(?:[A-Za-z]:[\\/]Users[\\/][^\\/]+|[\\/]Users[\\/][^\\/]+|[\\/]home[\\/][^\\/]+|[A-Za-z]:[\\/]Documents and Settings[\\/][^\\/]+)/gi, "%USERPROFILE%");
  const boundedLimit = Math.max(1, Math.floor(limit));
  return text.length <= boundedLimit ? text : `${text.slice(0, Math.max(0, boundedLimit - 1))}…`;
}

function runtimeStringArray(value, count, limit = 280) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => typeof item === "string")
    .map((item) => runtimeText(item, limit).trim())
    .filter(Boolean)
    .slice(0, count);
}

function runtimeOptionalText(value, limit = 360) {
  if (typeof value !== "string") return undefined;
  const text = runtimeText(value, limit).trim();
  return text || undefined;
}

function runtimeCount(value, limit = RUNTIME_MAX_COUNT) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(limit, Math.max(0, Math.floor(value)));
}

function runtimeLine(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(RUNTIME_MAX_LINE, Math.floor(value)) : undefined;
}

function runtimeRatio(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function projectRuntimeIncident(incident) {
  const attribution = incident?.attribution && typeof incident.attribution === "object" ? incident.attribution : {};
  const mapping = incident?.mapping && typeof incident.mapping === "object" ? incident.mapping : {};
  const disposition = ["confirmed_active", "ambiguous", "excluded_other_mod", "unknown"].includes(attribution.disposition)
    ? attribution.disposition : "unknown";
  const mappingKind = ["node", "file_line", "unmapped"].includes(mapping.kind) ? mapping.kind : "unmapped";
  const nodeId = runtimeOptionalText(mapping.nodeId, 180);
  const nodeLabel = runtimeOptionalText(mapping.nodeLabel, 280);
  const file = runtimeOptionalText(mapping.file, 300);
  const line = runtimeLine(mapping.line);
  const navigationEvidence = disposition === "confirmed_active" && mappingKind === "node" && nodeId
    ? { kind: "md_node", nodeId, ...(nodeLabel ? { nodeLabel } : {}), actionLabel: "OPEN DEEPEST NODE" }
    : disposition === "confirmed_active" && mappingKind === "file_line" && file && line
      ? { kind: "file_line", file, sourceLine: line, nativeLine: Math.max(0, line - 1), actionLabel: "OPEN FILE IN NATIVE EDITOR" }
      : undefined;
  return {
    key: runtimeText(incident?.key, 180),
    count: Math.max(1, runtimeCount(incident?.count)),
    ...(runtimeLine(incident?.firstLine) ? { firstLine: runtimeLine(incident.firstLine) } : {}),
    ...(runtimeLine(incident?.lastLine) ? { lastLine: runtimeLine(incident.lastLine) } : {}),
    ...(runtimeOptionalText(incident?.classification, 180) ? { classification: runtimeOptionalText(incident.classification, 180) } : {}),
    ...(runtimeOptionalText(incident?.severity, 32) ? { severity: runtimeOptionalText(incident.severity, 32) } : {}),
    isEngineFailure: incident?.isEngineFailure === true,
    disposition,
    unresolved: disposition === "ambiguous" || disposition === "unknown",
    attributionReason: runtimeText(attribution.reason, 360),
    evidence: runtimeStringArray(incident?.evidence, RUNTIME_MAX_EVIDENCE_ITEMS),
    explanation: {
      cause: runtimeText(incident?.explanation?.cause, 360),
      impact: runtimeText(incident?.explanation?.impact, 360),
      nextAction: runtimeText(incident?.explanation?.nextAction, 360),
      summary: runtimeText(incident?.explanation?.summary, 360),
      evidenceLabel: runtimeText(incident?.explanation?.evidenceLabel, 280),
    },
    mapping: {
      kind: mappingKind,
      ...(file ? { file } : {}),
      ...(line ? { line } : {}),
      ...(nodeId ? { nodeId } : {}),
      ...(nodeLabel ? { nodeLabel } : {}),
      reason: runtimeText(mapping.reason, 360),
    },
    ...(navigationEvidence ? { navigationEvidence } : {}),
  };
}

function projectRuntimeDebugger(payload) {
  const authority = payload.authority || {};
  const identity = payload.identity || {};
  const session = payload.session || {};
  const verdict = payload.verdict || {};
  const coverage = payload.coverage || {};
  return {
    schemaVersion: runtimeCount(payload.schemaVersion, 1_000),
    authority: {
      workspaceId: runtimeText(authority.workspaceId, 180),
      displayName: runtimeText(authority.displayName, 180),
      ...(runtimeOptionalText(authority.contentId, 180) ? { contentId: runtimeOptionalText(authority.contentId, 180) } : {}),
    },
    identity: {
      workspaceId: runtimeText(identity.workspaceId, 180),
      contentIds: runtimeStringArray(identity.contentIds, RUNTIME_MAX_STRING_ARRAY_ITEMS, 180),
      deployedFolders: runtimeStringArray(identity.deployedFolders, RUNTIME_MAX_STRING_ARRAY_ITEMS, 180),
      ownedFileCount: runtimeCount(identity.ownedFileCount),
      inventoryComplete: identity.inventoryComplete === true,
      inventoryOtherExtensionCount: runtimeCount(identity.inventoryOtherExtensionCount),
      ...(runtimeOptionalText(identity.inventoryScannedAt, 64) ? { inventoryScannedAt: runtimeOptionalText(identity.inventoryScannedAt, 64) } : {}),
    },
    session: {
      state: ["current", "historical", "unavailable"].includes(session.state) ? session.state : "unavailable",
      ...(runtimeOptionalText(session.sessionId, 180) ? { sessionId: runtimeOptionalText(session.sessionId, 180) } : {}),
      ...(typeof session.generation === "number" && Number.isFinite(session.generation) ? { generation: runtimeCount(session.generation) } : {}),
      ...(runtimeLine(session.firstLine) ? { firstLine: runtimeLine(session.firstLine) } : {}),
      ...(runtimeLine(session.lastLine) ? { lastLine: runtimeLine(session.lastLine) } : {}),
      ...(typeof session.newlyReadBytes === "number" && Number.isFinite(session.newlyReadBytes) ? { newlyReadBytes: runtimeCount(session.newlyReadBytes) } : {}),
      ...(runtimeOptionalText(session.resetReason, 280) ? { resetReason: runtimeOptionalText(session.resetReason, 280) } : {}),
      ...(runtimeOptionalText(session.observedAt, 64) ? { observedAt: runtimeOptionalText(session.observedAt, 64) } : {}),
      detail: runtimeText(session.detail, 360),
    },
    verdict: {
      state: runtimeText(verdict.state, 48),
      detail: runtimeText(verdict.detail, 360),
      errorCount: runtimeCount(verdict.errorCount),
      currentSession: verdict.currentSession === true,
      positiveExecutionEvidence: verdict.positiveExecutionEvidence === true,
      coverageMet: verdict.coverageMet === true,
      unresolvedBlocker: verdict.unresolvedBlocker === true,
    },
    coverage: {
      target: runtimeRatio(coverage.target),
      met: coverage.met === true,
      candidates: runtimeCount(coverage.candidates),
      recognized: runtimeCount(coverage.recognized),
      explicitUnknown: runtimeCount(coverage.explicitUnknown),
      silentlyDropped: runtimeCount(coverage.silentlyDropped),
      recognizedOrExplicitUnknown: runtimeCount(coverage.recognizedOrExplicitUnknown),
      recognizedOrExplicitUnknownRatio: runtimeRatio(coverage.recognizedOrExplicitUnknownRatio),
      dispositionCounts: {
        confirmed_active: runtimeCount(coverage.dispositionCounts?.confirmed_active),
        ambiguous: runtimeCount(coverage.dispositionCounts?.ambiguous),
        excluded_other_mod: runtimeCount(coverage.dispositionCounts?.excluded_other_mod),
        unknown: runtimeCount(coverage.dispositionCounts?.unknown),
      },
      dispositionSum: runtimeCount(coverage.dispositionSum),
    },
    expectedSteps: (Array.isArray(payload.expectedSteps) ? payload.expectedSteps : []).slice(0, RUNTIME_MAX_EXPECTED_STEPS).map((step) => ({
      id: runtimeText(step?.id, 180),
      label: runtimeText(step?.label, 280),
      truth: ["observed", "missing", "unavailable"].includes(step?.truth) ? step.truth : "unavailable",
      observed: step?.observed === true,
      success: step?.success === true,
      evidence: runtimeStringArray(step?.evidence, RUNTIME_MAX_EVIDENCE_ITEMS),
    })),
    incidents: (Array.isArray(payload.incidents) ? payload.incidents : []).slice(0, RUNTIME_MAX_INCIDENTS).map(projectRuntimeIncident),
    hiddenOtherModCount: runtimeCount(payload.hiddenOtherModCount),
    ambiguousCount: runtimeCount(payload.ambiguousCount),
    hiddenOtherModSummary: runtimeText(payload.hiddenOtherModSummary, 360),
  };
}

async function forgeValidation(context, body) {
  if (usesStaticCompatibilityRoutes(context)) {
    return requireResponse(await forge("POST", "/api/agent/project/validate", body), "project validation", {
      ok: "boolean", summary: "object", flat: "array", capsules: "array", source: "object",
    });
  }
  return requireResponse(await forge("POST", "/api/agent/project/validate/check", body), "project validation", {
    ok: "boolean", summary: "object", flat: "array", capsules: "array", source: "object",
  });
}

function usesStaticCompatibilityRoutes(context) {
  return String(context?.contractState || "").endsWith("-static-fallback");
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value, allowed) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && (!allowed || allowed.has(item)));
}

function hasUniqueStrings(values) {
  return new Set(values).size === values.length;
}

function hasExactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isLiteralForgeApiPath(value) {
  if (typeof value !== "string" || !/^\/api(?:\/(?:[A-Za-z0-9._~-]+|:[A-Za-z_][A-Za-z0-9_]*))+$/.test(value)) return false;
  return value.split("/").slice(2).every((segment) => segment !== "." && segment !== "..");
}

function jsonValueMatchesSchema(schema, value, depth = 0) {
  if (depth > 24) return false;
  if (schema.anyOf?.length && !schema.anyOf.some((candidate) => jsonValueMatchesSchema(candidate, value, depth + 1))) return false;
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) return false;
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  const matchesType = (type) => {
    if (type === "null") return value === null;
    if (type === "array") return Array.isArray(value);
    if (type === "object") return isRecord(value);
    if (type === "integer") return typeof value === "number" && Number.isInteger(value);
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    return typeof value === type;
  };
  if (types.length && !types.some(matchesType)) return false;
  if (isRecord(value)) {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) return false;
    for (const [key, child] of Object.entries(value)) {
      const properties = schema.properties;
      const childSchema = properties && Object.hasOwn(properties, key) ? properties[key] : undefined;
      if (childSchema !== undefined) {
        if (!jsonValueMatchesSchema(childSchema, child, depth + 1)) return false;
      } else if (schema.additionalProperties === false) return false;
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object" &&
        !jsonValueMatchesSchema(schema.additionalProperties, child, depth + 1)) return false;
    }
  }
  if (Array.isArray(value) && schema.items && !value.every((child) => jsonValueMatchesSchema(schema.items, child, depth + 1))) return false;
  return true;
}

const JSON_SCHEMA_TYPES = new Set(["array", "boolean", "integer", "null", "number", "object", "string"]);
const CONTEXT_REQUIREMENTS = new Set(["none", "optional", "required"]);
const AGENT_SCOPES = new Set(["read", "write", "deploy"]);
const CAPABILITY_EFFECTS = new Set([
  "read", "analyze", "audit-write", "audit-retention-delete", "workspace-write", "filesystem-write", "package", "deploy", "delete",
  "network", "spend", "credential", "publish",
]);
const CONFIRMATION_POLICIES = new Set(["none", "preview-required", "human-only"]);
const API_INPUT_LOCATIONS = new Set(["none", "query", "body", "path", "path-and-query"]);
const API_BINDING_ROLES = new Set(["primary", "supporting"]);
const SURFACE_STATUSES = new Set(["connected", "partial", "disconnected"]);

function isJsonSchema(value, depth = 0) {
  if (!isRecord(value) || depth > 24) return false;
  if (value.type !== undefined) {
    const types = Array.isArray(value.type) ? value.type : [value.type];
    if (!isStringArray(types, JSON_SCHEMA_TYPES) || types.length === 0 || !hasUniqueStrings(types)) return false;
  }
  if (value.description !== undefined && typeof value.description !== "string") return false;
  if (value.properties !== undefined) {
    if (!isRecord(value.properties) || !Object.values(value.properties).every((schema) => isJsonSchema(schema, depth + 1))) return false;
  }
  if (value.required !== undefined) {
    if (!isStringArray(value.required) || !hasUniqueStrings(value.required)) return false;
    if (value.properties !== undefined && (!isRecord(value.properties) || !value.required.every((key) => Object.hasOwn(value.properties, key)))) return false;
  }
  if (value.additionalProperties !== undefined && typeof value.additionalProperties !== "boolean" &&
    !isJsonSchema(value.additionalProperties, depth + 1)) return false;
  if (value.items !== undefined && !isJsonSchema(value.items, depth + 1)) return false;
  if (value.enum !== undefined && !Array.isArray(value.enum)) return false;
  if (value.anyOf !== undefined) {
    if (!Array.isArray(value.anyOf) || value.anyOf.length === 0 || !value.anyOf.every((schema) => isJsonSchema(schema, depth + 1))) return false;
  }
  return true;
}

function isApiBinding(value) {
  return isRecord(value) && ["GET", "POST"].includes(value.method) && isLiteralForgeApiPath(value.path) &&
    API_INPUT_LOCATIONS.has(value.inputLocation) &&
    API_BINDING_ROLES.has(value.role) &&
    (value.fixedBody === undefined || (isRecord(value.fixedBody) && value.inputLocation === "body"));
}

function schemaDeclaresCallerInput(schema) {
  if (Object.keys(schema.properties || {}).length > 0 || (schema.required?.length || 0) > 0 ||
    schema.additionalProperties === true || (schema.additionalProperties !== undefined && typeof schema.additionalProperties === "object")) return true;
  return schema.anyOf?.some((branch) => schemaDeclaresCallerInput(branch)) === true;
}

function isSurfaceProjection(value) {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !SURFACE_STATUSES.has(value.status)) return false;
  if (value.anchor !== undefined && typeof value.anchor !== "string") return false;
  if (value.note !== undefined && typeof value.note !== "string") return false;
  if (["connected", "partial"].includes(value.status)) {
    if (!isNonEmptyString(value.anchor) || !value.anchor.includes("::")) return false;
  } else if (value.anchor !== undefined) return false;
  if (["partial", "disconnected"].includes(value.status) && !isNonEmptyString(value.note)) return false;
  return true;
}

function isCapabilityDescriptorV1(capability) {
  if (!isRecord(capability) || !isNonEmptyString(capability.id) ||
    !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(capability.id) ||
    !Number.isInteger(capability.version) || capability.version < 1 ||
    !isNonEmptyString(capability.title) || !isNonEmptyString(capability.description) ||
    !isJsonSchema(capability.inputSchema) || capability.inputSchema.type !== "object" ||
    !isJsonSchema(capability.outputSchema) || capability.outputSchema.type !== "object" ||
    !isRecord(capability.outputSchema.properties) || !Array.isArray(capability.outputSchema.required) ||
    capability.outputSchema.required.length === 0 ||
    !isRecord(capability.context) || !CONTEXT_REQUIREMENTS.has(capability.context.workspace) ||
    !CONTEXT_REQUIREMENTS.has(capability.context.profile) ||
    !isRecord(capability.access) || typeof capability.access.public !== "boolean" ||
    capability.access.studioSession !== true || !isStringArray(capability.access.agentScopes, AGENT_SCOPES) ||
    !hasUniqueStrings(capability.access.agentScopes) ||
    !isStringArray(capability.effects, CAPABILITY_EFFECTS) || capability.effects.length === 0 ||
    !hasUniqueStrings(capability.effects) || !CONFIRMATION_POLICIES.has(capability.confirmation) ||
    !Array.isArray(capability.apiBindings) || capability.apiBindings.length === 0 ||
    !capability.apiBindings.every(isApiBinding) || !isRecord(capability.surfaces) ||
    capability.surfaces.agentApi !== true) return false;
  if (capability.access.public && !capability.access.agentScopes.includes("read")) return false;
  const primaryBindings = capability.apiBindings.filter((binding) => binding.role === "primary");
  if (primaryBindings.length !== 1) return false;
  const declaresCallerInput = schemaDeclaresCallerInput(capability.inputSchema);
  if ((primaryBindings[0].inputLocation === "none") === declaresCallerInput) return false;
  const bindingKeys = capability.apiBindings.map((binding) => `${binding.method} ${binding.path}`);
  if (!hasUniqueStrings(bindingKeys)) return false;
  for (const binding of capability.apiBindings) {
    for (const [key, fixedValue] of Object.entries(binding.fixedBody || {})) {
      const property = capability.inputSchema.properties?.[key];
      if (!property || !jsonValueMatchesSchema(property, fixedValue)) return false;
    }
  }
  for (const surface of ["ui", "cli", "mcp", "builtInHarness", "externalAgents"]) {
    const projections = capability.surfaces[surface];
    if (!Array.isArray(projections) || !projections.every(isSurfaceProjection) ||
      !hasUniqueStrings(projections.map((projection) => projection.id))) return false;
  }
  return true;
}

function validateLiveContract(contract) {
  if (
    !isRecord(contract) ||
    !hasExactKeys(contract, ["capabilities", "contractHash", "schemaVersion"]) ||
    contract.schemaVersion !== "forge.capability.v1" ||
    !/^[a-f0-9]{64}$/i.test(String(contract.contractHash || "")) ||
    !Array.isArray(contract.capabilities)
  ) return false;
  const identities = new Set();
  const stableIds = new Set();
  const bindings = new Set();
  const mcpAliases = new Set();
  for (const capability of contract.capabilities) {
    if (!isCapabilityDescriptorV1(capability)) return false;
    const identity = `${capability.id}@${capability.version}`;
    if (identities.has(identity) || stableIds.has(capability.id)) return false;
    identities.add(identity);
    stableIds.add(capability.id);
    for (const binding of capability.apiBindings) {
      const key = `${binding.method} ${binding.path}`;
      if (bindings.has(key)) return false;
      bindings.add(key);
    }
    for (const projection of capability.surfaces.mcp) {
      if (mcpAliases.has(projection.id)) return false;
      mcpAliases.add(projection.id);
    }
  }
  const sortedIds = [...stableIds].sort();
  if (contract.capabilities.some((capability, index) => capability.id !== sortedIds[index])) return false;
  const payload = stableStringify({ schemaVersion: contract.schemaVersion, capabilities: contract.capabilities });
  const expected = crypto.createHash("sha256").update(payload, "utf8").digest("hex");
  return expected === String(contract.contractHash).toLowerCase();
}

function validateEffectiveAuthority(authority, canonicalContract) {
  if (!isRecord(authority) || !hasExactKeys(authority, [
    "actor", "api_version", "authority_hash", "authority_schema_version", "capability_contract",
    "constraint", "exclusions", "route_policy",
  ]) || authority.api_version !== EFFECTIVE_AUTHORITY_API_VERSION ||
    authority.authority_schema_version !== EFFECTIVE_AUTHORITY_SCHEMA_VERSION ||
    !/^[a-f0-9]{64}$/i.test(String(authority.authority_hash || "")) ||
    !isRecord(authority.actor) || !hasExactKeys(authority.actor, ["keyId", "kind", "label", "scope", "workspaceId"]) ||
    authority.actor.kind !== "agent" || !isNonEmptyString(authority.actor.keyId) ||
    !isNonEmptyString(authority.actor.label) || !AGENT_SCOPES.has(authority.actor.scope) ||
    !isNonEmptyString(authority.actor.workspaceId) || authority.actor.workspaceId !== WORKSPACE_ID ||
    !isRecord(authority.route_policy) || !hasExactKeys(authority.route_policy, ["hash", "version"]) ||
    authority.route_policy.version !== ROUTE_AUTHORITY_VERSION ||
    !/^[a-f0-9]{64}$/i.test(String(authority.route_policy.hash || "")) ||
    !validateLiveContract(authority.capability_contract) || !Array.isArray(authority.exclusions)) return false;

  const constraint = authority.constraint;
  if (constraint !== null && (!isRecord(constraint) ||
    !hasExactKeys(constraint, ["allowedEffects", "capabilityIdentities"]) ||
    !isStringArray(constraint.capabilityIdentities) || !hasUniqueStrings(constraint.capabilityIdentities) ||
    !isStringArray(constraint.allowedEffects, CAPABILITY_EFFECTS) || !hasUniqueStrings(constraint.allowedEffects) ||
    stableStringify(constraint.capabilityIdentities) !== stableStringify([...constraint.capabilityIdentities].sort()))) return false;

  const canonicalByIdentity = new Map(canonicalContract.capabilities.map((capability) => [
    `${capability.id}@${capability.version}`, capability,
  ]));
  const effectiveByIdentity = new Map();
  for (const capability of authority.capability_contract.capabilities) {
    const identity = `${capability.id}@${capability.version}`;
    const canonical = canonicalByIdentity.get(identity);
    if (!canonical || stableStringify(canonical) !== stableStringify(capability)) return false;
    effectiveByIdentity.set(identity, capability);
  }

  const allowedEffects = new Set(constraint?.allowedEffects || []);
  const selectedIdentities = new Set(constraint?.capabilityIdentities || []);
  for (const identity of selectedIdentities) {
    const selected = canonicalByIdentity.get(identity);
    if (!selected || selected.access.public || !selected.access.agentScopes.includes(authority.actor.scope)) return false;
  }
  const expectedEffective = canonicalContract.capabilities.filter((capability) => {
    if (!capability.access.agentScopes.includes(authority.actor.scope)) return false;
    if (capability.access.public || constraint === null) return true;
    const identity = `${capability.id}@${capability.version}`;
    return selectedIdentities.has(identity) && capability.effects.every((effect) => allowedEffects.has(effect));
  }).map((capability) => `${capability.id}@${capability.version}`);
  if (stableStringify([...effectiveByIdentity.keys()]) !== stableStringify(expectedEffective)) return false;

  const exclusions = new Map();
  for (const exclusion of authority.exclusions) {
    if (!isRecord(exclusion) || !isNonEmptyString(exclusion.capabilityIdentity) ||
      !["CAPABILITY_ROUTE_UNREVIEWED", "CAPABILITY_OWNER_MISMATCH", "CAPABILITY_SCOPE_DENIED",
        "CAPABILITY_WORKSPACE_REQUIRED", "CAPABILITY_NOT_GRANTED", "CAPABILITY_EFFECT_DENIED"].includes(exclusion.code) ||
      (exclusion.disallowedEffects !== undefined &&
        (!isStringArray(exclusion.disallowedEffects, CAPABILITY_EFFECTS) || !hasUniqueStrings(exclusion.disallowedEffects))) ||
      !hasExactKeys(exclusion, exclusion.disallowedEffects === undefined
        ? ["capabilityIdentity", "code"]
        : ["capabilityIdentity", "code", "disallowedEffects"]) ||
      exclusions.has(exclusion.capabilityIdentity) || !canonicalByIdentity.has(exclusion.capabilityIdentity)) return false;
    exclusions.set(exclusion.capabilityIdentity, exclusion);
  }
  const expectedExcluded = [...canonicalByIdentity.keys()].filter((identity) => !effectiveByIdentity.has(identity));
  if (stableStringify([...exclusions.keys()]) !== stableStringify(expectedExcluded)) return false;

  const unsigned = { ...authority };
  delete unsigned.authority_hash;
  const expectedHash = crypto.createHash("sha256").update(stableStringify(unsigned), "utf8").digest("hex");
  return expectedHash === String(authority.authority_hash).toLowerCase();
}

let discoveryInFlight;
let stickyLiveToolNames = null;
let lastValidContract = null;
let lastValidAuthority = null;
let blockedUntilValidContract = false;
let reviewedLegacyConfirmed = false;
let clientInitialized = false;
let recoveryTimer = null;
let lastAdvertisedToolSignature = null;
const REVIEWED_LEGACY_SCHEMA_API_VERSIONS = new Set([
  "2026-06-10.agent.v2",
  "legacy.agent.v0",
]);

async function loadCapabilityContract() {
  if (discoveryInFlight) return discoveryInFlight;
  const current = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CAPABILITY_DISCOVERY_TIMEOUT_MS);
    try {
      if (!KEY || !WORKSPACE_ID) return { state: "invalid" };
      const schema = await forge("GET", "/api/agent/schema", undefined, controller.signal);
      if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { state: "invalid" };
      if (!("capability_contract" in schema)) {
        if (!REVIEWED_LEGACY_SCHEMA_API_VERSIONS.has(schema.api_version)) return { state: "invalid" };
        try {
          await forge("GET", "/api/agent/capabilities/effective", undefined, controller.signal);
          return { state: "invalid" };
        } catch (error) {
          return Number(error?.status || 0) === 404 ? { state: "legacy" } : { state: "invalid" };
        }
      }
      const canonicalContract = schema.capability_contract;
      if (!validateLiveContract(canonicalContract)) return { state: "invalid" };
      const authority = await forge("GET", "/api/agent/capabilities/effective", undefined, controller.signal);
      return validateEffectiveAuthority(authority, canonicalContract)
        ? { state: "live", contract: authority.capability_contract, authority }
        : { state: "invalid" };
    } catch (error) {
      const status = Number(error?.status || 0);
      return error?.invalidResponse || (status >= 400 && status < 500) ? { state: "invalid" } : { state: "unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  })();
  discoveryInFlight = current;
  try {
    return await current;
  } finally {
    if (discoveryInFlight === current) discoveryInFlight = undefined;
  }
}

async function availableTools() {
  const discovery = await loadCapabilityContract();
  if (discovery.state === "invalid") {
    blockedUntilValidContract = true;
    reviewedLegacyConfirmed = false;
    return { discovery, toolNames: [], effectiveContract: null, contractState: "invalid" };
  }
  if (discovery.state === "live") {
    blockedUntilValidContract = false;
    reviewedLegacyConfirmed = false;
    lastValidContract = discovery.contract;
    lastValidAuthority = discovery.authority;
    const advertised = new Map(discovery.contract.capabilities.map((capability) => [`${capability.id}@${capability.version}`, capability]));
    const supportedNow = new Set();
    for (let toolIndex = 0; toolIndex < TOOLS.length; toolIndex += 1) {
      const capability = advertised.get(`${TOOLS[toolIndex].capabilityId}@${TOOLS[toolIndex].capabilityVersion}`);
      const projection = capability?.surfaces?.mcp?.find((candidate) => candidate.id === TOOLS[toolIndex].name);
      if (projection && projection.status !== "disconnected") supportedNow.add(TOOLS[toolIndex].name);
    }
    stickyLiveToolNames = stickyLiveToolNames === null
      ? supportedNow
      : new Set([...stickyLiveToolNames].filter((name) => supportedNow.has(name)));
    return {
      discovery,
      toolNames: [...stickyLiveToolNames],
      effectiveContract: discovery.contract,
      effectiveAuthority: discovery.authority,
      contractState: discovery.contract.schemaVersion,
    };
  }
  if (blockedUntilValidContract) {
    return { discovery, toolNames: [], effectiveContract: null, contractState: `${discovery.state}-blocked-invalid` };
  }
  if (stickyLiveToolNames !== null) {
    return {
      discovery,
      toolNames: [...stickyLiveToolNames],
      effectiveContract: lastValidContract,
      effectiveAuthority: lastValidAuthority,
      contractState: `${discovery.state}-sticky-live`,
    };
  }
  if (discovery.state === "legacy") {
    reviewedLegacyConfirmed = true;
    return {
      discovery,
      toolNames: [...STATIC_TOOL_NAMES],
      effectiveContract: null,
      effectiveAuthority: null,
      contractState: "legacy-static-fallback",
    };
  }
  if (reviewedLegacyConfirmed) return {
    discovery,
    toolNames: [...STATIC_TOOL_NAMES],
    effectiveContract: null,
    effectiveAuthority: null,
    contractState: `${discovery.state}-legacy-static-fallback`,
  };
  return { discovery, toolNames: [], effectiveContract: null, effectiveAuthority: null, contractState: discovery.state };
}

function toolAvailabilitySignature(availability) {
  const names = availability.toolNames;
  return stableStringify({
    names,
    ...(names.length ? {
      contractState: availability.contractState,
      contractHash: availability.effectiveContract?.contractHash || null,
      authorityHash: availability.effectiveAuthority?.authority_hash || null,
    } : {}),
  });
}

function notifyToolListChanged() {
  if (!clientInitialized) return;
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" })}\n`);
}

function scheduleCapabilityRecovery() {
  if (recoveryTimer) return;
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null;
    try { await resolveAvailableTools(true); } catch { /* the next bounded retry records availability again */ }
  }, CAPABILITY_RETRY_MS);
  recoveryTimer.unref?.();
}

async function resolveAvailableTools(notifyOnChange) {
  const availability = await availableTools();
  const signature = toolAvailabilitySignature(availability);
  if (notifyOnChange && lastAdvertisedToolSignature !== null && signature !== lastAdvertisedToolSignature) {
    notifyToolListChanged();
  }
  lastAdvertisedToolSignature = signature;
  scheduleCapabilityRecovery();
  return availability;
}

async function listTools() {
  const { toolNames, effectiveContract: contract, effectiveAuthority: authority, contractState } = await resolveAvailableTools(true);
  const capabilities = new Map((contract?.capabilities || []).map((capability) => [`${capability.id}@${capability.version}`, capability]));
  const listed = [];
  for (let toolIndex = 0; toolIndex < TOOLS.length; toolIndex += 1) {
    if (!toolNames.includes(TOOLS[toolIndex].name)) continue;
    const capability = capabilities.get(`${TOOLS[toolIndex].capabilityId}@${TOOLS[toolIndex].capabilityVersion}`);
    const projection = capability?.surfaces?.mcp?.find((candidate) => candidate.id === TOOLS[toolIndex].name);
    const legacyWorkspaceRead = contractState.endsWith("legacy-static-fallback") && TOOLS[toolIndex].name === "get_workspace";
    const projectionDescription = legacyWorkspaceRead
      ? "Read a bounded workspace.read@1 compatibility summary from a reviewed legacy Forge server. The legacy response has workspaceHash but no complete snapshotHash; snapshotHashAvailable is false."
      : projection?.status === "partial" && projection.note
      ? `${TOOLS[toolIndex].description} Projection limit: ${projection.note}`
      : TOOLS[toolIndex].description;
    listed.push({
      name: TOOLS[toolIndex].name,
      description: projectionDescription,
      inputSchema: structuredClone(TOOLS[toolIndex].inputSchema),
      _meta: {
        "x4forge/capabilityId": TOOLS[toolIndex].capabilityId,
        "x4forge/capabilityVersion": legacyWorkspaceRead ? 1 : TOOLS[toolIndex].capabilityVersion,
        "x4forge/contractVersion": contractState,
        ...(contract?.contractHash ? { "x4forge/contractHash": contract.contractHash } : {}),
        ...(authority?.authority_hash ? {
          "x4forge/authorityVersion": authority.api_version,
          "x4forge/authorityHash": authority.authority_hash,
        } : {}),
      },
    });
  }
  return listed;
}

async function forge(method, apiPath, body, signal) {
  const headers = { "Content-Type": "application/json" };
  if (KEY) headers.Authorization = `Bearer ${KEY}`;
  if (WORKSPACE_ID) headers["x-workspace-id"] = WORKSPACE_ID;
  const res = await fetch(`${BASE}${apiPath}`, {
    method,
    headers,
    ...(signal ? { signal } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = (data && data.error) || `HTTP ${res.status}`;
    const error = new Error(`Forge API ${apiPath}: ${msg}${res.status === 401 ? " (is X4FORGE_KEY set to a valid agent key?)" : ""}${res.status === 403 ? " (check key scope and its workspace binding)" : ""}${data?.code === 'WORKSPACE_ID_REQUIRED' ? " (set X4FORGE_WORKSPACE_ID to the key-bound workspace)" : ""}`);
    error.status = res.status;
    throw error;
  }
  requireResponse(data, `Forge API ${apiPath}`);
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
      return reply(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: true } }, serverInfo: SERVER_INFO });
    }
    if (method === "notifications/initialized") {
      clientInitialized = true;
      return;
    }
    if ((method || "").startsWith("notifications/")) return; // notifications: no response
    if (method === "ping") return reply(id, {});
    if (method === "tools/list") {
      if (params !== undefined && (!isRecord(params) || Object.keys(params).some((key) => key !== "cursor") ||
        (Object.hasOwn(params, "cursor") && typeof params.cursor !== "string"))) {
        return replyError(id, -32602, "Invalid tools/list params: expected an optional string cursor");
      }
      if (isRecord(params) && Object.hasOwn(params, "cursor")) {
        return replyError(id, -32602, "Invalid tools/list cursor: this one-page inventory did not issue a cursor");
      }
      return reply(id, { tools: await listTools() });
    }
    if (method === "tools/call") {
      if (!isRecord(params) || !isNonEmptyString(params.name) ||
        Object.keys(params).some((key) => key !== "name" && key !== "arguments") ||
        (Object.hasOwn(params, "arguments") && !isRecord(params.arguments))) {
        return replyError(id, -32602, "Invalid tools/call params: expected name and an optional object arguments field");
      }
      const availability = await resolveAvailableTools(true);
      let toolIndex = -1;
      if (availability.toolNames.includes(params?.name)) {
        for (let candidateIndex = 0; candidateIndex < TOOLS.length; candidateIndex += 1) {
          if (TOOLS[candidateIndex].name === params?.name) {
            toolIndex = candidateIndex;
            break;
          }
        }
      }
      if (toolIndex < 0) return replyError(id, -32602, `Unknown tool: ${params?.name}`);
      const toolArguments = params?.arguments ?? {};
      const inputError = schemaValueError(TOOLS[toolIndex].inputSchema, toolArguments);
      if (inputError) return replyError(id, -32602, `Invalid arguments for ${params?.name}: ${inputError}`);
      try {
        const result = await TOOLS[toolIndex].handler(toolArguments, { contractState: availability.contractState });
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

rl.once("close", () => {
  if (recoveryTimer) clearTimeout(recoveryTimer);
});
rl.on("close", () => process.exit(0));
