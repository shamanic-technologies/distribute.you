"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffCostMargin, getStaffCurrentPrices, getStaffEmailsSent, getStaffPriceVersions } from "@/lib/api";
import { formatCentsAsUsd } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile, TopBar } from "@/components/v2/ui";
import { Arrow } from "@/components/v2/research-bits";
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

const PAGE: Record<MonitoringPage, { section: string; title: string; question: string }> = {
  "cost/providers": { section: "Cost", title: "Providers", question: "Which vendors do we pay, and for what?" },
  "cost/spend": { section: "Cost", title: "Spend per provider", question: "How much has each provider charged us since inception?" },
  "price/billed": { section: "Price", title: "Billed to users", question: "How much did we bill our users since inception?" },
  "price/current": { section: "Price", title: "Current prices", question: "How much are we pricing each cost item right now?" },
  "price/history": { section: "Price", title: "Prices since inception", question: "How has each cost item been priced since inception?" },
  margin: { section: "Margin", title: "Margin", question: "How much margin have we made since inception?" },
  emails: { section: "Emails", title: "Emails", question: "How many emails have we sent since inception?" },
};

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
  return (
    <Frame crumbs={[{ label: "Monitoring", href: base }, ...(meta.section === meta.title ? [] : [{ label: meta.section }]), { label: meta.title }]}>
      <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{meta.question}</h1>
      <p className="k-fg3 mt-1 text-[13px]">Every org pooled, since the first cost row. Read live from production.</p>
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

function Hub({ base }: { base: string }) {
  const margin = useMargin();
  const versions = useVersions();
  const prices = useCurrentPrices();
  const emails = useEmails();
  const t = margin.data?.total;
  const href = (p: MonitoringPage) => `${base}/${p}`;
  const fig = (v: string | undefined, err: boolean) => (err ? <span className="k-fg3 text-[13px]">not readable</span> : v === undefined ? <Shimmer className="h-6 w-24" /> : v);
  return (
    <Frame crumbs={[{ label: "Monitoring" }]}>
      <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">Monitoring</h1>
      <p className="k-fg2 mt-1 text-[14px]">What the platform cost us, what we billed for it, and the margin between the two. Every org, since inception.</p>

      <Section title="Cost">
        <Card href={href("cost/providers")} question={PAGE["cost/providers"].question} label="Providers" note="in the price catalogue">
          {fig(versions.data ? String(new Set(versions.data.map((v) => v.provider)).size) : undefined, versions.isError)}
        </Card>
        <Card href={href("cost/spend")} question={PAGE["cost/spend"].question} label="Vendor cost" note="priced spend">
          {fig(t ? usd(t.vendorCostInUsdCents) : undefined, margin.isError)}
        </Card>
      </Section>

      <Section title="Price">
        <Card href={href("price/billed")} question={PAGE["price/billed"].question} label="Billed, net of discounts" note={t ? `${usd(t.billedCostInUsdCents)} gross` : undefined}>
          {fig(t ? usd(t.netBilledCostInUsdCents) : undefined, margin.isError)}
        </Card>
        <Card href={href("price/current")} question={PAGE["price/current"].question} label="Cost items priced" note="in force now">
          {fig(prices.data ? String(prices.data.length) : undefined, prices.isError)}
        </Card>
        <Card href={href("price/history")} question={PAGE["price/history"].question} label="Price versions" note="every cost item">
          {fig(versions.data ? String(versions.data.length) : undefined, versions.isError)}
        </Card>
      </Section>

      <Section title="Margin">
        <Card href={href("margin")} question={PAGE.margin.question} label="Margin, net of discounts" note={t ? `${usd(t.marginCostInUsdCents)} gross` : undefined}>
          {fig(t ? usd(t.netMarginCostInUsdCents) : undefined, margin.isError)}
        </Card>
      </Section>

      <Section title="Emails">
        <Card href={href("emails")} question={PAGE.emails.question} label="Emails sent" note={emails.data ? `to ${emails.data.people.toLocaleString("en-US")} people` : undefined}>
          {fig(emails.data ? emails.data.emails.toLocaleString("en-US") : undefined, emails.isError)}
        </Card>
      </Section>
    </Frame>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Card({ href, question, label, note, children }: { href: string; question: string; label: string; note?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="k-card flex min-w-0 flex-col p-4">
      <p className="text-[14px] font-medium leading-5">{question}</p>
      <div className="k-inset mt-4 rounded-[10px] p-3 shadow-[inset_0_0_0_1px_var(--line-subtle)]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="k-label truncate">{label}</span>
          {note && <span className="k-fg3 shrink-0 truncate text-[12px]">{note}</span>}
        </div>
        <p className="mt-1.5 text-[20px] font-medium leading-6 tabular-nums">{children}</p>
      </div>
      <span className="k-fg3 mt-auto flex items-center gap-2 pt-3 text-[13px]">
        <span className="min-w-0 flex-1">Open</span>
        <Arrow />
      </span>
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
  return (
    <Loaded q={versions}>
      {(vs) => {
        const items = costItemNames(vs);
        const providers = [...new Set(items.map((i) => i.provider))].sort();
        const spendOf = (p: string) => margin.data?.providers.find((r) => r.provider === p) ?? null;
        return (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((p) => {
              const its = items.filter((i) => i.provider === p);
              const s = spendOf(p);
              return (
                <div key={p} className="k-card p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[14px] font-medium">{p}</p>
                    <span className="k-fg3 text-[12px]">
                      {its.length} cost item{its.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1 text-[13px]">
                    <div className="flex justify-between gap-3">
                      <dt className="k-fg3">Vendor cost since inception</dt>
                      <dd className="tabular-nums">{margin.isError ? "not readable" : s ? usd(s.vendorCostInUsdCents) : margin.data ? "$0" : "…"}</dd>
                    </div>
                  </dl>
                  <ul className="k-fg2 mt-3 flex flex-wrap gap-1.5">
                    {its.map((i) => (
                      <li key={i.name} className="k-chip k-mono text-[11px]">
                        {i.name}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        );
      }}
    </Loaded>
  );
}

function SpendPage() {
  const margin = useMargin();
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
            <Table
              head={
                <>
                  <th className={TH}>Provider</th>
                  <th className={THR}>Vendor cost</th>
                  <th className={THR}>Unpriced spend</th>
                </>
              }
            >
              {m.providers.map((p) => (
                <tr key={p.provider ?? "null"}>
                  <td className={TD}>{providerName(p.provider)}</td>
                  <td className={TDR}>{usd(p.vendorCostInUsdCents)}</td>
                  <td className={TDR}>{Number(p.unpricedBilledCostInUsdCents) ? usd(p.unpricedBilledCostInUsdCents) : <Cell v={null} />}</td>
                </tr>
              ))}
            </Table>
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
  const emails = useEmails();
  return (
    <Loaded q={emails}>
      {(sent) => (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Emails sent" note="follow-ups included">
            <Figure value={sent.emails.toLocaleString("en-US")} />
          </StatTile>
          <StatTile label="People emailed" note="at least one email">
            <Figure value={sent.people.toLocaleString("en-US")} />
          </StatTile>
        </div>
      )}
    </Loaded>
  );
}
