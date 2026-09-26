"use client";

import { useRouter } from "next/navigation";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { formatCentsAsUsdAdaptive, formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { isLearning } from "@/lib/learning-threshold";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { CrewMark } from "@/components/v2/crew-mark";
import { EmptyNote, Shimmer, StateDot } from "@/components/v2/ui";
import type { Mission } from "@/components/v2/use-missions";

/**
 * What one result cost this mission, READ off the producer's own group for the step
 * the mission's leg lands on: a reply-led crew is priced per positive reply, a
 * visit-led one per website visit. Selecting which served field to show is display;
 * nothing is divided here. Under ten of that result the price reads `Learning`, the
 * bar every v1 price uses.
 */
function costPerResult(m: Mission): { value: string; unit: string } | null {
  const g = m.row.revenue;
  if (!g) return null;
  if (m.leg?.toKey === "conversation") {
    if (isLearning(g.positiveReplies)) return { value: "Learning", unit: "" };
    return g.cpprCents == null ? null : { value: formatCentsAsUsdAdaptive(g.cpprCents), unit: "/ reply" };
  }
  if (m.leg?.toKey === "website_visit") {
    if (isLearning(g.websiteClicks)) return { value: "Learning", unit: "" };
    return g.cpcCents == null ? null : { value: formatCentsAsUsdAdaptive(g.cpcCents), unit: "/ visit" };
  }
  return null;
}

const n = (v: number | null | undefined) => (v == null ? "—" : formatCount(v));
const TH = "k-label px-3 py-2.5 text-left font-medium";

/**
 * Missions, one row per campaign identity (a crew working one offer), running first.
 * Explee's campaigns table in Keel's table style. The last cell is v1's own controls
 * pill for that one campaign: status and daily ceiling are changed through the modal v1
 * uses, so v2 adds no write.
 */
export function MissionsTable({
  brandId,
  missions,
  settled,
}: {
  brandId: string;
  missions: Mission[];
  settled: boolean;
}) {
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  return (
    <div className="k-card overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              <th className={`${TH} pl-4`}>Mission</th>
              <th className={TH}>State</th>
              <th className={`${TH} text-right`}>Visits</th>
              <th className={`${TH} text-right`}>Pos. replies</th>
              <th className={`${TH} text-right`}>Cost / result</th>
              <th className={`${TH} text-right`}>Spent</th>
              <th className={`${TH} text-right`}>ROI</th>
              <th className={`${TH} pr-4 text-right`}>Daily ceiling</th>
            </tr>
          </thead>
          <tbody>
            {!settled ? (
              [0, 1, 2].map((i) => (
                <tr key={i} className="k-row">
                  <td colSpan={8} className="px-4 py-3">
                    <Shimmer className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : missions.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyNote>No mission yet. A mission starts when a crew is funded for one of your offers.</EmptyNote>
                </td>
              </tr>
            ) : (
              missions.map((m) => {
                const g = m.row.revenue;
                const cost = costPerResult(m);
                return (
                  <tr
                    key={m.row.campaign.id}
                    className="k-row cursor-pointer"
                    onClick={() => router.push(m.href)}
                    onMouseEnter={() => prefetch(m.href)}
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={24} />
                        <div className="min-w-0">
                          <p className="truncate">
                            <span className="font-medium">{m.crew.name}</span>
                            {m.offerName && <span className="k-fg2"> · {m.offerName}</span>}
                          </p>
                          <p className="k-fg3 truncate text-[12px]">{m.leg?.label ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <StateDot running={m.running} hold={m.paymentHold} />
                    </td>
                    <td className="px-3 text-right tabular-nums">{n(g?.websiteClicks)}</td>
                    <td className="px-3 text-right tabular-nums">{n(g?.positiveReplies)}</td>
                    <td className="px-3 text-right tabular-nums">
                      {cost ? (
                        cost.unit ? (
                          <>
                            {cost.value} <span className="k-fg3 text-[12px]">{cost.unit}</span>
                          </>
                        ) : (
                          <span className="k-chip">{cost.value}</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      {g?.committedCostUsd != null ? formatUsdAdaptive(g.committedCostUsd) : "—"}
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      {m.row.learning ? <span className="k-chip">Learning</span> : formatRoi(g?.roiMultiple)}
                    </td>
                    <td className="py-2 pl-3 pr-4" onClick={(e) => e.stopPropagation()}>
                      <CampaignControlsTrigger
                        brandId={brandId}
                        campaignId={m.row.campaign.id}
                        totalCentsOverride={m.row.budgetCents}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
