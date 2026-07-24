import type { PackageDiagnostic } from '../types';
import type { WatcherVerdictState } from './watcherVerdict';

export const READINESS_STAGE_IDS = ['graph', 'package', 'deployed', 'seen', 'experience'] as const;
export type ReadinessStageId = typeof READINESS_STAGE_IDS[number];
export type ReadinessStatus = 'pass' | 'warning' | 'fail' | 'pending' | 'stale' | 'unavailable';
export type ReadinessOwner = 'canvas' | 'diagnostics' | 'playtest';

export interface DeployEvidence {
  workspaceName?: string;
  workspaceHash?: string;
  deployedAt?: string;
  deployedPath?: string;
  stagingPath?: string;
}

export interface ReadinessWatcherEvidence {
  phase: 'loading' | 'ready' | 'error';
  error?: string;
  verdict?: { state: WatcherVerdictState; detail: string; errorCount: number };
  sinceDeploy?: { hasDeploy: boolean; changedSinceDeploy: boolean; summary: string; deployedAt?: string; logUpdatedAt?: string };
  lastDeploy?: DeployEvidence | null;
}

export interface ExperienceConfirmation {
  workspaceName: string;
  workspaceHash: string;
  deployedAt: string;
  confirmedAt: string;
}

export interface ReadinessStage {
  id: ReadinessStageId;
  label: string;
  shortLabel: string;
  status: ReadinessStatus;
  summary: string;
  evidence: string;
  owner: ReadinessOwner;
}

export interface BuildReadinessInput {
  workspaceName: string;
  workspaceHash: string;
  graphDiagnostics: PackageDiagnostic[];
  packageDiagnostics: PackageDiagnostic[];
  diagnosticSource: 'checking' | 'project' | 'local';
  watcher: ReadinessWatcherEvidence;
  confirmation?: ExperienceConfirmation | null;
}

export const EXPERIENCE_CONFIRMATIONS_KEY = 'x4_forge_experience_confirmations';

export function parseExperienceConfirmations(raw: string | null | undefined): Record<string, ExperienceConfirmation> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const valid: Record<string, ExperienceConfirmation> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const item = value as Partial<ExperienceConfirmation>;
      if (
        typeof item?.workspaceName === 'string' &&
        typeof item.workspaceHash === 'string' &&
        typeof item.deployedAt === 'string' &&
        typeof item.confirmedAt === 'string'
      ) valid[key] = item as ExperienceConfirmation;
    }
    return valid;
  } catch {
    return {};
  }
}

const countSeverity = (items: PackageDiagnostic[], severity: PackageDiagnostic['severity']) =>
  items.filter(item => item.severity === severity).length;

function diagnosticStage(
  id: 'graph' | 'package',
  label: string,
  diagnostics: PackageDiagnostic[],
  owner: ReadinessOwner,
): ReadinessStage {
  const errors = countSeverity(diagnostics, 'error');
  const warnings = countSeverity(diagnostics, 'warning');
  if (errors > 0) return {
    id, label, shortLabel: id === 'graph' ? 'Graph' : 'Validation', status: 'fail', owner,
    summary: `${errors} error${errors === 1 ? '' : 's'}`,
    evidence: `${errors} blocking error(s), ${warnings} warning(s) in current workspace evidence.`,
  };
  if (warnings > 0) return {
    id, label, shortLabel: id === 'graph' ? 'Graph' : 'Validation', status: 'warning', owner,
    summary: `Valid · ${warnings} warning${warnings === 1 ? '' : 's'}`,
    evidence: `No blocking errors; ${warnings} warning(s) need review.`,
  };
  return {
    id, label, shortLabel: id === 'graph' ? 'Graph' : 'Validation', status: 'pass', owner,
    summary: 'Valid', evidence: 'Current workspace has zero blocking errors or warnings.',
  };
}

