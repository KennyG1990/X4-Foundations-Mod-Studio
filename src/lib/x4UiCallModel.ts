/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A deliberately narrow, source-located model of the X4 UI Lua call shapes
 * consumed by the UI linter. This is not a Lua interpreter and intentionally
 * does not make lint decisions. It records what can be traced statically and
 * keeps dynamic or unsupported relationships visible to later rules.
 */

import { parse } from 'luaparse';

const MAX_VERIFICATION_GAPS = 128;

const RELEVANT_CALL_NAMES = new Set<X4UiRelevantCallName>([
  'createFrameHandle',
  'addTable',
  'setColWidthPercent',
  'setColWidth',
  'addRow',
  'setColSpan',
  'display',
  'OpenMenu',
  'setText',
  'setText2',
  'createText',
  'createEditBox',
  'createButton',
  'createIcon',
  'scaleX',
  'scaleY',
  'scaleFont'
]);

const KNOWN_X4_GLOBALS = new Set(['Helper', 'Menus', 'OpenMenu', 'widgetSystem']);

const KNOWN_HELPER_CONSTANTS = new Set([
  'standardTextHeight',
  'standardButtonHeight',
  'borderSize',
  'viewWidth',
  'viewHeight'
]);

const V1_PROPERTY_NAMES_BY_CALL: Readonly<Record<string, readonly string[]>> = {
  createFrameHandle: [
    'x', 'y', 'width', 'height', 'layer', 'standardButtons', 'backgroundID',
    'backgroundColor', 'blurBackground', 'autoFrameHeight'
  ],
  addTable: [
    'x', 'y', 'width', 'tabOrder', 'backgroundID', 'backgroundColor', 'highlightMode',
    'maxVisibleHeight', 'reserveScrollBar', 'scaling'
  ],
  addRow: ['height', 'paddingTop', 'paddingBottom', 'borderBelow', 'fixed', 'scaling', 'interactive'],
  createText: [
    'color', 'fontsize', 'halign', 'wordwrap', 'font', 'cellBGColor', 'x', 'y', 'width', 'height', 'scaling',
    'minRowHeight'
  ],
  setText: [
    'color', 'fontsize', 'halign', 'font', 'x', 'y', 'scaling'
  ],
  setText2: [
    'color', 'fontsize', 'halign', 'font', 'x', 'y', 'scaling'
  ],
  createButton: [
    'active', 'bgColor', 'highlightColor', 'borderColor', 'width', 'height', 'x', 'y', 'scaling', 'affectRowHeight'
  ],
  createEditBox: [
    'x', 'y', 'width', 'height', 'defaultText', 'description', 'maxChars', 'selectTextOnActivation',
    'active', 'bgColor', 'scaling'
  ],
  createIcon: ['width', 'height', 'color', 'affectRowHeight', 'x', 'y', 'scaling']
};

const COLOR_PROPERTY_NAMES = new Set([
  'color',
  'bgcolor',
  'highlightcolor',
  'bordercolor',
  'backgroundcolor',
  'cellbgcolor'
]);

type LuaNode = {
  type?: string;
  [key: string]: unknown;
};

interface LuaPositionLike {
  line?: number;
  column?: number;
}

interface LuaLocationLike {
  start?: LuaPositionLike;
  end?: LuaPositionLike;
}

export interface X4UiLuaFileInput {
  /** Repository-relative or otherwise displayable Lua path. */
  rel: string;
  text: string;
  /** Optional packed/source path retained for consumers that need provenance. */
  sourcePath?: string;
}

export interface X4UiSourcePosition {
  /** Lua/luaparse line numbers are one-based. */
  line: number;
  /** Lua/luaparse columns are zero-based. */
  column: number;
  /** UTF-16 source offset, matching JavaScript string ranges. */
  offset: number;
}

export interface X4UiSourceLocation {
  file: string;
  sourcePath?: string;
  start: X4UiSourcePosition;
  end: X4UiSourcePosition;
}

export type X4UiValueStatus = 'static' | 'dynamic' | 'unknown';

export type X4UiValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'nil'
  | 'table'
  | 'function'
  | 'reference'
  | 'identifier'
  | 'expression'
  | 'unknown';

export type X4UiLiteral = string | number | boolean | null;

export type X4UiHelperNumericConstantName =
  | 'standardTextHeight'
  | 'standardButtonHeight'
  | 'borderSize'
  | 'viewWidth'
  | 'viewHeight';

export interface X4UiValueReference {
  kind: 'global' | 'menu' | 'frame' | 'table' | 'row' | 'cell' | 'object' | 'handler' | 'unknown';
  path: string;
  origin: 'global' | 'literal' | 'call' | 'alias' | 'index' | 'property' | 'unknown';
  source: X4UiSourceLocation;
  parentPath?: string;
  relatedPath?: string;
  index?: X4UiValue;
  /** Exact rawget call that established a preview-only Helper receiver alias. */
  helperAliasSource?: X4UiSourceLocation;
  /** Receiver identity is source-proven, but runtime non-nil availability is not. */
  helperRuntimeAvailability?: 'unverified';
}

/**
 * A value is static only when its literal or constant-folded result is known.
 * References are static data-flow facts when their tracked object is known;
 * dynamic/unknown references remain represented rather than being discarded.
 */
export interface X4UiStaticValue<T = X4UiLiteral> {
  status: X4UiValueStatus;
  type: X4UiValueType;
  value?: T;
  expression: string;
  location: X4UiSourceLocation;
  reference?: X4UiValueReference;
  symbol?: string;
  reason?: string;
  /** Exact local-function parameter identity when this is a direct parameter use. */
  parameter?: X4UiLocalFunctionParameterIdentity;
  /** Exact local-helper call result that produced this otherwise-dynamic value. */
  localInvocationResult?: X4UiLocalInvocationResultIdentity;
  /** Exact direct Helper.scale* call that produced this local result. */
  directHelperScaleResult?: X4UiDirectHelperScaleResultIdentity;
  /** Closed source-proven numeric expression; profile-bound evaluation is deferred to the layout program. */
  numericExpression?: X4UiNumericExpression;
  /** Original literal range; direct argument binding requires this to equal the use range. */
  sourceLiteral?: X4UiSourceLocation;
}

export type X4UiValue = X4UiStaticValue<X4UiLiteral>;

export type X4UiBranchReachability = 'reachable' | 'conditional' | 'unreachable';

export type X4UiBranchArm = 'then' | 'elseif' | 'else';

/**
 * One lexical if/elseif/else arm in a record's source path. The boundary ID
 * identifies the whole IfStatement; the arm ID identifies one arm within it.
 */
export interface X4UiBranchPathSegment {
  readonly boundaryId: string;
  readonly boundary: X4UiSourceLocation;
  readonly armId: string;
  readonly arm: X4UiBranchArm;
  readonly armIndex: number;
  /** Reachability of the path through this arm, including enclosing paths. */
  readonly reachability: X4UiBranchReachability;
}

export type X4UiLoopKind = 'while' | 'repeat' | 'numeric-for' | 'generic-for';

export type X4UiLoopMultiplicity = 'zero-or-more' | 'one-or-more';

/** One lexical loop body enclosing a record in source. */
export interface X4UiLoopPathSegment {
  readonly source: X4UiSourceLocation;
  readonly kind: X4UiLoopKind;
  readonly multiplicity: X4UiLoopMultiplicity;
}

export type X4UiEnclosingStatementKind =
  | 'local'
  | 'assignment'
  | 'function'
  | 'call'
  | 'return'
  | 'if'
  | 'while'
  | 'repeat'
  | 'numeric-for'
  | 'generic-for'
  | 'do'
  | 'break'
  | 'goto'
  | 'label'
  | 'unknown';

export type X4UiCallStatementTerminator = 'none' | 'semicolon';

/** Exact source-derived statement boundary associated with a relevant call. */
export interface X4UiCallStatementProvenance {
  readonly source: X4UiSourceLocation;
  readonly deletionSource: X4UiSourceLocation;
  readonly terminator: X4UiCallStatementTerminator;
  readonly kind: X4UiEnclosingStatementKind;
  readonly isStandaloneCallStatementRoot: boolean;
}

export interface X4UiFunctionContext {
  kind: 'top-level' | 'function' | 'handler';
  name?: string;
  handler?: string;
  source?: X4UiSourceLocation;
  readonly branchPath: readonly X4UiBranchPathSegment[];
  readonly loopPath: readonly X4UiLoopPathSegment[];
  readonly reachability: X4UiBranchReachability;
}

export type X4UiRelevantCallName =
  | 'createFrameHandle'
  | 'addTable'
  | 'setColWidthPercent'
  | 'setColWidth'
  | 'addRow'
  | 'setColSpan'
  | 'display'
  | 'OpenMenu'
  | 'setText'
  | 'setText2'
  | 'createText'
  | 'createEditBox'
  | 'createButton'
  | 'createIcon'
  | 'scaleX'
  | 'scaleY'
  | 'scaleFont';

export interface X4UiEditBoxSemantics {
  defaultText?: X4UiValue;
  description?: X4UiValue;
}

/** Exact source range and numeric spelling of one source-literal color field. */
export interface X4UiColorSourceField {
  readonly value: number;
  readonly expression: string;
  readonly source: X4UiSourceLocation;
  readonly keySource: X4UiSourceLocation;
}

/** Exact source range of a symbolic or dynamic Color[...] key. */
export interface X4UiColorSourceKey {
  readonly expression: string;
  readonly source: X4UiSourceLocation;
}

export interface X4UiColorLiteralExpression {
  readonly kind: 'literal-table';
  readonly resolution: 'source-only';
  readonly expression: string;
  readonly source: X4UiSourceLocation;
  /** Exact source-owned literal declaration used by the expression. */
  readonly declarationExpression: string;
  readonly declarationSource: X4UiSourceLocation;
  readonly r: X4UiColorSourceField;
  readonly g: X4UiColorSourceField;
  readonly b: X4UiColorSourceField;
  readonly a: X4UiColorSourceField;
  readonly glow?: X4UiColorSourceField;
}

export interface X4UiColorSymbolicReferenceExpression {
  readonly kind: 'symbolic-reference';
  readonly resolution: 'symbolic-only';
  readonly base: 'Color';
  readonly id: string;
  readonly key: X4UiColorSourceKey;
  readonly expression: string;
  readonly source: X4UiSourceLocation;
}

export interface X4UiColorDynamicReferenceExpression {
  readonly kind: 'dynamic-reference';
  readonly resolution: 'unresolved';
  readonly base: 'Color';
  readonly key: X4UiColorSourceKey;
  readonly expression: string;
  readonly source: X4UiSourceLocation;
  readonly reason: string;
}

export interface X4UiColorConditionalExpression {
  readonly kind: 'conditional';
  readonly resolution: 'unresolved';
  readonly operator: string;
  readonly operands: readonly X4UiColorSourceKey[];
  readonly expression: string;
  readonly source: X4UiSourceLocation;
}

export interface X4UiColorFunctionExpression {
  readonly kind: 'function-call';
  readonly resolution: 'unresolved';
  readonly calleeExpression: string;
  readonly calleeSource: X4UiSourceLocation;
  readonly argumentSources: readonly X4UiSourceLocation[];
  readonly expression: string;
  readonly source: X4UiSourceLocation;
}

export interface X4UiColorScalarExpression {
  readonly kind: 'scalar';
  readonly resolution: 'existing-value';
  readonly status: X4UiValueStatus;
  readonly type: X4UiValueType;
  readonly expression: string;
  readonly source: X4UiSourceLocation;
  readonly value?: X4UiLiteral;
  readonly reason?: string;
}

export interface X4UiColorUnresolvedExpression {
  readonly kind: 'unresolved';
  readonly resolution: 'unresolved';
  readonly expression: string;
  readonly source: X4UiSourceLocation;
  readonly reason: string;
}

/**
 * Source-only color evidence. This union deliberately has no resolved RGBA,
 * default-map, or current-runtime fields.
 */
export type X4UiColorExpression =
  | X4UiColorLiteralExpression
  | X4UiColorSymbolicReferenceExpression
  | X4UiColorDynamicReferenceExpression
  | X4UiColorConditionalExpression
  | X4UiColorFunctionExpression
  | X4UiColorScalarExpression
  | X4UiColorUnresolvedExpression;

/** One color expression emitted for a specific source option projection. */
export interface X4UiCallColorExpression {
  readonly callName: X4UiRelevantCallName;
  readonly callSource: X4UiSourceLocation;
  readonly propertyName: string;
  readonly source: X4UiSourceLocation;
  readonly colorExpression: X4UiColorExpression;
}

/** One source-located property value projected from a known v1 option table. */
export interface X4UiCallPropertyProjection {
  /** The spelling used by the Lua table key. */
  name: string;
  /** Normalized lookup form; the source spelling remains in `name`. */
  normalizedName: string;
  /** The exact source expression value, including status and range. */
  value: X4UiValue;
  /** Exact range of the value expression in the option table. */
  source: X4UiSourceLocation;
  /** UTF-16 source offset of the value expression. */
  sourceOrder: number;
}

export interface X4UiScaleSemantics {
  input?: X4UiValue;
  fontname?: X4UiValue;
  fontsize?: X4UiValue;
  enabled?: X4UiValue;
}

export interface X4UiCallSemantics {
  count?: X4UiValue;
  index?: X4UiValue;
  span?: X4UiValue;
  width?: X4UiValue;
  percentage?: X4UiValue;
  height?: X4UiValue;
  layer?: X4UiValue;
  menu?: X4UiValue;
  menuName?: X4UiValue;
  frame?: X4UiValue;
  table?: X4UiValue;
  row?: X4UiValue;
  cell?: X4UiValue;
  dataFlow?: X4UiValue;
  text?: X4UiValue;
  editBox?: X4UiEditBoxSemantics;
  fontsize?: X4UiValue;
  /** The call's option-table argument, when one was supplied. */
  options?: X4UiValue;
  /** Ordered, recognized properties from a statically known option table. */
  properties?: X4UiCallPropertyProjection[];
  /** Ordered source properties that the shipped descriptor family does not apply. */
  unsupportedProperties?: X4UiCallPropertyProjection[];
  /** addRow argument zero; this is row data/selectability, not properties.interactive. */
  rowData?: X4UiValue;
  icon?: X4UiValue;
  scaling?: X4UiValue;
  scale?: X4UiScaleSemantics;
}

export interface X4UiCallRecord {
  recordType: 'call';
  name: X4UiRelevantCallName;
  callee: string;
  method: ':' | '.' | 'direct' | 'unknown';
  source: X4UiSourceLocation;
  /** Exact immutable enclosing Lua statement and standalone-call-root fact. */
  enclosingStatement: X4UiCallStatementProvenance;
  /** Source offset of the callee/member, useful for fluent-chain ordering. */
  sourceOrder: number;
  /** Global order in the model's ordered records array. */
  order: number;
  arguments: X4UiValue[];
  receiver?: X4UiValue;
  semantics: X4UiCallSemantics;
  result?: X4UiValueReference;
  assignedTo?: string[];
  context: X4UiFunctionContext;
}

export type X4UiPropertyAssignment =
  | 'table-field'
  | 'member-assignment'
  | 'index-assignment'
  | 'function-declaration';

export interface X4UiPropertyRecord {
  recordType: 'property';
  name: string;
  path: string;
  source: X4UiSourceLocation;
  sourceOrder: number;
  order: number;
  owner?: X4UiValue;
  value: X4UiValue;
  assignment: X4UiPropertyAssignment;
  context: X4UiFunctionContext;
}

export interface X4UiHandlerRecord {
  recordType: 'handler';
  name: 'onClick';
  path: string;
  source: X4UiSourceLocation;
  sourceOrder: number;
  order: number;
  value: X4UiValue;
  functionSource?: X4UiSourceLocation;
  bodySource?: X4UiSourceLocation;
  parameters?: string[];
  context: X4UiFunctionContext;
}

export interface X4UiAliasRecord {
  recordType: 'alias';
  name: string;
  source: X4UiSourceLocation;
  sourceOrder: number;
  order: number;
  value: X4UiValue;
  aliasKind: 'definition' | 'assignment';
  context: X4UiFunctionContext;
}

/** A parameter is identified by its declaration range, never by spelling alone. */
export interface X4UiLocalFunctionParameterIdentity {
  readonly id: string;
  readonly declarationId: string;
  readonly index: number;
  readonly name: string;
  readonly source: X4UiSourceLocation;
}

/** Exact source identity of an invoked local helper's unmodeled return value. */
export interface X4UiLocalInvocationResultIdentity {
  readonly invocationId: string;
  readonly source: X4UiSourceLocation;
  readonly expression: string;
}

/** Exact source identity of a directly bound Helper scale result. */
export type X4UiDirectHelperScaleCallName = 'scaleX' | 'scaleY' | 'scaleFont';

export interface X4UiDirectHelperScaleResultIdentity {
  readonly callName: X4UiDirectHelperScaleCallName;
  readonly callSource: X4UiSourceLocation;
  readonly callExpression: string;
  readonly bindingName: string;
  readonly bindingSource: X4UiSourceLocation;
}

export interface X4UiNumericHelperReceiver {
  readonly name: string;
  readonly origin: 'global' | 'alias';
  readonly source: X4UiSourceLocation;
  readonly aliasSource?: X4UiSourceLocation;
}

