/**
 * Monitoring > Emails: the health of OUR sending, read off instantly-service through the gateway's
 * staff-only `/v1/instantly/ops/*` passthroughs (api-service `requireStaff`). Every figure here is
 * the producer's: inbox % per provider per day (seed placement tests, stored daily series), the
 * mailboxes it kept out of prospect mail, the bar a mailbox must clear (lifecycle rules), and one
 * row per domain / mailbox / sending address. This module parses and LOOKS UP; it never sums,
 * averages or re-grades a figure.
 *
 * Schemas mirror apps/admin/src/lib/api.ts (DELIVERABILITY-CHARTS-1019, #5558) where admin reads
 * the same route; the per-row reads keep only the fields these pages show.
 *
 * Alias-free so it carries real unit tests.
 */
import { z } from "zod";

// ─── Seed placement (inbox % per provider per day) ─────────────────────────

const SeedPlacementCellSchema = z.object({
  seeds: z.number(),
  inbox: z.number(),
  spam: z.number(),
  missing: z.number(),
  inboxPct: z.number().nullable(),
  spamPct: z.number().nullable(),
});
export type SeedPlacementCell = z.infer<typeof SeedPlacementCellSchema>;
const ProviderCellsShape = {
  google: SeedPlacementCellSchema,
  microsoft: SeedPlacementCellSchema,
  microsoftConsumer: SeedPlacementCellSchema,
};
const SeedPlacementDaySchema = z.object({
  day: z.string(),
  ...ProviderCellsShape,
  // The same cells per sending vendor (Primeforge, Gandi…): the fleet figure mixes vendors that
  // land very differently, so the page always shows them apart.
  byVendor: z.array(z.object({ vendor: z.string(), ...ProviderCellsShape })).optional(),
});
export const SeedPlacementDailySchema = z.object({
  asOf: z.string(),
  from: z.string(),
  to: z.string(),
  days: z.array(SeedPlacementDaySchema),
});
export type SeedPlacementDaily = z.infer<typeof SeedPlacementDailySchema>;
export type SeedPlacementDay = SeedPlacementDaily["days"][number];
export type InboxProvider = "google" | "microsoft" | "microsoftConsumer";

/** The receiving side, by the names people know (never the mailbox vendors). */
export const INBOX_PROVIDERS: Array<{ key: InboxProvider; name: string }> = [
  { key: "google", name: "Google" },
  { key: "microsoft", name: "Microsoft 365" },
  { key: "microsoftConsumer", name: "Outlook.com" },
];

/** The latest day a provider was measured (a day with no test is null, never 0). Lookup only. */
export function latestMeasured(days: SeedPlacementDay[], provider: InboxProvider): { day: string; cell: SeedPlacementCell; byVendor: Array<{ vendor: string; cell: SeedPlacementCell }> } | null {
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d[provider].inboxPct !== null) {
      return {
        day: d.day,
        cell: d[provider],
        byVendor: (d.byVendor ?? []).map((v) => ({ vendor: v.vendor, cell: v[provider] })).filter((v) => v.cell.inboxPct !== null),
      };
    }
  }
  return null;
}

/** Red when a measured inbox % sits under instantly-service's own bar (`bars.deliveryPctBar`). */
export function underBar(inboxPct: number | null, bar: number): boolean {
  return inboxPct !== null && inboxPct < bar;
}

// ─── Sender health (mailboxes kept out of prospect mail) ───────────────────

const SenderHealthDaySchema = z.object({
  day: z.string(),
  // A day with no dispatch tick is null, never 0.
  refusedMailboxes: z.number().nullable(),
  mostlySpamMailboxes: z.object({ google: z.number(), microsoft: z.number(), microsoft_consumer: z.number() }).nullable(),
  heldPlacement: z.number().nullable(),
  heldMostlySpam: z.number().nullable(),
  skippedRefused: z.number().nullable(),
});
export const SenderHealthSchema = z.object({
  asOf: z.string(),
  from: z.string(),
  to: z.string(),
  current: z
    .object({
      day: z.string(),
      updatedAt: z.string(),
      refused: z.array(z.string()),
      mostlySpam: z.object({ google: z.array(z.string()), microsoft: z.array(z.string()), microsoft_consumer: z.array(z.string()) }),
    })
    .nullable(),
  days: z.array(SenderHealthDaySchema),
});
export type SenderHealth = z.infer<typeof SenderHealthSchema>;
export type SenderHealthDay = SenderHealth["days"][number];

