/**
 * Our OWN past landings, frozen one commit at a time.
 *
 * The clones next door are photographs of somebody else's page; these are photographs of
 * ours. Same reason in both cases: a design conversation about what a page WAS goes
 * better against the page than against a memory of it, and most of what is archived here
 * exists nowhere else — the pages that were deleted when the homepage moved on are only
 * still readable because a commit still holds them.
 *
 * An archive is NOT a branch and NOT a rollback target. Nothing reads it at build time,
 * nothing links to it, and the live landing does not know it exists.
 *
 * Two properties are load-bearing and enforced by `tests/unit/archive-serving.test.ts`:
 * an archive is reachable ONLY through the host named here (so nothing is discoverable by
 * guessing a path on distribute.you), and every entry has files on disk (so a host that
 * resolves cannot 404 its way through the whole site).
 */
export type Archive = {
  /** Directory under `apps/landing/archives/`, and the `lab-<slug>` half of the host. */
  readonly slug: string;
  /** The day the archived pages were live, which is what the slug names. */
  readonly servedOn: string;
  /**
   * The commit the bytes were taken from. An archive is rebuildable rather than
   * hand-curated: `scripts/capture-archive.mjs <slug>` reads this commit and writes the
   * directory again, so a question about what was archived is answered by re-running it
   * rather than by trusting the directory.
   */
  readonly commit: string;
  /** One line on why this one was kept. */
  readonly note: string;
  /**
   * How the stored bytes DIFFER from what a visitor received that day.
   *
   * Stated rather than inferred, because an archive's whole value is that it does not
   * lie about the date it names — and it is a replay of a request-time handler, so it
   * cannot be byte-identical to anything on disk at that commit. Every entry here is a
   * deliberate departure with its reason; anything not listed is what the server sent.
   */
  readonly departures: readonly string[];
};

export const ARCHIVES: readonly Archive[] = [
  {
    slug: "2026-06-15",
    servedOn: "2026-06-15",
    commit: "65b74ca9964786c2b7c5c8ec810ab548cd0eb479",
    // Light surface, charter blue at hue 264, "100 sales in 30 days." Sixteen of its
    // twenty-two pages — pricing, performance, use-cases and the whole cold-email
    // cluster — were deleted when the homepage was promoted, so this is the only copy.
    note: "The last landing before the offer-argument rebuild; most of its pages exist nowhere else.",
    departures: [
      // The handler injected GA, Google Ads and PostHog into every page it served. An
      // archive that reported into them would write today's browsing into the record of
      // a date that is over.
      "No analytics: the three trackers the handler injected are absent.",
      // Four figures on /performance and /how-it-works were fetched per request. They
      // carry the handler's own last-known-good constants — what it substituted whenever
      // the metrics API was unreachable — because a token left raw renders as
      // __OPEN_RATE__ and a figure fetched today is this year's number on last year's
      // page.
      "Live figures are the handler's fallback constants, not a fresh read.",
      // Every page referenced its stylesheet relatively and only rendered because the
      // handler rewrote the reference at request time. The capture applies that same
      // rewrite once, so the archive is servable as plain bytes.
      "Asset references were rewritten at capture time, exactly as the handler rewrote them per request.",
      // The pages themselves carried a Google Tag Manager container that was never
      // configured and was removed from the live site later. It is kept: it is part of
      // what shipped, and it reports to nothing.
      "The pages' own unconfigured GTM stub is kept as shipped.",
    ],
  },
];

/**
 * The internal path `src/proxy.ts` rewrites an archive request onto.
 *
 * Distinct from the clones' prefix so the two catalogues cannot resolve each other's
 * directories, and routable for the same reason theirs is — which is also why the proxy
 * 404s this prefix on any host that is not an archive, so an addressable path never
 * becomes a second door with no password on it.
 */
export const ARCHIVE_ROUTE_PREFIX = "/internal-archive";

/** `lab-<slug>.distribute.you` — the same host family as the clones, one level deep. */
export const ARCHIVE_HOST_PREFIX = "lab-";
export const ARCHIVE_HOST_SUFFIX = ".distribute.you";

/**
 * The archive a request's Host belongs to, or null for every other request.
 *
 * Resolved against the CATALOGUE rather than against the filesystem: a host is an
 * allowlist entry, so a made-up `lab-anything` never reaches a directory read. Clones are
 * resolved first in the proxy, so a slug can belong to one or the other and never both.
 */
export function archiveSlugForHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].trim().toLowerCase();
  if (!hostname.startsWith(ARCHIVE_HOST_PREFIX) || !hostname.endsWith(ARCHIVE_HOST_SUFFIX)) {
    return null;
  }

  const slug = hostname.slice(
    ARCHIVE_HOST_PREFIX.length,
    hostname.length - ARCHIVE_HOST_SUFFIX.length,
  );
  return ARCHIVES.some((archive) => archive.slug === slug) ? slug : null;
}

export function archiveFor(slug: string): Archive | null {
  return ARCHIVES.find((archive) => archive.slug === slug) ?? null;
}
