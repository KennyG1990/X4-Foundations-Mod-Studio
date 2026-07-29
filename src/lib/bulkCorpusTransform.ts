/** Deterministic bulk numeric transforms over effective, read-only X4 XML documents. */

import crypto from 'crypto';
import { DOMParser } from '@xmldom/xmldom';
import * as xpath from 'xpath';
import { simulateXmlDiff } from './diffSimulator';
import type { EffectiveReferenceDocument } from './referenceOverlay';
import type { PatchBlock } from '../types';

export type BulkTransformOperation = 'multiply' | 'add' | 'set' | 'round' | 'min' | 'max' | 'clamp';
export interface BulkTransformOperationRule {
  id: string;
  selector: string;
  operation: BulkTransformOperation;
  operand: number | [number, number];
  rounding?: 'none' | 'round' | 'floor' | 'ceil';
  roundingIncrement?: number;
}
export interface BulkTransformRule {
  pathPrefix: string;
  /** Legacy single-operation fields remain accepted for API/client compatibility. */
  selector: string;
  operation: BulkTransformOperation;
  operand: number | [number, number];
  rounding?: 'none' | 'round' | 'floor' | 'ceil';
  /** Positive rounding quantum; 1 preserves the original whole-unit behavior. */
  roundingIncrement?: number;
  maxFiles: number;
  operations?: BulkTransformOperationRule[];
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
  changes?: Array<{ operationId: string; selector: string; oldValue: string; newValue: string }>;
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
  const supplied = Array.isArray(rule.operations) && rule.operations.length
    ? rule.operations
    : [{
        id: 'operation-1', selector: rule.selector, operation: rule.operation, operand: rule.operand,
        rounding: rule.rounding, roundingIncrement: rule.roundingIncrement,
      }];
  const operations = supplied.map((operation, index) => ({
    id: String(operation.id || `operation-${index + 1}`).trim(),
    selector: String(operation.selector || '').trim(),
    operation: operation.operation,
    operand: Array.isArray(operation.operand) ? [operation.operand[0], operation.operand[1]] as [number, number] : operation.operand,
    rounding: operation.rounding || 'none' as const,
    roundingIncrement: operation.roundingIncrement === undefined ? 1 : operation.roundingIncrement,
  }));
  const first = operations[0];
  return {
    pathPrefix: normalizedPath(rule.pathPrefix).replace(/\/+$/, ''),
    selector: first?.selector || '',
    operation: first?.operation || rule.operation,
    operand: first?.operand ?? rule.operand,
    rounding: first?.rounding || 'none',
    roundingIncrement: first?.roundingIncrement ?? 1,
    maxFiles: rule.maxFiles,
    operations,
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
  if (!Number.isInteger(rule.maxFiles) || rule.maxFiles < 1 || rule.maxFiles > 500) findings.push({ severity: 'error', code: 'BULK_CAP_INVALID', message: 'maxFiles must be an integer from 1 to 500.' });
  const operations = rule.operations || [];
  if (!operations.length || operations.length > 16) findings.push({ severity: 'error', code: 'BULK_OPERATION_COUNT_INVALID', message: 'A bundle requires 1 to 16 numeric operations.' });
  const duplicateSelectors = operations.map(operation => operation.selector).filter((selector, index, all) => selector && all.indexOf(selector) !== index);
  if (duplicateSelectors.length) findings.push({ severity: 'error', code: 'BULK_SELECTOR_DUPLICATE', message: `A bundle cannot target the same selector twice: ${[...new Set(duplicateSelectors)].join(', ')}` });
  const duplicateIds = operations.map(operation => operation.id).filter((id, index, all) => id && all.indexOf(id) !== index);
  if (duplicateIds.length) findings.push({ severity: 'error', code: 'BULK_OPERATION_ID_DUPLICATE', message: 'Each operation row must have a unique id.' });
  for (const operation of operations) {
    if (!operation.id) findings.push({ severity: 'error', code: 'BULK_OPERATION_ID_INVALID', message: 'Each operation row requires an id.' });
    if (!operation.selector || operation.selector.length > 16_384) findings.push({ severity: 'error', code: 'BULK_SELECTOR_INVALID', message: 'Every selector must be non-empty and at most 16 KB.' });
    if (!Number.isFinite(Number(operation.roundingIncrement)) || Number(operation.roundingIncrement) <= 0) {
      findings.push({ severity: 'error', code: 'BULK_ROUNDING_INCREMENT_INVALID', message: `Operation ${operation.id} needs a positive finite rounding increment.` });
    }
    if (!['multiply', 'add', 'set', 'round', 'min', 'max', 'clamp'].includes(operation.operation)) findings.push({ severity: 'error', code: 'BULK_OPERATION_INVALID', message: `Unsupported operation: ${String(operation.operation)}` });
    if (operation.operation === 'clamp') {
      if (!Array.isArray(operation.operand) || operation.operand.length !== 2 || !operation.operand.every(Number.isFinite) || operation.operand[0] > operation.operand[1]) {
        findings.push({ severity: 'error', code: 'BULK_OPERAND_INVALID', message: `Operation ${operation.id}: clamp requires [minimum, maximum] finite operands with minimum <= maximum.` });
      }
    } else if (operation.operation !== 'round' && (Array.isArray(operation.operand) || !Number.isFinite(operation.operand))) {
      findings.push({ severity: 'error', code: 'BULK_OPERAND_INVALID', message: `Operation ${operation.id}: ${operation.operation} requires one finite numeric operand.` });
    }
  }
  return findings;
}

function transformed(value: number, rule: BulkTransformOperationRule): number {
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

function diffFor(changes: Array<{ selector: string; newValue: string }>): string {
  const operations = changes.map(change => `  <replace sel="${xmlAttr(change.selector)}">${xmlText(change.newValue)}</replace>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<diff>\n${operations}\n</diff>`;
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
    const operationResults = (rule.operations || []).map(operation => ({ operation, selected: selectedNumericValue(effective.content!, operation.selector) }));
    const totalMatches = operationResults.reduce((sum, result) => sum + result.selected.count, 0);
    if (operationResults.every(result => result.selected.count === 0 && !result.selected.error)) {
      skippedFiles++;
      files.push({ targetFile, status: 'skipped', matchCount: 0, sources: effective.sources, sourceSignature: effective.signature, findings: [] });
      continue;
    }
    const fileFindings: BulkTransformFinding[] = [];
    for (const result of operationResults) {
      const label = result.operation.id || result.operation.selector;
      if (result.selected.error) fileFindings.push({ severity: 'error', code: 'BULK_SELECTOR_INVALID', path: targetFile, message: `${label}: ${result.selected.error}` });
      else if (result.selected.count === 0) fileFindings.push({ severity: 'error', code: 'BULK_BUNDLE_PARTIAL_MATCH', path: targetFile, message: `${label}: selector matched 0 nodes while another operation matched; partial file transforms are forbidden.` });
      else if (result.selected.count !== 1) fileFindings.push({ severity: 'error', code: 'BULK_SELECTOR_AMBIGUOUS', path: targetFile, message: `${label}: selector matched ${result.selected.count} nodes; each bundled operation requires exactly one numeric node per logical file.` });
      else if (!Number.isFinite(Number(result.selected.value))) fileFindings.push({ severity: 'error', code: 'BULK_VALUE_NONNUMERIC', path: targetFile, message: `${label}: matched value is not numeric: ${result.selected.value}` });
    }
    if (fileFindings.length) {
      findings.push(...fileFindings);
      files.push({ targetFile, status: 'error', matchCount: totalMatches, sources: effective.sources, sourceSignature: effective.signature, findings: fileFindings });
      continue;
    }
    const changes: Array<{ operationId: string; selector: string; oldValue: string; newValue: string; operation: BulkTransformOperation }> = [];
    try {
      for (const result of operationResults) {
        const oldValue = result.selected.value!;
        changes.push({
          operationId: result.operation.id,
          selector: result.operation.selector,
          oldValue,
          newValue: formatNumber(transformed(Number(oldValue), result.operation)),
          operation: result.operation.operation,
        });
      }
    } catch (error) {
      const finding = { severity: 'error' as const, code: 'BULK_TRANSFORM_FAILED', path: targetFile, message: error instanceof Error ? error.message : String(error) };
      findings.push(finding);
      files.push({ targetFile, status: 'error', matchCount: totalMatches, sources: effective.sources, sourceSignature: effective.signature, findings: [finding] });
      continue;
    }
    const simulation = simulateXmlDiff(effective.content, diffFor(changes));
    const rowFindings: BulkTransformFinding[] = simulation.findings.map(finding => ({
      severity: finding.severity, code: finding.code, message: finding.message, path: targetFile,
    }));
    if (!simulation.ok) findings.push(...rowFindings.filter(finding => finding.severity === 'error'));
    files.push({
      targetFile, status: simulation.ok ? 'matched' : 'error', matchCount: changes.length,
      oldValue: changes[0]?.oldValue, newValue: changes[0]?.newValue, sourceSignature: effective.signature,
      sources: effective.sources, simulationOk: simulation.ok, findings: rowFindings,
      changes: changes.map(({ operationId, selector, oldValue, newValue }) => ({ operationId, selector, oldValue, newValue })),
    });
    for (const change of changes) rows.push({
        targetFile, selector: change.selector, oldValue: change.oldValue, newValue: change.newValue,
        sourceSignature: effective.signature, sources: effective.sources, simulationOk: simulation.ok,
        findings: rowFindings,
        patch: {
          id: `bulk_${ruleId.slice(0, 12)}_${rows.length + 1}`,
          sel: change.selector, action: 'replace', content: change.newValue,
          note: `Bulk bundle ${change.operation} from canonical value ${change.oldValue}`,
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
    candidateCount: logicalPaths.length, matchedFiles: files.filter(file => file.status === 'matched').length, skippedFiles, droppedCount,
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
  const base = '<macros><macro name="fixture_macro" class="ship"><properties><recharge max="200" rate="10" delay="5" disruptionstability="2"/><hull max="100"/></properties></macro></macros>';
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
  const bundleRule: BulkTransformRule = {
    ...rule,
    operations: [
      { id: 'recharge-max', selector: '/macros/macro/properties/recharge/@max', operation: 'multiply', operand: 1.5 },
      { id: 'recharge-rate', selector: '/macros/macro/properties/recharge/@rate', operation: 'add', operand: 5 },
      { id: 'recharge-delay', selector: '/macros/macro/properties/recharge/@delay', operation: 'set', operand: 8 },
      { id: 'recharge-stability', selector: '/macros/macro/properties/recharge/@disruptionstability', operation: 'max', operand: 4 },
      { id: 'hull-max', selector: '/macros/macro/properties/hull/@max', operation: 'multiply', operand: 2 },
    ],
  };
  const bundle = createBulkTransformPlan({ rule: bundleRule, logicalPaths: [paths[0]], corpusGeneration: 'g1', resolve });
  const partialBundle = createBulkTransformPlan({
    rule: bundleRule,
    logicalPaths: [paths[0]],
    corpusGeneration: 'g1',
    resolve: logicalPath => ({ ...resolve(logicalPath), content: '<macros><macro><properties><hull max="100"/></properties></macro></macros>' }),
  });
  const duplicateBundle = createBulkTransformPlan({
    rule: { ...bundleRule, operations: [...bundleRule.operations!, { ...bundleRule.operations![0], id: 'duplicate' }] },
    logicalPaths: [paths[0]], corpusGeneration: 'g1', resolve,
  });
  const mergedBundle = bundle.ok ? mergeBulkTransformPatches([], bundle) : [];
  const rerunBundle = bundle.ok ? mergeBulkTransformPatches(mergedBundle, bundle) : [];
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
    { name: 'five-operation bundle simulates and emits five owned patches atomically', pass: bundle.ok && bundle.matchedFiles === 1 && bundle.rows.length === 5 && bundle.files[0]?.changes?.length === 5 },
    { name: 'partial bundle match blocks all applyable output', pass: !partialBundle.ok && partialBundle.findings.some(finding => finding.code === 'BULK_BUNDLE_PARTIAL_MATCH') },
    { name: 'duplicate bundle selectors are rejected', pass: !duplicateBundle.ok && duplicateBundle.findings.some(finding => finding.code === 'BULK_SELECTOR_DUPLICATE') },
    { name: 'bundle rerun replaces all owned operations without duplication', pass: mergedBundle.length === 5 && JSON.stringify(mergedBundle) === JSON.stringify(rerunBundle) },
  ];
  const passed = checks.filter(check => check.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}
