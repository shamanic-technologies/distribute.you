"use client";

import { useMemo, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffBrands, getStaffPriceComparison, getStaffRealCosts, type PriceListRef } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer } from "@/components/v2/ui";
import {
  COMPARISON_INTERVALS,
  PRICE_SOURCES,
  type ComparisonFigures,
  type ComparisonInterval,
  type PriceComparison,
  type PriceSource,
  type StaffBrand,
} from "@/lib/monitoring/monitoring";
import { DailyLines, Dash, PeriodBars, TD, TDR, TH, THR, cents, dayLabel, dollars, monthLabel, n, pct, type Line } from "@/components/v2/monitoring-charts";

/**
 * Monitoring > Margin > Pricing comparison (staff only, owner 2026-10-01): pick two price lists
 * (each the catalogue in force on a day, or the proposed real-cost list computed on a day) and a
 * perimeter (the fleet, one org, one org x brand), and see what that perimeter's consumption since
 * inception would have cost under each, against what it really cost us, and our margin under each,
 * over time. costs-service replays and serves every amount, margin and share; this file picks,
 * names ids from the staff brand list, and draws. It never adds, subtracts or divides money.
 */

const ONCE = { staleTime: 5 * 60_000, retry: false } as const;

const SOURCE_LABEL: Record<PriceSource, string> = { catalogue: "Catalogue", proposed: "Proposed (real ×2)" };
const INTERVAL_LABEL: Record<ComparisonInterval, string> = { day: "Daily", week: "Weekly", month: "Monthly" };
const usdC = (c: number) => dollars(c / 100);
/** A signed $ change: a lower bill reads teal, a higher one rose (the client's side of it). */
function Signed({ c, p, inverse = false }: { c: number; p?: number | null; inverse?: boolean }) {
  const up = c > 0;
  const color = c === 0 ? undefined : up !== inverse ? "var(--data-rose)" : "var(--data-teal)";
  return (
    <span style={{ color }}>
      {up ? "+" : ""}
      {usdC(c)}
      {p != null && <span className="k-fg3"> ({`${p > 0 ? "+" : ""}${pct(p)}`})</span>}
    </span>
  );
}
const periodDay = (p: string) => (p.length === 7 ? `${p}-01` : p.slice(0, 10));
const periodLabel = (interval: ComparisonInterval) => (p: string, short = false) =>
  interval === "month" ? monthLabel(p, short) : dayLabel(p, short ? { month: "short", day: "numeric" } : interval === "week" ? { month: "short", day: "numeric", year: "numeric" } : undefined);

export function PricingComparisonView() {
  const latest = useAuthQuery(["staffRealCosts", null], () => getStaffRealCosts(null), ONCE);
  const brands = useAuthQuery(["staffBrands"], getStaffBrands, ONCE);
  if (latest.isError) {
    return (
      <div className="k-card">
        <EmptyNote>Could not read the price lists from production: {latest.error?.message ?? "unknown error"}.</EmptyNote>
      </div>
    );
  }
  if (!latest.data) return <Shimmer className="h-[320px] w-full" />;
  return <Comparison since={latest.data.rules.since} asOf={latest.data.asOf} brands={brands.data} brandsError={brands.isError} />;
}

/** Org and brand names from the staff brand list: an org is named by its brands. A display lookup. */
function useNames(brands: StaffBrand[] | undefined) {
  return useMemo(() => {
    const brandName = new Map<string, string>();
    const orgBrands = new Map<string, StaffBrand[]>();
    for (const b of brands ?? []) {
      brandName.set(b.id, b.name ?? b.domain ?? b.id);
      if (!b.orgId) continue;
      orgBrands.set(b.orgId, [...(orgBrands.get(b.orgId) ?? []), b]);
    }
    const orgName = (id: string | null) => {
      if (id == null) return "No organization";
      const bs = orgBrands.get(id);
      if (!bs?.length) return `Org ${id.slice(0, 8)}`;
      const names = bs.map((b) => b.name ?? b.domain ?? b.id);
      return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
    };
    return { brandName: (id: string | null) => (id == null ? "No brand" : (brandName.get(id) ?? id.slice(0, 8))), orgName, orgBrands };
  }, [brands]);
}

