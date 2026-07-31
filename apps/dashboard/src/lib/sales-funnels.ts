// The sales funnels a brand can sell through. A funnel is one chain from the
// first signal we can buy (a positive reply, or a click onto the site) down to a
// paid client, and it owns everything that chain needs priced: its own
// conversion rates, its own lifetime revenue, its own landing page and, when a
// meeting sits in the chain, its own booking link.
//
// Every arrow of a chain converts at a rate. One of those rates — the meeting
// show-up rate — has no column anywhere in the fleet, so it is declared here and
// starts blank on every brand; see `UnstoredFunnelRateKey`.
//
// Only value imports that carry no "@" alias live here — vitest does not resolve
// the alias, so this module stays directly unit-testable (the BrandOptimizationGoal
// import is type-only and is erased at build time).

import type { BrandOptimizationGoal, BrandSalesEconomics } from "@/lib/api";
import { formatLocaleInteger, formatLocaleNumberInputValue, parseLocaleNumberInput } from "./format-number";
import { bareHost, validateDestination } from "./click-destination-validation";

export type SalesFunnelKey = "reply_meeting" | "visit_meeting" | "visit_signup" | "visit_form";

/** Rate fields, named exactly as brand-service stores them. */
export type StoredFunnelRateKey =
  | "replyToMeetingPct"
  | "visitToMeetingPct"
  | "meetingToClosePct"
  | "visitToSignupPct"
  | "signupToPaidClientPct"
  | "visitToFormSubmissionPct"
  | "formSubmissionToPaidClientPct";

/**
 * The show-up rate has no column anywhere in the fleet, so it is the one rate a
 * funnel prices that nothing can seed and nothing can save. It is declared here
 * because it IS part of the model this section describes — the alternative is an
 * arrow in the middle of the chain that carries no number at all.
 */
export type UnstoredFunnelRateKey = "meetingBookedToAttendedPct";

export type FunnelRateKey = StoredFunnelRateKey | UnstoredFunnelRateKey;

/** True when brand-service has a column for this rate, so a draft can seed it. */
export function isStoredRateKey(key: FunnelRateKey): key is StoredFunnelRateKey {
  return key !== "meetingBookedToAttendedPct";
}

export type FunnelRateField = { key: FunnelRateKey; label: string; tip: string };

/**
 * Every rate a funnel can price, described once. A funnel points at these by
 * key from its legs, so two funnels sharing a leg cannot drift into two
 * different labels for the same stored number.
 */
const RATE_FIELDS: Record<FunnelRateKey, Omit<FunnelRateField, "key">> = {
  replyToMeetingPct: {
    label: "Positive reply → meeting booked",
    tip: "Of leads who reply positively, the share who book a slot.",
  },
  visitToMeetingPct: {
    label: "Website visit → meeting booked",
    tip: "Of leads who visit your website, the share who book a slot.",
  },
  meetingBookedToAttendedPct: {
    label: "Meeting booked → meeting attended",
    tip: "Of leads who book a slot, the share who actually show up.",
  },
  meetingToClosePct: {
    label: "Meeting attended → paid client",
    tip: "Of leads you actually meet, the share that become paying customers.",
  },
  visitToSignupPct: {
    label: "Website visit → signup",
    tip: "Of leads who visit your website, the share that sign up.",
  },
  signupToPaidClientPct: {
    label: "Signup → paid client",
    tip: "Of leads who sign up, the share that become paying customers.",
  },
  visitToFormSubmissionPct: {
    label: "Website visit → form filled",
    tip: "Of leads who visit your website, the share that submit a form.",
  },
  formSubmissionToPaidClientPct: {
    label: "Form filled → paid client",
    tip: "Of leads who submit a form, the share that become paying customers.",
  },
};

export type SalesFunnelDef = {
  key: SalesFunnelKey;
  /** What the funnel is called. Read as the card's title. */
  name: string;
  /** The chain, rendered under the name. */
  steps: string[];
  /** One entry per arrow between two steps: the rate that leg converts at. */
  legs: FunnelRateKey[];
  /** What a campaign optimizes for once this funnel is wired to a campaign. */
  goal: BrandOptimizationGoal;
  /** The first step is a click onto the brand's site, so a domain is required. */
  requiresWebsite: boolean;
  /** This funnel lands an outreach click on a page of the brand's own site. */
  pageDestination: boolean;
  /**
   * A meeting sits in the chain, so a scheduling page is worth collecting. It is
   * OPTIONAL: a brand that books over email still runs the funnel.
   */
  bookingLink: boolean;
  /**
   * Palette tone. Written as whole class strings because Tailwind cannot see a
   * class assembled at runtime. All four background tints are in the
   * `html.dark` remap in globals.css, so they hold up in dark mode.
   */
  tone: { iconBg: string; iconText: string };
};

