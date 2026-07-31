/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI spend meter (BACKLOG B25 — from the 2026-07-11 standing-hazard sweep).
 *
 * `callMultiProviderAI` is the single chokepoint for ALL paid AI calls (~10 call
 * sites; one orchestration request can fan out 5 provider calls). Gates existed
 * (tier default-off, per-call token caps, origin-locked keys) but nothing METERED
 * cumulative spend or LIMITED a runaway day — the exact shape that cost $256 on
 * optional external runtime projects. This meter counts per-provider daily calls at the
 * chokepoint and soft-stops past a configurable daily cap.
 *
 * Pure logic with injected store/clock (oracle-testable); the server persists to
 * data/ai-usage.json. Zero behavior change while the AI tier is off — no calls
 * reach the chokepoint at all.
 */

export interface SpendStore {
  load(): string | null;
  save(text: string): void;
}

interface DayUsage {
  /** YYYY-MM-DD (local) the counters belong to — rollover resets them. */
  day: string;
  calls: Record<string, number>;
  /** Calls REFUSED by the cap (kept for the day, visibility into pressure). */
  refused: Record<string, number>;
  /** B64-SEC4: estimated USD spent per provider today (additive; absent in legacy files). */
  usd?: Record<string, number>;
}

export interface SpendCheck {
  allowed: boolean;
  usedToday: number;
  cap: number;
  /** B64-SEC4: dollar dimension (0/0 = disabled = legacy behavior). */
  usdToday: number;
  usdCap: number;
  /** Which limit stopped the call when !allowed ('call' | 'usd' | null). */
  stoppedBy: 'call' | 'usd' | 'meter' | null;
  /** False means a configured safety cap could not prove or reserve its durable state. */
  meterAvailable: boolean;
  meterError?: string;
}

export interface SpendMeter {
  /** Is another call allowed right now? Never throws. */
  check(provider: string, pendingUsd?: number): SpendCheck;
  /** Count one outgoing call. */
  record(provider: string): void;
  /** Atomically reserve one outgoing call and its estimated cost before dispatch. */
  reserve(provider: string, usd: number): void;
  /** B64-SEC4: attribute an estimated USD cost to a provider (additive). */
  recordCost(provider: string, usd: number): void;
  /** Count one refused call. */
  recordRefusal(provider: string): void;
  snapshot(): { day: string; cap: number; usdCap: number; calls: Record<string, number>; refused: Record<string, number>; usd: Record<string, number>; totalToday: number; totalUsdToday: number; meterAvailable: boolean; meterError?: string };
}

/**
 * B64-SEC4: coarse per-model USD pricing ($ per million tokens, input+output blended
 * conservatively). This is a runaway-DOLLAR BACKSTOP estimate, not an accounting ledger —
 * matched by model-id substring, default applied when unknown. Update as prices move.
 */
const MODEL_PRICING: Array<{ match: RegExp; inPerMtok: number; outPerMtok: number }> = [
  { match: /gpt-4o-mini|gemini-[\d.]*-flash|haiku/i, inPerMtok: 0.30, outPerMtok: 1.20 },
  { match: /gpt-4o|gemini-[\d.]*-pro|sonnet/i, inPerMtok: 3.00, outPerMtok: 15.00 },
  { match: /opus|gpt-4(?!o)/i, inPerMtok: 15.00, outPerMtok: 75.00 },
];
const DEFAULT_PRICING = { inPerMtok: 3.00, outPerMtok: 15.00 };

/** Estimate one call's USD cost from its model + (estimated) token counts. Never throws. */
export function estimateCallUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING.find(r => r.match.test(model || '')) || DEFAULT_PRICING;
  const usd = (Math.max(0, inputTokens) / 1e6) * p.inPerMtok + (Math.max(0, outputTokens) / 1e6) * p.outPerMtok;
  return Number.isFinite(usd) ? usd : 0;
}

/** Parse an opt-in cap without allowing malformed configuration to disable its fallback. */
export function parseSpendCap(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const dayOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function isLocalDayStamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function isCounterMap(value: unknown): value is Record<string, number> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every(count => typeof count === 'number' && Number.isFinite(count) && count >= 0);
}

