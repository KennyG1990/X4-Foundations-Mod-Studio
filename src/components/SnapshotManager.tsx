/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { confirmDialog } from '../lib/uiDialogs';
import {
  GitCommit,
  RotateCcw,
  Trash2,
  FileDiff,
  Plus,
  Calendar,
  Code2
} from 'lucide-react';
import { ModWorkspace } from '../types';
import { generateMDXML } from '../types';
import { toSafeModId } from '../lib/modCompiler';

interface Snapshot {
  id: string;
  name: string;
  timestamp: string;
  workspace: ModWorkspace;
}

interface SnapshotManagerProps {
  workspace: ModWorkspace;
  setWorkspace: (updater: ModWorkspace | ((prev: ModWorkspace) => ModWorkspace)) => void;
  saveCheckpoint: (customTarget?: ModWorkspace) => void;
  modWorkspacePath: string;
  onSelectSnapshot?: (snapWS: ModWorkspace | null) => void;
}

// Robust line-by-line Diff engine
interface DiffLine {
  type: 'addition' | 'deletion' | 'normal';
  value: string;
  num?: number;
}

function computeSimpleDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = (oldStr || '').split('\n');
  const newLines = (newStr || '').split('\n');
  
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i].trim() === newLines[j].trim()) {
      result.push({ type: 'normal', value: oldLines[i] });
      i++;
      j++;
    } else {
      let foundMatch = false;
      // Look ahead up to 10 lines to find aligned matching block (for modifications/additions/deletions)
      for (let offset = 1; offset <= 10; offset++) {
        if (i + offset < oldLines.length && oldLines[i + offset].trim() === newLines[j].trim()) {
          for (let k = 0; k < offset; k++) {
            result.push({ type: 'deletion', value: oldLines[i + k] });
          }
          i += offset;
          foundMatch = true;
          break;
        } else if (j + offset < newLines.length && oldLines[i].trim() === newLines[j + offset].trim()) {
          for (let k = 0; k < offset; k++) {
            result.push({ type: 'addition', value: newLines[j + k] });
          }
          j += offset;
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        if (i < oldLines.length && j < newLines.length) {
          result.push({ type: 'deletion', value: oldLines[i] });
          result.push({ type: 'addition', value: newLines[j] });
          i++;
          j++;
        } else if (i < oldLines.length) {
          result.push({ type: 'deletion', value: oldLines[i] });
          i++;
        } else if (j < newLines.length) {
          result.push({ type: 'addition', value: newLines[j] });
          j++;
        }
      }
    }
  }
  
  // Add 1-based indexing for line diagnostics
  return result.map((line, idx) => ({ ...line, num: idx + 1 }));
}

