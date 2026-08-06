import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  X4_MERGE_ORACLE_CASE_IDS,
  X4_MERGE_ORACLE_MARKER_PREFIX,
  X4_MERGE_ORACLE_SCHEMA_VERSION,
  buildX4MergeFixtureManifest,
  canonicalX4MergeJson,
  encodeX4MergeOracleMarker,
  type X4MergeOracleCaseId,
  type X4MergeOracleCaseMarker,
  type X4MergeOracleEndMarker,
  type X4MergeOracleManifestInput,
  type X4MergeOracleSha256,
  type X4MergeOracleSignedManifest,
  type X4MergeOracleStartMarker,
} from "../src/lib/x4MergeLawOracle";
import {
  buildX4MergeLawOracleFixture,
  deriveX4MergeLawOracleProbeTokens,
} from "../src/lib/x4MergeLawOracleFixture";
import {
  X4_MERGE_LAW_ORACLE_EVIDENCE_MAX_LOG_WINDOW_BYTES,
  finalizeX4MergeLawOracleEvidence,
  type X4MergeLawOracleEvidenceResult,
} from "../src/server/x4MergeLawOracleEvidence";

interface NamedCase {
  readonly name: string;
  readonly run: () => void;
}

const namedCases: NamedCase[] = [];
let assertionCount = 0;

function test(name: string, run: () => void): void {
  namedCases.push({ name, run });
}

