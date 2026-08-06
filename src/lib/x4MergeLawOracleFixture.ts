import { buildContentXml } from "./extensionProject";
import {
  X4_MERGE_ORACLE_CASE_IDS,
  X4_MERGE_ORACLE_SCHEMA_VERSION,
  buildX4MergeFixtureManifest,
  deriveX4MergeOracleFixtureHash,
  encodeX4MergeOracleMarker,
  validateX4MergeIdentifier,
  type X4MergeOracleCaseId,
  type X4MergeOracleCaseMarker,
  type X4MergeOracleEndMarker,
  type X4MergeOracleFixtureIdentityInput,
  type X4MergeOracleManifestInput,
  type X4MergeOracleSha256,
  type X4MergeOracleSignedManifest,
  type X4MergeOracleStartMarker,
} from "./x4MergeLawOracle";

export const X4_MERGE_LAW_ORACLE_RUN_ID_MAX_BYTES = 48 as const;
export const X4_MERGE_LAW_ORACLE_DEFAULT_TARGET_GAME_VERSION = "9.00" as const;
export const X4_MERGE_LAW_ORACLE_DEFAULT_TARGET_BUILD_ID = "9.00" as const;
export const X4_MERGE_LAW_ORACLE_TARGET_MD_PATH = "md/setup.xml" as const;

const X4_MERGE_LAW_ORACLE_RUN_ID_PATTERN = /^[A-Za-z0-9_]+$/u;

export interface X4MergeLawOracleFixtureInput {
  readonly runId: string;
  readonly targetGameVersion?: string;
  readonly targetBuildId?: string;
}

interface X4MergeLawOracleFixtureNames {
  readonly rootCue: string;
  readonly cardinalityOne: string;
  readonly cardinalityTwo: string;
  readonly addAnchor: string;
  readonly addValue: string;
  readonly replaceValue: string;
  readonly removeTarget: string;
  readonly attributeValue: string;
  readonly ifPresent: string;
  readonly ifAbsent: string;
  readonly posState: string;
  readonly posAnchor: string;
  readonly posBeforeSeen: string;
  readonly posAfterSeen: string;
  readonly nestedOuter: string;
  readonly nestedValue: string;
  readonly missingCue: string;
  readonly silentProbeToken: string;
  readonly controlProbeToken: string;
}

export interface X4MergeLawOracleProbeTokens {
  readonly silentProbeToken: string;
  readonly controlProbeToken: string;
}

interface X4MergeLawOracleMarkerSet {
  readonly start: string;
  readonly pass: ReadonlyMap<X4MergeOracleCaseId, string>;
  readonly fail: ReadonlyMap<X4MergeOracleCaseId, string>;
  readonly end: string;
}

interface X4MergeLawOracleCaseDetail {
  readonly pass: string;
  readonly fail: string;
}

const CASE_DETAILS: Readonly<Record<X4MergeOracleCaseId, X4MergeLawOracleCaseDetail>> = {
  selector_cardinality: {
    pass: "ambiguous selector was ignored and base values remained unchanged",
    fail: "ambiguous selector mutated or partially changed base values",
  },
  add: {
    pass: "add final variable matched",
    fail: "add final variable did not match",
  },
  replace: {
    pass: "replace final action matched",
    fail: "replace final action did not match",
  },
  remove: {
    pass: "remove left the intended assignment absent",
    fail: "remove did not leave the intended assignment absent",
  },
  attribute: {
    pass: "attribute replacement changed the intended attribute",
    fail: "attribute replacement did not change the intended attribute",
  },
  if: {
    pass: "if present predicate applied and absent predicate stayed inactive",
    fail: "if predicate result did not match",
  },
  silent: {
    pass: "silent missing-selector probe staged; external bounded log probe is required",
    fail: "silent missing-selector probe staged; external bounded log probe is required",
  },
  pos: {
    pass: "pos order before-anchor-after matched",
    fail: "pos order before-anchor-after did not match",
  },
  dependency_nested: {
    pass: "nested dependency patch reached the top value",
    fail: "nested dependency patch did not reach the top value",
  },
};

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validateRunId(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("runId must be a conservative X4 folder/content identifier.");
  }

  if (
    value.length === 0
    || value.trim() !== value
    || !X4_MERGE_LAW_ORACLE_RUN_ID_PATTERN.test(value)
  ) {
    throw new TypeError(
      "runId must contain only ASCII letters, digits, and underscores with no surrounding whitespace.",
    );
  }

  if (utf8ByteLength(value) > X4_MERGE_LAW_ORACLE_RUN_ID_MAX_BYTES) {
    throw new RangeError("runId exceeds the generator byte bound.");
  }

  return value;
}

