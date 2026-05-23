import { connection } from "next/server";
import { fetchLeaderboard } from "@/lib/performance/fetch-leaderboard";
import { PerformancePreview } from "@/components/performance-preview";

export async function LeaderboardSectionAsync() {
  // Opt this subtree into dynamic rendering so Next does NOT try to resolve
  // fetchLeaderboard() during build-time prerender. The <Suspense> boundary
  // on the homepage renders the skeleton at build time and streams the real
  // leaderboard at request time. Without this, ~10 api-service calls per
  // homepage prerender push the worker past Vercel's 60s timeout when the
  // backend is under load.
  await connection();
  const leaderboard = await fetchLeaderboard();
  if (!leaderboard || leaderboard.featureGroups.length === 0) {
    return null;
  }
  return <PerformancePreview featureGroups={leaderboard.featureGroups} />;
}
