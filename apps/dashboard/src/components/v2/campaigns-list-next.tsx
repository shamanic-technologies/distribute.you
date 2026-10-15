"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { useAuthQuery, useOrgQueryGate } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getSalesFunnelCaps, listFunnelCampaignCopies, listFunnelCampaignRows } from "@/lib/api";
import {
  compareFunnelCampaigns,
  fundingLimit,
  funnelRowSettled,
  funnelSortKey,
  funnelTypeOf,
  isOngoingFunnelCampaign,
  maxBudgetLabel,
  splitFunnelCampaigns,
  volumeFundingLabel,
  type FunnelCampaignCopy,
  type FunnelCampaignRow,
  type SalesFunnelCampaign,
  type SalesFunnelCaps,
} from "@/lib/sales-funnel-campaigns";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import { useStaffMode } from "@/lib/use-staff-mode";
import { CAMPAIGN_LAYOUT_PARAM, isCampaignLayoutPreview, withLayoutNext } from "@/lib/v2/campaign-layout-preview";
import { v2CampaignHref } from "@/lib/v2/routes";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { useCopilotDock } from "@/components/v2/copilot-dock";
import { useStaffCatalogueList } from "@/components/v2/staff-catalogue-data";
import { FunnelCampaignStatus, FunnelFace, FunnelRoi, TypeTag, useFunnelCampaigns } from "@/components/v2/funnel-campaigns";
import { EmptyNote, MarkLines, SectionTitle, Shimmer, TopBar } from "@/components/v2/ui";
import { RoiLabel } from "@/components/v2/roi-label";

/**
 * CAMPAIGNS LIST, NEXT LAYOUT (staff preview, owner 2026-10-15, after Frontrunner's Agents page):
 * a title with "N running", a Create box that hands the request to the Copilot, up to three sales
 * funnels this offer does not run yet (features-service's cross-org catalogue, best served ROI
 * first), then the campaigns as a clean list with search, a type filter and a sort over the rows
 * already loaded. Rendered only behind `isCampaignLayoutPreview` (staff mode AND `?layout=next`).
 * Every figure is served; the browser only filters and orders what it holds.
 */

/** The same words the current page's "Create a campaign" button sends. */
const CREATE_ASK = "Create a campaign";

/** True when the list page should render the next layout (staff mode AND `?layout=next`). */
export function useCampaignsListPreview(): boolean {
  const { staffMode } = useStaffMode();
  const layout = useSearchParams().get(CAMPAIGN_LAYOUT_PARAM);
  return isCampaignLayoutPreview(staffMode, layout);
}

