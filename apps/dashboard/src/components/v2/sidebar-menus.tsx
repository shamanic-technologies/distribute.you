"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk, useOrganization, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { listLeadsPage, type Lead } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { leadsSearchParam, leadsSearchProblem } from "@/lib/leads-server-page";
import { formatCount } from "@/lib/format-number";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";
import { backToV1Href, switchUiVersion } from "@/components/ui-version-switch";
import { BrandLogo } from "@/components/brand-logo";
import { OrgAvatar } from "@/components/org-avatar";
import { MaturityBadge } from "@/components/maturity-badge";
import { supportWhatsAppHref } from "@/components/support/support-button";
import { REFERRAL_CREDIT_USD } from "@/lib/invite-link";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions } from "@/components/v2/use-missions";
import { brandLeadScopeKey, useBrandRevenue, useBucketCounts, useNeedsYourCall } from "@/components/v2/data";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, personHref } from "@/components/v2/people-bits";
import { companyHref } from "@/components/v2/companies-page";
import { v2Base, v2Href, type V2Section } from "@/lib/v2/routes";

/**
 * The three sidebar controls of v2 (beta), drawn the way Explee and Keel draw them:
 * the tenant switcher at the top (Explee's project switcher), the account menu at the
 * bottom (Explee's user menu, whose pages are Team, API Keys, Billing and Refer a
 * friend), and Keel's command palette behind the search box and ⌘K.
 *
 * Switching reuses `useTenantSwitcher` — the org switch is the same guarded
 * join / setActive / token re-mint dance v1 runs, so v2 cannot race it differently.
 */

function useOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

const Plus = () => (
  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
    <svg width="14" height="14" viewBox="0 0 14 14" className="k-fg3" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  </span>
);
const Updown = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" className="k-fg3 ml-auto shrink-0" aria-hidden="true">
    <path d="M4 4.5 6 2.5l2 2M4 7.5l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const itemCls =
  "flex h-8 w-full min-w-0 items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-[var(--fg-1)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none disabled:opacity-50";
/** The row you are on reads selected, the way Explee marks the open project (no check mark). */
const currentCls = "bg-[var(--bg-selected)] font-medium";

function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="k-fg3 px-2 pb-1 pt-2 text-[12px]">{children}</p>;
}

// ─── Tenant switcher (Explee's project switcher) ────────────────────────────

