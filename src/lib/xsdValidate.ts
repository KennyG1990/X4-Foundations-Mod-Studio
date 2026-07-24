/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Schema-backed XML validation. Builds an element -> allowed-attributes index
 * from the real X4 `.xsd` schema files (md.xsd + common.xsd) and validates
 * generated XML against it. This is a pragmatic subset of full XSD validation:
 * it covers the highest-confidence, highest-value checks —
 *   - enumeration violations (attribute value not in the schema's allowed set)
 *   - missing `use="required"` attributes
 *   - unknown attributes on a recognized element
 *   - unknown elements (info-level, since the schema index can be incomplete)
 * — with raw-text line numbers for actionable sourceRefs. Ordered XSD content
 * particles are retained as separate variants and compiled to a small NFA for
 * sequence/choice/all/cardinality completion and strict validation.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

export interface XsdDiagnostic {
  severity: 'error' | 'warning' | 'info';
  domain: string;
  filePath?: string;
  message: string;
  line?: number;
  sourceRef?: string;
  code?: string;
}

export interface AttrSpec {
  required: boolean;
  enumValues?: string[];
  type?: string;
  baseType?: string;
  patterns?: string[];
  defaultValue?: string;
  fixedValue?: string;
  documentation?: string;
}

export interface ChildSpec {
  name: string;
  particle: 'sequence' | 'choice' | 'all' | 'group' | 'unknown';
  minOccurs: number;
  /** null means XSD maxOccurs="unbounded". */
  maxOccurs: number | null;
}

export type ContentParticle =
  | { kind: 'element'; name: string; minOccurs: number; maxOccurs: number | null }
  | { kind: 'any'; minOccurs: number; maxOccurs: number | null }
  | { kind: 'sequence' | 'choice' | 'all'; children: ContentParticle[]; minOccurs: number; maxOccurs: number | null };

export interface ElementSpec {
  attributes: Map<string, AttrSpec>;
  /** true when the element's complexType permits arbitrary attributes (anyAttribute) */
  openAttributes: boolean;
  /** true when we successfully resolved the element's type (inline or named) */
  resolved: boolean;
  /** lowercased names of child elements this element may contain (best-effort) */
  children: Set<string>;
  /** direct child particle metadata, conservatively merged across same-name contexts */
  childSpecs: Map<string, ChildSpec>;
  /** true when xs:any permits arbitrary direct child payloads */
  openChildren: boolean;
  /** Preserved-order content models. Same-name contextual declarations stay separate. */
  particles: ContentParticle[];
  typeName?: string;
  documentation?: string;
}

export interface SchemaIndex {
  elements: Map<string, ElementSpec>; // key: lowercased element name
  loaded: boolean;
  sourceFiles: string[];
  elementCount: number;
}

type AnyNode = Record<string, any>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  trimValues: true
});
const orderedParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  trimValues: true,
  preserveOrder: true,
});

function arrayOf<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function collectByKey(node: any, key: string, out: AnyNode[] = []): AnyNode[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach(item => collectByKey(item, key, out));
    return out;
  }
  if (node[key]) out.push(...arrayOf(node[key]));
  for (const v of Object.values(node)) collectByKey(v, key, out);
  return out;
}

function collectEnums(node: AnyNode | undefined): string[] {
  if (!node) return [];
  const enums = collectByKey(node, 'xs:enumeration')
    .map(e => e.value)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return Array.from(new Set(enums));
}

function textOf(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return textOf(record['#text'] ?? record.text);
}

function documentationOf(node: AnyNode | undefined): string | undefined {
  const annotation = node?.['xs:annotation'];
  const docs = arrayOf(annotation?.['xs:documentation']).map(textOf).filter(Boolean);
  return docs.length ? docs.join('\n') : undefined;
}

