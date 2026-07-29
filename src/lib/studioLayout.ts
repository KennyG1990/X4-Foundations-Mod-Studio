import type { WorkspaceView } from './experienceMode';

export const STUDIO_LAYOUT_KEY = 'x4_forge_studio_layout_v1';
export const STUDIO_LAYOUT_VERSION = 1 as const;

export const WORKSPACE_NAV_ITEMS = [
  { id: 'blueprint', label: 'MD Scripts', shortLabel: 'MD', sidebarTab: 'script' },
  { id: 'aiscripts', label: 'AI Scripts', shortLabel: 'AI', sidebarTab: 'script' },
  { id: 'libraries', label: 'Wares & Jobs', shortLabel: 'Data', sidebarTab: 'config' },
  { id: 'ui-designer', label: 'HUD & Lua UI', shortLabel: 'UI', sidebarTab: 'ui' },
  { id: 'xmlpatch', label: 'XML Patching', shortLabel: 'Patch', sidebarTab: 'config' },
  { id: 'project', label: 'Project', shortLabel: 'Project', sidebarTab: 'config' },
  { id: 'galaxy', label: 'Galaxy', shortLabel: 'Galaxy', sidebarTab: 'reference' },
  { id: 'contracts', label: 'Contracts', shortLabel: 'Contracts', sidebarTab: 'config' },
  { id: 'translation', label: 'Languages (t/)', shortLabel: 'T/', sidebarTab: 'config' },
  { id: 'wiki', label: 'X4 Wiki', shortLabel: 'Wiki', sidebarTab: 'config' },
] as const satisfies ReadonlyArray<{
  id: WorkspaceView;
  label: string;
  shortLabel: string;
  sidebarTab: SidebarTab;
}>;

export type SidebarTab =
  | 'script'
  | 'cues'
  | 'ui'
  | 'config'
  | 'filesystem'
  | 'git'
  | 'templates'
  | 'ai'
  | 'playtest'
  | 'diagnostics'
  | 'reference';

export const SIDEBAR_NAV_ITEMS = [
  { id: 'script', label: 'Nodes' },
  { id: 'cues', label: 'Cues' },
  { id: 'ui', label: 'Widgets' },
  { id: 'config', label: 'Meta' },
  { id: 'filesystem', label: 'Files' },
  { id: 'git', label: 'Source' },
  { id: 'templates', label: 'Templates' },
  { id: 'ai', label: 'AI Guide' },
  { id: 'playtest', label: 'Playtest' },
  { id: 'diagnostics', label: 'Diagnose' },
  { id: 'reference', label: 'Objects' },
] as const satisfies ReadonlyArray<{ id: SidebarTab; label: string }>;

export const GLOBAL_ACTION_IDS = [
  'undo',
  'redo',
  'shortcuts',
  'workspace-switcher',
  'native-project-files',
  'sync-mod',
  'ai-settings',
  'agent-api',
  'report-bug',
  'settings',
  'reset-workspace',
  'experience-mode',
] as const;

export type WorkspaceDock = 'top' | 'bottom';
export type ToolDock = 'left' | 'right';
export type StudioDensity = 'compact' | 'comfortable';

export interface StudioLayoutPreferences {
  version: typeof STUDIO_LAYOUT_VERSION;
  workspaceOrder: WorkspaceView[];
  hiddenWorkspaceViews: WorkspaceView[];
  workspaceDock: WorkspaceDock;
  workspaceBarCollapsed: boolean;
  toolOrder: SidebarTab[];
  hiddenTools: SidebarTab[];
  toolDock: ToolDock;
  toolRailCollapsed: boolean;
  sidePanelCollapsed: boolean;
  density: StudioDensity;
}

const WORKSPACE_IDS = WORKSPACE_NAV_ITEMS.map(item => item.id);
const TOOL_IDS = SIDEBAR_NAV_ITEMS.map(item => item.id);

export const DEFAULT_STUDIO_LAYOUT: StudioLayoutPreferences = {
  version: STUDIO_LAYOUT_VERSION,
  workspaceOrder: [...WORKSPACE_IDS],
  hiddenWorkspaceViews: [],
  workspaceDock: 'top',
  workspaceBarCollapsed: false,
  toolOrder: [...TOOL_IDS],
  hiddenTools: [],
  toolDock: 'left',
  toolRailCollapsed: false,
  sidePanelCollapsed: false,
  density: 'compact',
};

function normalizedOrder<T extends string>(raw: unknown, all: readonly T[]): T[] {
  const allowed = new Set<string>(all);
  const seen = new Set<string>();
  const result: T[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== 'string' || !allowed.has(item) || seen.has(item)) continue;
      seen.add(item);
      result.push(item as T);
    }
  }
  for (const item of all) if (!seen.has(item)) result.push(item);
  return result;
}

function normalizedHidden<T extends string>(raw: unknown, all: readonly T[]): T[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(all);
  const result = Array.from(new Set(raw.filter((item): item is T => typeof item === 'string' && allowed.has(item))));
  return result.length >= all.length ? [] : result;
}

