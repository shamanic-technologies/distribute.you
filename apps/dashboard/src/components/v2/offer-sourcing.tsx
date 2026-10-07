"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getOfferSourcing,
  getOfferSelectedSourcing,
  saveOfferSelectedSourcing,
  type OfferSourcing,
  type SourcingOrigin,
} from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { roiUnavailableLabel } from "@/lib/offer-sales-paths";
import { originSelectable, selectedSourcingSlugs, toggleSourcing } from "@/lib/offer-sourcing-selection";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * Where the offer's leads come from (owner 2026-10-07): every sourcing origin, used or
 * not, with its ROI (features-service serves it; nothing is computed here). Each row is a
 * checkbox like a sales path: the customer ticks which sources the offer uses (brand-service
 * stores it); never stated = the live origins above break-even ticked. Only ROI is shown
 * (owner: leads, $/lead, replies, $/reply "on s'en fout"). Sits BELOW Campaigns on the
 * Sales path page (owner 2026-10-07).
 */
export function OfferSourcingSection({ brandId, offerId }: { brandId: string; offerId: string }) {
  const qc = useQueryClient();
  const q = useAuthQuery(["offerSourcing", brandId, offerId], () => getOfferSourcing(brandId, offerId), {
    enabled: !!offerId,
    ...pollOptions,
  });
  const savedKey = ["offerSelectedSourcing", brandId, offerId] as const;
  const savedQ = useAuthQuery(savedKey, () => getOfferSelectedSourcing(brandId, offerId), { enabled: !!offerId });
  const [draft, setDraft] = useState<ReadonlySet<string> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => setDraft(null), [savedQ.data]);
  const selected = useMemo(
    () => draft ?? (savedQ.data && q.data ? selectedSourcingSlugs(savedQ.data, q.data.origins) : null),
    [draft, savedQ.data, q.data],
  );
  const onToggle = (slug: string, on: boolean) => {
    if (!selected) return;
    const next = toggleSourcing(selected, slug, on);
    setDraft(new Set(next));
    setSaveError(null);
    saveOfferSelectedSourcing(brandId, offerId, next)
      .then((saved) => qc.setQueryData(savedKey, saved))
      .catch((err) => {
        console.error("[offer-sourcing] save failed", err);
        setDraft(null);
        setSaveError("Could not save this change. Try again.");
      });
  };

  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const rows = q.data ? sourcingRows(q.data) : [];

  return (
    <section>
      <SectionTitle count={selected ? selected.size : null}>Sourcing</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">Tick where this offer finds its leads.</p>
      {saveError && <p className="mb-3 text-[13px] text-[var(--data-rose)]">{saveError}</p>}
      {savedQ.isError && !savedQ.data && (
        <p className="mb-3 text-[13px] text-[var(--data-rose)]">Could not read which sources you ticked.</p>
      )}
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
          <table className="w-full text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className="k-label w-10 px-3 py-2.5 pl-4 text-left font-normal">
                  <span className="sr-only">Selected</span>
                </th>
                <th className="k-label px-3 py-2.5 text-left font-normal">Source</th>
                <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">ROI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <SourcingRow
                  key={r.key}
                  row={r}
                  on={r.selectable && (selected?.has(r.key) ?? false)}
                  onToggle={r.selectable && selected ? (on) => onToggle(r.key, on) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type Row = Omit<SourcingOrigin, "slug" | "family" | "live" | "description"> & {
  key: string;
  description: string | null;
  /** A live origin can be ticked; a retired one and the earlier-leads row are read only. */
  selectable: boolean;
};

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
    selectable: originSelectable(o),
  }));
  if (data.unattributed && data.unattributed.leadsServed > 0) {
    rows.push({
      ...data.unattributed,
      key: "unattributed",
      name: "Earlier leads",
      description: "Found before we recorded the source.",
      used: true,
      selectable: false,
    });
  }
  return rows;
}

function SourcingRow({ row, on, onToggle }: { row: Row; on: boolean; onToggle?: (on: boolean) => void }) {
  const unavailable = roiUnavailableLabel(row.roiUnavailableReason);
  return (
    <tr
      onClick={onToggle ? () => onToggle(!on) : undefined}
      className={`k-row k-line-subtle h-12 border-b last:border-b-0 ${onToggle ? "cursor-pointer" : ""} ${on ? "bg-[var(--accent-soft)]" : ""} ${row.used || on ? "" : "k-fg3"}`}
    >
      <td className="px-3 py-2 pl-4">
        {row.selectable && (
          <button
            type="button"
            aria-pressed={on}
            aria-label={on ? `Untick ${row.name}` : `Tick ${row.name}`}
            disabled={!onToggle}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(!on);
            }}
            className="-m-1 inline-flex h-6 w-6 items-center justify-center"
          >
            <span
              aria-hidden
              className={`inline-flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] text-white ${on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line-strong)]"}`}
            >
              {on ? "✓" : ""}
            </span>
          </button>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="flex items-center gap-2">
          <span className={row.used || on ? "font-semibold" : ""}>{row.name}</span>
          {!row.used && <span className="k-chip k-fg3">Not used yet</span>}
        </span>
        {row.description && <span className="k-fg3 block text-[12px] leading-[18px]">{row.description}</span>}
      </td>
      <td
        className={`whitespace-nowrap px-3 py-2 pr-4 text-right font-semibold tabular-nums ${roiIsGood(row.roi) ? "text-[var(--run)]" : ""}`}
        title={unavailable ?? undefined}
      >
        {row.used ? formatRoi(row.roi) : <span className="k-fg4 font-normal">—</span>}
      </td>
    </tr>
  );
}
