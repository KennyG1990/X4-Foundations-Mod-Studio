/**
 * Read-only X4 XML-patch interpreter.
 *
 * The game grammar is libraries/diff.xsd.  This module deliberately keeps the
 * interpreter pure: callers provide base + <diff> text and receive a new string
 * plus diagnostics.  No filesystem writes are possible here.
 */

import * as xpath from 'xpath';
import {
  DOMParser,
  XMLSerializer,
  type Document as XmlDocument,
  type Element as XmlElement,
  type Node as XmlNode,
} from '@xmldom/xmldom';

export type DiffPosition = 'child' | 'before' | 'after' | 'prepend';

export interface DiffOperation {
  type: 'add' | 'replace' | 'remove';
  sel: string;
  pos?: DiffPosition;
  /** X4 diff.xsd calls this `type`; attribute additions use values such as @chance. */
  attrType?: string;
  content?: string;
  ifCondition?: string;
  silent?: boolean;
  line?: number;
}

export interface DiffFinding {
  severity: 'error' | 'warning' | 'info';
  code:
    | 'DIFF_XML_INVALID'
    | 'DIFF_ROOT_INVALID'
    | 'DIFF_OPERATION_INVALID'
    | 'DIFF_SELECTOR_INVALID'
    | 'DIFF_SELECTOR_ZERO'
    | 'DIFF_SELECTOR_MULTI'
    | 'DIFF_CONDITION_INVALID'
    | 'DIFF_CONDITION_FALSE'
    | 'DIFF_APPLY_FAILED';
  message: string;
  operation?: number;
  line?: number;
  selector?: string;
  matches?: number;
}

export interface DiffSimulationResult {
  ok: boolean;
  content: string;
  operations: Array<DiffOperation & { index: number; matches: number; applied: boolean }>;
  findings: DiffFinding[];
}

const serializer = new XMLSerializer();

function isElement(node: XmlNode | null | undefined): node is XmlElement {
  return Boolean(node && node.nodeType === 1);
}

