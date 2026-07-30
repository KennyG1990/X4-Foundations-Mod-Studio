/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mod-local validation truth (`forge.rules.json`). This is deliberately a strict,
 * pure policy engine. The shared project validator supplies observed evidence and
 * this module decides whether declarations are valid, satisfied, or allowed to
 * suppress an exact WARNING. Errors are never suppressible.
 */

import type { ExtensionProject } from './extensionProject';

export const PROJECT_RULES_PATH = 'forge.rules.json';
export const PROJECT_RULES_VERSION = 1 as const;
export const PROJECT_RULES_MAX_BYTES = 256 * 1024;
export const PROJECT_RULES_MAX_ITEMS = 256;
export const PROJECT_RULES_MAX_REVIEW_DAYS = 366;

export interface ReviewedRule {
  id: string;
  owner: string;
  reason: string;
  reviewBy: string;
}

export interface WarningSuppressionRule extends ReviewedRule {
  code: string;
  file?: string;
  sourceRef?: string;
}

export interface KnownChainRule extends ReviewedRule {
  chain: string;
  file?: string;
}

export interface WireKeyRule {
  id: string;
  key: string;
  scope: 'global' | 'verb';
  requireReader: boolean;
  requireWriter: boolean;
  reason: string;
}

export interface ExpectedRegisterRule {
  id: string;
  event: string;
  file?: string;
  reason: string;
}

export interface ProjectRulesV1 {
  version: 1;
  suppressions: WarningSuppressionRule[];
  contracts: {
    knownChains: KnownChainRule[];
    wireKeys: WireKeyRule[];
    expectedRegisters: ExpectedRegisterRule[];
  };
}

export interface ProjectRuleFinding {
  severity: 'error';
  code: string;
  filePath: typeof PROJECT_RULES_PATH;
  sourceRef?: string;
  message: string;
}

export interface RuleDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  code?: string;
  filePath?: string;
  sourceRef?: string;
  line?: number;
}

export interface ProjectRuleEvidence {
  registered: Array<{ event: string; file: string; prefix?: boolean }>;
  payloadReads: Array<{ key: string; scope: 'global' | 'verb'; file: string; destination: string }>;
  payloadWrites: Array<{ key: string; file: string }>;
}

export interface ProjectRuleMatch {
  ruleId: string;
  kind: 'wireKey' | 'expectedRegister';
  evidence: string[];
}

export interface SuppressedProjectDiagnostic {
  ruleId: string;
  ruleKind: 'suppression' | 'knownChain';
  rulePath: typeof PROJECT_RULES_PATH;
  diagnostic: RuleDiagnostic;
}

export interface ProjectRulesEvaluation {
  present: boolean;
  valid: boolean;
  version?: number;
  config?: ProjectRulesV1;
  findings: ProjectRuleFinding[];
  matches: ProjectRuleMatch[];
  unmatched: Array<{ ruleId: string; kind: 'suppression' | 'knownChain' }>;
  suppressed: SuppressedProjectDiagnostic[];
  rawWarnings: number;
  activeWarnings: number;
}

const ROOT_KEYS = new Set(['$schema', 'version', 'suppressions', 'contracts']);
const CONTRACT_KEYS = new Set(['knownChains', 'wireKeys', 'expectedRegisters']);
const REVIEWED_KEYS = ['id', 'owner', 'reason', 'reviewBy'] as const;
const ID_RE = /^[a-z][a-z0-9._-]{2,63}$/;
const CODE_RE = /^[A-Za-z0-9_.-]{2,128}$/;
const WIRE_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizedPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function dayNumber(value: string): number | null {
  if (!DATE_RE.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) return null;
  return Math.floor(parsed / 86_400_000);
}

function utcToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function validProjectPath(value: string): boolean {
  if (!value || value.length > 512 || value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
  const parts = value.split('/');
  return parts.every(part => part.length > 0 && part !== '.' && part !== '..');
}

function error(code: string, message: string, sourceRef?: string): ProjectRuleFinding {
  return { severity: 'error', code, filePath: PROJECT_RULES_PATH, ...(sourceRef ? { sourceRef } : {}), message };
}

function unknownKeys(value: Record<string, unknown>, allowed: Set<string>, at: string, findings: ProjectRuleFinding[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) findings.push(error('rules.unknown_property', `${at} contains unsupported property "${key}".`, at));
  }
}

function requiredString(value: Record<string, unknown>, key: string, at: string, findings: ProjectRuleFinding[], min: number, max: number): string {
  const raw = value[key];
  if (typeof raw !== 'string' || raw.trim().length < min || raw.trim().length > max) {
    findings.push(error('rules.invalid_value', `${at}.${key} must be a string of ${min}-${max} characters.`, at));
    return '';
  }
  return raw.trim();
}

function parseReviewed(value: Record<string, unknown>, at: string, findings: ProjectRuleFinding[], now: Date): ReviewedRule {
  const id = requiredString(value, 'id', at, findings, 3, 64);
  const owner = requiredString(value, 'owner', at, findings, 1, 128);
  const reason = requiredString(value, 'reason', at, findings, 8, 512);
  const reviewBy = requiredString(value, 'reviewBy', at, findings, 10, 10);
  if (id && !ID_RE.test(id)) findings.push(error('rules.invalid_id', `${at}.id must match ${ID_RE}.`, id));
  const reviewDay = dayNumber(reviewBy);
  const today = dayNumber(utcToday(now))!;
  if (reviewDay === null) findings.push(error('rules.invalid_review_date', `${at}.reviewBy must be a real YYYY-MM-DD date.`, id || at));
  else if (reviewDay < today) findings.push(error('rules.review_overdue', `${at} expired on ${reviewBy}; review it before it can suppress a warning.`, id || at));
  else if (reviewDay - today > PROJECT_RULES_MAX_REVIEW_DAYS) findings.push(error('rules.review_too_distant', `${at}.reviewBy must be no more than ${PROJECT_RULES_MAX_REVIEW_DAYS} days from today.`, id || at));
  return { id, owner, reason, reviewBy };
}

function parseArray(value: unknown, at: string, findings: ProjectRuleFinding[]): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    findings.push(error('rules.invalid_value', `${at} must be an array.`, at));
    return [];
  }
  if (value.length > PROJECT_RULES_MAX_ITEMS) {
    findings.push(error('rules.too_many_items', `${at} exceeds the ${PROJECT_RULES_MAX_ITEMS}-item limit.`, at));
    return value.slice(0, PROJECT_RULES_MAX_ITEMS);
  }
  return value;
}

