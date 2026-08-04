import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { LEDGER_QUIET_ROUTES } from '../src/lib/agentHistory.js';
import type {
  ActionReceiptCoverageManifest,
  ActionReceiptCoverageRouteEntry,
  ActionReceiptCoverageSurfaceEntry,
  DiscoveredActionReceiptCoverageInventory,
  DiscoveredReceiptCoverageSurface,
  ReceiptCoverageEffect,
  ReceiptCoverageScope,
} from '../src/lib/actionReceiptCoverage.js';
import {
  ACTION_RECEIPT_COVERAGE_SCHEMA,
  validateActionReceiptCoverageManifest,
} from '../src/lib/actionReceiptCoverage.js';
import { FORGE_CAPABILITIES } from '../src/lib/forgeCapabilities.js';
import { atomicWriteFile } from '../src/lib/workspaceState.js';
import {
  buildDiscoveredActionReceiptCoverageInventory as buildInventoryFromAuthorities,
  getActionReceiptCoverageBuildAuthority,
  type ActionReceiptCoverageInventoryBuildResult,
  type RouteAuthorityMetadata,
  type SurfaceAuthorityMetadata,
} from '../src/lib/actionReceiptCoverageInventory.js';
import { ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256 } from '../src/lib/actionReceiptPolicyBundle.js';
import { runActionReceiptPolicyBundleSelftest } from '../src/lib/actionReceiptPolicyBundle.selftest.js';

export type { ActionReceiptCoverageInventoryBuildResult } from '../src/lib/actionReceiptCoverageInventory.js';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const TEST_RESULTS_ROOT = resolve(REPOSITORY_ROOT, 'test-results');
const CONFIG_ROOT = resolve(REPOSITORY_ROOT, 'config');
const REVIEWED_COVERAGE_PATH = resolve(CONFIG_ROOT, 'action-receipt-coverage.json');
const ROUTE_AUTHORITY_PATH = resolve(REPOSITORY_ROOT, 'config', 'forge-route-dispositions.json');
const DURABLE_AUTHORITY_PATH = resolve(REPOSITORY_ROOT, 'config', 'durable-writers.json');
const CAPABILITY_AUDIT_PATH = resolve(SCRIPT_DIRECTORY, 'capability-contract-audit.ts');
const DURABLE_AUDIT_PATH = resolve(SCRIPT_DIRECTORY, 'durable-writer-audit.mjs');
const PREREQUISITE_MAX_BUFFER = 4 * 1024 * 1024;
// Measured here at 177.7s standalone; allow five minutes under nested precommit load.
const PREREQUISITE_TIMEOUT_MS = 300_000;

type IntegrationBatch = 'W3B0-internal' | 'W3B1' | 'W3B2' | 'W3B3';

const LEGACY_REVIEW_REF = 'docs/plans/2026-08-02-w3b0-action-receipt-coverage.md#review';
export const ACTION_RECEIPT_COVERAGE_CANDIDATE_SCHEMA = 'forge.action-receipt-coverage-candidate.v1' as const;

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableError(code: string, detail: string): Error {
  return new Error(`${code}: ${detail}`);
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && error.code === 'ENOENT';
}

function candidatePathLstat(path: string, label: string): Stats | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if (isMissingPathError(error)) return undefined;
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_INSPECTION_FAILED',
      label,
    );
  }
}

function candidatePathRealpath(path: string, label: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_REALPATH_FAILED',
      label,
    );
  }
}

function isSameOrChildPath(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  if (relativePath === '') return true;
  return !isAbsolute(relativePath) && relativePath.split(sep)[0] !== '..';
}

function isStrictChildPath(root: string, candidate: string): boolean {
  return candidate !== root && isSameOrChildPath(root, candidate);
}

export function resolveActionReceiptCoverageCandidatePath(input: string): string {
  if (input.length === 0 || input !== input.trim() || input.includes('\0')) {
    throw stableError('ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_INVALID', 'nonempty trimmed path required');
  }
  if (!input.endsWith('.candidate.json')) {
    throw stableError('ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_SUFFIX', 'expected .candidate.json');
  }
  if (input.split(/[\\/]+/u).includes('..')) {
    throw stableError('ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_TRAVERSAL', 'parent traversal is forbidden');
  }

  const destination = resolve(REPOSITORY_ROOT, input);
  if (!isStrictChildPath(TEST_RESULTS_ROOT, destination)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_OUTSIDE_TEST_RESULTS',
      'destination must be under test-results',
    );
  }

  const repositoryStats = candidatePathLstat(REPOSITORY_ROOT, 'repository root');
  if (repositoryStats === undefined
    || repositoryStats.isSymbolicLink()
    || !repositoryStats.isDirectory()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_REPOSITORY_INVALID',
      'repository root must be a real directory',
    );
  }
  const testResultsStats = candidatePathLstat(TEST_RESULTS_ROOT, 'test-results root');
  if (testResultsStats === undefined
    || testResultsStats.isSymbolicLink()
    || !testResultsStats.isDirectory()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_TEST_RESULTS_INVALID',
      'test-results must be a real directory',
    );
  }

  const realRepositoryRoot = candidatePathRealpath(REPOSITORY_ROOT, 'repository root');
  const realTestResultsRoot = candidatePathRealpath(TEST_RESULTS_ROOT, 'test-results root');
  if (!isStrictChildPath(realRepositoryRoot, realTestResultsRoot)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_TEST_RESULTS_ESCAPE',
      'real test-results root must remain inside the real repository root',
    );
  }

  const parent = dirname(destination);
  const parentStats = candidatePathLstat(parent, 'candidate parent');
  if (parentStats === undefined) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_PARENT_MISSING',
      'candidate parent must already exist',
    );
  }
  if (parentStats.isSymbolicLink() || !parentStats.isDirectory()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_PARENT_NOT_DIRECTORY',
      'candidate parent must be a real directory',
    );
  }
  const realParent = candidatePathRealpath(parent, 'candidate parent');
  if (!isSameOrChildPath(realTestResultsRoot, realParent)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_PARENT_ESCAPE',
      'real candidate parent must remain inside real test-results',
    );
  }

  const targetStats = candidatePathLstat(destination, 'candidate target');
  if (targetStats?.isSymbolicLink()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_TARGET_LINK',
      'candidate target may not be a link',
    );
  }
  if (targetStats !== undefined && !targetStats.isFile()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_TARGET_NOT_FILE',
      'existing candidate target must be a regular file',
    );
  }
  return destination;
}

export interface ActionReceiptCoverageCandidatePathSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ActionReceiptCoverageCandidatePathSelftestResult {
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  resolvedPath: string;
  checks: ActionReceiptCoverageCandidatePathSelftestCheck[];
}

export function runActionReceiptCoverageCandidatePathSelftest(): ActionReceiptCoverageCandidatePathSelftestResult {
  const safeRelative = 'test-results/action-receipt-coverage-path-selftest.candidate.json';
  const safeAbsolute = resolve(REPOSITORY_ROOT, safeRelative);
  const outsideAbsolute = resolve(REPOSITORY_ROOT, '..', 'action-receipt-coverage.candidate.json');
  const inputs = [
    safeRelative,
    safeAbsolute,
    outsideAbsolute,
    'config/action-receipt-coverage.candidate.json',
    'test-results/../config/action-receipt-coverage.candidate.json',
    'test-results/2026-08-02-w3-action-receipts/w3b0/action-receipt-coverage.json',
    'test-results/2026-08-02-w3-action-receipts/w3b0/__missing-candidate-parent__/missing.candidate.json',
    '',
    ' ',
    'test-results/invalid\0.candidate.json',
  ];
  const inputBefore = JSON.stringify(inputs);
  const checks: ActionReceiptCoverageCandidatePathSelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: string): void => {
    checks.push({ name, pass, ...(detail === undefined ? {} : { detail }) });
  };
  const rejectsWith = (value: string, code: string): boolean => {
    try {
      resolveActionReceiptCoverageCandidatePath(value);
      return false;
    } catch (error) {
      return error instanceof Error && error.message.startsWith(`${code}:`);
    }
  };

  let relativeResult = '';
  let absoluteResult = '';
  try {
    relativeResult = resolveActionReceiptCoverageCandidatePath(safeRelative);
    absoluteResult = resolveActionReceiptCoverageCandidatePath(safeAbsolute);
  } catch (error) {
    check('candidate_path_safe_relative_and_absolute_match', false, error instanceof Error ? error.message : String(error));
  }
  if (checks.length === 0) {
    check(
      'candidate_path_safe_relative_and_absolute_match',
      relativeResult === safeAbsolute && absoluteResult === safeAbsolute,
    );
  }
  check(
    'candidate_path_resolution_repeats',
    relativeResult !== ''
      && resolveActionReceiptCoverageCandidatePath(safeRelative) === relativeResult,
  );
  check(
    'candidate_path_rejects_config_target',
    rejectsWith(
      'config/action-receipt-coverage.candidate.json',
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_OUTSIDE_TEST_RESULTS',
    ),
  );
  check(
    'candidate_path_rejects_traversal',
    rejectsWith(
      'test-results/../config/action-receipt-coverage.candidate.json',
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_TRAVERSAL',
    ),
  );
  check(
    'candidate_path_rejects_absolute_outside',
    rejectsWith(
      outsideAbsolute,
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_OUTSIDE_TEST_RESULTS',
    ),
  );
  check(
    'candidate_path_rejects_wrong_suffix',
    rejectsWith(
      'test-results/2026-08-02-w3-action-receipts/w3b0/action-receipt-coverage.json',
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_SUFFIX',
    ),
  );
  check(
    'candidate_path_rejects_missing_parent',
    rejectsWith(
      'test-results/2026-08-02-w3-action-receipts/w3b0/__missing-candidate-parent__/missing.candidate.json',
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_PARENT_MISSING',
    ),
  );
  check(
    'candidate_path_rejects_blank_and_nul',
    rejectsWith('', 'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_INVALID')
      && rejectsWith(' ', 'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_INVALID')
      && rejectsWith(
        'test-results/invalid\0.candidate.json',
        'ACTION_RECEIPT_COVERAGE_CANDIDATE_PATH_INVALID',
      ),
  );
  check('candidate_path_inputs_unchanged', inputBefore === JSON.stringify(inputs));

  const failures = checks.filter(entry => !entry.pass).map(entry => entry.name);
  return {
    pass: failures.length === 0,
    passed: checks.length - failures.length,
    total: checks.length,
    failures,
    resolvedPath: relativeResult,
    checks,
  };
}

function runPrerequisiteAudit(label: string, args: readonly string[]): Promise<void> {
  return new Promise((accept, reject) => {
    execFile(process.execPath, [...args], {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      maxBuffer: PREREQUISITE_MAX_BUFFER,
      shell: false,
      timeout: PREREQUISITE_TIMEOUT_MS,
      windowsHide: true,
    }, error => {
      if (error === null) {
        accept();
        return;
      }
      const execError = error as NodeJS.ErrnoException & {
        code?: string | number;
        killed?: boolean;
      };
      const code = execError.code;
      if (execError.killed === true || code === 'ETIMEDOUT') {
        reject(stableError(
          'ACTION_RECEIPT_COVERAGE_PREREQUISITE_TIMEOUT',
          `${label}:timeout`,
        ));
        return;
      }
      if (code === 'ENOENT' || code === 'EACCES' || code === 'EPERM') {
        reject(stableError('ACTION_RECEIPT_COVERAGE_PREREQUISITE_START_FAILED', `${label}:${code}`));
        return;
      }
      reject(stableError(
        'ACTION_RECEIPT_COVERAGE_PREREQUISITE_NONZERO',
        `${label}:exit=${typeof code === 'number' ? code : 'unknown'}`,
      ));
    });
  });
}

export async function runActionReceiptCoveragePrerequisiteAudits(): Promise<void> {
  let tsxCliPath: string;
  try {
    tsxCliPath = createRequire(import.meta.url).resolve('tsx/cli');
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_PREREQUISITE_START_FAILED',
      'capability-contract-audit:tsx-cli-unavailable',
    );
  }
  await runPrerequisiteAudit('capability-contract-audit', [tsxCliPath, CAPABILITY_AUDIT_PATH]);
  await runPrerequisiteAudit('durable-writer-audit', [DURABLE_AUDIT_PATH]);
}

