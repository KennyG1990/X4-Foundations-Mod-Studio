import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  canonicalX4MergeJson,
  verifyX4MergeFixtureManifest,
  type X4MergeOracleFixtureFile,
  type X4MergeOracleSignedManifest,
} from "../lib/x4MergeLawOracle";
import { X4_MERGE_LAW_ORACLE_TARGET_MD_PATH } from "../lib/x4MergeLawOracleFixture";
import { parseContentDependencies, parseModManifest } from "../lib/modDependencyGraph";

const MAX_EXTENSIONS_ROOT_PATH_LENGTH = 32_768;
const MAX_EXTENSIONS_ROOT_ANCESTORS = 512;
const WINDOWS_FILE_ATTRIBUTE_REPARSE_POINT = 0x400;
const STAGE_TRANSACTION_PREFIX = ".x4forge-merge-law-oracle-stage-";
const STAGE_TRANSACTION_BASENAME =
  /^\.x4forge-merge-law-oracle-stage-[0-9a-f]{32}$/u;
const STAGE_TRANSACTION_CREATION_ATTEMPTS = 8;
const STAGE_TRANSACTION_OWNER_FILENAME =
  ".x4forge-merge-law-oracle-stage-owner.json";

export const X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME =
  ".x4forge-merge-law-oracle-owner.json" as const;
export const X4_MERGE_LAW_ORACLE_OWNER_MARKER_SCHEMA_VERSION =
  "x4-merge-law-oracle-owner.v1" as const;

const REQUIRED_CONTENT_PATH = "content.xml" as const;
const REQUIRED_MD_PATH = X4_MERGE_LAW_ORACLE_TARGET_MD_PATH;
const REQUIRED_MD_DIRECTORY = path.posix.dirname(REQUIRED_MD_PATH);
const REQUIRED_MD_FILENAME = path.posix.basename(REQUIRED_MD_PATH);
const SAFE_EXTENSION_ID = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/u;
const INVALID_WINDOWS_SEGMENT_PUNCTUATION = /[<>:"/\\|?*]/u;
const RESERVED_WINDOWS_DEVICE_BASENAME =
  /^(?:CON|PRN|AUX|NUL|CLOCK\$|COM[1-9]|LPT[1-9])$/iu;

const ERROR_MESSAGES = Object.freeze({
  inputType: "The X4 extensions root must be a nonempty exact string.",
  inputBound: "The X4 extensions root exceeds the supported path bound.",
  inputWhitespace: "The X4 extensions root must not contain surrounding whitespace.",
  inputControl: "The X4 extensions root contains an unsupported control character.",
  inputTraversal: "The X4 extensions root contains a traversal or aliased path segment.",
  inputAbsolute: "The X4 extensions root must be absolute.",
  inputRoot: "The X4 extensions root may not be a filesystem, drive, or share root.",
  inputBasename: "The X4 extensions root basename must be extensions.",
  rootUnavailable: "The X4 extensions root must be an existing directory.",
  ancestorUnsafe: "The X4 extensions root has an unsafe or unsupported ancestor.",
  ancestorBound: "The X4 extensions root ancestor chain exceeds the supported bound.",
  physicalUnavailable: "The X4 extensions root physical path could not be resolved.",
  physicalMismatch: "The X4 extensions root does not resolve to its declared physical path.",
  planManifest: "The X4 merge-oracle manifest failed cryptographic verification.",
  planDependencyOrder: "The X4 merge-oracle manifest must declare exactly three safe dependencies.",
  planDependencyCollision: "The X4 merge-oracle dependency IDs collide on Windows.",
  planFileCount: "The X4 merge-oracle manifest must contain exactly six fixture files.",
  planFilePath: "The X4 merge-oracle manifest contains an unsafe or undeclared fixture path.",
  planFileCollision: "The X4 merge-oracle fixture paths collide on Windows.",
  planFileShape: "Each X4 merge-oracle extension must contain exactly its two required files.",
  planContent: "An X4 merge-oracle content manifest has an invalid strict V1 shape or ID.",
  planDependencyChain: "The X4 merge-oracle content dependency chain is invalid.",
  planContainment: "An X4 merge-oracle planned target is not contained by the physical root.",
  planUnexpected: "The X4 merge-oracle staging plan could not be built safely.",
  targetConflict: "The X4 merge-oracle staging targets are conflicting or could not be inspected safely.",
  stageFailed: "The X4 merge-oracle transactional staging operation failed safely.",
  stageResidue: "The X4 merge-oracle transaction failed and may contain guarded residue.",
  rollbackIncomplete: "The X4 merge-oracle rollback stopped because owned state could not be verified safely.",
  cleanupRefused: "The X4 merge-oracle fixture cleanup was refused because exact ownership could not be verified.",
  cleanupIncomplete: "The X4 merge-oracle fixture cleanup started but did not complete safely.",
  unexpected: "The X4 extensions root could not be validated safely.",
} as const);

export interface X4MergeLawOracleFsSuccess {
  readonly ok: true;
  readonly declaredRoot: string;
  readonly physicalRoot: string;
}

export interface X4MergeLawOracleFsFailure {
  readonly ok: false;
  readonly errors: readonly string[];
}

export type X4MergeLawOracleFsResult =
  | X4MergeLawOracleFsSuccess
  | X4MergeLawOracleFsFailure;

function failure(message: string): X4MergeLawOracleFsFailure {
  return Object.freeze({
    ok: false as const,
    errors: Object.freeze([message]),
  });
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function hasWindowsSegmentControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }

  return false;
}

function hasLexicalTraversalOrAlias(value: string): boolean {
  for (const segment of value.split(/[\\/]/u)) {
    if (segment === "." || segment === "..") return true;
    if (process.platform === "win32" && segment.length > 0 && /[. ]$/u.test(segment)) {
      return true;
    }
  }
  return false;
}

