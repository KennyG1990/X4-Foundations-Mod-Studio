import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

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

export type NativeReleaseAction =
  | { action: "select-preview" }
  | { action: "select-workshop-tool" }
  | { action: "export-artifact"; platform: "nexus" | "steam"; sourcePath: string; suggestedName: string; sha256: string; sizeBytes: number }
  | { action: "open-steam-terminal"; command: string; stagedModPath: string; toolPath: string };

export interface NativeReleaseRequest {
  source: "x4forge-studio";
  type: "release-native-action";
  requestId: string;
  request: NativeReleaseAction;
}

export interface NativeReleaseResult {
  source: "x4forge-native-host";
  type: "release-native-result";
  requestId: string;
  ok: boolean;
  cancelled?: boolean;
  code: string;
  message: string;
  path?: string;
  sha256?: string;
  sizeBytes?: number;
}

function parseQuotedPowerShellCommand(command: string): string[] | null {
  if (!command.startsWith('& ')) return null;
  const tokens: string[] = [];
  let cursor = 2;
  while (cursor < command.length) {
    while (command[cursor] === ' ') cursor++;
    if (command[cursor] !== "'") return null;
    cursor++;
    let value = '';
    let closed = false;
    while (cursor < command.length) {
      if (command[cursor] !== "'") { value += command[cursor++]; continue; }
      if (command[cursor + 1] === "'") { value += "'"; cursor += 2; continue; }
      cursor++;
      closed = true;
      break;
    }
    if (!closed) return null;
    tokens.push(value);
    if (cursor < command.length && command[cursor] !== ' ') return null;
  }
  return tokens;
}

function sameLocalPath(left: string, right: string): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLocaleLowerCase('en-US') === b.toLocaleLowerCase('en-US') : a === b;
}

export function validateWorkshopTerminalCommand(command: string, toolPath: string, stagedModPath: string): boolean {
  if (!command || command.length > 16_384 || /[\r\n\0]/.test(command) || !toolPath || !stagedModPath) return false;
  const tokens = parseQuotedPowerShellCommand(command);
  if (!tokens || tokens.length < 4 || path.basename(tokens[0]).toLowerCase() !== 'workshoptool.exe'
    || !sameLocalPath(tokens[0], toolPath) || (tokens[1] !== 'publishx4' && tokens[1] !== 'update')
    || tokens[2] !== '-path' || !sameLocalPath(tokens[3], stagedModPath)) return false;
  const mode = tokens[1];
  let cursor = 4;
  let previewSeen = false;
  let changeNoteSeen = false;
  let minorSeen = false;
  while (cursor < tokens.length) {
    const flag = tokens[cursor++];
    if (flag === '-preview' && !previewSeen && cursor < tokens.length) {
      const preview = tokens[cursor++];
      const ext = path.extname(preview).toLowerCase();
      if (!isInside(path.resolve(preview), path.resolve(stagedModPath)) || !['.png', '.jpg', '.jpeg'].includes(ext)) return false;
      previewSeen = true;
      continue;
    }
    if (flag === '-changenote' && mode === 'update' && !changeNoteSeen && cursor < tokens.length) {
      if (!tokens[cursor++].trim()) return false;
      changeNoteSeen = true;
      continue;
    }
    if (flag === '-minor' && mode === 'update' && !minorSeen) { minorSeen = true; continue; }
    return false;
  }
  return mode === 'publishx4' ? previewSeen && !changeNoteSeen && !minorSeen : changeNoteSeen;
}

