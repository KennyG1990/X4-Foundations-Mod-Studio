import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { MDNode, ModWorkspace, OriginalModeledFile } from '../types';
import { generateMDXML } from '../types';
import { parseXMLToWorkspace } from './xmlParser';
import { checkXmlWellformed } from './xmlWellformed';
import { indexXmlElementSpans, xmlElementSemanticPath } from './xmlSourceSpans';
import { mdStemFingerprint } from './mdFileIdentity';
import { stableStringify } from './workspaceIdentity';

const MARKER = 'x4forge-node:';
const SYNTHETIC_CUE_ID = '__x4forge_node_selection_context__';

export interface NodeSelectionDocument {
  ok: true;
  content: string;
  token: string;
  title: string;
  nodeIds: string[];
  readOnly: boolean;
  warnings: string[];
}

export interface NodeSelectionFailure {
  ok: false;
  code: string;
  message: string;
}

export interface NodeSelectionApplySuccess {
  ok: true;
  workspace: ModWorkspace;
  changedNodeIds: string[];
  summary: string;
  diff: string;
}

export type NodeSelectionApplyResult = NodeSelectionApplySuccess | NodeSelectionFailure;

export function isNodeSelectionFailure(value: NodeSelectionApplyResult | NodeSelectionDocument | NodeSelectionFailure): value is NodeSelectionFailure {
  return 'code' in value;
}

function elementChildren(node: any): Element[] {
  return Array.from(node?.childNodes || []).filter((child: any) => child?.nodeType === 1) as Element[];
}

function firstElement(parent: Element | undefined): Element | null {
  return parent ? elementChildren(parent)[0] || null : null;
}

function syntheticWorkspace(workspace: ModWorkspace, nodes: MDNode[], links: ModWorkspace['links']): ModWorkspace {
  return { ...workspace, nodes, links, originalFiles: [], passthroughFiles: [] };
}

function renderNodeFragment(workspace: ModWorkspace, node: MDNode): string | null {
  if (node.type === 'comment') return null;
  if (node.xmlTag === 'custom_xml' || node.xmlTag === 'custom_event' || node.xmlTag === 'custom_condition' || node.xmlTag === 'custom_xml_cue') {
    return String(node.properties?.rawXml || '').trim() || null;
  }
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  if (node.type === 'cue') {
    const xml = generateMDXML(syntheticWorkspace(workspace, [{ ...node }], []), [node.id], '__x4forge_selection__');
    const doc = parser.parseFromString(xml, 'text/xml');
    const cues = doc.getElementsByTagName('cues')[0] as unknown as Element | undefined;
    const emitted = firstElement(cues);
    return emitted ? serializer.serializeToString(emitted as any) : null;
  }
  const cue: MDNode = {
    id: SYNTHETIC_CUE_ID, type: 'cue', label: 'X4 Forge selection context', xmlTag: 'cue', x: 0, y: 0,
    properties: { name: '__X4Forge_Node_Selection__', instantiate: 'false', namespace: 'this' },
    propertiesSchema: [], inputs: [], outputs: [], includeInBuild: true,
  };
  const sourcePortId = node.type === 'action' ? 'out_act' : 'out_cond';
  const targetPortId = node.type === 'action' ? 'in_act' : 'in_cond';
  const link = { id: '__x4forge_selection_link__', sourceNodeId: cue.id, sourcePortId, targetNodeId: node.id, targetPortId };
  const xml = generateMDXML(syntheticWorkspace(workspace, [cue, { ...node }], [link]), [cue.id], '__x4forge_selection__');
  const doc = parser.parseFromString(xml, 'text/xml');
  const parentTag = node.type === 'action' ? 'actions' : 'conditions';
  const parent = doc.getElementsByTagName(parentTag)[0] as unknown as Element | undefined;
  const emitted = firstElement(parent);
  return emitted ? serializer.serializeToString(emitted as any) : null;
}

function sourceNodeFragment(workspace: ModWorkspace, node: MDNode): string | null {
  if (!node.source) return null;
  const original = workspace.originalFiles?.find(file => file.kind === 'md' && file.path === node.source?.path);
  if (!original) return null;
  return original.content.slice(node.source.start, node.source.end);
}

function selectionSubstance(workspace: ModWorkspace, nodeIds: string[]): unknown {
  const ids = new Set(nodeIds);
  return {
    nodeIds,
    nodes: nodeIds.map(id => {
      const node = workspace.nodes.find(candidate => candidate.id === id);
      if (!node) return null;
      const original = node.source
        ? workspace.originalFiles?.find(file => file.kind === 'md' && file.path === node.source?.path)
        : undefined;
      const sourceText = original && node.source
        ? original.content.slice(node.source.start, node.source.end)
        : '';
      return {
        id: node.id, type: node.type, xmlTag: node.xmlTag, properties: node.properties,
        includeInBuild: node.includeInBuild !== false, source: node.source,
        sourceTextFingerprint: sourceText ? fnv(sourceText) : null,
      };
    }),
    links: workspace.links.filter(link => ids.has(link.sourceNodeId) || ids.has(link.targetNodeId)),
  };
}

