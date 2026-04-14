import { URLS } from "@distribute/content";

const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

function resolveApiUrl(hostname: string): string {
  if (process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL) {
    return process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL;
  }
  if (hostname.includes("staging")) {
    return URLS.api.replace("://api.", "://api-staging.");
  }
  return URLS.api;
}

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

// ��── API response types ────���────────────────────────────────────────────────

interface WorkflowRankedItem {
  workflow: {
    id: string;
    slug: string;
    name: string;
    dynastyName: string;
    dynastySlug: string;
    version: number;
    featureSlug: string;
    createdForBrandId: string | null;
    signatureName?: string;
  };
  stats: Record<string, number | null>;
}

interface WorkflowRankedResponse {
  results: WorkflowRankedItem[];
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

// ─── Helpers to read stats from flat API response ───────────────────────────

function num(stats: Record<string, number | null>, key: string): number {
  return (stats[key] as number) ?? 0;
}

// ─── Fetch ranked workflows for a feature (single call returns all stats) ───

async function fetchWorkflowRanked(
  featureDynastySlug: string,
  headers: Record<string, string>,
  apiUrl: string,
): Promise<WorkflowLeaderboardEntry[]> {
  const res = await fetch(
    `${apiUrl}/v1/public/features/ranked?featureDynastySlug=${encodeURIComponent(featureDynastySlug)}&objective=emailsSent&groupBy=workflow&limit=100`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) {
    console.error(`[landing] Workflow ranked fetch failed for ${featureDynastySlug}: ${res.status}`);
    return [];
  }
  const data: WorkflowRankedResponse = await res.json();

  return data.results.map((r) => {
    const sent = num(r.stats, "emailsSent");
    const opened = num(r.stats, "emailsOpened");
    const clicked = num(r.stats, "emailsClicked");
    const replied = num(r.stats, "repliesPositive") + num(r.stats, "repliesNegative") + num(r.stats, "repliesNeutral");
    const cost = num(r.stats, "totalCostInUsdCents");

    return {
      workflowName: r.workflow.name,
      dynastyName: r.workflow.dynastyName ?? r.workflow.name,
      signatureName: r.workflow.signatureName ?? null,
      category: null,
      featureSlug: r.workflow.featureSlug ?? null,
      runCount: num(r.stats, "completedRuns"),
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

// ─── Fetch ranked brands for a feature (single call returns all stats) ──────

async function fetchBrandRanked(
  featureDynastySlug: string,
  headers: Record<string, string>,
  apiUrl: string,
): Promise<BrandLeaderboardEntry[]> {
  const res = await fetch(
    `${apiUrl}/v1/public/features/ranked?featureDynastySlug=${encodeURIComponent(featureDynastySlug)}&objective=emailsSent&groupBy=brand&limit=100`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) {
    console.error(`[landing] Brand ranked fetch failed for ${featureDynastySlug}: ${res.status}`);
    return [];
  }
  const data: BrandRankedResponse = await res.json();

  return data.results.map((r) => {
    const sent = num(r.stats, "emailsSent");
    const opened = num(r.stats, "emailsOpened");
    const clicked = num(r.stats, "emailsClicked");
    const replied = num(r.stats, "repliesPositive") + num(r.stats, "repliesNegative") + num(r.stats, "repliesNeutral");
    const cost = num(r.stats, "totalCostInUsdCents");

    return {
      brandId: r.brand.id,
      brandName: r.brand.name ?? null,
      brandDomain: r.brand.domain ?? null,
      brandUrl: null,
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

// ─── Aggregate brands across features (deduplicate by brandId) ───���──────────

function aggregateBrands(brandsByFeature: BrandLeaderboardEntry[][]): BrandLeaderboardEntry[] {
  const byId = new Map<string, { sent: number; opened: number; clicked: number; replied: number; cost: number; name: string | null; domain: string | null }>();

  for (const brands of brandsByFeature) {
    for (const b of brands) {
      if (!b.brandId) continue;
      const existing = byId.get(b.brandId);
      if (existing) {
        existing.sent += b.emailsSent;
        existing.opened += b.emailsOpened;
        existing.clicked += b.emailsClicked;
        existing.replied += b.emailsReplied;
        existing.cost += b.totalCostUsdCents;
        if (!existing.name && b.brandName) existing.name = b.brandName;
        if (!existing.domain && b.brandDomain) existing.domain = b.brandDomain;
      } else {
        byId.set(b.brandId, {
          sent: b.emailsSent,
          opened: b.emailsOpened,
          clicked: b.emailsClicked,
          replied: b.emailsReplied,
          cost: b.totalCostUsdCents,
          name: b.brandName,
          domain: b.brandDomain,
        });
      }
    }
  }

  return [...byId.entries()].map(([brandId, b]) => ({
    brandId,
    brandName: b.name,
    brandDomain: b.domain,
    brandUrl: null,
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

// ─── Per-dynasty fetch result ───────────���────────────────────────────────────

interface DynastyFetchResult {
  dynastySlug: string;
  workflows: WorkflowLeaderboardEntry[];
  brands: BrandLeaderboardEntry[];
}

// ─── Build feature groups from base groups ────���──────────────────────────────

function buildFeatureGroups(
  groupResults: Map<string, DynastyFetchResult[]>,
): FeatureGroupData[] {
  return BASE_GROUPS.map((group) => {
    const results = groupResults.get(group.label) ?? [];

    const allWorkflows: WorkflowLeaderboardEntry[] = [];
    const allBrandArrays: BrandLeaderboardEntry[][] = [];

    for (const r of results) {
      allWorkflows.push(...r.workflows);
      allBrandArrays.push(r.brands);
    }

    const brands = aggregateBrands(allBrandArrays);

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

// ─── Main fetch function ────────────────────────────��───────────────────────

export async function fetchLeaderboard(hostname = ""): Promise<LeaderboardData | null> {
  try {
    const apiUrl = resolveApiUrl(hostname);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;

    // Step 1: Fetch feature list from api-service
    const featuresRes = await fetch(`${apiUrl}/public/features`, {
      headers,
      cache: "no-store",
    });
    if (!featuresRes.ok) {
      console.error(`[landing] Performance: features fetch failed: ${featuresRes.status}`);
      return null;
    }
    const featuresData: { features: FeatureListItem[] } = await featuresRes.json();
    const features = featuresData.features;

    if (features.length === 0) {
      console.error("[landing] Performance: no features returned from api-service");
      return null;
    }

    // Step 2: Filter to only features that belong to a base group
    const relevantFeatures = features.filter((f) => resolveBaseGroup(f.dynastySlug) !== null);

    if (relevantFeatures.length === 0) {
      console.error("[landing] Performance: no features matched any base group");
      return null;
    }

    const heroFeature =
      relevantFeatures.find((f) => f.dynastySlug.includes("sales-cold-email")) ?? relevantFeatures[0];

    // Step 3: For each relevant feature, fetch workflow + brand ranked data (2 calls per feature)
    const dynastyResults: DynastyFetchResult[] = await Promise.all(
      relevantFeatures.map(async (feature) => {
        const [workflows, brands] = await Promise.all([
          fetchWorkflowRanked(feature.dynastySlug, headers, apiUrl),
          fetchBrandRanked(feature.dynastySlug, headers, apiUrl),
        ]);
        return { dynastySlug: feature.dynastySlug, workflows, brands };
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
      `${apiUrl}/v1/public/features/best?featureDynastySlug=${encodeURIComponent(heroFeature.dynastySlug)}&groupBy=workflow`,
      { headers, cache: "no-store" },
    );
    const bestData: BestResponse | null = bestRes.ok ? await bestRes.json() : null;

    // Step 6: Build feature groups (per-group workflows + per-group brands)
    const featureGroups = buildFeatureGroups(groupResults);

    // Step 7: Aggregate global lists from groups
    const allWorkflows = featureGroups.flatMap((g) => g.workflows);
    const brands = aggregateBrands(featureGroups.map((g) => g.brands));

    // Step 8: Build hero stats
    let hero: HeroStats | null = null;
    if (bestData) {
      const openRecord = bestData.best["emailsOpened"] ?? null;
      const replyRecord = bestData.best["repliesPositive"] ?? null;
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
      brands,
      workflows: allWorkflows,
      hero,
      updatedAt: new Date().toISOString(),
      featureGroups,
    };
  } catch (error) {
    console.error("[landing] Performance: leaderboard fetch error:", error);
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
