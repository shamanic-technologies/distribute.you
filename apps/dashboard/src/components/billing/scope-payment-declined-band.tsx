"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignsByBrand } from "@/lib/api";
import { scopePaymentHold } from "@/lib/payment-declined";
import { PaymentDeclinedNotice } from "@/components/billing/payment-declined-notice";

/**
 * The payment notice (declined card, or no card) at the top of a brand, offer or
 * campaign Overview.
 *
 * Reads `["campaigns", brandId]`, the key the campaigns table and the controls
 * trigger already poll on these pages, so it costs no request. Renders nothing
 * until that read settles and nothing unless `scopePaymentHold` names a kind for
 * the scope: a campaign stopped over payment, and none running.
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
  const kind = scopePaymentHold(campaigns);
  if (!kind) return null;
  return <PaymentDeclinedNotice kind={kind} />;
}
