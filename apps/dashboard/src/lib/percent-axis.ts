/**
 * A percent chart's y axis: 0, half, top, the top a round number just above the highest
 * point (never above 100%). A rate of 0.7% and one of 38% both read on three clean ticks.
 *
 * Alias-free on purpose (real unit tests, no `@/` at runtime).
 */
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 75, 100];

export function percentAxis(maxPct: number): { top: number; ticks: number[] } {
  const top = STEPS.find((s) => s >= maxPct) ?? 100;
  return { top, ticks: [0, top / 2, top] };
}

/** A tick label: one decimal under 10%, whole above. */
export function percentTick(v: number): string {
  if (v === 0) return "0%";
  return `${v < 10 ? Number(v.toFixed(2)).toString() : Math.round(v)}%`;
}
