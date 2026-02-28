import type { Metadata } from "next";
import { URLS } from "@mcpfactory/content";
import { fetchLeaderboard } from "@/lib/fetch-leaderboard";
import { WorkflowLeaderboardFiltered } from "@/components/workflow-leaderboard-filtered";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Workflow Leaderboard",
  description:
    "Compare outreach workflows head-to-head. Which workflow delivers the best results? Costs, runs, and performance metrics.",
  openGraph: {
    title: "Workflow Leaderboard — distribute Performance",
    description:
      "Compare outreach workflows by real campaign performance. Which workflow generates the best open rates, replies, and conversions?",
    url: `${URLS.performance}/models`,
  },
  alternates: {
    canonical: `${URLS.performance}/models`,
  },
};

export default async function WorkflowsPage() {
  const data = await fetchLeaderboard();
  const workflows = data?.workflows || [];
  const availableCategories = data?.availableCategories || [];

  return (
    <main className="min-h-screen bg-white">
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl font-bold mb-2 text-gray-800">
            Workflow Leaderboard
          </h1>
          <p className="text-gray-600 mb-8">
            Compare outreach workflows by real campaign performance.
            Which workflow delivers the best open rates, visits, and replies?
          </p>

          {workflows.length > 0 ? (
            <>
              <WorkflowLeaderboardFiltered
                workflows={workflows}
                availableCategories={availableCategories}
              />
              <p className="text-xs text-gray-400 mt-4 text-center">
                Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "hourly"}.
                All data from real campaigns.
              </p>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500">No workflow data yet. Check back soon.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
