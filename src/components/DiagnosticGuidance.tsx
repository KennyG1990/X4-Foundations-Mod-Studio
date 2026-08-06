/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { CheckCircle, HelpCircle, Loader2, ShieldOff, X } from 'lucide-react';
import type { ModWorkspace, PackageDiagnostic } from '../types';
import { explainDiagnostic } from '../lib/diagnosticExplain';

interface DiagnosticGuidanceProps {
  diagnostic: PackageDiagnostic;
  workspace: ModWorkspace;
  onSuppressionCommitted?: (sourceHash: string) => void;
}

interface PrepareResponse {
  success?: boolean;
  code?: string;
  error?: string;
  target?: string;
  scope?: NonNullable<PackageDiagnostic['suppressionScope']>;
  expectedSha256?: string | null;
  defaults?: { id: string; owner: string; reason: string; reviewBy: string };
  existingSuppressions?: number;
}

function responseError(body: PrepareResponse, fallback: string): string {
  return body.error ? `${body.code ? `${body.code}: ` : ''}${body.error}` : fallback;
}

function formatGameVersionScope(scope: { minGameVersion?: string; maxGameVersion?: string }): string {
  if (scope.minGameVersion === undefined && scope.maxGameVersion === undefined) return 'all versions (no explicit bounds)';
  return [
    scope.minGameVersion === undefined ? 'min: unbounded' : `min: ${scope.minGameVersion}`,
    scope.maxGameVersion === undefined ? 'max: unbounded' : `max: ${scope.maxGameVersion}`,
  ].join(' · ');
}

