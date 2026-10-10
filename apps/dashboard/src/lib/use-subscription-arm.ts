"use client";

import { useEffect, useState } from "react";
import { isSubscriptionArm } from "./subscription-plan";

/**
 * True once mounted when the homepage A/B test put this visitor in the $99/month arm
 * (`lp_variant=subscription`, owner 2026-10-10). False on the server render and the
 * first client frame: the cookie is not read there, so the prepaid words paint first
 * and never mismatch hydration.
 */
export function useSubscriptionArm(): boolean {
  const [plan, setPlan] = useState(false);
  useEffect(() => {
    setPlan(isSubscriptionArm(document.cookie));
  }, []);
  return plan;
}
