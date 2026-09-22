/**
 * The three things a staff operator opens the domains page to learn: what is
 * about to cost money, what is broken, and what is coming due.
 *
 * Everything here is a SELECTION or a BUCKETING of fields instantly-service
 * already serves on `/ops/domains`. Nothing computes a figure: a price is the
 * vendor's, a date is the registrar's, a DNS verdict is `dnsBadges`'. What this
 * module decides is which row leads, which rows carry a finding, and which
 * calendar bucket a payment falls in.
 *
 * Deliberately alias-free (no `@` import at all, not even type-only) so it
 * carries REAL unit tests — vitest does not resolve `@` in this repo. Keep it
 * that way; the shapes below are the structural subset of `OpsDomainRow` each
 * function reads, so a producer field added later needs no change here.
 */

// ---------------------------------------------------------------------------
// The structural shapes this module reads
// ---------------------------------------------------------------------------

export interface EstateDns {
  spf: { present: boolean; allQualifier: string | null };
  dmarc: { present: boolean; policy: string | null };
  dkimSelectors: string[];
  mx: string[];
  errors: Record<string, unknown>;
}

export interface EstateDomain {
  domain: string;
  provider: string | null;
  expiresAt: string | null;
  autorenew: boolean | null;
  cancelledAt: string | null;
  absentSince: string | null;
  mailboxes: number;
  addresses: { total: number; byLifecycle: Record<string, number> };
  delivery: { inboxPct: number | null };
  dns: EstateDns | null;
  cost: {
    currency: string | null;
    renewalCents: number | null;
    renewalAt: string | null;
  };
}

/**
 * A domain the vendor cancelled, or stopped reporting, is not part of the
 * estate any more: it bills nothing, renews nothing and cannot have a problem
 * worth acting on. Every reader below starts here so the three panels can never
 * disagree about which rows they are describing.
 */
export function liveDomains<T extends Pick<EstateDomain, "cancelledAt" | "absentSince">>(
  rows: readonly T[],
): T[] {
  return rows.filter((r) => !r.cancelledAt && !r.absentSince);
}

// ---------------------------------------------------------------------------
// Vendor consoles
// ---------------------------------------------------------------------------

export interface VendorConsole {
  /** How the vendor writes its own name. */
  label: string;
  /** The vendor's own domain, for the logo. */
  logoDomain: string;
  /**
   * Where a staff operator goes to act. VERIFIED to resolve on 2026-09-22.
   *
   * These are dashboard ROOTS, not per-domain deep links, and that is measured
   * rather than lazy: Gandi's console is a catch-all SPA (`/zzzznotaroute`
   * answers 301, `/domain/zzz-not-a-domain.tld` answers 302 to its login with
   * the path preserved), so a per-domain URL cannot be told apart from a route
   * that does not exist. A CTA that 404s after a login round-trip is worse than
   * one that lands on the list with the domain named beside it.
   */
  href: string;
}

/**
 * The vendors that bill us for a domain, as instantly-service names them on
 * `provider`. This is the BILLING vendor, a different concept from the
 * connection protocol (`google` / `microsoft` / `imap`) `ProviderLogo` draws.
 *
 * A vendor absent from this map gets NO logo and NO link rather than a guessed
 * one — an unrecognised provider is a producer vocabulary we have not read yet,
 * not a reason to send an operator somewhere.
 */
export const VENDOR_CONSOLES: Record<string, VendorConsole> = {
  gandi: {
    label: "Gandi",
    logoDomain: "gandi.net",
    href: "https://admin.gandi.net/domain",
  },
  primeforge: {
    label: "Primeforge",
    logoDomain: "primeforge.ai",
    href: "https://app.primeforge.ai",
  },
  mailforge: {
    label: "Mailforge",
    logoDomain: "mailforge.ai",
    href: "https://app.mailforge.ai",
  },
  "instantly-dfy": {
    label: "Instantly DFY",
    logoDomain: "instantly.ai",
    href: "https://app.instantly.ai/app/accounts",
  },
};

