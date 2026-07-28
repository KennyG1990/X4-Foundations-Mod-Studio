/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G13 — import parsers for the wares/jobs domains. The studio already MODELS
 * `WareDef`/`JobDef` and compiles them to XML (modCompiler), but imported
 * `libraries/wares.xml` / `libraries/jobs.xml` were preserved raw (passthrough).
 * These parsers turn that XML back into the editable models so a studio-authored
 * mod survives export→import as editable. Tolerant regex (matches both the studio's
 * `<diff><add sel="/wares">…` emit and a raw `<wares>` root); returns `null` when the
 * content has no recognizable ware/job elements so the caller safely falls back to
 * passthrough (never lossy). No I/O.
 *
 * Fidelity note: only fields the model captures are recovered. Job `shipMacro` is not
 * present in the studio's job emit, so it round-trips as ''. Arbitrary external files
 * carrying unmodeled fields should stay passthrough rather than be flattened here.
 */

import type { WareDef, JobDef } from '../types';
import { compileWaresXML, compileJobsXML } from './modCompiler';

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? decodeXmlAttr(m[1]) : '';
}
function num(tag: string, name: string, fallback = 0): number {
  const raw = attr(tag, name);
  if (raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
function decodeXmlAttr(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

const TRANSPORTS = new Set(['container', 'liquid', 'solid', 'energy']);

/**
 * True when the document is a FOREIGN `<diff>` patch — one using operations beyond the
 * studio's own canonical emit (`<diff><add sel="/wares|/jobs">` with whole elements).
 * Foreign patches (replace/remove ops, selectors into specific nodes/attributes) belong
 * to the XML-patching domain and must stay passthrough: modeling them as flat defs and
 * regenerating would change patch semantics (found by real-data grounding, 2026-07-09).
 * The studio's own add-to-root diff shape stays parseable so studio-authored economy
 * mods round-trip as editable (field fidelity is enforced at import by the byte-guard).
 */
function isForeignDiff(content: string, rootSel: '/wares' | '/jobs'): boolean {
  const text = String(content || '');
  if (!/<diff[\s>]/i.test(text.slice(0, 4096))) return false; // not a diff at all
  if (/<(replace|remove)\b/i.test(text)) return true;
  for (const m of text.matchAll(/<add\b[^>]*\bsel\s*=\s*"([^"]*)"/gi)) {
    if (m[1].trim() !== rootSel) return true;
  }
  return false;
}

/** Parse a wares XML document into editable WareDefs, or null if none found. */
export function parseWaresXml(content: string): WareDef[] | null {
  if (!content || !/<ware\b[^>]*\bid\s*=/i.test(content)) return null;
  if (isForeignDiff(content, '/wares')) return null; // foreign patch — passthrough, never flatten
  const wares: WareDef[] = [];
  // Top-level wares carry an `id`; inner <primary> wares carry `ware=`/`amount=` and are
  // self-closing, so a non-greedy </ware> reliably bounds each top-level ware block.
  const re = /<ware\b([^>]*\bid\s*=\s*"[^"]+"[^>]*)>([\s\S]*?)<\/ware>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const openTag = '<ware ' + m[1] + '>';
    const inner = m[2];
    const transportRaw = attr(openTag, 'transport');
    const priceTag = (inner.match(/<price\b[^>]*\/?>/i) || [''])[0];
    const prodTag = (inner.match(/<production\b[^>]*?\/?>/i) || [''])[0];

    const primaryWares: Array<{ ware: string; amount: number | string }> = [];
    const primaryBlock = (inner.match(/<primary\b[^>]*>([\s\S]*?)<\/primary>/i) || ['', ''])[1];
    if (primaryBlock) {
      for (const pm of primaryBlock.matchAll(/<ware\b[^>]*\bware\s*=\s*"([^"]+)"[^>]*>/gi)) {
        const pt = pm[0];
        const amtRaw = attr(pt, 'amount');
        const amtNum = Number(amtRaw);
        primaryWares.push({ ware: decodeXmlAttr(pm[1]), amount: Number.isFinite(amtNum) && amtRaw !== '' ? amtNum : amtRaw });
      }
    }

    const ware: WareDef = {
      id: attr(openTag, 'id'),
      name: attr(openTag, 'name'),
      description: attr(openTag, 'description'),
      transport: (TRANSPORTS.has(transportRaw) ? transportRaw : 'container') as WareDef['transport'],
      volume: num(openTag, 'volume'),
      minPrice: num(priceTag, 'min'),
      avgPrice: num(priceTag, 'average'),
      maxPrice: num(priceTag, 'max'),
      prodTime: num(prodTag, 'time'),
      prodAmount: num(prodTag, 'amount'),
      includeInBuild: true,
    };
    const tags = attr(openTag, 'tags'); if (tags) ware.tags = tags;
    const method = attr(prodTag, 'method'); if (method) ware.productionMethod = method;
    const pname = attr(prodTag, 'name'); if (pname) ware.productionName = pname;
    if (primaryWares.length) ware.primaryWares = primaryWares;
    wares.push(ware);
  }
  // COMPLETENESS GUARD: the paired-tag regex cannot see self-closing top-level wares
  // (vanilla has thousands: grounding found 1397/4277 parsed — a silent 67% loss if
  // regenerated). If we didn't capture EVERY id-bearing ware, the model is incomplete
  // → null so the caller keeps the original bytes (passthrough is lossless; a partial
  // parse is data loss dressed as success).
  const idBearing = (content.match(/<ware\b[^>]*\bid\s*=/gi) || []).length;
  if (wares.length !== idBearing) return null;
  return wares.length ? wares : null;
}

