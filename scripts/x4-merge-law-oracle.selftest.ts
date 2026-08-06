import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  X4_MERGE_ORACLE_CASE_IDS,
  X4_MERGE_ORACLE_MARKER_PREFIX,
  X4_MERGE_ORACLE_SCHEMA_VERSION,
  buildX4MergeFixtureManifest,
  canonicalX4MergeJson,
  deriveX4MergeOracleFixtureHash,
  encodeX4MergeOracleMarker,
  evaluateX4MergeOracleEvidence,
  isX4MergeSha256,
  normalizeX4MergeRelativePath,
  parseX4MergeOracleLogWindow,
  validateX4MergeIdentifier,
  verifyX4MergeFixtureManifest,
  type X4MergeOracleCaseId,
  type X4MergeOracleCaseMarker,
  type X4MergeOracleEndMarker,
  type X4MergeOracleFixtureIdentityInput,
  type X4MergeOracleManifestInput,
  type X4MergeOracleMarker,
  type X4MergeOracleMarkerObservation,
  type X4MergeOracleObservation,
  type X4MergeOracleSha256,
  type X4MergeOracleSignedManifest,
  type X4MergeOracleStartMarker,
} from "../src/lib/x4MergeLawOracle";

interface NamedCase {
  readonly name: string;
  readonly run: () => void;
}

interface MutableManifestInput {
  fixtureVersion: string;
  runId: string;
  targetGameVersion: string;
  targetBuildId: string;
  dependencyOrder: string[];
  files: Array<{
    normalizedRelativePath: string;
    utf8Content: string;
  }>;
  cases: Array<{
    caseId: X4MergeOracleCaseId;
    expectedObservation: X4MergeOracleObservation;
  }>;
}

interface MutableFixtureIdentity {
  fixtureVersion: string;
  runId: string;
  targetGameVersion: string;
  targetBuildId: string;
  dependencyOrder: string[];
  cases: Array<{
    caseId: X4MergeOracleCaseId;
    expectedObservation: X4MergeOracleObservation;
  }>;
}

