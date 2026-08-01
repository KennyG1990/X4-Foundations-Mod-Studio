/**
 * X4 Forge Studio — VS Code extension controller (proof-of-concept, B41).
 *
 * Thin shell over the EXISTING Forge product: the React app is rendered in a webview
 * (full-bleed iframe to a loopback origin) and the EXISTING Express backend runs as a
 * managed sidecar (dist/server.cjs, NODE_ENV=production) on a dynamically selected
 * loopback port with a per-session bearer token. No core Forge code is imported here
 * and no core file knows this shell exists.
 *
 * Ownership rules (deliberate):
 *  - ATTACH-FIRST: if an already-running Forge answers the agent-schema probe at
 *    x4forge.attachUrl, we attach and NEVER manage (or kill) that process.
 *  - We only ever stop a backend we spawned ourselves.
 *  - Sidecar state (X4_STATE_DIR) defaults to the extension's global storage — never
 *    inside the installed extension (updates wipe it) and never the live checkout's
 *    .studio-state unless the user explicitly configures it.
 */

import * as vscode from "vscode";
import { spawn, type ChildProcess } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import { mapFlatFindings, type FlatFinding } from "./diagnosticsMap";
import { buildXmlAssociations, listModFolders, writeRecommendations, writeXmlAssociations } from "./modFolder";
import { atomicWriteFile, replaceFileSetAtomically } from "./durableWrite";
import { xmlCursorContext } from "./langContext";
import { findCueDefinition, findCueReferences, mdscriptNameOf, parseCueWord } from "./langNav";
import { detectIdeCapabilities, formatIdeCapabilityReport } from "./capabilities";
import { PanelBackendBinding, SharedBackendEnsure } from "./panelBinding";
import {
  copyVerifiedReleaseArtifact,
  inspectNativeWorkshopTool,
  parseNativeEditorRequest,
  resolveExternalUrlLaunch,
  resolveNativeEditorFile,
  resolveSteamTerminalRoot,
  resolveVerifiedReleaseArtifact,
  type NativeNodeSelectionRequest,
  type NativeNodeSelectionResult,
  type NativeReleaseRequest,
  type NativeReleaseResult,
} from "./nativeEditorBridge";

interface BackendHandle {
  baseUrl: string;
  /** true = we spawned it and own its lifecycle; false = attached, hands off. */
  owned: boolean;
  child?: ChildProcess;
  port?: number;
  /** Session token for an OWNED sidecar (attach mode has no credential — by design). */
  token?: string;
  /** Node inspector port when spawned under --inspect (B43); 0 when not debugging. */
  debugPort?: number;
  /** ADR-F5 explicit authority for extension-native API calls. */
  clientId?: string;
  workspaceId?: string;
}

let backend: BackendHandle | null = null;
let panel: vscode.WebviewPanel | null = null;
const panelBinding = new PanelBackendBinding();
const backendEnsurer = new SharedBackendEnsure<BackendHandle>();
let output: vscode.OutputChannel;
let statusItem: vscode.StatusBarItem;
/** Set while deliberately stopping the sidecar so the exit handler stays quiet. */
let stoppingDeliberately = false;

function backendApiHeaders(handle: BackendHandle, json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (handle.token) headers.Authorization = `Bearer ${handle.token}`;
  if (handle.clientId) headers['x-client-id'] = handle.clientId;
  if (handle.workspaceId) headers['x-workspace-id'] = handle.workspaceId;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function bindBackendWorkspace(context: vscode.ExtensionContext, handle: BackendHandle): Promise<void> {
  if (!handle.owned || !handle.token) return;
  handle.clientId ||= `client_extension_${process.pid}_${Date.now().toString(36)}`;
  const saved = context.globalState.get<string>('x4forge.workspaceId') || '';
  const attempt = async (workspaceId: string) => {
    const response = await fetch(`${handle.baseUrl}/api/agent/workspaces/bootstrap`, {
      method: 'POST',
      headers: backendApiHeaders(handle, true),
      body: JSON.stringify({ clientId: handle.clientId, ...(workspaceId ? { workspaceId } : {}) }),
    });
    return { response, body: await response.json() as { workspaceId?: string; code?: string; error?: string } };
  };
  let result = await attempt(saved);
  if (!result.response.ok && saved && ['WORKSPACE_NOT_FOUND', 'WORKSPACE_ID_INVALID'].includes(String(result.body.code || ''))) {
    result = await attempt('');
  }
  if (!result.response.ok || !result.body.workspaceId) throw new Error(result.body.error || `workspace bootstrap failed (${result.response.status})`);
  handle.workspaceId = result.body.workspaceId;
  await context.globalState.update('x4forge.workspaceId', handle.workspaceId);
  log(`workspace authority bound: ${handle.workspaceId}`);
}

function requestManagedSidecarStop(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (child.stdin?.writable) child.stdin.end();
  else child.kill();
  const fallback = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }, 2500);
  fallback.unref();
}

class NativeDiffContentProvider implements vscode.TextDocumentContentProvider {
  private readonly documents = new Map<string, string>();

  create(label: string, content: string, language = "text"): vscode.Uri {
    const extension = ({ xml: "xml", lua: "lua", json: "json", markdown: "md" } as Record<string, string>)[language] || "txt";
    const safeLabel = label.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "preview";
    const uri = vscode.Uri.parse(`x4forge-preview:/${crypto.randomBytes(12).toString("hex")}/${safeLabel}.${extension}`);
    this.documents.set(uri.toString(), content);
    while (this.documents.size > 24) this.documents.delete(this.documents.keys().next().value as string);
    return uri;
  }

  provideTextDocumentContent(uri: vscode.Uri): string | undefined {
    return this.documents.get(uri.toString());
  }
}

let nativeDiffProvider: NativeDiffContentProvider | null = null;

interface NativeNodeEntry {
  content: Uint8Array;
  token: string;
  nodeIds: string[];
  title: string;
  readOnly: boolean;
  ctime: number;
  mtime: number;
}

class NativeNodeFileSystemProvider implements vscode.FileSystemProvider {
  private readonly entries = new Map<string, NativeNodeEntry>();
  private readonly pending = new Map<string, { uri: vscode.Uri; resolve: (result: NativeNodeSelectionResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private readonly changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this.changeEmitter.event;

  create(request: NativeNodeSelectionRequest): vscode.Uri {
    const key = crypto.createHash('sha1').update(request.nodeIds.join('\0')).digest('hex').slice(0, 12);
    const token = request.token.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'selection';
    const safeTitle = request.title.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'selected-nodes.xml';
    const uri = vscode.Uri.parse(`x4forge-node:/${key}/${token}/${safeTitle.endsWith('.xml') ? safeTitle : `${safeTitle}.xml`}`);
    const now = Date.now();
    const open = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
    if (!open?.isDirty) {
      const existing = this.entries.get(uri.toString());
      this.entries.set(uri.toString(), {
        content: Buffer.from(request.content, 'utf8'), token: request.token, nodeIds: request.nodeIds.slice(), title: request.title,
        readOnly: request.readOnly, ctime: existing?.ctime || now, mtime: now,
      });
      if (existing) this.changeEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }
    while (this.entries.size > 40) {
      const first = this.entries.keys().next().value as string;
      if (vscode.workspace.textDocuments.some(document => document.uri.toString() === first && document.isDirty)) break;
      this.entries.delete(first);
    }
    return uri;
  }

  metadata(uri: vscode.Uri): NativeNodeEntry | undefined { return this.entries.get(uri.toString()); }
  watch(): vscode.Disposable { return new vscode.Disposable(() => undefined); }
  stat(uri: vscode.Uri): vscode.FileStat {
    const entry = this.entries.get(uri.toString());
    if (!entry) throw vscode.FileSystemError.FileNotFound(uri);
    return { type: vscode.FileType.File, ctime: entry.ctime, mtime: entry.mtime, size: entry.content.byteLength, permissions: entry.readOnly ? vscode.FilePermission.Readonly : undefined };
  }
  readDirectory(): [string, vscode.FileType][] { return []; }
  createDirectory(): void { throw vscode.FileSystemError.NoPermissions('Node documents are virtual.'); }
  readFile(uri: vscode.Uri): Uint8Array {
    const entry = this.entries.get(uri.toString());
    if (!entry) throw vscode.FileSystemError.FileNotFound(uri);
    // VS Code/Antigravity's native Revert reloads provider bytes without reliably
    // emitting onDidChangeTextDocument for virtual file-system documents. Clear
    // diagnostics produced by the discarded dirty buffer, then validate the
    // restored provider content after the editor has consumed this read.
    const open = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
    if (open?.isDirty && (diagCollection?.get(uri)?.length || 0) > 0) {
      diagCollection?.delete(uri);
      setTimeout(() => {
        const restored = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
        if (restored) scheduleNodeDocumentValidation(restored, 80);
      }, 80);
    }
    return entry.content;
  }
  async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    const entry = this.entries.get(uri.toString());
    if (!entry) throw vscode.FileSystemError.FileNotFound(uri);
    if (entry.readOnly) throw vscode.FileSystemError.NoPermissions('This selection contains opaque raw XML and is view-only.');
    const activePanel = panel;
    if (!activePanel) throw vscode.FileSystemError.Unavailable('The X4 Forge Studio panel is closed. Reopen it before saving node edits.');
    const requestId = crypto.randomUUID();
    const result = await new Promise<NativeNodeSelectionResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Forge did not answer the node-save request within 30 seconds. Nothing was applied.'));
      }, 30_000);
      this.pending.set(requestId, { uri, resolve, reject, timer });
      void activePanel.webview.postMessage({
        source: 'x4forge-native-host', type: 'apply-node-selection', requestId,
        content: Buffer.from(content).toString('utf8'), token: entry.token, nodeIds: entry.nodeIds,
      });
    });
    if (!result.ok) throw vscode.FileSystemError.Unavailable(result.message);
    entry.content = Buffer.from(result.content ?? Buffer.from(content).toString('utf8'), 'utf8');
    entry.token = result.token || entry.token;
    entry.mtime = Date.now();
    this.changeEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    void vscode.window.setStatusBarMessage(`X4 Forge: ${result.message}`, 8000);
  }
  delete(): void { throw vscode.FileSystemError.NoPermissions('Node documents are virtual.'); }
  rename(): void { throw vscode.FileSystemError.NoPermissions('Node documents are virtual.'); }

  accept(result: NativeNodeSelectionResult): boolean {
    const pending = this.pending.get(result.requestId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(result.requestId);
    pending.resolve(result);
    return true;
  }
}

