/** Browser workspace cache write semantics, isolated for deterministic quota-failure proof. */
export interface WorkspaceCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const WORKSPACE_CACHE_KEY = 'x4_mod_studio_workspace';
export const GIT_HISTORY_CACHE_KEY = 'x4_git_local_history';
export const GIT_BASELINE_CACHE_KEY = 'x4_git_baseline';
export const MAX_LOCAL_HISTORY_ENTRIES = 25;

export function capLocalHistory<T>(history: T[]): T[] {
  return history.slice(0, MAX_LOCAL_HISTORY_ENTRIES);
}

export function persistWorkspaceCache(
  storage: WorkspaceCacheStorage,
  serializedWorkspace: string,
): { ok: true } | { ok: false; error: unknown } {
  const tryPrimary = () => storage.setItem(WORKSPACE_CACHE_KEY, serializedWorkspace);
  try {
    tryPrimary();
    return { ok: true };
  } catch (firstError) {
    try {
      const parsed = JSON.parse(storage.getItem(GIT_HISTORY_CACHE_KEY) || '[]');
      if (Array.isArray(parsed)) {
        const history = capLocalHistory(parsed);
        while (history.length > 0) {
          history.pop();
          storage.setItem(GIT_HISTORY_CACHE_KEY, JSON.stringify(history));
          try { tryPrimary(); return { ok: true }; } catch { /* continue shedding */ }
        }
      }
    } catch { /* malformed/full history falls through to complete eviction */ }

    try {
      storage.removeItem(GIT_HISTORY_CACHE_KEY);
      tryPrimary();
      return { ok: true };
    } catch { /* continue to baseline eviction */ }

    try {
      storage.removeItem(GIT_BASELINE_CACHE_KEY);
      tryPrimary();
      return { ok: true };
    } catch (error) {
      // Failed setItem calls leave the old primary value intact. Never delete it here.
      return { ok: false, error: error || firstError };
    }
  }
}

export function runLocalWorkspaceCacheSelftest() {
  const failedValues = new Map<string, string>([[WORKSPACE_CACHE_KEY, 'last-known-good']]);
  const alwaysFull: WorkspaceCacheStorage = {
    getItem: key => failedValues.get(key) || null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: key => { failedValues.delete(key); },
  };
  const result = persistWorkspaceCache(alwaysFull, 'oversized-replacement');

  const recoveringValues = new Map<string, string>([
    [WORKSPACE_CACHE_KEY, 'old'],
    [GIT_HISTORY_CACHE_KEY, JSON.stringify(Array.from({ length: 30 }, (_, i) => `commit-${i}`))],
    [GIT_BASELINE_CACHE_KEY, 'large-baseline'],
  ]);
  const recovering: WorkspaceCacheStorage = {
    getItem: key => recoveringValues.get(key) || null,
    setItem: (key, value) => {
      const otherBytes = [...recoveringValues.entries()]
        .filter(([existingKey]) => existingKey !== key)
        .reduce((sum, [, existingValue]) => sum + existingValue.length, 0);
      if (otherBytes + value.length > 180) throw new Error('QuotaExceededError');
      recoveringValues.set(key, value);
    },
    removeItem: key => { recoveringValues.delete(key); },
  };
  const recovered = persistWorkspaceCache(recovering, 'new-primary-workspace');
  const checks = [
    { name: 'quota failure is reported', pass: result.ok === false },
    { name: 'quota failure preserves last-known-good cache', pass: alwaysFull.getItem(WORKSPACE_CACHE_KEY) === 'last-known-good' },
    { name: 'history is capped at 25 newest entries', pass: capLocalHistory(Array.from({ length: 30 }, (_, i) => i)).length === 25 },
    { name: 'secondary cache eviction can recover the primary write', pass: recovered.ok && recovering.getItem(WORKSPACE_CACHE_KEY) === 'new-primary-workspace' },
  ];
  return { pass: checks.every(check => check.pass), allPassed: checks.every(check => check.pass), checks };
}
