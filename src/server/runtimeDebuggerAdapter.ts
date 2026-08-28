/**
 * Server adapter for the deterministic runtime debugger and durable session store.
 *
 * The parser and session store deliberately know nothing about Express, X4 paths,
 * workspaces, or deployed extensions.  This module is the narrow authority bridge:
 * it resolves one addressed workspace, reads only the next bounded log window,
 * persists bounded parser facts, and turns those facts into the additive watcher
 * payload.  It never persists the log itself and never asks a model to classify it.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  attributeRuntimeCandidate,
  buildRuntimeOwnershipIndex,
  deduplicateRuntimeIncidents,
  evaluateExpectedRuntimeSteps,
  explainRuntimeCandidate,
  mapRuntimeCandidateToSource,
  parseRuntimeCandidates,
  type RuntimeAnalyzedCandidate,
  type RuntimeAttribution,
  type RuntimeCandidateIncident,
  type RuntimeCurrentSegmentEvidence,
  type RuntimeExpectedStep,
  type RuntimeExpectedStepResult,
  type RuntimeManifestFile,
  type RuntimeOwnershipIndex,
  type RuntimeExtensionInput,
  type RuntimeSourceMapping,
  type RuntimeExplanation,
} from "../lib/runtimeDebugger";
import {
  RuntimeDebugSessionStore,
  RUNTIME_DEBUG_SESSION_DIR,
  type RuntimeDebugFileStat,
  type RuntimeDebugIncidentInput,
  type RuntimeDebugIncident,
  type RuntimeDebugLine,
  type RuntimeDebugDroppedCounts,
  type RuntimeDebugSessionFailure,
  type RuntimeDebugSessionResult,
  type RuntimeDebugSessionSnapshot,
} from "../lib/runtimeDebugSession";
import {
  type RuntimeDebuggerAuthority,
  type RuntimeDebuggerCoverage,
  type RuntimeDebuggerIncident,
  type RuntimeDebuggerPayload,
  type RuntimeDebuggerSession,
} from "../lib/runtimeDebuggerView";
import { dataPath } from "../lib/dataDir";
import { findCatDatArchives, parseCat, readEntryText, type CatEntry } from "../lib/x4CatDat";
import { resolveXsdConfig } from "../lib/xsdParser";
import { isSha256Fingerprint } from "../lib/x4UiGameVerification";
import type { ModWorkspace } from "../types";
import type { WorkspaceRecord } from "../lib/workspaceRegistry";

export const RUNTIME_DEBUGGER_ADAPTER_SCHEMA_VERSION = 1 as const;
export const RUNTIME_DEBUGGER_COVERAGE_TARGET = 0.99 as const;
export const RUNTIME_DEBUGGER_ANALYZER_POLICY_VERSION = 2 as const;

const INTERNAL_DEPLOY_KEY = "__forge_runtime_deploy_metadata__";
const INTERNAL_EXPECTED_PREFIX = "__forge_runtime_expected__:";
const INTERNAL_ANALYZER_POLICY_KEY = "__forge_runtime_analyzer_policy__";
const INTERNAL_ATTR = "runtimeInternal";
const INTERNAL_DEPLOY = "deploy";
const INTERNAL_EXPECTED = "expected";
const INTERNAL_ANALYZER_POLICY = "analyzer-policy";
const MAX_RESPONSE_INCIDENTS = 64;
const MAX_RESPONSE_EXPECTED = 32;
const MAX_RESPONSE_EVIDENCE = 8;
const MAX_RESPONSE_TEXT = 1024;
const MAX_RESPONSE_PATH = 512;
const MAX_INVENTORY_EXTENSIONS = 128;
const MAX_INVENTORY_FILES_PER_EXTENSION = 4000;
const MAX_INVENTORY_TOTAL_FILES = 20_000;
const MAX_INVENTORY_TEXT_BYTES = 1 * 1024 * 1024;
const MAX_INVENTORY_FILE_TEXT_BYTES = 64 * 1024;
const DEFAULT_INVENTORY_TTL_MS = 180_000;
const USER_PROFILE_PLACEHOLDER = "%USERPROFILE%";

type RuntimeValue = string | number | boolean | null;

export interface RuntimeDebuggerDeployInfo {
  workspaceId?: string;
  modId: string;
  workspaceName: string;
  workspaceHash: string;
  deployedAt: string;
  stagingPath?: string;
  deployedPath?: string;
  deployedFingerprint?: string;
}

export interface RuntimeInstalledExtensionInventory {
  complete: boolean;
  root?: string;
  scannedAt: string;
  extensions: RuntimeExtensionInput[];
  error?: string;
}

export interface RuntimeDebuggerAdapterOptions {
  /** Defaults to the Forge-owned X4_DATA_DIR state path. */
  root?: string;
  /** Explicit game/mod/corpus roots that the session store must reject. */
  forbiddenRoots?: readonly string[];
  store?: RuntimeDebugSessionStore;
  now?: () => number;
  /** Explicit configured log path; authoritative when it resolves to a readable file. */
  preferredLogPath?: string;
  /** The server supplies its existing bounded log discovery helper. */
  logCandidates?: () => readonly string[];
  profileForLog?: (logPath: string) => string;
  /** Optional seam for tests or an existing installed-extension inventory owner. */
  installedInventory?: () => RuntimeInstalledExtensionInventory;
  inventoryTtlMs?: number;
}

export interface RuntimeDebuggerBriefInput {
  record: Pick<WorkspaceRecord, "workspaceId" | "workspace">;
  manifest: Record<string, string> | RuntimeManifestFile[];
  modId?: string;
  deployInfo?: RuntimeDebuggerDeployInfo | null;
  expectedSteps?: RuntimeExpectedStep[];
  /** Tests may supply a bounded inventory directly. */
  otherExtensions?: RuntimeExtensionInput[];
  inventoryComplete?: boolean;
}

export type RuntimeDebuggerVerdictState =
  | "no_log"
  | "stale"
  | "not_seen"
  | "loaded_with_errors"
  | "loaded_clean";

export interface RuntimeDebuggerVerdict {
  state: RuntimeDebuggerVerdictState;
  detail: string;
  errorCount: number;
  currentSession: boolean;
  positiveExecutionEvidence: boolean;
  coverageMet: boolean;
  unresolvedBlocker: boolean;
}

export interface RuntimeDebuggerAdapterResult {
  payload: RuntimeDebuggerPayload & {
    schemaVersion: typeof RUNTIME_DEBUGGER_ADAPTER_SCHEMA_VERSION;
    identity: {
      workspaceId: string;
      contentIds: string[];
      deployedFolders: string[];
      sourceFolders: string[];
      ownedFileCount: number;
      inventoryComplete: boolean;
      inventoryOtherExtensionCount: number;
      inventoryScannedAt?: string;
    };
    verdict: RuntimeDebuggerVerdict;
    hiddenOtherModSummary: string;
  };
  selectedLogPath: string;
  logUpdatedAt?: string;
  logBytes: number;
  newlyReadBytes: number;
  changedSinceDeploy: boolean;
  status: "no_log" | "stale" | "errors" | "warnings" | "clean" | "error";
  summary: string;
  timeline: Array<Record<string, unknown>>;
  artifact: string;
  deployInfo: RuntimeDebuggerDeployInfo | null;
}

interface SelectedLog {
  logPath: string;
  profileId: string;
  stat: RuntimeDebugFileStat;
}

interface InventoryCache {
  expiresAt: number;
  value: RuntimeInstalledExtensionInventory;
}

interface RuntimeDebuggerOwnership {
  active: RuntimeExtensionInput & { markerAliases: string[] };
  index: RuntimeOwnershipIndex;
  inventory: RuntimeInstalledExtensionInventory;
  otherExtensionCount: number;
}

interface ReconstructedIncident extends RuntimeDebuggerIncident {
  segmentId: string;
  recognized: boolean;
  explicitUnknown: boolean;
  positiveExecution: boolean;
}

interface ReconstructedExpected {
  stepId: string;
  evidence: string[];
  segmentId: string;
}

interface PersistedDeployEnvelope {
  info: RuntimeDebuggerDeployInfo;
  tokenHash: string;
}

