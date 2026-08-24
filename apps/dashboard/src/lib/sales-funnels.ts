// The sales funnels a brand can sell through. A funnel is one chain from the
// first signal we can buy (a positive reply, or a click onto the site) down to a
// paid client, and it owns everything that chain needs priced: its own
// conversion rates, its own lifetime revenue, its own landing page and, when a
// meeting sits in the chain, its own booking link.
//
// Every arrow of a chain converts at a rate, and brand-service now stores all of
// them PER FUNNEL — including the meeting show-up rate, which lives nowhere else
// in the fleet. Nothing seeds that one, so it starts blank on every brand; see
// `SeedlessFunnelRateKey`.
//
// Only value imports that carry no "@" alias live here — vitest does not resolve
// the alias, so this module stays directly unit-testable (the BrandOptimizationGoal
// import is type-only and is erased at build time).

import type { BrandOptimizationGoal, BrandSalesEconomics, SalesFunnelPatch } from "@/lib/api";
import { formatLocaleInteger, formatLocaleNumberInputValue, parseLocaleNumberInput } from "./format-number";
import { bareHost, validateDestination } from "./click-destination-validation";

export type SalesFunnelKey = "reply_meeting" | "visit_meeting" | "visit_signup" | "visit_form";

/**
 * Every spelling this app may receive for a funnel key: the four brand-service
 * stores today, and the four it is renaming to.
 *
 * The funnel key is becoming the fleet's ONE vocabulary for what a brand sells
 * through — the eight-token goal enum beside it is being retired into these four,
 * because the goal is strictly the poorer word: `reply_meeting` and
 * `visit_meeting` both collapse onto `meetingBooked`, so a meeting won from a
 * reply and one won from the website read as the same thing to every consumer.
 *
 * The new spellings are here AHEAD of brand-service emitting them, for the reason
 * `CANONICAL_GOALS` gives in api.ts: reading a spelling nobody sends yet costs
 * nothing, and failing to read it the day it arrives takes the surface down.
 */
export type CanonicalSalesFunnelKey =
  | "sales_meetings_from_conversation"
  | "sales_meetings_from_website"
  | "website_purchases"
  | "form_magnet";

export type SalesFunnelKeyWire = SalesFunnelKey | CanonicalSalesFunnelKey;

/**
 * The spelling every service is renaming TO, for a key this app's catalogue
 * still names the old way.
 *
 * Read tolerantly, WRITE canonically: `normalizeSalesFunnelKey` accepts both
 * spellings on the way in, and anything this app SENDS goes out in the new
 * vocabulary, so a producer that eventually drops the legacy aliases never
 * unfunds or unnames what we stated.
 */
const CANONICAL_FUNNEL_KEY: Record<SalesFunnelKey, CanonicalSalesFunnelKey> = {
  reply_meeting: "sales_meetings_from_conversation",
  visit_meeting: "sales_meetings_from_website",
  visit_signup: "website_purchases",
  visit_form: "form_magnet",
};

/** The canonical spelling of a funnel key, for anything written to the wire. */
export function canonicalSalesFunnelKey(key: SalesFunnelKeyWire): CanonicalSalesFunnelKey {
  return CANONICAL_FUNNEL_KEY[normalizeSalesFunnelKey(key)];
}

/**
 * Collapse any wire spelling onto the key this app's catalogue is written on.
 *
 * Exhaustive, and it THROWS on anything else rather than guessing a funnel: the
 * column is CHECK-constrained in brand-service, so a value arriving here that we
 * cannot name is a vocabulary drift we want to see, not one to paper over with a
 * plausible-looking chain the brand never declared.
 */
export function normalizeSalesFunnelKey(key: SalesFunnelKeyWire): SalesFunnelKey {
  switch (key) {
    case "reply_meeting":
    case "sales_meetings_from_conversation":
      return "reply_meeting";
    case "visit_meeting":
    case "sales_meetings_from_website":
      return "visit_meeting";
    case "visit_signup":
    case "website_purchases":
      return "visit_signup";
    case "visit_form":
    case "form_magnet":
      return "visit_form";
  }
  throw new Error(`Unmapped sales funnel key: ${key as string}`);
}

