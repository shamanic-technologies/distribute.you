"use client";

import { useEffect, useRef, useState } from "react";
import { OfferMark } from "./marks/offer-mark";
import { BrandLogo } from "./brand-logo";
import { OrgAvatar } from "./org-avatar";
import { CHROME_ROW_HEIGHT } from "@/lib/chrome-row";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";

/**
 * Sidebar-top tenant switcher.
 *
 * Replaces the top-bar breadcrumb: the tenant identity lives at the top of the
 * sidebar, level with the header row, and ONE menu carries the whole hierarchy.
 * This is the Slack / Notion / Linear / Vercel pattern, and it is what the
 * research converged on:
 *  - NN/g: breadcrumbs are "not useful for sites 1-2 levels deep" — org › brand
 *    is exactly two, so the breadcrumb was carrying no orientation value.
 *  - Atlassian + Vercel both migrated product navigation OUT of the top bar into
 *    the sidebar for information density.
 *  - Carbon + GitLab Pajamas warn that a left panel supports TWO tiers, never
 *    three. This switcher now carries THREE — Org > Brand > Offer — and that is a
 *    deliberate departure, owner-decided, not a drift: the OFFER is a real level of
 *    the product (a brand is an identity, an offer is a proposition, and campaigns,
 *    audiences and leads all belong to the offer), so leaving it out would mean
 *    there is no way to change proposition from the chrome at all. What that
 *    guidance is really protecting against is several open panels stacking into a
 *    maze, and the single-open-submenu state below still holds: at most one tier is
 *    expanded, so no more than two panels are ever on screen, exactly as with two
 *    tiers. A FOURTH tier (the campaign) is deliberately NOT here — a campaign is
 *    picked from its offer's own list, which is a table with the numbers beside it.
 *  - Atlassian's app switcher is the canonical two-level-in-one-menu shape, and
 *    it is a SIDE-BY-SIDE split (orgs on one rail, their children beside them),
 *    not a nested accordion — so on a wide viewport each submenu opens as a
 *    flyout to the RIGHT of the parent panel, top-aligned with its row.
 *  - Notion + Clerk's OrganizationSwitcher: "create new" belongs in the switcher,
 *    at the bottom, separated from the switch list.
 *  - Linear / Notion / Vercel / GitHub: billing is org-scoped and reached from
 *    the ORG entry point (the workspace name), never from the avatar menu and
 *    never as a primary sidebar nav item.
 *
 * Mobile: a flyout would run off-screen (the sidebar is only 224px and becomes a
 * drawer), so below `md` the submenu STACKS under its row and the whole menu is
 * reachable from a chip in the header — one tap, no drawer detour.
 */

