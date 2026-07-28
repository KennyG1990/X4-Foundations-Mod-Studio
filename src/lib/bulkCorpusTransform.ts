/** Deterministic bulk numeric transforms over effective, read-only X4 XML documents. */

import crypto from 'crypto';
import { DOMParser } from '@xmldom/xmldom';
import * as xpath from 'xpath';
import { simulateXmlDiff } from './diffSimulator';
import type { EffectiveReferenceDocument } from './referenceOverlay';
import type { PatchBlock } from '../types';

export type BulkTransformOperation = 'multiply' | 'add' | 'set' | 'round' | 'min' | 'max' | 'clamp';
export interface BulkTransformRule {
  pathPrefix: string;
  selector: string;
  operation: BulkTransformOperation;
  operand: number | [number, number];
  rounding?: 'none' | 'round' | 'floor' | 'ceil';
  /** Positive rounding quantum; 1 preserves the original whole-unit behavior. */
  roundingIncrement?: number;
  maxFiles: number;
}

export interface BulkTransformFinding {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  path?: string;
}

export interface BulkTransformRow {
  targetFile: string;
  selector: string;
  oldValue: string;
  newValue: string;
  sourceSignature: string;
  sources: EffectiveReferenceDocument['sources'];
  simulationOk: boolean;
  findings: BulkTransformFinding[];
  patch: PatchBlock;
}

/** One read-only result for every canonical file actually scanned by a cleanly bounded plan. */
export interface BulkTransformFileResult {
  targetFile: string;
  status: 'matched' | 'skipped' | 'error';
  matchCount: number;
  oldValue?: string;
  newValue?: string;
  sourceSignature?: string;
  sources: EffectiveReferenceDocument['sources'];
  simulationOk?: boolean;
  findings: BulkTransformFinding[];
}

export interface BulkTransformPlan {
  ok: boolean;
  rule: BulkTransformRule;
  ruleId: string;
  planHash: string;
  corpusGeneration: string;
  candidateCount: number;
  matchedFiles: number;
  skippedFiles: number;
  droppedCount: number;
  rows: BulkTransformRow[];
  files: BulkTransformFileResult[];
  conflicts: Array<{ targetFile: string; selector: string; existingId: string; owner?: string }>;
  findings: BulkTransformFinding[];
}

interface CreatePlanOptions {
  rule: BulkTransformRule;
  logicalPaths: string[];
  corpusGeneration: string;
  resolve: (logicalPath: string) => EffectiveReferenceDocument;
  existingPatches?: PatchBlock[];
}

