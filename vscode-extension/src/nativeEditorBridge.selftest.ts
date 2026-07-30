import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import {
  copyVerifiedReleaseArtifact,
  inspectNativeWorkshopTool,
  parseNativeEditorRequest,
  resolveExternalUrlLaunch,
  resolveNativeEditorFile,
  resolveSteamTerminalRoot,
  resolveVerifiedReleaseArtifact,
  X4_FORGE_DISCORD_URL,
  X4_UNPACKER_URL,
} from "./nativeEditorBridge";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "x4forge-native-editor-"));
const workspaceRoot = path.join(root, "mods");
const modRoot = path.join(workspaceRoot, "fixture");
fs.mkdirSync(path.join(modRoot, "md"), { recursive: true });
fs.writeFileSync(path.join(modRoot, "content.xml"), "<content/>");
fs.writeFileSync(path.join(modRoot, "md", "main.xml"), "<mdscript/>");
fs.writeFileSync(path.join(modRoot, "asset.bin"), Buffer.from([0, 1, 2, 3]));
fs.writeFileSync(path.join(root, "outside.xml"), "<outside/>");
const nexusReleaseRoot = path.join(workspaceRoot, ".forge-builds", "releases", "nexus");
const steamReleaseRoot = path.join(workspaceRoot, ".forge-builds", "releases", "steam", "fixture");
fs.mkdirSync(nexusReleaseRoot, { recursive: true });
fs.mkdirSync(steamReleaseRoot, { recursive: true });
const releaseZip = path.join(nexusReleaseRoot, "fixture.zip");
const releaseBytes = Buffer.from("verified zip fixture bytes");
fs.writeFileSync(releaseZip, releaseBytes);
const releaseHash = crypto.createHash("sha256").update(releaseBytes).digest("hex");
const workshopTool = path.join(root, "WorkshopTool.exe");
const peFixture = Buffer.alloc(512);
peFixture.write("MZ", 0, "ascii");
peFixture.writeUInt32LE(128, 0x3c);
peFixture.write("PE\0\0", 128, "ascii");
fs.writeFileSync(workshopTool, peFixture);

const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
const check = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
const psQuote = (value: string) => `'${value.replace(/'/g, "''")}'`;
const workshopCommand = (tool: string, mode: "publishx4" | "update", stage: string, args: string[]) =>
  `& ${[tool, mode, "-path", stage, ...args].map(psQuote).join(" ")}`;
