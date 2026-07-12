import Image from "next/image";
import type { BrandLeaderboardEntry, BrandTimelinePoint } from "@/lib/performance/fetch-leaderboard";
import { formatCostDollars } from "@/lib/performance/fetch-leaderboard";

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
const CARD_LIMIT = 6;

function labelForBrand(brand: BrandLeaderboardEntry): string {
  return brand.brandName || brand.brandDomain || "Unknown brand";
}

function initials(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function timelineValue(point: BrandTimelinePoint): number {
  return point.cumulativePipelineUsd ?? 0;
}

function hasTimeline(brand: BrandLeaderboardEntry): boolean {
  return (brand.timeline?.length ?? 0) >= 2;
}

function hasProfitableTimeline(brand: BrandLeaderboardEntry): boolean {
  return hasTimeline(brand) && (brand.roiMultiple ?? 0) > 1 && (brand.expectedRevenueUsd ?? 0) > 0;
}

function formatUsdShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `$${Math.round(value / 1_000).toLocaleString("en-US")}k`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function svgSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function MiniRevenueChart({
  timeline,
  expectedRevenueUsd,
  chartId,
}: {
  timeline: BrandTimelinePoint[];
  expectedRevenueUsd: number | null;
  chartId: string;
}) {
  const values = timeline.map(timelineValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const width = 320;
  const height = 132;
  const plotTop = 10;
  const plotRight = 8;
  const plotBottom = 24;
  const plotLeft = 42;
  const plotWidth = width - plotLeft - plotRight;
  const plotHeight = height - plotTop - plotBottom;
  const points = values
    .map((value, index) => {
      const x = plotLeft + (values.length === 1 ? 0 : (index / (values.length - 1)) * plotWidth);
      const y = plotTop + plotHeight - ((value - min) / span) * plotHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const fillPoints = `${plotLeft},${plotTop + plotHeight} ${points} ${plotLeft + plotWidth},${plotTop + plotHeight}`;
  const finalValue = expectedRevenueUsd ?? values[values.length - 1] ?? 0;
  const firstDate = timeline[0]?.date;
  const lastDate = timeline[timeline.length - 1]?.date;
  const gradientId = svgSafeId(`benchmarkRevenueFill-${chartId}`);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label="Pipeline revenue over time">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#45e38e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#45e38e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = plotTop + ratio * plotHeight;
          return (
            <line key={ratio} x1={plotLeft} x2={plotLeft + plotWidth} y1={y} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
          );
        })}
        <text x={0} y={plotTop + 4} className="fill-gray-400 text-[10px]">
          {formatUsdShort(max)}
        </text>
        <text x={0} y={plotTop + plotHeight + 3} className="fill-gray-400 text-[10px]">
          {formatUsdShort(min)}
        </text>
        <polygon points={fillPoints} fill={`url(#${gradientId})`} />
        <polyline points={points} fill="none" stroke="#45e38e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.split(" ").map((point, index) => {
          if (index !== values.length - 1) return null;
          const [cx, cy] = point.split(",");
          return <circle key={point} cx={cx} cy={cy} r="3.5" fill="#45e38e" />;
        })}
        {firstDate && (
          <text x={plotLeft} y={height - 4} className="fill-gray-400 text-[10px]">
            {formatDateShort(firstDate)}
          </text>
        )}
        {lastDate && (
          <text x={plotLeft + plotWidth} y={height - 4} textAnchor="end" className="fill-gray-400 text-[10px]">
            {formatDateShort(lastDate)}
          </text>
        )}
      </svg>
      <p className="mt-1 text-right text-xs font-semibold text-gray-900">
        {formatUsdShort(finalValue)} expected pipeline
      </p>
    </div>
  );
}

function BrandLogo({ brand }: { brand: BrandLeaderboardEntry }) {
  const label = labelForBrand(brand);
  if (brand.brandDomain && LOGO_DEV_TOKEN) {
    return (
      <Image
        src={`https://img.logo.dev/${brand.brandDomain}?token=${LOGO_DEV_TOKEN}&size=80`}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 rounded-lg border border-gray-200 bg-white object-contain"
        unoptimized
      />
    );
  }
  return (
    <div className="h-9 w-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
      {initials(label)}
    </div>
  );
}

function BrandTrajectoryCard({ brand }: { brand: BrandLeaderboardEntry }) {
  const label = labelForBrand(brand);
  const timeline = brand.timeline!;
  const chartId = brand.brandId || brand.brandDomain || label;

  return (
    <article className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo brand={brand} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{label}</h3>
            {brand.brandDomain && (
              <p className="text-xs text-gray-400 truncate">{brand.brandDomain}</p>
            )}
          </div>
        </div>
        <span className="text-[11px] rounded-full bg-blue-50 px-2 py-1 text-blue-600 whitespace-nowrap">
          ROI {brand.roiMultiple!.toFixed(1)}x
        </span>
      </div>

      <div className="mt-4">
        <MiniRevenueChart
          timeline={timeline}
          expectedRevenueUsd={brand.expectedRevenueUsd}
          chartId={chartId}
        />
      </div>
    </article>
  );
}

export function ClientTrajectoriesSection({ brands }: { brands: BrandLeaderboardEntry[] }) {
  const visibleBrands = [...brands]
    .filter(hasProfitableTimeline)
    .sort((a, b) => {
      return (b.expectedRevenueUsd ?? 0) - (a.expectedRevenueUsd ?? 0);
    })
    .slice(0, CARD_LIMIT);

  if (visibleBrands.length === 0) return null;

  return (
    <section className="py-10 md:py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
              Client trajectories
            </p>
            <h2 className="font-display text-xl md:text-2xl font-bold text-gray-900">
              Real campaign snapshots from active brands
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Mini versions of the same expected-pipeline time-series used in the dashboard,
              generated from public benchmark data.
            </p>
          </div>
          <div className="text-xs text-gray-400">
            public revenue timelines
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleBrands.map((brand) => (
            <BrandTrajectoryCard
              key={brand.brandId || brand.brandDomain || labelForBrand(brand)}
              brand={brand}
            />
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Total spend shown in the benchmark is {formatCostDollars(
            visibleBrands.reduce((sum, brand) => sum + brand.totalCostUsdCents, 0),
          )} across these highlighted brands.
        </p>
      </div>
    </section>
  );
}
