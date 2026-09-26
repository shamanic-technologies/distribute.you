"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { AccountMenuV2, SearchTrigger, TenantSwitcherV2 } from "@/components/v2/sidebar-menus";
import { useMissions } from "@/components/v2/use-missions";
import { CrewMark } from "@/components/v2/crew-mark";
import { V2NavContext } from "@/components/v2/nav-context";
import { useBucketCounts, useBrandRevenue, useNeedsYourCall, useStandingCounts } from "@/components/v2/data";
import { v2Href, v2MissionHref, v2SectionOf } from "@/lib/v2/routes";
import { formatCount } from "@/lib/format-number";

/**
 * Keel's frame: a grey canvas, a one-level sidebar sitting ON it, and every page in one
 * inset panel. Below `lg` the sidebar is a drawer opened from the panel's top bar.
 */
export function V2Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  // No brand in the URL (the org's brand picker): no brand sidebar to draw.
  const hasBrand = Boolean(useParams<{ brandId?: string }>().brandId);
  // A navigation closes the drawer, wherever it was started from.
  useEffect(() => setOpen(false), [pathname, search]);

  return (
    <V2NavContext.Provider value={() => setOpen(true)}>
      <div className="v2-root flex h-[100dvh] w-full overflow-hidden">
        {open && <div className="fixed inset-0 z-40 bg-[#10101247] lg:hidden" onClick={() => setOpen(false)} />}
        <div
          className={`fixed inset-y-0 left-0 z-50 flex bg-[var(--bg-canvas)] transition-transform duration-200 ease-[cubic-bezier(.23,1,.32,1)] lg:static lg:z-auto lg:translate-x-0 ${
            open ? "translate-x-0 shadow-xl" : "-translate-x-full"
          }`}
        >
          {hasBrand && <V2Sidebar />}
        </div>
        <main className="k-panel k-scroll relative my-2 ml-2 mr-2 min-w-0 flex-1 overflow-y-auto lg:ml-0">
          {children}
        </main>
        {/* Overlays the sidebar opens (the ⌘K palette) render here, outside the drawer,
            whose transform would otherwise trap their fixed positioning. */}
        <div id="v2-portal" />
      </div>
    </V2NavContext.Provider>
  );
}

function Count({ n }: { n: number | null | undefined }) {
  if (n == null) return null;
  return <span className="k-fg3 ml-auto shrink-0 pr-1 text-[12px] tabular-nums">{formatCount(n)}</span>;
}

