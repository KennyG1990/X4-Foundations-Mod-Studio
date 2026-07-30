/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Brain, PackageCheck, Boxes } from 'lucide-react';
import { ModWorkspace, PackageDiagnostic } from '../types';
import { analyzeCueLineage } from '../lib/cueLineage';
import DiagnosticsHub from './DiagnosticsHub';
import PackageModDoctor from './PackageModDoctor';

/**
 * H7 — unified Diagnostics hub. One coherent home for the previously scattered
 * "MD Scanner" + "Mod Doctor" surfaces, organized by SCOPE rather than by tool
 * name:
 *   - Scripts  → Mission Director logic scan (was "MD Scanner")
 *   - Package  → this mod's build readiness + deterministic critic + selftests
 *   - Install  → cross-mod conflicts across the installed extensions (was the
 *                "Extension Doctor")
 * Editor-scope diagnostics (live per-node schema checks) live on the canvas.
 */
interface DiagnosticsCenterProps {
  workspace: ModWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ModWorkspace>>;
  saveCheckpoint?: (customTarget?: ModWorkspace) => void;
  modWorkspacePath: string;
  setWorkspaceView?: (view: any) => void;
  diagnostics: PackageDiagnostic[];
  diagnosticSource: 'checking' | 'project' | 'local';
  /** Jump to the Cues tab (the cue-health summary deep-links there). */
  onOpenCues?: () => void;
  /** A4.10 — gates the optional AI-polish affordance in the Scripts (MDScanner) view. */
  aiEnabled?: boolean;
  requestedScope?: DiagnosticsScope;
  onSuppressionCommitted?: (sourceHash: string) => void;
}

export type DiagnosticsScope = 'scripts' | 'package' | 'install';

const SCOPES: { id: DiagnosticsScope; label: string; icon: typeof Brain; activeClass: string }[] = [
  { id: 'scripts', label: 'Scripts', icon: Brain, activeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/40' },
  { id: 'package', label: 'Validation', icon: PackageCheck, activeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/40' },
  { id: 'install', label: 'Install', icon: Boxes, activeClass: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/40' },
];

export default function DiagnosticsCenter({
  workspace,
  setWorkspace,
  saveCheckpoint,
  modWorkspacePath,
  setWorkspaceView,
  diagnostics,
  diagnosticSource,
  onOpenCues,
  aiEnabled = false,
  requestedScope = 'scripts',
  onSuppressionCommitted,
}: DiagnosticsCenterProps) {
  const [scope, setScope] = useState<DiagnosticsScope>(requestedScope);

  useEffect(() => {
    setScope(requestedScope);
  }, [requestedScope]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#080a0e]">
      {/* Scope selector */}
      <div className="flex border-b border-white/5 bg-black/45 items-center gap-1.5 px-2 py-1.5 shrink-0 font-mono">
        {SCOPES.map(s => {
          const Icon = s.icon;
          const active = scope === s.id;
          return (
            <button
              key={s.id}
              data-testid={`diagnostics-scope-${s.id}`}
              aria-pressed={active}
              onClick={() => setScope(s.id)}
              title={`${s.label} Diagnostics`}
              className={`px-2.5 py-1 rounded text-[9.5px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                active ? s.activeClass : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
        <span className="ml-auto text-[8px] text-slate-500 uppercase tracking-wider pr-1">Editor checks → canvas</span>
      </div>

      {/* Scope viewport */}
      <div className="flex-1 overflow-hidden min-h-0">
        {scope === 'scripts' && (
          <DiagnosticsHub
            workspace={workspace}
            setWorkspace={setWorkspace}
            saveCheckpoint={saveCheckpoint}
            modWorkspacePath={modWorkspacePath}
            setWorkspaceView={setWorkspaceView}
            forceTab="analyzer"
            aiEnabled={aiEnabled}
          />
        )}

        {scope === 'package' && (
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {/* Cue health SUMMARY only — the full tree lives in the CUES tab. */}
            {(() => {
              const lf = analyzeCueLineage(workspace.nodes || [], workspace.links || []).findings;
              const errs = lf.filter(f => f.severity === 'error').length;
              const warns = lf.filter(f => f.severity === 'warning').length;
              return (
                <button
                  onClick={onOpenCues}
                  className={`mx-3 mt-3 shrink-0 flex items-center justify-between gap-2 rounded-lg border p-2.5 font-mono text-[10px] cursor-pointer transition-all hover:bg-white/5 ${
                    errs > 0 ? 'border-red-500/25 bg-red-500/5 text-red-300'
                      : warns > 0 ? 'border-amber-500/25 bg-amber-500/5 text-amber-300'
                        : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                  }`}
                  title="Open the cue tree (navigate, diagnose, bind live game log)"
                >
                  <span className="font-bold uppercase tracking-wide">Cue health</span>
                  <span>{errs > 0 || warns > 0 ? `${errs} error(s) · ${warns} warning(s)` : 'clean'} → Cues tab</span>
                </button>
              );
            })()}
            <div className="flex-1 min-h-0 overflow-hidden">
              <PackageModDoctor
                workspace={workspace}
                diagnostics={diagnostics}
                diagnosticSource={diagnosticSource}
                focus="package"
                onSuppressionCommitted={onSuppressionCommitted}
              />
            </div>
          </div>
        )}

        {scope === 'install' && (
          <PackageModDoctor
            workspace={workspace}
            diagnostics={diagnostics}
            diagnosticSource={diagnosticSource}
            focus="install"
            onSuppressionCommitted={onSuppressionCommitted}
          />
        )}
      </div>
    </div>
  );
}