export function buildReadinessStages(input: BuildReadinessInput): ReadinessStage[] {
  const graph = diagnosticStage('graph', 'Graph valid', input.graphDiagnostics, 'canvas');

  let pkg: ReadinessStage;
  if (input.diagnosticSource === 'checking') {
    pkg = { id: 'package', label: 'Project valid', shortLabel: 'Validation', status: 'pending', owner: 'diagnostics', summary: 'Checking', evidence: 'The full-project validator is checking the current workspace.' };
  } else if (input.diagnosticSource === 'local') {
    pkg = { id: 'package', label: 'Project valid', shortLabel: 'Validation', status: 'unavailable', owner: 'diagnostics', summary: 'Validator offline', evidence: 'Only local graph heuristics ran; schema, corpus, and cross-file validity are not proven.' };
  } else {
    pkg = diagnosticStage('package', 'Project valid', input.packageDiagnostics, 'diagnostics');
  }

  const deploy = input.watcher.lastDeploy;
  let deployed: ReadinessStage;
  if (input.watcher.phase === 'loading') {
    deployed = { id: 'deployed', label: 'Deployed', shortLabel: 'Deploy', status: 'pending', owner: 'playtest', summary: 'Checking', evidence: 'Loading Studio deploy evidence.' };
  } else if (input.watcher.phase === 'error') {
    deployed = { id: 'deployed', label: 'Deployed', shortLabel: 'Deploy', status: 'unavailable', owner: 'playtest', summary: 'Evidence offline', evidence: input.watcher.error || 'Deploy evidence is unavailable.' };
  } else if (!deploy || !input.watcher.sinceDeploy?.hasDeploy) {
    deployed = { id: 'deployed', label: 'Deployed', shortLabel: 'Deploy', status: 'pending', owner: 'playtest', summary: 'Not deployed', evidence: 'No Studio deploy metadata exists for this mod in the current server session.' };
  } else if (!deploy.deployedPath) {
    deployed = { id: 'deployed', label: 'Deployed', shortLabel: 'Deploy', status: 'pending', owner: 'playtest', summary: 'Staged only', evidence: deploy.stagingPath ? `Built to staging at ${deploy.stagingPath}, but no X4 extensions path was written.` : 'Deploy metadata has no game extensions path.' };
  } else if (!deploy.workspaceHash) {
    deployed = { id: 'deployed', label: 'Deployed', shortLabel: 'Deploy', status: 'stale', owner: 'playtest', summary: 'Identity unknown', evidence: 'A deploy exists, but it predates workspace-hash evidence and cannot prove these current bytes.' };
  } else if (deploy.workspaceHash !== input.workspaceHash || (deploy.workspaceName && deploy.workspaceName !== input.workspaceName)) {
    deployed = { id: 'deployed', label: 'Deployed', shortLabel: 'Deploy', status: 'stale', owner: 'playtest', summary: 'Workspace changed', evidence: `The current workspace differs from the ${deploy.deployedAt || 'previous'} deploy. Deploy again to refresh proof.` };
  } else {
    deployed = { id: 'deployed', label: 'Deployed', shortLabel: 'Deploy', status: 'pass', owner: 'playtest', summary: 'Current bytes', evidence: `${deploy.deployedPath} · ${deploy.deployedAt || 'time unavailable'}` };
  }

  const verdict = input.watcher.verdict;
  let seen: ReadinessStage;
  if (deployed.status === 'stale') {
    seen = { id: 'seen', label: 'Seen in game', shortLabel: 'In game', status: 'stale', owner: 'playtest', summary: 'Deploy stale', evidence: 'Game evidence cannot certify workspace bytes newer than the last deploy.' };
  } else if (deployed.status !== 'pass') {
    seen = {
      id: 'seen', label: 'Seen in game', shortLabel: 'In game',
      status: deployed.status === 'unavailable' ? 'unavailable' : 'pending', owner: 'playtest',
      summary: deployed.status === 'unavailable' ? 'Deploy proof offline' : 'Deploy first',
      evidence: 'A successful, current hash-matching deploy is required before log activity can certify these workspace bytes.',
    };
  } else if (input.watcher.phase !== 'ready' || !verdict) {
    seen = { id: 'seen', label: 'Seen in game', shortLabel: 'In game', status: input.watcher.phase === 'error' ? 'unavailable' : 'pending', owner: 'playtest', summary: input.watcher.phase === 'error' ? 'Watcher offline' : 'Checking', evidence: input.watcher.error || 'Loading the server watcher verdict.' };
  } else if (verdict.state === 'no_log') {
    seen = { id: 'seen', label: 'Seen in game', shortLabel: 'In game', status: 'unavailable', owner: 'playtest', summary: 'No debug log', evidence: verdict.detail };
  } else if (verdict.state === 'stale') {
    seen = { id: 'seen', label: 'Seen in game', shortLabel: 'In game', status: 'stale', owner: 'playtest', summary: 'Log predates deploy', evidence: verdict.detail };
  } else if (verdict.state === 'not_seen') {
    seen = { id: 'seen', label: 'Seen in game', shortLabel: 'In game', status: 'pending', owner: 'playtest', summary: 'Not seen yet', evidence: verdict.detail };
  } else if (verdict.state === 'loaded_with_errors') {
    seen = { id: 'seen', label: 'Seen in game', shortLabel: 'In game', status: 'fail', owner: 'playtest', summary: `Seen · ${verdict.errorCount} errors`, evidence: verdict.detail };
  } else {
    seen = { id: 'seen', label: 'Seen in game', shortLabel: 'In game', status: 'pass', owner: 'playtest', summary: 'Loaded clean', evidence: verdict.detail };
  }

  const confirmationMatches = Boolean(
    input.confirmation &&
    deploy?.deployedAt &&
    input.confirmation.workspaceName === input.workspaceName &&
    input.confirmation.workspaceHash === input.workspaceHash &&
    input.confirmation.deployedAt === deploy.deployedAt
  );
  const experience: ReadinessStage = seen.status !== 'pass'
    ? { id: 'experience', label: 'Experience confirmed', shortLabel: 'Experience', status: seen.status === 'stale' ? 'stale' : 'pending', owner: 'playtest', summary: 'Waiting', evidence: 'First obtain a current, clean in-game signal; then confirm what you personally saw and used.' }
    : confirmationMatches
      ? { id: 'experience', label: 'Experience confirmed', shortLabel: 'Experience', status: 'pass', owner: 'playtest', summary: 'User confirmed', evidence: `Confirmed ${input.confirmation?.confirmedAt} for this exact deploy.` }
      : { id: 'experience', label: 'Experience confirmed', shortLabel: 'Experience', status: 'pending', owner: 'playtest', summary: 'Needs your check', evidence: 'Machine evidence is clean. Confirm only after you personally see and use the intended experience.' };

  return [graph, pkg, deployed, seen, experience];
}

