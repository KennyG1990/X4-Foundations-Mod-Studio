import assert from 'node:assert/strict';
import {
  bindX4UiGameVerificationSnapshot,
  buildX4UiGameVerificationCurrentSnapshot,
  classifyX4UiGameVerification,
  isSha256Fingerprint,
  parseX4UiGameVerificationSnapshot,
  refreshExperienceConfirmationPreservingX4UiSnapshot,
  type X4UiGameVerificationInput,
} from './x4UiGameVerification';
import {
  buildReadinessStages,
  parseExperienceConfirmations,
  type BuildReadinessInput,
  type DeployEvidence,
} from './readiness';

const deployedFingerprint = 'a'.repeat(64);
const sourceIdentity = {
  file: 'ui/menu.lua',
  sourcePath: 'source/ui/menu.lua',
  sha256: 'b'.repeat(64),
};
const targetIdentity = {
  id: 'frame:menu',
  kind: 'frame',
  source: { file: 'ui/menu.lua', line: 12 },
};
const normalizedProfile = {
  id: 'profile-1920x1080-1',
  truthGrade: 'canonical',
  drawable: { width: 1920, height: 1080 },
  uiScale: 1,
};
const deploy: DeployEvidence = {
  workspaceName: 'Menu Workspace',
  workspaceHash: 'workspace-hash',
  deployedAt: '2026-08-28T12:00:00.000Z',
  deployedPath: 'F:/X4/extensions/menu_workspace',
  deployedFingerprint,
};
const readiness: X4UiGameVerificationInput['readiness'] = {
  graph: 'pass',
  package: 'pass',
  deployed: 'pass',
  seen: 'pass',
};
const currentSnapshot = buildX4UiGameVerificationCurrentSnapshot({
  sourceIdentity,
  targetIdentity,
  normalizedProfile,
});
if (currentSnapshot === null) throw new Error('fail-first fixture did not build a current X4 UI snapshot');

const baseInput: X4UiGameVerificationInput = {
  workspaceName: 'Menu Workspace',
  workspaceHash: 'workspace-hash',
  deploy,
  readiness,
  currentSnapshot,
  confirmation: null,
};
const decision = (overrides: Partial<X4UiGameVerificationInput> = {}) => classifyX4UiGameVerification({ ...baseInput, ...overrides });

assert.equal(isSha256Fingerprint(deployedFingerprint), true);
assert.equal(isSha256Fingerprint('not-a-fingerprint'), false);
assert.equal(decision().status, 'not-verified');
assert.equal(decision().canConfirm, true);

const boundSnapshot = bindX4UiGameVerificationSnapshot(currentSnapshot, deployedFingerprint);
if (boundSnapshot === null) throw new Error('fail-first fixture did not bind the deployed fingerprint');
const confirmation = {
  workspaceName: baseInput.workspaceName,
  workspaceHash: baseInput.workspaceHash,
  deployedAt: deploy.deployedAt!,
  confirmedAt: '2026-08-28T12:05:00.000Z',
  x4UiSnapshot: boundSnapshot,
};
assert.equal(decision({ confirmation }).status, 'verified');
assert.equal(decision({ confirmation }).reason, 'verified');

const refreshedConfirmationBase = {
  workspaceName: confirmation.workspaceName,
  workspaceHash: confirmation.workspaceHash,
  deployedAt: confirmation.deployedAt,
  confirmedAt: '2026-08-28T12:10:00.000Z',
};
const refreshedConfirmation = refreshExperienceConfirmationPreservingX4UiSnapshot({
  previousConfirmation: confirmation,
  nextConfirmation: refreshedConfirmationBase,
  deployedFingerprint,
});
assert.equal(refreshedConfirmation.confirmedAt, refreshedConfirmationBase.confirmedAt);
assert.deepEqual(refreshedConfirmation.x4UiSnapshot, boundSnapshot, 'same exact deploy must retain valid X4 UI subtype evidence');
for (const [name, previousConfirmation, nextConfirmation, fingerprint] of [
  ['workspace name drift', confirmation, { ...refreshedConfirmationBase, workspaceName: 'Other Workspace' }, deployedFingerprint],
  ['workspace hash drift', confirmation, { ...refreshedConfirmationBase, workspaceHash: 'other-hash' }, deployedFingerprint],
  ['deploy timestamp drift', confirmation, { ...refreshedConfirmationBase, deployedAt: '2026-08-28T12:11:00.000Z' }, deployedFingerprint],
  ['deployed fingerprint drift', confirmation, refreshedConfirmationBase, 'd'.repeat(64)],
  ['malformed deployed fingerprint', confirmation, refreshedConfirmationBase, 'bad'],
  ['malformed X4 UI evidence', { ...confirmation, x4UiSnapshot: { ...boundSnapshot, deployedFingerprint: 'bad' } }, refreshedConfirmationBase, deployedFingerprint],
] as const) {
  const result = refreshExperienceConfirmationPreservingX4UiSnapshot({
    previousConfirmation,
    nextConfirmation,
    deployedFingerprint: fingerprint,
  });
  assert.equal(result.x4UiSnapshot, undefined, `${name} must drop X4 UI subtype evidence`);
}

