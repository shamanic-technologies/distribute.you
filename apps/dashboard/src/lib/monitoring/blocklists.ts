import { z } from "zod";

/**
 * Monitoring > Emails > Blocklists (staff only), alias-free so vitest reads it directly.
 *
 * Two instantly-service reads through api-service's staff passthroughs:
 * - `GET /v1/instantly/ops/domain-blocklist?days=` (`DomainBlocklistRead`, v0.83.95 #1184): every
 *   sending domain checked daily on SURBL, Spamhaus DBL and URIBL, its events and daily series. A
 *   `null` point is a day before the first honest check: no bar, "Not checked yet", never a zero.
 *   SURBL's removal is filed by instantly-service itself (`lists[].removalAutomated`, weekly per
 *   domain); the `failed` removal count is drawn only when EVERY point serves it.
 * - `GET /v1/instantly/ops/lead-source-yield?days=` (`LeadSourceYieldRead`, #1186): which lead source
 *   feeds us dead addresses and spam traps. Counting rule `per_tag`: a person found by several
 *   sources counts once under each, so a day's stack can exceed its served `total`; every
 *   headline is the served total.
 *
 * Schemas copied from apps/admin/src/lib/api.ts (same routes), kept to the fields the page renders
 * plus the ones that pin the contract. Helpers here look up, sort for display and format; they
 * never sum, average or derive a figure shown.
 */

// ─── Domain blocklist ──────────────────────────────────────────────────────

export const BlocklistKeySchema = z.enum(["surbl", "spamhaus_dbl", "uribl"]);
export type BlocklistKey = z.infer<typeof BlocklistKeySchema>;

export const DomainBlocklistSchema = z.object({
  asOf: z.string(),
  monitoredSince: z.string().nullable(),
  lists: z.array(
    z.object({
      key: BlocklistKeySchema,
      name: z.string(),
      zone: z.string(),
      removalUrl: z.string(),
      removalAutomated: z.boolean(),
      removalNote: z.string(),
    }),
  ),
  domains: z.array(
    z.object({
      domain: z.string(),
      mailboxes: z.array(z.string()),
      listed: z.boolean(),
      outOfNewSequences: z.boolean(),
      lists: z.array(
        z.object({
          list: BlocklistKeySchema,
          state: z.enum(["listed", "clean", "unknown"]),
          listedSince: z.string().nullable(),
          lastCheckedAt: z.string().nullable(),
        }),
      ),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      domain: z.string(),
      list: z.string(),
      type: z.enum(["listed", "delisted", "removal_link_issued", "removal_requested", "removal_failed"]),
      detail: z.unknown(),
      occurredAt: z.string(),
      alert: z
        .object({ status: z.string(), attempts: z.number(), lastError: z.string().nullable(), alertedAt: z.string().nullable() })
        .nullable(),
    }),
  ),
  series: z.object({
    days: z.array(z.string()),
    domainsListed: z.array(
      z.object({ day: z.string(), total: z.number().nullable(), byList: z.record(z.string(), z.number()).nullable() }),
    ),
    mailboxesOutOfNewSequences: z.array(z.object({ day: z.string(), mailboxes: z.number().nullable() })),
    sendsFromListedDomains: z.array(z.object({ day: z.string(), sends: z.number().nullable() })),
    blocklistBounces: z.array(
      z.object({
        day: z.string(),
        total: z.number(),
        byList: z.object({ surbl: z.number(), spamhaus: z.number(), uribl: z.number(), other_list: z.number() }),
      }),
    ),
    // `failed` is optional: absent = not served, drawn as no series, never a zero.
    removalRequests: z.array(
      z.object({ day: z.string(), linksIssued: z.number(), requested: z.number(), failed: z.number().optional() }),
    ),
    delistings: z.array(z.object({ day: z.string(), delistings: z.number() })),
  }),
});
export type DomainBlocklist = z.infer<typeof DomainBlocklistSchema>;
export type DomainBlocklistDomain = DomainBlocklist["domains"][number];
export type DomainBlocklistEvent = DomainBlocklist["events"][number];