/**
 * Rate fields, named exactly as brand-service stores them. Every one of these
 * also exists on the brand's BLENDED sales economics, so an undeclared funnel
 * can seed a first guess from what the brand already saved.
 */
export type SeedableFunnelRateKey =
  | "replyToMeetingPct"
  | "visitToMeetingPct"
  | "meetingToClosePct"
  | "visitToSignupPct"
  | "signupToPaidClientPct"
  | "visitToFormSubmissionPct"
  | "formSubmissionToPaidClientPct";

/**
 * The meeting show-up rate. brand-service stores it ON THE FUNNEL and nowhere
 * else in the fleet, so it saves like every other leg but has nothing to seed
 * from — it starts blank on every brand rather than borrowing a number that
 * means something else.
 */
export type SeedlessFunnelRateKey = "meetingBookedToAttendedPct";

export type FunnelRateKey = SeedableFunnelRateKey | SeedlessFunnelRateKey;

/** True when the brand's blended economics carry this rate, so a draft can seed it. */
export function isSeedableRateKey(key: FunnelRateKey): key is SeedableFunnelRateKey {
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
 * The least a brand may fund a funnel with, per day, once it funds it at all.
 * ZERO is always legal and is NOT a violation of this: it means the brand is not
 * funding that chain right now, which is how it pauses one.
 *
 * The floor differs by what the chain buys. A sales meeting costs an order of
 * magnitude more than a website purchase, so a dollar a day would buy a meeting
 * funnel nothing at all and the customer would watch it sit still — a budget
 * that cannot purchase one outcome is worse than an honest refusal.
 *
 * ⚠️ These are product figures, and their real source is the fleet's cost per
 * outcome. They are frozen here so ONE place holds them, but they will drift the
 * day the fleet re-prices; billing-service holds the same numbers and its 400 is
 * what actually decides. These exist to make typing pleasant, not to be the
 * authority.
 */
export const FUNNEL_MIN_DAILY_BUDGET_USD: Record<SalesFunnelKey, number> = {
  reply_meeting: 24,
  visit_meeting: 24,
  visit_signup: 1,
  visit_form: 1,
};

/**
 * Whether this funnel may be funded at this many dollars a day, given what it
 * is funded at TODAY. Zero passes: a defunded funnel is an ordinary state, not
 * an error.
 *
 * The floor governs what a brand may NEWLY state, never what one has already
 * been running. Per-funnel ceilings shipped after the money did, and the sweep
 * that attributed each brand-level ceiling to its single funnel deliberately
 * carried the figure over verbatim rather than raising anyone's spend — so live
 * brands are funded under their funnel's floor right now. Refusing every write
 * on those left them two moves: leave it untouched, or defund it. Raising it
 * toward the floor was refused, which is the wrong direction to block, and
 * because this gate runs before the whole form is saved it also blocked editing
 * a conversion rate on a funnel whose money nobody was trying to change.
 *
 * So a funnel already funded under its floor is grandfathered: keep it, raise
 * it (even to another figure under the floor), or drop it to zero. Lowering it
 * to another funded figure under the floor is still refused. Once it reaches
 * the floor the grandfather is spent, which falls out of the check below rather
 * than needing a branch of its own.
 *
 * `savedCents` is what billing has stored for this funnel, 0 when it funds
 * nothing. billing-service holds the same rule and its 400 is what decides.
 */
export function funnelBudgetBelowMinimum(
  key: SalesFunnelKey,
  dailyUsd: number,
  savedCents: number,
): boolean {
  if (dailyUsd <= 0) return false;
  const minimumUsd = FUNNEL_MIN_DAILY_BUDGET_USD[key];
  if (dailyUsd >= minimumUsd) return false;
  if (!isGrandfatheredFunding(key, savedCents)) return true;
  return Math.round(dailyUsd * 100) < savedCents;
}

/** True when billing already funds this funnel under its own floor. */
export function isGrandfatheredFunding(key: SalesFunnelKey, savedCents: number): boolean {
  return savedCents > 0 && savedCents < FUNNEL_MIN_DAILY_BUDGET_USD[key] * 100;
}

/**
 * The tip beside the budget field. A funnel already funded under its floor is
 * told what it may do, not a starting figure it is already below: quoting the
 * floor there reads as "you are not allowed to be here", on a ceiling the brand
 * has been paying against for weeks.
 */
export function funnelBudgetTip(key: SalesFunnelKey, savedCents: number): string {
  const opening = "The most this funnel may spend in a day. Leave it empty to stop funding it, and nothing else about it is lost.";
  if (!isGrandfatheredFunding(key, savedCents)) {
    return `${opening} From $${FUNNEL_MIN_DAILY_BUDGET_USD[key]} a day once you do fund it.`;
  }
  return `${opening} It is funded at $${Math.round(savedCents / 100)} a day today across every offer that sells through it, which you can keep or raise.`;
}

/**
 * What to tell someone whose budget was refused. A grandfathered funnel gets
 * the moves it actually has, not a floor it is not allowed to walk down to.
 */
export function funnelBudgetFloorMessage(key: SalesFunnelKey, savedCents: number): string {
  const minimum = FUNNEL_MIN_DAILY_BUDGET_USD[key];
  if (!isGrandfatheredFunding(key, savedCents)) {
    return `A daily budget for this funnel starts at $${minimum}. Leave it empty to stop funding it.`;
  }
  const current = Math.round(savedCents / 100);
  return `This funnel is funded at $${current} a day across every offer that sells through it. Keep it there or raise it, but it cannot go lower while it stays under $${minimum}. Leave it empty to stop funding it.`;
}

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

// There is deliberately NO goal-to-funnel resolver here. The goal is the
// retired, lossier vocabulary — `meetingBooked` is the goal of two different
// funnels — so a surface naming a chain reads the funnel a campaign or a brand
// actually stated, never one derived from its goal. campaign-service persists
// the funnel on every campaign for exactly this reason.

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
 * Shape checks only, and only on the values the brand actually typed. A BLANK
 * field is legal everywhere: brand-service treats an omitted value as unchanged
 * and an explicit null as cleared, so a brand must be able to declare a funnel
 * before it has priced every leg, and must be able to remove a number rather
 * than being forced to invent a replacement.
 *
 * These checks exist to make typing pleasant, not to be the source of truth —
 * brand-service rejects a rate outside the chain, a destination the funnel has
 * no use for, and a website-led funnel on a brand with no website, and that 400
 * is the answer. Reports the first problem so the card names one thing to fix.
 */
export function validateFunnelDraft(
  def: SalesFunnelDef,
  draft: FunnelDraft,
  brandDomain: string | null,
): FunnelValidation {
  for (const rate of funnelRateFields(def)) {
    const raw = (draft.rates[rate.key] ?? "").trim();
    if (!raw) continue;
    const parsed = parseLocaleNumberInput(raw);
    if (parsed === null) return { ok: false, error: `${rate.label} must be a number.` };
    if (parsed < 0 || parsed > 100) {
      return { ok: false, error: `${rate.label} must be between 0 and 100.` };
    }
  }

  const rawLtr = draft.lifetimeRevenueUsd.trim();
  if (rawLtr) {
    const ltr = parseLocaleNumberInput(rawLtr);
    if (ltr === null) return { ok: false, error: "The customer lifetime revenue must be a number." };
    if (ltr <= 0) return { ok: false, error: "The customer lifetime revenue must be above zero." };
  }

  if (def.bookingLink) {
    const booking = validateBookingUrl(draft.bookingUrl);
    if (!booking.ok) return booking;
  }

  if (!def.pageDestination) return { ok: true };

  const destination = draft.destinationUrl.trim();
  if (!destination) return { ok: true };
  if (brandDomain === null) {
    return { ok: false, error: "Set your brand domain first, then pick a destination page." };
  }
  const result = validateDestination(destination, brandDomain);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * What brand-service has stored for one funnel, stripped of the metadata the
 * card does not edit. Structurally the wire funnel, declared here so this module
 * stays alias-free and directly unit-testable.
 */
export type DeclaredFunnelValues = {
  rates: Record<string, number | null>;
  lifetimeRevenueUsd: number | null;
  destinationUrl: string | null;
  bookingUrl: string | null;
};

/**
 * Seed a funnel's form from what the brand DECLARED for that funnel. A value it
 * never declared reads `null` upstream and shows blank here — never a zero, and
 * never a number borrowed from the brand's blended economics.
 */
export function funnelDraftFromDeclared(
  def: SalesFunnelDef,
  saved: DeclaredFunnelValues,
): FunnelDraft {
  const rates: Partial<Record<FunnelRateKey, string>> = {};
  for (const rate of funnelRateFields(def)) {
    const stored = saved.rates[rate.key];
    rates[rate.key] =
      stored === null || stored === undefined ? "" : formatLocaleNumberInputValue(stored);
  }
  return {
    rates,
    lifetimeRevenueUsd:
      saved.lifetimeRevenueUsd === null ? "" : formatLocaleInteger(saved.lifetimeRevenueUsd),
    destinationUrl: def.pageDestination ? saved.destinationUrl ?? "" : "",
    bookingUrl: def.bookingLink ? saved.bookingUrl ?? "" : "",
  };
}

/** A blank stored funnel: what a brand that has declared nothing has on record. */
export const NOTHING_DECLARED: DeclaredFunnelValues = {
  rates: {},
  lifetimeRevenueUsd: null,
  destinationUrl: null,
  bookingUrl: null,
};

/** A field the form left blank clears the stored value; a filled one writes it. */
function ratePatchValue(raw: string | undefined): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  return parseLocaleNumberInput(trimmed);
}

/**
 * The PARTIAL patch to send for this funnel: exactly the fields whose value
 * DIFFERS from what brand-service has stored. Everything else is omitted, so a
 * form editing one rate cannot overwrite the others with a possibly-stale copy,
 * and a field the user emptied is sent as an explicit `null` so it really clears.
 *
 * Two things this can never emit, because brand-service 400s on both rather than
 * dropping them: a rate outside THIS funnel's chain (it walks the chain's own
 * legs), and a destination the funnel has no use for (each is gated on the
 * funnel's own flag).
 *
 * `saved` is `NOTHING_DECLARED` for a funnel the brand has not declared yet, so
 * a blank prefill field equals what is stored and is never written — a value
 * nobody confirmed must not read back as one the brand declared.
 */
export function buildFunnelPatch(
  def: SalesFunnelDef,
  draft: FunnelDraft,
  saved: DeclaredFunnelValues,
): SalesFunnelPatch {
  const patch: SalesFunnelPatch = {};
  const rates: Record<string, number | null> = {};

  for (const rate of funnelRateFields(def)) {
    const next = ratePatchValue(draft.rates[rate.key]);
    const current = saved.rates[rate.key] ?? null;
    if (next !== current) rates[rate.key] = next;
  }
  if (Object.keys(rates).length > 0) patch.rates = rates;

  const rawLtr = draft.lifetimeRevenueUsd.trim();
  const nextLtr = rawLtr ? parseLocaleNumberInput(rawLtr) : null;
  const roundedLtr = nextLtr === null ? null : Math.round(nextLtr);
  if (roundedLtr !== (saved.lifetimeRevenueUsd ?? null)) patch.lifetimeRevenueUsd = roundedLtr;

  if (def.pageDestination) {
    const next = draft.destinationUrl.trim() || null;
    if (!sameUrl(next, saved.destinationUrl)) patch.destinationUrl = next;
  }

  if (def.bookingLink) {
    const next = draft.bookingUrl.trim() || null;
    if (!sameUrl(next, saved.bookingUrl)) patch.bookingUrl = next;
  }

  return patch;
}

/**
 * brand-service normalizes a URL before storing it (`acme.com/x` comes back as
 * `https://acme.com/x`), so a raw string compare would re-send an unchanged
 * destination on every save. Compares what the two would normalize to.
 */
function sameUrl(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  const normalize = (value: string) => {
    try {
      return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).toString();
    } catch {
      return value.trim();
    }
  };
  return normalize(a) === normalize(b);
}

