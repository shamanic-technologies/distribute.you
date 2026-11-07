"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ProviderLogo } from "@/components/provider-logo";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getBrandPublishedUnits } from "@/lib/api";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { friendlyDate } from "@/lib/friendly-datetime";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { outcomeOf } from "@/lib/v2/outcomes";
import { v2Href, v2OutcomeHref } from "@/lib/v2/routes";
import {
  PUBLISHED_OUTCOME_COPY,
  PUBLISHED_OUTCOME_DOMAIN,
  PUBLISHED_OUTCOME_KEYS,
  costPerSignupReasonWords,
  dayTime,
  performedByLabel,
  publishedRoiToShow,
  visitsReasonWords,
  type PublishedDay,
  type PublishedOutcomeKey,
  type PublishedUnitRow,
  type PublishedUnits,
} from "@/lib/v2/published-units";
import { BarSpark, EmptyNote, Figure, Shimmer, StatTile, TopBar } from "@/components/v2/ui";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { Arrow } from "@/components/v2/research-bits";
import { RoiLabel, RoiValue } from "@/components/v2/roi-label";

/**
 * ONE PUBLISHED OUTCOME (owner 2026-11-06, OUTCOME-FINEST-1106: « du hardcode pour chaque [outcome] »; « en connectant les
 * comptes sociaux, même si ce n'est pas Distribute qui a posté … ça n'empêche pas d'avoir tous les graphes, stats, les
 * créatives »): Threads posts, X posts, LinkedIn posts, newsletter emails, each its own page. Tiles, two charts over time,
 * then every post (or newsletter) with its creative, account, who performed it and what it led to. Every figure is
 * features-service's (`published-units`); nothing is summed or divided here.
 */

