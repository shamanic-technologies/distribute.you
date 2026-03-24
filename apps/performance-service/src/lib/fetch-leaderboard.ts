import type { WorkflowCategory } from "@distribute/content";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;
const BRAND_SERVICE_URL = process.env.BRAND_SERVICE_URL;

// ─── Public ranked/best endpoint types ──────────────────────────────────────

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

interface PublicWorkflowStats {
  totalCostInUsdCents: number;
  totalOutcomes: number;
  costPerOutcome: number | null;
  completedRuns: number;
  email: {
    transactional: PublicEmailStats;
    broadcast: PublicEmailStats;
  };
}

interface PublicWorkflowMetadata {
  id: string;
  name: string;
  displayName: string | null;
  createdForBrandId: string | null;
  category: string;
  channel: string;
  audienceType: string;
  signature: string;
  signatureName: string;
}

interface PublicRankedItem {
  workflow: PublicWorkflowMetadata;
  stats: PublicWorkflowStats;
}

interface BestWorkflowRecord {
  workflowId: string;
  workflowName: string;
  displayName: string | null;
  brandId: string | null;
  value: number;
}

interface BestWorkflowResponse {
  bestCostPerOpen: BestWorkflowRecord | null;
  bestCostPerReply: BestWorkflowRecord | null;
}

// ─── Existing types (consumed by components) ────────────────────────────────

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
  featureSlug: string | null;
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
  featureSlug: string;
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

// ─── Transform ranked item → leaderboard entry ─────────────────────────────

function rankedToWorkflowEntry(item: PublicRankedItem): WorkflowLeaderboardEntry {
  const b = item.stats.email.broadcast;
  const cost = item.stats.totalCostInUsdCents;
  const featureSlug = `${item.workflow.category}-${item.workflow.channel}-${item.workflow.audienceType}`;

  return {
    workflowName: item.workflow.name,
    displayName: item.workflow.displayName ?? item.workflow.name,
    signatureName: item.workflow.signatureName,
    category: item.workflow.category as WorkflowCategory,
    featureSlug,
    runCount: item.stats.completedRuns,
    emailsSent: b.sent,
    emailsOpened: b.opened,
    emailsClicked: b.clicked,
    emailsReplied: b.replied,
    totalCostUsdCents: cost,
    openRate: b.sent > 0 ? b.opened / b.sent : 0,
    clickRate: b.sent > 0 ? b.clicked / b.sent : 0,
    replyRate: b.sent > 0 ? b.replied / b.sent : 0,
    costPerOpenCents: b.opened > 0 ? cost / b.opened : null,
    costPerClickCents: b.clicked > 0 ? cost / b.clicked : null,
    costPerReplyCents: b.replied > 0 ? cost / b.replied : null,
  };
}

// ─── Aggregate brand stats from ranked items ────────────────────────────────

function aggregateBrandStats(items: PublicRankedItem[]): BrandLeaderboardEntry[] {
  const byBrand = new Map<string, { brandId: string; sent: number; opened: number; clicked: number; replied: number; cost: number }>();

  for (const item of items) {
    const brandId = item.workflow.createdForBrandId;
    if (!brandId) continue;
    const b = item.stats.email.broadcast;
    const existing = byBrand.get(brandId);
    if (existing) {
      existing.sent += b.sent;
      existing.opened += b.opened;
      existing.clicked += b.clicked;
      existing.replied += b.replied;
      existing.cost += item.stats.totalCostInUsdCents;
    } else {
      byBrand.set(brandId, {
        brandId,
        sent: b.sent,
        opened: b.opened,
        clicked: b.clicked,
        replied: b.replied,
        cost: item.stats.totalCostInUsdCents,
      });
    }
  }

  return [...byBrand.values()].map((b) => ({
    brandId: b.brandId,
    brandUrl: null,
    brandDomain: null,
    emailsSent: b.sent,
    emailsOpened: b.opened,
    emailsClicked: b.clicked,
    emailsReplied: b.replied,
    totalCostUsdCents: b.cost,
    openRate: b.sent > 0 ? b.opened / b.sent : 0,
    clickRate: b.sent > 0 ? b.clicked / b.sent : 0,
    replyRate: b.sent > 0 ? b.replied / b.sent : 0,
    costPerOpenCents: b.opened > 0 ? b.cost / b.opened : null,
    costPerClickCents: b.clicked > 0 ? b.cost / b.clicked : null,
    costPerReplyCents: b.replied > 0 ? b.cost / b.replied : null,
  }));
}

// ─── Build category sections from workflow entries ──────────────────────────

