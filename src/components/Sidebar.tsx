/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  FolderGit2,
  Layers,
  Layout,
  Settings,
  Plus,
  Sliders,
  Wrench,
  Sparkles,
  Info,
  BookOpen,
  ChevronRight,
  PackageCheck,
  Folder,
  HardDrive,
  GitBranch,
  Compass,
  Library,
  Trash2,
  Activity,
  Terminal,
  Database
} from 'lucide-react';
import { 
  NODE_TEMPLATES,
  ModWorkspace,
  MDNode, 
  UIWidget,
  ChatMessage,
  PackageDiagnostic
} from '../types';
import DirectoryExplorer from './DirectoryExplorer';
import DiagnosticsHub from './DiagnosticsHub';
import PropertiesInspector from './PropertiesInspector';
import { toContentVersion } from '../lib/modCompiler';
import DiagnosticsCenter from './DiagnosticsCenter';
import SnapshotManager from './SnapshotManager';
import SourceControl from './SourceControl';
import ErrorBoundary from './ErrorBoundary';
import CueViewer from './CueViewer';
import AIHelper from './AIHelper';
import ObjectBrowser from './ObjectBrowser';
import type { ModBlueprint } from '../lib/modBlueprint';
import { MOD_PATTERNS, stampPatternIntoWorkspace } from '../lib/modPatterns';
import type { ArchitectStepView } from './BlueprintPanel';
import VirtualizedNodeToolbox from './VirtualizedNodeToolbox';
import type { DiagnosticsScope } from './DiagnosticsCenter';
import { applyNodePropertyChange, isNodeSelectionFailure } from '../lib/nodeSelectionDocument';

interface SidebarProps {
  width?: number;
  /** A4.1 — AI presence gate. When false (tier=off), the AI Co-pilot tab is absent. */
  aiEnabled?: boolean;
  /** Live md.xsd tag set for the AI review's unknown-tag check (forwarded to AIHelper). */
  aiKnownTags?: Set<string>;
  /** A4.3 — active AI presence tier (forwarded to AIHelper to gate Builder/Architect surfaces). */
  aiTier?: 'off' | 'explain' | 'assist' | 'cobuild';
  /** A5.2 — Architect blueprint + agent-loop controls (forwarded to AIHelper). */
  architectBlueprint?: ModBlueprint;
  onBlueprintChange?: (b: ModBlueprint) => void;
  onRunArchitectStep?: () => void;
  architectRunning?: boolean;
  architectStep?: ArchitectStepView | null;
  onConfirmArchitectStep?: () => void;
  onDeclineArchitectStep?: () => void;
  architectCanRun?: boolean;
  architectRunDisabledReason?: string;
  /** A4.7 — abort the in-flight AI request (forwarded to AIHelper). */
  onAiCancel?: () => void;
  activeTab: 'script' | 'ui' | 'config' | 'filesystem' | 'git' | 'cues' | 'templates' | 'ai' | 'diagnostics' | 'playtest' | 'reference';
  setActiveTab: (tab: 'script' | 'ui' | 'config' | 'filesystem' | 'git' | 'cues' | 'templates' | 'ai' | 'diagnostics' | 'playtest' | 'reference') => void;
  workspace: ModWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ModWorkspace>>;
  onAddNode: (template: Omit<MDNode, 'id' | 'x' | 'y'>) => void;
  onAddUIWidget: (type: string) => void;
  selectedNode: MDNode | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<MDNode | null>>;
  selectedWidget: UIWidget | null;
  setSelectedWidget: React.Dispatch<React.SetStateAction<UIWidget | null>>;
  modWorkspacePath: string;
  filesystemPath: string;
  saveCheckpoint: (customTarget?: ModWorkspace) => void;
  workspaceView?: 'blueprint' | 'ui-designer' | 'aiscripts' | 'libraries' | 'xmlpatch' | 'contracts' | 'translation' | 'wiki' | 'project' | 'galaxy';
  setWorkspaceView?: (view: 'blueprint' | 'ui-designer' | 'aiscripts' | 'libraries' | 'xmlpatch' | 'contracts' | 'translation' | 'wiki' | 'project' | 'galaxy') => void;
  schemaTemplates?: Omit<MDNode, 'id' | 'x' | 'y'>[];
  onSchemaConfigChanged?: () => Promise<void> | void;
  /** Opens the Directory Settings modal — the single authority for the XSD schema directory. */
  onOpenDirectorySettings?: () => void;
  /** Bumped by App when the Directory Settings modal closes, so the read-only schema panel refreshes. */
  schemaConfigVersion?: number;
  onOpenEditorFile?: (file: {
    name: string;
    path: string;
    content: string;
    handle?: FileSystemFileHandle;
    isMock?: boolean;
    isSaved?: boolean;
  }) => void;
  workspaceDirMode?: 'candy' | 'store';
  setWorkspaceDirMode?: (mode: 'candy' | 'store') => void;
  compileStatus?: 'idle' | 'compiling' | 'success' | 'error';
  compileMessage?: string;
  handleCompileModProject?: () => Promise<void>;
  visibleCueIds: string[] | null;
  setVisibleCueIds: (ids: string[] | null) => void;
  setFocusNodeRequest: (req: { nodeId: string; timestamp: number } | null) => void;
  
  // AI Guide Shared State & Handlers
  aiChatHistory: ChatMessage[];
  setAiChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  aiInputText: string;
  setAiInputText: (text: string) => void;
  aiActiveMode: 'chat' | 'builder' | 'architect';
  setAiActiveMode: (mode: 'chat' | 'builder' | 'architect') => void;
  aiLoading: boolean;
  aiErrorText: string | null;
  isAiFloatingVisible: boolean;
  setIsAiFloatingVisible: (visible: boolean) => void;
  isAiFloatingOpen: boolean;
  setIsAiFloatingOpen: (open: boolean) => void;
  handleSend: (text: string) => void;
  handleApplyAction: (index: number, msg: ChatMessage) => void;
  handleDeclineAction: (index: number) => void;

  diagnostics: PackageDiagnostic[];
  diagnosticSource: 'checking' | 'project' | 'local';
  diagnosticsScope?: DiagnosticsScope;
  onSelectSnapshot?: (snapWS: ModWorkspace | null) => void;
  autoSaveEnabled?: boolean;
  setAutoSaveEnabled?: (val: boolean) => void;
}

