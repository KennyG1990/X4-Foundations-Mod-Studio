import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  X4_MERGE_ORACLE_CASE_IDS,
  X4_MERGE_ORACLE_MARKER_PREFIX,
  X4_MERGE_ORACLE_SCHEMA_VERSION,
  canonicalX4MergeJson,
  deriveX4MergeOracleFixtureHash,
  encodeX4MergeOracleMarker,
  verifyX4MergeFixtureManifest,
  type X4MergeOracleCaseId,
  type X4MergeOracleFixtureIdentityInput,
  type X4MergeOracleSignedManifest,
} from "../src/lib/x4MergeLawOracle";
import {
  X4_MERGE_LAW_ORACLE_RUN_ID_MAX_BYTES,
  X4_MERGE_LAW_ORACLE_TARGET_MD_PATH,
  buildX4MergeLawOracleFixture,
} from "../src/lib/x4MergeLawOracleFixture";

interface NamedCase {
  readonly name: string;
  readonly run: () => void;
}

interface MutableManifest {
  readonly files: Array<{
    normalizedRelativePath: string;
    utf8Content: string;
    sha256: string;
  }>;
}

const namedCases: NamedCase[] = [];
let assertionCount = 0;

function test(name: string, run: () => void): void {
  namedCases.push({ name, run });
}

function expectOk(value: unknown, message: string): asserts value {
  assertionCount += 1;
  assert.ok(value, message);
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  assertionCount += 1;
  assert.equal(actual, expected, message);
}

function expectDeepEqual(actual: unknown, expected: unknown, message: string): void {
  assertionCount += 1;
  assert.deepEqual(actual, expected, message);
}

function expectThrows(run: () => unknown, message: string): void {
  assertionCount += 1;
  assert.throws(run, undefined, message);
}

function sha256(utf8: string): string {
  return createHash("sha256").update(utf8, "utf8").digest("hex");
}

const runId = "fixture_selftest_01";
const baseId = "x4forge_merge_oracle_" + runId + "_base";
const middleId = "x4forge_merge_oracle_" + runId + "_middle";
const topId = "x4forge_merge_oracle_" + runId + "_top";
const dependencyOrder = [baseId, middleId, topId];
const retiredMdPath = "md/x4forge_merge_oracle.xml";

function buildFixture(): X4MergeOracleSignedManifest {
  return buildX4MergeLawOracleFixture(
    {
      runId,
      targetGameVersion: "9.00",
      targetBuildId: "fixture-build-900",
    },
    sha256,
  );
}

function getFile(manifest: X4MergeOracleSignedManifest, path: string): string {
  const file = manifest.files.find((candidate) => candidate.normalizedRelativePath === path);
  if (file === undefined) {
    throw new Error("Missing fixture file: " + path);
  }
  return file.utf8Content;
}

function decodeXmlAttribute(value: string): string {
  return value
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&gt;/gu, ">")
    .replace(/&lt;/gu, "<")
    .replace(/&amp;/gu, "&");
}

function extractMarkerSources(md: string): string[] {
  const sources: string[] = [];
  const attributePattern = /<debug_text text="([^"]+)" filter="general" \/>/gu;
  for (const match of md.matchAll(attributePattern)) {
    const decodedAttribute = decodeXmlAttribute(match[1]);
    if (
      decodedAttribute.startsWith("'")
      && decodedAttribute.endsWith("'")
    ) {
      const marker = decodedAttribute.slice(1, -1);
      if (marker.startsWith(X4_MERGE_ORACLE_MARKER_PREFIX)) {
        sources.push(marker);
      }
    }
  }
  return sources;
}

function marker(
  manifest: X4MergeOracleSignedManifest,
  caseId: X4MergeOracleCaseId,
  observation: "pass" | "fail",
  detail: string,
): string {
  return encodeX4MergeOracleMarker({
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "case",
    runId: manifest.runId,
    fixtureHash: manifest.fixtureHash,
    caseId,
    observation,
    detail,
  });
}

