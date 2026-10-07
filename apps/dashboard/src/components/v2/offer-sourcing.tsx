"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSourcing, type OfferSourcing, type SourcingOrigin } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { roiUnavailableLabel } from "@/lib/offer-sales-paths";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * Where the offer's leads come from (owner 2026-10-07): every sourcing origin, used or
 * not, with what finding a lead cost and what those leads returned. features-service
 * serves every figure (sourcing + outreach = the campaign total, to the cent); nothing
 * is computed here. Sits BELOW Campaigns on the Sales path page (owner 2026-10-07).
 */
export function OfferSourcingSection({ brandId, offerId }: { brandId: string; offerId: string }) {
  const q = useAuthQuery(["offerSourcing", brandId, offerId], () => getOfferSourcing(brandId, offerId), {
    enabled: !!offerId,
    ...pollOptions,
  });
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const rows = q.data ? sourcingRows(q.data) : [];

  return (
    <section>
      <SectionTitle count={q.data ? rows.filter((r) => r.used && r.key !== "unattributed").length : null}>Sourcing</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">Where your leads come from, and what each source returns.</p>
      {!settled ? (
        <div className="space-y-2">
          <Shimmer className="h-10 rounded-[10px]" />
          <Shimmer className="h-10 rounded-[10px]" />
        </div>
      ) : !q.data ? (
        <div className="k-card">
          <EmptyNote>Could not read where your leads come from.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Source</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">Leads</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">$ / Lead</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">Positive replies</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">$ / Positive reply</th>
                  <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">ROI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <SourcingRow key={r.key} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

type Row = Omit<SourcingOrigin, "slug" | "family" | "live" | "description"> & { key: string; description: string | null };

/**
 * The table's rows: the origins we run or ran for this offer (a retired one only while it
 * holds history), in the producer's order with the used ones first, then the leads served
 * before a source was recorded, when there are any.
 */
export function sourcingRows(data: Pick<OfferSourcing, "origins" | "unattributed">): Row[] {
  const origins = data.origins.filter((o) => o.live || o.used);
  const rows: Row[] = [...origins.filter((o) => o.used), ...origins.filter((o) => !o.used)].map((o) => ({
    ...o,
    key: o.slug,
  }));
  if (data.unattributed && data.unattributed.leadsServed > 0) {
    rows.push({
      ...data.unattributed,
      key: "unattributed",
      name: "Earlier leads",
      description: "Found before we recorded the source.",
      used: true,
    });
  }
  return rows;
}

function SourcingRow({ row }: { row: Row }) {
  const dash = <span className="k-fg4">—</span>;
  const usd = (v: number | null) => (v === null ? dash : formatUsdAdaptive(v));
  return (
    <tr className={`k-row k-line-subtle h-12 border-b last:border-b-0 ${row.used ? "" : "k-fg3"}`}>
      <td className="px-3 py-2 pl-4">
        <span className="flex items-center gap-2">
          <span className={row.used ? "font-semibold" : ""}>{row.name}</span>
          {!row.used && <span className="k-chip k-fg3">Not used yet</span>}
        </span>
        {row.description && <span className="k-fg3 block text-[12px] leading-[18px]">{row.description}</span>}
      </td>
      {row.used ? (
        <>
          <td className="px-3 py-2 text-right tabular-nums">{row.leadsServed.toLocaleString("en-US")}</td>
          <td className="px-3 py-2 text-right tabular-nums">{usd(row.costPerLeadUsd)}</td>
          <td className="px-3 py-2 text-right tabular-nums">{row.positiveReplies.toLocaleString("en-US")}</td>
          <td className="px-3 py-2 text-right tabular-nums">
            {row.positiveReplies === 0 ? <span className="k-fg3">Learning</span> : usd(row.endToEndCostPerPositiveReplyUsd)}
          </td>
          <td
            className={`px-3 py-2 pr-4 text-right font-semibold tabular-nums ${roiIsGood(row.roi) ? "text-[var(--run)]" : ""}`}
            title={roiUnavailableLabel(row.roiUnavailableReason) ?? undefined}
          >
            {formatRoi(row.roi)}
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 text-right">{dash}</td>
          <td className="px-3 py-2 text-right">{dash}</td>
          <td className="px-3 py-2 text-right">{dash}</td>
          <td className="px-3 py-2 text-right">{dash}</td>
          <td className="px-3 py-2 pr-4 text-right">{dash}</td>
        </>
      )}
    </tr>
  );
}
