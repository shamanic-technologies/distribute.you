import type { BrandLeaderboardEntry, CategorySectionStats, WorkflowLeaderboardEntry } from "./fetch-leaderboard";

export function minPositive(values: (number | null)[]): number | null {
  const positives = values.filter((v): v is number => v !== null && v > 0);
  return positives.length > 0 ? Math.min(...positives) : null;
}

export function computeBestStats(
  workflows: WorkflowLeaderboardEntry[],
  brands: BrandLeaderboardEntry[],
  tab: "workflow" | "brand",
): CategorySectionStats {
  if (tab === "workflow") {
    const withEmails = workflows.filter((w) => w.emailsSent > 0);
    return {
      emailsSent: 0,
      emailsOpened: 0,
      emailsReplied: 0,
      repliesInterested: 0,
      totalCostUsdCents: 0,
      openRate: withEmails.length > 0 ? Math.max(...withEmails.map((e) => e.openRate)) : 0,
      replyRate: withEmails.length > 0 ? Math.max(...withEmails.map((e) => e.replyRate)) : 0,
      interestedRate: withEmails.length > 0 ? Math.max(...withEmails.map((e) => e.interestedRate)) : 0,
      costPerOpenCents: minPositive(workflows.map((e) => e.costPerOpenCents)),
      costPerReplyCents: minPositive(workflows.map((e) => e.costPerReplyCents)),
    };
  }

  const withEmails = brands.filter((b) => b.emailsSent > 0);
  return {
    emailsSent: 0,
    emailsOpened: 0,
    emailsReplied: 0,
    repliesInterested: 0,
    totalCostUsdCents: 0,
    openRate: withEmails.length > 0 ? Math.max(...withEmails.map((e) => e.openRate)) : 0,
    replyRate: withEmails.length > 0 ? Math.max(...withEmails.map((e) => e.replyRate)) : 0,
    interestedRate: 0,
    costPerOpenCents: minPositive(brands.map((e) => e.costPerOpenCents)),
    costPerReplyCents: minPositive(brands.map((e) => e.costPerReplyCents)),
  };
}
