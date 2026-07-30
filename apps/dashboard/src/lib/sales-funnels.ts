// The sales funnels a brand can sell through. A funnel is one chain from the
// first signal we can buy (a positive reply, or a click onto the site) down to a
// paid client, and it owns everything that chain needs priced: its own
// conversion rates, its own lifetime revenue, and its own landing page.
//
// Only value imports that carry no "@" alias live here — vitest does not resolve
// the alias, so this module stays directly unit-testable (the BrandOptimizationGoal
// import is type-only and is erased at build time).

import type { BrandOptimizationGoal, BrandSalesEconomics } from "@/lib/api";
import { formatLocaleInteger, formatLocaleNumberInputValue, parseLocaleNumberInput } from "./format-number";
import { bareHost, validateDestination } from "./click-destination-validation";

export type SalesFunnelKey = "reply_meeting" | "visit_signup" | "visit_form";

/** Rate fields, named exactly as brand-service stores them. */
export type FunnelRateKey =
  | "replyToMeetingPct"
  | "meetingToClosePct"
  | "visitToSignupPct"
  | "signupToPaidClientPct"
  | "visitToFormSubmissionPct"
  | "formSubmissionToPaidClientPct";

/**
 * A booking destination is a scheduling page (Calendly, Cal.com, HubSpot), which
 * lives on someone else's domain by nature, so it is validated as a plain URL.
 * A page destination is the brand's own site and goes through the same
 * on-domain check as the Click Destination card.
 */
export type FunnelDestinationKind = "booking" | "page";

export type FunnelRateField = { key: FunnelRateKey; label: string; tip: string };

export type SalesFunnelDef = {
  key: SalesFunnelKey;
  /** The chain, rendered as the funnel's title. */
  steps: [string, string, string];
  /** What a campaign optimizes for while this is the primary funnel. */
  goal: BrandOptimizationGoal;
  /** The first step is a click onto the brand's site, so a domain is required. */
  requiresWebsite: boolean;
  rates: FunnelRateField[];
  destination: {
    kind: FunnelDestinationKind;
    label: string;
    hint: string;
    placeholder: string;
  };
  /**
   * Palette tone. Written as whole class strings because Tailwind cannot see a
   * class assembled at runtime. All three background tints are in the
   * `html.dark` remap in globals.css, so they hold up in dark mode.
   */
  tone: { iconBg: string; iconText: string };
};

export const SALES_FUNNELS: SalesFunnelDef[] = [
  {
    key: "reply_meeting",
    steps: ["Positive reply", "Sales meeting", "Paid client"],
    goal: "sales_meetings",
    requiresWebsite: false,
    rates: [
      {
        key: "replyToMeetingPct",
        label: "Positive reply → meeting",
        tip: "Of leads who reply positively, the share you turn into a booked meeting.",
      },
      {
        key: "meetingToClosePct",
        label: "Meeting → paid client",
        tip: "Of leads who book a meeting, the share that become paying customers.",
      },
    ],
    destination: {
      kind: "booking",
      label: "Booking link",
      hint: "The scheduling page we send a lead to once they reply.",
      placeholder: "https://cal.com/yourteam/30min",
    },
    tone: { iconBg: "bg-purple-50", iconText: "text-purple-600" },
  },
  {
    key: "visit_signup",
    steps: ["Website visit", "Signup", "Paid client"],
    goal: "signups",
    requiresWebsite: true,
    rates: [
      {
        key: "visitToSignupPct",
        label: "Website visit → signup",
        tip: "Of leads who visit your website, the share that sign up.",
      },
      {
        key: "signupToPaidClientPct",
        label: "Signup → paid client",
        tip: "Of leads who sign up, the share that become paying customers.",
      },
    ],
    destination: {
      kind: "page",
      label: "Destination page",
      hint: "The page on your site an outreach click lands on.",
      placeholder: "https://yoursite.com/signup",
    },
    tone: { iconBg: "bg-blue-50", iconText: "text-blue-600" },
  },
  {
    key: "visit_form",
    steps: ["Website visit", "Form filled", "Paid client"],
    goal: "form_submissions",
    requiresWebsite: true,
    rates: [
      {
        key: "visitToFormSubmissionPct",
        label: "Website visit → form filled",
        tip: "Of leads who visit your website, the share that submit a form.",
      },
      {
        key: "formSubmissionToPaidClientPct",
        label: "Form filled → paid client",
        tip: "Of leads who submit a form, the share that become paying customers.",
      },
    ],
    destination: {
      kind: "page",
      label: "Destination page",
      hint: "The page on your site an outreach click lands on.",
      placeholder: "https://yoursite.com/contact",
    },
    tone: { iconBg: "bg-orange-50", iconText: "text-orange-600" },
  },
];