function validateTargetIdentifier(
  value: unknown,
  label: string,
  fallback: string,
): string {
  const candidate = value === undefined ? fallback : value;
  return validateX4MergeIdentifier(candidate, label);
}

function xmlEscapeAttribute(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

function mdStringLiteral(value: string): string {
  return "'" + value.replace(/'/gu, "''") + "'";
}

function xmlMdStringExpression(value: string): string {
  return xmlEscapeAttribute(mdStringLiteral(value));
}

function xpathLiteral(value: string): string {
  if (value.includes("'")) {
    throw new TypeError("Generated X4 XPath identifiers cannot contain apostrophes.");
  }

  return "'" + value + "'";
}

function markerDebugAction(encodedMarker: string): string {
  return (
    '<debug_text text="'
    + xmlEscapeAttribute(mdStringLiteral(encodedMarker))
    + '" filter="general" />'
  );
}

function markerBranch(
  condition: string,
  passMarker: string,
  failMarker: string,
): string[] {
  return [
    '        <do_if value="' + xmlEscapeAttribute(condition) + '">',
    "          " + markerDebugAction(passMarker),
    "        </do_if>",
    "        <do_else>",
    "          " + markerDebugAction(failMarker),
    "        </do_else>",
  ];
}

function makeNames(runId: string): X4MergeLawOracleFixtureNames {
  const suffix = "_" + runId;
  const variable = (name: string): string => "$X4ForgeMerge" + name + suffix;
  const probeTokens = deriveX4MergeLawOracleProbeTokens(runId);

  return {
    rootCue: "X4ForgeMergeOracle_OnLoad" + suffix,
    cardinalityOne: variable("CardinalityOne"),
    cardinalityTwo: variable("CardinalityTwo"),
    addAnchor: variable("AddAnchor"),
    addValue: variable("AddValue"),
    replaceValue: variable("ReplaceValue"),
    removeTarget: variable("RemoveTarget"),
    attributeValue: variable("AttributeValue"),
    ifPresent: variable("IfPresent"),
    ifAbsent: variable("IfAbsent"),
    posState: variable("PosState"),
    posAnchor: variable("PosAnchor"),
    posBeforeSeen: variable("PosBeforeSeen"),
    posAfterSeen: variable("PosAfterSeen"),
    nestedOuter: variable("NestedOuter"),
    nestedValue: variable("NestedValue"),
    missingCue: "X4ForgeMergeOracle_Missing_" + runId,
    silentProbeToken: probeTokens.silentProbeToken,
    controlProbeToken: probeTokens.controlProbeToken,
  };
}

export function deriveX4MergeLawOracleProbeTokens(
  runId: unknown,
): X4MergeLawOracleProbeTokens {
  const validatedRunId = validateRunId(runId);
  return Object.freeze({
    silentProbeToken: "X4FORGE_MERGE_ORACLE_SILENT_MISSING_SELECTOR_" + validatedRunId,
    controlProbeToken: "X4FORGE_MERGE_ORACLE_CONTROL_MISSING_SELECTOR_" + validatedRunId,
  });
}

function makeMarkerSet(
  runId: string,
  fixtureHash: string,
  targetGameVersion: string,
  targetBuildId: string,
): X4MergeLawOracleMarkerSet {
  const startMarker: X4MergeOracleStartMarker = {
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "start",
    runId,
    fixtureHash,
    targetGameVersion,
    targetBuildId,
  };
  const endMarker: X4MergeOracleEndMarker = {
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "end",
    runId,
    fixtureHash,
  };
  const passMarkers = new Map<X4MergeOracleCaseId, string>();
  const failMarkers = new Map<X4MergeOracleCaseId, string>();

  for (const caseId of X4_MERGE_ORACLE_CASE_IDS) {
    const details = CASE_DETAILS[caseId];
    const passMarker: X4MergeOracleCaseMarker = {
      schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
      kind: "case",
      runId,
      fixtureHash,
      caseId,
      observation: "pass",
      detail: details.pass,
    };
    const failMarker: X4MergeOracleCaseMarker = {
      schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
      kind: "case",
      runId,
      fixtureHash,
      caseId,
      observation: "fail",
      detail: details.fail,
    };
    passMarkers.set(caseId, encodeX4MergeOracleMarker(passMarker));
    failMarkers.set(caseId, encodeX4MergeOracleMarker(failMarker));
  }

  return Object.freeze({
    start: encodeX4MergeOracleMarker(startMarker),
    pass: passMarkers,
    fail: failMarkers,
    end: encodeX4MergeOracleMarker(endMarker),
  });
}

function caseCondition(
  caseId: X4MergeOracleCaseId,
  names: X4MergeLawOracleFixtureNames,
): string {
  switch (caseId) {
    case "selector_cardinality":
      return (
        names.cardinalityOne
        + " == 'base-one' and "
        + names.cardinalityTwo
        + " == 'base-two'"
      );
    case "add":
      return names.addValue + " == 'add-hit'";
    case "replace":
      return names.replaceValue + " == 'replace-hit'";
    case "remove":
      return "not " + names.removeTarget + "?";
    case "attribute":
      return names.attributeValue + " == 'attribute-hit'";
    case "if":
      return names.ifPresent + " == 'if-present-hit' and not " + names.ifAbsent + "?";
    case "silent":
      return "1";
    case "pos":
      return (
        names.posBeforeSeen
        + " == 'before' and "
        + names.posAfterSeen
        + " == 'after' and "
        + names.posState
        + " == 'after'"
      );
    case "dependency_nested":
      return names.nestedValue + " == 'top-hit'";
  }
}

function buildBaseMd(
  names: X4MergeLawOracleFixtureNames,
  markers: X4MergeLawOracleMarkerSet,
): string {
  const rootCuePathName = xmlEscapeAttribute(names.rootCue);
  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<diff xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="diff.xsd">',
    '  <add sel="/mdscript/cues">',
    '    <cue name="' + rootCuePathName + '" namespace="this">',
    "      <conditions>",
    "        <event_game_loaded />",
    "      </conditions>",
    "      <actions>",
    "        <do_all>",
    '          <set_value name="' + xmlEscapeAttribute(names.cardinalityOne) + '" exact="' + xmlMdStringExpression("base-one") + '" />',
    '          <set_value name="' + xmlEscapeAttribute(names.cardinalityTwo) + '" exact="' + xmlMdStringExpression("base-two") + '" />',
    '          <set_value name="' + xmlEscapeAttribute(names.replaceValue) + '" exact="' + xmlMdStringExpression("base-replace") + '" />',
    '          <set_value name="' + xmlEscapeAttribute(names.removeTarget) + '" exact="' + xmlMdStringExpression("remove-target") + '" />',
    '          <set_value name="' + xmlEscapeAttribute(names.attributeValue) + '" exact="' + xmlMdStringExpression("base-attribute") + '" />',
    '          <set_value name="' + xmlEscapeAttribute(names.posState) + '" exact="' + xmlMdStringExpression("") + '" />',
    "        </do_all>",
        "        <do_all>",
    '          <set_value name="' + xmlEscapeAttribute(names.addAnchor) + '" exact="' + xmlMdStringExpression("add-anchor") + '" />',
    "        </do_all>",
        "        <do_all>",
    '          <set_value name="' + xmlEscapeAttribute(names.posAnchor) + '" exact="' + xmlMdStringExpression("pos-anchor") + '" />',
    '          <set_value name="' + xmlEscapeAttribute(names.posState) + '" exact="' + xmlMdStringExpression("anchor") + '" />',
    "        </do_all>",
        "        <do_all>",
    '          <set_value name="' + xmlEscapeAttribute(names.nestedOuter) + '" exact="' + xmlMdStringExpression("nested-outer") + '" />',
    "        </do_all>",
    "        " + markerDebugAction(markers.start),
  ];

  for (const caseId of X4_MERGE_ORACLE_CASE_IDS) {
    const passMarker = markers.pass.get(caseId);
    const failMarker = markers.fail.get(caseId);
    if (passMarker === undefined || failMarker === undefined) {
      throw new TypeError("Every canonical X4 merge case must have two marker sources.");
    }

    lines.push(
      ...markerBranch(caseCondition(caseId, names), passMarker, failMarker),
    );
  }

  lines.push(
    "        " + markerDebugAction(markers.end),
    "      </actions>",
    "    </cue>",
    "  </add>",
    "</diff>",
    "",
  );
  return lines.join("\n");
}

function buildMiddleDiff(
  names: X4MergeLawOracleFixtureNames,
): string {
  const rootPath = "/mdscript/cues/cue[@name=" + xpathLiteral(names.rootCue) + "]";
  const actionsPath = rootPath + "/actions";
  const setupSelector =
    actionsPath + "/do_all[set_value[@name=" + xpathLiteral(names.cardinalityOne) + "]]";
  const addSelector =
    actionsPath + "/do_all[set_value[@name=" + xpathLiteral(names.addAnchor) + "]]";
  const posSelector =
    actionsPath + "/do_all[set_value[@name=" + xpathLiteral(names.posAnchor) + "]]";
  const nestedSelector =
    actionsPath + "/do_all[set_value[@name=" + xpathLiteral(names.nestedOuter) + "]]";
  const cardinalitySelector =
    setupSelector
    + "/set_value[@name="
    + xpathLiteral(names.cardinalityOne)
    + " or @name="
    + xpathLiteral(names.cardinalityTwo)
    + "]/@exact";
  const replaceSelector =
    setupSelector + "/set_value[@name=" + xpathLiteral(names.replaceValue) + "]";
  const removeSelector =
    setupSelector + "/set_value[@name=" + xpathLiteral(names.removeTarget) + "]";
  const attributeSelector =
    setupSelector + "/set_value[@name=" + xpathLiteral(names.attributeValue) + "]/@exact";
  const presentPredicate = rootPath;
  const absentPredicate =
    rootPath + "/cues/cue[@name=" + xpathLiteral(names.missingCue) + "]";

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<diff xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="diff.xsd">',
    '  <replace sel="' + xmlEscapeAttribute(cardinalitySelector) + '">' + xmlMdStringExpression("cardinality-hit") + "</replace>",
    '  <replace sel="' + xmlEscapeAttribute(replaceSelector) + '">',
    '    <set_value name="' + xmlEscapeAttribute(names.replaceValue) + '" exact="' + xmlMdStringExpression("replace-hit") + '" />',
    "  </replace>",
    '  <remove sel="' + xmlEscapeAttribute(removeSelector) + '" />',
    '  <replace sel="' + xmlEscapeAttribute(attributeSelector) + '">' + xmlMdStringExpression("attribute-hit") + "</replace>",
    '  <add sel="' + xmlEscapeAttribute(addSelector) + '">',
    '    <set_value name="' + xmlEscapeAttribute(names.addValue) + '" exact="' + xmlMdStringExpression("add-hit") + '" />',
    "  </add>",
    '  <add sel="' + xmlEscapeAttribute(setupSelector) + '" if="' + xmlEscapeAttribute(presentPredicate) + '">',
    '    <set_value name="' + xmlEscapeAttribute(names.ifPresent) + '" exact="' + xmlMdStringExpression("if-present-hit") + '" />',
    "  </add>",
    '  <add sel="' + xmlEscapeAttribute(setupSelector) + '" if="' + xmlEscapeAttribute(absentPredicate) + '" silent="true">',
    '    <set_value name="' + xmlEscapeAttribute(names.ifAbsent) + '" exact="' + xmlMdStringExpression("if-absent-unexpected") + '" />',
    "  </add>",
    '  <add sel="' + xmlEscapeAttribute(posSelector) + '" pos="before">',
    "    <do_all>",
    '      <set_value name="' + xmlEscapeAttribute(names.posBeforeSeen) + '" exact="' + xmlMdStringExpression("before") + '" />',
    '      <set_value name="' + xmlEscapeAttribute(names.posState) + '" exact="' + xmlMdStringExpression("before") + '" />',
    "    </do_all>",
    "  </add>",
    '  <add sel="' + xmlEscapeAttribute(posSelector) + '" pos="after">',
    "    <do_all>",
    '      <do_if value="' + xmlEscapeAttribute(names.posState + " == 'anchor'") + '">',
    '        <set_value name="' + xmlEscapeAttribute(names.posAfterSeen) + '" exact="' + xmlMdStringExpression("after") + '" />',
    "      </do_if>",
    '      <set_value name="' + xmlEscapeAttribute(names.posState) + '" exact="' + xmlMdStringExpression("after") + '" />',
    "    </do_all>",
    "  </add>",
    '  <add sel="' + xmlEscapeAttribute(nestedSelector) + '">',
    '    <set_value name="' + xmlEscapeAttribute(names.nestedValue) + '" exact="' + xmlMdStringExpression("middle-hit") + '" />',
    "  </add>",
    "</diff>",
    "",
  ].join("\n");
}

