const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

export interface FeaturePreviewStats {
  featureSlug: string;
  featureLabel: string;
  replyRate: number;
  costPerReplyCents: number | null;
}

export interface LeaderboardPreview {
  features: FeaturePreviewStats[];
}

interface FeatureListItem {
  dynastyName: string;
  dynastySlug: string;
}

interface PublicRankedItem {
  workflow: {
    name: string;
    dynastyName: string | null;
  };
  stats: {
    totalCostInUsdCents: number;
    totalOutcomes: number;
    costPerOutcome: number | null;
    completedRuns: number;
  };
}

export async function fetchLeaderboardPreview(): Promise<LeaderboardPreview | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };

    // Step 1: Fetch feature list
    const featuresRes = await fetch(`${API_URL}/public/features`, {
      headers,
      next: { revalidate: 300 },
    });
    if (!featuresRes.ok) {
      console.error(`[landing] Features fetch failed: ${featuresRes.status}`);
      return null;
    }
    const featuresData: { features: FeatureListItem[] } = await featuresRes.json();
    const featureList = featuresData.features;

    if (featureList.length === 0) {
      console.error("[landing] No features returned from api-service");
      return null;
    }

    // Step 2: For each feature, fetch emailsSent and emailsReplied to compute reply rate + cost/reply
    const features = await Promise.all(
      featureList.map(async (feature) => {
        const [sentRes, repliedRes] = await Promise.all([
          fetch(
            `${API_URL}/v1/public/features/ranked?featureDynastySlug=${encodeURIComponent(feature.dynastySlug)}&objective=emailsSent&groupBy=workflow&limit=100`,
            { headers, next: { revalidate: 300 } },
          ),
          fetch(
            `${API_URL}/v1/public/features/ranked?featureDynastySlug=${encodeURIComponent(feature.dynastySlug)}&objective=emailsReplied&groupBy=workflow&limit=100`,
            { headers, next: { revalidate: 300 } },
          ),
        ]);

        let totalSent = 0;
        let totalReplied = 0;
        let totalCostCents = 0;

        if (sentRes.ok) {
          const sentData: { results: PublicRankedItem[] } = await sentRes.json();
          totalSent = sentData.results.reduce((s, r) => s + r.stats.totalOutcomes, 0);
          totalCostCents = sentData.results.reduce((s, r) => s + r.stats.totalCostInUsdCents, 0);
        }

        if (repliedRes.ok) {
          const repliedData: { results: PublicRankedItem[] } = await repliedRes.json();
          totalReplied = repliedData.results.reduce((s, r) => s + r.stats.totalOutcomes, 0);
        }

        return {
          featureSlug: feature.dynastySlug,
          featureLabel: feature.dynastyName,
          replyRate: totalSent > 0 ? totalReplied / totalSent : 0,
          costPerReplyCents: totalReplied > 0 ? totalCostCents / totalReplied : null,
        };
      }),
    );

    return { features };
  } catch (error) {
    console.error("[landing] Leaderboard preview fetch error:", error);
    return null;
  }
}

export function formatPercent(rate: number): string {
  if (rate === 0) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatCostCents(cents: number | null): string {
  if (cents === null || cents === 0) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
