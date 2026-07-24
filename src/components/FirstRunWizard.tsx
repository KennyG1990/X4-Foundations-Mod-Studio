/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * First-run setup wizard (BACKLOG B18, Vision v2 Phase 1 — 2026-07-11).
 *
 * The "first five minutes" front door: when the Forge boots unconfigured, this
 * offers one-click setup — detect the X4 install (Steam registry/VDF, GOG),
 * harvest the schemas straight out of the game's archives, and apply the whole
 * five-path config through the EXISTING POST /api/schema/config (the same
 * user-confirmed path the settings modal uses). Manual setup stays one click
 * away at every step (veteran floor — nothing is ever autodetect-only).
 *
 * TTFM note (B20): this surface is the funnel's "paths configured" stage.
 */

import React, { useEffect, useState } from 'react';
import { Rocket, Search, FolderCog, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { ttfm } from '../lib/ttfm';

interface DetectResult {
  found: boolean;
  source?: string;
  gameDir?: string;
  canHarvestSchemas?: boolean;
  hint?: string;
  proposal?: {
    x4GamePath: string;
    filesystemPath: string;
    modWorkspacePath: string;
    xsdSchemaPath: string;
  } | null;
}

interface FirstRunWizardProps {
  onClose: () => void;
  /** Open the DirectorySettingsModal for manual setup. */
  onOpenManualSetup: () => void;
  /** Config applied successfully — parent refreshes schema state. */
  onApplied: () => void;
}

type Phase = 'scanning' | 'found' | 'notfound' | 'applying' | 'done' | 'error';

const FirstRunWizard: React.FC<FirstRunWizardProps> = ({ onClose, onOpenManualSetup, onApplied }) => {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [applyStep, setApplyStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agent/detect-game');
        const data: DetectResult = await res.json();
        if (cancelled) return;
        if (res.ok && data.found && data.proposal) { setDetect(data); setPhase('found'); }
        else { setDetect(data); setPhase('notfound'); }
      } catch {
        if (!cancelled) setPhase('notfound');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const applyAutomatic = async () => {
    if (!detect?.proposal) return;
    const p = detect.proposal;
    setPhase('applying');
    try {
      setApplyStep('Extracting the game’s schema files…');
      const harvestRes = await fetch('/api/agent/setup/harvest-schemas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x4GamePath: p.x4GamePath }),
      });
      const harvest = await harvestRes.json();
      if (!harvestRes.ok || !harvest.ok) throw new Error(harvest.error || 'Schema extraction failed.');

      setApplyStep('Saving configuration…');
      const cfgRes = await fetch('/api/schema/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaDir: harvest.dir,
          x4GamePath: p.x4GamePath,
          modWorkspacePath: p.modWorkspacePath,
          filesystemPath: p.filesystemPath,
        }),
      });
      const cfg = await cfgRes.json();
      if (!cfgRes.ok || !cfg.success) throw new Error(cfg.error || 'Saving the configuration failed.');
      ttfm.mark('paths_configured'); // B20 funnel stage
      setPhase('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Automatic setup failed.');
      setPhase('error');
    }
  };

  const row = (label: string, value: string) => (
    <div className="flex items-baseline gap-2 text-[11px]">
      <span className="text-slate-500 w-28 shrink-0 text-right">{label}</span>
      <span className="text-slate-200 font-mono break-all">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] max-w-[90%] bg-[#0f131a]/97 border border-cyan-500/25 rounded-xl shadow-2xl glass-effect p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Rocket size={18} className="text-cyan-300" />
          <div className="text-white font-bold text-sm tracking-wide flex-1">Welcome to X4 Forge</div>
          {/* 2026-07-11 visual pass: the found-state trapped look-around users between two
              commitments — every phase except mid-apply is dismissible. */}
          {phase !== 'applying' && (
            <button onClick={onClose} aria-label="Dismiss setup" className="text-slate-500 hover:text-slate-300 cursor-pointer text-sm leading-none">✕</button>
          )}
        </div>
        <div className="text-slate-400 text-[11px] mb-4 leading-relaxed">
          The Forge needs to know where X4: Foundations lives. It can find everything itself — nothing is
          saved until you confirm.
        </div>

        {phase === 'scanning' && (
          <div className="flex items-center gap-2 text-cyan-300 text-xs py-6 justify-center">
            <Loader2 size={14} className="animate-spin" /> Scanning for your X4 installation…
          </div>
        )}

        {phase === 'found' && detect?.proposal && (
          <>
            <div className="flex items-center gap-2 text-emerald-300 text-xs mb-3">
              <CheckCircle2 size={14} />
              Found X4: Foundations ({detect.source === 'gog' ? 'GOG' : 'Steam'})
              {detect.canHarvestSchemas === false && (
                <span className="text-amber-300 ml-1">— but its schema archives were unreadable</span>
              )}
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 space-y-1.5 mb-4">
              {row('Game', detect.proposal.x4GamePath)}
              {row('Dev workspace', detect.proposal.modWorkspacePath)}
              {row('File explorer', detect.proposal.filesystemPath)}
              {row('Deploy target', `${detect.proposal.x4GamePath}\\extensions (only when you choose Deploy)`)}
              {row('Schemas', `${detect.proposal.xsdSchemaPath} (extracted from the game)`)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyAutomatic}
                disabled={detect.canHarvestSchemas === false}
                className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Set up automatically
              </button>
              <button
                onClick={() => { onClose(); onOpenManualSetup(); }}
                className="px-4 py-2 rounded-lg border border-white/15 text-slate-300 hover:border-cyan-500/40 text-xs transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5"><FolderCog size={12} /> Manual setup</span>
              </button>
            </div>
          </>
        )}

        {phase === 'notfound' && (
          <>
            <div className="flex items-center gap-2 text-amber-300 text-xs mb-3">
              <AlertTriangle size={14} /> {detect?.hint || 'No X4: Foundations install was found automatically.'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { onClose(); onOpenManualSetup(); }}
                className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5 justify-center"><FolderCog size={12} /> Set up manually</span>
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/15 text-slate-300 text-xs cursor-pointer">
                Later
              </button>
            </div>
          </>
        )}

        {phase === 'applying' && (
          <div className="flex items-center gap-2 text-cyan-300 text-xs py-6 justify-center">
            <Loader2 size={14} className="animate-spin" /> {applyStep}
          </div>
        )}

        {phase === 'done' && (
          <>
            <div className="flex items-center gap-2 text-emerald-300 text-xs mb-4">
              <CheckCircle2 size={14} /> You&rsquo;re set up. The canvas is ready — pick a starter mod and it
              will run in your game.
            </div>
            <button
              onClick={() => { onApplied(); onClose(); }}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Start building
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="flex items-center gap-2 text-red-300 text-xs mb-3">
              <AlertTriangle size={14} /> {errorMsg}
            </div>
            <div className="flex gap-2">
              <button onClick={applyAutomatic} className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer">
                <span className="inline-flex items-center gap-1.5 justify-center"><Search size={12} /> Try again</span>
              </button>
              <button
                onClick={() => { onClose(); onOpenManualSetup(); }}
                className="px-4 py-2 rounded-lg border border-white/15 text-slate-300 hover:border-cyan-500/40 text-xs cursor-pointer"
              >
                Manual setup
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FirstRunWizard;
