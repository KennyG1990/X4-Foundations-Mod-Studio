import {
  PROVENANCE_ID,
  X4_LAYOUT_PROVENANCE,
  addRow,
  convertColumnWidth,
  createHelperTable,
  finalizeHelperTable,
  getCellHeight,
  getColSpanWidth,
  getFullTableHeight,
  getRowHeight,
  round,
  scaleFont,
  scaleX,
  scaleY,
  setCellColSpan,
  setColWidth,
  setColWidthMin,
  setColWidthMinPercent,
  setColWidthPercent,
  setDefaultColSpan,
  specializeCell,
  type HelperTableState,
  type LayoutResult,
  type StateResult,
} from "./x4UiLayoutKernel";

const metrics = Object.freeze({
  uiScale: 1,
  borderSize: 1,
  scrollbarWidth: 10,
  standardContainerOffset: 4,
});

let total = 0;
let passed = 0;

const fail = (message: string): never => {
  throw new Error(message);
};

const expect = (condition: boolean, message: string): void => {
  if (!condition) {
    fail(message);
  }
};

const expectEqual = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) {
    fail(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
};

const expectDeepEqual = (actual: unknown, expected: unknown, message: string): void => {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    fail(`${message}: expected ${expectedJson}, got ${actualJson}`);
  }
};

const expectOk = <T>(result: LayoutResult<T> | StateResult<T>, message: string): T => {
  if (result.status === "ok") {
    return result.value;
  }
  fail(`${message}: ${result.status}/${result.code} ${result.message}`);
};

const expectRefusal = (
  result: LayoutResult<unknown> | StateResult<unknown>,
  code: string,
  message: string,
): void => {
  if (result.status === "ok") {
    fail(`${message}: expected refusal, got geometry`);
  } else {
    expectEqual(result.code, code, message);
    expect(result.provenance.id === PROVENANCE_ID, `${message}: refusal lost provenance`);
  }
};

const expectStateFailure = <T>(
  result: StateResult<T>,
  expectedState: T,
  status: "refused" | "unsupported",
  code: string,
  message: string,
): void => {
  if (result.status === "ok") {
    fail(`${message}: expected state failure, got success`);
  } else {
    expectEqual(result.status, status, `${message} status`);
    expectEqual(result.code, code, `${message} code`);
    expect(result.state === expectedState, `${message}: prior state identity changed`);
    expect(result.provenance.id === PROVENANCE_ID, `${message}: failure lost provenance`);
  }
};

const makeTable = (overrides: Partial<Parameters<typeof createHelperTable>[0]> = {}): HelperTableState =>
  expectOk(
    createHelperTable({
      numColumns: 3,
      frameWidth: 100,
      metrics,
      reserveScrollBar: false,
      ...overrides,
    }),
    "create table",
  );

const setPixel = (
  state: HelperTableState,
  column: number,
  width: number,
  scaling?: boolean,
): HelperTableState =>
  expectOk(setColWidth(state, column, width, scaling), `set pixel column ${column}`);

const widthsOf = (state: HelperTableState): readonly number[] =>
  state.columns.map((column) => column.width);

