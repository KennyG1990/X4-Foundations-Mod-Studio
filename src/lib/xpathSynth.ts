// xpathSynth.ts — T4.2 Diff-to-Patch engine (Inc 1).
//
// EXTENDS the existing XML Patching domain: this is the synthesis front-end
// for the patches the studio already models/compiles (PatchBlock → <diff>
// documents in modCompiler) — NOT a new patch engine. Given a vanilla file and
// an edited copy, it computes the MINIMAL standard-compliant X4 <diff> ops
// (add / replace / remove at element AND attribute granularity), preferring
// stable id/name selectors over positional [n] indices so patches survive
// vanilla reshuffles (positional fallbacks are surfaced as warnings).
//
// Honesty contract: every generated patch must RE-APPLY cleanly — applyPatch()
// is part of this module precisely so the selftest can prove
// applyPatch(vanilla, synthesizePatch(vanilla, edited)) ≡ edited (structural
// equality, ignoring attribute order and insignificant whitespace).
//
// House pattern: pure engine + runXpathSynthSelftest() + endpoints in
// server.ts (public selftest GET, authed synth POST), THEN UI.

import {
  DOMParser,
  XMLSerializer,
  type Document as XmlDocument,
  type Element as XmlElement,
  type Node as XmlNode,
  type Text as XmlText,
  type CDATASection as XmlCdataSection
} from '@xmldom/xmldom';
import { applyDiffOperations, type DiffOperation } from './diffSimulator';

/** Back-compatible authoring shape; execution is owned by the shared X4 diff simulator. */
export type PatchOp = DiffOperation;

export interface SynthesizedPatch {
  ops: PatchOp[];
  /** The complete <diff> document for the ops. */
  diffXml: string;
  /** Honest degradations: positional selectors, whole-element replaces, etc. */
  warnings: string[];
}

const serializer = new XMLSerializer();

function parseDoc(xml: string): XmlDocument {
  let fatal: string | null = null;
  const doc = new DOMParser({
    onError: (level: string, msg: string) => { if (level === 'fatalError') fatal = msg; }
  }).parseFromString(xml, 'text/xml');
  if (fatal || !doc || !doc.documentElement) {
    throw new Error('XML parse failed: ' + (fatal || 'no document element'));
  }
  return doc;
}

function isElement(n: XmlNode | null | undefined): n is XmlElement { return !!n && n.nodeType === 1; }
function isText(n: XmlNode | null | undefined): n is XmlText | XmlCdataSection { return !!n && (n.nodeType === 3 || n.nodeType === 4); }

function elementChildren(el: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (isElement(child)) out.push(child);
  }
  return out;
}

function directText(el: XmlElement): string {
  let t = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (isText(child)) t += String(child.data || '');
  }
  return t.trim();
}

function attrMap(el: XmlElement): Map<string, string> {
  const m = new Map<string, string>();
  if (el.attributes) {
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i];
      m.set(String(a.name), String(a.value));
    }
  }
  return m;
}

/** Identity key for sibling matching: tag name + @id/@name when present. */
function elKey(el: XmlElement): string {
  const id = el.getAttribute && (el.getAttribute('id') || el.getAttribute('name'));
  return id ? el.nodeName + '#' + id : el.nodeName;
}

function escapeXPathLiteral(v: string): string {
  if (!v.includes("'")) return "'" + v + "'";
  if (!v.includes('"')) return '"' + v + '"';
  // contains both quote kinds — concat() form
  return "concat('" + v.split("'").join("',\"'\",'") + "')";
}

/**
 * Build a stable selector for an element: absolute path preferring [@id]/
 * [@name] predicates; positional [n] only when an element has no identity
 * among same-named siblings (recorded in `warnings`).
 */
export function selectorFor(el: XmlElement, warnings?: string[]): string {
  const parts: string[] = [];
  let cur: XmlNode | null = el;
  let hops = 0;
  while (cur && isElement(cur) && hops < 64) {
    const name = cur.nodeName;
    const id = cur.getAttribute && (cur.getAttribute('id') || cur.getAttribute('name'));
    if (id) {
      const attr = cur.getAttribute('id') ? 'id' : 'name';
      parts.unshift(name + '[@' + attr + '=' + escapeXPathLiteral(id) + ']');
    } else {
      const parent = cur.parentNode;
      let idx = 1, count = 0;
      if (parent && parent.childNodes) {
        for (let i = 0; i < parent.childNodes.length; i++) {
          const sib = parent.childNodes[i];
          if (isElement(sib) && sib.nodeName === name) {
            count++;
            if (sib === cur) idx = count;
          }
        }
      }
      if (count > 1) {
        parts.unshift(name + '[' + idx + ']');
        if (warnings) {
          warnings.push('positional selector ' + name + '[' + idx + '] — no id/name attribute; this op may break if vanilla reorders siblings');
        }
      } else {
        parts.unshift(name);
      }
    }
    cur = cur.parentNode;
    hops++;
  }
  return '/' + parts.join('/');
}