export const SALES_FUNNELS: SalesFunnelDef[] = [
  {
    key: "reply_meeting",
    name: "Sales Meeting from Conversation",
    steps: ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"],
    legs: ["replyToMeetingPct", "meetingBookedToAttendedPct", "meetingToClosePct"],
    goal: "sales_meetings",
    requiresWebsite: false,
    pageDestination: false,
    bookingLink: true,
    tone: { iconBg: "bg-purple-50", iconText: "text-purple-600" },
  },
  {
    key: "visit_meeting",
    name: "Sales Meeting from Website",
    steps: ["Website visit", "Meeting booked", "Meeting attended", "Paid client"],
    legs: ["visitToMeetingPct", "meetingBookedToAttendedPct", "meetingToClosePct"],
    goal: "sales_meetings",
    requiresWebsite: true,
    pageDestination: true,
    bookingLink: true,
    tone: { iconBg: "bg-indigo-50", iconText: "text-indigo-600" },
  },
  {
    key: "visit_signup",
    name: "Website Purchase",
    steps: ["Website visit", "Signup", "Paid client"],
    legs: ["visitToSignupPct", "signupToPaidClientPct"],
    goal: "signups",
    requiresWebsite: true,
    pageDestination: true,
    bookingLink: false,
    tone: { iconBg: "bg-blue-50", iconText: "text-blue-600" },
  },
  {
    key: "visit_form",
    name: "Form Magnet",
    steps: ["Website visit", "Form filled", "Paid client"],
    legs: ["visitToFormSubmissionPct", "formSubmissionToPaidClientPct"],
    goal: "form_submissions",
    requiresWebsite: true,
    pageDestination: true,
    bookingLink: false,
    tone: { iconBg: "bg-orange-50", iconText: "text-orange-600" },
  },
];

/**
 * The funnels a brand sells through come FIRST, in their declared order, and the
 * rest follow. Two funnels a brand runs and two it does not are two different
 * kinds of row, so they are two groups rather than one list with a marker on
 * some of its members.
 */
export function partitionFunnelsBySelection(isSelected: (key: SalesFunnelKey) => boolean): {
  selected: SalesFunnelDef[];
  unselected: SalesFunnelDef[];
} {
  return {
    selected: SALES_FUNNELS.filter((f) => isSelected(f.key)),
    unselected: SALES_FUNNELS.filter((f) => !isSelected(f.key)),
  };
}

export function salesFunnelByKey(key: SalesFunnelKey): SalesFunnelDef {
  const def = SALES_FUNNELS.find((f) => f.key === key);
  if (!def) throw new Error(`Unknown sales funnel: ${key}`);
  return def;
}

/** The rates this funnel prices, in chain order, deduped across repeated legs. */
export function funnelRateFields(def: SalesFunnelDef): FunnelRateField[] {
  const seen = new Set<FunnelRateKey>();
  const out: FunnelRateField[] = [];
  for (const leg of def.legs) {
    if (seen.has(leg)) continue;
    seen.add(leg);
    out.push({ key: leg, ...RATE_FIELDS[leg] });
  }
  return out;
}

export type FunnelDraft = {
  rates: Partial<Record<FunnelRateKey, string>>;
  lifetimeRevenueUsd: string;
  /** The page on the brand's own site an outreach click lands on. */
  destinationUrl: string;
  /** The scheduling page. Always optional. */
  bookingUrl: string;
};

export type FunnelValidation = { ok: true } | { ok: false; error: string };

/**
 * A scheduling page sits on a third-party domain, so only the URL shape is
 * checked. An EMPTY link is accepted: a brand that books over email still runs
 * the funnel, so requiring one would block a real way of selling.
 */
export function validateBookingUrl(input: string): FunnelValidation {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true };
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
 * Every rate the funnel prices must be a percentage, the lifetime revenue must
 * be a positive whole number, and each destination must match its kind. Reports
 * the first problem so the card can name one thing to fix.
 */
