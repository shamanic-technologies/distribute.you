import Image from "next/image";
import type { BrandLeaderboardEntry, BrandTimelinePoint } from "@/lib/performance/fetch-leaderboard";
import {
  formatCostCentsWhole,
  formatCostDollars,
  formatPercent,
} from "@/lib/performance/fetch-leaderboard";

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
const CARD_LIMIT = 6;

function labelForBrand(brand: BrandLeaderboardEntry): string {
  return brand.brandName || brand.brandDomain || "Unknown brand";
}

function compactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000).toLocaleString("en-US")}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("en-US");
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
  return point.cumulativePipelineUsd ?? point.emailsSent ?? point.emailsReplied ?? 0;
}

function hasTimeline(brand: BrandLeaderboardEntry): boolean {
  return (brand.timeline?.length ?? 0) >= 2;
}

function Sparkline({ timeline }: { timeline: BrandTimelinePoint[] }) {
  const values = timeline.map(timelineValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const width = 280;
  const height = 88;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const fillPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label="Pipeline over time">
      <polygon points={fillPoints} fill="rgb(59 130 246 / 0.10)" />
      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(" ").map((point, index) => {
        if (index !== 0 && index !== values.length - 1) return null;
        const [cx, cy] = point.split(",");
        return <circle key={point} cx={cx} cy={cy} r="3.5" fill="#2563eb" />;
      })}
    </svg>
  );
}

function FunnelPreview({ brand }: { brand: BrandLeaderboardEntry }) {
  const stages = [
    { label: "Sent", value: brand.emailsSent, color: "bg-blue-500" },
    { label: "Opened", value: brand.emailsOpened, color: "bg-emerald-500" },
    { label: "Clicked", value: brand.emailsClicked, color: "bg-amber-500" },
    { label: "Replied", value: brand.emailsReplied, color: "bg-gray-900" },
  ];
  const max = Math.max(1, brand.emailsSent);

  return (
    <div className="h-24 flex flex-col justify-end gap-2" aria-label="Current funnel">
      {stages.map((stage) => {
        const width = stage.value > 0 ? Math.max(8, Math.round((stage.value / max) * 100)) : 0;
        return (
          <div key={stage.label} className="grid grid-cols-[56px_1fr_42px] items-center gap-2">
            <span className="text-[11px] text-gray-400">{stage.label}</span>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${stage.color}`} style={{ width: `${width}%` }} />
            </div>
            <span className="text-[11px] text-gray-500 text-right">{compactCount(stage.value)}</span>
          </div>
        );
      })}
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
  const timeline = hasTimeline(brand) ? brand.timeline : null;

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
        <span className="text-[11px] rounded-full bg-gray-100 px-2 py-1 text-gray-500 whitespace-nowrap">
          {timeline ? "timeline" : "funnel"}
        </span>
      </div>

      <div className="mt-4">
        {timeline ? (
          <Sparkline timeline={timeline} />
        ) : (
          <FunnelPreview brand={brand} />
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
        <div>
          <p className="text-[11px] text-gray-400">Sent</p>
          <p className="text-sm font-semibold text-gray-900">{compactCount(brand.emailsSent)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">Open rate</p>
          <p className="text-sm font-semibold text-gray-900">
            {brand.emailsSent > 0 ? formatPercent(brand.openRate) : "-"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">$/reply</p>
          <p className="text-sm font-semibold text-gray-900">
            {formatCostCentsWhole(brand.costPerReplyCents)}
          </p>
        </div>
      </div>
    </article>
  );
}

export function ClientTrajectoriesSection({ brands }: { brands: BrandLeaderboardEntry[] }) {
  const visibleBrands = [...brands]
    .filter((brand) => brand.emailsSent > 0)
    .sort((a, b) => {
      if (hasTimeline(a) !== hasTimeline(b)) return hasTimeline(a) ? -1 : 1;
      return b.emailsSent - a.emailsSent;
    })
    .slice(0, CARD_LIMIT);

  if (visibleBrands.length === 0) return null;

  const cardsWithTimeline = visibleBrands.filter(hasTimeline).length;

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
              A compact read on the brands already running sales outreach through distribute.
              Cards use public benchmark data; dated timelines appear as soon as the public API
              includes them.
            </p>
          </div>
          <div className="text-xs text-gray-400">
            {cardsWithTimeline > 0
              ? `${cardsWithTimeline} timelines live`
              : "current public funnel snapshots"}
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
