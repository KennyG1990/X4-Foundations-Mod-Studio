/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  continuousPollingScheduler,
  PollingIdentityGate,
  stalePollingAuthorityError,
  type ContinuousPollingSubscription,
  type PollRunMeta,
} from './continuousPolling';

export interface UseContinuousPollingOptions<T> extends ContinuousPollingSubscription<T> {
  enabled?: boolean;
}

export function useContinuousPolling<T>(options: UseContinuousPollingOptions<T>): void {
  const subscriptionIdentity = JSON.stringify([
    options.enabled !== false,
    options.resourceKey,
    options.contract,
    options.intervalMs,
    options.timeoutMs ?? null,
    options.maxBackoffMs ?? null,
  ]);
  const runRef = useRef(options.run);
  const onStartRef = useRef(options.onStart);
  const onResultRef = useRef(options.onResult);
  const onErrorRef = useRef(options.onError);
  const identityGateRef = useRef<PollingIdentityGate | null>(null);
  if (!identityGateRef.current) identityGateRef.current = new PollingIdentityGate(subscriptionIdentity);

  // Commit callbacks and authority together. Updating these refs during render lets
  // an old passive-effect subscription cross into a new workspace/mod/cue identity.
  useLayoutEffect(() => {
    identityGateRef.current!.commit(subscriptionIdentity);
    runRef.current = options.run;
    onStartRef.current = options.onStart;
    onResultRef.current = options.onResult;
    onErrorRef.current = options.onError;
  });

  useEffect(() => {
    if (options.enabled === false) return;
    const subscribedIdentity = subscriptionIdentity;
    const accepts = () => identityGateRef.current!.accepts(subscribedIdentity);
    return continuousPollingScheduler.subscribe<T>({
      resourceKey: options.resourceKey,
      contract: options.contract,
      intervalMs: options.intervalMs,
      timeoutMs: options.timeoutMs,
      maxBackoffMs: options.maxBackoffMs,
      run: (signal: AbortSignal, meta: PollRunMeta) => accepts()
        ? runRef.current(signal, meta)
        : Promise.reject(stalePollingAuthorityError(options.resourceKey)),
      onStart: meta => { if (accepts()) onStartRef.current?.(meta); },
      onResult: (value, meta) => { if (accepts()) onResultRef.current?.(value, meta); },
      onError: (error, meta) => { if (accepts()) onErrorRef.current?.(error, meta); },
    });
  }, [
    options.enabled,
    options.resourceKey,
    options.contract,
    options.intervalMs,
    options.timeoutMs,
    options.maxBackoffMs,
    subscriptionIdentity,
  ]);
}