function contentDependencies(content: string): string[] {
  const dependencies: string[] = [];
  const dependencyPattern = /<dependency id="([^"]+)" \/>/gu;
  for (const match of content.matchAll(dependencyPattern)) {
    dependencies.push(match[1]);
  }
  return dependencies;
}

function variable(name: string): string {
  return "$X4ForgeMerge" + name + "_" + runId;
}

function decodedExactStringAttribute(value: string): string {
  return 'exact="' + "'" + value + "'" + '"';
}

test("deterministic signed output and identity-first hash binding", () => {
  const first = buildFixture();
  const second = buildFixture();

  expectEqual(
    canonicalX4MergeJson(first),
    canonicalX4MergeJson(second),
    "repeated valid input must produce a byte-identical signed manifest",
  );
  expectDeepEqual(
    first.files.map((file) => [file.normalizedRelativePath, file.utf8Content]),
    second.files.map((file) => [file.normalizedRelativePath, file.utf8Content]),
    "repeated valid input must produce byte-identical fixture files",
  );

  const identity: X4MergeOracleFixtureIdentityInput = {
    fixtureVersion: first.fixtureVersion,
    runId: first.runId,
    targetGameVersion: first.targetGameVersion,
    targetBuildId: first.targetBuildId,
    dependencyOrder: [...first.dependencyOrder],
    cases: first.cases.map((expectation) => ({
      caseId: expectation.caseId,
      expectedObservation: expectation.expectedObservation,
    })),
  };
  expectEqual(
    first.fixtureHash,
    deriveX4MergeOracleFixtureHash(identity, sha256),
    "fixtureHash must be derived from the strict identity",
  );
  expectOk(
    first.fixtureHash !== first.manifestSha256,
    "fixtureHash must differ from manifestSha256",
  );
  const verification = verifyX4MergeFixtureManifest(first, sha256);
  expectEqual(verification.ok, true, "generated signed manifest must verify");
});