function boundedText(value: unknown, limit = MAX_RESPONSE_TEXT, fallback = ""): string {
  const text = typeof value === "string" ? value : value == null ? fallback : String(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1))}…`;
}

function normalizedWindowsPath(value: string): string {
  const normalized = path.win32.normalize(value.replace(/\//g, "\\"));
  if (/^[A-Za-z]:\\$/.test(normalized) || normalized === "\\") return normalized;
  return normalized.replace(/[\\]+$/, "");
}

function userProfileRoot(): string | undefined {
  const configured = process.env.USERPROFILE || process.env.HOME || "";
  const value = typeof configured === "string" ? configured.trim() : "";
  if (!value) return undefined;
  const normalized = normalizedWindowsPath(value);
  return normalized && normalized !== "." ? normalized : undefined;
}

function redactUserProfilePath(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  if (!text) return undefined;
  const root = userProfileRoot();
  if (!root) return text;
  const candidate = normalizedWindowsPath(text);
  const rootLower = root.toLowerCase();
  const candidateLower = candidate.toLowerCase();
  if (candidateLower === rootLower) return USER_PROFILE_PLACEHOLDER;
  const prefix = root.endsWith("\\") ? root : `${root}\\`;
  if (!candidateLower.startsWith(prefix.toLowerCase())) return text;
  return `${USER_PROFILE_PLACEHOLDER}${candidate.slice(root.length)}`;
}

function redactUserProfileText(value: unknown): string {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  const root = userProfileRoot();
  if (!root || !text) return text;
  const escaped = root
    .split("\\")
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\\\/]+");
  return text.replace(new RegExp(`${escaped}(?=$|[\\\\/])`, "gi"), USER_PROFILE_PLACEHOLDER);
}

function redactedText(value: unknown, limit = MAX_RESPONSE_TEXT, fallback = ""): string {
  return boundedText(redactUserProfileText(value), limit, redactUserProfileText(fallback));
}

function boundedPath(value: unknown): string | undefined {
  const text = boundedText(redactUserProfilePath(value), MAX_RESPONSE_PATH).trim();
  return text || undefined;
}

function boundedCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1_000_000_000, Math.max(0, Math.floor(value)));
}

function safeIso(now: () => number): string {
  try { return new Date(now()).toISOString(); } catch { return new Date(0).toISOString(); }
}

function unique(values: Iterable<string>): string[] {
  return [...new Set([...values].map(value => String(value || "").trim()).filter(Boolean))];
}

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function safeJson(value: unknown, limit = 3800): string | undefined {
  try {
    const text = JSON.stringify(value);
    return Buffer.byteLength(text, "utf8") <= limit ? text : undefined;
  } catch {
    return undefined;
  }
}

function parseJson<T>(value: unknown): T | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try { return JSON.parse(value) as T; } catch { return undefined; }
}

function isRuntimeDisposition(value: unknown): value is RuntimeAttribution["disposition"] {
  return value === "confirmed_active"
    || value === "ambiguous"
    || value === "excluded_other_mod"
    || value === "unknown";
}

function isRuntimeMapping(value: unknown): value is RuntimeSourceMapping {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RuntimeSourceMapping>;
  return candidate.kind === "node" || candidate.kind === "file_line" || candidate.kind === "unmapped";
}

function isRuntimeExplanation(value: unknown): value is RuntimeExplanation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RuntimeExplanation>;
  return typeof candidate.cause === "string"
    && typeof candidate.impact === "string"
    && typeof candidate.nextAction === "string"
    && typeof candidate.evidenceLabel === "string"
    && typeof candidate.summary === "string";
}

function safeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function deriveProfileId(logPath: string): string {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  if (!home) return "";
  const root = path.join(home, "Documents", "Egosoft", "X4");
  const relative = path.relative(root, path.dirname(logPath));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return "";
  return relative.split(path.sep)[0] || "";
}

function normalizeManifest(input: Record<string, string> | RuntimeManifestFile[]): RuntimeManifestFile[] {
  const entries = Array.isArray(input)
    ? input
    : Object.entries(input || {}).map(([filePath, text]) => ({ path: filePath, text }));
  const byPath = new Map<string, RuntimeManifestFile>();
  for (const entry of entries) {
    if (!entry || typeof entry.path !== "string" || typeof entry.text !== "string") continue;
    const filePath = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!filePath || filePath.split("/").some(part => part === ".." || part === "")) continue;
    byPath.set(filePath, { path: filePath, text: entry.text });
  }
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function contentIdFromManifest(manifest: RuntimeManifestFile[], fallback: string): string {
  const content = manifest.find(file => file.path.toLowerCase() === "content.xml")?.text || "";
  const id = content.match(/<content\b[^>]*\bid\s*=\s*["']([^"']+)["']/i)?.[1];
  return String(id || fallback).trim() || fallback;
}

function basenameIdentity(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.replace(/[\\/]+$/, "") : "";
  if (!text) return undefined;
  return path.basename(text).trim() || undefined;
}

function deployedFolderFromInfo(info: RuntimeDebuggerDeployInfo | null | undefined): string | undefined {
  return basenameIdentity(info?.deployedPath) || basenameIdentity(info?.stagingPath);
}

function markerAliases(manifest: RuntimeManifestFile[]): string[] {
  const aliases: string[] = [];
  const callRe = /(?:DebugError|print)\s*\(\s*["'`]\s*\[([A-Za-z][A-Za-z0-9_-]{2,})\]/gi;
  for (const file of manifest) {
    if (!/\.lua$/i.test(file.path)) continue;
    let match: RegExpExecArray | null;
    callRe.lastIndex = 0;
    while ((match = callRe.exec(file.text))) aliases.push(match[1]);
  }
  return unique(aliases);
}

function activeInput(
  record: Pick<WorkspaceRecord, "workspaceId" | "workspace">,
  manifestInput: Record<string, string> | RuntimeManifestFile[],
  deployInfo: RuntimeDebuggerDeployInfo | null,
): RuntimeExtensionInput & { markerAliases: string[] } {
  const workspace = record.workspace as ModWorkspace;
  const manifest = normalizeManifest(manifestInput);
  // Request/query mod ids and display names are aliases/evidence only.  Exact
  // ownership comes from the addressed WorkspaceRecord, its parsed manifest,
  // its actual source folder, and the successful deploy destination.
  const sourceBase = basenameIdentity(workspace.sourceFolder);
  const fallbackContentId = String(workspace.contentId || sourceBase || "runtime").trim();
  const contentId = contentIdFromManifest(manifest, fallbackContentId);
  const deployedFolder = deployedFolderFromInfo(deployInfo) || contentId;
  const sourceFolder = workspace.sourceFolder || "";
  const ids = unique([contentId, workspace.contentId || ""]);
  const deployedFolders = unique([deployedFolder, contentId]);
  const aliases = unique([
    workspace.id,
    workspace.name,
    sourceBase || "",
    ...markerAliases(manifest),
  ]);
  return {
    workspaceId: record.workspaceId,
    id: workspace.id,
    name: workspace.name,
    displayName: workspace.name,
    contentId,
    contentIds: ids,
    deployedFolder,
    deployedFolders,
    sourceFolder,
    sourceFolders: unique([sourceFolder, sourceBase || ""]),
    aliases,
    manifest,
    workspace,
    markerAliases: markerAliases(manifest),
  };
}

function extensionManifest(extension: RuntimeExtensionInput): RuntimeManifestFile[] {
  const entries: RuntimeManifestFile[] = [];
  if (extension.manifest) entries.push(...normalizeManifest(extension.manifest));
  if (extension.files) entries.push(...normalizeManifest(extension.files));
  return normalizeManifest(entries);
}

function extensionDeployedFolders(extension: RuntimeExtensionInput): string[] {
  const explicit = [
    extension.deployedFolder,
    extension.deployedId,
    ...(extension.deployedFolders || []),
  ]
    .map(value => basenameIdentity(value))
    .filter((value): value is string => Boolean(value));
  if (explicit.length) return unique(explicit);
  const fallback = basenameIdentity(extension.id);
  return fallback ? [fallback] : [];
}

function extensionSourceFolders(extension: RuntimeExtensionInput): string[] {
  const values = [
    extension.sourceFolder,
    ...(extension.sourceFolders || []),
    extension.workspace?.sourceFolder,
  ]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .flatMap(value => [value, basenameIdentity(value) || ""]);
  return unique(values);
}

function extensionContentIds(extension: RuntimeExtensionInput): string[] {
  const parsed = contentIdFromManifest(extensionManifest(extension), "");
  return unique([
    extension.contentId || "",
    ...(extension.contentIds || []),
    extension.workspace?.contentId || "",
    parsed,
  ]);
}

function boundedInstalledManifest(extension: RuntimeExtensionInput): RuntimeManifestFile[] {
  const result: RuntimeManifestFile[] = [];
  let totalBytes = 0;
  for (const file of extensionManifest(extension)) {
    if (result.length >= MAX_INVENTORY_FILES_PER_EXTENSION) break;
    const bytes = Buffer.byteLength(file.text, "utf8");
    if (bytes > MAX_INVENTORY_FILE_TEXT_BYTES || totalBytes + bytes > MAX_INVENTORY_TEXT_BYTES) continue;
    result.push({ path: file.path, text: file.text });
    totalBytes += bytes;
  }
  return result;
}

function installedFolderMatches(extension: RuntimeExtensionInput, folder: string): boolean {
  const target = normalized(folder);
  return Boolean(target) && extensionDeployedFolders(extension).some(value => normalized(value) === target);
}

function installedSourceMatches(extension: RuntimeExtensionInput, sourceFolder: string): boolean {
  const target = normalized(basenameIdentity(sourceFolder));
  return Boolean(target) && extensionSourceFolders(extension).some(value => normalized(basenameIdentity(value)) === target);
}

function installedContentMatches(extension: RuntimeExtensionInput, contentId: string): boolean {
  const target = normalized(contentId);
  return Boolean(target) && extensionContentIds(extension).some(value => normalized(value) === target);
}

function selectCorrelatedInstalledExtension(
  active: RuntimeExtensionInput & { markerAliases: string[] },
  inventory: RuntimeInstalledExtensionInventory,
  deployInfo: RuntimeDebuggerDeployInfo | null,
): number | undefined {
  const deployedIdentities = unique([
    deployedFolderFromInfo(deployInfo) || "",
    ...(active.deployedFolders || []),
    active.deployedFolder || "",
  ]);
  const explicitDeployFolder = deployedFolderFromInfo(deployInfo);
  const explicitDeployMatches = explicitDeployFolder
    ? inventory.extensions.map((extension, index) => installedFolderMatches(extension, explicitDeployFolder) ? index : -1).filter(index => index >= 0)
    : [];
  const deployMatches = deployedIdentities.length
    ? inventory.extensions.map((extension, index) => deployedIdentities.some(folder => installedFolderMatches(extension, folder)) ? index : -1).filter(index => index >= 0)
    : [];
  const sourceFolder = basenameIdentity(active.sourceFolder);
  const sourceMatches = sourceFolder
    ? inventory.extensions.map((extension, index) => installedSourceMatches(extension, sourceFolder) ? index : -1).filter(index => index >= 0)
    : [];
  const contentIds = unique([active.contentId || "", ...(active.contentIds || [])]);
  const contentMatches = inventory.extensions
    .map((extension, index) => contentIds.some(contentId => installedContentMatches(extension, contentId)) ? index : -1)
    .filter(index => index >= 0);

  // A successful deploy destination is the strongest exact execution
  // correlation.  It may disambiguate duplicate content IDs, but it cannot
  // override a conflicting exact source-folder candidate.
  if (explicitDeployMatches.length === 1
    && (sourceMatches.length === 0 || sourceMatches.every(index => index === explicitDeployMatches[0]))) {
    return explicitDeployMatches[0];
  }

  // Correlation is a set intersection/union decision, never a first-match
  // decision.  A single exact candidate is safe even when the bounded
  // inventory is incomplete; any multiple or conflicting exact candidates
  // remain ambiguous and are deliberately left in the other-owner set.
  const exactEvidence = [deployMatches, sourceMatches, contentMatches].filter(matches => matches.length > 0);
  const exactOwners = new Set(exactEvidence.flat());
  return exactEvidence.length > 0 && exactOwners.size === 1 ? [...exactOwners][0] : undefined;
}