/** True when the patch would change nothing, so there is no write to make. */
export function isEmptyFunnelPatch(patch: SalesFunnelPatch): boolean {
  return Object.keys(patch).length === 0;
}

/**
 * What to put in front of the user when a write is refused. brand-service says
 * exactly what was wrong with the funnel it was asked to store, in a sentence
 * written for a person — a rate that is not on this chain, a destination the
 * funnel has no use for, a page off the brand domain — so a 400 shows that
 * sentence rather than being swallowed behind one generic line.
 *
 * Never `err.message`: `apiCall` sets it to the whole downstream body verbatim,
 * which puts a JSON blob in front of a customer. This reads the one field.
 * Duck-typed on `status` so this module needs no runtime import of `ApiError`.
 */
export function funnelWriteErrorMessage(err: unknown): string {
  const status = (err as { status?: unknown } | null)?.status;
  const body = (err as { body?: unknown } | null)?.body;
  const upstream =
    body && typeof body === "object" ? (body as Record<string, unknown>).error : null;

  if (status === 400 && typeof upstream === "string" && upstream.trim()) {
    return upstream.trim().slice(0, 400);
  }
  if (status === 403) return "This brand is not in your organization.";
  if (status === 404) return "This brand no longer exists.";
  return "Could not save this funnel. Try again.";
}

