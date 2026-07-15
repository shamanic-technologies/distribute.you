"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ActiveUserRow, ActiveUsersByUser, AuditAccounts } from "@/lib/api";

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/** The org's domain when its Clerk name is domain-shaped (onboarding sets
 *  `name: <brand domain>`), else null → falls back to the initial. */
function orgDomainFromName(name?: string | null): string | null {
  if (!name) return null;
  const candidate = name.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  return /^[^\s]+\.[^\s]+$/.test(candidate) ? candidate : null;
}

type OrgMeta = { name: string; imageUrl: string; hasImage: boolean };

/** A small logo.dev / Clerk-upload / initial avatar (mirrors breadcrumb-nav's
 *  OrgAvatar). Used for both the org logo (Clerk upload → org-domain logo.dev →
 *  initial) and the brand logo (brand-domain logo.dev → initial). */
function Avatar({
  label,
  domain,
  imageUrl,
  hasImage,
}: {
  label: string;
  domain?: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const src =
    hasImage && imageUrl
      ? imageUrl
      : domain
        ? `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`
        : null;
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={label}
        onError={() => setBroken(true)}
        className="h-6 w-6 flex-shrink-0 rounded bg-brand-100 object-cover"
      />
    );
  }
  return (
    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-brand-100">
      <span className="text-[11px] font-semibold text-brand-600">{label?.[0]?.toUpperCase() || "?"}</span>
    </div>
  );
}

// ── Pure label + axis helpers ────────────────────────────────────────────────

