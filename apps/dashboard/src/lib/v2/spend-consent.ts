/**
 * The three statements a new customer ticks before their first payment (owner 2026-10-11,
 * reworded 2026-10-12: "the minimum a user needs to understand what will happen, not be
 * surprised, feel in control of their consent; legal detail stays in the terms"), on both arms
 * of the homepage A/B test. 1: what the credit pays for (everything, not only the campaigns).
 * 2: what happens when it runs out (prepaid: the first top-up is added again; plan: it moves
 * up the ladder, step after step). 3: the Terms. The pay button stays off until all three are
 * ticked.
 *
 * The campaign caps are NOT restated here (they stay on the "Your campaign" step): the credit
 * covers more than the campaigns, so a cap sentence read as a spending ceiling it is not.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

export const CATALOG_URL = "https://distribute.you/catalog";
export const TERMS_URL = "https://distribute.you/terms";

/** One statement: its words, and the link that closes it, when it has one. */
export interface ConsentLine {
  text: string;
  link: { label: string; href: string } | null;
}

export type ConsentArm =
  /** Prepaid: the amount paid now is added again each time the credit runs out. */
  | { kind: "prepaid"; topupUsd: number }
  /** The plan: its monthly amount now; each step is $100 a month more (billing's ladder). */
  | { kind: "plan"; monthlyUsd: number };

/** billing's plan ladder steps $100 a month at a time ($99, $199, $299...). */
export const PLAN_STEP_USD = 100;

function usd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

export function spendConsentLines(input: { arm: ConsentArm }): [ConsentLine, ConsentLine, ConsentLine] {
  const covers: ConsentLine = {
    text: "I understand that my credit covers my campaigns and what I use myself, as well as everything done on my account on my behalf to get me the best results: brand setup, onboarding, A/B testing and more, as detailed in your",
    link: { label: "public prices", href: CATALOG_URL },
  };
  const { arm } = input;
  const runsOut: ConsentLine =
    arm.kind === "prepaid"
      ? { text: `When my credit runs out, ${usd(arm.topupUsd)} is added again automatically. Credit stays valid for 12 months.`, link: null }
      : {
          text: `I understand that each time my credit runs out, my plan upgrades automatically (${usd(arm.monthlyUsd + PLAN_STEP_USD)}, then ${usd(arm.monthlyUsd + 2 * PLAN_STEP_USD)}, and so on) and my card is charged accordingly, so my campaigns keep running as I set them.`,
          link: null,
        };
  const terms: ConsentLine = { text: "I have read and accept the", link: { label: "terms and conditions", href: TERMS_URL } };
  return [covers, runsOut, terms];
}

/** The Terms version the statements refer to (the Terms' "Last updated" date). */
export const TERMS_VERSION = "2026-10-11";

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

