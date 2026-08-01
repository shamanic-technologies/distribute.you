"use client";

import { Onboarding } from "@/components/onboarding/onboarding";

// The onboarding flow every signup gets. It is built around the SALES FUNNELS a
// brand sells through: services, audiences, then every funnel it sells through and
// which one we start on, then payment, then the detail of each funnel.
//
// It ran behind the beta allowlist while brand-service had nowhere to put the
// per-funnel economics. It does now (`PUT /v1/brands/:id/sales-funnels` and its
// per-funnel sibling), so the gate is gone — and so is the parallel customer flow
// it used to run beside, which asked for ONE click destination, ONE goal and ONE
// set of rates. That is the brand-level model the funnels replaced, and keeping it
// reachable would have asked half our signups a question the product no longer has
// a single answer to.
export default function OnboardingPage() {
  return <Onboarding />;
}