export function runReadinessSelftest() {
  const diag = (severity: PackageDiagnostic['severity']): PackageDiagnostic => ({ severity, category: 'syntax', code: `test.${severity}`, domain: 'md', filePath: 'md/test.xml', message: severity });
  const deploy: DeployEvidence = { workspaceName: 'W', workspaceHash: 'hash', deployedAt: '2026-07-14T12:00:00.000Z', deployedPath: 'G:/extensions/w' };
  const readyWatcher: ReadinessWatcherEvidence = {
    phase: 'ready', lastDeploy: deploy,
    sinceDeploy: { hasDeploy: true, changedSinceDeploy: true, summary: 'fresh' },
    verdict: { state: 'loaded_clean', detail: 'loaded clean', errorCount: 0 },
  };
  const base: BuildReadinessInput = { workspaceName: 'W', workspaceHash: 'hash', graphDiagnostics: [], packageDiagnostics: [], diagnosticSource: 'project', watcher: readyWatcher };
  const checks: Array<{ name: string; pass: boolean; detail?: unknown }> = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, detail });
  const stage = (over: Partial<BuildReadinessInput>, id: ReadinessStageId) => buildReadinessStages({ ...base, ...over }).find(item => item.id === id)!;

  ok('fixed_five_stage_order', buildReadinessStages(base).map(s => s.id).join(',') === READINESS_STAGE_IDS.join(','));
  ok('graph_error_fails', stage({ graphDiagnostics: [diag('error')] }, 'graph').status === 'fail');
  ok('graph_warning_not_green', stage({ graphDiagnostics: [diag('warning')] }, 'graph').status === 'warning');
  ok('package_checking_pending', stage({ diagnosticSource: 'checking' }, 'package').status === 'pending');
  ok('package_offline_unavailable', stage({ diagnosticSource: 'local' }, 'package').status === 'unavailable');
  ok('package_error_fails', stage({ packageDiagnostics: [diag('error')] }, 'package').status === 'fail');
  ok('no_deploy_pending', stage({ watcher: { phase: 'ready', lastDeploy: null, sinceDeploy: { hasDeploy: false, changedSinceDeploy: false, summary: 'none' }, verdict: { state: 'not_seen', detail: 'none', errorCount: 0 } } }, 'deployed').status === 'pending');
  ok('no_deploy_blocks_seen_even_if_log_has_markers', stage({ watcher: { phase: 'ready', lastDeploy: null, sinceDeploy: { hasDeploy: false, changedSinceDeploy: false, summary: 'none' }, verdict: { state: 'loaded_clean', detail: 'old marker', errorCount: 0 } } }, 'seen').status === 'pending');
  ok('staging_is_not_deployed', stage({ watcher: { ...readyWatcher, lastDeploy: { ...deploy, deployedPath: undefined, stagingPath: 'F:/stage' } } }, 'deployed').status === 'pending');
  ok('missing_hash_is_stale', stage({ watcher: { ...readyWatcher, lastDeploy: { ...deploy, workspaceHash: undefined } } }, 'deployed').status === 'stale');
  ok('workspace_edit_invalidates_deploy', stage({ workspaceHash: 'new-hash' }, 'deployed').status === 'stale');
  ok('matching_deploy_passes', stage({}, 'deployed').status === 'pass');
  ok('no_log_unavailable', stage({ watcher: { ...readyWatcher, verdict: { state: 'no_log', detail: 'no log', errorCount: 0 } } }, 'seen').status === 'unavailable');
  ok('stale_log_is_stale', stage({ watcher: { ...readyWatcher, verdict: { state: 'stale', detail: 'old', errorCount: 0 } } }, 'seen').status === 'stale');
  ok('runtime_errors_fail_seen', stage({ watcher: { ...readyWatcher, verdict: { state: 'loaded_with_errors', detail: 'bad', errorCount: 2 } } }, 'seen').status === 'fail');
  ok('clean_watcher_passes_seen', stage({}, 'seen').status === 'pass');
  ok('unconfirmed_experience_pending', stage({}, 'experience').status === 'pending');
  ok('matching_confirmation_passes', stage({ confirmation: { workspaceName: 'W', workspaceHash: 'hash', deployedAt: deploy.deployedAt!, confirmedAt: '2026-07-14T12:05:00.000Z' } }, 'experience').status === 'pass');
  ok('old_confirmation_invalidated', stage({ confirmation: { workspaceName: 'W', workspaceHash: 'old', deployedAt: deploy.deployedAt!, confirmedAt: '2026-07-14T12:05:00.000Z' } }, 'experience').status === 'pending');
  ok('corrupt_confirmation_store_fails_soft', Object.keys(parseExperienceConfirmations('{broken')).length === 0);
  ok('confirmation_store_filters_bad_rows', Object.keys(parseExperienceConfirmations(JSON.stringify({ good: { workspaceName: 'W', workspaceHash: 'h', deployedAt: 'd', confirmedAt: 'c' }, bad: { workspaceName: 2 } }))).join(',') === 'good');

  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}
