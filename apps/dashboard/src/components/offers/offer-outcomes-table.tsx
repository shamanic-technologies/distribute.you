"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions, POLL_INTERVAL } from "@/lib/query-options";
import { getOfferOutcomes, listCampaignsByBrand } from "@/lib/api";
import {
  legCampaignId,
  pluralStepLabel,
  unmeasuredReasonWords,
  type OfferOutcomeLeg,
  type OutcomeFigures,
} from "@/lib/offer-outcomes";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { isLearning } from "@/lib/learning-threshold";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { isActiveStatus, NumericHead } from "@/components/campaigns/campaigns-table";
import { FunnelStepMark } from "@/components/marks/funnel-step-mark";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { LearningTag } from "@/components/learning-tag";
import { Skeleton } from "@/components/skeleton";

/**
 * What an OFFER buys, one row per OUTCOME, and under each the leg × channel rows
 * serving it in parallel.
 *
 * Every figure is features-service's (`GET /offers/:offerId/outcomes`, NET basis): this
 * component divides nothing, sums nothing and ranks nothing, and it keeps the producer's
 * order. Rows are NOT additive — a lead reached through two channels counts once in the
 * outcome row and once in each leg row — so there is no total row, deliberately.
 *
 * A null figure reads `—` with the producer's reason stated in words under the row's
 * name: "we could not measure this" and "this was zero" are different statements, and a
 * measured zero is printed as one. A RATIO (ROI, $ / outcome) under ten outcomes reads
 * `Learning`, the same bar every other surface holds; the TOTALS never do.
 */
const INFO = {
  roi: "What these outcomes are worth, divided by what was spent to get them. Worked out from the conversion rates and lifetime revenue set in Offer Settings.",
  value: "What these outcomes are worth, valued with the conversion rates and lifetime revenue set in Offer Settings. A projection, not money collected.",
  spent: "What has been spent to get these outcomes so far, net of any discount.",
  count: "How many people reached this outcome. Counted once per person.",
  cost: "What has been spent, divided by how many people reached this outcome.",
} as const;

function fmtUsd(usd: number | null): string {
  return usd == null ? "—" : formatUsdAdaptive(usd);
}

/** A ratio cell: the figure, `Learning` while it rests on too few outcomes, or `—`. */
function RatioCell({
  value,
  count,
  render,
  good = false,
}: {
  value: number | null;
  count: number | null;
  render: (v: number) => string;
  good?: boolean;
}) {
  if (value == null) return <span className="text-gray-400">—</span>;
  if (isLearning(count)) return <LearningTag withInfo={false} />;
  return (
    <span className={`tabular-nums ${good ? "text-green-600" : "text-gray-900"}`}>
      {render(value)}
    </span>
  );
}

