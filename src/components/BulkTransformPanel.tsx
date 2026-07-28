import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Play, ShieldCheck } from 'lucide-react';
import { sanitizeWorkspace, type ModWorkspace } from '../types';
import { workspaceContentHash } from '../lib/workspaceIdentity';
import XPathInput from './XPathInput';

type Operation = 'multiply' | 'add' | 'set' | 'round' | 'min' | 'max' | 'clamp';
interface PreviewRow {
  targetFile: string;
  status?: 'matched' | 'skipped' | 'error';
  matchCount?: number;
  selector?: string;
  oldValue?: string;
  newValue?: string;
  simulationOk?: boolean;
  sources: Array<{ source: string; mode: string }>;
  findings: Array<{ severity: string; code: string; message: string }>;
}
interface PreviewPlan {
  ok: boolean;
  rule: Record<string, unknown>;
  planHash: string;
  candidateCount: number;
  matchedFiles: number;
  skippedFiles: number;
  droppedCount: number;
  rows: PreviewRow[];
  files?: PreviewRow[];
  conflicts: Array<{ targetFile: string; selector: string }>;
  findings: Array<{ severity: string; code: string; message: string; path?: string }>;
  workspaceHash: string;
}

interface Props {
  workspace: ModWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ModWorkspace>>;
  saveCheckpoint?: (customTarget?: ModWorkspace) => void;
  onServerWorkspaceApplied?: (workspace: ModWorkspace, metadata: { workspaceHash: string; version: number }) => void;
}

const ROW_HEIGHT = 44;

function logicalPath(path: string): string {
  const parts = String(path || '').replace(/\\/g, '/').split('/');
  return parts[0]?.toLowerCase() === 'extensions' && parts.length > 2 ? parts.slice(2).join('/') : parts.join('/');
}

function pathMatchesPrefix(candidate: string, prefix: string): boolean {
  const normalized = prefix.replace(/\/+$/, '');
  return candidate === normalized || candidate.startsWith(`${normalized}/`);
}

async function jsonResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.message || body.error || `Request failed (${response.status})`), { body });
  return body;
}