test("exact paths, dependency chain, file kinds, and canonical cases", () => {
  const manifest = buildFixture();
  expectDeepEqual(
    manifest.dependencyOrder,
    dependencyOrder,
    "dependencyOrder must be base, middle, top",
  );
  expectEqual(manifest.files.length, 6, "fixture must contain exactly six files");

  const declared = new Set(dependencyOrder);
  const paths = manifest.files.map((file) => file.normalizedRelativePath);
  const expectedPaths = dependencyOrder
    .flatMap((extensionId) => [
      extensionId + "/content.xml",
      extensionId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH,
    ])
    .sort();
  expectDeepEqual(
    paths,
    [...paths].sort(),
    "signed manifest files must be in canonical path order",
  );
  expectDeepEqual(
    paths,
    expectedPaths,
    "signed manifest must contain exactly content.xml and md/setup.xml per extension",
  );
  expectOk(
    !paths.some((path) => path.endsWith("/" + retiredMdPath)),
    "retired md/x4forge_merge_oracle.xml layout must be absent",
  );
  for (const path of paths) {
    const segments = path.split("/");
    expectOk(!path.startsWith("/") && !path.includes("\\") && !path.includes(":"), "path must be relative");
    expectOk(!segments.includes(".") && !segments.includes(".."), "path must not contain traversal segments");
    expectEqual(
      segments.filter((segment) => declared.has(segment)).length,
      1,
      "path must have exactly one declared extension top segment",
    );
  }
  for (const extensionId of dependencyOrder) {
    expectOk(
      paths.includes(extensionId + "/content.xml"),
      "each extension must contain content.xml",
    );
    expectOk(
      paths.includes(extensionId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH),
      "each extension must contain the vanilla setup MD path",
    );
  }

  const baseContent = getFile(manifest, baseId + "/content.xml");
  const middleContent = getFile(manifest, middleId + "/content.xml");
  const topContent = getFile(manifest, topId + "/content.xml");
  expectEqual(contentDependencies(baseContent).length, 0, "base must have no dependency");
  expectDeepEqual(
    contentDependencies(middleContent),
    [baseId],
    "middle content.xml must depend on base",
  );
  expectDeepEqual(
    contentDependencies(topContent),
    [middleId],
    "top content.xml must depend on middle",
  );

  const baseMd = getFile(manifest, baseId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH);
  const middleMd = getFile(manifest, middleId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH);
  const topMd = getFile(manifest, topId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH);
  for (const [layer, md] of [["base", baseMd], ["middle", middleMd], ["top", topMd]] as const) {
    expectOk(/^\s*<\?xml\b[\s\S]*<diff\b[\s\S]*<\/diff>\s*$/u.test(md), `${layer} MD must be a complete diff document`);
  }
  expectOk(!baseMd.includes("<mdscript "), "base MD must not be a standalone mdscript");
  expectOk(baseMd.includes('<add sel="/mdscript/cues">'), "base MD must add its cue to vanilla /mdscript/cues");
  expectEqual((baseMd.match(/<cue\b/gu) ?? []).length, 1, "base diff must add exactly one run-scoped cue");
  expectOk(baseMd.includes("<event_game_loaded />"), "base MD must use event_game_loaded");
  expectOk(
    !baseMd.includes("keep="),
    "base generated MD must not emit an unsupported keep attribute",
  );
  expectOk(
    baseMd.includes(
      '<set_value name="' + variable("AttributeValue") + '" exact="&apos;base-attribute&apos;" />',
    ),
    "attribute case must retain the base set_value with only its exact value",
  );
  expectOk(middleMd.includes("<diff "), "middle MD must be a diff patch");
  expectOk(topMd.includes("<diff "), "top MD must be a diff patch");
  expectOk(
    topMd.includes(variable("NestedValue")),
    "top must target the nested value",
  );
  expectOk(
    !baseMd.includes('<set_value name="' + variable("NestedValue") + '"'),
    "nested value node must not exist in base",
  );

  expectDeepEqual(
    manifest.cases.map((expectation) => expectation.caseId),
    [...X4_MERGE_ORACLE_CASE_IDS],
    "manifest cases must contain each canonical case exactly once",
  );
  for (const expectation of manifest.cases) {
    expectEqual(
      expectation.expectedObservation,
      expectation.caseId === "silent" ? "pending" : "pass",
      "silent is pending and all other fixture cases are pass",
    );
  }
});

