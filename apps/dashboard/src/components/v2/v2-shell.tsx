"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import {
  Squares2X2Icon,
  InboxIcon,
  BriefcaseIcon,
  Cog6ToothIcon,
  LinkIcon,
  CreditCardIcon,
  ArrowUturnLeftIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { MaturityBadge } from "@/components/maturity-badge";
import { backToV1Href, switchUiVersion } from "@/components/ui-version-switch";
import { useMissions } from "@/components/v2/use-missions";
import { crewInitial } from "@/lib/v2/crews";
import { v2DashboardHref } from "@/lib/ui-version";

/**
 * The v2 chrome: ONE sidebar level, Keel's frame.
 *
 * The page sits in a white panel inset on a warm grey frame, and the sidebar lives on
 * the frame itself, with no border of its own. Sections follow Explee's order
 * (Dashboard, Mailbox, Setup, then the work itself), and the work is named in our
 * vocabulary: CREW (a leg performed through a channel) and MISSIONS (a crew on an
 * offer). Every link points at a page that exists: the v2 page where one is built,
 * the v1 equivalent where it is not yet.
 */
export function V2Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // A navigation closes the drawer, wherever it was started from.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex h-[100dvh] bg-[#f6f6f5] text-gray-900">
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)} />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#f6f6f5] transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <V2Sidebar onClose={() => setOpen(false)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
            className="-ml-1 rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium">distribute.you</span>
          <MaturityBadge level="beta" />
        </div>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white md:rounded-xl md:border md:border-gray-200">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
  trailing,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={`flex h-8 min-w-0 items-center gap-2.5 rounded-md px-2 text-[13px] transition ${
        active ? "bg-gray-200/70 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-200/40 hover:text-gray-900"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="mt-5 mb-1 px-2 text-xs font-medium text-gray-400">{children}</h4>;
}

function V2Sidebar({ onClose }: { onClose: () => void }) {
  const params = useParams<{ orgId?: string; brandId?: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgId = params.orgId ?? "";
  const brandId = params.brandId ?? "";
  const { missions, crews } = useMissions(orgId, brandId);

  const v1 = `/orgs/${encodeURIComponent(orgId)}`;
  const v1Brand = `${v1}/brands/${encodeURIComponent(brandId)}`;
  const dashboard = brandId ? v2DashboardHref(orgId, brandId) : v1;
  const activeCrew = searchParams.get("crew");
  const onDashboard = pathname === dashboard && !activeCrew;

  return (
    <aside className="flex h-full flex-col">
      <div className="flex items-start gap-1 px-2 pt-2">
        <div className="min-w-0 flex-1">
          <TenantSwitcher />
        </div>
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="mt-3 rounded-md p-1.5 text-gray-500 hover:bg-gray-200/60 md:hidden"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-3">
        {brandId && (
          <>
            <NavLink href={dashboard} icon={<Squares2X2Icon className="h-4 w-4" />} label="Dashboard" active={onDashboard} />

            <SectionHeading>Mailbox</SectionHeading>
            <NavLink href={`${v1Brand}/leads`} icon={<InboxIcon className="h-4 w-4" />} label="Inbox" />

            <SectionHeading>Setup</SectionHeading>
            <NavLink href={`${v1Brand}/offers`} icon={<BriefcaseIcon className="h-4 w-4" />} label="Offers" />
            <NavLink href={`${v1Brand}/crm`} icon={<LinkIcon className="h-4 w-4" />} label="Integrations" />
            <NavLink href={`${v1Brand}/settings`} icon={<Cog6ToothIcon className="h-4 w-4" />} label="Brand settings" />
            <NavLink href={`${v1}/billing`} icon={<CreditCardIcon className="h-4 w-4" />} label="Billing" />

            {crews.length > 0 && (
              <>
                <SectionHeading>Crew</SectionHeading>
                {crews.map((c) => (
                  <NavLink
                    key={c.crew.key}
                    href={`${dashboard}?crew=${encodeURIComponent(c.crew.key)}`}
                    active={activeCrew === c.crew.key}
                    icon={
                      <span className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-semibold ${c.crew.tone}`}>
                        {crewInitial(c.crew.name)}
                      </span>
                    }
                    label={c.crew.name}
                    trailing={
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.running > 0 ? "bg-green-500" : "bg-gray-300"}`}
                        title={c.running > 0 ? `${c.running} running` : "Paused"}
                      />
                    }
                  />
                ))}
              </>
            )}

            {missions.length > 0 && (
              <>
                <SectionHeading>Missions</SectionHeading>
                {missions.map((m) => (
                  <NavLink
                    key={m.row.campaign.id}
                    href={m.href}
                    icon={
                      <span className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-semibold ${m.crew.tone}`}>
                        {crewInitial(m.crew.name)}
                      </span>
                    }
                    label={m.offerName ? `${m.crew.name} · ${m.offerName}` : m.crew.name}
                  />
                ))}
              </>
            )}
          </>
        )}
      </nav>
      <div className="border-t border-gray-200 px-2 py-2">
        <button
          type="button"
          onClick={() => switchUiVersion("v1", backToV1Href(orgId, brandId || null))}
          className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-gray-600 transition hover:bg-gray-200/40 hover:text-gray-900"
        >
          <ArrowUturnLeftIcon className="h-4 w-4 text-gray-500" />
          <span className="flex-1 text-left">Back to v1</span>
          <MaturityBadge level="beta" />
        </button>
      </div>
    </aside>
  );
}