function parseProjectRulesValue(value: unknown, now: Date): { config?: ProjectRulesV1; findings: ProjectRuleFinding[] } {
  const findings: ProjectRuleFinding[] = [];
  if (!isPlainObject(value)) return { findings: [error('rules.invalid_root', 'forge.rules.json must contain one JSON object.')] };
  unknownKeys(value, ROOT_KEYS, 'root', findings);
  if (value.version !== PROJECT_RULES_VERSION) {
    findings.push(error('rules.unsupported_version', `version must be ${PROJECT_RULES_VERSION}; received ${JSON.stringify(value.version)}.`, 'version'));
  }
  if (value.$schema !== undefined && (typeof value.$schema !== 'string' || value.$schema.length > 256)) {
    findings.push(error('rules.invalid_value', '$schema must be a string of at most 256 characters.', '$schema'));
  }

  const ids = new Set<string>();
  const claimId = (id: string, at: string) => {
    if (!id) return;
    if (ids.has(id)) findings.push(error('rules.duplicate_id', `Rule id "${id}" is duplicated; IDs must be unique across the file.`, at));
    ids.add(id);
  };

  const suppressions: WarningSuppressionRule[] = [];
  for (const [index, item] of parseArray(value.suppressions, 'suppressions', findings).entries()) {
    const at = `suppressions[${index}]`;
    if (!isPlainObject(item)) { findings.push(error('rules.invalid_value', `${at} must be an object.`, at)); continue; }
    unknownKeys(item, new Set([...REVIEWED_KEYS, 'code', 'file', 'sourceRef']), at, findings);
    const reviewed = parseReviewed(item, at, findings, now);
    claimId(reviewed.id, at);
    const code = requiredString(item, 'code', at, findings, 2, 128);
    if (code && !CODE_RE.test(code)) findings.push(error('rules.invalid_value', `${at}.code is not a valid exact diagnostic code.`, reviewed.id || at));
    const file = item.file === undefined ? undefined : requiredString(item, 'file', at, findings, 1, 512);
    const sourceRef = item.sourceRef === undefined ? undefined : requiredString(item, 'sourceRef', at, findings, 1, 512);
    if (!file && !sourceRef) findings.push(error('rules.overbroad_suppression', `${at} must declare an exact file and/or sourceRef; code-only suppression is forbidden.`, reviewed.id || at));
    if (file && !validProjectPath(file)) findings.push(error('rules.invalid_path', `${at}.file must be a normalized project-relative path without traversal.`, reviewed.id || at));
    suppressions.push({ ...reviewed, code, ...(file ? { file: normalizedPath(file) } : {}), ...(sourceRef ? { sourceRef } : {}) });
  }

  let contractsValue: Record<string, unknown> = {};
  if (value.contracts !== undefined) {
    if (!isPlainObject(value.contracts)) findings.push(error('rules.invalid_value', 'contracts must be an object.', 'contracts'));
    else { contractsValue = value.contracts; unknownKeys(contractsValue, CONTRACT_KEYS, 'contracts', findings); }
  }

  const knownChains: KnownChainRule[] = [];
  for (const [index, item] of parseArray(contractsValue.knownChains, 'contracts.knownChains', findings).entries()) {
    const at = `contracts.knownChains[${index}]`;
    if (!isPlainObject(item)) { findings.push(error('rules.invalid_value', `${at} must be an object.`, at)); continue; }
    unknownKeys(item, new Set([...REVIEWED_KEYS, 'chain', 'file']), at, findings);
    const reviewed = parseReviewed(item, at, findings, now);
    claimId(reviewed.id, at);
    const chain = requiredString(item, 'chain', at, findings, 2, 512);
    const file = item.file === undefined ? undefined : requiredString(item, 'file', at, findings, 1, 512);
    if (file && !validProjectPath(file)) findings.push(error('rules.invalid_path', `${at}.file must be a normalized project-relative path without traversal.`, reviewed.id || at));
    knownChains.push({ ...reviewed, chain, ...(file ? { file: normalizedPath(file) } : {}) });
  }

  const wireKeys: WireKeyRule[] = [];
  for (const [index, item] of parseArray(contractsValue.wireKeys, 'contracts.wireKeys', findings).entries()) {
    const at = `contracts.wireKeys[${index}]`;
    if (!isPlainObject(item)) { findings.push(error('rules.invalid_value', `${at} must be an object.`, at)); continue; }
    unknownKeys(item, new Set(['id', 'key', 'scope', 'requireReader', 'requireWriter', 'reason']), at, findings);
    const id = requiredString(item, 'id', at, findings, 3, 64);
    claimId(id, at);
    if (id && !ID_RE.test(id)) findings.push(error('rules.invalid_id', `${at}.id must match ${ID_RE}.`, id));
    const key = requiredString(item, 'key', at, findings, 1, 64);
    if (key && !WIRE_KEY_RE.test(key)) findings.push(error('rules.invalid_value', `${at}.key must be an exact indexed payload key.`, id || at));
    const scope = item.scope;
    if (scope !== 'global' && scope !== 'verb') findings.push(error('rules.invalid_value', `${at}.scope must be "global" or "verb".`, id || at));
    const reason = requiredString(item, 'reason', at, findings, 8, 512);
    for (const keyName of ['requireReader', 'requireWriter'] as const) {
      if (item[keyName] !== undefined && typeof item[keyName] !== 'boolean') findings.push(error('rules.invalid_value', `${at}.${keyName} must be boolean.`, id || at));
    }
    const requireReader = item.requireReader !== false;
    const requireWriter = item.requireWriter !== false;
    if (!requireReader && !requireWriter) findings.push(error('rules.empty_contract', `${at} must require a reader, a writer, or both.`, id || at));
    wireKeys.push({ id, key, scope: scope === 'verb' ? 'verb' : 'global', requireReader, requireWriter, reason });
  }

  const expectedRegisters: ExpectedRegisterRule[] = [];
  for (const [index, item] of parseArray(contractsValue.expectedRegisters, 'contracts.expectedRegisters', findings).entries()) {
    const at = `contracts.expectedRegisters[${index}]`;
    if (!isPlainObject(item)) { findings.push(error('rules.invalid_value', `${at} must be an object.`, at)); continue; }
    unknownKeys(item, new Set(['id', 'event', 'file', 'reason']), at, findings);
    const id = requiredString(item, 'id', at, findings, 3, 64);
    claimId(id, at);
    if (id && !ID_RE.test(id)) findings.push(error('rules.invalid_id', `${at}.id must match ${ID_RE}.`, id));
    const event = requiredString(item, 'event', at, findings, 1, 256);
    const file = item.file === undefined ? undefined : requiredString(item, 'file', at, findings, 1, 512);
    if (file && !validProjectPath(file)) findings.push(error('rules.invalid_path', `${at}.file must be a normalized project-relative path without traversal.`, id || at));
    const reason = requiredString(item, 'reason', at, findings, 8, 512);
    expectedRegisters.push({ id, event, ...(file ? { file: normalizedPath(file) } : {}), reason });
  }

  const config: ProjectRulesV1 = { version: 1, suppressions, contracts: { knownChains, wireKeys, expectedRegisters } };
  return findings.length ? { findings } : { config, findings };
}

