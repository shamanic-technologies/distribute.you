"use client";

import { useParams } from "next/navigation";
import { CrmMergedPage } from "@/components/crm/crm-merged-page";

export default function BrandCrmMergedRoute() {
  const params = useParams();
  return <CrmMergedPage brandId={params.brandId as string} />;
}
