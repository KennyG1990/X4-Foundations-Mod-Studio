import type { ModWorkspace } from '../types';

export interface NativeEditorOpenRequest {
  source: 'x4forge-studio';
  type: 'open-workspace-file';
  path: string;
  sourceFolder?: string;
  line?: number;
  column?: number;
}

export interface NativeTextDiffRequest {
  source: 'x4forge-studio';
  type: 'open-text-diff';
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftContent: string;
  rightContent: string;
  language?: string;
}

export interface NativeNodeSelectionRequest {
  source: 'x4forge-studio';
  type: 'open-node-selection';
  requestId: string;
  title: string;
  content: string;
  token: string;
  nodeIds: string[];
  readOnly: boolean;
  warnings: string[];
}

export interface NativeNodeSelectionResult {
  source: 'x4forge-studio';
  type: 'node-selection-result';
  requestId: string;
  ok: boolean;
  message: string;
  token?: string;
  content?: string;
  warnings?: number;
}

export interface NativeNodeApplyRequest {
  source: 'x4forge-native-host';
  type: 'apply-node-selection';
  requestId: string;
  content: string;
  token: string;
  nodeIds: string[];
}

export const X4_UNPACKER_URL = 'https://www.nexusmods.com/x4foundations/mods/2142?tab=description';
export const X4_FORGE_DISCORD_URL = 'https://discord.gg/9qvAvtXqWP';

export interface NativeExternalUrlRequest {
  source: 'x4forge-studio';
  type: 'open-external-url';
  url: typeof X4_UNPACKER_URL | typeof X4_FORGE_DISCORD_URL;
}

export type NativeReleaseAction =
  | { action: 'select-preview' }
  | { action: 'select-workshop-tool' }
  | { action: 'export-artifact'; platform: 'nexus' | 'steam'; sourcePath: string; suggestedName: string; sha256: string; sizeBytes: number }
  | { action: 'open-steam-terminal'; command: string; stagedModPath: string; toolPath: string };

export interface NativeReleaseRequest {
  source: 'x4forge-studio';
  type: 'release-native-action';
  requestId: string;
  request: NativeReleaseAction;
}

export interface NativeReleaseResult {
  source: 'x4forge-native-host';
  type: 'release-native-result';
  requestId: string;
  ok: boolean;
  cancelled?: boolean;
  code: string;
  message: string;
  path?: string;
  sha256?: string;
  sizeBytes?: number;
}

export function notifyNativeWorkspaceAuthority(workspaceId: string): void {
  if (!hasNativeReleaseHost() || !/^ws_[a-f0-9]{24}$/i.test(workspaceId)) return;
  window.parent.postMessage({
    source: 'x4forge-studio',
    type: 'workspace-authority-changed',
    workspaceId,
  }, '*');
}

const NATIVE_EXTERNAL_URLS = new Set<string>([X4_UNPACKER_URL, X4_FORGE_DISCORD_URL]);

export function hasNativeReleaseHost(): boolean {
  return typeof window !== 'undefined' && window.parent !== window;
}

export function requestNativeReleaseAction(request: NativeReleaseAction): Promise<NativeReleaseResult | null> {
  if (!hasNativeReleaseHost()) return Promise.resolve(null);
  const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `release-${Date.now()}-${Math.random()}`;
  return new Promise(resolve => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', receive);
      resolve({ source: 'x4forge-native-host', type: 'release-native-result', requestId, ok: false, code: 'NATIVE_RELEASE_TIMEOUT', message: 'The installed host did not answer the release request. Nothing was exported or launched.' });
    }, 120_000);
    const receive = (event: MessageEvent) => {
      const candidate = event.data as Partial<NativeReleaseResult> | null;
      if (event.source !== window.parent || !candidate || candidate.source !== 'x4forge-native-host'
        || candidate.type !== 'release-native-result' || candidate.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', receive);
      resolve(candidate as NativeReleaseResult);
    };
    window.addEventListener('message', receive);
    const message: NativeReleaseRequest = { source: 'x4forge-studio', type: 'release-native-action', requestId, request };
    window.parent.postMessage(message, '*');
  });
}

interface NativeProjectFileEntry {
  path: string;
  state: 'source' | 'synchronized-generated' | 'generated-only' | 'conflict';
  text: boolean;
  openable: boolean;
  materializable: boolean;
}

interface NativeProjectInventoryResponse {
  sourceAvailable?: boolean;
  sourceFolder?: string | null;
  entries?: NativeProjectFileEntry[];
  errors?: string[];
  error?: string;
}

