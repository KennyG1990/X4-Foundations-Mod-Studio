/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bridge live-state normalization — Play-In-Editor slice 2 (2026-07-09).
 *
 * An optional external runtime may receive events from the running game; its /health
 * payload plus telemetry DB (`bridge_events`: ts_ms/kind/status/latency, probed
 * real shape) tell the editor whether the game←→bridge←→Player2 chain is alive and
 * how fresh the last in-game activity is. Pure normalization: I/O lives server-side.
 */

export interface BridgeEventRow {
  ts_ms: number;
  kind: string;
  status: string | null;
}

export interface BridgeLiveState {
  bridgeUp: boolean;
  service?: string;
  version?: string;
  player2Ok?: boolean;
  /** an event reached the bridge within the activity window → the game is talking NOW */
  gameActive: boolean;
  lastEventAgoMs: number | null;
  lastEventKind: string | null;
  eventsLastHour: number;
  errorsLastHour: number;
  summary: string;
}

const ACTIVE_WINDOW_MS = 5 * 60_000;

export function normalizeBridgeLiveState(
  health: unknown,
  recentEvents: BridgeEventRow[],
  nowMs: number,
): BridgeLiveState {
  const h = (health && typeof health === 'object' ? health : null) as Record<string, unknown> | null;
  const bridgeUp = !!h && h['ok'] === true;
  const p2 = (h?.['player2'] && typeof h['player2'] === 'object' ? h['player2'] : null) as Record<string, unknown> | null;

  const events = (Array.isArray(recentEvents) ? recentEvents : [])
    .filter(e => e && Number.isFinite(e.ts_ms))
    .sort((a, b) => b.ts_ms - a.ts_ms);
  const last = events[0] || null;
  const lastEventAgoMs = last ? Math.max(0, nowMs - last.ts_ms) : null;
  const hourAgo = nowMs - 3_600_000;
  const lastHour = events.filter(e => e.ts_ms >= hourAgo);
  const errorsLastHour = lastHour.filter(e => (e.status || '').toLowerCase() === 'error' || (e.kind || '').toLowerCase().includes('error')).length;
  const gameActive = bridgeUp && lastEventAgoMs !== null && lastEventAgoMs < ACTIVE_WINDOW_MS;

  const summary = !bridgeUp
    ? 'Optional runtime is unavailable (no /health response).'
    : gameActive
      ? `Bridge UP, game ACTIVE — last in-game event ${Math.round((lastEventAgoMs as number) / 1000)}s ago (${last?.kind}).`
      : lastEventAgoMs !== null
        ? `Bridge UP, game idle — last in-game event ${Math.round(lastEventAgoMs / 60_000)} min ago.`
        : 'Bridge UP, no in-game events in the recent window (game not currently playing).';

  return {
    bridgeUp,
    service: h?.['service'] ? String(h['service']) : undefined,
    version: h?.['version'] ? String(h['version']) : undefined,
    player2Ok: p2 ? p2['ok'] === true : undefined,
    gameActive,
    lastEventAgoMs,
    lastEventKind: last ? String(last.kind || '') : null,
    eventsLastHour: lastHour.length,
    errorsLastHour,
    summary,
  };
}

/* ------------------------------------------------------------------ *
 * Oracle — health/event fixtures mirror the PROBED real shapes.
 * ------------------------------------------------------------------ */

export function runBridgeLiveStateSelftest(): {
  allPassed: boolean; pass: boolean; passed: number; total: number;
  checks: { name: string; pass: boolean; detail?: string }[];
} {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, cond: boolean, detail?: unknown) =>
    checks.push({ name, pass: !!cond, detail: detail === undefined ? undefined : (typeof detail === 'string' ? detail : JSON.stringify(detail)) });

  const NOW = 1_783_304_500_000;
  const health = { ok: true, service: 'external_runtime', version: '0.1.0', bridge: { host: '127.0.0.1', port: 8713 }, player2: { ok: true, client_version: '0.10.67' } };

  const active = normalizeBridgeLiveState(health, [
    { ts_ms: NOW - 30_000, kind: 'request.completed', status: 'ok' },
    { ts_ms: NOW - 90_000, kind: 'request.received', status: 'ok' },
  ], NOW);
  ok('bridge up + recent event → gameActive', active.bridgeUp && active.gameActive && active.player2Ok === true, active.summary);
  ok('freshness math', active.lastEventAgoMs === 30_000 && active.lastEventKind === 'request.completed');

  const idle = normalizeBridgeLiveState(health, [{ ts_ms: NOW - 2 * 3_600_000, kind: 'request.completed', status: 'ok' }], NOW);
  ok('bridge up + stale events → idle, not active', idle.bridgeUp && !idle.gameActive && idle.summary.includes('idle'), idle.summary);
  ok('hour-window counting excludes old events', idle.eventsLastHour === 0);

  const errors = normalizeBridgeLiveState(health, [
    { ts_ms: NOW - 10_000, kind: 'request.completed', status: 'error' },
    { ts_ms: NOW - 20_000, kind: 'request.completed', status: 'ok' },
  ], NOW);
  ok('error status counted', errors.errorsLastHour === 1 && errors.eventsLastHour === 2);

  const down = normalizeBridgeLiveState(null, [], NOW);
  ok('no health → runtime unavailable, never active', !down.bridgeUp && !down.gameActive && down.summary.includes('unavailable'));
  ok('empty events degrade', down.lastEventAgoMs === null && down.eventsLastHour === 0);
  ok('bridge summaries are implementation-neutral',
    active.summary.startsWith('Bridge UP, game ACTIVE')
    && idle.summary.startsWith('Bridge UP, game idle')
    && down.summary === 'Optional runtime is unavailable (no /health response).',
    [active.summary, idle.summary, down.summary]);

  const passed = checks.filter(c => c.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}
