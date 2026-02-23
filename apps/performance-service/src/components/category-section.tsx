import { StatsBar } from "./stats-bar";
import { SectionLeaderboard } from "./section-leaderboard";
import type { CategorySectionData } from "@/lib/fetch-leaderboard";

export function CategorySection({
  section,
  maxEntries = 5,
}: {
  section: CategorySectionData;
  maxEntries?: number;
}) {
  return (
    <section className="py-10 px-4 border-b border-gray-100 last:border-b-0">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-display text-xl font-bold mb-4 text-gray-800">
          {section.label}
        </h2>
        <StatsBar stats={section.stats} />
        <div className="mt-6">
          <SectionLeaderboard
            brands={section.brands}
            workflows={section.workflows}
            maxEntries={maxEntries}
          />
        </div>
      </div>
    </section>
  );
}
