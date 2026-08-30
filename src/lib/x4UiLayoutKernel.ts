/**
 * Pure, source-anchored geometry for the table portions of X4 9.00 UI.
 *
 * This module deliberately stops at geometry. It does not know about a DOM,
 * Canvas, text measurement, a renderer, a workspace, or a filesystem.
 */

const HELPER_SOURCE_PATH =
  "ui/addons/ego_detailmonitorhelper/helper.lua" as const;
const WIDGET_SOURCE_PATH = "ui/widget/lua/widget_fullscreen.lua" as const;

const HELPER_SHA256 =
  "D24A08B8DA9F2C972794B60ACB48AE36F38CB026C991249DAB9F1164272D4DF2" as const;
const WIDGET_SHA256 =
  "420AFBA33D925A7B55F2A82AB12773DF04826EF588317010D209B249DE7BAED1" as const;

const helperAnchors = Object.freeze({
  defaultWidgetScaling: Object.freeze([3104, 3104] as const),
  defaultTableReserveScrollBar: Object.freeze([3170, 3170] as const),
  defaultRowScalingAndBorderBelow: Object.freeze([3189, 3191] as const),
  editBoxMinHeight: Object.freeze([565, 565] as const),
  editBoxHotkeyDefaults: Object.freeze([3440, 3445] as const),
  initTableCell: Object.freeze([5432, 5470] as const),
  editBoxHotkeyAndHeight: Object.freeze([5953, 5981] as const),
  iconGetHeight: Object.freeze([5676, 5683] as const),
  buttonGetHeight: Object.freeze([5782, 5797] as const),
  roundAndScale: Object.freeze([806, 858] as const),
  addTableDefaults: Object.freeze([3888, 3928] as const),
  settersAndFinalization: Object.freeze([4713, 4850] as const),
  fullHeight: Object.freeze([4852, 4863] as const),
  firstAddRowAndFreeze: Object.freeze([4895, 4958] as const),
  rowHeight: Object.freeze([5249, 5264] as const),
  colspan: Object.freeze([5270, 5359] as const),
  cellHeight: Object.freeze([5390, 5402] as const),
});

const widgetAnchors = Object.freeze({
  convertColumnWidth: Object.freeze([5818, 5915] as const),
});

/** Exact source identity carried by every state and result in this module. */
export const X4_LAYOUT_PROVENANCE = Object.freeze({
  id: "x4-9.00-ui-layout-kernel" as const,
  version: "X4 9.00" as const,
  helperSourcePath: HELPER_SOURCE_PATH,
  helperSha256: HELPER_SHA256,
  helperLineAnchors: helperAnchors,
  widgetSourcePath: WIDGET_SOURCE_PATH,
  widgetSha256: WIDGET_SHA256,
  widgetLineAnchors: widgetAnchors,
});

export type X4LayoutProvenance = typeof X4_LAYOUT_PROVENANCE;

export const PROVENANCE_ID = X4_LAYOUT_PROVENANCE.id;
export const PROVENANCE_VERSION = X4_LAYOUT_PROVENANCE.version;
export const HELPER_SOURCE_SHA256 = X4_LAYOUT_PROVENANCE.helperSha256;
export const WIDGET_SOURCE_SHA256 = X4_LAYOUT_PROVENANCE.widgetSha256;
export const HELPER_LINE_ANCHORS = X4_LAYOUT_PROVENANCE.helperLineAnchors;
export const WIDGET_LINE_ANCHORS = X4_LAYOUT_PROVENANCE.widgetLineAnchors;

export type LayoutFailureStatus = "refused" | "unsupported";

export type LayoutFailureCode =
  | "invalid-input"
  | "invalid-number"
  | "invalid-domain"
  | "invalid-count"
  | "invalid-index"
  | "invalid-span"
  | "invalid-cell"
  | "finalized"
  | "columns-not-finalized"
  | "unsupported-dynamic-input"
  | "missing-min-text-height"
  | "reserve-scrollbar-no-variable-column"
  | "reserve-scrollbar-insufficient-space"
  | "widget-percent-overflow"
  | "widget-pixel-overflow"
  | "numeric-overflow";

export interface LayoutFailure {
  readonly status: LayoutFailureStatus;
  readonly code: LayoutFailureCode;
  readonly message: string;
  readonly provenance: X4LayoutProvenance;
}

export interface LayoutSuccess<T> {
  readonly status: "ok";
  readonly value: T;
  readonly provenance: X4LayoutProvenance;
}

export type LayoutResult<T> = LayoutSuccess<T> | LayoutFailure;

/** A state operation retains the exact prior state on refusal. */
export type StateResult<T> =
  | LayoutSuccess<T>
  | (LayoutFailure & {
      readonly state: T;
    });

export interface X4UiLayoutMetrics {
  readonly uiScale: number;
  readonly borderSize: number;
  readonly scrollbarWidth: number;
  readonly standardContainerOffset: number;
}

export type HelperCellType = "cell" | "text" | "boxtext" | "icon" | "button" | "editbox";

export type HelperCellSpecializationType =
  | "text"
  | "button"
  | "editbox"
  | "icon";

export interface HelperColumnState {
  readonly width: number;
  readonly percent: boolean;
  readonly min: boolean;
  readonly weight: number;
  readonly colspan: number;
  readonly bgcolspan: number;
  /** undefined is the Lua nil/unset state and is distinct from false. */
  readonly scaling: boolean | undefined;
}

export interface HelperTableProperties {
  readonly width: number;
  readonly x: number;
  readonly scaling: boolean;
  readonly reserveScrollBar: boolean;
}

export interface HelperRowGroupState {
  readonly level: number;
}

export interface HelperCellState {
  readonly type: HelperCellType;
  readonly colspan: number;
  readonly bgcolspan: number;
  readonly y: number;
  readonly height: number;
  readonly scaling: boolean;
  readonly affectRowHeight: boolean;
  /** Effective editbox hotkey property after table defaults and cell calls. */
  readonly hotkey: string;
  /** Effective editbox hotkey icon flag after table defaults and cell calls. */
  readonly displayIcon: boolean;
  /** Caller-supplied metric used for zero-height text/boxtext cells. */
  readonly minTextHeight: number | undefined;
}

export interface HelperRowState {
  readonly groupIndex: number | undefined;
  readonly fixed: boolean;
  readonly borderBelow: boolean;
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly scaling: boolean;
  readonly cells: readonly HelperCellState[];
}

export type HelperDiagnosticCode =
  | "reserve-scrollbar-no-variable-column"
  | "reserve-scrollbar-insufficient-space"
  | "colspan-clamped"
  | "colspan-hid-non-cell"
  | "background-colspan-clamped";

export interface HelperDiagnostic {
  readonly code: HelperDiagnosticCode;
  readonly message: string;
  readonly provenance: X4LayoutProvenance;
}

export interface HelperTableState {
  readonly provenance: X4LayoutProvenance;
  readonly frameWidth: number;
  readonly metrics: X4UiLayoutMetrics;
  readonly requestedWidth: number;
  readonly properties: HelperTableProperties;
  /** The only table defaults projected for this bounded editbox port. */
  readonly editBoxDefaults: HelperEditBoxDefaults;
  readonly columns: readonly HelperColumnState[];
  readonly rows: readonly HelperRowState[];
  readonly rowGroups: readonly HelperRowGroupState[];
  /** Matches createdWithScrollBar at descriptor creation time. */
  readonly createdWithScrollBar: boolean;
  /** columndata.final in helper.lua. */
  readonly final: boolean;
  readonly diagnostics: readonly HelperDiagnostic[];
}

/** Values merged by table:setDefaultCellProperties("editbox", ...). */
export interface HelperCellPropertiesInput {
  readonly height?: number;
  readonly scaling?: boolean;
}

/** Values merged by table:setDefaultComplexCellProperties("editbox", "hotkey", ...). */
export interface HelperComplexCellPropertiesInput {
  readonly hotkey?: string;
  readonly displayIcon?: boolean;
}

/** Effective editbox defaults; absent keys retain the cell/widget fallback. */
export interface HelperEditBoxDefaults {
  readonly height?: number;
  readonly scaling?: boolean;
  readonly hotkey?: string;
  readonly displayIcon?: boolean;
}

export interface HelperRowGroupInput {
  readonly level: number;
}

export interface HelperCellInput {
  readonly type?: HelperCellType;
  readonly colspan?: number;
  readonly bgcolspan?: number;
  readonly y?: number;
  readonly height?: number;
  readonly scaling?: boolean;
  readonly affectRowHeight?: boolean;
  readonly hotkey?: string;
  readonly displayIcon?: boolean;
  readonly minTextHeight?: number;
}