interface MutableSignedManifest {
  fixtureVersion: string;
  runId: string;
  targetGameVersion: string;
  targetBuildId: string;
  dependencyOrder: string[];
  fixtureHash: string;
  files: Array<{
    normalizedRelativePath: string;
    utf8Content: string;
    sha256: string;
  }>;
  cases: Array<{
    caseId: X4MergeOracleCaseId;
    expectedObservation: X4MergeOracleObservation;
  }>;
  manifestSha256: string;
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

function expectEqual(actual: unknown, expected: unknown, message: string): void {
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

function expectNoThrow<T>(run: () => T, message: string): T {
  assertionCount += 1;
  let result: T | undefined;
  assert.doesNotThrow(() => {
    result = run();
  }, message);
  return result as T;
}

const sha256: X4MergeOracleSha256 = (utf8) =>
  createHash("sha256").update(utf8, "utf8").digest("hex");

function makeManifestInput(options: {
  readonly pendingCase?: X4MergeOracleCaseId;
  readonly reverseFiles?: boolean;
  readonly reverseCases?: boolean;
  readonly runId?: string;
} = {}): MutableManifestInput {
  const files = [
    { normalizedRelativePath: "z/second.xml", utf8Content: "<second/>" },
    { normalizedRelativePath: "a/first.xml", utf8Content: "<first/>" },
  ];
  if (options.reverseFiles) {
    files.reverse();
  }

  const cases = X4_MERGE_ORACLE_CASE_IDS.map((caseId) => ({
    caseId,
    expectedObservation: (caseId === options.pendingCase ? "pending" : "pass") as X4MergeOracleObservation,
  }));
  if (options.reverseCases) {
    cases.reverse();
  }

  return {
    fixtureVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    runId: options.runId ?? "run-main",
    targetGameVersion: "9.00",
    targetBuildId: "build-main",
    dependencyOrder: ["dependency-z", "dependency-a"],
    files,
    cases,
  };
}

function makeFixtureIdentity(input = makeManifestInput()): MutableFixtureIdentity {
  return {
    fixtureVersion: input.fixtureVersion,
    runId: input.runId,
    targetGameVersion: input.targetGameVersion,
    targetBuildId: input.targetBuildId,
    dependencyOrder: [...input.dependencyOrder],
    cases: input.cases.map((expectation) => ({ ...expectation })),
  };
}

function buildManifest(options: Parameters<typeof makeManifestInput>[0] = {}): X4MergeOracleSignedManifest {
  return buildX4MergeFixtureManifest(makeManifestInput(options), sha256);
}

function mutableManifest(manifest: X4MergeOracleSignedManifest): MutableSignedManifest {
  return JSON.parse(JSON.stringify(manifest)) as MutableSignedManifest;
}

function resignManifest(manifest: MutableSignedManifest): void {
  const unsignedManifest: Partial<MutableSignedManifest> = { ...manifest };
  delete unsignedManifest.manifestSha256;
  manifest.manifestSha256 = sha256(canonicalX4MergeJson(unsignedManifest));
}

function startMarker(
  manifest: X4MergeOracleSignedManifest,
  overrides: Partial<X4MergeOracleStartMarker> = {},
): X4MergeOracleStartMarker {
  return {
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "start",
    runId: manifest.runId,
    fixtureHash: manifest.fixtureHash,
    targetGameVersion: manifest.targetGameVersion,
    targetBuildId: manifest.targetBuildId,
    ...overrides,
  };
}

function caseMarker(
  manifest: X4MergeOracleSignedManifest,
  caseIndex: number,
  overrides: Partial<X4MergeOracleCaseMarker> = {},
): X4MergeOracleCaseMarker {
  const expectation = manifest.cases[caseIndex];
  const observation: X4MergeOracleMarkerObservation =
    expectation.expectedObservation === "fail" ? "fail" : "pass";
  return {
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "case",
    runId: manifest.runId,
    fixtureHash: manifest.fixtureHash,
    caseId: expectation.caseId,
    observation,
    detail: "observed",
    ...overrides,
  };
}

function endMarker(
  manifest: X4MergeOracleSignedManifest,
  overrides: Partial<X4MergeOracleEndMarker> = {},
): X4MergeOracleEndMarker {
  return {
    schemaVersion: X4_MERGE_ORACLE_SCHEMA_VERSION,
    kind: "end",
    runId: manifest.runId,
    fixtureHash: manifest.fixtureHash,
    ...overrides,
  };
}

function markerLines(manifest: X4MergeOracleSignedManifest): string[] {
  return [
    encodeX4MergeOracleMarker(startMarker(manifest)),
    ...manifest.cases.map((_expectation, index) =>
      encodeX4MergeOracleMarker(caseMarker(manifest, index)),
    ),
    encodeX4MergeOracleMarker(endMarker(manifest)),
  ];
}

function noisyLog(lines: readonly string[]): string {
  const output = ["ordinary-before"];
  for (let index = 0; index < lines.length; index += 1) {
    output.push(lines[index]);
    output.push(`ordinary-between-${index}`);
  }
  return output.join("\n");
}

function rawMarker(value: unknown): string {
  return `${X4_MERGE_ORACLE_MARKER_PREFIX}${JSON.stringify(value)}`;
}

function expectParseFailure(logText: unknown, message: string): void {
  const result = expectNoThrow(
    () => parseX4MergeOracleLogWindow(logText),
    `${message}: parser must not throw`,
  );
  expectEqual(result.ok, false, `${message}: parser must return failure`);
  expect(result.defects.length > 0, `${message}: parser must report a defect`);
}

function expectEvidenceFailure(
  manifest: unknown,
  logText: unknown,
  provider: X4MergeOracleSha256,
  message: string,
): ReturnType<typeof evaluateX4MergeOracleEvidence> {
  const result = expectNoThrow(
    () => evaluateX4MergeOracleEvidence(manifest, logText, provider),
    `${message}: evaluator must not throw`,
  );
  expectEqual(result.status, "failed", `${message}: evidence must fail`);
  expect(result.defects.length > 0, `${message}: evidence must report a defect`);
  return result;
}

test("canonical ordering and scalar encoding", () => {
  const value = {
    z: 0,
    a: { z: "last", a: "first" },
    list: [3, 1, true, null, "text"],
  };
  expectEqual(
    canonicalX4MergeJson(value),
    '{"a":{"a":"first","z":"last"},"list":[3,1,true,null,"text"],"z":0}',
    "canonical JSON must sort object keys recursively and preserve array order",
  );
  expectEqual(canonicalX4MergeJson(-0), "0", "negative zero must use JSON number encoding");
  expectEqual(
    sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "SHA-256 provider must hash exact UTF-8 input",
  );
  expect(isX4MergeSha256(sha256("abc")), "lowercase SHA-256 must be accepted");
  expect(!isX4MergeSha256(sha256("abc").toUpperCase()), "uppercase SHA-256 must be rejected");
});

test("canonical hostile values are rejected", () => {
  let getterCalled = false;
  const accessor: Record<string, unknown> = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get: () => {
      getterCalled = true;
      return 1;
    },
  });
  expectThrows(() => canonicalX4MergeJson(accessor), "accessors must be rejected");
  expectEqual(getterCalled, false, "canonicalization must not invoke accessors");

  const symbolKeyed = { value: 1, [Symbol("hidden")]: 2 };
  expectThrows(() => canonicalX4MergeJson(symbolKeyed), "symbol keys must be rejected");
  expectThrows(() => canonicalX4MergeJson(new Date(0)), "non-plain objects must be rejected");

  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  expectThrows(() => canonicalX4MergeJson(cyclic), "cycles must be rejected");

  const sparse = [1, 2, 3];
  delete sparse[1];
  expectThrows(() => canonicalX4MergeJson(sparse), "sparse arrays must be rejected");
  expectThrows(() => canonicalX4MergeJson(Number.NaN), "NaN must be rejected");
  expectThrows(() => canonicalX4MergeJson(Number.POSITIVE_INFINITY), "infinity must be rejected");
  expectThrows(() => canonicalX4MergeJson(undefined), "undefined must be rejected");
  expectThrows(() => canonicalX4MergeJson(() => 1), "functions must be rejected");
  expectThrows(() => canonicalX4MergeJson(Symbol("value")), "symbols must be rejected");
  expectThrows(() => canonicalX4MergeJson(1n), "bigint must be rejected");
});

test("primitive validators enforce normalized input", () => {
  expectEqual(
    normalizeX4MergeRelativePath("folder/file.xml"),
    "folder/file.xml",
    "safe relative paths must remain unchanged",
  );
  for (const invalidPath of [
    "",
    "/absolute.xml",
    "C:/drive.xml",
    "folder\\file.xml",
    "../escape.xml",
    "folder/./file.xml",
    "folder//file.xml",
    "folder/",
    "folder/control\n.xml",
  ]) {
    expectThrows(
      () => normalizeX4MergeRelativePath(invalidPath),
      `unsafe path must be rejected: ${JSON.stringify(invalidPath)}`,
    );
  }
  for (const controlCode of [0x00, 0x1f, 0x7f, 0x9f]) {
    const invalidPath = `folder/control${String.fromCharCode(controlCode)}.xml`;
    expectThrows(
      () => normalizeX4MergeRelativePath(invalidPath),
      `control U+${controlCode.toString(16).padStart(4, "0")} must be rejected`,
    );
  }
  expectEqual(
    validateX4MergeIdentifier("build-9.00", "build", 32),
    "build-9.00",
    "valid identifiers must remain unchanged",
  );
  expectThrows(() => validateX4MergeIdentifier(" changed", "id"), "changed trimming must reject");
  expectThrows(() => validateX4MergeIdentifier("unicodé", "id"), "non-ASCII identifiers must reject");
  expectThrows(() => validateX4MergeIdentifier("a".repeat(33), "id", 32), "identifier byte bound must reject");
});

