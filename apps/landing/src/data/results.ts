// Client results — "$ generated in pipeline, on autopilot".
//
// SINGLE SOURCE for the landing proof graphs. Swap to real data by editing ONLY
// this file (same shape) and flipping SAMPLE_DATA to false. Every $ shown on the
// landing pipeline section comes from here.
//
// Value model (from the positioning discussion): pipeline $ generated for a
// client = events we measure × the client's conversion rate × their LTV.
//   - sales cold email:  events = positive replies  → customer
//   - journalists / PR:   events = press-referral site visits → customer
// We store the resulting pipelineUsd so the swap to real data is a drop-in, but
// it MUST equal round(events × convRate × ltvUsd) — asserted at module load so a
// hand-edited mismatch fails loud instead of rendering a lie.

export type ResultChannel = "sales" | "journalists";

export interface ClientResult {
  name: string;
  domain: string; // for logo.dev via ProviderAvatar
  channel: ResultChannel;
  spendUsd: number;
  eventsLabel: string; // e.g. "positive replies", "press-referral visits"
  events: number;
  convRate: number; // event → paying customer
  ltvUsd: number;
  pipelineUsd: number; // = round(events × convRate × ltvUsd)
}

export interface PipelinePoint {
  period: string;
  salesUsd: number; // cumulative
  journalistsUsd: number; // cumulative
}

/** Flip to false once real client data is wired in. Drives the "sample data" badge. */
export const SAMPLE_DATA = true;

export const CLIENT_RESULTS: ClientResult[] = [
  { name: "prompthub.ai", domain: "prompthub.ai", channel: "sales", spendUsd: 520, eventsLabel: "positive replies", events: 42, convRate: 0.18, ltvUsd: 3300, pipelineUsd: 24948 },
  { name: "mailmesh.com", domain: "mailmesh.com", channel: "sales", spendUsd: 480, eventsLabel: "positive replies", events: 31, convRate: 0.15, ltvUsd: 3900, pipelineUsd: 18135 },
  { name: "voiceform.io", domain: "voiceform.io", channel: "sales", spendUsd: 360, eventsLabel: "positive replies", events: 19, convRate: 0.12, ltvUsd: 3250, pipelineUsd: 7410 },
  { name: "linearclone.dev", domain: "linearclone.dev", channel: "journalists", spendUsd: 300, eventsLabel: "press-referral visits", events: 1420, convRate: 0.004, ltvUsd: 1700, pipelineUsd: 9656 },
  { name: "coldcopy.ai", domain: "coldcopy.ai", channel: "journalists", spendUsd: 280, eventsLabel: "press-referral visits", events: 960, convRate: 0.005, ltvUsd: 1060, pipelineUsd: 5088 },
];

// Cumulative pipeline $ over the trailing 8 weeks, split by channel.
export const PIPELINE_SERIES: PipelinePoint[] = [
  { period: "W1", salesUsd: 3200, journalistsUsd: 600 },
  { period: "W2", salesUsd: 8100, journalistsUsd: 1800 },
  { period: "W3", salesUsd: 14000, journalistsUsd: 3400 },
  { period: "W4", salesUsd: 21500, journalistsUsd: 5500 },
  { period: "W5", salesUsd: 29800, journalistsUsd: 7900 },
  { period: "W6", salesUsd: 38000, journalistsUsd: 10300 },
  { period: "W7", salesUsd: 44600, journalistsUsd: 12600 },
  { period: "W8", salesUsd: 50493, journalistsUsd: 14744 },
];

// ── Fail-loud aggregates (no silent fallback) ──────────────────────────────
if (CLIENT_RESULTS.length === 0) {
  throw new Error("[results] CLIENT_RESULTS is empty — the pipeline section has nothing to render.");
}
for (const c of CLIENT_RESULTS) {
  const expected = Math.round(c.events * c.convRate * c.ltvUsd);
  if (c.pipelineUsd !== expected) {
    throw new Error(
      `[results] ${c.name}: pipelineUsd ${c.pipelineUsd} ≠ events×conv×ltv ${expected} — fix the inputs, don't fake the total.`,
    );
  }
}

export const totalSpendUsd = CLIENT_RESULTS.reduce((s, c) => s + c.spendUsd, 0);
export const totalPipelineUsd = CLIENT_RESULTS.reduce((s, c) => s + c.pipelineUsd, 0);
export const salesPipelineUsd = CLIENT_RESULTS.filter((c) => c.channel === "sales").reduce((s, c) => s + c.pipelineUsd, 0);
export const journalistsPipelineUsd = CLIENT_RESULTS.filter((c) => c.channel === "journalists").reduce((s, c) => s + c.pipelineUsd, 0);
export const blendedRoi = totalPipelineUsd / totalSpendUsd;
