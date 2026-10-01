"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffCostMargin, getStaffCurrentPrices, getStaffEmailsSent, getStaffPriceVersions } from "@/lib/api";
import { formatCentsAsUsd } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile, TopBar } from "@/components/v2/ui";
import { ProvidersTable } from "@/components/v2/monitoring-providers";
import { EmailsCharts } from "@/components/v2/monitoring-emails";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
import { TrendUpIcon } from "@phosphor-icons/react/dist/csr/TrendUp";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import {
  costItemNames,
  parseMonitoringPath,
  versionInForce,
  versionsOf,
  type CostItemMargin,
  type MarginFigures,
  type MonitoringPage,
  type PriceVersion,
  type ProviderMargin,
} from "@/lib/monitoring/monitoring";

/**
 * Monitoring (staff only): what the platform cost us, what we billed for it, the margin between
 * the two, and the emails we sent, every org pooled, since inception. Laid out like Research: a
 * hub of sections with one card per question, and one page per card.
 *
 * Every figure is served by its owner through the staff-only gateway (see lib/monitoring): the
 * margin is runs-service's, the current price is costs-service's. This file formats and lays
 * out; it never adds, subtracts or divides a money figure.
 */

const ONCE = { staleTime: 5 * 60_000, retry: false } as const;

function useMargin() {
  return useAuthQuery(["staffCostMargin"], getStaffCostMargin, ONCE);
}
function useVersions() {
  return useAuthQuery(["staffPriceVersions"], getStaffPriceVersions, ONCE);
}
function useCurrentPrices() {
  return useAuthQuery(["staffCurrentPrices"], getStaffCurrentPrices, ONCE);
}
function useEmails() {
  return useAuthQuery(["staffEmailsSent"], getStaffEmailsSent, ONCE);
}

// ─── Formatting only ───────────────────────────────────────────────────────