test("manifest construction is deterministic and hashed", () => {
  const first = buildX4MergeFixtureManifest(
    makeManifestInput({ reverseFiles: false, reverseCases: false }),
    sha256,
  );
  const second = buildX4MergeFixtureManifest(
    makeManifestInput({ reverseFiles: true, reverseCases: true }),
    sha256,
  );
  expectDeepEqual(first, second, "input file and case order must not change the manifest");
  expectDeepEqual(
    first.files.map((file) => file.normalizedRelativePath),
    ["a/first.xml", "z/second.xml"],
    "manifest files must use ordinal path order",
  );
  expectDeepEqual(
    first.cases.map((entry) => entry.caseId),
    [...X4_MERGE_ORACLE_CASE_IDS],
    "manifest cases must use canonical case order",
  );
  expectDeepEqual(
    first.dependencyOrder,
    ["dependency-z", "dependency-a"],
    "dependency order must remain declared order",
  );
  for (const file of first.files) {
    expectEqual(file.sha256, sha256(file.utf8Content), "file hash must cover exact UTF-8 content");
  }
  expect(isX4MergeSha256(first.fixtureHash), "fixture identity must use lowercase SHA-256");
  expect(isX4MergeSha256(first.manifestSha256), "manifest authority must use lowercase SHA-256");
  expect(first.fixtureHash !== first.manifestSha256, "fixture and manifest hashes must be distinct fields");
  expectEqual(
    first.fixtureHash,
    deriveX4MergeOracleFixtureHash(makeFixtureIdentity(), sha256),
    "manifest fixture hash must derive from strict fixture identity",
  );
  const { manifestSha256, ...unsignedManifest } = first;
  expectEqual(
    manifestSha256,
    sha256(canonicalX4MergeJson(unsignedManifest)),
    "manifest hash must cover canonical unsigned data",
  );
  const verification = verifyX4MergeFixtureManifest(first, sha256);
  expectEqual(verification.ok, true, "constructed manifest must verify");
});

test("fixture identity hashing is strict and independent of file bytes", () => {
  const identity = makeFixtureIdentity();
  const fixtureHash = deriveX4MergeOracleFixtureHash(identity, sha256);
  expect(isX4MergeSha256(fixtureHash), "derived fixture binding must be lowercase SHA-256");
  expectEqual(
    fixtureHash,
    deriveX4MergeOracleFixtureHash(makeFixtureIdentity(), sha256),
    "equivalent fixture identities must hash deterministically",
  );

  const changedRun = makeFixtureIdentity();
  changedRun.runId = "run-changed";
  expect(
    deriveX4MergeOracleFixtureHash(changedRun, sha256) !== fixtureHash,
    "run identity mutation must change fixture binding",
  );

  const changedCase = makeFixtureIdentity();
  changedCase.cases[0].expectedObservation = "fail";
  expect(
    deriveX4MergeOracleFixtureHash(changedCase, sha256) !== fixtureHash,
    "case expectation mutation must change fixture binding",
  );

  const changedDependencies = makeFixtureIdentity();
  changedDependencies.dependencyOrder.reverse();
  expect(
    deriveX4MergeOracleFixtureHash(changedDependencies, sha256) !== fixtureHash,
    "declared dependency-order mutation must change fixture binding",
  );

  const originalInput = makeManifestInput();
  const originalManifest = buildX4MergeFixtureManifest(originalInput, sha256);
  const changedFileInput = makeManifestInput();
  changedFileInput.files[0].utf8Content += "changed";
  const changedFileManifest = buildX4MergeFixtureManifest(changedFileInput, sha256);
  expectEqual(
    changedFileManifest.fixtureHash,
    originalManifest.fixtureHash,
    "file-only content mutation must not change fixture binding",
  );
  expect(
    changedFileManifest.manifestSha256 !== originalManifest.manifestSha256,
    "file-only content mutation must change full manifest authority",
  );

  const extraKey = { ...makeFixtureIdentity(), extra: true };
  expectThrows(
    () => deriveX4MergeOracleFixtureHash(extraKey as X4MergeOracleFixtureIdentityInput, sha256),
    "unknown fixture identity keys must reject",
  );

  const nestedExtra = makeFixtureIdentity();
  nestedExtra.cases[0] = { ...nestedExtra.cases[0], extra: true } as typeof nestedExtra.cases[number];
  expectThrows(
    () => deriveX4MergeOracleFixtureHash(nestedExtra, sha256),
    "unknown fixture identity case keys must reject",
  );

  const wrongOrder = makeFixtureIdentity();
  wrongOrder.cases.reverse();
  expectThrows(
    () => deriveX4MergeOracleFixtureHash(wrongOrder, sha256),
    "noncanonical fixture case order must reject",
  );

  const wrongType = { ...makeFixtureIdentity(), runId: 42 };
  expectThrows(
    () =>
      deriveX4MergeOracleFixtureHash(
        wrongType as unknown as X4MergeOracleFixtureIdentityInput,
        sha256,
      ),
    "wrong fixture identity types must reject",
  );

  const sparseCases = makeFixtureIdentity();
  sparseCases.cases = new Array(X4_MERGE_ORACLE_CASE_IDS.length);
  expectThrows(
    () => deriveX4MergeOracleFixtureHash(sparseCases, sha256),
    "sparse fixture identity cases must reject",
  );

  let getterCalled = false;
  const accessorIdentity = { ...makeFixtureIdentity() };
  Object.defineProperty(accessorIdentity, "runId", {
    enumerable: true,
    get: () => {
      getterCalled = true;
      return "unsafe";
    },
  });
  expectThrows(
    () => deriveX4MergeOracleFixtureHash(accessorIdentity, sha256),
    "fixture identity accessors must reject",
  );
  expectEqual(getterCalled, false, "fixture identity hashing must not invoke accessors");

  const symbolIdentity = { ...makeFixtureIdentity(), [Symbol("hidden")]: true };
  expectThrows(
    () => deriveX4MergeOracleFixtureHash(symbolIdentity, sha256),
    "fixture identity symbol keys must reject",
  );

  const nonPlainIdentity = Object.assign(Object.create({ inherited: true }), makeFixtureIdentity());
  expectThrows(
    () =>
      deriveX4MergeOracleFixtureHash(
        nonPlainIdentity as X4MergeOracleFixtureIdentityInput,
        sha256,
      ),
    "non-plain fixture identity must reject",
  );

  expectThrows(
    () => deriveX4MergeOracleFixtureHash(identity, () => "A".repeat(64)),
    "uppercase fixture hash providers must reject",
  );
  expectThrows(
    () =>
      deriveX4MergeOracleFixtureHash(identity, () => {
        throw new Error("provider failure");
      }),
    "fixture hash provider failures must reject",
  );
});