/**
 * A goal the brand configured that the catalogue carries no funnel of its own
 * for, and the funnel whose chain ends on the same thing.
 *
 * These goals price ONE end-to-end step (`Positive reply -> Paid client`,
 * `Website visit -> Paid client`) where the funnel spells the same journey out
 * over several legs. The brand's number is still true of the whole chain, so it
 * seeds the LAST leg (the one landing on `Paid client`) and every leg above it
 * seeds at 100%: the product across the chain then equals exactly the rate the
 * brand gave us, instead of a number nobody stated.
 *
 * `sales` is a paid client won through EITHER path, so it seeds both funnels,
 * each from its own rate. `website_purchase`, `signups`, `sales_meetings` and
 * `form_submissions` are absent because a funnel already prices their legs by
 * name and seeds them one for one.
 */
type OrphanGoalSeed = {
  funnelKey: SalesFunnelKey;
  /** The blended rate that is true of this funnel's WHOLE chain. */
  from: "replyToPaidClientPct" | "visitToPaidClientPct";
};

const ORPHAN_GOAL_SEEDS: Partial<Record<BrandOptimizationGoal, OrphanGoalSeed[]>> = {
  positive_replies: [{ funnelKey: "reply_meeting", from: "replyToPaidClientPct" }],
  website_visits: [{ funnelKey: "visit_signup", from: "visitToPaidClientPct" }],
  sales: [
    { funnelKey: "reply_meeting", from: "replyToPaidClientPct" },
    { funnelKey: "visit_signup", from: "visitToPaidClientPct" },
  ],
};

