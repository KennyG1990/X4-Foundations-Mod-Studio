/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure semantic rules for the source-located X4 UI call model.  This module
 * deliberately does not parse Lua, read a file, or decide whether X4 really
 * rendered a frame.  It only reports what the supplied model proves and keeps
 * every missing fact as an explicit verification gap.
 */

import type {
  X4UiCallModel,
  X4UiCallRecord,
  X4UiFunctionContext,
  X4UiRelevantRecord,
  X4UiSourceLocation,
  X4UiValue,
  X4UiValueReference,
  X4UiValueStatus,
  X4UiVerificationGap,
  X4UiVerificationGapCategory
} from './x4UiCallModel';

export type X4UiLintSeverity = 'error' | 'warning' | 'info';

export const X4_UI_LINT_RULES = {
  tableColumnLimit: 'x4-ui.add-table-column-limit',
  tableWidthMinimum: 'x4-ui.table-width-minimum',
  columnIndex: 'x4-ui.column-index',
  widthAfterFirstRow: 'x4-ui.width-after-first-row',
  percentageTotal: 'x4-ui.column-percentage-total',
  colspanOverrun: 'x4-ui.colspan-overrun',
  fontScale: 'x4-ui.font-scale',
  renderedNonAscii: 'x4-ui.rendered-non-ascii',
  rowHeightBudget: 'x4-ui.row-height-budget',
  tableHeightBudget: 'x4-ui.table-height-budget',
  editBoxHeightMinimum: 'x4-ui.editbox-height-minimum',
  inlineDisplay: 'x4-ui.inline-display',
  sameLayerInlineOpen: 'x4-ui.same-layer-inline-open',
  verificationGap: 'x4-ui.verification-gap',
  truncatedEvidence: 'x4-ui.truncated-evidence'
} as const;

export type X4UiLintRuleCode = typeof X4_UI_LINT_RULES[keyof typeof X4_UI_LINT_RULES];

export type X4UiLintStatus = 'clean' | 'warnings' | 'errors' | 'not-statically-verified';

export interface X4UiLintFinding {
  /** Stable rule identity; `code` is retained as the integration-friendly alias. */
  rule: X4UiLintRuleCode;
  code: X4UiLintRuleCode;
  severity: X4UiLintSeverity;
  message: string;
  cause: string;
  failureMode: string;
  evidenceBoundary: string;
  nextAction: string;
  location: X4UiSourceLocation;
  /** Existing Forge analyzers call this field `source`; keep both names. */
  source: X4UiSourceLocation;
  category?: X4UiVerificationGapCategory | 'truncated';
}

export interface X4UiLintVerificationGap {
  code: typeof X4_UI_LINT_RULES.verificationGap;
  category: X4UiVerificationGapCategory | 'truncated';
  status: X4UiValueStatus | 'unsupported';
  expression: string;
  reason: string;
  location: X4UiSourceLocation;
  source: X4UiSourceLocation;
}

export interface X4UiLintResult {
  parsed: boolean;
  findings: X4UiLintFinding[];
  verificationGaps: X4UiLintVerificationGap[];
  verificationGapsTruncated: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  hasVerificationGaps: boolean;
  hasTruncatedEvidence: boolean;
  /** Complete static evidence is independent of whether a proven rule failed. */
  isStaticallyVerified: boolean;
  status: X4UiLintStatus;
  summary: string;
  errorCount: number;
  warningCount: number;
  verificationGapCount: number;
}

interface TableInfo {
  key: string;
  call: X4UiCallRecord;
  count?: number;
  countValue?: X4UiValue;
  tableWidth?: X4UiValue;
  tableHeight?: X4UiValue;
  tableY?: X4UiValue;
  maxVisibleHeight?: X4UiValue;
  frameKey?: string;
  rowCalls: X4UiCallRecord[];
}

interface FrameInfo {
  key: string;
  call: X4UiCallRecord;
  frameHeight?: X4UiValue;
  autoFrameHeight?: X4UiValue;
}

interface CellHeightEvidence {
  height: number;
  sourcePinned: boolean;
}

interface RowHeightEvidence {
  row: X4UiCallRecord;
  height: number;
  sourcePinned: boolean;
}

interface MenuFacts {
  name?: string;
  nameKnown: boolean;
  layer?: number;
  layerKnown: boolean;
}

interface FindingInput {
  rule: X4UiLintRuleCode;
  severity: X4UiLintSeverity;
  message: string;
  cause: string;
  failureMode: string;
  evidenceBoundary: string;
  nextAction: string;
  location: X4UiSourceLocation;
  category?: X4UiVerificationGapCategory | 'truncated';
}

const RENDERED_CALLS = new Set(['setText', 'setText2', 'createText', 'createEditBox']);

function normalizeName(name: string): string {
  return name.replace(/[-_\s]/g, '').toLowerCase();
}

function staticNumber(value: X4UiValue | undefined): number | undefined {
  if (!value || value.status !== 'static' || value.type !== 'number' || typeof value.value !== 'number') return undefined;
  return Number.isFinite(value.value) ? value.value : undefined;
}

function staticString(value: X4UiValue | undefined): string | undefined {
  if (!value || value.status !== 'static' || value.type !== 'string' || typeof value.value !== 'string') return undefined;
  return value.value;
}

function staticBoolean(value: X4UiValue | undefined): boolean | undefined {
  if (!value || value.status !== 'static' || value.type !== 'boolean' || typeof value.value !== 'boolean') return undefined;
  return value.value;
}

function helperRound(value: number): number {
  return Math.floor(value + 0.5);
}

function staticReference(value: X4UiValue | undefined): X4UiValueReference | undefined {
  if (!value || value.status !== 'static' || !value.reference) return undefined;
  return value.reference;
}

function projectedProperty(call: X4UiCallRecord, names: readonly string[]): X4UiValue | undefined {
  const normalizedNames = names.map(normalizeName);
  return call.semantics.properties?.find(property => normalizedNames.includes(normalizeName(property.normalizedName || property.name)))?.value;
}

function effectiveScalingValue(cell: X4UiValue | undefined, row: X4UiValue | undefined, table: X4UiValue | undefined): X4UiValue | undefined {
  const values = [table, row, cell].filter((value): value is X4UiValue => Boolean(value));
  // Helper propagates a false table/row scaling flag down to descendants.
  const forcedFalse = values.find(value => staticBoolean(value) === false);
  if (forcedFalse) return forcedFalse;
  const unresolved = values.find(value => staticBoolean(value) === undefined);
  if (unresolved) return unresolved;
  return values.length > 0 ? values[values.length - 1] : undefined;
}

function pinnedStandardButtonHeight(value: X4UiValue | undefined): number | undefined {
  if (staticNumber(value) !== undefined) return staticNumber(value);
  if (!value || !/^Helper\s*[:.]\s*standardButtonHeight$/i.test(value.expression)) return undefined;
  return 25;
}

function valueStatus(value: X4UiValue | undefined, expectedType?: string): X4UiValueStatus | 'unsupported' {
  if (!value) return 'unknown';
  if (value.status !== 'static') return value.status;
  return expectedType && value.type !== expectedType ? 'unsupported' : value.status;
}

function locationKey(location: X4UiSourceLocation): string {
  return [
    location.file,
    location.sourcePath || '',
    location.start.offset,
    location.end.offset
  ].join('|');
}

function executionContextKey(context: X4UiFunctionContext): string | undefined {
  if (context.kind === 'top-level') return 'top-level';
  if (!context.source) return undefined;
  return `${context.kind}|${locationKey(context.source)}`;
}

function branchPathsCompatible(left: X4UiFunctionContext, right: X4UiFunctionContext): boolean {
  const rightArms = new Map<string, string>();
  for (const segment of right.branchPath) rightArms.set(segment.boundaryId, segment.armId);
  for (const segment of left.branchPath) {
    const rightArm = rightArms.get(segment.boundaryId);
    if (rightArm !== undefined && rightArm !== segment.armId) return false;
  }
  return true;
}

