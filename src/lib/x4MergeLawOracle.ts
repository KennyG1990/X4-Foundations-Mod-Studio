export const X4_MERGE_ORACLE_SCHEMA_VERSION = "x4-merge-law-oracle.v1" as const;
export const X4_MERGE_ORACLE_FIXTURE_HASH_DOMAIN =
  "x4-merge-law-oracle.fixture-hash.v1" as const;

export const X4_MERGE_ORACLE_CASE_IDS = [
  "selector_cardinality",
  "add",
  "replace",
  "remove",
  "attribute",
  "if",
  "silent",
  "pos",
  "dependency_nested",
] as const;

export type X4MergeOracleCaseId = (typeof X4_MERGE_ORACLE_CASE_IDS)[number];

export type X4MergeOracleObservation = "pass" | "fail" | "pending";

export type X4MergeOracleEvidenceStatus = "green" | "failed" | "unavailable";

export interface X4MergeOracleFixtureFile {
  readonly normalizedRelativePath: string;
  readonly utf8Content: string;
  readonly sha256: string;
}

export interface X4MergeOracleCaseExpectation {
  readonly caseId: X4MergeOracleCaseId;
  readonly expectedObservation: X4MergeOracleObservation;
}

export interface X4MergeOracleFixtureIdentityInput {
  readonly fixtureVersion: string;
  readonly runId: string;
  readonly targetGameVersion: string;
  readonly targetBuildId: string;
  readonly dependencyOrder: readonly string[];
  readonly cases: readonly X4MergeOracleCaseExpectation[];
}

export interface X4MergeOracleUnsignedManifest {
  readonly fixtureVersion: string;
  readonly runId: string;
  readonly targetGameVersion: string;
  readonly targetBuildId: string;
  readonly dependencyOrder: readonly string[];
  readonly fixtureHash: string;
  readonly files: readonly X4MergeOracleFixtureFile[];
  readonly cases: readonly X4MergeOracleCaseExpectation[];
}

export interface X4MergeOracleSignedManifest extends X4MergeOracleUnsignedManifest {
  readonly manifestSha256: string;
}

export interface X4MergeOracleParsedMarker {
  readonly runId: string;
  readonly fixtureHash: string;
  readonly caseId: X4MergeOracleCaseId;
  readonly observation: X4MergeOracleObservation;
  readonly detail: string;
}

export interface X4MergeOracleObservedCaseVerdict {
  readonly caseId: X4MergeOracleCaseId;
  readonly expectedObservation: X4MergeOracleObservation;
  readonly status: X4MergeOracleEvidenceStatus;
  readonly observedObservation: X4MergeOracleMarkerObservation;
  readonly detail: string;
}

export interface X4MergeOracleMissingCaseVerdict {
  readonly caseId: X4MergeOracleCaseId;
  readonly expectedObservation: X4MergeOracleObservation;
  readonly status: "failed";
  readonly observedObservation?: never;
  readonly detail?: never;
}

export type X4MergeOracleCaseVerdict =
  | X4MergeOracleObservedCaseVerdict
  | X4MergeOracleMissingCaseVerdict;

export interface X4MergeOracleEvidenceResult {
  readonly status: X4MergeOracleEvidenceStatus;
  readonly runId: string | null;
  readonly fixtureHash: string | null;
  readonly manifestSha256: string | null;
  readonly logWindowSha256: string | null;
  readonly verdicts: readonly X4MergeOracleCaseVerdict[];
  readonly defects: readonly string[];
}

export type X4MergeOracleSha256 = (utf8: string) => string;

const MAX_X4_MERGE_JSON_DEPTH = 64;
const MAX_X4_MERGE_JSON_NODES = 10_000;
const MAX_X4_MERGE_JSON_KEYS = 50_000;
const MAX_X4_MERGE_RELATIVE_PATH_BYTES = 4_096;
const DEFAULT_X4_MERGE_IDENTIFIER_BYTES = 128;
const MAX_X4_MERGE_IDENTIFIER_BYTES = 4_096;

const X4_MERGE_ASCII_PRINTABLE = /^[\u0020-\u007e]+$/u;

function hasX4MergeControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }

  return false;
}

function x4MergeUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function x4MergeOrdinalCompare(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function x4MergeRejectUnsupportedValue(value: unknown): never {
  throw new TypeError(`Unsupported X4 merge JSON value: ${typeof value}.`);
}

export function canonicalX4MergeJson(value: unknown): string {
  const activeContainers = new Set<object>();
  let visitedNodes = 0;
  let visitedKeys = 0;

  const countNode = (): void => {
    visitedNodes += 1;
    if (visitedNodes > MAX_X4_MERGE_JSON_NODES) {
      throw new RangeError("X4 merge JSON exceeds the node bound.");
    }
  };

  const countKeys = (count: number): void => {
    visitedKeys += count;
    if (visitedKeys > MAX_X4_MERGE_JSON_KEYS) {
      throw new RangeError("X4 merge JSON exceeds the key bound.");
    }
  };

  const readDataDescriptor = (container: object, key: string): PropertyDescriptor => {
    const descriptor = Object.getOwnPropertyDescriptor(container, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError("X4 merge JSON cannot contain accessors.");
    }

    return descriptor;
  };

  const visit = (current: unknown, depth: number): string => {
    countNode();
    if (depth > MAX_X4_MERGE_JSON_DEPTH) {
      throw new RangeError("X4 merge JSON exceeds the depth bound.");
    }

    if (current === null) {
      return "null";
    }

    switch (typeof current) {
      case "string":
        return JSON.stringify(current);
      case "boolean":
        return current ? "true" : "false";
      case "number": {
        if (!Number.isFinite(current)) {
          throw new TypeError("X4 merge JSON cannot contain a non-finite number.");
        }

        return JSON.stringify(current);
      }
      case "undefined":
      case "function":
      case "symbol":
      case "bigint":
        return x4MergeRejectUnsupportedValue(current);
      case "object":
        break;
      default:
        return x4MergeRejectUnsupportedValue(current);
    }

    const container = current;
    if (activeContainers.has(container)) {
      throw new TypeError("X4 merge JSON cannot contain cycles.");
    }

    activeContainers.add(container);
    try {
      if (Array.isArray(container)) {
        if (Object.getPrototypeOf(container) !== Array.prototype) {
          throw new TypeError("X4 merge JSON arrays must use the native array prototype.");
        }

        const arrayLength = container.length;
        if (!Number.isSafeInteger(arrayLength) || arrayLength > MAX_X4_MERGE_JSON_NODES) {
          throw new RangeError("X4 merge JSON array exceeds the size bound.");
        }

        const ownSymbols = Object.getOwnPropertySymbols(container);
        if (ownSymbols.length > 0) {
          throw new TypeError("X4 merge JSON cannot contain symbol properties.");
        }

        const ownPropertyNames = Object.getOwnPropertyNames(container);
        countKeys(ownPropertyNames.length);
        countKeys(arrayLength);
        for (const propertyName of ownPropertyNames) {
          const descriptor = readDataDescriptor(container, propertyName);
          if (propertyName === "length") {
            continue;
          }

          const index = Number(propertyName);
          if (
            !Number.isSafeInteger(index) ||
            index < 0 ||
            index >= arrayLength ||
            String(index) !== propertyName
          ) {
            throw new TypeError("X4 merge JSON arrays cannot contain extra properties.");
          }

          void descriptor;
        }

        const elements: string[] = [];
        for (let index = 0; index < arrayLength; index += 1) {
          const propertyName = String(index);
          const descriptor = Object.getOwnPropertyDescriptor(container, propertyName);
          if (descriptor === undefined) {
            throw new TypeError("X4 merge JSON cannot contain sparse arrays.");
          }

          if (!("value" in descriptor)) {
            throw new TypeError("X4 merge JSON cannot contain accessors.");
          }

          elements.push(visit(descriptor.value, depth + 1));
        }

        return `[${elements.join(",")}]`;
      }

      const prototype = Object.getPrototypeOf(container);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError("X4 merge JSON can contain only plain objects.");
      }

      const ownSymbols = Object.getOwnPropertySymbols(container);
      if (ownSymbols.length > 0) {
        throw new TypeError("X4 merge JSON cannot contain symbol properties.");
      }

      const ownPropertyNames = Object.getOwnPropertyNames(container);
      countKeys(ownPropertyNames.length);
      const enumerableKeys: string[] = [];
      for (const propertyName of ownPropertyNames) {
        const descriptor = readDataDescriptor(container, propertyName);
        if (descriptor.enumerable) {
          enumerableKeys.push(propertyName);
        }
      }

      enumerableKeys.sort(x4MergeOrdinalCompare);
      const members: string[] = [];
      for (const propertyName of enumerableKeys) {
        const descriptor = readDataDescriptor(container, propertyName);
        members.push(`${JSON.stringify(propertyName)}:${visit(descriptor.value, depth + 1)}`);
      }

      return `{${members.join(",")}}`;
    } finally {
      activeContainers.delete(container);
    }
  };

  return visit(value, 0);
}