export function createSpendMeter(
  store: SpendStore,
  dailyCallCap: number,
  now: () => number = () => Date.now(),
  dailyUsdCap = 0, // B64-SEC4: 0 = disabled (legacy behavior — no dollar stop)
): SpendMeter {
  const empty = (day: string): DayUsage => ({ day, calls: {}, refused: {}, usd: {} });
  const meterRequired = dailyCallCap > 0 || dailyUsdCap > 0;
  const load = (): { usage: DayUsage; available: boolean; error?: string } => {
    const today = dayOf(now());
    try {
      const text = store.load();
      if (text === null) return { usage: empty(today), available: true };
      const parsed = JSON.parse(text) as DayUsage | null;
      const valid = !!parsed && isLocalDayStamp(parsed.day) && isCounterMap(parsed.calls) &&
        isCounterMap(parsed.refused) && (parsed.usd === undefined || isCounterMap(parsed.usd));
      if (valid && parsed.day === today) {
        return { usage: { ...parsed, usd: parsed.usd || {} }, available: true };
      }
      // Only a proven PRIOR day may roll over. A future row means the host clock moved
      // backwards (or the ledger was tampered with); treating it as zero would bypass a cap.
      if (valid && parsed.day < today) return { usage: empty(today), available: true };
      if (valid && parsed.day > today) throw new Error(`usage file day ${parsed.day} is ahead of local day ${today}`);
      throw new Error('usage file has an invalid shape');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return meterRequired
        ? { usage: empty(today), available: false, error: message }
        : { usage: empty(today), available: true, error: message };
    }
  };
  const save = (u: DayUsage) => {
    try {
      store.save(JSON.stringify(u));
    } catch (error) {
      if (meterRequired) {
        throw new Error(`AI spend meter could not reserve durable usage: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  const total = (u: DayUsage) => Object.values(u.calls).reduce((a, b) => a + b, 0);
  const totalUsd = (u: DayUsage) => Object.values(u.usd || {}).reduce((a, b) => a + b, 0);

  return {
    check(_provider, pendingUsd = 0): SpendCheck {
      const loaded = load();
      const u = loaded.usage;
      const usedToday = total(u);
      const usdToday = totalUsd(u);
      if (!loaded.available) {
        return { allowed: false, usedToday, cap: dailyCallCap, usdToday, usdCap: dailyUsdCap, stoppedBy: 'meter', meterAvailable: false, meterError: loaded.error };
      }
      // The call cap is TOTAL calls per local day across providers — the runaway-loop
      // backstop, not a budget planner. <=0 disables the stop. B64-SEC4 adds an OPTIONAL
      // dollar backstop (dailyUsdCap>0); either limit hitting stops the call.
      const callOk = dailyCallCap <= 0 || usedToday < dailyCallCap;
      const boundedPendingUsd = Number.isFinite(pendingUsd) ? Math.max(0, pendingUsd) : Number.POSITIVE_INFINITY;
      const usdOk = dailyUsdCap <= 0 || usdToday + boundedPendingUsd <= dailyUsdCap;
      const stoppedBy: SpendCheck['stoppedBy'] = callOk ? (usdOk ? null : 'usd') : 'call';
      return { allowed: callOk && usdOk, usedToday, cap: dailyCallCap, usdToday, usdCap: dailyUsdCap, stoppedBy, meterAvailable: true };
    },
    record(provider) {
      const loaded = load();
      if (!loaded.available) throw new Error(`AI spend meter is unavailable: ${loaded.error || 'unknown persistence error'}`);
      const u = loaded.usage;
      u.calls[provider] = (u.calls[provider] || 0) + 1;
      save(u);
    },
    reserve(provider, usd) {
      const loaded = load();
      if (!loaded.available) throw new Error(`AI spend meter is unavailable: ${loaded.error || 'unknown persistence error'}`);
      const u = loaded.usage;
      u.calls[provider] = (u.calls[provider] || 0) + 1;
      if (usd > 0) {
        u.usd = u.usd || {};
        u.usd[provider] = (u.usd[provider] || 0) + usd;
      }
      save(u);
    },
    recordCost(provider, usd) {
      if (!(usd > 0)) return;
      const loaded = load();
      if (!loaded.available) throw new Error(`AI spend meter is unavailable: ${loaded.error || 'unknown persistence error'}`);
      const u = loaded.usage;
      u.usd = u.usd || {};
      u.usd[provider] = (u.usd[provider] || 0) + usd;
      save(u);
    },
    recordRefusal(provider) {
      const loaded = load();
      if (!loaded.available) throw new Error(`AI spend meter is unavailable: ${loaded.error || 'unknown persistence error'}`);
      const u = loaded.usage;
      u.refused[provider] = (u.refused[provider] || 0) + 1;
      save(u);
    },
    snapshot() {
      const loaded = load();
      const u = loaded.usage;
      return {
        day: u.day,
        cap: dailyCallCap,
        usdCap: dailyUsdCap,
        calls: { ...u.calls },
        refused: { ...u.refused },
        usd: { ...(u.usd || {}) },
        totalToday: total(u),
        totalUsdToday: totalUsd(u),
        meterAvailable: loaded.available,
        ...(loaded.error ? { meterError: loaded.error } : {}),
      };
    },
  };
}

/* ------------------------------------------------------------------ *
 * Oracle
 * ------------------------------------------------------------------ */

export function runAiSpendMeterSelftest(): {
  allPassed: boolean; pass: boolean; passed: number; total: number;
  checks: { name: string; pass: boolean; detail?: string }[];
} {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, cond: boolean, detail?: string) => checks.push({ name, pass: !!cond, detail });

  let text: string | null = null;
  const store: SpendStore = { load: () => text, save: (t) => { text = t; } };
  let clock = new Date(2026, 6, 11, 10, 0, 0).getTime();
  const m = createSpendMeter(store, 3, () => clock);

  ok('fresh_allows', m.check('gemini').allowed === true);
  m.record('gemini'); m.record('gemini'); m.record('claude');
  ok('counts_per_provider', m.snapshot().calls['gemini'] === 2 && m.snapshot().calls['claude'] === 1);
  ok('cap_is_cross_provider_total', m.check('openai').allowed === false, JSON.stringify(m.check('openai')));
  m.recordRefusal('openai');
  ok('refusals_tracked', m.snapshot().refused['openai'] === 1);

  clock += 24 * 3600 * 1000; // next local day → counters roll
  ok('daily_rollover_resets', m.check('gemini').allowed === true && m.snapshot().totalToday === 0);

  const unlimited = createSpendMeter(store, 0, () => clock);
  for (let i = 0; i < 10; i++) unlimited.record('gemini');
  ok('cap_zero_never_stops', unlimited.check('gemini').allowed === true);

  text = '{corrupt';
  const corruptCapped = createSpendMeter(store, 5, () => clock).check('x');
  ok('corrupt_store_fails_closed_when_capped', corruptCapped.allowed === false && corruptCapped.stoppedBy === 'meter' && corruptCapped.meterAvailable === false);
  const corruptSnapshot = createSpendMeter(store, 5, () => clock).snapshot();
  ok('corrupt_store_is_explicit_in_readout', corruptSnapshot.meterAvailable === false && /JSON/.test(corruptSnapshot.meterError || ''));
  text = JSON.stringify({ day: '2020-01-01' });
  ok('malformed_prior_day_cannot_reset_cap', createSpendMeter(store, 5, () => clock).check('x').meterAvailable === false);
  const tomorrow = dayOf(clock + 24 * 3600 * 1000);
  text = JSON.stringify({ day: tomorrow, calls: { gemini: 2 }, refused: {}, usd: { gemini: 0.25 } });
  const futureDated = createSpendMeter(store, 5, () => clock).check('x');
  ok('future_dated_ledger_fails_closed_when_capped', futureDated.allowed === false && futureDated.stoppedBy === 'meter' && /ahead|future/i.test(futureDated.meterError || ''));
  ok('corrupt_store_degrades_only_when_caps_disabled', createSpendMeter(store, 0, () => clock, 0).check('x').allowed === true);
  const readFailure = createSpendMeter({ load: () => { throw new Error('read denied'); }, save: () => undefined }, 5, () => clock).check('x');
  ok('read_failure_fails_closed_when_capped', readFailure.allowed === false && readFailure.stoppedBy === 'meter' && /read denied/.test(readFailure.meterError || ''));
  let writeFailureBlocked = false;
  try {
    createSpendMeter({ load: () => null, save: () => { throw new Error('disk full'); } }, 5, () => clock).record('gemini');
  } catch (error) { writeFailureBlocked = /could not reserve durable usage.*disk full/.test(String(error)); }
  ok('write_failure_blocks_reservation_when_capped', writeFailureBlocked);
  let combinedReservationWrites = 0;
  let combinedText: string | null = null;
  const combined = createSpendMeter({
    load: () => combinedText,
    save: (next) => { combinedReservationWrites += 1; combinedText = next; },
  }, 5, () => clock, 1);
  combined.reserve('gemini', 0.25);
  ok('call_and_cost_reserve_in_one_durable_write', combinedReservationWrites === 1 && combined.snapshot().calls.gemini === 1 && combined.snapshot().usd.gemini === 0.25);
  let disabledWriteThrew = false;
  try { createSpendMeter({ load: () => null, save: () => { throw new Error('disk full'); } }, 0, () => clock, 0).record('gemini'); } catch { disabledWriteThrew = true; }
  ok('write_failure_is_nonblocking_only_when_caps_disabled', disabledWriteThrew === false);

  // B64-SEC4: dollar attribution + optional USD cap (additive, default-off).
  ok('estimate_uses_model_pricing',
    Math.abs(estimateCallUsd('claude-opus', 1e6, 0) - 15) < 1e-9 &&
    Math.abs(estimateCallUsd('gemini-2.5-flash', 0, 1e6) - 1.2) < 1e-9,
    `opus=${estimateCallUsd('claude-opus', 1e6, 0)} flash=${estimateCallUsd('gemini-2.5-flash', 0, 1e6)}`);
  ok('unknown_model_uses_default', Math.abs(estimateCallUsd('mystery-model', 1e6, 0) - 3) < 1e-9);
  ok('invalid_call_cap_uses_safe_fallback', parseSpendCap('not-a-number', 300) === 300 && parseSpendCap('-1', 300) === 300);
  ok('explicit_zero_cap_remains_disabled', parseSpendCap('0', 300) === 0);
  {
    let t2: string | null = null;
    const s2: SpendStore = { load: () => t2, save: (t) => { t2 = t; } };
    let ck = new Date(2026, 6, 12, 10, 0, 0).getTime();
    // call cap high, USD cap = $1 → dollars are the binding limit
    const um = createSpendMeter(s2, 1000, () => ck, 1.0);
    ok('usd_default_off_never_stops', createSpendMeter(s2, 1000, () => ck, 0).check('claude').allowed === true);
    um.record('claude'); um.recordCost('claude', 0.6);
    ok('usd_under_cap_allows', um.check('claude').allowed === true && Math.abs(um.snapshot().totalUsdToday - 0.6) < 1e-9);
    ok('pending_cost_that_would_cross_cap_is_refused', um.check('claude', 0.41).allowed === false && um.check('claude', 0.4).allowed === true);
    um.record('claude'); um.recordCost('claude', 0.6); // total $1.20 ≥ $1 cap
    const stopped = um.check('claude');
    ok('usd_cap_stops_and_attributes', stopped.allowed === false && stopped.stoppedBy === 'usd' && Math.abs(um.snapshot().usd['claude'] - 1.2) < 1e-9,
      JSON.stringify(stopped));
    ck += 24 * 3600 * 1000;
    ok('usd_rolls_over_daily', um.check('claude').allowed === true && um.snapshot().totalUsdToday === 0);
  }

  const passed = checks.filter(c => c.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}