export function vendorConsole(provider: string | null | undefined): VendorConsole | null {
  if (!provider) return null;
  return VENDOR_CONSOLES[provider] ?? null;
}

// ---------------------------------------------------------------------------
// Events — what is about to cost money, or stop existing
// ---------------------------------------------------------------------------

export type RenewalEventKind = "ending" | "renewing";

export interface RenewalEvent {
  kind: RenewalEventKind;
  domain: string;
  provider: string | null;
  expiresAt: string;
  /** What the renewal costs, if the vendor priced it. Null stays null. */
  renewalCents: number | null;
  currency: string | null;
}

/**
 * The next domain to LAPSE and the next domain to RENEW ITSELF — two different
 * events needing two different actions, so they are never merged into one "next
 * renewal".
 *
 * `autorenew === null` is 29 of the 74 live domains (measured 2026-09-22), and
 * it is neither: a domain whose vendor never told us what happens at expiry
 * belongs in NEITHER bucket, because putting it in one asserts a direction we
 * were not told. It is surfaced as its own count instead.
 */
export function nextRenewalEvents(rows: readonly EstateDomain[]): {
  ending: RenewalEvent | null;
  renewing: RenewalEvent | null;
  /** Live domains whose vendor stated no auto-renew direction at all. */
  unknownAutorenew: number;
} {
  const live = liveDomains(rows);
  const dated = live.filter((r): r is EstateDomain & { expiresAt: string } => Boolean(r.expiresAt));

  const soonest = (kind: RenewalEventKind, want: boolean): RenewalEvent | null => {
    const match = dated
      .filter((r) => r.autorenew === want)
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
    if (!match) return null;
    return {
      kind,
      domain: match.domain,
      provider: match.provider,
      expiresAt: match.expiresAt,
      renewalCents: match.cost.renewalCents,
      currency: match.cost.currency,
    };
  };

  return {
    ending: soonest("ending", false),
    renewing: soonest("renewing", true),
    unknownAutorenew: live.filter((r) => r.autorenew === null).length,
  };
}

// ---------------------------------------------------------------------------
// Issues — what is broken
// ---------------------------------------------------------------------------

/** Five mailboxes per domain is the per-domain count cold email is run at. */
export const RECOMMENDED_MAILBOXES = 5;

/** Below this, a domain's placement is a reputation problem worth naming. */
export const DELIVERY_BAR_PCT = 90;

/** A domain is "mostly recovering" once more than half its addresses are. */
export const RECOVERY_SHARE = 0.5;

export type IssueKind =
  | "dns-missing"
  | "dns-weak"
  | "dns-unread"
  | "no-mailboxes"
  | "thin-mailboxes"
  | "mostly-recovering"
  | "reputation";

export interface DomainIssue {
  domain: string;
  provider: string | null;
  kind: IssueKind;
  /** What is wrong, in one line, naming the domain's own numbers. */
  detail: string;
  /** Lower sorts first. Fixed per kind so the list order never moves on a poll. */
  severity: number;
}

/**
 * How urgent each finding is. A record that is ABSENT outranks one that is
 * merely weak, and a domain that cannot send at all outranks one that sends
 * badly — an operator works down this list and the first line should be the one
 * that costs the most to leave alone.
 */
const ISSUE_SEVERITY: Record<IssueKind, number> = {
  "dns-missing": 1,
  reputation: 2,
  "no-mailboxes": 3,
  "dns-weak": 4,
  "thin-mailboxes": 5,
  // Last of the real findings: instantly-service is ALREADY acting on it. It
  // is worth seeing (nothing sends from that domain today) and it is never the
  // line to work first.
  "mostly-recovering": 6,
  "dns-unread": 7,
};

/**
 * Every finding on the live estate, most urgent first.
 *
 * ⚠️ A domain the DNS sweep never probed (`dns === null`) is NOT a domain with
 * a problem — it is one we know nothing about, and the sweep only covers the
 * domains we own or send from. It is never counted as missing or weak. A probe
 * that ERRORED is different again: a record we could not read is not an absent
 * one, so it gets its own `dns-unread` line rather than joining either side.
 */
