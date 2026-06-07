import type { WhyMattersSection as WhyMattersData } from "@/data/benchmarks-content";

export function WhyMattersSection({ data }: { data: WhyMattersData }) {
  return (
    <section className="py-12 md:py-16 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-3">
          {data.eyebrow}
        </p>
        <h2 className="font-display text-2xl md:text-4xl font-bold text-gray-900 mb-5 leading-tight">
          {data.title}
        </h2>
        <p className="text-gray-600 text-base md:text-lg leading-relaxed">
          {data.body}
        </p>
      </div>
    </section>
  );
}