try {
  const open = parseNativeEditorRequest({ source: "x4forge-studio", type: "open-workspace-file", path: "md/main.xml" });
  check("parses narrow native-open message", open?.type === "open-workspace-file" && open.path === "md/main.xml");
  const unpacker = parseNativeEditorRequest({ source: "x4forge-studio", type: "open-external-url", url: X4_UNPACKER_URL });
  check("accepts exact X4 Unpacker URL", unpacker?.type === "open-external-url" && unpacker.url === X4_UNPACKER_URL);
  const discord = parseNativeEditorRequest({ source: "x4forge-studio", type: "open-external-url", url: X4_FORGE_DISCORD_URL });
  check("accepts exact Forge Discord URL", discord?.type === "open-external-url" && discord.url === X4_FORGE_DISCORD_URL);
  check("rejects unlisted HTTPS URL", parseNativeEditorRequest({ source: "x4forge-studio", type: "open-external-url", url: "https://example.com" }) === null);
  check("rejects non-HTTPS URL", parseNativeEditorRequest({ source: "x4forge-studio", type: "open-external-url", url: "javascript:alert(1)" }) === null);
  check("Windows launches an exact URL without a shell", JSON.stringify(resolveExternalUrlLaunch(X4_UNPACKER_URL, "win32")) === JSON.stringify({ executable: "rundll32.exe", args: ["url.dll,FileProtocolHandler", X4_UNPACKER_URL] }));
  check("macOS uses the native open command", resolveExternalUrlLaunch(X4_FORGE_DISCORD_URL, "darwin")?.executable === "open");
  check("Linux uses xdg-open", resolveExternalUrlLaunch(X4_FORGE_DISCORD_URL, "linux")?.executable === "xdg-open");
  check("launcher rejects an unlisted URL", resolveExternalUrlLaunch("https://example.com", "win32") === null);
  const sourced = parseNativeEditorRequest({ source: "x4forge-studio", type: "open-workspace-file", path: "md/main.xml", sourceFolder: "fixture" });
  check("parses safe relative source folder", sourced?.type === "open-workspace-file" && sourced.sourceFolder === "fixture");
  const diff = parseNativeEditorRequest({ source: "x4forge-studio", type: "open-text-diff", title: "Wares", leftLabel: "Base", rightLabel: "Edited", leftContent: "<wares/>", rightContent: "<wares><ware/></wares>", language: "xml" });
  check("parses bounded native diff", diff?.type === "open-text-diff" && diff.language === "xml" && diff.rightLabel === "Edited");
  check("rejects oversized native diff", parseNativeEditorRequest({ source: "x4forge-studio", type: "open-text-diff", leftContent: "x".repeat(8 * 1024 * 1024 + 1), rightContent: "" }) === null);
  const sanitized = parseNativeEditorRequest({ source: "x4forge-studio", type: "open-text-diff", title: "A\nB", leftLabel: "", rightLabel: "After", leftContent: "a", rightContent: "b" });
  check("sanitizes native diff labels", sanitized?.type === "open-text-diff" && sanitized.title === "A B" && sanitized.leftLabel === "Before");
  const nodeSelection = parseNativeEditorRequest({
    source: 'x4forge-studio', type: 'open-node-selection', requestId: 'r1', title: 'Set value.node.xml',
    content: '<mdscript><cues><cue name="T"/></cues></mdscript>', token: 'abc', nodeIds: ['node-1'], readOnly: false, warnings: [],
  });
  check('parses editable node selection', nodeSelection?.type === 'open-node-selection' && nodeSelection.nodeIds[0] === 'node-1' && nodeSelection.readOnly === false);
  const nodeResult = parseNativeEditorRequest({ source: 'x4forge-studio', type: 'node-selection-result', requestId: 'save-1', ok: false, message: 'stale selection' });
  check('parses node save refusal', nodeResult?.type === 'node-selection-result' && nodeResult.ok === false && nodeResult.message === 'stale selection');
  check('rejects empty node selection', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'open-node-selection', requestId: 'r2', title: 'x', content: '<x/>', token: 't', nodeIds: [] }) === null);
  const exportRequest = parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'export-1', request: { action: 'export-artifact', platform: 'nexus', sourcePath: releaseZip, suggestedName: 'fixture.zip', sha256: releaseHash, sizeBytes: releaseBytes.length } });
  check('parses bounded release export request', exportRequest?.type === 'release-native-action' && exportRequest.request.action === 'export-artifact');
  check('rejects export without hash receipt', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'export-2', request: { action: 'export-artifact', platform: 'nexus', sourcePath: releaseZip, suggestedName: 'fixture.zip', sha256: 'no', sizeBytes: 3 } }) === null);
  const previewPath = path.join(steamReleaseRoot, "preview.png");
  const publishCommand = workshopCommand(workshopTool, "publishx4", steamReleaseRoot, ["-preview", previewPath]);
  const terminalRequest = parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-1', request: { action: 'open-steam-terminal', command: publishCommand, stagedModPath: steamReleaseRoot, toolPath: workshopTool } });
  check('parses visible WorkshopTool terminal request', terminalRequest?.type === 'release-native-action' && terminalRequest.request.action === 'open-steam-terminal');
  const apostropheTool = path.join(root, "Ken's Tools", "WorkshopTool.exe");
  const quotedTerminalRequest = parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-quoted', request: { action: 'open-steam-terminal', command: workshopCommand(apostropheTool, "publishx4", steamReleaseRoot, ["-preview", previewPath]), stagedModPath: steamReleaseRoot, toolPath: apostropheTool } });
  check('accepts PowerShell-escaped apostrophe in tool path', quotedTerminalRequest?.type === 'release-native-action' && quotedTerminalRequest.request.action === 'open-steam-terminal');
  const updateCommand = workshopCommand(workshopTool, "update", steamReleaseRoot, ["-changenote", "Fix release flow", "-minor"]);
  check('accepts update without preview when changenote is present', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-update', request: { action: 'open-steam-terminal', command: updateCommand, stagedModPath: steamReleaseRoot, toolPath: workshopTool } })?.type === 'release-native-action');
  check('rejects renamed executable in terminal command', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-renamed', request: { action: 'open-steam-terminal', command: workshopCommand(path.join(root, "NotWorkshopTool.exe"), "publishx4", steamReleaseRoot, ["-preview", previewPath]), stagedModPath: steamReleaseRoot, toolPath: path.join(root, "NotWorkshopTool.exe") } }) === null);
  check('rejects command whose tool differs from selected tool', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-tool-mismatch', request: { action: 'open-steam-terminal', command: publishCommand, stagedModPath: steamReleaseRoot, toolPath: apostropheTool } }) === null);
  check('rejects command whose stage differs from verified stage', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-stage-mismatch', request: { action: 'open-steam-terminal', command: publishCommand, stagedModPath: path.join(steamReleaseRoot, "other"), toolPath: workshopTool } }) === null);
  check('rejects first publish without preview', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-no-preview', request: { action: 'open-steam-terminal', command: workshopCommand(workshopTool, "publishx4", steamReleaseRoot, []), stagedModPath: steamReleaseRoot, toolPath: workshopTool } }) === null);
  check('rejects update without changenote', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-no-note', request: { action: 'open-steam-terminal', command: workshopCommand(workshopTool, "update", steamReleaseRoot, []), stagedModPath: steamReleaseRoot, toolPath: workshopTool } }) === null);
  check('rejects extra WorkshopTool flags', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-extra-flag', request: { action: 'open-steam-terminal', command: workshopCommand(workshopTool, "publishx4", steamReleaseRoot, ["-preview", previewPath, "-buildcat"]), stagedModPath: steamReleaseRoot, toolPath: workshopTool } }) === null);
  check('rejects multiline terminal command', parseNativeEditorRequest({ source: 'x4forge-studio', type: 'release-native-action', requestId: 'terminal-2', request: { action: 'open-steam-terminal', command: `${publishCommand}\nRemove-Item x`, stagedModPath: steamReleaseRoot, toolPath: workshopTool } }) === null);
  check("rejects source-folder traversal", parseNativeEditorRequest({ source: "x4forge-studio", type: "open-workspace-file", path: "md/main.xml", sourceFolder: "../fixture" }) === null);
  check("rejects unrelated message", parseNativeEditorRequest({ source: "other", type: "open-workspace-file", path: "md/main.xml" }) === null);
  check("resolves workspace text file", resolveNativeEditorFile(workspaceRoot, modRoot, "md/main.xml").ok);
  check("rejects traversal", !resolveNativeEditorFile(workspaceRoot, modRoot, "../outside.xml").ok);
  check("rejects absolute path", !resolveNativeEditorFile(workspaceRoot, modRoot, path.join(root, "outside.xml")).ok);
  const binary = resolveNativeEditorFile(workspaceRoot, modRoot, "asset.bin");
  check("refuses binary as text", "code" in binary && binary.code === "binary_file", "code" in binary ? binary.code : "opened");
  check("rejects source outside configured workspace", !resolveNativeEditorFile(workspaceRoot, root, "outside.xml").ok);
  const release = resolveVerifiedReleaseArtifact(workspaceRoot, 'nexus', releaseZip, releaseHash, releaseBytes.length);
  check('resolves hash-verified release ZIP', release.ok);
  check('rejects stale release receipt', !resolveVerifiedReleaseArtifact(workspaceRoot, 'nexus', releaseZip, '0'.repeat(64), releaseBytes.length).ok);
  check('rejects release outside platform root', !resolveVerifiedReleaseArtifact(workspaceRoot, 'nexus', path.join(root, 'outside.xml'), releaseHash, releaseBytes.length).ok);
  const exported = path.join(root, 'saved-fixture.zip');
  check('copies and rehashes user-selected output', copyVerifiedReleaseArtifact(releaseZip, exported, releaseHash, releaseBytes.length).ok && fs.readFileSync(exported).equals(releaseBytes));
  check('refuses same-file export destination', !copyVerifiedReleaseArtifact(releaseZip, releaseZip, releaseHash, releaseBytes.length).ok);
  const directoryDestination = path.join(root, 'directory.zip');
  fs.mkdirSync(directoryDestination);
  check('refuses directory-shaped export destination', !copyVerifiedReleaseArtifact(releaseZip, directoryDestination, releaseHash, releaseBytes.length).ok && fs.statSync(directoryDestination).isDirectory());
  check('accepts PE-shaped exact WorkshopTool', inspectNativeWorkshopTool(workshopTool).ok);
  fs.writeFileSync(path.join(root, 'renamed.exe'), Buffer.from('not a pe'));
  check('rejects renamed non-tool executable', !inspectNativeWorkshopTool(path.join(root, 'renamed.exe')).ok);
  check('accepts verified Steam staging cwd', resolveSteamTerminalRoot(workspaceRoot, steamReleaseRoot).ok);
  check('rejects terminal cwd outside Steam root', !resolveSteamTerminalRoot(workspaceRoot, root).ok);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

const pass = checks.every((entry) => entry.pass);
console.log(JSON.stringify({ pass, checks }, null, 2));
if (!pass) process.exitCode = 1;
