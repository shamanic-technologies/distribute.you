"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffKeySecurity } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, dayLabel, n } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED, shortDay } from "@/components/v2/monitoring-sending";
import { alertWords, kindWords, secretsHeadline, secretsTone, type KeySecurity, type SecurityDay, type SecurityIncident } from "@/lib/monitoring/key-security";

/**
 * Monitoring > Security > Secrets (staff only, SECURITY-ALERTS-1128-CHART; `lib/monitoring/key-security.ts`).
 * key-service audits every secret read or write and every request carrying a wrong service key, and mails staff ONCE
 * per security incident itself: this page sends nothing. It draws the served daily series (reads on their own chart,
 * the rare signals on a second one so they never vanish under the reads), the recent incidents in one plain line each,
 * and the served `red` verdict, which already leaves staff test incidents out. No key value or prefix is shown.
 */

export const SECRETS_DAYS = 30;
const AMBER = "var(--data-amber)";
const ROSE = "var(--data-rose)";
const SKY = "var(--data-sky)";
const TEAL = "var(--data-teal)";
const VIOLET = "var(--data-violet)";

export function useKeySecurity() {
  return useAuthQuery(["staffKeySecurity", SECRETS_DAYS], () => getStaffKeySecurity(SECRETS_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

type Bar = SecurityDay & { period: string };

function IncidentRow({ i }: { i: SecurityIncident }) {
  const failed = i.alertStatus === "failed";
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 break-words text-[13px]" title={kindWords(i.kind)}>{i.summary}</p>
        <span className="k-mono k-fg2 shrink-0 whitespace-nowrap text-[12px]">{utcTime(i.openedAt)} UTC</span>
      </div>
      <p className="k-fg3 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {i.test && <span className="k-chip">Test</span>}
        <span>{i.eventCount === 1 ? "1 event" : `${n(i.eventCount)} events`}</span>
        <span aria-hidden="true">·</span>
        <span style={{ color: failed ? RED : undefined }} title={i.alertError ?? undefined}>
          {alertWords(i)}
        </span>
      </p>
    </li>
  );
}

export function SecretsView({ data }: { data: KeySecurity }) {
  const red = secretsTone(data) === "red";
  const periods: Bar[] = data.days.map((d) => ({ ...d, period: d.day }));
  const label = (day: string, short?: boolean) => (short ? shortDay(day) : dayLabel(day));
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium" style={{ color: red ? RED : undefined }}>
            {secretsHeadline(data)}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            Red while an incident opened in the last 24 hours or a staff alert could not be delivered. Test incidents never turn it red. key-service emails staff once per incident; this page sends nothing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionTitle right={<span>per UTC day</span>}>Secrets read</SectionTitle>
          <PeriodBars
            periods={periods}
            series={[{ key: "reads", label: "Secrets read", color: TEAL, get: (d: Bar) => d.secretReads }]}
            format={n}
            label={label}
            empty="No day in the window."
          />
        </section>
        <section className="min-w-0">
          <SectionTitle right={<span>per UTC day</span>}>Writes, refusals and incidents</SectionTitle>
          <PeriodBars
            periods={periods}
            series={[
              { key: "writes", label: "Keys written", color: SKY, get: (d: Bar) => d.keyWrites },
              { key: "refused", label: "Reads refused", color: AMBER, get: (d: Bar) => d.secretReadsRefused },
              { key: "wrongKey", label: "Wrong service key", color: VIOLET, get: (d: Bar) => d.wrongKeyRequests },
              { key: "incidents", label: "Incidents opened", color: ROSE, get: (d: Bar) => d.incidentsOpened },
            ]}
            format={n}
            label={label}
            empty="No day in the window."
          />
        </section>
      </div>

      <section>
        <SectionTitle count={data.incidents.length}>Recent incidents</SectionTitle>
        {data.incidents.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No incident yet.</EmptyNote>
          </div>
        ) : (
          <div className="k-card overflow-hidden">
            <ul className="k-scroll max-h-[420px] divide-y divide-[var(--line-subtle)] overflow-y-auto">
              {data.incidents.map((i) => (
                <IncidentRow key={i.id} i={i} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

export function SecretsPage() {
  const q = useKeySecurity();
  if (q.isError && !q.data) return <Failed what="the secrets audit" />;
  if (!q.data) return <Loading />;
  return <SecretsView data={q.data} />;
}

/** The hub's one-second read: the served verdict in words, red only when key-service says red. */
export function SecretsTile({ href }: { href: string }) {
  const q = useKeySecurity();
  const data = q.data;
  const red = data ? secretsTone(data) === "red" : false;
  const today = data?.days[data.days.length - 1];
  return (
    <StatTile label="Secrets" note={today ? shortDay(today.day) : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : red ? (
            <span style={{ color: RED }}>{secretsHeadline(data)}</span>
          ) : (
            "Clear"
          )
        }
      />
      {today && <p className="k-fg3 mt-0.5 truncate text-[12px]">{n(today.secretReads)} secrets read today</p>}
    </StatTile>
  );
}
