import type {
  DeployEvidence,
  ExperienceConfirmation,
  ReadinessStatus,
} from './readiness';

export const X4_UI_GAME_VERIFICATION_SCHEMA_VERSION = 1 as const;
export const X4_UI_GAME_VERIFICATION_NOT_VERIFIED = 'Not verified in game' as const;
export const X4_UI_GAME_VERIFICATION_VERIFIED = 'Externally verified in game' as const;

export type X4UiPlainValue =
  | string
  | number
  | boolean
  | null
  | X4UiPlainRecord
  | readonly X4UiPlainValue[];

export interface X4UiPlainRecord {
  readonly [key: string]: X4UiPlainValue;
}

export interface X4UiSourceIdentity {
  readonly file: string;
  readonly sourcePath?: string;
  readonly sha256: string;
}

export interface X4UiNormalizedProfileSnapshot {
  readonly drawable: {
    readonly width: number;
    readonly height: number;
  };
  readonly uiScale: number;
  readonly id?: string;
  readonly truthGrade?: string;
  readonly provenance?: string;
  readonly source?: X4UiSourceIdentity;
  readonly minTextHeight?: number;
}

/** Plain current editor state emitted by the source editor; it contains no deploy authority. */
export interface X4UiGameVerificationCurrentSnapshot {
  readonly sourceIdentity: X4UiSourceIdentity;
  readonly targetIdentity: X4UiPlainRecord;
  readonly normalizedProfile: X4UiNormalizedProfileSnapshot;
}

/** Persisted only after an explicit human confirmation binds the current state to a deploy. */
export interface X4UiGameVerificationSnapshot extends X4UiGameVerificationCurrentSnapshot {
  readonly schemaVersion: typeof X4_UI_GAME_VERIFICATION_SCHEMA_VERSION;
  readonly deployedFingerprint: string;
}

export interface X4UiGameVerificationSnapshotInput {
  readonly sourceIdentity: unknown;
  readonly targetIdentity: unknown;
  readonly normalizedProfile: unknown;
}

export interface X4UiExperienceConfirmationRefreshInput {
  readonly previousConfirmation: unknown;
  readonly nextConfirmation: ExperienceConfirmation;
  readonly deployedFingerprint: unknown;
}

export interface X4UiGameVerificationReadiness {
  readonly graph: ReadinessStatus;
  readonly package: ReadinessStatus;
  readonly deployed: ReadinessStatus;
  readonly seen: ReadinessStatus;
}

export interface X4UiGameVerificationInput {
  readonly workspaceName: string;
  readonly workspaceHash: string;
  readonly deploy: DeployEvidence | null | undefined;
  readonly readiness: X4UiGameVerificationReadiness;
  readonly currentSnapshot: X4UiGameVerificationCurrentSnapshot | null | undefined;
  readonly confirmation: ExperienceConfirmation | null | undefined;
}

export type X4UiGameVerificationReason =
  | 'readiness-not-clean'
  | 'deploy-evidence-missing'
  | 'deploy-evidence-not-current'
  | 'fingerprint-invalid'
  | 'ui-selection-missing'
  | 'confirmation-required'
  | 'confirmation-invalid'
  | 'x4-snapshot-missing-or-invalid'
  | 'x4-snapshot-mismatch'
  | 'verified';

export interface X4UiGameVerificationDecision {
  readonly status: 'verified' | 'not-verified';
  readonly label: typeof X4_UI_GAME_VERIFICATION_NOT_VERIFIED | typeof X4_UI_GAME_VERIFICATION_VERIFIED;
  readonly detail: string;
  readonly canConfirm: boolean;
  readonly reason: X4UiGameVerificationReason;
}

