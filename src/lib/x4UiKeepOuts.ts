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
  | "collinear-points";

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
    isRecord(value) &&
    isNonEmptyString(value.hash) &&
    SCREENSHOT_HASH_PATTERN.test(value.hash) &&
    isNonEmptyString(value.profile)
  );
}

function isNormalizedCoordinate(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isNormalizedPoint(value: unknown): value is NormalizedPoint {
  return (
    isRecord(value) &&
    isNormalizedCoordinate(value.x) &&
    isNormalizedCoordinate(value.y)
  );
}

function provenance(
  source: KeepOutSource,
  evidenceGrade: EvidenceGrade,
  sourceNote: string,
  screenshot?: KeepOutScreenshotIdentity,
): KeepOutProvenance {
  return deepFreeze({
    source,
    evidenceGrade,
    sourceNote,
    ...(screenshot === undefined ? {} : { screenshot }),
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

function referenceUnmeasuredBase(
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
      "reference-unmeasured",
      sourceNote,
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

const BUILTIN_MISSION_MESSAGES_TICKER = deepFreeze({
  ...referenceUnmeasuredBase(
    KEEP_OUT_IDS.missionMessagesTicker,
    "Mission/MESSAGES ticker",
    "shared-reference",
    "The Mission/MESSAGES ticker is a required reference entry, but its bottom-left position and drawable extent are unmeasured. No ticker geometry or safe boundary is inferred.",
  ),
  kind: "unmeasured",
  geometry: null,
}) as UnmeasuredKeepOut;

const BUILTIN_TOP_HUD_STRIP = deepFreeze({
  ...referenceUnmeasuredBase(
    KEEP_OUT_IDS.topHudStrip,
    "Top HUD strip",
    "shared-reference",
    "The top HUD strip is a required reference entry, but its top-strip extent is unmeasured. No HUD geometry, height, or safe boundary is inferred.",
  ),
  kind: "unmeasured",
  geometry: null,
}) as UnmeasuredKeepOut;

export const BUILT_IN_KEEP_OUTS = deepFreeze([
  BUILTIN_CONVERSATION_BACK_ROW,
  BUILTIN_CONVERSATION_OPTION_STACK,
  BUILTIN_INFORMATION_PANEL_LEFT_EDGE,
  BUILTIN_MISSION_MESSAGES_TICKER,
  BUILTIN_TOP_HUD_STRIP,
] as readonly X4UiKeepOutEntry[]);

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
    "unverified",
    "reference-unmeasured",
    "not-established",
    "Ticker geometry and cockpit-conversation context applicability are both unverified; its extent remains unmeasured.",
  ),
  presetMember(
    KEEP_OUT_IDS.topHudStrip,
    "unverified",
    "reference-unmeasured",
    "not-established",
    "Top-HUD geometry and cockpit-conversation context applicability are both unverified; its extent remains unmeasured.",
  ),
] as readonly KeepOutPresetMember[]);

const MAP_OPEN_MEMBERS = deepFreeze([
  presetMember(
    KEEP_OUT_IDS.conversationBackRow,
    "unverified",
    "measured-guide",
    "not-established",
    "No map-open applicability evidence was supplied for the conversation Back-row guide.",
  ),
  presetMember(
    KEEP_OUT_IDS.conversationOptionStackStart,
    "unverified",
    "measured-guide",
    "not-established",
    "No map-open applicability evidence was supplied for the conversation option-stack guide.",
  ),
  presetMember(
    KEEP_OUT_IDS.informationPanelLeftEdge,
    "unverified",
    "measured-guide",
    "not-established",
    "No map-open applicability evidence was supplied for the INFORMATION/NPC-video edge guide.",
  ),
  presetMember(
    KEEP_OUT_IDS.missionMessagesTicker,
    "unverified",
    "reference-unmeasured",
    "not-established",
    "Ticker geometry and map-open context applicability are both unverified; its extent remains unmeasured.",
  ),
  presetMember(
    KEEP_OUT_IDS.topHudStrip,
    "unverified",
    "reference-unmeasured",
    "not-established",
    "Top-HUD geometry and map-open context applicability are both unverified; its extent remains unmeasured.",
  ),
] as readonly KeepOutPresetMember[]);

const FULLSCREEN_MENU_MEMBERS = deepFreeze([
  presetMember(
    KEEP_OUT_IDS.conversationBackRow,
    "unverified",
    "measured-guide",
    "not-established",
    "No fullscreen-menu applicability evidence was supplied for the conversation Back-row guide.",
  ),
  presetMember(
    KEEP_OUT_IDS.conversationOptionStackStart,
    "unverified",
    "measured-guide",
    "not-established",
    "No fullscreen-menu applicability evidence was supplied for the conversation option-stack guide.",
  ),
  presetMember(
    KEEP_OUT_IDS.informationPanelLeftEdge,
    "unverified",
    "measured-guide",
    "not-established",
    "No fullscreen-menu applicability evidence was supplied for the INFORMATION/NPC-video edge guide.",
  ),
  presetMember(
    KEEP_OUT_IDS.missionMessagesTicker,
    "unverified",
    "reference-unmeasured",
    "not-established",
    "Ticker geometry and fullscreen-menu context applicability are both unverified; its extent remains unmeasured.",
  ),
  presetMember(
    KEEP_OUT_IDS.topHudStrip,
    "unverified",
    "reference-unmeasured",
    "not-established",
    "Top-HUD geometry and fullscreen-menu context applicability are both unverified; its extent remains unmeasured.",
  ),
] as readonly KeepOutPresetMember[]);

const FIRST_PERSON_MEMBERS = deepFreeze([
  presetMember(
    KEEP_OUT_IDS.conversationBackRow,
    "unverified",
    "measured-guide",
    "not-established",
    "No first-person applicability evidence was supplied for the conversation Back-row guide.",
  ),
  presetMember(
    KEEP_OUT_IDS.conversationOptionStackStart,
    "unverified",
    "measured-guide",
    "not-established",
    "No first-person applicability evidence was supplied for the conversation option-stack guide.",
  ),
  presetMember(
    KEEP_OUT_IDS.informationPanelLeftEdge,
    "unverified",
    "measured-guide",
    "not-established",
    "No first-person applicability evidence was supplied for the INFORMATION/NPC-video edge guide.",
  ),
  presetMember(
    KEEP_OUT_IDS.missionMessagesTicker,
    "unverified",
    "reference-unmeasured",
    "not-established",
    "Ticker geometry and first-person context applicability are both unverified; its extent remains unmeasured.",
  ),
  presetMember(
    KEEP_OUT_IDS.topHudStrip,
    "unverified",
    "reference-unmeasured",
    "not-established",
    "Top-HUD geometry and first-person context applicability are both unverified; its extent remains unmeasured.",
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
  const canonical = bounds[canonicalName];
  const alias = bounds[aliasName];
  const canonicalNumber =
    canonical === undefined
      ? undefined
      : isFiniteNumber(canonical)
        ? canonical
        : null;
  const aliasNumber =
    alias === undefined
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
  if (!isRecord(value)) {
    return null;
  }
  const width = value.width;
  const height = value.height;
  if (!isFinitePositiveNumber(width) || !isFinitePositiveNumber(height)) {
    return null;
  }
  const left = readOrigin(value, "left", "x");
  const top = readOrigin(value, "top", "y");
  if (left === null || top === null) {
    return null;
  }
  if (!isFiniteNumber(left + width) || !isFiniteNumber(top + height)) {
    return null;
  }
  return { left, top, width, height };
}

function resolveViewport(value: unknown): DrawableViewport | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    !isFinitePositiveNumber(value.width) ||
    !isFinitePositiveNumber(value.height)
  ) {
    return null;
  }
  return deepFreeze({ width: value.width, height: value.height });
}

function isValidKeepOutEntry(value: unknown): value is X4UiKeepOutEntry {
  if (!isRecord(value)) {
    return false;
  }
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.label) ||
    !isNonEmptyString(value.context) ||
    value.coordinateSpace !== KEEP_OUT_COORDINATE_SPACE ||
    !isRecord(value.provenance) ||
    !isKeepOutSource(value.provenance.source) ||
    !isEvidenceGrade(value.provenance.evidenceGrade) ||
    !isNonEmptyString(value.provenance.sourceNote) ||
    !Array.isArray(value.notes) ||
    value.notes.length === 0 ||
    !value.notes.every((note) => isNonEmptyString(note))
  ) {
    return false;
  }

  const geometry = value.geometry;
  switch (value.kind) {
    case "horizontal-guide":
      return (
        value.provenance.source === "production-evidence" &&
        value.provenance.evidenceGrade === "measured-guide" &&
        isRecord(geometry) &&
        geometry.kind === "horizontal-guide" &&
        geometry.axis === "y" &&
        isNormalizedCoordinate(geometry.y)
      );
    case "vertical-guide":
      return (
        value.provenance.source === "production-evidence" &&
        value.provenance.evidenceGrade === "measured-guide" &&
        isRecord(geometry) &&
        geometry.kind === "vertical-guide" &&
        geometry.axis === "x" &&
        isNormalizedCoordinate(geometry.x)
      );
    case "polygon": {
      if (
        value.provenance.source !== "manual-calibration" ||
        value.provenance.evidenceGrade !== "calibrated" ||
        !isValidScreenshotIdentity(value.provenance.screenshot) ||
        !isRecord(geometry) ||
        geometry.kind !== "polygon" ||
        !Array.isArray(geometry.points) ||
        geometry.points.length < 3 ||
        !geometry.points.every((point) => isNormalizedPoint(point))
      ) {
        return false;
      }
      const points = geometry.points as readonly NormalizedPoint[];
      return hasUniqueNormalizedPoints(points) && hasNonCollinearPoints(points);
    }
    case "unmeasured":
      return (
        value.provenance.source === "production-evidence" &&
        geometry === null &&
        value.provenance.evidenceGrade === "reference-unmeasured"
      );
    default:
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

  const evidenceGrade = entry.provenance.evidenceGrade;
  if (entry.kind === "unmeasured") {
    return deepFreeze({
      status: "unavailable",
      reason: "reference-unmeasured",
      entryId: entry.id,
      evidenceGrade,
      advisoryOnly: true,
      gameVerification: NOT_VERIFIED_IN_GAME,
      geometry: null,
    });
  }

  let geometry: ProjectedKeepOutGeometry;
  switch (entry.kind) {
    case "horizontal-guide":
      geometry = {
        kind: "horizontal-guide",
        y: entry.geometry.y * resolvedViewport.height,
      };
      break;
    case "vertical-guide":
      geometry = {
        kind: "vertical-guide",
        x: entry.geometry.x * resolvedViewport.width,
      };
      break;
    case "polygon":
      geometry = {
        kind: "polygon",
        points: entry.geometry.points.map((point) => ({
          x: point.x * resolvedViewport.width,
          y: point.y * resolvedViewport.height,
        })),
      };
      break;
  }

  return deepFreeze({
    status: "projected",
    entryId: entry.id,
    evidenceGrade,
    advisoryOnly: true,
    gameVerification: NOT_VERIFIED_IN_GAME,
    geometry,
    viewport: resolvedViewport,
  });
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
  if (!isRecord(input) || !isNonEmptyString(input.stableId)) {
    return invalidCalibration(
      "empty-stable-id",
      "Manual calibration requires a non-empty stable id.",
    );
  }
  if (!isNonEmptyString(input.context)) {
    return invalidCalibration(
      "empty-context",
      "Manual calibration requires a non-empty context.",
    );
  }
  if (!isNonEmptyString(input.sourceNote)) {
    return invalidCalibration(
      "empty-source-note",
      "Manual calibration requires an explicit non-empty source note.",
    );
  }
  if (!isNonEmptyString(input.screenshotHash)) {
    return invalidCalibration(
      "empty-screenshot-hash",
      "Manual calibration requires a non-empty screenshot hash.",
    );
  }
  if (!SCREENSHOT_HASH_PATTERN.test(input.screenshotHash)) {
    return invalidCalibration(
      "malformed-screenshot-hash",
      "Screenshot hash must be 64 hexadecimal characters, optionally prefixed with sha256:.",
    );
  }
  if (!isNonEmptyString(input.profile)) {
    return invalidCalibration(
      "empty-profile",
      "Manual calibration requires a non-empty screenshot profile.",
    );
  }

  const bounds = resolveDrawableBounds(input.drawableBounds);
  if (bounds === null) {
    return invalidCalibration(
      "invalid-bounds",
      "Drawable bounds require finite positive width and height and finite origins.",
    );
  }
  if (!Array.isArray(input.points)) {
    return invalidCalibration(
      "invalid-points",
      "Manual calibration requires an array of screenshot pixel points.",
    );
  }
  if (input.points.length < 3) {
    return invalidCalibration(
      "too-few-points",
      "Manual calibration requires at least three points.",
    );
  }

  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;
  const normalizedPoints: NormalizedPoint[] = [];
  for (const point of input.points) {
    if (
      !isRecord(point) ||
      !isFiniteNumber(point.x) ||
      !isFiniteNumber(point.y)
    ) {
      return invalidCalibration(
        "invalid-point",
        "Every calibration point must have finite x and y coordinates.",
      );
    }
    if (
      point.x < bounds.left ||
      point.x > right ||
      point.y < bounds.top ||
      point.y > bottom
    ) {
      return invalidCalibration(
        "out-of-bounds",
        "Every calibration point must be inside the exact drawable bounds.",
      );
    }
    const normalizedPoint = {
      x: (point.x - bounds.left) / bounds.width,
      y: (point.y - bounds.top) / bounds.height,
    };
    if (
      !isNormalizedCoordinate(normalizedPoint.x) ||
      !isNormalizedCoordinate(normalizedPoint.y)
    ) {
      return invalidCalibration(
        "invalid-point",
        "Point normalization must produce finite coordinates in [0, 1].",
      );
    }
    normalizedPoints.push(normalizedPoint);
  }

  for (let first = 0; first < input.points.length - 1; first += 1) {
    for (let second = first + 1; second < input.points.length; second += 1) {
      const firstPoint = input.points[first];
      const secondPoint = input.points[second];
      if (
        firstPoint.x === secondPoint.x &&
        firstPoint.y === secondPoint.y
      ) {
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
    normalizedPoints.map((point) => ({ x: point.x, y: point.y })),
  ) as readonly NormalizedPoint[];
  const screenshot = deepFreeze({
    hash: input.screenshotHash,
    profile: input.profile,
  });
  const sourceProvenance = provenance(
    "manual-calibration",
    "calibrated",
    input.sourceNote,
    screenshot,
  );
  const entry = deepFreeze({
    id: input.stableId,
    label: `Manual calibration ${input.stableId}`,
    context: input.context,
    coordinateSpace: KEEP_OUT_COORDINATE_SPACE,
    provenance: sourceProvenance,
    notes: [input.sourceNote],
    kind: "polygon",
    geometry: {
      kind: "polygon",
      points: frozenPoints,
    },
  }) as PolygonKeepOut;

  return deepFreeze({ status: "success", entry });
}

/** Alias emphasizing that calibration is a new immutable keep-out value. */
export const createCalibratedKeepOut = calibrateKeepOutPolygon;