const usd = (cents: string | number) => formatCentsAsUsd(cents, 0);
const usdExact = (cents: string | number) => formatCentsAsUsd(cents, 2);
/** A unit price: often a fraction of a cent, so four significant digits. */
function unitUsd(cents: number | null): string | null {
  if (cents == null) return null;
  const v = cents / 100;
  if (v === 0) return "$0";
  return `$${v.toLocaleString("en-US", v >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 })}`;
}
const markup = (m: number | null) => (m == null ? null : `×${m.toLocaleString("en-US", { maximumFractionDigits: 3 })}`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const providerName = (p: string | null) => p ?? "Unknown provider";

// ─── Shell ─────────────────────────────────────────────────────────────────

type SectionKey = "cost" | "price" | "margin" | "emails";

/** Each section wears one colour and one mark, the way Research's topics do. */
const SECTION_LOOK: Record<SectionKey, { name: string; color: string; Icon: typeof ReceiptIcon; sub: string }> = {
  cost: { name: "Cost", color: "var(--data-rose)", Icon: ReceiptIcon, sub: "What our vendors charged us" },
  price: { name: "Price", color: "var(--data-sky)", Icon: TagIcon, sub: "What we charge our users" },
  margin: { name: "Margin", color: "var(--data-teal)", Icon: TrendUpIcon, sub: "Billed minus what the vendors charged" },
  emails: { name: "Emails", color: "var(--data-violet)", Icon: EnvelopeSimpleIcon, sub: "Every email we sent" },
};

const PAGE: Record<MonitoringPage, { section: SectionKey; title: string; question: string }> = {
  "cost/providers": { section: "cost", title: "Providers", question: "Which vendors do we pay, and for what?" },
  "cost/spend": { section: "cost", title: "Spend per provider", question: "How much has each provider charged us since inception?" },
  "price/billed": { section: "price", title: "Billed to users", question: "How much did we bill our users since inception?" },
  "price/current": { section: "price", title: "Current prices", question: "How much are we pricing each cost item right now?" },
  "price/history": { section: "price", title: "Prices since inception", question: "How has each cost item been priced since inception?" },
  margin: { section: "margin", title: "Margin", question: "How much margin have we made since inception?" },
  emails: { section: "emails", title: "Emails", question: "How many emails have we sent since inception?" },
};

/** A section's mark: a soft tile in its colour, drawn like Research's topic mark. */
function SectionMark({ section, size = 32 }: { section: SectionKey; size?: number }) {
  const { color, Icon } = SECTION_LOOK[section];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[8px]"
      style={{
        width: size,
        height: size,
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)`,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.56)} weight="duotone" />
    </span>
  );
}

export function V2Monitoring() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const pathname = usePathname();
  const base = v2Href(orgId, brandId, "monitoring");
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const view = parseMonitoringPath(rest);
  if (view.view === "hub") return <Hub base={base} />;
  if (view.view === "missing") {
    return (
      <Frame crumbs={[{ label: "Monitoring", href: base }, { label: "Not found" }]}>
        <div className="k-card">
          <EmptyNote>
            No Monitoring page here.{" "}
            <Link href={base} className="k-fg underline">
              Back to Monitoring
            </Link>
          </EmptyNote>
        </div>
      </Frame>
    );
  }
  const meta = PAGE[view.page];
  const look = SECTION_LOOK[meta.section];
  return (
    <Frame crumbs={[{ label: "Monitoring", href: base }, ...(look.name === meta.title ? [] : [{ label: look.name }]), { label: meta.title }]}>
      <div className="flex min-w-0 items-center gap-3">
        <SectionMark section={meta.section} size={40} />
        <div className="min-w-0">
          <p className="text-[12px]" style={{ color: look.color }}>
            {look.name}
          </p>
          <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{meta.question}</h1>
        </div>
      </div>
      <p className="k-fg3 mt-2 text-[13px]">Every org pooled, since the first cost row. Read live from production.</p>
      <div className="mt-6">
        {view.page === "cost/providers" && <ProvidersPage />}
        {view.page === "cost/spend" && <SpendPage />}
        {view.page === "price/billed" && <BilledPage />}
        {view.page === "price/current" && <CurrentPricesPage />}
        {view.page === "price/history" && <PriceHistoryPage />}
        {view.page === "margin" && <MarginPage />}
        {view.page === "emails" && <EmailsPage />}
      </div>
    </Frame>
  );
}

function Frame({ crumbs, children }: { crumbs: { label: string; href?: string }[]; children: React.ReactNode }) {
  return (
    <>
      <TopBar crumbs={crumbs} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">{children}</div>
    </>
  );
}

/** A read's three states, so no page shows a figure it does not have. */
function Loaded<T>({ q, children }: { q: { data: T | undefined; isError: boolean; error: Error | null }; children: (data: T) => React.ReactNode }) {
  if (q.isError) {
    return (
      <div className="k-card">
        <EmptyNote>Could not read this from production: {q.error?.message ?? "unknown error"}.</EmptyNote>
      </div>
    );
  }
  if (q.data === undefined) {
    return (
      <div className="k-card space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  return <>{children(q.data)}</>;
}

// ─── Hub ───────────────────────────────────────────────────────────────────

/** Bars drawn from served figures in the producer's order, in the section's colour. Draws; computes nothing shown. */
function MiniBars({ values, color }: { values: number[]; color: string }) {
  const pts = values.slice(0, 7);
  const max = Math.max(...pts, 0) || 1;
  if (!pts.length) return null;
  return (
    <div className="flex h-5 items-end gap-[3px]" aria-hidden="true">
      {pts.map((v, i) => (
        <span key={i} className="w-[6px] rounded-[2px]" style={{ height: `${Math.max(3, (v / max) * 20)}px`, background: color, opacity: i === 0 ? 1 : 0.4 }} />
      ))}
    </div>
  );
}

/** One cell of a card's inset block: label, figure (or its loading/error state), a note, a viz. */
interface Cell {
  label: string;
  value: React.ReactNode | undefined;
  note?: string;
  bars?: number[];
}

function Hub({ base }: { base: string }) {
  const margin = useMargin();
  const versions = useVersions();
  const prices = useCurrentPrices();
  const emails = useEmails();
  const m = margin.data;
  const t = m?.total;
  const href = (p: MonitoringPage) => `${base}/${p}`;
  // runs-service orders providers by billed, largest first: the bars and "Largest" follow its order.
  const byProvider = (k: keyof MarginFigures) => (m ? m.providers.map((p) => Number(p[k])) : undefined);
  const top = m ? (m.providers[0] ?? null) : undefined;
  const providers = versions.data ? new Set(versions.data.map((v) => v.provider)).size : undefined;
  const items = versions.data ? costItemNames(versions.data).length : undefined;
  return (
    <Frame crumbs={[{ label: "Monitoring" }]}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
            {t ? `${usd(t.netMarginCostInUsdCents)} margin on ${usd(t.netBilledCostInUsdCents)} billed` : "Monitoring"}
          </h1>
          <p className="k-fg2 mt-1 text-[14px]">What the platform cost us, what we billed for it, and the margin between the two. Every org, since inception.</p>
        </div>
        <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
          Read live from production
        </span>
      </div>

      <Section section="cost" count={2}>
        <Card
          href={href("cost/providers")}
          page="cost/providers"
          error={versions.isError}
          cells={[
            { label: "Providers", value: providers, note: "in the price catalogue" },
            { label: "Cost items", value: items, note: "priced by them" },
          ]}
        />
        <Card
          href={href("cost/spend")}
          page="cost/spend"
          error={margin.isError}
          cells={[
            { label: "Vendor cost", value: t && usd(t.vendorCostInUsdCents), note: "priced spend", bars: byProvider("vendorCostInUsdCents") },
            { label: "Largest provider", value: top === undefined ? undefined : top ? providerName(top.provider) : null, note: top ? `${usd(top.vendorCostInUsdCents)} vendor cost` : undefined },
          ]}
        />
      </Section>

      <Section section="price" count={3}>
        <Card
          href={href("price/billed")}
          page="price/billed"
          error={margin.isError}
          cells={[
            { label: "Billed, net", value: t && usd(t.netBilledCostInUsdCents), note: "after discounts", bars: byProvider("netBilledCostInUsdCents") },
            { label: "Billed, gross", value: t && usd(t.billedCostInUsdCents), note: "list price" },
          ]}
        />
        <Card
          href={href("price/current")}
          page="price/current"
          error={prices.isError}
          cells={[
            { label: "Cost items", value: prices.data?.length, note: "priced now" },
            { label: "Providers", value: prices.data ? new Set(prices.data.map((p) => p.provider)).size : undefined, note: "billing them" },
          ]}
        />
        <Card
          href={href("price/history")}
          page="price/history"
          error={versions.isError}
          cells={[
            { label: "Price versions", value: versions.data?.length, note: "since the first" },
            { label: "Cost items", value: items, note: "with a history" },
          ]}
        />
      </Section>

      <Section section="margin" count={1}>
        <Card
          href={href("margin")}
          page="margin"
          error={margin.isError}
          cells={[
            { label: "Margin, net", value: t && usd(t.netMarginCostInUsdCents), note: `${t ? usd(t.marginCostInUsdCents) : "…"} gross`, bars: byProvider("netMarginCostInUsdCents") },
            { label: "Largest provider", value: top === undefined ? undefined : top ? providerName(top.provider) : null, note: top ? `${usd(top.netMarginCostInUsdCents)} margin` : undefined },
          ]}
        />
      </Section>

      <Section section="emails" count={1}>
        <Card
          href={href("emails")}
          page="emails"
          error={emails.isError}
          cells={[
            { label: "Emails sent", value: emails.data?.emails.toLocaleString("en-US"), note: "follow-ups included" },
            { label: "People emailed", value: emails.data?.people.toLocaleString("en-US"), note: "at least one email" },
          ]}
        />
      </Section>
    </Frame>
  );
}

/** A section heading the way Research heads a crew: its mark, its name, a count, its line on the right. */
function Section({ section, count, children }: { section: SectionKey; count: number; children: React.ReactNode }) {
  const look = SECTION_LOOK[section];
  return (
    <section className="mt-8">
      <SectionTitle count={count} right={<span className="hidden sm:inline">{look.sub}</span>}>
        <span className="inline-flex items-center gap-2">
          <SectionMark section={section} size={18} />
          {look.name}
        </span>
      </SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

/** Research's study card: mark + section·title in its colour + the question, then an inset block of two cells. The whole card is the link. */
function Card({ href, page, cells, error }: { href: string; page: MonitoringPage; cells: [Cell, Cell]; error: boolean }) {
  const meta = PAGE[page];
  const look = SECTION_LOOK[meta.section];
  return (
    <Link href={href} className="k-card flex min-w-0 flex-col p-4">
      <div className="flex items-start gap-3">
        <SectionMark section={meta.section} />
        <div className="min-w-0 flex-1">
          <p className="k-fg3 truncate text-[12px]">
            <span style={{ color: look.color }}>{look.name}</span>
            {meta.title !== look.name && ` · ${meta.title}`}
          </p>
          <p className="mt-0.5 text-[14px] font-medium leading-5">{meta.question}</p>
        </div>
      </div>
      <div className="k-inset mt-4 grid grid-cols-2 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
        {cells.map((c, i) => (
          <div key={c.label} className={`min-w-0 p-3 ${i === 0 ? "border-r border-[var(--line-subtle)]" : ""}`}>
            <p className="k-label">{c.label}</p>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <p className="min-w-0 truncate text-[20px] font-medium leading-6 tabular-nums">
                {error ? (
                  <span className="k-fg3 text-[13px]">not readable</span>
                ) : c.value === undefined ? (
                  <Shimmer className="h-6 w-20" />
                ) : c.value === null ? (
                  <span className="k-fg4">{"—"}</span>
                ) : (
                  c.value
                )}
              </p>
              {c.bars && !error && <MiniBars values={c.bars} color={look.color} />}
            </div>
            {c.note && <p className="k-fg3 mt-0.5 truncate text-[11px]">{c.note}</p>}
          </div>
        ))}
      </div>
    </Link>
  );
}

// ─── Tables ────────────────────────────────────────────────────────────────

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const THR = `${TH} text-right`;
const TD = "px-3 py-2.5 first:pl-4 last:pr-4";
const TDR = `${TD} text-right tabular-nums`;

function Table({ head, children, fixed = false }: { head: React.ReactNode; children: React.ReactNode; fixed?: boolean }) {
  return (
    <div className="k-card overflow-x-auto">
      <table className={`w-full text-[13px] ${fixed ? "md:table-fixed" : ""}`}>
        <thead className="border-b border-[var(--line-subtle)]">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--line-subtle)]">{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ v }: { v: React.ReactNode | null }) {
  return <>{v ?? <span className="k-fg4">{"—"}</span>}</>;
}

/** Spend with no known vendor cost: stated apart, never folded into the margin at zero cost. */
function UnpricedNote({ f }: { f: MarginFigures }) {
  if (Number(f.unpricedBilledCostInUsdCents) === 0) return null;
  return (
    <p className="k-card k-fg2 mt-3 px-4 py-2.5 text-[12px]">
      {usdExact(f.unpricedBilledCostInUsdCents)} of billed spend has no vendor cost on record ({f.unpricedCostNames.join(", ")}), so it is left out of the vendor cost and
      the margin rather than counted at zero cost.
    </p>
  );
}

// ─── Cost ──────────────────────────────────────────────────────────────────

function ProvidersPage() {
  const versions = useVersions();
  const margin = useMargin();
  const prices = useCurrentPrices();
  return (
    <Loaded q={versions}>
      {(vs) => (
        <>
          <SectionTitle>Every provider, since inception</SectionTitle>
          <ProvidersTable
            margin={margin.data}
            marginError={margin.isError}
            versions={vs}
            prices={prices.data}
            catalogue
            columns={["items", "vendor", "billedNet", "billedGross", "marginNet", "marginGross", "refunded", "unpriced"]}
          />
        </>
      )}
    </Loaded>
  );
}

function SpendPage() {
  const margin = useMargin();
  const versions = useVersions();
  const prices = useCurrentPrices();
  return (
    <Loaded q={margin}>
      {(m) => (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Vendor cost" note="priced spend">
              <Figure value={usd(m.total.vendorCostInUsdCents)} />
            </StatTile>
            <StatTile label="Providers">
              <Figure value={m.providers.length} />
            </StatTile>
          </div>
          <UnpricedNote f={m.total} />
          <div className="mt-6">
            <SectionTitle count={m.providers.length}>Per provider</SectionTitle>
            <ProvidersTable margin={m} versions={versions.data} prices={prices.data} catalogue={false} columns={["vendor", "billedNet", "unpriced"]} />
          </div>
          <CostItemsTable rows={m.costItems} cols={["vendor"]} />
        </>
      )}
    </Loaded>
  );
}

// ─── Price ─────────────────────────────────────────────────────────────────

function BilledPage() {
  const margin = useMargin();
  return (
    <Loaded q={margin}>
      {(m) => (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Billed, net" note="after per-org discounts">
              <Figure value={usd(m.total.netBilledCostInUsdCents)} />
            </StatTile>
            <StatTile label="Billed, gross" note="list price">
              <Figure value={usd(m.total.billedCostInUsdCents)} />
            </StatTile>
            <StatTile label="Refunded" note="spent, not charged">
              <Figure value={usd(m.total.refundedCostInUsdCents)} />
            </StatTile>
          </div>
          <div className="mt-6">
            <SectionTitle count={m.providers.length}>Per provider</SectionTitle>
            <Table
              head={
                <>
                  <th className={TH}>Provider</th>
                  <th className={THR}>Billed, net</th>
                  <th className={THR}>Billed, gross</th>
                  <th className={THR}>Refunded</th>
                </>
              }
            >
              {m.providers.map((p) => (
                <tr key={p.provider ?? "null"}>
                  <td className={TD}>{providerName(p.provider)}</td>
                  <td className={TDR}>{usd(p.netBilledCostInUsdCents)}</td>
                  <td className={TDR}>{usd(p.billedCostInUsdCents)}</td>
                  <td className={TDR}>{usd(p.refundedCostInUsdCents)}</td>
                </tr>
              ))}
            </Table>
          </div>
          <CostItemsTable rows={m.costItems} cols={["billed"]} />
        </>
      )}
    </Loaded>
  );
}

function CurrentPricesPage() {
  const prices = useCurrentPrices();
  const versions = useVersions();
  return (
    <Loaded q={prices}>
      {(ps) => (
        <>
          {versions.isError && <p className="k-card k-fg2 mb-3 px-4 py-2.5 text-[12px]">The vendor cost catalogue could not be read, so the vendor column is empty.</p>}
          <SectionTitle count={ps.length}>Cost items in force now</SectionTitle>
          <Table
            head={
              <>
                <th className={TH}>Cost item</th>
                <th className={TH}>Provider</th>
                <th className={TH}>Unit</th>
                <th className={THR}>We charge / unit</th>
                <th className={THR}>Vendor charges / unit</th>
                <th className={THR}>Markup</th>
                <th className={THR}>Since</th>
              </>
            }
          >
            {[...ps]
              .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name))
              .map((p) => {
                const v = versions.data ? versionInForce(versions.data, p) : null;
                return (
                  <tr key={p.name}>
                    <td className={`${TD} k-mono text-[12px]`}>{p.name}</td>
                    <td className={TD}>{p.provider}</td>
                    <td className={`${TD} k-fg3`}>
                      <Cell v={p.unit ?? null} />
                    </td>
                    <td className={TDR}>{unitUsd(p.pricePerUnitInUsdCents)}</td>
                    <td className={TDR}>
                      <Cell v={unitUsd(v?.vendorCostPerUnitInUsdCents ?? null)} />
                    </td>
                    <td className={TDR}>
                      <Cell v={markup(v?.markupMultiplier ?? null)} />
                    </td>
                    <td className={`${TDR} k-fg3`}>
                      <Cell v={p.effectiveFrom ? day(p.effectiveFrom) : null} />
                    </td>
                  </tr>
                );
              })}
          </Table>
        </>
      )}
    </Loaded>
  );
}

function PriceHistoryPage() {
  const versions = useVersions();
  const margin = useMargin();
  return (
    <Loaded q={versions}>
      {(vs) => {
        const items = costItemNames(vs);
        const billedOf = (name: string) => margin.data?.costItems.filter((c) => c.costName === name) ?? [];
        return (
          <div className="space-y-6">
            {items.map((i) => (
              <section key={i.name}>
                <SectionTitle
                  count={i.versions}
                  right={
                    margin.data ? (
                      <span>
                        Billed since inception:{" "}
                        {billedOf(i.name).length ? billedOf(i.name).map((c) => `${usd(c.netBilledCostInUsdCents)} net${c.provider !== i.provider ? ` (${providerName(c.provider)})` : ""}`).join(" · ") : "$0"}
                      </span>
                    ) : null
                  }
                >
                  <span className="k-mono">{i.name}</span>
                  <span className="k-fg3 ml-2 font-normal">{i.provider}</span>
                </SectionTitle>
                <VersionsTable versions={versionsOf(vs, i.name)} />
              </section>
            ))}
          </div>
        );
      }}
    </Loaded>
  );
}

function VersionsTable({ versions }: { versions: PriceVersion[] }) {
  // Fixed layout: one table per cost item, stacked, so the columns line up down the page.
  return (
    <Table
      fixed
      head={
        <>
          <th className={TH}>In force from</th>
          <th className={TH}>Plan</th>
          <th className={THR}>We charge / unit</th>
          <th className={THR}>Vendor charges / unit</th>
          <th className={THR}>Markup</th>
        </>
      }
    >
      {versions.map((v) => (
        <tr key={v.id}>
          <td className={TD}>
            {day(v.effectiveFrom)}
            {v.reconstructed && <span className="k-fg3 ml-2 text-[12px]">reconstructed</span>}
          </td>
          <td className={`${TD} k-fg3`}>
            <Cell v={[v.planTier, v.billingCycle].filter(Boolean).join(" · ") || null} />
          </td>
          <td className={TDR}>
            <Cell v={unitUsd(v.billedPricePerUnitInUsdCents)} />
          </td>
          <td className={TDR}>
            <Cell v={v.vendorCostKnown ? unitUsd(v.vendorCostPerUnitInUsdCents) : "unknown"} />
          </td>
          <td className={TDR}>
            <Cell v={markup(v.markupMultiplier)} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

// ─── Margin ────────────────────────────────────────────────────────────────

function MarginPage() {
  const margin = useMargin();
  return (
    <Loaded q={margin}>
      {(m) => (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Margin, net" note="after per-org discounts">
              <Figure value={usd(m.total.netMarginCostInUsdCents)} />
            </StatTile>
            <StatTile label="Margin, gross" note="at list price">
              <Figure value={usd(m.total.marginCostInUsdCents)} />
            </StatTile>
            <StatTile label="Billed, net" note="priced spend">
              <Figure value={usd(m.total.netPricedBilledCostInUsdCents)} />
            </StatTile>
            <StatTile label="Vendor cost" note="priced spend">
              <Figure value={usd(m.total.vendorCostInUsdCents)} />
            </StatTile>
          </div>
          <UnpricedNote f={m.total} />
          <div className="mt-6">
            <SectionTitle count={m.providers.length}>Per provider</SectionTitle>
            <MarginTable rows={m.providers} />
          </div>
          <CostItemsTable rows={m.costItems} cols={["margin"]} />
        </>
      )}
    </Loaded>
  );
}

function MarginTable({ rows }: { rows: ProviderMargin[] }) {
  return (
    <Table
      head={
        <>
          <th className={TH}>Provider</th>
          <th className={THR}>Billed, net</th>
          <th className={THR}>Vendor cost</th>
          <th className={THR}>Margin, net</th>
          <th className={THR}>Margin, gross</th>
          <th className={THR}>Unpriced spend</th>
        </>
      }
    >
      {rows.map((p) => (
        <tr key={p.provider ?? "null"}>
          <td className={TD}>{providerName(p.provider)}</td>
          <td className={TDR}>{usd(p.netPricedBilledCostInUsdCents)}</td>
          <td className={TDR}>{usd(p.vendorCostInUsdCents)}</td>
          <td className={TDR}>{usd(p.netMarginCostInUsdCents)}</td>
          <td className={TDR}>{usd(p.marginCostInUsdCents)}</td>
          <td className={TDR}>{Number(p.unpricedBilledCostInUsdCents) ? usd(p.unpricedBilledCostInUsdCents) : <Cell v={null} />}</td>
        </tr>
      ))}
    </Table>
  );
}

/** The per-cost-item rows, with the columns of the page they sit on. */
function CostItemsTable({ rows, cols }: { rows: CostItemMargin[]; cols: ["vendor"] | ["billed"] | ["margin"] }) {
  const kind = cols[0];
  return (
    <div className="mt-6">
      <SectionTitle count={rows.length}>Per cost item</SectionTitle>
      <Table
        head={
          <>
            <th className={TH}>Cost item</th>
            <th className={TH}>Provider</th>
            {kind === "vendor" && <th className={THR}>Vendor cost</th>}
            {kind === "billed" && (
              <>
                <th className={THR}>Billed, net</th>
                <th className={THR}>Billed, gross</th>
              </>
            )}
            {kind === "margin" && (
              <>
                <th className={THR}>Billed, net</th>
                <th className={THR}>Vendor cost</th>
                <th className={THR}>Margin, net</th>
              </>
            )}
            <th className={THR}>Unpriced spend</th>
          </>
        }
      >
        {rows.map((c) => (
          <tr key={`${c.provider}|${c.costName}`}>
            <td className={`${TD} k-mono text-[12px]`}>{c.costName}</td>
            <td className={TD}>{providerName(c.provider)}</td>
            {kind === "vendor" && <td className={TDR}>{usd(c.vendorCostInUsdCents)}</td>}
            {kind === "billed" && (
              <>
                <td className={TDR}>{usd(c.netBilledCostInUsdCents)}</td>
                <td className={TDR}>{usd(c.billedCostInUsdCents)}</td>
              </>
            )}
            {kind === "margin" && (
              <>
                <td className={TDR}>{usd(c.netPricedBilledCostInUsdCents)}</td>
                <td className={TDR}>{usd(c.vendorCostInUsdCents)}</td>
                <td className={TDR}>{usd(c.netMarginCostInUsdCents)}</td>
              </>
            )}
            <td className={TDR}>{Number(c.unpricedBilledCostInUsdCents) ? usd(c.unpricedBilledCostInUsdCents) : <Cell v={null} />}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

// ─── Emails ────────────────────────────────────────────────────────────────

function EmailsPage() {
  return <EmailsCharts />;
}
