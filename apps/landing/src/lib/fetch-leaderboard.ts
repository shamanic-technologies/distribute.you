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
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  recipients: number;
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
        emailsSent: b.sent,
        openRate: b.sent > 0 ? b.opened / b.sent : 0,
        clickRate: b.sent > 0 ? b.clicked / b.sent : 0,
        replyRate: b.sent > 0 ? b.replied / b.sent : 0,
        costPerOpenCents: b.opened > 0 ? cost / b.opened : null,
        costPerClickCents: b.clicked > 0 ? cost / b.clicked : null,
        costPerReplyCents: b.replied > 0 ? cost / b.replied : null,
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
