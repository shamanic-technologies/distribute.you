/**
 * Profiles (WHO) and their lists (WHO x WHERE), as human-service and features-service serve
 * them (owner 2026-10-09, human-service v0.50.0).
 *
 * A client PROFILE is a cold audience the client keeps or pauses (`profileAudienceId` null,
 * no buying signal). A source LIST is built for ONE profile (`profileAudienceId` = that
 * profile): "Heads of QA (Hiring now)". Pausing or archiving a profile pauses its lists
 * (human-service does it); this module only NAMES what the rows already say.
 *
 * AUDIENCE-SOURCES-1016 (owner 2026-10-16: « the SOURCES should be a concept separate from
 * TARGETING »): human-service now keeps a source BESIDE its audience. Every audience serves
 * `channels[]` = its own list (no `sourceId`), then one entry per source (`sourceId`, `name`,
 * `status`, size). A one-time merge turns each legacy per-source row into a source of its profile
 * (the row goes `deprecated`, out of every list). Both shapes read the same here: `sourcesOfProfile`
 * gives a profile its own list, its served sources, then any legacy row still built for it.
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
  channels?: ReadonlyArray<AudienceChannelLike>;
}

/** One entry of an audience's served `channels[]`: its own list, or (with `sourceId`) one of its sources. */
export interface AudienceChannelLike {
  list: string;
  signal: { type: string } | null;
  sourceId?: string;
  name?: string;
  status?: string;
  size?: number | null;
  sizeUnknownReason?: string | null;
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

/** The audience's OWN list in its served `channels[]` (the entry with no `sourceId`). */
export function ownChannelOf<C extends AudienceChannelLike>(a: { channels?: ReadonlyArray<C> }): C | null {
  return a.channels?.find((c) => !c.sourceId) ?? null;
}

/** The sources human-service serves beside an audience (`channels[]` entries with a `sourceId`). */
export function servedSourcesOf<C extends AudienceChannelLike>(a: { channels?: ReadonlyArray<C> }): C[] {
  return (a.channels ?? []).filter((c) => !!c.sourceId);
}

/** The human-service list kind of an audience's own list, or null when it has none. */
export function listKindOf(a: ProfileListAudience): string | null {
  return ownChannelOf(a)?.list ?? null;
}

/** The source (sourcing origin) whose list kinds include `kind`. */
export function originOfKind<O extends SourcingOriginLike>(kind: string, origins: readonly O[]): O | null {
  return origins.find((o) => o.audienceLists.includes(kind)) ?? null;
}

/** The source (sourcing origin) whose list kinds include this audience's list. */
export function originOf<O extends SourcingOriginLike>(a: ProfileListAudience, origins: readonly O[]): O | null {
  const kind = listKindOf(a);
  return kind ? originOfKind(kind, origins) : null;
}

/** The buying signal of a list, in the words the owner uses (display lookup on the served type). */
const SIGNAL_LABEL: Record<string, string> = {
  hiring: "Hiring now",
  job_change: "New in role",
  funding: "Recently funded",
  linkedin_engagement: "Engaged with competitor posts",
};

function signalWord(type: string): string {
  return SIGNAL_LABEL[type] ?? type;
}

export function signalLabelOf(a: ProfileListAudience): string | null {
  const type = ownChannelOf(a)?.signal?.type;
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

/**
 * One source of a profile: its own list, a source human-service serves beside it (merged model),
 * or a legacy row built for it ("Heads of QA (Hiring now)") until the merge runs.
 */
export interface ProfileSource<A, O> {
  key: string;
  /** The features-service source this is, by list kind (display join). */
  origin: O | null;
  /** The source's own name: the served source name, or the legacy row's name. Null on the own list. */
  name: string | null;
  /** The signal in words ("Hiring now"); null on a plain list. */
  signal: string | null;
  /** Served on/off: `active` | `paused` (a legacy row may also read `archived`). */
  status: string;
  /** Served size; null with `sizeUnknownReason` (or nothing served). */
  size: number | null;
  sizeUnknownReason: string | null;
  /** True on the profile's own list. */
  own: boolean;
  /** The legacy per-source row, null otherwise. */
  list: A | null;
}

function ownSource<A extends ProfileListAudience, O extends SourcingOriginLike>(profile: A, origins: readonly O[]): ProfileSource<A, O> {
  const c = ownChannelOf(profile);
  return {
    key: `${profile.id}:own`,
    origin: originOf(profile, origins),
    name: null,
    signal: null,
    status: profile.status,
    size: c?.size ?? null,
    sizeUnknownReason: c?.sizeUnknownReason ?? null,
    own: true,
    list: null,
  };
}

function servedSources<A extends ProfileListAudience, O extends SourcingOriginLike>(profile: A, origins: readonly O[]): ProfileSource<A, O>[] {
  return servedSourcesOf(profile).map((c) => ({
    key: c.sourceId!,
    origin: originOfKind(c.list, origins),
    name: c.name ?? null,
    signal: c.signal ? signalWord(c.signal.type) : null,
    status: c.status ?? "active",
    size: c.size ?? null,
    sizeUnknownReason: c.sizeUnknownReason ?? null,
    own: false,
    list: null,
  }));
}

function legacySource<A extends ProfileListAudience, O extends SourcingOriginLike>(l: A, origins: readonly O[]): ProfileSource<A, O> {
  const c = ownChannelOf(l);
  return {
    key: l.id,
    origin: originOf(l, origins),
    name: l.name,
    signal: signalLabelOf(l),
    status: l.status,
    size: c?.size ?? null,
    sizeUnknownReason: c?.sizeUnknownReason ?? null,
    own: false,
    list: l,
  };
}

/**
 * Every source of a profile: its own list first, then the sources human-service serves beside it,
 * then each legacy row still built for it (archived left out). Live ones first after the own list.
 */
export function sourcesOfProfile<A extends ProfileListAudience, O extends SourcingOriginLike>(
  profile: A,
  audiences: readonly A[],
  origins: readonly O[],
): ProfileSource<A, O>[] {
  const rank = (s: string) => (s === "active" ? 0 : s === "paused" ? 1 : 2);
  const others = [
    ...servedSources(profile, origins),
    ...listsOfProfile(profile.id, audiences)
      .filter((l) => l.status !== "archived")
      .map((l) => legacySource(l, origins)),
  ].sort((x, y) => rank(x.status) - rank(y.status));
  return [ownSource(profile, origins), ...others];
}

/** A source held by its profile: the source is not live and the profile is paused or archived. */
export function sourceHeldByProfile(source: { own: boolean; status: string }, profile: ProfileListAudience): boolean {
  if (source.own) return false;
  return source.status !== "active" && (profile.status === "paused" || profile.status === "archived");
}

/** One entry under a source: the profile it looks for (null on an old whole-target list) and that source of it. */
export interface OriginEntry<A, O> {
  profile: A | null;
  source: ProfileSource<A, O>;
  /** The audience row this entry reads (the profile, or the legacy row). */
  row: A;
}

/**
 * For one source: one entry per profile it reaches, on both shapes. An audience whose own list
 * is this source is its own entry (a legacy row reads its profile); each served source of a
 * profile on this source is another. Archived rows left out unless asked; suggested never.
 */
export function entriesOfOrigin<A extends ProfileListAudience, O extends SourcingOriginLike>(
  origin: O,
  audiences: readonly A[],
  origins: readonly O[],
  { archived = false }: { archived?: boolean } = {},
): OriginEntry<A, O>[] {
  const byId = new Map(audiences.map((a) => [a.id, a]));
  const shown = audiences.filter((a) => (archived || a.status !== "archived") && a.status !== "suggested");
  const entries: OriginEntry<A, O>[] = [];
  for (const a of shown) {
    if (originOf(a, origins)?.slug === origin.slug) {
      const profile = profileOf(a, byId);
      entries.push({ profile, row: a, source: profile && profile.id === a.id ? ownSource(a, origins) : legacySource(a, origins) });
    }
    if (!isClientProfile(a)) continue;
    for (const s of servedSources(a, origins)) {
      if (s.origin?.slug === origin.slug) entries.push({ profile: a, row: a, source: s });
    }
  }
  const nameOf = (e: OriginEntry<A, O>) => e.profile?.name ?? e.row.name;
  return entries.sort((x, y) => nameOf(x).localeCompare(nameOf(y)));
}
