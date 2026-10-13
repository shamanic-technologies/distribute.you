"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { leadSourceTags } from "@/lib/source-overlap";
import { ownQueryData } from "@/lib/own-query-data";
import { getLeadDetail, getLeadHistory, getLeadTimeline, getLeadConsolidatedStatus, leadDateForStatus, type Lead } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { friendlyDate, timeAgo } from "@/lib/friendly-datetime";
import { standingTagLabel } from "@/lib/lead-standing";
import { leadWentCold, wentColdReason, WENT_COLD_LABEL } from "@/lib/lead-cold";
import { useSetAnyLeadStepStatement } from "@/lib/use-lead-step-statements";
import { v2Href, v2RunHref } from "@/lib/v2/routes";
import { useStaffMode } from "@/lib/use-staff-mode";
import { LeadHistoryTimeline } from "@/components/audiences/lead-history-timeline";
import { CrmAttributionCard } from "@/components/crm/crm-attribution-card";
import { SendingScheduleCard } from "@/components/v2/sending-schedule-card";
import { LeadChecks } from "@/components/v2/lead-checks";
import { ConversationTimelineCard } from "@/components/v2/conversation-timeline";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { CloseWonForm } from "@/components/leads/close-won-form";
import { TagChip } from "@/components/v2/tag-chip";
import {
  CLIENT_TAG,
  DISQUALIFIED_TAG,
  OPTED_OUT_TAG,
  SIGNED_UP_TAG,
  companyLevelMark,
  disqualificationNoteBody,
  disqualificationSourceWord,
  humanOptedOut,
  leadLevelMark,
  type DisqualificationLevel,
  type LeadDisqualification,
} from "@/lib/lead-disqualification";
import { useRemoveLeadDisqualification, useSetLeadDisqualification } from "@/lib/use-lead-disqualification";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, leadTitle } from "@/components/v2/people-bits";

function standingState(lead: Lead): string | null {
  const s = (lead as unknown as { standing?: { state?: unknown } }).standing;
  return typeof s?.state === "string" ? s.state : null;
}

/**
 * One person, laid out as Keel lays out one record: who they are on top, what
 * happened with them in the main column (lead-service's own ordered history: every
 * message both ways, every delivery fact), and the facts beside it.
 *
 * Every value is served. The history is the same read, on the same key, the v1 lead
 * panel makes, and the win is stated through the same form and the same write the v1
 * board uses, so a person reads and moves the same way in both.
 */
