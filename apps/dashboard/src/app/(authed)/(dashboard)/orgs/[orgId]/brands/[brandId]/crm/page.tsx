"use client";

import { useParams } from "next/navigation";
import { BrandCrmPage } from "@/components/crm/brand-crm-page";

export default function BrandCrmRoute() {
  const params = useParams();
  return <BrandCrmPage brandId={params.brandId as string} />;
}
