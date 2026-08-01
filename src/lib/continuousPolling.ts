/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kimi R13 — one owner for continuous browser reads.
 *
 * A resource key is an authority boundary, not a label. Subscribers may share a
 * key only when their explicit contract strings are identical. One request then
 * fans out to every current subscriber. Bounded workflows such as OAuth device
 * flow and corpus scanning deliberately do not use this scheduler.
 */

export interface PollRunMeta {
  resourceKey: string;
  runId: number;
  startedAt: number;
}

export interface ContinuousPollingSubscription<T> {
  resourceKey: string;
  contract: string;
  intervalMs: number;
  timeoutMs?: number;
  maxBackoffMs?: number;
  run: (signal: AbortSignal, meta: PollRunMeta) => Promise<T>;
  onStart?: (meta: PollRunMeta) => void;
  onResult?: (value: T, meta: PollRunMeta) => void;
  onError?: (error: Error, meta: PollRunMeta) => void;
}

export interface PollingEnvironment {
  now(): number;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(handle: unknown): void;
  isRunnable(): boolean;
  subscribeStateChange(callback: () => void): () => void;
}

export interface PollingResourceSnapshot {
  resourceKey: string;
  contract: string;
  subscribers: number;
  intervalMs: number;
  timeoutMs: number;
  failures: number;
  running: boolean;
  nextDueAt: number;
}

export interface PollingSchedulerSnapshot {
  runnable: boolean;
  timerArmed: boolean;
  resources: PollingResourceSnapshot[];
}

/** Commit-time authority gate used by React adapters. Rendered identities do not
 * become authoritative until their layout effect commits; abandoned renders cannot
 * invalidate the still-mounted subscription. */
export class PollingIdentityGate {
  constructor(private currentIdentity: string) {}
  commit(identity: string): void { this.currentIdentity = identity; }
  accepts(identity: string): boolean { return this.currentIdentity === identity; }
}

export function stalePollingAuthorityError(resourceKey: string): Error {
  const error = new Error(`Continuous polling authority changed before "${resourceKey}" completed.`);
  error.name = 'AbortError';
  return error;
}

type AnySubscription = ContinuousPollingSubscription<unknown>;

interface RunningPoll {
  id: number;
  meta: PollRunMeta;
  controller: AbortController;
  deadlineAt: number;
}

interface PollingResource {
  resourceKey: string;
  contract: string;
  subscribers: Map<number, AnySubscription>;
  intervalMs: number;
  timeoutMs: number;
  maxBackoffMs: number;
  failures: number;
  nextDueAt: number;
  running: RunningPoll | null;
}

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_BACKOFF_MS = 60_000;

function positiveMs(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved <= 0) throw new Error(`${label} must be a positive finite number.`);
  return Math.max(1, Math.round(resolved));
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/** Short, deterministic identity for dynamic query/body inputs. A collision is safe:
 * the full contract string still differs and subscription is refused. */
