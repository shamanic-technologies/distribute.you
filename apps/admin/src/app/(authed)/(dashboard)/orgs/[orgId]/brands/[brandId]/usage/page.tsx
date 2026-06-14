"use client";

import { useParams } from "next/navigation";
import { BrandUsageSection } from "@/components/brand-usage";

export default function BrandUsagePage() {
  const params = useParams();
  const brandId = params.brandId as string;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <BrandUsageSection brandId={brandId} />
    </div>
  );
}