function stripWindowsExtendedPrefix(value: string): string {
  const withWindowsSeparators = value.replace(/\//gu, "\\");
  const uncPrefix = /^\\\\\?\\UNC\\/iu;
  if (uncPrefix.test(withWindowsSeparators)) {
    return withWindowsSeparators.replace(uncPrefix, "\\\\");
  }
  return withWindowsSeparators.replace(/^\\\\\?\\/u, "");
}

function normalizeComparablePath(value: string): string {
  if (process.platform !== "win32") {
    return path.normalize(value);
  }

  let normalized = path.win32.normalize(stripWindowsExtendedPrefix(value));
  const root = path.win32.parse(normalized).root;
  while (normalized.length > root.length && /[\\/]$/u.test(normalized)) {
    normalized = normalized.slice(0, -1);
  }
  return normalized.toLowerCase();
}

function isRootPath(value: string): boolean {
  const rootComparablePath = process.platform === "win32"
    ? path.win32.parse(stripWindowsExtendedPrefix(value)).root
    : path.parse(value).root;
  return normalizeComparablePath(value) === normalizeComparablePath(rootComparablePath);
}

function hasReparsePoint(stat: fs.Stats): boolean {
  const candidate = stat as fs.Stats & {
    readonly attributes?: unknown;
    readonly isReparsePoint?: unknown;
    readonly reparsePoint?: unknown;
  };

  if (candidate.reparsePoint === true) return true;
  if (
    typeof candidate.attributes === "number"
    && Number.isSafeInteger(candidate.attributes)
    && (candidate.attributes & WINDOWS_FILE_ATTRIBUTE_REPARSE_POINT) !== 0
  ) {
    return true;
  }

  if (typeof candidate.isReparsePoint === "function") {
    try {
      return Boolean((candidate.isReparsePoint as () => unknown)());
    } catch {
      return true;
    }
  }

  return false;
}

function isSafeDirectoryStat(stat: fs.Stats): boolean {
  if (typeof stat.isSymbolicLink !== "function" || typeof stat.isDirectory !== "function") {
    return false;
  }
  if (stat.isSymbolicLink() || hasReparsePoint(stat)) return false;
  return stat.isDirectory();
}

function validateExistingAncestorChain(root: string): string | null {
  let current = root;
  for (let depth = 0; depth < MAX_EXTENSIONS_ROOT_ANCESTORS; depth += 1) {
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch {
      return ERROR_MESSAGES.rootUnavailable;
    }

    if (!isSafeDirectoryStat(stat)) {
      return current === root ? ERROR_MESSAGES.rootUnavailable : ERROR_MESSAGES.ancestorUnsafe;
    }

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }

  return ERROR_MESSAGES.ancestorBound;
}

function validateX4MergeLawOracleExtensionsRootInternal(
  input: string,
): X4MergeLawOracleFsResult {
  if (input.length === 0) return failure(ERROR_MESSAGES.inputType);
  if (input.length > MAX_EXTENSIONS_ROOT_PATH_LENGTH) return failure(ERROR_MESSAGES.inputBound);
  if (input.trim() !== input) return failure(ERROR_MESSAGES.inputWhitespace);
  if (hasControlCharacter(input)) return failure(ERROR_MESSAGES.inputControl);
  if (hasLexicalTraversalOrAlias(input)) return failure(ERROR_MESSAGES.inputTraversal);
  if (!path.isAbsolute(input)) return failure(ERROR_MESSAGES.inputAbsolute);

  const declaredRoot = path.resolve(input);
  if (isRootPath(declaredRoot)) return failure(ERROR_MESSAGES.inputRoot);
  if (path.basename(declaredRoot).toLowerCase() !== "extensions") {
    return failure(ERROR_MESSAGES.inputBasename);
  }

  const filesystemRoot = process.platform === "win32"
    ? stripWindowsExtendedPrefix(declaredRoot)
    : declaredRoot;
  const ancestorError = validateExistingAncestorChain(filesystemRoot);
  if (ancestorError !== null) return failure(ancestorError);

  let physicalRoot: string;
  try {
    physicalRoot = fs.realpathSync.native(input);
  } catch {
    return failure(ERROR_MESSAGES.physicalUnavailable);
  }
  if (typeof physicalRoot !== "string" || physicalRoot.length === 0) {
    return failure(ERROR_MESSAGES.physicalUnavailable);
  }

  if (normalizeComparablePath(declaredRoot) !== normalizeComparablePath(physicalRoot)) {
    return failure(ERROR_MESSAGES.physicalMismatch);
  }

  return Object.freeze({
    ok: true as const,
    declaredRoot,
    physicalRoot,
  });
}

/** Validate an explicit, existing, physical X4 `extensions` directory root. */
export function validateX4MergeLawOracleExtensionsRoot(
  input: unknown,
): X4MergeLawOracleFsResult {
  if (typeof input !== "string") return failure(ERROR_MESSAGES.inputType);
  try {
    return validateX4MergeLawOracleExtensionsRootInternal(input);
  } catch {
    return failure(ERROR_MESSAGES.unexpected);
  }
}

export type X4MergeLawOraclePlannedFileKind = "fixture" | "owner_marker";

export interface X4MergeLawOraclePlannedFile {
  readonly kind: X4MergeLawOraclePlannedFileKind;
  readonly extensionId: string;
  readonly normalizedRelativePath: string;
  readonly absolutePath: string;
  readonly utf8Content: string;
  readonly sha256: string;
}

export interface X4MergeLawOracleExtensionStagingPlan {
  readonly extensionId: string;
  readonly normalizedRelativeRoot: string;
  readonly absoluteRoot: string;
  readonly files: readonly X4MergeLawOraclePlannedFile[];
}

export interface X4MergeLawOracleStagingPlanSuccess {
  readonly ok: true;
  readonly declaredRoot: string;
  readonly physicalRoot: string;
  readonly runId: string;
  readonly fixtureHash: string;
  readonly manifestSha256: string;
  readonly dependencyOrder: readonly string[];
  readonly extensions: readonly X4MergeLawOracleExtensionStagingPlan[];
  readonly files: readonly X4MergeLawOraclePlannedFile[];
}

export type X4MergeLawOracleStagingPlanResult =
  | X4MergeLawOracleStagingPlanSuccess
  | X4MergeLawOracleFsFailure;

type RequiredFixturePath = typeof REQUIRED_CONTENT_PATH | typeof REQUIRED_MD_PATH;

interface ValidatedFixtureShape {
  readonly byExtension: ReadonlyMap<string, ReadonlyMap<RequiredFixturePath, X4MergeOracleFixtureFile>>;
}

function sha256Utf8(utf8: string): string {
  return createHash("sha256").update(utf8, "utf8").digest("hex");
}

function isReservedWindowsDeviceSegment(segment: string): boolean {
  const extensionSeparator = segment.indexOf(".");
  const basename = (extensionSeparator === -1 ? segment : segment.slice(0, extensionSeparator))
    .replace(/[ .]+$/u, "");
  return RESERVED_WINDOWS_DEVICE_BASENAME.test(basename);
}

function isSafeStagingSegment(segment: string): boolean {
  return segment.length > 0
    && segment !== "."
    && segment !== ".."
    && !/[. ]$/u.test(segment)
    && !INVALID_WINDOWS_SEGMENT_PUNCTUATION.test(segment)
    && !hasWindowsSegmentControlCharacter(segment)
    && !isReservedWindowsDeviceSegment(segment);
}

function isSafeExtensionId(value: string): boolean {
  return isSafeStagingSegment(value) && SAFE_EXTENSION_ID.test(value);
}

function validateDependencyOrder(manifest: X4MergeOracleSignedManifest): string | null {
  if (manifest.dependencyOrder.length !== 3) return ERROR_MESSAGES.planDependencyOrder;
  const caseFolded = new Set<string>();
  for (const extensionId of manifest.dependencyOrder) {
    if (!isSafeExtensionId(extensionId)) return ERROR_MESSAGES.planDependencyOrder;
    const key = extensionId.toLowerCase();
    if (caseFolded.has(key)) return ERROR_MESSAGES.planDependencyCollision;
    caseFolded.add(key);
  }
  return null;
}

function validateFixtureShape(manifest: X4MergeOracleSignedManifest):
  | { readonly ok: true; readonly shape: ValidatedFixtureShape }
  | { readonly ok: false; readonly error: string } {
  if (manifest.files.length !== 6) return { ok: false, error: ERROR_MESSAGES.planFileCount };

  const declaredIds = new Set(manifest.dependencyOrder);
  const caseFoldedPaths = new Set<string>();
  const byExtension = new Map<string, Map<RequiredFixturePath, X4MergeOracleFixtureFile>>();
  for (const extensionId of manifest.dependencyOrder) byExtension.set(extensionId, new Map());

  for (const file of manifest.files) {
    const segments = file.normalizedRelativePath.split("/");
    if (segments.some(segment => !isSafeStagingSegment(segment))) {
      return { ok: false, error: ERROR_MESSAGES.planFilePath };
    }

    const caseFoldedPath = file.normalizedRelativePath.toLowerCase();
    if (caseFoldedPaths.has(caseFoldedPath)) {
      return { ok: false, error: ERROR_MESSAGES.planFileCollision };
    }
    caseFoldedPaths.add(caseFoldedPath);

    const extensionId = segments[0];
    if (!declaredIds.has(extensionId)) {
      return { ok: false, error: ERROR_MESSAGES.planFilePath };
    }

    const remainder = segments.slice(1).join("/");
    if (remainder !== REQUIRED_CONTENT_PATH && remainder !== REQUIRED_MD_PATH) {
      return { ok: false, error: ERROR_MESSAGES.planFileShape };
    }

    const ownedFiles = byExtension.get(extensionId);
    if (ownedFiles === undefined || ownedFiles.has(remainder)) {
      return { ok: false, error: ERROR_MESSAGES.planFileShape };
    }
    ownedFiles.set(remainder, file);
  }

  for (const ownedFiles of byExtension.values()) {
    if (
      ownedFiles.size !== 2
      || !ownedFiles.has(REQUIRED_CONTENT_PATH)
      || !ownedFiles.has(REQUIRED_MD_PATH)
    ) {
      return { ok: false, error: ERROR_MESSAGES.planFileShape };
    }
  }

  return { ok: true, shape: { byExtension } };
}

function parseStrictDoubleQuotedAttributes(tagBody: string): ReadonlyMap<string, string> | null {
  const attributes = new Map<string, string>();
  let remaining = tagBody.trim();
  while (remaining.length > 0) {
    const match = remaining.match(
      /^([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"(?:\s+|$)/u,
    );
    if (match === null) return null;
    const name = match[1].toLowerCase();
    if (attributes.has(name)) return null;
    attributes.set(name, match[2]);
    remaining = remaining.slice(match[0].length);
  }
  return attributes;
}

function validateStrictContentXml(
  extensionId: string,
  content: string,
  requiredDependencyId: string | null,
): "ok" | "content" | "dependency" {
  const root = content.match(
    /^\s*(?:<\?xml\b[^?]*\?>\s*)?<content\b([^>]*)>([\s\S]*)<\/content>\s*$/iu,
  );
  if (root === null) return "content";

  const rootAttributes = root[1];
  const body = root[2];
  if (
    /<\/?content\b/iu.test(body)
    || /<!--|<!\[CDATA\[|<!DOCTYPE|<!ENTITY|<\?/iu.test(body)
  ) {
    return "content";
  }

  const strictRootAttributes = parseStrictDoubleQuotedAttributes(rootAttributes);
  const parsedManifest = parseModManifest(extensionId, content);
  if (
    strictRootAttributes === null
    || strictRootAttributes.get("id") !== extensionId
    || parsedManifest === null
    || parsedManifest.id !== extensionId
  ) {
    return "content";
  }

  const dependencyTags = body.match(/<dependency\b[^>]*\/>/giu) ?? [];
  const dependencyStarts = body.match(/<dependency\b/giu) ?? [];
  if (dependencyTags.length !== dependencyStarts.length) return "dependency";

  for (const tag of dependencyTags) {
    const tagBody = tag.slice("<dependency".length, -2);
    const attributes = parseStrictDoubleQuotedAttributes(tagBody);
    if (attributes === null || !attributes.has("id") || attributes.has("optional")) {
      return "dependency";
    }
  }

  const residue = body
    .replace(/<text\b[^>]*\/>/giu, "")
    .replace(/<dependency\b[^>]*\/>/giu, "")
    .trim();
  if (residue.length !== 0) return "content";

  const dependencies = parseContentDependencies(content);
  if (dependencies.length !== dependencyTags.length) return "dependency";
  if (requiredDependencyId === null) return dependencies.length === 0 ? "ok" : "dependency";
  if (
    dependencies.length !== 1
    || dependencies[0].id !== requiredDependencyId
    || dependencies[0].optional
    || dependencies[0].id === extensionId
  ) {
    return "dependency";
  }
  return "ok";
}

function validateContentChain(
  manifest: X4MergeOracleSignedManifest,
  shape: ValidatedFixtureShape,
): string | null {
  for (let index = 0; index < manifest.dependencyOrder.length; index += 1) {
    const extensionId = manifest.dependencyOrder[index];
    const contentFile = shape.byExtension.get(extensionId)?.get(REQUIRED_CONTENT_PATH);
    if (contentFile === undefined) return ERROR_MESSAGES.planFileShape;
    const requiredDependencyId = index === 0 ? null : manifest.dependencyOrder[index - 1];
    const result = validateStrictContentXml(extensionId, contentFile.utf8Content, requiredDependencyId);
    if (result === "content") return ERROR_MESSAGES.planContent;
    if (result === "dependency") return ERROR_MESSAGES.planDependencyChain;
  }
  return null;
}

function resolveContainedTarget(physicalRoot: string, segments: readonly string[]): string | null {
  if (segments.length === 0 || segments.some(segment => !isSafeStagingSegment(segment))) {
    return null;
  }
  const absolutePath = path.resolve(physicalRoot, ...segments);
  const relativePath = path.relative(physicalRoot, absolutePath);
  if (
    relativePath.length === 0
    || path.isAbsolute(relativePath)
    || relativePath === ".."
    || relativePath.startsWith(`..${path.sep}`)
  ) {
    return null;
  }
  return absolutePath;
}

function createPlannedFile(
  physicalRoot: string,
  extensionId: string,
  kind: X4MergeLawOraclePlannedFileKind,
  normalizedRelativePath: string,
  segments: readonly string[],
  utf8Content: string,
): X4MergeLawOraclePlannedFile | null {
  const absolutePath = resolveContainedTarget(physicalRoot, segments);
  if (absolutePath === null) return null;
  return Object.freeze({
    kind,
    extensionId,
    normalizedRelativePath,
    absolutePath,
    utf8Content,
    sha256: sha256Utf8(utf8Content),
  });
}

function createStagingPlan(
  root: X4MergeLawOracleFsSuccess,
  manifest: X4MergeOracleSignedManifest,
  shape: ValidatedFixtureShape,
): X4MergeLawOracleStagingPlanResult {
  const extensions: X4MergeLawOracleExtensionStagingPlan[] = [];
  const allFiles: X4MergeLawOraclePlannedFile[] = [];

  for (const extensionId of manifest.dependencyOrder) {
    const absoluteRoot = resolveContainedTarget(root.physicalRoot, [extensionId]);
    if (absoluteRoot === null) return failure(ERROR_MESSAGES.planContainment);

    const ownedFiles = shape.byExtension.get(extensionId);
    if (ownedFiles === undefined) return failure(ERROR_MESSAGES.planFileShape);
    const contentFile = ownedFiles.get(REQUIRED_CONTENT_PATH);
    const mdFile = ownedFiles.get(REQUIRED_MD_PATH);
    if (contentFile === undefined || mdFile === undefined) {
      return failure(ERROR_MESSAGES.planFileShape);
    }

    const plannedContent = createPlannedFile(
      root.physicalRoot,
      extensionId,
      "fixture",
      contentFile.normalizedRelativePath,
      [extensionId, REQUIRED_CONTENT_PATH],
      contentFile.utf8Content,
    );
    const plannedMd = createPlannedFile(
      root.physicalRoot,
      extensionId,
      "fixture",
      mdFile.normalizedRelativePath,
      [extensionId, ...REQUIRED_MD_PATH.split("/")],
      mdFile.utf8Content,
    );

    const markerRelativePath = `${extensionId}/${X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME}`;
    const markerContent = `${canonicalX4MergeJson({
      schemaVersion: X4_MERGE_LAW_ORACLE_OWNER_MARKER_SCHEMA_VERSION,
      runId: manifest.runId,
      fixtureHash: manifest.fixtureHash,
      manifestSha256: manifest.manifestSha256,
      extensionId,
    })}\n`;
    const plannedMarker = createPlannedFile(
      root.physicalRoot,
      extensionId,
      "owner_marker",
      markerRelativePath,
      [extensionId, X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME],
      markerContent,
    );

    if (plannedContent === null || plannedMd === null || plannedMarker === null) {
      return failure(ERROR_MESSAGES.planContainment);
    }

    const files = Object.freeze([plannedContent, plannedMd, plannedMarker]);
    allFiles.push(...files);
    extensions.push(Object.freeze({
      extensionId,
      normalizedRelativeRoot: extensionId,
      absoluteRoot,
      files,
    }));
  }

  return Object.freeze({
    ok: true as const,
    declaredRoot: root.declaredRoot,
    physicalRoot: root.physicalRoot,
    runId: manifest.runId,
    fixtureHash: manifest.fixtureHash,
    manifestSha256: manifest.manifestSha256,
    dependencyOrder: Object.freeze([...manifest.dependencyOrder]),
    extensions: Object.freeze(extensions),
    files: Object.freeze(allFiles),
  });
}

/** Verify a strict V1 fixture and derive a read-only, physically-contained staging plan. */
export function buildX4MergeLawOracleStagingPlan(
  extensionsRoot: unknown,
  manifestValue: unknown,
): X4MergeLawOracleStagingPlanResult {
  const root = validateX4MergeLawOracleExtensionsRoot(extensionsRoot);
  if (root.ok === false) return root;

  try {
    const verified = verifyX4MergeFixtureManifest(manifestValue, sha256Utf8);
    if (!verified.ok) return failure(ERROR_MESSAGES.planManifest);
    const manifest = verified.manifest;

    const dependencyError = validateDependencyOrder(manifest);
    if (dependencyError !== null) return failure(dependencyError);
    const fixtureShape = validateFixtureShape(manifest);
    if (fixtureShape.ok === false) return failure(fixtureShape.error);
    const contentError = validateContentChain(manifest, fixtureShape.shape);
    if (contentError !== null) return failure(contentError);

    return createStagingPlan(root, manifest, fixtureShape.shape);
  } catch {
    return failure(ERROR_MESSAGES.planUnexpected);
  }
}

export type X4MergeLawOracleStagingTargetState = "ready" | "idempotent";

export interface X4MergeLawOracleStagingTargetInspectionSuccess {
  readonly ok: true;
  readonly state: X4MergeLawOracleStagingTargetState;
  readonly plan: X4MergeLawOracleStagingPlanSuccess;
}

export type X4MergeLawOracleStagingTargetInspectionResult =
  | X4MergeLawOracleStagingTargetInspectionSuccess
  | X4MergeLawOracleFsFailure;

type X4MergeLawOracleTargetProbe =
  | { readonly state: "absent" }
  | { readonly state: "present"; readonly stat: fs.Stats }
  | { readonly state: "conflict" };

interface X4MergeLawOracleExactPlannedFiles {
  readonly content: X4MergeLawOraclePlannedFile;
  readonly md: X4MergeLawOraclePlannedFile;
  readonly marker: X4MergeLawOraclePlannedFile;
}

function isSafeRegularFileStat(stat: fs.Stats): boolean {
  if (typeof stat.isSymbolicLink !== "function" || typeof stat.isFile !== "function") {
    return false;
  }
  if (stat.isSymbolicLink() || hasReparsePoint(stat)) return false;
  return stat.isFile();
}

function sameStableStat(left: fs.Stats, right: fs.Stats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function normalizeCaseSensitivePhysicalPath(value: string): string {
  if (process.platform !== "win32") return path.normalize(value);

  let normalized = path.win32.normalize(stripWindowsExtendedPrefix(value));
  const root = path.win32.parse(normalized).root;
  while (normalized.length > root.length && /[\\/]$/u.test(normalized)) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function hasExactPhysicalPath(value: string): boolean {
  try {
    const physicalPath = fs.realpathSync.native(value);
    return normalizeCaseSensitivePhysicalPath(physicalPath)
      === normalizeCaseSensitivePhysicalPath(value);
  } catch {
    return false;
  }
}

function hasExactDirectoryEntries(
  directory: string,
  expectedEntries: readonly string[],
): boolean {
  try {
    const entries = fs.readdirSync(directory, { encoding: "utf8" });
    if (entries.length !== expectedEntries.length) return false;
    const expected = new Set(expectedEntries);
    return entries.every(entry => expected.has(entry));
  } catch {
    return false;
  }
}

function hasFsErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { readonly code?: unknown }).code === code;
}

function probeTargetRoot(absoluteRoot: string): X4MergeLawOracleTargetProbe {
  try {
    return { state: "present", stat: fs.lstatSync(absoluteRoot) };
  } catch (error: unknown) {
    return hasFsErrorCode(error, "ENOENT") ? { state: "absent" } : { state: "conflict" };
  }
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function inspectExactFileBytes(
  absolutePath: string,
  expectedBytes: Buffer,
  expectedSha256: string,
): boolean {
  let pathStatBefore: fs.Stats;
  try {
    pathStatBefore = fs.lstatSync(absolutePath);
  } catch {
    return false;
  }
  if (!isSafeRegularFileStat(pathStatBefore) || pathStatBefore.size !== expectedBytes.byteLength) {
    return false;
  }

  const readBuffer = Buffer.alloc(expectedBytes.byteLength + 1);
  let bytesRead = 0;
  let descriptor: number | undefined;
  let descriptorStatBefore: fs.Stats | undefined;
  let descriptorStatAfter: fs.Stats | undefined;
  let closeSucceeded = true;
  try {
    descriptor = fs.openSync(absolutePath, "r");
    descriptorStatBefore = fs.fstatSync(descriptor);
    if (
      !isSafeRegularFileStat(descriptorStatBefore)
      || descriptorStatBefore.size !== expectedBytes.byteLength
      || !sameStableStat(pathStatBefore, descriptorStatBefore)
    ) {
      return false;
    }

    while (bytesRead < readBuffer.byteLength) {
      const count = fs.readSync(
        descriptor,
        readBuffer,
        bytesRead,
        readBuffer.byteLength - bytesRead,
        bytesRead,
      );
      if (count === 0) break;
      bytesRead += count;
    }
    descriptorStatAfter = fs.fstatSync(descriptor);
  } catch {
    return false;
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        closeSucceeded = false;
      }
    }
  }

  if (
    !closeSucceeded
    || descriptorStatBefore === undefined
    || descriptorStatAfter === undefined
    || !isSafeRegularFileStat(descriptorStatAfter)
    || !sameStableStat(descriptorStatBefore, descriptorStatAfter)
    || bytesRead !== expectedBytes.byteLength
  ) {
    return false;
  }

  const observedBytes = readBuffer.subarray(0, bytesRead);
  if (!expectedBytes.equals(observedBytes) || sha256Bytes(observedBytes) !== expectedSha256) {
    return false;
  }

  try {
    const pathStatAfter = fs.lstatSync(absolutePath);
    return isSafeRegularFileStat(pathStatAfter)
      && sameStableStat(pathStatBefore, pathStatAfter);
  } catch {
    return false;
  }
}

function inspectExactPlannedFile(file: X4MergeLawOraclePlannedFile): boolean {
  return inspectExactFileBytes(
    file.absolutePath,
    Buffer.from(file.utf8Content, "utf8"),
    file.sha256,
  );
}

function getExactPlannedFiles(
  extension: X4MergeLawOracleExtensionStagingPlan,
): X4MergeLawOracleExactPlannedFiles | null {
  if (extension.files.length !== 3) return null;
  const contentRelativePath = `${extension.extensionId}/${REQUIRED_CONTENT_PATH}`;
  const mdRelativePath = `${extension.extensionId}/${REQUIRED_MD_PATH}`;
  const markerRelativePath =
    `${extension.extensionId}/${X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME}`;
  const content = extension.files.find(file => file.normalizedRelativePath === contentRelativePath);
  const md = extension.files.find(file => file.normalizedRelativePath === mdRelativePath);
  const marker = extension.files.find(file => file.normalizedRelativePath === markerRelativePath);
  if (
    content === undefined
    || md === undefined
    || marker === undefined
    || content.kind !== "fixture"
    || md.kind !== "fixture"
    || marker.kind !== "owner_marker"
  ) {
    return null;
  }

  const expectedContentPath = path.resolve(extension.absoluteRoot, REQUIRED_CONTENT_PATH);
  const expectedMdPath = path.resolve(
    extension.absoluteRoot,
    REQUIRED_MD_DIRECTORY,
    REQUIRED_MD_FILENAME,
  );
  const expectedMarkerPath = path.resolve(
    extension.absoluteRoot,
    X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME,
  );
  if (
    normalizeCaseSensitivePhysicalPath(content.absolutePath)
      !== normalizeCaseSensitivePhysicalPath(expectedContentPath)
    || normalizeCaseSensitivePhysicalPath(md.absolutePath)
      !== normalizeCaseSensitivePhysicalPath(expectedMdPath)
    || normalizeCaseSensitivePhysicalPath(marker.absolutePath)
      !== normalizeCaseSensitivePhysicalPath(expectedMarkerPath)
  ) {
    return null;
  }

  return { content, md, marker };
}

function inspectExactOwnedExtension(
  extension: X4MergeLawOracleExtensionStagingPlan,
  initialRootStat: fs.Stats,
): boolean {
  if (!isSafeDirectoryStat(initialRootStat) || !hasExactPhysicalPath(extension.absoluteRoot)) {
    return false;
  }
  if (!hasExactDirectoryEntries(
    extension.absoluteRoot,
    [REQUIRED_CONTENT_PATH, REQUIRED_MD_DIRECTORY, X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME],
  )) {
    return false;
  }

  const files = getExactPlannedFiles(extension);
  if (files === null) return false;
  const mdDirectory = path.resolve(extension.absoluteRoot, REQUIRED_MD_DIRECTORY);
  let mdStatBefore: fs.Stats;
  try {
    mdStatBefore = fs.lstatSync(mdDirectory);
  } catch {
    return false;
  }
  if (
    !isSafeDirectoryStat(mdStatBefore)
    || !hasExactPhysicalPath(mdDirectory)
    || !hasExactDirectoryEntries(mdDirectory, [REQUIRED_MD_FILENAME])
  ) {
    return false;
  }

  if (
    !inspectExactPlannedFile(files.content)
    || !inspectExactPlannedFile(files.md)
    || !inspectExactPlannedFile(files.marker)
  ) {
    return false;
  }

  let rootStatAfter: fs.Stats;
  let mdStatAfter: fs.Stats;
  try {
    rootStatAfter = fs.lstatSync(extension.absoluteRoot);
    mdStatAfter = fs.lstatSync(mdDirectory);
  } catch {
    return false;
  }
  return isSafeDirectoryStat(rootStatAfter)
    && isSafeDirectoryStat(mdStatAfter)
    && sameStableStat(initialRootStat, rootStatAfter)
    && sameStableStat(mdStatBefore, mdStatAfter)
    && hasExactDirectoryEntries(
      extension.absoluteRoot,
      [REQUIRED_CONTENT_PATH, REQUIRED_MD_DIRECTORY, X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME],
    )
    && hasExactDirectoryEntries(mdDirectory, [REQUIRED_MD_FILENAME]);
}

function targetInspectionSuccess(
  state: X4MergeLawOracleStagingTargetState,
  plan: X4MergeLawOracleStagingPlanSuccess,
): X4MergeLawOracleStagingTargetInspectionSuccess {
  return Object.freeze({ ok: true as const, state, plan });
}

/** Rebuild a strict plan and inspect only its three exact staging targets without mutation. */
export function inspectX4MergeLawOracleStagingTargets(
  extensionsRoot: unknown,
  manifestValue: unknown,
): X4MergeLawOracleStagingTargetInspectionResult {
  const plan = buildX4MergeLawOracleStagingPlan(extensionsRoot, manifestValue);
  if (plan.ok === false) return plan;

  try {
    const probes = plan.extensions.map(extension => probeTargetRoot(extension.absoluteRoot));
    if (probes.some(probe => probe.state === "conflict")) {
      return failure(ERROR_MESSAGES.targetConflict);
    }

    const absentCount = probes.filter(probe => probe.state === "absent").length;
    if (absentCount === probes.length) return targetInspectionSuccess("ready", plan);
    if (absentCount !== 0) return failure(ERROR_MESSAGES.targetConflict);

    for (let index = 0; index < plan.extensions.length; index += 1) {
      const probe = probes[index];
      if (
        probe.state !== "present"
        || !inspectExactOwnedExtension(plan.extensions[index], probe.stat)
      ) {
        return failure(ERROR_MESSAGES.targetConflict);
      }
    }
    return targetInspectionSuccess("idempotent", plan);
  } catch {
    return failure(ERROR_MESSAGES.targetConflict);
  }
}

export type X4MergeLawOracleTransactionalStageState = "staged" | "idempotent";

export interface X4MergeLawOracleTransactionalStageSuccess {
  readonly ok: true;
  readonly state: X4MergeLawOracleTransactionalStageState;
  readonly plan: X4MergeLawOracleStagingPlanSuccess;
}

export type X4MergeLawOracleTransactionalStageResult =
  | X4MergeLawOracleTransactionalStageSuccess
  | X4MergeLawOracleFsFailure;

interface X4MergeLawOracleTransactionExtensionState {
  readonly extension: X4MergeLawOracleExtensionStagingPlan;
  readonly mdDirectory: string;
  readonly writtenFiles: X4MergeLawOraclePlannedFile[];
  rootCreated: boolean;
  mdCreated: boolean;
  presentInTransaction: boolean;
}

interface X4MergeLawOracleStageTransaction {
  readonly realPlan: X4MergeLawOracleStagingPlanSuccess;
  readonly basename: string;
  readonly absoluteRoot: string;
  readonly ownerFile: string;
  readonly ownerContent: string;
  readonly ownerSha256: string;
  readonly extensionsRoot: string;
  ownerCreated: boolean;
  extensionsRootCreated: boolean;
  stagedPlan: X4MergeLawOracleStagingPlanSuccess | null;
  extensionStates: X4MergeLawOracleTransactionExtensionState[];
}

function plansMatchExactly(
  left: X4MergeLawOracleStagingPlanSuccess,
  right: X4MergeLawOracleStagingPlanSuccess,
): boolean {
  if (
    left.runId !== right.runId
    || left.fixtureHash !== right.fixtureHash
    || left.manifestSha256 !== right.manifestSha256
    || left.dependencyOrder.length !== right.dependencyOrder.length
    || left.extensions.length !== right.extensions.length
    || left.files.length !== right.files.length
  ) {
    return false;
  }
  for (let index = 0; index < left.dependencyOrder.length; index += 1) {
    if (left.dependencyOrder[index] !== right.dependencyOrder[index]) return false;
  }
  for (let index = 0; index < left.extensions.length; index += 1) {
    const leftExtension = left.extensions[index];
    const rightExtension = right.extensions[index];
    if (
      leftExtension.extensionId !== rightExtension.extensionId
      || leftExtension.normalizedRelativeRoot !== rightExtension.normalizedRelativeRoot
      || leftExtension.files.length !== rightExtension.files.length
    ) {
      return false;
    }
    for (let fileIndex = 0; fileIndex < leftExtension.files.length; fileIndex += 1) {
      const leftFile = leftExtension.files[fileIndex];
      const rightFile = rightExtension.files[fileIndex];
      if (
        leftFile.kind !== rightFile.kind
        || leftFile.extensionId !== rightFile.extensionId
        || leftFile.normalizedRelativePath !== rightFile.normalizedRelativePath
        || leftFile.utf8Content !== rightFile.utf8Content
        || leftFile.sha256 !== rightFile.sha256
      ) {
        return false;
      }
    }
  }
  return true;
}

function transactionOwnerContent(
  plan: X4MergeLawOracleStagingPlanSuccess,
  transactionBasename: string,
): string {
  return `${canonicalX4MergeJson({
    schemaVersion: X4_MERGE_LAW_ORACLE_OWNER_MARKER_SCHEMA_VERSION,
    runId: plan.runId,
    fixtureHash: plan.fixtureHash,
    manifestSha256: plan.manifestSha256,
    transactionBasename,
  })}\n`;
}

function transactionLocationIsGuarded(transaction: X4MergeLawOracleStageTransaction): boolean {
  if (
    !STAGE_TRANSACTION_BASENAME.test(transaction.basename)
    || path.basename(transaction.absoluteRoot) !== transaction.basename
  ) {
    return false;
  }
  const expectedRoot = path.resolve(transaction.realPlan.physicalRoot, transaction.basename);
  const relativeRoot = path.relative(transaction.realPlan.physicalRoot, transaction.absoluteRoot);
  return normalizeCaseSensitivePhysicalPath(expectedRoot)
      === normalizeCaseSensitivePhysicalPath(transaction.absoluteRoot)
    && relativeRoot === transaction.basename
    && path.dirname(transaction.absoluteRoot) === transaction.realPlan.physicalRoot;
}

function createStageTransaction(
  realPlan: X4MergeLawOracleStagingPlanSuccess,
): X4MergeLawOracleStageTransaction | null {
  for (let attempt = 0; attempt < STAGE_TRANSACTION_CREATION_ATTEMPTS; attempt += 1) {
    const basename = `${STAGE_TRANSACTION_PREFIX}${randomBytes(16).toString("hex")}`;
    const absoluteRoot = resolveContainedTarget(realPlan.physicalRoot, [basename]);
    if (absoluteRoot === null) continue;
    const ownerContent = transactionOwnerContent(realPlan, basename);
    try {
      fs.mkdirSync(absoluteRoot);
    } catch (error: unknown) {
      if (hasFsErrorCode(error, "EEXIST")) continue;
      throw error;
    }
    return {
      realPlan,
      basename,
      absoluteRoot,
      ownerFile: path.resolve(absoluteRoot, STAGE_TRANSACTION_OWNER_FILENAME),
      ownerContent,
      ownerSha256: sha256Utf8(ownerContent),
      extensionsRoot: path.resolve(absoluteRoot, "extensions"),
      ownerCreated: false,
      extensionsRootCreated: false,
      stagedPlan: null,
      extensionStates: [],
    };
  }
  return null;
}

function initializeTransactionExtensions(
  transaction: X4MergeLawOracleStageTransaction,
  stagedPlan: X4MergeLawOracleStagingPlanSuccess,
): void {
  transaction.stagedPlan = stagedPlan;
  transaction.extensionStates = stagedPlan.extensions.map(extension => ({
    extension,
    mdDirectory: path.resolve(extension.absoluteRoot, REQUIRED_MD_DIRECTORY),
    writtenFiles: [],
    rootCreated: false,
    mdCreated: false,
    presentInTransaction: false,
  }));
}

function exactWrittenFileSet(
  extensionState: X4MergeLawOracleTransactionExtensionState,
): ReadonlySet<string> | null {
  const exactFiles = getExactPlannedFiles(extensionState.extension);
  if (exactFiles === null) return null;
  const allowed = new Set([
    exactFiles.content.absolutePath,
    exactFiles.md.absolutePath,
    exactFiles.marker.absolutePath,
  ].map(normalizeCaseSensitivePhysicalPath));
  const written = new Set<string>();
  for (const file of extensionState.writtenFiles) {
    const comparablePath = normalizeCaseSensitivePhysicalPath(file.absolutePath);
    if (!allowed.has(comparablePath) || written.has(comparablePath)) return null;
    written.add(comparablePath);
  }
  return written;
}

function verifyTransactionExtension(
  extensionState: X4MergeLawOracleTransactionExtensionState,
): boolean {
  if (!extensionState.rootCreated || !extensionState.presentInTransaction) return false;
  let rootStat: fs.Stats;
  try {
    rootStat = fs.lstatSync(extensionState.extension.absoluteRoot);
  } catch {
    return false;
  }
  if (
    !isSafeDirectoryStat(rootStat)
    || !hasExactPhysicalPath(extensionState.extension.absoluteRoot)
  ) {
    return false;
  }

  const exactFiles = getExactPlannedFiles(extensionState.extension);
  const written = exactWrittenFileSet(extensionState);
  if (exactFiles === null || written === null) return false;
  const contentWritten = written.has(normalizeCaseSensitivePhysicalPath(exactFiles.content.absolutePath));
  const mdWritten = written.has(normalizeCaseSensitivePhysicalPath(exactFiles.md.absolutePath));
  const markerWritten = written.has(normalizeCaseSensitivePhysicalPath(exactFiles.marker.absolutePath));
  if (mdWritten && !extensionState.mdCreated) return false;

  const rootEntries: string[] = [];
  if (contentWritten) rootEntries.push(REQUIRED_CONTENT_PATH);
  if (extensionState.mdCreated) rootEntries.push(REQUIRED_MD_DIRECTORY);
  if (markerWritten) rootEntries.push(X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME);
  if (!hasExactDirectoryEntries(extensionState.extension.absoluteRoot, rootEntries)) return false;

  if (extensionState.mdCreated) {
    let mdStat: fs.Stats;
    try {
      mdStat = fs.lstatSync(extensionState.mdDirectory);
    } catch {
      return false;
    }
    if (
      !isSafeDirectoryStat(mdStat)
      || !hasExactPhysicalPath(extensionState.mdDirectory)
      || !hasExactDirectoryEntries(
        extensionState.mdDirectory,
        mdWritten ? [REQUIRED_MD_FILENAME] : [],
      )
    ) {
      return false;
    }
  }

  return extensionState.writtenFiles.every(inspectExactPlannedFile);
}

function verifyStageTransaction(transaction: X4MergeLawOracleStageTransaction): boolean {
  if (!transaction.ownerCreated || !transactionLocationIsGuarded(transaction)) return false;
  let transactionStat: fs.Stats;
  try {
    transactionStat = fs.lstatSync(transaction.absoluteRoot);
  } catch {
    return false;
  }
  if (!isSafeDirectoryStat(transactionStat) || !hasExactPhysicalPath(transaction.absoluteRoot)) {
    return false;
  }

  const transactionEntries = [STAGE_TRANSACTION_OWNER_FILENAME];
  if (transaction.extensionsRootCreated) transactionEntries.push("extensions");
  if (!hasExactDirectoryEntries(transaction.absoluteRoot, transactionEntries)) return false;
  if (!inspectExactFileBytes(
    transaction.ownerFile,
    Buffer.from(transaction.ownerContent, "utf8"),
    transaction.ownerSha256,
  )) {
    return false;
  }

  if (!transaction.extensionsRootCreated) return transaction.extensionStates.length === 0;
  let extensionsRootStat: fs.Stats;
  try {
    extensionsRootStat = fs.lstatSync(transaction.extensionsRoot);
  } catch {
    return false;
  }
  if (
    !isSafeDirectoryStat(extensionsRootStat)
    || !hasExactPhysicalPath(transaction.extensionsRoot)
  ) {
    return false;
  }

  const expectedExtensions = transaction.extensionStates
    .filter(extension => extension.rootCreated && extension.presentInTransaction)
    .map(extension => extension.extension.extensionId);
  if (!hasExactDirectoryEntries(transaction.extensionsRoot, expectedExtensions)) return false;
  for (const extensionState of transaction.extensionStates) {
    if (extensionState.rootCreated && extensionState.presentInTransaction) {
      if (!verifyTransactionExtension(extensionState)) return false;
    } else if (extensionState.presentInTransaction) {
      return false;
    }
  }
  return true;
}

function cleanupVerifiedStageTransaction(
  transaction: X4MergeLawOracleStageTransaction,
): boolean {
  if (!verifyStageTransaction(transaction)) return false;
  try {
    for (let index = transaction.extensionStates.length - 1; index >= 0; index -= 1) {
      const extensionState = transaction.extensionStates[index];
      if (!extensionState.rootCreated || !extensionState.presentInTransaction) continue;
      while (extensionState.writtenFiles.length > 0) {
        const file = extensionState.writtenFiles[extensionState.writtenFiles.length - 1];
        fs.unlinkSync(file.absolutePath);
        extensionState.writtenFiles.pop();
      }
      if (extensionState.mdCreated) {
        fs.rmdirSync(extensionState.mdDirectory);
        extensionState.mdCreated = false;
      }
      fs.rmdirSync(extensionState.extension.absoluteRoot);
      extensionState.rootCreated = false;
      extensionState.presentInTransaction = false;
    }
    if (transaction.extensionsRootCreated) {
      fs.rmdirSync(transaction.extensionsRoot);
      transaction.extensionsRootCreated = false;
    }
    fs.unlinkSync(transaction.ownerFile);
    transaction.ownerCreated = false;
    fs.rmdirSync(transaction.absoluteRoot);
    return probeTargetRoot(transaction.absoluteRoot).state === "absent";
  } catch {
    return false;
  }
}

function cleanupEmptyUnownedStageTransaction(
  transaction: X4MergeLawOracleStageTransaction,
): boolean {
  if (
    transaction.ownerCreated
    || transaction.extensionsRootCreated
    || transaction.extensionStates.length !== 0
    || !transactionLocationIsGuarded(transaction)
  ) {
    return false;
  }
  let transactionStat: fs.Stats;
  try {
    transactionStat = fs.lstatSync(transaction.absoluteRoot);
  } catch {
    return false;
  }
  if (
    !isSafeDirectoryStat(transactionStat)
    || !hasExactPhysicalPath(transaction.absoluteRoot)
    || !hasExactDirectoryEntries(transaction.absoluteRoot, [])
  ) {
    return false;
  }
  try {
    fs.rmdirSync(transaction.absoluteRoot);
    return probeTargetRoot(transaction.absoluteRoot).state === "absent";
  } catch {
    return false;
  }
}

function writeExactStageTree(transaction: X4MergeLawOracleStageTransaction): void {
  for (const extensionState of transaction.extensionStates) {
    fs.mkdirSync(extensionState.extension.absoluteRoot);
    extensionState.rootCreated = true;
    extensionState.presentInTransaction = true;
    fs.mkdirSync(extensionState.mdDirectory);
    extensionState.mdCreated = true;
    for (const file of extensionState.extension.files) {
      fs.writeFileSync(file.absolutePath, Buffer.from(file.utf8Content, "utf8"), { flag: "wx" });
      extensionState.writtenFiles.push(file);
    }
  }
}

function transactionalStageSuccess(
  state: X4MergeLawOracleTransactionalStageState,
  plan: X4MergeLawOracleStagingPlanSuccess,
): X4MergeLawOracleTransactionalStageSuccess {
  return Object.freeze({ ok: true as const, state, plan });
}

function stagingFailureWithCleanup(
  transaction: X4MergeLawOracleStageTransaction,
): X4MergeLawOracleTransactionalStageResult {
  const cleaned = transaction.ownerCreated
    ? cleanupVerifiedStageTransaction(transaction)
    : cleanupEmptyUnownedStageTransaction(transaction);
  return cleaned
    ? failure(ERROR_MESSAGES.stageFailed)
    : failure(ERROR_MESSAGES.stageResidue);
}

function isSameFilesystemRoot(left: string, right: string): boolean {
  return normalizeComparablePath(path.parse(left).root)
    === normalizeComparablePath(path.parse(right).root);
}

/** Private selftest seam; production always delegates directly to Node's same-volume rename. */
function renameStageDirectory(source: string, destination: string): void {
  fs.renameSync(source, destination);
}

function inspectOwnedExtensionAt(
  extension: X4MergeLawOracleExtensionStagingPlan,
): boolean {
  try {
    const stat = fs.lstatSync(extension.absoluteRoot);
    return inspectExactOwnedExtension(extension, stat);
  } catch {
    return false;
  }
}

function rollbackPromotedExtensions(
  transaction: X4MergeLawOracleStageTransaction,
  promotedIndexes: readonly number[],
): boolean {
  for (let listIndex = promotedIndexes.length - 1; listIndex >= 0; listIndex -= 1) {
    const extensionIndex = promotedIndexes[listIndex];
    const realExtension = transaction.realPlan.extensions[extensionIndex];
    const transactionExtension = transaction.extensionStates[extensionIndex];
    if (
      transactionExtension === undefined
      || transactionExtension.presentInTransaction
      || !inspectOwnedExtensionAt(realExtension)
      || probeTargetRoot(transactionExtension.extension.absoluteRoot).state !== "absent"
      || !isSameFilesystemRoot(
        realExtension.absoluteRoot,
        transactionExtension.extension.absoluteRoot,
      )
    ) {
      return false;
    }

    try {
      renameStageDirectory(realExtension.absoluteRoot, transactionExtension.extension.absoluteRoot);
      transactionExtension.presentInTransaction = true;
    } catch {
      return false;
    }
    if (!inspectOwnedExtensionAt(transactionExtension.extension)) return false;
  }
  return verifyStageTransaction(transaction);
}

function stagingFailureAfterPromotion(
  transaction: X4MergeLawOracleStageTransaction,
  promotedIndexes: readonly number[],
): X4MergeLawOracleTransactionalStageResult {
  if (!rollbackPromotedExtensions(transaction, promotedIndexes)) {
    return failure(ERROR_MESSAGES.rollbackIncomplete);
  }
  return stagingFailureWithCleanup(transaction);
}

/** Transactionally stage the strict merge-law fixture into an explicit extensions root. */
export function stageX4MergeLawOracleFixture(
  extensionsRoot: unknown,
  manifestValue: unknown,
): X4MergeLawOracleTransactionalStageResult {
  const preflight = inspectX4MergeLawOracleStagingTargets(extensionsRoot, manifestValue);
  if (preflight.ok === false) return preflight;
  if (preflight.state === "idempotent") {
    return transactionalStageSuccess("idempotent", preflight.plan);
  }

  const realPlan = preflight.plan;
  let transaction: X4MergeLawOracleStageTransaction | null = null;
  const promotedIndexes: number[] = [];
  try {
    transaction = createStageTransaction(realPlan);
    if (transaction === null) return failure(ERROR_MESSAGES.stageFailed);

    fs.writeFileSync(
      transaction.ownerFile,
      Buffer.from(transaction.ownerContent, "utf8"),
      { flag: "wx" },
    );
    transaction.ownerCreated = true;
    if (!verifyStageTransaction(transaction)) return stagingFailureWithCleanup(transaction);

    fs.mkdirSync(transaction.extensionsRoot);
    transaction.extensionsRootCreated = true;
    if (!verifyStageTransaction(transaction)) return stagingFailureWithCleanup(transaction);

    const stagedPlanResult = buildX4MergeLawOracleStagingPlan(
      transaction.extensionsRoot,
      manifestValue,
    );
    if (
      stagedPlanResult.ok === false
      || !plansMatchExactly(realPlan, stagedPlanResult)
    ) {
      return stagingFailureWithCleanup(transaction);
    }
    initializeTransactionExtensions(transaction, stagedPlanResult);
    writeExactStageTree(transaction);
    if (!verifyStageTransaction(transaction)) return stagingFailureWithCleanup(transaction);

    const stagedInspection = inspectX4MergeLawOracleStagingTargets(
      transaction.extensionsRoot,
      manifestValue,
    );
    if (
      stagedInspection.ok === false
      || stagedInspection.state !== "idempotent"
      || !plansMatchExactly(realPlan, stagedInspection.plan)
      || !verifyStageTransaction(transaction)
    ) {
      return stagingFailureWithCleanup(transaction);
    }

    const immediateRealInspection = inspectX4MergeLawOracleStagingTargets(
      realPlan.physicalRoot,
      manifestValue,
    );
    if (
      immediateRealInspection.ok === false
      || immediateRealInspection.state !== "ready"
      || !plansMatchExactly(realPlan, immediateRealInspection.plan)
    ) {
      return stagingFailureWithCleanup(transaction);
    }

    for (let index = 0; index < transaction.extensionStates.length; index += 1) {
      const transactionExtension = transaction.extensionStates[index];
      const realExtension = realPlan.extensions[index];
      if (
        transactionExtension === undefined
        || realExtension === undefined
        || !transactionExtension.presentInTransaction
        || !inspectOwnedExtensionAt(transactionExtension.extension)
        || probeTargetRoot(realExtension.absoluteRoot).state !== "absent"
        || !isSameFilesystemRoot(
          transactionExtension.extension.absoluteRoot,
          realExtension.absoluteRoot,
        )
      ) {
        return stagingFailureAfterPromotion(transaction, promotedIndexes);
      }

      try {
        renameStageDirectory(transactionExtension.extension.absoluteRoot, realExtension.absoluteRoot);
        transactionExtension.presentInTransaction = false;
        promotedIndexes.push(index);
      } catch {
        return stagingFailureAfterPromotion(transaction, promotedIndexes);
      }
      if (!inspectOwnedExtensionAt(realExtension)) {
        return stagingFailureAfterPromotion(transaction, promotedIndexes);
      }
    }

    const finalInspection = inspectX4MergeLawOracleStagingTargets(
      realPlan.physicalRoot,
      manifestValue,
    );
    if (
      finalInspection.ok === false
      || finalInspection.state !== "idempotent"
      || !plansMatchExactly(realPlan, finalInspection.plan)
    ) {
      return stagingFailureAfterPromotion(transaction, promotedIndexes);
    }
    if (!cleanupVerifiedStageTransaction(transaction)) {
      return failure(ERROR_MESSAGES.stageResidue);
    }
    return transactionalStageSuccess("staged", finalInspection.plan);
  } catch {
    if (transaction === null) return failure(ERROR_MESSAGES.stageFailed);
    if (promotedIndexes.length > 0) {
      return stagingFailureAfterPromotion(transaction, promotedIndexes);
    }
    return stagingFailureWithCleanup(transaction);
  }
}

export type X4MergeLawOracleCleanupSuccessState = "cleaned" | "already_clean";

export interface X4MergeLawOracleCleanupSuccess {
  readonly ok: true;
  readonly state: X4MergeLawOracleCleanupSuccessState;
  readonly plan: X4MergeLawOracleStagingPlanSuccess;
}

export type X4MergeLawOracleCleanupFailureState = "refused" | "cleanup_incomplete";

export interface X4MergeLawOracleCleanupFailure {
  readonly ok: false;
  readonly state: X4MergeLawOracleCleanupFailureState;
  readonly errors: readonly string[];
}

export type X4MergeLawOracleCleanupResult =
  | X4MergeLawOracleCleanupSuccess
  | X4MergeLawOracleCleanupFailure;

interface X4MergeLawOracleCleanupExtensionProgress {
  readonly extension: X4MergeLawOracleExtensionStagingPlan;
  readonly files: X4MergeLawOracleExactPlannedFiles;
  readonly mdDirectory: string;
  rootPresent: boolean;
  contentPresent: boolean;
  mdDirectoryPresent: boolean;
  mdFilePresent: boolean;
  markerPresent: boolean;
}

function cleanupSuccess(
  state: X4MergeLawOracleCleanupSuccessState,
  plan: X4MergeLawOracleStagingPlanSuccess,
): X4MergeLawOracleCleanupSuccess {
  return Object.freeze({ ok: true as const, state, plan });
}

function cleanupFailure(
  state: X4MergeLawOracleCleanupFailureState,
  message: string,
): X4MergeLawOracleCleanupFailure {
  return Object.freeze({
    ok: false as const,
    state,
    errors: Object.freeze([message]),
  });
}

function cleanupProgressFailure(
  mutationStarted: boolean,
): X4MergeLawOracleCleanupFailure {
  return cleanupFailure(
    mutationStarted ? "cleanup_incomplete" : "refused",
    mutationStarted ? ERROR_MESSAGES.cleanupIncomplete : ERROR_MESSAGES.cleanupRefused,
  );
}

function cleanupRefusalFrom(
  result: X4MergeLawOracleFsFailure,
): X4MergeLawOracleCleanupFailure {
  return cleanupFailure(
    "refused",
    result.errors[0] ?? ERROR_MESSAGES.cleanupRefused,
  );
}

function createCleanupProgress(
  plan: X4MergeLawOracleStagingPlanSuccess,
): X4MergeLawOracleCleanupExtensionProgress[] | null {
  if (plan.extensions.length !== 3 || plan.dependencyOrder.length !== 3) return null;
  const progress: X4MergeLawOracleCleanupExtensionProgress[] = [];
  for (let index = 0; index < plan.extensions.length; index += 1) {
    const extension = plan.extensions[index];
    if (extension.extensionId !== plan.dependencyOrder[index]) return null;
    const files = getExactPlannedFiles(extension);
    if (files === null) return null;
    progress.push({
      extension,
      files,
      mdDirectory: path.resolve(extension.absoluteRoot, REQUIRED_MD_DIRECTORY),
      rootPresent: true,
      contentPresent: true,
      mdDirectoryPresent: true,
      mdFilePresent: true,
      markerPresent: true,
    });
  }
  return progress;
}

function verifyCleanupExtensionProgress(
  progress: X4MergeLawOracleCleanupExtensionProgress,
): boolean {
  if (!progress.rootPresent) {
    return !progress.contentPresent
      && !progress.mdDirectoryPresent
      && !progress.mdFilePresent
      && !progress.markerPresent
      && probeTargetRoot(progress.extension.absoluteRoot).state === "absent";
  }
  if (progress.mdFilePresent && !progress.mdDirectoryPresent) return false;

  let rootStatBefore: fs.Stats;
  try {
    rootStatBefore = fs.lstatSync(progress.extension.absoluteRoot);
  } catch {
    return false;
  }
  if (
    !isSafeDirectoryStat(rootStatBefore)
    || !hasExactPhysicalPath(progress.extension.absoluteRoot)
  ) {
    return false;
  }

  const rootEntries: string[] = [];
  if (progress.contentPresent) rootEntries.push(REQUIRED_CONTENT_PATH);
  if (progress.mdDirectoryPresent) rootEntries.push(REQUIRED_MD_DIRECTORY);
  if (progress.markerPresent) rootEntries.push(X4_MERGE_LAW_ORACLE_OWNER_MARKER_FILENAME);
  if (!hasExactDirectoryEntries(progress.extension.absoluteRoot, rootEntries)) return false;

  let mdStatBefore: fs.Stats | null = null;
  if (progress.mdDirectoryPresent) {
    try {
      mdStatBefore = fs.lstatSync(progress.mdDirectory);
    } catch {
      return false;
    }
    if (
      !isSafeDirectoryStat(mdStatBefore)
      || !hasExactPhysicalPath(progress.mdDirectory)
      || !hasExactDirectoryEntries(
        progress.mdDirectory,
        progress.mdFilePresent ? [REQUIRED_MD_FILENAME] : [],
      )
    ) {
      return false;
    }
  }

  if (
    (progress.contentPresent && !inspectExactPlannedFile(progress.files.content))
    || (progress.mdFilePresent && !inspectExactPlannedFile(progress.files.md))
    || (progress.markerPresent && !inspectExactPlannedFile(progress.files.marker))
  ) {
    return false;
  }

  let rootStatAfter: fs.Stats;
  let mdStatAfter: fs.Stats | null = null;
  try {
    rootStatAfter = fs.lstatSync(progress.extension.absoluteRoot);
    if (progress.mdDirectoryPresent) mdStatAfter = fs.lstatSync(progress.mdDirectory);
  } catch {
    return false;
  }
  return isSafeDirectoryStat(rootStatAfter)
    && sameStableStat(rootStatBefore, rootStatAfter)
    && (mdStatBefore === null
      ? mdStatAfter === null
      : mdStatAfter !== null
        && isSafeDirectoryStat(mdStatAfter)
        && sameStableStat(mdStatBefore, mdStatAfter))
    && hasExactDirectoryEntries(progress.extension.absoluteRoot, rootEntries)
    && (!progress.mdDirectoryPresent || hasExactDirectoryEntries(
      progress.mdDirectory,
      progress.mdFilePresent ? [REQUIRED_MD_FILENAME] : [],
    ));
}

function verifyCleanupProgress(
  progress: readonly X4MergeLawOracleCleanupExtensionProgress[],
): boolean {
  return progress.length === 3 && progress.every(verifyCleanupExtensionProgress);
}

/** Private selftest seams; production delegates only exact file and directory removal to Node. */
function unlinkCleanupFile(absolutePath: string): void {
  fs.unlinkSync(absolutePath);
}

function removeCleanupDirectory(absolutePath: string): void {
  fs.rmdirSync(absolutePath);
}

/** Remove only a fully verified merge-law fixture from an explicit physical extensions root. */
export function cleanupX4MergeLawOracleFixture(
  extensionsRoot: unknown,
  manifestValue: unknown,
): X4MergeLawOracleCleanupResult {
  let mutationStarted = false;
  try {
    const preflight = inspectX4MergeLawOracleStagingTargets(extensionsRoot, manifestValue);
    if (preflight.ok === false) return cleanupRefusalFrom(preflight);
    if (preflight.state === "ready") {
      return cleanupSuccess("already_clean", preflight.plan);
    }

    const immediate = inspectX4MergeLawOracleStagingTargets(extensionsRoot, manifestValue);
    if (
      immediate.ok === false
      || immediate.state !== "idempotent"
      || !plansMatchExactly(preflight.plan, immediate.plan)
      || normalizeCaseSensitivePhysicalPath(preflight.plan.physicalRoot)
        !== normalizeCaseSensitivePhysicalPath(immediate.plan.physicalRoot)
    ) {
      return cleanupFailure("refused", ERROR_MESSAGES.cleanupRefused);
    }

    const progress = createCleanupProgress(immediate.plan);
    if (progress === null || !verifyCleanupProgress(progress)) {
      return cleanupFailure("refused", ERROR_MESSAGES.cleanupRefused);
    }

    const mutate = (operation: () => void, recordSuccess: () => void): boolean => {
      if (!verifyCleanupProgress(progress)) return false;
      mutationStarted = true;
      operation();
      recordSuccess();
      return verifyCleanupProgress(progress);
    };

    for (let index = progress.length - 1; index >= 0; index -= 1) {
      const extension = progress[index];
      if (!mutate(
        () => unlinkCleanupFile(extension.files.md.absolutePath),
        () => { extension.mdFilePresent = false; },
      )) {
        return cleanupProgressFailure(mutationStarted);
      }
      if (!mutate(
        () => removeCleanupDirectory(extension.mdDirectory),
        () => { extension.mdDirectoryPresent = false; },
      )) {
        return cleanupProgressFailure(mutationStarted);
      }
      if (!mutate(
        () => unlinkCleanupFile(extension.files.content.absolutePath),
        () => { extension.contentPresent = false; },
      )) {
        return cleanupProgressFailure(mutationStarted);
      }
      if (!mutate(
        () => unlinkCleanupFile(extension.files.marker.absolutePath),
        () => { extension.markerPresent = false; },
      )) {
        return cleanupProgressFailure(mutationStarted);
      }
      if (!mutate(
        () => removeCleanupDirectory(extension.extension.absoluteRoot),
        () => { extension.rootPresent = false; },
      )) {
        return cleanupProgressFailure(mutationStarted);
      }
    }

    const finalInspection = inspectX4MergeLawOracleStagingTargets(
      immediate.plan.physicalRoot,
      manifestValue,
    );
    if (
      finalInspection.ok === false
      || finalInspection.state !== "ready"
      || !plansMatchExactly(immediate.plan, finalInspection.plan)
    ) {
      return cleanupFailure("cleanup_incomplete", ERROR_MESSAGES.cleanupIncomplete);
    }
    return cleanupSuccess("cleaned", finalInspection.plan);
  } catch {
    return cleanupFailure(
      mutationStarted ? "cleanup_incomplete" : "refused",
      mutationStarted ? ERROR_MESSAGES.cleanupIncomplete : ERROR_MESSAGES.cleanupRefused,
    );
  }
}
