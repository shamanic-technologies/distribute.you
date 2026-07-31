"use client";

import { useSearchParams } from "next/navigation";
import { Onboarding } from "@/components/onboarding/onboarding";
import { useIsBetaUser } from "@/lib/use-beta-user";

// The stepped onboarding flow (ported from the app.distribute.you mockup — animated
// build sequence + strategy review → straight into the brand launch flow) is GA:
// every signup gets it. (Previously allowlist-gated; gate dropped per the beta→GA
// graduation rule. The old DefaultOnboarding component is retired from this route.)
//
// The "v2" preview runs IN PARALLEL with GA rather than replacing it: audiences come
// before the sales funnels, the brand states every funnel it sells through and which
// one we start on, and the detail of each funnel is collected after payment.
//
// Gated on the BETA allowlist (`beta-allowlist.ts`), which is the documented mechanism
// for a dashboard surface shipping to a small set of people — NOT on the staff
// allowlist. The two are not interchangeable: `isAdminEmail` is the primary security
// boundary on `/api/admin/*` here (the god-mode org switcher, which can enumerate and
// join every tenant on the platform), so putting a preview behind it means anyone added
// for the preview also gets cross-tenant god-mode. This flow only ever reads and writes
// the viewer's own brand, so it belongs behind the gate that grants nothing else.
//
// `?flow=ga` forces the customer flow. Without it a beta user would never again see
// what a real customer sees, which is the thing they most need to be able to check.
export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const canPreview = useIsBetaUser();
  const forceGa = searchParams.get("flow") === "ga";
  return <Onboarding variant={canPreview && !forceGa ? "v2" : "ga"} />;
}
