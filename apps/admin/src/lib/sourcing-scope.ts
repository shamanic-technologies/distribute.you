// SOURCING SPLIT in staff cost views (2026-10-07).
//
// Lead-finding spend (the per-lead serve runs and everything bought under them: Apollo
// enrichment, email find/verify, judgments) moves from the outreach channel's feature slug
// to its SOURCING origin's slug (`sourcing-apollo-cold-filters`, ...). features-service owns
// which origins each channel sources from (`GET /v1/public/sourcing-origins`); this module
// never hard-codes that map, it only applies the served one.
//
// Two rules keep the staff totals still across the relabel:
//   1. a ONE-channel cost read filters on the channel AND its own origins (never another
//      channel's: a brand on cold email + CRM email must not see CRM sourcing under cold email);
//   2. a brand read GROUPED by feature folds each origin row under the channel it sources for,
//      as a labelled sub-row, so the channel total is unchanged and sourcing stays visible.
//
// Alias-free on purpose (vitest has no `@` alias): real unit tests import it.

/** channel slug -> origin slugs it sources from (served by features-service). */
export type OriginsByChannel = Readonly<Record<string, readonly string[]>>;

/** The feature slugs a one-channel cost read filters on: the slug + its own origins, sorted, deduped. */
export function featureSlugsWithSourcing(featureSlug: string, byChannel: OriginsByChannel): string[] {
  return [...new Set([featureSlug, ...(byChannel[featureSlug] ?? [])])].sort();
}

export interface FeatureCents {
  featureSlug: string | null;
  cents: number;
}

export interface SourcingSubRow {
  slug: string;
  cents: number;
}

export interface FeatureUsageRow {
  /** Feature slug of the row; null = runs with no feature. */
  slug: string | null;
  /** Row total: the feature's own spend + every sourcing sub-row folded under it. */
  cents: number;
  /** The feature's own spend (outreach, for a channel that sources leads). */
  ownCents: number;
  /** Sourcing spend folded under this channel, largest first. */
  sourcing: SourcingSubRow[];
  /** True on a sourcing origin row that could not be tied to exactly one channel of the brand. */
  isSourcing: boolean;
}

/**
 * Fold a brand's per-feature spend so each sourcing origin sits under the channel it sources
 * for. An origin is folded only when EXACTLY ONE channel of this brand that sources from it has
 * spend; otherwise (none, or two such channels, e.g. cold email + feedback cold email both on
 * Apollo) it stays its own row flagged `isSourcing`, never guessed. The grand total is the sum
 * of the input, always.
 */
export function foldSourcingUnderChannels(
  groups: readonly FeatureCents[],
  byChannel: OriginsByChannel,
  originSlugs: ReadonlySet<string>,
): FeatureUsageRow[] {
  const rows = new Map<string | null, FeatureUsageRow>();
  for (const g of groups) {
    if (g.featureSlug !== null && originSlugs.has(g.featureSlug)) continue;
    const row = rows.get(g.featureSlug);
    if (row) {
      row.cents += g.cents;
      row.ownCents += g.cents;
    } else {
      rows.set(g.featureSlug, { slug: g.featureSlug, cents: g.cents, ownCents: g.cents, sourcing: [], isSourcing: false });
    }
  }
  const brandChannels = [...rows.keys()].filter((s): s is string => s !== null && (byChannel[s]?.length ?? 0) > 0);
  for (const g of groups) {
    if (g.featureSlug === null || !originSlugs.has(g.featureSlug)) continue;
    const owners = brandChannels.filter((c) => byChannel[c]!.includes(g.featureSlug!));
    if (owners.length === 1) {
      const owner = rows.get(owners[0]!)!;
      owner.cents += g.cents;
      owner.sourcing.push({ slug: g.featureSlug, cents: g.cents });
    } else {
      rows.set(g.featureSlug, { slug: g.featureSlug, cents: g.cents, ownCents: g.cents, sourcing: [], isSourcing: true });
    }
  }
  for (const row of rows.values()) row.sourcing.sort((a, b) => b.cents - a.cents);
  return [...rows.values()];
}