export function normalizeStudioLayoutPreferences(raw: unknown): StudioLayoutPreferences {
  const value = raw && typeof raw === 'object' ? raw as Partial<StudioLayoutPreferences> : {};
  return {
    version: STUDIO_LAYOUT_VERSION,
    workspaceOrder: normalizedOrder(value.workspaceOrder, WORKSPACE_IDS),
    hiddenWorkspaceViews: normalizedHidden(value.hiddenWorkspaceViews, WORKSPACE_IDS),
    workspaceDock: value.workspaceDock === 'bottom' ? 'bottom' : 'top',
    workspaceBarCollapsed: value.workspaceBarCollapsed === true,
    toolOrder: normalizedOrder(value.toolOrder, TOOL_IDS),
    hiddenTools: normalizedHidden(value.hiddenTools, TOOL_IDS),
    toolDock: value.toolDock === 'right' ? 'right' : 'left',
    toolRailCollapsed: value.toolRailCollapsed === true,
    sidePanelCollapsed: value.sidePanelCollapsed === true,
    density: value.density === 'comfortable' ? 'comfortable' : 'compact',
  };
}

export function parseStudioLayoutPreferences(raw: string | null | undefined): StudioLayoutPreferences {
  if (!raw) return normalizeStudioLayoutPreferences(undefined);
  try {
    return normalizeStudioLayoutPreferences(JSON.parse(raw));
  } catch {
    return normalizeStudioLayoutPreferences(undefined);
  }
}

export function moveOrderedItem<T extends string>(order: readonly T[], id: T, target: T | number): T[] {
  const next = order.filter(item => item !== id);
  const targetIndex = typeof target === 'number' ? target : next.indexOf(target);
  const index = Math.max(0, Math.min(next.length, targetIndex < 0 ? next.length : targetIndex));
  next.splice(index, 0, id);
  return next;
}

export function toggleVisibleItem<T extends string>(hidden: readonly T[], id: T, all: readonly T[]): T[] {
  if (hidden.includes(id)) return hidden.filter(item => item !== id);
  const next = [...hidden, id];
  return next.length >= all.length ? [...hidden] : next;
}

export function visibleWorkspaceViews(layout: StudioLayoutPreferences): WorkspaceView[] {
  return layout.workspaceOrder.filter(id => !layout.hiddenWorkspaceViews.includes(id));
}

export function visibleSidebarTabs(layout: StudioLayoutPreferences, aiEnabled = true): SidebarTab[] {
  const visible = layout.toolOrder.filter(id => !layout.hiddenTools.includes(id) && (id !== 'ai' || aiEnabled));
  if (visible.length > 0) return visible;
  return layout.toolOrder.filter(id => id !== 'ai').slice(0, 1);
}

export function runStudioLayoutSelftest() {
  const checks: Array<{ name: string; pass: boolean; detail?: unknown }> = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, detail });
  const fallback = parseStudioLayoutPreferences('{broken');
  ok('corrupt_storage_recovers', fallback.workspaceOrder.length === WORKSPACE_IDS.length && fallback.toolOrder.length === TOOL_IDS.length, fallback);
  const normalized = normalizeStudioLayoutPreferences({
    workspaceOrder: ['wiki', 'wiki', 'missing', 'blueprint'],
    hiddenWorkspaceViews: WORKSPACE_IDS,
    toolOrder: ['reference', 'reference'],
    hiddenTools: TOOL_IDS,
    workspaceDock: 'sideways',
    toolDock: 'ceiling',
  });
  ok('workspace_inventory_is_lossless', new Set(normalized.workspaceOrder).size === WORKSPACE_IDS.length && WORKSPACE_IDS.every(id => normalized.workspaceOrder.includes(id)));
  ok('tool_inventory_is_lossless', new Set(normalized.toolOrder).size === TOOL_IDS.length && TOOL_IDS.every(id => normalized.toolOrder.includes(id)));
  ok('all_hidden_workspace_recovers', normalized.hiddenWorkspaceViews.length === 0);
  ok('all_hidden_tools_recovers', normalized.hiddenTools.length === 0);
  ok('invalid_docks_recover', normalized.workspaceDock === 'top' && normalized.toolDock === 'left');
  ok('move_is_stable', moveOrderedItem(['a', 'b', 'c'], 'c', 'a').join(',') === 'c,a,b');
  ok('move_can_reach_end', moveOrderedItem(['a', 'b', 'c'], 'a', 2).join(',') === 'b,c,a');
  ok('cannot_hide_last_item', toggleVisibleItem(['a', 'b'], 'c', ['a', 'b', 'c']).join(',') === 'a,b');
  ok('ai_off_cannot_empty_tool_rail', visibleSidebarTabs(normalizeStudioLayoutPreferences({ hiddenTools: TOOL_IDS.filter(id => id !== 'ai') }), false).length === 1);
  ok('global_action_inventory_complete', GLOBAL_ACTION_IDS.length === 12 && new Set(GLOBAL_ACTION_IDS).size === GLOBAL_ACTION_IDS.length);
  return { ok: checks.every(check => check.pass), checks };
}