function parseDocument(xml: string): { document: XmlDocument | null; error?: string } {
  let fatal = '';
  try {
    const document = new DOMParser({
      onError(level: string, message: string) {
        if (level === 'fatalError' || level === 'error') fatal ||= message;
      },
    }).parseFromString(String(xml || '').replace(/^\uFEFF/, ''), 'text/xml');
    if (!document?.documentElement) return { document: null, error: fatal || 'document has no root element' };
    if (fatal) return { document: null, error: fatal };
    return { document };
  } catch (error) {
    return { document: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function operationLines(xml: string): number[] {
  const lines: number[] = [];
  for (const match of xml.matchAll(/<(?:add|replace|remove)\b/gi)) {
    lines.push(xml.slice(0, match.index || 0).split('\n').length);
  }
  return lines;
}

function serializeChildren(element: XmlElement): string {
  let value = '';
  for (let i = 0; i < element.childNodes.length; i++) value += serializer.serializeToString(element.childNodes[i]);
  return value;
}

function parseOperations(diffXml: string): { operations: DiffOperation[]; findings: DiffFinding[] } {
  const parsed = parseDocument(diffXml);
  if (!parsed.document) {
    return { operations: [], findings: [{ severity: 'error', code: 'DIFF_XML_INVALID', message: `Diff XML is invalid: ${parsed.error || 'parse failed'}.` }] };
  }
  const root = parsed.document.documentElement;
  if (root.nodeName.toLowerCase() !== 'diff') {
    return { operations: [], findings: [{ severity: 'error', code: 'DIFF_ROOT_INVALID', message: `Expected <diff> root, found <${root.nodeName}>.` }] };
  }
  const lines = operationLines(diffXml);
  const operations: DiffOperation[] = [];
  const findings: DiffFinding[] = [];
  for (let i = 0; i < root.childNodes.length; i++) {
    const child = root.childNodes[i];
    if (!isElement(child)) continue;
    const type = child.nodeName.toLowerCase();
    const operationIndex = operations.length;
    if (type !== 'add' && type !== 'replace' && type !== 'remove') {
      findings.push({
        severity: 'error', code: 'DIFF_OPERATION_INVALID', operation: operationIndex, line: lines[operationIndex],
        message: `Illegal <${child.nodeName}> operation; diff.xsd permits add, replace, or remove.`,
      });
      continue;
    }
    const sel = child.getAttribute('sel') || '';
    if (!sel) {
      findings.push({
        severity: 'error', code: 'DIFF_OPERATION_INVALID', operation: operationIndex, line: lines[operationIndex],
        message: `<${type}> is missing required @sel (diff.xsd).`,
      });
    }
    const rawPos = child.getAttribute('pos') || '';
    const pos = rawPos ? rawPos as DiffPosition : undefined;
    if (pos && !['before', 'after', 'prepend'].includes(pos)) {
      findings.push({
        severity: 'error', code: 'DIFF_OPERATION_INVALID', operation: operationIndex, line: lines[operationIndex], selector: sel,
        message: `Illegal add position "${rawPos}"; diff.xsd permits before, after, or prepend.`,
      });
    }
    operations.push({
      type,
      sel,
      pos,
      attrType: child.getAttribute('type') || undefined,
      content: serializeChildren(child),
      ifCondition: child.getAttribute('if') || undefined,
      silent: /^(1|true)$/i.test(child.getAttribute('silent') || ''),
      line: lines[operationIndex],
    });
  }
  return { operations, findings };
}

function truthyXpath(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') return value.length > 0;
  return Boolean(value);
}

function splitAbsolutePath(expression: string): string[] | null {
  if (!expression.startsWith('/') || expression.startsWith('//')) return null;
  const steps: string[] = [];
  let current = '';
  let bracketDepth = 0;
  let quote = '';
  for (let index = 1; index < expression.length; index++) {
    const char = expression[index];
    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; current += char; continue; }
    if (char === '[') bracketDepth++;
    else if (char === ']') bracketDepth--;
    if (char === '/' && bracketDepth === 0) { steps.push(current); current = ''; }
    else current += char;
  }
  if (current) steps.push(current);
  return bracketDepth === 0 && !quote && steps.every(Boolean) ? steps : null;
}

/** Fast, exact subset covering the corpus' common /root/item[@id='x']/@attr selectors. */
function selectSimpleAbsolute(expression: string, document: XmlDocument): XmlNode[] | null {
  const steps = splitAbsolutePath(expression);
  if (!steps?.length) return null;
  let nodes: XmlNode[] = [document.documentElement];
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];
    if (step.startsWith('@')) {
      if (stepIndex !== steps.length - 1 || !/^@[A-Za-z_][\w.:-]*$/.test(step)) return null;
      const attrs: XmlNode[] = [];
      for (const node of nodes) {
        if (!isElement(node)) continue;
        const attr = node.getAttributeNode(step.slice(1));
        if (attr) attrs.push(attr);
      }
      return attrs;
    }
    const match = /^([A-Za-z_][\w.:-]*|\*)(?:\[@([A-Za-z_][\w.:-]*)=(['"])([\s\S]*?)\3\])?(?:\[(\d+)\])?$/.exec(step);
    if (!match) return null;
    const [, tag, attrName, , attrValue, positionText] = match;
    if (stepIndex === 0) {
      const root = document.documentElement;
      if ((tag !== '*' && root.nodeName !== tag) || (attrName && root.getAttribute(attrName) !== attrValue)) return [];
      if (positionText && Number(positionText) !== 1) return [];
      nodes = [root];
      continue;
    }
    const next: XmlNode[] = [];
    for (const parent of nodes) {
      const local: XmlNode[] = [];
      for (let childIndex = 0; childIndex < parent.childNodes.length; childIndex++) {
        const child = parent.childNodes[childIndex];
        if (!isElement(child) || (tag !== '*' && child.nodeName !== tag)) continue;
        if (attrName && child.getAttribute(attrName) !== attrValue) continue;
        local.push(child);
      }
      if (positionText) {
        const selected = local[Number(positionText) - 1];
        if (selected) next.push(selected);
      } else next.push(...local);
    }
    nodes = next;
    if (nodes.length === 0) return nodes;
  }
  return nodes;
}

function normalizeXpathTokens(expression: string): string {
  let normalized = '';
  let quote = '';
  for (let index = 0; index < expression.length; index++) {
    const char = expression[index];
    if (quote) {
      normalized += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; normalized += char; continue; }
    if (expression.startsWith('or.', index) && (index === 0 || /\s|\]/.test(expression[index - 1]))) {
      normalized += 'or .'; index += 2; continue;
    }
    if (expression.startsWith('and.', index) && (index === 0 || /\s|\]/.test(expression[index - 1]))) {
      normalized += 'and .'; index += 3; continue;
    }
    normalized += char;
  }
  return normalized;
}

function select(expression: string, document: XmlDocument): unknown {
  const fast = selectSimpleAbsolute(expression, document);
  return fast === null ? xpath.select(normalizeXpathTokens(expression), document as unknown as Node) : fast;
}

function payloadNodes(document: XmlDocument, content: string): XmlNode[] {
  if (!content) return [];
  const wrapped = parseDocument(`<x4forge-fragment>${content}</x4forge-fragment>`);
  if (!wrapped.document) throw new Error(`invalid patch payload: ${wrapped.error || 'parse failed'}`);
  const nodes: XmlNode[] = [];
  const root = wrapped.document.documentElement;
  for (let i = 0; i < root.childNodes.length; i++) {
    const node = root.childNodes[i];
    // Formatting-only whitespace belongs to the patch wrapper, not the target document.
    if (node.nodeType === 3 && !String(node.nodeValue || '').trim()) continue;
    nodes.push(document.importNode(node, true));
  }
  return nodes;
}

function directPayloadText(content: string): string {
  const wrapped = parseDocument(`<x4forge-fragment>${content}</x4forge-fragment>`);
  return wrapped.document?.documentElement.textContent || '';
}

function applyToNode(document: XmlDocument, target: XmlNode, operation: DiffOperation): void {
  const anyTarget = target as any;
  if (operation.type === 'remove') {
    if (target.nodeType === 2) {
      const owner = anyTarget.ownerElement as XmlElement | undefined;
      if (!owner) throw new Error('selected attribute has no owner element');
      owner.removeAttribute(anyTarget.name || target.nodeName);
      return;
    }
    if (!target.parentNode) throw new Error('cannot remove the document root');
    target.parentNode.removeChild(target);
    return;
  }

  if (operation.type === 'replace') {
    if (target.nodeType === 2) {
      anyTarget.value = directPayloadText(operation.content || '');
      anyTarget.nodeValue = anyTarget.value;
      return;
    }
    const nodes = payloadNodes(document, operation.content || '');
    if (nodes.length === 0) throw new Error('replace operation has no payload');
    if (!target.parentNode) throw new Error('cannot replace the document root');
    const parent = target.parentNode;
    for (const node of nodes) parent.insertBefore(node, target);
    parent.removeChild(target);
    return;
  }

  if (!isElement(target)) throw new Error('add selector must resolve to an element');
  if (operation.attrType) {
    if (!operation.attrType.startsWith('@')) throw new Error(`unsupported add @type "${operation.attrType}"; expected @attribute`);
    target.setAttribute(operation.attrType.slice(1), directPayloadText(operation.content || ''));
    return;
  }
  const nodes = payloadNodes(document, operation.content || '');
  if (operation.pos === 'before' || operation.pos === 'after') {
    if (!target.parentNode) throw new Error(`cannot insert ${operation.pos} the document root`);
    const parent = target.parentNode;
    const reference = operation.pos === 'before' ? target : target.nextSibling;
    for (const node of nodes) parent.insertBefore(node, reference);
  } else if (operation.pos === 'prepend') {
    const reference = target.firstChild;
    for (const node of nodes) target.insertBefore(node, reference);
  } else {
    for (const node of nodes) target.appendChild(node);
  }
}

/** Apply already parsed operations. Used by the patch synthesizer's round-trip oracle too. */
export function applyDiffOperations(baseXml: string, operations: DiffOperation[]): DiffSimulationResult {
  const parsed = parseDocument(baseXml);
  if (!parsed.document) {
    return {
      ok: false, content: baseXml, operations: [],
      findings: [{ severity: 'error', code: 'DIFF_XML_INVALID', message: `Base XML is invalid: ${parsed.error || 'parse failed'}.` }],
    };
  }
  const document = parsed.document;
  const findings: DiffFinding[] = [];
  const outcomes: DiffSimulationResult['operations'] = [];

  operations.forEach((operation, index) => {
    if (operation.ifCondition) {
      try {
        if (!truthyXpath(select(operation.ifCondition, document))) {
          outcomes.push({ ...operation, index, matches: 0, applied: false });
          findings.push({
            severity: 'info', code: 'DIFF_CONDITION_FALSE', operation: index, line: operation.line,
            selector: operation.sel, matches: 0, message: `Operation ${index + 1} skipped because @if evaluated false.`,
          });
          return;
        }
      } catch (error) {
        findings.push({
          severity: 'error', code: 'DIFF_CONDITION_INVALID', operation: index, line: operation.line,
          selector: operation.sel, message: `Invalid @if XPath "${operation.ifCondition}": ${error instanceof Error ? error.message : String(error)}.`,
        });
        outcomes.push({ ...operation, index, matches: 0, applied: false });
        return;
      }
    }

    let selected: unknown;
    try {
      selected = select(operation.sel, document);
    } catch (error) {
      findings.push({
        severity: 'error', code: 'DIFF_SELECTOR_INVALID', operation: index, line: operation.line,
        selector: operation.sel, message: `Invalid XPath selector "${operation.sel}": ${error instanceof Error ? error.message : String(error)}.`,
      });
      outcomes.push({ ...operation, index, matches: 0, applied: false });
      return;
    }
    const matches = Array.isArray(selected) ? selected as XmlNode[] : [];
    if (matches.length === 0) {
      if (!operation.silent) findings.push({
        severity: 'warning', code: 'DIFF_SELECTOR_ZERO', operation: index, line: operation.line,
        selector: operation.sel, matches: 0, message: `Selector matched no nodes: ${operation.sel}.`,
      });
      outcomes.push({ ...operation, index, matches: 0, applied: false });
      return;
    }
    if (matches.length > 1) findings.push({
      severity: 'warning', code: 'DIFF_SELECTOR_MULTI', operation: index, line: operation.line,
      selector: operation.sel, matches: matches.length,
      message: `Selector matched ${matches.length} nodes; X4 will apply this operation to every match. Narrow it if that was not intentional.`,
    });

    let applied = 0;
    // Removal/replacement mutates the tree. Snapshot selection is intentional and mirrors
    // an XML patch processor applying the operation to the selector's original result set.
    for (const target of matches) {
      try {
        applyToNode(document, target, operation);
        applied++;
      } catch (error) {
        findings.push({
          severity: 'error', code: 'DIFF_APPLY_FAILED', operation: index, line: operation.line,
          selector: operation.sel, matches: matches.length,
          message: `Could not apply ${operation.type} to "${operation.sel}": ${error instanceof Error ? error.message : String(error)}.`,
        });
        break;
      }
    }
    outcomes.push({ ...operation, index, matches: matches.length, applied: applied === matches.length });
  });

  return {
    ok: !findings.some(finding => finding.severity === 'error'),
    content: serializer.serializeToString(document),
    operations: outcomes,
    findings,
  };
}

export function simulateXmlDiff(baseXml: string, diffXml: string): DiffSimulationResult {
  const parsed = parseOperations(diffXml);
  if (parsed.findings.some(finding => finding.severity === 'error')) {
    return { ok: false, content: baseXml, operations: [], findings: parsed.findings };
  }
  const applied = applyDiffOperations(baseXml, parsed.operations);
  return { ...applied, findings: [...parsed.findings, ...applied.findings] };
}

export interface DiffSimulatorCheck { name: string; pass: boolean; detail?: string }

export function runDiffSimulatorSelftest(): { pass: boolean; allPassed: boolean; passed: number; total: number; checks: DiffSimulatorCheck[] } {
  const checks: DiffSimulatorCheck[] = [];
  const check = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });
  const base = '<root enabled="old"><item id="a"/><item id="b"/><tail/></root>';
  const patch = `<diff>
    <add sel="/root/item[@id='a']" pos="after"><item id="after"/></add>
    <add sel="/root" pos="prepend"><item id="first"/></add>
    <add sel="/root" type="@new">yes</add>
    <replace sel="/root/@enabled">new</replace>
    <remove sel="/root/item[@id='b']"/>
  </diff>`;
  const result = simulateXmlDiff(base, patch);
  check('add/replace/remove/after/prepend/attribute', result.ok
    && /enabled="new"/.test(result.content) && /new="yes"/.test(result.content)
    && result.content.indexOf('id="first"') < result.content.indexOf('id="a"')
    && result.content.indexOf('id="after"') > result.content.indexOf('id="a"')
    && !/id="b"/.test(result.content), result.findings.map(f => f.message).join('; '));

  const zero = simulateXmlDiff(base, '<diff><remove sel="/root/missing"/></diff>');
  check('zero selector warning', zero.ok && zero.findings.some(f => f.code === 'DIFF_SELECTOR_ZERO'));
  const multi = simulateXmlDiff(base, '<diff><add sel="/root/item" type="@seen">1</add></diff>');
  check('multi selector warning and apply all', multi.ok && multi.findings.some(f => f.code === 'DIFF_SELECTOR_MULTI')
    && (multi.content.match(/seen="1"/g) || []).length === 2);
  const bad = simulateXmlDiff(base, '<diff><remove sel="//*["/></diff>');
  check('malformed selector error', !bad.ok && bad.findings.some(f => f.code === 'DIFF_SELECTOR_INVALID'));
  const conditional = simulateXmlDiff(base, '<diff><remove sel="/root/tail" if="false()"/></diff>');
  check('false condition skips operation', conditional.ok && /<tail\/>/.test(conditional.content)
    && conditional.findings.some(f => f.code === 'DIFF_CONDITION_FALSE'));
  const multiReplace = simulateXmlDiff('<root><!-- marker --><item id="a"/></root>',
    `<diff><replace sel="//comment()[. = ' marker ']"><first/><second/></replace></diff>`);
  check('replace target with ordered sibling sequence', multiReplace.ok && /<first\/><second\/><item/.test(multiReplace.content), multiReplace.content);
  const compactOr = simulateXmlDiff('<root><item id="a"/></root>',
    `<diff><replace sel="/root/item/@id[.='x' or.='a']">b</replace></diff>`);
  check('X4 compact or-dot XPath token', compactOr.ok && /id="b"/.test(compactOr.content), compactOr.findings.map(f => f.message).join('; '));
  const passed = checks.filter(entry => entry.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}