export interface HelperCellSpecializationInput {
  readonly type: HelperCellSpecializationType;
  readonly y?: number;
  readonly height?: number;
  readonly scaling?: boolean;
  readonly affectRowHeight?: boolean;
  readonly hotkey?: string;
  readonly displayIcon?: boolean;
  readonly minTextHeight?: number;
}

export interface HelperRowInput {
  /** Row-group indices follow Lua's one-based table indexing. */
  readonly groupIndex?: number;
  readonly fixed?: boolean;
  readonly borderBelow?: boolean;
  readonly paddingTop?: number;
  readonly paddingBottom?: number;
  readonly scaling?: boolean;
  readonly cells?: readonly (HelperCellInput | undefined)[];
}

export interface HelperTableInput {
  readonly numColumns: number;
  readonly frameWidth: number;
  readonly metrics: X4UiLayoutMetrics;
  readonly width?: number;
  readonly x?: number;
  readonly scaling?: boolean;
  readonly reserveScrollBar?: boolean;
  readonly createdWithScrollBar?: boolean;
  readonly rowGroups?: readonly HelperRowGroupInput[];
}

export interface WidgetColumnConversion {
  readonly provenance: X4LayoutProvenance;
  readonly widths: readonly number[];
  readonly tableWidth: number;
  readonly columnWidthsInPercent: boolean;
}

export interface DynamicInput {
  readonly kind: "dynamic";
  readonly description?: string;
}

const freezeArray = <T>(items: readonly T[]): readonly T[] =>
  Object.freeze([...items]);

const freezeObject = <T extends object>(value: T): Readonly<T> =>
  Object.freeze(value);

const success = <T>(value: T): LayoutSuccess<T> =>
  freezeObject({
    status: "ok" as const,
    value,
    provenance: X4_LAYOUT_PROVENANCE,
  });

const failure = (
  status: LayoutFailureStatus,
  code: LayoutFailureCode,
  message: string,
): LayoutFailure =>
  freezeObject({
    status,
    code,
    message,
    provenance: X4_LAYOUT_PROVENANCE,
  });

const stateFailure = <T>(
  state: T,
  status: LayoutFailureStatus,
  code: LayoutFailureCode,
  message: string,
): StateResult<T> =>
  freezeObject({
    ...failure(status, code, message),
    state,
  });

const isDynamicInput = (value: unknown): value is DynamicInput =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === "dynamic";

const numberFailure = (
  value: unknown,
  field: string,
  allowNegative: boolean,
): LayoutFailure | undefined => {
  if (isDynamicInput(value)) {
    return failure(
      "unsupported",
      "unsupported-dynamic-input",
      `${field} is dynamic and has no deterministic geometry`,
    );
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return failure(
      "refused",
      "invalid-number",
      `${field} must be a finite number`,
    );
  }
  if (!allowNegative && value < 0) {
    return failure(
      "refused",
      "invalid-domain",
      `${field} must be non-negative`,
    );
  }
  return undefined;
};

const nonNegativeFailure = (
  value: unknown,
  field: string,
): LayoutFailure | undefined => numberFailure(value, field, false);

const booleanFailure = (
  value: unknown,
  field: string,
  optional = false,
): LayoutFailure | undefined => {
  if (optional && value === undefined) {
    return undefined;
  }
  if (isDynamicInput(value)) {
    return failure(
      "unsupported",
      "unsupported-dynamic-input",
      `${field} is dynamic and has no deterministic geometry`,
    );
  }
  if (typeof value !== "boolean") {
    return failure(
      "refused",
      "invalid-domain",
      `${field} must be boolean`,
    );
  }
  return undefined;
};

const stringFailure = (
  value: unknown,
  field: string,
  optional = false,
): LayoutFailure | undefined => {
  if (optional && value === undefined) {
    return undefined;
  }
  if (isDynamicInput(value)) {
    return failure(
      "unsupported",
      "unsupported-dynamic-input",
      `${field} is dynamic and has no deterministic geometry`,
    );
  }
  if (typeof value !== "string") {
    return failure(
      "refused",
      "invalid-domain",
      `${field} must be string`,
    );
  }
  return undefined;
};

const safeIntegerFailure = (
  value: unknown,
  field: string,
  minimum: number,
): LayoutFailure | undefined => {
  const basic = numberFailure(value, field, true);
  if (basic) {
    return basic;
  }
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    return failure(
      "refused",
      "invalid-domain",
      `${field} must be a safe integer >= ${minimum}`,
    );
  }
  return undefined;
};

const finiteResultFailure = (field: string): LayoutFailure =>
  failure("refused", "numeric-overflow", `${field} became non-finite`);

const validateMetrics = (metrics: unknown): LayoutFailure | undefined => {
  if (isDynamicInput(metrics)) {
    return failure(
      "unsupported",
      "unsupported-dynamic-input",
      "metrics are dynamic and have no deterministic geometry",
    );
  }
  if (typeof metrics !== "object" || metrics === null) {
    return failure("refused", "invalid-input", "metrics must be an object");
  }
  const candidate = metrics as Partial<X4UiLayoutMetrics>;
  const uiScaleError = numberFailure(candidate.uiScale, "metrics.uiScale", false);
  if (uiScaleError || candidate.uiScale === 0) {
    return (
      uiScaleError ??
      failure("refused", "invalid-domain", "metrics.uiScale must be > 0")
    );
  }
  for (const [field, value] of [
    ["metrics.borderSize", candidate.borderSize],
    ["metrics.scrollbarWidth", candidate.scrollbarWidth],
    ["metrics.standardContainerOffset", candidate.standardContainerOffset],
  ] as const) {
    const error = nonNegativeFailure(value, field);
    if (error) {
      return error;
    }
  }
  return undefined;
};

const cloneMetrics = (metrics: X4UiLayoutMetrics): X4UiLayoutMetrics =>
  freezeObject({
    uiScale: metrics.uiScale,
    borderSize: metrics.borderSize,
    scrollbarWidth: metrics.scrollbarWidth,
    standardContainerOffset: metrics.standardContainerOffset,
  });

const helperRoundUnchecked = (value: number, digits = 0): number => {
  const multiplier = digits > 0 ? 10 ** digits : 1;
  return Math.floor(value * multiplier + 0.5) / multiplier;
};

const scaleXUnchecked = (
  value: number,
  uiScale: number,
  enabled: boolean,
): number => helperRoundUnchecked(enabled ? value * uiScale : value);

const scaleYUnchecked = scaleXUnchecked;

const makeColumn = (): HelperColumnState =>
  freezeObject({
    width: 0,
    percent: false,
    min: true,
    weight: 1,
    colspan: 1,
    bgcolspan: 1,
    scaling: undefined,
  });

const replaceTable = (
  state: HelperTableState,
  patch: Partial<
    Pick<
      HelperTableState,
      | "properties"
      | "editBoxDefaults"
      | "columns"
      | "rows"
      | "rowGroups"
      | "final"
      | "diagnostics"
    >
  >,
): HelperTableState =>
  freezeObject({
    provenance: state.provenance,
    frameWidth: state.frameWidth,
    metrics: state.metrics,
    requestedWidth: state.requestedWidth,
    properties: patch.properties ?? state.properties,
    editBoxDefaults: patch.editBoxDefaults ?? state.editBoxDefaults,
    columns: patch.columns ?? state.columns,
    rows: patch.rows ?? state.rows,
    rowGroups: patch.rowGroups ?? state.rowGroups,
    createdWithScrollBar: state.createdWithScrollBar,
    final: patch.final ?? state.final,
    diagnostics: patch.diagnostics ?? state.diagnostics,
  });

const replaceColumn = (
  state: HelperTableState,
  oneBasedColumn: number,
  patch: Partial<HelperColumnState>,
): HelperTableState => {
  const columns = [...state.columns];
  columns[oneBasedColumn - 1] = freezeObject({
    ...columns[oneBasedColumn - 1],
    ...patch,
  });
  return replaceTable(state, { columns: freezeArray(columns) });
};

const replaceRow = (
  state: HelperTableState,
  oneBasedRow: number,
  row: HelperRowState,
): HelperTableState => {
  const rows = [...state.rows];
  rows[oneBasedRow - 1] = row;
  return replaceTable(state, { rows: freezeArray(rows) });
};

const validateColumnIndex = (
  state: HelperTableState,
  column: unknown,
): LayoutFailure | undefined => {
  const basic = safeIntegerFailure(column, "column", 1);
  if (basic) {
    return basic;
  }
  if ((column as number) > state.columns.length) {
    return failure(
      "refused",
      "invalid-index",
      `column ${String(column)} is outside the table`,
    );
  }
  return undefined;
};

