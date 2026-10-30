"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffVendorCredit } from "@/lib/api";
import { Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { dayLabel, n } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED, shortDay } from "@/components/v2/monitoring-sending";
import { hasCalls, outOfCreditVendors, vendorDays, vendorsRedFirst, type VendorCredit, type VendorCreditDay, type VendorCreditItem } from "@/lib/monitoring/vendor-credit";

/**
 * Monitoring > AI vendors > Credit (staff only, VENDOR-CREDIT-1030). chat-service serves, per AI provider it calls,
 * whether the vendor is OUT OF CREDIT right now (a call refused for lack of balance, and no call succeeded on it since),
 * the model calls go to meanwhile, one sentence, and a daily series. Red on the hub IS the alert (no email). This file
 * draws served values in served order (red vendors first, a partition); it computes no figure.
 */

export const VENDOR_CREDIT_DAYS = 30;

export function useVendorCredit() {
  return useAuthQuery(["staffVendorCredit", VENDOR_CREDIT_DAYS], () => getStaffVendorCredit(VENDOR_CREDIT_DAYS), { ...pollOptions, retry: false });
}

const AMBER = "var(--data-amber)";
const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const calls = (v: number) => `${n(v)} ${v === 1 ? "call" : "calls"}`;

/** Per served UTC day: a strip cell (red = out of credit that day), then the refused (red) and rerouted (amber) calls on their own scale. */
function DayChart({ v, days }: { v: VendorCreditItem; days: VendorCreditDay[] }) {
  const showCalls = hasCalls(days);
  const max = Math.max(1, ...days.map((d) => d.refusedCalls + d.reroutedCalls));
  const first = days[0];
  const last = days[days.length - 1];
  return (
    <div>
      {showCalls && (
        <div className="mb-1 flex h-10 items-end gap-[2px]" role="img" aria-label={`${v.label}: refused and rerouted calls per day`}>
          {days.map((d) => (
            <span key={d.day} className="flex min-w-0 flex-1 flex-col-reverse" title={`${dayLabel(d.day)}: ${calls(d.refusedCalls)} refused, ${calls(d.reroutedCalls)} rerouted`}>
              {d.refusedCalls > 0 && <span className="rounded-[2px]" style={{ height: `${Math.max(3, (d.refusedCalls / max) * 40)}px`, background: RED }} />}
              {d.reroutedCalls > 0 && <span className="mb-[1px] rounded-[2px]" style={{ height: `${Math.max(3, (d.reroutedCalls / max) * 40)}px`, background: AMBER }} />}
            </span>
          ))}
        </div>
      )}
      <div className="flex h-2 gap-[2px]" role="img" aria-label={`${v.label}: out of credit per day`}>
        {days.map((d) => (
          <span
            key={d.day}
            className="min-w-0 flex-1 rounded-[2px]"
            title={`${dayLabel(d.day)}: ${d.outOfCredit ? "out of credit" : "had credit"}`}
            style={{ background: d.outOfCredit ? RED : "var(--data-track)" }}
          />
        ))}
      </div>
      <div className="k-fg3 mt-1.5 flex justify-between text-[11px] tabular-nums">
        <span>{first ? shortDay(first.day) : ""}</span>
        <span>{v.lastSeenAt ? `Last refusal ${utcTime(v.lastSeenAt)} UTC` : "Never refused"}</span>
        <span>{last ? shortDay(last.day) : ""}</span>
      </div>
    </div>
  );
}

/** One vendor: its name and verdict, where calls go while it is out, the served sentence, its days, the latest outage's counts. */
function VendorCard({ v, days }: { v: VendorCreditItem; days: VendorCreditDay[] }) {
  const red = v.outOfCredit;
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-[14px] font-medium" title={v.provider}>
          {v.label}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px]" style={{ color: red ? RED : undefined }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
          {red ? "Out of credit" : "Has credit"}
        </span>
      </div>
      <p className="k-fg3 mt-0.5 text-[12px]">{v.fallbackLabel ? `Backup model: ${v.fallbackLabel}` : "No backup model"}</p>
      <p className="mt-2 text-[13px]" style={{ color: red ? RED : undefined }}>
        {v.sentence ?? <span className="k-fg4">—</span>}
      </p>
      <div className="mt-auto pt-3">
        <DayChart v={v} days={days} />
      </div>
      {v.lastSeenAt && (
        <p className="k-fg3 k-line-subtle mt-3 truncate border-t pt-2 text-[12px] tabular-nums">
          Latest outage: {calls(v.refusedCalls)} refused, {calls(v.reroutedCalls)} rerouted
        </p>
      )}
    </div>
  );
}

export function VendorCreditView({ data }: { data: VendorCredit }) {
  const reds = outOfCreditVendors(data);
  const vendors = vendorsRedFirst(data);
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: reds.length ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {reds.length ? (
            reds.map((v) => (
              <p key={v.provider} className="text-[14px] font-medium">
                {v.sentence ?? `${v.label} is out of credit.`}
              </p>
            ))
          ) : (
            <p className="text-[14px] font-medium">Every AI vendor we call has credit.</p>
          )}
          <p className="k-fg3 mt-0.5 text-[12px]">A vendor turns red on its first call refused for lack of credit. It clears when a call on it succeeds.</p>
        </div>
      </div>

      <section>
        <SectionTitle count={vendors.length} right={<span>One bar per UTC day. Red = out of credit, amber = sent to the backup</span>}>
          AI vendors we call
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {vendors.map((v) => (
            <VendorCard key={v.provider} v={v} days={vendorDays(data, v.provider)} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function VendorCreditPage() {
  const q = useVendorCredit();
  if (q.isError && !q.data) return <Failed what="the AI vendors' credit" />;
  if (!q.data) return <Loading />;
  return <VendorCreditView data={q.data} />;
}

/** The hub's one-second read: how many AI vendors are out of credit, red when one is, which ones under it. */
export function VendorCreditTile({ href }: { href: string }) {
  const q = useVendorCredit();
  const data = q.data;
  const reds = data ? outOfCreditVendors(data) : [];
  return (
    <StatTile label="AI vendor credit" note={data ? `${data.vendors.length} vendors` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: reds.length ? RED : undefined }}>{reds.length ? `${reds.length} out of credit` : "All have credit"}</span>
          )
        }
        sub={data && reds.length ? reds.map((v) => v.label).join(", ") : undefined}
      />
    </StatTile>
  );
}
