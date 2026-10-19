"use client";

import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getConversationCounts, getLeadBucketCounts } from "@/lib/api";
import { formatCentsAsUsdAdaptive, formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { shownFigure, shownReturn } from "@/lib/maturity";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { useStatBasis } from "@/lib/use-stat-basis";
import { isProactiveFrom, sameLegKey } from "@/lib/outbound-leg-key";
import { legFor, stepPluralLabel, type LegDef } from "@/lib/legs";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import type { SalesFunnelUnit } from "@/lib/sales-funnel-campaigns";
import type { V2Campaign } from "@/components/v2/use-campaigns";
import { LEG_STEPS, StepBar, useCampaignWindow } from "@/components/v2/offer-channel-page";
import { ChannelChip } from "@/components/v2/offer-sales-paths";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { CostValue, RoiLabel, RoiValue } from "@/components/v2/roi-label";
import { costToShowCents, roiToShow } from "@/lib/expected-return";
import { formatRatePct } from "@/lib/pipe-stats";
import { SpendChartsBlock, type SpendChartState } from "@/components/v2/spend-charts";

/**
 * A sales-funnel campaign's PIPES, one block each (owner 2026-10-11: "up to 3 columns on
 * desktop, each with its information, stats, chart, table, generic to each pipe"). Every
 * block reads the same three columns: what it did and cost (figures), what it did per day
 * (a served daily series), and its steps as bars. Every figure is served (features-service's
 * campaign window and the campaign row's revenue group, lead-service's counts); nothing is
 * summed or divided here.
 *
 * Every pipe gets a block whatever its channel (owner 2026-10-12: the dashboard renders every
 * campaign and every pipe the same way): a proactive pipe reads the proactive block, its cells
 * named from the pipe's own steps; a pipe that answers reads the conversation block. Only a pipe
 * whose leg is unknown to the catalogue gets none.
 */

/** What kind of block a pipe gets, from its leg alone (never its channel). Null = leg unknown. */
export function pipeKind(leg: Pick<LegDef, "fromKey"> | null): "proactive" | "conversation" | null {
  if (!leg) return null;
  return isProactiveFrom(leg.fromKey) ? "proactive" : "conversation";
}

export function PipeSections({
  brandId,
  units,
  campaignById,
  spendChart,
}: {
  brandId: string;
  units: SalesFunnelUnit[];
  campaignById: Map<string, V2Campaign>;
  /** The pipe's served spend chart (features-service, one per pipe), drawn under its three columns. */
  spendChart?: (campaignId: string) => SpendChartState;
}) {
  const catalogue = useLegCatalogue();
  const shown = units.flatMap((u) => {
    const campaign = campaignById.get(u.campaignId) ?? null;
    const leg = campaign?.leg ?? legFor(catalogue, u.legKey);
    const kind = pipeKind(leg);
    return kind && leg ? [{ u, campaign, leg, kind }] : [];
  });
  if (shown.length === 0) return null;
  return (
    <div className="space-y-8">
      {shown.map(({ u, campaign, leg, kind }) => (
        <PipeSection key={u.campaignId} unit={u} campaign={campaign} leg={leg} below={spendChart ? <SpendChartsBlock {...spendChart(u.campaignId)} /> : null}>
          {kind === "proactive" ? (
            <ProactivePipe brandId={brandId} unit={u} campaign={campaign} leg={leg} />
          ) : (
            <ConversationPipe brandId={brandId} unit={u} campaign={campaign} leg={leg} />
          )}
        </PipeSection>
      ))}
    </div>
  );
}

/** The block's head: the channel doing it and what it brings in, then a link to the pipe's own page. */
function PipeSection({
  unit,
  campaign,
  leg,
  below,
  children,
}: {
  unit: SalesFunnelUnit;
  campaign: V2Campaign | null;
  leg: LegDef;
  below?: React.ReactNode;
  children: React.ReactNode;
}) {
  const channels = useAcquisitionChannels();
  const def = channels.find((d) => d.featureSlug === unit.featureSlug);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 whitespace-nowrap">
        <ChannelChip name={def?.name ?? unit.featureSlug} def={def} notRun={false} />
        <span className="k-fg3 text-[13px]">brings in</span>
        <h2 className="text-[14px] font-medium">{leg.toLabel}</h2>
        {campaign?.href && (
          <Link href={campaign.href} className="k-fg3 ml-auto text-[12px] hover:text-[var(--fg-1)]">
            Details →
          </Link>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">{children}</div>
      {below && <div className="mt-3">{below}</div>}
    </section>
  );
}

/** A column card: a `k-label` title with an optional note right, then its body. */
function Column({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="k-label">{title}</span>
        {note != null && <span className="k-fg3 truncate text-[12px]">{note}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** One figure in a column's 2-wide grid: label, value, an optional line under it. */
function Cell({ label, children, sub }: { label: React.ReactNode; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="k-label truncate">{label}</div>
      <div className="mt-1 text-[18px] font-medium leading-6 tracking-[-0.01em] tabular-nums">{children}</div>
      {sub != null && <div className="k-fg3 mt-0.5 text-[12px] leading-4">{sub}</div>}
    </div>
  );
}

const DASH = <span className="k-fg4">—</span>;
const unitWord = (n: number | null | undefined, one: string, many: string) => <span className="k-fg2 ml-1 text-[12px] font-normal">{n === 1 ? one : many}</span>;
const count = (n: number | null | undefined, one: string, many: string) => (n == null ? DASH : <>{formatCount(n)}{unitWord(n, one, many)}</>);
/** A served percent: one decimal, a non-zero share that rounds to 0.0% reads "<0.1%". */
// Owner rule (#4756): a whole percent, a decimal only below 1%. One shared formatter.
const pct = formatRatePct;

/**
 * The pipe's return and money, off the campaign row's own served revenue group. The cost cell
 * prices the pipe's own outcome (`per`, named by its `toLabel`); null = no cost served for it.
 */
function MoneyCells({ campaign, per, toLabel }: { campaign: V2Campaign | null; per: "reply" | "visit" | null; toLabel: string }) {
  const { basis } = useStatBasis();
  const g = campaign?.row.revenue ?? null;
  const roi = shownReturn(g?.economicsMaturity, basis);
  const cost = shownFigure(g?.outcomesMaturity, (h) => (per === "reply" ? h.cpprCents : h.cpcCents), basis);
  // Measured first: a Learning figure greyed with the served expected one beside it (owner 2026-10-19).
  const costShown = costToShowCents(cost, g?.expectedReturn, per === "reply" ? "conversation" : "website_visit");
  return (
    <>
      <Cell label={<RoiLabel />}>{!campaign ? DASH : <RoiValue roi={roiToShow(roi, g?.expectedReturn)} learning={roi.learning} />}</Cell>
      <Cell label="$ Value">{g?.totalPipelineUsd != null ? formatUsdAdaptive(g.totalPipelineUsd) : DASH}</Cell>
      {per && (
        <Cell label={`$ / ${toLabel}`}>
          <CostValue cost={costShown} learning={cost.learning} />
        </Cell>
      )}
    </>
  );
}

/** Spent (billed) with the follow-ups still reserved under it, as the campaign window serves them. */
function SpentCell({ win }: { win: ReturnType<typeof useCampaignWindow> }) {
  const spend = win.data?.spend ?? null;
  const provisioned = spend?.provisionedSpentCents ?? null;
  return (
    <Cell label="$ Spent" sub={provisioned != null && provisioned > 0 ? `+${formatCentsAsUsdAdaptive(provisioned)} for follow-ups` : undefined}>
      {win.pending ? <Shimmer className="h-6 w-14" /> : spend ? formatCentsAsUsdAdaptive(spend.actualSpentCents) : DASH}
    </Cell>
  );
}

/**
 * A served daily series as bars (one per day, zero-filled by the producer), its total in the
 * title's note and the first and last day under it. Draws what it is handed.
 */
function DailyBars({ label, total, days, format = formatCount }: { label: string; total: number | null; days: { date: string; value: number }[] | null; format?: (n: number) => string }) {
  const max = days ? Math.max(1, ...days.map((d) => d.value)) : 1;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
        <span className="k-fg2">{label}</span>
        <span className="font-medium tabular-nums">{total == null ? DASH : format(total)}</span>
      </div>
      {!days || days.length === 0 ? (
        <div className="k-inset h-[64px] rounded-[6px]" />
      ) : (
        <>
          <div className="flex h-[64px] items-end gap-px" aria-hidden="true">
            {days.map((d) => (
              <span
                key={d.date}
                title={`${d.date}: ${format(d.value)}`}
                className="min-w-0 flex-1 rounded-t-[2px]"
                style={{ height: d.value > 0 ? `${Math.max(4, (d.value / max) * 100)}%` : "2px", background: d.value > 0 ? "var(--accent)" : "var(--data-track)" }}
              />
            ))}
          </div>
          <div className="k-mono k-fg3 mt-1 flex justify-between text-[11px]">
            <span>{days[0].date}</span>
            <span>{days[days.length - 1].date}</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Any proactive pipe, whatever its channel: who it reached and what came back (people,
 * lead-service), its spend and its outcome per day (features-service's campaign window), its
 * steps as bars, every label the pipe's own step. Where the window serves messages SENT for the
 * pipe (a sending channel: cold email today), its Queued, Sent and Delivered join the figures,
 * the per-day column and the bars; a channel that sent none states none.
 */
function ProactivePipe({ brandId, unit, campaign, leg }: { brandId: string; unit: SalesFunnelUnit; campaign: V2Campaign | null; leg: LegDef }) {
  const steps = LEG_STEPS.find((l) => sameLegKey(l.legKey, unit.legKey)) ?? null;
  const q = useAuthQuery(["leadBucketCounts", `campaign:${unit.campaignId}`, ""], () => getLeadBucketCounts({ campaignId: unit.campaignId }, {}), pollOptions);
  const counts = q.data?.counts ?? null;
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const win = useCampaignWindow(brandId, unit.campaignId, unit.featureSlug);
  const queued = win.data?.queuedEmails ?? null;
  // Served messages for this pipe: present only when it sent or holds some (never a row of zeros).
  const served = win.data?.emails ?? null;
  const emails = served && (served.sent > 0 || (queued ?? 0) > 0) ? served : null;
  const spend = win.data?.spend ?? null;
  const replyLed = steps?.bucket === "positive_reply";
  // Count headings read the catalogue's served plural (features-service `pluralLabel`).
  const toPlural = stepPluralLabel(useLegCatalogue(), leg.toKey, leg.toLabel);
  // The campaign row's own served rates (features-service, distinct people reached).
  const rates = campaign?.row.revenue ?? null;
  const outcomes = steps && counts ? counts[steps.bucket] : null;
  const outcomeDaily = !steps ? null : replyLed ? win.data?.recipientsRepliesPositive ?? null : win.data?.recipientsClicked ?? null;
  const scale = Math.max(queued ?? 0, emails?.sent ?? 0, emails?.delivered ?? 0, counts?.contacted ?? 0, outcomes ?? 0);
  const people = (n: number | null | undefined) => (!settled ? <Shimmer className="h-6 w-14" /> : count(n, "person", "people"));
  const mails = (n: number | null | undefined) => (win.pending ? <Shimmer className="h-6 w-14" /> : count(n, "email", "emails"));

  return (
    <>
      <Column title="Figures" note="Since it started">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Cell label="Contacted">{people(counts?.contacted)}</Cell>
          <Cell
            label={outcomes === 1 ? leg.toLabel : toPlural}
            sub={replyLed && rates?.positiveReplyRatePct != null ? `${pct(rates.positiveReplyRatePct)} of people contacted` : undefined}
          >
            {steps ? people(outcomes) : DASH}
          </Cell>
          {emails && (
            <>
              <Cell label="Sent">{mails(emails.sent)}</Cell>
              <Cell label="Delivered" sub={emails.deliveryRatePct != null ? `${pct(emails.deliveryRatePct)} of sent` : undefined}>
                {mails(emails.delivered)}
              </Cell>
            </>
          )}
          <Cell label="Reply rate" sub="Of people contacted">
            {rates?.replyRatePct != null ? pct(rates.replyRatePct) : DASH}
          </Cell>
          <SpentCell win={win} />
          <MoneyCells campaign={campaign} per={!steps ? null : replyLed ? "reply" : "visit"} toLabel={leg.toLabel} />
        </div>
      </Column>
      <Column title="Per day">
        {win.pending ? (
          <Shimmer className="h-[180px] w-full rounded-[8px]" />
        ) : !win.data ? (
          <EmptyNote>Could not read this campaign&apos;s days. Retrying.</EmptyNote>
        ) : (
          <div className="space-y-5">
            {emails ? (
              <DailyBars label="Emails sent" total={emails.sent} days={emails.daily.map((d) => ({ date: d.date, value: d.sent }))} />
            ) : (
              <DailyBars
                label="$ Spent"
                total={spend?.actualSpentCents ?? null}
                days={spend ? spend.daily.map((d) => ({ date: d.date, value: d.actualSpentCents })) : null}
                format={formatCentsAsUsdAdaptive}
              />
            )}
            {outcomeDaily && (
              <DailyBars label={toPlural} total={outcomeDaily.total} days={outcomeDaily.daily.map((d) => ({ date: d.date, value: d.count }))} />
            )}
          </div>
        )}
      </Column>
      <Column title="Steps" note={emails ? "Emails, then people" : "People"}>
        {!settled || win.pending ? (
          <Shimmer className="h-[180px] w-full rounded-[8px]" />
        ) : (
          <div className="flex items-end gap-3">
            {emails ? (
              <>
                <StepBar label="Queued" count={queued} of={scale} />
                <StepBar label="Sent" count={emails.sent} of={scale} />
                <StepBar label="Delivered" count={emails.delivered} of={scale} />
              </>
            ) : (
              <StepBar label="Contacted" count={counts?.contacted ?? null} of={scale} />
            )}
            <StepBar label={leg.toLabel} count={outcomes} of={scale} />
          </div>
        )}
      </Column>
    </>
  );
}

/**
 * A pipe that ANSWERS (AI Meeting Booking, AI Instant Call: it starts on a step and sends no
 * cold email): the people handed to it and where they stand (lead-service's conversation
 * counts, a partition: handed = ongoing + done + dropped), its spend per day, its steps.
 */
function ConversationPipe({ brandId, unit, campaign, leg }: { brandId: string; unit: SalesFunnelUnit; campaign: V2Campaign | null; leg: LegDef }) {
  const q = useAuthQuery(["conversationCounts", unit.campaignId], () => getConversationCounts(unit.campaignId), pollOptions);
  const conv = q.data ?? null;
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const win = useCampaignWindow(brandId, unit.campaignId, unit.featureSlug);
  const from = leg.fromLabel ?? "Positive reply";
  const catalogue = useLegCatalogue();
  const fromPlural = stepPluralLabel(catalogue, leg.fromKey, from);
  const toPlural = stepPluralLabel(catalogue, leg.toKey, leg.toLabel);
  const people = (n: number | null | undefined) => (!settled ? <Shimmer className="h-6 w-14" /> : count(n, "person", "people"));
  const spend = win.data?.spend ?? null;

  return (
    <>
      <Column title="Figures" note="Since it started">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Cell label={fromPlural}>{people(conv?.handed)}</Cell>
          <Cell label={toPlural}>{people(conv?.meetingsBooked)}</Cell>
          <Cell label="Ongoing">{people(conv?.ongoing)}</Cell>
          <Cell label="Dropped">{people(conv?.dropped)}</Cell>
          <SpentCell win={win} />
          <MoneyCells campaign={campaign} per={null} toLabel={leg.toLabel} />
        </div>
      </Column>
      <Column title="Per day">
        {win.pending ? (
          <Shimmer className="h-[96px] w-full rounded-[8px]" />
        ) : !spend ? (
          <EmptyNote>Could not read this campaign&apos;s days. Retrying.</EmptyNote>
        ) : (
          <DailyBars
            label="$ Spent"
            total={spend.actualSpentCents}
            days={spend.daily.map((d) => ({ date: d.date, value: d.actualSpentCents }))}
            format={formatCentsAsUsdAdaptive}
          />
        )}
      </Column>
      <Column title="Steps" note="People">
        {!settled ? (
          <Shimmer className="h-[180px] w-full rounded-[8px]" />
        ) : !conv ? (
          <EmptyNote>Could not read this campaign&apos;s conversations. Retrying.</EmptyNote>
        ) : (
          <div className="flex items-end gap-3">
            <StepBar label={fromPlural} count={conv.handed} of={conv.handed} />
            <StepBar label="Ongoing" count={conv.ongoing} of={conv.handed} />
            <StepBar label={leg.toLabel} count={conv.meetingsBooked} of={conv.handed} />
          </div>
        )}
      </Column>
    </>
  );
}
