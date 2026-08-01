/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContinuousPollingScheduler, PollingIdentityGate, type PollingEnvironment } from './continuousPolling';

interface FakeTimer { at: number; callback: () => void }

class FakePollingEnvironment implements PollingEnvironment {
  private time = 0;
  private nextId = 1;
  private timers = new Map<number, FakeTimer>();
  private listeners = new Set<() => void>();
  private runnable = true;
  maxTimers = 0;

  now = () => this.time;
  setTimer = (callback: () => void, delayMs: number): number => {
    const id = this.nextId++;
    this.timers.set(id, { at: this.time + Math.max(0, delayMs), callback });
    this.maxTimers = Math.max(this.maxTimers, this.timers.size);
    return id;
  };
  clearTimer = (handle: unknown): void => { this.timers.delete(Number(handle)); };
  isRunnable = (): boolean => this.runnable;
  subscribeStateChange = (callback: () => void): (() => void) => {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  };

  setRunnable(value: boolean): void {
    this.runnable = value;
    for (const listener of [...this.listeners]) listener();
  }

  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      this.time = due[1].at;
      this.timers.delete(due[0]);
      due[1].callback();
    }
    this.time = target;
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

export async function runContinuousPollingSelftest(): Promise<{
  pass: boolean;
  summary: string;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
}> {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const check = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });

  {
    const gate = new PollingIdentityGate('workspace:a');
    check('committed identity accepts its own callbacks', gate.accepts('workspace:a'));
    gate.commit('workspace:b');
    check('committed identity rejects stale callbacks', !gate.accepts('workspace:a') && gate.accepts('workspace:b'));
  }

  // Same resource + same contract = one request, two consumers, one scheduler timer.
  {
    const env = new FakePollingEnvironment();
    const scheduler = new ContinuousPollingScheduler(env);
    let runs = 0;
    const results: string[] = [];
    const shared = {
      resourceKey: 'workspace:ws_a', contract: 'GET /api/agent/workspace', intervalMs: 100, timeoutMs: 50,
      run: async () => { runs += 1; return 'shared'; },
    };
    const offA = scheduler.subscribe({ ...shared, onResult: value => results.push(`a:${value}`) });
    const offB = scheduler.subscribe({ ...shared, intervalMs: 200, onResult: value => results.push(`b:${value}`) });
    let distinctRuns = 0;
    const offDistinct = scheduler.subscribe({
      resourceKey: 'live:distinct', contract: 'GET /api/agent/live', intervalMs: 75, timeoutMs: 40,
      run: async () => { distinctRuns += 1; return 'distinct'; },
    });
    env.advance(0);
    await flushPromises();
    check('same resource is requested once and fanned out', runs === 1 && distinctRuns === 1 && results.join(',') === 'a:shared,b:shared', `${runs}/${distinctRuns}/${results.join(',')}`);
    check('one wake timer is owned across distinct resources and subscribers', env.maxTimers === 1 && scheduler.snapshot().timerArmed, `max=${env.maxTimers}`);
    check('shared resource uses the fastest requested cadence', scheduler.snapshot().resources.find(resource => resource.resourceKey === 'workspace:ws_a')?.intervalMs === 100);
    let mismatch = '';
    try { scheduler.subscribe({ ...shared, contract: 'POST /different', run: async () => 'bad' }); }
    catch (error) { mismatch = String(error); }
    check('contract mismatch is refused before a request', mismatch.includes('refused') && runs === 1, mismatch);
    offA();
    offB();
    offDistinct();
    scheduler.dispose();
  }

  // One broken presentation subscriber cannot starve peer subscribers or the next run.
  {
    const env = new FakePollingEnvironment();
    const scheduler = new ContinuousPollingScheduler(env);
    let healthyResults = 0;
    const originalError = console.error;
    console.error = () => undefined;
    const shared = { resourceKey: 'shared:listener', contract: 'GET shared', intervalMs: 10, run: async () => 'ok' };
    scheduler.subscribe({ ...shared, onResult: () => { throw new Error('render failed'); } });
    scheduler.subscribe({ ...shared, onResult: () => { healthyResults += 1; } });
    env.advance(0);
    await flushPromises();
    env.advance(10);
    await flushPromises();
    console.error = originalError;
    check('throwing subscriber cannot starve peers or cadence', healthyResults === 2 && scheduler.snapshot().timerArmed, `${healthyResults}`);
    scheduler.dispose();
  }

  // A resource cannot overlap; timeout aborts and backs off; success resets failures.
  {
    const env = new FakePollingEnvironment();
    const scheduler = new ContinuousPollingScheduler(env);
    let runs = 0;
    let active = 0;
    let maxActive = 0;
    let shouldHang = true;
    let aborts = 0;
    const errors: string[] = [];
    scheduler.subscribe({
      resourceKey: 'watcher:mod', contract: 'GET watcher', intervalMs: 10, timeoutMs: 20, maxBackoffMs: 80,
      run: signal => {
        runs += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (!shouldHang) { active -= 1; return Promise.resolve('ok'); }
        return new Promise<string>((_resolve, reject) => signal.addEventListener('abort', () => {
          aborts += 1;
          active -= 1;
          reject(signal.reason);
        }, { once: true }));
      },
      onError: error => errors.push(error.name),
    });
    env.advance(0);
    await flushPromises();
    env.advance(19);
    await flushPromises();
    check('a running resource never overlaps itself', runs === 1 && maxActive === 1);
    env.advance(1);
    await flushPromises();
    const timedOut = scheduler.snapshot().resources[0];
    check('deadline aborts and reports one timeout', aborts === 1 && errors.join(',') === 'TimeoutError', `${aborts}/${errors.join(',')}`);
    check('first failure applies exponential backoff', timedOut?.failures === 1 && timedOut.nextDueAt === 40, JSON.stringify(timedOut));
    env.advance(19);
    await flushPromises();
    check('backoff prevents an early retry', runs === 1);
    env.advance(1);
    await flushPromises();
    env.advance(20);
    await flushPromises();
    const failedTwice = scheduler.snapshot().resources[0];
    check('repeated failure doubles the retry delay', runs === 2 && failedTwice?.failures === 2 && failedTwice.nextDueAt === 100, JSON.stringify(failedTwice));
    env.advance(40);
    await flushPromises();
    env.advance(20);
    await flushPromises();
    const capped = scheduler.snapshot().resources[0];
    check('repeated failure reaches the configured backoff cap', runs === 3 && capped?.failures === 3 && capped.nextDueAt === 200, JSON.stringify(capped));
    shouldHang = false;
    env.advance(80);
    await flushPromises();
    const recovered = scheduler.snapshot().resources[0];
    check('success resets failures and restores base cadence', runs === 4 && recovered?.failures === 0 && recovered.nextDueAt === 210, JSON.stringify(recovered));
    env.advance(9);
    await flushPromises();
    check('base cadence does not retry early after recovery', runs === 4);
    env.advance(1);
    await flushPromises();
    check('base cadence resumes after recovery', runs === 5);
    scheduler.dispose();
  }

  // Hidden/offline pause cancels active work, arms no timer, and resumes immediately.
  {
    const env = new FakePollingEnvironment();
    const scheduler = new ContinuousPollingScheduler(env);
    const first = deferred<string>();
    let runs = 0;
    let results = 0;
    let aborts = 0;
    scheduler.subscribe({
      resourceKey: 'live:cues', contract: 'POST cue telemetry', intervalMs: 100, timeoutMs: 500,
      run: signal => {
        runs += 1;
        if (runs > 1) return Promise.resolve('resumed');
        signal.addEventListener('abort', () => { aborts += 1; }, { once: true });
        return first.promise;
      },
      onResult: () => { results += 1; },
    });
    env.advance(0);
    await flushPromises();
    env.setRunnable(false);
    check('pause aborts in-flight work and disarms the wake timer', aborts === 1 && !scheduler.snapshot().timerArmed && !scheduler.snapshot().resources[0]?.running);
    first.resolve('stale');
    await flushPromises();
    check('completion from a paused generation is discarded', results === 0);
    env.setRunnable(true);
    env.advance(0);
    await flushPromises();
    check('resume immediately restarts active resources', runs === 2 && results === 1);
    scheduler.dispose();
  }

  // Removing the final subscriber deletes authority and rejects a late completion.
  {
    const env = new FakePollingEnvironment();
    const scheduler = new ContinuousPollingScheduler(env);
    const late = deferred<string>();
    let aborts = 0;
    let results = 0;
    const off = scheduler.subscribe({
      resourceKey: 'workspace:old', contract: 'GET workspace', intervalMs: 100, timeoutMs: 500,
      run: signal => {
        signal.addEventListener('abort', () => { aborts += 1; }, { once: true });
        return late.promise;
      },
      onResult: () => { results += 1; },
    });
    env.advance(0);
    await flushPromises();
    off();
    check('last unsubscribe aborts and removes the resource', aborts === 1 && scheduler.snapshot().resources.length === 0 && !scheduler.snapshot().timerArmed);
    late.resolve('too late');
    await flushPromises();
    check('late completion after unsubscribe invokes no callback', results === 0);
    scheduler.dispose();
  }

  const passed = checks.filter(item => item.pass).length;
  return { pass: passed === checks.length, summary: `${passed}/${checks.length}`, checks };
}
