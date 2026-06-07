import { notFound } from "next/navigation";
import { fetchRankedOpportunitiesByBrand } from "@/lib/report-api";
import { PublicHitlQueue } from "@/components/report/public-hitl-queue";
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";

// Interactive page (HITL queue + draft generation + pitch submit) — do NOT
// cache the rendered HTML aggressively. ISR with a short window keeps the
// queue fresh for opens but the actual mutations always go through the
// dashboard Route Handlers at /api/report/{orgId}/{brandId}/{featureSlug}/{draft,reply}.
export const revalidate = 60;
export const maxDuration = 300;

// Only the PR-Expert quote family uses the opportunities surface. Any other
// featureSlug hitting this route is a 404 — the public report sidebar only
// renders the link for the HITL feature.

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

export default async function OpportunitiesPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;

  if (!isExpertQuoteFeature(featureSlug)) {
    notFound();
  }

  // Show the whole open queue, not a capped first page (500 covers the
  // realistic per-brand gold catalog; the authed surfaces page through fully).
  const opportunities = await fetchRankedOpportunitiesByBrand(orgId, brandId, 500);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold text-gray-800 mb-1">
          Quote Opportunities
        </h2>
        <p className="text-sm text-gray-500">
          Ranked queue of journalist quote requests matched against the brand.
          Click an opportunity to generate, edit and send a quote.
        </p>
      </div>

      <PublicHitlQueue
        orgId={orgId}
        brandId={brandId}
        featureSlug={featureSlug}
        initialOpportunities={opportunities}
      />
    </div>
  );
}
