/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  PackageCheck,
  Scroll,
  Layers,
  Brain,
  Database,
  Globe,
  FileCode,
  Wrench,
  CheckCircle,
  Folder,
  CheckSquare,
  Square
} from 'lucide-react';
import { ModWorkspace } from '../types';

export interface DeployChecklistRow {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'skipped';
  detail: string;
}

interface CompileConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  workspace: ModWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ModWorkspace>>;
  modWorkspacePath?: string;
  /** BACKLOG B7: live deploy-verify feedback rendered IN the wizard (was hidden in Playtest). */
  compileStatus?: 'idle' | 'compiling' | 'success' | 'error';
  compileMessage?: string;
  checklist?: DeployChecklistRow[];
}

const CHECK_COLORS: Record<DeployChecklistRow['status'], string> = {
  pass: 'text-emerald-400',
  warn: 'text-amber-400',
  fail: 'text-red-400',
  skipped: 'text-slate-600',
};
const CHECK_GLYPH: Record<DeployChecklistRow['status'], string> = {
  pass: '✓', warn: '!', fail: '✗', skipped: '·',
};

export default function CompileConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  workspace,
  setWorkspace,
  modWorkspacePath,
  compileStatus = 'idle',
  compileMessage = '',
  checklist = []
}: CompileConfirmationModalProps) {
  // B84: the deploy FORMAT toggle. Hooks must sit above the `isOpen` early return.
  // The value is server-persisted config, not workspace state, so every deploy surface
  // (wizard, IDE, agent API) agrees on one answer.
  const [deployFormat, setDeployFormat] = React.useState<'loose' | 'catalog' | null>(null);
  const [formatBusy, setFormatBusy] = React.useState(false);
  const [formatError, setFormatError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/schema/config');
        const data = await res.json();
        if (!cancelled && data?.deployFormat?.format) setDeployFormat(data.deployFormat.format);
      } catch {
        // A read failure leaves the toggle in its unknown state rather than asserting a
        // format the server may not agree with.
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const chooseDeployFormat = async (next: 'loose' | 'catalog') => {
    if (next === deployFormat || formatBusy) return;
    setFormatBusy(true);
    setFormatError('');
    const previous = deployFormat;
    setDeployFormat(next);
    try {
      const res = await fetch('/api/schema/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deployFormat: next }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || `Save failed (${res.status})`);
    } catch (error) {
      // Never leave the toggle showing a preference the server did not store.
      setDeployFormat(previous);
      setFormatError(error instanceof Error ? error.message : 'Could not save the deploy format.');
    } finally {
      setFormatBusy(false);
    }
  };

  if (!isOpen) return null;

  const compileSettings = workspace.compileSettings || {
    md: true,
    ui: true,
    ai: true,
    library: true,
    translations: true,
    patches: true
  };

  const handleToggleSetting = (key: keyof NonNullable<ModWorkspace['compileSettings']>) => {
    setWorkspace(prev => ({
      ...prev,
      compileSettings: {
        ...compileSettings,
        [key]: !compileSettings[key]
      }
    }));
  };

  const handleSelectAll = (select: boolean) => {
    setWorkspace(prev => ({
      ...prev,
      compileSettings: {
        md: select,
        ui: select,
        ai: select,
        library: select,
        translations: select,
        patches: select
      }
    }));
  };

  // Human-readable titles, icons, and descriptions for each of the 6 targets
  const targets = [
    {
      key: 'md' as const,
      title: 'MD Scripts',
      desc: 'Generates Mission Director visual logic nodes, events, conditions, actions, and cues.',
      icon: <Scroll className="w-4 h-4 text-emerald-400" />
    },
    {
      key: 'ui' as const,
      title: 'HUD & LUA UI',
      desc: 'Builds customized layout widget menus, in-game canvas HUD items, text prompts, and lua binds.',
      icon: <Layers className="w-4 h-4 text-cyan-400" />
    },
    {
      key: 'ai' as const,
      title: 'AI Behaviors',
      desc: 'Compiles custom ship commands, tactical behaviors, trade routes, and automated job loops.',
      icon: <Brain className="w-4 h-4 text-fuchsia-400" />
    },
    {
      key: 'library' as const,
      title: 'Wares & Jobs',
      desc: 'Assembles XML files for economy items, production blueprints, job quotas, and ship spawners.',
      icon: <Database className="w-4 h-4 text-blue-400" />
    },
    {
      key: 'translations' as const,
      title: 'T Languages',
      desc: 'Creates standard multi-lingual t/ tables for localized names, descriptions, and voice triggers.',
      icon: <Globe className="w-4 h-4 text-amber-400" />
    },
    {
      key: 'patches' as const,
      title: 'XML Patching',
      desc: 'Produces diff-based add/replace/remove patch node sets to safely adapt vanilla source files.',
      icon: <FileCode className="w-4 h-4 text-purple-400" />
    }
  ];

  const selectedCount = Object.values(compileSettings).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md transition-all duration-200"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-h-[90vh] flex flex-col bg-[#0b0e14] border border-emerald-500/25 rounded-xl shadow-2xl shadow-emerald-950/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header wrapper block */}
        <div className="p-4 border-b border-white/5 bg-[#0e121a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <PackageCheck className="w-5 h-5 text-emerald-400 flex shrink-0" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-white text-xs uppercase tracking-wider">
                Compile &amp; Deploy Wizard
              </h2>
              <p className="text-[10px] text-slate-400 font-sans">
                Review and selectively compile elements of your active workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Cancel and close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info panel context line */}
        <div className="px-4 py-2 border-b border-white/5 bg-slate-900/30 flex items-center justify-between text-[10px] font-mono select-none">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Folder className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-white font-semibold truncate max-w-[280px]">
              {workspace.name || 'Untitled_Mod'}
            </span>
            <span className="text-emerald-500/70 border border-emerald-500/20 px-1 py-0.2 rounded text-[8.5px]">
              v{workspace.version || '1.0.0'}
            </span>
          </div>
          <div className="text-slate-500">
            Author: <span className="text-slate-300">{workspace.author || 'Moshi'}</span>
          </div>
        </div>

        {/* Scrollable grid area of targets */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
          <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 select-none">
            <span>Choose Elements to Build</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSelectAll(true)}
                className="text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer focus:outline-none"
              >
                SELECT ALL
              </button>
              <span className="text-slate-700">|</span>
              <button
                onClick={() => handleSelectAll(false)}
                className="text-slate-400 hover:text-slate-300 hover:underline cursor-pointer focus:outline-none"
              >
                CLEAR ALL
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {targets.map(t => {
              const isActive = !!compileSettings[t.key];
              return (
                <div
                  key={t.key}
                  onClick={() => handleToggleSetting(t.key)}
                  className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 group cursor-pointer select-none ${
                    isActive
                      ? 'bg-emerald-950/10 border-emerald-500/25 hover:border-emerald-500/40 hover:bg-emerald-950/15'
                      : 'bg-[#0f121a]/60 border-white/5 hover:border-slate-500/20 hover:bg-[#0f121a]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Checkbox item */}
                    <div className="mt-0.5" onClick={(e) => { e.stopPropagation(); handleToggleSetting(t.key); }}>
                      {isActive ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 cursor-pointer" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 shrink-0 cursor-pointer" />
                      )}
                    </div>
                    {/* Icon & Details */}
                    <div className="flex shrink-0 mt-0.5">{t.icon}</div>
                    <div className="space-y-0.5">
                      <span className={`text-[11px] font-mono font-bold block ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                        {t.title}
                      </span>
                      <p className="text-[9.5px] text-slate-500 font-sans leading-normal">
                        {t.desc}
                      </p>
                    </div>
                  </div>

                  {/* Active Status pill */}
                  <div className="shrink-0 text-[8.5px] font-mono uppercase font-bold text-right">
                    {isActive ? (
                      <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded leading-none">
                        BUILDING
                      </span>
                    ) : (
                      <span className="text-slate-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded leading-none">
                        SKIPPED
                      </span>
                    )
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* B84: deploy FORMAT toggle — the author picks how the mod lands in the game folder,
            and each option states its real consequence rather than a bare label. */}
        <div className="mx-4 mb-4 p-2.5 bg-[#0f131c] border border-white/5 rounded space-y-2" data-testid="deploy-format-toggle">
          <div className="text-slate-400 uppercase text-[8.5px] font-bold tracking-wider flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-cyan-500" />
            Deploy format
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              {
                key: 'loose' as const,
                title: 'Loose files',
                desc: 'Every file written to the mod folder as a real file. Readable, diffable, hand-editable — and native .dll/.so files load normally. Most X4 mods ship this way.',
              },
              {
                key: 'catalog' as const,
                title: 'CAT / DAT archive',
                desc: 'Payload packed into ext_01.cat + ext_01.dat. Tidier, but packed files no longer exist individually on disk, and native binaries inside an archive cannot load.',
              },
            ]).map(option => {
              const selected = deployFormat === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => chooseDeployFormat(option.key)}
                  disabled={formatBusy}
                  aria-pressed={selected}
                  data-testid={`deploy-format-${option.key}`}
                  className={`text-left p-2 rounded border transition-colors disabled:opacity-60 ${
                    selected
                      ? 'border-cyan-500/60 bg-cyan-500/10'
                      : 'border-white/5 bg-[#070a0f] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {selected
                      ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    <span className={`text-[11px] font-semibold ${selected ? 'text-cyan-300' : 'text-slate-300'}`}>
                      {option.title}
                    </span>
                  </div>
                  <div className="mt-1 text-[9.5px] leading-relaxed text-slate-500">{option.desc}</div>
                </button>
              );
            })}
          </div>
          {deployFormat === null && !formatError && (
            <div className="text-[9.5px] text-slate-500">Reading the saved deploy format…</div>
          )}
          {formatError && (
            <div className="text-[9.5px] text-red-400" role="alert">{formatError}</div>
          )}
        </div>

        {/* Staging target directory info */}
        {modWorkspacePath && (
          <div className="mx-4 mb-4 p-2.5 bg-[#0f131c] border border-white/5 rounded text-[10px] font-mono leading-relaxed text-slate-500 space-y-1">
            <div className="text-slate-400 uppercase text-[8.5px] font-bold tracking-wider flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5 text-cyan-500" />
              Staging target location
            </div>
            <div className="text-slate-300 select-all break-all pr-2">
              {modWorkspacePath}
            </div>
          </div>
        )}

        {/* B7: deploy-verify preflight result — rendered IN the wizard, not hidden in Playtest */}
        {compileStatus !== 'idle' && (
          <div className="mx-4 mb-4 p-2.5 bg-[#0f131c] border border-white/5 rounded text-[10px] font-mono leading-relaxed space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar" data-testid="wizard-preflight-card">
            <div className={`uppercase text-[8.5px] font-bold tracking-wider ${
              compileStatus === 'compiling' ? 'text-cyan-400' : compileStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {compileStatus === 'compiling' ? 'Running preflight & deploy…' : compileStatus === 'success' ? 'Deployed + verified' : 'Deploy failed'}
            </div>
            {compileMessage && <div className="text-slate-300 break-all">{compileMessage}</div>}
            {checklist.map(row => (
              <div key={row.id} className="flex items-start gap-1.5">
                <span className={`${CHECK_COLORS[row.status]} font-bold w-3 shrink-0`}>{CHECK_GLYPH[row.status]}</span>
                <span className={row.status === 'fail' ? 'text-red-300' : row.status === 'skipped' ? 'text-slate-600' : 'text-slate-400'}>
                  {row.label}
                  {/* B84: the deploy row ALWAYS shows its detail — that is where the plain
                      account of what format was written now lives. A successful deploy that
                      silently packed the mod into an archive is exactly the surprise to avoid. */}
                  {(row.status !== 'pass' || row.id === 'deploy') && row.detail
                    ? <span className="text-slate-500"> — {row.detail}</span>
                    : null}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer controls wrapper block */}
        <div className="p-4 border-t border-white/5 bg-[#070a0f] flex items-center justify-between rounded-b-xl select-none">
          <div className="text-[10px] font-mono text-slate-500">
            <span className="text-emerald-400 font-bold">{selectedCount}</span> of 6 targets active
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-400 hover:text-white rounded text-[10.5px] font-mono font-bold uppercase transition-all cursor-pointer"
            >
              {compileStatus === 'success' || compileStatus === 'error' ? 'Close' : 'Cancel'}
            </button>
            <button
              onClick={() => { onConfirm(); }}
              disabled={selectedCount === 0 || compileStatus === 'compiling'}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-transparent text-black rounded text-[10.5px] font-mono font-bold uppercase transition-all cursor-pointer shadow-lg shadow-emerald-500/10 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              {compileStatus === 'success' || compileStatus === 'error' ? 'Build Again' : 'Build & Staging'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