function fnv(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function nodeSelectionToken(workspace: ModWorkspace, nodeIds: string[]): string {
  return fnv(stableStringify(selectionSubstance(workspace, nodeIds)));
}

function encodedMarker(id: string): string {
  return `<!-- ${MARKER}${encodeURIComponent(id)} -->`;
}

function opaque(node: MDNode): boolean {
  return node.source?.modeled === false || ['custom_xml', 'custom_event', 'custom_condition', 'custom_xml_cue'].includes(node.xmlTag);
}

function localizedRawNode(node: MDNode): boolean {
  return ['custom_xml', 'custom_event', 'custom_condition', 'custom_xml_cue'].includes(node.xmlTag)
    && typeof node.properties?.rawXml === 'string';
}

export function buildNodeSelectionDocument(workspace: ModWorkspace, requestedIds: string[]): NodeSelectionDocument | NodeSelectionFailure {
  const nodeIds = [...new Set(requestedIds)].filter(id => workspace.nodes.some(node => node.id === id));
  if (!nodeIds.length) return { ok: false, code: 'empty_selection', message: 'Select one or more code-bearing graph nodes.' };
  const nodes = nodeIds.map(id => workspace.nodes.find(node => node.id === id)!);
  const unsupported = nodes.filter(node => node.type === 'comment' || !(sourceNodeFragment(workspace, node) || renderNodeFragment(workspace, node)));
  if (unsupported.length) {
    return { ok: false, code: 'unsupported_node', message: `The selection contains ${unsupported.map(node => node.label || node.id).join(', ')}, which has no editable XML snippet.` };
  }
  const warnings = nodes.filter(localizedRawNode).map(node => `${node.label || node.id} is localized raw XML. Saving may change only this exact subtree; its root type and graph position are locked.`);
  const cueLines: string[] = [];
  const conditionLines: string[] = [];
  const actionLines: string[] = [];
  for (const node of nodes) {
    // Imported nodes expose the exact source element, including any nested logic that is
    // represented by child graph nodes. Rendering a root-only approximation here made a
    // container edit capable of deleting its children on save.
    const fragment = sourceNodeFragment(workspace, node) || renderNodeFragment(workspace, node)!;
    const lines = [encodedMarker(node.id), fragment];
    if (node.type === 'cue') cueLines.push(...lines);
    else if (node.type === 'action') actionLines.push(...lines);
    else conditionLines.push(...lines);
  }
  const context: string[] = [];
  if (conditionLines.length || actionLines.length) {
    context.push('<cue name="__X4Forge_Node_Selection_Context__" instantiate="false" namespace="this">');
    if (conditionLines.length) context.push('<conditions>', ...conditionLines, '</conditions>');
    if (actionLines.length) context.push('<actions>', ...actionLines, '</actions>');
    context.push('</cue>');
  }
  const content = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<mdscript name="__X4Forge_Node_Selection__" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">',
    '<!-- Edit selected node attributes/values, then save. Graph-structural edits are refused. -->',
    '<cues>', ...cueLines, ...context, '</cues>', '</mdscript>', '',
  ].join('\n');
  return {
    ok: true,
    content,
    token: nodeSelectionToken(workspace, nodeIds),
    title: nodes.length === 1 ? `${nodes[0].label || nodes[0].xmlTag}.node.xml` : `${nodes.length}-selected-nodes.xml`,
    nodeIds,
    readOnly: false,
    warnings,
  };
}

interface MarkedFragment { id: string; xml: string; element: Element; parentTag: string }

function markedFragments(content: string, expectedIds?: string[]): MarkedFragment[] | NodeSelectionFailure {
  const wf = checkXmlWellformed(content);
  if (!wf.ok) return { ok: false, code: 'malformed_xml', message: wf.errors[0]?.message || 'The node document is not well-formed XML.' };
  const doc = new DOMParser().parseFromString(content, 'text/xml');
  const indexed = indexXmlElementSpans(content);
  const fragments: MarkedFragment[] = [];
  const walk = (parent: any) => {
    const children = Array.from(parent?.childNodes || []) as any[];
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      if (child?.nodeType === 8 && String(child.data || '').trim().startsWith(MARKER)) {
        const encoded = String(child.data || '').trim().slice(MARKER.length);
        let id = '';
        try { id = decodeURIComponent(encoded); } catch { id = ''; }
        let next = index + 1;
        while (next < children.length && children[next]?.nodeType !== 1) next++;
        const element = children[next] as Element | undefined;
        if (!id || !element) continue;
        const span = indexed.get(xmlElementSemanticPath(element));
        if (!span) continue;
        fragments.push({ id, xml: content.slice(span.start, span.end), element, parentTag: String(element.parentElement?.tagName || '') });
      }
      if (child?.nodeType === 1) walk(child);
    }
  };
  walk(doc);
  if (expectedIds) {
    const actualIds = fragments.map(fragment => fragment.id);
    if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index])) {
      return { ok: false, code: 'identity_markers_changed', message: 'Node identity markers were removed, duplicated, reordered, or changed. Nothing was applied.' };
    }
  }
  const markedElements = new Set(fragments.map(fragment => fragment.element));
  const insideMarkedElement = (element: Element): boolean => {
    let parent = element.parentElement;
    while (parent) {
      if (markedElements.has(parent)) return true;
      parent = parent.parentElement;
    }
    return false;
  };
  const scaffold = (element: Element): boolean => {
    if (element.tagName === 'mdscript' && !element.parentElement) return true;
    if (element.tagName === 'cues' && element.parentElement?.tagName === 'mdscript') return true;
    if (element.tagName === 'cue' && element.getAttribute('name') === '__X4Forge_Node_Selection_Context__') return true;
    if ((element.tagName === 'conditions' || element.tagName === 'actions')
      && element.parentElement?.tagName === 'cue'
      && element.parentElement.getAttribute('name') === '__X4Forge_Node_Selection_Context__') return true;
    return false;
  };
  const allElements = Array.from(doc.getElementsByTagName('*')) as unknown as Element[];
  if (allElements.some(element => !markedElements.has(element) && !insideMarkedElement(element) && !scaffold(element))) {
    return { ok: false, code: 'structural_edit', message: 'Unmarked XML structure was added or moved. Add/remove/reparent nodes on the canvas instead.' };
  }
  return fragments;
}

function parseEditedNode(existing: MDNode, fragment: string): MDNode | NodeSelectionFailure {
  const body = existing.type === 'cue'
    ? fragment
    : `<cue name="__X4Forge_Parse__"><${existing.type === 'action' ? 'actions' : 'conditions'}>${fragment}</${existing.type === 'action' ? 'actions' : 'conditions'}></cue>`;
  const wrapped = `<?xml version="1.0"?><mdscript name="__X4Forge_Parse__"><cues>${body}</cues></mdscript>`;
  const parsed = parseXMLToWorkspace(wrapped);
  if (!parsed) return { ok: false, code: 'parse_failed', message: `${existing.label} could not be parsed back into a graph node.` };
  const candidates = existing.type === 'cue' ? parsed.nodes.filter(node => node.type === 'cue') : parsed.nodes.filter(node => node.type !== 'cue');
  if (!candidates.length) return { ok: false, code: 'parse_failed', message: `${existing.label} no longer contains its root graph element.` };
  // A source-backed container legitimately parses into its root plus descendant nodes.
  // Select the shallowest candidate (the marked fragment root); descendants are checked
  // separately for byte/canonical identity before any source splice is accepted.
  let candidate = candidates.slice().sort((left, right) => {
    const leftDepth = String(left.source?.semanticPath || '').split('/').length;
    const rightDepth = String(right.source?.semanticPath || '').split('/').length;
    return leftDepth - rightDepth;
  })[0];
  // Headless/server parsing may not have the live XSD templates registered. In that
  // case a schema-driven tag is intentionally classified as custom_* even though the
  // existing graph node proves its modeled identity. Recover its attributes directly;
  // the canonical re-render check below still refuses any child structure we would lose.
  if (existing.type !== 'cue' && candidate.xmlTag.startsWith('custom_') && !existing.xmlTag.startsWith('custom_')) {
    const root = new DOMParser().parseFromString(fragment, 'text/xml').documentElement as any;
    const properties: Record<string, string> = {};
    for (const attr of Array.from(root?.attributes || []) as any[]) properties[String(attr.name)] = String(attr.value);
    candidate = { ...existing, properties };
  }
  if (candidate.xmlTag !== existing.xmlTag || candidate.type !== existing.type) {
    return { ok: false, code: 'type_changed', message: `${existing.label} changed from <${existing.xmlTag}> to <${candidate.xmlTag}>. Change node type on the canvas instead.` };
  }
  const protectedProperties = existing.type === 'cue'
    ? Object.fromEntries(Object.entries(existing.properties || {}).filter(([key]) => ['mdFileStem', 'mdScript'].includes(key)))
    : {};
  return { ...existing, properties: { ...(candidate.properties || {}), ...protectedProperties } };
}