function mergeInstalledExtension(
  active: RuntimeExtensionInput & { markerAliases: string[] },
  installed: RuntimeExtensionInput,
  deployInfo: RuntimeDebuggerDeployInfo | null,
): RuntimeExtensionInput & { markerAliases: string[] } {
  const currentManifest = extensionManifest(active);
  const installedManifest = boundedInstalledManifest(installed);
  // Put installed files first and authored workspace files last.  The map in
  // normalizeManifest therefore gives current source text precedence for a
  // duplicate path while retaining installed-only paths.
  const manifest = normalizeManifest([...installedManifest, ...currentManifest]);
  const installedFolders = extensionDeployedFolders(installed);
  const explicitDeployFolder = deployedFolderFromInfo(deployInfo);
  const deployedFolder = explicitDeployFolder || installedFolders[0] || active.deployedFolder;
  return {
    ...active,
    ...(deployedFolder ? { deployedFolder } : {}),
    contentIds: unique([...(active.contentIds || []), ...extensionContentIds(installed)]),
    deployedFolders: unique([deployedFolder || "", ...(active.deployedFolders || []), ...installedFolders]),
    sourceFolders: unique([...(active.sourceFolders || []), ...extensionSourceFolders(installed)]),
    manifest,
    ...(installed.mdScripts?.length ? { mdScripts: [...(active.mdScripts || []), ...installed.mdScripts] } : {}),
    ...(installed.aiScripts?.length ? { aiScripts: [...(active.aiScripts || []), ...installed.aiScripts] } : {}),
    ...(installed.luaFiles?.length ? { luaFiles: [...(active.luaFiles || []), ...installed.luaFiles] } : {}),
    markerAliases: unique([...active.markerAliases, ...markerAliases(manifest)]),
  };
}

function isInternalKey(key: string): boolean {
  return key === INTERNAL_DEPLOY_KEY || key.startsWith(INTERNAL_EXPECTED_PREFIX);
}

function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function deploymentToken(workspaceId: string, info: RuntimeDebuggerDeployInfo): string {
  return `runtime-deploy:${hashToken(JSON.stringify({
    workspaceId,
    deployedAt: info.deployedAt,
    workspaceHash: info.workspaceHash,
    deployedFingerprint: info.deployedFingerprint || "",
    destinationPath: info.deployedPath || info.stagingPath || "",
  }))}`;
}

function incidentFingerprint(candidate: RuntimeAnalyzedCandidate): string {
  const source = candidate.source || { stackFrames: [] };
  return [
    candidate.kind,
    candidate.engineSignature || "",
    normalized(source.file),
    source.line || "",
    normalized(source.mdScript),
    normalized(source.aiScript),
    normalized(source.luaModule),
    candidate.attribution?.disposition || "unknown",
    candidate.attribution?.matchedWorkspaceId || "",
    String(candidate.lines?.[0] || candidate.raw || "")
      .toLowerCase()
      .replace(/\b\d+(?:\.\d+)?\b/g, "#")
      .replace(/\s+/g, " ")
      .trim(),
  ].join("|");
}

function incidentKeyFor(candidate: RuntimeAnalyzedCandidate, cache: Map<string, string>): string {
  const fingerprint = incidentFingerprint(candidate);
  const prior = cache.get(fingerprint);
  if (prior) return prior;
  const key = deduplicateRuntimeIncidents([candidate], 1)[0]?.key || `incident-${hashToken(fingerprint).slice(0, 16)}`;
  cache.set(fingerprint, key);
  return key;
}

function candidatePosition(candidate: RuntimeCandidateIncident, lines: readonly RuntimeDebugLine[], segmentId: string) {
  const first = lines.find(line => line.lineNumber === candidate.startLine) || lines[0];
  const last = lines.find(line => line.lineNumber === candidate.endLine) || first;
  if (!first || !last) return undefined;
  return {
    segmentId,
    lineNumber: first.lineNumber,
    startByte: first.startByte,
    endByte: last.endByte,
  };
}

function positiveExecutionEvidence(candidate: RuntimeAnalyzedCandidate, active: RuntimeExtensionInput & { markerAliases: string[] }): boolean {
  if (candidate.attribution?.disposition !== "confirmed_active") return false;
  if (candidate.isEngineFailure) return false;
  const text = String(candidate.raw || "").toLowerCase();
  if (candidate.kind !== "authored_diagnostic") return false;
  if (!/\[=error=\]/i.test(text)) return false;
  if (/(?:file\s*i\/?o|fileio|signature|failed to verify|loading extension|load(?:ed|ing)? file|could not open file)/i.test(text)) return false;
  const exactIds = [...(active.contentIds || []), ...(active.deployedFolders || [])]
    .map(normalized)
    .filter(value => value.length >= 3);
  if (exactIds.some(id => new RegExp(`(^|[^a-z0-9_.-])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9_.-])`, "i").test(text))) return true;
  return active.markerAliases.some(alias => text.includes(`[${alias.toLowerCase()}]`));
}

function isGovernedAuthoredMarker(candidate: RuntimeCandidateIncident): boolean {
  const raw = String(candidate.raw || "");
  return !candidate.engineSignature
    && !/(?:file\s*i\/?o|fileio|signature|failed to verify|loading extension|load(?:ed|ing)? file|could not open file)/i.test(raw)
    && /\[=ERROR=\][^\r\n]*(?:\[[A-Za-z][A-Za-z0-9_-]{2,}\]\s*){2,}/i.test(raw);
}

function incidentInputs(
  candidates: readonly RuntimeAnalyzedCandidate[],
  lines: readonly RuntimeDebugLine[],
  segmentId: string,
  active: RuntimeExtensionInput & { markerAliases: string[] },
  keyCache: Map<string, string>,
): RuntimeDebugIncidentInput[] {
  return candidates.map(candidate => {
    const position = candidatePosition(candidate, lines, segmentId);
    const key = incidentKeyFor(candidate, keyCache);
    const severity = candidate.isEngineFailure ? "error" : candidate.kind === "authored_diagnostic" ? "info" : "warning";
    const attrs: Record<string, RuntimeValue> = {
      [INTERNAL_ATTR]: "runtime",
      runtimeKind: candidate.kind,
      runtimeClassification: candidate.kind,
      runtimeSeverity: severity,
      isEngineFailure: candidate.isEngineFailure,
      recognized: candidate.recognized,
      explicitUnknown: candidate.explicitUnknown,
      positiveExecution: positiveExecutionEvidence(candidate, active),
      sample: boundedText(candidate.raw, 1024),
      firstTimestamp: candidate.timestamp || null,
      lastTimestamp: candidate.lastTimestamp || candidate.timestamp || null,
      attribution: safeJson(candidate.attribution, 3600) || "{}",
      mapping: safeJson(candidate.mapping, 3600) || "{}",
      explanation: safeJson(candidate.explanation, 3600) || "{}",
    };
    return {
      key,
      summary: candidate.explanation.summary,
      classification: candidate.kind,
      severity,
      reason: candidate.attribution.reason,
      evidence: candidate.evidence.map(item => `${item.label}: ${item.value}`).slice(0, MAX_RESPONSE_EVIDENCE),
      attributes: attrs,
      ...(position ? { position } : {}),
    };
  });
}

function analyzeLines(
  lines: readonly RuntimeDebugLine[],
  ownership: RuntimeOwnershipIndex,
  inventoryComplete: boolean,
): RuntimeAnalyzedCandidate[] {
  if (!lines.length) return [];
  const text = lines.map(line => line.text).join("\n");
  const parsed = parseRuntimeCandidates(text, { startLine: lines[0].lineNumber });
  return parsed.map(candidate => {
    const normalizedCandidate: RuntimeCandidateIncident = isGovernedAuthoredMarker(candidate)
      ? { ...candidate, kind: "authored_diagnostic", recognized: true, explicitUnknown: false, isEngineFailure: false }
      : candidate;
    const initialAttribution = attributeRuntimeCandidate(ownership, normalizedCandidate);
    const attribution: RuntimeAttribution = !inventoryComplete
      && !candidate.source.extensionFolder
      && Boolean(candidate.source.file)
      && initialAttribution.disposition === "confirmed_active"
      ? {
          disposition: "unknown",
          confidence: 0,
          reason: "Installed-extension inventory is incomplete; bare relative-path ownership cannot be confirmed active.",
          evidence: initialAttribution.evidence,
        }
      : initialAttribution;
    const mapping = mapRuntimeCandidateToSource(ownership, { ...normalizedCandidate, attribution });
    return {
      ...normalizedCandidate,
      attribution,
      mapping,
      explanation: explainRuntimeCandidate(normalizedCandidate, attribution),
    };
  });
}

function compactAttribution(value: unknown): RuntimeAttribution {
  if (!value || typeof value !== "object") return { disposition: "unknown", confidence: 0, reason: "Attribution envelope unavailable.", evidence: [] };
  const raw = value as Partial<RuntimeAttribution>;
  const disposition = isRuntimeDisposition(raw.disposition) ? raw.disposition : "unknown";
  return {
    disposition,
    confidence: typeof raw.confidence === "number" && Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, raw.confidence)) : 0,
    reason: redactedText(raw.reason, 4096, "Attribution reason unavailable."),
    evidence: Array.isArray(raw.evidence) ? raw.evidence.slice(0, MAX_RESPONSE_EVIDENCE).map(item => ({
      ownerId: item.ownerId,
      label: redactedText(item.label, 256),
      value: redactedText(item.value, 512),
      strength: item.strength === "exact" || item.strength === "alias" || item.strength === "display_name" ? item.strength : "exact",
      rank: typeof item.rank === "number" && Number.isFinite(item.rank) ? item.rank : 0,
    })) : [],
    ...(typeof raw.matchedOwnerId === "string" ? { matchedOwnerId: raw.matchedOwnerId } : {}),
    ...(typeof raw.matchedWorkspaceId === "string" ? { matchedWorkspaceId: raw.matchedWorkspaceId } : {}),
  };
}

