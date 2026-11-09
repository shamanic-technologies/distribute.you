"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { StepMark } from "@/components/marks/step-mark";
import { useAuthQuery, useOrgQueryGate } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getSalesFunnelCaps, listFunnelCampaignCopies, listFunnelCampaignRows, listOfferSalesFunnels } from "@/lib/api";
import {
  compareFunnelCampaigns,
  funnelOnLabel,
  funnelFunded,
  funnelRowSettled,
  funnelSortKey,
  funnelTypeOf,
  isOngoingFunnelCampaign,
  splitFunnelCampaigns,
  type FunnelCampaignCopy,
  type FunnelCampaignRow,
  type SalesFunnelCampaign,
  type SalesFunnelCaps,
} from "@/lib/sales-funnel-campaigns";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { paidClientsWords } from "@/lib/realized-return";
import { expectedReasonWords } from "@/lib/expected-return";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { stepLabel } from "@/lib/legs";
import { useStaffMode } from "@/lib/use-staff-mode";
import { CAMPAIGN_LAYOUT_PARAM, isCampaignLayoutPreview, withLayoutNext } from "@/lib/v2/campaign-layout-preview";
import { getOfferSalesPaths } from "@/lib/api";
import { campaignKey, campaignsOfOffer, sourceCampaignsOfOffer } from "@/lib/offer-campaigns";
import { useCampaigns } from "@/components/v2/use-campaigns";
import { OfferCampaigns } from "@/components/v2/offer-campaigns";
import { v2CampaignHref } from "@/lib/v2/routes";
import { CampaignPinButton } from "@/components/v2/outcome-pins";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { useBrandScope } from "@/components/v2/brand-scope";
import { useCopilotDock } from "@/components/v2/copilot-dock";
import { FunnelCampaignModal, FunnelCampaignStatus, FunnelFace, FunnelOtherPartLines, FunnelPathLine, FunnelRoi, TypeTag, useFunnelCampaigns } from "@/components/v2/funnel-campaigns";
import { EmptyNote, MarkLines, SectionTitle, ShareBar, Shimmer, TopBar } from "@/components/v2/ui";
import { RoiLabel, RoiValue } from "@/components/v2/roi-label";

/** What the Create box sends to the Copilot when nothing is typed, as if typed and sent. */
export const CREATE_CAMPAIGN_ASK = "Create a campaign";

/**
 * Campaigns > Overview (owner 2026-10-15, after Frontrunner's Agents page, GA for everyone): a title
 * with "N running", a Create box (staff mode only) that hands the request to the Copilot (typed text, sent as if typed;
 * empty = "Create a campaign"), up to three sales funnels this offer does not run yet (staff mode
 * only: their read is a staff-only gateway route), then the offer's funnel campaigns as a clean list,
 * Running / Past, with search, a type filter and a sort over the rows already loaded. A campaign IS a
 * sales funnel (face, name, one status, its limits); no pipe rows, no leg arrows (owner 2026-10-10).
 * Every figure is served; the browser only filters and orders what it holds.
 */

/**
 * The single campaign page's next layout is a staff preview (#5472): a row keeps `?layout=next`
 * only when the list itself was opened with it in staff mode.
 */
function useKeepCampaignPreview(): boolean {
  const { staffMode } = useStaffMode();
  const layout = useSearchParams().get(CAMPAIGN_LAYOUT_PARAM);
  return isCampaignLayoutPreview(staffMode, layout);
}

