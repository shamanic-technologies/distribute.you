const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

// ─── Base groups: merge multiple dynasty slugs into one display group ────────

interface BaseGroup {
  label: string;
  slugs: string[];
}

const BASE_GROUPS: BaseGroup[] = [
  { label: "Hiring Cold Email Outreach", slugs: ["hiring-cold-email-outreach"] },
  { label: "Sales Cold Email Outreach", slugs: ["sales-cold-email-outreach"] },
  { label: "PR Cold Email Outreach", slugs: ["pr-cold-email-outreach", "pr-cold-email-outreach-sophia", "pr-cold-email-outreach-berlin"] },
];

function resolveBaseGroup(dynastySlug: string): BaseGroup | null {
  return BASE_GROUPS.find((g) => g.slugs.includes(dynastySlug)) ?? null;
}

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
    id: string;
    name: string | null;
    domain: string | null;
  };
  stats: Record<string, number | null>;
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

// ─── Accumulate brand items by brand ID (sums across dynasties) ──────────────

function accumulateBrandItems(items: BrandRankedItem[]): Map<string, { brand: BrandRankedItem["brand"]; totalOutcomes: number; totalCostInUsdCents: number }> {
  const acc = new Map<string, { brand: BrandRankedItem["brand"]; totalOutcomes: number; totalCostInUsdCents: number }>();
  for (const item of items) {
    const existing = acc.get(item.brand.id);
    if (existing) {
      existing.totalOutcomes += (item.stats.totalOutcomes as number) ?? 0;
      existing.totalCostInUsdCents += (item.stats.totalCostInUsdCents as number) ?? 0;
    } else {
      acc.set(item.brand.id, {
        brand: item.brand,
        totalOutcomes: (item.stats.totalOutcomes as number) ?? 0,
        totalCostInUsdCents: (item.stats.totalCostInUsdCents as number) ?? 0,
      });
    }
  }
  return acc;
}

// ─── Aggregate brand stats from brand-grouped ranked results ─────────────────