function callsCompatible(left: X4UiCallRecord, right: X4UiCallRecord): boolean {
  const leftContext = executionContextKey(left.context);
  const rightContext = executionContextKey(right.context);
  return leftContext !== undefined
    && leftContext === rightContext
    && branchPathsCompatible(left.context, right.context);
}

function recordsReachable(record: X4UiRelevantRecord): boolean {
  return record.context.reachability !== 'unreachable';
}

function callsPairwiseCompatible(calls: readonly X4UiCallRecord[]): boolean {
  for (let leftIndex = 0; leftIndex < calls.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < calls.length; rightIndex += 1) {
      if (!callsCompatible(calls[leftIndex], calls[rightIndex])) return false;
    }
  }
  return true;
}

function referenceKey(reference: X4UiValueReference): string {
  return [
    reference.source.file,
    reference.source.sourcePath || '',
    reference.source.start.offset,
    reference.kind
  ].join('|');
}

function referencePath(reference: X4UiValueReference | undefined): string | undefined {
  return reference?.path || undefined;
}

function modelLocation(model: X4UiCallModel): X4UiSourceLocation {
  const text = model.file.text || '';
  const lines = text.split(/\r?\n/);
  const lastLine = lines.length;
  const lastColumn = lines[lastLine - 1]?.length || 0;
  return {
    file: model.file.rel,
    sourcePath: model.file.sourcePath,
    start: { line: 1, column: 0, offset: 0 },
    end: { line: lastLine, column: lastColumn, offset: text.length }
  };
}

function containsNonAscii(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) > 0x7f);
}