/** Every leg the brand gave us no number for converts at this rate. */
const FULL_CONVERSION_PCT = 100;

/**
 * How this brand's goal maps onto this funnel, or null when the funnel already
 * prices the goal's legs by name and needs no translation.
 */
export function orphanGoalSeedFor(
  goal: BrandOptimizationGoal | null | undefined,
  funnelKey: SalesFunnelKey,
): OrphanGoalSeed | null {
  if (!goal) return null;
  return (ORPHAN_GOAL_SEEDS[goal] ?? []).find((s) => s.funnelKey === funnelKey) ?? null;
}

/**
 * A first guess for a funnel the brand has NOT declared, from what it already
 * saved elsewhere: rates and lifetime revenue from its blended sales economics,
 * a page destination from its click destination. A booking link has nowhere to
 * come from, so it starts empty rather than guessing one.
 *
 * A brand whose goal the catalogue prices under a different chain is translated
 * through `orphanGoalSeedFor` rather than read leg by leg: brand-service stores
 * every blended rate NOT NULL with a server default, so reading a leg that goal
 * never configured hands back a plausible number the brand never stated.
 *
 * This is a prefill for a person to confirm, never a value to write. A number
 * nobody confirmed must not read back as one the brand declared, so a draft
 * built here is only ever persisted through `buildFunnelPatch`, which sends a
 * field only once its value differs from what is actually stored.
 */