function buildTopDiff(
  names: X4MergeLawOracleFixtureNames,
): string {
  const rootPath = "/mdscript/cues/cue[@name=" + xpathLiteral(names.rootCue) + "]";
  const actionsPath = rootPath + "/actions";
  const nestedSelector =
    actionsPath + "/do_all[set_value[@name=" + xpathLiteral(names.nestedOuter) + "]]";
  const introducedNodeSelector =
    nestedSelector + "/set_value[@name=" + xpathLiteral(names.nestedValue) + "]";
  const silentProbeSelector =
    "/mdscript/cues/cue[@name=" + xpathLiteral(names.silentProbeToken) + "]";
  const controlProbeSelector =
    "/mdscript/cues/cue[@name=" + xpathLiteral(names.controlProbeToken) + "]";

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<diff xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="diff.xsd">',
    '  <replace sel="' + xmlEscapeAttribute(introducedNodeSelector) + '">',
    '    <set_value name="' + xmlEscapeAttribute(names.nestedValue) + '" exact="' + xmlMdStringExpression("top-hit") + '" />',
    "  </replace>",
    '  <remove sel="' + xmlEscapeAttribute(silentProbeSelector) + '" silent="1" />',
    '  <remove sel="' + xmlEscapeAttribute(controlProbeSelector) + '" />',
    "</diff>",
    "",
  ].join("\n");
}

