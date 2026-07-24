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
  stoppedBy: 'call' | 'usd' | null;
}

export interface SpendMeter {
  /** Is another call allowed right now? Never throws. */
  check(provider: string): SpendCheck;
  /** Count one outgoing call. */
  record(provider: string): void;
  /** B64-SEC4: attribute an estimated USD cost to a provider (additive). */
  recordCost(provider: string, usd: number): void;
  /** Count one refused call. */
  recordRefusal(provider: string): void;
  snapshot(): { day: string; cap: number; usdCap: number; calls: Record<string, number>; refused: Record<string, number>; usd: Record<string, number>; totalToday: number; totalUsdToday: number };
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

const dayOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function createSpendMeter(
  store: SpendStore,
  dailyCallCap: number,
  now: () => number = () => Date.now(),
  dailyUsdCap = 0, // B64-SEC4: 0 = disabled (legacy behavior — no dollar stop)
): SpendMeter {
  const empty = (day: string): DayUsage => ({ day, calls: {}, refused: {}, usd: {} });
  const load = (): DayUsage => {
    const today = dayOf(now());
    try {
      const parsed = JSON.parse(store.load() || 'null') as DayUsage | null;
      if (parsed && parsed.day === today && parsed.calls) { if (!parsed.usd) parsed.usd = {}; return parsed; }
    } catch { /* corrupt file → fresh day */ }
    return empty(today);
  };
  const save = (u: DayUsage) => { try { store.save(JSON.stringify(u)); } catch { /* metering is best-effort, never fatal */ } };
  const total = (u: DayUsage) => Object.values(u.calls).reduce((a, b) => a + b, 0);
  const totalUsd = (u: DayUsage) => Object.values(u.usd || {}).reduce((a, b) => a + b, 0);

  return {
    check(_provider): SpendCheck {
      const u = load();
      const usedToday = total(u);
      const usdToday = totalUsd(u);
      // The call cap is TOTAL calls per local day across providers — the runaway-loop
      // backstop, not a budget planner. <=0 disables the stop. B64-SEC4 adds an OPTIONAL
      // dollar backstop (dailyUsdCap>0); either limit hitting stops the call.
      const callOk = dailyCallCap <= 0 || usedToday < dailyCallCap;
      const usdOk = dailyUsdCap <= 0 || usdToday < dailyUsdCap;
      const stoppedBy: SpendCheck['stoppedBy'] = callOk ? (usdOk ? null : 'usd') : 'call';
      return { allowed: callOk && usdOk, usedToday, cap: dailyCallCap, usdToday, usdCap: dailyUsdCap, stoppedBy };
    },
    record(provider) {
      const u = load();
      u.calls[provider] = (u.calls[provider] || 0) + 1;
      save(u);
    },
    recordCost(provider, usd) {
      if (!(usd > 0)) return;
      const u = load();
      u.usd = u.usd || {};
      u.usd[provider] = (u.usd[provider] || 0) + usd;
      save(u);
    },
    recordRefusal(provider) {
      const u = load();
      u.refused[provider] = (u.refused[provider] || 0) + 1;
      save(u);
    },
    snapshot() {
      const u = load();
      return { day: u.day, cap: dailyCallCap, usdCap: dailyUsdCap, calls: { ...u.calls }, refused: { ...u.refused }, usd: { ...(u.usd || {}) }, totalToday: total(u), totalUsdToday: totalUsd(u) };
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
  ok('corrupt_store_degrades_fresh', createSpendMeter(store, 5, () => clock).check('x').allowed === true);

  // B64-SEC4: dollar attribution + optional USD cap (additive, default-off).
  ok('estimate_uses_model_pricing',
    Math.abs(estimateCallUsd('claude-opus', 1e6, 0) - 15) < 1e-9 &&
    Math.abs(estimateCallUsd('gemini-2.5-flash', 0, 1e6) - 1.2) < 1e-9,
    `opus=${estimateCallUsd('claude-opus', 1e6, 0)} flash=${estimateCallUsd('gemini-2.5-flash', 0, 1e6)}`);
  ok('unknown_model_uses_default', Math.abs(estimateCallUsd('mystery-model', 1e6, 0) - 3) < 1e-9);
  {
    let t2: string | null = null;
    const s2: SpendStore = { load: () => t2, save: (t) => { t2 = t; } };
    let ck = new Date(2026, 6, 12, 10, 0, 0).getTime();
    // call cap high, USD cap = $1 → dollars are the binding limit
    const um = createSpendMeter(s2, 1000, () => ck, 1.0);
    ok('usd_default_off_never_stops', createSpendMeter(s2, 1000, () => ck, 0).check('claude').allowed === true);
    um.record('claude'); um.recordCost('claude', 0.6);
    ok('usd_under_cap_allows', um.check('claude').allowed === true && Math.abs(um.snapshot().totalUsdToday - 0.6) < 1e-9);
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