test("marker source identity, order, XML escaping, and non-circular binding", () => {
  const manifest = buildFixture();
  const baseMd = getFile(manifest, baseId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH);
  const sources = extractMarkerSources(baseMd);
  expectEqual(
    sources.length,
    X4_MERGE_ORACLE_CASE_IDS.length * 2 + 2,
    "each case must have one static pass and one static fail source plus start/end",
  );

  const startMarker = encodeX4MergeOracleMarker({
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "start",
    runId: manifest.runId,
    fixtureHash: manifest.fixtureHash,
    targetGameVersion: manifest.targetGameVersion,
    targetBuildId: manifest.targetBuildId,
  });
  const endMarker = encodeX4MergeOracleMarker({
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "end",
    runId: manifest.runId,
    fixtureHash: manifest.fixtureHash,
  });
  expectEqual(sources[0], startMarker, "start marker source must bind current identity");
  expectEqual(
    sources[sources.length - 1],
    endMarker,
    "end marker source must bind current identity",
  );

  const expectedDetails: Readonly<Record<X4MergeOracleCaseId, string>> = {
    selector_cardinality: "ambiguous selector was ignored and base values remained unchanged",
    add: "add final variable matched",
    replace: "replace final action matched",
    remove: "remove left the intended assignment absent",
    attribute: "attribute replacement changed the intended attribute",
    if: "if present predicate applied and absent predicate stayed inactive",
    silent: "silent missing-selector probe staged; external bounded log probe is required",
    pos: "pos order before-anchor-after matched",
    dependency_nested: "nested dependency patch reached the top value",
  };
  const expectedFailDetails: Readonly<Record<X4MergeOracleCaseId, string>> = {
    selector_cardinality: "ambiguous selector mutated or partially changed base values",
    add: "add final variable did not match",
    replace: "replace final action did not match",
    remove: "remove did not leave the intended assignment absent",
    attribute: "attribute replacement did not change the intended attribute",
    if: "if predicate result did not match",
    silent: "silent missing-selector probe staged; external bounded log probe is required",
    pos: "pos order before-anchor-after did not match",
    dependency_nested: "nested dependency patch did not reach the top value",
  };
  for (let index = 0; index < X4_MERGE_ORACLE_CASE_IDS.length; index += 1) {
    const caseId = X4_MERGE_ORACLE_CASE_IDS[index];
    const pass = marker(manifest, caseId, "pass", expectedDetails[caseId]);
    const fail = marker(manifest, caseId, "fail", expectedFailDetails[caseId]);
    expectEqual(
      sources[1 + index * 2],
      pass,
      "pass marker sources must remain in canonical case order",
    );
    expectEqual(
      sources[2 + index * 2],
      fail,
      "fail marker sources must remain paired with canonical cases",
    );
  }
  for (const file of manifest.files) {
    expectOk(
      !file.utf8Content.includes(manifest.manifestSha256),
      "fixture bytes must not contain manifestSha256",
    );
  }
  expectOk(
    baseMd.includes("&quot;fixtureHash&quot;:&quot;" + manifest.fixtureHash + "&quot;"),
    "XML attribute escaping must preserve the JSON marker fixture hash",
  );
  for (const source of sources) {
    expectOk(
      source.includes(manifest.runId) && source.includes(manifest.fixtureHash),
      "every marker source must bind the current runId and fixtureHash",
    );
  }
});