export function parseProjectRules(project: ExtensionProject, opts: { now?: Date } = {}): ProjectRulesEvaluation {
  const files = (project.files || []).filter(file => normalizedPath(file.path).toLowerCase() === PROJECT_RULES_PATH);
  if (files.length === 0) return { present: false, valid: true, findings: [], matches: [], unmatched: [], suppressed: [], rawWarnings: 0, activeWarnings: 0 };
  if (files.length > 1) {
    return { present: true, valid: false, findings: [error('rules.duplicate_file', 'Project contains more than one root forge.rules.json (case-insensitive).')], matches: [], unmatched: [], suppressed: [], rawWarnings: 0, activeWarnings: 0 };
  }
  const raw = files[0].content || '';
  if (Buffer.byteLength(raw, 'utf8') > PROJECT_RULES_MAX_BYTES) {
    return { present: true, valid: false, findings: [error('rules.file_too_large', `forge.rules.json exceeds ${PROJECT_RULES_MAX_BYTES} bytes.`)], matches: [], unmatched: [], suppressed: [], rawWarnings: 0, activeWarnings: 0 };
  }
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch (caught) {
    return { present: true, valid: false, findings: [error('rules.invalid_json', `forge.rules.json is not valid JSON: ${caught instanceof Error ? caught.message : String(caught)}`)], matches: [], unmatched: [], suppressed: [], rawWarnings: 0, activeWarnings: 0 };
  }
  const parsed = parseProjectRulesValue(value, opts.now || new Date());
  return {
    present: true,
    valid: parsed.findings.length === 0,
    version: isPlainObject(value) && typeof value.version === 'number' ? value.version : undefined,
    config: parsed.config,
    findings: parsed.findings,
    matches: [], unmatched: [], suppressed: [], rawWarnings: 0, activeWarnings: 0,
  };
}

