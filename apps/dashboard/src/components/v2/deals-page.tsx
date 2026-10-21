"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getOfferDealsLifecycle, listUniboxLeads } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import { timeAgo } from "@/lib/friendly-datetime";
import { LEAD_BOARD_PAGE_SIZE } from "@/lib/lead-board";
import { filtersKey, uniboxLeadName, uniboxRowId, uniboxRowKey, uniboxValueTone, type LifecycleRung, type UniboxDimension, type UniboxFilters, type UniboxRow } from "@/lib/unibox-leads";
import { DEALS_FILTER_DIMENSIONS, dealCardChips, dealsBoardRungs, servedRungValues, type ServedRungValue } from "@/lib/deals-board";
import { useLeadCampaigns } from "@/components/v2/lead-campaigns";
import { FunnelFace } from "@/components/v2/funnel-campaigns";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { useDealsLifecycleCounts } from "@/components/v2/data";
import { TONE_COLOR, TagChip } from "@/components/v2/tag-chip";
import { UniboxFilterBar } from "@/components/v2/unibox-lead-card";
import { EmptyNote, Initials, Shimmer, TopBar } from "@/components/v2/ui";
import { CompanyMark } from "@/components/v2/people-bits";

/** lead-service pages a list by at most this many rows. */
const MAX_ROWS = 200;

/**
 * Deals: Keel's pipeline board over THE lifecycle ladder (owner 2026-10-21, DEALS-LIFECYCLE-1021):
 * one column per served rung (Contacted, Engaged, Signed up, Meeting booked, Meeting attended,
 * Paid client), each person on the highest rung they reached. Column sizes are lead-service's
 * per-rung counts, a column's cards its Unibox page filtered on that rung, values features-service's
 * deals value per rung. Interest, fit and reachability are chips and filters, never columns. A card
 * opens the person in the Unibox (thread + lead card).
 */
