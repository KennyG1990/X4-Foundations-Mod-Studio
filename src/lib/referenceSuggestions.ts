/** Deterministic, corpus-backed suggestions shared by visual and Agent API authoring. */

import type { ModWorkspace } from '../types';
import type { CanonicalSymbol, CanonicalSymbolKind, ReferenceCorpus } from './referenceCorpus';

export type ReferenceSuggestionIntent = 'reference' | 'new-definition' | 'selector';

export interface ReferenceSuggestion {
  label: string;
  insertText: string;
  kind: CanonicalSymbolKind;
  detail?: string;
  documentation?: string;
  source: CanonicalSymbol['source'];
  path: string;
  selector?: string;
  exists: boolean;
  score: number;
}

export interface ReferenceSuggestionRequest {
  kind: CanonicalSymbolKind;
  query?: string;
  intent?: ReferenceSuggestionIntent;
  limit?: number;
  projectSymbols?: CanonicalSymbol[];
}

function normalized(value: string): string { return String(value || '').trim().toLowerCase(); }

function boundedDistance(left: string, right: string, max = 3): number | null {
  if (Math.abs(left.length - right.length) > max) return null;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    let rowMin = row;
    for (let column = 1; column <= right.length; column++) {
      const value = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + Number(left[row - 1] !== right[column - 1]),
      );
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return null;
    previous = current;
  }
  return previous[right.length] <= max ? previous[right.length] : null;
}

function symbolScore(symbol: CanonicalSymbol, query: string): number | null {
  if (!query) return 500;
  const id = normalized(symbol.id);
  const name = normalized(symbol.name || '');
  const tokens = name.split(/[^a-z0-9]+/).filter(Boolean);
  if (id === query) return 0;
  if (id.startsWith(query)) return 100 + Math.min(50, id.length - query.length);
  if (tokens.some(token => token.startsWith(query))) return 200 + Math.min(50, name.length - query.length);
  if (id.includes(query)) return 300 + id.indexOf(query);
  if (name.includes(query)) return 350 + name.indexOf(query);
  const distance = boundedDistance(query, id);
  return distance === null ? null : 400 + distance * 10 + Math.min(9, Math.abs(id.length - query.length));
}

export function projectReferenceSymbols(workspace?: Pick<ModWorkspace, 'wares' | 'jobs' | 'aiScripts'> | null): CanonicalSymbol[] {
  if (!workspace) return [];
  return [
    ...(workspace.wares || []).map(value => ({
      kind: 'ware' as const, id: String(value.id || '').trim(), name: value.name, source: 'project' as const,
      path: 'libraries/wares.xml', selector: `/wares/ware[@id='${String(value.id || '').trim()}']`, detail: 'Active workspace ware',
    })),
    ...(workspace.jobs || []).map(value => ({
      kind: 'job' as const, id: String(value.id || '').trim(), name: value.name, source: 'project' as const,
      path: 'libraries/jobs.xml', selector: `/jobs/job[@id='${String(value.id || '').trim()}']`, detail: 'Active workspace job',
    })),
    ...(workspace.aiScripts || []).map(value => ({
      kind: 'aiscript' as const, id: String(value.name || '').trim(), name: value.name, source: 'project' as const,
      path: `aiscripts/${String(value.name || '').trim()}.xml`, detail: 'Active workspace AI script',
    })),
  ].filter(symbol => Boolean(symbol.id));
}

export function suggestReferences(corpus: ReferenceCorpus, request: ReferenceSuggestionRequest): ReferenceSuggestion[] {
  const query = normalized(request.query || '');
  const limit = Math.max(1, Math.min(Number(request.limit) || 25, 100));
  const symbols = [...corpus.symbols, ...(request.projectSymbols || [])]
    .filter(symbol => symbol.kind === request.kind);
  const deduped = new Map<string, CanonicalSymbol>();
  // Project definitions take display precedence while remaining tagged as project.
  for (const symbol of symbols) {
    const key = `${symbol.kind}:${normalized(symbol.id)}`;
    if (!deduped.has(key) || symbol.source === 'project') deduped.set(key, symbol);
  }
  return [...deduped.values()]
    .map(symbol => ({ symbol, score: symbolScore(symbol, query) }))
    .filter((entry): entry is { symbol: CanonicalSymbol; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.symbol.id.localeCompare(b.symbol.id))
    .slice(0, limit)
    .map(({ symbol, score }) => ({
      label: symbol.id,
      insertText: symbol.id,
      kind: symbol.kind,
      detail: [symbol.name, symbol.detail, symbol.source].filter(Boolean).join(' · '),
      documentation: request.intent === 'new-definition'
        ? `${symbol.id} already exists in ${symbol.source}; patch the existing definition instead of adding a duplicate.`
        : symbol.detail,
      source: symbol.source,
      path: symbol.path,
      selector: symbol.selector,
      exists: true,
      score,
    }));
}

export function runReferenceSuggestionsSelftest(corpusInput?: ReferenceCorpus) {
  const corpus = corpusInput || {
    root: 'fixture', generatedAt: '', signature: 'fixture', sourceFiles: [],
    factions: [], sectors: [], jobs: [], aiScripts: [], scriptProperties: [],
    wares: [{ id: 'energycells', name: 'Energy Cells', group: 'energy', tags: ['economy'], source: 'base' }],
    symbols: [{ kind: 'ware', id: 'energycells', name: 'Energy Cells', source: 'base', path: 'libraries/wares.xml', selector: "/wares/ware[@id='energycells']" }],
    references: { macros: new Set(), wares: new Set(['energycells']), factions: new Set(), sectors: new Set(), jobs: new Set(), aiScripts: new Set() },
  } as ReferenceCorpus;
  const project: CanonicalSymbol[] = [{ kind: 'ware', id: 'project_fuel', name: 'Project Fuel', source: 'project', path: 'libraries/wares.xml' }];
  const prefix = suggestReferences(corpus, { kind: 'ware', query: 'energyc', intent: 'reference', limit: 10 });
  const typo = suggestReferences(corpus, { kind: 'ware', query: 'energycellz', intent: 'reference', limit: 10 });
  const collision = suggestReferences(corpus, { kind: 'ware', query: 'energycells', intent: 'new-definition', limit: 10 });
  const overlay = suggestReferences(corpus, { kind: 'ware', query: 'project_', projectSymbols: project, limit: 10 });
  const casePreserved = projectReferenceSymbols({
    wares: [{ id: 'Project_Fuel', name: 'Project Fuel' } as NonNullable<ModWorkspace['wares']>[number]],
    jobs: [],
    aiScripts: [],
  });
  const checks = [
    { name: 'id prefix ranks canonical match', pass: prefix[0]?.label === 'energycells' },
    { name: 'bounded typo suggests canonical match', pass: typo.some(item => item.label === 'energycells') },
    { name: 'new-definition exact match is collision', pass: collision[0]?.label === 'energycells' && collision[0].exists && /already exists/i.test(collision[0].documentation || '') },
    { name: 'project symbols layer over corpus', pass: overlay[0]?.label === 'project_fuel' && overlay[0].source === 'project' },
    { name: 'project symbol insertion preserves authored identifier case', pass: casePreserved[0]?.id === 'Project_Fuel' && casePreserved[0]?.selector?.includes("@id='Project_Fuel'") },
    { name: 'suggestions are bounded', pass: suggestReferences(corpus, { kind: 'ware', limit: 2 }).length <= 2 },
  ];
  const passed = checks.filter(check => check.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}
