"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffConnectorIntake } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, dayLabel } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import {
  connectionName,
  reasonWords,
  redConnections,
  type ConnectorIntake,
  type ConnectorIntakeConnection,
} from "@/lib/monitoring/connector-intake";

/**
 * Monitoring > Connected tools (staff only, CONNECTOR-INTAKE-MONITORING-1028). crm-service serves, per tool a client
 * connected (GoHighLevel, PostHog, Stripe, Clerk), the records the vendor dated on each day and its verdict: red when
 * the sync fails, is late, or the account went quieter than its own habit. Red on the hub IS the alert (no email).
 * This file draws served values in the served order; it computes no figure.
 */

export const CONNECTOR_DAYS = 30;
const RECORDS = "var(--data-teal)";
const MUTED = "var(--fg-4)";

export function useConnectorIntake() {
  return useAuthQuery(["staffConnectorIntake", CONNECTOR_DAYS], () => getStaffConnectorIntake(CONNECTOR_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

function statusColor(c: ConnectorIntakeConnection): string {
  return c.status === "red" ? RED : c.status === "paused" ? MUTED : OK;
}

/** One connection: its verdict, why when red, and a bar per day of records taken in. */
function ConnectionBlock({ c }: { c: ConnectorIntakeConnection }) {
  const red = c.status === "red";
  return (
    <section>
      <SectionTitle
        right={
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(c) }} aria-hidden="true" />
            {red ? "Red" : c.status === "paused" ? "Paused" : "OK"}
          </span>
        }
      >
        {connectionName(c)}
      </SectionTitle>
      {red && (
        <p className="mb-2 text-[13px]" style={{ color: RED }}>
          {c.reasons.map((r) => reasonWords(c, r)).join("; ")}
        </p>
      )}
      <PeriodBars
        periods={c.byDay.map((d) => ({ ...d, period: d.day }))}
        series={[{ key: "records", label: "Records taken in", color: RECORDS, get: (d) => d.records }]}
        format={(v) => v.toLocaleString("en-US")}
        label={(d, short) => dayLabel(d, short ? { month: "short", day: "numeric" } : undefined)}
        empty={`No day served for the last ${CONNECTOR_DAYS} days.`}
      />
      <p className="k-fg3 mt-2 text-[12px]">
        {c.newestRecordDay ? `Newest record ${dayLabel(c.newestRecordDay)}` : "No record yet"}
        {c.lastSyncedAt ? ` · synced ${utcTime(c.lastSyncedAt)} UTC` : " · never synced"}
        {c.account && c.brandName ? ` · ${c.account}` : ""}
      </p>
    </section>
  );
}

export function ConnectorIntakeView({ data }: { data: ConnectorIntake }) {
  const reds = redConnections(data);
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: data.status === "red" ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {data.status === "red" ? (
            reds.map((c) => (
              <p key={c.connectionId} className="text-[14px] font-medium">
                {connectionName(c)}: {c.reasons.map((r) => reasonWords(c, r)).join("; ")}
              </p>
            ))
          ) : (
            <p className="text-[14px] font-medium">Every connected tool still brings records in.</p>
          )}
          <p className="k-fg3 mt-0.5 text-[12px]">
            Read {utcTime(data.generatedAt)} UTC. Red when the sync fails, no sync for {data.rule.syncLateAfterMinutes / 60} h, or a tool stays
            quiet longer than its own longest quiet stretch of the last {data.rule.historyDays} days.
          </p>
        </div>
      </div>
      {data.connections.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No client has connected a tool yet.</EmptyNote>
        </div>
      ) : (
        data.connections.map((c) => <ConnectionBlock key={c.connectionId} c={c} />)
      )}
    </div>
  );
}

export function ConnectorIntakePage() {
  const q = useConnectorIntake();
  if (q.isError && !q.data) return <Failed what="the connected tools" />;
  if (!q.data) return <Loading />;
  return <ConnectorIntakeView data={q.data} />;
}

/** The hub's one-second read: how many connected tools are red now, which ones under it. */
export function ConnectorIntakeTile({ href }: { href: string }) {
  const q = useConnectorIntake();
  const data = q.data;
  const reds = data ? redConnections(data) : undefined;
  return (
    <StatTile label="Connected tools red" note={data ? `of ${data.connections.length} connected` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : reds === undefined ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: reds.length ? RED : undefined }}>{reds.length}</span>
          )
        }
        sub={reds === undefined ? undefined : reds.length ? reds.map(connectionName).join(", ") : "all bringing records in"}
      />
    </StatTile>
  );
}