test("precomputed fixture binding removes final-byte circularity", () => {
  const input = makeManifestInput({ runId: "run-precomputed" });
  const fixtureHash = deriveX4MergeOracleFixtureHash(makeFixtureIdentity(input), sha256);
  input.files[0].utf8Content = `<fixture fixtureHash="${fixtureHash}"/>`;

  const manifest = buildX4MergeFixtureManifest(input, sha256);
  expectEqual(
    manifest.fixtureHash,
    fixtureHash,
    "final manifest must retain the binding computed before file authoring",
  );
  expect(
    manifest.files.some((file) => file.utf8Content.includes(fixtureHash)),
    "final manifest bytes must be able to embed the precomputed fixture binding",
  );
  expectEqual(
    verifyX4MergeFixtureManifest(manifest, sha256).ok,
    true,
    "manifest over final binding-bearing bytes must verify",
  );
  expectEqual(
    evaluateX4MergeOracleEvidence(manifest, markerLines(manifest).join("\n"), sha256).status,
    "green",
    "exact runtime markers must evaluate against the precomputed fixture binding",
  );
});

test("manifest construction rejects hostile shapes and bounds", () => {
  for (const invalidPath of ["../escape.xml", "/absolute.xml", "C:/drive.xml", "a\\b.xml"] ) {
    const input = makeManifestInput();
    input.files[0].normalizedRelativePath = invalidPath;
    expectThrows(
      () => buildX4MergeFixtureManifest(input, sha256),
      `manifest must reject hostile path ${invalidPath}`,
    );
  }

  const duplicateFiles = makeManifestInput();
  duplicateFiles.files[1].normalizedRelativePath = duplicateFiles.files[0].normalizedRelativePath;
  expectThrows(() => buildX4MergeFixtureManifest(duplicateFiles, sha256), "duplicate files must reject");

  const missingCase = makeManifestInput();
  missingCase.cases.pop();
  expectThrows(() => buildX4MergeFixtureManifest(missingCase, sha256), "missing case must reject");

  const duplicateDependency = makeManifestInput();
  duplicateDependency.dependencyOrder = ["same", "same"];
  expectThrows(
    () => buildX4MergeFixtureManifest(duplicateDependency, sha256),
    "duplicate dependencies must reject",
  );

  const extraTopLevel = { ...makeManifestInput(), extra: true };
  expectThrows(
    () => buildX4MergeFixtureManifest(extraTopLevel, sha256),
    "unknown manifest keys must reject",
  );

  const extraNested = makeManifestInput();
  const nestedWithExtra = { ...extraNested.files[0], extra: true };
  extraNested.files[0] = nestedWithExtra;
  expectThrows(
    () => buildX4MergeFixtureManifest(extraNested, sha256),
    "unknown nested keys must reject",
  );

  const wrongType = { ...makeManifestInput(), runId: 42 };
  expectThrows(
    () => buildX4MergeFixtureManifest(wrongType as unknown as X4MergeOracleManifestInput, sha256),
    "wrong manifest field type must reject",
  );

  let getterCalled = false;
  const accessorInput = { ...makeManifestInput() };
  Object.defineProperty(accessorInput, "runId", {
    enumerable: true,
    get: () => {
      getterCalled = true;
      return "unsafe";
    },
  });
  expectThrows(
    () => buildX4MergeFixtureManifest(accessorInput, sha256),
    "manifest accessors must reject",
  );
  expectEqual(getterCalled, false, "manifest construction must not invoke accessors");

  const symbolInput = { ...makeManifestInput(), [Symbol("hidden")]: true };
  expectThrows(() => buildX4MergeFixtureManifest(symbolInput, sha256), "manifest symbol keys must reject");

  const nonPlain = Object.assign(Object.create({ inherited: true }), makeManifestInput());
  expectThrows(
    () => buildX4MergeFixtureManifest(nonPlain as X4MergeOracleManifestInput, sha256),
    "non-plain manifest input must reject",
  );

  const sparseFiles = makeManifestInput();
  sparseFiles.files = new Array(1);
  expectThrows(() => buildX4MergeFixtureManifest(sparseFiles, sha256), "sparse file arrays must reject");

  const tooManyFiles = makeManifestInput();
  tooManyFiles.files = Array.from({ length: 129 }, (_value, index) => ({
    normalizedRelativePath: `files/${index}.xml`,
    utf8Content: "x",
  }));
  expectThrows(() => buildX4MergeFixtureManifest(tooManyFiles, sha256), "file count bound must reject");

  const oversizedContent = makeManifestInput();
  oversizedContent.files[0].utf8Content = "x".repeat(1_048_577);
  expectThrows(
    () => buildX4MergeFixtureManifest(oversizedContent, sha256),
    "per-file byte bound must reject",
  );

  expectThrows(
    () => buildX4MergeFixtureManifest(makeManifestInput(), () => "A".repeat(64)),
    "uppercase provider hashes must reject",
  );
  expectThrows(
    () => buildX4MergeFixtureManifest(makeManifestInput(), () => "a".repeat(63)),
    "noncanonical provider hashes must reject",
  );
  expectThrows(
    () => buildX4MergeFixtureManifest(makeManifestInput(), () => {
      throw new Error("provider failure");
    }),
    "provider failures must reject construction",
  );
});

