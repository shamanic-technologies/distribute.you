"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getDomainBlocklist,
  recordDomainBlocklistRemovalRequest,
  runDomainBlocklistCheck,
  type BlocklistKey,
  type DomainBlocklist,
  type DomainBlocklistDomain,
  type DomainBlocklistEvent,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { PageHeader, Section, num, utc, utcDay } from "@/components/cold-email/primitives";
import { BlocklistDailyChart, type DailyPoint } from "@/components/audit/blocklist-daily-chart";

/**
 * Cold email — Blocklists.
 *
 * instantly-service checks every sending domain once a day on SURBL, Spamhaus
 * DBL and URIBL. A listed domain's mailboxes take no NEW sequence (follow-ups
 * keep going out) and come back on their own once a fresh check reads the
 * domain clean. Removal forms need a person: the owner files them from the
 * link here, then records the request.
 *
 * One chart per monitored sub-topic (owner rule 2026-10-16), each read straight
 * off the served daily series; the page computes no figure.
 */

const WINDOWS = [30, 60, 90] as const;

const LIST_COLORS: Record<string, string> = {
  surbl: "#e11d48",
  spamhaus_dbl: "#7c3aed",
  spamhaus: "#7c3aed",
  uribl: "#0891b2",
  other_list: "#9ca3af",
};

const EVENT_LABEL: Record<DomainBlocklistEvent["type"], string> = {
  listed: "Listed",
  delisted: "Removed from the list",
  removal_link_issued: "Removal link sent to you",
  removal_requested: "Removal requested",
};

function lastValue(points: Array<Record<string, unknown>>, key: string): string {
  const last = points[points.length - 1];
  const v = last ? last[key] : null;
  return typeof v === "number" ? num(v) : "—";
}

function charts(data: DomainBlocklist, listName: (k: string) => string) {
  const s = data.series;
  const listKeys = data.lists.map((l) => ({ key: l.key, label: l.name, color: LIST_COLORS[l.key] ?? "#9ca3af" }));
  const domainsListed: DailyPoint[] = s.domainsListed.map((p) => ({
    day: p.day,
    ...Object.fromEntries(listKeys.map((k) => [k.key, p.byList ? (p.byList[k.key] ?? 0) : null])),
  }));
  const bounces: DailyPoint[] = s.blocklistBounces.map((p) => ({ day: p.day, ...p.byList }));
  return [
    {
      title: "Domains listed",
      now: lastValue(s.domainsListed, "total"),
      data: domainsListed,
      keys: listKeys,
    },
    {
      title: "Mailboxes out of new sequences",
      now: lastValue(s.mailboxesOutOfNewSequences, "mailboxes"),
      data: s.mailboxesOutOfNewSequences as DailyPoint[],
      keys: [{ key: "mailboxes", label: "Mailboxes", color: "#d97706" }],
    },
    {
      title: "Emails sent from a listed domain",
      now: lastValue(s.sendsFromListedDomains, "sends"),
      data: s.sendsFromListedDomains as DailyPoint[],
      keys: [{ key: "sends", label: "Emails (follow-ups)", color: "#64748b" }],
    },
    {
      title: "Emails refused because of a blocklist",
      now: lastValue(s.blocklistBounces, "total"),
      data: bounces,
      keys: [
        { key: "surbl", label: listName("surbl"), color: LIST_COLORS.surbl },
        { key: "spamhaus", label: listName("spamhaus_dbl"), color: LIST_COLORS.spamhaus },
        { key: "uribl", label: listName("uribl"), color: LIST_COLORS.uribl },
        { key: "other_list", label: "Other list", color: LIST_COLORS.other_list },
      ],
    },
    {
      title: "Removal links and requests",
      now: lastValue(s.removalRequests, "requested"),
      data: s.removalRequests as DailyPoint[],
      keys: [
        { key: "linksIssued", label: "Links sent to you", color: "#94a3b8" },
        { key: "requested", label: "Requests filed", color: "#4f46e5" },
      ],
    },
    {
      title: "Domains removed from a list",
      now: lastValue(s.delistings, "delistings"),
      data: s.delistings as DailyPoint[],
      keys: [{ key: "delistings", label: "Removed", color: "#059669" }],
    },
  ];
}

function StateBadge({ state, since }: { state: "listed" | "clean" | "unknown"; since: string | null }) {
  if (state === "listed") {
    return (
      <span className="inline-block rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800" title={since ? `Since ${utc(since)}` : undefined}>
        Listed{since ? ` since ${utcDay(since)}` : ""}
      </span>
    );
  }
  if (state === "clean") {
    return <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Clean</span>;
  }
  return (
    <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500" title="This list has not answered us for this domain yet.">
      Not checked
    </span>
  );
}

