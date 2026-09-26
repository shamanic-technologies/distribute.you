"use client";

import { usePathname } from "next/navigation";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "@/components/maturity-badge";
import { brandIdFromPathname } from "@/lib/brand-tint-preload";
import {
  stripV2Prefix,
  uiVersionCookieAssignment,
  v1BrandHref,
  v2DashboardHref,
  type UiVersion,
} from "@/lib/ui-version";

/**
 * Write the version choice, then go where it lands.
 *
 * A full navigation rather than `router.push`: the choice is read at the edge, and
 * a document load is the one navigation guaranteed to carry the cookie we just
 * wrote through the middleware that honours it.
 */
export function switchUiVersion(version: UiVersion, href: string): void {
  document.cookie = uiVersionCookieAssignment(version, window.location.protocol === "https:");
  window.location.assign(href);
}

function orgIdFrom(pathname: string): string | null {
  const parts = stripV2Prefix(pathname).split("/").filter(Boolean);
  return parts[0] === "orgs" && parts[1] ? parts[1] : null;
}

/**
 * "Try the new dashboard", at the bottom of the v1 sidebar. Beta users only, and it
 * wears the beta badge so nobody reads v2 as shipped.
 *
 * On a brand page it goes straight to that brand's v2 Dashboard; elsewhere it goes to
 * the org, which the edge resolves to the last brand's v2 Dashboard.
 */
export function SwitchToV2() {
  const isBeta = useIsBetaUser();
  const pathname = usePathname();
  if (!isBeta) return null;
  const orgId = orgIdFrom(pathname);
  if (!orgId) return null;
  const brandId = brandIdFromPathname(pathname);
  const href = brandId ? v2DashboardHref(orgId, brandId) : `/orgs/${encodeURIComponent(orgId)}`;
  return (
    <div className="border-t border-gray-100 p-2">
      <button
        type="button"
        onClick={() => switchUiVersion("v2", href)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
      >
        <span className="min-w-0 flex-1 truncate text-left">Switch to v2</span>
        <MaturityBadge level="beta" />
      </button>
    </div>
  );
}

/** "Back to v1", in the v2 sidebar. Lands on the same brand's v1 Overview. */
export function backToV1Href(orgId: string, brandId: string | null): string {
  return brandId ? v1BrandHref(orgId, brandId) : `/orgs/${encodeURIComponent(orgId)}`;
}
