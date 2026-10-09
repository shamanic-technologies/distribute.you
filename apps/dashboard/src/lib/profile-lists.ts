/**
 * Profiles (WHO) and their lists (WHO x WHERE), as human-service and features-service serve
 * them (owner 2026-10-09, human-service v0.50.0).
 *
 * A client PROFILE is a cold audience the client keeps or pauses (`profileAudienceId` null,
 * no buying signal). A source LIST is built for ONE profile (`profileAudienceId` = that
 * profile): "Heads of QA (Hiring now)". Pausing or archiving a profile pauses its lists
 * (human-service does it); this module only NAMES what the rows already say.
 *
 * The source a list belongs to is features-service's `/public/sourcing-origins`
 * (`origins[].audienceLists` = the human-service list kinds each origin is): a display join on
 * served fields, nothing derived from names.
 *
 * Alias-free on purpose (no runtime `@/` import) so the unit tests import it directly.
 */

export interface ProfileListAudience {
  id: string;
  name: string;
  status: string;
  profileAudienceId?: string | null;
  filters: Record<string, unknown> | null;
  channels?: ReadonlyArray<{ list: string; signal: { type: string } | null }>;
}

export interface SourcingOriginLike {
  slug: string;
  name: string;
  audienceLists: readonly string[];
  live: boolean;
  displayOrder: number;
  provider: { name: string; domain: string } | null;
}

function hasSignal(filters: Record<string, unknown> | null | undefined): boolean {
  const s = filters?.buying_signal;
  return !!s && typeof s === "object" && !Array.isArray(s);
}

/** A client profile: who we write to. Never a list built for a profile, never a signal list. */
export function isClientProfile(a: ProfileListAudience): boolean {
  return (a.profileAudienceId ?? null) === null && !hasSignal(a.filters);
}

/** The human-service list kind of an audience (`channels[0].list`), or null when it has none. */
export function listKindOf(a: ProfileListAudience): string | null {
  return a.channels?.[0]?.list ?? null;
}

/** The source (sourcing origin) whose list kinds include this audience's list. */
export function originOf<O extends SourcingOriginLike>(a: ProfileListAudience, origins: readonly O[]): O | null {
  const kind = listKindOf(a);
  if (!kind) return null;
  return origins.find((o) => o.audienceLists.includes(kind)) ?? null;
}

/** The buying signal of a list, in the words the owner uses (display lookup on the served type). */
const SIGNAL_LABEL: Record<string, string> = {
  hiring: "Hiring now",
  job_change: "New in role",
  funding: "Recently funded",
  linkedin_engagement: "Engaged with competitor posts",
};

export function signalLabelOf(a: ProfileListAudience): string | null {
  const type = a.channels?.[0]?.signal?.type;
  if (type) return SIGNAL_LABEL[type] ?? type;
  const s = a.filters?.buying_signal as { type?: unknown } | undefined;
  return typeof s?.type === "string" ? (SIGNAL_LABEL[s.type] ?? s.type) : null;
}

/** The lists built for one profile, live ones first. */
export function listsOfProfile<A extends ProfileListAudience>(profileId: string, audiences: readonly A[]): A[] {
  const rank = (s: string) => (s === "active" ? 0 : s === "paused" ? 1 : 2);
  return audiences
    .filter((a) => a.profileAudienceId === profileId)
    .sort((x, y) => rank(x.status) - rank(y.status) || x.name.localeCompare(y.name));
}

/** The profile a list was built for; a profile is its own (its cold list IS the profile). */
export function profileOf<A extends ProfileListAudience>(a: A, byId: ReadonlyMap<string, A>): A | null {
  if (a.profileAudienceId) return byId.get(a.profileAudienceId) ?? null;
  return isClientProfile(a) ? a : null;
}

/** A list held by its profile: the list is not live and the profile it serves is paused or archived. */
export function heldByProfile(list: ProfileListAudience, profile: ProfileListAudience | null): boolean {
  if (!profile || profile.id === list.id) return false;
  return list.status !== "active" && (profile.status === "paused" || profile.status === "archived");
}

/** One reach of a profile: a source and the list it reaches the profile with. */
export interface ProfileReach<A, O> {
  origin: O | null;
  list: A;
  /** The list's signal in words ("Hiring now"); null on the profile's own cold list. */
  signal: string | null;
}

/** The sources that reach a profile: its own cold list, then each list built for it (archived left out). */
export function reachOfProfile<A extends ProfileListAudience, O extends SourcingOriginLike>(
  profile: A,
  audiences: readonly A[],
  origins: readonly O[],
): ProfileReach<A, O>[] {
  const own: ProfileReach<A, O> = { origin: originOf(profile, origins), list: profile, signal: null };
  const lists = listsOfProfile(profile.id, audiences)
    .filter((l) => l.status !== "archived")
    .map((l) => ({ origin: originOf(l, origins), list: l, signal: signalLabelOf(l) }));
  return [own, ...lists];
}

/** For one source: one entry per profile it reaches (archived lists left out unless asked). */
export function listsOfOrigin<A extends ProfileListAudience, O extends SourcingOriginLike>(
  origin: O,
  audiences: readonly A[],
  origins: readonly O[],
  { archived = false }: { archived?: boolean } = {},
): A[] {
  return audiences
    .filter((a) => (archived || a.status !== "archived") && a.status !== "suggested")
    .filter((a) => originOf(a, origins)?.slug === origin.slug)
    .sort((x, y) => x.name.localeCompare(y.name));
}
