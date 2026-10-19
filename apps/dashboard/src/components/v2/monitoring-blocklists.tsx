"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getStaffDomainBlocklist,
  getStaffLeadSourceYield,
  recordStaffBlocklistRemovalRequest,
  runStaffDomainBlocklistCheck,
} from "@/lib/api";
import { SectionTitle } from "@/components/v2/ui";
import { CountChart, Dash, Failed, Loading, OK, RED, TD, TDR, TH, THR, Table, n, shortDay, useShowAll } from "@/components/v2/monitoring-sending";
import { entityPath } from "@/lib/monitoring/sending";
import {
  EVENT_WORD,
  blocklistCharts,
  ratePct,
  removalAttemptDetail,
  requestedLists,
  sortDomains,
  sortEvents,
  sourceLabel,
  yieldCharts,
  type BlocklistKey,
  type DomainBlocklist,
  type DomainBlocklistDomain,
  type DomainBlocklistEvent,
} from "@/lib/monitoring/blocklists";

/**
 * Monitoring > Emails > Blocklists (staff only), ported from the admin console's cold-email
 * Blocklists page. instantly-service checks every sending domain once a day on SURBL, Spamhaus
 * DBL and URIBL. A listed domain's mailboxes take no NEW sequence (follow-ups keep going) and
 * come back on their own once a fresh check reads the domain clean. SURBL's removal is filed by
 * instantly-service itself, at most once a week per domain; the other lists need a person, who
 * files the form from the link here, then records it ("I filed it").
 *
 * One chart per monitored sub-topic, each read straight off the served daily series (see
 * lib/monitoring/blocklists); a null day is "Not checked yet", no bar. Then the lead-source
 * yield read. This file draws, links and sorts for display; it computes no figure.
 */

const ONCE = { staleTime: 60_000, retry: false } as const;
const WINDOWS = [30, 60, 90] as const;
type Window = (typeof WINDOWS)[number];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

function Dot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {children}
    </span>
  );
}

function ListState({ state, since }: { state: "listed" | "clean" | "unknown"; since: string | null }) {
  if (state === "listed") return <Dot color={RED}>{since ? `Listed since ${shortDay(since)}` : "Listed"}</Dot>;
  if (state === "clean") return <Dot color={OK}>Clean</Dot>;
  return <Dot color="var(--fg-4)">Not checked</Dot>;
}

