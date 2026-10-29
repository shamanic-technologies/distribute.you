"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffSophieReplies } from "@/lib/api";
import { Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, dayLabel, n } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED, shortDay } from "@/components/v2/monitoring-sending";
import { RED_WINDOW_DAYS, recentNotDelivered, type SophieReplyDay, type SophieReplyDays } from "@/lib/monitoring/sophie-replies";

/**
 * Monitoring > WhatsApp > Sophie's replies (staff only, SOPHIE-WA-DELIVERY-CHART-1029). Per UTC day, the WhatsApp
 * replies Sophie delivered and the ones she wrote that never left (chat-service's stored series). Red on the hub IS the
 * alert, never an email. This file draws the served counts; it computes no figure.
 */

export const SOPHIE_REPLY_DAYS = 30;

export function useSophieReplies() {
  return useAuthQuery(["staffSophieReplies", SOPHIE_REPLY_DAYS], () => getStaffSophieReplies(SOPHIE_REPLY_DAYS), { ...pollOptions, retry: false });
}

type Bar = SophieReplyDay & { period: string };

const replies = (v: number) => `${n(v)} ${v === 1 ? "reply" : "replies"}`;

/**
 * Two charts side by side: Not delivered alone on its own scale (a busy day, 632 replies on 2026-10-23, would flatten
 * 1 or 2 refused replies to a pixel in the stacked one), then Delivered (green) under Not delivered (red).
 */
export function SophieRepliesChart({ data }: { data: SophieReplyDays }) {
  const periods: Bar[] = data.days.map((d) => ({ ...d, period: d.day }));
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <PeriodBars
        periods={periods}
        series={[{ key: "notDelivered", label: "Not delivered", color: RED, get: (m) => m.notDelivered }]}
        caption={(m) => `${n(m.received)} ${m.received === 1 ? "message" : "messages"} received`}
        format={n}
        label={(d, short) => (short ? shortDay(d) : dayLabel(d))}
        empty="Sophie has not answered anyone on WhatsApp yet."
      />
      <PeriodBars
        periods={periods}
        series={[
          { key: "delivered", label: "Delivered", color: OK, get: (m) => m.delivered },
          { key: "notDelivered", label: "Not delivered", color: RED, get: (m) => m.notDelivered },
        ]}
        caption={(m) => `${n(m.received)} ${m.received === 1 ? "message" : "messages"} received`}
        format={n}
        label={(d, short) => (short ? shortDay(d) : dayLabel(d))}
        empty="Sophie has not answered anyone on WhatsApp yet."
      />
    </div>
  );
}

export function SophieRepliesPage() {
  const q = useSophieReplies();
  if (q.isError && !q.data) return <Failed what="Sophie's WhatsApp replies" />;
  if (!q.data) return <Loading />;
  const bad = recentNotDelivered(q.data);
  return (
    <div className="space-y-6">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: bad.length ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {bad.length ? (
            bad.map((d) => (
              <p key={d.day} className="text-[14px] font-medium">
                {shortDay(d.day)}: {replies(d.notDelivered)} not delivered, of {n(d.received)} received
              </p>
            ))
          ) : (
            <p className="text-[14px] font-medium">Every reply Sophie wrote in the last {RED_WINDOW_DAYS} days was delivered.</p>
          )}
          <p className="k-fg3 mt-0.5 text-[12px]">Red while today or one of the 2 days before holds a reply that never left.</p>
        </div>
      </div>
      <section>
        <SectionTitle right={<span>One bar per UTC day</span>}>Sophie&apos;s WhatsApp replies</SectionTitle>
        <SophieRepliesChart data={q.data} />
      </section>
    </div>
  );
}

/** The hub's one-second read: the newest recent day holding a not-delivered reply, red; else 0. */
export function SophieRepliesTile({ href }: { href: string }) {
  const q = useSophieReplies();
  const data = q.data;
  const bad = data ? recentNotDelivered(data) : undefined;
  return (
    <StatTile label="Sophie's WhatsApp replies" note={`not delivered, ${RED_WINDOW_DAYS} days`} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : bad === undefined ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: bad.length ? RED : undefined }}>{bad.length ? n(bad[0].notDelivered) : "0"}</span>
          )
        }
        sub={bad === undefined ? undefined : bad.length ? bad.map((d) => `${shortDay(d.day)}: ${n(d.notDelivered)}`).join(", ") : "every reply delivered"}
      />
    </StatTile>
  );
}
