/** Read-only canonical X4 unpacked-reference routes and validation service. */

import fs from 'fs';
import path from 'path';
import type { Express, Request, Response } from 'express';
import { resolveXsdConfig } from '../lib/xsdParser';
import {
  getReferenceCorpus,
  resolveReferenceFile,
  runReferenceCorpusSelftest,
  type ReferenceCorpus,
} from '../lib/referenceCorpus';
import {
  completeReferenceDocument,
  getReferenceLanguageResources,
  hoverReferenceDocument,
  type ReferenceLanguageRequest,
} from '../lib/referenceLanguage';
import {
  getReferenceCoverage,
  getReferenceManifestStatus,
  queryReferenceManifest,
  scheduleReferenceManifest,
  type ReferenceManifestStatus,
} from '../lib/referenceManifest';
import { resolveEffectiveReferenceDocument } from '../lib/referenceOverlay';
import { simulateXmlDiff } from '../lib/diffSimulator';
import { projectReferenceSymbols, suggestReferences, type ReferenceSuggestionIntent } from '../lib/referenceSuggestions';
import type { CanonicalSymbolKind } from '../lib/referenceCorpus';
import type { ModWorkspace } from '../types';
import { completeXPath } from '../lib/xpathCompletion';

function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function forceRefresh(req: Request): boolean { return /^(1|true|yes)$/i.test(String(req.query.refresh || '')); }

function load(req?: Request): ReferenceCorpus {
  const resolved = resolveXsdConfig();
  return getReferenceCorpus(resolved.x4ReferenceRoot, req ? forceRefresh(req) : false);
}

export function getCanonicalReferenceCorpus(): ReferenceCorpus | null {
  try { return load(); } catch { return null; }
}

function languageRequest(req: Request): ReferenceLanguageRequest {
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const filePath = typeof body.path === 'string' ? body.path : '';
  const content = typeof body.content === 'string' ? body.content : '';
  const line = Number(body.line);
  const column = Number(body.column);
  if (!filePath.trim()) throw new Error('Invalid request: path is required.');
  if (typeof body.content !== 'string') throw new Error('Invalid request: content must be a string.');
  if (content.length > 5_000_000) throw new Error('Invalid request: content exceeds 5 MB.');
  if (!Number.isInteger(line) || !Number.isInteger(column) || line < 0 || column < 0) {
    throw new Error('Invalid request: line and column must be non-negative integers.');
  }
  return { path: filePath, content, line, column };
}

export function getCanonicalReferenceSets(): { macros: Set<string>; wares: Set<string>; factions: Set<string>; sectors: Set<string>; jobs: Set<string>; aiScripts: Set<string> } {
  try { return load().references; }
  catch { return { macros: new Set(), wares: new Set(), factions: new Set(), sectors: new Set(), jobs: new Set(), aiScripts: new Set() }; }
}

export function initializeReferenceCorpus(): void {
  const resolved = resolveXsdConfig();
  if (!resolved.x4ReferenceExists) {
    console.warn(`[reference-corpus] unavailable: ${resolved.x4ReferenceRoot} (set X4_REFERENCE_ROOT or Directory Settings)`);
    return;
  }
  try {
    const corpus = getReferenceCorpus(resolved.x4ReferenceRoot);
    console.log(`[reference-corpus] loaded ${corpus.factions.length} factions, ${corpus.wares.length} wares, ${corpus.sectors.length} sectors from ${corpus.sourceFiles.length} files (${corpus.root})`);
    const manifest = getReferenceManifestStatus(corpus.root);
    console.log(`[reference-manifest] ${manifest.state}: ${manifest.root}`);
  } catch (error) {
    console.warn(`[reference-corpus] failed to load ${resolved.x4ReferenceRoot}: ${errorText(error)}`);
  }
}

export function startCanonicalReferenceManifest(force = false): ReferenceManifestStatus {
  const resolved = resolveXsdConfig();
  return scheduleReferenceManifest(resolved.x4ReferenceRoot, force);
}

function sendCorpusError(res: Response, error: unknown): Response {
  const message = errorText(error);
  if (/invalid request|outside the document|outside line/i.test(message)) return res.status(400).json({ error: message });
  if (/missing path/i.test(message)) return res.status(400).json({ error: message });
  if (/traversal/i.test(message)) return res.status(403).json({ error: message });
  if (/file not found/i.test(message)) return res.status(404).json({ error: message });
  if (/root.*(unavailable|does not exist|not a directory)/i.test(message)) return res.status(503).json({ error: message });
  return res.status(500).json({ error: message || 'Reference corpus request failed.' });
}