export function validateFunnelDraft(
  def: SalesFunnelDef,
  draft: FunnelDraft,
  brandDomain: string | null,
): FunnelValidation {
  for (const rate of funnelRateFields(def)) {
    const parsed = parseLocaleNumberInput(draft.rates[rate.key] ?? "");
    if (parsed === null) return { ok: false, error: `Fill ${rate.label}.` };
    if (parsed < 0 || parsed > 100) {
      return { ok: false, error: `${rate.label} must be between 0 and 100.` };
    }
  }

  const ltr = parseLocaleNumberInput(draft.lifetimeRevenueUsd);
  if (ltr === null) return { ok: false, error: "Fill the customer lifetime revenue." };
  if (ltr <= 0) return { ok: false, error: "The customer lifetime revenue must be above zero." };

  if (def.bookingLink) {
    const booking = validateBookingUrl(draft.bookingUrl);
    if (!booking.ok) return booking;
  }

  if (!def.pageDestination) return { ok: true };

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
  for (const rate of funnelRateFields(def)) {
    // The show-up rate has no column, so it starts blank on every brand rather
    // than borrowing a number that means something else.
    if (!isStoredRateKey(rate.key)) {
      rates[rate.key] = "";
      continue;
    }
    const stored = economics ? economics[rate.key] : null;
    rates[rate.key] =
      stored === null || stored === undefined ? "" : formatLocaleNumberInputValue(stored);
  }
  return {
    rates,
    lifetimeRevenueUsd: economics ? formatLocaleInteger(economics.lifetimeRevenueUsd) : "",
    destinationUrl: def.pageDestination ? clickDestinationUrl ?? "" : "",
    bookingUrl: "",
  };
}

/**
 * Drop the protocol, the leading www, a trailing slash — and everything from the
 * first `?` or `#`. A real click destination carries a UTM tail long enough to
 * fill the row on its own (`…/level-1-free-assessment/?utm_source=landing_page&
 * utm_medium=email&utm_campaign=…`), and none of it identifies the page. The
 * path stays, because that IS what distinguishes one destination from another.
 */
export function shortUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
  const withoutQuery = withoutProtocol.split(/[?#]/)[0];
  return withoutQuery.replace(/^www\./i, "").replace(/\/$/, "");
}

/** The registrable host of a URL, for a logo.dev lookup. Null when unparseable. */
export function hostOf(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return parsed.hostname.includes(".") ? bareHost(parsed.hostname) : null;
  } catch {
    return null;
  }
}

/**
 * The percentage printed under one arrow of the chain, or null when the brand
 * has not given us that rate. A rate we do not have prints nothing rather than a
 * zero — "not filled in" and "converts at 0%" are different statements.
 */
export function funnelLegPct(def: SalesFunnelDef, draft: FunnelDraft, legIndex: number): string | null {
  const key = def.legs[legIndex];
  if (!key) return null;
  const parsed = parseLocaleNumberInput(draft.rates[key] ?? "");
  return parsed === null ? null : `${formatLocaleNumberInputValue(parsed)}%`;
}

/**
 * What a client won through this funnel is worth, printed at the END of the
 * chain — a lifetime revenue is what the last step is worth, so it belongs after
 * `Paid client` rather than on a line of its own.
 */
export function funnelLifetimeLabel(draft: FunnelDraft): string | null {
  const ltr = parseLocaleNumberInput(draft.lifetimeRevenueUsd);
  if (ltr === null || ltr <= 0) return null;
  return `$${formatLocaleInteger(ltr)} lifetime revenue`;
}

export type FunnelDestinationChip = {
  kind: "page" | "booking";
  label: string;
  host: string | null;
};

/**
 * Where the funnel sends people. A destination reads as its shortened URL with
 * its own favicon rather than the raw link, so a long URL stays one line. A
 * destination the brand has not given us is dropped, not printed empty.
 */
export function funnelDestinationChips(
  def: SalesFunnelDef,
  draft: FunnelDraft,
): FunnelDestinationChip[] {
  const chips: FunnelDestinationChip[] = [];

  if (def.pageDestination && draft.destinationUrl.trim()) {
    chips.push({
      kind: "page",
      label: shortUrl(draft.destinationUrl),
      host: hostOf(draft.destinationUrl),
    });
  }

  if (def.bookingLink && draft.bookingUrl.trim()) {
    chips.push({
      kind: "booking",
      label: shortUrl(draft.bookingUrl),
      host: hostOf(draft.bookingUrl),
    });
  }

  return chips;
}
