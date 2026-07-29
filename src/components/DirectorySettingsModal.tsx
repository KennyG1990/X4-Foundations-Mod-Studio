/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  FolderOpen,
  HardDrive,
  Database,
  Gamepad2,
  Info,
  CheckCircle,
  AlertTriangle,
  Save,
  Sparkles,
  ExternalLink,
  Search,
  Loader2,
  Users,
  Settings as SettingsIcon
} from 'lucide-react';
import {
  openExternalUrlInNativeHost,
  X4_FORGE_DISCORD_URL,
  X4_UNPACKER_URL,
} from '../lib/nativeEditor';

type AiTier = 'off' | 'explain' | 'assist' | 'cobuild';

interface CoverageRow { key: string; count: number }
interface CorpusCoverage {
  generation: string;
  totalFiles: number;
  totalBytes: number;
  byRole: CoverageRow[];
  byConsumer: CoverageRow[];
}
interface CorpusScanStatus {
  state: 'unavailable' | 'idle' | 'scanning' | 'ready' | 'stale' | 'error';
  scanning?: { files: number; bytes: number; startedAt: string };
  error?: string;
}

interface DirectoryPathIssue {
  field: 'x4GamePath' | 'modWorkspacePath' | 'filesystemPath';
  code: string;
  message: string;
}

interface DetectResult {
  found: boolean;
  error?: string;
  source?: string;
  gameDir?: string;
  hint?: string;
  proposal?: {
    x4GamePath: string;
    filesystemPath: string;
    modWorkspacePath: string;
    xsdSchemaPath: string;
  } | null;
}

interface DirectorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  modWorkspacePath: string;
  setModWorkspacePath: (path: string) => void;
  filesystemPath: string;
  setFilesystemPath: (path: string) => void;
  aiTier: AiTier;
  setAiTier: (t: AiTier) => void;
  /** Opens the AI provider/model/API-key modal. Reachable here at ALL tiers (incl. off). */
  onOpenAIConfig: () => void;
}

// A4.1 — opt-in AI presence tiers. Off by default; determinism is never gated by this.
const AI_TIERS: { id: AiTier; label: string; desc: string }[] = [
  { id: 'off', label: 'Off', desc: 'No AI anywhere. Forge stays a fully deterministic editor.' },
  { id: 'explain', label: 'Explain', desc: 'Read-only. AI explains errors/nodes on request — never changes your work.' },
  { id: 'assist', label: 'Assist', desc: 'AI may propose changes — staged, validated, applied only on your confirm.' },
  { id: 'cobuild', label: 'Co-build', desc: 'Step-by-step Architect drafting, still verified before anything applies.' },
];

/**
 * One row per directory the application can require. Each row carries a hover
 * tooltip describing exactly what that directory is for.
 */
