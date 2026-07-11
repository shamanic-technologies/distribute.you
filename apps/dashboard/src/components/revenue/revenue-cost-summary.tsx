"use client";

import { useMemo, type ReactNode } from "react";
import { getPlatformPrices } from "@/lib/api";
import type { Spend } from "@/lib/revenue-view";
import { useAuthQuery } from "@/lib/use-auth-query";
import { ProviderLogo } from "@/components/provider-logo";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";

// Committed-spend (= actual + provisioned) explainers. The figure can DIP when a
// reserved follow-up sends (becomes a billed charge) or is cancelled (contact
// replied / couldn't be reached) — the tooltip tells the user why it moves.
const TOTAL_SPENT_TIP =
  "What you've committed so far: money already billed plus credits reserved for follow-up emails we've scheduled. It can dip when a reserved follow-up sends or gets cancelled because a contact replied or couldn't be reached.";
const TODAY_SPENT_TIP =
  "Committed today: billed plus credits reserved for follow-ups scheduled today. It can dip when a reserved follow-up sends or gets cancelled because a contact replied or couldn't be reached.";

/**
 * Cost summary for the feature Overview — actual spend and the top-3 cost
 * sources (provider logo + share, no $ amounts). Every figure (Total spent,
 * Budget spent today, the top-3 sources + their share %) is read VERBATIM from
 * the features-service `/revenue` `spend` block — the dashboard no longer sums
 * the runs breakdown or computes provider shares in the browser (that diverged
 * from the displayed Total spent).
 */

function formatCostName(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUsd(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  const fractionDigits = usd < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function formatUsdWithCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Daily budget always renders as whole dollars (no cents), regardless of magnitude.
function formatBudgetCents(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function RevenueCostSummary({
  spend = null,
  dailyBudgetCents = null,
  pending = false,
  costPending,
  todayCostPending,
  bottomCard,
}: {
  /** features-service `/revenue` spend block — the single source for Total spent,
   *  Budget spent today, and the top-3 cost sources (+ share %). Null on a cold /
   *  pre-rollout payload → the figures render $0 / no sources. */
  spend?: Spend | null;
  dailyBudgetCents?: number | null;
  pending?: boolean;
  /** Reveal gate for the Total-spent figure when it resolves on a DIFFERENT chain
   *  than the revenue data. The feature Overview now sources spend from `/revenue`
   *  itself, so it passes the revenue reveal here; other consumers omit it →
   *  falls back to `pending` (single reveal). */
  costPending?: boolean;
  /** Reveal gate for today's actual spend window. */
  todayCostPending?: boolean;
  /** Replaces the default "Top cost sources" card (e.g. a campaign budget card
   *  on the campaign page, where a brand-wide cost-source split doesn't apply). */
  bottomCard?: ReactNode;
}) {
  // Total-spent reveals on its own source where given; otherwise tracks `pending`.
  const totalSpentPending = costPending ?? pending;
  const budgetSpentPending = todayCostPending ?? totalSpentPending;

  // Static catalog → costName -> providerDomain for the provider logos (the only
  // client-side join: the provider-domain decomposition lives in the price
  // catalog, not features-service; the spend amounts/shares come from the server).
  const { data: platformPrices } = useAuthQuery(
    ["platformPrices"],
    () => getPlatformPrices(),
    { staleTime: 60 * 60 * 1000 },
  );
  const domainByCost = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of platformPrices ?? []) m.set(p.name, p.providerDomain);
    return m;
  }, [platformPrices]);

  // All spend figures are server-computed (features-service#396) — rendered
  // verbatim, no client reduce / share-% math.
  // Committed (= actual + provisioned). features-service keeps `totalSpentCents` (value
  // flips to committed when it lands) and renames today's field to `totalSpentTodayCents`;
  // read it in preference to the legacy `todaySpentCents` so the dashboard works across
  // the rollout. Server-provided either way — no client actual+provisioned sum.
  const totalCostUsd = (spend?.totalSpentCents ?? 0) / 100;
  const todayCommittedCents = spend?.totalSpentTodayCents ?? spend?.todaySpentCents ?? 0;
  const top3 = (spend?.sources ?? []).slice(0, 3).map((s) => ({
    name: s.source,
    pct: s.sharePct,
    domain: domainByCost.get(s.source) ?? null,
  }));

  // Right-of-chart column on the Overview: Total spent plus a compact top-3
  // cost-source list.
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {/* Card frames + labels render instantly; only the value waits. */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs text-gray-400">Budget spent today</p>
                <InfoTooltip tip={TODAY_SPENT_TIP} />
              </div>
              {budgetSpentPending ? (
                <Skeleton className="mt-1 h-7 w-28" />
              ) : (
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                  {formatUsdWithCents(todayCommittedCents)}
                  {dailyBudgetCents != null && dailyBudgetCents > 0 ? (
                    <span className="text-sm font-medium text-gray-400">/{formatBudgetCents(dailyBudgetCents)}</span>
                  ) : null}
                </p>
              )}
            </div>
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-1">
                <p className="text-xs text-gray-400">Total spent</p>
                <InfoTooltip tip={TOTAL_SPENT_TIP} />
              </div>
              {totalSpentPending ? (
                <Skeleton className="ml-auto mt-1 h-7 w-24" />
              ) : (
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{formatUsd(totalCostUsd)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom card — the campaign page swaps in its own (budget) card via
          `bottomCard`; the Overview keeps the default Top-3 cost-source list. */}
      {bottomCard !== undefined ? bottomCard : pending ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top cost sources</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      ) : top3.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top cost sources</p>
          {top3.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <ProviderLogo domain={s.domain} size={16} />
              <span className="text-sm text-gray-700 flex-1 truncate">{formatCostName(s.name)}</span>
              <span className="text-sm font-medium text-gray-800 tabular-nums">{Math.round(s.pct)}%</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