const Chevron = ({ open, direction = "down" }: { open: boolean; direction?: "down" | "right" }) => (
  <svg
    className={`w-3.5 h-3.5 text-gray-400 transition flex-shrink-0 ${
      direction === "right"
        ? // Stacked (mobile) rotates like a disclosure caret; as a flyout (md+)
          // it points right, at the panel it opens.
          `${open ? "rotate-180" : ""} md:rotate-[-90deg]`
        : open
          ? "rotate-180"
          : ""
    }`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckMark = () => (
  <svg className="w-4 h-4 text-brand-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

/**
 * Shown on the row the user just clicked, and on the switcher itself, for the
 * whole window between the click and the navigation. That window is two or three
 * Clerk round-trips long and nothing else on screen moves during it — the labels
 * are keyed on the URL org, which has not changed yet.
 */
const Spinner = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={`${className} animate-spin text-brand-600 flex-shrink-0`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const PlusTile = ({ sizeClass }: { sizeClass: string }) => (
  <div className={`${sizeClass} border-2 border-dashed border-gray-300 rounded flex items-center justify-center flex-shrink-0`}>
    <span className="text-gray-400 text-xs font-bold leading-none">+</span>
  </div>
);

/**
 * Shown while a tenant is genuinely UNKNOWN — never as a loading state for one we
 * already remember. The server-read cookie seed covers every org/brand this browser
 * has opened before, so in practice this appears only on a first-ever visit to a
 * tenant, where there is nothing truthful to display yet. The alternative (`Brand`
 * beside a globe) is a FABRICATED identity: it reads as the product having lost the
 * brand, which is the complaint this whole path exists to answer.
 */
function IdentitySkeleton({ markClass, barClass }: { markClass: string; barClass: string }) {
  return (
    <>
      <div className={`${markClass} flex-shrink-0 animate-pulse rounded bg-gray-200`} />
      <div className={`${barClass} animate-pulse rounded bg-gray-200`} />
    </>
  );
}

/**
 * The offer mark, from the SHARED component. It was defined here and is now
 * drawn by the top-bar breadcrumb too — two definitions is how the switcher and
 * the bar come to disagree about what an offer looks like, which is the same
 * reason the acquisition-channel and sales-funnel marks are components.
 */
const OfferTile = () => <OfferMark size="md" />;

const BillingIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

/**
 * The submenu shell. Stacked under its row on mobile, flyout to the right of the
 * parent panel on `md+` (top-aligned with the row it belongs to).
 */
function Submenu({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-0.5 rounded-md border-gray-200 md:absolute md:left-full md:top-0 md:z-50 md:ml-1 md:mt-0 md:w-64 md:rounded-lg md:border md:bg-white md:py-1 md:shadow-xl">
      <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 md:px-3">
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * The menu body. Rendered by BOTH the sidebar switcher and the mobile header
 * chip so the two can never diverge — the only difference is where the caller
 * anchors it.
 */
function TenantMenu({
  t,
  onDone,
}: {
  t: ReturnType<typeof useTenantSwitcher>;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState<"org" | "brand" | "offer" | null>(null);

  // Staff god-mode: load the all-orgs list when the ORG submenu opens. Debounced
  // on search. Never fires for customers (the route 403s anyway).
  useEffect(() => {
    if (!t.isStaff || expanded !== "org") return;
    const timer = setTimeout(() => t.fetchOrgs(t.orgSearch), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.isStaff, expanded, t.orgSearch]);

  // ONE tier is expanded at a time, whatever the depth — so a third tier adds a
  // row, never a second open panel.
  const toggleSection = (key: "org" | "brand" | "offer") => {
    setExpanded((prev) => (prev === key ? null : key));
    if (key === "brand") t.fetchBrands();
    if (key === "offer") t.fetchOffers();
  };

  const go = (fn: () => void) => { onDone(); fn(); };
  const brandLabel = t.displayBrand?.name || t.displayBrand?.domain || "Brand";

  return (
    <div className="rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
      <div className="px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Workspace</p>
      </div>

      {/* ORG — tier 1 */}
      <div className="relative px-1">
        <button
          type="button"
          onClick={() => toggleSection("org")}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-gray-50 ${
            expanded === "org" ? "bg-gray-50" : ""
          }`}
        >
          {t.orgKnown ? (
            <>
              <OrgAvatar
                name={t.displayOrgName}
                imageUrl={t.displayOrgImageUrl}
                hasImage={t.displayOrgHasImage}
                sizeClass="w-5 h-5"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                {t.displayOrgName}
              </span>
            </>
          ) : (
            <IdentitySkeleton markClass="w-5 h-5" barClass="h-3.5 flex-1" />
          )}
          <Chevron open={expanded === "org"} direction="right" />
        </button>

        {expanded === "org" && (
          <Submenu title="Switch organization">
            {t.switchError && (
              <p className="px-4 py-1.5 text-xs text-red-600 md:px-3">{t.switchError}</p>
            )}
            {t.isStaff && (
              <div className="px-3 pb-1.5">
                <input
                  autoFocus
                  value={t.orgSearch}
                  onChange={(e) => t.setOrgSearch(e.target.value)}
                  placeholder="Search all organizations…"
                  className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            )}
            <div className="max-h-56 overflow-y-auto">
              {t.isStaff ? (
                <>
                  {t.orgsLoading && <p className="px-4 py-2 text-xs text-gray-400 md:px-3">Loading…</p>}
                  {!t.orgsLoading && t.allOrgs.length === 0 && (
                    <p className="px-4 py-2 text-xs text-gray-400 md:px-3">No organizations found</p>
                  )}
                  {t.allOrgs.map((o) => (
                    <button
                      key={o.id}
                      // Deliberately NOT through `go()`: closing the menu first
                      // removes the only surface that can show the switch running,
                      // and the switch runs for seconds. The menu closes when the
                      // navigation lands.
                      onClick={() => t.handleOrgSwitch(o.id, o.name)}
                      disabled={!!t.switchingOrgId}
                      className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition md:px-3 ${
                        t.orgId === o.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                      } ${t.switchingOrgId && t.switchingOrgId !== o.id ? "opacity-50" : ""}`}
                    >
                      <OrgAvatar name={o.name} imageUrl={o.imageUrl} hasImage={o.hasImage} sizeClass="w-5 h-5" />
                      <span className="truncate">{o.name}</span>
                      {t.switchingOrgId === o.id ? (
                        <Spinner className="ml-auto w-4 h-4" />
                      ) : (
                        t.orgId === o.id && <CheckMark />
                      )}
                    </button>
                  ))}
                </>
              ) : (
                t.memberships.map((m) => (
                  <button
                    key={m.organization.id}
                    onClick={() => t.handleOrgSwitch(m.organization.id, m.organization.name)}
                    disabled={!!t.switchingOrgId}
                    className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition md:px-3 ${
                      t.orgId === m.organization.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                    } ${
                      t.switchingOrgId && t.switchingOrgId !== m.organization.id ? "opacity-50" : ""
                    }`}
                  >
                    <OrgAvatar
                      name={m.organization.name}
                      imageUrl={m.organization.imageUrl}
                      hasImage={m.organization.hasImage}
                      sizeClass="w-5 h-5"
                    />
                    <span className="truncate">{m.organization.name}</span>
                    {t.switchingOrgId === m.organization.id ? (
                      <Spinner className="ml-auto w-4 h-4" />
                    ) : (
                      t.orgId === m.organization.id && <CheckMark />
                    )}
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => go(() => t.router.push("/onboarding?new=1&from=add"))}
              className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-gray-100 px-4 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50 md:px-3"
            >
              <PlusTile sizeClass="w-5 h-5" />
              <span>New organization</span>
            </button>
          </Submenu>
        )}
      </div>

      {/* BRAND — tier 2, drawn as a child of the org above via a 1px connector
          rail. Indent alone doesn't read as hierarchy (and no fetched source
          endorses indent-only nesting), so the rail + the disclosure chevron
          carry the relationship. */}
      {t.orgId && (
        <div className="relative px-1 pl-6">
          <span aria-hidden className="absolute left-[18px] top-0 h-[22px] w-px bg-gray-200" />
          <span aria-hidden className="absolute left-[18px] top-[22px] h-px w-2.5 bg-gray-200" />
          <button
            type="button"
            onClick={() => toggleSection("brand")}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-gray-50 ${
              expanded === "brand" ? "bg-gray-50" : ""
            }`}
          >
            {t.brandId && !t.brandKnown ? (
              <IdentitySkeleton markClass="w-5 h-5" barClass="h-3.5 flex-1" />
            ) : (
              <>
                <BrandLogo
                  domain={t.displayBrand?.domain ?? null}
                  size={20}
                  className="rounded flex-shrink-0"
                  fallbackClassName="w-5 h-5 text-gray-400 flex-shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                  {t.brandId ? brandLabel : "All brands"}
                </span>
              </>
            )}
            <Chevron open={expanded === "brand"} direction="right" />
          </button>

          {expanded === "brand" && (
            <Submenu title="Switch brand">
              <div className="max-h-56 overflow-y-auto">
                {t.brandsLoading ? (
                  <p className="px-4 py-2 text-xs text-gray-400 md:px-3">Loading…</p>
                ) : t.brands.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-gray-400 md:px-3">No brands</p>
                ) : (
                  t.brands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => go(() => t.handleBrandSwitch(b.id))}
                      className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition md:px-3 ${
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
                onClick={() => go(() => t.router.push("/onboarding?from=add"))}
                className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-gray-100 px-4 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50 md:px-3"
              >
                <PlusTile sizeClass="w-[18px] h-[18px]" />
                <span>New brand</span>
              </button>
            </Submenu>
          )}
        </div>
      )}

      {/* OFFER — tier 3, and the LAST one. Drawn as a child of the brand above it
          by the same 1px rail, one indent further. A brand is an IDENTITY; an offer
          is a PROPOSITION, and it owns the campaigns, the audiences and the leads —
          so changing proposition is as ordinary a move as changing brand, and it
          belongs in the same menu. Only rendered under a brand: without one there is
          no set of offers to pick from. */}
      {t.brandId && (
        <div className="relative px-1 pl-10">
          <span aria-hidden className="absolute left-[34px] top-0 h-[22px] w-px bg-gray-200" />
          <span aria-hidden className="absolute left-[34px] top-[22px] h-px w-2.5 bg-gray-200" />
          <button
            type="button"
            onClick={() => toggleSection("offer")}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-gray-50 ${
              expanded === "offer" ? "bg-gray-50" : ""
            }`}
          >
            {t.offerId && !t.offerKnown ? (
              <IdentitySkeleton markClass="w-5 h-5" barClass="h-3.5 flex-1" />
            ) : (
              <>
                <OfferTile />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                  {t.offerId ? t.displayOffer?.name : "All offers"}
                </span>
              </>
            )}
            <Chevron open={expanded === "offer"} direction="right" />
          </button>

          {expanded === "offer" && (
            <Submenu title="Switch offer">
              <div className="max-h-56 overflow-y-auto">
                {t.offersLoading ? (
                  <p className="px-4 py-2 text-xs text-gray-400 md:px-3">Loading…</p>
                ) : t.offers.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-gray-400 md:px-3">No offers</p>
                ) : (
                  t.offers.map((o) => (
                    <button
                      key={o.offerId}
                      onClick={() => go(() => t.handleOfferSwitch(o.offerId))}
                      className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition md:px-3 ${
                        t.offerId === o.offerId ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <OfferTile />
                      <span className="truncate">{o.name}</span>
                      {t.offerId === o.offerId && <CheckMark />}
                    </button>
                  ))
                )}
              </div>
              {/* No "New offer" entry: creating a second proposition is not a
                  chrome action yet, and an entry that opens nothing is worse than
                  none. */}
            </Submenu>
          )}
        </div>
      )}

      {/* Org-scoped billing — reached from the ORG entry point, per every
          multi-tenant leader checked (Linear, Notion, Vercel, GitHub). */}
      {t.orgId && (
        <div className="mt-1 border-t border-gray-100 px-1 pt-1">
          <button
            onClick={() => go(() => t.router.push(`/orgs/${t.orgId}/billing`))}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
          >
            <span className="text-gray-400"><BillingIcon /></span>
            <span>Billing</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Close the menu on an outside click. */
function useCloseOnOutsideClick(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);
  return ref;
}

export function TenantSwitcher() {
  const t = useTenantSwitcher();
  const [open, setOpen] = useState(false);
  const rootRef = useCloseOnOutsideClick(() => setOpen(false));

  // An org row no longer closes the menu on click (it has to stay open to show the
  // switch running), so the arrival is what closes it.
  const arrivedOrgId = t.orgId;
  useEffect(() => { setOpen(false); }, [arrivedOrgId]);

  const brandLabel = t.displayBrand?.name || t.displayBrand?.domain || "Brand";
  const buttonLabel = t.brandId ? brandLabel : t.displayOrgName;
  // The row shows whichever tenant the URL is on, so it is only truthful once THAT
  // one is known — a brand page must not fall back to the org's name.
  const identityKnown = t.brandId ? t.brandKnown : t.orgKnown;

  return (
    // The border lives on the WRAPPER, not on the `h-14` button: Tailwind sets
    // `box-sizing: border-box`, so a border on the sized element would eat into
    // the 56px and leave this block 1px SHORTER than the header (whose own
    // `border-b` sits on <header>, outside its `h-14` inner row). Wrapper border
    // → both blocks are 56px of content + a 1px edge, and the seam disappears.
    <div ref={rootRef} className="relative border-b border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex ${CHROME_ROW_HEIGHT} w-full items-center gap-2 px-3 text-left transition hover:bg-gray-50`}
      >
        {t.switchingOrgId ? (
          // The label reads the URL org, which does not move until the navigation
          // lands. Name the target instead, so the click has a visible answer for
          // the whole wait.
          <>
            <Spinner className="w-[22px] h-[22px]" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
              {t.switchingOrgName ? `Switching to ${t.switchingOrgName}…` : "Switching…"}
            </span>
          </>
        ) : !identityKnown ? (
          <IdentitySkeleton markClass="w-[22px] h-[22px]" barClass="h-3.5 flex-1" />
        ) : (
          <>
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
          </>
        )}
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 md:right-auto md:w-60">
          <TenantMenu t={t} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/**
 * Mobile header chip  The sidebar is a drawer below `md`, so the
 * chip is a FULL switcher in its own right — tapping it opens the same menu
 * anchored under the header. Routing it through the drawer instead would cost
 * two taps and put a right-hand flyout inside a 224px panel.
 */
export function MobileTenantChip() {
  const t = useTenantSwitcher();
  const [open, setOpen] = useState(false);
  const rootRef = useCloseOnOutsideClick(() => setOpen(false));

  const arrivedOrgId = t.orgId;
  useEffect(() => { setOpen(false); }, [arrivedOrgId]);

  if (!t.orgId) return null;
  const label = t.brandId
    ? t.displayBrand?.name || t.displayBrand?.domain || "Brand"
    : t.displayOrgName;
  const identityKnown = t.brandId ? t.brandKnown : t.orgKnown;

  return (
    <div ref={rootRef} className="relative min-w-0 md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-gray-100"
      >
        {t.switchingOrgId ? (
          <>
            <Spinner className="w-5 h-5" />
            <span className="min-w-0 truncate text-sm font-semibold text-gray-900">
              {t.switchingOrgName ? `Switching to ${t.switchingOrgName}…` : "Switching…"}
            </span>
          </>
        ) : !identityKnown ? (
          <IdentitySkeleton markClass="w-5 h-5" barClass="h-3.5 w-24" />
        ) : (
          <>
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
          </>
        )}
        <Chevron open={open} />
      </button>

      {open && (
        <div className="fixed left-2 right-2 top-[calc(3.5rem+0.25rem)] z-[60] max-h-[calc(100vh-4.5rem)] overflow-y-auto">
          <TenantMenu t={t} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