function readJsonAuthority(path: string, label: string): unknown {
  let bytes: string;
  try {
    bytes = readFileSync(path, 'utf8');
  } catch {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_READ_FAILED', label);
  }
  try {
    return JSON.parse(bytes) as unknown;
  } catch {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_JSON_INVALID', label);
  }
}

export function buildDiscoveredActionReceiptCoverageInventory(): ActionReceiptCoverageInventoryBuildResult {
  return buildInventoryFromAuthorities({
    routeAuthority: readJsonAuthority(ROUTE_AUTHORITY_PATH, 'forge-route-dispositions'),
    durableWriterAuthority: readJsonAuthority(DURABLE_AUTHORITY_PATH, 'durable-writers'),
    capabilities: FORGE_CAPABILITIES,
    quietRoutes: LEDGER_QUIET_ROUTES,
  });
}

type CandidateRoutePolicy = Pick<
  ActionReceiptCoverageRouteEntry,
  'semanticClass' | 'policy' | 'effects' | 'integrationBatch'
>;
type CandidateSurfacePolicy = Pick<
  ActionReceiptCoverageSurfaceEntry,
  'semanticClass' | 'policy' | 'effects' | 'integrationBatch'
>;

function routePolicy(
  semanticClass: ActionReceiptCoverageRouteEntry['semanticClass'],
  policy: ActionReceiptCoverageRouteEntry['policy'],
  effects: ReceiptCoverageEffect[],
  integrationBatch: IntegrationBatch,
): CandidateRoutePolicy {
  return { semanticClass, policy, effects, integrationBatch };
}

function surfacePolicy(
  semanticClass: ActionReceiptCoverageSurfaceEntry['semanticClass'],
  policy: ActionReceiptCoverageSurfaceEntry['policy'],
  effects: ReceiptCoverageEffect[],
  integrationBatch: IntegrationBatch,
): CandidateSurfacePolicy {
  return { semanticClass, policy, effects, integrationBatch };
}

function readOnlyRoutePolicy(): CandidateRoutePolicy {
  return routePolicy('read-analysis-only', 'receipt-exempt', ['read', 'analyze'], 'W3B0-internal');
}

function auditedReadRoutePolicy(): CandidateRoutePolicy {
  return routePolicy(
    'audit-retention',
    'separately-governed',
    ['read', 'analyze', 'audit-write', 'audit-retention-delete'],
    'W3B0-internal',
  );
}

function durableRoutePolicy(
  effects: ReceiptCoverageEffect[],
  integrationBatch: Extract<IntegrationBatch, 'W3B1' | 'W3B2'> = 'W3B1',
): CandidateRoutePolicy {
  return routePolicy('durable-local-mutation', 'receipt-required', effects, integrationBatch);
}

function sessionRoutePolicy(effect: Extract<ReceiptCoverageEffect, 'credential' | 'session-write'>): CandidateRoutePolicy {
  return routePolicy('session-credential-mutation', 'receipt-required', [effect], 'W3B1');
}

function externalRoutePolicy(
  semanticClass: Extract<
    ActionReceiptCoverageRouteEntry['semanticClass'],
    'external-network' | 'external-spend' | 'external-publish'
  >,
  effects: ReceiptCoverageEffect[],
): CandidateRoutePolicy {
  return routePolicy(semanticClass, 'receipt-required', effects, 'W3B3');
}

function conditionalRefusal(effects: ReceiptCoverageEffect[] = ['read']): CandidateRoutePolicy {
  return routePolicy('conditional-dev-only', 'refused', effects, 'W3B0-internal');
}

function canonicalRoutePolicy(route: DiscoveredActionReceiptCoverageInventory['routes'][number]): CandidateRoutePolicy {
  const effects = [...route.canonicalCapability!.effects];
  const effectSet = new Set<ReceiptCoverageEffect>(effects);
  if (effectSet.has('spend') && effectSet.has('network')) {
    return externalRoutePolicy('external-spend', effects);
  }
  if (effectSet.has('publish')) {
    return externalRoutePolicy('external-publish', effects);
  }
  if (effectSet.has('network')) {
    return externalRoutePolicy('external-network', effects);
  }
  if (effectSet.has('credential')) {
    return routePolicy('session-credential-mutation', 'receipt-required', effects, 'W3B1');
  }
  const durableEffects = ['workspace-write', 'filesystem-write', 'package', 'deploy', 'delete'] as const;
  if (durableEffects.some(effect => effectSet.has(effect))) {
    const releaseOrDeploy = /\b(?:package|deploy|artifact|release)\b/.test(route.routeKey);
    return durableRoutePolicy(effects, releaseOrDeploy ? 'W3B2' : 'W3B1');
  }
  const auditEffects = new Set<ReceiptCoverageEffect>([
    'read',
    'analyze',
    'audit-write',
    'audit-retention-delete',
  ]);
  if (effects.every(effect => auditEffects.has(effect))
    && (effectSet.has('audit-write') || effectSet.has('audit-retention-delete'))) {
    return routePolicy('audit-retention', 'separately-governed', effects, 'W3B0-internal');
  }
  if (effects.every(effect => effect === 'read' || effect === 'analyze')) {
    return routePolicy('read-analysis-only', 'receipt-exempt', effects, 'W3B0-internal');
  }
  return conditionalRefusal(effects);
}

const QUIET_READ_OVERRIDE_ROUTES = new Set([
  'POST /api/agent/bulk-transform/preview',
  'POST /api/agent/live/cue-telemetry',
  'POST /api/agent/project-rules/prepare-suppression',
  'POST /api/agent/project/validate-crossfile',
  'POST /api/agent/round-trip-check',
  'POST /api/agent/xpath-synth',
]);

const VISIBLE_READ_OVERRIDE_ROUTES = new Set([
  'POST /api/agent/mod-folder/import',
  'POST /api/agent/project/content-xml',
  'POST /api/agent/project/create',
  'POST /api/agent/project/file/create',
  'POST /api/agent/project/files',
  'POST /api/agent/project/generate',
  'POST /api/agent/project/validate',
  'POST /api/agent/workspace/restore-parked',
  'POST /api/agent/workspaces/bootstrap',
]);

const PACKAGE_ROUTES = new Set([
  'POST /api/agent/artifact/build',
  'POST /api/agent/package',
  'POST /api/agent/package/release',
  'POST /api/agent/project/package',
  'POST /api/agent/release/nexus/prepare',
  'POST /api/agent/release/steam/adopt',
  'POST /api/agent/release/steam/prepare',
]);

const WORKSPACE_WRITE_ROUTES = new Set([
  'POST /api/agent/bulk-transform/apply',
  'POST /api/agent/workspace',
  'POST /api/agent/workspace/merge',
  'POST /api/agent/workspaces',
]);

const FILE_WRITE_ROUTES = new Set([
  'POST /api/agent/lua-staleness/instrument',
  'POST /api/fs/create',
  'POST /api/fs/write',
]);

const SESSION_WRITE_ROUTES = new Set([
  'POST /api/agent/external-api/register',
]);

const CREDENTIAL_ROUTES = new Set([
  'DELETE /api/github/credential',
  'POST /api/agent/keys',
  'POST /api/agent/keys/revoke',
  'POST /api/ai/keys',
  'POST /api/github/credential',
]);

const GITHUB_PUBLISH_ROUTES = new Set([
  'POST /api/github/create',
  'POST /api/github/push',
]);

function legacyRoutePolicy(
  route: DiscoveredActionReceiptCoverageInventory['routes'][number],
): CandidateRoutePolicy {
  if (route.routeKey === 'POST /api/agent/generate') {
    return externalRoutePolicy('external-spend', ['network', 'spend', 'workspace-write']);
  }
  if (route.resourceClass === 'provider-network') {
    return externalRoutePolicy('external-spend', ['network', 'spend']);
  }
  if (GITHUB_PUBLISH_ROUTES.has(route.routeKey)) {
    return externalRoutePolicy('external-publish', ['network', 'publish']);
  }
  if (route.routeKey === 'POST /api/github/device/poll') {
    return externalRoutePolicy('external-network', ['network', 'credential']);
  }
  if (CREDENTIAL_ROUTES.has(route.routeKey)) {
    const destructiveCredentialRoute = route.routeKey === 'DELETE /api/github/credential'
      || route.routeKey === 'POST /api/agent/keys/revoke'
      || route.routeKey === 'POST /api/ai/keys';
    return routePolicy(
      'session-credential-mutation',
      'receipt-required',
      destructiveCredentialRoute ? ['credential', 'delete'] : ['credential'],
      'W3B1',
    );
  }
  if (route.resourceClass === 'external-repository') {
    return externalRoutePolicy('external-network', ['network']);
  }
  if (route.resourceClass === 'command-session') {
    return routePolicy('external-process', 'refused', ['process'], 'W3B3');
  }
  if (QUIET_READ_OVERRIDE_ROUTES.has(route.routeKey)) return readOnlyRoutePolicy();
  if (VISIBLE_READ_OVERRIDE_ROUTES.has(route.routeKey)) return auditedReadRoutePolicy();
  if (route.routeKey === 'POST /api/agent/deploy-verify') {
    return durableRoutePolicy(['filesystem-write', 'deploy', 'delete'], 'W3B2');
  }
  if (route.routeKey === 'POST /api/agent/release/steam/verify') {
    return durableRoutePolicy(['filesystem-write', 'package'], 'W3B2');
  }
  if (route.routeKey === 'POST /api/agent/release/artifact/download'
    || route.routeKey === 'POST /api/agent/release/export/receipt') {
    return routePolicy('external-publish', 'receipt-required', ['publish'], 'W3B2');
  }
  if (PACKAGE_ROUTES.has(route.routeKey)) {
    return durableRoutePolicy(['filesystem-write', 'package'], 'W3B2');
  }
  if (route.routeKey === 'POST /api/agent/deploy') {
    return durableRoutePolicy(['filesystem-write', 'deploy', 'delete'], 'W3B2');
  }
  if (route.routeKey === 'POST /api/agent/project-rules/suppress') {
    return durableRoutePolicy(['filesystem-write']);
  }
  if (route.routeKey === 'POST /api/agent/setup/harvest-schemas') {
    return durableRoutePolicy(['filesystem-write'], 'W3B2');
  }
  if (route.routeKey === 'POST /api/schema/config'
    || route.routeKey === 'POST /api/studio/layout'
    || route.routeKey === 'POST /api/studio/release-preferences') {
    return durableRoutePolicy(['filesystem-write', 'session-write']);
  }
  if (WORKSPACE_WRITE_ROUTES.has(route.routeKey)) return durableRoutePolicy(['workspace-write']);
  if (FILE_WRITE_ROUTES.has(route.routeKey)) return durableRoutePolicy(['filesystem-write']);
  if (route.routeKey === 'POST /api/fs/delete-dir'
    || route.routeKey === 'POST /api/fs/delete-snapshot') {
    return durableRoutePolicy(['filesystem-write', 'delete']);
  }
  if (route.routeKey === 'POST /api/fs/restore-snapshot') {
    return durableRoutePolicy(['workspace-write']);
  }
  if (route.routeKey === 'POST /api/fs/snapshot') {
    return durableRoutePolicy(['filesystem-write', 'delete']);
  }
  if (SESSION_WRITE_ROUTES.has(route.routeKey)) return sessionRoutePolicy('session-write');
  if (route.history === 'none'
    || ((route.resourceClass === 'stateless-analysis' || route.resourceClass === 'host-file-read')
      && route.history === 'quiet')) {
    return readOnlyRoutePolicy();
  }
  if (route.resourceClass === 'stateless-analysis' || route.resourceClass === 'host-file-read') {
    return auditedReadRoutePolicy();
  }
  return conditionalRefusal();
}

function deriveAuthorityScopes(
  route: DiscoveredActionReceiptCoverageInventory['routes'][number],
  metadata: RouteAuthorityMetadata | undefined,
): ReceiptCoverageScope[] {
  if (metadata?.workspaceMode === 'none') return ['global'];
  if (metadata?.workspaceMode === 'required' || route.resourceClass === 'workspace') return ['workspace'];
  if (route.resourceClass === 'global-session'
    || route.resourceClass === 'cross-workspace-session'
    || route.resourceClass === 'command-session'
    || route.resourceClass === 'stateless-analysis') {
    return ['global'];
  }
  if (route.resourceClass === 'provider-network') {
    return metadata?.workspaceMode === 'input-first'
      ? ['global', 'profile', 'workspace']
      : ['global', 'profile'];
  }
  if (route.resourceClass === 'external-repository') {
    const globalCredentialFlow = CREDENTIAL_ROUTES.has(route.routeKey)
      || route.routeKey === 'POST /api/github/device/start'
      || route.routeKey === 'POST /api/github/device/poll';
    return globalCredentialFlow
      ? ['global', 'profile']
      : ['global', 'profile', 'workspace'];
  }
  if (metadata?.workspaceMode === 'input-first') return ['global', 'workspace'];
  return ['global', 'profile', 'workspace'];
}