function occurs(value: unknown, fallback: number): number | null {
  if (String(value).toLowerCase() === 'unbounded') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// MULTI-SLOT cache (audit A1, 2026-07-09): the old single-slot `cached` let the md and
// aiscripts indexes EVICT EACH OTHER, so every validate/preflight/health-card request
// re-parsed ~2.1MB of XSD (measured: 245-273ms per warm request, dominated by reparse).
// Keyed by the file-path SET; the mtime-key still invalidates on schema edits. Bounded.
const indexCache = new Map<string, { key: string; index: SchemaIndex }>();
// B46P2: 8 → 24. Routing builds per-domain indexes (md, aiscripts, diff, factions,
// gamestarts, libraries, addon, coreaddon, plus diff-merged variants) — 8 slots would
// thrash and re-parse ~2MB XSDs per request (the exact regression the cache prevents).
const INDEX_CACHE_MAX = 24;

/**
 * Build (and cache) a schema element/attribute index from the given XSD files.
 * Caches on file paths + mtimes so a schema edit invalidates it.
 */
export function buildSchemaIndex(xsdPaths: string[]): SchemaIndex {
  const existing = xsdPaths.filter(p => p && fs.existsSync(p));
  if (!existing.length) {
    return { elements: new Map(), loaded: false, sourceFiles: [], elementCount: 0 };
  }
  const slot = existing.join('|');
  const key = existing.map(p => {
    try { return `${p}:${fs.statSync(p).mtimeMs}`; } catch { return p; }
  }).join('|');
  const cached = indexCache.get(slot);
  if (cached && cached.key === key) return cached.index;

  const sources = existing.map(p => fs.readFileSync(p, 'utf8'));
  const roots = sources.map(source => parser.parse(source));
  const orderedRoots = sources.map(source => orderedParser.parse(source) as AnyNode[]);

  // Global named simpleTypes -> enum lists, attributeGroups + complexTypes for ref resolution.
  const simpleTypeEnums: Record<string, string[]> = {};
  const attributeGroups = new Map<string, AnyNode>();
  const complexTypes = new Map<string, AnyNode>();
  const groups = new Map<string, AnyNode>();
  // Named simpleTypes resolve in two passes because of xs:union types: a union's
  // enum set is sound ONLY if EVERY member type is itself fully enumerated. X4's
  // classlookup is `<xs:union memberTypes="positionalclasslookup expression">` plus a
  // tiny inline restriction — collecting just the descendants yielded 2 values and
  // false-errored legal classes (match class="class.spacesuit", proven in-game), while
  // the `expression` member actually makes ANY value legal → no enum restriction at all.
  const simpleTypeRaw = new Map<string, AnyNode>();
  for (const root of roots) {
    arrayOf(root['xs:schema']?.['xs:simpleType']).forEach((st: AnyNode) => {
      if (st.name && !simpleTypeRaw.has(st.name)) simpleTypeRaw.set(st.name, st);
    });
  }
  const resolvedSimpleEnums = new Map<string, string[] | null>(); // null = unrestricted
  const enumsOfSimpleType = (name: string, stack: Set<string>): string[] | null => {
    if (resolvedSimpleEnums.has(name)) return resolvedSimpleEnums.get(name)!;
    const st = simpleTypeRaw.get(name);
    if (!st || stack.has(name)) return null; // unknown / xs:* / cyclic → unrestricted
    stack.add(name);
    let result: string[] | null = null;
    const unionNode = arrayOf(st['xs:union'])[0] as AnyNode | undefined;
    if (unionNode) {
      let all: string[] = [];
      let sound = true;
      for (const mem of String(unionNode.memberTypes || '').split(/\s+/).filter(Boolean)) {
        const e = enumsOfSimpleType(mem, stack);
        if (!e) { sound = false; break; }
        all = all.concat(e);
      }
      if (sound) {
        for (const inline of arrayOf(unionNode['xs:simpleType'])) {
          const e = collectEnums(inline as AnyNode);
          if (!e.length) { sound = false; break; }
          all = all.concat(e);
        }
      }
      result = sound && all.length ? Array.from(new Set(all)) : null;
    } else {
      const e = collectEnums(st);
      if (e.length) {
        result = e;
      } else {
        const restriction = arrayOf(st['xs:restriction'])[0] as AnyNode | undefined;
        const base = typeof restriction?.base === 'string' ? restriction.base : undefined;
        // Named restrictions commonly refine a shared enum type without repeating
        // its values. Follow that base edge so common.xsd enums survive into the
        // including schema. Built-in/unknown bases remain deliberately unrestricted.
        result = base ? enumsOfSimpleType(base, stack) : null;
      }
    }
    stack.delete(name);
    resolvedSimpleEnums.set(name, result);
    return result;
  };
  for (const name of simpleTypeRaw.keys()) {
    const e = enumsOfSimpleType(name, new Set());
    if (e && e.length) simpleTypeEnums[name] = e;
  }
  const simpleTypeMeta = new Map<string, { baseType?: string; patterns: string[]; documentation?: string }>();
  const metaOfSimpleType = (name: string, stack = new Set<string>()): { baseType?: string; patterns: string[]; documentation?: string } => {
    const cachedMeta = simpleTypeMeta.get(name);
    if (cachedMeta) return cachedMeta;
    const st = simpleTypeRaw.get(name);
    if (!st || stack.has(name)) return { patterns: [] };
    stack.add(name);
    const restriction = arrayOf(st['xs:restriction'])[0] as AnyNode | undefined;
    const base = typeof restriction?.base === 'string' ? restriction.base : undefined;
    const inherited = base && simpleTypeRaw.has(base) ? metaOfSimpleType(base, stack) : { patterns: [] };
    const patterns = [
      ...inherited.patterns,
      ...arrayOf(restriction?.['xs:pattern']).map((p: AnyNode) => String(p?.value || '')).filter(Boolean),
    ];
    const meta = {
      baseType: inherited.baseType || base,
      patterns: Array.from(new Set(patterns)),
      documentation: documentationOf(st) || inherited.documentation,
    };
    stack.delete(name);
    simpleTypeMeta.set(name, meta);
    return meta;
  };
  for (const name of simpleTypeRaw.keys()) metaOfSimpleType(name);
  for (const root of roots) {
    arrayOf(root['xs:schema']?.['xs:attributeGroup']).forEach((g: AnyNode) => {
      if (g.name) attributeGroups.set(g.name, g);
    });
    arrayOf(root['xs:schema']?.['xs:complexType']).forEach((ct: AnyNode) => {
      if (ct.name) complexTypes.set(ct.name, ct);
    });
    arrayOf(root['xs:schema']?.['xs:group']).forEach((g: AnyNode) => {
      if (g.name) groups.set(g.name, g);
    });
  }

  // The regular object model above is ideal for named lookup, but it groups
  // repeated tag names and therefore loses mixed sequence order. Build a second,
  // preserveOrder view solely for content particles.
  const orderedComplexTypes = new Map<string, AnyNode>();
  const orderedGroups = new Map<string, AnyNode>();
  const orderedElements: AnyNode[] = [];
  const nodeAttrs = (node: AnyNode): AnyNode => (node?.[':@'] || {}) as AnyNode;
  const nodeKey = (node: AnyNode): string | null => Object.keys(node || {}).find(key => key !== ':@') || null;
  const nodeBody = (node: AnyNode): AnyNode[] => {
    const key = nodeKey(node);
    return key && Array.isArray(node[key]) ? node[key] : [];
  };
  for (const root of orderedRoots) {
    for (const wrapper of root) {
      if (!Array.isArray(wrapper?.['xs:schema'])) continue;
      for (const child of wrapper['xs:schema']) {
        const key = nodeKey(child);
        const attrs = nodeAttrs(child);
        if (key === 'xs:complexType' && attrs.name) orderedComplexTypes.set(String(attrs.name), child);
        else if (key === 'xs:group' && attrs.name) orderedGroups.set(String(attrs.name), child);
      }
    }
  }
  const collectOrderedElements = (value: unknown) => {
    if (Array.isArray(value)) { for (const child of value) collectOrderedElements(child); return; }
    if (!value || typeof value !== 'object') return;
    const node = value as AnyNode;
    if (nodeKey(node) === 'xs:element' && nodeAttrs(node).name) orderedElements.push(node);
    for (const [key, child] of Object.entries(node)) if (key !== ':@') collectOrderedElements(child);
  };
  for (const root of orderedRoots) collectOrderedElements(root);

  const particleOccurs = (attrs: AnyNode) => ({
    minOccurs: occurs(attrs.minOccurs, 1) as number,
    maxOccurs: occurs(attrs.maxOccurs, 1),
  });
  const cloneParticle = (particle: ContentParticle): ContentParticle => particle.kind === 'element' || particle.kind === 'any'
    ? { ...particle }
    : { ...particle, children: particle.children.map(cloneParticle) };

  const combineParticles = (particles: ContentParticle[]): ContentParticle | null => {
    if (!particles.length) return null;
    if (particles.length === 1) return particles[0];
    return { kind: 'sequence', children: particles, minOccurs: 1, maxOccurs: 1 };
  };

  const particleFromNode = (
    node: AnyNode,
    seenTypes = new Set<string>(),
    seenGroups = new Set<string>(),
    depth = 0,
  ): ContentParticle | null => {
    if (!node || depth > 50) return null;
    const key = nodeKey(node);
    const attrs = nodeAttrs(node);
    const occurrence = particleOccurs(attrs);
    if (key === 'xs:element') {
      const rawName = attrs.name || attrs.ref;
      return rawName ? { kind: 'element', name: String(rawName).toLowerCase(), ...occurrence } : null;
    }
    if (key === 'xs:any') return { kind: 'any', ...occurrence };
    if (key === 'xs:group') {
      const ref = attrs.ref || attrs.name;
      if (!ref || seenGroups.has(String(ref))) return null;
      const target = orderedGroups.get(String(ref));
      if (!target) return null;
      const nextGroups = new Set(seenGroups); nextGroups.add(String(ref));
      const resolved = combineParticles(nodeBody(target)
        .map(child => particleFromNode(child, seenTypes, nextGroups, depth + 1))
        .filter((item): item is ContentParticle => !!item));
      return resolved ? { kind: 'sequence', children: [cloneParticle(resolved)], ...occurrence } : null;
    }
    if (key === 'xs:sequence' || key === 'xs:choice' || key === 'xs:all') {
      const children = nodeBody(node)
        .map(child => particleFromNode(child, seenTypes, seenGroups, depth + 1))
        .filter((item): item is ContentParticle => !!item);
      return { kind: key.slice(3) as 'sequence' | 'choice' | 'all', children, ...occurrence };
    }
    return null;
  };

  const particleFromType = (node: AnyNode, seenTypes = new Set<string>(), depth = 0): ContentParticle | null => {
    if (!node || depth > 50) return null;
    const particles: ContentParticle[] = [];
    for (const child of nodeBody(node)) {
      const key = nodeKey(child);
      if (key === 'xs:sequence' || key === 'xs:choice' || key === 'xs:all' || key === 'xs:group') {
        const particle = particleFromNode(child, seenTypes, new Set(), depth + 1);
        if (particle) particles.push(particle);
        continue;
      }
      if (key !== 'xs:complexContent' && key !== 'xs:simpleContent') continue;
      for (const derivation of nodeBody(child)) {
        const derivationKey = nodeKey(derivation);
        if (derivationKey !== 'xs:extension' && derivationKey !== 'xs:restriction') continue;
        const base = String(nodeAttrs(derivation).base || '');
        if (base && orderedComplexTypes.has(base) && !seenTypes.has(base)) {
          const nextTypes = new Set(seenTypes); nextTypes.add(base);
          const inherited = particleFromType(orderedComplexTypes.get(base)!, nextTypes, depth + 1);
          if (inherited) particles.push(inherited);
        }
        for (const local of nodeBody(derivation)) {
          const particle = particleFromNode(local, seenTypes, new Set(), depth + 1);
          if (particle) particles.push(particle);
        }
      }
    }
    return combineParticles(particles);
  };

  const orderedParticles = new Map<string, ContentParticle[]>();
  for (const element of orderedElements) {
    const attrs = nodeAttrs(element);
    const name = String(attrs.name || '').toLowerCase();
    if (!name) continue;
    let particle: ContentParticle | null = null;
    const inline = nodeBody(element).find(child => nodeKey(child) === 'xs:complexType');
    if (inline) particle = particleFromType(inline);
    else if (attrs.type && orderedComplexTypes.has(String(attrs.type))) {
      particle = particleFromType(orderedComplexTypes.get(String(attrs.type))!, new Set([String(attrs.type)]));
    }
    if (particle) {
      const variants = orderedParticles.get(name) || [];
      variants.push(particle);
      orderedParticles.set(name, variants);
    }
  }

  // Collect the child-element names an element may contain, following named
  // complexTypes (via `type`/`base`) and xs:group references. Best-effort and
  // intentionally over-inclusive (used to avoid false "unknown element" flags).
  function collectChildren(typeNode: AnyNode, into: Set<string>, seenTypes: Set<string>, seenGroups: Set<string>, depth = 0) {
    if (!typeNode || typeof typeNode !== 'object' || depth > 40) return;
    for (const [k, v] of Object.entries(typeNode)) {
      if (k === 'xs:attribute' || k === 'xs:attributeGroup' || k === 'xs:annotation' || k === 'xs:simpleType') continue;
      if (k === 'xs:element') {
        for (const el of arrayOf(v)) {
          const nm = el?.name || el?.ref;
          if (typeof nm === 'string' && nm) into.add(nm.toLowerCase());
          // descend into inline-typed children? No — only THIS element's direct
          // particle membership matters, but X4 nests via groups, handled below.
        }
        continue;
      }
      if (k === 'xs:group') {
        for (const g of arrayOf(v)) {
          const ref = g?.ref || g?.name;
          if (ref && groups.has(ref) && !seenGroups.has(ref)) {
            seenGroups.add(ref);
            collectChildren(groups.get(ref)!, into, seenTypes, seenGroups, depth + 1);
          } else if (g && typeof g === 'object') {
            collectChildren(g, into, seenTypes, seenGroups, depth + 1);
          }
        }
        continue;
      }
      if (k === 'base' && typeof v === 'string' && complexTypes.has(v) && !seenTypes.has(v)) {
        seenTypes.add(v);
        collectChildren(complexTypes.get(v)!, into, seenTypes, seenGroups, depth + 1);
        continue;
      }
      // recurse into structural containers (sequence/choice/all/complexContent/extension/restriction)
      if (typeof v === 'object' && v !== null) collectChildren(v, into, seenTypes, seenGroups, depth + 1);
    }
  }

  function collectChildSpecs(
    typeNode: AnyNode,
    into: Map<string, ChildSpec>,
    open: { v: boolean },
    seenTypes: Set<string>,
    seenGroups: Set<string>,
    particle: ChildSpec['particle'] = 'unknown',
    depth = 0,
  ) {
    if (!typeNode || typeof typeNode !== 'object' || depth > 40) return;
    if (typeNode['xs:any']) open.v = true;
    for (const [key, value] of Object.entries(typeNode)) {
      if (key === 'xs:annotation' || key === 'xs:attribute' || key === 'xs:attributeGroup' || key === 'xs:simpleType' || key === 'xs:any') continue;
      const nextParticle: ChildSpec['particle'] = key === 'xs:sequence' ? 'sequence'
        : key === 'xs:choice' ? 'choice'
          : key === 'xs:all' ? 'all'
            : particle;
      if (key === 'xs:element') {
        for (const el of arrayOf(value)) {
          const rawName = el?.name || el?.ref;
          if (typeof rawName !== 'string' || !rawName) continue;
          const name = rawName.toLowerCase();
          const candidate: ChildSpec = {
            name,
            particle: nextParticle,
            minOccurs: occurs(el.minOccurs, 1) as number,
            maxOccurs: occurs(el.maxOccurs, 1),
          };
          const prev = into.get(name);
          if (!prev) into.set(name, candidate);
          else {
            // Same-name element declarations are context dependent in X4. Merge toward
            // permissiveness so completion remains complete and validation avoids false errors.
            prev.minOccurs = Math.min(prev.minOccurs, candidate.minOccurs);
            prev.maxOccurs = prev.maxOccurs === null || candidate.maxOccurs === null
              ? null
              : Math.max(prev.maxOccurs, candidate.maxOccurs);
            if (prev.particle !== candidate.particle) prev.particle = 'unknown';
          }
        }
        continue;
      }
      if (key === 'xs:group') {
        for (const group of arrayOf(value)) {
          const ref = group?.ref || group?.name;
          if (ref && groups.has(ref) && !seenGroups.has(ref)) {
            seenGroups.add(ref);
            collectChildSpecs(groups.get(ref)!, into, open, seenTypes, seenGroups, 'group', depth + 1);
          } else if (group && typeof group === 'object') {
            collectChildSpecs(group, into, open, seenTypes, seenGroups, 'group', depth + 1);
          }
        }
        continue;
      }
      if (key === 'base' && typeof value === 'string' && complexTypes.has(value) && !seenTypes.has(value)) {
        seenTypes.add(value);
        collectChildSpecs(complexTypes.get(value)!, into, open, seenTypes, seenGroups, nextParticle, depth + 1);
        continue;
      }
      if (typeof value === 'object' && value !== null) {
        collectChildSpecs(value, into, open, seenTypes, seenGroups, nextParticle, depth + 1);
      }
    }
  }

  const addAttr = (attr: AnyNode, into: Map<string, AttrSpec>) => {
    if (!attr?.name) return;
    const inlineEnums = collectEnums(attr['xs:simpleType']);
    const typeEnums = attr.type ? simpleTypeEnums[attr.type] : undefined;
    const enumValues = inlineEnums.length ? inlineEnums : typeEnums;
    const inlineRestriction = arrayOf(attr['xs:simpleType']?.['xs:restriction'])[0] as AnyNode | undefined;
    const typeMeta = attr.type ? simpleTypeMeta.get(attr.type) : undefined;
    const inlinePatterns = arrayOf(inlineRestriction?.['xs:pattern'])
      .map((p: AnyNode) => String(p?.value || ''))
      .filter(Boolean);
    const lname = String(attr.name).toLowerCase();
    const prev = into.get(lname);
    // The same attribute can be declared by MULTIPLE attributeGroups within one type
    // (e.g. matchsubfilter pulls class type="classlookup" via findarbitrary AND
    // class type="entityclasslookup" via matchfilter). Replacement kept whichever came
    // last and false-errored legal values (match class="class.spacesuit", proven
    // in-game). Union when both declare enums; unrestricted when either doesn't.
    let mergedEnums: string[] | undefined;
    if (prev) {
      mergedEnums = (prev.enumValues?.length && enumValues?.length)
        ? Array.from(new Set([...prev.enumValues, ...enumValues]))
        : undefined; // either declaration unrestricted → unrestricted
    } else {
      mergedEnums = enumValues && enumValues.length ? enumValues : undefined;
    }
    into.set(lname, {
      required: Boolean(prev?.required) || attr.use === 'required',
      enumValues: mergedEnums,
      type: attr.type || prev?.type,
      baseType: typeMeta?.baseType || inlineRestriction?.base || prev?.baseType,
      patterns: Array.from(new Set([...(prev?.patterns || []), ...inlinePatterns, ...(typeMeta?.patterns || [])])),
      defaultValue: attr.default ?? prev?.defaultValue,
      fixedValue: attr.fixed ?? prev?.fixedValue,
      documentation: documentationOf(attr) || typeMeta?.documentation || prev?.documentation,
    });
  };

  const addGroupRefs = (node: AnyNode, into: Map<string, AttrSpec>, seenGroups: Set<string>, open: { v: boolean }) => {
    for (const gref of arrayOf(node['xs:attributeGroup'])) {
      const ref = gref.ref || gref.name;
      if (!ref || seenGroups.has(ref)) continue;
      seenGroups.add(ref);
      const g = attributeGroups.get(ref);
      if (g) collectTypeAttrs(g, into, seenGroups, new Set(), open);
    }
  };

  // Collect ONLY the attributes that belong to this complexType/attributeGroup —
  // its direct xs:attribute/xs:attributeGroup plus those inside
  // complexContent/simpleContent > extension/restriction (following `base`).
  // Deliberately does NOT descend into xs:sequence/choice/all element children.
  function collectTypeAttrs(typeNode: AnyNode, into: Map<string, AttrSpec>, seenGroups: Set<string>, seenTypes: Set<string>, open: { v: boolean }) {
    if (!typeNode || typeof typeNode !== 'object') return;
    if (typeNode['xs:anyAttribute']) open.v = true;
    for (const attr of arrayOf(typeNode['xs:attribute'])) addAttr(attr, into);
    addGroupRefs(typeNode, into, seenGroups, open);

    for (const wrapper of ['xs:complexContent', 'xs:simpleContent']) {
      const content = typeNode[wrapper];
      if (!content) continue;
      for (const deriv of ['xs:extension', 'xs:restriction']) {
        const ext = content[deriv];
        if (!ext) continue;
        if (ext['xs:anyAttribute']) open.v = true;
        for (const attr of arrayOf(ext['xs:attribute'])) addAttr(attr, into);
        addGroupRefs(ext, into, seenGroups, open);
        const base = ext.base;
        if (base && complexTypes.has(base) && !seenTypes.has(base)) {
          seenTypes.add(base);
          collectTypeAttrs(complexTypes.get(base)!, into, seenGroups, seenTypes, open);
        }
      }
    }
  }

  const resolveElementAttrs = (el: AnyNode): {
    attrs: Map<string, AttrSpec>;
    open: boolean;
    resolved: boolean;
    children: Set<string>;
    childSpecs: Map<string, ChildSpec>;
    openChildren: boolean;
  } => {
    const into = new Map<string, AttrSpec>();
    const children = new Set<string>();
    const childSpecs = new Map<string, ChildSpec>();
    const open = { v: false };
    const openChildren = { v: false };
    let resolved = false;
    // inline complexType
    if (el['xs:complexType']) {
      collectTypeAttrs(el['xs:complexType'], into, new Set(), new Set(), open);
      collectChildren(el['xs:complexType'], children, new Set(), new Set());
      collectChildSpecs(el['xs:complexType'], childSpecs, openChildren, new Set(), new Set());
      resolved = true;
    }
    // named type reference
    if (typeof el.type === 'string' && complexTypes.has(el.type)) {
      const t = complexTypes.get(el.type)!;
      collectTypeAttrs(t, into, new Set(), new Set([el.type]), open);
      collectChildren(t, children, new Set([el.type]), new Set());
      collectChildSpecs(t, childSpecs, openChildren, new Set([el.type]), new Set());
      resolved = true;
    }
    return { attrs: into, open: open.v, resolved, children, childSpecs, openChildren: openChildren.v };
  };

  const elements = new Map<string, ElementSpec>();
  const addElement = (
    name: string,
    attrs: Map<string, AttrSpec>,
    open: boolean,
    resolved: boolean,
    children: Set<string>,
    childSpecs: Map<string, ChildSpec>,
    openChildren: boolean,
    typeName?: string,
    documentation?: string,
  ) => {
    const lname = name.toLowerCase();
    const prev = elements.get(lname);
    if (prev) {
      // The same element name can have context-dependent definitions in md.xsd — e.g.
      // <param> under <library><params> takes name+default, but under <run_actions> it
      // requires `value`. This index is keyed by name only, so an attribute is required in
      // the merged spec ONLY if it is present-and-required in EVERY definition. Walk the
      // UNION of keys so an attr required in one def but ABSENT in another is relaxed to
      // optional (the old loop visited only the new def's attrs, leaving a prev-only required
      // attr stuck required — the source of the false "param missing required value" warning).
      const keys = new Set<string>([...prev.attributes.keys(), ...attrs.keys()]);
      for (const k of keys) {
        const p = prev.attributes.get(k);
        const v = attrs.get(k);
        // Enum merge must be the UNION of the definitions that declare the attribute —
        // the same element name has context-dependent enums in the schemas (e.g. <match>
        // class allows different classlookup subsets per context), and this index is
        // keyed by name only. Replacement kept only one context's enum and false-errored
        // legal, in-game-proven values (found grounding against x4_ai_influence). If a
        // definition declares the attr WITHOUT an enum restriction, the merged attr is
        // unrestricted (an unrestricted context makes any value legal somewhere).
        let enumValues: string[] | undefined;
        if (p && v) {
          enumValues = (p.enumValues?.length && v.enumValues?.length)
            ? Array.from(new Set([...p.enumValues, ...v.enumValues]))
            : undefined;
        } else {
          enumValues = (p?.enumValues) || (v?.enumValues);
        }
        prev.attributes.set(k, {
          required: Boolean(p?.required) && Boolean(v?.required),
          enumValues: enumValues && enumValues.length ? enumValues : undefined,
          type: (v?.type) || p?.type,
          baseType: v?.baseType || p?.baseType,
          patterns: Array.from(new Set([...(p?.patterns || []), ...(v?.patterns || [])])),
          defaultValue: v?.defaultValue ?? p?.defaultValue,
          fixedValue: v?.fixedValue ?? p?.fixedValue,
          documentation: v?.documentation || p?.documentation,
        });
      }
      prev.openAttributes = prev.openAttributes || open;
      prev.openChildren = prev.openChildren || openChildren;
      prev.resolved = prev.resolved || resolved;
      for (const c of children) prev.children.add(c);
      for (const [child, candidate] of childSpecs) {
        const existing = prev.childSpecs.get(child);
        if (!existing) prev.childSpecs.set(child, { ...candidate });
        else {
          existing.minOccurs = Math.min(existing.minOccurs, candidate.minOccurs);
          existing.maxOccurs = existing.maxOccurs === null || candidate.maxOccurs === null ? null : Math.max(existing.maxOccurs, candidate.maxOccurs);
          if (existing.particle !== candidate.particle) existing.particle = 'unknown';
        }
      }
      prev.typeName = prev.typeName || typeName;
      prev.documentation = prev.documentation || documentation;
    } else {
      elements.set(lname, {
        attributes: attrs,
        openAttributes: open,
        resolved,
        children,
        childSpecs,
        openChildren,
        particles: [],
        typeName,
        documentation,
      });
    }
  };

  for (const root of roots) {
    for (const el of collectByKey(root, 'xs:element')) {
      const name = el?.name;
      if (typeof name !== 'string' || !name) continue;
      const { attrs, open, resolved, children, childSpecs, openChildren } = resolveElementAttrs(el);
      addElement(name, attrs, open, resolved, children, childSpecs, openChildren, typeof el.type === 'string' ? el.type : undefined, documentationOf(el));
    }
  }

  for (const [name, variants] of orderedParticles) {
    const spec = elements.get(name);
    if (!spec) continue;
    const unique = new Map(variants.map(variant => [JSON.stringify(variant), variant]));
    spec.particles = [...unique.values()];
  }

  const index: SchemaIndex = { elements, loaded: true, sourceFiles: existing, elementCount: elements.size };
  if (indexCache.size >= INDEX_CACHE_MAX && !indexCache.has(slot)) {
    const oldest = indexCache.keys().next().value;
    if (oldest !== undefined) indexCache.delete(oldest);
  }
  indexCache.set(slot, { key, index });
  return index;
}

interface ParticleNfaState {
  epsilon: Set<number>;
  transitions: Map<string, Set<number>>;
}
interface ParticleNfa { start: number; accept: number; states: ParticleNfaState[] }

const particleNfaCache = new WeakMap<object, ParticleNfa>();

function compileParticleNfa(root: ContentParticle): ParticleNfa {
  const cached = particleNfaCache.get(root as object);
  if (cached) return cached;
  const states: ParticleNfaState[] = [];
  const state = () => (states.push({ epsilon: new Set(), transitions: new Map() }), states.length - 1);
  const eps = (from: number, to: number) => states[from].epsilon.add(to);
  const edge = (from: number, token: string, to: number) => {
    const targets = states[from].transitions.get(token) || new Set<number>();
    targets.add(to); states[from].transitions.set(token, targets);
  };

  const core = (particle: ContentParticle): [number, number] => {
    const start = state(); const end = state();
    if (particle.kind === 'element') edge(start, particle.name, end);
    else if (particle.kind === 'any') edge(start, '*', end);
    else if (particle.kind === 'sequence') {
      let cursor = start;
      for (const child of particle.children) {
        const [childStart, childEnd] = compile(child);
        eps(cursor, childStart); cursor = childEnd;
      }
      eps(cursor, end);
    } else if (particle.kind === 'choice') {
      for (const child of particle.children) {
        const [childStart, childEnd] = compile(child);
        eps(start, childStart); eps(childEnd, end);
      }
    } else {
      // XSD 1.0 xs:all children are single-occurrence particles. A subset NFA
      // preserves arbitrary order and required/optional membership. Large or
      // non-conforming all-groups fall back to a conservative sequence.
      if (particle.children.length <= 16) {
        const subsetStates = new Map<number, number>([[0, start]]);
        const requiredMask = particle.children.reduce((mask, child, index) => child.minOccurs > 0 ? mask | (1 << index) : mask, 0);
        const maxMask = 1 << particle.children.length;
        for (let mask = 0; mask < maxMask; mask++) {
          const from = subsetStates.get(mask) ?? state(); subsetStates.set(mask, from);
          if ((mask & requiredMask) === requiredMask) eps(from, end);
          for (let index = 0; index < particle.children.length; index++) {
            if (mask & (1 << index)) continue;
            const nextMask = mask | (1 << index);
            const to = subsetStates.get(nextMask) ?? state(); subsetStates.set(nextMask, to);
            const child = particle.children[index];
            const one = { ...child, minOccurs: 1, maxOccurs: 1 } as ContentParticle;
            const [childStart, childEnd] = compile(one);
            eps(from, childStart); eps(childEnd, to);
          }
        }
      } else {
        let cursor = start;
        for (const child of particle.children) {
          const [childStart, childEnd] = compile(child);
          eps(cursor, childStart); cursor = childEnd;
        }
        eps(cursor, end);
      }
    }
    return [start, end];
  };

  const compile = (particle: ContentParticle): [number, number] => {
    const start = state(); const end = state();
    const min = Math.max(0, particle.minOccurs);
    const finiteMax = particle.maxOccurs === null ? null : Math.max(min, particle.maxOccurs);
    const treatAsLoop = finiteMax === null || finiteMax > 64;
    let cursor = start;
    for (let index = 0; index < min; index++) {
      const [itemStart, itemEnd] = core(particle);
      eps(cursor, itemStart); cursor = itemEnd;
    }
    if (treatAsLoop) {
      eps(cursor, end);
      const [loopStart, loopEnd] = core(particle);
      eps(cursor, loopStart); eps(loopEnd, end); eps(loopEnd, loopStart);
    } else {
      eps(cursor, end);
      for (let index = min; index < finiteMax!; index++) {
        const [itemStart, itemEnd] = core(particle);
        eps(cursor, itemStart); cursor = itemEnd; eps(cursor, end);
      }
    }
    return [start, end];
  };

  const [start, accept] = compile(root);
  const nfa = { start, accept, states };
  particleNfaCache.set(root as object, nfa);
  return nfa;
}

function epsilonClosure(nfa: ParticleNfa, input: Iterable<number>): Set<number> {
  const closure = new Set(input);
  const work = [...closure];
  while (work.length) {
    const current = work.pop()!;
    for (const next of nfa.states[current].epsilon) {
      if (!closure.has(next)) { closure.add(next); work.push(next); }
    }
  }
  return closure;
}

interface ParticleDfaState {
  active: Set<number>;
  transitions: Map<string, ParticleDfaState>;
}
interface ParticleDfa {
  nfa: ParticleNfa;
  start: ParticleDfaState;
  states: Map<string, ParticleDfaState>;
}

const particleDfaCache = new WeakMap<ParticleNfa, ParticleDfa>();

function dfaFor(nfa: ParticleNfa): ParticleDfa {
  const cached = particleDfaCache.get(nfa);
  if (cached) return cached;
  const active = epsilonClosure(nfa, [nfa.start]);
  const start: ParticleDfaState = { active, transitions: new Map() };
  const dfa = { nfa, start, states: new Map([[[...active].join(','), start]]) };
  particleDfaCache.set(nfa, dfa);
  return dfa;
}

function advanceParticleDfa(dfa: ParticleDfa, current: ParticleDfaState, raw: string): ParticleDfaState {
  const token = raw.toLowerCase();
  const cached = current.transitions.get(token);
  if (cached) return cached;
  const next = new Set<number>();
  for (const nfaState of current.active) {
    for (const target of dfa.nfa.states[nfaState].transitions.get(token) || []) next.add(target);
    for (const target of dfa.nfa.states[nfaState].transitions.get('*') || []) next.add(target);
  }
  const active = epsilonClosure(dfa.nfa, next);
  const key = [...active].join(',');
  let result = dfa.states.get(key);
  if (!result) {
    result = { active, transitions: new Map() };
    dfa.states.set(key, result);
  }
  current.transitions.set(token, result);
  return result;
}

export interface ParticleState {
  viable: boolean;
  complete: boolean;
  next: Set<string>;
  wildcard: boolean;
}

/** Incremental particle matcher used by the validator's XML stack. */
export class ContentParticleCursor {
  private readonly fallback: ElementSpec | null;
  private readonly variants: Array<{ dfa: ParticleDfa; state: ParticleDfaState }>;

  constructor(spec: ElementSpec) {
    this.fallback = spec.particles.length ? null : spec;
    this.variants = spec.particles.map(particle => {
      const nfa = compileParticleNfa(particle);
      const dfa = dfaFor(nfa);
      return { dfa, state: dfa.start };
    });
  }

  advance(child: string): ParticleState {
    for (const variant of this.variants) variant.state = advanceParticleDfa(variant.dfa, variant.state, child);
    return this.state();
  }

  state(): ParticleState {
    if (this.fallback) return {
      viable: true,
      complete: true,
      next: new Set(this.fallback.children),
      wildcard: this.fallback.openChildren,
    };
    const next = new Set<string>();
    let viable = false;
    let complete = false;
    let wildcard = false;
    for (const variant of this.variants) {
      const active = variant.state.active;
      if (!active.size) continue;
      viable = true;
      if (active.has(variant.dfa.nfa.accept)) complete = true;
      for (const current of active) {
        for (const token of variant.dfa.nfa.states[current].transitions.keys()) {
          if (token === '*') wildcard = true;
          else next.add(token);
        }
      }
    }
    return { viable, complete, next, wildcard };
  }
}

/** State of every retained schema variant after consuming the parent's existing children. */
export function contentParticleState(spec: ElementSpec, children: string[]): ParticleState {
  const cursor = new ContentParticleCursor(spec);
  for (const child of children) cursor.advance(child);
  return cursor.state();
}

interface RawTag {
  name: string;
  attrs: { name: string; value: string }[];
  line: number;
  selfClosing: boolean;
}

/** Lightweight scanner: yields each opening/self-closing tag with line numbers. */
function scanTags(xml: string): RawTag[] {
  const tags: RawTag[] = [];
  // Mask out comment / CDATA / PI spans so their contents are not scanned as real
  // tags (e.g. a doc comment mentioning "<do_if>" must not be flagged as an element
  // missing its "value" attribute). Replace non-newline chars with spaces to keep
  // byte offsets and line numbers identical to the source.
  const masked = xml.replace(
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g,
    (s) => s.replace(/[^\n]/g, ' '),
  );
  // match opening or self-closing tags, skip closing tags, comments, PIs, declarations
  const re = /<([a-zA-Z_][\w.-]*)((?:\s+[\w.\-:]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m: RegExpExecArray | null;
  let line = 1;
  let last = 0;
  while ((m = re.exec(masked)) !== null) {
    for (let index = last; index < m.index; index++) if (masked.charCodeAt(index) === 10) line++;
    const name = m[1];
    const attrStr = m[2] || '';
    const attrs: { name: string; value: string }[] = [];
    const attrRe = /([\w.\-:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(attrStr)) !== null) {
      attrs.push({ name: a[1], value: a[2] !== undefined ? a[2] : (a[3] || '') });
    }
    tags.push({ name, attrs, line, selfClosing: m[3] === '/' });
    for (let index = m.index; index < re.lastIndex; index++) if (masked.charCodeAt(index) === 10) line++;
    last = re.lastIndex;
  }
  return tags;
}

interface TagEvent { name: string; close: boolean; selfClosing: boolean; line: number }

function scanTagEvents(xml: string): TagEvent[] {
  const masked = String(xml || '').replace(
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g,
    (s) => s.replace(/[^\n]/g, ' '),
  );
  const events: TagEvent[] = [];
  const re = /<(\/)?([A-Za-z_][\w.:-]*)(?:(?:"[^"]*"|'[^']*'|[^'"<>])*)?(\/?)>/g;
  let match: RegExpExecArray | null;
  let line = 1;
  let last = 0;
  while ((match = re.exec(masked)) !== null) {
    for (let i = last; i < match.index; i++) if (masked.charCodeAt(i) === 10) line++;
    events.push({
      name: match[2].toLowerCase(),
      close: !!match[1],
      selfClosing: !match[1] && /\/\s*>$/.test(match[0]),
      line,
    });
    for (let i = match.index; i < re.lastIndex; i++) if (masked.charCodeAt(i) === 10) line++;
    last = re.lastIndex;
  }
  return events;
}

function schemaCitation(index: SchemaIndex): string {
  const files = index.sourceFiles.map(p => p.replace(/\\/g, '/').split('/').pop()).filter(Boolean);
  return Array.from(new Set(files)).slice(0, 4).join(' + ') || 'configured XSD';
}

// Structural/known tags that may not carry attribute specs in our index but are
// valid; never report these as "unknown element".
const ALWAYS_KNOWN = new Set([
  'mdscript', 'cues', 'cue', 'cues', 'library', 'conditions', 'actions', 'params', 'param',
  'attention', 'check_value', 'check_any', 'check_all', 'do_if', 'do_else', 'do_elseif',
  'do_all', 'do_any', 'do_while', 'do_for_each', 'set_value', 'patch', 'diff', 'add', 'replace',
  'remove', 'aiscript', 'order', 'init', 'interrupt', 'blocks', 'resume', 'label', 'sumitemstodo'
]);

export interface ValidateOptions {
  filePath?: string;
  domain?: string;
  reportUnknownElements?: boolean; // default false (info-only, can false-positive)
  reportUnknownAttributes?: boolean; // default true (warning)
  /** Promote deterministic schema violations to errors and check direct-child legality. */
  strictStructure?: boolean;
  /** Validate XSD regex patterns only when the caller has proven JS/XSD regex compatibility. */
  checkPatterns?: boolean;
  checkTimeFormat?: boolean; // default true
  /**
   * Real game-data reference sets, keyed by the schema's semantic attribute
   * types. When provided, literal values of attributes with that type are
   * checked for existence (catches runtime "no ship generated" / unknown id).
   */
  references?: {
    macros?: Set<string>;   // type "macroname"/"macro"
    wares?: Set<string>;    // type "warename"/"ware" (literal only)
    factions?: Set<string>; // type "faction" (literal only)
    sectors?: Set<string>;  // type "sector"/"sectorname" (literal only)
  };
}

// X4 time-typed attributes are schema-typed as permissive "expression", so the
// XSD can't catch a bare number. These names are time values at runtime and a
// literal integer without a unit (e.g. "8") fails as "not of type time".
const TIME_ATTR_NAMES = new Set(['duration', 'timeout', 'delay', 'interval']);

/** A literal (non-expression) reference value we can check against an index. */
function isLiteralRef(v: string): boolean {
  return !!v && !/[{}$\s]/.test(v) && !v.includes('.');
}

function referenceDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i; let best = row[0];
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = old; best = Math.min(best, row[j]);
    }
    if (best > cap) return cap + 1;
  }
  return row[b.length];
}

