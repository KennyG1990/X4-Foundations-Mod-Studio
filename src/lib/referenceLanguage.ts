/** Cursor-aware X4 language intelligence over the canonical reference corpus and XSD graph. */

import path from 'path';
import { discoverSchemaRegistry, getDomainIndex, schemaFilesSignature, type SchemaRegistry } from './schemaRegistry';
import {
  buildScriptPropertyIndexFromModel,
  propertyHead,
  resolveDatatypeProperties,
  type ScriptPropertyIndex,
  type ScriptPropertyModel,
  type SPEntry,
} from './scriptProperties';
import { resolveExpressionState, suggestExpression, type ExpressionSuggestOptions } from './expressionSuggest';
import { buildProjectSymbols } from './projectSymbols';
import type { CanonicalSymbol, ReferenceCorpus, ScriptPropertyReference } from './referenceCorpus';
import type { ModWorkspace } from '../types';
import { fallbackLibrarySchemaDomain, resolveReferenceBinding } from './referenceBindings';
import { projectReferenceSymbols, suggestReferences } from './referenceSuggestions';
import { contentParticleState, type AttrSpec, type ElementSpec, type SchemaIndex } from './xsdValidate';

export type ReferenceCompletionKind = 'Element' | 'Attribute' | 'Enum' | 'Reference' | 'Property' | 'Function';

export interface ReferenceCompletionItem {
  label: string;
  kind: ReferenceCompletionKind;
  detail?: string;
  insertText: string;
  documentation?: string;
  sortText?: string;
}

export interface ReferenceHover {
  kind: 'element' | 'attribute' | 'property' | 'function' | 'reference';
  label: string;
  signature: string;
  documentation?: string;
  detail?: string;
}

export interface ReferenceLanguageRequest {
  path: string;
  content: string;
  line: number;
  column: number;
}

export interface ReferenceLanguageResources {
  corpus: ReferenceCorpus;
  registry: SchemaRegistry;
  schema: SchemaIndex | null;
  domain: string;
  scriptProperties: ScriptPropertyIndex;
  projectSymbols?: CanonicalSymbol[];
}

interface CursorContext {
  offset: number;
  parentTag: string | null;
  inTag: string | null;
  inAttrValue: string | null;
  attrValuePrefix: string;
  elementStart: boolean;
  rootTag: string | null;
  partialElement: string;
  priorSiblings: string[];
}

let schemaState: { root: string; checkedAt: number; signature: string; registry: SchemaRegistry } | null = null;
let scriptState: { corpusSignature: string; index: ScriptPropertyIndex } | null = null;
const SCHEMA_SIGNATURE_CHECK_MS = 1000;

function blankMarkup(text: string): string {
  return text
    .replace(/<!--[\s\S]*?(-->|$)/g, match => ' '.repeat(match.length))
    .replace(/<!\[CDATA\[[\s\S]*?(\]\]>|$)/g, match => ' '.repeat(match.length));
}

export function offsetAt(content: string, line: number, column: number): number {
  if (!Number.isInteger(line) || !Number.isInteger(column) || line < 0 || column < 0) throw new Error('line and column must be non-negative integers.');
  const text = String(content || '');
  const lines = text.split(/\r?\n/);
  if (line >= lines.length) throw new Error(`line ${line} is outside the document.`);
  if (column > lines[line].length) throw new Error(`column ${column} is outside line ${line}.`);
  if (line === 0) return column;
  let currentLine = 0;
  let offset = 0;
  while (currentLine < line) {
    const newline = text.indexOf('\n', offset);
    if (newline < 0) throw new Error(`line ${line} is outside the document.`);
    offset = newline + 1;
    currentLine++;
  }
  return offset + column;
}