const AUDIT_WRITE_ONLY_SURFACES = new Set([
  'filesystem-writer:src/lib/actionReceiptStore.ts',
  'filesystem-writer:src/lib/validationDelta.ts',
]);

const AUDIT_RETENTION_SURFACES = new Set([
  'filesystem-writer:src/lib/agentHistoryStore.ts',
]);

const ARTIFACT_MATERIALIZER_SURFACES = new Set([
  'filesystem-writer:src/lib/artifactPackager.ts',
  'filesystem-writer:src/lib/artifactPipeline.ts',
  'filesystem-writer:src/lib/x4CatDat.ts',
]);

const CREDENTIAL_DELETE_SURFACES = new Set([
  'filesystem-writer:src/lib/agentKeys.ts',
  'filesystem-writer:src/server/aiKeyStore.ts',
  'filesystem-writer:src/server/githubCredentialStore.ts',
]);

function defaultSurfacePolicy(
  surface: DiscoveredReceiptCoverageSurface,
  authority: SurfaceAuthorityMetadata | undefined,
): CandidateSurfacePolicy {
  const categories = new Set(authority?.categories ?? []);
  const identity = `${surface.id} ${surface.owner}`.toLowerCase();
  if (surface.kind === 'browser-output') {
    return surfacePolicy('external-publish', 'receipt-required', ['publish'], 'W3B2');
  }
  if (surface.id === 'filesystem-writer:server.ts') {
    return surfacePolicy(
      'durable-local-mutation',
      'receipt-required',
      ['workspace-write', 'filesystem-write', 'package', 'deploy', 'delete', 'session-write'],
      'W3B1',
    );
  }
  if (surface.id === 'filesystem-writer:src/lib/destructiveRecovery.ts'
    || surface.id === 'filesystem-writer:src/lib/instanceDiscovery.ts') {
    return surfacePolicy(
      'fixture-cache',
      'separately-governed',
      ['filesystem-write', 'delete'],
      'W3B0-internal',
    );
  }
  if (surface.id === 'filesystem-writer:vscode-extension/src/extension.ts') {
    return surfacePolicy(
      'external-process',
      'receipt-required',
      ['process', 'filesystem-write'],
      'W3B3',
    );
  }
  if (surface.id === 'filesystem-writer:src/server/gameDetectRoutes.ts') {
    return surfacePolicy('durable-local-mutation', 'receipt-required', ['filesystem-write'], 'W3B2');
  }
  if (AUDIT_WRITE_ONLY_SURFACES.has(surface.id)) {
    return surfacePolicy('audit-retention', 'separately-governed', ['audit-write'], 'W3B0-internal');
  }
  if (AUDIT_RETENTION_SURFACES.has(surface.id)) {
    return surfacePolicy(
      'audit-retention',
      'separately-governed',
      ['audit-write', 'audit-retention-delete'],
      'W3B0-internal',
    );
  }
  if (ARTIFACT_MATERIALIZER_SURFACES.has(surface.id)) {
    return surfacePolicy(
      'durable-local-mutation',
      'receipt-required',
      ['filesystem-write', 'package'],
      'W3B2',
    );
  }
  if (surface.id === 'filesystem-writer:vscode-extension/src/nativeEditorBridge.ts') {
    return surfacePolicy(
      'external-publish',
      'receipt-required',
      ['filesystem-write', 'delete', 'publish'],
      'W3B2',
    );
  }
  if (surface.id === 'filesystem-writer:src/lib/workspaceState.ts') {
    return surfacePolicy(
      'durable-local-mutation',
      'receipt-required',
      ['filesystem-write', 'delete'],
      'W3B1',
    );
  }
  if (surface.id === 'filesystem-writer:src/lib/workspaceRegistry.ts') {
    return surfacePolicy(
      'durable-local-mutation',
      'receipt-required',
      ['workspace-write', 'filesystem-write'],
      'W3B1',
    );
  }
  if (surface.id === 'filesystem-writer:src/lib/xsdParser.ts') {
    return surfacePolicy(
      'durable-local-mutation',
      'receipt-required',
      ['filesystem-write', 'session-write'],
      'W3B1',
    );
  }
  if (CREDENTIAL_DELETE_SURFACES.has(surface.id)) {
    return surfacePolicy(
      'session-credential-mutation',
      'receipt-required',
      ['credential', 'delete'],
      'W3B1',
    );
  }
  if (surface.id === 'host-store:src/components/AIConnectionModal.tsx'
    || surface.id === 'host-store:src/components/SourceControl.tsx'
    || surface.id === 'host-store:src/lib/apiHelper.ts'
    || surface.id === 'host-store:src/main.tsx') {
    return surfacePolicy(
      'session-credential-mutation',
      'receipt-required',
      ['credential', 'session-write', 'delete'],
      'W3B1',
    );
  }
  if (surface.id === 'host-store:src/components/XMLPatchSystem.tsx') {
    return surfacePolicy('session-credential-mutation', 'receipt-required', ['session-write'], 'W3B1');
  }
  if (/credential|keystore|agentkeys/.test(identity)) {
    return surfacePolicy('session-credential-mutation', 'receipt-required', ['credential'], 'W3B1');
  }
  if (categories.has('browser-preference')
    || categories.has('browser-session')
    || categories.has('extension-global-state')) {
    return surfacePolicy('session-credential-mutation', 'receipt-required', ['session-write'], 'W3B1');
  }
  if (categories.has('verified-release-export')) {
    return surfacePolicy(
      'external-publish',
      'receipt-required',
      ['filesystem-write', 'delete', 'publish'],
      'W3B2',
    );
  }
  if (categories.has('isolated-artifact-stage')) {
    return surfacePolicy(
      'durable-local-mutation',
      'receipt-required',
      ['filesystem-write', 'package'],
      'W3B2',
    );
  }
  if (categories.has('extension-workspace-atomic')) {
    return surfacePolicy(
      'durable-local-mutation',
      'receipt-required',
      ['workspace-write', 'filesystem-write'],
      'W3B1',
    );
  }
  const cacheOnlyCategories = new Set(['fixture-only', 'browser-cache', 'sqlite-transaction']);
  if (categories.size > 0 && [...categories].every(category => cacheOnlyCategories.has(category))) {
    const effect: ReceiptCoverageEffect = surface.kind === 'host-store' ? 'session-write' : 'filesystem-write';
    return surfacePolicy(
      'fixture-cache',
      surface.kind === 'sqlite' ? 'separately-governed' : 'receipt-exempt',
      [effect],
      'W3B0-internal',
    );
  }
  if (surface.kind === 'host-store') {
    return surfacePolicy('session-credential-mutation', 'receipt-required', ['session-write'], 'W3B1');
  }
  return surfacePolicy('durable-local-mutation', 'receipt-required', ['filesystem-write'], 'W3B1');
}

export function buildActionReceiptCoverageCandidate(
  buildResult: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageManifest {
  const metadata = getActionReceiptCoverageBuildAuthority(buildResult);
  const routes = buildResult.inventory.routes.map(discovered => {
    const defaults = discovered.canonicalCapability === undefined
      ? legacyRoutePolicy(discovered)
      : canonicalRoutePolicy(discovered);
    const candidate: ActionReceiptCoverageRouteEntry = {
      routeKey: discovered.routeKey,
      method: discovered.method,
      template: discovered.template,
      owner: discovered.owner,
      resourceClass: discovered.resourceClass,
      sourceRef: discovered.sourceRef,
      integrationBatch: defaults.integrationBatch,
      history: discovered.history,
      capability: discovered.canonicalCapability === undefined
        ? {
          kind: 'reviewed-legacy',
          id: discovered.routeKey,
          reviewRef: LEGACY_REVIEW_REF,
        }
        : {
          kind: 'canonical',
          id: discovered.canonicalCapability.id,
          version: discovered.canonicalCapability.version,
        },
      semanticClass: defaults.semanticClass,
      policy: defaults.policy,
      effects: [...defaults.effects],
      authorityScopes: deriveAuthorityScopes(discovered, metadata?.routes.get(discovered.routeKey)),
    };
    return candidate;
  }).sort((left, right) => compareOrdinal(left.routeKey, right.routeKey));

  const surfaces = buildResult.inventory.surfaces.map(discovered => {
    const defaults = defaultSurfacePolicy(discovered, metadata?.surfaces.get(discovered.id));
    const candidate: ActionReceiptCoverageSurfaceEntry = {
      id: discovered.id,
      kind: discovered.kind,
      owner: discovered.owner,
      sourceRef: discovered.sourceRef,
      integrationBatch: defaults.integrationBatch,
      semanticClass: defaults.semanticClass,
      policy: defaults.policy,
      effects: [...defaults.effects],
      authorityScopes: ['global', 'profile', 'workspace'],
    };
    return candidate;
  }).sort((left, right) => compareOrdinal(left.id, right.id));

  const candidate: ActionReceiptCoverageManifest = {
    schema: ACTION_RECEIPT_COVERAGE_SCHEMA,
    routes,
    surfaces,
  };
  const validation = validateActionReceiptCoverageManifest(candidate, buildResult.inventory);
  if (!validation.ok) {
    const detail = validation.errors.map(error => `${error.code}@${error.path}`).join('|');
    throw stableError('ACTION_RECEIPT_COVERAGE_CANDIDATE_INVALID', detail);
  }
  return candidate;
}

export interface ActionReceiptCoverageCandidateEnvelope {
  schema: typeof ACTION_RECEIPT_COVERAGE_CANDIDATE_SCHEMA;
  status: 'UNREVIEWED';
  inventoryHash: string;
  manifestHash: string;
  routeCount: number;
  surfaceCount: number;
  manifest: ActionReceiptCoverageManifest;
}

function prettyLfJsonBytes(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Utf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function buildActionReceiptCoverageCandidateEnvelope(
  buildResult: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageCandidateEnvelope {
  const manifest = buildActionReceiptCoverageCandidate(buildResult);
  return {
    schema: ACTION_RECEIPT_COVERAGE_CANDIDATE_SCHEMA,
    status: 'UNREVIEWED',
    inventoryHash: sha256Utf8(prettyLfJsonBytes(buildResult.inventory)),
    manifestHash: sha256Utf8(prettyLfJsonBytes(manifest)),
    routeCount: buildResult.nonGetRouteCount,
    surfaceCount: Object.values(buildResult.surfaceCounts)
      .reduce((total, count) => total + count, 0),
    manifest,
  };
}

export function buildActionReceiptCoverageCandidateEnvelopeBytes(
  buildResult: ActionReceiptCoverageInventoryBuildResult,
): string {
  return prettyLfJsonBytes(buildActionReceiptCoverageCandidateEnvelope(buildResult));
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SHA256_INPUT_PATTERN = /^[0-9a-fA-F]{64}$/u;
const CANDIDATE_ENVELOPE_FIELDS = [
  'schema',
  'status',
  'inventoryHash',
  'manifestHash',
  'routeCount',
  'surfaceCount',
  'manifest',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactOrderedFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((key, index) => key === fields[index]);
}

function decodeCandidateEnvelopeBytes(bytes: string | Buffer): string {
  if (typeof bytes === 'string') return bytes;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_UTF8_INVALID',
      'candidate bytes must be valid UTF-8',
    );
  }
}

export function parseActionReceiptCoverageExpectedSha256(value: string): string {
  if (!SHA256_INPUT_PATTERN.test(value)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_EXPECTED_SHA256_INVALID',
      'expected SHA-256 must be exactly 64 hexadecimal characters',
    );
  }
  return value.toLowerCase();
}

export type ActionReceiptCoverageExpectedCurrentReviewed =
  | { state: 'absent' }
  | { state: 'sha256'; sha256: string };

export function parseActionReceiptCoverageExpectedCurrentReviewed(
  value: string,
): ActionReceiptCoverageExpectedCurrentReviewed {
  if (value === 'ABSENT') return { state: 'absent' };
  if (!SHA256_INPUT_PATTERN.test(value)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_EXPECTED_CURRENT_INVALID',
      'expected current reviewed value must be ABSENT or a 64-character SHA-256',
    );
  }
  return { state: 'sha256', sha256: value.toLowerCase() };
}