function ListPicker({ title, value, onChange, since, asOf }: { title: string; value: PriceListRef; onChange: (v: PriceListRef) => void; since: string; asOf: string }) {
  return (
    <div className="min-w-0">
      <p className="k-label">{title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <select className="k-input w-[170px]" value={value.source} onChange={(e) => onChange({ ...value, source: e.target.value as PriceSource })} aria-label={`${title} source`}>
          {PRICE_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
        <input type="date" className="k-input w-[150px]" min={since} max={asOf} value={value.date} onChange={(e) => e.target.value && onChange({ ...value, date: e.target.value })} aria-label={`${title} day`} />
      </div>
    </div>
  );
}

function Comparison({ since, asOf, brands, brandsError }: { since: string; asOf: string; brands: StaffBrand[] | undefined; brandsError: boolean }) {
  const [list1, setList1] = useState<PriceListRef>({ source: "catalogue", date: asOf });
  const [list2, setList2] = useState<PriceListRef>({ source: "proposed", date: asOf });
  const [orgId, setOrgId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [interval, setInterval] = useState<ComparisonInterval>("month");
  const names = useNames(brands);
  const q = useAuthQuery(
    ["staffPriceComparison", list1.source, list1.date, list2.source, list2.date, orgId, brandId, interval],
    () => getStaffPriceComparison({ list1, list2, orgId, brandId, interval }),
    ONCE,
  );
  const orgs = [...names.orgBrands.keys()].sort((a, b) => names.orgName(a).localeCompare(names.orgName(b)));
  const orgBrandList = orgId ? (names.orgBrands.get(orgId) ?? []) : [];
  const pickOrg = (id: string | null) => {
    setOrgId(id);
    setBrandId(null);
  };

  return (
    <div className="space-y-8">
      <div className="k-card grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_auto]">
        <ListPicker title="Price 1" value={list1} onChange={setList1} since={since} asOf={asOf} />
        <ListPicker title="Price 2" value={list2} onChange={setList2} since={since} asOf={asOf} />
        <div className="min-w-0">
          <p className="k-label">Perimeter</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <select className="k-input w-[200px]" value={orgId ?? ""} onChange={(e) => pickOrg(e.target.value || null)} aria-label="Organization">
              <option value="">Every org (fleet)</option>
              {orgs.map((id) => (
                <option key={id} value={id}>
                  {names.orgName(id)}
                </option>
              ))}
            </select>
            <select className="k-input w-[180px]" value={brandId ?? ""} onChange={(e) => setBrandId(e.target.value || null)} disabled={!orgId} aria-label="Brand">
              <option value="">{orgId ? "Every brand of the org" : "Pick an org first"}</option>
              {orgBrandList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name ?? b.domain ?? b.id}
                </option>
              ))}
            </select>
          </div>
          {brandsError && <p className="mt-1 text-[12px]" style={{ color: "var(--data-rose)" }}>Could not read the brand list: ids are shown instead of names.</p>}
        </div>
        <div>
          <p className="k-label">Per</p>
          <span className="mt-1.5 inline-flex items-center gap-1" role="group" aria-label="Interval">
            {COMPARISON_INTERVALS.map((i) => (
              <button key={i} type="button" aria-pressed={interval === i} onClick={() => setInterval(i)} className={interval === i ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}>
                {INTERVAL_LABEL[i]}
              </button>
            ))}
          </span>
        </div>
      </div>

      {q.isError ? (
        <div className="k-card">
          <EmptyNote>Could not compare these prices: {q.error?.message ?? "unknown error"}.</EmptyNote>
        </div>
      ) : !q.data ? (
        <div className="k-card space-y-2 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Shimmer key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : (
        <Result
          c={q.data}
          names={names}
          fetching={q.isFetching}
          onPickOrg={(id) => pickOrg(id)}
          onPickBrand={(o, b) => {
            setOrgId(o);
            setBrandId(b);
          }}
        />
      )}
    </div>
  );
}

type Names = ReturnType<typeof useNames>;

