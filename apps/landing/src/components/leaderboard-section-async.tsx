import { fetchLeaderboard } from "@/lib/performance/fetch-leaderboard";
import { PerformancePreview } from "@/components/performance-preview";

export async function LeaderboardSectionAsync() {
  // fetchLeaderboard is wrapped in `unstable_cache` (revalidate 300s) so the
  // build-time prerender uses cached data when available. No `connection()`
  // is needed to defer to request time.
  const leaderboard = await fetchLeaderboard();
  if (!leaderboard || leaderboard.featureGroups.length === 0) {
    return null;
  }
  return <PerformancePreview featureGroups={leaderboard.featureGroups} />;
}
