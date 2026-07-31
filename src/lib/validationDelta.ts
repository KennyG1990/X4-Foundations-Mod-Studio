import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { atomicWriteJson } from './workspaceState';

export const VALIDATION_BASELINE_SCHEMA = 1 as const;
export const VALIDATION_BASELINE_MAX_MODS = 128;
export const VALIDATION_BASELINE_MAX_WARNINGS = 2_000;
export const VALIDATION_DELTA_SAMPLE_LIMIT = 12;

export interface ValidationWarningInput {
  severity?: string;
  code?: string;
  filePath?: string;
  sourceRef?: unknown;
  line?: number;
  message?: string;
}

export interface ValidationProjectFileInput {
  path: string;
  content?: string;
}

export interface StoredValidationWarning {
  identity: string;
  code: string;
  filePath: string;
  sourceRef: string;
  line?: number;
  message: string;
}

export interface ValidationBaselineSnapshot {
  schemaVersion: typeof VALIDATION_BASELINE_SCHEMA;
  modId: string;
  contentHash: string;
  recordedAt: string;
  warnings: StoredValidationWarning[];
}

interface ValidationBaselineDocument {
  schemaVersion: typeof VALIDATION_BASELINE_SCHEMA;
  baselines: Record<string, ValidationBaselineSnapshot>;
}

export type ValidationBaselineRead =
  | { status: 'missing' }
  | { status: 'available'; snapshot: ValidationBaselineSnapshot }
  | { status: 'unavailable'; reason: string };

export interface ValidationDeltaResult {
  status: 'compared' | 'no_baseline' | 'unavailable';
  modId: string;
  currentContentHash: string;
  baseline: {
    status: 'available' | 'missing' | 'unavailable';
    contentHash?: string;
    recordedAt?: string;
    reason?: string;
  };
  counts: {
    current: number;
    baseline: number;
    new: number;
    resolved: number;
    unchanged: number;
  };
  newWarnings: StoredValidationWarning[];
  resolvedWarnings: StoredValidationWarning[];
}

function normalizeModId(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizePath(value: string | undefined): string {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function sourceRefText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.label === 'string') return record.label.trim();
  }
  return '';
}

