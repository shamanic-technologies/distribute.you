import { URLS } from "@distribute/content";
import { unstable_cache } from "next/cache";
import {
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
}

interface WorkflowRankedResponse {
  results: WorkflowRankedItem[];
}

interface BrandRankedResponse {
  results: BrandRankedItem[];
}

function num(stats: Record<string, number | null>, key: string): number {
  return (stats[key] as number) ?? 0;
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
    workflowName: item.workflow.workflowName,
    workflowDynastyName:
      item.workflow.workflowDynastyName ?? item.workflow.workflowName,
    workflowDynastySignatureName:
      item.workflow.workflowDynastySignatureName ?? null,
    category: null,
    featureSlug: item.workflow.featureSlug ?? null,
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
}

export interface FeatureBenchmarkData {
  feature: BenchmarkFeature;
  brands: BrandLeaderboardEntry[];
  workflows: WorkflowLeaderboardEntry[];
  aggregate: BenchmarkAggregateStats;
  updatedAt: string;
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
  const headers = buildHeaders();

  const features = await fetchBenchmarkFeatures(hostname);
  const feature = features.find((f) => f.slug === featureSlug);
  if (!feature) {
    console.error(
      `[landing] Benchmarks: feature slug "${featureSlug}" not found in /public/features`,
    );
    return null;
  }

  const [brandsRes, workflowsRes] = await Promise.all([
    fetch(
      `${apiUrl}/v1/public/features/ranked?featureSlug=${encodeURIComponent(featureSlug)}&objective=emailsSent&groupBy=brand&limit=100`,
      { headers, next: { revalidate: 300 } },
    ),
    fetch(
      `${apiUrl}/v1/public/features/ranked?featureSlug=${encodeURIComponent(featureSlug)}&objective=emailsSent&groupBy=workflow&limit=100`,
      { headers, next: { revalidate: 300 } },
    ),
  ]);

  if (!brandsRes.ok) {
    console.error(
      `[landing] Benchmarks: brands fetch failed for ${featureSlug}: ${brandsRes.status}`,
    );
  }
  if (!workflowsRes.ok) {
    console.error(
      `[landing] Benchmarks: workflows fetch failed for ${featureSlug}: ${workflowsRes.status}`,
    );
  }

  const brandsData: BrandRankedResponse = brandsRes.ok
    ? await brandsRes.json()
    : { results: [] };
  const workflowsData: WorkflowRankedResponse = workflowsRes.ok
    ? await workflowsRes.json()
    : { results: [] };

  const brands = brandsData.results.map(mapBrandEntry);
  const workflows = workflowsData.results.map(mapWorkflowEntry);

  const sent = workflows.reduce((s, w) => s + w.emailsSent, 0);
  const opened = workflows.reduce((s, w) => s + w.emailsOpened, 0);
  const clicked = workflows.reduce((s, w) => s + w.emailsClicked, 0);
  const replied = workflows.reduce((s, w) => s + w.emailsReplied, 0);
  const cost = workflows.reduce((s, w) => s + w.totalCostUsdCents, 0);
  const runs = workflows.reduce((s, w) => s + w.runCount, 0);

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
  };

  return {
    feature,
    brands,
    workflows,
    aggregate,
    updatedAt: new Date().toISOString(),
  };
}
