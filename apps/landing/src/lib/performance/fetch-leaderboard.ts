import { FEATURE_LABELS } from "@distribute/content";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

// ─── API response types ──────────────────────────────────────────────────────

interface RankedItem {
  workflow: {
    id: string;
    slug: string;
    name: string;
    dynastyName: string;
    dynastySlug: string;
    version: number;
    featureSlug: string;
    createdForBrandId: string | null;
  };
  stats: {
    totalCostInUsdCents: number;
    totalOutcomes: number;
    costPerOutcome: number | null;
    completedRuns: number;
  };
}

interface RankedResponse {
  results: RankedItem[];
}

interface BrandRankedItem {
  brand: {
    brandId: string;
    name: string | null;
    domain: string | null;
  };
  stats: {
    totalCostInUsdCents: number;
    totalOutcomes: number;
    costPerOutcome: number | null;
    completedRuns: number;
  };
}

interface BrandRankedResponse {
  results: BrandRankedItem[];
}

interface BestRecord {
  workflowSlug: string;
  workflowName: string;
  createdForBrandId: string | null;
  value: number;
}

interface BestResponse {
  best: { [metricKey: string]: BestRecord | null };
}

interface FeatureListItem {
  dynastyName: string;
  dynastySlug: string;
  description: string;
  icon: string;
  category: string;
  channel: string;
  audienceType: string;
  displayOrder: number;
}

// ─── Public types (consumed by components) ───────────────────────────────────

