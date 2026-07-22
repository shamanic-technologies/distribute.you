import type { QuotePitch, QuotePitchStatus } from "./api";

/**
 * The public press-report for the PR-Expert quote feature is a READ-ONLY
 * tracker: the client watches each quote move down the placement funnel
 * (Pitched → In Review → Selected → Published). It is NOT interactive — the
 * old HITL "write/send a reply" surface was removed.
 *
 * The report sidebar is these four status tabs (most-advanced first), each a
 * page rendering the SAME table filtered to that tab's pitch status(es).
 *
 * Tab → wire status is a 1:1 map over the happy-path statuses. `not_selected`
 * and the failure statuses (error / length_violation / … ) are NOT surfaced —
 * a rejected or errored pitch is not a placement the client tracks.
 */
export interface PitchStatusTab {
  /** URL slug + sidebar id. */
  slug: "published" | "selected" | "in-review" | "pitched";
  label: string;
  /** Wire statuses that fall under this tab. */
  statuses: QuotePitchStatus[];
}

export const PITCH_STATUS_TABS: readonly PitchStatusTab[] = [
  { slug: "published", label: "Published", statuses: ["published"] },
  { slug: "selected", label: "Selected", statuses: ["selected"] },
  { slug: "in-review", label: "In Review", statuses: ["submitted"] },
  { slug: "pitched", label: "Pitched", statuses: ["drafted"] },
];

export function tabForSlug(slug: string): PitchStatusTab | null {
  return PITCH_STATUS_TABS.find((t) => t.slug === slug) ?? null;
}

/** Pitches whose status falls under the given tab. */
export function pitchesForTab(
  pitches: QuotePitch[],
  tab: PitchStatusTab,
): QuotePitch[] {
  const set = new Set<QuotePitchStatus>(tab.statuses);
  return pitches.filter((p) => set.has(p.status));
}

/** Count per tab slug — drives the sidebar badges. Pure count of rows already
 *  on the wire (no derived metric). */
export function countsByTab(
  pitches: QuotePitch[],
): Record<PitchStatusTab["slug"], number> {
  const counts = {
    published: 0,
    selected: 0,
    "in-review": 0,
    pitched: 0,
  } as Record<PitchStatusTab["slug"], number>;
  for (const tab of PITCH_STATUS_TABS) {
    counts[tab.slug] = pitchesForTab(pitches, tab).length;
  }
  return counts;
}

/** The timestamp shown for a pitch on a given tab. The wire carries only
 *  `submittedAt` (exact, for In Review) + `createdAt` (Pitched); `published`
 *  and `selected` have no dedicated timestamp yet (backend follow-up), so the
 *  last status-change time (`updatedAt`) is the best available proxy. */
export function pitchTimestamp(
  pitch: QuotePitch,
  tabSlug: PitchStatusTab["slug"],
): string | null {
  switch (tabSlug) {
    case "pitched":
      return pitch.createdAt ?? null;
    case "in-review":
      return pitch.submittedAt ?? pitch.updatedAt ?? null;
    case "published":
    case "selected":
      return pitch.updatedAt ?? null;
  }
}

/** Bare registrable host from a URL, `www.` stripped. Returns null on an
 *  unparseable / empty value — a domain derived from a real backend URL
 *  (the published `featuredArticleUrl`) is a display lookup, not a
 *  name-derivation heuristic. */
export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/** Human "time ago" from an ISO string. Returns "—" when absent. */
export function timeAgo(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