export function isSha256Fingerprint(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function ownDataValue(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function ownPlainRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function clonePlainDataInternal(value: unknown, depth: number): X4UiPlainValue | undefined {
  if (depth > 8) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    const result: X4UiPlainValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined;
      const child = clonePlainDataInternal(descriptor.value, depth + 1);
      if (child === undefined) return undefined;
      result.push(child);
    }
    return Object.freeze(result);
  }
  if (ownPlainRecord(value) === null) return undefined;
  const result: Record<string, X4UiPlainValue> = {};
  for (const key of Object.keys(value).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined;
    const child = clonePlainDataInternal(descriptor.value, depth + 1);
    if (child === undefined) return undefined;
    Object.defineProperty(result, key, { configurable: false, enumerable: true, writable: false, value: child });
  }
  return Object.freeze(result);
}

function clonePlainData(value: unknown): X4UiPlainValue | undefined {
  try {
    return clonePlainDataInternal(value, 0);
  } catch {
    return undefined;
  }
}

function normalizeSourceIdentity(value: unknown): X4UiSourceIdentity | null {
  const record = ownPlainRecord(value);
  if (record === null) return null;
  const file = optionalText(ownDataValue(record, 'file'));
  const sha256 = ownDataValue(record, 'sha256');
  if (!file || !isSha256Fingerprint(sha256)) return null;
  const sourcePath = optionalText(ownDataValue(record, 'sourcePath'));
  return Object.freeze({
    file,
    ...(sourcePath ? { sourcePath } : {}),
    sha256: sha256.toLowerCase(),
  });
}

function normalizeTargetIdentity(value: unknown): X4UiPlainRecord | null {
  const cloned = clonePlainData(value);
  if (cloned === undefined || cloned === null || typeof cloned !== 'object' || Array.isArray(cloned)) return null;
  const record = cloned as X4UiPlainRecord;
  const hasTargetIdentity = ['id', 'kind', 'name'].some(key => optionalText(record[key]) !== undefined);
  return hasTargetIdentity ? record : null;
}

function normalizeProfile(value: unknown): X4UiNormalizedProfileSnapshot | null {
  const record = ownPlainRecord(value);
  if (record === null) return null;
  const drawableValue = ownDataValue(record, 'drawable');
  const drawable = drawableValue === undefined ? record : ownPlainRecord(drawableValue);
  if (drawable === null) return null;
  const width = positiveNumber(ownDataValue(drawable, 'width'));
  const height = positiveNumber(ownDataValue(drawable, 'height'));
  const uiScale = positiveNumber(ownDataValue(record, 'uiScale'));
  if (width === undefined || height === undefined || uiScale === undefined) return null;
  const id = optionalText(ownDataValue(record, 'id'));
  const truthGrade = optionalText(ownDataValue(record, 'truthGrade'));
  const provenance = optionalText(ownDataValue(record, 'provenance'))
    || optionalText(ownDataValue(record, 'profileProvenance'));
  const sourceValue = ownDataValue(record, 'source');
  const source = sourceValue === undefined ? undefined : normalizeSourceIdentity(sourceValue);
  if (sourceValue !== undefined && source === null) return null;
  const minTextHeightValue = ownDataValue(record, 'minTextHeight');
  const minTextHeight = minTextHeightValue === undefined ? undefined : nonNegativeNumber(minTextHeightValue);
  if (minTextHeightValue !== undefined && minTextHeight === undefined) return null;
  return Object.freeze({
    drawable: Object.freeze({ width, height }),
    uiScale,
    ...(id ? { id } : {}),
    ...(truthGrade ? { truthGrade } : {}),
    ...(provenance ? { provenance } : {}),
    ...(source ? { source } : {}),
    ...(minTextHeight === undefined ? {} : { minTextHeight }),
  });
}

export function buildX4UiGameVerificationCurrentSnapshot(
  input: X4UiGameVerificationSnapshotInput,
): X4UiGameVerificationCurrentSnapshot | null {
  try {
    const sourceIdentity = normalizeSourceIdentity(input.sourceIdentity);
    const targetIdentity = normalizeTargetIdentity(input.targetIdentity);
    const normalizedProfile = normalizeProfile(input.normalizedProfile);
    if (sourceIdentity === null || targetIdentity === null || normalizedProfile === null) return null;
    return Object.freeze({ sourceIdentity, targetIdentity, normalizedProfile });
  } catch {
    return null;
  }
}