let nativeNodeProvider: NativeNodeFileSystemProvider | null = null;

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function log(line: string): void {
  output.appendLine(`[${new Date().toISOString()}] ${line}`);
}

function cfg() {
  const c = vscode.workspace.getConfiguration("x4forge");
  return {
    attachUrl: (c.get<string>("attachUrl") || "").trim().replace(/\/+$/, ""),
    forgeRoot: (c.get<string>("forgeRoot") || "").trim(),
    stateDir: (c.get<string>("stateDir") || "").trim(),
    nodePath: (c.get<string>("nodePath") || "").trim(),
    autoOpen: c.get<boolean>("autoOpen") === true,
    debug: ((c.get<string>("debug") || "off").trim() as "off" | "inspect" | "inspect-brk"),
    writeXmlAssociations: c.get<boolean>("writeXmlAssociations") === true,
  };
}

/**
 * Gold-standard debugging: attach the IDE's Node debugger to the sidecar's --inspect port.
 * Works identically in VS Code and Antigravity — both bundle ms-vscode.js-debug (verified),
 * which registers the `node` attach type this config uses. `continueOnAttach` is true for
 * plain --inspect (the process is already running) and false for --inspect-brk (stay paused
 * at the first line so the developer can step through startup).
 */
async function attachSidecarDebugger(debugPort: number, appRoot: string, brk: boolean): Promise<void> {
  try {
    const started = await vscode.debug.startDebugging(undefined, {
      type: "node",
      request: "attach",
      name: "X4 Forge Sidecar",
      address: "127.0.0.1",
      port: debugPort,
      continueOnAttach: !brk,
      sourceMaps: true,
      // When forgeRoot points at a real build, dist/server.cjs.map sits here → TS breakpoints.
      outFiles: [path.join(appRoot, "dist", "**", "*.cjs")],
      skipFiles: ["<node_internals>/**"],
      restart: false,
    });
    log(started
      ? `debugger attached to the sidecar on inspector port ${debugPort} (session "X4 Forge Sidecar")`
      : `debugger attach on port ${debugPort} was not started (is js-debug available in this host?)`);
  } catch (err) {
    log(`debugger attach failed on port ${debugPort}: ${err instanceof Error ? err.message : String(err)} — ` +
      `the inspector is still open; attach manually via chrome://inspect (127.0.0.1:${debugPort}).`);
  }
}

async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Positively identify a Forge backend (not just "some local HTTP server") via the
 * public self-documenting agent schema endpoint.
 */
async function probeForge(baseUrl: string, timeoutMs = 3000): Promise<boolean> {
  const res = await fetchWithTimeout(`${baseUrl}/api/agent/schema`, timeoutMs);
  if (!res || !res.ok) return false;
  try {
    const data = (await res.json()) as { api_version?: unknown; description?: unknown };
    return (
      typeof data.api_version === "string" &&
      typeof data.description === "string" &&
      data.description.includes("X4 Forge")
    );
  } catch {
    return false;
  }
}

/** Ask the OS for a free loopback port. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error("no port assigned"))));
    });
  });
}

/** Verify a node executable actually runs. Returns its version string or null. */
function checkNodeExecutable(nodeExe: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const child = spawn(nodeExe, ["--version"], { windowsHide: true });
      let out = "";
      child.stdout?.on("data", (d) => (out += String(d)));
      child.on("error", () => resolve(null));
      child.on("exit", (code) => resolve(code === 0 ? out.trim() : null));
    } catch {
      resolve(null);
    }
  });
}

function showBackendError(message: string): void {
  log(`ERROR: ${message}`);
  void vscode.window.showErrorMessage(`X4 Forge: ${message}`, "Show Logs").then((pick) => {
    if (pick === "Show Logs") output.show(true);
  });
}

function currentIdeCapabilities() {
  return detectIdeCapabilities({
    installedExtensionIds: vscode.extensions.all.map(extension => extension.id),
    xmlAssociationsEnabled: cfg().writeXmlAssociations,
    backendState: backend ? (backend.owned ? 'managed' : 'attached') : 'stopped',
  });
}

function showIdeCapabilities(): void {
  const lines = formatIdeCapabilityReport(currentIdeCapabilities());
  log('IDE capabilities:');
  for (const line of lines) log(`  ${line}`);
  output.show(true);
  void vscode.window.showInformationMessage('X4 Forge capability report written to the X4 Forge output channel.');
}

// ---------------------------------------------------------------------------
// Backend acquisition: attach-first, then spawn
// ---------------------------------------------------------------------------

/** Resolve the directory containing dist/server.cjs (+ node_modules). */
function resolveAppRoot(context: vscode.ExtensionContext): { root: string; source: string } | null {
  const { forgeRoot } = cfg();
  const candidates: Array<{ root: string; source: string }> = [];
  if (forgeRoot) candidates.push({ root: forgeRoot, source: "x4forge.forgeRoot setting" });
  candidates.push({
    root: vscode.Uri.joinPath(context.extensionUri, "app").fsPath,
    source: "bundled app inside the extension",
  });
  for (const c of candidates) {
    if (fs.existsSync(path.join(c.root, "dist", "server.cjs"))) return c;
    log(`app root candidate rejected (no dist/server.cjs): ${c.root} (${c.source})`);
  }
  return null;
}

function resolveStateDir(context: vscode.ExtensionContext): string {
  const { stateDir } = cfg();
  if (stateDir) return stateDir;
  return path.join(context.globalStorageUri.fsPath, "state");
}