const validateRowIndex = (
  state: HelperTableState,
  row: unknown,
): LayoutFailure | undefined => {
  const basic = safeIntegerFailure(row, "row", 1);
  if (basic) {
    return basic;
  }
  if ((row as number) > state.rows.length) {
    return failure(
      "refused",
      "invalid-index",
      `row ${String(row)} is outside the table`,
    );
  }
  return undefined;
};

/**
 * Helper.round, helper.lua 806-817. The floor(+0.5) form intentionally does
 * not use JavaScript Math.round; it preserves X4's negative-value behavior.
 */
export function round(value: unknown, digits?: unknown): LayoutResult<number> {
  const valueError = numberFailure(value, "value", true);
  if (valueError) {
    return valueError;
  }
  if (digits !== undefined) {
    // helper.lua only tests `digits and digits > 0`; negative, zero, and
    // finite fractional digits therefore all use the source multiplier rule.
    const digitError = numberFailure(digits, "digits", true);
    if (digitError) {
      return digitError;
    }
  }
  const result = helperRoundUnchecked(value as number, (digits as number | undefined) ?? 0);
  return Number.isFinite(result) ? success(result) : finiteResultFailure("round");
}

/** Helper.scaleX, helper.lua 832-837. */
export function scaleX(
  value: unknown,
  uiScale: unknown,
  enabled?: unknown,
): LayoutResult<number> {
  const valueError = numberFailure(value, "x", true);
  if (valueError) {
    return valueError;
  }
  const scaleError = numberFailure(uiScale, "uiScale", false);
  if (scaleError) {
    return scaleError;
  }
  if ((uiScale as number) === 0) {
    return failure("refused", "invalid-domain", "uiScale must be > 0");
  }
  const enabledError = booleanFailure(enabled, "enabled", true);
  if (enabledError) {
    return enabledError;
  }
  const result = scaleXUnchecked(
    value as number,
    uiScale as number,
    enabled !== false,
  );
  return Number.isFinite(result) ? success(result) : finiteResultFailure("scaleX");
}

/** Helper.scaleY, helper.lua 839-844. */
export function scaleY(
  value: unknown,
  uiScale: unknown,
  enabled?: unknown,
): LayoutResult<number> {
  const valueError = numberFailure(value, "y", true);
  if (valueError) {
    return valueError;
  }
  const scaleError = numberFailure(uiScale, "uiScale", false);
  if (scaleError) {
    return scaleError;
  }
  if ((uiScale as number) === 0) {
    return failure("refused", "invalid-domain", "uiScale must be > 0");
  }
  const enabledError = booleanFailure(enabled, "enabled", true);
  if (enabledError) {
    return enabledError;
  }
  const result = scaleYUnchecked(
    value as number,
    uiScale as number,
    enabled !== false,
  );
  return Number.isFinite(result) ? success(result) : finiteResultFailure("scaleY");
}

/**
 * Helper.scaleFont, helper.lua 846-858. Both the Lua-shaped
 * (fontname, fontsize, uiScale, enabled) and the compact (fontsize, uiScale,
 * enabled) call forms are accepted; fontname is intentionally not measured.
 */
export function scaleFont(
  fontSize: number,
  uiScale: number,
  enabled?: boolean,
): LayoutResult<number>;
export function scaleFont(
  fontName: string,
  fontSize: number,
  uiScale: number,
  enabled?: boolean,
): LayoutResult<number>;
export function scaleFont(
  first: unknown,
  second: unknown,
  third?: unknown,
  fourth?: unknown,
): LayoutResult<number> {
  const luaShaped = typeof first === "string";
  const fontSize = luaShaped ? second : first;
  const uiScale = luaShaped ? third : second;
  const enabled = luaShaped ? fourth : third;
  const fontSizeError = numberFailure(fontSize, "fontSize", false);
  if (fontSizeError) {
    return fontSizeError;
  }
  const scaleError = numberFailure(uiScale, "uiScale", false);
  if (scaleError) {
    return scaleError;
  }
  if ((uiScale as number) === 0) {
    return failure("refused", "invalid-domain", "uiScale must be > 0");
  }
  const enabledError = booleanFailure(enabled, "enabled", true);
  if (enabledError) {
    return enabledError;
  }
  const result = enabled === false
    ? (fontSize as number)
    : Math.ceil((fontSize as number) * (uiScale as number));
  return Number.isFinite(result) ? success(result) : finiteResultFailure("scaleFont");
}

/** Create an immutable Helper table with helper.lua's column defaults. */
export function createHelperTable(input: HelperTableInput): LayoutResult<HelperTableState> {
  if (isDynamicInput(input)) {
    return failure(
      "unsupported",
      "unsupported-dynamic-input",
      "table input is dynamic and has no deterministic geometry",
    );
  }
  if (typeof input !== "object" || input === null) {
    return failure("refused", "invalid-input", "table input must be an object");
  }
  const countError = safeIntegerFailure(input.numColumns, "numColumns", 1);
  if (countError) {
    return countError;
  }
  const frameError = nonNegativeFailure(input.frameWidth, "frameWidth");
  if (frameError) {
    return frameError;
  }
  const metricsError = validateMetrics(input.metrics);
  if (metricsError) {
    return metricsError;
  }
  const width = input.width === undefined ? 0 : input.width;
  const widthError = nonNegativeFailure(width, "table width");
  if (widthError) {
    return widthError;
  }
  const x = input.x === undefined ? 0 : input.x;
  const xError = numberFailure(x, "table x", true);
  if (xError) {
    return xError;
  }
  // defaultWidgetProperties.widget.scaling=true at helper.lua 3104; addTable
  // inherits it unless the caller explicitly supplies false.
  const scaling = input.scaling === undefined ? true : input.scaling;
  const scalingError = booleanFailure(input.scaling, "table scaling", true);
  if (scalingError) {
    return scalingError;
  }
  // defaultWidgetProperties.table.reserveScrollBar=true at helper.lua 3170.
  const reserve = input.reserveScrollBar === undefined ? true : input.reserveScrollBar;
  const reserveError = booleanFailure(input.reserveScrollBar, "reserveScrollBar", true);
  if (reserveError) {
    return reserveError;
  }
  const createdWithScrollBar = input.createdWithScrollBar ?? false;
  const createdError = booleanFailure(
    input.createdWithScrollBar,
    "createdWithScrollBar",
    true,
  );
  if (createdError) {
    return createdError;
  }
  if (typeof input.rowGroups !== "undefined" && !Array.isArray(input.rowGroups)) {
    return failure("refused", "invalid-input", "rowGroups must be an array");
  }
  const rowGroupsInput = input.rowGroups ?? [];
  const rowGroups: HelperRowGroupState[] = [];
  for (let index = 0; index < rowGroupsInput.length; index += 1) {
    const group = rowGroupsInput[index];
    if (typeof group !== "object" || group === null) {
      return failure("refused", "invalid-input", `rowGroups[${index}] must be an object`);
    }
    const levelError = safeIntegerFailure(group.level, `rowGroups[${index}].level`, 0);
    if (levelError) {
      return levelError;
    }
    rowGroups.push(freezeObject({ level: group.level }));
  }
  const metrics = cloneMetrics(input.metrics);
  const columns = freezeArray(
    Array.from({ length: input.numColumns }, () => makeColumn()),
  );
  const properties = freezeObject({
    width,
    x,
    scaling,
    reserveScrollBar: reserve,
  });
  const state = freezeObject({
    provenance: X4_LAYOUT_PROVENANCE,
    frameWidth: input.frameWidth,
    metrics,
    requestedWidth: width,
    properties,
    editBoxDefaults: freezeObject({}),
    columns,
    rows: freezeArray([] as HelperRowState[]),
    rowGroups: freezeArray(rowGroups),
    createdWithScrollBar,
    final: false,
    diagnostics: freezeArray([] as HelperDiagnostic[]),
  });
  return success(state);
}

const editBoxDefaultPropertiesFailure = (
  value: unknown,
  allowedKeys: readonly string[],
): LayoutFailure | undefined => {
  if (isDynamicInput(value)) {
    return failure(
      "unsupported",
      "unsupported-dynamic-input",
      "editbox default properties are dynamic and have no deterministic geometry",
    );
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure(
      "refused",
      "invalid-input",
      "editbox default properties must be an object",
    );
  }
  if (Object.keys(value).some(key => !allowedKeys.includes(key))) {
    return failure(
      "refused",
      "invalid-input",
      `editbox default properties may only contain ${allowedKeys.join(", ")}`,
    );
  }
  return undefined;
};

