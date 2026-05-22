import { fetchLeaderboard } from "@/lib/performance/fetch-leaderboard";
import { PerformancePreview } from "@/components/performance-preview";

interface LeaderboardSectionAsyncProps {
  host: string;
}

export async function LeaderboardSectionAsync({ host }: LeaderboardSectionAsyncProps) {
  const leaderboard = await fetchLeaderboard(host);
  if (!leaderboard || leaderboard.featureGroups.length === 0) {
    return null;
  }
  return <PerformancePreview featureGroups={leaderboard.featureGroups} />;
}