function canonicalElement(xml: string): string | null {
  const wf = checkXmlWellformed(xml);
  if (!wf.ok) return null;
  const doc = new DOMParser().parseFromString(xml, 'text/xml') as any;
  const root = doc.documentElement as Element | undefined;
  if (!root) return null;
  const visit = (element: Element): string => {
    const attrs = Array.from((element as any).attributes || []) as any[];
    const attrText = attrs.sort((a, b) => String(a.name).localeCompare(String(b.name))).map(attr => `${attr.name}=${JSON.stringify(String(attr.value))}`).join(';');
    const children = Array.from((element as any).childNodes || []) as any[];
    const childText = children.map(child => {
      if (child.nodeType === 1) return visit(child as Element);
      if (child.nodeType === 3 && String(child.data || '').trim()) return `#text:${String(child.data)}`;
      if (child.nodeType === 8) return `#comment:${String(child.data)}`;
      return '';
    }).join('');
    return `<${element.tagName}|${attrText}>${childText}</${element.tagName}>`;
  };
  return visit(root);
}

function simpleDiff(before: string, after: string): string {
  const left = before.split(/\r?\n/);
  const right = after.split(/\r?\n/);
  const out = ['--- selected nodes (before)', '+++ selected nodes (after)'];
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) {
    if (left[i] === right[i]) continue;
    if (left[i] !== undefined) out.push(`-${left[i]}`);
    if (right[i] !== undefined) out.push(`+${right[i]}`);
  }
  return out.join('\n');
}

function updateSourceSpans(workspace: ModWorkspace, path: string, content: string): void {
  const spans = indexXmlElementSpans(content);
  for (const node of workspace.nodes) {
    if (node.source?.path !== path) continue;
    const span = spans.get(node.source.semanticPath);
    if (span) node.source = { ...node.source, start: span.start, end: span.end };
  }
}

function openingTagEnd(xml: string, start = 0): number {
  let quote = '';
  for (let index = start + 1; index < xml.length; index++) {
    const char = xml[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return index + 1;
  }
  return -1;
}

function closingTagStart(xml: string): number {
  const end = xml.lastIndexOf('</');
  return end >= 0 ? end : xml.length;
}

function rootBody(xml: string): string | null {
  const openEnd = openingTagEnd(xml);
  if (openEnd < 0) return null;
  return xml.slice(openEnd, closingTagStart(xml));
}

function replaceRootOpening(originalFragment: string, editedFragment: string): string | null {
  const originalOpenEnd = openingTagEnd(originalFragment);
  const editedOpenEnd = openingTagEnd(editedFragment);
  if (originalOpenEnd < 0 || editedOpenEnd < 0) return null;
  const editedOpening = editedFragment.slice(0, editedOpenEnd).replace(/\/\s*>$/, '>');
  return editedOpening + originalFragment.slice(originalOpenEnd);
}

function xmlAttributeEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function patchOpeningAttribute(opening: string, name: string, value: string | null): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = new RegExp(`(\\s+)${escapedName}\\s*=\\s*(["'])(?:[\\s\\S]*?)\\2`);
  if (value === null) return opening.replace(expression, '');
  const escaped = xmlAttributeEscape(value);
  if (expression.test(opening)) return opening.replace(expression, (_match, whitespace, quote) => `${whitespace}${name}=${quote}${escaped}${quote}`);
  return opening.replace(/(\/?>)$/, ` ${name}="${escaped}"$1`);
}

interface GeneratedElementDelta {
  path: string;
  attributes: Array<{ name: string; value: string | null }>;
}

function generatedAttributeDeltas(beforeXml: string, afterXml: string): GeneratedElementDelta[] | NodeSelectionFailure {
  const beforeDoc = new DOMParser().parseFromString(beforeXml, 'text/xml');
  const afterDoc = new DOMParser().parseFromString(afterXml, 'text/xml');
  const beforeRoot = beforeDoc.documentElement as unknown as Element;
  const afterRoot = afterDoc.documentElement as unknown as Element;
  if (!beforeRoot || !afterRoot || beforeRoot.tagName !== afterRoot.tagName) {
    return { ok: false, code: 'type_changed', message: 'The property edit changed the node root element.' };
  }
  const deltas: GeneratedElementDelta[] = [];
  const walk = (before: Element, after: Element, path: string): NodeSelectionFailure | null => {
    const beforeChildren = elementChildren(before);
    const afterChildren = elementChildren(after);
    if (beforeChildren.length !== afterChildren.length || beforeChildren.some((child, index) => child.tagName !== afterChildren[index]?.tagName)) {
      // Cue delay is the one property-backed child whose presence may legitimately change.
      const beforeTags = beforeChildren.map(child => child.tagName);
      const afterTags = afterChildren.map(child => child.tagName);
      const withoutDelay = (tags: string[]) => tags.filter(tag => tag !== 'delay');
      if (stableStringify(withoutDelay(beforeTags)) !== stableStringify(withoutDelay(afterTags))) {
        return { ok: false, code: 'structural_edit', message: 'The property edit changed nested graph structure.' };
      }
    }
    const names = new Set<string>();
    for (const attr of Array.from((before as any).attributes || []) as any[]) names.add(String(attr.name));
    for (const attr of Array.from((after as any).attributes || []) as any[]) names.add(String(attr.name));
    const attributes = [...names].flatMap(name => {
      const left = before.hasAttribute(name) ? before.getAttribute(name) : null;
      const right = after.hasAttribute(name) ? after.getAttribute(name) : null;
      return left === right ? [] : [{ name, value: right }];
    });
    if (attributes.length) deltas.push({ path, attributes });
    const beforeCounts = new Map<string, number>();
    const afterByPath = new Map<string, Element>();
    const afterCounts = new Map<string, number>();
    for (const child of afterChildren) {
      const index = afterCounts.get(child.tagName) || 0;
      afterCounts.set(child.tagName, index + 1);
      afterByPath.set(`${path}/${child.tagName}[${index}]`, child);
    }
    for (const child of beforeChildren) {
      const index = beforeCounts.get(child.tagName) || 0;
      beforeCounts.set(child.tagName, index + 1);
      const childPath = `${path}/${child.tagName}[${index}]`;
      const next = afterByPath.get(childPath);
      if (!next) continue;
      const failure = walk(child, next, childPath);
      if (failure) return failure;
    }
    return null;
  };
  const rootPath = `${beforeRoot.tagName}[0]`;
  const failure = walk(beforeRoot, afterRoot, rootPath);
  return failure || deltas;
}

