"use client";

import Link from "next/link";
import type {
  ColdPipelineLead,
  OfferLadderStep,
  OfferOutcomeRow,
  OfferPipeline,
  PipelineLead,
  ExclusiveRow,
} from "@/lib/api";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { friendlyDate } from "@/lib/friendly-datetime";
import { v2OfferHref } from "@/lib/v2/routes";
import { ExpectedLabel } from "@/components/v2/offer-sales-paths";
import { CompanyMark } from "@/components/v2/people-bits";
import { EmptyNote, Initials, SectionTitle, Shimmer } from "@/components/v2/ui";

export const WORTH_EACH_TIP =
  "Expected, not measured yet. The chance one person at this step becomes a paying client, times what one client is worth to you.";

const pct = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;
const dash = <span className="k-fg4">—</span>;

/**
 * The headline of what working with us earned (owner 2026-10-08): customers won on OUR
 * outreach, the leads we think will convert, the ones we consider lost. Every figure is
 * served by features-service; nothing is summed here.
 */
export function EarnedStrip({ pipeline, answered }: { pipeline: OfferPipeline | null; answered: boolean }) {
  const won = pipeline?.customersWon ?? null;
  const hot = pipeline?.hotLeads ?? null;
  // Lost = went cold or ruled out (owner 2026-10-08, one verdict with the lead families).
  const cold = pipeline?.lostLeads ?? null;
  const coldApplies = pipeline?.coldRule?.applies ?? null;
  const cell = (label: string, figure: React.ReactNode, note: React.ReactNode) => (
    <div className="min-w-0 p-4">
      <p className="k-label">{label}</p>
      <div className="mt-1.5 text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">
        {!answered ? <Shimmer className="h-7 w-16" /> : figure}
      </div>
      <p className="k-fg3 mt-0.5 truncate text-[12px]">{answered ? note : " "}</p>
    </div>
  );
  return (
    <div className="k-card grid grid-cols-1 divide-y divide-[var(--line-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {cell(
        "Customers won",
        won ? formatCount(won.count) : dash,
        won
          ? [
              won.valueUsd != null ? `${formatUsdAdaptive(won.valueUsd)} won thanks to us` : "Thanks to us",
              won.otherCausesLeadCount > 0 ? `+${formatCount(won.otherCausesLeadCount)} from other sources` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : "Not readable right now",
      )}
      {cell(
        "Hot leads",
        hot ? formatCount(hot.totalCount) : dash,
        hot ? `${formatUsdAdaptive(hot.totalValueUsd)} expected` : "No value set for a client yet",
      )}
      {cell(
        "Lost leads",
        coldApplies === false && !cold?.count ? dash : cold ? formatCount(cold.count) : dash,
        coldApplies === false && !cold?.count
          ? "Connect your CRM to spot them"
          : cold
            ? cold.valueUsd != null
              ? `Now worth ${formatUsdAdaptive(cold.valueUsd)}`
              : "Showed interest, then went quiet"
            : "Not readable right now",
      )}
    </div>
  );
}

/**
 * What the offer's people are worth, step by step, and why (owner 2026-10-08). Every step
 * a lead climbs, deepest first, then the people and companies contacted. Rows do not add
 * up (a person who replied then booked is in both), so no total is drawn.
 *
 * Until features-service serves the ladder, the outcome rows it already serves are shown.
 */
