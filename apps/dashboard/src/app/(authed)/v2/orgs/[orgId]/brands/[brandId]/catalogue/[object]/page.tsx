"use client";

import { notFound, useParams } from "next/navigation";
import { StaffOnly } from "@/components/v2/staff-only";
import { CatalogueOverviewPage } from "@/components/v2/staff-catalogue-pages";
import { isCatalogueObject } from "@/lib/staff-catalogue";

/** A business object's overview (staff mode only): `/catalogue/steps`, `/catalogue/pipes`, ... */
export default function CatalogueOverviewRoute() {
  const { object } = useParams<{ object: string }>();
  if (!isCatalogueObject(object)) notFound();
  return (
    <StaffOnly>
      <CatalogueOverviewPage object={object} />
    </StaffOnly>
  );
}
