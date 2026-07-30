import type { Server } from 'node:http';

export const CLIENT_API_DEADLINE_MS = 30_000;
export const CLIENT_LONG_API_DEADLINE_MS = 150_000;
export const HTTP_HEADERS_DEADLINE_MS = 15_000;
export const HTTP_REQUEST_BODY_DEADLINE_MS = 30_000;
export const HTTP_RESPONSE_DEADLINE_MS = 180_000;
export const HTTP_KEEP_ALIVE_MS = 5_000;
export const SYNC_COMMAND_DEADLINE_MS = 60_000;
export const RUN_JOB_MIN_TIMEOUT_MS = 100;
export const RUN_JOB_DEFAULT_TIMEOUT_MS = 15 * 60_000;
export const RUN_JOB_MAX_TIMEOUT_MS = 30 * 60_000;

const LONG_API_PREFIXES = [
  '/api/ai/',
  '/api/agent/architect',
  '/api/agent/compile',
  '/api/agent/generate',
  '/api/agent/package',
  '/api/agent/project/validate',
  '/api/agent/round-trip-check',
  '/api/agent/self-heal',
];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function clientRequestDeadlineMs(
  input: RequestInfo | URL,
  origin: string,
): number | null {
  try {
    const url = new URL(requestUrl(input), origin);
    if (url.origin !== origin || !url.pathname.startsWith('/api/')) return null;
    return LONG_API_PREFIXES.some(prefix => url.pathname.startsWith(prefix))
      ? CLIENT_LONG_API_DEADLINE_MS
      : CLIENT_API_DEADLINE_MS;
  } catch {
    return null;
  }
}

export interface AbortDeadline {
  signal: AbortSignal;
  didTimeout: () => boolean;
  release: () => void;
}

export function createAbortDeadline(upstream: AbortSignal | null | undefined, timeoutMs: number): AbortDeadline {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort(upstream?.reason);

  if (upstream?.aborted) forwardAbort();
  else upstream?.addEventListener('abort', forwardAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException(`API request exceeded its ${timeoutMs} ms deadline.`, 'TimeoutError'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    release: () => {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', forwardAbort);
    },
  };
}

export function timeoutError(timeoutMs: number): Error {
  const error = new Error(`API request exceeded its ${timeoutMs} ms deadline.`);
  error.name = 'TimeoutError';
  return error;
}

export type RunJobTimeoutResult =
  | { ok: true; timeoutMs: number }
  | { ok: false; error: string };

export function resolveRunJobTimeout(value: unknown): RunJobTimeoutResult {
  if (value === undefined || value === null) return { ok: true, timeoutMs: RUN_JOB_DEFAULT_TIMEOUT_MS };
  if (typeof value !== 'number' || !Number.isInteger(value) || value < RUN_JOB_MIN_TIMEOUT_MS || value > RUN_JOB_MAX_TIMEOUT_MS) {
    return {
      ok: false,
      error: `timeoutMs must be an integer from ${RUN_JOB_MIN_TIMEOUT_MS} to ${RUN_JOB_MAX_TIMEOUT_MS}.`,
    };
  }
  return { ok: true, timeoutMs: value };
}

export function responseDeadlineFromEnv(value: string | undefined): number {
  if (value === undefined) return HTTP_RESPONSE_DEADLINE_MS;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= RUN_JOB_MIN_TIMEOUT_MS && parsed <= HTTP_RESPONSE_DEADLINE_MS
    ? parsed
    : HTTP_RESPONSE_DEADLINE_MS;
}

export function configureHttpServerDeadlines(server: Server): void {
  server.headersTimeout = HTTP_HEADERS_DEADLINE_MS;
  server.requestTimeout = HTTP_REQUEST_BODY_DEADLINE_MS;
  server.keepAliveTimeout = HTTP_KEEP_ALIVE_MS;
}

export async function runRequestDeadlineSelftest(): Promise<{
  pass: boolean;
  summary: string;
  checks: Array<{ name: string; pass: boolean }>;
}> {
  const checks: Array<{ name: string; pass: boolean }> = [];
  const check = (name: string, pass: boolean) => checks.push({ name, pass });

  check('same_origin_api_is_bounded', clientRequestDeadlineMs('/api/status', 'http://127.0.0.1:3000') === CLIENT_API_DEADLINE_MS);
  check('long_api_gets_larger_budget', clientRequestDeadlineMs('/api/agent/project/validate', 'http://127.0.0.1:3000') === CLIENT_LONG_API_DEADLINE_MS);
  check('cross_origin_is_untouched', clientRequestDeadlineMs('https://example.test/api/status', 'http://127.0.0.1:3000') === null);
  check('non_api_is_untouched', clientRequestDeadlineMs('/assets/app.js', 'http://127.0.0.1:3000') === null);
  const defaultJobTimeout = resolveRunJobTimeout(undefined);
  check('job_default_is_finite', defaultJobTimeout.ok && defaultJobTimeout.timeoutMs === RUN_JOB_DEFAULT_TIMEOUT_MS);
  check('job_min_is_accepted', resolveRunJobTimeout(RUN_JOB_MIN_TIMEOUT_MS).ok);
  check('job_max_is_accepted', resolveRunJobTimeout(RUN_JOB_MAX_TIMEOUT_MS).ok);
  check('job_below_min_is_rejected', !resolveRunJobTimeout(RUN_JOB_MIN_TIMEOUT_MS - 1).ok);
  check('job_above_max_is_rejected', !resolveRunJobTimeout(RUN_JOB_MAX_TIMEOUT_MS + 1).ok);
  check('job_non_integer_is_rejected', !resolveRunJobTimeout(100.5).ok);
  check('bad_response_env_falls_back', responseDeadlineFromEnv('not-a-number') === HTTP_RESPONSE_DEADLINE_MS);

  const caller = new AbortController();
  caller.abort(new Error('caller cancelled'));
  const callerDeadline = createAbortDeadline(caller.signal, 1000);
  check('caller_abort_is_preserved', callerDeadline.signal.aborted && !callerDeadline.didTimeout());
  callerDeadline.release();

  const elapsedDeadline = createAbortDeadline(undefined, 5);
  await new Promise(resolve => setTimeout(resolve, 15));
  check('elapsed_deadline_aborts', elapsedDeadline.signal.aborted && elapsedDeadline.didTimeout());
  elapsedDeadline.release();

  const fakeServer = {} as Server;
  configureHttpServerDeadlines(fakeServer);
  check('http_deadlines_are_applied',
    fakeServer.headersTimeout === HTTP_HEADERS_DEADLINE_MS &&
    fakeServer.requestTimeout === HTTP_REQUEST_BODY_DEADLINE_MS &&
    fakeServer.keepAliveTimeout === HTTP_KEEP_ALIVE_MS);

  const passed = checks.filter(item => item.pass).length;
  return { pass: passed === checks.length, summary: `${passed}/${checks.length}`, checks };
}
