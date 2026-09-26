"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { TenantMenu } from "@/components/tenant-switcher";
import { BrandLogo } from "@/components/brand-logo";
import { MaturityBadge } from "@/components/maturity-badge";
import { backToV1Href, switchUiVersion } from "@/components/ui-version-switch";
import { useMissions } from "@/components/v2/use-missions";
import { CrewMark } from "@/components/v2/crew-mark";
import { V2NavContext } from "@/components/v2/nav-context";
import { useBucketCounts, useBrandRevenue, useStandingCounts } from "@/components/v2/data";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";
import { v1Brand, v2Href, v2MissionHref, v2SectionOf } from "@/lib/v2/routes";
import { formatCount } from "@/lib/format-number";

/**
 * Keel's frame: a grey canvas, a one-level sidebar sitting ON it, and every page in one
 * inset panel. Below `lg` the sidebar is a drawer opened from the panel's top bar.
 */
export function V2Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
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
          <V2Sidebar />
        </div>
        <main className="k-panel k-scroll relative my-2 ml-2 mr-2 min-w-0 flex-1 overflow-y-auto lg:ml-0">
          {children}
        </main>
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
  external = false,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  trailing?: React.ReactNode;
  indent?: boolean;
  /** Leaves v2 for a v1 page. Marked, so nobody mistakes it for a v2 view. */
  external?: boolean;
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
      {external && (
        <svg width="10" height="10" viewBox="0 0 10 10" className="k-fg4 shrink-0 opacity-0 group-hover:opacity-100" aria-hidden="true">
          <path d="M3.5 2h4.5v4.5M8 2 2.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )}
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

function TenantButton() {
  const t = useTenantSwitcher();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const name = t.displayBrand?.name || t.displayBrand?.domain || t.displayOrgName || "Brand";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left hover:bg-[var(--bg-hover)]"
      >
        <BrandLogo
          domain={t.displayBrand?.domain ?? null}
          logoUrl={t.displayBrand?.logoUrl}
          size={20}
          className="shrink-0 rounded-[5px]"
          fallbackClassName="h-5 w-5 shrink-0"
        />
        <span className="min-w-0 truncate text-[13px] font-semibold">{name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" className="k-fg3 shrink-0" aria-hidden="true">
          <path d="M4 4.5 6 2.5l2 2M4 7.5l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64">
          <TenantMenu t={t} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function SearchBox({ orgId, brandId }: { orgId: string; brandId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(`${v2Href(orgId, brandId, "people")}${term ? `?q=${encodeURIComponent(term)}` : ""}`);
      }}
      className="k-input flex items-center gap-2 px-2"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" className="k-fg3 shrink-0" aria-hidden="true">
        <path d="M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm6.5 1.5-3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people…"
        aria-label="Search people"
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--fg-3)]"
      />
      <span className="k-kbd">⌘K</span>
    </form>
  );
}

function V2Sidebar() {
  const params = useParams<{ orgId?: string; brandId?: string }>();
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const { user } = useUser();
  const orgId = params.orgId ?? "";
  const brandId = params.brandId ?? "";
  const section = v2SectionOf(pathname);
  const { missions, crews } = useMissions(orgId, brandId);
  const buckets = useBucketCounts(brandId).data;
  const standings = useStandingCounts(brandId).data;
  const revenue = useBrandRevenue(brandId).data;
  const [recordsOpen, setRecordsOpen] = useState(true);
  const v1 = v1Brand(orgId, brandId);
  const tab = search.get("tab");
  const firstOffer = missions[0]?.offerId ?? null;

  return (
    <aside className="flex h-full w-[240px] max-w-[85vw] shrink-0 flex-col">
      <div className="space-y-2 px-2 pt-2">
        <TenantButton />
        <SearchBox orgId={orgId} brandId={brandId} />
      </div>
      <nav className="k-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-3">
        <div className="space-y-px">
          <NavItem
            href={v2Href(orgId, brandId, "today")}
            label="Today"
            icon={<I d={ICONS.today} />}
            active={section === "today"}
            trailing={
              standings && standings.counts.sales_interest > 0 ? (
                <span className="ml-auto rounded-[5px] bg-[var(--bg-selected)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--fg-2)]">
                  {standings.counts.sales_interest}
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
          <NavItem external href={`${v1}/offers`} label="Offers" icon={<I d={ICONS.offer} />} />
          {firstOffer && (
            <NavItem external href={`${v1}/offers/${firstOffer}/audiences`} label="Targeting" icon={<I d={ICONS.target} />} />
          )}
          <NavItem external href={`${v1}/crm`} label="Integrations" icon={<I d={ICONS.plug} />} />
          <NavItem external href={`${v1}/settings`} label="Brand settings" icon={<I d={ICONS.settings} />} />
          <NavItem external href={`/orgs/${encodeURIComponent(orgId)}/billing`} label="Billing" icon={<I d={ICONS.card} />} />
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
                    <span className="k-dot-pulse ml-auto mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)] text-[var(--accent)]" aria-label="Running" />
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
      <div className="flex items-center gap-2.5 px-3 pb-3 pt-2">
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="h-7 w-7 shrink-0 rounded-full bg-[var(--bg-selected)]" />
        )}
        <div className="min-w-0 flex-1 leading-4">
          <p className="truncate text-[13px] font-medium">{user?.fullName || user?.primaryEmailAddress?.emailAddress || ""}</p>
          <p className="k-fg3 flex items-center gap-1.5 truncate text-[12px]">
            Dashboard v2 <MaturityBadge level="beta" />
          </p>
        </div>
        <button
          type="button"
          onClick={() => switchUiVersion("v1", backToV1Href(orgId, brandId || null))}
          title="Back to v1"
          aria-label="Back to v1"
          className="k-btn-ghost h-7 shrink-0 whitespace-nowrap px-2 text-[12px]"
        >
          Back to v1
        </button>
      </div>
    </aside>
  );
}