export function bindX4UiGameVerificationSnapshot(
  input: X4UiGameVerificationCurrentSnapshot,
  deployedFingerprint: unknown,
): X4UiGameVerificationSnapshot | null {
  if (!isSha256Fingerprint(deployedFingerprint)) return null;
  const current = buildX4UiGameVerificationCurrentSnapshot(input);
  if (current === null) return null;
  return Object.freeze({
    schemaVersion: X4_UI_GAME_VERIFICATION_SCHEMA_VERSION,
    ...current,
    deployedFingerprint: deployedFingerprint.toLowerCase(),
  });
}

export function parseX4UiGameVerificationSnapshot(value: unknown): X4UiGameVerificationSnapshot | null {
  const record = ownPlainRecord(value);
  if (record === null || ownDataValue(record, 'schemaVersion') !== X4_UI_GAME_VERIFICATION_SCHEMA_VERSION) return null;
  const current = buildX4UiGameVerificationCurrentSnapshot({
    sourceIdentity: ownDataValue(record, 'sourceIdentity'),
    targetIdentity: ownDataValue(record, 'targetIdentity'),
    normalizedProfile: ownDataValue(record, 'normalizedProfile'),
  });
  return current === null ? null : bindX4UiGameVerificationSnapshot(current, ownDataValue(record, 'deployedFingerprint'));
}

/** Refresh global experience evidence without erasing a compatible exact X4 UI subtype binding. */
export function refreshExperienceConfirmationPreservingX4UiSnapshot(
  input: X4UiExperienceConfirmationRefreshInput,
): ExperienceConfirmation {
  const nextConfirmation: ExperienceConfirmation = Object.freeze({
    workspaceName: input.nextConfirmation.workspaceName,
    workspaceHash: input.nextConfirmation.workspaceHash,
    deployedAt: input.nextConfirmation.deployedAt,
    confirmedAt: input.nextConfirmation.confirmedAt,
  });
  const previous = ownPlainRecord(input.previousConfirmation);
  const snapshot = previous === null
    ? null
    : parseX4UiGameVerificationSnapshot(ownDataValue(previous, 'x4UiSnapshot'));
  const fingerprint = isSha256Fingerprint(input.deployedFingerprint)
    ? input.deployedFingerprint.toLowerCase()
    : null;
  const compatible = previous !== null
    && ownDataValue(previous, 'workspaceName') === nextConfirmation.workspaceName
    && ownDataValue(previous, 'workspaceHash') === nextConfirmation.workspaceHash
    && ownDataValue(previous, 'deployedAt') === nextConfirmation.deployedAt
    && snapshot !== null
    && fingerprint !== null
    && snapshot.deployedFingerprint === fingerprint;
  return compatible
    ? Object.freeze({ ...nextConfirmation, x4UiSnapshot: snapshot })
    : nextConfirmation;
}

function currentSnapshotFromBound(value: X4UiGameVerificationSnapshot): X4UiGameVerificationCurrentSnapshot {
  return {
    sourceIdentity: value.sourceIdentity,
    targetIdentity: value.targetIdentity,
    normalizedProfile: value.normalizedProfile,
  };
}

function snapshotJson(value: X4UiGameVerificationCurrentSnapshot): string {
  return JSON.stringify({
    sourceIdentity: value.sourceIdentity,
    targetIdentity: value.targetIdentity,
    normalizedProfile: value.normalizedProfile,
  });
}

function notVerified(
  reason: X4UiGameVerificationReason,
  detail: string,
  canConfirm = false,
): X4UiGameVerificationDecision {
  return {
    status: 'not-verified',
    label: X4_UI_GAME_VERIFICATION_NOT_VERIFIED,
    detail,
    canConfirm,
    reason,
  };
}

function readinessIsClean(readiness: X4UiGameVerificationReadiness | undefined): boolean {
  return readiness?.graph === 'pass'
    && readiness.package === 'pass'
    && readiness.deployed === 'pass'
    && readiness.seen === 'pass';
}

