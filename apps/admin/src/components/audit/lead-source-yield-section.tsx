"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getLeadSourceYield, type LeadSourceYield } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Section, num, utc } from "@/components/cold-email/primitives";
import { BlocklistDailyChart, type DailyPoint } from "@/components/audit/blocklist-daily-chart";

/**
 * Which lead source feeds our sending domains dead addresses and spam traps.
 *
 * Every figure is instantly-service's `LeadSourceYieldRead` (#1186): ranking and
 * one daily chart per measure, stacked by source. Counting rule `per_tag`: a
 * person found by several sources counts once under each, so the bars of a day
 * can add up to more than its total; the headline is the served `total`.
 */

const PALETTE = ["#4f46e5", "#e11d48", "#0891b2", "#d97706", "#059669", "#7c3aed", "#64748b", "#db2777"];
const PSEUDO_COLOR = "#cbd5e1";

function pct(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

/** Display name of a served source tag; the tag itself stays in the tooltip. */
export function sourceLabel(key: string): string {
  const bare = key.replace(/^sourcing-/, "").replace(/^list:/, "list ");
  return bare.charAt(0).toUpperCase() + bare.slice(1).replace(/[-_]/g, " ");
}

function seriesPoints(points: LeadSourceYield["series"]["firstEmails"], keys: string[]): DailyPoint[] {
  return points.map((p) => ({ day: p.day, ...Object.fromEntries(keys.map((k) => [k, p.byKey[k] ?? 0])) }));
}

const MEASURES = [
  { key: "firstEmails", title: "First emails, by source" },
  { key: "hardBounces", title: "Hard bounces, by source" },
  { key: "refusals", title: "Refused by the receiver, by source" },
  { key: "blocklistRefusals", title: "Refused because of a blocklist, by source" },
  { key: "firstEmailsFromListedDomains", title: "First emails from a listed domain, by source" },
] as const;

export function LeadSourceYieldSection({ days }: { days: number }) {
  const { data, isPending, isError, error } = useAuthQuery<LeadSourceYield>(
    ["leadSourceYield", days],
    () => getLeadSourceYield(days),
    pollOptionsSlower,
  );

  const pseudo = data ? new Set([data.pseudoKeys.noSourceRecorded, data.pseudoKeys.unknown]) : new Set<string>();
  const keys = data
    ? data.series.keys.map((k, i) => ({
        key: k,
        label: pseudo.has(k) ? k : sourceLabel(k),
        color: pseudo.has(k) ? PSEUDO_COLOR : PALETTE[i % PALETTE.length],
      }))
    : [];

  return (
    <Section
      title="Lead sources"
      blurb="Which source finds the people whose emails bounce or get refused. A person found by several sources counts once under each."
      isPending={isPending}
      isError={isError}
      error={error}
    >
      {data && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            {num(data.coverage.withSource)} of {num(data.coverage.firstEmails)} first emails have a known source;{" "}
            {num(data.coverage.noSourceRecorded)} with none recorded, {num(data.coverage.unknown)} not fetched yet. Sources copied{" "}
            {utc(data.provenanceSyncedAt)}. Refusals counted since {utc(data.refusalsMeasuredSince)}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 text-right font-medium">First emails</th>
                  <th className="py-2 pr-4 text-right font-medium">Hard bounce</th>
                  <th className="py-2 pr-4 text-right font-medium">Refused</th>
                  <th className="py-2 pr-4 text-right font-medium">Refused (blocklist)</th>
                  <th className="py-2 text-right font-medium">From a listed domain</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s) => (
                  <tr key={s.key} className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-gray-900" title={s.key}>
                      {s.kind === "source" ? sourceLabel(s.key) : <span className="text-gray-500">{s.key}</span>}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{num(s.firstEmails)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{pct(s.hardBounceRate)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{pct(s.refusalRate)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{num(s.blocklistRefusals)}</td>
                    <td className="py-2 text-right tabular-nums">{pct(s.listedDomainShare)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-2 pr-4 text-gray-900">All first emails</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{num(data.total.firstEmails)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{pct(data.total.hardBounceRate)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{pct(data.total.refusalRate)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{num(data.total.blocklistRefusals)}</td>
                  <td className="py-2 text-right tabular-nums">{pct(data.total.listedDomainShare)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MEASURES.map((m) => {
              const points = data.series[m.key];
              const last = points[points.length - 1];
              return (
                <BlocklistDailyChart
                  key={m.key}
                  title={m.title}
                  now={last ? num(last.total) : "—"}
                  data={seriesPoints(points, data.series.keys)}
                  keys={keys}
                />
              );
            })}
          </div>
        </div>
      )}
    </Section>
  );
}