/** `detail` of an AUTOMATED removal attempt: what the list answered, or why it failed. */
export const RemovalAttemptDetailSchema = z.object({
  method: z.literal("automated"),
  outcome: z.string(),
  httpStatus: z.number().nullable(),
  error: z.string().nullable(),
  answer: z.string().nullable(),
});
export type RemovalAttemptDetail = z.infer<typeof RemovalAttemptDetailSchema>;

/** The automated attempt behind a removal event; `null` for a person's recorded request or any other event. */
export function removalAttemptDetail(event: DomainBlocklistEvent): RemovalAttemptDetail | null {
  if (event.type !== "removal_requested" && event.type !== "removal_failed") return null;
  const parsed = RemovalAttemptDetailSchema.safeParse(event.detail);
  if (parsed.success) return parsed.data;
  if (event.type === "removal_failed") {
    console.error("[dashboard] removal_failed event without a readable reason", { id: event.id, detail: event.detail });
  }
  return null;
}

export const EVENT_WORD: Record<DomainBlocklistEvent["type"], string> = {
  listed: "Listed",
  delisted: "Removed from the list",
  removal_link_issued: "Removal link sent to you",
  removal_requested: "Removal requested",
  removal_failed: "Removal request failed",
};

/** Listed domains first, then by name. Display order only. */
export function sortDomains(domains: DomainBlocklistDomain[]): DomainBlocklistDomain[] {
  return [...domains].sort((a, b) => Number(b.listed) - Number(a.listed) || a.domain.localeCompare(b.domain));
}