test("all nine merge-law operations have structural final-variable checks", () => {
  const manifest = buildFixture();
  const baseMd = getFile(manifest, baseId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH);
  const middleMd = getFile(manifest, middleId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH);
  const topMd = getFile(manifest, topId + "/" + X4_MERGE_LAW_ORACLE_TARGET_MD_PATH);
  const decodedBaseMd = decodeXmlAttribute(baseMd);
  const decodedMiddleMd = decodeXmlAttribute(middleMd);
  const decodedTopMd = decodeXmlAttribute(topMd);
  const decodedFixtureXml = [decodedBaseMd, decodedMiddleMd, decodedTopMd].join("\n");
  const cardOne = variable("CardinalityOne");
  const cardTwo = variable("CardinalityTwo");
  const addValue = variable("AddValue");
  const replaceValue = variable("ReplaceValue");
  const removeTarget = variable("RemoveTarget");
  const attributeValue = variable("AttributeValue");
  const ifPresent = variable("IfPresent");
  const ifAbsent = variable("IfAbsent");
  const nestedValue = variable("NestedValue");
  const posAnchor = variable("PosAnchor");
  const silentToken = "X4FORGE_MERGE_ORACLE_SILENT_MISSING_SELECTOR_" + runId;
  const controlToken = "X4FORGE_MERGE_ORACLE_CONTROL_MISSING_SELECTOR_" + runId;
  const intendedExactStringValues = [
    "base-one",
    "base-two",
    "base-replace",
    "remove-target",
    "base-attribute",
    "add-anchor",
    "pos-anchor",
    "anchor",
    "nested-outer",
    "replace-hit",
    "add-hit",
    "if-present-hit",
    "if-absent-unexpected",
    "before",
    "after",
    "middle-hit",
    "top-hit",
  ];

  for (const value of intendedExactStringValues) {
    expectOk(
      decodedFixtureXml.includes(decodedExactStringAttribute(value)),
      "string assignment must decode to a quoted MD expression: " + value,
    );
    expectOk(
      !decodedFixtureXml.includes('exact="' + value + '"'),
      "string assignment must not remain a bare token: " + value,
    );
  }
  expectOk(
    decodedBaseMd.includes(decodedExactStringAttribute("")),
    "empty string assignment must decode to the exact MD expression ''",
  );
  expectOk(
    !decodedFixtureXml.includes('exact=""'),
    "empty string assignment must not remain a bare empty attribute",
  );
  for (const value of ["cardinality-hit", "attribute-hit"]) {
    expectOk(
      decodedMiddleMd.includes(">'" + value + "'</replace>"),
      "attribute replacement text must decode to a quoted MD expression: " + value,
    );
    expectOk(
      !decodedMiddleMd.includes(">" + value + "</replace>"),
      "attribute replacement text must not remain a bare token: " + value,
    );
  }
  expectOk(
    decodedBaseMd.includes('<do_if value="not ' + removeTarget + '?">'),
    "remove case must use the optional local-existence expression",
  );
  expectOk(
    !decodedBaseMd.includes('<do_if value="not(' + removeTarget + ')">'),
    "remove case must not directly evaluate an undefined local",
  );
  expectOk(
    decodedBaseMd.includes('<do_if value="1">'),
    "numeric branch expressions must remain unquoted",
  );
  expectOk(
    decodedMiddleMd.includes(
      '<do_if value="' + variable("PosState") + " == 'anchor'" + '">',
    ),
    "variable branch expressions must remain unquoted",
  );

  expectOk(
    middleMd.includes(
      "@name=&apos;"
        + cardOne
        + "&apos; or @name=&apos;"
        + cardTwo
        + "&apos;]/@exact",
    ),
    "selector_cardinality must retain its deliberately ambiguous two-node selector",
  );
  expectOk(
    middleMd.includes("cardinality-hit"),
    "selector_cardinality must retain the attempted replacement value",
  );
  expectOk(
    decodedBaseMd.includes(
      '<do_if value="' + cardOne + " == 'base-one' and " + cardTwo + " == 'base-two'" + '">',
    ),
    "selector_cardinality PASS must require both original base values unchanged",
  );
  expectOk(middleMd.includes(addValue) && middleMd.includes("<add "), "add must insert a unique action");
  expectOk(
    middleMd.includes(replaceValue)
      && middleMd.includes("<replace ")
      && decodedMiddleMd.includes(decodedExactStringAttribute("replace-hit")),
    "replace must replace a whole intended action",
  );
  expectOk(
    middleMd.includes(removeTarget)
      && middleMd.includes("<remove ")
      && !middleMd.includes('exact="remove-target"'),
    "remove must target the unique intended assignment",
  );
  expectOk(
    middleMd.includes(attributeValue + "&apos;]/@exact"),
    "attribute must target only the exact attribute",
  );
  expectOk(
    decodedMiddleMd.includes(">'attribute-hit'</replace>"),
    "attribute must replace the targeted exact attribute value",
  );
  expectOk(
    middleMd.includes('if="/mdscript/cues/cue[@name=')
      && middleMd.includes(ifPresent)
      && middleMd.includes(ifAbsent),
    "if must contain present and absent predicate controls",
  );
  expectOk(
    decodedBaseMd.includes(
      '<do_if value="' + ifPresent + " == 'if-present-hit' and not " + ifAbsent + "?" + '">',
    ),
    "if case must check absence with the optional local-existence expression",
  );
  expectOk(
    !decodedBaseMd.includes(
      '<do_if value="' + ifPresent + " == 'if-present-hit' and not(" + ifAbsent + ")" + '">',
    ),
    "if case must not directly evaluate an undefined local",
  );
  expectOk(
    middleMd.includes('pos="before"')
      && middleMd.includes('pos="after"')
      && middleMd.includes(posAnchor),
    "pos must establish before-anchor-after around an anchor",
  );
  expectOk(
    middleMd.includes(nestedValue)
      && topMd.includes(nestedValue)
      && decodedTopMd.includes(decodedExactStringAttribute("top-hit")),
    "dependency_nested must patch the node introduced by middle",
  );

  const nestedReplaceIndex = decodedTopMd.indexOf(decodedExactStringAttribute("top-hit"));
  const silentIndex = decodedTopMd.indexOf(silentToken);
  const controlIndex = decodedTopMd.indexOf(controlToken);
  expectOk(nestedReplaceIndex >= 0 && nestedReplaceIndex < silentIndex, "silent probe must follow nested patch");
  expectOk(silentIndex >= 0 && silentIndex < controlIndex, "silent probe must precede control probe");
  const silentLine = topMd.split("\n").find((line) => line.includes(silentToken));
  const controlLine = topMd.split("\n").find((line) => line.includes(controlToken));
  expectOk(silentLine !== undefined && silentLine.includes('silent="1"'), "silent probe must use silent=1");
  expectOk(
    controlLine !== undefined && !controlLine.includes("silent="),
    "control probe must omit the silent attribute",
  );
  expectOk(
    !middleMd.includes(silentToken) && !middleMd.includes(controlToken),
    "missing-selector probes must be in the final top diff only",
  );
  expectEqual(
    manifest.cases.find((expectation) => expectation.caseId === "silent")?.expectedObservation,
    "pending",
    "silent engine behavior must remain pending",
  );
});