/**
 * Port table:setDefaultCellProperties for the only bounded relevant shape.
 * The defaults live on the table and therefore do not mutate existing rows.
 */
export function setDefaultCellProperties(
  state: HelperTableState,
  cellType: unknown,
  properties: unknown,
): StateResult<HelperTableState> {
  const typeError = stringFailure(cellType, "default cell type");
  if (typeError) return stateFailure(state, typeError.status, typeError.code, typeError.message);
  if (cellType !== "editbox") {
    return stateFailure(state, "refused", "invalid-cell", "only editbox default cell properties are projected");
  }
  const propertiesError = editBoxDefaultPropertiesFailure(properties, ["height", "scaling"]);
  if (propertiesError) return stateFailure(state, propertiesError.status, propertiesError.code, propertiesError.message);
  const candidate = properties as Partial<HelperCellPropertiesInput>;
  const heightError = candidate.height === undefined
    ? undefined
    : nonNegativeFailure(candidate.height, "editbox default height");
  if (heightError) return stateFailure(state, heightError.status, heightError.code, heightError.message);
  const scalingError = booleanFailure(candidate.scaling, "editbox default scaling", true);
  if (scalingError) return stateFailure(state, scalingError.status, scalingError.code, scalingError.message);
  const defaults: HelperEditBoxDefaults = {
    ...state.editBoxDefaults,
    ...(candidate.height === undefined ? {} : { height: candidate.height }),
    ...(candidate.scaling === undefined ? {} : { scaling: candidate.scaling }),
  };
  return success(replaceTable(state, { editBoxDefaults: freezeObject(defaults) }));
}

/**
 * Port table:setDefaultComplexCellProperties for editbox.hotkey only.
 * Omitted fields retain their prior table default exactly as Lua apply does.
 */
export function setDefaultComplexCellProperties(
  state: HelperTableState,
  cellType: unknown,
  propertyName: unknown,
  properties: unknown,
): StateResult<HelperTableState> {
  const typeError = stringFailure(cellType, "default complex cell type");
  if (typeError) return stateFailure(state, typeError.status, typeError.code, typeError.message);
  const propertyError = stringFailure(propertyName, "default complex property name");
  if (propertyError) return stateFailure(state, propertyError.status, propertyError.code, propertyError.message);
  if (cellType !== "editbox" || propertyName !== "hotkey") {
    return stateFailure(state, "refused", "invalid-cell", "only editbox hotkey defaults are projected");
  }
  const propertiesError = editBoxDefaultPropertiesFailure(properties, ["hotkey", "displayIcon"]);
  if (propertiesError) return stateFailure(state, propertiesError.status, propertiesError.code, propertiesError.message);
  const candidate = properties as Partial<HelperComplexCellPropertiesInput>;
  const hotkeyError = stringFailure(candidate.hotkey, "editbox default hotkey", true);
  if (hotkeyError) return stateFailure(state, hotkeyError.status, hotkeyError.code, hotkeyError.message);
  const displayIconError = booleanFailure(candidate.displayIcon, "editbox default displayIcon", true);
  if (displayIconError) return stateFailure(state, displayIconError.status, displayIconError.code, displayIconError.message);
  const defaults: HelperEditBoxDefaults = {
    ...state.editBoxDefaults,
    ...(candidate.hotkey === undefined ? {} : { hotkey: candidate.hotkey }),
    ...(candidate.displayIcon === undefined ? {} : { displayIcon: candidate.displayIcon }),
  };
  return success(replaceTable(state, { editBoxDefaults: freezeObject(defaults) }));
}

const widthSetterFailure = (
  state: HelperTableState,
): StateResult<HelperTableState> =>
  stateFailure(
    state,
    "refused",
    "finalized",
    "table column widths are already final and cannot be changed",
  );

const updateWidthColumn = (
  state: HelperTableState,
  column: unknown,
  width: unknown,
  patch: Partial<HelperColumnState>,
): StateResult<HelperTableState> => {
  if (state.final) {
    return widthSetterFailure(state);
  }
  const indexError = validateColumnIndex(state, column);
  if (indexError) {
    return stateFailure(state, indexError.status, indexError.code, indexError.message);
  }
  const widthError = nonNegativeFailure(width, "column width");
  if (widthError) {
    return stateFailure(state, widthError.status, widthError.code, widthError.message);
  }
  return success(replaceColumn(state, column as number, {
    ...patch,
    width: width as number,
  }));
};

/** helper.lua setColWidth: pixel, non-minimum column. Column is one-based. */
export function setColWidth(
  state: HelperTableState,
  column: number,
  width: number,
  scaling?: boolean,
): StateResult<HelperTableState> {
  const scalingError = booleanFailure(scaling, "column scaling", true);
  if (state.final) {
    return widthSetterFailure(state);
  }
  if (scalingError) {
    return stateFailure(state, scalingError.status, scalingError.code, scalingError.message);
  }
  return updateWidthColumn(state, column, width, {
    percent: false,
    min: false,
    weight: 1,
    scaling,
  });
}

/** helper.lua setColWidthMin. Column and optional weight are one-based/finite. */
export function setColWidthMin(
  state: HelperTableState,
  column: number,
  width: number,
  weight?: number,
  scaling?: boolean,
): StateResult<HelperTableState> {
  const scalingError = booleanFailure(scaling, "column scaling", true);
  if (state.final) {
    return widthSetterFailure(state);
  }
  if (scalingError) {
    return stateFailure(state, scalingError.status, scalingError.code, scalingError.message);
  }
  const actualWeight = weight === undefined ? 1 : weight;
  const weightError = nonNegativeFailure(actualWeight, "column weight");
  if (weightError) {
    return stateFailure(state, weightError.status, weightError.code, weightError.message);
  }
  return updateWidthColumn(state, column, width, {
    percent: false,
    min: true,
    weight: actualWeight,
    scaling,
  });
}

/** helper.lua setColWidthPercent. */
export function setColWidthPercent(
  state: HelperTableState,
  column: number,
  width: number,
): StateResult<HelperTableState> {
  if (state.final) {
    return widthSetterFailure(state);
  }
  return updateWidthColumn(state, column, width, {
    percent: true,
    min: false,
    weight: 1,
    scaling: undefined,
  });
}

/** helper.lua setColWidthMinPercent. */
export function setColWidthMinPercent(
  state: HelperTableState,
  column: number,
  width: number,
  weight?: number,
): StateResult<HelperTableState> {
  if (state.final) {
    return widthSetterFailure(state);
  }
  const actualWeight = weight === undefined ? 1 : weight;
  const weightError = nonNegativeFailure(actualWeight, "column weight");
  if (weightError) {
    return stateFailure(state, weightError.status, weightError.code, weightError.message);
  }
  return updateWidthColumn(state, column, width, {
    percent: true,
    min: true,
    weight: actualWeight,
    scaling: undefined,
  });
}

/** Change default foreground colspan metadata without changing finalized widths. */
export function setDefaultColSpan(
  state: HelperTableState,
  column: number,
  colspan: number,
): StateResult<HelperTableState> {
  const indexError = validateColumnIndex(state, column);
  if (indexError) {
    return stateFailure(state, indexError.status, indexError.code, indexError.message);
  }
  const spanError = numberFailure(colspan, "default colspan", false);
  if (spanError || colspan < 1) {
    const error = spanError ?? failure("refused", "invalid-span", "default colspan must be >= 1");
    return stateFailure(state, error.status, error.code, error.message);
  }
  return success(replaceColumn(state, column, { colspan }));
}

/** Change default background colspan metadata without changing finalized widths. */
export function setDefaultBackgroundColSpan(
  state: HelperTableState,
  column: number,
  colspan: number,
): StateResult<HelperTableState> {
  const indexError = validateColumnIndex(state, column);
  if (indexError) {
    return stateFailure(state, indexError.status, indexError.code, indexError.message);
  }
  const spanError = numberFailure(colspan, "default background colspan", false);
  if (spanError || colspan < 1) {
    const error = spanError ?? failure(
      "refused",
      "invalid-span",
      "default background colspan must be >= 1",
    );
    return stateFailure(state, error.status, error.code, error.message);
  }
  return success(replaceColumn(state, column, { bgcolspan: colspan }));
}

const appendDiagnostic = (
  state: HelperTableState,
  code: HelperDiagnosticCode,
  message: string,
): HelperTableState =>
  replaceTable(state, {
    diagnostics: freezeArray([
      ...state.diagnostics,
      freezeObject({ code, message, provenance: X4_LAYOUT_PROVENANCE }),
    ]),
  });

