import * as fs from "node:fs";
import * as path from "node:path";

export interface NativeEditorRequest {
  source: "x4forge-studio";
  type: "open-workspace-file";
  path: string;
  sourceFolder?: string;
  line?: number;
  column?: number;
}

export interface NativeTextDiffRequest {
  source: "x4forge-studio";
  type: "open-text-diff";
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftContent: string;
  rightContent: string;
  language?: string;
}

export interface NativeNodeSelectionRequest {
  source: "x4forge-studio";
  type: "open-node-selection";
  requestId: string;
  title: string;
  content: string;
  token: string;
  nodeIds: string[];
  readOnly: boolean;
  warnings: string[];
}

export interface NativeNodeSelectionResult {
  source: "x4forge-studio";
  type: "node-selection-result";
  requestId: string;
  ok: boolean;
  message: string;
  token?: string;
  content?: string;
  warnings?: number;
}

export const X4_UNPACKER_URL = "https://www.nexusmods.com/x4foundations/mods/2142?tab=description";
export const X4_FORGE_DISCORD_URL = "https://discord.gg/9qvAvtXqWP";

export interface NativeExternalUrlRequest {
  source: "x4forge-studio";
  type: "open-external-url";
  url: typeof X4_UNPACKER_URL | typeof X4_FORGE_DISCORD_URL;
}

export type NativeStudioRequest = NativeEditorRequest | NativeTextDiffRequest | NativeNodeSelectionRequest | NativeNodeSelectionResult | NativeExternalUrlRequest;

const MAX_DIFF_TEXT_BYTES = 8 * 1024 * 1024;
const MAX_NODE_TEXT_BYTES = 1024 * 1024;
const EXTERNAL_URLS = new Set<string>([X4_UNPACKER_URL, X4_FORGE_DISCORD_URL]);

export interface ExternalUrlLaunchSpec {
  executable: string;
  args: string[];
}

/**
 * Resolve an allowlisted support URL to the operating system's URL launcher.
 * This intentionally avoids VS Code's trusted-domain confirmation: the Forge
 * UI already presents the exact destination and the parser accepts only the
 * two static URLs above.
 */
export function resolveExternalUrlLaunch(
  url: string,
  platform: NodeJS.Platform = process.platform,
): ExternalUrlLaunchSpec | null {
  if (!EXTERNAL_URLS.has(url)) return null;
  if (platform === "win32") return { executable: "rundll32.exe", args: ["url.dll,FileProtocolHandler", url] };
  if (platform === "darwin") return { executable: "open", args: [url] };
  return { executable: "xdg-open", args: [url] };
}

export type NativeEditorResolution =
  | { ok: true; filePath: string; relativePath: string; text: true }
  | { ok: false; code: string; message: string };

function safeLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const label = value.replace(/[\r\n\0]/g, " ").trim().slice(0, 160);
  return label || fallback;
}

export function parseNativeEditorRequest(value: unknown): NativeStudioRequest | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.source !== "x4forge-studio") return null;
  if (candidate.type === "open-external-url") {
    if (typeof candidate.url !== "string" || !EXTERNAL_URLS.has(candidate.url)) return null;
    return {
      source: "x4forge-studio",
      type: "open-external-url",
      url: candidate.url as NativeExternalUrlRequest["url"],
    };
  }
  if (candidate.type === "node-selection-result") {
    if (typeof candidate.requestId !== "string" || typeof candidate.ok !== "boolean" || typeof candidate.message !== "string") return null;
    if (candidate.content !== undefined && (typeof candidate.content !== "string" || Buffer.byteLength(candidate.content, "utf8") > MAX_NODE_TEXT_BYTES)) return null;
    return {
      source: "x4forge-studio", type: "node-selection-result", requestId: candidate.requestId.slice(0, 160), ok: candidate.ok,
      message: safeLabel(candidate.message, candidate.ok ? "Node edit applied." : "Node edit refused."),
      ...(typeof candidate.token === "string" ? { token: candidate.token.slice(0, 160) } : {}),
      ...(typeof candidate.content === "string" ? { content: candidate.content } : {}),
      ...(Number.isInteger(candidate.warnings) ? { warnings: Number(candidate.warnings) } : {}),
    };
  }
  if (candidate.type === "open-node-selection") {
    if (typeof candidate.requestId !== "string" || typeof candidate.title !== "string" || typeof candidate.content !== "string" || typeof candidate.token !== "string") return null;
    if (!Array.isArray(candidate.nodeIds) || !candidate.nodeIds.length || candidate.nodeIds.length > 100 || candidate.nodeIds.some(id => typeof id !== "string" || !id || id.length > 240)) return null;
    if (Buffer.byteLength(candidate.content, "utf8") > MAX_NODE_TEXT_BYTES) return null;
    return {
      source: "x4forge-studio", type: "open-node-selection", requestId: candidate.requestId.slice(0, 160),
      title: safeLabel(candidate.title, "Selected nodes.xml"), content: candidate.content, token: candidate.token.slice(0, 160),
      nodeIds: candidate.nodeIds as string[], readOnly: candidate.readOnly === true,
      warnings: Array.isArray(candidate.warnings) ? candidate.warnings.filter(value => typeof value === "string").map(value => safeLabel(value, "Node is view-only.")).slice(0, 20) : [],
    };
  }
  if (candidate.type === "open-text-diff") {
    if (typeof candidate.leftContent !== "string" || typeof candidate.rightContent !== "string") return null;
    if (Buffer.byteLength(candidate.leftContent, "utf8") > MAX_DIFF_TEXT_BYTES
      || Buffer.byteLength(candidate.rightContent, "utf8") > MAX_DIFF_TEXT_BYTES) return null;
    const language = typeof candidate.language === "string" && /^[a-z0-9._+-]{1,32}$/i.test(candidate.language)
      ? candidate.language : undefined;
    return {
      source: "x4forge-studio",
      type: "open-text-diff",
      title: safeLabel(candidate.title, "X4 Forge Diff"),
      leftLabel: safeLabel(candidate.leftLabel, "Before"),
      rightLabel: safeLabel(candidate.rightLabel, "After"),
      leftContent: candidate.leftContent,
      rightContent: candidate.rightContent,
      ...(language ? { language } : {}),
    };
  }
  if (candidate.type !== "open-workspace-file" || typeof candidate.path !== "string") return null;
  const request: NativeEditorRequest = { source: "x4forge-studio", type: "open-workspace-file", path: candidate.path };
  if (candidate.sourceFolder !== undefined) {
    if (typeof candidate.sourceFolder !== "string") return null;
    const folder = candidate.sourceFolder.trim();
    if (!folder || folder === "." || folder === ".." || !/^[a-zA-Z0-9._-]+$/.test(folder)) return null;
    request.sourceFolder = folder;
  }
  if (Number.isInteger(candidate.line) && Number(candidate.line) >= 0) request.line = Number(candidate.line);
  if (Number.isInteger(candidate.column) && Number(candidate.column) >= 0) request.column = Number(candidate.column);
  return request;
}