/** The latest day a dispatch tick wrote, or null when none in the window. Lookup only. */
export function latestSenderHealthDay(data: SenderHealth): SenderHealthDay | null {
  for (let i = data.days.length - 1; i >= 0; i--) {
    if (data.days[i].refusedMailboxes !== null || data.days[i].mostlySpamMailboxes !== null) return data.days[i];
  }
  return null;
}

// ─── Lifecycle rules (the bars, as data) ───────────────────────────────────

export const LifecycleRulesSchema = z.object({
  states: z.array(z.object({ status: z.string(), meaning: z.string(), newSends: z.boolean(), campaignDailyLimit: z.number().nullable(), warmupDaily: z.number().nullable() })),
  bars: z.object({ healthEntryBar: z.number(), deliveryPctBar: z.number(), deliveryEvidenceMaxAgeDays: z.number() }),
  ramp: z.object({ floorPerDay: z.number(), growthFactor: z.number(), volumeWindowDays: z.number(), ceiling: z.number(), matureAgeDays: z.number(), statistic: z.string() }),
  placement: z.object({ testableMinAgeDays: z.number(), seedTestIntervalDays: z.number(), seedEvidenceUrgentAgeDays: z.number() }),
});
export type LifecycleRules = z.infer<typeof LifecycleRulesSchema>;

/** The producer's lifecycle word, capitalised for display (never renamed). */
export const LIFECYCLE_WORD: Record<string, string> = {
  in_production: "In production",
  in_recovery: "In recovery",
  deactivated_by_instantly: "Deactivated by Instantly",
  deactivated_by_user: "Deactivated by us",
};
export const lifecycleWord = (s: string | null) => (s == null ? null : (LIFECYCLE_WORD[s] ?? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())));

// ─── Per-entity rows ───────────────────────────────────────────────────────

const VolumeSchema = z.object({
  outreach: z.number(),
  warmup: z.number(),
  seed: z.number(),
  repliesIn: z.number(),
  bouncesIn: z.number(),
  // null = nothing sent in the window, never a zero rate.
  bounceRatePerMille: z.number().nullable(),
});
export type Volume = z.infer<typeof VolumeSchema>;

/** Pooled seed-test evidence for a domain / mailbox. `inboxPct` null = never tested. */
const DeliverySchema = z.object({
  inboxCount: z.number(),
  seedTotal: z.number(),
  inboxPct: z.number().nullable(),
  testedAt: z.string().nullable(),
  measuredAccounts: z.number(),
});
export type Delivery = z.infer<typeof DeliverySchema>;

export const OpsDomainsSchema = z.object({
  asOf: z.string(),
  domains: z.array(
    z.object({
      domain: z.string(),
      provider: z.string().nullable(),
      role: z.string().nullable(),
      status: z.string().nullable(),
      expiresAt: z.string().nullable(),
      absentSince: z.string().nullable(),
      mailboxes: z.number(),
      addresses: z.object({ total: z.number(), byLifecycle: z.record(z.string(), z.number()) }),
      sentLast30d: z.number(),
      volume30d: VolumeSchema,
      delivery: DeliverySchema,
    }),
  ),
});
export type OpsDomains = z.infer<typeof OpsDomainsSchema>;
export type OpsDomainRow = OpsDomains["domains"][number];