export function domainIssues(rows: readonly EstateDomain[]): DomainIssue[] {
  const out: DomainIssue[] = [];
  const push = (domain: EstateDomain, kind: IssueKind, detail: string) => {
    out.push({ domain: domain.domain, provider: domain.provider, kind, detail, severity: ISSUE_SEVERITY[kind] });
  };

  for (const row of liveDomains(rows)) {
    if (row.dns) {
      const missing: string[] = [];
      const weak: string[] = [];
      if (!row.dns.spf.present) missing.push("SPF");
      else if (row.dns.spf.allQualifier !== "-all" && row.dns.spf.allQualifier !== "~all") weak.push("SPF");
      if (!row.dns.dmarc.present) missing.push("DMARC");
      else if (row.dns.dmarc.policy !== "reject" && row.dns.dmarc.policy !== "quarantine") weak.push("DMARC");
      if (row.dns.dkimSelectors.length === 0) missing.push("DKIM");
      if (row.dns.mx.length === 0) missing.push("MX");

      if (missing.length > 0) push(row, "dns-missing", `No ${missing.join(", ")} record published.`);
      if (weak.length > 0) {
        push(row, "dns-weak", `${weak.join(" and ")} published but too permissive to enforce anything.`);
      }
      const errors = Object.keys(row.dns.errors);
      if (errors.length > 0) {
        push(row, "dns-unread", `${errors.join(", ")} could not be read, so nothing is known about ${errors.length === 1 ? "it" : "them"}.`);
      }
    }

    const inRecovery = row.addresses.byLifecycle.in_recovery ?? 0;
    const inProduction = row.addresses.byLifecycle.in_production ?? 0;
    const total = row.addresses.total;

    // ⚠️ "Nothing is sending" has TWO causes and they need opposite actions, so
    // they are never one finding. A domain whose mailboxes are all being warmed
    // back up is instantly-service doing its job and will return on its own; a
    // domain that is idle with nothing recovering is stuck and needs a person.
    // Measured 2026-09-22: 38 of 74 live domains have nothing in production and
    // all but one of those are a recovery wave, so collapsing the two made one
    // temporary fleet event read as 38 separate emergencies.
    if (total > 0 && inProduction === 0) {
      if (inRecovery > 0) {
        push(row, "mostly-recovering", `None of its ${total} address${total === 1 ? "" : "es"} sends today; ${inRecovery} ${inRecovery === 1 ? "is" : "are"} being warmed back up.`);
      } else {
        push(row, "no-mailboxes", `${total} address${total === 1 ? "" : "es"}, none sending and none recovering.`);
      }
    } else if (total > 0 && inRecovery / total > RECOVERY_SHARE) {
      push(row, "mostly-recovering", `${inRecovery} of ${total} addresses are being warmed back up.`);
    }

    // Independent of the above: how many mailboxes a domain HOLDS is a
    // structural fact, true whatever they are doing today.
    if (row.mailboxes > 0 && row.mailboxes < RECOMMENDED_MAILBOXES) {
      push(row, "thin-mailboxes", `${row.mailboxes} mailbox${row.mailboxes === 1 ? "" : "es"}, under the ${RECOMMENDED_MAILBOXES} a domain is run at.`);
    }

    // ⚠️ Only a domain that is actually SENDING can carry a reputation finding.
    // Being under the delivery bar is WHAT PUTS a mailbox in recovery, so
    // flagging a fully-recovering domain restates the gate as an alert and
    // says nothing an operator can act on — instantly-service is already
    // warming it back up, and `mostly-recovering` / `no-mailboxes` already
    // name that. Measured 2026-09-22: all 35 sub-bar domains on the live
    // estate are 100% in recovery, so an unscoped rule made this ONE finding
    // 35 of 117 and buried everything else.
    if (inProduction > 0 && row.delivery.inboxPct !== null && row.delivery.inboxPct < DELIVERY_BAR_PCT) {
      push(row, "reputation", `${row.delivery.inboxPct.toFixed(0)}% inbox placement, under the ${DELIVERY_BAR_PCT}% bar, while ${inProduction} mailbox${inProduction === 1 ? " is" : "es are"} still sending.`);
    }
  }

  return out.sort((a, b) => a.severity - b.severity || a.domain.localeCompare(b.domain));
}

