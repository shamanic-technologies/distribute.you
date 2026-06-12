import { URLS } from "@distribute/content";
import { unstable_cache } from "next/cache";
import {
  type BrandTimelinePoint,
  type BrandLeaderboardEntry,
  type WorkflowLeaderboardEntry,
} from "@/lib/performance/fetch-leaderboard";

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

function resolveFeaturesUrl(hostname: string): string {
  if (process.env.NEXT_PUBLIC_FEATURES_SERVICE_URL) {
    return process.env.NEXT_PUBLIC_FEATURES_SERVICE_URL;
  }
  const apiUrl = resolveApiUrl(hostname);
  if (apiUrl.includes("://api-staging.")) {
    return apiUrl.replace("://api-staging.", "://features-staging.");
  }
  return apiUrl.replace("://api.", "://features.");
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) headers["X-API-Key"] = API_KEY;
  return headers;
}

// ─── Public feature list (drives /benchmarks index + generateStaticParams) ──

export interface BenchmarkFeature {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  displayOrder: number;
  defaultSortKey: string | null;
  defaultSortDirection: "asc" | "desc";
}

interface RawFeatureOutput {
  key: string;
  defaultSort?: boolean;
  sortDirection?: "asc" | "desc";
}

interface RawFeature {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  implemented: boolean;
  status: string;
  displayOrder: number;
  outputs?: RawFeatureOutput[];
}

interface FeatureListResponse {
  features: RawFeature[];
}

// Public landing sells one product: sales cold email outreach. Other channels
// stay alpha (dashboard-only), so /benchmarks surfaces sales only.
const PUBLIC_BENCHMARK_SLUGS = ["sales-cold-email-outreach"];