function compactMapping(value: unknown): RuntimeSourceMapping {
  if (isRuntimeMapping(value)) {
    const raw = value as RuntimeSourceMapping;
    return {
      kind: raw.kind,
      ...(raw.file ? { file: boundedPath(raw.file) } : {}),
      ...(raw.line ? { line: Math.max(1, Math.floor(raw.line)) } : {}),
      ...(raw.offset !== undefined ? { offset: Math.max(0, Math.floor(raw.offset)) } : {}),
      ...(raw.nodeId ? { nodeId: redactedText(raw.nodeId, 256) } : {}),
      ...(raw.nodeLabel ? { nodeLabel: redactedText(raw.nodeLabel, 512) } : {}),
      ...(raw.xmlTag ? { xmlTag: redactedText(raw.xmlTag, 256) } : {}),
      ...(raw.semanticPath ? { semanticPath: redactedText(raw.semanticPath, 512) } : {}),
      reason: redactedText(raw.reason, 4096, "Source mapping unavailable."),
    };
  }
  return { kind: "unmapped", reason: "Source mapping envelope unavailable." };
}

function compactExplanation(value: unknown, fallback: string): RuntimeExplanation {
  if (isRuntimeExplanation(value)) {
    const raw = value as RuntimeExplanation;
    return {
      cause: redactedText(raw.cause, 4096),
      impact: redactedText(raw.impact, 4096),
      nextAction: redactedText(raw.nextAction, 4096),
      evidenceLabel: redactedText(raw.evidenceLabel, 512),
      ...(raw.ruleLabel ? { ruleLabel: redactedText(raw.ruleLabel, 512) } : {}),
      summary: redactedText(raw.summary, 4096),
    };
  }
  return {
    cause: redactedText(fallback),
    impact: "The deterministic explanation envelope was unavailable.",
    nextAction: "Inspect the retained evidence and current session state.",
    evidenceLabel: "runtime evidence",
    summary: redactedText(fallback),
  };
}

function reconstructIncident(raw: RuntimeDebugIncident): ReconstructedIncident | undefined {
  const attrs = raw.attributes || {};
  if (attrs[INTERNAL_ATTR] !== "runtime") return undefined;
  const attribution = compactAttribution(parseJson(attrs.attribution));
  const mapping = compactMapping(parseJson(attrs.mapping));
  const explanation = compactExplanation(parseJson(attrs.explanation), raw.summary || "Runtime evidence was retained.");
  const classification = boundedText(
    typeof attrs.runtimeClassification === "string" && attrs.runtimeClassification
      ? attrs.runtimeClassification
      : typeof attrs.runtimeKind === "string" && attrs.runtimeKind
        ? attrs.runtimeKind
        : raw.classification,
    128,
    "unknown",
  );
  const isEngineFailure = safeBoolean(attrs.isEngineFailure) ?? (raw.severity === "error" && raw.classification !== "authored_diagnostic" && raw.classification !== "file_io");
  const severity = attrs.runtimeSeverity === "error" || attrs.runtimeSeverity === "warning" || attrs.runtimeSeverity === "info"
    ? attrs.runtimeSeverity
    : isEngineFailure ? "error" : classification === "authored_diagnostic" ? "info" : "warning";
  const recognized = safeBoolean(attrs.recognized) ?? classification !== "unknown";
  const explicitUnknown = safeBoolean(attrs.explicitUnknown) ?? classification === "unknown";
  const sample = redactedText(attrs.sample, 2048, raw.summary || "runtime evidence");
  const count = Math.max(1, boundedCount(raw.occurrenceCount));
  return {
    key: redactedText(raw.key, 256),
    count,
    firstLine: raw.first.lineNumber,
    lastLine: raw.last.lineNumber,
    ...(typeof attrs.firstTimestamp === "string" && attrs.firstTimestamp ? { firstTimestamp: attrs.firstTimestamp } : {}),
    ...(typeof attrs.lastTimestamp === "string" && attrs.lastTimestamp ? { lastTimestamp: attrs.lastTimestamp } : {}),
    candidateIds: [],
    omittedCandidateIds: count,
    attribution,
    mapping,
    explanation,
    evidence: raw.evidence.slice(0, MAX_RESPONSE_EVIDENCE).map(value => redactedText(value, 1024)),
    samples: [{ firstLine: raw.first.lineNumber, lastLine: raw.last.lineNumber, text: sample }],
    segmentId: raw.segmentId,
    recognized,
    explicitUnknown,
    positiveExecution: safeBoolean(attrs.positiveExecution) === true,
    classification,
    severity,
    isEngineFailure,
  };
}

function redactedExpectedSteps(results: readonly RuntimeExpectedStepResult[]): RuntimeExpectedStepResult[] {
  return results.map(result => ({
    ...result,
    label: redactedText(result.label, MAX_RESPONSE_TEXT),
    evidence: result.evidence.map(value => redactedText(value, MAX_RESPONSE_TEXT)),
  }));
}

function runtimeIncidentPriority(incident: Pick<ReconstructedIncident, "attribution" | "isEngineFailure" | "classification" | "severity">): number {
  if (incident.isEngineFailure && incident.attribution.disposition === "confirmed_active") return 400;
  if (incident.isEngineFailure && incident.attribution.disposition === "ambiguous") return 350;
  if (incident.isEngineFailure && incident.attribution.disposition === "unknown") return 300;
  if (incident.isEngineFailure && incident.attribution.disposition === "excluded_other_mod") return 50;
  if (incident.classification === "authored_diagnostic" || incident.severity === "info") return 200;
  if (incident.attribution.disposition === "confirmed_active") return 150;
  return 100;
}

function compareRuntimeIncidents(left: ReconstructedIncident, right: ReconstructedIncident): number {
  return runtimeIncidentPriority(right) - runtimeIncidentPriority(left)
    || left.firstLine - right.firstLine
    || left.lastLine - right.lastLine
    || left.key.localeCompare(right.key);
}

function analyzerPolicyMarker(raw: RuntimeDebugIncident): boolean {
  return raw.key === INTERNAL_ANALYZER_POLICY_KEY
    && raw.attributes?.[INTERNAL_ATTR] === INTERNAL_ANALYZER_POLICY
    && raw.attributes.policyVersion === RUNTIME_DEBUGGER_ANALYZER_POLICY_VERSION;
}

interface AnalyzerPolicyBoundary {
  floor: number;
  dropped: RuntimeDebugDroppedCounts;
}

const DROPPED_COUNT_KEYS: Array<keyof RuntimeDebugDroppedCounts> = [
  "segments",
  "incidents",
  "incidentBytes",
  "partialLineBytes",
  "truncatedLines",
  "evidenceBytes",
  "baselineTokens",
];

function analyzerPolicyBoundary(snapshot: RuntimeDebugSessionSnapshot): AnalyzerPolicyBoundary | undefined {
  const markers = snapshot.incidents.filter(analyzerPolicyMarker);
  if (!markers.length) return undefined;
  const markerSegmentIds = new Set(markers.map(incident => incident.segmentId));
  const floor = snapshot.segments.findIndex(segment => markerSegmentIds.has(segment.id));
  if (floor < 0) return undefined;
  const marker = markers.find(candidate => candidate.segmentId === snapshot.segments[floor].id) || markers[0];
  const dropped = Object.fromEntries(DROPPED_COUNT_KEYS.map(key => {
    const value = marker.attributes[`policyBaselineDropped${key[0].toUpperCase()}${key.slice(1)}`];
    return [key, typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0];
  })) as unknown as RuntimeDebugDroppedCounts;
  return { floor, dropped };
}

function hasAnalyzerPolicy(snapshot: RuntimeDebugSessionSnapshot): boolean {
  return analyzerPolicyBoundary(snapshot) !== undefined;
}

function postPolicyDropped(snapshot: RuntimeDebugSessionSnapshot, boundary: AnalyzerPolicyBoundary | undefined): RuntimeDebugDroppedCounts {
  if (!boundary) return { ...snapshot.dropped };
  return Object.fromEntries(DROPPED_COUNT_KEYS.map(key => [key, Math.max(0, snapshot.dropped[key] - boundary.dropped[key])])) as unknown as RuntimeDebugDroppedCounts;
}

function reconstructExpected(raw: RuntimeDebugIncident): ReconstructedExpected | undefined {
  if (raw.attributes?.[INTERNAL_ATTR] !== INTERNAL_EXPECTED) return undefined;
  const stepId = typeof raw.attributes.stepId === "string" ? raw.attributes.stepId : "";
  if (!stepId) return undefined;
  return {
    stepId,
    segmentId: raw.segmentId,
    evidence: raw.evidence.slice(0, MAX_RESPONSE_EVIDENCE),
  };
}

function reconstructDeploy(raw: RuntimeDebugIncident): PersistedDeployEnvelope | undefined {
  if (raw.key !== INTERNAL_DEPLOY_KEY || raw.attributes?.[INTERNAL_ATTR] !== INTERNAL_DEPLOY) return undefined;
  const attrs = raw.attributes || {};
  const modId = typeof attrs.modId === "string" ? attrs.modId : "";
  const workspaceName = typeof attrs.workspaceName === "string" ? attrs.workspaceName : "";
  const workspaceHash = typeof attrs.workspaceHash === "string" ? attrs.workspaceHash : "";
  const deployedAt = typeof attrs.deployedAt === "string" ? attrs.deployedAt : "";
  const tokenHash = typeof attrs.tokenHash === "string" ? attrs.tokenHash : "";
  const deployedFingerprint = isSha256Fingerprint(attrs.deployedFingerprint) ? attrs.deployedFingerprint.toLowerCase() : undefined;
  if (!modId || !workspaceHash || !deployedAt || !/^[0-9a-f]{64}$/i.test(tokenHash)) return undefined;
  return {
    tokenHash,
    info: {
      workspaceId: typeof attrs.workspaceId === "string" ? attrs.workspaceId : undefined,
      modId: boundedText(modId, 256),
      workspaceName: boundedText(workspaceName, 512),
      workspaceHash: boundedText(workspaceHash, 256),
      deployedAt: boundedText(deployedAt, 128),
      ...(typeof attrs.stagingPath === "string" && attrs.stagingPath ? { stagingPath: boundedText(attrs.stagingPath, MAX_RESPONSE_PATH) } : {}),
      ...(typeof attrs.deployedPath === "string" && attrs.deployedPath ? { deployedPath: boundedText(attrs.deployedPath, MAX_RESPONSE_PATH) } : {}),
      ...(deployedFingerprint ? { deployedFingerprint } : {}),
    },
  };
}