export function OfferOutcomesTable({
  orgId,
  brandId,
  offerId,
  rows,
  pipeline,
  contacted,
  answered,
  failed,
  onOpenStep,
  onOpenContacted,
}: {
  orgId: string;
  brandId: string;
  offerId: string | null;
  rows: readonly OfferOutcomeRow[] | null;
  pipeline: OfferPipeline | null;
  /** The contacted people's value, features-service's contacted-value read (not re-priced here). */
  contacted: { perLeadUsd: number | null; totalUsd: number | null } | null;
  answered: boolean;
  failed: boolean;
  /** Opens the step's right panel: why it is worth that, the rates, the people. */
  onOpenStep: (stepKey: string) => void;
  /** Opens the contacted people's panel: how one is priced, and who. */
  onOpenContacted: () => void;
}) {
  // Served shallow to deep; the page reads from the step closest to a sale. A step the
  // producer does not count (a hand-off nobody measures) says nothing to the customer.
  // A step nobody reached and nothing prices (a signup the offer does not use) is noise.
  // A step reached only through other sources stays: its panel shows who (owner 2026-10-08).
  const ladder = pipeline
    ? [...pipeline.ladder].reverse().filter((s) => s.recipientsReached != null && (s.recipientsReached > 0 || s.valuePerOutcomeUsd != null))
    : null;
  const cols = 5;
  // THE PIPELINE SLICED (owner 2026-10-08: "il faut les exclure, pour que la somme des
  // lignes fasse le total pipeline"): every person on ONE row, the furthest step we
  // brought them to; the rows and the contacted row add up to the served total.
  const ex = pipeline?.exclusiveLadder ?? null;
  const exRows = ex
    ? [...ex.rows].reverse().filter((r) => (r.pricedPeople ?? 0) > 0 || (r.people?.notOurs.count ?? 0) > 0)
    : null;
  // Step to step is cumulative by nature: the conversion column keeps the ladder's.
  const conversionOf = (key: string) => pipeline?.ladder.find((s) => s.step.key === key)?.pricedConversionFromPrevious?.ratePct ?? null;
  return (
    <section>
      <SectionTitle right={<span>Since you started</span>}>Pipeline by step</SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className="k-label px-2 py-2.5 sm:px-3 pl-4 text-left font-normal">Step</th>
                <th className="k-label px-2 py-2.5 sm:px-3 text-right font-normal">People</th>
                <th className="k-label hidden whitespace-nowrap px-2 py-2.5 text-right font-normal sm:table-cell sm:px-3">Conversion</th>
                <th className="k-label whitespace-nowrap px-2 py-2.5 sm:px-3 text-right font-normal">
                  <ExpectedLabel tip={WORTH_EACH_TIP}>Worth each</ExpectedLabel>
                </th>
                <th className="k-label px-2 py-2.5 sm:px-3 pr-4 text-right font-normal">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {!answered && !failed ? (
                [0, 1, 2].map((i) => (
                  <tr key={i} className="k-line-subtle border-b last:border-0">
                    <td colSpan={cols} className="px-4 py-2">
                      <Shimmer className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : failed ? (
                <tr>
                  <td colSpan={cols}>
                    <EmptyNote>Could not read your pipeline. Retrying.</EmptyNote>
                  </td>
                </tr>
              ) : ex && exRows ? (
                <>
                  {exRows.map((r) => (
                    <SliceLine key={r.step.key} r={r} conversionPct={conversionOf(r.step.key)} onOpen={() => onOpenStep(r.step.key)} />
                  ))}
                  <ContactedLine
                    label="People contacted"
                    count={ex.contacted.count}
                    eachUsd={ex.contacted.valuePerPersonUsd}
                    totalUsd={ex.contacted.pipelineUsd}
                    onOpen={onOpenContacted}
                  />
                  <tr className="k-line-subtle border-t">
                    <td className="px-2 py-2.5 pl-4 font-semibold sm:px-3">Total</td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums sm:px-3">{formatCount(ex.total.people)}</td>
                    <td className="hidden sm:table-cell" />
                    <td />
                    <td className="px-2 py-2.5 pr-4 text-right font-semibold tabular-nums sm:px-3">
                      {ex.total.pipelineUsd != null ? formatUsdAdaptive(ex.total.pipelineUsd) : dash}
                    </td>
                  </tr>
                </>
              ) : ladder ? (
                <>
                  {ladder.map((s) => (
                    <LadderLine key={s.step.key} s={s} onOpen={() => onOpenStep(s.step.key)} />
                  ))}
                  <ContactedLine
                    label="People contacted"
                    count={pipeline?.peopleContacted ?? null}
                    eachUsd={contacted?.perLeadUsd ?? null}
                    totalUsd={contacted?.totalUsd ?? null}
                  />
                </>
              ) : (
                <tr>
                  <td colSpan={cols}>
                    <EmptyNote>Could not read your pipeline. Retrying.</EmptyNote>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
          {ex && ex.total.gapUsd != null && Math.abs(ex.total.gapUsd) >= 0.5 && ex.total.headlinePipelineUsd != null ? (
            <span className="block">
              The Pipeline figure at the top reads {formatUsdAdaptive(ex.total.headlinePipelineUsd)}: {GAP_WORDS[ex.total.gapReason ?? ""] ?? "it counts a slightly different set of people"}.
            </span>
          ) : null}
          Each person is on one row only. Each value comes from your rate at each step and what one client is worth.{" "}
          {offerId ? (
            <Link href={v2OfferHref(orgId, brandId, offerId, "sales-path")} className="whitespace-nowrap text-[var(--accent)] hover:underline">
              Wrong number? Change it
            </Link>
          ) : null}
        </p>
      </div>
    </section>
  );
}

/**
 * One step: the people WE brought there (owner 2026-10-08: "only those attributable to
 * us"), what one is worth, the step's pipeline. The calculation lives in the panel.
 */
function LadderLine({ s, onOpen }: { s: OfferLadderStep; onOpen: () => void }) {
  return (
    <tr
      className="k-row k-line-subtle cursor-pointer border-b last:border-0"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      aria-label={`Open ${s.step.label}`}
    >
      <td className="px-2 py-2 pl-4 font-medium sm:px-3">{s.step.label}</td>
      <td className="px-2 py-2 text-right tabular-nums sm:px-3">{s.pricedRecipientsReached != null ? formatCount(s.pricedRecipientsReached) : dash}</td>
      {/* From the step before, on the people we brought: the same basis as People. */}
      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell sm:px-3">
        {s.pricedConversionFromPrevious?.ratePct != null ? pct(s.pricedConversionFromPrevious.ratePct) : dash}
      </td>
      <td className="px-2 py-2 text-right tabular-nums sm:px-3">{s.valuePerOutcomeUsd != null ? formatUsdAdaptive(s.valuePerOutcomeUsd) : dash}</td>
      <td className="px-2 py-2 pr-4 text-right font-medium tabular-nums sm:px-3">{s.pricedValueUsd != null ? formatUsdAdaptive(s.pricedValueUsd) : dash}</td>
    </tr>
  );
}

const GAP_WORDS: Record<string, string> = {
  population_differs: "it counts a slightly different set of people",
  headline_unreadable: "we could not check it against this total",
  unpriced: "this offer has no value per client yet",
};

/** One slice of the pipeline: the people whose furthest step we brought them to is this one. */
function SliceLine({ r, conversionPct, onOpen }: { r: ExclusiveRow; conversionPct: number | null; onOpen: () => void }) {
  return (
    <tr {...openable(onOpen, r.step.label)}>
      <td className="px-2 py-2 pl-4 font-medium sm:px-3">{r.step.label}</td>
      <td className="px-2 py-2 text-right tabular-nums sm:px-3">{r.pricedPeople != null ? formatCount(r.pricedPeople) : dash}</td>
      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell sm:px-3">{conversionPct != null ? pct(conversionPct) : dash}</td>
      <td className="px-2 py-2 text-right tabular-nums sm:px-3">{r.valuePerOutcomeUsd != null ? formatUsdAdaptive(r.valuePerOutcomeUsd) : dash}</td>
      <td className="px-2 py-2 pr-4 text-right font-medium tabular-nums sm:px-3">{r.pipelineUsd != null ? formatUsdAdaptive(r.pipelineUsd) : dash}</td>
    </tr>
  );
}

function ContactedLine({
  label,
  count,
  eachUsd,
  totalUsd,
  onOpen,
}: {
  label: string;
  count: number | null;
  eachUsd: number | null;
  totalUsd: number | null;
  onOpen?: () => void;
}) {
  return (
    <tr {...(onOpen ? openable(onOpen, label) : { className: "k-line-subtle border-b last:border-0" })}>
      <td className="px-2 py-2 sm:px-3 pl-4 font-medium">{label}</td>
      <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{count != null ? formatCount(count) : dash}</td>
      <td className="hidden px-2 py-2 text-right sm:table-cell sm:px-3">{dash}</td>
      <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{eachUsd != null ? formatUsdAdaptive(eachUsd) : dash}</td>
      <td className="px-2 py-2 sm:px-3 pr-4 text-right font-medium tabular-nums">{totalUsd != null ? formatUsdAdaptive(totalUsd) : dash}</td>
    </tr>
  );
}

/** Why a lead is lost, in one line: gone quiet after a step, or ruled out by a person. */
export function lostWhy(l: ColdPipelineLead): string {
  if (l.lostReason === "went_cold" && l.coldAtStep) {
    return `No ${l.coldAtStep.label.toLowerCase()}${l.stalledSince ? ` since ${friendlyDate(l.stalledSince)}` : ""}`;
  }
  if (l.lostReason === "ruled_out") return `Ruled out at ${l.step.label.toLowerCase()}`;
  return "Considered lost";
}

/** A table row that opens the Today panel: click, Enter or Space. */
function openable(open: () => void, label: string) {
  return {
    className: "k-row k-line-subtle cursor-pointer border-b last:border-0",
    onClick: open,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    },
    tabIndex: 0,
    "aria-label": `Open ${label}`,
  };
}

function leadName(l: PipelineLead): string {
  return [l.firstName, l.lastName].filter(Boolean).join(" ") || l.orgName || "Unknown";
}

function PersonCell({ lead, extra }: { lead: PipelineLead; extra?: React.ReactNode }) {
  return (
    <td className="px-3 py-2 pl-4">
      <span className="flex min-w-0 items-center gap-2">
        {lead.orgName ? <CompanyMark name={lead.orgName} domain={lead.orgDomain} size={20} /> : <Initials name={leadName(lead)} size={20} round />}
        <span className="min-w-0">
          <span className="block truncate font-medium">{leadName(lead)}</span>
          <span className="k-fg3 block truncate text-[12px]">{[lead.title, lead.orgName].filter(Boolean).join(" · ") || "\u00a0"}</span>
          {extra && <span className="k-fg3 block text-[12px] sm:hidden">{extra}</span>}
        </span>
      </span>
    </td>
  );
}

/** The leads we think will convert, highest expected value first (features-service's ranking). */
export function HotLeads({
  pipeline,
  answered,
  onOpenLead,
}: {
  pipeline: OfferPipeline | null;
  answered: boolean;
  onOpenLead: (lead: PipelineLead) => void;
}) {
  const hot = pipeline?.hotLeads ?? null;
  return (
    <section>
      <SectionTitle count={hot ? hot.totalCount : null} right={hot ? <span>{formatUsdAdaptive(hot.totalValueUsd)} expected</span> : null}>
        Hot leads
      </SectionTitle>
      <div className="k-card overflow-hidden">
        {!answered ? (
          <div className="p-4"><Shimmer className="h-16 w-full" /></div>
        ) : !hot ? (
          <EmptyNote>Set what one client is worth to see who is likely to buy.</EmptyNote>
        ) : hot.leads.length === 0 ? (
          <EmptyNote>No hot lead right now. People who show interest land here.</EmptyNote>
        ) : (
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className="k-label px-3 py-2.5 pl-4 text-left font-normal sm:w-[55%]">Person</th>
                <th className="k-label hidden px-3 py-2.5 text-left font-normal sm:table-cell">Reached</th>
                <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">
                  <ExpectedLabel tip={WORTH_EACH_TIP}>Worth</ExpectedLabel>
                </th>
              </tr>
            </thead>
            <tbody>
              {hot.leads.map((l) => (
                <tr key={l.leadId} {...openable(() => onOpenLead(l), leadName(l))}>
                  <PersonCell lead={l} extra={l.step.label} />
                  <td className="k-fg2 hidden truncate px-3 py-2 sm:table-cell">{l.step.label}</td>
                  <td className="px-3 py-2 pr-4 text-right tabular-nums">
                    <span className="block font-medium">{l.valueUsd != null ? formatUsdAdaptive(l.valueUsd) : "—"}</span>
                    {l.probabilityPct != null && <span className="k-fg3 block text-[12px]">{pct(l.probabilityPct)} chance</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/**
 * Leads that showed interest and went cold (lead-service's rule, CRM brands only), priced
 * as the pipeline prices them now (owner 2026-10-08: "back to base conversion rate").
 */
export function LostLeads({
  pipeline,
  answered,
  onOpenLead,
}: {
  pipeline: OfferPipeline | null;
  answered: boolean;
  onOpenLead: (lead: ColdPipelineLead) => void;
}) {
  const cold = pipeline?.lostLeads ?? null;
  const applies = pipeline?.coldRule?.applies ?? null;
  const afterDays = pipeline?.coldRule?.afterDays ?? null;
  return (
    <section>
      <SectionTitle count={applies === false && !cold?.count ? null : cold ? cold.count : null} right={cold?.valueUsd != null ? <span>Now worth {formatUsdAdaptive(cold.valueUsd)}</span> : null}>
        Lost leads
      </SectionTitle>
      <div className="k-card overflow-hidden">
        {!answered ? (
          <div className="p-4"><Shimmer className="h-16 w-full" /></div>
        ) : applies === false && !cold?.count ? (
          <EmptyNote>Connect your CRM and we spot the meetings that never happened.</EmptyNote>
        ) : !cold ? (
          <EmptyNote>Could not read who went cold. Retrying.</EmptyNote>
        ) : cold.leads.length === 0 ? (
          <EmptyNote>Nobody went cold. A meeting that never happens lands here.</EmptyNote>
        ) : (
          <>
            <table className="w-full table-fixed text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal sm:w-[55%]">Person</th>
                  <th className="k-label hidden px-3 py-2.5 text-left font-normal sm:table-cell">Stopped at</th>
                  <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">Worth now</th>
                </tr>
              </thead>
              <tbody>
                {cold.leads.map((l: ColdPipelineLead) => (
                  <tr key={l.leadId} {...openable(() => onOpenLead(l), leadName(l))}>
                    <PersonCell lead={l} extra={lostWhy(l)} />
                    <td className="hidden px-3 py-2 sm:table-cell">
                      <span className="k-fg2 block truncate">{l.step.label}</span>
                      <span className="k-fg3 block text-[12px] leading-4">{lostWhy(l)}</span>
                    </td>
                    <td className="px-3 py-2 pr-4 text-right tabular-nums">
                      <span className="block font-medium">{l.valueUsd != null ? formatUsdAdaptive(l.valueUsd) : "—"}</span>
                      {l.probabilityPct != null && <span className="k-fg3 block text-[12px]">{pct(l.probabilityPct)} chance</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {afterDays != null && (
              <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
                A lead counts as lost after {formatCount(afterDays)} days with no next step. It is valued at what it is worth now.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
