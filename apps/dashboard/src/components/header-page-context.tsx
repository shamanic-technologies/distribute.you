"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCampaign, optimizationGoalForRuntimeGoal } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { CampaignTitle } from "@/components/campaigns/campaign-title";

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

  const campaign = data?.campaign ?? null;
  // The bar fetches ONE campaign and no brand, so there is no inherited brand
  // goal in hand here. A campaign that carries its own funnel key never needs
  // one; one that does not simply goes unstated on the funnel half rather than
  // being guessed from a goal we did not read.
  const fallbackGoal = campaign?.goal ? optimizationGoalForRuntimeGoal(campaign.goal) : null;

  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Page context">
      <Link
        href={listPath}
        className="hidden shrink-0 text-gray-400 transition hover:text-gray-600 sm:inline"
      >
        Campaigns
      </Link>
      <span className="hidden shrink-0 text-gray-300 sm:inline">/</span>
      {/* The title arrives a beat after the route does. A skeleton bar keeps the
          row from jumping, and a placeholder word would state a name we do not
          have yet. */}
      {campaign ? (
        <CampaignTitle
          campaign={campaign}
          fallbackGoal={fallbackGoal}
          size="sm"
          className="font-medium text-gray-800"
        />
      ) : (
        <span className="h-4 w-28 animate-pulse rounded bg-gray-100" />
      )}
    </nav>
  );
}