function serializeEl(el: XmlNode): string {
  return String(serializer.serializeToString(el));
}

/** Recursive diff of two matched elements; emits minimal ops. */
function diffElements(vanEl: XmlElement, edEl: XmlElement, ops: PatchOp[], warnings: string[]): void {
  const vanChildren = elementChildren(vanEl);
  const edChildren = elementChildren(edEl);

  // Leaf text change → replace the whole element (smallest standard op that
  // captures text content). Only when neither side has element children.
  if (vanChildren.length === 0 && edChildren.length === 0) {
    if (directText(vanEl) !== directText(edEl)) {
      ops.push({ type: 'replace', sel: selectorFor(vanEl, warnings), content: serializeEl(edEl) });
      return; // the replace covers attributes too
    }
  }

  // Attribute diffs.
  const vAttrs = attrMap(vanEl);
  const eAttrs = attrMap(edEl);
  for (const [name, val] of eAttrs) {
    if (!vAttrs.has(name)) {
      ops.push({ type: 'add', sel: selectorFor(vanEl, warnings), attrType: '@' + name, content: val });
    } else if (vAttrs.get(name) !== val) {
      ops.push({ type: 'replace', sel: selectorFor(vanEl, warnings) + '/@' + name, content: val });
    }
  }
  for (const name of vAttrs.keys()) {
    if (!eAttrs.has(name)) {
      ops.push({ type: 'remove', sel: selectorFor(vanEl, warnings) + '/@' + name });
    }
  }

  // Child element matching by identity key (first unconsumed same-key wins).
  const consumed = new Set<number>();
  const matchedPairs: { van: XmlElement; ed: XmlElement }[] = [];
  const edMatched: (XmlElement | null)[] = edChildren.map(() => null);

  for (let e = 0; e < edChildren.length; e++) {
    const key = elKey(edChildren[e]);
    for (let v = 0; v < vanChildren.length; v++) {
      if (consumed.has(v)) continue;
      if (elKey(vanChildren[v]) === key) {
        consumed.add(v);
        matchedPairs.push({ van: vanChildren[v], ed: edChildren[e] });
        edMatched[e] = vanChildren[v];
        break;
      }
    }
  }

  // Removals: vanilla children never matched.
  for (let v = 0; v < vanChildren.length; v++) {
    if (!consumed.has(v)) {
      ops.push({ type: 'remove', sel: selectorFor(vanChildren[v], warnings) });
    }
  }

  // Additions: edited children with no vanilla counterpart. Anchor ordering:
  // insert before the next MATCHED edited sibling's vanilla node; else append.
  for (let e = 0; e < edChildren.length; e++) {
    if (edMatched[e]) continue;
    let anchorVan: XmlElement | null = null;
    for (let k = e + 1; k < edChildren.length; k++) {
      if (edMatched[k]) { anchorVan = edMatched[k]; break; }
    }
    if (anchorVan) {
      ops.push({ type: 'add', sel: selectorFor(anchorVan, warnings), pos: 'before', content: serializeEl(edChildren[e]) });
    } else {
      ops.push({ type: 'add', sel: selectorFor(vanEl, warnings), pos: 'child', content: serializeEl(edChildren[e]) });
    }
  }

  // Recurse into matches.
  for (const pair of matchedPairs) diffElements(pair.van, pair.ed, ops, warnings);
}

