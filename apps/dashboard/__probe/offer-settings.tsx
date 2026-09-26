import "./fetchstub";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeaturesProvider } from "@/lib/features-context";
import { OfferCampaignsCard } from "@/components/settings/offer-campaigns-card";
const B = "75d7e3e8-6926-4f85-a557-976895400666";
const O = "d5ecba00-783a-4939-b5bd-f85b9e6b7d9e";
(globalThis as any).__pathname = `/orgs/b645207b-d8e9-40b0-9391-072b777cd9a9/brands/${B}/offers/${O}/settings`;
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <FeaturesProvider>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <h1 className="mb-8 text-2xl font-semibold text-gray-900">Offer Settings</h1>
        <OfferCampaignsCard brandId={B} offerId={O} />
      </div>
    </FeaturesProvider>
  </QueryClientProvider>,
);
