/**
 * The get-started A/B test (owner 2026-10-17, after a visitor left because the preview
 * emails "weren't the tone I thought would work"): both halves see their leads first; the
 * `emails` half then picks its email style (Offer, Direct named, Direct unnamed, an example
 * of each on click, lib/v2/email-angles.ts); the `leads` half goes from the companies
 * straight to the campaign.
 *
 * Drawn on the server (first visit), kept in a cookie the page writes once mounted, and
 * registered on every PostHog event as `gs_arm`. The read: the share of visitors per arm
 * who save a card (`get_started_card_saved`). Alias-free so it carries real unit tests.
 */

import { GET_STARTED_STEPS, type GetStartedStepKey } from "./get-started";

export const GS_ARMS = ["emails", "leads"] as const;
export type GsArm = (typeof GS_ARMS)[number];

export const GS_ARM_COOKIE = "gs_arm";

/** Share of first visits drawn into each arm until the adaptive split has enough to read (owner 2026-10-17: 50 / 50). */
export const GS_ARM_WEIGHTS: Record<GsArm, number> = { emails: 0.5, leads: 0.5 };

/**
 * The adaptive split (owner 2026-10-22): each arm gets the share of new visitors equal to its
 * chance of being the better one at saving a card (Thompson sampling over Beta(1 + cards,
 * 1 + visitors - cards)), never under 20%, and stays 50 / 50 until every arm has 5 cards.
 */
export const GS_ARM_MIN_CARDS = 5;
export const GS_ARM_FLOOR = 0.2;
const GS_ARM_DRAWS = 4000;

export type GsArmStats = Record<GsArm, { visitors: number; cards: number }>;

/** A Gamma(shape, 1) sample (Marsaglia and Tsang), shape >= 1 here. */
function sampleGamma(shape: number, random: () => number): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      // Box-Muller normal; 1 - random() keeps the log argument above zero.
      x = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = 1 - random();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}

function sampleBeta(a: number, b: number, random: () => number): number {
  const x = sampleGamma(a, random);
  return x / (x + sampleGamma(b, random));
}

/** The split new visitors are drawn with, from each arm's visitors and saved cards so far. */
export function adaptiveGsArmWeights(stats: GsArmStats, random: () => number = Math.random): Record<GsArm, number> {
  if (GS_ARMS.some((arm) => stats[arm].cards < GS_ARM_MIN_CARDS)) return { ...GS_ARM_WEIGHTS };
  const wins: Record<GsArm, number> = { emails: 0, leads: 0 };
  for (let i = 0; i < GS_ARM_DRAWS; i++) {
    let best: GsArm = GS_ARMS[0];
    let bestRate = -1;
    for (const arm of GS_ARMS) {
      const { visitors, cards } = stats[arm];
      const rate = sampleBeta(1 + cards, 1 + Math.max(0, visitors - cards), random);
      if (rate > bestRate) [best, bestRate] = [arm, rate];
    }
    wins[best]++;
  }
  const clamped = GS_ARMS.map((arm) => Math.min(1 - GS_ARM_FLOOR, Math.max(GS_ARM_FLOOR, wins[arm] / GS_ARM_DRAWS)));
  const total = clamped.reduce((a, b) => a + b, 0);
  return Object.fromEntries(GS_ARMS.map((arm, i) => [arm, Math.round((clamped[i] / total) * 1000) / 1000])) as Record<GsArm, number>;
}

/** The arm a uniform draw in [0, 1) lands on, walking the weights in a fixed order. */
export function drawGsArm(random: number, weights = GS_ARM_WEIGHTS): GsArm {
  let acc = 0;
  for (const arm of GS_ARMS) {
    acc += weights[arm];
    if (random < acc) return arm;
  }
  return GS_ARMS[GS_ARMS.length - 1];
}

export function asGsArm(value: string | null | undefined): GsArm | null {
  return GS_ARMS.find((a) => a === value) ?? null;
}

/**
 * This visitor's arm: a `?gs_arm=` in the URL (QA), else the cookie, else a fresh draw.
 * `fresh` says the cookie must be written.
 */
export function decideGsArm(input: {
  query: string | null | undefined;
  cookie: string | null | undefined;
  random: number;
  weights?: Record<GsArm, number>;
}): {
  arm: GsArm;
  fresh: boolean;
} {
  const forced = asGsArm(input.query);
  if (forced) return { arm: forced, fresh: forced !== asGsArm(input.cookie) };
  const kept = asGsArm(input.cookie);
  if (kept) return { arm: kept, fresh: false };
  return { arm: drawGsArm(input.random, input.weights), fresh: true };
}

/** True when the arm walks the email step (writes and shows the preview emails). */
export function showsEmails(arm: GsArm): boolean {
  return arm === "emails";
}

/** The steps this arm walks, in order (the `leads` arm has no email step). */
export function walkSteps(arm: GsArm): { key: GetStartedStepKey; label: string }[] {
  return GET_STARTED_STEPS.filter((st) => st.key !== "email" || showsEmails(arm)).map((st) =>
    st.key === "email" ? { key: st.key, label: "Pick your email style" } : { key: st.key, label: st.label },
  );
}

/** A step's number as this arm shows it (1-based), or null when the arm skips it. */
export function walkStepNumber(key: GetStartedStepKey, arm: GsArm): number | null {
  const i = walkSteps(arm).findIndex((st) => st.key === key);
  return i < 0 ? null : i + 1;
}

/** The words that name what the walk shows, per arm. */
export const GS_ARM_COPY: Record<GsArm, { promise: readonly string[]; givesNext: string; givesButton: string; givesPick: string }> = {
  emails: {
    promise: ["Your company", "Your first leads", "Your email style"],
    givesNext: "Next, a preview of your first leads.",
    givesButton: "Preview my leads",
    givesPick: "Say what you give away, then we find your leads.",
  },
  leads: {
    promise: ["Your company", "Your first leads"],
    givesNext: "Next, a preview of your first leads.",
    givesButton: "Preview my leads",
    givesPick: "Say what you give away, then we find your leads.",
  },
};