export function CampaignsListNext() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { offerId, settled } = useSelectedOffer();
  const q = useFunnelCampaigns(brandId, offerId ?? null, { enabled: !!offerId });
  const listSettled = q.data !== undefined || q.isFetchedAfterMount;
  const running = (q.data ?? []).filter(isOngoingFunnelCampaign).length;
  return (
    <>
      <TopBar crumbs={[{ label: "Campaigns" }, { label: "Overview" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <header className="mb-6">
          <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">Campaigns</h1>
          <div className="mt-2 h-6">
            {listSettled && q.data && (
              <span className="k-chip inline-flex items-center gap-1.5 tabular-nums">
                <span className={`h-1.5 w-1.5 rounded-full ${running ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
                {running} running
              </span>
            )}
          </div>
        </header>
        {!settled ? (
          <Shimmer className="h-10 w-full" />
        ) : !offerId ? (
          <div className="k-card">
            <EmptyNote>This brand has no offer yet.</EmptyNote>
          </div>
        ) : (
          <div className="space-y-8">
            <CreateBox />
            <Suggested campaigns={q.data ?? null} />
            <CampaignList orgId={orgId} brandId={brandId} offerId={offerId} />
          </div>
        )}
      </div>
    </>
  );
}

// ─── Create: the request goes to the Copilot, as typed ──────────────────────────────────

function CreateBox() {
  const dock = useCopilotDock();
  const [text, setText] = useState("");
  if (!dock.available) return null;
  return (
    <section>
      <SectionTitle>Create</SectionTitle>
      <form
        className="k-card flex flex-col gap-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          dock.ask(text.trim() || CREATE_ASK);
          setText("");
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          placeholder="Describe the campaign you want"
          aria-label="Describe the campaign you want"
          className="min-h-[52px] w-full resize-none bg-transparent px-1 text-[14px] leading-[22px] outline-none placeholder:text-[var(--fg-3)]"
        />
        <div className="flex justify-end">
          <button type="submit" className="k-btn-accent gap-1.5">
            <PlusIcon size={14} weight="bold" />
            Create
          </button>
        </div>
      </form>
    </section>
  );
}

// ─── Suggested: sales funnels this offer does not run yet ───────────────────────────────

/**
 * features-service's sales funnel catalogue (cross-org, each with its served ROI), minus the
 * funnels this offer already runs, drafts left out, best ROI first. The catalogue route is
 * staff-only today, which this preview is.
 */
function Suggested({ campaigns }: { campaigns: SalesFunnelCampaign[] | null }) {
  const dock = useCopilotDock();
  const list = useStaffCatalogueList("sales-funnels", { limit: "25" });
  const settled = list.data !== undefined || list.isFetchedAfterMount;
  const picks = useMemo(() => {
    if (!campaigns || !list.data) return null;
    const runs = new Set(campaigns.map((c) => c.salesFunnelId));
    return list.data.rows
      .filter((r) => !r.draft && !runs.has(r.id))
      .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity))
      .slice(0, 3);
  }, [campaigns, list.data]);
  if (settled && (list.isError || (picks && picks.length === 0))) return null;
  return (
    <section>
      <SectionTitle>Suggested for you</SectionTitle>
      {!picks ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} className="h-[148px] rounded-[12px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {picks.map((f) => (
            <div key={f.id} className="k-card flex min-w-0 flex-col p-4">
              <MarkLines mark={(px) => <FunnelFace name={f.name} size={px} />}>
                <span className="block truncate text-[14px] font-medium">{f.name}</span>
                <span className="k-fg3 inline-flex items-center gap-1 text-[12px]">
                  <RoiLabel>ROI</RoiLabel>
                  <span className={`tabular-nums ${f.roi != null && roiIsGood(f.roi) ? "text-[var(--run)]" : "k-fg2"}`}>
                    {f.roi != null ? formatRoi(f.roi) : "Learning"}
                  </span>
                  <span>across clients</span>
                </span>
              </MarkLines>
              <p className="k-fg2 mt-3 line-clamp-2 min-h-[40px] text-[13px] leading-5">{f.line}</p>
              {dock.available && (
                <div className="mt-3 flex justify-end">
                  <button type="button" className="k-btn" onClick={() => dock.ask(`${CREATE_ASK} ${f.name}`)}>
                    Start
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── The campaigns: a clean list, search, type filter, sort ─────────────────────────────

type TypeFilter = "all" | "proactive" | "reactive";
type SortKey = "default" | "roi" | "invested";
const TYPE_LABEL: Record<TypeFilter, string> = { all: "Every type", proactive: "Daily", reactive: "Triggered" };
const SORT_LABEL: Record<SortKey, string> = { default: "Default", roi: "ROI", invested: "$ Invested" };

function CampaignList({ orgId, brandId, offerId }: { orgId: string; brandId: string; offerId: string }) {
  const q = useFunnelCampaigns(brandId, offerId);
  // The current table's own reads and keys: the rows (money), the fast copy (path, type), the caps.
  const rowsQ = useAuthQuery(["funnelCampaignRows", brandId, offerId], () => listFunnelCampaignRows(brandId, offerId), pollOptions);
  const copyQ = useAuthQuery(["funnelCampaignCopies", brandId, offerId], () => listFunnelCampaignCopies(brandId, offerId), pollOptions);
  const rowById = useMemo(() => new Map((rowsQ.data ?? []).map((r) => [r.id, r])), [rowsQ.data]);
  const copyById = useMemo(() => new Map((copyQ.data ?? []).map((r) => [r.id, r])), [copyQ.data]);
  const gate = useOrgQueryGate();
  const capsQs = useQueries({
    queries: (q.data ?? []).map((c) => ({
      queryKey: ["salesFunnelCaps", c.brandId, c.offerId, c.salesFunnelId],
      queryFn: () => getSalesFunnelCaps(c.brandId, c.offerId, c.salesFunnelId),
      enabled: gate,
      ...pollOptions,
    })),
  });
  const capsById = new Map((q.data ?? []).map((c, i) => [c.id, capsQs[i]?.data ?? null]));
  const capsStamp = capsQs.map((x) => x.dataUpdatedAt).join(",");

  const [view, setView] = useState<"running" | "past">("running");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortKey>("default");

  // Today's order (Proactive first, then max budget, then max volume), then the split Running / Past.
  const ordered = useMemo(() => {
    return (q.data ?? [])
      .map((c) => ({ c, k: funnelSortKey(rowById.get(c.id) ?? null, capsById.get(c.id) ?? null) }))
      .sort((x, y) => compareFunnelCampaigns(x.k, y.k))
      .map((x) => x.c);
    // capsStamp moves exactly when one of the caps does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, rowById, capsStamp]);
  const investedById = useMemo(() => new Map((rowsQ.data ?? []).map((r) => [r.id, r.investedUsd])), [rowsQ.data]);
  const { running, past } = useMemo(() => splitFunnelCampaigns(ordered, investedById), [ordered, investedById]);
  const showingPast = view === "past" && past.length > 0;
  const base = showingPast ? past : running;

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const kept = base.filter((c) => {
      const copy = rowById.get(c.id) ?? copyById.get(c.id) ?? null;
      if (type !== "all" && (copy?.type ?? null) !== type) return false;
      if (!needle) return true;
      return `${c.salesFunnelName} ${copy?.shortDescription ?? ""}`.toLowerCase().includes(needle);
    });
    if (sort === "default") return kept;
    const value = (c: SalesFunnelCampaign) => {
      const r = rowById.get(c.id);
      return (sort === "roi" ? r?.roiMultiple : r?.investedUsd) ?? -Infinity;
    };
    return [...kept].sort((a, b) => value(b) - value(a));
  }, [base, search, type, sort, rowById, copyById]);

  const settled = q.data !== undefined || q.isFetchedAfterMount;
  if (settled && !q.data && q.isError) return <p className="text-[13px] text-[var(--data-rose)]">Could not read this offer&apos;s campaigns.</p>;
  return (
    <section>
      <div className="k-line-subtle mb-3 flex flex-wrap items-end justify-between gap-3 border-b">
        <nav className="flex gap-5" aria-label="Campaigns shown">
          <button type="button" onClick={() => setView("running")} aria-current={!showingPast ? "page" : undefined} className="k-tab text-[13px]">
            Running <span className="k-fg3 tabular-nums">{settled ? running.length : ""}</span>
          </button>
          {past.length > 0 && (
            <button type="button" onClick={() => setView("past")} aria-current={showingPast ? "page" : undefined} className="k-tab text-[13px]">
              Past <span className="k-fg3 tabular-nums">{past.length}</span>
            </button>
          )}
        </nav>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="k-input flex min-w-[220px] flex-1 items-center gap-2 px-2.5">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="k-fg3 shrink-0" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns"
            aria-label="Search campaigns"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--fg-3)]"
          />
        </label>
        <Picker label="Type" value={type} options={TYPE_LABEL} onChange={setType} />
        <Picker label="Sort" value={sort} options={SORT_LABEL} onChange={setSort} />
      </div>
      {!settled ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} className="h-[68px] rounded-[12px]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="k-card">
          <EmptyNote>{base.length === 0 ? "No campaign running yet." : "No campaign matches."}</EmptyNote>
        </div>
      ) : (
        <div className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
          {shown.map((c) => (
            <CampaignLine
              key={c.id}
              orgId={orgId}
              campaign={c}
              row={rowById.get(c.id) ?? null}
              rowSettled={funnelRowSettled(rowById.has(c.id), rowsQ, c.createdAt)}
              copy={rowById.get(c.id) ?? copyById.get(c.id) ?? null}
              copySettled={funnelRowSettled(rowById.has(c.id) || copyById.has(c.id), copyQ, c.createdAt)}
              caps={capsById.get(c.id) ?? null}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** A select drawn as a `k-btn`: its label, its value, a chevron. */
function Picker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <label className="k-btn relative gap-1.5 pr-7 text-[12px]">
      <span className="k-fg3">{label}</span>
      <span>{options[value]}</span>
      <svg width="10" height="10" viewBox="0 0 12 12" className="k-fg3 pointer-events-none absolute right-2.5" aria-hidden="true">
        <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label} className="absolute inset-0 cursor-pointer opacity-0">
        {(Object.keys(options) as T[]).map((k) => (
          <option key={k} value={k}>
            {options[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

const DASH = <span className="k-fg4">—</span>;

function CampaignLine({
  orgId,
  campaign,
  row,
  rowSettled,
  copy,
  copySettled,
  caps,
}: {
  orgId: string;
  campaign: SalesFunnelCampaign;
  row: FunnelCampaignRow | null;
  rowSettled: boolean;
  copy: FunnelCampaignCopy | null;
  copySettled: boolean;
  caps: SalesFunnelCaps | null;
}) {
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const href = withLayoutNext(v2CampaignHref(orgId, campaign.brandId, campaign.id));
  const on = isOngoingFunnelCampaign(campaign);
  const reactive = (copy?.type ?? funnelTypeOf(caps)) === "reactive";
  const b = caps?.maxBudget ?? null;
  const limit = fundingLimit(caps);
  // The status button reads the budget when on, as the current table's does.
  const onLabel = b
    ? `${reactive ? "Up to " : ""}${maxBudgetLabel(b)}`
    : limit?.kind === "volume"
      ? volumeFundingLabel(reactive ? "reactive" : funnelTypeOf(caps), limit.volume)
      : "On";
  const wait = <Shimmer className="ml-auto h-4 w-12 rounded" />;
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      onMouseEnter={() => prefetch(href)}
      onFocus={() => prefetch(href)}
      className="k-row grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_150px_104px_96px_190px]"
    >
      <MarkLines gap="gap-3" mark={(px) => <FunnelFace name={campaign.salesFunnelName} size={px} />}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-medium">{campaign.salesFunnelName}</span>
        </span>
        {copy?.shortDescription ? (
          <span className="k-fg2 block truncate text-[12px]">{copy.shortDescription}</span>
        ) : copySettled ? (
          <span className="k-fg4 block text-[12px]">—</span>
        ) : (
          <Shimmer className="h-3 w-48 rounded" />
        )}
      </MarkLines>
      <div className="hidden md:block">{copy ? <TypeTag row={copy} /> : copySettled ? DASH : <Shimmer className="h-4 w-14 rounded" />}</div>
      <div className="hidden text-right md:block">
        <div className="k-label">
          <RoiLabel />
        </div>
        <div className="mt-0.5 text-[13px] font-medium tabular-nums">{!rowSettled ? wait : row ? <FunnelRoi row={row} /> : DASH}</div>
      </div>
      <div className="hidden text-right md:block">
        <div className="k-label">$ Invested</div>
        <div className="mt-0.5 text-[13px] tabular-nums">{!rowSettled ? wait : row?.investedUsd != null ? formatUsdAdaptive(row.investedUsd) : DASH}</div>
      </div>
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <FunnelCampaignStatus campaign={campaign} onLabel={on ? onLabel : null} />
      </div>
    </div>
  );
}