export function evaluateProjectRuleContracts(base: ProjectRulesEvaluation, evidence: ProjectRuleEvidence): ProjectRulesEvaluation {
  if (!base.config || !base.valid) return base;
  const findings = [...base.findings];
  const matches: ProjectRuleMatch[] = [];
  for (const rule of base.config.contracts.wireKeys) {
    const readers = evidence.payloadReads.filter(read => read.key === rule.key && read.scope === rule.scope);
    const writers = evidence.payloadWrites.filter(write => write.key === rule.key);
    if (rule.requireReader && readers.length === 0) findings.push(error('rules.wire_key_missing_reader', `Declared wire key "${rule.key}" has no ${rule.scope} MD reader.`, rule.id));
    if (rule.requireWriter && writers.length === 0) findings.push(error('rules.wire_key_missing_writer', `Declared wire key "${rule.key}" has no Lua writer.`, rule.id));
    if ((!rule.requireReader || readers.length) && (!rule.requireWriter || writers.length)) {
      matches.push({ ruleId: rule.id, kind: 'wireKey', evidence: [
        ...readers.map(read => `${read.scope} reader ${read.file}:${read.destination}`),
        ...writers.map(write => `writer ${write.file}`),
      ] });
    }
  }
  for (const rule of base.config.contracts.expectedRegisters) {
    const matched = evidence.registered.filter(register => {
      if (rule.file && normalizedPath(register.file) !== rule.file) return false;
      return register.prefix ? rule.event.startsWith(register.event) : rule.event === register.event;
    });
    if (!matched.length) findings.push(error('rules.expected_register_missing', `Expected Lua registration "${rule.event}"${rule.file ? ` in ${rule.file}` : ''} was not observed by the AST registration scanner.`, rule.id));
    else matches.push({ ruleId: rule.id, kind: 'expectedRegister', evidence: matched.map(register => `${register.file}:${register.event}${register.prefix ? '*' : ''}`) });
  }
  return { ...base, valid: findings.length === 0, findings, matches };
}

export function applyProjectRuleSuppressions(base: ProjectRulesEvaluation, diagnostics: RuleDiagnostic[]): { evaluation: ProjectRulesEvaluation; active: RuleDiagnostic[] } {
  const rawWarnings = diagnostics.filter(diagnostic => diagnostic.severity === 'warning').length;
  if (!base.config || !base.valid) return { evaluation: { ...base, rawWarnings, activeWarnings: rawWarnings }, active: diagnostics };
  const suppressed: SuppressedProjectDiagnostic[] = [];
  const matchedIds = new Set<string>();
  const active = diagnostics.filter(diagnostic => {
    if (diagnostic.severity !== 'warning') return true;
    for (const rule of base.config!.suppressions) {
      if (diagnostic.code !== rule.code) continue;
      if (rule.file && normalizedPath(diagnostic.filePath || '') !== rule.file) continue;
      if (rule.sourceRef && diagnostic.sourceRef !== rule.sourceRef) continue;
      suppressed.push({ ruleId: rule.id, ruleKind: 'suppression', rulePath: PROJECT_RULES_PATH, diagnostic: { ...diagnostic } });
      matchedIds.add(rule.id);
      return false;
    }
    if (diagnostic.code?.startsWith('scriptproperty.')) {
      for (const rule of base.config!.contracts.knownChains) {
        if (diagnostic.sourceRef !== rule.chain) continue;
        if (rule.file && normalizedPath(diagnostic.filePath || '') !== rule.file) continue;
        suppressed.push({ ruleId: rule.id, ruleKind: 'knownChain', rulePath: PROJECT_RULES_PATH, diagnostic: { ...diagnostic } });
        matchedIds.add(rule.id);
        return false;
      }
    }
    return true;
  });
  const unmatched = [
    ...base.config.suppressions.filter(rule => !matchedIds.has(rule.id)).map(rule => ({ ruleId: rule.id, kind: 'suppression' as const })),
    ...base.config.contracts.knownChains.filter(rule => !matchedIds.has(rule.id)).map(rule => ({ ruleId: rule.id, kind: 'knownChain' as const })),
  ];
  return {
    evaluation: { ...base, suppressed, unmatched, rawWarnings, activeWarnings: active.filter(diagnostic => diagnostic.severity === 'warning').length },
    active,
  };
}

