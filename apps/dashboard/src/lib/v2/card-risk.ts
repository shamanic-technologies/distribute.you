/**
 * What the wall says once a card is saved that automatic charges may not reach (owner
 * 2026-10-13): a PREPAID card, or one issued in a country that blocks off-session charges
 * (India). The verdict is billing-service's (`GET /v1/accounts/saved_payment_method`:
 * `postpaid_allowed` + `postpaid_refused_reason`, from stripe-service's card facts on both
 * acquirers); an unknown card (a Link payment hides it) is not refused by billing, so it is
 * not warned about here either. Nothing is re-graded from the raw facts.
 *
 * Per arm of the homepage A/B test:
 * - plan and prepaid: a warning, then "Use another card" or "Continue anyway";
 * - postpaid: post-paid cannot run on that card, so "Use another card" or "Switch to
 *   prepaid", no way past.
 *
 * Post-paid also asks the bank to hold the first $50 step on the card (billing v0.83.52,
 * owner 2026-10-22): a refused hold comes back as billing's 409 `postpaid_card_hold_refused`
 * and opens the same choice, with billing's own sentence (the bank's words inside) as the
 * body. The wall never mentions the hold otherwise (disclosed in the Terms only).
 *
 * No "x2 if answered in a minute" figure: we hold no sourced number for it, so the cost
 * of an unanswered prospect is said in words.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

export type CardRefusal = "prepaid_card" | "card_issuing_country_unsupported" | "card_hold_refused";

/** billing's card facts at card entry, as the wall reads them. */
export interface CardFacts {
  saved: boolean;
  /** The saved method's id: a new card is told apart from the one it replaces. */
  methodId: string | null;
  postpaidAllowed: boolean;
  refusedReason: CardRefusal | null;
  /** ISO 3166-1 alpha-2, as billing states it; null = not stated. */
  country: string | null;
  /** billing's customer-readable sentence when the bank refused the card check (409 only). */
  refusalMessage?: string | null;
}

export type CardRiskArm = "subscription" | "prepaid" | "postpaid";

export interface CardRiskCopy {
  title: string;
  body: string;
  /** The way forward: always another card. */
  primary: string;
  /** The other button: go on anyway (plan, prepaid) or move to prepaid (postpaid). */
  secondary: string;
  secondaryAction: "continue" | "prepaid";
}

/** "India" for "IN", in English; the code itself when the runtime cannot name it. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function reasonLine(facts: CardFacts): string {
  if (facts.refusedReason === "prepaid_card") return "This card is a prepaid card.";
  if (facts.country) return `Cards issued in ${countryName(facts.country)} often refuse automatic charges.`;
  return "This card refuses automatic charges.";
}

/** The warning for this card on this arm, or null when billing sees nothing to warn about. */
export function cardRiskCopy(arm: CardRiskArm, facts: CardFacts): CardRiskCopy | null {
  if (!facts.saved || facts.postpaidAllowed) return null;
  const reason = reasonLine(facts);
  if (arm === "postpaid" && facts.refusedReason === "card_hold_refused") {
    return {
      title: "Post-paid does not work with this card",
      body: facts.refusalMessage ?? "Your bank refused a check on this card.",
      primary: "Use another card",
      secondary: "Switch to prepaid",
      secondaryAction: "prepaid",
    };
  }
  if (arm === "postpaid") {
    return {
      title: "Post-paid does not work with this card",
      body: `${reason} Post-paid charges your card after your campaigns spend, so it needs a card that accepts automatic charges.`,
      primary: "Use another card",
      secondary: "Switch to prepaid",
      secondaryAction: "prepaid",
    };
  }
  const what = arm === "subscription" ? "plan upgrades" : "automatic top-ups";
  const one = arm === "subscription" ? "an upgrade" : "a top-up";
  return {
    title: `Your ${what} may fail on this card`,
    body: `${reason} When ${one} fails, your campaigns stop. Interested prospects can then wait for an answer, and a late answer loses deals.`,
    primary: "Use another card",
    secondary: "Continue anyway",
    secondaryAction: "continue",
  };
}

/** billing's 409 on `PUT payment_mode {postpaid}` for a refused card, as card facts. */
export function postpaidRefusalFacts(body: Record<string, unknown> | undefined, known: CardFacts | null): CardFacts | null {
  if (body?.code === "postpaid_card_hold_refused") {
    const message = typeof body.error === "string" && body.error.trim() ? body.error.trim() : null;
    if (!message) console.error("[get-started] billing refused the card check with no sentence", body);
    return {
      saved: true,
      methodId: known?.methodId ?? null,
      postpaidAllowed: false,
      refusedReason: "card_hold_refused",
      country: known?.country ?? null,
      refusalMessage: message,
    };
  }
  if (!body || body.code !== "postpaid_card_not_allowed") return null;
  const r = body.card_refused_reason;
  return {
    saved: true,
    methodId: known?.methodId ?? null,
    postpaidAllowed: false,
    refusedReason: r === "prepaid_card" || r === "card_issuing_country_unsupported" ? r : null,
    country: known?.country ?? null,
  };
}
