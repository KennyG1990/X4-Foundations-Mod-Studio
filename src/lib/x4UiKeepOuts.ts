/**
 * Pure, evidence-graded keep-out data for the X4 UI editor.
 *
 * This module deliberately stops at normalized drawable geometry. It does not
 * capture screenshots, inspect pixels, draw UI, persist data, or make package,
 * deploy, or in-game decisions.
 */

export const KEEP_OUT_COORDINATE_SPACE = "normalized-drawable" as const;
export const NOT_VERIFIED_IN_GAME = "Not verified in game" as const;

export const KEEP_OUT_IDS = Object.freeze({
  conversationBackRow: "conversation-back-row",
  conversationOptionStackStart: "conversation-option-stack-start",
  informationPanelLeftEdge: "information-panel-left-edge",
  missionMessagesTicker: "mission-messages-ticker",
  topHudStrip: "top-hud-strip",
} as const);

export type BuiltInKeepOutId = (typeof KEEP_OUT_IDS)[keyof typeof KEEP_OUT_IDS];

export const KEEP_OUT_PRESET_IDS = Object.freeze({
  cockpitConversation: "cockpit-conversation",
  mapOpen: "map-open",
  fullscreenMenu: "fullscreen-menu",
  firstPerson: "first-person",
} as const);

export type KeepOutContextPresetId =
  (typeof KEEP_OUT_PRESET_IDS)[keyof typeof KEEP_OUT_PRESET_IDS];

export type EvidenceGrade =
  | "measured-guide"
  | "calibrated"
  | "reference-unmeasured";

export type KeepOutSource = "production-evidence" | "manual-calibration";

export interface KeepOutScreenshotIdentity {
  readonly hash: string;
  readonly profile: string;
}

export interface KeepOutProvenance {
  readonly source: KeepOutSource;
  readonly evidenceGrade: EvidenceGrade;
  readonly sourceNote: string;
  readonly screenshot?: KeepOutScreenshotIdentity;
  readonly drawableBounds?: KeepOutDrawableBounds;
}

export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}

export interface HorizontalGuideGeometry {
  readonly kind: "horizontal-guide";
  readonly axis: "y";
  readonly y: number;
}

export interface VerticalGuideGeometry {
  readonly kind: "vertical-guide";
  readonly axis: "x";
  readonly x: number;
}

export interface PolygonGeometry {
  readonly kind: "polygon";
  readonly points: readonly NormalizedPoint[];
}

export type KeepOutGeometry =
  | HorizontalGuideGeometry
  | VerticalGuideGeometry
  | PolygonGeometry;

interface KeepOutEntryBase {
  readonly id: string;
  readonly label: string;
  readonly context: string;
  readonly coordinateSpace: typeof KEEP_OUT_COORDINATE_SPACE;
  readonly provenance: KeepOutProvenance;
  readonly notes: readonly string[];
}

export interface HorizontalGuideKeepOut extends KeepOutEntryBase {
  readonly kind: "horizontal-guide";
  readonly geometry: HorizontalGuideGeometry;
}

export interface VerticalGuideKeepOut extends KeepOutEntryBase {
  readonly kind: "vertical-guide";
  readonly geometry: VerticalGuideGeometry;
}

export interface PolygonKeepOut extends KeepOutEntryBase {
  readonly kind: "polygon";
  readonly geometry: PolygonGeometry;
}

export interface UnmeasuredKeepOut extends KeepOutEntryBase {
  readonly kind: "unmeasured";
  readonly geometry: null;
}

export type X4UiKeepOutEntry =
  | HorizontalGuideKeepOut
  | VerticalGuideKeepOut
  | PolygonKeepOut
  | UnmeasuredKeepOut;

/*
 * Paint receives the issued entry alongside its projection.  This private
 * identity ledger lets the downstream owner distinguish a session-issued
 * value from a caller-authored look-alike before it materializes closed data.
 */
const ISSUED_KEEP_OUT_ENTRIES = new WeakSet<object>();

export function isIssuedKeepOutEntry(value: unknown): value is X4UiKeepOutEntry {
  return value !== null && typeof value === "object" && ISSUED_KEEP_OUT_ENTRIES.has(value);
}

export type PresetApplicability =
  | "applicable"
  | "not-applicable"
  | "unverified";

export type PresetApplicabilityEvidence =
  | "context-evidenced"
  | "reference-unmeasured"
  | "not-established";

export interface KeepOutPresetMember {
  readonly entryId: BuiltInKeepOutId;
  readonly applicability: PresetApplicability;
  readonly evidenceGrade: EvidenceGrade;
  readonly applicabilityEvidence: PresetApplicabilityEvidence;
  readonly note: string;
}

export interface X4UiKeepOutPreset {
  readonly id: KeepOutContextPresetId;
  readonly label: string;
  readonly members: readonly KeepOutPresetMember[];
}

export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Exact drawable bounds. `left`/`top` are canonical; `x`/`y` are accepted as
 * equivalent aliases for callers that use viewport terminology. Omitting
 * both origins means the drawable starts at pixel (0, 0).
 */
export interface PixelDrawableBounds {
  readonly width: number;
  readonly height: number;
  readonly left?: number;
  readonly top?: number;
  readonly x?: number;
  readonly y?: number;
}

/** Canonical, immutable drawable bounds issued with manual calibration evidence. */
export interface KeepOutDrawableBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface DrawableViewport {
  readonly width: number;
  readonly height: number;
}

export interface ProjectedHorizontalGuide {
  readonly kind: "horizontal-guide";
  readonly y: number;
}

