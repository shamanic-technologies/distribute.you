"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getLeadConsolidatedStatus, listLeadsPage, type Lead } from "@/lib/api";
import { leadStatusLabel } from "@/lib/lead-status";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { friendlyDate, friendlyTime } from "@/lib/friendly-datetime";
import { leadsSearchParam } from "@/lib/leads-server-page";
import { v2Href } from "@/lib/v2/routes";
import { MaturityBadge } from "@/components/maturity-badge";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { brandLeadScopeKey, useBrandRevenue } from "@/components/v2/data";
import { CompanyMark, PersonAvatar, leadName, leadTitle, personHref } from "@/components/v2/people-bits";
import { EmptyNote, SectionTitle, Shimmer, TopBar } from "@/components/v2/ui";
import { HIDDEN_TAGS, TAG_LABEL, companyHref, companyKey, companyStage } from "@/components/v2/companies-page";

/** The steps a company moves through, in order, in features-service's own tags. */
const FLOW: { tag: string; label: string }[] = [
  { tag: "contacted", label: "Contacted" },
  { tag: "visit", label: "Visited" },
  { tag: "reply", label: "Interested" },
  { tag: "meeting", label: "Meeting" },
  { tag: "closeWin", label: "Won" },
];

interface TimelineEntry {
  at: string;
  lead: Lead;
  what: string;
  mission: Mission | null;
  /** Keel splits a record's timeline by who acted: the crew, or the people. */
  by: "crew" | "people";
}

/**
 * One company (beta): Keel's record page. The header and the stage come off the
 * organisation features-service values on the brand's revenue read; the people are
 * lead-service's own search on the company name; the timeline is each person's own
 * first-occurrence timestamps as lead-service serves them. Nothing is derived.
 */