test("hostile run IDs fail closed before fixture output", () => {
  const hostileRunIds = [
    "bad/slash",
    "bad\\backslash",
    "bad:colon",
    ".",
    "..",
    "bad.dot",
    "bad'quote",
    "bad\"quote",
    "bad]xpath",
    "bad$expression",
    "bad&xml",
    "bad whitespace",
    "bad\tcontrol",
    "bad\ncontrol",
    "",
    "x".repeat(X4_MERGE_LAW_ORACLE_RUN_ID_MAX_BYTES + 1),
  ];
  for (const hostile of hostileRunIds) {
    expectThrows(
      () => buildX4MergeLawOracleFixture({ runId: hostile }, sha256),
      "hostile run ID must be rejected: " + JSON.stringify(hostile),
    );
  }
});

test("tamper rejection and returned aggregate freezing", () => {
  const manifest = buildFixture();
  expectOk(Object.isFrozen(manifest), "signed manifest must be frozen");
  expectOk(Object.isFrozen(manifest.dependencyOrder), "dependencyOrder must be frozen");
  expectOk(Object.isFrozen(manifest.files), "files must be frozen");
  expectOk(manifest.files.every((file) => Object.isFrozen(file)), "fixture files must be frozen");
  expectOk(Object.isFrozen(manifest.cases), "cases must be frozen");
  expectOk(manifest.cases.every((expectation) => Object.isFrozen(expectation)), "case expectations must be frozen");

  const tampered = JSON.parse(canonicalX4MergeJson(manifest)) as MutableManifest;
  tampered.files[0].utf8Content += "tampered";
  expectEqual(
    verifyX4MergeFixtureManifest(tampered, sha256).ok,
    false,
    "tampered fixture content must fail signed verification",
  );
});

const failures: Array<{ readonly name: string; readonly error: unknown }> = [];

for (const namedCase of namedCases) {
  try {
    namedCase.run();
  } catch (error: unknown) {
    failures.push({ name: namedCase.name, error });
    console.error("FAIL x4 merge-law oracle fixture self-test case: " + namedCase.name);
    console.error(error);
  }
}

if (failures.length > 0) {
  console.error(
    "FAIL x4 merge-law oracle fixture self-test: "
      + namedCases.length
      + " named cases, "
      + assertionCount
      + " assertions, "
      + failures.length
      + " failed",
  );
  process.exitCode = 1;
} else {
  console.log(
    "PASS x4 merge-law oracle fixture self-test: "
      + namedCases.length
      + " named cases, "
      + assertionCount
      + " assertions",
  );
}