/** Per listed list: the form link, then who files it ("Filed by us, weekly", "Requested", or the "I filed it" button). */
function RemovalCell({ row, data }: { row: DomainBlocklistDomain; data: DomainBlocklist }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const listed = row.lists.filter((l) => l.state === "listed");
  if (listed.length === 0) return <Dash />;
  const requested = requestedLists(data, row.domain);
  return (
    <div className="flex flex-col items-start gap-1">
      {listed.map((l) => {
        const list = data.lists.find((x) => x.key === l.list);
        return (
          <div key={l.list} className="flex flex-wrap items-center gap-2 text-[12px]">
            {list && (
              <a href={list.removalUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                Open {list.name} form
              </a>
            )}
            {list?.removalAutomated ? (
              <span className="k-fg3">Filed by us, weekly</span>
            ) : requested.has(l.list) ? (
              <span className="k-fg3">Requested</span>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                className="k-btn h-6 px-2 text-[12px]"
                onClick={async () => {
                  setBusy(l.list);
                  setRefused(null);
                  try {
                    await recordStaffBlocklistRemovalRequest({ domain: row.domain, list: l.list as BlocklistKey });
                  } catch (err) {
                    console.error("[dashboard] recordStaffBlocklistRemovalRequest failed", { domain: row.domain, list: l.list, err });
                    setRefused("Not recorded. Try again.");
                    setBusy(null);
                    return;
                  }
                  await queryClient.refetchQueries({ queryKey: ["staffDomainBlocklist"] });
                  setBusy(null);
                }}
              >
                {busy === l.list ? "Saving…" : "I filed it"}
              </button>
            )}
          </div>
        );
      })}
      {refused && <span className="text-[12px]" style={{ color: RED }}>{refused}</span>}
    </div>
  );
}

/** What an automated removal attempt got back: the list's answer, or why it failed. */
function AttemptNote({ event }: { event: DomainBlocklistEvent }) {
  const d = removalAttemptDetail(event);
  if (!d) return null;
  const status = d.httpStatus !== null ? ` (code ${d.httpStatus})` : "";
  if (event.type === "removal_failed") {
    return (
      <span className="mt-0.5 block text-[12px]" style={{ color: RED }}>
        Sent by us. Why it failed: {d.error ?? d.answer ?? "the list gave no reason"}
        {status}
        {d.error && d.answer ? <span className="k-fg3 block">List answered: {d.answer}</span> : null}
      </span>
    );
  }
  return (
    <span className="k-fg3 mt-0.5 block text-[12px]">
      Sent by us{status}
      {d.answer ? `. List answered: ${d.answer}` : ""}
    </span>
  );
}

function History({ data, base }: { data: DomainBlocklist; base: string }) {
  const events = sortEvents(data.events);
  const { limit, footer } = useShowAll(events.length, 20);
  const listName = (k: string) => data.lists.find((l) => l.key === k)?.name ?? k;
  return (
    <section>
      <SectionTitle count={events.length} right={<span>Newest first</span>}>
        History
      </SectionTitle>
      <div className="k-card">
        {events.length === 0 ? (
          <p className="k-fg3 px-4 py-8 text-center text-[13px]">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--line-subtle)]">
            {events.slice(0, limit).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-[13px]">
                <span className="min-w-0">
                  <span className="font-medium">{EVENT_WORD[e.type]}</span>{" "}
                  <Link href={`${base}/${entityPath("domain", e.domain)}`} className="k-mono text-[12px] hover:underline">
                    {e.domain}
                  </Link>{" "}
                  <span className="k-fg3">on {listName(e.list)}</span>
                  <AttemptNote event={e} />
                  {e.type === "listed" && e.alert && (
                    <span className="k-fg3 ml-2 text-[12px]">
                      {e.alert.status === "sent" ? "Email sent to you" : `Email not sent yet (${n(e.alert.attempts)} tries)`}
                    </span>
                  )}
                </span>
                <span className="k-mono k-fg2 whitespace-nowrap text-[12px]">{when(e.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
        {footer}
      </div>
    </section>
  );
}

function Domains({ data, base }: { data: DomainBlocklist; base: string }) {
  const domains = sortDomains(data.domains);
  const { limit, footer } = useShowAll(domains.length);
  return (
    <section>
      <SectionTitle count={domains.length} right={<span>Listed first</span>}>
        Domains
      </SectionTitle>
      <p className="k-fg3 -mt-1 mb-3 text-[12px]">We file SURBL&apos;s form ourselves, once a week per domain. For the other lists, file the form, then press I filed it.</p>
      <Table
        head={
          <>
            <th className={TH}>Domain</th>
            {data.lists.map((l) => (
              <th key={l.key} className={TH}>
                {l.name}
              </th>
            ))}
            <th className={TH}>New prospects</th>
            <th className={THR}>Mailboxes</th>
            <th className={TH}>Removal</th>
          </>
        }
      >
        {domains.slice(0, limit).map((row) => (
          <tr key={row.domain} className="k-row align-top">
            <td className={`${TD} k-mono text-[12px]`}>
              <Link href={`${base}/${entityPath("domain", row.domain)}`} className="hover:underline">
                {row.domain}
              </Link>
            </td>
            {data.lists.map((l) => {
              const st = row.lists.find((x) => x.list === l.key);
              return (
                <td key={l.key} className={TD}>
                  {st ? <ListState state={st.state} since={st.listedSince} /> : <Dash />}
                </td>
              );
            })}
            <td className={TD}>{row.outOfNewSequences ? <Dot color="var(--data-amber)">Paused</Dot> : <Dot color={OK}>Open</Dot>}</td>
            <td className={TDR} title={row.mailboxes.join("\n")}>
              {n(row.mailboxes.length)}
            </td>
            <td className={TD}>
              <RemovalCell row={row} data={data} />
            </td>
          </tr>
        ))}
      </Table>
      {footer}
    </section>
  );
}

function LeadSourceYieldBlock({ days }: { days: Window }) {
  const q = useAuthQuery(["staffLeadSourceYield", days], () => getStaffLeadSourceYield(days), ONCE);
  const data = q.data;
  return (
    <section className="space-y-4">
      <div>
        <SectionTitle>Which lead source feeds us dead addresses and spam traps</SectionTitle>
        <p className="k-fg3 -mt-1 text-[12px]">
          The source that found the people whose emails bounce or get refused. A person found by several sources counts once under each, so a
          day&apos;s bars can add up to more than its total.
        </p>
      </div>
      {q.isError ? (
        <Failed what="the lead sources" />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <p className="k-fg3 text-[12px]">
            {n(data.coverage.withSource)} of {n(data.coverage.firstEmails)} first emails have a known source. {n(data.coverage.noSourceRecorded)}{" "}
            have none recorded, {n(data.coverage.unknown)} are not fetched yet.
            {data.provenanceSyncedAt ? ` Sources copied ${when(data.provenanceSyncedAt)} UTC.` : ""}
            {data.refusalsMeasuredSince ? ` Refusals counted since ${shortDay(data.refusalsMeasuredSince)}.` : ""}
          </p>
          <Table
            head={
              <>
                <th className={TH}>Source</th>
                <th className={THR}>First emails</th>
                <th className={THR}>Hard bounce</th>
                <th className={THR}>Refused</th>
                <th className={THR}>Refused, blocklist</th>
                <th className={THR}>From a listed domain</th>
              </>
            }
          >
            {data.sources.map((s) => (
              <tr key={s.key} className="k-row">
                <td className={TD} title={s.key}>
                  {s.kind === "source" ? sourceLabel(s.key) : <span className="k-fg3">{s.key}</span>}
                </td>
                <td className={TDR}>{n(s.firstEmails)}</td>
                <td className={TDR}>{ratePct(s.hardBounceRate) ?? <Dash />}</td>
                <td className={TDR}>{ratePct(s.refusalRate) ?? <Dash />}</td>
                <td className={TDR}>{n(s.blocklistRefusals)}</td>
                <td className={TDR}>{ratePct(s.listedDomainShare) ?? <Dash />}</td>
              </tr>
            ))}
            <tr className="k-row font-medium">
              <td className={TD}>All first emails</td>
              <td className={TDR}>{n(data.total.firstEmails)}</td>
              <td className={TDR}>{ratePct(data.total.hardBounceRate) ?? <Dash />}</td>
              <td className={TDR}>{ratePct(data.total.refusalRate) ?? <Dash />}</td>
              <td className={TDR}>{n(data.total.blocklistRefusals)}</td>
              <td className={TDR}>{ratePct(data.total.listedDomainShare) ?? <Dash />}</td>
            </tr>
          </Table>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {yieldCharts(data).map((c) => (
              <CountChart key={c.id} title={c.title} note={c.note} now={c.now} legend={c.legend} series={c.series} emptyLabel="nothing sent" />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function BlocklistsPage({ base }: { base: string }) {
  const [days, setDays] = useState<Window>(60);
  const [checking, setChecking] = useState(false);
  const [checkRefused, setCheckRefused] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const q = useAuthQuery(["staffDomainBlocklist", days], () => getStaffDomainBlocklist(days), ONCE);
  const data = q.data;

  const checkNow = async () => {
    setChecking(true);
    setCheckRefused(null);
    try {
      await runStaffDomainBlocklistCheck();
    } catch (err) {
      console.error("[dashboard] runStaffDomainBlocklistCheck failed", { err });
      setCheckRefused("The check did not run. Try again in a minute.");
      setChecking(false);
      return;
    }
    await queryClient.refetchQueries({ queryKey: ["staffDomainBlocklist"] });
    setChecking(false);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="k-fg2 text-[13px]">Every sending domain, checked daily on SURBL, Spamhaus DBL and URIBL. A listed domain takes no new prospects.</p>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5" role="group" aria-label="Window">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={days === w}
                  onClick={() => setDays(w)}
                  className={days === w ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}
                >
                  {w} days
                </button>
              ))}
            </span>
            <button type="button" disabled={checking} onClick={checkNow} className="k-btn h-7 px-2 text-[12px]">
              {checking ? "Checking…" : "Check now"}
            </button>
          </span>
        </div>
        {checkRefused && (
          <p className="text-[12px]" style={{ color: RED }}>
            {checkRefused}
          </p>
        )}
        {data && (
          <p className="k-fg3 text-[12px]">
            {data.monitoredSince
              ? `Monitored since ${shortDay(data.monitoredSince)}. Days before that show no bar: nobody looked yet.`
              : "Not checked yet."}
          </p>
        )}
      </div>

      {q.isError ? (
        <Failed what="the blocklists" />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {blocklistCharts(data).map((c) => (
              <CountChart key={c.id} title={c.title} note={c.note} now={c.now} legend={c.legend} series={c.series} emptyLabel="not checked yet" />
            ))}
          </div>
          <Domains data={data} base={base} />
          <History data={data} base={base} />
        </>
      )}

      <LeadSourceYieldBlock days={days} />
    </div>
  );
}