/** Parse a jobs XML document into editable JobDefs, or null if none found. */
export function parseJobsXml(content: string): JobDef[] | null {
  if (!content || !/<job\b[^>]*\bid\s*=/i.test(content)) return null;
  if (isForeignDiff(content, '/jobs')) return null; // foreign patch — passthrough, never flatten
  const jobs: JobDef[] = [];
  const re = /<job\b([^>]*\bid\s*=\s*"[^"]+"[^>]*)>([\s\S]*?)<\/job>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const openTag = '<job ' + m[1] + '>';
    const inner = m[2];
    const selectTag = (inner.match(/<select\b[^>]*\/?>/i) || [''])[0];
    const shipTag = (inner.match(/<ship\b[^>]*>/i) || [''])[0];
    const quotaTag = (inner.match(/<quota\b[^>]*\/?>/i) || [''])[0];
    const taskTag = (inner.match(/<task\b[^>]*\/?>/i) || [''])[0];
    const modsTag = (inner.match(/<modifiers\b[^>]*\/?>/i) || [''])[0];

    // shipClass is encoded by the studio as tags="military <class>" — take the class token.
    const tags = attr(selectTag, 'tags').split(/[^A-Za-z0-9_]+/).filter(Boolean);
    const VALID = new Set(['fighter', 'corvette', 'destroyer', 'carrier', 'freighter']);
    const shipClass = (tags.find(t => VALID.has(t.toLowerCase())) || 'fighter') as JobDef['shipClass'];

    jobs.push({
      id: attr(openTag, 'id'),
      name: attr(openTag, 'name'),
      faction: attr(selectTag, 'faction'),
      shipClass,
      shipMacro: attr(shipTag, 'macro'),
      galaxyQuota: num(quotaTag, 'galaxy'),
      sectorQuota: num(quotaTag, 'sector'),
      taskScript: attr(taskTag, 'task') || attr(taskTag, 'script'),
      rebuildOnDestroy: /\btrue\b/i.test(attr(modsTag, 'rebuild')),
      includeInBuild: true,
    });
  }
  // COMPLETENESS GUARD (same rationale as wares): partial capture → null → passthrough.
  const idBearing = (content.match(/<job\b[^>]*\bid\s*=/gi) || []).length;
  if (jobs.length !== idBearing) return null;
  return jobs.length ? jobs : null;
}

/* ------------------------------------------------------------------ *
 * Round-trip oracle. House shape: { allPassed, pass, passed, total, checks[] }.
 * ------------------------------------------------------------------ */