export function requireActionReceiptCoverageCandidateSha256(
  bytes: string | Buffer,
  expectedSha256: string,
): string {
  const expected = parseActionReceiptCoverageExpectedSha256(expectedSha256);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_SHA256_MISMATCH',
      'candidate bytes do not match the explicitly supplied SHA-256',
    );
  }
  return actual;
}

export function parseActionReceiptCoverageCandidateEnvelope(
  bytes: string | Buffer,
  buildResult: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageCandidateEnvelope {
  const text = decodeCandidateEnvelopeBytes(bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_JSON_INVALID',
      'candidate envelope must be valid JSON',
    );
  }
  if (!isPlainObject(parsed) || !hasExactOrderedFields(parsed, CANDIDATE_ENVELOPE_FIELDS)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_FIELDS_INVALID',
      'candidate envelope fields must exactly match the v1 contract',
    );
  }
  if (parsed.schema !== ACTION_RECEIPT_COVERAGE_CANDIDATE_SCHEMA) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_SCHEMA_INVALID',
      'candidate envelope schema is not supported',
    );
  }
  if (parsed.status !== 'UNREVIEWED') {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_STATUS_INVALID',
      'candidate envelope status must be UNREVIEWED',
    );
  }
  if (typeof parsed.inventoryHash !== 'string'
    || !SHA256_PATTERN.test(parsed.inventoryHash)
    || typeof parsed.manifestHash !== 'string'
    || !SHA256_PATTERN.test(parsed.manifestHash)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_HASH_INVALID',
      'candidate envelope hashes must be lowercase SHA-256 values',
    );
  }
  if (!Number.isSafeInteger(parsed.routeCount)
    || (parsed.routeCount as number) < 0
    || !Number.isSafeInteger(parsed.surfaceCount)
    || (parsed.surfaceCount as number) < 0) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_COUNT_INVALID',
      'candidate envelope counts must be nonnegative safe integers',
    );
  }
  if (text !== prettyLfJsonBytes(parsed)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_NONCANONICAL',
      'candidate envelope must use canonical pretty JSON with one LF',
    );
  }

  const manifestValidation = validateActionReceiptCoverageManifest(
    parsed.manifest,
    buildResult.inventory,
  );
  if (!manifestValidation.ok) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_MANIFEST_INVALID',
      'candidate inner manifest does not validate against current inventory',
    );
  }
  const manifest = parsed.manifest as ActionReceiptCoverageManifest;
  if (parsed.manifestHash !== sha256Utf8(prettyLfJsonBytes(manifest))) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_MANIFEST_HASH_MISMATCH',
      'candidate inner manifest hash does not match',
    );
  }
  if (parsed.inventoryHash !== sha256Utf8(prettyLfJsonBytes(buildResult.inventory))) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_INVENTORY_HASH_MISMATCH',
      'candidate inventory hash does not match current inventory',
    );
  }
  const expectedSurfaceCount = Object.values(buildResult.surfaceCounts)
    .reduce((total, count) => total + count, 0);
  if (parsed.routeCount !== buildResult.nonGetRouteCount
    || parsed.surfaceCount !== expectedSurfaceCount
    || manifest.routes.length !== parsed.routeCount
    || manifest.surfaces.length !== parsed.surfaceCount) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_COUNT_MISMATCH',
      'candidate counts do not match current inventory and manifest',
    );
  }
  return {
    schema: ACTION_RECEIPT_COVERAGE_CANDIDATE_SCHEMA,
    status: 'UNREVIEWED',
    inventoryHash: parsed.inventoryHash,
    manifestHash: parsed.manifestHash,
    routeCount: parsed.routeCount as number,
    surfaceCount: parsed.surfaceCount as number,
    manifest,
  };
}

export function requireFreshActionReceiptCoverageCandidateEnvelope(
  bytes: string | Buffer,
  buildResult: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageCandidateEnvelope {
  const envelope = parseActionReceiptCoverageCandidateEnvelope(bytes, buildResult);
  const text = decodeCandidateEnvelopeBytes(bytes);
  if (text !== buildActionReceiptCoverageCandidateEnvelopeBytes(buildResult)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_STALE',
      'candidate envelope does not exactly match the current generated envelope',
    );
  }
  return envelope;
}

export interface ActionReceiptCoverageCandidateEnvelopeSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ActionReceiptCoverageCandidateEnvelopeSelftestResult {
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  envelopeHash: string;
  routeCount: number;
  surfaceCount: number;
  checks: ActionReceiptCoverageCandidateEnvelopeSelftestCheck[];
}

export function runActionReceiptCoverageCandidateEnvelopeSelftest(
  suppliedBuildResult?: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageCandidateEnvelopeSelftestResult {
  const buildResult = suppliedBuildResult ?? buildDiscoveredActionReceiptCoverageInventory();
  const metadata = getActionReceiptCoverageBuildAuthority(buildResult);
  const inputBefore = JSON.stringify({
    public: buildResult,
    routeAuthority: metadata === undefined ? [] : [...metadata.routes],
    surfaceAuthority: metadata === undefined ? [] : [...metadata.surfaces],
  });
  const firstEnvelope = buildActionReceiptCoverageCandidateEnvelope(buildResult);
  const firstBytes = prettyLfJsonBytes(firstEnvelope);
  const secondBytes = buildActionReceiptCoverageCandidateEnvelopeBytes(buildResult);
  const firstEnvelopeHash = sha256Utf8(firstBytes);
  const secondEnvelopeHash = sha256Utf8(secondBytes);
  const expectedSurfaceCount = Object.values(buildResult.surfaceCounts)
    .reduce((total, count) => total + count, 0);
  const reviewedValidation = validateActionReceiptCoverageManifest(
    firstEnvelope as unknown,
    buildResult.inventory,
  );
  const inputAfter = JSON.stringify({
    public: buildResult,
    routeAuthority: metadata === undefined ? [] : [...metadata.routes],
    surfaceAuthority: metadata === undefined ? [] : [...metadata.surfaces],
  });
  const checks: ActionReceiptCoverageCandidateEnvelopeSelftestCheck[] = [
    {
      name: 'candidate_envelope_bytes_and_hash_repeat',
      pass: firstBytes === secondBytes && firstEnvelopeHash === secondEnvelopeHash,
    },
    {
      name: 'candidate_envelope_payload_hashes_match',
      pass: firstEnvelope.inventoryHash === sha256Utf8(prettyLfJsonBytes(buildResult.inventory))
        && firstEnvelope.manifestHash === sha256Utf8(prettyLfJsonBytes(firstEnvelope.manifest)),
    },
    {
      name: 'candidate_envelope_counts_match_dynamic_inventory',
      pass: firstEnvelope.routeCount === buildResult.nonGetRouteCount
        && firstEnvelope.surfaceCount === expectedSurfaceCount
        && firstEnvelope.manifest.routes.length === buildResult.nonGetRouteCount
        && firstEnvelope.manifest.surfaces.length === expectedSurfaceCount,
      detail: `candidate=${firstEnvelope.routeCount}/${firstEnvelope.surfaceCount};inventory=${buildResult.nonGetRouteCount}/${expectedSurfaceCount}`,
    },
    {
      name: 'candidate_envelope_is_not_reviewed_authority',
      pass: !reviewedValidation.ok,
    },
    {
      name: 'candidate_envelope_input_unchanged',
      pass: inputBefore === inputAfter,
    },
  ];
  const failures = checks.filter(check => !check.pass).map(check => check.name);
  return {
    pass: failures.length === 0,
    passed: checks.length - failures.length,
    total: checks.length,
    failures,
    envelopeHash: firstEnvelopeHash,
    routeCount: firstEnvelope.routeCount,
    surfaceCount: firstEnvelope.surfaceCount,
    checks,
  };
}

export interface ActionReceiptCoverageCandidateRegularFileFingerprint {
  device: string;
  inode: string;
  mode: string;
  links: string;
  size: string;
  modifiedNs: string;
  changedNs: string;
  sha256: string;
}

export type ActionReceiptCoverageCandidateTargetSnapshot =
  | { state: 'absent' }
  | { state: 'regular-file'; fingerprint: ActionReceiptCoverageCandidateRegularFileFingerprint };

function candidateTargetStatIdentity(stats: import('node:fs').BigIntStats): Omit<
  ActionReceiptCoverageCandidateRegularFileFingerprint,
  'sha256'
> {
  return {
    device: stats.dev.toString(),
    inode: stats.ino.toString(),
    mode: stats.mode.toString(),
    links: stats.nlink.toString(),
    size: stats.size.toString(),
    modifiedNs: stats.mtimeNs.toString(),
    changedNs: stats.ctimeNs.toString(),
  };
}

function snapshotResolvedCandidateTarget(
  destination: string,
): ActionReceiptCoverageCandidateTargetSnapshot {
  let before: import('node:fs').BigIntStats;
  try {
    before = lstatSync(destination, { bigint: true });
  } catch (error) {
    if (isMissingPathError(error)) return { state: 'absent' };
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_SNAPSHOT_FAILED',
      'unable to inspect candidate target',
    );
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_SNAPSHOT_INVALID_TARGET',
      'candidate target must be a regular file',
    );
  }

  let bytes: Buffer;
  let after: import('node:fs').BigIntStats;
  try {
    bytes = readFileSync(destination);
    after = lstatSync(destination, { bigint: true });
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_SNAPSHOT_UNSTABLE',
      'candidate target changed while snapshotting',
    );
  }
  const beforeIdentity = candidateTargetStatIdentity(before);
  const afterIdentity = candidateTargetStatIdentity(after);
  if (after.isSymbolicLink()
    || !after.isFile()
    || JSON.stringify(beforeIdentity) !== JSON.stringify(afterIdentity)
    || BigInt(bytes.byteLength) !== after.size) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_SNAPSHOT_UNSTABLE',
      'candidate target changed while snapshotting',
    );
  }
  return {
    state: 'regular-file',
    fingerprint: {
      ...afterIdentity,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  };
}

export function snapshotActionReceiptCoverageCandidateTarget(
  input: string,
): ActionReceiptCoverageCandidateTargetSnapshot {
  return snapshotResolvedCandidateTarget(resolveActionReceiptCoverageCandidatePath(input));
}

class ActionReceiptCoverageCandidateWriteRaceError extends Error {
  constructor() {
    super('ACTION_RECEIPT_COVERAGE_CANDIDATE_WRITE_RACE: candidate target changed before promotion');
    this.name = 'ActionReceiptCoverageCandidateWriteRaceError';
  }
}

export type ActionReceiptCoverageCandidateBeforeRenameTestHook = (
  temporaryPath: string,
  destinationPath: string,
) => void;

export interface ActionReceiptCoverageCandidateWriteSummary {
  status: 'UNREVIEWED';
  path: string;
  envelopeSha256: string;
  manifestHash: string;
  inventoryHash: string;
  routeCount: number;
  surfaceCount: number;
  bytes: number;
}