export function isX4MergeSha256(value: unknown): boolean {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

export function normalizeX4MergeRelativePath(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("X4 merge fixture paths must be strings.");
  }

  if (value.length === 0) {
    throw new RangeError("X4 merge fixture paths cannot be empty.");
  }

  if (x4MergeUtf8ByteLength(value) > MAX_X4_MERGE_RELATIVE_PATH_BYTES) {
    throw new RangeError("X4 merge fixture paths exceed the byte bound.");
  }

  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes(":") ||
    hasX4MergeControlCharacter(value)
  ) {
    throw new TypeError("X4 merge fixture paths must be safe relative paths.");
  }

  const segments = value.split("/");
  for (const segment of segments) {
    if (segment.length === 0 || segment === "." || segment === "..") {
      throw new TypeError("X4 merge fixture paths contain an invalid segment.");
    }
  }

  return value;
}

export function validateX4MergeIdentifier(
  value: unknown,
  label: string,
  maxBytes = DEFAULT_X4_MERGE_IDENTIFIER_BYTES,
): string {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_X4_MERGE_IDENTIFIER_BYTES) {
    throw new RangeError("X4 merge identifiers have an invalid byte bound.");
  }

  if (typeof value !== "string") {
    throw new TypeError(`${label} must be an ASCII string.`);
  }

  if (value.length === 0 || value.trim() !== value || !X4_MERGE_ASCII_PRINTABLE.test(value)) {
    throw new TypeError(`${label} must be a nonempty trimmed printable ASCII string.`);
  }

  if (x4MergeUtf8ByteLength(value) > maxBytes) {
    throw new RangeError(`${label} exceeds its UTF-8 byte bound.`);
  }

  return value;
}

export interface X4MergeOracleFixtureFileInput {
  readonly normalizedRelativePath: string;
  readonly utf8Content: string;
}

export interface X4MergeOracleManifestInput {
  readonly fixtureVersion: string;
  readonly runId: string;
  readonly targetGameVersion: string;
  readonly targetBuildId: string;
  readonly dependencyOrder: readonly string[];
  readonly files: readonly X4MergeOracleFixtureFileInput[];
  readonly cases: readonly X4MergeOracleCaseExpectation[];
}

export type X4MergeOracleManifestValidationResult =
  | {
      readonly ok: true;
      readonly manifest: X4MergeOracleSignedManifest;
    }
  | {
      readonly ok: false;
      readonly errors: readonly string[];
    };

const MAX_X4_MERGE_FIXTURE_FILES = 128;
const MAX_X4_MERGE_DEPENDENCIES = 64;
const MAX_X4_MERGE_FILE_CONTENT_BYTES = 1_048_576;
const MAX_X4_MERGE_TOTAL_CONTENT_BYTES = 8 * 1_048_576;

const X4_MERGE_INPUT_KEYS = [
  "fixtureVersion",
  "runId",
  "targetGameVersion",
  "targetBuildId",
  "dependencyOrder",
  "files",
  "cases",
] as const;

const X4_MERGE_FIXTURE_IDENTITY_KEYS = [
  "fixtureVersion",
  "runId",
  "targetGameVersion",
  "targetBuildId",
  "dependencyOrder",
  "cases",
] as const;

const X4_MERGE_FIXTURE_FILE_INPUT_KEYS = ["normalizedRelativePath", "utf8Content"] as const;
const X4_MERGE_FIXTURE_FILE_KEYS = ["normalizedRelativePath", "utf8Content", "sha256"] as const;
const X4_MERGE_CASE_EXPECTATION_KEYS = ["caseId", "expectedObservation"] as const;
const X4_MERGE_SIGNED_MANIFEST_KEYS = [
  ...X4_MERGE_INPUT_KEYS,
  "fixtureHash",
  "manifestSha256",
] as const;

interface X4MergeOracleValidatedFixtureIdentity {
  readonly fixtureVersion: string;
  readonly runId: string;
  readonly targetGameVersion: string;
  readonly targetBuildId: string;
  readonly dependencyOrder: readonly string[];
  readonly cases: readonly X4MergeOracleCaseExpectation[];
}

interface X4MergeOracleValidatedInput extends X4MergeOracleValidatedFixtureIdentity {
  readonly files: readonly X4MergeOracleFixtureFileInput[];
}

function x4MergeReadExactPlainObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): object {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object.`);
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${label} cannot contain symbol keys.`);
  }

  const ownPropertyNames = Object.getOwnPropertyNames(value);
  if (ownPropertyNames.length !== expectedKeys.length) {
    throw new TypeError(`${label} has an unexpected key set.`);
  }

  const allowedKeys = new Set(expectedKeys);
  for (const propertyName of ownPropertyNames) {
    if (!allowedKeys.has(propertyName)) {
      throw new TypeError(`${label} has an unexpected key.`);
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, propertyName);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(`${label} contains a non-data or non-enumerable key.`);
    }
  }

  return value;
}

function x4MergeReadExactProperty(container: object, propertyName: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(container, propertyName);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`${label} contains an accessor.`);
  }

  return descriptor.value;
}

