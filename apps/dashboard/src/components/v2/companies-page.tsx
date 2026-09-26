"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ConversionOrg } from "@/lib/revenue-view";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { friendlyDate } from "@/lib/friendly-datetime";
import { v2Href } from "@/lib/v2/routes";
import { MaturityBadge } from "@/components/maturity-badge";
import { useBrandRevenue } from "@/components/v2/data";
import { CompanyMark } from "@/components/v2/people-bits";
import { EmptyNote, Initials, Shimmer, TopBar } from "@/components/v2/ui";
import { RecordsFooter, RecordsTabs, RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";

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
 * Companies (beta): Keel's company table over the organisations features-service already
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
  const searchRef = useRef<HTMLInputElement | null>(null);
  const all = useMemo(() => revenue.data?.organizations ?? [], [revenue.data]);
  const tagOf = TABS.find((t) => t.key === tab)?.tag ?? null;
  const orgs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((o) => (tagOf ? o.tags.includes(tagOf) : true))
      .filter((o) => (needle ? `${o.orgName ?? ""} ${o.orgDomain ?? ""}`.toLowerCase().includes(needle) : true))
      .sort((a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd);
  }, [all, q, tagOf]);
  const pipeline = revenue.data?.totalPipelineUsd ?? null;

  const open = (i: number) => {
    const href = orgs[i] ? companyHref(orgId, brandId, orgs[i]) : null;
    if (href) router.push(href);
  };
  useRowKeys({ count: orgs.length, cursor, setCursor, onOpen: open, searchRef });

  return (
    <>
      <TopBar crumbs={[{ label: "Records" }, { label: "Companies" }]} actions={<MaturityBadge level="beta" />} />
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
            <span>Companies where someone visited your site or replied with interest</span>
          ) : null
        }
      />
      <RecordsToolbar search={q} onSearch={setQ} placeholder="Search companies" inputRef={searchRef} />
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr>
              <th className={`${REC_TH} pl-4 md:pl-6`}>Company</th>
              <th className={REC_TH}>Stage</th>
              <th className={REC_TH}>Best contact</th>
              <th className={`${REC_TH} text-right`}>Value</th>
              <th className={REC_TH}>Signals</th>
              <th className={`${REC_TH} pr-4 text-right md:pr-6`}>Last touch</th>
            </tr>
          </thead>
          <tbody>
            {revenue.pending ? (
              Array.from({ length: 12 }, (_, i) => (
                <tr key={i} className="k-row h-10"><td colSpan={6} className="px-4 md:px-6"><Shimmer className="h-4 w-full" /></td></tr>
              ))
            ) : !revenue.enabled || orgs.length === 0 ? (
              <tr><td colSpan={6}><EmptyNote>{q || tagOf ? "No company matches." : "No company has engaged yet."}</EmptyNote></td></tr>
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
                    className={`k-row h-10 ${href ? "cursor-pointer" : ""} ${i === cursor ? "k-selected" : ""}`}
                  >
                    <td className="max-w-[260px] pl-4 pr-3 md:pl-6">
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
                    <td className="k-mono k-fg2 whitespace-nowrap px-3 pr-4 text-right text-[12px] tabular-nums md:pr-6">
                      {o.mostAdvancedDate ? friendlyDate(o.mostAdvancedDate) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <RecordsFooter
        left={
          revenue.data
            ? `${formatCount(orgs.length)} ${orgs.length === 1 ? "company" : "companies"}${pipeline != null ? ` · ${formatUsdAdaptive(pipeline)} expected pipeline` : ""}`
            : " "
        }
      />
    </>
  );
}