const DASH = <span className="k-fg4">—</span>;
const TICK = { fontSize: 11, fill: "var(--fg-3)" };
const EVERYONE = "var(--data-teal)";
const OURS = "var(--accent)";
const PAGE = 50;
/** Tile count to grid columns (static class names, so Tailwind compiles them). */
const TILE_COLS: Record<number, string> = { 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6", 7: "lg:grid-cols-7" };

export function usePublishedUnits(brandId: string, outcomeKey: PublishedOutcomeKey) {
  return useAuthQuery(["publishedUnits", brandId, outcomeKey], () => getBrandPublishedUnits(brandId, outcomeKey), { ...pollOptions, enabled: !!brandId });
}

/** Every published outcome's read, in a fixed order (the Outcomes overview lists one card per outcome with a row). */
export function usePublishedOutcomes(brandId: string) {
  const newsletter = usePublishedUnits(brandId, "newsletter_email_sent");
  const x = usePublishedUnits(brandId, "x_post_published");
  const linkedin = usePublishedUnits(brandId, "linkedin_post_published");
  const threads = usePublishedUnits(brandId, "threads_post_published");
  const byKey = { newsletter_email_sent: newsletter, x_post_published: x, linkedin_post_published: linkedin, threads_post_published: threads };
  const reads = PUBLISHED_OUTCOME_KEYS.map((key) => ({ key, q: byKey[key] }));
  return {
    settled: reads.every((r) => r.q.data !== undefined || r.q.isError),
    failed: reads.filter((r) => !r.q.data && r.q.isError).map((r) => r.key),
    withRows: reads.flatMap((r) => (r.q.data && r.q.data.rows.length > 0 ? [{ key: r.key, data: r.q.data }] : [])),
  };
}

/** A published outcome's served catalogue name (the sidebar entry and the page title read the same one). */
export function usePublishedOutcomeLabel(key: PublishedOutcomeKey): string {
  return useLabel(key);
}

function useLabel(key: PublishedOutcomeKey): string {
  const catalogue = useLegCatalogue();
  return outcomeOf(catalogue, null, key)?.label ?? key;
}

function NetworkLogo({ outcomeKey, size = 16 }: { outcomeKey: PublishedOutcomeKey; size?: number }) {
  return <ProviderLogo domain={PUBLISHED_OUTCOME_DOMAIN[outcomeKey]} size={size} className="rounded-[3px]" />;
}

/** $ per signup on what we did: Learning while no signup came from it yet. */
function CostPerSignup({ data }: { data: PublishedUnits }) {
  if (data.costPerSignupUsd == null) return <span className="k-fg3 text-[13px] font-normal">{costPerSignupReasonWords(data.costPerSignupUnavailableReason)}</span>;
  return <>{formatUsdAdaptive(data.costPerSignupUsd)}</>;
}

/** The Outcomes overview card of one published outcome: the Research hub card anatomy, like its siblings. */
export function PublishedOutcomeCard({ outcomeKey, data, icon }: { outcomeKey: PublishedOutcomeKey; data: PublishedUnits; icon: string | null }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const name = useLabel(outcomeKey);
  const copy = PUBLISHED_OUTCOME_COPY[outcomeKey];
  const all = data.totals.all;
  return (
    <div className="k-card relative flex min-w-0 flex-col p-4 transition-shadow hover:shadow-[var(--elev-popover)]">
      <div className="flex items-center gap-3">
        <CatalogueMark icon={icon} name={name} size={28} />
        <Link href={v2OutcomeHref(orgId, brandId, outcomeKey)} className="min-w-0 flex-1 truncate text-[14px] font-medium leading-5 after:absolute after:inset-0 after:content-['']">
          {name}
        </Link>
      </div>
      <div className="k-inset mt-4 grid grid-cols-2 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
        <div className="min-w-0 border-r border-[var(--line-subtle)] p-3">
          <p className="k-label">How many</p>
          <div className="mt-1.5 flex h-7 items-center text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{formatCount(all.units)}</div>
          <p className="k-fg3 mt-0.5 truncate text-[11px] tabular-nums">
            {formatCount(data.totals.ours.units)} by us
          </p>
          <BarSpark values={data.daily.slice(-12).map((d) => d.units)} className="mt-2" />
        </div>
        <div className="min-w-0 p-3">
          <p className="k-label">$ / signup</p>
          <div className="mt-1.5 text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">
            <CostPerSignup data={data} />
          </div>
          <p className="k-fg3 mt-0.5 truncate text-[11px] tabular-nums">{formatUsdAdaptive(data.totals.ours.spentUsd)} spent</p>
          <BarSpark values={data.daily.slice(-12).map((d) => d.visits)} className="mt-2" />
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 pt-3 text-[13px]">
        <span className="k-fg3 min-w-0 flex-1 truncate">See each {copy.row}</span>
        <Arrow />
      </div>
      <div className="relative z-10 mt-2 flex min-w-0 items-center gap-1.5 text-[12px]">
        <NetworkLogo outcomeKey={outcomeKey} />
        <span className="k-fg2 truncate">
          {data.visitsMeasured === false
            ? "Visits not tracked yet"
            : `${formatCount(all.visits)} visit${all.visits === 1 ? "" : "s"}, ${formatCount(all.signups)} signup${all.signups === 1 ? "" : "s"}`}
        </span>
      </div>
    </div>
  );
}

export function PublishedOutcomePage({ outcomeKey }: { outcomeKey: PublishedOutcomeKey }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const q = usePublishedUnits(brandId, outcomeKey);
  const name = useLabel(outcomeKey);
  const copy = PUBLISHED_OUTCOME_COPY[outcomeKey];
  const data = q.data;
  return (
    <div>
      <TopBar crumbs={[{ label: "Outcomes", href: v2OutcomeHref(orgId, brandId) }, { label: name }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex items-center gap-3">
          <NetworkLogo outcomeKey={outcomeKey} size={28} />
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">{name}</h1>
        </div>
        <p className="k-fg2 mb-6 mt-1 text-[14px]">
          {copy.network
            ? `Every post on your connected ${copy.network} accounts, by us and by your team, and what each one brought in.`
            : "Every newsletter you sent, and what each one brought in."}
        </p>
        {!data ? (
          q.isError ? (
            <div className="k-card">
              <EmptyNote>We could not read your {copy.rows} right now. Retrying.</EmptyNote>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Shimmer key={i} className="h-[92px] rounded-[12px]" />
                ))}
              </div>
              <Shimmer className="h-[230px] rounded-[12px]" />
              <Shimmer className="h-10 rounded-[8px]" />
              <Shimmer className="h-10 rounded-[8px]" />
              <Shimmer className="h-10 rounded-[8px]" />
            </div>
          )
        ) : (
          <PublishedBody outcomeKey={outcomeKey} data={data} />
        )}
      </div>
    </div>
  );
}

