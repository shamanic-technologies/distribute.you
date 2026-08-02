"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { CHROME_ROW_HEIGHT } from "@/lib/chrome-row";
import { shareBrandBasePath } from "@/lib/share-mode";
import { ShareModeProvider, type ShareModeValue } from "./share-mode-context";
import { QueryProvider } from "@/lib/query-provider";
import { FeaturesProvider } from "@/lib/features-context";
import { EntityRegistryProvider } from "@/lib/entity-registry-context";
import { MobileSidebarProvider, useMobileSidebar } from "@/components/mobile-sidebar-context";

/**
 * The chrome of the public share view.
 *
 * Same L-shaped shell as the dashboard, deliberately: the recipient is looking at
 * the brand's real dashboard and it should read as one. What is missing is
 * everything that belongs to the ORG rather than to the brand.
 *
 * Absent on purpose, each one a decision rather than an omission:
 *   - the account menu and Sign out — there is no account here;
 *   - the Share control — you do not re-share a link you were handed;
 *   - the tenant switcher — there is one brand and one org, and offering to
 *     switch would advertise that others exist;
 *   - Billing and every other org surface — the recipient is not the customer;
 *   - Brand Settings, Brand Info, Workflows — those are where a brand is CHANGED;
 *   - credit alerts, the onboarding tour, the referral card, the support button —
 *     all of them speak to the account holder.
 *
 * The trackers are gone too (auth events, purchase attribution, activity): they
 * attribute behaviour to a signed-in user, and there is none.
 */

const NAV = [
  { id: "overview", label: "Overview", suffix: "", exact: true },
  { id: "leads", label: "Leads", suffix: "/audiences/leads", exact: false },
  { id: "audiences", label: "Audiences", suffix: "/audiences", exact: true },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  overview: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h4v8H3v-8zM10 3h4v18h-4V3zM17 9h4v12h-4V9z" />
    </svg>
  ),
  leads: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  audiences: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

function ShareBrandBlock({ share }: { share: ShareModeValue }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-4 border-b border-gray-200 ${CHROME_ROW_HEIGHT}`}
    >
      <BrandLogo
        domain={share.brandDomain}
        size={24}
        className="rounded shrink-0"
        fallbackClassName="text-gray-400 shrink-0"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{share.brandName}</p>
        {share.brandDomain && (
          <p className="truncate text-[10px] text-gray-500">{share.brandDomain}</p>
        )}
      </div>
    </div>
  );
}

function ShareSidebar({ share }: { share: ShareModeValue }) {
  const pathname = usePathname();
  const base = shareBrandBasePath(share.token, share.orgId, share.brandId);

  return (
    <aside className="h-full w-56 max-w-[85vw] flex-shrink-0 flex-col border-r border-gray-200 bg-white flex">
      <ShareBrandBlock share={share} />
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const href = `${base}${item.suffix}`;
          const isActive = item.exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={item.id}
              href={href}
              className={`flex min-w-0 items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition ${
                isActive
                  ? "bg-brand-50 text-brand-700 font-medium border border-brand-200"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <span
                className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-gray-400"}`}
              >
                {ICONS[item.id]}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {/* States what this is, so a reader does not take a missing control for a
          missing feature, and the brand owner is not surprised by what a
          recipient can do. */}
      <div className="border-t border-gray-100 p-3">
        <p className="text-[10px] leading-relaxed text-gray-400">
          A read-only view shared by {share.brandName}. Nothing here can be changed.
        </p>
      </div>
    </aside>
  );
}

function ShareHeader({ share }: { share: ShareModeValue }) {
  const { toggle } = useMobileSidebar();
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className={`px-4 flex items-center justify-between ${CHROME_ROW_HEIGHT}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={toggle}
            aria-label="Open navigation"
            className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="md:hidden truncate text-sm font-medium text-gray-900">
            {share.brandName}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
          View only
        </span>
      </div>
    </header>
  );
}

function ShareBody({ share, children }: { share: ShareModeValue; children: React.ReactNode }) {
  const { isOpen, close } = useMobileSidebar();
  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={close} />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ShareSidebar share={share} />
      </div>
      <div className="hidden md:flex h-full">
        <ShareSidebar share={share} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ShareHeader share={share} />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export function ShareShell({
  share,
  children,
}: {
  share: ShareModeValue;
  children: React.ReactNode;
}) {
  return (
    <ShareModeProvider value={share}>
      {/* `scope="share"` keeps this tree's cache under the credential rather than
          under a Clerk org — there is no active org here, and reusing the org
          bucket would let a signed-in visitor's own cache and the shared brand's
          share one key space. */}
      <QueryProvider scope="share" shareToken={share.token}>
        <MobileSidebarProvider>
          <FeaturesProvider>
            <EntityRegistryProvider>
              <ShareBody share={share}>{children}</ShareBody>
            </EntityRegistryProvider>
          </FeaturesProvider>
        </MobileSidebarProvider>
      </QueryProvider>
    </ShareModeProvider>
  );
}
