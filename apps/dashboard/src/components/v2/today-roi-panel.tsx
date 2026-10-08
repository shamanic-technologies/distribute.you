"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  getBrandConversionRates,
  stateBrandLegRates,
  type ColdPipelineLead,
  type EffectiveLegRate,
  type OfferLadderStep,
  type OfferPipeline,
  type PipelineLead,
  type StepPerson,
  type LostStepPerson,
  type StepValueExplanation,
  type ExclusiveLadder,
  type ExclusiveRow,
} from "@/lib/api";
import { useSetAnyLeadStepStatement } from "@/lib/use-lead-step-statements";
import { StageStatementForm } from "@/components/leads/lead-stage-section";
import { CloseWonForm } from "@/components/leads/close-won-form";
import { invalidateConversionRates } from "@/lib/write-invalidation";
import { legRateFor } from "@/lib/offer-channel-settings";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { friendlyDate } from "@/lib/friendly-datetime";
import { InlineRate } from "@/components/v2/offer-channels-page";
import { CompanyMark } from "@/components/v2/people-bits";
import { EmptyNote, Initials, Shimmer } from "@/components/v2/ui";

/** What the Today panel shows: one step of the pipeline, or one lead. */
export type TodayPanelTarget =
  | { kind: "step"; stepKey: string }
  | { kind: "contacted" }
  | { kind: "lead"; lead: PipelineLead | ColdPipelineLead; group: "hot" | "lost" };

const pct = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;

/** Where a served leg rate comes from, in the customer's words. */
function sourceWords(leg: StepValueExplanation["legs"][number]): string {
  if (leg.source === "measured") {
    const { measured: m } = leg;
    const where = m?.basis === "crm" ? "in your CRM" : "on our leads";
    return m && m.fromReached != null && m.toReached != null
      ? `Measured ${where}: ${formatCount(m.toReached)} of ${formatCount(m.fromReached)}`
      : `Measured ${where}`;
  }
  if (leg.source === "manual") return "Set by you";
  if (leg.source === "median") return "Median of our clients";
  if (leg.source === "default") return "Industry average";
  return "Source unknown";
}

const isCold = (l: PipelineLead | ColdPipelineLead): l is ColdPipelineLead => "lostReason" in l;
type CardPerson = Pick<PipelineLead, "firstName" | "lastName" | "title" | "orgName" | "orgDomain" | "valueUsd" | "probabilityPct">;
const leadName = (l: CardPerson) => [l.firstName, l.lastName].filter(Boolean).join(" ") || l.orgName || "Unknown";

/**
 * The Today right panel (owner 2026-10-08): click a step or a lead, read why it is worth
 * what it is worth, change the rates behind it at brand level, and see the people. Every
 * figure is features-service's; the rates are the brand's effective rates, edited with
 * the same inline control and the same write as the Outbound page.
 */
export function TodayPanel({
  brandId,
  pipeline,
  target,
  onClose,
}: {
  brandId: string;
  pipeline: OfferPipeline | null;
  target: TodayPanelTarget;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Read after mount: the shell's #v2-portal is not committed on a first paint.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);
  if (!host) return null;

  const stepKey = target.kind === "step" ? target.stepKey : target.kind === "lead" ? target.lead.step.key : null;
  const step = stepKey ? pipeline?.ladder.find((s) => s.step.key === stepKey) ?? null : null;
  // The same step on the one-row-per-person reading: its people and its slice (#1416).
  const slice = stepKey ? pipeline?.exclusiveLadder?.rows.find((r) => r.step.key === stepKey) ?? null : null;

  return createPortal(
    <aside
      role="dialog"
      aria-label={target.kind === "step" ? `${step?.step.label ?? "Step"} details` : target.kind === "contacted" ? "People contacted details" : `${leadName(target.lead)} details`}
      className="k-popover fixed inset-y-2 right-2 z-[80] flex w-[min(480px,calc(100vw-16px))] flex-col overflow-hidden"
    >
      <div className="k-line-subtle flex h-11 shrink-0 items-center justify-between border-b px-4">
        <span className="k-label">{target.kind === "step" ? "Step" : target.kind === "contacted" ? "People contacted" : target.group === "hot" ? "Hot lead" : "Lost lead"}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="k-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {target.kind === "step" ? (
          <StepBody step={step} slice={slice} brandId={brandId} />
        ) : target.kind === "contacted" ? (
          <ContactedBody contacted={pipeline?.exclusiveLadder?.contacted ?? null} />
        ) : (
          <LeadBody lead={target.lead} step={step} brandId={brandId} />
        )}
      </div>
    </aside>,
    host,
  );
}