export default function DiagnosticGuidance({ diagnostic, workspace, onSuppressionCommitted }: DiagnosticGuidanceProps) {
  const explanation = useMemo(() => explainDiagnostic(diagnostic), [diagnostic]);
  const matchedProvenance = explanation.ruleProvenance.kind === 'matched' ? explanation.ruleProvenance : null;
  const ambiguousProvenance = explanation.ruleProvenance.kind === 'ambiguous' ? explanation.ruleProvenance : null;
  const [expanded, setExpanded] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<PrepareResponse | null>(null);
  const [dialogError, setDialogError] = useState('');
  const [committing, setCommitting] = useState(false);
  const [review, setReview] = useState({ id: '', owner: '', reason: '', reviewBy: '' });
  const scope = diagnostic.suppressionScope;

  const prepare = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!scope) return;
    setPreparing(true);
    setDialogError('');
    try {
      const response = await fetch('/api/agent/project-rules/prepare-suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace, scope }),
      });
      const body = await response.json() as PrepareResponse;
      if (!response.ok || !body.success || !body.defaults) throw new Error(responseError(body, `Preparation failed (HTTP ${response.status}).`));
      const rememberedOwner = (() => { try { return localStorage.getItem('x4forge-suppression-owner') || ''; } catch { return ''; } })();
      setReview({ ...body.defaults, owner: rememberedOwner || body.defaults.owner });
      setPrepared(body);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : 'Suppression preparation failed.');
      setPrepared({ success: false });
    } finally {
      setPreparing(false);
    }
  };

  const commit = async (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!prepared?.success || !scope) return;
    setCommitting(true);
    setDialogError('');
    try {
      const response = await fetch('/api/agent/project-rules/suppress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace, scope, expectedSha256: prepared.expectedSha256, review }),
      });
      const body = await response.json() as PrepareResponse & { sourceHash?: string };
      if (!response.ok || !body.success || !body.sourceHash) throw new Error(responseError(body, `Write failed (HTTP ${response.status}).`));
      try { localStorage.setItem('x4forge-suppression-owner', review.owner.trim()); } catch { /* optional convenience */ }
      setPrepared(null);
      onSuppressionCommitted?.(body.sourceHash);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : 'Suppression write failed.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="pt-1.5" onClick={event => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          data-testid={`diagnostic-why-${diagnostic.code || 'finding'}`}
          onClick={() => setExpanded(value => !value)}
          className="flex items-center gap-1 rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-1 font-mono text-[8px] font-bold uppercase text-sky-200 hover:bg-sky-500/20 cursor-pointer"
          aria-expanded={expanded}
        >
          <HelpCircle className="h-3 w-3" /> Why?
        </button>
        {scope && (
          <button
            type="button"
            data-testid={`diagnostic-suppress-${diagnostic.code || 'warning'}`}
            onClick={prepare}
            disabled={preparing}
            className="flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-1 font-mono text-[8px] font-bold uppercase text-amber-200 hover:bg-amber-500/20 cursor-pointer disabled:opacity-50"
            title="Add a reviewed exact warning suppression to this mod's root forge.rules.json"
          >
            {preparing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />}
            Suppress warning
          </button>
        )}
      </div>

      {expanded && (
        <div data-testid="diagnostic-why-panel" className="mt-2 space-y-1.5 rounded border border-sky-500/20 bg-black/35 p-2 text-[9.5px] leading-normal text-slate-300">
          <p className="font-mono text-[9px] font-bold uppercase text-sky-200">{explanation.title}</p>
          <p><b className="text-slate-200">Why:</b> {explanation.why}</p>
          <p><b className="text-slate-200">Impact:</b> {explanation.impact}</p>
          <p><b className="text-slate-200">Next:</b> {explanation.next}</p>
          {matchedProvenance && (
            <div data-testid="diagnostic-rule-provenance" className="space-y-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 p-1.5 font-mono text-[8px] text-emerald-100">
              <div><span className="text-emerald-300/70">Rule ID/version:</span> {matchedProvenance.ruleId} / {matchedProvenance.ruleVersion}</div>
              <div><span className="text-emerald-300/70">Evidence grade:</span> {matchedProvenance.evidence.grade}</div>
              <div><span className="text-emerald-300/70">Applicability:</span> {matchedProvenance.applicability}</div>
              <div><span className="text-emerald-300/70">Pack ID/version:</span> {matchedProvenance.packId} / {matchedProvenance.packVersion}</div>
              <div className="break-all"><span className="text-emerald-300/70">Pack SHA-256:</span> {matchedProvenance.packSha256}</div>
              <div><span className="text-emerald-300/70">Evidence basis:</span> {matchedProvenance.evidence.basis}</div>
              <div className="break-all"><span className="text-emerald-300/70">Evidence digest:</span> {matchedProvenance.evidence.digestSha256}</div>
              <div><span className="text-emerald-300/70">Game scope:</span> {formatGameVersionScope(matchedProvenance.scope)}</div>
            </div>
          )}
          {ambiguousProvenance && (
            <div data-testid="diagnostic-rule-provenance" className="space-y-0.5 rounded border border-amber-500/20 bg-amber-500/5 p-1.5 font-mono text-[8px] text-amber-100">
              <div><span className="text-amber-300/70">Governed rule selection:</span> refused</div>
              <div><span className="text-amber-300/70">Refusal:</span> {ambiguousProvenance.refusal}</div>
              <div><span className="text-amber-300/70">Candidate IDs:</span> {ambiguousProvenance.candidates.map(candidate => `${candidate.packId}/${candidate.ruleId}@${candidate.ruleVersion}`).join(', ') || 'none reported'}</div>
            </div>
          )}
          <p className="font-mono text-[8px] text-slate-500">Basis: {explanation.basis} · deterministic, no AI</p>
        </div>
      )}

      {prepared && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-5" onClick={() => !committing && setPrepared(null)}>
          <form
            data-testid="suppression-review-dialog"
            onSubmit={commit}
            onClick={event => event.stopPropagation()}
            className="w-full max-w-xl space-y-3 rounded-lg border border-amber-500/30 bg-[#0d0f14] p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-mono text-sm font-bold uppercase text-amber-200">Review exact warning suppression</h3>
                <p className="mt-1 text-[10px] leading-normal text-slate-400">This acknowledges one warning; it does not fix source code. The validator will keep all errors visible.</p>
              </div>
              <button type="button" onClick={() => setPrepared(null)} disabled={committing} className="text-slate-400 hover:text-white cursor-pointer disabled:opacity-50" title="Cancel"><X className="h-4 w-4" /></button>
            </div>

            {prepared.success && prepared.scope && (
              <>
                <div className="space-y-1 rounded border border-white/10 bg-black/30 p-2 font-mono text-[9px] text-slate-300">
                  <div><span className="text-slate-500">Target:</span> {prepared.target}</div>
                  <div><span className="text-slate-500">Code:</span> {prepared.scope.code}</div>
                  {prepared.scope.file && <div><span className="text-slate-500">File:</span> {prepared.scope.file}</div>}
                  {prepared.scope.sourceRef && <div className="break-all"><span className="text-slate-500">Source:</span> {prepared.scope.sourceRef}</div>}
                  <div><span className="text-slate-500">Existing suppressions:</span> {prepared.existingSuppressions || 0}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[9px] font-bold uppercase text-slate-400">Rule ID
                    <input data-testid="suppression-rule-id" required value={review.id} onChange={event => setReview(value => ({ ...value, id: event.target.value }))} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[10px] normal-case text-slate-200 outline-none focus:border-amber-500/50" />
                  </label>
                  <label className="space-y-1 text-[9px] font-bold uppercase text-slate-400">Owner
                    <input data-testid="suppression-owner" required value={review.owner} onChange={event => setReview(value => ({ ...value, owner: event.target.value }))} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[10px] normal-case text-slate-200 outline-none focus:border-amber-500/50" placeholder="Maintainer name" />
                  </label>
                </div>
                <label className="block space-y-1 text-[9px] font-bold uppercase text-slate-400">Reason
                  <textarea data-testid="suppression-reason" required minLength={8} value={review.reason} onChange={event => setReview(value => ({ ...value, reason: event.target.value }))} className="min-h-16 w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1.5 font-sans text-[10px] normal-case text-slate-200 outline-none focus:border-amber-500/50" />
                </label>
                <label className="block space-y-1 text-[9px] font-bold uppercase text-slate-400">Review by
                  <input data-testid="suppression-review-by" type="date" required value={review.reviewBy} onChange={event => setReview(value => ({ ...value, reviewBy: event.target.value }))} className="rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[10px] normal-case text-slate-200 outline-none focus:border-amber-500/50" />
                </label>
              </>
            )}

            {dialogError && <div data-testid="suppression-error" className="rounded border border-red-500/25 bg-red-500/10 p-2 text-[10px] text-red-200">{dialogError}</div>}

            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
              <button type="button" onClick={() => setPrepared(null)} disabled={committing} className="rounded border border-white/10 px-3 py-1.5 text-[9px] font-bold uppercase text-slate-300 hover:bg-white/5 cursor-pointer disabled:opacity-50">Cancel</button>
              {prepared.success && (
                <button data-testid="suppression-confirm" type="submit" disabled={committing} className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-[9px] font-bold uppercase text-amber-100 hover:bg-amber-500/25 cursor-pointer disabled:opacity-50">
                  {committing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                  Confirm reviewed suppression
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
