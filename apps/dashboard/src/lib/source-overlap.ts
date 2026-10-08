/**
 * WHO FOUND THE OFFER'S LEADS (owner 2026-10-08): "It must be tagged both ... So we know a
 * human belongs to several signals, which is a higher interest." A lead carries every
 * source that found it; features-service serves, per source, the leads carrying it and how
 * many of them another source found too, and the offer's leads bucketed by number of
 * sources (each lead counted once). Nothing here counts or divides: it orders and labels
 * served rows.
 *
 * Alias-free so it carries real unit tests.
 */

export interface ServedOverlapSource {
  campaignKey: string;
  channelName: string;
  campaignName: string | null;
  provider: { domain: string } | null;
  live: boolean;
  leadsFound?: number | null;
  leadsAlsoFoundByAnotherSource?: number | null;
}

export interface SourceLeadRow {
  key: string;
  channelName: string;
  campaignName: string | null;
  providerDomain: string | null;
  /** Null = the producer could not read it (shown as a dash). */
  leads: number | null;
  alsoFoundByAnother: number | null;
}

/** One row per live source, most leads first (an unread count last). */
export function sourceLeadRows(served: readonly ServedOverlapSource[]): SourceLeadRow[] {
  return served
    .filter((s) => s.live)
    .map((s) => ({
      key: s.campaignKey,
      channelName: s.channelName,
      campaignName: s.campaignName,
      providerDomain: s.provider?.domain ?? null,
      leads: s.leadsFound ?? null,
      alsoFoundByAnother: s.leadsAlsoFoundByAnotherSource ?? null,
    }))
    .sort((a, b) => (b.leads ?? -1) - (a.leads ?? -1));
}

export interface ServedBucket {
  sourceCount: number;
  leads: number;
}

/** "1 source", "2 sources", "3+ sources", "No source found". */
export function bucketLabel(sourceCount: number): string {
  if (sourceCount <= 0) return "No source found";
  if (sourceCount === 1) return "1 source";
  if (sourceCount >= 3) return "3+ sources";
  return `${sourceCount} sources`;
}

/**
 * The buckets as the table lists them: 1, 2, 3+, then the leads no source is proven for
 * (only when there are any: an empty "no source" row says nothing).
 */
export function orderedBuckets<B extends ServedBucket>(buckets: readonly B[]): B[] {
  const rank = (n: number) => (n <= 0 ? 99 : n);
  return buckets.filter((b) => b.sourceCount > 0 || b.leads > 0).sort((a, b) => rank(a.sourceCount) - rank(b.sourceCount));
}

export interface ServedLeadSource {
  origin: { slug: string; name: string } | null;
  servedLead: boolean;
}

/**
 * The lead page's "Found by" tags: one per sourcing origin (two Apollo Cold Filters
 * audiences are one tag), the origin that served the lead first. An entry naming no
 * origin cannot be tagged and is reported, never guessed.
 */
export function leadSourceTags(sources: readonly ServedLeadSource[]): { slug: string; name: string; served: boolean }[] {
  const bySlug = new Map<string, { slug: string; name: string; served: boolean }>();
  for (const s of sources) {
    if (!s.origin) {
      console.error("[source-overlap] lead source names no origin", s);
      continue;
    }
    const prev = bySlug.get(s.origin.slug);
    bySlug.set(s.origin.slug, { slug: s.origin.slug, name: s.origin.name, served: (prev?.served ?? false) || s.servedLead });
  }
  return [...bySlug.values()].sort((a, b) => Number(b.served) - Number(a.served) || a.name.localeCompare(b.name));
}