function mergeGeneratedPropertyDelta(sourceFragment: string, beforeGenerated: string, afterGenerated: string): string | NodeSelectionFailure {
  const deltas = generatedAttributeDeltas(beforeGenerated, afterGenerated);
  if (!Array.isArray(deltas)) return deltas;
  const spans = indexXmlElementSpans(sourceFragment);
  const edits: Array<{ start: number; end: number; xml: string }> = [];
  for (const delta of deltas) {
    const span = spans.get(delta.path);
    if (!span) return { ok: false, code: 'source_shape_mismatch', message: `The source element ${delta.path} is unavailable for a lossless property edit.` };
    const fragment = sourceFragment.slice(span.start, span.end);
    const openEnd = openingTagEnd(fragment);
    if (openEnd < 0) return { ok: false, code: 'source_shape_mismatch', message: `The source opening tag for ${delta.path} is unavailable.` };
    let opening = fragment.slice(0, openEnd);
    for (const attribute of delta.attributes) opening = patchOpeningAttribute(opening, attribute.name, attribute.value);
    edits.push({ start: span.start, end: span.start + openEnd, xml: opening });
  }
  // Delay is represented as a property on cue nodes even though it is a child element.
  const beforeSpans = indexXmlElementSpans(beforeGenerated);
  const afterSpans = indexXmlElementSpans(afterGenerated);
  const root = [...beforeSpans.values()].find(span => !span.path.includes('/')) || [...afterSpans.values()].find(span => !span.path.includes('/'));
  if (root) {
    const beforeDelay = beforeSpans.get(`${root.path}/delay[0]`);
    const afterDelay = afterSpans.get(`${root.path}/delay[0]`);
    const sourceDelay = spans.get(`${root.path}/delay[0]`);
    if (beforeDelay || afterDelay) {
      const nextDelayXml = afterDelay ? afterGenerated.slice(afterDelay.start, afterDelay.end) : '';
      if (sourceDelay) edits.push({ start: sourceDelay.start, end: sourceDelay.end, xml: nextDelayXml });
      else if (afterDelay) {
        const rootSpan = spans.get(root.path);
        if (!rootSpan) return { ok: false, code: 'source_shape_mismatch', message: 'The cue source root is unavailable for its delay edit.' };
        const rootFragment = sourceFragment.slice(rootSpan.start, rootSpan.end);
        const rootOpenEnd = openingTagEnd(rootFragment);
        edits.push({ start: rootSpan.start + rootOpenEnd, end: rootSpan.start + rootOpenEnd, xml: nextDelayXml });
      }
    }
  }
  let merged = sourceFragment;
  for (const edit of edits.sort((a, b) => b.start - a.start)) merged = merged.slice(0, edit.start) + edit.xml + merged.slice(edit.end);
  return merged;
}

function cueSourceEdits(original: string, node: MDNode, editedFragment: string): Array<{ start: number; end: number; xml: string; id: string }> | NodeSelectionFailure {
  const source = node.source!;
  const originalFragment = original.slice(source.start, source.end);
  const originalOpenEnd = openingTagEnd(originalFragment);
  const editedOpenEnd = openingTagEnd(editedFragment);
  if (originalOpenEnd < 0 || editedOpenEnd < 0) return { ok: false, code: 'cue_tag_unavailable', message: `${node.label}'s cue tag could not be located safely.` };
  const editedOpening = editedFragment.slice(0, editedOpenEnd).replace(/\/\s*>$/, '>');
  const edits: Array<{ start: number; end: number; xml: string; id: string }> = [{
    start: source.start,
    end: source.start + originalOpenEnd,
    xml: editedOpening,
    id: node.id,
  }];
  const originalSpans = indexXmlElementSpans(original);
  const editedSpans = indexXmlElementSpans(editedFragment);
  const originalDelay = originalSpans.get(`${source.semanticPath}/delay[0]`);
  const editedRoot = [...editedSpans.values()].find(span => !span.path.includes('/'));
  const editedDelay = editedRoot ? editedSpans.get(`${editedRoot.path}/delay[0]`) : undefined;
  const editedDelayXml = editedDelay ? editedFragment.slice(editedDelay.start, editedDelay.end) : '';
  if (originalDelay && editedDelay) {
    edits.push({ start: originalDelay.start, end: originalDelay.end, xml: editedDelayXml, id: node.id });
  } else if (originalDelay && !editedDelay) {
    edits.push({ start: originalDelay.start, end: originalDelay.end, xml: '', id: node.id });
  } else if (!originalDelay && editedDelay) {
    const conditions = originalSpans.get(`${source.semanticPath}/conditions[0]`);
    const insertAt = conditions?.end || (source.start + originalOpenEnd);
    const lineStart = original.lastIndexOf('\n', source.start) + 1;
    const cueIndent = original.slice(lineStart, source.start).match(/^\s*/)?.[0] || '';
    edits.push({ start: insertAt, end: insertAt, xml: `\n${cueIndent}  ${editedDelayXml}`, id: node.id });
  }
  return edits;
}