function StepBody({ step, slice, brandId }: { step: OfferLadderStep | null; slice: ExclusiveRow | null; brandId: string }) {
  if (!step) return <EmptyNote>This step is not readable right now.</EmptyNote>;
  const cold = step.wentCold;
  // One row per person: the people whose furthest step is this one, never the ones who went further.
  const people = slice?.people ?? step.people ?? null;
  return (
    <>
      <div>
        <h2 className="text-[20px] font-medium leading-7 tracking-[-0.01em]">{step.step.label}</h2>
        <p className="k-fg2 mt-1 text-[13px] tabular-nums">
          {(slice?.pricedPeople ?? step.pricedRecipientsReached) != null
            ? `${formatCount((slice?.pricedPeople ?? step.pricedRecipientsReached) as number)} thanks to us${step.step.key === "paid_client" ? "" : ", not further yet"}`
            : "\u00a0"}
        </p>
      </div>
      <div className="k-card grid grid-cols-2 divide-x divide-[var(--line-subtle)]">
        <div className="p-3">
          <p className="k-label">Worth each</p>
          <p className="mt-1 text-[20px] font-medium tabular-nums">{step.valuePerOutcomeUsd != null ? formatUsdAdaptive(step.valuePerOutcomeUsd) : "—"}</p>
        </div>
        <div className="p-3">
          <p className="k-label">Pipeline</p>
          <p className="mt-1 text-[20px] font-medium tabular-nums">
            {slice ? (slice.pipelineUsd != null ? formatUsdAdaptive(slice.pipelineUsd) : "—") : step.pricedValueUsd != null ? formatUsdAdaptive(step.pricedValueUsd) : "—"}
          </p>
        </div>
      </div>
      <WhySection why={step.valueExplanation} brandId={brandId} />
      {people ? (
        <>
          <PeopleGroup title="Thanks to us" count={people.ours.count}>
            {people.ours.leads.map((l) => (
              <LeadCard
                key={l.leadId}
                lead={l}
                size="hero"
                meta={l.reachedAt ? `${step.step.key === "paid_client" ? "Won" : `Reached ${step.step.label.toLowerCase()}`} ${friendlyDate(l.reachedAt)}` : null}
              />
            ))}
          </PeopleGroup>
          {people.lost.count > 0 && (
            <PeopleGroup title="Thanks to us, considered lost" count={people.lost.count}>
              {people.lost.leads.map((l) => (
                <LeadCard key={l.leadId} lead={l} size="lost" meta={lostWords(l)} />
              ))}
            </PeopleGroup>
          )}
          {people.notOurs.count > 0 && (
            <PeopleGroup title="Not from us" sub="Your CRM or another source" count={people.notOurs.count}>
              {people.notOurs.leads.map((l) => (
                <LeadCard key={l.leadId} lead={l} size="compact" meta={l.reachedAt ? friendlyDate(l.reachedAt) : null} />
              ))}
            </PeopleGroup>
          )}
        </>
      ) : cold && cold.count > 0 ? (
        <section>
          <p className="k-label mb-2">Considered lost</p>
          <p className="k-fg2 text-[13px]">
            {formatCount(cold.count)} reached this step thanks to us, then went quiet for too long
            {cold.valueUsd != null ? `. Worth ${formatUsdAdaptive(cold.valueUsd)} now.` : "."}
          </p>
        </section>
      ) : null}
    </>
  );
}