export interface BrandLeaderboardEntry {
  brandId: string | null;
  brandUrl: string | null;
  brandDomain: string | null;
  brandName: string | null;
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
  dynastyName: string;
  signatureName: string | null;
  category: string | null;
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

export interface FeatureGroupStats {
  emailsSent: number;
  emailsOpened: number;
  emailsReplied: number;
  totalCostUsdCents: number;
  openRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerReplyCents: number | null;
}

export interface FeatureGroupData {
  featureSlug: string;
  label: string;
  stats: FeatureGroupStats;
  workflows: WorkflowLeaderboardEntry[];
  brands: BrandLeaderboardEntry[];
}

export interface LeaderboardData {
  brands: BrandLeaderboardEntry[];
  workflows: WorkflowLeaderboardEntry[];
  hero: HeroStats | null;
  updatedAt: string;
  featureGroups: FeatureGroupData[];
}

// ─── Fetch ranked results for a single objective ─────────────────────────────

async function fetchRankedForObjective(
  featureDynastySlug: string,
  objective: string,
  headers: Record<string, string>,
): Promise<RankedItem[]> {
  const res = await fetch(
    `${API_URL}/v1/public/features/ranked?featureDynastySlug=${encodeURIComponent(featureDynastySlug)}&objective=${encodeURIComponent(objective)}&groupBy=workflow&limit=100`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return [];
  const data: RankedResponse = await res.json();
  return data.results;
}

// ─── Merge 4 objective results into WorkflowLeaderboardEntry[] ───────────────

function mergeRankedResults(
  sentResults: RankedItem[],
  openedResults: RankedItem[],
  clickedResults: RankedItem[],
  repliedResults: RankedItem[],
): WorkflowLeaderboardEntry[] {
  const sentMap = new Map(sentResults.map((r) => [r.workflow.slug, r]));
  const openedMap = new Map(openedResults.map((r) => [r.workflow.slug, r]));
  const clickedMap = new Map(clickedResults.map((r) => [r.workflow.slug, r]));
  const repliedMap = new Map(repliedResults.map((r) => [r.workflow.slug, r]));

  const allSlugs = new Set([
    ...sentMap.keys(),
    ...openedMap.keys(),
    ...clickedMap.keys(),
    ...repliedMap.keys(),
  ]);

  return [...allSlugs].map((slug) => {
    const any =
      sentMap.get(slug) ?? openedMap.get(slug) ?? clickedMap.get(slug) ?? repliedMap.get(slug)!;
    const sent = sentMap.get(slug)?.stats.totalOutcomes ?? 0;
    const opened = openedMap.get(slug)?.stats.totalOutcomes ?? 0;
    const clicked = clickedMap.get(slug)?.stats.totalOutcomes ?? 0;
    const replied = repliedMap.get(slug)?.stats.totalOutcomes ?? 0;
    const cost = any.stats.totalCostInUsdCents;

    return {
      workflowName: any.workflow.name,
      dynastyName: any.workflow.dynastyName ?? any.workflow.name,
      signatureName: null,
      category: null,
      featureSlug: any.workflow.featureSlug ?? null,
      runCount: any.stats.completedRuns,
      emailsSent: sent,
      emailsOpened: opened,
      emailsClicked: clicked,
      emailsReplied: replied,
      totalCostUsdCents: cost,
      openRate: sent > 0 ? opened / sent : 0,
      clickRate: sent > 0 ? clicked / sent : 0,
      replyRate: sent > 0 ? replied / sent : 0,
      costPerOpenCents: opened > 0 ? cost / opened : null,
      costPerClickCents: clicked > 0 ? cost / clicked : null,
      costPerReplyCents: replied > 0 ? cost / replied : null,
    };
  });
}

// ─── Fetch brand-grouped ranked results for a single objective ───────────────

async function fetchBrandRankedForObjective(
  featureDynastySlug: string,
  objective: string,
  headers: Record<string, string>,
): Promise<BrandRankedItem[]> {
  const res = await fetch(
    `${API_URL}/v1/public/features/ranked?featureDynastySlug=${encodeURIComponent(featureDynastySlug)}&objective=${encodeURIComponent(objective)}&groupBy=brand&limit=100`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return [];
  const data: BrandRankedResponse = await res.json();
  return data.results;
}

// ─── Aggregate brand stats from brand-grouped ranked results ─────────────────

function aggregateBrandsFromBrandRanked(
  allSent: BrandRankedItem[],
  allOpened: BrandRankedItem[],
  allClicked: BrandRankedItem[],
  allReplied: BrandRankedItem[],
): BrandLeaderboardEntry[] {
  const sentMap = new Map(allSent.map((r) => [r.brand.brandId, r]));
  const openedMap = new Map(allOpened.map((r) => [r.brand.brandId, r]));
  const clickedMap = new Map(allClicked.map((r) => [r.brand.brandId, r]));
  const repliedMap = new Map(allReplied.map((r) => [r.brand.brandId, r]));

  const allBrandIds = new Set([
    ...sentMap.keys(),
    ...openedMap.keys(),
    ...clickedMap.keys(),
    ...repliedMap.keys(),
  ]);

  const byBrand = new Map<
    string,
    { brandId: string; name: string | null; domain: string | null; sent: number; opened: number; clicked: number; replied: number; cost: number }
  >();

  for (const brandId of allBrandIds) {
    const any = sentMap.get(brandId) ?? openedMap.get(brandId) ?? clickedMap.get(brandId) ?? repliedMap.get(brandId)!;
    const sent = sentMap.get(brandId)?.stats.totalOutcomes ?? 0;
    const opened = openedMap.get(brandId)?.stats.totalOutcomes ?? 0;
    const clicked = clickedMap.get(brandId)?.stats.totalOutcomes ?? 0;
    const replied = repliedMap.get(brandId)?.stats.totalOutcomes ?? 0;
    const cost = any.stats.totalCostInUsdCents;

    const existing = byBrand.get(brandId);
    if (existing) {
      existing.sent += sent;
      existing.opened += opened;
      existing.clicked += clicked;
      existing.replied += replied;
      existing.cost += cost;
    } else {
      byBrand.set(brandId, {
        brandId,
        name: any.brand.name,
        domain: any.brand.domain,
        sent,
        opened,
        clicked,
        replied,
        cost,
      });
    }
  }

  return [...byBrand.values()].map((b) => ({
    brandId: b.brandId,
    brandUrl: null,
    brandDomain: b.domain,
    brandName: b.name,
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

// ─── Build feature groups from workflow entries ──────────────────────────────

function buildFeatureGroups(
  workflows: WorkflowLeaderboardEntry[],
  brands: BrandLeaderboardEntry[],
  featureLabelMap: Map<string, string>,
): FeatureGroupData[] {
  const grouped = new Map<string, WorkflowLeaderboardEntry[]>();
  for (const wf of workflows) {
    const key = wf.featureSlug ?? "unknown";
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
      featureSlug,
      label:
        featureLabelMap.get(featureSlug) ??
        FEATURE_LABELS[featureSlug] ??
        featureSlug
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

// ─── Main fetch function ─────────────────────────────────────────────────────

export async function fetchLeaderboard(): Promise<LeaderboardData | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;

    // Step 1: Fetch feature list from api-service
    const featuresRes = await fetch(`${API_URL}/public/features`, {
      headers,
      cache: "no-store",
    });
    if (!featuresRes.ok) {
      console.error(`[landing] Features fetch failed: ${featuresRes.status}`);
      return null;
    }
    const featuresData: { features: FeatureListItem[] } = await featuresRes.json();
    const features = featuresData.features;

    if (features.length === 0) {
      console.error("[landing] No features returned from api-service");
      return null;
    }

    const featureLabelMap = new Map<string, string>();
    for (const f of features) {
      featureLabelMap.set(f.dynastySlug, f.dynastyName);
    }

    const heroFeature =
      features.find((f) => f.dynastySlug.includes("sales-cold-email")) ?? features[0];

    // Step 2: For each feature, make 4 parallel workflow-ranked + 4 parallel brand-ranked calls
    const objectives = ["emailsSent", "emailsOpened", "emailsClicked", "emailsReplied"] as const;

    const featureResults = await Promise.all(
      features.map(async (feature) => {
        const [sentResults, openedResults, clickedResults, repliedResults] = await Promise.all(
          objectives.map((obj) => fetchRankedForObjective(feature.dynastySlug, obj, headers)),
        );
        const [brandSent, brandOpened, brandClicked, brandReplied] = await Promise.all(
          objectives.map((obj) => fetchBrandRankedForObjective(feature.dynastySlug, obj, headers)),
        );
        return {
          feature,
          sentResults,
          openedResults,
          clickedResults,
          repliedResults,
          brandSent,
          brandOpened,
          brandClicked,
          brandReplied,
        };
      }),
    );

    // Step 3: Fetch best stats for hero
    const bestRes = await fetch(
      `${API_URL}/v1/public/features/best?featureDynastySlug=${encodeURIComponent(heroFeature.dynastySlug)}&groupBy=workflow`,
      { headers, cache: "no-store" },
    );
    const bestData: BestResponse | null = bestRes.ok ? await bestRes.json() : null;

    // Step 4: Merge results per feature
    const allWorkflows: WorkflowLeaderboardEntry[] = [];
    const allBrandSent: BrandRankedItem[] = [];
    const allBrandOpened: BrandRankedItem[] = [];
    const allBrandClicked: BrandRankedItem[] = [];
    const allBrandReplied: BrandRankedItem[] = [];

    for (const {
      sentResults,
      openedResults,
      clickedResults,
      repliedResults,
      brandSent,
      brandOpened,
      brandClicked,
      brandReplied,
    } of featureResults) {
      const merged = mergeRankedResults(sentResults, openedResults, clickedResults, repliedResults);
      allWorkflows.push(...merged);
      allBrandSent.push(...brandSent);
      allBrandOpened.push(...brandOpened);
      allBrandClicked.push(...brandClicked);
      allBrandReplied.push(...brandReplied);
    }

    // Step 5: Aggregate brands (name/domain come from the API response)
    const brands = aggregateBrandsFromBrandRanked(
      allBrandSent,
      allBrandOpened,
      allBrandClicked,
      allBrandReplied,
    );

    // Step 6: Build hero stats
    let hero: HeroStats | null = null;
    if (bestData) {
      const openRecord = bestData.best["opened"] ?? null;
      const replyRecord = bestData.best["replied"] ?? null;
      hero = {
        bestCostPerOpen: openRecord
          ? { brandDomain: null, costPerOpenCents: openRecord.value }
          : null,
        bestCostPerReply: replyRecord
          ? { brandDomain: null, costPerReplyCents: replyRecord.value }
          : null,
      };
    }

    // Step 7: Build feature groups
    const featureGroups = buildFeatureGroups(allWorkflows, brands, featureLabelMap);

    return {
      brands,
      workflows: allWorkflows,
      hero,
      updatedAt: new Date().toISOString(),
      featureGroups,
    };
  } catch (error) {
    console.error("[landing] Leaderboard fetch error:", error);
    return null;
  }
}

export function formatWorkflowName(name: string): string {
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
