/**
 * How the service is used and how hard it is pushed, from the AI call log.
 *
 * Asked for in plain terms — "how many credits does a person use, how many
 * questions per sitting, how much load" — to price the plans and size the
 * server. Pure, so the admin service only fetches rows and this does the sums.
 */

export type UsageCall = {
  userId: string;
  /** When the call started — the reservation row is written before the model runs. */
  createdAt: Date;
  latencyMs: number | null;
  firstTokenMs: number | null;
};

/** A quiet gap this long starts a new sitting. */
export const SESSION_GAP_MS = 30 * 60 * 1000;
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

export type Spread = { avg: number; median: number; p90: number; max: number };

export type UsageStats = {
  activeUsers: number;
  /** Questions answered per person in the period. */
  perUser: Spread;
  sessions: number;
  /** Questions per sitting (a run with no gap over 30 minutes). */
  perSession: Spread;
  sessionsPerUser: number;
  load: {
    calls: number;
    /** Most answers being written at the same moment. */
    peakConcurrent: number;
    peakConcurrentAt: string | null;
    /** Busiest single clock hour, Bangkok time. */
    busiestHour: { at: string; calls: number } | null;
    /** Average calls in each hour of the day (0–23, Bangkok). */
    byHourOfDay: number[];
    days: number;
    latencyMs: { p50: number | null; p95: number | null };
    firstTokenMs: { p50: number | null; p95: number | null };
  };
};

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[Math.max(0, i)]!;
}

export function spread(values: number[]): Spread {
  if (!values.length) return { avg: 0, median: 0, p90: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    avg: sum / sorted.length,
    median: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    max: sorted[sorted.length - 1]!,
  };
}

function percentiles(values: Array<number | null>): { p50: number | null; p95: number | null } {
  const v = values.filter((x): x is number => x != null && x >= 0).sort((a, b) => a - b);
  return v.length ? { p50: quantile(v, 0.5), p95: quantile(v, 0.95) } : { p50: null, p95: null };
}

/** "2026-09-30 21:07" in Bangkok time. */
export function bangkokMinuteLabel(d: Date): string {
  return new Date(d.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

/** "2026-09-30 21:00" in Bangkok time. */
export function bangkokHourLabel(d: Date): string {
  return bangkokMinuteLabel(d).slice(0, 13) + ":00";
}

export function computeUsageStats(calls: UsageCall[], periodDays: number): UsageStats {
  const sorted = [...calls].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const byUser = new Map<string, Date[]>();
  for (const c of sorted) {
    const list = byUser.get(c.userId);
    if (list) list.push(c.createdAt);
    else byUser.set(c.userId, [c.createdAt]);
  }
  const sessionSizes: number[] = [];
  for (const times of byUser.values()) {
    let size = 1;
    for (let i = 1; i < times.length; i++) {
      if (times[i]!.getTime() - times[i - 1]!.getTime() > SESSION_GAP_MS) {
        sessionSizes.push(size);
        size = 1;
      } else size += 1;
    }
    sessionSizes.push(size);
  }

  const events: Array<[number, 1 | -1]> = [];
  for (const c of sorted) {
    const start = c.createdAt.getTime();
    // An unfinished or unmeasured call is counted as a one-second blip.
    events.push([start, 1], [start + Math.max(1000, c.latencyMs ?? 0), -1]);
  }
  // Ends sort before starts at the same instant: back-to-back is not overlap.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let live = 0;
  let peak = 0;
  let peakAt: number | null = null;
  for (const [t, d] of events) {
    live += d;
    if (live > peak) {
      peak = live;
      peakAt = t;
    }
  }

  const hours = new Map<string, number>();
  const hourOfDay = new Array<number>(24).fill(0);
  for (const c of sorted) {
    const label = bangkokHourLabel(c.createdAt);
    hours.set(label, (hours.get(label) ?? 0) + 1);
    hourOfDay[Number(label.slice(11, 13))]! += 1;
  }
  let busiest: { at: string; calls: number } | null = null;
  for (const [at, n] of hours) if (!busiest || n > busiest.calls) busiest = { at, calls: n };
  const days = Math.max(1, periodDays);

  return {
    activeUsers: byUser.size,
    perUser: spread([...byUser.values()].map((t) => t.length)),
    sessions: sessionSizes.length,
    perSession: spread(sessionSizes),
    sessionsPerUser: byUser.size ? sessionSizes.length / byUser.size : 0,
    load: {
      calls: sorted.length,
      peakConcurrent: peak,
      peakConcurrentAt: peakAt != null ? bangkokMinuteLabel(new Date(peakAt)) : null,
      busiestHour: busiest,
      byHourOfDay: hourOfDay.map((n) => n / days),
      days,
      latencyMs: percentiles(sorted.map((c) => c.latencyMs)),
      firstTokenMs: percentiles(sorted.map((c) => c.firstTokenMs)),
    },
  };
}