function extensionId(runId: string, layer: "base" | "middle" | "top"): string {
  return "x4forge_merge_oracle_" + runId + "_" + layer;
}

function contentXml(
  id: string,
  name: string,
  dependencyId: string | undefined,
): string {
  return buildContentXml({
    id,
    name,
    version: "1.0.0",
    author: "X4 Forge",
    description: "Deterministic X4 merge-law oracle fixture",
    deps: dependencyId === undefined ? [] : [{ id: dependencyId, optional: false }],
  });
}

export function buildX4MergeLawOracleFixture(
  input: X4MergeLawOracleFixtureInput,
  sha256Provider: X4MergeOracleSha256,
): X4MergeOracleSignedManifest {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("X4 merge-law fixture input must be an object.");
  }

  const runId = validateRunId(input.runId);
  const targetGameVersion = validateTargetIdentifier(
    input.targetGameVersion,
    "targetGameVersion",
    X4_MERGE_LAW_ORACLE_DEFAULT_TARGET_GAME_VERSION,
  );
  const targetBuildId = validateTargetIdentifier(
    input.targetBuildId,
    "targetBuildId",
    X4_MERGE_LAW_ORACLE_DEFAULT_TARGET_BUILD_ID,
  );

  const baseExtensionId = extensionId(runId, "base");
  const middleExtensionId = extensionId(runId, "middle");
  const topExtensionId = extensionId(runId, "top");
  const dependencyOrder = [baseExtensionId, middleExtensionId, topExtensionId];
  const cases = X4_MERGE_ORACLE_CASE_IDS.map((caseId) => ({
    caseId,
    expectedObservation: caseId === "silent" ? "pending" as const : "pass" as const,
  }));
  const identity: X4MergeOracleFixtureIdentityInput = {
    fixtureVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    runId,
    targetGameVersion,
    targetBuildId,
    dependencyOrder,
    cases,
  };
  const fixtureHash = deriveX4MergeOracleFixtureHash(identity, sha256Provider);
  const names = makeNames(runId);
  const markers = makeMarkerSet(runId, fixtureHash, targetGameVersion, targetBuildId);
  const files: X4MergeOracleManifestInput["files"] = [
    {
      normalizedRelativePath: baseExtensionId + "/content.xml",
      utf8Content: contentXml(
        baseExtensionId,
        "X4 Forge Merge Oracle Base",
        undefined,
      ),
    },
    {
      normalizedRelativePath: baseExtensionId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH,
      utf8Content: buildBaseMd(names, markers),
    },
    {
      normalizedRelativePath: middleExtensionId + "/content.xml",
      utf8Content: contentXml(
        middleExtensionId,
        "X4 Forge Merge Oracle Middle",
        baseExtensionId,
      ),
    },
    {
      normalizedRelativePath: middleExtensionId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH,
      utf8Content: buildMiddleDiff(names),
    },
    {
      normalizedRelativePath: topExtensionId + "/content.xml",
      utf8Content: contentXml(
        topExtensionId,
        "X4 Forge Merge Oracle Top",
        middleExtensionId,
      ),
    },
    {
      normalizedRelativePath: topExtensionId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH,
      utf8Content: buildTopDiff(names),
    },
  ];
  const manifest = buildX4MergeFixtureManifest(
    {
      fixtureVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
      runId,
      targetGameVersion,
      targetBuildId,
      dependencyOrder,
      files,
      cases,
    },
    sha256Provider,
  );

  if (manifest.fixtureHash !== fixtureHash) {
    throw new TypeError("Generated fixture hash changed after identity binding.");
  }
  if (manifest.fixtureHash === manifest.manifestSha256) {
    throw new TypeError("Fixture hash and manifest hash must remain distinct.");
  }
  if (manifest.files.some((file) => file.utf8Content.includes(manifest.manifestSha256))) {
    throw new TypeError("Fixture bytes must not contain the manifest hash.");
  }

  return manifest;
}
