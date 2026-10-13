"use client";

import { useEffect, useState } from "react";
import { offerArm, type OfferArm } from "./subscription-plan";

/**
 * The offer the homepage A/B test sold this visitor (owner 2026-10-13: subscription,
 * prepaid or postpaid), once mounted. `prepaid` on the server render and the first client
 * frame: the cookie is not read there, so the prepaid words paint first and never
 * mismatch hydration.
 */
export function useOfferArm(): OfferArm {
  const [arm, setArm] = useState<OfferArm>("prepaid");
  useEffect(() => {
    setArm(offerArm(document.cookie));
  }, []);
  return arm;
}

/** True once mounted when the visitor is in the $99/month arm (`lp_variant=subscription`). */
export function useSubscriptionArm(): boolean {
  return useOfferArm() === "subscription";
}