/**
 * Port finalizeTableColumnWidths, helper.lua 4779-4850. The sequential ceil
 * allocation and used-width accounting are intentionally kept in source order.
 */
export function finalizeHelperTable(
  state: HelperTableState,
): StateResult<HelperTableState> {
  if (state.final) {
    return success(state);
  }
  const { metrics } = state;
  let usableWidth = Math.floor(state.properties.width);
  if (usableWidth === 0) {
    usableWidth = Math.floor(state.frameWidth) - Math.ceil(state.properties.x);
  }
  if (!Number.isFinite(usableWidth)) {
    return stateFailure(state, "refused", "numeric-overflow", "usable width became non-finite");
  }

  let totalBorderWidth = 0;
  for (let index = 1; index < state.columns.length; index += 1) {
    totalBorderWidth += metrics.borderSize;
  }
  if (!Number.isFinite(totalBorderWidth)) {
    return stateFailure(state, "refused", "numeric-overflow", "border width became non-finite");
  }
  usableWidth = Math.max(0, usableWidth - totalBorderWidth);

  let usedWidth = 0;
  let variableColumnWeight = 0;
  const columns: HelperColumnState[] = [];
  for (const column of state.columns) {
    let columnWidth = column.width;
    let percent = column.percent;
    if (percent) {
      columnWidth = (columnWidth * usableWidth) / 100;
      percent = false;
    } else if (
      column.scaling === true ||
      (state.properties.scaling && column.scaling === undefined)
    ) {
      columnWidth = scaleXUnchecked(columnWidth, metrics.uiScale, true);
    }
    if (!Number.isFinite(columnWidth)) {
      return stateFailure(state, "refused", "numeric-overflow", "column width became non-finite");
    }
    columnWidth = Math.floor(columnWidth);
    usedWidth += columnWidth;
    if (!Number.isFinite(usedWidth)) {
      return stateFailure(state, "refused", "numeric-overflow", "used width became non-finite");
    }
    let min = column.min;
    let weight = column.weight;
    if (min && weight > 0) {
      variableColumnWeight += weight;
    } else {
      min = false;
      weight = 0;
    }
    columns.push(freezeObject({
      ...column,
      width: columnWidth,
      percent,
      min,
      weight,
    }));
  }

  let properties = state.properties;
  let nextState = state;
  if (properties.reserveScrollBar) {
    if (variableColumnWeight === 0) {
      nextState = appendDiagnostic(
        nextState,
        "reserve-scrollbar-no-variable-column",
        "table column finalization with reserveScrollBar: No column with variable width defined, cannot reserve additional space",
      );
      properties = freezeObject({
        ...properties,
        reserveScrollBar: false,
      });
    } else if (usedWidth + metrics.scrollbarWidth > usableWidth) {
      nextState = appendDiagnostic(
        nextState,
        "reserve-scrollbar-insufficient-space",
        `table column finalization with reserveScrollBar: Cannot reserve enough space for scroll bar, width available=${usableWidth}, required=${usedWidth + metrics.scrollbarWidth}`,
      );
      properties = freezeObject({
        ...properties,
        reserveScrollBar: false,
      });
    } else {
      usedWidth += metrics.scrollbarWidth;
    }
  }

  // Source order matters: residual allocation follows scrollbar accounting and
  // consumes both the remaining used width and the remaining variable weight.
  if (usedWidth < usableWidth && variableColumnWeight > 0) {
    for (const column of columns) {
      if (column.min && column.weight > 0) {
        const addedWidth = Math.ceil(
          ((usableWidth - usedWidth) * column.weight) / variableColumnWeight,
        );
        const index = columns.indexOf(column);
        columns[index] = freezeObject({
          ...column,
          width: column.width + addedWidth,
        });
        usedWidth += addedWidth;
        variableColumnWeight -= column.weight;
        if (variableColumnWeight <= 0) {
          break;
        }
      }
    }
  }

  // helper.lua tests the original requested table width, not the finalized one.
  if (state.requestedWidth !== 0) {
    for (let index = 0; index < columns.length; index += 1) {
      if (columns[index].width === 0) {
        columns[index] = freezeObject({
          ...columns[index],
          width: 1,
        });
        usedWidth += 1;
      }
    }
  }
  const finalWidth = usedWidth + totalBorderWidth;
  if (!Number.isFinite(finalWidth)) {
    return stateFailure(state, "refused", "numeric-overflow", "final table width became non-finite");
  }
  properties = freezeObject({ ...properties, width: finalWidth });
  const finalized = replaceTable(nextState, {
    properties,
    columns: freezeArray(columns),
    final: true,
  });
  return success(finalized);
}

const validateRowInput = (
  state: HelperTableState,
  input: HelperRowInput | undefined,
): LayoutFailure | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (isDynamicInput(input)) {
    return failure("unsupported", "unsupported-dynamic-input", "row input is dynamic");
  }
  if (typeof input !== "object" || input === null) {
    return failure("refused", "invalid-input", "row input must be an object");
  }
  for (const [field, value] of [
    ["row paddingTop", input.paddingTop],
    ["row paddingBottom", input.paddingBottom],
  ] as const) {
    const error = value === undefined ? undefined : nonNegativeFailure(value, field);
    if (error) {
      return error;
    }
  }
  for (const [field, value] of [
    ["row fixed", input.fixed],
    ["row borderBelow", input.borderBelow],
    ["row scaling", input.scaling],
  ] as const) {
    const error = booleanFailure(value, field, true);
    if (error) {
      return error;
    }
  }
  if (input.groupIndex !== undefined) {
    const groupError = safeIntegerFailure(input.groupIndex, "row groupIndex", 1);
    if (groupError) {
      return groupError;
    }
    if (input.groupIndex > state.rowGroups.length) {
      return failure("refused", "invalid-index", "row groupIndex is outside the table");
    }
  }
  if (input.cells !== undefined && !Array.isArray(input.cells)) {
    return failure("refused", "invalid-input", "row cells must be an array");
  }
  if (input.cells && input.cells.length > state.columns.length) {
    return failure("refused", "invalid-count", "row cells exceed the table column count");
  }
  for (let index = 0; index < (input.cells?.length ?? 0); index += 1) {
    const cell = input.cells?.[index];
    if (cell === undefined) {
      continue;
    }
    if (isDynamicInput(cell)) {
      return failure("unsupported", "unsupported-dynamic-input", `cell ${index + 1} is dynamic`);
    }
    if (typeof cell !== "object" || cell === null) {
      return failure("refused", "invalid-cell", `cell ${index + 1} must be an object`);
    }
    if (cell.type !== undefined &&
      !["cell", "text", "boxtext", "icon", "button", "editbox"].includes(cell.type)) {
      return failure("unsupported", "invalid-cell", `cell ${index + 1} has an unsupported type`);
    }
    for (const [field, value] of [
      [`cell ${index + 1} y`, cell.y],
      [`cell ${index + 1} height`, cell.height],
      [`cell ${index + 1} minTextHeight`, cell.minTextHeight],
    ] as const) {
      const error = value === undefined
        ? undefined
        : nonNegativeFailure(value, field);
      if (error && field.endsWith(" y")) {
        const signedError = numberFailure(value, field, true);
        return signedError;
      }
      if (error) {
        return error;
      }
    }
    for (const [field, value] of [
      [`cell ${index + 1} scaling`, cell.scaling],
      [`cell ${index + 1} affectRowHeight`, cell.affectRowHeight],
      [`cell ${index + 1} displayIcon`, cell.displayIcon],
    ] as const) {
      const error = booleanFailure(value, field, true);
      if (error) {
        return error;
      }
    }
    const hotkeyError = stringFailure(cell.hotkey, `cell ${index + 1} hotkey`, true);
    if (hotkeyError) return hotkeyError;
    for (const [field, value] of [
      [`cell ${index + 1} colspan`, cell.colspan],
      [`cell ${index + 1} bgcolspan`, cell.bgcolspan],
    ] as const) {
      if (value !== undefined) {
        const error = numberFailure(value, field, false);
        if (error) {
          return error;
        }
        if (value < 1) {
          return failure("refused", "invalid-span", `${field} must be >= 1`);
        }
      }
    }
  }
  return undefined;
};

