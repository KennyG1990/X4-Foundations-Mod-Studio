/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Terminal, CheckCircle, AlertTriangle, Sparkles, Boxes, RefreshCw, FileCode, X, Layers, Crown, Copy, ShieldCheck } from 'lucide-react';
import { ModWorkspace, PackageDiagnostic, generateMDXML } from '../types';
import { critiqueWorkspace } from '../lib/mdCritic';
import DiagnosticGuidance from './DiagnosticGuidance';
import type { ValidationDeltaResult } from '../lib/validationDelta';

interface PackageModDoctorProps {
  workspace: ModWorkspace;
  diagnostics: PackageDiagnostic[];
  diagnosticSource: 'checking' | 'project' | 'local';
  validationDelta?: ValidationDeltaResult | null;
  /** H7: which diagnostics scope to render. 'package' = this mod's build/critic/
   *  selftests; 'install' = the cross-mod Install Diagnostics (Extension Doctor);
   *  'all' (default) = both, for standalone use. */
  focus?: 'package' | 'install' | 'all';
  onSuppressionCommitted?: (sourceHash: string) => void;
}

interface ExtensionOpenTarget {
  path: string;
  label?: string;
}

interface ExtensionFinding {
  severity: string;
  code: string;
  filePath?: string;
  archive?: string;
  message?: string;
  domain?: string;
  openTargets?: ExtensionOpenTarget[];
}

interface ExtensionScanResult {
  counts?: Partial<Record<'error' | 'warning' | 'info', number>>;
  enabledCount?: number;
  extensionsScanned?: number;
  findings?: ExtensionFinding[];
}

interface OverrideClaim {
  folder: string;
  op: string;
  sel: string;
}

interface OverrideEntry {
  node: string;
  kind: string;
  winner?: string;
  contested?: boolean;
  merged?: boolean;
  claims?: OverrideClaim[];
}

interface OverrideMapResult {
  targetFile?: string;
  resolution?: 'base' | 'selector';
  loadOrder?: string[];
  counts?: { contested?: number; merged?: number; single?: number };
  entries?: OverrideEntry[];
}

interface SelftestResponse {
  pass?: boolean;
  allPassed?: boolean;
  lossless?: boolean;
  available?: boolean;
  findings?: unknown[];
  snippets?: unknown[];
  unresolved?: unknown[];
  checks?: { pass?: boolean }[];
  passed?: number;
  total?: number;
}

