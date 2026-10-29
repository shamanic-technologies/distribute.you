"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleDashedIcon } from "@phosphor-icons/react/dist/csr/CircleDashed";
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { RecycleIcon } from "@phosphor-icons/react/dist/csr/Recycle";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getBrandLedger, getBrandLedgerRuns, getPublicCatalogueSteps, type PublicCatalogueStep } from "@/lib/api";
import {
  centsToUsd,
  nextLedgerRunsCursor,
  type BrandBooks,
  type BrandLedger,
  type BrandLedgerDay,
  type BrandLedgerRun,
  type LedgerMoney,
  type LedgerRunsCursor,
} from "@/lib/v2/brand-ledger";
import { formatCentsAsUsd, formatCount } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { v2RunHref } from "@/lib/v2/routes";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { EmptyNote, SectionTitle, Shimmer, TopBar } from "@/components/v2/ui";

/**
 * Ledger (staff, FACTORY-P4-PAGES): the books of ONE brand, the cost-accounting doctrine's line
 * on top (standard cost charged - reuse gain + runs producing none + abnormal loss = runs spend,
 * reconciled to the cent), one chart per figure over time, what the runs produced, then every
 * production order newest first. runs-service serves every figure and the verdict; this page
 * draws them (gross basis: what the work cost to make, whoever paid) and computes none.
 */

const DASH = <span className="k-fg4">—</span>;
const TICK = { fontSize: 11, fill: "var(--fg-3)" };
const gross = (m: LedgerMoney) => m.grossCents;
const usd = (cents: string) => formatCentsAsUsd(cents, 2);

function usePublicSteps() {
  return useAuthQuery(["publicCatalogueSteps"], getPublicCatalogueSteps, { staleTime: 10 * 60_000 });
}

type Look = { color: string; Icon: typeof CoinsIcon };

/** One figure of the books: its look, its words, and how to read it off a served row. */
interface BookFigure {
  key: string;
  title: string;
  /** What it tells you, one plain sentence. */
  tells: string;
  look: Look;
  money?: (b: BrandBooks) => LedgerMoney;
  count?: (d: BrandLedgerDay) => number;
}

const FIGURES: BookFigure[] = [
  {
    key: "spend",
    title: "Runs spend",
    tells: "Everything the brand's runs cost, on the day the cost landed.",
    look: { color: "var(--accent)", Icon: CoinsIcon },
    money: (b) => b.spend,
  },
  {
    key: "standard",
    title: "Standard cost charged",
    tells: "What the outcomes cost at the price paid to make them, reuses included.",
    look: { color: "var(--data-teal)", Icon: ReceiptIcon },
    money: (b) => b.standardCharged,
  },
  {
    key: "reuse",
    title: "Reuse gain",
    tells: "Outcomes used again: charged at their price, never paid for twice.",
    look: { color: "var(--data-violet)", Icon: RecycleIcon },
    money: (b) => b.reuseGain,
  },
  {
    key: "none",
    title: "Runs producing none",
    tells: "Spend of runs that declared no outcome: support work, or a service not declaring yet.",
    look: { color: "var(--data-amber)", Icon: CircleDashedIcon },
    money: (b) => b.producedNone,
  },
  {
    key: "abnormal",
    title: "Abnormal loss",
    tells: "Spend in no unit cost: work on a lead already past the pipe's goal, or bought twice.",
    look: { color: "var(--data-rose)", Icon: WarningIcon },
    money: (b) => b.abnormal,
  },
  {
    key: "occurrences",
    title: "Outcomes produced",
    tells: "Outcomes the brand's runs declared they made, each one a cost carrier.",
    look: { color: "var(--data-sky)", Icon: PackageIcon },
    count: (d) => d.occurrences,
  },
];

const TIPS = {
  standard: "Each outcome is charged the price paid to make it, every time a run uses it.",
  reuse: "The charges of outcomes used again. They count in the standard cost, and no new money was spent on them.",
  none: "Runs that stated no outcome. Named support (Copilot, setup, payment fees) is part of it; the rest is a service that does not declare yet.",
  abnormal: "Spend kept out of every unit cost, as accounting norms require: a send after the lead already said yes, or a lead bought twice.",
};

