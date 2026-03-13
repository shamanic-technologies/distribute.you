import type { WorkflowCategory } from "@distribute/content";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;
const BRAND_SERVICE_URL = process.env.BRAND_SERVICE_URL;

export interface BrandLeaderboardEntry {
  brandId: string | null;
  brandUrl: string | null;
  brandDomain: string | null;
  brandName?: string | null;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  totalCostUsdCents: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
}

export interface WorkflowLeaderboardEntry {
  workflowName: string;
  displayName: string;
  signatureName: string | null;
  category: WorkflowCategory | null;
  sectionKey: string | null;
  runCount: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  totalCostUsdCents: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
}

export interface HeroStats {
  bestCostPerOpen: { brandDomain: string | null; costPerOpenCents: number } | null;
  bestCostPerReply: { brandDomain: string | null; costPerReplyCents: number } | null;
}

export interface CategorySectionStats {
  emailsSent: number;
  emailsOpened: number;
  emailsReplied: number;
  totalCostUsdCents: number;
  openRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerReplyCents: number | null;
}

export interface CategorySectionData {
  category: string;
  sectionKey: string;
  label: string;
  stats: CategorySectionStats;
  workflows: WorkflowLeaderboardEntry[];
  brands: BrandLeaderboardEntry[];
}

export interface LeaderboardData {
  brands: BrandLeaderboardEntry[];
  workflows: WorkflowLeaderboardEntry[];
  hero: HeroStats | null;
  updatedAt: string;
  availableCategories: WorkflowCategory[];
  categorySections: CategorySectionData[];
}

export async function fetchLeaderboard(): Promise<LeaderboardData | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;

    const res = await fetch(`${API_URL}/v1/stats/leaderboard`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`Leaderboard fetch failed: ${res.status}`);
      return null;
    }

    const data = await res.json();

    // Enrich brands with names from brand-service if available
    if (BRAND_SERVICE_URL && data.brands?.length > 0) {
      const brandIds = data.brands
        .map((b: BrandLeaderboardEntry) => b.brandId)
        .filter(Boolean);

      if (brandIds.length > 0) {
        try {
          const brandsRes = await fetch(`${BRAND_SERVICE_URL}/brands/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brandIds }),
            cache: "no-store",
          });

          if (brandsRes.ok) {
            const brandsData = await brandsRes.json();
            const brandMap = new Map(
              (brandsData.brands || []).map((b: { id: string; name: string }) => [b.id, b.name])
            );
            for (const brand of data.brands) {
              if (brand.brandId && brandMap.has(brand.brandId)) {
                brand.brandName = brandMap.get(brand.brandId);
              }
            }
          }
        } catch {
          // Brand-service unavailable — use domain as fallback
        }
      }
    }

    return data as LeaderboardData;
  } catch (error) {
    console.warn("Leaderboard fetch error:", error);
    return null;
  }
}

export function formatWorkflowName(name: string): string {
  // Fallback: title-case hyphenated names
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatPercent(rate: number): string {
  if (rate === 0) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatCostCents(cents: number | null): string {
  if (cents === null || cents === 0) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatCostDollars(cents: number): string {
  if (cents === 0) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