function buildCategorySections(workflows: WorkflowLeaderboardEntry[], brands: BrandLeaderboardEntry[]): CategorySectionData[] {
  const grouped = new Map<string, WorkflowLeaderboardEntry[]>();
  for (const wf of workflows) {
    const key = wf.featureSlug ?? wf.category ?? "unknown";
    const arr = grouped.get(key) ?? [];
    arr.push(wf);
    grouped.set(key, arr);
  }

  return [...grouped.entries()].map(([featureSlug, sectionWorkflows]) => {
    const sent = sectionWorkflows.reduce((s, w) => s + w.emailsSent, 0);
    const opened = sectionWorkflows.reduce((s, w) => s + w.emailsOpened, 0);
    const replied = sectionWorkflows.reduce((s, w) => s + w.emailsReplied, 0);
    const cost = sectionWorkflows.reduce((s, w) => s + w.totalCostUsdCents, 0);

    return {
      category: sectionWorkflows[0]?.category ?? featureSlug,
      featureSlug,
      label: featureSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      stats: {
        emailsSent: sent,
        emailsOpened: opened,
        emailsReplied: replied,
        totalCostUsdCents: cost,
        openRate: sent > 0 ? opened / sent : 0,
        replyRate: sent > 0 ? replied / sent : 0,
        costPerOpenCents: opened > 0 ? cost / opened : null,
        costPerReplyCents: replied > 0 ? cost / replied : null,
      },
      workflows: sectionWorkflows,
      brands,
    };
  });
}

// ─── Resolve brand domains/names from brand-service ─────────────────────────

async function enrichBrands(brands: BrandLeaderboardEntry[]): Promise<void> {
  if (!BRAND_SERVICE_URL || brands.length === 0) return;
  const brandIds = brands.map((b) => b.brandId).filter(Boolean);
  if (brandIds.length === 0) return;

  try {
    const res = await fetch(`${BRAND_SERVICE_URL}/brands/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandIds }),
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    const brandMap = new Map<string, { name: string; domain: string | null; brandUrl: string | null }>(
      (data.brands || []).map((b: { id: string; name: string; domain?: string; brandUrl?: string }) => [
        b.id,
        { name: b.name, domain: b.domain ?? null, brandUrl: b.brandUrl ?? null },
      ])
    );
    for (const brand of brands) {
      if (brand.brandId && brandMap.has(brand.brandId)) {
        const info = brandMap.get(brand.brandId)!;
        brand.brandName = info.name;
        brand.brandDomain = info.domain;
        brand.brandUrl = info.brandUrl;
      }
    }
  } catch {
    // Brand-service unavailable — continue without names
  }
}

// ─── Resolve brand domain from best record's brandId ────────────────────────

async function resolveBrandDomain(brandId: string | null): Promise<string | null> {
  if (!brandId || !BRAND_SERVICE_URL) return null;
  try {
    const res = await fetch(`${BRAND_SERVICE_URL}/brands/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandIds: [brandId] }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.brands?.[0]?.domain ?? null;
  } catch {
    return null;
  }
}

// ─── Main fetch function ────────────────────────────────────────────────────

export async function fetchLeaderboard(): Promise<LeaderboardData | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;

    // Fetch ranked workflows and hero stats in parallel from public endpoints
    const [rankedRes, bestRes] = await Promise.all([
      fetch(`${API_URL}/v1/public/workflows/ranked?limit=100`, {
        headers,
        cache: "no-store",
      }),
      fetch(`${API_URL}/v1/public/workflows/best`, {
        headers,
        cache: "no-store",
      }),
    ]);

    if (!rankedRes.ok) {
      console.warn(`Ranked workflows fetch failed: ${rankedRes.status}`);
      return null;
    }

    const rankedData: { results: PublicRankedItem[] } = await rankedRes.json();
    const bestData: BestWorkflowResponse | null = bestRes.ok ? await bestRes.json() : null;

    // Transform to existing types
    const workflows = rankedData.results.map(rankedToWorkflowEntry);
    const brands = aggregateBrandStats(rankedData.results);

    // Enrich brands with names from brand-service
    await enrichBrands(brands);

    // Build hero stats
    let hero: HeroStats | null = null;
    if (bestData) {
      const [openDomain, replyDomain] = await Promise.all([
        resolveBrandDomain(bestData.bestCostPerOpen?.brandId ?? null),
        resolveBrandDomain(bestData.bestCostPerReply?.brandId ?? null),
      ]);
      hero = {
        bestCostPerOpen: bestData.bestCostPerOpen
          ? { brandDomain: openDomain, costPerOpenCents: bestData.bestCostPerOpen.value }
          : null,
        bestCostPerReply: bestData.bestCostPerReply
          ? { brandDomain: replyDomain, costPerReplyCents: bestData.bestCostPerReply.value }
          : null,
      };
    }

    // Extract unique categories
    const categorySet = new Set<WorkflowCategory>();
    for (const wf of workflows) {
      if (wf.category) categorySet.add(wf.category);
    }

    // Build category sections
    const categorySections = buildCategorySections(workflows, brands);

    return {
      brands,
      workflows,
      hero,
      updatedAt: new Date().toISOString(),
      availableCategories: [...categorySet],
      categorySections,
    };
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