export interface NativeProjectOpenResult {
  ok: boolean;
  materialized: boolean;
  message: string;
}

export function needsManifestMaterialization(projectPath: string, sourceAvailable: boolean): boolean {
  return projectPath !== 'content.xml' && !sourceAvailable;
}

export async function openSourceVsGeneratedDiff(
  workspace: ModWorkspace,
  projectPath: string,
): Promise<NativeProjectOpenResult> {
  if (typeof window === 'undefined' || window.parent === window) {
    return { ok: false, materialized: false, message: 'Native diffs are available in the installed Antigravity/VS Code extension.' };
  }
  try {
    const inventoryResponse = await fetch('/api/agent/project/files', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace }),
    });
    const inventory = await inventoryResponse.json() as NativeProjectInventoryResponse;
    const entry = inventory.entries?.find(candidate => candidate.path === projectPath);
    if (!inventoryResponse.ok || !entry || !entry.openable || !entry.text || !inventory.sourceFolder) {
      throw new Error(inventory.error || `${projectPath} has no source/generated text pair to compare.`);
    }
    const [sourceResponse, compileResponse] = await Promise.all([
      fetch(`/api/fs/read?root=workspace&path=${encodeURIComponent(`${inventory.sourceFolder}/${projectPath}`)}`),
      fetch('/api/agent/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace }),
      }),
    ]);
    const source = await sourceResponse.json() as { content?: string; error?: string };
    const compiled = await compileResponse.json() as { files?: Record<string, string>; error?: string };
    const generated = compiled.files?.[projectPath];
    if (!sourceResponse.ok || typeof source.content !== 'string') throw new Error(source.error || `Could not read ${projectPath}.`);
    if (!compileResponse.ok || typeof generated !== 'string') throw new Error(compiled.error || `Forge did not generate ${projectPath}.`);
    if (new Blob([source.content]).size > 8 * 1024 * 1024 || new Blob([generated]).size > 8 * 1024 * 1024) {
      throw new Error('Native diff preview is limited to 8 MB per text side. The source file remains editable in Antigravity.');
    }
    const opened = openNativeTextDiff({
      title: `Forge Source vs Generated — ${projectPath}`,
      leftLabel: `${projectPath} (workspace source)`,
      rightLabel: `${projectPath} (Forge generated)`,
      leftContent: source.content,
      rightContent: generated,
      language: projectPath.toLowerCase().endsWith('.xml') ? 'xml' : projectPath.toLowerCase().endsWith('.lua') ? 'lua' : 'text',
    });
    return opened
      ? { ok: true, materialized: false, message: `Opened a read-only native diff for ${projectPath}.` }
      : { ok: false, materialized: false, message: 'Native diffs are available in the installed Antigravity/VS Code extension.' };
  } catch (error) {
    return { ok: false, materialized: false, message: error instanceof Error ? error.message : `Could not compare ${projectPath}.` };
  }
}

/**
 * Ask the VS Code/Antigravity extension host to open a real workspace file.
 * Standalone browser builds degrade honestly: they have no native editor host.
 */
export function openInNativeEditor(
  path: string,
  position?: { line?: number; column?: number },
  sourceFolder?: string,
): boolean {
  if (typeof window === 'undefined' || window.parent === window) return false;
  const message: NativeEditorOpenRequest = {
    source: 'x4forge-studio',
    type: 'open-workspace-file',
    path,
    ...(sourceFolder ? { sourceFolder } : {}),
    ...(Number.isInteger(position?.line) ? { line: position!.line } : {}),
    ...(Number.isInteger(position?.column) ? { column: position!.column } : {}),
  };
  window.parent.postMessage(message, '*');
  return true;
}

/** Open an ephemeral, read-only two-pane diff in the native IDE host. */
export function openNativeTextDiff(options: Omit<NativeTextDiffRequest, 'source' | 'type'>): boolean {
  if (typeof window === 'undefined' || window.parent === window) return false;
  const message: NativeTextDiffRequest = { source: 'x4forge-studio', type: 'open-text-diff', ...options };
  window.parent.postMessage(message, '*');
  return true;
}

export function openNativeNodeSelection(options: Omit<NativeNodeSelectionRequest, 'source' | 'type' | 'requestId'>): boolean {
  if (typeof window === 'undefined' || window.parent === window) return false;
  const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `node-${Date.now()}-${Math.random()}`;
  const message: NativeNodeSelectionRequest = { source: 'x4forge-studio', type: 'open-node-selection', requestId, ...options };
  window.parent.postMessage(message, '*');
  return true;
}