test("manifest verification rejects drift and malformed authority", () => {
  const manifest = buildManifest();

  const changedContent = mutableManifest(manifest);
  changedContent.files[0].utf8Content += "x";
  expectEqual(
    verifyX4MergeFixtureManifest(changedContent, sha256).ok,
    false,
    "one-byte content drift must reject",
  );

  const changedHash = mutableManifest(manifest);
  changedHash.files[0].sha256 = "0".repeat(64);
  resignManifest(changedHash);
  expectEqual(
    verifyX4MergeFixtureManifest(changedHash, sha256).ok,
    false,
    "file hash drift must reject even with a recomputed manifest hash",
  );

  const changedManifestHash = mutableManifest(manifest);
  changedManifestHash.manifestSha256 = "0".repeat(64);
  expectEqual(
    verifyX4MergeFixtureManifest(changedManifestHash, sha256).ok,
    false,
    "manifest hash drift must reject",
  );

  const changedFixtureHash = mutableManifest(manifest);
  changedFixtureHash.fixtureHash = `${changedFixtureHash.fixtureHash[0] === "0" ? "1" : "0"}${changedFixtureHash.fixtureHash.slice(1)}`;
  resignManifest(changedFixtureHash);
  expectEqual(
    verifyX4MergeFixtureManifest(changedFixtureHash, sha256).ok,
    false,
    "tampered fixture binding must reject even with a recomputed manifest hash",
  );

  const uppercaseHash = mutableManifest(manifest);
  uppercaseHash.files[0].sha256 = uppercaseHash.files[0].sha256.toUpperCase();
  expectEqual(
    verifyX4MergeFixtureManifest(uppercaseHash, sha256).ok,
    false,
    "uppercase file hash must reject",
  );

  const wrongFileOrder = mutableManifest(manifest);
  wrongFileOrder.files.reverse();
  resignManifest(wrongFileOrder);
  expectEqual(
    verifyX4MergeFixtureManifest(wrongFileOrder, sha256).ok,
    false,
    "noncanonical file order must reject",
  );

  const wrongCaseOrder = mutableManifest(manifest);
  [wrongCaseOrder.cases[0], wrongCaseOrder.cases[1]] = [
    wrongCaseOrder.cases[1],
    wrongCaseOrder.cases[0],
  ];
  resignManifest(wrongCaseOrder);
  expectEqual(
    verifyX4MergeFixtureManifest(wrongCaseOrder, sha256).ok,
    false,
    "noncanonical case order must reject",
  );

  const extraNested = mutableManifest(manifest);
  (extraNested.files[0] as Record<string, unknown>).extra = true;
  expectEqual(
    verifyX4MergeFixtureManifest(extraNested, sha256).ok,
    false,
    "unknown signed file keys must reject",
  );

  const wrongVersion = mutableManifest(manifest);
  wrongVersion.fixtureVersion = "wrong-version";
  resignManifest(wrongVersion);
  expectEqual(
    verifyX4MergeFixtureManifest(wrongVersion, sha256).ok,
    false,
    "wrong fixture version must reject",
  );

  expectEqual(
    verifyX4MergeFixtureManifest(manifest, () => "A".repeat(64)).ok,
    false,
    "uppercase verification provider must fail safely",
  );
  expectEqual(
    verifyX4MergeFixtureManifest(manifest, () => {
      throw new Error("provider failure");
    }).ok,
    false,
    "throwing verification provider must fail safely",
  );
});

test("manifest authority is mutation-isolated and frozen", () => {
  const input = makeManifestInput();
  const originalContent = input.files[0].utf8Content;
  const manifest = buildX4MergeFixtureManifest(input, sha256);
  input.files[0].utf8Content = "mutated-input";
  const builtFile = manifest.files.find(
    (file) => file.normalizedRelativePath === input.files[0].normalizedRelativePath,
  );
  expectEqual(builtFile?.utf8Content, originalContent, "input mutation must not alter built manifest");
  expect(Object.isFrozen(manifest), "built manifest must be frozen");
  expect(Object.isFrozen(manifest.files), "built file array must be frozen");
  expect(manifest.files.every(Object.isFrozen), "built files must be frozen");
  expect(Object.isFrozen(manifest.cases), "built case array must be frozen");
  expect(manifest.cases.every(Object.isFrozen), "built cases must be frozen");

  const mutable = mutableManifest(manifest);
  const verification = verifyX4MergeFixtureManifest(mutable, sha256);
  expectEqual(verification.ok, true, "valid mutable clone must verify");
  if (!verification.ok) {
    return;
  }
  const verifiedContent = verification.manifest.files[0].utf8Content;
  mutable.files[0].utf8Content = "mutated-after-verification";
  expectEqual(
    verification.manifest.files[0].utf8Content,
    verifiedContent,
    "caller mutation must not alter verified authority",
  );
  expect(Object.isFrozen(verification.manifest), "verified manifest must be frozen");
  expect(Object.isFrozen(verification.manifest.files), "verified file array must be frozen");
});

