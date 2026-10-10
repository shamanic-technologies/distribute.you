"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignsByBrand } from "@/lib/api";
import { scopeStoppedOverPayment } from "@/lib/payment-declined";
import { PaymentHoldNotice } from "@/components/billing/payment-declined-notice";

/**
 * The payment notice (declined card, or no card) at the top of a brand, offer or
 * campaign Overview.
 *
 * Reads `["campaigns", brandId]`, the key the campaigns table and the controls
 * trigger already poll on these pages, so it costs no request. When the scope was
 * stopped over payment (nothing runs, a campaign carries a payment stop reason),
 * `PaymentHoldNotice` asks billing whether the org is held NOW and speaks only if
 * it is: a stop reason is history, and an org that moved to prepaid or added a card
 * must never be told to add one (2026-10-10).
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
  if (!scopeStoppedOverPayment(campaigns)) return null;
  return <PaymentHoldNotice campaigns={campaigns} />;
}