function isScaleXYExpression(value: X4UiValue | undefined): boolean {
  if (!value) return false;
  return /\bHelper\s*[:.]\s*scale[XY]\s*\(/i.test(value.expression);
}

function isScaleFontExpression(value: X4UiValue | undefined): boolean {
  if (!value) return false;
  return /^\s*Helper\s*[:.]\s*scaleFont\s*\(/i.test(value.expression);
}

function isScaleFontExpressionText(expression: string): boolean {
  return /^\s*Helper\s*[:.]\s*scaleFont\s*\(/i.test(expression);
}

function sourceOffset(location: X4UiSourceLocation): number {
  return location.start.offset;
}

function compareLocations(left: X4UiSourceLocation, right: X4UiSourceLocation): number {
  if (sourceOffset(left) !== sourceOffset(right)) return sourceOffset(left) - sourceOffset(right);
  if (left.start.line !== right.start.line) return left.start.line - right.start.line;
  if (left.start.column !== right.start.column) return left.start.column - right.start.column;
  if (left.end.offset !== right.end.offset) return left.end.offset - right.end.offset;
  return 0;
}

function contextIsHandler(context: X4UiFunctionContext): boolean {
  return context.kind === 'handler' && normalizeName(context.handler || 'onClick') === 'onclick';
}

class X4UiLintEvaluator {
  private readonly model: X4UiCallModel;
  private readonly calls: X4UiCallRecord[];
  private readonly records: X4UiRelevantRecord[];
  private readonly findings: X4UiLintFinding[] = [];
  private readonly findingKeys = new Set<string>();
  private readonly gaps: X4UiLintVerificationGap[] = [];
  private readonly gapKeys = new Set<string>();
  private readonly tables = new Map<string, TableInfo>();
  private readonly unresolvedRowCalls: X4UiCallRecord[] = [];
  private readonly frames = new Map<string, FrameInfo>();
  private readonly pathToReference = new Map<string, X4UiValueReference | undefined>();
  private readonly tablePathToKey = new Map<string, string | undefined>();
  private readonly menuFactsByReference = new Map<string, MenuFacts>();
  private readonly menuReferencesByKey = new Map<string, X4UiValueReference>();
  private readonly menuFactsByPath = new Map<string, MenuFacts | undefined>();

  public constructor(model: X4UiCallModel) {
    this.model = model;
    this.calls = model.calls.filter(call => call.context.reachability !== 'unreachable');
    this.records = model.records.filter(recordsReachable);
  }

  public evaluate(): X4UiLintResult {
    this.indexReferences();
    this.indexModelGaps();
    this.indexFramesAndTables();
    this.indexMenuFacts();

    if (!this.model.parsed && !this.model.verificationGaps.some(gap => gap.category === 'parse')) {
      this.addGap(
        'parse',
        'unsupported',
        modelLocation(this.model),
        'the call model reports that Lua parsing did not complete',
        '<parse failure>'
      );
    }
    if (this.model.verificationGapsTruncated) {
      this.addGap(
        'truncated',
        'unsupported',
        modelLocation(this.model),
        'the call model truncated its verification-gap list; unseen evidence may affect this result',
        '<verification gaps truncated>'
      );
    }

    this.checkTableColumnLimits();
    this.checkTableWidths();
    this.checkColumnOwnershipAndWidthFreeze();
    this.checkPercentages();
    this.checkColspans();
    this.checkFontsAndRenderedText();
    this.checkEditBoxHeights();
    this.checkRowHeightBudgets();
    this.checkInlineDisplay();
    this.checkSameLayerInlineOpen();

    const findings = [...this.findings].sort((left, right) => {
      const locationResult = compareLocations(left.location, right.location);
      if (locationResult !== 0) return locationResult;
      if (left.code !== right.code) return left.code.localeCompare(right.code);
      if (left.severity !== right.severity) return left.severity.localeCompare(right.severity);
      return left.message.localeCompare(right.message);
    });
    const verificationGaps = [...this.gaps].sort((left, right) => {
      const locationResult = compareLocations(left.location, right.location);
      if (locationResult !== 0) return locationResult;
      if (left.category !== right.category) return left.category.localeCompare(right.category);
      return left.reason.localeCompare(right.reason);
    });

    const hasErrors = findings.some(finding => finding.severity === 'error');
    const hasWarnings = findings.some(finding => finding.severity === 'warning');
    const hasTruncatedEvidence = this.model.verificationGapsTruncated;
    const hasVerificationGaps = verificationGaps.length > 0 || hasTruncatedEvidence || !this.model.parsed;
    const isStaticallyVerified = this.model.parsed && !hasVerificationGaps;
    const status: X4UiLintStatus = !isStaticallyVerified
      ? 'not-statically-verified'
      : hasErrors
        ? 'errors'
        : hasWarnings
          ? 'warnings'
          : 'clean';

    return {
      parsed: this.model.parsed,
      findings,
      verificationGaps,
      verificationGapsTruncated: this.model.verificationGapsTruncated,
      hasErrors,
      hasWarnings,
      hasVerificationGaps,
      hasTruncatedEvidence,
      isStaticallyVerified,
      status,
      summary: status === 'clean'
        ? 'No known rule violated'
        : status === 'not-statically-verified'
          ? 'Not statically verified'
          : status === 'errors'
            ? 'Known X4 UI rule violated'
            : 'Known X4 UI warning reported',
      errorCount: findings.filter(finding => finding.severity === 'error').length,
      warningCount: findings.filter(finding => finding.severity === 'warning').length,
      verificationGapCount: verificationGaps.length
    };
  }

  private addFinding(input: FindingInput): void {
    const key = `${input.rule}|${input.severity}|${locationKey(input.location)}`;
    if (this.findingKeys.has(key)) return;
    this.findingKeys.add(key);
    this.findings.push({
      ...input,
      code: input.rule,
      source: input.location,
      location: input.location
    });
  }

  private addGap(
    category: X4UiVerificationGapCategory | 'truncated',
    status: X4UiValueStatus | 'unsupported',
    location: X4UiSourceLocation,
    reason: string,
    expression: string
  ): void {
    const key = `${category}|${status}|${locationKey(location)}|${expression}`;
    if (this.gapKeys.has(key)) return;
    this.gapKeys.add(key);
    const gap: X4UiLintVerificationGap = {
      code: X4_UI_LINT_RULES.verificationGap,
      category,
      status,
      expression,
      reason,
      location,
      source: location
    };
    this.gaps.push(gap);
    this.addFinding({
      rule: X4_UI_LINT_RULES.verificationGap,
      severity: 'info',
      message: `Static verification gap (${category}): ${reason}`,
      cause: reason,
      failureMode: 'The available call-model evidence does not prove this boundary safe or unsafe.',
      evidenceBoundary: 'Only literal, resolved, non-truncated call-model facts are treated as proof.',
      nextAction: 'Provide a statically traceable value/owner or verify this boundary in the appropriate runtime/test surface.',
      location,
      category
    });
  }

  private addModelGap(gap: X4UiVerificationGap): void {
    this.addGap(gap.category, gap.status, gap.source, gap.reason, gap.expression);
  }

  private registerReference(reference: X4UiValueReference): void {
    const path = referencePath(reference);
    if (!path) return;
    if (!this.pathToReference.has(path)) {
      this.pathToReference.set(path, reference);
      return;
    }
    const existing = this.pathToReference.get(path);
    if (existing && referenceKey(existing) !== referenceKey(reference)) this.pathToReference.set(path, undefined);
  }

  private registerTablePath(path: string | undefined, key: string): void {
    if (!path) return;
    if (!this.tablePathToKey.has(path)) {
      this.tablePathToKey.set(path, key);
      return;
    }
    const existing = this.tablePathToKey.get(path);
    if (existing && existing !== key) this.tablePathToKey.set(path, undefined);
  }

  private registerMenuPath(path: string | undefined, facts: MenuFacts): void {
    if (!path) return;
    if (!this.menuFactsByPath.has(path)) {
      this.menuFactsByPath.set(path, facts);
      return;
    }
    const existing = this.menuFactsByPath.get(path);
    if (existing && existing !== facts) this.menuFactsByPath.set(path, undefined);
  }

  private addValueGap(
    category: X4UiVerificationGapCategory,
    value: X4UiValue | undefined,
    reason: string,
    location: X4UiSourceLocation
  ): void {
    this.addGap(
      category,
      valueStatus(value),
      value?.location || location,
      reason,
      value?.expression || '<missing value>'
    );
  }

  private indexReferences(): void {
    const registerValue = (value: X4UiValue | undefined): void => {
      if (!value?.reference) return;
      this.registerReference(value.reference);
    };
    for (const record of this.records) {
      if (record.recordType === 'call') {
        registerValue(record.receiver);
        for (const argument of record.arguments) registerValue(argument);
        for (const value of Object.values(record.semantics)) {
          if (value && typeof value === 'object' && 'status' in value) registerValue(value as X4UiValue);
        }
        if (record.semantics.editBox) {
          registerValue(record.semantics.editBox.defaultText);
          registerValue(record.semantics.editBox.description);
        }
        if (record.result) {
          this.registerReference(record.result);
        }
      } else if (record.recordType === 'property') {
        registerValue(record.owner);
        registerValue(record.value);
      } else {
        registerValue(record.value);
      }
    }
  }

  private indexModelGaps(): void {
    for (const gap of this.model.verificationGaps) {
      if (gap.category === 'fontsize' && isScaleFontExpressionText(gap.expression)) continue;
      this.addModelGap(gap);
    }
  }

  private indexFramesAndTables(): void {
    for (const call of this.calls) {
      if (call.name === 'createFrameHandle') {
        const key = call.result ? referenceKey(call.result) : `frame-call|${locationKey(call.source)}`;
        this.frames.set(key, {
          key,
          call,
          frameHeight: call.semantics.height,
          autoFrameHeight: projectedProperty(call, ['autoFrameHeight'])
        });
      }
    }

    for (const call of this.calls) {
      if (call.name !== 'addTable') continue;
      const key = call.result ? referenceKey(call.result) : `table-call|${locationKey(call.source)}`;
      const count = staticNumber(call.semantics.count);
      const info: TableInfo = {
        key,
        call,
        count,
        countValue: call.semantics.count,
        tableWidth: call.semantics.width,
        tableHeight: call.semantics.height,
        tableY: projectedProperty(call, ['y']),
        maxVisibleHeight: projectedProperty(call, ['maxVisibleHeight']),
        rowCalls: []
      };
      const frameReference = staticReference(call.semantics.frame);
      if (frameReference) {
        const frameKey = referenceKey(frameReference);
        if (this.frames.has(frameKey)) info.frameKey = frameKey;
      }
      this.tables.set(key, info);
      this.registerTablePath(call.result?.path, key);
    }

    for (const call of this.calls) {
      if (call.name !== 'addRow') continue;
      const tableKey = this.tableKeyFromValue(call.semantics.table);
      if (tableKey && this.tables.has(tableKey)) this.tables.get(tableKey)?.rowCalls.push(call);
      else this.unresolvedRowCalls.push(call);
    }
  }

  private indexMenuFacts(): void {
    const factsFor = (reference: X4UiValueReference): MenuFacts => {
      const key = referenceKey(reference);
      this.menuReferencesByKey.set(key, reference);
      const existing = this.menuFactsByReference.get(key);
      if (existing) return existing;
      const created: MenuFacts = { nameKnown: false, layerKnown: false };
      this.menuFactsByReference.set(key, created);
      return created;
    };
    const updateFact = (reference: X4UiValueReference, value: X4UiValue | undefined, field: 'name' | 'layer'): void => {
      const facts = factsFor(reference);
      if (field === 'name') {
        const name = staticString(value);
        if (name !== undefined) {
          facts.name = name;
          facts.nameKnown = true;
        } else {
          facts.name = undefined;
          facts.nameKnown = false;
        }
      } else {
        const layer = staticNumber(value);
        if (layer !== undefined) {
          facts.layer = layer;
          facts.layerKnown = true;
        } else {
          facts.layer = undefined;
          facts.layerKnown = false;
        }
      }
      this.registerMenuPath(reference.path, facts);
    };

    for (const record of this.records) {
      if (record.recordType === 'property') {
        const owner = staticReference(record.owner);
        if (!owner || owner.kind !== 'menu') continue;
        const name = normalizeName(record.name);
        if (name === 'name') updateFact(owner, record.value, 'name');
        if (name === 'layer') updateFact(owner, record.value, 'layer');
        continue;
      }
      if (record.recordType !== 'call' || record.name !== 'createFrameHandle') continue;
      const reference = staticReference(record.semantics.menu);
      if (!reference || reference.kind !== 'menu') continue;
      const facts = factsFor(reference);
      const name = staticString(record.semantics.menuName);
      const layer = staticNumber(record.semantics.layer);
      if (name !== undefined) {
        facts.name = name;
        facts.nameKnown = true;
      }
      if (layer !== undefined) {
        facts.layer = layer;
        facts.layerKnown = true;
      }
      this.registerMenuPath(reference.path, facts);
    }
  }

  private tableKeyFromValue(value: X4UiValue | undefined): string | undefined {
    const reference = staticReference(value);
    if (!reference || reference.kind !== 'table') return undefined;
    const key = referenceKey(reference);
    return this.tables.has(key) ? key : undefined;
  }

  private tableKeyFromReference(reference: X4UiValueReference | undefined): string | undefined {
    if (!reference) return undefined;
    const directKey = referenceKey(reference);
    if (reference.kind === 'table' && this.tables.has(directKey)) return directKey;
    if (reference.path && this.tablePathToKey.has(reference.path)) return this.tablePathToKey.get(reference.path);

    const visited = new Set<string>();
    let parentPath = reference.parentPath;
    while (parentPath && !visited.has(parentPath)) {
      visited.add(parentPath);
      const direct = this.tablePathToKey.get(parentPath);
      if (direct) return direct;
      const parent = this.pathToReference.get(parentPath);
      if (!parent) return undefined;
      const parentKey = referenceKey(parent);
      if (parent.kind === 'table' && this.tables.has(parentKey)) return parentKey;
      parentPath = parent.parentPath;
    }
    return undefined;
  }

  private checkTableColumnLimits(): void {
    for (const table of this.tables.values()) {
      const countValue = table.countValue;
      const count = staticNumber(countValue);
      if (count === undefined) {
        if (countValue) this.addValueGap('count', countValue, 'addTable column count is not a statically known finite number', table.call.source);
        continue;
      }
      if (count >= 24) {
        this.addFinding({
          rule: X4_UI_LINT_RULES.tableColumnLimit,
          severity: 'error',
          message: `Literal addTable(${count}) exceeds the measured X4 mod boundary: 12 passed / 24 failed / 13-23 unbisected.`,
          cause: `The literal table column count is ${count}, at or above the measured mod refusal boundary.`,
          failureMode: 'Engine refuses the ENTIRE frame: no partial draw/Lua error; UI auto-reloads, and the conversation-open symptom can look like the conversation closes.',
          evidenceBoundary: 'Measured mod boundary: 12 passed / 24 failed / 13-23 unbisected. Official X4 9.00 sources contain valid 13-column tables at ui/addons/ego_detailmonitor/menu_map.lua:13514, menu_scenario_selection.lua:290, and menu_ship_comparison.lua:303. This error is not a claim that every intermediate count was tested.',
          nextAction: 'Keep the table at twelve or fewer columns, or verify the chosen count in-game before relying on it.',
          location: table.call.source
        });
      } else if (count >= 13) {
        this.addFinding({
          rule: X4_UI_LINT_RULES.tableColumnLimit,
          severity: 'warning',
          message: `Literal addTable(${count}) is in the unbisected 13-23 range; official X4 9.00 sources contain valid 13-column tables.`,
          cause: `The literal table column count is ${count}; official vanilla counterexamples show that 13-column tables are valid, while mod behavior between 13 and 23 has not been bisected.`,
          failureMode: 'No refusal is proven for this literal count; the measured mod failure boundary is at 24 and must not be generalized to 13-23.',
          evidenceBoundary: 'Official X4 9.00 sources contain valid 13-column tables at ui/addons/ego_detailmonitor/menu_map.lua:13514, menu_scenario_selection.lua:290, and menu_ship_comparison.lua:303. Measured mod evidence is 12 passed / 24 failed; 13-23 remain unbisected.',
          nextAction: 'Verify this literal count in-game before relying on it; the official 13-column counterexamples do not establish mod acceptance for 13-23.',
          location: table.call.source
        });
      }
    }
  }

  private checkTableWidths(): void {
    for (const table of this.tables.values()) {
      const width = table.tableWidth;
      if (!width) continue;
      const numericWidth = staticNumber(width);
      if (numericWidth === undefined) {
        this.addValueGap('width', width, 'table width is dynamic, scaled, or not a finite numeric literal', table.call.source);
        continue;
      }
      if (numericWidth < 2) {
        const compatibleRows = table.rowCalls.filter(row => callsCompatible(table.call, row));
        const incompatibleRows = table.rowCalls.filter(row => !callsCompatible(table.call, row));
        const unresolvedRows = this.unresolvedRowCalls.filter(row => callsCompatible(table.call, row));
        if (compatibleRows.length > 0) {
          this.addFinding({
            rule: X4_UI_LINT_RULES.tableWidthMinimum,
            severity: 'error',
            message: `Literal populated table width ${numericWidth} is below the known two-pixel minimum.`,
            cause: 'The table width literal is smaller than the documented refusal boundary and a same-table compatible reachable addRow is statically proven.',
            failureMode: 'Engine refuses the ENTIRE frame: no partial draw/Lua error; UI auto-reloads.',
            evidenceBoundary: 'A fatal width finding requires a literal width below two plus at least one same-table, reachable addRow in a compatible execution context. Proven empty tables are not treated as failures.',
            nextAction: 'Use a literal width of at least two, or verify a dynamic/scaled width in the real X4 surface.',
            location: table.call.source
          });
        }
        if (incompatibleRows.length > 0 || unresolvedRows.length > 0) {
          this.addGap(
            'data-flow',
            'unknown',
            table.call.source,
            'table width minimum is unverified because row population is unresolved or occurs in an incompatible execution context; a fatal minimum-width finding requires a same-table compatible reachable addRow',
            table.tableWidth?.expression || '<table width>'
          );
        }
      }
    }
  }

  private checkColumnOwnershipAndWidthFreeze(): void {
    for (const call of this.calls) {
      if (call.name !== 'setColWidth' && call.name !== 'setColWidthPercent') continue;
      const tableKey = this.tableKeyFromValue(call.semantics.table);
      const table = tableKey ? this.tables.get(tableKey) : undefined;
      if (!table) {
        this.addValueGap('data-flow', call.semantics.table, 'column width assignment has unresolved table ownership', call.source);
      }
      const index = staticNumber(call.semantics.index);
      if (index === undefined) {
        this.addValueGap('index', call.semantics.index, 'column width assignment index is not a statically known finite number', call.source);
      }
      const count = staticNumber(table?.countValue);
      if (table && index !== undefined && count !== undefined && (index < 1 || index > count)) {
        this.addFinding({
          rule: X4_UI_LINT_RULES.columnIndex,
          severity: 'error',
          message: `Column index ${index} is outside the proven table range 1..${count}.`,
          cause: `The width assignment targets column ${index}, but its table has ${count} columns.`,
          failureMode: 'The out-of-range column index produces a silent misdraw.',
          evidenceBoundary: 'This error requires a literal index, a resolved table receiver, and a literal table count.',
          nextAction: `Use a column index from 1 through ${count}, or make the ownership/index statically traceable.`,
          location: call.source
        });
      }

      const rowCalls = table?.rowCalls || [];
      let hasCompatibleEarlierRow = false;
      let hasIncompatibleRow = false;
      for (const row of rowCalls) {
        if (!callsCompatible(call, row)) {
          hasIncompatibleRow = true;
          continue;
        }
        if (call.sourceOrder > row.sourceOrder) hasCompatibleEarlierRow = true;
      }
      if (table && hasCompatibleEarlierRow) {
        this.addFinding({
          rule: X4_UI_LINT_RULES.widthAfterFirstRow,
          severity: 'error',
          message: 'Column width is assigned after the first row on the same table.',
          cause: 'The call-model source order proves that a same-table setColWidth* call follows addRow.',
          failureMode: 'The width change is silently ignored after addRow, leaving the rendered table with unintended widths.',
          evidenceBoundary: 'Only same-table, statically resolved source order is treated as proof; unresolved ownership remains a gap.',
          nextAction: 'Move all same-table column-width assignments before the first addRow call.',
          location: call.source
        });
      }
      if (table && rowCalls.length > 0 && hasIncompatibleRow) {
        this.addGap(
          'data-flow',
          'unknown',
          call.source,
          'column width ordering is unverified because addRow and setColWidth* calls do not share one compatible execution context or branch path',
          call.semantics.table?.expression || '<column-width table>'
        );
      }
    }
  }

  private checkPercentages(): void {
    const byTable = new Map<string, X4UiCallRecord[]>();
    for (const call of this.calls) {
      if (call.name !== 'setColWidthPercent') continue;
      const tableKey = this.tableKeyFromValue(call.semantics.table);
      if (!tableKey || !this.tables.has(tableKey)) {
        this.addValueGap('data-flow', call.semantics.table, 'percentage assignment has unresolved table ownership', call.source);
        continue;
      }
      const calls = byTable.get(tableKey) || [];
      calls.push(call);
      byTable.set(tableKey, calls);
    }

    for (const [tableKey, calls] of byTable) {
      const table = this.tables.get(tableKey);
      if (!table) continue;
      if (!callsPairwiseCompatible(calls)) {
        this.addGap(
          'percentage',
          'unknown',
          calls[0].source,
          'percentage assignments for one table occur in distinct, unresolved, or incompatible execution contexts/branch paths, so their total is unverified',
          calls[0].semantics.table?.expression || '<percentage table>'
        );
        continue;
      }
      const count = staticNumber(table.countValue);
      if (count === undefined) {
        this.addValueGap('count', table.countValue, 'percentage allocation cannot establish table coverage without a literal count', table.call.source);
        continue;
      }

      let total = 0;
      let uncertain = false;
      const indexes = new Set<number>();
      for (const call of calls) {
        const percentage = staticNumber(call.semantics.percentage);
        const index = staticNumber(call.semantics.index);
        if (percentage === undefined) {
          this.addValueGap('percentage', call.semantics.percentage, 'percentage allocation is dynamic or not a finite numeric literal', call.source);
          uncertain = true;
        }
        if (index === undefined) {
          this.addValueGap('index', call.semantics.index, 'percentage allocation ownership is dynamic or unresolved', call.source);
          uncertain = true;
        }
        if (percentage === undefined || index === undefined) continue;
        if (indexes.has(index) || index < 1 || index > count) {
          this.addGap(
            'percentage',
            'unknown',
            call.source,
            'duplicate or out-of-range percentage ownership prevents a sound allocation total',
            call.semantics.index?.expression || '<percentage index>'
          );
          uncertain = true;
        }
        indexes.add(index);
        total += percentage;
      }
      if (uncertain) continue;
      if (total > 100) {
        this.addFinding({
          rule: X4_UI_LINT_RULES.percentageTotal,
          severity: 'error',
          message: `Column percentage total ${total} exceeds 100.`,
          cause: 'The resolved literal percentage assignments allocate more than the full table width.',
          failureMode: 'Column distribution becomes unpredictable when the explicit percentage total exceeds 100.',
          evidenceBoundary: 'The total is checked only when every percentage and every column owner is a unique literal.',
          nextAction: 'Reduce the explicit percentage total to at most 100 and verify any remaining automatic columns.',
          location: calls[calls.length - 1].source
        });
      } else if (indexes.size === count && total < 100) {
        this.addFinding({
          rule: X4_UI_LINT_RULES.percentageTotal,
          severity: 'warning',
          message: `All ${count} columns have explicit percentages totaling ${total}, below 100.`,
          cause: 'Every column is explicitly assigned, so the literal total proves that the table contracts.',
          failureMode: 'Column distribution contracts, leaving unused horizontal space or narrower columns than intended.',
          evidenceBoundary: 'This warning applies only to complete, unique literal ownership; mixed automatic columns are valid and remain clean.',
          nextAction: 'Raise the explicit total to 100 or leave at least one column automatic intentionally.',
          location: calls[calls.length - 1].source
        });
      }
    }
  }

  private checkColspans(): void {
    for (const call of this.calls) {
      if (call.name !== 'setColSpan') continue;
      const cell = call.semantics.cell;
      const cellReference = staticReference(cell);
      const tableKey = this.tableKeyFromReference(cellReference);
      const table = tableKey ? this.tables.get(tableKey) : undefined;
      if (!cellReference || !table) {
        this.addValueGap('data-flow', cell, 'column span receiver/table ownership is unresolved', call.source);
      }
      if (table && !callsCompatible(call, table.call)) {
        this.addGap(
          'data-flow',
          'unknown',
          call.source,
          'column span is unverified because the span call and table definition do not share one compatible execution context or branch path',
          cell?.expression || '<column-span cell>'
        );
        continue;
      }
      const start = cellReference?.index ? staticNumber(cellReference.index) : undefined;
      if (start === undefined) {
        this.addValueGap('index', cellReference?.index, 'column span start index is not statically known', call.source);
      }
      const span = staticNumber(call.semantics.span);
      if (span === undefined) {
        this.addValueGap('span', call.semantics.span, 'column span is not a statically known finite number', call.source);
      }
      const count = staticNumber(table?.countValue);
      if (count === undefined && table) {
        this.addValueGap('count', table.countValue, 'column span cannot establish the table boundary without a literal count', table.call.source);
      }
      if (table && count !== undefined && start !== undefined && span !== undefined) {
        if (start < 1 || start > count) {
          this.addFinding({
            rule: X4_UI_LINT_RULES.columnIndex,
            severity: 'error',
            message: `Column span starts at index ${start}, outside the proven table range 1..${count}.`,
            cause: 'The cell start column is outside the table column range.',
            failureMode: 'X4 can ignore the span or fail to construct the row cell layout.',
            evidenceBoundary: 'This error requires a literal cell index, resolved table ownership, and a literal count.',
            nextAction: `Use a span start from 1 through ${count}.`,
            location: call.source
          });
        } else if (start + span - 1 > count) {
          this.addFinding({
            rule: X4_UI_LINT_RULES.colspanOverrun,
            severity: 'error',
            message: `Column span ${start}+${span}-1 overruns the ${count}-column table.`,
            cause: 'The proven last occupied column is beyond the table column count.',
            failureMode: 'The overrun causes layout corruption and can misplace subsequent cells.',
            evidenceBoundary: 'The overrun is reported only with literal start/span values and resolved table ownership/count.',
            nextAction: `Reduce the span so that the last occupied column is at most ${count}.`,
            location: call.source
          });
        }
      }
    }
  }

  private checkFontsAndRenderedText(): void {
    for (const call of this.calls) {
      if (RENDERED_CALLS.has(call.name)) {
        const fontsize = call.semantics.fontsize;
        if (isScaleXYExpression(fontsize)) {
          this.addFinding({
            rule: X4_UI_LINT_RULES.fontScale,
            severity: 'error',
            message: 'Rendered fontsize is sourced from Helper.scaleX/scaleY.',
            cause: `The rendered font-size expression is ${fontsize?.expression || '<unknown>'}.`,
            failureMode: 'The fontsize becomes approximately twice the intended size and overflows its container.',
            evidenceBoundary: 'Only direct rendered fontsize expressions naming scaleX or scaleY are rejected; scaleFont and ordinary static sizes are not.',
            nextAction: 'Use Helper.scaleFont for font metrics or a literal font size, then verify the rendered result in-game.',
            location: call.source
          });
        } else if (fontsize && !isScaleFontExpression(fontsize) && staticNumber(fontsize) === undefined) {
          this.addValueGap('fontsize', fontsize, 'rendered font size is dynamic or not a statically understood numeric value', call.source);
        }

        const renderedValues: X4UiValue[] = [];
        if (call.semantics.text) renderedValues.push(call.semantics.text);
        if (call.semantics.editBox?.defaultText) renderedValues.push(call.semantics.editBox.defaultText);
        if (call.semantics.editBox?.description) renderedValues.push(call.semantics.editBox.description);
        for (const value of renderedValues) {
          const text = staticString(value);
          if (text === undefined) {
            this.addValueGap('text', value, 'rendered text is dynamic or not a statically known string', call.source);
          } else if (containsNonAscii(text)) {
            this.addFinding({
              rule: X4_UI_LINT_RULES.renderedNonAscii,
              severity: 'warning',
              message: 'Rendered text/edit-box content contains non-ASCII characters.',
              cause: 'A literal that flows directly into a known rendered text or edit-box call contains non-ASCII text.',
              failureMode: 'Zekton draws a box glyph for rendered non-ASCII text.',
              evidenceBoundary: 'Only direct rendered text/edit-box values are checked; comments, prompts, arbitrary strings, and non-render properties are outside this rule.',
              nextAction: 'Verify the selected glyphs and font resources in the real X4 UI, or keep the rendered literal within the supported character set.',
              location: value.location
            });
          }
        }
      }
    }
  }

  private checkEditBoxHeights(): void {
    for (const call of this.calls) {
      if (call.name !== 'createEditBox') continue;

      const options = call.semantics.options;
      if (options && options.status !== 'static') {
        this.addValueGap(
          'height',
          options,
          'createEditBox height is unverified because its options table is dynamic or unknown',
          call.source
        );
        continue;
      }

      const heightValue = projectedProperty(call, ['height']);
      const height = staticNumber(heightValue);
      if (height === undefined) {
        if (heightValue) {
          this.addValueGap(
            'height',
            heightValue,
            'createEditBox height is dynamic or unsupported; the zero-height overlap boundary is not statically proven',
            call.source
          );
        } else {
          this.addFinding({
            rule: X4_UI_LINT_RULES.editBoxHeightMinimum,
            severity: 'error',
            message: 'createEditBox outer height is omitted; Helper leaves the base cell at zero.',
            cause: 'Helper base cell height defaults to zero when createEditBox height is omitted or literal zero.',
            failureMode: 'X4 displays the frame, logs "Dimensions for editbox are too small ... height(0 px)" and "Editbox elements will overlap eachother", and shows the edit field clipped/overlapped.',
            evidenceBoundary: 'Only statically proven omitted or literal-zero createEditBox outer height produces this lint error; dynamic or unresolved height remains a verification gap.',
            nextAction: 'Add a positive height to the createEditBox outer properties and verify the rendered layout in-game.',
            location: call.source
          });
        }
        continue;
      }
      if (height !== 0) continue;

      this.addFinding({
        rule: X4_UI_LINT_RULES.editBoxHeightMinimum,
        severity: 'error',
        message: 'createEditBox outer height is the literal zero; Helper leaves the base cell at zero.',
        cause: 'Helper base cell height defaults to zero when createEditBox height is omitted or literal zero.',
        failureMode: 'X4 displays the frame, logs "Dimensions for editbox are too small ... height(0 px)" and "Editbox elements will overlap eachother", and shows the edit field clipped/overlapped.',
        evidenceBoundary: 'Only statically proven omitted or literal-zero createEditBox outer height produces this lint error; dynamic or unresolved height remains a verification gap.',
        nextAction: 'Add a positive height to the createEditBox outer properties and verify the rendered layout in-game.',
        location: heightValue.location
      });
    }
  }

  private rowForCellReference(table: TableInfo, reference: X4UiValueReference): X4UiCallRecord | undefined {
    const rowPath = reference.kind === 'row'
      ? reference.path
      : reference.kind === 'cell'
        ? reference.parentPath
        : undefined;
    if (!rowPath) return undefined;
    const matches = table.rowCalls.filter(row => row.result?.path === rowPath);
    return matches.length === 1 ? matches[0] : undefined;
  }

  private cellHeightEvidence(table: TableInfo, row: X4UiCallRecord, call: X4UiCallRecord): CellHeightEvidence | undefined {
    const options = call.semantics.options;
    if (options && options.status !== 'static') {
      this.addValueGap('height', options, `${call.name} outer-cell geometry is unverified because its options table is dynamic or unknown`, call.source);
      return undefined;
    }

    let affectRowHeight = true;
    const affectValue = call.name === 'createButton' || call.name === 'createIcon'
      ? projectedProperty(call, ['affectRowHeight'])
      : undefined;
    if (call.name === 'createButton' || call.name === 'createIcon') {
      if (affectValue) {
        const staticAffect = staticBoolean(affectValue);
        if (staticAffect === undefined) {
          this.addValueGap('height', affectValue, `${call.name} affectRowHeight is dynamic or unsupported`, call.source);
          return undefined;
        }
        affectRowHeight = staticAffect;
      }
      if (!affectRowHeight) {
        // The bounded v1 model does not project later button hotkey mutations;
        // Helper's hotkey minimum therefore remains an explicit limitation.
        return { height: 1, sourcePinned: false };
      }
    }

    const heightValue = projectedProperty(call, ['height']);
    const yValue = projectedProperty(call, ['y']);
    const heightSource = call.name === 'createButton'
      ? pinnedStandardButtonHeight(heightValue)
      : staticNumber(heightValue);
    let height: number;
    if (call.name === 'createText') {
      if (!heightValue || heightSource === undefined || heightSource === 0) {
        this.addValueGap(
          'height',
          heightValue,
          'text cell outer height is metrics-dependent when height is omitted or zero; no text metric is fabricated',
          call.source
        );
        return undefined;
      }
      height = heightSource;
    } else if (call.name === 'createButton') {
      if (heightValue && heightSource === undefined) {
        this.addValueGap('height', heightValue, 'button outer-cell height is dynamic, unsupported, or not source-pinned', call.source);
        return undefined;
      }
      height = heightValue ? heightSource : 25;
    } else if (call.name === 'createEditBox' || call.name === 'createIcon') {
      if (heightValue && heightSource === undefined) {
        this.addValueGap('height', heightValue, `${call.name} outer-cell height is dynamic or unsupported`, call.source);
        return undefined;
      }
      height = heightValue ? heightSource : 0;
    } else {
      return undefined;
    }
    if (!Number.isFinite(height) || height < 0) {
      this.addValueGap('height', heightValue, `${call.name} outer-cell height is not a non-negative finite number`, call.source);
      return undefined;
    }

    let y = 0;
    if (yValue && affectRowHeight) {
      const numericY = staticNumber(yValue);
      if (numericY === undefined) {
        this.addValueGap('height', yValue, `${call.name} cell y offset is dynamic or unsupported`, call.source);
        return undefined;
      }
      y = numericY;
    }
    if (!affectRowHeight) y = 0;

    const scalingValue = effectiveScalingValue(
      projectedProperty(call, ['scaling']),
      projectedProperty(row, ['scaling']),
      projectedProperty(table.call, ['scaling'])
    );
    const scaling = staticBoolean(scalingValue);
    const scaleNeeded = height !== 0 || y !== 0;
    if (scaleNeeded && scaling !== false) {
      if (scalingValue) {
        this.addValueGap(
          'scale',
          scalingValue,
          'cell height is unverified because Helper.scaleY requires source-proven scaling=false; uiScale is unavailable',
          call.source
        );
      } else {
        this.addGap(
          'scale',
          'unknown',
          call.source,
          'cell height is unverified because Helper.scaleY/uiScale is unavailable unless effective scaling=false is source-proven',
          '<Helper.scaleY/uiScale>'
        );
      }
      return undefined;
    }

    return {
      height: helperRound(y) + helperRound(height),
      sourcePinned: call.name === 'createButton' && (!heightValue || /^Helper\s*[:.]\s*standardButtonHeight$/i.test(heightValue.expression))
    };
  }

  private checkRowHeightBudgets(): void {
    for (const table of this.tables.values()) {
      const tableHeight = staticNumber(table.tableHeight);
      const hasRows = table.rowCalls.length > 0;

      if (hasRows) {
        for (const row of table.rowCalls) {
          const ignoredHeight = projectedProperty(row, ['height', 'rowHeight']) || row.semantics.height;
          if (ignoredHeight) {
            this.addGap(
              'height',
              valueStatus(ignoredHeight),
              ignoredHeight.location,
              'Helper ignores addRow height/rowHeight for row geometry; row:getHeight() is derived from visible cells',
              ignoredHeight.expression
            );
          }
        }

        if (!callsPairwiseCompatible(table.rowCalls)) {
          this.addGap(
            'height',
            'unknown',
            table.rowCalls[0].source,
            'row-height budget is unverified because rows occur in distinct, unresolved, or incompatible execution contexts/branch paths',
            table.rowCalls[0].result?.path || '<row identity>'
          );
        } else if (table.rowCalls.some(row => row.context.loopPath.length > 0)) {
          const repeated = table.rowCalls.find(row => row.context.loopPath.length > 0) || table.rowCalls[0];
          this.addGap(
            'height',
            'unknown',
            repeated.source,
            'row-height budget is unverified because loopPath proves a repeated row but exact runtime multiplicity is not proven',
            repeated.result?.path || '<loop row identity>'
          );
        } else {
          const cellCalls = this.calls.filter(call => ['createText', 'createButton', 'createEditBox', 'createIcon'].includes(call.name));
          const rowEvidence: RowHeightEvidence[] = [];
          let rowEvidenceKnown = true;

          for (const row of table.rowCalls) {
            const cells = cellCalls.filter(call => {
              const cellReference = staticReference(call.semantics.cell);
              return cellReference ? this.rowForCellReference(table, cellReference) === row : false;
            });
            if (cells.length === 0) {
              rowEvidenceKnown = false;
              this.addGap(
                'height',
                'unknown',
                row.source,
                'row-height budget is unverified because no source-linked supported outer-cell geometry is attached to this row',
                row.result?.path || '<row identity>'
              );
              continue;
            }
            if (cells.some(cell => cell.context.loopPath.length > 0)) {
              rowEvidenceKnown = false;
              const repeated = cells.find(cell => cell.context.loopPath.length > 0) || cells[0];
              this.addGap(
                'height',
                'unknown',
                repeated.source,
                'row-height budget is unverified because loopPath repeats cell geometry and exact row multiplicity is not proven',
                repeated.semantics.cell?.expression || '<loop cell identity>'
              );
              continue;
            }
            if (!callsPairwiseCompatible([row, ...cells])) {
              rowEvidenceKnown = false;
              this.addGap(
                'height',
                'unknown',
                row.source,
                'row-height budget is unverified because row and cell geometry occur in incompatible execution contexts/branch paths',
                row.result?.path || '<row/cell execution path>'
              );
              continue;
            }

            const contributions: CellHeightEvidence[] = [];
            for (const cell of cells) {
              const evidence = this.cellHeightEvidence(table, row, cell);
              if (evidence) contributions.push(evidence);
              else rowEvidenceKnown = false;
            }
            if (contributions.length === 0) {
              rowEvidenceKnown = false;
              continue;
            }

            const maxCell = contributions.reduce((max, current) => current.height > max.height ? current : max);
            const paddingTop = projectedProperty(row, ['paddingTop']);
            const paddingBottom = projectedProperty(row, ['paddingBottom']);
            let padding = 0;
            for (const paddingValue of [paddingTop, paddingBottom]) {
              if (!paddingValue) continue;
              const numericPadding = staticNumber(paddingValue);
              if (numericPadding === undefined || numericPadding < 0) {
                rowEvidenceKnown = false;
                this.addValueGap('height', paddingValue, 'row padding is dynamic or unsupported', row.source);
              } else {
                padding += numericPadding;
              }
            }
            const rowOptions = row.semantics.options;
            if (rowOptions && rowOptions.status !== 'static') {
              rowEvidenceKnown = false;
              this.addValueGap('height', rowOptions, 'row padding/border/scaling ownership is dynamic or unknown', row.source);
            }
            rowEvidence.push({
              row,
              height: maxCell.height + padding,
              sourcePinned: contributions.some(item => item.sourcePinned)
            });
          }

          let borderKnown = true;
          if (rowEvidence.length > 1) {
            for (let index = 0; index < rowEvidence.length - 1; index += 1) {
              const borderValue = projectedProperty(rowEvidence[index].row, ['borderBelow']);
              const border = borderValue ? staticBoolean(borderValue) : true;
              if (border === false) continue;
              borderKnown = false;
              if (borderValue && staticBoolean(borderValue) === undefined) {
                this.addValueGap('height', borderValue, 'inter-row borderBelow is dynamic or unsupported', rowEvidence[index].row.source);
              } else {
                this.addGap(
                  'height',
                  'unknown',
                  rowEvidence[index].row.source,
                  'inter-row border contribution is not numerically source-proven because Helper.borderSize comes from the runtime widget-system size',
                  borderValue?.expression || '<Helper.borderSize>'
                );
              }
            }
          }

          const frame = table.frameKey ? this.frames.get(table.frameKey) : undefined;
          const tableYValue = table.tableY;
          const maxVisibleValue = table.maxVisibleHeight;
          const frameHeight = frame ? staticNumber(frame.frameHeight) : undefined;
          const tableY = tableYValue ? staticNumber(tableYValue) : 0;
          const maxVisibleHeight = maxVisibleValue ? staticNumber(maxVisibleValue) : 0;
          let visibleBoundary: number | undefined;
          let boundaryReason = '';
          let boundaryKnown = true;

          if (table.call.semantics.options && table.call.semantics.options.status !== 'static') {
            boundaryKnown = false;
            this.addValueGap('height', table.call.semantics.options, 'table y/maxVisibleHeight/scaling ownership is dynamic or unknown', table.call.source);
          }
          if (tableYValue && tableY === undefined) {
            boundaryKnown = false;
            this.addValueGap('height', tableYValue, 'table visible-height budget is unverified because table y is dynamic or unsupported', table.call.source);
          }
          if (maxVisibleValue && maxVisibleHeight === undefined) {
            boundaryKnown = false;
            this.addValueGap('height', maxVisibleValue, 'table visible-height budget is unverified because maxVisibleHeight is dynamic or unsupported', table.call.source);
          }
          if (!frame) {
            boundaryKnown = false;
            this.addGap('data-flow', 'unknown', table.call.source, 'table/frame visible-height budget is unverified because table/frame ownership is unresolved', table.call.semantics.frame?.expression || '<table/frame relationship>');
          } else if (!callsCompatible(table.call, frame.call)) {
            boundaryKnown = false;
            this.addGap(
              'data-flow',
              'unknown',
              table.call.source,
              'table/frame visible-height budget is unverified because the table and frame calls do not share one compatible execution context or branch path',
              table.call.semantics.frame?.expression || '<table/frame relationship>'
            );
          } else if (frameHeight === undefined) {
            boundaryKnown = false;
            this.addValueGap('height', frame.frameHeight, 'table visible-height budget is unverified because frame available height is omitted, dynamic, or unsupported', frame.call.source);
          }
          if (frame && frame.call.semantics.options && frame.call.semantics.options.status !== 'static') {
            boundaryKnown = false;
            this.addValueGap('height', frame.call.semantics.options, 'frame available-height semantics are dynamic or unknown', frame.call.source);
          }
          if (frame?.autoFrameHeight) {
            const autoFrameHeight = staticBoolean(frame.autoFrameHeight);
            if (autoFrameHeight !== false) {
              boundaryKnown = false;
              this.addGap(
                'height',
                valueStatus(frame.autoFrameHeight, 'boolean'),
                frame.autoFrameHeight.location,
                'table visible-height budget is unverified because autoFrameHeight=true or dynamic requires Helper.viewHeight/frame-y semantics that are not available in the source model',
                frame.autoFrameHeight.expression
              );
            }
          }

          if (boundaryKnown && frameHeight !== undefined && tableY !== undefined && maxVisibleHeight !== undefined) {
            const availableHeight = frameHeight - tableY;
            if (availableHeight > 0) {
              visibleBoundary = maxVisibleHeight > 0
                ? Math.min(maxVisibleHeight, availableHeight)
                : availableHeight;
              boundaryReason = maxVisibleHeight > 0
                ? `maxVisibleHeight ${maxVisibleHeight} clamped by frame available height ${availableHeight}`
                : `frame available height ${frameHeight} minus table y ${tableY}`;
            } else {
              boundaryKnown = false;
              this.addGap('height', 'unknown', table.call.source, 'table visible-height budget is unverified because table y leaves no positive frame-available height', tableYValue?.expression || '<table y>');
            }
          }

          if (rowEvidenceKnown && borderKnown && visibleBoundary !== undefined && rowEvidence.length === table.rowCalls.length) {
            const rowSum = rowEvidence.reduce((sum, item) => sum + item.height, 0);
            const sourcePinned = rowEvidence.some(item => item.sourcePinned);
            if (rowSum > visibleBoundary) {
              this.addFinding({
                rule: X4_UI_LINT_RULES.rowHeightBudget,
                severity: 'warning',
                message: `Source-derived row height ${rowSum} exceeds the ${boundaryReason}.`,
                cause: sourcePinned
                  ? 'The resolved source-linked cell row maxima plus literal row padding exceed the actual visible-height boundary; button default Helper.standardButtonHeight is source-pinned to 25.'
                  : 'The resolved source-linked cell row maxima plus literal row padding exceed the actual visible-height boundary.',
                failureMode: 'The explicit row overflow consumes frame budget and can make the last table silently vanish.',
                evidenceBoundary: 'Only compatible source-linked cell geometry, row maxima (not column sums), literal row padding, source-proven borders, and a resolved maxVisibleHeight or frame/table-y boundary produce this warning; no universal height threshold is assumed.',
                nextAction: 'Reduce the rendered cell geometry or row padding, increase the visible-height boundary, then verify the layout in-game.',
                location: table.call.source
              });
            }
          } else if (hasRows && !rowEvidenceKnown) {
            this.addGap('height', 'unknown', table.call.source, 'row-height budget is unverified because one or more source-linked cell, padding, branch, loop, or scale facts are incomplete', '<source-derived row full height>');
          } else if (hasRows && !boundaryKnown) {
            this.addGap('height', 'unknown', table.call.source, 'row-height budget is unverified because the actual visible-height boundary is incomplete', '<visible-height boundary>');
          }
        }
      }

      const frame = table.frameKey ? this.frames.get(table.frameKey) : undefined;
      if (!frame) {
        if (table.tableHeight) {
          this.addValueGap('data-flow', table.call.semantics.frame, 'table/frame ownership is unresolved, so frame-height budget cannot be checked', table.call.source);
        }
        continue;
      }
      if (!callsCompatible(table.call, frame.call)) {
        this.addGap(
          'data-flow',
          'unknown',
          table.call.source,
          'table/frame height budget is unverified because the table and frame calls do not share one compatible execution context or branch path',
          table.call.semantics.frame?.expression || '<table/frame relationship>'
        );
        continue;
      }
      const frameHeight = staticNumber(frame.frameHeight);
      if (tableHeight === undefined || frameHeight === undefined) {
        if (tableHeight !== undefined || frameHeight !== undefined) {
          this.addValueGap('height', table.tableHeight || frame.frameHeight, 'table/frame height budget is unverified because one literal height is omitted, dynamic, or unsupported', table.tableHeight ? table.call.source : frame.call.source);
        }
        continue;
      }
      if (tableHeight > frameHeight) {
        this.addFinding({
          rule: X4_UI_LINT_RULES.tableHeightBudget,
          severity: 'warning',
          message: `Literal table height ${tableHeight} is above the literal frame height ${frameHeight}.`,
          cause: 'The resolved table-height budget exceeds its resolved containing frame height.',
          failureMode: 'The table can extend beyond the frame and clip or overlap neighboring UI.',
          evidenceBoundary: 'Only a resolved table/frame relationship with literal heights produces this warning; no universal height threshold is assumed.',
          nextAction: 'Reduce the table height or increase the frame height, then verify the rendered layout in-game.',
          location: table.call.source
        });
      }
    }
  }

  private checkInlineDisplay(): void {
    for (const call of this.calls) {
      if (call.name !== 'display' || !contextIsHandler(call.context)) continue;
      this.addFinding({
        rule: X4_UI_LINT_RULES.inlineDisplay,
        severity: 'warning',
        message: 'display() is called directly inside an assigned onClick handler.',
        cause: 'The call-model handler context directly contains a frame rebuild/display call.',
        failureMode: 'The engine keeps presenting the old frame, making interactions appear one click late.',
        evidenceBoundary: 'Only a direct display call in a model-proven onClick handler is warned; top-level and deferred/helper calls are not.',
        nextAction: 'Set a dirty/deferred-update flag in onClick and perform the display/rebuild in the normal update path.',
        location: call.source
      });
    }
  }

  private menuFactsForValue(value: X4UiValue | undefined): MenuFacts {
    const reference = staticReference(value);
    if (reference) {
      const byReference = this.menuFactsByReference.get(referenceKey(reference));
      const byPath = reference.path ? this.menuFactsByPath.get(reference.path) : undefined;
      if (byReference || byPath) return byReference || byPath || { nameKnown: false, layerKnown: false };
    }
    const name = staticString(value);
    if (name !== undefined) return { name, nameKnown: true, layerKnown: false };
    return { nameKnown: false, layerKnown: false };
  }

  private currentMenuFacts(context: X4UiFunctionContext): MenuFacts {
    const candidates = new Map<string, MenuFacts>();
    let unresolvedCandidate = false;
    for (const frame of this.frames.values()) {
      if (!branchPathsCompatible(frame.call.context, context)) continue;
      const reference = staticReference(frame.call.semantics.menu);
      if (!reference || reference.kind !== 'menu') {
        unresolvedCandidate = true;
        continue;
      }
      const key = referenceKey(reference);
      if (!candidates.has(key)) candidates.set(key, this.menuFactsForValue(frame.call.semantics.menu));
    }
    if (unresolvedCandidate || candidates.size !== 1) return { nameKnown: false, layerKnown: false };
    return candidates.values().next().value || { nameKnown: false, layerKnown: false };
  }

  private menuFactsForName(name: string): MenuFacts | undefined {
    let match: MenuFacts | undefined;
    for (const [key, facts] of this.menuFactsByReference) {
      const reference = this.menuReferencesByKey.get(key);
      if (!reference || reference.kind !== 'menu') continue;
      if (!facts.nameKnown) return undefined;
      if (facts.name !== name) continue;
      if (match) return undefined;
      match = facts;
    }
    return match;
  }

  private targetMenuFacts(call: X4UiCallRecord): MenuFacts {
    const reference = staticReference(call.semantics.menu);
    const facts = this.menuFactsForValue(call.semantics.menu);
    const name = staticString(call.semantics.menuName);
    const layer = staticNumber(call.semantics.layer);
    if (!reference) {
      const targetName = name !== undefined ? name : staticString(call.semantics.menu);
      const namedFacts = targetName !== undefined ? this.menuFactsForName(targetName) : undefined;
      return namedFacts || {
        name: targetName,
        nameKnown: targetName !== undefined,
        layerKnown: false
      };
    }
    const referenceKeyValue = referenceKey(reference);
    const hasIndexedFacts = this.menuFactsByReference.has(referenceKeyValue)
      || (reference.path ? this.menuFactsByPath.has(reference.path) : false);
    return {
      name: facts.nameKnown ? facts.name : hasIndexedFacts ? undefined : name,
      nameKnown: facts.nameKnown || (!hasIndexedFacts && name !== undefined),
      layer: facts.layerKnown ? facts.layer : hasIndexedFacts ? undefined : layer,
      layerKnown: facts.layerKnown || (!hasIndexedFacts && layer !== undefined)
    };
  }

  private checkSameLayerInlineOpen(): void {
    for (const call of this.calls) {
      if (call.name !== 'OpenMenu' || !contextIsHandler(call.context)) continue;
      const current = this.currentMenuFacts(call.context);
      const target = this.targetMenuFacts(call);
      if (!current.nameKnown || !target.nameKnown || !current.layerKnown || !target.layerKnown) {
        this.addGap(
          'layer',
          'unknown',
          call.source,
          'inline OpenMenu lacks proven current/target menu identity or literal layer equality evidence',
          call.semantics.menu?.expression || '<OpenMenu target>'
        );
        continue;
      }
      if (current.layer !== target.layer) continue;
      this.addFinding({
        rule: X4_UI_LINT_RULES.sameLayerInlineOpen,
        severity: 'error',
        message: `onClick directly opens a menu on the same literal layer ${current.layer}.`,
        cause: `Current menu "${current.name}" and target menu "${target.name}" are resolved with equal literal layers.`,
        failureMode: 'The first menu re-render can paint over the second.',
        evidenceBoundary: 'This error requires direct onClick context plus proven current/target identities and equal literal layer values.',
        nextAction: 'Defer the OpenMenu operation through the normal update/event path or use a proven different layer.',
        location: call.source
      });
    }
  }
}

/** Evaluate one already-built X4 UI call model without external side effects. */
export function lintX4UiCallModel(model: X4UiCallModel): X4UiLintResult {
  return new X4UiLintEvaluator(model).evaluate();
}

/** Semantic alias for callers that name the operation after its result. */
export const runX4UiLint = lintX4UiCallModel;
