/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GITHUB_DEVICE_MIN_INTERVAL_MS = 5_000;
export const GITHUB_DEVICE_SLOW_DOWN_MS = 5_000;

/** GitHub's slow_down response permanently increases this device flow's cadence. */
export function nextGithubDevicePollIntervalMs(currentMs: number, error?: string): number {
  const current = Math.max(GITHUB_DEVICE_MIN_INTERVAL_MS, Math.floor(currentMs || 0));
  return error === 'slow_down' ? current + GITHUB_DEVICE_SLOW_DOWN_MS : current;
}
