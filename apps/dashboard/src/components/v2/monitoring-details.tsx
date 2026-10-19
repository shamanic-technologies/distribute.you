"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffInfraSpend, getStaffOpsInfra } from "@/lib/api";
import { EmptyNote, Figure, Shimmer, StatTile } from "@/components/v2/ui";
import { SectionChevron } from "@/components/v2/hub-section";
import {
  Dash,
  Failed,
  InboxCell,
  RED,
  StatusWord,
  n,
  pct,
  shortDay,
  useLifecycleRules,
  useOpsAddresses,
  useOpsDomains,
  useOpsMailboxes,
  vendorName,
} from "@/components/v2/monitoring-sending";
import { entityPath, type Delivery, type EntityKind, type OpsDomainRow, type ProviderPlacement, type Volume } from "@/lib/monitoring/sending";
import { poolWord } from "@/lib/monitoring/capacity";
import {
  PAID_TO_DATE_NOTE,
  PLACEMENT_VERDICT_WORD,
  VENDOR_CONSOLE,
  billedNative,
  dailyMaxFor,
  fullDay,
  fullTime,
  fxRateLine,
  isLiveDomain,
  lifecycleCounts,
  money,
  nextRenewalEvents,
  perMille,
  rampReaches,
  tokenWord,
  upcomingRenewals,
  vendorMailboxesWord,
  yesNo,
  type RenewalEvent,
} from "@/lib/monitoring/details";

/**
 * Monitoring > Emails, entity details (staff only): what the admin console's cold-email Domains,
 * Mailboxes and Accounts slide-overs showed, as collapsible blocks under an entity page's facts,
 * plus the estate read above the Domains and Mailboxes tables.
 *
 * Every figure is instantly-service's: the rows come from the SAME list reads the Monitoring tables
 * use (looked up by id), the estate totals from `/instantly/infra/spend` and `/instantly/ops/infra`,
 * the raw config from `/instantly/audit/account-detail` on demand. This file draws, looks up,
 * selects and formats; it never sums, averages, converts a currency or re-grades a verdict.
 */

const ONCE = { staleTime: 60_000, retry: false } as const;
const AMBER = "var(--data-amber)";

// ─── Building blocks ───────────────────────────────────────────────────────