function aggregateBrandsFromBrandRanked(
  allSent: BrandRankedItem[],
  allOpened: BrandRankedItem[],
  allClicked: BrandRankedItem[],
  allReplied: BrandRankedItem[],
): BrandLeaderboardEntry[] {
  const sentMap = accumulateBrandItems(allSent);
  const openedMap = accumulateBrandItems(allOpened);
  const clickedMap = accumulateBrandItems(allClicked);
  const repliedMap = accumulateBrandItems(allReplied);

  const allBrandIds = new Set([
    ...sentMap.keys(),
    ...openedMap.keys(),
    ...clickedMap.keys(),
    ...repliedMap.keys(),
  ]);

  return [...allBrandIds].map((brandId) => {
    const any = sentMap.get(brandId) ?? openedMap.get(brandId) ?? clickedMap.get(brandId) ?? repliedMap.get(brandId)!;
    const sent = sentMap.get(brandId)?.totalOutcomes ?? 0;
    const opened = openedMap.get(brandId)?.totalOutcomes ?? 0;
    const clicked = clickedMap.get(brandId)?.totalOutcomes ?? 0;
    const replied = repliedMap.get(brandId)?.totalOutcomes ?? 0;
    const cost = any.totalCostInUsdCents;

    return {
      brandId,
      brandUrl: null,
      brandDomain: any.brand.domain,
      brandName: any.brand.name,
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

// ─── Per-dynasty fetch result ─────────────────────────────────────────────────

interface DynastyFetchResult {
  dynastySlug: string;
  sentResults: RankedItem[];
  openedResults: RankedItem[];
  clickedResults: RankedItem[];
  repliedResults: RankedItem[];
  brandSent: BrandRankedItem[];
  brandOpened: BrandRankedItem[];
  brandClicked: BrandRankedItem[];
  brandReplied: BrandRankedItem[];
}

// ─── Build feature groups from base groups ───────────────────────────────────

function buildFeatureGroups(
  groupResults: Map<string, DynastyFetchResult[]>,
): FeatureGroupData[] {
  return BASE_GROUPS.map((group) => {
    const results = groupResults.get(group.label) ?? [];

    const allWorkflows: WorkflowLeaderboardEntry[] = [];
    const allBrandSent: BrandRankedItem[] = [];
    const allBrandOpened: BrandRankedItem[] = [];
    const allBrandClicked: BrandRankedItem[] = [];
    const allBrandReplied: BrandRankedItem[] = [];

    for (const r of results) {
      allWorkflows.push(...mergeRankedResults(r.sentResults, r.openedResults, r.clickedResults, r.repliedResults));
      allBrandSent.push(...r.brandSent);
      allBrandOpened.push(...r.brandOpened);
      allBrandClicked.push(...r.brandClicked);
      allBrandReplied.push(...r.brandReplied);
    }

    const brands = aggregateBrandsFromBrandRanked(allBrandSent, allBrandOpened, allBrandClicked, allBrandReplied);

    const sent = allWorkflows.reduce((s, w) => s + w.emailsSent, 0);
    const opened = allWorkflows.reduce((s, w) => s + w.emailsOpened, 0);
    const replied = allWorkflows.reduce((s, w) => s + w.emailsReplied, 0);
    const cost = allWorkflows.reduce((s, w) => s + w.totalCostUsdCents, 0);

    return {
      featureSlug: group.slugs[0],
      label: group.label,
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
      workflows: allWorkflows,
      brands,
    };
  }).filter((g) => g.workflows.length > 0 || g.brands.length > 0);
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

    // Step 2: Filter to only features that belong to a base group
    const relevantFeatures = features.filter((f) => resolveBaseGroup(f.dynastySlug) !== null);

    if (relevantFeatures.length === 0) {
      console.error("[landing] No features matched any base group");
      return null;
    }

    const heroFeature =
      relevantFeatures.find((f) => f.dynastySlug.includes("sales-cold-email")) ?? relevantFeatures[0];

    // Step 3: For each relevant feature, fetch 4 objectives × (workflow + brand)
    const objectives = ["emailsSent", "emailsOpened", "emailsClicked", "emailsReplied"] as const;

    const dynastyResults: DynastyFetchResult[] = await Promise.all(
      relevantFeatures.map(async (feature) => {
        const [sentResults, openedResults, clickedResults, repliedResults] = await Promise.all(
          objectives.map((obj) => fetchRankedForObjective(feature.dynastySlug, obj, headers)),
        );
        const [brandSent, brandOpened, brandClicked, brandReplied] = await Promise.all(
          objectives.map((obj) => fetchBrandRankedForObjective(feature.dynastySlug, obj, headers)),
        );
        return {
          dynastySlug: feature.dynastySlug,
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

    // Step 4: Organize results by base group
    const groupResults = new Map<string, DynastyFetchResult[]>();
    for (const result of dynastyResults) {
      const group = resolveBaseGroup(result.dynastySlug);
      if (!group) continue;
      const arr = groupResults.get(group.label) ?? [];
      arr.push(result);
      groupResults.set(group.label, arr);
    }

    // Step 5: Fetch best stats for hero
    const bestRes = await fetch(
      `${API_URL}/v1/public/features/best?featureDynastySlug=${encodeURIComponent(heroFeature.dynastySlug)}&groupBy=workflow`,
      { headers, cache: "no-store" },
    );
    const bestData: BestResponse | null = bestRes.ok ? await bestRes.json() : null;

    // Step 6: Build feature groups (per-group workflows + per-group brands)
    const featureGroups = buildFeatureGroups(groupResults);

    // Step 7: Aggregate global lists from groups
    const allWorkflows = featureGroups.flatMap((g) => g.workflows);
    const allBrands = new Map<string, BrandLeaderboardEntry>();
    for (const g of featureGroups) {
      for (const b of g.brands) {
        if (!b.brandId) continue;
        const existing = allBrands.get(b.brandId);
        if (existing) {
          existing.emailsSent += b.emailsSent;
          existing.emailsOpened += b.emailsOpened;
          existing.emailsClicked += b.emailsClicked;
          existing.emailsReplied += b.emailsReplied;
          existing.totalCostUsdCents += b.totalCostUsdCents;
          existing.openRate = existing.emailsSent > 0 ? existing.emailsOpened / existing.emailsSent : 0;
          existing.clickRate = existing.emailsSent > 0 ? existing.emailsClicked / existing.emailsSent : 0;
          existing.replyRate = existing.emailsSent > 0 ? existing.emailsReplied / existing.emailsSent : 0;
          existing.costPerOpenCents = existing.emailsOpened > 0 ? existing.totalCostUsdCents / existing.emailsOpened : null;
          existing.costPerClickCents = existing.emailsClicked > 0 ? existing.totalCostUsdCents / existing.emailsClicked : null;
          existing.costPerReplyCents = existing.emailsReplied > 0 ? existing.totalCostUsdCents / existing.emailsReplied : null;
        } else {
          allBrands.set(b.brandId, { ...b });
        }
      }
    }

    // Step 8: Build hero stats
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

    return {
      brands: [...allBrands.values()],
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
