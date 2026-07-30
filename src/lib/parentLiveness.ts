import { EventEmitter } from 'node:events';

export const PARENT_LIVENESS_MODE = 'pipe-v1';
const NONCE_PATTERN = /^[a-f0-9]{32,128}$/i;

export interface ParentLivenessContract {
  mode: typeof PARENT_LIVENESS_MODE;
  parentPid: number;
  nonce: string;
}

export function parseParentLivenessContract(env: NodeJS.ProcessEnv): ParentLivenessContract | null {
  if (env.X4_FORGE_PARENT_MODE !== PARENT_LIVENESS_MODE) return null;
  const parentPid = Number(env.X4_FORGE_PARENT_PID);
  const nonce = String(env.X4_FORGE_PARENT_NONCE || '');
  if (!Number.isSafeInteger(parentPid) || parentPid <= 0 || !NONCE_PATTERN.test(nonce)) return null;
  return { mode: PARENT_LIVENESS_MODE, parentPid, nonce };
}

export interface ParentIpcWatch {
  active: boolean;
  contract: ParentLivenessContract | null;
  release: () => void;
}

/**
 * The pipe is the authority; parentPid is diagnostic only. The OS closes this inherited pipe
 * when the owning extension host disappears, so PID reuse cannot make a dead parent look alive.
 */
export function watchParentIpc(
  env: NodeJS.ProcessEnv,
  input: NodeJS.EventEmitter,
  onParentLost: (contract: ParentLivenessContract) => void,
): ParentIpcWatch {
  const contract = parseParentLivenessContract(env);
  if (!contract) return { active: false, contract: null, release: () => undefined };

  let released = false;
  const onMessage = (message: unknown) => {
    if (!message || typeof message !== 'object') return;
    const candidate = message as Record<string, unknown>;
    if (candidate.type !== 'x4forge-parent-lost' || candidate.nonce !== contract.nonce) return;
    release();
    onParentLost(contract);
  };
  const release = () => {
    if (released) return;
    released = true;
    input.removeListener('message', onMessage);
  };

  input.on('message', onMessage);
  return { active: true, contract, release };
}

export async function runParentLivenessSelftest(): Promise<{
  pass: boolean;
  summary: string;
  checks: Array<{ name: string; pass: boolean }>;
}> {
  const checks: Array<{ name: string; pass: boolean }> = [];
  const check = (name: string, pass: boolean) => checks.push({ name, pass });
  const validEnv = {
    X4_FORGE_PARENT_MODE: PARENT_LIVENESS_MODE,
    X4_FORGE_PARENT_PID: String(process.pid),
    X4_FORGE_PARENT_NONCE: 'a'.repeat(64),
  };

  check('valid_contract_parses', parseParentLivenessContract(validEnv)?.parentPid === process.pid);
  check('missing_contract_is_inactive', parseParentLivenessContract({}) === null);
  check('wrong_mode_is_rejected', parseParentLivenessContract({ ...validEnv, X4_FORGE_PARENT_MODE: 'pid-poll' }) === null);
  check('invalid_pid_is_rejected', parseParentLivenessContract({ ...validEnv, X4_FORGE_PARENT_PID: '-1' }) === null);
  check('invalid_nonce_is_rejected', parseParentLivenessContract({ ...validEnv, X4_FORGE_PARENT_NONCE: 'short' }) === null);

  const unownedInput = new EventEmitter();
  let unownedCalls = 0;
  const inactive = watchParentIpc({}, unownedInput, () => { unownedCalls++; });
  unownedInput.emit('message', { type: 'x4forge-parent-lost', nonce: validEnv.X4_FORGE_PARENT_NONCE });
  check('standalone_process_does_not_watch_stdin', !inactive.active && unownedCalls === 0);

  const ownedInput = new EventEmitter();
  let calls = 0;
  let observedPid = 0;
  const active = watchParentIpc(validEnv, ownedInput, contract => {
    calls++;
    observedPid = contract.parentPid;
  });
  ownedInput.emit('message', { type: 'x4forge-parent-lost', nonce: 'b'.repeat(64) });
  check('wrong_nonce_is_ignored', calls === 0);
  ownedInput.emit('message', { type: 'x4forge-parent-lost', nonce: validEnv.X4_FORGE_PARENT_NONCE });
  check('authenticated_ipc_reports_parent_loss', active.active && calls === 1);
  ownedInput.emit('message', { type: 'x4forge-parent-lost', nonce: validEnv.X4_FORGE_PARENT_NONCE });
  check('ipc_event_is_deduplicated', calls === 1);
  check('parent_pid_is_diagnostic_context', observedPid === process.pid);

  const releasedInput = new EventEmitter();
  let releasedCalls = 0;
  const released = watchParentIpc(validEnv, releasedInput, () => { releasedCalls++; });
  released.release();
  releasedInput.emit('message', { type: 'x4forge-parent-lost', nonce: validEnv.X4_FORGE_PARENT_NONCE });
  check('released_watch_is_inert', releasedCalls === 0);

  const passed = checks.filter(item => item.pass).length;
  return { pass: passed === checks.length, summary: `${passed}/${checks.length}`, checks };
}
