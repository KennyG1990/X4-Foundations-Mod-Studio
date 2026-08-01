/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Guided rail (BACKLOG B19 slice 1, Vision v2 Phase 1 keystone — 2026-07-11).
 *
 * The hand that DOESN'T let go: after a starter template/recipe loads, this rail
 * carries the newcomer through the three steps between "canvas has nodes" and
 * "I saw MY mod in MY game" — the exact stretch the old onboarding abandoned:
 *   ① TWEAK  — template-declared hint pointing at the one node worth changing.
 *   ② DEPLOY — the existing deploy-verify chain, result rendered in place.
 *   ③ SEE IT — live debug-watcher status + the template's "what to look for".
 * Dismissible at any step (veteran floor — never modal, never mandatory).
 */

import React, { useState } from 'react';
import { X, Wrench, Rocket, Gamepad2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { ModWorkspace } from '../types';
import type { RailGuide } from '../lib/modTemplates';
import { ttfm } from '../lib/ttfm';
import { toSafeModId } from '../lib/modCompiler';
import { fetchPollingJson } from '../lib/continuousPolling';
import { useContinuousPolling } from '../lib/useContinuousPolling';

interface GuidedRailProps {
  title: string;
  guide: RailGuide | null;      // null → generic hints (recipes without metadata)
  getWorkspace: () => ModWorkspace;
  onClose: () => void;
}

type DeployState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'ok'; detail: string }
  | { phase: 'fail'; detail: string };

const GuidedRail: React.FC<GuidedRailProps> = ({ title, guide, getWorkspace, onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [deploy, setDeploy] = useState<DeployState>({ phase: 'idle' });
  const [watcher, setWatcher] = useState<string>('Waiting for the game…');
  const activeModId = toSafeModId(getWorkspace().name);
  const watcherUrl = `/api/agent/debug-watcher/brief?modId=${encodeURIComponent(activeModId)}`;
  React.useLayoutEffect(() => {
    setWatcher(step === 3 ? 'Checking this mod in the game…' : 'Waiting for the game…');
  }, [activeModId, step]);
  // Step 3: subscribe to the same addressed watcher resource as App. The SERVER
  // computes the verdict — the rail renders it and guesses nothing.
  useContinuousPolling<{ verdict?: { state?: string; detail?: string; errorCount?: number } }>({
    enabled: step === 3,
    resourceKey: `debug-watcher-brief:${activeModId}`,
    contract: `GET ${watcherUrl}`,
    intervalMs: 5000,
    run: signal => fetchPollingJson(watcherUrl, undefined, signal),
    onResult: brief => {
      const verdict = brief?.verdict;
      if (!verdict?.state) { setWatcher('Log watcher unavailable (no verdict field — old API?).'); return; }
      if (verdict.state === 'loaded_clean') {
        if (ttfm.mark('game_confirmed')) {
          const total = ttfm.totalMs();
          if (total !== null) { setWatcher(`Your mod is IN THE GAME and clean (${Math.round(total / 60000)} min from first boot). ${guide?.gameCheck || ''}`); return; }
        }
        setWatcher('Mod loaded and clean. ' + (guide?.gameCheck || 'Load a save and watch for your change.'));
      } else if (verdict.state === 'loaded_with_errors') {
        setWatcher(`${verdict.detail} Check the canvas badges.`);
      } else {
        setWatcher(verdict.detail || 'Waiting for the game…');
      }
    },
    onError: () => setWatcher('Log watcher unavailable.'),
  });

  const runDeploy = async () => {
    setDeploy({ phase: 'running' });
    try {
      const res = await fetch('/api/agent/deploy-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: getWorkspace() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        ttfm.mark('first_deploy'); // B20 funnel stage
        setDeploy({ phase: 'ok', detail: `Deployed to ${data.deployedPath || data.stagingPath || 'the game'}.` });
        setStep(3);
      } else {
        const failed = (data.checklist || []).find((c: { status: string }) => c.status === 'fail');
        setDeploy({ phase: 'fail', detail: data.error || (failed ? `${failed.label}: ${failed.detail}` : 'Deploy failed.') });
      }
    } catch (e) {
      setDeploy({ phase: 'fail', detail: e instanceof Error ? e.message : 'Deploy failed (connection).' });
    }
  };

  const stepChip = (n: 1 | 2 | 3, icon: React.ReactNode, label: string) => (
    <button
      data-testid={`rail-step-${n}`}
      onClick={() => setStep(n)}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer ${
        step === n ? 'bg-cyan-600/40 text-cyan-100 border border-cyan-400/50' : 'bg-white/5 text-slate-400 border border-white/10 hover:border-cyan-500/30'
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    // z-[45]: above the radar minimap (z-40) — found overlapping in the 2026-07-11 visual
    // pass; the rail is the newcomer's active guide and dismissible, so it wins while open.
    // Stays below modals (z-50).
    <div data-testid="guided-rail" className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[45] w-[560px] max-w-[92%]">
      <div className="bg-[#0f131a]/97 border border-cyan-500/25 rounded-xl shadow-2xl glass-effect p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {stepChip(1, <Wrench size={11} />, '1 · Make it yours')}
            {stepChip(2, <Rocket size={11} />, '2 · Put it in the game')}
            {stepChip(3, <Gamepad2 size={11} />, '3 · See it')}
          </div>
          <button data-testid="rail-close" onClick={onClose} className="text-slate-500 hover:text-slate-300 cursor-pointer" aria-label="Dismiss guide">
            <X size={14} />
          </button>
        </div>

        {step === 1 && (
          <div className="text-[11px] text-slate-300 leading-relaxed" data-testid="rail-tweak">
            <span className="text-cyan-300 font-semibold">{title}</span> is a working mod already.{' '}
            {guide?.tweakHint || 'Click any node and change a property to make it yours.'}{' '}
            <button data-testid="rail-next" onClick={() => setStep(2)} className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200 cursor-pointer font-semibold">
              Done tweaking → deploy it
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="text-[11px] text-slate-300 leading-relaxed">
            {deploy.phase === 'idle' && (
              <>
                One click validates, compiles, and installs the mod into your game folder.{' '}
                <button data-testid="rail-deploy" onClick={runDeploy} className="ml-1 px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer">
                  Deploy to X4
                </button>
              </>
            )}
            {deploy.phase === 'running' && (
              <span className="inline-flex items-center gap-1.5 text-cyan-300"><Loader2 size={12} className="animate-spin" /> Validating and deploying…</span>
            )}
            {deploy.phase === 'ok' && (
              <span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle2 size={12} /> {deploy.detail}</span>
            )}
            {deploy.phase === 'fail' && (
              // B64-U2 (audit C-UX-2): a hard deploy FAILURE was styled text-amber-300 — the
              // same amber as warnings — so it read as a caution. Use error red (rose) to
              // distinguish failure from warning; the amber palette stays reserved for warnings.
              <span className="inline-flex items-start gap-1.5 text-rose-300">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {deploy.detail} — fix the highlighted issue and deploy again.
                <button onClick={runDeploy} className="text-cyan-300 underline underline-offset-2 cursor-pointer shrink-0">Retry</button>
              </span>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="text-[11px] text-slate-300 leading-relaxed" data-testid="rail-game">
            <div className="flex items-start gap-1.5">
              <Gamepad2 size={12} className="mt-0.5 shrink-0 text-cyan-300" />
              <span>{watcher}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuidedRail;
