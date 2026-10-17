/**
 * The get-started A/B test (owner 2026-10-17, after a visitor left because the preview
 * emails "weren't the tone I thought would work"): half keep the walk with the first
 * emails written and shown; half never see an email, the walk goes from the companies
 * straight to the campaign, and the copy promises leads, not emails.
 *
 * Drawn on the server (first visit), kept in a cookie the page writes once mounted, and
 * registered on every PostHog event as `gs_arm`. The read: the share of visitors per arm
 * who save a card (`get_started_card_saved`). Alias-free so it carries real unit tests.
 */

import { GET_STARTED_STEPS, type GetStartedStepKey } from "./get-started";

export const GS_ARMS = ["emails", "leads"] as const;
export type GsArm = (typeof GS_ARMS)[number];

export const GS_ARM_COOKIE = "gs_arm";

/** Share of first visits drawn into each arm (owner 2026-10-17: 50 / 50). */
export const GS_ARM_WEIGHTS: Record<GsArm, number> = { emails: 0.5, leads: 0.5 };

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
export function decideGsArm(input: { query: string | null | undefined; cookie: string | null | undefined; random: number }): {
  arm: GsArm;
  fresh: boolean;
} {
  const forced = asGsArm(input.query);
  if (forced) return { arm: forced, fresh: forced !== asGsArm(input.cookie) };
  const kept = asGsArm(input.cookie);
  if (kept) return { arm: kept, fresh: false };
  return { arm: drawGsArm(input.random), fresh: true };
}

/** True when the arm walks the email step (writes and shows the preview emails). */
export function showsEmails(arm: GsArm): boolean {
  return arm === "emails";
}

/** The steps this arm walks, in order (the `leads` arm has no email step). */
export function walkSteps(arm: GsArm): (typeof GET_STARTED_STEPS)[number][] {
  return GET_STARTED_STEPS.filter((st) => st.key !== "email" || showsEmails(arm));
}

/** A step's number as this arm shows it (1-based), or null when the arm skips it. */
export function walkStepNumber(key: GetStartedStepKey, arm: GsArm): number | null {
  const i = walkSteps(arm).findIndex((st) => st.key === key);
  return i < 0 ? null : i + 1;
}

/** The words that name what the walk shows, per arm. */
export const GS_ARM_COPY: Record<GsArm, { promise: readonly string[]; givesNext: string; givesButton: string; givesPick: string }> = {
  emails: {
    promise: ["Your company", "5 companies", "Your first emails"],
    givesNext: "Next, a preview of your first emails. Nothing is sent.",
    givesButton: "Preview my emails",
    givesPick: "Say what you give away, then we write the emails.",
  },
  leads: {
    promise: ["Your company", "Your first leads"],
    givesNext: "Next, a preview of your first leads.",
    givesButton: "Preview my leads",
    givesPick: "Say what you give away, then we find your leads.",
  },
};