export interface ProjectedVerticalGuide {
  readonly kind: "vertical-guide";
  readonly x: number;
}

export interface ProjectedPolygon {
  readonly kind: "polygon";
  readonly points: readonly PixelPoint[];
}

export type ProjectedKeepOutGeometry =
  | ProjectedHorizontalGuide
  | ProjectedVerticalGuide
  | ProjectedPolygon;

interface ProjectionAdvisoryBase {
  readonly entryId: string;
  readonly evidenceGrade: EvidenceGrade;
  readonly advisoryOnly: true;
  readonly gameVerification: typeof NOT_VERIFIED_IN_GAME;
}

export interface KeepOutProjectionSuccess extends ProjectionAdvisoryBase {
  readonly status: "projected";
  readonly geometry: ProjectedKeepOutGeometry;
  readonly viewport: DrawableViewport;
}

export interface KeepOutProjectionUnavailable extends ProjectionAdvisoryBase {
  readonly status: "unavailable";
  readonly reason: "reference-unmeasured";
  readonly geometry: null;
}

export type ProjectionRefusalReason =
  | "invalid-viewport"
  | "invalid-entry"
  | "unknown-entry";

export interface KeepOutProjectionRefused extends ProjectionAdvisoryBase {
  readonly status: "refused";
  readonly reason: ProjectionRefusalReason;
  readonly message: string;
  readonly geometry: null;
}

export type KeepOutProjectionResult =
  | KeepOutProjectionSuccess
  | KeepOutProjectionUnavailable
  | KeepOutProjectionRefused;

const ISSUED_KEEP_OUT_PROJECTIONS = new WeakSet<object>();

export function isIssuedKeepOutProjection(value: unknown): value is KeepOutProjectionResult {
  return value !== null && typeof value === "object" && ISSUED_KEEP_OUT_PROJECTIONS.has(value);
}

export interface KeepOutCalibrationInput {
  readonly stableId: string;
  readonly context: string;
  readonly sourceNote: string;
  readonly screenshotHash: string;
  readonly profile: string;
  readonly drawableBounds: PixelDrawableBounds;
  readonly points: readonly PixelPoint[];
}

export type CalibrationRefusalReason =
  | "malformed-input"
  | "empty-stable-id"
  | "empty-context"
  | "empty-source-note"
  | "empty-screenshot-hash"
  | "malformed-screenshot-hash"
  | "empty-profile"
  | "invalid-bounds"
  | "invalid-points"
  | "too-few-points"
  | "invalid-point"
  | "out-of-bounds"
  | "duplicate-points"
  | "collinear-points"
  | "built-in-id-collision"
  | "duplicate-stable-id";

export interface KeepOutCalibrationSuccess {
  readonly status: "success";
  readonly entry: PolygonKeepOut;
}

export interface KeepOutCalibrationRefused {
  readonly status: "refused";
  readonly reason: CalibrationRefusalReason;
  readonly message: string;
}

export type KeepOutCalibrationResult =
  | KeepOutCalibrationSuccess
  | KeepOutCalibrationRefused;

type AnyRecord = Record<string, unknown>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    const record = value as unknown as AnyRecord;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key]);
    }
  }
  return value;
}

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === "object";
}

function ownDataField(
  value: object,
  key: string,
): { readonly present: boolean; readonly valid: boolean; readonly value?: unknown } {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { present: false, valid: true };
    if (!descriptor.enumerable || !("value" in descriptor)) {
      return { present: true, valid: false };
    }
    return { present: true, valid: true, value: descriptor.value };
  } catch {
    return { present: true, valid: false };
  }
}

function hasExactOwnDataFields(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is AnyRecord {
  if (!isRecord(value) || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string")) return false;
    const names = keys as readonly string[];
    const allowed = new Set([...required, ...optional]);
    if (!required.every(key => names.includes(key)) || !names.every(key => allowed.has(key))) {
      return false;
    }
    return names.every(key => ownDataField(value, key).valid);
  } catch {
    return false;
  }
}

function denseDataArray(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value)) return null;
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key)))) {
      return null;
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || lengthDescriptor.enumerable
      || typeof lengthDescriptor.value !== "number" || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
      return null;
    }
    const length = lengthDescriptor.value;
    const indexKeys = keys.filter(key => key !== "length") as readonly string[];
    if (indexKeys.length !== length) return null;
    const values: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      if (!indexKeys.includes(key)) return null;
      const field = ownDataField(value, key);
      if (!field.valid) return null;
      values.push(field.value);
    }
    return values;
  } catch {
    return null;
  }
}