export type X4UiNumericExpression =
  | {
    readonly kind: 'literal';
    readonly value: number;
    readonly expression: string;
    readonly source: X4UiSourceLocation;
  }
  | {
    readonly kind: 'helper-constant';
    readonly name: X4UiHelperNumericConstantName;
    readonly receiver: X4UiNumericHelperReceiver;
    readonly expression: string;
    readonly source: X4UiSourceLocation;
  }
  | {
    readonly kind: 'direct-helper-scale';
    readonly identity: X4UiDirectHelperScaleResultIdentity;
    readonly expression: string;
    readonly source: X4UiSourceLocation;
  }
  | {
    readonly kind: 'group';
    readonly operand: X4UiNumericExpression;
    readonly expression: string;
    readonly source: X4UiSourceLocation;
  }
  | {
    readonly kind: 'unary';
    readonly operator: '+' | '-';
    readonly operand: X4UiNumericExpression;
    readonly expression: string;
    readonly source: X4UiSourceLocation;
  }
  | {
    readonly kind: 'binary';
    readonly operator: '+' | '-' | '*' | '/';
    readonly left: X4UiNumericExpression;
    readonly right: X4UiNumericExpression;
    readonly expression: string;
    readonly source: X4UiSourceLocation;
  }
  | {
    readonly kind: 'or';
    readonly left: X4UiNumericExpression;
    readonly right: X4UiNumericExpression;
    readonly expression: string;
    readonly source: X4UiSourceLocation;
  };

export interface X4UiLocalFunctionDeclaration {
  readonly id: string;
  readonly name: string;
  readonly source: X4UiSourceLocation;
  readonly identifierSource: X4UiSourceLocation;
  readonly bodySource: X4UiSourceLocation;
  readonly parameters: readonly X4UiLocalFunctionParameterIdentity[];
  readonly hasVarargs: boolean;
  readonly returnSources: readonly X4UiSourceLocation[];
  readonly context: X4UiFunctionContext;
}

export type X4UiLocalFunctionInvocationStatus = 'supported' | 'unsupported';

export interface X4UiLocalFunctionInvocation {
  readonly id: string;
  readonly source: X4UiSourceLocation;
  readonly sourceOrder: number;
  readonly calleeSource: X4UiSourceLocation;
  readonly calleeExpression: string;
  readonly method: X4UiCallRecord['method'];
  readonly arguments: readonly X4UiValue[];
  readonly context: X4UiFunctionContext;
  readonly resultConsumed: boolean;
  readonly status: X4UiLocalFunctionInvocationStatus;
  readonly calleeDeclarationId?: string;
  readonly resolution?: 'direct' | 'alias';
  readonly reason?: string;
}

export type X4UiHelperReceiverAliasStatus = 'bound' | 'preserved' | 'invalidated' | 'rejected';

/** The one bounded rawget(_G, "Helper") receiver-alias fact. */
export interface X4UiHelperReceiverAliasFact {
  readonly id: string;
  readonly name: string;
  readonly source: X4UiSourceLocation;
  readonly targetSource: X4UiSourceLocation;
  readonly callSource?: X4UiSourceLocation;
  readonly aliasKind: 'definition' | 'assignment';
  readonly status: X4UiHelperReceiverAliasStatus;
  readonly runtimeAvailability: 'unverified';
  readonly reason: string;
  readonly context: X4UiFunctionContext;
}

export type X4UiRelevantRecord =
  | X4UiCallRecord
  | X4UiPropertyRecord
  | X4UiHandlerRecord
  | X4UiAliasRecord;

export type X4UiVerificationGapCategory =
  | 'parse'
  | 'unsupported'
  | 'count'
  | 'index'
  | 'span'
  | 'width'
  | 'percentage'
  | 'height'
  | 'layer'
  | 'menu'
  | 'data-flow'
  | 'text'
  | 'edit-box'
  | 'fontsize'
  | 'property'
  | 'scale';

export interface X4UiVerificationGap {
  category: X4UiVerificationGapCategory;
  status: X4UiValueStatus | 'unsupported';
  expression: string;
  reason: string;
  source: X4UiSourceLocation;
}

export interface X4UiCallModel {
  file: X4UiLuaFileInput;
  parsed: boolean;
  calls: X4UiCallRecord[];
  properties: X4UiPropertyRecord[];
  handlers: X4UiHandlerRecord[];
  aliases: X4UiAliasRecord[];
  /** Same-file local functions with exact declaration/body/parameter identities. */
  localFunctions: readonly X4UiLocalFunctionDeclaration[];
  /** Direct call sites, including explicit unsupported expansion candidates. */
  localInvocations: readonly X4UiLocalFunctionInvocation[];
  /** Exact production Helper receiver aliases and their invalidation history. */
  helperReceiverAliases: readonly X4UiHelperReceiverAliasFact[];
  /** Frozen, serializable source-only color evidence keyed by call/property provenance. */
  colorExpressions: readonly X4UiCallColorExpression[];
  /** All relevant records, sorted by source order. */
  records: X4UiRelevantRecord[];
  verificationGaps: X4UiVerificationGap[];
  verificationGapsTruncated: boolean;
}

interface TrackedObject {
  id: number;
  reference: X4UiValueReference;
  known: boolean;
  fields: Map<string, InternalValue>;
  indexed: Map<string, TrackedObject>;
  aliases: Set<string>;
  mutated: boolean;
  mutatedProperties: Set<string>;
  /** Private AST declaration retained for source-owned literal resolution. */
  declarationNode?: LuaNode;
  cellKind?: 'text' | 'button' | 'editbox' | 'icon';
}

interface InternalValue {
  publicValue: X4UiValue;
  /** AST node at the exact value use; private source evidence only. */
  sourceNode?: LuaNode;
  object?: TrackedObject;
  functionNode?: LuaNode;
  localFunction?: InternalLocalFunction;
  helperAlias?: InternalHelperAlias;
  helperAliasCandidate?: InternalHelperAliasCandidate;
  directHelperScaleCall?: InternalDirectHelperScaleCall;
}

interface InternalDirectHelperScaleCall {
  readonly callName: X4UiDirectHelperScaleCallName;
  readonly source: X4UiSourceLocation;
  readonly expression: string;
}

interface InternalLocalFunction {
  readonly node: LuaNode;
  readonly declaration: X4UiLocalFunctionDeclaration;
  readonly declaredName: string;
  readonly declarationBindingSource: X4UiSourceLocation;
}

interface InternalHelperAlias {
  readonly name: string;
  readonly bindingSource: X4UiSourceLocation;
  readonly callSource: X4UiSourceLocation;
}

interface InternalHelperAliasCandidate {
  readonly valid: boolean;
  readonly callSource: X4UiSourceLocation;
  readonly reason: string;
}

interface PendingRecord {
  record: X4UiRelevantRecord;
  sourceOffset: number;
  tie: number;
}

interface ControlFlowMutationState {
  functionAnalysisDepth: number;
  propertyMutations: Map<TrackedObject, Set<string>>;
  unknownPropertyObjects: Set<TrackedObject>;
  preservedHelperAliases: Set<string>;
  invalidatedHelperAliases: Set<string>;
}

interface TrackedObjectStateSnapshot {
  reference: X4UiValueReference;
  known: boolean;
  fields: Array<[string, InternalValue]>;
  indexed: Array<[string, TrackedObject]>;
  aliases: string[];
  mutated: boolean;
  mutatedProperties: string[];
}

interface Binding {
  value: InternalValue;
  source?: X4UiSourceLocation;
}

interface CallShape {
  name?: string;
  receiver?: LuaNode;
  method: X4UiCallRecord['method'];
  calleeNode: LuaNode;
  args: LuaNode[];
}

interface LuaErrorLike {
  message?: unknown;
  line?: unknown;
  column?: unknown;
  index?: unknown;
}

function isLuaNode(value: unknown): value is LuaNode {
  return typeof value === 'object' && value !== null;
}

function nodeField<T>(node: LuaNode | undefined, key: string): T | undefined {
  return node ? (node[key] as T | undefined) : undefined;
}

function nodeArray(node: LuaNode | undefined, key: string): LuaNode[] {
  const value = nodeField<unknown>(node, key);
  return Array.isArray(value) ? value.filter(isLuaNode) : [];
}

function nodeRange(node: LuaNode | undefined): [number, number] | undefined {
  const value = nodeField<unknown>(node, 'range');
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const start = value[0];
  const end = value[1];
  if (typeof start !== 'number' || typeof end !== 'number') return undefined;
  return [start, end];
}

function normalizePropertyName(name: string): string {
  return name.replace(/[-_\s]/g, '').toLowerCase();
}

function normalizeStatementKind(type: string | undefined): X4UiEnclosingStatementKind {
  switch (type) {
    case 'LocalStatement': return 'local';
    case 'AssignmentStatement': return 'assignment';
    case 'FunctionDeclaration': return 'function';
    case 'CallStatement': return 'call';
    case 'ReturnStatement': return 'return';
    case 'IfStatement': return 'if';
    case 'WhileStatement': return 'while';
    case 'RepeatStatement': return 'repeat';
    case 'ForNumericStatement': return 'numeric-for';
    case 'ForGenericStatement': return 'generic-for';
    case 'DoStatement': return 'do';
    case 'BreakStatement': return 'break';
    case 'GotoStatement': return 'goto';
    case 'LabelStatement': return 'label';
    default: return 'unknown';
  }
}

function isOnClick(name: string): boolean {
  return normalizePropertyName(name) === 'onclick';
}

