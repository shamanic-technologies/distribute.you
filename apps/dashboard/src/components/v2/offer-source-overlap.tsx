"use client";

import { formatCount } from "@/lib/format-number";
import { formatRatePct } from "@/lib/brand-conversion-rates";
import { shownFigure } from "@/lib/maturity";
import { useStatBasis } from "@/lib/use-stat-basis";
import type { SalesPathSourceCampaign, SourceOverlap } from "@/lib/offer-sales-paths";
import { bucketLabel, orderedBuckets, sourceLeadRows } from "@/lib/source-overlap";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { ProviderLogo } from "@/components/provider-logo";

const DASH = <span className="k-fg4">—</span>;

/**
 * The Sourcing page's "Found by" section (owner 2026-10-08): a lead carries every source
 * that found it. Left, each source's leads and how many another source found too; right,
 * the offer's leads by number of sources with their positive reply rate (Learning until
 * mature, like every rate). All served by features-service on the sales-paths read.
 */
export function OfferSourceOverlap({
  sources,
  overlap,
  unavailableReason,
  pending,
}: {
  sources: readonly SalesPathSourceCampaign[];
  /** Undefined = the producer does not serve it yet; null = it could not read it. */
  overlap: SourceOverlap | null | undefined;
  unavailableReason: string | null | undefined;
  pending: boolean;
}) {
  const { basis } = useStatBasis();
  const rows = sourceLeadRows(sources);
  const buckets = overlap ? orderedBuckets(overlap.buckets) : [];
  return (
    <section className="mt-8">
      <SectionTitle count={pending || !overlap ? null : overlap.multiSourceLeads}>Found by several sources</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">A lead found by two sources counts in both.</p>
      {pending ? (
        <div className="space-y-2">
          <Shimmer className="h-10 rounded-[10px]" />
          <Shimmer className="h-10 rounded-[10px]" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="k-card h-fit overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Source</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">Leads</th>
                  <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">Also found by another</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="k-row k-line-subtle h-10 border-b last:border-b-0">
                    <td className="px-3 py-2 pl-4">
                      <span className="inline-flex items-center gap-2">
                        <ProviderLogo domain={r.providerDomain} size={14} className="shrink-0 rounded-[3px]" />
                        <span className="k-fg">{r.channelName}</span>
                        {r.campaignName && <span className="k-fg3 text-[12px]">{r.campaignName}</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.leads != null ? formatCount(r.leads) : DASH}</td>
                    <td className="px-3 py-2 pr-4 text-right tabular-nums">
                      {r.alsoFoundByAnother != null ? formatCount(r.alsoFoundByAnother) : DASH}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="k-card h-fit overflow-hidden">
            {!overlap ? (
              <EmptyNote>
                {overlap === null || unavailableReason
                  ? "Could not read which sources found each lead."
                  : "Not measured yet for this offer."}
              </EmptyNote>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="k-line-subtle border-b">
                    <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Found by</th>
                    <th className="k-label px-3 py-2.5 text-right font-normal">Leads</th>
                    <th className="k-label px-3 py-2.5 text-right font-normal">Positive replies</th>
                    <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b) => {
                    const rate = shownFigure(b.maturity, (h) => h.positiveReplyRatePct, basis);
                    return (
                      <tr key={b.sourceCount} className="k-row k-line-subtle h-10 border-b last:border-b-0">
                        <td className={`px-3 py-2 pl-4 ${b.sourceCount > 0 ? "k-fg" : "k-fg3"}`}>{bucketLabel(b.sourceCount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCount(b.leads)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCount(b.positiveReplies)}</td>
                        <td className="px-3 py-2 pr-4 text-right tabular-nums">
                          {rate.learning ? <span className="k-chip">Learning</span> : rate.value != null ? formatRatePct(rate.value) : DASH}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