export function writeActionReceiptCoverageCandidate(
  input: string,
  suppliedBuildResult?: ActionReceiptCoverageInventoryBuildResult,
  beforeRenameForTest?: ActionReceiptCoverageCandidateBeforeRenameTestHook,
): ActionReceiptCoverageCandidateWriteSummary {
  const destination = resolveActionReceiptCoverageCandidatePath(input);
  const baseline = snapshotResolvedCandidateTarget(destination);
  const buildResult = suppliedBuildResult ?? buildDiscoveredActionReceiptCoverageInventory();
  const envelope = buildActionReceiptCoverageCandidateEnvelope(buildResult);
  const envelopeBytes = prettyLfJsonBytes(envelope);

  try {
    atomicWriteFile(destination, envelopeBytes, {
      beforeRename: (temporaryPath, targetPath) => {
        beforeRenameForTest?.(temporaryPath, targetPath);
        try {
          const currentDestination = resolveActionReceiptCoverageCandidatePath(input);
          const current = snapshotResolvedCandidateTarget(currentDestination);
          if (currentDestination !== destination
            || JSON.stringify(current) !== JSON.stringify(baseline)) {
            throw new ActionReceiptCoverageCandidateWriteRaceError();
          }
        } catch (error) {
          if (error instanceof ActionReceiptCoverageCandidateWriteRaceError) throw error;
          throw new ActionReceiptCoverageCandidateWriteRaceError();
        }
      },
    });
  } catch (error) {
    if (error instanceof ActionReceiptCoverageCandidateWriteRaceError) throw error;
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_WRITE_FAILED',
      'atomic candidate promotion failed',
    );
  }

  let reopened: Buffer;
  try {
    const verifiedDestination = resolveActionReceiptCoverageCandidatePath(input);
    if (verifiedDestination !== destination) {
      throw new Error('destination changed');
    }
    reopened = readFileSync(destination);
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_WRITE_VERIFY_FAILED',
      'unable to reopen promoted candidate',
    );
  }
  const expectedBytes = Buffer.from(envelopeBytes, 'utf8');
  if (!reopened.equals(expectedBytes)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_WRITE_VERIFY_FAILED',
      'promoted candidate bytes differ',
    );
  }

  return {
    status: 'UNREVIEWED',
    path: relative(REPOSITORY_ROOT, destination).split(sep).join('/'),
    envelopeSha256: createHash('sha256').update(expectedBytes).digest('hex'),
    manifestHash: envelope.manifestHash,
    inventoryHash: envelope.inventoryHash,
    routeCount: envelope.routeCount,
    surfaceCount: envelope.surfaceCount,
    bytes: expectedBytes.byteLength,
  };
}

function snapshotsMatch(
  left: ActionReceiptCoverageCandidateTargetSnapshot,
  right: ActionReceiptCoverageCandidateTargetSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readStableCandidateBytes(input: string): {
  destination: string;
  bytes: Buffer;
  snapshot: ActionReceiptCoverageCandidateTargetSnapshot;
} {
  const destination = resolveActionReceiptCoverageCandidatePath(input);
  const before = snapshotResolvedCandidateTarget(destination);
  if (before.state === 'absent') {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_NOT_FOUND',
      'candidate artifact does not exist',
    );
  }
  let bytes: Buffer;
  let after: ActionReceiptCoverageCandidateTargetSnapshot;
  try {
    bytes = readFileSync(destination);
    after = snapshotResolvedCandidateTarget(destination);
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_READ_RACE',
      'candidate artifact changed while being read',
    );
  }
  const byteHash = createHash('sha256').update(bytes).digest('hex');
  if (after.state !== 'regular-file'
    || !snapshotsMatch(before, after)
    || byteHash !== after.fingerprint.sha256) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_READ_RACE',
      'candidate artifact changed while being read',
    );
  }
  return { destination, bytes, snapshot: after };
}

function reviewedPathLstat(path: string, label: string): Stats | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if (isMissingPathError(error)) return undefined;
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_PATH_INSPECTION_FAILED',
      label,
    );
  }
}

function reviewedPathRealpath(path: string, label: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_PATH_REALPATH_FAILED',
      label,
    );
  }
}

export function resolveActionReceiptCoverageReviewedPath(): string {
  const repositoryStats = reviewedPathLstat(REPOSITORY_ROOT, 'repository root');
  if (repositoryStats === undefined
    || repositoryStats.isSymbolicLink()
    || !repositoryStats.isDirectory()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_PATH_REPOSITORY_INVALID',
      'repository root must be a real directory',
    );
  }
  const configStats = reviewedPathLstat(CONFIG_ROOT, 'config root');
  if (configStats === undefined || configStats.isSymbolicLink() || !configStats.isDirectory()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_PATH_CONFIG_INVALID',
      'config root must be a real directory',
    );
  }
  const realRepositoryRoot = reviewedPathRealpath(REPOSITORY_ROOT, 'repository root');
  const realConfigRoot = reviewedPathRealpath(CONFIG_ROOT, 'config root');
  if (!isStrictChildPath(realRepositoryRoot, realConfigRoot)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_PATH_CONFIG_ESCAPE',
      'real config root must remain inside the real repository root',
    );
  }
  const targetStats = reviewedPathLstat(REVIEWED_COVERAGE_PATH, 'reviewed manifest');
  if (targetStats?.isSymbolicLink()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_PATH_TARGET_LINK',
      'reviewed manifest may not be a link',
    );
  }
  if (targetStats !== undefined && !targetStats.isFile()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_PATH_TARGET_NOT_FILE',
      'existing reviewed manifest must be a regular file',
    );
  }
  return REVIEWED_COVERAGE_PATH;
}

function snapshotResolvedReviewedTarget(
  destination: string,
): ActionReceiptCoverageCandidateTargetSnapshot {
  let before: import('node:fs').BigIntStats;
  try {
    before = lstatSync(destination, { bigint: true });
  } catch (error) {
    if (isMissingPathError(error)) return { state: 'absent' };
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_SNAPSHOT_FAILED',
      'unable to inspect reviewed manifest',
    );
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_SNAPSHOT_INVALID_TARGET',
      'reviewed manifest must be a regular file',
    );
  }
  let bytes: Buffer;
  let after: import('node:fs').BigIntStats;
  try {
    bytes = readFileSync(destination);
    after = lstatSync(destination, { bigint: true });
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_SNAPSHOT_UNSTABLE',
      'reviewed manifest changed while snapshotting',
    );
  }
  const beforeIdentity = candidateTargetStatIdentity(before);
  const afterIdentity = candidateTargetStatIdentity(after);
  if (after.isSymbolicLink()
    || !after.isFile()
    || JSON.stringify(beforeIdentity) !== JSON.stringify(afterIdentity)
    || BigInt(bytes.byteLength) !== after.size) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_SNAPSHOT_UNSTABLE',
      'reviewed manifest changed while snapshotting',
    );
  }
  return {
    state: 'regular-file',
    fingerprint: {
      ...afterIdentity,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  };
}

export function snapshotActionReceiptCoverageReviewedTarget(): ActionReceiptCoverageCandidateTargetSnapshot {
  return snapshotResolvedReviewedTarget(resolveActionReceiptCoverageReviewedPath());
}

export function actionReceiptCoverageCurrentReviewedMatches(
  snapshot: ActionReceiptCoverageCandidateTargetSnapshot,
  expected: ActionReceiptCoverageExpectedCurrentReviewed,
): boolean {
  if (expected.state === 'absent') return snapshot.state === 'absent';
  return snapshot.state === 'regular-file' && snapshot.fingerprint.sha256 === expected.sha256;
}

function readStableReviewedBytes(): {
  destination: string;
  bytes: Buffer;
  snapshot: ActionReceiptCoverageCandidateTargetSnapshot;
} {
  const destination = resolveActionReceiptCoverageReviewedPath();
  const before = snapshotResolvedReviewedTarget(destination);
  if (before.state === 'absent') {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_ABSENT',
      'reviewed action-receipt coverage manifest is absent',
    );
  }
  let bytes: Buffer;
  let after: ActionReceiptCoverageCandidateTargetSnapshot;
  try {
    bytes = readFileSync(destination);
    after = snapshotResolvedReviewedTarget(destination);
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_READ_RACE',
      'reviewed manifest changed while being read',
    );
  }
  const byteHash = createHash('sha256').update(bytes).digest('hex');
  if (after.state !== 'regular-file'
    || !snapshotsMatch(before, after)
    || byteHash !== after.fingerprint.sha256) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_READ_RACE',
      'reviewed manifest changed while being read',
    );
  }
  return { destination, bytes, snapshot: after };
}

export function parseActionReceiptCoverageReviewedManifest(
  bytes: string | Buffer,
  buildResult: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageManifest {
  const text = decodeCandidateEnvelopeBytes(bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_JSON_INVALID',
      'reviewed manifest must be valid JSON',
    );
  }
  if (text !== prettyLfJsonBytes(parsed)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_NONCANONICAL',
      'reviewed manifest must use canonical pretty JSON with one LF',
    );
  }
  const validation = validateActionReceiptCoverageManifest(parsed, buildResult.inventory);
  if (!validation.ok) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_INVALID',
      'reviewed manifest does not validate against current inventory',
    );
  }
  return parsed as ActionReceiptCoverageManifest;
}

export function requireFreshActionReceiptCoverageReviewedManifest(
  bytes: string | Buffer,
  buildResult: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageManifest {
  const manifest = parseActionReceiptCoverageReviewedManifest(bytes, buildResult);
  const text = decodeCandidateEnvelopeBytes(bytes);
  if (text !== prettyLfJsonBytes(buildActionReceiptCoverageCandidate(buildResult))) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_STALE',
      'reviewed manifest does not exactly match the current generated manifest',
    );
  }
  return manifest;
}

export interface ActionReceiptCoverageAuditSummary {
  status: 'PASS';
  path: 'config/action-receipt-coverage.json';
  manifestSha256: string;
  routeCount: number;
  surfaceCount: number;
}

export function auditActionReceiptCoverageManifest(
  suppliedBuildResult?: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageAuditSummary {
  const buildResult = suppliedBuildResult ?? buildDiscoveredActionReceiptCoverageInventory();
  const reviewed = readStableReviewedBytes();
  if (reviewed.snapshot.state !== 'regular-file'
    || reviewed.snapshot.fingerprint.sha256 !== ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_REVIEWED_SHA256_MISMATCH',
      'reviewed manifest bytes do not match the pinned authority SHA-256',
    );
  }
  const manifest = requireFreshActionReceiptCoverageReviewedManifest(reviewed.bytes, buildResult);
  const expectedBytes = prettyLfJsonBytes(manifest);
  return {
    status: 'PASS',
    path: 'config/action-receipt-coverage.json',
    manifestSha256: sha256Utf8(expectedBytes),
    routeCount: manifest.routes.length,
    surfaceCount: manifest.surfaces.length,
  };
}

class ActionReceiptCoveragePromotionRaceError extends Error {
  constructor() {
    super('ACTION_RECEIPT_COVERAGE_PROMOTION_RACE: reviewed destination changed before promotion');
    this.name = 'ActionReceiptCoveragePromotionRaceError';
  }
}

export interface ActionReceiptCoveragePromotionSummary {
  status: 'REVIEWED';
  path: 'config/action-receipt-coverage.json';
  candidateSha256: string;
  manifestHash: string;
  inventoryHash: string;
  routeCount: number;
  surfaceCount: number;
  bytes: number;
}

export function promoteActionReceiptCoverageCandidate(
  candidatePath: string,
  expectedCandidateSha256: string,
  expectedCurrentReviewed: string,
  suppliedBuildResult?: ActionReceiptCoverageInventoryBuildResult,
  beforeRenameForTest?: ActionReceiptCoverageCandidateBeforeRenameTestHook,
): ActionReceiptCoveragePromotionSummary {
  const expectedSha256 = parseActionReceiptCoverageExpectedSha256(expectedCandidateSha256);
  const expectedCurrent = parseActionReceiptCoverageExpectedCurrentReviewed(expectedCurrentReviewed);
  const candidate = readStableCandidateBytes(candidatePath);
  const candidateSha256 = requireActionReceiptCoverageCandidateSha256(
    candidate.bytes,
    expectedSha256,
  );
  const buildResult = suppliedBuildResult ?? buildDiscoveredActionReceiptCoverageInventory();
  const envelope = requireFreshActionReceiptCoverageCandidateEnvelope(candidate.bytes, buildResult);

  const destination = resolveActionReceiptCoverageReviewedPath();
  const baseline = snapshotResolvedReviewedTarget(destination);
  if (!actionReceiptCoverageCurrentReviewedMatches(baseline, expectedCurrent)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_EXPECTED_CURRENT_MISMATCH',
      'reviewed destination does not match the explicitly supplied current state',
    );
  }
  const manifestBytes = prettyLfJsonBytes(envelope.manifest);
  try {
    atomicWriteFile(destination, manifestBytes, {
      beforeRename: (temporaryPath, targetPath) => {
        beforeRenameForTest?.(temporaryPath, targetPath);
        try {
          const currentDestination = resolveActionReceiptCoverageReviewedPath();
          const current = snapshotResolvedReviewedTarget(currentDestination);
          if (currentDestination !== destination || !snapshotsMatch(current, baseline)) {
            throw new ActionReceiptCoveragePromotionRaceError();
          }
        } catch (error) {
          if (error instanceof ActionReceiptCoveragePromotionRaceError) throw error;
          throw new ActionReceiptCoveragePromotionRaceError();
        }
      },
    });
  } catch (error) {
    if (error instanceof ActionReceiptCoveragePromotionRaceError) throw error;
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_PROMOTION_WRITE_FAILED',
      'atomic reviewed-manifest promotion failed',
    );
  }

  const reopened = readStableReviewedBytes();
  const expectedBytes = Buffer.from(manifestBytes, 'utf8');
  if (!reopened.bytes.equals(expectedBytes)) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_PROMOTION_VERIFY_FAILED',
      'promoted reviewed manifest bytes differ',
    );
  }
  return {
    status: 'REVIEWED',
    path: 'config/action-receipt-coverage.json',
    candidateSha256,
    manifestHash: envelope.manifestHash,
    inventoryHash: envelope.inventoryHash,
    routeCount: envelope.routeCount,
    surfaceCount: envelope.surfaceCount,
    bytes: expectedBytes.byteLength,
  };
}

