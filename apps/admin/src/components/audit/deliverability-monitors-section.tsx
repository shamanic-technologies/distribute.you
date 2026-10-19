"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getSeedPlacementDaily,
  getSenderHealth,
  type SeedPlacementDaily,
  type SeedPlacementProvider,
  type SenderHealth,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Section, num, utc } from "@/components/cold-email/primitives";
import { BlocklistDailyChart, type DailyPoint } from "@/components/audit/blocklist-daily-chart";

/**
 * Two instantly-service monitors, one chart per sub-topic (owner rule 2026-10-16),
 * each read straight off the producer's STORED daily series (SENDER-HEALTH-1019):
 *
 * - Inbox placement: seed tests, inbox % per day at Google, Microsoft 365 and
 *   Outlook.com, measured apart (they filter apart). A day with no test is null.
 * - Sender health: mailboxes cut from prospect mail per day, and why (the mail
 *   server refuses them, or most seeds land in spam at a provider). A day with no
 *   dispatch tick is null.
 *
 * The page computes no figure: every headline is a served value.
 */

const PROVIDERS: Array<{ key: SeedPlacementProvider; title: string; color: string }> = [
  { key: "google", title: "Inbox rate at Google", color: "#2563eb" },
  { key: "microsoft", title: "Inbox rate at Microsoft 365", color: "#0891b2" },
  { key: "microsoftConsumer", title: "Inbox rate at Outlook.com", color: "#7c3aed" },
];

const SPAM_KEYS = [
  { key: "google", label: "Google", color: "#2563eb" },
  { key: "microsoft", label: "Microsoft 365", color: "#0891b2" },
  { key: "microsoft_consumer", label: "Outlook.com", color: "#7c3aed" },
] as const;

function shortDay(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Latest measured inbox % for one provider, with its day: "52.7% on Oct 19". */
export function latestInboxPct(data: SeedPlacementDaily, provider: SeedPlacementProvider): string {
  for (let i = data.days.length - 1; i >= 0; i--) {
    const cell = data.days[i][provider];
    if (cell.inboxPct !== null) return `${cell.inboxPct}% on ${shortDay(data.days[i].day)}`;
  }
  return "Never tested";
}

/** The latest day a dispatch tick wrote, or null when none in the window. */
export function latestSenderHealthDay(data: SenderHealth): SenderHealth["days"][number] | null {
  for (let i = data.days.length - 1; i >= 0; i--) {
    if (data.days[i].refusedMailboxes !== null || data.days[i].mostlySpamMailboxes !== null) return data.days[i];
  }
  return null;
}

export function DeliverabilityMonitorsSection({ days }: { days: number }) {
  const placement = useAuthQuery<SeedPlacementDaily>(
    ["seedPlacementDaily", days],
    () => getSeedPlacementDaily(days),
    pollOptionsSlower,
  );
  const health = useAuthQuery<SenderHealth>(["senderHealth", days], () => getSenderHealth(days), pollOptionsSlower);

  const latest = health.data ? latestSenderHealthDay(health.data) : null;
  const spam = latest?.mostlySpamMailboxes ?? null;

  return (
    <>
      <Section
        title="Inbox placement"
        blurb="Our test emails to seed inboxes we own: the share that landed in the inbox, per provider. A day with no bar had no test."
        isPending={placement.isPending}
        isError={placement.isError}
        error={placement.error}
      >
        {placement.data && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PROVIDERS.map((p) => (
              <BlocklistDailyChart
                key={p.key}
                title={p.title}
                now={latestInboxPct(placement.data, p.key)}
                data={placement.data.days.map((d): DailyPoint => ({ day: d.day, inboxPct: d[p.key].inboxPct }))}
                keys={[{ key: "inboxPct", label: "In the inbox", color: p.color }]}
                unit="%"
                yMax={100}
                emptyLabel="No test that day"
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Mailboxes cut from prospects"
        blurb="Mailboxes we stopped sending prospect mail from, and why. They come back by themselves once fixed."
        isPending={health.isPending}
        isError={health.isError}
        error={health.error}
      >
        {health.data && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {health.data.current
                ? `Last check ${utc(health.data.current.updatedAt)}.`
                : "No check recorded yet: days show no bar until the first one."}
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <BlocklistDailyChart
                title="Refused by the mail server (blacklisted or reconnect needed)"
                now={latest?.refusedMailboxes != null ? num(latest.refusedMailboxes) : "—"}
                data={health.data.days.map((d): DailyPoint => ({ day: d.day, refused: d.refusedMailboxes }))}
                keys={[{ key: "refused", label: "Mailboxes", color: "#dc2626" }]}
                emptyLabel="No check that day"
              />
              <BlocklistDailyChart
                title="Mostly in spam, by provider"
                now={spam ? SPAM_KEYS.map((k) => `${k.label} ${num(spam[k.key])}`).join(" · ") : "—"}
                data={health.data.days.map(
                  (d): DailyPoint => ({
                    day: d.day,
                    ...Object.fromEntries(SPAM_KEYS.map((k) => [k.key, d.mostlySpamMailboxes ? d.mostlySpamMailboxes[k.key] : null])),
                  }),
                )}
                keys={SPAM_KEYS.map((k) => ({ key: k.key, label: k.label, color: k.color }))}
                emptyLabel="No check that day"
              />
            </div>
          </div>
        )}
      </Section>
    </>
  );
}
