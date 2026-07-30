export const RELEASE_PREFERENCES_KEY = 'x4_forge_release_preferences_v1';
export const RELEASE_PREFERENCES_VERSION = 1 as const;

export type ReleasePackagingMode = 'guided' | 'express';

export interface ReleasePreferences {
  version: typeof RELEASE_PREFERENCES_VERSION;
  mode: ReleasePackagingMode;
  expressRiskAcknowledged: boolean;
}

export const DEFAULT_RELEASE_PREFERENCES: ReleasePreferences = {
  version: RELEASE_PREFERENCES_VERSION,
  mode: 'guided',
  expressRiskAcknowledged: false,
};

export function normalizeReleasePreferences(raw: unknown): ReleasePreferences {
  const value = raw && typeof raw === 'object' ? raw as Partial<ReleasePreferences> : {};
  const expressRiskAcknowledged = value.expressRiskAcknowledged === true;
  return {
    version: RELEASE_PREFERENCES_VERSION,
    mode: value.mode === 'express' && expressRiskAcknowledged ? 'express' : 'guided',
    expressRiskAcknowledged,
  };
}

export function parseReleasePreferences(raw: string | null | undefined): ReleasePreferences {
  if (!raw) return normalizeReleasePreferences(undefined);
  try {
    return normalizeReleasePreferences(JSON.parse(raw));
  } catch {
    return normalizeReleasePreferences(undefined);
  }
}

export function runReleasePreferencesSelftest() {
  const checks: Array<{ name: string; pass: boolean }> = [];
  const check = (name: string, pass: boolean) => checks.push({ name, pass });
  check('guided_by_default', normalizeReleasePreferences(undefined).mode === 'guided');
  check('express_requires_acknowledgement', normalizeReleasePreferences({ mode: 'express' }).mode === 'guided');
  check('acknowledged_express_persists', normalizeReleasePreferences({ mode: 'express', expressRiskAcknowledged: true }).mode === 'express');
  check('corrupt_storage_recovers', parseReleasePreferences('{broken').mode === 'guided');
  check('unknown_mode_recovers', normalizeReleasePreferences({ mode: 'automatic', expressRiskAcknowledged: true }).mode === 'guided');
  return { ok: checks.every(entry => entry.pass), checks };
}
