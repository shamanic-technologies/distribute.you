import { fetchFeatureBenchmark } from "@/lib/benchmarks/fetch-benchmark";
import { PerformancePreview } from "@/components/performance-preview";

// The public landing sells one product: sales cold email. The home performance
// section previews that feature's open dataset (platform averages + the top
// brand leaderboard), mirroring the full /benchmarks/sales-cold-email-outreach
// page. fetchFeatureBenchmark is wrapped in `unstable_cache` (revalidate 300s).
const HOME_BENCHMARK_SLUG = "sales-cold-email-outreach";

export async function LeaderboardSectionAsync() {
  const data = await fetchFeatureBenchmark(HOME_BENCHMARK_SLUG);
  if (!data) return null;
  return <PerformancePreview data={data} />;
}
