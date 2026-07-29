import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  parseNativeEditorRequest,
  resolveExternalUrlLaunch,
  resolveNativeEditorFile,
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

const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
const check = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
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
  check("rejects source-folder traversal", parseNativeEditorRequest({ source: "x4forge-studio", type: "open-workspace-file", path: "md/main.xml", sourceFolder: "../fixture" }) === null);
  check("rejects unrelated message", parseNativeEditorRequest({ source: "other", type: "open-workspace-file", path: "md/main.xml" }) === null);
  check("resolves workspace text file", resolveNativeEditorFile(workspaceRoot, modRoot, "md/main.xml").ok);
  check("rejects traversal", !resolveNativeEditorFile(workspaceRoot, modRoot, "../outside.xml").ok);
  check("rejects absolute path", !resolveNativeEditorFile(workspaceRoot, modRoot, path.join(root, "outside.xml")).ok);
  const binary = resolveNativeEditorFile(workspaceRoot, modRoot, "asset.bin");
  check("refuses binary as text", "code" in binary && binary.code === "binary_file", "code" in binary ? binary.code : "opened");
  check("rejects source outside configured workspace", !resolveNativeEditorFile(workspaceRoot, root, "outside.xml").ok);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

const pass = checks.every((entry) => entry.pass);
console.log(JSON.stringify({ pass, checks }, null, 2));
if (!pass) process.exitCode = 1;