async function spawnSidecar(context: vscode.ExtensionContext): Promise<BackendHandle> {
  const appRoot = resolveAppRoot(context);
  if (!appRoot) {
    throw new Error(
      "No Forge backend found: the extension has no bundled app and x4forge.forgeRoot is not set " +
        "to a built checkout (needs dist/server.cjs). Run the extension's stage-app build or set the setting.",
    );
  }

  const nodeExe = cfg().nodePath || "node";
  const nodeVersion = await checkNodeExecutable(nodeExe);
  if (!nodeVersion) {
    throw new Error(
      `Node.js executable not usable: "${nodeExe}". The Forge sidecar needs a real Node install ` +
        `(its native modules are built for it). Install Node.js or set x4forge.nodePath.`,
    );
  }

  const port = await findFreePort();
  const token = crypto.randomBytes(32).toString("hex");
  const parentNonce = crypto.randomBytes(32).toString('hex');
  const stateDir = resolveStateDir(context);
  fs.mkdirSync(stateDir, { recursive: true });
  // B51: persist the user's Directory Settings (config.json) in global storage, NOT the
  // extension's install dir — the latter is replaced on every extension update, which was
  // wiping the configured game/schema/workspace paths each time the user updated.
  const configDir = path.join(context.globalStorageUri.fsPath, "config");
  fs.mkdirSync(configDir, { recursive: true });
  // B53: the server's runtime-data root (AI keys, agent keys, spend meter, harvested schemas)
  // also persists in global storage — not the install dir the next update wipes.
  const dataDir = path.join(context.globalStorageUri.fsPath, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  // B43: gold-standard debugging — spawn under --inspect and auto-attach the IDE debugger.
  const debugMode = cfg().debug;
  const nodeArgs: string[] = [];
  let debugPort = 0;
  if (debugMode !== "off") {
    debugPort = await findFreePort();
    nodeArgs.push(`--${debugMode}=127.0.0.1:${debugPort}`);
  }

  const supervisorPath = path.join(__dirname, 'sidecar-supervisor.js');
  if (!fs.existsSync(supervisorPath)) {
    throw new Error(`Managed sidecar supervisor is missing: ${supervisorPath}. Rebuild the extension package.`);
  }
  const serverPath = path.join(appRoot.root, 'dist', 'server.cjs');
  log(`spawning supervised sidecar: ${nodeExe} (${nodeVersion}) ${supervisorPath} ${serverPath} ${nodeArgs.join(" ")}`.replace(/\s+/g, " "));
  log(`  app root: ${appRoot.root} (${appRoot.source})`);
  log(`  port: ${port} (dynamically selected)  state dir: ${stateDir}`);
  if (debugPort) log(`  DEBUG: node inspector on 127.0.0.1:${debugPort} (${debugMode})`);

  const child = spawn(nodeExe, [supervisorPath, serverPath, ...nodeArgs], {
    cwd: appRoot.root,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      STUDIO_API_TOKEN: token,
      X4_STATE_DIR: stateDir,
      X4_CONFIG_DIR: configDir, // B51: config.json persists across extension updates
      X4_DATA_DIR: dataDir,     // B53: AI/agent keys, spend meter, harvested schemas persist too
      X4_FORGE_PARENT_MODE: 'pipe-v1',
      X4_FORGE_PARENT_PID: String(process.pid),
      X4_FORGE_PARENT_NONCE: parentNonce,
      // Defense-in-depth: never allow the dev-only shell route in this shell.
      FORGE_ALLOW_RUN_COMMAND: "",
    },
  });
  child.stdout?.on("data", (d) => output.append(String(d)));
  child.stderr?.on("data", (d) => output.append(String(d)));

  const handle: BackendHandle = { baseUrl: `http://127.0.0.1:${port}`, owned: true, child, port, token, debugPort };

  // Attach the debugger right after spawn (the inspector is up at process start). For
  // --inspect-brk the process is paused at entry until this attach + a manual continue.
  if (debugPort) {
    void attachSidecarDebugger(debugPort, appRoot.root, debugMode === "inspect-brk");
  }

  child.on("exit", (code, signal) => {
    log(`sidecar exited (code=${code}, signal=${signal ?? "none"})`);
    const wasCurrent = backend === handle;
    if (backend === handle) backend = null;
    updateStatus();
    if (wasCurrent && !stoppingDeliberately) {
      // Watchdog (2026-07-16): anything can kill a long-lived local process (OOM killer, a
      // stray taskkill, AV software — lived: a broad Stop-Process sweep took out a healthy
      // sidecar mid-session). A ready-then-died backend is restartable by definition, so
      // restart it instead of dead-ending the studio on a manual command.
      void autoRestartSidecar(context, code);
    }
  });
  child.on("error", (err) => {
    log(`sidecar spawn error: ${err.message}`);
  });

  // Readiness: the server must answer its own public schema endpoint.
  const deadline = Date.now() + (debugMode === "off" ? 30_000 : 120_000);
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Forge backend crashed during startup (exit code ${child.exitCode}). See "X4 Forge" output for its logs.`,
      );
    }
    if (await probeForge(handle.baseUrl, 1500)) {
      await bindBackendWorkspace(context, handle);
      log(`sidecar ready at ${handle.baseUrl}`);
      return handle;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  // --inspect-brk pauses the server at entry until the developer continues in the debugger,
  // so a readiness timeout is EXPECTED there — return the handle instead of killing it.
  if (debugMode === "inspect-brk") {
    log(`sidecar is paused at startup (--inspect-brk) — continue execution in the debugger to start the server.`);
    return handle;
  }
  stoppingDeliberately = true;
  try {
    requestManagedSidecarStop(child);
  } finally {
    stoppingDeliberately = false;
  }
  throw new Error("Forge backend did not become ready within 30s. See \"X4 Forge\" output for its logs.");
}

// Sidecar watchdog: auto-restart after an UNEXPECTED exit (deliberate stops set
// stoppingDeliberately and never come here). Capped to RESTART_MAX unexpected exits per
// RESTART_WINDOW_MS so a genuinely-broken backend (boot crash-loop) degrades to the old
// run-Open-Studio-again error instead of spinning forever.
const RESTART_WINDOW_MS = 5 * 60_000;
const RESTART_MAX = 3;
let restartTimestamps: number[] = [];

async function autoRestartSidecar(context: vscode.ExtensionContext, exitCode: number | null): Promise<void> {
  const now = Date.now();
  restartTimestamps = restartTimestamps.filter((t) => now - t < RESTART_WINDOW_MS);
  if (restartTimestamps.length >= RESTART_MAX) {
    showBackendError(
      `The Forge backend exited unexpectedly (code ${exitCode ?? "?"}) and auto-restart gave up ` +
        `after ${RESTART_MAX} attempts in 5 minutes. See "X4 Forge" output for its logs, then run ` +
        `"X4 Forge: Open Studio" again.`,
    );
    return;
  }
  restartTimestamps.push(now);
  const attempt = restartTimestamps.length;
  log(`sidecar exited unexpectedly (code ${exitCode ?? "?"}) — auto-restarting (attempt ${attempt}/${RESTART_MAX})`);
  await new Promise((r) => setTimeout(r, 1000 * attempt)); // linear backoff: 1s, 2s, 3s
  if (backend || stoppingDeliberately) return; // already replaced, or a stop raced the backoff
  try {
    const handle = await ensureBackend(context);
    log(`sidecar auto-restarted at ${handle.baseUrl}`);
    void vscode.window.showInformationMessage(
      "X4 Forge: the backend stopped unexpectedly and was restarted automatically.",
    );
  } catch (err) {
    showBackendError(
      `The Forge backend exited unexpectedly and auto-restart failed: ` +
        `${err instanceof Error ? err.message : String(err)} — run "X4 Forge: Open Studio" again.`,
    );
  }
}

async function ensureBackend(context: vscode.ExtensionContext): Promise<BackendHandle> {
  return backendEnsurer.run(
    () => ensureBackendOnce(context),
    (handle) => { bindStudioPanel(handle); },
  );
}

async function ensureBackendOnce(context: vscode.ExtensionContext): Promise<BackendHandle> {
  // Reuse a live handle.
  if (backend) {
    if (await probeForge(backend.baseUrl, 2000)) return backend;
    log(`existing backend at ${backend.baseUrl} no longer answers; discarding handle`);
    if (backend.owned && backend.child && backend.child.exitCode === null) {
      stoppingDeliberately = true;
      try {
        requestManagedSidecarStop(backend.child);
      } finally {
        stoppingDeliberately = false;
      }
    }
    backend = null;
  }

  // Attach-first: an already-running Forge (e.g. the standalone dev stack) wins.
  const { attachUrl } = cfg();
  if (attachUrl) {
    if (await probeForge(attachUrl)) {
      log(`attached to already-running Forge at ${attachUrl} (externally owned — will not be stopped by the extension)`);
      backend = { baseUrl: attachUrl, owned: false };
      updateStatus();
      return backend;
    }
    log(`no Forge answering at ${attachUrl}; starting a managed sidecar`);
  }

  backend = await spawnSidecar(context);
  updateStatus();
  return backend;
}

function stopOwnedSidecar(reason: string): boolean {
  if (!backend?.owned || !backend.child) return false;
  log(`stopping owned sidecar (${reason})`);
  const owned = backend;
  backend = null;
  stoppingDeliberately = true;
  try {
    requestManagedSidecarStop(owned.child!);
  } finally {
    stoppingDeliberately = false;
  }
  updateStatus();
  return true;
}

// ---------------------------------------------------------------------------
// Webview
// ---------------------------------------------------------------------------

function webviewHtml(webview: vscode.Webview, forgeUrl: string, mode: string): string {
  // The Forge page is served BY ITS OWN BACKEND (token pre-injected, all API calls
  // same-origin inside the frame) — the webview shell only needs to host the iframe.
  // Loopback http is a "potentially trustworthy" origin, so framing it is allowed.
  const nonce = crypto.randomBytes(18).toString("base64");
  const forgeOrigin = new URL(forgeUrl).origin;
  const csp = [
    "default-src 'none'",
    "frame-src http://127.0.0.1:* http://localhost:*",
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0b0e14; }
    iframe { border: 0; width: 100%; height: 100%; display: block; }
    .badge { position: fixed; right: 6px; bottom: 4px; font: 10px sans-serif; color: #556; pointer-events: none; }
  </style>
</head>
<body>
  <iframe id="forge-frame" src="${forgeUrl}/" allow="clipboard-read; clipboard-write"></iframe>
  <div class="badge">X4 Forge Studio — ${mode}</div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const frame = document.getElementById('forge-frame');
    const forgeOrigin = ${JSON.stringify(forgeOrigin)};
    window.addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow || event.origin !== forgeOrigin) return;
      const data = event.data;
      if (!data || data.source !== 'x4forge-studio' || !['open-workspace-file', 'open-text-diff', 'open-node-selection', 'node-selection-result', 'open-external-url', 'release-native-action', 'workspace-authority-changed'].includes(data.type)) return;
      vscode.postMessage(data);
    });
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.source !== 'x4forge-native-host' || !['apply-node-selection', 'release-native-result'].includes(data.type)) return;
      frame.contentWindow.postMessage(data, forgeOrigin);
    });
  </script>
</body>
</html>`;
}

function updateStatus(): void {
  if (!backend) {
    statusItem.hide();
    return;
  }
  statusItem.text = backend.owned
    ? `$(rocket) X4 Forge: sidecar :${backend.port}`
    : `$(plug) X4 Forge: attached ${backend.baseUrl.replace(/^https?:\/\//, "")}`;
  statusItem.tooltip = backend.owned
    ? `Managed Forge backend on ${backend.baseUrl} (started by this extension; stopped on deactivate)`
    : `Attached to an externally-run Forge at ${backend.baseUrl} (the extension will never stop it)`;
  statusItem.command = "x4forge.showLogs";
  statusItem.show();
}

function trackStudioPanel(context: vscode.ExtensionContext, nextPanel: vscode.WebviewPanel): void {
  panel = nextPanel;
  panelBinding.reset();
  context.subscriptions.push(nextPanel.webview.onDidReceiveMessage((message) => void handleStudioMessage(context, message)));
  nextPanel.onDidDispose(() => {
    if (panel === nextPanel) {
      panel = null;
      panelBinding.reset();
    }
  });
}

