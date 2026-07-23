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
 * The funnel is CUMULATIVE at the top and current-state below:
 *  - Published : status `published` (article live).
 *  - Selected  : status `selected` (journalist picked it, awaiting publish).
 *  - In Review : status `submitted` — SENT and still awaiting a decision, i.e.
 *                NOT yet in the Selected/Published pages ("not in the other
 *                pages"). The "many still waiting" bucket.
 *  - Pitched   : EVERY pitch we sent = `submitted` + `selected` + `published`
 *                (the funnel top / total pitched — a Selected or Published
 *                pitch was also pitched). This is why Pitched ⊇ the others.
 * `drafted` (generated, not yet sent — an internal pre-send state) and
 * `not_selected` / failure statuses are NOT surfaced: a client tracks
 * placements, not un-sent drafts or rejections.
 *
 * `dateLabel` is the column header + meaning of the row's timestamp on that
 * tab (a published row's date = when it was published, a pitched row's = when
 * it was sent), replacing the old generic "Updated".
 */
export interface PitchStatusTab {
  /** URL slug + sidebar id. */
  slug: "published" | "selected" | "in-review" | "pitched";
  label: string;
  /** Column header for the timestamp on this tab. */
  dateLabel: string;
  /** Wire statuses that fall under this tab. */
  statuses: QuotePitchStatus[];
}

export const PITCH_STATUS_TABS: readonly PitchStatusTab[] = [
  { slug: "published", label: "Published", dateLabel: "Published", statuses: ["published"] },
  { slug: "selected", label: "Selected", dateLabel: "Selected", statuses: ["selected"] },
  { slug: "in-review", label: "In Review", dateLabel: "Submitted", statuses: ["submitted"] },
  { slug: "pitched", label: "Pitched", dateLabel: "Pitched", statuses: ["submitted", "selected", "published"] },
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

/** The timestamp shown for a pitch on a given tab — the moment it reached
 *  that stage: Pitched = when it was SENT (`submittedAt`), Published = the
 *  real per-article publish date (`publishedAt`), Selected = when the outcome
 *  was observed. `updatedAt` (identical across every reconciled row) is only a
 *  last-resort proxy. */
export function pitchTimestamp(
  pitch: QuotePitch,
  tabSlug: PitchStatusTab["slug"],
): string | null {
  switch (tabSlug) {
    case "pitched":
    case "in-review":
      // Both key on when the pitch was SENT.
      return pitch.submittedAt ?? pitch.createdAt ?? pitch.updatedAt ?? null;
    case "published":
      return pitch.publishedAt ?? pitch.outcomeObservedAt ?? pitch.updatedAt ?? null;
    case "selected":
      return pitch.outcomeObservedAt ?? pitch.updatedAt ?? null;
  }
}

/** Registrable host from EITHER a bare domain (`7shifts.com`) OR a full URL
 *  (`https://www.forbes.com/x`), `www.` stripped, lowercased. Returns null on
 *  an unparseable / empty value.
 *
 *  The quote request's `mediaOutlet` is already a bare outlet domain
 *  (`azbigmedia.com`), so this is a display lookup on backend-authoritative
 *  data — NOT a name-derivation heuristic. Never derive the logo from the
 *  `pitchUrl` (a connectively.us platform link → the wrong, identical logo on
 *  every row). */
export function toDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    const host = new URL(withScheme).hostname.replace(/^www\./, "");
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