export function registerReferenceRoutes(app: Express, workspaceProvider?: () => ModWorkspace | null | undefined): void {
  app.get('/api/reference/effective-file', (req, res) => {
    try {
      const corpus = load(req);
      const effective = resolveEffectiveReferenceDocument(corpus.root, String(req.query.path || ''), forceRefresh(req));
      if (!effective.available || effective.content === undefined) return res.status(404).json({ error: `Canonical effective file not found: ${String(req.query.path || '')}`, ...effective });
      return res.json(effective);
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.post('/api/reference/xpath-complete', (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
      const relativePath = typeof body.path === 'string' ? body.path.trim() : '';
      const selector = typeof body.selector === 'string' ? body.selector : '';
      const cursor = Number(body.cursor);
      if (!relativePath) throw new Error('Invalid request: path is required.');
      if (typeof body.selector !== 'string') throw new Error('Invalid request: selector must be a string.');
      if (selector.length > 16_384) throw new Error('Invalid request: selector exceeds 16 KB.');
      if (!Number.isInteger(cursor) || cursor < 0 || cursor > selector.length) throw new Error('Invalid request: cursor is outside the selector.');
      const corpus = load(req);
      const effective = resolveEffectiveReferenceDocument(corpus.root, relativePath, forceRefresh(req));
      if (!effective.available || effective.content === undefined) return res.status(404).json({ error: `Canonical effective file not found: ${relativePath}`, effective });
      const items = completeXPath({
        targetPath: effective.relativePath,
        content: effective.content,
        selector,
        cursor,
        corpus,
        limit: Number(body.limit || 50),
      });
      return res.json({ path: effective.relativePath, signature: effective.signature, sources: effective.sources, findings: effective.findings, items });
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.post('/api/reference/simulate-diff', (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
      const relativePath = typeof body.path === 'string' ? body.path.trim() : '';
      const diff = typeof body.content === 'string' ? body.content : '';
      if (!relativePath) throw new Error('Invalid request: path is required.');
      if (typeof body.content !== 'string') throw new Error('Invalid request: content must be a string.');
      if (diff.length > 5_000_000) throw new Error('Invalid request: content exceeds 5 MB.');
      const corpus = load(req);
      const effective = resolveEffectiveReferenceDocument(corpus.root, relativePath, forceRefresh(req));
      if (!effective.available || effective.content === undefined) {
        return res.status(404).json({ error: `Canonical base file not found: ${relativePath}`, effective });
      }
      const simulation = simulateXmlDiff(effective.content, diff);
      return res.json({
        path: effective.relativePath,
        base: { signature: effective.signature, sources: effective.sources, findings: effective.findings },
        ...simulation,
      });
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.post('/api/reference/complete', (req, res) => {
    try {
      const request = languageRequest(req);
      const corpus = load(req);
      return res.json(completeReferenceDocument(request, getReferenceLanguageResources(corpus, request, workspaceProvider?.())));
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.post('/api/reference/hover', (req, res) => {
    try {
      const request = languageRequest(req);
      const corpus = load(req);
      return res.json(hoverReferenceDocument(request, getReferenceLanguageResources(corpus, request, workspaceProvider?.())));
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/status', (req, res) => {
    try {
      const corpus = load(req);
      const manifest = getReferenceManifestStatus(corpus.root);
      return res.json({
        available: true,
        root: corpus.root,
        generatedAt: corpus.generatedAt,
        manifestGeneration: corpus.manifestGeneration || null,
        sourceFiles: corpus.sourceFiles.length,
        counts: { factions: corpus.factions.length, wares: corpus.wares.length, jobs: corpus.jobs.length, aiScripts: corpus.aiScripts.length, sectors: corpus.sectors.length, scriptProperties: corpus.scriptProperties.length },
        manifest,
      });
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/manifest', (req, res) => {
    try {
      const resolved = resolveXsdConfig();
      let status = forceRefresh(req)
        ? scheduleReferenceManifest(resolved.x4ReferenceRoot, true)
        : getReferenceManifestStatus(resolved.x4ReferenceRoot);
      if (status.state === 'idle') status = scheduleReferenceManifest(resolved.x4ReferenceRoot, false);
      const extensionInput = String(req.query.extension || '').trim().toLowerCase();
      const result = queryReferenceManifest(resolved.x4ReferenceRoot, {
        q: String(req.query.q || '').trim(),
        extension: extensionInput ? (extensionInput.startsWith('.') ? extensionInput : `.${extensionInput}`) : undefined,
        source: String(req.query.source || '').trim().toLowerCase() || undefined,
        domain: String(req.query.domain || '').trim().toLowerCase() || undefined,
        role: String(req.query.role || '').trim().toLowerCase() || undefined,
        authority: String(req.query.authority || '').trim().toLowerCase() || undefined,
        consumer: String(req.query.consumer || '').trim().toLowerCase() || undefined,
        limit: Number(req.query.limit || 100),
        offset: Number(req.query.offset || 0),
      });
      if (!result) return res.status(status.state === 'error' || status.state === 'unavailable' ? 503 : 202).json({ status, files: [], total: 0 });
      return res.json({ status, ...result });
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/coverage', (req, res) => {
    try {
      const resolved = resolveXsdConfig();
      let status = forceRefresh(req)
        ? scheduleReferenceManifest(resolved.x4ReferenceRoot, true)
        : getReferenceManifestStatus(resolved.x4ReferenceRoot);
      if (status.state === 'idle') status = scheduleReferenceManifest(resolved.x4ReferenceRoot, false);
      const coverage = getReferenceCoverage(resolved.x4ReferenceRoot);
      if (!coverage) return res.status(status.state === 'error' || status.state === 'unavailable' ? 503 : 202).json({ status });
      return res.json({ status, coverage });
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/factions', (req, res) => {
    try { return res.json(load(req).factions); }
    catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/wares', (req, res) => {
    try { return res.json(load(req).wares); }
    catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/jobs', (req, res) => {
    try { return res.json(load(req).jobs); }
    catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/aiscripts', (req, res) => {
    try { return res.json(load(req).aiScripts); }
    catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/suggest', (req, res) => {
    try {
      const kind = String(req.query.kind || '').trim().toLowerCase() as CanonicalSymbolKind;
      const allowedKinds = new Set<CanonicalSymbolKind>(['faction', 'ware', 'sector', 'macro', 'job', 'aiscript']);
      if (!allowedKinds.has(kind)) return res.status(400).json({ error: 'Query ?kind=faction|ware|sector|macro|job|aiscript required.' });
      const q = String(req.query.q || '').trim();
      if (!q && req.query.limit === undefined) return res.status(400).json({ error: 'Query ?q=<text> or an explicit bounded ?limit= is required.' });
      const intentInput = String(req.query.intent || 'reference').trim().toLowerCase();
      if (!['reference', 'new-definition', 'selector'].includes(intentInput)) {
        return res.status(400).json({ error: 'Query ?intent=reference|new-definition|selector required.' });
      }
      const corpus = load(req);
      const items = suggestReferences(corpus, {
        kind,
        query: q,
        intent: intentInput as ReferenceSuggestionIntent,
        limit: Number(req.query.limit || 25),
        projectSymbols: projectReferenceSymbols(workspaceProvider?.()),
      });
      return res.json({ generation: corpus.manifestGeneration || corpus.signature, kind, query: q, intent: intentInput, items });
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/sectors', (req, res) => {
    try { return res.json(load(req).sectors); }
    catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/scriptproperties', (req, res) => {
    try {
      const datatype = String(req.query.datatype || '').trim().toLowerCase();
      const keyword = String(req.query.keyword || '').trim().toLowerCase();
      const entries = load(req).scriptProperties.filter(entry =>
        (!datatype || (entry.kind === 'datatype' && entry.name === datatype))
        && (!keyword || (entry.kind === 'keyword' && entry.name === keyword)),
      );
      return res.json(entries);
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/file', (req, res) => {
    try {
      const resolved = resolveXsdConfig();
      const file = resolveReferenceFile(resolved.x4ReferenceRoot, String(req.query.path || ''));
      const ext = path.extname(file).toLowerCase();
      if (ext === '.xml' || ext === '.xsd' || ext === '.lua' || ext === '.txt' || ext === '.md') {
        const type = ext === '.xml' || ext === '.xsd' ? 'application/xml' : 'text/plain';
        return res.status(200).type(type).send(fs.readFileSync(file));
      }
      return res.status(200).type('application/octet-stream').send(fs.readFileSync(file));
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/search', (req, res) => {
    try {
      const q = String(req.query.q || '').trim().toLowerCase();
      if (!q) return res.status(400).json({ error: 'Query ?q=<text> required.' });
      const kind = String(req.query.kind || '').trim().toLowerCase();
      const corpus = load(req);
      const result: Array<Record<string, unknown>> = [];
      const push = (recordKind: string, value: Record<string, unknown>) => {
        if (kind && kind !== recordKind && !(kind === 'property' && recordKind === 'property')) return;
        const haystack = JSON.stringify(value).toLowerCase();
        if (haystack.includes(q)) result.push({ kind: recordKind, ...value });
      };
      for (const f of corpus.factions) push('faction', f as unknown as Record<string, unknown>);
      for (const w of corpus.wares) push('ware', w as unknown as Record<string, unknown>);
      for (const job of corpus.jobs) push('job', job as unknown as Record<string, unknown>);
      for (const script of corpus.aiScripts) push('aiscript', script as unknown as Record<string, unknown>);
      for (const s of corpus.sectors) push('sector', s as unknown as Record<string, unknown>);
      for (const entry of corpus.scriptProperties) {
        for (const property of entry.properties) push('property', { ownerKind: entry.kind, owner: entry.name, ...property });
      }
      return res.json(result.slice(0, 200));
    } catch (error) { return sendCorpusError(res, error); }
  });

  app.get('/api/reference/selftest', (_req, res) => {
    try { return res.json(runReferenceCorpusSelftest()); }
    catch (error) { return res.status(500).json({ pass: false, error: errorText(error) }); }
  });
}