const applySpanToCells = (
  cells: readonly HelperCellState[],
  index: number,
  requestedSpan: number,
  background: boolean,
): { readonly cells: readonly HelperCellState[]; readonly diagnostics: readonly HelperDiagnostic[] } => {
  const nextCells = [...cells];
  const diagnostics: HelperDiagnostic[] = [];
  const current = background ? nextCells[index].bgcolspan : nextCells[index].colspan;
  const bounded = Math.min(Math.floor(requestedSpan), nextCells.length - index);
  let previousSpan = current;
  if (requestedSpan > nextCells.length - index) {
    diagnostics.push(freezeObject({
      code: background ? "background-colspan-clamped" : "colspan-clamped",
      message: `${background ? "background colspan" : "colspan"} was clamped to the remaining columns`,
      provenance: X4_LAYOUT_PROVENANCE,
    }));
  }
  for (let offset = 1; offset < bounded; offset += 1) {
    const affectedIndex = index + offset;
    const affected = nextCells[affectedIndex];
    previousSpan += background ? affected.bgcolspan : affected.colspan;
    if (!background && affected.type !== "cell") {
      diagnostics.push(freezeObject({
        code: "colspan-hid-non-cell",
        message: `colspan hid non-cell at column ${affectedIndex + 1}`,
        provenance: X4_LAYOUT_PROVENANCE,
      }));
    }
    nextCells[affectedIndex] = freezeObject({
      ...affected,
      ...(background ? { bgcolspan: 0 } : { colspan: 0 }),
    });
  }
  for (let offset = bounded; offset < previousSpan; offset += 1) {
    const repairedIndex = index + offset;
    if (repairedIndex < nextCells.length) {
      const repaired = nextCells[repairedIndex];
      nextCells[repairedIndex] = freezeObject({
        ...repaired,
        ...(background ? { bgcolspan: 1 } : { colspan: 1 }),
      });
    }
  }
  if (background) {
    nextCells[index] = freezeObject({
      ...nextCells[index],
      bgcolspan: bounded,
    });
  } else {
    nextCells[index] = freezeObject({
      ...nextCells[index],
      colspan: bounded,
    });
  }
  return {
    cells: freezeArray(nextCells),
    diagnostics: freezeArray(diagnostics),
  };
};

const makeRowCells = (
  state: HelperTableState,
  input: HelperRowInput | undefined,
  rowScaling: boolean,
): { readonly cells: readonly HelperCellState[]; readonly diagnostics: readonly HelperDiagnostic[] } => {
  const supplied = input?.cells ?? [];
  const cells: HelperCellState[] = [];
  for (let index = 0; index < state.columns.length; index += 1) {
    const candidate = supplied[index];
    const type = candidate?.type ?? "cell";
    const cellScaling = candidate?.scaling ?? rowScaling;
    cells.push(freezeObject({
      type,
      colspan: 1,
      bgcolspan: 1,
      y: candidate?.y ?? 0,
      height: type === "editbox"
        ? candidate?.height ?? state.editBoxDefaults.height ?? 0
        : candidate?.height ?? 0,
      scaling: type === "editbox"
        ? state.editBoxDefaults.scaling ?? cellScaling
        : cellScaling,
      affectRowHeight: candidate?.affectRowHeight ?? true,
      hotkey: type === "editbox"
        ? candidate?.hotkey ?? state.editBoxDefaults.hotkey ?? ""
        : "",
      displayIcon: type === "editbox"
        ? candidate?.displayIcon ?? state.editBoxDefaults.displayIcon ?? false
        : false,
      minTextHeight: candidate?.minTextHeight,
    }));
  }
  let nextCells = freezeArray(cells);
  const diagnostics: HelperDiagnostic[] = [];
  // helper.lua applies defaults from right to left to repair overlapping spans.
  for (let column = state.columns.length - 1; column >= 0; column -= 1) {
    const defaults = state.columns[column];
    if (defaults.colspan > 1) {
      const applied = applySpanToCells(nextCells, column, defaults.colspan, false);
      nextCells = applied.cells;
      diagnostics.push(...applied.diagnostics);
    }
    if (defaults.bgcolspan > 1) {
      const applied = applySpanToCells(nextCells, column, defaults.bgcolspan, true);
      nextCells = applied.cells;
      diagnostics.push(...applied.diagnostics);
    }
  }
  // Explicit row input is applied in the same reverse order as helper defaults;
  // callers can also use setCellColSpan after addRow for one operation at a time.
  for (let column = state.columns.length - 1; column >= 0; column -= 1) {
    const candidate = supplied[column];
    if (candidate?.colspan !== undefined && candidate.colspan > 1) {
      const applied = applySpanToCells(nextCells, column, candidate.colspan, false);
      nextCells = applied.cells;
      diagnostics.push(...applied.diagnostics);
    }
    if (candidate?.bgcolspan !== undefined && candidate.bgcolspan > 1) {
      const applied = applySpanToCells(nextCells, column, candidate.bgcolspan, true);
      nextCells = applied.cells;
      diagnostics.push(...applied.diagnostics);
    }
  }
  return { cells: nextCells, diagnostics: freezeArray(diagnostics) };
};

/**
 * Port the first addRow freeze boundary, helper.lua 4895-4958.
 * Finalization occurs before the new row is appended and never repeats.
 */
export function addRow(
  state: HelperTableState,
  input?: HelperRowInput,
): StateResult<HelperTableState> {
  const inputError = validateRowInput(state, input);
  if (inputError) {
    return stateFailure(state, inputError.status, inputError.code, inputError.message);
  }
  let finalizedState = state;
  if (!state.final) {
    const finalized = finalizeHelperTable(state);
    if (finalized.status !== "ok") {
      return finalized;
    }
    finalizedState = finalized.value;
  }
  const rowScaling = input?.scaling ?? finalizedState.properties.scaling;
  const madeCells = makeRowCells(finalizedState, input, rowScaling);
  const row = freezeObject({
    groupIndex: input?.groupIndex,
    fixed: input?.fixed ?? false,
    // defaultWidgetProperties.row.borderBelow=true at helper.lua 3191.
    borderBelow: input?.borderBelow ?? true,
    paddingTop: input?.paddingTop ?? 0,
    paddingBottom: input?.paddingBottom ?? 0,
    scaling: rowScaling,
    cells: madeCells.cells,
  });
  return success(replaceTable(finalizedState, {
    rows: freezeArray([...finalizedState.rows, row]),
    diagnostics: freezeArray([...finalizedState.diagnostics, ...madeCells.diagnostics]),
  }));
}

const validateCellSpecializationInput = (
  input: HelperCellSpecializationInput,
): LayoutFailure | undefined => {
  if (isDynamicInput(input)) {
    return failure(
      "unsupported",
      "unsupported-dynamic-input",
      "cell specialization input is dynamic",
    );
  }
  if (typeof input !== "object" || input === null) {
    return failure(
      "refused",
      "invalid-input",
      "cell specialization input must be an object",
    );
  }
  if (isDynamicInput(input.type)) {
    return failure(
      "unsupported",
      "unsupported-dynamic-input",
      "cell specialization type is dynamic",
    );
  }
  if (!["text", "button", "editbox", "icon"].includes(input.type)) {
    return failure(
      "unsupported",
      "invalid-cell",
      "cell specialization type is unsupported",
    );
  }
  if (input.y !== undefined) {
    const yError = numberFailure(input.y, "cell specialization y", true);
    if (yError) {
      return yError;
    }
  }
  for (const [field, value] of [
    ["cell specialization height", input.height],
    ["cell specialization minTextHeight", input.minTextHeight],
  ] as const) {
    if (value !== undefined) {
      const error = nonNegativeFailure(value, field);
      if (error) {
        return error;
      }
    }
  }
  for (const [field, value] of [
    ["cell specialization scaling", input.scaling],
    ["cell specialization affectRowHeight", input.affectRowHeight],
    ["cell specialization displayIcon", input.displayIcon],
  ] as const) {
    const error = booleanFailure(value, field, true);
    if (error) {
      return error;
    }
  }
  const hotkeyError = stringFailure(input.hotkey, "cell specialization hotkey", true);
  if (hotkeyError) return hotkeyError;
  return undefined;
};

