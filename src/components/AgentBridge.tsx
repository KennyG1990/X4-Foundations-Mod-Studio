/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Play,
  AlertCircle,
  BookOpen,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
  KeyRound,
  Trash2,
  Clock
} from 'lucide-react';
import { ModWorkspace, NODE_TEMPLATES, MDNode } from '../types';

interface AgentBridgeProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: ModWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ModWorkspace>>;
  localVersion: number;
  setLocalVersion: (v: number) => void;
  /** B86.1: jump the canvas to a node named by a history entry. */
  setFocusNodeRequest?: (req: { nodeId: string; timestamp: number } | null) => void;
}

type AgentRuntimeValue = string | number | boolean | null | Record<string, unknown> | AgentRuntimeValue[];
type AgentRuntimeProperties = Record<string, AgentRuntimeValue>;
type AgentRuntimeResult = { success: boolean; message: string };

interface AgentRuntimeApi {
  execute: (cmd: string) => AgentRuntimeResult;
  updateNodeProperty: (nodeIdOrName: string, key: string, value: AgentRuntimeValue) => boolean;
  updateWidget: (widgetIdOrLabel: string, key: string, value: AgentRuntimeValue) => boolean;
  addNode: (xmlTagOrType: string, x?: number, y?: number, properties?: AgentRuntimeProperties) => boolean;
  getCurrentWorkspace: () => ModWorkspace;
}

interface AgentWorkspaceResponse {
  version?: unknown;
  workspace?: unknown;
}