export function xmlCursorContext(content: string, offset: number): CursorContext {
  const prefix = blankMarkup(String(content || '').slice(0, Math.max(0, offset)));
  const rootMatch = /<(?!\?|!|\/)([A-Za-z_][\w.:-]*)/.exec(prefix);
  const rootTag = rootMatch ? rootMatch[1].toLowerCase() : null;
  const lastLt = prefix.lastIndexOf('<');
  const lastGt = prefix.lastIndexOf('>');
  let inTag: string | null = null;
  let inAttrValue: string | null = null;
  let attrValuePrefix = '';
  let elementStart = false;
  let partialElement = '';
  if (lastLt > lastGt) {
    const body = prefix.slice(lastLt + 1);
    if (!body.startsWith('?') && !body.startsWith('!')) {
      const name = /^\/?([A-Za-z_][\w.:-]*)?/.exec(body)?.[1]?.toLowerCase() || null;
      if (/^\/?[A-Za-z_\w.:-]*$/.test(body)) {
        elementStart = !body.startsWith('/');
        partialElement = body.replace(/^\//, '').toLowerCase();
      } else if (name) {
        inTag = name;
        const attr = /([A-Za-z_][\w.:-]*)\s*=\s*(["'])([^"']*)$/.exec(body);
        if (attr) { inAttrValue = attr[1].toLowerCase(); attrValuePrefix = attr[3]; }
      }
    }
  }
  const stack: Array<{ name: string; children: string[] }> = [];
  const tagRe = /<(\/)?([A-Za-z_][\w.:-]*)((?:"[^"]*"|[^"<>])*?)(\/)?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(prefix)) !== null) {
    const name = match[2].toLowerCase();
    if (match[1]) {
      for (let index = stack.length - 1; index >= 0; index--) {
        if (stack[index].name === name) { stack.length = index; break; }
      }
    } else {
      if (stack.length) stack[stack.length - 1].children.push(name);
      if (!match[4]) stack.push({ name, children: [] });
    }
  }
  return {
    offset,
    parentTag: stack.at(-1)?.name || null,
    inTag,
    inAttrValue,
    attrValuePrefix,
    elementStart,
    rootTag,
    partialElement,
    priorSiblings: [...(stack.at(-1)?.children || [])],
  };
}

function entryFromReference(reference: ScriptPropertyReference): SPEntry {
  const heads = new Set<string>();
  const headDocs = new Map<string, string>();
  let wildcard = false;
  for (const property of reference.properties) {
    const head = propertyHead(property.name);
    if (!head) wildcard = true;
    else {
      heads.add(head);
      if (property.result && !headDocs.has(head)) headDocs.set(head, property.result);
    }
  }
  return {
    kind: reference.kind,
    name: reference.name,
    parent: reference.parent,
    heads,
    headDocs,
    propNames: reference.properties.map(property => property.name),
    properties: reference.properties.map(property => ({ ...property })),
    wildcard,
    dynamic: reference.dynamic,
    dynamicResultType: reference.dynamicResultType,
  };
}

function scriptIndexFor(corpus: ReferenceCorpus): ScriptPropertyIndex {
  if (scriptState?.corpusSignature === corpus.signature) return scriptState.index;
  const model: ScriptPropertyModel = { keywords: new Map(), datatypes: new Map(), parsedProperties: 0 };
  for (const reference of corpus.scriptProperties) {
    const entry = entryFromReference(reference);
    (entry.kind === 'keyword' ? model.keywords : model.datatypes).set(entry.name, entry);
    model.parsedProperties += entry.properties.length;
  }
  const index = buildScriptPropertyIndexFromModel(model);
  scriptState = { corpusSignature: corpus.signature, index };
  return index;
}

export function getReferenceScriptPropertyIndex(corpus: ReferenceCorpus): ScriptPropertyIndex {
  return scriptIndexFor(corpus);
}

function registryFor(corpus: ReferenceCorpus): SchemaRegistry {
  const schemaDir = path.join(corpus.root, 'libraries');
  const now = Date.now();
  if (schemaState && schemaState.root.toLowerCase() === schemaDir.toLowerCase() && now - schemaState.checkedAt < SCHEMA_SIGNATURE_CHECK_MS) {
    return schemaState.registry;
  }
  const signature = schemaFilesSignature(schemaDir);
  if (schemaState && schemaState.root.toLowerCase() === schemaDir.toLowerCase() && schemaState.signature === signature) {
    schemaState.checkedAt = now;
    return schemaState.registry;
  }
  const registry = discoverSchemaRegistry(schemaDir, undefined, { signature });
  schemaState = { root: schemaDir, checkedAt: now, signature, registry };
  return registry;
}

export function declaredSchemaDomain(content: string): string | null {
  const match = /\bxsi:noNamespaceSchemaLocation\s*=\s*["']([^"']+)["']/i.exec(String(content || '').slice(0, 32768));
  if (!match) return null;
  const basename = match[1].replace(/\\/g, '/').split('/').pop() || '';
  return basename.toLowerCase().replace(/\.xsd$/, '') || null;
}

