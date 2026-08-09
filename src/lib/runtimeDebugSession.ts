/**
 * Durable, bounded cursor state for the X4 debug log.
 *
 * This module deliberately does not parse incidents.  It reads bytes once from a
 * persisted cursor, returns complete lines with positions, and accepts already
 * normalized incident envelopes from a later parser.  The persisted document never
 * contains the log itself: only bounded incident evidence and the minimum partial
 * line remainder are retained.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { dataPath } from "./dataDir";
import { atomicWriteJson } from "./workspaceState";

export const RUNTIME_DEBUG_SESSION_SCHEMA = "x4.runtime-debug-session" as const;
export const RUNTIME_DEBUG_SESSION_VERSION = 1 as const;
export const RUNTIME_DEBUG_SESSION_DIR = "runtime-debug-sessions";

/** Public defaults. The options can lower these values for focused fixtures. */
export const RUNTIME_DEBUG_MAX_SEGMENTS = 8;
export const RUNTIME_DEBUG_MAX_INCIDENTS = 256;
export const RUNTIME_DEBUG_MAX_INCIDENT_BYTES = 256 * 1024;
export const RUNTIME_DEBUG_MAX_INCIDENT_ENVELOPE_BYTES = 16 * 1024;
export const RUNTIME_DEBUG_MAX_EVIDENCE_SAMPLES = 4;
export const RUNTIME_DEBUG_MAX_EVIDENCE_BYTES = 4 * 1024;
export const RUNTIME_DEBUG_MAX_PARTIAL_LINE_BYTES = 64 * 1024;
export const RUNTIME_DEBUG_MAX_READ_CHUNK_BYTES = 64 * 1024;
export const RUNTIME_DEBUG_MAX_BYTES_PER_INGEST = 1024 * 1024;
export const RUNTIME_DEBUG_MAX_BASELINE_TOKENS = 64;
export const RUNTIME_DEBUG_MAX_STORE_BYTES = 1024 * 1024;
export const RUNTIME_DEBUG_MAX_TEXT_BYTES = 4 * 1024;
export const RUNTIME_DEBUG_MAX_ATTRIBUTES = 16;

export type RuntimeDebugSegmentReason =
  | "baseline"
  | "selected-path-change"
  | "profile-change"
  | "truncation"
  | "file-replaced-or-rotated"
  | "analyzer-policy-change";

export type RuntimeDebugSessionHealth =
  | "ready"
  | "degraded"
  | "unavailable"
  | "corrupt"
  | "unsupported"
  | "over-cap"
  | "error";

export interface RuntimeDebugLogSelection {
  /** The selected log path is identity metadata only; it is never used as a write path. */
  logPath: string;
  /** X4 profile identity. Empty is a valid explicit "no profile" value. */
  profileId?: string;
}

export interface RuntimeDebugFileStat {
  size: number;
  /** Prefer a stable OS file identity when the host can provide one. */
  fileIdentity?: string | null;
  dev?: number;
  ino?: number;
  mtimeMs?: number;
}

export interface RuntimeDebugLinePosition {
  segmentId: string;
  lineNumber: number;
  startByte: number;
  endByte: number;
}

export interface RuntimeDebugLine extends RuntimeDebugLinePosition {
  /** Text excludes the LF and an optional CR. */
  text: string;
  lineEnding: "\n" | "\r\n";
  /** A bounded prefix was returned because the source line exceeded the in-memory cap. */
  truncated: boolean;
}

export interface RuntimeDebugIncidentInput {
  /** Parser-owned stable signature. Repeated occurrences of this key collapse per segment. */
  key: string;
  summary: string;
  classification?: string;
  severity?: string;
  reason?: string;
  evidence?: readonly string[];
  attributes?: Readonly<Record<string, string | number | boolean | null>>;
  segmentId?: string;
  position?: Omit<RuntimeDebugLinePosition, "segmentId"> & { segmentId?: string };
}

export interface RuntimeDebugIncident extends RuntimeDebugLinePosition {
  key: string;
  summary: string;
  classification: string;
  severity: string;
  reason: string;
  occurrenceCount: number;
  first: RuntimeDebugLinePosition;
  last: RuntimeDebugLinePosition;
  evidence: string[];
  attributes: Record<string, string | number | boolean | null>;
}

export interface RuntimeDebugSegment {
  id: string;
  reason: RuntimeDebugSegmentReason;
  startedAt: string;
  endedAt?: string;
  endReason?: RuntimeDebugSegmentReason;
  selection: RuntimeDebugLogSelection;
  fileIdentity: string | null;
  baselineOffset: number;
  baselineLineNumber: number;
  endOffset: number;
  lineCount: number;
  /** Hash only; the caller's opaque deploy token is never persisted in clear text. */
  baselineTokenHash?: string;
}

export interface RuntimeDebugCursor {
  /** Next unread absolute byte in the current file segment. */
  byteOffset: number;
  /** Number of complete lines consumed in the current segment. First line is 1. */
  lineNumber: number;
  partialLineStartByte: number;
  partialLineBytes: number;
  partialLineDroppedBytes: number;
}

export interface RuntimeDebugCounts {
  bytesRead: number;
  linesRead: number;
  incidentOccurrences: number;
}

export interface RuntimeDebugDroppedCounts {
  segments: number;
  incidents: number;
  incidentBytes: number;
  partialLineBytes: number;
  truncatedLines: number;
  evidenceBytes: number;
  baselineTokens: number;
}

export interface RuntimeDebugBaselineToken {
  tokenHash: string;
  segmentId: string;
  selectionKey: string;
  baselineOffset: number;
  baselineLineNumber: number;
  recordedAt: string;
}

export interface RuntimeDebugLimits {
  maxBytesPerIngest: number;
  maxReadChunkBytes: number;
  maxBaselineTokens: number;
}

export interface RuntimeDebugSessionKey {
  workspaceId: string;
  selectionKey: string;
  logPath: string;
  profileId: string;
  fileIdentity: string | null;
}

export interface RuntimeDebugSessionSnapshot {
  schema: typeof RUNTIME_DEBUG_SESSION_SCHEMA;
  version: typeof RUNTIME_DEBUG_SESSION_VERSION;
  workspaceId: string;
  key: RuntimeDebugSessionKey;
  currentSegmentId: string;
  cursor: RuntimeDebugCursor;
  segments: RuntimeDebugSegment[];
  incidents: RuntimeDebugIncident[];
  counts: RuntimeDebugCounts;
  dropped: RuntimeDebugDroppedCounts;
  baselineTokens: RuntimeDebugBaselineToken[];
  limits: RuntimeDebugLimits;
  savedAt: string;
  health: RuntimeDebugSessionHealth;
  /** False for every dropped/truncated/degraded state; never infer clean from no incidents. */
  clean: boolean;
}

export interface RuntimeDebugSessionStoreOptions {
  /** Defaults to dataPath(RUNTIME_DEBUG_SESSION_DIR). Tests should inject a temp directory. */
  root?: string;
  now?: () => number;
  stat?: (filePath: string) => RuntimeDebugFileStat;
  read?: (filePath: string, position: number, length: number) => Buffer;
  /** Test seam. It runs immediately before the unique sibling is renamed into place. */
  beforeRename?: (temporary: string, target: string) => void;
  /** Explicit roots which may never contain the store root (game/mod/corpus safety gate). */
  forbiddenRoots?: readonly string[];
  maxSegments?: number;
  maxIncidents?: number;
  maxIncidentBytes?: number;
  maxIncidentEnvelopeBytes?: number;
  maxEvidenceSamples?: number;
  maxEvidenceBytes?: number;
  maxPartialLineBytes?: number;
  maxReadChunkBytes?: number;
  maxBytesPerIngest?: number;
  maxBaselineTokens?: number;
  maxStoreBytes?: number;
}

export interface RuntimeDebugSessionOpenInput extends RuntimeDebugLogSelection {
  workspaceId: string;
  /** Used only when creating a store or beginning a new segment. Defaults to zero. */
  baselineOffset?: number;
  /** Optional line baseline for a parser attaching to a known external offset. */
  baselineLineNumber?: number;
}

export interface RuntimeDebugBaselineInput extends RuntimeDebugLogSelection {
  workspaceId: string;
  /** Opaque deploy/session token. Only its bounded SHA-256 digest is persisted. */
  baselineToken: string;
  /** Caller-supplied current EOF byte offset. */
  baselineOffset: number;
  baselineLineNumber?: number;
}

/** Starts a bounded derived-state reanalysis without changing the source log. */
export interface RuntimeDebugAnalyzerReanalysisInput extends RuntimeDebugLogSelection {
  workspaceId: string;
  /** Defaults to zero; a current deploy session may replay only post-baseline bytes. */
  baselineOffset?: number;
  baselineLineNumber?: number;
}

export interface RuntimeDebugIngestInput extends RuntimeDebugSessionOpenInput {
  /** Optional generic parser seam. The store still owns no parsing logic. */
  normalizeLines?: (
    lines: readonly RuntimeDebugLine[],
    segment: RuntimeDebugSegment,
  ) => readonly RuntimeDebugIncidentInput[];
}

export interface RuntimeDebugRecordIncidentsInput {
  workspaceId: string;
  selection?: RuntimeDebugLogSelection;
  incidents: readonly RuntimeDebugIncidentInput[];
}

export interface RuntimeDebugSuccess<T extends RuntimeDebugSessionSnapshot = RuntimeDebugSessionSnapshot> {
  ok: true;
  status: "created" | "ready" | "degraded";
  snapshot: T;
  segmentBoundary?: {
    segmentId: string;
    reason: RuntimeDebugSegmentReason;
  };
}