function projectWithRules(value: unknown): ExtensionProject {
  return { id: 'rules-test', name: 'rules-test', files: [{ path: PROJECT_RULES_PATH, kind: 'other', content: JSON.stringify(value) }] };
}

export function runProjectRulesSelftest(): { allPassed: boolean; pass: boolean; passed: number; total: number; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const check = (name: string, condition: unknown, detail?: unknown) => checks.push({ name, pass: !!condition, ...(detail === undefined ? {} : { detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }) });
  const now = new Date('2026-07-30T12:00:00Z');
  const reviewed = { owner: 'maintainer', reason: 'Observed valid in the project runtime.', reviewBy: '2027-07-30' };
  const config = {
    version: 1,
    suppressions: [{ id: 'known-dynamic-listener', ...reviewed, code: 'lua_md.missing_listener', file: 'ui/main.lua', sourceRef: 'mod.log_' }],
    contracts: {
      knownChains: [{ id: 'known-cargo-chain', ...reviewed, chain: '$ship.cargo.free.all', file: 'md/main.xml' }],
      wireKeys: [{ id: 'wire-offer', key: 'offer', scope: 'global', reason: 'Offer is present for every indexed step.' }],
      expectedRegisters: [{ id: 'register-chat', event: 'mod.chat.open', file: 'ui/main.lua', reason: 'MD raises this exact UI bridge event.' }],
    },
  };
  const parsed = parseProjectRules(projectWithRules(config), { now });
  check('valid v1 parses', parsed.valid && parsed.version === 1, parsed.findings);
  const evaluated = evaluateProjectRuleContracts(parsed, {
    registered: [{ event: 'mod.chat.', file: 'ui/main.lua', prefix: true }],
    payloadReads: [{ key: 'offer', scope: 'global', file: 'md/main.xml', destination: '$offer' }],
    payloadWrites: [{ key: 'offer', file: 'ui/main.lua' }],
  });
  check('wire and dynamic-prefix register contracts match with provenance', evaluated.valid && evaluated.matches.length === 2, evaluated);
  const diagnostics: RuleDiagnostic[] = [
    { severity: 'warning', code: 'lua_md.missing_listener', filePath: 'ui/main.lua', sourceRef: 'mod.log_', message: 'dynamic listener' },
    { severity: 'warning', code: 'scriptproperty.unknown', filePath: 'md/main.xml', sourceRef: '$ship.cargo.free.all', message: 'known chain' },
    { severity: 'warning', code: 'scriptproperty.unknown', filePath: 'md/other.xml', sourceRef: '$ship.cargo.free.all', message: 'wrong file' },
    { severity: 'error', code: 'lua_md.missing_listener', filePath: 'ui/main.lua', sourceRef: 'mod.log_', message: 'error is sacred' },
  ];
  const applied = applyProjectRuleSuppressions(evaluated, diagnostics);
  check('exact warnings suppress and preserve provenance', applied.evaluation.suppressed.length === 2 && applied.evaluation.suppressed.every(item => item.rulePath === PROJECT_RULES_PATH), applied.evaluation.suppressed);
  check('wrong-file warning remains active', applied.active.some(item => item.message === 'wrong file'));
  check('errors cannot be suppressed', applied.active.some(item => item.severity === 'error' && item.message === 'error is sacred'));
  check('active/raw counts are honest', applied.evaluation.rawWarnings === 3 && applied.evaluation.activeWarnings === 1, applied.evaluation);
  const absent = parseProjectRules({ id: 'none', name: 'none', files: [] }, { now });
  check('missing file is valid no-op', !absent.present && absent.valid);
  const malformed = parseProjectRules({ id: 'bad', name: 'bad', files: [{ path: PROJECT_RULES_PATH, kind: 'other', content: '{' }] }, { now });
  check('invalid JSON fails closed', malformed.findings.some(item => item.code === 'rules.invalid_json'));
  const expired = parseProjectRules(projectWithRules({ version: 1, suppressions: [{ id: 'expired-rule', ...reviewed, reviewBy: '2026-07-29', code: 'x.warning', file: 'md/main.xml' }] }), { now });
  check('expired review fails closed', expired.findings.some(item => item.code === 'rules.review_overdue'));
  const tooFar = parseProjectRules(projectWithRules({ version: 1, suppressions: [{ id: 'distant-rule', ...reviewed, reviewBy: '2028-01-01', code: 'x.warning', file: 'md/main.xml' }] }), { now });
  check('review horizon is bounded', tooFar.findings.some(item => item.code === 'rules.review_too_distant'));
  const broad = parseProjectRules(projectWithRules({ version: 1, suppressions: [{ id: 'broad-rule', ...reviewed, code: 'x.warning' }] }), { now });
  check('code-only suppression rejected', broad.findings.some(item => item.code === 'rules.overbroad_suppression'));
  const unknown = parseProjectRules(projectWithRules({ version: 1, mystery: true }), { now });
  check('unknown property rejected', unknown.findings.some(item => item.code === 'rules.unknown_property'));
  const duplicate = parseProjectRules(projectWithRules({ version: 1, suppressions: [{ id: 'duplicate-rule', ...reviewed, code: 'x.warning', file: 'md/main.xml' }], contracts: { expectedRegisters: [{ id: 'duplicate-rule', event: 'x', reason: 'Must exist in project Lua.' }] } }), { now });
  check('ids unique across declaration kinds', duplicate.findings.some(item => item.code === 'rules.duplicate_id'));
  const unsupported = parseProjectRules(projectWithRules({ version: 2 }), { now });
  check('unsupported version rejected', unsupported.findings.some(item => item.code === 'rules.unsupported_version'));
  const missingEvidence = evaluateProjectRuleContracts(parsed, { registered: [], payloadReads: [{ key: 'offer', scope: 'verb', file: 'md/main.xml', destination: '$offer' }], payloadWrites: [] });
  check('wrong wire scope is not accepted', missingEvidence.findings.some(item => item.code === 'rules.wire_key_missing_reader'));
  check('missing wire writer fails', missingEvidence.findings.some(item => item.code === 'rules.wire_key_missing_writer'));
  check('missing expected register fails', missingEvidence.findings.some(item => item.code === 'rules.expected_register_missing'));
  const nested = parseProjectRules({ id: 'nested', name: 'nested', files: [{ path: 'docs/forge.rules.json', kind: 'other', content: '{"version":2}' }] }, { now });
  check('nested lookalike is ignored', !nested.present && nested.valid);
  const duplicateFile = parseProjectRules({ id: 'dup-file', name: 'dup-file', files: [{ path: PROJECT_RULES_PATH, kind: 'other', content: '{"version":1}' }, { path: 'FORGE.RULES.JSON', kind: 'other', content: '{"version":1}' }] }, { now });
  check('case-insensitive duplicate root file rejected', duplicateFile.findings.some(item => item.code === 'rules.duplicate_file'));
  const tooLarge = parseProjectRules({ id: 'large', name: 'large', files: [{ path: PROJECT_RULES_PATH, kind: 'other', content: ' '.repeat(PROJECT_RULES_MAX_BYTES + 1) }] }, { now });
  check('oversized rules file fails before JSON parsing', tooLarge.findings.some(item => item.code === 'rules.file_too_large'));
  const passed = checks.filter(item => item.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}
