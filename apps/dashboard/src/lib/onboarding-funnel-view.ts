// Display view over the Sales Funnels catalogue for the staff onboarding preview.
//
// Why an adapter rather than reading `SALES_FUNNELS` fields directly: the
// catalogue is being reshaped right now in a parallel workspace (a `name` per
// funnel, a fourth "Sales Meeting from Website" funnel, and the flat `steps`
// tuple becoming richer legs). The onboarding step maps over whatever the
// catalogue holds, so it picks up the new shape with no edit here and no edit
// there — the rename is absorbed in ONE place instead of at every render site.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias in this repo).

/**
 * The shape this view reads. Deliberately structural and permissive: it spans
 * both the catalogue as it stands (`steps: [a, b, c]`) and as it is becoming
 * (`name` + per-leg objects), so neither side has to land first.
 */
export type FunnelCatalogueEntry = {
  key: string;
  name?: string;
  steps?: readonly string[];
  legs?: readonly { from?: string; to?: string; label?: string }[];
  goal?: string;
  requiresWebsite?: boolean;
  rates?: readonly { key: string; label: string; tip?: string }[];
  destination?: { kind?: string; label?: string; hint?: string; placeholder?: string };
  tone?: { iconBg?: string; iconText?: string };
};

export type FunnelView = {
  key: string;
  /** Card title. The catalogue's own name when it has one, else the chain. */
  title: string;
  /** The chain, rendered under the title. Always at least two entries. */
  steps: string[];
  goal: string | null;
  requiresWebsite: boolean;
  rates: { key: string; label: string; tip: string }[];
  destination: { label: string; hint: string; placeholder: string } | null;
  tone: { iconBg: string; iconText: string };
};

const FALLBACK_TONE = { iconBg: "bg-gray-50", iconText: "text-gray-600" };

/**
 * The chain of step labels, from whichever field the catalogue carries. A legs
 * array is walked `from → to` so a four-step chain reads in full; a flat steps
 * tuple is taken as-is.
 */
export function funnelStepLabels(entry: FunnelCatalogueEntry): string[] {
  if (entry.legs && entry.legs.length > 0) {
    const out: string[] = [];
    for (const leg of entry.legs) {
      const from = leg.from?.trim();
      const to = leg.to?.trim();
      if (from && out[out.length - 1] !== from) out.push(from);
      if (to) out.push(to);
    }
    if (out.length > 0) return out;
  }
  return (entry.steps ?? []).map((s) => s.trim()).filter(Boolean);
}

/**
 * The card title. A catalogue that names its funnels wins; otherwise the chain
 * itself is the title, which is exactly how the settings card read before the
 * names existed — so a missing name degrades to the previous look rather than
 * to an empty heading.
 */
export function funnelTitle(entry: FunnelCatalogueEntry): string {
  const named = entry.name?.trim();
  if (named) return named;
  const steps = funnelStepLabels(entry);
  return steps.length > 0 ? steps.join(" → ") : entry.key;
}

export function toFunnelView(entry: FunnelCatalogueEntry): FunnelView {
  return {
    key: entry.key,
    title: funnelTitle(entry),
    steps: funnelStepLabels(entry),
    goal: entry.goal ?? null,
    requiresWebsite: entry.requiresWebsite === true,
    rates: (entry.rates ?? []).map((r) => ({ key: r.key, label: r.label, tip: r.tip ?? "" })),
    destination: entry.destination
      ? {
          label: entry.destination.label ?? "Destination",
          hint: entry.destination.hint ?? "",
          placeholder: entry.destination.placeholder ?? "",
        }
      : null,
    tone: {
      iconBg: entry.tone?.iconBg ?? FALLBACK_TONE.iconBg,
      iconText: entry.tone?.iconText ?? FALLBACK_TONE.iconText,
    },
  };
}

export function toFunnelViews(entries: readonly FunnelCatalogueEntry[]): FunnelView[] {
  return entries.map(toFunnelView);
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
 * is still selected, otherwise hands the role to the first remaining funnel —
 * a set of selected funnels with none of them primary has no goal to optimize
 * for, and the pricing step reads that goal.
 */
export function resolvePrimaryKey(selectedKeys: string[], current: string | null): string | null {
  if (current && selectedKeys.includes(current)) return current;
  return selectedKeys[0] ?? null;
}
