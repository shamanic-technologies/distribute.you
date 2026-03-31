const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

export interface BrandEntry {
  brandDomain: string | null;
  brandName?: string | null;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
}

export interface WorkflowEntry {
  workflowName: string;
  dynastyName: string;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
}

export interface LeaderboardPreview {
  brands: BrandEntry[];
  workflows: WorkflowEntry[];
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
    const res = await fetch(`${API_URL}/v1/public/workflows/ranked?featureDynastySlug=sales-cold-email-outreach&objective=emailsReplied&limit=3`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const data: { results: PublicRankedItem[] } = await res.json();

    const workflows: WorkflowEntry[] = data.results.map((item) => {
      return {
        workflowName: item.workflow.name,
        dynastyName: item.workflow.dynastyName ?? item.workflow.name,
        emailsSent: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        costPerOpenCents: null,
        costPerClickCents: null,
        costPerReplyCents: item.stats.costPerOutcome,
      };
    });

    // No brand data from public ranked endpoint — return empty
    return { brands: [], workflows };
  } catch {
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