/** Port helper.lua initTableCell as an immutable same-cell specialization. */
export function specializeCell(
  state: HelperTableState,
  row: number,
  column: number,
  input: HelperCellSpecializationInput,
): StateResult<HelperTableState> {
  const rowError = validateRowIndex(state, row);
  if (rowError) {
    return stateFailure(state, rowError.status, rowError.code, rowError.message);
  }
  const columnError = validateColumnIndex(state, column);
  if (columnError) {
    return stateFailure(state, columnError.status, columnError.code, columnError.message);
  }
  const rowState = state.rows[row - 1];
  const cell = rowState.cells[column - 1];
  if (cell.colspan === 0) {
    return stateFailure(
      state,
      "refused",
      "invalid-cell",
      "cannot specialize a cell hidden by an existing colspan",
    );
  }
  if (cell.type !== "cell") {
    return stateFailure(
      state,
      "refused",
      "invalid-cell",
      "cannot overwrite an already-specialized cell",
    );
  }
  const inputError = validateCellSpecializationInput(input);
  if (inputError) {
    return stateFailure(
      state,
      inputError.status,
      inputError.code,
      inputError.message,
    );
  }
  const cells = [...rowState.cells];
  const height = input.type === "editbox"
    ? input.height ?? state.editBoxDefaults.height ?? cell.height
    : input.height ?? cell.height;
  const scaling = input.type === "editbox"
    ? input.scaling ?? state.editBoxDefaults.scaling ?? cell.scaling
    : input.scaling ?? cell.scaling;
  const hotkey = input.type === "editbox"
    ? input.hotkey ?? state.editBoxDefaults.hotkey ?? ""
    : "";
  const displayIcon = input.type === "editbox"
    ? input.displayIcon ?? state.editBoxDefaults.displayIcon ?? false
    : false;
  cells[column - 1] = freezeObject({
    ...cell,
    type: input.type,
    y: input.y ?? cell.y,
    height,
    scaling,
    affectRowHeight: input.affectRowHeight ?? cell.affectRowHeight,
    hotkey,
    displayIcon,
    minTextHeight: input.minTextHeight ?? cell.minTextHeight,
  });
  const nextRow = freezeObject({
    ...rowState,
    cells: freezeArray(cells),
  });
  return success(replaceRow(state, row, nextRow));
}

const validateSpan = (
  span: unknown,
  field: string,
): LayoutFailure | undefined => {
  const error = numberFailure(span, field, false);
  if (error) {
    return error;
  }
  if ((span as number) < 1) {
    return failure("refused", "invalid-span", `${field} must be >= 1`);
  }
  return undefined;
};

const setCellSpan = (
  state: HelperTableState,
  row: unknown,
  column: unknown,
  span: unknown,
  background: boolean,
): StateResult<HelperTableState> => {
  const rowError = validateRowIndex(state, row);
  if (rowError) {
    return stateFailure(state, rowError.status, rowError.code, rowError.message);
  }
  const columnError = validateColumnIndex(state, column);
  if (columnError) {
    return stateFailure(state, columnError.status, columnError.code, columnError.message);
  }
  const spanError = validateSpan(span, background ? "background colspan" : "colspan");
  if (spanError) {
    return stateFailure(state, spanError.status, spanError.code, spanError.message);
  }
  const rowState = state.rows[(row as number) - 1];
  const cell = rowState.cells[(column as number) - 1];
  const current = background ? cell.bgcolspan : cell.colspan;
  if (current === 0) {
    return stateFailure(
      state,
      "refused",
      "invalid-span",
      "cannot set a colspan on a cell hidden by an existing colspan",
    );
  }
  const applied = applySpanToCells(
    rowState.cells,
    (column as number) - 1,
    span as number,
    background,
  );
  const nextRow = freezeObject({ ...rowState, cells: applied.cells });
  let nextState = replaceRow(state, row as number, nextRow);
  for (const diagnostic of applied.diagnostics) {
    nextState = replaceTable(nextState, {
      diagnostics: freezeArray([...nextState.diagnostics, diagnostic]),
    });
  }
  return success(nextState);
};

/** helper.lua cell:setColSpan. Row and column are one-based. */
export function setCellColSpan(
  state: HelperTableState,
  row: number,
  column: number,
  colspan: number,
): StateResult<HelperTableState> {
  return setCellSpan(state, row, column, colspan, false);
}

/** helper.lua cell:setBackgroundColSpan. Row and column are one-based. */
export function setCellBackgroundColSpan(
  state: HelperTableState,
  row: number,
  column: number,
  colspan: number,
): StateResult<HelperTableState> {
  return setCellSpan(state, row, column, colspan, true);
}

/**
 * Port editbox:setHotkey. helper.lua writes the first hotkey argument and then
 * applies hotkeyproperty, so a supplied properties.hotkey wins while omitted
 * properties.hotkey preserves the argument. displayIcon changes only when the
 * second argument supplies that property.
 */
export function setCellHotkey(
  state: HelperTableState,
  row: number,
  column: number,
  hotkey: unknown,
  properties?: unknown,
): StateResult<HelperTableState> {
  const rowError = validateRowIndex(state, row);
  if (rowError) return stateFailure(state, rowError.status, rowError.code, rowError.message);
  const columnError = validateColumnIndex(state, column);
  if (columnError) return stateFailure(state, columnError.status, columnError.code, columnError.message);
  const propertiesError = properties === undefined
    ? undefined
    : editBoxDefaultPropertiesFailure(properties, ["hotkey", "displayIcon"]);
  if (propertiesError) return stateFailure(state, propertiesError.status, propertiesError.code, propertiesError.message);
  const candidate = (properties ?? {}) as Partial<HelperComplexCellPropertiesInput>;
  const hotkeyPropertyError = stringFailure(candidate.hotkey, "editbox hotkey property", true);
  if (hotkeyPropertyError) return stateFailure(state, hotkeyPropertyError.status, hotkeyPropertyError.code, hotkeyPropertyError.message);
  const effectiveHotkey = candidate.hotkey === undefined ? hotkey : candidate.hotkey;
  const hotkeyError = stringFailure(effectiveHotkey, "editbox hotkey");
  if (hotkeyError) return stateFailure(state, hotkeyError.status, hotkeyError.code, hotkeyError.message);
  const displayIconError = booleanFailure(candidate.displayIcon, "editbox displayIcon", true);
  if (displayIconError) return stateFailure(state, displayIconError.status, displayIconError.code, displayIconError.message);
  const rowState = state.rows[row - 1];
  const cell = rowState.cells[column - 1];
  if (cell.type !== "editbox" || cell.colspan === 0) {
    return stateFailure(state, "refused", "invalid-cell", "setHotkey requires a visible editbox cell");
  }
  const cells = [...rowState.cells];
  cells[column - 1] = freezeObject({
    ...cell,
    hotkey: effectiveHotkey as string,
    ...(candidate.displayIcon === undefined ? {} : { displayIcon: candidate.displayIcon }),
  });
  const nextRow = freezeObject({ ...rowState, cells: freezeArray(cells) });
  return success(replaceRow(state, row, nextRow));
}

const cellHeightUnchecked = (
  state: HelperTableState,
  cell: HelperCellState,
): LayoutResult<number> => {
  // helper.lua icon:getHeight() 5676-5683 and button:getHeight() 5782-5797
  // call the cell super method but return 1 for non-raw row sizing when
  // affectRowHeight is false. row:getHeight() separately zeroes the offset.
  if (
    (cell.type === "icon" || cell.type === "button") &&
    cell.affectRowHeight === false
  ) {
    return success(1);
  }
  if (cell.height === 0) {
    if (cell.type === "text" || cell.type === "boxtext") {
      if (cell.minTextHeight === undefined) {
        return failure(
          "unsupported",
          "missing-min-text-height",
          "zero-height text/boxtext cell requires caller-supplied minTextHeight",
        );
      }
      return success(cell.minTextHeight);
    }
    if (cell.type === "cell") {
      return success(1);
    }
    return success(cell.type === "editbox" && cell.hotkey !== "" && cell.displayIcon
      ? 23
      : 0);
  }
  const height = scaleYUnchecked(cell.height, state.metrics.uiScale, cell.scaling);
  if (!Number.isFinite(height)) return finiteResultFailure("cell height");
  return success(cell.type === "editbox" && cell.hotkey !== "" && cell.displayIcon
    ? Math.max(height, 23)
    : height);
};

/** Port helper.lua cell:getHeight, including the explicit Zekton boundary. */
export function getCellHeight(
  state: HelperTableState,
  row: number,
  column: number,
): LayoutResult<number> {
  const rowError = validateRowIndex(state, row);
  if (rowError) {
    return rowError;
  }
  const columnError = validateColumnIndex(state, column);
  if (columnError) {
    return columnError;
  }
  return cellHeightUnchecked(state, state.rows[row - 1].cells[column - 1]);
}

/** Port helper.lua row:getHeight, helper.lua 5249-5264. */
export function getRowHeight(
  state: HelperTableState,
  row: number,
): LayoutResult<number> {
  const rowError = validateRowIndex(state, row);
  if (rowError) {
    return rowError;
  }
  const rowState = state.rows[row - 1];
  let height = 0;
  for (const cell of rowState.cells) {
    if (cell.colspan !== 0) {
      let cellOffsetY = scaleYUnchecked(cell.y, state.metrics.uiScale, cell.scaling);
      if (
        (cell.type === "icon" || cell.type === "button") &&
        cell.affectRowHeight === false
      ) {
        cellOffsetY = 0;
      }
      const cellHeight = cellHeightUnchecked(state, cell);
      if (cellHeight.status !== "ok") {
        return cellHeight;
      }
      height = Math.max(height, cellOffsetY + cellHeight.value);
    }
  }
  return Number.isFinite(height) ? success(height) : finiteResultFailure("row height");
}