export function classifyX4UiGameVerification(input: X4UiGameVerificationInput): X4UiGameVerificationDecision {
  if (!readinessIsClean(input.readiness)) {
    return notVerified('readiness-not-clean', 'The graph, project, deploy, and clean in-game readiness stages must all be current before X4 UI confirmation.');
  }

  const deploy = ownPlainRecord(input.deploy);
  const workspaceName = optionalText(input.workspaceName);
  const workspaceHash = optionalText(input.workspaceHash);
  const deployName = optionalText(ownDataValue(deploy, 'workspaceName'));
  const deployHash = optionalText(ownDataValue(deploy, 'workspaceHash'));
  const deployedAt = optionalText(ownDataValue(deploy, 'deployedAt'));
  const deployedPath = optionalText(ownDataValue(deploy, 'deployedPath'));
  if (deploy === null || !workspaceName || !workspaceHash || !deployName || !deployHash || !deployedAt || !deployedPath) {
    return notVerified('deploy-evidence-missing', 'Current exact deployed evidence is unavailable; deploy to the configured X4 extensions path first.');
  }
  if (deployName !== workspaceName || deployHash !== workspaceHash) {
    return notVerified('deploy-evidence-not-current', 'The current workspace does not match the exact successful deploy evidence.');
  }
  const deployedFingerprint = ownDataValue(deploy, 'deployedFingerprint');
  if (!isSha256Fingerprint(deployedFingerprint)) {
    return notVerified('fingerprint-invalid', 'The exact deployed-tree fingerprint is missing or malformed.');
  }

  const currentSnapshot = input.currentSnapshot === null || input.currentSnapshot === undefined
    ? null
    : buildX4UiGameVerificationCurrentSnapshot(input.currentSnapshot);
  if (currentSnapshot === null) {
    return notVerified('ui-selection-missing', 'Select an exact current X4 UI source and target with a valid normalized profile before confirming.');
  }

  if (input.confirmation === null || input.confirmation === undefined) {
    return notVerified('confirmation-required', 'Exact current deploy and clean in-game evidence are ready. Confirm what you personally saw in X4.', true);
  }
  const confirmation = ownPlainRecord(input.confirmation);
  const confirmationName = optionalText(ownDataValue(confirmation, 'workspaceName'));
  const confirmationHash = optionalText(ownDataValue(confirmation, 'workspaceHash'));
  const confirmationDeployAt = optionalText(ownDataValue(confirmation, 'deployedAt'));
  const confirmedAt = optionalText(ownDataValue(confirmation, 'confirmedAt'));
  if (confirmation === null || !confirmationName || !confirmationHash || !confirmationDeployAt || !confirmedAt) {
    return notVerified('confirmation-invalid', 'The stored experience confirmation is corrupt or incomplete.', true);
  }
  if (confirmationName !== workspaceName || confirmationHash !== workspaceHash || confirmationDeployAt !== deployedAt) {
    return notVerified('x4-snapshot-mismatch', 'The stored confirmation belongs to a different workspace or deploy timestamp.', true);
  }

  const snapshot = parseX4UiGameVerificationSnapshot(ownDataValue(confirmation, 'x4UiSnapshot'));
  if (snapshot === null) {
    return notVerified('x4-snapshot-missing-or-invalid', 'This confirmation has no valid exact X4 UI source, target, profile, and deployed-tree snapshot.', true);
  }
  if (snapshot.deployedFingerprint !== deployedFingerprint.toLowerCase()) {
    return notVerified('x4-snapshot-mismatch', 'The deployed-tree fingerprint changed after this confirmation.', true);
  }
  if (snapshotJson(currentSnapshot) !== snapshotJson(currentSnapshotFromBound(snapshot))) {
    return notVerified('x4-snapshot-mismatch', 'The current exact X4 UI source, target, or normalized drawable/UI-scale profile changed after this confirmation.', true);
  }
  return {
    status: 'verified',
    label: X4_UI_GAME_VERIFICATION_VERIFIED,
    detail: `Externally verified from the exact clean deploy at ${deployedAt}; source, target, profile, and deployed-tree fingerprint match.`,
    canConfirm: false,
    reason: 'verified',
  };
}