function x4MergeReadExactArray(value: unknown, label: string, maxLength: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${label} must be a native array.`);
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${label} cannot contain symbol keys.`);
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.enumerable !== false
  ) {
    throw new TypeError(`${label} has an invalid length property.`);
  }

  const length = lengthDescriptor.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > maxLength) {
    throw new RangeError(`${label} exceeds its item bound.`);
  }

  const ownPropertyNames = Object.getOwnPropertyNames(value);
  if (ownPropertyNames.length !== length + 1 || !ownPropertyNames.includes("length")) {
    throw new TypeError(`${label} must not contain sparse or extra properties.`);
  }

  const presentIndices = new Set<number>();
  for (const propertyName of ownPropertyNames) {
    if (propertyName === "length") {
      continue;
    }

    const index = Number(propertyName);
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= length ||
      String(index) !== propertyName
    ) {
      throw new TypeError(`${label} contains an invalid index.`);
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, propertyName);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(`${label} contains a non-data or non-enumerable item.`);
    }

    presentIndices.add(index);
  }

  if (presentIndices.size !== length) {
    throw new TypeError(`${label} cannot be sparse.`);
  }

  const items: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`${label} contains an accessor or missing item.`);
    }

    items.push(descriptor.value);
  }

  return items;
}

function x4MergeReadCaseId(value: unknown, label: string): X4MergeOracleCaseId {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a known X4 merge case ID.`);
  }

  if (!X4_MERGE_ORACLE_CASE_IDS.includes(value as X4MergeOracleCaseId)) {
    throw new TypeError(`${label} must be a known X4 merge case ID.`);
  }

  return value as X4MergeOracleCaseId;
}

function x4MergeReadObservation(value: unknown, label: string): X4MergeOracleObservation {
  if (value === "pass" || value === "fail" || value === "pending") {
    return value;
  }

  throw new TypeError(`${label} must be pass, fail, or pending.`);
}

function x4MergeReadSha256(value: unknown, label: string): string {
  if (typeof value !== "string" || !isX4MergeSha256(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256 value.`);
  }

  return value;
}