export function applyNodeSelectionDocument(
  workspace: ModWorkspace,
  nodeIds: string[],
  expectedToken: string,
  editedContent: string,
): NodeSelectionApplyResult {
  if (nodeSelectionToken(workspace, nodeIds) !== expectedToken) {
    return { ok: false, code: 'stale_selection', message: 'The graph changed after this node tab opened. Nothing was applied; reopen the current selection.' };
  }
  const currentDocument = buildNodeSelectionDocument(workspace, nodeIds);
  if (isNodeSelectionFailure(currentDocument)) return currentDocument;
  const marked = markedFragments(editedContent, nodeIds);
  if (!Array.isArray(marked)) return marked;
  const expected = new Set(nodeIds);
  const actual = new Set(marked.map(fragment => fragment.id));
  if (marked.length !== nodeIds.length || actual.size !== expected.size || [...expected].some(id => !actual.has(id))
    || marked.some((fragment, index) => fragment.id !== nodeIds[index])) {
    return { ok: false, code: 'identity_markers_changed', message: 'Node identity markers were removed, duplicated, or changed. Nothing was applied.' };
  }

  const replacements: Array<{ node: MDNode; next: MDNode; xml: string }> = [];
  for (const fragment of marked) {
    const existing = workspace.nodes.find(node => node.id === fragment.id);
    if (!existing) return { ok: false, code: 'node_missing', message: `Node ${fragment.id} no longer exists.` };
    const expectedParent = existing.type === 'cue' ? 'cues' : existing.type === 'action' ? 'actions' : 'conditions';
    if (fragment.parentTag !== expectedParent) {
      return { ok: false, code: 'structural_edit', message: `${existing.label} moved from its ${expectedParent} section. Rewire or reparent it on the canvas instead.` };
    }
    let next: MDNode;
    if (localizedRawNode(existing)) {
      const originalFragment = sourceNodeFragment(workspace, existing) || renderNodeFragment(workspace, existing);
      if (!originalFragment) return { ok: false, code: 'source_missing', message: `${existing.label}'s raw XML is unavailable; nothing was applied.` };
      const originalRoot = new DOMParser().parseFromString(originalFragment, 'text/xml').documentElement as unknown as Element;
      const editedRoot = new DOMParser().parseFromString(fragment.xml, 'text/xml').documentElement as unknown as Element;
      if (!originalRoot || !editedRoot || originalRoot.tagName !== editedRoot.tagName) {
        return { ok: false, code: 'type_changed', message: `${existing.label} changed from <${originalRoot?.tagName || 'unknown'}> to <${editedRoot?.tagName || 'unknown'}>. Replace the node type on the canvas instead.` };
      }
      next = {
        ...existing,
        label: existing.type === 'event' ? `Event: <${editedRoot.tagName}>`
          : existing.type === 'condition' ? `Condition: <${editedRoot.tagName}>`
          : existing.type === 'cue' ? `${editedRoot.tagName === 'library' ? 'Library' : 'Cue'}: ${editedRoot.getAttribute('name') || editedRoot.tagName}`
          : `XML: <${editedRoot.tagName}>`,
        properties: { ...existing.properties, rawXml: fragment.xml, sourceTag: editedRoot.tagName },
      };
    } else {
      const parsed = parseEditedNode(existing, fragment.xml);
      if (!('id' in parsed)) return parsed;
      next = parsed;
    }
    const rerendered = renderNodeFragment(workspace, next);
    const sourceFragment = sourceNodeFragment(workspace, existing);
    const hasSourceChildren = sourceFragment
      ? elementChildren(new DOMParser().parseFromString(sourceFragment, 'text/xml').documentElement as unknown as Element).length > 0
      : false;
    if (!rerendered) {
      return { ok: false, code: 'lossy_edit', message: `${existing.label} contains a change Forge cannot represent losslessly. Nothing was applied.` };
    }
    if (!sourceFragment || !hasSourceChildren) {
      if (canonicalElement(rerendered) !== canonicalElement(fragment.xml)) {
        return { ok: false, code: 'lossy_edit', message: `${existing.label} contains a change Forge cannot represent losslessly. Nothing was applied.` };
      }
    } else if (existing.type !== 'cue' && rootBody(sourceFragment) !== rootBody(fragment.xml)) {
      return { ok: false, code: 'structural_edit', message: `${existing.label}'s nested XML changed. Add/remove/reparent child nodes on the canvas instead.` };
    }
    replacements.push({ node: existing, next, xml: fragment.xml });
  }

  const nextWorkspace = structuredClone(workspace) as ModWorkspace;
  for (const replacement of replacements) {
    const index = nextWorkspace.nodes.findIndex(node => node.id === replacement.node.id);
    nextWorkspace.nodes[index] = { ...nextWorkspace.nodes[index], label: replacement.next.label, properties: replacement.next.properties };
  }

  const files = new Map<string, Array<{ start: number; end: number; xml: string; id: string }>>();
  for (const replacement of replacements) {
    const source = replacement.node.source;
    if (!source) continue;
    const original = nextWorkspace.originalFiles?.find(file => file.kind === 'md' && file.path === source.path);
    if (!original) return { ok: false, code: 'source_missing', message: `The imported source for ${replacement.node.label} is unavailable; nothing was applied.` };
    const list = files.get(source.path) || [];
    if (localizedRawNode(replacement.node)) {
      list.push({ start: source.start, end: source.end, xml: replacement.xml, id: replacement.node.id });
    } else if (replacement.node.type === 'cue') {
      const cueEdits = cueSourceEdits(original.content, replacement.node, replacement.xml);
      if (!Array.isArray(cueEdits)) return cueEdits;
      list.push(...cueEdits);
    } else {
      const originalFragment = original.content.slice(source.start, source.end);
      const hasChildren = elementChildren(new DOMParser().parseFromString(originalFragment, 'text/xml').documentElement as unknown as Element).length > 0;
      if (hasChildren) {
        const originalOpenEnd = openingTagEnd(originalFragment);
        const editedOpenEnd = openingTagEnd(replacement.xml);
        if (originalOpenEnd < 0 || editedOpenEnd < 0) return { ok: false, code: 'source_shape_mismatch', message: `${replacement.node.label}'s opening tag is unavailable.` };
        list.push({ start: source.start, end: source.start + originalOpenEnd, xml: replacement.xml.slice(0, editedOpenEnd), id: replacement.node.id });
      } else {
        list.push({ start: source.start, end: source.end, xml: replacement.xml, id: replacement.node.id });
      }
    }
    files.set(source.path, list);
  }
  for (const [path, edits] of files) {
    const original = nextWorkspace.originalFiles!.find(file => file.kind === 'md' && file.path === path) as OriginalModeledFile;
    const sorted = edits.slice().sort((a, b) => b.start - a.start);
    for (let index = 1; index < sorted.length; index++) {
      if (sorted[index - 1].start < sorted[index].end) {
        return { ok: false, code: 'overlapping_selection', message: 'The selection contains parent and child source spans. Edit either the parent or child node, not both at once.' };
      }
    }
    let content = original.content;
    for (const edit of sorted) content = content.slice(0, edit.start) + edit.xml + content.slice(edit.end);
    original.content = content;
    updateSourceSpans(nextWorkspace, path, content);
  }
  for (const replacement of replacements) {
    if (!replacement.node.source) continue;
    const nextNode = nextWorkspace.nodes.find(node => node.id === replacement.node.id);
    const nextSource = nextNode?.source;
    const original = nextWorkspace.originalFiles?.find(file => file.kind === 'md' && file.path === nextSource?.path);
    if (!nextNode || !nextSource || !original) return { ok: false, code: 'source_missing', message: `${replacement.node.label}'s updated source span is unavailable.` };
    const appliedFragment = original.content.slice(nextSource.start, nextSource.end);
    if (canonicalElement(appliedFragment) !== canonicalElement(replacement.xml)) {
      return { ok: false, code: 'structural_edit', message: `${replacement.node.label}'s edit changed XML outside the node properties Forge can safely apply. Nothing was applied.` };
    }
  }
  for (const original of nextWorkspace.originalFiles || []) {
    if (original.kind !== 'md' || !original.stem || !files.has(original.path)) continue;
    original.fingerprint = mdStemFingerprint(nextWorkspace, original.stem);
  }

  const changedNodeIds = replacements
    .filter(replacement => stableStringify(replacement.node.properties) !== stableStringify(replacement.next.properties))
    .map(replacement => replacement.node.id);
  return {
    ok: true,
    workspace: nextWorkspace,
    changedNodeIds,
    summary: changedNodeIds.length ? `Updated ${changedNodeIds.length} selected graph node${changedNodeIds.length === 1 ? '' : 's'}.` : 'No semantic node changes detected.',
    diff: simpleDiff(currentDocument.content, editedContent),
  };
}

