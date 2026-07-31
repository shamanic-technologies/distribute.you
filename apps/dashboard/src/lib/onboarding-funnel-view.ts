// Display view over the Sales Funnels catalogue for the staff onboarding preview.
//
// Why an adapter rather than reading `SALES_FUNNELS` fields directly at each
// render site: the catalogue moves. It gained a name per funnel, a fourth funnel,
// a four-step chain, per-arrow rate legs and a pair of destination flags in a
// single settings-card redesign — and the onboarding step picked all of that up
// without touching a render site, because the shape is read in ONE place. Keep it
// that way: the next reshape should be a diff to this file only.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias in this repo).

/**
 * The shape this view reads. Deliberately structural and permissive so a
 * catalogue mid-reshape still renders: every field is optional, and a funnel
 * missing one degrades to something honest rather than throwing.
 */
export type FunnelCatalogueEntry = {
  key: string;
  name?: string;
  /** The chain of step labels, e.g. Positive reply → Meeting booked → Paid client. */
  steps?: readonly string[];
  /** One entry per arrow: the rate key priced on that leg, or null when nothing measures it. */
  legs?: readonly (string | null)[];
  goal?: string;
  requiresWebsite?: boolean;
  /** This funnel lands an outreach click on a page of the brand's own site. */
  pageDestination?: boolean;
  /** A meeting sits in the chain, so a scheduling page is worth collecting. Optional by nature. */
  bookingLink?: boolean;
  tone?: { iconBg?: string; iconText?: string };
};

export type FunnelRateFieldView = { key: string; label: string; tip: string };

/** A place this funnel sends people. A funnel may have both, or neither. */
export type FunnelDestinationView = {
  kind: "page" | "booking";
  label: string;
  hint: string;
  placeholder: string;
  /** A brand that books over email still runs the funnel, so a booking link is never required. */
  optional: boolean;
};

export type FunnelView = {
  key: string;
  /** Card title. The catalogue's own name when it has one, else the chain. */
  title: string;
  /** The chain, rendered under the title. */
  steps: string[];
  goal: string | null;
  requiresWebsite: boolean;
  rates: FunnelRateFieldView[];
  destinations: FunnelDestinationView[];
  tone: { iconBg: string; iconText: string };
};

const FALLBACK_TONE = { iconBg: "bg-gray-50", iconText: "text-gray-600" };

const PAGE_DESTINATION: Omit<FunnelDestinationView, "optional"> = {
  kind: "page",
  label: "Destination page",
  hint: "The page on your site an outreach click lands on.",
  placeholder: "https://yoursite.com/pricing",
};

const BOOKING_DESTINATION: Omit<FunnelDestinationView, "optional"> = {
  kind: "booking",
  label: "Booking link",
  hint: "Optional. The scheduling page we send a lead to once they are interested.",
  placeholder: "https://cal.com/yourteam/30min",
};

/** The chain of step labels the funnel renders under its name. */
export function funnelStepLabels(entry: FunnelCatalogueEntry): string[] {
  return (entry.steps ?? []).map((s) => s.trim()).filter(Boolean);
}

/**
 * The card title. A catalogue that names its funnels wins; otherwise the chain
 * itself is the title, which is how the settings card read before the names
 * existed — so a missing name degrades to the previous look, never to an empty
 * heading.
 */
export function funnelTitle(entry: FunnelCatalogueEntry): string {
  const named = entry.name?.trim();
  if (named) return named;
  const steps = funnelStepLabels(entry);
  return steps.length > 0 ? steps.join(" → ") : entry.key;
}

/**
 * Where this funnel sends people. Derived from the catalogue's two flags, so a
 * funnel that both lands a click on the site AND books a meeting collects both —
 * and one that does neither collects nothing rather than showing an empty field.
 */
export function funnelDestinations(entry: FunnelCatalogueEntry): FunnelDestinationView[] {
  const out: FunnelDestinationView[] = [];
  if (entry.pageDestination) out.push({ ...PAGE_DESTINATION, optional: false });
  if (entry.bookingLink) out.push({ ...BOOKING_DESTINATION, optional: true });
  return out;
}

/**
 * Build the view. `resolveRates` is the catalogue's OWN rate resolver (it maps a
 * funnel's legs onto the stored rate fields, deduped and in chain order) — passed
 * in rather than reimplemented here so the labels a user reads in onboarding are
 * byte-identical to the ones on the settings card.
 */
export function toFunnelView(
  entry: FunnelCatalogueEntry,
  resolveRates?: (entry: FunnelCatalogueEntry) => readonly { key: string; label: string; tip?: string }[],
): FunnelView {
  const rates = (resolveRates?.(entry) ?? []).map((r) => ({
    key: r.key,
    label: r.label,
    tip: r.tip ?? "",
  }));
  return {
    key: entry.key,
    title: funnelTitle(entry),
    steps: funnelStepLabels(entry),
    goal: entry.goal ?? null,
    requiresWebsite: entry.requiresWebsite === true,
    rates,
    destinations: funnelDestinations(entry),
    tone: {
      iconBg: entry.tone?.iconBg ?? FALLBACK_TONE.iconBg,
      iconText: entry.tone?.iconText ?? FALLBACK_TONE.iconText,
    },
  };
}

export function toFunnelViews(
  entries: readonly FunnelCatalogueEntry[],
  resolveRates?: (entry: FunnelCatalogueEntry) => readonly { key: string; label: string; tip?: string }[],
): FunnelView[] {
  return entries.map((e) => toFunnelView(e, resolveRates));
}

/**
 * The funnels the brand can actually sell through. A funnel whose first step is
 * a click onto the brand's own site is unreachable for a brand with no website,
 * so it is not offered at all rather than offered and then rejected.
 */
export function selectableFunnels(views: FunnelView[], hasWebsite: boolean): FunnelView[] {
  return hasWebsite ? views : views.filter((v) => !v.requiresWebsite);
}

/**
 * Order the post-payment detail screens: the primary funnel first, the rest in
 * catalogue order. The user answers for the funnel they told us matters most
 * while their attention is highest.
 */
export function orderedForDetail(selected: FunnelView[], primaryKey: string | null): FunnelView[] {
  if (!primaryKey) return selected;
  const primary = selected.filter((v) => v.key === primaryKey);
  if (primary.length === 0) return selected;
  return [...primary, ...selected.filter((v) => v.key !== primaryKey)];
}

/**
 * The primary funnel after a selection change. Keeps the current pick while it
 * is still selected, otherwise hands the role to the first remaining funnel — a
 * set of selected funnels with none of them primary has no goal to optimize for,
 * and the budget step reads that goal.
 */
export function resolvePrimaryKey(selectedKeys: string[], current: string | null): string | null {
  if (current && selectedKeys.includes(current)) return current;
  return selectedKeys[0] ?? null;
}