function boundedText(value: unknown, max: number): string {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Hash the exact validation subject independently of array order or Windows path spelling. */
export function validationProjectContentHash(files: ValidationProjectFileInput[]): string {
  const rows = files.map(file => ({
    path: normalizePath(file.path),
    contentHash: sha256(String(file.content || '')),
  })).sort((left, right) => left.path.localeCompare(right.path) || left.contentHash.localeCompare(right.contentHash));
  return sha256(JSON.stringify(rows));
}

export function canonicalValidationWarnings(diagnostics: ValidationWarningInput[]): StoredValidationWarning[] {
  const byIdentity = new Map<string, StoredValidationWarning>();
  for (const finding of diagnostics) {
    if (String(finding.severity || '').toLowerCase() !== 'warning') continue;
    const code = boundedText(finding.code || 'validation.warning', 160).toLowerCase();
    const filePath = normalizePath(finding.filePath);
    const sourceRef = boundedText(sourceRefText(finding.sourceRef), 300);
    const line = Number.isSafeInteger(finding.line) && Number(finding.line) > 0 ? Number(finding.line) : undefined;
    const fullMessage = boundedText(finding.message, 4_000);
    const identity = sha256(JSON.stringify({ code, filePath, sourceRef, line: line || 0, message: fullMessage }));
    if (!byIdentity.has(identity)) {
      byIdentity.set(identity, {
        identity,
        code,
        filePath,
        sourceRef,
        ...(line ? { line } : {}),
        message: fullMessage.slice(0, 500),
      });
    }
  }
  return [...byIdentity.values()].sort((left, right) => left.identity.localeCompare(right.identity));
}

export function createValidationBaselineSnapshot(
  modIdInput: string,
  contentHash: string,
  diagnostics: ValidationWarningInput[],
  recordedAt = new Date().toISOString(),
): ValidationBaselineSnapshot {
  const modId = normalizeModId(modIdInput);
  if (!modId) throw new Error('Validation baseline requires a non-empty mod id.');
  if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error('Validation baseline requires a SHA-256 content hash.');
  const warnings = canonicalValidationWarnings(diagnostics);
  if (warnings.length > VALIDATION_BASELINE_MAX_WARNINGS) {
    throw new Error(`Validation baseline has ${warnings.length} warnings; maximum is ${VALIDATION_BASELINE_MAX_WARNINGS}. No baseline was recorded.`);
  }
  if (!Number.isFinite(Date.parse(recordedAt))) throw new Error('Validation baseline recordedAt must be an ISO timestamp.');
  return { schemaVersion: VALIDATION_BASELINE_SCHEMA, modId, contentHash, recordedAt, warnings };
}

export function compareValidationWarnings(
  modIdInput: string,
  contentHash: string,
  diagnostics: ValidationWarningInput[],
  baselineRead: ValidationBaselineRead,
): ValidationDeltaResult {
  const modId = normalizeModId(modIdInput);
  const current = canonicalValidationWarnings(diagnostics);
  const common = {
    modId,
    currentContentHash: contentHash,
    newWarnings: [] as StoredValidationWarning[],
    resolvedWarnings: [] as StoredValidationWarning[],
  };
  if (baselineRead.status === 'missing') {
    return {
      ...common,
      status: 'no_baseline',
      baseline: { status: 'missing' },
      counts: { current: current.length, baseline: 0, new: 0, resolved: 0, unchanged: 0 },
    };
  }
  if (baselineRead.status === 'unavailable') {
    return {
      ...common,
      status: 'unavailable',
      baseline: { status: 'unavailable', reason: baselineRead.reason },
      counts: { current: current.length, baseline: 0, new: 0, resolved: 0, unchanged: 0 },
    };
  }
  const baseline = baselineRead.snapshot.warnings;
  const currentById = new Map(current.map(warning => [warning.identity, warning]));
  const baselineById = new Map(baseline.map(warning => [warning.identity, warning]));
  const added = current.filter(warning => !baselineById.has(warning.identity));
  const resolved = baseline.filter(warning => !currentById.has(warning.identity));
  return {
    ...common,
    status: 'compared',
    baseline: {
      status: 'available',
      contentHash: baselineRead.snapshot.contentHash,
      recordedAt: baselineRead.snapshot.recordedAt,
    },
    counts: {
      current: current.length,
      baseline: baseline.length,
      new: added.length,
      resolved: resolved.length,
      unchanged: current.length - added.length,
    },
    newWarnings: added.slice(0, VALIDATION_DELTA_SAMPLE_LIMIT),
    resolvedWarnings: resolved.slice(0, VALIDATION_DELTA_SAMPLE_LIMIT),
  };
}

function isStoredWarning(value: unknown): value is StoredValidationWarning {
  if (!value || typeof value !== 'object') return false;
  const warning = value as Record<string, unknown>;
  return typeof warning.identity === 'string' && /^[a-f0-9]{64}$/.test(warning.identity)
    && typeof warning.code === 'string' && typeof warning.filePath === 'string'
    && typeof warning.sourceRef === 'string' && typeof warning.message === 'string'
    && (warning.line === undefined || (Number.isSafeInteger(warning.line) && Number(warning.line) > 0));
}

function isSnapshot(value: unknown, key: string): value is ValidationBaselineSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Record<string, unknown>;
  return snapshot.schemaVersion === VALIDATION_BASELINE_SCHEMA
    && snapshot.modId === key
    && typeof snapshot.contentHash === 'string' && /^[a-f0-9]{64}$/.test(snapshot.contentHash)
    && typeof snapshot.recordedAt === 'string' && Number.isFinite(Date.parse(snapshot.recordedAt))
    && Array.isArray(snapshot.warnings) && snapshot.warnings.length <= VALIDATION_BASELINE_MAX_WARNINGS
    && snapshot.warnings.every(isStoredWarning);
}