function dataField(value: AnyRecord, key: string): unknown {
  return ownDataField(value, key).value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFinitePositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEvidenceGrade(value: unknown): value is EvidenceGrade {
  return (
    value === "measured-guide" ||
    value === "calibrated" ||
    value === "reference-unmeasured"
  );
}

function isKeepOutSource(value: unknown): value is KeepOutSource {
  return value === "production-evidence" || value === "manual-calibration";
}

const SCREENSHOT_HASH_PATTERN = /^(?:sha256:)?[0-9a-fA-F]{64}$/;

function isValidScreenshotIdentity(
  value: unknown,
): value is KeepOutScreenshotIdentity {
  return (
    hasExactOwnDataFields(value, ["hash", "profile"]) &&
    isNonEmptyString(dataField(value, "hash")) &&
    SCREENSHOT_HASH_PATTERN.test(dataField(value, "hash") as string) &&
    isNonEmptyString(dataField(value, "profile"))
  );
}

function isValidDrawableBounds(value: unknown): value is KeepOutDrawableBounds {
  return hasExactOwnDataFields(value, ["left", "top", "width", "height"])
    && isFiniteNumber(dataField(value, "left"))
    && isFiniteNumber(dataField(value, "top"))
    && isFinitePositiveNumber(dataField(value, "width"))
    && isFinitePositiveNumber(dataField(value, "height"))
    && isFiniteNumber((dataField(value, "left") as number) + (dataField(value, "width") as number))
    && isFiniteNumber((dataField(value, "top") as number) + (dataField(value, "height") as number));
}

function isNormalizedCoordinate(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isNormalizedPoint(value: unknown): value is NormalizedPoint {
  return (
    hasExactOwnDataFields(value, ["x", "y"]) &&
    isNormalizedCoordinate(dataField(value, "x")) &&
    isNormalizedCoordinate(dataField(value, "y"))
  );
}

function provenance(
  source: KeepOutSource,
  evidenceGrade: EvidenceGrade,
  sourceNote: string,
  screenshot?: KeepOutScreenshotIdentity,
  drawableBounds?: KeepOutDrawableBounds,
): KeepOutProvenance {
  return deepFreeze({
    source,
    evidenceGrade,
    sourceNote,
    ...(screenshot === undefined ? {} : { screenshot }),
    ...(drawableBounds === undefined ? {} : { drawableBounds }),
  });
}

function measuredGuideBase(
  id: BuiltInKeepOutId,
  label: string,
  context: string,
  sourceNote: string,
): KeepOutEntryBase {
  return {
    id,
    label,
    context,
    coordinateSpace: KEEP_OUT_COORDINATE_SPACE,
    provenance: provenance(
      "production-evidence",
      "measured-guide",
      sourceNote,
    ),
    notes: [sourceNote],
  };
}

function calibratedProductionBase(
  id: BuiltInKeepOutId,
  label: string,
  context: string,
  sourceNote: string,
  screenshot: KeepOutScreenshotIdentity,
  drawableBounds: KeepOutDrawableBounds,
): KeepOutEntryBase {
  return {
    id,
    label,
    context,
    coordinateSpace: KEEP_OUT_COORDINATE_SPACE,
    provenance: provenance(
      "production-evidence",
      "calibrated",
      sourceNote,
      screenshot,
      drawableBounds,
    ),
    notes: [sourceNote],
  };
}

const BUILTIN_CONVERSATION_BACK_ROW = deepFreeze({
  ...measuredGuideBase(
    KEEP_OUT_IDS.conversationBackRow,
    "Conversation wheel Back row",
    KEEP_OUT_PRESET_IDS.cockpitConversation,
    "Production evidence measures the conversation-wheel Back row at approximately normalized y=0.788; this is a guide, not a full region.",
  ),
  kind: "horizontal-guide",
  geometry: {
    kind: "horizontal-guide",
    axis: "y",
    y: 0.788,
  },
}) as HorizontalGuideKeepOut;

const BUILTIN_CONVERSATION_OPTION_STACK = deepFreeze({
  ...measuredGuideBase(
    KEEP_OUT_IDS.conversationOptionStackStart,
    "Conversation option stack start",
    KEEP_OUT_PRESET_IDS.cockpitConversation,
    "Production evidence measures the pre-overlay multi-option stack start at approximately normalized y=0.74; this is a guide, not a full region.",
  ),
  kind: "horizontal-guide",
  geometry: {
    kind: "horizontal-guide",
    axis: "y",
    y: 0.74,
  },
}) as HorizontalGuideKeepOut;

const BUILTIN_INFORMATION_PANEL_LEFT_EDGE = deepFreeze({
  ...measuredGuideBase(
    KEEP_OUT_IDS.informationPanelLeftEdge,
    "INFORMATION/NPC-video leftmost edge",
    KEEP_OUT_PRESET_IDS.cockpitConversation,
    "Production evidence measures the INFORMATION/NPC-video panel leftmost point at approximately normalized x=0.664 at input-bar height. The described bottom-right parallelogram vertices remain unmeasured.",
  ),
  kind: "vertical-guide",
  geometry: {
    kind: "vertical-guide",
    axis: "x",
    x: 0.664,
  },
}) as VerticalGuideKeepOut;

const BUILTIN_MISSION_MESSAGES_TICKER_POINTS = [
  { x: 0.0994496855345912, y: 0.943089430894309 },
  { x: 0.33372641509433965, y: 0.8484848484848485 },
  { x: 0.33372641509433965, y: 0.9150036954915004 },
  { x: 0.11006289308176101, y: 1 },
] as const;

const BUILTIN_TOP_HUD_STRIP_POINTS = [
  { x: 0.419811320754717, y: 0.008130081300813009 },
  { x: 0.5794025157232704, y: 0.008130081300813009 },
  { x: 0.5794025157232704, y: 0.07982261640798226 },
  { x: 0.419811320754717, y: 0.07982261640798226 },
] as const;

const BUILTIN_MISSION_MESSAGES_TICKER = deepFreeze({
  ...calibratedProductionBase(
    KEEP_OUT_IDS.missionMessagesTicker,
    "Mission/MESSAGES ticker",
    "shared-reference",
    "Screenshot-calibrated conservative Mission/MESSAGES ticker keep-out envelope from retained X4 capture 777D001A6CDF46F77AAEE76F9AC7F6E4FFF9E8CFF0F5E7C3082E93E88388DF20 with profile x4-9.00-617726-windowed-2544x1353-ui-scale-1.0-first-person and drawable bounds left=1, top=31, width=2544, height=1353. The final point is clipped at the drawable bottom; this is advisory only and Not verified in game.",
    {
      hash: "777D001A6CDF46F77AAEE76F9AC7F6E4FFF9E8CFF0F5E7C3082E93E88388DF20",
      profile: "x4-9.00-617726-windowed-2544x1353-ui-scale-1.0-first-person",
    },
    { left: 1, top: 31, width: 2544, height: 1353 },
  ),
  kind: "polygon",
  geometry: {
    kind: "polygon",
    points: BUILTIN_MISSION_MESSAGES_TICKER_POINTS,
  },
}) as PolygonKeepOut;

const BUILTIN_TOP_HUD_STRIP = deepFreeze({
  ...calibratedProductionBase(
    KEEP_OUT_IDS.topHudStrip,
    "Top HUD strip",
    "shared-reference",
    "Screenshot-calibrated shared top HUD/menu strip from retained X4 map-open capture 2BA6C8C065EF3563A0C2C06E814BCD226BA160BC0EE64981D07E01C01AD2ADC8 with profile x4-9.00-617726-windowed-2544x1353-ui-scale-1.0-map-open and drawable bounds left=1, top=31, width=2544, height=1353. Fullscreen corroboration capture SHA-256 BD1CAD7C69A5B11F87BEBF2BC8B5C65677654A3ECB89F9917C79BA577EC64F26 supports the same extent; the map capture remains the single primary screenshot identity. This is advisory only and Not verified in game.",
    {
      hash: "2BA6C8C065EF3563A0C2C06E814BCD226BA160BC0EE64981D07E01C01AD2ADC8",
      profile: "x4-9.00-617726-windowed-2544x1353-ui-scale-1.0-map-open",
    },
    { left: 1, top: 31, width: 2544, height: 1353 },
  ),
  kind: "polygon",
  geometry: {
    kind: "polygon",
    points: BUILTIN_TOP_HUD_STRIP_POINTS,
  },
}) as PolygonKeepOut;

export const BUILT_IN_KEEP_OUTS = deepFreeze([
  BUILTIN_CONVERSATION_BACK_ROW,
  BUILTIN_CONVERSATION_OPTION_STACK,
  BUILTIN_INFORMATION_PANEL_LEFT_EDGE,
  BUILTIN_MISSION_MESSAGES_TICKER,
  BUILTIN_TOP_HUD_STRIP,
] as readonly X4UiKeepOutEntry[]);

for (const entry of BUILT_IN_KEEP_OUTS) ISSUED_KEEP_OUT_ENTRIES.add(entry);

/** Alias with the spelling used by some callers. */
export const BUILTIN_KEEP_OUTS = BUILT_IN_KEEP_OUTS;

function presetMember(
  entryId: BuiltInKeepOutId,
  applicability: PresetApplicability,
  evidenceGrade: EvidenceGrade,
  applicabilityEvidence: PresetApplicabilityEvidence,
  note: string,
): KeepOutPresetMember {
  return {
    entryId,
    applicability,
    evidenceGrade,
    applicabilityEvidence,
    note,
  };
}

const COCKPIT_CONVERSATION_MEMBERS = deepFreeze([
  presetMember(
    KEEP_OUT_IDS.conversationBackRow,
    "applicable",
    "measured-guide",
    "context-evidenced",
    "The production Back-row guide is explicitly applicable to cockpit conversation.",
  ),
  presetMember(
    KEEP_OUT_IDS.conversationOptionStackStart,
    "applicable",
    "measured-guide",
    "context-evidenced",
    "The production option-stack start guide is explicitly applicable to cockpit conversation.",
  ),
  presetMember(
    KEEP_OUT_IDS.informationPanelLeftEdge,
    "applicable",
    "measured-guide",
    "context-evidenced",
    "The production INFORMATION/NPC-video edge guide is explicitly applicable at the conversation input-bar height.",
  ),
  presetMember(
    KEEP_OUT_IDS.missionMessagesTicker,
    "applicable",
    "calibrated",
    "context-evidenced",
    "Screenshot-calibrated ticker envelope is supported by retained capture evidence and is issued for cockpit-conversation.",
  ),
  presetMember(
    KEEP_OUT_IDS.topHudStrip,
    "not-applicable",
    "calibrated",
    "not-established",
    "Screenshot-calibrated top HUD strip is not issued for cockpit-conversation; retained evidence supports map-open and fullscreen-menu only.",
  ),
] as readonly KeepOutPresetMember[]);

const MAP_OPEN_MEMBERS = deepFreeze([
  presetMember(
    KEEP_OUT_IDS.conversationBackRow,
    "not-applicable",
    "measured-guide",
    "not-established",
    "The measured conversation Back-row guide remains limited to cockpit-conversation and is not issued for map-open.",
  ),
  presetMember(
    KEEP_OUT_IDS.conversationOptionStackStart,
    "not-applicable",
    "measured-guide",
    "not-established",
    "The measured conversation option-stack guide remains limited to cockpit-conversation and is not issued for map-open.",
  ),
  presetMember(
    KEEP_OUT_IDS.informationPanelLeftEdge,
    "not-applicable",
    "measured-guide",
    "not-established",
    "The measured INFORMATION/NPC-video edge guide remains limited to cockpit-conversation and is not issued for map-open.",
  ),
  presetMember(
    KEEP_OUT_IDS.missionMessagesTicker,
    "not-applicable",
    "calibrated",
    "not-established",
    "Screenshot-calibrated ticker envelope is not issued for map-open; retained evidence supports cockpit-conversation and first-person only.",
  ),
  presetMember(
    KEEP_OUT_IDS.topHudStrip,
    "applicable",
    "calibrated",
    "context-evidenced",
    "Screenshot-calibrated shared top HUD/menu strip is supported by the retained map-open capture.",
  ),
] as readonly KeepOutPresetMember[]);

const FULLSCREEN_MENU_MEMBERS = deepFreeze([
  presetMember(
    KEEP_OUT_IDS.conversationBackRow,
    "not-applicable",
    "measured-guide",
    "not-established",
    "The measured conversation Back-row guide remains limited to cockpit-conversation and is not issued for fullscreen-menu.",
  ),
  presetMember(
    KEEP_OUT_IDS.conversationOptionStackStart,
    "not-applicable",
    "measured-guide",
    "not-established",
    "The measured conversation option-stack guide remains limited to cockpit-conversation and is not issued for fullscreen-menu.",
  ),
  presetMember(
    KEEP_OUT_IDS.informationPanelLeftEdge,
    "not-applicable",
    "measured-guide",
    "not-established",
    "The measured INFORMATION/NPC-video edge guide remains limited to cockpit-conversation and is not issued for fullscreen-menu.",
  ),
  presetMember(
    KEEP_OUT_IDS.missionMessagesTicker,
    "not-applicable",
    "calibrated",
    "not-established",
    "Screenshot-calibrated ticker envelope is not issued for fullscreen-menu; retained evidence supports cockpit-conversation and first-person only.",
  ),
  presetMember(
    KEEP_OUT_IDS.topHudStrip,
    "applicable",
    "calibrated",
    "context-evidenced",
    "Screenshot-calibrated shared top HUD/menu strip is corroborated by the retained fullscreen-menu capture.",
  ),
] as readonly KeepOutPresetMember[]);

const FIRST_PERSON_MEMBERS = deepFreeze([
  presetMember(
    KEEP_OUT_IDS.conversationBackRow,
    "not-applicable",
    "measured-guide",
    "not-established",
    "The measured conversation Back-row guide remains limited to cockpit-conversation and is not issued for first-person.",
  ),
  presetMember(
    KEEP_OUT_IDS.conversationOptionStackStart,
    "not-applicable",
    "measured-guide",
    "not-established",
    "The measured conversation option-stack guide remains limited to cockpit-conversation and is not issued for first-person.",
  ),
  presetMember(
    KEEP_OUT_IDS.informationPanelLeftEdge,
    "not-applicable",
    "measured-guide",
    "not-established",
    "The measured INFORMATION/NPC-video edge guide remains limited to cockpit-conversation and is not issued for first-person.",
  ),
  presetMember(
    KEEP_OUT_IDS.missionMessagesTicker,
    "applicable",
    "calibrated",
    "context-evidenced",
    "Screenshot-calibrated ticker envelope is supported by the retained first-person capture.",
  ),
  presetMember(
    KEEP_OUT_IDS.topHudStrip,
    "not-applicable",
    "calibrated",
    "not-established",
    "Screenshot-calibrated top HUD strip is not issued for first-person; retained evidence supports map-open and fullscreen-menu only.",
  ),
] as readonly KeepOutPresetMember[]);

export const KEEP_OUT_PRESETS = deepFreeze([
  {
    id: KEEP_OUT_PRESET_IDS.cockpitConversation,
    label: "Cockpit conversation",
    members: COCKPIT_CONVERSATION_MEMBERS,
  },
  {
    id: KEEP_OUT_PRESET_IDS.mapOpen,
    label: "Map open",
    members: MAP_OPEN_MEMBERS,
  },
  {
    id: KEEP_OUT_PRESET_IDS.fullscreenMenu,
    label: "Fullscreen menu",
    members: FULLSCREEN_MENU_MEMBERS,
  },
  {
    id: KEEP_OUT_PRESET_IDS.firstPerson,
    label: "First person",
    members: FIRST_PERSON_MEMBERS,
  },
] as readonly X4UiKeepOutPreset[]);

/** Alias with an explicit built-in prefix. */
export const BUILT_IN_KEEP_OUT_PRESETS = KEEP_OUT_PRESETS;

function invalidProjection(
  reason: ProjectionRefusalReason,
  message: string,
  entryId = "unknown",
  evidenceGrade: EvidenceGrade = "reference-unmeasured",
): KeepOutProjectionRefused {
  return deepFreeze({
    status: "refused",
    reason,
    message,
    entryId,
    evidenceGrade,
    advisoryOnly: true,
    gameVerification: NOT_VERIFIED_IN_GAME,
    geometry: null,
  });
}

function issueProjection<T extends KeepOutProjectionResult>(result: T): T {
  if (result.status !== "refused" && result !== null && typeof result === "object") {
    ISSUED_KEEP_OUT_PROJECTIONS.add(result);
  }
  return result;
}

function invalidCalibration(
  reason: CalibrationRefusalReason,
  message: string,
): KeepOutCalibrationRefused {
  return deepFreeze({
    status: "refused",
    reason,
    message,
  });
}

function readOrigin(
  bounds: AnyRecord,
  canonicalName: "left" | "top",
  aliasName: "x" | "y",
): number | null {
  const canonicalField = ownDataField(bounds, canonicalName);
  const aliasField = ownDataField(bounds, aliasName);
  if (!canonicalField.valid || !aliasField.valid) return null;
  const canonical = canonicalField.value;
  const alias = aliasField.value;
  const canonicalNumber =
    !canonicalField.present
      ? undefined
      : isFiniteNumber(canonical)
        ? canonical
        : null;
  const aliasNumber =
    !aliasField.present
      ? undefined
      : isFiniteNumber(alias)
        ? alias
        : null;
  if (canonicalNumber === null || aliasNumber === null) {
    return null;
  }
  if (
    canonicalNumber !== undefined &&
    aliasNumber !== undefined &&
    canonicalNumber !== aliasNumber
  ) {
    return null;
  }
  if (canonicalNumber !== undefined) {
    return canonicalNumber;
  }
  if (aliasNumber !== undefined) {
    return aliasNumber;
  }
  return 0;
}

interface ResolvedDrawableBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function resolveDrawableBounds(
  value: unknown,
): ResolvedDrawableBounds | null {
  if (!hasExactOwnDataFields(value, ["width", "height"], ["left", "top", "x", "y"])) return null;
  const width = dataField(value, "width");
  const height = dataField(value, "height");
  if (!isFinitePositiveNumber(width) || !isFinitePositiveNumber(height)) return null;
  const left = readOrigin(value, "left", "x");
  const top = readOrigin(value, "top", "y");
  if (left === null || top === null) return null;
  if (!isFiniteNumber(left + (width as number)) || !isFiniteNumber(top + (height as number))) return null;
  return { left, top, width: width as number, height: height as number };
}

function resolveViewport(value: unknown): DrawableViewport | null {
  if (!hasExactOwnDataFields(value, ["width", "height"])) return null;
  const width = dataField(value, "width");
  const height = dataField(value, "height");
  if (!isFinitePositiveNumber(width) || !isFinitePositiveNumber(height)) return null;
  return deepFreeze({ width, height });
}

function isValidProvenance(value: unknown): value is KeepOutProvenance {
  if (!hasExactOwnDataFields(value, ["source", "evidenceGrade", "sourceNote"], ["screenshot", "drawableBounds"])) return false;
  const source = dataField(value, "source");
  const evidenceGrade = dataField(value, "evidenceGrade");
  if (!isKeepOutSource(source) || !isEvidenceGrade(evidenceGrade) || !isNonEmptyString(dataField(value, "sourceNote"))) return false;
  if (source === "manual-calibration") {
    if (evidenceGrade !== "calibrated"
      || !hasExactOwnDataFields(value, ["source", "evidenceGrade", "sourceNote", "screenshot", "drawableBounds"])
      || !isValidScreenshotIdentity(dataField(value, "screenshot"))
      || !isValidDrawableBounds(dataField(value, "drawableBounds"))) return false;
    return true;
  }
  if (evidenceGrade === "calibrated") {
    return hasExactOwnDataFields(value, ["source", "evidenceGrade", "sourceNote", "screenshot", "drawableBounds"])
      && isValidScreenshotIdentity(dataField(value, "screenshot"))
      && isValidDrawableBounds(dataField(value, "drawableBounds"));
  }
  return (evidenceGrade === "measured-guide" || evidenceGrade === "reference-unmeasured")
    && hasExactOwnDataFields(value, ["source", "evidenceGrade", "sourceNote"]);
}

function isValidKeepOutEntry(value: unknown): value is X4UiKeepOutEntry {
  try {
    if (!hasExactOwnDataFields(value, ["id", "label", "context", "coordinateSpace", "provenance", "notes", "kind", "geometry"])) return false;
    const id = dataField(value, "id");
    const label = dataField(value, "label");
    const context = dataField(value, "context");
    const provenanceValue = dataField(value, "provenance");
    const notes = denseDataArray(dataField(value, "notes"));
    if (!isNonEmptyString(id) || !isNonEmptyString(label) || !isNonEmptyString(context)
      || dataField(value, "coordinateSpace") !== KEEP_OUT_COORDINATE_SPACE
      || !isValidProvenance(provenanceValue)
      || notes === null || notes.length === 0 || !notes.every(note => isNonEmptyString(note))) return false;
    const source = dataField(provenanceValue as unknown as AnyRecord, "source");
    const evidenceGrade = dataField(provenanceValue as unknown as AnyRecord, "evidenceGrade");
    const geometry = dataField(value, "geometry");
    const kind = dataField(value, "kind");
    if (kind === "horizontal-guide") {
      return source === "production-evidence" && evidenceGrade === "measured-guide"
        && hasExactOwnDataFields(geometry, ["kind", "axis", "y"])
        && dataField(geometry as AnyRecord, "kind") === "horizontal-guide"
        && dataField(geometry as AnyRecord, "axis") === "y"
        && isNormalizedCoordinate(dataField(geometry as AnyRecord, "y"));
    }
    if (kind === "vertical-guide") {
      return source === "production-evidence" && evidenceGrade === "measured-guide"
        && hasExactOwnDataFields(geometry, ["kind", "axis", "x"])
        && dataField(geometry as AnyRecord, "kind") === "vertical-guide"
        && dataField(geometry as AnyRecord, "axis") === "x"
        && isNormalizedCoordinate(dataField(geometry as AnyRecord, "x"));
    }
    if (kind === "polygon") {
      if (evidenceGrade !== "calibrated") return false;
      if (source === "manual-calibration" && Object.values(KEEP_OUT_IDS).some(builtInId => builtInId === id)) return false;
      if (source === "production-evidence" && !isIssuedKeepOutEntry(value)) return false;
      if (source !== "manual-calibration" && source !== "production-evidence") return false;
      if (!hasExactOwnDataFields(geometry, ["kind", "points"]) || dataField(geometry as AnyRecord, "kind") !== "polygon") return false;
      const points = denseDataArray(dataField(geometry as AnyRecord, "points"));
      if (points === null || points.length < 3 || !points.every(point => isNormalizedPoint(point))) return false;
      return hasUniqueNormalizedPoints(points as readonly NormalizedPoint[]) && hasNonCollinearPoints(points as readonly NormalizedPoint[]);
    }
    return kind === "unmeasured"
      && source === "production-evidence"
      && evidenceGrade === "reference-unmeasured"
      && geometry === null;
  } catch {
    return false;
  }
}

export function getBuiltInKeepOut(
  id: BuiltInKeepOutId,
): X4UiKeepOutEntry | undefined {
  return BUILT_IN_KEEP_OUTS.find((entry) => entry.id === id);
}

export function getKeepOutPreset(
  id: KeepOutContextPresetId,
): X4UiKeepOutPreset | undefined {
  return KEEP_OUT_PRESETS.find((preset) => preset.id === id);
}

export function projectKeepOut(
  entry: X4UiKeepOutEntry,
  viewport: DrawableViewport,
): KeepOutProjectionResult {
  try {
    const resolvedViewport = resolveViewport(viewport);
    if (resolvedViewport === null) {
      return invalidProjection(
        "invalid-viewport",
        "Projection requires finite positive drawable width and height.",
      );
    }
    if (!isValidKeepOutEntry(entry)) {
      return invalidProjection(
        "invalid-entry",
        "Projection requires a normalized keep-out entry with valid geometry and provenance.",
      );
    }

    const entryRecord = entry as unknown as AnyRecord;
    const entryId = dataField(entryRecord, "id") as string;
    const kind = dataField(entryRecord, "kind");
    const provenanceValue = dataField(entryRecord, "provenance") as AnyRecord;
    const evidenceGrade = dataField(provenanceValue, "evidenceGrade") as EvidenceGrade;
    if (kind === "unmeasured") {
      return issueProjection(deepFreeze({
        status: "unavailable",
        reason: "reference-unmeasured",
        entryId,
        evidenceGrade,
        advisoryOnly: true,
        gameVerification: NOT_VERIFIED_IN_GAME,
        geometry: null,
      }));
    }

    const entryGeometry = dataField(entryRecord, "geometry") as AnyRecord;
    let geometry: ProjectedKeepOutGeometry;
    if (kind === "horizontal-guide") {
      geometry = {
        kind: "horizontal-guide",
        y: (dataField(entryGeometry, "y") as number) * resolvedViewport.height,
      };
    } else if (kind === "vertical-guide") {
      geometry = {
        kind: "vertical-guide",
        x: (dataField(entryGeometry, "x") as number) * resolvedViewport.width,
      };
    } else {
      const points = denseDataArray(dataField(entryGeometry, "points")) as readonly AnyRecord[];
      geometry = {
        kind: "polygon",
        points: points.map(point => ({
          x: (dataField(point, "x") as number) * resolvedViewport.width,
          y: (dataField(point, "y") as number) * resolvedViewport.height,
        })),
      };
    }

    return issueProjection(deepFreeze({
      status: "projected",
      entryId,
      evidenceGrade,
      advisoryOnly: true,
      gameVerification: NOT_VERIFIED_IN_GAME,
      geometry,
      viewport: resolvedViewport,
    }));
  } catch {
    return invalidProjection(
      "invalid-entry",
      "Projection rejected malformed keep-out evidence without producing geometry.",
    );
  }
}

export function projectBuiltInKeepOut(
  id: string,
  viewport: DrawableViewport,
): KeepOutProjectionResult {
  const entry = BUILT_IN_KEEP_OUTS.find((candidate) => candidate.id === id);
  if (entry === undefined) {
    return invalidProjection(
      "unknown-entry",
      "No built-in keep-out entry exists for the requested id.",
      isNonEmptyString(id) ? id : "unknown",
    );
  }
  return projectKeepOut(entry, viewport);
}

function hasUniqueNormalizedPoints(
  points: readonly NormalizedPoint[],
): boolean {
  for (let first = 0; first < points.length - 1; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      if (
        points[first].x === points[second].x &&
        points[first].y === points[second].y
      ) {
        return false;
      }
    }
  }
  return true;
}

function hasNonCollinearPoints(points: readonly NormalizedPoint[]): boolean {
  for (let first = 0; first < points.length - 2; first += 1) {
    for (let second = first + 1; second < points.length - 1; second += 1) {
      for (let third = second + 1; third < points.length; third += 1) {
        const a = points[first];
        const b = points[second];
        const c = points[third];
        const areaTwice =
          (b.x - a.x) * (c.y - a.y) -
          (b.y - a.y) * (c.x - a.x);
        if (areaTwice !== 0) {
          return true;
        }
      }
    }
  }
  return false;
}

export function calibrateKeepOutPolygon(
  input: KeepOutCalibrationInput,
): KeepOutCalibrationResult {
  try {
    if (!hasExactOwnDataFields(input, ["stableId", "context", "sourceNote", "screenshotHash", "profile", "drawableBounds", "points"])) {
      return invalidCalibration(
        "malformed-input",
        "Manual calibration input must be closed plain data with exactly the declared fields.",
      );
    }
    const inputRecord = input as unknown as AnyRecord;
    const stableId = dataField(inputRecord, "stableId");
    const context = dataField(inputRecord, "context");
    const sourceNote = dataField(inputRecord, "sourceNote");
    const screenshotHash = dataField(inputRecord, "screenshotHash");
    const profile = dataField(inputRecord, "profile");
    if (!isNonEmptyString(stableId)) {
      return invalidCalibration(
        "empty-stable-id",
        "Manual calibration requires a non-empty stable id.",
      );
    }
    if (Object.values(KEEP_OUT_IDS).some(id => id === stableId)) {
      return invalidCalibration(
        "built-in-id-collision",
        "Manual calibration stable ids must not collide with built-in keep-out ids.",
      );
    }
    if (!isNonEmptyString(context)) {
      return invalidCalibration(
        "empty-context",
        "Manual calibration requires a non-empty context.",
      );
    }
    if (!isNonEmptyString(sourceNote)) {
      return invalidCalibration(
        "empty-source-note",
        "Manual calibration requires an explicit non-empty source note.",
      );
    }
    if (!isNonEmptyString(screenshotHash)) {
      return invalidCalibration(
        "empty-screenshot-hash",
        "Manual calibration requires a non-empty screenshot hash.",
      );
    }
    if (!SCREENSHOT_HASH_PATTERN.test(screenshotHash)) {
      return invalidCalibration(
        "malformed-screenshot-hash",
        "Screenshot hash must be 64 hexadecimal characters, optionally prefixed with sha256:.",
      );
    }
    if (!isNonEmptyString(profile)) {
      return invalidCalibration(
        "empty-profile",
        "Manual calibration requires a non-empty screenshot profile.",
      );
    }

    const bounds = resolveDrawableBounds(dataField(inputRecord, "drawableBounds"));
    if (bounds === null) {
      return invalidCalibration(
        "invalid-bounds",
        "Drawable bounds require finite positive width and height and finite origins.",
      );
    }
    const pointValues = denseDataArray(dataField(inputRecord, "points"));
    if (pointValues === null) {
      return invalidCalibration(
        "invalid-points",
        "Manual calibration requires a dense array of screenshot pixel points.",
      );
    }
    if (pointValues.length < 3) {
      return invalidCalibration(
        "too-few-points",
        "Manual calibration requires at least three points.",
      );
    }

    const right = bounds.left + bounds.width;
    const bottom = bounds.top + bounds.height;
    const normalizedPoints: NormalizedPoint[] = [];
    const pixelPoints: { readonly x: number; readonly y: number }[] = [];
    for (const pointValue of pointValues) {
      if (!hasExactOwnDataFields(pointValue, ["x", "y"])) {
        return invalidCalibration(
          "invalid-point",
          "Every calibration point must be a closed data point with finite x and y coordinates.",
        );
      }
      const pointRecord = pointValue as AnyRecord;
      const pointX = dataField(pointRecord, "x");
      const pointY = dataField(pointRecord, "y");
      if (!isFiniteNumber(pointX) || !isFiniteNumber(pointY)) {
        return invalidCalibration(
          "invalid-point",
          "Every calibration point must have finite x and y coordinates.",
        );
      }
      if (pointX < bounds.left || pointX > right || pointY < bounds.top || pointY > bottom) {
        return invalidCalibration(
          "out-of-bounds",
          "Every calibration point must be inside the exact drawable bounds.",
        );
      }
      const normalizedPoint = {
        x: (pointX - bounds.left) / bounds.width,
        y: (pointY - bounds.top) / bounds.height,
      };
      if (!isNormalizedCoordinate(normalizedPoint.x) || !isNormalizedCoordinate(normalizedPoint.y)) {
        return invalidCalibration(
          "invalid-point",
          "Point normalization must produce finite coordinates in [0, 1].",
        );
      }
      pixelPoints.push({ x: pointX, y: pointY });
      normalizedPoints.push(normalizedPoint);
    }

    for (let first = 0; first < pixelPoints.length - 1; first += 1) {
      for (let second = first + 1; second < pixelPoints.length; second += 1) {
        if (pixelPoints[first].x === pixelPoints[second].x && pixelPoints[first].y === pixelPoints[second].y) {
          return invalidCalibration(
            "duplicate-points",
            "Calibration polygon points must be unique.",
          );
        }
      }
    }

    if (!hasNonCollinearPoints(normalizedPoints)) {
      return invalidCalibration(
        "collinear-points",
        "Calibration polygon points must contain a non-collinear triple.",
      );
    }

    const frozenPoints = deepFreeze(
      normalizedPoints.map(point => ({ x: point.x, y: point.y })),
    ) as readonly NormalizedPoint[];
    const screenshot = deepFreeze({
      hash: screenshotHash,
      profile,
    });
    const canonicalBounds = deepFreeze({
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
    const sourceProvenance = provenance(
      "manual-calibration",
      "calibrated",
      sourceNote,
      screenshot,
      canonicalBounds,
    );
    const entry = deepFreeze({
      id: stableId,
      label: `Manual calibration ${stableId}`,
      context,
      coordinateSpace: KEEP_OUT_COORDINATE_SPACE,
      provenance: sourceProvenance,
      notes: [sourceNote],
      kind: "polygon",
      geometry: {
        kind: "polygon",
        points: frozenPoints,
      },
    }) as PolygonKeepOut;
    ISSUED_KEEP_OUT_ENTRIES.add(entry);

    return deepFreeze({ status: "success", entry });
  } catch {
    return invalidCalibration(
      "malformed-input",
      "Manual calibration rejected malformed evidence without executing accessors or producing geometry.",
    );
  }
}

/** Alias emphasizing that calibration is a new immutable keep-out value. */
export const createCalibratedKeepOut = calibrateKeepOutPolygon;
