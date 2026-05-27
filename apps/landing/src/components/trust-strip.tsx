import { ProviderAvatar } from "@/components/provider-avatar";
import type { TrustStripBrand } from "@/lib/invites/trust-strip-brands";

interface TrustStripProps {
  brands: TrustStripBrand[];
}

export function TrustStrip({ brands }: TrustStripProps) {
  if (brands.length === 0) {
    return null;
  }
  return (
    <div className="mt-12 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">
        {brands.length}+ brands already on distribute
      </p>
      <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3 opacity-70">
        {brands.map((brand) => (
          <ProviderAvatar
            key={brand.domain}
            provider={brand.name}
            providerDomain={brand.domain}
            size={28}
          />
        ))}
      </div>
    </div>
  );
}