export function CampaignsOverviewPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  // Every campaign of the brand, every offer (owner 2026-11-07, AUDIENCE-PER-OFFER-1107); each row names its offer.
  const { offers, settled, soleOfferId, campaignOfferIds } = useBrandScope();
  // Create and Suggested are staff previews (owner decisions: Suggested as before 2026-10-17, Create 2026-10-22).
  const { staffMode } = useStaffMode();
  const q = useFunnelCampaigns(brandId, null, { enabled: offers.length > 0 });
  const listSettled = q.data !== undefined || q.isFetchedAfterMount;
  const running = (q.data ?? []).filter(isOngoingFunnelCampaign).length;
  return (
    <>
      <TopBar crumbs={[{ label: "Campaigns" }, { label: "Overview" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        {/* The GTM Factory Campaigns header (FACTORY-USER-DASHBOARD-1102): a live sentence, then what a campaign is. */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em] tabular-nums">
              {listSettled && q.data ? `${running} of ${q.data.length} ${q.data.length === 1 ? "campaign" : "campaigns"} running` : "Campaigns"}
            </h1>
            <p className="k-fg2 mt-1.5 max-w-[720px] text-[14px]">A campaign orders results: a Target, a budget, where it starts and a brief. Each day it pulls on its Target, or pushes each new one up to it.</p>
          </div>
          {listSettled && q.data && (
            <span className="k-chip inline-flex items-center gap-1.5 tabular-nums">
              <span className={`h-1.5 w-1.5 rounded-full ${running ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
              {running} running now
            </span>
          )}
        </header>
        {!settled ? (
          <Shimmer className="h-10 w-full" />
        ) : offers.length === 0 ? (
          <div className="k-card">
            <EmptyNote>This brand has no offer yet.</EmptyNote>
          </div>
        ) : (
          <div className="space-y-10">
            {staffMode && <CreateBox />}
            {/* Fitted to ONE offer's steps: shown while the brand's campaigns sell one offer. */}
            {staffMode && soleOfferId && <Suggested brandId={brandId} offerId={soleOfferId} campaigns={q.data ?? null} />}
            <CampaignList orgId={orgId} brandId={brandId} />
            {(campaignOfferIds ?? []).map((id) => (
              <UnconvertedRunningCampaigns key={id} orgId={orgId} brandId={brandId} offerId={id} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Create: the request goes to the Copilot, as typed ──────────────────────────────────

function CreateBox() {
  const copilot = useCopilotDock();
  const [text, setText] = useState("");
  if (!copilot.available) return null;
  return (
    <section>
      <SectionTitle>Create</SectionTitle>
      <form
        aria-label="Create a campaign" className="k-card flex flex-col gap-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          // Opens the panel and queues the text; the chat sends it as the user's message once loaded and idle.
          copilot.ask(text.trim() || CREATE_CAMPAIGN_ASK);
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

// ─── Suggested: sales funnels fitted to this offer, not run yet ─────────────────────────

/**
 * features-service's sales funnels FITTED TO THIS OFFER (`listOfferSalesFunnels`: only funnels
 * built on the offer's own steps, priced with its stated lifetime revenue), minus the funnels the
 * offer already runs, drafts left out, in the producer's order: no browser sort. No per-funnel
 * return is shown (ROI-CONSISTENCY-1103).
 */
function Suggested({ brandId, offerId, campaigns }: { brandId: string; offerId: string; campaigns: SalesFunnelCampaign[] | null }) {
  const dock = useCopilotDock();
  const list = useAuthQuery(["offerFittedFunnels", brandId, offerId], () => listOfferSalesFunnels(brandId, offerId), pollOptions);
  const settled = list.data !== undefined || list.isFetchedAfterMount;
  const picks = useMemo(() => {
    if (!campaigns || !list.data) return null;
    const runs = new Set(campaigns.map((c) => c.salesFunnelId));
    return list.data.rows.filter((r) => !r.draft && !runs.has(r.id)).slice(0, 3);
  }, [campaigns, list.data]);
  if (list.isError && list.data === undefined) console.error("[v2] offer sales funnels unreadable", { offerId, error: list.error?.message });
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
              </MarkLines>
              <p className="k-fg2 mt-3 line-clamp-2 min-h-[40px] text-[13px] leading-5">{f.line}</p>
              {dock.available && (
                <div className="mt-3 flex justify-end">
                  <button type="button" className="k-btn" onClick={() => dock.ask(`${CREATE_CAMPAIGN_ASK} ${f.name}`)}>
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
const SORT_LABEL: Record<SortKey, string> = { default: "Default", roi: "Expected ROI", invested: "$ Invested" };

function CampaignList({ orgId, brandId }: { orgId: string; brandId: string }) {
  const q = useFunnelCampaigns(brandId, null);
  // The current table's own reads and keys: the rows (money), the fast copy (path, type), the caps. Brand grain.
  const rowsQ = useAuthQuery(["funnelCampaignRows", brandId, "all"], () => listFunnelCampaignRows(brandId, null), pollOptions);
  const copyQ = useAuthQuery(["funnelCampaignCopies", brandId, "all"], () => listFunnelCampaignCopies(brandId, null), pollOptions);
  // Each row names its offer once the brand holds several.
  const { offers } = useBrandScope();
  const offerNameOf = (id: string) => (offers.length > 1 ? (offers.find((o) => o.offerId === id)?.name ?? null) : null);
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
      return (sort === "roi" ? r?.expectedReturn?.roiMultiple : r?.investedUsd) ?? -Infinity;
    };
    return [...kept].sort((a, b) => value(b) - value(a));
  }, [base, search, type, sort, rowById, copyById]);

  // The biggest served $ Spent in view scales each row's bar (display only).
  const spentMax = Math.max(0, ...shown.map((c) => rowById.get(c.id)?.investedUsd ?? 0));
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  if (settled && !q.data && q.isError) return <p className="text-[13px] text-[var(--data-rose)]">Could not read this brand&apos;s campaigns.</p>;
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
        <div className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden @container">
          {shown.map((c) => (
            <CampaignLine
              key={c.id}
              orgId={orgId}
              campaign={c}
              row={rowById.get(c.id) ?? null}
              rowSettled={funnelRowSettled(rowById.has(c.id), rowsQ, c.createdAt)}
              rowsError={rowsQ.isError && !rowById.has(c.id) ? rowsQ.error : null}
              copy={rowById.get(c.id) ?? copyById.get(c.id) ?? null}
              copySettled={funnelRowSettled(rowById.has(c.id) || copyById.has(c.id), copyQ, c.createdAt)}
              caps={capsById.get(c.id) ?? null}
              spentMax={spentMax}
              offerName={offerNameOf(c.offerId)}
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

export function CampaignLine({
  orgId,
  campaign,
  row,
  rowSettled,
  rowsError,
  copy,
  copySettled,
  caps,
  spentMax = null,
  offerName = null,
}: {
  orgId: string;
  campaign: SalesFunnelCampaign;
  row: FunnelCampaignRow | null;
  rowSettled: boolean;
  rowsError: unknown;
  copy: FunnelCampaignCopy | null;
  copySettled: boolean;
  caps: SalesFunnelCaps | null;
  spentMax?: number | null;
  /** The offer it sells, named when the brand holds several. */
  offerName?: string | null;
}) {
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const keepPreview = useKeepCampaignPreview();
  const plain = v2CampaignHref(orgId, campaign.brandId, campaign.id);
  const href = keepPreview ? withLayoutNext(plain) : plain;
  const [editing, setEditing] = useState(false);
  // billing's verdict: a max budget AND/OR a max volume funds it.
  const notFunded = caps !== null && funnelFunded(caps) === false;
  const on = isOngoingFunnelCampaign(campaign);
  const reactive = (copy?.type ?? funnelTypeOf(caps)) === "reactive";
  // The status button reads the budget when on, as the current table's does.
  const onLabel = funnelOnLabel(reactive ? "reactive" : funnelTypeOf(caps), caps);
  // A missing served field reads "—" and is logged by name (no fallback).
  useEffect(() => {
    if (!rowSettled) return;
    if (rowsError) console.error("[funnel-campaigns] money read failed", { id: campaign.id, error: rowsError });
    else if (!row) console.error("[funnel-campaigns] features-service served no row for this campaign", { id: campaign.id });
    if (row && row.investedUsd === null) console.error("[funnel-campaigns] investedUsd not served", { id: row.id });
  }, [row, rowSettled, rowsError, campaign.id]);
  useEffect(() => {
    if (copySettled && copy && !copy.path) console.error("[funnel-campaigns] path not served", { id: copy.id, reason: copy.copyUnavailableReason ?? null });
  }, [copy, copySettled]);
  const wait = <Shimmer className="ml-auto h-4 w-12 rounded" />;
  const catalogue = useLegCatalogue();
  const catalogueReady = catalogue.steps.size > 0;
  const targetLabel = stepLabel(catalogue, campaign.target);
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
      className="k-row grid cursor-pointer grid-cols-1 items-center @md:grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 px-4 py-4 @[68rem]:grid-cols-[minmax(0,1fr)_104px_120px_116px_120px_76px_170px]"
    >
      <MarkLines
        gap="gap-3"
        mark={(px) => <FunnelFace name={campaign.salesFunnelName} size={px} />}
        after={<FunnelOtherPartLines campaignId={campaign.id} parts={copy?.otherParts} />}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-medium">{campaign.salesFunnelName}</span>
          {offerName && <span className="k-fg3 truncate text-[12px]">{offerName}</span>}
          {/* Pin / Unpin in the sidebar (owner 2026-11-07); the button stops the row's click. */}
          <CampaignPinButton brandId={campaign.brandId} campaignId={campaign.id} compact />
        </span>
        {/* P5.1 (owner 2026-10-31): the path the campaign runs NOW, each pipe by its served name and mark. */}
        {copy?.path ? (
          <span className="block min-w-0">
            <FunnelPathLine items={copy.path.items} />
          </span>
        ) : copySettled ? (
          <span className="k-fg4 block text-[12px]">—</span>
        ) : (
          <Shimmer className="h-3 w-48 rounded" />
        )}
      </MarkLines>
      <div className="hidden min-w-0 @[68rem]:block">
        <div className="k-label">Starts from</div>
        <div className="mt-0.5">{copy ? <TypeTag row={copy} /> : copySettled ? DASH : <Shimmer className="h-4 w-14 rounded" />}</div>
      </div>
      <div className="hidden min-w-0 @[68rem]:block">
        <div className="k-label">Target</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px]">
          {targetLabel && <StepMark stepKey={campaign.target} size="xs" />}
          <span className="truncate">{targetLabel ?? (campaign.target && !catalogueReady ? <Shimmer className="h-4 w-16 rounded" /> : DASH)}</span>
        </div>
      </div>
      <div className="hidden text-right @[68rem]:block">
        <div className="k-label">
          <RoiLabel>Expected ROI</RoiLabel>
        </div>
        <div className="mt-0.5 text-[13px] tabular-nums">{!rowSettled ? wait : row ? <ExpectedRoi row={row} /> : DASH}</div>
      </div>
      <div className="hidden text-right @[68rem]:block">
        <div className="k-label">
          <RoiLabel>Realized ROI</RoiLabel>
        </div>
        <div className="mt-0.5 text-[13px] font-medium tabular-nums">{!rowSettled ? wait : row ? <RealizedRoi row={row} /> : DASH}</div>
      </div>
      <div className="hidden text-right @[68rem]:block">
        <div className="k-label">$ Spent</div>
        <div className="mt-0.5 text-[13px] tabular-nums">{!rowSettled ? wait : row?.investedUsd != null ? formatUsdAdaptive(row.investedUsd) : DASH}</div>
        {rowSettled && row?.investedUsd != null && spentMax ? <ShareBar value={row.investedUsd} max={spentMax} className="ml-auto mt-1.5 w-full" /> : null}
      </div>
      <div className="flex @md:justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="@md:text-right">
          <FunnelCampaignStatus campaign={campaign} onLabel={on ? onLabel : null} />
          {on && notFunded && (
            <button type="button" onClick={() => setEditing(true)} className="mt-1 block w-full text-right text-[11.5px] text-[var(--data-amber)] hover:underline">
              Not funded yet · Set a budget
            </button>
          )}
          {editing && <FunnelCampaignModal campaign={campaign} caps={caps} onClose={() => setEditing(false)} />}
        </div>
      </div>
    </div>
  );
}

/** The campaign's EXPECTED return, as features-service serves it (same formula on today's estimates), else its reason. */
function ExpectedRoi({ row }: { row: FunnelCampaignRow }) {
  const e = row.expectedReturn ?? null;
  if (e?.roiMultiple != null) return <span className={roiIsGood(e.roiMultiple) ? "text-[var(--run)]" : ""}>{formatRoi(e.roiMultiple)}</span>;
  return <span className="k-fg3 text-[12px]">{expectedReasonWords(e?.unavailableReason ?? null)}</span>;
}

/**
 * The REALIZED return (owner 2026-11-03, ROI-CONSISTENCY-1103): revenue of the Paid clients our
 * outreach caused over money actually spent, as features-service serves it, with the client count
 * under it. The pipeline-based measured return is retired.
 */
function RealizedRoi({ row }: { row: FunnelCampaignRow }) {
  const r = row.costEconomics?.realizedReturn ?? null;
  if (!r) return DASH;
  return (
    <span className="inline-flex flex-col items-end">
      <span className={r.closedWonCount > 0 && roiIsGood(r.roiMultiple) ? "text-[var(--run)]" : ""}>{formatRoi(r.roiMultiple)}</span>
      <span className="k-fg3 text-[11px] font-normal">{paidClientsWords(r.closedWonCount)}</span>
    </span>
  );
}

/**
 * A customer never loses a RUNNING campaign from view (owner 2026-10-10): an old-style campaign
 * that is ON and not yet part of a funnel campaign (campaign-service's conversion has not reached
 * it) stays listed here, and only it. Renders nothing once every running campaign is converted.
 */
function UnconvertedRunningCampaigns({ orgId, brandId, offerId }: { orgId: string; brandId: string; offerId: string }) {
  const { campaigns: records } = useCampaigns(orgId, brandId);
  const { running, other } = useMemo(() => {
    const run = new Set<string>();
    const all = new Set<string>();
    for (const m of records) {
      if (m.offerId !== offerId) continue;
      const k = campaignKey(m.row.campaign.featureSlug ?? "", m.row.campaign.legKey ?? "");
      all.add(k);
      if (m.running) run.add(k);
    }
    return { running: run, other: new Set([...all].filter((k) => !run.has(k))) };
  }, [records, offerId]);
  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId, "catalogue"),
    { enabled: running.size > 0 },
  );
  const campaigns = useMemo(
    () =>
      [
        ...campaignsOfOffer(paths.data?.campaigns ?? [], paths.data?.paths ?? [], (k) => running.has(k)),
        ...sourceCampaignsOfOffer(paths.data?.sourceCampaigns ?? []),
      ].filter((c) => running.has(campaignKey(c.featureSlug, c.legKey))),
    [paths.data, running],
  );
  if (running.size === 0) return null;
  return (
    <OfferCampaigns
      orgId={orgId}
      brandId={brandId}
      offerId={offerId}
      campaigns={campaigns}
      pending={paths.isPending && !paths.isError}
      title="More campaigns"
      sub="These keep running as they are."
      results
      listedElsewhere={other}
    />
  );
}