export const OpsMailboxesSchema = z.object({
  asOf: z.string(),
  mailboxes: z.array(
    z.object({
      login: z.string(),
      domain: z.string(),
      provider: z.string().nullable(),
      poolType: z.string().nullable(),
      absentSince: z.string().nullable(),
      addresses: z.array(z.object({ email: z.string(), lifecycleStatus: z.string().nullable(), lifecycleReason: z.string().nullable(), dailyLimit: z.number().nullable() })),
      sustainedDaily: z.number(),
      effectiveDailyCap: z.number().nullable(),
      rampProjection: z.array(z.object({ date: z.string(), cap: z.number() })),
      warmupBudgetToday: z.number().nullable(),
      delivery: DeliverySchema,
      evidenceExpiresAt: z.string().nullable(),
      volume7d: VolumeSchema,
    }),
  ),
});
export type OpsMailboxes = z.infer<typeof OpsMailboxesSchema>;
export type OpsMailboxRow = OpsMailboxes["mailboxes"][number];

export const OpsAddressesSchema = z.object({
  asOf: z.string(),
  accounts: z.array(
    z.object({
      email: z.string(),
      domain: z.string().nullable(),
      mailboxLogin: z.string().nullable(),
      lifecycleStatus: z.string().nullable(),
      lifecycleReason: z.string().nullable(),
      dailyLimit: z.number().nullable(),
      effectiveDailyCap: z.number().nullable().optional(),
      inboxPlacement: z.object({ inboxPct: z.number(), spamPct: z.number(), missingPct: z.number(), testedAt: z.string() }).nullable(),
      sentToday: z.number(),
      sentYesterday: z.number(),
      queueSize: z.number(),
      nextSeedTest: z.object({ due: z.boolean(), reason: z.string().nullable(), ageDays: z.number().nullable(), expectedAt: z.string().nullable() }).nullable(),
      volume7d: VolumeSchema,
    }),
  ),
});
export type OpsAddresses = z.infer<typeof OpsAddressesSchema>;
export type OpsAddressRow = OpsAddresses["accounts"][number];

// ─── Unit events (one row per email) ───────────────────────────────────────