/** Port helper.lua cell:getColSpanWidth, helper.lua 5323-5359. */
export function getColSpanWidth(
  state: HelperTableState,
  row: number,
  column: number,
): LayoutResult<number> {
  if (!state.final) {
    return failure(
      "unsupported",
      "columns-not-finalized",
      "colspan width requires the first-addRow column finalization boundary",
    );
  }
  const rowError = validateRowIndex(state, row);
  if (rowError) {
    return rowError;
  }
  const columnError = validateColumnIndex(state, column);
  if (columnError) {
    return columnError;
  }
  const rowState = state.rows[row - 1];
  const cell = rowState.cells[column - 1];
  if (cell.colspan < 1) {
    return success(0);
  }
  const group = rowState.groupIndex === undefined
    ? undefined
    : state.rowGroups[rowState.groupIndex - 1];
  let colspanWidth = state.columns[column - 1].width;
  if (group && (column === 1 || column === state.columns.length)) {
    colspanWidth -= group.level * state.metrics.standardContainerOffset;
  }
  for (let offset = 1; offset < cell.colspan; offset += 1) {
    const spannedColumn = column + offset;
    colspanWidth += state.columns[spannedColumn - 1].width + state.metrics.borderSize;
    if (group && spannedColumn === state.columns.length) {
      colspanWidth -= group.level * state.metrics.standardContainerOffset;
    }
  }
  if (
    state.createdWithScrollBar &&
    rowState.fixed &&
    state.properties.reserveScrollBar &&
    column + cell.colspan - 1 === state.columns.length
  ) {
    colspanWidth += state.metrics.scrollbarWidth;
  }
  return Number.isFinite(colspanWidth)
    ? success(colspanWidth)
    : finiteResultFailure("colspan width");
}

/** Port helper.lua table:getFullHeight, helper.lua 4852-4863. */
export function getFullTableHeight(
  state: HelperTableState,
): LayoutResult<number> {
  let fullHeight = 0;
  const rowCount = state.rows.length;
  for (let index = 0; index < rowCount; index += 1) {
    const rowHeight = getRowHeight(state, index + 1);
    if (rowHeight.status !== "ok") {
      return rowHeight;
    }
    fullHeight += rowHeight.value;
    if (index < rowCount - 1 && state.rows[index].borderBelow) {
      fullHeight += state.metrics.borderSize;
    }
    fullHeight += state.rows[index].paddingTop + state.rows[index].paddingBottom;
  }
  fullHeight +=
    state.rowGroups.length * 2 * state.metrics.standardContainerOffset;
  return Number.isFinite(fullHeight)
    ? success(fullHeight)
    : finiteResultFailure("full table height");
}

/**
 * Port widgetSystem.convertColumnWidth, widget_fullscreen.lua 5818-5915.
 * Percent and pixel conversion remain a separate immutable stage from Helper
 * finalization. A refusal contains no converted widths.
 */
export function convertColumnWidth(
  columnWidths: readonly number[],
  columnWidthsInPercent: boolean,
  tableWidth: number,
): LayoutResult<WidgetColumnConversion> {
  if (!Array.isArray(columnWidths) || columnWidths.length === 0) {
    return failure("refused", "invalid-count", "columnWidths must contain at least one column");
  }
  const modeError = booleanFailure(columnWidthsInPercent, "columnWidthsInPercent");
  if (modeError) {
    return modeError;
  }
  const tableWidthError = nonNegativeFailure(tableWidth, "tableWidth");
  if (tableWidthError) {
    return tableWidthError;
  }
  const widths = [...columnWidths];
  for (let index = 0; index < widths.length; index += 1) {
    const error = nonNegativeFailure(widths[index], `columnWidths[${index}]`);
    if (error) {
      return error;
    }
  }

  const unaccountedWidths: number[] = [];
  let sumAllColumns = 0;
  let extraPixel: number | undefined;
  let subtractedPixel = false;
  let columnWidth: number;
  for (let key = 0; key < widths.length; key += 1) {
    const value = widths[key];
    sumAllColumns += value;
    if (value === 0) {
      unaccountedWidths.push(key);
    } else if (columnWidthsInPercent) {
      columnWidth = (value / 100) * tableWidth;
      if (extraPixel !== undefined) {
        columnWidth -= 1;
        extraPixel = undefined;
        subtractedPixel = true;
      }
      if (!Number.isInteger(columnWidth)) {
        // Source ceil/subtract carry prevents accumulated subpixels.
        columnWidth = Math.ceil(columnWidth);
        if (subtractedPixel) {
          subtractedPixel = false;
        } else {
          extraPixel = key;
        }
      }
      widths[key] = columnWidth;
    }
  }
  if (extraPixel !== undefined) {
    widths[extraPixel] -= 1;
    extraPixel = undefined;
  }
  if (!Number.isFinite(sumAllColumns)) {
    return failure("refused", "numeric-overflow", "widget column sum became non-finite");
  }

  // The Lua function checks the raw explicit sum before filling auto columns.
  if (columnWidthsInPercent && sumAllColumns > 100) {
    return failure(
      "refused",
      "widget-percent-overflow",
      "explicit percentage column widths exceed 100",
    );
  }
  if (!columnWidthsInPercent && sumAllColumns > tableWidth) {
    return failure(
      "refused",
      "widget-pixel-overflow",
      "explicit pixel column widths exceed tableWidth",
    );
  }

  if (unaccountedWidths.length !== 0) {
    let widthPerColumn: number;
    let lastColumn: number;
    if (columnWidthsInPercent) {
      const widthLeft = 100 - sumAllColumns;
      widthPerColumn = Math.floor((widthLeft * 100) / unaccountedWidths.length) / 100;
      lastColumn = widthLeft - widthPerColumn * (unaccountedWidths.length - 1);
      // Source always ceils the last auto percentage after converting to px.
      lastColumn = Math.ceil((lastColumn / 100) * tableWidth);
    } else {
      const widthLeft = tableWidth - sumAllColumns;
      widthPerColumn = Math.floor(widthLeft / unaccountedWidths.length);
      lastColumn = widthLeft - widthPerColumn * (unaccountedWidths.length - 1);
    }
    const lastAuto = unaccountedWidths.pop() as number;
    widths[lastAuto] = lastColumn;

    let lastProcessedAuto: number | undefined;
    if (columnWidthsInPercent) {
      for (const value of unaccountedWidths) {
        columnWidth = (widthPerColumn / 100) * tableWidth;
        if (extraPixel !== undefined) {
          columnWidth -= 1;
          extraPixel = undefined;
          subtractedPixel = true;
        }
        if (!Number.isInteger(columnWidth)) {
          // Keep the carry state exactly as in 5890-5905: ceil this auto
          // column, then subtract one from the next eligible column.
          columnWidth = Math.ceil(columnWidth);
          if (subtractedPixel) {
            subtractedPixel = false;
          } else {
            extraPixel = value;
          }
        }
        widths[value] = columnWidth;
        lastProcessedAuto = value;
      }
      if (extraPixel !== undefined && lastProcessedAuto !== undefined) {
        // The shipped line indexes `value`, the last auto loop variable. This
        // is the observable final carry target and keeps the stage deterministic.
        widths[lastProcessedAuto] -= 1;
      }
    } else {
      // The shipped function assigns only the removed (last) auto column in
      // pixel mode; earlier zero autos remain zero because the 5887-5912
      // conversion-back loop is guarded by columnWidthsInPercent.
    }
  }
  if (widths.some((value) => !Number.isFinite(value))) {
    return failure("refused", "numeric-overflow", "widget column width became non-finite");
  }
  const conversion = freezeObject({
    provenance: X4_LAYOUT_PROVENANCE,
    widths: freezeArray(widths),
    tableWidth,
    columnWidthsInPercent,
  });
  return success(conversion);
}

export const helperRound = round;
export const helperScaleX = scaleX;
export const helperScaleY = scaleY;
export const helperScaleFont = scaleFont;
export const convertWidgetColumnWidth = convertColumnWidth;
export const convertWidgetSystemColumnWidth = convertColumnWidth;
export const finalizeTableColumnWidths = finalizeHelperTable;
export const getHelperColSpanWidth = getColSpanWidth;
export const getHelperFullTableHeight = getFullTableHeight;
export const getFullHeight = getFullTableHeight;