export function V2Ledger() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const q = useAuthQuery(["brandLedger", brandId], () => getBrandLedger(brandId), { ...pollOptions, retry: false });
  const steps = usePublicSteps();
  const l = q.data;
  return (
    <>
      <TopBar crumbs={[{ label: "Ledger" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {l || q.isError ? (
              <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
                {l ? `${usd(gross(l.books.spend))} spent since ${dayText(l.since)}` : "The books could not be read"}
              </h1>
            ) : (
              <Shimmer className="h-[34px] w-72" />
            )}
            <p className="k-fg2 mt-1 text-[14px]">Every run is a production order: what it used, what it made, what it cost.</p>
          </div>
          {l && <Verdict l={l} />}
        </div>

        {q.isError && !l ? (
          <div className="k-card mt-6">
            <EmptyNote>We could not read this brand&apos;s books. Retrying.</EmptyNote>
          </div>
        ) : !l ? (
          <div className="mt-6 space-y-3">
            <Shimmer className="h-[148px] w-full rounded-[12px]" />
            <div className="grid gap-3 lg:grid-cols-2">
              {FIGURES.map((f) => (
                <Shimmer key={f.key} className="h-[260px] w-full rounded-[12px]" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <BooksCard books={l.books} />
            <section className="mt-8">
              <SectionTitle right={<span>Per UTC day, billed gross</span>}>Over time</SectionTitle>
              <div className="grid gap-3 lg:grid-cols-2">
                {FIGURES.map((f) => (
                  <FigureChart key={f.key} figure={f} ledger={l} />
                ))}
              </div>
            </section>
            <OutcomesTable ledger={l} steps={steps.data} />
          </>
        )}
        <ProductionOrders orgId={orgId} brandId={brandId} steps={steps.data} />
      </div>
    </>
  );
}

function dayText(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** The served verdict: reconciled to the cent, or off by the served difference; days not stored yet named. */
function Verdict({ l }: { l: BrandLedger }) {
  return (
    <div className="flex flex-col items-end gap-1 text-[12px]">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.books.balanced ? "var(--run)" : "var(--data-rose)" }} />
        <span className={l.books.balanced ? "k-fg2" : "text-[var(--data-rose)]"}>
          {l.books.balanced ? "Reconciled to the cent" : `Off by ${l.books.difference.grossCents}¢`}
        </span>
      </span>
      {!l.complete && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-amber)]" />
          <span className="k-fg2">
            {formatCount(l.daysMissing.length)} {l.daysMissing.length === 1 ? "day" : "days"} not computed yet, out of every figure
          </span>
        </span>
      )}
    </div>
  );
}

/** The books line: the runs spend big, its parts on one bar, and the doctrine's equation in words. */
function BooksCard({ books }: { books: BrandBooks }) {
  const total = centsToUsd(gross(books.spend));
  if (!books.production) console.error("[v2 ledger] runs-service serves no `production` part yet: the bar is not drawn");
  const parts = books.production
    ? [
        { label: "Outcomes made", money: books.production, color: "var(--data-teal)", tip: "Spend spread over the outcomes the runs made, the leads that never got there included." },
        { label: "Runs producing none", money: books.producedNone, color: "var(--data-amber)", tip: TIPS.none },
        { label: "Abnormal loss", money: books.abnormal, color: "var(--data-rose)", tip: TIPS.abnormal },
      ]
    : [];
  return (
    <div className="k-card mt-6 p-5">
      <p className="k-label">Runs spend</p>
      <p className="mt-1.5 text-[32px] font-medium leading-9 tracking-[-0.02em] tabular-nums">{usd(gross(books.spend))}</p>
      <p className="k-fg2 mt-1 text-[13px] leading-5 tabular-nums">
        {usd(gross(books.standardCharged))} standard cost charged
        <InfoTooltip tip={TIPS.standard} placement="bottom" />, minus {usd(gross(books.reuseGain))} reuse gain
        <InfoTooltip tip={TIPS.reuse} placement="bottom" />, plus {usd(gross(books.producedNone))} of runs producing none, plus{" "}
        {usd(gross(books.abnormal))} abnormal loss, is {usd(gross(books.spend))}.
      </p>
      {parts.length > 0 && (
        <div className="mt-5">
          <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-[var(--data-track)]">
            {parts.map((p) => {
              const v = centsToUsd(gross(p.money));
              return v > 0 && total > 0 ? (
                <div key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${Math.min(100, (v / total) * 100)}%`, background: p.color }} />
              ) : null;
            })}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
            {parts.map((p) => (
              <li key={p.label} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: p.color }} />
                <span className="k-fg2">{p.label}</span>
                <span className="tabular-nums">{usd(gross(p.money))}</span>
                <InfoTooltip tip={p.tip} placement="bottom" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FigureMark({ look, size = 28 }: { look: Look; size?: number }) {
  const { color, Icon } = look;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-[8px]"
      style={{
        width: size,
        height: size,
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)`,
      }}
    >
      <Icon size={Math.round(size * 0.58)} weight="duotone" />
    </span>
  );
}

/** One figure over time: its mark, its total, what it tells you, and the served day series as bars. */
function FigureChart({ figure, ledger }: { figure: BookFigure; ledger: BrandLedger }) {
  // A money figure's total is the served books line; outcomes are counted per outcome in the table below.
  const total = figure.money ? usd(gross(figure.money(ledger.books))) : null;
  const rows = ledger.days.map((d) => ({ day: d.day, v: figure.money ? centsToUsd(gross(figure.money(d))) : figure.count!(d) }));
  const fmt = (v: number) => (figure.money ? formatUsdTick(v) : formatCount(v));
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <div className="flex items-start gap-3">
        <FigureMark look={figure.look} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] font-medium">{figure.title}</span>
            {total && <span className="text-[18px] font-medium tabular-nums tracking-[-0.01em]">{total}</span>}
          </div>
          <p className="k-fg3 mt-0.5 text-[12px] leading-[18px]">{figure.tells}</p>
        </div>
      </div>
      <div className="mt-3 h-[150px]">
        {rows.length === 0 ? (
          <EmptyNote>No day computed yet.</EmptyNote>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={rows.length > 60 ? 0 : "15%"}>
              <XAxis dataKey="day" tick={TICK} tickLine={false} axisLine={false} minTickGap={32} tickFormatter={(d: string) => shortDay(d)} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={48} tickCount={4} tickFormatter={fmt} allowDecimals={!!figure.money} />
              <Tooltip
                cursor={{ fill: "var(--data-track)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as { day: string };
                  const d = ledger.days.find((x) => x.day === r.day);
                  if (!d) return null;
                  return (
                    <div className="k-popover px-2.5 py-1.5 text-[12px]">
                      <p className="k-fg3 k-mono">{dayText(r.day)}</p>
                      <p className="font-medium tabular-nums">{figure.money ? usd(gross(figure.money(d))) : formatCount(figure.count!(d))}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="v" fill={figure.look.color} isAnimationActive={false} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function shortDay(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatUsdTick(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : `$${v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : 0 })}`;
}

/** An outcome by its catalogue step: served icon and name. */
function OutcomeLabel({ outcomeKey, steps, size = 16 }: { outcomeKey: string; steps: PublicCatalogueStep[] | undefined; size?: number }) {
  const step = steps?.find((s) => s.key === outcomeKey);
  if (steps && !step) console.error("[v2 ledger] outcome missing from the public step catalogue", { outcomeKey });
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <CatalogueMark icon={step?.icon ?? null} name={step?.name ?? outcomeKey} size={size} />
      <span className="truncate">{step?.name ?? outcomeKey}</span>
    </span>
  );
}

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const THR = `${TH} text-right`;
const TD = "px-3 py-2 first:pl-4 last:pr-4";
const TDR = `${TD} text-right tabular-nums`;

function OutcomesTable({ ledger, steps }: { ledger: BrandLedger; steps: PublicCatalogueStep[] | undefined }) {
  return (
    <section className="mt-8">
      <SectionTitle count={ledger.outcomes.length}>What the runs made</SectionTitle>
      <div className="k-card overflow-hidden">
        {ledger.outcomes.length === 0 ? (
          <EmptyNote>No run of this brand has declared an outcome yet.</EmptyNote>
        ) : (
          <div className="k-scroll overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className={TH}>Outcome</th>
                  <th className={THR}>Outcomes made</th>
                  <th className={THR}>Production cost</th>
                </tr>
              </thead>
              <tbody>
                {ledger.outcomes.map((o) => (
                  <tr key={o.outcomeKey} className="k-row k-line-subtle border-b last:border-b-0">
                    <td className={TD}>
                      <OutcomeLabel outcomeKey={o.outcomeKey} steps={steps} />
                    </td>
                    <td className={TDR}>{formatCount(o.occurrences)}</td>
                    <td className={TDR}>{usd(gross(o.cost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/** Every production order, newest first: one served page per cursor, older pages on demand. */
function ProductionOrders({ orgId, brandId, steps }: { orgId: string; brandId: string; steps: PublicCatalogueStep[] | undefined }) {
  const [cursors, setCursors] = useState<LedgerRunsCursor[]>([null]);
  return (
    <section className="mt-8">
      <SectionTitle>Production orders</SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-[13px]">
            <colgroup>
              <col className="w-[96px]" />
              <col />
              <col className="w-[24%]" />
              <col className="w-[24%]" />
              <col className="w-[96px]" />
            </colgroup>
            <thead>
              <tr className="k-line-subtle border-b">
                <th className={TH}>Started</th>
                <th className={TH}>Run</th>
                <th className={TH}>Used</th>
                <th className={TH}>Made</th>
                <th className={THR}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {cursors.map((c) => (
                <RunsPage key={`${c?.before ?? "newest"}|${c?.beforeId ?? ""}`} cursor={c} orgId={orgId} brandId={brandId} steps={steps} />
              ))}
            </tbody>
          </table>
        </div>
        <OrdersFooter brandId={brandId} last={cursors[cursors.length - 1]} onMore={(next) => setCursors((cs) => [...cs, next])} />
      </div>
    </section>
  );
}

/** One page of runs; the newest one polls, an older one is read once. */
function useRunsPage(brandId: string, cursor: LedgerRunsCursor) {
  return useAuthQuery(["brandLedgerRuns", brandId, cursor?.before ?? "newest", cursor?.beforeId ?? ""], () => getBrandLedgerRuns(brandId, cursor), {
    ...(cursor ? { staleTime: Infinity } : pollOptions),
    retry: false,
  });
}

function RunsPage({ cursor, orgId, brandId, steps }: { cursor: LedgerRunsCursor; orgId: string; brandId: string; steps: PublicCatalogueStep[] | undefined }) {
  const q = useRunsPage(brandId, cursor);
  if (q.data === undefined) {
    if (q.isFetchedAfterMount && q.isError) {
      return (
        <tr>
          <td colSpan={5}>
            <EmptyNote>Could not read these runs. Retrying.</EmptyNote>
          </td>
        </tr>
      );
    }
    return (
      <>
        {[0, 1, 2, 3].map((i) => (
          <tr key={i} className="k-line-subtle border-b">
            <td colSpan={5} className="px-4 py-2">
              <Shimmer className="h-6 w-full" />
            </td>
          </tr>
        ))}
      </>
    );
  }
  if (q.data.runs.length === 0) {
    return (
      <tr className="k-line-subtle border-b">
        <td colSpan={5} className="k-fg3 px-4 py-2.5 text-[12px]">
          No run in the 24 hours before {timeText(q.data.before)}.
        </td>
      </tr>
    );
  }
  return (
    <>
      {q.data.runs.map((r) => (
        <RunRow key={r.id} run={r} href={v2RunHref(orgId, brandId, r.id)} steps={steps} />
      ))}
    </>
  );
}

function timeText(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function RunRow({ run, href, steps }: { run: BrandLedgerRun; href: string; steps: PublicCatalogueStep[] | undefined }) {
  return (
    <tr className="k-row k-line-subtle border-b last:border-b-0">
      <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`} title={new Date(run.startedAt).toLocaleString("en-US")}>
        {timeAgo(run.startedAt)}
      </td>
      <td className={TD}>
        <Link href={href} className="block min-w-0 hover:underline">
          <span className="block truncate">
            {run.serviceName} <span className="k-fg3">·</span> {run.taskName}
          </span>
        </Link>
        {run.workflowSlug && (
          <span className="k-fg3 mt-0.5 block truncate text-[12px]">
            <CatalogueName kind="workflow" name={run.workflowSlug} servedKey={run.workflowSlug} />
          </span>
        )}
      </td>
      <td className={TD}>
        <Counts items={run.consumed} steps={steps} />
      </td>
      <td className={TD}>
        {run.produced.length > 0 ? (
          <Counts items={run.produced} steps={steps} />
        ) : run.supportKind ? (
          <span className="k-chip">Support · {run.supportKind.replace(/_/g, " ")}</span>
        ) : (
          <span className="k-fg3 text-[12px]">Made none</span>
        )}
      </td>
      <td className={`${TDR}`}>{run.costRows === 0 ? DASH : usd(run.cost.grossCents)}</td>
    </tr>
  );
}

function Counts({ items, steps }: { items: BrandLedgerRun["produced"]; steps: PublicCatalogueStep[] | undefined }) {
  if (items.length === 0) return DASH;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((o) => (
        <span key={o.outcomeKey} className="k-chip inline-flex max-w-full items-center gap-1">
          <OutcomeLabel outcomeKey={o.outcomeKey} steps={steps} size={12} />
          {o.occurrences > 1 && <span className="k-fg3 tabular-nums">×{formatCount(o.occurrences)}</span>}
        </span>
      ))}
    </span>
  );
}

/** "Show older": the next page starts where the producer says the last one stopped. */
function OrdersFooter({ brandId, last, onMore }: { brandId: string; last: LedgerRunsCursor; onMore: (next: LedgerRunsCursor) => void }) {
  const page = useRunsPage(brandId, last).data;
  return (
    <div className="k-fg3 k-line-subtle flex items-center justify-between border-t px-4 py-2.5 text-[12px] tabular-nums">
      <span>{page ? `Read back to ${timeText(page.windowStart)}` : null}</span>
      <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" disabled={!page} onClick={() => page && onMore(nextLedgerRunsCursor(page))}>
        Show older
      </button>
    </div>
  );
}