const test = (name: string, callback: () => void): void => {
  total += 1;
  try {
    callback();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${name}: ${message}`);
  }
};

test("provenance is exact and exported", () => {
  expectEqual(PROVENANCE_ID, "x4-9.00-ui-layout-kernel", "provenance id");
  expectEqual(X4_LAYOUT_PROVENANCE.version, "X4 9.00", "provenance version");
  expectEqual(
    X4_LAYOUT_PROVENANCE.helperSha256,
    "D24A08B8DA9F2C972794B60ACB48AE36F38CB026C991249DAB9F1164272D4DF2",
    "helper hash",
  );
  expectEqual(
    X4_LAYOUT_PROVENANCE.widgetSha256,
    "420AFBA33D925A7B55F2A82AB12773DF04826EF588317010D209B249DE7BAED1",
    "widget hash",
  );
  expectDeepEqual(X4_LAYOUT_PROVENANCE.helperLineAnchors.roundAndScale, [806, 858], "helper anchors");
  expectDeepEqual(
    X4_LAYOUT_PROVENANCE.helperLineAnchors.defaultWidgetScaling,
    [3104, 3104],
    "helper default anchors",
  );
  expectDeepEqual(
    X4_LAYOUT_PROVENANCE.helperLineAnchors.defaultTableReserveScrollBar,
    [3170, 3170],
    "helper table default anchor",
  );
  expectDeepEqual(
    X4_LAYOUT_PROVENANCE.helperLineAnchors.defaultRowScalingAndBorderBelow,
    [3189, 3191],
    "helper row default anchors",
  );
  expectDeepEqual(X4_LAYOUT_PROVENANCE.helperLineAnchors.iconGetHeight, [5676, 5683], "icon height anchors");
  expectDeepEqual(X4_LAYOUT_PROVENANCE.helperLineAnchors.buttonGetHeight, [5782, 5797], "button height anchors");
  expectDeepEqual(X4_LAYOUT_PROVENANCE.widgetLineAnchors.convertColumnWidth, [5818, 5915], "widget anchors");
});

test("round and scale preserve Helper semantics", () => {
  expectEqual(expectOk(round(1.25, 1), "positive round"), 1.3, "positive round");
  expectEqual(expectOk(round(-1.25, 1), "negative round"), -1.2, "negative round");
  expectEqual(expectOk(round(12.345, 2), "digit round"), 12.35, "digit round");
  expectEqual(expectOk(scaleX(1.25, 2), "scaleX enabled"), 3, "scaleX enabled");
  expectEqual(expectOk(scaleX(1.25, 2, false), "scaleX disabled"), 1, "scaleX disabled");
  expectEqual(expectOk(scaleY(-1.25, 2), "scaleY negative"), -2, "scaleY negative");
  expectEqual(expectOk(scaleFont(15.4, 1), "scaleFont enabled"), 16, "scaleFont enabled");
  expectEqual(expectOk(scaleFont(15.4, 2, false), "scaleFont disabled"), 15.4, "scaleFont disabled");
  expectEqual(expectOk(scaleFont("Zekton", 15.4, 1), "Lua-shaped scaleFont"), 16, "Lua-shaped scaleFont");
  expectEqual(expectOk(round(1.25, -1), "negative digits"), 1, "negative digits use multiplier 1");
  const fractionalDigits = 1.5;
  expectEqual(
    expectOk(round(1.25, fractionalDigits), "fractional digits"),
    Math.floor(1.25 * 10 ** fractionalDigits + 0.5) / 10 ** fractionalDigits,
    "fractional digits use Lua exponentiation",
  );
});

test("invalid numeric and dynamic values refuse without NaN", () => {
  expectRefusal(round(Number.NaN), "invalid-number", "NaN round");
  expectRefusal(scaleX(1, Number.POSITIVE_INFINITY), "invalid-number", "infinite scale");
  expectRefusal(round(1, Number.POSITIVE_INFINITY), "invalid-number", "infinite digits");
  expectRefusal(round(1, 1000), "numeric-overflow", "overflow digits");
  expectRefusal(scaleX(1, { kind: "dynamic" }), "unsupported-dynamic-input", "dynamic scale");
  expectRefusal(
    createHelperTable({ numColumns: 2, frameWidth: -1, metrics }),
    "invalid-domain",
    "negative frame width",
  );
  expectRefusal(
    createHelperTable({ numColumns: 2, frameWidth: 100, metrics: { ...metrics, uiScale: Number.NaN } }),
    "invalid-number",
    "NaN metric",
  );
});

test("Helper defaults are exact", () => {
  const state = makeTable();
  expectDeepEqual(
    state.columns.map((column) => ({
      width: column.width,
      percent: column.percent,
      min: column.min,
      weight: column.weight,
      colspan: column.colspan,
      bgcolspan: column.bgcolspan,
      scaling: column.scaling,
    })),
    [
      { width: 0, percent: false, min: true, weight: 1, colspan: 1, bgcolspan: 1, scaling: undefined },
      { width: 0, percent: false, min: true, weight: 1, colspan: 1, bgcolspan: 1, scaling: undefined },
      { width: 0, percent: false, min: true, weight: 1, colspan: 1, bgcolspan: 1, scaling: undefined },
    ],
    "column defaults",
  );
  expectEqual(state.properties.width, 0, "table width default");
  expectEqual(state.final, false, "table starts unfrozen");
});

test("source defaults retain scaling, scrollbar reservation, and row border", () => {
  const sourceDefault = expectOk(
    addRow(
      expectOk(
        createHelperTable({ numColumns: 3, frameWidth: 100, metrics, width: 100 }),
        "source-default table",
      ),
    ),
    "source-default row",
  );
  expect(sourceDefault.properties.scaling, "source table scaling default");
  expect(sourceDefault.properties.reserveScrollBar, "source scrollbar reservation default");
  expectDeepEqual(widthsOf(sourceDefault), [30, 29, 29], "source-default reserved widths");
  expect(sourceDefault.rows[0].scaling, "source row scaling default");
  expect(sourceDefault.rows[0].borderBelow, "source row border default");
});

test("Helper default width 100 border 1 yields [33,33,32] and final 100", () => {
  const state = expectOk(addRow(makeTable({ width: 100 })), "default first row");
  expectDeepEqual(widthsOf(state), [33, 33, 32], "default widths");
  expectEqual(state.properties.width, 100, "default final width");
  expect(state.final, "default columns frozen");
});

test("fixed 20 plus two defaults yields [20,39,39]", () => {
  const state = setPixel(makeTable({ width: 100 }), 1, 20);
  const finalized = expectOk(finalizeHelperTable(state), "fixed plus defaults");
  expectDeepEqual(widthsOf(finalized), [20, 39, 39], "fixed plus defaults widths");
  expectEqual(finalized.properties.width, 100, "fixed plus defaults final width");
});

test("25 percent plus two defaults yields [24,37,37]", () => {
  const state = expectOk(
    setColWidthPercent(makeTable({ width: 100 }), 1, 25),
    "set percent column",
  );
  const finalized = expectOk(finalizeHelperTable(state), "percent plus defaults");
  expectDeepEqual(widthsOf(finalized), [24, 37, 37], "percent plus defaults widths");
  expectEqual(finalized.properties.width, 100, "percent plus defaults final width");
});

test("fixed-only 20 plus 30 contracts to final width 51", () => {
  let fixedOnly = makeTable({ width: 100, numColumns: 2 });
  fixedOnly = setPixel(fixedOnly, 1, 20);
  fixedOnly = setPixel(fixedOnly, 2, 30);
  const contracted = expectOk(finalizeHelperTable(fixedOnly), "fixed-only exact contraction");
  expectDeepEqual(widthsOf(contracted), [20, 30], "fixed-only widths");
  expectEqual(contracted.properties.width, 51, "fixed-only final width");
});

test("scaling precedence keeps explicit false unscaled and true/table unset scaled", () => {
  const scaledMetrics = { ...metrics, uiScale: 1.5 };
  let state = makeTable({ width: 100, metrics: scaledMetrics, scaling: true });
  state = setPixel(state, 1, 10, false);
  state = setPixel(state, 2, 10, true);
  state = setPixel(state, 3, 10);
  const finalized = expectOk(finalizeHelperTable(state), "scaling precedence");
  expectDeepEqual(widthsOf(finalized), [10, 15, 15], "scaling precedence widths");
  expectEqual(finalized.properties.width, 42, "scaling precedence final width");
});

test("reserve scrollbar succeeds and consumes variable width before residual allocation", () => {
  const state = expectOk(
    addRow(makeTable({ width: 100, reserveScrollBar: true })),
    "reserve scrollbar success",
  );
  expect(state.properties.reserveScrollBar, "scrollbar reservation remains enabled");
  expectDeepEqual(widthsOf(state), [30, 29, 29], "scrollbar success widths");
  expectEqual(state.properties.width, 100, "scrollbar success final width");
});

test("reserve scrollbar records no-variable and insufficient-space rejection classes", () => {
  let noVariable = makeTable({ width: 100, reserveScrollBar: true });
  noVariable = setPixel(noVariable, 1, 20);
  noVariable = setPixel(noVariable, 2, 30);
  noVariable = setPixel(noVariable, 3, 40);
  const noVariableFinal = expectOk(finalizeHelperTable(noVariable), "no-variable reservation");
  expect(!noVariableFinal.properties.reserveScrollBar, "no-variable reservation disabled");
  expect(
    noVariableFinal.diagnostics.some((diagnostic) => diagnostic.code === "reserve-scrollbar-no-variable-column"),
    "no-variable diagnostic",
  );

  let insufficient = makeTable({ width: 100, reserveScrollBar: true });
  insufficient = setPixel(insufficient, 1, 95);
  const insufficientFinal = expectOk(finalizeHelperTable(insufficient), "insufficient reservation");
  expect(!insufficientFinal.properties.reserveScrollBar, "insufficient reservation disabled");
  expect(
    insufficientFinal.diagnostics.some((diagnostic) => diagnostic.code === "reserve-scrollbar-insufficient-space"),
    "insufficient diagnostic",
  );
});

test("defined-width zero-column repair and overfull tables do not grow by residual allocation", () => {
  let repair = makeTable({ width: 100 });
  repair = setPixel(repair, 1, 20);
  repair = setPixel(repair, 2, 30);
  repair = setPixel(repair, 3, 0);
  const repaired = expectOk(finalizeHelperTable(repair), "zero repair");
  expectDeepEqual(widthsOf(repaired), [20, 30, 1], "zero repair widths");
  expectEqual(repaired.properties.width, 53, "zero repair overrun includes borders");

  let overfull = makeTable({ width: 100 });
  overfull = setPixel(overfull, 1, 60);
  overfull = setPixel(overfull, 2, 60);
  overfull = setPixel(overfull, 3, 0);
  const overfullFinal = expectOk(finalizeHelperTable(overfull), "overfull no-growth");
  expectDeepEqual(widthsOf(overfullFinal), [60, 60, 1], "overfull widths");
  expectEqual(overfullFinal.properties.width, 123, "overfull only repairs zero column");
});

test("first addRow finalizes once and later width setters refuse unchanged state", () => {
  const before = makeTable({ width: 100 });
  const after = expectOk(addRow(before), "first addRow freeze");
  expect(after.final, "first row finalizes");
  const refused = setColWidth(after, 1, 99);
  expectRefusal(refused, "finalized", "setter after first row");
  if (refused.status === "ok") {
    fail("setter after first row unexpectedly succeeded");
  }
  if (refused.status !== "ok") {
    expect(refused.state === after, "refused setter preserves exact state object");
  }
  const second = expectOk(addRow(after), "second row append");
  expectDeepEqual(widthsOf(second), widthsOf(after), "second row does not re-finalize widths");
  expectEqual(second.rows.length, 2, "second row appended");
});

test("widget percent conversion preserves ceil/subtract carry and ceils last auto", () => {
  const original = [33, 33, 0];
  const converted = expectOk(convertColumnWidth(original, true, 12), "widget percent conversion");
  expectDeepEqual(converted.widths, [4, 3, 5], "widget percent ceil/subtract widths");
  expectDeepEqual(original, [33, 33, 0], "widget percent input unchanged");
  expect(converted.provenance.id === PROVENANCE_ID, "widget geometry provenance");
});

test("widget pixel auto receives exact residual", () => {
  const converted = expectOk(convertColumnWidth([40, 0, 0], false, 101), "widget pixel auto");
  expectDeepEqual(converted.widths, [40, 0, 31], "widget pixel residual");
});

test("widget explicit overflow refuses without geometry", () => {
  expectRefusal(
    convertColumnWidth([60, 41], true, 100),
    "widget-percent-overflow",
    "widget percent overflow",
  );
  expectRefusal(
    convertColumnWidth([60, 41], false, 100),
    "widget-pixel-overflow",
    "widget pixel overflow",
  );
});

test("colspan floors and clamps, includes borders, row-group deductions, and reserved scrollbar", () => {
  let state = makeTable({
    width: 100,
    createdWithScrollBar: true,
    reserveScrollBar: true,
    rowGroups: [{ level: 2 }],
  });
  state = expectOk(
    addRow(state, { groupIndex: 1, fixed: true }),
    "colspan row",
  );
  state = expectOk(setCellColSpan(state, 1, 1, 2.9), "floor colspan");
  const spanTwo = expectOk(getColSpanWidth(state, 1, 1), "span two width");
  expectEqual(spanTwo, 52, "span two width with first-group deduction");
  const hidden = expectOk(getColSpanWidth(state, 1, 2), "hidden span width");
  expectEqual(hidden, 0, "hidden cell span width");

  state = expectOk(setCellColSpan(state, 1, 1, 99), "clamp colspan");
  const fullSpan = expectOk(getColSpanWidth(state, 1, 1), "full span width");
  expectEqual(fullSpan, 84, "full span width with both deductions and scrollbar");
  expectEqual(
    state.diagnostics.filter((diagnostic) => diagnostic.code === "colspan-clamped").length,
    1,
    "explicit overspan has one clamp diagnostic",
  );
});

test("default-span clamp and non-cell diagnostics survive addRow", () => {
  let state = makeTable({ width: 100 });
  state = expectOk(setDefaultColSpan(state, 1, 99), "default span clamp setup");
  const withDiagnostics = expectOk(
    addRow(state, { cells: [undefined, { type: "icon" }] }),
    "default span diagnostics row",
  );
  expectEqual(
    withDiagnostics.diagnostics.filter((diagnostic) => diagnostic.code === "colspan-clamped").length,
    1,
    "default overspan has one clamp diagnostic",
  );
  expect(
    withDiagnostics.diagnostics.some((diagnostic) => diagnostic.code === "colspan-hid-non-cell"),
    "non-cell hide diagnostic survives",
  );
});

test("specializeCell replaces only the same cell and preserves omitted geometry", () => {
  let state = makeTable({ numColumns: 2, width: 100 });
  state = expectOk(
    addRow(state, {
      cells: [{ y: -2, height: 4, scaling: false, affectRowHeight: true, minTextHeight: 9 }],
    }),
    "same-cell first row",
  );
  state = expectOk(addRow(state), "same-cell second row");
  const before = state;
  const input = Object.freeze({ type: "text" as const });
  const specialized = expectOk(
    specializeCell(before, 1, 1, input),
    "same-cell specialization",
  );
  const beforeCell = before.rows[0].cells[0];
  const afterCell = specialized.rows[0].cells[0];

  expect(specialized !== before, "specialization returns a new table state");
  expect(specialized.rows !== before.rows, "specialization returns a new rows array");
  expect(specialized.rows[0] !== before.rows[0], "specialization replaces the owning row");
  expect(afterCell !== beforeCell, "specialization replaces the target cell");
  expect(specialized.rows[0].cells[1] === before.rows[0].cells[1], "unrelated cell identity retained");
  expect(specialized.rows[1] === before.rows[1], "unrelated row identity retained");
  expect(specialized.columns === before.columns, "column state identity retained");
  expect(specialized.properties === before.properties, "table properties identity retained");
  expect(specialized.rowGroups === before.rowGroups, "row-group state identity retained");
  expect(specialized.diagnostics === before.diagnostics, "diagnostic state identity retained");
  expectEqual(afterCell.type, "text", "same-cell type");
  expectEqual(afterCell.y, -2, "omitted y retained");
  expectEqual(afterCell.height, 4, "omitted height retained");
  expectEqual(afterCell.scaling, false, "omitted scaling retained");
  expectEqual(afterCell.affectRowHeight, true, "omitted affectRowHeight retained");
  expectEqual(afterCell.minTextHeight, 9, "omitted minTextHeight retained");
  expectEqual(afterCell.colspan, beforeCell.colspan, "foreground colspan retained");
  expectEqual(afterCell.bgcolspan, beforeCell.bgcolspan, "background colspan retained");
  expect(Object.isFrozen(specialized), "specialized table state frozen");
  expect(Object.isFrozen(specialized.rows), "specialized rows array frozen");
  expect(Object.isFrozen(specialized.rows[0]), "specialized row frozen");
  expect(Object.isFrozen(specialized.rows[0].cells), "specialized cells array frozen");
  expect(Object.isFrozen(afterCell), "specialized cell frozen");
  expectDeepEqual(input, { type: "text" }, "specialization input unchanged");
});

test("cell specialization preserves source order around colspan", () => {
  let spanFirst = expectOk(addRow(makeTable()), "span-first row");
  spanFirst = expectOk(setCellColSpan(spanFirst, 1, 1, 2), "span before specialization");
  expectStateFailure(
    specializeCell(spanFirst, 1, 2, { type: "text" }),
    spanFirst,
    "refused",
    "invalid-cell",
    "span-first hidden-cell specialization",
  );

  let specializeFirst = expectOk(addRow(makeTable()), "specialize-first row");
  specializeFirst = expectOk(
    specializeCell(specializeFirst, 1, 2, { type: "icon" }),
    "specialization before span",
  );
  const spanAfter = expectOk(
    setCellColSpan(specializeFirst, 1, 1, 2),
    "span after specialization",
  );
  expectEqual(spanAfter.rows[0].cells[1].type, "icon", "hidden specialized type retained");
  expectEqual(spanAfter.rows[0].cells[1].colspan, 0, "specialized neighbor hidden");
  expectEqual(
    spanAfter.diagnostics.filter((diagnostic) => diagnostic.code === "colspan-hid-non-cell").length,
    1,
    "span after specialization emits one non-cell diagnostic",
  );
  expectEqual(spanAfter.diagnostics.length, 1, "span after specialization emits no extra diagnostics");

  let owningSpan = expectOk(addRow(makeTable()), "owning-span row");
  owningSpan = expectOk(setCellColSpan(owningSpan, 1, 1, 2), "owning span before specialization");
  owningSpan = expectOk(
    specializeCell(owningSpan, 1, 1, { type: "button", height: 8 }),
    "owning cell specialization after span",
  );
  expectEqual(owningSpan.rows[0].cells[0].type, "button", "owning cell specialized");
  expectEqual(owningSpan.rows[0].cells[0].colspan, 2, "owning cell colspan retained");
  expectEqual(owningSpan.rows[0].cells[1].colspan, 0, "owning span neighbor remains hidden");
  expectEqual(owningSpan.diagnostics.length, 0, "owning-cell specialization adds no diagnostic");
});

test("specializeCell refusals retain the exact prior state", () => {
  const state = expectOk(addRow(makeTable({ numColumns: 2 })), "specialization refusal row");
  const alreadySpecialized = expectOk(
    specializeCell(state, 1, 1, { type: "editbox" }),
    "overwrite setup",
  );
  expectStateFailure(
    specializeCell(alreadySpecialized, 1, 1, { type: "text" }),
    alreadySpecialized,
    "refused",
    "invalid-cell",
    "already-specialized overwrite",
  );
  expectStateFailure(
    specializeCell(state, 0, 1, { type: "text" }),
    state,
    "refused",
    "invalid-domain",
    "invalid row index",
  );
  expectStateFailure(
    specializeCell(state, 1, 3, { type: "text" }),
    state,
    "refused",
    "invalid-index",
    "invalid column index",
  );
  expectStateFailure(
    specializeCell(state, 1, 1, { type: "boxtext" } as never),
    state,
    "unsupported",
    "invalid-cell",
    "unsupported specialization type",
  );
  expectStateFailure(
    specializeCell(state, 1, 1, null as never),
    state,
    "refused",
    "invalid-input",
    "malformed specialization input",
  );
  expectStateFailure(
    specializeCell(state, 1, 1, { kind: "dynamic" } as never),
    state,
    "unsupported",
    "unsupported-dynamic-input",
    "dynamic specialization input",
  );
  expectStateFailure(
    specializeCell(state, 1, 1, { type: { kind: "dynamic" } } as never),
    state,
    "unsupported",
    "unsupported-dynamic-input",
    "dynamic specialization type",
  );
  expectStateFailure(
    specializeCell(state, 1, 1, { type: "text", y: Number.NaN }),
    state,
    "refused",
    "invalid-number",
    "invalid specialization y",
  );
  expectStateFailure(
    specializeCell(state, 1, 1, { type: "text", height: -1 }),
    state,
    "refused",
    "invalid-domain",
    "invalid specialization height",
  );
  expectStateFailure(
    specializeCell(state, 1, 1, { type: "text", scaling: "yes" } as never),
    state,
    "refused",
    "invalid-domain",
    "invalid specialization scaling",
  );
  expectStateFailure(
    specializeCell(state, 1, 1, {
      type: "icon",
      affectRowHeight: { kind: "dynamic" },
    } as never),
    state,
    "unsupported",
    "unsupported-dynamic-input",
    "dynamic specialization affectRowHeight",
  );
  expectStateFailure(
    specializeCell(state, 1, 1, { type: "text", minTextHeight: -1 }),
    state,
    "refused",
    "invalid-domain",
    "invalid specialization minTextHeight",
  );
});

test("specialized cell types use existing geometry and row-height paths", () => {
  const scaledMetrics = { ...metrics, uiScale: 1.5 };
  let state = expectOk(
    addRow(makeTable({ numColumns: 4, metrics: scaledMetrics })),
    "specialized geometry row",
  );
  state = expectOk(
    specializeCell(state, 1, 1, { type: "text", y: 1, minTextHeight: 7 }),
    "text geometry specialization",
  );
  state = expectOk(
    specializeCell(state, 1, 2, {
      type: "button",
      y: 50,
      height: 20,
      scaling: true,
      affectRowHeight: false,
    }),
    "button geometry specialization",
  );
  state = expectOk(
    specializeCell(state, 1, 3, {
      type: "editbox",
      y: 2,
      height: 4,
      scaling: false,
      affectRowHeight: false,
    }),
    "editbox geometry specialization",
  );
  state = expectOk(
    specializeCell(state, 1, 4, {
      type: "icon",
      y: 50,
      height: 20,
      scaling: true,
      affectRowHeight: false,
    }),
    "icon geometry specialization",
  );
  expectEqual(expectOk(getCellHeight(state, 1, 1), "specialized text height"), 7, "text height path");
  expectEqual(expectOk(getCellHeight(state, 1, 2), "specialized button height"), 1, "button height path");
  expectEqual(expectOk(getCellHeight(state, 1, 3), "specialized editbox height"), 4, "editbox height path");
  expectEqual(expectOk(getCellHeight(state, 1, 4), "specialized icon height"), 1, "icon height path");
  expectEqual(expectOk(getRowHeight(state, 1), "specialized row height"), 9, "specialized row height path");

  let defaultButton = expectOk(
    addRow(makeTable({ numColumns: 1 })),
    "default button row",
  );
  defaultButton = expectOk(
    specializeCell(defaultButton, 1, 1, { type: "button" }),
    "default button specialization",
  );
  expectEqual(expectOk(getCellHeight(defaultButton, 1, 1), "default button height"), 0, "button height is not invented");
  expectEqual(expectOk(getRowHeight(defaultButton, 1), "default button row height"), 0, "button row height is not invented");
});

test("icon and button affectRowHeight=false use specialized height 1", () => {
  let icon = makeTable({ width: 100 });
  icon = expectOk(
    addRow(icon, {
      cells: [{ type: "icon", y: 900, height: 700, scaling: true, affectRowHeight: false }],
    }),
    "icon non-row-height cell",
  );
  expectEqual(expectOk(getCellHeight(icon, 1, 1), "icon cell height"), 1, "icon cell height is one");
  expectEqual(expectOk(getRowHeight(icon, 1), "icon row height"), 1, "icon row height is one");

  let button = makeTable({ width: 100 });
  button = expectOk(
    addRow(button, {
      cells: [{ type: "button", y: 900, height: 700, scaling: true, affectRowHeight: false }],
    }),
    "button non-row-height cell",
  );
  expectEqual(expectOk(getCellHeight(button, 1, 1), "button cell height"), 1, "button cell height is one");
  expectEqual(expectOk(getRowHeight(button, 1), "button row height"), 1, "button row height is one");
});

test("editbox uses base-cell explicit scaling and zero-height behavior", () => {
  const scaledMetrics = { ...metrics, uiScale: 1.5 };
  let state = makeTable({ numColumns: 1, metrics: scaledMetrics });
  state = expectOk(
    addRow(state, {
      cells: [{ type: "editbox", y: 2, height: 4, scaling: true }],
    }),
    "scaled editbox row",
  );
  state = expectOk(
    addRow(state, {
      cells: [{ type: "editbox", y: 2, height: 4, scaling: false }],
    }),
    "unscaled editbox row",
  );
  state = expectOk(
    addRow(state, {
      cells: [{ type: "editbox", y: 2, height: 0, scaling: true }],
    }),
    "zero-height editbox row",
  );

  expectEqual(expectOk(getCellHeight(state, 1, 1), "scaled editbox height"), 6, "scaled editbox height");
  expectEqual(expectOk(getRowHeight(state, 1), "scaled editbox row height"), 9, "scaled editbox row height");
  expectEqual(expectOk(getCellHeight(state, 2, 1), "unscaled editbox height"), 4, "unscaled editbox height");
  expectEqual(expectOk(getRowHeight(state, 2), "unscaled editbox row height"), 6, "unscaled editbox row height");
  expectEqual(expectOk(getCellHeight(state, 3, 1), "zero-height editbox height"), 0, "zero-height editbox remains zero");
  expectEqual(expectOk(getRowHeight(state, 3), "zero-height editbox row height"), 3, "zero-height editbox uses only its offset");

  expectRefusal(
    addRow(state, { cells: [{ type: "dropdown" } as never] }),
    "invalid-cell",
    "unsupported non-v1 cell type",
  );
});

test("row height uses offsets, affectRowHeight, explicit scaling, min text height, and uninitialized cell height", () => {
  let state = makeTable({ width: 100 });
  state = expectOk(
    addRow(state, {
      paddingTop: 2,
      paddingBottom: 3,
      borderBelow: true,
      cells: [
        { type: "text", minTextHeight: 12, scaling: false },
        { type: "icon", y: 10, height: 4, affectRowHeight: false },
        { type: "cell" },
      ],
    }),
    "row height first row",
  );
  state = expectOk(addRow(state), "row height second row");
  expectEqual(expectOk(getCellHeight(state, 1, 3), "uninitialized cell height"), 1, "uninitialized cell height");
  expectEqual(expectOk(getRowHeight(state, 1), "row height"), 12, "row height max");
  expectEqual(expectOk(getRowHeight(state, 2), "default row height"), 1, "default row height");
  expectEqual(expectOk(getFullTableHeight(state), "full table height"), 19, "full table height");

  let scaled = makeTable({ width: 100, metrics: { ...metrics, uiScale: 1.5 } });
  scaled = expectOk(
    addRow(scaled, { cells: [{ height: 4, y: 2, scaling: true }] }),
    "scaled row",
  );
  expectEqual(expectOk(getRowHeight(scaled, 1), "scaled row height"), 9, "scaled offset plus height");
});

test("zero text height without caller metric is unsupported", () => {
  let state = makeTable({ width: 100 });
  state = expectOk(addRow(state, { cells: [{ type: "text" }] }), "missing metric row");
  expectRefusal(getRowHeight(state, 1), "missing-min-text-height", "missing text metric");
  expectRefusal(getFullTableHeight(state), "missing-min-text-height", "full height missing text metric");
});

test("state and results are immutable and repeated evaluation is deterministic", () => {
  const input = [40, 0, 0];
  const first = convertColumnWidth(input, false, 101);
  const second = convertColumnWidth(input, false, 101);
  expectDeepEqual(first, second, "repeated widget result");
  expectDeepEqual(input, [40, 0, 0], "conversion input mutation");
  const state = makeTable({ width: 100 });
  expect(Object.isFrozen(state), "state frozen");
  expect(Object.isFrozen(state.columns), "columns frozen");
  expect(Object.isFrozen(state.columns[0]), "column frozen");
  const finalized = expectOk(finalizeHelperTable(state), "deterministic helper finalization");
  const finalizedAgain = expectOk(finalizeHelperTable(state), "repeat helper finalization");
  expectDeepEqual(finalized, finalizedAgain, "repeated helper result");
});

test("invalid state indices, spans, widget values, and dynamic rows refuse", () => {
  const state = makeTable({ width: 100 });
  expectRefusal(setColWidth(state, 0, 1), "invalid-domain", "zero column index");
  expectRefusal(setColWidthMin(state, 1, -1), "invalid-domain", "negative column width");
  expectRefusal(setColWidthMinPercent(state, 1, 1, -1), "invalid-domain", "negative column weight");
  expectRefusal(setDefaultColSpan(state, 1, 0), "invalid-span", "zero default span");
  expectRefusal(addRow(state, { cells: [{ kind: "dynamic" } as never] }), "unsupported-dynamic-input", "dynamic cell");
  expectRefusal(convertColumnWidth([1, -1], false, 100), "invalid-domain", "negative widget width");
  expectRefusal(convertColumnWidth([0], false, Number.NaN), "invalid-number", "NaN widget table width");
});

console.log(`x4UiLayoutKernel selftest: ${passed}/${total} passed`);
if (passed !== total) {
  process.exitCode = 1;
}