function DirectoryRow({
  icon,
  title,
  tooltip,
  testId,
  children
}: {
  icon: React.ReactNode;
  title: string;
  tooltip: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={testId} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-cyan-400">{icon}</span>
        <span className="text-[12px] font-mono font-bold text-white uppercase tracking-wide">{title}</span>
        <span className="relative group flex items-center">
          <Info className="w-3.5 h-3.5 text-slate-500 hover:text-cyan-400 cursor-help" />
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block w-64 bg-[#05070a] border border-cyan-500/30 text-[10px] text-slate-300 font-sans leading-relaxed rounded p-2 shadow-xl">
            {tooltip}
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}

export default function DirectorySettingsModal({
  isOpen,
  onClose,
  modWorkspacePath: _modWorkspacePath,
  setModWorkspacePath,
  filesystemPath: _filesystemPath,
  setFilesystemPath,
  aiTier,
  setAiTier,
  onOpenAIConfig
}: DirectorySettingsModalProps) {
  const [gamePath, setGamePath] = useState('');
  const [schemaPath, setSchemaPath] = useState('');
  const [referenceRoot, setReferenceRoot] = useState('');
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [filesystemInput, setFilesystemInput] = useState('');
  const [resolved, setResolved] = useState<any>(null);
  const [status, setStatus] = useState<{ type: 'idle' | 'saving' | 'success' | 'warn' | 'error'; msg: string }>({ type: 'idle', msg: '' });
  // B65-1: in-place schema recovery — harvest from the user's own install, and a teach panel.
  const [harvesting, setHarvesting] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [advancedSchemaOpen, setAdvancedSchemaOpen] = useState(false);
  const [coverage, setCoverage] = useState<CorpusCoverage | null>(null);
  const [corpusStatus, setCorpusStatus] = useState<CorpusScanStatus | null>(null);
  const [coverageError, setCoverageError] = useState('');
  const [coverageRefresh, setCoverageRefresh] = useState(0);
  const [directoryIssues, setDirectoryIssues] = useState<DirectoryPathIssue[]>([]);
  const [detection, setDetection] = useState<{ state: 'idle' | 'scanning' | 'found' | 'notfound' | 'error'; source?: string; message?: string }>({ state: 'idle' });

  const detectGameInstall = React.useCallback(async (overwrite = false) => {
    setDetection({ state: 'scanning' });
    try {
      const response = await fetch('/api/agent/detect-game');
      const result: DetectResult = await response.json();
      if (!response.ok) throw new Error(result.error || `Detection failed (${response.status}).`);
      if (!result.found || !result.proposal) {
        setDetection({ state: 'notfound', message: result.hint || 'No Steam or GOG X4 installation was found.' });
        return;
      }
      const proposal = result.proposal;
      setGamePath(current => overwrite || !current.trim() ? proposal.x4GamePath : current);
      setWorkspaceInput(current => overwrite || !current.trim() ? proposal.modWorkspacePath : current);
      setFilesystemInput(current => overwrite || !current.trim() ? proposal.filesystemPath : current);
      setDirectoryIssues(current => current.filter(issue => !['x4GamePath', 'modWorkspacePath', 'filesystemPath'].includes(issue.field)));
      setDetection({
        state: 'found',
        source: result.source,
        message: `Found X4 via ${result.source === 'gog' ? 'GOG' : 'Steam'}. Review the isolated development paths, then save.`,
      });
    } catch (error: unknown) {
      setDetection({ state: 'error', message: error instanceof Error ? error.message : 'Game detection failed.' });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const response = await fetch('/api/schema/config');
        const res = await response.json();
        if (!response.ok) throw new Error(res.error || `Directory config request failed (${response.status}).`);
        const configuredGamePath = res.config?.x4GamePath || res.resolved?.x4GamePath || '';
        setGamePath(configuredGamePath);
        setSchemaPath(res.config?.xsdSchemaPath || '');
        setReferenceRoot(res.config?.x4ReferenceRoot || res.resolved?.x4ReferenceRoot || '');
        setWorkspaceInput(res.config?.modWorkspacePath || res.resolved?.modWorkspacePath || '');
        setFilesystemInput(res.config?.filesystemPath || res.resolved?.filesystemPath || '');
        setResolved(res.resolved || null);
        setDirectoryIssues(res.directorySafety?.issues || []);
        if (!configuredGamePath) void detectGameInstall(false);
      } catch (error: any) {
        setStatus({ type: 'error', msg: `Could not load directory config from the server: ${error?.message || 'request failed'}` });
      }
    })();
  }, [isOpen, detectGameInstall]);

  useEffect(() => {
    if (!isOpen) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await fetch('/api/reference/coverage');
        const body = await response.json();
        if (!response.ok && response.status !== 202) {
          throw new Error(body.error || body.status?.error || `Coverage request failed (${response.status}).`);
        }
        if (stopped) return;
        setCorpusStatus(body.status || null);
        setCoverage(body.coverage || null);
        setCoverageError('');
        if (response.status === 202 || body.status?.state === 'scanning' || body.status?.state === 'idle') {
          timer = setTimeout(poll, 1500);
        }
      } catch (error: any) {
        if (!stopped) setCoverageError(error?.message || 'Coverage is unavailable.');
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, coverageRefresh]);

  const saveServerPaths = async (schemaDirOverride?: string) => {
    // schemaDirOverride: harvest sets schemaPath via setState (async), so it passes the new
    // dir directly rather than waiting a render for state to settle.
    const schemaDir = (schemaDirOverride ?? schemaPath).trim();
    setStatus({ type: 'saving', msg: '' });
    try {
      const response = await fetch('/api/schema/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaDir,
          x4GamePath: gamePath.trim(),
          x4ReferenceRoot: referenceRoot.trim(),
          modWorkspacePath: workspaceInput.trim(),
          filesystemPath: filesystemInput.trim()
        })
      });
      const res = await response.json();
      if (!response.ok) {
        setDirectoryIssues(res.issues || []);
        throw new Error(res.error || `Save failed (${response.status}).`);
      }
      if (res.error) {
        setResolved(res.resolved || resolved);
        setStatus({ type: 'error', msg: res.error });
      } else {
        // Paths always save now (schema no longer gates the save). Reflect that honestly:
        // green when the schema also loaded, amber "saved, schema pending" when it didn't.
        setResolved(res.resolved || null);
        setDirectoryIssues(res.directorySafety?.issues || []);
        setModWorkspacePath(workspaceInput.trim());
        setFilesystemPath(filesystemInput.trim());
        setCorpusStatus(res.manifest || null);
        setCoverageRefresh(value => value + 1);
        const events = res.schema_counts?.events ?? 0;
        const conditions = res.schema_counts?.conditions ?? 0;
        const actions = res.schema_counts?.actions ?? 0;
        if (res.resolved?.x4ReferenceExists === false) {
          setStatus({
            type: 'warn',
            msg: `Paths saved. Unpacked reference corpus not found at ${res.resolved?.x4ReferenceRoot || referenceRoot || '(unset)'} — canonical reference endpoints and ID checks remain unavailable.`,
          });
        } else if (res.schemaComplete === false || (events === 0 && conditions === 0 && actions === 0)) {
          setStatus({
            type: 'warn',
            msg: res.schemaWarning
              || `Paths saved. Schema not loaded (${schemaDir || 'no schema path set'}) — schema-aware validation stays disabled until md.xsd + common.xsd resolve.`
          });
        } else {
          setStatus({
            type: 'success',
            msg: `Saved. Schema library reloaded: ${events} events, ${conditions} conditions, ${actions} actions.`
          });
        }
      }
    } catch (err) {
      setStatus({ type: 'error', msg: err.message || 'Failed to save directory settings.' });
    }
  };

  // B65-1: extract ALL of X4's schema files from the user's own game install (the same harvest
  // the first-run wizard runs — now reachable from the exact screen users get stuck on). On
  // failure, open the teach panel so the amber state is never a dead-end.
  const harvestFromInstall = async () => {
    const g = gamePath.trim();
    if (!g) return;
    setHarvesting(true);
    setStatus({ type: 'saving', msg: 'Extracting the game’s schema files…' });
    try {
      const res = await fetch('/api/agent/setup/harvest-schemas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x4GamePath: g }),
      }).then(r => r.json());
      if (!res.ok) {
        setGuideOpen(true);
        setStatus({ type: 'error', msg: res.error || 'Could not extract the schema files from your game install — see below.' });
        return;
      }
      setSchemaPath(res.dir);
      await saveServerPaths(res.dir); // persist + reload schema; re-resolves schemaOk to green
    } catch (e: any) {
      setGuideOpen(true);
      setStatus({ type: 'error', msg: e?.message || 'Schema extraction failed — see below.' });
    } finally {
      setHarvesting(false);
    }
  };

  if (!isOpen) return null;

  const schemaOk = resolved?.mdExists && resolved?.commonExists;
  const showGuide = guideOpen || (resolved && !schemaOk); // auto-open the teach panel when stuck
  const showAdvancedSchema = advancedSchemaOpen || Boolean(resolved && !schemaOk && !resolved.x4ReferenceExists);
  const count = (rows: CoverageRow[] | undefined, key: string) => rows?.find(row => row.key === key)?.count || 0;
  const number = (value: number) => new Intl.NumberFormat().format(value);
  const issuesFor = (field: DirectoryPathIssue['field']) => directoryIssues.filter(issue => issue.field === field);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-h-[85vh] overflow-y-auto bg-[#0c0f16] border border-cyan-500/30 rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#141b25] rounded-t-xl">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="font-bold text-white text-sm block">Directory Settings</span>
              <span className="text-[10px] text-slate-400">Every folder the studio needs, in one place</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* 1. Mod Workspace folder */}
          <DirectoryRow
            icon={<HardDrive className="w-4 h-4" />}
            title="Mod Workspace Folder"
            tooltip="Your isolated development sandbox where Forge writes editable mod copies, snapshots, and releases. Never use the installed game's extensions folder or the unpacked corpus. Git can protect history inside this workspace, but it does not replace this boundary."
            testId="mod-workspace-settings"
          >
            <input
              type="text"
              value={workspaceInput}
              onChange={e => { setWorkspaceInput(e.target.value); setDirectoryIssues(current => current.filter(issue => issue.field !== 'modWorkspacePath')); }}
              placeholder="e.g. C:\Users\you\Documents\X4ForgeMods"
              className="w-full px-2 py-1.5 rounded bg-[#0F1115] border border-white/10 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[9.5px] leading-relaxed text-slate-500">Forge develops and snapshots mod copies here. The live game is updated only through an explicit Deploy operation.</p>
            {issuesFor('modWorkspacePath').map(issue => <div key={issue.code} className="text-[10px] font-mono text-red-300 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{issue.message}</div>)}
          </DirectoryRow>

          {/* 1b. Filesystem folder */}
          <DirectoryRow
            icon={<FolderOpen className="w-4 h-4" />}
            title="Filesystem Folder"
            tooltip="The installed/deployed X4 extensions folder shown in Forge's Filesystem explorer. Forge may browse and import from this tree, but generic edits are blocked; validated Deploy is the intentional live-write path."
            testId="filesystem-settings"
          >
            <input
              type="text"
              value={filesystemInput}
              onChange={e => { setFilesystemInput(e.target.value); setDirectoryIssues(current => current.filter(issue => issue.field !== 'filesystemPath')); }}
              placeholder="e.g. G:\SteamLibrary\steamapps\common\X4 Foundations\extensions"
              className="w-full px-2 py-1.5 rounded bg-[#0F1115] border border-white/10 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[9.5px] leading-relaxed text-slate-500">Browse/import installed mods here. Develop in Mod Workspace; update the live game only through validated Deploy.</p>
            {issuesFor('filesystemPath').map(issue => <div key={issue.code} className="text-[10px] font-mono text-red-300 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{issue.message}</div>)}
          </DirectoryRow>

          {/* 2. X4 Game installation (server path) */}
          <DirectoryRow
            icon={<Gamepad2 className="w-4 h-4" />}
            title="X4 Game Installation"
            tooltip="The installed X4 Foundations root containing X4.exe. Forge reads this for runtime discovery and writes to its extensions folder only during an explicit Deploy. Steam and GOG installs can be detected automatically."
            testId="game-install-settings"
          >
            <input
              type="text"
              value={gamePath}
              onChange={e => { setGamePath(e.target.value); setDirectoryIssues(current => current.filter(issue => issue.field !== 'x4GamePath')); setDetection({ state: 'idle' }); }}
              placeholder="e.g. C:\Program Files (x86)\Steam\steamapps\common\X4 Foundations"
              className="w-full px-2 py-1.5 rounded bg-[#0F1115] border border-white/10 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void detectGameInstall(true)}
                disabled={detection.state === 'scanning'}
                className="inline-flex items-center gap-1 rounded border border-cyan-500/30 px-2 py-1 text-[10px] font-mono font-semibold text-cyan-300 hover:border-cyan-400 disabled:opacity-50"
              >
                {detection.state === 'scanning' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                {detection.state === 'scanning' ? 'Detecting…' : 'Detect X4 installation'}
              </button>
              {detection.message && <span className={`text-[9.5px] ${detection.state === 'found' ? 'text-emerald-300' : 'text-amber-300'}`}>{detection.message}</span>}
            </div>
            {issuesFor('x4GamePath').map(issue => <div key={issue.code} className="text-[10px] font-mono text-red-300 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{issue.message}</div>)}
          </DirectoryRow>

          {/* 2b. One read-only source for canonical data, schemas, and examples. */}
          <DirectoryRow
            icon={<Database className="w-4 h-4" />}
            title="X4 Unpacked Game Corpus"
            tooltip="The root of an unpacked X4 installation. Forge discovers its schemas, canonical base/DLC values, scripts, localization, and assets once, caches a read-only index outside this folder, and reports exactly what each validation layer consumes. Forge never writes here."
            testId="x4-corpus-settings"
          >
            <input
              type="text"
              value={referenceRoot}
              onChange={e => setReferenceRoot(e.target.value)}
              placeholder="e.g. D:\X4 unpacked 9.00"
              className="w-full px-2 py-1.5 rounded bg-[#0F1115] border border-white/10 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
            />

            <div className="rounded border border-cyan-500/20 bg-cyan-500/[0.04] p-2 text-[10px] leading-relaxed text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <span><span className="font-semibold text-slate-200">Need an unpacked copy?</span> X4 Unpacker provides GUI and CLI extraction of base-game and DLC catalogues with patch ordering.</span>
                <a
                  href={X4_UNPACKER_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(event) => {
                    if (openExternalUrlInNativeHost(X4_UNPACKER_URL)) event.preventDefault();
                  }}
                  className="shrink-0 inline-flex items-center gap-1 rounded border border-cyan-500/30 px-2 py-1 font-mono font-semibold text-cyan-300 hover:border-cyan-400 hover:text-cyan-200"
                  title="Open X4 Unpacker on Nexus Mods"
                >
                  Find X4 Unpacker <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="mt-1 text-[9px] text-slate-500">Created by <span className="font-semibold text-slate-300">z1ppeh</span>. Unofficial community utility; not affiliated with or endorsed by Egosoft. Forge does not download or run it.</div>
            </div>

            {resolved && (
              <div className="mt-1 text-[10px] font-mono">
                {resolved.x4ReferenceExists ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Corpus root found — read-only discovery and canonical ID checks are available</span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Corpus root not found — schema and canonical ID coverage is degraded</span>
                )}
              </div>
            )}

            {corpusStatus?.state === 'scanning' && (
              <div className="rounded border border-cyan-500/20 bg-black/20 p-2 text-[10px] font-mono text-cyan-300">
                Discovering corpus… {number(corpusStatus.scanning?.files || 0)} files indexed. The last complete generation remains active.
              </div>
            )}
            {coverage && (corpusStatus?.state === 'ready' || corpusStatus?.state === 'stale') && (
              <div className="rounded border border-white/10 bg-black/20 p-2 text-[9.5px] font-mono text-slate-400 space-y-1">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-emerald-300">{number(coverage.totalFiles)} discovered</span>
                  <span>{number(count(coverage.byRole, 'grammar'))} grammar</span>
                  <span>{number(count(coverage.byRole, 'canonical-data'))} canonical data</span>
                  <span>{number(count(coverage.byRole, 'executable-example'))} code examples</span>
                  <span>{number(count(coverage.byRole, 'asset'))} assets</span>
                </div>
                <div className="text-slate-500">
                  Generation {coverage.generation.slice(0, 12)} · {number(count(coverage.byConsumer, 'unconsumed'))} files visible but not yet semantically consumed
                  {corpusStatus?.state === 'stale' ? ' · serving last complete generation after refresh error' : ''}
                </div>
              </div>
            )}
            {(coverageError || corpusStatus?.state === 'error' || corpusStatus?.state === 'unavailable') && (
              <div className="text-[10px] font-mono text-amber-400 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{coverageError || corpusStatus?.error || 'Corpus coverage is unavailable until a valid unpacked root is saved.'}</span>
              </div>
            )}
          </DirectoryRow>

          <button
            type="button"
            aria-expanded={showAdvancedSchema}
            onClick={() => setAdvancedSchemaOpen(open => !open)}
            className="w-full px-3 py-2 rounded-lg border border-white/5 bg-white/[0.015] text-left text-[10px] font-mono text-slate-500 hover:text-cyan-300 hover:border-cyan-500/20 cursor-pointer"
          >
            {showAdvancedSchema ? '▾' : '▸'} Advanced fallback: manual XSD schema folder
            <span className="block mt-0.5 font-sans text-[9px] text-slate-600">Normally derived from the unpacked corpus above. Use this only for harvested schemas or a nonstandard layout.</span>
          </button>

          {/* 3. Legacy/manual schema override. The corpus is the primary source. */}
          {showAdvancedSchema && <DirectoryRow
            icon={<Database className="w-4 h-4" />}
            title="Manual XSD Schema Override"
            tooltip="Advanced compatibility fallback for harvested or nonstandard schema layouts. Leave empty to derive X4's schema library from the unpacked corpus above."
            testId="manual-xsd-settings"
          >
            <input
              type="text"
              value={schemaPath}
              onChange={e => setSchemaPath(e.target.value)}
              placeholder="Optional: folder containing md.xsd + common.xsd"
              className="w-full px-2 py-1.5 rounded bg-[#0F1115] border border-white/10 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
            />
            {resolved && (
              <div className="mt-1 space-y-1.5 text-[10px] font-mono">
                {schemaOk ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> md.xsd &amp; common.xsd found — schema-aware validation is on</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> md.xsd / common.xsd not found — validation is limited</span>
                    <button
                      type="button"
                      onClick={harvestFromInstall}
                      disabled={harvesting || !gamePath.trim()}
                      title={gamePath.trim() ? 'Extract X4’s schema files from your game install' : 'Set your X4 Game Installation path above first'}
                      className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Database className="w-3 h-3" /> {harvesting ? 'Extracting…' : 'Extract schemas from my game install'}
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => setGuideOpen(o => !o)} className="text-slate-500 hover:text-cyan-300 text-[10px] inline-flex items-center gap-1 cursor-pointer">
                  <Info className="w-3 h-3" /> How validation works &amp; where to get the schema files {showGuide ? '▾' : '▸'}
                </button>
                {showGuide && (
                  <div className="text-[10px] leading-relaxed text-slate-400 font-sans bg-white/[0.03] border border-white/10 rounded p-2 space-y-1">
                    <p><span className="text-slate-200 font-semibold">How it works:</span> the Forge validates your mod against X4’s own schema files — md.xsd, common.xsd, and ~40 more the game ships. The more it has, the more of your mod it checks (factions, game starts, patches, and so on).</p>
                    <p><span className="text-slate-200 font-semibold">What it needs:</span> those schema files, from <span className="text-slate-200">your</span> install — the Forge can’t legally ship X4’s files with it.</p>
                    <p><span className="text-emerald-300 font-semibold">Preferred:</span> set <span className="text-slate-200">X4 Unpacked Game Corpus</span>. Forge derives schemas and canonical base/DLC data from that one read-only root.</p>
                    <p><span className="text-cyan-300 font-semibold">Schema-only fallback:</span> set your <span className="text-slate-200">X4 Game Installation</span> and click <span className="text-slate-200">Extract schemas</span>. This enables XSD structure checks, but it does not provide the canonical IDs, examples, localization, or asset inventory of a complete unpacked corpus.</p>
                  </div>
                )}
              </div>
            )}
          </DirectoryRow>}

          <DirectoryRow
            icon={<Users className="w-4 h-4" />}
            title="Community & Support"
            tooltip="Meet other X4 Forge users, ask questions about Forge, share your mods, and discuss mod-authoring workflows."
            testId="forge-discord-community"
          >
            <div className="rounded border border-indigo-400/20 bg-indigo-400/[0.04] p-2 text-[10px] leading-relaxed text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <span><span className="font-semibold text-slate-200">Join the X4 Forge Discord.</span> Ask questions about Forge, discuss your workflow, share the mods you are building, and connect with other mod authors.</span>
                <a
                  href={X4_FORGE_DISCORD_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(event) => {
                    if (openExternalUrlInNativeHost(X4_FORGE_DISCORD_URL)) event.preventDefault();
                  }}
                  className="shrink-0 inline-flex items-center gap-1 rounded border border-indigo-400/30 px-2 py-1 font-mono font-semibold text-indigo-300 hover:border-indigo-300 hover:text-indigo-200"
                  title="Open the X4 Forge Discord invite"
                >
                  Open Discord <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="mt-1 text-[9px] text-slate-500">Community-run support for X4 Forge users; not affiliated with or endorsed by Egosoft. Forge never opens or joins the server automatically.</div>
            </div>
          </DirectoryRow>

          {/* AI Assistant — opt-in tiers (off by default). Applied immediately (client-side). */}
          <DirectoryRow
            icon={<Sparkles className="w-4 h-4" />}
            title="AI Assistant (optional)"
            tooltip="Off by default. Controls how much AI assistance Forge offers. Determinism — validation, diagnostics, compile, the object browser, selftests — always works fully regardless of this setting. Your choice is saved on this device and applied immediately."
          >
            <div className="grid grid-cols-2 gap-1.5">
              {AI_TIERS.map(t => {
                const active = aiTier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAiTier(t.id)}
                    title={t.desc}
                    className={`text-left p-2 rounded border transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                        : 'bg-[#0F1115] border-white/10 text-slate-300 hover:border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wide">
                      {active && <CheckCircle className="w-3 h-3" />}
                      {t.label}
                    </div>
                    <div className="text-[9.5px] text-slate-400 font-sans leading-snug mt-0.5">{t.desc}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-slate-500 font-sans mt-1.5 leading-relaxed">
              AI is a convenience layer beside Forge's deterministic core, never in front of it. At <span className="text-slate-300 font-mono">Off</span> there is no AI anywhere in the app.
            </p>
            <button
              type="button"
              onClick={onOpenAIConfig}
              title="Provider, model and API key — configurable at any tier, including Off."
              className="mt-2 w-full px-2.5 py-1.5 rounded border border-amber-500/25 bg-amber-500/[0.04] hover:bg-amber-500/10 hover:border-amber-500/50 text-amber-300 text-[10.5px] font-mono font-bold uppercase tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3 h-3" />
              Configure AI engine — provider, model &amp; API key
            </button>
          </DirectoryRow>

          {/* Status + Save */}
          {status.msg && (
            <div
              className={`p-2 rounded text-[10px] font-mono leading-relaxed border ${
                status.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : status.type === 'warn'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {status.msg}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] text-slate-500 font-sans">
              All directory paths are saved securely on the server config.
            </span>
            <button
              onClick={() => saveServerPaths()}
              disabled={status.type === 'saving'}
              className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black rounded text-[11px] font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              {status.type === 'saving' ? 'Saving…' : 'Save Paths'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