function parseDocument(file: string): { ok: true; document: ValidationBaselineDocument } | { ok: false; reason: string } {
  if (!fs.existsSync(file)) return { ok: true, document: { schemaVersion: VALIDATION_BASELINE_SCHEMA, baselines: {} } };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    if (parsed?.schemaVersion !== VALIDATION_BASELINE_SCHEMA || !parsed.baselines || typeof parsed.baselines !== 'object' || Array.isArray(parsed.baselines)) {
      return { ok: false, reason: `Validation baseline store has an unsupported or malformed schema: ${file}` };
    }
    const entries = Object.entries(parsed.baselines as Record<string, unknown>);
    if (entries.length > VALIDATION_BASELINE_MAX_MODS || entries.some(([key, value]) => key !== normalizeModId(key) || !isSnapshot(value, key))) {
      return { ok: false, reason: `Validation baseline store failed integrity checks: ${file}` };
    }
    return { ok: true, document: parsed as unknown as ValidationBaselineDocument };
  } catch {
    return { ok: false, reason: `Validation baseline store could not be read: ${file}` };
  }
}

export class ValidationBaselineStore {
  constructor(private readonly file: string) {}

  read(modIdInput: string): ValidationBaselineRead {
    const parsed = parseDocument(this.file);
    if ('reason' in parsed) return { status: 'unavailable', reason: parsed.reason };
    const snapshot = parsed.document.baselines[normalizeModId(modIdInput)];
    return snapshot ? { status: 'available', snapshot } : { status: 'missing' };
  }

  record(snapshot: ValidationBaselineSnapshot): void {
    const parsed = parseDocument(this.file);
    if ('reason' in parsed) throw new Error(`${parsed.reason} No baseline was recorded.`);
    const key = normalizeModId(snapshot.modId);
    const exists = Boolean(parsed.document.baselines[key]);
    if (!exists && Object.keys(parsed.document.baselines).length >= VALIDATION_BASELINE_MAX_MODS) {
      throw new Error(`Validation baseline store already contains ${VALIDATION_BASELINE_MAX_MODS} mods. No baseline was recorded.`);
    }
    const next: ValidationBaselineDocument = {
      schemaVersion: VALIDATION_BASELINE_SCHEMA,
      baselines: { ...parsed.document.baselines, [key]: snapshot },
    };
    atomicWriteJson(this.file, next);
  }
}

export function runValidationDeltaSelftest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-validation-delta-'));
  try {
    const storeFile = path.join(tempRoot, 'baselines.json');
    const store = new ValidationBaselineStore(storeFile);
    const filesA = [{ path: 'MD\\Main.xml', content: '<mdscript />' }, { path: 'content.xml', content: '<content />' }];
    const filesAReordered = [...filesA].reverse().map(file => ({ ...file, path: file.path.toLowerCase().replace(/\\/g, '/') }));
    const hashA = validationProjectContentHash(filesA);
    const warningA = { severity: 'warning', code: 'XSD.Test', filePath: 'MD\\Main.xml', line: 4, message: 'Test warning' };
    const snapshot = createValidationBaselineSnapshot('Example_Mod', hashA, [warningA], '2026-07-30T12:00:00.000Z');
    const missingBeforeCorruption = store.read('other_mod');
    store.record(snapshot);
    const same = compareValidationWarnings('example_mod', validationProjectContentHash(filesAReordered), [warningA], store.read('EXAMPLE_MOD'));
    const changed = compareValidationWarnings('example_mod', hashA, [
      { ...warningA, message: 'Changed warning' },
      { severity: 'warning', code: 'new.warning', filePath: './ui/test.lua', message: 'New' },
    ], store.read('example_mod'));
    fs.writeFileSync(storeFile, '{broken', 'utf8');
    const corrupt = store.read('example_mod');
    let corruptWriteRejected = false;
    try { store.record(snapshot); } catch { corruptWriteRejected = true; }
    const checks = [
      { name: 'content hash ignores order, slash, and path case', pass: hashA === validationProjectContentHash(filesAReordered) },
      { name: 'stored baseline is compared', pass: same.status === 'compared' && same.counts.unchanged === 1 && same.counts.new === 0 },
      { name: 'changed and added warnings are new and old warning resolves', pass: changed.counts.new === 2 && changed.counts.resolved === 1 },
      { name: 'different mod has no baseline', pass: missingBeforeCorruption.status === 'missing' },
      { name: 'corrupt store is unavailable', pass: corrupt.status === 'unavailable' },
      { name: 'corrupt store refuses overwrite', pass: corruptWriteRejected },
    ];
    return { pass: checks.every(check => check.pass), checks };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