export function postNativeNodeSelectionResult(result: Omit<NativeNodeSelectionResult, 'source' | 'type'>): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  const message: NativeNodeSelectionResult = { source: 'x4forge-studio', type: 'node-selection-result', ...result };
  window.parent.postMessage(message, '*');
}

/**
 * Route one of Forge's two credited/support links through the installed IDE host.
 * Returning false deliberately leaves an ordinary anchor in charge in a standalone browser.
 */
export function openExternalUrlInNativeHost(url: string): boolean {
  if (!NATIVE_EXTERNAL_URLS.has(url) || typeof window === 'undefined' || window.parent === window) return false;
  const message: NativeExternalUrlRequest = {
    source: 'x4forge-studio',
    type: 'open-external-url',
    url: url as NativeExternalUrlRequest['url'],
  };
  window.parent.postMessage(message, '*');
  return true;
}

/**
 * Open a real source file in Antigravity. Generated-only text is first written
 * through Forge's validated, compare-and-swap write route; existing source is
 * never overwritten when its bytes disagree with the canvas compiler.
 */
export async function openOrMaterializeInNativeEditor(
  workspace: ModWorkspace,
  projectPath: string,
): Promise<NativeProjectOpenResult> {
  if (typeof window === 'undefined' || window.parent === window) {
    return { ok: false, materialized: false, message: 'Native tabs are available in the installed Antigravity/VS Code extension.' };
  }

  try {
    const inventoryResponse = await fetch('/api/agent/project/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace }),
    });
    const inventory = await inventoryResponse.json() as NativeProjectInventoryResponse;
    if (!inventoryResponse.ok && !inventory.entries) {
      throw new Error(inventory.error || inventory.errors?.join(' ') || `HTTP ${inventoryResponse.status}`);
    }
    const entry = inventory.entries?.find(candidate => candidate.path === projectPath);
    if (!entry) return { ok: false, materialized: false, message: `${projectPath} is not part of the compiled project.` };
    if (!entry.text) return { ok: false, materialized: false, message: `${projectPath} is preserved as binary data and cannot be opened as text.` };
    if (entry.openable) {
      openInNativeEditor(projectPath, undefined, inventory.sourceFolder || undefined);
      return { ok: true, materialized: false, message: `Opened ${projectPath} in Antigravity.` };
    }
    if (entry.state === 'conflict') {
      return {
        ok: false,
        materialized: false,
        message: `${projectPath} differs from the canvas-generated bytes. Forge refused to overwrite it; open the source from the project inventory and reconcile it explicitly.`,
      };
    }
    if (!entry.materializable || !inventory.sourceFolder) {
      return {
        ok: false,
        materialized: false,
        message: `${projectPath} has no editable source copy yet. Import or compile this mod into the configured Mod Workspace first.`,
      };
    }

    const compileResponse = await fetch('/api/agent/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace }),
    });
    const compiled = await compileResponse.json() as { files?: Record<string, string>; error?: string };
    const content = compiled.files?.[projectPath];
    if (!compileResponse.ok || typeof content !== 'string') {
      throw new Error(compiled.error || `Forge did not generate ${projectPath}.`);
    }
    const materializeFile = async (relativePath: string, fileContent: string) => {
      const writeResponse = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${inventory.sourceFolder}/${relativePath}`,
          content: fileContent,
          strict: true,
          expectedSha256: null,
        }),
      });
      const written = await writeResponse.json() as { error?: string };
      if (!writeResponse.ok) throw new Error(written.error || `HTTP ${writeResponse.status}`);
    };
    // A brand-new source folder needs its manifest created before any nested file can
    // become a usable mod. Existing source folders already have content.xml (that is
    // how the inventory recognizes them), so leave that source-owned manifest alone.
    if (needsManifestMaterialization(projectPath, Boolean(inventory.sourceAvailable))) {
      const manifest = compiled.files?.['content.xml'];
      if (typeof manifest !== 'string') throw new Error('Forge did not generate content.xml for the materialized mod.');
      await materializeFile('content.xml', manifest);
    }
    await materializeFile(projectPath, content);
    openInNativeEditor(projectPath, undefined, inventory.sourceFolder);
    return {
      ok: true,
      materialized: true,
      message: `${projectPath} was materialized through Forge validation and opened in Antigravity.`,
    };
  } catch (error) {
    return {
      ok: false,
      materialized: false,
      message: error instanceof Error ? error.message : `Could not open ${projectPath}.`,
    };
  }
}
