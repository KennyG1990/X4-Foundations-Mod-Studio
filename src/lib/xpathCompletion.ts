/** Cursor-aware completion over one effective X4 XML document. Read-only and deterministic. */

import { DOMParser } from '@xmldom/xmldom';
import * as xpath from 'xpath';
import type { ReferenceCorpus } from './referenceCorpus';
import { selectorIdentityKind } from './referenceBindings';
import { suggestReferences } from './referenceSuggestions';

export interface XPathCompletionItem {
  label: string;
  kind: 'Element' | 'Attribute' | 'Value' | 'Snippet' | 'Reference';
  detail?: string;
  documentation?: string;
  insertText: string;
  replaceStart: number;
  replaceEnd: number;
  source?: string;
}

export interface XPathCompletionRequest {
  targetPath: string;
  content: string;
  selector: string;
  cursor: number;
  corpus: ReferenceCorpus;
  limit?: number;
}

function parse(content: string): Document {
  const errors: string[] = [];
  const document = new DOMParser({ onError: (_level, message) => errors.push(String(message)) })
    .parseFromString(content.replace(/^\uFEFF/, ''), 'text/xml') as unknown as Document;
  if (!document?.documentElement || errors.some(message => /error|fatal/i.test(message))) throw new Error('Effective XML is not well formed.');
  return document;
}

function nodes(document: Document, expression: string): Node[] {
  try {
    const result = xpath.select(expression || '/', document as unknown as Node);
    return Array.isArray(result) ? result as Node[] : result ? [result as Node] : [];
  } catch { return []; }
}

function elementNameFromPath(expression: string): string {
  const names = [...expression.matchAll(/(?:^|\/\/|\/)([A-Za-z_][\w.:-]*)/g)].map(match => match[1]);
  return names.at(-1)?.toLowerCase() || '';
}

function rootName(document: Document): string { return String(document.documentElement?.nodeName || '').toLowerCase(); }

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }

export function completeXPath(request: XPathCompletionRequest): XPathCompletionItem[] {
  const selector = String(request.selector || '');
  const cursor = Math.max(0, Math.min(Number(request.cursor), selector.length));
  const prefix = selector.slice(0, cursor);
  const document = parse(request.content);
  const limit = Math.max(1, Math.min(Number(request.limit) || 50, 100));

  const valueMatch = /^(.*)\[@([A-Za-z_][\w.:-]*)\s*=\s*(["'])([^"']*)$/.exec(prefix);
  if (valueMatch) {
    const [, ownerExpression, attribute, , partial] = valueMatch;
    const ownerNodes = nodes(document, ownerExpression).filter(node => node.nodeType === 1) as unknown as Element[];
    const actual = unique(ownerNodes.map(node => node.getAttribute(attribute) || '').filter(Boolean));
    const root = rootName(document);
    const element = elementNameFromPath(ownerExpression);
    const kind = selectorIdentityKind(root, element, attribute);
    const start = cursor - partial.length;
    const canonical = kind ? suggestReferences(request.corpus, { kind, query: partial, intent: 'selector', limit }) : [];
    const actualItems: XPathCompletionItem[] = actual
      .filter(value => value.toLowerCase().includes(partial.toLowerCase()))
      .map(value => ({ label: value, kind: 'Value', detail: `Value present in ${request.targetPath}`, insertText: value, replaceStart: start, replaceEnd: cursor }));
    const merged = new Map<string, XPathCompletionItem>();
    for (const item of canonical) merged.set(item.label.toLowerCase(), {
      label: item.label, kind: 'Reference', detail: item.detail, documentation: item.documentation,
      insertText: item.insertText, replaceStart: start, replaceEnd: cursor, source: item.source,
    });
    for (const item of actualItems) if (!merged.has(item.label.toLowerCase())) merged.set(item.label.toLowerCase(), item);
    return [...merged.values()].slice(0, limit);
  }

  const attributeMatch = /^(.*\/([A-Za-z_][\w.:-]*)(?:\[[^\]]*\])?)\/@([A-Za-z_][\w.:-]*)?$/.exec(prefix);
  if (attributeMatch) {
    const ownerExpression = attributeMatch[1];
    const partial = attributeMatch[3] || '';
    const ownerNodes = nodes(document, ownerExpression).filter(node => node.nodeType === 1) as unknown as Element[];
    const names = unique(ownerNodes.flatMap(node => Array.from(node.attributes || []).map(attribute => attribute.name))).sort();
    return names.filter(name => name.startsWith(partial)).slice(0, limit).map(name => ({
      label: `@${name}`, kind: 'Attribute', detail: `${ownerNodes.length} matching element(s)`, insertText: name,
      replaceStart: cursor - partial.length, replaceEnd: cursor,
    }));
  }

  const slash = prefix.lastIndexOf('/');
  const parentExpression = slash <= 0 ? '/' : prefix.slice(0, slash);
  const partial = prefix.slice(slash + 1).replace(/\[.*$/, '');
  const parentNodes = parentExpression === '/'
    ? [document as unknown as Node]
    : nodes(document, parentExpression);
  const childNames = unique(parentNodes.flatMap(parent => Array.from(parent.childNodes || [])
    .filter(child => child.nodeType === 1).map(child => child.nodeName))).sort();
  const items: XPathCompletionItem[] = childNames
    .filter(name => !partial || name.toLowerCase().startsWith(partial.toLowerCase()))
    .slice(0, limit)
    .map(name => ({ label: name, kind: 'Element', detail: `Child of ${parentExpression}`, insertText: name, replaceStart: cursor - partial.length, replaceEnd: cursor }));

  const selected = nodes(document, prefix.replace(/\[$/, '')).filter(node => node.nodeType === 1) as unknown as Element[];
  if (prefix.endsWith('[') || (!partial && selected.length)) {
    const attributes = unique(selected.flatMap(node => Array.from(node.attributes || []).map(attribute => attribute.name))).sort();
    for (const attribute of attributes.slice(0, Math.max(0, limit - items.length))) items.push({
      label: `[@${attribute}='…']`, kind: 'Snippet', detail: 'Predicate over an attribute present in the effective document',
      insertText: `@${attribute}='\${1}'`, replaceStart: cursor, replaceEnd: cursor,
    });
  }
  return items.slice(0, limit);
}

export function runXPathCompletionSelftest(corpusInput?: ReferenceCorpus) {
  const corpus = corpusInput || {
    root: 'fixture', generatedAt: '', signature: 'fixture', sourceFiles: [],
    factions: [], sectors: [], jobs: [], aiScripts: [], scriptProperties: [],
    wares: [{ id: 'energycells', name: 'Energy Cells', group: 'energy', tags: ['economy'], source: 'base' }],
    symbols: [{ kind: 'ware', id: 'energycells', name: 'Energy Cells', source: 'base', path: 'libraries/wares.xml' }],
    references: { macros: new Set(), wares: new Set(['energycells']), factions: new Set(), sectors: new Set(), jobs: new Set(), aiScripts: new Set() },
  } as ReferenceCorpus;
  const content = '<wares><ware id="energycells" group="energy"/><ware id="water" group="liquid"/></wares>';
  const values = completeXPath({ targetPath: 'libraries/wares.xml', content, selector: "/wares/ware[@id='energyc", cursor: 24, corpus });
  const elements = completeXPath({ targetPath: 'libraries/wares.xml', content, selector: '/wares/wa', cursor: 9, corpus });
  const attributes = completeXPath({ targetPath: 'libraries/wares.xml', content, selector: '/wares/ware/@g', cursor: 14, corpus });
  const checks = [
    { name: 'canonical predicate value completion', pass: values.some(item => item.label === 'energycells' && item.kind === 'Reference') },
    { name: 'child element completion', pass: elements.some(item => item.label === 'ware') },
    { name: 'attribute completion', pass: attributes.some(item => item.label === '@group') },
    { name: 'replacement range targets partial value', pass: values.find(item => item.label === 'energycells')?.replaceStart === 17 },
  ];
  const passed = checks.filter(check => check.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}