export interface IssueGroup {
  kind: IssueKind;
  severity: number;
  /** Every domain carrying this finding, in the order `domainIssues` sorted them. */
  domains: string[];
  /** The finding's own line, taken from its first domain so the wording is real. */
  sample: DomainIssue;
}

/**
 * Collapse the findings to ONE ROW PER KIND, most urgent first.
 *
 * ⚠️ This is not cosmetic. A rule that fires on most of the estate is not a
 * finding, it is a description of the fleet — and as a flat list it BURIES the
 * findings that are genuinely rare. Measured on the live estate 2026-09-22:
 * 117 findings over 74 domains, of which 61 are "fewer than five mailboxes"
 * (Primeforge sells three-mailbox domains, so that is the estate's normal
 * shape) and 36 are one recovery wave. Flat, the four missing-DMARC domains sat
 * above 113 rows nobody would scroll; grouped, every kind is one line an
 * operator can read at a glance and nothing is dropped.
 */
export function groupIssues(issues: readonly DomainIssue[]): IssueGroup[] {
  const byKind = new Map<IssueKind, DomainIssue[]>();
  for (const issue of issues) {
    const bucket = byKind.get(issue.kind);
    if (bucket) bucket.push(issue);
    else byKind.set(issue.kind, [issue]);
  }
  return [...byKind.entries()]
    .map(([kind, rows]) => ({
      kind,
      severity: rows[0].severity,
      domains: rows.map((r) => r.domain),
      sample: rows[0],
    }))
    .sort((a, b) => a.severity - b.severity);
}

// ---------------------------------------------------------------------------
// Costs — renewal spend falling due
// ---------------------------------------------------------------------------

export const COST_GRAINS = ["daily", "weekly", "monthly"] as const;
export type CostGrain = (typeof COST_GRAINS)[number];

/** Seven buckets back, the bucket holding today, seven forward. */
export const BUCKETS_BACK = 7;
export const BUCKETS_FORWARD = 7;

export interface RenewalBucket {
  /** `YYYY-MM-DD` for a day or a week start, `YYYY-MM` for a month. */
  key: string;
  label: string;
  /** Renewals already dated before now, summed per bucket. Never cumulated. */
  pastCents: number;
  /**
   * Renewals still ahead. Per-bucket on the daily grain; a RUNNING TOTAL from
   * the current bucket forward on weekly and monthly, which is what the label
   * says so no bar is read on the wrong basis.
   */
  futureCents: number;
  /** How many domains contributed to each half, for the tooltip. */
  pastCount: number;
  futureCount: number;
  /** True for the bucket holding `now`. */
  isCurrent: boolean;
}

export interface RenewalWindow {
  grain: CostGrain;
  currency: string;
  buckets: RenewalBucket[];
  /** Renewals in the window the vendor never priced. Stated, never summed as zero. */
  unpricedInWindow: number;
  /** Live domains carrying a renewal amount with no date at all, so no bucket can hold them. */
  undated: number;
  /** Every currency the live estate renews in, so the picker can say what it is not showing. */
  currencies: string[];
  /** True when no bucket in the window carries a single renewal. */
  empty: boolean;
}

