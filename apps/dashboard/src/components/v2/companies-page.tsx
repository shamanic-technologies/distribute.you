"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ConversionOrg } from "@/lib/revenue-view";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { friendlyDate } from "@/lib/friendly-datetime";
import { v2Href } from "@/lib/v2/routes";
import { useBrandRevenue } from "@/components/v2/data";
import { CompanyMark } from "@/components/v2/people-bits";
import { EmptyNote, Initials, Shimmer, TopBar } from "@/components/v2/ui";
import { ExportButton, RecordsFooter, RecordsTabs, RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";
import { useMissions } from "@/components/v2/use-missions";
import { CrewMark } from "@/components/v2/crew-mark";

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

/** The most advanced tag an organisation carries, as the step it stands on. */
const STAGE_ORDER = ["closeWin", "meetingAttended", "meeting", "formSubmitted", "reply", "visit", "delivered", "sent", "contacted"];
export function companyStage(o: ConversionOrg): string | null {
  for (const t of STAGE_ORDER) if (o.tags.includes(t)) return t;
  return null;
}

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

const TABS = [
  { key: "all", label: "All companies", tag: null },
  { key: "interested", label: "Interested", tag: "reply" },
  { key: "visited", label: "Visited", tag: "visit" },
  { key: "meetings", label: "Meetings", tag: "meeting" },
  { key: "won", label: "Won", tag: "closeWin" },
] as const;

/** Keel's pipeline step glyph: one bar per step, the reached ones filled. */
function StageBars({ tag }: { tag: string | null }) {
  const level = tag === "closeWin" || tag === "meetingAttended" ? 4 : tag === "meeting" || tag === "formSubmitted" ? 3 : tag === "reply" ? 2 : tag === "visit" ? 1 : 0;
  return (
    <span className="inline-flex items-end gap-[1.5px]" aria-hidden="true">
      {[4, 6, 8, 10].map((h, i) => (
        <span key={i} className="w-[2.5px] rounded-[1px]" style={{ height: h, background: i < level ? "var(--fg-2)" : "var(--data-track)" }} />
      ))}
    </span>
  );
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
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [cursor, setCursor] = useState(-1);
  const [sort, setSort] = useState<SortKey>("value");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { crews } = useMissions(orgId, brandId);
  const runningCrews = crews.filter((c) => c.running > 0).length;
  const updated = useAgo(revenue.dataUpdatedAt);
  const all = useMemo(() => revenue.data?.organizations ?? [], [revenue.data]);
  const tagOf = TABS.find((t) => t.key === tab)?.tag ?? null;
  const orgs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((o) => (tagOf ? o.tags.includes(tagOf) : true))
      .filter((o) => (needle ? `${o.orgName ?? ""} ${o.orgDomain ?? ""}`.toLowerCase().includes(needle) : true))
      .sort(SORTS[sort].compare);
  }, [all, q, tagOf, sort]);
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
        const stage = companyStage(o);
        const person = o.topPerson ? `${o.topPerson.firstName ?? ""} ${o.topPerson.lastName ?? ""}`.trim() : "";
        return [
          o.orgName ?? "",
          o.orgDomain ?? "",
          stage ? TAG_LABEL[stage] ?? stage : "",
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
        tabs={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: revenue.data ? (t.tag ? all.filter((o) => o.tags.includes(t.tag)).length : all.length) : null,
        }))}
        active={tab}
        onPick={(k) => {
          setTab(k as typeof tab);
          setCursor(-1);
        }}
        right={
          revenue.data ? (
            <>
              <span className="flex items-center gap-1">
                {crews.slice(0, 5).map((c) => (
                  <CrewMark key={c.crew.key} color={c.crew.color} glyph={c.crew.glyph} size={14} />
                ))}
              </span>
              <span>
                {formatCount(all.length)} {all.length === 1 ? "company" : "companies"} engaged with your crew
                {updated ? ` · updated ${updated}` : ""}
              </span>
              {crews.length > 0 && (
                <>
                  <span className="k-fg4">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${runningCrews ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
                    {runningCrews} {runningCrews === 1 ? "crew" : "crews"} running now
                  </span>
                </>
              )}
            </>
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
              <tr><td colSpan={8}><EmptyNote>{q || tagOf ? "No company matches." : "No company has engaged yet."}</EmptyNote></td></tr>
            ) : (
              orgs.map((o, i) => {
                const name = o.orgName ?? o.orgDomain ?? "Unknown company";
                const person = o.topPerson ? `${o.topPerson.firstName ?? ""} ${o.topPerson.lastName ?? ""}`.trim() : "";
                const stage = companyStage(o);
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
                      {stage ? (
                        <span className="k-chip gap-1.5"><StageBars tag={stage} />{TAG_LABEL[stage] ?? stage}</span>
                      ) : <span className="k-fg4">{"—"}</span>}
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
                        {o.tags.filter((t) => !HIDDEN_TAGS.has(t) && t !== stage).slice(0, 2).map((t) => (
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
          </tbody>
        </table>
      </div>
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