export interface ActionReceiptCoverageCandidateInvariantCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ActionReceiptCoverageCandidateInvariantSelftestResult {
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  checks: ActionReceiptCoverageCandidateInvariantCheck[];
}

function sameEffects(actual: readonly ReceiptCoverageEffect[], expected: readonly ReceiptCoverageEffect[]): boolean {
  return actual.length === expected.length && actual.every((effect, index) => effect === expected[index]);
}

export function runActionReceiptCoverageCandidateInvariantSelftest(
  suppliedBuildResult?: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageCandidateInvariantSelftestResult {
  const buildResult = suppliedBuildResult ?? buildDiscoveredActionReceiptCoverageInventory();
  const checks: ActionReceiptCoverageCandidateInvariantCheck[] = [];
  const check = (name: string, pass: boolean, detail?: string): void => {
    checks.push({ name, pass, ...(detail === undefined ? {} : { detail }) });
  };
  const metadata = getActionReceiptCoverageBuildAuthority(buildResult);
  const inputBefore = JSON.stringify({
    public: buildResult,
    routeAuthority: metadata === undefined ? [] : [...metadata.routes],
    surfaceAuthority: metadata === undefined ? [] : [...metadata.surfaces],
  });
  let candidate: ActionReceiptCoverageManifest;
  let repeated: ActionReceiptCoverageManifest;
  try {
    candidate = buildActionReceiptCoverageCandidate(buildResult);
    repeated = buildActionReceiptCoverageCandidate(buildResult);
  } catch (error) {
    check('candidate_build', false, error instanceof Error ? error.message : String(error));
    return { pass: false, passed: 0, total: 1, failures: ['candidate_build'], checks };
  }
  const route = (routeKey: string): ActionReceiptCoverageRouteEntry | undefined =>
    candidate.routes.find(entry => entry.routeKey === routeKey);
  const surface = (id: string): ActionReceiptCoverageSurfaceEntry | undefined =>
    candidate.surfaces.find(entry => entry.id === id);
  const expectRoutes = (
    name: string,
    routeKeys: readonly string[],
    semanticClass: ActionReceiptCoverageRouteEntry['semanticClass'],
    policy: ActionReceiptCoverageRouteEntry['policy'],
    effects: readonly ReceiptCoverageEffect[],
    integrationBatch: IntegrationBatch,
  ): void => {
    const failures = routeKeys.filter(routeKey => {
      const entry = route(routeKey);
      return entry === undefined
        || entry.semanticClass !== semanticClass
        || entry.policy !== policy
        || entry.integrationBatch !== integrationBatch
        || !sameEffects(entry.effects, effects);
    });
    check(name, failures.length === 0, failures.join(','));
  };
  const expectSurfaces = (
    name: string,
    ids: readonly string[],
    semanticClass: ActionReceiptCoverageSurfaceEntry['semanticClass'],
    policy: ActionReceiptCoverageSurfaceEntry['policy'],
    effects: readonly ReceiptCoverageEffect[],
    integrationBatch: IntegrationBatch,
  ): void => {
    const failures = ids.filter(id => {
      const entry = surface(id);
      return entry === undefined
        || entry.semanticClass !== semanticClass
        || entry.policy !== policy
        || entry.integrationBatch !== integrationBatch
        || !sameEffects(entry.effects, effects);
    });
    check(name, failures.length === 0, failures.join(','));
  };

  const stalePrior: ActionReceiptCoverageManifest = {
    schema: candidate.schema,
    routes: candidate.routes.map((entry): ActionReceiptCoverageRouteEntry => ({
      ...entry,
      integrationBatch: 'W3B3',
      capability: entry.capability.kind === 'canonical'
        ? { ...entry.capability }
        : { ...entry.capability, reviewRef: 'stale-review-ref' },
      semanticClass: 'conditional-dev-only',
      policy: 'refused',
      effects: ['process'],
      authorityScopes: ['global'],
    })),
    surfaces: candidate.surfaces.map((entry): ActionReceiptCoverageSurfaceEntry => ({
      ...entry,
      integrationBatch: 'W3B3',
      semanticClass: 'conditional-dev-only',
      policy: 'refused',
      effects: ['process'],
      authorityScopes: ['global'],
    })),
  };
  const stalePriorBefore = JSON.stringify(stalePrior);
  let stalePriorIgnored = false;
  let stalePriorDetail: string | undefined;
  try {
    const invokeWithStalePrior = buildActionReceiptCoverageCandidate as unknown as (
      currentBuildResult: ActionReceiptCoverageInventoryBuildResult,
      ignoredPrior: ActionReceiptCoverageManifest,
    ) => ActionReceiptCoverageManifest;
    const regenerated = invokeWithStalePrior(buildResult, stalePrior);
    stalePriorIgnored = buildActionReceiptCoverageCandidate.length === 1
      && JSON.stringify(regenerated) === JSON.stringify(candidate)
      && JSON.stringify(stalePrior) === stalePriorBefore;
  } catch (error) {
    stalePriorDetail = error instanceof Error ? error.message : String(error);
  }
  check(
    'candidate_has_no_stale_prior_preservation_path',
    stalePriorIgnored,
    stalePriorDetail,
  );

  const releaseExportFallback = defaultSurfacePolicy(
    {
      id: 'filesystem-writer:selftest-release-export.ts',
      kind: 'filesystem-writer',
      owner: 'selftest',
      sourceRef: '#/selftest/release-export',
    },
    { categories: ['verified-release-export'], owners: ['selftest'] },
  );
  const artifactStageFallback = defaultSurfacePolicy(
    {
      id: 'filesystem-writer:selftest-artifact-stage.ts',
      kind: 'filesystem-writer',
      owner: 'selftest',
      sourceRef: '#/selftest/artifact-stage',
    },
    { categories: ['isolated-artifact-stage'], owners: ['selftest'] },
  );
  check(
    'surface_category_fallbacks_keep_export_and_stage_distinct',
    releaseExportFallback.semanticClass === 'external-publish'
      && releaseExportFallback.policy === 'receipt-required'
      && releaseExportFallback.integrationBatch === 'W3B2'
      && sameEffects(releaseExportFallback.effects, ['filesystem-write', 'delete', 'publish'])
      && artifactStageFallback.semanticClass === 'durable-local-mutation'
      && artifactStageFallback.policy === 'receipt-required'
      && artifactStageFallback.integrationBatch === 'W3B2'
      && sameEffects(artifactStageFallback.effects, ['filesystem-write', 'package']),
  );

  expectRoutes(
    'route_deploy_verify_is_durable',
    ['POST /api/agent/deploy-verify'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write', 'deploy', 'delete'],
    'W3B2',
  );
  expectRoutes(
    'route_steam_verify_writes_report',
    ['POST /api/agent/release/steam/verify'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write', 'package'],
    'W3B2',
  );
  expectRoutes(
    'route_package_stages_write_files',
    [...PACKAGE_ROUTES],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write', 'package'],
    'W3B2',
  );
  expectRoutes(
    'route_deploy_can_replace_and_delete',
    ['POST /api/agent/deploy'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write', 'deploy', 'delete'],
    'W3B2',
  );
  expectRoutes(
    'route_restore_snapshot_commits_workspace_only',
    ['POST /api/fs/restore-snapshot'],
    'durable-local-mutation',
    'receipt-required',
    ['workspace-write'],
    'W3B1',
  );
  expectRoutes(
    'route_snapshot_prunes_files',
    ['POST /api/fs/snapshot'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write', 'delete'],
    'W3B1',
  );
  expectRoutes(
    'route_ai_key_blank_deletes_credential',
    ['POST /api/ai/keys'],
    'session-credential-mutation',
    'receipt-required',
    ['credential', 'delete'],
    'W3B1',
  );
  expectRoutes(
    'route_project_rules_suppress_writes_file',
    ['POST /api/agent/project-rules/suppress'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write'],
    'W3B1',
  );
  expectRoutes(
    'route_mod_import_is_audited_read',
    ['POST /api/agent/mod-folder/import'],
    'audit-retention',
    'separately-governed',
    ['read', 'analyze', 'audit-write', 'audit-retention-delete'],
    'W3B0-internal',
  );
  expectRoutes(
    'route_state_file_writes_are_durable',
    ['POST /api/schema/config', 'POST /api/studio/layout', 'POST /api/studio/release-preferences'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write', 'session-write'],
    'W3B1',
  );
  expectRoutes(
    'route_external_api_register_is_session_only',
    ['POST /api/agent/external-api/register'],
    'session-credential-mutation',
    'receipt-required',
    ['session-write'],
    'W3B1',
  );
  expectRoutes(
    'route_schema_harvest_is_w3b2_write',
    ['POST /api/agent/setup/harvest-schemas'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write'],
    'W3B2',
  );
  expectRoutes(
    'route_generate_apply_is_spend_and_workspace_write',
    ['POST /api/agent/generate'],
    'external-spend',
    'receipt-required',
    ['network', 'spend', 'workspace-write'],
    'W3B3',
  );
  expectRoutes(
    'route_github_poll_updates_credential',
    ['POST /api/github/device/poll'],
    'external-network',
    'receipt-required',
    ['network', 'credential'],
    'W3B3',
  );
  expectRoutes(
    'route_credential_deletes_are_explicit',
    ['DELETE /api/github/credential', 'POST /api/agent/keys/revoke'],
    'session-credential-mutation',
    'receipt-required',
    ['credential', 'delete'],
    'W3B1',
  );
  expectRoutes(
    'route_github_publish_is_explicit',
    [...GITHUB_PUBLISH_ROUTES],
    'external-publish',
    'receipt-required',
    ['network', 'publish'],
    'W3B3',
  );
  expectRoutes(
    'route_user_exports_publish',
    ['POST /api/agent/release/artifact/download', 'POST /api/agent/release/export/receipt'],
    'external-publish',
    'receipt-required',
    ['publish'],
    'W3B2',
  );
  expectRoutes(
    'route_in_memory_operations_remain_audited_reads',
    [
      'POST /api/agent/project/content-xml',
      'POST /api/agent/project/create',
      'POST /api/agent/project/file/create',
      'POST /api/agent/project/files',
      'POST /api/agent/project/generate',
      'POST /api/agent/project/validate',
      'POST /api/agent/workspace/restore-parked',
      'POST /api/agent/workspaces/bootstrap',
    ],
    'audit-retention',
    'separately-governed',
    ['read', 'analyze', 'audit-write', 'audit-retention-delete'],
    'W3B0-internal',
  );

  const canonicalPreview = route('POST /api/agent/generate/preview');
  const discoveredPreview = buildResult.inventory.routes.find(
    entry => entry.routeKey === 'POST /api/agent/generate/preview',
  );
  check(
    'route_canonical_generate_preview_remains_exact',
    canonicalPreview?.capability.kind === 'canonical'
      && discoveredPreview?.canonicalCapability !== undefined
      && canonicalPreview.capability.id === discoveredPreview.canonicalCapability.id
      && canonicalPreview.capability.version === discoveredPreview.canonicalCapability.version
      && sameEffects(canonicalPreview.effects, discoveredPreview.canonicalCapability.effects),
  );
  check(
    'route_scopes_preserve_workspace_without_global_credential_grant',
    route('POST /api/agent/generate')?.authorityScopes.includes('workspace') === true
      && canonicalPreview?.authorityScopes.includes('workspace') === true
      && route('POST /api/github/push')?.authorityScopes.includes('workspace') === true
      && route('POST /api/github/credential')?.authorityScopes.includes('workspace') === false
      && route('POST /api/agent/keys')?.authorityScopes.includes('workspace') === false,
  );

  expectSurfaces(
    'surface_server_mixed_superset',
    ['filesystem-writer:server.ts'],
    'durable-local-mutation',
    'receipt-required',
    ['workspace-write', 'filesystem-write', 'package', 'deploy', 'delete', 'session-write'],
    'W3B1',
  );
  expectSurfaces(
    'surface_internal_recovery_delete_is_separately_governed',
    [
      'filesystem-writer:src/lib/destructiveRecovery.ts',
      'filesystem-writer:src/lib/instanceDiscovery.ts',
    ],
    'fixture-cache',
    'separately-governed',
    ['filesystem-write', 'delete'],
    'W3B0-internal',
  );
  expectSurfaces(
    'surface_extension_sidecar_is_external_process',
    ['filesystem-writer:vscode-extension/src/extension.ts'],
    'external-process',
    'receipt-required',
    ['process', 'filesystem-write'],
    'W3B3',
  );
  expectSurfaces(
    'surface_schema_harvest_is_w3b2_write',
    ['filesystem-writer:src/server/gameDetectRoutes.ts'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write'],
    'W3B2',
  );
  expectSurfaces(
    'surface_artifact_materializers_write_package_bytes',
    [...ARTIFACT_MATERIALIZER_SURFACES],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write', 'package'],
    'W3B2',
  );
  expectSurfaces(
    'surface_native_editor_export_replaces_destination',
    ['filesystem-writer:vscode-extension/src/nativeEditorBridge.ts'],
    'external-publish',
    'receipt-required',
    ['filesystem-write', 'delete', 'publish'],
    'W3B2',
  );
  expectSurfaces(
    'surface_workspace_state_writes_and_prunes',
    ['filesystem-writer:src/lib/workspaceState.ts'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write', 'delete'],
    'W3B1',
  );
  expectSurfaces(
    'surface_workspace_registry_persists_workspace',
    ['filesystem-writer:src/lib/workspaceRegistry.ts'],
    'durable-local-mutation',
    'receipt-required',
    ['workspace-write', 'filesystem-write'],
    'W3B1',
  );
  expectSurfaces(
    'surface_xsd_parser_writes_standing_config',
    ['filesystem-writer:src/lib/xsdParser.ts'],
    'durable-local-mutation',
    'receipt-required',
    ['filesystem-write', 'session-write'],
    'W3B1',
  );
  expectSurfaces(
    'surface_credential_stores_delete_state',
    [...CREDENTIAL_DELETE_SURFACES],
    'session-credential-mutation',
    'receipt-required',
    ['credential', 'delete'],
    'W3B1',
  );
  expectSurfaces(
    'surface_browser_outputs_are_w3b2_publish',
    ['browser-output:src/components/AgentBridge.tsx', 'browser-output:src/components/ReleaseCenter.tsx'],
    'external-publish',
    'receipt-required',
    ['publish'],
    'W3B2',
  );
  expectSurfaces(
    'surface_legacy_credentials_are_explicit',
    [
      'host-store:src/components/AIConnectionModal.tsx',
      'host-store:src/components/SourceControl.tsx',
      'host-store:src/lib/apiHelper.ts',
      'host-store:src/main.tsx',
    ],
    'session-credential-mutation',
    'receipt-required',
    ['credential', 'session-write', 'delete'],
    'W3B1',
  );
  expectSurfaces(
    'surface_xml_snippets_are_persistent_state',
    ['host-store:src/components/XMLPatchSystem.tsx'],
    'session-credential-mutation',
    'receipt-required',
    ['session-write'],
    'W3B1',
  );
  expectSurfaces(
    'surface_mod_blueprint_cache_stays_exempt',
    ['host-store:src/lib/modBlueprint.ts'],
    'fixture-cache',
    'receipt-exempt',
    ['session-write'],
    'W3B0-internal',
  );
  expectSurfaces(
    'surface_pure_fixture_stays_exempt',
    ['filesystem-writer:src/lib/actionReceipt.selftest.ts'],
    'fixture-cache',
    'receipt-exempt',
    ['filesystem-write'],
    'W3B0-internal',
  );
  expectSurfaces(
    'surface_receipt_validation_are_audit_write_only',
    [...AUDIT_WRITE_ONLY_SURFACES],
    'audit-retention',
    'separately-governed',
    ['audit-write'],
    'W3B0-internal',
  );
  expectSurfaces(
    'surface_agent_history_retains_and_prunes',
    [...AUDIT_RETENTION_SURFACES],
    'audit-retention',
    'separately-governed',
    ['audit-write', 'audit-retention-delete'],
    'W3B0-internal',
  );

  const validation = validateActionReceiptCoverageManifest(candidate, buildResult.inventory);
  const inputAfter = JSON.stringify({
    public: buildResult,
    routeAuthority: metadata === undefined ? [] : [...metadata.routes],
    surfaceAuthority: metadata === undefined ? [] : [...metadata.surfaces],
  });
  const expectedSurfaceCount = Object.values(buildResult.surfaceCounts)
    .reduce((total, count) => total + count, 0);
  check(
    'candidate_matches_dynamic_inventory_census',
    candidate.routes.length === buildResult.nonGetRouteCount
      && candidate.surfaces.length === expectedSurfaceCount,
    `candidate=${candidate.routes.length}/${candidate.surfaces.length};inventory=${buildResult.nonGetRouteCount}/${expectedSurfaceCount}`,
  );
  check('candidate_validator_accepts', validation.ok, validation.ok ? undefined : validation.errors.map(error => error.code).join(','));
  check('candidate_bytes_repeat', JSON.stringify(candidate) === JSON.stringify(repeated));
  check('candidate_input_unchanged', inputBefore === inputAfter);

  const failures = checks.filter(entry => !entry.pass).map(entry => entry.name);
  return {
    pass: failures.length === 0,
    passed: checks.length - failures.length,
    total: checks.length,
    failures,
    checks,
  };
}

export interface ActionReceiptCoveragePromotionSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ActionReceiptCoveragePromotionSelftestResult {
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  candidateSha256: string;
  routeCount: number;
  surfaceCount: number;
  reviewedTargetState: ActionReceiptCoverageCandidateTargetSnapshot['state'];
  checks: ActionReceiptCoveragePromotionSelftestCheck[];
}

export function runActionReceiptCoveragePromotionSelftest(
  suppliedBuildResult?: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoveragePromotionSelftestResult {
  const buildResult = suppliedBuildResult ?? buildDiscoveredActionReceiptCoverageInventory();
  const metadata = getActionReceiptCoverageBuildAuthority(buildResult);
  const inputBefore = JSON.stringify({
    public: buildResult,
    routeAuthority: metadata === undefined ? [] : [...metadata.routes],
    surfaceAuthority: metadata === undefined ? [] : [...metadata.surfaces],
  });
  const envelope = buildActionReceiptCoverageCandidateEnvelope(buildResult);
  const envelopeBytes = prettyLfJsonBytes(envelope);
  const candidateSha256 = sha256Utf8(envelopeBytes);
  const checks: ActionReceiptCoveragePromotionSelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: string): void => {
    checks.push({ name, pass, ...(detail === undefined ? {} : { detail }) });
  };
  const rejectsWith = (operation: () => unknown, code: string): boolean => {
    try {
      operation();
      return false;
    } catch (error) {
      return error instanceof Error && error.message.startsWith(`${code}:`);
    }
  };
  const cloneEnvelope = (): ActionReceiptCoverageCandidateEnvelope =>
    JSON.parse(envelopeBytes) as ActionReceiptCoverageCandidateEnvelope;

  const parsed = parseActionReceiptCoverageCandidateEnvelope(envelopeBytes, buildResult);
  check(
    'promotion_parser_accepts_canonical_candidate',
    prettyLfJsonBytes(parsed) === envelopeBytes,
  );
  check(
    'promotion_candidate_bytes_repeat',
    envelopeBytes === buildActionReceiptCoverageCandidateEnvelopeBytes(buildResult)
      && candidateSha256 === sha256Utf8(buildActionReceiptCoverageCandidateEnvelopeBytes(buildResult)),
  );
  check(
    'promotion_hash_pin_accepts_exact_bytes',
    requireActionReceiptCoverageCandidateSha256(envelopeBytes, candidateSha256) === candidateSha256,
  );
  check(
    'promotion_hash_pin_rejects_mismatch',
    rejectsWith(
      () => requireActionReceiptCoverageCandidateSha256(envelopeBytes, '0'.repeat(64)),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_SHA256_MISMATCH',
    ),
  );
  check(
    'promotion_expected_sha_parser_is_strict',
    parseActionReceiptCoverageExpectedSha256(candidateSha256.toUpperCase()) === candidateSha256
      && rejectsWith(
        () => parseActionReceiptCoverageExpectedSha256('not-a-hash'),
        'ACTION_RECEIPT_COVERAGE_EXPECTED_SHA256_INVALID',
      ),
  );
  const expectedAbsent = parseActionReceiptCoverageExpectedCurrentReviewed('ABSENT');
  const expectedHash = parseActionReceiptCoverageExpectedCurrentReviewed(candidateSha256);
  check(
    'promotion_expected_current_parser_and_matcher',
    expectedAbsent.state === 'absent'
      && expectedHash.state === 'sha256'
      && actionReceiptCoverageCurrentReviewedMatches({ state: 'absent' }, expectedAbsent)
      && actionReceiptCoverageCurrentReviewedMatches(
        {
          state: 'regular-file',
          fingerprint: {
            device: '1', inode: '2', mode: '3', links: '1', size: '4',
            modifiedNs: '5', changedNs: '6', sha256: candidateSha256,
          },
        },
        expectedHash,
      ),
  );
  check(
    'promotion_expected_current_rejects_malformed',
    rejectsWith(
      () => parseActionReceiptCoverageExpectedCurrentReviewed('absent'),
      'ACTION_RECEIPT_COVERAGE_EXPECTED_CURRENT_INVALID',
    )
      && rejectsWith(
        () => parseActionReceiptCoverageExpectedCurrentReviewed('1234'),
        'ACTION_RECEIPT_COVERAGE_EXPECTED_CURRENT_INVALID',
      ),
  );
  check(
    'promotion_parser_rejects_malformed_json',
    rejectsWith(
      () => parseActionReceiptCoverageCandidateEnvelope('{', buildResult),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_JSON_INVALID',
    ),
  );
  check(
    'promotion_parser_rejects_unknown_fields',
    rejectsWith(
      () => parseActionReceiptCoverageCandidateEnvelope(
        prettyLfJsonBytes({ ...envelope, unknown: true }),
        buildResult,
      ),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_FIELDS_INVALID',
    ),
  );
  const missingStatus = Object.fromEntries(
    Object.entries(envelope).filter(([key]) => key !== 'status'),
  );
  check(
    'promotion_parser_rejects_missing_fields',
    rejectsWith(
      () => parseActionReceiptCoverageCandidateEnvelope(prettyLfJsonBytes(missingStatus), buildResult),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_FIELDS_INVALID',
    ),
  );
  check(
    'promotion_parser_rejects_schema_and_status_drift',
    rejectsWith(
      () => parseActionReceiptCoverageCandidateEnvelope(
        prettyLfJsonBytes({ ...envelope, schema: 'forge.action-receipt-coverage-candidate.v2' }),
        buildResult,
      ),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_SCHEMA_INVALID',
    )
      && rejectsWith(
        () => parseActionReceiptCoverageCandidateEnvelope(
          prettyLfJsonBytes({ ...envelope, status: 'REVIEWED' }),
          buildResult,
        ),
        'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_STATUS_INVALID',
      ),
  );
  check(
    'promotion_parser_rejects_malformed_embedded_hash',
    rejectsWith(
      () => parseActionReceiptCoverageCandidateEnvelope(
        prettyLfJsonBytes({ ...envelope, manifestHash: 'bad' }),
        buildResult,
      ),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_HASH_INVALID',
    ),
  );
  check(
    'promotion_parser_rejects_manifest_hash_mismatch',
    rejectsWith(
      () => parseActionReceiptCoverageCandidateEnvelope(
        prettyLfJsonBytes({ ...envelope, manifestHash: '0'.repeat(64) }),
        buildResult,
      ),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_MANIFEST_HASH_MISMATCH',
    ),
  );
  check(
    'promotion_parser_rejects_inventory_hash_mismatch',
    rejectsWith(
      () => parseActionReceiptCoverageCandidateEnvelope(
        prettyLfJsonBytes({ ...envelope, inventoryHash: '0'.repeat(64) }),
        buildResult,
      ),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_INVENTORY_HASH_MISMATCH',
    ),
  );
  check(
    'promotion_parser_rejects_count_mismatch',
    rejectsWith(
      () => parseActionReceiptCoverageCandidateEnvelope(
        prettyLfJsonBytes({ ...envelope, routeCount: envelope.routeCount + 1 }),
        buildResult,
      ),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_COUNT_MISMATCH',
    ),
  );
  check(
    'promotion_parser_rejects_noncanonical_bytes',
    rejectsWith(
      () => parseActionReceiptCoverageCandidateEnvelope(envelopeBytes.trimEnd(), buildResult),
      'ACTION_RECEIPT_COVERAGE_CANDIDATE_ENVELOPE_NONCANONICAL',
    ),
  );
  const driftedEnvelope = cloneEnvelope();
  const driftedRoute = driftedEnvelope.manifest.routes[0];
  if (driftedRoute !== undefined) {
    driftedRoute.integrationBatch = driftedRoute.integrationBatch === 'W3B1' ? 'W3B2' : 'W3B1';
    driftedEnvelope.manifestHash = sha256Utf8(prettyLfJsonBytes(driftedEnvelope.manifest));
  }
  check(
    'promotion_rejects_validator_green_manual_drift',
    driftedRoute !== undefined
      && rejectsWith(
        () => requireFreshActionReceiptCoverageCandidateEnvelope(
          prettyLfJsonBytes(driftedEnvelope),
          buildResult,
        ),
        'ACTION_RECEIPT_COVERAGE_CANDIDATE_STALE',
      ),
  );
  check(
    'promotion_candidate_envelope_is_not_reviewed_manifest',
    rejectsWith(
      () => parseActionReceiptCoverageReviewedManifest(envelopeBytes, buildResult),
      'ACTION_RECEIPT_COVERAGE_REVIEWED_INVALID',
    ),
  );
  const reviewedBytes = prettyLfJsonBytes(envelope.manifest);
  check(
    'promotion_reviewed_parser_accepts_fresh_manifest',
    prettyLfJsonBytes(
      requireFreshActionReceiptCoverageReviewedManifest(reviewedBytes, buildResult),
    ) === reviewedBytes,
  );
  check(
    'promotion_reviewed_parser_rejects_malformed_unknown_and_noncanonical',
    rejectsWith(
      () => parseActionReceiptCoverageReviewedManifest('{', buildResult),
      'ACTION_RECEIPT_COVERAGE_REVIEWED_JSON_INVALID',
    )
      && rejectsWith(
        () => parseActionReceiptCoverageReviewedManifest(
          prettyLfJsonBytes({ ...envelope.manifest, unknown: true }),
          buildResult,
        ),
        'ACTION_RECEIPT_COVERAGE_REVIEWED_INVALID',
      )
      && rejectsWith(
        () => parseActionReceiptCoverageReviewedManifest(reviewedBytes.trimEnd(), buildResult),
        'ACTION_RECEIPT_COVERAGE_REVIEWED_NONCANONICAL',
      ),
  );
  check(
    'promotion_reviewed_freshness_rejects_validator_green_drift',
    driftedRoute !== undefined
      && rejectsWith(
        () => requireFreshActionReceiptCoverageReviewedManifest(
          prettyLfJsonBytes(driftedEnvelope.manifest),
          buildResult,
        ),
        'ACTION_RECEIPT_COVERAGE_REVIEWED_STALE',
      ),
  );

  let reviewedTargetState: ActionReceiptCoverageCandidateTargetSnapshot['state'] = 'absent';
  let destinationDetail: string | undefined;
  let destinationStable = false;
  try {
    const firstPath = resolveActionReceiptCoverageReviewedPath();
    const firstSnapshot = snapshotActionReceiptCoverageReviewedTarget();
    const secondPath = resolveActionReceiptCoverageReviewedPath();
    const secondSnapshot = snapshotActionReceiptCoverageReviewedTarget();
    reviewedTargetState = firstSnapshot.state;
    destinationStable = firstPath === REVIEWED_COVERAGE_PATH
      && secondPath === firstPath
      && snapshotsMatch(firstSnapshot, secondSnapshot);
  } catch (error) {
    destinationDetail = error instanceof Error ? error.message : String(error);
  }
  check('promotion_reviewed_destination_snapshot_is_stable', destinationStable, destinationDetail);

  const inputAfter = JSON.stringify({
    public: buildResult,
    routeAuthority: metadata === undefined ? [] : [...metadata.routes],
    surfaceAuthority: metadata === undefined ? [] : [...metadata.surfaces],
  });
  check('promotion_selftest_input_unchanged', inputBefore === inputAfter);

  const failures = checks.filter(entry => !entry.pass).map(entry => entry.name);
  return {
    pass: failures.length === 0,
    passed: checks.length - failures.length,
    total: checks.length,
    failures,
    candidateSha256,
    routeCount: envelope.routeCount,
    surfaceCount: envelope.surfaceCount,
    reviewedTargetState,
    checks,
  };
}

export interface ActionReceiptCoverageCandidateSelftestAggregate {
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  path: ActionReceiptCoverageCandidatePathSelftestResult;
  envelope: ActionReceiptCoverageCandidateEnvelopeSelftestResult;
  semantic: ActionReceiptCoverageCandidateInvariantSelftestResult;
}

export function runActionReceiptCoverageCandidateSelftests(
  suppliedBuildResult?: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageCandidateSelftestAggregate {
  const buildResult = suppliedBuildResult ?? buildDiscoveredActionReceiptCoverageInventory();
  const path = runActionReceiptCoverageCandidatePathSelftest();
  const envelope = runActionReceiptCoverageCandidateEnvelopeSelftest(buildResult);
  const semantic = runActionReceiptCoverageCandidateInvariantSelftest(buildResult);
  const failures = [
    ...path.failures.map(name => `path:${name}`),
    ...envelope.failures.map(name => `envelope:${name}`),
    ...semantic.failures.map(name => `semantic:${name}`),
  ];
  return {
    pass: failures.length === 0,
    passed: path.passed + envelope.passed + semantic.passed,
    total: path.total + envelope.total + semantic.total,
    failures,
    path,
    envelope,
    semantic,
  };
}

function compactCandidateSelftest(result: ActionReceiptCoverageCandidateSelftestAggregate): object {
  return {
    pass: result.pass,
    passed: result.passed,
    total: result.total,
    failures: result.failures,
    path: { pass: result.path.pass, passed: result.path.passed, total: result.path.total },
    envelope: {
      pass: result.envelope.pass,
      passed: result.envelope.passed,
      total: result.envelope.total,
      envelopeHash: result.envelope.envelopeHash,
      routeCount: result.envelope.routeCount,
      surfaceCount: result.envelope.surfaceCount,
    },
    semantic: {
      pass: result.semantic.pass,
      passed: result.semantic.passed,
      total: result.semantic.total,
    },
  };
}

function compactPromotionSelftest(result: ActionReceiptCoveragePromotionSelftestResult): object {
  return {
    pass: result.pass,
    passed: result.passed,
    total: result.total,
    failures: result.failures,
    candidateSha256: result.candidateSha256,
    routeCount: result.routeCount,
    surfaceCount: result.surfaceCount,
    reviewedTargetState: result.reviewedTargetState,
  };
}

function requireCoverageSelftests(
  candidate: ActionReceiptCoverageCandidateSelftestAggregate,
  promotion: ActionReceiptCoveragePromotionSelftestResult,
): void {
  if (!candidate.pass || !promotion.pass) {
    throw stableError(
      'ACTION_RECEIPT_COVERAGE_SELFTEST_FAILED',
      [...candidate.failures, ...promotion.failures].join(',') || 'coverage selftest failed',
    );
  }
}

async function main(args: readonly string[]): Promise<void> {
  if (args.length === 1 && args[0] === '--print-inventory') {
    await runActionReceiptCoveragePrerequisiteAudits();
    const result = buildDiscoveredActionReceiptCoverageInventory();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (args.length === 1 && args[0] === '--candidate-selftest') {
    const result = runActionReceiptCoverageCandidateSelftests();
    const policyBundle = runActionReceiptPolicyBundleSelftest();
    process.stdout.write(`${JSON.stringify({
      ...compactCandidateSelftest(result),
      policyBundle: {
        pass: policyBundle.pass,
        passed: policyBundle.passed,
        total: policyBundle.total,
        failures: policyBundle.failures,
      },
    })}\n`);
    if (!result.pass || !policyBundle.pass) process.exitCode = 1;
    return;
  }
  if (args.length === 1 && args[0] === '--promotion-selftest') {
    const result = runActionReceiptCoveragePromotionSelftest();
    process.stdout.write(`${JSON.stringify(compactPromotionSelftest(result))}\n`);
    if (!result.pass) process.exitCode = 1;
    return;
  }
  if (args.length === 1 && args[0] === '--audit') {
    await runActionReceiptCoveragePrerequisiteAudits();
    const buildResult = buildDiscoveredActionReceiptCoverageInventory();
    const candidateSelftest = runActionReceiptCoverageCandidateSelftests(buildResult);
    const promotionSelftest = runActionReceiptCoveragePromotionSelftest(buildResult);
    requireCoverageSelftests(candidateSelftest, promotionSelftest);
    process.stdout.write(`${JSON.stringify(auditActionReceiptCoverageManifest(buildResult))}\n`);
    return;
  }
  if (args.length === 2 && args[0] === '--write-candidate') {
    const candidatePath = args[1];
    if (candidatePath === undefined) {
      throw stableError('ACTION_RECEIPT_COVERAGE_MODE_INVALID', 'candidate path is required');
    }
    resolveActionReceiptCoverageCandidatePath(candidatePath);
    await runActionReceiptCoveragePrerequisiteAudits();
    const buildResult = buildDiscoveredActionReceiptCoverageInventory();
    const selftest = runActionReceiptCoverageCandidateSelftests(buildResult);
    if (!selftest.pass) {
      throw stableError(
        'ACTION_RECEIPT_COVERAGE_CANDIDATE_SELFTEST_FAILED',
        selftest.failures.join(',') || 'candidate selftest failed',
      );
    }
    const summary = writeActionReceiptCoverageCandidate(candidatePath, buildResult);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return;
  }
  if (args.length === 6 && args[0] === '--promote-candidate') {
    const candidatePath = args[1];
    const expectedShaFlag = args[2];
    const expectedSha256 = args[3];
    const expectedCurrentFlag = args[4];
    const expectedCurrentReviewed = args[5];
    if (candidatePath === undefined
      || expectedShaFlag !== '--expected-sha256'
      || expectedSha256 === undefined
      || expectedCurrentFlag !== '--expected-current-reviewed'
      || expectedCurrentReviewed === undefined) {
      throw stableError(
        'ACTION_RECEIPT_COVERAGE_MODE_INVALID',
        'promotion requires exact candidate, expected SHA-256, and expected current reviewed arguments',
      );
    }
    resolveActionReceiptCoverageCandidatePath(candidatePath);
    parseActionReceiptCoverageExpectedSha256(expectedSha256);
    parseActionReceiptCoverageExpectedCurrentReviewed(expectedCurrentReviewed);
    await runActionReceiptCoveragePrerequisiteAudits();
    const buildResult = buildDiscoveredActionReceiptCoverageInventory();
    const candidateSelftest = runActionReceiptCoverageCandidateSelftests(buildResult);
    const promotionSelftest = runActionReceiptCoveragePromotionSelftest(buildResult);
    requireCoverageSelftests(candidateSelftest, promotionSelftest);
    const summary = promoteActionReceiptCoverageCandidate(
      candidatePath,
      expectedSha256,
      expectedCurrentReviewed,
      buildResult,
    );
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return;
  }
  throw stableError(
    'ACTION_RECEIPT_COVERAGE_MODE_INVALID',
    'expected inventory, candidate, promotion-selftest, audit, or exact promotion mode',
  );
}

if (process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  void main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