export function DealsPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { offerId, campaignIds } = useSelectedOffer();
  const { campaigns } = useLeadCampaigns(orgId, brandId);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState<UniboxFilters>({});
  const counts = useDealsLifecycleCounts(brandId, campaignFilter, filters);
  const ladder = counts.data?.lifecycleLadder ?? null;
  const rungs = ladder ? dealsBoardRungs(ladder) : null;
  const count = (key: string): number | null => (counts.data ? (counts.data.byLifecycle[key] ?? 0) : null);
  const biggest = Math.max(1, ...(rungs ?? []).map((r) => count(r.key) ?? 0));
  // What each rung holds, priced by features-service (the offer's own columns, owner 2026-10-03).
  // Not asked while the offer has no campaign: features-service 404s it, there is nothing to price.
  const dealsValue = useAuthQuery(
    ["dealsLifecycle", brandId, offerId ?? "", campaignFilter ?? ""],
    () => getOfferDealsLifecycle(offerId!, brandId, campaignFilter),
    { refetchInterval: POLL_INTERVAL, enabled: !!brandId && !!offerId && (campaignIds?.length ?? 0) > 0 },
  );
  const served = useMemo(() => servedRungValues(dealsValue.data), [dealsValue.data]);
  const pipeline = dealsValue.data?.expectedPipelineUsd ?? null;
  const contacted = count("contacted");
  const engaged = count("engaged");
  const paid = count("paid_client");
  return (
    <>
      <TopBar crumbs={[{ label: "Records" }, { label: "Deals" }]} />
      <div className="flex min-h-0 flex-col px-4 pb-10 pt-6 md:px-6">
        <div className="min-w-0">
          <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
            {pipeline != null ? `${formatUsdAdaptive(pipeline)} in expected pipeline` : "Deals"}
          </h1>
          <p className="k-fg2 mt-1 text-[14px]">
            {contacted != null && engaged != null && paid != null ? (
              <>
                <span className="k-fg font-medium tabular-nums">{formatCount(contacted)}</span> contacted,{" "}
                <span className="k-fg font-medium tabular-nums">{formatCount(engaged)}</span> engaged.{" "}
                <span className="inline-block h-2 w-2 rounded-[2px] align-middle" style={{ background: TONE_COLOR[uniboxValueTone("lifecycle", "paid_client")] }} />{" "}
                <span className="k-fg font-medium tabular-nums">{formatCount(paid)}</span> {paid === 1 ? "paid client" : "paid clients"}.
              </>
            ) : (
              " "
            )}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {campaigns.map((c) => {
            const on = campaignFilter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                title={c.name}
                onClick={() => setCampaignFilter(on ? null : c.key)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${on ? "bg-[var(--bg-selected)] shadow-[inset_0_0_0_1px_var(--line-strong)]" : "k-hover"}`}
              >
                <FunnelFace name={c.name} size={18} />
              </button>
            );
          })}
          <UniboxFilterBar
            filters={filters}
            ladder={ladder ?? []}
            dims={DEALS_FILTER_DIMENSIONS}
            onPick={(dim: UniboxDimension, values: string[]) => setFilters((f) => ({ ...f, [dim]: values }))}
          />
          <span className="k-inset ml-auto inline-flex rounded-[9px] p-0.5 shadow-[inset_0_0_0_1px_var(--line-subtle)]">
            <span className="k-btn h-6 px-2 text-[12px]">Board</span>
            <Link href={v2Href(orgId, brandId, "people")} className="k-btn-ghost h-6 px-2 text-[12px]">Table</Link>
          </span>
        </div>

        <div className="k-scroll mt-5 flex gap-4 overflow-x-auto pb-2">
          {rungs === null
            ? [0, 1, 2, 3].map((i) => (
                <section key={i} className="flex w-[240px] min-w-[200px] shrink-0 flex-col gap-2 md:flex-1 md:basis-0">
                  <Shimmer className="h-7 rounded-[8px]" />
                  <Shimmer className="h-[74px] rounded-[10px]" />
                </section>
              ))
            : rungs.map((r) => (
                <DealColumn
                  key={r.key}
                  orgId={orgId}
                  brandId={brandId}
                  offerId={offerId}
                  campaignId={campaignFilter}
                  filters={filters}
                  rung={r}
                  total={count(r.key)}
                  share={(count(r.key) ?? 0) / biggest}
                  served={served.get(r.key) ?? null}
                />
              ))}
        </div>
      </div>
    </>
  );
}

function DealColumn({
  orgId,
  brandId,
  offerId,
  campaignId,
  filters,
  rung,
  total,
  share,
  served,
}: {
  orgId: string;
  brandId: string;
  offerId: string | null;
  campaignId: string | null;
  filters: UniboxFilters;
  rung: LifecycleRung;
  total: number | null;
  share: number;
  served: ServedRungValue | null;
}) {
  const [shown, setShown] = useState(LEAD_BOARD_PAGE_SIZE);
  const limit = Math.min(shown, MAX_ROWS);
  const q = useAuthQuery(
    ["dealsLifecycleRows", brandId, offerId ?? "", campaignId ?? "", filtersKey(filters), rung.key, limit],
    () => listUniboxLeads(brandId, { ...filters, lifecycle: [rung.key] }, { limit, offerId, campaignId }),
    { refetchInterval: POLL_INTERVAL, enabled: !!brandId && !!offerId && (total === null || total > 0) },
  );
  const rows = total === 0 ? [] : (q.data?.rows ?? null);
  const color = TONE_COLOR[uniboxValueTone("lifecycle", rung.key)];
  const won = served?.valueKind === "won_value";
  const unibox = v2Href(orgId, brandId, "unibox");
  return (
    <section className="flex w-[240px] min-w-[200px] shrink-0 flex-col md:flex-1 md:basis-0">
      <header className="flex h-7 items-center gap-2 px-0.5">
        <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
        <span className="truncate whitespace-nowrap text-[13px] font-medium">{rung.label}</span>
        <span className="k-fg3 shrink-0 text-[13px] tabular-nums">{total == null ? "" : formatCount(total)}</span>
        {served?.valueUsd ? (
          <span
            className="k-fg ml-auto shrink-0 whitespace-nowrap text-[13px] font-medium tabular-nums"
            title={
              won
                ? "What was won: the amount stated on each sale, else your value of a client. One company counts once."
                : "Expected value: what these people are worth, the way your pipeline prices them. One company counts once."
            }
          >
            {formatUsdAdaptive(served.valueUsd)}
          </span>
        ) : null}
      </header>
      <div className="mb-3 mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--data-track)]">
        <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: color }} />
      </div>
      <div className="flex flex-col gap-2">
        {rows === null ? (
          [0, 1, 2].map((i) => <Shimmer key={i} className="h-[74px] rounded-[10px]" />)
        ) : rows.length === 0 ? (
          <EmptyNote>Nobody here.</EmptyNote>
        ) : (
          rows.map((row) => (
            <DealCard key={uniboxRowKey(row)} row={row} href={`${unibox}?lead=${encodeURIComponent(uniboxRowId(row))}`} value={served?.byRow.get(uniboxRowId(row)) ?? null} won={won} />
          ))
        )}
        {rows && total != null && rows.length < total ? (
          shown < MAX_ROWS ? (
            <button type="button" className="k-btn-ghost k-btn mt-1 justify-center" onClick={() => setShown((s) => s + LEAD_BOARD_PAGE_SIZE)}>
              Show more
            </button>
          ) : (
            <Link href={`${unibox}?lifecycle=${encodeURIComponent(rung.key)}`} className="k-btn-ghost k-btn mt-1 justify-center">
              See all {formatCount(total)} in the Unibox
            </Link>
          )
        ) : null}
      </div>
    </section>
  );
}

function DealCard({ row, href, value, won }: { row: UniboxRow; href: string; value: number | null; won: boolean }) {
  const company = row.company?.name || row.company?.domain || null;
  const name = uniboxLeadName(row);
  const chips = dealCardChips(row);
  return (
    <Link href={href} className="k-card block p-3">
      <div className="flex items-center gap-2">
        {company ? <CompanyMark name={company} domain={row.company?.domain ?? null} size={18} /> : <Initials name={name} size={18} round />}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{company ?? name}</span>
        {value != null && value > 0 ? (
          <span className={`shrink-0 tabular-nums ${won ? "text-[13px] font-medium" : "k-fg2 text-[12px]"}`}>{formatUsdAdaptive(value)}</span>
        ) : null}
      </div>
      {company || row.title ? (
        <div className="k-fg2 mt-1.5 truncate text-[12px]">{[company ? name : null, row.title].filter(Boolean).join(" · ")}</div>
      ) : null}
      <div className="k-fg3 mt-2 flex items-center gap-1.5 border-t border-[var(--line-subtle)] pt-2 text-[11px]">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {chips.map((t) => (
            <TagChip key={t.label} tag={t} shrink />
          ))}
        </span>
        <span className="shrink-0 tabular-nums">{row.lastActivityAt ? timeAgo(row.lastActivityAt) : ""}</span>
      </div>
    </Link>
  );
}