test("marker encoding is deterministic and strict", () => {
  const manifest = buildManifest();
  const validMarkers: X4MergeOracleMarker[] = [
    startMarker(manifest),
    caseMarker(manifest, 0),
    endMarker(manifest),
  ];
  for (const marker of validMarkers) {
    const first = encodeX4MergeOracleMarker(marker);
    const second = encodeX4MergeOracleMarker(marker);
    expectEqual(first, second, "marker encoding must be deterministic");
    expect(
      first.startsWith("X4FORGE_MERGE_ORACLE_V1 {"),
      "marker must use the exact sentinel and one ASCII space",
    );
  }

  const extraKey = { ...endMarker(manifest), extra: true };
  expectThrows(
    () => encodeX4MergeOracleMarker(extraKey as unknown as X4MergeOracleMarker),
    "unknown marker keys must reject",
  );
  const pending = { ...caseMarker(manifest, 0), observation: "pending" };
  expectThrows(
    () => encodeX4MergeOracleMarker(pending as unknown as X4MergeOracleMarker),
    "pending marker observations must reject",
  );
  expectThrows(
    () => encodeX4MergeOracleMarker({ ...endMarker(manifest), fixtureHash: "A".repeat(64) }),
    "uppercase marker hashes must reject",
  );
  expectThrows(
    () => encodeX4MergeOracleMarker({ ...caseMarker(manifest, 0), detail: "x".repeat(4_097) }),
    "oversized marker detail must reject",
  );
  const unknownCase = { ...caseMarker(manifest, 0), caseId: "unknown_case" };
  expectThrows(
    () => encodeX4MergeOracleMarker(unknownCase as unknown as X4MergeOracleMarker),
    "unknown marker cases must reject",
  );

  let getterCalled = false;
  const accessor = { ...caseMarker(manifest, 0) };
  Object.defineProperty(accessor, "detail", {
    enumerable: true,
    get: () => {
      getterCalled = true;
      return "unsafe";
    },
  });
  expectThrows(
    () => encodeX4MergeOracleMarker(accessor),
    "marker accessors must reject",
  );
  expectEqual(getterCalled, false, "marker encoding must not invoke accessors");

  const symbolMarker = { ...endMarker(manifest), [Symbol("hidden")]: true };
  expectThrows(() => encodeX4MergeOracleMarker(symbolMarker), "marker symbol keys must reject");
  const nonPlainMarker = Object.assign(Object.create({ inherited: true }), endMarker(manifest));
  expectThrows(
    () => encodeX4MergeOracleMarker(nonPlainMarker as X4MergeOracleMarker),
    "non-plain markers must reject",
  );
});

test("marker parsing round-trips through ordinary noise", () => {
  const manifest = buildManifest();
  const lines = markerLines(manifest);
  const result = parseX4MergeOracleLogWindow(noisyLog(lines));
  expectEqual(result.ok, true, "valid encoded markers with noise must parse");
  expectEqual(result.defects.length, 0, "valid encoded markers must have no parser defects");
  expectEqual(result.markers.length, lines.length, "all valid markers must be returned");
  expectDeepEqual(
    result.markers.map((record) => record.lineNumber),
    lines.map((_line, index) => 2 + index * 2),
    "parser must preserve source line numbers",
  );
  expectDeepEqual(
    result.markers.map((record) => encodeX4MergeOracleMarker(record.marker)),
    lines,
    "parsed markers must encode back to the exact canonical line",
  );
  expect(Object.isFrozen(result), "parse result must be frozen");
  expect(Object.isFrozen(result.markers), "parsed marker array must be frozen");
  expect(Object.isFrozen(result.defects), "parser defect array must be frozen");
  expect(
    result.markers.every((record) => Object.isFrozen(record) && Object.isFrozen(record.marker)),
    "parsed records and normalized markers must be frozen",
  );

  const noiseOnly = parseX4MergeOracleLogWindow("ordinary one\nordinary two");
  expectEqual(noiseOnly.ok, true, "ordinary noise must remain accepted");
  expectEqual(noiseOnly.markers.length, 0, "ordinary noise must not create markers");
});

test("marker parsing rejects malformed sentinel data", () => {
  const manifest = buildManifest();
  const validCase = caseMarker(manifest, 0);
  const validEnd = encodeX4MergeOracleMarker(endMarker(manifest));

  expectParseFailure("X4FORGE_MERGE_ORACLE_V1{}", "sentinel without separator");
  expectParseFailure(X4_MERGE_ORACLE_MARKER_PREFIX, "prefix without JSON");
  expectParseFailure(`${X4_MERGE_ORACLE_MARKER_PREFIX}{bad}`, "malformed marker JSON");
  expectParseFailure(rawMarker({ ...validCase, extra: true }), "unknown marker key");
  expectParseFailure(rawMarker({ ...validCase, caseId: "unknown_case" }), "unknown marker case");
  expectParseFailure(rawMarker({ ...validCase, observation: "pending" }), "pending marker observation");
  expectParseFailure(rawMarker({ ...validCase, schemaVersion: "wrong" }), "wrong marker schema");
  expectParseFailure(rawMarker({ ...validCase, fixtureHash: "A".repeat(64) }), "wrong marker hash shape");
  expectParseFailure(`${validEnd} trailing`, "content after marker JSON");
  expectParseFailure(`${validEnd}${validEnd}`, "duplicate marker prefix");
  expectParseFailure(
    `X4FORGE_MERGE_ORACLE_V1! ${validEnd}`,
    "bare sentinel before an otherwise valid marker",
  );
  expectParseFailure(rawMarker({ ...validCase, toJSON: "unexpected" }), "accessor-equivalent key");

  const hostileText = "HOSTILE_PAYLOAD_SHOULD_NOT_BE_ECHOED";
  const malformed = parseX4MergeOracleLogWindow(
    `${X4_MERGE_ORACLE_MARKER_PREFIX}{${hostileText}}`,
  );
  expectEqual(malformed.ok, false, "hostile malformed JSON must fail");
  expect(
    malformed.defects.every((defect) => defect.length < 256 && !defect.includes(hostileText)),
    "parser defects must remain bounded and sanitized",
  );
});