function currentSegment(snapshot: RuntimeDebugSessionSnapshot): RuntimeDebugSessionSnapshot["segments"][number] | undefined {
  return snapshot.segments.find(segment => segment.id === snapshot.currentSegmentId) || snapshot.segments[snapshot.segments.length - 1];
}

function hasSuccessfulBaseline(snapshot: RuntimeDebugSessionSnapshot): boolean {
  const segment = currentSegment(snapshot);
  if (!segment || snapshot.baselineTokens.length === 0) return false;
  const latest = snapshot.baselineTokens[snapshot.baselineTokens.length - 1];
  if (latest.segmentId === segment.id) return true;
  const baselineTime = Date.parse(latest.recordedAt);
  const segmentTime = Date.parse(segment.startedAt);
  return Number.isFinite(baselineTime) && Number.isFinite(segmentTime) && segmentTime >= baselineTime;
}

function coverageFor(incidents: readonly ReconstructedIncident[], dropped: number): RuntimeDebuggerCoverage {
  const dispositionCounts = { confirmed_active: 0, ambiguous: 0, excluded_other_mod: 0, unknown: 0 };
  let candidates = 0;
  let recognized = 0;
  let explicitUnknown = 0;
  for (const incident of incidents) {
    const count = Math.max(1, boundedCount(incident.count));
    candidates += count;
    if (incident.recognized) recognized += count;
    if (incident.explicitUnknown) explicitUnknown += count;
    dispositionCounts[incident.attribution.disposition] += count;
  }
  candidates = Math.min(1_000_000_000, candidates);
  recognized = Math.min(candidates, recognized);
  explicitUnknown = Math.min(candidates, explicitUnknown);
  const union = Math.min(candidates, recognized + explicitUnknown);
  const ratio = candidates > 0 ? union / candidates : 1;
  return {
    target: RUNTIME_DEBUGGER_COVERAGE_TARGET,
    met: candidates > 0 && ratio >= RUNTIME_DEBUGGER_COVERAGE_TARGET && dropped === 0,
    candidates,
    recognized,
    explicitUnknown,
    silentlyDropped: Math.min(1_000_000_000, Math.max(0, dropped)),
    recognizedOrExplicitUnknown: union,
    recognizedOrExplicitUnknownRatio: ratio,
    dispositionCounts,
    dispositionSum: Object.values(dispositionCounts).reduce((sum, value) => sum + value, 0),
  };
}

function verdictFor(input: {
  hasLog: boolean;
  currentSession: boolean;
  coverage: RuntimeDebuggerCoverage;
  currentIncidents: readonly ReconstructedIncident[];
  expected: readonly RuntimeExpectedStepResult[];
  health: RuntimeDebugSessionSnapshot["health"] | "unavailable";
  positiveExecutionEvidence: boolean;
}): RuntimeDebuggerVerdict {
  const activeFailures = input.currentIncidents.filter(incident => incident.attribution.disposition === "confirmed_active" && incident.isEngineFailure);
  const unresolvedFailures = input.currentIncidents.filter(incident => incident.isEngineFailure && (incident.attribution.disposition === "unknown" || incident.attribution.disposition === "ambiguous"));
  const expectedBlocker = input.expected.some(step => step.truth !== "observed");
  const unresolvedBlocker = unresolvedFailures.length > 0 || expectedBlocker || input.health !== "ready" || !input.coverage.met;
  if (!input.hasLog) {
    return {
      state: "no_log",
      errorCount: 0,
      detail: "No readable X4 debuglog is available; current runtime state is unavailable.",
      currentSession: false,
      positiveExecutionEvidence: false,
      coverageMet: false,
      unresolvedBlocker: true,
    };
  }
  if (!input.currentSession) {
    return {
      state: "stale",
      errorCount: 0,
      detail: "Historical or pre-baseline runtime evidence is retained, but it cannot establish the current successful-deploy session.",
      currentSession: false,
      positiveExecutionEvidence: false,
      coverageMet: false,
      unresolvedBlocker: true,
    };
  }
  if (activeFailures.length > 0) {
    return {
      state: "loaded_with_errors",
      errorCount: activeFailures.reduce((sum, incident) => sum + Math.max(1, incident.count), 0),
      detail: `Current-session active engine failures are attributed to this workspace (${activeFailures.reduce((sum, incident) => sum + Math.max(1, incident.count), 0)} occurrence(s)).`,
      currentSession: true,
      positiveExecutionEvidence: input.positiveExecutionEvidence,
      coverageMet: input.coverage.met,
      unresolvedBlocker,
    };
  }
  if (!input.coverage.candidates || !input.positiveExecutionEvidence || unresolvedBlocker) {
    const reason = !input.coverage.candidates
      ? "No current-session runtime candidates were observed; this is not a clean proof."
      : !input.positiveExecutionEvidence
        ? "No positive current active execution evidence was observed; this is not a clean proof."
        : "Current-session coverage or unresolved evidence prevents a clean verdict.";
    return {
      state: "not_seen",
      errorCount: 0,
      detail: reason,
      currentSession: true,
      positiveExecutionEvidence: input.positiveExecutionEvidence,
      coverageMet: input.coverage.met,
      unresolvedBlocker,
    };
  }
  return {
    state: "loaded_clean",
    errorCount: 0,
    detail: "Positive current active execution evidence is present; no attributed failures observed. This is not proof of semantic correctness.",
    currentSession: true,
    positiveExecutionEvidence: true,
    coverageMet: true,
    unresolvedBlocker: false,
  };
}

function legacyStatusFor(verdict: RuntimeDebuggerVerdict): RuntimeDebuggerAdapterResult["status"] {
  if (verdict.state === "no_log") return "no_log";
  if (verdict.state === "stale") return "stale";
  if (verdict.state === "loaded_with_errors") return "errors";
  if (verdict.state === "loaded_clean") return "clean";
  return "warnings";
}

export function expectedInputFromLegacy(values: readonly string[]): RuntimeExpectedStep[] {
  return values.map((value, index) => {
    const label = String(value || "").trim();
    const bare = label.replace(/^(cue|marker):/i, "").trim();
    return {
      id: `legacy-${index}-${hashToken(label).slice(0, 12)}`,
      label,
      markers: bare ? [bare] : [],
      ...(label.toLowerCase().startsWith("cue:") ? { cue: bare } : {}),
    };
  }).filter(step => step.label);
}

function defaultInventory(): RuntimeInstalledExtensionInventory {
  const scannedAt = new Date().toISOString();
  try {
    const resolved = resolveXsdConfig();
    const gameRoot = resolved.x4GamePath;
    if (!gameRoot) return { complete: false, scannedAt, extensions: [], error: "X4 game root is not configured." };
    const extRoot = path.join(gameRoot, "extensions");
    if (!fs.existsSync(extRoot) || !fs.statSync(extRoot).isDirectory()) {
      return { complete: false, root: extRoot, scannedAt, extensions: [], error: "X4 extensions root is unavailable." };
    }
    const byFolder = new Map<string, RuntimeExtensionInput>();
    let complete = true;
    let totalFiles = 0;
    let textBytes = 0;
    const add = (folder: string, filePath: string, text: string): void => {
      if (!folder || !filePath || totalFiles >= MAX_INVENTORY_TOTAL_FILES) { complete = false; return; }
      const key = folder.toLowerCase();
      let owner = byFolder.get(key);
      if (!owner) {
        owner = {
          workspaceId: `installed-${folder}`,
          id: folder,
          name: folder,
          displayName: folder,
          contentId: folder,
          deployedFolder: folder,
          manifest: [],
        };
        byFolder.set(key, owner);
      }
      const manifest = (owner.manifest || []) as RuntimeManifestFile[];
      const existing = manifest.find(file => normalized(file.path) === normalized(filePath));
      if (existing) {
        if (!existing.text && text) existing.text = text;
      } else {
        manifest.push({ path: filePath.replace(/\\/g, "/"), text });
        totalFiles += 1;
      }
      owner.manifest = manifest;
    };
    const readText = (filePath: string): string => {
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size > MAX_INVENTORY_FILE_TEXT_BYTES || textBytes + stat.size > MAX_INVENTORY_TEXT_BYTES) return "";
        const text = fs.readFileSync(filePath, "utf8");
        textBytes += Buffer.byteLength(text, "utf8");
        return text;
      } catch {
        complete = false;
        return "";
      }
    };
    const extensionEntries = fs.readdirSync(extRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).slice(0, MAX_INVENTORY_EXTENSIONS);
    if (extensionEntries.length >= MAX_INVENTORY_EXTENSIONS) complete = false;
    for (const extension of extensionEntries) {
      const folder = extension.name;
      let filesForExtension = 0;
      const walk = (directory: string, depth: number): void => {
        if (depth > 8 || filesForExtension >= MAX_INVENTORY_FILES_PER_EXTENSION || totalFiles >= MAX_INVENTORY_TOTAL_FILES) { complete = false; return; }
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { complete = false; return; }
        for (const entry of entries) {
          if (filesForExtension >= MAX_INVENTORY_FILES_PER_EXTENSION || totalFiles >= MAX_INVENTORY_TOTAL_FILES) { complete = false; return; }
          const full = path.join(directory, entry.name);
          if (entry.isDirectory()) walk(full, depth + 1);
          else if (entry.isFile()) {
            const relative = path.relative(path.join(extRoot, folder), full).replace(/\\/g, "/");
            add(folder, relative, /(?:content\.xml|\.xml$|\.lua$|\.xpl$)/i.test(relative) ? readText(full) : "");
            filesForExtension += 1;
          }
        }
      };
      walk(path.join(extRoot, folder), 0);
    }
    for (const archive of findCatDatArchives([gameRoot], true)) {
      const relativeArchive = path.relative(extRoot, archive.catPath).replace(/\\/g, "/");
      const parts = relativeArchive.split("/");
      if (parts.length < 2 || parts[0] === ".." || parts[0] === ".") continue;
      const folder = parts[0];
      let entries;
      try { entries = parseCat(archive.catPath); } catch { complete = false; continue; }
      for (const entry of entries) {
        if (totalFiles >= MAX_INVENTORY_TOTAL_FILES) { complete = false; break; }
        const name = entry.name.replace(/\\/g, "/").replace(/^\/+/, "");
        const text = /(?:content\.xml|\.xml$|\.lua$|\.xpl$)/i.test(name) && entry.size <= MAX_INVENTORY_FILE_TEXT_BYTES
          ? (() => { try { return readTextFromArchive(archive.datPath, entry, textBytes, (next) => { textBytes = next; }); } catch { complete = false; return ""; } })()
          : "";
        add(folder, name, text);
      }
    }
    for (const owner of byFolder.values()) {
      const manifest = owner.manifest as RuntimeManifestFile[];
      const content = manifest.find(file => normalized(file.path) === "content.xml")?.text || "";
      const meta = content.match(/<content\b[^>]*\bid\s*=\s*["']([^"']+)["']/i)?.[1];
      const name = content.match(/<content\b[^>]*\bname\s*=\s*["']([^"']+)["']/i)?.[1];
      if (meta) owner.contentId = meta;
      if (name) { owner.name = name; owner.displayName = name; }
    }
    return { complete, root: extRoot, scannedAt, extensions: [...byFolder.values()] };
  } catch (error) {
    return { complete: false, scannedAt, extensions: [], error: boundedText(error instanceof Error ? error.message : String(error), 512) };
  }
}

