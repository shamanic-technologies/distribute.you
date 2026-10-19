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