/** One collapsible section: a header row that expands, its body inside the same card. */
function Block({ title, summary, defaultOpen = false, lazy = false, children }: { title: string; summary?: React.ReactNode; defaultOpen?: boolean; lazy?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const [opened, setOpened] = useState(defaultOpen);
  return (
    <section className="k-card overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setOpened(true);
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-[13px] font-medium">{title}</span>
        <span className="k-fg3 min-w-0 flex-1 truncate text-right text-[12px] tabular-nums">{summary}</span>
        <SectionChevron open={open} />
      </button>
      <div
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="k-line-subtle border-t">{lazy && !opened ? null : children}</div>
        </div>
      </div>
    </section>
  );
}

function Fields({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

/** A labelled value; a null value is a dash, never 0. */
function F({ label, children, wide = false }: { label: string; children: React.ReactNode | null | undefined; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <dt className="k-label">{label}</dt>
      <dd className="mt-0.5 text-[13px] tabular-nums">{children == null || children === "" ? <Dash /> : children}</dd>
    </div>
  );
}

const Mono = ({ children }: { children: string | null | undefined }) => (children ? <span className="k-mono k-fg2 text-[12px]">{children}</span> : <Dash />);
const Note = ({ children }: { children: React.ReactNode }) => <p className="k-fg3 px-4 pb-3 text-[12px]">{children}</p>;
const count = (v: number | null | undefined) => (v == null ? null : n(v));

function EntityLink({ base, kind, id }: { base: string; kind: EntityKind; id: string }) {
  return (
    <Link href={`${base}/${entityPath(kind, id)}`} className="k-mono break-all text-[12px] hover:underline">
      {id}
    </Link>
  );
}

/** A served USD twin, the vendor's own amount beside it. A priced amount with no twin = no USD rate on record. */
function UsdAmount({ usd, native, currency }: { usd: number | null | undefined; native: number | null | undefined; currency: string | null | undefined }) {
  if (usd == null && native == null) return <Dash />;
  const billed = billedNative(native, currency);
  return (
    <span>
      {usd == null ? <span style={{ color: AMBER }}>No USD rate on record</span> : money(usd, "USD")}
      {billed && <span className="k-fg3 ml-1.5 text-[12px]">{billed}</span>}
    </span>
  );
}

function PaidToDateValue({ paid, usdCents }: { paid: { cents: number; currency: string; source: string; months: number } | null | undefined; usdCents?: number | null }) {
  if (!paid) return <Dash />;
  return (
    <span>
      {usdCents === undefined ? money(paid.cents, paid.currency) : <UsdAmount usd={usdCents} native={paid.cents} currency={paid.currency} />}
      <span className="k-fg3 ml-1.5 text-[12px]">
        {tokenWord(paid.source)}
        {paid.months > 0 ? `, ${n(paid.months)} months` : ""}
      </span>
    </span>
  );
}

function DeliveryValue({ delivery, bar }: { delivery: Delivery; bar: number | null }) {
  if (delivery.inboxPct == null) return <span className="k-fg3">Never tested</span>;
  return (
    <span>
      <InboxCell value={delivery.inboxPct} bar={bar} />
      <span className="k-fg3 ml-1.5 text-[12px]">
        {n(delivery.inboxCount)} of {n(delivery.seedTotal)} seeds
      </span>
    </span>
  );
}

function VolumeFields({ volume }: { volume: Volume }) {
  return (
    <>
      <F label="Campaign emails">{n(volume.outreach)}</F>
      <F label="Warmup">{n(volume.warmup)}</F>
      <F label="Placement tests">{n(volume.seed)}</F>
      <F label="Replies in">{n(volume.repliesIn)}</F>
      <F label="Bounces in">{n(volume.bouncesIn)}</F>
      <F label="Bounce rate">{perMille(volume.bounceRatePerMille)}</F>
    </>
  );
}

/** The served ramp: a bar per day toward its last point, and that point in words. Bar height only. */
function Ramp({ projection }: { projection: Array<{ date: string; cap: number }> | undefined }) {
  const last = rampReaches(projection);
  if (!projection || !last) return <Dash />;
  const top = Math.max(1, ...projection.map((p) => p.cap));
  return (
    <span className="inline-flex items-end gap-2">
      <span className="flex items-end gap-[2px]" style={{ height: 18 }} aria-hidden="true">
        {projection.map((p) => (
          <span key={p.date} title={`${shortDay(p.date)}: ${n(p.cap)} a day`} className="w-[4px] rounded-[1px]" style={{ height: Math.max(2, (p.cap / top) * 18), background: "var(--accent)" }} />
        ))}
      </span>
      <span className="text-[12px]">
        {n(last.cap)} a day by {shortDay(last.date)}
      </span>
    </span>
  );
}

function Pending() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Shimmer key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

// ─── Domain ────────────────────────────────────────────────────────────────

function DnsBody({ row }: { row: OpsDomainRow }) {
  const dns = row.dns;
  if (dns === undefined) return <Note>DNS records are not in this read.</Note>;
  if (dns === null) return <Note>Never DNS-probed, so nothing is known about its records.</Note>;
  const published = (present: boolean) => (present ? "Published" : <span style={{ color: RED }}>Not published</span>);
  const errors = Object.entries(dns.errors);
  return (
    <>
      <Fields>
        <F label="SPF">
          {published(dns.spf.present)}
          {dns.spf.allQualifier && <span className="k-fg3 ml-1.5 text-[12px]">{dns.spf.allQualifier}</span>}
        </F>
        <F label="DMARC">
          {published(dns.dmarc.present)}
          {dns.dmarc.policy && <span className="k-fg3 ml-1.5 text-[12px]">policy {dns.dmarc.policy}</span>}
        </F>
        <F label="DKIM selectors">{dns.dkimSelectors.length ? dns.dkimSelectors.join(", ") : <span style={{ color: RED }}>None found</span>}</F>
        <F label="DMARC applies to">{dns.dmarc.pct == null ? null : `${dns.dmarc.pct}% of mail`}</F>
        <F label="DMARC subdomain policy">{dns.dmarc.subdomainPolicy}</F>
        <F label="MX">{dns.mx.length ? <Mono>{dns.mx.join(", ")}</Mono> : <span style={{ color: RED }}>None found</span>}</F>
        <F label="SPF includes" wide>
          {dns.spf.includes.length ? <Mono>{dns.spf.includes.join(", ")}</Mono> : null}
        </F>
        <F label="DMARC reports go to" wide>
          {dns.dmarc.rua.length ? <Mono>{dns.dmarc.rua.join(", ")}</Mono> : null}
        </F>
        <F label="SPF record" wide>
          <Mono>{dns.spf.raw}</Mono>
        </F>
        <F label="DMARC record" wide>
          <Mono>{dns.dmarc.raw}</Mono>
        </F>
      </Fields>
      {errors.length > 0 && (
        <div className="px-4 pb-3 text-[12px]" style={{ color: AMBER }}>
          {errors.map(([record, message]) => (
            <p key={record} className="break-all">
              Could not read {record}: {typeof message === "string" ? message : JSON.stringify(message)}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

/** One domain's registration, cost, DNS, addresses, delivery and 30-day volume, from the Domains list read. */
export function DomainDetails({ base, id }: { base: string; id: string }) {
  const q = useOpsDomains();
  const rules = useLifecycleRules();
  const mailboxes = useOpsMailboxes();
  const bar = rules.data?.bars.deliveryPctBar ?? null;
  if (q.isError) return <Failed what="this domain's details" />;
  if (!q.data) return <Pending />;
  const key = id.toLowerCase();
  const d = q.data.domains.find((x) => x.domain.toLowerCase() === key);
  if (!d) return null;
  const fx = q.data.fx;
  const cost = d.cost;
  const its = mailboxes.data?.mailboxes.filter((m) => m.domain.toLowerCase() === key) ?? [];
  return (
    <div className="space-y-3">
      <Block title="Registration" defaultOpen summary={d.expiresAt ? `Expires ${fullDay(d.expiresAt)}` : undefined}>
        <Fields>
          <F label="Vendor">{d.provider ? (VENDOR_CONSOLE[d.provider]?.label ?? vendorName(d.provider)) : null}</F>
          <F label="Role">{tokenWord(d.role)}</F>
          <F label="Status">{tokenWord(d.status)}</F>
          <F label="Purchased">
            <Mono>{fullDay(d.purchasedAt)}</Mono>
          </F>
          <F label="Expires">
            <Mono>{fullDay(d.expiresAt)}</Mono>
          </F>
          <F label="Auto-renew">{d.autorenew === null ? "Not stated by the vendor" : yesNo(d.autorenew)}</F>
          <F label="Deletion scheduled">{yesNo(d.deletionScheduled)}</F>
          <F label="Cancelled">
            <Mono>{fullTime(d.cancelledAt)}</Mono>
          </F>
          <F label="Gone from vendor since">
            <Mono>{fullTime(d.absentSince)}</Mono>
          </F>
        </Fields>
      </Block>
      <Block title="Cost" summary={cost?.usd.monthlyCents != null ? `${money(cost.usd.monthlyCents, "USD")} a month` : undefined}>
        {!cost ? (
          <Note>Cost is not in this read.</Note>
        ) : (
          <>
            <Fields>
              <F label="Monthly">
                <UsdAmount usd={cost.usd.monthlyCents} native={cost.monthlyCents} currency={cost.currency} />
              </F>
              <F label="Price from">{tokenWord(cost.source)}</F>
              <F label="Per email">{cost.perEmailCents == null ? null : cost.usd.perEmailCents == null ? <span style={{ color: AMBER }}>No USD rate on record</span> : `${cost.usd.perEmailCents.toFixed(2)}¢`}</F>
              <F label="Stops when cancelled, a month">
                <UsdAmount usd={cost.usd.recurringMonthlyCents} native={cost.recurringMonthlyCents} currency={cost.currency} />
              </F>
              <F label="Saved at renewal">
                <UsdAmount usd={cost.usd.renewalCents} native={cost.renewalCents} currency={cost.currency} />
              </F>
              <F label="Renews on">
                <Mono>{fullDay(cost.renewalAt)}</Mono>
              </F>
              <F label="Paid to date">
                <PaidToDateValue paid={cost.paidToDate} usdCents={cost.usd.paidToDateCents} />
              </F>
            </Fields>
            <Note>
              {fxRateLine(fx)} {PAID_TO_DATE_NOTE}
            </Note>
          </>
        )}
      </Block>
      <Block title="DNS" summary={d.dns === null ? "Never probed" : d.dns ? `SPF ${d.dns.spf.present ? "yes" : "no"} · DMARC ${d.dns.dmarc.policy ?? (d.dns.dmarc.present ? "yes" : "no")} · DKIM ${d.dns.dkimSelectors.length ? "yes" : "no"}` : undefined}>
        <DnsBody row={d} />
      </Block>
      <Block title="Addresses and mailboxes" summary={`${n(d.addresses.total)} addresses · ${n(d.mailboxes)} mailboxes`}>
        <Fields>
          <F label="Addresses">{n(d.addresses.total)}</F>
          {lifecycleCounts(d.addresses.byLifecycle).map(([status, c]) => (
            <F key={status} label="Addresses in state">
              <span className="inline-flex items-center gap-2">
                <StatusWord status={status} />
                <span className="tabular-nums">{n(c)}</span>
              </span>
            </F>
          ))}
          <F label="Mailboxes, ours">{n(d.mailboxes)}</F>
          <F label="Mailboxes, vendor says">{vendorMailboxesWord(d)}</F>
          {its.length > 0 && (
            <F label="Our mailboxes" wide>
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {its.map((m) => (
                  <EntityLink key={m.login} base={base} kind="mailbox" id={m.login} />
                ))}
              </span>
            </F>
          )}
        </Fields>
      </Block>
      <Block title="Delivery" summary={d.delivery.inboxPct == null ? "Never tested" : `${pct(d.delivery.inboxPct)} inbox`}>
        <Fields>
          <F label="Inbox placement">
            <DeliveryValue delivery={d.delivery} bar={bar} />
          </F>
          <F label="Tested">
            <Mono>{fullTime(d.delivery.testedAt)}</Mono>
          </F>
          <F label="Accounts measured">{n(d.delivery.measuredAccounts)}</F>
        </Fields>
      </Block>
      <Block title="Volume, last 30 days" summary={`${n(d.volume30d.outreach)} campaign emails`}>
        <Fields>
          <VolumeFields volume={d.volume30d} />
        </Fields>
      </Block>
    </div>
  );
}

// ─── Mailbox ───────────────────────────────────────────────────────────────

const VOLUME_ROWS: Array<{ key: keyof Volume; label: string }> = [
  { key: "outreach", label: "Campaign emails" },
  { key: "warmup", label: "Warmup" },
  { key: "seed", label: "Placement tests" },
  { key: "repliesIn", label: "Replies in" },
  { key: "bouncesIn", label: "Bounces in" },
  { key: "bounceRatePerMille", label: "Bounce rate" },
];

function VolumeTable({ columns }: { columns: Array<{ label: string; volume: Volume | undefined }> }) {
  const cell = (v: Volume | undefined, k: keyof Volume) => {
    if (!v) return <Dash />;
    if (k === "bounceRatePerMille") return perMille(v.bounceRatePerMille) ?? <Dash />;
    return n(v[k] as number);
  };
  return (
    <div className="k-scroll overflow-x-auto px-4 py-3">
      <table className="text-[13px]">
        <thead>
          <tr>
            <th className="k-label pr-6 text-left font-medium" />
            {columns.map((c) => (
              <th key={c.label} className="k-label px-3 text-right font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {VOLUME_ROWS.map((r) => (
            <tr key={r.key}>
              <td className="k-fg2 py-1 pr-6">{r.label}</td>
              {columns.map((c) => (
                <td key={c.label} className="px-3 py-1 text-right tabular-nums">
                  {cell(c.volume, r.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One mailbox: what it is, its dates, its addresses, sending, delivery, volume and cost, from the Mailboxes list read. */
export function MailboxDetails({ base, id }: { base: string; id: string }) {
  const q = useOpsMailboxes();
  const rules = useLifecycleRules();
  const bar = rules.data?.bars.deliveryPctBar ?? null;
  if (q.isError) return <Failed what="this mailbox's details" />;
  if (!q.data) return <Pending />;
  const key = id.toLowerCase();
  const m = q.data.mailboxes.find((x) => x.login.toLowerCase() === key);
  if (!m) return null;
  return (
    <div className="space-y-3">
      <Block title="What it is" defaultOpen summary={[m.poolType ? poolWord(m.poolType) : null, tokenWord(m.subscription)].filter(Boolean).join(" · ")}>
        <Fields>
          <F label="Vendor">{m.provider ? (VENDOR_CONSOLE[m.provider]?.label ?? vendorName(m.provider)) : null}</F>
          <F label="Pool">{m.poolType ? poolWord(m.poolType) : null}</F>
          <F label="Subscription">{tokenWord(m.subscription)}</F>
          <F label="Credentials from">{tokenWord(m.credentialSource)}</F>
          <F label="Domain">
            <EntityLink base={base} kind="domain" id={m.domain} />
          </F>
        </Fields>
      </Block>
      <Block title="Dates" summary={m.absentSince ? `Gone since ${fullDay(m.absentSince)}` : m.syncedAt ? `Synced ${fullTime(m.syncedAt)}` : undefined}>
        <Fields>
          <F label="Created at vendor">
            <Mono>{fullTime(m.vendorCreatedAt)}</Mono>
          </F>
          <F label="Pre-warmed since">
            <Mono>{fullTime(m.vendorPrewarmedAt)}</Mono>
          </F>
          <F label="Imported">
            <Mono>{fullTime(m.importedAt)}</Mono>
          </F>
          <F label="Gone from vendor since">
            <Mono>{fullTime(m.absentSince)}</Mono>
          </F>
          <F label="Last synced">
            <Mono>{fullTime(m.syncedAt)}</Mono>
          </F>
        </Fields>
      </Block>
      <Block title="Addresses" summary={`${n(m.addresses.length)} on this mailbox`}>
        {m.addresses.length === 0 ? (
          <EmptyNote>This mailbox carries no sending address.</EmptyNote>
        ) : (
          <ul className="divide-y divide-[var(--line-subtle)]">
            {m.addresses.map((a) => (
              <li key={a.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[12px]">
                <EntityLink base={base} kind="account" id={a.email} />
                <StatusWord status={a.lifecycleStatus} />
                {a.lifecycleReason && <span className="k-fg3">{tokenWord(a.lifecycleReason)}</span>}
                {a.sendTransport && <span className="k-chip">{a.sendTransport.toUpperCase()}</span>}
                <span className="k-fg3 tabular-nums">Daily limit {a.dailyLimit == null ? <Dash /> : n(a.dailyLimit)}</span>
                {a.absentSince && <span style={{ color: AMBER }}>Gone since {fullDay(a.absentSince)}</span>}
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Block title="Sending" summary={m.effectiveDailyCap == null ? undefined : `Cap today ${n(m.effectiveDailyCap)}`}>
        <Fields>
          <F label="Sustained a day">{n(m.sustainedDaily)}</F>
          <F label="Cap today">{count(m.effectiveDailyCap)}</F>
          <F label="Warmup budget today">{count(m.warmupBudgetToday)}</F>
          <F label="Ramp" wide>
            <Ramp projection={m.rampProjection} />
          </F>
        </Fields>
      </Block>
      <Block title="Delivery" summary={m.delivery.inboxPct == null ? "Never tested" : `${pct(m.delivery.inboxPct)} inbox`}>
        <Fields>
          <F label="Inbox placement">
            <DeliveryValue delivery={m.delivery} bar={bar} />
          </F>
          <F label="Tested">
            <Mono>{fullTime(m.delivery.testedAt)}</Mono>
          </F>
          <F label="Evidence expires">
            <Mono>{fullTime(m.evidenceExpiresAt)}</Mono>
          </F>
          <F label="Accounts measured">{n(m.delivery.measuredAccounts)}</F>
        </Fields>
      </Block>
      <Block title="Volume" summary={`${n(m.volume7d.outreach)} campaign emails in 7 days`}>
        <VolumeTable
          columns={[
            { label: "7 days", volume: m.volume7d },
            { label: "30 days", volume: m.volume30d },
          ]}
        />
      </Block>
      <Block title="Cost" summary={m.cost?.monthlyCents != null ? `${money(m.cost.monthlyCents, m.cost.currency)} a month` : undefined}>
        {!m.cost ? (
          <Note>No price on record for this mailbox. A mailbox billed with its domain is priced on the domain.</Note>
        ) : (
          <>
            <Fields>
              <F label="Monthly">{money(m.cost.monthlyCents, m.cost.currency)}</F>
              <F label="Price from">{tokenWord(m.cost.source)}</F>
              <F label="Paid to date">
                <PaidToDateValue paid={m.cost.paidToDate} />
              </F>
            </Fields>
            <Note>{PAID_TO_DATE_NOTE}</Note>
          </>
        )}
      </Block>
    </div>
  );
}

// ─── Account ───────────────────────────────────────────────────────────────

const PROVIDER_PLACEMENTS = [
  { key: "googlePlacement", name: "Google" },
  { key: "microsoftPlacement", name: "Microsoft 365" },
  { key: "microsoftConsumerPlacement", name: "Outlook.com" },
] as const;

function PlacementValue({ p }: { p: ProviderPlacement | null | undefined }) {
  if (!p || p.seedTotal === 0) return <span className="k-fg3">No test</span>;
  return (
    <span>
      <span style={{ color: p.mostlySpam ? RED : undefined }}>{p.verdict ? (PLACEMENT_VERDICT_WORD[p.verdict] ?? tokenWord(p.verdict)) : "No verdict"}</span>
      <span className="k-fg3 ml-1.5 text-[12px]">
        {n(p.inboxCount)} of {n(p.seedTotal)} in the inbox
        {p.mostlySpam ? ", mostly spam: sends nothing there" : ""}
      </span>
    </span>
  );
}

/** The served step buckets as bars (height only), each with its served count. */
function QueueBars({ parts }: { parts: Array<{ label: string; value: number | undefined }> }) {
  const top = Math.max(1, ...parts.map((p) => p.value ?? 0));
  return (
    <div className="grid grid-cols-4 gap-3 px-4 py-3">
      {parts.map((p) => (
        <div key={p.label} className="min-w-0">
          <p className="text-[13px] tabular-nums">{p.value == null ? <Dash /> : n(p.value)}</p>
          <div className="mt-1 flex h-12 items-end">
            <span className="block w-full rounded-t-[2px]" style={{ height: p.value ? Math.max(2, (p.value / top) * 48) : 2, background: p.value ? "var(--accent)" : "var(--data-track)" }} />
          </div>
          <p className="k-label mt-1.5 truncate">{p.label}</p>
        </div>
      ))}
    </div>
  );
}

/** One sending address: where it lives, lifecycle, health, limits, sends, what is due and its queue. */
export function AccountDetails({ base, id }: { base: string; id: string }) {
  const q = useOpsAddresses();
  const rules = useLifecycleRules();
  const bar = rules.data?.bars.deliveryPctBar ?? null;
  if (q.isError) return <Failed what="this account's details" />;
  if (!q.data) return <Pending />;
  const key = id.toLowerCase();
  const a = q.data.accounts.find((x) => x.email.toLowerCase() === key);
  if (!a) return null;
  const seed = a.nextSeedTest;
  const dailyMax = dailyMaxFor(a);
  const history = a.lifecycleHistory ?? [];
  return (
    <div className="space-y-3">
      <Block title="Where it lives" defaultOpen summary={[a.accountType ? vendorName(a.accountType) : null, a.sendTransport?.toUpperCase()].filter(Boolean).join(" · ")}>
        <Fields>
          <F label="Mailbox">{a.mailboxLogin ? <EntityLink base={base} kind="mailbox" id={a.mailboxLogin} /> : null}</F>
          <F label="Domain">{a.domain ? <EntityLink base={base} kind="domain" id={a.domain} /> : null}</F>
          <F label="Sends through">{a.sendTransport?.toUpperCase()}</F>
          <F label="Account type">{a.accountType ? vendorName(a.accountType) : null}</F>
        </Fields>
      </Block>
      <Block title="Lifecycle" summary={a.lifecycleUpdatedAt ? `Last change ${fullDay(a.lifecycleUpdatedAt)}` : undefined}>
        <Fields>
          <F label="State">
            <StatusWord status={a.lifecycleStatus} />
          </F>
          <F label="Why">{tokenWord(a.lifecycleReason)}</F>
          <F label="Instantly status">{tokenWord(a.status)}</F>
          <F label="Held from new sends because">{tokenWord(a.blockReason)}</F>
          <F label="Last change">
            <Mono>{fullTime(a.lifecycleUpdatedAt)}</Mono>
          </F>
        </Fields>
        <p className="k-label px-4 pt-1">History {history.length}</p>
        {history.length === 0 ? (
          <Note>No change on record.</Note>
        ) : (
          <ol className="divide-y divide-[var(--line-subtle)] pb-1">
            {history.map((h, i) => (
              <li key={`${h.at}:${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[12px]">
                <span className="k-mono k-fg2 w-[150px] shrink-0">{fullTime(h.at)}</span>
                <span className="inline-flex items-center gap-1.5">
                  {h.fromStatus && (
                    <>
                      <StatusWord status={h.fromStatus} />
                      <span className="k-fg3" aria-hidden="true">
                        →
                      </span>
                    </>
                  )}
                  <StatusWord status={h.toStatus} />
                </span>
                {h.reason && <span className="k-fg3">{tokenWord(h.reason)}</span>}
                {h.deliveryPct != null && <span className="k-fg3 tabular-nums">{pct(h.deliveryPct)} inbox</span>}
                {h.healthScore != null && <span className="k-fg3 tabular-nums">Health score {n(h.healthScore)}</span>}
              </li>
            ))}
          </ol>
        )}
      </Block>
      <Block title="Health" summary={a.inboxPlacement ? `${pct(a.inboxPlacement.inboxPct)} inbox` : "Never tested"}>
        <Fields>
          <F label="Inbox placement">
            {a.inboxPlacement ? (
              <span>
                <InboxCell value={a.inboxPlacement.inboxPct} bar={bar} />
                <span className="k-fg3 ml-1.5 text-[12px]">
                  {pct(a.inboxPlacement.spamPct)} spam · {pct(a.inboxPlacement.missingPct)} missing
                </span>
              </span>
            ) : (
              <span className="k-fg3">Never tested</span>
            )}
          </F>
          <F label="Tested">
            <Mono>{fullTime(a.inboxPlacement?.testedAt)}</Mono>
          </F>
          <F label="Instantly health score">{count(a.warmupScore)}</F>
          {PROVIDER_PLACEMENTS.map((p) => (
            <F key={p.key} label={`At ${p.name}`}>
              <PlacementValue p={a[p.key]} />
            </F>
          ))}
          <F label="Evidence expires">
            <Mono>{fullTime(a.evidenceExpiresAt)}</Mono>
          </F>
          <F label="Next placement test" wide>
            {seed ? (
              <span>
                {seed.due ? <span style={{ color: AMBER }}>Due now</span> : seed.expectedAt ? `Expected ${fullDay(seed.expectedAt)}` : "Not due"}
                <span className="k-fg3 ml-1.5 text-[12px]">
                  {[tokenWord(seed.reason), seed.ageDays == null ? null : `evidence ${seed.ageDays.toFixed(1)} days old`].filter(Boolean).join(" · ")}
                </span>
              </span>
            ) : null}
          </F>
        </Fields>
      </Block>
      <Block title="Send limits" summary={dailyMax == null ? undefined : `${n(dailyMax)} a day`}>
        <Fields>
          <F label="Daily max send">{count(dailyMax)}</F>
          {a.effectiveDailyCap != null && a.effectiveDailyCap !== a.dailyLimit && <F label="Configured limit, before the age ramp">{count(a.dailyLimit)}</F>}
          <F label="Daily warmup send">{count(a.warmupLimit)}</F>
          <F label="Fill order">{a.fillRank == null ? <span className="k-fg3">Not in the sending pool</span> : `#${n(a.fillRank)}`}</F>
          <F label="Ramp" wide>
            <Ramp projection={a.rampProjection} />
          </F>
        </Fields>
      </Block>
      <Block title="Sent" summary={`${n(a.sentToday)} today · ${n(a.sentYesterday)} yesterday`}>
        <Fields>
          <F label="Today">{n(a.sentToday)}</F>
          <F label="Yesterday">{n(a.sentYesterday)}</F>
        </Fields>
        <p className="k-label px-4">Last 7 days</p>
        <Fields>
          <VolumeFields volume={a.volume7d} />
        </Fields>
      </Block>
      <Block title="Due today" summary={a.queuedFirstOverdueSequences ? `${n(a.queuedFirstOverdueSequences)} first emails stuck` : undefined}>
        <Fields>
          <F label="New leads assigned today">{count(a.newSequencesToday)}</F>
          <F label="First emails due today">{count(a.queuedFirstDueTodaySequences)}</F>
          <F label="Follow-ups due today or late">{count(a.queuedNextToday)}</F>
          <F label="Of which late">{count(a.queuedOverdue)}</F>
          <F label="First emails stuck from an earlier day">
            {a.queuedFirstOverdueSequences == null ? null : <span style={{ color: a.queuedFirstOverdueSequences > 0 ? RED : undefined }}>{n(a.queuedFirstOverdueSequences)}</span>}
          </F>
          <F label="Leads with no email sent yet">{count(a.queuedFirstUnsentSequences)}</F>
        </Fields>
        <Note>Leads and steps are different counts: a new lead owes one email today and several steps overall.</Note>
      </Block>
      <Block title="Queue" summary={`${n(a.queueSize)} steps`}>
        <Fields>
          <F label="Queued steps">{n(a.queueSize)}</F>
          <F label="Queued leads">{count(a.queuedSequences)}</F>
        </Fields>
        <QueueBars
          parts={[
            { label: "Not started", value: a.queuedFirstUnsent },
            { label: "Today or late", value: a.queuedNextToday },
            { label: "Tomorrow", value: a.queuedNextTomorrow },
            { label: "Later", value: a.queuedNextLater },
          ]}
        />
      </Block>
    </div>
  );
}

// ─── Estate, above the Domains table ───────────────────────────────────────

function EventRow({ title, event, cta }: { title: string; event: RenewalEvent | null; cta: string }) {
  if (!event) {
    return (
      <div className="px-4 py-3">
        <p className="k-label">{title}</p>
        <p className="k-fg3 mt-1 text-[12px]">No live domain.</p>
      </div>
    );
  }
  const vendor = event.provider ? VENDOR_CONSOLE[event.provider] : undefined;
  return (
    <div className="px-4 py-3">
      <p className="k-label">{title}</p>
      <p className="mt-1 text-[13px] font-medium">{event.domain}</p>
      <p className="k-fg3 mt-0.5 text-[12px] tabular-nums">
        {fullDay(event.expiresAt)}
        {vendor ? ` · ${vendor.label}` : event.provider ? ` · ${vendorName(event.provider)}` : ""}
        {" · "}
        {event.nativeCents == null ? "no price on record" : event.usdCents == null ? "no USD rate on record" : money(event.usdCents, "USD")}
      </p>
      {vendor && (
        <a href={vendor.href} target="_blank" rel="noreferrer" className="k-btn mt-2 inline-flex">
          {cta} at {vendor.label}
        </a>
      )}
    </div>
  );
}

/** The domains estate: stat tiles, the next dates that move money, renewals ahead and spend per vendor. */
export function DomainsEstate({ base }: { base: string }) {
  const q = useOpsDomains();
  const spend = useAuthQuery(["staffInfraSpend"], getStaffInfraSpend, ONCE);
  const rows = q.data?.domains ?? [];
  const live = rows.filter(isLiveDomain);
  const events = q.data ? nextRenewalEvents(rows) : null;
  const ahead = q.data ? upcomingRenewals(rows, new Date(), 8) : [];
  const s = spend.data;
  const notReadable = <span className="k-fg3 text-[13px]">not readable</span>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Live domains">
          <Figure value={q.isError ? notReadable : !q.data ? <Shimmer className="h-6 w-12" /> : n(live.length)} sub={q.data ? `${n(rows.length - live.length)} cancelled or gone` : undefined} />
        </StatTile>
        <StatTile label="Monthly cost" note={s?.fx ? `1 EUR = $${s.fx.rate}` : undefined}>
          <Figure
            value={spend.isError ? notReadable : !s ? <Shimmer className="h-6 w-16" /> : s.monthlyTotalUsdCents == null ? <span style={{ color: AMBER }}>No USD rate</span> : money(s.monthlyTotalUsdCents, "USD")}
            sub={s && s.unpricedDomainCount > 0 ? `${n(s.unpricedDomainCount)} domains with no price` : undefined}
          />
        </StatTile>
        <StatTile label="Sent, 30 days">
          <Figure value={spend.isError ? notReadable : !s ? <Shimmer className="h-6 w-16" /> : n(s.sentLast30d)} sub={s ? "every domain" : undefined} />
        </StatTile>
        <StatTile label="Auto-renew not stated">
          <Figure value={q.isError ? notReadable : !events ? <Shimmer className="h-6 w-12" /> : n(events.unknownAutorenew)} sub={events ? "live domains" : undefined} />
        </StatTile>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="k-card divide-y divide-[var(--line-subtle)]">
          <p className="px-4 pt-3 text-[13px] font-medium">Next dates that move money</p>
          {q.isError ? (
            <Note>Could not read the domains.</Note>
          ) : !events ? (
            <div className="p-4">
              <Shimmer className="h-20 w-full" />
            </div>
          ) : (
            <>
              <EventRow title="Next to lapse, no auto-renew" event={events.ending} cta="Renew" />
              <EventRow title="Next to renew itself" event={events.renewing} cta="Cancel auto-renew" />
            </>
          )}
        </div>
        <div className="k-card">
          <p className="px-4 pt-3 text-[13px] font-medium">Renewals ahead</p>
          {q.isError ? (
            <Note>Could not read the domains.</Note>
          ) : !q.data ? (
            <div className="p-4">
              <Shimmer className="h-20 w-full" />
            </div>
          ) : ahead.length === 0 ? (
            <EmptyNote>No renewal date ahead.</EmptyNote>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--line-subtle)]">
              {ahead.map((d) => (
                <li key={`${d.provider}|${d.domain}`} className="flex items-baseline justify-between gap-3 px-4 py-2 text-[12px]">
                  <span className="min-w-0 truncate">
                    <EntityLink base={base} kind="domain" id={d.domain} />
                  </span>
                  <span className="k-mono k-fg2 shrink-0">{shortDay(d.cost!.renewalAt!)}</span>
                  <span className="shrink-0 tabular-nums">
                    <UsdAmount usd={d.cost!.usd.renewalCents} native={d.cost!.renewalCents} currency={d.cost!.currency} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="k-card">
          <p className="px-4 pt-3 text-[13px] font-medium">Monthly cost by vendor</p>
          {spend.isError ? (
            <Note>Could not read the spend.</Note>
          ) : !s ? (
            <div className="p-4">
              <Shimmer className="h-20 w-full" />
            </div>
          ) : (
            <>
              <ul className="mt-2 divide-y divide-[var(--line-subtle)]">
                {s.byProvider.map((p) => (
                  <li key={p.provider} className="flex items-baseline justify-between gap-3 px-4 py-2 text-[12px]">
                    <span>{VENDOR_CONSOLE[p.provider]?.label ?? vendorName(p.provider)}</span>
                    <span className="k-fg3 tabular-nums">
                      {n(p.domainCount)} domains · {n(p.mailboxCount)} mailboxes
                    </span>
                    <span className="tabular-nums">{money(p.monthlyCents, p.currency)}</span>
                  </li>
                ))}
                {s.planSubscriptions.map((p) => (
                  <li key={p.item} className="flex items-baseline justify-between gap-3 px-4 py-2 text-[12px]">
                    <span className="min-w-0 truncate">{p.note ?? tokenWord(p.item)}</span>
                    <span className="tabular-nums">{money(p.monthlyCents, p.currency)}</span>
                  </li>
                ))}
              </ul>
              <p className="k-fg3 px-4 pb-3 pt-1 text-[11px]">
                {fxRateLine(s.fx)} The total above leaves the Instantly plans out.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary, above the Mailboxes table ────────────────────────────────────

/** The mailbox estate: counts the producer serves for the fleet and per pool. */
export function MailboxesSummary() {
  const q = useOpsMailboxes();
  const infra = useAuthQuery(["staffOpsInfra"], getStaffOpsInfra, ONCE);
  const rows = q.data?.mailboxes ?? [];
  const gone = rows.filter((m) => m.absentSince).length;
  const f = infra.data?.fleet;
  const notReadable = <span className="k-fg3 text-[13px]">not readable</span>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Mailboxes">
          <Figure value={q.isError ? notReadable : !q.data ? <Shimmer className="h-6 w-12" /> : n(rows.length)} sub={q.data ? `${n(gone)} gone from their vendor` : undefined} />
        </StatTile>
        <StatTile label="Sending addresses">
          <Figure value={infra.isError ? notReadable : !f ? <Shimmer className="h-6 w-12" /> : n(f.totalAccountCount)} sub={f ? `${n(f.healthyAccountCount)} in production` : undefined} />
        </StatTile>
        <StatTile label="Can send today">
          <Figure value={infra.isError ? notReadable : !f ? <Shimmer className="h-6 w-12" /> : n(f.dailyCapacity)} unit={f ? "emails" : undefined} />
        </StatTile>
        <StatTile label="Queued steps">
          <Figure value={infra.isError ? notReadable : !f ? <Shimmer className="h-6 w-12" /> : n(f.queuedSteps)} />
        </StatTile>
      </div>
      {infra.data && (
        <div className="flex flex-wrap gap-2 text-[12px]">
          {infra.data.pools.map((p) => (
            <span key={p.pool} className="k-chip tabular-nums">
              {poolWord(p.pool)} · {n(p.mailboxes)} mailboxes · {n(p.addresses)} addresses
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