function readTextFromArchive(datPath: string, entry: CatEntry, currentBytes: number, update: (bytes: number) => void): string {
  if (currentBytes + entry.size > MAX_INVENTORY_TEXT_BYTES) return "";
  const text = readEntryText(datPath, entry);
  update(currentBytes + Buffer.byteLength(text, "utf8"));
  return text;
}

export class RuntimeDebuggerAdapter {
  readonly store: RuntimeDebugSessionStore;
  private readonly now: () => number;
  private readonly preferredLogPath?: string;
  private readonly logCandidates: () => readonly string[];
  private readonly profileForLog: (logPath: string) => string;
  private readonly installedInventory: () => RuntimeInstalledExtensionInventory;
  private readonly inventoryTtlMs: number;
  private inventoryCache?: InventoryCache;

  constructor(options: RuntimeDebuggerAdapterOptions = {}) {
    this.now = options.now || (() => Date.now());
    this.store = options.store || new RuntimeDebugSessionStore({
      root: options.root || dataPath(RUNTIME_DEBUG_SESSION_DIR),
      forbiddenRoots: options.forbiddenRoots || [],
    });
    this.preferredLogPath = options.preferredLogPath;
    this.logCandidates = options.logCandidates || (() => []);
    this.profileForLog = options.profileForLog || deriveProfileId;
    this.installedInventory = options.installedInventory || defaultInventory;
    this.inventoryTtlMs = Math.max(1_000, Math.floor(options.inventoryTtlMs ?? DEFAULT_INVENTORY_TTL_MS));
  }

  private readableLog(candidate: unknown): SelectedLog | null {
    if (typeof candidate !== "string" || !candidate.trim() || candidate.includes("\0")) return null;
    try {
      const logPath = path.resolve(candidate);
      const fileStat = fs.statSync(logPath);
      if (!fileStat.isFile()) return null;
      const stat: RuntimeDebugFileStat = {
        size: fileStat.size,
        dev: typeof fileStat.dev === "number" ? fileStat.dev : undefined,
        ino: typeof fileStat.ino === "number" ? fileStat.ino : undefined,
        mtimeMs: fileStat.mtimeMs,
      };
      return { logPath, profileId: boundedText(this.profileForLog(logPath), 512), stat };
    } catch {
      // Discovery is best effort. Missing, unreadable, invalid, and non-file
      // paths are ignored instead of turning log selection into a server error.
      return null;
    }
  }

  private selectLog(): SelectedLog | null {
    const preferred = this.readableLog(this.preferredLogPath);
    if (preferred) return preferred;
    let freshest: SelectedLog | null = null;
    for (const candidate of this.logCandidates()) {
      const readable = this.readableLog(candidate);
      if (readable && (!freshest || readable.stat.mtimeMs > freshest.stat.mtimeMs)) freshest = readable;
    }
    return freshest;
  }

  private getInventory(): RuntimeInstalledExtensionInventory {
    const now = this.now();
    if (this.inventoryCache && this.inventoryCache.expiresAt > now) return this.inventoryCache.value;
    let value: RuntimeInstalledExtensionInventory;
    try { value = this.installedInventory(); }
    catch (error) {
      value = { complete: false, scannedAt: safeIso(this.now), extensions: [], error: boundedText(error instanceof Error ? error.message : String(error), 512) };
    }
    this.inventoryCache = { expiresAt: now + this.inventoryTtlMs, value };
    return value;
  }

  private ownership(
    input: RuntimeDebuggerBriefInput,
    deployInfo: RuntimeDebuggerDeployInfo | null,
  ): RuntimeDebuggerOwnership {
    let active = activeInput(input.record, input.manifest, deployInfo);
    const inventory = input.otherExtensions
      ? {
          complete: input.inventoryComplete !== false,
          scannedAt: safeIso(this.now),
          extensions: input.otherExtensions,
        }
      : this.getInventory();
    const selectedIndex = selectCorrelatedInstalledExtension(active, inventory, deployInfo);
    if (selectedIndex !== undefined) {
      active = mergeInstalledExtension(active, inventory.extensions[selectedIndex], deployInfo);
    }
    const otherExtensions = inventory.extensions.filter((_extension, index) => index !== selectedIndex);
    return {
      active,
      inventory,
      index: buildRuntimeOwnershipIndex({ active, otherExtensions }),
      otherExtensionCount: boundedCount(otherExtensions.length),
    };
  }

  private currentExpected(
    steps: RuntimeExpectedStep[],
    state: "current" | "historical" | "unavailable",
    snapshot: RuntimeDebugSessionSnapshot | undefined,
    lines: readonly RuntimeDebugLine[],
    candidates: readonly RuntimeCandidateIncident[],
  ): RuntimeExpectedStepResult[] {
    if (state !== "current" || !snapshot) return evaluateExpectedRuntimeSteps(steps, { available: false, lines: [] });
    const segment = currentSegment(snapshot);
    const currentEvidence: RuntimeCurrentSegmentEvidence = {
      available: true,
      segmentId: segment?.id,
      lines: lines.map(line => line.text),
      candidates: [...candidates],
    };
    const results = evaluateExpectedRuntimeSteps(steps, currentEvidence);
    const persisted = snapshot.incidents.map(reconstructExpected).filter((item): item is ReconstructedExpected => Boolean(item && item.segmentId === snapshot.currentSegmentId));
    const persistedByStep = new Map<string, ReconstructedExpected>();
    for (const item of persisted) if (!persistedByStep.has(item.stepId)) persistedByStep.set(item.stepId, item);
    return results.map(result => {
      const prior = persistedByStep.get(result.id);
      return prior
        ? { ...result, truth: "observed", observed: true, success: true, evidence: prior.evidence.length ? prior.evidence : result.evidence }
        : result;
    });
  }

  private persistExpected(
    workspaceId: string,
    selection: { logPath: string; profileId: string },
    segmentId: string,
    results: readonly RuntimeExpectedStepResult[],
  ): RuntimeDebugSessionResult | null {
    const observed = results.filter(result => result.truth === "observed");
    if (!observed.length) return null;
    return this.store.recordIncidents({
      workspaceId,
      selection,
      incidents: observed.map(result => ({
        key: `${INTERNAL_EXPECTED_PREFIX}${hashToken(result.id).slice(0, 24)}`,
        summary: `Expected runtime step observed: ${result.label}`,
        classification: "runtime_expected_step",
        severity: "info",
        reason: "Current-session expected-step evidence was observed.",
        evidence: result.evidence,
        attributes: {
          [INTERNAL_ATTR]: INTERNAL_EXPECTED,
          stepId: result.id,
          label: result.label,
        },
        segmentId,
      })),
    });
  }

  private persistAnalyzerPolicyMarker(
    workspaceId: string,
    selection: { logPath: string; profileId: string },
    segmentId: string,
    baselineDropped: RuntimeDebugDroppedCounts,
  ): RuntimeDebugSessionResult {
    return this.store.recordIncidents({
      workspaceId,
      selection,
      incidents: [{
        key: INTERNAL_ANALYZER_POLICY_KEY,
        summary: `Runtime analyzer policy ${RUNTIME_DEBUGGER_ANALYZER_POLICY_VERSION} applied; bounded reanalysis started.`,
        classification: "runtime_analyzer_policy",
        severity: "info",
        reason: "Derived runtime incidents are replayed from the source log under the current deterministic analyzer policy.",
        attributes: {
          [INTERNAL_ATTR]: INTERNAL_ANALYZER_POLICY,
          policyVersion: RUNTIME_DEBUGGER_ANALYZER_POLICY_VERSION,
          policyBaselineDroppedSegments: baselineDropped.segments,
          policyBaselineDroppedIncidents: baselineDropped.incidents,
          policyBaselineDroppedIncidentBytes: baselineDropped.incidentBytes,
          policyBaselineDroppedPartialLineBytes: baselineDropped.partialLineBytes,
          policyBaselineDroppedTruncatedLines: baselineDropped.truncatedLines,
          policyBaselineDroppedEvidenceBytes: baselineDropped.evidenceBytes,
          policyBaselineDroppedBaselineTokens: baselineDropped.baselineTokens,
        },
        segmentId,
      }],
    });
  }

  private reconstructDeployInfo(snapshot: RuntimeDebugSessionSnapshot | undefined): RuntimeDebuggerDeployInfo | null {
    if (!snapshot) return null;
    const records = snapshot.incidents.map(reconstructDeploy).filter((item): item is PersistedDeployEnvelope => Boolean(item));
    return records.length ? records[records.length - 1].info : null;
  }

