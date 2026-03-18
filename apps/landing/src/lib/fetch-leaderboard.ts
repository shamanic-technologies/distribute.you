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
  displayName: string;
  category: string | null;
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

interface PublicEmailStats {
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  emailsBounced: number;
  emailsDelivered: number;
}

interface PublicRankedItem {
  workflow: {
    name: string;
    displayName: string | null;
    category: string;
  };
  stats: {
    totalCostInUsdCents: number;
    email: {
      broadcast: PublicEmailStats;
    };
  };
}

export async function fetchLeaderboardPreview(): Promise<LeaderboardPreview | null> {
  try {
    const res = await fetch(`${API_URL}/v1/public/workflows/ranked?limit=3`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const data: { results: PublicRankedItem[] } = await res.json();

    const workflows: WorkflowEntry[] = data.results.map((item) => {
      const b = item.stats.email.broadcast;
      const cost = item.stats.totalCostInUsdCents;
      return {
        workflowName: item.workflow.name,
        displayName: item.workflow.displayName ?? item.workflow.name,
        category: item.workflow.category,
        emailsSent: b.emailsSent,
        openRate: b.emailsSent > 0 ? b.emailsOpened / b.emailsSent : 0,
        clickRate: b.emailsSent > 0 ? b.emailsClicked / b.emailsSent : 0,
        replyRate: b.emailsSent > 0 ? b.emailsReplied / b.emailsSent : 0,
        costPerOpenCents: b.emailsOpened > 0 ? cost / b.emailsOpened : null,
        costPerClickCents: b.emailsClicked > 0 ? cost / b.emailsClicked : null,
        costPerReplyCents: b.emailsReplied > 0 ? cost / b.emailsReplied : null,
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