function rootElement(content: string): string | null {
  const clean = String(content || '').slice(0, 32768).replace(/<!--[\s\S]*?-->/g, '');
  return /<(?!\?|!)([A-Za-z_][\w.:-]*)/.exec(clean)?.[1]?.toLowerCase() || null;
}

export function fallbackSchemaDomain(filePath: string, content: string): string | null {
  const normalized = String(filePath || '').replace(/\\/g, '/').toLowerCase();
  const root = rootElement(content);
  if (/(^|\/)aiscripts\//.test(normalized) || root === 'aiscript') return 'aiscripts';
  if (/(^|\/)md\//.test(normalized) || root === 'mdscript') return 'md';
  if (root === 'diff') return 'diff';
  const sharedLibrary = fallbackLibrarySchemaDomain(normalized);
  if (sharedLibrary) return sharedLibrary;
  const library = /(^|\/)libraries\/([^/]+)\.xml$/.exec(normalized)?.[2];
  if (library) return library;
  return root;
}

export function getReferenceLanguageResources(corpus: ReferenceCorpus, request: Pick<ReferenceLanguageRequest, 'path' | 'content'>, workspace?: ModWorkspace | null): ReferenceLanguageResources {
  const registry = registryFor(corpus);
  const declared = declaredSchemaDomain(request.content);
  const fallback = fallbackSchemaDomain(request.path, request.content);
  const domain = declared || fallback || 'none';
  const info = registry.domains.find(candidate => candidate.domain === domain);
  return {
    corpus,
    registry,
    schema: info ? getDomainIndex(info) : null,
    domain,
    scriptProperties: scriptIndexFor(corpus),
    projectSymbols: projectReferenceSymbols(workspace),
  };
}

function dynamicValues(corpus: ReferenceCorpus, projectSymbols: CanonicalSymbol[] = []): ExpressionSuggestOptions['dynamicValues'] {
  const project = (kind: CanonicalSymbol['kind']) => projectSymbols
    .filter(symbol => symbol.kind === kind)
    .map(symbol => ({ id: symbol.id, label: symbol.name, documentation: `${symbol.name || symbol.id} · project` }));
  return {
    faction: [...project('faction'), ...corpus.factions.map(value => ({ id: value.id, label: value.name, documentation: `${value.name} · ${value.source}` }))],
    ware: [...project('ware'), ...corpus.wares.map(value => ({ id: value.id, label: value.name, documentation: `${value.name} · ${value.group} · ${value.source}` }))],
    sector: [...project('sector'), ...corpus.sectors.map(value => ({ id: value.id, label: value.name, documentation: `${value.name} · ${value.source}` }))],
    macro: [...project('macro'), ...[...corpus.references.macros].map(id => ({ id }))],
  };
}

function expressionAttribute(attrName: string, attr: AttrSpec | undefined): boolean {
  const type = `${attr?.type || ''} ${attr?.baseType || ''}`.toLowerCase();
  return type.includes('expression') || new Set(['value', 'exact', 'min', 'max', 'amount', 'check', 'condition']).has(attrName);
}

function requiredSnippet(name: string, spec: ElementSpec | undefined): string {
  const required = spec ? [...spec.attributes].filter(([, attr]) => attr.required).map(([attr]) => attr) : [];
  return required.length ? `${name} ${required.map((attr, index) => `${attr}="\${${index + 1}}"`).join(' ')}` : name;
}

function referenceItems(
  kind: NonNullable<ReturnType<typeof resolveReferenceBinding>>,
  corpus: ReferenceCorpus,
  attr: AttrSpec | undefined,
  query = '',
  projectSymbols: CanonicalSymbol[] = [],
): ReferenceCompletionItem[] {
  const type = `${attr?.type || ''} ${attr?.baseType || ''}`.toLowerCase();
  return suggestReferences(corpus, { kind, query, intent: 'reference', limit: 100, projectSymbols }).map((value, index) => ({
    label: value.label,
    kind: 'Reference',
    detail: value.detail,
    insertText: (type.includes('expr') || type.includes('lookup')) && (kind === 'faction' || kind === 'ware')
      ? `${kind}.${value.insertText}` : value.insertText,
    documentation: value.documentation,
    sortText: String(index).padStart(5, '0'),
  }));
}

export function completeReferenceDocument(request: ReferenceLanguageRequest, resources: ReferenceLanguageResources): ReferenceCompletionItem[] {
  const offset = offsetAt(request.content, request.line, request.column);
  const context = xmlCursorContext(request.content, offset);
  const schema = resources.schema;
  if (context.inTag && context.inAttrValue) {
    const element = schema?.elements.get(context.inTag);
    const attr = element?.attributes.get(context.inAttrValue);
    if (expressionAttribute(context.inAttrValue, attr)) {
      const variableTypes = buildProjectSymbols([{ path: request.path, content: request.content }], resources.scriptProperties).variableTypesFor(request.path);
      const suggestions = suggestExpression(request.content, offset, resources.scriptProperties, { dynamicValues: dynamicValues(resources.corpus, resources.projectSymbols), variableTypes });
      if (suggestions.length) return suggestions.map((suggestion, index) => ({
        label: suggestion.label,
        kind: suggestion.kind === 'function' ? 'Function' : suggestion.kind === 'reference' ? 'Reference' : 'Property',
        detail: [suggestion.ownerType, suggestion.propertyName, suggestion.resultType].filter(Boolean).join(' · ') || suggestion.source,
        insertText: suggestion.insert,
        documentation: suggestion.detail,
        sortText: String(index).padStart(5, '0'),
      }));
    }
    if (attr?.enumValues?.length) return attr.enumValues.map((value, index) => ({
      label: value, kind: 'Enum', detail: `${context.inTag}@${context.inAttrValue}`, insertText: value,
      documentation: attr.documentation, sortText: String(index).padStart(5, '0'),
    }));
    const kind = resolveReferenceBinding({
      domain: resources.domain,
      element: context.inTag,
      attribute: context.inAttrValue,
      type: attr?.type,
      baseType: attr?.baseType,
    });
    return kind ? referenceItems(kind, resources.corpus, attr, context.attrValuePrefix, resources.projectSymbols) : [];
  }

  if (context.inTag) {
    const element = schema?.elements.get(context.inTag);
    if (!element?.resolved) return [];
    return [...element.attributes.entries()]
      .sort((a, b) => Number(b[1].required) - Number(a[1].required) || a[0].localeCompare(b[0]))
      .map(([name, attr], index) => ({
        label: name, kind: 'Attribute',
        detail: `${attr.required ? 'required' : 'optional'}${attr.type ? ` · ${attr.type}` : ''}`,
        insertText: `${name}="\${1}"`, documentation: attr.documentation,
        sortText: `${attr.required ? '0' : '1'}${String(index).padStart(5, '0')}`,
      }));
  }

  if (context.elementStart && context.parentTag) {
    const parent = schema?.elements.get(context.parentTag);
    if (!parent || parent.openChildren) return [];
    const particle = contentParticleState(parent, context.priorSiblings);
    const legal = parent.particles.length && particle.viable ? particle.next : parent.children;
    return [...legal]
      .filter(name => !context.partialElement || name.startsWith(context.partialElement))
      .filter(name => schema?.elements.has(name))
      .sort()
      .map((name, index) => {
        const child = schema?.elements.get(name);
        const childParticle = parent.childSpecs.get(name);
        return {
          label: name, kind: 'Element' as const,
          detail: childParticle ? `${childParticle.particle} · ${childParticle.minOccurs}..${childParticle.maxOccurs === null ? '∞' : childParticle.maxOccurs}` : resources.domain,
          insertText: requiredSnippet(name, child), documentation: child?.documentation,
          sortText: String(index).padStart(5, '0'),
        };
      });
  }
  return [];
}

function wordAt(content: string, offset: number): { word: string; start: number; end: number } | null {
  let start = offset;
  let end = offset;
  while (start > 0 && /[A-Za-z0-9_.:-]/.test(content[start - 1])) start--;
  while (end < content.length && /[A-Za-z0-9_.:-]/.test(content[end])) end++;
  const word = content.slice(start, end);
  return word ? { word, start, end } : null;
}

export function hoverReferenceDocument(request: ReferenceLanguageRequest, resources: ReferenceLanguageResources): ReferenceHover | null {
  const offset = offsetAt(request.content, request.line, request.column);
  const context = xmlCursorContext(request.content, offset);
  const token = wordAt(request.content, offset);
  if (!token) return null;
  const leaf = token.word.split('.').pop()!.toLowerCase();

  if (context.inTag && context.inAttrValue) {
    const element = resources.schema?.elements.get(context.inTag);
    const attr = element?.attributes.get(context.inAttrValue);
    if (expressionAttribute(context.inAttrValue, attr)) {
      const variableTypes = buildProjectSymbols([{ path: request.path, content: request.content }], resources.scriptProperties).variableTypesFor(request.path);
      const leafStart = token.end - leaf.length;
      const state = resolveExpressionState(request.content, leafStart, resources.scriptProperties, { dynamicValues: dynamicValues(resources.corpus, resources.projectSymbols), variableTypes });
      if (state?.datatype && resources.scriptProperties.model.datatypes.has(state.datatype)) {
        const property = resolveDatatypeProperties(resources.scriptProperties.model, state.datatype).find(candidate => propertyHead(candidate.name) === leaf);
        if (property) return {
          kind: /[.<{]/.test(property.name) ? 'function' : 'property', label: property.name,
          signature: `${property.owner}.${property.name}${property.type ? `: ${property.type}` : ''}`,
          documentation: property.result, detail: property.inherited ? `Inherited from ${property.owner}` : `Datatype ${property.owner}`,
        };
      }
    }
    const boundKind = resolveReferenceBinding({
      domain: resources.domain,
      element: context.inTag,
      attribute: context.inAttrValue,
      type: attr?.type,
      baseType: attr?.baseType,
    });
    const reference = boundKind
      ? [...(resources.projectSymbols || []), ...resources.corpus.symbols].find(symbol => symbol.kind === boundKind && symbol.id.toLowerCase() === leaf.toLowerCase())
      : undefined;
    if (reference) return {
      kind: 'reference', label: reference.id, signature: `${reference.kind}.${reference.id}`,
      documentation: reference.name || reference.detail, detail: reference.source,
    };
    if (attr && leaf === context.inAttrValue) return {
      kind: 'attribute', label: leaf, signature: `${context.inTag}@${leaf}: ${attr.type || attr.baseType || 'string'}`,
      documentation: attr.documentation, detail: attr.required ? 'required' : 'optional',
    };
  }

  const elementName = leaf;
  const element = resources.schema?.elements.get(elementName);
  if (element && request.content.slice(Math.max(0, token.start - 2), token.start).includes('<')) {
    const attrs = [...element.attributes].filter(([, attr]) => attr.required).map(([name]) => name);
    return {
      kind: 'element', label: elementName,
      signature: `<${elementName}${attrs.length ? ` ${attrs.map(name => `${name}="…"`).join(' ')}` : ''}>`,
      documentation: element.documentation,
      detail: `${element.children.size} child element(s) · ${element.attributes.size} attribute(s)`,
    };
  }
  return null;
}

export function clearReferenceLanguageCaches(): void {
  schemaState = null;
  scriptState = null;
}

export function runReferenceLanguageSelftest() {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({
    name, pass, ...(detail === undefined ? {} : { detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }),
  });
  const cursor = (marked: string) => {
    const marker = marked.indexOf('|');
    const content = marked.replace('|', '');
    const before = marked.slice(0, marker);
    const rows = before.split('\n');
    return { content, line: rows.length - 1, column: rows.at(-1)!.length };
  };
  const attr = (type?: string, required = false): AttrSpec => ({ required, type });
  const element = (attributes: Array<[string, AttrSpec]>, children: string[] = []): ElementSpec => ({
    attributes: new Map(attributes), openAttributes: false, resolved: true,
    children: new Set(children), childSpecs: new Map(children.map(name => [name, { name, particle: 'sequence' as const, minOccurs: 0, maxOccurs: 1 }])),
    openChildren: false, particles: [],
  });
  const cue = element([], ['conditions', 'actions', 'cues']);
  cue.particles = [{
    kind: 'sequence', minOccurs: 1, maxOccurs: 1,
    children: ['conditions', 'actions', 'cues'].map(name => ({ kind: 'element' as const, name, minOccurs: 0, maxOccurs: 1 })),
  }];
  const model: ScriptPropertyModel = { keywords: new Map(), datatypes: new Map(), parsedProperties: 1 };
  model.keywords.set('faction', {
    kind: 'keyword', name: 'faction', heads: new Set(), headDocs: new Map(), propNames: [], properties: [], wildcard: false, dynamic: true, dynamicResultType: 'faction',
  });
  model.datatypes.set('faction', {
    kind: 'datatype', name: 'faction', heads: new Set(['id']), headDocs: new Map([['id', 'Faction ID']]), propNames: ['id'],
    properties: [{ name: 'id', result: 'Faction ID', type: 'string' }], wildcard: false, dynamic: false,
  });
  const schema: SchemaIndex = {
    loaded: true, sourceFiles: ['md.xsd', 'common.xsd'], elementCount: 4,
    elements: new Map([
      ['cue', cue],
      ['conditions', element([])], ['actions', element([])], ['cues', element([])],
      ['event_owner', element([['owner', attr('faction')]])],
      ['set_value', element([['exact', attr('expression')]])],
    ]),
  };
  const corpus = {
    root: 'fixture', generatedAt: '', signature: 'fixture', sourceFiles: [], wares: [], jobs: [], aiScripts: [], sectors: [], scriptProperties: [],
    factions: [{ id: 'player', name: 'Player', source: 'base', category: 'player', isreal: false }, { id: 'argon', name: 'Argon', source: 'base', category: 'political', isreal: true }],
    symbols: [
      { kind: 'faction', id: 'player', name: 'Player', source: 'base', path: 'libraries/factions.xml' },
      { kind: 'faction', id: 'argon', name: 'Argon', source: 'base', path: 'libraries/factions.xml' },
    ],
    references: { macros: new Set<string>(), wares: new Set<string>(), factions: new Set<string>(), sectors: new Set<string>(), jobs: new Set<string>(), aiScripts: new Set<string>() },
  } as ReferenceCorpus;
  const resources: ReferenceLanguageResources = {
    corpus, registry: { roots: [], domains: [] }, schema, domain: 'md', scriptProperties: buildScriptPropertyIndexFromModel(model),
    projectSymbols: [{ kind: 'faction', id: 'project_faction', name: 'Project Faction', source: 'project', path: 'libraries/factions.xml' }],
  };
  const child = cursor('<cue><|');
  ok('contextual child completion', completeReferenceDocument({ path: 'md/x.xml', ...child }, resources).map(item => item.label).join(',') === 'actions,conditions,cues');
  const afterConditions = cursor('<cue><conditions/><|');
  ok('particle completion removes prior sequence member', completeReferenceDocument({ path: 'md/x.xml', ...afterConditions }, resources).map(item => item.label).join(',') === 'actions,cues');
  const afterActions = cursor('<cue><actions/><|');
  ok('particle completion respects skipped optional prefix', completeReferenceDocument({ path: 'md/x.xml', ...afterActions }, resources).map(item => item.label).join(',') === 'cues');
  const lookup = cursor('<set_value exact="faction.|"/>');
  const lookupItems = completeReferenceDocument({ path: 'md/x.xml', ...lookup }, resources);
  ok('canonical dynamic lookup completion', lookupItems.length === 3);
  ok('project-defined symbols join document completion', lookupItems.some(item => item.label === 'project_faction' && /project/i.test(item.documentation || '')));
  const props = cursor('<set_value exact="faction.player.|"/>');
  ok('dynamic lookup resolves datatype', completeReferenceDocument({ path: 'md/x.xml', ...props }, resources).some(item => item.label === 'id' && item.kind === 'Property'));
  const hover = cursor('<set_value exact="faction.player.i|d"/>');
  const hoverResult = hoverReferenceDocument({ path: 'md/x.xml', ...hover }, resources);
  ok('typed property hover resolves signature', hoverResult?.kind === 'property' && hoverResult.signature === 'faction.id: string', hoverResult);
  const owner = cursor('<event_owner owner="|"/>');
  ok('reference typed attribute completion', completeReferenceDocument({ path: 'md/x.xml', ...owner }, resources).length === 3);
  ok('declared schema wins', declaredSchemaDomain('<x xmlns:xsi="x" xsi:noNamespaceSchemaLocation="../md.xsd"/>') === 'md');
  ok('path fallback routes aiscript', fallbackSchemaDomain('aiscripts/test.xml', '<aiscript/>') === 'aiscripts');
  ok('path fallback routes wares to libraries', fallbackSchemaDomain('libraries/wares.xml', '<wares/>') === 'libraries');
  let rejected = false;
  try { offsetAt('<x/>', 3, 0); } catch { rejected = true; }
  ok('invalid cursor rejected', rejected);
  ok('CRLF cursor offset is exact', offsetAt('<x>\r\n  <y/>', 1, 2) === 7, offsetAt('<x>\r\n  <y/>', 1, 2));
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}
