/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  GitFork,
  Trash,
  Layout,
  FileCode,
  Cpu,
  Undo2,
  Redo2,
  FolderGit2,
  Sparkles,
  Scroll,
  Package,
  Globe,
  BookOpen,
  Settings as SettingsGear,
  Plug,
  Map as MapIcon,
  ChevronRight,
  ChevronLeft,
  Keyboard,
  Bug
} from 'lucide-react';
import BugReportModal from './components/BugReportModal';
import Sidebar from './components/Sidebar';
import FpsMeter from './components/FpsMeter';
import HealthCardOverlay from './components/HealthCardOverlay';
import DialogHost, { confirmDialog } from './lib/uiDialogs';
import SyncModal from './components/SyncModal';
import Canvas from './components/Canvas';
import UIBuilder from './components/UIBuilder';
import CodePreview, { EditorFile } from './components/CodePreview';
import AIHelper from './components/AIHelper';
import AgentBridge from './components/AgentBridge';
import AIConnectionModal from './components/AIConnectionModal';
import DirectorySettingsModal from './components/DirectorySettingsModal';
import FirstRunWizard from './components/FirstRunWizard';
import { ttfm } from './lib/ttfm';
import CompileConfirmationModal from './components/CompileConfirmationModal';
import AIScriptEditor from './components/AIScriptEditor';
import LibraryConfigurator from './components/LibraryConfigurator';
import XMLPatchSystem from './components/XMLPatchSystem';
import ProjectInspector from './components/ProjectInspector';
import GalaxyMapView from './components/GalaxyMapView';
import ContractEditor from './components/ContractEditor';
import TFileEditor from './components/TFileEditor';
import WikiBrowser from './components/WikiBrowser';
import GlobalSearch from './components/GlobalSearch';
import ShortcutsOverlay from './components/ShortcutsOverlay';
import { ModWorkspace, MDNode, UIWidget, PRESETS, NODE_TEMPLATES, sanitizeWorkspace, generateMDXML, validateModWorkspace, ChatMessage, PackageDiagnostic } from './types';
import { workspaceContentHash } from './lib/workspaceIdentity';
import type { SchemaLibrary } from './lib/schemaTypes';
import { setSchemaTemplatesForImport } from './lib/xmlParser';
import { resolveCueToNodeId } from './lib/liveLogNav';
import { getActiveProvider, getProviderModel, getProviderReasoning, getAIHeaders, handleApiResponse, hasProviderKey, migrateLocalAiKeys } from './lib/apiHelper';
import { loadBlueprint, sampleBlueprint, saveBlueprint, recordRejection, evaluateBlueprintChecks, type ModBlueprint } from './lib/modBlueprint';
import { vetTaskProposal, nextActiveTask } from './lib/architectLoop';
import { getE2EPerfCounters, resetE2EPerfCounters, type E2EPerfCounters } from './lib/e2ePerfCounters';
import type { ArchitectStepView } from './components/BlueprintPanel';
import type { DiagnosticsScope } from './components/DiagnosticsCenter';
import ReadinessLadder from './components/ReadinessLadder';
import BeginnerWorkspace from './components/BeginnerWorkspace';
import { toSafeModId } from './lib/modCompiler';
import {
  EXPERIENCE_MODE_KEY,
  beginnerEditorForWorkspace,
  parseExperienceMode,
  type BeginnerStep,
  type ExperienceMode,
  type WorkspaceView,
} from './lib/experienceMode';
import {
  buildReadinessStages,
  EXPERIENCE_CONFIRMATIONS_KEY,
  parseExperienceConfirmations,
  type ExperienceConfirmation,
  type ReadinessOwner,
  type ReadinessStageId,
  type ReadinessWatcherEvidence,
} from './lib/readiness';

type ForgeE2EWindow = Window & {
  __X4_E2E__?: {
    getWorkspace: () => ModWorkspace;
    setWorkspace: (workspace: ModWorkspace) => void;
    getMdCode: () => string;
    getWorkspaceHash: () => string;
    resetPerfCounters: () => E2EPerfCounters;
    getPerfCounters: () => E2EPerfCounters;
  };
};

// Default initial blank workspace schema
const BLANK_WORKSPACE: ModWorkspace = {
  id: 'workspace_default',
  name: 'X4_My_Custom_Mod',
  version: '1.0.0',
  author: 'Space_Pilot',
  description: 'Custom script developed using X4 Forge visual nodes generator',
  // B33 (2026-07-12): GENUINELY empty — the old starter cue meant RESET/blank never
  // reached "empty in every domain", so the template picker was unreachable after a
  // reset (and the cue itself was dead code the Forge's own scanner flagged).
  nodes: [],
  links: [],
  uiWidgets: [],
  uiTheme: {
    backgroundColor: '#0F1115',
    borderColor: '#06b6d4',
    accentColor: '#0891b2',
    opacity: 0.95,
    showIcons: true
  }
};

