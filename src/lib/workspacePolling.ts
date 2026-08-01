/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B116 — summary-first workspace polling.
 *
 * The workspace registry already exposes immutable IDs plus version/content heads.
 * Continuous readers compare that small summary and fetch the full (potentially multi-
 * megabyte) workspace only when the selected content head is unknown or changed.
 */
import { sanitizeWorkspace, type ModWorkspace } from '../types';
import { workspaceContentHash, workspaceSnapshotHash } from './workspaceIdentity';

export const WORKSPACE_POLLING_CONTRACT = 'GET /api/agent/workspaces -> changed GET /api/agent/workspace';

export interface WorkspacePollingResponse {
  workspaceId: string;
  version: number;
  workspaceHash: string;
  snapshotHash: string;
  workspace?: ModWorkspace;
}

export type FullWorkspacePollingResponse = WorkspacePollingResponse & { workspace: ModWorkspace };

export type WorkspacePollingPair = Pick<WorkspacePollingResponse, 'workspaceId' | 'workspaceHash' | 'snapshotHash'>;

export function sameWorkspacePollingPair(left: WorkspacePollingPair, right: WorkspacePollingPair): boolean {
  return left.workspaceId === right.workspaceId
    && left.workspaceHash === right.workspaceHash
    && left.snapshotHash === right.snapshotHash;
}

export type WorkspaceAutoAdoptResult =
  | { status: 'applied' | 'already-applied' }
  | { status: 'blocked'; reason: 'authority' | 'invalid-pair' | 'dirty' | 'queued' | 'stale-run' | 'conflict' | 'stale-version' };

interface WorkspaceHead {
  workspaceId: string;
  version: number;
  workspaceHash: string;
  snapshotHash: string;
}

type PollingFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function assertNotAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw abortError('Workspace polling was aborted.');
}

function asHead(value: unknown): WorkspaceHead | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<WorkspaceHead>;
  const workspaceId = String(row.workspaceId || '');
  const workspaceHash = String(row.workspaceHash || '');
  const snapshotHash = String(row.snapshotHash || '');
  const version = Number(row.version);
  if (!/^ws_[a-f0-9]{24}$/i.test(workspaceId) || !workspaceHash || !snapshotHash || !Number.isFinite(version) || version < 1) return null;
  return { workspaceId, workspaceHash, snapshotHash, version };
}

async function responseJson(response: Response, label: string): Promise<Record<string, unknown>> {
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error(`${label} returned invalid JSON.`); }
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  if (!response.ok) {
    const detail = typeof record.error === 'string' ? record.error : `${label} failed (${response.status}).`;
    throw new Error(detail);
  }
  return record;
}

export class WorkspacePollingClient {
  private readonly heads = new Map<string, WorkspaceHead>();

  constructor(
    private readonly fetcher: PollingFetch = (input, init) => globalThis.fetch(input, init),
    private readonly selectedWorkspaceId: () => string = () =>
      typeof window === 'undefined' ? '' : (window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || ''),
  ) {}

  prime(value: WorkspacePollingResponse & { workspace: ModWorkspace }): void {
    const head = asHead(value);
    if (!head) throw new Error('Cannot prime workspace polling with an invalid head.');
    const workspace = sanitizeWorkspace(value.workspace);
    if (workspaceContentHash(workspace) !== head.workspaceHash || workspaceSnapshotHash(workspace) !== head.snapshotHash) {
      throw new Error(`Cannot prime workspace polling with a hash-mismatched snapshot for ${head.workspaceId}.`);
    }
    this.heads.set(head.workspaceId, head);
  }

  invalidate(workspaceId: string, expectedSnapshotHash?: string): void {
    const current = this.heads.get(workspaceId);
    if (!current) return;
    if (expectedSnapshotHash && current.snapshotHash !== expectedSnapshotHash) return;
    this.heads.delete(workspaceId);
  }

  cachedHead(workspaceId: string): WorkspaceHead | null {
    const value = this.heads.get(workspaceId);
    return value ? { ...value } : null;
  }

  async poll(workspaceId: string, signal: AbortSignal): Promise<WorkspacePollingResponse> {
    if (!/^ws_[a-f0-9]{24}$/i.test(workspaceId)) throw new Error('Workspace polling requires an immutable workspace ID.');
    assertNotAborted(signal);
    const summaryResponse = await this.fetcher('/api/agent/workspaces', { signal });
    const summaryBody = await responseJson(summaryResponse, 'Workspace summary');
    assertNotAborted(signal);
    const head = Array.isArray(summaryBody?.workspaces)
      ? summaryBody.workspaces.map(asHead).find((row: WorkspaceHead | null): row is WorkspaceHead => row?.workspaceId === workspaceId)
      : null;
    if (!head) throw new Error(`Workspace summary omitted selected workspace ${workspaceId}.`);

    const cached = this.heads.get(workspaceId);
    if (cached?.workspaceHash === head.workspaceHash && cached.snapshotHash === head.snapshotHash) {
      // A version-only change does not require a multi-megabyte content transfer.
      this.heads.set(workspaceId, head);
      return { ...head };
    }

    if (this.selectedWorkspaceId() !== workspaceId) {
      throw abortError(`Workspace authority changed before ${workspaceId} could fetch its full snapshot.`);
    }
    assertNotAborted(signal);
    const fullResponse = await this.fetcher('/api/agent/workspace', { signal });
    const fullBody = await responseJson(fullResponse, 'Full workspace');
    assertNotAborted(signal);
    if (this.selectedWorkspaceId() !== workspaceId) {
      throw abortError(`Workspace authority changed before ${workspaceId} could apply its full snapshot.`);
    }
    const fullHead = asHead(fullBody);
    if (!fullHead || fullHead.workspaceId !== workspaceId || !fullBody.workspace || typeof fullBody.workspace !== 'object') {
      throw new Error(`Full workspace response did not match selected workspace ${workspaceId}.`);
    }
    const workspace = sanitizeWorkspace(fullBody.workspace);
    const computedHash = workspaceContentHash(workspace);
    const computedSnapshotHash = workspaceSnapshotHash(workspace);
    if (computedHash !== fullHead.workspaceHash || computedSnapshotHash !== fullHead.snapshotHash) {
      throw new Error(`Full workspace response hash mismatch for ${workspaceId}.`);
    }
    if (fullHead.version < head.version || (fullHead.version === head.version && (
      fullHead.workspaceHash !== head.workspaceHash || fullHead.snapshotHash !== head.snapshotHash
    ))) {
      throw new Error(`Full workspace response was older than the selected summary for ${workspaceId}.`);
    }
    // The summary can race a newer committed write. The full response is accepted only
    // after self-validating its own ID/content hash, and that exact newer head is cached.
    this.heads.set(workspaceId, fullHead);
    return { ...fullHead, workspace };
  }
}

export const workspacePollingClient = new WorkspacePollingClient();

export function primeWorkspacePollingSnapshot(value: WorkspacePollingResponse & { workspace: ModWorkspace }): void {
  workspacePollingClient.prime(value);
}

export function invalidateWorkspacePollingHead(workspaceId: string, expectedSnapshotHash?: string): void {
  workspacePollingClient.invalidate(workspaceId, expectedSnapshotHash);
}

export function pollWorkspaceSnapshot(workspaceId: string, signal: AbortSignal): Promise<WorkspacePollingResponse> {
  return workspacePollingClient.poll(workspaceId, signal);
}