export default function SnapshotManager({
  workspace,
  setWorkspace,
  saveCheckpoint,
  modWorkspacePath,
  onSelectSnapshot
}: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'saves' | 'diff'>('saves');
  const [showFeedback, setShowFeedback] = useState<'saved' | 'restored' | null>(null);
  const [, setLoading] = useState<boolean>(false);

  const modId = useMemo(() => toSafeModId(workspace.name), [workspace.name]);

  // Load snapshots from staging directory on initialization/workspace change
  const fetchSnapshots = async () => {
    if (!modWorkspacePath) {
      setSnapshots([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/fs/snapshots?modId=${encodeURIComponent(modId)}`);
      if (response.ok) {
        const list = await response.json();
        setSnapshots(list);
      }
    } catch (e) {
      console.error("Failed to load snapshots from server:", e);
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
    setSelectedSnapshotId(null);
    if (onSelectSnapshot) {
      onSelectSnapshot(null);
    }
    // reason: fetchSnapshots is a non-memoized component-body function and onSelectSnapshot is a parent callback; the reset+refetch is intended only when the target mod (modWorkspacePath/modId) changes, and adding them risks a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modWorkspacePath, modId]);

  // Create a new snapshot of the current workspace state on the server
  const handleCreateSnapshot = async (customName?: string) => {
    if (!modWorkspacePath) return;
    const name = (customName || newSnapshotName || `Snapshot #${snapshots.length + 1}`).trim();
    try {
      const response = await fetch('/api/fs/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modId,
          workspace,
          name
        })
      });
      if (response.ok) {
        setNewSnapshotName('');
        setShowFeedback('saved');
        setTimeout(() => setShowFeedback(null), 2000);
        await fetchSnapshots();
      }
    } catch (e) {
      console.error("Failed to save snapshot on server:", e);
    }
  };

  // Roll back the active workspace to the selected snapshot
  const handleRestoreSnapshot = async (snap: Snapshot) => {
    if (!modWorkspacePath) return;
    // Capture current state in undo stack before rolling back
    saveCheckpoint();
    try {
      const currentWorkspaceResponse = await fetch('/api/agent/workspace');
      if (!currentWorkspaceResponse.ok) {
        console.error(`Failed to read current workspace before restoring snapshot (${currentWorkspaceResponse.status}).`);
        return;
      }
      const currentWorkspaceData: unknown = await currentWorkspaceResponse.json();
      if (!currentWorkspaceData || typeof currentWorkspaceData !== 'object') {
        console.error('Failed to restore snapshot: current workspace response was malformed.');
        return;
      }
      const currentWorkspaceRecord = currentWorkspaceData as {
        workspaceHash?: unknown;
        snapshotHash?: unknown;
      };
      if (
        typeof currentWorkspaceRecord.workspaceHash !== 'string'
        || currentWorkspaceRecord.workspaceHash.trim().length === 0
        || typeof currentWorkspaceRecord.snapshotHash !== 'string'
        || currentWorkspaceRecord.snapshotHash.trim().length === 0
      ) {
        console.error('Failed to restore snapshot: current workspace response did not include valid CAS hashes.');
        return;
      }

      const response = await fetch('/api/fs/restore-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modId,
          snapshotName: snap.id,
          expectedHead: currentWorkspaceRecord.workspaceHash,
          expectedSnapshotHash: currentWorkspaceRecord.snapshotHash
        })
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.workspace) {
          setWorkspace(resData.workspace);
          setShowFeedback('restored');
          setTimeout(() => setShowFeedback(null), 2000);
          if (onSelectSnapshot) {
            onSelectSnapshot(null);
          }
        }
      }
    } catch (err) {
      console.error("Failed to restore snapshot:", err);
    }
  };

  // Delete a snapshot from server
  const handleDeleteSnapshot = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!modWorkspacePath) return;
    try {
      const response = await fetch('/api/fs/delete-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modId,
          snapshotName: id
        })
      });
      if (response.ok) {
        await fetchSnapshots();
        if (selectedSnapshotId === id) {
          setSelectedSnapshotId(null);
          if (onSelectSnapshot) {
            onSelectSnapshot(null);
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete snapshot:", err);
    }
  };

  // Clear all checkpoints from server
  const handleClearAll = async () => {
    if (!modWorkspacePath) return;
    if (await confirmDialog("Are you sure you want to permanently clear all snapshots for this mod? This is irreversible.", { okLabel: 'Clear all', cancelLabel: 'Keep' })) {
      for (const snap of snapshots) {
        try {
          await fetch('/api/fs/delete-snapshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              modId,
              snapshotName: snap.id
            })
          });
        } catch {
          // ignore individual snapshot delete failures
        }
      }
      setSelectedSnapshotId(null);
      if (onSelectSnapshot) {
        onSelectSnapshot(null);
      }
      await fetchSnapshots();
    }
  };

  // Find currently selected snapshot
  const selectedSnapshot = useMemo(() => {
    return snapshots.find(s => s.id === selectedSnapshotId) || null;
  }, [snapshots, selectedSnapshotId]);

  // Propagate snapshot selection changes up to the parent application
  useEffect(() => {
    if (onSelectSnapshot) {
      onSelectSnapshot(selectedSnapshot ? selectedSnapshot.workspace : null);
    }
  }, [selectedSnapshot, onSelectSnapshot]);

  // Generate and compare XML structures between current workspace and selected snapshot
  const diffData = useMemo(() => {
    if (!selectedSnapshot) return null;
    
    try {
      const oldXml = generateMDXML(selectedSnapshot.workspace);
      const newXml = generateMDXML(workspace);
      
      const diffLines = computeSimpleDiff(oldXml, newXml);
      
      // Calculate structural statistics
      const oldNodesCount = selectedSnapshot.workspace.nodes.length;
      const newNodesCount = workspace.nodes.length;
      const oldWidgetsCount = selectedSnapshot.workspace.uiWidgets?.length || 0;
      const newWidgetsCount = workspace.uiWidgets?.length || 0;
      const oldPatchesCount = selectedSnapshot.workspace.xmlPatches?.length || 0;
      const newPatchesCount = workspace.xmlPatches?.length || 0;

      const additionsCount = diffLines.filter(l => l.type === 'addition').length;
      const deletionsCount = diffLines.filter(l => l.type === 'deletion').length;

      return {
        lines: diffLines,
        stats: {
          nodesDelta: newNodesCount - oldNodesCount,
          widgetsDelta: newWidgetsCount - oldWidgetsCount,
          patchesDelta: newPatchesCount - oldPatchesCount,
          additions: additionsCount,
          deletions: deletionsCount
        }
      };
    } catch (e) {
      return {
        lines: [{ type: 'normal', value: `Error generating diff comparison: ${String(e)}` }] as DiffLine[],
        stats: { nodesDelta: 0, widgetsDelta: 0, patchesDelta: 0, additions: 0, deletions: 0 }
      };
    }
  }, [workspace, selectedSnapshot]);

  return (
    <div className="border-t border-white/10 pt-4 space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          <GitCommit className="w-4 h-4" />
          Workspace Snapshots
        </h3>
        
        {snapshots.length > 0 && (
          <button 
            onClick={handleClearAll}
            className="text-[9px] text-red-400/80 hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Wipe
          </button>
        )}
      </div>

      {/* Snapshot operations feedback */}
      {showFeedback && (
        <div className={`p-2 rounded font-bold text-[10px] text-center transition-all ${
          showFeedback === 'saved' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
            : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
        }`}>
          {showFeedback === 'saved' ? "✓ Snapshot captured successfully!" : "✓ Workspace rolled back to old instance version!"}
        </div>
      )}

      {/* Create New Snapshot Form */}
      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          value={newSnapshotName}
          onChange={e => setNewSnapshotName(e.target.value)}
          placeholder="New milestone name..."
          className="flex-1 p-1 px-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500 transition-colors text-[10px]"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleCreateSnapshot();
            }
          }}
        />
        <button
          onClick={() => handleCreateSnapshot()}
          className="p-1 px-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
          title="Take manual milestone snapshot"
        >
          <Plus className="w-3.5 h-3.5" />
          Snap
        </button>
      </div>

      {snapshots.length === 0 ? (
        <div className="p-4 rounded-lg bg-black/20 border border-white/5 border-dashed text-center text-slate-500 italic text-[10px]">
          No checkpoints saved for mod "{workspace.name}". Capture snapshots above to prevent version derailments.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Sub tabs: Milestones List vs active Snapshot XML Diff */}
          <div className="flex border-b border-white/10 text-[9px] font-bold uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('saves')}
              className={`flex-1 py-1 text-center border-b-2 transition-all ${
                activeTab === 'saves' 
                  ? 'border-cyan-500 text-white bg-white/5' 
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Checkpoints ({snapshots.length})
            </button>
            <button
              onClick={() => {
                if (!selectedSnapshotId) {
                  setSelectedSnapshotId(snapshots[0]?.id || null);
                }
                setActiveTab('diff');
              }}
              className={`flex-1 py-1 text-center border-b-2 transition-all flex items-center justify-center gap-1 ${
                activeTab === 'diff' 
                  ? 'border-cyan-500 text-white bg-white/5' 
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <FileDiff className="w-3.5 h-3.5" />
              Diff Changes
            </button>
          </div>

          {activeTab === 'saves' ? (
            <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1 p-0.5">
              {snapshots.map(snap => {
                const isSelected = selectedSnapshotId === snap.id;
                const nodeCount = snap.workspace.nodes.length;
                const widgetCount = snap.workspace.uiWidgets?.length || 0;
                
                return (
                  <div
                    key={snap.id}
                    onClick={() => {
                      setSelectedSnapshotId(snap.id);
                      setActiveTab('diff'); // Switch to view diff on select!
                    }}
                    className={`p-2 rounded border transition-all cursor-pointer text-[10px] flex items-center justify-between gap-2 ${
                      isSelected 
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white' 
                        : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/10 hover:bg-black/45'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-white truncate text-[10.5px]">{snap.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[8px] text-slate-500">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {snap.timestamp}
                        </span>
                        <span>•</span>
                        <span>{nodeCount} Nodes</span>
                        {widgetCount > 0 && (
                          <>
                            <span>•</span>
                            <span>{widgetCount} Widgets</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreSnapshot(snap);
                        }}
                        className="px-1.5 py-0.5 bg-cyan-900/45 hover:bg-cyan-600 border border-cyan-500/30 text-cyan-300 hover:text-white rounded text-[8.5px] font-bold flex items-center gap-0.5 transition-all"
                        title="Rollback active workspace to this version index"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        Restore
                      </button>
                      <button
                        onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                        className="p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors"
                        title="Delete checkpoint"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // XML DIFF SCREEN
            <div className="space-y-2">
              {!selectedSnapshot ? (
                <div className="p-4 text-center text-slate-500 italic text-[10px]">
                  Select a checkpoint from the list to compute file-level diff diagnostics.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Comparing active workspace vs:</span>
                    <select
                      value={selectedSnapshotId || ''}
                      onChange={e => setSelectedSnapshotId(e.target.value)}
                      className="bg-black border border-white/10 text-white rounded p-1 font-mono text-[9px] max-w-[200px]"
                    >
                      {snapshots.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.timestamp.slice(0, 8)})</option>
                      ))}
                    </select>
                  </div>

                  {/* Summary of Delta changes */}
                  {diffData && (
                    <div className="grid grid-cols-2 gap-1 p-2 bg-black/40 border border-white/5 rounded text-[8px] leading-normal font-sans">
                      <div className="space-y-1">
                        <div className="text-slate-400 font-bold uppercase tracking-wide">Flowchart Deltas</div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Nodes:</span>
                          <span className={diffData.stats.nodesDelta > 0 ? 'text-emerald-400' : diffData.stats.nodesDelta < 0 ? 'text-red-400' : 'text-slate-300'}>
                            {diffData.stats.nodesDelta > 0 ? `+${diffData.stats.nodesDelta}` : diffData.stats.nodesDelta}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Widgets:</span>
                          <span className={diffData.stats.widgetsDelta > 0 ? 'text-emerald-400' : diffData.stats.widgetsDelta < 0 ? 'text-red-400' : 'text-slate-300'}>
                            {diffData.stats.widgetsDelta > 0 ? `+${diffData.stats.widgetsDelta}` : diffData.stats.widgetsDelta}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">XML Patches:</span>
                          <span className={diffData.stats.patchesDelta > 0 ? 'text-emerald-400' : diffData.stats.patchesDelta < 0 ? 'text-red-400' : 'text-slate-300'}>
                            {diffData.stats.patchesDelta > 0 ? `+${diffData.stats.patchesDelta}` : diffData.stats.patchesDelta}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 border-l border-white/10 pl-2">
                        <div className="text-slate-400 font-bold uppercase tracking-wide">XML Line Changes</div>
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <span className="bg-emerald-500/15 p-0.5 rounded px-1">+{diffData.stats.additions} lines added</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-red-400">
                          <span className="bg-red-500/15 p-0.5 rounded px-1">-{diffData.stats.deletions} lines deleted</span>
                        </div>
                        <button
                          onClick={() => handleRestoreSnapshot(selectedSnapshot)}
                          className="w-full mt-1.5 p-1 bg-cyan-900 border border-cyan-600/30 text-white rounded text-[8px] font-bold hover:bg-cyan-600 transition-colors cursor-pointer flex items-center justify-center gap-1 uppercase"
                        >
                          <RotateCcw className="w-2 h-2" />
                          Rollback workspace
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Micro XML code Diff viewer */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Code2 className="w-3 h-3 text-cyan-400" />
                      Lines Comparison (md/{modId}.xml)
                    </span>
                    
                    <div className="border border-white/10 rounded overflow-hidden max-h-60 bg-[#080a0f] text-[9.5px]">
                      <div className="overflow-auto custom-scrollbar h-52 font-mono scroll-smooth select-text leading-tight p-2 space-y-0.5">
                        {diffData && diffData.lines.map((line) => {
                          let lineClass = 'text-slate-400/85';
                          let prefix = ' ';
                          if (line.type === 'addition') {
                            lineClass = 'bg-emerald-500/10 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-0.5';
                            prefix = '+';
                          } else if (line.type === 'deletion') {
                            lineClass = 'bg-red-500/10 text-red-400 font-bold border-l-2 border-red-500 pl-0.5 line-through';
                            prefix = '-';
                          }
                          
                          return (
                            <div key={line.num} className={`flex ${lineClass} whitespace-pre`}>
                              <span className="opacity-25 w-8 select-none text-right pr-2 shrink-0">{line.num}</span>
                              <span className="opacity-45 select-none w-3 shrink-0">{prefix}</span>
                              <span className="flex-1 break-all select-all font-semibold font-mono">{line.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
