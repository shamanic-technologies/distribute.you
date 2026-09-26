"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { getBrandRunsByCampaign, listBrandRunLedger, type CampaignRunGroup, type RunRow } from "@/lib/api";
import type { Mission } from "@/components/v2/use-missions";

/**
 * runs-service, read the way Keel reads its agents: runs today, a week of daily run
 * counts, the spend those runs carried, when the last one started, and the latest runs
 * themselves. Every figure is served per campaign; the only step here is filing each
 * campaign's served group under the crew that works it (a display join, the same one
 * the People table makes), and adding counts that are disjoint by construction (a run
 * belongs to exactly one campaign).
 */

/** Local midnight, `daysAgo` days back, as an ISO instant. */
export function localDayStart(daysAgo = 0, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return d.toISOString();
}

export function useRunsToday(brandId: string) {
  const start = localDayStart(0);
  return useAuthQuery(
    ["v2RunsByCampaign", brandId, start],
    () => getBrandRunsByCampaign(brandId, { startedAfter: start }),
    { enabled: !!brandId, refetchInterval: POLL_INTERVAL },
  );
}

/** The last 7 local days, oldest first, one served roll-up per day. */
export function useRunsWeek(brandId: string) {
  const today = localDayStart(0);
  return useAuthQuery(
    ["v2RunsWeek", brandId, today],
    () =>
      Promise.all(
        Array.from({ length: 7 }, (_, i) => 6 - i).map((ago) =>
          getBrandRunsByCampaign(brandId, {
            startedAfter: localDayStart(ago),
            startedBefore: ago === 0 ? undefined : localDayStart(ago - 1),
          }),
        ),
      ),
    { enabled: !!brandId, refetchInterval: 60_000 },
  );
}

export function useRecentRuns(brandId: string, limit = 60) {
  return useAuthQuery(
    ["v2RecentRuns", brandId, limit],
    () => listBrandRunLedger(brandId, { limit }),
    { enabled: !!brandId, refetchInterval: POLL_INTERVAL },
  );
}

/** Today's runs themselves, newest first, bounded. `complete` is false when the cap cut it. */
export function useRunsTodayList(brandId: string, limit = 200) {
  const start = localDayStart(0);
  const q = useAuthQuery(
    ["v2RecentRuns", brandId, limit, start],
    () => listBrandRunLedger(brandId, { limit, startedAfter: start }),
    { enabled: !!brandId, refetchInterval: POLL_INTERVAL },
  );
  return { ...q, complete: q.data ? q.data.length < limit : false };
}

export interface CrewRuns {
  runsToday: number;
  spendTodayCents: number;
  lastRunAt: string | null;
  /** Runs per local day, oldest first, the last one today. */
  week: number[];
}

/** Files each campaign's served roll-up under the crew whose mission it is. */
export function useCrewRuns(
  brandId: string,
  missionByCampaignId: Map<string, Mission>,
): { byCrew: Map<string, CrewRuns>; settled: boolean } {
  const today = useRunsToday(brandId);
  const week = useRunsWeek(brandId);
  const byCrew = useMemo(() => {
    const out = new Map<string, CrewRuns>();
    const slot = (key: string) => {
      let r = out.get(key);
      if (!r) {
        r = { runsToday: 0, spendTodayCents: 0, lastRunAt: null, week: [0, 0, 0, 0, 0, 0, 0] };
        out.set(key, r);
      }
      return r;
    };
    const crewOf = (g: CampaignRunGroup) => (g.campaignId ? missionByCampaignId.get(g.campaignId)?.crew.key : undefined);
    for (const g of today.data ?? []) {
      const key = crewOf(g);
      if (!key) continue;
      const r = slot(key);
      r.runsToday += g.runCount;
      r.spendTodayCents += g.totalCostInUsdCents;
      if (g.maxStartedAt && (!r.lastRunAt || g.maxStartedAt > r.lastRunAt)) r.lastRunAt = g.maxStartedAt;
    }
    (week.data ?? []).forEach((day, i) => {
      for (const g of day) {
        const key = crewOf(g);
        if (!key) continue;
        const r = slot(key);
        r.week[i] += g.runCount;
        if (g.maxStartedAt && (!r.lastRunAt || g.maxStartedAt > r.lastRunAt)) r.lastRunAt = g.maxStartedAt;
      }
    });
    return out;
  }, [today.data, week.data, missionByCampaignId]);
  return { byCrew, settled: (today.data !== undefined || today.isError) && (week.data !== undefined || week.isError) };
}

/** A run's step in words: the task runs-service recorded, made readable. */
export function runTaskLabel(run: RunRow): string {
  const t = run.taskName;
  const send = /^email-send-step-(\d+)$/.exec(t);
  if (send) return send[1] === "1" ? "Sent the first email" : `Sent follow-up ${Number(send[1]) - 1}`;
  if (t === "execute-workflow") return "Started a run";
  if (/serve|buffer\/next|lead/i.test(t)) return "Found a lead";
  if (/generate|content/i.test(t) || run.serviceName === "content-generation-service") return "Wrote an email";
  if (/opportunit/i.test(t)) return "Looked for a press request";
  if (/complete|chat/i.test(t) || run.serviceName === "chat-service") return "Thought it through";
  if (/scrape|extract/i.test(t)) return "Read a website";
  if (/enrich|apollo/i.test(t) || run.serviceName === "apollo-service") return "Enriched a contact";
  return t.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/, "").replace(/[-_/]+/g, " ").trim();
}

export type RunState = "done" | "failed" | "running";

export function runState(run: RunRow): RunState {
  if (run.status === "failed" || run.status === "error") return "failed";
  if (run.completedAt || run.status === "completed") return "done";
  return "running";
}
