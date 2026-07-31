"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCampaign } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";

// The one thing the top bar names besides the account: WHICH campaign you are
// looking at.
//
// Tenant identity (org, brand) stays in the sidebar switcher — a breadcrumb of
// the hierarchy would restate what the switcher already shows. A campaign is not
// tenant identity though: several sit under one brand and the sidebar carries no
// name for the one you drilled into, so without this the bar says nothing about
// where you are.
//
// It renders on `.../brands/[brandId]/campaigns/[id]` and nowhere else. The query
// key is byte-equal to the campaign overview's, so React Query serves both from
// one poll.

/** The campaign id in the path, or null when this is not a campaign route. */
export function campaignIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  // orgs / :orgId / brands / :brandId / campaigns / :id
  if (parts[0] !== "orgs" || parts[2] !== "brands" || parts[4] !== "campaigns") return null;
  return parts[5] ?? null;
}

/** The campaigns-list path for the brand the given campaign route sits under. */
export function campaignsListPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (!campaignIdFromPath(pathname)) return null;
  return `/orgs/${parts[1]}/brands/${parts[3]}/campaigns`;
}

export function HeaderPageContext() {
  const pathname = usePathname() ?? "";
  const campaignId = campaignIdFromPath(pathname);
  const listPath = campaignsListPath(pathname);

  const { data } = useAuthQuery(
    ["campaign", campaignId ?? "none"],
    () => getCampaign(campaignId as string),
    { enabled: campaignId !== null, ...pollOptions },
  );

  if (!campaignId || !listPath) return null;

  const name = data?.campaign?.name;

  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Page context">
      <Link
        href={listPath}
        className="hidden shrink-0 text-gray-400 transition hover:text-gray-600 sm:inline"
      >
        Campaigns
      </Link>
      <span className="hidden shrink-0 text-gray-300 sm:inline">/</span>
      {/* The name arrives a beat after the route does. A skeleton bar keeps the
          row from jumping, and a placeholder word would state a name we do not
          have yet. */}
      {name ? (
        <span className="truncate font-medium text-gray-800">{name}</span>
      ) : (
        <span className="h-4 w-28 animate-pulse rounded bg-gray-100" />
      )}
    </nav>
  );
}
