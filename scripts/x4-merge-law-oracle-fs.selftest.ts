import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs, {
  type MakeDirectoryOptions,
  type Mode,
  type ObjectEncodingOptions,
  type PathLike,
  type PathOrFileDescriptor,
  type RmDirOptions,
  type RmOptions,
  type WriteFileOptions,
} from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import * as path from "node:path";

import {
  buildX4MergeFixtureManifest,
  canonicalX4MergeJson,
  type X4MergeOracleSignedManifest,
} from "../src/lib/x4MergeLawOracle";
import {
  X4_MERGE_LAW_ORACLE_TARGET_MD_PATH,
  buildX4MergeLawOracleFixture,
} from "../src/lib/x4MergeLawOracleFixture";
import {
  X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME,
  buildX4MergeLawOracleStagingPlan,
  cleanupX4MergeLawOracleFixture,
  inspectX4MergeLawOracleStagingTargets,
  stageX4MergeLawOracleFixture,
  validateX4MergeLawOracleExtensionsRoot,
  type X4MergeLawOracleExtensionStagingPlan,
  type X4MergeLawOracleStagingPlanSuccess,
} from "../src/server/x4MergeLawOracleFs";

interface NamedCase {
  readonly name: string;
  readonly run: () => void;
}

interface DisposableFixtureRoot {
  readonly absoluteRoot: string;
  readonly extensionsRoot: string;
  readonly manifest: X4MergeOracleSignedManifest;
}

type FsMkdirSync = (
  path: PathLike,
  options?: Mode | MakeDirectoryOptions | null,
) => string | undefined;
type FsReaddirSync = (
  path: PathLike,
  options?:
    | (ObjectEncodingOptions & {
        readonly withFileTypes?: false;
        readonly recursive?: boolean;
      })
    | BufferEncoding
    | null,
) => string[];
type FsRenameSync = (oldPath: PathLike, newPath: PathLike) => void;
type FsRmdirSync = (path: PathLike, options?: RmDirOptions) => void;
type FsRmSync = (path: PathLike, options?: RmOptions) => void;
type FsUnlinkSync = (path: PathLike) => void;
type FsWriteFileSync = (
  file: PathOrFileDescriptor,
  data: string | NodeJS.ArrayBufferView,
  options?: WriteFileOptions,
) => void;

interface PatchedFsMethods {
  mkdirSync: FsMkdirSync;
  readdirSync: FsReaddirSync;
  renameSync: FsRenameSync;
  rmdirSync: FsRmdirSync;
  rmSync: FsRmSync;
  unlinkSync: FsUnlinkSync;
  writeFileSync: FsWriteFileSync;
}

type PatchedFsMethod = keyof PatchedFsMethods;
type PatchedFsMutation = Exclude<PatchedFsMethod, "readdirSync">;

const TEST_RESULTS_ROOT = path.resolve(process.cwd(), "test-results");
const TEMP_PREFIX = ".tmp-x4merge-fs-";
const TEMP_PREFIX_PATH = path.join(TEST_RESULTS_ROOT, TEMP_PREFIX);
const STAGE_TRANSACTION_PATTERN = /^\.x4forge-merge-law-oracle-stage-[0-9a-f]{32}$/u;
const STAGE_OWNER_FILENAME = ".x4forge-merge-law-oracle-stage-owner.json";
const RETIRED_MD_PATH = "md/x4forge_merge_oracle.xml";
const CLEANUP_INCOMPLETE_ERROR =
  "The X4 merge-oracle fixture cleanup started but did not complete safely.";
const STAGE_FAILED_ERROR =
  "The X4 merge-oracle transactional staging operation failed safely.";
const STAGE_RESIDUE_ERROR =
  "The X4 merge-oracle transaction failed and may contain guarded residue.";
const ROLLBACK_INCOMPLETE_ERROR =
  "The X4 merge-oracle rollback stopped because owned state could not be verified safely.";
const MUTATION_NAMES: readonly PatchedFsMutation[] = [
  "mkdirSync",
  "writeFileSync",
  "renameSync",
  "unlinkSync",
  "rmdirSync",
  "rmSync",
];
const PATCHABLE_NAMES: readonly PatchedFsMethod[] = [...MUTATION_NAMES, "readdirSync"];

const mutableFs = fs as unknown as PatchedFsMethods;
const originalFsMethods: Readonly<PatchedFsMethods> = Object.freeze({
  mkdirSync: mutableFs.mkdirSync,
  readdirSync: mutableFs.readdirSync,
  renameSync: mutableFs.renameSync,
  rmdirSync: mutableFs.rmdirSync,
  rmSync: mutableFs.rmSync,
  unlinkSync: mutableFs.unlinkSync,
  writeFileSync: mutableFs.writeFileSync,
});
const namedCases: NamedCase[] = [];
const activeRoots = new Set<string>();
let assertionCount = 0;
let fixtureSequence = 0;
let activePatchCount = 0;

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

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function guardedDisposableRoot(absoluteRoot: string): string {
  const resolved = path.resolve(absoluteRoot);
  assert.equal(path.dirname(resolved), TEST_RESULTS_ROOT);
  assert.ok(path.basename(resolved).startsWith(TEMP_PREFIX));
  assert.ok(resolved.startsWith(TEMP_PREFIX_PATH));
  return resolved;
}

