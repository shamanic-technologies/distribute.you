"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { EmptyNote, SectionTitle, Shimmer, StateDot, TopBar } from "@/components/v2/ui";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { useOngoingCampaigns } from "@/components/v2/ongoing-campaigns";
import { Fact, OngoingDot, TableSkeleton, useRelated } from "@/components/v2/staff-catalogue-pages";
import { useFunnelCampaigns, useStaffCatalogueObject } from "@/components/v2/staff-catalogue-data";
import { getSalesFunnelCampaign, getSalesFunnelCaps } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { featureLegId } from "@/lib/outbound-leg-key";
import { pollOptions } from "@/lib/query-options";
import { formatUsdAdaptive, formatCount } from "@/lib/format-number";
import { v2CampaignHref, v2CatalogueHref, v2WorkflowHref } from "@/lib/v2/routes";
import { centsToUsd, isOngoingFunnelCampaign, producerWord, type SalesFunnelCampaign, type SalesFunnelCaps } from "@/lib/sales-funnel-campaigns";

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const TD = "px-3 py-2 first:pl-4 last:pr-4";

/** campaign-service's own word: Ongoing (live dot) or Stopped. */
function FunnelCampaignStatus({ status }: { status: string }) {
  return <StateDot running={status === "ongoing"} label={producerWord(status)} />;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One funnel campaign row: its funnel's face and name, its units, status and stop reason. */
function FunnelCampaignTable({ rows, orgId, brandId }: { rows: SalesFunnelCampaign[]; orgId: string; brandId: string }) {
  const router = useRouter();
  const funnels = useRelated("sales-funnels", [...new Set(rows.map((r) => r.salesFunnelId))]);
  const faceOf = useMemo(() => new Map(funnels.rows.map((f) => [f.id, f])), [funnels.rows]);
  return (
    <div className="k-card overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b">
              <th className={TH}>Campaign</th>
              <th className={`${TH} text-right`}>Units</th>
              <th className={TH}>Status</th>
              <th className={TH}>Stop reason</th>
              <th className={TH}>Started</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const href = v2CatalogueHref(orgId, brandId, "campaigns", c.id);
              const funnel = faceOf.get(c.salesFunnelId);
              return (
                <tr key={c.id} onClick={() => router.push(href)} className="k-row k-line-subtle cursor-pointer border-b last:border-b-0">
                  <td className={TD}>
                    <Link href={href} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2.5">
                      <CatalogueMark face={funnel?.face} name={c.salesFunnelName} size={24} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.salesFunnelName}</span>
                        <span className="k-fg3 block truncate text-[12px]">{funnel?.line ?? c.salesFunnelId}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{c.units.length}</td>
                  <td className={TD}>
                    <FunnelCampaignStatus status={c.status} />
                  </td>
                  <td className={TD}>{c.stopReason ? <span className="k-chip">{producerWord(c.stopReason)}</span> : <span className="k-fg4">—</span>}</td>
                  <td className={`${TD} k-mono k-fg2 text-[12px]`}>{shortDate(c.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Staff Campaigns > Overview (owner 2026-10-10): the selected offer's SALES FUNNEL campaigns
 * (campaign-service), the ongoing ones first; then the campaigns still running one pipe each,
 * from before funnels, which open their GA campaign page.
 */
export function StaffCampaignsOverviewPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { offerId } = useSelectedOffer();
  const q = useFunnelCampaigns(brandId, offerId);
  const answered = q.data !== undefined || q.isFetchedAfterMount;
  const all = q.data ?? [];
  const ongoing = all.filter(isOngoingFunnelCampaign);
  const stopped = all.filter((c) => !isOngoingFunnelCampaign(c));
  const { campaigns: perPipe, settled: perPipeSettled } = useOngoingCampaigns(orgId, brandId, offerId);
  const funnelUnitIds = useMemo(() => new Set(all.flatMap((c) => c.units.map((u) => u.campaignId))), [all]);
  const legacy = perPipe.filter((c) => !funnelUnitIds.has(c.m.row.campaign.id));

  return (
    <>
      <TopBar crumbs={[{ label: "Campaigns" }, { label: "Overview" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {answered && q.data ? `${ongoing.length} of ${all.length} funnel campaigns ongoing` : "Campaigns"}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">A campaign runs one sales funnel for this offer. Its units are its pipes.</p>
          </div>
          {answered && q.data && (
            <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
              <span className={`h-1.5 w-1.5 rounded-full ${ongoing.length ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
              {ongoing.length} ongoing now
            </span>
          )}
        </div>

        {!answered ? (
          <div className="mt-6">
            <TableSkeleton rows={2} />
          </div>
        ) : q.isError && !q.data ? (
          <div className="k-card mt-6">
            <EmptyNote>Could not read this offer&apos;s funnel campaigns.</EmptyNote>
          </div>
        ) : (
          <>
            <section className="mt-6">
              <SectionTitle count={ongoing.length}>Ongoing</SectionTitle>
              {ongoing.length === 0 ? (
                <div className="k-card">
                  <EmptyNote>No funnel campaign of this offer is running.</EmptyNote>
                </div>
              ) : (
                <FunnelCampaignTable rows={ongoing} orgId={orgId} brandId={brandId} />
              )}
            </section>
            {stopped.length > 0 && (
              <section className="mt-8">
                <SectionTitle count={stopped.length}>Stopped</SectionTitle>
                <FunnelCampaignTable rows={stopped} orgId={orgId} brandId={brandId} />
              </section>
            )}
          </>
        )}

        <section className="mt-8">
          <SectionTitle count={perPipeSettled ? legacy.length : null}>Running before funnels</SectionTitle>
          {!perPipeSettled ? (
            <TableSkeleton rows={2} />
          ) : legacy.length === 0 ? (
            <div className="k-card">
              <EmptyNote>Every running campaign of this offer is a funnel unit.</EmptyNote>
            </div>
          ) : (
            <div className="k-card overflow-hidden">
              {legacy.map((c) => (
                <LegacyCampaignRow key={c.m.row.campaign.id} href={c.m.href} name={c.name ?? c.m.crew.name} featureSlug={c.m.row.campaign.featureSlug} legKey={c.m.row.campaign.legKey} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/** A campaign from before funnels (one pipe): its served name, its pipe's line, opening its GA campaign page. */
function LegacyCampaignRow({ href, name, featureSlug, legKey }: { href: string; name: string; featureSlug?: string | null; legKey?: string | null }) {
  const pipe = useStaffCatalogueObject("pipes", featureSlug && legKey ? featureLegId(featureSlug, legKey) : null);
  return (
    <Link href={href} className="k-row k-line-subtle flex h-10 items-center gap-2.5 border-b px-4 text-[13px] last:border-b-0">
      <OngoingDot />
      <span className="truncate font-medium">{name}</span>
      <span className="k-fg3 ml-auto truncate text-[12px]">{pipe.data?.line ?? ""}</span>
    </Link>
  );
}

/** One cap as billing serves it: the cap, its window, what was consumed (or why it cannot be). */
function CapCell({ label, cap, kind }: { label: string; cap: SalesFunnelCaps["maxBudget"] | SalesFunnelCaps["maxVolume"]; kind: "budget" | "volume" }) {
  if (!cap) {
    return (
      <div className="min-w-0 px-4 py-3">
        <p className="k-label">{label}</p>
        <p className="k-fg3 mt-1 text-[13px]">No cap stated</p>
      </div>
    );
  }
  const b = kind === "budget" ? (cap as NonNullable<SalesFunnelCaps["maxBudget"]>) : null;
  const v = kind === "volume" ? (cap as NonNullable<SalesFunnelCaps["maxVolume"]>) : null;
  const amount = b ? centsToUsd(b.amountCents) : null;
  const consumed = b ? centsToUsd(b.consumedCents) : (v?.consumed ?? null);
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="k-label">{label}</p>
        {cap.reached != null && <span className={`text-[12px] ${cap.reached ? "text-[var(--data-amber)]" : "k-fg3"}`}>{cap.reached ? "Reached" : "Not reached"}</span>}
      </div>
      <p className="mt-1 text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">
        {b ? (amount == null ? "—" : formatUsdAdaptive(amount)) : formatCount(v!.count)}
        <span className="k-fg2 ml-1.5 text-[13px] font-normal">{producerWord(cap.period)}</span>
      </p>
      <p className="k-fg3 mt-0.5 text-[12px] tabular-nums">
        {consumed != null
          ? `${b ? formatUsdAdaptive(consumed as number) : formatCount(consumed as number)} ${b ? "spent" : v!.unit.replace(/_/g, " ")} since ${shortDate(cap.periodStart)}`
          : `Not measured: ${cap.consumedUnavailableReason ?? "no reason served"}`}
      </p>
    </div>
  );
}

/** A unit's pipe and picked workflow, named by the catalogue. */
function UnitRow({ unit, orgId, brandId }: { unit: SalesFunnelCampaign["units"][number]; orgId: string; brandId: string }) {
  const pipe = useStaffCatalogueObject("pipes", unit.pipeId);
  const wf = useStaffCatalogueObject("workflows", unit.workflowSlug, unit.workflowSlug ? unit.pipeId : null);
  const p = pipe.data;
  return (
    <tr className="k-row k-line-subtle border-b last:border-b-0">
      <td className={TD}>
        <Link href={v2CatalogueHref(orgId, brandId, "pipes", unit.pipeId)} className="flex min-w-0 items-center gap-2.5">
          <CatalogueMark icon={p?.icon ?? "bird"} color={p?.color} name={unit.name} size={24} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{p?.name ?? unit.name}</span>
            <span className="k-fg3 block truncate text-[12px]">{p?.line ?? unit.pipeId}</span>
          </span>
        </Link>
      </td>
      <td className={TD}>
        <StateDot running={unit.status === "ongoing"} label={producerWord(unit.status)} />
      </td>
      <td className={TD}>
        {unit.workflowSlug ? (
          <Link href={v2WorkflowHref(orgId, brandId, unit.workflowSlug, unit.pipeId, unit.campaignId)} className="flex min-w-0 items-center gap-2 hover:underline">
            <CatalogueMark icon="flow-arrow" color={wf.data?.color} name={unit.workflowSlug} size={18} />
            <span className="truncate">{wf.data?.name ?? unit.workflowSlug}</span>
          </Link>
        ) : (
          <span className="k-fg3">None picked</span>
        )}
      </td>
      <td className={`${TD} text-right`}>
        <Link href={v2CampaignHref(orgId, brandId, unit.campaignId)} className="k-fg2 whitespace-nowrap text-[12px] hover:text-[var(--fg-1)]">
          Campaign →
        </Link>
      </td>
    </tr>
  );
}

/**
 * ONE funnel campaign, staff view (owner 2026-10-10): what the GA campaign page does not show. Its
 * units (pipes) with the workflow each runs, its funnel id, the caps billing stops it on with what it
 * consumed, and why it stopped. The campaign's results live on each unit's GA campaign page.
 */
export function StaffFunnelCampaignPage({ id }: { id: string }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const q = useAuthQuery(["salesFunnelCampaign", id], () => getSalesFunnelCampaign(id), { ...pollOptions, enabled: !!id });
  const c = q.data;
  const caps = useAuthQuery(
    ["salesFunnelCaps", c?.brandId ?? null, c?.offerId ?? null, c?.salesFunnelId ?? null],
    () => getSalesFunnelCaps(c!.brandId, c!.offerId, c!.salesFunnelId),
    { ...pollOptions, enabled: !!c },
  );
  const funnel = useStaffCatalogueObject("sales-funnels", c?.salesFunnelId ?? null);
  const face = funnel.data?.face.svgPath ?? null;

  return (
    <>
      <TopBar
        crumbs={[
          { label: "Campaigns", href: v2CatalogueHref(orgId, brandId, "campaigns") },
          {
            label: c ? (
              <span className="inline-flex items-center gap-1.5">
                <CatalogueMark face={face} name={c.salesFunnelName} size={16} />
                {c.salesFunnelName}
              </span>
            ) : (
              "…"
            ),
          },
        ]}
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        {!c && !q.isFetchedAfterMount ? (
          <Shimmer className="h-40 rounded-xl" />
        ) : !c ? (
          <div className="k-card">
            <EmptyNote>Could not read this campaign.</EmptyNote>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-4">
              <CatalogueMark face={face} name={c.salesFunnelName} size={40} />
              <div className="min-w-0">
                <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{c.salesFunnelName}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <FunnelCampaignStatus status={c.status} />
                  {c.stopReason && <span className="k-chip">{producerWord(c.stopReason)}</span>}
                </div>
              </div>
            </div>
            {funnel.data && <p className="k-fg2 mt-3 text-[14px]">{funnel.data.line}</p>}

            <section className="mt-6">
              <SectionTitle>Caps read</SectionTitle>
              {!caps.data && !caps.isFetchedAfterMount ? (
                <Shimmer className="h-20 rounded-xl" />
              ) : !caps.data ? (
                <div className="k-card">
                  <EmptyNote>Could not read this funnel&apos;s caps. Its proactive pipes are held until billing answers.</EmptyNote>
                </div>
              ) : (
                <div className="k-card grid grid-cols-1 divide-y divide-[var(--line-subtle)] md:grid-cols-2 md:divide-x md:divide-y-0">
                  <CapCell label="Max budget" cap={caps.data.maxBudget} kind="budget" />
                  <CapCell label="Max volume" cap={caps.data.maxVolume} kind="volume" />
                </div>
              )}
            </section>

              <section className="mt-8 min-w-0">
                <SectionTitle count={c.units.length}>Units</SectionTitle>
                {c.units.length === 0 ? (
                  <div className="k-card">
                    <EmptyNote>This campaign has no unit.</EmptyNote>
                  </div>
                ) : (
                  <div className="k-card overflow-hidden">
                    <div className="k-scroll overflow-x-auto">
                      <table className="w-full min-w-[640px] text-[13px]">
                        <thead>
                          <tr className="k-line-subtle border-b">
                            <th className={TH}>Pipe</th>
                            <th className={TH}>Status</th>
                            <th className={TH}>Workflow picked</th>
                            <th className={TH} />
                          </tr>
                        </thead>
                        <tbody>
                          {c.units.map((u) => (
                            <UnitRow key={u.campaignId} unit={u} orgId={orgId} brandId={brandId} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
              <section className="mt-8">
                <SectionTitle>Details</SectionTitle>
                <div className="k-card px-4 py-2">
                  <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
                  <Fact label="Sales funnel">
                    <Link href={v2CatalogueHref(orgId, brandId, "sales-funnels", c.salesFunnelId)} className="hover:underline">
                      {c.salesFunnelName}
                    </Link>
                  </Fact>
                  <Fact label="Funnel id">
                    <span className="k-mono k-fg2 break-all text-[12px]">{c.salesFunnelId}</span>
                  </Fact>
                  <Fact label="Stop reason">{c.stopReason ? producerWord(c.stopReason) : null}</Fact>
                  <Fact label="Started">{shortDate(c.createdAt)}</Fact>
                  <Fact label="Last change">{shortDate(c.updatedAt)}</Fact>
                  <Fact label="Caps stated">{caps.data ? (caps.data.stated ? "Yes" : "No") : null}</Fact>
                  <Fact label="Campaign id">
                    <span className="k-mono k-fg2 break-all text-[12px]">{c.id}</span>
                  </Fact>
                  </dl>
                </div>
              </section>
          </>
        )}
      </div>
    </>
  );
}