function ymdParts(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

/** "2026-07" -> "Jul 2026". */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-07-15" -> "Jul 15". */
function dayLabel(day: string): string {
  const [y, m, d] = ymdParts(day);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** ISO week label "2026-W25" -> the UTC Monday of that week. */
function isoWeekToMonday(week: string): Date {
  const [yStr, wStr] = week.split("-W");
  const year = Number(yStr);
  const w = Number(wStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  return monday;
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** ISO week "2026-W25" -> "Jun 12" (its Monday). */
function weekLabel(week: string): string {
  return dayLabel(toYmd(isoWeekToMonday(week)));
}

/** Enumerate "YYYY-MM" from `from` to `to` inclusive. */
function enumerateMonths(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Enumerate ISO-week Mondays (as "YYYY-MM-DD") from `fromWeek` to `toWeek` inclusive. */
function enumerateWeekMondays(fromWeek: string, toWeek: string): string[] {
  const start = isoWeekToMonday(fromWeek);
  const end = isoWeekToMonday(toWeek);
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    out.push(toYmd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return out;
}

/** Enumerate "YYYY-MM-DD" from `from` to `to` inclusive. */
function enumerateDays(from: string, to: string): string[] {
  const [fy, fm, fd] = ymdParts(from);
  const [ty, tm, td] = ymdParts(to);
  const start = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    out.push(toYmd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function minStr(values: string[]): string | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => (a < b ? a : b));
}

// ── Org name resolution (Clerk names live only in Clerk) ─────────────────────

function useOrgNames(rows: ActiveUserRow[]) {
  const ids = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.orgExternalId) set.add(r.orgExternalId);
    return [...set].sort();
  }, [rows]);

  const { data } = useQuery<{ names: Record<string, string>; orgs: Record<string, OrgMeta> }>({
    queryKey: ["adminOrgNames", ids],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orgs/names?ids=${encodeURIComponent(ids.join(","))}`);
      if (!res.ok) throw new Error(`org name resolve failed (${res.status})`);
      const json = (await res.json()) as {
        names: Record<string, string>;
        orgs?: Record<string, OrgMeta>;
      };
      return { names: json.names, orgs: json.orgs ?? {} };
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });

  return { names: data?.names ?? {}, orgs: data?.orgs ?? {} };
}

function userLabel(row: ActiveUserRow, names: Record<string, string>): string {
  const clerk = row.orgExternalId ? names[row.orgExternalId] : undefined;
  return clerk || row.brands[0]?.brandDomain || row.ownerEmail || row.orgId.slice(0, 8);
}

// ── Drill-down grid ──────────────────────────────────────────────────────────

function BucketGrid({ cells }: { cells: Array<{ key: string; label: string; active: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {cells.map((cell) => (
        <span
          key={cell.key}
          title={cell.label}
          className={`inline-flex min-w-[3.25rem] items-center justify-center rounded px-1.5 py-1 text-[11px] font-medium tabular-nums ${
            cell.active
              ? "bg-emerald-100 text-emerald-700"
              : "bg-gray-50 text-gray-300"
          }`}
        >
          {cell.label}
        </span>
      ))}
    </div>
  );
}

function RightPanel({
  row,
  names,
  orgs,
  fleetMinMonth,
  fleetMinWeek,
  fleetMinDay,
  currentMonth,
  currentWeek,
  currentDay,
  onClose,
}: {
  row: ActiveUserRow;
  names: Record<string, string>;
  orgs: Record<string, OrgMeta>;
  fleetMinMonth: string;
  fleetMinWeek: string;
  fleetMinDay: string;
  currentMonth: string;
  currentWeek: string;
  currentDay: string;
  onClose: () => void;
}) {
  const [showDaily, setShowDaily] = useState(false);

  const monthCells = useMemo(() => {
    const active = new Set(row.activeMonths);
    return enumerateMonths(fleetMinMonth, currentMonth).map((ym) => ({
      key: ym,
      label: monthLabel(ym),
      active: active.has(ym),
    }));
  }, [row.activeMonths, fleetMinMonth, currentMonth]);

  const weekCells = useMemo(() => {
    const activeMondays = new Set(row.activeWeeks.map((w) => toYmd(isoWeekToMonday(w))));
    return enumerateWeekMondays(fleetMinWeek, currentWeek).map((monday) => ({
      key: monday,
      label: dayLabel(monday),
      active: activeMondays.has(monday),
    }));
  }, [row.activeWeeks, fleetMinWeek, currentWeek]);

  const dayCells = useMemo(() => {
    const active = new Set(row.activeDays);
    return enumerateDays(fleetMinDay, currentDay).map((d) => ({
      key: d,
      label: dayLabel(d),
      active: active.has(d),
    }));
  }, [row.activeDays, fleetMinDay, currentDay]);

  return (
    <aside className="w-full shrink-0 rounded-lg border border-gray-200 bg-white p-5 lg:w-[26rem]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            label={userLabel(row, names)}
            domain={row.orgExternalId ? orgDomainFromName(orgs[row.orgExternalId]?.name) : null}
            imageUrl={row.orgExternalId ? orgs[row.orgExternalId]?.imageUrl : null}
            hasImage={row.orgExternalId ? orgs[row.orgExternalId]?.hasImage : false}
          />
          <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-950">{userLabel(row, names)}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {row.retentionWeeks} week{row.retentionWeeks === 1 ? "" : "s"} retention · {row.activeMonths.length} active months
          </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-950"
        >
          Close
        </button>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Monthly</h3>
        <div className="mt-2">
          <BucketGrid cells={monthCells} />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Weekly</h3>
        <div className="mt-2">
          <BucketGrid cells={weekCells} />
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowDaily((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Daily ({row.activeDays.length} active)
          </span>
          <span className="text-xs text-gray-400">{showDaily ? "Hide" : "Show"}</span>
        </button>
        {showDaily && (
          <div className="mt-2 max-h-64 overflow-y-auto">
            <BucketGrid cells={dayCells} />
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Table + tabs ─────────────────────────────────────────────────────────────

type TabId = "current" | "week" | "month" | "all";

/** Whole-dollar daily budget, e.g. `$40/day`. Null budget → "—". */
function budgetLabel(usd: number | null): string {
  if (usd === null || usd <= 0) return "—";
  return `$${Math.round(usd).toLocaleString("en-US")}/day`;
}

export function ActiveUsersTable({
  data,
  accounts,
}: {
  data: ActiveUsersByUser;
  accounts: AuditAccounts | null;
}) {
  const [tab, setTab] = useState<TabId>("current");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { names, orgs } = useOrgNames(data.users);

  // Join the live accounts snapshot (per org×brand status + configured daily
  // budget) onto each user (org) by orgId. A user is "current"ly active when it
  // owns ≥1 ACTIVE brand — the same verdict as the Active-users stat card. The
  // budget column sums the configured daily budget across the org's brands.
  const orgMeta = useMemo(() => {
    const map = new Map<string, { active: boolean; dailyBudgetUsd: number | null }>();
    for (const row of accounts?.rows ?? []) {
      const prev = map.get(row.orgId) ?? { active: false, dailyBudgetUsd: null };
      const active = prev.active || row.status === "active";
      const budget =
        row.dailyBudgetUsd === null
          ? prev.dailyBudgetUsd
          : (prev.dailyBudgetUsd ?? 0) + row.dailyBudgetUsd;
      map.set(row.orgId, { active, dailyBudgetUsd: budget });
    }
    return map;
  }, [accounts]);

  const fleetMinMonth = minStr(data.users.map((u) => u.firstActiveMonth)) ?? data.currentMonth;
  const fleetMinWeek = minStr(data.users.map((u) => u.firstActiveWeek)) ?? data.currentWeek;
  const fleetMinDay = minStr(data.users.map((u) => u.firstActiveDay)) ?? data.asOf.slice(0, 10);
  const currentDay = data.asOf.slice(0, 10);

  const currentCount = useMemo(
    () => data.users.filter((u) => orgMeta.get(u.orgId)?.active).length,
    [data.users, orgMeta],
  );

  const tabs: Array<{ id: TabId; label: string; count: number }> = [
    { id: "current", label: "Current", count: currentCount },
    { id: "week", label: "Current week", count: data.stats.activeThisWeekCount },
    { id: "month", label: "Current month", count: data.stats.activeThisMonthCount },
    { id: "all", label: "All", count: data.stats.totalUsers },
  ];

  const rows = useMemo(() => {
    if (tab === "current") return data.users.filter((u) => orgMeta.get(u.orgId)?.active);
    if (tab === "week") return data.users.filter((u) => u.activeThisWeek);
    if (tab === "month") return data.users.filter((u) => u.activeThisMonth);
    return data.users;
  }, [tab, data.users, orgMeta]);

  const selected = selectedOrgId ? data.users.find((u) => u.orgId === selectedOrgId) ?? null : null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">Users</h2>
      <p className="mt-1 text-sm text-gray-500">
        Every user that was ever active. Click a row for their month / week / day active history.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-gray-950 bg-gray-950 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-950"
            }`}
          >
            {t.label} ({t.count.toLocaleString("en-US")})
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 px-4 font-medium">Daily budget</th>
                <th className="py-2 px-4 font-medium">First month</th>
                <th className="py-2 px-4 font-medium">Last month</th>
                <th className="py-2 px-4 font-medium">First week</th>
                <th className="py-2 px-4 font-medium">Last week</th>
                <th className="py-2 pl-4 text-right font-medium">Retention (wk)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.orgId}
                  onClick={() => setSelectedOrgId(row.orgId)}
                  className={`cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                    row.orgId === selectedOrgId ? "bg-gray-50" : ""
                  }`}
                >
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <Avatar
                          label={userLabel(row, names)}
                          domain={row.orgExternalId ? orgDomainFromName(orgs[row.orgExternalId]?.name) : null}
                          imageUrl={row.orgExternalId ? orgs[row.orgExternalId]?.imageUrl : null}
                          hasImage={row.orgExternalId ? orgs[row.orgExternalId]?.hasImage : false}
                        />
                        {row.brands.slice(0, 2).map((b) => (
                          <Avatar key={b.brandId} label={b.brandName || b.brandDomain || "B"} domain={b.brandDomain} />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900">{userLabel(row, names)}</div>
                        {row.ownerEmail && <div className="truncate text-xs text-gray-400">{row.ownerEmail}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-medium tabular-nums text-gray-700">
                    {budgetLabel(orgMeta.get(row.orgId)?.dailyBudgetUsd ?? null)}
                  </td>
                  <td className="py-2.5 px-4 text-gray-700">{monthLabel(row.firstActiveMonth)}</td>
                  <td className="py-2.5 px-4 text-gray-700">{monthLabel(row.lastActiveMonth)}</td>
                  <td className="py-2.5 px-4 text-gray-700">{weekLabel(row.firstActiveWeek)}</td>
                  <td className="py-2.5 px-4 text-gray-700">{weekLabel(row.lastActiveWeek)}</td>
                  <td className="py-2.5 pl-4 text-right font-semibold tabular-nums text-gray-950">{row.retentionWeeks}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-gray-400">
                    No users in this tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && (
          <RightPanel
            row={selected}
            names={names}
            orgs={orgs}
            fleetMinMonth={fleetMinMonth}
            fleetMinWeek={fleetMinWeek}
            fleetMinDay={fleetMinDay}
            currentMonth={data.currentMonth}
            currentWeek={data.currentWeek}
            currentDay={currentDay}
            onClose={() => setSelectedOrgId(null)}
          />
        )}
      </div>
    </section>
  );
}