export default function BulkTransformPanel({ workspace, setWorkspace, saveCheckpoint, onServerWorkspaceApplied }: Props) {
  const [pathPrefix, setPathPrefix] = useState('assets/units/size_xl/macros');
  const [samplePath, setSamplePath] = useState('');
  const [selector, setSelector] = useState('/macros/macro/properties/hull/@max');
  const [operation, setOperation] = useState<Operation>('multiply');
  const [operand, setOperand] = useState('1.5');
  const [upperOperand, setUpperOperand] = useState('2');
  const [rounding, setRounding] = useState<'none' | 'round' | 'floor' | 'ceil'>('none');
  const [roundingIncrement, setRoundingIncrement] = useState('1');
  const [maxFiles, setMaxFiles] = useState(250);
  const [preview, setPreview] = useState<PreviewPlan | null>(null);
  const [busy, setBusy] = useState<'sample' | 'preview' | 'apply' | null>(null);
  const [error, setError] = useState('');
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const prefix = pathPrefix.trim();
      if (!prefix) return setSamplePath('');
      setBusy(current => current || 'sample');
      try {
        const response = await fetch(`/api/reference/manifest?q=${encodeURIComponent(prefix)}&extension=xml&limit=100`, { signal: controller.signal });
        const data = await jsonResponse(response);
        const files = Array.isArray(data.files) ? data.files : [];
        // XPath completion needs a representative document with enough structure to be useful.
        // The first alphabetic file is often a tiny cockpit/helper macro with none of the
        // elements present in the ships the user actually intends to transform. Prefer the
        // largest official XML under the scope; base wins an exact-size tie for determinism.
        const hit = files
          .filter((file: any) => (file.source === 'base' || String(file.source || '').startsWith('ego_dlc_')) && pathMatchesPrefix(logicalPath(file.path), prefix))
          .sort((left: any, right: any) => (Number(right.bytes) - Number(left.bytes))
            || ((left.source === 'base' ? 0 : 1) - (right.source === 'base' ? 0 : 1))
            || String(left.path).localeCompare(String(right.path)))[0];
        setSamplePath(hit ? logicalPath(hit.path) : '');
      } catch (sampleError) {
        if ((sampleError as Error).name !== 'AbortError') setSamplePath('');
      } finally { setBusy(current => current === 'sample' ? null : current); }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [pathPrefix]);

  const rule = useMemo(() => ({
    pathPrefix: pathPrefix.trim(),
    selector: selector.trim(),
    operation,
    operand: operation === 'clamp' ? [Number(operand), Number(upperOperand)] : Number(operand),
    rounding,
    roundingIncrement: Number(roundingIncrement),
    maxFiles,
  }), [pathPrefix, selector, operation, operand, upperOperand, rounding, roundingIncrement, maxFiles]);

  const runPreview = async () => {
    setBusy('preview'); setError(''); setPreview(null);
    try {
      const response = await fetch('/api/agent/bulk-transform/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rule }),
      });
      const body = await response.json().catch(() => ({}));
      const plan = (body.plan || body) as PreviewPlan;
      if (plan?.rows) setPreview(plan);
      const localHash = workspaceContentHash(sanitizeWorkspace(workspace));
      if (response.ok && plan.workspaceHash !== localHash) {
        setError('The canvas has not finished synchronizing to the server. Wait a moment, then preview again; no patches were applied.');
        setPreview({ ...plan, ok: false });
      } else if (!response.ok) setError(body.message || body.error || plan.findings?.[0]?.message || `Preview failed (${response.status})`);
    } catch (previewError) { setError(previewError instanceof Error ? previewError.message : String(previewError)); }
    finally { setBusy(null); }
  };

  const apply = async () => {
    if (!preview?.ok) return;
    setBusy('apply'); setError('');
    try {
      const response = await fetch('/api/agent/bulk-transform/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule, expectedPlanHash: preview.planHash, expectedHead: preview.workspaceHash }),
      });
      const body = await jsonResponse(response);
      saveCheckpoint?.(workspace);
      if (onServerWorkspaceApplied) onServerWorkspaceApplied(body.workspace, { workspaceHash: body.workspaceHash, version: body.version });
      else setWorkspace(body.workspace);
      setPreview({ ...body.plan, workspaceHash: body.workspaceHash });
    } catch (applyError) {
      const body = (applyError as Error & { body?: any }).body;
      if (body?.plan?.rows) setPreview({ ...body.plan, workspaceHash: body.currentHead || preview.workspaceHash });
      setError(applyError instanceof Error ? applyError.message : String(applyError));
    } finally { setBusy(null); }
  };

  const visibleRows = useMemo(() => {
    // New plans expose one result per scanned logical file. Keep rows as a compatibility
    // fallback for workspaces produced by an older sidecar during an extension reload.
    const rows = preview?.files?.length ? preview.files : (preview?.rows || []);
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4);
    return { start, rows: rows.slice(start, start + 32), total: rows.length };
  }, [preview, scrollTop]);

  return (
    <div className="flex-1 min-h-0 flex gap-4 p-4 bg-[#0a0c10] overflow-hidden">
      <section className="w-[390px] shrink-0 rounded-lg border border-white/10 bg-[#10131a] p-4 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs font-bold uppercase"><ShieldCheck className="w-4 h-4" /> Canonical Bulk Transform</div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Build numeric X4 diff patches from the effective base + DLC corpus. Preview is mandatory; vanilla and game folders remain read-only.</p>
        <label className="block mt-5 text-[9px] uppercase font-mono font-bold text-slate-500">Corpus path scope</label>
        <input data-testid="bulk-path-prefix" value={pathPrefix} onChange={event => { setPathPrefix(event.target.value); setPreview(null); }} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-2 font-mono text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none" />
        <div className="mt-1 min-h-4 truncate font-mono text-[8.5px] text-slate-600" title={samplePath}>{busy === 'sample' ? 'Finding a canonical sample…' : samplePath ? `sample: ${samplePath}` : 'No canonical XML sample found under this scope.'}</div>

        <label className="block mt-4 text-[9px] uppercase font-mono font-bold text-slate-500">Numeric XPath selector</label>
        {samplePath ? <XPathInput testId="bulk-selector" targetPath={samplePath} value={selector} onChange={value => { setSelector(value); setPreview(null); }} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-2 font-mono text-[11px] text-emerald-300 focus:border-cyan-500 focus:outline-none" />
          : <input data-testid="bulk-selector" value={selector} onChange={event => { setSelector(event.target.value); setPreview(null); }} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-2 font-mono text-[11px] text-emerald-300 focus:border-cyan-500 focus:outline-none" />}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Operation
            <select data-testid="bulk-operation" value={operation} onChange={event => { setOperation(event.target.value as Operation); setPreview(null); }} className="mt-1 block w-full rounded border border-white/10 bg-[#090b10] px-2 py-2 text-[11px] text-slate-200">
              <option value="multiply">Multiply</option><option value="add">Add</option><option value="set">Set</option><option value="round">Round value</option><option value="min">Minimum</option><option value="max">Maximum</option><option value="clamp">Clamp</option>
            </select>
          </label>
          <label className="text-[9px] uppercase font-mono font-bold text-slate-500">{operation === 'clamp' ? 'Minimum' : operation === 'round' ? 'Operand unused' : 'Operand'}
            <input type="number" step="any" disabled={operation === 'round'} value={operand} onChange={event => { setOperand(event.target.value); setPreview(null); }} className="mt-1 block w-full rounded border border-white/10 bg-[#090b10] px-2 py-2 text-[11px] text-slate-200 disabled:opacity-40" />
          </label>
          {operation === 'clamp' && <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Maximum<input type="number" step="any" value={upperOperand} onChange={event => { setUpperOperand(event.target.value); setPreview(null); }} className="mt-1 block w-full rounded border border-white/10 bg-[#090b10] px-2 py-2 text-[11px] text-slate-200" /></label>}
          <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Rounding
            <select data-testid="bulk-rounding" value={rounding} onChange={event => { setRounding(event.target.value as typeof rounding); setPreview(null); }} className="mt-1 block w-full rounded border border-white/10 bg-[#090b10] px-2 py-2 text-[11px] text-slate-200"><option value="none">None</option><option value="round">Nearest</option><option value="floor">Floor</option><option value="ceil">Ceiling</option></select>
          </label>
          <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Rounding increment
            <input data-testid="bulk-rounding-increment" type="number" min="0" step="any" value={roundingIncrement} onChange={event => { setRoundingIncrement(event.target.value); setPreview(null); }} className="mt-1 block w-full rounded border border-white/10 bg-[#090b10] px-2 py-2 text-[11px] text-slate-200" title="Round to this quantum, e.g. 100 or 1000. Use 1 for whole units." />
          </label>
          <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Safety cap
            <input type="number" min={1} max={500} value={maxFiles} onChange={event => { setMaxFiles(Number(event.target.value)); setPreview(null); }} className="mt-1 block w-full rounded border border-white/10 bg-[#090b10] px-2 py-2 text-[11px] text-slate-200" />
          </label>
        </div>
        <button onClick={runPreview} disabled={busy !== null} className="mt-5 flex w-full items-center justify-center gap-2 rounded border border-cyan-500/40 bg-cyan-500/10 py-2.5 font-mono text-[10px] font-bold uppercase text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40">{busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Preview against corpus</button>
        <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[9px] leading-relaxed text-amber-200/70">Apply changes workspace patch state only. Compile and Deploy remain separate validated operations.</div>
      </section>

      <section className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0e1117] flex flex-col overflow-hidden">
        <header className="border-b border-white/10 p-3 flex items-center justify-between">
          <div><div className="font-mono text-[10px] font-bold uppercase text-slate-300">Mandatory dry-run</div><div className="mt-1 text-[9px] text-slate-600">file · effective source · canonical old → proposed new · simulation</div></div>
          {preview && <div className={`rounded border px-3 py-1.5 font-mono text-[9px] ${preview.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{preview.ok ? `${preview.matchedFiles} VALIDATED` : 'BLOCKED — ZERO WRITES'}</div>}
        </header>
        {error && <div className="m-3 flex gap-2 rounded border border-red-500/30 bg-red-500/10 p-3 text-[10px] text-red-300"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
        {!preview ? <div className="flex-1 grid place-items-center text-center text-slate-600"><div><Play className="mx-auto mb-3 h-8 w-8 opacity-30" /><div className="font-mono text-xs">Preview before applying</div><div className="mt-1 text-[9px]">No workspace or game files are written during preview.</div></div></div> : <>
          <div className="grid grid-cols-4 gap-2 border-b border-white/5 p-3 text-center font-mono text-[9px]"><div><b className="block text-lg text-slate-200">{preview.candidateCount}</b><span className="text-slate-600">candidates</span></div><div><b className="block text-lg text-emerald-300">{preview.matchedFiles}</b><span className="text-slate-600">matched</span></div><div><b className="block text-lg text-slate-400">{preview.skippedFiles}</b><span className="text-slate-600">no match</span></div><div><b className={`block text-lg ${preview.droppedCount ? 'text-red-300' : 'text-slate-400'}`}>{preview.droppedCount}</b><span className="text-slate-600">over cap</span></div></div>
          {preview.findings.length > 0 && <div className="max-h-24 overflow-y-auto border-b border-white/5 p-2 font-mono text-[9px]">{preview.findings.map((finding, index) => <div key={`${finding.code}-${index}`} className={finding.severity === 'error' ? 'text-red-300' : 'text-amber-300'}>{finding.code}: {finding.path ? `${finding.path} — ` : ''}{finding.message}</div>)}</div>}
          <div className="grid grid-cols-[minmax(260px,1fr)_150px_110px_90px] border-b border-white/10 bg-black/20 px-3 py-2 font-mono text-[8px] font-bold uppercase text-slate-600"><span>Canonical file</span><span>Effective source</span><span>Value</span><span>Simulation</span></div>
          <div className="relative flex-1 overflow-y-auto custom-scrollbar" onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
            <div style={{ height: visibleRows.total * ROW_HEIGHT, position: 'relative' }}>
              {visibleRows.rows.map((row, offset) => {
                const status = row.status || (row.simulationOk ? 'matched' : 'error');
                const sourceLabel = row.sources.map(source => `${source.source}${source.mode === 'base' ? '' : ` (${source.mode})`}`).join(' + ') || 'unavailable';
                const findingTitle = row.findings.map(finding => `${finding.code}: ${finding.message}`).join('\n');
                const value = status === 'matched'
                  ? <><span className="text-slate-500">{row.oldValue}</span> <span className="text-slate-700">→</span> <span className="text-emerald-300">{row.newValue}</span></>
                  : <span className={status === 'error' ? 'text-red-300' : 'text-slate-600'}>{status === 'skipped' ? `${row.matchCount || 0} matches` : 'inspect error'}</span>;
                const resultLabel = status === 'matched' ? (row.simulationOk ? 'PASS' : 'FAIL') : status === 'skipped' ? 'SKIP' : 'ERROR';
                const resultClass = status === 'matched' && row.simulationOk ? 'text-emerald-400' : status === 'skipped' ? 'text-slate-500' : 'text-red-400';
                return <div key={row.targetFile} title={findingTitle || undefined} style={{ position: 'absolute', top: (visibleRows.start + offset) * ROW_HEIGHT, height: ROW_HEIGHT, left: 0, right: 0 }} className="grid grid-cols-[minmax(260px,1fr)_150px_110px_90px] items-center border-b border-white/5 px-3 font-mono text-[9px] hover:bg-white/[0.02]"><span className="truncate text-slate-300" title={row.targetFile}>{row.targetFile}</span><span className="truncate text-cyan-400/70" title={sourceLabel}>{sourceLabel}</span><span>{value}</span><span className={resultClass}>{resultLabel}</span></div>;
              })}
            </div>
          </div>
          <footer className="border-t border-white/10 p-3 flex items-center justify-between"><span className="font-mono text-[8.5px] text-slate-600">plan {preview.planHash?.slice(0, 12)} · conflicts {preview.conflicts.length}</span><button onClick={apply} disabled={!preview.ok || busy !== null} className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-mono text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35">{busy === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Add {preview.matchedFiles} validated patches to workspace</button></footer>
        </>}
      </section>
    </div>
  );
}