export const fetchBenchmarkFeatures = unstable_cache(
  async (hostname = ""): Promise<BenchmarkFeature[]> => {
    const apiUrl = resolveApiUrl(hostname);
    const res = await fetch(`${apiUrl}/public/features`, {
      headers: buildHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(
        `[landing] Benchmarks: features fetch failed: ${res.status} ${res.statusText}`,
      );
      return [];
    }
    const data: FeatureListResponse = await res.json();
    const live = data.features.filter(
      (f) =>
        f.implemented === true &&
        f.status === "active" &&
        PUBLIC_BENCHMARK_SLUGS.includes(f.slug),
    );
    return live
      .map((f) => {
        const defaultOutput = f.outputs?.find((o) => o.defaultSort === true);
        return {
          id: f.id,
          slug: f.slug,
          name: f.name,
          description: f.description,
          icon: f.icon,
          displayOrder: f.displayOrder,
          defaultSortKey: defaultOutput?.key ?? null,
          defaultSortDirection: defaultOutput?.sortDirection ?? "desc",
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
  ["benchmark-features"],
  { revalidate: 300, tags: ["benchmark-features"] },
);

// ─── Per-feature ranked data (brand + workflow leaderboards) ─────────────────

interface WorkflowRankedItem {
  workflow: {
    id: string;
    workflowSlug: string;
    workflowName: string;
    workflowDynastyName: string;
    workflowDynastySlug: string;
    version: number;
    featureSlug: string;
    createdForBrandId: string | null;
    workflowDynastySignatureName?: string;
  };
  stats: Record<string, number | null>;
}

interface BrandRankedItem {
  brand: {
    id: string;
    name: string | null;
    domain: string | null;
  };
  stats: Record<string, number | null>;
  timeline?: RawBrandTimelinePoint[];
}

interface WorkflowRankedResponse {
  results: WorkflowRankedItem[];
}

interface BrandRankedResponse {
  results: BrandRankedItem[];
}

interface PublicBrandRevenueItem {
  brand: {
    id: string;
    name: string | null;
    domain: string | null;
  };
  headline?: {
    totalPipelineUsd: number | null;
  };
  costEconomics?: {
    roiMultiple: number | null;
  };
  timeline?: RawBrandTimelinePoint[];
}

interface PublicBrandRevenueResponse {
  results: PublicBrandRevenueItem[];
}

interface PublicWorkflowRevenueItem {
  workflowSlug?: string;
  workflow?: {
    workflowSlug?: string;
  };
  headline?: {
    totalPipelineUsd: number | null;
  };
  costEconomics?: {
    roiMultiple: number | null;
  };
}

interface PublicWorkflowRevenueResponse {
  results?: PublicWorkflowRevenueItem[];
  groups?: PublicWorkflowRevenueItem[];
}

function num(stats: Record<string, number | null>, key: string): number {
  return (stats[key] as number) ?? 0;
}

interface RawBrandTimelinePoint {
  date: string;
  cumulativePipelineUsd?: number | null;
  emailsSent?: number | null;
  emailsOpened?: number | null;
  emailsClicked?: number | null;
  emailsReplied?: number | null;
}

function mapBrandEntry(item: BrandRankedItem): BrandLeaderboardEntry {
  const sent = num(item.stats, "recipientsSent");
  const opened = num(item.stats, "recipientsOpened");
  const clicked = num(item.stats, "recipientsClicked");
  const replied = num(item.stats, "recipientsRepliesPositive");
  const cost = num(item.stats, "totalCostInUsdCents");
  return {
    brandId: item.brand.id,
    brandName: item.brand.name ?? null,
    brandDomain: item.brand.domain ?? null,
    brandUrl: null,
    expectedRevenueUsd: null,
    roiMultiple: null,
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
}

function mapWorkflowEntry(item: WorkflowRankedItem): WorkflowLeaderboardEntry {
  const sent = num(item.stats, "recipientsSent");
  const opened = num(item.stats, "recipientsOpened");
  const clicked = num(item.stats, "recipientsClicked");
  const replied = num(item.stats, "recipientsRepliesPositive");
  const cost = num(item.stats, "totalCostInUsdCents");
  return {
    workflowSlug: item.workflow.workflowSlug ?? null,
    workflowName: item.workflow.workflowName,
    workflowDynastyName:
      item.workflow.workflowDynastyName ?? item.workflow.workflowName,
    workflowDynastySignatureName:
      item.workflow.workflowDynastySignatureName ?? null,
    category: null,
    featureSlug: item.workflow.featureSlug ?? null,
    expectedRevenueUsd: null,
    roiMultiple: null,
    runCount: num(item.stats, "completedRuns"),
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
}

export interface BenchmarkAggregateStats {
  totalRuns: number;
  totalCostUsdCents: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
  participatingBrands: number;
  participatingWorkflows: number;
  expectedRevenueUsd: number;
  roiMultiple: number | null;
}

export interface FeatureBenchmarkData {
  feature: BenchmarkFeature;
  brands: BrandLeaderboardEntry[];
  workflows: WorkflowLeaderboardEntry[];
  aggregate: BenchmarkAggregateStats;
  updatedAt: string;
}

// Bounded fetch for the build-time benchmark calls. A HUNG public-API request
// (the leaderboard endpoints can take >60s under load) would otherwise stall the
// Vercel prerender past its 60s page-build timeout and ABORT the whole landing
// deploy. Abort at 15s and return null → the callers' existing `!ok → empty`
// fallback renders an empty leaderboard instead, so a slow API degrades to
// cached/empty data rather than failing the build. (CLAUDE.md "Vercel
// build-time prerender must stay shippable".)
async function fetchBoundedJson<T>(
  url: string,
  init: RequestInit & { next?: { revalidate: number } },
  label: string,
  fallback: T,
): Promise<T> {
  // The public API can be slow to TRANSFER its (multi-MB) body from the Vercel
  // build network. The AbortSignal.timeout must therefore cover BOTH the connect
  // AND the body read, and the `.json()` parse must happen INSIDE this try/catch
  // — otherwise a timeout that fires during `res.json()` throws UNCAUGHT and
  // aborts the whole /benchmarks prerender, failing the entire deploy (the exact
  // bug this fixes). On any failure return the fallback so the page renders empty
  // and the build still ships. (CLAUDE.md "Vercel build-time prerender must stay
  // shippable".)
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      console.error(`[landing] Benchmarks: ${label} fetch failed: ${res.status}`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(
      `[landing] Benchmarks: ${label} fetch aborted/failed for ${url}`,
      err,
    );
    return fallback;
  }
}

export async function fetchFeatureBenchmark(
  featureSlug: string,
  hostname = "",
): Promise<FeatureBenchmarkData | null> {
  const cached = unstable_cache(
    () => _fetchFeatureBenchmarkUncached(featureSlug, hostname),
    ["feature-benchmark", featureSlug, hostname],
    { revalidate: 300, tags: ["benchmark-features", `benchmark-${featureSlug}`] },
  );
  return cached();
}

async function _fetchFeatureBenchmarkUncached(
  featureSlug: string,
  hostname = "",
): Promise<FeatureBenchmarkData | null> {
  const apiUrl = resolveApiUrl(hostname);
  const featuresUrl = resolveFeaturesUrl(hostname);
  const headers = buildHeaders();

  const features = await fetchBenchmarkFeatures(hostname);
  const feature = features.find((f) => f.slug === featureSlug);
  if (!feature) {
    console.error(
      `[landing] Benchmarks: feature slug "${featureSlug}" not found in /public/features`,
    );
    return null;
  }

  const [brandsData, workflowsData, brandRevenueData, workflowRevenueData] = await Promise.all([
    fetchBoundedJson<BrandRankedResponse>(
      `${apiUrl}/v1/public/features/ranked?featureSlug=${encodeURIComponent(featureSlug)}&objective=emailsSent&groupBy=brand&limit=100`,
      { headers, next: { revalidate: 300 } },
      `brands (${featureSlug})`,
      { results: [] },
    ),
    fetchBoundedJson<WorkflowRankedResponse>(
      `${apiUrl}/v1/public/features/ranked?featureSlug=${encodeURIComponent(featureSlug)}&objective=emailsSent&groupBy=workflow&limit=100`,
      { headers, next: { revalidate: 300 } },
      `workflows (${featureSlug})`,
      { results: [] },
    ),
    fetchBoundedJson<PublicBrandRevenueResponse>(
      `${featuresUrl}/public/stats/revenue?featureSlug=${encodeURIComponent(featureSlug)}&groupBy=brand`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } },
      `brand revenue (${featureSlug})`,
      { results: [] },
    ),
    fetchBoundedJson<PublicWorkflowRevenueResponse>(
      `${featuresUrl}/public/stats/revenue?featureSlug=${encodeURIComponent(featureSlug)}&groupBy=workflow`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } },
      `workflow revenue (${featureSlug})`,
      { results: [] },
    ),
  ]);

  // NB: the per-brand `timeline` (~1,500 daily points × up to 6 brands ≈ 2.2MB)
  // is intentionally NOT carried here. Its only consumer (ClientTrajectoriesSection)
  // is not mounted, and keeping it blew the unstable_cache item past the 2MB limit
  // (so the result was never cached → every revalidation re-hit the slow API).
  const revenueByBrand = new Map(
    brandRevenueData.results
      .filter((item) => (item.headline?.totalPipelineUsd ?? 0) > 0)
      .map((item) => {
        return [
          item.brand.id,
          {
            expectedRevenueUsd: item.headline?.totalPipelineUsd ?? null,
            roiMultiple: item.costEconomics?.roiMultiple ?? null,
          },
        ] as const;
      }),
  );

  const brands = brandsData.results.flatMap((item) => {
    const revenue = revenueByBrand.get(item.brand.id);
    if (!revenue) return [];
    const brand = mapBrandEntry(item);
    return [{
      ...brand,
      expectedRevenueUsd: revenue.expectedRevenueUsd,
      roiMultiple: revenue.roiMultiple,
    }];
  });

  const workflowRevenueItems = workflowRevenueData.results ?? workflowRevenueData.groups ?? [];
  const revenueByWorkflowSlug = new Map(
    workflowRevenueItems.flatMap((item) => {
      const workflowSlug = item.workflow?.workflowSlug ?? item.workflowSlug ?? null;
      if (!workflowSlug) return [];
      return [[
        workflowSlug,
        {
          expectedRevenueUsd: item.headline?.totalPipelineUsd ?? null,
          roiMultiple: item.costEconomics?.roiMultiple ?? null,
        },
      ] as const];
    }),
  );

  const workflows = workflowsData.results.map((item) => {
    const workflow = mapWorkflowEntry(item);
    const revenue = item.workflow.workflowSlug
      ? revenueByWorkflowSlug.get(item.workflow.workflowSlug)
      : undefined;
    return {
      ...workflow,
      expectedRevenueUsd: revenue?.expectedRevenueUsd ?? null,
      roiMultiple: revenue?.roiMultiple ?? null,
    };
  });

  const sent = workflows.reduce((s, w) => s + w.emailsSent, 0);
  const opened = workflows.reduce((s, w) => s + w.emailsOpened, 0);
  const clicked = workflows.reduce((s, w) => s + w.emailsClicked, 0);
  const replied = workflows.reduce((s, w) => s + w.emailsReplied, 0);
  const cost = workflows.reduce((s, w) => s + w.totalCostUsdCents, 0);
  const runs = workflows.reduce((s, w) => s + w.runCount, 0);
  const brandCost = brands.reduce((s, brand) => s + brand.totalCostUsdCents, 0);
  const expectedRevenueUsd = brands.reduce(
    (sum, brand) => sum + (brand.expectedRevenueUsd ?? 0),
    0,
  );

  const aggregate: BenchmarkAggregateStats = {
    totalRuns: runs,
    totalCostUsdCents: cost,
    emailsSent: sent,
    emailsOpened: opened,
    emailsClicked: clicked,
    emailsReplied: replied,
    openRate: sent > 0 ? opened / sent : 0,
    clickRate: sent > 0 ? clicked / sent : 0,
    replyRate: sent > 0 ? replied / sent : 0,
    costPerOpenCents: opened > 0 ? cost / opened : null,
    costPerClickCents: clicked > 0 ? cost / clicked : null,
    costPerReplyCents: replied > 0 ? cost / replied : null,
    participatingBrands: brands.length,
    participatingWorkflows: workflows.length,
    expectedRevenueUsd,
    roiMultiple: expectedRevenueUsd > 0 && brandCost > 0 ? expectedRevenueUsd / (brandCost / 100) : null,
  };

  return {
    feature,
    brands,
    workflows,
    aggregate,
    updatedAt: new Date().toISOString(),
  };
}
