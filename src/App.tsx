/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Trash,
  Cpu,
  Undo2,
  Redo2,
  FolderGit2,
  Sparkles,
  Settings as SettingsGear,
  Keyboard,
  Bug,
  Menu,
  PanelLeftOpen
} from 'lucide-react';
import BugReportModal from './components/BugReportModal';
import Sidebar from './components/Sidebar';
import FpsMeter from './components/FpsMeter';
import HealthCardOverlay from './components/HealthCardOverlay';
import DialogHost, { confirmDialog, promptDialog, toast } from './lib/uiDialogs';
import SyncModal from './components/SyncModal';
import WorkspaceConflictDialog, { type WorkspaceConflictDetail } from './components/WorkspaceConflictDialog';
import Canvas from './components/Canvas';
import UIBuilder from './components/UIBuilder';
import NativeProjectFiles from './components/NativeProjectFiles';
import { notifyNativeWorkspaceAuthority, openInNativeEditor, openNativeNodeSelection, postNativeNodeSelectionResult, type NativeNodeApplyRequest } from './lib/nativeEditor';
import AIHelper from './components/AIHelper';
import AgentBridge from './components/AgentBridge';
import AIConnectionModal from './components/AIConnectionModal';
import DirectorySettingsModal from './components/DirectorySettingsModal';
import WorkspaceNavigationBar from './components/WorkspaceNavigationBar';
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
import { workspaceContentHash, workspaceSnapshotHash } from './lib/workspaceIdentity';
import {
  invalidateWorkspacePollingHead,
  pollWorkspaceSnapshot,
  sameWorkspacePollingPair,
  WORKSPACE_POLLING_CONTRACT,
  type FullWorkspacePollingResponse,
  type WorkspaceAutoAdoptResult,
  type WorkspacePollingResponse,
} from './lib/workspacePolling';
import { fetchPollingJson } from './lib/continuousPolling';
import { useContinuousPolling } from './lib/useContinuousPolling';
import { persistWorkspaceCache } from './lib/localWorkspaceCache';
import { applyNodeSelectionDocument, buildNodeSelectionDocument, isNodeSelectionFailure } from './lib/nodeSelectionDocument';
import type { SchemaLibrary } from './lib/schemaTypes';
import { setSchemaTemplatesForImport } from './lib/xmlParser';
import { resolveCueToNodeId } from './lib/liveLogNav';
import { getActiveProvider, getProviderModel, getProviderReasoning, getAIHeaders, handleApiResponse, hasProviderKey, migrateLocalAiKeys } from './lib/apiHelper';
import { loadBlueprint, sampleBlueprint, saveBlueprint, recordRejection, evaluateBlueprintChecks, type ModBlueprint } from './lib/modBlueprint';
import { vetTaskProposal, nextActiveTask } from './lib/architectLoop';
import { getE2EPerfCounters, resetE2EPerfCounters, type E2EPerfCounters } from './lib/e2ePerfCounters';
import type { ArchitectStepView } from './components/BlueprintPanel';
import type { DiagnosticsScope } from './components/DiagnosticsCenter';
import type { ValidationDeltaResult } from './lib/validationDelta';
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
import {
  bindX4UiGameVerificationSnapshot,
  classifyX4UiGameVerification,
  refreshExperienceConfirmationPreservingX4UiSnapshot,
  type X4UiGameVerificationCurrentSnapshot,
  type X4UiGameVerificationDecision,
} from './lib/x4UiGameVerification';
import {
  STUDIO_LAYOUT_KEY,
  WORKSPACE_NAV_ITEMS,
  moveOrderedItem,
  normalizeStudioLayoutPreferences,
  parseStudioLayoutPreferences,
  visibleSidebarTabs,
  visibleWorkspaceViews,
  type SidebarTab,
  type StudioLayoutPreferences,
} from './lib/studioLayout';
import { createLatestValueWriteQueue, type LatestValueWriteQueue } from './lib/latestValueWriteQueue';
import {
  RELEASE_PREFERENCES_KEY,
  normalizeReleasePreferences,
  parseReleasePreferences,
  type ReleasePreferences,
} from './lib/releasePreferences';