export interface RuntimeDebugIngestSuccess extends RuntimeDebugSuccess {
  lines: RuntimeDebugLine[];
  bytesRead: number;
}

export interface RuntimeDebugSessionFailure {
  ok: false;
  status: Exclude<RuntimeDebugSessionHealth, "ready" | "degraded">;
  code: string;
  error: string;
  /** Corrupt, unsupported, and over-cap state must be rebuilt explicitly by the caller. */
  rebuildRequired: boolean;
  snapshot?: RuntimeDebugSessionSnapshot;
  lines?: RuntimeDebugLine[];
}

export type RuntimeDebugSessionResult = RuntimeDebugSuccess | RuntimeDebugSessionFailure;
export type RuntimeDebugIngestResult = RuntimeDebugIngestSuccess | RuntimeDebugSessionFailure;

export class RuntimeDebugSessionStoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RuntimeDebugSessionStoreError";
    this.code = code;
  }
}

interface NormalizedSelection {
  logPath: string;
  profileId: string;
}

type PersistedKey = RuntimeDebugSessionKey;

interface PersistedCursor {
  byteOffset: number;
  lineNumber: number;
  partialLineStartByte: number;
  partialLineBase64: string;
  partialLineDroppedBytes: number;
}

interface PersistedIncident extends RuntimeDebugIncident {
  firstOrdinal: number;
  lastOrdinal: number;
}

interface PersistedState {
  schema: typeof RUNTIME_DEBUG_SESSION_SCHEMA;
  version: typeof RUNTIME_DEBUG_SESSION_VERSION;
  workspaceId: string;
  key: PersistedKey;
  currentSegmentId: string;
  cursor: PersistedCursor;
  segments: RuntimeDebugSegment[];
  incidents: PersistedIncident[];
  counts: RuntimeDebugCounts;
  dropped: RuntimeDebugDroppedCounts;
  baselineTokens: RuntimeDebugBaselineToken[];
  limits: RuntimeDebugLimits;
  nextSegmentNumber: number;
  nextIncidentOrdinal: number;
  savedAt: string;
}

interface Caps {
  maxSegments: number;
  maxIncidents: number;
  maxIncidentBytes: number;
  maxIncidentEnvelopeBytes: number;
  maxEvidenceSamples: number;
  maxEvidenceBytes: number;
  maxPartialLineBytes: number;
  maxReadChunkBytes: number;
  maxBytesPerIngest: number;
  maxBaselineTokens: number;
  maxStoreBytes: number;
}

interface ReadStateSuccess {
  ok: true;
  state: PersistedState | null;
}

interface ReadStateFailure {
  ok: false;
  status: RuntimeDebugSessionFailure["status"];
  code: string;
  error: string;
  rebuildRequired: boolean;
}

type ReadStateResult = ReadStateSuccess | ReadStateFailure;

interface PreparedState {
  ok: true;
  state: PersistedState;
  changed: boolean;
  created: boolean;
  boundary?: { segmentId: string; reason: RuntimeDebugSegmentReason };
  selection: NormalizedSelection;
}

type PreparedStateResult = PreparedState | RuntimeDebugSessionFailure;

const TOP_LEVEL_KEYS = new Set([
  "schema",
  "version",
  "workspaceId",
  "key",
  "currentSegmentId",
  "cursor",
  "segments",
  "incidents",
  "counts",
  "dropped",
  "baselineTokens",
  "limits",
  "nextSegmentNumber",
  "nextIncidentOrdinal",
  "savedAt",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function samePath(left: string, right: string): boolean {
  const a = path.normalize(left);
  const b = path.normalize(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function contained(root: string, candidate: string): boolean {
  const normalizedRoot = path.resolve(root);
  const normalizedCandidate = path.resolve(candidate);
  if (samePath(normalizedRoot, normalizedCandidate)) return true;
  const prefix = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;
  return process.platform === "win32"
    ? normalizedCandidate.toLowerCase().startsWith(prefix.toLowerCase())
    : normalizedCandidate.startsWith(prefix);
}

function isMissing(error: unknown): boolean {
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
  return code === "ENOENT" || code === "ENOTDIR";
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 512);
}

function assertPositiveCap(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RuntimeDebugSessionStoreError("SESSION_CAP_INVALID", `${name} must be a positive safe integer.`);
  }
  return value;
}

function validateWorkspaceId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new RuntimeDebugSessionStoreError("SESSION_WORKSPACE_ID_INVALID", "workspaceId must be a path-safe immutable identifier.");
  }
  return value;
}

function normalizeText(value: unknown, maxBytes: number): { value: string; removedBytes: number } {
  const original = typeof value === "string" ? value : String(value ?? "");
  if (Buffer.byteLength(original, "utf8") <= maxBytes) return { value: original, removedBytes: 0 };
  let valueOut = original.slice(0, Math.max(1, maxBytes));
  while (Buffer.byteLength(valueOut, "utf8") > maxBytes) valueOut = valueOut.slice(0, -1);
  return { value: valueOut, removedBytes: Buffer.byteLength(original, "utf8") - Buffer.byteLength(valueOut, "utf8") };
}