export function PublishedBody({ outcomeKey, data }: { outcomeKey: PublishedOutcomeKey; data: PublishedUnits }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const copy = PUBLISHED_OUTCOME_COPY[outcomeKey];
  const { all, ours } = data.totals;
  // Nothing published yet: one line and the way to bring the posts in, no wall of zeros.
  if (data.rows.length === 0) {
    return (
      <div className="k-card px-4 py-8 text-center text-[13px]">
        <p className="k-fg2">{copy.network ? `No ${copy.network} post yet.` : "No newsletter sent yet."}</p>
        {copy.network && (
          <Link href={`${v2Href(orgId, brandId, "integrations")}/ai`} className="mt-2 inline-block text-[var(--accent)] hover:underline">
            Connect your {copy.network} account
          </Link>
        )}
      </div>
    );
  }
  const roi = publishedRoiToShow(data);
  // visitsMeasured false = nothing tracks a click on this outcome: the visits and signups are not tracked, never 0.
  const visitsTracked = data.visitsMeasured !== false;
  // Posts, Views, then Visits + Signups + $ / signup when tracked (one "Not tracked" tile otherwise), Value, ROI.
  const tiles = 1 + (copy.hasViews ? 1 : 0) + (visitsTracked ? 3 : 1) + (all.valueUsd !== undefined ? 1 : 0) + (roi ? 1 : 0);
  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-2 gap-3 ${TILE_COLS[tiles] ?? "lg:grid-cols-4"}`}>
        <StatTile label={copy.network ? "Posts" : "Emails sent"}>
          <Figure value={formatCount(all.units)} unit={all.units === 1 ? copy.unit : copy.units} />
          <p className="k-fg3 mt-0.5 truncate text-[12px] tabular-nums">
            {copy.network ? `${formatCount(ours.units)} by us` : `${formatCount(all.rows)} ${all.rows === 1 ? copy.row : copy.rows}`}
          </p>
        </StatTile>
        {copy.hasViews && (
          <StatTile label="Views">
            <Figure value={formatCount(all.views)} />
            <p className="k-fg3 mt-0.5 truncate text-[12px] tabular-nums">{formatCount(all.engagements)} engagements</p>
          </StatTile>
        )}
        {visitsTracked ? (
          <>
            <StatTile label="Visits">
              <Figure value={formatCount(all.visits)} unit={all.visits === 1 ? "visit" : "visits"} />
              <p className="k-fg3 mt-0.5 truncate text-[12px]">From a click on a link</p>
            </StatTile>
            <StatTile label="Signups">
              <Figure value={formatCount(all.signups)} unit={all.signups === 1 ? "signup" : "signups"} />
              <p className="k-fg3 mt-0.5 truncate text-[12px]">From those visits</p>
            </StatTile>
          </>
        ) : (
          <StatTile label="Visits and signups">
            <Figure value={<span className="k-fg3 text-[13px] font-normal">{visitsReasonWords(data.visitsUnavailableReason)}</span>} />
            <p className="k-fg3 mt-0.5 truncate text-[12px]">No click on these {copy.rows} is tracked yet</p>
          </StatTile>
        )}
        {all.valueUsd !== undefined && (
          <StatTile label="Value produced">
            <Figure value={formatUsdAdaptive(all.valueUsd)} />
            <p className="k-fg3 mt-0.5 truncate text-[12px] tabular-nums">
              {all.unvaluedRows ? `${formatCount(all.unvaluedRows)} ${all.unvaluedRows === 1 ? copy.row : copy.rows} not valued` : `What your ${copy.rows} are worth`}
            </p>
          </StatTile>
        )}
        {roi && (
          <StatTile label={<RoiLabel />} note={<span className="hidden sm:inline">Since you started</span>}>
            <Figure value={<RoiValue roi={roi} learning={data.measuredReturn?.learning} />} />
            <p className="k-fg3 mt-0.5 truncate text-[12px] tabular-nums">
              {formatUsdAdaptive(ours.spentUsd)} spent by us
            </p>
          </StatTile>
        )}
        {visitsTracked && (
          <StatTile label="$ / signup" note={<span className="hidden sm:inline">Since you started</span>}>
            <Figure value={<CostPerSignup data={data} />} />
            <p className="k-fg3 mt-0.5 truncate text-[12px] tabular-nums">{formatUsdAdaptive(ours.spentUsd)} spent by us</p>
          </StatTile>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title={`${copy.network ? "Posts" : "Emails sent"} per day`} legend={<Legend items={[["Everyone", EVERYONE], ["By us", OURS]]} />}>
          <DayBars days={data.daily} bars={[["units", EVERYONE, `${copy.units} in all`], ["oursUnits", OURS, `${copy.units} by us`]]} />
        </ChartCard>
        <ChartCard title={copy.hasViews ? "Views per day of posting" : "Visits per day of sending"} legend={copy.hasViews ? <Legend items={[["Views", EVERYONE]]} /> : <Legend items={[["Visits", EVERYONE], ["Signups", OURS]]} />}>
          {copy.hasViews ? (
            <DayBars days={data.daily} bars={[["views", EVERYONE, "views"]]} />
          ) : (
            <DayBars days={data.daily} bars={[["visits", EVERYONE, "visits"], ["signups", OURS, "signups"]]} />
          )}
        </ChartCard>
      </div>

      <UnitsTable outcomeKey={outcomeKey} rows={data.rows} repostsExcluded={data.repostsExcluded?.rows ?? 0} visitsTracked={visitsTracked} />
    </div>
  );
}

type DayField = "units" | "oursUnits" | "views" | "visits" | "signups";

/** A served day series (quiet days omitted) on a TIME axis, bars side by side. */
function DayBars({ days, bars }: { days: PublishedDay[]; bars: Array<[DayField, string, string]> }) {
  if (days.length === 0) return <EmptyNote>Nothing yet.</EmptyNote>;
  const rows = days.map((d) => ({ ...d, t: dayTime(d.date) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={1}>
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin - 43200000", "dataMax + 43200000"]}
          tick={TICK}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
          tickFormatter={(t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
        />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={52} tickCount={4} allowDecimals={false} tickFormatter={(v: number) => formatCount(v)} />
        <Tooltip
          cursor={{ fill: "var(--data-track)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as PublishedDay;
            return (
              <div className="k-popover px-2.5 py-1.5 text-[12px]">
                <p className="k-fg3 k-mono">{new Date(dayTime(d.date)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</p>
                {bars.map(([field, color, word]) => (
                  <p key={field} className="tabular-nums">
                    <Dot color={color} /> {formatCount(d[field])} {word}
                  </p>
                ))}
              </div>
            );
          }}
        />
        {bars.map(([field, color]) => (
          <Bar key={field} dataKey={field} fill={color} maxBarSize={14} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** One engagement kind of a row: the served count, `—` when the platform does not report it. */
function Kind({ n }: { n: number | null | undefined }) {
  return <td className="px-3 py-2.5 text-right tabular-nums">{n == null ? DASH : formatCount(n)}</td>;
}

/** A row's visits or signups: the served count, else why it is absent. */
function VisitsCell({ n, reason }: { n: number | null; reason: string | null | undefined }) {
  return <td className="px-3 py-2.5 text-right tabular-nums">{n != null ? formatCount(n) : reason ? <span className="k-fg3 text-[12px]">{visitsReasonWords(reason)}</span> : DASH}</td>;
}

function UnitsTable({
  outcomeKey,
  rows,
  repostsExcluded,
  visitsTracked,
}: {
  outcomeKey: PublishedOutcomeKey;
  rows: PublishedUnitRow[];
  repostsExcluded: number;
  /** False = no click is tracked on this outcome: the Visits and Signups columns would say "Not tracked" on every row, so they go (the tile says it once). */
  visitsTracked: boolean;
}) {
  const copy = PUBLISHED_OUTCOME_COPY[outcomeKey];
  const [shown, setShown] = useState(PAGE);
  const visible = rows.slice(0, shown);
  const isPost = copy.network !== null;
  return (
    <div className="k-card overflow-hidden">
      <div className="flex items-baseline gap-2 px-4 pb-1 pt-3.5">
        <h2 className="text-[14px] font-medium">{isPost ? "Every post" : "Every newsletter"}</h2>
        <span className="k-fg3 text-[14px] tabular-nums">{formatCount(rows.length)}</span>
        {repostsExcluded > 0 && (
          <span className="k-fg3 ml-auto text-[12px] tabular-nums">
            {formatCount(repostsExcluded)} repost{repostsExcluded === 1 ? "" : "s"} of others excluded
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyNote>{isPost ? `No ${copy.network} post yet. Connect your ${copy.network} account to see each one here.` : "No newsletter sent yet."}</EmptyNote>
      ) : (
        <>
          <div className="k-scroll overflow-x-auto">
            <table className={`w-full table-fixed text-[13px] ${isPost ? "min-w-[1320px]" : "min-w-[1040px]"}`}>
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">{copy.creative}</th>
                  <th className="k-label w-[150px] px-3 py-2.5 text-left font-normal">{copy.account}</th>
                  <th className="k-label w-[116px] px-3 py-2.5 text-left font-normal">Performed by</th>
                  {isPost ? (
                    <>
                      <th className="k-label w-[72px] px-3 py-2.5 text-right font-normal">Views</th>
                      <th className="k-label w-[96px] px-3 py-2.5 text-right font-normal">Engagements</th>
                      <th className="k-label w-[64px] px-3 py-2.5 text-right font-normal">Likes</th>
                      <th className="k-label w-[84px] px-3 py-2.5 text-right font-normal">Comments</th>
                      <th className="k-label w-[72px] px-3 py-2.5 text-right font-normal">Reposts</th>
                      <th className="k-label w-[64px] px-3 py-2.5 text-right font-normal">Clicks</th>
                    </>
                  ) : (
                    <th className="k-label w-[80px] px-3 py-2.5 text-right font-normal">Emails</th>
                  )}
                  {visitsTracked && (
                    <>
                      <th className="k-label w-[96px] px-3 py-2.5 text-right font-normal">Visits</th>
                      <th className="k-label w-[96px] px-3 py-2.5 text-right font-normal">Signups</th>
                    </>
                  )}
                  <th className="k-label w-[80px] px-3 py-2.5 text-right font-normal">Value</th>
                  <th className="k-label w-[80px] px-3 py-2.5 text-right font-normal">$ spent</th>
                  <th className="k-label w-[104px] px-3 py-2.5 pr-4 text-right font-normal">{isPost ? "Posted" : "Sent"}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="k-row k-line-subtle border-b align-top last:border-b-0">
                    <td className="px-3 py-2.5 pl-4">
                      <Creative row={r} />
                    </td>
                    <td className="k-fg2 truncate px-3 py-2.5">{r.account ? (isPost ? `@${r.account.replace(/^@/, "")}` : r.account) : DASH}</td>
                    <td className="px-3 py-2.5">
                      <span className="k-chip">{performedByLabel(r.performedBy)}</span>
                    </td>
                    {isPost ? (
                      <>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {r.views == null ? DASH : formatCount(r.views)}
                          {r.metricsWarning === "engagements_exceed_views" && (
                            <span
                              className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--data-amber)] align-middle"
                              title="The platform reports more interactions than views: one of the two is not fully measured."
                            />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.engagements == null ? DASH : formatCount(r.engagements)}</td>
                        <Kind n={r.engagementBreakdown?.likes} />
                        <Kind n={r.engagementBreakdown?.replies} />
                        <Kind n={r.engagementBreakdown?.reposts} />
                        <Kind n={r.engagementBreakdown?.clicks} />
                      </>
                    ) : (
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(r.units)}</td>
                    )}
                    {visitsTracked && (
                      <>
                        <VisitsCell n={r.visits} reason={r.visitsUnavailableReason ?? r.ledgerUnavailableReason} />
                        <VisitsCell n={r.signups} reason={r.visitsUnavailableReason ?? r.ledgerUnavailableReason} />
                      </>
                    )}
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.valueUsd == null ? DASH : formatUsdAdaptive(r.valueUsd)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.spentUsd == null ? DASH : formatUsdAdaptive(r.spentUsd)}</td>
                    <td className="k-mono k-fg2 px-3 py-2.5 pr-4 text-right text-[12px]">{friendlyDate(r.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="k-fg3 k-line-subtle flex items-center gap-3 border-t px-4 py-2.5 text-[12px] tabular-nums">
            <span>
              {formatCount(visible.length)} of {formatCount(rows.length)}
            </span>
            {shown < rows.length && (
              <button type="button" className="k-btn-ghost ml-auto h-6 px-2" onClick={() => setShown(shown + PAGE)}>
                Show {formatCount(Math.min(PAGE, rows.length - shown))} more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** The creative: its text on up to three lines, opening the post where it lives. */
function Creative({ row }: { row: PublishedUnitRow }) {
  const text = row.text?.trim() ? row.text : null;
  const body = text ? <span className="line-clamp-3 whitespace-pre-line break-words">{text}</span> : <span className="k-fg3">No text</span>;
  if (!row.url) return body;
  return (
    <a href={row.url} target="_blank" rel="noopener noreferrer" className="block hover:text-[var(--accent)]">
      {body}
    </a>
  );
}

function ChartCard({ title, legend, children }: { title: string; legend?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="k-label min-w-0">{title}</span>
        {legend}
      </div>
      <div className="mt-3 h-[190px]">{children}</div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} />;
}

function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <span className="k-fg3 flex shrink-0 items-center gap-3 text-[12px]">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <Dot color={color} /> {label}
        </span>
      ))}
    </span>
  );
}
