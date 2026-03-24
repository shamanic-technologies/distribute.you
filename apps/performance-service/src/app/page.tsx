import { URLS } from "@distribute/content";
import { fetchLeaderboard } from "@/lib/fetch-leaderboard";
import { CategorySection } from "@/components/category-section";

export const revalidate = 300;

export default async function HomePage() {
  const data = await fetchLeaderboard();
  const sections = data?.categorySections || [];

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="py-12 md:py-16 px-4 gradient-bg">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-emerald-200">
            100% Transparent
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-800">
            Real Performance, <span className="gradient-text">Real Data</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every metric from every campaign. No cherry-picking, no hidden numbers.
          </p>
        </div>
      </section>

      {/* Category sections */}
      {sections.length > 0 ? (
        <div className="bg-white">
          {sections.map((section) => (
            <CategorySection key={section.featureSlug} section={section} />
          ))}
          <p className="text-xs text-gray-400 text-center pb-6">
            Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : "hourly"}.{" "}
            <a href={URLS.github} className="underline hover:text-gray-600">
              Methodology is open source.
            </a>
          </p>
        </div>
      ) : (
        <section className="py-16 px-4">
          <p className="text-center text-gray-500">
            Performance data will appear here as campaigns run. Check back soon.
          </p>
        </section>
      )}

      {/* Why transparency */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl font-bold mb-4 text-gray-800">
            Why We Publish Everything
          </h2>
          <p className="text-gray-600 mb-6">
            Most outreach platforms hide their real numbers. We don&apos;t.
            Every campaign that runs through distribute contributes to these public leaderboards.
            This means you can make informed decisions based on real data, not marketing claims.
          </p>
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            <a
              href={URLS.signUp}
              className="px-6 py-3 bg-brand-500 text-white rounded-full hover:bg-brand-600 transition font-medium"
            >
              Start a Campaign
            </a>
            <a
              href={URLS.docs}
              className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-full hover:border-brand-300 transition font-medium"
            >
              Read the Docs
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
