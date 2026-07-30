/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Brain, Terminal, RefreshCw } from 'lucide-react';
import { ModWorkspace } from '../types';
import { getAIHeaders, handleApiResponse } from '../lib/apiHelper';
import { toSafeModId } from '../lib/modCompiler';
import MDScanner from './MDScanner';
import PlaytestWorkspace from './PlaytestWorkspace';
import type { ReleasePreferences } from '../lib/releasePreferences';

interface DiagnosticsHubProps {
  workspace: ModWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ModWorkspace>>;
  saveCheckpoint?: (customTarget?: ModWorkspace) => void;
  modWorkspacePath: string;
  setWorkspaceView?: (view: any) => void;
  forceTab?: 'analyzer' | 'playtest';
  /** A4.10 — gates the optional AI-polish affordance inside MDScanner. */
  aiEnabled?: boolean;
  releasePreferences?: ReleasePreferences;
}

/**
 * Self-contained MD Scanner + Playtest Workspace hub.
 * Owns its own analyze / log-analysis / sync / auto-fix state so it can live in the
 * left sidebar independently of the right-hand code viewer.
 */
export default function DiagnosticsHub({
  workspace,
  setWorkspace,
  saveCheckpoint,
  modWorkspacePath,
  forceTab,
  aiEnabled = false,
  releasePreferences,
}: DiagnosticsHubProps) {
  const [toolActiveTab, setToolActiveTab] = useState<'analyzer' | 'playtest'>('analyzer');

  const currentTab = forceTab || toolActiveTab;

  // Cognitive analyzer state
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastAnalyzedWorkspace, setLastAnalyzedWorkspace] = useState<string>('');
  const analysisAbortRef = React.useRef<AbortController | null>(null);

  // Playtest / sync state
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncErrorMsg, setSyncErrorMsg] = useState<string>('');
  
  // Log analysis state
  const [logInput, setLogInput] = useState<string>('');
  const [diagnosingLogs, setDiagnosingLogs] = useState<boolean>(false);
  const [logAnalysis, setLogAnalysis] = useState<any>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [successfulFixApplied, setSuccessfulFixApplied] = useState<string | null>(null);

  const workspaceSerialized = JSON.stringify(workspace);
  const isAnalysisStale = analysisResult !== null && lastAnalyzedWorkspace !== workspaceSerialized;

  const triggerAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({ workspace }),
        signal: controller.signal
      });
      const data = await handleApiResponse(response, 'Failed to establish telemetry connection to server.');
      setAnalysisResult(data.analysis);
      setLastAnalyzedWorkspace(workspaceSerialized);
    } catch (err) {
      if (err?.name === 'AbortError') {
        setAnalysisError('Analysis cancelled.');
      } else {
        console.error(err);
        setAnalysisError(err.message || 'Failed to catalog script outline. Verify telemetry status.');
      }
    } finally {
      analysisAbortRef.current = null;
      setAnalyzing(false);
    }
  };

  const cancelAnalysis = () => {
    analysisAbortRef.current?.abort();
  };

  const saveToDirectory = async (showFeedback: boolean) => {
    if (!modWorkspacePath) return;
    if (showFeedback) setSyncStatus('syncing');
    try {
      // Audit R4: deploy-verify (full 9-stage preflight) replaces the deprecated /deploy.
      const deployRes = await fetch('/api/agent/deploy-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace })
      });
      const deployData = await deployRes.json();
      if (deployRes.ok && deployData.ok) {
        if (showFeedback) {
          setSyncStatus('success');
          setTimeout(() => setSyncStatus('idle'), 2000);
        }
      } else {
        const failed = (deployData.checklist || []).find((c: { status: string }) => c.status === 'fail');
        throw new Error(deployData.error || (failed ? `${failed.label}: ${failed.detail}` : 'Failed to deploy on server.'));
      }
    } catch (err) {
      console.error('Playtest Directory Sync Error:', err);
      if (showFeedback) {
        setSyncStatus('error');
        setSyncErrorMsg(err.message || 'Disk write access refused.');
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    }
  };

  const handleTriggerLogAnalysis = async () => {
    if (!logInput.trim()) return;
    setDiagnosingLogs(true);
    setDiagnosticError(null);
    try {
      const response = await fetch('/api/gemini/analyze-log', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({ workspace, logs: logInput })
      });
      const data = await handleApiResponse(response, 'Log parsing request rejected.');
      setLogAnalysis(data.analysis);
    } catch (err) {
      console.error(err);
      setDiagnosticError(err.message || 'Failed to analyze X4 script logs.');
    } finally {
      setDiagnosingLogs(false);
    }
  };

  const handleApplyAutoFix = (fix: any) => {
    if (!setWorkspace || !saveCheckpoint) return;
    if (fix.type === 'update_node_property' && fix.nodeId && fix.propertyKey) {
      saveCheckpoint();
      setWorkspace(prev => ({
        ...prev,
        nodes: prev.nodes.map(n =>
          n.id === fix.nodeId
            ? { ...n, properties: { ...n.properties, [fix.propertyKey]: fix.propertyValue } }
            : n
        )
      }));
      setSuccessfulFixApplied(`Successfully repaired property '${fix.propertyKey}' to '${fix.propertyValue}'!`);
      setTimeout(() => setSuccessfulFixApplied(null), 4000);
      if (logAnalysis) {
        setLogAnalysis((prev: any) => {
          if (!prev) return null;
          return {
            ...prev,
            issues: prev.issues.filter((issue: any) => issue.autoFix?.nodeId !== fix.nodeId || issue.autoFix?.propertyKey !== fix.propertyKey)
          };
        });
      }
    }
  };

  const insertDemoX4Log = () => {
    // Use OBVIOUSLY-FAKE identifiers (not the user's real mod/cue names) and a loud banner,
    // so this sample can never be mistaken for real X4 output. (Interpolating the real
    // workspace.name + first cue name made the demo look like genuine errors against the
    // user's own mod — a real source of confusion.)
    const demoText = `### ====================================================================
### SAMPLE / DEMO LOG — this is EXAMPLE text to show the parser format.
### It is NOT from your game and contains NO real errors about your mod.
### Use "Browse debug.log" or the auto-watcher to see your actual X4 log.
### ====================================================================
[General] 0000.00: ==========================================
[General] 0000.00: X4: Foundations vX.XX (000000)
[General] 0000.00: Command Line: -debug all -logfile uidata.log -reloaddirector
[General] 0000.00: ==========================================
[MD Engine] Error: Parsing XML file extensions\\Demo_Sample_Mod\\md\\demo_sample_mod.xml
*** Context:md.Demo_Sample_Cue: cue has active state but 'instantiate' attribute is currently 'false'. Re-instantiation will fail on game reloads!
[MD Engine] Warning: Property 'faction' has unrecognized faction code 'DEMO_FACTION' in cue 'Demo_Sample_Cue'. X4 standard code is 'argon'.`;
    setLogInput(demoText);
  };

  const handleLogFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => setLogInput((evt.target?.result as string) || '');
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#080a0e]">
      {/* Segmented tab header */}
      {!forceTab ? (
        <div className="flex border-b border-white/5 bg-black/45 items-center gap-1.5 px-2 py-1.5 shrink-0 font-mono">
          <button
            onClick={() => setToolActiveTab('analyzer')}
            className={`px-2.5 py-1 rounded text-[9.5px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              toolActiveTab === 'analyzer'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-amber-500" />
            MD Scanner
          </button>
          <button
            onClick={() => setToolActiveTab('playtest')}
            className={`px-2.5 py-1 rounded text-[9.5px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              toolActiveTab === 'playtest'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            Playtest
          </button>
          {toolActiveTab === 'analyzer' && analysisResult && (
            <button
              onClick={triggerAnalysis}
              disabled={analyzing}
              className="ml-auto px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 rounded text-[9px] flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer font-bold uppercase"
              title="Re-run analysis"
            >
              <RefreshCw className={`w-3 h-3 ${analyzing ? 'animate-spin' : ''}`} />
              Analyze
            </button>
          )}
        </div>
      ) : (
        forceTab === 'analyzer' && analysisResult && (
          <div className="flex bg-[#12141a]/40 border-b border-white/5 justify-end px-3 py-1.5 shrink-0">
            <button
              onClick={triggerAnalysis}
              disabled={analyzing}
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-505 rounded text-[9.5px] flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer font-bold uppercase font-mono"
              title="Re-run analysis"
            >
              <RefreshCw className={`w-3 h-3 ${analyzing ? 'animate-spin' : ''}`} />
              Re-Analyze
            </button>
          </div>
        )
      )}

      {/* Panel viewport */}
      <div className="flex-1 overflow-y-auto bg-[#06070a]/95 min-h-0">
        {currentTab === 'analyzer' ? (
          <MDScanner
            workspace={workspace}
            analysisResult={analysisResult}
            analyzing={analyzing}
            analysisError={analysisError}
            triggerAnalysis={triggerAnalysis}
            isAnalysisStale={isAnalysisStale}
            cancelAnalysis={cancelAnalysis}
            aiEnabled={aiEnabled}
          />
        ) : (
          <PlaytestWorkspace
            workspace={workspace}
            activeModId={toSafeModId(workspace.name)}
            modWorkspacePath={modWorkspacePath}
            releasePreferences={releasePreferences}
            syncStatus={syncStatus}
            syncErrorMsg={syncErrorMsg}
            saveToDirectory={saveToDirectory}
            logInput={logInput}
            setLogInput={setLogInput}
            diagnosingLogs={diagnosingLogs}
            logAnalysis={logAnalysis}
            diagnosticError={diagnosticError}
            successfulFixApplied={successfulFixApplied}
            handleTriggerLogAnalysis={handleTriggerLogAnalysis}
            insertDemoX4Log={insertDemoX4Log}
            handleLogFileChange={handleLogFileChange}
            handleApplyAutoFix={handleApplyAutoFix}
          />
        )}
      </div>
    </div>
  );
}
