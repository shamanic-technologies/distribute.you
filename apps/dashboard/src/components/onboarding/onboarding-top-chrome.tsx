"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { OnboardingAccountWidget } from "@/components/onboarding/onboarding-account-widget";
import { explicitHierarchyHref } from "@/lib/last-brand";

/**
 * Top chrome for the onboarding flow — two modes, decided from the entry params.
 *
 * FIRST-RUN signup (no `?from=add` / `?new=1`): a focused, no-escape setup. Render
 * ONLY the account widget (sign out / switch account), exactly as before. There is
 * nothing to navigate back to yet, and the edge gate (proxy.ts, DIS-111) keeps an
 * incomplete org pinned on `/onboarding` regardless — so a deliberate "trap" is the
 * right UX here.
 *
 * EXISTING user adding a brand / org (`?from=add`, `?new=1`): they already have live
 * org×brand to return to, so trapping them is wrong. Multitenant-onboarding UX (Vercel
 * / Linear / Stripe) keeps the org/brand switcher + a clear exit visible during a
 * create flow — the create step is a layer ON TOP of the app, never a full-screen
 * takeover. Mount the dashboard breadcrumb (org→brand switcher = jump to any existing
 * tenant), a clickable logo, and a Cancel link (both → the dashboard, which resolves
 * to the last-visited brand via the `last-brand` cookie). The flow itself is unchanged
 * (#1985 "real flow" stays intact) — this only ADDS the escape hatch.
 *
 * Note: `BreadcrumbNav` needs only Clerk hooks (global `ClerkProvider`) + `fetch`, no
 * dashboard providers (OrgContext / Features / React Query), so it mounts here cleanly.
 * On `/onboarding` there is no `/orgs/:id` in the URL, so it renders the org switcher
 * (Dashboard ▾) with the user's memberships; the brand switcher appears once an org is
 * picked. The Cancel target works for `from=add` (active org stays the existing,
 * complete one); for `new=1` the reliable "go back" affordance is the org switcher.
 */
export function OnboardingTopChrome() {
  const params = useSearchParams();
  const isAddFlow = params.get("from") === "add" || params.get("new") === "1";

  if (!isAddFlow) {
    // First-run signup: keep the account widget (sign out / switch account —
    // the only escape from a wrong account) but do NOT float it. A `fixed`
    // corner widget overlays the step content and reads as a stray orphan on
    // mobile. Render a slim in-flow bar (shrink-0 in the layout column) that
    // sits above the step, right-aligned, and scrolls with the page.
    return (
      <header className="flex shrink-0 justify-end px-4 py-2.5">
        <OnboardingAccountWidget />
      </header>
    );
  }

  const dashboardHref = explicitHierarchyHref("/");

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-2.5 md:gap-4">
        <Link
          href={dashboardHref}
          className="flex items-center gap-2 border-r border-gray-200 pr-4"
        >
          <Image
            src="/logo-distribute.svg"
            alt="distribute"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span className="hidden font-display text-lg font-extrabold tracking-tight text-gray-900 sm:block">
            distribute
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <BreadcrumbNav />
        </div>

        <Link
          href={dashboardHref}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
        >
          <XMarkIcon className="h-4 w-4" />
          <span className="hidden sm:block">Cancel</span>
        </Link>

        <OnboardingAccountWidget />
      </div>
    </header>
  );
}
