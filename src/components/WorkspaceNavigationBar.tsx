import React from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileCode,
  FolderGit2,
  GitFork,
  Globe,
  GripVertical,
  Layout,
  Map as MapIcon,
  Package,
  Plug,
  Scroll,
} from 'lucide-react';
import type { WorkspaceView } from '../lib/experienceMode';
import {
  WORKSPACE_NAV_ITEMS,
  visibleWorkspaceViews,
  type StudioLayoutPreferences,
} from '../lib/studioLayout';

const ICONS: Record<WorkspaceView, React.ComponentType<{ className?: string }>> = {
  blueprint: GitFork,
  aiscripts: Scroll,
  libraries: Package,
  'ui-designer': Layout,
  xmlpatch: FileCode,
  project: FolderGit2,
  galaxy: MapIcon,
  contracts: Plug,
  translation: Globe,
  wiki: BookOpen,
};

interface WorkspaceNavigationBarProps {
  layout: StudioLayoutPreferences;
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  onMove: (view: WorkspaceView, target: WorkspaceView | number) => void;
  onToggleCollapsed: () => void;
  mdErrorCount: number;
  mdWarningCount: number;
}

export default function WorkspaceNavigationBar({
  layout,
  activeView,
  onNavigate,
  onMove,
  onToggleCollapsed,
  mdErrorCount,
  mdWarningCount,
}: WorkspaceNavigationBarProps) {
  const [dragged, setDragged] = React.useState<WorkspaceView | null>(null);
  const visible = visibleWorkspaceViews(layout);
  const isBottom = layout.workspaceDock === 'bottom';

  if (layout.workspaceBarCollapsed) {
    return (
      <div
        data-testid="workspace-bar-collapsed"
        className={`shrink-0 flex justify-center bg-[#10131a] ${isBottom ? 'border-t' : 'border-b'} border-white/10`}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="h-5 px-3 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-cyan-400 hover:bg-cyan-500/10"
          title="Show workspace navigation"
        >
          {isBottom ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Workspaces
        </button>
      </div>
    );
  }

  return (
    <nav
      id="view_selection_modes"
      data-testid="workspace-navigation"
      data-dock={layout.workspaceDock}
      aria-label="Forge workspaces"
      className={`shrink-0 min-w-0 bg-[#11151c] ${isBottom ? 'border-t' : 'border-b'} border-white/10`}
    >
      <div className="h-9 min-w-0 flex items-center gap-1 px-2">
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto custom-scrollbar">
          {visible.map(id => {
            const item = WORKSPACE_NAV_ITEMS.find(candidate => candidate.id === id)!;
            const Icon = ICONS[id];
            const active = activeView === id;
            const isMd = id === 'blueprint';
            const severityClass = isMd && mdErrorCount > 0
              ? active ? 'bg-red-500/15 text-red-300 border-red-500/45' : 'text-red-400 border-red-500/20'
              : isMd && mdWarningCount > 0
                ? active ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'text-amber-400 border-amber-500/15'
                : active
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5';
            return (
              <button
                key={id}
                type="button"
                data-workspace-view={id}
                aria-current={active ? 'page' : undefined}
                draggable
                onDragStart={() => setDragged(id)}
                onDragEnd={() => setDragged(null)}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault();
                  if (dragged && dragged !== id) {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const remaining = layout.workspaceOrder.filter(item => item !== dragged);
                    const targetIndex = remaining.indexOf(id);
                    onMove(dragged, targetIndex + (event.clientX > rect.left + rect.width / 2 ? 1 : 0));
                  }
                  setDragged(null);
                }}
                onClick={() => onNavigate(id)}
                aria-label={item.label}
                className={`h-7 shrink-0 rounded border px-2 inline-flex items-center gap-1.5 font-mono font-bold uppercase transition-colors ${severityClass}`}
                title={item.label}
              >
                <GripVertical className="hidden sm:block w-2.5 h-2.5 opacity-35" aria-hidden="true" />
                <Icon className="w-3.5 h-3.5" />
                <span className={`${layout.density === 'compact' ? 'hidden xl:inline text-[9px]' : 'hidden lg:inline text-[10px]'}`}>
                  {item.label}
                </span>
                {isMd && (mdErrorCount > 0 || mdWarningCount > 0) && (
                  <span className={`w-1.5 h-1.5 rounded-full ${mdErrorCount > 0 ? 'bg-red-400' : 'bg-amber-400'}`} />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="h-7 w-7 shrink-0 grid place-items-center rounded text-slate-500 hover:text-cyan-300 hover:bg-white/5"
          title="Hide workspace navigation"
          data-testid="workspace-nav-collapse"
        >
          {isBottom ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
    </nav>
  );
}
