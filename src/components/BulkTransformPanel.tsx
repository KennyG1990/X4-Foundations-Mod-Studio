import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Loader2, Play, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { sanitizeWorkspace, type ModWorkspace } from '../types';
import { workspaceContentHash } from '../lib/workspaceIdentity';
import XPathInput from './XPathInput';

type Operation = 'multiply' | 'add' | 'set' | 'round' | 'min' | 'max' | 'clamp';
interface OperationDraft {
  id: string;
  selector: string;
  operation: Operation;
  operand: string;
  upperOperand: string;
  rounding: 'none' | 'round' | 'floor' | 'ceil';
  roundingIncrement: string;
}
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
  changes?: Array<{ operationId: string; selector: string; oldValue: string; newValue: string }>;
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
const MAX_OPERATIONS = 16;

function newOperation(index: number, copy?: OperationDraft): OperationDraft {
  return copy
    ? { ...copy, id: `operation-${Date.now()}-${index}` }
    : {
        id: `operation-${Date.now()}-${index}`,
        selector: index === 1 ? '/macros/macro/properties/hull/@max' : '',
        operation: 'multiply', operand: '1.5', upperOperand: '2', rounding: 'none', roundingIncrement: '1',
      };
}

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
  const [operations, setOperations] = useState<OperationDraft[]>([newOperation(1)]);
  const [maxFiles, setMaxFiles] = useState(250);
  const [preview, setPreview] = useState<PreviewPlan | null>(null);
  const [busy, setBusy] = useState<'sample' | 'preview' | 'apply' | null>(null);
  const [error, setError] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null);

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

  const rule = useMemo(() => {
    const normalized = operations.map(operation => ({
      id: operation.id,
      selector: operation.selector.trim(),
      operation: operation.operation,
      operand: operation.operation === 'clamp' ? [Number(operation.operand), Number(operation.upperOperand)] : Number(operation.operand),
      rounding: operation.rounding,
      roundingIncrement: Number(operation.roundingIncrement),
    }));
    const first = normalized[0];
    return {
      pathPrefix: pathPrefix.trim(),
      selector: first?.selector || '', operation: first?.operation || 'multiply', operand: first?.operand ?? 0,
      rounding: first?.rounding || 'none', roundingIncrement: first?.roundingIncrement ?? 1,
      operations: normalized,
      maxFiles,
    };
  }, [pathPrefix, operations, maxFiles]);

  const updateOperation = (id: string, change: Partial<OperationDraft>) => {
    setOperations(current => current.map(operation => operation.id === id ? { ...operation, ...change } : operation));
    setPreview(null);
  };

  const addOperation = (copy?: OperationDraft) => {
    setOperations(current => current.length >= MAX_OPERATIONS ? current : [...current, newOperation(current.length + 1, copy)]);
    setPreview(null);
  };

  const removeOperation = (id: string) => {
    setOperations(current => current.length === 1 ? current : current.filter(operation => operation.id !== id));
    setPreview(null);
  };

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

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[9px] uppercase font-mono font-bold text-slate-500">Numeric operations ({operations.length}/{MAX_OPERATIONS})</span>
          <button data-testid="bulk-add-operation" onClick={() => addOperation()} disabled={operations.length >= MAX_OPERATIONS} className="flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-mono text-[8px] font-bold uppercase text-cyan-300 disabled:opacity-35"><Plus className="h-3 w-3" /> Add field</button>
        </div>
        <div className="mt-2 space-y-3">
          {operations.map((draft, index) => <div key={draft.id} data-testid={`bulk-operation-row-${index}`} className="rounded border border-white/10 bg-black/25 p-2.5">
            <div className="mb-2 flex items-center justify-between font-mono text-[8px] font-bold uppercase text-slate-500">
              <span>Field {index + 1}</span>
              <div className="flex gap-1">
                <button title="Duplicate operation" onClick={() => addOperation(draft)} disabled={operations.length >= MAX_OPERATIONS} className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-cyan-300 disabled:opacity-30"><Copy className="h-3 w-3" /></button>
                <button title="Remove operation" onClick={() => removeOperation(draft.id)} disabled={operations.length === 1} className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-red-300 disabled:opacity-30"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
            {samplePath ? <XPathInput testId={index === 0 ? 'bulk-selector' : `bulk-selector-${index}`} targetPath={samplePath} value={draft.selector} onChange={value => updateOperation(draft.id, { selector: value })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-2 font-mono text-[10px] text-emerald-300 focus:border-cyan-500 focus:outline-none" />
              : <input data-testid={index === 0 ? 'bulk-selector' : `bulk-selector-${index}`} value={draft.selector} onChange={event => updateOperation(draft.id, { selector: event.target.value })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-2 font-mono text-[10px] text-emerald-300 focus:border-cyan-500 focus:outline-none" />}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select data-testid={index === 0 ? 'bulk-operation' : `bulk-operation-${index}`} value={draft.operation} onChange={event => updateOperation(draft.id, { operation: event.target.value as Operation })} className="rounded border border-white/10 bg-[#090b10] px-2 py-1.5 text-[10px] text-slate-200">
                <option value="multiply">Multiply</option><option value="add">Add</option><option value="set">Set</option><option value="round">Round value</option><option value="min">Minimum</option><option value="max">Maximum</option><option value="clamp">Clamp</option>
              </select>
              <input aria-label={`Field ${index + 1} operand`} type="number" step="any" disabled={draft.operation === 'round'} value={draft.operand} onChange={event => updateOperation(draft.id, { operand: event.target.value })} className="rounded border border-white/10 bg-[#090b10] px-2 py-1.5 text-[10px] text-slate-200 disabled:opacity-40" />
              {draft.operation === 'clamp' && <input aria-label={`Field ${index + 1} maximum`} type="number" step="any" value={draft.upperOperand} onChange={event => updateOperation(draft.id, { upperOperand: event.target.value })} className="rounded border border-white/10 bg-[#090b10] px-2 py-1.5 text-[10px] text-slate-200" />}
              <select data-testid={index === 0 ? 'bulk-rounding' : `bulk-rounding-${index}`} aria-label={`Field ${index + 1} rounding`} value={draft.rounding} onChange={event => updateOperation(draft.id, { rounding: event.target.value as OperationDraft['rounding'] })} className="rounded border border-white/10 bg-[#090b10] px-2 py-1.5 text-[10px] text-slate-200"><option value="none">No rounding</option><option value="round">Nearest</option><option value="floor">Floor</option><option value="ceil">Ceiling</option></select>
              <input data-testid={index === 0 ? 'bulk-rounding-increment' : `bulk-rounding-increment-${index}`} aria-label={`Field ${index + 1} rounding increment`} type="number" min="0" step="any" value={draft.roundingIncrement} onChange={event => updateOperation(draft.id, { roundingIncrement: event.target.value })} className="rounded border border-white/10 bg-[#090b10] px-2 py-1.5 text-[10px] text-slate-200" title="Round to this quantum, e.g. 100 or 1000. Use 1 for whole units." />
            </div>
          </div>)}
        </div>

        <label className="mt-4 block text-[9px] uppercase font-mono font-bold text-slate-500">Safety cap
          <input type="number" min={1} max={500} value={maxFiles} onChange={event => { setMaxFiles(Number(event.target.value)); setPreview(null); }} className="mt-1 block w-full rounded border border-white/10 bg-[#090b10] px-2 py-2 text-[11px] text-slate-200" />
        </label>
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
                  ? row.changes && row.changes.length > 1
                    ? <span className="text-emerald-300">{row.changes.length} fields</span>
                    : <><span className="text-slate-500">{row.oldValue}</span> <span className="text-slate-700">→</span> <span className="text-emerald-300">{row.newValue}</span></>
                  : <span className={status === 'error' ? 'text-red-300' : 'text-slate-600'}>{status === 'skipped' ? `${row.matchCount || 0} matches` : 'inspect error'}</span>;
                const resultLabel = status === 'matched' ? (row.simulationOk ? 'PASS' : 'FAIL') : status === 'skipped' ? 'SKIP' : 'ERROR';
                const resultClass = status === 'matched' && row.simulationOk ? 'text-emerald-400' : status === 'skipped' ? 'text-slate-500' : 'text-red-400';
                return <button type="button" onClick={() => setExpandedTarget(current => current === row.targetFile ? null : row.targetFile)} key={row.targetFile} title={findingTitle || 'Click to inspect every field change'} style={{ position: 'absolute', top: (visibleRows.start + offset) * ROW_HEIGHT, height: ROW_HEIGHT, left: 0, right: 0 }} className="grid grid-cols-[minmax(260px,1fr)_150px_110px_90px] items-center border-b border-white/5 px-3 text-left font-mono text-[9px] hover:bg-white/[0.02]"><span className="truncate text-slate-300" title={row.targetFile}>{row.targetFile}</span><span className="truncate text-cyan-400/70" title={sourceLabel}>{sourceLabel}</span><span>{value}</span><span className={resultClass}>{resultLabel}</span></button>;
              })}
            </div>
          </div>
          {expandedTarget && (() => {
            const row = (preview.files || []).find(file => file.targetFile === expandedTarget);
            if (!row?.changes?.length) return null;
            return <div className="max-h-36 overflow-y-auto border-t border-cyan-500/15 bg-cyan-500/[0.03] p-3 font-mono text-[9px]">
              <div className="mb-2 truncate font-bold text-cyan-300" title={row.targetFile}>{row.targetFile} · combined atomic preview</div>
              {row.changes.map(change => <div key={change.operationId} className="grid grid-cols-[minmax(240px,1fr)_160px] gap-3 border-t border-white/5 py-1"><span className="truncate text-slate-400" title={change.selector}>{change.selector}</span><span><span className="text-slate-500">{change.oldValue}</span> <span className="text-slate-700">→</span> <span className="text-emerald-300">{change.newValue}</span></span></div>)}
            </div>;
          })()}
          <footer className="border-t border-white/10 p-3 flex items-center justify-between"><span className="font-mono text-[8.5px] text-slate-600">plan {preview.planHash?.slice(0, 12)} · conflicts {preview.conflicts.length}</span><button onClick={apply} disabled={!preview.ok || busy !== null} className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-mono text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35">{busy === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {preview.rows.length === preview.matchedFiles ? `Add ${preview.matchedFiles} validated patches to workspace` : `Add ${preview.rows.length} validated field patches to workspace`}</button></footer>
        </>}
      </section>
    </div>
  );
}
