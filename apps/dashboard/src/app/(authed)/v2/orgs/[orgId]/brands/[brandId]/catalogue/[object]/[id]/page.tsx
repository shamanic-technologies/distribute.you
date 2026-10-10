"use client";

import { notFound, useParams } from "next/navigation";
import { StaffOnly } from "@/components/v2/staff-only";
import { CatalogueObjectPage } from "@/components/v2/staff-catalogue-pages";
import { StaffFunnelCampaignPage } from "@/components/v2/staff-campaign-pages";
import { isCatalogueObject } from "@/lib/staff-catalogue";

/** The id is one encoded segment (`|`, `+`, `@`); decoded once, tolerating a raw one. */
function decodeId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** One business object's page (staff mode only). */
export default function CatalogueObjectRoute() {
  const { object, id } = useParams<{ object: string; id: string }>();
  if (object === "campaigns") {
    return (
      <StaffOnly>
        <StaffFunnelCampaignPage key={id} id={decodeId(id)} />
      </StaffOnly>
    );
  }
  if (!isCatalogueObject(object)) notFound();
  return (
    <StaffOnly>
      <CatalogueObjectPage key={id} object={object} id={decodeId(id)} />
    </StaffOnly>
  );
}