const sourceDrift = buildX4UiGameVerificationCurrentSnapshot({
  sourceIdentity: { ...sourceIdentity, sha256: 'c'.repeat(64) },
  targetIdentity,
  normalizedProfile,
});
const targetDrift = buildX4UiGameVerificationCurrentSnapshot({
  sourceIdentity,
  targetIdentity: { ...targetIdentity, id: 'frame:other' },
  normalizedProfile,
});
const profileDrift = buildX4UiGameVerificationCurrentSnapshot({
  sourceIdentity,
  targetIdentity,
  normalizedProfile: { ...normalizedProfile, uiScale: 1.25 },
});
assert.ok(sourceDrift && targetDrift && profileDrift);
assert.equal(decision({ currentSnapshot: sourceDrift }).status, 'not-verified');
assert.equal(decision({ currentSnapshot: targetDrift }).status, 'not-verified');
assert.equal(decision({ currentSnapshot: profileDrift }).status, 'not-verified');
assert.equal(decision({ workspaceHash: 'new-workspace-hash' }).status, 'not-verified');
assert.equal(decision({ deploy: { ...deploy, deployedAt: '2026-08-28T12:06:00.000Z' } }).status, 'not-verified');
assert.equal(decision({ deploy: { ...deploy, deployedFingerprint: 'd'.repeat(64) } }).status, 'not-verified');
assert.equal(decision({ deploy: { ...deploy, deployedFingerprint: undefined } }).status, 'not-verified');
assert.equal(decision({ deploy: { ...deploy, deployedFingerprint: 'bad' } }).status, 'not-verified');
assert.equal(decision({ readiness: { ...readiness, package: 'warning' } }).status, 'not-verified');
assert.equal(decision({ readiness: { ...readiness, seen: 'pending' } }).status, 'not-verified');
assert.equal(decision({ confirmation: { ...confirmation, x4UiSnapshot: undefined } }).status, 'not-verified');
assert.equal(decision({ confirmation: { ...confirmation, x4UiSnapshot: undefined } }).canConfirm, true);
assert.equal(decision({ confirmation: { ...confirmation, workspaceHash: 2 as unknown as string } }).status, 'not-verified');

const legacyConfirmation = {
  workspaceName: baseInput.workspaceName,
  workspaceHash: baseInput.workspaceHash,
  deployedAt: deploy.deployedAt!,
  confirmedAt: '2026-08-28T12:05:00.000Z',
};
const parsedLegacy = parseExperienceConfirmations(JSON.stringify({ legacy: legacyConfirmation }));
assert.deepEqual(parsedLegacy.legacy, legacyConfirmation, 'legacy confirmation must remain valid without an X4 UI snapshot');
const legacyReadinessInput: BuildReadinessInput = {
  workspaceName: baseInput.workspaceName,
  workspaceHash: baseInput.workspaceHash,
  graphDiagnostics: [],
  packageDiagnostics: [],
  diagnosticSource: 'project',
  watcher: {
    phase: 'ready',
    lastDeploy: deploy,
    sinceDeploy: { hasDeploy: true, changedSinceDeploy: true, summary: 'fresh', deployedAt: deploy.deployedAt },
    verdict: { state: 'loaded_clean', detail: 'clean fixture', errorCount: 0 },
  },
  confirmation: parsedLegacy.legacy,
};
assert.equal(buildReadinessStages(legacyReadinessInput).find(stage => stage.id === 'experience')?.status, 'pass');
assert.equal(decision({ confirmation: parsedLegacy.legacy }).status, 'not-verified');
assert.equal(decision({ confirmation: parsedLegacy.legacy }).canConfirm, true);

const parsedBound = parseExperienceConfirmations(JSON.stringify({ bound: confirmation }));
assert.equal(parsedBound.bound?.x4UiSnapshot?.deployedFingerprint, deployedFingerprint);
const malformedOptional = parseExperienceConfirmations(JSON.stringify({
  malformed: { ...legacyConfirmation, x4UiSnapshot: { ...boundSnapshot, deployedFingerprint: 'bad' } },
}));
assert.equal(malformedOptional.malformed?.x4UiSnapshot, undefined, 'malformed optional X4 evidence must not enter the global confirmation owner');
assert.equal(parseX4UiGameVerificationSnapshot({ ...boundSnapshot, deployedFingerprint: 'bad' }), null);
assert.equal(decision({ confirmation: null, currentSnapshot: null }).canConfirm, false);

console.log('X4UiGameVerification selftest: exact evidence and drift contract rows passed');