function LeadBody({ lead, step, brandId }: { lead: PipelineLead | ColdPipelineLead; step: OfferLadderStep | null; brandId: string }) {
  const cold = isCold(lead);
  return (
    <>
      <LeadCard lead={lead} size="hero" meta={`Reached ${lead.step.label.toLowerCase()}`} />
      {cold && (
        <section>
          <p className="k-label mb-2">Why we consider it lost</p>
          <p className="k-fg2 text-[13px]">
            {lead.lostReason === "went_cold" && lead.coldAtStep
              ? `Reached ${lead.step.label.toLowerCase()}${lead.stalledSince ? ` on ${friendlyDate(lead.stalledSince)}` : ""}. No ${lead.coldAtStep.label.toLowerCase()} since, so it counts as lost${lead.coldSince ? ` from ${friendlyDate(lead.coldSince)}` : ""}.`
              : `Ruled out at ${lead.step.label.toLowerCase()}: someone said the next step will not happen.`}
          </p>
        </section>
      )}
      <WhySection why={step?.valueExplanation ?? null} brandId={brandId} />
      <LeadStatus lead={lead} lifetimeRevenueUsd={step?.valueExplanation?.lifetimeRevenueUsd ?? null} />
    </>
  );
}

/**
 * People contacted who have done nothing yet (owner 2026-10-08): how one is priced (the
 * chance of reaching each entry step from contact, times that step's value, as served),
 * who counts at zero and why, and the people.
 */
function ContactedBody({ contacted }: { contacted: ExclusiveLadder["contacted"] | null }) {
  if (!contacted) return <EmptyNote>Not readable right now.</EmptyNote>;
  const why = contacted.explanation;
  const zero = [
    contacted.expiredCount > 0 ? `${formatCount(contacted.expiredCount)} with no email in ${why?.expiryDays ?? 30} days` : null,
    contacted.cannotConvertCount > 0 ? `${formatCount(contacted.cannotConvertCount)} bounced or unsubscribed` : null,
    contacted.unpricedCount > 0 ? `${formatCount(contacted.unpricedCount)} with no rate yet` : null,
  ].filter(Boolean);
  return (
    <>
      <div>
        <h2 className="text-[20px] font-medium leading-7 tracking-[-0.01em]">People contacted</h2>
        <p className="k-fg2 mt-1 text-[13px] tabular-nums">{formatCount(contacted.count)} contacted, no step reached yet</p>
      </div>
      <div className="k-card grid grid-cols-2 divide-x divide-[var(--line-subtle)]">
        <div className="p-3">
          <p className="k-label">Worth each</p>
          <p className="mt-1 text-[20px] font-medium tabular-nums">{contacted.valuePerPersonUsd != null ? formatUsdAdaptive(contacted.valuePerPersonUsd) : "—"}</p>
        </div>
        <div className="p-3">
          <p className="k-label">Pipeline</p>
          <p className="mt-1 text-[20px] font-medium tabular-nums">{contacted.pipelineUsd != null ? formatUsdAdaptive(contacted.pipelineUsd) : "—"}</p>
        </div>
      </div>
      {why && (
        <section>
          <p className="k-label mb-2">How we price it</p>
          <p className="k-fg2 text-[13px]">Each person we email has a chance to take a first step. That chance, times what the step is worth:</p>
          <ul className="k-card mt-3 divide-y divide-[var(--line-subtle)]">
            {why.routes.map((r) => (
              <li key={r.legKey} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1 truncate">Contacted <span className="k-fg3">→</span> {r.step.label}</span>
                <span className="shrink-0 tabular-nums">
                  {pct(r.entryRatePct)} <span className="k-fg3">×</span> {formatUsdAdaptive(r.valueAtStepUsd)}
                </span>
              </li>
            ))}
          </ul>
          <p className="k-fg3 mt-2 text-[12px]">
            Measured on what each campaign spent per person and what one {why.routes.length > 1 ? "step" : why.routes[0]?.step.label.toLowerCase() ?? "step"} costs. A person counts for {why.expiryDays} days after our last email.
          </p>
        </section>
      )}
      {zero.length > 0 && (
        <section>
          <p className="k-label mb-2">Counted at $0</p>
          <p className="k-fg2 text-[13px]">{zero.join(" · ")}</p>
        </section>
      )}
      <PeopleGroup title="Most valuable" count={contacted.valuedCount}>
        {contacted.people.leads.map((l) => (
          <LeadCard key={l.leadId} lead={l} size="compact" meta={l.countedWithColleague ? "Company already counted with a colleague" : l.reachedAt ? `Contacted ${friendlyDate(l.reachedAt)}` : null} />
        ))}
      </PeopleGroup>
    </>
  );
}