export function pollingResourceKey(scope: string, identity: unknown): string {
  const text = typeof identity === 'string' ? identity : JSON.stringify(identity);
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + i), 0x85ebca6b) >>> 0;
  }
  return `${scope}:${text.length}:${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

export async function fetchPollingJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(input, { ...init, signal });
  const data = await response.json();
  if (!response.ok) {
    const detail = data && typeof data === 'object' && 'error' in data ? String(data.error) : `Polling request failed (${response.status}).`;
    throw new Error(detail);
  }
  return data as T;
}

export class ContinuousPollingScheduler {
  private readonly resources = new Map<string, PollingResource>();
  private timer: unknown | null = null;
  private nextSubscriberId = 1;
  private nextRunId = 1;
  private runnable: boolean;
  private readonly unsubscribeEnvironment: () => void;

  constructor(private readonly environment: PollingEnvironment) {
    this.runnable = environment.isRunnable();
    this.unsubscribeEnvironment = environment.subscribeStateChange(() => this.handleEnvironmentChange());
  }

  subscribe<T>(subscription: ContinuousPollingSubscription<T>): () => void {
    const resourceKey = subscription.resourceKey.trim();
    const contract = subscription.contract.trim();
    if (!resourceKey) throw new Error('Continuous polling resourceKey is required.');
    if (!contract) throw new Error(`Continuous polling contract is required for "${resourceKey}".`);

    const normalized: AnySubscription = {
      ...subscription,
      resourceKey,
      contract,
      intervalMs: positiveMs(subscription.intervalMs, subscription.intervalMs, 'intervalMs'),
      timeoutMs: positiveMs(subscription.timeoutMs, DEFAULT_TIMEOUT_MS, 'timeoutMs'),
      maxBackoffMs: positiveMs(subscription.maxBackoffMs, DEFAULT_MAX_BACKOFF_MS, 'maxBackoffMs'),
      run: subscription.run as AnySubscription['run'],
      onResult: subscription.onResult as AnySubscription['onResult'],
    };

    let resource = this.resources.get(resourceKey);
    if (resource && resource.contract !== contract) {
      throw new Error(`Continuous polling resource "${resourceKey}" already uses contract "${resource.contract}"; refused "${contract}".`);
    }
    if (!resource) {
      resource = {
        resourceKey,
        contract,
        subscribers: new Map(),
        intervalMs: normalized.intervalMs,
        timeoutMs: normalized.timeoutMs!,
        maxBackoffMs: normalized.maxBackoffMs!,
        failures: 0,
        nextDueAt: this.environment.now(),
        running: null,
      };
      this.resources.set(resourceKey, resource);
    }

    const subscriberId = this.nextSubscriberId++;
    resource.subscribers.set(subscriberId, normalized);
    this.recomputePolicy(resource);
    this.schedule();

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const current = this.resources.get(resourceKey);
      if (!current) return;
      current.subscribers.delete(subscriberId);
      if (current.subscribers.size === 0) {
        this.cancelRunning(current, 'The final continuous polling subscriber was removed.');
        this.resources.delete(resourceKey);
      } else {
        this.recomputePolicy(current);
      }
      this.schedule();
    };
  }

  snapshot(): PollingSchedulerSnapshot {
    return {
      runnable: this.runnable,
      timerArmed: this.timer !== null,
      resources: [...this.resources.values()].map(resource => ({
        resourceKey: resource.resourceKey,
        contract: resource.contract,
        subscribers: resource.subscribers.size,
        intervalMs: resource.intervalMs,
        timeoutMs: resource.timeoutMs,
        failures: resource.failures,
        running: resource.running !== null,
        nextDueAt: resource.nextDueAt,
      })).sort((a, b) => a.resourceKey.localeCompare(b.resourceKey)),
    };
  }

  dispose(): void {
    this.clearWakeTimer();
    for (const resource of this.resources.values()) this.cancelRunning(resource, 'Continuous polling scheduler disposed.');
    this.resources.clear();
    this.unsubscribeEnvironment();
  }

  private recomputePolicy(resource: PollingResource): void {
    const subscribers = [...resource.subscribers.values()];
    resource.intervalMs = Math.min(...subscribers.map(value => value.intervalMs));
    resource.timeoutMs = Math.min(...subscribers.map(value => value.timeoutMs ?? DEFAULT_TIMEOUT_MS));
    resource.maxBackoffMs = Math.max(resource.intervalMs, Math.min(...subscribers.map(value => value.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS)));
  }

  private handleEnvironmentChange(): void {
    const nextRunnable = this.environment.isRunnable();
    if (nextRunnable === this.runnable) return;
    this.runnable = nextRunnable;
    this.clearWakeTimer();
    const now = this.environment.now();
    for (const resource of this.resources.values()) {
      if (!nextRunnable) this.cancelRunning(resource, 'Continuous polling paused while the browser is hidden or offline.');
      resource.nextDueAt = now;
    }
    if (nextRunnable) this.schedule();
  }

  private cancelRunning(resource: PollingResource, reason: string): void {
    const running = resource.running;
    if (!running) return;
    resource.running = null;
    running.controller.abort(new Error(reason));
  }

  private clearWakeTimer(): void {
    if (this.timer === null) return;
    this.environment.clearTimer(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    this.clearWakeTimer();
    if (!this.runnable || this.resources.size === 0) return;
    let nextAt = Number.POSITIVE_INFINITY;
    for (const resource of this.resources.values()) {
      nextAt = Math.min(nextAt, resource.running ? resource.running.deadlineAt : resource.nextDueAt);
    }
    if (!Number.isFinite(nextAt)) return;
    this.timer = this.environment.setTimer(() => {
      this.timer = null;
      this.wake();
    }, Math.max(0, nextAt - this.environment.now()));
  }

  private wake(): void {
    if (!this.runnable) return;
    const now = this.environment.now();
    for (const resource of [...this.resources.values()]) {
      if (resource.running && resource.running.deadlineAt <= now) {
        const error = new Error(`Continuous polling resource "${resource.resourceKey}" exceeded its ${resource.timeoutMs} ms deadline.`);
        error.name = 'TimeoutError';
        this.failRun(resource, resource.running, error);
      }
    }
    for (const resource of [...this.resources.values()]) {
      if (!resource.running && resource.subscribers.size > 0 && resource.nextDueAt <= now) this.startRun(resource);
    }
    this.schedule();
  }

  private startRun(resource: PollingResource): void {
    const runner = resource.subscribers.values().next().value as AnySubscription | undefined;
    if (!runner) return;
    const startedAt = this.environment.now();
    const meta: PollRunMeta = { resourceKey: resource.resourceKey, runId: this.nextRunId++, startedAt };
    const running: RunningPoll = {
      id: meta.runId,
      meta,
      controller: new AbortController(),
      deadlineAt: startedAt + resource.timeoutMs,
    };
    resource.running = running;
    for (const subscriber of resource.subscribers.values()) {
      try { subscriber.onStart?.(meta); }
      catch (error) { this.reportSubscriberError(resource.resourceKey, 'onStart', error); }
    }

    Promise.resolve()
      .then(() => runner.run(running.controller.signal, meta))
      .then(value => this.completeRun(resource.resourceKey, running, value))
      .catch(error => this.rejectRun(resource.resourceKey, running, error));
  }

  private completeRun(resourceKey: string, running: RunningPoll, value: unknown): void {
    const resource = this.resources.get(resourceKey);
    if (!resource || resource.running?.id !== running.id) return;
    resource.running = null;
    resource.failures = 0;
    resource.nextDueAt = this.environment.now() + resource.intervalMs;
    for (const subscriber of resource.subscribers.values()) {
      try { subscriber.onResult?.(value, running.meta); }
      catch (error) { this.reportSubscriberError(resource.resourceKey, 'onResult', error); }
    }
    this.schedule();
  }

  private rejectRun(resourceKey: string, running: RunningPoll, error: unknown): void {
    const resource = this.resources.get(resourceKey);
    if (!resource || resource.running?.id !== running.id) return;
    this.failRun(resource, running, asError(error));
    this.schedule();
  }

  private failRun(resource: PollingResource, running: RunningPoll, error: Error): void {
    if (resource.running?.id !== running.id) return;
    resource.running = null;
    if (!running.controller.signal.aborted) running.controller.abort(error);
    resource.failures += 1;
    const multiplier = Math.pow(2, Math.min(resource.failures, 10));
    resource.nextDueAt = this.environment.now() + Math.min(resource.intervalMs * multiplier, resource.maxBackoffMs);
    for (const subscriber of resource.subscribers.values()) {
      try { subscriber.onError?.(error, running.meta); }
      catch (listenerError) { this.reportSubscriberError(resource.resourceKey, 'onError', listenerError); }
    }
  }

  private reportSubscriberError(resourceKey: string, phase: string, error: unknown): void {
    // A presentation callback must never seize the scheduler or starve peer subscribers.
    console.error(`[continuous-polling] ${resourceKey} subscriber ${phase} failed`, error);
  }
}

export function createBrowserPollingEnvironment(): PollingEnvironment {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      now: () => Date.now(),
      setTimer: callback => setTimeout(callback, 0),
      clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
      isRunnable: () => true,
      subscribeStateChange: () => () => undefined,
    };
  }
  return {
    now: () => Date.now(),
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: handle => window.clearTimeout(handle as number),
    isRunnable: () => document.visibilityState !== 'hidden' && navigator.onLine !== false,
    subscribeStateChange: callback => {
      document.addEventListener('visibilitychange', callback);
      window.addEventListener('online', callback);
      window.addEventListener('offline', callback);
      return () => {
        document.removeEventListener('visibilitychange', callback);
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
      };
    },
  };
}

export const continuousPollingScheduler = new ContinuousPollingScheduler(createBrowserPollingEnvironment());

if (typeof window !== 'undefined') {
  (window as Window & { __X4_CONTINUOUS_POLLING__?: { snapshot: () => PollingSchedulerSnapshot } }).__X4_CONTINUOUS_POLLING__ = {
    snapshot: () => continuousPollingScheduler.snapshot(),
  };
}