function removeDisposableRoot(absoluteRoot: string): void {
  const guarded = guardedDisposableRoot(absoluteRoot);
  fs.rmSync(guarded, { recursive: true, force: true });
  assert.equal(fs.existsSync(guarded), false);
  activeRoots.delete(guarded);
}

function buildFixture(): X4MergeOracleSignedManifest {
  fixtureSequence += 1;
  return buildX4MergeLawOracleFixture(
    {
      runId: `fs_selftest_${fixtureSequence}`,
      targetGameVersion: "9.00",
      targetBuildId: "fs-selftest",
    },
    sha256Utf8,
  );
}

function manifestWithInvalidPathCharacter(
  manifest: X4MergeOracleSignedManifest,
  character: string,
): X4MergeOracleSignedManifest {
  return buildX4MergeFixtureManifest(
    {
      fixtureVersion: manifest.fixtureVersion,
      runId: manifest.runId,
      targetGameVersion: manifest.targetGameVersion,
      targetBuildId: manifest.targetBuildId,
      dependencyOrder: [...manifest.dependencyOrder],
      files: manifest.files.map((file, index) => ({
        normalizedRelativePath: index === 0
          ? file.normalizedRelativePath.replace("content.xml", `content${character}.xml`)
          : file.normalizedRelativePath,
        utf8Content: file.utf8Content,
      })),
      cases: manifest.cases.map(caseExpectation => ({ ...caseExpectation })),
    },
    sha256Utf8,
  );
}

function withDisposableFixtureRoot<T>(
  label: string,
  run: (fixture: DisposableFixtureRoot) => T,
): T {
  const safeLabel = label.replace(/[^A-Za-z0-9_-]/gu, "-").slice(0, 36);
  const absoluteRoot = guardedDisposableRoot(path.join(
    TEST_RESULTS_ROOT,
    `${TEMP_PREFIX}${safeLabel}-${randomBytes(12).toString("hex")}`,
  ));
  const extensionsRoot = path.join(absoluteRoot, "extensions");
  fs.mkdirSync(absoluteRoot);
  activeRoots.add(absoluteRoot);
  fs.mkdirSync(extensionsRoot);
  try {
    return run({ absoluteRoot, extensionsRoot, manifest: buildFixture() });
  } finally {
    removeDisposableRoot(absoluteRoot);
  }
}

function restoreFsMethod<K extends PatchedFsMethod>(name: K): void {
  mutableFs[name] = originalFsMethods[name];
}

function restoreFsMutations(): void {
  for (const name of PATCHABLE_NAMES) restoreFsMethod(name);
  syncBuiltinESMExports();
  activePatchCount = 0;
}

function withFsPatch<K extends PatchedFsMethod, T>(
  name: K,
  replacement: (original: PatchedFsMethods[K]) => PatchedFsMethods[K],
  run: () => T,
): T {
  const original = mutableFs[name];
  mutableFs[name] = replacement(original);
  activePatchCount += 1;
  syncBuiltinESMExports();
  try {
    return run();
  } finally {
    mutableFs[name] = original;
    activePatchCount -= 1;
    syncBuiltinESMExports();
  }
}

function withCountedMutations<T>(run: () => T): { readonly value: T; readonly count: number } {
  let count = 0;
  const countCalls = <Args extends unknown[], Result>(
    original: (...args: Args) => Result,
  ): ((...args: Args) => Result) => (...args: Args): Result => {
    count += 1;
    return original(...args);
  };
  const install = (index: number): T => {
    if (index === MUTATION_NAMES.length) return run();
    const name = MUTATION_NAMES[index];
    switch (name) {
      case "mkdirSync":
        return withFsPatch(name, original => countCalls(original), () => install(index + 1));
      case "renameSync":
        return withFsPatch(name, original => countCalls(original), () => install(index + 1));
      case "rmdirSync":
        return withFsPatch(name, original => countCalls(original), () => install(index + 1));
      case "rmSync":
        return withFsPatch(name, original => countCalls(original), () => install(index + 1));
      case "unlinkSync":
        return withFsPatch(name, original => countCalls(original), () => install(index + 1));
      case "writeFileSync":
        return withFsPatch(name, original => countCalls(original), () => install(index + 1));
    }
  };
  return { value: install(0), count };
}