  readDeployInfo(workspaceId: string): RuntimeDebuggerDeployInfo | null {
    const result = this.store.readSnapshot(workspaceId);
    return result.ok ? this.reconstructDeployInfo(result.snapshot) : null;
  }

  recordSuccessfulDeploy(workspaceId: string, infoInput: RuntimeDebuggerDeployInfo): RuntimeDebugSessionResult {
    const { deployedFingerprint, ...rest } = infoInput;
    const info: RuntimeDebuggerDeployInfo = {
      ...rest,
      workspaceId,
      ...(isSha256Fingerprint(deployedFingerprint) ? { deployedFingerprint: deployedFingerprint.toLowerCase() } : {}),
    };
    const selected = this.selectLog();
    if (!selected) {
      return {
        ok: false,
        status: "unavailable",
        code: "RUNTIME_DEPLOY_BASELINE_LOG_UNAVAILABLE",
        error: "Successful deploy recorded, but no readable X4 debuglog exists for an EOF baseline.",
        rebuildRequired: false,
      };
    }
    const prior = this.store.readSnapshot(workspaceId);
    const token = deploymentToken(workspaceId, info);
    const tokenHash = hashToken(token);
    if (prior.ok && prior.snapshot.baselineTokens.some(candidate => candidate.tokenHash === tokenHash)) {
      // A retry of the same successful deploy is idempotent even when the log
      // has grown since the original EOF.  Return the recorded session instead
      // of presenting the new EOF to beginBaseline as conflicting metadata.
      return prior.snapshot.health === "degraded"
        ? { ok: true, status: "degraded", snapshot: prior.snapshot }
        : { ok: true, status: "ready", snapshot: prior.snapshot };
    }
    const baselineLineNumber = prior.ok ? prior.snapshot.cursor.lineNumber : 0;
    const baseline = this.store.beginBaseline({
      workspaceId,
      logPath: selected.logPath,
      profileId: selected.profileId,
      baselineToken: token,
      baselineOffset: selected.stat.size,
      baselineLineNumber,
    });
    if (!baseline.ok) return baseline;
    const already = baseline.snapshot.incidents.some(incident => incident.key === INTERNAL_DEPLOY_KEY && incident.attributes.tokenHash === tokenHash);
    if (already) return baseline;
    return this.store.recordIncidents({
      workspaceId,
      selection: { logPath: selected.logPath, profileId: selected.profileId },
      incidents: [{
        key: INTERNAL_DEPLOY_KEY,
        summary: "Successful deploy baseline metadata",
        classification: "runtime_deploy_baseline",
        severity: "info",
        reason: "Internal deploy metadata; not a runtime incident.",
        attributes: {
          [INTERNAL_ATTR]: INTERNAL_DEPLOY,
          tokenHash,
          workspaceId,
          modId: info.modId,
          workspaceName: info.workspaceName,
          workspaceHash: info.workspaceHash,
          deployedAt: info.deployedAt,
          stagingPath: info.stagingPath || null,
          deployedPath: info.deployedPath || null,
          ...(info.deployedFingerprint ? { deployedFingerprint: info.deployedFingerprint } : {}),
        },
        position: {
          segmentId: baseline.snapshot.currentSegmentId,
          lineNumber: baseline.snapshot.cursor.lineNumber,
          startByte: selected.stat.size,
          endByte: selected.stat.size,
        },
      }],
    });
  }

  buildBrief(input: RuntimeDebuggerBriefInput): RuntimeDebuggerAdapterResult {
    const workspaceId = String(input.record.workspaceId || "").trim();
    const expectedSteps = input.expectedSteps || [];
    const deployInfo = input.deployInfo || this.readDeployInfo(workspaceId);
    const ownership = this.ownership(input, deployInfo);
    const selected = this.selectLog();
    if (!selected) return this.unavailableResult(input, ownership, deployInfo, expectedSteps, "No readable X4 debuglog is available.");

    let before: RuntimeDebugSessionSnapshot | undefined;
    const prior = this.store.readSnapshot(workspaceId);
    if (prior.ok) before = prior.snapshot;
    let migrationFailure: RuntimeDebugSessionFailure | undefined;
    if (before && !hasAnalyzerPolicy(before)) {
      const priorSegment = currentSegment(before);
      const replayFrom = hasSuccessfulBaseline(before) && priorSegment
        ? { baselineOffset: priorSegment.baselineOffset, baselineLineNumber: priorSegment.baselineLineNumber }
        : { baselineOffset: 0, baselineLineNumber: 0 };
      const reanalysis = this.store.beginAnalyzerPolicyReanalysis({
        workspaceId,
        logPath: selected.logPath,
        profileId: selected.profileId,
        ...replayFrom,
      });
      if (reanalysis.ok === false) {
        migrationFailure = reanalysis;
      } else {
        const marker = this.persistAnalyzerPolicyMarker(
          workspaceId,
          { logPath: selected.logPath, profileId: selected.profileId },
          reanalysis.snapshot.currentSegmentId,
          reanalysis.snapshot.dropped,
        );
        if (marker.ok === false) migrationFailure = marker;
        else before = marker.snapshot;
      }
    } else if (!before && prior.ok === false && prior.code === "SESSION_NOT_FOUND") {
      // New sessions are stamped before their first ingest so later polls do
      // not mistake an ordinary fresh cursor for an old-policy migration.
      const opened = this.store.open({
        workspaceId,
        logPath: selected.logPath,
        profileId: selected.profileId,
        baselineOffset: 0,
        baselineLineNumber: 0,
      });
      if (opened.ok === false) {
        migrationFailure = opened;
      } else {
        const marker = this.persistAnalyzerPolicyMarker(
          workspaceId,
          { logPath: selected.logPath, profileId: selected.profileId },
          opened.snapshot.currentSegmentId,
          opened.snapshot.dropped,
        );
        if (marker.ok === false) migrationFailure = marker;
        else before = marker.snapshot;
      }
    }
    const keyCache = new Map<string, string>();
    let analyzedBatch: RuntimeAnalyzedCandidate[] = [];
    let ingestedLines: RuntimeDebugLine[] = [];
    let ingestFailure: RuntimeDebugSessionFailure | undefined;
    const ingest = migrationFailure || this.store.ingest({
      workspaceId,
      logPath: selected.logPath,
      profileId: selected.profileId,
      baselineOffset: 0,
      baselineLineNumber: before?.cursor.lineNumber || 0,
      normalizeLines: (lines, segment) => {
        ingestedLines = [...lines];
        analyzedBatch = analyzeLines(lines, ownership.index, ownership.inventory.complete);
        return incidentInputs(analyzedBatch, lines, segment.id, ownership.active, keyCache);
      },
    });
    if (ingest.ok === false) ingestFailure = ingest;
    let snapshot = ingest.snapshot;
    let metadataFailure: RuntimeDebugSessionFailure | undefined;
    let state: RuntimeDebuggerSession["state"] = "unavailable";
    let deployAfterRestart = deployInfo || (snapshot ? this.reconstructDeployInfo(snapshot) : null);
    if (snapshot && !ingestFailure) {
      state = hasSuccessfulBaseline(snapshot) ? "current" : "historical";
      const expected = this.currentExpected(expectedSteps, state, snapshot, ingestedLines, analyzedBatch);
      const expectedPersist = state === "current" ? this.persistExpected(workspaceId, { logPath: selected.logPath, profileId: selected.profileId }, snapshot.currentSegmentId, expected) : null;
      if (expectedPersist?.ok === false) metadataFailure = expectedPersist;
      if (expectedPersist?.ok) snapshot = expectedPersist.snapshot;
    } else if (snapshot) {
      state = hasSuccessfulBaseline(snapshot) ? "current" : "historical";
    }
    if (metadataFailure) state = "unavailable";
    if (!snapshot && !ingestFailure) {
      const read = this.store.readSnapshot(workspaceId);
      if (read.ok) snapshot = read.snapshot;
       else if (read.ok === false) ingestFailure = read;
    }
    deployAfterRestart = deployAfterRestart || (snapshot ? this.reconstructDeployInfo(snapshot) : null);
    const segment = snapshot ? currentSegment(snapshot) : undefined;
    const allIncidents = snapshot
      ? snapshot.incidents.map(reconstructIncident).filter((item): item is ReconstructedIncident => Boolean(item))
      : [];
    const policyBoundary = snapshot ? analyzerPolicyBoundary(snapshot) : undefined;
    const policyFloor = policyBoundary?.floor;
    const segmentOrder = snapshot ? new Map(snapshot.segments.map((candidate, index) => [candidate.id, index])) : new Map<string, number>();
    const authoritativeIncidents = policyFloor === undefined
      ? allIncidents
      : allIncidents.filter(incident => (segmentOrder.get(incident.segmentId) ?? -1) >= policyFloor);
    const currentIncidents = segment ? authoritativeIncidents.filter(incident => incident.segmentId === segment.id) : [];
    const relevantIncidents = state === "current" ? currentIncidents : authoritativeIncidents;
    const effectiveDropped = snapshot ? postPolicyDropped(snapshot, policyBoundary) : undefined;
    const dropped = effectiveDropped ? effectiveDropped.incidents + effectiveDropped.segments : 1;
    const coverage = coverageFor(state === "current" ? currentIncidents : relevantIncidents.filter(incident => !isInternalKey(incident.key)), dropped);
    const expected = snapshot
      ? this.currentExpected(expectedSteps, state, snapshot, ingestedLines, analyzedBatch)
      : evaluateExpectedRuntimeSteps(expectedSteps, { available: false, lines: [] });
    const positiveExecution = currentIncidents.some(incident => incident.positiveExecution)
      || analyzedBatch.some(candidate => positiveExecutionEvidence(candidate, ownership.active));
    const health = snapshot
      ? effectiveDropped && DROPPED_COUNT_KEYS.every(key => effectiveDropped[key] === 0) ? "ready" : snapshot.health
      : "unavailable";
    const verdict = verdictFor({
      hasLog: true,
      currentSession: state === "current" && !ingestFailure && !metadataFailure,
      coverage,
      currentIncidents,
      expected,
      health,
      positiveExecutionEvidence: positiveExecution,
    });
    const visible = relevantIncidents
      .filter(incident => incident.attribution.disposition !== "excluded_other_mod")
      .sort(compareRuntimeIncidents)
      .slice(0, MAX_RESPONSE_INCIDENTS)
      .map(incident => ({ ...incident, sessionSegmentId: incident.segmentId, sessionCurrent: incident.segmentId === segment?.id }));
    const hiddenOtherModCount = relevantIncidents
      .filter(incident => incident.attribution.disposition === "excluded_other_mod")
      .reduce((sum, incident) => sum + Math.max(1, incident.count), 0);
    const ambiguousCount = relevantIncidents
      .filter(incident => incident.attribution.disposition === "ambiguous")
      .reduce((sum, incident) => sum + Math.max(1, incident.count), 0);
    const sessionDetail = ingestFailure
      ? redactedText(ingestFailure.error, 2048, "Runtime session unavailable.")
      : metadataFailure
        ? redactedText(metadataFailure.error, 2048, "Runtime expected-step state unavailable.")
        : state === "current"
          ? "Current successful-deploy session; log ingestion is incremental and bounded."
          : "Historical pre-baseline evidence is retained; it cannot satisfy current-session verdicts.";
    const publicExpected = redactedExpectedSteps(expected.slice(0, MAX_RESPONSE_EXPECTED));
    const publicVerdict: RuntimeDebuggerVerdict = { ...verdict, detail: redactedText(verdict.detail, 2048) };
    const authority: RuntimeDebuggerAuthority = {
      workspaceId,
      displayName: redactedText(ownership.active.displayName, 512, "runtime workspace"),
      ...(ownership.active.contentIds[0] ? { contentId: redactedText(ownership.active.contentIds[0], 512) } : {}),
      ...(ownership.active.sourceFolder ? { sourceFolder: boundedPath(ownership.active.sourceFolder) } : {}),
      ...(ownership.active.deployedFolders[0] ? { deployedFolder: boundedPath(ownership.active.deployedFolders[0]) } : {}),
    };
    const payload = {
      schemaVersion: RUNTIME_DEBUGGER_ADAPTER_SCHEMA_VERSION,
      authority,
      identity: {
        workspaceId,
        contentIds: ownership.active.contentIds.slice(0, 16),
        deployedFolders: ownership.active.deployedFolders.slice(0, 16),
        sourceFolders: (ownership.active.sourceFolders || [])
          .slice(0, 16)
          .map(value => boundedPath(value))
          .filter((value): value is string => Boolean(value)),
        ownedFileCount: normalizeManifest(ownership.active.manifest).length,
        inventoryComplete: ownership.inventory.complete,
        inventoryOtherExtensionCount: ownership.otherExtensionCount,
        ...(ownership.inventory.scannedAt ? { inventoryScannedAt: ownership.inventory.scannedAt } : {}),
      },
      session: {
        state,
        ...(segment ? { sessionId: segment.id, generation: snapshot?.segments.length, firstLine: segment.baselineLineNumber, lastLine: snapshot?.cursor.lineNumber, resetReason: redactedText(segment.reason, 256) } : {}),
        logPath: boundedPath(selected.logPath),
        newlyReadBytes: ingest.ok ? ingest.bytesRead : 0,
        observedAt: safeIso(this.now),
        detail: sessionDetail,
      },
      incidents: visible as RuntimeDebuggerIncident[],
      coverage,
      expectedSteps: publicExpected,
      hiddenOtherModCount: Math.min(1_000_000_000, hiddenOtherModCount),
      ambiguousCount: Math.min(1_000_000_000, ambiguousCount),
      hiddenOtherModSummary: hiddenOtherModCount > 0
        ? `${Math.min(1_000_000_000, hiddenOtherModCount)} occurrence(s) belong to known unrelated extensions and are hidden.`
        : ownership.inventory.complete ? "No unrelated-extension incidents were observed." : "Unrelated-extension inventory is incomplete; bare-path ownership remains unresolved.",
      verdict: publicVerdict,
    } satisfies RuntimeDebuggerAdapterResult["payload"];
    const lastLogMtime = (() => { try { return new Date(selected.stat.mtimeMs || this.now()).toISOString(); } catch { return undefined; } })();
    const timeline = visible.slice(0, 80).map(incident => ({
      kind: incident.classification || "runtime",
      severity: incident.severity || (incident.isEngineFailure ? "error" : "info"),
      lineNumber: incident.lastLine,
      label: redactedText(incident.mapping?.nodeLabel || incident.classification || "Runtime evidence", 512),
      evidence: redactedText(incident.evidence?.[0] || incident.explanation?.summary || "", 512),
      disposition: incident.attribution?.disposition || "unknown",
    }));
    const expectedChain = publicExpected.map(step => `${step.truth === "observed" ? "OBSERVED" : step.truth === "missing" ? "MISSING" : "UNAVAILABLE"} ${step.label}${step.evidence.length ? ` :: ${step.evidence[0]}` : ""}`);
    const artifact = redactUserProfileText([
      "Debug Watcher Brief",
      `Workspace: ${workspaceId}`,
      `Content IDs: ${(ownership.active.contentIds || []).join(", ")}`,
      `Deployed folders: ${(ownership.active.deployedFolders || []).join(", ")}`,
      `Session: ${state}`,
      `Verdict: ${publicVerdict.state}`,
      `Detail: ${publicVerdict.detail}`,
      `Log: ${selected.logPath}`,
      `Deploy: ${deployAfterRestart?.deployedAt || "none"}`,
      `Coverage: ${coverage.recognizedOrExplicitUnknown} recognized-or-explicit-unknown / ${coverage.candidates} candidates; target ${coverage.target}`,
      "",
      "Expected Chain:",
      ...(expectedChain.length ? expectedChain : ["(none configured)"]),
      "",
      "Evidence:",
      ...(visible.length ? visible.slice(0, 8).map(incident => `${incident.classification || "runtime"}: ${incident.evidence?.[0] || incident.explanation?.summary || "runtime evidence"}`) : ["No current runtime candidate evidence."]),
    ].join("\n"));
    return {
      payload,
      selectedLogPath: selected.logPath,
      ...(lastLogMtime ? { logUpdatedAt: lastLogMtime } : {}),
      logBytes: selected.stat.size,
      newlyReadBytes: ingest.ok ? ingest.bytesRead : 0,
      changedSinceDeploy: state === "current"
        && Boolean(segment && segment.endOffset > segment.baselineOffset),
      status: legacyStatusFor(verdict),
      summary: publicVerdict.detail,
      timeline,
      artifact,
      deployInfo: deployAfterRestart,
    };
  }

