"use client";

import { useSearchParams } from "next/navigation";
import { Onboarding } from "@/components/onboarding/onboarding";
import { useIsAdminUser } from "@/lib/use-admin-user";

// The stepped onboarding flow (ported from the app.distribute.you mockup — animated
// build sequence + strategy review → straight into the brand launch flow) is GA:
// every signup gets it. (Previously allowlist-gated; gate dropped per the beta→GA
// graduation rule. The old DefaultOnboarding component is retired from this route.)
//
// Staff additionally get the "v2" preview, which runs IN PARALLEL with GA rather than
// replacing it: audiences come before the sales funnels, the brand states every funnel
// it sells through and which one we start on, and the detail of each funnel is
// collected after payment. Gated on the staff allowlist (`useIsAdminUser`), which in
// the dashboard is a UI-visibility gate over the viewer's OWN org data, never a
// security boundary — and this flow reads and writes only that viewer's own brand.
//
// `?flow=ga` forces the customer flow for a staff member. Without it a staff member
// would never again see what a real customer sees, which is the thing they most need
// to be able to check.
export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const isStaff = useIsAdminUser();
  const forceGa = searchParams.get("flow") === "ga";
  return <Onboarding variant={isStaff && !forceGa ? "v2" : "ga"} />;
}
