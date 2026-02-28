const API_SERVICE_URL = process.env.API_SERVICE_URL || "http://localhost:3000";

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

export async function fetchLeaderboardPreview(): Promise<LeaderboardPreview | null> {
  try {
    const res = await fetch(`${API_SERVICE_URL}/performance/leaderboard`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const data = await res.json();

    const brands: BrandEntry[] = (data.brands || []).slice(0, 3).map((b: Record<string, unknown>) => ({
      brandDomain: b.brandDomain as string | null,
      brandName: b.brandName as string | null,
      emailsSent: b.emailsSent as number,
      openRate: b.openRate as number,
      clickRate: b.clickRate as number,
      replyRate: b.replyRate as number,
      costPerOpenCents: b.costPerOpenCents as number | null,
      costPerClickCents: b.costPerClickCents as number | null,
      costPerReplyCents: b.costPerReplyCents as number | null,
    }));

    const workflows: WorkflowEntry[] = (data.workflows || []).slice(0, 3).map((w: Record<string, unknown>) => ({
      workflowName: w.workflowName as string,
      displayName: w.displayName as string,
      category: w.category as string | null,
      emailsSent: w.emailsSent as number,
      openRate: w.openRate as number,
      clickRate: w.clickRate as number,
      replyRate: w.replyRate as number,
      costPerOpenCents: w.costPerOpenCents as number | null,
      costPerClickCents: w.costPerClickCents as number | null,
      costPerReplyCents: w.costPerReplyCents as number | null,
    }));

    return { brands, workflows };
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
