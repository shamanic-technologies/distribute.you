import { fetchLeaderboard } from "@/lib/performance/fetch-leaderboard";
import { PerformancePreview } from "@/components/performance-preview";

export async function LeaderboardSectionAsync() {
  const leaderboard = await fetchLeaderboard();
  if (!leaderboard || leaderboard.featureGroups.length === 0) {
    return null;
  }
  return <PerformancePreview featureGroups={leaderboard.featureGroups} />;
}