function messageFromUnknown(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function PackageModDoctor({
  workspace,
  diagnostics,
  diagnosticSource,
  validationDelta,
  focus = 'all',
  onSuppressionCommitted,
}: PackageModDoctorProps) {
  const showPackage = focus !== 'install';
  const showInstall = focus !== 'package';
  const errors = diagnostics.filter(d => d.severity === 'error');
  const warnings = diagnostics.filter(d => d.severity === 'warning');
  const firstNodeError = errors.find((e): e is PackageDiagnostic & { nodeId: string } =>
    typeof (e as PackageDiagnostic & { nodeId?: unknown }).nodeId === 'string'
  );

  // Extension Doctor — cross-mod conflict scan over the whole installed extensions/ folder.
  const [extScan, setExtScan] = useState<ExtensionScanResult | null>(null);
  const [extScanning, setExtScanning] = useState(false);
  const [extError, setExtError] = useState<string | null>(null);

  // Click-through file viewer for Extension Doctor findings (openTargets chips).
  const [extFile, setExtFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [extFileLoading, setExtFileLoading] = useState<string | null>(null);
  const [extFileError, setExtFileError] = useState<string | null>(null);

  const openExtensionFile = async (path: string) => {
    setExtFileLoading(path);
    setExtFileError(null);
    try {
      const res = await fetch('/api/agent/extension-file?path=' + encodeURIComponent(path));
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Failed to load file (${res.status})`);
      setExtFile(data);
    } catch (err) {
      setExtFileError(messageFromUnknown(err, 'Failed to load extension file.'));
    } finally {
      setExtFileLoading(null);
    }
  };

  // T4.4 Inc 2 — per-element override drill-down for cross-mod collision findings.
  // Fetches /api/agent/override-map (engine: src/lib/overrideMap.ts) for the
  // finding's contested base path: who rewrites what, who wins by load order.
  const [ovMap, setOvMap] = useState<OverrideMapResult | null>(null);
  const [ovLoading, setOvLoading] = useState<string | null>(null);
  const [ovError, setOvError] = useState<string | null>(null);

  const openOverrideMap = async (file: string) => {
    setOvLoading(file);
    setOvError(null);
    try {
      const res = await fetch('/api/agent/override-map?file=' + encodeURIComponent(file));
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Override map failed (${res.status})`);
      setOvMap(data);
    } catch (err) {
      setOvError(messageFromUnknown(err, 'Override map failed.'));
    } finally {
      setOvLoading(null);
    }
  };

  // Selftest dashboard — every public oracle GET, run sequentially.
  const SELFTEST_ENDPOINTS: { name: string; path: string }[] = [
    { name: 'core', path: 'selftest' },
    { name: 'md-audit', path: 'md-audit' },
    { name: 'round-trip', path: 'round-trip-selftest' },
    { name: 'references', path: 'reference-selftest' },
    { name: 'agent-api', path: 'api-selftest' },
    { name: 'live-log', path: 'log-selftest' },
    { name: 'log-telemetry', path: 'log-telemetry-selftest' },
    { name: 'log-file', path: 'log-file-selftest' },
    { name: 'cue-lineage', path: 'cue-lineage-selftest' },
    { name: 'semantics', path: 'semantics-selftest' },
    { name: 'explain', path: 'explain-selftest' },
    { name: 'critic', path: 'critic-selftest' },
    { name: 'simulate', path: 'simulate-selftest' },
    { name: 'node-diag', path: 'node-diagnostics-selftest' },
    { name: 'node-align', path: 'node-align-selftest' },
    { name: 'live-fixes', path: 'live-fixes-selftest' },
    { name: 'contracts', path: 'contract-selftest' },
    { name: 'lua-snippets', path: 'lua-snippets' },
    { name: 'lua-static', path: 'lua-static-selftest' },
    { name: 'ui-layout', path: 'ui-layout-selftest' },
    { name: 'ui-widgets', path: 'ui-widget-validate-selftest' },
    { name: 'ext-doctor', path: 'extension-doctor-selftest' },
    { name: 'override-map', path: 'override-map-selftest' },
    { name: 'cat/dat', path: 'catdat-selftest' },
    { name: 'object-index', path: 'object-index-selftest' },
    { name: 'proposal-review', path: 'proposal-review-selftest' },
    { name: 'intent-check', path: 'intent-check-selftest' },
    { name: 'blueprint', path: 'blueprint-selftest' },
    { name: 'diff-synth', path: 'xpath-synth-selftest' },
    { name: 'patch-audit', path: 'patch-audit' },
    { name: 'sqlite', path: 'db-selftest' }
  ];
  const [stResults, setStResults] = useState<{ name: string; pass: boolean; score?: string; detail?: string }[] | null>(null);
  const [stRunning, setStRunning] = useState(false);
  const [stProgress, setStProgress] = useState('');
  const stAllPass = !!stResults && stResults.every(r => r.pass);

  // Determinism Doctrine / Phase 3 — deterministic critic over the active workspace.
  // Computed client-side (no AI, no network): every finding is rule-justified from the
  // graph + semantics registry, and equivalent refs (playership ≡ player.primaryship)
  // are never flagged.
  const workspaceNodes = workspace.nodes;
  const workspaceLinks = workspace.links;
  const critic = useMemo(
    () => critiqueWorkspace(workspaceNodes || [], workspaceLinks || []),
    [workspaceNodes, workspaceLinks]
  );
  const criticSeverityStyle = (s: string) =>
    s === 'warning' ? 'text-amber-300 bg-amber-500/5 border-amber-500/20' : 'text-sky-300 bg-sky-500/5 border-sky-500/15';

  const runAllSelftests = async () => {
    setStRunning(true);
    setStResults(null);
    const out: { name: string; pass: boolean; score?: string; detail?: string }[] = [];
    for (const ep of SELFTEST_ENDPOINTS) {
      setStProgress(`${out.length + 1}/${SELFTEST_ENDPOINTS.length}`);
      try {
        const r: SelftestResponse = await fetch('/api/agent/' + ep.path).then(x => x.json());
        const checks = r.checks || [];
        const pass = r.pass === true || r.allPassed === true || r.lossless === true
          || (Array.isArray(r.findings) && r.findings.length === 0)
          || (r.available === false /* sqlite absent reads as soft-pass */ && ep.path === 'db-selftest')
          || (ep.path === 'lua-snippets' && Array.isArray(r.snippets) && r.snippets.length > 0)
          || (ep.path === 'patch-audit' && Array.isArray(r.unresolved) && r.unresolved.length === 0)
          || (checks.length > 0 && checks.every(c => c.pass));
        const score = checks.length ? `${checks.filter(c => c.pass).length}/${checks.length}`
          : typeof r.passed === 'number' && typeof r.total === 'number' ? `${r.passed}/${r.total}` : undefined;
        out.push({ name: ep.name, pass, score, detail: pass ? '' : JSON.stringify(r).slice(0, 180) });
      } catch (e) {
        out.push({ name: ep.name, pass: false, detail: messageFromUnknown(e, String(e)) });
      }
    }
    setStResults(out);
    setStRunning(false);
  };

  const runExtensionScan = async () => {
    setExtScanning(true);
    setExtError(null);
    try {
      const res = await fetch('/api/agent/extension-doctor');
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Scan failed (${res.status})`);
      setExtScan(data);
    } catch (err) {
      setExtError(messageFromUnknown(err, 'Extension scan failed.'));
    } finally {
      setExtScanning(false);
    }
  };

  const sevStyle = (s: string) =>
    s === 'error' ? 'bg-red-500/5 text-red-350 border-red-500/20'
      : s === 'warning' ? 'bg-amber-500/5 text-amber-300 border-amber-500/25'
        : 'bg-blue-500/5 text-blue-300 border-blue-500/20';

  const copyExtensionFinding = async (f: ExtensionFinding) => {
    const text = [
      `[${f.severity}] ${f.code}`,
      f.filePath ? `File: ${f.filePath}` : '',
      f.archive ? `Archive: ${f.archive}` : '',
      f.message || '',
      Array.isArray(f.openTargets) && f.openTargets.length
        ? `Open targets:\n${f.openTargets.map(t => `- ${t.path}`).join('\n')}`
        : ''
    ].filter(Boolean).join('\n');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      /* fall back below */
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'true');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  };

  const sendDiagnosticsToAI = () => {
    if (diagnostics.length === 0) return;
    const list = diagnostics.map((d, i) =>
      `${i + 1}. [${d.severity}] ${(d.domain || d.category || '')}: ${d.message}` +
      (d.filePath ? ` (file: ${d.filePath})` : '') +
      (d.sourceRef ? ` (source: ${d.sourceRef.kind}${d.sourceRef.label ? '/' + d.sourceRef.label : ''})` : '')
    ).join('\n');

    let currentCode = '';
    try {
      currentCode = generateMDXML(workspace);
    } catch {}

    const prompt = `My X4 Foundations mod "${workspace.name || 'mod'}" has these Mod Doctor validation issues:\n\n${list}\n\n${currentCode ? `Here is the current Mission Director logic XML:\n\`\`\`xml\n${currentCode}\n\`\`\`\n\n` : ''}For each issue, explain plainly what's wrong and exactly how to fix it (which node, property, or value to change). Keep it concise.`;
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { prompt } }));
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto bg-[#080a0e] p-3 space-y-3 shrink-0 font-mono text-xs scrollbar-thin">
      {showPackage && (<>
      {/* Header Info Card */}
      <div className="bg-[#12141a]/90 border border-white/5 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold tracking-tight text-[11px]">
            <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" />
            FULL-PROJECT VALIDATION
          </div>
          <span className="text-[9px] font-bold text-slate-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
            {diagnosticSource === 'checking' ? 'CHECKING...' : diagnosticSource === 'project' ? 'FULL PROJECT · LIVE' : 'LOCAL ENGINE'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => { if (firstNodeError) window.dispatchEvent(new CustomEvent('forge-focus-node', { detail: { nodeId: firstNodeError.nodeId } })); }}
            disabled={!firstNodeError}
            title={firstNodeError ? 'Click to jump to the first flagged node' : 'No node-located errors'}
            className="flex items-center gap-2 text-slate-200 bg-red-500/10 p-2 rounded border border-red-500/20 text-left enabled:hover:bg-red-500/20 enabled:cursor-pointer transition-colors disabled:opacity-100"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse block shrink-0" />
            <span>{errors.length} Errors</span>
          </button>
          <div className="flex items-center gap-2 text-slate-200 bg-amber-500/10 p-2 rounded border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500 block shrink-0" />
            <span>{warnings.length} Warnings</span>
          </div>
        </div>

        <div
          data-testid="validation-delta-card"
          className={`rounded border p-2 text-[9.5px] leading-relaxed ${
            validationDelta?.status === 'compared'
              ? validationDelta.counts.new > 0
                ? 'border-amber-500/25 bg-amber-500/5 text-amber-200'
                : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'
              : validationDelta?.status === 'unavailable'
                ? 'border-red-500/25 bg-red-500/5 text-red-200'
                : 'border-slate-500/20 bg-slate-500/5 text-slate-300'
          }`}
        >
          <div className="font-bold uppercase tracking-wide">Since last green</div>
          {diagnosticSource === 'checking' ? (
            <div className="mt-0.5 text-slate-400">Comparison pending…</div>
          ) : validationDelta?.status === 'compared' ? (
            <div className="mt-0.5">
              {validationDelta.counts.new} new · {validationDelta.counts.resolved} resolved · {validationDelta.counts.unchanged} unchanged warning(s)
              <div className="text-slate-400">Baseline {validationDelta.baseline.recordedAt ? new Date(validationDelta.baseline.recordedAt).toLocaleString() : 'recorded'}</div>
            </div>
          ) : validationDelta?.status === 'unavailable' ? (
            <div className="mt-0.5">Baseline unavailable — {validationDelta.baseline.reason || 'the stored comparison could not be trusted.'}</div>
          ) : (
            <div className="mt-0.5 text-slate-400">No last-green baseline yet. A successful deploy records one; background checks do not.</div>
          )}
        </div>

        {diagnostics.length > 0 && (
          <button
            onClick={sendDiagnosticsToAI}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-2 rounded-md border border-cyan-500/30 cursor-pointer uppercase transition-all"
            title="Ask AI Copilot for fixes"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            Ask AI Assistant For Fixes
          </button>
        )}
      </div>

      {/* DETERMINISTIC CRITIC (Phase 3) — rule-based, no AI. Every finding is justified
          from the graph + semantics registry; equivalent refs are never flagged. */}
      <div className="bg-[#12141a]/90 border border-white/5 rounded-lg p-3 space-y-2 shrink-0">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold tracking-tight text-[11px]">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            DETERMINISTIC CRITIC
          </div>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[8px] font-mono font-bold uppercase border border-emerald-500/20">No AI</span>
        </div>
        {critic.findings.length === 0 ? (
          <p className="text-[9.5px] text-slate-500 font-sans">No deterministic findings — no ref mismatches, unbalanced one-way writes, or unguarded high-risk actions on frequent triggers.</p>
        ) : (
          <div className="space-y-1.5">
            {critic.findings.map((f, i) => (
              <div key={i} className={`text-[9.5px] font-sans leading-snug px-2 py-1.5 rounded border ${criticSeverityStyle(f.severity)}`}>
                <span className="font-mono font-bold uppercase text-[7.5px] mr-1.5 opacity-80">{f.code.replace(/_/g, ' ')}</span>
                {f.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STUDIO SELFTEST DASHBOARD — one button for every oracle endpoint.
          The selftests are the studio's strongest trust asset; this surfaces
          them in the UI instead of leaving them as agent-only GETs. */}
      <div className="bg-[#12141a]/90 border border-white/5 rounded-lg p-3 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold tracking-tight text-[11px]">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            STUDIO SELFTESTS
          </div>
          {stResults && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${stAllPass ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' : 'text-red-300 bg-red-500/10 border-red-500/25'}`}>
              {stResults.filter(r => r.pass).length}/{stResults.length} PASS
            </span>
          )}
        </div>
        <p className="text-[9.5px] text-slate-400 font-sans leading-normal">
          Runs every built-in oracle: generators, validators, round-trip, archives, patches, contracts, lineage, telemetry, fixes.
        </p>
        <button
          onClick={runAllSelftests}
          disabled={stRunning}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-md border border-emerald-500/30 cursor-pointer uppercase transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${stRunning ? 'animate-spin' : ''}`} />
          {stRunning ? `Running… (${stProgress})` : 'Run All Selftests'}
        </button>
        {stResults && (
          <div className="grid grid-cols-2 gap-1">
            {stResults.map(r => (
              <div key={r.name} title={r.detail || ''} className={`flex items-center gap-1 text-[8.5px] font-mono px-1.5 py-0.5 rounded border ${r.pass ? 'text-emerald-300 bg-emerald-500/5 border-emerald-500/15' : 'text-red-300 bg-red-500/10 border-red-500/30 font-bold'}`}>
                <span>{r.pass ? '✓' : '✗'}</span>
                <span className="truncate">{r.name}</span>
                {r.score && <span className="ml-auto text-slate-500">{r.score}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      </>)}

      {/* INSTALL DIAGNOSTICS — cross-mod conflicts (was "Extension Doctor") */}
      {showInstall && (
      <div className="bg-[#12141a]/90 border border-white/5 rounded-lg p-3 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold tracking-tight text-[11px]">
            <Boxes className="w-4 h-4 text-cyan-400" />
            INSTALL DIAGNOSTICS
          </div>
          {extScan && (
            <span className="text-[9px] font-bold text-slate-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              {extScan.extensionsScanned} MODS
            </span>
          )}
        </div>
        <p className="text-[9.5px] text-slate-400 font-sans leading-normal">
          Scans every installed extension for missing dependencies, duplicate ids, and cross-mod file/patch conflicts.
        </p>
        <button
          onClick={runExtensionScan}
          disabled={extScanning}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-2 rounded-md border border-cyan-500/30 cursor-pointer uppercase transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${extScanning ? 'animate-spin' : ''}`} />
          {extScanning ? 'Scanning Extensions...' : 'Scan Installed Extensions'}
        </button>

        {extError && (
          <div className="text-red-300 text-[10px] bg-red-500/5 border border-red-500/20 rounded p-2 font-sans">{extError}</div>
        )}

        {extScan && (
          <>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-bold">
              <div className="flex items-center gap-1.5 text-slate-200 bg-red-500/10 p-1.5 rounded border border-red-500/20">
                <span className="w-2 h-2 rounded-full bg-red-500 block shrink-0" /> {extScan.counts?.error ?? 0} Err
              </div>
              <div className="flex items-center gap-1.5 text-slate-200 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-500 block shrink-0" /> {extScan.counts?.warning ?? 0} Warn
              </div>
              <div className="flex items-center gap-1.5 text-slate-200 bg-blue-500/10 p-1.5 rounded border border-blue-500/20">
                <span className="w-2 h-2 rounded-full bg-blue-500 block shrink-0" /> {extScan.counts?.info ?? 0} Info
              </div>
            </div>
            <div className="space-y-2.5 font-sans max-h-[52vh] overflow-y-auto scrollbar-thin pr-1 select-text">
              {(!extScan.findings || extScan.findings.length === 0) ? (
                <div className="text-emerald-400/90 text-[10px] flex items-center gap-2 bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10 font-medium">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  No cross-mod conflicts across {extScan.enabledCount} enabled extensions.
                </div>
              ) : extScan.findings.map((f, i) => (
                <div key={i} className={`p-3 rounded-lg border text-[11.5px] leading-relaxed flex items-start gap-2 ${sevStyle(f.severity)}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-1" />
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-bold tracking-tight text-white uppercase block text-[9px] leading-tight break-all flex-1">
                        [{f.severity}] {f.code}
                      </span>
                      <button
                        onClick={() => copyExtensionFinding(f)}
                        className="select-none flex items-center gap-1 font-mono text-[9px] text-slate-300 bg-black/30 hover:bg-white/10 px-1.5 py-1 rounded border border-white/10 cursor-pointer transition-all shrink-0"
                        title="Copy finding text"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                    {f.filePath && (
                      <span className="font-mono text-[10px] text-slate-200 block bg-black/35 px-2 py-1 rounded border border-white/5 break-all">{f.filePath}</span>
                    )}
                    <p className="text-slate-200 leading-relaxed whitespace-pre-wrap break-words">{f.message}</p>
                    {Array.isArray(f.openTargets) && f.openTargets.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {f.openTargets.map((t, j) => (
                          <button
                            key={j}
                            onClick={() => openExtensionFile(t.path)}
                            disabled={extFileLoading !== null}
                            title={t.path}
                            className="select-none flex items-center gap-1 font-mono text-[10px] text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-1 rounded border border-cyan-500/25 cursor-pointer transition-all disabled:opacity-50 max-w-full"
                          >
                            <FileCode className={`w-3 h-3 shrink-0 ${extFileLoading === t.path ? 'animate-pulse' : ''}`} />
                            <span className="break-all text-left">{t.label || t.path}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {f.domain === 'xml_patches' && f.filePath && (
                      <button
                        onClick={() => openOverrideMap(f.filePath)}
                        disabled={ovLoading !== null}
                        title={`Per-element override map for ${f.filePath}: who rewrites what, who wins`}
                        className="select-none flex items-center gap-1 font-mono text-[10px] text-fuchsia-300 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 px-2 py-1 rounded border border-fuchsia-500/25 cursor-pointer transition-all disabled:opacity-50 mt-1"
                      >
                        <Layers className={`w-2.5 h-2.5 shrink-0 ${ovLoading === f.filePath ? 'animate-pulse' : ''}`} />
                        OVERRIDE MAP
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {extFileError && (
              <div className="text-red-300 text-[10px] bg-red-500/5 border border-red-500/20 rounded p-2 font-sans">{extFileError}</div>
            )}
            {ovError && (
              <div className="text-red-300 text-[10px] bg-red-500/5 border border-red-500/20 rounded p-2 font-sans">{ovError}</div>
            )}
          </>
        )}
      </div>
      )}

      {/* Read-only extension file viewer modal */}
      {extFile && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setExtFile(null)}
        >
          <div
            className="bg-[#0d0f14] border border-cyan-500/25 rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col min-h-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="font-mono text-[11px] text-slate-200 font-semibold truncate" title={extFile.path}>{extFile.path}</span>
                <span className="text-[8px] font-bold text-slate-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 shrink-0 uppercase">Read-only</span>
              </div>
              <button
                onClick={() => setExtFile(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-all shrink-0 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto scrollbar-thin font-mono text-[10.5px] leading-relaxed text-slate-300 p-4 whitespace-pre min-h-0 select-text">
              {extFile.content}
            </pre>
          </div>
        </div>
      )}

      {/* Override-map drill-down modal (T4.4 Inc 2) */}
      {ovMap && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setOvMap(null)}
        >
          <div
            className="bg-[#0d0f14] border border-fuchsia-500/25 rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col min-h-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-fuchsia-400 shrink-0" />
                <span className="font-mono text-[11px] text-slate-200 font-semibold truncate" title={ovMap.targetFile}>{ovMap.targetFile}</span>
                <span
                  className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 uppercase ${ovMap.resolution === 'base' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/25'}`}
                  title={ovMap.resolution === 'base' ? 'Node identity resolved against the real vanilla file (loose or packed .cat/.dat)' : 'Vanilla content unavailable — entries grouped by selector string only (T4.1 VFS will sharpen this)'}
                >
                  {ovMap.resolution === 'base' ? 'BASE-RESOLVED' : 'SELECTOR-STRING'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* B13b2: jump straight into Diff→Patch pre-targeted at this file — the
                    natural next move after seeing who rewrites what. */}
                <button
                  data-testid="override-map-to-diffpatch"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('xmlpatch-pretarget', { detail: { targetFile: ovMap.targetFile } }));
                    setOvMap(null);
                  }}
                  className="px-2 py-1 rounded bg-fuchsia-600/30 border border-fuchsia-400/30 hover:bg-fuchsia-600/50 text-fuchsia-100 text-[9px] font-mono font-bold cursor-pointer"
                  title="Open the XML Patching workbench with Diff→Patch pre-targeted at this file."
                >
                  DIFF→PATCH
                </button>
                <button
                  onClick={() => setOvMap(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-all shrink-0 cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-4 py-2 border-b border-white/5 shrink-0 font-mono text-[9px] text-slate-400 flex flex-wrap items-center gap-1">
              LOAD ORDER:
              {(ovMap.loadOrder || []).map((m: string, i: number) => (
                <React.Fragment key={m}>
                  {i > 0 && <span className="text-slate-600">→</span>}
                  <span className="text-slate-300 bg-black/35 px-1 py-0.5 rounded border border-white/5">{m}</span>
                </React.Fragment>
              ))}
              <span className="ml-auto text-slate-500">
                {ovMap.counts?.contested ?? 0} contested · {ovMap.counts?.merged ?? 0} merged · {ovMap.counts?.single ?? 0} single
              </span>
            </div>
            <div className="flex-1 overflow-auto scrollbar-thin p-3 space-y-2 min-h-0 font-sans">
              {(ovMap.entries || []).length === 0 ? (
                <div className="text-slate-400 text-[10px] p-3">No overriding claims found for this file.</div>
              ) : (ovMap.entries || []).map((e, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border text-[10px] space-y-1.5 ${e.contested ? 'bg-red-500/5 border-red-500/20' : e.merged ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-white/[0.02] border-white/5'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-slate-200 font-semibold truncate" title={e.node}>{e.node}</span>
                    <span className="text-[7.5px] font-bold uppercase text-slate-400 bg-black/35 px-1 py-0.5 rounded border border-white/5 shrink-0">{e.kind}</span>
                    {e.contested && (
                      <span className="text-[7.5px] font-bold uppercase text-red-300 bg-red-500/10 px-1 py-0.5 rounded border border-red-500/25 shrink-0" title="2+ mods, at least one replace/remove/full-file — load order decides">CONTESTED</span>
                    )}
                    {e.merged && (
                      <span className="text-[7.5px] font-bold uppercase text-emerald-300 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20 shrink-0" title="add+add — X4 merges appends, low risk">MERGED</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {(e.claims || []).map((c, j) => (
                      <span
                        key={j}
                        title={c.sel}
                        className={`font-mono text-[8.5px] px-1.5 py-0.5 rounded border ${c.folder === e.winner ? 'text-fuchsia-200 bg-fuchsia-500/15 border-fuchsia-500/30' : 'text-slate-300 bg-black/35 border-white/10'}`}
                      >
                        {c.folder}:{c.op}
                      </span>
                    ))}
                    <span className="flex items-center gap-1 font-mono text-[8.5px] text-fuchsia-300 ml-auto shrink-0" title="Loaded last — this mod's change survives">
                      <Crown className="w-2.5 h-2.5" /> {e.winner}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Issues list container (package diagnostics detail) */}
      {showPackage && (
      <div className="shrink-0 space-y-2 min-h-0 pr-1 transition-all">
        {diagnostics.length === 0 ? (
          diagnosticSource === 'local' ? (
            <div className="text-amber-300/90 text-[10.5px] leading-normal flex flex-col items-center justify-center text-center gap-2 bg-amber-500/5 p-4 rounded-lg border border-amber-500/20 font-sans font-medium h-32">
              <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0 mb-1" />
              <span className="font-mono font-bold uppercase text-[9px] text-amber-300 tracking-wider">Schema Check Offline</span>
              <span>The game-schema validation didn't run (backend reloading). This is <b>not</b> a clean-schema confirmation — only local heuristics ran. It re-checks automatically.</span>
            </div>
          ) : (
            <div className="text-emerald-400/90 text-[10.5px] leading-normal flex flex-col items-center justify-center text-center gap-2 bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/10 font-sans font-medium h-32">
              <CheckCircle className="w-7 h-7 text-emerald-400 shrink-0 mb-1" />
              <span className="font-mono font-bold uppercase text-[9px] text-emerald-300 tracking-wider">Mod Status Clean</span>
              <span>The current mod passes the available X4 schemas, corpus references, script-property, and cross-file checks.</span>
            </div>
          )
        ) : (
          <div className="space-y-2 font-sans">
            {diagnostics.map((diag, index) => {
              const itemStyle = diag.severity === 'error'
                ? 'bg-red-500/5 text-red-350 border-red-500/20'
                : (diag.severity === 'warning' ? 'bg-amber-500/5 text-amber-300 border-amber-500/25' : 'bg-blue-500/5 text-blue-300 border-blue-500/20');

              const navigable = !!diag.sourceRef;
              const navigateToSource = () => {
                if (!diag.sourceRef) return;
                window.dispatchEvent(new CustomEvent('navigate-to-source', { detail: diag.sourceRef }));
              };

              return (
                <div
                  key={index}
                  onClick={navigable ? navigateToSource : undefined}
                  title={navigable ? 'Jump to source in the editor' : undefined}
                  className={`p-2.5 rounded-lg border text-[10.5px] leading-relaxed flex items-start gap-2 ${itemStyle} ${navigable ? 'cursor-pointer hover:bg-white/5 transition-all' : ''}`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div className="space-y-1">
                    <span className="font-mono font-bold tracking-tight text-white uppercase block text-[8px] leading-none mb-1">
                      [{diag.severity}] {diag.domain ? `${diag.domain.toUpperCase()} / ` : ''}{diag.code || diag.category.toUpperCase()}
                    </span>
                    {diag.filePath && (
                      <span className="font-mono text-[9px] text-slate-300 block bg-black/35 px-1 py-0.5 rounded border border-white/5 truncate max-w-full">
                        {diag.filePath}
                      </span>
                    )}
                    <p className="text-slate-300 leading-normal">{diag.message}</p>
                    {diag.sourceRef && (
                      <span className="font-mono text-[8px] text-cyan-300/90 block mt-1">
                        SOURCE: {diag.sourceRef.kind}{diag.sourceRef.label ? ` / ${diag.sourceRef.label}` : ''}{diag.sourceRef.id ? ` / ${diag.sourceRef.id}` : ''} →
                      </span>
                    )}
                    <DiagnosticGuidance
                      diagnostic={diag}
                      workspace={workspace}
                      onSuppressionCommitted={onSuppressionCommitted}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