function normalizedPath(value: string): string { return String(value || '').replace(/\\/g, '/').replace(/^\.\//, ''); }
function sha(value: string): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function stableRule(rule: BulkTransformRule): BulkTransformRule {
  return {
    pathPrefix: normalizedPath(rule.pathPrefix).replace(/\/+$/, ''),
    selector: rule.selector.trim(),
    operation: rule.operation,
    operand: Array.isArray(rule.operand) ? [rule.operand[0], rule.operand[1]] : rule.operand,
    rounding: rule.rounding || 'none',
    roundingIncrement: rule.roundingIncrement === undefined ? 1 : rule.roundingIncrement,
    maxFiles: rule.maxFiles,
  };
}
function pathMatchesPrefix(candidate: string, prefix: string): boolean {
  return candidate === prefix || candidate.startsWith(`${prefix}/`);
}
function patchTargetKey(targetFile: string, selector: string): string { return `${normalizedPath(targetFile).toLowerCase()}\n${selector.trim()}`; }
function xmlAttr(value: string): string { return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function xmlText(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function validateRule(rule: BulkTransformRule): BulkTransformFinding[] {
  const findings: BulkTransformFinding[] = [];
  if (!rule.pathPrefix || rule.pathPrefix === '.' || rule.pathPrefix.startsWith('/') || /^[A-Za-z]:/.test(rule.pathPrefix) || rule.pathPrefix.split('/').includes('..')) {
    findings.push({ severity: 'error', code: 'BULK_PATH_INVALID', message: 'pathPrefix must be a non-empty vanilla-relative path without traversal.' });
  }
  if (!rule.selector || rule.selector.length > 16_384) findings.push({ severity: 'error', code: 'BULK_SELECTOR_INVALID', message: 'selector must be non-empty and at most 16 KB.' });
  if (!Number.isInteger(rule.maxFiles) || rule.maxFiles < 1 || rule.maxFiles > 500) findings.push({ severity: 'error', code: 'BULK_CAP_INVALID', message: 'maxFiles must be an integer from 1 to 500.' });
  if (!Number.isFinite(Number(rule.roundingIncrement)) || Number(rule.roundingIncrement) <= 0) {
    findings.push({ severity: 'error', code: 'BULK_ROUNDING_INCREMENT_INVALID', message: 'roundingIncrement must be a positive finite number.' });
  }
  if (!['multiply', 'add', 'set', 'round', 'min', 'max', 'clamp'].includes(rule.operation)) findings.push({ severity: 'error', code: 'BULK_OPERATION_INVALID', message: `Unsupported operation: ${String(rule.operation)}` });
  if (rule.operation === 'clamp') {
    if (!Array.isArray(rule.operand) || rule.operand.length !== 2 || !rule.operand.every(Number.isFinite) || rule.operand[0] > rule.operand[1]) {
      findings.push({ severity: 'error', code: 'BULK_OPERAND_INVALID', message: 'clamp requires [minimum, maximum] finite operands with minimum <= maximum.' });
    }
  } else if (rule.operation !== 'round' && (Array.isArray(rule.operand) || !Number.isFinite(rule.operand))) {
    findings.push({ severity: 'error', code: 'BULK_OPERAND_INVALID', message: `${rule.operation} requires one finite numeric operand.` });
  }
  return findings;
}

function transformed(value: number, rule: BulkTransformRule): number {
  const operand = Array.isArray(rule.operand) ? rule.operand[0] : rule.operand;
  const increment = Number(rule.roundingIncrement) || 1;
  let next = value;
  if (rule.operation === 'multiply') next = value * operand;
  else if (rule.operation === 'add') next = value + operand;
  else if (rule.operation === 'set') next = operand;
  else if (rule.operation === 'round') next = Math.round(value / increment) * increment;
  else if (rule.operation === 'min') next = Math.min(value, operand);
  else if (rule.operation === 'max') next = Math.max(value, operand);
  else if (rule.operation === 'clamp') next = Math.max(rule.operand[0], Math.min(rule.operand[1], value));
  if (rule.rounding === 'round') next = Math.round(next / increment) * increment;
  else if (rule.rounding === 'floor') next = Math.floor(next / increment) * increment;
  else if (rule.rounding === 'ceil') next = Math.ceil(next / increment) * increment;
  if (!Number.isFinite(next)) throw new Error('transform produced a non-finite result');
  return next;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
}

function selectedNumericValue(content: string, selector: string): { value?: string; count: number; error?: string } {
  try {
    const document = new DOMParser().parseFromString(content.replace(/^\uFEFF/, ''), 'text/xml');
    const selected = xpath.select(selector, document as unknown as Node);
    const values = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (values.length !== 1) return { count: values.length };
    const node = values[0] as unknown as Node;
    if (node.nodeType !== 2 && node.nodeType !== 3 && node.nodeType !== 4) return { count: 1, error: 'selector must resolve to one numeric attribute or text node' };
    return { count: 1, value: String(node.nodeValue ?? node.textContent ?? '').trim() };
  } catch (error) { return { count: 0, error: error instanceof Error ? error.message : String(error) }; }
}

function diffFor(selector: string, value: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>\n<diff>\n  <replace sel="${xmlAttr(selector)}">${xmlText(value)}</replace>\n</diff>`;
}

export function logicalReferencePath(physicalPathInput: string): string {
  const physicalPath = normalizedPath(physicalPathInput);
  const parts = physicalPath.split('/');
  return parts[0]?.toLowerCase() === 'extensions' && parts.length > 2 ? parts.slice(2).join('/') : physicalPath;
}

export function createBulkTransformPlan(options: CreatePlanOptions): BulkTransformPlan {
  const rule = stableRule(options.rule);
  const findings = validateRule(rule);
  const logicalPaths = [...new Set(options.logicalPaths.map(logicalReferencePath).filter(path => pathMatchesPrefix(path, rule.pathPrefix)))].sort();
  const droppedCount = Math.max(0, logicalPaths.length - rule.maxFiles);
  if (droppedCount) findings.push({ severity: 'error', code: 'BULK_CAP_EXCEEDED', message: `${logicalPaths.length} candidate files exceed the explicit cap ${rule.maxFiles}; ${droppedCount} would be dropped.` });
  const candidates = logicalPaths.slice(0, rule.maxFiles);
  const ruleId = sha(JSON.stringify(rule));
  const rows: BulkTransformRow[] = [];
  const files: BulkTransformFileResult[] = [];
  let skippedFiles = 0;

  if (!findings.some(finding => finding.severity === 'error')) for (const targetFile of candidates) {
    let effective: EffectiveReferenceDocument;
    try { effective = options.resolve(targetFile); }
    catch (error) {
      const finding = { severity: 'error' as const, code: 'BULK_EFFECTIVE_READ_FAILED', path: targetFile, message: error instanceof Error ? error.message : String(error) };
      findings.push(finding);
      files.push({ targetFile, status: 'error', matchCount: 0, sources: [], findings: [finding] });
      continue;
    }
    if (!effective.available || effective.content === undefined) {
      const finding = { severity: 'error' as const, code: 'BULK_EFFECTIVE_UNAVAILABLE', path: targetFile, message: 'The manifest listed this XML file, but no effective base or DLC document could be resolved.' };
      findings.push(finding);
      files.push({ targetFile, status: 'error', matchCount: 0, sources: effective.sources, sourceSignature: effective.signature, findings: [finding] });
      continue;
    }
    const selected = selectedNumericValue(effective.content, rule.selector);
    if (selected.error) {
      const finding = { severity: 'error' as const, code: 'BULK_SELECTOR_INVALID', path: targetFile, message: selected.error };
      findings.push(finding);
      files.push({ targetFile, status: 'error', matchCount: selected.count, sources: effective.sources, sourceSignature: effective.signature, findings: [finding] });
      continue;
    }
    if (selected.count === 0) {
      skippedFiles++;
      files.push({ targetFile, status: 'skipped', matchCount: 0, sources: effective.sources, sourceSignature: effective.signature, findings: [] });
      continue;
    }
    if (selected.count !== 1) {
      const finding = { severity: 'error' as const, code: 'BULK_SELECTOR_AMBIGUOUS', path: targetFile, message: `selector matched ${selected.count} nodes; v1 requires exactly one numeric node per logical file.` };
      findings.push(finding);
      files.push({ targetFile, status: 'error', matchCount: selected.count, sources: effective.sources, sourceSignature: effective.signature, findings: [finding] });
      continue;
    }
    const numeric = Number(selected.value);
    if (!Number.isFinite(numeric)) {
      const finding = { severity: 'error' as const, code: 'BULK_VALUE_NONNUMERIC', path: targetFile, message: `matched value is not numeric: ${selected.value}` };
      findings.push(finding);
      files.push({ targetFile, status: 'error', matchCount: 1, oldValue: selected.value, sources: effective.sources, sourceSignature: effective.signature, findings: [finding] });
      continue;
    }
    let next: string;
    try { next = formatNumber(transformed(numeric, rule)); }
    catch (error) {
      const finding = { severity: 'error' as const, code: 'BULK_TRANSFORM_FAILED', path: targetFile, message: error instanceof Error ? error.message : String(error) };
      findings.push(finding);
      files.push({ targetFile, status: 'error', matchCount: 1, oldValue: selected.value, sources: effective.sources, sourceSignature: effective.signature, findings: [finding] });
      continue;
    }
    const simulation = simulateXmlDiff(effective.content, diffFor(rule.selector, next));
    const rowFindings: BulkTransformFinding[] = simulation.findings.map(finding => ({
      severity: finding.severity, code: finding.code, message: finding.message, path: targetFile,
    }));
    if (!simulation.ok) findings.push(...rowFindings.filter(finding => finding.severity === 'error'));
    files.push({
      targetFile, status: simulation.ok ? 'matched' : 'error', matchCount: 1,
      oldValue: selected.value!, newValue: next, sourceSignature: effective.signature,
      sources: effective.sources, simulationOk: simulation.ok, findings: rowFindings,
    });
    rows.push({
      targetFile, selector: rule.selector, oldValue: selected.value!, newValue: next,
      sourceSignature: effective.signature, sources: effective.sources, simulationOk: simulation.ok,
      findings: rowFindings,
      patch: {
        id: `bulk_${ruleId.slice(0, 12)}_${rows.length + 1}`,
        sel: rule.selector, action: 'replace', content: next,
        note: `Bulk transform ${rule.operation} from canonical value ${selected.value}`,
        targetFile, includeInBuild: true, generatedRuleId: ruleId, sourceSignature: effective.signature,
      },
    });
  }

  if (!rows.length && !findings.some(finding => finding.severity === 'error')) findings.push({ severity: 'error', code: 'BULK_NO_MATCHES', message: 'No effective document contained exactly one matching numeric node.' });
  const conflicts: BulkTransformPlan['conflicts'] = [];
  for (const row of rows) for (const existing of options.existingPatches || []) {
    if (patchTargetKey(existing.targetFile || '', existing.sel) !== patchTargetKey(row.targetFile, row.selector)) continue;
    if (existing.generatedRuleId === ruleId) continue;
    conflicts.push({ targetFile: row.targetFile, selector: row.selector, existingId: existing.id, owner: existing.generatedRuleId });
  }
  if (conflicts.length) findings.push({ severity: 'error', code: 'BULK_PATCH_CONFLICT', message: `${conflicts.length} user-authored or differently-owned patch target(s) conflict with this rule.` });
  const planMaterial = {
    corpusGeneration: options.corpusGeneration, rule,
    rows: rows.map(row => ({ targetFile: row.targetFile, selector: row.selector, oldValue: row.oldValue, newValue: row.newValue, sourceSignature: row.sourceSignature })),
    files: files.map(file => ({ targetFile: file.targetFile, status: file.status, matchCount: file.matchCount, sourceSignature: file.sourceSignature })),
    conflicts,
  };
  const planHash = sha(JSON.stringify(planMaterial));
  for (const row of rows) row.patch.generatedPlanHash = planHash;
  return {
    ok: !findings.some(finding => finding.severity === 'error') && rows.every(row => row.simulationOk),
    rule, ruleId, planHash, corpusGeneration: options.corpusGeneration,
    candidateCount: logicalPaths.length, matchedFiles: rows.length, skippedFiles, droppedCount,
    rows, files, conflicts, findings,
  };
}

export function mergeBulkTransformPatches(existing: PatchBlock[], plan: BulkTransformPlan): PatchBlock[] {
  if (!plan.ok) throw new Error('Cannot apply a bulk plan that is not clean.');
  // Whole-rule replacement is deliberate: if a DLC/file disappears, a rerun must remove the
  // previously generated block for that vanished target instead of leaving a stale patch behind.
  const retained = existing.filter(patch => patch.generatedRuleId !== plan.ruleId);
  return [...retained, ...plan.rows.map(row => ({ ...row.patch }))];
}

export function runBulkCorpusTransformSelftest() {
  const base = '<macros><macro name="fixture_macro" class="ship"><properties><hull max="100"/></properties></macro></macros>';
  const resolve = (logicalPath: string): EffectiveReferenceDocument => ({
    available: true, root: 'fixture', relativePath: logicalPath, content: base,
    sources: [{ source: 'base', path: logicalPath, mode: 'base' }], findings: [], signature: `sig:${logicalPath}`,
  });
  const rule: BulkTransformRule = { pathPrefix: 'assets/units/size_xl/macros', selector: '/macros/macro/properties/hull/@max', operation: 'multiply', operand: 1.5, rounding: 'none', maxFiles: 10 };
  const paths = ['assets/units/size_xl/macros/a.xml', 'extensions/ego_dlc_test/assets/units/size_xl/macros/b.xml'];
  const first = createBulkTransformPlan({ rule, logicalPaths: paths, corpusGeneration: 'g1', resolve });
  const second = createBulkTransformPlan({ rule, logicalPaths: paths, corpusGeneration: 'g1', resolve });
  const merged = first.ok ? mergeBulkTransformPatches([], first) : [];
  const rerun = first.ok ? mergeBulkTransformPatches(merged, second) : [];
  const conflict = createBulkTransformPlan({ rule, logicalPaths: paths, corpusGeneration: 'g1', resolve, existingPatches: [{ id: 'manual', action: 'replace', sel: rule.selector, content: '200', note: '', targetFile: 'assets/units/size_xl/macros/a.xml' }] });
  const capped = createBulkTransformPlan({ rule: { ...rule, maxFiles: 1 }, logicalPaths: paths, corpusGeneration: 'g1', resolve });
  const nonnumeric = createBulkTransformPlan({ rule, logicalPaths: [paths[0]], corpusGeneration: 'g1', resolve: logicalPath => ({ ...resolve(logicalPath), content: '<macros><macro name="fixture_macro" class="ship"><properties><hull max="many"/></properties></macro></macros>' }) });
  const quantum = createBulkTransformPlan({ rule: { ...rule, operand: 1.337, rounding: 'ceil', roundingIncrement: 100 }, logicalPaths: [paths[0]], corpusGeneration: 'g1', resolve });
  const boundary = createBulkTransformPlan({ rule, logicalPaths: [...paths, 'assets/units/size_xl/macros_extra/c.xml'], corpusGeneration: 'g1', resolve });
  const heterogeneousPath = 'assets/units/size_xl/macros/helper.xml';
  const heterogeneous = createBulkTransformPlan({
    rule,
    logicalPaths: [...paths, heterogeneousPath],
    corpusGeneration: 'g1',
    resolve: logicalPath => logicalPath === heterogeneousPath
      ? { ...resolve(logicalPath), content: '<macros><macro name="helper"><properties/></macro></macros>' }
      : resolve(logicalPath),
  });
  const checks = [
    { name: 'effective numeric values transformed', pass: first.ok && first.rows.length === 2 && first.rows.every(row => row.oldValue === '100' && row.newValue === '150') },
    { name: 'plan hash deterministic', pass: first.planHash === second.planHash },
    { name: 'rerun replaces owned blocks without duplication', pass: rerun.length === 2 && JSON.stringify(merged) === JSON.stringify(rerun) },
    { name: 'manual conflict blocks plan', pass: !conflict.ok && conflict.findings.some(finding => finding.code === 'BULK_PATCH_CONFLICT') },
    { name: 'cap breach blocks all output', pass: !capped.ok && capped.droppedCount === 1 && capped.rows.length === 0 },
    { name: 'nonnumeric match blocks plan', pass: !nonnumeric.ok && nonnumeric.findings.some(finding => finding.code === 'BULK_VALUE_NONNUMERIC') },
    { name: 'rounding quantum reproduces ceil-to-increment transforms', pass: quantum.ok && quantum.rows[0]?.newValue === '200' },
    { name: 'path prefix respects segment boundary', pass: boundary.candidateCount === 2 && boundary.rows.length === 2 },
    { name: 'preview reports every scanned logical file', pass: first.files.length === first.candidateCount && first.files.every(file => file.status === 'matched' && file.matchCount === 1) },
    { name: 'heterogeneous scopes report per-file skips without blocking clean matches', pass: heterogeneous.ok && heterogeneous.candidateCount === 3 && heterogeneous.matchedFiles === 2 && heterogeneous.skippedFiles === 1 && heterogeneous.files.find(file => file.targetFile === heterogeneousPath)?.status === 'skipped' },
    { name: 'simulation proves every emitted diff', pass: first.rows.every(row => row.simulationOk) },
  ];
  const passed = checks.filter(check => check.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}
