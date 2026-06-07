import type { ValueRecap as ValueRecapData } from "@/data/benchmarks-content";

export function ValueRecap({ data, eyebrow }: { data: ValueRecapData; eyebrow?: string }) {
  return (
    <section className="py-10 md:py-12 px-4 bg-white border-y border-gray-100">
      <div className="max-w-3xl mx-auto">
        {eyebrow && (
          <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
            {eyebrow}
          </p>
        )}
        <h3 className="font-display text-xl md:text-2xl font-bold text-gray-900 mb-2">
          {data.headline}
        </h3>
        <p className="text-gray-600 text-base leading-relaxed">{data.body}</p>
      </div>
    </section>
  );
}