export default function App() {
  const [schemaTemplates, setSchemaTemplates] = useState<Omit<MDNode, 'id' | 'x' | 'y'>[]>([]);
  // A4.5/A4.2 — the live md.xsd-derived valid tag set, so the AI review's unknown-tag
  // check never false-flags legitimate schema tags outside the curated palette.
  const aiKnownTags = React.useMemo(
    () => new Set(schemaTemplates.map(t => t.xmlTag).filter(Boolean)),
    [schemaTemplates]
  );
  const loadSchemaLibrary = React.useCallback(async () => {
    try {
      const res = await fetch('/api/schema/library');
      const library: SchemaLibrary | null = res.ok ? await res.json() : null;
      if (library?.loaded && Array.isArray(library.templates)) {
        setSchemaTemplates(library.templates);
        setSchemaTemplatesForImport(library.templates);
      } else {
        setSchemaTemplates([]);
        setSchemaTemplatesForImport([]);
      }
    } catch {
      setSchemaTemplates([]);
      setSchemaTemplatesForImport([]);
    }
  }, []);

  const [rawWorkspace, setRawWorkspace] = useState<ModWorkspace>(() => {
    // Attempt local storage sync
    const stored = localStorage.getItem('x4_mod_studio_workspace');
    const parsed = stored ? JSON.parse(stored) : BLANK_WORKSPACE;
    
    // Merge legacy localStorage items for backwards compatibility:
    const legacyAIScripts = localStorage.getItem('x4_mod_studio_aiscripts');
    const legacyWares = localStorage.getItem('x4_mod_studio_wares');
    const legacyJobs = localStorage.getItem('x4_mod_studio_jobs');
    const legacyPatches = localStorage.getItem('x4_mod_studio_xml_patches');

    if (legacyAIScripts && (!parsed.aiScripts || parsed.aiScripts.length === 0)) {
      try { parsed.aiScripts = JSON.parse(legacyAIScripts); } catch{}
    }
    if (legacyWares && (!parsed.wares || parsed.wares.length === 0)) {
      try { parsed.wares = JSON.parse(legacyWares); } catch{}
    }
    if (legacyJobs && (!parsed.jobs || parsed.jobs.length === 0)) {
      try { parsed.jobs = JSON.parse(legacyJobs); } catch{}
    }
    if (legacyPatches && (!parsed.xmlPatches || parsed.xmlPatches.length === 0)) {
      try { parsed.xmlPatches = JSON.parse(legacyPatches); } catch{}
    }

    return sanitizeWorkspace(parsed);
  });

  const setWorkspace = React.useCallback((value: React.SetStateAction<ModWorkspace>) => {
    setRawWorkspace(prev => {
      const next = typeof value === 'function' ? (value as (p: ModWorkspace) => ModWorkspace)(prev) : value;
      return sanitizeWorkspace(next);
    });
  }, []);

  const workspace = rawWorkspace;
  // B1: ref mirror so the 3s sync poll reads the CURRENT canvas without re-arming the effect.
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  useEffect(() => {
    // Audit #3: migrate any legacy localStorage AI keys to the server store, then load
    // the boolean configured-status used by render gates (architectCanRun, AIHelper).
    migrateLocalAiKeys();
    loadSchemaLibrary();
    (async () => {
      try {
        const res = await fetch('/api/schema/config').then(r => r.json());
        if (res.config) {
          setModWorkspacePath(res.config.modWorkspacePath || '');
          setFilesystemPath(res.config.filesystemPath || '');
        }
      } catch {
        console.warn("Could not load initial directory settings from server.");
      }
    })();
  }, [loadSchemaLibrary]);

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('blueprint');
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>(() => parseExperienceMode(localStorage.getItem(EXPERIENCE_MODE_KEY)));
  const [beginnerStep, setBeginnerStep] = useState<BeginnerStep>('idea');
  // B57s4: evidence deep links — ?panel=<sidebar tab> lands directly on that panel, so
  // agent walkthroughs, PROOF.md, and IDE surfaces can link straight to evidence. Unknown
  // values fall through to the default (never a crash path).
  const [activeSidebarTab, setActiveSidebarTab] = useState<'script' | 'ui' | 'config' | 'filesystem' | 'git' | 'cues' | 'templates' | 'ai' | 'diagnostics' | 'playtest' | 'reference'>(() => {
    try {
      const requested = new URLSearchParams(window.location.search).get('panel');
      const legal = ['script', 'ui', 'config', 'filesystem', 'git', 'cues', 'templates', 'ai', 'diagnostics', 'playtest', 'reference'] as const;
      if (requested && (legal as readonly string[]).includes(requested)) return requested as typeof legal[number];
    } catch { /* URL parsing must never break boot */ }
    return 'script';
  });
  const [diagnosticsScope, setDiagnosticsScope] = useState<DiagnosticsScope>('scripts');

  // Lifted auto-save state to synchronize settings and prevent data clobbering on load
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(false);

  // Diagnostics / Mod Doctor states moved to App level to share across Sidebar/CodePreview
  const [diagnostics, setDiagnostics] = useState<PackageDiagnostic[]>([]);
  const [bufferDiagnostics, setBufferDiagnostics] = useState<PackageDiagnostic[] | null>(null);
  const [diagnosticSource, setDiagnosticSource] = useState<'checking' | 'project' | 'local'>('checking');
  const [readinessWatcher, setReadinessWatcher] = useState<ReadinessWatcherEvidence>({ phase: 'loading' });
  const [experienceConfirmations, setExperienceConfirmations] = useState<Record<string, ExperienceConfirmation>>(
    () => parseExperienceConfirmations(localStorage.getItem(EXPERIENCE_CONFIRMATIONS_KEY))
  );

  const [snapshotDiffWorkspace, setSnapshotDiffWorkspace] = useState<ModWorkspace | null>(null);

  const mdCode = React.useMemo(() => {
    try {
      return generateMDXML(workspace);
    } catch {
      return '';
    }
  }, [workspace]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as ForgeE2EWindow).__X4_E2E__ = {
      getWorkspace: () => workspace,
      setWorkspace: (next: ModWorkspace) => setWorkspace(sanitizeWorkspace(next)),
      getMdCode: () => mdCode,
      getWorkspaceHash: () => workspaceContentHash(sanitizeWorkspace(workspace)),
      resetPerfCounters: resetE2EPerfCounters,
      getPerfCounters: getE2EPerfCounters,
    };
  }, [workspace, mdCode, setWorkspace]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const localReports = validateModWorkspace(workspace, mdCode);
    setDiagnosticSource('checking');

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/agent/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace }),
          signal: controller.signal,
        });
        const data = await handleApiResponse<{ diagnostics?: PackageDiagnostic[]; validation?: { scope?: string } }>(response, 'Full project validation failed.');
        if (data.validation?.scope !== 'full-project') {
          throw new Error('The connected Forge backend does not expose full-project live validation. Restart or update the backend.');
        }
        if (!cancelled) {
          setDiagnostics(data.diagnostics || []);
          setDiagnosticSource('project');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('Full project validation unavailable; falling back to local MD diagnostics:', err);
        if (!cancelled) {
          setDiagnostics(localReports);
          setDiagnosticSource('local');
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [workspace, mdCode]);

  const readinessWorkspaceHash = React.useMemo(
    () => workspaceContentHash(sanitizeWorkspace(workspace)),
    [workspace]
  );
  const activeReadinessModId = React.useMemo(() => toSafeModId(workspace.name), [workspace.name]);

  // B36 adapter: poll the EXISTING server verdict/deploy evidence. Components do not
  // infer game state; they all render the same model built from this response.
  useEffect(() => {
    let cancelled = false;
    setReadinessWatcher({ phase: 'loading' });
    const poll = async () => {
      try {
        const response = await fetch(`/api/agent/debug-watcher/brief?modId=${encodeURIComponent(activeReadinessModId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Readiness evidence request failed.');
        if (!cancelled) setReadinessWatcher({
          phase: 'ready',
          verdict: data?.verdict,
          sinceDeploy: data?.sinceDeploy,
          lastDeploy: data?.status?.lastDeploy || null,
        });
      } catch (error) {
        if (!cancelled) setReadinessWatcher({ phase: 'error', error: error instanceof Error ? error.message : 'Readiness evidence unavailable.' });
      }
    };
    poll();
    const timer = window.setInterval(poll, 4000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeReadinessModId]);

  const graphDiagnostics = React.useMemo(
    () => validateModWorkspace(workspace, mdCode),
    [workspace, mdCode]
  );
  const effectiveDiagnostics = bufferDiagnostics ?? diagnostics;
  const readinessStages = React.useMemo(() => buildReadinessStages({
    workspaceName: workspace.name,
    workspaceHash: readinessWorkspaceHash,
    graphDiagnostics,
    packageDiagnostics: effectiveDiagnostics,
    diagnosticSource,
    watcher: readinessWatcher,
    confirmation: experienceConfirmations[workspace.name] || null,
  }), [workspace.name, readinessWorkspaceHash, graphDiagnostics, effectiveDiagnostics, diagnosticSource, readinessWatcher, experienceConfirmations]);

  const navigateReadiness = React.useCallback((owner: ReadinessOwner, stage: ReadinessStageId) => {
    if (experienceMode === 'beginner') {
      if (stage === 'graph' || stage === 'package') {
        setBeginnerStep('validate');
        if (stage === 'graph') setWorkspaceView('blueprint');
      } else if (stage === 'deployed') {
        setBeginnerStep('deploy');
      } else {
        setBeginnerStep('confirm');
      }
      return;
    }
    if (owner === 'canvas') {
      setWorkspaceView('blueprint');
      setActiveSidebarTab('script');
      return;
    }
    if (owner === 'diagnostics') {
      setDiagnosticsScope('package');
      setActiveSidebarTab('diagnostics');
      return;
    }
    setActiveSidebarTab('playtest');
  }, [experienceMode]);

  const confirmCurrentExperience = React.useCallback(() => {
    const deploy = readinessWatcher.lastDeploy;
    if (!deploy?.deployedAt || !deploy.deployedPath || deploy.workspaceHash !== readinessWorkspaceHash) return;
    const confirmation: ExperienceConfirmation = {
      workspaceName: workspace.name,
      workspaceHash: readinessWorkspaceHash,
      deployedAt: deploy.deployedAt,
      confirmedAt: new Date().toISOString(),
    };
    setExperienceConfirmations(current => {
      const next = { ...current, [workspace.name]: confirmation };
      try { localStorage.setItem(EXPERIENCE_CONFIRMATIONS_KEY, JSON.stringify(next)); } catch { /* optional evidence preference */ }
      return next;
    });
  }, [readinessWatcher.lastDeploy, readinessWorkspaceHash, workspace.name]);

  const [visibleCueIds, setVisibleCueIds] = useState<string[] | null>(null);
  const [focusNodeRequest, setFocusNodeRequest] = useState<{ nodeId: string; timestamp: number } | null>(null);

  const [modWorkspacePath, setModWorkspacePath] = useState<string>('');
  const [filesystemPath, setFilesystemPath] = useState<string>('');
  
  const [workspaceDirMode, setWorkspaceDirMode] = useState<'candy' | 'store'>(() => {
    return (localStorage.getItem('x4_workspace_dir_mode') as 'candy' | 'store') || 'store';
  });
  const [compileStatus, setCompileStatus] = useState<'idle' | 'compiling' | 'success' | 'error'>('idle');
  const [compileMessage, setCompileMessage] = useState<string>('');

  const [selectedNode, setSelectedNode] = useState<MDNode | null>(null);
  const [selectedCueIds, setSelectedCueIds] = useState<string[]>([]);
  // Active MD script filter (file stem) shared by the code panel dropdown + the canvas; null = all.
  const [activeMdScript, setActiveMdScript] = useState<string | null>(null);
  const [activeEditorFile, setActiveEditorFile] = useState<EditorFile | null>(null);
  const [selectedWidget, setSelectedWidget] = useState<UIWidget | null>(null);

  useEffect(() => {
    try { localStorage.setItem(EXPERIENCE_MODE_KEY, experienceMode); } catch { /* optional UI preference */ }
  }, [experienceMode]);

  const beginnerSelectionKind = React.useCallback((): 'node' | 'widget' | null => {
    if (workspaceView === 'ui-designer' && selectedWidget) return 'widget';
    if (selectedNode) return 'node';
    return selectedWidget ? 'widget' : null;
  }, [workspaceView, selectedNode, selectedWidget]);

  const changeExperienceMode = React.useCallback((mode: ExperienceMode) => {
    setExperienceMode(mode);
    if (mode === 'beginner') {
      setWorkspaceView(beginnerStep === 'idea' ? 'blueprint' : beginnerEditorForWorkspace(workspace, beginnerSelectionKind()));
    }
  }, [beginnerStep, workspace, beginnerSelectionKind]);

  const changeBeginnerStep = React.useCallback((step: BeginnerStep) => {
    setBeginnerStep(step);
    if (step === 'idea') setWorkspaceView('blueprint');
    if (step === 'customize') setWorkspaceView(beginnerEditorForWorkspace(workspace, beginnerSelectionKind()));
  }, [workspace, beginnerSelectionKind]);

  // Selection hygiene: undo/redo (or any workspace replacement) can remove the
  // entity a panel has selected; clear dangling selections so inspectors and
  // the dependency graph never show a deleted node/widget (verification find).
  useEffect(() => {
    if (selectedNode && !workspace.nodes.some(n => n.id === selectedNode.id)) {
      setSelectedNode(null);
    }
    if (selectedWidget && !(workspace.uiWidgets || []).some(w => w.id === selectedWidget.id)) {
      setSelectedWidget(null);
    }
  }, [workspace, selectedNode, selectedWidget]);

  const [localVersion, setLocalVersion] = useState<number>(1);
  const [isAgentBridgeOpen, setIsAgentBridgeOpen] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isAIConfigOpen, setIsAIConfigOpen] = useState<boolean>(false);
  // B13: keyboard-shortcuts overlay ("?" or the header keyboard button)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isDirSettingsOpen, setIsDirSettingsOpen] = useState<boolean>(false);
  // B52: "Report a Bug" → prefilled GitHub issue (KennyG1990/X4_Forge Issues tab).
  const [isBugReportOpen, setIsBugReportOpen] = useState<boolean>(false);
  // B18 first-run wizard: shown when the Forge boots unconfigured (no game path AND no
  // resolvable schemas). Dev/eyeball override: ?firstrun in the URL forces it open.
  const [isFirstRunOpen, setIsFirstRunOpen] = useState<boolean>(false);
  useEffect(() => {
    ttfm.mark('first_boot'); // B20: funnel start (idempotent — first occurrence only)
    if (new URLSearchParams(window.location.search).has('firstrun')) { setIsFirstRunOpen(true); return; }
    (async () => {
      try {
        const res = await fetch('/api/schema/config');
        const data = await res.json();
        if (res.ok && data && !data.config?.x4GamePath && !data.resolved?.mdExists) setIsFirstRunOpen(true);
        // B20: an already-configured install counts as configured-at-boot (true for them).
        else if (res.ok && data?.resolved?.mdExists) ttfm.mark('paths_configured');
      } catch { /* API not up yet — the boot-retry fetch already softened this; stay closed */ }
    })();
  }, []);
  // Bumped when Directory Settings closes so the Sidebar's read-only schema panel refreshes.
  const [schemaConfigVersion, setSchemaConfigVersion] = useState<number>(0);
  const [isCompileModalOpen, setIsCompileModalOpen] = useState<boolean>(false);
  // B7: deploy-verify checklist rows surfaced in the Compile wizard itself.
  const [deployChecklist, setDeployChecklist] = useState<Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail' | 'skipped'; detail: string }>>([]);
  // B1 sync-trust: persistent canvas↔server content divergence gets a visible badge.
  const [syncDiverged, setSyncDiverged] = useState<boolean>(false);
  const syncMissesRef = useRef(0);
  // B2 slice 2 (ADR-F1): the last server head this client saw — attached as expectedHead
  // on every auto-sync so a concurrent writer produces an explicit 409, never a silent
  // last-writer-wins. Learned from poll GETs and from each own POST's response.
  const lastServerHashRef = useRef<string>('');
  const [syncConflict, _setSyncConflict] = useState<boolean>(false);
  // ref mirror so the 3s poll closure sees the CURRENT conflict state (ADR-F1: while a
  // human is deciding a conflict, the poll must NOT adopt — adoption would silently pick
  // the server side and discard the local edit, which is exactly what CAS exists to stop).
  const syncConflictRef = useRef(false);
  const setSyncConflict = (v: boolean) => { syncConflictRef.current = v; _setSyncConflict(v); };

  // Left & Right Sidebar Resizing States
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(320);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(460);
  // B48P2: the code pane starts COLLAPSED by default — the canvas is the product's core
  // surface and gets the real estate; the persistent top bar (tabs+actions) stays either way.
  // The user's last choice wins across sessions (localStorage), and expanding is one click on
  // the pull-tab. Collapsed-by-default also means the editor engine's chunk isn't even
  // downloaded until the pane is first opened (lazy import in CodePreview).
  const [codeCollapsed, setCodeCollapsedState] = useState<boolean>(() => {
    try { const saved = localStorage.getItem('x4_forge_code_collapsed'); return saved === null ? true : saved === '1'; }
    catch { return true; }
  });
  const setCodeCollapsed: React.Dispatch<React.SetStateAction<boolean>> = (next) => {
    setCodeCollapsedState(prev => {
      const value = typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next;
      try { localStorage.setItem('x4_forge_code_collapsed', value ? '1' : '0'); } catch { /* private mode */ }
      return value;
    });
  };
  // The persistent editor TOP BAR element — CodePreview portals its tabs+actions here so
  // the editor body stays a code-only entity, and the bar survives the editor's collapse.
  const [editorBarEl, setEditorBarEl] = useState<HTMLDivElement | null>(null);
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const [isResizingRight, setIsResizingRight] = useState<boolean>(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(200, Math.min(550, e.clientX));
        setLeftSidebarWidth(newWidth);
      }
      if (isResizingRight) {
        const newWidth = Math.max(300, Math.min(800, window.innerWidth - e.clientX));
        setRightSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight]);

  // Active AI modeling status states
  const [activeAIProvider, setActiveAIProvider] = useState<string>('gemini');
  const [activeAIModel, setActiveAIModel] = useState<string>('gemini-3.5-flash');
  const [activeReasoning, setActiveReasoning] = useState<string>('none');

  // AI Guide Shared State & Handlers
  const [aiChatHistory, setAiChatHistory] = useState<ChatMessage[]>([
    { 
      role: 'assistant', 
      text: "Forge AI assistant. Use CHAT for X4 scripting questions, or BUILDER to describe a change and get a proposal you review — diffed and verified against the schema — before anything is applied."
    }
  ]);
  const [aiInputText, setAiInputText] = useState<string>('');
  const [aiActiveMode, setAiActiveMode] = useState<'chat' | 'builder' | 'architect'>('chat');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiErrorText, setAiErrorText] = useState<string | null>(null);
  const [isAiFloatingVisible, setIsAiFloatingVisible] = useState<boolean>(false);
  const [isAiFloatingOpen, setIsAiFloatingOpen] = useState<boolean>(false);

  // A4.1 — AI presence tier (opt-in; default OFF for an AI-skeptical community).
  // Persisted so the choice survives reload/restart. Gates ALL AI-assistant
  // surfaces; deterministic features (validate/diagnostics/compile/object browser/
  // selftests) are NEVER affected by this.
  const [aiTier, setAiTierState] = useState<'off' | 'explain' | 'assist' | 'cobuild'>(() => {
    try {
      const v = localStorage.getItem('x4_ai_tier');
      if (v === 'off' || v === 'explain' || v === 'assist' || v === 'cobuild') return v;
    } catch { /* ignore */ }
    return 'off';
  });
  const setAiTier = (t: 'off' | 'explain' | 'assist' | 'cobuild') => {
    setAiTierState(t);
    try { localStorage.setItem('x4_ai_tier', t); } catch { /* ignore */ }
    if (t === 'off') {
      // Tearing AI down should leave no surface behind.
      setIsAiFloatingVisible(false);
      setActiveSidebarTab(prev => (prev === 'ai' ? 'script' : prev));
    }
  };
  const aiEnabled = aiTier !== 'off';

  // A4.7 — cancelable AI generation. The Builder runs several model passes (slow);
  // this lets the user abort instead of waiting out an uncancelable request.
  const aiAbortRef = React.useRef<AbortController | null>(null);
  const cancelAiRequest = () => { aiAbortRef.current?.abort(); };

  // A5.2 — Architect blueprint is owned HERE (single source of truth) so the agent loop and
  // the BlueprintPanel share one object. Persisted on every change (localStorage).
  const [architectBlueprint, setArchitectBlueprintState] = useState<ModBlueprint>(() => loadBlueprint() || sampleBlueprint());
  const setArchitectBlueprint = (b: ModBlueprint) => { setArchitectBlueprintState(b); saveBlueprint(b); };
  const [architectRunning, setArchitectRunning] = useState<boolean>(false);
  const [architectStep, setArchitectStep] = useState<ArchitectStepView | null>(null);
  // A proposal accepted by the referee, awaiting the user's Confirm (checkpoint-before-apply).
  const architectPendingRef = React.useRef<{ proposed: ModWorkspace; version?: number; taskId: string | null } | null>(null);

  // A5.2 D2/D3 — one Architect step: pick the next open task → ask the model for JUST that
  // task's nodes (grounded on the goal + task + lessons log) → run the deterministic referee
  // (vetTaskProposal) → accept (stage for confirm) or revise/reject (log the lesson, apply nothing).
  const runArchitectStep = async () => {
    setArchitectRunning(true);
    setArchitectStep(null);
    architectPendingRef.current = null;
    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      // Pick the next task from statuses DERIVED from the live workspace (a task already
      // satisfied by the current canvas must not be re-attempted) — not the raw stored ones.
      const bp = evaluateBlueprintChecks(architectBlueprint, workspace);
      const task = nextActiveTask(bp);
      if (!task) {
        setArchitectStep({ decision: 'reject', reason: 'No open task — the plan is complete or remaining tasks are blocked. Add a task or edit the goal.' });
        return;
      }
      const lessons = bp.scratchpad.rejected.length
        ? `\nDo NOT repeat these rejected approaches: ${bp.scratchpad.rejected.join('; ')}.` : '';
      const prompt = `Mod goal: ${bp.intent}\nWork ONLY on this task: "${task.title}".${task.doneCheck ? ` Success check: ${task.doneCheck}.` : ''}${lessons}\nProduce the minimal node graph that satisfies this task, building on the current workspace.`;
      const currentCode = generateMDXML(workspace);
      const diagnostics = validateModWorkspace(workspace, currentCode);
      const response = await fetch('/api/agent/generate', {
        method: 'POST', headers: getAIHeaders(), signal: controller.signal,
        body: JSON.stringify({ prompt, currentWorkspace: workspace, diagnostics, apply: false }),
      });
      const data = await handleApiResponse(response, 'Architect generation failed.');
      const proposed: ModWorkspace = data.workspace;
      const vet = vetTaskProposal({ base: workspace, proposed, blueprint: bp, activeTaskId: task.id, knownTags: aiKnownTags, requirements: data.requirements });
      const verdicts = { schema: vet.review.verdicts.schema.status, graph: vet.review.verdicts.graph.status, intent: vet.review.verdicts.intent.status };
      const nodeCount = proposed?.nodes?.length ?? 0;
      const addedTags = (proposed?.nodes || []).filter((n) => !workspace.nodes.some(b => b.id === n.id)).map((n) => n.xmlTag).filter(Boolean).join('+');

      if (vet.decision === 'accept') {
        architectPendingRef.current = { proposed, version: data.version, taskId: task.id };
        setArchitectStep({ decision: 'accept', reason: vet.reason, taskTitle: task.title, verdicts, nodeCount });
      } else if (vet.decision === 'reject') {
        // A genuinely rejected approach (already in the lessons log, or a known-bad pattern)
        // → record the approach signature so it is never re-proposed (blocking).
        setArchitectBlueprint(recordRejection(architectBlueprint, addedTags || `${task.title}: ${vet.reason}`));
        setArchitectStep({ decision: 'reject', reason: vet.reason, taskTitle: task.title, verdicts, nodeCount });
      } else {
        // 'revise' = fixable (invalid XML, or valid-but-incomplete). NOT a blocking lesson —
        // the model should refine and may legitimately reuse the same tags. Log a non-blocking
        // note for context; apply nothing.
        setArchitectBlueprint({
          ...architectBlueprint,
          scratchpad: { ...architectBlueprint.scratchpad, notes: [...architectBlueprint.scratchpad.notes, `Revised "${task.title}": ${vet.reason}`] },
        });
        setArchitectStep({ decision: 'revise', reason: vet.reason, taskTitle: task.title, verdicts, nodeCount });
      }
    } catch (err: unknown) {
      // A network/model failure is an ERROR, not a referee rejection — never touch the lessons log.
      if (err instanceof DOMException && err.name === 'AbortError') setArchitectStep({ decision: 'error', reason: 'Step cancelled.' });
      else setArchitectStep({ decision: 'error', reason: `${err instanceof Error ? err.message : 'Architect step failed'} — the model request didn't complete. Run again to retry.` });
    } finally {
      aiAbortRef.current = null;
      setArchitectRunning(false);
    }
  };

  const confirmArchitectStep = () => {
    const pending = architectPendingRef.current;
    if (!pending) return;
    saveCheckpoint(); // M-SAFE-2: reversible apply
    setWorkspace(pending.proposed);
    if (pending.version !== undefined) setLocalVersion(pending.version);
    // The BlueprintPanel re-runs evaluateBlueprintChecks against the NEW workspace and
    // auto-advances the task to `done` iff its deterministic check passes (M-ARCH-2).
    setArchitectBlueprint({
      ...architectBlueprint,
      changelog: [...architectBlueprint.changelog, { at: new Date().toISOString().slice(0, 10), entry: `Applied step: ${architectStep?.taskTitle || 'task'}`, verdict: 'applied' }],
    });
    architectPendingRef.current = null;
    setArchitectStep(null);
  };
  const declineArchitectStep = () => { architectPendingRef.current = null; setArchitectStep(null); };
  const architectCanRun = hasProviderKey(getActiveProvider());

  const handleSendChatMode = React.useCallback(async (promptMsg: string) => {
    setAiChatHistory(prev => [...prev, { role: 'user', text: promptMsg }]);
    setAiLoading(true);
    setAiInputText('');
    setAiErrorText(null);
    const controller = new AbortController();
    aiAbortRef.current = controller;

    try {
      const currentCode = generateMDXML(workspace);
      const diagnostics = validateModWorkspace(workspace, currentCode);

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: getAIHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          prompt: promptMsg,
          currentWorkspace: workspace,
          diagnostics: diagnostics
        })
      });

      const data = await handleApiResponse(response, "Failed to establish connection.");
      setAiChatHistory(prev => [...prev, {
        role: 'assistant',
        text: data.text,
        actionRequired: data.actionRequired,
        proposedWorkspace: data.proposedWorkspace,
        proposedVersion: data.proposedVersion,
        actionApplied: null
      }]);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAiChatHistory(prev => [...prev, { role: 'assistant', text: 'Request cancelled.' }]);
      } else {
        console.error(err);
        setAiErrorText(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      aiAbortRef.current = null;
      setAiLoading(false);
    }
  }, [workspace]);

  const handleSendBuilderMode = async (promptMsg: string) => {
    setAiChatHistory(prev => [...prev, { role: 'user', text: `Generate workspace blueprint: ${promptMsg}` }]);
    setAiLoading(true);
    setAiInputText('');
    setAiErrorText(null);
    const controller = new AbortController();
    aiAbortRef.current = controller;

    try {
      const currentCode = generateMDXML(workspace);
      const diagnostics = validateModWorkspace(workspace, currentCode);

      const response = await fetch("/api/agent/generate", {
        method: "POST",
        headers: getAIHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          prompt: promptMsg,
          currentWorkspace: workspace,
          diagnostics: diagnostics,
          // Approval-flow fix: stage only — the canvas must not change until
          // the user clicks Confirm & Apply on the proposal card.
          apply: false
        })
      });

      const data = await handleApiResponse(response, "Failed to trigger visual automated generator.");
      const generatedWorkspace: ModWorkspace = data.workspace;
      const proposedText = `Drafted a proposal: "${generatedWorkspace.name}" — ${generatedWorkspace.nodes.length} nodes, ${generatedWorkspace.links.length} links, ${generatedWorkspace.uiWidgets.length} widgets. Review the diff and verdicts below before applying.`;

      setAiChatHistory(prev => [...prev, {
        role: 'assistant',
        text: proposedText,
        actionRequired: true,
        proposedWorkspace: generatedWorkspace,
        proposedVersion: data.version,
        requirements: data.requirements,
        actionApplied: null
      }]);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAiChatHistory(prev => [...prev, { role: 'assistant', text: 'Generation cancelled.' }]);
      } else {
        console.error(err);
        setAiErrorText(err instanceof Error ? err.message : "Something went wrong during generation.");
      }
    } finally {
      aiAbortRef.current = null;
      setAiLoading(false);
    }
  };

  const handleApplyAction = (index: number, msg: ChatMessage) => {
    if (!msg.proposedWorkspace) return;
    // M-SAFE-2: checkpoint the CURRENT workspace before the AI replaces it, so the
    // apply is reversible (Codex observed Ctrl+Z did not restore an AI apply — it
    // never recorded a checkpoint). Undo (Ctrl+Z / Undo button) now restores it.
    saveCheckpoint();
    setWorkspace(msg.proposedWorkspace);
    if (msg.proposedVersion !== undefined) {
      setLocalVersion(msg.proposedVersion);
    }
    
    setAiChatHistory(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          actionRequired: false,
          actionApplied: 'applied',
          text: `Applied "${msg.proposedWorkspace?.name}" to the canvas. This change is reversible — Undo (Ctrl+Z) reverts it.`
        };
      }
      return updated;
    });
  };

  const handleDeclineAction = (index: number) => {
    setAiChatHistory(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          actionRequired: false,
          actionApplied: 'declined',
          text: `Action declined. Proposed visual modifications were successfully discarded. Feel free to re-submit your prompt with different parameters!`
        };
      }
      return updated;
    });
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    if (aiActiveMode === 'builder') {
      handleSendBuilderMode(text);
    } else {
      handleSendChatMode(text);
    }
  };

  // Listen to open-ai-chat events triggered by Wiki Browser or nodes clicks
  useEffect(() => {
    const handleOpenChatEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ prompt: string }>;
      if (customEvent.detail && customEvent.detail.prompt) {
        setActiveSidebarTab('ai');
        handleSendChatMode(customEvent.detail.prompt);
      }
    };
    window.addEventListener('open-ai-chat', handleOpenChatEvent);
    return () => {
      window.removeEventListener('open-ai-chat', handleOpenChatEvent);
    };
  }, [workspace, handleSendChatMode]);

  // Diagnostics click-to-navigate: Mod Doctor findings dispatch 'navigate-to-source'
  // with the diagnostic's sourceRef; jump to the owning editor surface (and, for MD
  // nodes, focus the node on the canvas).
  useEffect(() => {
    const handleNavigateToSource = (e: Event) => {
      const { kind, id } = (e as CustomEvent<{ kind: string; id?: string; label?: string }>).detail || {};
      if (!kind) return;
      switch (kind) {
        case 'md_node':
        case 'cue':
        case 'node': {
          setWorkspaceView('blueprint');
          let node = id ? workspace.nodes.find(n => n.id === id) : undefined;
          // #23: a live-log alert passes the CUE NAME (not a node id) — resolve it to the owning cue node.
          if (!node && id) {
            const nid = resolveCueToNodeId(id, workspace.nodes);
            node = nid ? workspace.nodes.find(n => n.id === nid) : undefined;
          }
          if (node) {
            setSelectedNode(node);
            setFocusNodeRequest({ nodeId: node.id, timestamp: Date.now() });
          }
          break;
        }
        case 'ui_widget':
          setWorkspaceView('ui-designer');
          break;
        case 'ai_script':
        case 'ai_param':
          setWorkspaceView('aiscripts');
          break;
        case 'ware':
        case 'job':
          setWorkspaceView('libraries');
          break;
        case 't_file':
        case 't_page':
        case 't_item':
          setWorkspaceView('translation');
          break;
        case 'xml_patch':
          setWorkspaceView('xmlpatch');
          break;
        default:
          break;
      }
    };
    window.addEventListener('navigate-to-source', handleNavigateToSource);
    return () => window.removeEventListener('navigate-to-source', handleNavigateToSource);
  }, [workspace]);

  // B13b2: override-map → Diff→Patch pre-target. The Doctor dispatches; App switches the
  // view; XMLPatchSystem (same event) sets the target file + difftool tab.
  useEffect(() => {
    const handlePretarget = () => { setWorkspaceView('xmlpatch'); setActiveSidebarTab('config'); };
    window.addEventListener('xmlpatch-pretarget', handlePretarget);
    return () => window.removeEventListener('xmlpatch-pretarget', handlePretarget);
  }, []);

  useEffect(() => {
    const updateAIState = () => {
      const provider = getActiveProvider();
      setActiveAIProvider(provider);
      setActiveAIModel(getProviderModel(provider));
      setActiveReasoning(getProviderReasoning(provider));
    };

    updateAIState();
    window.addEventListener('ai-config-updated', updateAIState);
    return () => {
      window.removeEventListener('ai-config-updated', updateAIState);
    };
  }, []);

  // Undo/Redo historical state stacks
  const [pastStates, setPastStates] = useState<ModWorkspace[]>([]);
  const [futureStates, setFutureStates] = useState<ModWorkspace[]>([]);

  // Function to capture a manual undoable snapshot checkpoint
  const saveCheckpoint = (customTarget?: ModWorkspace) => {
    const target = customTarget || workspace;
    setPastStates(prev => [...prev.slice(-39), JSON.parse(JSON.stringify(target))]);
    setFutureStates([]);
  };

  const handleUndo = React.useCallback(() => {
    if (pastStates.length === 0) return;
    const previous = pastStates[pastStates.length - 1];
    const newPast = pastStates.slice(0, pastStates.length - 1);

    setFutureStates(prev => [JSON.parse(JSON.stringify(workspace)), ...prev]);
    setPastStates(newPast);
    setWorkspace(previous);
  }, [pastStates, workspace, setWorkspace]);

  const handleRedo = React.useCallback(() => {
    if (futureStates.length === 0) return;
    const next = futureStates[0];
    const newFuture = futureStates.slice(1);

    setPastStates(prev => [...prev, JSON.parse(JSON.stringify(workspace))]);
    setFutureStates(newFuture);
    setWorkspace(next);
  }, [futureStates, workspace, setWorkspace]);

  // Setup keyboard modifiers for general OS accessibility (Ctrl+Z and Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if inside input fields to not disrupt standard typing workflows
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // B13: shortcuts documentation surface — "?" toggles the overlay
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Audit #6 (2026-07-11, measured): stringify+setItem cost 3–31ms on import-sized
  // workspaces (2–20MB payloads) and ran SYNCHRONOUSLY on every keystroke here; worse,
  // an over-quota setItem threw BEFORE the server-sync timer below was armed, killing
  // server sync entirely for oversized mods. The localStorage cache now rides the same
  // 300ms debounce as the server sync (the visibility flush covers tab-hide), and quota
  // failure degrades honestly: warn once, drop the stale cache, server stays authority.
  const quotaWarnedRef = useRef(false);
  // Audit #6: the 3s poll re-hashed an unchanged canvas at 12–26ms/main-thread on
  // import-sized workspaces; the workspace object is replaced by reference on every
  // edit, so the hash is valid until the reference changes.
  const pollHashMemoRef = useRef<{ ws: unknown; hash: string } | null>(null);
  // Sync to local storage and do debounced sync with the server database
  useEffect(() => {
    const persistLocalCache = () => {
      try {
        localStorage.setItem('x4_mod_studio_workspace', JSON.stringify(workspace));
      } catch (e) {
        try { localStorage.removeItem('x4_mod_studio_workspace'); } catch { /* ignore */ }
        if (!quotaWarnedRef.current) {
          quotaWarnedRef.current = true;
          console.warn('Workspace exceeds the localStorage cache limit — local cache skipped; the server copy remains the authority.', e);
        }
      }
    };

    const syncLocalEditsToServer = async () => {
      persistLocalCache();
      // B2 slice 3: ADR-F1's legacy deprecation round is OVER. Until the boot GET/poll has
      // taught us the server head, we do NOT write — a blind boot save is exactly the
      // blank-client clobber that destroyed live state on 2026-07-11 (and the server now
      // rejects it anyway). The 3s poll learns the head, then the next edit syncs via CAS.
      if (!lastServerHashRef.current) return;
      try {
        const response = await fetch("/api/agent/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace, expectedHead: lastServerHashRef.current })
        });
        if (response.status === 409) {
          // Someone else changed the server since we last saw it. NEVER overwrite silently —
          // surface the conflict; the badge offers Adopt server / Keep mine (force).
          setSyncConflict(true);
          return;
        }
        const data = await response.json();
        if (data && data.success && data.version) {
          setLocalVersion(data.version);
          localStorage.setItem('x4_mod_studio_version', String(data.version));
          if (typeof data.workspaceHash === 'string' && data.workspaceHash) {
            lastServerHashRef.current = data.workspaceHash;
          }
          setSyncConflict(false);
        }
      } catch {
        console.warn("Could not synchronize local edits to server workspace space.");
      }
    };

    // QoL: 300ms (was 1000ms) — the agent API and AgentBridge live view read
    // the server copy, so client→server staleness should be near-imperceptible.
    const debounceTimer = setTimeout(syncLocalEditsToServer, 300);
    // Flush immediately when the tab loses visibility so an agent polling the
    // API right after the user alt-tabs sees the latest canvas.
    const flushOnHide = () => { if (document.visibilityState === 'hidden') syncLocalEditsToServer(); };
    document.addEventListener('visibilitychange', flushOnHide);
    return () => {
      clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', flushOnHide);
    };
  }, [workspace]);

  const executeCompileModProject = async () => {
    setCompileStatus('compiling');
    setDeployChecklist([]);
    setCompileMessage('Compiling and deploying project on the server...');
    try {
      // Audit R4: deploy-verify (full 9-stage preflight) replaces the deprecated /deploy.
      const deployRes = await fetch('/api/agent/deploy-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace })
      });
      const deployData = await deployRes.json();
      setDeployChecklist(Array.isArray(deployData.checklist) ? deployData.checklist : []);
      if (deployRes.ok && deployData.ok) {
        setCompileStatus('success');
        setCompileMessage(`Deployed + verified "${deployData.modId}" to ${deployData.deployedPath || deployData.stagingPath}` +
          (deployData.stagingPath && deployData.deployedPath ? ' (+ staging)' : ''));
      } else {
        const failed = (deployData.checklist || []).find((c: { status: string }) => c.status === 'fail');
        setCompileStatus('error');
        setCompileMessage(deployData.error || (failed ? `${failed.label}: ${failed.detail}` : 'Compilation or deployment failed.'));
      }
    } catch (e: unknown) {
      setCompileStatus('error');
      setCompileMessage(e instanceof Error ? e.message : 'Compilation failed. Connection error.');
    }
  };

  const handleCompileModProject = async () => {
    if (!modWorkspacePath) {
      setCompileStatus('error');
      setCompileMessage('No workspace staging folder configured. Please configure it in Settings.');
      return;
    }
    setCompileStatus('idle');
    setCompileMessage('');
    setDeployChecklist([]);
    setIsCompileModalOpen(true);
  };

  // Initial load and periodic background polling of the server workspace
  useEffect(() => {
    const fetchLatestServerWorkspace = async () => {
      try {
        const response = await fetch("/api/agent/workspace");
        const data = await response.json();
        if (data && data.workspace && data.version) {
          const storedVer = Number(localStorage.getItem('x4_mod_studio_version') || String(localVersion));
          if (data.version > storedVer && !syncConflictRef.current) {
            setWorkspace(data.workspace);
            setLocalVersion(data.version);
            localStorage.setItem('x4_mod_studio_version', String(data.version));
            localStorage.setItem('x4_mod_studio_workspace', JSON.stringify(data.workspace));
            // B2 slice 2: adoption is also learning the head (this branch returns early —
            // missing this line left the CAS ref empty after every adoption).
            if (typeof data.workspaceHash === 'string' && data.workspaceHash) lastServerHashRef.current = data.workspaceHash;
            syncMissesRef.current = 0;
            setSyncDiverged(false);
            return;
          }
          if (syncConflictRef.current) return; // human is deciding — hold ALL automatic adoption
          // B2 slice 2: the poll is also how the client learns the current server head.
          if (typeof data.workspaceHash === 'string' && data.workspaceHash.length > 0) {
            lastServerHashRef.current = data.workspaceHash;
          }
          // B1 sync-trust: the version gate said "don't adopt" — verify CONTENT actually
          // agrees. A transient mismatch (<~6s) is just the edit→sync debounce; a
          // persistent one is real divergence (the stale-canvas incident class) and gets
          // a visible badge instead of silence.
          if (typeof data.workspaceHash === 'string' && data.workspaceHash.length > 0) {
            const memo = pollHashMemoRef.current;
            let localHash: string;
            if (memo && memo.ws === workspaceRef.current) {
              localHash = memo.hash;
            } else {
              localHash = workspaceContentHash(sanitizeWorkspace(workspaceRef.current));
              pollHashMemoRef.current = { ws: workspaceRef.current, hash: localHash };
            }
            if (localHash !== data.workspaceHash) {
              syncMissesRef.current += 1;
              if (syncMissesRef.current >= 3) setSyncDiverged(true);
            } else {
              syncMissesRef.current = 0;
              setSyncDiverged(false);
            }
          }
        }
      } catch {
        // Silently ignore background polling connection issues
      }
    };

    fetchLatestServerWorkspace();
    const interval = setInterval(fetchLatestServerWorkspace, 3000);
    return () => clearInterval(interval);
  }, [localVersion, setWorkspace]);

  // B1: adopt the server workspace explicitly (badge click) — the user's choice, never silent.
  const adoptServerWorkspace = async () => {
    try {
      const data = await fetch("/api/agent/workspace").then(r => r.json());
      if (data?.workspace) {
        setWorkspace(data.workspace);
        if (data.version) {
          setLocalVersion(data.version);
          localStorage.setItem('x4_mod_studio_version', String(data.version));
        }
        localStorage.setItem('x4_mod_studio_workspace', JSON.stringify(data.workspace));
        if (typeof data.workspaceHash === 'string' && data.workspaceHash) lastServerHashRef.current = data.workspaceHash;
        syncMissesRef.current = 0;
        setSyncDiverged(false);
        setSyncConflict(false);
      }
    } catch { /* leave the badge up — nothing adopted */ }
  };

  // B12: parked-workspace switcher (rides B2s3's park-on-switch server state).
  const [parkedList, setParkedList] = useState<Array<{ name: string; slug: string; nodeCount: number; contentSummary?: string }>>([]);
  const refreshParkedList = async () => {
    try {
      const data = await fetch('/api/agent/workspace/parked').then(r => r.json());
      if (Array.isArray(data?.parked)) setParkedList(data.parked);
    } catch { /* switcher just shows presets when the list is unavailable */ }
  };
  // Ready before interaction: on boot, and whenever a switch/load may have parked
  // something (workspace name change). onFocus refresh stays as a liveness bonus.
  useEffect(() => { refreshParkedList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workspace.name]);
  const restoreParkedWorkspace = async (name: string) => {
    try {
      const response = await fetch('/api/agent/workspace/restore-parked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (data?.success && data.workspace) {
        saveCheckpoint();
        setWorkspace(data.workspace);
        if (data.version) { setLocalVersion(data.version); localStorage.setItem('x4_mod_studio_version', String(data.version)); }
        localStorage.setItem('x4_mod_studio_workspace', JSON.stringify(data.workspace));
        if (typeof data.workspaceHash === 'string' && data.workspaceHash) lastServerHashRef.current = data.workspaceHash;
        syncMissesRef.current = 0;
        setSyncDiverged(false);
        setSyncConflict(false);
        refreshParkedList();
      }
    } catch { /* server unreachable — the canvas stays as-is */ }
  };

  // B2 slice 2: "Keep mine" — the explicit force valve (ADR-F1: last-writer-wins is
  // chosen by a human, never by silence). B2s3: the choice is now spelled force:true —
  // the server rejects blind no-head writes outright.
  const forceKeepMine = async () => {
    try {
      const response = await fetch("/api/agent/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // B2s3: the server's legacy gate requires overwrites to be EXPLICIT now.
        body: JSON.stringify({ workspace: workspaceRef.current, force: true })
      });
      const data = await response.json();
      if (data?.success) {
        if (data.version) { setLocalVersion(data.version); localStorage.setItem('x4_mod_studio_version', String(data.version)); }
        if (typeof data.workspaceHash === 'string' && data.workspaceHash) lastServerHashRef.current = data.workspaceHash;
        setSyncConflict(false);
        setSyncDiverged(false);
        syncMissesRef.current = 0;
      }
    } catch { /* conflict card stays up */ }
  };

  // Command node addition handler
  const handleAddNode = (template: Omit<MDNode, 'id' | 'x' | 'y'>) => {
    saveCheckpoint();
    const newNode: MDNode = {
      ...template,
      id: `node_${Date.now()}`,
      x: 100 + Math.random() * 80,
      y: 120 + Math.random() * 80,
      properties: { ...template.properties }
    };
    setWorkspace(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
    setSelectedNode(newNode);
  };

  // UI Widget addition handler
  const handleAddUIWidget = (type: string) => {
    saveCheckpoint();
    const getWidgetDefaults = () => {
      switch (type) {
        case 'window': return { w: 420, h: 300, label: 'Control Sub console', properties: {} };
        case 'header': return { w: 320, h: 40, label: 'COCKPIT COMMS SCANNER', properties: {} };
        case 'table': return { w: 400, h: 180, label: 'Sectors Cargo Manifest', properties: {} };
        case 'button': return { w: 180, h: 45, label: 'LAUNCH EXTERMINATORS', properties: { action: 'signal_cue', targetCue: 'Bounty_Active_Cue' } };
        case 'progressbar': return { w: 300, h: 40, label: 'Warp Jump Coils', properties: { value: 75, progressColor: '#3b82f6' } };
        case 'text': return { w: 220, h: 30, label: 'Warning: Hull Breach near port engine', properties: {} };
        case 'dropdown': return { w: 180, h: 35, label: 'Standard Alert Modes', properties: { options: ['Red alert', 'Yellow alert', 'Green safe'] } };
        case 'input': return { w: 220, h: 40, label: '', properties: { placeholder: 'Type transmission command...' } };
        case 'chat': return { w: 320, h: 180, label: 'Sector Operations Chat Logs', properties: { messages: ['[COCOPILOT]: Welcome, Captain.', '[ARGON FLEET]: System status active.', '[XENON INCURSION]: Active threats in Sector 0'] } };
        default: return { w: 150, h: 40, label: 'Widget label', properties: {} };
      }
    };

    const defaults = getWidgetDefaults();
    const widgetType = type as UIWidget['type'];
    const newWidget: UIWidget = {
      id: `widget_${Date.now()}`,
      type: widgetType,
      x: 50 + Math.round(Math.random() * 40),
      y: 80 + Math.round(Math.random() * 40),
      ...defaults
    };

    setWorkspace(prev => ({
      ...prev,
      uiWidgets: [...prev.uiWidgets, newWidget]
    }));
    setSelectedWidget(newWidget);
  };

  // Reset workspace
  const handleClearWorkspace = () => {
    saveCheckpoint();
    setWorkspace(BLANK_WORKSPACE);
    setSelectedNode(null);
    setSelectedWidget(null);
  };

  // Load sample presets
  const handleLoadPreset = (key: 'escort' | 'mission' | 'blank' | '__current') => {
    if (key === '__current') return; // label-only option for the loaded workspace; not a load action
    saveCheckpoint();
    if (key === 'blank') {
      handleClearWorkspace();
    } else {
      const preset = PRESETS[key];
      if (preset) {
        const loaded: ModWorkspace = {
          id: `workspace_${Date.now()}`,
          ...preset.workspace
        };
        setWorkspace(loaded);
        setSelectedNode(null);
        setSelectedWidget(null);
      }
    }
  };


  // MD Scripts Validation State calculations
  const mdDiagnostics = React.useMemo<PackageDiagnostic[]>(() => {
    try {
      const code = generateMDXML(workspace);
      return validateModWorkspace(workspace, code);
    } catch (e) {
      return [{ severity: 'error', message: String(e), category: 'syntax' }];
    }
  }, [workspace]);

  const mdErrorCount = mdDiagnostics.filter(d => d.severity === 'error').length;
  const mdWarningCount = mdDiagnostics.filter(d => d.severity === 'warning').length;
  // First diagnostic that points at a node, so the indicators can jump straight to it.
  const firstFlaggedNodeId =
    mdDiagnostics.find(d => d.severity === 'error' && d.nodeId)?.nodeId ||
    mdDiagnostics.find(d => d.severity === 'warning' && d.nodeId)?.nodeId;
  const jumpToFlaggedNode = React.useCallback(() => {
    setWorkspaceView('blueprint');
    setActiveSidebarTab('script');
    if (firstFlaggedNodeId) {
      // let the blueprint view mount/lay out before centering on the node
      setTimeout(() => window.dispatchEvent(new CustomEvent('forge-focus-node', { detail: { nodeId: firstFlaggedNodeId } })), 80);
    }
  }, [firstFlaggedNodeId]);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0F1115] text-slate-300 font-sans">
      <FpsMeter />
      <HealthCardOverlay />
      <DialogHost />
      {/* Upper Technical Header */}
      <header className="h-12 border-b border-white/10 bg-[#161920] px-4 flex items-center justify-between shrink-0 font-mono">
        
        {/* Workspace Brand and Logo */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            {/* X4 Forge mark: anvil + spark on a cyan→violet plate */}
            <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-label="X4 Forge logo">
              <defs>
                <linearGradient id="x4forgeGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#06b6d4" />
                  <stop offset="1" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <rect x="0.5" y="0.5" width="23" height="23" rx="5.5" fill="url(#x4forgeGrad)" />
              <path d="M5 9h14v3h-5v2.2l3.2 2.8H6.8L10 14.2V12H5z" fill="#ffffff" />
              <path d="M17.6 3.1l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="#fbbf24" />
            </svg>
            <span className="font-semibold text-white tracking-tight shrink-0 select-none">
              X4 FORGE <span className="text-cyan-400/90 font-normal" title={__APP_BUILD__}>v{__APP_VERSION__}</span>
            </span>
            {workspace.sourceFolder && (
              <span
                className="hidden lg:inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-slate-300 max-w-[460px] shrink min-w-0"
                title={'Open project folder: ' + workspace.sourceFolder}
              >
                <span className="text-cyan-400/80 font-medium shrink-0">Open:</span>
                <span className="truncate font-mono">{workspace.sourceFolder}</span>
              </span>
            )}
          </div>

          {/* Full cross-domain search belongs to Expert; Beginner keeps one task path. */}
          {experienceMode === 'expert' && (
            <GlobalSearch
              workspace={workspace}
              workspaceView={workspaceView}
              setWorkspaceView={setWorkspaceView}
              setActiveSidebarTab={setActiveSidebarTab}
              setSelectedNode={setSelectedNode}
              setSelectedWidget={setSelectedWidget}
            />
          )}
        </div>

        {/* View Selection Mode Tabs */}
        {experienceMode === 'expert' && (
        <div id="view_selection_modes" className="flex items-center gap-1 p-1 rounded-md bg-black/45 border border-white/10">
          {(() => {
            const isActive = workspaceView === 'blueprint';
            let btnClass = '';
            let tooltip = '';
            let indicatorDot = null;
            
            if (mdErrorCount > 0) {
              // Red for errors
              btnClass = isActive
                ? 'bg-red-500/15 text-red-400 border border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.15)] hover:bg-red-500/25'
                : 'bg-red-500/5 text-red-400/80 hover:text-red-300 border border-red-500/20 hover:border-red-500/40';
              tooltip = `Editor Diagnostics — ${mdErrorCount} live validation error${mdErrorCount > 1 ? 's' : ''} detected! Click to view workspace flow errors.`;
              indicatorDot = (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              );
            } else if (mdWarningCount > 0) {
              // Amber for warnings
              btnClass = isActive
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.1)] hover:bg-amber-500/25'
                : 'bg-amber-500/5 text-amber-400/80 hover:text-amber-300 border border-amber-500/15 hover:border-amber-500/35';
              tooltip = `Editor Diagnostics — ${mdWarningCount} live validation warning${mdWarningCount > 1 ? 's' : ''} active. Click to view rules advisory.`;
              indicatorDot = (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              );
            } else {
              // Green for valid
              btnClass = isActive
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.1)] hover:bg-emerald-500/25'
                : 'text-slate-400 hover:text-emerald-400 border border-transparent hover:border-emerald-500/20';
              tooltip = "Editor Diagnostics — all live flowchart script validation checks satisfied (valid).";
              indicatorDot = (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              );
            }
            
            return (
              <button
                onClick={() => { if (firstFlaggedNodeId) { jumpToFlaggedNode(); } else { setWorkspaceView('blueprint'); setActiveSidebarTab('script'); } }}
                className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-2 transition-all cursor-pointer ${btnClass}`}
                title={firstFlaggedNodeId ? tooltip + ' — click to jump to the flagged node' : tooltip}
              >
                <GitFork className="w-3.5 h-3.5" />
                {/* B29: labels collapse to icon-only below 2xl so the header fits 1280 */}
                <span className="hidden min-[2150px]:inline">MD Scripts</span>
                {indicatorDot}
              </button>
            );
          })()}
          
          <button
            onClick={() => { setWorkspaceView('aiscripts'); setActiveSidebarTab('script'); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceView === 'aiscripts'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            title="AIScripts"
          >
            <Scroll className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">AIScripts</span>
          </button>

          <button
            onClick={() => { setWorkspaceView('libraries'); setActiveSidebarTab('config'); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceView === 'libraries'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            title="Wares & Jobs"
          >
            <Package className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">Wares & Jobs</span>
          </button>

          <button
            onClick={() => { setWorkspaceView('ui-designer'); setActiveSidebarTab('ui'); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceView === 'ui-designer'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            title="HUD & LUA UI"
          >
            <Layout className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">HUD & LUA UI</span>
          </button>

          <button
            onClick={() => { setWorkspaceView('xmlpatch'); setActiveSidebarTab('config'); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceView === 'xmlpatch'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            title="XML Patching"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">XML Patching</span>
          </button>

          <button
            onClick={() => { setWorkspaceView('project'); setActiveSidebarTab('config'); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceView === 'project'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            title="Project"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">Project</span>
          </button>

          <button
            onClick={() => { setWorkspaceView('galaxy'); setActiveSidebarTab('reference'); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceView === 'galaxy'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            title="Galaxy"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">Galaxy</span>
          </button>

          <button
            onClick={() => { setWorkspaceView('contracts'); setActiveSidebarTab('config'); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceView === 'contracts'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            title="Contracts"
          >
            <Plug className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">Contracts</span>
          </button>

          <button
            onClick={() => { setWorkspaceView('translation'); setActiveSidebarTab('config'); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceView === 'translation'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            title="Languages (t/)"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">Languages (t/)</span>
          </button>

          <button
            onClick={() => { setWorkspaceView('wiki'); setActiveSidebarTab('config'); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceView === 'wiki'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            title="X4 Wiki"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">X4 Wiki</span>
          </button>
        </div>
        )}

        {/* Preset & Project management utilities */}
        <div className="flex items-center gap-1 min-[2150px]:gap-3">
          {/* History Undo/Redo Group */}
          <div className="flex items-center gap-1 bg-black/45 border border-white/10 p-1 rounded-md">
            <button
              onClick={handleUndo}
              disabled={pastStates.length === 0}
              className={`p-1 px-2 rounded font-mono text-[11px] flex items-center gap-1 transition-all ${
                pastStates.length > 0
                  ? 'text-cyan-400 hover:bg-cyan-500/10 cursor-pointer'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Undo last action (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="text-[9px] hidden min-[2150px]:inline">({pastStates.length})</span>
            </button>
            <button
              onClick={handleRedo}
              disabled={futureStates.length === 0}
              className={`p-1 px-2 rounded font-mono text-[11px] flex items-center gap-1 transition-all ${
                futureStates.length > 0
                  ? 'text-cyan-400 hover:bg-cyan-500/10 cursor-pointer'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Redo action (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span className="text-[9px] hidden min-[2150px]:inline">({futureStates.length})</span>
            </button>
            {/* B13: discoverable entry to the shortcuts list (also bound to "?") */}
            <button
              onClick={() => setIsShortcutsOpen(true)}
              data-testid="shortcuts-open-btn"
              className="p-1 px-2 rounded font-mono text-[11px] text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer transition-all"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-black/35 rounded border border-white/10 p-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider px-1 hidden min-[2150px]:inline">Workspace:</span>
            <select
              value="__current"
              data-testid="workspace-switcher"
              onFocus={refreshParkedList}
              onChange={async (e) => {
                const pick = e.target.value;
                if (pick === '__current') return;
                // B12: parked workspaces — switching PARKS the current state server-side
                // (B2s3 park-on-switch), so nothing is ever lost either direction.
                if (pick.startsWith('parked:')) {
                  const name = pick.slice('parked:'.length);
                  const ok = await confirmDialog(
                    `Switch to the parked workspace "${name}"? The current canvas ("${workspace.name || 'Untitled'}") is parked first — switch back the same way.`,
                    { okLabel: 'Switch workspace', cancelLabel: 'Stay here' },
                  );
                  if (ok) await restoreParkedWorkspace(name);
                  return;
                }
                // B13 guard (2026-07-09): a preset pick REPLACES the whole canvas — twice
                // this shipped silently (once via browser form-restoration on reload).
                // Explicit confirm, always. (B2s3: the replaced state is parked, recoverable.)
                const ok = await confirmDialog(
                  `Replace the current canvas ("${workspace.name || 'Untitled'}") with a preset? The current graph is overwritten (Undo can restore it).`,
                  { okLabel: 'Replace canvas', cancelLabel: 'Keep my canvas' },
                );
                if (ok) handleLoadPreset(pick as 'escort' | 'mission' | 'blank');
              }}
              className="bg-[#0F1115] border border-white/10 p-1 rounded text-[10px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer max-w-[130px] min-[2150px]:max-w-none truncate"
            >
              {/* H6: show the actually-loaded workspace, not a stale "Blank Workspace" label */}
              <option value="__current">{workspace.name || 'Current Workspace'}</option>
              {/* B12: parked server states — switch without losing anything. */}
              {parkedList.filter(p => p.name !== workspace.name).length > 0 && (
                <optgroup label="Parked workspaces">
                  {parkedList.filter(p => p.name !== workspace.name).map(p => (
                    <option key={p.slug} value={`parked:${p.name}`}>{p.name} ({p.contentSummary ?? `${p.nodeCount} nodes`})</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Presets">
                <option value="blank">Blank Workspace</option>
                <option value="escort">Elite Fighter Wing Escort</option>
                <option value="mission">Argon Sector Bounty System</option>
              </optgroup>
            </select>
          </div>

          {/* B29: the conflict card / diverged badge moved OUT of the header into the fixed
              sync-status layer below — a header slot gets clipped on narrow windows, and the
              conflict UI must be visible exactly when a conflict blocks sync. */}
          {experienceMode === 'expert' && (
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="px-3 py-1 border border-cyan-500/30 hover:border-cyan-500/80 bg-cyan-500/10 text-cyan-400 rounded font-mono text-[11px] hover:bg-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Load existing mods or push updates to GitHub"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">SYNC MOD</span>
          </button>
          )}

          {experienceMode === 'expert' && aiEnabled && (
          <button
            onClick={() => setIsAIConfigOpen(true)}
            className="px-3 py-1 border border-amber-500/25 hover:border-[#df9825] bg-amber-500/5 text-amber-400 rounded font-mono text-[11px] hover:bg-amber-500/15 transition-all flex flex-col justify-center items-start text-left cursor-pointer select-none leading-tight gap-0.5"
            title={`Configure AI: Active Engine: ${activeAIProvider.toUpperCase()} | Model: ${activeAIModel} | Reasoning: ${activeReasoning}`}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
              <span className="font-bold text-[9px] tracking-wide text-slate-200 uppercase"><span className="hidden min-[2150px]:inline">AI ENGINE: </span>{activeAIProvider.toUpperCase()}</span>
            </div>
            <div className="hidden min-[2150px]:flex items-center gap-1.5 text-[8.5px] text-[#df9825] font-mono leading-none">
              <span className="opacity-95">{activeAIModel.length > 20 ? activeAIModel.substring(0, 18) + '...' : activeAIModel}</span>
              {activeReasoning !== 'none' && (
                <span className="bg-[#df9825]/15 px-1 py-0.5 rounded border border-[#df9825]/20 text-[7px] uppercase font-bold text-emerald-400">
                  THINK:{activeReasoning}
                </span>
              )}
            </div>
          </button>
          )}

          {experienceMode === 'expert' && (
          <button
            onClick={() => setIsAgentBridgeOpen(prev => !prev)}
            className={`px-3 py-1 border rounded font-mono text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
              isAgentBridgeOpen
                ? 'bg-cyan-600/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-600/30 font-bold'
                : 'bg-black/40 text-slate-300 border-white/10 hover:border-cyan-400/40 hover:text-white'
            }`}
            title="Open External AI Agent API Control panel and documentation"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">AGENT API</span>
          </button>
          )}

          <button
            data-testid="report-bug-button"
            onClick={() => setIsBugReportOpen(true)}
            className="px-3 py-1 border border-amber-500/30 hover:border-amber-400/60 bg-black/40 text-amber-300 hover:text-amber-200 rounded font-mono text-[11px] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Report a bug — opens a pre-filled GitHub issue (no account? it can copy the report instead)"
          >
            <Bug className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">REPORT BUG</span>
          </button>

          <button
            onClick={() => setIsDirSettingsOpen(true)}
            className="px-3 py-1 border border-white/10 hover:border-cyan-400/40 bg-black/40 text-slate-300 hover:text-white rounded font-mono text-[11px] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Manage all folders the studio uses (Mod Workspace, X4 game path, schema)"
          >
            <SettingsGear className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">SETTINGS</span>
          </button>

          <button
            onClick={handleClearWorkspace}
            className="px-3 py-1 border border-red-500/10 hover:border-red-500/30 bg-red-500/5 text-red-400 rounded font-mono text-[11px] hover:bg-red-500/10 transition-all flex items-center gap-1 cursor-pointer"
            title="Clean workspace back to blank state"
          >
            <Trash className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">RESET</span>
          </button>
        </div>
      </header>

      <ReadinessLadder
        stages={readinessStages}
        onNavigate={navigateReadiness}
        onConfirmExperience={confirmCurrentExperience}
        trailing={(
          <div data-testid="experience-mode-switch" className="flex items-center gap-1 rounded-md border border-white/10 bg-black/45 p-1">
            <button data-testid="mode-beginner" aria-pressed={experienceMode === 'beginner'} onClick={() => changeExperienceMode('beginner')} className={`rounded px-2 py-1 text-[9px] font-mono font-bold uppercase ${experienceMode === 'beginner' ? 'bg-cyan-600/25 text-cyan-300' : 'text-slate-500 hover:text-white'}`}>Beginner</button>
            <button data-testid="mode-expert" aria-pressed={experienceMode === 'expert'} onClick={() => changeExperienceMode('expert')} className={`rounded px-2 py-1 text-[9px] font-mono font-bold uppercase ${experienceMode === 'expert' ? 'bg-amber-600/25 text-amber-300' : 'text-slate-500 hover:text-white'}`}>Expert</button>
          </div>
        )}
      />

      {/* B29: viewport-anchored sync-status layer — can NEVER be clipped by header overflow.
          Persistent until resolved (unlike the transient toast stack), so it lives in its own
          fixed slot just below the header, above everything but dialogs. */}
      {(syncConflict || syncDiverged) && (
        <div data-testid="sync-status-layer" className="fixed top-14 right-3 z-[9999]">
          {syncConflict ? (
            // B2 slice 2: explicit write conflict — another writer changed the server since
            // this canvas last saw it. A HUMAN picks the winner; nothing is silent.
            <div data-testid="sync-conflict-card" className="flex items-center gap-1.5 px-2.5 py-1.5 border border-red-500/50 bg-[#1a0d0d]/95 rounded-lg shadow-2xl font-mono text-[10px] text-red-200 whitespace-nowrap">
              <span className="font-bold">⚠ WRITE CONFLICT</span>
              <button
                onClick={adoptServerWorkspace}
                data-testid="conflict-adopt-btn"
                className="px-2 py-0.5 rounded bg-cyan-600/40 border border-cyan-400/40 hover:bg-cyan-600/60 text-cyan-100 font-bold cursor-pointer"
                title="Discard this canvas's unsent changes and take the server's copy."
              >
                ADOPT SERVER
              </button>
              <button
                onClick={forceKeepMine}
                data-testid="conflict-keep-btn"
                className="px-2 py-0.5 rounded bg-amber-600/40 border border-amber-400/40 hover:bg-amber-600/60 text-amber-100 font-bold cursor-pointer"
                title="Overwrite the server with this canvas (last-writer-wins, chosen deliberately)."
              >
                KEEP MINE
              </button>
            </div>
          ) : (
            <button
              onClick={adoptServerWorkspace}
              data-testid="sync-diverged-badge"
              className="px-3 py-1.5 border border-amber-500/50 bg-[#1a140d]/95 text-amber-300 rounded-lg shadow-2xl font-mono text-[11px] hover:bg-amber-500/25 transition-all flex items-center gap-1.5 cursor-pointer animate-pulse whitespace-nowrap"
              title="Your canvas content differs from the server copy (persistently, not just mid-edit). Click to adopt the server workspace — or keep editing and your next change syncs up normally."
            >
              ⚠ CANVAS ≠ SERVER — ADOPT
            </button>
          )}
        </div>
      )}

      {/* Main Workspace split panel areas */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side: Drag control panel, property editor inspector */}
        {experienceMode === 'expert' ? (
        <Sidebar
          width={leftSidebarWidth}
          aiEnabled={aiEnabled}
          activeTab={activeSidebarTab}
          setActiveTab={setActiveSidebarTab}
          workspace={workspace}
          setWorkspace={(updater) => {
            // Save state checkpoint before doing adjustments from sidebar fields
            saveCheckpoint();
            setWorkspace(updater);
          }}
          onAddNode={handleAddNode}
          onAddUIWidget={handleAddUIWidget}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          selectedWidget={selectedWidget}
          setSelectedWidget={setSelectedWidget}
          modWorkspacePath={modWorkspacePath}
          filesystemPath={filesystemPath}
          saveCheckpoint={saveCheckpoint}
          workspaceView={workspaceView}
          setWorkspaceView={setWorkspaceView}
          schemaTemplates={schemaTemplates}
          onSchemaConfigChanged={loadSchemaLibrary}
          onOpenDirectorySettings={() => setIsDirSettingsOpen(true)}
          schemaConfigVersion={schemaConfigVersion}
          onOpenEditorFile={(file) => {
            setActiveEditorFile(file);
          }}
          autoSaveEnabled={autoSaveEnabled}
          setAutoSaveEnabled={setAutoSaveEnabled}
          workspaceDirMode={workspaceDirMode}
          setWorkspaceDirMode={setWorkspaceDirMode}
          compileStatus={compileStatus}
          compileMessage={compileMessage}
          handleCompileModProject={handleCompileModProject}
          visibleCueIds={visibleCueIds}
          setVisibleCueIds={setVisibleCueIds}
          setFocusNodeRequest={setFocusNodeRequest}
          aiChatHistory={aiChatHistory}
          setAiChatHistory={setAiChatHistory}
          aiInputText={aiInputText}
          setAiInputText={setAiInputText}
          aiActiveMode={aiActiveMode}
          setAiActiveMode={setAiActiveMode}
          aiLoading={aiLoading}
          aiErrorText={aiErrorText}
          isAiFloatingVisible={isAiFloatingVisible}
          setIsAiFloatingVisible={setIsAiFloatingVisible}
          isAiFloatingOpen={isAiFloatingOpen}
          setIsAiFloatingOpen={setIsAiFloatingOpen}
          aiKnownTags={aiKnownTags}
          aiTier={aiTier}
          onAiCancel={cancelAiRequest}
          handleSend={handleSend}
          handleApplyAction={handleApplyAction}
          handleDeclineAction={handleDeclineAction}
          architectBlueprint={architectBlueprint}
          onBlueprintChange={setArchitectBlueprint}
          onRunArchitectStep={runArchitectStep}
          architectRunning={architectRunning}
          architectStep={architectStep}
          onConfirmArchitectStep={confirmArchitectStep}
          onDeclineArchitectStep={declineArchitectStep}
          architectCanRun={architectCanRun}
          architectRunDisabledReason={architectCanRun ? undefined : 'No AI key set — add one in Settings → AI Assistant → Configure AI engine.'}
          diagnostics={effectiveDiagnostics}
          diagnosticSource={diagnosticSource}
          diagnosticsScope={diagnosticsScope}
          onSelectSnapshot={setSnapshotDiffWorkspace}
        />
        ) : (
          <BeginnerWorkspace
            width={leftSidebarWidth}
            step={beginnerStep}
            onStepChange={changeBeginnerStep}
            workspace={workspace}
            setWorkspace={setWorkspace}
            selectedNode={workspaceView === 'ui-designer' ? null : selectedNode}
            setSelectedNode={setSelectedNode}
            selectedWidget={workspaceView === 'ui-designer' ? selectedWidget : null}
            setSelectedWidget={setSelectedWidget}
            saveCheckpoint={saveCheckpoint}
            readinessStages={readinessStages}
            compileStatus={compileStatus}
            compileMessage={compileMessage}
            onDeploy={handleCompileModProject}
            onConfirmExperience={confirmCurrentExperience}
          />
        )}

        {/* Left Resizer Handle */}
        <div
          className={`w-1 cursor-col-resize hover:bg-cyan-500/50 hover:w-1.5 transition-all bg-white/5 h-full relative z-40 select-none shrink-0 ${
            isResizingLeft ? 'bg-cyan-500 w-1.5' : ''
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingLeft(true);
          }}
        />

        {/* Center: Canvas editor viewport (Based on active workspace mode) */}
        <main className="flex-1 flex flex-col h-full overflow-hidden border-r border-white/10 bg-[#0a0c10]">
          
          {workspaceView === 'blueprint' ? (
            <Canvas
              workspace={workspace}
              setWorkspace={setWorkspace}
              saveCheckpoint={saveCheckpoint}
              selectedNode={selectedNode}
              setSelectedNode={setSelectedNode}
              schemaTemplates={schemaTemplates}
              visibleCueIds={visibleCueIds}
              focusNodeRequest={focusNodeRequest}
              selectedCueIds={selectedCueIds}
              setSelectedCueIds={setSelectedCueIds}
              activeMdScript={activeMdScript}
              packageDiagnostics={effectiveDiagnostics}
              diagnosticSource={diagnosticSource}
            />
          ) : workspaceView === 'ui-designer' ? (
            <UIBuilder
              workspace={workspace}
              setWorkspace={setWorkspace}
              selectedWidget={selectedWidget}
              setSelectedWidget={setSelectedWidget}
            />
          ) : workspaceView === 'aiscripts' ? (
            <AIScriptEditor
              workspace={workspace}
              setWorkspace={setWorkspace}
            />
          ) : workspaceView === 'libraries' ? (
            <LibraryConfigurator
              workspace={workspace}
              setWorkspace={setWorkspace}
              saveCheckpoint={saveCheckpoint}
            />
          ) : workspaceView === 'translation' ? (
            <TFileEditor
              workspace={workspace}
              setWorkspace={setWorkspace}
            />
          ) : workspaceView === 'wiki' ? (
            <WikiBrowser
              selectedNode={selectedNode}
              setSelectedNode={setSelectedNode}
              setWorkspace={setWorkspace}
            />
          ) : workspaceView === 'contracts' ? (
            <ContractEditor
              workspace={workspace}
              setWorkspace={setWorkspace}
            />
          ) : workspaceView === 'project' ? (
            <ProjectInspector workspace={workspace} />
          ) : workspaceView === 'galaxy' ? (
            <GalaxyMapView />
          ) : (
            <XMLPatchSystem
              workspace={workspace}
              setWorkspace={setWorkspace}
            />
          )}

        </main>

        {/* Right Resizer Handle — hidden when the code panel is collapsed (nothing to resize). */}
        {experienceMode === 'expert' && !codeCollapsed && (
          <div
            className={`w-1 cursor-col-resize hover:bg-cyan-500/50 hover:w-1.5 transition-all bg-white/5 h-full relative z-40 select-none shrink-0 ${
              isResizingRight ? 'bg-cyan-500 w-1.5' : ''
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingRight(true);
            }}
          />
        )}

        {/* Right Side: Real-time Synchronized compiler preview output (collapsible) */}
        {experienceMode === 'expert' && (
        <aside
          className={`shrink-0 min-w-0 flex flex-col bg-[#12141a] border-l border-[#df9825]/10 relative transition-[width] duration-300 ease-in-out overflow-hidden ${codeCollapsed ? 'self-start rounded-bl-lg shadow-lg' : 'h-full'}`}
          style={{ width: codeCollapsed ? 300 : rightSidebarWidth }}
        >
          {/* Drawer pull-tab — toggles the code BODY (the top bar below always persists). */}
          <button
            onClick={() => setCodeCollapsed(c => !c)}
            title={codeCollapsed ? 'Show code editor' : 'Hide code editor'}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-50 w-5 h-14 rounded-md bg-[#1b1e26] border border-[#df9825]/30 flex items-center justify-center text-slate-400 hover:text-amber-300 hover:border-amber-400/60 shadow-lg transition-colors cursor-pointer"
          >
            {codeCollapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {/* PERSISTENT EDITOR TOP BAR — CodePreview portals its tabs+actions here. This is
              a separate element from the editor body; it never collapses with the editor. */}
          {/* min-w-0 + hidden x-overflow: without these, the bar's intrinsic tab/button width
              defeats the aside's inline width via flex min-content sizing (the collapsed
              drawer silently stayed at full width — found in the B48P2 live drill). */}
          <div ref={setEditorBarEl} className="shrink-0 w-full min-w-0 overflow-x-hidden bg-[#0b0d12]" />

          {/* EDITOR BODY (code-only) — hidden when collapsed; the top bar above stays. */}
          <div className={`flex-1 min-h-0 w-full overflow-hidden ${codeCollapsed ? 'hidden' : 'flex'}`}>
          <CodePreview
            topBarTarget={editorBarEl}
            codeCollapsed={codeCollapsed}
            setCodeCollapsed={setCodeCollapsed}
            workspace={workspace}
            setWorkspace={setWorkspace}
            activeMdScript={activeMdScript}
            setActiveMdScript={setActiveMdScript}
            saveCheckpoint={saveCheckpoint}
            modWorkspacePath={modWorkspacePath}
            compileStatus={compileStatus}
            compileMessage={compileMessage}
            handleCompileModProject={handleCompileModProject}
            activeEditorFile={activeEditorFile}
            setActiveEditorFile={setActiveEditorFile}
            selectedNode={selectedNode}
            diagnostics={effectiveDiagnostics}
            onBufferDiagnosticsChange={setBufferDiagnostics}
            diagnosticSource={diagnosticSource}
            snapshotDiffWorkspace={snapshotDiffWorkspace}
            onClearSnapshotDiff={() => setSnapshotDiffWorkspace(null)}
            selectedCueIds={selectedCueIds}
            autoSaveEnabled={autoSaveEnabled}
            setAutoSaveEnabled={setAutoSaveEnabled}
          />
          </div>
        </aside>
        )}

      </div>

      {/* Embedded Intelligent AI Guide Drawer chatbot */}
      {experienceMode === 'expert' && aiEnabled && isAiFloatingVisible && (
        <AIHelper
          mode="floating"
          workspace={workspace}
          setWorkspace={setWorkspace}
          localVersion={localVersion}
          setLocalVersion={setLocalVersion}
          chatHistory={aiChatHistory}
          setChatHistory={setAiChatHistory}
          inputText={aiInputText}
          setInputText={setAiInputText}
          activeMode={aiActiveMode}
          setActiveMode={setAiActiveMode}
          loading={aiLoading}
          errorText={aiErrorText}
          isOpen={isAiFloatingOpen}
          setIsOpen={setIsAiFloatingOpen}
          handleSend={handleSend}
          handleApplyAction={handleApplyAction}
          handleDeclineAction={handleDeclineAction}
          isAiFloatingVisible={isAiFloatingVisible}
          setIsAiFloatingVisible={setIsAiFloatingVisible}
          knownTags={aiKnownTags}
          onCancel={cancelAiRequest}
          aiTier={aiTier}
          architectBlueprint={architectBlueprint}
          onBlueprintChange={setArchitectBlueprint}
          onRunArchitectStep={runArchitectStep}
          architectRunning={architectRunning}
          architectStep={architectStep}
          onConfirmArchitectStep={confirmArchitectStep}
          onDeclineArchitectStep={declineArchitectStep}
          architectCanRun={architectCanRun}
          architectRunDisabledReason={architectCanRun ? undefined : 'No AI key set — add one in Settings → AI Assistant → Configure AI engine.'}
        />
      )}

      {/* External AI Agent Developer Connection Gateway drawer panel */}
      <AgentBridge
        isOpen={isAgentBridgeOpen}
        onClose={() => setIsAgentBridgeOpen(false)}
        workspace={workspace}
        setWorkspace={setWorkspace}
        localVersion={localVersion}
        setLocalVersion={setLocalVersion}
        setFocusNodeRequest={setFocusNodeRequest}
      />

      {/* Load Mod & GitHub Synchronization Module */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        workspace={workspace}
        setWorkspace={setWorkspace}
        saveCheckpoint={saveCheckpoint}
        setWorkspaceView={setWorkspaceView}
        modWorkspacePath={modWorkspacePath}
        filesystemPath={filesystemPath}
        setAutoSaveEnabled={setAutoSaveEnabled}
      />

      {/* AI Connection Provider Settings Modal */}
      <AIConnectionModal
        isOpen={isAIConfigOpen}
        onClose={() => setIsAIConfigOpen(false)}
      />

      {/* B13: keyboard-shortcuts documentation surface ("?" or the header keyboard button) */}
      {isShortcutsOpen && <ShortcutsOverlay onClose={() => setIsShortcutsOpen(false)} />}

      {/* B18: first-run setup wizard — the "first five minutes" front door */}
      {isFirstRunOpen && (
        <FirstRunWizard
          onClose={() => setIsFirstRunOpen(false)}
          onOpenManualSetup={() => setIsDirSettingsOpen(true)}
          onApplied={() => setSchemaConfigVersion(v => v + 1)}
        />
      )}

      {/* Directory Settings Modal — manages every folder the studio needs */}
      <DirectorySettingsModal
        isOpen={isDirSettingsOpen}
        onClose={() => { setIsDirSettingsOpen(false); setSchemaConfigVersion(v => v + 1); }}
        modWorkspacePath={modWorkspacePath}
        setModWorkspacePath={setModWorkspacePath}
        filesystemPath={filesystemPath}
        setFilesystemPath={setFilesystemPath}
        aiTier={aiTier}
        setAiTier={setAiTier}
        onOpenAIConfig={() => { setIsDirSettingsOpen(false); setIsAIConfigOpen(true); }}
      />

      {/* B52: Report-a-Bug modal — prefilled GitHub issue, secret-free (user submits) */}
      <BugReportModal
        isOpen={isBugReportOpen}
        onClose={() => setIsBugReportOpen(false)}
        context={{
          'App version': `${__APP_VERSION__}`,
          'Build': `${__APP_BUILD__}`,
          'Platform': typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
          'Shell': typeof window !== 'undefined' && window.location.port === '3000' ? 'standalone (dev)' : `sidecar/packaged (port ${typeof window !== 'undefined' ? window.location.port : '?'})`,
          'Workspace': `${workspace.name} (${workspace.nodes.length} nodes / ${workspace.links.length} links)`,
        }}
      />

      {/* Selectable Compile Targets Confirmation Wizard Modal */}
      <CompileConfirmationModal
        isOpen={isCompileModalOpen}
        onClose={() => setIsCompileModalOpen(false)}
        onConfirm={executeCompileModProject}
        workspace={workspace}
        setWorkspace={setWorkspace}
        modWorkspacePath={modWorkspacePath}
        compileStatus={compileStatus}
        compileMessage={compileMessage}
        checklist={deployChecklist}
      />
    </div>
  );
}