function Result({ c, names, fetching, onPickOrg, onPickBrand }: { c: PriceComparison; names: Names; fetching: boolean; onPickOrg: (id: string | null) => void; onPickBrand: (org: string | null, brand: string | null) => void }) {
  const [allItems, setAllItems] = useState(false);
  const t = c.totals;
  const l1 = `${SOURCE_LABEL[c.list1.source as PriceSource] ?? c.list1.source}, ${dayLabel(c.list1.date)}`;
  const l2 = `${SOURCE_LABEL[c.list2.source as PriceSource] ?? c.list2.source}, ${dayLabel(c.list2.date)}`;
  const interval = c.interval as ComparisonInterval;
  const points = c.buckets.map((b) => ({ ...b, day: periodDay(b.period) }));
  const who = c.perimeter.grain === "fleet" ? "Every org" : c.perimeter.grain === "org" ? names.orgName(c.perimeter.orgId ?? null) : `${names.brandName(c.perimeter.brandId ?? null)} (${names.orgName(c.perimeter.orgId ?? null)})`;
  const amountLines: Line<(typeof points)[number]>[] = [
    { key: "p1", label: "Price 1", color: "var(--data-violet)", get: (b) => b.amount1UsdCents / 100 },
    { key: "p2", label: "Price 2", color: "var(--accent)", get: (b) => b.amount2UsdCents / 100 },
    { key: "real", label: "Real cost", color: "var(--data-rose)", dashed: true, get: (b) => b.realCostUsdCents / 100 },
  ];
  const cumulativeLines: Line<(typeof points)[number]>[] = [
    { key: "c1", label: "Price 1", color: "var(--data-violet)", get: (b) => b.cumulative.amount1UsdCents / 100 },
    { key: "c2", label: "Price 2", color: "var(--accent)", get: (b) => b.cumulative.amount2UsdCents / 100 },
    { key: "creal", label: "Real cost", color: "var(--data-rose)", dashed: true, get: (b) => b.cumulative.realCostUsdCents / 100 },
    { key: "cbilled", label: "Actually billed", color: "var(--fg-3)", dashed: true, get: (b) => b.cumulative.netBilledUsdCents / 100 },
  ];
  const marginLines: Line<(typeof points)[number]>[] = [
    { key: "m1", label: "Margin, price 1", color: "var(--data-violet)", get: (b) => b.margin1UsdCents / 100 },
    { key: "m2", label: "Margin, price 2", color: "var(--accent)", get: (b) => b.margin2UsdCents / 100 },
  ];
  const ONE: { key: string; label: string; days: number | null }[] = [{ key: "all", label: "All", days: null }];
  const fmtUsd = (v: number) => dollars(v);
  const caption = (b: (typeof points)[number]) => `${usdC(b.amount1UsdCents)} vs ${usdC(b.amount2UsdCents)}, real cost ${usdC(b.realCostUsdCents)}`;
  const items = [...c.costItems].sort((a, b) => Math.abs(b.differenceUsdCents) - Math.abs(a.differenceUsdCents));

  const kpis: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] = [
    { label: "Price 1", value: usdC(t.amount1UsdCents), sub: l1 },
    { label: "Price 2", value: usdC(t.amount2UsdCents), sub: l2 },
    { label: "Difference", value: <Signed c={t.differenceUsdCents} />, sub: `${t.differencePct == null ? "" : `${t.differencePct > 0 ? "+" : ""}${pct(t.differencePct)}, `}price 2 against price 1` },
    { label: "Real cost", value: usdC(t.realCostUsdCents), sub: `actually billed ${usdC(t.netBilledUsdCents)} net` },
    { label: "Margin, price 1", value: <Signed c={t.margin1UsdCents} inverse />, sub: pct(t.margin1Pct) ? `${pct(t.margin1Pct)} of price 1` : undefined },
    { label: "Margin, price 2", value: <Signed c={t.margin2UsdCents} inverse />, sub: pct(t.margin2Pct) ? `${pct(t.margin2Pct)} of price 2` : undefined },
  ];

  return (
    <div className="space-y-8">
      <div className="k-fg2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.stale ? "var(--data-amber)" : "var(--data-teal)" }} />
          {who} · consumption as of {dayLabel(c.consumptionAsOf)}
        </span>
        {fetching && <span className="k-fg3">Reading…</span>}
        {c.notes.map((x) => (
          <span key={x} className="k-fg3">
            {x}
          </span>
        ))}
      </div>

      <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-3 xl:grid-cols-6 xl:divide-x">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 p-4">
            <p className="k-label">{k.label}</p>
            <div className="mt-1.5">
              <Figure value={k.value} />
            </div>
            {k.sub && <p className="k-fg3 mt-0.5 truncate text-[12px]">{k.sub}</p>}
          </div>
        ))}
        <Warnings c={c} />
      </div>

      <section>
        <SectionTitle right={<span>Per {interval}, in US dollars</span>}>What it would have cost, under each price</SectionTitle>
        <DailyLines points={points} lines={amountLines} caption={caption} format={fmtUsd} windows={ONE} empty="Nothing consumed in this perimeter." label="Amount per period under each price" />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle right={<span>Since inception</span>}>Running total</SectionTitle>
          <DailyLines
            points={points}
            lines={cumulativeLines}
            caption={(b) => `${usdC(b.cumulative.amount1UsdCents)} vs ${usdC(b.cumulative.amount2UsdCents)} so far`}
            format={fmtUsd}
            windows={ONE}
            empty="Nothing consumed in this perimeter."
            label="Running total under each price"
          />
        </section>
        <section>
          <SectionTitle right={<span>Price minus real cost</span>}>Our margin</SectionTitle>
          <DailyLines
            points={points}
            lines={marginLines}
            caption={(b) => `${pct(b.margin1Pct) ?? "—"} vs ${pct(b.margin2Pct) ?? "—"}`}
            format={fmtUsd}
            windows={ONE}
            empty="Nothing consumed in this perimeter."
            label="Margin per period under each price"
          />
        </section>
      </div>
      <section>
        <SectionTitle>Side by side</SectionTitle>
        <PeriodBars
          periods={c.buckets}
          grouped
          series={[
            { key: "a1", label: "Price 1", color: "var(--data-violet)", get: (b) => b.amount1UsdCents / 100 },
            { key: "a2", label: "Price 2", color: "var(--accent)", get: (b) => b.amount2UsdCents / 100 },
            { key: "r", label: "Real cost", color: "var(--data-rose)", get: (b) => b.realCostUsdCents / 100 },
          ]}
          caption={(b) => <Signed c={b.differenceUsdCents} p={b.differencePct} />}
          format={fmtUsd}
          label={periodLabel(interval)}
          empty="Nothing consumed in this perimeter."
        />
      </section>

      <section>
        <SectionTitle count={c.buckets.length}>Per {interval}</SectionTitle>
        <FiguresTable rows={c.buckets.map((b) => ({ key: b.period, label: periodLabel(interval)(b.period), f: b }))} />
      </section>

      <section>
        <SectionTitle count={items.length} right={<span>Largest change first</span>}>
          Per cost item
        </SectionTitle>
        <div className="k-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Cost item</th>
                <th className={THR}>Quantity</th>
                <th className={THR}>Price 1 / unit</th>
                <th className={THR}>Price 2 / unit</th>
                <th className={THR}>Price 1</th>
                <th className={THR}>Price 2</th>
                <th className={THR}>Difference</th>
                <th className={THR}>Real cost</th>
                <th className={THR}>Margin 2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {(allItems ? items : items.slice(0, VISIBLE)).map((i) => (
                <tr key={i.costName} className="k-row">
                  <td className={`${TD} k-mono text-[12px]`}>{i.costName}</td>
                  <td className={TDR}>{n(Math.round(i.quantity))}</td>
                  <td className={`${TDR} k-fg2`}>{cents(i.price1PerUnitUsdCents) ?? <span className="k-fg3">no price</span>}</td>
                  <td className={`${TDR} k-fg2`}>{cents(i.price2PerUnitUsdCents) ?? <span className="k-fg3">no price</span>}</td>
                  <td className={TDR}>{usdC(i.amount1UsdCents)}</td>
                  <td className={TDR}>{usdC(i.amount2UsdCents)}</td>
                  <td className={TDR}>
                    <Signed c={i.differenceUsdCents} p={i.differencePct} />
                  </td>
                  <td className={`${TDR} k-fg2`}>{usdC(i.realCostUsdCents)}</td>
                  <td className={TDR}>
                    <Signed c={i.margin2UsdCents} inverse />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > VISIBLE && (
            <div className="k-fg3 flex items-center justify-between border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
              <span>
                {allItems ? items.length : VISIBLE} of {items.length}
              </span>
              <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setAllItems(!allItems)}>
                {allItems ? "Show fewer" : `Show ${items.length - VISIBLE} more`}
              </button>
            </div>
          )}
        </div>
      </section>

      {c.byOrg && (
        <section>
          <SectionTitle count={c.byOrg.length} right={<span>Largest increase first · pick one to compare it alone</span>}>
            Per org
          </SectionTitle>
          <FiguresTable rows={c.byOrg.map((o) => ({ key: o.orgId ?? "none", label: names.orgName(o.orgId), f: o, onPick: o.orgId ? () => onPickOrg(o.orgId) : undefined }))} />
        </section>
      )}
      {c.byBrand && (
        <section>
          <SectionTitle count={c.byBrand.length} right={<span>A co-branded run counts under each brand</span>}>
            Per brand
          </SectionTitle>
          <FiguresTable
            rows={c.byBrand.map((b) => ({
              key: `${b.orgId}:${b.brandId}`,
              label: `${names.brandName(b.brandId)} · ${names.orgName(b.orgId)}`,
              f: b,
              onPick: b.orgId && b.brandId ? () => onPickBrand(b.orgId, b.brandId) : undefined,
            }))}
          />
        </section>
      )}
    </div>
  );
}

