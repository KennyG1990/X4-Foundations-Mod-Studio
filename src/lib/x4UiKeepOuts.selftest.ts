import {
  BUILT_IN_KEEP_OUTS,
  KEEP_OUT_IDS,
  KEEP_OUT_PRESETS,
  KEEP_OUT_PRESET_IDS,
  NOT_VERIFIED_IN_GAME,
  calibrateKeepOutPolygon,
  projectBuiltInKeepOut,
  projectKeepOut,
  type KeepOutCalibrationInput,
  type PixelDrawableBounds,
  type X4UiKeepOutEntry,
} from "./x4UiKeepOuts";

type TestCase = {
  readonly name: string;
  readonly run: () => void;
};

function check(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function checkEqual<T>(actual: T, expected: T, message: string): void {
  check(actual === expected, `${message}: ${String(actual)} !== ${String(expected)}`);
}

function checkDeepFrozen(value: unknown, label: string): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  check(Object.isFrozen(value), `${label} is not frozen`);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    checkDeepFrozen(record[key], `${label}.${key}`);
  }
}

function checkJsonEqual(left: unknown, right: unknown, message: string): void {
  checkEqual(JSON.stringify(left), JSON.stringify(right), message);
}

function expectProjected(
  result: ReturnType<typeof projectBuiltInKeepOut>,
  message: string,
): Extract<ReturnType<typeof projectBuiltInKeepOut>, { status: "projected" }> {
  checkEqual(result.status, "projected", message);
  return result as Extract<
    ReturnType<typeof projectBuiltInKeepOut>,
    { status: "projected" }
  >;
}

function validCalibrationInput(
  overrides: Partial<KeepOutCalibrationInput> = {},
): KeepOutCalibrationInput {
  return {
    stableId: overrides.stableId ?? "manual-calibration-1",
    context: overrides.context ?? KEEP_OUT_PRESET_IDS.cockpitConversation,
    sourceNote:
      overrides.sourceNote ??
      "Manually traced from the supplied screenshot evidence.",
    screenshotHash:
      overrides.screenshotHash ?? `sha256:${"a".repeat(64)}`,
    profile: overrides.profile ?? "x4-2560x1440-ui-scale-1",
    drawableBounds: overrides.drawableBounds ?? {
      left: 100,
      top: 50,
      width: 1000,
      height: 500,
    },
    points: overrides.points ?? [
      { x: 100, y: 50 },
      { x: 600, y: 50 },
      { x: 100, y: 300 },
    ],
  };
}

function expectCalibrationRefused(
  input: KeepOutCalibrationInput,
  reason: string,
): void {
  const result = calibrateKeepOutPolygon(input);
  checkEqual(result.status, "refused", `Expected calibration refusal for ${reason}`);
  if (result.status === "refused") {
    checkEqual(result.reason, reason, `Wrong calibration refusal for ${reason}`);
  }
}

type CausalMatrixReceipt = {
  readonly name: string;
  readonly expected: string;
  readonly pass: boolean;
  readonly observed: unknown;
};

/**
 * Batch 8C.1 tests-first seam matrix.  Keep this separate from the historical
 * Batch 3D checks so the pre-change receipt identifies causal red rows rather
 * than treating incidental old behavior as coverage.
 */