function expect(value: unknown, message: string): asserts value {
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

function expectNoThrow<T>(run: () => T, message: string): T {
  assertionCount += 1;
  let result: T | undefined;
  assert.doesNotThrow(() => {
    result = run();
  }, message);
  return result as T;
}

function expectThrows(run: () => unknown, message: string): void {
  assertionCount += 1;
  assert.throws(run, undefined, message);
}

const sha256: X4MergeOracleSha256 = (utf8) =>
  createHash("sha256").update(utf8, "utf8").digest("hex");

const runId = "evidence_selftest_01";

function buildFixture(): X4MergeOracleSignedManifest {
  return buildX4MergeLawOracleFixture(
    {
      runId,
      targetGameVersion: "9.00",
      targetBuildId: "evidence-build-900",
    },
    sha256,
  );
}

function markerLines(manifest: X4MergeOracleSignedManifest): string[] {
  const start: X4MergeOracleStartMarker = {
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "start",
    runId: manifest.runId,
    fixtureHash: manifest.fixtureHash,
    targetGameVersion: manifest.targetGameVersion,
    targetBuildId: manifest.targetBuildId,
  };
  const cases = manifest.cases.map((expectation): string => {
    const marker: X4MergeOracleCaseMarker = {
      schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
      kind: "case",
      runId: manifest.runId,
      fixtureHash: manifest.fixtureHash,
      caseId: expectation.caseId,
      observation: expectation.expectedObservation === "fail" ? "fail" : "pass",
      detail: "evidence selftest observed",
    };
    return encodeX4MergeOracleMarker(marker);
  });
  const end: X4MergeOracleEndMarker = {
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "end",
    runId: manifest.runId,
    fixtureHash: manifest.fixtureHash,
  };
  return [
    encodeX4MergeOracleMarker(start),
    ...cases,
    encodeX4MergeOracleMarker(end),
  ];
}

function makeLog(
  manifest: X4MergeOracleSignedManifest,
  extraLines: readonly string[] = [],
): string {
  return ["ordinary-before", ...extraLines, ...markerLines(manifest), "ordinary-after"].join("\n");
}

function cueRuntimeErrorLine(runId: string): string {
  return "[=ERROR=] ... Error in MD cue md.Setup.X4ForgeMergeOracle_OnLoad_"
    + runId
    + ": Property lookup failed with value: <runtime-detail>";
}

function rebuildManifest(
  original: X4MergeOracleSignedManifest,
  expectedObservation: (caseId: X4MergeOracleCaseId) => "pass" | "fail" | "pending",
): X4MergeOracleSignedManifest {
  const input: X4MergeOracleManifestInput = {
    fixtureVersion: original.fixtureVersion,
    runId: original.runId,
    targetGameVersion: original.targetGameVersion,
    targetBuildId: original.targetBuildId,
    dependencyOrder: [...original.dependencyOrder],
    files: original.files.map((file) => ({
      normalizedRelativePath: file.normalizedRelativePath,
      utf8Content: file.utf8Content,
    })),
    cases: original.cases.map((expectation) => ({
      caseId: expectation.caseId,
      expectedObservation: expectedObservation(expectation.caseId),
    })),
  };
  return buildX4MergeFixtureManifest(input, sha256);
}

function finalize(
  manifest: unknown,
  logWindow: unknown,
  provider: unknown = sha256,
): X4MergeLawOracleEvidenceResult {
  return expectNoThrow(
    () => finalizeX4MergeLawOracleEvidence(manifest, logWindow, provider),
    "public finalizer must never throw",
  );
}

function verdict(
  result: X4MergeLawOracleEvidenceResult,
  caseId: X4MergeOracleCaseId,
): X4MergeLawOracleEvidenceResult["verdicts"][number] {
  const found = result.verdicts.find((candidate) => candidate.caseId === caseId);
  assert.ok(found, "expected verdict must be present: " + caseId);
  return found;
}

test("probe derivation is centralized and fixture bytes stay deterministic", () => {
  const first = buildFixture();
  const second = buildFixture();
  const tokens = deriveX4MergeLawOracleProbeTokens(first.runId);
  const top = first.files.find((file) => file.normalizedRelativePath.includes("_top/md/"));

  expect(top !== undefined, "generated fixture must contain the top MD layer");
  expect(top !== undefined && top.utf8Content.includes(tokens.silentProbeToken), "top layer must use the silent token");
  expect(top !== undefined && top.utf8Content.includes(tokens.controlProbeToken), "top layer must use the control token");
  expectDeepEqual(
    first.files.map((file) => [file.normalizedRelativePath, file.utf8Content]),
    second.files.map((file) => [file.normalizedRelativePath, file.utf8Content]),
    "repeated fixture generation must preserve exact bytes",
  );
  expectEqual(canonicalX4MergeJson(first), canonicalX4MergeJson(second), "signed fixtures must be deterministic");
  expectEqual(
    first.cases.find((entry) => entry.caseId === "silent")?.expectedObservation,
    "pending",
    "the standard manifest must keep silent pending",
  );
  expect(
    first.cases.filter((entry) => entry.expectedObservation === "pending").length === 1,
    "the standard manifest must have exactly one pending case",
  );
  expectThrows(
    () => deriveX4MergeLawOracleProbeTokens("bad/slash"),
    "probe derivation must validate runId before constructing tokens",
  );
});

test("valid core markers plus control evidence upgrade all nine cases", () => {
  const manifest = buildFixture();
  const logWindow = makeLog(manifest, [
    "Multiple matching nodes for the deliberate ambiguous selector.",
    "No matching node for X4FORGE_MERGE_ORACLE_CONTROL_MISSING_SELECTOR_" + manifest.runId,
  ]);
  const result = finalize(manifest, logWindow);

  expectEqual(result.status, "green", "valid external control evidence must upgrade unavailable core evidence");
  expectEqual(result.runId, manifest.runId, "final evidence must retain the signed run identity");
  expectEqual(result.fixtureHash, manifest.fixtureHash, "final evidence must retain the signed fixture identity");
  expectEqual(result.manifestSha256, manifest.manifestSha256, "final evidence must retain the signed manifest identity");
  expectEqual(result.logWindowSha256, sha256(logWindow), "final evidence must hash the full bounded log window");
  expectDeepEqual(result.probeOccurrences, { silent: 0, control: 1 }, "probe counts must be exact");
  expectEqual(result.verdicts.length, X4_MERGE_ORACLE_CASE_IDS.length, "all nine cases must be reported");
  expect(result.verdicts.every((entry) => entry.status === "green"), "all nine cases must be green after the upgrade");
  expectEqual(verdict(result, "silent").expectedObservation, "pending", "silent expectation must remain pending in the report");
  expectEqual(result.defects.length, 0, "green final evidence must have no defects");
  expect(Object.isFrozen(result), "final result must be frozen");
  expect(Object.isFrozen(result.probeOccurrences), "probe counts must be frozen");
  expect(Object.isFrozen(result.verdicts), "verdict array must be frozen");
  expect(Object.isFrozen(result.defects), "defect array must be frozen");
  expect(result.verdicts.every((entry) => Object.isFrozen(entry)), "every verdict must be frozen");
});

test("an exact current-run cue runtime error fails with a sanitized deterministic defect", () => {
  const manifest = buildFixture();
  const tokens = deriveX4MergeLawOracleProbeTokens(manifest.runId);
  const result = finalize(manifest, makeLog(manifest, [
    tokens.controlProbeToken,
    cueRuntimeErrorLine(manifest.runId),
  ]));

  expectEqual(result.status, "failed", "current-run cue runtime errors must not upgrade to green");
  expectDeepEqual(
    result.defects,
    ["run-scoped X4 merge-oracle MD cue runtime error occurred in the current run."],
    "runtime failure must produce one fixed sanitized defect",
  );
  expect(
    result.defects.every((defect) => !defect.includes("Property lookup failed")),
    "runtime details must not be copied into the final defect",
  );
});

test("stale or unrelated runtime error lines do not invalidate a complete current run", () => {
  const manifest = buildFixture();
  const tokens = deriveX4MergeLawOracleProbeTokens(manifest.runId);
  const staleRunResult = finalize(manifest, makeLog(manifest, [
    tokens.controlProbeToken,
    cueRuntimeErrorLine(manifest.runId + "_stale"),
  ]));
  const unrelatedResult = finalize(manifest, makeLog(manifest, [
    tokens.controlProbeToken,
    "[=ERROR=] unrelated runtime subsystem failure",
  ]));

  expectEqual(staleRunResult.status, "green", "stale-run cue errors must not invalidate the current run");
  expectEqual(staleRunResult.defects.length, 0, "stale-run cue errors must not add defects");
  expectEqual(unrelatedResult.status, "green", "unrelated error lines must not invalidate the current run");
  expectEqual(unrelatedResult.defects.length, 0, "unrelated error lines must not add defects");
});

test("silent token occurrence is failed even when the control token is present", () => {
  const manifest = buildFixture();
  const tokens = deriveX4MergeLawOracleProbeTokens(manifest.runId);
  const result = finalize(manifest, makeLog(manifest, [tokens.controlProbeToken, tokens.silentProbeToken]));

  expectEqual(result.status, "failed", "silent-token evidence must never upgrade to green");
  expectDeepEqual(result.probeOccurrences, { silent: 1, control: 1 }, "both probe counts must be reported");
  expectEqual(verdict(result, "silent").status, "failed", "silent verdict must be failed when its token occurs");
  expect(result.defects.some((defect) => defect.includes("silent-selector probe token")), "silent occurrence must be defected");
});

test("control token is required and absence cannot become green", () => {
  const manifest = buildFixture();
  const result = finalize(manifest, makeLog(manifest));

  expectEqual(result.status, "failed", "absence of both probe tokens must not imply silent success");
  expectDeepEqual(result.probeOccurrences, { silent: 0, control: 0 }, "missing probe counts must be exact");
  expect(result.defects.some((defect) => defect.includes("control probe token is missing")), "control absence must be defected");
  expectEqual(verdict(result, "silent").status, "unavailable", "silent stays unavailable without external evidence");
});

test("duplicate control tokens are counted exactly without changing the positive rule", () => {
  const manifest = buildFixture();
  const tokens = deriveX4MergeLawOracleProbeTokens(manifest.runId);
  const result = finalize(manifest, makeLog(manifest, [tokens.controlProbeToken, tokens.controlProbeToken]));

  expectEqual(result.status, "green", "multiple control observations still satisfy the at-least-one rule");
  expectDeepEqual(result.probeOccurrences, { silent: 0, control: 2 }, "duplicate control occurrences must be counted exactly");
});

test("malformed, wrong-hash, partial, stale, and mixed markers remain failed", () => {
  const manifest = buildFixture();
  const tokens = deriveX4MergeLawOracleProbeTokens(manifest.runId);
  const lines = markerLines(manifest);
  const validWithControl = [tokens.controlProbeToken, ...lines].join("\n");

  const malformed = finalize(manifest, [X4_MERGE_ORACLE_MARKER_PREFIX + "{bad}", validWithControl].join("\n"));
  expectEqual(malformed.status, "failed", "malformed marker evidence must fail");

  const wrongHashMarker = encodeX4MergeOracleMarker({
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "case",
    runId: manifest.runId,
    fixtureHash: "b".repeat(64),
    caseId: "selector_cardinality",
    observation: "pass",
    detail: "wrong hash",
  });
  const wrongHash = finalize(manifest, [tokens.controlProbeToken, lines[0], wrongHashMarker, ...lines.slice(2)].join("\n"));
  expectEqual(wrongHash.status, "failed", "wrong fixture-hash markers must fail");

  const partial = finalize(manifest, [tokens.controlProbeToken, ...lines.slice(0, -1)].join("\n"));
  expectEqual(partial.status, "failed", "partial marker sequences must fail");

  const stale = finalize(manifest, [
    tokens.controlProbeToken,
    encodeX4MergeOracleMarker({
      schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
      kind: "start",
      runId: "stale_run",
      fixtureHash: manifest.fixtureHash,
      targetGameVersion: manifest.targetGameVersion,
      targetBuildId: manifest.targetBuildId,
    }),
    ...lines.slice(1),
  ].join("\n"));
  expectEqual(stale.status, "failed", "stale run markers must fail");

  const mixed = finalize(manifest, [
    tokens.controlProbeToken,
    lines[0],
    encodeX4MergeOracleMarker({
      schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
      kind: "case",
      runId: "mixed_run",
      fixtureHash: manifest.fixtureHash,
      caseId: "selector_cardinality",
      observation: "pass",
      detail: "mixed run",
    }),
    ...lines.slice(2),
  ].join("\n"));
  expectEqual(mixed.status, "failed", "mixed-run markers must fail");
});

test("unexpected pending and altered standard expectations cannot be upgraded", () => {
  const standard = buildFixture();
  const tokens = deriveX4MergeLawOracleProbeTokens(standard.runId);
  const nonSilentPending = rebuildManifest(
    standard,
    (caseId) => caseId === "add" || caseId === "silent" ? "pending" : "pass",
  );
  const nonSilentResult = finalize(nonSilentPending, makeLog(nonSilentPending, [tokens.controlProbeToken]));
  expectEqual(nonSilentResult.status, "failed", "a non-silent pending case must remain failed");
  expectEqual(verdict(nonSilentResult, "add").status, "unavailable", "unexpected pending case must remain unavailable");

  const alteredSilent = rebuildManifest(
    standard,
    (caseId) => caseId === "silent" ? "pass" : "pass",
  );
  const alteredResult = finalize(alteredSilent, makeLog(alteredSilent, [tokens.controlProbeToken]));
  expectEqual(alteredResult.status, "failed", "altering the signed silent expectation must fail closed");
  expect(alteredResult.defects.some((defect) => defect.includes("standard silent-pending contract")), "altered expectation must be defected");
});

test("oversized windows and invalid SHA providers fail safely", () => {
  const manifest = buildFixture();
  const tokens = deriveX4MergeLawOracleProbeTokens(manifest.runId);
  const valid = makeLog(manifest, [tokens.controlProbeToken]);
  const oversized = valid + "x".repeat(X4_MERGE_LAW_ORACLE_EVIDENCE_MAX_LOG_WINDOW_BYTES - valid.length + 1);
  const oversizedResult = finalize(manifest, oversized);
  expectEqual(oversizedResult.status, "failed", "oversized log windows must fail");
  expectEqual(oversizedResult.logWindowSha256, null, "oversized windows must not receive a hash");

  const throwingProvider = finalize(manifest, valid, () => {
    throw new Error("provider failure");
  });
  expectEqual(throwingProvider.status, "failed", "throwing SHA providers must fail");
  expectEqual(throwingProvider.runId, null, "provider failure must hide unverified manifest identity");

  const invalidProvider = finalize(manifest, valid, () => "A".repeat(64));
  expectEqual(invalidProvider.status, "failed", "invalid SHA provider output must fail");
  expectEqual(invalidProvider.manifestSha256, null, "invalid provider output must hide manifest identity");
});

test("hostile inputs do not throw, inputs are not mutated, and results stay frozen", () => {
  const manifest = buildFixture();
  const mutableManifest = JSON.parse(JSON.stringify(manifest)) as X4MergeOracleSignedManifest;
  const tokens = deriveX4MergeLawOracleProbeTokens(manifest.runId);
  const logWindow = makeLog(manifest, [tokens.controlProbeToken]);
  const before = JSON.stringify(mutableManifest);
  const result = finalize(mutableManifest, logWindow);

  expectEqual(result.status, "green", "mutable but valid authority must evaluate normally");
  expectEqual(JSON.stringify(mutableManifest), before, "finalizer must not mutate its manifest input");
  expect(Object.isFrozen(result), "result must be frozen");
  expect(Object.isFrozen(result.probeOccurrences), "nested probe counts must be frozen");
  expect(Object.isFrozen(result.verdicts), "nested verdict array must be frozen");
  expect(Object.isFrozen(result.defects), "nested defects array must be frozen");
  expect(result.verdicts.every((entry) => Object.isFrozen(entry)), "nested verdicts must be frozen");

  let manifestGetterCalled = false;
  const hostileManifest = new Proxy({}, {
    get(): never {
      manifestGetterCalled = true;
      throw new Error("hostile manifest getter");
    },
  });
  const hostileManifestResult = finalize(hostileManifest, logWindow);
  expectEqual(hostileManifestResult.status, "failed", "hostile manifest shapes must fail");
  expectEqual(manifestGetterCalled, false, "manifest accessor must not be invoked");

  let logGetterCalled = false;
  const hostileLog = new Proxy({}, {
    get(): never {
      logGetterCalled = true;
      throw new Error("hostile log getter");
    },
  });
  const hostileLogResult = finalize(manifest, hostileLog);
  expectEqual(hostileLogResult.status, "failed", "hostile log shapes must fail");
  expectEqual(logGetterCalled, false, "log accessor must not be invoked");

  const malformed = finalize(null, [], sha256);
  expectEqual(malformed.status, "failed", "malformed primitive/array inputs must fail");
});

const failures: Array<{ readonly name: string; readonly error: unknown }> = [];

for (const namedCase of namedCases) {
  try {
    namedCase.run();
  } catch (error: unknown) {
    failures.push({ name: namedCase.name, error });
    console.error(`FAIL x4 merge-law oracle evidence self-test case: ${namedCase.name}`);
    console.error(error);
  }
}

if (failures.length > 0) {
  console.error(
    `FAIL x4 merge-law oracle evidence self-test: ${namedCases.length} named cases, ${assertionCount} assertions, ${failures.length} failed`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `PASS x4 merge-law oracle evidence self-test: ${namedCases.length} named cases, ${assertionCount} assertions`,
  );
}