export function TenantSwitcherV2() {
  const t = useTenantSwitcher();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The popover stays INSIDE the sidebar's width: the drawer wrapper is transformed
  // (a stacking context), so anything wider is painted under the main panel.
  const ref = useOutside(open, () => setOpen(false));
  // Close once a switch LANDS (the org id changes), never before: the menu is the
  // only surface that shows a switch running.
  useEffect(() => setOpen(false), [t.orgId, t.brandId]);
  useEffect(() => {
    if (open) t.fetchBrands();
    if (open && t.isStaff) {
      const timer = setTimeout(() => t.fetchOrgs(t.orgSearch), 250);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, t.orgSearch]);

  const name = t.displayBrand?.name || t.displayBrand?.domain || t.displayOrgName || "Brand";
  const orgs = t.isStaff
    ? t.allOrgs.map((o) => ({ id: o.id, name: o.name, imageUrl: o.imageUrl, hasImage: o.hasImage }))
    : t.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        imageUrl: m.organization.imageUrl,
        hasImage: m.organization.hasImage,
      }));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left hover:bg-[var(--bg-hover)]"
      >
        <BrandLogo
          domain={t.displayBrand?.domain ?? null}
          logoUrl={t.displayBrand?.logoUrl}
          size={20}
          className="shrink-0 rounded-[5px]"
          fallbackClassName="h-5 w-5 shrink-0"
        />
        <span className="min-w-0 truncate text-[13px] font-semibold">{t.switchingOrgName ?? name}</span>
        <Updown />
      </button>
      {open && (
        <div role="menu" className="k-popover absolute left-0 right-0 top-full z-50 mt-1 p-1">
          <div className="k-scroll max-h-56 overflow-y-auto">
            {t.brandsLoading && t.brands.length === 0 ? (
              <p className="k-fg3 px-2 py-1.5 text-[12px]">Loading…</p>
            ) : (
              t.brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="menuitem"
                  aria-current={b.id === t.brandId ? "true" : undefined}
                  className={`${itemCls} ${b.id === t.brandId ? currentCls : ""}`}
                  onClick={() => {
                    setOpen(false);
                    if (t.orgId) router.push(v2Base(t.orgId, b.id));
                  }}
                >
                  <BrandLogo domain={b.domain ?? null} logoUrl={b.logoUrl} size={20} className="shrink-0 rounded-[5px]" fallbackClassName="h-5 w-5 shrink-0" />
                  <span className="truncate">{b.name || b.domain || "Brand"}</span>
                </button>
              ))
            )}
          </div>
          <div className="my-1 h-px bg-[var(--line-subtle)]" />
          <button type="button" role="menuitem" className={itemCls} onClick={() => router.push("/onboarding?from=add")}>
            <Plus />
            New brand
          </button>
          <div className="my-1 h-px bg-[var(--line-subtle)]" />
          <MenuLabel>Organizations</MenuLabel>
          {t.switchError && <p className="px-2 py-1 text-[12px] text-[var(--data-rose)]">{t.switchError}</p>}
          {t.isStaff && (
            <div className="px-1 pb-1">
              <input
                value={t.orgSearch}
                onChange={(e) => t.setOrgSearch(e.target.value)}
                placeholder="Search all organizations…"
                aria-label="Search all organizations"
                className="k-input w-full px-2"
              />
            </div>
          )}
          <div className="k-scroll max-h-48 overflow-y-auto">
            {orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                disabled={!!t.switchingOrgId}
                aria-current={o.id === t.orgId ? "true" : undefined}
                className={`${itemCls} ${o.id === t.orgId ? currentCls : ""}`}
                onClick={() => (o.id === t.orgId ? setOpen(false) : void t.handleOrgSwitch(o.id, o.name))}
              >
                <OrgAvatar name={o.name} imageUrl={o.imageUrl} hasImage={o.hasImage} sizeClass="w-5 h-5" />
                <span className="truncate">{o.name}</span>
                {t.switchingOrgId === o.id && <span className="k-fg3 ml-auto text-[12px]">Switching…</span>}
              </button>
            ))}
          </div>
          <div className="my-1 h-px bg-[var(--line-subtle)]" />
          <button type="button" role="menuitem" className={itemCls} onClick={() => router.push("/onboarding?new=1&from=add")}>
            <Plus />
            New organization
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Account menu (Explee's user menu) ──────────────────────────────────────

/**
 * Explee's user menu, in its order and its words: the email on top, then Team, API
 * Keys, Billing, Refer a friend (with what it earns), Help, then Sign out. Each item
 * opens a v2 page with our data; Help opens the support chat the FAB opens.
 *
 * Explee's Notifications, Feedback and Theme are left out: we store no notification
 * preferences, have nowhere to send a feedback note, and v2 has no dark theme, so each
 * would be a control that does nothing. Back to v1 is ours (the one way out of v2), and
 * the email row opens the Profile page, since Explee's menu has no profile item.
 */
const MENU_ICON = {
  team: "M6 7.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm-4 5.5c.4-2 2-3.2 4-3.2s3.6 1.2 4 3.2M10.5 3.2a2.2 2.2 0 0 1 0 4.1M12 9.9c1.2.4 2 1.4 2.2 3.1",
  key: "M6 9.5a3 3 0 1 1 2.6-1.5l4.9 4.9-1.2 1.2-1-1-1 1-1-1 1-1-2.1-2.1A3 3 0 0 1 6 9.5Z",
  billing: "M3.5 2.5h9v11l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1zM6 5.5h4M6 8h4",
  gift: "M2.5 6h11v2.5h-11zM3.5 8.5v5h9v-5M8 6v7.5M8 6c-1-2.5-4-2.5-4-.8C4 6 6 6 8 6Zm0 0c1-2.5 4-2.5 4-.8C12 6 10 6 8 6Z",
  help: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.4.2-.7.5-.7 1v.5M8 11.3v.2",
  back: "M6 4 3 7l3 3M3.5 7H10a3 3 0 0 1 0 6H8",
  out: "M9.5 3.5h3v9h-3M6.5 5 3.5 8l3 3M3.5 8h7",
};
function MI({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="k-fg2 shrink-0" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Initial({ label, size }: { label: string; size: number }) {
  return (
    <span
      className="k-fg2 flex shrink-0 items-center justify-center rounded-full bg-[var(--bg-selected)] text-[11px] font-medium uppercase"
      style={{ width: size, height: size }}
    >
      {label.slice(0, 1)}
    </span>
  );
}

export function AccountMenuV2({ orgId, brandId }: { orgId: string; brandId: string }) {
  const { user } = useUser();
  const { organization } = useOrganization();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const name = user?.fullName || user?.firstName || "";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const base = v2Base(orgId, brandId);
  const close = () => setOpen(false);
  const links: { href: string; label: string; icon: string; pill?: string }[] = [
    { href: `${base}/team`, label: "Team", icon: MENU_ICON.team },
    { href: `${base}/api-keys`, label: "API Keys", icon: MENU_ICON.key },
    { href: `${base}/billing`, label: "Billing", icon: MENU_ICON.billing },
    { href: `${base}/referral`, label: "Refer a friend", icon: MENU_ICON.gift, pill: `Earn $${REFERRAL_CREDIT_USD}` },
  ];
  const avatar = (size: number) =>
    user?.imageUrl && user.hasImage ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.imageUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    ) : (
      <Initial label={name || email} size={size} />
    );
  return (
    <div ref={ref} className="relative px-2 pb-2 pt-1">
      {open && (
        <div role="menu" className="k-popover absolute bottom-full left-2 right-2 z-50 mb-1 p-1">
          <Link href={`${base}/account`} role="menuitem" onClick={close} className="k-fg3 block truncate rounded-[8px] px-2 py-1.5 text-[13px] hover:bg-[var(--bg-hover)]" title="Profile">
            {email || name}
          </Link>
          <div className="my-1 h-px bg-[var(--line-subtle)]" />
          {links.map((l) => (
            <Link key={l.href} href={l.href} role="menuitem" className={itemCls} onClick={close}>
              <MI d={l.icon} />
              <span className="min-w-0 truncate">{l.label}</span>
              {l.pill && (
                <span className="ml-auto shrink-0 rounded-[6px] bg-[color-mix(in_oklab,var(--run)_12%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--run)]">
                  {l.pill}
                </span>
              )}
            </Link>
          ))}
          <a
            href={supportWhatsAppHref(email, organization?.name ?? "")}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={itemCls}
            onClick={() => {
              posthog.capture("support_whatsapp_clicked", { location: "dashboard-v2-menu", orgId: organization?.id ?? null });
              close();
            }}
          >
            <MI d={MENU_ICON.help} />
            Help
          </a>
          <div className="my-1 h-px bg-[var(--line-subtle)]" />
          <button
            type="button"
            role="menuitem"
            className={itemCls}
            onClick={() => switchUiVersion("v1", backToV1Href(orgId, brandId || null))}
          >
            <MI d={MENU_ICON.back} />
            Back to v1
          </button>
          <div className="my-1 h-px bg-[var(--line-subtle)]" />
          <button type="button" role="menuitem" className={itemCls} onClick={() => void signOut({ redirectUrl: "/sign-in" })}>
            <MI d={MENU_ICON.out} />
            Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 text-left hover:bg-[var(--bg-hover)]"
      >
        {avatar(28)}
        <span className="min-w-0 flex-1 leading-4">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium">{name || email}</span>
            <MaturityBadge level="beta" />
          </span>
          {name && <span className="k-fg3 block truncate text-[12px]">{email}</span>}
        </span>
        <Updown />
      </button>
    </div>
  );
}

// ─── Command palette (Keel's ⌘K) ────────────────────────────────────────────

type PaletteItem = {
  key: string;
  group: string;
  label: React.ReactNode;
  text: string;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  href: string;
  shortcut?: string;
};

/** Keel's "G then letter" jumps. One home so the palette shows what the keys do. */
export const GO_KEYS: { section: V2Section; label: string; key: string }[] = [
  { section: "today", label: "Today", key: "t" },
  { section: "companies", label: "Companies", key: "r" },
  { section: "people", label: "People", key: "p" },
  { section: "deals", label: "Deals", key: "d" },
  { section: "work", label: "Work", key: "w" },
  { section: "crew", label: "Crew", key: "c" },
  { section: "missions", label: "Missions", key: "m" },
];
const SETUP: { section: V2Section; label: string }[] = [
  { section: "offers", label: "Offers" },
  { section: "targeting", label: "Targeting" },
  { section: "integrations", label: "Integrations" },
  { section: "settings", label: "Brand settings" },
  { section: "billing", label: "Billing" },
  { section: "team", label: "Team" },
  { section: "api-keys", label: "API Keys" },
  { section: "referral", label: "Refer a friend" },
];

function matches(text: string, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const t = text.toLowerCase();
  return words.every((w) => t.includes(w));
}

/**
 * Every result is a real record or a real page: people come from lead-service's own
 * search over the whole population (the `q` the People table sends), companies from
 * the brand's served organisations, missions and crews from `useMissions`. There is no
 * "ask" row: nothing here answers a question in words.
 */
export function CommandPalette({ orgId, brandId, open, onClose }: { orgId: string; brandId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [wire, setWire] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      setQ("");
      setWire("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  useEffect(() => {
    const t = setTimeout(() => setWire(leadsSearchProblem(q) ? "" : (leadsSearchParam(q) ?? "")), 200);
    return () => clearTimeout(t);
  }, [q]);

  const { missions, crews } = useMissions(orgId, brandId);
  const revenue = useBrandRevenue(brandId).data;
  const buckets = useBucketCounts(brandId).data;
  const call = useNeedsYourCall(brandId, 5).data?.leads ?? [];
  const peopleQ = useAuthQuery(
    ["leadsPage", brandLeadScopeKey(brandId), "v2-palette", wire],
    () => listLeadsPage({ brandId }, { view: "basic", sort: "activity", limit: "6", q: wire }, undefined, { includeCampaigns: false }),
    { enabled: open && wire.length > 0 },
  );

  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];
    const term = q.trim();
    const personItem = (group: string, lead: Lead): PaletteItem => {
      const company = leadCompany(lead);
      return {
        key: `${group}-${lead.id}`,
        group,
        text: leadName(lead),
        label: leadName(lead),
        meta: company ?? lead.email,
        icon: <PersonAvatar lead={lead} size={16} />,
        href: personHref(orgId, brandId, lead),
      };
    };
    if (!term) for (const l of call) out.push({ ...personItem("Needs your call", l), label: `Follow up with ${leadName(l)}?` });
    for (const g of GO_KEYS) {
      if (!term || matches(g.label, term)) {
        out.push({ key: `go-${g.section}`, group: "Go to", text: g.label, label: g.label, href: v2Href(orgId, brandId, g.section), shortcut: `G ${g.key.toUpperCase()}` });
      }
    }
    for (const s of SETUP) {
      if (!term || matches(s.label, term)) out.push({ key: `setup-${s.section}`, group: "Setup", text: s.label, label: s.label, href: v2Href(orgId, brandId, s.section) });
    }
    if (term) {
      for (const m of missions) {
        const label = m.offerName ? `${m.crew.name} · ${m.offerName}` : m.crew.name;
        if (matches(`${label} ${m.leg?.label ?? ""}`, term)) {
          out.push({ key: `m-${m.row.campaign.id}`, group: "Missions", text: label, label, meta: m.leg?.label, icon: <CrewMark color={m.crew.color} glyph={m.crew.glyph} />, href: m.href });
        }
      }
      for (const c of crews) {
        if (matches(c.crew.name, term)) {
          out.push({ key: `c-${c.crew.key}`, group: "Crew", text: c.crew.name, label: c.crew.name, icon: <CrewMark color={c.crew.color} glyph={c.crew.glyph} />, href: `${v2Href(orgId, brandId, "crew")}#${encodeURIComponent(c.crew.key)}` });
        }
      }
      let companies = 0;
      for (const o of revenue?.organizations ?? []) {
        const name = o.orgName ?? o.orgDomain ?? "";
        const href = companyHref(orgId, brandId, o);
        if (!name || !href || !matches(`${name} ${o.orgDomain ?? ""}`, term)) continue;
        out.push({ key: `co-${href}`, group: "Companies", text: name, label: name, meta: o.orgDomain ?? undefined, icon: <CompanyMark name={name} domain={o.orgDomain ?? null} size={16} />, href });
        if (++companies >= 6) break;
      }
      for (const l of peopleQ.data?.leads ?? []) out.push(personItem("People", l));
    }
    return out;
  }, [q, call, missions, crews, revenue, peopleQ.data, orgId, brandId]);

  useEffect(() => setCursor(0), [q, items.length]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  let lastGroup = "";
  // Portalled to the shell's own layer: the sidebar is a transformed drawer below
  // `lg`, and a transform traps `position: fixed` exactly as a backdrop-filter does.
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Command palette"
        className="k-popover flex max-h-[70vh] w-full max-w-[640px] flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--line-subtle)] px-4">
          <svg width="16" height="16" viewBox="0 0 16 16" className="k-fg3 shrink-0" aria-hidden="true">
            <path d="M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm6.5 1.5-3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(items.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const it = items[cursor];
                if (it) go(it.href);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Search or jump to a page…"
            aria-label="Search"
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--fg-3)]"
          />
          <span className="k-kbd">esc</span>
        </div>
        <div ref={listRef} className="k-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="k-fg3 px-3 py-6 text-center text-[13px]">
              {peopleQ.isFetching ? "Searching…" : `Nothing matches “${q.trim()}”.`}
            </p>
          ) : (
            items.map((it, i) => {
              const header = it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              return (
                <div key={it.key}>
                  {header && <p className="k-fg3 px-2.5 pb-1 pt-2.5 text-[12px]">{header}</p>}
                  <button
                    type="button"
                    data-idx={i}
                    onMouseMove={() => setCursor(i)}
                    onClick={() => go(it.href)}
                    className={`flex h-9 w-full min-w-0 items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] ${i === cursor ? "bg-[var(--bg-selected)]" : ""}`}
                  >
                    {it.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{it.icon}</span>}
                    <span className="min-w-0 truncate">{it.label}</span>
                    {it.meta && <span className="k-fg3 min-w-0 truncate">{it.meta}</span>}
                    {it.shortcut && (
                      <span className="ml-auto flex shrink-0 gap-1">
                        {it.shortcut.split(" ").map((k) => (
                          <span key={k} className="k-kbd">{k}</span>
                        ))}
                      </span>
                    )}
                  </button>
                </div>
              );
            })
          )}
          {q.trim() && peopleQ.isFetching && items.length > 0 && <p className="k-fg3 px-2.5 py-1.5 text-[12px]">Searching people…</p>}
        </div>
        <div className="k-fg3 flex h-10 items-center gap-3 border-t border-[var(--line-subtle)] px-4 text-[12px]">
          <span className="k-keys hidden items-center gap-1 sm:inline-flex"><span className="k-kbd">↑</span><span className="k-kbd">↓</span> to move</span>
          <span className="k-keys hidden items-center gap-1 sm:inline-flex"><span className="k-kbd">↵</span> to open</span>
          <span className="k-keys hidden items-center gap-1 sm:inline-flex"><span className="k-kbd">esc</span> to close</span>
          <span className="ml-auto tabular-nums">
            {revenue ? `${formatCount(revenue.organizations.length)} companies` : ""}
            {revenue && buckets ? " · " : ""}
            {buckets ? `${formatCount(buckets.counts.contacted)} people` : ""}
          </span>
        </div>
      </div>
    </div>,
    host,
  );
}

/** The sidebar's search box: opens the palette. ⌘K anywhere, and Keel's "G then letter". */
export function SearchTrigger({ orgId, brandId }: { orgId: string; brandId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "g") {
        pendingG = Date.now();
        return;
      }
      if (pendingG && Date.now() - pendingG < 1200) {
        const hit = GO_KEYS.find((g) => g.key === key);
        pendingG = 0;
        if (hit) {
          e.preventDefault();
          router.push(v2Href(orgId, brandId, hit.section));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orgId, brandId, router]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="k-input flex w-full items-center gap-2 px-2 text-left"
        aria-label="Search"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" className="k-fg3 shrink-0" aria-hidden="true">
          <path d="M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm6.5 1.5-3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="k-fg3 min-w-0 flex-1 truncate text-[13px]">Search…</span>
        <span className="k-kbd">⌘K</span>
      </button>
      <CommandPalette orgId={orgId} brandId={brandId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
