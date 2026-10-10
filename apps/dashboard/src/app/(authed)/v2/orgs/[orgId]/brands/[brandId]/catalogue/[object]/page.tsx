"use client";

import { notFound, useParams } from "next/navigation";
import { StaffOnly } from "@/components/v2/staff-only";
import { CatalogueOverviewPage } from "@/components/v2/staff-catalogue-pages";
import { StaffCampaignsOverviewPage } from "@/components/v2/staff-campaign-pages";
import { isCatalogueObject } from "@/lib/staff-catalogue";

/** A business object's overview (staff mode only): `/catalogue/steps`, `/catalogue/pipes`, ..., `/catalogue/campaigns` */
export default function CatalogueOverviewRoute() {
  const { object } = useParams<{ object: string }>();
  // Campaigns (owner 2026-10-10): campaign-service's sales funnel campaigns, not a catalogue object.
  if (object === "campaigns") {
    return (
      <StaffOnly>
        <StaffCampaignsOverviewPage />
      </StaffOnly>
    );
  }
  if (!isCatalogueObject(object)) notFound();
  return (
    <StaffOnly>
      <CatalogueOverviewPage object={object} />
    </StaffOnly>
  );
}
