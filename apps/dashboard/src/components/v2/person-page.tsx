"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getLeadDetail, getLeadHistory, getLeadConsolidatedStatus, leadDateForStatus, type Lead } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { friendlyDate, timeAgo } from "@/lib/friendly-datetime";
import { leadWentCold, wentColdReason, WENT_COLD_LABEL } from "@/lib/lead-cold";
import { useSetAnyLeadStepStatement } from "@/lib/use-lead-step-statements";
import { v2Href } from "@/lib/v2/routes";
import { MaturityBadge } from "@/components/maturity-badge";
import { LeadHistoryTimeline } from "@/components/audiences/lead-history-timeline";
import { CrmAttributionCard } from "@/components/crm/crm-attribution-card";
import { CloseWonForm } from "@/components/leads/close-won-form";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions } from "@/components/v2/use-missions";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, leadTitle } from "@/components/v2/people-bits";

/** Where a person stands, in the words the v2 pages use. lead-service decides it. */
const STANDING_LABEL: Record<string, string> = {
  unresolved: "Not placed",
  not_contacted: "Not contacted",
  contacted: "Contacted",
  engaged: "Engaged",
  sales_interest: "Interested",
  customer: "Won",
  opted_out: "Opted out",
  disqualified: "Disqualified",
};

function standingState(lead: Lead): string | null {
  const s = (lead as unknown as { standing?: { state?: unknown } }).standing;
  return typeof s?.state === "string" ? s.state : null;
}

/**
 * One person (beta), laid out as Keel lays out one record: who they are on top, what
 * happened with them in the main column (lead-service's own ordered history: every
 * message both ways, every delivery fact), and the facts beside it.
 *
 * Every value is served. The history is the same read, on the same key, the v1 lead
 * panel makes, and the win is stated through the same form and the same write the v1
 * board uses, so a person reads and moves the same way in both.
 */
export function PersonPage() {
  const { orgId, brandId, leadRowId } = useParams<{ orgId: string; brandId: string; leadRowId: string }>();
  const { missionByCampaignId } = useMissions(orgId, brandId);
  const leadQ = useAuthQuery(["leadDetail", leadRowId, brandId], () => getLeadDetail(leadRowId, brandId), pollOptions);
  const historyQ = useAuthQuery(
    ["leadHistory", leadRowId, brandId, "campaign"],
    () => getLeadHistory(leadRowId, { brandId, scope: "campaign" }),
    { enabled: Boolean(leadRowId) },
  );
  const [closing, setClosing] = useState(false);
  const setStep = useSetAnyLeadStepStatement();

  const lead = leadQ.data ?? null;
  const name = lead ? leadName(lead) : "";
  const company = lead ? leadCompany(lead) : null;
  const domain = lead ? leadCompanyDomain(lead) : null;
  const title = lead ? leadTitle(lead) : null;
  const mission = lead ? missionByCampaignId.get(lead.campaignId) ?? null : null;
  const state = lead ? standingState(lead) : null;
  const cold = lead ? leadWentCold((lead as unknown as { standing?: unknown }).standing) : null;
  const lastAt = lead ? leadDateForStatus(lead, getLeadConsolidatedStatus(lead)) : null;
  const linkedin = lead?.lead?.linkedinUrl ?? null;

  return (
    <>
      <TopBar
        crumbs={[{ label: "People", href: v2Href(orgId, brandId, "people") }, { label: name || " " }]}
        actions={<MaturityBadge level="beta" />}
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        {leadQ.isError ? (
          <div className="k-card">
            <EmptyNote>We could not read this person right now.</EmptyNote>
          </div>
        ) : !lead ? (
          <Shimmer className="h-20 w-full rounded-xl" />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar lead={lead} size={48} />
                <div className="min-w-0">
                  <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{name}</h1>
                  <p className="k-fg2 mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px]">
                    {company ? <CompanyMark name={company} domain={domain} size={16} /> : null}
                    <span className="truncate">{[title, company].filter(Boolean).join(" at ") || lead.email}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {state ? <span className="k-chip">{STANDING_LABEL[state] ?? state}</span> : null}
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="k-btn">
                    Email
                  </a>
                ) : null}
                {state !== "customer" ? (
                  <button type="button" className="k-btn-strong" onClick={() => setClosing((v) => !v)} aria-expanded={closing}>
                    Mark as won
                  </button>
                ) : null}
              </div>
            </div>

            {closing ? (
              <div className="k-card mt-4 flex flex-col items-end gap-2 p-4">
                <p className="k-fg2 self-start text-[13px]">Record the sale: whose win it was, what it cost and what it was worth.</p>
                <CloseWonForm
                  prefillUsd={null}
                  busy={setStep.isPending}
                  onCancel={() => setClosing(false)}
                  onSubmit={(input) =>
                    setStep.mutate(
                      { leadRowId, step: "sale", kind: "outcome", ...input },
                      { onSuccess: () => setClosing(false) },
                    )
                  }
                />
                {setStep.isError ? <p className="text-[12px] text-[var(--data-rose)]">We could not record this sale. Try again.</p> : null}
              </div>
            ) : null}

            {cold ? (
              <div className="k-card mt-4 p-4">
                <p className="text-[13px] font-medium">{WENT_COLD_LABEL}</p>
                <p className="k-fg2 mt-0.5 text-[13px]">{wentColdReason(cold)}</p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                {historyQ.data ? (
                  <LeadHistoryTimeline history={historyQ.data} heading="Conversation and activity" showNextFollowup />
                ) : (
                  <div className="k-card p-4">
                    {historyQ.isError ? (
                      <p className="k-fg3 text-[13px]">We could not read this person&apos;s history right now.</p>
                    ) : (
                      <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Shimmer key={i} className="h-10 w-full" />)}</div>
                    )}
                  </div>
                )}
              </div>
              <aside className="space-y-4">
                <div className="k-card p-4">
                  <p className="k-label">Details</p>
                  <dl className="mt-3 space-y-2.5 text-[13px]">
                    <Row k="Email" v={lead.email || null} />
                    <Row
                      k="Company"
                      v={
                        company ? (
                          domain ? (
                            <Link href={`${v2Href(orgId, brandId, "companies")}/${encodeURIComponent(domain)}`} className="hover:underline">
                              {company}
                            </Link>
                          ) : (
                            company
                          )
                        ) : null
                      }
                    />
                    <Row
                      k="Mission"
                      v={
                        mission ? (
                          <Link href={mission.href} className="inline-flex items-center gap-1.5 hover:underline">
                            <CrewMark color={mission.crew.color} glyph={mission.crew.glyph} />
                            {mission.crew.name}
                            {mission.offerName ? ` · ${mission.offerName}` : ""}
                          </Link>
                        ) : null
                      }
                    />
                    <Row k="Audience" v={lead.audience?.name ?? null} />
                    <Row k="First contacted" v={lead.firstContactedAt ? friendlyDate(lead.firstContactedAt) : null} />
                    <Row k="Last activity" v={lastAt ? timeAgo(lastAt) : null} />
                    <Row
                      k="LinkedIn"
                      v={
                        linkedin && /^https?:\/\//.test(linkedin) ? (
                          <a href={linkedin} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            Profile
                          </a>
                        ) : null
                      }
                    />
                  </dl>
                </div>
                <CrmAttributionCard leadRowId={leadRowId} brandId={brandId} />
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="k-fg3 shrink-0">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v ?? <span className="k-fg4">{"—"}</span>}</dd>
    </div>
  );
}