/**
 * The economics a prefill can be built from. Structural rather than
 * `BrandSalesEconomics`, so BOTH the brand's stored economics and the EFFECTIVE read
 * (`/sales-economics-effective`, which folds cross-brand averages in for a brand that
 * has stated nothing yet, and carries a SUBSET of the rate columns) can seed one
 * funnel — a brand-new brand in onboarding has only the effective read, and it is the
 * better guess of the two. Every rate is optional and a missing one seeds blank, which
 * is already how the function treats a stored null.
 */
export type FunnelSeedEconomics = Partial<
  Record<FunnelRateKey | OrphanGoalSeed["from"], number | null>
> & {
  lifetimeRevenueUsd: number;
  optimizationGoal?: BrandOptimizationGoal | null;
};

export function funnelDraftFromBrand(
  def: SalesFunnelDef,
  economics: FunnelSeedEconomics | null | undefined,
  clickDestinationUrl: string | null | undefined,
): FunnelDraft {
  const fields = funnelRateFields(def);
  const orphan = economics ? orphanGoalSeedFor(economics.optimizationGoal, def.key) : null;
  const endToEnd = orphan && economics ? economics[orphan.from] : null;

  const rates: Partial<Record<FunnelRateKey, string>> = {};
  fields.forEach((rate, index) => {
    // The brand's goal is priced as one step the catalogue spells out over
    // several: its rate lands on the leg that ends on a paid client, the rest
    // pass everyone through, and the chain multiplies back to what it gave us.
    if (endToEnd !== null && endToEnd !== undefined) {
      rates[rate.key] = formatLocaleNumberInputValue(
        index === fields.length - 1 ? endToEnd : FULL_CONVERSION_PCT,
      );
      return;
    }
    // Nothing else in the fleet measures the show-up rate, so it starts blank on
    // every brand rather than borrowing a number that means something else.
    if (!isSeedableRateKey(rate.key)) {
      rates[rate.key] = "";
      return;
    }
    const stored = economics ? economics[rate.key] : null;
    rates[rate.key] =
      stored === null || stored === undefined ? "" : formatLocaleNumberInputValue(stored);
  });

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

/**
 * The goal a funnel implies — the LOSSLESS direction of a mapping that is lossy the
 * other way round.
 *
 * Deriving a funnel FROM a goal is banned and stays banned: `sales_meetings` covers
 * both meeting chains, so it prints a chain the campaign never stated. Going the other
 * way is exact, because every funnel terminates in exactly one outcome — which is why
 * features-service publishes the same echo on `funnel-ranking`.
 *
 * It exists so a campaign that predates `campaign.goal` still answers the goal-keyed
 * helpers from its OWN funnel, rather than from the retired brand column.
 */
export function goalForFunnelKey(key: SalesFunnelKeyWire): BrandOptimizationGoal {
  switch (normalizeSalesFunnelKey(key)) {
    case "reply_meeting":
    case "visit_meeting":
      return "sales_meetings";
    case "visit_signup":
      return "signups";
    case "visit_form":
      return "form_submissions";
  }
}
