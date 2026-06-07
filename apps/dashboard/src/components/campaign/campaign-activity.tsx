"use client";

import { useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { listCampaignEvents } from "@/lib/api";
import {
  toActivityFeed,
  ACTIVITY_PLACEHOLDER,
  ACTIVITY_FEED_SIZE,
  type ActivityItem,
} from "@/lib/campaign-activity";

/**
 * Live activity feed on the campaign overview — the last few user-meaningful
 * steps the platform is running, in plain present-tense ("Finding your next
 * lead", "Sending the email"). It exists to reassure: right after a user adds
 * credits and launches, the heavy work takes minutes, and a silent screen reads
 * as "nothing happened". This shows the work in flight instead.
 *
 * Source = run_events (already campaignId-scoped server-side). We pull a generous
 * window and keep only the allowlisted funnel steps (`lib/campaign-activity.ts`),
 * so a noise-heavy recent window (billing / polling / orchestration) still yields
 * the real steps. Errors are never shown — see the allowlist module.
 */
const EVENTS_WINDOW = 150;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ActivityLine({ item, live }: { item: ActivityItem; live: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200">
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        {live && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live ? "bg-brand-500" : "bg-gray-300"}`}
        />
      </span>
      <span
        className={`text-sm font-medium truncate ${live ? "text-gray-800" : "text-gray-500"}`}
      >
        {item.label}
      </span>
      <span className="flex-1" />
      <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(item.createdAt)}</span>
    </div>
  );
}

export function CampaignActivity({ campaignId }: { campaignId: string }) {
  const { data, isPending } = useAuthQuery(
    ["campaignActivity", campaignId],
    () => listCampaignEvents(campaignId, { limit: EVENTS_WINDOW }),
    { ...pollOptions, placeholderData: keepPreviousData },
  );

  const feed = useMemo(() => toActivityFeed(data?.events ?? []), [data]);

  return (
    <section className="mb-6">
      {/* Static shell — header paints on first frame, only the lines skeleton. */}
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
        </span>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Live activity
        </h3>
      </div>

      <div className="space-y-2">
        {isPending && !data ? (
          Array.from({ length: ACTIVITY_FEED_SIZE }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200"
            >
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))
        ) : feed.length === 0 ? (
          // Never an empty card — the silence is exactly the anxiety we kill.
          <ActivityLine
            item={{ id: "placeholder", label: ACTIVITY_PLACEHOLDER, createdAt: new Date().toISOString() }}
            live
          />
        ) : (
          feed.map((item, i) => <ActivityLine key={item.id} item={item} live={i === 0} />)
        )}
      </div>
    </section>
  );
}
