/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Startup walkaround card (beta-UX D1) — fetched once on app boot, shown when anything
 * deserves attention (never nags on an all-green environment), dismissible. The rows
 * come from GET /api/agent/health-card; plain English, action included in the detail.
 */

import React, { useEffect, useState } from 'react';
import { X, ClipboardCheck } from 'lucide-react';
import type { StudioLayoutPreferences } from '../lib/studioLayout';

interface HealthRow { id: string; label: string; status: 'pass' | 'warn' | 'fail' | 'unknown'; detail: string }
interface HealthCardData { rows: HealthRow[]; verdict: 'ready' | 'attention' | 'blocked'; summary: string; activeMod?: string | null }

type HealthCardOverlayProps = Pick<StudioLayoutPreferences, 'toolDock' | 'workspaceDock'>;

const HealthCardOverlay: React.FC<HealthCardOverlayProps> = ({ toolDock, workspaceDock }) => {
  const [card, setCard] = useState<HealthCardData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const res = await fetch('/api/agent/health-card');
        if (!res.ok || stopped) return;
        const data = await res.json();
        if (!stopped && data?.rows) setCard(data);
      } catch { /* server booting — skip silently */ }
    })();
    return () => { stopped = true; };
  }, []);

  // All green → no card at all (don't nag). Otherwise show until dismissed.
  if (!card || dismissed || card.verdict === 'ready') return null;

  const horizontalSafeArea = toolDock === 'right'
    ? 'right-16 w-[min(380px,calc(100vw-5rem))]'
    : 'right-4 w-[min(380px,calc(100vw-2rem))]';
  const verticalSafeArea = workspaceDock === 'bottom' ? 'bottom-16' : 'bottom-4';

  return (
    <div
      data-testid="health-card"
      className={`fixed ${verticalSafeArea} ${horizontalSafeArea} z-[90] rounded-xl border shadow-2xl bg-[#0a0d14]/97 backdrop-blur p-3 font-mono text-[10px] ${
        card.verdict === 'blocked' ? 'border-red-500/40' : 'border-amber-500/30'
      }`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <span className={`font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 ${card.verdict === 'blocked' ? 'text-red-300' : 'text-amber-300'}`}>
          <ClipboardCheck className="w-3.5 h-3.5" /> Startup walkaround
        </span>
        <button data-testid="health-card-dismiss" onClick={() => setDismissed(true)} className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="py-1.5 text-slate-300">{card.summary}</div>
      <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
        {card.rows.map(r => (
          <div key={r.id} className="grid grid-cols-[14px_128px_1fr] gap-1.5 items-start">
            <span className={
              r.status === 'pass' ? 'text-emerald-400' :
              r.status === 'warn' ? 'text-amber-400' :
              r.status === 'fail' ? 'text-red-400' : 'text-slate-600'
            }>
              {r.status === 'pass' ? '●' : r.status === 'warn' ? '▲' : r.status === 'fail' ? '✗' : '?'}
            </span>
            <span className="text-slate-300">{r.label}</span>
            <span className="text-slate-500 leading-tight" title={r.detail}>{r.detail.length > 110 ? r.detail.slice(0, 110) + '…' : r.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HealthCardOverlay;
