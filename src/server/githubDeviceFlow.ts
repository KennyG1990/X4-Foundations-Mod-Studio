/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { nextGithubDevicePollIntervalMs } from '../lib/githubDeviceFlow';

type DeviceFlowResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

export type DeviceFlowFetch = (url: string, init: RequestInit) => Promise<DeviceFlowResponse>;

interface PollGithubDeviceTokenOptions {
  clientId: string;
  deviceCode: string;
  signal: AbortSignal;
  isCurrent(): boolean;
  persistToken(token: string): void;
  fetchImpl?: DeviceFlowFetch;
}

export type GithubDeviceTokenPollResult =
  | { cancelled: true }
  | { connected: true; token_type?: string; scope?: string; login?: string }
  | { pending: true; error?: string; interval?: number };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

/** One server-side device poll. Persistence is the commit point and is liveness-gated. */
export async function pollGithubDeviceToken(options: PollGithubDeviceTokenOptions): Promise<GithubDeviceTokenPollResult> {
  const fetchImpl = options.fetchImpl || ((url, init) => fetch(url, init));
  const current = () => options.isCurrent() && !options.signal.aborted;
  const response = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'x4-md-studio' },
    body: JSON.stringify({
      client_id: options.clientId,
      device_code: options.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
    signal: options.signal,
  });
  const data = record(await response.json());
  if (!current()) return { cancelled: true };

  const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
  if (!accessToken) {
    return {
      pending: true,
      error: typeof data.error === 'string' ? data.error : undefined,
      interval: typeof data.interval === 'number' ? data.interval : undefined,
    };
  }

  let login: string | undefined;
  try {
    const userResponse = await fetchImpl('https://api.github.com/user', {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${accessToken}`,
        'User-Agent': 'x4-md-studio',
      },
      signal: options.signal,
    });
    const user = record(await userResponse.json());
    login = typeof user.login === 'string' ? user.login : undefined;
  } catch {
    if (!current()) return { cancelled: true };
    // Login lookup is non-fatal; owner remains manually editable.
  }
  if (!current()) return { cancelled: true };

  options.persistToken(accessToken);
  return {
    connected: true,
    token_type: typeof data.token_type === 'string' ? data.token_type : undefined,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
    login,
  };
}

export async function runGithubDeviceFlowSelftest() {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const check = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });

  let releaseToken!: (value: unknown) => void;
  const heldToken = new Promise<unknown>(resolve => { releaseToken = resolve; });
  let current = true;
  let persisted = '';
  const cancelledRun = pollGithubDeviceToken({
    clientId: 'client',
    deviceCode: 'device',
    signal: new AbortController().signal,
    isCurrent: () => current,
    persistToken: token => { persisted = token; },
    fetchImpl: async () => ({ ok: true, json: () => heldToken }),
  });
  current = false;
  releaseToken({ access_token: 'must-not-persist' });
  const cancelled = await cancelledRun;
  check('late token after cancellation is not persisted', 'cancelled' in cancelled && cancelled.cancelled && persisted === '');

  let request = 0;
  const connected = await pollGithubDeviceToken({
    clientId: 'client',
    deviceCode: 'device',
    signal: new AbortController().signal,
    isCurrent: () => true,
    persistToken: token => { persisted = token; },
    fetchImpl: async () => {
      request += 1;
      return request === 1
        ? { ok: true, json: async () => ({ access_token: 'server-only', token_type: 'bearer', scope: 'repo' }) }
        : { ok: true, json: async () => ({ login: 'fixture-user' }) };
    },
  });
  check('current token is persisted exactly at the commit point', persisted === 'server-only' && 'connected' in connected && connected.connected);
  check('successful response exposes metadata but never the token', JSON.stringify(connected).includes('fixture-user') && !JSON.stringify(connected).includes('server-only'));

  const firstSlow = nextGithubDevicePollIntervalMs(5_000, 'slow_down');
  const secondSlow = nextGithubDevicePollIntervalMs(firstSlow, 'slow_down');
  const pending = nextGithubDevicePollIntervalMs(secondSlow, 'authorization_pending');
  check('slow_down persists and accumulates for the flow', firstSlow === 10_000 && secondSlow === 15_000 && pending === 15_000, `${firstSlow}/${secondSlow}/${pending}`);

  const passed = checks.filter(item => item.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, summary: `${passed}/${checks.length}`, checks };
}
