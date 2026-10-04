"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatRatePct, pathStepReach, roiUnavailableLabel, type PathStepReach, type SalesPathRow } from "@/lib/offer-sales-paths";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { v2OfferHref } from "@/lib/v2/routes";
import { useActiveSalesPath } from "@/components/v2/active-sales-path";
import { ChannelChip, PathAvatar, PathBreakdown, PathLinks } from "@/components/v2/offer-sales-paths";
import { V2Page, useOfferName } from "@/components/v2/setup-pages";
import { EmptyNote, Figure, SectionTitle, Shimmer, StateDot, StatTile } from "@/components/v2/ui";

const usd = (v: number | null | undefined) => (v == null ? <span className="k-fg4">{"—"}</span> : formatUsdAdaptive(v));

/**
 * The campaign an offer runs: its active sales path (the one the Sales path page frames
 * as Active), opened from the sidebar's Campaigns group. What one paying client costs and
 * brings, the expected ROI, then each step of the path with the people measured on it.
 * Every figure is served by features-service; this draws and never divides.
 */
export function V2OfferCampaignPage() {
  const { orgId, brandId, offerId } = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const name = useOfferName(brandId, offerId);
  const { active, settled, failed } = useActiveSalesPath(brandId, offerId);
  const salesPathHref = v2OfferHref(orgId, brandId, offerId, "sales-path");

  return (
    <V2Page
      crumbs={[
        { label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) },
        { label: "Campaign" },
      ]}
      title={
        active ? (
          <span className="flex items-center gap-3">
            <PathAvatar name={active.name} size={40} />
            {active.name}
          </span>
        ) : (
          name ?? " "
        )
      }
      sub={active ? <StateDot running label="Active" /> : undefined}
      width="max-w-[1280px]"
    >
      {!settled ? (
        <div className="space-y-3">
          <Shimmer className="h-[92px] rounded-[12px]" />
          <Shimmer className="h-[260px] rounded-[12px]" />
        </div>
      ) : failed ? (
        <div className="k-card">
          <EmptyNote>Could not read this offer&apos;s campaign.</EmptyNote>
        </div>
      ) : !active ? (
        <div className="k-card">
          <EmptyNote>
            No campaign runs on this offer yet.{" "}
            <Link href={salesPathHref} className="text-[var(--accent)] hover:underline">
              Open the sales path
            </Link>
          </EmptyNote>
        </div>
      ) : (
        <CampaignBody path={active} />
      )}
    </V2Page>
  );
}

/** The running path's money, its steps with the people on each, then how each step is priced. */
export function CampaignBody({ path }: { path: SalesPathRow }) {
  return (
    <div className="space-y-8">
      <p className="k-fg2 -mt-2 text-[13px]">
        <PathLinks path={path} />
      </p>

      <section>
        <SectionTitle>Per paying client</SectionTitle>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label="Cost">
            <Figure value={usd(path.costPerPayingClientUsd)} />
          </StatTile>
          <StatTile label="Expected value">
            <Figure value={usd(path.lifetimeRevenueUsd)} />
          </StatTile>
          <StatTile label="Expected ROI" note={roiUnavailableLabel(path.roiUnavailableReason) ?? undefined}>
            <Figure
              value={
                path.roi == null ? (
                  <span className="k-fg4">{"—"}</span>
                ) : (
                  <span className={roiIsGood(path.roi) ? "text-[var(--run)]" : ""}>{formatRoi(path.roi)}</span>
                )
              }
            />
          </StatTile>
          <StatTile label="Entry to paying client">
            <Figure value={path.entryToPayingClientPct == null ? <span className="k-fg4">{"—"}</span> : formatRatePct(path.entryToPayingClientPct)} />
          </StatTile>
        </div>
      </section>

      <PathSteps rows={pathStepReach(path)} />

      <section>
        <SectionTitle>How each step is priced</SectionTitle>
        <div className="k-card overflow-hidden">
          <PathBreakdown path={path} />
        </div>
      </section>
    </div>
  );
}

/**
 * The path's steps left to right, one bar each: the people measured on the step (count
 * above, drawn against the step with the most), its label, then the rate kept into it
 * and the channel working the leg that lands on it.
 */
function PathSteps({ rows }: { rows: PathStepReach[] }) {
  const channels = useAcquisitionChannels();
  const most = Math.max(0, ...rows.map((r) => r.reached ?? 0));
  return (
    <section>
      <SectionTitle right={<span>Since you started</span>}>Outcomes delivered</SectionTitle>
      <div className="k-card p-4">
        <div className="flex items-end gap-3">
          {rows.map(({ step, leg, reached }) => (
            <div key={leg.legKey} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              {reached === null ? (
                <span className="k-fg4 text-[13px]">{"—"}</span>
              ) : (
                <span className="text-[13px] font-medium tabular-nums">{formatCount(reached)}</span>
              )}
              <div className="k-inset flex h-[140px] w-full max-w-[56px] flex-col justify-end overflow-hidden rounded-[6px]">
                <div className="w-full bg-[var(--accent)]" style={{ height: barHeight(reached ?? 0, most) }} />
              </div>
              <span className="k-fg text-center text-[12px] font-medium leading-4">{step.label}</span>
              <span className="k-fg3 text-center text-[11px] leading-4 tabular-nums">
                {leg.fromStep ? `${formatRatePct(leg.conversionRatePct)} kept` : "Entry"}
              </span>
              {leg.workedBy !== "human" && leg.channel?.name ? (
                <ChannelChip
                  name={leg.channel.name}
                  def={channels.find((c) => c.featureSlug === leg.channel?.slug)}
                  notRun={leg.channel.managed === false}
                />
              ) : (
                <span className="k-fg3 text-[11px]">Your team</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** A bar's drawn height: the count against the step with the most, never below a visible sliver. */
function barHeight(count: number, of: number): string {
  if (of <= 0 || count <= 0) return "0%";
  return `${Math.max(1.5, Math.min(100, (count * 100) / of))}%`;
}