function FigureCells({ f, primary }: { f: OutcomeFigures; primary: boolean }) {
  const weight = primary ? "font-semibold" : "";
  return (
    <>
      <td className={`px-4 py-3 text-right ${weight}`}>
        <RatioCell
          value={f.roiMultiple}
          count={f.recipientsReached}
          render={(v) => formatRoi(v)}
          good={roiIsGood(f.roiMultiple)}
        />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">
        {fmtUsd(f.valueUsd)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">
        {fmtUsd(f.spentUsd)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">
        {f.recipientsReached == null ? "—" : f.recipientsReached.toLocaleString("en-US")}
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <RatioCell
          value={f.costPerOutcomeUsd}
          count={f.recipientsReached}
          render={(v) => formatUsdAdaptive(v)}
        />
      </td>
    </>
  );
}

/** Below `md` the folded figures ride under the name, so a phone still reads them. */
function MobileLine({ f, label }: { f: OutcomeFigures; label: string }) {
  if (f.recipientsReached == null) return null;
  return (
    <span className="mt-0.5 block text-xs text-gray-500 md:hidden">
      {f.recipientsReached.toLocaleString("en-US")} {pluralStepLabel(label).toLowerCase()} ·{" "}
      {fmtUsd(f.spentUsd)} spent
    </span>
  );
}

function Reason({ reason }: { reason: string | null }) {
  const words = unmeasuredReasonWords(reason);
  if (!words) return null;
  return <span className="mt-0.5 block text-xs text-gray-500">{words}</span>;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function OfferOutcomesTable({
  brandId,
  offerId,
  basePath,
}: {
  brandId: string;
  offerId: string;
  /** `/orgs/:orgId/brands/:brandId/offers/:offerId` — a leg row opens its campaign under it. */
  basePath: string;
}) {
  const outcomesQ = useAuthQuery(
    ["offerOutcomes", brandId, offerId],
    () => getOfferOutcomes(offerId, brandId),
    { enabled: Boolean(brandId && offerId), ...pollOptions },
  );
  // Only to know which campaign a leg row opens. Byte-equal to the key the Campaigns
  // table polls, so it costs no request.
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), {
    refetchInterval: POLL_INTERVAL,
  });
  const channels = useAcquisitionChannels();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Reveal on SETTLE: a failed read states it, never an eternal skeleton.
  const pending = outcomesQ.isPending && !outcomesQ.isError;
  const data = outcomesQ.data;
  const campaigns = campaignsQ.data?.campaigns;

  const legHref = (leg: OfferOutcomeLeg): string | null => {
    const id = legCampaignId(leg.campaignIds, campaigns, isActiveStatus);
    return id ? `${basePath}/campaigns/${id}` : null;
  };

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full table-fixed text-sm md:table-auto md:min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-[70%] md:w-auto">Outcome</th>
              <th className="px-4 py-3 text-right w-[30%] md:w-auto">
                <NumericHead label="ROI" tip={INFO.roi} />
              </th>
              <th className="px-4 py-3 text-right hidden md:table-cell">
                <NumericHead label="$ Value" tip={INFO.value} />
              </th>
              <th className="px-4 py-3 text-right hidden md:table-cell">
                <NumericHead label="$ Spent" tip={INFO.spent} />
              </th>
              <th className="px-4 py-3 text-right hidden md:table-cell">
                <NumericHead label="# Outcomes" tip={INFO.count} />
              </th>
              <th className="px-4 py-3 text-right hidden md:table-cell">
                <NumericHead label="$ / Outcome" tip={INFO.cost} />
              </th>
            </tr>
          </thead>
          <tbody>
            {pending ? (
              [0, 1].map((i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-40" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="ml-auto h-4 w-12" />
                  </td>
                  {[0, 1, 2, 3].map((j) => (
                    <td key={j} className="px-4 py-3 hidden md:table-cell">
                      <Skeleton className="ml-auto h-4 w-14" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !data ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  Couldn&apos;t read this offer&apos;s outcomes. It will retry on its own.
                </td>
              </tr>
            ) : data.outcomes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  No outcome yet: none of our channels is working this offer.
                </td>
              </tr>
            ) : (
              data.outcomes.map((row) => {
                const isOpen = open.has(row.step.key);
                const expandable = row.legs.length > 0;
                return (
                  <Fragment key={row.step.key}>
                    <tr
                      className={`border-t border-gray-100 ${expandable ? "cursor-pointer transition hover:bg-gray-50" : ""}`}
                      onClick={expandable ? () => toggle(row.step.key) : undefined}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-expanded={expandable ? isOpen : undefined}
                          disabled={!expandable}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (expandable) toggle(row.step.key);
                          }}
                          className="flex w-full min-w-0 items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded"
                        >
                          {expandable && <Chevron open={isOpen} />}
                          <FunnelStepMark stepKey={row.step.key} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-900">
                              {pluralStepLabel(row.step.label)}
                            </span>
                            <MobileLine f={row} label={row.step.label} />
                            <Reason reason={row.unmeasuredReason} />
                          </span>
                        </button>
                      </td>
                      <FigureCells f={row} primary />
                    </tr>
                    {isOpen &&
                      row.legs.map((leg) => {
                        const def = acquisitionChannelForFeatureSlug(leg.featureSlug, channels);
                        const href = legHref(leg);
                        const name = (
                          <span className="block truncate text-gray-800">{leg.channelName}</span>
                        );
                        return (
                          <tr key={`${leg.legKey}|${leg.featureSlug}`} className="border-t border-gray-100 bg-gray-50">
                            <td className="py-2.5 pl-12 pr-4">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 text-gray-400" aria-hidden="true">
                                  ←
                                </span>
                                {def && <AcquisitionChannelMark def={def} size="xs" />}
                                <span className="min-w-0">
                                  {href ? (
                                    <Link href={href} className="block truncate text-gray-800 hover:text-brand-600">
                                      {leg.channelName}
                                    </Link>
                                  ) : (
                                    name
                                  )}
                                  {leg.fromStep && (
                                    <span className="block truncate text-xs text-gray-500">
                                      from {leg.fromStep.label.toLowerCase()}
                                    </span>
                                  )}
                                  <MobileLine f={leg} label={row.step.label} />
                                  <Reason reason={leg.unmeasuredReason} />
                                </span>
                              </div>
                            </td>
                            <FigureCells f={leg} primary={false} />
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {data && data.outcomes.length > 0 && (
        <p className="text-xs text-gray-500">
          Rows don&apos;t add up: a person reached through two channels counts once in each.
          {data.unattributedCampaignIds.length > 0 &&
            ` ${data.unattributedCampaignIds.length} campaign${
              data.unattributedCampaignIds.length === 1 ? " states" : "s state"
            } no step, so ${data.unattributedCampaignIds.length === 1 ? "it is" : "they are"} in no row.`}
        </p>
      )}
    </div>
  );
}
