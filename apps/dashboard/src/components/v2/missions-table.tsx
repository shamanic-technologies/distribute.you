"use client";

import Link from "next/link";
import { Skeleton } from "@/components/skeleton";
import { LearningTag } from "@/components/learning-tag";
import { RoiCell, fmtUsd } from "@/components/campaigns/campaigns-table";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { formatCentsAsUsdAdaptive, formatCount } from "@/lib/format-number";
import { crewInitial } from "@/lib/v2/crews";
import type { Mission } from "@/components/v2/use-missions";

/**
 * What one result cost this mission, READ off the producer's own group for the step
 * the mission's leg lands on: a reply-led crew is priced per positive reply, a
 * visit-led one per website visit. Selecting which served field to show is display;
 * nothing is divided here. A leg with no served price states none.
 */
function costPerResult(m: Mission): { value: string; unit: string } | null {
  const g = m.row.revenue;
  if (!g) return null;
  if (m.leg?.toKey === "conversation") {
    return g.cpprCents == null ? null : { value: formatCentsAsUsdAdaptive(g.cpprCents), unit: "reply" };
  }
  if (m.leg?.toKey === "website_visit") {
    return g.cpcCents == null ? null : { value: formatCentsAsUsdAdaptive(g.cpcCents), unit: "visit" };
  }
  return null;
}

function count(n: number | null | undefined): string {
  return n == null ? "—" : formatCount(n);
}

const TH = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500";
const TH_NUM = `${TH} text-right`;

/**
 * Missions, one row per campaign identity (a crew working one offer), running first.
 *
 * Explee's campaigns table in our grain. The STATE cell is the v1 controls pill scoped
 * to the one campaign, so a status and a daily ceiling are read and changed through
 * the same modal v1 uses — no new write exists in v2. Per-mission SENT and REPLY RATE
 * are not served per campaign yet, so they are absent rather than computed here.
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
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed md:min-w-[900px] md:table-auto">
          <thead className="border-b border-gray-100 bg-gray-50/60">
            <tr>
              <th className={`${TH} w-[68%] md:w-auto`}>Mission</th>
              <th className={`${TH} hidden md:table-cell`}>State</th>
              <th className={`${TH_NUM} hidden md:table-cell`}>Positive replies</th>
              <th className={`${TH_NUM} hidden md:table-cell`}>Website visits</th>
              <th className={`${TH_NUM} hidden md:table-cell`}>Cost / result</th>
              <th className={`${TH_NUM} w-[32%] md:w-auto`}>Spent</th>
              <th className={`${TH_NUM} hidden md:table-cell`}>ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!settled ? (
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  <td className="px-3 py-3" colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : missions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                  No missions here yet.
                </td>
              </tr>
            ) : (
              missions.map((m) => {
                const cost = costPerResult(m);
                const g = m.row.revenue;
                return (
                  <tr key={m.row.campaign.id} className="align-middle hover:bg-gray-50/60">
                    <td className="px-3 py-2.5">
                      <Link href={m.href} className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${m.crew.tone}`}
                        >
                          {crewInitial(m.crew.name)}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-gray-900">
                            {m.crew.name}
                            {m.offerName && <span className="font-normal text-gray-500"> · {m.offerName}</span>}
                          </span>
                          <span className="truncate text-xs text-gray-500">{m.leg?.label ?? "—"}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <CampaignControlsTrigger
                        brandId={brandId}
                        offerId={m.offerId}
                        campaignId={m.row.campaign.id}
                        totalCentsOverride={m.row.budgetCents}
                        className="justify-start"
                      />
                    </td>
                    <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-gray-700 md:table-cell">
                      {count(g?.positiveReplies)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-gray-700 md:table-cell">
                      {count(g?.websiteClicks)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-gray-700 md:table-cell">
                      {m.row.learning ? (
                        <LearningTag paused={!m.running} withInfo={false} />
                      ) : cost ? (
                        <>
                          {cost.value}
                          <span className="text-gray-400"> / {cost.unit}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-gray-700">
                      {fmtUsd(g?.committedCostUsd)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right text-sm md:table-cell">
                      {m.row.learning ? <LearningTag paused={!m.running} withInfo={false} /> : <RoiCell multiple={g?.roiMultiple} />}
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