export function salesFunnelByKey(key: SalesFunnelKey): SalesFunnelDef {
  const def = SALES_FUNNELS.find((f) => f.key === key);
  if (!def) throw new Error(`Unknown sales funnel: ${key}`);
  return def;
}

export type FunnelDraft = {
  rates: Partial<Record<FunnelRateKey, string>>;
  lifetimeRevenueUsd: string;
  destinationUrl: string;
};

export type FunnelValidation = { ok: true } | { ok: false; error: string };

/** A scheduling page sits on a third-party domain, so only the URL shape is checked. */
export function validateBookingUrl(input: string): FunnelValidation {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter the booking link a lead opens to pick a slot." };
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "Enter a valid booking link (e.g. https://cal.com/yourteam/30min)." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "The booking link must start with http:// or https://." };
  }
  if (!parsed.hostname.includes(".")) {
    return { ok: false, error: "Enter a valid booking link (e.g. https://cal.com/yourteam/30min)." };
  }
  return { ok: true };
}

/**
 * Every rate the funnel declares must be a percentage, the lifetime revenue must
 * be a positive whole number, and the destination must match its kind. Reports
 * the first problem so the card can name one thing to fix.
 */
export function validateFunnelDraft(
  def: SalesFunnelDef,
  draft: FunnelDraft,
  brandDomain: string | null,
): FunnelValidation {
  for (const rate of def.rates) {
    const parsed = parseLocaleNumberInput(draft.rates[rate.key] ?? "");
    if (parsed === null) return { ok: false, error: `Fill ${rate.label}.` };
    if (parsed < 0 || parsed > 100) {
      return { ok: false, error: `${rate.label} must be between 0 and 100.` };
    }
  }

  const ltr = parseLocaleNumberInput(draft.lifetimeRevenueUsd);
  if (ltr === null) return { ok: false, error: "Fill the customer lifetime revenue." };
  if (ltr <= 0) return { ok: false, error: "The customer lifetime revenue must be above zero." };

  if (def.destination.kind === "booking") return validateBookingUrl(draft.destinationUrl);

  if (brandDomain === null) {
    return { ok: false, error: "Set your brand domain first, then pick a destination page." };
  }
  const candidate = draft.destinationUrl.trim() || `https://${bareHost(brandDomain)}`;
  const result = validateDestination(candidate, brandDomain);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Seed a funnel from what the brand already saved. Rates and lifetime revenue
 * come from its sales economics; a page destination starts from the brand's
 * click destination. A booking link has nowhere to come from yet, so it starts
 * empty rather than guessing one.
 */
export function funnelDraftFromBrand(
  def: SalesFunnelDef,
  economics: BrandSalesEconomics | null | undefined,
  clickDestinationUrl: string | null | undefined,
): FunnelDraft {
  const rates: Partial<Record<FunnelRateKey, string>> = {};
  for (const rate of def.rates) {
    const stored = economics ? economics[rate.key] : null;
    rates[rate.key] =
      stored === null || stored === undefined ? "" : formatLocaleNumberInputValue(stored);
  }
  return {
    rates,
    lifetimeRevenueUsd: economics ? formatLocaleInteger(economics.lifetimeRevenueUsd) : "",
    destinationUrl: def.destination.kind === "page" ? clickDestinationUrl ?? "" : "",
  };
}

/** Drop the protocol, the leading www and a trailing slash so a URL reads as a label. */
export function shortUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
  return withoutProtocol.replace(/^www\./i, "").replace(/\/$/, "");
}

export type FunnelSummaryPart = { label: string; value: string };

/**
 * The one-line recap kept under a confirmed funnel, so its numbers stay readable
 * without reopening the form.
 */
export function funnelSummaryParts(def: SalesFunnelDef, draft: FunnelDraft): FunnelSummaryPart[] {
  const parts: FunnelSummaryPart[] = def.rates.map((rate) => ({
    label: rate.label,
    value: `${draft.rates[rate.key] ?? ""}%`,
  }));
  const ltr = parseLocaleNumberInput(draft.lifetimeRevenueUsd);
  parts.push({
    label: "Lifetime revenue",
    value: ltr === null ? "" : `$${formatLocaleInteger(ltr)}`,
  });
  parts.push({
    label: def.destination.label,
    value: shortUrl(draft.destinationUrl),
  });
  return parts;
}