function startOfUtcDay(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Monday 00:00 UTC of the week holding `t`. */
function startOfUtcWeek(t: number): number {
  const day = startOfUtcDay(t);
  const dow = new Date(day).getUTCDay(); // 0 = Sunday
  const backToMonday = (dow + 6) % 7;
  return day - backToMonday * 86_400_000;
}

function bucketKey(t: number, grain: CostGrain): string {
  const d = new Date(grain === "weekly" ? startOfUtcWeek(t) : t);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  if (grain === "monthly") return `${y}-${m}`;
  return `${y}-${m}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function bucketLabel(key: string, grain: CostGrain): string {
  if (grain === "monthly") {
    const [y, m] = key.split("-");
    return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  const d = new Date(`${key}T00:00:00.000Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Walk the bucket sequence forward from a start, `steps` times. */
function bucketKeysAround(now: number, grain: CostGrain): { keys: string[]; currentKey: string } {
  const keys: string[] = [];
  if (grain === "monthly") {
    const d = new Date(now);
    for (let i = -BUCKETS_BACK; i <= BUCKETS_FORWARD; i++) {
      keys.push(bucketKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1), grain));
    }
    return { keys, currentKey: bucketKey(now, grain) };
  }
  const step = grain === "weekly" ? 7 * 86_400_000 : 86_400_000;
  const anchor = grain === "weekly" ? startOfUtcWeek(now) : startOfUtcDay(now);
  for (let i = -BUCKETS_BACK; i <= BUCKETS_FORWARD; i++) keys.push(bucketKey(anchor + i * step, grain));
  return { keys, currentKey: bucketKey(anchor, grain) };
}

/**
 * Renewal payments falling due, bucketed around today, for ONE currency.
 *
 * Currency is a PARAMETER rather than a blend: Gandi invoices in euros and
 * everyone else in dollars, and merging them needs an FX rate nobody here owns
 * (the same reason `mergeDomainCost` reports null on a mixed domain). The
 * window states every currency the estate renews in so the picker can offer
 * them one at a time.
 *
 * A renewal with an amount and NO DATE falls in no bucket at all: it is counted
 * in `undated` and never dropped silently. One with a date and no amount is
 * counted in `unpricedInWindow`, so the bars are known to understate rather
 * than presented as the total.
 */
export function renewalWindow(
  rows: readonly EstateDomain[],
  grain: CostGrain,
  currency: string,
  now: number,
): RenewalWindow {
  const live = liveDomains(rows);
  const currencies = [
    ...new Set(
      live
        .filter((r) => r.cost.renewalCents !== null || r.cost.renewalAt !== null)
        .map((r) => r.cost.currency)
        .filter((c): c is string => c !== null),
    ),
  ].sort();

  const mine = live.filter((r) => r.cost.currency === currency);
  const { keys, currentKey } = bucketKeysAround(now, grain);
  const index = new Map(keys.map((k, i) => [k, i]));

  const buckets: RenewalBucket[] = keys.map((key) => ({
    key,
    label: bucketLabel(key, grain),
    pastCents: 0,
    futureCents: 0,
    pastCount: 0,
    futureCount: 0,
    isCurrent: key === currentKey,
  }));

  let unpricedInWindow = 0;
  let undated = 0;

  for (const row of mine) {
    const at = row.cost.renewalAt;
    if (!at) {
      if (row.cost.renewalCents !== null) undated += 1;
      continue;
    }
    const t = Date.parse(at);
    if (Number.isNaN(t)) continue;
    const i = index.get(bucketKey(t, grain));
    if (i === undefined) continue;
    if (row.cost.renewalCents === null) {
      unpricedInWindow += 1;
      continue;
    }
    // Split on the INSTANT, not the bucket: the bucket holding today legitimately
    // carries both a renewal already taken and one still to come.
    if (t < now) {
      buckets[i].pastCents += row.cost.renewalCents;
      buckets[i].pastCount += 1;
    } else {
      buckets[i].futureCents += row.cost.renewalCents;
      buckets[i].futureCount += 1;
    }
  }

  const empty = buckets.every((b) => b.pastCount === 0 && b.futureCount === 0);

  // Weekly and monthly read as a RUNNING COMMITMENT from today forward — how
  // much is owed by the end of each bucket, not in it. Daily stays per-bucket:
  // a cumulative line over a fortnight of days says nothing a total does not.
  if (grain !== "daily") {
    let running = 0;
    for (const b of buckets) {
      const t = Date.parse(`${grain === "monthly" ? `${b.key}-01` : b.key}T00:00:00.000Z`);
      if (b.isCurrent || t > now) {
        running += b.futureCents;
        b.futureCents = running;
      }
    }
  }

  return { grain, currency, buckets, unpricedInWindow, undated, currencies, empty };
}