function inventoryFingerprint(root: string): string {
  const records: string[] = [];
  const visit = (absolutePath: string, relativePath: string): void => {
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      records.push(`L\t${relativePath}\t${fs.readlinkSync(absolutePath)}`);
      return;
    }
    if (stat.isDirectory()) {
      records.push(`D\t${relativePath}`);
      const entries = fs.readdirSync(absolutePath, { encoding: "utf8" }).sort();
      for (const entry of entries) {
        visit(path.join(absolutePath, entry), relativePath.length === 0 ? entry : `${relativePath}/${entry}`);
      }
      return;
    }
    if (stat.isFile()) {
      const bytes = fs.readFileSync(absolutePath);
      records.push(`F\t${relativePath}\t${bytes.byteLength}\t${sha256Bytes(bytes)}`);
      return;
    }
    records.push(`O\t${relativePath}\t${stat.mode}`);
  };
  visit(root, "");
  return sha256Utf8(records.join("\n"));
}

function planFor(fixture: DisposableFixtureRoot): X4MergeLawOracleStagingPlanSuccess {
  const plan = buildX4MergeLawOracleStagingPlan(fixture.extensionsRoot, fixture.manifest);
  assert.equal(plan.ok, true);
  return plan as X4MergeLawOracleStagingPlanSuccess;
}

function stagedPlan(fixture: DisposableFixtureRoot): X4MergeLawOracleStagingPlanSuccess {
  const result = stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.state, "staged");
  return result.ok ? result.plan : assert.fail("staging must succeed");
}

function exactFile(
  extension: X4MergeLawOracleExtensionStagingPlan,
  suffix: string,
): string {
  const file = extension.files.find(candidate => candidate.normalizedRelativePath.endsWith(suffix));
  assert.ok(file, `planned file must exist: ${suffix}`);
  return file.absolutePath;
}

function transactionEntries(extensionsRoot: string): string[] {
  return fs.readdirSync(extensionsRoot, { encoding: "utf8" })
    .filter(entry => STAGE_TRANSACTION_PATTERN.test(entry));
}

function expectFrozenFailure(
  result: { readonly ok: boolean; readonly errors?: readonly string[] },
  message: string,
): asserts result is { readonly ok: false; readonly errors: readonly string[] } {
  expectEqual(result.ok, false, message);
  expect(Object.isFrozen(result), `${message}: result must be frozen`);
  expect(Array.isArray(result.errors), `${message}: errors must be an array`);
  expect(Object.isFrozen(result.errors), `${message}: errors must be frozen`);
}

function expectPlanDeepFrozen(plan: X4MergeLawOracleStagingPlanSuccess, message: string): void {
  expect(Object.isFrozen(plan), `${message}: plan must be frozen`);
  expect(Object.isFrozen(plan.dependencyOrder), `${message}: dependency order must be frozen`);
  expect(Object.isFrozen(plan.extensions), `${message}: extensions must be frozen`);
  expect(Object.isFrozen(plan.files), `${message}: files must be frozen`);
  expect(plan.extensions.every(extension => Object.isFrozen(extension)), `${message}: extension plans must be frozen`);
  expect(plan.extensions.every(extension => Object.isFrozen(extension.files)), `${message}: extension file arrays must be frozen`);
  expect(plan.files.every(file => Object.isFrozen(file)), `${message}: planned files must be frozen`);
}

function replaceExtensionWithForeign(
  fixture: DisposableFixtureRoot,
  extension: X4MergeLawOracleExtensionStagingPlan,
): void {
  fs.rmSync(extension.absoluteRoot, { recursive: true, force: true });
  fs.mkdirSync(extension.absoluteRoot);
  fs.writeFileSync(path.join(extension.absoluteRoot, "foreign.txt"), "foreign\n", "utf8");
}

function createDirectoryLink(target: string, link: string): void {
  fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
  const stat = fs.lstatSync(link);
  assert.ok(stat.isSymbolicLink(), "test link must be visible to lstat");
}

function assertPlannedExtensionBytes(extension: X4MergeLawOracleExtensionStagingPlan): void {
  for (const file of extension.files) {
    expectDeepEqual(
      fs.readFileSync(file.absolutePath),
      Buffer.from(file.utf8Content, "utf8"),
      `planned bytes must remain exact for ${file.normalizedRelativePath}`,
    );
  }
}

function currentTempRemnants(): string[] {
  return fs.readdirSync(TEST_RESULTS_ROOT, { encoding: "utf8" })
    .filter(entry => entry.startsWith(TEMP_PREFIX))
    .sort();
}