export default function Sidebar({
  width,
  aiEnabled = false,
  aiKnownTags,
  aiTier,
  architectBlueprint,
  onBlueprintChange,
  onRunArchitectStep,
  architectRunning,
  architectStep,
  onConfirmArchitectStep,
  onDeclineArchitectStep,
  architectCanRun,
  architectRunDisabledReason,
  onAiCancel,
  activeTab,
  setActiveTab,
  workspace,
  setWorkspace,
  onAddNode,
  onAddUIWidget,
  selectedNode,
  setSelectedNode,
  selectedWidget,
  setSelectedWidget,
  modWorkspacePath,
  filesystemPath,
  saveCheckpoint,
  workspaceView,
  setWorkspaceView,
  schemaTemplates,
  onSchemaConfigChanged: _onSchemaConfigChanged,
  onOpenDirectorySettings,
  schemaConfigVersion,
  onOpenEditorFile,
  workspaceDirMode,
  setWorkspaceDirMode,
  compileStatus,
  compileMessage,
  handleCompileModProject,
  visibleCueIds,
  setVisibleCueIds,
  setFocusNodeRequest,
  aiChatHistory,
  setAiChatHistory,
  aiInputText,
  setAiInputText,
  aiActiveMode,
  setAiActiveMode,
  aiLoading,
  aiErrorText,
  isAiFloatingVisible,
  setIsAiFloatingVisible,
  isAiFloatingOpen: _isAiFloatingOpen,
  setIsAiFloatingOpen: _setIsAiFloatingOpen,
  handleSend,
  handleApplyAction,
  handleDeclineAction,
  diagnostics,
  diagnosticSource,
  diagnosticsScope,
  onSelectSnapshot,
  autoSaveEnabled,
  setAutoSaveEnabled
}: SidebarProps) {
  const [nodeFilter, setNodeFilter] = useState<'all' | 'cue' | 'event' | 'condition' | 'action'>('all');
  const [schemaDir, setSchemaDir] = useState<string>('');

  // Custom templates tab sidebar states
  const [newTemplateName, setNewTemplateName] = useState<string>('New Custom Blueprint');
  const [newTemplateTypeIdx, setNewTemplateTypeIdx] = useState<number>(0);
  const [editedTemplateId, setEditedTemplateId] = useState<string | null>(null);
  const [editedTemplateLabel, setEditedTemplateLabel] = useState<string>('');
  const [editedTemplateXmlTag, setEditedTemplateXmlTag] = useState<string>('');
  const [schemaStatus, setSchemaStatus] = useState<{
    mdXsdPath?: string;
    commonXsdPath?: string;
    mdExists?: boolean;
    commonExists?: boolean;
    loaded?: boolean;
    counts?: { events: number; conditions: number; actions: number; control_flow: number };
    files?: Array<{
      domain: string;
      file: string;
      sizeBytes: number;
      includes: string[];
      missingIncludes: string[];
    }>;
    error?: string;
  }>({});
  const [schemaMessage, setSchemaMessage] = useState<string>('');
  const [schemaMessageType, setSchemaMessageType] = useState<'success' | 'error'>('success');
  const [propertyEditError, setPropertyEditError] = useState<string>('');

  const compileSettings = workspace.compileSettings || {
    md: true,
    ui: true,
    ai: true,
    library: true,
    translations: true,
    patches: true
  };

  const handleToggleCompileSetting = (key: 'md' | 'ui' | 'ai' | 'library' | 'translations' | 'patches') => {
    setWorkspace(prev => ({
      ...prev,
      compileSettings: {
        ...compileSettings,
        [key]: !compileSettings[key]
      }
    }));
  };

  const handleSendCuePackageToAIGuide = () => {
    if (!selectedNode) return;

    // 1. Gather linked nodes
    const links = workspace.links || [];
    const connectedNodeIds = new Set<string>();
    links.forEach(l => {
      if (l.sourceNodeId === selectedNode.id) connectedNodeIds.add(l.targetNodeId);
      if (l.targetNodeId === selectedNode.id) connectedNodeIds.add(l.sourceNodeId);
    });

    const dependencies = (workspace.nodes || []).filter(n => connectedNodeIds.has(n.id));

    // 2. Format highly detailed prompt context message
    let serializedContext = `### SELECTED ELEMENT NODE\n- Label: "${selectedNode.label}"\n- XML Tag: <${selectedNode.xmlTag}>\n`;
    if (Object.keys(selectedNode.properties || {}).length > 0) {
      serializedContext += `  Properties:\n`;
      Object.entries(selectedNode.properties).forEach(([k, v]) => {
        serializedContext += `    - ${k}: ${JSON.stringify(v)}\n`;
      });
    }
    if (selectedNode.comment) {
      serializedContext += `  Comment Annotation: "${selectedNode.comment}"\n`;
    }

    if (dependencies.length > 0) {
      serializedContext += `\n### DEPENDENCIES & CONNECTING NODES\n`;
      dependencies.forEach(dep => {
        serializedContext += `- Relation Connection: <${dep.xmlTag}> Tag, labeled "${dep.label}"\n`;
        if (Object.keys(dep.properties || {}).length > 0) {
          serializedContext += `  Properties:\n`;
          Object.entries(dep.properties).forEach(([k, v]) => {
            serializedContext += `    - ${k}: ${JSON.stringify(v)}\n`;
          });
        }
      });
    }

    // 3. Dispatch global open-ai-chat event
    const promptMessage = `I would like to edit my mission cue sequence. Here is the active selected node and its dependency graph context:\n\n${serializedContext}\n\nPlease analyze this cue structure, offer feedback on Egosoft engine compliance, and guide me on how to enhance this sequence or introduce custom conditions & action events!`;

    const event = new CustomEvent('open-ai-chat', {
      detail: { prompt: promptMessage }
    });
    window.dispatchEvent(event);
  };

  const allTemplates = React.useMemo(() => {
    const byTag = new Map<string, Omit<MDNode, 'id' | 'x' | 'y'>>();
    NODE_TEMPLATES.forEach(template => byTag.set(template.xmlTag, template));
    schemaTemplates.forEach(template => {
      if (!byTag.has(template.xmlTag)) byTag.set(template.xmlTag, template);
    });
    return Array.from(byTag.values());
  }, [schemaTemplates]);

  const loadSchemaConfig = React.useCallback(async () => {
    try {
      const [response, registryResponse] = await Promise.all([
        fetch('/api/schema/config'),
        fetch('/api/agent/schema-registry'),
      ]);
      if (!response.ok) throw new Error('Schema config endpoint unavailable');
      const data = await response.json();
      const registry = registryResponse.ok
        ? await registryResponse.json() as { domains?: Array<{ domain: string; file: string; sizeBytes: number; includes?: string[]; missingIncludes?: string[] }> }
        : { domains: [] };
      setSchemaDir(data.resolved?.schemaDir || '');
      setSchemaStatus({
        mdXsdPath: data.resolved?.mdXsdPath,
        commonXsdPath: data.resolved?.commonXsdPath,
        mdExists: data.resolved?.mdExists,
        commonExists: data.resolved?.commonExists,
        loaded: data.loaded,
        counts: data.schema_counts,
        files: (registry.domains || []).map(file => ({
          domain: file.domain,
          file: file.file,
          sizeBytes: file.sizeBytes,
          includes: file.includes || [],
          missingIncludes: file.missingIncludes || [],
        })),
        error: data.error
      });
      setSchemaMessage('');
      setSchemaMessageType('success');
    } catch (error: unknown) {
      setSchemaMessage(error instanceof Error ? error.message : 'Failed to load schema settings.');
      setSchemaMessageType('error');
    }
  }, []);

  useEffect(() => {
    loadSchemaConfig();
  }, [loadSchemaConfig, schemaConfigVersion]);

  // Property editor change handling
  const handlePropChange = (key: string, value: unknown) => {
    if (selectedNode) {
      const applied = applyNodePropertyChange(workspace, selectedNode.id, key, value);
      if (isNodeSelectionFailure(applied)) {
        setPropertyEditError(applied.message);
        return;
      }
      setPropertyEditError('');
      setWorkspace(applied.workspace);
      setSelectedNode(applied.workspace.nodes.find(node => node.id === selectedNode.id) || null);
    } else if (selectedWidget) {
      setWorkspace(prev => ({
        ...prev,
        uiWidgets: prev.uiWidgets.map(w => 
          w.id === selectedWidget.id 
            ? { ...w, properties: { ...w.properties, [key]: value } }
            : w
        )
      }));
      // Update selected widget state to sync preview
      setSelectedWidget(prev => prev ? { ...prev, properties: { ...prev.properties, [key]: value } } : null);
    }
  };

  const handleLabelChange = (newLabel: string) => {
    if (selectedNode) {
      setWorkspace(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => 
          n.id === selectedNode.id ? { ...n, label: newLabel } : n
        )
      }));
      setSelectedNode(prev => prev ? { ...prev, label: newLabel } : null);
    } else if (selectedWidget) {
      setWorkspace(prev => ({
        ...prev,
        uiWidgets: prev.uiWidgets.map(w => 
          w.id === selectedWidget.id ? { ...w, label: newLabel } : w
        )
      }));
      setSelectedWidget(prev => prev ? { ...prev, label: newLabel } : null);
    }
  };

  return (
    <div
      id="side_panel"
      style={{ width }}
      className="border-r border-white/5 bg-[#12141a] flex h-full text-slate-300 min-w-0"
    >
      {/* Left Icon Strip */}
      <div className="w-[52px] bg-[#0a0c10] border-r border-white/5 flex flex-col items-center py-4 gap-2.5 shrink-0">
        <button
          id="tab_script"
          onClick={() => setActiveTab('script')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'script'
              ? 'text-cyan-400 bg-cyan-950/20 border-l-2 border-cyan-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="MD Nodes"
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full">NODES</span>
        </button>

        <button
          id="tab_cues"
          onClick={() => setActiveTab('cues')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'cues'
              ? 'text-purple-400 bg-purple-950/20 border-l-2 border-purple-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="Cues"
        >
          <Compass className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full">CUES</span>
        </button>

        <button
          id="tab_ui"
          onClick={() => setActiveTab('ui')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'ui'
              ? 'text-cyan-400 bg-cyan-950/20 border-l-2 border-cyan-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="Menu Widgets"
        >
          <Layout className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full">WIDGETS</span>
        </button>

        <button
          id="tab_config"
          onClick={() => setActiveTab('config')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'config'
              ? 'text-cyan-400 bg-cyan-950/20 border-l-2 border-cyan-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="Mod Meta"
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full">META</span>
        </button>

        <button
          id="tab_filesystem"
          onClick={() => setActiveTab('filesystem')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'filesystem'
              ? 'text-cyan-400 bg-cyan-950/20 border-l-2 border-cyan-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="Filesystem"
        >
          <FolderGit2 className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full">FILES</span>
        </button>

        <button
          id="tab_git"
          onClick={() => setActiveTab('git')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'git'
              ? 'text-cyan-400 bg-cyan-950/20 border-l-2 border-cyan-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="Source Control"
        >
          <GitBranch className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full">SOURCE</span>
        </button>

        <button
          id="tab_templates"
          onClick={() => setActiveTab('templates')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'templates'
              ? 'text-cyan-400 bg-cyan-950/20 border-l-2 border-cyan-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="Templates"
        >
          <Library className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full">TEMPLATES</span>
        </button>

        {aiEnabled && (
        <button
          id="tab_ai"
          onClick={() => setActiveTab('ai')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'ai'
              ? 'text-amber-400 bg-amber-950/20 border-l-2 border-amber-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="AI Co-pilot"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full">CO-PILOT</span>
        </button>
        )}
        <button
          id="tab_playtest"
          onClick={() => setActiveTab('playtest')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'playtest'
              ? 'text-emerald-400 bg-emerald-950/20 border-l-2 border-emerald-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="Playtest Workspace"
        >
          <Terminal className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full font-mono">PLAYTEST</span>
        </button>
        <button
          id="tab_diagnostics"
          onClick={() => setActiveTab('diagnostics')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'diagnostics'
              ? 'text-cyan-400 bg-cyan-950/20 border-l-2 border-cyan-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="Diagnostics — continuous project, script, package & install checks"
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full">DIAGNOSE</span>
        </button>
        <button
          id="tab_reference"
          onClick={() => setActiveTab('reference')}
          className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTab === 'reference'
              ? 'text-amber-400 bg-amber-950/20 border-l-2 border-amber-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="Local Object Browser"
        >
          <Database className="w-4 h-4 shrink-0" />
          <span className="text-[7.5px] font-mono tracking-tighter uppercase font-bold mt-1 text-center truncate w-full font-mono">OBJECTS</span>
        </button>
      </div>

      {/* Right Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-[#12141a]">
        
        {/* Sleek Tab Header */}
        <div className="px-3.5 py-3 border-b border-white/5 bg-[#161920]/30 shrink-0 flex items-center justify-between font-mono">
          <div>
            <div className="text-[11px] font-bold text-slate-105 uppercase tracking-wider flex items-center gap-1.5 leading-none">
              {activeTab === 'script' && <Layers className="w-3.5 h-3.5 text-cyan-400" />}
              {activeTab === 'cues' && <Compass className="w-3.5 h-3.5 text-purple-400" />}
              {activeTab === 'ui' && <Layout className="w-3.5 h-3.5 text-cyan-400" />}
              {activeTab === 'config' && <Settings className="w-3.5 h-3.5 text-cyan-400" />}
              {activeTab === 'filesystem' && <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />}
              {activeTab === 'git' && <GitBranch className="w-3.5 h-3.5 text-cyan-400" />}
              {activeTab === 'templates' && <Library className="w-3.5 h-3.5 text-cyan-400" />}
              {activeTab === 'ai' && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
              {activeTab === 'playtest' && <Terminal className="w-3.5 h-3.5 text-emerald-400" />}
              {activeTab === 'diagnostics' && <Activity className="w-3.5 h-3.5 text-cyan-405" />}
              {activeTab === 'reference' && <Database className="w-3.5 h-3.5 text-amber-400" />}

              {activeTab === 'script' && 'Node Toolbox'}
              {activeTab === 'cues' && 'Cue Hierarchy'}
              {activeTab === 'ui' && 'UI Widgets'}
              {activeTab === 'config' && 'Mod Config'}
              {activeTab === 'filesystem' && 'Filesystem'}
              {activeTab === 'git' && 'Source Control'}
              {activeTab === 'templates' && 'Blueprints'}
              {activeTab === 'ai' && 'AI Co-pilot'}
              {activeTab === 'playtest' && 'Playtest Workspace'}
              {activeTab === 'diagnostics' && 'Diagnostics'}
              {activeTab === 'reference' && 'Object Browser'}
            </div>
            <div className="text-[9px] text-slate-500 font-sans mt-0.5 leading-none">
              {activeTab === 'script' && 'Create visual logic nodes'}
              {activeTab === 'cues' && 'Navigate Mission Director cues'}
              {activeTab === 'ui' && 'HUD widgets & Lua overlays'}
              {activeTab === 'config' && 'Edit extension settings'}
              {activeTab === 'filesystem' && 'Workspace loose files list'}
              {activeTab === 'git' && 'Staged changes & remotes'}
              {activeTab === 'templates' && 'Manage reusable subgraphs'}
              {activeTab === 'ai' && 'AI-assisted logic & templates'}
              {activeTab === 'playtest' && 'Directory sync, manual syncer, and log parser'}
              {activeTab === 'diagnostics' && 'Continuous project, script, package & install checks'}
              {activeTab === 'reference' && 'Browse local ships, wares, factions, and code references'}
            </div>
          </div>

          {activeTab === 'ai' && (
            <button
              onClick={() => setIsAiFloatingVisible(!isAiFloatingVisible)}
              className={`px-2 py-1 rounded text-[9.5px] font-mono font-bold uppercase transition-all duration-150 border cursor-pointer ${
                isAiFloatingVisible 
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400' 
                  : 'bg-slate-800 hover:bg-slate-700 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
              title={isAiFloatingVisible ? "Hide floating AI guide panel" : "Show floating AI guide panel"}
            >
              {isAiFloatingVisible ? "Hide Float ✕" : "Show Float ⎋"}
            </button>
          )}
        </div>

        {/* Main Content Pane */}
        <div className={`flex-1 overflow-y-auto min-w-0 min-h-0 ${activeTab === 'filesystem' || activeTab === 'git' || activeTab === 'cues' || activeTab === 'ai' ? 'p-0' : 'p-3 space-y-3'}`}>
        {activeTab === 'cues' && (
          <CueViewer
            workspace={workspace}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            setFocusNodeRequest={setFocusNodeRequest}
            visibleCueIds={visibleCueIds}
            setVisibleCueIds={setVisibleCueIds}
            setWorkspace={setWorkspace}
          />
        )}

        {activeTab === 'filesystem' && (
          <DirectoryExplorer
            modWorkspacePath={modWorkspacePath}
            filesystemPath={filesystemPath}
            workspace={workspace}
            setWorkspace={setWorkspace}
            saveCheckpoint={saveCheckpoint}
            workspaceView={workspaceView}
            setWorkspaceView={setWorkspaceView}
            onOpenEditorFile={onOpenEditorFile}
          />
        )}

        {activeTab === 'git' && (
          <ErrorBoundary label="Source Control">
            <SourceControl
              workspace={workspace}
              setWorkspace={setWorkspace}
              onOpenEditorFile={onOpenEditorFile}
              saveCheckpoint={saveCheckpoint}
              setWorkspaceView={setWorkspaceView}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'playtest' && (
          <ErrorBoundary label="Playtest Workspace">
            <DiagnosticsHub
              workspace={workspace}
              setWorkspace={setWorkspace}
              saveCheckpoint={saveCheckpoint}
              modWorkspacePath={modWorkspacePath}
              setWorkspaceView={setWorkspaceView}
              forceTab="playtest"
              autoSaveEnabled={autoSaveEnabled}
              setAutoSaveEnabled={setAutoSaveEnabled}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'diagnostics' && (
          <ErrorBoundary label="Diagnostics">
            <DiagnosticsCenter
              workspace={workspace}
              setWorkspace={setWorkspace}
              saveCheckpoint={saveCheckpoint}
              modWorkspacePath={modWorkspacePath}
              setWorkspaceView={setWorkspaceView}
              autoSaveEnabled={autoSaveEnabled}
              setAutoSaveEnabled={setAutoSaveEnabled}
              diagnostics={diagnostics}
              diagnosticSource={diagnosticSource}
              requestedScope={diagnosticsScope}
              onOpenCues={() => setActiveTab('cues')}
              aiEnabled={aiEnabled}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'reference' && (
          <ErrorBoundary label="Local Object Browser">
            <ObjectBrowser />
          </ErrorBoundary>
        )}

        {/* NODE COMPONENT LIBRARY LIST (Tab: script) */}
        {activeTab === 'script' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-mono font-semibold text-cyan-400 mb-2 tracking-wider uppercase">Node Types</h3>
              <div className="grid grid-cols-2 gap-1 bg-black/20 p-1 rounded border border-white/5">
                {(['all', 'cue', 'event', 'condition', 'action'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setNodeFilter(type)}
                    className={`px-2 py-1 text-[10px] font-mono rounded capitalize transition-all cursor-pointer ${
                      nodeFilter === type
                        ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-mono font-semibold text-slate-400 mb-1.5 tracking-wider uppercase flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                TOOLBOX (CLICK TO CREATE)
              </h3>
              <VirtualizedNodeToolbox templates={allTemplates} nodeType={nodeFilter} onAddNode={onAddNode} />
            </div>
          </div>
        )}

        {/* UI MOD CUSTOMIZER WIDGETS (Tab: ui) */}
        {activeTab === 'ui' && (
          <div className="space-y-4">
            <div className="bg-cyan-950/10 border border-cyan-500/15 p-2.5 rounded text-[10px] leading-relaxed text-slate-400">
              <span className="text-cyan-400 font-bold block mb-0.5">X4 Custom UI Rules:</span>
              Design working contextual HUD menus or consoles. Add containers, tables, lists, progress bars and macro buttons.
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-mono font-semibold text-slate-400 mb-1.5 tracking-wider uppercase">UI Widgets Library</h3>
              {[
                { type: 'window', title: 'Context Window Frame', desc: 'Outer widget window layout container' },
                { type: 'header', title: 'Tactical Title / Header', desc: 'Wide high-contrast cyber decoration line' },
                { type: 'table', title: 'Standard Data Table', desc: 'Pre-styled multi-row grid framework' },
                { type: 'button', title: 'Macro Menu Button', desc: 'Fires visual cues on selection click' },
                { type: 'progressbar', title: 'Status Progress Bar', desc: 'Elegant status / shield indicator' },
                { type: 'text', title: 'Display Label', desc: 'Human-readable description labels' },
                { type: 'dropdown', title: 'Interactive Selector', desc: 'Drop-down values list widget' },
                { type: 'input', title: 'Text Input Box', desc: 'Custom command or log entry text field' },
                { type: 'chat', title: 'Dialogue Chat Logs', desc: 'Scrollable live dialogue transmissions list' }
              ].map(widget => {
                let widgetIcon = <Layout className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
                if (widget.type === 'header') widgetIcon = <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
                if (widget.type === 'table') widgetIcon = <Library className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
                if (widget.type === 'button') widgetIcon = <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
                if (widget.type === 'progressbar') widgetIcon = <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
                if (widget.type === 'text') widgetIcon = <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
                if (widget.type === 'dropdown') widgetIcon = <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
                if (widget.type === 'input') widgetIcon = <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
                if (widget.type === 'chat') widgetIcon = <BookOpen className="w-3.5 h-3.5 text-purple-400 shrink-0" />;

                return (
                  <button
                    key={widget.type}
                    onClick={() => onAddUIWidget(widget.type)}
                    className="w-full text-left p-2 rounded bg-black/20 border border-white/5 hover:bg-cyan-600/5 hover:border-cyan-500/50 transition-all flex items-center gap-2.5 group cursor-pointer"
                  >
                    {widgetIcon}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white capitalize truncate leading-none">
                        {widget.title}
                      </div>
                      <div className="text-[9px] text-slate-550 font-sans mt-1 truncate">
                        {widget.desc}
                      </div>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-cyan-400 transition-all" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* METADATA CONFIG (Tab: config) */}
        {activeTab === 'config' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider">Mod Script Identifier</label>
                <input
                  type="text"
                  value={workspace.name}
                  onChange={e => setWorkspace(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="e.g. My_Elite_Mod"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider">Version String</label>
                <input
                  type="text"
                  value={workspace.version}
                  onChange={e => setWorkspace(prev => ({ ...prev, version: e.target.value }))}
                  className="w-full p-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="e.g. 1.0.0 or 100"
                />
                {/* Audit #1: live X4-version preview — semver ("1.0.0") and X4 integers ("100")
                    are both accepted; this shows exactly what content.xml will carry. */}
                <p className="text-[9px] text-slate-500 mt-1 font-mono" data-testid="x4-version-preview">
                  → content.xml version: <span className="text-cyan-300">{toContentVersion(workspace.version)}</span>
                  {' '}(shown in-game as v{(parseInt(toContentVersion(workspace.version), 10) / 100).toFixed(2)})
                </p>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider">Author Name</label>
                <input
                  type="text"
                  value={workspace.author}
                  onChange={e => setWorkspace(prev => ({ ...prev, author: e.target.value }))}
                  className="w-full p-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="Your Name"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider">Mod Description</label>
                <textarea
                  value={workspace.description}
                  onChange={e => setWorkspace(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2 h-20 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                  placeholder="Mod brief synopsis..."
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-3">
              <h3 className="text-xs font-mono font-semibold text-cyan-400 tracking-wider uppercase flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                XSD Schema Source
              </h3>

              <div>
                <label className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider">Schema Directory</label>
                <div className="w-full p-2 rounded bg-black/40 border border-white/10 text-slate-300 font-mono text-[10px] break-all min-h-[34px] flex items-center">
                  {schemaDir || <span className="text-slate-500 italic">Not configured — set it in Directory Settings</span>}
                </div>
                <p className="text-slate-500 text-[9px] mt-1 leading-snug">
                  Configured in <span className="text-cyan-400">Directory Settings</span> (the single source of truth). This panel is read-only.
                </p>
              </div>

              <details className="group rounded bg-black/30 border border-white/10 text-[10px]">
                <summary className="cursor-pointer list-none p-2 flex items-center justify-between gap-2 text-slate-300 hover:text-white">
                  <span className="font-bold uppercase tracking-wider">
                    {schemaStatus.files?.length
                      ? `Found ${schemaStatus.files.length} schema files`
                      : schemaStatus.mdExists || schemaStatus.commonExists
                        ? 'Schema files found'
                        : 'No schema files found'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-cyan-400 transition-transform group-open:rotate-90" />
                </summary>
                <div className="max-h-56 overflow-y-auto border-t border-white/10 p-2 space-y-2 custom-scrollbar">
                  {(schemaStatus.files || []).length > 0 ? schemaStatus.files!.map(file => (
                    <div key={`${file.domain}:${file.file}`} className="rounded border border-white/5 bg-black/25 p-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-cyan-300 font-bold uppercase">{file.domain}</span>
                        <span className="text-slate-600">{Math.max(1, Math.round(file.sizeBytes / 1024))} KB</span>
                      </div>
                      <div className="mt-1 text-slate-500 break-all">{file.file}</div>
                      {file.includes.length > 0 && (
                        <div className="mt-1 text-slate-600">includes: {file.includes.join(', ')}</div>
                      )}
                      {file.missingIncludes.length > 0 && (
                        <div className="mt-1 text-amber-300">missing: {file.missingIncludes.join(', ')}</div>
                      )}
                    </div>
                  )) : (
                    <div className="text-slate-500">No registry entries were returned.</div>
                  )}
                </div>
              </details>

              {schemaStatus.counts && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 rounded bg-black/30 border border-white/10 p-2 text-[9px] uppercase text-slate-500">
                  <span>Events <strong className="text-white">{schemaStatus.counts.events}</strong></span>
                  <span>Actions <strong className="text-white">{schemaStatus.counts.actions}</strong></span>
                  <span>Conditions <strong className="text-white">{schemaStatus.counts.conditions}</strong></span>
                  <span>Control <strong className="text-white">{schemaStatus.counts.control_flow}</strong></span>
                </div>
              )}

              <button
                onClick={() => onOpenDirectorySettings?.()}
                className="w-full px-3 py-2 rounded bg-cyan-600/20 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-600/30 transition-colors font-bold uppercase text-[10px] tracking-wider flex items-center justify-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                Edit in Directory Settings
              </button>

              {(schemaMessage || schemaStatus.error) && (
                <div className={`text-[10px] leading-relaxed rounded border p-2 ${
                  schemaMessageType === 'success' && !schemaStatus.error
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/20 text-red-300'
                }`}>
                  {schemaMessage || schemaStatus.error}
                </div>
              )}
            </div>

            {/* EXTENSION COMPILER & WORKSPACE STAGING */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <h3 className="text-xs font-mono font-semibold text-cyan-400 tracking-wider uppercase flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5" />
                Extension Package Compiler
              </h3>

              {/* Local Directory Link state */}
              {modWorkspacePath ? (
                <div className="space-y-3">
                  <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20 text-[10px] space-y-1">
                    <div className="flex items-center justify-between text-slate-400 font-bold uppercase text-[9px]">
                       <span>Workspace Path</span>
                       <span className="text-emerald-400 flex items-center gap-0.5 font-bold uppercase text-[8px] animate-pulse">● Configured</span>
                    </div>
                    <div className="text-white break-all flex items-center gap-1 text-[10px]">
                      <Folder className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                      {modWorkspacePath}
                    </div>
                  </div>

                  {/* Candy Store mapping Mode Choice: Candy vs Candy Store */}
                  <div>
                    <label className="text-slate-400 block mb-1 uppercase text-[9px] tracking-wider flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-cyan-400" />
                      Staging Directory Type
                    </label>
                    <select
                      value={workspaceDirMode}
                      onChange={(e) => {
                        const val = e.target.value as 'candy' | 'store';
                        if (setWorkspaceDirMode) setWorkspaceDirMode(val);
                        localStorage.setItem('x4_workspace_dir_mode', val);
                      }}
                      className="w-full bg-[#0F1115] border border-white/10 p-1.5 rounded text-[10px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="store">Generic Extensions Folder ("Candy Store")</option>
                      <option value="candy">Direct Mod Folder ("Candy Itself")</option>
                    </select>
                    <p className="text-[9px] text-slate-500 leading-normal mt-1 italic">
                      {workspaceDirMode === 'store' 
                        ? 'Stages files in extensions/ folder inside a subdirectory named after your mod.' 
                        : 'Writes files (content.xml, md/, etc) directly inside connected directory.'}
                    </p>
                  </div>

                  {/* Compilation scope targets choice */}
                  <div className="bg-[#0F1115]/50 border border-white/5 rounded p-2.5 space-y-2 select-none">
                    <label className="text-slate-400 block uppercase text-[8.5px] tracking-wider font-bold">
                      🛠️ active modules to compile
                    </label>
                    <div className="grid grid-cols-2 gap-2 font-mono text-[9.5px]">
                      <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={compileSettings.md}
                          onChange={() => handleToggleCompileSetting('md')}
                          className="accent-emerald-500 rounded cursor-pointer"
                        />
                        MD Scripts
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={compileSettings.ui}
                          onChange={() => handleToggleCompileSetting('ui')}
                          className="accent-emerald-500 rounded cursor-pointer"
                        />
                        HUD & LUA UI
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={compileSettings.ai}
                          onChange={() => handleToggleCompileSetting('ai')}
                          className="accent-emerald-500 rounded cursor-pointer"
                        />
                        AI Behaviors
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={compileSettings.library}
                          onChange={() => handleToggleCompileSetting('library')}
                          className="accent-emerald-500 rounded cursor-pointer"
                        />
                        Wares & Jobs
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={compileSettings.translations}
                          onChange={() => handleToggleCompileSetting('translations')}
                          className="accent-emerald-500 rounded cursor-pointer"
                        />
                        T Languages
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={compileSettings.patches}
                          onChange={() => handleToggleCompileSetting('patches')}
                          className="accent-emerald-500 rounded cursor-pointer"
                        />
                        XML Patching
                      </label>
                    </div>
                  </div>

                  {/* Trigger compiler button */}
                  <button
                    onClick={handleCompileModProject}
                    disabled={compileStatus === 'compiling'}
                    className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-black font-mono font-bold text-[10px] rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed uppercase shadow shadow-emerald-500/25 shrink-0"
                  >
                    <PackageCheck className={`w-4 h-4 ${compileStatus === 'compiling' ? 'animate-pulse' : ''}`} />
                    Compile Mod Extension
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[9.5px] text-slate-500 leading-relaxed italic text-center py-2">
                    No workspace staging folder configured. Configure it in Settings to enable compiler.
                  </p>
                </div>
              )}

              {/* Compile results log notification */}
              {compileMessage && (
                <div className={`p-2 rounded border font-mono text-[9.5px] ${
                  compileStatus === 'error'
                    ? 'bg-red-500/10 border-red-500/20 text-red-300'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  {compileMessage}
                </div>
              )}
            </div>

            {/* PERSISTENT HISTORICAL SNAPSHOTS */}
            <SnapshotManager
              workspace={workspace}
              setWorkspace={setWorkspace}
              saveCheckpoint={saveCheckpoint}
              modWorkspacePath={modWorkspacePath}
              onSelectSnapshot={onSelectSnapshot}
            />
          </div>
        )}

        {/* LIBRARY / TEMPLATES (Tab: templates) */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <h3 className="text-xs font-mono font-semibold text-cyan-400 mb-1 tracking-wider uppercase flex items-center gap-1.5 leading-none">
                <Library className="w-4 h-4 text-cyan-400" />
                TEMPLATE BLUEPRINTS
              </h3>
              <p className="text-[10px] text-slate-500 leading-normal font-sans">
                Non-compilable visual templates. Drag them onto the canvas or drag-start, select, and customize them.
              </p>
            </div>

            {/* B22s2: proven patterns, stampable MID-CANVAS (onboarding covers only the
                empty canvas; this is the same library for a working graph). */}
            <div className="space-y-2 bg-black/40 p-3 rounded border border-amber-500/10 font-mono">
              <span className="text-amber-400 uppercase font-bold text-[9px] tracking-wider block">
                Proven patterns — stamp onto canvas
              </span>
              <p className="text-[9px] text-slate-500 leading-snug font-sans">
                Working fragments from shipping mods. Stamping ADDS the pattern below your
                current graph — nothing is replaced. Rename the $variables to make it yours.
              </p>
              {MOD_PATTERNS.map(p => (
                <div key={p.id} className="rounded border border-amber-500/15 bg-amber-500/[0.03] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-amber-300 font-semibold text-[10px] leading-tight">{p.title}</div>
                      <div className="text-slate-500 text-[9px] mt-0.5 leading-snug font-sans">{p.blurb}</div>
                      <div className="text-slate-600 text-[8.5px] mt-0.5 truncate" title={`${p.provenance.provenMod} — ${p.provenance.file}\n${p.provenance.note}`}>
                        ⛏ {p.provenance.provenMod}
                      </div>
                    </div>
                    <button
                      data-testid={`stamp-pattern-${p.id}`}
                      onClick={() => setWorkspace(ws => stampPatternIntoWorkspace(ws, p.id))}
                      className="shrink-0 px-2 py-1 rounded bg-amber-600/30 border border-amber-400/30 hover:bg-amber-600/50 text-amber-100 text-[9px] font-bold cursor-pointer"
                      title="Add this pattern below your current graph."
                    >
                      STAMP
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Part 1: CREATE REUSABLE BLUEPRINT */}
            <div className="space-y-3 bg-black/40 p-3 rounded border border-white/5 font-mono text-[11px]">
              <span className="text-cyan-400 uppercase font-bold text-[9px] tracking-wider block">
                CREATE BLUEPRINT BLUEPRINT
              </span>
              
              <div>
                <label className="text-slate-400 block mb-1 uppercase text-[8.5px] tracking-wider">Blueprint Title</label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  className="w-full p-1.5 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500 text-[10px]"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 uppercase text-[8.5px] tracking-wider">Base Node Structure</label>
                <select
                  value={newTemplateTypeIdx}
                  onChange={e => setNewTemplateTypeIdx(Number(e.target.value))}
                  className="w-full p-1.5 rounded bg-[#0b0c10] border border-white/10 text-slate-300 focus:outline-none focus:border-cyan-500 text-[10px] cursor-pointer"
                >
                  {NODE_TEMPLATES.map((nodeT, idx) => (
                    <option key={idx} value={idx}>
                      {nodeT.label} ({nodeT.xmlTag})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  if (!newTemplateName.trim()) return;
                  const baseNode = NODE_TEMPLATES[newTemplateTypeIdx];
                  if (!baseNode) return;

                  const customT: MDNode = {
                    id: `custom_template_${Date.now()}`,
                    type: baseNode.type,
                    label: newTemplateName,
                    xmlTag: baseNode.xmlTag,
                    x: 100,
                    y: 100,
                    properties: { ...baseNode.properties },
                    propertiesSchema: [...(baseNode.propertiesSchema || [])],
                    inputs: [...(baseNode.inputs || [])],
                    outputs: [...(baseNode.outputs || [])],
                    includeInBuild: false
                  };

                  saveCheckpoint();
                  setWorkspace(prev => ({
                    ...prev,
                    templates: [...(prev.templates || []), customT]
                  }));
                  setNewTemplateName('New Custom Blueprint');
                }}
                className="w-full py-1.5 font-bold uppercase transition-all bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 hover:text-white rounded border border-cyan-500/30 cursor-pointer text-[10px] tracking-wider text-center"
              >
                + Save as Blueprint
              </button>
            </div>

            {/* Part 2: LIST AND EDITING */}
            <div className="space-y-2">
              <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider flex items-center justify-between">
                <span>AVAILABLE BLUEPRINTS</span>
                <span className="text-slate-500 text-[8px] lowercase">drag or click to add</span>
              </span>

              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {[
                  {
                    id: 'preseed_sample_cue',
                    type: 'cue' as const,
                    label: 'Standard Mission Cue Scaffold',
                    xmlTag: 'cue',
                    x: 100,
                    y: 100,
                    properties: { name: 'Cue_Scaffold', instantiate: 'true', namespace: 'this', state: 'active' },
                    propertiesSchema: NODE_TEMPLATES.find(t => t.xmlTag === 'cue')?.propertiesSchema || [],
                    inputs: NODE_TEMPLATES.find(t => t.xmlTag === 'cue')?.inputs || [],
                    outputs: NODE_TEMPLATES.find(t => t.xmlTag === 'cue')?.outputs || [],
                    includeInBuild: false
                  },
                  {
                    id: 'preseed_cargo_alert',
                    type: 'event' as const,
                    label: 'Cargo Check Event Trigger',
                    xmlTag: 'event_object_destroyed',
                    x: 100,
                    y: 100,
                    properties: { object: 'player.target', faction: 'any' },
                    propertiesSchema: NODE_TEMPLATES.find(t => t.xmlTag === 'event_object_destroyed')?.propertiesSchema || [],
                    inputs: NODE_TEMPLATES.find(t => t.xmlTag === 'event_object_destroyed')?.inputs || [],
                    outputs: NODE_TEMPLATES.find(t => t.xmlTag === 'event_object_destroyed')?.outputs || [],
                    includeInBuild: false
                  },
                  {
                    id: 'preseed_briefing_help',
                    type: 'action' as const,
                    label: 'Briefing Help Banner Alarm',
                    xmlTag: 'show_help',
                    x: 100,
                    y: 100,
                    properties: { text: "Warning: Elite Sector Security forces alert!", duration: 10 },
                    propertiesSchema: NODE_TEMPLATES.find(t => t.xmlTag === 'show_help')?.propertiesSchema || [],
                    inputs: NODE_TEMPLATES.find(t => t.xmlTag === 'show_help')?.inputs || [],
                    outputs: NODE_TEMPLATES.find(t => t.xmlTag === 'show_help')?.outputs || [],
                    includeInBuild: false
                  },
                  ...(workspace.templates || [])
                ].map((tNode, idx) => {
                  let badgeColors = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                  if (tNode.type === 'cue') badgeColors = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                  if (tNode.type === 'event') badgeColors = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                  if (tNode.type === 'condition') badgeColors = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
                  if (tNode.type === 'action') badgeColors = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

                  const isCustom = !tNode.id.startsWith('preseed_');

                  return (
                    <div
                      key={idx}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', JSON.stringify({
                          type: 'x4-template-node',
                          template: tNode
                        }));
                      }}
                      onClick={() => {
                        if (isCustom) {
                          setEditedTemplateId(tNode.id);
                          setEditedTemplateLabel(tNode.label);
                          setEditedTemplateXmlTag(tNode.xmlTag);
                        } else {
                          setEditedTemplateId(null);
                        }
                      }}
                      className={`p-2 rounded bg-[#1c1f26] border hover:border-cyan-500/50 transition-all flex flex-col gap-1.5 cursor-grab active:cursor-grabbing font-mono text-[10px] ${
                        editedTemplateId === tNode.id ? 'border-cyan-500 text-white bg-cyan-700/5' : 'border-white/5 text-slate-300'
                      }`}
                      title="Drag this card onto the visual canvas to spawn it, or click to edit item attributes."
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 select-none">
                          {tNode.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className={`text-[8px] font-bold border px-1 rounded scale-90 ${badgeColors}`}>
                            {tNode.type.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-slate-400 select-none border-t border-white/5 pt-1 font-mono">
                        <span>&lt;{tNode.xmlTag}&gt;</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Clone/instantiate onto workspace.nodes
                              saveCheckpoint();
                              const instNode = {
                                ...tNode,
                                id: `node_inst_${Date.now()}`,
                                x: 200 + Math.random() * 80,
                                y: 150 + Math.random() * 80,
                                includeInBuild: true // Direct insertion sets it as compilable in the active mod!
                              };
                              setWorkspace(prev => ({
                                ...prev,
                                nodes: [...prev.nodes, instNode]
                              }));
                            }}
                            className="text-cyan-400 hover:text-cyan-200 transition-all cursor-pointer font-bold leading-none bg-cyan-500/10 px-1 py-0.5 rounded uppercase text-[8px]"
                          >
                            + Insert active
                          </button>
                          {isCustom && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                saveCheckpoint();
                                setWorkspace(prev => ({
                                  ...prev,
                                  templates: (prev.templates || []).filter(item => item.id !== tNode.id)
                                }));
                                if (editedTemplateId === tNode.id) {
                                  setEditedTemplateId(null);
                                }
                              }}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-1 py-0.5 rounded cursor-pointer leading-none"
                              title="Delete this template blueprint"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PART 3: VISUALLY SEE & EDIT CUSTOM TEMPLATE ATTRIBUTES */}
            {editedTemplateId && (
              <div className="border-t border-cyan-500/20 pt-3 space-y-3 bg-[#0F1115] p-3 rounded border border-white/10 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 font-bold text-[9px] uppercase tracking-wider">
                    Edit Blueprint Fields
                  </span>
                  <button
                    onClick={() => setEditedTemplateId(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 uppercase text-[8.5px] tracking-wider">Display Label</label>
                  <input
                    type="text"
                    value={editedTemplateLabel}
                    onChange={e => {
                      const newV = e.target.value;
                      setEditedTemplateLabel(newV);
                      setWorkspace(prev => ({
                        ...prev,
                        templates: (prev.templates || []).map(item =>
                          item.id === editedTemplateId ? { ...item, label: newV } : item
                        )
                      }));
                    }}
                    className="w-full p-1.5 rounded bg-black/60 border border-white/10 text-white focus:outline-none focus:border-cyan-500 text-[10px]"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 uppercase text-[8.5px] tracking-wider">XML Tag Node</label>
                  <input
                    type="text"
                    value={editedTemplateXmlTag}
                    onChange={e => {
                      const newV = e.target.value;
                      setEditedTemplateXmlTag(newV);
                      setWorkspace(prev => ({
                        ...prev,
                        templates: (prev.templates || []).map(item =>
                          item.id === editedTemplateId ? { ...item, xmlTag: newV } : item
                        )
                      }));
                    }}
                    className="w-full p-1.5 rounded bg-black/60 border border-white/10 text-white focus:outline-none focus:border-cyan-500 text-[10px]"
                  />
                </div>
                
                <p className="text-[8px] text-slate-500 leading-normal italic select-none font-sans">
                  Editing values instantly refreshes blueprint configurations safely without altering canvas assets.
                </p>
              </div>
            )}
          </div>
        )}

        {/* AI CO-PILOT (Tab: ai) */}
        {aiEnabled && activeTab === 'ai' && (
          <AIHelper
            mode="sidebar"
            workspace={workspace}
            setWorkspace={setWorkspace}
            localVersion={1}
            setLocalVersion={() => {}}
            chatHistory={aiChatHistory}
            setChatHistory={setAiChatHistory}
            inputText={aiInputText}
            setInputText={setAiInputText}
            activeMode={aiActiveMode}
            setActiveMode={setAiActiveMode}
            loading={aiLoading}
            errorText={aiErrorText}
            isOpen={false}
            setIsOpen={() => {}}
            handleSend={handleSend}
            handleApplyAction={handleApplyAction}
            handleDeclineAction={handleDeclineAction}
            isAiFloatingVisible={isAiFloatingVisible}
            setIsAiFloatingVisible={setIsAiFloatingVisible}
            knownTags={aiKnownTags}
            aiTier={aiTier}
            architectBlueprint={architectBlueprint}
            onBlueprintChange={onBlueprintChange}
            onRunArchitectStep={onRunArchitectStep}
            architectRunning={architectRunning}
            architectStep={architectStep}
            onConfirmArchitectStep={onConfirmArchitectStep}
            onDeclineArchitectStep={onDeclineArchitectStep}
            architectCanRun={architectCanRun}
            architectRunDisabledReason={architectRunDisabledReason}
            onCancel={onAiCancel}
          />
        )}

        {/* COMPONENT INSPECTOR OR PROPERTY VIEWER PANEL (B5: extracted to PropertiesInspector.tsx) */}
        <PropertiesInspector
          selectedNode={selectedNode}
          selectedWidget={selectedWidget}
          workspace={workspace}
          setWorkspace={setWorkspace}
          setSelectedNode={setSelectedNode}
          setSelectedWidget={setSelectedWidget}
          saveCheckpoint={saveCheckpoint}
          handleLabelChange={handleLabelChange}
          handlePropChange={handlePropChange}
          handleSendCuePackageToAIGuide={handleSendCuePackageToAIGuide}
          diagnostics={diagnostics}
          setWorkspaceView={setWorkspaceView}
        />
        {propertyEditError && (
          <div className="mx-3 mb-3 rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-200" role="status">
            {propertyEditError}
          </div>
        )}
              </div>

      {/* Footer System Credits */}
      <div className="p-3 border-t border-white/5 bg-black/45 text-center text-[10px] font-mono text-slate-500">
        Engine Context: Egosoft MD 4.5
      </div>
    </div> {/* Close Right Content Column */}
  </div>
  );
}