test("marker parser bounds and hostile types fail safely", () => {
  expectParseFailure("x".repeat(65_537), "line byte bound");
  expectParseFailure("x\n".repeat(200_000), "line-count bound");
  expectParseFailure("x".repeat(16 * 1_048_576 + 1), "window byte bound");

  const manifest = buildManifest();
  const endLine = encodeX4MergeOracleMarker(endMarker(manifest));
  expectParseFailure(Array.from({ length: 129 }, () => endLine).join("\n"), "marker-count bound");

  let getterCalled = false;
  const hostile = {
    get text(): string {
      getterCalled = true;
      return "unsafe";
    },
  };
  expectParseFailure(hostile, "non-string parser input");
  expectEqual(getterCalled, false, "parser must not inspect hostile object properties");
});

test("evaluator accepts one exact complete noisy run", () => {
  const manifest = buildManifest();
  const logText = noisyLog(markerLines(manifest));
  const result = evaluateX4MergeOracleEvidence(manifest, logText, sha256);
  expectEqual(result.status, "green", "exact complete evidence must be green");
  expectEqual(result.runId, manifest.runId, "green evidence must retain verified run identity");
  expectEqual(
    result.fixtureHash,
    manifest.fixtureHash,
    "green evidence must retain verified fixture identity",
  );
  expectEqual(
    result.manifestSha256,
    manifest.manifestSha256,
    "green evidence must retain verified full manifest authority",
  );
  expectEqual(result.logWindowSha256, sha256(logText), "evidence must hash the exact log window");
  expectEqual(result.defects.length, 0, "green evidence must have no defects");
  expectEqual(result.verdicts.length, X4_MERGE_ORACLE_CASE_IDS.length, "all cases need verdicts");
  expect(result.verdicts.every((verdict) => verdict.status === "green"), "all exact cases must be green");
  expect(Object.isFrozen(result), "evidence result must be frozen");
  expect(Object.isFrozen(result.verdicts), "evidence verdict array must be frozen");
  expect(Object.isFrozen(result.defects), "evidence defect array must be frozen");
  expect(result.verdicts.every(Object.isFrozen), "individual verdicts must be frozen");
});

test("pending expectations make evidence unavailable", () => {
  const pendingCase = X4_MERGE_ORACLE_CASE_IDS[0];
  const manifest = buildManifest({ pendingCase, runId: "run-pending" });
  const result = evaluateX4MergeOracleEvidence(
    manifest,
    markerLines(manifest).join("\n"),
    sha256,
  );
  expectEqual(result.status, "unavailable", "pending expectation must prevent green evidence");
  const verdict = result.verdicts.find((entry) => entry.caseId === pendingCase);
  expectEqual(verdict?.status, "unavailable", "pending case verdict must be unavailable");
  expectEqual(result.defects.length, 0, "complete pending evidence need not be structurally defective");
});

test("evaluator rejects missing duplicate and out-of-order markers", () => {
  const manifest = buildManifest();
  const lines = markerLines(manifest);

  const missingCaseIndex = 3;
  const missingLines = lines.filter((_line, index) => index !== missingCaseIndex + 1);
  const missing = expectEvidenceFailure(
    manifest,
    missingLines.join("\n"),
    sha256,
    "missing case marker",
  );
  const missingVerdict = missing.verdicts.find(
    (verdict) => verdict.caseId === manifest.cases[missingCaseIndex].caseId,
  );
  expect(missingVerdict !== undefined, "missing case must still receive a verdict");
  expect(
    missingVerdict !== undefined && !("observedObservation" in missingVerdict),
    "missing evidence must omit observation and detail",
  );

  const duplicateLines = [...lines.slice(0, 2), lines[1], ...lines.slice(2)];
  expectEvidenceFailure(manifest, duplicateLines.join("\n"), sha256, "duplicate case marker");

  const outOfOrderLines = [...lines];
  [outOfOrderLines[1], outOfOrderLines[2]] = [outOfOrderLines[2], outOfOrderLines[1]];
  expectEvidenceFailure(manifest, outOfOrderLines.join("\n"), sha256, "out-of-order cases");
});

test("evaluator rejects wrong and mixed identities", () => {
  const manifest = buildManifest();
  const lines = markerLines(manifest);

  const manifestHashMarkerLines = [...lines];
  manifestHashMarkerLines[1] = encodeX4MergeOracleMarker(
    caseMarker(manifest, 0, { fixtureHash: manifest.manifestSha256 }),
  );
  const wrongAuthority = expectEvidenceFailure(
    manifest,
    manifestHashMarkerLines.join("\n"),
    sha256,
    "manifest hash used as fixture binding",
  );
  expectEqual(
    wrongAuthority.fixtureHash,
    manifest.fixtureHash,
    "red log evidence must retain verified fixture identity",
  );
  expectEqual(
    wrongAuthority.manifestSha256,
    manifest.manifestSha256,
    "red log evidence must retain verified manifest authority",
  );

  const wrongHashLines = [...lines];
  wrongHashLines[1] = encodeX4MergeOracleMarker(
    caseMarker(manifest, 0, { fixtureHash: "b".repeat(64) }),
  );
  expectEvidenceFailure(manifest, wrongHashLines.join("\n"), sha256, "wrong fixture hash");

  const mixedRunLines = [...lines];
  mixedRunLines[1] = encodeX4MergeOracleMarker(
    caseMarker(manifest, 0, { runId: "run-mixed" }),
  );
  expectEvidenceFailure(manifest, mixedRunLines.join("\n"), sha256, "mixed run identity");

  const staleRunLines = [
    encodeX4MergeOracleMarker(startMarker(manifest, { runId: "run-stale" })),
    ...manifest.cases.map((_entry, index) =>
      encodeX4MergeOracleMarker(caseMarker(manifest, index, { runId: "run-stale" })),
    ),
    encodeX4MergeOracleMarker(endMarker(manifest, { runId: "run-stale" })),
  ];
  expectEvidenceFailure(manifest, staleRunLines.join("\n"), sha256, "stale run identity");

  const wrongBuildLines = [...lines];
  wrongBuildLines[0] = encodeX4MergeOracleMarker(
    startMarker(manifest, { targetBuildId: "wrong-build" }),
  );
  expectEvidenceFailure(manifest, wrongBuildLines.join("\n"), sha256, "wrong target build");

  const wrongGameLines = [...lines];
  wrongGameLines[0] = encodeX4MergeOracleMarker(
    startMarker(manifest, { targetGameVersion: "wrong-game" }),
  );
  expectEvidenceFailure(manifest, wrongGameLines.join("\n"), sha256, "wrong target version");
});