test("strict root validation accepts only a direct physical extensions directory", () => {
  withDisposableFixtureRoot("root-validation", fixture => {
    const valid = expectNoThrow(
      () => validateX4MergeLawOracleExtensionsRoot(fixture.extensionsRoot),
      "valid root must not throw",
    );
    expectEqual(valid.ok, true, "direct disposable extensions root must validate");
    expect(Object.isFrozen(valid), "valid root result must be frozen");
    if (valid.ok) {
      expectEqual(valid.declaredRoot, path.resolve(fixture.extensionsRoot), "declared root must be absolute");
      expectEqual(valid.physicalRoot, fs.realpathSync.native(fixture.extensionsRoot), "physical root must be exact");
    }

    const lexicalTraversal = `${fixture.extensionsRoot}${path.sep}..${path.sep}extensions`;
    const lexicalDot = `${path.dirname(fixture.extensionsRoot)}${path.sep}.${path.sep}extensions`;
    const hostileInputs: unknown[] = [
      "extensions",
      fixture.absoluteRoot,
      lexicalTraversal,
      lexicalDot,
      ` ${fixture.extensionsRoot}`,
      `${fixture.extensionsRoot} `,
      null,
      17,
      {},
    ];
    for (const hostile of hostileInputs) {
      const result = expectNoThrow(
        () => validateX4MergeLawOracleExtensionsRoot(hostile),
        "hostile root input must not throw",
      );
      expectFrozenFailure(result, "hostile root input must fail closed");
    }

    const fileParent = path.join(fixture.absoluteRoot, "file-parent");
    const fileRoot = path.join(fileParent, "extensions");
    fs.mkdirSync(fileParent);
    fs.writeFileSync(fileRoot, "not a directory\n", "utf8");
    expectFrozenFailure(
      validateX4MergeLawOracleExtensionsRoot(fileRoot),
      "file-valued extensions root must fail",
    );
  });
});

test("strict signed plan is physically contained, deeply frozen, and tamper rejecting", () => {
  withDisposableFixtureRoot("plan", fixture => {
    const plan = planFor(fixture);
    expectEqual(plan.extensions.length, 3, "plan must contain three ordered extensions");
    expectEqual(plan.files.length, 9, "plan must contain six fixture files and three owner markers");
    expectDeepEqual(plan.dependencyOrder, fixture.manifest.dependencyOrder, "dependency order must be preserved");
    expectEqual(plan.runId, fixture.manifest.runId, "plan must bind runId");
    expectEqual(plan.fixtureHash, fixture.manifest.fixtureHash, "plan must bind fixtureHash");
    expectEqual(plan.manifestSha256, fixture.manifest.manifestSha256, "plan must bind manifest hash");
    expectEqual(
      plan.files.filter(file => file.kind === "fixture" && file.normalizedRelativePath.endsWith(`/${X4_MERGE_LAW_ORACLE_TARGET_MD_PATH}`)).length,
      3,
      "plan must own exactly one vanilla setup MD target per extension",
    );
    expectEqual(
      plan.files.filter(file => file.normalizedRelativePath.endsWith(`/${RETIRED_MD_PATH}`)).length,
      0,
      "plan must not retain the retired x4forge_merge_oracle.xml target",
    );
    for (const file of plan.files) {
      const relative = path.relative(plan.physicalRoot, file.absolutePath);
      expect(relative.length > 0 && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), "planned file must stay beneath root");
      expectEqual(file.sha256, sha256Utf8(file.utf8Content), "planned hash must match exact UTF-8 bytes");
    }
    expectPlanDeepFrozen(plan, "valid plan");

    const tampered = JSON.parse(canonicalX4MergeJson(fixture.manifest)) as {
      files: Array<{ utf8Content: string }>;
    };
    tampered.files[0].utf8Content += "tampered";
    expectFrozenFailure(
      buildX4MergeLawOracleStagingPlan(fixture.extensionsRoot, tampered),
      "tampered signed manifest must fail planning",
    );
    expectFrozenFailure(
      buildX4MergeLawOracleStagingPlan("relative/extensions", fixture.manifest),
      "invalid root must fail planning",
    );
  });
});

test("strict signed plan rejects Windows-invalid punctuation in fixture segments", () => {
  withDisposableFixtureRoot("invalid-segment", fixture => {
    for (const character of ["<", ">", '"', "|", "?", "*"]) {
      const result = buildX4MergeLawOracleStagingPlan(
        fixture.extensionsRoot,
        manifestWithInvalidPathCharacter(fixture.manifest, character),
      );
      expectFrozenFailure(
        result,
        `Windows-invalid punctuation ${JSON.stringify(character)} must fail planning`,
      );
      expectEqual(
        result.errors[0],
        "The X4 merge-oracle manifest contains an unsafe or undeclared fixture path.",
        `Windows-invalid punctuation ${JSON.stringify(character)} must use the path error`,
      );
    }
  });
});

