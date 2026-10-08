/**
 * Unibox lead families (owner 2026-10-08): Won clients, Hot leads, Lost leads, Cold
 * leads, as filter buttons beside the search and as the colour of each person's tag.
 *
 * The family is features-service's verdict (the same one Today counts), joined onto each
 * person by crm-service and served on its people list (`family`, `families.counts`,
 * `?family=`). Nothing here grades a person: this module only names and colours the
 * served word. Owner definitions: Won = client won; Hot = interested, not won yet; Lost =
 * became interested thanks to us then went cold, or ruled out by a human; Cold =
 * contacted by us, never interested. A person who is not one of our leads has none and
 * shows under All only.
 *
 * Alias-free so it carries real unit tests.
 */
import type { TimelineIcon, TimelineTone } from "./timeline-tags";

export const LEAD_FAMILIES = [
  // Hot first: the family the owner follows ("le plus interessant est de suivre les Hot leads").
  { key: "hot", label: "Hot leads", tone: "hot", icon: "flame" },
  { key: "won", label: "Won clients", tone: "won", icon: "check" },
  { key: "lost", label: "Lost leads", tone: "lost", icon: "lost" },
  { key: "cold", label: "Cold leads", tone: "neutral", icon: "snow" },
] as const satisfies readonly { key: string; label: string; tone: TimelineTone; icon: TimelineIcon }[];

export type LeadFamily = (typeof LEAD_FAMILIES)[number]["key"];
/** What the list is filtered on: one family, or everyone. */
export type FamilyFilter = LeadFamily | "all";

export function isLeadFamily(v: string | null | undefined): v is LeadFamily {
  return LEAD_FAMILIES.some((f) => f.key === v);
}

/**
 * The filter the Unibox shows: the one in the URL, else Hot leads (owner's default), and
 * All once the served counts say nobody is hot.
 */
export function familyFilter(param: string | null, hotCount: number | null): FamilyFilter {
  if (param === "all" || isLeadFamily(param)) return param;
  return hotCount === 0 ? "all" : "hot";
}

/** A person's tag look: their family's tone and icon; no family = the plain neutral tag. */
export function familyLook(family: string | null | undefined): { tone: TimelineTone; icon: TimelineIcon } | null {
  const f = LEAD_FAMILIES.find((x) => x.key === family);
  return f ? { tone: f.tone, icon: f.icon } : null;
}