test("evaluator rejects malformed unknown mismatched and trailing markers", () => {
  const manifest = buildManifest();
  const lines = markerLines(manifest);

  expectEvidenceFailure(
    manifest,
    [`${X4_MERGE_ORACLE_MARKER_PREFIX}{bad}`, ...lines].join("\n"),
    sha256,
    "malformed marker line",
  );

  const unknownMarker = rawMarker({ ...caseMarker(manifest, 0), caseId: "unknown_case" });
  expectEvidenceFailure(
    manifest,
    [unknownMarker, ...lines].join("\n"),
    sha256,
    "unknown marker case",
  );

  const mismatchLines = [...lines];
  mismatchLines[1] = encodeX4MergeOracleMarker(
    caseMarker(manifest, 0, { observation: "fail" }),
  );
  expectEvidenceFailure(manifest, mismatchLines.join("\n"), sha256, "observation mismatch");

  const afterEndLines = [...lines, encodeX4MergeOracleMarker(caseMarker(manifest, 0))];
  expectEvidenceFailure(manifest, afterEndLines.join("\n"), sha256, "marker after end");

  const duplicatePrefixLine = `${lines[0]}${lines[1]}`;
  expectEvidenceFailure(
    manifest,
    [duplicatePrefixLine, ...lines].join("\n"),
    sha256,
    "parser defect in evidence window",
  );

  const wrongSchemaMarker = rawMarker({ ...startMarker(manifest), schemaVersion: "wrong" });
  expectEvidenceFailure(
    manifest,
    [wrongSchemaMarker, ...lines.slice(1)].join("\n"),
    sha256,
    "wrong marker schema",
  );
});

test("evaluator fails safely for invalid authority and providers", () => {
  const manifest = buildManifest();
  const logText = markerLines(manifest).join("\n");

  const throwingProvider: X4MergeOracleSha256 = () => {
    throw new Error("provider failure");
  };
  const providerFailure = expectEvidenceFailure(
    manifest,
    logText,
    throwingProvider,
    "throwing provider",
  );
  expectEqual(providerFailure.runId, null, "failed manifest verification must hide run identity");
  expectEqual(providerFailure.fixtureHash, null, "failed manifest verification must hide fixture identity");
  expectEqual(
    providerFailure.manifestSha256,
    null,
    "failed manifest verification must hide manifest authority",
  );

  expectEvidenceFailure(
    manifest,
    logText,
    () => "A".repeat(64),
    "uppercase provider",
  );

  let manifestGetterCalled = false;
  const hostileManifest = {
    get runId(): string {
      manifestGetterCalled = true;
      return "unsafe";
    },
  };
  const hostileManifestResult = expectEvidenceFailure(
    hostileManifest,
    logText,
    sha256,
    "hostile manifest input",
  );
  expectEqual(manifestGetterCalled, false, "evaluator must not invoke hostile manifest accessors");
  expectEqual(hostileManifestResult.runId, null, "invalid manifest must expose no run identity");

  let logGetterCalled = false;
  const hostileLog = {
    get text(): string {
      logGetterCalled = true;
      return "unsafe";
    },
  };
  expectEvidenceFailure(manifest, hostileLog, sha256, "hostile log input");
  expectEqual(logGetterCalled, false, "evaluator must not inspect hostile log properties");

  const changedManifest = mutableManifest(manifest);
  changedManifest.files[0].utf8Content += "x";
  const invalidManifestResult = expectEvidenceFailure(
    changedManifest,
    logText,
    sha256,
    "changed signed manifest",
  );
  expectEqual(invalidManifestResult.runId, null, "changed manifest must expose no run identity");
  expectEqual(invalidManifestResult.fixtureHash, null, "changed manifest must expose no fixture identity");
  expectEqual(
    invalidManifestResult.manifestSha256,
    null,
    "changed manifest must expose no full manifest authority",
  );
});

test("evaluator authority is isolated from later caller mutation", () => {
  const manifest = buildManifest();
  const mutable = mutableManifest(manifest);
  const logText = markerLines(manifest).join("\n");
  const result = evaluateX4MergeOracleEvidence(mutable, logText, sha256);
  expectEqual(result.status, "green", "valid mutable authority must evaluate green");
  const recordedRunId = result.runId;
  const firstDetail = result.verdicts[0].detail;
  mutable.runId = "mutated-after-evaluation";
  mutable.cases[0].expectedObservation = "fail";
  expectEqual(result.runId, recordedRunId, "manifest mutation must not alter evidence identity");
  expectEqual(result.verdicts[0].detail, firstDetail, "manifest mutation must not alter verdict data");
  expect(Object.isFrozen(result), "isolated evidence result must be frozen");
  expect(Object.isFrozen(result.verdicts), "isolated verdict array must be frozen");
  expect(result.verdicts.every(Object.isFrozen), "isolated verdict objects must be frozen");
});

const failures: Array<{ readonly name: string; readonly error: unknown }> = [];

for (const namedCase of namedCases) {
  try {
    namedCase.run();
  } catch (error: unknown) {
    failures.push({ name: namedCase.name, error });
    console.error(`FAIL x4 merge-law oracle self-test case: ${namedCase.name}`);
    console.error(error);
  }
}

if (failures.length > 0) {
  console.error(
    `FAIL x4 merge-law oracle self-test: ${namedCases.length} named cases, ${assertionCount} assertions, ${failures.length} failed`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `PASS x4 merge-law oracle self-test: ${namedCases.length} named cases, ${assertionCount} assertions`,
  );
}