const BATCH_8C1_CAUSAL_MATRIX: readonly {
  readonly name: string;
  readonly expected: string;
  readonly run: () => unknown;
}[] = [
  {
    name: "calibration-issues-canonical-drawable-bounds",
    expected: "success with provenance.drawableBounds left/top/width/height",
    run: () => {
      const result = calibrateKeepOutPolygon(validCalibrationInput());
      checkEqual(result.status, "success", "calibration status");
      if (result.status !== "success") return result;
      checkJsonEqual(
        result.entry.provenance.drawableBounds,
        { left: 100, top: 50, width: 1000, height: 500 },
        "canonical drawable bounds",
      );
      return result;
    },
  },
  {
    name: "calibration-canonicalizes-x-y-origin-aliases",
    expected: "success with canonical left/top bounds",
    run: () => {
      const result = calibrateKeepOutPolygon(validCalibrationInput({
        drawableBounds: { x: 100, y: 50, width: 1000, height: 500 },
      }));
      checkEqual(result.status, "success", "alias calibration status");
      if (result.status !== "success") return result;
      checkJsonEqual(
        result.entry.provenance.drawableBounds,
        { left: 100, top: 50, width: 1000, height: 500 },
        "alias canonical drawable bounds",
      );
      return result;
    },
  },
  {
    name: "calibration-rejects-built-in-id-collision",
    expected: "refused with built-in-id-collision",
    run: () => {
      const result = calibrateKeepOutPolygon(validCalibrationInput({
        stableId: KEEP_OUT_IDS.conversationBackRow,
      }));
      checkEqual(result.status, "refused", "built-in collision status");
      if (result.status === "refused") checkEqual(result.reason, "built-in-id-collision", "built-in collision reason");
      return result;
    },
  },
  {
    name: "calibration-rejects-extra-input-key",
    expected: "refused without accepting extra key",
    run: () => {
      const input = { ...validCalibrationInput(), unexpected: true } as unknown as KeepOutCalibrationInput;
      const result = calibrateKeepOutPolygon(input);
      checkEqual(result.status, "refused", "extra input status");
      return result;
    },
  },
  {
    name: "calibration-rejects-accessor-without-getter-execution",
    expected: "refused and getterReads=0",
    run: () => {
      let getterReads = 0;
      const input = { ...validCalibrationInput() } as Record<string, unknown>;
      Object.defineProperty(input, "profile", {
        enumerable: true,
        configurable: true,
        get: () => {
          getterReads += 1;
          return "hostile-profile";
        },
      });
      const result = calibrateKeepOutPolygon(input as unknown as KeepOutCalibrationInput);
      checkEqual(result.status, "refused", "accessor input status");
      checkEqual(getterReads, 0, "accessor getter reads");
      return { result, getterReads };
    },
  },
  {
    name: "calibration-rejects-extra-point-key",
    expected: "refused without accepting decorated point",
    run: () => {
      const input = validCalibrationInput({
        points: [
          { x: 100, y: 50, unexpected: true },
          { x: 600, y: 50 },
          { x: 100, y: 300 },
        ] as unknown as KeepOutCalibrationInput["points"],
      });
      const result = calibrateKeepOutPolygon(input);
      checkEqual(result.status, "refused", "extra point status");
      return result;
    },
  },
];

function runBatch8C1CausalMatrix(): readonly CausalMatrixReceipt[] {
  const receipt = BATCH_8C1_CAUSAL_MATRIX.map(row => {
    try {
      return {
        name: row.name,
        expected: row.expected,
        pass: true,
        observed: row.run(),
      };
    } catch (error) {
      return {
        name: row.name,
        expected: row.expected,
        pass: false,
        observed: error instanceof Error ? error.message : String(error),
      };
    }
  });
  console.log(`BATCH_8C1_CAUSAL_MATRIX_FAIL_FIRST ${JSON.stringify({
    total: receipt.length,
    passed: receipt.filter(row => row.pass).length,
    red: receipt.filter(row => !row.pass),
  })}`);
  return receipt;
}

const causalMatrixReceipt = runBatch8C1CausalMatrix();