function normalizeIdentity(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  return text.length <= 256 ? text : `sha256:${crypto.createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function identityFromStat(stat: RuntimeDebugFileStat): string | null {
  if (stat.fileIdentity !== undefined) return normalizeIdentity(stat.fileIdentity);
  if (stat.dev !== undefined || stat.ino !== undefined) return `dev:${String(stat.dev ?? "")}:ino:${String(stat.ino ?? "")}`;
  return null;
}

function canonicalSelection(selection: RuntimeDebugLogSelection): NormalizedSelection {
  if (!selection || typeof selection.logPath !== "string" || !selection.logPath.trim() || selection.logPath.includes("\0")) {
    throw new RuntimeDebugSessionStoreError("SESSION_LOG_PATH_INVALID", "logPath must be a non-empty path without NUL bytes.");
  }
  const profileId = selection.profileId === undefined ? "" : String(selection.profileId);
  if (profileId.includes("\0") || Buffer.byteLength(profileId, "utf8") > 512) {
    throw new RuntimeDebugSessionStoreError("SESSION_PROFILE_INVALID", "profileId is malformed or too large.");
  }
  return { logPath: path.resolve(selection.logPath), profileId };
}

function selectionIdentity(selection: NormalizedSelection, fileIdentity: string | null): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ logPath: selection.logPath, profileId: selection.profileId, fileIdentity }), "utf8")
    .digest("hex");
}

function baselineTokenHash(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0") || Buffer.byteLength(value, "utf8") > 512) {
    throw new RuntimeDebugSessionStoreError("SESSION_BASELINE_TOKEN_INVALID", "baselineToken must be a bounded non-empty token without NUL bytes.");
  }
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/** Stable identity exposed for the later server adapter. It never becomes a filesystem path. */
export function runtimeDebugSessionKey(
  workspaceId: string,
  selection: RuntimeDebugLogSelection,
  fileIdentity: string | null = null,
): string {
  const id = validateWorkspaceId(workspaceId);
  const normalized = canonicalSelection(selection);
  return `rds_${crypto
    .createHash("sha256")
    .update(JSON.stringify({ workspaceId: id, ...normalized, fileIdentity: normalizeIdentity(fileIdentity) }), "utf8")
    .digest("hex")}`;
}

function safeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function boundedText(value: unknown, maxBytes: number): value is string {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= maxBytes;
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function persistedAttributionDisposition(attributes: Record<string, string | number | boolean | null>): string | undefined {
  const raw = attributes.attribution;
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { disposition?: unknown };
    return typeof parsed.disposition === "string" ? parsed.disposition : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Retain high-value engine evidence ahead of newer low-value noise.  The
 * session store intentionally understands only bounded persisted attributes,
 * not the analyzer's source model; malformed or missing policy metadata falls
 * back to deterministic severity/recency ordering.
 */
function incidentRetentionPriority(incident: Pick<RuntimeDebugIncident, "attributes" | "severity" | "classification">): number {
  if (incident.classification === "runtime_analyzer_policy") return 500;

  const disposition = persistedAttributionDisposition(incident.attributes);
  const engineFailure = incident.attributes.isEngineFailure === true
    || incident.severity === "error";
  if (engineFailure && disposition === "confirmed_active") return 400;
  if (engineFailure && disposition === "ambiguous") return 350;
  if (engineFailure && disposition === "unknown") return 300;
  if (engineFailure && disposition === "excluded_other_mod") return 50;
  if (incident.classification === "authored_diagnostic" || incident.severity === "info") return 200;
  if (disposition === "confirmed_active") return 150;
  return 100;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validReason(value: unknown): value is RuntimeDebugSegmentReason {
  return value === "baseline"
    || value === "selected-path-change"
    || value === "profile-change"
    || value === "truncation"
    || value === "file-replaced-or-rotated"
    || value === "analyzer-policy-change";
}

function defaultStat(filePath: string): RuntimeDebugFileStat {
  const stat = fs.statSync(filePath);
  return {
    size: stat.size,
    dev: typeof stat.dev === "number" ? stat.dev : undefined,
    ino: typeof stat.ino === "number" ? stat.ino : undefined,
    mtimeMs: stat.mtimeMs,
  };
}

function defaultRead(filePath: string, position: number, length: number): Buffer {
  const descriptor = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(length);
    const bytes = fs.readSync(descriptor, buffer, 0, length, position);
    return buffer.subarray(0, bytes);
  } finally {
    fs.closeSync(descriptor);
  }
}

function normalizeBaseline(value: unknown, name: string): number {
  if (value === undefined) return 0;
  if (!safeNumber(value)) throw new RuntimeDebugSessionStoreError("SESSION_BASELINE_INVALID", `${name} must be a non-negative safe integer.`);
  return value;
}

function persistedKey(workspaceId: string, selection: NormalizedSelection, fileIdentity: string | null): PersistedKey {
  return {
    workspaceId,
    selectionKey: selectionIdentity(selection, fileIdentity),
    logPath: selection.logPath,
    profileId: selection.profileId,
    fileIdentity,
  };
}

function newDropped(): RuntimeDebugDroppedCounts {
  return { segments: 0, incidents: 0, incidentBytes: 0, partialLineBytes: 0, truncatedLines: 0, evidenceBytes: 0, baselineTokens: 0 };
}

function newState(
  workspaceId: string,
  selection: NormalizedSelection,
  baselineOffset: number,
  baselineLineNumber: number,
  limits: RuntimeDebugLimits,
  now: string,
): PersistedState {
  const segmentId = "seg_000001";
  const segment: RuntimeDebugSegment = {
    id: segmentId,
    reason: "baseline",
    startedAt: now,
    selection: { ...selection },
    fileIdentity: null,
    baselineOffset,
    baselineLineNumber,
    endOffset: baselineOffset,
    lineCount: 0,
  };
  return {
    schema: RUNTIME_DEBUG_SESSION_SCHEMA,
    version: RUNTIME_DEBUG_SESSION_VERSION,
    workspaceId,
    key: persistedKey(workspaceId, selection, null),
    currentSegmentId: segmentId,
    cursor: {
      byteOffset: baselineOffset,
      lineNumber: baselineLineNumber,
      partialLineStartByte: baselineOffset,
      partialLineBase64: "",
      partialLineDroppedBytes: 0,
    },
    segments: [segment],
    incidents: [],
    counts: { bytesRead: 0, linesRead: 0, incidentOccurrences: 0 },
    dropped: newDropped(),
    baselineTokens: [],
    limits: { ...limits },
    nextSegmentNumber: 2,
    nextIncidentOrdinal: 1,
    savedAt: now,
  };
}

function stateHealth(state: PersistedState): RuntimeDebugSessionHealth {
  const droppedKeys: Array<keyof RuntimeDebugDroppedCounts> = [
    "segments",
    "incidents",
    "incidentBytes",
    "partialLineBytes",
    "truncatedLines",
    "evidenceBytes",
    "baselineTokens",
  ];
  const marker = state.incidents
    .filter(incident => incident.classification === "runtime_analyzer_policy"
      && incident.attributes.runtimeInternal === "analyzer-policy"
      && safeNumber(incident.attributes.policyVersion)
      && incident.attributes.policyVersion > 0)
    .sort((left, right) => right.lastOrdinal - left.lastOrdinal || right.key.localeCompare(left.key))[0];
  const policyFloor = marker
    ? Object.fromEntries(droppedKeys.map(key => {
        const attribute = `policyBaselineDropped${key[0].toUpperCase()}${key.slice(1)}`;
        const value = marker.attributes[attribute];
        return [key, safeNumber(value) && value <= state.dropped[key] ? value : undefined];
      })) as Partial<RuntimeDebugDroppedCounts>
    : undefined;
  const validPolicyFloor = policyFloor && droppedKeys.every(key => policyFloor[key] !== undefined);
  const dropped = validPolicyFloor
    ? Object.fromEntries(droppedKeys.map(key => [key, state.dropped[key] - (policyFloor[key] as number)]))
    : state.dropped;
  return Object.values(dropped).some(value => value > 0) ? "degraded" : "ready";
}

function toSnapshot(state: PersistedState): RuntimeDebugSessionSnapshot {
  const currentSegment = state.segments.find(segment => segment.id === state.currentSegmentId) || state.segments[state.segments.length - 1];
  const health = stateHealth(state);
  return {
    schema: state.schema,
    version: state.version,
    workspaceId: state.workspaceId,
    key: clone(state.key),
    currentSegmentId: state.currentSegmentId,
    cursor: {
      byteOffset: state.cursor.byteOffset,
      lineNumber: state.cursor.lineNumber,
      partialLineStartByte: state.cursor.partialLineStartByte,
      partialLineBytes: Buffer.from(state.cursor.partialLineBase64, "base64").length,
      partialLineDroppedBytes: state.cursor.partialLineDroppedBytes,
    },
    segments: clone(state.segments),
    incidents: state.incidents
      .slice()
      .sort((left, right) => left.lastOrdinal - right.lastOrdinal || left.key.localeCompare(right.key))
      .map(({ firstOrdinal: _firstOrdinal, lastOrdinal: _lastOrdinal, ...incident }) => incident),
    counts: clone(state.counts),
    dropped: clone(state.dropped),
    baselineTokens: clone(state.baselineTokens),
    limits: clone(state.limits),
    savedAt: state.savedAt,
    health: currentSegment ? health : "error",
    // A healthy cursor only proves storage/read completeness. It cannot prove that the
    // game or mod has no runtime incidents, so this field is deliberately never true.
    clean: false,
  };
}

function failure(
  status: RuntimeDebugSessionFailure["status"],
  code: string,
  error: string,
  rebuildRequired: boolean,
  snapshot?: RuntimeDebugSessionSnapshot,
): RuntimeDebugSessionFailure {
  return { ok: false, status, code, error: error.slice(0, 512), rebuildRequired, ...(snapshot ? { snapshot } : {}) };
}

export class RuntimeDebugSessionStore {
  readonly root: string;
  private readonly now: () => number;
  private readonly stat: (filePath: string) => RuntimeDebugFileStat;
  private readonly read: (filePath: string, position: number, length: number) => Buffer;
  private readonly beforeRename?: (temporary: string, target: string) => void;
  private readonly forbiddenRoots: string[];
  private readonly caps: Caps;

  constructor(options: RuntimeDebugSessionStoreOptions = {}) {
    this.root = path.resolve(options.root ?? dataPath(RUNTIME_DEBUG_SESSION_DIR));
    if (samePath(this.root, path.parse(this.root).root)) {
      throw new RuntimeDebugSessionStoreError("SESSION_ROOT_INVALID", "Runtime debug session root may not be a filesystem root.");
    }
    this.forbiddenRoots = (options.forbiddenRoots || []).map(root => path.resolve(root));
    if (this.forbiddenRoots.some(root => contained(root, this.root) || contained(this.root, root))) {
      throw new RuntimeDebugSessionStoreError("SESSION_ROOT_FORBIDDEN", "Runtime debug session root overlaps a forbidden game/mod/corpus root.");
    }
    this.caps = {
      maxSegments: assertPositiveCap("maxSegments", options.maxSegments ?? RUNTIME_DEBUG_MAX_SEGMENTS),
      maxIncidents: assertPositiveCap("maxIncidents", options.maxIncidents ?? RUNTIME_DEBUG_MAX_INCIDENTS),
      maxIncidentBytes: assertPositiveCap("maxIncidentBytes", options.maxIncidentBytes ?? RUNTIME_DEBUG_MAX_INCIDENT_BYTES),
      maxIncidentEnvelopeBytes: assertPositiveCap("maxIncidentEnvelopeBytes", options.maxIncidentEnvelopeBytes ?? RUNTIME_DEBUG_MAX_INCIDENT_ENVELOPE_BYTES),
      maxEvidenceSamples: assertPositiveCap("maxEvidenceSamples", options.maxEvidenceSamples ?? RUNTIME_DEBUG_MAX_EVIDENCE_SAMPLES),
      maxEvidenceBytes: assertPositiveCap("maxEvidenceBytes", options.maxEvidenceBytes ?? RUNTIME_DEBUG_MAX_EVIDENCE_BYTES),
      maxPartialLineBytes: assertPositiveCap("maxPartialLineBytes", options.maxPartialLineBytes ?? RUNTIME_DEBUG_MAX_PARTIAL_LINE_BYTES),
      maxReadChunkBytes: Math.min(
        RUNTIME_DEBUG_MAX_READ_CHUNK_BYTES,
        assertPositiveCap("maxReadChunkBytes", options.maxReadChunkBytes ?? RUNTIME_DEBUG_MAX_READ_CHUNK_BYTES),
      ),
      maxBytesPerIngest: Math.min(
        RUNTIME_DEBUG_MAX_BYTES_PER_INGEST,
        assertPositiveCap("maxBytesPerIngest", options.maxBytesPerIngest ?? RUNTIME_DEBUG_MAX_BYTES_PER_INGEST),
      ),
      maxBaselineTokens: Math.min(
        RUNTIME_DEBUG_MAX_BASELINE_TOKENS,
        assertPositiveCap("maxBaselineTokens", options.maxBaselineTokens ?? RUNTIME_DEBUG_MAX_BASELINE_TOKENS),
      ),
      maxStoreBytes: assertPositiveCap("maxStoreBytes", options.maxStoreBytes ?? RUNTIME_DEBUG_MAX_STORE_BYTES),
    };
    this.now = options.now ?? (() => Date.now());
    this.stat = options.stat ?? defaultStat;
    this.read = options.read ?? defaultRead;
    this.beforeRename = options.beforeRename;
  }

  private currentLimits(): RuntimeDebugLimits {
    return {
      maxBytesPerIngest: this.caps.maxBytesPerIngest,
      maxReadChunkBytes: this.caps.maxReadChunkBytes,
      maxBaselineTokens: this.caps.maxBaselineTokens,
    };
  }

  /** The actual file name is workspace-hashed; hostile IDs never become path components. */
  storagePathFor(workspaceId: string): string {
    const id = validateWorkspaceId(workspaceId);
    const digest = crypto.createHash("sha256").update(id, "utf8").digest("hex");
    const candidate = path.resolve(this.root, `session-${digest}.json`);
    if (!contained(this.root, candidate) || samePath(this.root, candidate)) {
      throw new RuntimeDebugSessionStoreError("SESSION_PATH_ESCAPE", "Runtime debug session key escaped its store root.");
    }
    return candidate;
  }

  private ensureRoot(create: boolean): boolean {
    const parsed = path.parse(this.root);
    let current = parsed.root;
    for (const segment of path.relative(parsed.root, this.root).split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(current);
      } catch (error) {
        if (!isMissing(error)) throw new RuntimeDebugSessionStoreError("SESSION_ROOT_UNAVAILABLE", errorText(error));
        if (!create) return false;
        fs.mkdirSync(current);
        stat = fs.lstatSync(current);
      }
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new RuntimeDebugSessionStoreError("SESSION_ROOT_ESCAPE", "Runtime debug session root contains a non-directory or symbolic-link segment.");
      }
      try {
        if (!samePath(fs.realpathSync.native(current), current)) {
          throw new RuntimeDebugSessionStoreError("SESSION_ROOT_ESCAPE", "Runtime debug session root resolves through a link or junction.");
        }
      } catch (error) {
        if (error instanceof RuntimeDebugSessionStoreError) throw error;
        throw new RuntimeDebugSessionStoreError("SESSION_ROOT_UNAVAILABLE", errorText(error));
      }
    }
    return true;
  }

  private assertFileSafe(file: string): void {
    if (!contained(this.root, file) || samePath(this.root, file)) {
      throw new RuntimeDebugSessionStoreError("SESSION_PATH_ESCAPE", "Runtime debug session path escaped its store root.");
    }
    if (!this.ensureRoot(false)) return;
    if (!fs.existsSync(file)) return;
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new RuntimeDebugSessionStoreError("SESSION_PATH_ESCAPE", "Runtime debug session path is not a regular file.");
    }
    const realRoot = fs.realpathSync.native(this.root);
    const realFile = fs.realpathSync.native(file);
    if (!contained(realRoot, realFile)) {
      throw new RuntimeDebugSessionStoreError("SESSION_PATH_ESCAPE", "Runtime debug session file resolves outside its store root.");
    }
  }

  private readState(workspaceId: string): ReadStateResult {
    let file: string;
    try {
      file = this.storagePathFor(workspaceId);
      if (!this.ensureRoot(false) || !fs.existsSync(file)) return { ok: true, state: null };
      this.assertFileSafe(file);
    } catch (error) {
      const code = error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_ROOT_UNAVAILABLE";
      return failure("unavailable", code, errorText(error), false) as ReadStateFailure;
    }

    let raw: string;
    try {
      const stat = fs.statSync(file);
      if (stat.size > this.caps.maxStoreBytes) {
        return failure("over-cap", "SESSION_STORE_OVER_CAP", "Persisted runtime debug session exceeds the configured store byte cap.", true) as ReadStateFailure;
      }
      raw = fs.readFileSync(file, "utf8");
    } catch (error) {
      return failure("unavailable", "SESSION_STORE_READ_FAILED", errorText(error), false) as ReadStateFailure;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return failure("corrupt", "SESSION_STORE_CORRUPT", `Persisted JSON is corrupt: ${errorText(error)}`, true) as ReadStateFailure;
    }
    if (!isRecord(parsed) || parsed.schema !== RUNTIME_DEBUG_SESSION_SCHEMA || parsed.version !== RUNTIME_DEBUG_SESSION_VERSION) {
      return failure("unsupported", "SESSION_STORE_UNSUPPORTED", "Persisted runtime debug session schema/version is unsupported.", true) as ReadStateFailure;
    }
    if (JSON.stringify(parsed) !== raw) {
      return failure("corrupt", "SESSION_STORE_NON_CANONICAL", "Persisted runtime debug session is not canonical JSON.", true) as ReadStateFailure;
    }

    try {
      const state = this.validateState(parsed, workspaceId);
      return { ok: true, state };
    } catch (error) {
      const storeError = error instanceof RuntimeDebugSessionStoreError ? error : new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", errorText(error));
      const overCap = storeError.code === "SESSION_STORE_OVER_CAP";
      return failure(overCap ? "over-cap" : "corrupt", storeError.code, storeError.message, true) as ReadStateFailure;
    }
  }

  private validateState(value: Record<string, unknown>, expectedWorkspaceId: string): PersistedState {
    for (const key of Object.keys(value)) {
      if (!TOP_LEVEL_KEYS.has(key)) throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", `Unknown persisted field: ${key}`);
    }
    if (value.workspaceId !== expectedWorkspaceId) throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted workspace identity does not match its key.");
    if (!isRecord(value.key) || !isRecord(value.cursor) || !Array.isArray(value.segments) || !Array.isArray(value.incidents)
      || !isRecord(value.counts) || !isRecord(value.dropped) || !Array.isArray(value.baselineTokens) || !isRecord(value.limits)
      || typeof value.currentSegmentId !== "string" || typeof value.savedAt !== "string") {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted runtime debug session shape is invalid.");
    }
    if (value.segments.length < 1 || value.segments.length > this.caps.maxSegments) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted segment count exceeds the configured cap.");
    }
    if (value.incidents.length > this.caps.maxIncidents) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted incident count exceeds the configured cap.");
    }
    const key = value.key;
    if (key.workspaceId !== expectedWorkspaceId || typeof key.selectionKey !== "string" || typeof key.logPath !== "string"
      || typeof key.profileId !== "string" || (key.fileIdentity !== null && typeof key.fileIdentity !== "string")) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted session key is invalid.");
    }
    const keyFileIdentity = key.fileIdentity as string | null;
    const normalizedSelection = canonicalSelection({ logPath: key.logPath as string, profileId: key.profileId as string });
    if (normalizedSelection.logPath !== key.logPath || selectionIdentity(normalizedSelection, keyFileIdentity) !== key.selectionKey) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted session selection identity is invalid.");
    }
    const limitsValue = value.limits;
    if (!safeNumber(limitsValue.maxBytesPerIngest) || !safeNumber(limitsValue.maxReadChunkBytes) || !safeNumber(limitsValue.maxBaselineTokens)
      || limitsValue.maxBytesPerIngest < 1 || limitsValue.maxBytesPerIngest > RUNTIME_DEBUG_MAX_BYTES_PER_INGEST
      || limitsValue.maxReadChunkBytes < 1 || limitsValue.maxReadChunkBytes > RUNTIME_DEBUG_MAX_READ_CHUNK_BYTES
      || limitsValue.maxBaselineTokens < 1 || limitsValue.maxBaselineTokens > RUNTIME_DEBUG_MAX_BASELINE_TOKENS) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted runtime debug session limits are invalid.");
    }
    if (value.baselineTokens.length > this.caps.maxBaselineTokens || value.baselineTokens.length > limitsValue.maxBaselineTokens) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted baseline token metadata exceeds the configured cap.");
    }
    const cursorValue = value.cursor;
    const cursorByteOffset = cursorValue.byteOffset;
    const cursorLineNumber = cursorValue.lineNumber;
    const cursorPartialLineStartByte = cursorValue.partialLineStartByte;
    const cursorPartialLineBase64 = cursorValue.partialLineBase64;
    const cursorPartialLineDroppedBytes = cursorValue.partialLineDroppedBytes;
    if (!safeNumber(cursorByteOffset) || !safeNumber(cursorLineNumber) || !safeNumber(cursorPartialLineStartByte)
      || typeof cursorPartialLineBase64 !== "string" || !safeNumber(cursorPartialLineDroppedBytes)
      || cursorPartialLineStartByte > cursorByteOffset) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted cursor is invalid.");
    }
    let partial: Buffer;
    try {
      partial = Buffer.from(cursorPartialLineBase64, "base64");
      if (partial.toString("base64") !== cursorPartialLineBase64) throw new Error("invalid base64");
    } catch {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted partial-line remainder is invalid.");
    }
    if (partial.length > this.caps.maxPartialLineBytes) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted partial-line remainder exceeds the configured cap.");
    }

    const segmentIds = new Set<string>();
    for (const rawSegment of value.segments) {
      if (!isRecord(rawSegment) || typeof rawSegment.id !== "string" || segmentIds.has(rawSegment.id) || !validReason(rawSegment.reason)
        || typeof rawSegment.startedAt !== "string" || !isRecord(rawSegment.selection)
        || typeof rawSegment.selection.logPath !== "string" || typeof rawSegment.selection.profileId !== "string"
        || (rawSegment.fileIdentity !== null && typeof rawSegment.fileIdentity !== "string")
        || !safeNumber(rawSegment.baselineOffset) || !safeNumber(rawSegment.baselineLineNumber)
        || !safeNumber(rawSegment.endOffset) || !safeNumber(rawSegment.lineCount)) {
        throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted segment metadata is invalid.");
      }
      if (rawSegment.endedAt !== undefined && typeof rawSegment.endedAt !== "string") throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted segment end metadata is invalid.");
      if (rawSegment.endReason !== undefined && !validReason(rawSegment.endReason)) throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted segment end reason is invalid.");
      if (rawSegment.baselineTokenHash !== undefined
        && (typeof rawSegment.baselineTokenHash !== "string" || !/^[0-9a-f]{64}$/.test(rawSegment.baselineTokenHash))) {
        throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted segment baseline token metadata is invalid.");
      }
      const segmentSelection = canonicalSelection({ logPath: rawSegment.selection.logPath, profileId: rawSegment.selection.profileId });
      if (segmentSelection.logPath !== rawSegment.selection.logPath || segmentSelection.profileId !== rawSegment.selection.profileId) {
        throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted segment selection is not canonical.");
      }
      segmentIds.add(rawSegment.id);
    }
    if (typeof value.currentSegmentId !== "string" || !segmentIds.has(value.currentSegmentId) || value.currentSegmentId !== value.segments[value.segments.length - 1].id) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted current segment pointer is invalid.");
    }

    const counts = this.validateCounts(value.counts, "counts");
    const dropped = this.validateDropped(value.dropped);
    const incidents: PersistedIncident[] = [];
    let totalIncidentBytes = 0;
    for (const rawIncident of value.incidents) {
      if (!isRecord(rawIncident) || !boundedText(rawIncident.key, 256) || !boundedText(rawIncident.summary, RUNTIME_DEBUG_MAX_TEXT_BYTES)
        || !boundedText(rawIncident.classification, 128) || !boundedText(rawIncident.severity, 64) || !boundedText(rawIncident.reason, RUNTIME_DEBUG_MAX_TEXT_BYTES)
        || !boundedText(rawIncident.segmentId, 128) || !safeNumber(rawIncident.occurrenceCount)
        || !isRecord(rawIncident.first) || !isRecord(rawIncident.last) || !Array.isArray(rawIncident.evidence)
        || !isRecord(rawIncident.attributes) || !safeNumber(rawIncident.firstOrdinal) || !safeNumber(rawIncident.lastOrdinal)) {
        throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted incident envelope is invalid.");
      }
      if (!segmentIds.has(rawIncident.segmentId) || rawIncident.occurrenceCount < 1 || rawIncident.evidence.length > this.caps.maxEvidenceSamples) {
        throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted incident segment or cap metadata is invalid.");
      }
      if (!this.validPosition(rawIncident.first, segmentIds) || !this.validPosition(rawIncident.last, segmentIds)
        || rawIncident.first.segmentId !== rawIncident.segmentId || rawIncident.last.segmentId !== rawIncident.segmentId) {
        throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted incident positions are invalid.");
      }
      const evidence = rawIncident.evidence.map(item => {
        if (typeof item !== "string" || Buffer.byteLength(item, "utf8") > this.caps.maxEvidenceBytes) {
          throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted incident evidence exceeds the configured cap.");
        }
        return item;
      });
      const attributes: Record<string, string | number | boolean | null> = {};
      for (const [attributeKey, attributeValue] of Object.entries(rawIncident.attributes)) {
        if (Object.keys(attributes).length >= RUNTIME_DEBUG_MAX_ATTRIBUTES) throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted incident attribute count exceeds the configured cap.");
        if (!boundedText(attributeKey, 128)) throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted incident attribute key exceeds the configured cap.");
        if (typeof attributeValue === "string") {
          if (!boundedText(attributeValue, RUNTIME_DEBUG_MAX_TEXT_BYTES)) throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted incident attribute value exceeds the configured cap.");
          attributes[attributeKey] = attributeValue;
        } else if (typeof attributeValue === "number" && Number.isFinite(attributeValue)) {
          attributes[attributeKey] = attributeValue;
        } else if (typeof attributeValue === "boolean" || attributeValue === null) {
          attributes[attributeKey] = attributeValue as boolean | null;
        } else {
          throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted incident attribute value is invalid.");
        }
      }
      const incidentKey = rawIncident.key as string;
      const incidentSummary = rawIncident.summary as string;
      const incidentClassification = rawIncident.classification as string;
      const incidentSeverity = rawIncident.severity as string;
      const incidentReason = rawIncident.reason as string;
      const incidentOccurrenceCount = rawIncident.occurrenceCount as number;
      const incidentSegmentId = rawIncident.segmentId as string;
      const incidentFirst = rawIncident.first as unknown as RuntimeDebugLinePosition;
      const incidentLast = rawIncident.last as unknown as RuntimeDebugLinePosition;
      const incidentFirstOrdinal = rawIncident.firstOrdinal as number;
      const incidentLastOrdinal = rawIncident.lastOrdinal as number;
      const incident = {
        key: incidentKey,
        summary: incidentSummary,
        classification: incidentClassification,
        severity: incidentSeverity,
        reason: incidentReason,
        occurrenceCount: incidentOccurrenceCount,
        segmentId: incidentSegmentId,
        lineNumber: incidentLast.lineNumber,
        startByte: incidentLast.startByte,
        endByte: incidentLast.endByte,
        first: clone(incidentFirst),
        last: clone(incidentLast),
        evidence,
        attributes,
        firstOrdinal: incidentFirstOrdinal,
        lastOrdinal: incidentLastOrdinal,
      } satisfies PersistedIncident;
      const bytes = jsonBytes(incident);
      if (bytes > this.caps.maxIncidentEnvelopeBytes) throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted incident envelope exceeds the configured byte cap.");
      totalIncidentBytes += bytes;
      incidents.push(incident);
    }
    if (totalIncidentBytes > this.caps.maxIncidentBytes) throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted incident bytes exceed the configured cap.");
    if (!safeNumber(value.nextSegmentNumber) || value.nextSegmentNumber < 2 || !safeNumber(value.nextIncidentOrdinal) || value.nextIncidentOrdinal < 1) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted sequence counters are invalid.");
    }
    const baselineTokens: RuntimeDebugBaselineToken[] = [];
    const baselineTokenHashes = new Set<string>();
    for (const rawToken of value.baselineTokens) {
      if (!isRecord(rawToken) || typeof rawToken.tokenHash !== "string" || !/^[0-9a-f]{64}$/.test(rawToken.tokenHash)
        || baselineTokenHashes.has(rawToken.tokenHash) || typeof rawToken.segmentId !== "string" || !rawToken.segmentId
        || typeof rawToken.selectionKey !== "string" || !/^[0-9a-f]{64}$/.test(rawToken.selectionKey)
        || !safeNumber(rawToken.baselineOffset) || !safeNumber(rawToken.baselineLineNumber) || typeof rawToken.recordedAt !== "string") {
        throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted baseline token metadata is invalid.");
      }
      baselineTokenHashes.add(rawToken.tokenHash);
      baselineTokens.push({
        tokenHash: rawToken.tokenHash,
        segmentId: rawToken.segmentId,
        selectionKey: rawToken.selectionKey,
        baselineOffset: rawToken.baselineOffset,
        baselineLineNumber: rawToken.baselineLineNumber,
        recordedAt: rawToken.recordedAt,
      });
    }
    const state: PersistedState = {
      schema: RUNTIME_DEBUG_SESSION_SCHEMA,
      version: RUNTIME_DEBUG_SESSION_VERSION,
      workspaceId: expectedWorkspaceId,
      key: clone(key) as unknown as PersistedKey,
      currentSegmentId: value.currentSegmentId,
      cursor: {
        byteOffset: cursorByteOffset,
        lineNumber: cursorLineNumber,
        partialLineStartByte: cursorPartialLineStartByte,
        partialLineBase64: cursorPartialLineBase64,
        partialLineDroppedBytes: cursorPartialLineDroppedBytes,
      },
      segments: clone(value.segments) as unknown as RuntimeDebugSegment[],
      incidents,
      counts,
      dropped,
      baselineTokens,
      limits: {
        maxBytesPerIngest: limitsValue.maxBytesPerIngest,
        maxReadChunkBytes: limitsValue.maxReadChunkBytes,
        maxBaselineTokens: limitsValue.maxBaselineTokens,
      },
      nextSegmentNumber: value.nextSegmentNumber,
      nextIncidentOrdinal: value.nextIncidentOrdinal,
      savedAt: value.savedAt,
    };
    if (jsonBytes(state) > this.caps.maxStoreBytes) throw new RuntimeDebugSessionStoreError("SESSION_STORE_OVER_CAP", "Persisted runtime debug session exceeds the configured byte cap.");
    return state;
  }

  private validateCounts(value: Record<string, unknown>, label: string): RuntimeDebugCounts {
    if (!safeNumber(value.bytesRead) || !safeNumber(value.linesRead) || !safeNumber(value.incidentOccurrences)) {
      throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", `Persisted ${label} are invalid.`);
    }
    return { bytesRead: value.bytesRead, linesRead: value.linesRead, incidentOccurrences: value.incidentOccurrences };
  }

  private validateDropped(value: Record<string, unknown>): RuntimeDebugDroppedCounts {
    const keys: Array<keyof RuntimeDebugDroppedCounts> = ["segments", "incidents", "incidentBytes", "partialLineBytes", "truncatedLines", "evidenceBytes", "baselineTokens"];
    for (const key of keys) if (!safeNumber(value[key])) throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Persisted dropped counters are invalid.");
    return {
      segments: value.segments as number,
      incidents: value.incidents as number,
      incidentBytes: value.incidentBytes as number,
      partialLineBytes: value.partialLineBytes as number,
      truncatedLines: value.truncatedLines as number,
      evidenceBytes: value.evidenceBytes as number,
      baselineTokens: value.baselineTokens as number,
    };
  }

  private validPosition(value: Record<string, unknown>, segmentIds: Set<string>): boolean {
    return typeof value.segmentId === "string" && segmentIds.has(value.segmentId)
      && safeNumber(value.lineNumber) && safeNumber(value.startByte) && safeNumber(value.endByte)
      && value.endByte >= value.startByte;
  }

  private persist(state: PersistedState): RuntimeDebugSessionFailure | null {
    state.savedAt = new Date(this.now()).toISOString();
    let encoded: string;
    try {
      encoded = JSON.stringify(state);
      if (Buffer.byteLength(encoded, "utf8") > this.caps.maxStoreBytes) {
        return failure("over-cap", "SESSION_STORE_OVER_CAP", "The bounded runtime debug session cannot be serialized within its byte cap.", false);
      }
      this.ensureRoot(true);
      const target = this.storagePathFor(state.workspaceId);
      this.assertFileSafe(target);
      atomicWriteJson(target, state, { beforeRename: this.beforeRename });
      return null;
    } catch (error) {
      const code = error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_STORE_WRITE_FAILED";
      return failure(code === "SESSION_STORE_OVER_CAP" ? "over-cap" : "error", code, errorText(error), false);
    }
  }

  private currentSegment(state: PersistedState): RuntimeDebugSegment {
    const segment = state.segments.find(candidate => candidate.id === state.currentSegmentId);
    if (!segment) throw new RuntimeDebugSessionStoreError("SESSION_STORE_CORRUPT", "Current runtime debug segment is missing.");
    return segment;
  }

  private startSegment(
    state: PersistedState,
    selection: NormalizedSelection,
    reason: RuntimeDebugSegmentReason,
    baselineOffset: number,
    baselineLineNumber: number,
    tokenHash?: string,
  ): RuntimeDebugSegment {
    const previous = this.currentSegment(state);
    previous.endedAt = new Date(this.now()).toISOString();
    previous.endReason = reason;
    previous.endOffset = state.cursor.byteOffset;
    previous.lineCount = Math.max(0, state.cursor.lineNumber - previous.baselineLineNumber);
    const segmentId = `seg_${String(state.nextSegmentNumber).padStart(6, "0")}`;
    state.nextSegmentNumber += 1;
    const segment: RuntimeDebugSegment = {
      id: segmentId,
      reason,
      startedAt: new Date(this.now()).toISOString(),
      selection: { ...selection },
      fileIdentity: null,
      baselineOffset,
      baselineLineNumber,
      endOffset: baselineOffset,
      lineCount: 0,
      ...(tokenHash ? { baselineTokenHash: tokenHash } : {}),
    };
    state.segments.push(segment);
    state.currentSegmentId = segmentId;
    state.cursor = {
      byteOffset: baselineOffset,
      lineNumber: baselineLineNumber,
      partialLineStartByte: baselineOffset,
      partialLineBase64: "",
      partialLineDroppedBytes: 0,
    };
    state.key = persistedKey(state.workspaceId, selection, null);
    this.pruneSegments(state);
    return segment;
  }

  private pruneBaselineTokens(state: PersistedState): void {
    const limit = Math.min(this.caps.maxBaselineTokens, state.limits.maxBaselineTokens);
    while (state.baselineTokens.length > limit) {
      state.baselineTokens.shift();
      state.dropped.baselineTokens += 1;
    }
  }

  private pruneSegments(state: PersistedState): void {
    while (state.segments.length > this.caps.maxSegments) {
      const removed = state.segments.shift();
      if (!removed) break;
      state.dropped.segments += 1;
      const retained = new Set(state.segments.map(segment => segment.id));
      const removedIncidents = state.incidents.filter(incident => !retained.has(incident.segmentId));
      state.incidents = state.incidents.filter(incident => retained.has(incident.segmentId));
      for (const incident of removedIncidents) {
        state.dropped.incidents += 1;
        state.dropped.incidentBytes += jsonBytes(incident);
      }
    }
  }

  private selectionBoundaryReason(state: PersistedState, selection: NormalizedSelection): RuntimeDebugSegmentReason | null {
    const current = this.currentSegment(state).selection;
    if (current.logPath !== selection.logPath) return "selected-path-change";
    if (current.profileId !== selection.profileId) return "profile-change";
    return null;
  }

  private applyIncidents(state: PersistedState, input: readonly RuntimeDebugIncidentInput[]): void {
    if (!input.length) return;
    const segmentIds = new Set(state.segments.map(segment => segment.id));
    const current = this.currentSegment(state);
    const prepared: Array<{ input: RuntimeDebugIncidentInput; incident: Omit<PersistedIncident, "firstOrdinal" | "lastOrdinal">; removedEvidenceBytes: number }> = [];
    for (const candidate of input) {
      if (!candidate || typeof candidate.key !== "string" || !candidate.key.trim() || Buffer.byteLength(candidate.key, "utf8") > 256) {
        throw new RuntimeDebugSessionStoreError("SESSION_INCIDENT_INVALID", "Incident key is missing or too large.");
      }
      const segmentId = candidate.segmentId || candidate.position?.segmentId || current.id;
      if (!segmentIds.has(segmentId)) throw new RuntimeDebugSessionStoreError("SESSION_INCIDENT_SEGMENT_UNKNOWN", "Incident refers to a segment that is no longer retained.");
      const positionInput = candidate.position;
      const position: RuntimeDebugLinePosition = {
        segmentId,
        lineNumber: positionInput?.lineNumber ?? state.cursor.lineNumber,
        startByte: positionInput?.startByte ?? state.cursor.byteOffset,
        endByte: positionInput?.endByte ?? state.cursor.byteOffset,
      };
      if (!safeNumber(position.lineNumber) || !safeNumber(position.startByte) || !safeNumber(position.endByte) || position.endByte < position.startByte) {
        throw new RuntimeDebugSessionStoreError("SESSION_INCIDENT_POSITION_INVALID", "Incident position is invalid.");
      }
      if (positionInput?.segmentId && positionInput.segmentId !== segmentId) throw new RuntimeDebugSessionStoreError("SESSION_INCIDENT_SEGMENT_CONFLICT", "Incident segment identity conflicts with its position.");
      let removedEvidenceBytes = 0;
      const summary = normalizeText(candidate.summary, RUNTIME_DEBUG_MAX_TEXT_BYTES);
      removedEvidenceBytes += summary.removedBytes;
      const classification = normalizeText(candidate.classification ?? "unknown", 128);
      const severity = normalizeText(candidate.severity ?? "unknown", 64);
      const reason = normalizeText(candidate.reason ?? "", RUNTIME_DEBUG_MAX_TEXT_BYTES);
      removedEvidenceBytes += classification.removedBytes + severity.removedBytes + reason.removedBytes;
      const evidence: string[] = [];
      for (const rawEvidence of candidate.evidence || []) {
        if (evidence.length >= this.caps.maxEvidenceSamples) {
          removedEvidenceBytes += Buffer.byteLength(String(rawEvidence), "utf8");
          continue;
        }
        const normalized = normalizeText(rawEvidence, this.caps.maxEvidenceBytes);
        removedEvidenceBytes += normalized.removedBytes;
        if (!evidence.includes(normalized.value)) evidence.push(normalized.value);
      }
      const attributes: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(candidate.attributes || {})) {
        if (Object.keys(attributes).length >= RUNTIME_DEBUG_MAX_ATTRIBUTES) {
          removedEvidenceBytes += Buffer.byteLength(key, "utf8") + Buffer.byteLength(String(value), "utf8");
          continue;
        }
        const safeKey = normalizeText(key, 128);
        removedEvidenceBytes += safeKey.removedBytes;
        if (typeof value === "string") {
          const safeValue = normalizeText(value, RUNTIME_DEBUG_MAX_TEXT_BYTES);
          removedEvidenceBytes += safeValue.removedBytes;
          attributes[safeKey.value] = safeValue.value;
        } else if (typeof value === "number" && Number.isFinite(value)) attributes[safeKey.value] = value;
        else if (typeof value === "boolean" || value === null) attributes[safeKey.value] = value;
        else removedEvidenceBytes += Buffer.byteLength(String(value), "utf8");
      }
      prepared.push({
        input: candidate,
        incident: {
          key: candidate.key,
          summary: summary.value,
          classification: classification.value,
          severity: severity.value,
          reason: reason.value,
          occurrenceCount: 1,
          segmentId,
          lineNumber: position.lineNumber,
          startByte: position.startByte,
          endByte: position.endByte,
          first: position,
          last: position,
          evidence,
          attributes,
        },
        removedEvidenceBytes,
      });
    }

    for (const item of prepared) {
      const ordinal = state.nextIncidentOrdinal++;
      const existing = state.incidents.find(incident => incident.segmentId === item.incident.segmentId && incident.key === item.incident.key);
      if (existing) {
        existing.occurrenceCount = Math.min(Number.MAX_SAFE_INTEGER, existing.occurrenceCount + 1);
        existing.last = item.incident.last;
        existing.lineNumber = item.incident.lineNumber;
        existing.startByte = item.incident.startByte;
        existing.endByte = item.incident.endByte;
        for (const evidence of item.incident.evidence) if (!existing.evidence.includes(evidence) && existing.evidence.length < this.caps.maxEvidenceSamples) existing.evidence.push(evidence);
        existing.lastOrdinal = ordinal;
      } else {
        state.incidents.push({ ...item.incident, firstOrdinal: ordinal, lastOrdinal: ordinal });
      }
      state.counts.incidentOccurrences += 1;
      state.dropped.evidenceBytes += item.removedEvidenceBytes;
    }
    this.pruneIncidents(state);
  }

  private pruneIncidents(state: PersistedState): void {
    const ranked = state.incidents.slice().sort((left, right) => {
      const priority = incidentRetentionPriority(right) - incidentRetentionPriority(left);
      return priority || right.lastOrdinal - left.lastOrdinal || left.key.localeCompare(right.key);
    });
    const retained: PersistedIncident[] = [];
    let bytes = 0;
    for (const incident of ranked) {
      const size = jsonBytes(incident);
      if (retained.length >= this.caps.maxIncidents || bytes + size > this.caps.maxIncidentBytes || size > this.caps.maxIncidentEnvelopeBytes) {
        state.dropped.incidents += 1;
        state.dropped.incidentBytes += size;
        continue;
      }
      retained.push(incident);
      bytes += size;
    }
    state.incidents = retained.sort((left, right) => left.lastOrdinal - right.lastOrdinal || left.key.localeCompare(right.key));
  }

  private updateSegmentAfterRead(state: PersistedState, fileIdentity: string | null): void {
    const segment = this.currentSegment(state);
    segment.fileIdentity = fileIdentity;
    segment.endOffset = state.cursor.byteOffset;
    segment.lineCount = Math.max(0, state.cursor.lineNumber - segment.baselineLineNumber);
    state.key = persistedKey(
      state.workspaceId,
      canonicalSelection(segment.selection),
      fileIdentity,
    );
  }

  private prepareState(input: RuntimeDebugSessionOpenInput): PreparedStateResult {
    let workspaceId: string;
    let selection: NormalizedSelection;
    let baselineOffset: number;
    let baselineLineNumber: number;
    try {
      workspaceId = validateWorkspaceId(input.workspaceId);
      selection = canonicalSelection(input);
      baselineOffset = normalizeBaseline(input.baselineOffset, "baselineOffset");
      baselineLineNumber = normalizeBaseline(input.baselineLineNumber, "baselineLineNumber");
    } catch (error) {
      const code = error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_INPUT_INVALID";
      return failure("error", code, errorText(error), false);
    }
    const loaded = this.readState(workspaceId);
    if (loaded.ok === false) return failure(loaded.status, loaded.code, loaded.error, loaded.rebuildRequired);
    if (!loaded.state) {
      return {
        ok: true,
        state: newState(workspaceId, selection, baselineOffset, baselineLineNumber, this.currentLimits(), new Date(this.now()).toISOString()),
        changed: true,
        created: true,
        selection,
      };
    }
    const state = loaded.state;
    const reason = this.selectionBoundaryReason(state, selection);
    if (!reason) return { ok: true, state, changed: false, created: false, selection };
    const segment = this.startSegment(state, selection, reason, baselineOffset, baselineLineNumber);
    return { ok: true, state, changed: true, created: false, boundary: { segmentId: segment.id, reason }, selection };
  }

  open(input: RuntimeDebugSessionOpenInput): RuntimeDebugSessionResult {
    const prepared = this.prepareState(input);
    if (prepared.ok === false) return prepared;
    const writeFailure = prepared.changed ? this.persist(prepared.state) : null;
    if (writeFailure) return writeFailure;
    const snapshot = toSnapshot(prepared.state);
    return {
      ok: true,
      status: prepared.created ? "created" : snapshot.health === "degraded" ? "degraded" : "ready",
      snapshot,
      ...(prepared.boundary ? { segmentBoundary: prepared.boundary } : {}),
    };
  }

  /**
   * Explicitly records a deploy/session baseline, including when path and profile
   * are unchanged.  Only the token digest is retained so a caller can safely
   * retry the same successful deploy without creating another segment.
   */
  beginBaseline(input: RuntimeDebugBaselineInput): RuntimeDebugSessionResult {
    let workspaceId: string;
    let selection: NormalizedSelection;
    let tokenHash: string;
    let baselineOffset: number;
    let baselineLineNumber: number;
    try {
      workspaceId = validateWorkspaceId(input.workspaceId);
      selection = canonicalSelection(input);
      if (input.baselineOffset === undefined) {
        throw new RuntimeDebugSessionStoreError("SESSION_BASELINE_REQUIRED", "baselineOffset is required for an explicit baseline.");
      }
      baselineOffset = normalizeBaseline(input.baselineOffset, "baselineOffset");
      baselineLineNumber = normalizeBaseline(input.baselineLineNumber, "baselineLineNumber");
      tokenHash = baselineTokenHash(input.baselineToken);
    } catch (error) {
      return failure("error", error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_INPUT_INVALID", errorText(error), false);
    }

    const loaded = this.readState(workspaceId);
    if (loaded.ok === false) return failure(loaded.status, loaded.code, loaded.error, loaded.rebuildRequired);
    let state = loaded.state;
    if (state) {
      const currentSelection = this.currentSegment(state).selection;
      if (currentSelection.logPath !== selection.logPath || currentSelection.profileId !== selection.profileId) {
        return failure("error", "SESSION_SELECTION_MISMATCH", "An explicit baseline must use the currently selected path and profile.", false, toSnapshot(state));
      }
      const selectionKey = selectionIdentity(selection, null);
      const previousToken = state.baselineTokens.find(candidate => candidate.tokenHash === tokenHash);
      if (previousToken) {
        if (previousToken.selectionKey !== selectionKey
          || previousToken.baselineOffset !== baselineOffset
          || previousToken.baselineLineNumber !== baselineLineNumber) {
          return failure("error", "SESSION_BASELINE_TOKEN_CONFLICT", "The baseline token was already recorded with different selection or baseline metadata.", false, toSnapshot(state));
        }
        const snapshot = toSnapshot(state);
        return { ok: true, status: snapshot.health === "degraded" ? "degraded" : "ready", snapshot };
      }
    }

    let stat: RuntimeDebugFileStat;
    try {
      stat = this.stat(selection.logPath);
      if (!stat || !safeNumber(stat.size)) throw new RuntimeDebugSessionStoreError("SESSION_FILE_STAT_INVALID", "File stat returned an invalid size.");
      if (baselineOffset > stat.size) throw new RuntimeDebugSessionStoreError("SESSION_BASELINE_BEYOND_EOF", "The explicit baseline is beyond the selected file size.");
    } catch (error) {
      return failure("unavailable", error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_FILE_UNAVAILABLE", errorText(error), false, state ? toSnapshot(state) : undefined);
    }

    const fileIdentity = identityFromStat(stat);
    const selectionKey = selectionIdentity(selection, null);
    const created = !state;
    if (!state) {
      state = newState(workspaceId, selection, baselineOffset, baselineLineNumber, this.currentLimits(), new Date(this.now()).toISOString());
      const initial = this.currentSegment(state);
      initial.baselineTokenHash = tokenHash;
      initial.fileIdentity = fileIdentity;
      state.key = persistedKey(workspaceId, selection, fileIdentity);
    } else {
      const segment = this.startSegment(state, selection, "baseline", baselineOffset, baselineLineNumber, tokenHash);
      segment.fileIdentity = fileIdentity;
      state.key = persistedKey(workspaceId, selection, fileIdentity);
    }
    state.baselineTokens.push({
      tokenHash,
      segmentId: state.currentSegmentId,
      selectionKey,
      baselineOffset,
      baselineLineNumber,
      recordedAt: new Date(this.now()).toISOString(),
    });
    this.pruneBaselineTokens(state);
    const writeFailure = this.persist(state);
    if (writeFailure) return writeFailure;
    const snapshot = toSnapshot(state);
    return {
      ok: true,
      status: created ? "created" : snapshot.health === "degraded" ? "degraded" : "ready",
      snapshot,
      ...(!created ? { segmentBoundary: { segmentId: state.currentSegmentId, reason: "baseline" as const } } : {}),
    };
  }

  /**
   * Move the derived cursor to a fresh bounded segment so a caller can replay
   * the source log under a new deterministic analyzer policy.  Existing
   * segments and derived records remain retained subject to the normal caps;
   * the source file is only read later by ingest().
   */
  beginAnalyzerPolicyReanalysis(input: RuntimeDebugAnalyzerReanalysisInput): RuntimeDebugSessionResult {
    let workspaceId: string;
    let selection: NormalizedSelection;
    let baselineOffset: number;
    let baselineLineNumber: number;
    try {
      workspaceId = validateWorkspaceId(input.workspaceId);
      selection = canonicalSelection(input);
      baselineOffset = normalizeBaseline(input.baselineOffset, "baselineOffset");
      baselineLineNumber = normalizeBaseline(input.baselineLineNumber, "baselineLineNumber");
    } catch (error) {
      return failure("error", error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_INPUT_INVALID", errorText(error), false);
    }

    const loaded = this.readState(workspaceId);
    if (loaded.ok === false) return failure(loaded.status, loaded.code, loaded.error, loaded.rebuildRequired);
    if (!loaded.state) return failure("unavailable", "SESSION_NOT_OPEN", "No runtime debug session exists for this workspace.", false);

    const state = loaded.state;
    const current = this.currentSegment(state);
    if (current.reason === "analyzer-policy-change"
      && current.baselineOffset === baselineOffset
      && current.baselineLineNumber === baselineLineNumber
      && current.selection.logPath === selection.logPath
      && current.selection.profileId === selection.profileId) {
      const snapshot = toSnapshot(state);
      return { ok: true, status: snapshot.health === "degraded" ? "degraded" : "ready", snapshot };
    }

    const segment = this.startSegment(state, selection, "analyzer-policy-change", baselineOffset, baselineLineNumber);
    const writeFailure = this.persist(state);
    if (writeFailure) return writeFailure;
    const snapshot = toSnapshot(state);
    return {
      ok: true,
      status: snapshot.health === "degraded" ? "degraded" : "ready",
      snapshot,
      segmentBoundary: { segmentId: segment.id, reason: "analyzer-policy-change" },
    };
  }

  ingest(input: RuntimeDebugIngestInput): RuntimeDebugIngestResult {
    const prepared = this.prepareState(input);
    if (prepared.ok === false) return prepared;
    const state = prepared.state;
    let stat: RuntimeDebugFileStat;
    try {
      stat = this.stat(prepared.selection.logPath);
      if (!stat || !safeNumber(stat.size)) throw new RuntimeDebugSessionStoreError("SESSION_FILE_STAT_INVALID", "File stat returned an invalid size.");
    } catch (error) {
      const writeFailure = prepared.changed ? this.persist(state) : null;
      if (writeFailure) return writeFailure;
      return failure("unavailable", "SESSION_FILE_UNAVAILABLE", errorText(error), false, toSnapshot(state));
    }
    const fileIdentity = identityFromStat(stat);
    let boundary = prepared.boundary;
    if (!prepared.created && !prepared.boundary) {
      const current = this.currentSegment(state);
      if (state.cursor.byteOffset > stat.size) {
        const segment = this.startSegment(state, prepared.selection, "truncation", normalizeBaseline(input.baselineOffset, "baselineOffset"), normalizeBaseline(input.baselineLineNumber, "baselineLineNumber"));
        boundary = { segmentId: segment.id, reason: "truncation" };
      } else if (current.fileIdentity && fileIdentity && current.fileIdentity !== fileIdentity) {
        const segment = this.startSegment(state, prepared.selection, "file-replaced-or-rotated", normalizeBaseline(input.baselineOffset, "baselineOffset"), normalizeBaseline(input.baselineLineNumber, "baselineLineNumber"));
        boundary = { segmentId: segment.id, reason: "file-replaced-or-rotated" };
      }
    }
    if (state.cursor.byteOffset > stat.size) {
      return failure("unavailable", "SESSION_BASELINE_BEYOND_EOF", "The explicit segment baseline is beyond the selected file size.", false, toSnapshot(state));
    }
    const startOffset = state.cursor.byteOffset;
    let lines: RuntimeDebugLine[];
    let bytesRead = 0;
    try {
      lines = this.readLines(state, prepared.selection, stat.size);
      bytesRead = state.cursor.byteOffset - startOffset;
    } catch (error) {
      const writeFailure = prepared.changed ? this.persist(state) : null;
      if (writeFailure) return writeFailure;
      return failure("unavailable", "SESSION_FILE_READ_FAILED", errorText(error), false, toSnapshot(state));
    }
    state.counts.bytesRead += bytesRead;
    state.counts.linesRead += lines.length;
    this.updateSegmentAfterRead(state, fileIdentity);
    try {
      if (input.normalizeLines) this.applyIncidents(state, input.normalizeLines(lines, clone(this.currentSegment(state))));
    } catch (error) {
      return failure("error", error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_NORMALIZER_FAILED", errorText(error), false, toSnapshot(state));
    }
    const writeFailure = this.persist(state);
    if (writeFailure) return { ...writeFailure, lines };
    const snapshot = toSnapshot(state);
    return {
      ok: true,
      status: snapshot.health === "degraded" ? "degraded" : prepared.created ? "created" : "ready",
      snapshot,
      lines,
      bytesRead,
      ...(boundary ? { segmentBoundary: boundary } : {}),
    };
  }

  recordIncidents(input: RuntimeDebugRecordIncidentsInput): RuntimeDebugSessionResult {
    let workspaceId: string;
    try { workspaceId = validateWorkspaceId(input.workspaceId); }
    catch (error) { return failure("error", error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_INPUT_INVALID", errorText(error), false); }
    const loaded = this.readState(workspaceId);
    if (loaded.ok === false) return failure(loaded.status, loaded.code, loaded.error, loaded.rebuildRequired);
    if (!loaded.state) return failure("unavailable", "SESSION_NOT_OPEN", "No runtime debug session exists for this workspace.", false);
    const state = loaded.state;
    if (input.selection) {
      try {
        const selection = canonicalSelection(input.selection);
        const current = this.currentSegment(state).selection;
        if (selection.logPath !== current.logPath || selection.profileId !== current.profileId) {
          return failure("error", "SESSION_SELECTION_MISMATCH", "Incident batch belongs to a different selected path or profile.", false, toSnapshot(state));
        }
      } catch (error) {
        return failure("error", error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_INPUT_INVALID", errorText(error), false, toSnapshot(state));
      }
    }
    try { this.applyIncidents(state, input.incidents); }
    catch (error) { return failure("error", error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_INCIDENT_INVALID", errorText(error), false, toSnapshot(state)); }
    const writeFailure = this.persist(state);
    if (writeFailure) return writeFailure;
    const snapshot = toSnapshot(state);
    return { ok: true, status: snapshot.health === "degraded" ? "degraded" : "ready", snapshot };
  }

  readSnapshot(workspaceId: string): RuntimeDebugSessionResult {
    let id: string;
    try { id = validateWorkspaceId(workspaceId); }
    catch (error) { return failure("error", error instanceof RuntimeDebugSessionStoreError ? error.code : "SESSION_INPUT_INVALID", errorText(error), false); }
    const loaded = this.readState(id);
    if (loaded.ok === false) return failure(loaded.status, loaded.code, loaded.error, loaded.rebuildRequired);
    if (!loaded.state) return failure("unavailable", "SESSION_NOT_FOUND", "No runtime debug session exists for this workspace.", false);
    const snapshot = toSnapshot(loaded.state);
    return { ok: true, status: snapshot.health === "degraded" ? "degraded" : "ready", snapshot };
  }

  private readLines(state: PersistedState, selection: NormalizedSelection, fileSize: number): RuntimeDebugLine[] {
    const lines: RuntimeDebugLine[] = [];
    const segment = this.currentSegment(state);
    const parts: Buffer[] = [];
    const persistedPartial = state.cursor.partialLineBase64
      ? Buffer.from(state.cursor.partialLineBase64, "base64")
      : Buffer.alloc(0);
    if (persistedPartial.length) parts.push(persistedPartial);
    let pendingLength = persistedPartial.length;
    let pendingStart = state.cursor.partialLineBase64 || state.cursor.partialLineDroppedBytes > 0
      ? state.cursor.partialLineStartByte
      : state.cursor.byteOffset;
    let pendingDropped = state.cursor.partialLineDroppedBytes;
    const appendPending = (bytes: Buffer): void => {
      if (!bytes.length) return;
      const room = Math.max(0, this.caps.maxPartialLineBytes - pendingLength);
      if (room > 0) {
        const kept = bytes.subarray(0, room);
        parts.push(kept);
        pendingLength += kept.length;
      }
      if (bytes.length > room) {
        const dropped = bytes.length - room;
        pendingDropped += dropped;
        state.dropped.partialLineBytes += dropped;
      }
    };
    const completeLine = (endByte: number): void => {
      const bytes = parts.length === 1 ? parts[0] : Buffer.concat(parts, pendingLength);
      let text = bytes.toString("utf8");
      const hasCr = text.endsWith("\r");
      if (hasCr) text = text.slice(0, -1);
      const position: RuntimeDebugLinePosition = {
        segmentId: segment.id,
        lineNumber: state.cursor.lineNumber + 1,
        startByte: pendingStart,
        endByte,
      };
      state.cursor.lineNumber += 1;
      lines.push({
        ...position,
        text,
        lineEnding: hasCr ? "\r\n" : "\n",
        truncated: pendingDropped > 0,
      });
      if (pendingDropped > 0) state.dropped.truncatedLines += 1;
      parts.length = 0;
      pendingLength = 0;
      pendingDropped = 0;
      pendingStart = endByte;
    };

    const maxBytesPerIngest = Math.min(this.caps.maxBytesPerIngest, state.limits.maxBytesPerIngest);
    const maxReadChunkBytes = Math.min(this.caps.maxReadChunkBytes, state.limits.maxReadChunkBytes);
    let bytesThisIngest = 0;
    while (state.cursor.byteOffset < fileSize && bytesThisIngest < maxBytesPerIngest) {
      const position = state.cursor.byteOffset;
      const requested = Math.min(maxReadChunkBytes, maxBytesPerIngest - bytesThisIngest, fileSize - position);
      const chunk = this.read(selection.logPath, position, requested);
      if (!Buffer.isBuffer(chunk) || chunk.length > requested || chunk.length === 0) {
        throw new RuntimeDebugSessionStoreError("SESSION_SHORT_READ", "The log reader returned no bounded progress before the stat boundary.");
      }
      let start = 0;
      while (start < chunk.length) {
        const newline = chunk.indexOf(0x0a, start);
        if (newline < 0) {
          appendPending(chunk.subarray(start));
          break;
        }
        appendPending(chunk.subarray(start, newline));
        completeLine(position + newline + 1);
        start = newline + 1;
      }
      state.cursor.byteOffset += chunk.length;
      bytesThisIngest += chunk.length;
    }
    state.cursor.partialLineStartByte = pendingStart;
    state.cursor.partialLineBase64 = parts.length ? Buffer.concat(parts, pendingLength).toString("base64") : "";
    state.cursor.partialLineDroppedBytes = pendingDropped;
    return lines;
  }
}
