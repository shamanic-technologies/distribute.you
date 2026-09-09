"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { NewOfferModal } from "@/components/offers/new-offer-modal";
import { OffersTable } from "@/components/offers/offers-table";
import { useSoleFeatureSlug } from "@/lib/sole-feature";

/**
 * The brand's offers, as a page of their own.
 *
 * The same table the brand Overview renders under its chart, given the whole
 * width — exactly the relationship the Campaigns page has with the offer
 * Overview. It is one COMPONENT in both places, never a second copy: two
 * renderings of the same list is how a row comes to read one way on the
 * Overview and another one click over.
 *
 * It carries no header tiles of its own. The Campaigns page has them because a
 * brand runs several channels and the tile names the best one; a brand's offers
 * have no equivalent single answer worth a tile, and the money that WOULD go
 * there (pipeline, ROI, CAC) is already stated on the Overview this page sits
 * beside. Printing it twice invites the two to disagree.
 */
export function OffersPage() {
  const params = useParams();
  const orgId = String(params.orgId);
  const brandId = String(params.brandId);
  const featureSlug = useSoleFeatureSlug();
  const brandPath = `/orgs/${orgId}/brands/${brandId}`;
  const [creating, setCreating] = useState(false);

  return (
    <DashboardPage width="wide">
      {/* The create control lives HERE and not in `OffersTable`, which is the same
          component the brand Overview renders under its chart. A button inside it
          would put a create action on a surface whose own doc says it carries none. */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Offers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Everything this brand sells. Each offer has its own funnels, audiences and
            campaigns, and returns its own number.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex-shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          New offer
        </button>
      </div>

      <OffersTable brandId={brandId} featureSlug={featureSlug} basePath={brandPath} />

      {creating && (
        <NewOfferModal
          brandId={brandId}
          offerBasePath={`${brandPath}/offers`}
          onClose={() => setCreating(false)}
        />
      )}
    </DashboardPage>
  );
}
