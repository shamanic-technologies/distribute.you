"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions, POLL_INTERVAL } from "@/lib/query-options";
import { getOfferFunnelRevenue, listBrandLeads, type LeadStepName } from "@/lib/api";
import {
  normalizeSalesFunnelKey,
  salesFunnelByKey,
  type SalesFunnelKeyWire,
} from "@/lib/sales-funnels";
import { funnelLegs } from "@/lib/campaign-leg";
import { LEAD_FIELD_BY_STEP_KEY } from "@/lib/funnel-leg-rows";
import {
  buildLegBoardCards,
  legBoardColumns,
  type LegBoardLead,
} from "@/lib/funnel-leg-board";
import {
  isWritableStage,
  leadFunnelStages,
  leadStepErrorMessage,
  trackedStages,
} from "@/lib/lead-funnel-stages";
import { useSetAnyLeadStepStatement } from "@/lib/use-lead-step-statements";
import { isLearning } from "@/lib/learning-threshold";
import { LearningTag } from "@/components/learning-tag";
import { FunnelLegMark } from "@/components/marks/funnel-leg-mark";
import { FunnelLegBoard } from "@/components/funnels/funnel-leg-board";
import { RoiTrendCard } from "@/components/revenue/roi-trend-card";
import { ScoreCard } from "@/components/visibility/score-card";
import { Skeleton } from "@/components/skeleton";
import type { ConversionLead } from "@/lib/revenue-view";

/**
 * ONE ARROW of a sales funnel, as a page.
 *
 * The funnel's own page lists its arrows and says what each one converted. This is where
 * a person WORKS one: the arrows we do not automate are worked at the brand's side, and
 * until now the only way to record that a meeting happened was to open one lead at a time
 * and state it on its panel. The board here does it two columns at a time.
 *
 * It is reached from a `Done by you` row, and from nowhere else. An arrow we run opens
 * its CAMPAIGN instead — that page has a budget, a status and settings this one has
 * nothing to say about, and a campaign is the thing being managed there.
 *
 * WHAT IT DOES NOT SHOW, and why:
 *
 *   - **No outreach activity chart.** Outreach is what a channel DOES; an arrow the brand
 *     works itself sends nothing, so a per-day send chart would be a flat zero over a
 *     step that is working fine.
 *   - **No cost per outcome.** The only per-step cost features-service serves divides the
 *     WHOLE funnel's committed spend, and on an arrow you work yourself you spent none of
 *     it. Printing it would put our money against your work.
 *
 * The return chart IS the funnel's, and says so: an arrow has no return of its own — it
 * converts people, and the money is the whole funnel's.
 */
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

  // The SAME key the funnel page polls, so arriving here from it costs no request and
  // the two surfaces cannot state different counts for one step.
  const revenue = useAuthQuery(
    ["offerFunnelRevenue", brandId, offerId, wanted ?? "none"],
    () => getOfferFunnelRevenue(offerId, rawKey, brandId),
    { enabled: Boolean(brandId && offerId && rawKey), ...pollOptions },
  );
  // And the SAME key the Leads page polls. The rows are what a statement is written
  // against — the revenue join carries a lead id, not the leads_campaigns row id.
  const leadsQ = useAuthQuery(["brandLeads", brandId], () => listBrandLeads(brandId), {
    enabled: Boolean(brandId),
    refetchInterval: POLL_INTERVAL,
  });

  const stages = useMemo(
    () => leadFunnelStages(rawKey ? (rawKey as SalesFunnelKeyWire) : null),
    [rawKey],
  );
  const columns = useMemo(
    () => (leg ? legBoardColumns(stages, leg.toIndex) : null),
    [stages, leg],
  );

  // What the producer says about this rung, off the read above. `undefined` while it
  // settles, null when it states no walk for this scope.
  const step = useMemo(() => {
    const wantedField = leg ? LEAD_FIELD_BY_STEP_KEY[leg.toKey] : null;
    if (!wantedField) return null;
    return revenue.data?.funnelSteps?.steps.find((s) => s.leadField === wantedField) ?? null;
  }, [revenue.data, leg]);

  // Evidence per lead, off the same read. The board asks which side of the arrow a lead
  // is on, and the answer is whatever we already measured plus whatever anybody stated —
  // features-service folds both into these flags.
  const evidenceByLeadId = useMemo(() => {
    const m = new Map<string, ConversionLead>();
    for (const l of revenue.data?.leads ?? []) m.set(l.leadId, l);
    return m;
  }, [revenue.data]);

  const boardLeads: LegBoardLead[] = useMemo(() => {
    const rows = leadsQ.data?.leads ?? [];
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
  }, [leadsQ.data, evidenceByLeadId]);

  const board = useMemo(
    () => (columns ? buildLegBoardCards({ leads: boardLeads, columns }) : null),
    [boardLeads, columns],
  );

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
    (revenue.isPending && !revenue.isError) || (leadsQ.isPending && !leadsQ.isError);

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

      {/* The board FIRST: this page exists so a person can say who crossed this step,
          and everything under it is the reading of what they have said so far. */}
      {pending || !board ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <FunnelLegBoard
          columns={columns}
          cards={{ from: board.from, to: board.to }}
          totals={board.totals}
          // The last step of a funnel is the one that closes a deal, so it also asks
          // what the deal was worth.
          needsValue={columns.to.stage === "sale"}
          busy={crossMutation.isPending}
          error={
            writable
              ? crossError
              : "This step is measured for you, so it takes no statement by hand."
          }
          onOpen={(leadRowId) =>
            router.push(`${basePath}/leads?leadRowId=${encodeURIComponent(leadRowId)}`)
          }
          onCross={
            writable
              ? (leadRowId, input) => crossMutation.mutate({ leadRowId, ...input })
              : () => setCrossError("This step takes no statement by hand.")
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* The rung's own two figures. No cost per outcome: the only one served divides
            the whole funnel's spend, and you spent none of it on this arrow. */}
        <ScoreCard
          label={columns.to.label}
          value={
            step?.recipientsReached == null
              ? "—"
              : step.recipientsReached.toLocaleString("en-US")
          }
          subtitle={`People who reached this step of ${funnel.name}.`}
          pending={pending}
        />
        <ScoreCard
          label="Conversion"
          // The tag replaces the VALUE rather than sitting beside it: a figure printed
          // next to a caveat reads as a price with a footnote, and the point is that
          // there is no figure yet.
          value={
            thin || step?.conversionFromPreviousPct == null
              ? "—"
              : `${step.conversionFromPreviousPct.toFixed(1)}%`
          }
          action={thin ? <LearningTag /> : undefined}
          subtitle={`Of the people who reached ${columns.from.label.toLowerCase()}.`}
          pending={pending}
        />
      </div>

      {/* The FUNNEL's return, and it says so. An arrow has none of its own — it converts
          people, and the money belongs to the whole funnel. */}
      <RoiTrendCard history={revenue.data?.roiHistory} pending={pending} />
    </div>
  );
}