export function PersonPage() {
  const { orgId, brandId, leadRowId } = useParams<{ orgId: string; brandId: string; leadRowId: string }>();
  // A run opens the staff-only Work run page: a customer reads the step, with no link.
  const { staffMode } = useStaffMode();
  // The Checks read the selected offer's criteria: wait for the offers, never a brand-wide read first.
  const { offerId, settled: offerSettled } = useSelectedOffer();
  const leadQ = useAuthQuery(["leadDetail", leadRowId, brandId], () => getLeadDetail(leadRowId, brandId), pollOptions);
  const historyQ = useAuthQuery(
    ["leadHistory", leadRowId, brandId, "campaign"],
    () => getLeadHistory(leadRowId, { brandId, scope: "campaign" }),
    { enabled: Boolean(leadRowId) },
  );
  // The conversation (this person x the selected offer x the brand): lead-service's stored,
  // labelled timeline and its tags. Asked once the offer is known, never brand-wide first.
  const timelineQ = useAuthQuery(
    ["leadTimeline", leadRowId, brandId, offerId],
    () => getLeadTimeline(leadRowId, { brandId, offerId }),
    { ...pollOptions, enabled: Boolean(leadRowId) && offerSettled },
  );
  const [closing, setClosing] = useState(false);
  const setStep = useSetAnyLeadStepStatement();
  const [disqualifying, setDisqualifying] = useState(false);
  const [note, setNote] = useState("");
  const [level, setLevel] = useState<DisqualificationLevel>("lead");
  const disqualify = useSetLeadDisqualification();
  const undoDisqualify = useRemoveLeadDisqualification();

  // Only THIS lead's reads: keepPreviousData would show the previous person's while these load.
  const lead = ownQueryData(leadQ) ?? null;
  const timeline = ownQueryData(timelineQ) ?? null;
  const history = ownQueryData(historyQ);
  const name = lead ? leadName(lead) : "";
  const company = lead ? leadCompany(lead) : null;
  const domain = lead ? leadCompanyDomain(lead) : null;
  const title = lead ? leadTitle(lead) : null;
  const state = lead ? standingState(lead) : null;
  // The conversation's label is lead-service's TAG (a no reads "Not interested"), never the state.
  const tagLabel = lead ? standingTagLabel((lead as unknown as { standing?: unknown }).standing) : null;
  const cold = lead ? leadWentCold((lead as unknown as { standing?: unknown }).standing) : null;
  const lastAt = lead ? leadDateForStatus(lead, getLeadConsolidatedStatus(lead)) : null;
  const linkedin = lead?.lead?.linkedinUrl ?? null;
  // Tags at THEIR level (LEAD-REFONTE-1013), each read off its own served field, never mixed:
  // the PERSON (opted out, wherever they work), this LEAD (steps + its own Disqualified mark,
  // for this conversation: the timeline answers, the row until it loads), the COMPANY (client,
  // signed up, its own Disqualified mark "not our target").
  const answering = timeline ? (timeline.disqualification ?? null) : (lead?.disqualification ?? null);
  const leadMark = leadLevelMark(answering);
  const companyBlock = lead?.company ?? null;
  const companyMark = companyLevelMark(companyBlock, answering);
  const optedOut = lead ? humanOptedOut((lead as unknown as { standing?: unknown }).standing) : false;
  // A level already marked is undone in its row, never marked twice; a lead with no known
  // company can only be disqualified as a contact.
  const freeLevels: DisqualificationLevel[] = [
    ...(leadMark ? [] : (["lead"] as const)),
    ...(companyBlock && !companyMark ? (["company"] as const) : []),
  ];
  const formLevel = freeLevels.includes(level) ? level : freeLevels[0];
  const companyWord = company ?? "their company";

  return (
    <>
      <TopBar
        crumbs={[{ label: "People", href: v2Href(orgId, brandId, "people") }, { label: name || " " }]}
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
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="k-btn">
                    Email
                  </a>
                ) : null}
                {freeLevels.length > 0 ? (
                  <button type="button" className="k-btn" onClick={() => setDisqualifying((v) => !v)} aria-expanded={disqualifying}>
                    Disqualify
                  </button>
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

            {disqualifying && formLevel ? (
              <form
                className="k-card mt-4 flex flex-wrap items-center gap-2 p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  disqualify.mutate(
                    { leadRowId, brandId, level: formLevel, ...(offerId ? { offerId } : {}), ...disqualificationNoteBody(note) },
                    {
                      onSuccess: () => {
                        setDisqualifying(false);
                        setNote("");
                      },
                    },
                  );
                }}
              >
                <div className="flex w-full flex-wrap items-center gap-2" role="radiogroup" aria-label="Disqualify">
                  <span className="k-fg2 text-[13px]">Disqualify</span>
                  {freeLevels.map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={formLevel === l}
                      className={formLevel === l ? "k-btn-strong" : "k-btn"}
                      onClick={() => setLevel(l)}
                    >
                      {l === "lead" ? "This contact" : `All of ${companyWord}`}
                    </button>
                  ))}
                </div>
                <label htmlFor="disqualify-note" className="k-fg2 w-full text-[13px]">
                  {formLevel === "lead"
                    ? "Not the right person? Add a note if you like."
                    : `Not our target? Everyone at ${companyWord} reads Disqualified.`}
                </label>
                <input
                  id="disqualify-note"
                  className="k-input min-w-0 flex-1"
                  value={note}
                  maxLength={2000}
                  placeholder="Why (optional)"
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setDisqualifying(false);
                  }}
                  autoFocus
                />
                <button type="button" className="k-btn-ghost" onClick={() => setDisqualifying(false)}>
                  Cancel
                </button>
                <button type="submit" className="k-btn-strong" disabled={disqualify.isPending}>
                  Disqualify
                </button>
                {disqualify.isError ? <p className="w-full text-[12px] text-[var(--data-rose)]">We could not save this. Try again.</p> : null}
              </form>
            ) : null}

            <div className="k-card mt-4 divide-y divide-[var(--line-subtle)]">
              <LevelRow label="Everywhere" sub="Wherever they work">
                {optedOut ? <TagChip tag={OPTED_OUT_TAG} /> : <span className="k-fg4">{"—"}</span>}
              </LevelRow>
              <LevelRow label={company ? `At ${company}` : "This contact"} sub="This person, at this company">
                {tagLabel ? <span className="k-chip">{tagLabel}</span> : null}
                {leadMark ? (
                  <MarkLine
                    mark={leadMark}
                    busy={undoDisqualify.isPending}
                    onUndo={() => undoDisqualify.mutate({ leadRowId, brandId, offerId: leadMark.offerId, level: "lead" })}
                  />
                ) : !tagLabel ? (
                  <span className="k-fg4">{"—"}</span>
                ) : null}
              </LevelRow>
              {companyBlock ? (
                <LevelRow label={company ?? "Company"} sub="Everyone at this company">
                  {companyBlock.isClient ? <TagChip tag={CLIENT_TAG} /> : null}
                  {companyBlock.signedUp ? <TagChip tag={SIGNED_UP_TAG} /> : null}
                  {companyMark ? (
                    <MarkLine
                      mark={companyMark}
                      busy={undoDisqualify.isPending}
                      onUndo={() => undoDisqualify.mutate({ leadRowId, brandId, offerId: companyMark.offerId, level: "company" })}
                    />
                  ) : !companyBlock.isClient && !companyBlock.signedUp ? (
                    <span className="k-fg4">{"—"}</span>
                  ) : null}
                </LevelRow>
              ) : null}
              {undoDisqualify.isError ? <p className="px-4 py-2 text-[12px] text-[var(--data-rose)]">We could not undo this. Try again.</p> : null}
            </div>

            {cold ? (
              <div className="k-card mt-4 p-4">
                <p className="text-[13px] font-medium">{WENT_COLD_LABEL}</p>
                <p className="k-fg2 mt-0.5 text-[13px]">{wentColdReason(cold)}</p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-6">
                <ConversationTimelineCard
                  timeline={timeline}
                  failed={timelineQ.isFetchedAfterMount && !timeline && timelineQ.isError}
                />
                {lead.leadId && offerSettled ? <LeadChecks leadId={lead.leadId} brandId={brandId} offerId={offerId} /> : null}
                {history ? (
                  <LeadHistoryTimeline
                    history={history}
                    heading="Conversation and activity"
                    showNextFollowup
                    runHref={staffMode ? (runId) => `${v2RunHref(orgId, brandId, runId)}?person=${encodeURIComponent(leadRowId)}` : undefined}
                  />
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
                    {lead.sources ? (
                      <Row
                        k="Found by"
                        v={
                          leadSourceTags(lead.sources).length > 0 ? (
                            <span className="inline-flex flex-wrap justify-end gap-1">
                              {leadSourceTags(lead.sources).map((t) => (
                                <span key={t.slug} className="k-chip">
                                  {t.name}
                                </span>
                              ))}
                            </span>
                          ) : null
                        }
                      />
                    ) : null}
                    <Row k="First queued" v={lead.firstContactedAt ? friendlyDate(lead.firstContactedAt) : null} />
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
                {lead.email ? <SendingScheduleCard email={lead.email} brandId={brandId} /> : null}
                <CrmAttributionCard leadRowId={leadRowId} brandId={brandId} />
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** One level of tags: what it covers on the left, its tags on the right. */
function LevelRow({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{label}</p>
        <p className="k-fg3 text-[12px]">{sub}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px]">{children}</div>
    </div>
  );
}

/** A Disqualified mark: the tag, its note, who set it and when, and Undo. */
function MarkLine({ mark, busy, onUndo }: { mark: LeadDisqualification; busy: boolean; onUndo: () => void }) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-start gap-3">
      <TagChip tag={DISQUALIFIED_TAG} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">{mark.note ?? <span className="k-fg3">No note.</span>}</p>
        <p className="k-fg3 mt-0.5 text-[12px]">
          {disqualificationSourceWord(mark)} · {friendlyDate(mark.statedAt)}
        </p>
      </div>
      <button type="button" className="k-btn" disabled={busy} onClick={onUndo}>
        Undo
      </button>
    </div>
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