/** Newest first. Display order only. */
export function sortEvents(events: DomainBlocklistEvent[]): DomainBlocklistEvent[] {
  return [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** The lists a person already recorded a removal request on, for one domain. */
export function requestedLists(data: DomainBlocklist, domain: string): Set<string> {
  return new Set(data.events.filter((e) => e.domain === domain && e.type === "removal_requested").map((e) => e.list));
}

/** True only when every served point carries `failed`: an absent count is not a zero. */
export function servesFailed(points: DomainBlocklist["series"]["removalRequests"]): boolean {
  return points.length > 0 && points.every((p) => typeof p.failed === "number");
}

export type ChartPart = { label: string; value: number; color: string };
export type ChartPoint = { day: string; parts: ChartPart[] | null };
export type DailyChart = {
  id: string;
  title: string;
  note: string;
  /** The latest served point, as served; `null` = not checked that day. */
  now: string | null;
  legend: Array<{ label: string; color: string }>;
  series: ChartPoint[];
};

export const LIST_COLOR: Record<string, string> = {
  surbl: "var(--data-rose)",
  spamhaus_dbl: "var(--data-violet)",
  uribl: "var(--data-sky)",
  other_list: "var(--fg-4)",
};
/** The bounce series keys its lists differently from `lists[].key`. */
const BOUNCE_LIST: Array<{ key: "surbl" | "spamhaus" | "uribl" | "other_list"; list: string | null }> = [
  { key: "surbl", list: "surbl" },
  { key: "spamhaus", list: "spamhaus_dbl" },
  { key: "uribl", list: "uribl" },
  { key: "other_list", list: null },
];

const fmt = (v: number) => v.toLocaleString("en-US");
function last<T>(points: T[]): T | null {
  return points.length ? points[points.length - 1] : null;
}

/** One chart per monitored sub-topic, each read straight off its served daily series. */
export function blocklistCharts(data: DomainBlocklist): DailyChart[] {
  const s = data.series;
  const listName = (k: string) => data.lists.find((l) => l.key === k)?.name ?? k;
  const lists = data.lists.map((l) => ({ key: l.key, label: l.name, color: LIST_COLOR[l.key] ?? "var(--fg-4)" }));
  const bounceKeys = BOUNCE_LIST.map((b) => ({
    key: b.key,
    label: b.list ? listName(b.list) : "Other list",
    color: LIST_COLOR[b.list ?? "other_list"],
  }));
  const failed = servesFailed(s.removalRequests);
  const removalKeys = [
    { key: "requested" as const, label: "Sent to the list", color: "var(--accent)" },
    ...(failed ? [{ key: "failed" as const, label: "Failed", color: "var(--data-rose)" }] : []),
    { key: "linksIssued" as const, label: "Links sent to you", color: "var(--fg-4)" },
  ];
  const lastListed = last(s.domainsListed);
  const lastOut = last(s.mailboxesOutOfNewSequences);
  const lastSends = last(s.sendsFromListedDomains);
  const lastBounce = last(s.blocklistBounces);
  const lastRemoval = last(s.removalRequests);
  const lastDelist = last(s.delistings);
  return [
    {
      id: "domainsListed",
      title: "Domains listed",
      note: "Per list. A listed domain takes no new prospects.",
      now: lastListed?.total == null ? null : fmt(lastListed.total),
      legend: lists,
      series: s.domainsListed.map((p) => ({
        day: p.day,
        parts: p.byList ? lists.filter((k) => typeof p.byList![k.key] === "number").map((k) => ({ label: k.label, value: p.byList![k.key], color: k.color })) : null,
      })),
    },
    {
      id: "mailboxesOut",
      title: "Mailboxes out of new sequences",
      note: "Their follow-ups keep going out.",
      now: lastOut?.mailboxes == null ? null : fmt(lastOut.mailboxes),
      legend: [],
      series: s.mailboxesOutOfNewSequences.map((p) => ({
        day: p.day,
        parts: p.mailboxes === null ? null : [{ label: "Mailboxes", value: p.mailboxes, color: "var(--data-amber)" }],
      })),
    },
    {
      id: "sendsFromListed",
      title: "Emails sent from a listed domain",
      note: "Follow-ups only.",
      now: lastSends?.sends == null ? null : fmt(lastSends.sends),
      legend: [],
      series: s.sendsFromListedDomains.map((p) => ({
        day: p.day,
        parts: p.sends === null ? null : [{ label: "Emails", value: p.sends, color: "var(--fg-3)" }],
      })),
    },
    {
      id: "blocklistBounces",
      title: "Emails refused because of a blocklist",
      note: "Per list named in the refusal.",
      now: lastBounce ? fmt(lastBounce.total) : null,
      legend: bounceKeys,
      series: s.blocklistBounces.map((p) => ({
        day: p.day,
        parts: bounceKeys.map((k) => ({ label: k.label, value: p.byList[k.key], color: k.color })),
      })),
    },
    {
      id: "removalRequests",
      title: "Removal requests",
      note: failed ? "Sent to the list, failed, and links sent to you." : "Sent to the list, and links sent to you.",
      now: lastRemoval
        ? failed && typeof lastRemoval.failed === "number"
          ? `${fmt(lastRemoval.requested)} sent, ${fmt(lastRemoval.failed)} failed`
          : `${fmt(lastRemoval.requested)} sent`
        : null,
      legend: removalKeys,
      series: s.removalRequests.map((p) => ({
        day: p.day,
        parts: removalKeys.map((k) => ({ label: k.label, value: p[k.key] as number, color: k.color })),
      })),
    },
    {
      id: "delistings",
      title: "Domains removed from a list",
      note: "It takes new prospects again.",
      now: lastDelist ? fmt(lastDelist.delistings) : null,
      legend: [],
      series: s.delistings.map((p) => ({ day: p.day, parts: [{ label: "Removed", value: p.delistings, color: "var(--run)" }] })),
    },
  ];
}

// ─── Lead source yield ─────────────────────────────────────────────────────

const LeadSourceYieldMeasuresSchema = z.object({
  firstEmails: z.number(),
  hardBounces: z.number(),
  hardBounceRate: z.number().nullable(),
  refusals: z.number(),
  refusalRate: z.number().nullable(),
  blocklistRefusals: z.number(),
  firstEmailsFromListedDomains: z.number(),
  listedDomainShare: z.number().nullable(),
});
const LeadSourceYieldPointSchema = z.object({ day: z.string(), total: z.number(), byKey: z.record(z.string(), z.number()) });
export const LeadSourceYieldSchema = z.object({
  asOf: z.string(),
  countingRule: z.literal("per_tag"),
  countingRuleNote: z.string(),
  pseudoKeys: z.object({ noSourceRecorded: z.string(), unknown: z.string() }),
  provenanceSyncedAt: z.string().nullable(),
  refusalsMeasuredSince: z.string().nullable(),
  total: LeadSourceYieldMeasuresSchema,
  coverage: z.object({ firstEmails: z.number(), withSource: z.number(), noSourceRecorded: z.number(), unknown: z.number() }),
  sources: z.array(LeadSourceYieldMeasuresSchema.extend({ key: z.string(), kind: z.enum(["source", "no_source_recorded", "unknown"]) })),
  series: z.object({
    days: z.array(z.string()),
    keys: z.array(z.string()),
    firstEmails: z.array(LeadSourceYieldPointSchema),
    hardBounces: z.array(LeadSourceYieldPointSchema),
    refusals: z.array(LeadSourceYieldPointSchema),
    blocklistRefusals: z.array(LeadSourceYieldPointSchema),
    firstEmailsFromListedDomains: z.array(LeadSourceYieldPointSchema),
  }),
});
export type LeadSourceYield = z.infer<typeof LeadSourceYieldSchema>;

/** Display name of a served source tag ("sourcing-apollo-cold-filters" -> "Apollo cold filters"); the tag stays in the tooltip. */
export function sourceLabel(key: string): string {
  const bare = key.replace(/^sourcing-/, "").replace(/^list:/, "list ");
  return bare.charAt(0).toUpperCase() + bare.slice(1).replace(/[-_]/g, " ");
}

const SOURCE_PALETTE = [
  "var(--accent)",
  "var(--data-rose)",
  "var(--data-sky)",
  "var(--data-amber)",
  "var(--data-teal)",
  "var(--data-violet)",
  "var(--data-lime)",
  "var(--fg-3)",
];
const PSEUDO_COLOR = "var(--data-track)";

export const YIELD_MEASURES = [
  { key: "firstEmails", title: "First emails, by source" },
  { key: "hardBounces", title: "Hard bounces, by source" },
  { key: "refusals", title: "Refused by the receiver, by source" },
  { key: "blocklistRefusals", title: "Refused because of a blocklist, by source" },
  { key: "firstEmailsFromListedDomains", title: "First emails from a listed domain, by source" },
] as const;

/** One stacked daily chart per measure; the headline is the served `total` of the latest day, never the stack. */
export function yieldCharts(data: LeadSourceYield): DailyChart[] {
  const pseudo = new Set([data.pseudoKeys.noSourceRecorded, data.pseudoKeys.unknown]);
  const keys = data.series.keys.map((k, i) => ({
    key: k,
    label: pseudo.has(k) ? k : sourceLabel(k),
    color: pseudo.has(k) ? PSEUDO_COLOR : SOURCE_PALETTE[i % SOURCE_PALETTE.length],
  }));
  return YIELD_MEASURES.map((m) => {
    const points = data.series[m.key];
    const latest = last(points);
    return {
      id: m.key,
      title: m.title,
      note: "A person found by several sources counts under each.",
      now: latest ? fmt(latest.total) : null,
      legend: keys,
      series: points.map((p) => ({
        day: p.day,
        parts: keys.filter((k) => typeof p.byKey[k.key] === "number").map((k) => ({ label: k.label, value: p.byKey[k.key], color: k.color })),
      })),
    };
  });
}

/** A served rate (a fraction) as a percent: whole, a decimal only below 1%, `<0.1%` for a non-zero that rounds to 0. */
export function ratePct(rate: number | null): string | null {
  if (rate == null) return null;
  const p = rate * 100;
  if (p === 0) return "0%";
  if (p < 1) {
    const r = Math.round(p * 10) / 10;
    return r === 0 ? "<0.1%" : `${r}%`;
  }
  return `${Math.round(p)}%`;
}
