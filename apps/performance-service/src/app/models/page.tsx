import type { Metadata } from "next";
import { URLS } from "@mcpfactory/content";
import { fetchLeaderboard } from "@/lib/fetch-leaderboard";
import { ModelLeaderboard } from "@/components/leaderboard-table";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Model Leaderboard",
  description:
    "Compare AI models head-to-head. Which model writes the most effective cold emails? Open rates, replies, and cost per action.",
  openGraph: {
    title: "Model Leaderboard — MCP Factory Performance",
    description:
      "Compare AI models by real cold email campaign performance. Which model generates the best open rates, replies, and conversions?",
    url: `${URLS.performance}/models`,
  },
  alternates: {
    canonical: `${URLS.performance}/models`,
  },
};

export default async function ModelsPage() {
  const data = await fetchLeaderboard();
  const models = data?.models || [];

  return (
    <main className="min-h-screen bg-white">
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl font-bold mb-2 text-gray-800">
            Model Leaderboard
          </h1>
          <p className="text-gray-600 mb-8">
            Compare AI models by real campaign performance.
            Which model generates emails that get the most opens, visits, and replies?
          </p>

          {models.length > 0 ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <ModelLeaderboard models={models} />
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">
                Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "hourly"}.
                All data from real campaigns.
              </p>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500">No model data yet. Check back soon.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