function isInside(candidate: string, root: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function safeRelativePath(input: string): string | null {
  const normalized = String(input || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized.includes("\0") || path.posix.isAbsolute(normalized) || /^[a-zA-Z]:\//.test(normalized)) return null;
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts.join("/");
}

function isProbablyTextFile(filePath: string): boolean {
  const stat = fs.statSync(filePath);
  const length = Math.min(stat.size, 16 * 1024);
  if (length === 0) return true;
  const fd = fs.openSync(filePath, "r");
  const sample = Buffer.allocUnsafe(length);
  try {
    fs.readSync(fd, sample, 0, length, 0);
  } finally {
    fs.closeSync(fd);
  }
  // UTF-16 text carries NUL bytes by design; preserve BOM-marked text documents.
  if (length >= 2 && ((sample[0] === 0xff && sample[1] === 0xfe) || (sample[0] === 0xfe && sample[1] === 0xff))) return true;
  let controls = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) controls++;
  }
  return controls / length < 0.08;
}

export function resolveNativeEditorFile(workspaceRootInput: string, sourceFolderInput: string, relativePathInput: string): NativeEditorResolution {
  const relativePath = safeRelativePath(relativePathInput);
  if (!relativePath) return { ok: false, code: "invalid_path", message: "Forge refused an absolute, empty, or traversal file path." };
  try {
    const workspaceRoot = fs.realpathSync(workspaceRootInput);
    const sourceLstat = fs.lstatSync(sourceFolderInput);
    if (!sourceLstat.isDirectory() || sourceLstat.isSymbolicLink()) {
      return { ok: false, code: "invalid_source", message: "The active mod source is not a regular workspace directory." };
    }
    const sourceFolder = fs.realpathSync(sourceFolderInput);
    if (!isInside(sourceFolder, workspaceRoot) || sourceFolder === workspaceRoot) {
      return { ok: false, code: "outside_workspace", message: "The active mod source is outside the configured Mod Workspace." };
    }
    if (!fs.existsSync(path.join(sourceFolder, "content.xml"))) {
      return { ok: false, code: "not_a_mod", message: "The active source folder has no content.xml and is not an X4 mod project." };
    }
    const candidate = path.resolve(sourceFolder, ...relativePath.split("/"));
    if (!isInside(candidate, sourceFolder) || candidate === sourceFolder) {
      return { ok: false, code: "path_escape", message: "The requested file escaped the active mod source folder." };
    }
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return { ok: false, code: "not_regular_file", message: "Forge opens regular source files only; directories and links are refused." };
    }
    const realFile = fs.realpathSync(candidate);
    if (!isInside(realFile, sourceFolder)) {
      return { ok: false, code: "path_escape", message: "The requested file resolves outside the active mod source folder." };
    }
    if (!isProbablyTextFile(realFile)) {
      return { ok: false, code: "binary_file", message: `${relativePath} is a binary payload. Forge will preserve it byte-for-byte but will not open it as text.` };
    }
    return { ok: true, filePath: realFile, relativePath, text: true };
  } catch (error) {
    return { ok: false, code: "unavailable", message: `Forge could not open ${relativePath}: ${error instanceof Error ? error.message : String(error)}` };
  }
}
