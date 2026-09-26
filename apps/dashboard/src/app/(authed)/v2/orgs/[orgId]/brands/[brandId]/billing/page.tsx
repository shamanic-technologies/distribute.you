"use client";

import BillingPage from "@/app/(authed)/(dashboard)/orgs/[orgId]/billing/page";
import { V2AccountFrame } from "@/components/v2/setup-pages";

/** v1 Billing, whole, in the v2 frame: the money pages are not rewritten. */
export default function Page() {
  return (
    <V2AccountFrame label="Billing">
      <BillingPage />
    </V2AccountFrame>
  );
}