declare global {
  interface Window {
    AgentRuntime?: AgentRuntimeApi;
    AgentBridge?: Pick<AgentRuntimeApi, 'execute'>;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isModWorkspace = (value: unknown): value is ModWorkspace =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.version === 'string' &&
  typeof value.author === 'string' &&
  typeof value.description === 'string' &&
  Array.isArray(value.nodes) &&
  Array.isArray(value.links) &&
  Array.isArray(value.uiWidgets) &&
  isRecord(value.uiTheme);

const parsePropertiesJson = (text: string): AgentRuntimeProperties | undefined => {
  const parsed: unknown = JSON.parse(text);
  return isRecord(parsed) ? parsed as AgentRuntimeProperties : undefined;
};

export default function AgentBridge({
  isOpen,
  onClose,
  workspace,
  setWorkspace,
  localVersion,
  setLocalVersion,
  setFocusNodeRequest
}: AgentBridgeProps) {
  const [activeTab, setActiveTab] = useState<'docs' | 'status' | 'execute' | 'keys' | 'history'>('docs');

  // B42: agent-key manager state (list is safe records only — never plaintext keys).
  interface AgentKeyRow {
    id: string; label: string; scope: 'read' | 'write' | 'deploy';
    createdAt: number; expiresAt: number | null; lastUsedAt: number | null;
    useCount: number; revokedAt: number | null; hashPrefix: string;
  }
  const [agentKeys, setAgentKeys] = useState<AgentKeyRow[]>([]);
  const [keysError, setKeysError] = useState<string>('');
  const [newKeyLabel, setNewKeyLabel] = useState<string>('');
  const [newKeyScope, setNewKeyScope] = useState<'read' | 'write' | 'deploy'>('write');
  const [newKeyTtl, setNewKeyTtl] = useState<string>('7d');
  const [createdKey, setCreatedKey] = useState<{ token: string; label: string } | null>(null);

  const loadAgentKeys = useCallback(async () => {
    try {
      const r = await fetch('/api/agent/keys');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setAgentKeys(Array.isArray(d.keys) ? d.keys : []);
      setKeysError('');
    } catch (e) {
      setKeysError(`Could not load keys: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'keys') void loadAgentKeys();
  }, [activeTab, loadAgentKeys]);

  // B86 — agent action ledger. Rows carry summaries and references only; payloads are fetched
  // on demand so opening this tab never pulls hundreds of KB of Lua across the wire.
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyNote, setHistoryNote] = useState('');
  const [historyKindFilter, setHistoryKindFilter] = useState('');
  const [historyOutcomeFilter, setHistoryOutcomeFilter] = useState('');
  const [historyFileFilter, setHistoryFileFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [rowDetail, setRowDetail] = useState<{ id: string; content: string } | null>(null);
  const [revertBusy, setRevertBusy] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (historyKindFilter) params.set('kind', historyKindFilter);
      if (historyOutcomeFilter) params.set('outcome', historyOutcomeFilter);
      if (historyFileFilter.trim()) params.set('file', historyFileFilter.trim());
      const r = await fetch(`/api/agent/history?${params.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setHistoryRows(Array.isArray(d.rows) ? d.rows : []);
      setHistoryNote(String(d.note || ''));
      // A ledger that is silently failing should be visible, not merely empty.
      setHistoryError(d.ledgerFailures > 0 ? `${d.ledgerFailures} history write(s) failed — ${d.lastFailure || 'unknown error'}` : '');
    } catch (e) {
      setHistoryError(`Could not load history: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [historyKindFilter, historyOutcomeFilter, historyFileFilter]);

  useEffect(() => {
    if (activeTab === 'history') void loadHistory();
  }, [activeTab, loadHistory]);

  const showRowDetail = useCallback(async (row: any) => {
    if (expandedRow === row.id) { setExpandedRow(null); setRowDetail(null); return; }
    setExpandedRow(row.id);
    setRowDetail(null);
    // Diagnostics first: for a validation or compile row, the findings ARE the detail worth
    // reading — a bare "1 error" is exactly the uselessness this panel exists to remove.
    const which = row.diagnosticsBlob ? 'diagnostics' : row.diffBlob ? 'diff' : row.afterBlob ? 'after' : 'before';
    if (!row.diagnosticsBlob && !row.diffBlob && !row.afterBlob && !row.beforeBlob) return;
    try {
      const r = await fetch(`/api/agent/history/${row.id}/raw?which=${which}`);
      const d = await r.json();
      setRowDetail({ id: row.id, content: d.ok ? String(d.content) : `(${d.error || 'unavailable'})` });
    } catch (e) {
      setRowDetail({ id: row.id, content: `(could not load: ${e instanceof Error ? e.message : String(e)})` });
    }
  }, [expandedRow]);

  const revertToRow = useCallback(async (row: any) => {
    setRevertBusy(row.id);
    try {
      const r = await fetch(`/api/agent/history/${row.id}/revert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (!r.ok || d?.ok === false) throw new Error(d?.error || `HTTP ${r.status}`);
      await loadHistory();
    } catch (e) {
      setHistoryError(`Revert failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRevertBusy('');
    }
  }, [loadHistory]);

  const createAgentKey = useCallback(async () => {
    setKeysError('');
    try {
      const r = await fetch('/api/agent/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newKeyLabel.trim(), scope: newKeyScope, ttl: newKeyTtl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setCreatedKey({ token: d.token, label: d.record?.label || newKeyLabel });
      setNewKeyLabel('');
      await loadAgentKeys();
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : String(e));
    }
  }, [newKeyLabel, newKeyScope, newKeyTtl, loadAgentKeys]);

  const revokeAgentKey = useCallback(async (id: string) => {
    setKeysError('');
    try {
      const r = await fetch('/api/agent/keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      await loadAgentKeys();
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : String(e));
    }
  }, [loadAgentKeys]);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);

  // Surgical Console states
  const [consoleCommand, setConsoleCommand] = useState<string>("set includeInBuild to false on widget win_threat_monitor");
  const [consoleLogs, setConsoleLogs] = useState<Array<{ text: string; type: 'success' | 'error' | 'info' }>>([
    { text: "AgentRuntime initialized. Surgical executor ready.", type: 'info' }
  ]);

  // Surgical workspace manipulation APIs
  const updateNodeProperty = useCallback((nodeIdOrName: string, key: string, value: AgentRuntimeValue): boolean => {
    let success = false;
    setWorkspace(prev => {
      const exists = prev.nodes.some(n => n.id === nodeIdOrName || n.properties.name === nodeIdOrName);
      if (!exists) return prev;
      
      success = true;
      return {
        ...prev,
        nodes: prev.nodes.map(n => {
          if (n.id === nodeIdOrName || n.properties.name === nodeIdOrName) {
            const topLevelKeys = ['label', 'xmlTag', 'x', 'y', 'comment', 'width', 'height', 'color', 'includeInBuild'];
            if (topLevelKeys.includes(key)) {
              return { ...n, [key]: value };
            } else {
              return {
                ...n,
                properties: {
                  ...n.properties,
                  [key]: value
                }
              };
            }
          }
          return n;
        })
      };
    });
    return success;
  }, [setWorkspace]);

  const updateWidget = useCallback((widgetIdOrLabel: string, key: string, value: AgentRuntimeValue): boolean => {
    let success = false;
    setWorkspace(prev => {
      const exists = prev.uiWidgets.some(w => w.id === widgetIdOrLabel || w.label === widgetIdOrLabel);
      if (!exists) return prev;

      success = true;
      return {
        ...prev,
        uiWidgets: prev.uiWidgets.map(w => {
          if (w.id === widgetIdOrLabel || w.label === widgetIdOrLabel) {
            const topLevelKeys = ['type', 'x', 'y', 'w', 'h', 'label', 'includeInBuild'];
            if (topLevelKeys.includes(key)) {
              return { ...w, [key]: value };
            } else {
              return {
                ...w,
                properties: {
                  ...w.properties,
                  [key]: value
                }
              };
            }
          }
          return w;
        })
      };
    });
    return success;
  }, [setWorkspace]);

  const addNode = useCallback((xmlTagOrType: string, x?: number, y?: number, properties?: AgentRuntimeProperties): boolean => {
    const template = NODE_TEMPLATES.find(t => t.xmlTag === xmlTagOrType || t.type === xmlTagOrType);
    if (!template) {
      // Create fallback generic node
      const fallbackNode: MDNode = {
        id: `node_gen_${Date.now()}`,
        type: 'action',
        label: xmlTagOrType,
        xmlTag: xmlTagOrType,
        x: x ?? 150,
        y: y ?? 150,
        properties: properties ?? {},
        propertiesSchema: [],
        inputs: [{ id: 'in_act', name: 'Action In', type: 'child' }],
        outputs: [{ id: 'out_next', name: 'Next Action', type: 'flow' }]
      };
      setWorkspace(prev => ({
        ...prev,
        nodes: [...prev.nodes, fallbackNode]
      }));
      return true;
    }
    
    const newNode: MDNode = {
      ...template,
      id: `${template.xmlTag}_${Date.now()}`,
      x: x ?? 150,
      y: y ?? 150,
      properties: { ...template.properties, ...(properties ?? {}) }
    };
    setWorkspace(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
    return true;
  }, [setWorkspace]);

  const runtimeExecute = useCallback((cmdStr: string): AgentRuntimeResult => {
    const cmd = cmdStr.trim();
    if (!cmd) return { success: false, message: "Commands cannot be empty." };

    // Parse helper for boolean/number values
    const parseValue = (valStr: string): AgentRuntimeValue => {
      const v = valStr.trim();
      if (v.toLowerCase() === 'true') return true;
      if (v.toLowerCase() === 'false') return false;
      if (!isNaN(Number(v))) return Number(v);
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.substring(1, v.length - 1);
      }
      return v;
    };

    // --- A. WIDGET PROPERTY UPDATE CONSOLE ---
    // Example: updateWidget win_threat_monitor includeInBuild false
    // Example: set includeInBuild to false on widget win_threat_monitor
    const updateWidgetRegex = /^(?:updateWidget\s+(\S+)\s+(\S+)\s+(.+))$/i;
    const updateWidgetNaturalRegex = /^set\s+(\S+)\s+to\s+(.+?)\s+on\s+widget\s+(\S+)$/i;

    let match = cmd.match(updateWidgetRegex);
    if (match) {
      const [, widgetIdOrLabel, key, valStr] = match;
      const val = parseValue(valStr);
      const ok = updateWidget(widgetIdOrLabel, key, val);
      return {
        success: ok,
        message: ok 
          ? `Successfully executed: updateWidget '${widgetIdOrLabel}' property '${key}' to '${val}'`
          : `Failed: Could not find widget '${widgetIdOrLabel}' to update.`
      };
    }

    match = cmd.match(updateWidgetNaturalRegex);
    if (match) {
      const [, key, valStr, widgetIdOrLabel] = match;
      const val = parseValue(valStr);
      const ok = updateWidget(widgetIdOrLabel, key, val);
      return {
        success: ok,
        message: ok 
          ? `Successfully applied natural fix: set widget '${widgetIdOrLabel}' property '${key}' to '${val}'`
          : `Failed: Could not find widget '${widgetIdOrLabel}' for natural property fix.`
      };
    }

    // --- B. NODE PROPERTY UPDATE CONSOLE ---
    // Example: updateNodeProperty MyMissionCue instantiate true
    // Example: set instantiate to true on node MyMissionCue
    const updateNodeRegex = /^(?:updateNodeProperty\s+(\S+)\s+(\S+)\s+(.+))$/i;
    const updateNodeNaturalRegex = /^set\s+(\S+)\s+to\s+(.+?)\s+on\s+node\s+(\S+)$/i;

    match = cmd.match(updateNodeRegex);
    if (match) {
      const [, nodeIdOrName, key, valStr] = match;
      const val = parseValue(valStr);
      const ok = updateNodeProperty(nodeIdOrName, key, val);
      return {
        success: ok,
        message: ok
          ? `Successfully executed: updateNodeProperty '${nodeIdOrName}' property '${key}' to '${val}'`
          : `Failed: Could not find node '${nodeIdOrName}' to update.`
      };
    }

    match = cmd.match(updateNodeNaturalRegex);
    if (match) {
      const [, key, valStr, nodeIdOrName] = match;
      const val = parseValue(valStr);
      const ok = updateNodeProperty(nodeIdOrName, key, val);
      return {
        success: ok,
        message: ok
          ? `Successfully applied natural fix: set node '${nodeIdOrName}' property '${key}' to '${val}'`
          : `Failed: Could not find node '${nodeIdOrName}' for property fix.`
      };
    }

    // --- C. NODE INSERTION CONSOLE ---
    // Example: addNode cue at 300, 400
    // Example: addNode create_ship at 100, 100 with properties {"name": "$EscortShip"}
    const addNodeRegex = /^addNode\s+(\S+)(?:\s+at\s+(\d+),\s*(\d+))?(?:\s+with\s+properties\s+(.+))?$/i;
    match = cmd.match(addNodeRegex);
    if (match) {
      const [, xmlTagOrType, xStr, yStr, propsJson] = match;
      const x = xStr ? parseInt(xStr, 10) : undefined;
      const y = yStr ? parseInt(yStr, 10) : undefined;
      let properties: AgentRuntimeProperties | undefined = undefined;
      if (propsJson) {
        try {
          properties = parsePropertiesJson(propsJson);
        } catch {
          // ignore
        }
      }
      const ok = addNode(xmlTagOrType, x, y, properties);
      return {
        success: ok,
        message: ok
          ? `Successfully executed: Spawned new node of type '${xmlTagOrType}' at coordinates (${x ?? 150}, ${y ?? 150})`
          : `Failed to spawn node of type '${xmlTagOrType}'`
      };
    }

    // --- D. BUNDLED COCKPIT/THREAT WIDGET REMEDIAL SCRIPT ---
    if (cmd.toLowerCase().includes("disable includeinbuild on widgets") || 
        cmd.toLowerCase().includes("includeinbuild to false on every widget") ||
        cmd.toLowerCase().includes("update widgets includeinbuild false")) {
      
      const widgetsToUpdate = [
        'win_threat_monitor',
        'hdr_threat_monitor',
        'pb_threat_level',
        'btn_sim_entry',
        'btn_spawn_xenon',
        'chk_auto_spawn',
        'chat_diagnostics'
      ];
      
      let count = 0;
      setWorkspace(prev => ({
        ...prev,
        uiWidgets: prev.uiWidgets.map(w => {
          if (widgetsToUpdate.includes(w.id) || widgetsToUpdate.includes(w.label)) {
            count++;
            return { ...w, includeInBuild: false };
          }
          return w;
        })
      }));
      
      return {
        success: true,
        message: `Surgically resolved warnings by disabling 'includeInBuild' on ${count} threat-monitor UI widgets.`
      };
    }

    return {
      success: false,
      message: `Error: Command pattern not recognized. Supported instructions: 'updateNodeProperty', 'updateWidget', 'addNode', or natural language fixing scripts.`
    };
  }, [addNode, updateNodeProperty, updateWidget, setWorkspace]);

  // Expose AgentRuntime to global window scope so that internal guide, floating chat copilot, 
  // or test scripts can trigger instant workspace edits surgically at runtime
  useEffect(() => {
    const api = {
      execute: (cmd: string) => {
        const result = runtimeExecute(cmd);
        // Append log to visual console
        setConsoleLogs(prev => [
          ...prev, 
          { text: result.message, type: result.success ? 'success' : 'error' }
        ]);
        return result;
      },
      updateNodeProperty,
      updateWidget,
      addNode,
      getCurrentWorkspace: () => workspace
    };

    window.AgentRuntime = api;
    window.AgentBridge = { execute: api.execute };

    return () => {
      delete window.AgentRuntime;
      delete window.AgentBridge;
    };
  }, [addNode, runtimeExecute, updateNodeProperty, updateWidget, workspace]);
  
  // Settings
  const [autoSync, setAutoSync] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  
  // Server state tracking
  const [serverVersion, setServerVersion] = useState<number>(localVersion);
  const [pendingWorkspace, setPendingWorkspace] = useState<ModWorkspace | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("Never");
  const [isServerHealthy, setIsServerHealthy] = useState<boolean>(true);
  
  // Documentation collapsables
  const [collapsedEndpoints, setCollapsedEndpoints] = useState<Record<string, boolean>>({
    schema: true,
    getWorkspace: false,
    postWorkspace: true,
    debugWatcher: false,
    generate: false,
    compile: true,
  });

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
  const authCurlHeader = `-H "Authorization: Bearer $(Get-Content .studio-api-token)"`;

  const toggleEndpoint = (key: string) => {
    setCollapsedEndpoints(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  // Poll the server workspace state periodically to track background changes from external AI agents
  useEffect(() => {
    if (!isPolling || !isOpen) return;

    let isActive = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/agent/workspace");
        if (!res.ok) throw new Error("Offline");
        
        const data = await res.json() as AgentWorkspaceResponse;
        if (!isActive) return;

        setIsServerHealthy(true);
        setLastSyncedTime(new Date().toLocaleTimeString());

        // Check if server version is newer
        if (typeof data.version === 'number' && data.version > localVersion && isModWorkspace(data.workspace)) {
          setServerVersion(data.version);
          if (autoSync) {
            setWorkspace(data.workspace);
            setLocalVersion(data.version);
            setPendingWorkspace(null);
          } else {
            setPendingWorkspace(data.workspace);
          }
        } else if (data.version === localVersion) {
          setPendingWorkspace(null);
          setServerVersion(data.version);
        }
      } catch {
        if (!isActive) return;
        setIsServerHealthy(false);
      }
    };

    fetchStatus(); // immediate check
    const interval = setInterval(fetchStatus, 4000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [isPolling, localVersion, autoSync, isOpen, setLocalVersion, setWorkspace]);

  // Manually apply pending external changes
  const applyPendingChanges = () => {
    if (pendingWorkspace) {
      setWorkspace(pendingWorkspace);
      setLocalVersion(serverVersion);
      setPendingWorkspace(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-[#0c0f16] border-l border-cyan-500/30 z-50 flex flex-col shadow-2xl font-mono text-xs text-slate-300">
      
      {/* Header Panel */}
      <div className="bg-[#141b25] border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 px-1.5 bg-cyan-700/30 border border-cyan-500/40 rounded text-cyan-400">
            <Cpu className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight block">AI Agent API Bridge</span>
            <span className="text-[10px] text-slate-400">Integrate external Codex, Claude, and Antigravity agents</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Synchronisation Status Banner */}
      <div className="px-4 py-2 border-b border-white/5 bg-[#090b10] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isServerHealthy ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
          <span className="text-slate-400">
            Sync: {isServerHealthy ? 'Connected' : 'Offline'}
          </span>
          <span className="text-[9px] text-slate-500">| ver: v{localVersion} (srv: v{serverVersion})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500">Last: {lastSyncedTime}</span>
          <button 
            onClick={() => {
              setIsPolling(prev => !prev);
            }}
            className="p-1 text-slate-400 hover:text-white transition-all"
            title={isPolling ? "Pause server synchronization" : "Resume server synchronization"}
          >
            <RefreshCw className={`w-3 h-3 ${isPolling ? 'animate-spin-slow text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sync Alerts */}
      {pendingWorkspace && (
        <div className="bg-cyan-500/10 border-b border-cyan-500/20 p-3 flex flex-col gap-2 animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-cyan-400 text-[11px] block">EXTERNAL AGENT CHANGE DETECTED</span>
              <p className="text-[10px] text-slate-300 leading-normal font-sans">
                An external AI Agent (Antigravity/Claude) has pushed a modified blueprint of the mod (v{serverVersion}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end">
            <button
              onClick={() => setPendingWorkspace(null)}
              className="px-2.5 py-1 text-[10px] hover:text-white text-slate-400 bg-white/5 rounded border border-white/5 hover:bg-white/10 transition-all font-mono"
            >
              Discard
            </button>
            <button
              onClick={applyPendingChanges}
              className="px-3 py-1 text-[10px] bg-cyan-600/20 hover:bg-cyan-600/30 font-bold border border-cyan-500/30 text-cyan-400 rounded flex items-center gap-1.5 transition-all cursor-pointer font-mono"
            >
              <Play className="w-3 h-3" />
              Apply Changes
            </button>
          </div>
        </div>
      )}

      {/* Navigation Subtabs */}
      <div className="flex border-b border-white/5 bg-[#0e1219] p-1 gap-1">
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex-1 py-1.5 rounded font-mono text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'docs' 
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />
          API Docs
        </button>
        <button
          onClick={() => setActiveTab('execute')}
          className={`flex-1 py-1.5 rounded font-mono text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'execute' 
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5 inline mr-1.5" />
          Surgical Execute
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-1.5 rounded font-mono text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'status' 
              ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 inline mr-1.5" />
          Live State JSON
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={`flex-1 py-1.5 rounded font-mono text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'keys'
              ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 inline mr-1.5" />
          Agent Keys
        </button>
        <button
          onClick={() => setActiveTab('history')}
          data-testid="agent-history-tab"
          className={`flex-1 py-1.5 rounded font-mono text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          History
        </button>
      </div>

      {/* View area panel content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* -----------------------------------------------------
            VIEW TAB: HISTORY (B86 — agent action ledger)
            Photoshop-style: newest first, one readable line per action.
            ----------------------------------------------------- */}
        {activeTab === 'history' && (
          <div className="space-y-3" data-testid="agent-history-panel">
            <div className="flex items-center justify-between">
              <div className="text-emerald-400 font-mono text-[11px] font-bold tracking-wider">ACTION HISTORY</div>
              <button
                onClick={() => void loadHistory()}
                className="text-[10px] font-mono px-2 py-1 rounded border border-white/10 text-slate-400 hover:text-white hover:border-white/30 cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {/* Scope discipline: this must never be mistaken for version control. */}
            {historyNote && (
              <div className="text-[9.5px] font-mono text-slate-500 border-l-2 border-slate-700 pl-2 leading-relaxed">
                {historyNote}
              </div>
            )}

            {historyError && (
              <div className="text-[10px] font-mono text-red-400 border border-red-500/30 bg-red-500/5 rounded p-2" role="alert">
                {historyError}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <select
                value={historyKindFilter}
                onChange={e => setHistoryKindFilter(e.target.value)}
                className="bg-[#0f131c] border border-white/10 rounded text-[10px] font-mono text-slate-300 px-2 py-1"
                aria-label="Filter by action kind"
              >
                <option value="">all kinds</option>
                {['edit', 'import', 'validate', 'compile', 'deploy', 'package', 'revert'].map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <select
                value={historyOutcomeFilter}
                onChange={e => setHistoryOutcomeFilter(e.target.value)}
                className="bg-[#0f131c] border border-white/10 rounded text-[10px] font-mono text-slate-300 px-2 py-1"
                aria-label="Filter by outcome"
              >
                <option value="">all outcomes</option>
                {['ok', 'warn', 'error'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input
                value={historyFileFilter}
                onChange={e => setHistoryFileFilter(e.target.value)}
                placeholder="filter by file…"
                aria-label="Filter by file path"
                className="flex-1 min-w-[140px] bg-[#0f131c] border border-white/10 rounded text-[10px] font-mono text-slate-300 px-2 py-1"
              />
            </div>

            {historyRows.length === 0 && !historyError && (
              <div className="text-[10px] font-mono text-slate-500 py-6 text-center">
                No actions recorded yet. Edits, imports, validations, compiles, deploys and packages appear here.
              </div>
            )}

            <div className="space-y-1">
              {historyRows.map(row => {
                const badge = row.outcome?.status === 'error'
                  ? 'text-red-400 border-red-500/40 bg-red-500/10'
                  : row.outcome?.status === 'warn'
                    ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                    : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
                const open = expandedRow === row.id;
                return (
                  <div key={row.id} className="border border-white/5 rounded bg-[#0f131c]">
                    <button
                      onClick={() => void showRowDetail(row)}
                      className="w-full text-left p-2 cursor-pointer hover:bg-white/5 rounded"
                      aria-expanded={open}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[9px] font-mono text-slate-600 shrink-0 w-[52px] pt-0.5">
                          {new Date(row.ts).toLocaleTimeString()}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 shrink-0 w-[70px] pt-0.5 truncate" title={row.agent?.label}>
                          {row.agent?.label}
                        </span>
                        <span className="text-[9px] font-mono text-cyan-500/70 shrink-0 w-[52px] pt-0.5">{row.kind}</span>
                        <span className="text-[11px] font-mono text-slate-200 flex-1 leading-relaxed">{row.title}</span>
                        <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge}`}>
                          {String(row.outcome?.status || '').toUpperCase()}
                        </span>
                      </div>
                    </button>
                    {open && (
                      <div className="border-t border-white/5 p-2 space-y-2">
                        {row.files?.length > 0 && (
                          <div className="text-[9.5px] font-mono text-slate-500">
                            {row.files.length === 1 ? 'File: ' : 'Files: '}
                            <span className="text-slate-300 break-all">{row.files.join(', ')}</span>
                            {row.lines && <span className="text-slate-500"> · +{row.lines.added} / −{row.lines.removed} lines</span>}
                            <span className="text-slate-600"> · {row.durationMs}ms</span>
                          </div>
                        )}
                        {/* B86.1: the nodes this action touched. Click one to jump the canvas
                            to it — the entry stops being a log line and becomes a way back to
                            the thing that changed. */}
                        {row.nodes?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[9.5px] font-mono text-slate-500 mr-0.5">Nodes:</span>
                            {row.nodes.slice(0, 12).map((n: any) => (
                              <button
                                key={n.id}
                                onClick={() => setFocusNodeRequest?.({ nodeId: n.id, timestamp: Date.now() })}
                                title={`Focus ${n.label || n.id} on the canvas`}
                                data-testid="history-node-chip"
                                className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15 cursor-pointer"
                              >
                                {n.label || n.id}
                              </button>
                            ))}
                            {row.nodes.length > 12 && (
                              <span className="text-[9px] font-mono text-slate-600">+{row.nodes.length - 12} more</span>
                            )}
                          </div>
                        )}
                        {row.diagnosticsCount > 0 && (
                          <div className="text-[9.5px] font-mono text-slate-500">
                            {row.diagnosticsCount} diagnostic(s) — full detail below
                          </div>
                        )}
                        {row.revertible ? (
                          <button
                            onClick={() => void revertToRow(row)}
                            disabled={revertBusy === row.id}
                            className="text-[10px] font-mono px-2 py-1 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 cursor-pointer"
                          >
                            {revertBusy === row.id ? 'Reverting…' : 'Revert to here'}
                          </button>
                        ) : (
                          <div className="text-[9.5px] font-mono text-slate-500 italic">{row.revertReason}</div>
                        )}
                        {rowDetail?.id === row.id && (() => {
                          // Diagnostics render as readable lines, never as raw JSON — a wall of
                          // JSON is the thing this panel is supposed to replace.
                          if (row.diagnosticsBlob) {
                            let parsed: any[] | null = null;
                            try { parsed = JSON.parse(rowDetail.content); } catch { parsed = null; }
                            if (Array.isArray(parsed)) {
                              return (
                                <div className="bg-[#070a0f] rounded p-2 max-h-[240px] overflow-auto space-y-1">
                                  {parsed.map((d, i) => (
                                    <div key={i} className="text-[9.5px] font-mono leading-relaxed flex items-start gap-1.5">
                                      <span className={`font-bold shrink-0 ${
                                        d.severity === 'error' ? 'text-red-400' : d.severity === 'warning' ? 'text-amber-400' : 'text-slate-500'
                                      }`}>
                                        {d.severity === 'error' ? 'ERR' : d.severity === 'warning' ? 'WARN' : 'INFO'}
                                      </span>
                                      <span className="text-slate-300 break-all">
                                        {d.filePath ? <span className="text-cyan-400">{d.filePath}{d.line ? `:${d.line}` : ''}</span> : null}
                                        {d.filePath ? ' — ' : ''}{d.message}
                                        {d.code ? <span className="text-slate-600"> [{d.code}]</span> : null}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                          }
                          return (
                            <pre className="text-[9.5px] font-mono text-slate-400 bg-[#070a0f] rounded p-2 max-h-[240px] overflow-auto whitespace-pre-wrap break-all">
                              {rowDetail.content.length > 20000 ? `${rowDetail.content.slice(0, 20000)}\n… (truncated for display)` : rowDetail.content}
                            </pre>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* -----------------------------------------------------
            VIEW TAB: API DOCUMENTATION
            ----------------------------------------------------- */}
        {activeTab === 'docs' && (
          <div className="space-y-4 font-sans text-slate-300">
            
            {/* Core introduction info */}
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 font-sans leading-relaxed text-[11px]">
              <h4 className="text-white font-bold mb-1 font-mono flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                HOW AGENTS RUN THIS STUDIO
              </h4>
              <p className="text-slate-400">
                This instance runs an active visual sync gateway. AI Agents use our endpoints to read the current game constants, pull the node coordinates, design complex logic chains, and push updates back in real-time.
              </p>
            </div>

            {/* Sync Settings Card */}
            <div className="p-3 bg-[#111622] rounded-lg border border-cyan-500/20 flex flex-col gap-2 font-mono">
              <span className="text-xs font-bold text-white uppercase tracking-wide">SYNC BRIDGE SETTINGS</span>
              <div className="flex items-center justify-between text-[11px] py-1">
                <span className="text-slate-400">Auto-Apply Agent Modifications</span>
                <button 
                  onClick={() => setAutoSync(!autoSync)}
                  className="p-1 focus:outline-none"
                >
                  {autoSync ? (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <span className="text-[10px] font-bold uppercase">ON</span>
                      <ToggleRight className="w-7 h-7" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-slate-500">
                      <span className="text-[10px] font-bold uppercase">OFF</span>
                      <ToggleLeft className="w-7 h-7" />
                    </div>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-sans leading-normal">
                {autoSync 
                  ? "When enabled, any visual blueprints sent by an external AI will instantly draw and refresh the canvas on your screen."
                  : "When disabled, you will get a visual banner to approve or discard changes before applying."}
              </p>
            </div>

            {/* API Endpoints Section */}
            <div className="space-y-2 font-mono text-[11px]">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block mb-1">AVAILABLE API ROUTES</span>
              
              {/* ENDPOINT 1: GET SCHEMA */}
              <div className="border border-white/5 rounded-lg bg-black/35 overflow-hidden">
                <button 
                  onClick={() => toggleEndpoint('schema')}
                  className="w-full text-left p-2.5 bg-[#12161f] flex items-center justify-between hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">GET</span>
                    <span className="text-white text-xs font-bold font-mono">/api/agent/schema</span>
                  </div>
                  {collapsedEndpoints.schema ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                
                {!collapsedEndpoints.schema && (
                  <div className="p-3 border-t border-white/5 space-y-2 bg-[#0a0c11]">
                    <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                      Public read-only contract for external agents: supported domains, endpoint catalog, auth rules, constants, templates, and compile response shape.
                    </p>
                    <div className="relative">
                      <pre className="bg-[#10141f] p-2 rounded text-[10px] text-cyan-300 overflow-x-auto w-full select-all">
                        {`curl -X GET "${appOrigin}/api/agent/schema"`}
                      </pre>
                      <button 
                        onClick={() => handleCopy(`curl -X GET "${appOrigin}/api/agent/schema"`, 'curl_schema')}
                        className="absolute right-2 top-2 p-1 rounded bg-black/45 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        {copiedTextId === 'curl_schema' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 2: GET WORKSPACE */}
              <div className="border border-white/5 rounded-lg bg-black/35 overflow-hidden">
                <button 
                  onClick={() => toggleEndpoint('getWorkspace')}
                  className="w-full text-left p-2.5 bg-[#12161f] flex items-center justify-between hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">GET</span>
                    <span className="text-white text-xs font-bold font-mono">/api/agent/workspace</span>
                  </div>
                  {collapsedEndpoints.getWorkspace ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                
                {!collapsedEndpoints.getWorkspace && (
                  <div className="p-3 border-t border-white/5 space-y-2 bg-[#0a0c11]">
                    <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                      Retrieves the current JSON representation of the user's nodes, wires, widgets, translations, AI scripts, wares, jobs, XML patches, and UI theme.
                    </p>
                    <div className="relative">
                      <pre className="bg-[#10141f] p-2 rounded text-[10px] text-cyan-300 overflow-x-auto w-full select-all">
                        {`curl -X GET "${appOrigin}/api/agent/workspace" \\
     ${authCurlHeader}`}
                      </pre>
                      <button 
                        onClick={() => handleCopy(`curl -X GET "${appOrigin}/api/agent/workspace" ${authCurlHeader}`, 'curl_getws')}
                        className="absolute right-2 top-2 p-1 rounded bg-black/45 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        {copiedTextId === 'curl_getws' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 3: POST WORKSPACE */}
              <div className="border border-white/5 rounded-lg bg-black/35 overflow-hidden">
                <button 
                  onClick={() => toggleEndpoint('postWorkspace')}
                  className="w-full text-left p-2.5 bg-[#12161f] flex items-center justify-between hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">POST</span>
                    <span className="text-white text-xs font-bold font-mono">/api/agent/workspace</span>
                  </div>
                  {collapsedEndpoints.postWorkspace ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                
                {!collapsedEndpoints.postWorkspace && (
                  <div className="p-3 border-t border-white/5 space-y-2 bg-[#0a0c11]">
                    <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                       Publishes a full ModWorkspace JSON structure directly into the studio, including optional tFiles, aiScripts, wares, jobs, and xmlPatches.
                    </p>
                    <div className="relative">
                      <pre className="bg-[#10141f] p-2 rounded text-[9px] text-cyan-300 overflow-y-auto max-h-32 select-all">
                        {`curl -X POST "${appOrigin}/api/agent/workspace" \\
     ${authCurlHeader} \\
     -H "Content-Type: application/json" \\
     -d '{
       "workspace": {
         "name": "Bounty_Hunter_Mod",
         "nodes": [...],
         "links": [...],
         "uiWidgets": [...],
         "uiTheme": {...}
       }
     }'`}
                      </pre>
                      <button 
                        onClick={() => handleCopy(`curl -X POST "${appOrigin}/api/agent/workspace" ${authCurlHeader} -H "Content-Type: application/json" -d '{"workspace": {"name": "My_AI_Mod", "nodes": [], "links": [], "uiWidgets": []}}'`, 'curl_postws')}
                        className="absolute right-2 top-2 p-1 rounded bg-black/45 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        {copiedTextId === 'curl_postws' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 4: GET DEBUG WATCHER BRIEF */}
              <div className="border border-cyan-500/10 rounded-lg bg-black/35 overflow-hidden">
                <button
                  onClick={() => toggleEndpoint('debugWatcher')}
                  className="w-full text-left p-2.5 bg-[#12161f] flex items-center justify-between hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">GET</span>
                    <span className="text-white text-xs font-bold font-mono">/api/agent/debug-watcher/brief</span>
                  </div>
                  {collapsedEndpoints.debugWatcher ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>

                {!collapsedEndpoints.debugWatcher && (
                  <div className="p-3 border-t border-cyan-500/10 space-y-2 bg-[#071013]">
                    <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                      Headless version of the Game Debug Log Watcher for agents and users: active-mod status, high-signal timeline, expected cue/marker chain, deploy freshness, and copyable evidence artifact.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-sans text-slate-400">
                      <div className="rounded bg-black/30 border border-white/5 p-2">
                        <span className="block font-mono font-bold text-cyan-300 uppercase mb-1">Query</span>
                        <span><code className="text-slate-200">modId</code> scopes the log to a mod id or marker.</span>
                      </div>
                      <div className="rounded bg-black/30 border border-white/5 p-2">
                        <span className="block font-mono font-bold text-cyan-300 uppercase mb-1">Expect</span>
                        <span><code className="text-slate-200">expect</code> is a comma-separated cue/marker chain to prove.</span>
                      </div>
                    </div>
                    <div className="relative">
                      <pre className="bg-[#10141f] p-2 rounded text-[10px] text-cyan-300 overflow-x-auto w-full select-all">
                        {`curl -X GET "${appOrigin}/api/agent/debug-watcher/brief?modId=ai_influence&expect=Save_identity,Chat_boot,Poll_tick,On_action" \\
     ${authCurlHeader}`}
                      </pre>
                      <button
                        onClick={() => handleCopy(`curl -X GET "${appOrigin}/api/agent/debug-watcher/brief?modId=ai_influence&expect=Save_identity,Chat_boot,Poll_tick,On_action" ${authCurlHeader}`, 'curl_debug_watcher')}
                        className="absolute right-2 top-2 p-1 rounded bg-black/45 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        {copiedTextId === 'curl_debug_watcher' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 5: POST GENERATE (Gemini automation helper) */}
              <div className="border border-white/5 rounded-lg bg-black/35 overflow-hidden">
                <button 
                  onClick={() => toggleEndpoint('generate')}
                  className="w-full text-left p-2.5 bg-[#12161f] flex items-center justify-between hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#df9825]/20 text-[#df9825] border border-[#df9825]/30">POST</span>
                    <span className="text-white text-xs font-bold font-mono">/api/agent/generate</span>
                  </div>
                  {collapsedEndpoints.generate ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                
                {!collapsedEndpoints.generate && (
                  <div className="p-3 border-t border-white/5 space-y-2 bg-[#0a0c11]">
                    <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                      Uses the server-side structured AI provider to generate or edit MD graph/UI layout domains while preserving existing non-MD domains.
                    </p>
                    <div className="relative">
                      <pre className="bg-[#10141f] p-2 rounded text-[10px] text-cyan-300 overflow-x-auto w-full select-all">
                        {`curl -X POST "${appOrigin}/api/agent/generate" \\
     ${authCurlHeader} \\
     -H "Content-Type: application/json" \\
     -d '{"prompt": "Create custom mission with Elite Fighter wing escort"}'`}
                      </pre>
                      <button 
                        onClick={() => handleCopy(`curl -X POST "${appOrigin}/api/agent/generate" ${authCurlHeader} -H "Content-Type: application/json" -d '{"prompt": "Create custom mission with Elite Fighter wing escort"}'`, 'curl_gen')}
                        className="absolute right-2 top-2 p-1 rounded bg-black/45 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        {copiedTextId === 'curl_gen' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 6: POST COMPILE */}
              <div className="border border-white/5 rounded-lg bg-black/35 overflow-hidden">
                <button 
                  onClick={() => toggleEndpoint('compile')}
                  className="w-full text-left p-2.5 bg-[#12161f] flex items-center justify-between hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#df9825]/20 text-[#df9825] border border-[#df9825]/30">POST</span>
                    <span className="text-white text-xs font-bold font-mono">/api/agent/compile</span>
                  </div>
                  {collapsedEndpoints.compile ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                
                {!collapsedEndpoints.compile && (
                  <div className="p-3 border-t border-white/5 space-y-2 bg-[#0a0c11]">
                    <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                      Sends any workspace payload to generate a complete package file manifest: content.xml, README, MD XML, UI XML, AI scripts, library diffs, translations, and XML patches.
                    </p>
                    <div className="relative">
                      <pre className="bg-[#10141f] p-2 rounded text-[10px] text-cyan-300 overflow-x-auto w-full select-all">
                        {`curl -X POST "${appOrigin}/api/agent/compile" \\
     ${authCurlHeader} \\
     -H "Content-Type: application/json" \\
     -d '{"workspace": {...}}'`}
                      </pre>
                      <button 
                        onClick={() => handleCopy(`curl -X POST "${appOrigin}/api/agent/compile" ${authCurlHeader} -H "Content-Type: application/json" -d '{"workspace": null}'`, 'curl_compile')}
                        className="absolute right-2 top-2 p-1 rounded bg-black/45 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        {copiedTextId === 'curl_compile' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* -----------------------------------------------------
            VIEW TAB: RAW STATE JSON VIEWER
            ----------------------------------------------------- */}
        {/* -----------------------------------------------------
            VIEW TAB: AGENT KEYS (B42 — named, scoped, expiring)
            ----------------------------------------------------- */}
        {activeTab === 'keys' && (
          <div className="space-y-4 font-sans text-slate-300 text-[11px]">
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 leading-relaxed">
              <h4 className="text-white font-bold mb-1 font-mono flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                AGENT KEYS
              </h4>
              <p className="text-slate-400">
                Issue a personal key per agent (Codex, Claude, a script) instead of sharing the studio
                session token. Keys are scoped, expire on the schedule you pick, and can be revoked
                one at a time. The key value is shown <span className="text-amber-300 font-bold">once</span> —
                only its hash is stored.
              </p>
            </div>

            {/* Create form */}
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 space-y-2">
              <div className="font-mono text-[10px] text-slate-400 font-bold">CREATE A KEY</div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  data-testid="agent-key-label"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Label (e.g. codex-agent)"
                  className="flex-1 min-w-[140px] bg-black/40 border border-white/10 rounded px-2 py-1.5 text-slate-200 font-mono text-[11px] outline-none focus:border-amber-500/50"
                />
                <select
                  data-testid="agent-key-scope"
                  value={newKeyScope}
                  onChange={(e) => setNewKeyScope(e.target.value as 'read' | 'write' | 'deploy')}
                  className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-slate-200 font-mono text-[11px] outline-none"
                  title="read = GET only · write = + workspace/compile/validate/package · deploy = full API power"
                >
                  <option value="read">scope: read</option>
                  <option value="write">scope: write</option>
                  <option value="deploy">scope: deploy</option>
                </select>
                <select
                  data-testid="agent-key-ttl"
                  value={newKeyTtl}
                  onChange={(e) => setNewKeyTtl(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-slate-200 font-mono text-[11px] outline-none"
                  title="How long the key stays valid"
                >
                  <option value="1h">expires: 1 hour</option>
                  <option value="24h">expires: 24 hours</option>
                  <option value="7d">expires: 7 days</option>
                  <option value="30d">expires: 30 days</option>
                  <option value="never">expires: never</option>
                </select>
                <button
                  data-testid="agent-key-create"
                  onClick={() => void createAgentKey()}
                  disabled={!newKeyLabel.trim()}
                  className="px-3 py-1.5 rounded font-mono text-[11px] font-bold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Generate
                </button>
              </div>
              <p className="text-slate-500 text-[10px]">
                read = inspect only · write = edit/compile/validate/package (no deploys, no spend) ·
                deploy = everything. Key management itself always requires the studio itself.
              </p>
            </div>

            {/* One-time reveal */}
            {createdKey && (
              <div data-testid="agent-key-reveal" className="rounded-lg bg-amber-500/10 border border-amber-500/40 p-3 space-y-2">
                <div className="font-mono text-[10px] text-amber-300 font-bold">
                  KEY FOR “{createdKey.label}” — COPY IT NOW, IT WILL NOT BE SHOWN AGAIN
                </div>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 break-all bg-black/50 rounded px-2 py-1.5 text-amber-200 font-mono text-[11px]">
                    {createdKey.token}
                  </code>
                  <button
                    onClick={() => { void navigator.clipboard?.writeText(createdKey.token); }}
                    className="px-2 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer"
                    title="Copy key"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-300" />
                  </button>
                  <button
                    onClick={() => setCreatedKey(null)}
                    className="px-2 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer"
                    title="Dismiss (key stays valid)"
                  >
                    <X className="w-3.5 h-3.5 text-slate-300" />
                  </button>
                </div>
                <p className="text-[10px] text-amber-200/70 font-mono">
                  Use: <code>Authorization: Bearer {'<key>'}</code> against this studio’s /api.
                </p>
              </div>
            )}

            {keysError && (
              <div className="rounded border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-2 font-mono text-[11px]">
                {keysError}
              </div>
            )}

            {/* Key table */}
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <div className="font-mono text-[10px] text-slate-400 font-bold mb-2">
                ISSUED KEYS ({agentKeys.length})
              </div>
              {agentKeys.length === 0 ? (
                <div className="text-slate-500">No agent keys yet — generate one above.</div>
              ) : (
                <div className="space-y-1.5" data-testid="agent-key-list">
                  {agentKeys.map((k) => {
                    const expired = k.expiresAt !== null && Date.now() >= k.expiresAt;
                    const dead = k.revokedAt !== null || expired;
                    return (
                      <div key={k.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded border px-2 py-1.5 font-mono text-[10px] ${dead ? 'border-white/5 bg-black/20 text-slate-600' : 'border-white/10 bg-black/30 text-slate-300'}`}>
                        <span className={`font-bold ${dead ? '' : 'text-white'}`}>{k.label}</span>
                        <span className={`px-1.5 rounded border ${k.scope === 'deploy' ? 'border-red-500/40 text-red-300' : k.scope === 'write' ? 'border-cyan-500/40 text-cyan-300' : 'border-emerald-500/40 text-emerald-300'}`}>{k.scope}</span>
                        <span>#{k.hashPrefix}</span>
                        <span>
                          {k.revokedAt !== null ? 'REVOKED'
                            : k.expiresAt === null ? 'never expires'
                            : `${expired ? 'EXPIRED' : 'expires'} ${new Date(k.expiresAt).toLocaleString()}`}
                        </span>
                        <span className="text-slate-500">
                          {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString()} · ${k.useCount}×` : 'never used'}
                        </span>
                        {!dead && (
                          <button
                            data-testid={`agent-key-revoke-${k.label}`}
                            onClick={() => void revokeAgentKey(k.id)}
                            className="ml-auto px-1.5 py-0.5 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 cursor-pointer flex items-center gap-1"
                            title="Revoke this key immediately"
                          >
                            <Trash2 className="w-3 h-3" /> revoke
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-900/60 border border-white/5 rounded-lg space-y-1 text-[11px] font-sans text-slate-400 leading-normal">
              <span className="font-bold text-slate-200 block uppercase font-mono text-[10px] tracking-wider">CURRENT ACTIVE BLUEPRINT SCHEMA</span>
              <p>
                This represents the active, synchronized JSON payload currently loaded inside the editor. Any adjustments are instantly reflected here.
              </p>
            </div>

            <div className="relative">
              <pre className="bg-[#05070a] border border-white/10 p-3.5 rounded-lg text-[10px] text-cyan-400 overflow-y-auto max-h-[360px] leading-relaxed">
                {JSON.stringify(workspace, null, 2)}
              </pre>
              <button 
                onClick={() => handleCopy(JSON.stringify(workspace, null, 2), 'raw_json')}
                className="absolute right-3 top-3 p-1.5 rounded bg-[#10141f] border border-white/10 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Copy entire JSON schema to clipboard"
              >
                {copiedTextId === 'raw_json' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-lg p-3 text-[10px] font-sans leading-relaxed text-slate-400">
              <div>
                <span className="font-bold text-slate-300 block mb-0.5 uppercase font-mono">DENSITY METRICS:</span>
                <p>Nodes: <span className="text-white font-bold">{workspace.nodes.length}</span></p>
                <p>Wires: <span className="text-white font-bold">{workspace.links.length}</span></p>
                <p>HUD Widgets: <span className="text-white font-bold">{workspace.uiWidgets.length}</span></p>
              </div>
              <button 
                onClick={() => {
                  const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${workspace.name || 'mod_workspace'}_manifest.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="px-2.5 py-1.5 bg-cyan-800/20 border border-cyan-500/30 text-cyan-400 rounded hover:bg-cyan-800/30 transition-all font-mono font-bold uppercase cursor-pointer"
              >
                Save JSON File
              </button>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------
            VIEW TAB: SURGICAL RUNTIME EXECUTE
            ----------------------------------------------------- */}
        {activeTab === 'execute' && (
          <div className="space-y-4 animate-fade-in font-mono">
            {/* Header / Intro */}
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg space-y-1 text-[11px] font-sans text-slate-300">
              <span className="font-bold text-emerald-400 block uppercase font-mono text-[10px] tracking-wider">⚡ SURGICAL RUNTIME EXECUTOR</span>
              <p className="leading-relaxed">
                Connect external digital copilots or run custom natural language commands to update workspace states surgically. Exposes <code className="text-emerald-300 font-mono bg-black/45 px-1 rounded">window.AgentRuntime</code> with full state manipulation capabilities.
              </p>
            </div>

            {/* Form Input for executing manual commands */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!consoleCommand.trim()) return;
                const res = runtimeExecute(consoleCommand);
                setConsoleLogs(prev => [
                  ...prev,
                  { text: `> ${consoleCommand}`, type: 'info' },
                  { text: res.message, type: res.success ? 'success' : 'error' }
                ]);
              }}
              className="bg-black/40 border border-white/5 rounded-lg p-3 space-y-2.5"
            >
              <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Enter Natural or Structured Command:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={consoleCommand}
                  onChange={(e) => setConsoleCommand(e.target.value)}
                  className="flex-1 bg-black/85 border border-[#10b981]/30 rounded p-2 text-[11px] text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
                  placeholder="e.g., set includeInBuild to false on widget win_threat_monitor"
                />
                <button
                  type="submit"
                  className="px-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold uppercase rounded flex items-center justify-center transition-all cursor-pointer text-[10px]"
                >
                  <Play className="w-3" />
                </button>
              </div>
            </form>

            {/* Structured Presets */}
            <div className="bg-black/30 border border-white/5 rounded-lg p-3 space-y-2">
              <span className="text-[9px] uppercase font-bold text-[#df9825] block tracking-wider">⚡ QUICK PRESETS (1-CLICK AGENT REPAIR):</span>
              
              <div className="space-y-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    const cmd = "disable includeInBuild on widgets";
                    const res = runtimeExecute(cmd);
                    setConsoleLogs(prev => [
                      ...prev,
                      { text: `> ${cmd}`, type: 'info' },
                      { text: res.message, type: res.success ? 'success' : 'error' }
                    ]);
                  }}
                  className="w-full text-left p-2 rounded bg-black/50 border border-[#df9825]/20 hover:bg-[#df9825]/10 text-slate-300 font-sans flex items-center justify-between group transition-all cursor-pointer"
                >
                  <span>🔧 Resolve Threat-Monitor Build Warnings</span>
                  <span className="text-[9px] font-mono text-[#df9825] opacity-80 uppercase font-bold tracking-wider group-hover:opacity-100">RUN MACRO →</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cmd = "set instantiate to true on node MyMissionCue";
                    const res = runtimeExecute(cmd);
                    setConsoleLogs(prev => [
                      ...prev,
                      { text: `> ${cmd}`, type: 'info' },
                      { text: res.message, type: res.success ? 'success' : 'error' }
                    ]);
                  }}
                  className="w-full text-left p-2 rounded bg-black/50 border border-cyan-500/10 hover:bg-cyan-500/10 text-slate-300 font-sans flex items-center justify-between group transition-all cursor-pointer"
                >
                  <span>⚡ Instantiate Mission Cue ('MyMissionCue')</span>
                  <span className="text-[9px] font-mono text-cyan-400 opacity-80 uppercase font-bold tracking-wider group-hover:opacity-100">RUN →</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cmd = "addNode show_notification at 250, 250";
                    const res = runtimeExecute(cmd);
                    setConsoleLogs(prev => [
                      ...prev,
                      { text: `> ${cmd}`, type: 'info' },
                      { text: res.message, type: res.success ? 'success' : 'error' }
                    ]);
                  }}
                  className="w-full text-left p-2 rounded bg-black/50 border border-purple-500/10 hover:bg-purple-500/10 text-slate-300 font-sans flex items-center justify-between group transition-all cursor-pointer"
                >
                  <span>➕ Spawn Notification visual action node</span>
                  <span className="text-[9px] font-mono text-purple-400 opacity-80 uppercase font-bold tracking-wider group-hover:opacity-100">SPAWN →</span>
                </button>
              </div>
            </div>

            {/* Execution Logger Console output */}
            <div className="bg-black/55 border border-white/10 rounded-lg overflow-hidden flex flex-col h-[200px]">
              <div className="bg-slate-900 border-b border-white/5 px-3 py-1.5 flex items-center justify-between text-[9px] tracking-wide text-slate-400 shrink-0 select-none">
                <span>SURGICAL CONSOLE LOGS</span>
                <button
                  type="button"
                  onClick={() => setConsoleLogs([{ text: "Console logs cleared.", type: 'info' }])}
                  className="hover:text-white uppercase transition-all cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>
              <div className="flex-1 p-3 overflow-y-auto space-y-1.5 text-[10px] leading-relaxed select-text font-mono">
                {consoleLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`${
                      log.type === 'success' 
                        ? 'text-emerald-400' 
                        : log.type === 'error' 
                        ? 'text-rose-450 font-bold' 
                        : log.type === 'info' 
                        ? 'text-slate-400' 
                        : 'text-slate-300'
                    }`}
                  >
                    {log.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Supported Commands Syntax Manual card */}
            <div className="bg-white/[0.01] border border-white/5 rounded-lg p-3 space-y-1 text-[9px] text-slate-500 uppercase tracking-widest leading-loose select-none">
              <span className="font-bold text-slate-400 block mb-0.5">SYNTAX CHEAT SHEET:</span>
              <p>• <code className="text-slate-300">updateWidget &lt;widget_id_or_label&gt; &lt;key&gt; &lt;val&gt;</code></p>
              <p>• <code className="text-slate-300">set &lt;key&gt; to &lt;val&gt; on widget &lt;widget_id_or_label&gt;</code></p>
              <p>• <code className="text-slate-300">updateNodeProperty &lt;node_id_or_name&gt; &lt;key&gt; &lt;val&gt;</code></p>
              <p>• <code className="text-slate-300">addNode &lt;xmlTag&gt; at &lt;x&gt;, &lt;y&gt;</code></p>
            </div>
          </div>
        )}

      </div>

      {/* Footer copyright */}
      <div className="bg-[#12161f] border-t border-white/5 p-3.5 text-center text-[10px] text-slate-500 font-mono">
        X4 Forge Developer Gateway
      </div>
      
    </div>
  );
}
