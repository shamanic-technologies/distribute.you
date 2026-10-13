/**
 * The statements a new customer ticks before their card is taken (owner 2026-10-11, reworded
 * 2026-10-12; statement 1 DELETED 2026-10-13: "un fonctionnement à la Google Ads", the customer
 * pays only its campaigns, so nothing to say about what else the credit covers). One per arm of
 * the homepage A/B test: 1: what happens to my card (prepaid: the top-up is added again; plan:
 * it moves up the ladder; postpaid: nothing today, charged on spend steps or at month end).
 * 2: the Terms. The pay button stays off until every box is ticked.
 *
 * The campaign caps are NOT restated here (they stay on the "Your campaign" step).
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

export const TERMS_URL = "https://distribute.you/terms";

/** How many boxes every arm ticks (its card statement, the terms). */
export const CONSENT_STATEMENTS = 2;

/** One statement: its words, and the link that closes it, when it has one. */
export interface ConsentLine {
  text: string;
  link: { label: string; href: string } | null;
}

export type ConsentArm =
  /**
   * Prepaid: the amount paid now is added again each time the credit runs out.
   * `limitUsd`: the monthly charge limit set at onboarding, named in the reload sentence.
   */
  | { kind: "prepaid"; topupUsd: number; limitUsd?: number }
  /**
   * The plan: its monthly amount now; each step is $100 a month more (billing's ladder).
   * `limitUsd`: the monthly charge limit set at onboarding, named in the ladder sentence.
   */
  | { kind: "plan"; monthlyUsd: number; limitUsd?: number }
  /** Postpaid (owner 2026-10-13 A/B arm): nothing charged today, the card pays the spend after. */
  | { kind: "postpaid" };

/** billing's plan ladder steps $100 a month at a time ($99, $199, $299...). */
export const PLAN_STEP_USD = 100;

/**
 * The spend a postpaid card is charged at, one step after the other: billing-service's derived
 * postpaid tiers (`src/lib/topup-tier.ts`: $50, $200, $500 lines), plus the month-end sweep.
 */
export const POSTPAID_CHARGE_STEPS_USD = [50, 200, 500] as const;

function usd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

export function spendConsentLines(input: { arm: ConsentArm }): [ConsentLine, ConsentLine] {
  const { arm } = input;
  const limit = (l: number | undefined) => (l !== undefined ? `, up to my ${usd(l)} monthly limit` : "");
  const card: ConsentLine =
    arm.kind === "prepaid"
      ? {
          // Owner 2026-10-13: the reload, the limit that bounds it, and that the customer stays in control.
          text: `When my credit runs out, ${usd(arm.topupUsd)} is added automatically${limit(arm.limitUsd)}. My campaigns keep running on the budget I set. I can pause them anytime.`,
          link: null,
        }
      : arm.kind === "plan"
        ? {
            text: `When my credit runs out, my plan moves up automatically (${usd(arm.monthlyUsd + PLAN_STEP_USD)}, then ${usd(arm.monthlyUsd + 2 * PLAN_STEP_USD)}, and so on${limit(arm.limitUsd)}). My card is charged for each step.`,
            link: null,
          }
        : {
            text: `Nothing is charged today. I pay what my campaigns spend, never more than their budgets. My card is charged when my spend reaches ${POSTPAID_CHARGE_STEPS_USD.map(usd).join(", then ")}, or at the end of the month. You match my first $100.`,
            link: null,
          };
  const terms: ConsentLine = { text: "I have read and accept the", link: { label: "terms and conditions", href: TERMS_URL } };
  return [card, terms];
}

/** The Terms version the statements refer to (the Terms' "Last updated" date). */
export const TERMS_VERSION = "2026-10-13";

/** billing's consent record (billing-service v0.81.x `PaymentConsent`): stored with the payment. */
export interface PaymentConsentRecord {
  statements: string[];
  terms_version: string;
  accepted_at: string;
  user_agent?: string;
}

/** A statement as the person read it, link words included ("... at our public prices."). */
export function statementAsShown(line: ConsentLine): string {
  return line.link ? `${line.text} ${line.link.label}.` : line.text;
}

/** The record of the boxes just ticked, for billing's dispute file. */
export function consentRecord(lines: readonly ConsentLine[], acceptedAt: Date, userAgent: string | undefined): PaymentConsentRecord {
  return {
    statements: lines.map(statementAsShown),
    terms_version: TERMS_VERSION,
    accepted_at: acceptedAt.toISOString(),
    ...(userAgent ? { user_agent: userAgent.slice(0, 1000) } : {}),
  };
}