  private unavailableResult(
    input: RuntimeDebuggerBriefInput,
    ownership: RuntimeDebuggerOwnership,
    deployInfo: RuntimeDebuggerDeployInfo | null,
    expectedSteps: RuntimeExpectedStep[],
    detail: string,
  ): RuntimeDebuggerAdapterResult {
    const workspaceId = String(input.record.workspaceId || "").trim();
    const publicDetail = redactedText(detail, 2048, "Runtime session unavailable.");
    const verdict: RuntimeDebuggerVerdict = {
      state: "no_log",
      detail: publicDetail,
      errorCount: 0,
      currentSession: false,
      positiveExecutionEvidence: false,
      coverageMet: false,
      unresolvedBlocker: true,
    };
    const expected = evaluateExpectedRuntimeSteps(expectedSteps, { available: false, lines: [] });
    const publicExpected = redactedExpectedSteps(expected.slice(0, MAX_RESPONSE_EXPECTED));
    const payload = {
      schemaVersion: RUNTIME_DEBUGGER_ADAPTER_SCHEMA_VERSION,
      authority: {
        workspaceId,
        displayName: redactedText(ownership.active.displayName, 512, "runtime workspace"),
        ...(ownership.active.contentIds[0] ? { contentId: redactedText(ownership.active.contentIds[0], 512) } : {}),
        ...(ownership.active.sourceFolder ? { sourceFolder: boundedPath(ownership.active.sourceFolder) } : {}),
        ...(ownership.active.deployedFolders[0] ? { deployedFolder: boundedPath(ownership.active.deployedFolders[0]) } : {}),
      },
      identity: {
        workspaceId,
        contentIds: ownership.active.contentIds.slice(0, 16),
        deployedFolders: ownership.active.deployedFolders.slice(0, 16),
        sourceFolders: (ownership.active.sourceFolders || [])
          .slice(0, 16)
          .map(value => boundedPath(value))
          .filter((value): value is string => Boolean(value)),
        ownedFileCount: normalizeManifest(ownership.active.manifest).length,
        inventoryComplete: ownership.inventory.complete,
        inventoryOtherExtensionCount: ownership.otherExtensionCount,
        ...(ownership.inventory.scannedAt ? { inventoryScannedAt: ownership.inventory.scannedAt } : {}),
      },
      session: { state: "unavailable", observedAt: safeIso(this.now), detail: publicDetail },
      incidents: [],
      coverage: coverageFor([], 1),
      expectedSteps: publicExpected,
      hiddenOtherModCount: 0,
      ambiguousCount: 0,
      hiddenOtherModSummary: ownership.inventory.complete ? "No unrelated-extension incidents were observed." : "Unrelated-extension inventory is incomplete; bare-path ownership remains unresolved.",
      verdict,
    } satisfies RuntimeDebuggerAdapterResult["payload"];
    const artifact = redactUserProfileText(`Debug Watcher Brief\nWorkspace: ${workspaceId}\nSession: unavailable\nVerdict: no_log\nDetail: ${publicDetail}\n`);
    return {
      payload,
      selectedLogPath: "",
      logBytes: 0,
      newlyReadBytes: 0,
      changedSinceDeploy: false,
      status: "no_log",
      summary: publicDetail,
      timeline: [],
      artifact,
      deployInfo,
    };
  }
}

export function createRuntimeDebuggerAdapter(options: RuntimeDebuggerAdapterOptions = {}): RuntimeDebuggerAdapter {
  return new RuntimeDebuggerAdapter(options);
}

export interface RuntimeDebuggerAdapterSelftestLikeResult {
  pass: boolean;
  allPassed: boolean;
  passed: number;
  total: number;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
}