function xmlEscapeText(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function xmlEscapeAttr(v: string): string {
  return xmlEscapeText(v).replace(/"/g, '&quot;');
}

/** Render ops as a standard X4 <diff> document. */
export function buildDiffXml(ops: PatchOp[]): string {
  const lines: string[] = ['<?xml version="1.0" encoding="utf-8"?>', '<diff>'];
  for (const op of ops) {
    if (op.type === 'remove') {
      lines.push('  <remove sel="' + xmlEscapeAttr(op.sel) + '" />');
    } else if (op.type === 'replace') {
      if (op.sel.includes('/@')) {
        lines.push('  <replace sel="' + xmlEscapeAttr(op.sel) + '">' + xmlEscapeText(op.content || '') + '</replace>');
      } else {
        lines.push('  <replace sel="' + xmlEscapeAttr(op.sel) + '">' + (op.content || '') + '</replace>');
      }
    } else {
      if (op.attrType) {
        lines.push('  <add sel="' + xmlEscapeAttr(op.sel) + '" type="' + xmlEscapeAttr(op.attrType) + '">' + xmlEscapeText(op.content || '') + '</add>');
      } else if (op.pos === 'before') {
        lines.push('  <add sel="' + xmlEscapeAttr(op.sel) + '" pos="before">' + (op.content || '') + '</add>');
      } else {
        lines.push('  <add sel="' + xmlEscapeAttr(op.sel) + '">' + (op.content || '') + '</add>');
      }
    }
  }
  lines.push('</diff>');
  return lines.join('\n');
}

/**
 * Synthesize the minimal <diff> turning `vanillaXml` into `editedXml`.
 * Throws on unparseable input or mismatched root elements (a root swap is not
 * expressible as an X4 diff and would mean the wrong base file was picked).
 */
export function synthesizePatch(vanillaXml: string, editedXml: string): SynthesizedPatch {
  const vanDoc = parseDoc(vanillaXml);
  const edDoc = parseDoc(editedXml);
  if (vanDoc.documentElement.nodeName !== edDoc.documentElement.nodeName) {
    throw new Error('Root elements differ (' + vanDoc.documentElement.nodeName + ' vs ' + edDoc.documentElement.nodeName + ') — wrong base file?');
  }
  const ops: PatchOp[] = [];
  const warnings: string[] = [];
  diffElements(vanDoc.documentElement, edDoc.documentElement, ops, warnings);
  return { ops, diffXml: buildDiffXml(ops), warnings };
}

/**
 * Apply ops to a vanilla document — the verification half of the contract.
 * Returns the patched XML. Throws when a selector resolves to nothing (a
 * synthesized patch must never do that against its own base).
 */
export function applyPatch(vanillaXml: string, ops: PatchOp[]): string {
  const result = applyDiffOperations(vanillaXml, ops);
  const failure = result.findings.find(finding => finding.severity === 'error' || finding.code === 'DIFF_SELECTOR_ZERO');
  if (failure) throw new Error(failure.message);
  return result.content;
}

/** Structural equality: same tree ignoring attribute order, whitespace-only
 *  text, and comments. Returns null when equal, else a human-readable diff hint. */
export function structuralDiff(aXml: string, bXml: string): string | null {
  const a = parseDoc(aXml).documentElement;
  const b = parseDoc(bXml).documentElement;
  return cmpEl(a, b, '/' + a.nodeName);
}

function cmpEl(a: XmlElement, b: XmlElement, where: string): string | null {
  if (a.nodeName !== b.nodeName) return where + ': tag ' + a.nodeName + ' != ' + b.nodeName;
  const aA = attrMap(a), bA = attrMap(b);
  if (aA.size !== bA.size) return where + ': attribute count ' + aA.size + ' != ' + bA.size;
  for (const [k, v] of aA) {
    if (!bA.has(k)) return where + ': missing attribute ' + k;
    if (bA.get(k) !== v) return where + ': @' + k + ' "' + v + '" != "' + bA.get(k) + '"';
  }
  if (directText(a) !== directText(b)) return where + ': text "' + directText(a) + '" != "' + directText(b) + '"';
  const aC = elementChildren(a), bC = elementChildren(b);
  if (aC.length !== bC.length) return where + ': child count ' + aC.length + ' != ' + bC.length;
  for (let i = 0; i < aC.length; i++) {
    const r = cmpEl(aC[i], bC[i], where + '/' + aC[i].nodeName + '[' + (i + 1) + ']');
    if (r) return r;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Selftest oracle — every case must round-trip: apply(synthesize()) ≡ edited.
// ---------------------------------------------------------------------------

export interface XpathSynthCheck { name: string; pass: boolean; detail?: string }

export function runXpathSynthSelftest(): { pass: boolean; checks: XpathSynthCheck[] } {
  const checks: XpathSynthCheck[] = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });

  const roundTrip = (name: string, vanilla: string, edited: string, assertOps?: (p: SynthesizedPatch) => string | null) => {
    try {
      const p = synthesizePatch(vanilla, edited);
      const applied = applyPatch(vanilla, p.ops);
      const sd = structuralDiff(applied, edited);
      if (sd) { ok(name, false, 'round-trip mismatch: ' + sd); return; }
      const opErr = assertOps ? assertOps(p) : null;
      ok(name, !opErr, opErr || (p.ops.length + ' op(s)' + (p.warnings.length ? ', ' + p.warnings.length + ' warning(s)' : '')));
    } catch (error: unknown) {
      ok(name, false, error instanceof Error ? error.message : String(error));
    }
  };

  const base = '<jobs><job id="a"><orders count="5" speed="fast"/></job><job id="b"><orders count="2"/></job></jobs>';

  roundTrip('attribute value change → single attr replace', base,
    '<jobs><job id="a"><orders count="9" speed="fast"/></job><job id="b"><orders count="2"/></job></jobs>',
    p => (p.ops.length === 1 && p.ops[0].type === 'replace' && p.ops[0].sel.endsWith('/@count')) ? null : 'expected 1 attr replace, got ' + JSON.stringify(p.ops));

  roundTrip('attribute added → add type="@attr"', base,
    '<jobs><job id="a"><orders count="5" speed="fast" priority="high"/></job><job id="b"><orders count="2"/></job></jobs>',
    p => (p.ops.length === 1 && p.ops[0].type === 'add' && p.ops[0].attrType === '@priority') ? null : 'expected 1 attr add, got ' + JSON.stringify(p.ops));

  roundTrip('attribute removed → remove /@attr', base,
    '<jobs><job id="a"><orders count="5"/></job><job id="b"><orders count="2"/></job></jobs>',
    p => (p.ops.length === 1 && p.ops[0].type === 'remove' && p.ops[0].sel.endsWith('/@speed')) ? null : 'expected 1 attr remove, got ' + JSON.stringify(p.ops));

  roundTrip('element appended → add into parent with id selector', base,
    '<jobs><job id="a"><orders count="5" speed="fast"/></job><job id="b"><orders count="2"/></job><job id="c"><orders count="7"/></job></jobs>',
    p => (p.ops.length === 1 && p.ops[0].type === 'add' && p.ops[0].pos === 'child' && p.ops[0].sel === '/jobs') ? null : 'expected 1 child add on /jobs, got ' + JSON.stringify(p.ops));

  roundTrip('element inserted in the middle → pos="before" anchored on id', base,
    '<jobs><job id="a"><orders count="5" speed="fast"/></job><job id="x"><orders count="1"/></job><job id="b"><orders count="2"/></job></jobs>',
    p => (p.ops.length === 1 && p.ops[0].type === 'add' && p.ops[0].pos === 'before' && p.ops[0].sel.includes("job[@id='b']")) ? null : 'expected before-anchored add, got ' + JSON.stringify(p.ops));

  roundTrip('element removed → remove with id selector', base,
    '<jobs><job id="a"><orders count="5" speed="fast"/></job></jobs>',
    p => (p.ops.length === 1 && p.ops[0].type === 'remove' && p.ops[0].sel.includes("job[@id='b']")) ? null : 'expected 1 remove, got ' + JSON.stringify(p.ops));

  roundTrip('deep nested change stays minimal (1 op, not a tree replace)',
    '<root><group name="g1"><item id="i1" v="1"/><item id="i2" v="2"/></group><group name="g2"><item id="i3" v="3"/></group></root>',
    '<root><group name="g1"><item id="i1" v="1"/><item id="i2" v="22"/></group><group name="g2"><item id="i3" v="3"/></group></root>',
    p => (p.ops.length === 1 && p.ops[0].sel === "/root/group[@name='g1']/item[@id='i2']/@v") ? null : 'expected minimal deep attr replace, got ' + JSON.stringify(p.ops));

  roundTrip('id-less repeated siblings → positional selector with warning',
    '<list><entry v="1"/><entry v="2"/><entry v="3"/></list>',
    '<list><entry v="1"/><entry v="9"/><entry v="3"/></list>',
    p => (p.ops.length >= 1 && p.warnings.some(w => w.includes('positional'))) ? null : 'expected positional warning, got ' + JSON.stringify(p.warnings));

  roundTrip('text content change → element replace',
    '<conf><note id="n1">old text</note></conf>',
    '<conf><note id="n1">new text</note></conf>',
    p => (p.ops.length === 1 && p.ops[0].type === 'replace' && !p.ops[0].sel.includes('/@')) ? null : 'expected element replace, got ' + JSON.stringify(p.ops));

  roundTrip('identical documents → zero ops', base, base,
    p => p.ops.length === 0 ? null : 'expected 0 ops, got ' + p.ops.length);

  roundTrip('combined multi-op edit round-trips', base,
    '<jobs><job id="a"><orders count="9"/></job><job id="c"><orders count="7" mode="patrol"/></job></jobs>',
    undefined);

  try {
    synthesizePatch('<a/>', '<b/>');
    ok('mismatched roots rejected', false, 'no error thrown');
  } catch {
    ok('mismatched roots rejected', true);
  }

  return { pass: checks.every(c => c.pass), checks };
}