export type NativeStudioRequest = NativeEditorRequest | NativeTextDiffRequest | NativeNodeSelectionRequest | NativeNodeSelectionResult | NativeExternalUrlRequest | NativeReleaseRequest;

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
  if (candidate.type === "release-native-action") {
    if (typeof candidate.requestId !== "string" || !candidate.request || typeof candidate.request !== "object") return null;
    const request = candidate.request as Record<string, unknown>;
    const requestId = candidate.requestId.replace(/[\r\n\0]/g, '').slice(0, 160);
    if (!requestId) return null;
    if (request.action === "select-preview" || request.action === "select-workshop-tool") {
      return { source: "x4forge-studio", type: "release-native-action", requestId, request: { action: request.action } };
    }
    if (request.action === "export-artifact") {
      if ((request.platform !== "nexus" && request.platform !== "steam") || typeof request.sourcePath !== "string"
        || typeof request.suggestedName !== "string" || !/^[^\\/:*?"<>|\r\n]{1,180}\.zip$/i.test(request.suggestedName)
        || typeof request.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(request.sha256)
        || !Number.isSafeInteger(request.sizeBytes) || Number(request.sizeBytes) <= 0 || Number(request.sizeBytes) > 0xffffffff) return null;
      return { source: "x4forge-studio", type: "release-native-action", requestId, request: {
        action: "export-artifact", platform: request.platform, sourcePath: request.sourcePath.slice(0, 4096),
        suggestedName: request.suggestedName, sha256: request.sha256.toLowerCase(), sizeBytes: Number(request.sizeBytes),
      } };
    }
    if (request.action === "open-steam-terminal") {
      if (typeof request.command !== "string" || typeof request.stagedModPath !== "string" || typeof request.toolPath !== "string"
        || request.stagedModPath.length > 4096 || request.toolPath.length > 4096
        || !validateWorkshopTerminalCommand(request.command, request.toolPath, request.stagedModPath)) return null;
      return { source: "x4forge-studio", type: "release-native-action", requestId, request: { action: "open-steam-terminal", command: request.command, stagedModPath: request.stagedModPath, toolPath: request.toolPath } };
    }
    return null;
  }
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

function fileSha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export type ReleaseArtifactResolution =
  | { ok: true; sourcePath: string; platform: "nexus" | "steam"; sha256: string; sizeBytes: number }
  | { ok: false; code: string; message: string };

export function resolveVerifiedReleaseArtifact(
  workspaceRootInput: string,
  platform: "nexus" | "steam",
  sourcePathInput: string,
  expectedSha256: string,
  expectedSize: number,
): ReleaseArtifactResolution {
  try {
    const workspaceRoot = fs.realpathSync(workspaceRootInput);
    const releaseRootInput = path.join(workspaceRoot, ".forge-builds", "releases", platform);
    const releaseRoot = fs.realpathSync(releaseRootInput);
    const candidate = path.resolve(sourcePathInput);
    if (!isInside(candidate, releaseRoot) || candidate === releaseRoot) return { ok: false, code: "outside_release_root", message: "The requested ZIP is outside Forge's verified release root." };
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink() || !stat.isFile() || path.extname(candidate).toLowerCase() !== ".zip") return { ok: false, code: "invalid_release_file", message: "Forge exports regular ZIP files only; links and other file types are refused." };
    const realFile = fs.realpathSync(candidate);
    if (!isInside(realFile, releaseRoot)) return { ok: false, code: "release_path_escape", message: "The release ZIP resolves outside Forge's verified release root." };
    if (stat.size !== expectedSize || !/^[a-f0-9]{64}$/i.test(expectedSha256)) return { ok: false, code: "release_receipt_mismatch", message: "The prepared ZIP size or receipt is invalid. Rebuild it before export." };
    const sha256 = fileSha256(realFile);
    if (sha256 !== expectedSha256.toLowerCase()) return { ok: false, code: "release_hash_mismatch", message: "The prepared ZIP changed after verification. Rebuild it before export." };
    return { ok: true, sourcePath: realFile, platform, sha256, sizeBytes: stat.size };
  } catch (error) {
    return { ok: false, code: "release_unavailable", message: `Forge could not reopen the prepared ZIP: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function copyVerifiedReleaseArtifact(sourcePath: string, destinationPath: string, expectedSha256: string, expectedSize: number): ReleaseArtifactResolution {
  const destination = path.resolve(destinationPath);
  const parent = path.dirname(destination);
  const temp = path.join(parent, `.${path.basename(destination)}.x4forge-export-${process.pid}-${Date.now()}`);
  const backup = path.join(parent, `.${path.basename(destination)}.x4forge-backup-${process.pid}-${Date.now()}`);
  let movedOld = false;
  try {
    if (path.extname(destination).toLowerCase() !== ".zip" || path.resolve(sourcePath) === destination) return { ok: false, code: "invalid_export_destination", message: "Choose a different .zip output file." };
    if (fs.existsSync(destination)) {
      const existing = fs.lstatSync(destination);
      if (!existing.isFile() || existing.isSymbolicLink()) return { ok: false, code: "invalid_export_destination", message: "The selected output must be a regular .zip file, not a directory or link." };
    }
    fs.copyFileSync(sourcePath, temp, fs.constants.COPYFILE_EXCL);
    const copied = fs.lstatSync(temp);
    const copiedHash = fileSha256(temp);
    if (!copied.isFile() || copied.isSymbolicLink() || copied.size !== expectedSize || copiedHash !== expectedSha256.toLowerCase()) throw new Error("The copied bytes did not match the verified receipt.");
    if (fs.existsSync(destination)) { fs.renameSync(destination, backup); movedOld = true; }
    fs.renameSync(temp, destination);
    const finalStat = fs.lstatSync(destination);
    const finalHash = fileSha256(destination);
    if (!finalStat.isFile() || finalStat.isSymbolicLink() || finalStat.size !== expectedSize || finalHash !== expectedSha256.toLowerCase()) throw new Error("The final output did not match the verified receipt.");
    if (movedOld) fs.rmSync(backup, { force: true });
    return { ok: true, sourcePath: destination, platform: "nexus", sha256: finalHash, sizeBytes: finalStat.size };
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.rmSync(temp, { force: true }); } catch { /* best effort */ }
    try { if (movedOld && fs.existsSync(backup)) { if (fs.existsSync(destination)) fs.rmSync(destination, { force: true }); fs.renameSync(backup, destination); } } catch { /* best effort rollback */ }
    return { ok: false, code: "release_export_failed", message: `Forge could not save the verified ZIP: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function inspectNativeWorkshopTool(filePathInput: string): { ok: boolean; message: string; path?: string } {
  try {
    const inputStat = fs.lstatSync(filePathInput);
    if (inputStat.isSymbolicLink()) throw new Error("Select the real WorkshopTool.exe file, not a link.");
    const filePath = fs.realpathSync(filePathInput);
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !stat.isFile() || path.basename(filePath).toLowerCase() !== "workshoptool.exe") throw new Error("Select Egosoft WorkshopTool.exe from X Tools.");
    const fd = fs.openSync(filePath, "r");
    const dos = Buffer.alloc(64);
    try {
      if (fs.readSync(fd, dos, 0, dos.length, 0) !== dos.length || dos[0] !== 0x4d || dos[1] !== 0x5a) throw new Error("WorkshopTool.exe has no Windows executable header.");
      const peOffset = dos.readUInt32LE(0x3c);
      const pe = Buffer.alloc(4);
      if (peOffset < 64 || peOffset + pe.length > stat.size || fs.readSync(fd, pe, 0, pe.length, peOffset) !== pe.length || pe.toString("ascii") !== "PE\0\0") throw new Error("WorkshopTool.exe has no valid PE signature.");
    } finally { fs.closeSync(fd); }
    return { ok: true, path: filePath, message: "WorkshopTool.exe selected; Windows PE header verified." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function resolveSteamTerminalRoot(workspaceRootInput: string, stagedModPathInput: string): { ok: true; cwd: string } | { ok: false; message: string } {
  try {
    const workspaceRoot = fs.realpathSync(workspaceRootInput);
    const steamRoot = fs.realpathSync(path.join(workspaceRoot, ".forge-builds", "releases", "steam"));
    const staged = fs.realpathSync(stagedModPathInput);
    const stat = fs.lstatSync(staged);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !isInside(staged, steamRoot) || staged === steamRoot) throw new Error("The Steam staging folder is outside Forge's verified release root.");
    return { ok: true, cwd: staged };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
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