/**
 * Apply an inspector property edit through the same guarded source-span path as the
 * native node document. Imported files remain source-authoritative; the graph and
 * original-file fingerprint advance together in one atomic workspace replacement.
 */
export function applyNodePropertyChange(
  workspace: ModWorkspace,
  nodeId: string,
  key: string,
  value: unknown,
): NodeSelectionApplyResult {
  const existing = workspace.nodes.find(node => node.id === nodeId);
  if (!existing) return { ok: false, code: 'node_missing', message: `Node ${nodeId} no longer exists.` };
  if (!existing.source) {
    const nextWorkspace = structuredClone(workspace) as ModWorkspace;
    const index = nextWorkspace.nodes.findIndex(node => node.id === nodeId);
    nextWorkspace.nodes[index] = { ...nextWorkspace.nodes[index], properties: { ...nextWorkspace.nodes[index].properties, [key]: value } };
    return { ok: true, workspace: nextWorkspace, changedNodeIds: [nodeId], summary: `Updated ${existing.label || existing.xmlTag}.`, diff: '' };
  }
  if (localizedRawNode(existing)) {
    if (key !== 'rawXml') return { ok: false, code: 'property_not_serialized', message: `${existing.label}'s rawXml field is its editable source; other metadata is read-only.` };
    const currentDocument = buildNodeSelectionDocument(workspace, [nodeId]);
    if (isNodeSelectionFailure(currentDocument)) return currentDocument;
    const currentFragment = sourceNodeFragment(workspace, existing) || renderNodeFragment(workspace, existing);
    if (!currentFragment) return { ok: false, code: 'source_missing', message: `${existing.label}'s raw XML is unavailable.` };
    const marker = encodedMarker(nodeId);
    const markerAt = currentDocument.content.indexOf(marker);
    const fragmentAt = markerAt >= 0 ? currentDocument.content.indexOf(currentFragment, markerAt + marker.length) : -1;
    if (fragmentAt < 0) return { ok: false, code: 'selection_mismatch', message: `${existing.label}'s exact source fragment is no longer present in the node document.` };
    const editedFragment = String(value ?? '');
    const editedContent = currentDocument.content.slice(0, fragmentAt) + editedFragment + currentDocument.content.slice(fragmentAt + currentFragment.length);
    return applyNodeSelectionDocument(workspace, [nodeId], currentDocument.token, editedContent);
  }
  if (opaque(existing)) return { ok: false, code: 'opaque_node', message: `${existing.label} cannot be mapped back to source safely.` };
  const currentDocument = buildNodeSelectionDocument(workspace, [nodeId]);
  if (isNodeSelectionFailure(currentDocument)) return currentDocument;
  const currentFragment = sourceNodeFragment(workspace, existing) || renderNodeFragment(workspace, existing);
  const beforeGenerated = renderNodeFragment(workspace, existing);
  const nextNode = { ...existing, properties: { ...existing.properties, [key]: value } };
  const afterGenerated = renderNodeFragment(workspace, nextNode);
  if (!currentFragment || !beforeGenerated || !afterGenerated) {
    return { ok: false, code: 'render_failed', message: `${existing.label}'s property could not be rendered safely.` };
  }
  const editedFragment = existing.source
    ? mergeGeneratedPropertyDelta(currentFragment, beforeGenerated, afterGenerated)
    : afterGenerated;
  if (typeof editedFragment !== 'string') return editedFragment;
  if (editedFragment === currentFragment && stableStringify(existing.properties?.[key]) !== stableStringify(value)) {
    return { ok: false, code: 'property_not_serialized', message: `${existing.label}'s ${key} field does not map to editable source XML.` };
  }
  const marker = encodedMarker(nodeId);
  const markerAt = currentDocument.content.indexOf(marker);
  const fragmentAt = markerAt >= 0 ? currentDocument.content.indexOf(currentFragment, markerAt + marker.length) : -1;
  if (fragmentAt < 0) return { ok: false, code: 'selection_mismatch', message: `${existing.label}'s exact source fragment is no longer present in the node document.` };
  const editedContent = currentDocument.content.slice(0, fragmentAt) + editedFragment + currentDocument.content.slice(fragmentAt + currentFragment.length);
  return applyNodeSelectionDocument(workspace, [nodeId], currentDocument.token, editedContent);
}