export const OpsMessagesSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      direction: z.string(),
      kind: z.string(),
      accountEmail: z.string().nullable(),
      mailboxLogin: z.string().nullable(),
      counterparty: z.string().nullable(),
      subject: z.string().nullable(),
      outcome: z.string().nullable(),
      placement: z.string().nullable(),
      occurredAt: z.string(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
export type OpsMessages = z.infer<typeof OpsMessagesSchema>;

/** The producer's message kind, in words. Unknown kinds print as served. */
export const MESSAGE_KIND_WORD: Record<string, string> = {
  outreach: "Campaign",
  warmup: "Warmup",
  warmup_reply: "Warmup reply",
  seed: "Placement test",
  manual_reply: "Reply by hand",
  reply: "Reply",
};

// ─── Per account / mailbox / domain (MAILBOX-MONITORING-1019) ──────────────

/**
 * One account (sending address), one mailbox (the login a provider enforces quota at) or one
 * domain: every per-entity read takes the same `account|mailbox|domain` filter, and the producer
 * serves mailbox figures that add up to the domain and the fleet.
 */
export const ENTITY_KINDS = ["account", "mailbox", "domain"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];
export type EntityScope = Partial<Record<EntityKind, string>>;

/** The list page each kind lives under, and back: `emails/accounts/<email>`. */
export const ENTITY_LIST_SEGMENT: Record<EntityKind, "accounts" | "mailboxes" | "domains"> = { account: "accounts", mailbox: "mailboxes", domain: "domains" };
export const ENTITY_WORD: Record<EntityKind, string> = { account: "Account", mailbox: "Mailbox", domain: "Domain" };

/** `account=a%40b.com&` style query for a scope (empty scope = the fleet). */
export function scopeQuery(scope: EntityScope): string {
  return ENTITY_KINDS.filter((k) => scope[k]).map((k) => `${k}=${encodeURIComponent(scope[k]!)}`).join("&");
}

/** The Monitoring path of one entity's page, relative to the Monitoring base. */
export function entityPath(kind: EntityKind, key: string): string {
  return `emails/${ENTITY_LIST_SEGMENT[kind]}/${encodeURIComponent(key)}`;
}
export function placementTestPath(testId: string): string {
  return `emails/placement-tests/${encodeURIComponent(testId)}`;
}

/** The first UTC day of a trailing window of `days` days ending today, as the producer's `since`. */
export function windowSince(days: number, now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  return d.toISOString();
}

// Capacity per day: the reconstruction of what each mailbox could send, past, today and ahead.
const CapacityDaySchema = z.object({
  date: z.string(),
  phase: z.enum(["past", "today", "future"]),
  capacity: z.number(),
  rampCap: z.number(),
  operatorLimit: z.number(),
  sustained: z.number(),
  mailboxesInProduction: z.number(),
  addressesInProduction: z.number(),
});
export const CapacityDailySchema = z.object({
  asOf: z.string(),
  horizonDays: z.number(),
  rampRules: z.object({ floorPerDay: z.number(), growthFactor: z.number(), volumeWindowDays: z.number(), ceilingPerDay: z.number(), rule: z.string() }),
  days: z.array(CapacityDaySchema),
  // False at the account grain: aliases share one mailbox's quota (never stack accounts).
  additive: z.boolean().optional(),
});
export type CapacityDaily = z.infer<typeof CapacityDailySchema>;
export type CapacityDay = CapacityDaily["days"][number];

// What is planned ahead, per day from today. Queued steps carry THEORETICAL dates (owner's call).
const ScheduleDaySchema = z.object({
  date: z.string(),
  isToday: z.boolean(),
  queuedSteps: z.number(),
  queuedFirstEmails: z.number(),
  queuedFollowUps: z.number(),
  warmupsPlanned: z.number(),
  seedTestsPlanned: z.number(),
  seedsPlanned: z.number(),
});
export const ScheduleSchema = z.object({
  asOf: z.string(),
  horizonDays: z.number(),
  days: z.array(ScheduleDaySchema),
  totals: z.object({ overdueQueuedSteps: z.number(), undatedQueuedSteps: z.number(), beyondHorizonQueuedSteps: z.number() }),
});
export type Schedule = z.infer<typeof ScheduleSchema>;
export type ScheduleDay = Schedule["days"][number];

export const QueuedStepsSchema = z.object({
  total: z.number(),
  offset: z.number(),
  steps: z.array(
    z.object({
      leadEmail: z.string(),
      orgId: z.string().nullable(),
      campaignId: z.string().nullable(),
      account: z.string(),
      mailbox: z.string(),
      domain: z.string(),
      step: z.number(),
      isFirstEmail: z.boolean(),
      theoreticalAt: z.string().nullable(),
      overdue: z.boolean(),
    }),
  ),
  nextOffset: z.number().nullable(),
});
export type QueuedSteps = z.infer<typeof QueuedStepsSchema>;

// Placement tests: one row per test, counts per inbox provider; one test seed by seed.
const ProviderCountsSchema = z.object({ seeds: z.number(), inbox: z.number(), spam: z.number(), missing: z.number(), inboxPct: z.number().nullable() });
export type ProviderCounts = z.infer<typeof ProviderCountsSchema>;
const ByProviderSchema = z.object({ google: ProviderCountsSchema, microsoft: ProviderCountsSchema, microsoftConsumer: ProviderCountsSchema, other: ProviderCountsSchema });
export type TestProvider = keyof z.infer<typeof ByProviderSchema>;
/** Placement tests count a fourth bucket, seeds at any other provider. */
export const TEST_PROVIDERS: Array<{ key: TestProvider; name: string }> = [...INBOX_PROVIDERS, { key: "other", name: "Other" }];

export const PlacementTestsSchema = z.object({
  tests: z.array(
    z.object({
      testId: z.string(),
      source: z.string(),
      testedAt: z.string(),
      senders: z.number(),
      total: ProviderCountsSchema,
      byProvider: ByProviderSchema,
    }),
  ),
  nextCursor: z.string().nullable(),
});
export type PlacementTests = z.infer<typeof PlacementTestsSchema>;

export const PlacementTestDetailSchema = z.object({
  testId: z.string(),
  source: z.string(),
  testedAt: z.string().nullable(),
  // False for an Instantly test: its missing seeds exist only as counts.
  missingSeedsListed: z.boolean(),
  total: ProviderCountsSchema,
  byProvider: ByProviderSchema,
  bySender: z.array(z.object({ sender: z.string(), senderMailbox: z.string(), total: ProviderCountsSchema, byProvider: ByProviderSchema })),
  seeds: z.array(
    z.object({
      sender: z.string(),
      senderMailbox: z.string(),
      senderDomain: z.string(),
      receiver: z.string().nullable(),
      provider: z.string(),
      providerLabel: z.string(),
      placement: z.enum(["inbox", "spam", "missing"]).nullable(),
      folder: z.string().nullable(),
      dispatchOutcome: z.string(),
      dispatchedAt: z.string().nullable(),
      observedAt: z.string().nullable(),
      spfPass: z.boolean().nullable(),
      dkimPass: z.boolean().nullable(),
      dmarcPass: z.boolean().nullable(),
    }),
  ),
});
export type PlacementTestDetail = z.infer<typeof PlacementTestDetailSchema>;

/** Who wrote a placement test: our own seed sender, or Instantly's inbox-placement test. */
export const TEST_SOURCE_WORD: Record<string, string> = { seed: "Our seed test", instantly: "Instantly test" };

// The inbox-placement alert: per day and provider, the inbox % of the mailboxes that still mail it.
const AlertCountsShape = { seeds: z.number(), found: z.number(), inbox: z.number(), inboxPct: z.number().nullable() };
export const PlacementAlertsSchema = z.object({
  asOf: z.string(),
  bar: z.object({ inboxPctOfFound: z.number(), minFoundSeeds: z.number(), basis: z.string() }),
  days: z.array(
    z.object({
      day: z.string(),
      provider: z.string(),
      providerLabel: z.string(),
      fleet: z.object(AlertCountsShape),
      allowed: z.object({ senders: z.number(), ...AlertCountsShape }),
      mailboxesCut: z.number(),
      measured: z.boolean(),
      below: z.boolean(),
    }),
  ),
  episodes: z.array(
    z.object({
      provider: z.string(),
      startedOn: z.string(),
      lastBelowOn: z.string(),
      closedOn: z.string().nullable(),
      inboxPct: z.number(),
      foundSeeds: z.number(),
      thresholdPct: z.number(),
      mailboxesCut: z.number(),
      alertStatus: z.string().nullable(),
    }),
  ),
});
export type PlacementAlerts = z.infer<typeof PlacementAlertsSchema>;
export type PlacementAlertDay = PlacementAlerts["days"][number];

/** The alert's provider keys, by the names people know. */
export const ALERT_PROVIDERS: Array<{ key: string; name: string }> = [
  { key: "google", name: "Google" },
  { key: "microsoft", name: "Microsoft 365" },
  { key: "microsoft_consumer", name: "Outlook.com" },
];

/** A provider's served rows in day order, and its latest MEASURED day (null = never measured). Lookup only. */
export function alertSeries(data: PlacementAlerts, provider: string): { days: PlacementAlertDay[]; latest: PlacementAlertDay | null } {
  const days = data.days.filter((d) => d.provider === provider).sort((a, b) => a.day.localeCompare(b.day));
  let latest: PlacementAlertDay | null = null;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].measured) {
      latest = days[i];
      break;
    }
  }
  return { days, latest };
}

export const MessageBodySchema = z.object({ text: z.string().nullable(), html: z.string().nullable(), source: z.string() });
export type MessageBody = z.infer<typeof MessageBodySchema>;
