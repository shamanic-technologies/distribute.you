"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignsByBrand } from "@/lib/api";

/**
 * Per-brand onboarding-completeness gate.
 *
 * The edge onboarding gate (`proxy.ts`, DIS-111) is ORG-scoped: once an org has
 * completed onboarding once (`orgMeta.onboardingComplete === true`), it opens EVERY
 * `/orgs/:id/brands/:brandId` URL in the org — it does ZERO per-brand fetch (routing
 * is JWT-claims-only). So a brand created via "Add brand" (`/onboarding?from=add`)
 * but ABANDONED before the terminal budget/launch step is still reachable: the brand
 * row exists (created early, at the loading step, to prefill services), but the
 * campaign — created only at the terminal `launch()` — never was. The result is a
 * half-built dashboard (no campaign, no budget, no active audience) the edge can't
 * catch.
 *
 * This client gate closes that hole. A brand with ZERO campaigns never finished
 * onboarding → bounce it back to resume the flow (`?brandId=` re-hydrates the brand
 * from backend and lands on the goal step, everything before it prefilled). A
 * finished brand has exactly one campaign (one subscription per brand, #1768) →
 * never redirects, so god-mode / existing brands are unaffected.
 *
 * Fail-soft, matching the not-found-gate discipline: redirect ONLY once the query
 * has SETTLED empty (`!isPending && !isError && length === 0`). Never on `isPending`
 * (org-consistency gate / cold load) nor `isError` (a cold/failed campaign-service
 * read must not bounce a complete brand). Renders nothing.
 */
export function BrandSetupGate() {
  const router = useRouter();
  const params = useParams();
  const brandId = typeof params.brandId === "string" ? params.brandId : null;

  const { data, isPending, isError } = useAuthQuery(
    ["campaigns", brandId],
    () => listCampaignsByBrand(brandId as string),
    { enabled: !!brandId },
  );

  const incomplete =
    !isPending && !isError && (data?.campaigns.length ?? 0) === 0;

  useEffect(() => {
    if (brandId && incomplete) {
      router.replace(`/onboarding?from=add&brandId=${brandId}`);
    }
  }, [brandId, incomplete, router]);

  return null;
}