async function handleStudioMessage(context: vscode.ExtensionContext, value: unknown): Promise<void> {
  const authority = value as { source?: unknown; type?: unknown; workspaceId?: unknown } | null;
  if (authority?.source === 'x4forge-studio' && authority.type === 'workspace-authority-changed') {
    const workspaceId = String(authority.workspaceId || '');
    if (!/^ws_[a-f0-9]{24}$/i.test(workspaceId)) {
      log('workspace authority change refused: malformed workspace id');
      return;
    }
    try {
      const handle = await ensureBackend(context);
      if (!handle.owned || !handle.token || !handle.clientId) return;
      const response = await fetch(`${handle.baseUrl}/api/agent/workspaces/bootstrap`, {
        method: 'POST',
        headers: backendApiHeaders(handle, true),
        body: JSON.stringify({ clientId: handle.clientId, workspaceId }),
      });
      const body = await response.json() as { workspaceId?: string; error?: string };
      if (!response.ok || body.workspaceId !== workspaceId) throw new Error(body.error || `HTTP ${response.status}`);
      handle.workspaceId = workspaceId;
      await context.globalState.update('x4forge.workspaceId', workspaceId);
      log(`workspace authority selected by Studio tab: ${workspaceId}`);
    } catch (error) {
      log(`workspace authority change failed closed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }
  const request = parseNativeEditorRequest(value);
  if (!request) return;
  try {
    if (request.type === "release-native-action") {
      await handleNativeReleaseAction(context, request);
      return;
    }
    if (request.type === "open-external-url") {
      const launch = resolveExternalUrlLaunch(request.url);
      if (!launch) throw new Error("The external page is not on Forge's allowlist.");
      await new Promise<void>((resolve, reject) => {
        const child = spawn(launch.executable, launch.args, { detached: true, stdio: "ignore", windowsHide: true });
        child.once("error", reject);
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
      log(`external page opened: ${request.url}`);
      return;
    }
    if (request.type === "node-selection-result") {
      nativeNodeProvider?.accept(request);
      return;
    }
    if (request.type === "open-node-selection") {
      if (!nativeNodeProvider) throw new Error("The native node editor provider is not ready.");
      const uri = nativeNodeProvider.create(request);
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.languages.setTextDocumentLanguage(document, 'xml');
      await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preview: true, preserveFocus: true });
      if (request.warnings.length) void vscode.window.showWarningMessage(`X4 Forge node view: ${request.warnings.join(' ')}`);
      log(`native node selection opened: ${request.nodeIds.length} node(s) · ${request.title}${request.readOnly ? ' · read-only' : ''}`);
      return;
    }
    if (request.type === "open-text-diff") {
      if (!nativeDiffProvider) throw new Error("The native diff provider is not ready.");
      const left = nativeDiffProvider.create(request.leftLabel, request.leftContent, request.language);
      const right = nativeDiffProvider.create(request.rightLabel, request.rightContent, request.language);
      await vscode.commands.executeCommand("vscode.diff", left, right, request.title, { preview: false });
      log(`native diff opened: ${request.title}`);
      return;
    }
    const handle = await ensureBackend(context);
    if (!handle.owned || !handle.token) throw new Error("Native file opening requires the extension-managed Forge sidecar.");
    const headers = backendApiHeaders(handle);
    const [workspaceResponse, configResponse] = await Promise.all([
      fetch(`${handle.baseUrl}/api/agent/workspace`, { headers }),
      fetch(`${handle.baseUrl}/api/schema/config`, { headers }),
    ]);
    const workspaceData = (await workspaceResponse.json()) as { workspace?: { sourceFolder?: string } };
    const configData = (await configResponse.json()) as { resolved?: { modWorkspacePath?: string }; config?: { modWorkspacePath?: string } };
    if (!workspaceResponse.ok || !configResponse.ok) throw new Error("Forge could not resolve the active workspace and directory settings.");
    const workspaceRoot = String(configData.resolved?.modWorkspacePath || configData.config?.modWorkspacePath || "").trim();
    if (!workspaceRoot) throw new Error("No Mod Workspace folder is configured.");
    const sourceFolder = request.sourceFolder
      ? path.resolve(workspaceRoot, request.sourceFolder)
      : String(workspaceData.workspace?.sourceFolder || "").trim();
    if (!sourceFolder) throw new Error("This canvas has no source folder yet. Import or materialize it in the Mod Workspace first.");
    const resolution = resolveNativeEditorFile(workspaceRoot, sourceFolder, request.path);
    if ("code" in resolution) {
      if (resolution.code === "binary_file") void vscode.window.showInformationMessage(`X4 Forge: ${resolution.message}`);
      else throw new Error(resolution.message);
      return;
    }
    const sourceRoot = fs.realpathSync(sourceFolder);
    const alreadyMounted = (vscode.workspace.workspaceFolders || []).some((folder) => {
      try { return fs.realpathSync(folder.uri.fsPath).toLowerCase() === sourceRoot.toLowerCase(); }
      catch { return path.resolve(folder.uri.fsPath).toLowerCase() === sourceRoot.toLowerCase(); }
    });
    if (!alreadyMounted) {
      const mounted = vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders?.length || 0,
        0,
        { uri: vscode.Uri.file(sourceRoot), name: `X4 Mod: ${path.basename(sourceRoot)}` },
      );
      if (!mounted) throw new Error(`Antigravity refused to mount ${path.basename(sourceRoot)} as an IDE workspace folder.`);
      log(`native project mounted: ${sourceRoot}`);
    }
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(resolution.filePath));
    const editor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preview: false, preserveFocus: false });
    if (request.line !== undefined) {
      const line = Math.min(request.line, Math.max(0, document.lineCount - 1));
      const column = Math.min(request.column || 0, document.lineAt(line).text.length);
      const position = new vscode.Position(line, column);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    log(`native editor opened: ${resolution.relativePath}`);
  } catch (error) {
    if (request.type === "release-native-action") {
      postNativeReleaseResult({ requestId: request.requestId, ok: false, code: "NATIVE_RELEASE_FAILED", message: error instanceof Error ? error.message : String(error) });
      return;
    }
    showBackendError(`Studio request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function postNativeReleaseResult(result: Omit<NativeReleaseResult, "source" | "type">): void {
  void panel?.webview.postMessage({ source: "x4forge-native-host", type: "release-native-result", ...result } satisfies NativeReleaseResult);
}

async function configuredModWorkspaceRoot(context: vscode.ExtensionContext): Promise<string> {
  const handle = await ensureBackend(context);
  const headers = handle.token ? { Authorization: `Bearer ${handle.token}` } : undefined;
  const response = await fetch(`${handle.baseUrl}/api/schema/config`, { headers });
  const body = await response.json() as { resolved?: { modWorkspacePath?: string }; config?: { modWorkspacePath?: string }; error?: string };
  if (!response.ok) throw new Error(body.error || "Forge could not resolve the Mod Workspace folder.");
  const root = String(body.resolved?.modWorkspacePath || body.config?.modWorkspacePath || "").trim();
  if (!root) throw new Error("Configure a Mod Workspace Folder before exporting a release.");
  return root;
}

async function handleNativeReleaseAction(context: vscode.ExtensionContext, envelope: NativeReleaseRequest): Promise<void> {
  const request = envelope.request;
  if (request.action === "select-preview") {
    const selected = await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFiles: true, canSelectFolders: false, title: "Select Steam Workshop preview", filters: { "PNG or JPEG image": ["png", "jpg", "jpeg"] } });
    if (!selected?.[0]) return postNativeReleaseResult({ requestId: envelope.requestId, ok: false, cancelled: true, code: "SELECTION_CANCELLED", message: "Preview selection cancelled." });
    const stat = fs.lstatSync(selected[0].fsPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error("Select a regular PNG/JPG preview no larger than 1 MB.");
    return postNativeReleaseResult({ requestId: envelope.requestId, ok: true, code: "PREVIEW_SELECTED", message: "Preview selected; Forge will validate its image structure and dimensions during preparation.", path: selected[0].fsPath, sizeBytes: stat.size });
  }
  if (request.action === "select-workshop-tool") {
    const selected = await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFiles: true, canSelectFolders: false, title: "Select Egosoft WorkshopTool.exe", filters: { "Egosoft Workshop Tool": ["exe"] } });
    if (!selected?.[0]) return postNativeReleaseResult({ requestId: envelope.requestId, ok: false, cancelled: true, code: "SELECTION_CANCELLED", message: "WorkshopTool selection cancelled." });
    const inspected = inspectNativeWorkshopTool(selected[0].fsPath);
    if (!inspected.ok || !inspected.path) throw new Error(inspected.message);
    return postNativeReleaseResult({ requestId: envelope.requestId, ok: true, code: "WORKSHOP_TOOL_SELECTED", message: inspected.message, path: inspected.path });
  }

  const workspaceRoot = await configuredModWorkspaceRoot(context);
  if (request.action === "export-artifact") {
    const source = resolveVerifiedReleaseArtifact(workspaceRoot, request.platform, request.sourcePath, request.sha256, request.sizeBytes);
    if (source.ok === false) throw new Error(source.message);
    const destination = await vscode.window.showSaveDialog({ title: `Save verified ${request.platform === "nexus" ? "Nexus" : "Steam rollback"} ZIP`, defaultUri: vscode.Uri.file(path.join(workspaceRoot, request.suggestedName)), filters: { "ZIP archive": ["zip"] }, saveLabel: "Save verified ZIP" });
    if (!destination) return postNativeReleaseResult({ requestId: envelope.requestId, ok: false, cancelled: true, code: "EXPORT_CANCELLED", message: "Save cancelled; the verified internal artifact was not changed." });
    const copied = copyVerifiedReleaseArtifact(source.sourcePath, destination.fsPath, source.sha256, source.sizeBytes);
    if (copied.ok === false) throw new Error(copied.message);
    return postNativeReleaseResult({ requestId: envelope.requestId, ok: true, code: "ARTIFACT_EXPORTED", message: `Saved ${path.basename(destination.fsPath)}; ${copied.sizeBytes} bytes and SHA-256 verified after the write.`, path: destination.fsPath, sha256: copied.sha256, sizeBytes: copied.sizeBytes });
  }
  const tool = inspectNativeWorkshopTool(request.toolPath);
  if (!tool.ok) throw new Error(`Workshop command refused: ${tool.message}`);
  const terminalRoot = resolveSteamTerminalRoot(workspaceRoot, request.stagedModPath);
  if (terminalRoot.ok === false) throw new Error(terminalRoot.message);
  const terminal = vscode.window.createTerminal({ name: "X4 Forge Steam Workshop", cwd: terminalRoot.cwd });
  terminal.show(false);
  terminal.sendText(request.command, false);
  return postNativeReleaseResult({ requestId: envelope.requestId, ok: true, code: "STEAM_COMMAND_INSERTED", message: "The official WorkshopTool command is visible in a terminal but has not run. Review it, then press Enter yourself to authenticate/upload." });
}

function bindStudioPanel(handle: BackendHandle): boolean {
  const activePanel = panel;
  if (!activePanel) return false;
  return panelBinding.bind(handle, (current) => {
    activePanel.webview.html = webviewHtml(
      activePanel.webview,
      current.baseUrl,
      current.owned ? `managed sidecar on port ${current.port}` : `attached to ${current.baseUrl}`,
    );
    log(`studio panel bound to ${current.baseUrl}`);
  });
}

async function openStudio(context: vscode.ExtensionContext): Promise<void> {
  if (panel) {
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "X4 Forge: checking backend…" },
        () => ensureBackend(context),
      );
    } catch (err) {
      showBackendError(err instanceof Error ? err.message : String(err));
      return;
    }
    panel.reveal();
    return;
  }
  let handle: BackendHandle;
  try {
    handle = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "X4 Forge: starting backend…" },
      () => ensureBackend(context),
    );
  } catch (err) {
    showBackendError(err instanceof Error ? err.message : String(err));
    return;
  }

  const createdPanel = vscode.window.createWebviewPanel("x4forge.studio", "X4 Forge Studio", vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  trackStudioPanel(context, createdPanel);
  bindStudioPanel(handle);
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("X4 Forge");
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  nativeDiffProvider = new NativeDiffContentProvider();
  nativeNodeProvider = new NativeNodeFileSystemProvider();
  context.subscriptions.push(
    output,
    statusItem,
    vscode.workspace.registerTextDocumentContentProvider("x4forge-preview", nativeDiffProvider),
    vscode.workspace.registerFileSystemProvider("x4forge-node", nativeNodeProvider, { isCaseSensitive: true, isReadonly: false }),
  );

  log(`extension activated (host: ${vscode.env.appName} ${vscode.version})`);
  for (const line of formatIdeCapabilityReport(currentIdeCapabilities())) log(`capability: ${line}`);

  // B50: the Activity Bar launcher view. An empty tree provider makes the view render its
  // `viewsWelcome` buttons (Open Studio / Create Agent Key / Logs / Stop) — a click-to-run
  // entry point so users never need the command palette.
  const emptyLauncher: vscode.TreeDataProvider<vscode.TreeItem> = {
    getChildren: () => [],
    getTreeItem: (e) => e,
  };
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("x4forge.launcher", emptyLauncher),
    vscode.window.registerWebviewPanelSerializer("x4forge.studio", {
      async deserializeWebviewPanel(restoredPanel): Promise<void> {
        restoredPanel.webview.options = { enableScripts: true };
        trackStudioPanel(context, restoredPanel);
        try {
          await ensureBackend(context);
          restoredPanel.reveal(undefined, true);
        } catch (err) {
          showBackendError(
            `Could not restore the X4 Forge Studio panel: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("x4forge.openStudio", () => openStudio(context)),
    vscode.commands.registerCommand("x4forge.showLogs", () => output.show(true)),
    vscode.commands.registerCommand("x4forge.showCapabilities", showIdeCapabilities),
    vscode.commands.registerCommand("x4forge.stopSidecar", () => {
      if (stopOwnedSidecar("stop command")) {
        void vscode.window.showInformationMessage("X4 Forge: backend sidecar stopped.");
      } else if (backend && !backend.owned) {
        void vscode.window.showInformationMessage(
          "X4 Forge: attached to an externally-run Forge — the extension will not stop it.",
        );
      } else {
        void vscode.window.showInformationMessage("X4 Forge: no managed sidecar is running.");
      }
    }),
  );

  // B42: mint a scoped, expiring agent key against the OWNED sidecar and hand it to the
  // user's clipboard — closes the "external agents can't discover the sidecar token" gap.
  context.subscriptions.push(
    vscode.commands.registerCommand("x4forge.createAgentKey", async () => {
      try {
        const handle = await ensureBackend(context);
        if (!handle.owned || !handle.token) {
          void vscode.window.showInformationMessage(
            "X4 Forge: attached to an externally-run Forge — create keys in its UI (AGENT API → Agent Keys tab).",
          );
          return;
        }
        const label = await vscode.window.showInputBox({
          prompt: "Key label (which agent is this for?)",
          placeHolder: "e.g. codex-agent",
          validateInput: (v) => (v.trim() ? undefined : "Label required"),
        });
        if (!label) return;
        const scope = await vscode.window.showQuickPick(
          [
            { label: "read", description: "inspect only (GET)" },
            { label: "write", description: "edit / compile / validate / package — no deploys, no spend" },
            { label: "deploy", description: "full API power" },
          ],
          { placeHolder: "Key scope" },
        );
        if (!scope) return;
        const ttl = await vscode.window.showQuickPick(
          [
            { label: "1h", description: "expires in 1 hour" },
            { label: "24h", description: "expires in 24 hours" },
            { label: "7d", description: "expires in 7 days" },
            { label: "30d", description: "expires in 30 days" },
            { label: "never", description: "never expires (revoke manually)" },
          ],
          { placeHolder: "Key lifetime" },
        );
        if (!ttl) return;
        const res = await fetch(`${handle.baseUrl}/api/agent/keys`, {
          method: "POST",
          headers: backendApiHeaders(handle, true),
          body: JSON.stringify({ label: label.trim(), scope: scope.label, ttl: ttl.label }),
        });
        const data = (await res.json()) as { token?: string; error?: string };
        if (!res.ok || !data.token) throw new Error(data.error || `HTTP ${res.status}`);
        await vscode.env.clipboard.writeText(data.token);
        log(`agent key created: label="${label.trim()}" scope=${scope.label} ttl=${ttl.label}`);
        log(`  endpoint: ${handle.baseUrl}/api  ·  header: Authorization: Bearer <key on your clipboard>`);
        void vscode.window
          .showInformationMessage(
            `X4 Forge: key "${label.trim()}" (${scope.label}, ${ttl.label}) copied to clipboard — it will not be shown again. Endpoint: ${handle.baseUrl}`,
            "Show Logs",
          )
          .then((pick) => pick === "Show Logs" && output.show(true));
      } catch (err) {
        showBackendError(`Could not create agent key: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),
  );

  // Problems-panel projection is continuous: the sidecar's FULL validator stack runs
  // for open/change/save events and the extension only projects its one-referee result.
  diagCollection = vscode.languages.createDiagnosticCollection("x4forge");
  context.subscriptions.push(
    diagCollection,
    vscode.commands.registerCommand("x4forge.openModFolder", () => openModFolder(context)),
    vscode.commands.registerCommand("x4forge.copyMcpConfig", () => copyMcpConfig(context)),
    vscode.commands.registerCommand("x4forge.refreshAgentBrief", () => refreshAgentBrief(context)),
    vscode.commands.registerCommand("x4forge.generateProof", () => generateProof(context)),
    vscode.commands.registerCommand("x4forge.checkModConflicts", () => checkModConflicts(context)),
  );
  registerLangProviders(context);
  registerNavProviders(context);
  registerTwoWayEditing(context);

  // Opt-in convenience (x4forge.autoOpen): open the studio once the workspace loads.
  // Only ever runs in trusted workspaces — the manifest disables the extension
  // entirely when untrusted, so activate() is not called there.
  if (cfg().autoOpen) {
    log("x4forge.autoOpen is set — opening the studio");
    void openStudio(context);
  }
}

// ---------------------------------------------------------------------------
// B56s1 — Problems-panel projection (see docs/plans/2026-07-17-ide-native-forge.md)
// ---------------------------------------------------------------------------

let diagCollection: vscode.DiagnosticCollection | null = null;

const DIAG_SEVERITY: Record<string, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

// ---------------------------------------------------------------------------
// B56s2 — mod workspace as a real IDE folder (read-mostly phase A; the canvas/server
// remains the writer of generated files — dual-writer editing is a later, gated decision)
// ---------------------------------------------------------------------------

async function openModFolder(context: vscode.ExtensionContext): Promise<void> {
  try {
    const handle = await ensureBackend(context);
    if (!handle.owned || !handle.token) {
      void vscode.window.showInformationMessage(
        "X4 Forge: attached to an externally-run Forge — open its mod workspace folder manually (the extension holds no credential to read that Forge's settings).",
      );
      return;
    }
    const res = await fetch(`${handle.baseUrl}/api/schema/config`, {
      headers: { Authorization: `Bearer ${handle.token}` },
    });
    const data = (await res.json()) as { resolved?: { modWorkspacePath?: string }; config?: { modWorkspacePath?: string }; error?: string };
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const root = (data.resolved?.modWorkspacePath || data.config?.modWorkspacePath || "").trim();
    if (!root || !fs.existsSync(root)) {
      void vscode.window.showWarningMessage(
        "X4 Forge: no Mod Workspace folder is configured (or it does not exist). Set it in the studio: Settings → Directory Settings.",
      );
      return;
    }
    const mods = listModFolders(root);
    if (!mods.length) {
      void vscode.window.showInformationMessage(`X4 Forge: the Mod Workspace (${root}) has no mod folders yet.`);
      return;
    }
    const pick = mods.length === 1
      ? mods[0]
      : await vscode.window.showQuickPick(mods, { placeHolder: "Mod folder to open as an IDE workspace folder" });
    if (!pick) return;
    const modPath = path.join(root, pick);
    writeRecommendations(modPath);
    // B57s1: the folder describes itself to any resident agent.
    try { await writeAgentBrief(context, modPath, pick); } catch (err) {
      log(`agent brief skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
    // B56s5 (DEFAULT-OFF): per-file xml.fileAssociations to the game's own XSDs, only for
    // plain-rooted files of corpus-proven domains — never for <diff> patches or wares/jobs.
    if (cfg().writeXmlAssociations) {
      try {
        const regRes = await fetch(`${handle.baseUrl}/api/agent/schema-registry`);
        const reg = (await regRes.json()) as { domains?: Array<{ domain: string; path: string }> };
        const xsds: Record<string, string> = {};
        for (const d of reg.domains || []) xsds[d.domain] = d.path;
        const assoc = buildXmlAssociations(modPath, xsds);
        const written = writeXmlAssociations(modPath, assoc);
        log(written ? `xml.fileAssociations written for ${assoc.length} plain-rooted file(s)` : "no association-eligible files found");
      } catch (err) {
        log(`xml.fileAssociations skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const uri = vscode.Uri.file(modPath);
    const already = vscode.workspace.workspaceFolders?.some((f) => f.uri.fsPath.toLowerCase() === modPath.toLowerCase());
    if (!already) {
      vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, {
        uri,
        name: `X4 Mod: ${pick}`,
      });
    }
    log(`opened mod folder as workspace folder: ${modPath} (recommendations written)`);
    scheduleLiveRootValidation(context, modPath, 80);
    void vscode.window.setStatusBarMessage(`X4 Forge: "${pick}" added to the workspace — explorer, search, and git now see it.`, 8000);
  } catch (err) {
    showBackendError(`Open Mod Folder failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// B56s3 — X4 IntelliSense: completion + hover providers over the sidecar's public
// /api/agent/lang/* endpoints. The extension never owns vocabulary — it projects the
// same schema/census/semantics truth the studio uses (one-referee rule). Providers
// degrade silently (empty results) when no sidecar answers.
// ---------------------------------------------------------------------------

const LANG_CACHE_TTL_MS = 30_000;
const langCache = new Map<string, { at: number; data: unknown }>();

/** A file participates in X4 IntelliSense when it lives under a known mod root. */
function modRootFor(fsPath: string): string | null {
  const absolute = path.resolve(fsPath);
  const folders = [...(vscode.workspace.workspaceFolders || [])]
    .filter((folder) => {
      const rel = path.relative(folder.uri.fsPath, absolute);
      return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
    })
    .sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length);
  for (const folder of folders) {
    const boundary = path.resolve(folder.uri.fsPath);
    let cursor = path.dirname(absolute);
    try { if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) cursor = absolute; } catch { /* use parent */ }
    while (true) {
      if (fs.existsSync(path.join(cursor, "content.xml"))) return cursor;
      if (cursor.toLowerCase() === boundary.toLowerCase()) break;
      const parent = path.dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    // Newly scaffolded folders may not have content.xml until their first canvas compile.
    if (folder.name.startsWith("X4 Mod: ")) return boundary;
  }
  return null;
}

async function langGet<T>(route: "complete" | "attrs" | "hover", params: Record<string, string>): Promise<T | null> {
  if (!backend) return null; // never spawn a sidecar from a keystroke
  const qs = new URLSearchParams(params).toString();
  const key = `${route}?${qs}`;
  const hit = langCache.get(key);
  if (hit && Date.now() - hit.at < LANG_CACHE_TTL_MS) return hit.data as T;
  try {
    const res = await fetchWithTimeout(`${backend.baseUrl}/api/agent/lang/${route}?${qs}`, 3000);
    if (!res || !res.ok) return null;
    const data = (await res.json()) as T;
    langCache.set(key, { at: Date.now(), data });
    if (langCache.size > 200) langCache.delete(langCache.keys().next().value as string);
    return data;
  } catch {
    return null;
  }
}

function relModPath(root: string, fsPath: string): string {
  return path.relative(root, fsPath).replace(/\\/g, "/");
}

interface ReferenceCompletionPayload {
  label: string;
  kind: "Element" | "Attribute" | "Enum" | "Reference" | "Property" | "Function";
  detail?: string;
  insertText: string;
  documentation?: string;
  sortText?: string;
}

interface ReferenceHoverPayload {
  kind: "element" | "attribute" | "property" | "function" | "reference";
  label: string;
  signature: string;
  documentation?: string;
  detail?: string;
}

async function referenceLanguagePost<T>(route: "complete" | "hover", body: Record<string, unknown>): Promise<T | null> {
  if (!backend?.token) return null; // attach mode has no credential; legacy public GET remains the fallback
  try {
    const response = await fetchWithTimeout(`${backend.baseUrl}/api/reference/${route}`, 3000, {
      method: "POST",
      headers: { Authorization: `Bearer ${backend.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response?.ok) return null;
    return await response.json() as T;
  } catch { return null; }
}

function completionKind(kind: ReferenceCompletionPayload["kind"]): vscode.CompletionItemKind {
  switch (kind) {
    case "Element": return vscode.CompletionItemKind.Class;
    case "Attribute": return vscode.CompletionItemKind.Property;
    case "Enum": return vscode.CompletionItemKind.EnumMember;
    case "Reference": return vscode.CompletionItemKind.Reference;
    case "Function": return vscode.CompletionItemKind.Method;
    default: return vscode.CompletionItemKind.Field;
  }
}

function registerLangProviders(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { scheme: "file", pattern: "**/*.xml" },
    { scheme: "x4forge-node", language: "xml" },
  ];

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(selector, {
      async provideCompletionItems(doc, pos) {
        const nodeDocument = doc.uri.scheme === 'x4forge-node';
        const root = nodeDocument ? null : modRootFor(doc.uri.fsPath);
        if (!nodeDocument && !root) return undefined;
        const text = doc.getText();
        const ctx = xmlCursorContext(text, doc.offsetAt(pos));
        const file = nodeDocument ? 'md/x4forge-node-selection.xml' : relModPath(root!, doc.uri.fsPath);
        const rootHint = ctx.rootTag || "";

        const modern = await referenceLanguagePost<ReferenceCompletionPayload[]>("complete", {
          path: file,
          content: text,
          line: pos.line,
          column: pos.character,
        });
        if (modern !== null) {
          if (!modern.length) return undefined;
          return modern.map((payload, index) => {
            const item = new vscode.CompletionItem(payload.label, completionKind(payload.kind));
            item.detail = payload.detail;
            item.insertText = new vscode.SnippetString(payload.insertText);
            item.sortText = payload.sortText || String(index).padStart(5, "0");
            if (payload.documentation) item.documentation = new vscode.MarkdownString(payload.documentation);
            return item;
          });
        }

        if (ctx.elementStart && ctx.parentTag) {
          const data = await langGet<{ items: Array<{ tag: string; curated: boolean; requiredAttrs: string[]; summary?: string }> }>(
            "complete", { file, parent: ctx.parentTag, root: rootHint });
          if (!data?.items?.length) return undefined;
          return data.items.map((it, i) => {
            const item = new vscode.CompletionItem(it.tag, vscode.CompletionItemKind.Class);
            item.sortText = `${it.curated ? "0" : "1"}${String(i).padStart(4, "0")}`;
            item.detail = [it.curated ? "curated" : "", it.summary || ""].filter(Boolean).join(" · ") || undefined;
            if (it.requiredAttrs.length) {
              const attrs = it.requiredAttrs.map((a, n) => `${a}="$${n + 1}"`).join(" ");
              item.insertText = new vscode.SnippetString(`${it.tag} ${attrs}`);
              item.documentation = `Required: ${it.requiredAttrs.join(", ")}`;
            }
            return item;
          });
        }

        if (ctx.inTag && ctx.inAttrValue) {
          const data = await langGet<{ attrs: Array<{ name: string; enumValues?: string[] }> }>(
            "attrs", { file, tag: ctx.inTag, root: rootHint });
          const enums = data?.attrs?.find((a) => a.name === ctx.inAttrValue)?.enumValues;
          if (!enums?.length) return undefined;
          return enums.map((v) => new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember));
        }

        if (ctx.inTag) {
          const data = await langGet<{ attrs: Array<{ name: string; required: boolean; type?: string }> }>(
            "attrs", { file, tag: ctx.inTag, root: rootHint });
          if (!data?.attrs?.length) return undefined;
          return data.attrs.map((a, i) => {
            const item = new vscode.CompletionItem(a.name, vscode.CompletionItemKind.Property);
            item.sortText = `${a.required ? "0" : "1"}${String(i).padStart(4, "0")}`;
            item.detail = `${a.required ? "required" : "optional"}${a.type ? ` · ${a.type}` : ""}`;
            item.insertText = new vscode.SnippetString(`${a.name}="$1"`);
            return item;
          });
        }
        return undefined;
      },
    }, "<", " ", "\"", "'", "."),

    vscode.languages.registerHoverProvider(selector, {
      async provideHover(doc, pos) {
        const nodeDocument = doc.uri.scheme === 'x4forge-node';
        const root = nodeDocument ? null : modRootFor(doc.uri.fsPath);
        if (!nodeDocument && !root) return undefined;
        const file = nodeDocument ? 'md/x4forge-node-selection.xml' : relModPath(root!, doc.uri.fsPath);
        const modern = await referenceLanguagePost<ReferenceHoverPayload>("hover", {
          path: file,
          content: doc.getText(),
          line: pos.line,
          column: pos.character,
        });
        if (modern) {
          const modernRange = doc.getWordRangeAtPosition(pos, /[A-Za-z_][\w.:-]*/);
          const markdown = new vscode.MarkdownString();
          markdown.appendCodeblock(modern.signature, "x4");
          if (modern.documentation) markdown.appendMarkdown(`\n${modern.documentation}\n`);
          if (modern.detail) markdown.appendMarkdown(`\n_${modern.detail}_`);
          return new vscode.Hover(markdown, modernRange);
        }
        const range = doc.getWordRangeAtPosition(pos, /[A-Za-z_][\w.:-]*/);
        if (!range) return undefined;
        const word = doc.getText(range);
        const before = doc.getText(new vscode.Range(range.start.with(undefined, Math.max(0, range.start.character - 2)), range.start));
        if (!before.includes("<")) return undefined; // hover element names only
        const ctx = xmlCursorContext(doc.getText(), doc.offsetAt(range.start));
        const data = await langGet<{ known: boolean; summary?: string; requiredAttrs: string[]; attrCount: number; semantics?: { description?: string; risk?: string; note?: string } }>(
          "hover", { file, tag: word, root: ctx.rootTag || "" });
        if (!data?.known) return undefined;
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**\`<${word}>\`**${data.summary ? ` — ${data.summary}` : ""}\n\n`);
        if (data.semantics?.description) md.appendMarkdown(`${data.semantics.description}\n\n`);
        if (data.requiredAttrs.length) md.appendMarkdown(`Required: ${data.requiredAttrs.map((a) => `\`${a}\``).join(", ")}\n\n`);
        if (data.semantics?.risk && data.semantics.risk !== "none") md.appendMarkdown(`Risk: ${data.semantics.risk}\n\n`);
        if (data.semantics?.note) md.appendMarkdown(`_${data.semantics.note}_\n`);
        md.appendMarkdown(`\n*x4forge · ${data.attrCount} attribute(s) declared*`);
        return new vscode.Hover(md, range);
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// B56s4 — MCP config for IDE-resident coding agents. We COPY a ready-to-paste config;
// we never write into another tool's configuration files (their config is theirs).
// ---------------------------------------------------------------------------

async function copyMcpConfig(context: vscode.ExtensionContext): Promise<void> {
  try {
    const handle = await ensureBackend(context);
    const shimPath = vscode.Uri.joinPath(context.extensionUri, "mcp", "x4forge-mcp.cjs").fsPath;
    const config = {
      mcpServers: {
        x4forge: {
          command: "node",
          args: [shimPath],
          env: {
            X4FORGE_URL: handle.baseUrl,
            X4FORGE_KEY: "<paste an agent key here — run 'X4 Forge: Create Agent Key' (write scope recommended)>",
            X4FORGE_WORKSPACE_ID: handle.workspaceId || '<workspace id>',
          },
        },
      },
    };
    await vscode.env.clipboard.writeText(JSON.stringify(config, null, 2));
    log(`MCP config copied (shim: ${shimPath}, url: ${handle.baseUrl})`);
    void vscode.window.showInformationMessage(
      "X4 Forge: MCP server config copied to clipboard. Paste it into your agent's MCP settings, then replace the X4FORGE_KEY placeholder with a real agent key (X4 Forge: Create Agent Key).",
      "Create Agent Key",
    ).then((pick) => pick === "Create Agent Key" && vscode.commands.executeCommand("x4forge.createAgentKey"));
  } catch (err) {
    showBackendError(`Copy MCP config failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// B57s1 — the self-describing mod folder: AGENTS.md + X4_NOTES.md generated from live
// server truth. GENERATED files (marked as such) — regenerated idempotently, hand edits
// are deliberately not preserved (staleness class).
// ---------------------------------------------------------------------------

async function writeAgentBrief(context: vscode.ExtensionContext, modPath: string, fromPath: string): Promise<boolean> {
  const handle = await ensureBackend(context);
  if (!handle.owned || !handle.token) return false;
  const res = await fetch(`${handle.baseUrl}/api/agent/project/brief?fromPath=${encodeURIComponent(fromPath)}`, {
    headers: backendApiHeaders(handle),
  });
  const data = (await res.json()) as { agentsMd?: string; notesMd?: string; error?: string };
  if (!res.ok || !data.agentsMd || !data.notesMd) throw new Error(data.error || `HTTP ${res.status}`);
  replaceFileSetAtomically([
    { file: path.join(modPath, "AGENTS.md"), data: data.agentsMd },
    { file: path.join(modPath, "X4_NOTES.md"), data: data.notesMd },
  ]);
  log(`agent brief written for "${fromPath}" (AGENTS.md + X4_NOTES.md)`);
  return true;
}

async function refreshAgentBrief(context: vscode.ExtensionContext): Promise<void> {
  try {
    const handle = await ensureBackend(context);
    if (!handle.owned || !handle.token) {
      void vscode.window.showInformationMessage("X4 Forge: attached to an externally-run Forge — no credential to read its project data.");
      return;
    }
    // Prefer a mod folder already in the workspace; else prompt.
    const modFolders = (vscode.workspace.workspaceFolders || []).filter((f) => f.name.startsWith("X4 Mod: "));
    let modPath: string | null = null;
    let fromPath: string | null = null;
    if (modFolders.length === 1) {
      modPath = modFolders[0].uri.fsPath;
      fromPath = path.basename(modPath);
    } else if (modFolders.length > 1) {
      const pick = await vscode.window.showQuickPick(modFolders.map((f) => f.name.replace("X4 Mod: ", "")), { placeHolder: "Which mod?" });
      if (!pick) return;
      modPath = modFolders.find((f) => f.name === `X4 Mod: ${pick}`)?.uri.fsPath ?? null;
      fromPath = pick;
    } else {
      fromPath = (await vscode.window.showInputBox({ prompt: "Mod folder name under the Mod Workspace root" }))?.trim() || null;
      if (!fromPath) return;
      const cfgRes = await fetch(`${handle.baseUrl}/api/schema/config`, { headers: { Authorization: `Bearer ${handle.token}` } });
      const cfgData = (await cfgRes.json()) as { resolved?: { modWorkspacePath?: string } };
      const root = (cfgData.resolved?.modWorkspacePath || "").trim();
      if (!root) throw new Error("No Mod Workspace root configured.");
      modPath = path.join(root, fromPath);
    }
    if (!modPath || !fs.existsSync(modPath)) throw new Error(`Mod folder not found: ${modPath}`);
    await writeAgentBrief(context, modPath, fromPath!);
    void vscode.window.setStatusBarMessage(`X4 Forge: agent brief refreshed for "${fromPath}".`, 6000);
  } catch (err) {
    showBackendError(`Refresh Agent Brief failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// B57s3 — cue navigation (aid, not verdict) + unsaved-buffer diagnostics.
// ---------------------------------------------------------------------------

function mdFilesOf(root: string): string[] {
  const dir = path.join(root, "md");
  try {
    return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".xml")).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function registerNavProviders(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [{ scheme: "file", pattern: "**/md/*.xml" }];

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, {
      provideDefinition(doc, pos) {
        const root = modRootFor(doc.uri.fsPath);
        if (!root) return undefined;
        const range = doc.getWordRangeAtPosition(pos, /[A-Za-z_][\w.]*/);
        if (!range) return undefined;
        const word = parseCueWord(doc.getText(range));
        if (!word) return undefined;
        for (const file of mdFilesOf(root)) {
          let text: string;
          try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
          if (word.script && (mdscriptNameOf(text) || "").toLowerCase() !== word.script.toLowerCase()) continue;
          const loc = findCueDefinition(text, word.cue);
          if (loc) return new vscode.Location(vscode.Uri.file(file), new vscode.Position(loc.line, loc.column));
        }
        return undefined;
      },
    }),
    vscode.languages.registerReferenceProvider(selector, {
      provideReferences(doc, pos) {
        const root = modRootFor(doc.uri.fsPath);
        if (!root) return undefined;
        const range = doc.getWordRangeAtPosition(pos, /[A-Za-z_][\w.]*/);
        if (!range) return undefined;
        const word = parseCueWord(doc.getText(range));
        if (!word) return undefined;
        const out: vscode.Location[] = [];
        for (const file of mdFilesOf(root)) {
          let text: string;
          try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
          for (const loc of findCueReferences(text, word.cue)) {
            out.push(new vscode.Location(vscode.Uri.file(file), new vscode.Position(loc.line, loc.column)));
          }
        }
        return out;
      },
    }),
  );

  // Unsaved-buffer diagnostics: all open buffers overlay a complete disk scan and go
  // through the full inline validator. Open/change/save all schedule the same referee.
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      scheduleLiveValidation(context, e.document, 650);
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => scheduleLiveValidation(context, doc, 80)),
    vscode.workspace.onDidSaveTextDocument((doc) => scheduleLiveValidation(context, doc, 80)),
  );
  for (const doc of vscode.workspace.textDocuments) scheduleLiveValidation(context, doc, 120);
  for (const folder of vscode.workspace.workspaceFolders || []) {
    const roots: string[] = [];
    if (fs.existsSync(path.join(folder.uri.fsPath, "content.xml"))) roots.push(folder.uri.fsPath);
    else {
      try {
        for (const entry of fs.readdirSync(folder.uri.fsPath, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith(".") && fs.existsSync(path.join(folder.uri.fsPath, entry.name, "content.xml"))) {
            roots.push(path.join(folder.uri.fsPath, entry.name));
          }
        }
      } catch { /* workspace folder may disappear during activation */ }
    }
    roots.forEach((root, index) => scheduleLiveRootValidation(context, root, 180 + index * 40));
  }
}

const LIVE_FILE_LIMIT = 2000;
const liveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const liveGenerations = new Map<string, number>();
const diagnosticUrisByRoot = new Map<string, Set<string>>();

function setRootValidationWarning(root: string, code: string, message: string): void {
  const key = path.resolve(root).toLowerCase();
  const uri = vscode.Uri.file(path.join(root, "content.xml"));
  for (const stale of diagnosticUrisByRoot.get(key) || []) diagCollection?.delete(vscode.Uri.parse(stale));
  const warning = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), message, vscode.DiagnosticSeverity.Warning);
  warning.source = "x4forge";
  warning.code = code;
  diagCollection?.set(uri, [warning]);
  diagnosticUrisByRoot.set(key, new Set([uri.toString()]));
}

function isAuthoringDocument(doc: vscode.TextDocument): boolean {
  return (doc.uri.scheme === "file" && /\.(xml|lua)$/i.test(doc.uri.fsPath))
    || (doc.uri.scheme === 'x4forge-node' && doc.languageId === 'xml');
}

function scheduleLiveValidation(context: vscode.ExtensionContext, doc: vscode.TextDocument, delayMs: number): void {
  if (!isAuthoringDocument(doc)) return;
  if (doc.uri.scheme === 'x4forge-node') {
    scheduleNodeDocumentValidation(doc, delayMs);
    return;
  }
  const root = modRootFor(doc.uri.fsPath);
  if (!root) return;
  scheduleLiveRootValidation(context, root, delayMs);
}

function scheduleNodeDocumentValidation(doc: vscode.TextDocument, delayMs: number): void {
  const key = `node:${doc.uri.toString()}`;
  const prior = liveTimers.get(key);
  if (prior) clearTimeout(prior);
  const generation = (liveGenerations.get(key) || 0) + 1;
  liveGenerations.set(key, generation);
  liveTimers.set(key, setTimeout(() => {
    liveTimers.delete(key);
    void validateNodeDocument(doc, key, generation);
  }, delayMs));
}

async function validateNodeDocument(doc: vscode.TextDocument, key: string, generation: number): Promise<void> {
  try {
    if (!backend?.owned || !backend.token) return;
    const pathName = 'md/x4forge-node-selection.xml';
    const response = await fetch(`${backend.baseUrl}/api/agent/project/validate/check`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${backend.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: { id: 'x4forge_node_selection', name: 'X4 Forge node selection', files: [
        { path: 'content.xml', content: '<content id="x4forge_node_selection" name="X4 Forge node selection" version="1" />' },
        { path: pathName, content: doc.getText() },
      ] } }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { flat?: FlatFinding[] };
    if (liveGenerations.get(key) !== generation) return;
    const relevant = (data.flat || []).filter(finding => {
      const code = String(finding.code || '').toLowerCase();
      const message = String(finding.message || '').toLowerCase();
      if (/manifest|package|doctor|readiness/.test(code) || /no mission cue|no executable entry point/.test(message)) return false;
      return !finding.filePath || finding.filePath.replace(/\\/g, '/').toLowerCase() === pathName;
    });
    const mapped = mapFlatFindings(relevant, [pathName]);
    const list = mapped.byFile.get(pathName) || [];
    diagCollection?.set(doc.uri, list.map(item => {
      const line = Math.min(item.line, Math.max(0, doc.lineCount - 1));
      const diagnostic = new vscode.Diagnostic(new vscode.Range(line, 0, line, doc.lineAt(line).text.length), item.message, DIAG_SEVERITY[item.severity]);
      diagnostic.source = 'x4forge';
      if (item.code) diagnostic.code = item.code;
      return diagnostic;
    }));
  } catch (error) {
    if (liveGenerations.get(key) !== generation) return;
    const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), `X4 Forge could not validate this node document: ${error instanceof Error ? error.message : String(error)}`, vscode.DiagnosticSeverity.Warning);
    diagnostic.source = 'x4forge';
    diagCollection?.set(doc.uri, [diagnostic]);
  }
}

function scheduleLiveRootValidation(context: vscode.ExtensionContext, root: string, delayMs = 650): void {
  const key = path.resolve(root).toLowerCase();
  const prior = liveTimers.get(key);
  if (prior) clearTimeout(prior);
  const generation = (liveGenerations.get(key) || 0) + 1;
  liveGenerations.set(key, generation);
  liveTimers.set(key, setTimeout(() => {
    liveTimers.delete(key);
    void ensureBackend(context)
      .then(() => liveValidateRoot(root, generation))
      .catch((err) => log(`continuous validation unavailable: ${err instanceof Error ? err.message : String(err)}`));
  }, delayMs));
}

async function liveValidateRoot(root: string, generation: number): Promise<void> {
  try {
    if (!backend?.owned || !backend.token) {
      setRootValidationWarning(root, "validation.backend_credential_unavailable", "X4 Forge continuous validation is unavailable because this extension attached to an externally managed backend without a credential. The Studio still validates continuously; native IDE squiggles require the extension-managed sidecar.");
      return;
    }
    const byPath = new Map<string, { path: string; content: string }>();
    let overflow = false;
    const walk = (rel: string) => {
      if (byPath.size >= LIVE_FILE_LIMIT) { overflow = true; return; }
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(path.join(root, ...rel.split("/").filter(Boolean)), { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (byPath.size >= LIVE_FILE_LIMIT) { overflow = true; return; }
        const childRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (!e.name.startsWith(".") && e.name.toLowerCase() !== "node_modules") walk(childRel);
          continue;
        }
        if (!/\.(xml|lua)$/i.test(e.name)) continue;
        try { byPath.set(childRel.toLowerCase(), { path: childRel, content: fs.readFileSync(path.join(root, ...childRel.split("/")), "utf8") }); } catch { /* skip */ }
      }
    };
    walk("");
    for (const open of vscode.workspace.textDocuments) {
      if (!isAuthoringDocument(open)) continue;
      const rel = path.relative(root, open.uri.fsPath);
      if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
      const normalized = rel.replace(/\\/g, "/");
      byPath.set(normalized.toLowerCase(), { path: normalized, content: open.getText() });
    }
    if (overflow || byPath.size > LIVE_FILE_LIMIT) {
      setRootValidationWarning(root, "validation.file_limit", `X4 Forge continuous validation stopped: this mod exceeds the ${LIVE_FILE_LIMIT.toLocaleString()}-file safety limit. No partial clean result was reported.`);
      return;
    }
    const files = [...byPath.values()];
    const res = await fetch(`${backend.baseUrl}/api/agent/project/validate/check`, {
      method: "POST",
      headers: { Authorization: `Bearer ${backend.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ project: { id: path.basename(root), name: path.basename(root), files } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { flat?: FlatFinding[] };
    const key = path.resolve(root).toLowerCase();
    if (liveGenerations.get(key) !== generation) return;
    const mapped = mapFlatFindings(data.flat || [], files.map((f) => f.path));
    const currentUris = new Set<string>();
    for (const [rel, list] of mapped.byFile) {
      const uri = vscode.Uri.file(path.join(root, ...rel.split("/")));
      currentUris.add(uri.toString());
      const open = vscode.workspace.textDocuments.find((candidate) => candidate.uri.toString() === uri.toString());
      diagCollection?.set(uri, list.map((d) => {
        const line = open ? Math.min(d.line, Math.max(0, open.lineCount - 1)) : d.line;
        const end = open ? open.lineAt(line).text.length : 200;
        const diag = new vscode.Diagnostic(new vscode.Range(line, 0, line, end), d.message, DIAG_SEVERITY[d.severity] ?? vscode.DiagnosticSeverity.Information);
        diag.source = "x4forge";
        if (d.code) diag.code = d.code;
        return diag;
      }));
    }
    for (const stale of diagnosticUrisByRoot.get(key) || []) {
      if (!currentUris.has(stale)) diagCollection?.delete(vscode.Uri.parse(stale));
    }
    diagnosticUrisByRoot.set(key, currentUris);
    log(`continuous validation: ${path.basename(root)} · ${mapped.total} finding(s) across ${files.length} file(s)`);
  } catch (error) {
    const key = path.resolve(root).toLowerCase();
    if (liveGenerations.get(key) !== generation) return;
    setRootValidationWarning(root, "validation.request_failed", `X4 Forge continuous validation could not refresh: ${error instanceof Error ? error.message : String(error)}. The previous result was discarded so it cannot masquerade as current.`);
  }
}

// ---------------------------------------------------------------------------
// B57s4 — proof artifact: one page of machine evidence, written into the mod folder.
// ---------------------------------------------------------------------------

async function generateProof(context: vscode.ExtensionContext): Promise<void> {
  try {
    const handle = await ensureBackend(context);
    if (!handle.owned || !handle.token) {
      void vscode.window.showInformationMessage("X4 Forge: attached to an externally-run Forge — no credential for its evidence.");
      return;
    }
    const modFolders = (vscode.workspace.workspaceFolders || []).filter((f) => f.name.startsWith("X4 Mod: "));
    const fromPath = modFolders.length === 1
      ? path.basename(modFolders[0].uri.fsPath)
      : (await vscode.window.showInputBox({ prompt: "Mod folder name for the proof (blank = active workspace only)" }))?.trim() || "";
    const res = await fetch(`${handle.baseUrl}/api/agent/proof?fromPath=${encodeURIComponent(fromPath)}`, {
      headers: backendApiHeaders(handle),
    });
    const data = (await res.json()) as { markdown?: string; error?: string };
    if (!res.ok || !data.markdown) throw new Error(data.error || `HTTP ${res.status}`);
    const target = modFolders.length === 1 ? modFolders[0].uri.fsPath : null;
    if (target) {
      atomicWriteFile(path.join(target, "PROOF.md"), data.markdown);
      const doc = await vscode.workspace.openTextDocument(path.join(target, "PROOF.md"));
      await vscode.window.showTextDocument(doc, { preview: true });
      log(`PROOF.md written to ${target}`);
    } else {
      const doc = await vscode.workspace.openTextDocument({ content: data.markdown, language: "markdown" });
      await vscode.window.showTextDocument(doc, { preview: true });
    }
  } catch (err) {
    showBackendError(`Generate Proof failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// B57s5 — two-way adopt (default-on: x4forge.twoWayEditing). IDE file edits can be
// ADOPTED into the canvas via the server's guarded importer — never silently: every
// adoption is an explicit user action; refusals surface their reason; adopt/refuse
// counters retain adoption/refusal observability; guarded import and conflict checks
// remain authoritative even though the extension now enables this path by default.
// ---------------------------------------------------------------------------

let adoptWatcher: vscode.FileSystemWatcher | null = null;
let adoptPromptOpen = false;

function telemetryBump(context: vscode.ExtensionContext, key: "adoptCount" | "declineCount" | "guardRefusals" | "conflictCount"): void {
  const k = `x4forge.telemetry.${key}`;
  const next = (context.globalState.get<number>(k) || 0) + 1;
  void context.globalState.update(k, next);
  log(`telemetry ${key} = ${next}`);
}

function registerTwoWayEditing(context: vscode.ExtensionContext): void {
  const enabled = vscode.workspace.getConfiguration("x4forge").get<boolean>("twoWayEditing") === true;
  if (!enabled || adoptWatcher) return;
  adoptWatcher = vscode.workspace.createFileSystemWatcher("**/*.{xml,lua,json,md,txt}");
  context.subscriptions.push(
    adoptWatcher,
    adoptWatcher.onDidChange((uri) => void offerAdopt(context, uri)),
    adoptWatcher.onDidCreate((uri) => void offerAdopt(context, uri)),
  );
  log("two-way editing watcher active (x4forge.twoWayEditing=true)");
}

async function offerAdopt(context: vscode.ExtensionContext, uri: vscode.Uri): Promise<void> {
  const root = modRootFor(uri.fsPath);
  if (!root || adoptPromptOpen || !backend?.owned || !backend.token) return;
  adoptPromptOpen = true;
  try {
    const rel = relModPath(root, uri.fsPath);
    const pick = await vscode.window.showInformationMessage(
      `X4 Forge: "${rel}" changed on disk. Adopt the folder's current state into the canvas? (Guarded — a lossy import refuses instead of corrupting.)`,
      "Adopt into canvas", "Not now",
    );
    if (pick !== "Adopt into canvas") { telemetryBump(context, "declineCount"); return; }
    await adoptFolderIntoCanvas(context, path.basename(root));
  } finally {
    adoptPromptOpen = false;
  }
}

async function adoptFolderIntoCanvas(context: vscode.ExtensionContext, folderName: string): Promise<void> {
  try {
    if (!backend?.owned || !backend.token) throw new Error("no owned sidecar");
    const auth = backendApiHeaders(backend, true);
    const wsRes = await fetch(`${backend.baseUrl}/api/agent/workspace`, { headers: auth });
    const wsData = (await wsRes.json()) as { version?: number };
    const importRes = await fetch(`${backend.baseUrl}/api/agent/mod-folder/import`, {
      method: "POST", headers: auth, body: JSON.stringify({ path: folderName }),
    });
    const imported = (await importRes.json()) as { success?: boolean; workspace?: unknown; report?: { skipped?: unknown[]; reason?: string }; error?: string };
    if (!importRes.ok || !imported.success || !imported.workspace) {
      telemetryBump(context, "guardRefusals");
      throw new Error(imported.error || imported.report?.reason || `guarded import refused (HTTP ${importRes.status})`);
    }
    const commitRes = await fetch(`${backend.baseUrl}/api/agent/workspace`, {
      method: "POST", headers: auth,
      body: JSON.stringify({ workspace: imported.workspace, expectedVersion: wsData.version }),
    });
    const committed = (await commitRes.json()) as { applied?: boolean; error?: string };
    if (commitRes.status === 409) {
      telemetryBump(context, "conflictCount");
      throw new Error("canvas changed while adopting — nothing applied; re-run adopt when ready");
    }
    if (!commitRes.ok || !committed.applied) throw new Error(committed.error || `commit refused (HTTP ${commitRes.status})`);
    telemetryBump(context, "adoptCount");
    const skipped = imported.report?.skipped as unknown[] | undefined;
    void vscode.window.setStatusBarMessage(
      `X4 Forge: adopted "${folderName}" into the canvas${skipped?.length ? ` (${skipped.length} file(s) preserved as-is)` : ""}.`, 8000);
    log(`adopted folder "${folderName}" into canvas (CAS ok)`);
  } catch (err) {
    showBackendError(`Adopt into canvas failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// B58b — cross-mod conflict projection: the EXISTING Extension Doctor / override-map
// engine surfaced as native IDE diagnostics (separate collection from mod-folder
// validation so the two never clear each other).
// ---------------------------------------------------------------------------

let conflictCollection: vscode.DiagnosticCollection | null = null;

async function checkModConflicts(context: vscode.ExtensionContext): Promise<void> {
  try {
    const handle = await ensureBackend(context);
    if (!handle.owned || !handle.token) {
      void vscode.window.showInformationMessage("X4 Forge: attached to an externally-run Forge — open its Diagnostics → Install tab for the conflict scan.");
      return;
    }
    const res = await fetch(`${handle.baseUrl}/api/agent/extension-doctor`, {
      headers: { Authorization: `Bearer ${handle.token}` },
    });
    const data = (await res.json()) as {
      extensionsRoot?: string;
      extensionsScanned?: number;
      counts?: Record<string, number>;
      findings?: Array<{ severity: string; code?: string; filePath?: string; message: string }>;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    conflictCollection ??= vscode.languages.createDiagnosticCollection("x4forge-conflicts");
    context.subscriptions.push(conflictCollection);
    conflictCollection.clear();

    const extRootParent = data.extensionsRoot ? path.dirname(data.extensionsRoot) : null;
    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const f of data.findings || []) {
      if (!extRootParent || !f.filePath) continue;
      const abs = path.join(extRootParent, ...f.filePath.split("/"));
      const diag = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 200),
        f.message,
        DIAG_SEVERITY[f.severity] ?? vscode.DiagnosticSeverity.Information,
      );
      diag.source = "x4forge-conflicts";
      if (f.code) diag.code = f.code;
      const list = byFile.get(abs) || [];
      list.push(diag);
      byFile.set(abs, list);
    }
    for (const [abs, list] of byFile) conflictCollection.set(vscode.Uri.file(abs), list);

    const c = data.counts || {};
    log(`conflict scan: ${data.extensionsScanned ?? 0} extensions — ${c.error || 0} error(s), ${c.warning || 0} warning(s), ${c.info || 0} info`);
    void vscode.window.setStatusBarMessage(
      `X4 Forge conflicts: ${data.extensionsScanned ?? 0} extensions scanned — ${c.error || 0} error(s), ${c.warning || 0} warning(s) (details in Problems).`,
      10000,
    );
  } catch (err) {
    conflictCollection?.clear();
    showBackendError(`Check Mod Conflicts failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function deactivate(): void {
  stopOwnedSidecar("extension deactivate");
}
