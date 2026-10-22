"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ConversionOrg } from "@/lib/revenue-view";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { friendlyDate } from "@/lib/friendly-datetime";
import { v2Href } from "@/lib/v2/routes";
import { useBrandRevenue, useCompanyLifecycle } from "@/components/v2/data";
import { companyRungs, dealsBoardRungs } from "@/lib/deals-board";
import { uniboxValueTag, uniboxValueTone, type LifecycleRung } from "@/lib/unibox-leads";
import { TONE_COLOR, TagChip } from "@/components/v2/tag-chip";
import { CompanyMark } from "@/components/v2/people-bits";
import { EmptyNote, Initials, Shimmer, TopBar } from "@/components/v2/ui";
import { ExportButton, RecordsFooter, RecordsTabs, RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";

/**
 * features-service's own path tags (`revenue-engine.ts`), in the customer's words. Opens
 * are a dead metric fleet-wide, so `opened` is never drawn; a tag this map does not know
 * reads verbatim rather than vanishing.
 */
export const TAG_LABEL: Record<string, string> = {
  contacted: "Contacted",
  sent: "Sent",
  delivered: "Delivered",
  visit: "Website visit",
  reply: "Positive reply",
  meeting: "Meeting booked",
  meetingAttended: "Meeting attended",
  formSubmitted: "Form submitted",
  closeWin: "Close won",
};
export const HIDDEN_TAGS = new Set(["opened"]);

/** The URL key of a company: its domain when served, else features-service's org id. */
export function companyKey(o: ConversionOrg): string | null {
  return o.orgDomain ?? o.orgId ?? null;
}

export function companyHref(orgId: string, brandId: string, o: ConversionOrg): string | null {
  const key = companyKey(o);
  return key ? `${v2Href(orgId, brandId, "companies")}/${encodeURIComponent(key)}` : null;
}

type SortKey = "value" | "touch" | "name";
const SORTS: Record<SortKey, { label: string; compare: (a: ConversionOrg, b: ConversionOrg) => number }> = {
  value: { label: "Value", compare: (a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd },
  touch: { label: "Last touch", compare: (a, b) => (b.mostAdvancedDate ?? "").localeCompare(a.mostAdvancedDate ?? "") },
  name: { label: "Name", compare: (a, b) => (a.orgName ?? a.orgDomain ?? "").localeCompare(b.orgName ?? b.orgDomain ?? "") },
};

/**
 * Rows drawn per step. A brand engaged with a few hundred companies drew every row at
 * once (about 8,000 DOM nodes), so each click on Companies spent ~0.6 s rendering before
 * the page even switched. The rest arrives as the reader scrolls toward the end.
 */
const ROWS_STEP = 60;

/**
 * List or Board (owner 2026-10-23, after Senthil asked to see the people of one company side by
 * side on Deals): the Board is the Deals board one grain up, one column per served lifecycle rung,
 * one card per company on the rung features-service puts it on. Remembered per browser.
 */
type CompaniesView = "list" | "board";
const VIEW_STORAGE_KEY = "distribute-companies-view";

/** "2m ago" for when a read last landed, ticking once a minute. */
function useAgo(at: number | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;
  const m = Math.floor((now - at) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}


/**
 * Companies: Keel's company table over the organisations features-service already
 * dedupes and values on the brand's revenue read. The expected revenue is its own served
 * figure, the order is that figure, and a row opens the company. The tabs and the search
 * only narrow rows already loaded; nothing is computed.
 */
export function CompaniesPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const router = useRouter();
  const revenue = useBrandRevenue(brandId);
  const [q, setQ] = useState("");
  // One tab per lifecycle rung (owner 2026-10-21): each company on the highest rung any of its
  // people reached, served by features-service with the companies per rung.
  const lifecycle = useCompanyLifecycle(brandId);
  const rungOf = useMemo(() => {
    const m = companyRungs(lifecycle.data);
    return (o: ConversionOrg) => (o.organizationKey ? (m.get(o.organizationKey) ?? null) : null);
  }, [lifecycle.data]);
  const rungTabs = lifecycle.data ? dealsBoardRungs(lifecycle.data.rungs) : [];
  const [tab, setTab] = useState<string>("all");
  const [cursor, setCursor] = useState(-1);
  const [sort, setSort] = useState<SortKey>("value");
  const [view, setView] = useState<CompaniesView>("list");
  useEffect(() => {
    if (window.localStorage.getItem(VIEW_STORAGE_KEY) === "board") setView("board");
  }, []);
  const pickView = (v: CompaniesView) => {
    setView(v);
    window.localStorage.setItem(VIEW_STORAGE_KEY, v);
  };
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement | null>(null);
  const updated = useAgo(revenue.dataUpdatedAt);
  const all = useMemo(() => revenue.data?.organizations ?? [], [revenue.data]);
  const orgs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((o) => (tab === "all" ? true : rungOf(o)?.key === tab))
      .filter((o) => (needle ? `${o.orgName ?? ""} ${o.orgDomain ?? ""}`.toLowerCase().includes(needle) : true))
      .sort(SORTS[sort].compare);
  }, [all, q, tab, rungOf, sort]);
  // How many of `orgs` are drawn. Back to one step whenever the filter or order changes;
  // the keyboard cursor and the end-of-list sentinel extend it.
  const [shown, setShown] = useState(ROWS_STEP);
  useEffect(() => setShown(ROWS_STEP), [q, tab, sort]);
  useEffect(() => {
    if (cursor >= shown) setShown(cursor + ROWS_STEP);
  }, [cursor, shown]);
  const sentinel = useRef<HTMLTableRowElement | null>(null);
  const hasMore = orgs.length > shown;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + ROWS_STEP);
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, shown]);
  const rowKey = (o: (typeof orgs)[number], i: number) => o.orgId ?? o.orgDomain ?? `${o.orgName}-${i}`;
  const allSelected = orgs.length > 0 && orgs.every((o, i) => selected.has(rowKey(o, i)));
  const toggle = (k: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  // Keel's X: select the highlighted row.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "x" && cursor >= 0 && orgs[cursor]) toggle(rowKey(orgs[cursor], cursor));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const exportRows = () => {
    const pick = selected.size ? orgs.filter((o, i) => selected.has(rowKey(o, i))) : orgs;
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      ["Company", "Domain", "Stage", "Best contact", "Expected value (USD)", "Signals", "Last touch"].join(","),
      ...pick.map((o) => {
        const stage = rungOf(o);
        const person = o.topPerson ? `${o.topPerson.firstName ?? ""} ${o.topPerson.lastName ?? ""}`.trim() : "";
        return [
          o.orgName ?? "",
          o.orgDomain ?? "",
          stage?.label ?? "",
          person,
          String(o.expectedRevenueUsd),
          o.tags.filter((t) => !HIDDEN_TAGS.has(t)).map((t) => TAG_LABEL[t] ?? t).join("; "),
          o.mostAdvancedDate ?? "",
        ].map(esc).join(",");
      }),
    ];
    return Promise.resolve(lines.join("\n"));
  };
  const pipeline = revenue.data?.totalPipelineUsd ?? null;

  const open = (i: number) => {
    const href = orgs[i] ? companyHref(orgId, brandId, orgs[i]) : null;
    if (href) router.push(href);
  };
  useRowKeys({ count: orgs.length, cursor, setCursor, onOpen: open, searchRef });

  return (
    <>
      <TopBar crumbs={[{ label: "Records" }, { label: "Companies" }]} />
      <RecordsTabs
        tabs={[
          { key: "all", label: "All companies", count: revenue.data ? all.length : null },
          ...rungTabs.map((r) => ({ key: r.key, label: r.label, count: lifecycle.data?.rungs.find((x) => x.key === r.key)?.organizationCount ?? null })),
        ]}
        active={tab}
        onPick={(k) => {
          setTab(k);
          setCursor(-1);
        }}
        right={
          revenue.data ? (
            <span>
              {formatCount(all.length)} {all.length === 1 ? "company" : "companies"} engaged
              {updated ? ` · updated ${updated}` : ""}
            </span>
          ) : null
        }
      />
      <RecordsToolbar
        search={q}
        onSearch={setQ}
        placeholder="Search companies"
        inputRef={searchRef}
        right={
          <>
            <span className="k-inset inline-flex rounded-[9px] p-0.5 shadow-[inset_0_0_0_1px_var(--line-subtle)]">
              {(["list", "board"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => pickView(v)}
                  className={`${view === v ? "k-btn" : "k-btn-ghost"} h-6 px-2 text-[12px]`}
                >
                  {v === "list" ? "List" : "Board"}
                </button>
              ))}
            </span>
            <label className="k-btn relative h-7 pr-7 text-[12px]">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="k-fg3" aria-hidden="true">
                <path d="M4.5 2.5v11M2 11l2.5 2.5L7 11M11.5 13.5v-11M9 5l2.5-2.5L14 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="k-fg2">Sort</span>
              <span>{SORTS[sort].label}</span>
              <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="absolute inset-0 cursor-pointer opacity-0">
                {(Object.keys(SORTS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>{SORTS[k].label}</option>
                ))}
              </select>
            </label>
            <ExportButton
              filename={`companies-${brandId}${selected.size ? "-selected" : ""}.csv`}
              csv={exportRows}
              disabled={orgs.length === 0}
            />
          </>
        }
      />
      {view === "board" ? (
        <CompaniesBoard
          orgId={orgId}
          brandId={brandId}
          rungs={tab === "all" ? rungTabs : rungTabs.filter((r) => r.key === tab)}
          orgs={orgs}
          rungOf={rungOf}
          served={(key) => lifecycle.data?.rungs.find((x) => x.key === key)?.organizationCount ?? null}
          pending={revenue.pending || lifecycle.data === undefined}
          filtered={q.trim() !== ""}
        />
      ) : (
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[940px] text-[13px]">
          <thead>
            <tr>
              <th className={`${REC_TH} w-10 pl-4 md:pl-6`}>
                <input
                  type="checkbox"
                  aria-label="Select all companies in view"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(orgs.map(rowKey)))}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
              </th>
              <th className={REC_TH}>Company</th>
              <th className={REC_TH}>Stage</th>
              <th className={REC_TH}>Best contact</th>
              <th className={`${REC_TH} text-right`}>Value</th>
              <th className={REC_TH}>Signals</th>
              <th className={`${REC_TH} text-right`}>Last touch</th>
              <th className={`${REC_TH} w-10 pr-4 md:pr-6`}><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {revenue.pending ? (
              Array.from({ length: 12 }, (_, i) => (
                <tr key={i} className="k-row h-10"><td colSpan={8} className="px-4 md:px-6"><Shimmer className="h-4 w-full" /></td></tr>
              ))
            ) : !revenue.enabled || orgs.length === 0 ? (
              <tr><td colSpan={8}><EmptyNote>{q || tab !== "all" ? "No company matches." : "No company has engaged yet."}</EmptyNote></td></tr>
            ) : (
              orgs.slice(0, shown).map((o, i) => {
                const name = o.orgName ?? o.orgDomain ?? "Unknown company";
                const person = o.topPerson ? `${o.topPerson.firstName ?? ""} ${o.topPerson.lastName ?? ""}`.trim() : "";
                const stage = rungOf(o);
                const href = companyHref(orgId, brandId, o);
                return (
                  <tr
                    key={o.orgId ?? `${name}-${i}`}
                    onClick={() => open(i)}
                    onMouseEnter={() => setCursor(i)}
                    className={`group k-row h-10 ${href ? "cursor-pointer" : ""} ${i === cursor || selected.has(rowKey(o, i)) ? "k-selected" : ""}`}
                  >
                    <td className="pl-4 md:pl-6" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${name}`}
                        checked={selected.has(rowKey(o, i))}
                        onChange={() => toggle(rowKey(o, i))}
                        className="h-3.5 w-3.5 accent-[var(--accent)]"
                      />
                    </td>
                    <td className="max-w-[260px] px-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <CompanyMark name={name} domain={o.orgDomain ?? null} size={18} />
                        {href ? (
                          <Link href={href} onClick={(e) => e.stopPropagation()} className="truncate font-medium hover:underline">{name}</Link>
                        ) : (
                          <span className="truncate font-medium">{name}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3">
                      {stage ? <TagChip tag={uniboxValueTag("lifecycle", stage.key, stage.label)} /> : <span className="k-fg4">{"—"}</span>}
                    </td>
                    <td className="max-w-[200px] px-3">
                      {person ? (
                        <span className="flex min-w-0 items-center gap-1.5">
                          {o.topPerson?.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.topPerson.photoUrl} alt="" className="h-[18px] w-[18px] shrink-0 rounded-full object-cover" />
                          ) : (
                            <Initials name={person} size={18} round />
                          )}
                          <span className="truncate">{person}</span>
                        </span>
                      ) : <span className="k-fg4">{"—"}</span>}
                    </td>
                    <td className="px-3 text-right font-medium tabular-nums">{formatUsdAdaptive(o.expectedRevenueUsd)}</td>
                    <td className="px-3">
                      <span className="flex gap-1">
                        {o.tags.filter((t) => !HIDDEN_TAGS.has(t)).slice(0, 2).map((t) => (
                          <span key={t} className="k-fg3 text-[12px]">{TAG_LABEL[t] ?? t}</span>
                        ))}
                      </span>
                    </td>
                    <td className="k-mono k-fg2 whitespace-nowrap px-3 text-right text-[12px] tabular-nums">
                      {o.mostAdvancedDate ? friendlyDate(o.mostAdvancedDate) : "—"}
                    </td>
                    <td className="pr-4 text-right md:pr-6">
                      {href ? (
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Open ${name}`}
                          className={`k-btn-ghost h-6 w-6 justify-center px-0 ${i === cursor ? "" : "opacity-0 group-hover:opacity-100"}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
            {!revenue.pending && hasMore && (
              <tr ref={sentinel} className="k-row h-10" aria-label="Loading more companies">
                <td colSpan={8} className="px-4 md:px-6"><Shimmer className="h-4 w-full" /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      <RecordsFooter
        right={
          <>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="k-btn-ghost h-6 text-[12px]">
                {formatCount(selected.size)} selected · clear
              </button>
            )}
            <span className="k-keys hidden items-center gap-1 md:inline-flex">
              <span className="k-kbd">X</span> select
            </span>
          </>
        }
        left={
          revenue.data
            ? `${formatCount(orgs.length)} ${orgs.length === 1 ? "company" : "companies"}${pipeline != null ? ` · ${formatUsdAdaptive(pipeline)} expected pipeline` : ""}`
            : " "
        }
      />
    </>
  );
}

/**
 * The Board: one column per rung, each company once, on the rung features-service serves for it
 * (the highest any of its people reached), in the page's sort. A card opens the company, where
 * all its people sit together. A column's count is the served one unless a search narrows it.
 */
function CompaniesBoard({
  orgId,
  brandId,
  rungs,
  orgs,
  rungOf,
  served,
  pending,
  filtered,
}: {
  orgId: string;
  brandId: string;
  rungs: LifecycleRung[];
  orgs: ConversionOrg[];
  rungOf: (o: ConversionOrg) => LifecycleRung | null;
  served: (key: string) => number | null;
  pending: boolean;
  filtered: boolean;
}) {
  const byRung = useMemo(() => {
    const m = new Map<string, ConversionOrg[]>();
    for (const o of orgs) {
      const key = rungOf(o)?.key;
      if (!key) continue;
      const list = m.get(key) ?? [];
      list.push(o);
      m.set(key, list);
    }
    return m;
  }, [orgs, rungOf]);
  return (
    <div className="k-scroll flex gap-4 overflow-x-auto px-4 pb-6 pt-4 md:px-6">
      {pending
        ? [0, 1, 2, 3].map((i) => (
            <section key={i} className="flex w-[240px] min-w-[200px] shrink-0 flex-col gap-2 md:flex-1 md:basis-0">
              <Shimmer className="h-7 rounded-[8px]" />
              <Shimmer className="h-[74px] rounded-[10px]" />
            </section>
          ))
        : rungs.map((r) => {
            const list = byRung.get(r.key) ?? [];
            return (
              <CompaniesColumn
                key={r.key}
                orgId={orgId}
                brandId={brandId}
                rung={r}
                orgs={list}
                total={filtered ? list.length : (served(r.key) ?? list.length)}
              />
            );
          })}
    </div>
  );
}

function CompaniesColumn({
  orgId,
  brandId,
  rung,
  orgs,
  total,
}: {
  orgId: string;
  brandId: string;
  rung: LifecycleRung;
  orgs: ConversionOrg[];
  total: number;
}) {
  const [shown, setShown] = useState(ROWS_STEP);
  const color = TONE_COLOR[uniboxValueTone("lifecycle", rung.key)];
  return (
    <section className="flex w-[240px] min-w-[200px] shrink-0 flex-col md:flex-1 md:basis-0">
      <header className="mb-2 flex h-7 items-center gap-2 px-0.5">
        <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
        <span className="truncate whitespace-nowrap text-[13px] font-medium">{rung.label}</span>
        <span className="k-fg3 shrink-0 text-[13px] tabular-nums">{formatCount(total)}</span>
      </header>
      <div className="flex flex-col gap-2">
        {orgs.length === 0 ? (
          <EmptyNote>No company here.</EmptyNote>
        ) : (
          orgs.slice(0, shown).map((o, i) => <CompanyCard key={o.orgId ?? o.organizationKey ?? `${o.orgName}-${i}`} orgId={orgId} brandId={brandId} o={o} />)
        )}
        {orgs.length > shown ? (
          <button type="button" className="k-btn-ghost k-btn mt-1 justify-center" onClick={() => setShown((s) => s + ROWS_STEP)}>
            Show more
          </button>
        ) : null}
      </div>
    </section>
  );
}

function CompanyCard({ orgId, brandId, o }: { orgId: string; brandId: string; o: ConversionOrg }) {
  const name = o.orgName ?? o.orgDomain ?? "Unknown company";
  const person = o.topPerson ? `${o.topPerson.firstName ?? ""} ${o.topPerson.lastName ?? ""}`.trim() : "";
  const href = companyHref(orgId, brandId, o);
  const signals = o.tags.filter((t) => !HIDDEN_TAGS.has(t)).slice(0, 2);
  const body = (
    <>
      <div className="flex items-center gap-2">
        <CompanyMark name={name} domain={o.orgDomain ?? null} size={18} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{name}</span>
        {o.expectedRevenueUsd > 0 ? <span className="k-fg2 shrink-0 text-[12px] tabular-nums">{formatUsdAdaptive(o.expectedRevenueUsd)}</span> : null}
      </div>
      {person ? (
        <div className="k-fg2 mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px]">
          {o.topPerson?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.topPerson.photoUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
          ) : (
            <Initials name={person} size={16} round />
          )}
          <span className="truncate">{person}</span>
        </div>
      ) : null}
      <div className="k-fg3 mt-2 flex items-center gap-1.5 border-t border-[var(--line-subtle)] pt-2 text-[11px]">
        <span className="flex min-w-0 flex-1 gap-1.5 truncate">
          {signals.map((t) => (
            <span key={t}>{TAG_LABEL[t] ?? t}</span>
          ))}
        </span>
        <span className="k-mono shrink-0 tabular-nums">{o.mostAdvancedDate ? friendlyDate(o.mostAdvancedDate) : ""}</span>
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="k-card block p-3">{body}</Link>
  ) : (
    <div className="k-card p-3">{body}</div>
  );
}
