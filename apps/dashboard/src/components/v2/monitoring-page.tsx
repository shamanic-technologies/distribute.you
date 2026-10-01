"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffCostMargin, getStaffCurrentPrices, getStaffEmailSendPrice, getStaffEmailsSent, getStaffPriceVersions, getStaffRealCosts, getStaffSubscriptionCosts } from "@/lib/api";
import { formatCentsAsUsd } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile, TopBar } from "@/components/v2/ui";
import { ProvidersTable } from "@/components/v2/monitoring-providers";
import { EmailsCharts } from "@/components/v2/monitoring-emails";
import { EmailPriceView } from "@/components/v2/monitoring-email-price";
import { BillingTable } from "@/components/v2/monitoring-billing";
import { SubscriptionsView } from "@/components/v2/monitoring-subscriptions";
import { NewPricingView } from "@/components/v2/monitoring-new-pricing";
import { PricingComparisonView } from "@/components/v2/monitoring-pricing-comparison";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
import { TrendUpIcon } from "@phosphor-icons/react/dist/csr/TrendUp";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import {
  costItemNames,
  parseMonitoringPath,
  type CostItemMargin,
  type MarginFigures,
  type MonitoringPage,
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
function useEmailSendPrice() {
  return useAuthQuery(["staffEmailSendPrice"], getStaffEmailSendPrice, ONCE);
}
function useLatestRealCosts() {
  return useAuthQuery(["staffRealCosts", null], () => getStaffRealCosts(null), ONCE);
}
function useSubscriptionCosts() {
  return useAuthQuery(["staffSubscriptionCosts"], getStaffSubscriptionCosts, ONCE);
}

// ─── Formatting only ───────────────────────────────────────────────────────

const usd = (cents: string | number) => formatCentsAsUsd(cents, 0);
const usdExact = (cents: string | number) => formatCentsAsUsd(cents, 2);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const providerName = (p: string | null) => p ?? "Unknown provider";
/** A price per email in US cents, "3.06¢"; null stays null (no email yet). */
const centsPerEmail = (c: number | null) => (c == null ? null : `${c.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}¢`);

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
  "cost/subscriptions": { section: "cost", title: "Subscriptions", question: "What does one credit of each subscription really cost us?" },
  "cost/email-sending": { section: "cost", title: "Email sending", question: "What does sending one cold email really cost us?" },
  "price/billed": { section: "price", title: "Billed to users", question: "What did we bill for each cost item, and at what price?" },
  "price/new-pricing": { section: "price", title: "New pricing", question: "What would each cost item cost at its real cost ×2?" },
  margin: { section: "margin", title: "Margin", question: "How much margin have we made since inception?" },
  "margin/pricing-comparison": { section: "margin", title: "Pricing comparison", question: "What would a client have paid, and our margin, under two price lists?" },
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
  const router = useRouter();
  const movedTo = view.view === "moved" ? `${base}/${view.page}` : null;
  useEffect(() => {
    if (movedTo) router.replace(movedTo);
  }, [movedTo, router]);
  if (view.view === "moved") return null;
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
        {view.page === "cost/subscriptions" && <SubscriptionsPage />}
        {view.page === "cost/email-sending" && <EmailSendingPage />}
        {view.page === "price/billed" && <BilledPage />}
        {view.page === "price/new-pricing" && <NewPricingView />}
        {view.page === "margin/pricing-comparison" && <PricingComparisonView />}
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
  const sendPrice = useEmailSendPrice();
  const subs = useSubscriptionCosts();
  const real = useLatestRealCosts();
  const rc = real.data;
  const sp = sendPrice.data;
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

      <Section section="cost" count={4}>
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
        <Card
          href={href("cost/subscriptions")}
          page="cost/subscriptions"
          error={subs.isError}
          cells={[
            { label: "Subscriptions", value: subs.data?.subscriptions.length, note: "priced from the bank ledger" },
            {
              label: "Apollo, per credit",
              value: subs.data === undefined ? undefined : centsPerEmail(subs.data.subscriptions.find((x) => x.key === "apollo")?.costPerCreditUsdCents ?? null),
              note: subs.data ? `real cost, as of ${day(subs.data.asOf)}` : undefined,
            },
          ]}
        />
        <Card
          href={href("cost/email-sending")}
          page="cost/email-sending"
          error={sendPrice.isError}
          cells={[
            {
              label: "Per email",
              value: sp === undefined ? undefined : centsPerEmail(sp.currentPriceUsdCents),
              note: sp ? `real cost, as of ${day(sp.asOf)}` : undefined,
              bars: sp?.monthly.slice(-7).map((mo) => mo.priceUsdCents ?? 0),
            },
            { label: "Emails to leads", value: sp?.totals.emailsToLeads.toLocaleString("en-US"), note: sp ? `${usd(sp.totals.spendUsd * 100)} infra spend, net` : undefined },
          ]}
        />
      </Section>

      <Section section="price" count={2}>
        <Card
          href={href("price/billed")}
          page="price/billed"
          error={margin.isError}
          cells={[
            { label: "Billed, net", value: t && usd(t.netBilledCostInUsdCents), note: `${t ? usd(t.billedCostInUsdCents) : "…"} gross`, bars: byProvider("netBilledCostInUsdCents") },
            { label: "Priced now", value: prices.data?.length, note: prices.data ? `of ${items ?? "…"} cost items` : undefined },
          ]}
        />
        <Card
          href={href("price/new-pricing")}
          page="price/new-pricing"
          error={real.isError}
          cells={[
            { label: "Priced at real ×2", value: rc?.items.filter((x) => x.proposedBasis === "real-cost-x2").length, note: rc ? `of ${rc.items.length} cost items` : undefined },
            { label: "Flagged", value: rc?.items.filter((x) => x.flag != null).length, note: rc ? `as of ${day(rc.asOf)}, not billed yet` : undefined },
          ]}
        />
      </Section>

      <Section section="margin" count={2}>
        <Card
          href={href("margin")}
          page="margin"
          error={margin.isError}
          cells={[
            { label: "Margin, net", value: t && usd(t.netMarginCostInUsdCents), note: `${t ? usd(t.marginCostInUsdCents) : "…"} gross`, bars: byProvider("netMarginCostInUsdCents") },
            { label: "Largest provider", value: top === undefined ? undefined : top ? providerName(top.provider) : null, note: top ? `${usd(top.netMarginCostInUsdCents)} margin` : undefined },
          ]}
        />
        <Card
          href={href("margin/pricing-comparison")}
          page="margin/pricing-comparison"
          error={real.isError}
          cells={[
            { label: "Price lists", value: rc === undefined ? undefined : "2 sources", note: "catalogue or proposed, any day" },
            { label: "Since", value: rc && day(rc.rules.since), note: rc ? `to ${day(rc.asOf)}, per org and brand` : undefined },
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
  return (
    <Loaded q={versions}>
      {(vs) => (
        <>
          <SectionTitle>Every provider, since inception</SectionTitle>
          <ProvidersTable
            margin={margin.data}
            marginError={margin.isError}
            versions={vs}
            catalogue
            columns={["items", "vendor"]}
          />
        </>
      )}
    </Loaded>
  );
}

function SpendPage() {
  const margin = useMargin();
  const versions = useVersions();
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
          <div className="mt-6">
            <SectionTitle count={m.providers.length}>Per provider</SectionTitle>
            <ProvidersTable margin={m} versions={versions.data} catalogue={false} columns={["vendor"]} />
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
  const versions = useVersions();
  const prices = useCurrentPrices();
  return (
    <Loaded q={versions}>
      {(vs) => (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Billed, net" note="after per-org discounts">
              <Figure value={margin.data ? usd(margin.data.total.netBilledCostInUsdCents) : margin.isError ? null : undefined} />
            </StatTile>
            <StatTile label="Billed, gross" note="list price">
              <Figure value={margin.data ? usd(margin.data.total.billedCostInUsdCents) : margin.isError ? null : undefined} />
            </StatTile>
            <StatTile label="Refunded" note="spent, not charged">
              <Figure value={margin.data ? usd(margin.data.total.refundedCostInUsdCents) : margin.isError ? null : undefined} />
            </StatTile>
            <StatTile label="Priced now" note="cost items">
              <Figure value={prices.data ? prices.data.length : prices.isError ? null : undefined} />
            </StatTile>
          </div>
          {margin.data && <UnpricedNote f={margin.data.total} />}
          <div className="mt-6">
            <SectionTitle right={<span>Pick a row for its price history</span>}>Per cost item</SectionTitle>
            <BillingTable margin={margin.data} marginError={margin.isError} versions={vs} prices={prices.data} pricesError={prices.isError} />
          </div>
        </>
      )}
    </Loaded>
  );
}

// ─── Margin ────────────────────────────────────────────────────────────────

function SubscriptionsPage() {
  const subs = useSubscriptionCosts();
  return <Loaded q={subs}>{(d) => <SubscriptionsView data={d} />}</Loaded>;
}

function EmailSendingPage() {
  const price = useEmailSendPrice();
  return <Loaded q={price}>{(p) => <EmailPriceView p={p} />}</Loaded>;
}

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
            {kind !== "vendor" && <th className={THR}>Unpriced spend</th>}
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
            {kind !== "vendor" && <td className={TDR}>{Number(c.unpricedBilledCostInUsdCents) ? usd(c.unpricedBilledCostInUsdCents) : <Cell v={null} />}</td>}
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
