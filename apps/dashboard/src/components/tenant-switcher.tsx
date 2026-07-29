"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./brand-logo";
import { OrgAvatar } from "./org-avatar";
import { MaturityBadge } from "./maturity-badge";
import { useMobileSidebar } from "./mobile-sidebar-context";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";

/**
 * Sidebar-top tenant switcher (beta chrome).
 *
 * Replaces the top-bar breadcrumb: the tenant identity lives at the top of the
 * sidebar, level with the header row, and ONE menu carries the whole hierarchy.
 * This is the Slack / Notion / Linear / Vercel pattern, and it is what the
 * research converged on:
 *  - NN/g: breadcrumbs are "not useful for sites 1-2 levels deep" — org › brand
 *    is exactly two, so the breadcrumb was carrying no orientation value.
 *  - Atlassian + Vercel both migrated product navigation OUT of the top bar into
 *    the sidebar for information density.
 *  - Carbon + GitLab Pajamas: a left panel supports TWO tiers, never three. The
 *    panel below is an accordion (one section open at a time) so it can never
 *    grow a third tier.
 *  - NN/g: a two-tier dropdown is "frustrating" — the second tier is an explicit
 *    chevron-disclosed section, not a hover submenu.
 *  - Notion + Clerk's OrganizationSwitcher: "create new" belongs in the switcher,
 *    at the bottom, separated from the switch list.
 *  - Linear / Notion / Vercel / GitHub: billing is org-scoped and reached from
 *    the ORG entry point (the workspace name), never from the avatar menu and
 *    never as a primary sidebar nav item.
 */

