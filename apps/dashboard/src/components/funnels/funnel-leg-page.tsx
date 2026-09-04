"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions, LEADS_POLL_INTERVAL } from "@/lib/query-options";
import { getOfferFunnelRevenue, listLeadsPage, type Lead, type LeadStepName } from "@/lib/api";
import { bucketForStage } from "@/lib/leads-server-page";
import {
  normalizeSalesFunnelKey,
  salesFunnelByKey,
  type SalesFunnelKeyWire,
} from "@/lib/sales-funnels";
import { funnelLegs } from "@/lib/campaign-leg";
import { LEAD_FIELD_BY_STEP_KEY } from "@/lib/funnel-leg-rows";
import {
  LEG_BOARD_COLUMN_CAP,
  buildLegBoardCards,
  legBoardColumns,
  legBoardTotals,
  type LegBoardLead,
} from "@/lib/funnel-leg-board";
import {
  isWritableStage,
  leadFunnelStages,
  leadStepErrorMessage,
  trackedStages,
} from "@/lib/lead-funnel-stages";
import { useSetAnyLeadStepStatement } from "@/lib/use-lead-step-statements";
import { formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { isLearning } from "@/lib/learning-threshold";
import { LearningTag } from "@/components/learning-tag";
import { useScopePaused } from "@/lib/use-scope-paused";
import { FunnelLegMark } from "@/components/marks/funnel-leg-mark";
import { FunnelLegBoard } from "@/components/funnels/funnel-leg-board";
import { OutcomeTrendCard } from "@/components/revenue/outcome-trend-card";
import { ScoreCard } from "@/components/visibility/score-card";
import { Skeleton } from "@/components/skeleton";
import type { LeadOutcome, SignalSeries } from "@/lib/revenue-view";

/**
 * ONE ARROW of a sales funnel, as a page.
 *
 * The funnel's own page lists its arrows and says what each one converted. This is where
 * a person WORKS one: the arrows we do not automate are worked at the brand's side, and
 * until now the only way to record that a meeting happened was to open one lead at a time
 * and state it on its panel. The board here does it two columns at a time.
 *
 * It is reached from a row nobody sells us a campaign for, and from nowhere else. An arrow we run opens
 * its CAMPAIGN instead — that page has a budget, a status and settings this one has
 * nothing to say about, and a campaign is the thing being managed there.
 *
 * WHAT IT DOES NOT SHOW, and why:
 *
 *   - **No outreach activity chart.** Outreach is what a channel DOES; an arrow the brand
 *     works itself sends nothing, so a per-day send chart would be a flat zero over a
 *     step that is working fine.
 *   - **No return on spend.** A return is the whole funnel's — the money bought the whole funnel,
 *     not one rung of it — so charting it under one arrow's name states a wider scope's
 *     answer here. What this page charts is the arrow's OWN outcome over time.
 *   - **No cost per outcome from OUR spend.** The only per-step cost features-service
 *     serves divides the WHOLE funnel's committed spend, and on an arrow you work
 *     yourself you spent none of it. What the card states instead is what YOU said each
 *     crossing cost — see `stepCustomerCost`.
 */
/**
 * The dated ACTUAL series that counts the people who crossed each arrow.
 *
 * Keyed on the arrow's TO step, in the catalogue's own step vocabulary, and mapped onto
 * the series features-service already sends on the read this page makes — so charting the
 * arrow costs no second request.
 *
 * Three steps are deliberately ABSENT: a meeting ATTENDED, a signup and a filled form
 * carry no dated series on the wire. Their card states that rather than drawing an empty
 * chart, which reads as "nobody crossed" when what we mean is "we cannot chart this yet".
 */
const OUTCOME_SERIES_BY_STEP_KEY: Record<
  string,
  "clicked" | "repliedPositive" | "meetingsBooked" | "purchased"
> = {
  conversation: "repliedPositive",
  website_visit: "clicked",
  meeting_booked: "meetingsBooked",
  paid_client: "purchased",
};

export function FunnelLegPage() {
  const params = useParams<{
    orgId: string;
    brandId: string;
    offerId: string;
    funnelKey: string;
    legKey: string;
  }>();
  const router = useRouter();
  const orgId = params?.orgId ?? "";
  const brandId = params?.brandId ?? "";
  const offerId = params?.offerId ?? "";
  const rawKey = params?.funnelKey ? decodeURIComponent(params.funnelKey) : "";
  const legKey = params?.legKey ? decodeURIComponent(params.legKey) : "";
  const basePath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}`;
  const wanted = rawKey ? normalizeSalesFunnelKey(rawKey as SalesFunnelKeyWire) : null;

  // The arrow is named by the step it lands ON: within one funnel each step has exactly
  // one incoming arrow, so that key identifies it and reads as a word rather than as a
  // pair of tokens joined by a separator.
  const funnel = wanted ? salesFunnelByKey(wanted) : null;
  const leg = useMemo(
    () => funnelLegs(funnel).find((l) => l.toKey === legKey) ?? null,
    [funnel, legKey],
  );

  // Is this funnel STOPPED. When nothing sells it, no outcome can land, so a `Learning`
  // tag would promise a number that cannot arrive until the customer restarts something —
  // the honest word is `Paused`, which is what the funnel's own header already says. Same
  // rows the pill there is built from, so the two cannot disagree, and no extra request.
  const { paused: scopePaused } = useScopePaused(brandId, {
    offerId,
    funnelKey: rawKey || null,
    enabled: Boolean(brandId && offerId && rawKey),
  });

  // The SAME key the funnel page polls, so arriving here from it costs no request and
  // the two surfaces cannot state different counts for one step.
  const revenue = useAuthQuery(
    ["offerFunnelRevenue", brandId, offerId, wanted ?? "none"],
    () => getOfferFunnelRevenue(offerId, rawKey, brandId),
    { enabled: Boolean(brandId && offerId && rawKey), ...pollOptions },
  );
  const stages = useMemo(
    () => leadFunnelStages(rawKey ? (rawKey as SalesFunnelKeyWire) : null),
    [rawKey],
  );
  const columns = useMemo(
    () => (leg ? legBoardColumns(stages, leg.toIndex) : null),
    [stages, leg],
  );

  // ── The board's rows ─────────────────────────────────────────────────────────
  // ONE bounded read PER COLUMN, rather than the brand's whole lead population.
  //
  // This page used to read every lead the brand has — 44.5 MB over 12,945 rows on the
  // brand it was built against — to fill a board that has never drawn more than
  // LEG_BOARD_COLUMN_CAP cards a column. The population it actually needs is tiny: a
  // column is the people at ONE funnel step, and measured in production on that same
  // brand those buckets hold 21 (sales interest) and 66 (website visit). The cap was
  // already right; the READ was what had no bound.
  //
  // Each column asks for its own step's bucket, which is a question lead-service answers
  // directly — `LeadStageKey` and its bucket vocabulary are the same tokens.
  const fromBucket = columns ? bucketForStage(columns.from.stage) : null;
  const toBucket = columns ? bucketForStage(columns.to.stage) : null;
  const scope = useMemo(() => ({ brandId }), [brandId]);

  // The FROM column over-fetches, and the reason is that a lead in the from-bucket may
  // have CROSSED — `legBoardSideFor` then puts it in the other column, so a read of
  // exactly the cap could hand back a from column with fewer cards than it has people.
  // Twice the cap covers it comfortably at the sizes these buckets hold; a from column
  // that still under-fills states its true size regardless, because the "of N" beside it
  // is the producer's rung count rather than a count of what was fetched.
  const fromQ = useAuthQuery(
    ["leadsPage", `brand:${brandId}`, `leg-from:${fromBucket ?? "none"}`, "", 0],
    () =>
      listLeadsPage(scope, {
        view: "basic",
        bucket: fromBucket as string,
        sort: "activity",
        limit: String(LEG_BOARD_COLUMN_CAP * 2),
      },
      undefined,
      // A card here opens the lead on the LEADS page rather than a panel of its own, so
      // nothing on this board reads a person's campaigns — and the nesting is about four
      // times the row (6.2 KB against 1.6 KB measured in production).
      { includeCampaigns: false },
      ),
    { enabled: Boolean(brandId && fromBucket), refetchInterval: LEADS_POLL_INTERVAL },
  );
  const toQ = useAuthQuery(
    ["leadsPage", `brand:${brandId}`, `leg-to:${toBucket ?? "none"}`, "", 0],
    () =>
      listLeadsPage(scope, {
        view: "basic",
        bucket: toBucket as string,
        sort: "activity",
        limit: String(LEG_BOARD_COLUMN_CAP),
      },
      undefined,
      { includeCampaigns: false },
      ),
    { enabled: Boolean(brandId && toBucket), refetchInterval: LEADS_POLL_INTERVAL },
  );

  // What the producer says about this rung, off the read above. `undefined` while it
  // settles, null when it states no walk for this scope.
  const step = useMemo(() => {
    const wantedField = leg ? LEAD_FIELD_BY_STEP_KEY[leg.toKey] : null;
    if (!wantedField) return null;
    return revenue.data?.funnelSteps?.steps.find((s) => s.leadField === wantedField) ?? null;
  }, [revenue.data, leg]);

  // The arrow's own count over time. A RETURN is the whole funnel's — the money bought
  // every rung of it, not this one — so what is charted here is the outcome, which is
  // what this arrow actually moves.
  const outcomeSeries: SignalSeries | undefined = useMemo(() => {
    const field = leg ? OUTCOME_SERIES_BY_STEP_KEY[leg.toKey] : undefined;
    return field ? revenue.data?.[field] : undefined;
  }, [revenue.data, leg]);
  const chartable = Boolean(leg && OUTCOME_SERIES_BY_STEP_KEY[leg.toKey]);

  // Evidence per lead, off the same read. The board asks which side of the arrow a lead
  // is on, and the answer is whatever we already measured plus whatever anybody stated —
  // features-service folds both into these flags.
  const evidenceByLeadId = useMemo(() => {
    const m = new Map<string, LeadOutcome>();
    for (const l of revenue.data?.leadOutcomes ?? []) m.set(l.leadId, l);
    return m;
  }, [revenue.data]);

  const boardLeads: LegBoardLead[] = useMemo(() => {
    // The two reads overlap by construction (a lead that crossed is usually in both
    // buckets), so they are merged on the leads_campaigns row id — which is what a step
    // statement is written against, and what a duplicate card would write twice.
    const byId = new Map<string, Lead>();
    for (const row of toQ.data?.leads ?? []) byId.set(row.id, row);
    for (const row of fromQ.data?.leads ?? []) if (!byId.has(row.id)) byId.set(row.id, row);
    const rows = [...byId.values()];
    return rows.map((row) => {
      const full = row.lead;
      const name = `${full?.firstName ?? ""} ${full?.lastName ?? ""}`.trim() || row.email || "Lead";
      return {
        id: row.id,
        name,
        orgName: full?.organization?.name ?? null,
        orgDomain: full?.organization?.primaryDomain ?? null,
        contacted: row.contacted === true,
        reached: trackedStages(row.leadId ? evidenceByLeadId.get(row.leadId) : undefined),
      };
    });
  }, [fromQ.data, toQ.data, evidenceByLeadId]);

  const board = useMemo(() => {
    if (!columns) return null;
    const built = buildLegBoardCards({ leads: boardLeads, columns });
    // The counts beside each column head are the producer's bucket totals, not a count
    // of the rows fetched — which is the cap, and would report "60" on an arrow 9,166
    // people are standing at.
    return {
      ...built,
      totals: legBoardTotals({
        fromBucketTotal: fromQ.data?.total ?? null,
        toBucketTotal: toQ.data?.total ?? null,
        counted: built.totals,
      }),
    };
  }, [boardLeads, columns, fromQ.data, toQ.data]);

  const [crossError, setCrossError] = useState<string | null>(null);
  const cross = useSetAnyLeadStepStatement();
  const crossMutation = useMutation({
    mutationFn: (input: { leadRowId: string; costCents: number; valueCents?: number }) =>
      cross.mutateAsync({
        leadRowId: input.leadRowId,
        step: columns?.to.stage as LeadStepName,
        kind: "outcome",
        costCents: input.costCents,
        valueCents: input.valueCents,
      }),
    onMutate: () => setCrossError(null),
    // lead-service writes its refusal for a person to read; the raw thrown error is
    // the whole downstream body verbatim and never reaches a customer.
    onError: (err) => setCrossError(leadStepErrorMessage(err)),
  });

  // Reveal on SETTLE, never on success: a read that errors falls through to a stated
  // page rather than holding it in a skeleton forever.
  const pending =
    (revenue.isPending && !revenue.isError) ||
    (fromQ.isPending && !fromQ.isError) ||
    (toQ.isPending && !toQ.isError);

  if (!funnel || !leg || !columns) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <p className="text-sm text-gray-500">
          This funnel has no such step. Every arrow of a funnel is named for the step it
          lands on, and this one names none of them.
        </p>
      </div>
    );
  }

  // Only some steps take a statement at all: a positive REPLY is a fact about a message
  // and a website VISIT is measured by the delivery layer, so lead-service accepts
  // neither. Those arrows render read-only rather than offering a control that refuses.
  const writable = columns.to.stage != null && isWritableStage(columns.to.stage);
  const thin = isLearning(step?.recipientsReached ?? undefined);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <header className="flex min-w-0 items-center gap-3">
        <FunnelLegMark fromKey={leg.fromKey} toKey={leg.toKey} size="md" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold text-gray-800">{leg.label}</h1>
          <p className="truncate text-sm text-gray-500">
            One step of {funnel.name}. You work this one yourself.
          </p>
        </div>
      </header>

      {/* THE FIGURES FIRST, then the chart, then the board — the same order the campaign
          pages read in: what happened, how it has moved, then the thing you do about it. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* The rung this arrow converts FROM. Served on the step itself so a consumer
            renders "3 of 40" without looking the base up. */}
        <ScoreCard
          label={columns.from.label}
          value={
            step?.fromRecipientsReached == null
              ? "—"
              : step.fromRecipientsReached.toLocaleString("en-US")
          }
          subtitle={`People who reached the step this arrow starts from.`}
          pending={pending}
        />
        {/* The rung it converts TO, with the conversion rate INSIDE the card rather than
            beside it: they are one statement — this many crossed, out of that many. */}
        <ScoreCard
          label={columns.to.label}
          value={
            step?.recipientsReached == null
              ? "—"
              : step.recipientsReached.toLocaleString("en-US")
          }
          subtitle={
            thin || step?.conversionFromPreviousPct == null ? (
              `People who crossed this step of ${funnel.name}.`
            ) : (
              <>
                {step.conversionFromPreviousPct.toFixed(1)}% of{" "}
                {columns.from.label.toLowerCase()}
              </>
            )
          }
          action={thin ? <LearningTag paused={scopePaused} /> : undefined}
          pending={pending}
        />
        {/* What YOU said each crossing cost, averaged over the people who crossed —
            SERVED per rung (features-service v0.148.0), never divided here: a client-side
            ratio drifts from that service the moment either side changes. Null, and so a
            dash, when nobody has been asked yet: never a $0, which would say your work
            was free. */}
        <ScoreCard
          label={`Cost per ${columns.to.label.toLowerCase()}`}
          value={
            step?.customerCost?.costPerReachCents == null
              ? "—"
              : formatCentsAsUsdAdaptive(step.customerCost.costPerReachCents)
          }
          subtitle={
            step?.customerCost && step.customerCost.unstatedCount > 0 &&
            step.customerCost.statedCount > 0
              ? `Across the ${step.customerCost.statedCount.toLocaleString("en-US")} you have priced so far.`
              : "The average of what you state each of these costs you."
          }
          tooltip="Your own money, not ours: we record what you tell us this step cost, we never charge it, and it never reaches your billing."
          pending={pending}
        />
      </div>

      {/* The arrow's OWN outcome over time. Not the return: a return is the whole funnel's,
          and charting it under one arrow's name states a wider scope's answer here. */}
      {chartable ? (
        <OutcomeTrendCard
          series={outcomeSeries}
          label={columns.to.label}
          pending={pending}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
          <h3 className="font-medium text-gray-800">Outcome</h3>
          <p className="mt-2 text-sm text-gray-500">
            We hold no dated record of who crossed this step, so there is nothing to chart
            over time yet. The count above is what we can measure.
          </p>
        </div>
      )}

      {/* The board LAST: the figures above are the reading, this is where a person adds
          to it by saying who crossed. */}
      {/* `pending` alone decides the skeleton. `!board` used to share that test, which
          is the re-lock shape that turns a settled page into a permanent skeleton: a
          gate must trust the pending flag and render the absent case as itself. It is
          unreachable here (the early return above proves `columns`), so the honest
          branch for it is nothing at all, never a spinner that never stops. */}
      {pending ? (
        <Skeleton className="h-64 w-full" />
      ) : !board ? null : (
        <FunnelLegBoard
          columns={columns}
          cards={{ from: board.from, to: board.to }}
          totals={board.totals}
          // The last step of a funnel is the one that closes a deal, so it also asks
          // what the deal was worth.
          needsValue={columns.to.stage === "sale"}
          busy={crossMutation.isPending}
          writable={writable}
          error={crossError}
          // The lead's own panel lives on the LEADS page, so a card opens it there
          // rather than duplicating it here. Funnel-scoped (`funnels/<key>/leads`)
          // because that is the route this leg sits under -- `${basePath}/leads`
          // does not exist and 404'd. `?leadRowId=` is the deep-link seed that
          // page reads to open the panel on first paint.
          onOpen={(leadRowId) =>
            router.push(
              `${basePath}/funnels/${encodeURIComponent(rawKey)}/leads?leadRowId=${encodeURIComponent(leadRowId)}`,
            )
          }
          onCross={(leadRowId, input) => crossMutation.mutate({ leadRowId, ...input })}
        />
      )}
    </div>
  );
}