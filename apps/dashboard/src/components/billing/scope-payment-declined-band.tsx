"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignsByBrand } from "@/lib/api";
import { scopeHeldByPayment } from "@/lib/payment-declined";
import { PaymentDeclinedNotice } from "@/components/billing/payment-declined-notice";

/**
 * The "payment declined" notice at the top of a brand, offer or campaign Overview.
 *
 * Reads `["campaigns", brandId]`, the key the campaigns table and the controls
 * trigger already poll on these pages, so it costs no request. Renders nothing
 * until that read settles and nothing unless `scopeHeldByPayment` holds for the
 * scope: a campaign stopped over a declined card, and none running.
 */
export function ScopePaymentDeclinedBand({
  brandId,
  offerId,
  campaignId,
}: {
  brandId: string;
  offerId?: string | null;
  campaignId?: string | null;
}) {
  const { data } = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId));
  const campaigns = (data?.campaigns ?? []).filter((c) => {
    if (campaignId) return c.id === campaignId;
    if (offerId) return c.offerId === offerId;
    return true;
  });
  if (!scopeHeldByPayment(campaigns)) return null;
  return <PaymentDeclinedNotice />;
}