function NavItem({
  href,
  label,
  icon,
  active,
  trailing,
  indent = false,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  trailing?: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={`group flex h-7 min-w-0 items-center gap-2 rounded-[8px] pr-1.5 text-[13px] outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        indent ? "pl-[30px]" : "pl-2"
      } ${active ? "bg-[var(--bg-selected)] text-[var(--fg-1)]" : "text-[var(--fg-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-1)]"}`}
    >
      {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--fg-3)]">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="k-fg3 mb-1 px-2 text-[12px]">{title}</p>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

const I = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ICONS = {
  today: "M2.5 12.5h11M4 12.5V9m3 3.5V6.5m3 6V8m3 4.5v-6M8 2.5l.7 1.4 1.5.2-1.1 1 .3 1.5L8 5.9l-1.4.7.3-1.5-1.1-1 1.5-.2Z",
  records: "M2.5 3.5h11v9h-11zM2.5 6.5h11M6 6.5v6",
  work: "M2.5 3.5h11v9h-11zM6 3.5v9M10 3.5v9",
  crew: "M5.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2 13c.4-2 1.8-3.5 3.5-3.5S8.6 11 9 13m-.5-3c.6-.4 1.2-.5 2-.5 1.7 0 3.1 1.5 3.5 3.5",
  missions: "M3 13.5V2.5m0 1h8l-1.5 2.5L11 8.5H3",
  inbox: "M2.5 9h3l1 2h3l1-2h3M2.5 9l1.5-5.5h8L13.5 9v4h-11z",
  sent: "M13.5 2.5 7 9M13.5 2.5 9.5 13.5 7 9 2.5 6.5Z",
  offer: "M8.5 2.5h5v5L7.5 13.5l-5-5Zm2.5 2.5h.01",
  target: "M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm0-3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  plug: "M6 2.5v3m4-3v3M4.5 5.5h7v2a3.5 3.5 0 0 1-7 0zM8 11v2.5",
  settings: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5.2-1.1.9.6-1 1.8-1.1-.3a4.5 4.5 0 0 1-1.3.8l-.2 1.2H7.5l-.2-1.2a4.5 4.5 0 0 1-1.3-.8l-1.1.3-1-1.8.9-.6a4.5 4.5 0 0 1 0-1.8l-.9-.6 1-1.8 1.1.3c.4-.3.8-.6 1.3-.8l.2-1.2h2l.2 1.2c.5.2.9.5 1.3.8l1.1-.3 1 1.8-.9.6a4.5 4.5 0 0 1 0 1.8Z",
  card: "M2.5 4h11v8h-11zM2.5 6.5h11",
};

function V2Sidebar() {
  const params = useParams<{ orgId?: string; brandId?: string }>();
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const orgId = params.orgId ?? "";
  const brandId = params.brandId ?? "";
  const section = v2SectionOf(pathname);
  const { missions, crews } = useMissions(orgId, brandId);
  const buckets = useBucketCounts(brandId).data;
  const standings = useStandingCounts(brandId).data;
  const revenue = useBrandRevenue(brandId).data;
  const needsCall = useNeedsYourCall(brandId, 5).data?.total ?? null;
  const [recordsOpen, setRecordsOpen] = useState(true);
  const tab = search.get("tab");

  return (
    <aside className="flex h-full w-[240px] max-w-[85vw] shrink-0 flex-col">
      <div className="space-y-2 px-2 pt-2">
        <TenantSwitcherV2 />
        <SearchTrigger orgId={orgId} brandId={brandId} />
      </div>
      <nav className="k-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-3">
        <div className="space-y-px">
          <NavItem
            href={v2Href(orgId, brandId, "today")}
            label="Today"
            icon={<I d={ICONS.today} />}
            active={section === "today"}
            trailing={
              needsCall != null && needsCall > 0 ? (
                <span
                  title="Replied with interest, not yet closed"
                  className="ml-auto rounded-[5px] bg-[var(--bg-selected)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--fg-2)]"
                >
                  {formatCount(needsCall)}
                </span>
              ) : undefined
            }
          />
          <button
            type="button"
            onClick={() => setRecordsOpen((v) => !v)}
            className="flex h-7 w-full items-center gap-2 rounded-[8px] pl-2 pr-1.5 text-[13px] text-[var(--fg-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-1)]"
            aria-expanded={recordsOpen}
          >
            <span className="flex h-4 w-4 items-center justify-center text-[var(--fg-3)]">
              <I d={ICONS.records} />
            </span>
            <span className="flex-1 text-left">Records</span>
            <svg width="12" height="12" viewBox="0 0 12 12" className={`k-fg3 transition-transform ${recordsOpen ? "" : "-rotate-90"}`} aria-hidden="true">
              <path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
          {recordsOpen && (
            <>
              <NavItem
                indent
                href={v2Href(orgId, brandId, "companies")}
                label="Companies"
                active={section === "companies"}
                trailing={<Count n={revenue?.organizations.length} />}
              />
              <NavItem
                indent
                href={v2Href(orgId, brandId, "people")}
                label="People"
                active={section === "people" && !tab}
                trailing={<Count n={buckets?.counts.contacted} />}
              />
              <NavItem
                indent
                href={v2Href(orgId, brandId, "deals")}
                label="Deals"
                active={section === "deals"}
                trailing={<Count n={standings ? standings.counts.sales_interest + standings.counts.customer : null} />}
              />
            </>
          )}
          <NavItem href={v2Href(orgId, brandId, "work")} label="Work" icon={<I d={ICONS.work} />} active={section === "work"} />
          <NavItem href={v2Href(orgId, brandId, "crew")} label="Crew" icon={<I d={ICONS.crew} />} active={section === "crew"} />
          <NavItem href={v2Href(orgId, brandId, "missions")} label="Missions" icon={<I d={ICONS.missions} />} active={section === "missions"} />
        </div>

        <Group title="Mailbox">
          <NavItem
            href={`${v2Href(orgId, brandId, "people")}?tab=positive-replies`}
            label="Inbox"
            icon={<I d={ICONS.inbox} />}
            active={section === "people" && tab === "positive-replies"}
            trailing={<Count n={buckets?.counts.positive_reply} />}
          />
          <NavItem
            href={`${v2Href(orgId, brandId, "people")}?tab=contacted`}
            label="Sent"
            icon={<I d={ICONS.sent} />}
            active={section === "people" && tab === "contacted"}
          />
        </Group>

        <Group title="Setup">
          <NavItem href={v2Href(orgId, brandId, "offers")} label="Offers" icon={<I d={ICONS.offer} />} active={section === "offers"} />
          <NavItem href={v2Href(orgId, brandId, "targeting")} label="Targeting" icon={<I d={ICONS.target} />} active={section === "targeting"} />
          <NavItem href={v2Href(orgId, brandId, "integrations")} label="Integrations" icon={<I d={ICONS.plug} />} active={section === "integrations"} />
          <NavItem href={v2Href(orgId, brandId, "settings")} label="Brand settings" icon={<I d={ICONS.settings} />} active={section === "settings"} />
          <NavItem href={v2Href(orgId, brandId, "billing")} label="Billing" icon={<I d={ICONS.card} />} active={section === "billing"} />
        </Group>

        {crews.length > 0 && (
          <Group title="Crew">
            {crews.map((c) => (
              <NavItem
                key={c.crew.key}
                href={`${v2Href(orgId, brandId, "crew")}#${encodeURIComponent(c.crew.key)}`}
                label={c.crew.name}
                icon={<CrewMark color={c.crew.color} glyph={c.crew.glyph} />}
                trailing={
                  c.running > 0 ? (
                    <span className="k-dot-pulse ml-auto mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--run)] text-[var(--run)]" aria-label="Running" />
                  ) : (
                    <span className="ml-auto mr-1 h-2 w-2 shrink-0 rounded-full border-[1.5px] border-[var(--fg-2)]" aria-label="Paused" />
                  )
                }
              />
            ))}
          </Group>
        )}

        {missions.length > 0 && (
          <Group title="Missions">
            {missions.map((m) => (
              <NavItem
                key={m.row.campaign.id}
                href={v2MissionHref(orgId, brandId, m.row.campaign.id)}
                active={pathname.endsWith(`/missions/${m.row.campaign.id}`)}
                label={m.offerName ? `${m.crew.name} · ${m.offerName}` : m.crew.name}
                icon={<CrewMark color={m.crew.color} glyph={m.crew.glyph} />}
              />
            ))}
          </Group>
        )}
      </nav>
      <AccountMenuV2 orgId={orgId} brandId={brandId} />
    </aside>
  );
}