function x4MergeReadContent(value: unknown, label: string, totalBytes: { value: number }): string {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a UTF-8 string.`);
  }

  const contentBytes = x4MergeUtf8ByteLength(value);
  if (contentBytes > MAX_X4_MERGE_FILE_CONTENT_BYTES) {
    throw new RangeError(`${label} exceeds the per-file byte bound.`);
  }

  totalBytes.value += contentBytes;
  if (totalBytes.value > MAX_X4_MERGE_TOTAL_CONTENT_BYTES) {
    throw new RangeError("X4 merge fixture content exceeds the aggregate byte bound.");
  }

  return value;
}

function x4MergeValidateFixtureVersion(value: unknown): string {
  const fixtureVersion = validateX4MergeIdentifier(value, "fixtureVersion");
  if (fixtureVersion !== X4_MERGE_ORACLE_SCHEMA_VERSION) {
    throw new TypeError("fixtureVersion does not match the X4 merge oracle schema.");
  }

  return fixtureVersion;
}

function x4MergeValidateDependencyOrder(value: unknown): string[] {
  const dependencyValues = x4MergeReadExactArray(value, "dependencyOrder", MAX_X4_MERGE_DEPENDENCIES);
  const dependencyOrder: string[] = [];
  const seenDependencies = new Set<string>();

  for (let index = 0; index < dependencyValues.length; index += 1) {
    const dependencyId = validateX4MergeIdentifier(
      dependencyValues[index],
      `dependencyOrder[${index}]`,
    );
    if (seenDependencies.has(dependencyId)) {
      throw new TypeError(`dependencyOrder[${index}] is duplicated.`);
    }

    seenDependencies.add(dependencyId);
    dependencyOrder.push(dependencyId);
  }

  return dependencyOrder;
}

function x4MergeValidateCaseExpectations(
  value: unknown,
  requireCanonicalOrder = false,
): X4MergeOracleCaseExpectation[] {
  const caseValues = x4MergeReadExactArray(value, "cases", X4_MERGE_ORACLE_CASE_IDS.length);
  if (caseValues.length !== X4_MERGE_ORACLE_CASE_IDS.length) {
    throw new TypeError("cases must contain exactly one expectation for every case ID.");
  }

  const seenCases = new Set<X4MergeOracleCaseId>();
  const cases: X4MergeOracleCaseExpectation[] = [];
  for (let index = 0; index < caseValues.length; index += 1) {
    const caseObject = x4MergeReadExactPlainObject(
      caseValues[index],
      X4_MERGE_CASE_EXPECTATION_KEYS,
      `cases[${index}]`,
    );
    const caseId = x4MergeReadCaseId(
      x4MergeReadExactProperty(caseObject, "caseId", `cases[${index}]`),
      `cases[${index}].caseId`,
    );
    if (requireCanonicalOrder && caseId !== X4_MERGE_ORACLE_CASE_IDS[index]) {
      throw new TypeError("fixture identity cases must use canonical case order.");
    }
    const expectedObservation = x4MergeReadObservation(
      x4MergeReadExactProperty(caseObject, "expectedObservation", `cases[${index}]`),
      `cases[${index}].expectedObservation`,
    );

    if (seenCases.has(caseId)) {
      throw new TypeError(`cases[${index}].caseId is duplicated.`);
    }

    seenCases.add(caseId);
    cases.push({ caseId, expectedObservation });
  }

  if (seenCases.size !== X4_MERGE_ORACLE_CASE_IDS.length) {
    throw new TypeError("cases must contain exactly one expectation for every case ID.");
  }

  cases.sort(
    (left, right) =>
      X4_MERGE_ORACLE_CASE_IDS.indexOf(left.caseId) -
      X4_MERGE_ORACLE_CASE_IDS.indexOf(right.caseId),
  );
  return cases;
}

function x4MergeValidateFixtureIdentityInput(
  value: unknown,
): X4MergeOracleValidatedFixtureIdentity {
  const input = x4MergeReadExactPlainObject(
    value,
    X4_MERGE_FIXTURE_IDENTITY_KEYS,
    "fixture identity",
  );
  return {
    fixtureVersion: x4MergeValidateFixtureVersion(
      x4MergeReadExactProperty(input, "fixtureVersion", "fixture identity"),
    ),
    runId: validateX4MergeIdentifier(
      x4MergeReadExactProperty(input, "runId", "fixture identity"),
      "runId",
    ),
    targetGameVersion: validateX4MergeIdentifier(
      x4MergeReadExactProperty(input, "targetGameVersion", "fixture identity"),
      "targetGameVersion",
    ),
    targetBuildId: validateX4MergeIdentifier(
      x4MergeReadExactProperty(input, "targetBuildId", "fixture identity"),
      "targetBuildId",
    ),
    dependencyOrder: x4MergeValidateDependencyOrder(
      x4MergeReadExactProperty(input, "dependencyOrder", "fixture identity"),
    ),
    cases: x4MergeValidateCaseExpectations(
      x4MergeReadExactProperty(input, "cases", "fixture identity"),
      true,
    ),
  };
}

function x4MergeValidateManifestInput(value: unknown): X4MergeOracleValidatedInput {
  const input = x4MergeReadExactPlainObject(value, X4_MERGE_INPUT_KEYS, "manifest input");
  const fixtureVersion = x4MergeValidateFixtureVersion(
    x4MergeReadExactProperty(input, "fixtureVersion", "manifest input"),
  );
  const runId = validateX4MergeIdentifier(
    x4MergeReadExactProperty(input, "runId", "manifest input"),
    "runId",
  );
  const targetGameVersion = validateX4MergeIdentifier(
    x4MergeReadExactProperty(input, "targetGameVersion", "manifest input"),
    "targetGameVersion",
  );
  const targetBuildId = validateX4MergeIdentifier(
    x4MergeReadExactProperty(input, "targetBuildId", "manifest input"),
    "targetBuildId",
  );
  const dependencyOrder = x4MergeValidateDependencyOrder(
    x4MergeReadExactProperty(input, "dependencyOrder", "manifest input"),
  );
  const fileValues = x4MergeReadExactArray(
    x4MergeReadExactProperty(input, "files", "manifest input"),
    "files",
    MAX_X4_MERGE_FIXTURE_FILES,
  );
  const totalBytes = { value: 0 };
  const seenPaths = new Set<string>();
  const files: X4MergeOracleFixtureFileInput[] = [];

  for (let index = 0; index < fileValues.length; index += 1) {
    const fileObject = x4MergeReadExactPlainObject(
      fileValues[index],
      X4_MERGE_FIXTURE_FILE_INPUT_KEYS,
      `files[${index}]`,
    );
    const normalizedRelativePath = normalizeX4MergeRelativePath(
      x4MergeReadExactProperty(fileObject, "normalizedRelativePath", `files[${index}]`),
    );
    if (seenPaths.has(normalizedRelativePath)) {
      throw new TypeError(`files[${index}].normalizedRelativePath is duplicated.`);
    }

    seenPaths.add(normalizedRelativePath);
    const utf8Content = x4MergeReadContent(
      x4MergeReadExactProperty(fileObject, "utf8Content", `files[${index}]`),
      `files[${index}].utf8Content`,
      totalBytes,
    );
    files.push({ normalizedRelativePath, utf8Content });
  }

  files.sort((left, right) =>
    x4MergeOrdinalCompare(left.normalizedRelativePath, right.normalizedRelativePath),
  );

  const cases = x4MergeValidateCaseExpectations(
    x4MergeReadExactProperty(input, "cases", "manifest input"),
  );

  return {
    fixtureVersion,
    runId,
    targetGameVersion,
    targetBuildId,
    dependencyOrder,
    files,
    cases,
  };
}

function x4MergeHashUtf8(
  utf8: string,
  sha256Provider: X4MergeOracleSha256,
  label: string,
): string {
  if (typeof sha256Provider !== "function") {
    throw new TypeError("sha256Provider must be a function.");
  }

  let result: unknown;
  try {
    result = sha256Provider(utf8);
  } catch {
    throw new TypeError(`${label} hash provider failed.`);
  }

  if (typeof result !== "string" || !isX4MergeSha256(result)) {
    throw new TypeError(`${label} hash provider must return lowercase SHA-256.`);
  }

  return result;
}

function x4MergeCloneFixtureIdentity(
  identity: X4MergeOracleValidatedFixtureIdentity,
): X4MergeOracleFixtureIdentityInput {
  return {
    fixtureVersion: identity.fixtureVersion,
    runId: identity.runId,
    targetGameVersion: identity.targetGameVersion,
    targetBuildId: identity.targetBuildId,
    dependencyOrder: [...identity.dependencyOrder],
    cases: identity.cases.map((expectation) => ({
      caseId: expectation.caseId,
      expectedObservation: expectation.expectedObservation,
    })),
  };
}

function x4MergeDeriveFixtureHash(
  identity: X4MergeOracleValidatedFixtureIdentity,
  sha256Provider: X4MergeOracleSha256,
): string {
  return x4MergeHashUtf8(
    canonicalX4MergeJson({
      domain: X4_MERGE_ORACLE_FIXTURE_HASH_DOMAIN,
      identity: x4MergeCloneFixtureIdentity(identity),
    }),
    sha256Provider,
    "fixture identity",
  );
}

export function deriveX4MergeOracleFixtureHash(
  identity: X4MergeOracleFixtureIdentityInput,
  sha256Provider: X4MergeOracleSha256,
): string {
  return x4MergeDeriveFixtureHash(
    x4MergeValidateFixtureIdentityInput(identity as unknown),
    sha256Provider,
  );
}

function x4MergeBuildUnsignedManifest(
  input: X4MergeOracleValidatedInput,
  sha256Provider: X4MergeOracleSha256,
): X4MergeOracleUnsignedManifest {
  const fixtureHash = x4MergeDeriveFixtureHash(input, sha256Provider);
  const files: X4MergeOracleFixtureFile[] = [];
  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    files.push({
      normalizedRelativePath: file.normalizedRelativePath,
      utf8Content: file.utf8Content,
      sha256: x4MergeHashUtf8(
        file.utf8Content,
        sha256Provider,
        `files[${index}].utf8Content`,
      ),
    });
  }

  const cases: X4MergeOracleCaseExpectation[] = [];
  for (const expectation of input.cases) {
    cases.push({
      caseId: expectation.caseId,
      expectedObservation: expectation.expectedObservation,
    });
  }

  return {
    fixtureVersion: input.fixtureVersion,
    runId: input.runId,
    targetGameVersion: input.targetGameVersion,
    targetBuildId: input.targetBuildId,
    dependencyOrder: [...input.dependencyOrder],
    fixtureHash,
    files,
    cases,
  };
}

function x4MergeFreezeSignedManifest(
  manifest: X4MergeOracleSignedManifest,
): X4MergeOracleSignedManifest {
  for (const file of manifest.files) {
    Object.freeze(file);
  }
  for (const expectation of manifest.cases) {
    Object.freeze(expectation);
  }

  Object.freeze(manifest.dependencyOrder);
  Object.freeze(manifest.files);
  Object.freeze(manifest.cases);
  return Object.freeze(manifest);
}

function x4MergeCreateSignedManifest(
  unsignedManifest: X4MergeOracleUnsignedManifest,
  sha256Provider: X4MergeOracleSha256,
): X4MergeOracleSignedManifest {
  const manifestSha256 = x4MergeHashUtf8(
    canonicalX4MergeJson(unsignedManifest),
    sha256Provider,
    "manifest",
  );

  return x4MergeFreezeSignedManifest({
    fixtureVersion: unsignedManifest.fixtureVersion,
    runId: unsignedManifest.runId,
    targetGameVersion: unsignedManifest.targetGameVersion,
    targetBuildId: unsignedManifest.targetBuildId,
    dependencyOrder: unsignedManifest.dependencyOrder,
    fixtureHash: unsignedManifest.fixtureHash,
    files: unsignedManifest.files,
    cases: unsignedManifest.cases,
    manifestSha256,
  });
}

export function buildX4MergeFixtureManifest(
  input: X4MergeOracleManifestInput,
  sha256Provider: X4MergeOracleSha256,
): X4MergeOracleSignedManifest {
  const validatedInput = x4MergeValidateManifestInput(input as unknown);
  const unsignedManifest = x4MergeBuildUnsignedManifest(validatedInput, sha256Provider);
  return x4MergeCreateSignedManifest(unsignedManifest, sha256Provider);
}

function x4MergeReadSignedManifest(value: unknown): X4MergeOracleSignedManifest {
  const manifest = x4MergeReadExactPlainObject(
    value,
    X4_MERGE_SIGNED_MANIFEST_KEYS,
    "signed manifest",
  );
  const fixtureVersion = x4MergeValidateFixtureVersion(
    x4MergeReadExactProperty(manifest, "fixtureVersion", "signed manifest"),
  );
  const runId = validateX4MergeIdentifier(
    x4MergeReadExactProperty(manifest, "runId", "signed manifest"),
    "runId",
  );
  const targetGameVersion = validateX4MergeIdentifier(
    x4MergeReadExactProperty(manifest, "targetGameVersion", "signed manifest"),
    "targetGameVersion",
  );
  const targetBuildId = validateX4MergeIdentifier(
    x4MergeReadExactProperty(manifest, "targetBuildId", "signed manifest"),
    "targetBuildId",
  );
  const dependencyOrder = x4MergeValidateDependencyOrder(
    x4MergeReadExactProperty(manifest, "dependencyOrder", "signed manifest"),
  );
  const fixtureHash = x4MergeReadSha256(
    x4MergeReadExactProperty(manifest, "fixtureHash", "signed manifest"),
    "fixtureHash",
  );
  const fileValues = x4MergeReadExactArray(
    x4MergeReadExactProperty(manifest, "files", "signed manifest"),
    "files",
    MAX_X4_MERGE_FIXTURE_FILES,
  );
  const totalBytes = { value: 0 };
  const seenPaths = new Set<string>();
  const files: X4MergeOracleFixtureFile[] = [];

  for (let index = 0; index < fileValues.length; index += 1) {
    const fileObject = x4MergeReadExactPlainObject(
      fileValues[index],
      X4_MERGE_FIXTURE_FILE_KEYS,
      `files[${index}]`,
    );
    const normalizedRelativePath = normalizeX4MergeRelativePath(
      x4MergeReadExactProperty(fileObject, "normalizedRelativePath", `files[${index}]`),
    );
    if (seenPaths.has(normalizedRelativePath)) {
      throw new TypeError(`files[${index}].normalizedRelativePath is duplicated.`);
    }

    if (
      index > 0 &&
      x4MergeOrdinalCompare(files[index - 1].normalizedRelativePath, normalizedRelativePath) >= 0
    ) {
      throw new TypeError("signed manifest files must be in ordinal path order.");
    }

    seenPaths.add(normalizedRelativePath);
    const utf8Content = x4MergeReadContent(
      x4MergeReadExactProperty(fileObject, "utf8Content", `files[${index}]`),
      `files[${index}].utf8Content`,
      totalBytes,
    );
    const sha256 = x4MergeReadSha256(
      x4MergeReadExactProperty(fileObject, "sha256", `files[${index}]`),
      `files[${index}].sha256`,
    );
    files.push({ normalizedRelativePath, utf8Content, sha256 });
  }

  const caseValues = x4MergeReadExactArray(
    x4MergeReadExactProperty(manifest, "cases", "signed manifest"),
    "cases",
    X4_MERGE_ORACLE_CASE_IDS.length,
  );
  if (caseValues.length !== X4_MERGE_ORACLE_CASE_IDS.length) {
    throw new TypeError("signed manifest cases must contain every case exactly once.");
  }

  const cases: X4MergeOracleCaseExpectation[] = [];
  const seenCases = new Set<X4MergeOracleCaseId>();
  for (let index = 0; index < caseValues.length; index += 1) {
    const caseObject = x4MergeReadExactPlainObject(
      caseValues[index],
      X4_MERGE_CASE_EXPECTATION_KEYS,
      `cases[${index}]`,
    );
    const caseId = x4MergeReadCaseId(
      x4MergeReadExactProperty(caseObject, "caseId", `cases[${index}]`),
      `cases[${index}].caseId`,
    );
    if (caseId !== X4_MERGE_ORACLE_CASE_IDS[index]) {
      throw new TypeError("signed manifest cases must use canonical case order.");
    }
    if (seenCases.has(caseId)) {
      throw new TypeError(`cases[${index}].caseId is duplicated.`);
    }

    seenCases.add(caseId);
    cases.push({
      caseId,
      expectedObservation: x4MergeReadObservation(
        x4MergeReadExactProperty(caseObject, "expectedObservation", `cases[${index}]`),
        `cases[${index}].expectedObservation`,
      ),
    });
  }

  const manifestSha256 = x4MergeReadSha256(
    x4MergeReadExactProperty(manifest, "manifestSha256", "signed manifest"),
    "manifestSha256",
  );

  return {
    fixtureVersion,
    runId,
    targetGameVersion,
    targetBuildId,
    dependencyOrder,
    fixtureHash,
    files,
    cases,
    manifestSha256,
  };
}

function x4MergeUnsignedFromSigned(
  manifest: X4MergeOracleSignedManifest,
): X4MergeOracleUnsignedManifest {
  const files: X4MergeOracleFixtureFile[] = [];
  for (const file of manifest.files) {
    files.push({
      normalizedRelativePath: file.normalizedRelativePath,
      utf8Content: file.utf8Content,
      sha256: file.sha256,
    });
  }

  const cases: X4MergeOracleCaseExpectation[] = [];
  for (const expectation of manifest.cases) {
    cases.push({
      caseId: expectation.caseId,
      expectedObservation: expectation.expectedObservation,
    });
  }

  return {
    fixtureVersion: manifest.fixtureVersion,
    runId: manifest.runId,
    targetGameVersion: manifest.targetGameVersion,
    targetBuildId: manifest.targetBuildId,
    dependencyOrder: [...manifest.dependencyOrder],
    fixtureHash: manifest.fixtureHash,
    files,
    cases,
  };
}

function x4MergeVerificationFailure(error: unknown): X4MergeOracleManifestValidationResult {
  const message = error instanceof Error ? error.message : "X4 merge manifest verification failed.";
  return Object.freeze({
    ok: false as const,
    errors: Object.freeze([message]),
  });
}

export function verifyX4MergeFixtureManifest(
  value: unknown,
  sha256Provider: X4MergeOracleSha256,
): X4MergeOracleManifestValidationResult {
  try {
    const manifest = x4MergeReadSignedManifest(value);
    for (let index = 0; index < manifest.files.length; index += 1) {
      const file = manifest.files[index];
      const actualSha256 = x4MergeHashUtf8(
        file.utf8Content,
        sha256Provider,
        `files[${index}].utf8Content`,
      );
      if (actualSha256 !== file.sha256) {
        throw new TypeError(`files[${index}].sha256 does not match utf8Content.`);
      }
    }

    const actualFixtureHash = x4MergeDeriveFixtureHash(manifest, sha256Provider);
    if (actualFixtureHash !== manifest.fixtureHash) {
      throw new TypeError("fixtureHash does not match the canonical fixture identity.");
    }

    const unsignedManifest = x4MergeUnsignedFromSigned(manifest);
    const actualManifestSha256 = x4MergeHashUtf8(
      canonicalX4MergeJson(unsignedManifest),
      sha256Provider,
      "manifest",
    );
    if (actualManifestSha256 !== manifest.manifestSha256) {
      throw new TypeError("manifestSha256 does not match the canonical unsigned manifest.");
    }

    return {
      ok: true,
      manifest: x4MergeFreezeSignedManifest(manifest),
    };
  } catch (error: unknown) {
    return x4MergeVerificationFailure(error);
  }
}

export const X4_MERGE_ORACLE_MARKER_PREFIX = "X4FORGE_MERGE_ORACLE_V1 " as const;

const X4_MERGE_ORACLE_MARKER_SENTINEL = "X4FORGE_MERGE_ORACLE_V1" as const;

export type X4MergeOracleMarkerObservation = "pass" | "fail";

export interface X4MergeOracleStartMarker {
  readonly schemaVersion: typeof X4_MERGE_ORACLE_SCHEMA_VERSION;
  readonly kind: "start";
  readonly runId: string;
  readonly fixtureHash: string;
  readonly targetGameVersion: string;
  readonly targetBuildId: string;
}

export interface X4MergeOracleCaseMarker {
  readonly schemaVersion: typeof X4_MERGE_ORACLE_SCHEMA_VERSION;
  readonly kind: "case";
  readonly runId: string;
  readonly fixtureHash: string;
  readonly caseId: X4MergeOracleCaseId;
  readonly observation: X4MergeOracleMarkerObservation;
  readonly detail: string;
}

export interface X4MergeOracleEndMarker {
  readonly schemaVersion: typeof X4_MERGE_ORACLE_SCHEMA_VERSION;
  readonly kind: "end";
  readonly runId: string;
  readonly fixtureHash: string;
}

export type X4MergeOracleMarker =
  | X4MergeOracleStartMarker
  | X4MergeOracleCaseMarker
  | X4MergeOracleEndMarker;

const MAX_X4_MERGE_MARKER_DETAIL_BYTES = 4_096;
const X4_MERGE_MARKER_DETAIL = /^[\u0020-\u007e]*$/u;

const X4_MERGE_START_MARKER_KEYS = [
  "schemaVersion",
  "kind",
  "runId",
  "fixtureHash",
  "targetGameVersion",
  "targetBuildId",
] as const;

const X4_MERGE_CASE_MARKER_KEYS = [
  "schemaVersion",
  "kind",
  "runId",
  "fixtureHash",
  "caseId",
  "observation",
  "detail",
] as const;

const X4_MERGE_END_MARKER_KEYS = [
  "schemaVersion",
  "kind",
  "runId",
  "fixtureHash",
] as const;

function x4MergeReadMarkerKind(value: unknown): X4MergeOracleMarker["kind"] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("marker must be a plain object.");
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("marker must be a plain object.");
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError("marker cannot contain symbol keys.");
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, "kind");
  if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
    throw new TypeError("marker.kind must be an enumerable data property.");
  }

  if (descriptor.value === "start" || descriptor.value === "case" || descriptor.value === "end") {
    return descriptor.value;
  }

  throw new TypeError("marker.kind must be start, case, or end.");
}

function x4MergeReadMarkerSchemaVersion(marker: object): typeof X4_MERGE_ORACLE_SCHEMA_VERSION {
  const schemaVersion = validateX4MergeIdentifier(
    x4MergeReadExactProperty(marker, "schemaVersion", "marker"),
    "schemaVersion",
  );
  if (schemaVersion !== X4_MERGE_ORACLE_SCHEMA_VERSION) {
    throw new TypeError("marker.schemaVersion does not match the X4 merge oracle schema.");
  }

  return schemaVersion;
}

function x4MergeReadMarkerObservation(value: unknown): X4MergeOracleMarkerObservation {
  if (value === "pass" || value === "fail") {
    return value;
  }

  throw new TypeError("marker.observation must be pass or fail.");
}

function x4MergeReadMarkerDetail(value: unknown): string {
  if (typeof value !== "string" || !X4_MERGE_MARKER_DETAIL.test(value)) {
    throw new TypeError("marker.detail must contain only printable ASCII characters.");
  }

  if (x4MergeUtf8ByteLength(value) > MAX_X4_MERGE_MARKER_DETAIL_BYTES) {
    throw new RangeError("marker.detail exceeds the UTF-8 byte bound.");
  }

  return value;
}

function x4MergeReadMarkerCommon(marker: object): {
  readonly schemaVersion: typeof X4_MERGE_ORACLE_SCHEMA_VERSION;
  readonly runId: string;
  readonly fixtureHash: string;
} {
  return {
    schemaVersion: x4MergeReadMarkerSchemaVersion(marker),
    runId: validateX4MergeIdentifier(
      x4MergeReadExactProperty(marker, "runId", "marker"),
      "marker.runId",
    ),
    fixtureHash: x4MergeReadSha256(
      x4MergeReadExactProperty(marker, "fixtureHash", "marker"),
      "marker.fixtureHash",
    ),
  };
}

function x4MergeNormalizeMarker(value: unknown): X4MergeOracleMarker {
  const kind = x4MergeReadMarkerKind(value);

  if (kind === "start") {
    const marker = x4MergeReadExactPlainObject(value, X4_MERGE_START_MARKER_KEYS, "start marker");
    const common = x4MergeReadMarkerCommon(marker);
    const normalized: X4MergeOracleStartMarker = {
      schemaVersion: common.schemaVersion,
      kind,
      runId: common.runId,
      fixtureHash: common.fixtureHash,
      targetGameVersion: validateX4MergeIdentifier(
        x4MergeReadExactProperty(marker, "targetGameVersion", "start marker"),
        "marker.targetGameVersion",
      ),
      targetBuildId: validateX4MergeIdentifier(
        x4MergeReadExactProperty(marker, "targetBuildId", "start marker"),
        "marker.targetBuildId",
      ),
    };
    return Object.freeze(normalized);
  }

  if (kind === "case") {
    const marker = x4MergeReadExactPlainObject(value, X4_MERGE_CASE_MARKER_KEYS, "case marker");
    const common = x4MergeReadMarkerCommon(marker);
    const normalized: X4MergeOracleCaseMarker = {
      schemaVersion: common.schemaVersion,
      kind,
      runId: common.runId,
      fixtureHash: common.fixtureHash,
      caseId: x4MergeReadCaseId(
        x4MergeReadExactProperty(marker, "caseId", "case marker"),
        "marker.caseId",
      ),
      observation: x4MergeReadMarkerObservation(
        x4MergeReadExactProperty(marker, "observation", "case marker"),
      ),
      detail: x4MergeReadMarkerDetail(
        x4MergeReadExactProperty(marker, "detail", "case marker"),
      ),
    };
    return Object.freeze(normalized);
  }

  const marker = x4MergeReadExactPlainObject(value, X4_MERGE_END_MARKER_KEYS, "end marker");
  const common = x4MergeReadMarkerCommon(marker);
  const normalized: X4MergeOracleEndMarker = {
    schemaVersion: common.schemaVersion,
    kind,
    runId: common.runId,
    fixtureHash: common.fixtureHash,
  };
  return Object.freeze(normalized);
}

export function encodeX4MergeOracleMarker(value: X4MergeOracleMarker): string {
  const normalized = x4MergeNormalizeMarker(value as unknown);
  return `${X4_MERGE_ORACLE_MARKER_PREFIX}${canonicalX4MergeJson(normalized)}`;
}

export interface X4MergeOracleParsedMarkerRecord {
  readonly lineNumber: number;
  readonly marker: X4MergeOracleMarker;
}

export interface X4MergeOracleLogWindowParseSuccess {
  readonly ok: true;
  readonly markers: readonly X4MergeOracleParsedMarkerRecord[];
  readonly defects: readonly string[];
}

export interface X4MergeOracleLogWindowParseFailure {
  readonly ok: false;
  readonly markers: readonly X4MergeOracleParsedMarkerRecord[];
  readonly defects: readonly string[];
}

export type X4MergeOracleLogWindowParseResult =
  | X4MergeOracleLogWindowParseSuccess
  | X4MergeOracleLogWindowParseFailure;

const MAX_X4_MERGE_LOG_WINDOW_BYTES = 16 * 1_048_576;
const MAX_X4_MERGE_LOG_LINES = 200_000;
const MAX_X4_MERGE_LOG_LINE_BYTES = 65_536;
const MAX_X4_MERGE_LOG_MARKERS = 128;

function x4MergeFreezeLogParseResult(
  markers: readonly X4MergeOracleParsedMarkerRecord[],
  defects: readonly string[],
): X4MergeOracleLogWindowParseResult {
  const frozenMarkers = Object.freeze([...markers]);
  const frozenDefects = Object.freeze([...defects]);

  if (frozenDefects.length === 0) {
    return Object.freeze({
      ok: true as const,
      markers: frozenMarkers,
      defects: frozenDefects,
    });
  }

  return Object.freeze({
    ok: false as const,
    markers: frozenMarkers,
    defects: frozenDefects,
  });
}

function x4MergeLogLineDefect(lineNumber: number, message: string): string {
  return `line ${lineNumber}: ${message}`;
}

export function parseX4MergeOracleLogWindow(value: unknown): X4MergeOracleLogWindowParseResult {
  try {
    if (typeof value !== "string") {
      return x4MergeFreezeLogParseResult([], ["log window must be a string."]);
    }

    if (
      value.length > MAX_X4_MERGE_LOG_WINDOW_BYTES ||
      x4MergeUtf8ByteLength(value) > MAX_X4_MERGE_LOG_WINDOW_BYTES
    ) {
      return x4MergeFreezeLogParseResult([], ["log window exceeds the UTF-8 byte bound."]);
    }

    let lineCount = 1;
    for (let index = 0; index < value.length; index += 1) {
      if (value.charCodeAt(index) === 10) {
        lineCount += 1;
        if (lineCount > MAX_X4_MERGE_LOG_LINES) {
          return x4MergeFreezeLogParseResult([], ["log window exceeds the line-count bound."]);
        }
      }
    }

    const markers: X4MergeOracleParsedMarkerRecord[] = [];
    const defects: string[] = [];
    const lines = value.split("\n");
    let markerLineCount = 0;
    let markerLimitReported = false;

    for (let index = 0; index < lines.length; index += 1) {
      const lineNumber = index + 1;
      const rawLine = lines[index];
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

      if (
        line.length > MAX_X4_MERGE_LOG_LINE_BYTES ||
        x4MergeUtf8ByteLength(line) > MAX_X4_MERGE_LOG_LINE_BYTES
      ) {
        defects.push(x4MergeLogLineDefect(lineNumber, "line exceeds the UTF-8 byte bound."));
        continue;
      }

      if (!line.includes(X4_MERGE_ORACLE_MARKER_SENTINEL)) {
        continue;
      }

      markerLineCount += 1;
      if (markerLineCount > MAX_X4_MERGE_LOG_MARKERS) {
        if (!markerLimitReported) {
          defects.push(x4MergeLogLineDefect(lineNumber, "marker count exceeds the bound."));
          markerLimitReported = true;
        }
        continue;
      }

      let sentinelCount = 0;
      let sentinelSearchOffset = 0;
      while (sentinelSearchOffset <= line.length - X4_MERGE_ORACLE_MARKER_SENTINEL.length) {
        const foundIndex = line.indexOf(X4_MERGE_ORACLE_MARKER_SENTINEL, sentinelSearchOffset);
        if (foundIndex < 0) {
          break;
        }

        sentinelCount += 1;
        if (sentinelCount > 1) {
          break;
        }

        sentinelSearchOffset = foundIndex + X4_MERGE_ORACLE_MARKER_SENTINEL.length;
      }

      if (sentinelCount > 1) {
        defects.push(x4MergeLogLineDefect(lineNumber, "marker sentinel occurs more than once."));
        continue;
      }

      let prefixCount = 0;
      let prefixIndex = -1;
      let searchOffset = 0;
      while (searchOffset <= line.length - X4_MERGE_ORACLE_MARKER_PREFIX.length) {
        const foundIndex = line.indexOf(X4_MERGE_ORACLE_MARKER_PREFIX, searchOffset);
        if (foundIndex < 0) {
          break;
        }

        prefixCount += 1;
        if (prefixIndex < 0) {
          prefixIndex = foundIndex;
        }
        if (prefixCount > 1) {
          break;
        }

        searchOffset = foundIndex + X4_MERGE_ORACLE_MARKER_PREFIX.length;
      }

      if (prefixCount === 0) {
        defects.push(x4MergeLogLineDefect(lineNumber, "marker sentinel has an invalid prefix."));
        continue;
      }
      if (prefixCount > 1) {
        defects.push(x4MergeLogLineDefect(lineNumber, "marker prefix occurs more than once."));
        continue;
      }

      const jsonText = line.slice(prefixIndex + X4_MERGE_ORACLE_MARKER_PREFIX.length);
      if (jsonText.length < 2 || jsonText.charCodeAt(0) !== 123 || jsonText.charCodeAt(jsonText.length - 1) !== 125) {
        defects.push(x4MergeLogLineDefect(lineNumber, "marker must end with one complete JSON object."));
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText) as unknown;
      } catch {
        defects.push(x4MergeLogLineDefect(lineNumber, "marker JSON is malformed."));
        continue;
      }

      try {
        const marker = x4MergeNormalizeMarker(parsed);
        markers.push(Object.freeze({ lineNumber, marker }));
      } catch {
        defects.push(x4MergeLogLineDefect(lineNumber, "marker data violates the strict contract."));
      }
    }

    return x4MergeFreezeLogParseResult(markers, defects);
  } catch {
    return x4MergeFreezeLogParseResult([], ["log window parsing failed safely."]);
  }
}

interface X4MergeOracleCaseMarkerPosition {
  readonly markerIndex: number;
  readonly marker: X4MergeOracleCaseMarker;
}

function x4MergeFreezeEvidenceResult(
  status: X4MergeOracleEvidenceStatus,
  runId: string | null,
  fixtureHash: string | null,
  manifestSha256: string | null,
  logWindowSha256: string | null,
  verdicts: readonly X4MergeOracleCaseVerdict[],
  defects: readonly string[],
): X4MergeOracleEvidenceResult {
  for (const verdict of verdicts) {
    Object.freeze(verdict);
  }

  return Object.freeze({
    status,
    runId,
    fixtureHash,
    manifestSha256,
    logWindowSha256,
    verdicts: Object.freeze([...verdicts]),
    defects: Object.freeze([...defects]),
  });
}

function x4MergeEvaluateMarkerSequence(
  manifest: X4MergeOracleSignedManifest,
  records: readonly X4MergeOracleParsedMarkerRecord[],
  defects: string[],
): X4MergeOracleCaseVerdict[] {
  const expectedMarkerCount = X4_MERGE_ORACLE_CASE_IDS.length + 2;
  if (records.length !== expectedMarkerCount) {
    defects.push("marker sequence does not contain exactly start, nine cases, and end.");
  }

  const casePositions = new Map<X4MergeOracleCaseId, X4MergeOracleCaseMarkerPosition[]>();
  for (const caseId of X4_MERGE_ORACLE_CASE_IDS) {
    casePositions.set(caseId, []);
  }

  let startCount = 0;
  let endCount = 0;
  let firstEndIndex = -1;

  for (let markerIndex = 0; markerIndex < records.length; markerIndex += 1) {
    const record = records[markerIndex];
    const marker = record.marker;

    if (marker.runId !== manifest.runId) {
      defects.push(x4MergeLogLineDefect(record.lineNumber, "marker runId does not match the manifest."));
    }
    if (marker.fixtureHash !== manifest.fixtureHash) {
      defects.push(
        x4MergeLogLineDefect(record.lineNumber, "marker fixtureHash does not match the manifest."),
      );
    }

    if (marker.kind === "start") {
      startCount += 1;
      if (marker.targetGameVersion !== manifest.targetGameVersion) {
        defects.push(
          x4MergeLogLineDefect(record.lineNumber, "start targetGameVersion does not match the manifest."),
        );
      }
      if (marker.targetBuildId !== manifest.targetBuildId) {
        defects.push(
          x4MergeLogLineDefect(record.lineNumber, "start targetBuildId does not match the manifest."),
        );
      }
    } else if (marker.kind === "case") {
      casePositions.get(marker.caseId)?.push({ markerIndex, marker });
    } else {
      endCount += 1;
      if (firstEndIndex < 0) {
        firstEndIndex = markerIndex;
      }
    }
  }

  if (startCount === 0) {
    defects.push("start marker is missing.");
  } else if (startCount > 1) {
    defects.push("start marker is duplicated.");
  }
  if (endCount === 0) {
    defects.push("end marker is missing.");
  } else if (endCount > 1) {
    defects.push("end marker is duplicated.");
  }
  if (firstEndIndex >= 0 && firstEndIndex < records.length - 1) {
    defects.push("marker content appears after the first end marker.");
  }

  const comparedLength = Math.min(records.length, expectedMarkerCount);
  for (let markerIndex = 0; markerIndex < comparedLength; markerIndex += 1) {
    const marker = records[markerIndex].marker;
    let positionMatches = false;

    if (markerIndex === 0) {
      positionMatches = marker.kind === "start";
    } else if (markerIndex === expectedMarkerCount - 1) {
      positionMatches = marker.kind === "end";
    } else {
      positionMatches =
        marker.kind === "case" && marker.caseId === X4_MERGE_ORACLE_CASE_IDS[markerIndex - 1];
    }

    if (!positionMatches) {
      defects.push(`marker at sequence position ${markerIndex + 1} is unexpected or out of order.`);
    }
  }

  if (records.length > expectedMarkerCount) {
    defects.push("marker content appears after the required end position.");
  }

  const verdicts: X4MergeOracleCaseVerdict[] = [];
  for (let caseIndex = 0; caseIndex < manifest.cases.length; caseIndex += 1) {
    const expectation = manifest.cases[caseIndex];
    const positions = casePositions.get(expectation.caseId) ?? [];

    if (positions.length === 0) {
      defects.push(`case ${expectation.caseId} marker is missing.`);
      verdicts.push({
        caseId: expectation.caseId,
        expectedObservation: expectation.expectedObservation,
        status: "failed",
      });
      continue;
    }

    if (positions.length > 1) {
      defects.push(`case ${expectation.caseId} marker is duplicated.`);
    }

    const evidence = positions[0];
    const identityMatches =
      evidence.marker.runId === manifest.runId &&
      evidence.marker.fixtureHash === manifest.fixtureHash;
    const positionMatches = evidence.markerIndex === caseIndex + 1;

    let status: X4MergeOracleEvidenceStatus;
    if (expectation.expectedObservation === "pending") {
      status = "unavailable";
    } else if (
      positions.length !== 1 ||
      !identityMatches ||
      !positionMatches ||
      evidence.marker.observation !== expectation.expectedObservation
    ) {
      status = "failed";
      if (evidence.marker.observation !== expectation.expectedObservation) {
        defects.push(`case ${expectation.caseId} observation does not match its expectation.`);
      }
    } else {
      status = "green";
    }

    verdicts.push({
      caseId: expectation.caseId,
      expectedObservation: expectation.expectedObservation,
      status,
      observedObservation: evidence.marker.observation,
      detail: evidence.marker.detail,
    });
  }

  return verdicts;
}

export function evaluateX4MergeOracleEvidence(
  manifestValue: unknown,
  logWindowValue: unknown,
  sha256Provider: X4MergeOracleSha256,
): X4MergeOracleEvidenceResult {
  try {
    const manifestResult = verifyX4MergeFixtureManifest(manifestValue, sha256Provider);
    const parseResult = parseX4MergeOracleLogWindow(logWindowValue);
    const defects: string[] = [];

    if (!manifestResult.ok) {
      defects.push("signed manifest verification failed.");
    }
    for (const parserDefect of parseResult.defects) {
      defects.push(`log ${parserDefect}`);
    }

    let logWindowSha256: string | null = null;
    if (typeof logWindowValue === "string") {
      try {
        if (
          logWindowValue.length <= MAX_X4_MERGE_LOG_WINDOW_BYTES &&
          x4MergeUtf8ByteLength(logWindowValue) <= MAX_X4_MERGE_LOG_WINDOW_BYTES
        ) {
          logWindowSha256 = x4MergeHashUtf8(logWindowValue, sha256Provider, "log window");
        }
      } catch {
        defects.push("log window SHA-256 provider failed validation.");
      }
    }

    if (!manifestResult.ok) {
      return x4MergeFreezeEvidenceResult(
        "failed",
        null,
        null,
        null,
        logWindowSha256,
        [],
        defects,
      );
    }

    const manifest = manifestResult.manifest;
    const verdicts = x4MergeEvaluateMarkerSequence(manifest, parseResult.markers, defects);
    const hasFailedCase = verdicts.some((verdict) => verdict.status === "failed");
    const hasUnavailableCase = verdicts.some((verdict) => verdict.status === "unavailable");

    let status: X4MergeOracleEvidenceStatus;
    if (defects.length > 0 || hasFailedCase || logWindowSha256 === null) {
      status = "failed";
    } else if (hasUnavailableCase) {
      status = "unavailable";
    } else {
      status = "green";
    }

    return x4MergeFreezeEvidenceResult(
      status,
      manifest.runId,
      manifest.fixtureHash,
      manifest.manifestSha256,
      logWindowSha256,
      verdicts,
      defects,
    );
  } catch {
    return x4MergeFreezeEvidenceResult(
      "failed",
      null,
      null,
      null,
      null,
      [],
      ["evidence evaluation failed safely."],
    );
  }
}