test("inspection and staging distinguish ready, staged, and idempotent without second-write drift", () => {
  withDisposableFixtureRoot("stage-success", fixture => {
    const ready = inspectX4MergeLawOracleStagingTargets(fixture.extensionsRoot, fixture.manifest);
    expectEqual(ready.ok && ready.state, "ready", "fresh targets must inspect ready");
    expect(ready.ok && Object.isFrozen(ready), "ready inspection must be frozen");

    const first = stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest);
    expectEqual(first.ok && first.state, "staged", "first stage must report staged");
    expect(first.ok && Object.isFrozen(first), "stage result must be frozen");
    if (!first.ok) assert.fail("first stage must succeed");
    expectPlanDeepFrozen(first.plan, "staged plan");
    expectEqual(first.plan.files.length, 9, "staged plan must contain all nine exact files");
    for (const file of first.plan.files) {
      expectDeepEqual(fs.readFileSync(file.absolutePath), Buffer.from(file.utf8Content, "utf8"), "staged bytes must be exact");
      expectEqual(sha256Bytes(fs.readFileSync(file.absolutePath)), file.sha256, "staged bytes must match planned hash");
    }
    expectEqual(transactionEntries(fixture.extensionsRoot).length, 0, "successful stage must leave no transaction residue");

    const afterFirst = inventoryFingerprint(fixture.extensionsRoot);
    const second = withCountedMutations(
      () => stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectEqual(second.value.ok && second.value.state, "idempotent", "second stage must report idempotent");
    expectEqual(second.count, 0, "idempotent stage must perform zero mutations");
    expectEqual(inventoryFingerprint(fixture.extensionsRoot), afterFirst, "idempotent stage must preserve inventory");
    const inspected = inspectX4MergeLawOracleStagingTargets(fixture.extensionsRoot, fixture.manifest);
    expectEqual(inspected.ok && inspected.state, "idempotent", "exact staged targets must inspect idempotent");
  });
});