export function runWaresJobsRoundtripSelftest(): {
  allPassed: boolean; pass: boolean; passed: number; total: number;
  checks: { name: string; pass: boolean; detail?: string }[];
} {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, cond: boolean, detail?: string) => checks.push({ name, pass: !!cond, detail });
  // Key-order-independent deep compare (object key order is irrelevant to equality).
  const stable = (o: unknown): string => {
    if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
    if (o && typeof o === 'object') {
      const record = o as Record<string, unknown>;
      return '{' + Object.keys(record).sort().map(k => JSON.stringify(k) + ':' + stable(record[k])).join(',') + '}';
    }
    return JSON.stringify(o);
  };
  const eq = (a: unknown, b: unknown) => stable(a) === stable(b);

  // ---- wares round-trip: model → compile → parse → deep-equal ----
  const wareFixture: WareDef[] = [{
    id: 'forge_test_ware', name: 'Forge Test Ware', description: 'A round-trip fixture.',
    transport: 'container', tags: 'economy', volume: 14,
    minPrice: 100, avgPrice: 150, maxPrice: 200,
    prodTime: 60, prodAmount: 80, productionMethod: 'default', productionName: 'Default',
    primaryWares: [{ ware: 'energycells', amount: 40 }, { ware: 'water', amount: 20 }],
    includeInBuild: true,
  }];
  const wareXml = compileWaresXML(wareFixture);
  const wareParsed = parseWaresXml(wareXml);
  ok('wares parse non-null', !!wareParsed && wareParsed.length === 1, JSON.stringify(wareParsed?.length));
  ok('wares round-trip deep-equal', eq(wareParsed, wareFixture),
    `got=${JSON.stringify(wareParsed)}`);

  // ---- jobs round-trip ----
  const jobFixture: JobDef[] = [{
    id: 'forge_test_job', name: 'Forge Test Patrol', faction: 'argon',
    shipClass: 'destroyer', shipMacro: 'ship_arg_l_destroyer_01_a_macro', galaxyQuota: 5, sectorQuota: 2,
    taskScript: 'masstraffic.patrol', rebuildOnDestroy: true, includeInBuild: true,
  }];
  const jobXml = compileJobsXML(jobFixture);
  const jobParsed = parseJobsXml(jobXml);
  ok('jobs parse non-null', !!jobParsed && jobParsed.length === 1);
  ok('jobs round-trip deep-equal', eq(jobParsed, jobFixture),
    `got=${JSON.stringify(jobParsed)}`);

  // ---- realistic raw <wares> root (not the diff form) ----
  const rawWares = `<?xml version="1.0"?><wares>
    <ware id="medicalsupplies" name="Medical Supplies" description="" transport="container" volume="2" tags="economy">
      <price min="50" average="80" max="110" />
      <production time="120" amount="100" method="default" />
    </ware></wares>`;
  const rawParsed = parseWaresXml(rawWares);
  ok('raw <wares> parsed', !!rawParsed && rawParsed[0].id === 'medicalsupplies' && rawParsed[0].avgPrice === 80, JSON.stringify(rawParsed));
  ok('no-primary ware → no primaryWares key', !!rawParsed && rawParsed[0].primaryWares === undefined);

  // ---- null on non-matching content (so import falls back to passthrough) ----
  ok('non-wares content → null', parseWaresXml('<jobs><job id="x"/></jobs>') === null);
  ok('non-jobs content → null', parseJobsXml('<wares><ware id="x"/></wares>') === null);
  ok('empty → null', parseWaresXml('') === null && parseJobsXml('') === null);

  // ---- integrity guards (real-data grounding, 2026-07-09) ----
  // FOREIGN diffs (replace/remove ops or non-root selectors) must never be flattened;
  // the studio's own add-to-root diff emit stays parseable.
  const foreignJobs = `<?xml version="1.0"?><diff><replace sel="/jobs/job[@id='x']/@name">Y</replace></diff>`;
  ok('foreign diff (replace op) → null', parseJobsXml(foreignJobs) === null);
  const foreignWares = `<?xml version="1.0"?><diff><add sel="/wares/ware[@id='energycells']/production"><production time="1" amount="1"/></add><add sel="/wares"><ware id="w1" name="W" transport="container" volume="1"><price min="1" average="2" max="3"/></ware></add></diff>`;
  ok('foreign diff (node-targeted add selector) → null', parseWaresXml(foreignWares) === null);
  const studioDiff = `<?xml version="1.0"?><diff><add sel="/wares"><ware id="w1" name="W" transport="container" volume="1"><price min="1" average="2" max="3"/><production time="1" amount="1" method="default"/></ware></add></diff>`;
  ok('studio add-to-root diff still parses', parseWaresXml(studioDiff)?.[0]?.id === 'w1', JSON.stringify(parseWaresXml(studioDiff)));
  // Self-closing top-level wares (the vanilla shape the regex can't model) → null,
  // not a PARTIAL parse — a partial parse is data loss dressed as success.
  const vanillaShaped = `<wares><ware id="paired" name="P" transport="container" volume="1"><price min="1" average="2" max="3"/></ware><ware id="selfclosing" name="S" transport="container" volume="1" tags="module" /></wares>`;
  ok('incomplete capture (self-closing top-level ware) → null', parseWaresXml(vanillaShaped) === null);

  // ---- multi-ware + xml-attr escaping survives ----
  const multi: WareDef[] = [
    { id: 'a', name: 'A & B', description: 'q"q', transport: 'liquid', volume: 1, minPrice: 1, avgPrice: 2, maxPrice: 3, prodTime: 1, prodAmount: 1, productionMethod: 'default', includeInBuild: true },
    { id: 'b', name: 'B', description: '', transport: 'energy', volume: 0, minPrice: 0, avgPrice: 0, maxPrice: 0, prodTime: 0, prodAmount: 0, productionMethod: 'default', includeInBuild: true },
  ];
  const multiParsed = parseWaresXml(compileWaresXML(multi));
  ok('multi-ware count', !!multiParsed && multiParsed.length === 2);
  ok('xml-attr escaping round-trips', !!multiParsed && multiParsed[0].name === 'A & B' && multiParsed[0].description === 'q"q', JSON.stringify(multiParsed?.[0]));

  const passed = checks.filter(c => c.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}
