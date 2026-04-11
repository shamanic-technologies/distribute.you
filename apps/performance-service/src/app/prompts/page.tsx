import type { Metadata } from "next";
import { URLS } from "@distribute/content";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Prompt Leaderboard",
  description:
    "Coming soon: compare prompt versions and see which ones generate the most effective cold emails.",
  openGraph: {
    title: "Prompt Leaderboard — distribute Performance",
    description:
      "Coming soon: compare prompt versions and see which ones generate the most effective cold emails.",
    url: `${URLS.performance}/prompts`,
  },
  alternates: {
    canonical: `${URLS.performance}/prompts`,
  },
};

export default function PromptsPage() {
  return (
    <main className="min-h-screen bg-white">
      <ComingSoon
        title="Prompt Leaderboard"
        description="We're building prompt versioning to track how different email generation prompts perform over time. You'll be able to see which prompt versions produce the highest open rates, reply rates, and conversions."
      />
    </main>
  );
}