function RemovalCell({
  row,
  data,
  onRecorded,
}: {
  row: DomainBlocklistDomain;
  data: DomainBlocklist;
  onRecorded: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const listed = row.lists.filter((l) => l.state === "listed");
  if (listed.length === 0) return <span className="text-gray-400">—</span>;
  const requested = new Set(
    data.events.filter((e) => e.domain === row.domain && e.type === "removal_requested").map((e) => e.list),
  );
  return (
    <div className="flex flex-col items-start gap-1">
      {listed.map((l) => {
        const list = data.lists.find((x) => x.key === l.list);
        return (
          <div key={l.list} className="flex items-center gap-2 text-xs">
            {list && (
              <a href={list.removalUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                Open {list.name} form
              </a>
            )}
            {requested.has(l.list) ? (
              <span className="text-gray-500">Requested</span>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(l.list);
                  setFailed(null);
                  try {
                    await recordDomainBlocklistRemovalRequest({ domain: row.domain, list: l.list as BlocklistKey });
                    onRecorded();
                  } catch (err) {
                    console.error("[admin] recordDomainBlocklistRemovalRequest failed", { domain: row.domain, list: l.list, err });
                    setFailed(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy(null);
                  }
                }}
                className="rounded-md border border-gray-200 px-2 py-0.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === l.list ? "Saving…" : "I filed it"}
              </button>
            )}
          </div>
        );
      })}
      {failed && <span className="text-xs text-red-600">{failed}</span>}
    </div>
  );
}

export default function BlocklistsPage() {
  const [days, setDays] = useState<number>(60);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useAuthQuery<DomainBlocklist>(
    ["domainBlocklist", days],
    () => getDomainBlocklist(days),
    pollOptionsSlower,
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["domainBlocklist"] });
  const listName = (k: string) => data?.lists.find((l) => l.key === k)?.name ?? k;

  const domains = data ? [...data.domains].sort((a, b) => Number(b.listed) - Number(a.listed) || a.domain.localeCompare(b.domain)) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Blocklists"
          blurb="Every sending domain, checked daily on SURBL, Spamhaus DBL and URIBL. A listed domain takes no new prospects; its follow-ups keep going out. It comes back by itself once the list removes it."
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  days === w ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              setCheckError(null);
              try {
                await runDomainBlocklistCheck();
                await refresh();
              } catch (err) {
                console.error("[admin] runDomainBlocklistCheck failed", { err });
                setCheckError(err instanceof Error ? err.message : String(err));
              } finally {
                setChecking(false);
              }
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check now"}
          </button>
        </div>
      </div>
      {checkError && <p className="text-sm text-red-600">Check failed: {checkError}</p>}

      {isError ? (
        <Section title="Blocklists" isError error={error} />
      ) : isPending || !data ? (
        <Section title="Blocklists" isPending />
      ) : (
        <>
          <p className="text-xs text-gray-500">
            Monitored since {utc(data.monitoredSince)}. Days before that show no bar: nobody looked yet.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {charts(data, listName).map((c) => (
              <BlocklistDailyChart key={c.title} title={c.title} now={c.now} data={c.data} keys={c.keys} />
            ))}
          </div>

          <Section title="Domains" blurb="Listed domains first. Open the list's form, file the request, then press &ldquo;I filed it&rdquo; so the request is on record.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="py-2 pr-4 font-medium">Domain</th>
                    {data.lists.map((l) => (
                      <th key={l.key} className="py-2 pr-4 font-medium">
                        {l.name}
                      </th>
                    ))}
                    <th className="py-2 pr-4 font-medium">New prospects</th>
                    <th className="py-2 pr-4 font-medium">Mailboxes</th>
                    <th className="py-2 font-medium">Removal</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((row) => (
                    <tr key={row.domain} className="border-b border-gray-50 align-top">
                      <td className="py-2 pr-4 font-medium text-gray-900">{row.domain}</td>
                      {data.lists.map((l) => {
                        const st = row.lists.find((x) => x.list === l.key);
                        return (
                          <td key={l.key} className="py-2 pr-4">
                            {st ? <StateBadge state={st.state} since={st.listedSince} /> : <span className="text-gray-400">—</span>}
                          </td>
                        );
                      })}
                      <td className="py-2 pr-4">
                        {row.outOfNewSequences ? (
                          <span className="text-xs font-medium text-amber-700">Paused</span>
                        ) : (
                          <span className="text-xs text-gray-500">Open</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-600" title={row.mailboxes.join("\n")}>
                        {num(row.mailboxes.length)}
                      </td>
                      <td className="py-2">
                        <RemovalCell row={row} data={data} onRecorded={refresh} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="History" blurb="Every listing, removal and request, newest first." empty={data.events.length === 0 ? "Nothing recorded yet." : null}>
            <ul className="divide-y divide-gray-50">
              {data.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium text-gray-900">{EVENT_LABEL[e.type]}</span>{" "}
                    <span className="text-gray-700">{e.domain}</span>{" "}
                    <span className="text-gray-500">on {listName(e.list)}</span>
                    {e.type === "listed" && e.alert && (
                      <span className="ml-2 text-xs text-gray-400">
                        {e.alert.status === "sent" ? "Email sent to you" : `Email pending (${e.alert.attempts} tries)`}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-500">{utc(e.occurredAt)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
