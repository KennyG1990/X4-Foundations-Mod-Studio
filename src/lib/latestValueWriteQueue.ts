export interface LatestValueWriteQueue<T> {
  submit(value: T): void;
  whenIdle(): Promise<void>;
}

/**
 * Serialize durable writes without letting stale intermediate UI states form an
 * unbounded queue. A write already in flight is allowed to finish; submissions
 * made while it runs collapse to the newest value.
 */
export function createLatestValueWriteQueue<T>(
  write: (value: T) => Promise<void>,
  onError: (error: unknown) => void = () => undefined,
): LatestValueWriteQueue<T> {
  let pending: T | undefined;
  let hasPending = false;
  let drainPromise: Promise<void> | null = null;

  const drain = async (): Promise<void> => {
    while (hasPending) {
      const value = pending as T;
      pending = undefined;
      hasPending = false;
      try {
        await write(value);
      } catch (error) {
        onError(error);
      }
    }
  };

  return {
    submit(value: T): void {
      pending = value;
      hasPending = true;
      if (!drainPromise) {
        drainPromise = drain().finally(() => {
          drainPromise = null;
        });
      }
    },
    whenIdle(): Promise<void> {
      return drainPromise ?? Promise.resolve();
    },
  };
}

export async function runLatestValueWriteQueueSelftest(): Promise<{
  pass: boolean;
  summary: string;
  checks: Array<{ name: string; pass: boolean }>;
}> {
  const checks: Array<{ name: string; pass: boolean }> = [];
  const ok = (name: string, pass: boolean) => checks.push({ name, pass });

  let releaseFirst: (() => void) | undefined;
  const firstBlocked = new Promise<void>(resolve => { releaseFirst = resolve; });
  const writes: number[] = [];
  const queue = createLatestValueWriteQueue<number>(async value => {
    writes.push(value);
    if (value === 1) await firstBlocked;
  });
  queue.submit(1);
  await Promise.resolve();
  queue.submit(2);
  queue.submit(3);
  releaseFirst?.();
  await queue.whenIdle();
  ok('in_flight_then_latest_only', JSON.stringify(writes) === JSON.stringify([1, 3]));

  const recoveredWrites: string[] = [];
  const errors: string[] = [];
  const recoveringQueue = createLatestValueWriteQueue<string>(async value => {
    recoveredWrites.push(value);
    if (value === 'bad') throw new Error('expected');
  }, error => errors.push(error instanceof Error ? error.message : String(error)));
  recoveringQueue.submit('bad');
  recoveringQueue.submit('newest');
  await recoveringQueue.whenIdle();
  ok('write_error_reported', errors.length === 1 && errors[0] === 'expected');
  ok('write_error_does_not_block_newest', recoveredWrites.at(-1) === 'newest');

  const pass = checks.every(check => check.pass);
  return { pass, summary: `${checks.filter(check => check.pass).length}/${checks.length} checks passed`, checks };
}