function decodeLuaString(raw: string): string | undefined {
  if (raw.startsWith('[[') || /^\[=+\[/.test(raw)) {
    const opening = raw.match(/^\[(=*)\[/);
    if (!opening) return undefined;
    const closing = `]${opening[1]}]`;
    if (!raw.endsWith(closing)) return undefined;
    return raw.slice(opening[0].length, raw.length - closing.length);
  }

  if (raw.length < 2) return undefined;
  const quote = raw[0];
  if ((quote !== '"' && quote !== "'") || raw[raw.length - 1] !== quote) return undefined;
  const body = raw.slice(1, -1);
  let output = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char !== '\\') {
      output += char;
      continue;
    }

    index += 1;
    if (index >= body.length) return undefined;
    const escaped = body[index];
    const simple: Record<string, string> = {
      a: '\u0007',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\u000b',
      '\\': '\\',
      '"': '"',
      "'": "'"
    };
    if (Object.prototype.hasOwnProperty.call(simple, escaped)) {
      output += simple[escaped];
      continue;
    }
    if (escaped === '\n') continue;
    if (escaped === 'z') {
      while (index + 1 < body.length && /\s/.test(body[index + 1])) index += 1;
      continue;
    }
    if (escaped === 'x' && /^[0-9a-fA-F]{2}$/.test(body.slice(index + 1, index + 3))) {
      output += String.fromCharCode(parseInt(body.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }
    if (/\d/.test(escaped)) {
      const digits = body.slice(index).match(/^\d{1,3}/)?.[0];
      if (!digits) return undefined;
      output += String.fromCharCode(parseInt(digits, 10));
      index += digits.length - 1;
      continue;
    }
    return undefined;
  }
  return output;
}

function staticString(node: LuaNode | undefined): string | undefined {
  if (!node || node.type !== 'StringLiteral') return undefined;
  const value = nodeField<unknown>(node, 'value');
  if (typeof value === 'string') return value;
  const raw = nodeField<unknown>(node, 'raw');
  return typeof raw === 'string' ? decodeLuaString(raw) : undefined;
}

function staticNumber(node: LuaNode | undefined): number | undefined {
  if (!node || node.type !== 'NumericLiteral') return undefined;
  const value = nodeField<unknown>(node, 'value');
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = nodeField<unknown>(node, 'raw');
  if (typeof raw !== 'string') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function staticBoolean(node: LuaNode | undefined): boolean | undefined {
  if (!node || node.type !== 'BooleanLiteral') return undefined;
  const value = nodeField<unknown>(node, 'value');
  return typeof value === 'boolean' ? value : undefined;
}

function luaTruthy(value: X4UiValue): boolean | undefined {
  if (value.status !== 'static') {
    return value.type === 'number' && value.numericExpression ? true : undefined;
  }
  if (value.type === 'nil') return false;
  if (value.type === 'boolean') return value.value as boolean;
  return true;
}

function luaNodeName(node: LuaNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.type === 'Identifier') return nodeField<string>(node, 'name');
  if (node.type === 'MemberExpression') {
    return luaNodeName(nodeField<LuaNode>(node, 'identifier'));
  }
  return undefined;
}

const EMPTY_BRANCH_PATH: readonly X4UiBranchPathSegment[] = Object.freeze([]);
const EMPTY_LOOP_PATH: readonly X4UiLoopPathSegment[] = Object.freeze([]);

const freezeDeepFact = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const child of Object.values(value as Record<string, unknown>)) freezeDeepFact(child, seen);
  Object.freeze(object);
  return value;
};

const freezeNumericExpression = <T extends X4UiNumericExpression>(value: T): T => freezeDeepFact(value);

class X4UiCallModelBuilder {
  private readonly input: X4UiLuaFileInput;
  private readonly bindings = new Map<string, Binding>();
  private readonly pendingRecords: PendingRecord[] = [];
  private readonly gaps: X4UiVerificationGap[] = [];
  private readonly gapKeys = new Set<string>();
  private readonly processedFunctions = new Set<string>();
  private readonly handlerKeys = new Set<string>();
  private readonly resultCalls = new Map<number, X4UiCallRecord[]>();
  private readonly propertyObjects = new Map<X4UiPropertyRecord, TrackedObject | undefined>();
  private readonly handlerObjects = new Map<X4UiHandlerRecord, TrackedObject | undefined>();
  private readonly localFunctions: X4UiLocalFunctionDeclaration[] = [];
  private readonly localFunctionByNode = new Map<LuaNode, InternalLocalFunction>();
  private readonly localInvocations: X4UiLocalFunctionInvocation[] = [];
  private readonly helperReceiverAliases: X4UiHelperReceiverAliasFact[] = [];
  private readonly colorExpressions: X4UiCallColorExpression[] = [];
  private readonly controlFlowMutationStates: ControlFlowMutationState[] = [];
  private nextObjectId = 1;
  private nextRecordTie = 1;
  private gapsTruncated = false;
  private functionAnalysisDepth = 0;
  private currentStatement: LuaNode | undefined;
  private currentStandaloneCallStatementRoot: LuaNode | undefined;
  private readonly fullLocation: X4UiSourceLocation;
  private readonly topContext: X4UiFunctionContext;

  public constructor(input: X4UiLuaFileInput) {
    this.input = input;
    this.fullLocation = this.makeFullLocation();
    this.topContext = {
      kind: 'top-level',
      source: this.fullLocation,
      branchPath: EMPTY_BRANCH_PATH,
      loopPath: EMPTY_LOOP_PATH,
      reachability: 'reachable'
    };
  }

  public build(): X4UiCallModel {
    let ast: LuaNode;
    try {
      ast = parse(this.input.text, {
        comments: false,
        locations: true,
        ranges: true,
        scope: true,
        luaVersion: '5.2'
      }) as unknown as LuaNode;
    } catch (error) {
      const parsedError = error as LuaErrorLike;
      const location = this.errorLocation(parsedError);
      this.addGap(
        'parse',
        'unsupported',
        location,
        typeof parsedError.message === 'string' ? parsedError.message : 'Lua parser error'
      );
      return this.finish(false);
    }

    this.processStatements(nodeArray(ast, 'body'), new Map(this.bindings), this.topContext);
    return this.finish(true);
  }

  private finish(parsed: boolean): X4UiCallModel {
    const ordered = [...this.pendingRecords].sort((left, right) => {
      if (left.sourceOffset !== right.sourceOffset) return left.sourceOffset - right.sourceOffset;
      return left.tie - right.tie;
    });

    const records = ordered.map(item => item.record);
    records.forEach((record, index) => { record.order = index; });

    for (const [record, object] of this.propertyObjects) {
      if (object) record.path = `${object.reference.path}.${record.name}`;
    }
    for (const [record, object] of this.handlerObjects) {
      if (object) {
        record.path = `${object.reference.path}.onClick`;
        record.context.name = record.path;
      }
    }

    const calls = records.filter((record): record is X4UiCallRecord => record.recordType === 'call');
    const properties = records.filter((record): record is X4UiPropertyRecord => record.recordType === 'property');
    const handlers = records.filter((record): record is X4UiHandlerRecord => record.recordType === 'handler');
    const aliases = records.filter((record): record is X4UiAliasRecord => record.recordType === 'alias');
    const localFunctions = [...this.localFunctions].sort((left, right) =>
      left.source.start.offset - right.source.start.offset || left.source.end.offset - right.source.end.offset);
    const localInvocations = [...this.localInvocations].sort((left, right) =>
      left.sourceOrder - right.sourceOrder || left.source.end.offset - right.source.end.offset);
    const helperReceiverAliases = [...this.helperReceiverAliases].sort((left, right) =>
      left.source.start.offset - right.source.start.offset || left.source.end.offset - right.source.end.offset);
    const colorExpressions = [...this.colorExpressions].sort((left, right) =>
      left.source.start.offset - right.source.start.offset
      || left.callSource.start.offset - right.callSource.start.offset
      || left.propertyName.localeCompare(right.propertyName));

    return {
      file: this.input,
      parsed,
      calls,
      properties,
      handlers,
      aliases,
      localFunctions: freezeDeepFact(localFunctions),
      localInvocations: freezeDeepFact(localInvocations),
      helperReceiverAliases: freezeDeepFact(helperReceiverAliases),
      colorExpressions: freezeDeepFact(colorExpressions),
      records,
      verificationGaps: this.gaps,
      verificationGapsTruncated: this.gapsTruncated
    };
  }

  private makeFullLocation(): X4UiSourceLocation {
    const lastNewline = this.input.text.lastIndexOf('\n');
    const line = (this.input.text.match(/\n/g)?.length || 0) + 1;
    const column = lastNewline >= 0 ? this.input.text.length - lastNewline - 1 : this.input.text.length;
    return {
      file: this.input.rel,
      sourcePath: this.input.sourcePath,
      start: { line: 1, column: 0, offset: 0 },
      end: { line, column, offset: this.input.text.length }
    };
  }

  private lineColumnOffset(line: number, column: number): number {
    if (line <= 1) return Math.max(0, Math.min(this.input.text.length, column));
    let offset = 0;
    let currentLine = 1;
    while (currentLine < line) {
      const newline = this.input.text.indexOf('\n', offset);
      if (newline < 0) return this.input.text.length;
      offset = newline + 1;
      currentLine += 1;
    }
    return Math.max(0, Math.min(this.input.text.length, offset + column));
  }

  private position(position: LuaPositionLike | undefined, fallbackOffset: number): X4UiSourcePosition {
    const line = typeof position?.line === 'number' ? position.line : 1;
    const column = typeof position?.column === 'number' ? position.column : 0;
    return { line, column, offset: fallbackOffset >= 0 ? fallbackOffset : this.lineColumnOffset(line, column) };
  }

  private location(node: LuaNode | undefined): X4UiSourceLocation {
    if (!node) return this.fullLocation;
    const range = nodeRange(node);
    const loc = nodeField<LuaLocationLike>(node, 'loc');
    const startOffset = range?.[0] ?? this.lineColumnOffset(loc?.start?.line || 1, loc?.start?.column || 0);
    const endOffset = range?.[1] ?? this.lineColumnOffset(loc?.end?.line || loc?.start?.line || 1, loc?.end?.column || loc?.start?.column || 0);
    return {
      file: this.input.rel,
      sourcePath: this.input.sourcePath,
      start: this.position(loc?.start, startOffset),
      end: this.position(loc?.end, endOffset)
    };
  }

  private errorLocation(error: LuaErrorLike): X4UiSourceLocation {
    const index = typeof error.index === 'number' ? error.index : undefined;
    const line = typeof error.line === 'number' ? error.line : 1;
    const column = typeof error.column === 'number' ? error.column : 0;
    const offset = index ?? this.lineColumnOffset(line, column);
    const position = { line, column, offset };
    return { file: this.input.rel, sourcePath: this.input.sourcePath, start: position, end: position };
  }

  private textOf(node: LuaNode | undefined): string {
    const range = nodeRange(node);
    if (!range) return '';
    return this.input.text.slice(range[0], range[1]);
  }

  private sourceOffset(node: LuaNode | undefined): number {
    return nodeRange(node)?.[0] ?? this.location(node).start.offset;
  }

  private enclosingStatementProvenance(node: LuaNode): X4UiCallStatementProvenance | undefined {
    const statement = this.currentStatement;
    const range = nodeRange(statement);
    const loc = nodeField<LuaLocationLike>(statement, 'loc');
    const start = loc?.start;
    const end = loc?.end;
    if (!statement || !range
      || !Number.isInteger(range[0]) || !Number.isInteger(range[1])
      || range[0] < 0 || range[1] < range[0] || range[1] > this.input.text.length
      || typeof start?.line !== 'number' || typeof start.column !== 'number'
      || typeof end?.line !== 'number' || typeof end.column !== 'number') {
      return undefined;
    }
    const source = this.location(statement);
    if (source.start.offset !== range[0] || source.end.offset !== range[1]) return undefined;
    let suffixEnd = range[1];
    while (suffixEnd < this.input.text.length
      && (this.input.text[suffixEnd] === ' ' || this.input.text[suffixEnd] === '\t')) {
      suffixEnd += 1;
    }
    const ownsSemicolon = suffixEnd < this.input.text.length && this.input.text[suffixEnd] === ';';
    const deletionEnd = ownsSemicolon ? suffixEnd + 1 : range[1];
    const deletionSource = ownsSemicolon
      ? {
        ...source,
        end: {
          ...source.end,
          column: source.end.column + deletionEnd - range[1],
          offset: deletionEnd
        }
      }
      : source;
    return freezeDeepFact({
      source,
      deletionSource,
      terminator: ownsSemicolon ? 'semicolon' : 'none',
      kind: normalizeStatementKind(statement.type),
      isStandaloneCallStatementRoot: statement.type === 'CallStatement'
        && this.currentStandaloneCallStatementRoot === node
    });
  }

  private locationIdentity(source: X4UiSourceLocation): string {
    return `${source.file}|${source.sourcePath || ''}|${source.start.offset}|${source.end.offset}`;
  }

  private localFunctionId(source: X4UiSourceLocation): string {
    return `local-function:${this.locationIdentity(source)}`;
  }

  private localParameterId(declarationId: string, index: number, source: X4UiSourceLocation): string {
    return `local-parameter:${declarationId}|${index}|${source.start.offset}|${source.end.offset}`;
  }

  private localInvocationId(source: X4UiSourceLocation): string {
    return `local-invocation:${this.locationIdentity(source)}`;
  }

  private combineReachability(
    parent: X4UiBranchReachability,
    child: X4UiBranchReachability
  ): X4UiBranchReachability {
    if (parent === 'unreachable' || child === 'unreachable') return 'unreachable';
    if (parent === 'conditional' || child === 'conditional') return 'conditional';
    return 'reachable';
  }

  private branchContext(
    parent: X4UiFunctionContext,
    boundary: X4UiSourceLocation,
    boundaryId: string,
    arm: X4UiBranchArm,
    armIndex: number,
    armReachability: X4UiBranchReachability
  ): X4UiFunctionContext {
    const reachability = this.combineReachability(parent.reachability, armReachability);
    const segment: X4UiBranchPathSegment = Object.freeze({
      boundaryId,
      boundary,
      armId: `${boundaryId}:arm:${armIndex}`,
      arm,
      armIndex,
      reachability
    });
    return {
      ...parent,
      branchPath: Object.freeze([...parent.branchPath, segment]),
      reachability
    };
  }

  private loopContext(
    parent: X4UiFunctionContext,
    statement: LuaNode,
    kind: X4UiLoopKind
  ): X4UiFunctionContext {
    const source = this.location(statement);
    Object.freeze(source.start);
    Object.freeze(source.end);
    Object.freeze(source);
    const segment: X4UiLoopPathSegment = Object.freeze({
      source,
      kind,
      multiplicity: kind === 'repeat' ? 'one-or-more' : 'zero-or-more'
    });
    return {
      ...parent,
      loopPath: Object.freeze([...parent.loopPath, segment])
    };
  }

  private ifBranchContexts(
    statement: LuaNode,
    parent: X4UiFunctionContext,
    conditions: Array<InternalValue | undefined>
  ): X4UiFunctionContext[] {
    const clauses = nodeArray(statement, 'clauses');
    const boundary = this.location(statement);
    Object.freeze(boundary.start);
    Object.freeze(boundary.end);
    Object.freeze(boundary);
    const boundaryId = `${boundary.file}|${boundary.sourcePath || ''}|${boundary.start.offset}|${boundary.end.offset}`;
    const contexts: X4UiFunctionContext[] = [];
    let aPriorClauseMayBeSelected = true;
    let aPriorClauseIsConditional = false;

    clauses.forEach((clause, index) => {
      const condition = conditions[index];
      if (!condition) {
        const elseReachability: X4UiBranchReachability = !aPriorClauseMayBeSelected
          ? 'unreachable'
          : aPriorClauseIsConditional
            ? 'conditional'
            : 'reachable';
        contexts.push(this.branchContext(parent, boundary, boundaryId, 'else', index, elseReachability));
        aPriorClauseMayBeSelected = false;
        return;
      }
      const truth = luaTruthy(condition.publicValue);
      let armReachability: X4UiBranchReachability;
      if (!aPriorClauseMayBeSelected || truth === false) {
        armReachability = 'unreachable';
      } else if (truth === true) {
        armReachability = aPriorClauseIsConditional ? 'conditional' : 'reachable';
      } else {
        armReachability = 'conditional';
      }

      contexts.push(this.branchContext(
        parent,
        boundary,
        boundaryId,
        index === 0 ? 'then' : 'elseif',
        index,
        armReachability
      ));

      if (aPriorClauseMayBeSelected) {
        if (truth === true) {
          aPriorClauseMayBeSelected = false;
        } else if (truth === undefined) {
          aPriorClauseIsConditional = true;
        }
      }
    });

    const hasElseClause = clauses.some(clause => !nodeField<LuaNode>(clause, 'condition'));
    if (!hasElseClause && nodeArray(statement, 'elseBody').length > 0) {
      const elseReachability: X4UiBranchReachability = !aPriorClauseMayBeSelected
        ? 'unreachable'
        : aPriorClauseIsConditional
          ? 'conditional'
          : 'reachable';
      contexts.push(this.branchContext(parent, boundary, boundaryId, 'else', clauses.length, elseReachability));
    }
    return contexts;
  }

  private addGap(
    category: X4UiVerificationGapCategory,
    status: X4UiVerificationGap['status'],
    source: X4UiSourceLocation,
    reason: string,
    expression = this.input.text.slice(source.start.offset, source.end.offset)
  ): void {
    const key = `${category}|${status}|${source.start.offset}|${source.end.offset}`;
    if (this.gapKeys.has(key)) return;
    this.gapKeys.add(key);
    if (this.gaps.length >= MAX_VERIFICATION_GAPS) {
      this.gapsTruncated = true;
      return;
    }
    this.gaps.push({ category, status, expression, reason, source });
  }

  private addValueGap(category: X4UiVerificationGapCategory, value: InternalValue, reason: string): void {
    if (value.publicValue.status === 'static') return;
    this.addGap(category, value.publicValue.status, value.publicValue.location, reason, value.publicValue.expression);
  }

  private value(
    node: LuaNode | undefined,
    status: X4UiValueStatus,
    type: X4UiValueType,
    value?: X4UiLiteral,
    reference?: X4UiValueReference,
    reason?: string,
    symbol?: string
  ): X4UiValue {
    const result: X4UiValue = {
      status,
      type,
      expression: this.textOf(node),
      location: this.location(node),
      reason,
      symbol,
      reference
    };
    if (value !== undefined || type === 'nil') result.value = value;
    return result;
  }

  private valueAtUse(source: InternalValue, node: LuaNode | undefined): InternalValue {
    const publicValue = { ...source.publicValue, expression: this.textOf(node), location: this.location(node) };
    const numericExpression = source.publicValue.numericExpression;
    if (numericExpression?.kind === 'direct-helper-scale') {
      publicValue.numericExpression = freezeNumericExpression({
        ...numericExpression,
        expression: this.textOf(node),
        source: this.location(node),
      });
    } else if (numericExpression?.kind === 'literal' || numericExpression?.kind === 'helper-constant') {
      delete publicValue.numericExpression;
    }
    return {
      publicValue,
      object: source.object,
      functionNode: source.functionNode,
      localFunction: source.localFunction,
      helperAlias: source.helperAlias,
      helperAliasCandidate: source.helperAliasCandidate,
      directHelperScaleCall: source.directHelperScaleCall
    };
  }

  private numericLiteralExpression(value: X4UiValue): X4UiNumericExpression | undefined {
    if (value.status !== 'static' || value.type !== 'number' || typeof value.value !== 'number'
      || !value.sourceLiteral || this.locationIdentity(value.sourceLiteral) !== this.locationIdentity(value.location)) return undefined;
    return freezeNumericExpression({
      kind: 'literal',
      value: value.value,
      expression: value.expression,
      source: value.location,
    });
  }

  private unknown(node: LuaNode | undefined, type: X4UiValueType, reason: string, symbol?: string): InternalValue {
    return { publicValue: this.value(node, 'unknown', type, undefined, undefined, reason, symbol) };
  }

  private dynamic(node: LuaNode | undefined, type: X4UiValueType, reason: string): InternalValue {
    return { publicValue: this.value(node, 'dynamic', type, undefined, undefined, reason) };
  }

  private missing(node: LuaNode | undefined, label: string): InternalValue {
    const result = this.unknown(node, 'unknown', `missing ${label}`);
    result.publicValue.expression = `<missing ${label}>`;
    return result;
  }

  private referenceValue(object: TrackedObject, node: LuaNode | undefined, status?: X4UiValueStatus): InternalValue {
    const resolvedStatus = status || (object.known ? 'static' : 'unknown');
    return {
      publicValue: this.value(node, resolvedStatus, 'reference', undefined, object.reference, object.known ? undefined : 'tracked object shape is unresolved'),
      object
    };
  }

  private globalValue(name: string, node: LuaNode | undefined): InternalValue {
    const reference: X4UiValueReference = {
      kind: 'global',
      path: name,
      origin: 'global',
      source: this.location(node)
    };
    return { publicValue: this.value(node, 'static', 'reference', undefined, reference) };
  }

  private helperAliasValue(alias: InternalHelperAlias, node: LuaNode | undefined): InternalValue {
    const source = this.location(node);
    const reference: X4UiValueReference = {
      kind: 'global',
      path: 'Helper',
      origin: 'alias',
      source,
      helperAliasSource: alias.callSource,
      helperRuntimeAvailability: 'unverified'
    };
    return {
      publicValue: this.value(node, 'static', 'reference', undefined, reference),
      helperAlias: alias
    };
  }

  private newObject(
    kind: X4UiValueReference['kind'],
    node: LuaNode | undefined,
    origin: X4UiValueReference['origin'],
    parent?: TrackedObject,
    index?: X4UiValue,
    known = true
  ): TrackedObject {
    const reference: X4UiValueReference = {
      kind,
      path: `@${kind}:${this.sourceOffset(node)}`,
      origin,
      source: this.location(node),
      parentPath: parent?.reference.path,
      index
    };
    return {
      id: this.nextObjectId++,
      reference,
      known,
      fields: new Map(),
      indexed: new Map(),
      aliases: new Set(),
      mutated: false,
      mutatedProperties: new Set()
    };
  }

  private refreshObjectKind(object: TrackedObject): void {
    if (object.reference.kind !== 'object' && object.reference.kind !== 'unknown') return;
    if (this.findField(object, ['name']) || this.findField(object, ['onShowMenu'])) {
      object.reference.kind = object.known ? 'menu' : 'unknown';
    }
  }

  private bindingValue(name: string, node: LuaNode | undefined): InternalValue {
    const binding = this.bindings.get(name);
    if (binding) return this.valueAtUse(binding.value, node);
    if (KNOWN_X4_GLOBALS.has(name)) return this.globalValue(name, node);
    return this.unknown(node, 'identifier', `identifier "${name}" has no statically traceable binding`, name);
  }

  private evaluate(
    node: LuaNode | undefined,
    context: X4UiFunctionContext,
    resultConsumed = true
  ): InternalValue {
    if (!node) return this.unknown(undefined, 'unknown', 'missing expression');

    const result = this.evaluateNode(node, context, resultConsumed);
    result.sourceNode = node;
    return result;
  }

  private evaluateNode(
    node: LuaNode,
    context: X4UiFunctionContext,
    resultConsumed: boolean
  ): InternalValue {

    switch (node.type) {
      case 'Identifier': {
        const name = nodeField<string>(node, 'name') || '';
        return this.bindingValue(name, node);
      }
      case 'StringLiteral': {
        const string = staticString(node);
        return string === undefined
          ? this.dynamic(node, 'string', 'string literal could not be decoded')
          : { publicValue: { ...this.value(node, 'static', 'string', string), sourceLiteral: this.location(node) } };
      }
      case 'NumericLiteral': {
        const number = staticNumber(node);
        return number === undefined
          ? this.dynamic(node, 'number', 'numeric literal could not be decoded')
          : {
            publicValue: {
              ...this.value(node, 'static', 'number', number),
              sourceLiteral: this.location(node),
            }
          };
      }
      case 'BooleanLiteral': {
        const boolean = staticBoolean(node);
        return boolean === undefined
          ? this.dynamic(node, 'boolean', 'boolean literal could not be decoded')
          : { publicValue: { ...this.value(node, 'static', 'boolean', boolean), sourceLiteral: this.location(node) } };
      }
      case 'NilLiteral':
        return { publicValue: { ...this.value(node, 'static', 'nil', null), sourceLiteral: this.location(node) } };
      case 'VarargLiteral':
        return this.dynamic(node, 'expression', 'vararg value is runtime-dependent');
      case 'TableConstructorExpression':
        return this.evaluateTable(node, context);
      case 'FunctionDeclaration':
        return {
          publicValue: this.value(node, 'static', 'function'),
          functionNode: node
        };
      case 'MemberExpression':
        return this.evaluateMember(node, context);
      case 'IndexExpression':
        return this.evaluateIndex(node, context);
      case 'CallExpression':
      case 'StringCallExpression':
      case 'TableCallExpression':
        return this.evaluateCall(node, context, resultConsumed);
      case 'UnaryExpression':
        return this.evaluateUnary(node, context);
      case 'BinaryExpression':
      case 'LogicalExpression':
        return this.evaluateBinary(node, context);
      case 'ParenthesizedExpression': {
        const expression = this.evaluate(nodeField<LuaNode>(node, 'expression'), context);
        const operand = expression.publicValue.numericExpression
          || this.numericLiteralExpression(expression.publicValue);
        if (!operand) return expression;
        const numericExpression = freezeNumericExpression({
          kind: 'group',
          operand,
          expression: this.textOf(node),
          source: this.location(node),
        });
        const publicValue = {
          ...expression.publicValue,
          expression: this.textOf(node),
          location: this.location(node),
          numericExpression,
        };
        return { ...expression, publicValue };
      }
      default:
        this.processNestedCalls(node, context);
        return this.dynamic(node, 'expression', `unsupported Lua expression shape ${node.type || 'unknown'}`);
    }
  }

  private processNestedCalls(node: LuaNode, context: X4UiFunctionContext): void {
    const visited = new Set<LuaNode>();
    const visit = (candidate: LuaNode): void => {
      if (visited.has(candidate)) return;
      visited.add(candidate);
      if (candidate.type === 'CallExpression' || candidate.type === 'StringCallExpression' || candidate.type === 'TableCallExpression') {
        this.evaluateCall(candidate, context, true);
        return;
      }
      for (const [key, child] of Object.entries(candidate)) {
        if (key === 'loc' || key === 'range' || key === 'comments' || key === 'tokens' || key === 'globals') continue;
        if (Array.isArray(child)) {
          child.filter(isLuaNode).forEach(visit);
        } else if (isLuaNode(child)) {
          visit(child);
        }
      }
    };
    visit(node);
  }

  private evaluateTable(node: LuaNode, context: X4UiFunctionContext): InternalValue {
    const object = this.newObject('object', node, 'literal');
    object.declarationNode = node;
    for (const field of nodeArray(node, 'fields')) {
      const fieldValueNode = nodeField<LuaNode>(field, 'value');
      const fieldValue = this.evaluate(fieldValueNode, context);
      let name: string | undefined;
      let keyNode: LuaNode = field;
      if (field.type === 'TableKeyString') {
        const key = nodeField<LuaNode>(field, 'key');
        name = nodeField<string>(key, 'name');
        keyNode = key || field;
      } else if (field.type === 'TableKey') {
        const key = this.evaluate(nodeField<LuaNode>(field, 'key'), context);
        if (key.publicValue.status === 'static' && (key.publicValue.type === 'string' || key.publicValue.type === 'number')) {
          name = String(key.publicValue.value);
          keyNode = nodeField<LuaNode>(field, 'key') || field;
        } else {
          this.addValueGap('data-flow', key, 'table field key is not statically traceable');
        }
      }

      if (!name) continue;
      object.fields.set(name, fieldValue);
      this.refreshObjectKind(object);
      if (this.isRelevantProperty(name)) {
        this.addProperty(object, name, keyNode, fieldValue, 'table-field', field, context);
      }
    }
    return this.referenceValue(object, node);
  }

  private evaluateMember(node: LuaNode, context: X4UiFunctionContext): InternalValue {
    const baseNode = nodeField<LuaNode>(node, 'base');
    const base = this.evaluate(baseNode, context);
    const property = luaNodeName(nodeField<LuaNode>(node, 'identifier'));
    if (!property) return this.unknown(node, 'expression', 'member property is not statically named');
    if (
      base.publicValue.reference?.kind === 'global'
      && base.publicValue.reference.path === 'Helper'
      && KNOWN_HELPER_CONSTANTS.has(property)
    ) {
      const symbol = `Helper.${property}`;
      const baseReference = base.publicValue.reference;
      const receiver = freezeDeepFact({
        name: this.textOf(baseNode),
        origin: baseReference.origin === 'alias' ? 'alias' as const : 'global' as const,
        source: this.location(baseNode),
        ...(baseReference.helperAliasSource ? { aliasSource: baseReference.helperAliasSource } : {}),
      });
      return {
        publicValue: {
          ...this.value(
          node,
          'unknown',
          'number',
          undefined,
          undefined,
          `${symbol} is a recognized Helper constant whose runtime value is not supplied`,
          symbol
          ),
          numericExpression: freezeNumericExpression({
            kind: 'helper-constant',
            name: property as X4UiHelperNumericConstantName,
            receiver,
            expression: this.textOf(node),
            source: this.location(node),
          }),
        }
      };
    }
    if (base.object) {
      const field = this.findField(base.object, [property]);
      if (field) return this.valueAtUse(field, node);
      return this.unknown(node, 'identifier', `property "${property}" is not statically defined`);
    }
    return this.unknown(node, 'identifier', `base value for property "${property}" is unresolved`);
  }

  private evaluateIndex(node: LuaNode, context: X4UiFunctionContext): InternalValue {
    const baseNode = nodeField<LuaNode>(node, 'base');
    const indexNode = nodeField<LuaNode>(node, 'index');
    const base = this.evaluate(baseNode, context);
    const index = this.evaluate(indexNode, context);
    if (!base.object) return this.unknown(node, 'reference', 'indexed base value is unresolved');

    if (index.publicValue.status === 'static' && (index.publicValue.type === 'string' || index.publicValue.type === 'number')) {
      const key = String(index.publicValue.value);
      const field = this.findField(base.object, [key]);
      if (field) return this.valueAtUse(field, node);
      if (base.object.reference.kind === 'row' || base.object.reference.kind === 'table') {
        const existing = base.object.indexed.get(key);
        if (existing) return this.referenceValue(existing, node);
        const cell = this.newObject('cell', node, 'index', base.object, index.publicValue, base.object.known);
        cell.reference.path = `${base.object.reference.path}[${index.publicValue.expression}]`;
        base.object.indexed.set(key, cell);
        return this.referenceValue(cell, node);
      }
      return this.unknown(node, 'reference', `indexed property "${key}" is not statically defined`);
    }

    if (base.object.reference.kind === 'row' || base.object.reference.kind === 'table' || base.object.reference.kind === 'unknown') {
      this.addValueGap('index', index, 'indexed row/cell position is dynamic or unknown');
      const cell = this.newObject(
        'cell',
        node,
        'index',
        base.object,
        index.publicValue,
        base.object.known && index.publicValue.status === 'static'
      );
      cell.reference.path = `${base.object.reference.path}[?]`;
      const resolvedStatus: X4UiValueStatus = index.publicValue.status === 'dynamic' ? 'dynamic' : 'unknown';
      return this.referenceValue(cell, node, resolvedStatus);
    }
    return this.unknown(node, 'reference', 'indexed value is not a row/table shape');
  }

  private evaluateUnary(node: LuaNode, context: X4UiFunctionContext): InternalValue {
    const argument = this.evaluate(nodeField<LuaNode>(node, 'argument'), context);
    const operator = nodeField<string>(node, 'operator');
    const numericArgument = argument.publicValue.numericExpression
      || this.numericLiteralExpression(argument.publicValue);
    if ((operator === '-' || operator === '+') && numericArgument) {
      const argumentValue = argument.publicValue.value;
      const result = argument.publicValue.status === 'static'
        && argument.publicValue.type === 'number'
        && typeof argumentValue === 'number'
        ? (operator === '-' ? -argumentValue : argumentValue)
        : undefined;
      const numericExpression = freezeNumericExpression({
        kind: 'unary',
        operator,
        operand: numericArgument,
        expression: this.textOf(node),
        source: this.location(node),
      });
      const publicValue = result !== undefined && Number.isFinite(result)
        ? this.value(node, 'static', 'number', result)
        : this.value(
          node,
          argument.publicValue.status === 'unknown' ? 'unknown' : 'dynamic',
          'number',
          undefined,
          undefined,
          `unary ${operator} value is not a finite static number`
        );
      publicValue.numericExpression = numericExpression;
      return { publicValue };
    }
    if (argument.publicValue.status !== 'static') return this.dynamic(node, 'expression', `unary ${operator || 'operator'} depends on a runtime value`);
    const value = argument.publicValue.value;
    if (operator === '-' && typeof value === 'number') return { publicValue: this.value(node, 'static', 'number', -value) };
    if (operator === '+' && typeof value === 'number') return { publicValue: this.value(node, 'static', 'number', value) };
    if (operator === 'not') return { publicValue: this.value(node, 'static', 'boolean', !luaTruthy(argument.publicValue)) };
    if (operator === '#' && typeof value === 'string') return { publicValue: this.value(node, 'static', 'number', value.length) };
    return this.dynamic(node, 'expression', `unary ${operator || 'operator'} is not folded by the UI call model`);
  }

  private evaluateBinary(node: LuaNode, context: X4UiFunctionContext): InternalValue {
    const left = this.evaluate(nodeField<LuaNode>(node, 'left'), context);
    const right = this.evaluate(nodeField<LuaNode>(node, 'right'), context);
    const operator = nodeField<string>(node, 'operator') || '';
    const leftNumericExpression = left.publicValue.numericExpression
      || this.numericLiteralExpression(left.publicValue);
    const rightNumericExpression = right.publicValue.numericExpression
      || this.numericLiteralExpression(right.publicValue);
    if (operator === 'or' && leftNumericExpression) {
      const leftTruth = luaTruthy(left.publicValue);
      if (leftTruth === undefined || !rightNumericExpression) {
        return this.dynamic(node, 'number', 'logical or has an unsupported or undecidable numeric branch');
      }
      const numericExpression = freezeNumericExpression({
        kind: 'or',
        left: leftNumericExpression,
        right: rightNumericExpression,
        expression: this.textOf(node),
        source: this.location(node),
      });
      const selected = leftTruth ? left.publicValue : right.publicValue;
      const selectedValue = selected.value;
      const publicValue = selected.status === 'static'
        && selected.type === 'number'
        && typeof selectedValue === 'number'
        && Number.isFinite(selectedValue)
        ? this.value(node, 'static', 'number', selectedValue)
        : this.value(
          node,
          selected.status === 'unknown' ? 'unknown' : 'dynamic',
          'number',
          undefined,
          undefined,
          `logical or value is not a finite static number`
        );
      publicValue.numericExpression = numericExpression;
      return { publicValue };
    }
    if (operator === 'or' && rightNumericExpression) {
      return this.dynamic(node, 'number', 'logical or has an unsupported non-numeric left branch');
    }
    if (operator === 'and' && (leftNumericExpression || rightNumericExpression)) {
      return this.dynamic(node, 'number', 'logical and is not part of the closed numeric expression grammar');
    }
    if (['+', '-', '*', '/'].includes(operator)
      && leftNumericExpression && rightNumericExpression) {
      const numericExpression = freezeNumericExpression({
        kind: 'binary',
        operator: operator as '+' | '-' | '*' | '/',
        left: leftNumericExpression,
        right: rightNumericExpression,
        expression: this.textOf(node),
        source: this.location(node),
      });
      const leftValue = left.publicValue.value;
      const rightValue = right.publicValue.value;
      const bothStaticNumbers = left.publicValue.status === 'static'
        && right.publicValue.status === 'static'
        && typeof leftValue === 'number'
        && typeof rightValue === 'number';
      const result = bothStaticNumbers
        ? operator === '+' ? leftValue + rightValue
          : operator === '-' ? leftValue - rightValue
            : operator === '*' ? leftValue * rightValue
              : leftValue / rightValue
        : undefined;
      const invalidResult = bothStaticNumbers
        && (operator === '/' && rightValue === 0
          || result !== undefined && !Number.isFinite(result));
      const publicValue = result !== undefined && !invalidResult
        ? this.value(node, 'static', 'number', result)
        : this.value(
          node,
          left.publicValue.status === 'unknown' || right.publicValue.status === 'unknown' ? 'unknown' : 'dynamic',
          'number',
          undefined,
          undefined,
          invalidResult
            ? `binary ${operator} value is not finite or divides by zero`
            : `binary ${operator} value is not a static number`
        );
      publicValue.numericExpression = numericExpression;
      return { publicValue };
    }
    if (operator === 'and' || operator === 'or') {
      const leftTruth = luaTruthy(left.publicValue);
      if (leftTruth === undefined) return this.dynamic(node, 'expression', `logical ${operator} value is runtime-dependent`);
      return operator === 'and'
        ? (leftTruth ? right : left)
        : (leftTruth ? left : right);
    }
    if (left.publicValue.status !== 'static' || right.publicValue.status !== 'static') {
      const status: X4UiValueStatus = left.publicValue.status === 'unknown' || right.publicValue.status === 'unknown' ? 'unknown' : 'dynamic';
      return { publicValue: this.value(node, status, 'expression', undefined, undefined, `binary ${operator} value is not static`) };
    }

    const leftValue = left.publicValue.value;
    const rightValue = right.publicValue.value;
    if (['+', '-', '*', '/', '%', '^'].includes(operator) && typeof leftValue === 'number' && typeof rightValue === 'number') {
      if (operator === '/' && rightValue === 0) return this.dynamic(node, 'number', 'division by zero is not folded');
      const result = operator === '+' ? leftValue + rightValue
        : operator === '-' ? leftValue - rightValue
          : operator === '*' ? leftValue * rightValue
            : operator === '/' ? leftValue / rightValue
                : operator === '%' ? leftValue % rightValue
                  : leftValue ** rightValue;
      if (!Number.isFinite(result)) return this.dynamic(node, 'number', `binary ${operator} result is not finite`);
      return { publicValue: this.value(node, 'static', 'number', result) };
    }
    if (operator === '..' && (typeof leftValue === 'string' || typeof leftValue === 'number') && (typeof rightValue === 'string' || typeof rightValue === 'number')) {
      return { publicValue: this.value(node, 'static', 'string', String(leftValue) + String(rightValue)) };
    }
    if (['==', '~=', '<', '<=', '>', '>='].includes(operator)) {
      let result = false;
      if (operator === '==') result = leftValue === rightValue;
      else if (operator === '~=') result = leftValue !== rightValue;
      else if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        result = operator === '<' ? leftValue < rightValue
          : operator === '<=' ? leftValue <= rightValue
            : operator === '>' ? leftValue > rightValue
              : leftValue >= rightValue;
      } else {
        return this.dynamic(node, 'boolean', `comparison ${operator} is not folded for these values`);
      }
      return { publicValue: this.value(node, 'static', 'boolean', result) };
    }
    return this.dynamic(node, 'expression', `binary ${operator} is not folded by the UI call model`);
  }

  private callShape(node: LuaNode): CallShape {
    const base = nodeField<LuaNode>(node, 'base');
    const argsValue = nodeField<unknown>(node, 'arguments');
    const args = Array.isArray(argsValue)
      ? argsValue.filter(isLuaNode)
      : isLuaNode(argsValue) ? [argsValue] : [];
    if (!base) {
      return { method: 'unknown', calleeNode: node, args };
    }
    if (base.type === 'Identifier') {
      return { name: nodeField<string>(base, 'name'), method: 'direct', calleeNode: base, args };
    }
    if (base.type === 'MemberExpression') {
      const identifier = nodeField<LuaNode>(base, 'identifier');
      const method = nodeField<string>(base, 'indexer');;
      return {
        name: luaNodeName(identifier),
        receiver: nodeField<LuaNode>(base, 'base'),
        method: method === ':' || method === '.' ? method : 'unknown',
        calleeNode: identifier || base,
        args
      };
    }
    if (base.type === 'IndexExpression') {
      const name = staticString(nodeField<LuaNode>(base, 'index'));
      return {
        name,
        receiver: nodeField<LuaNode>(base, 'base'),
        method: '.',
        calleeNode: nodeField<LuaNode>(base, 'index') || base,
        args
      };
    }
    return { method: 'unknown', calleeNode: base, args };
  }

  private rawgetHelperAliasCandidate(node: LuaNode, shape: CallShape): InternalValue | undefined {
    if (shape.name !== 'rawget') return undefined;
    const callSource = this.location(node);
    let reason = 'exact unshadowed rawget(_G, "Helper") receiver alias';
    let valid = true;
    if (shape.method !== 'direct') {
      valid = false;
      reason = 'Helper receiver alias requires a direct rawget call';
    } else if (this.bindings.has('rawget')) {
      valid = false;
      reason = 'shadowed rawget cannot establish Helper receiver identity';
    } else if (shape.args.length !== 2) {
      valid = false;
      reason = 'Helper receiver rawget must have exactly _G and "Helper" arguments';
    } else {
      const globalNode = shape.args[0];
      const keyNode = shape.args[1];
      if (globalNode?.type !== 'Identifier' || nodeField<string>(globalNode, 'name') !== '_G') {
        valid = false;
        reason = 'Helper receiver rawget first argument must be the exact global _G identifier';
      } else if (this.bindings.has('_G')) {
        valid = false;
        reason = 'shadowed _G cannot establish Helper receiver identity';
      } else if (staticString(keyNode) !== 'Helper') {
        valid = false;
        reason = 'Helper receiver rawget key must be the exact static string "Helper"';
      }
    }
    return {
      publicValue: this.value(node, 'dynamic', 'reference', undefined, undefined, reason),
      helperAliasCandidate: { valid, callSource, reason }
    };
  }

  private addLocalInvocation(
    node: LuaNode,
    shape: CallShape,
    args: InternalValue[],
    context: X4UiFunctionContext,
    resultConsumed: boolean,
    binding?: Binding
  ): X4UiLocalFunctionInvocation {
    const source = this.location(node);
    const localFunction = binding?.value.localFunction;
    let status: X4UiLocalFunctionInvocationStatus = 'unsupported';
    let reason = 'callee is not an exact tracked same-file local function';
    let resolution: X4UiLocalFunctionInvocation['resolution'];
    if (shape.method !== 'direct') {
      reason = 'computed, table, global, or method calls cannot establish local-helper identity';
    } else if (!localFunction) {
      reason = binding
        ? 'direct callee binding is not an exact tracked local-function declaration'
        : 'direct callee is global or has no exact tracked local-function declaration';
    } else if (localFunction.declaration.hasVarargs) {
      reason = 'vararg local functions are outside bounded helper expansion';
    } else if (args.length !== localFunction.declaration.parameters.length) {
      reason = `local helper arity mismatch: expected ${localFunction.declaration.parameters.length}, received ${args.length}`;
    } else {
      status = 'supported';
      reason = '';
      resolution = binding?.source && this.locationIdentity(binding.source) !== this.locationIdentity(localFunction.declarationBindingSource)
        ? 'alias'
        : 'direct';
    }
    const invocation: X4UiLocalFunctionInvocation = {
      id: this.localInvocationId(source),
      source,
      sourceOrder: this.sourceOffset(shape.calleeNode),
      calleeSource: this.location(shape.calleeNode),
      calleeExpression: this.textOf(shape.calleeNode),
      method: shape.method,
      arguments: args.map(argument => argument.publicValue),
      context,
      resultConsumed,
      status,
      ...(localFunction ? { calleeDeclarationId: localFunction.declaration.id } : {}),
      ...(resolution ? { resolution } : {}),
      ...(reason ? { reason } : {})
    };
    this.localInvocations.push(invocation);
    return invocation;
  }

  private evaluateCall(
    node: LuaNode,
    context: X4UiFunctionContext,
    resultConsumed = true
  ): InternalValue {
    const shape = this.callShape(node);
    const receiver = shape.receiver ? this.evaluate(shape.receiver, context) : undefined;
    const args = shape.args.map(argument => this.evaluate(argument, context));
    const helperAliasCandidate = this.rawgetHelperAliasCandidate(node, shape);
    if (helperAliasCandidate) return helperAliasCandidate;

    const directBinding = shape.method === 'direct' && shape.name ? this.bindings.get(shape.name) : undefined;
    if (directBinding?.value.localFunction) {
      const invocation = this.addLocalInvocation(node, shape, args, context, resultConsumed, directBinding);
      const result = this.dynamic(node, 'expression', 'local helper return value is not inferred');
      result.publicValue.localInvocationResult = {
        invocationId: invocation.id,
        source: invocation.source,
        expression: this.textOf(node)
      };
      return result;
    }
    if (!shape.name || !RELEVANT_CALL_NAMES.has(shape.name as X4UiRelevantCallName)) {
      const invocation = this.addLocalInvocation(node, shape, args, context, resultConsumed, directBinding);
      const result = this.dynamic(node, 'expression', invocation.reason || 'call result is not statically modeled');
      if (invocation.calleeDeclarationId) {
        result.publicValue.localInvocationResult = {
          invocationId: invocation.id,
          source: invocation.source,
          expression: this.textOf(node)
        };
      }
      return result;
    }

    const name = shape.name as X4UiRelevantCallName;
    const enclosingStatement = this.enclosingStatementProvenance(node);
    if (!enclosingStatement) {
      this.addGap(
        'parse',
        'unsupported',
        this.location(node),
        'relevant call has no locatable enclosing Lua statement'
      );
      return this.dynamic(node, 'expression', `${name} result is not modeled`);
    }
    const analyzed = this.analyzeRelevantCall(name, node, args, receiver, context);
    const record: X4UiCallRecord = {
      recordType: 'call',
      name,
      callee: this.textOf(shape.calleeNode),
      method: shape.method,
      source: this.location(node),
      enclosingStatement,
      sourceOrder: this.sourceOffset(shape.calleeNode),
      order: -1,
      arguments: args.map(argument => argument.publicValue),
      receiver: receiver?.publicValue,
      semantics: analyzed.semantics,
      result: analyzed.result?.reference,
      context
    };
    this.addPending(record, shape.calleeNode);
    if (analyzed.result) {
      const existing = this.resultCalls.get(analyzed.result.id) || [];
      existing.push(record);
      this.resultCalls.set(analyzed.result.id, existing);
    }
    if (analyzed.result) return this.referenceValue(analyzed.result, node);
    const result = this.dynamic(node, 'expression', `${name} result is not modeled`);
    if ((name === 'scaleX' || name === 'scaleY' || name === 'scaleFont')
      && shape.method === '.'
      && receiver?.publicValue.status === 'static'
      && receiver.publicValue.reference?.kind === 'global'
      && receiver.publicValue.reference.path === 'Helper'
      && !analyzed.semantics.dataFlow) {
      result.directHelperScaleCall = {
        callName: name,
        source: this.location(node),
        expression: this.textOf(node),
      };
    }
    return result;
  }

  private analyzeRelevantCall(
    name: X4UiRelevantCallName,
    node: LuaNode,
    args: InternalValue[],
    receiver: InternalValue | undefined,
    context: X4UiFunctionContext
  ): { semantics: X4UiCallSemantics; result?: TrackedObject } {
    const semantics: X4UiCallSemantics = {};
    const result = this.callResult(name, node, args, receiver, semantics, context);
    return { semantics, result };
  }

  private callResult(
    name: X4UiRelevantCallName,
    node: LuaNode,
    args: InternalValue[],
    receiver: InternalValue | undefined,
    semantics: X4UiCallSemantics,
    _context: X4UiFunctionContext
  ): TrackedObject | undefined {
    switch (name) {
      case 'createFrameHandle': {
        const menu = this.requiredArgument(args, 0, 'menu', 'menu/frame handle argument', node);
        semantics.menu = menu.publicValue;
        const menuName = this.menuName(menu, node);
        semantics.menuName = menuName.publicValue;
        const options = args[1];
        this.setOptionProjection(semantics, options, name, node);
        this.setOptionalField(semantics, 'width', options, ['width', 'frameWidth'], 'width');
        this.setOptionalField(semantics, 'height', options, ['height', 'frameHeight'], 'height');
        this.setOptionalField(semantics, 'layer', options, ['layer'], 'layer');
        if (!semantics.layer) this.setMenuLayer(semantics, menu, node);
        const frame = this.newObject('frame', node, 'call');
        frame.reference.relatedPath = menu.object?.reference.path;
        this.copyOptionFields(frame, options);
        return frame;
      }
      case 'addTable': {
        const count = this.requiredArgument(args, 0, 'count', 'table column count', node);
        semantics.count = count.publicValue;
        const options = args[1];
        this.setOptionProjection(semantics, options, name, node);
        this.setOptionalField(semantics, 'width', options, ['width', 'tableWidth'], 'width');
        this.setOptionalField(semantics, 'height', options, ['height', 'tableHeight'], 'height');
        this.attachReceiver(semantics, receiver, 'frame', node, 'frame used for addTable');
        const table = this.newObject('table', node, 'call', receiver?.object, undefined, receiver?.object?.known ?? false);
        this.copyOptionFields(table, options);
        return table;
      }
      case 'addRow': {
        const options = args[1];
        if (args[0]) {
          semantics.rowData = args[0].publicValue;
          this.addValueGap('data-flow', args[0], 'rowdata selectability is dynamic or unknown');
        }
        this.setOptionProjection(semantics, options, name, node);
        const height = this.propertyField(options, ['height', 'rowHeight'], 'row height');
        if (height) {
          this.addValueGap('height', height, 'row height is dynamic or unknown');
          semantics.height = height.publicValue;
        }
        this.attachReceiver(semantics, receiver, 'table', node, 'table used for addRow');
        return this.newObject('row', node, 'call', receiver?.object, undefined, receiver?.object?.known ?? false);
      }
      case 'setColWidthPercent': {
        const index = this.requiredArgument(args, 0, 'index', 'column index', node);
        const percentage = this.requiredArgument(args, 1, 'percentage', 'column percentage', node);
        semantics.index = index.publicValue;
        semantics.percentage = percentage.publicValue;
        this.attachReceiver(semantics, receiver, 'table', node, 'table used for setColWidthPercent');
        return receiver?.object;
      }
      case 'setColWidth': {
        const index = this.requiredArgument(args, 0, 'index', 'column index', node);
        const width = this.requiredArgument(args, 1, 'width', 'column width', node);
        semantics.index = index.publicValue;
        semantics.width = width.publicValue;
        if (args[2]) {
          semantics.scaling = args[2].publicValue;
          this.addValueGap('data-flow', args[2], 'column width scaling flag is dynamic or unknown');
        }
        this.attachReceiver(semantics, receiver, 'table', node, 'table used for setColWidth');
        return receiver?.object;
      }
      case 'setColSpan': {
        const span = this.requiredArgument(args, 0, 'span', 'column span', node);
        semantics.span = span.publicValue;
        this.attachReceiver(semantics, receiver, 'cell', node, 'cell used for setColSpan');
        return receiver?.object;
      }
      case 'display':
        this.attachReceiver(semantics, receiver, 'frame', node, 'frame used for display');
        return undefined;
      case 'OpenMenu': {
        const menu = this.requiredArgument(args, 0, 'menu', 'OpenMenu menu/name argument', node);
        semantics.menu = menu.publicValue;
        semantics.menuName = this.menuName(menu, node).publicValue;
        this.setMenuLayer(semantics, menu, node);
        return undefined;
      }
      case 'scaleX':
      case 'scaleY': {
        const input = this.requiredArgument(args, 0, 'scale', `${name} input`, node);
        const enabled = args[1];
        if (enabled) this.addValueGap('scale', enabled, `${name} enabled flag is dynamic or unknown`);
        semantics.scale = {
          input: input.publicValue,
          ...(enabled ? { enabled: enabled.publicValue } : {})
        };
        this.attachHelperReceiver(semantics, receiver, node, `${name} must be called on Helper`);
        return undefined;
      }
      case 'scaleFont': {
        const fontname = this.requiredArgument(args, 0, 'scale', 'scaleFont font name', node);
        const fontsize = this.requiredArgument(args, 1, 'scale', 'scaleFont font size', node);
        const enabled = args[2];
        if (enabled) this.addValueGap('scale', enabled, 'scaleFont enabled flag is dynamic or unknown');
        semantics.scale = {
          fontname: fontname.publicValue,
          fontsize: fontsize.publicValue,
          ...(enabled ? { enabled: enabled.publicValue } : {})
        };
        this.attachHelperReceiver(semantics, receiver, node, 'scaleFont must be called on Helper');
        return undefined;
      }
      case 'setText':
      case 'setText2':
      case 'createText':
      case 'createButton':
      case 'createIcon':
      case 'createEditBox': {
        const isEditBox = name === 'createEditBox';
        const isButton = name === 'createButton';
        const isIcon = name === 'createIcon';
        const isTextSetter = name === 'setText' || name === 'setText2';
        const options = isEditBox || isButton ? args[0] : args[1];
        const text = isEditBox || isButton || isIcon ? undefined : args[0];
        this.setOptionProjection(semantics, options, name, node);
        if (isIcon) {
          const icon = this.requiredArgument(args, 0, 'data-flow', 'icon name', node);
          semantics.icon = icon.publicValue;
        }
        if (text) {
          this.addValueGap('text', text, 'rendered text is dynamic or unknown');
          semantics.text = text.publicValue;
        }
        const fontsize = isEditBox
          ? this.findField(options?.object, ['fontsize', 'fontSize', 'font_size'])
          : this.propertyField(options, ['fontsize', 'fontSize', 'font_size'], 'font size');
        if (fontsize) {
          this.addValueGap('fontsize', fontsize, 'font size expression is dynamic or unknown');
          semantics.fontsize = fontsize.publicValue;
        }
        if (isEditBox) {
          const defaultText = this.findField(options?.object, ['defaultText']);
          const description = this.findField(options?.object, ['description']);
          if (defaultText || description) {
            const editBox: X4UiEditBoxSemantics = {};
            if (defaultText) {
              this.addValueGap('edit-box', defaultText, 'edit-box defaultText is dynamic or unknown');
              editBox.defaultText = defaultText.publicValue;
            }
            if (description) {
              this.addValueGap('edit-box', description, 'edit-box description is dynamic or unknown');
              editBox.description = description.publicValue;
            }
            semantics.editBox = editBox;
          } else if (options && this.hasUnresolvedProperties(options)) {
            const unresolved = this.unresolvedProperty(options, 'edit-box properties');
            this.addValueGap('edit-box', unresolved, 'edit-box properties are dynamic or unknown');
          }
        }
        if (isTextSetter && receiver?.object?.reference.kind === 'cell') {
          const cellKind = receiver.object.cellKind;
          const supported = name === 'setText'
            ? cellKind === 'icon' || cellKind === 'button' || cellKind === 'editbox'
            : cellKind === 'icon' || cellKind === 'button';
          if (!supported) {
            this.addGap(
              'data-flow',
              'unsupported',
              this.location(node),
              `${name} is not implemented by shipped ${cellKind || 'base'} cells`
            );
          }
        } else if (!isTextSetter && receiver?.object?.reference.kind === 'cell') {
          receiver.object.cellKind = name === 'createText'
            ? 'text'
            : name === 'createButton'
              ? 'button'
              : name === 'createEditBox'
                ? 'editbox'
                : 'icon';
        }
        this.attachReceiver(semantics, receiver, 'cell', node, 'cell used for rendered text/edit-box call');
        return receiver?.object;
      }
      default:
        return undefined;
    }
  }

  private requiredArgument(
    args: InternalValue[],
    index: number,
    category: X4UiVerificationGapCategory,
    label: string,
    node: LuaNode
  ): InternalValue {
    const value = args[index] || this.missing(node, label);
    this.addValueGap(category, value, `${label} is dynamic or unknown`);
    return value;
  }

  private findField(object: TrackedObject | undefined, names: string[]): InternalValue | undefined {
    if (!object) return undefined;
    const wanted = new Set(names.map(normalizePropertyName));
    for (const [name, value] of object.fields) {
      if (wanted.has(normalizePropertyName(name))) return value;
    }
    return undefined;
  }

  private setOptionalField(
    semantics: X4UiCallSemantics,
    field: 'width' | 'height' | 'layer',
    options: InternalValue | undefined,
    names: string[],
    category: X4UiVerificationGapCategory
  ): void {
    const value = this.propertyField(options, names, field);
    if (!value) return;
    this.addValueGap(category, value, `${field} expression is dynamic or unknown`);
    semantics[field] = value.publicValue;
  }

  private isColorProperty(name: string): boolean {
    return COLOR_PROPERTY_NAMES.has(normalizePropertyName(name));
  }

  private colorSourceLocation(node: LuaNode | undefined, value: InternalValue): X4UiSourceLocation {
    return node ? this.location(node) : value.publicValue.location;
  }

  private colorSourceExpression(node: LuaNode | undefined, value: InternalValue): string {
    return node ? this.textOf(node) : value.publicValue.expression;
  }

  private colorSourceKey(node: LuaNode | undefined, value: InternalValue): X4UiColorSourceKey {
    return {
      expression: this.colorSourceExpression(node, value),
      source: this.colorSourceLocation(node, value)
    };
  }

  private unresolvedColorExpression(
    node: LuaNode | undefined,
    value: InternalValue,
    reason: string
  ): X4UiColorUnresolvedExpression {
    return freezeDeepFact({
      kind: 'unresolved',
      resolution: 'unresolved',
      expression: this.colorSourceExpression(node, value),
      source: this.colorSourceLocation(node, value),
      reason
    });
  }

  private scalarColorExpression(
    node: LuaNode,
    value: InternalValue
  ): X4UiColorScalarExpression {
    const publicValue = value.publicValue;
    return freezeDeepFact({
      kind: 'scalar',
      resolution: 'existing-value',
      status: publicValue.status,
      type: publicValue.type,
      expression: this.textOf(node),
      source: this.location(node),
      ...(publicValue.value !== undefined || publicValue.type === 'nil'
        ? { value: publicValue.type === 'nil' ? null : publicValue.value }
        : {}),
      ...(publicValue.reason ? { reason: publicValue.reason } : {})
    });
  }

  private colorTableField(field: LuaNode): {
    name: string;
    keyNode: LuaNode;
    valueNode: LuaNode;
  } | undefined {
    const valueNode = nodeField<LuaNode>(field, 'value');
    if (!valueNode) return undefined;
    if (field.type === 'TableKeyString') {
      const keyNode = nodeField<LuaNode>(field, 'key');
      const name = nodeField<string>(keyNode, 'name');
      return keyNode && name ? { name, keyNode, valueNode } : undefined;
    }
    if (field.type === 'TableKey') {
      const keyNode = nodeField<LuaNode>(field, 'key');
      const name = staticString(keyNode);
      return keyNode && name !== undefined ? { name, keyNode, valueNode } : undefined;
    }
    return undefined;
  }

  private literalColorExpression(
    sourceNode: LuaNode,
    declarationNode: LuaNode,
    value: InternalValue
  ): X4UiColorExpression {
    if (declarationNode.type !== 'TableConstructorExpression') {
      return this.unresolvedColorExpression(sourceNode, value, 'source-literal color declaration is not a table literal');
    }
    if (!value.object?.known) {
      return this.unresolvedColorExpression(sourceNode, value, 'source-literal color table object is unresolved');
    }
    if (value.object.mutated || value.object.mutatedProperties.size > 0) {
      return this.unresolvedColorExpression(sourceNode, value, 'source-literal color table may have been mutated');
    }

    const fields = new Map<string, X4UiColorSourceField>();
    for (const field of nodeArray(declarationNode, 'fields')) {
      const descriptor = this.colorTableField(field);
      if (!descriptor) {
        return this.unresolvedColorExpression(
          sourceNode,
          value,
          'source-literal color table contains an unsupported or non-static field key'
        );
      }
      if (!['r', 'g', 'b', 'a', 'glow'].includes(descriptor.name)) {
        return this.unresolvedColorExpression(
          sourceNode,
          value,
          `source-literal color table contains unknown field "${descriptor.name}"`
        );
      }
      if (fields.has(descriptor.name)) {
        return this.unresolvedColorExpression(
          sourceNode,
          value,
          `source-literal color table contains duplicate field "${descriptor.name}"`
        );
      }
      const number = descriptor.valueNode.type === 'NumericLiteral'
        ? staticNumber(descriptor.valueNode)
        : undefined;
      if (number === undefined) {
        return this.unresolvedColorExpression(
          sourceNode,
          value,
          `source-literal color field "${descriptor.name}" is not a static numeric literal`
        );
      }
      fields.set(descriptor.name, {
        value: number,
        expression: this.textOf(descriptor.valueNode),
        source: this.location(descriptor.valueNode),
        keySource: this.location(descriptor.keyNode)
      });
    }

    if (!['r', 'g', 'b', 'a'].every(name => fields.has(name))) {
      return this.unresolvedColorExpression(
        sourceNode,
        value,
        'source-literal color table must contain exactly numeric r, g, b, and a fields'
      );
    }

    const result: X4UiColorLiteralExpression = {
      kind: 'literal-table',
      resolution: 'source-only',
      expression: this.textOf(sourceNode),
      source: this.location(sourceNode),
      declarationExpression: this.textOf(declarationNode),
      declarationSource: this.location(declarationNode),
      r: fields.get('r') as X4UiColorSourceField,
      g: fields.get('g') as X4UiColorSourceField,
      b: fields.get('b') as X4UiColorSourceField,
      a: fields.get('a') as X4UiColorSourceField,
      ...(fields.has('glow') ? { glow: fields.get('glow') as X4UiColorSourceField } : {})
    };
    return freezeDeepFact(result);
  }

  private indexedColorExpression(
    sourceNode: LuaNode,
    indexNode: LuaNode,
    value: InternalValue
  ): X4UiColorExpression {
    const base = nodeField<LuaNode>(indexNode, 'base');
    const index = nodeField<LuaNode>(indexNode, 'index');
    if (base?.type !== 'Identifier' || nodeField<string>(base, 'name') !== 'Color') {
      return this.unresolvedColorExpression(sourceNode, value, 'color reference base is not the unshadowed Color global');
    }
    if (this.bindings.has('Color')) {
      return this.unresolvedColorExpression(sourceNode, value, 'Color reference is shadowed by a local or assigned binding');
    }
    const key = this.colorSourceKey(index, value);
    const id = index?.type === 'StringLiteral' ? staticString(index) : undefined;
    if (id !== undefined) {
      return freezeDeepFact({
        kind: 'symbolic-reference',
        resolution: 'symbolic-only',
        base: 'Color',
        id,
        key,
        expression: this.textOf(sourceNode),
        source: this.location(sourceNode)
      });
    }
    return freezeDeepFact({
      kind: 'dynamic-reference',
      resolution: 'unresolved',
      base: 'Color',
      key,
      expression: this.textOf(sourceNode),
      source: this.location(sourceNode),
      reason: 'Color reference key is not a static string literal'
    });
  }

  private conditionalColorExpression(
    sourceNode: LuaNode,
    conditionalNode: LuaNode,
    value: InternalValue
  ): X4UiColorExpression {
    const left = nodeField<LuaNode>(conditionalNode, 'left');
    const right = nodeField<LuaNode>(conditionalNode, 'right');
    const operandValue = value;
    const operands = [left, right]
      .filter((operand): operand is LuaNode => Boolean(operand))
      .map(operand => this.colorSourceKey(operand, operandValue));
    return freezeDeepFact({
      kind: 'conditional',
      resolution: 'unresolved',
      operator: nodeField<string>(conditionalNode, 'operator') || 'unknown',
      operands,
      expression: this.textOf(sourceNode),
      source: this.location(sourceNode)
    });
  }

  private functionColorExpression(
    sourceNode: LuaNode,
    callNode: LuaNode
  ): X4UiColorExpression {
    const shape = this.callShape(callNode);
    const calleeNode = shape.calleeNode || callNode;
    return freezeDeepFact({
      kind: 'function-call',
      resolution: 'unresolved',
      calleeExpression: this.textOf(calleeNode),
      calleeSource: this.location(calleeNode),
      argumentSources: shape.args.map(argument => this.location(argument)),
      expression: this.textOf(sourceNode),
      source: this.location(sourceNode)
    });
  }

  private colorExpression(value: InternalValue): X4UiColorExpression {
    const node = value.sourceNode;
    if (!node) return this.unresolvedColorExpression(undefined, value, 'color expression has no source AST node');

    let shape = node;
    while (shape.type === 'ParenthesizedExpression') {
      const inner = nodeField<LuaNode>(shape, 'expression');
      if (!inner) break;
      shape = inner;
    }

    const declarationNode = value.object?.declarationNode;
    const indexBase = shape.type === 'IndexExpression'
      ? nodeField<LuaNode>(shape, 'base')
      : undefined;
    if (shape.type === 'IndexExpression'
      && indexBase?.type === 'Identifier'
      && nodeField<string>(indexBase, 'name') === 'Color') {
      return this.indexedColorExpression(node, shape, value);
    }
    if (declarationNode
      && ['TableConstructorExpression', 'Identifier', 'MemberExpression', 'IndexExpression'].includes(shape.type)) {
      return this.literalColorExpression(node, declarationNode, value);
    }

    switch (shape.type) {
      case 'TableConstructorExpression':
        return this.literalColorExpression(node, shape, value);
      case 'IndexExpression':
        return this.indexedColorExpression(node, shape, value);
      case 'LogicalExpression':
      case 'BinaryExpression': {
        const operator = nodeField<string>(shape, 'operator');
        if (shape.type === 'LogicalExpression' || operator === 'and' || operator === 'or') {
          return this.conditionalColorExpression(node, shape, value);
        }
        break;
      }
      case 'CallExpression':
      case 'StringCallExpression':
      case 'TableCallExpression':
        return this.functionColorExpression(node, shape);
      default:
        break;
    }

    if (['string', 'number', 'boolean', 'nil'].includes(value.publicValue.type)) {
      return this.scalarColorExpression(node, value);
    }
    return this.unresolvedColorExpression(
      node,
      value,
      `color expression shape ${node.type || 'unknown'} is not source-resolvable`
    );
  }

  private setOptionProjection(
    semantics: X4UiCallSemantics,
    options: InternalValue | undefined,
    callName: X4UiRelevantCallName,
    callNode: LuaNode
  ): void {
    if (!options) return;
    semantics.options = options.publicValue;
    if (options.publicValue.status === 'static' && options.publicValue.type === 'nil') return;

    const propertyNames = V1_PROPERTY_NAMES_BY_CALL[callName];
    if (options.object?.known && propertyNames) {
      const wanted = new Set(propertyNames.map(normalizePropertyName));
      const project = ([name, value]: [string, InternalValue]): X4UiCallPropertyProjection => {
        const colorExpression = this.isColorProperty(name) ? this.colorExpression(value) : undefined;
        if (colorExpression) {
          this.colorExpressions.push({
            callName,
            callSource: this.location(callNode),
            propertyName: name,
            source: colorExpression.source,
            colorExpression
          });
        }
        const projection: X4UiCallPropertyProjection = {
          name,
          normalizedName: normalizePropertyName(name),
          value: value.publicValue,
          source: value.publicValue.location,
          sourceOrder: value.publicValue.location.start.offset
        };
        return projection;
      };
      const fields = [...options.object.fields.entries()];
      semantics.properties = fields.filter(([name]) => wanted.has(normalizePropertyName(name))).map(project);
      if (callName === 'setText' || callName === 'setText2') {
        const unsupported = fields.filter(([name]) => !wanted.has(normalizePropertyName(name))).map(project);
        if (unsupported.length > 0) {
          semantics.unsupportedProperties = unsupported;
          for (const projected of unsupported) {
            this.addGap(
              'property',
              'unsupported',
              projected.source,
              `${callName} property ${projected.name} is not part of shipped textproperty`,
              projected.value.expression
            );
          }
        }
      }
      return;
    }

    const unresolved = this.unresolvedProperty(options, `${callName} option table`);
    this.addValueGap('property', unresolved, `${callName} option table is dynamic or unknown`);
  }

  private attachHelperReceiver(
    semantics: X4UiCallSemantics,
    receiver: InternalValue | undefined,
    node: LuaNode,
    label: string
  ): void {
    if (
      receiver
      && receiver.publicValue.status === 'static'
      && receiver.publicValue.reference?.kind === 'global'
      && receiver.publicValue.reference.path === 'Helper'
    ) return;

    const unresolved = !receiver
      ? this.unknown(node, 'reference', label)
      : receiver.publicValue.status === 'static'
        ? this.dynamic(node, 'reference', `${label} receiver is not the Helper global`)
        : receiver;
    semantics.dataFlow = unresolved.publicValue;
    this.addValueGap('data-flow', unresolved, `${label} data-flow is dynamic or unknown`);
  }

  private propertyField(
    options: InternalValue | undefined,
    names: string[],
    label: string
  ): InternalValue | undefined {
    const value = this.findField(options?.object, names);
    if (value) return value;
    if (!options || !this.hasUnresolvedProperties(options)) return undefined;
    return this.unresolvedProperty(options, label);
  }

  private hasUnresolvedProperties(options: InternalValue | undefined): boolean {
    if (!options) return false;
    if (options.publicValue.status === 'static' && options.publicValue.type === 'nil') return false;
    return !options.object?.known;
  }

  private unresolvedProperty(options: InternalValue, label: string): InternalValue {
    const status: X4UiValueStatus = options.publicValue.status === 'dynamic' ? 'dynamic' : 'unknown';
    return {
      publicValue: {
        status,
        type: 'unknown',
        expression: options.publicValue.expression,
        location: options.publicValue.location,
        reason: `${label} depends on a properties argument that is not a statically known table`
      }
    };
  }

  private menuName(menu: InternalValue, node: LuaNode): InternalValue {
    if (menu.publicValue.status === 'static' && menu.publicValue.type === 'string') return menu;
    const field = this.findField(menu.object, ['name']);
    if (field) {
      if (menu.object?.known === false) {
        const unresolved = this.unknown(node, field.publicValue.type, 'menu name depends on an unresolved menu object');
        this.addValueGap('menu', unresolved, 'menu name is dynamic or unknown');
        return unresolved;
      }
      this.addValueGap('menu', field, 'menu name is dynamic or unknown');
      return field;
    }
    const missing = this.missing(node, 'menu name');
    this.addValueGap('menu', missing, 'menu name is not statically traceable');
    return missing;
  }

  private setMenuLayer(semantics: X4UiCallSemantics, menu: InternalValue, node: LuaNode): void {
    const field = this.findField(menu.object, ['layer']);
    if (field) {
      if (menu.object?.known === false) {
        const unresolved = this.unknown(node, field.publicValue.type, 'menu layer depends on an unresolved menu object');
        semantics.layer = unresolved.publicValue;
        this.addValueGap('layer', unresolved, 'menu layer is dynamic or unknown');
      } else {
        semantics.layer = field.publicValue;
        this.addValueGap('layer', field, 'menu layer is dynamic or unknown');
      }
      return;
    }
    if (menu.object?.known) return;
    if (menu.publicValue.status === 'static' && menu.publicValue.type === 'string') return;

    const unresolved = this.unknown(node, 'number', 'menu layer depends on an unresolved menu value');
    semantics.layer = unresolved.publicValue;
    this.addValueGap('layer', unresolved, 'menu layer is dynamic or unknown');

    const dataFlow = menu.publicValue.status === 'static'
      ? this.unknown(node, 'reference', 'menu data-flow is not statically traceable')
      : menu;
    semantics.dataFlow = dataFlow.publicValue;
    this.addValueGap('data-flow', dataFlow, 'menu data-flow is dynamic or unknown');
  }

  private copyOptionFields(target: TrackedObject, options: InternalValue | undefined): void {
    if (!options?.object) return;
    for (const [name, value] of options.object.fields) target.fields.set(name, value);
  }

  private attachReceiver(
    semantics: X4UiCallSemantics,
    receiver: InternalValue | undefined,
    expected: 'frame' | 'table' | 'cell',
    node: LuaNode,
    label: string
  ): void {
    const field = expected === 'frame' ? 'frame' : expected === 'table' ? 'table' : 'cell';
    if (receiver) semantics[field] = receiver.publicValue;
    if (!receiver || receiver.publicValue.status !== 'static' || !receiver.object?.known) {
      const unresolved = receiver || this.unknown(node, 'reference', `${label} is unresolved`);
      semantics.dataFlow = unresolved.publicValue;
      this.addValueGap('data-flow', unresolved, `${label} data-flow is dynamic or unknown`);
      return;
    }
    const actual = receiver.object.reference.kind;
    const compatible = expected === 'cell'
      ? actual === 'cell' || actual === 'row' || actual === 'table'
      : actual === expected;
    if (!compatible) {
      const mismatch = this.dynamic(node, 'reference', `${label} has tracked kind ${actual}, expected ${expected}`);
      semantics.dataFlow = mismatch.publicValue;
      this.addValueGap('data-flow', mismatch, `${label} receiver kind is not statically compatible`);
    }
  }

  private isRelevantProperty(name: string): boolean {
    return [
      'name', 'layer', 'width', 'height', 'framewidth', 'frameheight', 'autoframeheight', 'tablewidth', 'tableheight',
      'columns', 'cols', 'colspan', 'colwidth', 'colwidthpercent', 'text', 'caption', 'label',
      'fontsize', 'font_size', 'edit', 'editbox', 'edit_box', 'input', 'placeholder', 'onclick',
      'onshowmenu', 'x', 'y', 'standardbuttons', 'backgroundid', 'backgroundcolor', 'blurbackground',
      'taborder', 'highlightmode', 'maxvisibleheight', 'reservescrollbar', 'scaling', 'paddingtop',
      'paddingbottom', 'borderbelow', 'fixed', 'color', 'halign', 'wordwrap', 'font', 'cellbgcolor',
      'active', 'bgcolor', 'highlightcolor', 'bordercolor', 'affectrowheight', 'defaulttext',
      'maxchars', 'selecttextonactivation'
    ].includes(normalizePropertyName(name));
  }

  private propertyGapCategory(name: string): X4UiVerificationGapCategory | undefined {
    const normalized = normalizePropertyName(name);
    if (normalized === 'name') return 'menu';
    if (normalized === 'layer') return 'layer';
    if (normalized === 'width' || normalized.includes('width')) return 'width';
    if (normalized === 'height' || normalized.includes('height')) return 'height';
    if (normalized === 'columns' || normalized === 'cols') return 'count';
    if (normalized === 'colspan') return 'span';
    if (normalized === 'colwidthpercent') return 'percentage';
    if (normalized === 'colwidth') return 'width';
    if (['text', 'caption', 'label'].includes(normalized)) return 'text';
    if (normalized === 'fontsize') return 'fontsize';
    if (['edit', 'editbox', 'input', 'placeholder', 'defaulttext', 'maxchars', 'selecttextonactivation'].includes(normalized)) return 'edit-box';
    if (['color', 'halign', 'wordwrap', 'font', 'cellbgcolor'].includes(normalized)) return 'text';
    return 'property';
  }

  private addProperty(
    object: TrackedObject | undefined,
    name: string,
    keyNode: LuaNode,
    value: InternalValue,
    assignment: X4UiPropertyAssignment,
    sourceNode: LuaNode,
    context: X4UiFunctionContext
  ): void {
    if (!this.isRelevantProperty(name)) return;
    const owner = object ? this.referenceValue(object, sourceNode).publicValue : this.unknown(sourceNode, 'reference', 'property owner is unresolved').publicValue;
    const record: X4UiPropertyRecord = {
      recordType: 'property',
      name,
      path: object ? `${object.reference.path}.${name}` : this.textOf(sourceNode),
      source: this.location(sourceNode),
      sourceOrder: this.sourceOffset(keyNode),
      order: -1,
      owner,
      value: value.publicValue,
      assignment,
      context
    };
    this.addPending(record, keyNode);
    this.propertyObjects.set(record, object);

    if (object && !object.known) {
      const unresolvedOwner = this.referenceValue(object, sourceNode);
      this.addValueGap('data-flow', unresolvedOwner, `property ${name} owner data-flow is unknown`);
    }
    const category = this.propertyGapCategory(name);
    if (category) this.addValueGap(category, value, `${name} property is dynamic or unknown`);

    if (isOnClick(name)) this.addHandler(object, record.path, keyNode, value, sourceNode, context);
  }

  private addHandler(
    object: TrackedObject | undefined,
    fallbackPath: string,
    keyNode: LuaNode,
    value: InternalValue,
    sourceNode: LuaNode,
    parentContext: X4UiFunctionContext
  ): void {
    const functionNode = value.functionNode;
    const key = `${object?.id || fallbackPath}|${this.sourceOffset(functionNode || sourceNode)}`;
    if (this.handlerKeys.has(key)) return;
    this.handlerKeys.add(key);

    const path = object ? `${object.reference.path}.onClick` : fallbackPath;
    const context: X4UiFunctionContext = {
      ...parentContext,
      kind: 'handler',
      name: path,
      handler: 'onClick',
      source: functionNode ? this.location(functionNode) : this.location(sourceNode)
    };
    const record: X4UiHandlerRecord = {
      recordType: 'handler',
      name: 'onClick',
      path,
      source: this.location(sourceNode),
      sourceOrder: this.sourceOffset(keyNode),
      order: -1,
      value: value.publicValue,
      functionSource: functionNode ? this.location(functionNode) : undefined,
      bodySource: functionNode ? this.functionBodyLocation(functionNode) : undefined,
      parameters: functionNode ? this.functionParameters(functionNode) : undefined,
      context
    };
    this.addPending(record, keyNode);
    this.handlerObjects.set(record, object);

    if (!functionNode) {
      this.addValueGap('data-flow', value, 'onClick handler function body is dynamic or unknown');
      return;
    }
    this.processFunction(functionNode, path, context, parentContext);
  }

  private functionParameters(node: LuaNode): string[] {
    return nodeArray(node, 'parameters')
      .map(parameter => nodeField<string>(parameter, 'name'))
      .filter((name): name is string => Boolean(name));
  }

  private functionReturnSources(node: LuaNode): X4UiSourceLocation[] {
    const result: X4UiSourceLocation[] = [];
    const visit = (candidate: LuaNode): void => {
      if (candidate !== node && candidate.type === 'FunctionDeclaration') return;
      if (candidate.type === 'ReturnStatement') {
        result.push(this.location(candidate));
        return;
      }
      for (const [key, child] of Object.entries(candidate)) {
        if (key === 'loc' || key === 'range' || key === 'comments' || key === 'tokens' || key === 'globals') continue;
        if (Array.isArray(child)) child.filter(isLuaNode).forEach(visit);
        else if (isLuaNode(child)) visit(child);
      }
    };
    for (const statement of nodeArray(node, 'body')) visit(statement);
    return result;
  }

  private createLocalFunction(
    node: LuaNode,
    identifier: LuaNode,
    name: string,
    context: X4UiFunctionContext
  ): InternalLocalFunction | undefined {
    if (!nodeField<boolean>(node, 'isLocal') || identifier.type !== 'Identifier') return undefined;
    const existing = this.localFunctionByNode.get(node);
    if (existing) return existing;
    const source = this.location(node);
    const declarationId = this.localFunctionId(source);
    const parameters = nodeArray(node, 'parameters')
      .map((parameter, index): X4UiLocalFunctionParameterIdentity | undefined => {
        if (parameter.type !== 'Identifier') return undefined;
        const parameterName = nodeField<string>(parameter, 'name');
        if (!parameterName) return undefined;
        const parameterSource = this.location(parameter);
        return {
          id: this.localParameterId(declarationId, index, parameterSource),
          declarationId,
          index,
          name: parameterName,
          source: parameterSource
        };
      })
      .filter((parameter): parameter is X4UiLocalFunctionParameterIdentity => Boolean(parameter));
    const declaration: X4UiLocalFunctionDeclaration = {
      id: declarationId,
      name,
      source,
      identifierSource: this.location(identifier),
      bodySource: this.functionBodyLocation(node),
      parameters,
      hasVarargs: nodeArray(node, 'parameters').some(parameter => parameter.type === 'VarargLiteral'),
      returnSources: this.functionReturnSources(node),
      context
    };
    const localFunction: InternalLocalFunction = {
      node,
      declaration,
      declaredName: name,
      declarationBindingSource: declaration.identifierSource
    };
    this.localFunctions.push(declaration);
    this.localFunctionByNode.set(node, localFunction);
    return localFunction;
  }

  private functionBodyLocation(node: LuaNode): X4UiSourceLocation {
    const body = nodeArray(node, 'body');
    if (body.length === 0) return this.location(node);
    const first = this.location(body[0]);
    const last = this.location(body[body.length - 1]);
    return {
      file: this.input.rel,
      sourcePath: this.input.sourcePath,
      start: first.start,
      end: last.end
    };
  }

  private addAlias(name: string, value: InternalValue, target: LuaNode, context: X4UiFunctionContext, aliasKind: X4UiAliasRecord['aliasKind']): void {
    if (!this.isRelevantBinding(name, value)) return;
    const record: X4UiAliasRecord = {
      recordType: 'alias',
      name,
      source: this.location(target),
      sourceOrder: this.sourceOffset(target),
      order: -1,
      value: value.publicValue,
      aliasKind,
      context
    };
    this.addPending(record, target);
  }

  private addHelperReceiverAlias(
    name: string,
    target: LuaNode,
    context: X4UiFunctionContext,
    aliasKind: X4UiAliasRecord['aliasKind'],
    status: X4UiHelperReceiverAliasStatus,
    reason: string,
    callSource?: X4UiSourceLocation
  ): void {
    const targetSource = this.location(target);
    const source = callSource || targetSource;
    this.helperReceiverAliases.push({
      id: `helper-receiver-alias:${this.locationIdentity(source)}|${this.locationIdentity(targetSource)}|${status}`,
      name,
      source,
      targetSource,
      ...(callSource ? { callSource } : {}),
      aliasKind,
      status,
      runtimeAvailability: 'unverified',
      reason,
      context
    });
  }

  private isRelevantBinding(name: string, value: InternalValue): boolean {
    if (value.object || value.functionNode || value.publicValue.type === 'reference' || value.publicValue.type === 'table' || value.publicValue.type === 'function'
      || value.directHelperScaleCall || value.publicValue.directHelperScaleResult || value.publicValue.numericExpression) return true;
    return /^(menu|frame|table|row|cell|handler|handlers|onClick)$/i.test(name);
  }

  private bindDirectHelperScaleResult(
    name: string,
    value: InternalValue,
    target: LuaNode,
  ): InternalValue {
    const prior = value.publicValue.directHelperScaleResult;
    const directCall = value.directHelperScaleCall;
    if (!prior && !directCall) return value;
    const identity: X4UiDirectHelperScaleResultIdentity = freezeDeepFact({
      callName: prior?.callName || directCall!.callName,
      callSource: prior?.callSource || directCall!.source,
      callExpression: prior?.callExpression || directCall!.expression,
      bindingName: name,
      bindingSource: this.location(target),
    });
    const publicValue = {
      ...value.publicValue,
      directHelperScaleResult: identity,
    };
    if (identity.callName === 'scaleX' || identity.callName === 'scaleY') {
      publicValue.numericExpression = freezeNumericExpression({
        kind: 'direct-helper-scale',
        identity,
        expression: value.publicValue.expression,
        source: value.publicValue.location,
      });
    } else {
      delete publicValue.numericExpression;
    }
    return {
      ...value,
      publicValue,
    };
  }

  private bindName(name: string, value: InternalValue, target: LuaNode, context: X4UiFunctionContext, aliasKind: X4UiAliasRecord['aliasKind']): void {
    const previous = this.bindings.get(name)?.value;
    let boundValue = value;
    const candidate = value.helperAliasCandidate;
    if (candidate) {
      const mayBind = candidate.valid && (aliasKind === 'definition' || Boolean(previous?.helperAlias));
      if (mayBind) {
        const helperAlias: InternalHelperAlias = {
          name,
          bindingSource: this.location(target),
          callSource: candidate.callSource
        };
        boundValue = this.helperAliasValue(helperAlias, target);
        this.addHelperReceiverAlias(
          name,
          target,
          context,
          aliasKind,
          aliasKind === 'definition' ? 'bound' : 'preserved',
          'exact unshadowed rawget(_G, "Helper") proves preview receiver identity; runtime availability remains unverified',
          candidate.callSource
        );
        this.addGap(
          'data-flow',
          'unknown',
          candidate.callSource,
          'Helper receiver alias is source-proven for preview, but runtime non-nil availability is unverified'
        );
        if (aliasKind === 'assignment' && previous?.helperAlias) {
          this.recordControlFlowHelperAliasAssignment(name, true);
        }
      } else {
        const reason = candidate.valid
          ? 'exact Helper rawget reassignment has no prior lexical Helper alias to preserve'
          : candidate.reason;
        boundValue = this.unknown(target, 'reference', reason, name);
        this.addHelperReceiverAlias(name, target, context, aliasKind, 'rejected', reason, candidate.callSource);
        this.addGap('data-flow', 'unsupported', candidate.callSource, reason);
        if (previous?.helperAlias) this.recordControlFlowHelperAliasAssignment(name, false);
      }
    } else if (previous?.helperAlias || value.helperAlias
      || (value.publicValue.reference?.kind === 'global' && value.publicValue.reference.path === 'Helper')) {
      const reason = previous?.helperAlias
        ? 'non-matching assignment invalidates the lexical Helper receiver alias from this source point'
        : 'Helper receiver identity may only be copied from exact rawget(_G, "Helper") evidence';
      boundValue = this.unknown(target, 'reference', reason, name);
      this.addHelperReceiverAlias(
        name,
        target,
        context,
        aliasKind,
        previous?.helperAlias ? 'invalidated' : 'rejected',
        reason,
        previous?.helperAlias.callSource || value.helperAlias?.callSource
      );
      this.addGap('data-flow', 'unsupported', this.location(target), reason);
      if (previous?.helperAlias) this.recordControlFlowHelperAliasAssignment(name, false);
    }

    boundValue = this.bindDirectHelperScaleResult(name, boundValue, target);

    this.bindings.set(name, { value: boundValue, source: this.location(target) });
    if (boundValue.object) {
      const object = boundValue.object;
      if (object.reference.path.startsWith('@')) object.reference.path = name;
      object.aliases.add(name);
      for (const call of this.resultCalls.get(object.id) || []) {
        call.assignedTo = call.assignedTo || [];
        if (!call.assignedTo.includes(name)) call.assignedTo.push(name);
      }
    }
    this.addAlias(name, boundValue, target, context, aliasKind);
  }

  private ensureObjectForTarget(node: LuaNode, value: InternalValue | undefined, _context: X4UiFunctionContext): TrackedObject | undefined {
    if (value?.object) return value.object;
    const path = this.expressionPath(node);
    if (!path) return undefined;
    const object = this.newObject('unknown', node, 'unknown', undefined, undefined, false);
    object.reference.path = path;
    if (node.type === 'Identifier') {
      const name = nodeField<string>(node, 'name');
      if (name) this.bindings.set(name, { value: this.referenceValue(object, node) });
    }
    this.addValueGap('data-flow', this.referenceValue(object, node), `target object ${path} is not statically defined`);
    return object;
  }

  private markObjectMutation(object: TrackedObject, name?: string): void {
    object.mutated = true;
    if (name) object.mutatedProperties.add(normalizePropertyName(name));
  }

  private assignTarget(
    target: LuaNode,
    value: InternalValue,
    context: X4UiFunctionContext,
    assignment: X4UiPropertyAssignment
  ): void {
    if (target.type === 'Identifier') {
      const name = nodeField<string>(target, 'name');
      if (name) this.bindName(name, value, target, context, assignment === 'function-declaration' ? 'definition' : 'assignment');
      return;
    }
    if (target.type === 'MemberExpression') {
      const baseNode = nodeField<LuaNode>(target, 'base');
      const baseValue = this.evaluate(baseNode, context);
      const object = this.ensureObjectForTarget(baseNode || target, baseValue, context);
      const name = luaNodeName(nodeField<LuaNode>(target, 'identifier'));
      if (!name) {
        this.addGap('unsupported', 'unsupported', this.location(target), 'member assignment has no static property name', this.textOf(target));
        return;
      }
      if (object) {
        object.fields.set(name, value);
        this.markObjectMutation(object, name);
      }
      if (object) this.recordControlFlowPropertyMutation(object, name);
      this.refreshObjectKind(object || this.newObject('unknown', target, 'unknown', undefined, undefined, false));
      this.addProperty(object, name, nodeField<LuaNode>(target, 'identifier') || target, value, assignment, target, context);
      return;
    }
    if (target.type === 'IndexExpression') {
      const baseNode = nodeField<LuaNode>(target, 'base');
      const baseValue = this.evaluate(baseNode, context);
      const object = this.ensureObjectForTarget(baseNode || target, baseValue, context);
      const index = this.evaluate(nodeField<LuaNode>(target, 'index'), context);
      if (index.publicValue.status !== 'static') this.addValueGap('index', index, 'indexed assignment position is dynamic or unknown');
      if (object && index.publicValue.status !== 'static') {
        this.markObjectMutation(object);
        this.recordControlFlowPropertyMutation(object);
      }
      if (object && index.publicValue.status === 'static' && (index.publicValue.type === 'string' || index.publicValue.type === 'number')) {
        const property = String(index.publicValue.value);
        if (index.publicValue.type === 'string') {
          object.fields.set(property, value);
          this.markObjectMutation(object, property);
          this.recordControlFlowPropertyMutation(object, property);
          this.addProperty(object, property, nodeField<LuaNode>(target, 'index') || target, value, 'index-assignment', target, context);
        } else if (value.object) {
          object.indexed.set(property, value.object);
        }
      }
      return;
    }
    this.addGap('unsupported', 'unsupported', this.location(target), 'assignment target shape is not modeled', this.textOf(target));
  }

  private assignFunctionTarget(target: LuaNode, functionValue: InternalValue, context: X4UiFunctionContext): void {
    this.assignTarget(target, functionValue, context, 'function-declaration');
    const name = this.expressionPath(target);
    if (name && isOnClick(name.split('.').pop() || '') && target.type === 'Identifier') {
      this.addHandler(undefined, name, target, functionValue, target, context);
    }
  }

  private snapshotTrackedObjectState(bindings: Map<string, Binding>): Map<TrackedObject, TrackedObjectStateSnapshot> {
    const snapshots = new Map<TrackedObject, TrackedObjectStateSnapshot>();
    const visit = (object: TrackedObject): void => {
      if (snapshots.has(object)) return;
      snapshots.set(object, {
        reference: { ...object.reference },
        known: object.known,
        fields: [...object.fields.entries()],
        indexed: [...object.indexed.entries()],
        aliases: [...object.aliases],
        mutated: object.mutated,
        mutatedProperties: [...object.mutatedProperties]
      });
      for (const value of object.fields.values()) {
        if (value.object) visit(value.object);
      }
      for (const child of object.indexed.values()) visit(child);
    };

    for (const binding of bindings.values()) {
      if (binding.value.object) visit(binding.value.object);
    }
    return snapshots;
  }

  private restoreTrackedObjectState(snapshots: Map<TrackedObject, TrackedObjectStateSnapshot>): void {
    for (const [object, snapshot] of snapshots) {
      object.known = snapshot.known;
      object.fields.clear();
      for (const [name, value] of snapshot.fields) object.fields.set(name, value);
      object.indexed.clear();
      for (const [index, child] of snapshot.indexed) object.indexed.set(index, child);
      object.aliases.clear();
      for (const alias of snapshot.aliases) object.aliases.add(alias);
      object.mutated = snapshot.mutated;
      object.mutatedProperties.clear();
      for (const property of snapshot.mutatedProperties) object.mutatedProperties.add(property);

      const reference = object.reference as unknown as Record<string, unknown>;
      const savedReference = snapshot.reference as unknown as Record<string, unknown>;
      for (const key of Object.keys(reference)) {
        if (!(key in savedReference)) delete reference[key];
      }
      Object.assign(reference, savedReference);
    }
  }

  private processFunction(
    node: LuaNode,
    name: string | undefined,
    handlerContext: X4UiFunctionContext,
    parentContext: X4UiFunctionContext,
    localFunction?: InternalLocalFunction
  ): void {
    const key = `${this.sourceOffset(node)}|${handlerContext.kind}|${name || ''}`;
    if (this.processedFunctions.has(key)) return;
    this.processedFunctions.add(key);

    const objectState = this.snapshotTrackedObjectState(this.bindings);
    const localBindings = new Map(this.bindings);
    for (const [index, parameter] of nodeArray(node, 'parameters').entries()) {
      const parameterName = nodeField<string>(parameter, 'name');
      if (parameterName) {
        const parameterValue = this.unknown(parameter, 'identifier', `function parameter "${parameterName}" is runtime-provided`, parameterName);
        const identity = localFunction?.declaration.parameters.find(candidate => candidate.index === index);
        if (identity) parameterValue.publicValue.parameter = identity;
        localBindings.set(parameterName, { value: parameterValue, source: this.location(parameter) });
      }
    }
    if (nodeField<boolean>(node, 'isMethod')) {
      localBindings.set('self', { value: this.unknown(node, 'identifier', 'method self value is runtime-provided', 'self') });
    }
    const inheritedBranchPath = handlerContext.branchPath.length > 0
      ? handlerContext.branchPath
      : parentContext.branchPath;
    const inheritedLoopPath = handlerContext.loopPath.length > 0
      ? handlerContext.loopPath
      : parentContext.loopPath;
    const inheritedReachability = this.combineReachability(
      parentContext.reachability,
      handlerContext.reachability
    );
    const context = handlerContext.kind === 'handler'
      ? {
        ...handlerContext,
        branchPath: inheritedBranchPath,
        loopPath: inheritedLoopPath,
        reachability: inheritedReachability
      }
      : {
        ...handlerContext,
        kind: 'function' as const,
        name,
        source: this.location(node),
        branchPath: inheritedBranchPath,
        loopPath: inheritedLoopPath,
        reachability: inheritedReachability
      };
    this.functionAnalysisDepth += 1;
    try {
      this.processStatements(nodeArray(node, 'body'), localBindings, context);
    } finally {
      this.functionAnalysisDepth -= 1;
      this.restoreTrackedObjectState(objectState);
    }
  }

  private processFunctionDeclaration(node: LuaNode, bindings: Map<string, Binding>, context: X4UiFunctionContext): void {
    const identifier = nodeField<LuaNode>(node, 'identifier');
    if (!identifier) return;
    const name = this.expressionPath(identifier);
    const localFunction = name ? this.createLocalFunction(node, identifier, name, context) : undefined;
    const functionValue: InternalValue = {
      publicValue: this.value(node, 'static', 'function'),
      functionNode: node,
      ...(localFunction ? { localFunction } : {})
    };
    this.assignFunctionTarget(identifier, functionValue, context);
    const functionContext: X4UiFunctionContext = {
      ...context,
      kind: name && isOnClick(name.split('.').pop() || '') ? 'handler' : 'function',
      name,
      handler: name && isOnClick(name.split('.').pop() || '') ? 'onClick' : undefined,
      source: this.location(node)
    };
    this.processFunction(node, name, functionContext, context, localFunction);
    if (identifier.type === 'Identifier') {
      const identifierName = nodeField<string>(identifier, 'name');
      if (identifierName) bindings.set(identifierName, { value: functionValue, source: this.location(identifier) });
    }
  }

  private processStatements(statements: LuaNode[], bindings: Map<string, Binding>, context: X4UiFunctionContext): void {
    const previousBindings = this.replaceBindings(bindings);
    for (const statement of statements) this.processStatement(statement, bindings, context);
    this.restoreBindings(previousBindings);
  }

  private replaceBindings(bindings: Map<string, Binding>): Map<string, Binding> {
    const current = new Map(this.bindings);
    this.bindings.clear();
    for (const [name, binding] of bindings) this.bindings.set(name, binding);
    return current;
  }

  private restoreBindings(bindings: Map<string, Binding>): void {
    this.bindings.clear();
    for (const [name, binding] of bindings) this.bindings.set(name, binding);
  }

  private shouldInvalidateControlFlowBinding(_value: InternalValue): boolean {
    // Every binding visible before a control-flow body can be changed there.
    // Relevant consumers decide later whether the resulting unknown is a gap;
    // limiting this set to widget objects would leave scalar dimensions and
    // menu/properties aliases falsely static.
    return true;
  }

  private collectControlFlowReassignments(
    statements: LuaNode[],
    trackedNames: Set<string>,
    localNames: Set<string>,
    reassignments: Set<string>
  ): void {
    const visibleLocals = new Set(localNames);
    for (const statement of statements) {
      switch (statement.type) {
        case 'LocalStatement':
          for (const variable of nodeArray(statement, 'variables')) {
            const name = nodeField<string>(variable, 'name');
            if (name) visibleLocals.add(name);
          }
          break;
        case 'AssignmentStatement':
          for (const variable of nodeArray(statement, 'variables')) {
            if (variable.type !== 'Identifier') continue;
            const name = nodeField<string>(variable, 'name');
            if (name && trackedNames.has(name) && !visibleLocals.has(name)) reassignments.add(name);
          }
          break;
        case 'FunctionDeclaration': {
          const identifier = nodeField<LuaNode>(statement, 'identifier');
          const isLocal = nodeField<boolean>(statement, 'isLocal') || nodeField<boolean>(identifier, 'isLocal');
          if (identifier?.type !== 'Identifier') break;
          const name = nodeField<string>(identifier, 'name');
          if (isLocal) {
            if (name) visibleLocals.add(name);
            break;
          }
          if (name && trackedNames.has(name) && !visibleLocals.has(name)) reassignments.add(name);
          break;
        }
        case 'IfStatement':
          for (const clause of nodeArray(statement, 'clauses')) {
            this.collectControlFlowReassignments(
              nodeArray(clause, 'body'),
              trackedNames,
              new Set(visibleLocals),
              reassignments
            );
          }
          this.collectControlFlowReassignments(
            nodeArray(statement, 'elseBody'),
            trackedNames,
            new Set(visibleLocals),
            reassignments
          );
          break;
        case 'WhileStatement':
        case 'RepeatStatement':
        case 'DoStatement':
          this.collectControlFlowReassignments(
            nodeArray(statement, 'body'),
            trackedNames,
            new Set(visibleLocals),
            reassignments
          );
          break;
        case 'ForNumericStatement': {
          const loopLocals = new Set(visibleLocals);
          const variable = nodeField<LuaNode>(statement, 'variable');
          const name = nodeField<string>(variable, 'name');
          if (name) loopLocals.add(name);
          this.collectControlFlowReassignments(
            nodeArray(statement, 'body'),
            trackedNames,
            loopLocals,
            reassignments
          );
          break;
        }
        case 'ForGenericStatement': {
          const loopLocals = new Set(visibleLocals);
          for (const variable of nodeArray(statement, 'variables')) {
            const name = nodeField<string>(variable, 'name');
            if (name) loopLocals.add(name);
          }
          this.collectControlFlowReassignments(
            nodeArray(statement, 'body'),
            trackedNames,
            loopLocals,
            reassignments
          );
          break;
        }
        default:
          break;
      }
    }
  }

  private controlFlowReassignments(
    statements: LuaNode[],
    preBodyBindings: Map<string, Binding>
  ): Set<string> {
    const trackedNames = new Set(
      [...preBodyBindings]
        .filter(([, binding]) => this.shouldInvalidateControlFlowBinding(binding.value))
        .map(([name]) => name)
    );
    const reassignments = new Set<string>();
    this.collectControlFlowReassignments(statements, trackedNames, new Set<string>(), reassignments);
    return reassignments;
  }

  private invalidateControlFlowBindings(
    reassignments: Set<string>,
    preBodyBindings: Map<string, Binding>,
    boundary: LuaNode
  ): void {
    for (const name of reassignments) {
      const binding = preBodyBindings.get(name);
      if (!binding || !this.shouldInvalidateControlFlowBinding(binding.value)) continue;
      this.bindings.set(name, {
        value: this.unknown(
          boundary,
          'identifier',
          `identifier "${name}" may be reassigned in a control-flow block`,
          name
        )
      });
    }
  }

  private recordControlFlowPropertyMutation(object: TrackedObject, name?: string): void {
    if (this.controlFlowMutationStates.length === 0) return;
    if (name && !this.isRelevantProperty(name)) return;
    if (!name && !['object', 'menu', 'unknown'].includes(object.reference.kind)) return;

    for (const state of this.controlFlowMutationStates) {
      if (state.functionAnalysisDepth !== this.functionAnalysisDepth) continue;
      if (name) {
        const names = state.propertyMutations.get(object) || new Set<string>();
        names.add(name);
        state.propertyMutations.set(object, names);
      } else {
        state.unknownPropertyObjects.add(object);
      }
    }
  }

  private recordControlFlowHelperAliasAssignment(name: string, preserved: boolean): void {
    for (const state of this.controlFlowMutationStates) {
      if (state.functionAnalysisDepth !== this.functionAnalysisDepth) continue;
      (preserved ? state.preservedHelperAliases : state.invalidatedHelperAliases).add(name);
    }
  }

  private invalidateControlFlowProperty(object: TrackedObject, name: string, boundary: LuaNode): void {
    const normalized = normalizePropertyName(name);
    object.mutated = true;
    object.mutatedProperties.add(normalized);
    const fieldNames = [...object.fields.keys()].filter(field => normalizePropertyName(field) === normalized);
    if (fieldNames.length === 0) fieldNames.push(name);

    for (const fieldName of fieldNames) {
      const previous = object.fields.get(fieldName);
      const type = previous?.publicValue.type || 'unknown';
      object.fields.set(
        fieldName,
        this.unknown(boundary, type, `property "${fieldName}" may be mutated in a control-flow block`)
      );
    }
  }

  private invalidateControlFlowProperties(state: ControlFlowMutationState, boundary: LuaNode): void {
    for (const object of state.unknownPropertyObjects) {
      object.known = false;
      for (const name of object.fields.keys()) {
        if (this.isRelevantProperty(name)) this.invalidateControlFlowProperty(object, name, boundary);
      }
    }
    for (const [object, names] of state.propertyMutations) {
      for (const name of names) this.invalidateControlFlowProperty(object, name, boundary);
    }
  }

  private loopBodyBindings(
    preBodyBindings: Map<string, Binding>,
    statement: LuaNode
  ): Map<string, Binding> {
    const bodyBindings = new Map(preBodyBindings);
    const variables = statement.type === 'ForNumericStatement'
      ? [nodeField<LuaNode>(statement, 'variable')].filter((variable): variable is LuaNode => Boolean(variable))
      : nodeArray(statement, 'variables');
    for (const variable of variables) {
      const name = nodeField<string>(variable, 'name');
      if (!name) continue;
      bodyBindings.set(name, {
        value: this.unknown(variable, 'identifier', `for-loop variable "${name}" is local to the loop`, name)
      });
    }
    return bodyBindings;
  }

  private processControlFlowBodies(
    bodies: LuaNode[][],
    context: X4UiFunctionContext,
    boundary: LuaNode,
    loopStatement?: LuaNode,
    bodyContexts?: readonly X4UiFunctionContext[]
  ): void {
    const preBodyBindings = new Map(this.bindings);
    const reassignments = new Set<string>();
    const mutationState: ControlFlowMutationState = {
      functionAnalysisDepth: this.functionAnalysisDepth,
      propertyMutations: new Map(),
      unknownPropertyObjects: new Set(),
      preservedHelperAliases: new Set(),
      invalidatedHelperAliases: new Set()
    };
    for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex += 1) {
      const body = bodies[bodyIndex];
      for (const name of this.controlFlowReassignments(body, preBodyBindings)) reassignments.add(name);
      const bodyBindings = loopStatement ? this.loopBodyBindings(preBodyBindings, loopStatement) : new Map(preBodyBindings);
      this.controlFlowMutationStates.push(mutationState);
      try {
        this.processStatements(body, bodyBindings, bodyContexts?.[bodyIndex] || context);
      } finally {
        this.controlFlowMutationStates.pop();
      }
    }
    for (const name of mutationState.preservedHelperAliases) {
      if (!mutationState.invalidatedHelperAliases.has(name)) reassignments.delete(name);
    }
    this.invalidateControlFlowBindings(reassignments, preBodyBindings, boundary);
    this.invalidateControlFlowProperties(mutationState, boundary);
  }

  private processStatement(statement: LuaNode, bindings: Map<string, Binding>, context: X4UiFunctionContext): void {
    const previousStatement = this.currentStatement;
    const previousStandaloneCallStatementRoot = this.currentStandaloneCallStatementRoot;
    this.currentStatement = statement;
    this.currentStandaloneCallStatementRoot = statement.type === 'CallStatement'
      ? nodeField<LuaNode>(statement, 'expression')
      : undefined;
    try {
      switch (statement.type) {
      case 'LocalStatement': {
        const variables = nodeArray(statement, 'variables');
        const initializers = nodeArray(statement, 'init');
        const values = variables.map((_, index) => initializers[index] ? this.evaluate(initializers[index], context) : this.unknown(statement, 'unknown', 'local initializer is absent'));
        variables.forEach((variable, index) => {
          const name = nodeField<string>(variable, 'name');
          if (name) this.bindName(name, values[index], variable, context, 'definition');
        });
        break;
      }
      case 'AssignmentStatement': {
        const variables = nodeArray(statement, 'variables');
        const initializers = nodeArray(statement, 'init');
        const values = variables.map((_, index) => initializers[index] ? this.evaluate(initializers[index], context) : this.unknown(statement, 'unknown', 'assignment initializer is absent'));
        variables.forEach((variable, index) => this.assignTarget(variable, values[index], context, 'member-assignment'));
        break;
      }
      case 'FunctionDeclaration':
        this.processFunctionDeclaration(statement, bindings, context);
        break;
      case 'CallStatement':
        this.evaluate(nodeField<LuaNode>(statement, 'expression'), context, false);
        break;
      case 'ReturnStatement':
        nodeArray(statement, 'arguments').forEach(argument => this.evaluate(argument, context));
        break;
      case 'IfStatement': {
        const clauses = nodeArray(statement, 'clauses');
        const conditions = clauses.map(clause => {
          const condition = nodeField<LuaNode>(clause, 'condition');
          return condition ? this.evaluate(condition, context) : undefined;
        });
        const elseBody = nodeArray(statement, 'elseBody');
        const hasElseClause = clauses.some(clause => !nodeField<LuaNode>(clause, 'condition'));
        this.processControlFlowBodies(
          [
            ...clauses.map(clause => nodeArray(clause, 'body')),
            ...(!hasElseClause && elseBody.length > 0 ? [elseBody] : [])
          ],
          context,
          statement,
          undefined,
          this.ifBranchContexts(statement, context, conditions)
        );
        break;
      }
      case 'WhileStatement':
        this.evaluate(nodeField<LuaNode>(statement, 'condition'), context);
        this.processControlFlowBodies(
          [nodeArray(statement, 'body')],
          context,
          statement,
          undefined,
          [this.loopContext(context, statement, 'while')]
        );
        break;
      case 'RepeatStatement':
        this.evaluate(nodeField<LuaNode>(statement, 'condition'), context);
        this.processControlFlowBodies(
          [nodeArray(statement, 'body')],
          context,
          statement,
          undefined,
          [this.loopContext(context, statement, 'repeat')]
        );
        break;
      case 'ForNumericStatement':
        [
          nodeField<LuaNode>(statement, 'start'),
          nodeField<LuaNode>(statement, 'end'),
          nodeField<LuaNode>(statement, 'step')
        ].filter((value): value is LuaNode => Boolean(value)).forEach(value => this.evaluate(value, context));
        this.processControlFlowBodies(
          [nodeArray(statement, 'body')],
          context,
          statement,
          statement,
          [this.loopContext(context, statement, 'numeric-for')]
        );
        break;
      case 'ForGenericStatement':
        nodeArray(statement, 'iterators').forEach(value => this.evaluate(value, context));
        this.processControlFlowBodies(
          [nodeArray(statement, 'body')],
          context,
          statement,
          statement,
          [this.loopContext(context, statement, 'generic-for')]
        );
        break;
      case 'DoStatement':
        this.processControlFlowBodies([nodeArray(statement, 'body')], context, statement);
        break;
      default:
        this.processNestedCalls(statement, context);
        break;
      }
    } finally {
      this.currentStatement = previousStatement;
      this.currentStandaloneCallStatementRoot = previousStandaloneCallStatementRoot;
    }
  }

  private expressionPath(node: LuaNode | undefined): string | undefined {
    if (!node) return undefined;
    if (node.type === 'Identifier') return nodeField<string>(node, 'name');
    if (node.type === 'MemberExpression') {
      const base = this.expressionPath(nodeField<LuaNode>(node, 'base'));
      const property = luaNodeName(nodeField<LuaNode>(node, 'identifier'));
      return base && property ? `${base}.${property}` : undefined;
    }
    if (node.type === 'IndexExpression') {
      const base = this.expressionPath(nodeField<LuaNode>(node, 'base'));
      const index = nodeField<LuaNode>(node, 'index');
      const literal = staticString(index);
      const number = staticNumber(index);
      const suffix = literal !== undefined ? literal : number !== undefined ? String(number) : '?';
      return base ? `${base}[${suffix}]` : undefined;
    }
    return undefined;
  }

  private addPending(record: X4UiRelevantRecord, sortNode: LuaNode | undefined): void {
    this.pendingRecords.push({
      record,
      sourceOffset: this.sourceOffset(sortNode),
      tie: this.nextRecordTie++
    });
  }
}

/** Parse one Lua file into the reusable X4 UI call model. */
export function buildX4UiCallModel(input: X4UiLuaFileInput): X4UiCallModel {
  return new X4UiCallModelBuilder(input).build();
}

/** Semantic alias for callers that name the operation after parsing. */
export const parseX4UiCallModel = buildX4UiCallModel;

/** Semantic alias matching the existing static-analysis module's vocabulary. */
export const analyzeX4UiCallModel = buildX4UiCallModel;

/** Convenience form for callers scanning the UI Lua set one file at a time. */
export function buildX4UiCallModels(inputs: X4UiLuaFileInput[]): X4UiCallModel[] {
  return inputs.map(buildX4UiCallModel);
}