const tests: readonly TestCase[] = [
  {
    name: "exact measured guide facts and provenance",
    run: () => {
      const backRow = BUILT_IN_KEEP_OUTS[0];
      const optionStack = BUILT_IN_KEEP_OUTS[1];
      const information = BUILT_IN_KEEP_OUTS[2];
      checkEqual(backRow.id, KEEP_OUT_IDS.conversationBackRow, "Back-row id");
      checkEqual(backRow.kind, "horizontal-guide", "Back-row kind");
      if (backRow.kind === "horizontal-guide") {
        checkEqual(backRow.geometry.y, 0.788, "Back-row y");
        checkEqual(backRow.provenance.evidenceGrade, "measured-guide", "Back-row grade");
        checkEqual(backRow.provenance.source, "production-evidence", "Back-row source");
      }
      checkEqual(optionStack.id, KEEP_OUT_IDS.conversationOptionStackStart, "Stack id");
      if (optionStack.kind === "horizontal-guide") {
        checkEqual(optionStack.geometry.y, 0.74, "Stack y");
        checkEqual(optionStack.provenance.evidenceGrade, "measured-guide", "Stack grade");
      }
      checkEqual(information.id, KEEP_OUT_IDS.informationPanelLeftEdge, "Information id");
      if (information.kind === "vertical-guide") {
        checkEqual(information.geometry.x, 0.664, "Information x");
        checkEqual(information.provenance.evidenceGrade, "measured-guide", "Information grade");
      }
      check(
        information.notes.some((note) => note.includes("vertices remain unmeasured")),
        "Information note does not retain the unmeasured vertices state",
      );
    },
  },
  {
    name: "no invented built-in polygons and explicit unmeasured entries",
    run: () => {
      checkEqual(BUILT_IN_KEEP_OUTS.length, 5, "Built-in entry count");
      check(
        BUILT_IN_KEEP_OUTS.every((entry) => entry.kind !== "polygon"),
        "A built-in polygon was invented",
      );
      const ticker = BUILT_IN_KEEP_OUTS[3];
      const hud = BUILT_IN_KEEP_OUTS[4];
      checkEqual(ticker.id, KEEP_OUT_IDS.missionMessagesTicker, "Ticker id");
      checkEqual(hud.id, KEEP_OUT_IDS.topHudStrip, "HUD id");
      checkEqual(ticker.kind, "unmeasured", "Ticker state");
      checkEqual(hud.kind, "unmeasured", "HUD state");
      checkEqual(ticker.geometry, null, "Ticker geometry");
      checkEqual(hud.geometry, null, "HUD geometry");
      checkEqual(ticker.provenance.evidenceGrade, "reference-unmeasured", "Ticker grade");
      checkEqual(hud.provenance.evidenceGrade, "reference-unmeasured", "HUD grade");
    },
  },
  {
    name: "all four presets explicitly grade every built-in member",
    run: () => {
      checkEqual(KEEP_OUT_PRESETS.length, 4, "Preset count");
      const expectedIds = [
        KEEP_OUT_PRESET_IDS.cockpitConversation,
        KEEP_OUT_PRESET_IDS.mapOpen,
        KEEP_OUT_PRESET_IDS.fullscreenMenu,
        KEEP_OUT_PRESET_IDS.firstPerson,
      ];
      checkJsonEqual(
        KEEP_OUT_PRESETS.map((preset) => preset.id),
        expectedIds,
        "Preset ids",
      );
      for (const preset of KEEP_OUT_PRESETS) {
        checkEqual(preset.members.length, BUILT_IN_KEEP_OUTS.length, `${preset.id} member count`);
        check(
          preset.members.every(
            (member) =>
              typeof member.entryId === "string" &&
              typeof member.applicability === "string" &&
              typeof member.evidenceGrade === "string" &&
              typeof member.applicabilityEvidence === "string" &&
              member.note.length > 0,
          ),
          `${preset.id} has an implicit member state`,
        );
      }
      const cockpit = KEEP_OUT_PRESETS[0];
      checkEqual(cockpit.members[3].applicability, "unverified", "Cockpit ticker applicability");
      checkEqual(cockpit.members[3].applicabilityEvidence, "not-established", "Cockpit ticker evidence");
      check(
        cockpit.members[3].note.includes("geometry and cockpit-conversation context applicability are both unverified"),
        "Cockpit ticker evidence note overclaims applicability",
      );
      checkEqual(cockpit.members[4].applicability, "unverified", "Cockpit HUD applicability");
      checkEqual(cockpit.members[4].applicabilityEvidence, "not-established", "Cockpit HUD evidence");
      check(
        cockpit.members[4].note.includes("geometry and cockpit-conversation context applicability are both unverified"),
        "Cockpit HUD evidence note overclaims applicability",
      );
      const firstPerson = KEEP_OUT_PRESETS[3];
      checkEqual(firstPerson.members[3].applicability, "unverified", "First-person ticker applicability");
      checkEqual(firstPerson.members[3].applicabilityEvidence, "not-established", "First-person ticker evidence");
      checkEqual(firstPerson.members[4].applicability, "unverified", "First-person HUD applicability");
      checkEqual(firstPerson.members[4].applicabilityEvidence, "not-established", "First-person HUD evidence");
      check(
        KEEP_OUT_PRESETS[1].members.some((member) => member.applicability === "unverified"),
        "Map preset silently promoted uncertain membership",
      );
    },
  },
  {
    name: "2560x1440 projections retain exact fractional pixels",
    run: () => {
      const viewport = { width: 2560, height: 1440 };
      const backRow = expectProjected(
        projectBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow, viewport),
        "Back-row projection",
      );
      const optionStack = expectProjected(
        projectBuiltInKeepOut(KEEP_OUT_IDS.conversationOptionStackStart, viewport),
        "Stack projection",
      );
      const information = expectProjected(
        projectBuiltInKeepOut(KEEP_OUT_IDS.informationPanelLeftEdge, viewport),
        "Information projection",
      );
      checkEqual(backRow.geometry.kind, "horizontal-guide", "Back-row projected kind");
      if (backRow.geometry.kind === "horizontal-guide") {
        checkEqual(backRow.geometry.y, 1134.72, "Back-row projected y");
      }
      checkEqual(optionStack.geometry.kind, "horizontal-guide", "Stack projected kind");
      if (optionStack.geometry.kind === "horizontal-guide") {
        checkEqual(optionStack.geometry.y, 1065.6, "Stack projected y");
      }
      checkEqual(information.geometry.kind, "vertical-guide", "Information projected kind");
      if (information.geometry.kind === "vertical-guide") {
        // Keep the projection as direct multiplication: no implicit rounding
        // policy is allowed. The JS representation of mathematical 1699.84
        // is 1699.8400000000001 for this exact operation.
        checkEqual(information.geometry.x, 0.664 * 2560, "Information projected x");
        check(
          Math.abs(information.geometry.x - 1699.84) <= Number.EPSILON * 1024,
          "Information projected x is not the mathematical 1699.84 value",
        );
      }
    },
  },
  {
    name: "another viewport projects independently without rounding",
    run: () => {
      const viewport = { width: 1920, height: 1080 };
      const backRow = expectProjected(
        projectBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow, viewport),
        "Back-row alternate projection",
      );
      const optionStack = expectProjected(
        projectBuiltInKeepOut(KEEP_OUT_IDS.conversationOptionStackStart, viewport),
        "Stack alternate projection",
      );
      const information = expectProjected(
        projectBuiltInKeepOut(KEEP_OUT_IDS.informationPanelLeftEdge, viewport),
        "Information alternate projection",
      );
      if (backRow.geometry.kind === "horizontal-guide") {
        checkEqual(backRow.geometry.y, 0.788 * 1080, "Alternate Back-row y");
      }
      if (optionStack.geometry.kind === "horizontal-guide") {
        checkEqual(optionStack.geometry.y, 0.74 * 1080, "Alternate stack y");
      }
      if (information.geometry.kind === "vertical-guide") {
        checkEqual(information.geometry.x, 0.664 * 1920, "Alternate information x");
      }
    },
  },
  {
    name: "unmeasured projection is typed unavailable, never zero geometry",
    run: () => {
      const result = projectBuiltInKeepOut(
        KEEP_OUT_IDS.missionMessagesTicker,
        { width: 2560, height: 1440 },
      );
      checkEqual(result.status, "unavailable", "Ticker projection state");
      if (result.status === "unavailable") {
        checkEqual(result.geometry, null, "Ticker unavailable geometry");
        checkEqual(result.reason, "reference-unmeasured", "Ticker unavailable reason");
        checkEqual(result.advisoryOnly, true, "Ticker advisory state");
        checkEqual(result.gameVerification, NOT_VERIFIED_IN_GAME, "Ticker game state");
        checkDeepFrozen(result, "Ticker unavailable result");
      }
    },
  },
  {
    name: "projection rejects invalid viewports and unknown entries",
    run: () => {
      const entry = BUILT_IN_KEEP_OUTS[0];
      const invalidViewports = [
        { width: 0, height: 1440 },
        { width: -1, height: 1440 },
        { width: Number.NaN, height: 1440 },
        { width: 2560, height: Number.POSITIVE_INFINITY },
      ];
      for (const viewport of invalidViewports) {
        const result = projectKeepOut(entry, viewport);
        checkEqual(result.status, "refused", "Invalid viewport state");
        if (result.status === "refused") {
          checkEqual(result.reason, "invalid-viewport", "Invalid viewport reason");
        }
      }
      const unknown = projectBuiltInKeepOut("does-not-exist", {
        width: 2560,
        height: 1440,
      });
      checkEqual(unknown.status, "refused", "Unknown entry state");
      if (unknown.status === "refused") {
        checkEqual(unknown.reason, "unknown-entry", "Unknown entry reason");
        checkDeepFrozen(unknown, "Unknown entry refusal");
      }
      const malformed = projectKeepOut(
        { kind: "unmeasured", geometry: null } as unknown as X4UiKeepOutEntry,
        { width: 2560, height: 1440 },
      );
      checkEqual(malformed.status, "refused", "Malformed entry state");
      if (malformed.status === "refused") {
        checkEqual(malformed.reason, "invalid-entry", "Malformed entry reason");
        checkDeepFrozen(malformed, "Malformed entry refusal");
      }
    },
  },
  {
    name: "projection rejects duplicate and collinear calibrated polygons",
    run: () => {
      const calibration = calibrateKeepOutPolygon(validCalibrationInput());
      checkEqual(calibration.status, "success", "Calibration for malformed projection entries");
      if (calibration.status === "success") {
        const collinearPoints = [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ];
        const duplicatePoints = [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 0.5, y: 0.5 },
        ];
        const collinearEntry = {
          ...calibration.entry,
          geometry: {
            ...calibration.entry.geometry,
            points: collinearPoints,
          },
        } as X4UiKeepOutEntry;
        const duplicateEntry = {
          ...calibration.entry,
          geometry: {
            ...calibration.entry.geometry,
            points: duplicatePoints,
          },
        } as X4UiKeepOutEntry;
        const cases = [
          { entry: collinearEntry, points: collinearPoints, label: "collinear" },
          { entry: duplicateEntry, points: duplicatePoints, label: "duplicate" },
        ] as const;
        for (const testCase of cases) {
          const before = JSON.stringify(testCase.points);
          const result = projectKeepOut(testCase.entry, {
            width: 2560,
            height: 1440,
          });
          checkEqual(result.status, "refused", `${testCase.label} polygon state`);
          if (result.status === "refused") {
            checkEqual(result.reason, "invalid-entry", `${testCase.label} polygon reason`);
            checkEqual(result.geometry, null, `${testCase.label} polygon geometry`);
            checkDeepFrozen(result, `${testCase.label} polygon refusal`);
          }
          checkEqual(JSON.stringify(testCase.points), before, `${testCase.label} polygon mutation`);
        }

        const malformedProvenanceEntries = [
          {
            label: "empty source",
            entry: {
              ...calibration.entry,
              provenance: { ...calibration.entry.provenance, source: "" },
            },
          },
          {
            label: "unsupported source",
            entry: {
              ...calibration.entry,
              provenance: { ...calibration.entry.provenance, source: "not-supported" },
            },
          },
          {
            label: "empty source note",
            entry: {
              ...calibration.entry,
              provenance: { ...calibration.entry.provenance, sourceNote: "" },
            },
          },
          {
            label: "empty notes",
            entry: { ...calibration.entry, notes: [] },
          },
          {
            label: "malformed screenshot hash",
            entry: {
              ...calibration.entry,
              provenance: {
                ...calibration.entry.provenance,
                screenshot: {
                  hash: "not-a-hash",
                  profile: "x4-2560x1440-ui-scale-1",
                },
              },
            },
          },
          {
            label: "empty screenshot profile",
            entry: {
              ...calibration.entry,
              provenance: {
                ...calibration.entry.provenance,
                screenshot: {
                  hash: `sha256:${"a".repeat(64)}`,
                  profile: "",
                },
              },
            },
          },
        ] as const;
        for (const testCase of malformedProvenanceEntries) {
          const result = projectKeepOut(
            testCase.entry as X4UiKeepOutEntry,
            { width: 2560, height: 1440 },
          );
          checkEqual(result.status, "refused", `${testCase.label} provenance state`);
          if (result.status === "refused") {
            checkEqual(result.reason, "invalid-entry", `${testCase.label} provenance reason`);
            checkEqual(result.geometry, null, `${testCase.label} provenance geometry`);
          }
        }
      }
    },
  },
  {
    name: "manual calibration normalizes exact pixel coordinates",
    run: () => {
      const input = validCalibrationInput();
      const result = calibrateKeepOutPolygon(input);
      checkEqual(result.status, "success", "Calibration success state");
      if (result.status === "success") {
        checkEqual(result.entry.id, "manual-calibration-1", "Calibration id");
        checkEqual(result.entry.context, KEEP_OUT_PRESET_IDS.cockpitConversation, "Calibration context");
        checkEqual(result.entry.provenance.source, "manual-calibration", "Calibration source");
        checkEqual(result.entry.provenance.evidenceGrade, "calibrated", "Calibration grade");
        checkEqual(result.entry.provenance.screenshot?.hash, `sha256:${"a".repeat(64)}`, "Calibration hash");
        checkEqual(result.entry.provenance.screenshot?.profile, "x4-2560x1440-ui-scale-1", "Calibration profile");
        checkEqual(result.entry.geometry.points[0].x, 0, "Calibration point 0 x");
        checkEqual(result.entry.geometry.points[0].y, 0, "Calibration point 0 y");
        checkEqual(result.entry.geometry.points[1].x, 0.5, "Calibration point 1 x");
        checkEqual(result.entry.geometry.points[1].y, 0, "Calibration point 1 y");
        checkEqual(result.entry.geometry.points[2].x, 0, "Calibration point 2 x");
        checkEqual(result.entry.geometry.points[2].y, 0.5, "Calibration point 2 y");
        checkDeepFrozen(result, "Calibration result");
      }
    },
  },
  {
    name: "calibrated polygons project exact normalized points",
    run: () => {
      const calibration = calibrateKeepOutPolygon(validCalibrationInput());
      checkEqual(calibration.status, "success", "Calibration for projection");
      if (calibration.status === "success") {
        const projection = projectKeepOut(calibration.entry, {
          width: 2000,
          height: 1000,
        });
        checkEqual(projection.status, "projected", "Calibrated projection state");
        if (projection.status === "projected") {
          checkEqual(projection.geometry.kind, "polygon", "Calibrated projected kind");
          if (projection.geometry.kind === "polygon") {
            checkEqual(projection.geometry.points[0].x, 0, "Projected polygon point 0 x");
            checkEqual(projection.geometry.points[1].x, 1000, "Projected polygon point 1 x");
            checkEqual(projection.geometry.points[2].y, 500, "Projected polygon point 2 y");
          }
          checkEqual(projection.advisoryOnly, true, "Calibrated advisory state");
          checkEqual(projection.gameVerification, NOT_VERIFIED_IN_GAME, "Calibrated game state");
          checkDeepFrozen(projection, "Calibrated projection");
        }
      }
    },
  },
  {
    name: "calibration rejects invalid drawable bounds",
    run: () => {
      const cases: readonly PixelDrawableBounds[] = [
        { left: 0, top: 0, width: 0, height: 100 },
        { left: 0, top: 0, width: -1, height: 100 },
        { left: 0, top: 0, width: Number.NaN, height: 100 },
        { left: 0, top: 0, width: 100, height: Number.POSITIVE_INFINITY },
        { left: Number.NaN, top: 0, width: 100, height: 100 },
        { left: 0, top: Number.POSITIVE_INFINITY, width: 100, height: 100 },
      ];
      for (const drawableBounds of cases) {
        expectCalibrationRefused(
          validCalibrationInput({ drawableBounds }),
          "invalid-bounds",
        );
      }
    },
  },
  {
    name: "calibration rejects empty identity and provenance fields",
    run: () => {
      expectCalibrationRefused(validCalibrationInput({ stableId: "" }), "empty-stable-id");
      expectCalibrationRefused(validCalibrationInput({ context: "   " }), "empty-context");
      expectCalibrationRefused(validCalibrationInput({ sourceNote: "" }), "empty-source-note");
      expectCalibrationRefused(validCalibrationInput({ screenshotHash: "" }), "empty-screenshot-hash");
      expectCalibrationRefused(validCalibrationInput({ profile: "\t" }), "empty-profile");
      expectCalibrationRefused(
        validCalibrationInput({ screenshotHash: "sha256:not-a-hash" }),
        "malformed-screenshot-hash",
      );
    },
  },
  {
    name: "calibration rejects insufficient, duplicate, and collinear points",
    run: () => {
      expectCalibrationRefused(
        validCalibrationInput({ points: [{ x: 100, y: 50 }, { x: 600, y: 50 }] }),
        "too-few-points",
      );
      expectCalibrationRefused(
        validCalibrationInput({
          points: [
            { x: 100, y: 50 },
            { x: 600, y: 50 },
            { x: 600, y: 50 },
          ],
        }),
        "duplicate-points",
      );
      expectCalibrationRefused(
        validCalibrationInput({
          points: [
            { x: 100, y: 50 },
            { x: 600, y: 50 },
            { x: 1000, y: 50 },
          ],
        }),
        "collinear-points",
      );
    },
  },
  {
    name: "calibration rejects out-of-bounds and non-finite points",
    run: () => {
      expectCalibrationRefused(
        validCalibrationInput({
          points: [
            { x: 99, y: 50 },
            { x: 600, y: 50 },
            { x: 100, y: 300 },
          ],
        }),
        "out-of-bounds",
      );
      expectCalibrationRefused(
        validCalibrationInput({
          points: [
            { x: Number.NaN, y: 50 },
            { x: 600, y: 50 },
            { x: 100, y: 300 },
          ],
        }),
        "invalid-point",
      );
      expectCalibrationRefused(
        validCalibrationInput({
          points: [
            { x: Number.POSITIVE_INFINITY, y: 50 },
            { x: 600, y: 50 },
            { x: 100, y: 300 },
          ],
        }),
        "invalid-point",
      );
    },
  },
  {
    name: "calibration rejects closed-data attacks and hostile accessors",
    run: () => {
      const base = validCalibrationInput();
      const inherited = Object.assign(Object.create({ inherited: true }), base) as KeepOutCalibrationInput;
      expectCalibrationRefused(inherited, "malformed-input");

      const symbolInput = { ...base } as Record<PropertyKey, unknown>;
      symbolInput[Symbol("unexpected")] = true;
      expectCalibrationRefused(symbolInput as unknown as KeepOutCalibrationInput, "malformed-input");

      const nonEnumerableInput = { ...base } as Record<string, unknown>;
      Object.defineProperty(nonEnumerableInput, "profile", {
        value: base.profile,
        enumerable: false,
        configurable: true,
      });
      expectCalibrationRefused(nonEnumerableInput as unknown as KeepOutCalibrationInput, "malformed-input");

      const cyclicInput = { ...base } as Record<string, unknown>;
      cyclicInput.self = cyclicInput;
      expectCalibrationRefused(cyclicInput as unknown as KeepOutCalibrationInput, "malformed-input");

      expectCalibrationRefused(
        validCalibrationInput({ drawableBounds: { left: 100, x: 101, top: 50, width: 1000, height: 500 } }),
        "invalid-bounds",
      );

      const inheritedPoint = Object.create({ y: 50 }) as Record<string, unknown>;
      inheritedPoint.x = 100;
      expectCalibrationRefused(
        validCalibrationInput({
          points: [inheritedPoint, { x: 600, y: 50 }, { x: 100, y: 300 }] as unknown as KeepOutCalibrationInput["points"],
        }),
        "invalid-point",
      );

      let getterReads = 0;
      const accessorInput = { ...base } as Record<string, unknown>;
      Object.defineProperty(accessorInput, "sourceNote", {
        enumerable: true,
        configurable: true,
        get: () => {
          getterReads += 1;
          throw new Error("calibration accessor executed");
        },
      });
      expectCalibrationRefused(accessorInput as unknown as KeepOutCalibrationInput, "malformed-input");
      checkEqual(getterReads, 0, "Calibration accessor getter reads");

      let proxyGetterReads = 0;
      const hostileProxy = new Proxy(base, {
        get: () => {
          proxyGetterReads += 1;
          throw new Error("calibration proxy getter executed");
        },
        ownKeys: () => {
          throw new Error("calibration proxy ownKeys executed");
        },
      });
      const proxyResult = calibrateKeepOutPolygon(hostileProxy);
      checkEqual(proxyGetterReads, 0, "Hostile calibration proxy getter reads");
      checkEqual(proxyResult.status, "refused", "Hostile calibration proxy refusal");
    },
  },
  {
    name: "inputs and built-ins remain unchanged and results are deterministic",
    run: () => {
      const input = validCalibrationInput();
      const inputSnapshot = JSON.stringify(input);
      const builtinsSnapshot = JSON.stringify(BUILT_IN_KEEP_OUTS);
      const first = calibrateKeepOutPolygon(input);
      const second = calibrateKeepOutPolygon(input);
      checkJsonEqual(first, second, "Repeated calibration result");
      checkDeepFrozen(
        calibrateKeepOutPolygon(validCalibrationInput({ stableId: "" })),
        "Calibration refusal result",
      );
      checkEqual(JSON.stringify(input), inputSnapshot, "Calibration input mutation");
      checkEqual(JSON.stringify(BUILT_IN_KEEP_OUTS), builtinsSnapshot, "Built-in mutation");
      checkDeepFrozen(BUILT_IN_KEEP_OUTS, "Built-in catalog");
      checkDeepFrozen(KEEP_OUT_PRESETS, "Preset catalog");
      checkDeepFrozen(projectBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow, {
        width: 2560,
        height: 1440,
      }), "Guide projection result");
    },
  },
  {
    name: "projection does not mutate the caller viewport",
    run: () => {
      const viewport = { width: 2560, height: 1440 };
      const snapshot = JSON.stringify(viewport);
      projectBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow, viewport);
      checkEqual(JSON.stringify(viewport), snapshot, "Viewport mutation");
    },
  },
];

let passed = 0;
let failed = causalMatrixReceipt.filter(row => !row.pass).length;
for (const test of tests) {
  try {
    test.run();
    passed += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${test.name}: ${message}`);
  }
}

console.log(`Batch3D selftest: ${passed}/${tests.length} passed`);
if (failed > 0) {
  throw new Error(`${failed} Batch3D selftest(s) failed`);
}
