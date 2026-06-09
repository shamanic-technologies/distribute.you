import type { WhyMattersSection as WhyMattersData } from "@/data/benchmarks-content";

export function WhyMattersSection({ data }: { data: WhyMattersData }) {
  return (
    <section className="v2-section-tight">
      <div className="v2-shell max-w-3xl">
        <p className="v2-mono mb-3 text-xs uppercase tracking-wider text-[var(--v2-muted)]">
          {data.eyebrow}
        </p>
        <h2 className="v2-h2 mb-5 text-2xl md:text-4xl">
          {data.title}
        </h2>
        <p className="v2-body text-base md:text-lg">
          {data.body}
        </p>
      </div>
    </section>
  );
}
