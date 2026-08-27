"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { BrandSalesFunnelsCard } from "@/components/settings/brand-sales-funnels-card";
import { campaignFunnel } from "@/lib/campaign-funnel";
import type { SalesFunnelKeyWire } from "@/lib/sales-funnels";

/**
 * A sales funnel's settings.
 *
 * What a funnel IS — its conversion rates, its lifetime revenue, its landing pages —
 * is stated per BRAND, because the same funnel converts at the same rates whichever
 * offer sells through it. So this renders the brand's own funnels card rather than a
 * second editor: two editors for one stored value is how they come to disagree, and
 * the card is already the one place that writes it.
 *
 * The heading says whose settings these are, so nobody reads a brand-wide edit as a
 * change to this funnel under this offer alone.
 */
export function FunnelSettingsPage() {
  const params = useParams<{ orgId: string; brandId: string; offerId: string; funnelKey: string }>();
  const orgId = params?.orgId ?? "";
  const brandId = params?.brandId ?? "";
  const offerId = params?.offerId ?? "";
  const funnelKey = params?.funnelKey ? decodeURIComponent(params.funnelKey) : "";
  const def = funnelKey ? campaignFunnel(funnelKey as SalesFunnelKeyWire) : null;
  const funnelPath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}/funnels/${params?.funnelKey ?? ""}`;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <Link href={funnelPath} className="text-sm text-brand-600 hover:underline">
          {def?.name ?? funnelKey}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Sales Funnel Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          How this brand sells, and what it funds each way at. A funnel converts at the
          same rates whichever offer sells through it, so these are the brand’s and an
          edit here reaches every offer.
        </p>
      </header>

      <BrandSalesFunnelsCard brandId={brandId} offerId={offerId} />
    </div>
  );
}