export function CompanyPage() {
  const { orgId, brandId, companyKey: rawKey } = useParams<{ orgId: string; brandId: string; companyKey: string }>();
  const key = decodeURIComponent(rawKey);
  const router = useRouter();
  const revenue = useBrandRevenue(brandId);
  const { missionByCampaignId } = useMissions(orgId, brandId);
  const sorted = useMemo(
    () => [...(revenue.data?.organizations ?? [])].sort((a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd),
    [revenue.data],
  );
  const index = sorted.findIndex((o) => companyKey(o) === key);
  const org = index >= 0 ? sorted[index] : null;
  const name = org?.orgName ?? org?.orgDomain ?? key;
  const q = org?.orgName ? leadsSearchParam(org.orgName) ?? "" : "";
  const peopleQ = useAuthQuery(
    ["leadsPage", brandLeadScopeKey(brandId), "v2-company", q],
    () => listLeadsPage({ brandId }, { view: "basic", sort: "activity", limit: "50", q }, undefined, { includeCampaigns: false }),
    { enabled: !!q, refetchInterval: POLL_INTERVAL },
  );
  // lead-service searches names and companies; keep the people who work HERE.
  const people = useMemo(
    () =>
      (peopleQ.data?.leads ?? []).filter((l) => {
        const o = l.lead?.organization;
        if (!o) return false;
        const sameDomain = !!org?.orgDomain && o.primaryDomain === org.orgDomain;
        const sameName = !!org?.orgName && (o.name ?? "").toLowerCase() === org.orgName.toLowerCase();
        return sameDomain || sameName;
      }),
    [peopleQ.data, org],
  );

  const timeline = useMemo(() => {
    const out: TimelineEntry[] = [];
    for (const l of people) {
      const m = missionByCampaignId.get(l.campaignId) ?? null;
      const n = leadName(l);
      if (l.firstRepliedAt) out.push({ at: l.firstRepliedAt, lead: l, what: `${n} replied`, mission: m, by: "people" });
      if (l.firstClickedAt) out.push({ at: l.firstClickedAt, lead: l, what: `${n} visited your website`, mission: m, by: "people" });
      if (l.firstDeliveredAt) out.push({ at: l.firstDeliveredAt, lead: l, what: `First email delivered to ${n}`, mission: m, by: "crew" });
      else if (l.firstSentAt) out.push({ at: l.firstSentAt, lead: l, what: `First email sent to ${n}`, mission: m, by: "crew" });
      if (l.firstBouncedAt) out.push({ at: l.firstBouncedAt, lead: l, what: `The email to ${n} bounced`, mission: m, by: "crew" });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [people, missionByCampaignId]);

  const prev = index > 0 ? companyHref(orgId, brandId, sorted[index - 1]) : null;
  const next = index >= 0 && index < sorted.length - 1 ? companyHref(orgId, brandId, sorted[index + 1]) : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "k" && prev) router.push(prev);
      if (e.key === "j" && next) router.push(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  const stage = org ? companyStage(org) : null;
  const reachedIndex = stage ? FLOW.findIndex((f) => f.tag === stage || (stage === "meetingAttended" && f.tag === "meeting")) : -1;
  const person = org?.topPerson ? `${org.topPerson.firstName ?? ""} ${org.topPerson.lastName ?? ""}`.trim() : "";

  const [tlFilter, setTlFilter] = useState<"all" | "crew" | "people">("all");
  const [copied, setCopied] = useState(false);
  // The company's own facts, off the organisation lead-service stores on its people.
  const facts = useMemo(() => people.find((l) => l.lead?.organization)?.lead?.organization ?? null, [people]);
  const groups = useMemo(() => {
    const byDay = new Map<string, TimelineEntry[]>();
    for (const e of timeline.filter((x) => tlFilter === "all" || x.by === tlFilter)) {
      const d = friendlyDate(e.at);
      byDay.set(d, [...(byDay.get(d) ?? []), e]);
    }
    return [...byDay.entries()];
  }, [timeline, tlFilter]);

  return (
    <>
      <TopBar
        crumbs={[
          { label: "Records" },
          { label: "Companies", href: v2Href(orgId, brandId, "companies") },
          {
            label: (
              <span className="inline-flex items-center gap-1.5">
                <CompanyMark name={name} domain={org?.orgDomain ?? null} size={16} />
                {name}
              </span>
            ),
          },
        ]}
        actions={
          <>
            {index >= 0 && (
              <span className="k-fg3 mr-1 hidden items-center gap-1 text-[12px] tabular-nums md:inline-flex">
                {index + 1} of {sorted.length}
                <Link aria-label="Previous company" href={prev ?? "#"} aria-disabled={!prev} className={`k-btn-ghost h-7 w-7 justify-center px-0 ${prev ? "" : "pointer-events-none opacity-40"}`}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 7.5 6 4.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                </Link>
                <Link aria-label="Next company" href={next ?? "#"} aria-disabled={!next} className={`k-btn-ghost h-7 w-7 justify-center px-0 ${next ? "" : "pointer-events-none opacity-40"}`}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                </Link>
              </span>
            )}
            <MaturityBadge level="beta" />
          </>
        }
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        {revenue.pending ? (
          <Shimmer className="h-40 rounded-xl" />
        ) : !org ? (
          <div className="k-card"><EmptyNote>We could not find this company among the ones that engaged.</EmptyNote></div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <CompanyMark name={name} domain={org.orgDomain ?? null} size={48} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-[22px] font-medium tracking-[-0.02em]">{name}</h1>
                    {stage && <span className="k-chip">{TAG_LABEL[stage] ?? stage}</span>}
                  </div>
                  <p className="k-fg2 mt-0.5 text-[13px]">
                    {[
                      org.orgDomain ? (
                        <a key="d" href={`https://${org.orgDomain}`} target="_blank" rel="noreferrer" className="k-mono hover:underline">{org.orgDomain}</a>
                      ) : null,
                      facts?.industry ? <span key="i">{facts.industry.charAt(0).toUpperCase() + facts.industry.slice(1)}</span> : null,
                      facts?.estimatedNumEmployees ? <span key="e">{formatCount(facts.estimatedNumEmployees)} people</span> : null,
                      facts?.city || facts?.country ? <span key="l">{[facts.city, facts.state, facts.country].filter(Boolean).join(", ")}</span> : null,
                    ]
                      .filter(Boolean)
                      .map((n, i) => (
                        <span key={i}>
                          {i > 0 ? " · " : ""}
                          {n}
                        </span>
                      ))}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {person ? (
                  <span className="k-btn h-7 cursor-default gap-1.5 text-[12px]">
                    {org.topPerson?.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.topPerson.photoUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                    ) : null}
                    <span className="k-fg3">Best contact</span>
                    <span>{person}</span>
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label="Copy link"
                  title={copied ? "Copied" : "Copy link"}
                  onClick={() => {
                    void navigator.clipboard.writeText(window.location.href).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                  className="k-btn h-7 w-7 justify-center px-0"
                >
                  {copied ? (
                    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5l6-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1a2.5 2.5 0 0 1-3.5-3.5l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                  )}
                </button>
              </div>
            </div>

            <div className="k-card mt-5 overflow-hidden">
              <div className="grid grid-cols-1 divide-y divide-[var(--line-subtle)] md:grid-cols-[2.2fr_1fr_1fr_1fr] md:divide-x md:divide-y-0">
                <div className="p-4">
                  <p className="k-label">Stage</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[13px] xl:flex-nowrap">
                    {FLOW.map((f, i) => (
                      <span key={f.tag} className="flex items-center gap-1.5">
                        {i > 0 && <span className="h-px w-2.5 bg-[var(--line-strong)]" />}
                        <span
                          className={
                            i === reachedIndex
                              ? "rounded-[6px] bg-[var(--bg-strong)] px-2 py-0.5 text-[#fafafa]"
                              : i < reachedIndex
                                ? "k-fg2 px-1"
                                : "k-fg4 px-1"
                          }
                        >
                          {f.label}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <p className="k-label">Expected value</p>
                  <p className="mt-2 text-[22px] font-medium leading-7 tabular-nums">{formatUsdAdaptive(org.expectedRevenueUsd)}</p>
                </div>
                <div className="p-4">
                  <p className="k-label">People</p>
                  <p className="mt-2 text-[22px] font-medium leading-7 tabular-nums">{peopleQ.data ? formatCount(people.length) : "–"}</p>
                </div>
                <div className="p-4">
                  <p className="k-label">Last touch</p>
                  <p className="mt-2 text-[22px] font-medium leading-7">{org.mostAdvancedDate ? friendlyDate(org.mostAdvancedDate) : "—"}</p>
                </div>
              </div>
              <div className="k-fg2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[13px]">
                <span className="k-label">Signals</span>
                {org.tags.filter((t) => !HIDDEN_TAGS.has(t)).map((t) => (
                  <span key={t}>{TAG_LABEL[t] ?? t}</span>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <SectionTitle
                  count={peopleQ.data ? timeline.length : null}
                  right={
                    peopleQ.data ? (
                      <span className="k-inset inline-flex rounded-[9px] p-0.5 shadow-[inset_0_0_0_1px_var(--line-subtle)]">
                        {(["all", "crew", "people"] as const).map((f) => {
                          const n = f === "all" ? timeline.length : timeline.filter((x) => x.by === f).length;
                          return (
                            <button
                              key={f}
                              type="button"
                              aria-pressed={tlFilter === f}
                              onClick={() => setTlFilter(f)}
                              className={tlFilter === f ? "k-btn h-6 px-2 text-[12px]" : "k-btn-ghost h-6 px-2 text-[12px]"}
                            >
                              {f === "all" ? "All" : f === "crew" ? "Crew" : "People"} <span className="k-fg3 tabular-nums">{n}</span>
                            </button>
                          );
                        })}
                      </span>
                    ) : null
                  }
                >
                  Timeline
                </SectionTitle>
                {!peopleQ.data ? (
                  peopleQ.isError ? <EmptyNote>We could not load this company&apos;s people.</EmptyNote> : <Shimmer className="h-40 rounded-xl" />
                ) : timeline.length === 0 ? (
                  <div className="k-card"><EmptyNote>Nothing has happened with this company yet.</EmptyNote></div>
                ) : (
                  <div className="space-y-5">
                    {groups.map(([day, entries]) => (
                      <div key={day}>
                        <p className="k-fg3 border-b border-[var(--line-subtle)] pb-1.5 text-[12px]">{day}</p>
                        <ol className="mt-2 space-y-3">
                          {entries.map((e, i) => (
                            <li key={`${e.lead.id}-${i}`} className="flex gap-3">
                              <span className="mt-0.5">
                                {e.mission ? <CrewMark color={e.mission.crew.color} glyph={e.mission.crew.glyph} size={20} /> : <PersonAvatar lead={e.lead} size={20} />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px]">
                                  {e.mission ? <span className="font-medium">{e.mission.crew.name} </span> : null}
                                  <span className={e.mission ? "k-fg2" : ""}>{e.mission ? "· " : ""}{e.what}</span>
                                </p>
                                {e.mission?.offerName ? <p className="k-fg3 text-[12px]">{e.mission.offerName}</p> : null}
                              </div>
                              <span className="k-mono k-fg3 shrink-0 text-[11px]">{friendlyTime(e.at)}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {facts?.shortDescription ? (
                  <div className="k-card p-4">
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium">
                        <CompanyMark name={name} domain={org.orgDomain ?? null} size={16} />
                        Brief
                      </p>
                      <p className="k-fg3 text-[12px]">from their company profile</p>
                    </div>
                    <p className="k-fg2 whitespace-pre-line text-[13px] leading-[20px]">{facts.shortDescription}</p>
                    {facts.foundedYear || facts.annualRevenue ? (
                      <dl className="mt-3 space-y-1.5 border-t border-[var(--line-subtle)] pt-3 text-[12px]">
                        {facts.foundedYear ? (
                          <div className="flex justify-between gap-3"><dt className="k-fg3">Founded</dt><dd className="tabular-nums">{facts.foundedYear}</dd></div>
                        ) : null}
                        {facts.annualRevenue ? (
                          <div className="flex justify-between gap-3"><dt className="k-fg3">Revenue</dt><dd className="truncate">{facts.annualRevenue}</dd></div>
                        ) : null}
                      </dl>
                    ) : null}
                  </div>
                ) : null}
                <div className="k-card p-4">
                  <SectionTitle count={peopleQ.data ? people.length : null}>People</SectionTitle>
                  {!peopleQ.data ? (
                    <Shimmer className="h-24" />
                  ) : people.length === 0 ? (
                    <p className="k-fg3 text-[13px]">No one here is in your people yet.</p>
                  ) : (
                    <ul className="-mx-2">
                      {people.map((l) => {
                        const m = missionByCampaignId.get(l.campaignId) ?? null;
                        return (
                          <li key={l.id}>
                            <Link href={personHref(orgId, brandId, l)} className="k-hover flex items-center gap-2.5 rounded-[8px] px-2 py-1.5">
                              <PersonAvatar lead={l} size={24} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium">{leadName(l)}</span>
                                <span className="k-fg3 block truncate text-[12px]">{leadTitle(l) ?? "—"}</span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-0.5">
                                <span className="k-chip">{leadStatusLabel(getLeadConsolidatedStatus(l))}</span>
                                {m ? (
                                  <span className="k-fg3 inline-flex items-center gap-1 text-[11px]">
                                    <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={12} /> {m.crew.name}
                                  </span>
                                ) : null}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="k-card p-4">
                  <p className="k-label mb-2">Details</p>
                  <dl className="space-y-2 text-[13px]">
                    <div className="flex justify-between gap-3"><dt className="k-fg2">Domain</dt><dd className="truncate">{org.orgDomain ?? "—"}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="k-fg2">Best contact</dt><dd className="truncate">{person || "—"}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="k-fg2">Expected value</dt><dd className="tabular-nums">{formatUsdAdaptive(org.expectedRevenueUsd)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="k-fg2">Rank</dt><dd className="tabular-nums">{index + 1} of {sorted.length}</dd></div>
                  </dl>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
