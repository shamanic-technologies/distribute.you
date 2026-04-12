import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { fetchLeaderboard } from "@/lib/performance/fetch-leaderboard";
import { BrandLeaderboard } from "@/components/performance/leaderboard-table";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Brand Leaderboard",
  description:
    "See how each brand performs with distribute cold email campaigns. Open rates, website visits, replies, and cost per action.",
  openGraph: {
    title: "Brand Leaderboard — distribute Performance",
    description:
      "Compare brand performance across distribute cold email campaigns. Real open rates, visit rates, reply rates, and cost per action.",
    url: `${PROD_URLS.landing}/performance/brands`,
  },
  alternates: {
    canonical: `${PROD_URLS.landing}/performance/brands`,
  },
};

export default async function BrandsPage() {
  const data = await fetchLeaderboard();
  const brands = data?.brands || [];

  return (
    <main className="min-h-screen bg-white">
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl font-bold mb-2 text-gray-800">
            Brand Leaderboard
          </h1>
          <p className="text-gray-600 mb-8">
            Performance data for every brand running campaigns through distribute.
            Click column headers to sort.
          </p>

          {brands.length > 0 ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <BrandLeaderboard brands={brands} />
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">
                Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "hourly"}.
                Brands are opted-in by default.
              </p>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500">No campaign data yet. Check back soon.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
