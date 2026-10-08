"use client";

import Link from "next/link";
import type { OfferOutcomeRow } from "@/lib/api";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { v2OfferHref } from "@/lib/v2/routes";
import { ExpectedLabel } from "@/components/v2/offer-sales-paths";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";

export const WORTH_EACH_TIP =
  "Expected, not measured yet. The chance one person at this step becomes a paying client, times what one client is worth to you.";

/**
 * What the offer's people are worth, step by step (owner 2026-10-08: Today is the ROI
 * page). One row per step features-service serves on `/offers/:offerId/outcomes`: the
 * people who reached it, what one of them is worth, the step's pipeline. The deepest
 * step reads first. Rows do not add up (a person who replied then booked is in both),
 * so no total is drawn. Nothing is multiplied or divided here.
 */
export function OfferOutcomesTable({
  orgId,
  brandId,
  offerId,
  rows,
  answered,
  failed,
}: {
  orgId: string;
  brandId: string;
  offerId: string | null;
  rows: readonly OfferOutcomeRow[] | null;
  answered: boolean;
  failed: boolean;
}) {
  // Served shallow to deep; the page reads from the step closest to a sale. A step the
  // producer does not count (a hand-off nobody measures) says nothing to the customer.
  const deepestFirst = rows ? [...rows].reverse().filter((r) => r.unmeasuredReason !== "step_not_counted") : [];
  return (
    <section>
      <SectionTitle right={<span>Since you started</span>}>Pipeline by step</SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Step</th>
                <th className="k-label px-3 py-2.5 text-right font-normal">People</th>
                <th className="k-label px-3 py-2.5 text-right font-normal">
                  <ExpectedLabel tip={WORTH_EACH_TIP}>Worth each</ExpectedLabel>
                </th>
                <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {!answered && !failed ? (
                [0, 1, 2].map((i) => (
                  <tr key={i} className="k-line-subtle border-b last:border-0">
                    <td colSpan={4} className="px-4 py-2">
                      <Shimmer className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : failed ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyNote>Could not read your pipeline. Retrying.</EmptyNote>
                  </td>
                </tr>
              ) : deepestFirst.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyNote>No step to show yet. Each step lands here once a campaign works it.</EmptyNote>
                  </td>
                </tr>
              ) : (
                deepestFirst.map((r) => <OutcomeLine key={r.step.key} row={r} />)
              )}
            </tbody>
          </table>
        </div>
        <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
          Each value comes from your rate at each step and what one client is worth.{" "}
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

function OutcomeLine({ row }: { row: OfferOutcomeRow }) {
  const dash = <span className="k-fg4">—</span>;
  return (
    <tr className="k-row k-line-subtle border-b last:border-0">
      <td className="px-3 py-2 pl-4 font-medium">{row.step.label}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {row.recipientsReached != null ? formatCount(row.recipientsReached) : dash}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{row.valuePerOutcomeUsd != null ? formatUsdAdaptive(row.valuePerOutcomeUsd) : dash}</td>
      <td className="px-3 py-2 pr-4 text-right font-medium tabular-nums">{row.valueUsd != null ? formatUsdAdaptive(row.valueUsd) : dash}</td>
    </tr>
  );
}