function lostWords(l: LostStepPerson): string {
  if (l.lostReason === "went_cold" && l.coldAtStep) {
    return `No ${l.coldAtStep.label.toLowerCase()}${l.lostSince ? ` since ${friendlyDate(l.lostSince)}` : ""}`;
  }
  if (l.lostReason === "ruled_out") return "Marked as not going ahead";
  return "Considered lost";
}

function PeopleGroup({ title, sub, count, children }: { title: string; sub?: string; count: number; children: React.ReactNode }) {
  const shown = Array.isArray(children) ? children.length : 0;
  return (
    <section>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="k-label">{title}</span>
        <span className="k-fg3 text-[12px] tabular-nums">{formatCount(count)}</span>
        {sub && <span className="k-fg3 text-[12px]">· {sub}</span>}
      </p>
      {count === 0 ? (
        <p className="k-fg3 text-[13px]">Nobody yet.</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
      {count > shown && shown > 0 && <p className="k-fg3 mt-2 text-[12px] tabular-nums">And {formatCount(count - shown)} more.</p>}
    </section>
  );
}

/** The steps a person can still be stated at, after the one they reached, in order. */
const STATEMENT_STEPS: { key: "meeting_booked" | "meeting_attended" | "sale"; label: string; ladder: string }[] = [
  { key: "meeting_booked", label: "Meeting booked", ladder: "meeting_booked" },
  { key: "meeting_attended", label: "Meeting attended", ladder: "meeting_attended" },
  { key: "sale", label: "Paid client", ladder: "paid_client" },
];
const LADDER_ORDER = ["website_visit", "conversation", "signup", "form_submitted", "meeting_booked", "meeting_attended", "paid_client"];

/**
 * Change what happened to this lead (owner 2026-10-08), with lead-service's per-lead step
 * statements: the person page's write, its cost question and its close-won form.
 */
function LeadStatus({ lead, lifetimeRevenueUsd }: { lead: PipelineLead | ColdPipelineLead; lifetimeRevenueUsd: number | null }) {
  const setStep = useSetAnyLeadStepStatement();
  const [open, setOpen] = useState<{ key: string; kind: "outcome" | "never" } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const rowId = lead.campaignLeadId ?? null;
  const at = LADDER_ORDER.indexOf(lead.step.key);
  const next = STATEMENT_STEPS.filter((s) => LADDER_ORDER.indexOf(s.ladder) > at);
  if (next.length === 0) return null;
  return (
    <section>
      <p className="k-label mb-2">Update this lead</p>
      {!rowId ? (
        <p className="k-fg3 text-[13px]">This lead cannot be updated from here.</p>
      ) : (
        <ul className="k-card divide-y divide-[var(--line-subtle)]">
          {next.map((s) => (
            <li key={s.key} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px]">{s.label}</span>
                <span className="flex gap-1.5">
                  {s.key === "sale" ? (
                    <button type="button" className="k-btn-strong" onClick={() => setOpen({ key: s.key, kind: "outcome" })}>
                      Mark as won
                    </button>
                  ) : (
                    <button type="button" className="k-btn" onClick={() => setOpen({ key: s.key, kind: "outcome" })}>
                      Happened
                    </button>
                  )}
                  <button type="button" className="k-btn-ghost" onClick={() => setOpen({ key: s.key, kind: "never" })}>
                    Won&apos;t happen
                  </button>
                </span>
              </div>
              {open?.key === s.key && (
                <div className="v2-embed mt-2">
                  {s.key === "sale" && open.kind === "outcome" ? (
                    <CloseWonForm
                      prefillUsd={lifetimeRevenueUsd}
                      busy={setStep.isPending}
                      onCancel={() => setOpen(null)}
                      onSubmit={(input) =>
                        setStep.mutate(
                          { leadRowId: rowId, step: "sale", kind: "outcome", ...input },
                          { onSuccess: () => { setOpen(null); setDone(`${s.label}: recorded.`); } },
                        )
                      }
                    />
                  ) : (
                    <StageStatementForm
                      label={s.label}
                      tone={open.kind}
                      needsValue={false}
                      busy={setStep.isPending}
                      onCancel={() => setOpen(null)}
                      onSubmit={({ costCents }) =>
                        setStep.mutate(
                          { leadRowId: rowId, step: s.key, kind: open.kind, costCents },
                          { onSuccess: () => { setOpen(null); setDone(`${s.label}: ${open.kind === "outcome" ? "recorded" : "marked as not happening"}.`); } },
                        )
                      }
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {setStep.isError && <p className="mt-2 text-[12px] text-[var(--data-rose)]">We could not record this. Try again.</p>}
      {done && <p className="k-fg2 mt-2 text-[12px]">{done} The figures update in a few seconds.</p>}
    </section>
  );
}

/**
 * The lead's card. `hero` = reached it thanks to us and still alive (the most spacious),
 * `lost` = ours but gone quiet, `compact` = not from us.
 */
export function LeadCard({ lead, size, meta }: { lead: CardPerson; size: "hero" | "lost" | "compact"; meta: string | null }) {
  const mark = size === "hero" ? 40 : size === "lost" ? 28 : 20;
  const sub = [lead.title, lead.orgName].filter(Boolean).join(" · ");
  return (
    <div className={`k-card flex min-w-0 items-center gap-3 ${size === "hero" ? "p-5" : size === "lost" ? "p-4" : "px-3 py-2.5"}`}>
      {lead.orgName ? <CompanyMark name={lead.orgName} domain={lead.orgDomain} size={mark} /> : <Initials name={leadName(lead)} size={mark} round />}
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${size === "hero" ? "text-[16px]" : "text-[13px]"}`}>{leadName(lead)}</p>
        {sub && <p className="k-fg2 truncate text-[12px]">{sub}</p>}
        {meta && <p className="k-fg3 truncate text-[12px]">{meta}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={`font-medium tabular-nums ${size === "hero" ? "text-[20px] text-[var(--run)]" : "text-[13px]"}`}>
          {lead.valueUsd != null ? formatUsdAdaptive(lead.valueUsd) : "—"}
        </p>
        {lead.probabilityPct != null && <p className="k-fg3 text-[12px] tabular-nums">{pct(lead.probabilityPct)} chance</p>}
      </div>
    </div>
  );
}

/**
 * How a step is worth what it is worth: lifetime revenue x the chance, and each leg rate
 * that chance multiplies, with where it comes from and an inline edit at brand level.
 */
function WhySection({ why, brandId }: { why: StepValueExplanation | null; brandId: string }) {
  const qc = useQueryClient();
  const rates = useAuthQuery(["brandConversionRates", brandId], () => getBrandConversionRates(brandId), {
    ...pollOptions,
    enabled: !!brandId,
  });
  if (!why) return null;
  const save = async (rate: EffectiveLegRate, ratePct: number | null) => {
    if (rate.manualRatePct === ratePct) return;
    await stateBrandLegRates(brandId, [{ fromStep: rate.fromStep, toStep: rate.toStep, ratePct }]);
    // A rate prices every money figure, Today's pipeline included: re-read them all.
    invalidateConversionRates(qc);
    await qc.refetchQueries({ queryKey: ["brandConversionRates", brandId] });
  };
  return (
    <section>
      <p className="k-label mb-2">How we price it</p>
      <p className="text-[13px] tabular-nums">
        {formatUsdAdaptive(why.lifetimeRevenueUsd)} per client × {pct(why.probabilityPct)} chance to become one
      </p>
      {why.legs.length > 0 && (
        <ul className="k-card mt-3 divide-y divide-[var(--line-subtle)]">
          {why.legs.map((l) => {
            const rate = legRateFor(rates.data?.legs ?? [], l.legKey);
            return (
              <li key={l.legKey} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">
                    {l.fromStep.label} <span className="k-fg3">→</span> {l.toStep.label}
                  </p>
                  <p className="k-fg3 mt-0.5 text-[12px]">{sourceWords(l)}</p>
                </div>
                {/* Click the rate to change it: the brand's own rate, saved on leaving the field. */}
                <div className="shrink-0 text-[13px] font-medium">
                  {rates.data === undefined && !rates.isError ? (
                    <Shimmer className="h-5 w-12 rounded-[6px]" />
                  ) : rate ? (
                    <InlineRate key={`${rate.fromStep}|${rate.toStep}`} rate={rate} onSave={(v) => save(rate, v)} bare />
                  ) : (
                    <span className="tabular-nums">{pct(l.ratePct)}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="k-fg3 mt-2 text-[12px]">A rate you set applies to every offer of this brand.</p>
    </section>
  );
}