const Chevron = ({ open }: { open: boolean }) => (
  <svg className={`w-3.5 h-3.5 text-gray-400 transition flex-shrink-0 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckMark = () => (
  <svg className="w-4 h-4 text-brand-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const PlusTile = ({ sizeClass }: { sizeClass: string }) => (
  <div className={`${sizeClass} border-2 border-dashed border-gray-300 rounded flex items-center justify-center flex-shrink-0`}>
    <span className="text-gray-400 text-xs font-bold leading-none">+</span>
  </div>
);

const BillingIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

export function TenantSwitcher() {
  const t = useTenantSwitcher();
  const [expanded, setExpanded] = useState<"org" | "brand" | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setExpanded(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Staff god-mode: load the all-orgs list when the ORG section opens. Debounced on
  // search. Never fires for customers (the route 403s anyway).
  useEffect(() => {
    if (!t.isStaff || expanded !== "org") return;
    const timer = setTimeout(() => t.fetchOrgs(t.orgSearch), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.isStaff, expanded, t.orgSearch]);

  const closeAll = () => { setOpen(false); setExpanded(null); };

  const toggleSection = (key: "org" | "brand") => {
    setExpanded((prev) => (prev === key ? null : key));
    if (key === "brand") t.fetchBrands();
  };

  // The button shows the deepest resolved tenant: the brand when we're inside one,
  // otherwise the org.
  const brandLabel = t.displayBrand?.name || t.displayBrand?.domain || "Brand";
  const buttonLabel = t.brandId ? brandLabel : t.displayOrgName;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? closeAll() : setOpen(true))}
        className="flex h-[49px] w-full items-center gap-2 border-b border-gray-200 px-3 text-left transition hover:bg-gray-50"
      >
        {t.brandId ? (
          <BrandLogo
            domain={t.displayBrand?.domain ?? null}
            size={22}
            className="rounded flex-shrink-0"
            fallbackClassName="w-[22px] h-[22px] text-gray-400 flex-shrink-0"
          />
        ) : (
          <OrgAvatar
            name={t.displayOrgName}
            imageUrl={t.displayOrgImageUrl}
            hasImage={t.displayOrgHasImage}
            sizeClass="w-[22px] h-[22px]"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
          {buttonLabel}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
          <div className="flex items-center gap-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Workspace</p>
            <MaturityBadge level="beta" />
          </div>

          {/* ORG — tier 1 */}
          <div className="px-1">
            <button
              type="button"
              onClick={() => toggleSection("org")}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-gray-50"
            >
              <OrgAvatar
                name={t.displayOrgName}
                imageUrl={t.displayOrgImageUrl}
                hasImage={t.displayOrgHasImage}
                sizeClass="w-5 h-5"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                {t.displayOrgName}
              </span>
              <Chevron open={expanded === "org"} />
            </button>

            {expanded === "org" && (
              <div className="pb-1">
                {t.isStaff && (
                  <div className="px-2 pb-1.5">
                    <input
                      autoFocus
                      value={t.orgSearch}
                      onChange={(e) => t.setOrgSearch(e.target.value)}
                      placeholder="Search all organizations…"
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto">
                  {t.isStaff ? (
                    <>
                      {t.orgsLoading && <p className="px-4 py-2 text-xs text-gray-400">Loading…</p>}
                      {!t.orgsLoading && t.allOrgs.length === 0 && (
                        <p className="px-4 py-2 text-xs text-gray-400">No organizations found</p>
                      )}
                      {t.allOrgs.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => { closeAll(); t.handleOrgSwitch(o.id); }}
                          className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition ${
                            t.orgId === o.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <OrgAvatar name={o.name} imageUrl={o.imageUrl} hasImage={o.hasImage} sizeClass="w-5 h-5" />
                          <span className="truncate">{o.name}</span>
                          {t.orgId === o.id && <CheckMark />}
                        </button>
                      ))}
                    </>
                  ) : (
                    t.memberships.map((m) => (
                      <button
                        key={m.organization.id}
                        onClick={() => { closeAll(); t.handleOrgSwitch(m.organization.id); }}
                        className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition ${
                          t.orgId === m.organization.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <OrgAvatar
                          name={m.organization.name}
                          imageUrl={m.organization.imageUrl}
                          hasImage={m.organization.hasImage}
                          sizeClass="w-5 h-5"
                        />
                        <span className="truncate">{m.organization.name}</span>
                        {t.orgId === m.organization.id && <CheckMark />}
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={() => { closeAll(); t.router.push("/onboarding?new=1&from=add"); }}
                  className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50"
                >
                  <PlusTile sizeClass="w-5 h-5" />
                  <span>New organization</span>
                </button>
              </div>
            )}
          </div>

          {/* BRAND — tier 2, drawn as a child of the org above via a 1px connector
              rail. Indent alone doesn't read as hierarchy (and no fetched source
              endorses indent-only nesting), so the rail + the disclosure chevron
              carry the relationship. This is the LAST tier: Carbon and GitLab both
              cap a left panel at two, and the accordion makes a third impossible. */}
          {t.orgId && (
            <div className="relative px-1 pl-6">
              <span aria-hidden className="absolute left-[18px] top-0 h-[22px] w-px bg-gray-200" />
              <span aria-hidden className="absolute left-[18px] top-[22px] h-px w-2.5 bg-gray-200" />
              <button
                type="button"
                onClick={() => toggleSection("brand")}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-gray-50"
              >
                <BrandLogo
                  domain={t.displayBrand?.domain ?? null}
                  size={20}
                  className="rounded flex-shrink-0"
                  fallbackClassName="w-5 h-5 text-gray-400 flex-shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                  {t.brandId ? brandLabel : "All brands"}
                </span>
                <Chevron open={expanded === "brand"} />
              </button>

              {expanded === "brand" && (
                <div className="pb-1">
                  <div className="max-h-64 overflow-y-auto">
                    {t.brandsLoading ? (
                      <p className="px-4 py-2 text-xs text-gray-400">Loading…</p>
                    ) : t.brands.length === 0 ? (
                      <p className="px-4 py-2 text-xs text-gray-400">No brands</p>
                    ) : (
                      t.brands.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => { closeAll(); t.handleBrandSwitch(b.id); }}
                          className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition ${
                            t.brandId === b.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <BrandLogo
                            domain={b.domain}
                            size={18}
                            className="rounded flex-shrink-0"
                            fallbackClassName="w-[18px] h-[18px] text-gray-400 flex-shrink-0"
                          />
                          <span className="truncate">{b.name || b.domain}</span>
                          {t.brandId === b.id && <CheckMark />}
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => { closeAll(); t.router.push("/onboarding?from=add"); }}
                    className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50"
                  >
                    <PlusTile sizeClass="w-[18px] h-[18px]" />
                    <span>New brand</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Org-scoped billing — reached from the ORG entry point, per every
              multi-tenant leader checked (Linear, Notion, Vercel, GitHub). */}
          {t.orgId && (
            <div className="mt-1 border-t border-gray-100 px-1 pt-1">
              <button
                onClick={() => { closeAll(); t.router.push(`/orgs/${t.orgId}/billing`); }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                <span className="text-gray-400"><BillingIcon /></span>
                <span>Billing</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile header chip (beta chrome). The switcher lives inside the sidebar, which
 * is a drawer on mobile — without this the mobile header would carry no tenant
 * identity at all. Tapping it opens the drawer, where the full switcher lives.
 */
export function MobileTenantChip() {
  const t = useTenantSwitcher();
  const { toggle } = useMobileSidebar();
  if (!t.orgId) return null;
  const label = t.brandId
    ? t.displayBrand?.name || t.displayBrand?.domain || "Brand"
    : t.displayOrgName;
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-gray-100 md:hidden"
    >
      {t.brandId ? (
        <BrandLogo
          domain={t.displayBrand?.domain ?? null}
          size={20}
          className="rounded flex-shrink-0"
          fallbackClassName="w-5 h-5 text-gray-400 flex-shrink-0"
        />
      ) : (
        <OrgAvatar
          name={t.displayOrgName}
          imageUrl={t.displayOrgImageUrl}
          hasImage={t.displayOrgHasImage}
          sizeClass="w-5 h-5"
        />
      )}
      <span className="min-w-0 truncate text-sm font-semibold text-gray-900">{label}</span>
    </button>
  );
}
