/**
 * The three statements a new customer ticks before their first payment (owner 2026-10-11),
 * on both arms of the homepage A/B test. Google Ads' ease, prepaid or on a plan: the campaigns
 * spend what the customer set, other work is billed on top, and when the credit runs out the
 * service keeps going (prepaid: the first top-up is added again; plan: it moves up one step).
 * The pay button stays off until all three are ticked.
 *
 * The figures are the customer's OWN inputs (the caps they set at the "Your campaign" step, in
 * the period they stated them, and the amount they pay), never a computed stat. What they
 * accept is written in the Terms (section 4), linked from the third statement.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

export const CATALOG_URL = "https://distribute.you/catalog";
export const TERMS_URL = "https://distribute.you/terms";

/** One cap as billing stores it (cents, the period the customer stated it in). */
export interface ConsentCap {
  amountCents: number;
  period: "daily" | "weekly" | "monthly";
}

/** One statement: its words, and the link that closes it, when it has one. */
export interface ConsentLine {
  text: string;
  link: { label: string; href: string } | null;
}

export type ConsentArm =
  /** Prepaid: the amount paid now is added again each time the credit runs out. */
  | { kind: "prepaid"; topupUsd: number }
  /** The plan: its monthly amount now; the next step is $100 a month more (billing's ladder). */
  | { kind: "plan"; monthlyUsd: number };

/** billing's plan ladder steps $100 a month at a time ($99, $199, $299...). */
export const PLAN_STEP_USD = 100;

const PERIOD_WORDS: Record<ConsentCap["period"], string> = { daily: "a day", weekly: "a week", monthly: "a month" };

function usd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/** A cap in the period it was stated in ("$20 a day", "$90 a month"), whole dollars. */
export function capWords(cap: ConsentCap): string {
  return `${usd(Math.round(cap.amountCents / 100))} ${PERIOD_WORDS[cap.period]}`;
}

export function spendConsentLines(input: {
  /** The outreach campaign's max budget. */
  proactive: ConsentCap;
  /** The meeting-booking campaign's max budget, or null when it is off. */
  reactive: ConsentCap | null;
  arm: ConsentArm;
}): [ConsentLine, ConsentLine, ConsentLine] {
  const spend = input.reactive
    ? `My campaigns spend up to ${capWords(input.proactive)} to find clients, and up to ${capWords(input.reactive)} more when prospects reply.`
    : `My campaigns spend up to ${capWords(input.proactive)} to find clients.`;
  const onTop: ConsentLine = {
    text: "I can pay more than that: AI chat, extra lead sourcing, new campaigns and payment fees are billed on top, at our",
    link: { label: "public prices", href: CATALOG_URL },
  };
  const runsOut =
    input.arm.kind === "prepaid"
      ? `When my credit runs out, ${usd(input.arm.topupUsd)} is added again automatically. Credit stays valid for 12 months. See the`
      : `When my credit runs out, my plan moves up to ${usd(input.arm.monthlyUsd + PLAN_STEP_USD)} a month and my card is charged automatically. See the`;
  return [
    { text: spend, link: null },
    onTop,
    { text: runsOut, link: { label: "terms", href: TERMS_URL } },
  ];
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