/** What could not be priced: said, never folded in as $0. Counts up front, the names on demand. */
function Warnings({ c }: { c: PriceComparison }) {
  const groups = [
    { label: "no price 1", names: c.unpricedCostNames1 },
    { label: "no price 2", names: c.unpricedCostNames2 },
    { label: "real cost unknown", names: c.realCostUnknownCostNames },
  ].filter((g) => g.names.length);
  if (!groups.length) return null;
  return (
    <details className="col-span-2 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] md:col-span-3 xl:col-span-6">
      <summary className="cursor-pointer" style={{ color: "var(--data-amber)" }}>
        {groups.map((g) => `${g.names.length} cost item${g.names.length > 1 ? "s" : ""} with ${g.label}`).join(" · ")}. Those units count at $0 on that side.
      </summary>
      <div className="k-fg2 mt-2 space-y-1">
        {groups.map((g) => (
          <p key={g.label}>
            <span className="k-label mr-2">{g.label}</span>
            <span className="k-mono">{g.names.join(", ")}</span>
          </p>
        ))}
      </div>
    </details>
  );
}

const VISIBLE = 25;

function FiguresTable({ rows }: { rows: { key: string; label: string; f: ComparisonFigures; onPick?: () => void }[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, VISIBLE);
  if (!rows.length) {
    return (
      <div className="k-card">
        <EmptyNote>Nothing to show.</EmptyNote>
      </div>
    );
  }
  return (
    <div className="k-card overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b border-[var(--line-subtle)]">
          <tr>
            <th className={TH}> </th>
            <th className={THR}>Price 1</th>
            <th className={THR}>Price 2</th>
            <th className={THR}>Difference</th>
            <th className={THR}>Real cost</th>
            <th className={THR}>Margin 1</th>
            <th className={THR}>Margin 2</th>
            <th className={THR}>Billed, net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line-subtle)]">
          {shown.map((r) => (
            <tr
              key={r.key}
              className={`k-row ${r.onPick ? "cursor-pointer" : ""}`}
              onClick={r.onPick}
              onKeyDown={(e) => {
                if (r.onPick && (e.key === "Enter" || e.key === " ")) r.onPick();
              }}
              tabIndex={r.onPick ? 0 : undefined}
            >
              <td className={`${TD} max-w-[320px] truncate`}>{r.label}</td>
              <td className={TDR}>{usdC(r.f.amount1UsdCents)}</td>
              <td className={TDR}>{usdC(r.f.amount2UsdCents)}</td>
              <td className={TDR}>
                <Signed c={r.f.differenceUsdCents} p={r.f.differencePct} />
              </td>
              <td className={`${TDR} k-fg2`}>{usdC(r.f.realCostUsdCents)}</td>
              <td className={TDR}>
                <Signed c={r.f.margin1UsdCents} inverse />
                <span className="k-fg3 block text-[11px]">{pct(r.f.margin1Pct) ?? "—"}</span>
              </td>
              <td className={TDR}>
                <Signed c={r.f.margin2UsdCents} inverse />
                <span className="k-fg3 block text-[11px]">{pct(r.f.margin2Pct) ?? "—"}</span>
              </td>
              <td className={`${TDR} k-fg2`}>{r.f.netBilledUsdCents ? usdC(r.f.netBilledUsdCents) : <Dash />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > VISIBLE && (
        <div className="k-fg3 flex items-center justify-between border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
          <span>
            {all ? rows.length : VISIBLE} of {rows.length}
          </span>
          <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setAll(!all)}>
            {all ? "Show fewer" : `Show ${rows.length - VISIBLE} more`}
          </button>
        </div>
      )}
    </div>
  );
}