type ForgeE2EWindow = Window & {
  __X4_E2E__?: {
    getWorkspace: () => ModWorkspace;
    setWorkspace: (workspace: ModWorkspace) => void;
    getMdCode: () => string;
    getWorkspaceHash: () => string;
    resetPerfCounters: () => E2EPerfCounters;
    getPerfCounters: () => E2EPerfCounters;
    setWorkspaceDirtyForTest: (dirty: boolean) => void;
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

function selectedWorkspaceId(): string {
  return window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || '';
}

function workspaceLocalKey(suffix: 'workspace' | 'version', workspaceId = selectedWorkspaceId()): string {
  return `x4_mod_studio_${suffix}:${workspaceId || 'unbound'}`;
}

const WORKSPACE_DRAFT_METADATA_KEY = '__x4ForgeDraft';

interface CachedWorkspaceDraftMetadata {
  schemaVersion: 1;
  baseVersion: number;
  expectedHead: string;
  expectedSnapshotHash: string;
  workspaceHash: string;
  snapshotHash: string;
}

function serializeCachedWorkspaceDraft(
  nextWorkspace: ModWorkspace,
  baseVersion: number,
  expectedHead: string,
  expectedSnapshotHash: string,
): string {
  const normalized = sanitizeWorkspace(nextWorkspace);
  const metadata: CachedWorkspaceDraftMetadata = {
    schemaVersion: 1,
    baseVersion,
    expectedHead,
    expectedSnapshotHash,
    workspaceHash: workspaceContentHash(normalized),
    snapshotHash: workspaceSnapshotHash(normalized),
  };
  return JSON.stringify({ ...normalized, [WORKSPACE_DRAFT_METADATA_KEY]: metadata });
}

function readCachedWorkspaceDraftMetadata(
  parsed: unknown,
  retainedWorkspace: ModWorkspace,
): CachedWorkspaceDraftMetadata | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = (parsed as Record<string, unknown>)[WORKSPACE_DRAFT_METADATA_KEY];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const metadata = value as Partial<CachedWorkspaceDraftMetadata>;
  if (
    metadata.schemaVersion !== 1
    || typeof metadata.baseVersion !== 'number'
    || !Number.isFinite(metadata.baseVersion)
    || metadata.baseVersion < 1
    || typeof metadata.expectedHead !== 'string'
    || typeof metadata.expectedSnapshotHash !== 'string'
    || typeof metadata.workspaceHash !== 'string'
    || typeof metadata.snapshotHash !== 'string'
    || metadata.workspaceHash !== workspaceContentHash(retainedWorkspace)
    || metadata.snapshotHash !== workspaceSnapshotHash(retainedWorkspace)
  ) return null;
  return metadata as CachedWorkspaceDraftMetadata;
}

interface ReadinessBriefPollingResponse {
  verdict?: ReadinessWatcherEvidence['verdict'];
  sinceDeploy?: ReadinessWatcherEvidence['sinceDeploy'];
  status?: { lastDeploy?: ReadinessWatcherEvidence['lastDeploy'] };
}

interface InitialWorkspaceState {
  workspace: ModWorkspace;
  version: number;
  serverHash: string;
  serverSnapshotHash: string;
  hasDraft: boolean;
}

function loadInitialWorkspaceState(bootstrapWorkspace?: WorkspacePollingResponse): InitialWorkspaceState {
  const selectedId = selectedWorkspaceId();
  const storedVersion = Number(localStorage.getItem(workspaceLocalKey('version', selectedId)) || 1);
  const bootstrapMatches = Boolean(
    selectedId
    && bootstrapWorkspace?.workspaceId === selectedId
    && bootstrapWorkspace.workspace
    && typeof bootstrapWorkspace.version === 'number',
  );

  const scopedStored = localStorage.getItem(workspaceLocalKey('workspace', selectedId));
  const stored = scopedStored || localStorage.getItem('x4_mod_studio_workspace');
  const parsed = stored ? JSON.parse(stored) : BLANK_WORKSPACE;
  const legacyAIScripts = localStorage.getItem('x4_mod_studio_aiscripts');
  const legacyWares = localStorage.getItem('x4_mod_studio_wares');
  const legacyJobs = localStorage.getItem('x4_mod_studio_jobs');
  const legacyPatches = localStorage.getItem('x4_mod_studio_xml_patches');

  // Legacy global fragments belong only to the legacy global workspace fallback.
  // Mutating an immutable-ID scoped body before its embedded draft digest is checked
  // can invalidate a valid marker and silently expose it to version-first replacement.
  if (!scopedStored) {
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
  }

  const retainedWorkspace = sanitizeWorkspace(parsed);
  const retainedHash = workspaceContentHash(retainedWorkspace);
  const retainedSnapshotHash = workspaceSnapshotHash(retainedWorkspace);
  const cachedDraft = scopedStored ? readCachedWorkspaceDraftMetadata(parsed, retainedWorkspace) : null;
  if (cachedDraft) {
    return {
      workspace: retainedWorkspace,
      version: cachedDraft.baseVersion,
      serverHash: cachedDraft.expectedHead || retainedHash,
      serverSnapshotHash: cachedDraft.expectedSnapshotHash || retainedSnapshotHash,
      hasDraft: true,
    };
  }
  const scopedDiffersFromBootstrap = Boolean(
    scopedStored
    && bootstrapMatches
    && (retainedHash !== bootstrapWorkspace!.workspaceHash || retainedSnapshotHash !== bootstrapWorkspace!.snapshotHash),
  );
  if (scopedDiffersFromBootstrap) {
    // Migration shield for pre-marker scoped drafts. We cannot distinguish an unsaved
    // draft from a stale clean cache, so fail conservatively into explicit CAS review.
    return {
      workspace: retainedWorkspace,
      version: Number.isFinite(storedVersion) && storedVersion >= 1 ? storedVersion : 1,
      serverHash: retainedHash,
      serverSnapshotHash: retainedSnapshotHash,
      hasDraft: true,
    };
  }

  // Bootstrap already completed the addressed, authenticated server read before
  // React mounts. A validated unresolved draft above takes precedence; otherwise the
  // newer server version repairs an ordinary clean/stale cache before rendering.
  if (bootstrapMatches && bootstrapWorkspace!.version! > storedVersion) {
    return {
      workspace: sanitizeWorkspace(bootstrapWorkspace!.workspace!),
      version: bootstrapWorkspace!.version!,
      serverHash: String(bootstrapWorkspace!.workspaceHash || ''),
      serverSnapshotHash: String(bootstrapWorkspace!.snapshotHash || ''),
      hasDraft: false,
    };
  }
  const retainedMatchesBootstrap = Boolean(
    bootstrapMatches
    && retainedHash === bootstrapWorkspace!.workspaceHash
    && retainedSnapshotHash === bootstrapWorkspace!.snapshotHash,
  );

  return {
    workspace: retainedWorkspace,
    version: storedVersion,
    // A divergent retained cache must carry its own stale expected pair. Giving it the
    // server's current pair would authorize a later local edit to overwrite remote-only
    // state; the retained pair instead produces the required explicit 409 conflict.
    serverHash: bootstrapMatches
      ? (retainedMatchesBootstrap ? String(bootstrapWorkspace!.workspaceHash || '') : retainedHash)
      : '',
    serverSnapshotHash: bootstrapMatches
      ? (retainedMatchesBootstrap ? String(bootstrapWorkspace!.snapshotHash || '') : retainedSnapshotHash)
      : '',
    hasDraft: false,
  };
}

export default function App({ bootstrapWorkspace }: { bootstrapWorkspace?: WorkspacePollingResponse } = {}) {
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

  const initialWorkspaceStateRef = useRef<InitialWorkspaceState | null>(null);
  if (!initialWorkspaceStateRef.current) initialWorkspaceStateRef.current = loadInitialWorkspaceState(bootstrapWorkspace);
  const initialWorkspaceState = initialWorkspaceStateRef.current;
  const [rawWorkspace, setRawWorkspace] = useState<ModWorkspace>(() => initialWorkspaceState.workspace);

  const workspaceRevisionRef = useRef(0);
  const workspacePollStartRevisionRef = useRef<{ runId: number; revision: number } | null>(null);
  const localWorkspaceDirtyRef = useRef(initialWorkspaceState.hasDraft);
  const workspaceSyncRetryTimerRef = useRef<number | null>(null);
  const workspaceSyncRetryCountRef = useRef(0);
  const localWorkspaceUpdatedAtRef = useRef(new Date().toISOString());
  const [workspaceSyncEpoch, setWorkspaceSyncEpoch] = useState(0);
  const setWorkspace = React.useCallback((value: React.SetStateAction<ModWorkspace>) => {
    if (workspaceSyncRetryTimerRef.current !== null) {
      window.clearTimeout(workspaceSyncRetryTimerRef.current);
      workspaceSyncRetryTimerRef.current = null;
    }
    workspaceSyncRetryCountRef.current = 0;
    // Mark dirty synchronously, before React schedules the state updater. This closes the
    // debounce window in which a slow poll could otherwise adopt stale server content.
    localWorkspaceDirtyRef.current = true;
    localWorkspaceUpdatedAtRef.current = new Date().toISOString();
    setRawWorkspace(prev => {
      const next = typeof value === 'function' ? (value as (p: ModWorkspace) => ModWorkspace)(prev) : value;
      workspaceRevisionRef.current += 1;
      return sanitizeWorkspace(next);
    });
  }, []);

  useEffect(() => () => {
    if (workspaceSyncRetryTimerRef.current !== null) window.clearTimeout(workspaceSyncRetryTimerRef.current);
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
  const [layoutPreferences, setLayoutPreferences] = useState<StudioLayoutPreferences>(() =>
    parseStudioLayoutPreferences(localStorage.getItem(STUDIO_LAYOUT_KEY))
  );
  const layoutPreferencesRef = useRef(layoutPreferences);
  const layoutSaveQueueRef = useRef<LatestValueWriteQueue<StudioLayoutPreferences> | null>(null);
  if (!layoutSaveQueueRef.current) {
    layoutSaveQueueRef.current = createLatestValueWriteQueue(async layout => {
      const response = await fetch('/api/studio/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
        keepalive: true,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Layout save failed (${response.status}).`);
    }, error => console.warn('Could not persist Studio layout on the Forge server.', error));
  }
  const layoutTouchedRef = useRef(false);
  const [releasePreferences, setReleasePreferences] = useState<ReleasePreferences>(() =>
    parseReleasePreferences(localStorage.getItem(RELEASE_PREFERENCES_KEY))
  );
  const releasePreferencesRef = useRef(releasePreferences);
  const releasePreferencesSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const releasePreferencesTouchedRef = useRef(false);
  const [isStudioMenuOpen, setIsStudioMenuOpen] = useState(false);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>(() => parseExperienceMode(localStorage.getItem(EXPERIENCE_MODE_KEY)));
  const [beginnerStep, setBeginnerStep] = useState<BeginnerStep>('idea');
  // B57s4: evidence deep links — ?panel=<sidebar tab> lands directly on that panel, so
  // agent walkthroughs, PROOF.md, and IDE surfaces can link straight to evidence. Unknown
  // values fall through to the default (never a crash path).
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>(() => {
    try {
      const requested = new URLSearchParams(window.location.search).get('panel');
      const legal = ['script', 'ui', 'config', 'filesystem', 'git', 'cues', 'templates', 'ai', 'diagnostics', 'playtest', 'reference'] as const;
      if (requested && (legal as readonly string[]).includes(requested)) return requested as typeof legal[number];
    } catch { /* URL parsing must never break boot */ }
    return 'script';
  });

  const persistStudioLayout = React.useCallback((layout: StudioLayoutPreferences) => {
    try { localStorage.setItem(STUDIO_LAYOUT_KEY, JSON.stringify(layout)); } catch { /* server state remains authoritative */ }
    layoutSaveQueueRef.current?.submit(layout);
  }, []);

  const updateLayoutPreferences = React.useCallback((update: React.SetStateAction<StudioLayoutPreferences>) => {
    layoutTouchedRef.current = true;
    const next = normalizeStudioLayoutPreferences(typeof update === 'function' ? update(layoutPreferencesRef.current) : update);
    layoutPreferencesRef.current = next;
    setLayoutPreferences(next);
    persistStudioLayout(next);
  }, [persistStudioLayout]);

  const persistReleasePreferences = React.useCallback((preferences: ReleasePreferences) => {
    try { localStorage.setItem(RELEASE_PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* server state remains authoritative */ }
    releasePreferencesSaveChainRef.current = releasePreferencesSaveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch('/api/studio/release-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences }),
          keepalive: true,
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Release preference save failed (${response.status}).`);
      })
      .catch(error => console.warn('Could not persist release packaging preferences on the Forge server.', error));
  }, []);

  const updateReleasePreferences = React.useCallback((update: React.SetStateAction<ReleasePreferences>) => {
    releasePreferencesTouchedRef.current = true;
    const next = normalizeReleasePreferences(typeof update === 'function' ? update(releasePreferencesRef.current) : update);
    releasePreferencesRef.current = next;
    setReleasePreferences(next);
    persistReleasePreferences(next);
  }, [persistReleasePreferences]);

  useEffect(() => {
    let cancelled = false;
    const localFallback = releasePreferences;
    (async () => {
      try {
        const response = await fetch('/api/studio/release-preferences');
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || `Release preference request failed (${response.status}).`);
        if (!cancelled && !releasePreferencesTouchedRef.current) {
          const hydrated = normalizeReleasePreferences(body?.preferences || localFallback);
          releasePreferencesRef.current = hydrated;
          setReleasePreferences(hydrated);
          if (!body?.preferences) persistReleasePreferences(hydrated);
        }
      } catch (error) {
        console.warn('Server-backed release packaging preferences are unavailable; using the local fallback.', error);
        if (!cancelled && !releasePreferencesTouchedRef.current) {
          releasePreferencesRef.current = localFallback;
          setReleasePreferences(localFallback);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [persistReleasePreferences]);

  useEffect(() => {
    let cancelled = false;
    const localFallback = layoutPreferences;
    (async () => {
      try {
        const response = await fetch('/api/studio/layout');
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || `Layout request failed (${response.status}).`);
        if (!cancelled && !layoutTouchedRef.current) {
          const hydrated = normalizeStudioLayoutPreferences(body?.layout || localFallback);
          layoutPreferencesRef.current = hydrated;
          setLayoutPreferences(hydrated);
          if (!body?.layout) persistStudioLayout(hydrated);
        }
      } catch (error) {
        console.warn('Server-backed Studio layout is unavailable; using the local preference fallback.', error);
        if (!cancelled && !layoutTouchedRef.current) {
          layoutPreferencesRef.current = localFallback;
          setLayoutPreferences(localFallback);
        }
      }
    })();
    return () => { cancelled = true; };
    // User changes made before the request returns win via layoutTouchedRef.
  }, [persistStudioLayout]);

  const [diagnosticsScope, setDiagnosticsScope] = useState<DiagnosticsScope>('scripts');

  // Diagnostics / Mod Doctor state shared by readiness and the diagnostics panel.
  const [diagnostics, setDiagnostics] = useState<PackageDiagnostic[]>([]);
  const [diagnosticSource, setDiagnosticSource] = useState<'checking' | 'project' | 'local'>('checking');
  const [validationDelta, setValidationDelta] = useState<ValidationDeltaResult | null>(null);
  const [diagnosticRevision, setDiagnosticRevision] = useState(0);
  const [readinessWatcher, setReadinessWatcher] = useState<ReadinessWatcherEvidence>({ phase: 'loading' });
  const [experienceConfirmations, setExperienceConfirmations] = useState<Record<string, ExperienceConfirmation>>(
    () => parseExperienceConfirmations(localStorage.getItem(EXPERIENCE_CONFIRMATIONS_KEY))
  );
  const [x4UiVerificationSnapshot, setX4UiVerificationSnapshot] = useState<X4UiGameVerificationCurrentSnapshot | null>(null);

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
      setWorkspaceDirtyForTest: (dirty: boolean) => { localWorkspaceDirtyRef.current = dirty; },
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
        const data = await handleApiResponse<{ diagnostics?: PackageDiagnostic[]; validation?: { scope?: string }; validationDelta?: ValidationDeltaResult }>(response, 'Full project validation failed.');
        if (data.validation?.scope !== 'full-project') {
          throw new Error('The connected Forge backend does not expose full-project live validation. Restart or update the backend.');
        }
        if (!cancelled) {
          setDiagnostics(data.diagnostics || []);
          setValidationDelta(data.validationDelta || null);
          setDiagnosticSource('project');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('Full project validation unavailable; falling back to local MD diagnostics:', err);
        if (!cancelled) {
          setDiagnostics(localReports);
          setValidationDelta(null);
          setDiagnosticSource('local');
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [workspace, mdCode, diagnosticRevision]);

  const readinessWorkspaceHash = React.useMemo(
    () => workspaceContentHash(sanitizeWorkspace(workspace)),
    [workspace]
  );
  const activeReadinessModId = React.useMemo(() => toSafeModId(workspace.name), [workspace.name]);

  // A ready verdict belongs to exactly one mod identity. Clear it before paint when
  // the selected workspace changes; retaining it until the next request would render
  // the previous mod's deploy/game evidence under the new mod.
  React.useLayoutEffect(() => {
    setReadinessWatcher({ phase: 'loading' });
  }, [activeReadinessModId]);

  // B36/R13 adapter: the shared scheduler owns cadence and cancellation; this
  // subscriber only maps the server's deterministic verdict into presentation state.
  useContinuousPolling<ReadinessBriefPollingResponse>({
    resourceKey: `debug-watcher-brief:${activeReadinessModId}`,
    contract: `GET /api/agent/debug-watcher/brief?modId=${encodeURIComponent(activeReadinessModId)}`,
    intervalMs: 4000,
    run: signal => fetchPollingJson(`/api/agent/debug-watcher/brief?modId=${encodeURIComponent(activeReadinessModId)}`, undefined, signal),
    onStart: () => setReadinessWatcher(current => current.phase === 'ready' ? current : { phase: 'loading' }),
    onResult: data => setReadinessWatcher({
      phase: 'ready',
      verdict: data?.verdict,
      sinceDeploy: data?.sinceDeploy,
      lastDeploy: data?.status?.lastDeploy || null,
    }),
    onError: error => setReadinessWatcher({ phase: 'error', error: error.message || 'Readiness evidence unavailable.' }),
  });

  const graphDiagnostics = React.useMemo(
    () => validateModWorkspace(workspace, mdCode),
    [workspace, mdCode]
  );
  const effectiveDiagnostics = diagnostics;
  const readinessStages = React.useMemo(() => buildReadinessStages({
    workspaceName: workspace.name,
    workspaceHash: readinessWorkspaceHash,
    graphDiagnostics,
    packageDiagnostics: effectiveDiagnostics,
    diagnosticSource,
    watcher: readinessWatcher,
    confirmation: experienceConfirmations[workspace.name] || null,
  }), [workspace.name, readinessWorkspaceHash, graphDiagnostics, effectiveDiagnostics, diagnosticSource, readinessWatcher, experienceConfirmations]);

  const x4UiVerification = React.useMemo<X4UiGameVerificationDecision>(() => {
    const statusFor = (id: ReadinessStageId) => readinessStages.find(stage => stage.id === id)?.status || 'pending';
    return classifyX4UiGameVerification({
      workspaceName: workspace.name,
      workspaceHash: readinessWorkspaceHash,
      deploy: readinessWatcher.lastDeploy,
      readiness: {
        graph: statusFor('graph'),
        package: statusFor('package'),
        deployed: statusFor('deployed'),
        seen: statusFor('seen'),
      },
      currentSnapshot: x4UiVerificationSnapshot,
      confirmation: experienceConfirmations[workspace.name] || null,
    });
  }, [experienceConfirmations, readinessStages, readinessWatcher.lastDeploy, readinessWorkspaceHash, workspace.name, x4UiVerificationSnapshot]);

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
      const refreshed = refreshExperienceConfirmationPreservingX4UiSnapshot({
        previousConfirmation: current[workspace.name],
        nextConfirmation: confirmation,
        deployedFingerprint: deploy.deployedFingerprint,
      });
      const next = { ...current, [workspace.name]: refreshed };
      try { localStorage.setItem(EXPERIENCE_CONFIRMATIONS_KEY, JSON.stringify(next)); } catch { /* optional evidence preference */ }
      return next;
    });
  }, [readinessWatcher.lastDeploy, readinessWorkspaceHash, workspace.name]);

  const confirmCurrentX4UiExperience = React.useCallback(() => {
    const deploy = readinessWatcher.lastDeploy;
    if (!x4UiVerification.canConfirm || x4UiVerificationSnapshot === null || !deploy?.deployedFingerprint) return;
    const snapshot = bindX4UiGameVerificationSnapshot(x4UiVerificationSnapshot, deploy.deployedFingerprint);
    if (snapshot === null) return;
    const confirmation: ExperienceConfirmation = {
      workspaceName: workspace.name,
      workspaceHash: readinessWorkspaceHash,
      deployedAt: deploy.deployedAt || '',
      confirmedAt: new Date().toISOString(),
      x4UiSnapshot: snapshot,
    };
    if (!confirmation.deployedAt) return;
    setExperienceConfirmations(current => {
      const next = { ...current, [workspace.name]: confirmation };
      try { localStorage.setItem(EXPERIENCE_CONFIRMATIONS_KEY, JSON.stringify(next)); } catch { /* optional evidence preference */ }
      return next;
    });
  }, [readinessWatcher.lastDeploy, readinessWorkspaceHash, workspace.name, x4UiVerification.canConfirm, x4UiVerificationSnapshot]);

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
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const nativeSelectionOpenKeyRef = useRef<string>('');
  const nativeApplyQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Active MD script filter (file stem) used by the canvas; null = all scripts.
  const [activeMdScript, setActiveMdScript] = useState<string | null>(null);
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
    setSelectedNodeIds(current => {
      const next = current.filter(id => workspace.nodes.some(node => node.id === id));
      return next.length === current.length ? current : next;
    });
    if (selectedWidget && !(workspace.uiWidgets || []).some(w => w.id === selectedWidget.id)) {
      setSelectedWidget(null);
    }
  }, [workspace, selectedNode, selectedWidget]);

  const [localVersion, setLocalVersion] = useState<number>(() => initialWorkspaceState.version);
  const [isAgentBridgeOpen, setIsAgentBridgeOpen] = useState<boolean>(false);
  // Auto-Apply is a workspace synchronization policy, not drawer-local presentation state.
  // App's always-on subscriber owns the one transferred full body even while the drawer is
  // closed; AgentBridge remains the visible controller for this state.
  const [agentAutoSync, setAgentAutoSyncState] = useState<boolean>(false);
  const agentAutoSyncRef = useRef(false);
  const setAgentAutoSync = React.useCallback((enabled: boolean) => {
    agentAutoSyncRef.current = enabled;
    setAgentAutoSyncState(enabled);
  }, []);
  // The Bridge pause control governs the shared workspace resource, not merely its
  // drawer-local health subscriber. Keeping this policy in App makes "External updates: Paused"
  // truthful even though App owns the always-mounted adoption subscriber.
  const [agentWorkspacePollingEnabled, setAgentWorkspacePollingEnabled] = useState<boolean>(true);
  const [pendingAgentWorkspace, setPendingAgentWorkspaceState] = useState<FullWorkspacePollingResponse | null>(null);
  const pendingAgentWorkspaceRef = useRef<FullWorkspacePollingResponse | null>(null);
  const setPendingAgentWorkspace = React.useCallback((candidate: FullWorkspacePollingResponse | null) => {
    pendingAgentWorkspaceRef.current = candidate;
    setPendingAgentWorkspaceState(candidate);
  }, []);
  const clearPendingAgentWorkspace = React.useCallback((expected?: FullWorkspacePollingResponse) => {
    const current = pendingAgentWorkspaceRef.current;
    if (expected && current && !sameWorkspacePollingPair(expected, current)) return;
    setPendingAgentWorkspace(null);
  }, [setPendingAgentWorkspace]);
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
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>(() => selectedWorkspaceId());
  useEffect(() => { notifyNativeWorkspaceAuthority(currentWorkspaceId); }, [currentWorkspaceId]);
  useEffect(() => {
    const pending = pendingAgentWorkspaceRef.current;
    if (pending && pending.workspaceId !== currentWorkspaceId) clearPendingAgentWorkspace(pending);
  }, [clearPendingAgentWorkspace, currentWorkspaceId]);
  const syncMissesRef = useRef(0);
  // B2 slice 2 (ADR-F1): the last server head this client saw — attached as expectedHead
  // on every auto-sync so a concurrent writer produces an explicit 409, never a silent
  // last-writer-wins. Learned from poll GETs and from each own POST's response.
  const lastServerHashRef = useRef<string>(initialWorkspaceState.serverHash);
  const lastServerSnapshotHashRef = useRef<string>(initialWorkspaceState.serverSnapshotHash);
  // Autosaves are serialized. A slow boot save and a quick user edit used to race with the
  // same expectedHead: the newer write could succeed, then the older response raised a false
  // 409 conflict. CAS protects against other writers; this queue protects ordering within this
  // client. Polling also defers while the queue drains so it cannot learn an intermediate head.
  const workspaceSyncChainRef = useRef<Promise<void>>(Promise.resolve());
  const queuedWorkspaceSyncsRef = useRef(0);
  // Invalidates responses from writes/conflicts that started before an explicit authority
  // switch or human conflict choice. HTTP headers keep the server write correctly scoped;
  // this epoch keeps an old response from reopening or corrupting the newly selected UI.
  const syncAuthorityEpochRef = useRef(0);
  const [syncConflict, _setSyncConflict] = useState<boolean>(false);
  const [syncConflictDetail, setSyncConflictDetail] = useState<WorkspaceConflictDetail | null>(null);
  const [syncConflictExpanded, setSyncConflictExpanded] = useState(true);
  const [syncConflictBusy, setSyncConflictBusy] = useState<'server' | 'local' | ''>('');
  const [syncConflictError, setSyncConflictError] = useState('');
  // ref mirror so the 3s poll closure sees the CURRENT conflict state (ADR-F1: while a
  // human is deciding a conflict, the poll must NOT adopt — adoption would silently pick
  // the server side and discard the local edit, which is exactly what CAS exists to stop).
  const syncConflictRef = useRef(false);
  const lastAutoAdoptedPollRef = useRef<string>('');
  // A summary-only mismatch needs one explanatory full body for this App/workspace/head.
  // Once that exact body has been observed, a manual Agent Bridge pending decision must
  // not force another 6 MB transfer on every other tick while Auto-Apply remains OFF.
  const lastFullWorkspacePollRef = useRef<{ workspaceId: string; snapshotHash: string } | null>(null);
  const failedWorkspaceCacheSnapshotRef = useRef<string>('');
  const setSyncConflict = (v: boolean) => {
    syncConflictRef.current = v;
    _setSyncConflict(v);
    if (v) setSyncConflictExpanded(true);
    else {
      setSyncConflictBusy('');
      setSyncConflictError('');
    }
  };

  // Left sidebar resizing state. Text files now use Antigravity's native tab area,
  // so Forge no longer reserves a duplicate right-hand editor column.
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(320);
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const pointerWidth = layoutPreferences.toolDock === 'right' ? window.innerWidth - e.clientX : e.clientX;
        const newWidth = Math.max(240, Math.min(Math.min(550, window.innerWidth * 0.55), pointerWidth));
        setLeftSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
    };

    if (isResizingLeft) {
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
  }, [isResizingLeft, layoutPreferences.toolDock]);

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

  useEffect(() => {
    try { localStorage.setItem(STUDIO_LAYOUT_KEY, JSON.stringify(layoutPreferences)); } catch { /* server state remains authoritative */ }
    const workspaceTabs = visibleWorkspaceViews(layoutPreferences);
    if (!workspaceTabs.includes(workspaceView)) setWorkspaceView(workspaceTabs[0]);
    const toolTabs = visibleSidebarTabs(layoutPreferences, aiEnabled);
    if (!toolTabs.includes(activeSidebarTab)) setActiveSidebarTab(toolTabs[0] ?? 'script');

  }, [layoutPreferences, workspaceView, activeSidebarTab, aiEnabled]);

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
      const response = await fetch('/api/agent/generate/preview', {
        method: 'POST', headers: getAIHeaders(), signal: controller.signal,
        body: JSON.stringify({ prompt, currentWorkspace: workspace, apply: false }),
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
      const response = await fetch("/api/agent/generate/preview", {
        method: "POST",
        headers: getAIHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          prompt: promptMsg,
          currentWorkspace: workspace,
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
  const saveCheckpoint = React.useCallback((customTarget?: ModWorkspace) => {
    const target = customTarget || workspaceRef.current;
    setPastStates(prev => [...prev.slice(-39), JSON.parse(JSON.stringify(target))]);
    setFutureStates([]);
  }, []);

  const handleActiveMdScriptChange = React.useCallback((script: string | null) => {
    setActiveMdScript(script);
    setSelectedNode(null);
    setSelectedCueIds([]);
    setSelectedNodeIds([]);
  }, []);

  // The graph remains the structured-authoring authority. Selection opens a native
  // virtual XML document; saving that document returns here for a lossless model merge.
  useEffect(() => {
    if (!selectedNodeIds.length) {
      nativeSelectionOpenKeyRef.current = '';
      return;
    }
    const document = buildNodeSelectionDocument(workspace, selectedNodeIds);
    if (!document.ok) return;
    const openKey = `${document.nodeIds.join('\0')}|${document.token}`;
    if (nativeSelectionOpenKeyRef.current === openKey) return;
    nativeSelectionOpenKeyRef.current = openKey;
    openNativeNodeSelection({
      title: document.title,
      content: document.content,
      token: document.token,
      nodeIds: document.nodeIds,
      readOnly: document.readOnly,
      warnings: document.warnings,
    });
  }, [workspace, selectedNodeIds]);

  useEffect(() => {
    const validateWorkspace = async (candidate: ModWorkspace) => {
      const compiledResponse = await fetch('/api/agent/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: candidate }),
      });
      const compiled = await compiledResponse.json() as { files?: Record<string, string>; error?: string };
      if (!compiledResponse.ok || !compiled.files) throw new Error(compiled.error || `Compile failed (HTTP ${compiledResponse.status}).`);
      const files = Object.entries(compiled.files).map(([path, content]) => ({ path, content }));
      const validationResponse = await fetch('/api/agent/project/validate/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: { id: candidate.id, name: candidate.name, files } }),
      });
      const validation = await validationResponse.json() as { flat?: Array<{ severity: string; code?: string; filePath?: string; message: string }>; error?: string };
      if (!validationResponse.ok) throw new Error(validation.error || `Validation failed (HTTP ${validationResponse.status}).`);
      return validation.flat || [];
    };

    const processNativeApply = async (request: NativeNodeApplyRequest) => {
      const baseWorkspace = workspaceRef.current;
      const applied = applyNodeSelectionDocument(baseWorkspace, request.nodeIds, request.token, request.content);
      if (isNodeSelectionFailure(applied)) {
        postNativeNodeSelectionResult({ requestId: request.requestId, ok: false, message: applied.message });
        return;
      }
      try {
        const [beforeFindings, afterFindings] = await Promise.all([validateWorkspace(baseWorkspace), validateWorkspace(applied.workspace)]);
        const signature = (finding: { code?: string; filePath?: string; message: string }) => `${finding.code || ''}|${finding.filePath || ''}|${finding.message}`;
        const priorErrors = new Set(beforeFindings.filter(finding => finding.severity === 'error').map(signature));
        const newErrors = afterFindings.filter(finding => finding.severity === 'error' && !priorErrors.has(signature(finding)));
        if (newErrors.length) {
          postNativeNodeSelectionResult({
            requestId: request.requestId,
            ok: false,
            message: `Forge refused the node edit: ${newErrors[0].message}${newErrors.length > 1 ? ` (+${newErrors.length - 1} more new errors)` : ''}`,
          });
          return;
        }
        saveCheckpoint(baseWorkspace);
        workspaceRef.current = applied.workspace;
        setWorkspace(applied.workspace);
        const refreshed = buildNodeSelectionDocument(applied.workspace, request.nodeIds);
        const warnings = afterFindings.filter(finding => finding.severity === 'warning').length;
        if (refreshed.ok) nativeSelectionOpenKeyRef.current = `${refreshed.nodeIds.join('\0')}|${refreshed.token}`;
        postNativeNodeSelectionResult({
          requestId: request.requestId,
          ok: true,
          message: `${applied.summary}${warnings ? ` ${warnings} project warning${warnings === 1 ? '' : 's'} remain visible.` : ''}`,
          ...(refreshed.ok ? { token: refreshed.token, content: refreshed.content } : {}),
          warnings,
        });
        toast(applied.summary, warnings ? 'warning' : 'success');
      } catch (error) {
        postNativeNodeSelectionResult({
          requestId: request.requestId,
          ok: false,
          message: `Forge could not validate the node edit, so nothing was applied: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    };

    const handleNativeApply = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const request = event.data as NativeNodeApplyRequest;
      if (!request || request.source !== 'x4forge-native-host' || request.type !== 'apply-node-selection') return;
      nativeApplyQueueRef.current = nativeApplyQueueRef.current
        .then(() => processNativeApply(request))
        .catch(error => {
          postNativeNodeSelectionResult({
            requestId: request.requestId,
            ok: false,
            message: `Forge could not process the node edit, so nothing was applied: ${error instanceof Error ? error.message : String(error)}`,
          });
        });
    };
    window.addEventListener('message', handleNativeApply);
    return () => window.removeEventListener('message', handleNativeApply);
  }, []);

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
        setIsStudioMenuOpen(false);
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
  const pollHashMemoRef = useRef<{ ws: unknown; hash: string; snapshotHash: string } | null>(null);
  const persistScopedWorkspaceSnapshot = React.useCallback((
    nextWorkspace: ModWorkspace,
    version: number,
    snapshotHash: string,
    workspaceId = selectedWorkspaceId(),
    draftAuthority?: { expectedHead: string; expectedSnapshotHash: string },
  ): boolean => {
    const cached = persistWorkspaceCache(
      localStorage,
      draftAuthority
        ? serializeCachedWorkspaceDraft(
            nextWorkspace,
            version,
            draftAuthority.expectedHead,
            draftAuthority.expectedSnapshotHash,
          )
        : JSON.stringify(nextWorkspace),
      workspaceLocalKey('workspace', workspaceId),
    );
    if (cached.ok === false) {
      failedWorkspaceCacheSnapshotRef.current = snapshotHash;
      if (!quotaWarnedRef.current) {
        quotaWarnedRef.current = true;
        console.warn('Workspace exceeds the scoped localStorage cache limit — the prior cache/version pair was preserved; in-memory and server authority remain current.', cached.error);
      }
      return false;
    }
    try {
      // Persist the version only after the matching full workspace succeeded. Reversing
      // this order can strand a stale workspace behind an apparently current version.
      localStorage.setItem(workspaceLocalKey('version', workspaceId), String(version));
      failedWorkspaceCacheSnapshotRef.current = '';
      return true;
    } catch (error) {
      failedWorkspaceCacheSnapshotRef.current = snapshotHash;
      if (!quotaWarnedRef.current) {
        quotaWarnedRef.current = true;
        console.warn('Could not persist the scoped workspace version; the older version remains so bootstrap can repair from server authority.', error);
      }
      return false;
    }
  }, []);
  // Sync to local storage and do debounced sync with the server database
  useEffect(() => {
    const persistLocalCache = () => {
      const serialized = localWorkspaceDirtyRef.current
        ? serializeCachedWorkspaceDraft(
            workspace,
            localVersion,
            lastServerHashRef.current,
            lastServerSnapshotHashRef.current,
          )
        : JSON.stringify(workspace);
      // The addressed body is the reload authority for unsaved edits. Do not advance its
      // base version here; a server result does that only after the body is durable. The
      // legacy global key is read-only migration input, not a duplicate ongoing cache.
      const scoped = persistWorkspaceCache(localStorage, serialized, workspaceLocalKey('workspace'));
      if (scoped.ok === false) {
        if (!quotaWarnedRef.current) {
          quotaWarnedRef.current = true;
          console.warn('Workspace exceeds the localStorage cache limit — the last-known-good local cache was preserved; the server copy remains the authority.', scoped.error);
        }
      }
    };

    const syncLocalEditsToServer = () => {
      persistLocalCache();
      // Server adoption updates React state too, but it is not a local edit and must not
      // immediately echo back as a redundant, slow POST. Only dirty local content enters
      // the serialized CAS queue.
      if (!localWorkspaceDirtyRef.current) return;
      const targetWorkspace = workspace;
      const targetRevision = workspaceRevisionRef.current;
      const targetAuthorityEpoch = syncAuthorityEpochRef.current;
      queuedWorkspaceSyncsRef.current += 1;
      workspaceSyncChainRef.current = workspaceSyncChainRef.current
        .catch(() => undefined)
        .then(async () => {
          // B2 slice 3: ADR-F1's legacy deprecation round is OVER. Until the boot GET/poll has
          // taught us the server head, we do NOT write — a blind boot save is exactly the
          // blank-client clobber that destroyed live state on 2026-07-11 (and the server now
          // rejects it anyway). The 3s poll learns the head, then the next edit syncs via CAS.
          for (let wait = 0; wait < 50 && !lastServerHashRef.current; wait += 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          if (!lastServerHashRef.current) {
            console.warn('Could not synchronize local edits because the initial server head was not learned.');
            return;
          }
          for (let wait = 0; wait < 50 && !lastServerSnapshotHashRef.current; wait += 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          if (!lastServerSnapshotHashRef.current) {
            console.warn('Could not synchronize local edits because the initial server snapshot digest was not learned.');
            return;
          }
          // A later workspace revision has its own queued save. Dropping this superseded
          // target prevents a delayed boot/default save from running after server adoption.
          if (workspaceRevisionRef.current !== targetRevision) return;
          if (syncAuthorityEpochRef.current !== targetAuthorityEpoch) return;
          const targetHash = workspaceContentHash(sanitizeWorkspace(targetWorkspace));
          const targetSnapshotHash = workspaceSnapshotHash(sanitizeWorkspace(targetWorkspace));
          let lastError: unknown;
          for (let attempt = 0; attempt < 4; attempt += 1) {
            try {
              const response = await fetch("/api/agent/workspace", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspace: targetWorkspace,
                  expectedHead: lastServerHashRef.current,
                  expectedSnapshotHash: lastServerSnapshotHashRef.current,
                })
              });
              const responseData = await response.json().catch(() => null);
              if (syncAuthorityEpochRef.current !== targetAuthorityEpoch) return;
              if (response.status === 409) {
                // A lost success response is indistinguishable from an external writer until
                // we read the new head. Equal content means this save already landed; any other
                // head remains a real human-resolved conflict.
                const latestResponse = await fetch("/api/agent/workspace");
                const latest = latestResponse.ok ? await latestResponse.json() : null;
                if (syncAuthorityEpochRef.current !== targetAuthorityEpoch) return;
                if (latest?.workspaceHash === targetHash && latest?.snapshotHash === targetSnapshotHash) {
                  lastServerHashRef.current = latest.workspaceHash;
                  lastServerSnapshotHashRef.current = latest.snapshotHash;
                  if (latest.version) {
                    setLocalVersion(latest.version);
                    const currentForCache = sanitizeWorkspace(workspaceRef.current);
                    const currentHash = workspaceContentHash(currentForCache);
                    const currentSnapshotHash = workspaceSnapshotHash(currentForCache);
                    const currentMatchesTarget = currentHash === targetHash && currentSnapshotHash === targetSnapshotHash;
                    persistScopedWorkspaceSnapshot(
                      currentForCache,
                      Number(latest.version),
                      currentSnapshotHash,
                      selectedWorkspaceId(),
                      currentMatchesTarget ? undefined : {
                        expectedHead: String(latest.workspaceHash),
                        expectedSnapshotHash: String(latest.snapshotHash),
                      },
                    );
                  }
                  const current = sanitizeWorkspace(workspaceRef.current);
                  if (workspaceContentHash(current) === targetHash && workspaceSnapshotHash(current) === targetSnapshotHash) {
                    localWorkspaceDirtyRef.current = false;
                  }
                  setSyncConflict(false);
                  workspaceSyncRetryCountRef.current = 0;
                  return;
                }
                const conflict = responseData?.conflict as WorkspaceConflictDetail | undefined;
                setSyncConflictDetail(conflict ? {
                  ...conflict,
                  server: {
                    ...conflict.server,
                    ...(latest?.workspaceHash ? { head: latest.workspaceHash } : {}),
                    ...(latest?.snapshotHash ? { snapshotHash: latest.snapshotHash } : {}),
                    ...(latest?.version ? { version: latest.version } : {}),
                    ...(latest?.lastUpdated ? { savedAt: latest.lastUpdated } : {}),
                    ...(latest?.origin ? { origin: latest.origin } : {}),
                  },
                  local: { ...conflict.local, updatedAt: localWorkspaceUpdatedAtRef.current },
                } : {
                  detectedAt: new Date().toISOString(),
                  server: {
                    head: latest?.workspaceHash || responseData?.currentHead || 'unknown',
                    snapshotHash: latest?.snapshotHash || responseData?.currentSnapshotHash,
                    version: latest?.version || responseData?.currentVersion,
                    savedAt: latest?.lastUpdated,
                    origin: latest?.origin,
                    name: latest?.workspace?.name,
                  },
                  local: { head: targetHash, snapshotHash: targetSnapshotHash, name: targetWorkspace.name, updatedAt: localWorkspaceUpdatedAtRef.current },
                  previewUnavailable: 'The server proved divergent content heads but could not provide a file-level preview.',
                });
                setSyncConflict(true);
                workspaceSyncRetryCountRef.current = 0;
                return;
              }
              if (!response.ok) throw new Error(`Workspace sync failed (${response.status}).`);
              const data = responseData;
              const returnedVersion = Number(data?.version);
              if (
                data?.success !== true
                || !Number.isFinite(returnedVersion)
                || returnedVersion < 1
                || data?.workspaceHash !== targetHash
                || data?.snapshotHash !== targetSnapshotHash
              ) {
                throw new Error('Workspace sync returned an incomplete or mismatched authority receipt.');
              }
              setLocalVersion(returnedVersion);
              const currentForCache = sanitizeWorkspace(workspaceRef.current);
              const currentHash = workspaceContentHash(currentForCache);
              const currentSnapshotHash = workspaceSnapshotHash(currentForCache);
              const currentMatchesTarget = currentHash === targetHash && currentSnapshotHash === targetSnapshotHash;
              persistScopedWorkspaceSnapshot(
                currentForCache,
                returnedVersion,
                currentSnapshotHash,
                selectedWorkspaceId(),
                currentMatchesTarget ? undefined : {
                  expectedHead: String(data.workspaceHash),
                  expectedSnapshotHash: String(data.snapshotHash),
                },
              );
              lastServerHashRef.current = data.workspaceHash;
              lastServerSnapshotHashRef.current = data.snapshotHash;
              const current = sanitizeWorkspace(workspaceRef.current);
              if (workspaceContentHash(current) === targetHash && workspaceSnapshotHash(current) === targetSnapshotHash) {
                localWorkspaceDirtyRef.current = false;
              }
              setSyncConflict(false);
              workspaceSyncRetryCountRef.current = 0;
              return;
            } catch (error) {
              lastError = error;
              if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
            }
          }
          console.warn("Could not synchronize local edits to server workspace space after retries.", lastError);
          const current = sanitizeWorkspace(workspaceRef.current);
          const stillOwnsTarget = workspaceContentHash(current) === targetHash
            && workspaceSnapshotHash(current) === targetSnapshotHash;
          if (
            stillOwnsTarget
            && localWorkspaceDirtyRef.current
            && syncAuthorityEpochRef.current === targetAuthorityEpoch
            && workspaceSyncRetryTimerRef.current === null
          ) {
            const retryNumber = workspaceSyncRetryCountRef.current;
            const delayMs = Math.min(24_000, 3_000 * (2 ** Math.min(retryNumber, 3)));
            workspaceSyncRetryCountRef.current += 1;
            workspaceSyncRetryTimerRef.current = window.setTimeout(() => {
              workspaceSyncRetryTimerRef.current = null;
              if (
                localWorkspaceDirtyRef.current
                && syncAuthorityEpochRef.current === targetAuthorityEpoch
                && workspaceContentHash(sanitizeWorkspace(workspaceRef.current)) === targetHash
                && workspaceSnapshotHash(sanitizeWorkspace(workspaceRef.current)) === targetSnapshotHash
              ) {
                setWorkspaceSyncEpoch(epoch => epoch + 1);
              }
            }, delayMs);
          }
        })
        .finally(() => { queuedWorkspaceSyncsRef.current = Math.max(0, queuedWorkspaceSyncsRef.current - 1); });
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
  }, [localVersion, persistScopedWorkspaceSnapshot, workspace, workspaceSyncEpoch]);

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
        if (deployData.workspace && typeof deployData.workspace === 'object') {
          const convergenceRes = await fetch('/api/agent/workspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace: deployData.workspace,
              expectedHead: lastServerHashRef.current,
              expectedSnapshotHash: lastServerSnapshotHashRef.current,
            }),
          });
          const convergence = await convergenceRes.json().catch(() => ({}));
          if (!convergenceRes.ok || !convergence?.success) {
            setCompileStatus('error');
            setCompileMessage(`Deployment succeeded, but this tab could not adopt the refreshed source state (${convergence?.error || convergenceRes.status}). Reload the server copy before deploying again.`);
            return;
          }
          setWorkspace(deployData.workspace);
          localWorkspaceDirtyRef.current = false;
          if (convergence.version) {
            setLocalVersion(convergence.version);
            persistScopedWorkspaceSnapshot(
              sanitizeWorkspace(deployData.workspace),
              Number(convergence.version),
              String(convergence.snapshotHash),
            );
          }
          if (convergence.workspaceHash) lastServerHashRef.current = String(convergence.workspaceHash);
          if (convergence.snapshotHash) lastServerSnapshotHashRef.current = String(convergence.snapshotHash);
        }
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

  const autoApplyPolledWorkspace = React.useCallback((
    candidate: FullWorkspacePollingResponse,
    runId: number,
  ): WorkspaceAutoAdoptResult => {
    if (candidate.workspaceId !== selectedWorkspaceId()) {
      return { status: 'blocked', reason: 'authority' };
    }
    const normalized = sanitizeWorkspace(candidate.workspace);
    if (workspaceContentHash(normalized) !== candidate.workspaceHash || workspaceSnapshotHash(normalized) !== candidate.snapshotHash) {
      return { status: 'blocked', reason: 'invalid-pair' };
    }
    const adoptionKey = [runId, candidate.workspaceId, candidate.version, candidate.workspaceHash, candidate.snapshotHash].join(':');
    if (lastAutoAdoptedPollRef.current === adoptionKey) return { status: 'already-applied' };
    // A visible unresolved conflict is the strongest automatic-adoption stop. Keeping it
    // first also makes that guard independently observable even though conflict state often
    // coexists with a dirty local canvas.
    if (syncConflictRef.current) return { status: 'blocked', reason: 'conflict' };
    if (localWorkspaceDirtyRef.current) return { status: 'blocked', reason: 'dirty' };
    if (queuedWorkspaceSyncsRef.current > 0) return { status: 'blocked', reason: 'queued' };
    const start = workspacePollStartRevisionRef.current;
    if (!start || start.runId !== runId || start.revision !== workspaceRevisionRef.current) {
      return { status: 'blocked', reason: 'stale-run' };
    }
    const storedVersion = Number(localStorage.getItem(workspaceLocalKey('version')) || String(localVersion));
    if (candidate.version <= storedVersion) {
      const current = sanitizeWorkspace(workspaceRef.current);
      if (workspaceContentHash(current) === candidate.workspaceHash && workspaceSnapshotHash(current) === candidate.snapshotHash) {
        lastAutoAdoptedPollRef.current = adoptionKey;
        return { status: 'already-applied' };
      }
      return { status: 'blocked', reason: 'stale-version' };
    }

    // Claim the exact shared run before scheduling React state so any duplicate callback
    // for the same server result cannot enqueue a second adoption.
    lastAutoAdoptedPollRef.current = adoptionKey;
    saveCheckpoint(workspaceRef.current);
    workspaceRef.current = normalized;
    workspaceRevisionRef.current += 1;
    setRawWorkspace(normalized);
    localWorkspaceDirtyRef.current = false;
    lastServerHashRef.current = candidate.workspaceHash;
    lastServerSnapshotHashRef.current = candidate.snapshotHash;
    syncMissesRef.current = 0;
    setSyncDiverged(false);
    setLocalVersion(candidate.version);
    persistScopedWorkspaceSnapshot(normalized, candidate.version, candidate.snapshotHash);
    return { status: 'applied' };
  }, [localVersion, persistScopedWorkspaceSnapshot, saveCheckpoint]);

  // R13: App and AgentBridge share this exact addressed read. App still owns the
  // local dirty/revision/CAS adoption policy; run-start metadata preserves the
  // revision boundary even when another subscriber supplies the shared fetcher.
  useContinuousPolling<WorkspacePollingResponse>({
    enabled: agentWorkspacePollingEnabled,
    resourceKey: `workspace:${currentWorkspaceId || 'unbound'}`,
    contract: WORKSPACE_POLLING_CONTRACT,
    intervalMs: 3000,
    onStart: meta => { workspacePollStartRevisionRef.current = { runId: meta.runId, revision: workspaceRevisionRef.current }; },
    run: signal => pollWorkspaceSnapshot(currentWorkspaceId, signal),
    onResult: (data, meta) => {
      const started = workspacePollStartRevisionRef.current;
      const requestWorkspaceRevision = started?.runId === meta.runId ? started.revision : -1;
      if (data.workspaceId !== selectedWorkspaceId()) return;
      if (data.version && data.workspaceHash && data.snapshotHash) {
          if (data.workspace) {
            lastFullWorkspacePollRef.current = { workspaceId: data.workspaceId, snapshotHash: data.snapshotHash };
            const current = sanitizeWorkspace(workspaceRef.current);
            const differsFromCanvas = workspaceContentHash(current) !== data.workspaceHash
              || workspaceSnapshotHash(current) !== data.snapshotHash;
            if (differsFromCanvas) {
              const candidate = data as FullWorkspacePollingResponse;
              if (agentAutoSyncRef.current) {
                const adoption = autoApplyPolledWorkspace(candidate, meta.runId);
                if (adoption.status === 'applied' || adoption.status === 'already-applied') {
                  const retained = pendingAgentWorkspaceRef.current;
                  if (retained?.workspaceId === candidate.workspaceId) setPendingAgentWorkspace(null);
                } else {
                  setPendingAgentWorkspace(candidate);
                }
              } else {
                setPendingAgentWorkspace(candidate);
              }
            } else {
              const retained = pendingAgentWorkspaceRef.current;
              // A validated server body equal to the canvas supersedes every older pending
              // candidate for this same immutable workspace, regardless of the old pair.
              if (retained?.workspaceId === data.workspaceId) clearPendingAgentWorkspace(retained);
            }
          } else {
            // Version is sequencing metadata rather than snapshot identity. When the server
            // commits the same paired hashes again, keep the one retained full body and move
            // its pending version forward without another multi-megabyte transfer.
            const retained = pendingAgentWorkspaceRef.current;
            if (retained && sameWorkspacePollingPair(retained, data)) {
              const candidate = data.version > retained.version ? { ...retained, version: data.version } : retained;
              if (agentAutoSyncRef.current) {
                const adoption = autoApplyPolledWorkspace(candidate, meta.runId);
                if (adoption.status === 'applied' || adoption.status === 'already-applied') {
                  clearPendingAgentWorkspace(candidate);
                } else if (candidate !== retained) {
                  setPendingAgentWorkspace(candidate);
                }
              } else if (candidate !== retained) {
                setPendingAgentWorkspace(candidate);
              }
            }
          }
          // Local state becomes dirty at the moment setWorkspace is called, not 300ms later
          // when autosave starts. While dirty, a poll cannot adopt stale server content or
          // advance a known CAS head past the unsaved edit. The first boot read may still
          // teach a head to a client that has not learned one yet.
          if (localWorkspaceDirtyRef.current) {
            const retained = sanitizeWorkspace(workspaceRef.current);
            const pollNamesRetainedCanvas = workspaceContentHash(retained) === data.workspaceHash
              && workspaceSnapshotHash(retained) === data.snapshotHash;
            if (!pollNamesRetainedCanvas) {
              // Never turn a mismatching remote pair into write authority for dirty local
              // content. A bootstrap-derived retained pair can now produce an explicit 409;
              // an unbound client safely waits rather than authorizing a clobber.
              syncMissesRef.current += 1;
              if (syncMissesRef.current >= 3) setSyncDiverged(true);
              return;
            }
            let learnedAuthority = false;
            if (!lastServerHashRef.current && typeof data.workspaceHash === 'string' && data.workspaceHash) {
              lastServerHashRef.current = data.workspaceHash;
              learnedAuthority = true;
            }
            if (!lastServerSnapshotHashRef.current && typeof data.snapshotHash === 'string' && data.snapshotHash) {
              lastServerSnapshotHashRef.current = data.snapshotHash;
              learnedAuthority = true;
            }
            if (learnedAuthority) {
              // The original debounced save may already have exhausted its bounded wait.
              // Wake the unchanged-but-dirty workspace so learning the first paired heads can
              // never strand a local edit until the user types again.
              setWorkspaceSyncEpoch(epoch => epoch + 1);
            }
            return;
          }
          // A queued write owns the next server head. A concurrent poll can only observe an
          // intermediate state and must not overwrite the head or adopt it into the canvas.
          if (queuedWorkspaceSyncsRef.current > 0) return;
          // A server read that began before a local edit is stale as an adoption source. It
          // may still teach the client the current CAS head, so the queued local edit can be
          // written safely, but it must never replace the newer canvas with its old payload.
          if (workspaceRevisionRef.current !== requestWorkspaceRevision) {
            let learnedAuthority = false;
            if (!lastServerHashRef.current && typeof data.workspaceHash === 'string' && data.workspaceHash) {
              lastServerHashRef.current = data.workspaceHash;
              learnedAuthority = true;
            }
            if (!lastServerSnapshotHashRef.current && typeof data.snapshotHash === 'string' && data.snapshotHash) {
              lastServerSnapshotHashRef.current = data.snapshotHash;
              learnedAuthority = true;
            }
            if (learnedAuthority && localWorkspaceDirtyRef.current) setWorkspaceSyncEpoch(epoch => epoch + 1);
            return;
          }
          const storedVer = Number(localStorage.getItem(workspaceLocalKey('version')) || String(localVersion));
          if (syncConflictRef.current) return; // human is deciding — hold ALL automatic adoption
          // B1 sync-trust: the version gate said "don't adopt" — verify CONTENT actually
          // agrees. A transient mismatch (<~6s) is just the edit→sync debounce; a
          // persistent one is real divergence (the stale-canvas incident class) and gets
          // a visible badge instead of silence.
          if (typeof data.workspaceHash === 'string' && data.workspaceHash.length > 0) {
            const memo = pollHashMemoRef.current;
            let localHash: string;
            let localSnapshotHash: string;
            if (memo && memo.ws === workspaceRef.current) {
              localHash = memo.hash;
              localSnapshotHash = memo.snapshotHash;
            } else {
              const current = sanitizeWorkspace(workspaceRef.current);
              localHash = workspaceContentHash(current);
              localSnapshotHash = workspaceSnapshotHash(current);
              pollHashMemoRef.current = { ws: workspaceRef.current, hash: localHash, snapshotHash: localSnapshotHash };
            }
            if (localHash !== data.workspaceHash || localSnapshotHash !== data.snapshotHash) {
              // A head-only response cannot explain a mismatch until this App has observed
              // the exact full body once. After that, Agent Bridge may deliberately hold it
              // pending with Auto-Apply OFF; repeated invalidation would re-transfer the same
              // multi-megabyte snapshot forever.
              const observedFull = lastFullWorkspacePollRef.current;
              if (!data.workspace && (
                observedFull?.workspaceId !== data.workspaceId
                || observedFull.snapshotHash !== data.snapshotHash
              )) {
                invalidateWorkspacePollingHead(data.workspaceId, data.snapshotHash);
              }
              syncMissesRef.current += 1;
              if (syncMissesRef.current >= 3) setSyncDiverged(true);
            } else {
              if (!data.workspace && data.version > storedVer) {
                setLocalVersion(data.version);
                if (failedWorkspaceCacheSnapshotRef.current !== data.snapshotHash) {
                  persistScopedWorkspaceSnapshot(sanitizeWorkspace(workspaceRef.current), data.version, data.snapshotHash);
                }
              }
              // Learn mutation authority only when it names the exact canvas we retain.
              // A different full snapshot held for explicit Agent Bridge review must keep
              // the prior pair so a stale local edit produces 409 instead of overwriting it.
              lastServerHashRef.current = data.workspaceHash;
              lastServerSnapshotHashRef.current = data.snapshotHash;
              syncMissesRef.current = 0;
              setSyncDiverged(false);
            }
          }
      }
    },
    // Background connection failures remain non-destructive and visually quiet;
    // scheduler backoff prevents a failure storm.
    onError: () => undefined,
  });

  // B1: adopt the server workspace explicitly (badge click) — the user's choice, never silent.
  const adoptServerWorkspace = async (expected?: FullWorkspacePollingResponse): Promise<boolean> => {
    syncAuthorityEpochRef.current += 1;
    setSyncConflictBusy('server');
    setSyncConflictError('');
    try {
      const response = await fetch("/api/agent/workspace");
      const data = await response.json();
      if (!response.ok || !data?.workspace) throw new Error(data?.error || `Server workspace read failed (${response.status}).`);
      if (data?.workspace) {
        if (typeof data.version !== 'number' || !Number.isFinite(data.version) || data.version < 1) {
          throw new Error('Server workspace response did not include a valid numeric version.');
        }
        const returnedVersion = data.version;
        const normalized = sanitizeWorkspace(data.workspace);
        const actualHash = workspaceContentHash(normalized);
        const actualSnapshotHash = workspaceSnapshotHash(normalized);
        if (data.workspaceId !== selectedWorkspaceId() || actualHash !== data.workspaceHash || actualSnapshotHash !== data.snapshotHash) {
          throw new Error('Server workspace response failed immutable authority or paired-hash validation.');
        }
        if (expected && !sameWorkspacePollingPair(expected, data)) {
          throw new Error('The pending server workspace changed again. Review the refreshed pending change before applying it.');
        }
        saveCheckpoint(workspaceRef.current);
        workspaceRef.current = normalized;
        workspaceRevisionRef.current += 1;
        setRawWorkspace(normalized);
        localWorkspaceDirtyRef.current = false;
        setLocalVersion(returnedVersion);
        persistScopedWorkspaceSnapshot(normalized, returnedVersion, String(data.snapshotHash));
        if (typeof data.workspaceHash === 'string' && data.workspaceHash) lastServerHashRef.current = data.workspaceHash;
        if (typeof data.snapshotHash === 'string' && data.snapshotHash) lastServerSnapshotHashRef.current = data.snapshotHash;
        syncMissesRef.current = 0;
        setSyncDiverged(false);
        setSyncConflict(false);
        const retainedPending = pendingAgentWorkspaceRef.current;
        if (retainedPending && sameWorkspacePollingPair(retainedPending, data)) {
          clearPendingAgentWorkspace(retainedPending);
        }
        toast(`Used server copy "${data.workspace.name || 'Untitled'}". Undo restores your previous canvas.`, 'success');
        return true;
      }
    } catch (error) {
      const message = `Server copy was not applied: ${error instanceof Error ? error.message : String(error)}`;
      setSyncConflictError(message);
      toast(message, 'error');
      setSyncConflictBusy('');
      // Entry invalidates any queued save so a successful server adoption wins cleanly.
      // If validation/read fails, the user's dirty canvas still owns a required write;
      // re-arm it under the new epoch instead of stranding it indefinitely.
      if (localWorkspaceDirtyRef.current) setWorkspaceSyncEpoch(epoch => epoch + 1);
      return false;
    }
    return false;
  };

  // ADR-F5 workspace switcher. Each tab owns its selected immutable ID; duplicate names are safe.
  const [parkedList, setParkedList] = useState<Array<{ workspaceId: string; name: string; nodeCount: number; contentSummary?: string }>>([]);
  const refreshParkedList = async () => {
    try {
      const data = await fetch('/api/agent/workspace/parked').then(r => r.json());
      if (Array.isArray(data?.parked)) setParkedList(data.parked);
    } catch { /* switcher just shows presets when the list is unavailable */ }
  };
  // Ready before interaction: on boot, and whenever a switch/load may have parked
  // something (workspace name change). onFocus refresh stays as a liveness bonus.
  useEffect(() => { refreshParkedList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workspace.name]);
  const canLeaveCurrentWorkspace = () => {
    if (!localWorkspaceDirtyRef.current && queuedWorkspaceSyncsRef.current === 0 && !syncConflictRef.current) return true;
    toast('This workspace has unsaved or unresolved changes. Save or resolve them before switching workspaces; nothing was changed.', 'warning');
    return false;
  };
  const restoreParkedWorkspace = async (targetWorkspaceId: string) => {
    if (!canLeaveCurrentWorkspace()) return;
    try {
      const response = await fetch('/api/agent/workspace/restore-parked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetWorkspaceId }),
      });
      const data = await response.json();
      if (data?.success && data.workspace) {
        const targetId = String(data.workspaceId || '');
        const returnedVersion = data.version;
        const serverWorkspace = sanitizeWorkspace(data.workspace);
        const serverHash = workspaceContentHash(serverWorkspace);
        const serverSnapshotHash = workspaceSnapshotHash(serverWorkspace);
        if (
          targetId !== targetWorkspaceId
          || typeof returnedVersion !== 'number'
          || !Number.isFinite(returnedVersion)
          || returnedVersion < 1
          || data.workspaceHash !== serverHash
          || data.snapshotHash !== serverSnapshotHash
        ) throw new Error('Restored workspace response failed immutable authority, version or paired-hash validation.');

        let retainedTarget: ModWorkspace | null = null;
        let retainedDraft: CachedWorkspaceDraftMetadata | null = null;
        const scopedTarget = localStorage.getItem(workspaceLocalKey('workspace', targetId));
        if (scopedTarget) {
          try {
            const parsedTarget = JSON.parse(scopedTarget);
            const candidate = sanitizeWorkspace(parsedTarget);
            const candidateHash = workspaceContentHash(candidate);
            const candidateSnapshotHash = workspaceSnapshotHash(candidate);
            retainedDraft = readCachedWorkspaceDraftMetadata(parsedTarget, candidate);
            if (retainedDraft || candidateHash !== serverHash || candidateSnapshotHash !== serverSnapshotHash) {
              retainedTarget = candidate;
            }
          } catch { /* malformed target cache falls back to the validated server response */ }
        }

        syncAuthorityEpochRef.current += 1;
        if (workspaceSyncRetryTimerRef.current !== null) {
          window.clearTimeout(workspaceSyncRetryTimerRef.current);
          workspaceSyncRetryTimerRef.current = null;
        }
        workspaceSyncRetryCountRef.current = 0;
        setPastStates([]);
        setFutureStates([]);
        window.__X4_WORKSPACE_CONTEXT__?.selectWorkspace(targetId);
        setCurrentWorkspaceId(targetId);
        if (retainedTarget) {
          const retainedHash = workspaceContentHash(retainedTarget);
          const retainedSnapshotHash = workspaceSnapshotHash(retainedTarget);
          workspaceRef.current = retainedTarget;
          workspaceRevisionRef.current += 1;
          setRawWorkspace(retainedTarget);
          localWorkspaceDirtyRef.current = true;
          setLocalVersion(retainedDraft?.baseVersion
            ?? Number(localStorage.getItem(workspaceLocalKey('version', targetId)) || 1));
          lastServerHashRef.current = retainedDraft?.expectedHead || retainedHash;
          lastServerSnapshotHashRef.current = retainedDraft?.expectedSnapshotHash || retainedSnapshotHash;
          setPendingAgentWorkspace({
            workspaceId: targetId,
            workspace: serverWorkspace,
            version: returnedVersion,
            workspaceHash: serverHash,
            snapshotHash: serverSnapshotHash,
          });
          syncMissesRef.current = 3;
          setSyncDiverged(true);
          setSyncConflict(false);
          toast(`Restored "${serverWorkspace.name}" with its local draft retained for explicit server reconciliation.`, 'warning');
        } else {
          workspaceRef.current = serverWorkspace;
          workspaceRevisionRef.current += 1;
          setRawWorkspace(serverWorkspace);
          localWorkspaceDirtyRef.current = false;
          setLocalVersion(returnedVersion);
          persistScopedWorkspaceSnapshot(
            serverWorkspace,
            returnedVersion,
            serverSnapshotHash,
            targetId,
          );
          lastServerHashRef.current = serverHash;
          lastServerSnapshotHashRef.current = serverSnapshotHash;
          clearPendingAgentWorkspace();
          syncMissesRef.current = 0;
          setSyncDiverged(false);
          setSyncConflict(false);
        }
        refreshParkedList();
      }
    } catch (error) {
      toast(`Workspace was not switched: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const createWorkspace = async () => {
    if (!canLeaveCurrentWorkspace()) return;
    const name = await promptDialog('Name the new independent workspace.', 'Untitled_Workspace', { okLabel: 'Create workspace' });
    if (!name?.trim()) return;
    try {
      const clientId = window.__X4_WORKSPACE_CONTEXT__?.clientId || '';
      const response = await fetch('/api/agent/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name: name.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data?.workspaceId || !data?.workspace) throw new Error(data?.error || `Workspace creation failed (${response.status}).`);
      syncAuthorityEpochRef.current += 1;
      setPastStates([]);
      setFutureStates([]);
      window.__X4_WORKSPACE_CONTEXT__?.selectWorkspace(String(data.workspaceId));
      setCurrentWorkspaceId(String(data.workspaceId));
      setWorkspace(data.workspace);
      localWorkspaceDirtyRef.current = false;
      setLocalVersion(Number(data.version || Date.now()));
      lastServerHashRef.current = String(data.workspaceHash || '');
      lastServerSnapshotHashRef.current = String(data.snapshotHash || '');
      persistScopedWorkspaceSnapshot(
        sanitizeWorkspace(data.workspace),
        Number(data.version || Date.now()),
        String(data.snapshotHash),
        String(data.workspaceId),
      );
      setSyncConflict(false);
      setSyncDiverged(false);
      await refreshParkedList();
      toast(`Created independent workspace "${data.workspace.name}".`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  // B2 slice 2: "Keep mine" — the explicit force valve (ADR-F1: last-writer-wins is
  // chosen by a human, never by silence). B2s3: the choice is now spelled force:true —
  // the server rejects blind no-head writes outright.
  const forceKeepMine = async () => {
    syncAuthorityEpochRef.current += 1;
    setSyncConflictBusy('local');
    setSyncConflictError('');
    try {
      const response = await fetch("/api/agent/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // B2s3: the server's legacy gate requires overwrites to be EXPLICIT now.
        body: JSON.stringify({ workspace: workspaceRef.current, force: true })
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || `Forced overwrite failed (${response.status}).`);
      if (data?.success) {
        if (data.version) {
          setLocalVersion(data.version);
          persistScopedWorkspaceSnapshot(
            sanitizeWorkspace(workspaceRef.current),
            Number(data.version),
            String(data.snapshotHash),
          );
        }
        if (typeof data.workspaceHash === 'string' && data.workspaceHash) lastServerHashRef.current = data.workspaceHash;
        if (typeof data.snapshotHash === 'string' && data.snapshotHash) lastServerSnapshotHashRef.current = data.snapshotHash;
        setSyncConflict(false);
        setSyncDiverged(false);
        syncMissesRef.current = 0;
        localWorkspaceDirtyRef.current = false;
        toast(data?.recovery?.id
          ? `Server now uses your canvas. Recovery ${String(data.recovery.id).slice(0, 18)}… is available in History.`
          : 'Server now uses your canvas.', 'success');
      }
    } catch (error) {
      setSyncConflictError(`Server was not overwritten: ${error instanceof Error ? error.message : String(error)}`);
      setSyncConflictBusy('');
    }
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

  const requestClearWorkspace = async () => {
    const ok = await confirmDialog(
      `Reset "${workspace.name || 'Current Workspace'}" to a blank project? A checkpoint is created first.`,
      { okLabel: 'Reset workspace', cancelLabel: 'Keep workspace' },
    );
    if (ok) handleClearWorkspace();
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
    <div className="w-full h-screen max-w-full overflow-hidden flex flex-col bg-[#0F1115] text-slate-300 font-sans">
      <FpsMeter />
      <HealthCardOverlay
        toolDock={layoutPreferences.toolDock}
        workspaceDock={layoutPreferences.workspaceDock}
      />
      <DialogHost />
      {/* Upper Technical Header */}
      <header data-testid="studio-header" className="h-11 min-w-0 max-w-full border-b border-white/10 bg-[#161920] px-2 flex items-center gap-2 shrink-0 font-mono">
        
        {/* Workspace Brand and Logo */}
        <div className="flex items-center gap-2 min-w-0 shrink">
          <div className="flex items-center gap-2 min-w-0">
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
            <span className="font-semibold text-white tracking-tight shrink-0 select-none text-[11px] sm:text-sm">
              X4 FORGE <span className="text-cyan-400/90 font-normal" title={__APP_BUILD__}>v{__APP_VERSION__}</span>
            </span>
            {workspace.sourceFolder && (
              <span
                className="hidden min-[1900px]:inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-slate-300 max-w-[360px] shrink min-w-0"
                title={'Open project folder: ' + workspace.sourceFolder}
              >
                <span className="text-cyan-400/80 font-medium shrink-0">Open:</span>
                <span className="truncate font-mono">{workspace.sourceFolder}</span>
              </span>
            )}
          </div>

          {/* Full cross-domain search belongs to Expert; Beginner keeps one task path. */}
          {experienceMode === 'expert' && (
            <div className="hidden lg:block min-w-0">
            <GlobalSearch
              workspace={workspace}
              workspaceView={workspaceView}
              setWorkspaceView={setWorkspaceView}
              setActiveSidebarTab={setActiveSidebarTab}
              setSelectedNode={setSelectedNode}
              setSelectedWidget={setSelectedWidget}
            />
            </div>
          )}
        </div>

        {/* Workspace navigation is rendered by WorkspaceNavigationBar below the compact header. */}
        {/* Preset & Project management utilities */}
        <div className="ml-auto flex items-center gap-1 min-w-0 shrink-0">
          {/* History Undo/Redo Group */}
          <div className="flex items-center gap-1 bg-black/45 border border-white/10 p-1 rounded-md">
            <button
              onClick={handleUndo}
              data-global-action="undo"
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
              data-global-action="redo"
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
              data-global-action="shortcuts"
              data-testid="shortcuts-open-btn"
              className="p-1 px-2 rounded font-mono text-[11px] text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer transition-all"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </div>

          <div data-global-action="workspace-switcher" className="flex items-center gap-1.5 bg-black/35 rounded border border-white/10 p-1 min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider px-1 hidden min-[2150px]:inline">Workspace:</span>
            <select
              value="__current"
              data-testid="workspace-switcher"
              onFocus={refreshParkedList}
              onChange={async (e) => {
                const pick = e.target.value;
                if (pick === '__current') return;
                if (pick === '__new') { await createWorkspace(); return; }
                if (pick.startsWith('workspace:')) {
                  const targetWorkspaceId = pick.slice('workspace:'.length);
                  const target = parkedList.find(row => row.workspaceId === targetWorkspaceId);
                  if (!canLeaveCurrentWorkspace()) return;
                  const ok = await confirmDialog(
                    `Switch this tab to "${target?.name || targetWorkspaceId}"? The current workspace remains saved under ${currentWorkspaceId}.`,
                    { okLabel: 'Switch workspace', cancelLabel: 'Stay here' },
                  );
                  if (ok) await restoreParkedWorkspace(targetWorkspaceId);
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
              <option value="__current">{workspace.name || 'Current Workspace'} · {currentWorkspaceId.slice(-6)}</option>
              <option value="__new">＋ New independent workspace…</option>
              {parkedList.filter(p => p.workspaceId !== currentWorkspaceId).length > 0 && (
                <optgroup label="Other workspaces">
                  {parkedList.filter(p => p.workspaceId !== currentWorkspaceId).map(p => (
                    <option key={p.workspaceId} value={`workspace:${p.workspaceId}`}>{p.name} · {p.workspaceId.slice(-6)} ({p.contentSummary ?? `${p.nodeCount} nodes`})</option>
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

          {experienceMode === 'expert' && <div className="hidden min-[1200px]:block" data-global-action="native-project-files"><NativeProjectFiles workspace={workspace} /></div>}

          {/* B29: the conflict card / diverged badge moved OUT of the header into the fixed
              sync-status layer below — a header slot gets clipped on narrow windows, and the
              conflict UI must be visible exactly when a conflict blocks sync. */}
          {experienceMode === 'expert' && (
          <button
            onClick={() => setIsSyncModalOpen(true)}
            data-global-action="sync-mod"
            className="flex px-2 py-1 border border-cyan-500/30 hover:border-cyan-500/80 bg-cyan-500/10 text-cyan-400 rounded font-mono text-[11px] hover:bg-cyan-500/20 transition-all items-center gap-1.5 cursor-pointer"
            title="Load existing mods or push updates to GitHub"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">SYNC MOD</span>
          </button>
          )}

          {experienceMode === 'expert' && aiEnabled && (
          <button
            onClick={() => setIsAIConfigOpen(true)}
            data-global-action="ai-settings"
            className="hidden min-[1700px]:flex px-2 py-1 border border-amber-500/25 hover:border-[#df9825] bg-amber-500/5 text-amber-400 rounded font-mono text-[11px] hover:bg-amber-500/15 transition-all flex-col justify-center items-start text-left cursor-pointer select-none leading-tight gap-0.5"
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
            data-global-action="agent-api"
            className={`flex px-2 py-1 border rounded font-mono text-[11px] transition-all items-center gap-1.5 cursor-pointer ${
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
            data-global-action="report-bug"
            className="hidden min-[1100px]:flex px-2 py-1 border border-amber-500/30 hover:border-amber-400/60 bg-black/40 text-amber-300 hover:text-amber-200 rounded font-mono text-[11px] transition-all items-center gap-1.5 cursor-pointer"
            title="Report a bug — opens a pre-filled GitHub issue (no account? it can copy the report instead)"
          >
            <Bug className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">REPORT BUG</span>
          </button>

          <button
            onClick={() => setIsDirSettingsOpen(true)}
            data-global-action="settings"
            className="flex px-2 py-1 border border-white/10 hover:border-cyan-400/40 bg-black/40 text-slate-300 hover:text-white rounded font-mono text-[11px] transition-all items-center gap-1.5 cursor-pointer"
            title="Manage all folders the studio uses (Mod Workspace, X4 game path, schema)"
          >
            <SettingsGear className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">SETTINGS</span>
          </button>

          <button
            onClick={requestClearWorkspace}
            data-global-action="reset-workspace"
            className="hidden min-[1700px]:flex px-2 py-1 border border-red-500/10 hover:border-red-500/30 bg-red-500/5 text-red-400 rounded font-mono text-[11px] hover:bg-red-500/10 transition-all items-center gap-1 cursor-pointer"
            title="Clean workspace back to blank state"
          >
            <Trash className="w-3.5 h-3.5" />
            <span className="hidden min-[2150px]:inline">RESET</span>
          </button>

          {/* Every utility remains available at every width through this compact menu. */}
          <div className="relative">
            <button
              type="button"
              data-testid="studio-menu-button"
              aria-haspopup="menu"
              aria-expanded={isStudioMenuOpen}
              onClick={() => setIsStudioMenuOpen(open => !open)}
              className="h-8 w-8 grid place-items-center rounded border border-white/10 bg-black/40 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40"
              title="Studio actions"
            >
              <Menu className="w-4 h-4" />
            </button>
            {isStudioMenuOpen && (
              <div role="menu" data-testid="studio-menu" className="absolute right-0 top-9 z-[10000] w-64 rounded-lg border border-cyan-500/25 bg-[#0b0e14]/98 p-1.5 shadow-2xl">
                {experienceMode === 'expert' && <div data-global-action="native-project-files" className="mb-1"><NativeProjectFiles workspace={workspace} /></div>}
                {experienceMode === 'expert' && (
                  <button role="menuitem" data-global-action="sync-mod" onClick={() => { setIsStudioMenuOpen(false); setIsSyncModalOpen(true); }} className="studio-menu-item"><FolderGit2 className="w-3.5 h-3.5" /> Sync Mod</button>
                )}
                {experienceMode === 'expert' && aiEnabled && (
                  <button role="menuitem" data-global-action="ai-settings" onClick={() => { setIsStudioMenuOpen(false); setIsAIConfigOpen(true); }} className="studio-menu-item"><Sparkles className="w-3.5 h-3.5" /> AI Engine</button>
                )}
                {experienceMode === 'expert' && (
                  <button role="menuitem" data-global-action="agent-api" onClick={() => { setIsStudioMenuOpen(false); setIsAgentBridgeOpen(open => !open); }} className="studio-menu-item"><Cpu className="w-3.5 h-3.5" /> Agent API</button>
                )}
                <button role="menuitem" data-global-action="report-bug" onClick={() => { setIsStudioMenuOpen(false); setIsBugReportOpen(true); }} className="studio-menu-item text-amber-300"><Bug className="w-3.5 h-3.5" /> Report Bug</button>
                <button role="menuitem" data-global-action="settings" onClick={() => { setIsStudioMenuOpen(false); setIsDirSettingsOpen(true); }} className="studio-menu-item"><SettingsGear className="w-3.5 h-3.5" /> Studio Settings</button>
                <button role="menuitem" data-global-action="reset-workspace" onClick={() => { setIsStudioMenuOpen(false); void requestClearWorkspace(); }} className="studio-menu-item text-red-300"><Trash className="w-3.5 h-3.5" /> Reset Workspace…</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {experienceMode === 'expert' && layoutPreferences.workspaceDock === 'top' && (
        <WorkspaceNavigationBar
          layout={layoutPreferences}
          activeView={workspaceView}
          onNavigate={(view) => {
            const item = WORKSPACE_NAV_ITEMS.find(candidate => candidate.id === view)!;
            if (view === 'blueprint' && firstFlaggedNodeId) jumpToFlaggedNode();
            else { setWorkspaceView(view); setActiveSidebarTab(item.sidebarTab); }
          }}
          onMove={(view, target) => updateLayoutPreferences(previous => ({ ...previous, workspaceOrder: moveOrderedItem(previous.workspaceOrder, view, target) }))}
          onToggleCollapsed={() => updateLayoutPreferences(previous => ({ ...previous, workspaceBarCollapsed: !previous.workspaceBarCollapsed }))}
          mdErrorCount={mdErrorCount}
          mdWarningCount={mdWarningCount}
        />
      )}

      <ReadinessLadder
        stages={readinessStages}
        onNavigate={navigateReadiness}
        onConfirmExperience={confirmCurrentExperience}
        trailing={(
          <div data-testid="experience-mode-switch" data-global-action="experience-mode" className="flex items-center gap-1 rounded-md border border-white/10 bg-black/45 p-1">
            <button data-testid="mode-beginner" aria-pressed={experienceMode === 'beginner'} onClick={() => changeExperienceMode('beginner')} className={`rounded px-2 py-1 text-[9px] font-mono font-bold uppercase ${experienceMode === 'beginner' ? 'bg-cyan-600/25 text-cyan-300' : 'text-slate-500 hover:text-white'}`}>Beginner</button>
            <button data-testid="mode-expert" aria-pressed={experienceMode === 'expert'} onClick={() => changeExperienceMode('expert')} className={`rounded px-2 py-1 text-[9px] font-mono font-bold uppercase ${experienceMode === 'expert' ? 'bg-amber-600/25 text-amber-300' : 'text-slate-500 hover:text-white'}`}>Expert</button>
          </div>
        )}
      />

      {/* B29: viewport-anchored sync-status layer — can NEVER be clipped by header overflow.
          Persistent until resolved (unlike the transient toast stack), so it lives in its own
          fixed slot just below the header, above everything but dialogs. */}
      {syncConflict ? (
        <WorkspaceConflictDialog
          detail={syncConflictDetail}
          expanded={syncConflictExpanded}
          busy={syncConflictBusy}
          error={syncConflictError}
          onExpand={() => setSyncConflictExpanded(true)}
          onCancel={() => { setSyncConflictExpanded(false); setSyncConflictError(''); }}
          onUseServer={() => void adoptServerWorkspace()}
          onKeepLocal={() => void forceKeepMine()}
        />
      ) : syncDiverged ? (
        <div data-testid="sync-status-layer" className="fixed top-14 right-3 z-[9999]">
          <button
            onClick={() => void adoptServerWorkspace()}
            data-testid="sync-diverged-badge"
            className="px-3 py-1.5 border border-amber-500/50 bg-[#1a140d]/95 text-amber-300 rounded-lg shadow-2xl font-mono text-[11px] hover:bg-amber-500/25 transition-all flex items-center gap-1.5 cursor-pointer animate-pulse whitespace-nowrap"
            title="Your canvas content differs from the server copy (persistently, not just mid-edit). Click to use the server workspace; Undo restores the current canvas."
          >
            ⚠ CANVAS ≠ SERVER — REVIEW
          </button>
        </div>
      ) : null}

      {/* Main Workspace split panel areas */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side: Drag control panel, property editor inspector */}
        {experienceMode === 'expert' && layoutPreferences.sidePanelCollapsed ? (
          <button
            type="button"
            data-testid="side-panel-restore"
            onClick={() => updateLayoutPreferences(previous => ({ ...previous, sidePanelCollapsed: false }))}
            className={`${layoutPreferences.toolDock === 'right' ? 'order-2 border-l' : 'order-0 border-r'} w-6 shrink-0 border-white/10 bg-[#10131a] text-cyan-400 hover:bg-cyan-500/10 grid place-items-center`}
            title="Show side panel"
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </button>
        ) : experienceMode === 'expert' ? (
        <Sidebar
          width={leftSidebarWidth}
          aiEnabled={aiEnabled}
          activeTab={activeSidebarTab}
          setActiveTab={setActiveSidebarTab}
          layoutPreferences={layoutPreferences}
          releasePreferences={releasePreferences}
          onMoveTool={(tool, target) => updateLayoutPreferences(previous => ({ ...previous, toolOrder: moveOrderedItem(previous.toolOrder, tool, target) }))}
          onToggleToolRail={() => updateLayoutPreferences(previous => ({ ...previous, toolRailCollapsed: !previous.toolRailCollapsed }))}
          onTogglePanel={() => updateLayoutPreferences(previous => ({ ...previous, sidePanelCollapsed: true }))}
          onOpenLayoutSettings={() => setIsDirSettingsOpen(true)}
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
            if (!openInNativeEditor(file.path)) {
              toast('Native file tabs are available in the installed Antigravity/VS Code extension.', 'warning');
            }
          }}
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
          validationDelta={validationDelta}
          diagnosticsScope={diagnosticsScope}
          onSuppressionCommitted={(sourceHash) => {
            setWorkspace(previous => previous.sourceStamp
              ? { ...previous, sourceStamp: { ...previous.sourceStamp, hash: sourceHash, at: new Date().toISOString() } }
              : previous);
            setDiagnosticRevision(value => value + 1);
          }}
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
        {(experienceMode !== 'expert' || !layoutPreferences.sidePanelCollapsed) && <div
          data-testid="side-panel-resizer"
          className={`${layoutPreferences.toolDock === 'right' && experienceMode === 'expert' ? 'order-1' : 'order-0'} w-1 cursor-col-resize hover:bg-cyan-500/50 hover:w-1.5 transition-all bg-white/5 h-full relative z-40 select-none shrink-0 ${
            isResizingLeft ? 'bg-cyan-500 w-1.5' : ''
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingLeft(true);
          }}
        />}

        {/* Center: Canvas editor viewport (Based on active workspace mode) */}
        <main data-testid="studio-workspace" className="order-0 min-w-0 flex-1 flex flex-col h-full overflow-hidden border-r border-white/10 bg-[#0a0c10]">
          
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
              selectedNodeIds={selectedNodeIds}
              setSelectedNodeIds={setSelectedNodeIds}
              activeMdScript={activeMdScript}
              onActiveMdScriptChange={handleActiveMdScriptChange}
              packageDiagnostics={effectiveDiagnostics}
              diagnosticSource={diagnosticSource}
            />
          ) : workspaceView === 'ui-designer' ? (
            <UIBuilder
              workspace={workspace}
              setWorkspace={setWorkspace}
              selectedWidget={selectedWidget}
              setSelectedWidget={setSelectedWidget}
              x4UiVerification={x4UiVerification}
              onConfirmX4UiVerification={confirmCurrentX4UiExperience}
              onX4UiVerificationSnapshotChange={setX4UiVerificationSnapshot}
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
              saveCheckpoint={saveCheckpoint}
              onServerWorkspaceApplied={(nextWorkspace, metadata) => {
                lastServerHashRef.current = metadata.workspaceHash;
                lastServerSnapshotHashRef.current = metadata.snapshotHash;
                setLocalVersion(metadata.version);
                persistScopedWorkspaceSnapshot(
                  sanitizeWorkspace(nextWorkspace),
                  metadata.version,
                  metadata.snapshotHash,
                );
                setSyncConflict(false);
                // The bulk route already committed this exact state through the server CAS
                // path. Adopt it without marking it as another local edit; otherwise the
                // ordinary autosave effect immediately echoes a redundant second mutation.
                localWorkspaceDirtyRef.current = false;
                workspaceRevisionRef.current += 1;
                setRawWorkspace(sanitizeWorkspace(nextWorkspace));
              }}
            />
          )}

        </main>

      </div>

      {experienceMode === 'expert' && layoutPreferences.workspaceDock === 'bottom' && (
        <WorkspaceNavigationBar
          layout={layoutPreferences}
          activeView={workspaceView}
          onNavigate={(view) => {
            const item = WORKSPACE_NAV_ITEMS.find(candidate => candidate.id === view)!;
            if (view === 'blueprint' && firstFlaggedNodeId) jumpToFlaggedNode();
            else { setWorkspaceView(view); setActiveSidebarTab(item.sidebarTab); }
          }}
          onMove={(view, target) => updateLayoutPreferences(previous => ({ ...previous, workspaceOrder: moveOrderedItem(previous.workspaceOrder, view, target) }))}
          onToggleCollapsed={() => updateLayoutPreferences(previous => ({ ...previous, workspaceBarCollapsed: !previous.workspaceBarCollapsed }))}
          mdErrorCount={mdErrorCount}
          mdWarningCount={mdWarningCount}
        />
      )}

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
        autoSync={agentAutoSync}
        onAutoSyncChange={setAgentAutoSync}
        pollingEnabled={agentWorkspacePollingEnabled}
        onPollingEnabledChange={setAgentWorkspacePollingEnabled}
        pendingWorkspace={pendingAgentWorkspace?.workspaceId === selectedWorkspaceId() ? pendingAgentWorkspace : null}
        onDiscardPendingWorkspace={clearPendingAgentWorkspace}
        onApplyPendingWorkspace={async candidate => {
          const applied = await adoptServerWorkspace(candidate);
          if (applied) clearPendingAgentWorkspace(candidate);
          return applied;
        }}
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
        onProjectLoaded={() => {
          setSelectedNode(null);
          setSelectedCueIds([]);
          setSelectedNodeIds([]);
          setActiveMdScript(null);
          nativeSelectionOpenKeyRef.current = '';
        }}
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
        layoutPreferences={layoutPreferences}
        setLayoutPreferences={updateLayoutPreferences}
        releasePreferences={releasePreferences}
        setReleasePreferences={updateReleasePreferences}
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