function referenceSuggestion(value: string, candidates: Set<string>): string {
  const clean = value.toLowerCase().replace(/^faction\./, '');
  const ranked = [...candidates]
    .map(v => v.toLowerCase().replace(/^faction\./, ''))
    .filter((v, i, all) => all.indexOf(v) === i)
    .map(v => ({ value: v, distance: referenceDistance(clean, v) }))
    .filter(v => v.distance <= 3)
    .sort((a, b) => a.distance - b.distance || a.value.localeCompare(b.value));
  return ranked.length ? ` Did you mean "${ranked[0].value}"?` : '';
}

/**
 * Validate XML text against the schema index. Returns diagnostics for enum
 * violations (error), missing required attributes (warning), unknown attributes
 * (warning), and optionally unknown elements (info).
 */
export function validateXmlAgainstSchema(xml: string, index: SchemaIndex, opts: ValidateOptions = {}): XsdDiagnostic[] {
  const profileStarted = performance.now();
  const out: XsdDiagnostic[] = [];
  if (!index.loaded || !index.elements.size) return out;
  const domain = opts.domain || 'md';
  const filePath = opts.filePath;
  const reportUnknownAttr = opts.reportUnknownAttributes !== false;
  const reportUnknownEl = opts.reportUnknownElements === true;
  const strict = opts.strictStructure === true;
  const citation = schemaCitation(index);

  const scannedTags = scanTags(xml);
  const tagScanCompleted = performance.now();
  for (const tag of scannedTags) {
    const lname = tag.name.toLowerCase();
    const spec = index.elements.get(lname);

    if (!spec) {
      if (reportUnknownEl && (strict || !ALWAYS_KNOWN.has(lname))) {
        // WARNING (not info): an element the game schema doesn't recognize is a real
        // risk — almost always a typo or a fabricated element name. Surfacing it as a
        // warning makes it count in the Doctor and matches the on-canvas node badge,
        // instead of being buried as info. The wording stays honest about the rare
        // schema-incompleteness case.
        out.push({
          severity: strict ? 'error' : 'warning',
          domain,
          filePath,
          line: tag.line,
          sourceRef: `${tag.name}`,
          code: 'XSD_UNKNOWN_ELEMENT',
          message: `Element <${tag.name}> is not declared by ${citation}.`
        });
      }
      continue;
    }

    const present = new Set(tag.attrs.map(a => a.name.toLowerCase()));

    // enum + unknown-attr checks
    for (const attr of tag.attrs) {
      const aname = attr.name.toLowerCase();
      if (aname.startsWith('xmlns') || aname.startsWith('xsi:')) continue;
      const aspec = spec.attributes.get(aname);
      if (!aspec) {
        // Only flag unknown attributes when we actually resolved this element's
        // attribute set; otherwise we'd false-positive on unresolved types.
        if (reportUnknownAttr && !spec.openAttributes && spec.resolved && (strict || spec.attributes.size > 0)) {
          out.push({
            severity: strict ? 'error' : 'warning',
            domain,
            filePath,
            line: tag.line,
            sourceRef: `${tag.name}@${attr.name}`,
            code: 'XSD_UNKNOWN_ATTRIBUTE',
            message: `<${tag.name}> has attribute "${attr.name}" which is not declared for this element in ${citation}.`
          });
        }
        continue;
      }
      if (aspec.enumValues && aspec.enumValues.length && attr.value && !/[{[$]/.test(attr.value)) {
        // skip MD expressions like {param.x}, list literals like [class.ship_l, class.ship_m],
        // and $variable values; only validate plain literal values
        const ok = aspec.enumValues.some(v => v.toLowerCase() === attr.value.toLowerCase());
        if (!ok) {
          out.push({
            severity: 'error',
            domain,
            filePath,
            line: tag.line,
            sourceRef: `${tag.name}@${attr.name}`,
            code: 'XSD_ENUM_VIOLATION',
            message: `<${tag.name}> attribute "${attr.name}"="${attr.value}" violates its enumeration in ${citation}. Allowed: ${aspec.enumValues.slice(0, 12).join(', ')}${aspec.enumValues.length > 12 ? ', …' : ''}.`
          });
        }
      }

      if (aspec.fixedValue !== undefined && attr.value !== aspec.fixedValue) {
        out.push({
          severity: 'error', domain, filePath, line: tag.line,
          sourceRef: `${tag.name}@${attr.name}`, code: 'XSD_FIXED_VIOLATION',
          message: `<${tag.name}> attribute "${attr.name}" must equal fixed schema value "${aspec.fixedValue}" in ${citation}.`,
        });
      }

      if (opts.checkPatterns === true && aspec.patterns?.length && attr.value && !/[{[$]/.test(attr.value)) {
        for (const pattern of aspec.patterns) {
          try {
            if (!new RegExp(`^(?:${pattern})$`).test(attr.value)) {
              out.push({
                severity: 'error', domain, filePath, line: tag.line,
                sourceRef: `${tag.name}@${attr.name}`, code: 'XSD_PATTERN_VIOLATION',
                message: `<${tag.name}> attribute "${attr.name}"="${attr.value}" violates pattern /${pattern}/ from ${citation}.`,
              });
            }
          } catch { /* XSD regex syntax not representable by JavaScript: do not guess. */ }
        }
      }

      // Time-format check (schema type is permissive "expression", so this is a
      // curated semantic rule): a bare integer on a time attribute fails at runtime.
      if (opts.checkTimeFormat !== false && TIME_ATTR_NAMES.has(aname) && attr.value && /^\d+(\.\d+)?$/.test(attr.value)) {
        out.push({
          severity: 'warning',
          domain,
          filePath,
          line: tag.line,
          sourceRef: `${tag.name}@${attr.name}`,
          code: 'XSD_TIME_FORMAT',
          message: `<${tag.name}> attribute "${attr.name}"="${attr.value}" looks like a time but has no unit. X4 rejects bare numbers for time values at runtime — use "${attr.value}s" (or ms/min/h).`
        });
      }

      // Faction reference: the explicit "faction.<id>" literal form is
      // unambiguous (unlike bare expressions), so validate it even though the
      // schema type is often an expression union.
      if (opts.references?.factions?.size && attr.value && /^faction\.\w+$/i.test(attr.value)) {
        if (!opts.references.factions.has(attr.value.toLowerCase())) {
          out.push({
            severity: 'warning', domain, filePath, line: tag.line,
            sourceRef: `${tag.name}@${attr.name}`, code: 'REF_UNKNOWN_FACTION',
            message: `<${tag.name}> ${attr.name}="${attr.value}" is not a known faction in the configured canonical X4 corpus.${referenceSuggestion(attr.value, opts.references.factions)}`
          });
        }
      }

      // Ware lookups use the same explicit expression form (`ware.<id>`), while
      // the canonical ware set stores bare IDs. Validate the unambiguous suffix
      // even when the containing XSD attribute is the broader expression type.
      const wareExpression = attr.value?.match(/^ware\.([A-Za-z_][\w]*)$/i);
      if (wareExpression && opts.references?.wares?.size) {
        const wareId = wareExpression[1].toLowerCase();
        if (!opts.references.wares.has(wareId)) {
          out.push({
            severity: 'warning', domain, filePath, line: tag.line,
            sourceRef: `${tag.name}@${attr.name}`, code: 'REF_UNKNOWN_WARE',
            message: `<${tag.name}> ${attr.name}="${attr.value}" names unknown ware id "${wareId}" in the configured canonical X4 corpus.${referenceSuggestion(wareId, opts.references.wares)}`,
          });
        }
      }

      // Reference existence check, driven by the schema's semantic type.
      const refs = opts.references;
      if (refs && attr.value && isLiteralRef(attr.value)) {
        const t = (aspec.type || '').toLowerCase();
        const lv = attr.value.toLowerCase();
        if ((t === 'macroname' || t === 'macro') && refs.macros && refs.macros.size && !refs.macros.has(lv)) {
          out.push({
            severity: 'warning', domain, filePath, line: tag.line,
            sourceRef: `${tag.name}@${attr.name}`, code: 'REF_UNKNOWN_MACRO',
            message: `<${tag.name}> ${attr.name}="${attr.value}" is not a known macro in the configured canonical X4 corpus (${refs.macros.size} macros).${referenceSuggestion(attr.value, refs.macros)}`
          });
        } else if ((t === 'warename' || t === 'ware') && refs.wares && refs.wares.size && !refs.wares.has(lv)) {
          out.push({
            severity: 'warning', domain, filePath, line: tag.line,
            sourceRef: `${tag.name}@${attr.name}`, code: 'REF_UNKNOWN_WARE',
            message: `<${tag.name}> ${attr.name}="${attr.value}" is not a known ware id in the configured canonical X4 corpus (${refs.wares.size} wares).${referenceSuggestion(attr.value, refs.wares)}`
          });
        } else if ((t === 'sector' || t === 'sectorname') && refs.sectors && refs.sectors.size && !refs.sectors.has(lv)) {
          out.push({
            severity: 'warning', domain, filePath, line: tag.line,
            sourceRef: `${tag.name}@${attr.name}`, code: 'REF_UNKNOWN_SECTOR',
            message: `<${tag.name}> ${attr.name}="${attr.value}" is not a known sector macro in the configured canonical X4 corpus (${refs.sectors.size} sectors).${referenceSuggestion(attr.value, refs.sectors)}`
          });
        }
      }
    }

    // required attribute presence.
    // On event-condition elements (event_*) this is an ERROR, not a warning: a listener
    // missing a schema-required attribute (e.g. bare <event_offer_accepted/> without
    // `cue`) silently never registers in-game — the mod looks fine and does nothing
    // (ROADMAP gap #8, x4_ai_influence G3 AAR 2026-07-01: cost a full live-test cycle).
    for (const [aname, aspec] of spec.attributes) {
      if (aspec.required && !present.has(aname)) {
        const isEventCondition = lname.startsWith('event_');
        out.push({
          severity: strict || isEventCondition ? 'error' : 'warning',
          domain,
          filePath,
          line: tag.line,
          sourceRef: `${tag.name}@${aname}`,
          code: 'XSD_MISSING_REQUIRED',
          message: isEventCondition
            ? `<${tag.name}> is missing required attribute "${aname}" per the schema. An event condition missing a required attribute silently never registers in-game — the cue will never fire.`
            : `<${tag.name}> is missing required attribute "${aname}" per ${citation}.`
        });
      }
    }
  }

  const attributesCompleted = performance.now();

  if (strict) {
    interface Frame {
      name: string;
      line: number;
      children: Array<{ name: string; line: number }>;
      particleBroken: boolean;
      particle: ContentParticleCursor | null;
    }
    const stack: Frame[] = [];
    const closeFrame = (frame: Frame, line: number) => {
      const spec = index.elements.get(frame.name);
      if (!spec?.resolved || !spec.particles.length || frame.particleBroken) return;
      const state = frame.particle?.state() || contentParticleState(spec, frame.children.map(child => child.name));
      if (state.viable && !state.complete) {
        out.push({
          severity: 'error', domain, filePath, line,
          sourceRef: frame.name, code: 'XSD_CHILD_CARDINALITY',
          message: `<${frame.name}> ends before its required child content is complete per the ordered particle in ${citation}. Legal next children: ${[...state.next].sort().join(', ') || '(none)'}.`,
        });
      }
    };
    for (const event of scanTagEvents(xml)) {
      if (event.close) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === event.name) {
            const frame = stack[i];
            stack.length = i;
            closeFrame(frame, event.line);
            break;
          }
        }
        continue;
      }
      const parentFrame = stack.length ? stack[stack.length - 1] : null;
      if (parentFrame) {
        const parentName = parentFrame.name;
        const parent = index.elements.get(parentName);
        const beforeState = parentFrame.particle?.state() || null;
        parentFrame.children.push({ name: event.name, line: event.line });
        const afterState = parentFrame.particle?.advance(event.name) || null;
        if (parent?.resolved && !parent.openChildren && !parent.children.has(event.name)) {
          parentFrame.particleBroken = true;
          out.push({
            severity: 'error', domain, filePath, line: event.line,
            sourceRef: `${parentName}>${event.name}`, code: 'XSD_ILLEGAL_CHILD',
            message: `<${event.name}> is not a legal direct child of <${parentName}> per ${citation}. Allowed direct children: ${[...parent.children].sort().slice(0, 30).join(', ')}${parent.children.size > 30 ? ', …' : ''}.`,
          });
        } else if (parent?.resolved && parent.particles.length && !parentFrame.particleBroken) {
          if (afterState && !afterState.viable) {
            parentFrame.particleBroken = true;
            const childSpec = parent.childSpecs.get(event.name);
            const count = parentFrame.children.filter(child => child.name === event.name).length;
            const exceedsMax = childSpec?.maxOccurs !== null && childSpec?.maxOccurs !== undefined && count > childSpec.maxOccurs;
            out.push({
              severity: 'error', domain, filePath, line: event.line,
              sourceRef: `${parentName}>${event.name}`,
              code: exceedsMax ? 'XSD_CHILD_CARDINALITY' : 'XSD_CHILD_ORDER',
              message: exceedsMax
                ? `<${event.name}> occurs ${count} times under <${parentName}>, exceeding maxOccurs=${childSpec!.maxOccurs} in ${citation}.`
                : `<${event.name}> is not legal at this position under <${parentName}> per the ordered sequence/choice particle in ${citation}. Expected next: ${[...(beforeState?.next || [])].sort().join(', ') || '(no child)'}.`,
            });
          }
        }
      }
      const frameSpec = index.elements.get(event.name);
      const frame: Frame = {
        name: event.name,
        line: event.line,
        children: [],
        particleBroken: false,
        particle: frameSpec?.particles.length ? new ContentParticleCursor(frameSpec) : null,
      };
      if (event.selfClosing) closeFrame(frame, event.line);
      else stack.push(frame);
    }
  }


  if (process.env.X4_PROFILE_VALIDATION === '1') {
    console.error(JSON.stringify({
      profile: 'xsd-validation',
      file: filePath || '(memory)',
      bytes: Buffer.byteLength(xml),
      tags: scannedTags.length,
      scanMs: Math.round((tagScanCompleted - profileStarted) * 10) / 10,
      attributesMs: Math.round((attributesCompleted - tagScanCompleted) * 10) / 10,
      particlesMs: Math.round((performance.now() - attributesCompleted) * 10) / 10,
    }));
  }

  return out;
}

export function runXsdValidateSelftest() {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({
    name, pass, ...(detail === undefined ? {} : { detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }),
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-xsd-model-'));
  try {
    const file = path.join(tmp, 'fixture.xsd');
    fs.writeFileSync(file, `<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:simpleType name="modeBase"><xs:restriction base="xs:string"><xs:enumeration value="a"/><xs:enumeration value="b"/><xs:pattern value="[ab]"/></xs:restriction></xs:simpleType>
      <xs:simpleType name="mode"><xs:restriction base="modeBase"/></xs:simpleType>
      <xs:element name="root"><xs:complexType><xs:sequence><xs:element ref="child" minOccurs="0" maxOccurs="2"/><xs:element ref="tail" minOccurs="0"/></xs:sequence><xs:attribute name="mode" type="mode" use="required" default="a"/><xs:attribute name="exact" type="xs:string"/></xs:complexType></xs:element>
      <xs:element name="child"><xs:complexType><xs:choice><xs:element ref="leaf"/><xs:any minOccurs="0"/></xs:choice></xs:complexType></xs:element>
      <xs:element name="leaf"><xs:complexType/></xs:element>
      <xs:element name="tail"><xs:complexType/></xs:element>
      <xs:element name="other"><xs:complexType/></xs:element>
    </xs:schema>`, 'utf8');
    const index = buildSchemaIndex([file]);
    const root = index.elements.get('root');
    ok('child_particle_cardinality_indexed', root?.childSpecs.get('child')?.particle === 'sequence'
      && root.childSpecs.get('child')?.minOccurs === 0 && root.childSpecs.get('child')?.maxOccurs === 2, root?.childSpecs.get('child'));
    ok('ordered_particle_retained', root?.particles.length === 1
      && contentParticleState(root, []).next.has('child')
      && contentParticleState(root, []).next.has('tail'));
    ok('attribute_enum_pattern_default_indexed', root?.attributes.get('mode')?.enumValues?.length === 2
      && root.attributes.get('mode')?.patterns?.includes('[ab]') && root.attributes.get('mode')?.defaultValue === 'a', root?.attributes.get('mode'));
    ok('named_restriction_inherits_base_enumeration', root?.attributes.get('mode')?.enumValues?.join(',') === 'a,b', root?.attributes.get('mode'));
    ok('xs_any_opens_children', index.elements.get('child')?.openChildren === true);
    const illegal = validateXmlAgainstSchema('<root mode="a"><other/></root>', index, { strictStructure: true, reportUnknownElements: true });
    ok('illegal_direct_child_is_error', illegal.some(d => d.code === 'XSD_ILLEGAL_CHILD' && d.severity === 'error'), illegal);
    const badEnum = validateXmlAgainstSchema('<root mode="z"/>', index, { strictStructure: true, checkPatterns: true });
    ok('enum_and_pattern_are_errors', badEnum.some(d => d.code === 'XSD_ENUM_VIOLATION') && badEnum.some(d => d.code === 'XSD_PATTERN_VIOLATION'), badEnum);
    const openPayload = validateXmlAgainstSchema('<child><other/></child>', index, { strictStructure: true, reportUnknownElements: true });
    ok('xs_any_payload_not_illegal_child', !openPayload.some(d => d.code === 'XSD_ILLEGAL_CHILD'), openPayload);
    const badWare = validateXmlAgainstSchema('<root mode="a" exact="ware.energycellz"/>', index, { references: { wares: new Set(['energycells']) } });
    ok('expression_ware_reference_warns_with_suggestion', badWare.some(d => d.code === 'REF_UNKNOWN_WARE' && d.severity === 'warning' && d.message.includes('energycells')), badWare);
    const siblings = validateXmlAgainstSchema('<root mode="a"><child/><child/></root>', index, { strictStructure: true, reportUnknownElements: true });
    ok('self_closing_siblings_do_not_nest', !siblings.some(d => d.code === 'XSD_ILLEGAL_CHILD'), siblings);
    const wrongOrder = validateXmlAgainstSchema('<root mode="a"><tail/><child/></root>', index, { strictStructure: true, reportUnknownElements: true });
    ok('sequence_order_violation_is_error', wrongOrder.some(d => d.code === 'XSD_CHILD_ORDER' && d.severity === 'error'), wrongOrder);
    const tooMany = validateXmlAgainstSchema('<root mode="a"><child/><child/><child/></root>', index, { strictStructure: true, reportUnknownElements: true });
    ok('particle_max_occurs_is_error', tooMany.some(d => d.code === 'XSD_CHILD_CARDINALITY' && d.severity === 'error'), tooMany);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  const passed = checks.filter(c => c.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}