export function runNodeSelectionDocumentSelftest(): { allPassed: boolean; passed: number; total: number; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const node = (id: string, type: MDNode['type'], xmlTag: string, properties: Record<string, unknown>, source?: MDNode['source']): MDNode => ({ id, type, xmlTag, label: id, x: 10, y: 20, properties, propertiesSchema: [], inputs: [], outputs: [], includeInBuild: true, source });
  const original = `<?xml version="1.0"?>\n<mdscript name="T"><cues>\n  <!-- rationale stays -->\n  <cue name="Start"><conditions><event_game_started /></conditions><actions>\n    <set_value name="$x" exact="1" />\n    <set_value name="$x" exact="1" />\n    <do_if value="$x"><set_value name="$nested" exact="2" /></do_if>\n  </actions></cue>\n  <cue name="Start_Long"><actions><set_value name="$y" exact="3" /></actions></cue>\n</cues></mdscript>`;
  const spans = indexXmlElementSpans(original);
  const source = (semanticPath: string): MDNode['source'] => ({ path: 'md/test.xml', semanticPath, start: spans.get(semanticPath)!.start, end: spans.get(semanticPath)!.end, modeled: true });
  const cue = node('cue', 'cue', 'cue', { name: 'Start', instantiate: 'false', namespace: 'this', mdFileStem: 'test', mdScript: 'T' }, source('mdscript[0]/cues[0]/cue[0]'));
  const event = node('event', 'event', 'event_game_started', {}, source('mdscript[0]/cues[0]/cue[0]/conditions[0]/event_game_started[0]'));
  const first = node('first', 'action', 'set_value', { name: '$x', exact: '1' }, source('mdscript[0]/cues[0]/cue[0]/actions[0]/set_value[0]'));
  const second = node('second', 'action', 'set_value', { name: '$x', exact: '1' }, source('mdscript[0]/cues[0]/cue[0]/actions[0]/set_value[1]'));
  const container = node('container', 'action', 'do_if', { value: '$x' }, source('mdscript[0]/cues[0]/cue[0]/actions[0]/do_if[0]'));
  const nested = node('nested', 'action', 'set_value', { name: '$nested', exact: '2' }, source('mdscript[0]/cues[0]/cue[0]/actions[0]/do_if[0]/set_value[0]'));
  const otherCue = node('otherCue', 'cue', 'cue', { name: 'Start_Long', instantiate: 'false', namespace: 'this', mdFileStem: 'test', mdScript: 'T' }, source('mdscript[0]/cues[0]/cue[1]'));
  const other = node('other', 'action', 'set_value', { name: '$y', exact: '3' }, source('mdscript[0]/cues[0]/cue[1]/actions[0]/set_value[0]'));
  const links = [
    { id: 'l1', sourceNodeId: 'cue', sourcePortId: 'out_cond', targetNodeId: 'event', targetPortId: 'in_cond' },
    { id: 'l2', sourceNodeId: 'cue', sourcePortId: 'out_act', targetNodeId: 'first', targetPortId: 'in_act' },
    { id: 'l3', sourceNodeId: 'first', sourcePortId: 'out_next', targetNodeId: 'second', targetPortId: 'in_act' },
    { id: 'l3b', sourceNodeId: 'second', sourcePortId: 'out_next', targetNodeId: 'container', targetPortId: 'in_act' },
    { id: 'l3c', sourceNodeId: 'container', sourcePortId: 'out_next', targetNodeId: 'nested', targetPortId: 'in_act' },
    { id: 'l4', sourceNodeId: 'otherCue', sourcePortId: 'out_act', targetNodeId: 'other', targetPortId: 'in_act' },
  ];
  const workspace = {
    id: 'w', name: 'T', version: '1', author: 'A', description: '', nodes: [cue, event, first, second, container, nested, otherCue, other], links,
    uiWidgets: [], uiTheme: { backgroundColor: '#000', borderColor: '#000', accentColor: '#000', opacity: 1, showIcons: true },
    originalFiles: [{ path: 'md/test.xml', content: original, kind: 'md', stem: 'test', fingerprint: '' }],
  } as ModWorkspace;
  workspace.originalFiles![0].fingerprint = mdStemFingerprint(workspace, 'test');
  const built = buildNodeSelectionDocument(workspace, ['second']);
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  if (isNodeSelectionFailure(built)) return { allPassed: false, passed: 0, total: 1, checks: [{ name: 'build', pass: false, detail: built.message }] };
  const edited = built.content.replace('exact="1"', 'exact="9"');
  const applied = applyNodeSelectionDocument(workspace, ['second'], built.token, edited);
  checks.push({ name: 'single_node_apply', pass: !isNodeSelectionFailure(applied) && applied.changedNodeIds.length === 1, detail: isNodeSelectionFailure(applied) ? `${applied.code}: ${applied.message}` : applied.summary });
  checks.push({ name: 'duplicate_sibling_identity', pass: !isNodeSelectionFailure(applied) && applied.workspace.nodes.find(n => n.id === 'first')?.properties.exact === '1' && applied.workspace.nodes.find(n => n.id === 'second')?.properties.exact === '9' });
  const secondSpan = spans.get('mdscript[0]/cues[0]/cue[0]/actions[0]/set_value[1]')!;
  checks.push({ name: 'outside_span_byte_identical', pass: !isNodeSelectionFailure(applied)
    && applied.workspace.originalFiles![0].content.slice(0, secondSpan.start) === original.slice(0, secondSpan.start)
    && applied.workspace.originalFiles![0].content.endsWith(original.slice(secondSpan.end)) });
  checks.push({ name: 'leading_comment_preserved', pass: !isNodeSelectionFailure(applied) && applied.workspace.originalFiles![0].content.includes('<!-- rationale stays -->') });
  checks.push({ name: 'substring_cue_untouched', pass: !isNodeSelectionFailure(applied) && applied.workspace.originalFiles![0].content.includes('<cue name="Start_Long"><actions><set_value name="$y" exact="3" /></actions></cue>') });
  const multiBuilt = buildNodeSelectionDocument(workspace, ['first', 'second']);
  if (isNodeSelectionFailure(multiBuilt)) {
    checks.push({ name: 'multi_selection_contains_and_applies_all_selected_nodes', pass: false, detail: multiBuilt.message });
  } else {
    const multiApplied = applyNodeSelectionDocument(workspace, ['first', 'second'], multiBuilt.token, multiBuilt.content.replace('exact="1"', 'exact="7"'));
    checks.push({ name: 'multi_selection_contains_and_applies_all_selected_nodes', pass: !isNodeSelectionFailure(multiApplied)
      && (multiBuilt.content.match(new RegExp(MARKER, 'g')) || []).length === 2
      && multiApplied.workspace.nodes.find(node => node.id === 'first')?.properties.exact === '7'
      && multiApplied.workspace.nodes.find(node => node.id === 'second')?.properties.exact === '1' });
  }
  const cueBuilt = buildNodeSelectionDocument(workspace, ['cue']);
  if (isNodeSelectionFailure(cueBuilt)) {
    checks.push({ name: 'cue_attribute_apply_preserves_children', pass: false, detail: cueBuilt.message });
  } else {
    const cueApplied = applyNodeSelectionDocument(workspace, ['cue'], cueBuilt.token, cueBuilt.content.replace('name="Start"', 'name="Renamed"'));
    checks.push({ name: 'cue_attribute_apply_preserves_children', pass: !isNodeSelectionFailure(cueApplied)
      && /<cue name="Renamed"[^>]*>/.test(cueApplied.workspace.originalFiles![0].content)
      && cueApplied.workspace.originalFiles![0].content.includes('<conditions><event_game_started /></conditions>')
      && cueApplied.workspace.originalFiles![0].content.includes('<set_value name="$x" exact="1" />'),
      detail: isNodeSelectionFailure(cueApplied) ? `${cueApplied.code}: ${cueApplied.message}` : cueApplied.workspace.originalFiles![0].content });
  }
  const propertyApplied = applyNodePropertyChange(workspace, 'second', 'exact', '8');
  checks.push({ name: 'inspector_leaf_property_splices_source', pass: !isNodeSelectionFailure(propertyApplied)
    && propertyApplied.workspace.nodes.find(node => node.id === 'second')?.properties.exact === '8'
    && propertyApplied.workspace.originalFiles![0].content.includes('<set_value name="$x" exact="8" />'),
    detail: isNodeSelectionFailure(propertyApplied) ? `${propertyApplied.code}: ${propertyApplied.message}` : propertyApplied.summary });
  const containerApplied = applyNodePropertyChange(workspace, 'container', 'value', '$y');
  checks.push({ name: 'inspector_container_property_preserves_nested_logic', pass: !isNodeSelectionFailure(containerApplied)
    && containerApplied.workspace.nodes.find(node => node.id === 'container')?.properties.value === '$y'
    && containerApplied.workspace.originalFiles![0].content.includes('<do_if value="$y"><set_value name="$nested" exact="2" /></do_if>'),
    detail: isNodeSelectionFailure(containerApplied) ? `${containerApplied.code}: ${containerApplied.message}` : containerApplied.summary });
  const stale = applyNodeSelectionDocument({ ...workspace, nodes: workspace.nodes.map(n => n.id === 'second' ? { ...n, properties: { ...n.properties, exact: '4' } } : n) }, ['second'], built.token, edited);
  checks.push({ name: 'stale_token_refused', pass: isNodeSelectionFailure(stale) && stale.code === 'stale_selection' });
  const staleSourceWorkspace = structuredClone(workspace) as ModWorkspace;
  const staleSecondFragment = original.slice(secondSpan.start, secondSpan.end).replace('exact="1"', 'exact="5"');
  staleSourceWorkspace.originalFiles![0].content = original.slice(0, secondSpan.start) + staleSecondFragment + original.slice(secondSpan.end);
  const staleSource = applyNodeSelectionDocument(staleSourceWorkspace, ['second'], built.token, edited);
  checks.push({ name: 'source_byte_change_refused_as_stale', pass: isNodeSelectionFailure(staleSource) && staleSource.code === 'stale_selection' });
  const missingMarker = applyNodeSelectionDocument(workspace, ['second'], built.token, edited.replace(encodedMarker('second'), ''));
  checks.push({ name: 'marker_removal_refused', pass: isNodeSelectionFailure(missingMarker) && missingMarker.code === 'identity_markers_changed' });
  const structural = applyNodeSelectionDocument(workspace, ['second'], built.token, edited.replace('<set_value name="$x" exact="9" />', '<do_if value="$x"><set_value name="$x" exact="9" /></do_if>'));
  checks.push({ name: 'tag_or_structure_change_refused', pass: !structural.ok });
  const rawSource = source('mdscript[0]/cues[0]/cue[0]/actions[0]/set_value[0]');
  const rawFragment = original.slice(rawSource!.start, rawSource!.end);
  const rawWorkspace = { ...workspace, nodes: [node('raw', 'action', 'custom_xml', { rawXml: rawFragment, sourceTag: 'set_value' }, rawSource)] } as ModWorkspace;
  const rawBuilt = buildNodeSelectionDocument(rawWorkspace, ['raw']);
  if (isNodeSelectionFailure(rawBuilt)) {
    checks.push({ name: 'localized_raw_node_editable', pass: false, detail: rawBuilt.message });
    checks.push({ name: 'localized_raw_root_change_refused', pass: false, detail: rawBuilt.message });
  } else {
    const rawApplied = applyNodeSelectionDocument(rawWorkspace, ['raw'], rawBuilt.token, rawBuilt.content.replace('exact="1"', 'exact="4"'));
    checks.push({ name: 'localized_raw_node_editable', pass: !rawBuilt.readOnly && !isNodeSelectionFailure(rawApplied)
      && rawApplied.workspace.nodes[0].properties.rawXml.includes('exact="4"')
      && rawApplied.workspace.originalFiles![0].content.includes('<set_value name="$x" exact="4" />'),
      detail: isNodeSelectionFailure(rawApplied) ? `${rawApplied.code}: ${rawApplied.message}` : rawApplied.summary });
    const rawTypeChanged = applyNodeSelectionDocument(rawWorkspace, ['raw'], rawBuilt.token, rawBuilt.content.replace('<set_value name="$x" exact="1" />', '<do_if value="$x" />'));
    checks.push({ name: 'localized_raw_root_change_refused', pass: isNodeSelectionFailure(rawTypeChanged) && rawTypeChanged.code === 'type_changed' });
  }
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}
