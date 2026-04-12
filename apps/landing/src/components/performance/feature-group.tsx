import { SectionLeaderboard } from "./section-leaderboard";
import type { FeatureGroupData } from "@/lib/performance/fetch-leaderboard";

export function FeatureGroup({
  section,
  maxEntries = 3,
}: {
  section: FeatureGroupData;
  maxEntries?: number;
}) {
  return (
    <section className="py-10 px-4 border-b border-gray-100 last:border-b-0">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-display text-xl font-bold mb-4 text-gray-800">
          {section.label}
        </h2>
        <SectionLeaderboard
          brands={section.brands}
          workflows={section.workflows}
          maxEntries={maxEntries}
        />
      </div>
    </section>
  );
}