test("exclusive stage-owner failures separate empty cleanup from guarded partial residue", () => {
  withDisposableFixtureRoot("owner-zero", fixture => {
    let injected = 0;
    const result = withFsPatch(
      "writeFileSync",
      original => (...args) => {
        if (path.basename(String(args[0])) === STAGE_OWNER_FILENAME) {
          injected += 1;
          const error = new Error("injected owner refusal") as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }
        return original(...args);
      },
      () => stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectEqual(injected, 1, "zero-byte owner fault must inject exactly once");
    expectFrozenFailure(result, "zero-byte owner fault must fail safely");
    expectDeepEqual(result.errors, [STAGE_FAILED_ERROR], "zero-byte owner fault must report stage failure");
    expectDeepEqual(fs.readdirSync(fixture.extensionsRoot), [], "empty unowned transaction must be removed");
    const inspection = inspectX4MergeLawOracleStagingTargets(fixture.extensionsRoot, fixture.manifest);
    expectEqual(inspection.ok && inspection.state, "ready", "zero-byte owner fault must restore ready");
  });

  withDisposableFixtureRoot("owner-partial", fixture => {
    let injected = 0;
    const result = withFsPatch(
      "writeFileSync",
      original => (...args) => {
        if (path.basename(String(args[0])) === STAGE_OWNER_FILENAME) {
          injected += 1;
          original(args[0], Buffer.from("{", "utf8"), { flag: "wx" });
          const error = new Error("injected partial owner write") as NodeJS.ErrnoException;
          error.code = "EIO";
          throw error;
        }
        return original(...args);
      },
      () => stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectEqual(injected, 1, "partial owner fault must inject exactly once");
    expectFrozenFailure(result, "partial owner fault must fail safely");
    expectDeepEqual(result.errors, [STAGE_RESIDUE_ERROR], "partial owner bytes must report guarded residue");
    const residues = transactionEntries(fixture.extensionsRoot);
    expectEqual(residues.length, 1, "partial owner bytes must preserve one guarded transaction");
    expectDeepEqual(
      fs.readFileSync(path.join(fixture.extensionsRoot, residues[0], STAGE_OWNER_FILENAME)),
      Buffer.from("{", "utf8"),
      "partial owner bytes must not be deleted",
    );
  });
});

test("staged-byte corruption is detected before promotion and preserved as guarded residue", () => {
  withDisposableFixtureRoot("stage-corruption", fixture => {
    let corrupted = 0;
    let promotionCalls = 0;
    const result = withFsPatch(
      "writeFileSync",
      original => (...args) => {
        const absolutePath = String(args[0]);
        if (
          corrupted === 0
          && absolutePath.includes(`${path.sep}.x4forge-merge-law-oracle-stage-`)
          && path.basename(absolutePath) === "content.xml"
        ) {
          corrupted += 1;
          return original(args[0], Buffer.from("corrupted staged bytes\n", "utf8"), args[2]);
        }
        return original(...args);
      },
      () => withFsPatch(
        "renameSync",
        original => (...args) => {
          promotionCalls += 1;
          return original(...args);
        },
        () => stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
      ),
    );
    expectEqual(corrupted, 1, "staged corruption must inject once");
    expectEqual(promotionCalls, 0, "corrupt staged bytes must never reach promotion");
    expectFrozenFailure(result, "staged corruption must fail safely");
    expectDeepEqual(result.errors, [STAGE_RESIDUE_ERROR], "staged corruption must report guarded residue");
    expectEqual(transactionEntries(fixture.extensionsRoot).length, 1, "corrupt staged tree must remain guarded");
  });
});

test("foreign and mixed staging targets refuse with zero mutation", () => {
  withDisposableFixtureRoot("stage-foreign", fixture => {
    const plan = planFor(fixture);
    fs.mkdirSync(plan.extensions[0].absoluteRoot);
    fs.writeFileSync(path.join(plan.extensions[0].absoluteRoot, "foreign.txt"), "foreign\n", "utf8");
    const before = inventoryFingerprint(fixture.extensionsRoot);
    const staged = withCountedMutations(
      () => stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectFrozenFailure(staged.value, "foreign target must refuse staging");
    expectEqual(staged.count, 0, "foreign target refusal must perform zero mutation");
    expectEqual(inventoryFingerprint(fixture.extensionsRoot), before, "foreign target must remain unchanged");
  });

  withDisposableFixtureRoot("stage-mixed", fixture => {
    const plan = stagedPlan(fixture);
    fs.rmSync(plan.extensions[2].absoluteRoot, { recursive: true, force: true });
    const before = inventoryFingerprint(fixture.extensionsRoot);
    const staged = withCountedMutations(
      () => stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectFrozenFailure(staged.value, "mixed target state must refuse staging");
    expectEqual(staged.count, 0, "mixed target refusal must perform zero mutation");
    expectEqual(inventoryFingerprint(fixture.extensionsRoot), before, "mixed target state must remain unchanged");
  });
});

test("junction target staging refusal performs zero mutation", () => {
  withDisposableFixtureRoot("stage-junction", fixture => {
    const plan = planFor(fixture);
    const junctionSource = path.join(fixture.absoluteRoot, "junction-source");
    fs.mkdirSync(junctionSource);
    createDirectoryLink(junctionSource, plan.extensions[0].absoluteRoot);
    const before = inventoryFingerprint(fixture.absoluteRoot);
    const staged = withCountedMutations(
      () => stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectFrozenFailure(staged.value, "junction target must refuse staging");
    expectEqual(staged.count, 0, "junction target refusal must perform zero mutation");
    expectEqual(inventoryFingerprint(fixture.absoluteRoot), before, "junction target must remain unchanged");
  });
});

test("deterministic second-promotion failure rolls back the first promotion", () => {
  withDisposableFixtureRoot("promotion-rollback", fixture => {
    const ids = [...fixture.manifest.dependencyOrder];
    let promotionAttempts = 0;
    const result = withFsPatch(
      "renameSync",
      original => (...args) => {
        const destination = path.resolve(String(args[1]));
        if (path.dirname(destination) === fixture.extensionsRoot && ids.includes(path.basename(destination))) {
          promotionAttempts += 1;
          if (promotionAttempts === 2) {
            const error = new Error("injected second promotion failure") as NodeJS.ErrnoException;
            error.code = "EACCES";
            throw error;
          }
        }
        return original(...args);
      },
      () => stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectEqual(promotionAttempts, 2, "second promotion must be the injected fault point");
    expectFrozenFailure(result, "promotion failure must fail safely");
    expectDeepEqual(result.errors, [STAGE_FAILED_ERROR], "successful rollback must report stage failure");
    expectDeepEqual(fs.readdirSync(fixture.extensionsRoot), [], "successful rollback must remove targets and transaction");
    const inspection = inspectX4MergeLawOracleStagingTargets(fixture.extensionsRoot, fixture.manifest);
    expectEqual(inspection.ok && inspection.state, "ready", "successful rollback must restore ready");
  });
});

test("rollback refuses destructive recovery after promoted target drift", () => {
  withDisposableFixtureRoot("rollback-drift", fixture => {
    const ids = [...fixture.manifest.dependencyOrder];
    let promotionAttempts = 0;
    const driftBytes = Buffer.from("selftest drift must survive\n", "utf8");
    const result = withFsPatch(
      "renameSync",
      original => (...args) => {
        const destination = path.resolve(String(args[1]));
        if (path.dirname(destination) === fixture.extensionsRoot && ids.includes(path.basename(destination))) {
          promotionAttempts += 1;
          if (promotionAttempts === 2) {
            fs.writeFileSync(path.join(fixture.extensionsRoot, ids[0], "content.xml"), driftBytes);
            const error = new Error("injected second promotion failure after drift") as NodeJS.ErrnoException;
            error.code = "EACCES";
            throw error;
          }
        }
        return original(...args);
      },
      () => stageX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectEqual(promotionAttempts, 2, "rollback drift fault must occur on second promotion");
    expectFrozenFailure(result, "rollback drift must fail safely");
    expectDeepEqual(result.errors, [ROLLBACK_INCOMPLETE_ERROR], "drift must report rollback incomplete");
    expectDeepEqual(
      fs.readFileSync(path.join(fixture.extensionsRoot, ids[0], "content.xml")),
      driftBytes,
      "rollback must preserve drifted target bytes",
    );
    expectEqual(transactionEntries(fixture.extensionsRoot).length, 1, "rollback drift must preserve guarded transaction");
  });
});

test("cleanup removes exact targets, returns ready, then becomes zero-write already_clean", () => {
  withDisposableFixtureRoot("cleanup-positive", fixture => {
    const plan = stagedPlan(fixture);
    const cleaned = cleanupX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest);
    expectEqual(cleaned.ok && cleaned.state, "cleaned", "exact owned cleanup must report cleaned");
    expect(cleaned.ok && Object.isFrozen(cleaned), "cleaned result must be frozen");
    if (!cleaned.ok) assert.fail("cleaned result must succeed");
    expectEqual(cleaned.plan.runId, plan.runId, "cleaned result must retain run identity");
    expectEqual(cleaned.plan.fixtureHash, plan.fixtureHash, "cleaned result must retain fixture identity");
    expectEqual(cleaned.plan.manifestSha256, plan.manifestSha256, "cleaned result must retain manifest identity");
    expectPlanDeepFrozen(cleaned.plan, "cleaned plan");
    const inspected = inspectX4MergeLawOracleStagingTargets(fixture.extensionsRoot, fixture.manifest);
    expectEqual(inspected.ok && inspected.state, "ready", "cleaned targets must inspect ready");
    expectDeepEqual(fs.readdirSync(fixture.extensionsRoot), [], "cleaned extensions root must contain no target residue");

    const before = inventoryFingerprint(fixture.extensionsRoot);
    const second = withCountedMutations(
      () => cleanupX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectEqual(second.value.ok && second.value.state, "already_clean", "second cleanup must report already_clean");
    expect(second.value.ok && Object.isFrozen(second.value), "already_clean result must be frozen");
    expectEqual(second.count, 0, "already_clean cleanup must perform zero mutation");
    expectEqual(inventoryFingerprint(fixture.extensionsRoot), before, "already_clean cleanup must preserve inventory");
  });
});

test("cleanup refuses every mixed, foreign, drifted, aliased, wrong-type, and linked target before mutation", () => {
  const negativeSetups: ReadonlyArray<{
    readonly name: string;
    readonly setup: (
      fixture: DisposableFixtureRoot,
      plan: X4MergeLawOracleStagingPlanSuccess,
    ) => void;
  }> = [
    {
      name: "mixed-absent",
      setup: (_fixture, plan) => {
        fs.rmSync(plan.extensions[2].absoluteRoot, { recursive: true, force: true });
      },
    },
    {
      name: "foreign-target",
      setup: (fixture, plan) => replaceExtensionWithForeign(fixture, plan.extensions[2]),
    },
    {
      name: "content-drift",
      setup: (_fixture, plan) => {
        fs.appendFileSync(exactFile(plan.extensions[2], "/content.xml"), "drift", "utf8");
      },
    },
    {
      name: "owner-drift",
      setup: (_fixture, plan) => {
        fs.appendFileSync(
          exactFile(plan.extensions[2], `/${X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME}`),
          "drift",
          "utf8",
        );
      },
    },
    {
      name: "missing-owner",
      setup: (_fixture, plan) => {
        fs.unlinkSync(exactFile(plan.extensions[2], `/${X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME}`));
      },
    },
    {
      name: "extra-entry",
      setup: (_fixture, plan) => {
        fs.writeFileSync(path.join(plan.extensions[2].absoluteRoot, "extra.txt"), "extra\n", "utf8");
      },
    },
    {
      name: "wrong-type",
      setup: (_fixture, plan) => {
        fs.rmSync(plan.extensions[2].absoluteRoot, { recursive: true, force: true });
        fs.writeFileSync(plan.extensions[2].absoluteRoot, "wrong type\n", "utf8");
      },
    },
    {
      name: "case-alias",
      setup: (_fixture, plan) => {
        const content = exactFile(plan.extensions[2], "/content.xml");
        const temporary = path.join(plan.extensions[2].absoluteRoot, "content.case-temporary");
        const alias = path.join(plan.extensions[2].absoluteRoot, "Content.xml");
        fs.renameSync(content, temporary);
        fs.renameSync(temporary, alias);
      },
    },
    {
      name: "junction-target",
      setup: (fixture, plan) => {
        fs.rmSync(plan.extensions[2].absoluteRoot, { recursive: true, force: true });
        const source = path.join(fixture.absoluteRoot, "cleanup-junction-source");
        fs.mkdirSync(source);
        createDirectoryLink(source, plan.extensions[2].absoluteRoot);
      },
    },
  ];

  for (const negative of negativeSetups) {
    withDisposableFixtureRoot(`cleanup-${negative.name}`, fixture => {
      const plan = stagedPlan(fixture);
      negative.setup(fixture, plan);
      const before = inventoryFingerprint(fixture.absoluteRoot);
      const cleaned = withCountedMutations(
        () => cleanupX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
      );
      expectFrozenFailure(cleaned.value, `${negative.name} cleanup must fail closed`);
      expectEqual(cleaned.value.state, "refused", `${negative.name} cleanup must be refused before mutation`);
      expectEqual(cleaned.count, 0, `${negative.name} cleanup must perform zero mutation`);
      expectEqual(
        inventoryFingerprint(fixture.absoluteRoot),
        before,
        `${negative.name} cleanup must preserve exact preflight state`,
      );
    });
  }
});

test("cleanup failure after mutation reports cleanup_incomplete and preserves unrelated data", () => {
  withDisposableFixtureRoot("cleanup-incomplete", fixture => {
    const plan = stagedPlan(fixture);
    const foreignRoot = path.join(fixture.extensionsRoot, "unrelated_foreign_extension");
    const foreignFile = path.join(foreignRoot, "sentinel.txt");
    const foreignBytes = Buffer.from("must remain untouched\n", "utf8");
    fs.mkdirSync(foreignRoot);
    fs.writeFileSync(foreignFile, foreignBytes);
    let unlinkCalls = 0;
    const result = withFsPatch(
      "unlinkSync",
      original => (...args) => {
        unlinkCalls += 1;
        if (unlinkCalls === 2) {
          const error = new Error("injected cleanup failure") as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }
        return original(...args);
      },
      () => cleanupX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
    );
    expectEqual(unlinkCalls, 2, "cleanup fault must occur after one successful unlink");
    expectFrozenFailure(result, "post-mutation cleanup fault must fail safely");
    expectEqual(result.state, "cleanup_incomplete", "post-mutation fault must report cleanup_incomplete");
    expectDeepEqual(result.errors, [CLEANUP_INCOMPLETE_ERROR], "post-mutation fault must report exact bounded truth");
    expectDeepEqual(fs.readFileSync(foreignFile), foreignBytes, "cleanup fault must preserve unrelated foreign bytes");
    assertPlannedExtensionBytes(plan.extensions[0]);
    assertPlannedExtensionBytes(plan.extensions[1]);
    expectEqual(
      inspectX4MergeLawOracleStagingTargets(fixture.extensionsRoot, fixture.manifest).ok,
      false,
      "partially cleaned target set must inspect as conflict",
    );
  });
});

test("cleanup race before the first delete is refused with zero cleanup mutation", () => {
  withDisposableFixtureRoot("cleanup-predelete-race", fixture => {
    const plan = stagedPlan(fixture);
    const top = plan.extensions[2];
    const ownerFile = exactFile(top, `/${X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME}`);
    let topRootReads = 0;
    let injected = 0;
    let cleanupMutationCount = -1;
    const result = withFsPatch(
      "readdirSync",
      original => (...args) => {
        if (path.resolve(String(args[0])) === top.absoluteRoot) {
          topRootReads += 1;
          if (topRootReads === 7) {
            injected += 1;
            const driftedOwner = Buffer.concat([
              fs.readFileSync(ownerFile),
              Buffer.from("pre-delete race drift", "utf8"),
            ]);
            originalFsMethods.writeFileSync(ownerFile, driftedOwner);
          }
        }
        return original(...args);
      },
      () => {
        const counted = withCountedMutations(
          () => cleanupX4MergeLawOracleFixture(fixture.extensionsRoot, fixture.manifest),
        );
        cleanupMutationCount = counted.count;
        return counted.value;
      },
    );
    expectEqual(injected, 1, "pre-delete race must inject exactly once");
    expect(topRootReads >= 7, "pre-delete verification must reach the deterministic race point");
    expectFrozenFailure(result, "pre-delete race must fail safely");
    expectEqual(result.state, "refused", "unverifiable state before the first delete must be refused");
    expectEqual(cleanupMutationCount, 0, "pre-delete refusal must perform zero cleanup mutation");
    expectEqual(fs.existsSync(top.absoluteRoot), true, "pre-delete refusal must preserve the target root");
  });
});

const failures: Array<{ readonly name: string; readonly error: unknown }> = [];

assert.ok(fs.statSync(TEST_RESULTS_ROOT).isDirectory(), "test-results must already exist");
assert.deepEqual(currentTempRemnants(), [], "filesystem selftest must start without stale owned remnants");

for (const namedCase of namedCases) {
  try {
    namedCase.run();
  } catch (error: unknown) {
    failures.push({ name: namedCase.name, error });
    console.error(`FAIL x4 merge-law oracle filesystem self-test case: ${namedCase.name}`);
    console.error(error);
  } finally {
    restoreFsMutations();
    for (const activeRoot of [...activeRoots]) {
      try {
        removeDisposableRoot(activeRoot);
      } catch (error: unknown) {
        failures.push({ name: `${namedCase.name} guarded cleanup`, error });
      }
    }
  }
}

try {
  expectEqual(activePatchCount, 0, "selftest must leave no active monkeypatch");
  for (const name of PATCHABLE_NAMES) {
    expectEqual(mutableFs[name], originalFsMethods[name], `selftest must restore fs.${name}`);
  }
  expectDeepEqual(currentTempRemnants(), [], "selftest must leave zero disposable-root remnants");
} catch (error: unknown) {
  failures.push({ name: "final hygiene", error });
}

if (failures.length > 0) {
  console.error(
    `FAIL x4 merge-law oracle filesystem self-test: ${namedCases.length} named cases, ${assertionCount} assertions, ${failures.length} failed`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `PASS x4 merge-law oracle filesystem self-test: ${namedCases.length} named cases, ${assertionCount} assertions`,
  );
}
